// Records the full flight as a 16:9 clip -> docs/video/metamorphoses-tour-v9.mp4 (silent: playwright cannot capture audio).
// usage: node scripts/record.mjs [seconds=84] [w=1440] [h=900]      env: PLAN_ONLY=1 prints the timeline and stops; STEP_MS=200
// The page is scrolled for real (the input a visitor uses), so the follower, the copy and the HUD behave as live; only
// the clock is virtual. rAF callbacks and performance.now advance 1/60 s per tick, two ticks per captured 30 fps frame,
// and every frame is a page.screenshot. Playwright's own recordVideo follows wall-clock and stutters or drops time
// whenever the machine is busy; this does not. Each waypoint gets a dwell, every leg a flight of 1.2 s + 0.5 s per
// unit of travel weight (the follower's own floor is 1.5 s per leg, so it trails the scroll a little and catches up inside the dwells).
// Two pauses interrupt the flight (the scroll holds still) and PLAY the site with real mouse events:
//   hub   (at the name): a turn of the TV's dial (the channel changes) and a drag of the point of view (it swings, then eases home)
//   case  (at the QVR surface): the QVR work opens out of its TV, scrolls to the interactive volatility-surface lab, orbits the surface,
//         drags the skew slider, switches to the rebalancing-flow view, then closes back into the TV.
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const SECS = +(process.argv[2] || 84), W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900)
const FPS = 30, STEP_MS = +(process.env.STEP_MS || 200) // real ms per frame; CSS animations are slowed to match the virtual clock
const dir = fileURLToPath(new URL('../docs/video/', import.meta.url))
const work = dir + '.twork/'
rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true })
const HEAD = 0.4 // seconds of settled cloud before the scroll starts
const HUB = { len: 5.6, glide: 0.5, press: 0.9, release: 2.7, povGlide: 2.7, povPress: 3.2, povRelease: 4.6, home: 4.9 } // seconds into the hub pause
const CASE_LEN = 12.5
// at: fraction of the waypoint's dwell where the flight holds still (the pause must sit INSIDE the dwell, or it freezes the flight mid-leg)
const PAUSES = [{ id: 'name', at: 0.5, len: HUB.len, kind: 'hub' }, { id: 'surface', at: 0.5, len: CASE_LEN, kind: 'case' }]
const FLIGHT_S = SECS - PAUSES.reduce((a, q) => a + q.len, 0)

const b = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await ctx.addInitScript(() => {
  const realRAF = window.requestAnimationFrame.bind(window), realCancel = window.cancelAnimationFrame.bind(window), realNow = performance.now.bind(performance)
  const S = (window.__vt = { on: false, t: 0, q: [], id: 1e6 })
  performance.now = () => (S.on ? S.t : realNow())
  window.requestAnimationFrame = cb => { if (!S.on) return realRAF(cb); const id = ++S.id; S.q.push([id, cb]); return id }
  window.cancelAnimationFrame = id => { if (id >= 1e6) S.q = S.q.filter(x => x[0] !== id); else realCancel(id) }
  S.start = () => { S.t = realNow(); S.on = true }
  S.tick = (dt, y) => { S.t += dt; scrollTo(0, y); const q = S.q; S.q = []; for (const [, cb] of q) { try { cb(S.t) } catch (e) { console.error(e) } } }
  S.frame = (dt, y0, y1) => { S.tick(dt / 2, y0); S.tick(dt / 2, y1) }
})
const p = await ctx.newPage()
await p.routeWebSocket(/.*/, () => {}) // vite HMR would reload the page mid-flight whenever src/ is edited
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto('http://localhost:5200/?gate=0', { waitUntil: 'load' })
await p.waitForFunction(() => window.__v3 && window.__v3.goto, null, { timeout: 60000 })
await p.waitForTimeout(4500)

