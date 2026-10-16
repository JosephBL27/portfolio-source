// ~30-second 9:16 clip of the live v4 flight -> docs/video/metamorphoses-9x16.mp4 (1080x1920, silent: playwright cannot capture audio).
// usage: node scripts/record-vertical.mjs [seconds=32] [cssW=540] [cssH=800] [dpr=2]   (the rest of the 960 css-px frame is the caption band)
//   env: PLAN_ONLY=1 prints the timeline and stops; STEP_MS=200 real ms per rendered frame; CAPTION_FONT='Arial Black'
// The flight is scripted: p(t) is pinned through window.__v3.goto, walking the waypoints with a hold on the best moments and a quick
// pass over the rest, so the camera never cuts. main.ts leads the camera and the morph along the scripted velocity (as it does under scroll).
// At the hub (the name) the clip PLAYS the world with real mouse events: a turn of the TV's dial (the channel changes, detents click) and a
// drag of the point of view on empty space (it swings, then eases home). Captions are transparent PNGs rendered by playwright from a
// system font and laid over the clip by ffmpeg (this ffmpeg build has no drawtext filter).
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const SECS = +(process.argv[2] || 32), CW = +(process.argv[3] || 540), CH = +(process.argv[4] || 800), DPR = +(process.argv[5] || 2)
const OUT_W = CW * DPR, OUT_H = 960 * DPR, BAND = OUT_H - CH * DPR // caption band on top, so the caption never sits on the site's own big titles
const dir = fileURLToPath(new URL('../docs/video/', import.meta.url))
const work = dir + '.vwork/'
rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true })
const URL_ = 'http://localhost:5200/?gate=0'
const FONT = process.env.CAPTION_FONT || 'Arial Black'

// holds (seconds) on the moments that earn it; every other waypoint is flown past quickly.
// ids from src/v3/world/layout.ts: clouds, name (the hub TV), world, mind (brain), alarm (TV arc), table (poker), market (phase),
// surface (QVR vol surface), school (Chicago), instrument (compass), hold/records (about objects), epilogue (TV power-off)
// name: 0.9 s of the title, a 1.7 s dial turn, a 1.4 s drag of the view, then the view eases home.
// epilogue: the closing line arms the TV power-off at 24% of the dwell and it then runs 1.4 s, so it needs 3 s
const HOLDS = { clouds: 0.8, name: 6.0, world: 1.0, mind: 1.3, alarm: 1.2, table: 1.2, market: 1.2, surface: 1.5, school: 1.3, instrument: 1.3, hold: 0.9, records: 0.8, epilogue: 3.0 }
const SKIP_DWELL = 0.08
const NAME_T = { glide: 0.9, press: 1.4, release: 3.1, povGlide: 3.1, povPress: 3.7, povRelease: 5.1, home: 5.4 } // seconds into the name hold

const FPS = 30, STEP_MS = +(process.env.STEP_MS || 200) // real ms spent per rendered frame (CSS animations are slowed to match)
const b = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: CW, height: CH }, deviceScaleFactor: DPR })
// The CDP screencast (playwright recordVideo) is capped at CSS pixels, so a 540x960 phone viewport would record at
// 540x960. Instead the clock is virtual: rAF callbacks and performance.now advance exactly 1/30 s per captured
// frame, and each frame is a full-resolution page.screenshot. Deterministic, 1080x1920, no dropped frames.
await ctx.addInitScript(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realCancel = window.cancelAnimationFrame.bind(window), realNow = performance.now.bind(performance)
  const S = (window.__vt = { on: false, t: 0, q: [], id: 1e6 })
  performance.now = () => (S.on ? S.t : realNow())
  window.requestAnimationFrame = cb => { if (!S.on) return realRAF(cb); const id = ++S.id; S.q.push([id, cb]); return id }
  window.cancelAnimationFrame = id => { if (id >= 1e6) S.q = S.q.filter(x => x[0] !== id); else realCancel(id) }
  S.start = () => { S.t = realNow(); S.on = true }
  S.step = (dt, p) => { S.t += dt; window.__v3.goto(p); const q = S.q; S.q = []; for (const [, cb] of q) { try { cb(S.t) } catch (e) { console.error(e) } } }
  S.frame = (dt, p0, p1) => { S.step(dt / 2, p0); S.step(dt / 2, p1) } // two 60 Hz ticks per 30 fps frame: the sim was tuned at 60 Hz
})
const p = await ctx.newPage()
// other people edit src/ while this records: vite's HMR socket would reload the page mid-flight, so keep it silent
await p.routeWebSocket(/.*/, () => {})
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(URL_, { waitUntil: 'load' })
await p.waitForFunction(() => window.__v3 && window.__v3.goto, null, { timeout: 60000 })
await p.waitForTimeout(3500)

