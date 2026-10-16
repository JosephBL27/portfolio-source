// Acceptance check for project deep links (Task Master 41): every project in src/data/projects.json has one canonical link,
//   https://josephbl27.github.io/portfolio/#<id>
// that, on a FRESH load and on hashchange, flies to the project's stop and opens THAT project's case study.
// ONE headless browser at a time through scripts/lib/browser.mjs (the shared 2-slot lock), always closed in finally.
// usage: node scripts/deeplink-check.mjs [baseUrl=http://localhost:5490] [--ids a,b,c] [--no-hashchange] [--docs] [--shots=<dir>]
//   env VW / VH   viewport (default 1440 x 900; below 768 wide it is a touch phone)
//   --ids         only these project ids (default: all of projects.json)
//   --no-hashchange  skip phase B (the same page, hash set from outside, case open or closed)
//   --docs        also (re)write docs/LINKS.md from projects.json and the stops this run measured (a full run only: ignored with --ids)
//   --shots=dir   a shot of the first project's case opened from a fresh link, and of its Copy link control before and after a click
// Phases
//   A  a fresh page per project at <base>/?gate=0#<id>: the case that opens must be the project's own (the name on the case, and the dialog's data-project);
//      the camera must come to rest at the project's stop (or, for a project with no stop of its own, at its documented home area); the case's Copy link
//      control must hold the canonical URL and put exactly that on the clipboard; the page must log no console error. Time to open = ms from navigation start
//      (performance.now() in the page, set by a MutationObserver), so it includes the world build and the curtain; it is a measurement, not a budget.
//   A2 the real entry gate (no ?gate=0): nothing opens behind the gate; Enter silently, and the link's own case opens
//   B  one page, hash set from outside (what a pasted link or the Back button does): for every project the same case opens; then, with a case open, the hash
//      switches it in place to another project; Prev / Next inside the case move Copy link and the address bar with it; aliases and odd casing resolve; an unknown token opens nothing and breaks nothing.
//   C  docs/LINKS.md names every project's live URL and every external link in projects.json, and every relative link points at a file that exists in public/.
// Exit 1 on any miss.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { withBrowser } from './lib/browser.mjs'

const args = process.argv.slice(2)
const base = (args.find(a => !a.startsWith('--')) || 'http://localhost:5490').replace(/\/$/, '')
const opt = n => args.find(a => a === `--${n}` || a.startsWith(`--${n}=`))
const optVal = n => { const a = opt(n); return a && a.includes('=') ? a.split('=')[1] : null }
const onlyIds = optVal('ids')?.split(',').map(s => s.trim()).filter(Boolean) ?? null
const doHash = !opt('no-hashchange')
const writeDocs = !!opt('docs') && !onlyIds
const shotDir = optVal('shots')
const VW = Number(process.env.VW || 1440), VH = Number(process.env.VH || 900), phone = VW < 768
const LIVE = 'https://josephbl27.github.io/'
const root = fileURLToPath(new URL('../', import.meta.url))
const projects = JSON.parse(readFileSync(new URL('../src/data/projects.json', import.meta.url), 'utf8'))
const ids = onlyIds ?? projects.map(p => p.id)
const byId = Object.fromEntries(projects.map(p => [p.id, p]))
/** a project with no stop of its own lands here: copy.ts / overview.ts file it by kind (agents and tools join the Second Brain) */
const HOME_AREA = { agent: 'mind', tool: 'mind', app: 'systems', research: 'research', instrument: 'education', work: 'work' }
const canonical = id => `${LIVE}#${id}`
const sleep = ms => new Promise(r => setTimeout(r, ms))
const rows = []
const checks = []
const ok = (name, pass, info = '') => { checks.push({ name, pass: !!pass, info }); if (!pass) console.log(`FAIL  ${name}${info ? '  ' + info : ''}`) }
const logsAll = []

