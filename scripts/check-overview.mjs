// Acceptance check for the Overview (unit 8C) and for the ending, which is the same page shown inline at the last stop (unit ending). ONE headless browser at a
// time through scripts/lib/browser.mjs (the shared 2-slot lock), always closed in finally.
// usage: node scripts/check-overview.mjs [baseUrl=http://localhost:5200] [--shots]
//   --shots   also writes shots/v12-first-1440.png, shots/v12-overview-1440.png, shots/v12-overview-390.png, shots/v12-ending-1440.png, shots/v12-ending-390.png
//   --shots=first | overview-1440 | overview-390 | ending-1440 | ending-390   (comma list) writes only those
// Checks: the first screen offers Start / Watch the tour; the Overview opens from its top-bar button and from the key O (and closes on O and Esc) and lists both
// addresses; five or more different rows each open the right case study or reach the right stop; a #overview deep link opens it on a phone; there is no Index below
// the track any more; a link to #index (the Index menu's footer) lands on the ending; the ending shows the contact first (two mailto links, each with its own Copy:
// the clipboard text is checked), then Experience, Education and every project; it scrolls inside itself without moving the flight, on a wheel and on a touch swipe;
// O at the ending brings it to its top; Replay the tour returns to the start; every numeral on both pages traces to src/data (same rule as scripts/proofread.mjs).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { withBrowser } from './lib/browser.mjs'

const args = process.argv.slice(2)
const base = (args.find(a => !a.startsWith('--')) || 'http://localhost:5200').replace(/\/$/, '')
const shotArg = args.find(a => a === '--shots' || a.startsWith('--shots='))
const shotSet = shotArg ? (shotArg.includes('=') ? shotArg.split('=')[1].split(',') : ['first', 'overview-1440', 'overview-390', 'ending-1440', 'ending-390']) : []
const shots = shotSet.length > 0
const out = fileURLToPath(new URL('../shots/', import.meta.url))

const data = ['projects', 'site', 'nervous-system', 'brain-graph', 'media', 'stats', 'credits', 'coursework'].map(f => readFileSync(new URL(`../src/data/${f}.json`, import.meta.url), 'utf8')).join('\n')
const site = JSON.parse(readFileSync(new URL('../src/data/site.json', import.meta.url), 'utf8')).bio
const GMAIL = site.email, UCHI = site.emailUchicago
const dataNums = new Set((data.match(/\d[\d,.]*/g) || []).map(n => n.replace(/[.,]$/, '')))
const STRUCT = /^(0?\d|1\d|2[0-4]|00|06|12|18|100|404)$/
const missing = text => {
  const bad = new Set()
  for (const raw of text.match(/\d[\d,.]*/g) || []) { const n = raw.replace(/[.,]$/, ''); if (!(dataNums.has(n) || STRUCT.test(n) || /^0\d\d$/.test(n))) bad.add(n) }
  return [...bad]
}