const plan = await p.evaluate(async ({ FLIGHT_S, HEAD }) => {
  const F = await import('/src/v3/world/flight.ts'); const L = await import('/src/v3/world/layout.ts')
  const WP = L.WAYPOINTS
  const legT = WP.map((w, i) => (i > 0 && w.travel > 0 ? 1.2 + 0.5 * w.travel : 0))
  const dwSum = WP.reduce((a, w) => a + w.dwell, 0)
  const k = (FLIGHT_S - HEAD - legT.reduce((a, b) => a + b, 0)) / dwSum // seconds per unit of dwell weight
  const keys = [[0, 0]], start = {}, dur = {}; let t = HEAD
  keys.push([t, 0])
  for (let i = 0; i < WP.length; i++) {
    const [d0, d1] = F.dwellRange(i)
    if (legT[i]) { keys.push([t, F.legRange(i)[0]]); t += legT[i] }
    start[WP[i].id] = t; dur[WP[i].id] = WP[i].dwell * k
    keys.push([t, d0]); t += WP[i].dwell * k; keys.push([t, d1])
  }
  return { keys, k, total: t, start, dur, range: document.documentElement.scrollHeight - innerHeight }
}, { FLIGHT_S, HEAD })
console.log('flight', plan.total.toFixed(1), 's + pauses', (SECS - FLIGHT_S).toFixed(1), 's; seconds per dwell unit', plan.k.toFixed(2), '; scroll range', plan.range, 'px')
if (plan.k < 0.5) console.warn('WARNING: dwells under 0.5 s per unit: lengthen the clip')
const at = s => { const keys = plan.keys; for (let i = 1; i < keys.length; i++) if (s <= keys[i][0]) { const [ta, pa] = keys[i - 1], [tb, pb] = keys[i]; return tb === ta ? pb : pa + (pb - pa) * (s - ta) / (tb - ta) } return 1 }
// video time -> flight time: the pauses hold the flight still
const pauses = PAUSES.map(q => ({ ...q, ft: plan.start[q.id] + plan.dur[q.id] * q.at })).sort((a, c) => a.ft - c.ft)
let acc = 0; for (const q of pauses) { q.vs = q.ft + acc; acc += q.len }
const flightTime = s => { let off = 0; for (const q of pauses) { if (s < q.vs) break; if (s < q.vs + q.len) return q.ft; off += q.len } return s - off }
const pauseAt = s => pauses.find(q => s >= q.vs && s < q.vs + q.len)
console.log('pauses', pauses.map(q => `${q.kind}@${q.vs.toFixed(1)}s+${q.len}s`).join(' '))
if (process.env.PLAN_ONLY) { await b.close(); rmSync(work, { recursive: true, force: true }); process.exit(0) }

await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(1500)
const cdp = await ctx.newCDPSession(p)
await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: (1000 / FPS) / STEP_MS })
await p.evaluate(() => window.__vt.start())

// ---- real mouse play. One pointer move per frame (the world and the lab read the clock at every event).
const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x) }
const orbit = s => { const a = s * 1.5; return { x: W * (0.5 + 0.3 * Math.cos(a)), y: H * (0.55 + 0.2 * Math.sin(a * 1.3)) } }
let cur = { x: W * 0.5, y: H * 0.55 }, down = false, last = { x: -1, y: -1 }, povPt = null, rest = null
const moveTo = async (x, y) => { if (Math.abs(x - last.x) + Math.abs(y - last.y) < 0.01) return; last = { x, y }; cur = { x, y }; await p.mouse.move(x, y) }
const glide = async (to, k) => moveTo(cur.x + (to[0] - cur.x) * k, cur.y + (to[1] - cur.y) * k)
const release = async () => { if (down) { await p.mouse.up(); down = false } }
const findEmpty = () => p.evaluate(([w, h]) => {
  const wd = window.__v3.world, f = document.getElementById('field')
  for (const [fx, fy] of [[0.14, 0.82], [0.12, 0.3], [0.86, 0.3], [0.5, 0.2], [0.2, 0.62], [0.8, 0.8]]) { const x = fx * w, y = fy * h; if (document.elementFromPoint(x, y) === f && !wd.hitTest(x, y)) return [x, y] }
  return null
}, [W, H])