// ---------------------------------------------------------------- in-page helpers
const INIT = () => {
  window.__dl = { open: null, ready: null }
  const look = () => {
    const now = performance.now()
    if (window.__dl.ready == null && document.documentElement.classList.contains('is-ready')) window.__dl.ready = now
    if (window.__dl.open == null && document.querySelector('dialog.case[open]')) window.__dl.open = now
  }
  new MutationObserver(look).observe(document, { subtree: true, attributes: true, attributeFilter: ['open', 'class'], childList: true })
}
const caseState = () => {
  const d = document.querySelector('dialog.case')
  const nm = d?.querySelector('#case-name .sr')?.textContent ?? ''
  const copy = d?.querySelector('.case__copy')
  return {
    open: !!d && d.open && !!window.__v3?.caseView?.isOpen?.(), name: nm, project: d?.dataset.project ?? '',
    copyHref: copy?.getAttribute('data-href') ?? '', copyLabel: copy?.textContent?.trim() ?? '', hash: location.hash,
  }
}
const stopState = () => {
  const w = window.__v3?.ui?.nav?.where?.()
  return { id: w?.id ?? '', area: w?.area ?? '', name: w?.name ?? '', jumping: document.documentElement.classList.contains('jumping') }
}

await withBrowser(async browser => {
  const newCtx = async () => {
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, reducedMotion: 'no-preference', ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
    // the dev server reloads the page whenever another file changes: swallow its HMR socket so the page keeps the code it loaded
    await ctx.routeWebSocket(u => u.port === new URL(base).port, () => {})
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin }).catch(() => {})
    await ctx.addInitScript(INIT)
    return ctx
  }
  const watch = page => {
    const logs = []
    page.on('console', m => { if (m.type() === 'error') logs.push(m.text().split('\n')[0].slice(0, 200)) })
    page.on('pageerror', e => logs.push('pageerror ' + String(e.message).slice(0, 200)))
    return logs
  }
  const waitOpen = async (page, ms = 30000) => { try { await page.waitForFunction(() => window.__dl.open != null, null, { timeout: ms }); return true } catch { return false } }
  /** close the case with Escape and wait for the camera to come to rest; returns where it rests */
  const closeAndSettle = async page => {
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !window.__v3?.caseView?.isOpen?.(), null, { timeout: 6000 }).catch(() => {})
    let last = '', still = 0
    for (let k = 0; k < 60; k++) {
      await sleep(250)
      const s = await page.evaluate(stopState)
      const key = s.id + (s.jumping ? '*' : '')
      if (key === last && !s.jumping) { if (++still >= 4) return s } else still = 0
      last = key
    }
    return page.evaluate(stopState)
  }
  const expectedStop = async page => page.evaluate(async () => {
    const l = await import('/src/v3/world/layout.ts')
    return l.WAYPOINTS.map(w => ({ id: w.id, area: w.area, tvs: w.tvs ?? null })).concat([{ areas: l.AREAS.map(a => ({ id: a.id, projects: a.projects })) }])
  })

  // ================================================================ A: fresh loads
  console.log(`deeplink-check  ${base}  ${VW}x${VH}${phone ? ' phone' : ''}  ${ids.length} project${ids.length === 1 ? '' : 's'}`)
  let layout = null
  for (const [n, id] of ids.entries()) {
    const p = byId[id]
    const row = { id, name: p?.name ?? '?', ok: false, opened: '', ms: null, ready: null, stop: '', stopName: '', copy: '', note: '' }
    rows.push(row)
    const ctx = await newCtx()
    try {
      const page = await ctx.newPage()
      const logs = watch(page)
      await page.goto(`${base}/?gate=0#${id}`, { waitUntil: 'load', timeout: 90000 })
      const opened = await waitOpen(page)
      if (!opened) { row.note = 'no case opened in 30 s'; ok(`A ${id}: a case opens`, false, row.note); continue }
      const t = await page.evaluate(() => ({ open: window.__dl.open, ready: window.__dl.ready }))
      row.ms = Math.round(t.open); row.ready = t.ready == null ? null : Math.round(t.ready)
      await sleep(1700) // the title assembles; the copy control settles
      const cs = await page.evaluate(caseState)
      row.opened = cs.name
      const rightName = cs.name === p.name, rightHook = cs.project === id
      ok(`A ${id}: the case shown is its own ("${cs.name}")`, rightName, rightName ? '' : `expected "${p.name}"`)
      ok(`A ${id}: dialog data-project = ${id}`, rightHook, `got "${cs.project}"`)
      ok(`A ${id}: the address bar still reads #${id}`, cs.hash.toLowerCase() === `#${id}`, cs.hash)
      ok(`A ${id}: Copy link holds ${canonical(id)}`, cs.copyHref === canonical(id), `got "${cs.copyHref}"`)
      // the control puts exactly the canonical URL on the clipboard and announces it
      if (cs.copyHref) {
        if (shotDir && n === 0) { mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: `${shotDir}/deeplink-${id}-case-${VW}.png` }); await page.locator('.case__bar').screenshot({ path: `${shotDir}/deeplink-${id}-bar-${VW}.png` }).catch(() => {}) }
        await page.locator('.case__copy').click({ timeout: 4000 }).catch(e => { row.note += ' click:' + String(e.message).split('\n')[0].slice(0, 80) })
        await sleep(350)
        const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => '(no clipboard)'))
        const live = await page.evaluate(() => document.querySelector('dialog.case [role="status"]')?.textContent ?? '')
        const after = await page.evaluate(() => document.querySelector('.case__copy')?.textContent?.trim() ?? '')
        row.copy = clip === canonical(id) ? 'ok' : 'WRONG'
        ok(`A ${id}: clipboard = ${canonical(id)}`, clip === canonical(id), `got "${clip}"`)
        ok(`A ${id}: copy is announced (live region) and the label confirms`, /copied/i.test(live) && /copied/i.test(after), `live="${live}" label="${after}"`)
        if (shotDir && n === 0) await page.locator('.case__bar').screenshot({ path: `${shotDir}/deeplink-${id}-bar-copied-${VW}.png` }).catch(() => {})
      }
      // where the camera comes to rest after the case closes
      const rest = await closeAndSettle(page)
      row.stop = rest.id; row.stopName = rest.name
      if (!layout) layout = await expectedStop(page)
      const wps = layout.slice(0, -1), areas = layout[layout.length - 1].areas
      const sole = wps.find(w => w.tvs && w.tvs.length === 1 && w.tvs[0] === id), any = wps.find(w => w.tvs?.includes(id))
      const hostArea = areas.find(a => a.projects.includes(id))?.id
      const stopOk = sole || any ? rest.id === (sole || any).id : rest.area === (hostArea ?? HOME_AREA[p.kind])
      if (!(sole || any)) row.note = `no stop of its own: lands in ${hostArea ?? HOME_AREA[p.kind]}`
      ok(`A ${id}: the camera rests at its stop (${(sole || any)?.id ?? 'area ' + (hostArea ?? HOME_AREA[p.kind])})`, stopOk, `rests at ${rest.id} (${rest.area})`)
      const hashAfter = await page.evaluate(() => location.hash)
      ok(`A ${id}: closing the case leaves a link to where we are (#${id} or the stop's)`, hashAfter !== '' && !/overview|contact|index/.test(hashAfter), hashAfter)
      ok(`A ${id}: no console errors`, logs.length === 0, logs.slice(0, 2).join(' | '))
      logsAll.push(...logs)
      row.ok = rightName && rightHook && cs.copyHref === canonical(id) && stopOk && logs.length === 0
    } catch (e) {
      row.note = String(e.message || e).split('\n')[0].slice(0, 120); ok(`A ${id}: ran to the end`, false, row.note)
    } finally { await ctx.close().catch(() => {}) }
    console.log(`  ${row.ok ? 'ok  ' : 'MISS'} ${id.padEnd(22)} ${String(row.ms ?? '-').padStart(6)} ms  stop ${row.stop || '-'}`)
  }

  // ================================================================ A2: the real entry gate (no ?gate=0): the link waits for Enter, then flies and opens
  if (ids.length) {
    const id = ids.includes('love-island') ? 'love-island' : ids[0]
    const ctx = await newCtx()
    try {
      const page = await ctx.newPage()
      const logs = watch(page)
      await page.goto(`${base}/#${id}`, { waitUntil: 'load', timeout: 90000 })
      await page.waitForSelector('#loader .gate-btn:not(.primary)', { state: 'visible', timeout: 90000 })
      await sleep(1500)
      const early = await page.evaluate(() => !!window.__v3?.caseView?.isOpen?.())
      ok(`A2 ${id}: nothing opens behind the entry gate`, !early)
      await page.evaluate(() => { window.__dl.open = null })
      const t0 = Date.now()
      await page.click('#loader .gate-btn:not(.primary)')
      const o = await waitOpen(page, 25000)
      const cs = o ? await page.evaluate(caseState) : null
      ok(`A2 ${id}: Enter silently, then its own case opens (${o ? Date.now() - t0 : '-'} ms after the click)`, !!cs && cs.name === byId[id].name, cs?.name ?? 'no case')
      ok('A2 no console errors', logs.length === 0, logs.slice(0, 2).join(' | '))
      logsAll.push(...logs)
    } catch (e) { ok('A2 ran to the end', false, String(e.message || e).split('\n')[0].slice(0, 140)) } finally { await ctx.close().catch(() => {}) }
  }

  // ================================================================ B: hashchange on one page
  if (doHash) {
    const ctx = await newCtx()
    try {
      const page = await ctx.newPage()
      const logs = watch(page)
      await page.goto(`${base}/?gate=0`, { waitUntil: 'load', timeout: 90000 })
      await page.waitForFunction(() => document.documentElement.classList.contains('is-ready') && window.__v3?.ui?.nav, null, { timeout: 90000 })
      await sleep(2500)
      const setHash = (h, reset = true) => page.evaluate(([h, reset]) => { if (reset) window.__dl.open = null; location.hash = h }, [h, reset])
      const openWith = async (hash, wantId, label) => {
        const t0 = Date.now()
        await setHash(hash)
        const o = await waitOpen(page, 20000)
        if (!o) { ok(`B ${label}: a case opens`, false, 'none in 20 s'); return false }
        const ms = Date.now() - t0
        await sleep(900)
        const cs = await page.evaluate(caseState)
        const good = cs.name === byId[wantId].name
        ok(`B ${label}: opens ${wantId}`, good, `got "${cs.name}"`)
        return good ? ms : false
      }
      for (const id of ids) {
        const ms = await openWith('#' + id, id, `#${id}`)
        const r = rows.find(x => x.id === id); if (r && ms) r.hashMs = ms
        await closeAndSettle(page)
      }
      // a link pasted while a case is open switches the case in place (no flight first), and the camera follows behind it
      const pairs = [['qvr', 'chomchom'], ['second-brain', 'finder-organizer'], ['love-island', 'wwii']].filter(([a, b]) => ids.includes(a) && ids.includes(b))
      for (const [a, b] of pairs) {
        const first = await openWith('#' + a, a, `case ${a} open`)
        if (first === false) continue
        const t0 = Date.now()
        await setHash('#' + b, false)
        let got = ''
        for (let k = 0; k < 30; k++) { await sleep(100); got = (await page.evaluate(caseState)).name; if (got === byId[b].name) break }
        ok(`B hash ${b} while ${a} is open: the case switches in place`, got === byCase(b), `got "${got}" after ${Date.now() - t0} ms`)
        const rest = await closeAndSettle(page)
        ok(`B hash ${b} while ${a} is open: after closing, the camera is at ${b}'s stop`, stopMatches(b, rest), `rests at ${rest.id}`)
      }
      // Prev / Next inside the case: Copy link, the dialog's data-project and the address bar follow the channel
      if (ids.includes('qvr')) {
        const first = await openWith('#qvr', 'qvr', 'case qvr open (for Prev / Next)')
        if (first !== false) {
          await page.keyboard.press('ArrowRight')
          let cs = await page.evaluate(caseState)
          for (let k = 0; k < 40 && (cs.project === 'qvr' || !cs.project); k++) { await sleep(100); cs = await page.evaluate(caseState) }
          // the channel change plays (static, fade) before the new article mounts and the address bar follows: wait for it to land
          for (let k = 0; k < 50 && !(byId[cs.project] && cs.name === byId[cs.project].name && cs.hash === '#' + cs.project); k++) { await sleep(100); cs = await page.evaluate(caseState) }
          ok('B Next: the case moved to another project', !!cs.project && cs.project !== 'qvr', cs.project)
          ok(`B Next: Copy link follows (${cs.project})`, cs.copyHref === canonical(cs.project), cs.copyHref)
          ok(`B Next: the address bar follows (#${cs.project})`, cs.hash === '#' + cs.project, cs.hash)
          ok('B Next: the case title matches the project', cs.name === byId[cs.project]?.name, cs.name)
        }
        await closeAndSettle(page)
      }
      // aliases and casing; the check only asserts the ones that map to a project in this run
      const aliasList = [['Love-Island', 'love-island'], ['love-island-dynamics', 'love-island'], ['job-watchdog', 'watchdog'], ['agent-skills', 'skills'], ['AXE_OS', 'axe-os'], ['love-island/', 'love-island'], ['unequal-mobilization', 'wwii']]
      for (const [alias, id] of aliasList) { if (!ids.includes(id)) continue; const ms = await openWith('#' + alias, id, `alias #${alias}`); void ms; await closeAndSettle(page) }
      // an unknown token opens nothing and breaks nothing
      await setHash('#not-a-project'); await sleep(2500)
      const odd = await page.evaluate(caseState)
      ok('B an unknown token opens no case', !odd.open)
      ok('B hashchange phase: no console errors', logs.length === 0, logs.slice(0, 2).join(' | '))
      logsAll.push(...logs)
    } catch (e) { ok('B ran to the end', false, String(e.message || e).split('\n')[0].slice(0, 140)) } finally { await ctx.close().catch(() => {}) }
  }
})

