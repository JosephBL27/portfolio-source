// Proofread: every number a visitor can read must trace to the data files.
// Loads the page, opens every project sheet, collects the visible text, extracts numerals,
// and fails if any numeral is absent from src/data/*.json (plus a short allowlist of
// structural numbers like section kickers and clock faces).
// Subtrees marked data-proof="skip" are left out of the case-view text: the QVR lab's live model numbers and the book's
// page counters are structure and simulation, not claims. Everything else a visitor can read must trace to src/data.
// usage: node scripts/proofread.mjs [url] [--motion]   (default url skips the entry gate; --motion runs with animations on, so the
// odometer digits, the flying letters and the wall are all in play while the text is read)
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'

const argv = process.argv.slice(2).filter(a => !a.startsWith('--'))
const motion = process.argv.includes('--motion')
const url = argv[0] || 'http://localhost:5200/?gate=0'
// credits: the real-world imagery list (years, licence numbers) is data, not a claim
const data = ['projects', 'site', 'nervous-system', 'brain-graph', 'media', 'stats', 'credits', 'coursework']
  .map(f => readFileSync(new URL(`../src/data/${f}.json`, import.meta.url), 'utf8')).join('\n')
const dataNums = new Set((data.match(/\d[\d,.]*/g) || []).map(n => n.replace(/[.,]$/, '')))
// structural numbers: kickers 01-04, manifest numbering 01-21, dial hours, clock readouts,
// "No. 01 / 21", lightbox counters, percent counter, the colophon date
const STRUCT = /^(0?\d|1\d|2[0-4]|00|06|12|18|100|404)$/
// v3: Ovid citations (Met. 1.1, 15.871), loader percent, HUD camera/scroll readouts
const ALLOW = new Set(['1.1', '15.871', '099', '00.00', '09.00', '0.000', '0.00'])

const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal'] })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: motion ? 'no-preference' : 'reduce' })).newPage()
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(2500)
const texts = []
texts.push(await page.evaluate(() => document.body.innerText))
// v3: wait for the field, then open every work's case view through the integration hook
await page.waitForFunction(() => window.__v3 && window.__v3.openWork, null, { timeout: 30000 })
await page.waitForTimeout(1500)
texts.push(await page.evaluate(() => document.body.innerText))
const ids = await page.evaluate(async () => (await import('/src/reels/index.ts')).CASE_REELS.map(r => r.projectId))
for (const id of ids) {
  await page.evaluate(id => window.__v3.openWork(id), id)
  // with animations on, wait out the kicker's scramble (random digits on purpose) before reading
  await page.waitForTimeout(motion ? 2200 : 900)
  texts.push(await page.evaluate(() => {
    const d = document.querySelector('dialog.case[open]')
    if (!d) return ''
    const skip = Array.from(d.querySelectorAll('[data-proof="skip"]'))
    const prev = skip.map(e => e.style.display)
    skip.forEach(e => { e.style.display = 'none' })
    const t = d.innerText
    skip.forEach((e, i) => { e.style.display = prev[i] })
    return t
  }))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(motion ? 1800 : 400)
}
await browser.close()

const clock = /\b(SUN|MON|TUE|WED|THU|FRI|SAT) \d\d:\d\d\b/g
const misses = new Map()
for (const t of texts) {
  const clean = t.replace(clock, '').replace(/\b\d\d:\d\d\b/g, '')
  for (const raw of clean.match(/\d[\d,.]*/g) || []) {
    const n = raw.replace(/[.,]$/, '')
    if (dataNums.has(n) || STRUCT.test(n) || ALLOW.has(n) || /^0\d\d$/.test(n)) continue
    misses.set(n, (misses.get(n) || 0) + 1)
  }
}
if (misses.size) {
  console.log(`proofread: ${misses.size} numeral(s) not found in the data files:`)
  for (const [n, c] of misses) console.log(`  ${n}  (x${c})`)
  process.exit(1)
}
console.log(`proofread: OK — every numeral on ${texts.length} surfaces traces to src/data`)
