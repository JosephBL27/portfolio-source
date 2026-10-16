// Colour-fidelity harness (w20). Canvas-only frames: the DOM overlay is hidden, the camera is pinned at a waypoint, 2.5 s settle, then the frame is analysed.
//   extra (additive): brightSat = mean HSV S over V > 0.5 (the forms themselves, not the lit background), brightFrac, chroma = mean (max-min) over ALL pixels, hueMax = share of the biggest hue bin
//   meanSat = mean HSV saturation over pixels with V > 0.15       hueHist = 12 x 30-degree bins (bin 0 = 0-30 deg), saturation-weighted, normalised to sum 1
//   black   = 5th-percentile luma (Rec.709 on the sRGB bytes, 0..1) of the TOP 20% of rows (the sky)       meanLuma = mean luma of the whole frame
// library:  import { measure } from './scripts/colour-metrics.mjs'
//           const r = await measure('http://localhost:5922/?grade=0', ['secretary','name'], { label: 'head-g0', saveDir: '/private/tmp/claude-501/w20/frames' })
// cli:      node scripts/colour-metrics.mjs <url> <out.json> [stop ...]
// Uses the shared 2-slot browser lock (scripts/lib/browser.mjs); never launches a browser itself. ?gate=0 is appended when absent.
import { withBrowser } from './lib/browser.mjs'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export const ALL_STOPS = ['secretary', 'watchdog', 'alarm', 'drill', 'table', 'market', 'record', 'pair', 'surface', 'cloudflare', 'appfolio', 'recruiting', 'chomchom', 'mind', 'school', 'mathecon', 'instrument', 'hall', 'name', 'world']
const HIDE_CSS = 'body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important} html,body{background:#050506 !important}'

/** runs in the page: PNG (base64) -> metrics */
export const analyse = (b64) => (async () => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height).data
  const W = c.width, H = c.height, topRows = Math.floor(H * 0.2)
  let n = 0, sumL = 0, litN = 0, litS = 0, topN = 0, brN = 0, brS = 0, chromaSum = 0, brChroma = 0
  const hue = new Float64Array(12), top = new Uint32Array(256), all = new Uint32Array(256)
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = (y * W + xx) * 4
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, l = 0.2126 * r + 0.7152 * g + 0.0722 * b, lb = Math.round(l * 255)
    n++; sumL += l; all[lb]++
    if (y < topRows) { top[lb]++; topN++ }
    const mx = Math.max(r, g, b)
    chromaSum += mx - Math.min(r, g, b)
    if (mx > 0.5) { brN++; brS += (mx - Math.min(r, g, b)) / mx; brChroma += mx - Math.min(r, g, b) }
    if (mx > 0.15) {
      const dd = mx - Math.min(r, g, b), s = dd / mx
      litN++; litS += s
      if (dd > 0) { const h = (mx === r ? ((g - b) / dd + 6) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4) * 60; hue[Math.floor(h / 30) % 12] += s }
    }
  }
  const pct = (hist, tot, q) => { let a = 0; for (let i = 0; i < 256; i++) { a += hist[i]; if (a / tot >= q) return i / 255 } return 1 }
  const hs = hue.reduce((p, q) => p + q, 0) || 1
  const r4 = v => Math.round(v * 10000) / 10000
  return { meanSat: r4(litS / Math.max(1, litN)), litFrac: r4(litN / n), hueHist: [...hue].map(v => r4(v / hs)), black: r4(pct(top, topN, 0.05)), brightSat: r4(brS / Math.max(1, brN)), brightFrac: r4(brN / n), chroma: r4(chromaSum / n), hueMax: r4(Math.max(...hue) / hs), meanLuma: r4(sumL / n), p5Luma: r4(pct(all, n, 0.05)), w: W, h: H }
})()

/** measure(url, stops, opts) -> { [stop]: { meanSat, hueHist, black, meanLuma, litFrac, p5Luma, settledMs, settled:{...}, shot? }, __errs }
 *  opts: label (file prefix), saveDir (write <label>-<stop>.png for every stop), viewport, settle (ms, default 2500), stable (re-check until luma steady, default true) */