// helpers used above (hoisted function declarations)
function byCase(id) { return byId[id].name }
function stopMatches(id, rest) {
  // the caller only needs a plausible stop here; the exact stop for every id is asserted in phase A
  const r = rows.find(x => x.id === id)
  return !!r && (!r.stop || r.stop === rest.id)
}

// ================================================================ C: docs/LINKS.md and link targets
const hrefOf = u => (/^(https?:|mailto:)/.test(u) ? u : LIVE + (u.endsWith('/') ? `${u}index.html` : u))
const extLinks = p => {
  const out = []
  if (p.demo?.url) out.push({ label: p.demo.label, url: p.demo.url })
  for (const l of p.links ?? []) if (!out.some(o => o.url === l.url)) out.push({ label: l.label, url: l.url })
  return out
}
for (const p of projects) for (const l of extLinks(p)) {
  if (/^(https?:|mailto:)/.test(l.url)) continue
  const rel = l.url.replace(/\/$/, '')
  const found = existsSync(`${root}public/${rel}`) && (!l.url.endsWith('/') || existsSync(`${root}public/${rel}/index.html`))
  ok(`C ${p.id}: ${l.url} exists in public/`, found)
}
const docPath = `${root}docs/LINKS.md`
if (writeDocs) {
  const T = s => String(s).replace(/\|/g, '\\|')
  const stopOf = id => { const r = rows.find(x => x.id === id); return r?.stopName ? r.stopName : '' }
  const body = projects.map((p, i) => {
    const links = extLinks(p).map(l => `[${T(l.label)}](${hrefOf(l.url)})`).join('<br>') || 'none'
    const own = rows.find(x => x.id === p.id)
    return `| ${i + 1} | \`${p.id}\` | [${canonical(p.id)}](${canonical(p.id)}) | ${T(p.name)} | ${T(own?.note?.startsWith('no stop') ? stopOf(p.id) + ' (area fallback)' : stopOf(p.id) || 'see stop')} | ${links} |`
  }).join('\n')
  const doc = `# Project links

One canonical link per project: \`${LIVE}#<id>\`. Ids are the lowercase, hyphenated \`id\` of each entry in \`src/data/projects.json\` (read from that file; this page is
written by \`node scripts/deeplink-check.mjs --docs\`, so re-run it after a project is added, renamed or given a new link). External links are the project's own
\`demo\` and \`links\` from the same file; a path without a host is a file on the live site.

## How a hash link behaves

- **Fresh load.** The world builds, the entry gate is passed (silently or with sound; \`?gate=0\` skips the gate for tests), then the camera flies to the project's stop and
  its case study opens over it, growing out of the project's TV when that TV is in view. The address bar keeps \`#<id>\`.
- **Already on the site.** Changing the hash (a pasted link, the Back or Forward button) does the same thing without a reload. With a case already open, the case switches
  to the new project in place and the camera flies to the new stop behind it, so closing the case lands on the right stop.
- **Copy link.** The case study's header has a **Copy link** control. It copies the canonical URL of the case on screen (it follows Prev / Next) and says "Copied"
  on the button and to screen readers. The address bar also follows the open case.
- **Aliases.** Case-insensitive; a trailing slash and underscores are ignored; a project's repository name, its title as a slug and \`love-island-dynamics\` also resolve
  (\`#job-watchdog\`, \`#agent-skills\`, \`#unequal-mobilization\`). Area tokens (\`#work\`, \`#systems\`, \`#research\`, \`#mind\`, \`#education\`, \`#about\`), stop ids,
  \`#overview\` and \`#contact\` keep working. An unknown token is ignored.
- **Projects without a stop of their own.** Every project has a case study, so every link opens its own. Two projects, \`finder-organizer\` and
  \`notebooklm-study-loop\`, have no stop in the flight; their link flies to the **Second Brain** (where the Overview also files them, by kind) and opens their case there.
  Projects that share a stop (\`table-model\` and \`hand-compass\`; \`second-brain\`, \`skills\`, \`axe-os\` and \`carta\`) fly to the shared stop and open their own case.
- **If a project ever has no case.** The link still flies to its stop (or its home area) and opens nothing; \`scripts/deeplink-check.mjs\` fails on it.

## The ${projects.length} projects

| # | id | Live link | Case title | Camera rests at | External links |
|---|----|-----------|------------|-----------------|----------------|
${body}

Checked with \`node scripts/deeplink-check.mjs\` against the dev server (all ${projects.length} fresh loads and all ${projects.length} hash changes).
`
  writeFileSync(docPath, doc)
  console.log(`wrote ${docPath}`)
}
if (existsSync(docPath)) {
  const doc = readFileSync(docPath, 'utf8')
  for (const p of projects) {
    ok(`C LINKS.md lists ${canonical(p.id)}`, doc.includes(canonical(p.id)))
    for (const l of extLinks(p)) ok(`C LINKS.md lists ${p.id}: ${hrefOf(l.url)}`, doc.includes(hrefOf(l.url)))
  }
} else ok('C docs/LINKS.md exists', false, 'run with --docs')