async function hubPlay(u, s) {
  if (u < HUB.glide + HUB.press) { // glide onto the dial
    const d = await p.evaluate(() => window.__v3.world.partScreen('hub', 'dial')); if (!d) return
    if (u < HUB.press) { const R = Math.max(d.r * 0.6, 6); await glide([d.x + Math.cos(-Math.PI / 2) * R, d.y + Math.sin(-Math.PI / 2) * R], ease(u / HUB.press)); return }
  }
  if (u < HUB.release) { // press and turn the dial through most of a circle
    const d = await p.evaluate(() => window.__v3.world.partScreen('hub', 'dial')); if (!d) return
    const R = Math.max(d.r * 0.6, 6)
    if (!down) { await moveTo(d.x + Math.cos(-Math.PI / 2) * R, d.y + Math.sin(-Math.PI / 2) * R); await p.mouse.down(); down = true }
    const ang = -Math.PI / 2 + ease((u - HUB.press) / (HUB.release - HUB.press)) * Math.PI * 1.9
    await moveTo(d.x + Math.cos(ang) * R, d.y + Math.sin(ang) * R); return
  }
  if (down && u < HUB.povPress) await release()
  if (u < HUB.povRelease) { // glide to bare canvas, press, swing the point of view
    if (!povPt) povPt = (await findEmpty()) || [W * 0.15, H * 0.3]
    if (u < HUB.povPress) { await glide(povPt, ease((u - HUB.povGlide) / (HUB.povPress - HUB.povGlide))); return }
    if (!down) { await moveTo(povPt[0], povPt[1]); await p.mouse.down(); down = true }
    const k = ease((u - HUB.povPress) / (HUB.povRelease - HUB.povPress - 0.2))
    await moveTo(povPt[0] + k * W * 0.14, povPt[1] + k * H * 0.06); return // ~0.6 rad: the TV and the name both stay in frame
  }
  await release(); rest ??= { ...cur }
  const o = orbit(s), k = u < HUB.home ? 0 : ease((u - HUB.home) / 0.5)
  await moveTo(rest.x + (o.x - rest.x) * k, rest.y + (o.y - rest.y) * k)
}

// the case choreography, seconds into the pause
const C = { open: 0, scroll0: 2.0, scroll1: 3.3, orbit0: 3.6, orbit1: 5.2, slide0: 5.6, slide1: 7.6, up0: 8.0, up1: 8.8, flow: 9.0, close: 11.2 }
let caseState = { opened: false, scrolled: false, sc: null, canvas: null, thumb: null, flowed: false, closed: false, y1: 0, y2: 0 }
const labRects = () => p.evaluate(() => {
  const sc = document.querySelector('.case__scroll'), lab = document.querySelector('.cv-lab'); if (!sc || !lab) return null
  const base = sc.getBoundingClientRect().top - sc.scrollTop
  const doc = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top - base, w: r.width, h: r.height } }
  const cv = document.querySelector('.vl-3d'), tabs = [...document.querySelectorAll('.vl-tab')].find(t => t.dataset.mode === 'flow')
  const skew = [...document.querySelectorAll('.vl-sl-track')].find(t => /skew/i.test(t.getAttribute('aria-label') || ''))
  return { canvas: cv && doc(cv), flowTab: tabs && doc(tabs), skew: skew && doc(skew), thumb: skew && doc(skew.querySelector('.vl-sl-thumb')), vh: innerHeight }
})
const setScroll = y => p.evaluate(v => { const sc = document.querySelector('.case__scroll'); if (sc) sc.scrollTop = v }, y)
async function casePlay(u, s) {
  if (!caseState.opened) { await p.evaluate(() => window.__v3.openWork('qvr')); caseState.opened = true }
  const o = orbit(s)
  if (u < C.scroll0) { await moveTo(o.x, o.y); return }
  if (!caseState.R) {
    caseState.R = await labRects()
    if (caseState.R?.canvas) { caseState.y1 = Math.max(0, caseState.R.canvas.y - 44); caseState.y2 = Math.max(0, caseState.R.flowTab.y - 70) } // y1: canvas near the top with the sliders under it; y2: the mode tabs
  }
  const R = caseState.R; if (!R?.canvas) { await moveTo(o.x, o.y); return }
  if (u < C.scroll1) { await setScroll(caseState.y1 * ease((u - C.scroll0) / (C.scroll1 - C.scroll0))); await moveTo(o.x, o.y); return }
  const cx = R.canvas.x + R.canvas.w * 0.5, cy = R.canvas.y - caseState.y1 + R.canvas.h * 0.5
  if (u < C.orbit1) { // press on the 3-D surface and orbit it
    if (u < C.orbit0) { await glide([cx - 40, cy], ease((u - C.scroll1) / (C.orbit0 - C.scroll1))); return }
    if (!down) { await moveTo(cx - 40, cy); await p.mouse.down(); down = true }
    const k = ease((u - C.orbit0) / (C.orbit1 - C.orbit0 - 0.2)); await moveTo(cx - 40 + k * 190, cy - k * 26); return
  }
  if (u < C.slide1) { // drag the skew slider thumb across its track
    if (down && u < C.slide0) await release()
    const ty = R.thumb.y - caseState.y1 + R.thumb.h * 0.5, tx = R.thumb.x + R.thumb.w * 0.5
    if (u < C.slide0) { await glide([tx, ty], ease((u - C.orbit1) / (C.slide0 - C.orbit1))); return }
    if (!down) { await moveTo(tx, ty); await p.mouse.down(); down = true }
    const k = ease((u - C.slide0) / (C.slide1 - C.slide0 - 0.2)), tr = R.skew
    await moveTo(tx + k * (tr.x + tr.w * 0.9 - tx), ty); return
  }
  if (u < C.up1) { await release(); await setScroll(caseState.y1 + (caseState.y2 - caseState.y1) * ease((u - C.up0) / (C.up1 - C.up0))); return }
  if (!caseState.flowed) {
    const R2 = await labRects(); const tx = R2.flowTab.x + R2.flowTab.w * 0.5, ty = R2.flowTab.y - caseState.y2 + R2.flowTab.h * 0.5
    if (u < C.flow) { await glide([tx, ty], ease((u - C.up1) / (C.flow - C.up1 - 0.05))); return }
    await p.mouse.click(tx, ty); caseState.flowed = true; return
  }
  if (u >= C.close && !caseState.closed) { await p.keyboard.press('Escape'); caseState.closed = true }
}