// build the timeline in the page (needs the flight module for dwell/leg ranges)
const plan = await p.evaluate(async ({ HOLDS, SKIP_DWELL, SECS }) => {
  const F = await import('/src/v3/world/flight.ts'); const L = await import('/src/v3/world/layout.ts')
  const W = L.WAYPOINTS
  const dw = W.map(w => (HOLDS[w.id] != null ? HOLDS[w.id] : SKIP_DWELL))
  const holdSum = dw.reduce((a, b) => a + b, 0)
  const travelSum = W.reduce((a, w, i) => a + (i > 0 ? w.travel : 0), 0)
  const k = (SECS - holdSum) / travelSum // seconds per unit of travel weight
  const keys = []; const marks = []; const at = {}; let t = 0
  for (let i = 0; i < W.length; i++) {
    const [d0, d1] = F.dwellRange(i)
    if (i > 0 && W[i].travel > 0) { const [l0] = F.legRange(i); keys.push([t, l0]); t += W[i].travel * k }
    // inside a dwell the camera drifts a few degrees; walk the whole range (epilogue: through the TV power-off)
    const held = HOLDS[W[i].id] != null
    keys.push([t, held ? d0 : (d0 + d1) / 2]); marks.push(W[i].id + (held ? '*' : '') + '@' + t.toFixed(1)); at[W[i].id] = t; t += dw[i]; keys.push([t, held ? d1 : (d0 + d1) / 2])
  }
  keys.push([t, 1])
  return { keys, k, total: t, marks, at, travelSum, holdSum }
}, { HOLDS, SKIP_DWELL, SECS })
console.log('timeline', plan.total.toFixed(1), 's, k=', plan.k.toFixed(2), 's per travel unit (travel sum', plan.travelSum.toFixed(1) + ', holds', plan.holdSum.toFixed(1) + ') (* = held)\n' + plan.marks.join(' '))
if (process.env.PLAN_ONLY) { await b.close(); rmSync(work, { recursive: true, force: true }); process.exit(0) }
if (plan.k < 0.2) console.warn('WARNING: legs shorter than 0.2 s per unit: lengthen the clip or trim a hold')
const at = s => { // piecewise linear in p: the flight module already eases each leg
  const keys = plan.keys
  if (s <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) if (s <= keys[i][0]) { const [ta, pa] = keys[i - 1], [tb, pb] = keys[i]; return tb === ta ? pb : pa + (pb - pa) * (s - ta) / (tb - ta) }
  return 1
}

// pin p at the start so nothing pops, then take over the clock
await p.evaluate(k0 => window.__v3.goto(k0), plan.keys[0][1])
await p.waitForTimeout(1500)
const cdp = await ctx.newCDPSession(p)
await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: (1000 / FPS) / STEP_MS })
await p.evaluate(() => window.__vt.start())

