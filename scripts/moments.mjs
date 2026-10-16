// Set-piece harness (unit 8M): frames, reverse-scrub diff and frame-time for one transitions leg. ONE headless browser, always closed in finally.
// usage: node scripts/moments.mjs --port 5397 --leg table>market --mode shots --us 0.2,0.4,0.6,0.8 --out shots/v12-moment-mosaic
//        node scripts/moments.mjs --port 5397 --leg table>market --mode diff --us 0.3,0.55,0.75
//        node scripts/moments.mjs --port 5397 --leg table>market --mode perf
//        node scripts/moments.mjs ... --mode all   (shots + diff + perf in one browser session)
import { chromium } from 'playwright-core'
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const port = opt('port', '5397'), leg = opt('leg', 'table>market'), mode = opt('mode', 'shots')
const us = opt('us', '0.2,0.4,0.6,0.8').split(',').map(Number)
const out = opt('out', 'shots/v12-moment-x')
const W = +opt('w', 1440), H = +opt('h', 900)
const SET = +opt('settle', 900)
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] })
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  // other agents edit files while this runs: a Vite HMR full reload would wipe the page mid-capture, so the HMR socket is stubbed out
  await page.addInitScript(() => {
    const WS = window.WebSocket
    window.WebSocket = function (url, protocols) {
      if (String(protocols).includes('vite-hmr')) return { addEventListener() {}, removeEventListener() {}, send() {}, close() {}, readyState: 3 }
      return new WS(url, protocols)
    }
    window.WebSocket.prototype = WS.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 })
  })
  const logs = []
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`) })
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
  await page.goto(`http://localhost:${port}/?extras=-pov`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForFunction(() => window.__v3 && window.__tr && window.__v3.field, null, { timeout: 60000 })
  await sleep(800)
  const gate = page.getByText('Enter silently', { exact: false }).first()
  if (await gate.count()) { await gate.click({ timeout: 8000 }).catch(() => {}); await sleep(2500) }
  const info = await page.evaluate(k => { const l = window.__tr.legs.get(k); return l ? { p0: l.p0, p1: l.p1 } : null }, leg)
  if (!info) throw new Error('no such leg in __tr.legs: ' + leg)
  const at = u => info.p0 + u * (info.p1 - info.p0)
  let frozen = false
  // a paused field keeps its clock (particle swirl, shimmer) still, so two captures at one p can be compared; goto still wakes it for the camera rig to settle
  const settle = async (p, ms = 900) => { await page.evaluate(([q, f]) => { if (!f) window.__v3.field.setPaused?.(false); window.__v3.goto(q) }, [p, frozen]); await sleep(ms); await page.evaluate(() => window.__v3.field.setPaused?.(true)); await sleep(160) }
  const snap = async () => page.screenshot({ type: 'png' })

  if (mode === 'shots' || mode === 'all') {
    for (let i = 0; i < us.length; i++) {
      await settle(at(us[i]))
      const f = `${out}-${String(i + 1).padStart(2, '0')}.png`
      await page.screenshot({ path: f })
      console.log('shot', f, 'u=' + us[i])
    }
  }
  if (mode === 'diff' || mode === 'all') {
    const dus = mode === 'all' ? [us[1], us[2]] : us
    if (args.includes('--off')) await page.evaluate(() => { window.__atmos.on.transitions = false })
    await page.evaluate(() => window.__v3.field.setPaused?.(true)); frozen = true
    for (const u of dus) {
      // forward arrival (from before), backward arrival (from after), and a same-direction repeat as the noise floor
      await settle(at(Math.max(0, u - 0.18)), 500); await settle(at(u), SET); const a = (await snap()).toString('base64')
      await settle(at(Math.min(1, u + 0.18)), 500); await settle(at(u), SET); const b = (await snap()).toString('base64')
      await settle(at(Math.max(0, u - 0.18)), 500); await settle(at(u), SET); const c = (await snap()).toString('base64')
      const r = await page.evaluate(async ([a, b, c]) => {
        const load = s => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + s })
        const px = async s => { const im = await load(s), cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const g = cv.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, cv.width, cv.height).data }
        const [A, B, C] = [await px(a), await px(b), await px(c)]
        const frac = (X, Y, th) => { let n = 0; const tot = X.length / 4; for (let i = 0; i < X.length; i += 4) { const d = Math.max(Math.abs(X[i] - Y[i]), Math.abs(X[i + 1] - Y[i + 1]), Math.abs(X[i + 2] - Y[i + 2])); if (d > th) n++ } return n / tot }
        return { fwdVsBack: frac(A, B, 24), fwdVsFwd: frac(A, C, 24), fwdVsBackLoose: frac(A, B, 48) }
      }, [a, b, c])
      console.log(`diff u=${u}: reverse ${(r.fwdVsBack * 100).toFixed(3)}% (th 24)  noise-floor ${(r.fwdVsFwd * 100).toFixed(3)}%  reverse th48 ${(r.fwdVsBackLoose * 100).toFixed(3)}%`)
    }
  }
  if (mode === 'perf' || mode === 'all') {
    frozen = false; await page.evaluate(() => window.__v3.field.setPaused?.(false))
    await settle(at(0) - 0.0005, 800); await page.evaluate(() => window.__v3.field.setPaused?.(false))
    const res = await page.evaluate(async ([p0, p1, secs, off]) => {
      if (off) window.__atmos.on.transitions = false
      const dts = []; let last = performance.now(), t0 = last
      await new Promise(done => {
        const tick = now => {
          dts.push(now - last); last = now
          const k = Math.min(1, (now - t0) / (secs * 1000))
          window.__v3.goto(p0 + k * (p1 - p0))
          if (k < 1) requestAnimationFrame(tick); else done()
        }
        requestAnimationFrame(tick)
      })
      dts.sort((a, b) => a - b)
      const q = f => dts[Math.min(dts.length - 1, Math.floor(f * dts.length))]
      return { n: dts.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: dts[dts.length - 1], over20: dts.filter(x => x > 20).length / dts.length, mean: dts.reduce((a, b) => a + b, 0) / dts.length, cpu: window.__atmos?.cpu?.transitions }
    }, [info.p0, info.p1, +opt('secs', 2.4), args.includes('--off')])
    console.log('perf', leg, args.includes('--off') ? '(transitions off)' : '', JSON.stringify(res))
  }
  if (mode === 'cost') {
    // the piece's own per-frame cost: a full-res scene render (+ the piece's frame(), which draws its render targets) forced synchronous with a pixel readback,
    // with the piece shown against hidden. The difference is what the piece adds to a frame (the post stack comes on top of both).
    await settle(at(0.5), 1500)
    for (const u of us) {
      const r = await page.evaluate(async ([key, p, u]) => {
        const rec = window.__tr.pieces.get(key), v3 = window.__v3, f = v3.field, gl = f.renderer.getContext(), px = new Uint8Array(4)
        const st = v3.flightAt(p), out = { field: 1, flash: 0, flashCol: [1, 1, 1] }
        const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]
        const time = fn => { const t = []; for (let i = 0; i < 30; i++) { const a = performance.now(); fn(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); t.push(performance.now() - a) } return med(t.slice(6)) }
        rec.piece.setVisible(true, rec.envp)
        const on = time(() => { rec.piece.frame({ u, t: 1, dt: 0.016, st, copy: 0, dir: 1 }, out, rec.envp); f.renderer.render(f.scene, f.camera) })
        rec.piece.setVisible(false, rec.envp)
        const off = time(() => { f.renderer.render(f.scene, f.camera) })
        return { on, off }
      }, [leg, at(u), u])
      console.log(`cost u=${u}: scene render with the piece ${r.on.toFixed(2)} ms, without ${r.off.toFixed(2)} ms, piece adds ${(r.on - r.off).toFixed(2)} ms`)
    }
  }
  if (mode === 'ab') {
    // alternating A/B inside one session: the same leg flown with the pieces on and off (other agents share this GPU, so only the difference means anything)
    frozen = false
    const run = async off => page.evaluate(async ([p0, p1, secs, off]) => {
      window.__atmos.on.transitions = !off
      window.__v3.goto(p0 - 0.002); await new Promise(r => setTimeout(r, 500))
      const dts = []; let last = performance.now(), t0 = last
      await new Promise(done => { const tick = now => { dts.push(now - last); last = now; const k = Math.min(1, (now - t0) / (secs * 1000)); window.__v3.goto(p0 + k * (p1 - p0)); if (k < 1) requestAnimationFrame(tick); else done() }; requestAnimationFrame(tick) })
      dts.sort((a, b) => a - b); const q = f => dts[Math.min(dts.length - 1, Math.floor(f * dts.length))]
      return { mean: dts.reduce((a, b) => a + b, 0) / dts.length, p50: q(0.5), p95: q(0.95), max: dts[dts.length - 1] }
    }, [info.p0, info.p1, +opt('secs', 1.9), off])
    await page.evaluate(() => window.__v3.field.setPaused?.(false))
    await run(false)
    const on = [], offs = []
    for (let i = 0; i < 4; i++) { on.push(await run(false)); offs.push(await run(true)) }
    const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]
    const f = r => `mean ${med(r.map(x => x.mean)).toFixed(2)} p50 ${med(r.map(x => x.p50)).toFixed(2)} p95 ${med(r.map(x => x.p95)).toFixed(2)} max ${med(r.map(x => x.max)).toFixed(1)}`
    console.log('ab', leg, '\n  on :', f(on), '\n  off:', f(offs))
  }
  const uniq = [...new Set(logs)]
  console.log('console issues:', uniq.length ? '\n' + uniq.slice(0, 14).join('\n').slice(0, 6000) : 'none')
} finally {
  await browser.close()
}
