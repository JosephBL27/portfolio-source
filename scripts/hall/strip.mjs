// Real flight instrument -> gate -> hall with a filmstrip of the two legs, frame-time + long-task sampling over the whole flight, the hall dwell shot, a hover shot and
// (--click i) a window click that must carry the camera to the interest room. One browser, closed in finally.
// usage: node scripts/hall/strip.mjs --tag r4/after [--procedural 1] [--w 1440 --h 900 --dpr 1] [--mobile] [--click 0] [--hover 2] [--strip 600] [--extra "js"]
import { withBrowser } from '../lib/browser.mjs'
import fs from 'node:fs'
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const flag = k => args.includes('--' + k)
const ROOT = decodeURIComponent(new URL('../../', import.meta.url).pathname).replace(/\/$/, '')
const url = opt('url', 'http://localhost:5331/'), tag = opt('tag', 'x'), mobile = flag('mobile')
const w = +opt('w', mobile ? 390 : 1440), h = +opt('h', mobile ? 844 : 900), dpr = +opt('dpr', mobile ? 2 : 1)
const outDir = `${ROOT}/out/compare`, stripDir = `${ROOT}/out/compare/${tag}-strip`
fs.mkdirSync(stripDir, { recursive: true }); fs.mkdirSync(outDir + '/' + tag.split('/').slice(0, -1).join('/'), { recursive: true })
for (const f of fs.readdirSync(stripDir)) fs.unlinkSync(stripDir + '/' + f)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const res = await withBrowser(async (b) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile })
  const p = await ctx.newPage()
  const logs = []
  p.on('console', m => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/setDecoderConfig|vite|HMR/i.test(t)) logs.push(`[${m.type()}] ${t.slice(0, 240)}`) })
  p.on('pageerror', e => logs.push('[pageerror] ' + String(e).slice(0, 240)))
  p.on('requestfailed', r => logs.push('[reqfailed] ' + r.url().slice(-80)))
  await p.addInitScript(() => { try { const ws = window.WebSocket; window.WebSocket = function (u, pr) { if (String(u).includes('vite') || String(u).includes('5331')) return { close() {}, send() {}, addEventListener() {}, removeEventListener() {}, readyState: 3 }; return new ws(u, pr) } } catch { /* */ } })
  await p.goto(url + '?gate=0' + (flag('procedural') ? '&hall=procedural' : '') + '#instrument', { waitUntil: 'load', timeout: 90000 })
  await p.waitForFunction(() => window.__v3?.goto, null, { timeout: 120000 })
  const ids = await p.evaluate(async () => { const L = await import('/src/v3/world/layout.ts'); return L.WAYPOINTS.map(w => w.id) })
  const iGate = ids.indexOf('gate'), iHall = ids.indexOf('hall'), iHold = ids.indexOf('hold')
  await sleep(3500)
  const st = () => p.evaluate(() => { const s = window.__v3.state(); return { wp: s.wp, dwelling: s.dwelling, t: s.t } })
  const settle = async (target, max = 30000) => { const t0 = Date.now(); for (;;) { const s = await st(); if (s.wp === target && s.dwelling) return true; if (Date.now() - t0 > max) return false; await sleep(200) } }
  const press = async () => { await p.keyboard.press('ArrowDown'); await sleep(300) }
  const out = { ids: { iGate, iHall, iHold }, logs }
  out.startSettled = await settle(iGate - 1, 40000); await sleep(1200)
  // sampler over the whole flight
  await p.evaluate(() => {
    window.__ft = []; window.__lt = []
    let last = performance.now()
    const f = (t) => { window.__ft.push(t - last); last = t; requestAnimationFrame(f) }; requestAnimationFrame(f)
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)) }).observe({ entryTypes: ['longtask'] }) } catch { /* */ }
  })
  const every = +opt('strip', 600)
  let n = 0
  const grab = async (leg, until) => {
    const t0 = Date.now()
    while (!(await until()) && Date.now() - t0 < 25000) {
      await p.screenshot({ path: `${stripDir}/${leg}-${String(n++).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 62 }).catch(() => {})
      await sleep(every)
    }
  }
  await press()
  await grab('a', async () => { const s = await st(); return s.wp === iGate && s.dwelling })
  await sleep(1500); await p.screenshot({ path: `${outDir}/${tag}-gate.png` })
  await press()
  await grab('b', async () => { const s = await st(); return s.wp === iHall && s.dwelling })
  await sleep(3200)
  await p.screenshot({ path: `${outDir}/${tag}-hall.png` })
  out.flight = await p.evaluate(() => {
    const a = window.__ft.slice(5).sort((x, y) => x - y), n = a.length
    return { frames: n, mean: +(a.reduce((s, x) => s + x, 0) / n).toFixed(1), p50: +a[n >> 1].toFixed(1), p95: +a[Math.floor(n * .95)].toFixed(1), p99: +a[Math.floor(n * .99)].toFixed(1), max: +a[n - 1].toFixed(1), over50: a.filter(x => x > 50).length, longtasks: window.__lt.length, ltMax: Math.max(0, ...window.__lt) }
  })
  out.hall = await p.evaluate(() => { const H = window.__hall; const i = window.__v3.field?.renderer?.info; return H ? { photoreal: H.rig.photoState, ptris: H.rig.photo?.stats ?? null, calls: i?.render.calls, tris: i?.render.triangles, tex: i?.memory.textures, geoms: i?.memory.geometries, programs: i?.programs?.length } : null })
  // frame time standing in the hall
  out.dwellFrames = await p.evaluate(() => new Promise(res => { const ts = []; let last = performance.now(), t0 = last; const f = (t) => { ts.push(t - last); last = t; if (t - t0 < 3000) requestAnimationFrame(f); else { const a = ts.slice(2).sort((x, y) => x - y); res({ n: a.length, p50: +a[a.length >> 1].toFixed(1), p95: +a[Math.floor(a.length * .95)].toFixed(1), max: +a[a.length - 1].toFixed(1) }) } }; requestAnimationFrame(f) }))
  const hv = opt('hover', null)
  if (hv != null) {
    const pos = await p.evaluate(i => { const H = window.__hall, c = H.rig.proxies[i].position.clone(); H.rig.root.updateMatrixWorld(true); c.applyMatrix4(H.rig.root.matrixWorld); c.project(window.__v3.field.camera); return { x: (c.x * 0.5 + 0.5) * innerWidth, y: (1 - (c.y * 0.5 + 0.5)) * innerHeight } }, +hv)
    await p.mouse.move(pos.x, pos.y, { steps: 6 }); await sleep(1500)
    await p.screenshot({ path: `${outDir}/${tag}-hall-hover${hv}.png` }); out.hoverAt = pos
  }
  const ck = opt('click', null)
  if (ck != null) {
    const pos = await p.evaluate(i => { const H = window.__hall, c = H.rig.proxies[i].position.clone(); H.rig.root.updateMatrixWorld(true); c.applyMatrix4(H.rig.root.matrixWorld); c.project(window.__v3.field.camera); return { x: (c.x * 0.5 + 0.5) * innerWidth, y: (1 - (c.y * 0.5 + 0.5)) * innerHeight } }, +ck)
    await p.mouse.move(pos.x, pos.y, { steps: 5 }); await sleep(500)
    await p.mouse.click(pos.x, pos.y)
    out.clickAt = pos
    const t0 = Date.now(); let seen = []
    while (Date.now() - t0 < 14000) { const s = await st(); const d = await p.evaluate(() => !!window.__hall.diving); seen.push(`${s.wp}${s.dwelling ? 'd' : ''}${d ? '*' : ''}`); if (s.wp === iHold + (+ck) && s.dwelling) break; await sleep(500) }
    out.clickPath = [...new Set(seen)].join(' ')
    out.clickArrived = (await st())
    await sleep(1500); await p.screenshot({ path: `${outDir}/${tag}-click${ck}.png` })
  }
  const ex = opt('extra', null)
  if (ex) out.extra = await p.evaluate(ex)
  return out
})
console.log(JSON.stringify(res, null, 1))