// ---- the hub interaction: real mouse events, one pointer move per frame (the world reads the clock at every event)
const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x) }
const T0 = plan.at.name
let cur = { x: CW * 0.5, y: CH * 0.64 }, down = false, povPt = null, dialR = 0
const orbit = s => { const a = s * 1.9; return { x: CW * (0.5 + 0.3 * Math.cos(a)), y: CH * (0.64 + 0.16 * Math.sin(a * 1.3)) } }
const partDial = () => p.evaluate(() => window.__v3.world.partScreen('hub', 'dial'))
const findEmpty = () => p.evaluate(([w, h]) => {
  const wd = window.__v3.world, f = document.getElementById('field')
  for (const [fx, fy] of [[0.14, 0.3], [0.2, 0.22], [0.85, 0.3], [0.15, 0.5], [0.8, 0.22], [0.12, 0.62]]) { const x = fx * w, y = fy * h; if (document.elementFromPoint(x, y) === f && !wd.hitTest(x, y)) return [x, y] }
  return null
}, [CW, CH])
let lastMove = { x: -1, y: -1 }
const moveTo = async (x, y) => { if (Math.abs(x - lastMove.x) + Math.abs(y - lastMove.y) < 0.01) return; lastMove = { x, y }; cur = { x, y }; await p.mouse.move(x, y) }
let restPt = null
async function interact(s) {
  const t = s - T0
  if (t < NAME_T.glide - 0.5) { const o = orbit(s); await moveTo(o.x, o.y); return } // elsewhere: the visible custom cursor wanders over the picture and parts the particles
  if (t < NAME_T.release) { // dial: glide onto the knob, press, turn it through most of a circle, let go
    const d = await partDial(); if (!d) return
    dialR = Math.max(d.r * 0.6, 6)
    if (t < NAME_T.press) { const k = ease((t - (NAME_T.glide - 0.5)) / 0.5); const ang = -Math.PI / 2; await moveTo(cur.x + (d.x + Math.cos(ang) * dialR - cur.x) * k, cur.y + (d.y + Math.sin(ang) * dialR - cur.y) * k); return }
    if (!down) { await moveTo(d.x + Math.cos(-Math.PI / 2) * dialR, d.y + Math.sin(-Math.PI / 2) * dialR); await p.mouse.down(); down = true }
    const k = ease((t - NAME_T.press) / (NAME_T.release - NAME_T.press)), ang = -Math.PI / 2 + k * Math.PI * 1.9
    await moveTo(d.x + Math.cos(ang) * dialR, d.y + Math.sin(ang) * dialR); return
  }
  if (down && t < NAME_T.povPress) { await p.mouse.up(); down = false }
  if (t < NAME_T.povRelease) { // view: glide to bare canvas, press, swing the point of view, hold, let go (it eases home by itself)
    if (!povPt) povPt = (await findEmpty()) || [CW * 0.2, CH * 0.28]
    if (t < NAME_T.povPress) { const k = ease((t - NAME_T.povGlide) / (NAME_T.povPress - NAME_T.povGlide)); await moveTo(cur.x + (povPt[0] - cur.x) * k, cur.y + (povPt[1] - cur.y) * k); return }
    if (!down) { await moveTo(povPt[0], povPt[1]); await p.mouse.down(); down = true }
    const k = ease((t - NAME_T.povPress) / (NAME_T.povRelease - NAME_T.povPress - 0.3))
    await moveTo(povPt[0] + k * CW * 0.3, povPt[1] + k * CH * 0.08); return // a gentle swing: the TV stays in frame
  }
  if (down) { await p.mouse.up(); down = false }
  restPt ??= { ...cur }
  const o = orbit(s), k = t < NAME_T.home ? 0 : ease((t - NAME_T.home) / 0.6) // rest while the view eases home, then rejoin the wandering cursor
  await moveTo(restPt.x + (o.x - restPt.x) * k, restPt.y + (o.y - restPt.y) * k)
}

