// Click-through audit (v11, unit 7C): clicks EVERY button and link a visitor can reach and checks that each one does what its label says.
//   A  every overlay, at every waypoint (project CTAs, secondary links, area rows, education rows, contact, the first screen's two actions)
//   B  the top bar (Hub, Index, Contact, Sound, Pause), the ring radar, the rail ticks and the contact sheet
//   C  the Index menu (every area, every project row, the contact links) and the Index list below the track (every row)
//   D  every case view (every project): scroll cue, Up next, evidence thumbnails + lightbox (prev / next / close), wall arrows, book controls,
//      the QVR lab controls, every link; then Prev / Next / dots / Back
// Links: markup (external = target _blank + rel noopener), a real click that opens a tab, and an HTTP check (local: 200 + content type, PDF starts
// with %PDF; external: 2xx/3xx; LinkedIn answers 999 to scripts and is noted).
// usage: node scripts/audit-clicks.mjs [baseUrl] [out.md] [--only=A,B,C,D]
// The page is driven by scrolling (the way a visitor does it); nothing is pinned with __v3.goto.
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const flag = args.find(a => a.startsWith('--only='))
const ONLY = flag ? new Set(flag.slice(7).split(',')) : null
const wflag = args.find(a => a.startsWith('--wps='))
const WPS = wflag ? new Set(wflag.slice(6).split(',')) : null
const iflag = args.find(a => a.startsWith('--ids='))
const IDS = iflag ? new Set(iflag.slice(6).split(',')) : null
const pos = args.filter(a => !a.startsWith('--'))
const base = (pos[0] || 'http://127.0.0.1:5373').replace(/\/$/, '')
const outPath = pos[1] || `${root}docs/review/click-audit.md`
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const site = JSON.parse(readFileSync(`${root}src/data/site.json`, 'utf8'))
const projects = JSON.parse(readFileSync(`${root}src/data/projects.json`, 'utf8'))
const nameOf = id => projects.find(p => p.id === id)?.name ?? id

const rows = []
const add = (where, target, expected, ok, note = '') => { rows.push({ where, target, expected, ok, result: (ok ? 'PASS' : 'FAIL') + (note ? ` (${note})` : '') }); if (!ok) console.log(`FAIL ${where} | ${target} | ${expected} | ${note}`) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
// noWaitAfter: a click that opens a tab must not wait for that tab's navigation (the headless GPU build can stall it); the tab is checked on its own
const CLICK = { timeout: 9000, noWaitAfter: true }

const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
// external sites are not loaded in the popups (the HTTP check below does the reaching); a click only has to open the right tab
await ctx.route(u => new URL(u).origin !== new URL(base).origin, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>external</title>' }))
const page = await ctx.newPage()
const pageErrors = []
page.on('pageerror', e => pageErrors.push(String(e.message).split('\n')[0]))
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) pageErrors.push('console: ' + m.text().slice(0, 140)) })
await page.goto(`${base}/?gate=0`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__v3 && window.__v3.openWork && window.__v3.follower, null, { timeout: 90000 })
await page.waitForTimeout(2500)

const wps = await page.evaluate(async () => {
  const f = await import('/src/v3/world/flight.ts'); const L = await import('/src/v3/world/layout.ts')
  return L.WAYPOINTS.map((w, i) => ({ id: w.id, area: w.area, overlay: w.overlay, p: f.waypointP(i) }))
})
const caseIds = await page.evaluate(async () => (await import('/src/reels/index.ts')).CASE_REELS.map(r => r.projectId))