const N = Math.round(SECS * FPS), t0 = Date.now()
for (let i = 0; i < N; i++) {
  const ts = Date.now(), s = i / FPS, q = pauseAt(s)
  if (q?.kind === 'hub') await hubPlay(s - q.vs, s).catch(e => console.warn('hub play:', e.message.split('\n')[0]))
  else if (q?.kind === 'case') await casePlay(s - q.vs, s).catch(e => console.warn('case play:', e.message.split('\n')[0]))
  else { await release(); const o = orbit(s); await moveTo(o.x, o.y) } // the visible custom cursor wanders over the picture and parts the particles
  const f0 = flightTime(s - 0.5 / FPS), f1 = flightTime(s)
  await p.evaluate(([dt, y0, y1]) => window.__vt.frame(dt, y0, y1), [1000 / FPS, at(f0) * plan.range, at(f1) * plan.range])
  await p.screenshot({ path: work + 'f' + String(i).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 93 })
  const wait = STEP_MS - (Date.now() - ts); if (wait > 0) await p.waitForTimeout(wait)
  if (i % 300 === 0) console.log('frame', i, '/', N, ((Date.now() - t0) / 1000).toFixed(0) + 's')
}
const end = await p.evaluate(() => { const s = window.__v3.state(); return { wp: s.wp, dwelling: s.dwelling, caseOpen: !!window.__v3.caseView?.isOpen?.() } })
await ctx.close(); await b.close()
console.log('final state', JSON.stringify(end), 'case choreography', JSON.stringify({ opened: caseState.opened, flowed: caseState.flowed, closed: caseState.closed, y1: Math.round(caseState.y1), y2: Math.round(caseState.y2) }))
if (errs.length) console.log('page errors:', [...new Set(errs)].slice(0, 5).join(' | '))

const out = dir + 'metamorphoses-tour-v9.mp4'
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', work + 'f%04d.jpg', '-t', String(SECS), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:in_range=full:out_range=limited,format=yuv420p',
  '-c:v', 'libx264', '-crf', '21', '-maxrate', '12M', '-bufsize', '24M', '-preset', 'medium', '-movflags', '+faststart', '-an', out])
rmSync(work, { recursive: true, force: true })
console.log('wrote', out)