const results = []
const ok = (name, pass, info = '') => { results.push({ name, pass: !!pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const logs = []
/** run one section; an error in it is a failure of that section, not the end of the run */
const section = async (name, fn) => { try { await fn() } catch (e) { ok(`${name}: ran to the end`, false, String(e.message || e).split('\n')[0].slice(0, 160)) } }

await withBrowser(async browser => {
  // the dev server reloads the page whenever another file changes: the check swallows its HMR socket, so the page keeps the code it loaded
  const newContext = async opts => {
    const ctx = await browser.newContext(opts)
    await ctx.routeWebSocket(u => u.port === new URL(base).port, () => {})
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin }).catch(() => {})
    return ctx
  }
  // ---------------------------------------------------------------- desktop
  const ctx = await newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text().split('\n')[0]) })
  page.on('pageerror', e => logs.push('pageerror ' + e.message))
  await page.goto(`${base}/?gate=0`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForFunction(() => document.documentElement.classList.contains('is-ready') && window.__v3?.ui?.nav, null, { timeout: 60000 })
  await page.waitForTimeout(shots ? 5200 : 2800)

  const dlgOpen = () => page.evaluate(() => { const d = document.querySelector('dialog.ovw'); return !!d && d.open && d.classList.contains('on') })
  const waitDlg = async (want, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await dlgOpen()) === want) return true; await sleep(100) } return false }
  const where = () => page.evaluate(() => window.__v3.ui.nav.where()?.id)
  const reach = async (want, ms = 14000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await where()) === want && !(await dlgOpen()) && !(await page.evaluate(() => document.documentElement.classList.contains('jumping')))) return true; await sleep(250) } return false }
  const total = await page.evaluate(async () => (await import('/src/data.ts')).projects.length)

  await section('first screen', async () => {
    const acts = await page.$$eval('#ov-prologue .first-acts .open', els => els.map(e => e.querySelector('.ot')?.textContent))
    ok('first screen offers Start and Watch the tour', JSON.stringify(acts) === JSON.stringify(['Start', 'Watch the tour']), JSON.stringify(acts))
    const firstText = await page.evaluate(() => document.querySelector('#ov-prologue')?.textContent || '')
    ok('first screen names the person, school and claim', /Joseph Blumberg/.test(firstText) && /University of Chicago/.test(firstText) && /systems that run themselves/i.test(firstText))
    const hud0 = await page.evaluate(() => document.querySelector('#hud .ct')?.innerText.replace(/\n/g, ' / '))
    ok('HUD names where you are', /Opening/i.test(hud0 || ''), hud0)
    if (shotSet.includes('first')) await page.screenshot({ path: out + 'v12-first-1440.png' })
  })

  await section('the Overview dialog', async () => {
    await page.click('#hud .nbtn.is-overview', { timeout: 8000 })
    ok('Overview opens from the top-bar button', await waitDlg(true))
    await page.waitForTimeout(900)
    ok('#overview is in the address', (await page.evaluate(() => location.hash)) === '#overview')
    const txt = (await page.evaluate(() => document.querySelector('dialog.ovw').innerText)).toLowerCase()
    ok('Overview has education, experience, projects, interests, contact', ['Education', 'Experience', 'Projects', 'Interests', 'University of Chicago', 'QVR Advisors', 'Systems that run themselves', 'Reading instruments', 'LinkedIn', 'GitHub'].every(s => txt.includes(s.toLowerCase())))
    ok('Overview lists both addresses, each a mailto link with its own Copy', txt.includes(GMAIL) && txt.includes(UCHI) && (await page.$$eval('dialog.ovw a[href^="mailto:"]', a => a.map(x => x.getAttribute('href')))).join() === `mailto:${GMAIL},mailto:${UCHI}` && (await page.$$('dialog.ovw button[data-copy]')).length === 2)
    ok('Overview numerals all trace to src/data', missing(txt).length === 0, missing(txt).join(' '))
    if (shotSet.includes('overview-1440')) await page.screenshot({ path: out + 'v12-overview-1440.png' })
    const n = await page.$$eval('dialog.ovw .ovw-row', r => r.length)
    ok('every project except the QVR role has a row', n === total - 1, `${n} rows, ${total} projects`)
    // each Copy puts its own address on the clipboard
    await page.click('dialog.ovw button[data-copy="uchicago"]'); await page.waitForTimeout(300)
    const c1 = await page.evaluate(() => navigator.clipboard.readText())
    await page.click('dialog.ovw button[data-copy="personal"]'); await page.waitForTimeout(300)
    const c2 = await page.evaluate(() => navigator.clipboard.readText())
    ok('Overview: Copy puts the right address on the clipboard, each button its own', c1 === UCHI && c2 === GMAIL, `${c1} | ${c2}`)

    // close with Esc and with O
    await page.keyboard.press('Escape')
    ok('Esc closes the Overview', await waitDlg(false))
    await page.keyboard.press('o')
    ok('key O opens it', await waitDlg(true))
    await page.keyboard.press('o')
    ok('key O closes it', await waitDlg(false))
    await page.click('#hud .nbtn.is-overview')
    ok('the top-bar Overview button opens it', await waitDlg(true))
  })

  // ---- rows: each opens its case
  const caseOpen = async (id, name) => {
    await page.click(`dialog.ovw .ovw-main[data-project="${id}"]`)
    let good = false
    for (let i = 0; i < 60 && !good; i++) {
      await sleep(150)
      good = await page.evaluate(n => { const d = document.querySelector('dialog.case[open]'); const t = document.querySelector('#case-name')?.textContent || ''; return !!d && t.toLowerCase().replace(/[^a-z0-9]/g, '').includes(n.toLowerCase().replace(/[^a-z0-9]/g, '')) }, name)
    }
    ok(`row "${name}" opens its case study`, good)
    await page.keyboard.press('Escape')
    for (let i = 0; i < 40; i++) { if (!(await page.evaluate(() => !!document.querySelector('dialog.case[open]')))) break; await sleep(150) }
    await sleep(300)
    ok(`closing the case returns to the Overview (${name})`, await dlgOpen())
  }
  await section('rows open cases', async () => {
    await caseOpen('zeta', 'ZETA')
    await caseOpen('wwii', 'Unequal Mobilization')
    await caseOpen('metamorphoses', 'Metamorphoses')
    await caseOpen('secretary', 'Secretary')
    // experience row: QVR (role level) and a project group chip jump
    await page.click('dialog.ovw .ovw-main[data-row="exp-qvr"]')
    let qvrOk = false
    for (let i = 0; i < 60 && !qvrOk; i++) { await sleep(150); qvrOk = await page.evaluate(() => /qvr/i.test(document.querySelector('#case-name')?.textContent || '') && !!document.querySelector('dialog.case[open]')) }
    ok('Experience row "QVR Advisors" opens its case study', qvrOk)
    await page.keyboard.press('Escape'); await sleep(1800)
    await page.click('dialog.ovw .ovw-chip:has-text("Research")')
    await sleep(1100)
    const jumped = await page.evaluate(() => { const g = document.querySelector('#ovw-g-research').getBoundingClientRect(); return g.top > 40 && g.top < 300 })
    ok('a group chip scrolls to its group', jumped)
  })

  // ---- rows that fly to a stop
  await section('rows fly to a stop', async () => {
    await page.click('dialog.ovw .ovw-tour[data-stop="zeta"]')
    ok('"In the tour" on ZETA reaches the ZETA stop', await reach('drill'), 'at ' + (await where()))
    await page.waitForTimeout(1200)
    const hudZ = await page.evaluate(() => document.querySelector('#hud .ct')?.innerText.replace(/\n/g, ' / '))
    ok('HUD reads "4 of 5 in Systems" at ZETA', /ZETA/i.test(hudZ || '') && /4 of 5 in Systems/i.test(hudZ || ''), hudZ)
    await page.keyboard.press('o')
    await waitDlg(true)
    // the row's button (its ::after stretches over the whole row): scroll it into view, check what a click at its centre would hit, then click for real
    const edu = page.locator('dialog.ovw button.ovw-main[data-row="edu-uchicago"]')
    await edu.scrollIntoViewIfNeeded({ timeout: 8000 }); await page.waitForTimeout(500)
    const hit = await edu.evaluate(b => { const r = b.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { y: Math.round(r.top), h: Math.round(r.height), ok: !!el && (el === b || b.contains(el)), el: el ? (el.className || el.tagName) : null } })
    await edu.click({ timeout: 8000 })
    ok('Education row reaches the University of Chicago stop', await reach('school'), 'at ' + (await where()) + ' ' + JSON.stringify(hit))
    await page.waitForTimeout(1200)
    const hudS = await page.evaluate(() => document.querySelector('#hud .ct')?.innerText.replace(/\n/g, ' / '))
    ok('HUD reads "1 of 3 in Education" at school', /1 of 3 in Education/i.test(hudS || ''), hudS)
    // the area card lists its stops; a chip flies there
    const stopChips = await page.$$eval('#ov-education .stops .open.chip', els => els.map(e => e.textContent))
    ok('the Education card lists its three stops', stopChips.length === 3, JSON.stringify(stopChips))
    await page.click('#ov-education .stops .open.chip[data-stop="instrument"]')
    ok('a stop chip flies to that stop', await reach('instrument'), 'at ' + (await where()))
    // Index menu: counts per area
    await page.keyboard.press('m')
    await sleep(700)
    const idx = await page.$$eval('dialog.nm .nm-it .nm-c', els => els.map(e => e.textContent))
    ok('the Index menu shows a count under every area', idx.length >= 7 && idx.every(t => /stop/.test(t)), JSON.stringify(idx))
    await page.keyboard.press('Escape'); await sleep(400)
  })

  // ---- the end: no Index below the track; the ending is the overview, inline
  await section('no Index below the track', async () => {
    const g = await page.evaluate(() => {
      const track = document.getElementById('track'), idx = document.getElementById('index')
      return { idxShown: !!idx && getComputedStyle(idx).display !== 'none', oldIndex: document.querySelectorAll('.idx, .idx-grid').length, over: Math.round(document.documentElement.scrollHeight - track.offsetHeight) }
    })
    ok('nothing is laid out below the track (the project Index is gone)', !g.idxShown && g.oldIndex === 0 && g.over <= 4, JSON.stringify(g))
  })
  /** the ending, on one page: `pg` is the page, `cx` its context (for the touch session) */
  const endingChecks = async (pg, cx, tag, phone) => {
    const at = () => pg.evaluate(() => window.__v3.ui.nav.where()?.id)
    const H = phone ? 844 : 900
    await pg.waitForFunction(() => document.querySelector('#finale.on'), null, { timeout: 30000 })
    await pg.waitForTimeout(1400)
    ok(`${tag}: the last stop shows the ending, not a dialog`, (await at()) === 'epilogue' && !(await pg.evaluate(() => !!document.querySelector('dialog.ovw[open]'))))
    const e = await pg.evaluate(() => {
      const f = document.querySelector('#finale'), sc = f.querySelector('.fin-scroll')
      return {
        text: f.innerText, head: f.querySelector('.ovw-head').getBoundingClientRect().top,
        mails: [...f.querySelectorAll('a[href^="mailto:"]')].map(a => a.getAttribute('href')), copies: f.querySelectorAll('button[data-copy]').length,
        rows: f.querySelectorAll('.ovw-row').length, h: [...f.querySelectorAll('h1,h2,h3,h4')].slice(0, 3).map(x => x.tagName + ':' + x.textContent.trim().slice(0, 12)),
        replay: !!f.querySelector('.ovw-replay'), hint: /lit area/i.test(f.innerText) || !!f.querySelector('.fin-spot'),
        sw: [sc.scrollWidth, sc.clientWidth], wide: [...f.querySelectorAll('*')].filter(x => !x.closest('.ovw-anchors, .ovw-chips') && x.getBoundingClientRect().right > sc.clientWidth + 2).length,
        focus: document.activeElement === sc,
      }
    })
    const low = e.text.toLowerCase()
    ok(`${tag}: contact first (both addresses, mailto, own Copy), then the rest`, e.head < H * 0.5 && e.mails.join() === `mailto:${GMAIL},mailto:${UCHI}` && e.copies === 2 && ['Experience', 'Education', 'Projects', 'LinkedIn', 'GitHub', 'QVR Advisors', 'University of Chicago'].every(s => low.includes(s.toLowerCase())), JSON.stringify([Math.round(e.head), e.mails, e.copies]))
    ok(`${tag}: every project except the QVR role has a row`, e.rows === total - 1, `${e.rows} rows`)
    ok(`${tag}: Replay the tour is there, the "click a lit area" map is not`, e.replay && !e.hint)
    ok(`${tag}: the name is an h2 and the page took focus`, /^H2:Joseph/.test(e.h[0]) && e.focus, JSON.stringify(e.h))
    ok(`${tag}: numerals all trace to src/data`, missing(low).length === 0, missing(low).join(' '))
    ok(`${tag}: no sideways overflow`, e.sw[0] <= e.sw[1] + 1 && e.wide === 0, JSON.stringify([e.sw, e.wide]))
    // each Copy: a real click or tap, then the clipboard
    const press = sel => (phone ? pg.tap(sel) : pg.click(sel))
    await press('#finale button[data-copy="personal"]'); await pg.waitForTimeout(300)
    const g1 = await pg.evaluate(() => navigator.clipboard.readText())
    await pg.waitForTimeout(2200)
    await press('#finale button[data-copy="uchicago"]'); await pg.waitForTimeout(300)
    const g2 = await pg.evaluate(() => navigator.clipboard.readText())
    ok(`${tag}: Copy puts each address on the clipboard (personal, then University of Chicago)`, g1 === GMAIL && g2 === UCHI, `${g1} | ${g2}`)
    await pg.waitForTimeout(2200)
    if (shotSet.includes(phone ? 'ending-390' : 'ending-1440')) await pg.screenshot({ path: out + (phone ? 'v12-ending-390.png' : 'v12-ending-1440.png') })
    // scrolling inside the ending leaves the flight alone
    const s0 = await pg.evaluate(() => ({ p: window.__v3.follower.s, y: Math.round(scrollY) }))
    if (phone) {
      const cdp = await cx.newCDPSession(pg)
      for (let i = 0; i < 4; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 700 }] })
        for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 700 - 62 * k }] }); await sleep(16) }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(250)
      }
    } else {
      await pg.mouse.move(720, 450)
      for (let i = 0; i < 6; i++) { await pg.mouse.wheel(0, 400); await pg.waitForTimeout(60) }
    }
    await pg.waitForTimeout(900)
    const s1 = await pg.evaluate(() => ({ p: window.__v3.follower.s, y: Math.round(scrollY), top: Math.round(document.querySelector('#finale .fin-scroll').scrollTop) }))
    ok(`${tag}: a ${phone ? 'swipe' : 'wheel'} scrolls the page inside the ending, the flight does not move`, s1.top > 300 && Math.abs(s1.p - s0.p) < 1e-6 && s1.y === s0.y && (await at()) === 'epilogue', JSON.stringify([s0, s1]))
    // an anchor works inside the ending
    await pg.evaluate(() => { document.querySelector('#finale .fin-scroll').scrollTop = 0 })
    await pg.waitForTimeout(300)
    await press('#finale [data-anchor="pj"]'); await pg.waitForTimeout(1100)
    const a = await pg.evaluate(() => { const r = document.querySelector('#fin-h-pj').getBoundingClientRect(); return { top: Math.round(document.querySelector('#finale .fin-scroll').scrollTop), h: Math.round(r.top), f: document.activeElement?.id } })
    ok(`${tag}: the Projects anchor scrolls to the projects`, a.top > 100 && a.h > 40 && a.h < 340 && a.f === 'fin-h-pj', JSON.stringify(a))
  }

  await section('the ending (desktop)', async () => {
    // the Index menu's footer link used to scroll to the project Index: it now lands on the ending
    await page.keyboard.press('m'); await sleep(700)
    await page.click('dialog.nm .nm-ix')
    await endingChecks(page, ctx, 'ending 1440', false)
    // O at the ending brings it to its top; it does not stack a second copy
    await page.evaluate(() => { document.querySelector('#finale .fin-scroll').scrollTop = 900 })
    await page.keyboard.press('o'); await page.waitForTimeout(1200)
    const o = await page.evaluate(() => ({ dlg: !!document.querySelector('dialog.ovw[open]'), top: Math.round(document.querySelector('#finale .fin-scroll').scrollTop) }))
    ok('O at the ending brings it to its top instead of opening a second Overview', !o.dlg && o.top === 0, JSON.stringify(o))
    // Replay the tour
    await page.click('#finale .ovw-replay')
    let atStart = false
    for (let i = 0; i < 80 && !atStart; i++) { await sleep(250); atStart = (await where()) === 'clouds' }
    ok('Replay the tour flies back to the first screen', atStart, 'at ' + (await where()))
    ok('the ending is gone at the start', await page.waitForFunction(() => !document.querySelector('#finale.live'), null, { timeout: 8000 }).then(() => true, () => false))
  })

  ok('no console errors on the Overview and ending paths', !logs.some(l => /overview|nav\.ts|hud\.ts|copy\.ts|overlays|finale|epilogue/i.test(l)), logs.filter(l => /overview|nav\.ts|hud\.ts|copy\.ts|overlays|finale|epilogue/i.test(l)).join(' | '))
  await ctx.close()

  // ---------------------------------------------------------------- phone: the #overview deep link, then the ending by touch
  await section('phone', async () => {
    const m = await newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const mp = await m.newPage()
    mp.on('pageerror', e => logs.push('pageerror ' + e.message))
    await mp.goto(`${base}/?gate=0#overview`, { waitUntil: 'load', timeout: 60000 })
    await mp.waitForFunction(() => document.querySelector('dialog.ovw')?.classList.contains('on'), null, { timeout: 60000 })
    await mp.waitForTimeout(1500)
    const mm = await mp.evaluate(() => {
      const d = document.querySelector('dialog.ovw')
      // the chip row and the anchor row scroll sideways on purpose; nothing else may pass the edge
      const wide = [...d.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.ovw-chips, .ovw-anchors')).length
      return { wide, hscroll: d.scrollWidth - d.clientWidth, nb: document.querySelector('.ovw-bari').getBoundingClientRect().right }
    })
    ok('phone: #overview deep link opens it, no sideways overflow', mm.wide === 0 && mm.hscroll <= 0, JSON.stringify(mm))
    if (shotSet.includes('overview-390')) await mp.screenshot({ path: out + 'v12-overview-390.png' })
    // close it, then fly to the last stop (the same jump the Index footer makes) and check the ending by touch
    await mp.keyboard.press('Escape').catch(() => {})
    await mp.evaluate(() => window.__v3.ui.nav.closeOverview(true))
    await mp.waitForTimeout(600)
    await mp.evaluate(() => window.__v3.ui.nav.go('epilogue'))
    await endingChecks(mp, m, 'ending 390', true)
    await m.close()
  })
})
const bad = results.filter(r => !r.pass)
console.log(`\ncheck-overview: ${results.length - bad.length}/${results.length} passed` + (logs.length ? `\nconsole errors seen (all pages): ${logs.length}\n  ` + [...new Set(logs)].slice(0, 6).join('\n  ') : ''))
process.exit(bad.length ? 1 : 0)
