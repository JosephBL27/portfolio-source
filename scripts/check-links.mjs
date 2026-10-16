// Link audit for the case views. Opens every work, reads every <a href> inside its dialog, adds every link and demo URL in
// src/data/projects.json (including projects with no case view), then fetches each distinct target:
//   local  (/docs, /demos, /media...) : must be 200 with the right content type; a PDF must start with %PDF; an HTML page must not be the app shell
//   external                          : HEAD, then GET if HEAD is refused; redirects followed; a browser-like User-Agent
// It also checks the markup: every external link must open in a new tab with rel="noopener".
// usage: node scripts/check-links.mjs [baseUrl] [out.md]      (writes docs/review/links-v9.md by default; LinkedIn answers 999 to scripts)
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const base = (process.argv[2] || 'http://localhost:5200').replace(/\/$/, '')
const outPath = process.argv[3] || `${root}docs/review/links-v9.md`
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const projects = JSON.parse(readFileSync(`${root}src/data/projects.json`, 'utf8'))
const site = JSON.parse(readFileSync(`${root}src/data/site.json`, 'utf8'))
const hrefOf = u => (/^(https?:|mailto:)/.test(u) ? u : '/' + (u.endsWith('/') ? u + 'index.html' : u).replace(/^\//, ''))

// ---- 1. what a visitor can click: anchors read from the live case views
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal'] })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await page.goto(`${base}/?gate=0`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__v3 && window.__v3.openWork, null, { timeout: 60000 })
await page.waitForTimeout(1500)
// the dev server full-reloads the page whenever any source file changes: wait for the app again and retry
const ready = () => page.waitForFunction(() => window.__v3 && window.__v3.openWork, null, { timeout: 60000 }).then(() => page.waitForTimeout(1200))
const retry = async fn => { for (let k = 0; k < 6; k++) { try { return await fn() } catch (e) { if (!/context was destroyed|navigation|Target closed/.test(String(e))) throw e; await ready() } } throw new Error('page kept reloading') }
const ids = await retry(() => page.evaluate(async () => (await import('/src/reels/index.ts')).CASE_REELS.map(r => r.projectId)))
const seen = new Map()      // href -> { where: Set, markup: Set }
const note = (href, where, markup) => {
  if (!seen.has(href)) seen.set(href, { where: new Set(), markup: new Set() })
  const e = seen.get(href); e.where.add(where); if (markup) e.markup.add(markup)
}
for (const id of ids) {
  const as = await retry(async () => {
    await page.evaluate(i => window.__v3.openWork(i), id)
    await page.waitForTimeout(1100)
    if (!(await page.evaluate(() => !!document.querySelector('dialog.case[open] .cv-name')))) throw new Error('navigation: case did not open (page reloaded?)')
    return page.evaluate(() => Array.from(document.querySelectorAll('dialog.case[open] a[href]')).map(a => ({ href: a.getAttribute('href'), abs: a.href, target: a.target, rel: a.rel, text: (a.textContent || '').trim().slice(0, 60) })))
  })
  for (const a of as) {
    const ext = /^https?:/.test(a.href) && new URL(a.abs).origin !== base
    const ok = !ext || (a.target === '_blank' && /noopener/.test(a.rel))
    note(a.abs, `case view: ${id}`, ok ? '' : `MISSING target=_blank rel=noopener (target="${a.target}" rel="${a.rel}")`)
  }
  await retry(async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog.case[open]'), null, { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(200) })
}
// page-level anchors (HUD, footer, index)
const pageAnchors = await retry(() => page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).filter(a => !a.closest('dialog')).map(a => a.href)))
for (const h of pageAnchors) if (!/#[^/]*$/.test(h) || new URL(h).pathname !== '/') note(h, 'page')
await browser.close()

// ---- 2. what the data says should be clickable (covers projects with no case view)
for (const p of projects) {
  for (const l of p.links || []) note(hrefOf(l.url).startsWith('/') ? base + hrefOf(l.url) : hrefOf(l.url), `data: ${p.id} link "${l.label}"`)
  if (p.demo) note(hrefOf(p.demo.url).startsWith('/') ? base + hrefOf(p.demo.url) : hrefOf(p.demo.url), `data: ${p.id} demo "${p.demo.label}"`)
}
if (site.bio?.linkedin) note(site.bio.linkedin, 'data: site.json bio.linkedin')
if (site.bio?.email) note(`mailto:${site.bio.email}`, 'data: site.json bio.email')

// ---- 3. fetch
const homeTitle = (await (await fetch(`${base}/?gate=0`)).text()).match(/<title>([^<]*)/)?.[1] ?? ''
async function check(href) {
  if (href.startsWith('mailto:')) return { status: 'n/a', verdict: 'OK (mailto, not fetched)' }
  const u = new URL(href)
  const local = u.origin === base
  const t = AbortSignal.timeout(20000)
  try {
    if (local) {
      const r = await fetch(href, { signal: t })
      const ct = r.headers.get('content-type') || ''
      const body = Buffer.from(await r.arrayBuffer())
      let verdict = 'OK'
      if (r.status !== 200) verdict = `FAIL status ${r.status}`
      else if (/\.pdf$/i.test(u.pathname)) verdict = ct.includes('application/pdf') && body.subarray(0, 4).toString() === '%PDF' ? `OK (PDF, ${(body.length / 1e6).toFixed(1)} MB)` : `FAIL not a PDF (${ct})`
      else if (/\.html?$/i.test(u.pathname) || ct.includes('text/html')) {
        const title = body.toString().match(/<title>([^<]*)/)?.[1] ?? ''
        verdict = title && title === homeTitle && !/^\/(index|v2)\.html$/.test(u.pathname) && u.pathname !== '/' ? 'FAIL serves the app shell, not the file' : `OK (HTML, title "${title}")`
      }
      return { status: r.status, ct, verdict }
    }
    const once = async () => {
      let r = await fetch(href, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': UA } })
      if (r.status >= 400) r = await fetch(href, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': UA } })
      return r
    }
    let r
    for (let k = 0; ; k++) { try { r = await once(); break } catch (e) { if (k >= 2) throw e; await new Promise(res => setTimeout(res, 1500)) } }
    const final = r.url !== href ? ` -> ${r.url}` : ''
    if (/linkedin\.com/.test(href) && r.status === 999) return { status: 999, verdict: 'Cannot verify by script: LinkedIn answers 999 to every non-browser client. Click it once.' }
    return { status: r.status, verdict: r.status === 200 ? `OK${final}` : `FAIL status ${r.status}${final}` }
  } catch (e) { return { status: 'err', verdict: `FAIL ${e.cause?.code || e.message}` } }
}
const rows = []
for (const [href, info] of seen) rows.push({ href, ...info, ...(await check(href)) })
rows.sort((a, b) => a.href.localeCompare(b.href))

// ---- 4. write
const bad = rows.filter(r => r.verdict.startsWith('FAIL') || r.markup.size)
const date = new Date().toISOString().slice(0, 10)
const md = [
  '# Link audit v9',
  '',
  `Run ${date} with \`node scripts/check-links.mjs\` against ${base}. Sources: every \`<a href>\` read from the open case view of each of the ${ids.length} reels (${ids.join(', ')}), the page-level anchors, every \`links[]\` and \`demo\` entry in \`src/data/projects.json\` (including projects with no case view), and the email and LinkedIn in \`src/data/site.json\`. ${rows.length} distinct targets.`,
  '',
  'Local targets are fetched and their content checked (a PDF must start with `%PDF`; an HTML file must not be the app shell, which the dev server returns with a 200 for any missing path). External targets use HEAD then GET, redirects followed, a browser User-Agent. External links must open in a new tab with `rel="noopener"`.',
  '',
  `## Result: ${bad.length ? `${bad.length} need attention` : 'every link resolves'}`,
  '',
  '| Target | Where it appears | Status | Verdict |',
  '|---|---|---|---|',
  ...rows.map(r => `| ${r.href.replace(base, '') || '/'} | ${[...r.where].slice(0, 4).join('; ')}${r.where.size > 4 ? `; +${r.where.size - 4} more` : ''} | ${r.status} | ${r.verdict}${r.markup.size ? ` **${[...r.markup].join('; ')}**` : ''} |`),
  '',
  '## Notes',
  '',
  '- **LinkedIn** answers 999 to every script, so it cannot be verified here and is not changed. The URL is the one in `src/data/site.json`; click it once.',
  '- **Demo links are now visible.** The `demo` field in `projects.json` had no surface; each case view lists it first in Links (kind `demo`) unless the same URL is already listed (the papers and decks, second-brain and carta).',
  '- **Bare directory URLs** (`demos/zeta/`) fall through to the app shell under the Vite dev server (200, wrong page). The case view rewrites a local directory link to `<dir>/index.html`, so it opens the real file in dev and in a static build.',
  '- **Demo files.** `zeta`, `hand-compass`, `odyssey` and `liaozhai` (18 MB together) existed only in `~/PORTFOLIO/public/demos/`; they were copied to `public/demos/` so the links resolve. The Odyssey page loads Google Fonts from the network.',
  '- **SELFORGE support page** is titled "Pushup Alarm" (it works; confirm the name is intended).',
  '- **Thrift** has no links by design: the manuscript data are unverified, there is no public repository or page.',
  '- **QVR**, recruiting-os, secretary, axe-os, table-model and notebooklm-study-loop have no links to check.',
  '- External links open in a new tab with `rel="noopener"`; the audit flags any that do not.',
  '',
].join('\n')
writeFileSync(outPath, md)
console.log(md.split('\n').slice(0, 12).join('\n'))
console.log(`\n${rows.length} targets, ${bad.length} flagged. Wrote ${outPath}`)
for (const r of bad) console.log('FLAG', r.href, r.verdict, [...r.markup].join(' '))
