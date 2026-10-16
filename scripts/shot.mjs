// Headless screenshot helper with real GPU WebGL.
// usage: node scripts/shot.mjs <url> <out.png> [--w 1440] [--h 900] [--dpr 1] [--wait 2500]
//        [--scroll 0] [--mobile] [--reduced] [--dark] [--eval "js"] [--full] [--console]
//        [--move x,y] (pointer position before capture)
import { chromium } from 'playwright-core'
const args = process.argv.slice(2)
const url = args[0], out = args[1]
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const flag = (k) => args.includes('--' + k)
if (!url || !out) { console.error('usage: shot.mjs <url> <out.png> [...]'); process.exit(2) }
const mobile = flag('mobile')
const w = +opt('w', mobile ? 390 : 1440), h = +opt('h', mobile ? 844 : 900)
const browser = await chromium.launch({
  channel: 'chromium', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'],
})
const ctx = await browser.newContext({
  viewport: { width: w, height: h }, deviceScaleFactor: +opt('dpr', mobile ? 2 : 1),
  isMobile: mobile, hasTouch: mobile,
  reducedMotion: flag('reduced') ? 'reduce' : 'no-preference',
  colorScheme: flag('dark') ? 'dark' : 'light',
})
const page = await ctx.newPage()
const logs = []
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
await page.goto(url, { waitUntil: 'load', timeout: 60000 })
const mv = opt('move', null)
if (mv) { const [x, y] = mv.split(',').map(Number); await page.mouse.move(x, y, { steps: 8 }) }
const sc = +opt('scroll', 0)
if (sc) { await page.evaluate(y => window.scrollTo(0, y), sc) }
const ev = opt('eval', null)
if (ev) { const r = await page.evaluate(ev); if (r !== undefined) logs.push(`[eval] ${JSON.stringify(r)}`) }
await page.waitForTimeout(+opt('wait', 2500))
await page.screenshot({ path: out, fullPage: flag('full') })
const gl = await page.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); if (!g) return 'no-webgl2'; const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'webgl2' })
console.log(`shot ${out} ${w}x${h} gl=${gl}`)
if (flag('console') || logs.some(l => l.includes('error'))) console.log(logs.slice(-40).join('\n'))
await browser.close()