const N = Math.round(SECS * FPS)
const t0 = Date.now()
for (let i = 0; i < N; i++) {
  const ts = Date.now(), s = i / FPS
  await interact(s)
  await p.evaluate(([dt, p0, p1]) => window.__vt.frame(dt, p0, p1), [1000 / FPS, at(s - 0.5 / FPS), at(s)])
  await p.screenshot({ path: work + 'f' + String(i).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 93 })
  const wait = STEP_MS - (Date.now() - ts); if (wait > 0) await p.waitForTimeout(wait)
  if (i % 150 === 0) console.log('frame', i, '/', N, ((Date.now() - t0) / 1000).toFixed(0) + 's')
}
const hubEnd = await p.evaluate(() => window.__v3.world.stats())
await ctx.close(); await b.close()
console.log('hub state at the end', JSON.stringify(hubEnd))
if (errs.length) console.log('page errors:', [...new Set(errs)].slice(0, 5).join(' | '))

// ---- captions: transparent PNGs (same pixel size as the clip) from a system font, each faded in and out over its own span
const CAPS = [
  { text: 'A portfolio that\nchanges form', a: 0.2, b: plan.at.name + 1.2 },
  { text: 'Turn the dials.\nDrag the view.', a: plan.at.name + 1.3, b: plan.at.name + 5.9 },
  { text: 'Every project,\nits own world', a: plan.at.mind - 0.1, b: plan.at.hold - 0.3 },
  { text: 'Joseph\nBlumberg', a: plan.at.hold, b: SECS - 0.1 },
]
const b2 = await chromium.launch({ channel: 'chromium', headless: true })
const cp = await (await b2.newContext({ viewport: { width: CW, height: 960 }, deviceScaleFactor: DPR })).newPage()
const fs = Math.round(CW * 0.118)
await cp.setContent(`<style>html,body{margin:0;background:transparent}
.c{position:absolute;left:0;right:0;top:${Math.round(BAND / DPR / 2 - fs)}px;text-align:center;color:#fff;font:900 ${fs}px/1.02 '${FONT}','Arial Black','Helvetica Neue',Arial,sans-serif;letter-spacing:-0.01em;white-space:pre-line;
text-shadow:0 2px 0 rgba(0,0,0,.55),0 0 18px rgba(0,0,0,.65),0 0 40px rgba(0,0,0,.45)}</style><div class="c"></div>`)
for (const [i, c] of CAPS.entries()) {
  await cp.evaluate(t => { document.querySelector('.c').textContent = t }, c.text)
  await cp.screenshot({ path: work + `caption${i}.png`, omitBackground: true })
}
await b2.close()

// ---- encode: image sequence -> 1080x1920, captions, 30 fps, silent
const out = dir + 'metamorphoses-9x16.mp4'
// the band takes the site's own background colour (read from the first frame), so it reads as one surface
const px = execFileSync('ffmpeg', ['-v', 'error', '-i', work + 'f0000.jpg', '-vf', 'crop=8:8:0:0,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']), bg = '0x' + [...px.subarray(0, 3)].map(v => v.toString(16).padStart(2, '0')).join('')
const inputs = ['-framerate', String(FPS), '-i', work + 'f%04d.jpg'], parts = [`[0:v]scale=${OUT_W}:${OUT_H - BAND}:flags=lanczos,setsar=1,pad=${OUT_W}:${OUT_H}:0:${BAND}:color=${bg}[v0]`]
let last = 'v0'
CAPS.forEach((c, i) => {
  inputs.push('-loop', '1', '-t', String(SECS), '-i', work + `caption${i}.png`)
  parts.push(`[${i + 1}:v]format=rgba,fade=t=in:st=${c.a.toFixed(2)}:d=0.35:alpha=1,fade=t=out:st=${(c.b - 0.35).toFixed(2)}:d=0.35:alpha=1[c${i}]`)
  parts.push(`[${last}][c${i}]overlay=0:0[v${i + 1}]`); last = `v${i + 1}`
})
parts.push(`[${last}]scale=in_range=full:out_range=limited,format=yuv420p[vout]`)
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-t', String(SECS), '-filter_complex', parts.join(';'), '-map', '[vout]',
  '-c:v', 'libx264', '-crf', '22', '-maxrate', '10M', '-bufsize', '20M', '-preset', 'medium', '-movflags', '+faststart', '-an', out])
rmSync(work, { recursive: true, force: true })
console.log('wrote', out)