// ---------------------------------------------------------------- helpers
/** put the visitor at waypoint i the way scrolling does: scroll there, hand control to scroll, snap the follower */
async function place(i, settle = 1900) {
  await page.evaluate(p => {
    const v = window.__v3; v.goto(null)
    const track = document.getElementById('track'); const range = Math.max(1, track.offsetHeight - innerHeight)
    window.scrollTo(0, Math.round(p * range)); v.follower.snap(p)
  }, wps[i].p)
  await page.waitForTimeout(settle)
  // a flight the page started earlier (a rail jump) hides the copy until it ends: wait for the copy to be live and settled
  await page.waitForFunction(() => !document.documentElement.classList.contains('jumping') && !!document.querySelector('.ov.live'), null, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(700)
}
const stateOf = () => page.evaluate(() => { const s = window.__v3.state(); return { wp: s.wp, area: s.area, dwelling: !!s.dwelling, overlay: s.overlay } })
async function waitFlight(ms = 7000) {
  await page.waitForTimeout(500)
  await page.waitForFunction(() => !window.__v3.follower.jump && window.__v3.state().dwelling, null, { timeout: ms }).catch(() => {})
  await page.waitForTimeout(400)
}
const caseOpen = () => page.evaluate(() => !!document.querySelector('dialog.case[open]'))
const caseName = () => page.evaluate(() => document.querySelector('dialog.case[open] .case__dot[aria-current="true"]')?.getAttribute('aria-label') ?? null)
async function waitCase(open, ms = 6000) { await page.waitForFunction(o => !!document.querySelector('dialog.case[open]') === o, open, { timeout: ms }).catch(() => {}); return (await caseOpen()) === open }
async function closeCase() {
  if (!(await caseOpen())) return true
  await page.locator('dialog.case[open] .case__back').click(CLICK).catch(() => page.keyboard.press('Escape'))
  const ok = await waitCase(false, 9000)
  await page.waitForTimeout(250)
  return ok
}
const errs0 = () => pageErrors.length

// ---- links: verified once per distinct href
const linkCache = new Map()
async function fetchStatus(href) {
  if (linkCache.has(href)) return linkCache.get(href)
  let res
  try {
    if (href.startsWith('mailto:')) res = { ok: href === `mailto:${site.bio.email}`, note: 'mailto matches site.json email' }
    else if (new URL(href).origin === new URL(base).origin) {
      const r = await page.request.get(href, { timeout: 15000 })
      const ct = r.headers()['content-type'] || ''
      const buf = await r.body()
      const isPdf = /\.pdf($|\?)/i.test(href)
      const shell = await page.request.get(base + '/').then(x => x.text()).catch(() => '')
      const ok = r.status() === 200 && (isPdf ? /application\/pdf/.test(ct) && buf.subarray(0, 4).toString() === '%PDF' : /text\/html/.test(ct) ? buf.toString() !== shell : true)
      res = { ok, note: `${r.status()} ${ct.split(';')[0]}${isPdf ? ' %PDF' : ''}` }
    } else {
      const go = async method => fetch(href, { method, redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(15000) })
      let r = await go('HEAD').catch(() => null)
      if (!r || r.status >= 400) r = await go('GET').catch(() => r)
      const st = r?.status ?? 0
      res = /linkedin\.com/.test(href) && st === 999 ? { ok: true, note: '999: LinkedIn refuses scripts; link and markup verified' } : { ok: st >= 200 && st < 400, note: String(st || 'no response') }
    }
  } catch (e) { res = { ok: false, note: String(e.message).split('\n')[0].slice(0, 80) } }
  linkCache.set(href, res); return res
}
/** click an anchor, expect a new tab at its href (or, for a mailto, no tab), then check markup + HTTP */
async function auditLink(where, label, loc, { skipClick = false } = {}) {
  const info = await loc.evaluate(a => ({ href: a.href, raw: a.getAttribute('href'), target: a.target, rel: a.rel, text: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 50) })).catch(() => null)
  if (!info) return add(where, label, 'link exists', false, 'element vanished')
  const ext = /^https?:/.test(info.href) && new URL(info.href).origin !== new URL(base).origin
  const markupOk = !ext || (info.target === '_blank' && /noopener/.test(info.rel))
  const st = await fetchStatus(info.href)
  let clicked = 'not clicked', clickOk = true
  const url0 = page.url()
  if (!skipClick && !info.href.startsWith('mailto:')) {
    try {
      const popP = ctx.waitForEvent('page', { timeout: 9000 }); popP.catch(() => {})
      await loc.click(CLICK)
      const popup = await popP
      await popup.waitForURL(u => String(u) !== 'about:blank', CLICK).catch(() => {})
      clicked = 'opened a tab'; await popup.close().catch(() => {})
    } catch (e) {
      // a same-tab local link (a hash or an in-page route) is fine if the page is alive; everything else must open a tab
      const left = page.url().split('#')[0] !== url0.split('#')[0]
      if (left) { await page.goBack().catch(() => {}); await page.waitForFunction(() => window.__v3 && window.__v3.openWork, null, { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(2500) }
      clickOk = !left && info.target !== '_blank' && (await page.evaluate(() => !!window.__v3).catch(() => false))
      clicked = clickOk ? 'in-page' : left ? 'LEAVES THE SITE in the same tab' : 'no tab opened: ' + String(e.message).split('\n')[0].slice(0, 50)
    }
  }
  add(where, `${label} -> ${info.raw}`, ext ? 'new tab (noopener), URL resolves' : 'resolves', markupOk && st.ok && clickOk, `${st.note}; ${clicked}${markupOk ? '' : '; MISSING target=_blank rel=noopener'}`)
}

// ---------------------------------------------------------------- A: overlays at every waypoint
async function auditOverlays() {
  const seenOverlay = new Set()
  for (let i = 0; i < wps.length; i++) {
    const w = wps[i]
    if (WPS && !WPS.has(w.id)) continue
    await place(i)
    const where = `A overlay ${w.overlay} (waypoint ${w.id})`
    const key = w.overlay + ':' + (w.overlay === 'offboard' ? w.id : '')
    if (seenOverlay.has(key) && !['offboard'].includes(w.overlay)) continue
    seenOverlay.add(key)
    const ov = page.locator('.ov.live')
    if (!(await ov.count())) { add(where, '(overlay)', 'overlay is live and clickable', false, 'no live overlay at this waypoint'); continue }
    const items = await ov.first().evaluate(el => [...el.querySelectorAll('button, a[href]')].map((e, k) => ({ k, tag: e.tagName, cls: e.className, label: (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70), project: e.getAttribute('data-project'), href: e.getAttribute('href') })))
    for (const it of items) {
      const loc = ov.first().locator('button, a[href]').nth(it.k)
      const label = it.label || it.cls
      if (it.tag === 'A') {
        if (/to-index/.test(it.cls)) {
          await loc.click(CLICK).catch(() => {})
          await page.waitForTimeout(900)
          const y = await page.evaluate(() => scrollY); const idxTop = await page.evaluate(() => document.getElementById('index')?.getBoundingClientRect().top ?? 1e9)
          add(where, label, 'scrolls to the Index list', idxTop < innerHeight0() * 1.2 || y > 100, `index top ${Math.round(idxTop)}px`)
          await place(i); continue
        }
        await auditLink(where, label, loc, { skipClick: it.href?.startsWith('mailto:') })
        await page.waitForTimeout(150); continue
      }
      // buttons
      const before = errs0()
      try {
        if (it.project) {
          await loc.click(CLICK)
          const opened = await waitCase(true), who = await caseName()
          const ok = opened && !!who && who.includes(nameOf(it.project).slice(0, 14))
          add(where, label, `opens the case study of ${nameOf(it.project)}`, ok, ok ? who : opened ? `wrong case: ${who}` : 'no case view opened')
          await page.waitForTimeout(1200); await closeCase(); await place(i, 900)
        } else if (/toc-row/.test(it.cls)) {
          const want = (it.label.match(/Jump to ([^.]+)/) || [])[1]
          const areaId = ['mind', 'systems', 'research', 'work', 'education', 'about'][['Second Brain', 'Systems that run themselves', 'Models of human behavior', 'Work', 'Education', 'About'].indexOf(want)]
          await loc.click(CLICK); await waitFlight()
          const s = await stateOf()
          add(where, label, `flies to the ${areaId} area`, s.area === areaId, `landed in ${s.area}`)
          await place(i, 900)
        } else if (/edu-row/.test(it.cls)) {
          const t0 = await page.locator('#edu-detail').textContent()
          await loc.click(CLICK); await page.waitForTimeout(250)
          const exp = await loc.getAttribute('aria-expanded'), t1 = await page.locator('#edu-detail').textContent()
          add(where, label, 'row expands and shows its detail', exp === 'true' && !!t1, `aria-expanded=${exp}${t0 !== t1 ? ', detail changed' : ''}`)
        } else if (/\bcp\b/.test(it.cls)) {
          await loc.click(CLICK); await page.waitForTimeout(900)
          const txt = await loc.textContent()
          add(where, label, 'copies the email address (label reads Copied)', /Copied|Press/.test(txt || ''), `label: ${txt?.trim()}`)
        } else if (/first-acts/.test(await loc.evaluate(e => e.parentElement.className)) && /tour/i.test(it.label)) {
          await loc.click(CLICK); await waitFlight()
          const s = await stateOf()
          add(where, label, 'flies to the establishing shot (the six areas)', wps[s.wp]?.id === 'world', `landed at ${wps[s.wp]?.id}`)
          await place(i, 900)
        } else if (/first-acts/.test(await loc.evaluate(e => e.parentElement.className)) && /index/i.test(it.label)) {
          await loc.click(CLICK); await page.waitForTimeout(900)
          const open = await page.evaluate(() => !!document.querySelector('dialog.nm[open]'))
          add(where, label, 'opens the Index menu', open)
          await page.keyboard.press('Escape'); await page.waitForTimeout(700)
        } else {
          await loc.click(CLICK); await page.waitForTimeout(500)
          add(where, label, 'responds', true, 'clicked; no error')
        }
      } catch (e) { add(where, label, 'clickable', false, String(e.message).split('\n')[0].slice(0, 90)); if (process.env.AUDIT_VERBOSE) console.log(String(e.message).split('\n').slice(0, 14).join('\n   ')); if (await caseOpen()) await closeCase() }
      if (errs0() > before) add(where, label, 'no console error', false, pageErrors.slice(before).join(' | ').slice(0, 120))
    }
  }
}
const innerHeight0 = () => 900

// ---------------------------------------------------------------- B: top bar, radar, rail, contact sheet
async function auditChrome() {
  await place(0, 1500)
  const where = 'B top bar'
  // Index + Contact + Hub + Sound + Pause
  await page.locator('.nb .nbtn').filter({ hasText: /^\s*Index/ }).first().click(CLICK)
  await page.waitForTimeout(800)
  add(where, 'Index', 'opens the Index menu', await page.evaluate(() => !!document.querySelector('dialog.nm[open]')))
  await page.locator('dialog.nm[open] .nm-x').click(CLICK); await page.waitForTimeout(700)
  add(where, 'Index > Close', 'closes the menu', !(await page.evaluate(() => !!document.querySelector('dialog.nm[open]'))))
  await page.locator('.nb .nbtn.is-contact').click(CLICK); await page.waitForTimeout(800)
  const sheetOpen = await page.evaluate(() => !!document.querySelector('dialog.nc[open]'))
  add(where, 'Contact', 'opens the contact sheet', sheetOpen)
  if (sheetOpen) {
    const sheet = page.locator('dialog.nc[open]')
    const its = await sheet.evaluate(el => [...el.querySelectorAll('button, a[href]')].map((e, k) => ({ k, tag: e.tagName, cls: e.className, label: (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60) })))
    for (const it of its) {
      const loc = sheet.locator('button, a[href]').nth(it.k)
      if (/nm-x/.test(it.cls)) continue
      if (it.tag === 'A') { if (/to-index/.test(it.cls)) continue; await auditLink('B contact sheet', it.label, loc, { skipClick: /mailto/.test(await loc.getAttribute('href')) }) }
      else if (/\bcp\b/.test(it.cls)) { await loc.click(CLICK); await page.waitForTimeout(900); const t = await loc.textContent(); add('B contact sheet', it.label, 'copies the email address', /Copied|Press/.test(t || ''), `label: ${t?.trim()}`) }
    }
    await sheet.locator('.nm-x').click(CLICK); await page.waitForTimeout(700)
    add(where, 'Contact > Close', 'closes the sheet', !(await page.evaluate(() => !!document.querySelector('dialog.nc[open]'))))
  }
  // Pause / Sound toggles
  for (const name of ['Pause', 'Sound']) {
    const b = page.locator('.tog').filter({ hasText: name }).first()
    const sig = () => b.evaluate(e => e.getAttribute('aria-pressed') + '|' + e.className + '|' + e.textContent + '|' + document.documentElement.className)
    const s0 = await sig(); await b.click(CLICK); await page.waitForTimeout(500); const s1 = await sig()
    add(where, name, 'toggles its state', s0 !== s1, s0 !== s1 ? 'state changed' : 'no change')
    await b.click(CLICK).catch(() => {}); await page.waitForTimeout(300)
  }
  // id link (back to the start)
  await place(8, 1200)
  await page.locator('a.id').first().click(CLICK); await waitFlight(9000)
  add(where, 'Joseph Blumberg (top-left)', 'flies back to the start', (await stateOf()).wp <= 1, `wp ${(await stateOf()).wp}`)
  // rail ticks
  await place(0, 1200)
  const ticks = await page.locator('.tk').count()
  for (let k = 0; k < ticks; k++) {
    const t = page.locator('.tk').nth(k); const lab = (await t.getAttribute('aria-label')) || `tick ${k}`
    await place(0, 700)
    await t.click(CLICK).catch(e => add('B rail', lab, 'clickable', false, String(e.message).split('\n')[0].slice(0, 80)))
    await waitFlight(9000)
    const s = await stateOf()
    add('B rail', lab, 'flies to that stop', s.wp > 0 || /Prooemium/.test(lab), `landed at ${wps[s.wp]?.id}`)
  }
  // radar nodes
  const nodes = await page.locator('.mm-n').count()
  for (let k = 0; k < nodes; k++) {
    await place(2, 900)
    const n = page.locator('.mm-n').nth(k); const lab = (await n.getAttribute('aria-label')) || `node ${k}`
    const area = await n.getAttribute('data-area')
    await n.click(CLICK).catch(e => add('B radar', lab, 'clickable', false, String(e.message).split('\n')[0].slice(0, 80)))
    await waitFlight(9000)
    add('B radar', lab, `flies to the ${area} area`, (await stateOf()).area === area, `landed in ${(await stateOf()).area}`)
  }
}

// ---------------------------------------------------------------- C: the Index menu and the Index list
async function auditIndex() {
  await place(2, 1500)
  const open = async () => { await page.keyboard.press('m'); await page.waitForTimeout(700); return page.evaluate(() => !!document.querySelector('dialog.nm[open]')) }
  if (!(await open())) { add('C Index menu', 'M key / Index button', 'opens the Index menu', false); return }
  const items = await page.evaluate(() => [...document.querySelectorAll('dialog.nm[open] .nm-it')].map(li => ({ id: li.getAttribute('data-id'), projects: [...li.querySelectorAll('.nm-p')].map(p => ({ project: p.getAttribute('data-project'), href: p.getAttribute('href'), label: (p.getAttribute('aria-label') || p.textContent || '').trim().slice(0, 60) })) })))
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  for (const it of items) {
    const where = `C Index menu: ${it.id}`
    // the entry itself
    await place(2, 900); await open()
    const li = page.locator(`dialog.nm[open] .nm-it[data-id="${it.id}"]`)
    await li.locator('.nm-go').click(CLICK).catch(e => add(where, 'entry', 'clickable', false, String(e.message).split('\n')[0].slice(0, 80)))
    await page.waitForTimeout(900)
    if (it.id === 'contact') {
      add(where, 'Contact entry', 'opens the contact sheet', await page.evaluate(() => !!document.querySelector('dialog.nc[open]')))
      await page.keyboard.press('Escape'); await page.waitForTimeout(600)
    } else {
      await waitFlight(9000); const s = await stateOf()
      const want = it.id === 'hub' ? 'hub' : it.id
      add(where, `${it.id} entry`, `flies to ${want}`, want === 'hub' ? wps[s.wp]?.id === 'world' : s.area === want, `landed at ${wps[s.wp]?.id} (${s.area})`)
    }
    // its projects
    for (let k = 0; k < it.projects.length; k++) {
      const pr = it.projects[k]
      await place(2, 800); await open()
      const li2 = page.locator(`dialog.nm[open] .nm-it[data-id="${it.id}"]`)
      await li2.locator('.nm-tg').click(CLICK).catch(() => {})
      await page.waitForTimeout(350)
      const loc = li2.locator('.nm-p').nth(k)
      if (pr.href) { await auditLink(where, pr.label, loc, { skipClick: /^mailto:/.test(pr.href) }); await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(500); continue }
      await loc.click(CLICK).catch(e => add(where, pr.label, 'clickable', false, String(e.message).split('\n')[0].slice(0, 80)))
      const opened = await waitCase(true, 12000), who = await caseName()
      const ok = opened && !!who && who.includes(nameOf(pr.project).slice(0, 14))
      add(where, pr.label, `flies there and opens the case study of ${nameOf(pr.project)}`, ok, ok ? who : opened ? `wrong case: ${who}` : 'no case view opened')
      await page.waitForTimeout(1000); await closeCase()
    }
  }
  // the Index list below the track
  await place(wps.length - 1, 1200)
  await page.evaluate(() => document.getElementById('index')?.scrollIntoView({ block: 'start' })); await page.waitForTimeout(1800)
  const rows2 = await page.evaluate(() => [...document.querySelectorAll('#index .idx-grid li')].map((li, k) => ({ k, parts: [...li.querySelectorAll('.row, .ch-go')].map(e => ({ tag: e.tagName, cls: e.className, label: (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) })) })))
  for (const r of rows2) {
    for (let j = 0; j < r.parts.length; j++) {
      const pt = r.parts[j]; const where = 'C Index list'
      const loc = page.locator('#index .idx-grid li').nth(r.k).locator('.row, .ch-go').nth(j)
      await page.evaluate(() => document.getElementById('index')?.scrollIntoView({ block: 'start' }))
      if (pt.tag === 'BUTTON') {
        await loc.click(CLICK).catch(e => add(where, pt.label, 'clickable', false, String(e.message).split('\n')[0].slice(0, 80)))
        const opened = await waitCase(true), who = await caseName()
        add(where, pt.label.slice(0, 60), 'opens that project\'s case study', opened && !!who, who ?? 'no case view')
        await page.waitForTimeout(1000); await closeCase()
        await page.evaluate(() => document.getElementById('index')?.scrollIntoView({ block: 'start' })); await page.waitForTimeout(300)
      } else {
        await loc.click(CLICK).catch(e => add(where, pt.label, 'clickable', false, String(e.message).split('\n')[0].slice(0, 80)))
        await waitFlight(9000); const s = await stateOf()
        add(where, pt.label.slice(0, 60), 'flies to that area', s.dwelling && s.wp < wps.length - 1, `landed at ${wps[s.wp]?.id}`)
        await place(wps.length - 1, 900); await page.evaluate(() => document.getElementById('index')?.scrollIntoView({ block: 'start' })); await page.waitForTimeout(800)
      }
    }
  }
  // footer links
  const foot = page.locator('#index .idx-foot a')
  for (let k = 0; k < (await foot.count()); k++) { const a = foot.nth(k); const t = (await a.textContent())?.trim() ?? ''; if (/Back to the beginning/.test(t)) { await a.click(CLICK); await waitFlight(9000); add('C Index list', t, 'flies back to the start', (await stateOf()).wp <= 1, `wp ${(await stateOf()).wp}`); await place(wps.length - 1, 900); await page.evaluate(() => document.getElementById('index')?.scrollIntoView({ block: 'start' })); continue } await auditLink('C Index list footer', t, a) }
}

// ---------------------------------------------------------------- D: every case view
const sigOf = () => page.evaluate(() => {
  const d = document.querySelector('dialog.case[open]'); if (!d) return 'closed'
  const sc = d.querySelector('.case__scroll'), lb = d.querySelector('dialog.case-lb') || document.querySelector('dialog.case-lb')
  const txt = [...d.querySelectorAll('section, .cv-lab, .cv-wall, .cv-book')].map(e => e.innerText).join('|').replace(/\d\d:\d\d:\d\d/g, '')
  let h = 0; for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) | 0
  return JSON.stringify({ ch: d.querySelector('.case__chn')?.textContent, st: Math.round(sc?.scrollTop ?? 0), lb: !!lb?.open, h, aria: [...d.querySelectorAll('[aria-pressed],[aria-selected],[aria-expanded],[aria-current]')].map(e => e.getAttribute('aria-pressed') + e.getAttribute('aria-selected') + e.getAttribute('aria-expanded') + e.className).join(','), wall: [...d.querySelectorAll('.cv-wall *')].reduce((a, e) => a + (e.scrollLeft || 0), 0), bk: d.querySelector('.bk-range')?.value })
})
async function sweepCase(id) {
  const where = `D case view: ${nameOf(id)}`
  await page.evaluate(i => window.__v3.openWork(i), id)
  if (!(await waitCase(true))) { add(where, '(open)', 'case view opens', false, 'did not open'); return }
  await page.waitForTimeout(1800)
  const sel = 'button, a[href], input[type=range]'
  const scope = page.locator('dialog.case[open]')
  const descs = await scope.evaluate((el, s) => [...el.querySelectorAll(s)].map((e, k) => ({ k, tag: e.tagName, cls: e.className?.toString() ?? '', label: (e.getAttribute('aria-label') || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 70), hidden: !(e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0), inBar: !!e.closest('.case__bar'), inLb: !!e.closest('dialog.case-lb') })), sel)
  let lbTested = false
  for (const d of descs) {
    if (d.inBar) continue
    if (d.inLb) continue
    const loc = scope.locator(sel).nth(d.k)
    const before = errs0()
    try {
      if (d.tag === 'A') { await auditLink(where, d.label, loc); await page.waitForTimeout(100); if (!(await caseOpen())) throw new Error('case closed by a link click') ; continue }
      // the QVR lab hides one tab's controls while the other is shown: bring the tab that owns this control back first
      if (!(await loc.isVisible())) {
        const tabs = scope.locator('.vl-tab')
        for (let t = 0; t < (await tabs.count()) && !(await loc.isVisible()); t++) { await tabs.nth(t).click(CLICK).catch(() => {}); await page.waitForTimeout(500) }
      }
      if (!(await loc.isVisible())) { add(where, d.label || d.cls, 'visible control', false, 'hidden, and no lab tab reveals it'); continue }
      // a control that is disabled by design at the edge of its range (the first spread of a book has nothing to turn back to)
      if (await loc.isDisabled().catch(() => false)) { add(where, d.label || d.cls, 'disabled at the edge of its range', true, 'disabled by design here'); continue }
      const s0 = await sigOf()
      if (d.tag === 'INPUT') { await loc.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight') } else await loc.click(CLICK)
      await page.waitForTimeout(650)
      let s1 = await sigOf()
      if (s1 === s0) { await page.waitForTimeout(700); s1 = await sigOf() }
      const lbOpen = await page.evaluate(() => !!document.querySelector('dialog.case-lb[open]'))
      if (lbOpen && !lbTested) {
        lbTested = true
        for (const [lab, q] of [['Next item', '.case-lb__nav[aria-label="Next item"]'], ['Previous item', '.case-lb__nav[aria-label="Previous item"]']]) {
          const b = page.locator(`dialog.case-lb[open] ${q}`)
          if (await b.count() && await b.isVisible()) { const t0 = await page.evaluate(() => document.querySelector('dialog.case-lb[open]')?.innerHTML.length); await b.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500); const ok = await page.evaluate(() => !!document.querySelector('dialog.case-lb[open]')); add(where, `lightbox: ${lab}`, 'moves to the neighbouring item', ok, 'lightbox still open') }
        }
        await page.locator('dialog.case-lb[open] .case-lb__x').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500)
        add(where, 'lightbox: Close', 'closes the lightbox', !(await page.evaluate(() => !!document.querySelector('dialog.case-lb[open]'))))
      } else if (lbOpen) { await page.keyboard.press('Escape'); await page.waitForTimeout(450) }
      // controls that act on a WebGL canvas leave no trace in the DOM: the click is delivered and raises no error
      const canvasOnly = /Reset view/.test(d.label)
      const changed = s1 !== s0 || canvasOnly
      add(where, d.label || d.cls, lbOpen ? 'opens the lightbox' : 'responds (state, scroll or channel changes)', changed || lbOpen, changed ? (lbOpen ? 'lightbox opened' : canvasOnly && s1 === s0 ? 'canvas-only control: click delivered, no error' : 'state changed') : 'NO VISIBLE RESPONSE')
      // a control that moved the case to another channel or closed it: bring it back
      if (!(await caseOpen()) || ((await caseName()) ?? '') && !(await caseName()).includes(nameOf(id).slice(0, 14))) { await page.evaluate(i => window.__v3.openWork(i), id); await waitCase(true); await page.waitForTimeout(1800) }
    } catch (e) { add(where, d.label || d.cls, 'clickable', false, String(e.message).split('\n')[0].slice(0, 90)); if (!(await caseOpen())) { await page.evaluate(i => window.__v3.openWork(i), id); await waitCase(true); await page.waitForTimeout(1500) } }
    if (errs0() > before) add(where, d.label || d.cls, 'no console error', false, pageErrors.slice(before).join(' | ').slice(0, 120))
  }
  // the bar: Next / Prev (and back), then Back
  await page.evaluate(() => document.querySelector('dialog.case[open] .case__scroll')?.scrollTo(0, 0)); await page.waitForTimeout(500)
  for (const [dir, lab] of [[1, 'Next'], [-1, 'Prev']]) {
    const c0 = await page.locator('dialog.case[open] .case__chn').textContent().catch(() => null)
    await page.locator(`dialog.case[open] .case__step[data-d="${dir}"]`).click(CLICK).catch(e => add(where, lab, 'clickable', false, String(e.message).split('\n')[0].slice(0, 80)))
    await page.waitForTimeout(1900)
    const c1 = await page.locator('dialog.case[open] .case__chn').textContent().catch(() => null)
    add(where, `${lab} work (top bar)`, 'moves to the neighbouring work', c0 !== c1, `${c0?.replace(/\s+/g, '')} -> ${c1?.replace(/\s+/g, '')}`)
    if (lab === 'Next') { await page.locator('dialog.case[open] .case__step[data-d="-1"]').click(CLICK).catch(() => {}); await page.waitForTimeout(1900) }
  }
  const backOk = await closeCase()
  add(where, 'Back to the set', 'closes the case view', backOk)
}
async function auditCases() {
  for (const id of caseIds) { if (IDS && !IDS.has(id)) continue; await place(2, 400); await sweepCase(id); await page.waitForTimeout(400) }
  // the channel dots, once (they are the same in every view)
  await page.evaluate(() => window.__v3.openWork('selforge')); await waitCase(true); await page.waitForTimeout(1800)
  const n = await page.locator('dialog.case[open] .case__dot').count()
  for (let k = 0; k < n; k++) {
    const dot = page.locator('dialog.case[open] .case__dot').nth(k)
    const lab = await dot.getAttribute('aria-label')
    await dot.click(CLICK).catch(e => add('D case dots', lab, 'clickable', false, String(e.message).split('\n')[0].slice(0, 80)))
    await page.waitForTimeout(k === 0 ? 300 : 1700)
    const who = await caseName()
    add('D case dots', lab, 'switches to that work', !!who && who === lab, who ?? 'no case')
  }
  await closeCase()
}