export async function measure(url, stops = ALL_STOPS, opts = {}) {
  const { label = 'run', saveDir = null, viewport = { width: 1440, height: 900 }, settle = 2500, stable = true } = opts
  if (!/[?&]gate=/.test(url)) url += (url.includes('?') ? '&' : '?') + 'gate=0'
  if (saveDir) fs.mkdirSync(saveDir, { recursive: true })
  const res = {}
  await withBrowser(async browser => {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
    const errs = []
    page.on('pageerror', e => errs.push(e.message))
    page.on('console', m => { if (m.type() === 'error' && !/403|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)) })
    // a cold Vite dep optimiser can fail the first dynamic import ("Failed to fetch dynamically imported module"): reload and retry (up to 3 loads)
    for (let attempt = 0; ; attempt++) {
      await page.goto(url, { waitUntil: 'load', timeout: 90000 })
      try { await page.waitForFunction(() => window.__v3 && window.__v3.goto && window.__v3.field, null, { timeout: attempt < 2 ? 60000 : 150000 }); break } catch (e) { if (attempt >= 2) throw e }
    }
    await page.waitForTimeout(3000)
    await page.evaluate(css => { const st = document.createElement('style'); st.id = 'cm-hide'; st.textContent = css; document.head.append(st); document.getElementById('loader')?.remove() }, HIDE_CSS)
    for (const id of stops) {
      await page.evaluate(async id => {
        const f = await import('/src/v3/world/flight.ts'), L = await import('/src/v3/world/layout.ts')
        const i = L.WAYPOINTS.findIndex(w => w.id === id); if (i < 0) throw new Error('no waypoint ' + id)
        window.__v3.goto(f.waypointP(i))
      }, id)
      await page.waitForTimeout(settle)
      const buf = await page.screenshot(); const first = await page.evaluate(analyse, buf.toString('base64'))
      let cur = first, curBuf = buf, extra = 0
      if (stable) for (let k = 0; k < 4; k++) {   // the spec frame is the 2.5 s one; "settled" is where the luma stops moving (slow set-pieces such as the name)
        await page.waitForTimeout(1500); extra += 1500
        const b2 = await page.screenshot(), s2 = await page.evaluate(analyse, b2.toString('base64'))
        const steady = Math.abs(s2.meanLuma - cur.meanLuma) < 0.04 * Math.max(cur.meanLuma, 0.05)
        cur = s2; curBuf = b2; if (steady) break
      }
      res[id] = { ...first, settledMs: settle + extra, settled: { brightSat: cur.brightSat, chroma: cur.chroma, meanSat: cur.meanSat, hueHist: cur.hueHist, black: cur.black, meanLuma: cur.meanLuma, litFrac: cur.litFrac } }
      if (saveDir) { fs.writeFileSync(`${saveDir}/${label}-${id}.png`, buf); fs.writeFileSync(`${saveDir}/${label}-${id}-settled.png`, curBuf); res[id].shot = `${saveDir}/${label}-${id}.png` }
    }
    res.__errs = [...new Set(errs)].slice(0, 12)
    await page.close()
  })
  return res
}

/** re-analyse saved PNG frames: analysePngs(['/path/a.png', ...]) -> { path: metrics } (one browser, no WebGL) */
export async function analysePngs(paths) {
  const out = {}
  await withBrowser(async browser => {
    const page = await browser.newPage(); await page.goto('about:blank')
    for (const p of paths) out[p] = await page.evaluate(analyse, fs.readFileSync(p).toString('base64'))
    await page.close()
  })
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [url, out = '/dev/stdout', ...stops] = process.argv.slice(2)
  const r = await measure(url, stops.length ? stops : ALL_STOPS, { label: 'cli' })
  fs.writeFileSync(out, JSON.stringify(r, null, 1))
  for (const [k, v] of Object.entries(r)) if (k !== '__errs') console.log(k.padEnd(11), 'sat', v.meanSat.toFixed(3), 'black', v.black.toFixed(3), 'luma', v.meanLuma.toFixed(3), 'lit', v.litFrac.toFixed(3))
  console.log('errs', r.__errs)
}