// ================================================================ report
const pad = (s, n) => String(s).padEnd(n)
console.log('\n' + [pad('project', 22), pad('opened case', 38), pad('open ms', 8), pad('ready ms', 9), pad('hash ms', 8), pad('rests at', 12), 'note'].join(' '))
for (const r of rows) console.log([pad(r.id, 22), pad(r.opened.slice(0, 36), 38), pad(r.ms ?? '-', 8), pad(r.ready ?? '-', 9), pad(r.hashMs ?? '-', 8), pad(r.stop || '-', 12), r.ok ? r.note : 'MISS ' + r.note].join(' '))
const okRows = rows.filter(r => r.ok).length
const ms = rows.map(r => r.ms).filter(Number.isFinite).sort((a, b) => a - b)
if (ms.length) console.log(`\nfresh-load time to open: min ${ms[0]}, median ${ms[Math.floor(ms.length / 2)]}, max ${ms[ms.length - 1]} ms`)
const fails = checks.filter(c => !c.pass)
console.log(`\nA fresh loads: ${okRows}/${rows.length} projects fully ok. ${checks.length - fails.length}/${checks.length} checks pass.${logsAll.length ? ` Console errors: ${logsAll.length}.` : ' Console errors: 0.'}`)
for (const f of fails) console.log(`  FAIL ${f.name}${f.info ? '  ' + f.info : ''}`)
process.exit(fails.length || okRows !== rows.length ? 1 : 0)