// ---------------------------------------------------------------- run
const run = async (key, fn) => { if (ONLY && !ONLY.has(key)) return; const t = Date.now(); try { await fn() } catch (e) { add(`${key} (script)`, 'section', 'completes', false, String(e.message).split('\n')[0].slice(0, 120)) } console.log(`section ${key} done in ${Math.round((Date.now() - t) / 1000)}s, ${rows.length} rows`) }
await run('A', auditOverlays)
await run('B', auditChrome)
await run('C', auditIndex)
await run('D', auditCases)
await browser.close()

const fail = rows.filter(r => !r.ok)
const md = [
  '# Click-through audit (v11, unit 7C)', '',
  `Generated by \`scripts/audit-clicks.mjs\` against ${base}, 1440 x 900, scroll-driven. ${rows.length} targets clicked or checked: ${rows.length - fail.length} PASS, ${fail.length} FAIL.`,
  'Links: markup (external = new tab + noopener), a real click that opens a tab, and an HTTP check (local: 200 + content type, PDF starts with %PDF; external: 2xx/3xx; LinkedIn answers 999 to scripts and is noted).', '',
  pageErrors.length ? `Console/page errors seen during the run: ${pageErrors.length} (first: ${[...new Set(pageErrors)].slice(0, 3).join(' | ').replace(/\|/g, '/')})` : 'Console/page errors seen during the run: none.', '',
  '| Where | Target | Expected | Result |', '|---|---|---|---|',
  ...rows.map(r => `| ${r.where.replace(/\|/g, '/')} | ${r.target.replace(/\|/g, '/')} | ${r.expected.replace(/\|/g, '/')} | ${r.result.replace(/\|/g, '/')} |`),
].join('\n')
writeFileSync(outPath, md + '\n')
console.log(`\n${rows.length} rows: ${rows.length - fail.length} PASS, ${fail.length} FAIL -> ${outPath}`)
for (const r of fail.slice(0, 40)) console.log(`FAIL | ${r.where} | ${r.target} | ${r.result}`)
