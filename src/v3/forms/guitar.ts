// FORM "guitar" — an acoustic guitar (dreadnought proportions, 645 mm scale) tilted across the frame so it reads in two seconds:
// figure-eight body with cream binding, a sound hole ringed by a three-line rosette, rosewood bridge with bone saddle and pin dots,
// a neck with seventeen frets laid out by the real 12th-root-of-two rule and pearl inlays, a flared headstock with six tuners, and six
// strings (three wound, three plain). The six strings are standing waves: each is a fixed string, so its shape is a sum of sine modes
// (n pi s), the pluck is a triangle pulled at some point along it (mode n has amplitude sin(n pi p) / n^2), the higher modes die first,
// and the whole thing is blurred a little in time so the vibration shows as a soft envelope, not a strobe. The strings sound on arrival
// (a soft strum, drawn here and sung by 'sig.guitar') and whenever the pointer sweeps across them (src/audio/guitar.ts, Karplus-Strong).
// The top plate breathes a little with the energy in the strings, and the sound hole glows.
//
// Local frame: u along the neck from the tail of the body, v across it, z out of the soundboard. The layout of the form: neck up and
// to the right, face toward +z, fitted to about 7 units wide.
import * as THREE from 'three'
import type { FormDef } from './types'
import { H } from './ctx'
import { WAYPOINTS } from '../world/layout'
import { pluck } from '../../audio/guitar'

// ------------------------------------------------------------------ dimensions (1 unit ~ 143 mm)
const BODY_L = 3.64, SADDLE_U = 1.3, SCALE = 4.5, NUT_U = SADDLE_U + SCALE, HEAD_END = NUT_U + 0.95
const HOLE_U = 2.5, HOLE_R = 0.36
const OUTLINE: [number, number][] = [[0, 0], [0.03, 0.4], [0.1, 0.7], [0.2, 0.93], [0.45, 1.22], [0.9, 1.34], [1.4, 1.22], [1.8, 1.02], [2.05, 0.97], [2.4, 1.03], [2.8, 1.02], [3.15, 0.86], [3.45, 0.52], [3.64, 0.22]]
const depthAt = (u: number) => 0.62 + 0.17 * (1 - u / BODY_L)
/** half the width of the body at u (cubic Hermite through OUTLINE) */
function hw(u: number): number {
  const n = OUTLINE.length
  if (u <= 0) return 0
  if (u >= OUTLINE[n - 1][0]) return OUTLINE[n - 1][1]
  let i = 0; while (OUTLINE[i + 1][0] < u) i++
  const p0 = OUTLINE[Math.max(0, i - 1)], p1 = OUTLINE[i], p2 = OUTLINE[i + 1], p3 = OUTLINE[Math.min(n - 1, i + 2)]
  const h = p2[0] - p1[0], t = (u - p1[0]) / h, t2 = t * t, t3 = t2 * t
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0])) * h, m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0])) * h
  return Math.max(0, (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2)
}
const fretU = (n: number) => NUT_U - SCALE * (1 - Math.pow(2, -n / 12))
const FRET_END = fretU(17)
const neckHW = (u: number) => 0.15 + 0.08 * Math.min(1, Math.max(0, (NUT_U - u) / (NUT_U - FRET_END)))
const headHW = (u: number) => 0.17 + 0.1 * Math.pow((u - NUT_U) / 0.95, 0.8)

// ------------------------------------------------------------------ the fit: tilt and scale into the form box
const THETA = 0.38, CT = Math.cos(THETA), ST = Math.sin(THETA)
const fit = (() => {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
  const add = (u: number, v: number) => { const x = u * CT - v * ST, y = u * ST + v * CT; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  for (let u = 0; u <= BODY_L; u += 0.05) { add(u, hw(u)); add(u, -hw(u)) }
  add(HEAD_END, 0.3); add(HEAD_END, -0.3); add(HEAD_END - 0.3, 0.45); add(HEAD_END - 0.3, -0.45)
  const K = Math.min(7.2 / (x1 - x0), 4.7 / (y1 - y0))
  return { K, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
})()
/** local (u, v, z) -> form space */
function T(u: number, v: number, z: number): [number, number, number] {
  return [(u * CT - v * ST - fit.cx) * fit.K, (u * ST + v * CT - fit.cy) * fit.K, z * fit.K]
}
const VDIR: [number, number] = [-ST, CT]   // across the strings, in the plane of the soundboard

// ------------------------------------------------------------------ the strings
const N_STR = 6
const saddleV = (i: number) => (i - 2.5) * 0.115, nutV = (i: number) => (i - 2.5) * 0.05
const strPt = (i: number, s: number): [number, number, number] => [SADDLE_U + SCALE * s, saddleV(i) + (nutV(i) - saddleV(i)) * s, 0.075 - 0.03 * s]
/** the on-screen vibration rate of each string (Hz): the real ratios 82.5 : 110 : 146.7 : 196 : 246.7 : 330, scaled down so the eye can follow */
const F_VIS = [82.5, 110, 440 / 3, 196, 740 / 3, 330].map(f => (f / 82.5) * 1.5)
const AMP_MAX = 0.075
const strEnds = Array.from({ length: N_STR }, (_, i) => ({ a: T(...strPt(i, 0)), b: T(...strPt(i, 1)) }))

const uniforms = {
  u_guitar_t0: { value: new Array(N_STR).fill(-99) as number[] },
  u_guitar_amp: { value: new Array(N_STR).fill(0) as number[] },
  u_guitar_pp: { value: new Array(N_STR).fill(0.5) as number[] },
  u_guitar_f: { value: F_VIS as number[] },
  u_guitar_en: { value: 0 },
}
let curT = 0
const rm = () => typeof document !== 'undefined' && (document.documentElement.classList.contains('rm') || document.documentElement.classList.contains('reduced'))
/** pull string i: a = 0..1 of the maximum swing, p = where along it (0 saddle .. 1 nut) it is plucked, delay in seconds */
function vibrate(i: number, a: number, p: number, delay = 0) {
  uniforms.u_guitar_t0.value[i] = curT + delay
  uniforms.u_guitar_amp.value[i] = rm() ? 0 : AMP_MAX * Math.min(1, Math.max(0.15, a))
  uniforms.u_guitar_pp.value[i] = Math.min(0.85, Math.max(0.15, p))
}
function strumVisual(a = 0.55) { for (let i = 0; i < N_STR; i++) vibrate(i, a * (0.85 + 0.15 * (i / 5)), 0.3 + 0.04 * i, i * 0.045) }
if (typeof window !== 'undefined') (window as any).__guitar = { pluck: (i: number, a = 0.8) => { vibrate(i, a, 0.4); pluck(i, a) }, strum: (a = 0.6) => strumVisual(a), uniforms, get segs() { return screenSeg }, get live() { return live } }

// ------------------------------------------------------------------ pointer sweep: where the strings are on screen, and when the pointer crosses one
const guitarWp = WAYPOINTS.find(w => w.form === 'guitar')
const screenSeg = Array.from({ length: N_STR }, () => ({ ax: 0, ay: 0, bx: 0, by: 0 }))
let live = false, last: { x: number; y: number; t: number } | null = null
const cool = new Array(N_STR).fill(0)
const pv = new THREE.Vector3()
function toScreen(p: [number, number, number], cam: THREE.Camera, W: number, Hh: number): [number, number] {
  const pl = guitarWp?.place, s = pl?.scale ?? 1, yaw = pl?.yaw ?? 0, at = pl?.at ?? [0, 0, 0]
  const c = Math.cos(yaw), q = Math.sin(yaw), x = p[0] * s, y = p[1] * s, z = p[2] * s
  pv.set(c * x + q * z + at[0], y + at[1], -q * x + c * z + at[2]).project(cam)
  return [(pv.x * 0.5 + 0.5) * W, (-pv.y * 0.5 + 0.5) * Hh]
}
function segHit(px: number, py: number, qx: number, qy: number, s: { ax: number; ay: number; bx: number; by: number }): number {
  // intersection of the pointer's segment p->q with the string a->b; returns the position along the string (0..1) or -1
  const rx = qx - px, ry = qy - py, sx = s.bx - s.ax, sy = s.by - s.ay
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-6) return -1
  const t = ((s.ax - px) * sy - (s.ay - py) * sx) / den, u = ((s.ax - px) * ry - (s.ay - py) * rx) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? u : -1
}
function onMove(e: PointerEvent) {
  if ((window as unknown as { __guitarMesh?: boolean }).__guitarMesh) { last = null; return }   // the wooden guitar's own strings (cabinet/guitar.ts) take the sweep; this form is a faint dust behind them
  const now = performance.now()
  if (live && last && now - last.t < 300) {
    const dx = e.clientX - last.x, dy = e.clientY - last.y, dtm = Math.max(1, now - last.t), speed = Math.hypot(dx, dy) / dtm
    for (let i = 0; i < N_STR; i++) {
      if (now < cool[i]) continue
      const u = segHit(last.x, last.y, e.clientX, e.clientY, screenSeg[i])
      if (u < 0) continue
      cool[i] = now + 110
      const vel = Math.min(1, 0.22 + speed * 0.5)
      vibrate(i, vel, u)
      pluck(i, vel)
    }
  }
  last = { x: e.clientX, y: e.clientY, t: now }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', onMove, { passive: true })
  for (const ev of ['pointerdown', 'pointercancel']) window.addEventListener(ev, () => { last = null }, { passive: true })   // a new touch starts a new stroke
}
let arrived = false

// ------------------------------------------------------------------ build
const hole = T(HOLE_U, 0, 0)
const form: FormDef = {
  id: 'guitar',
  build(ctx, pos, col) {
    const n = ctx.count, rand = ctx.rand
    form.pointSize = 1.9 * Math.min(1.6, Math.pow(262144 / n, 0.35))
    let w = 0
    const put = (u: number, v: number, z: number, wd: number, r: number, g: number, b: number, a: number) => {
      const p = T(u, v, z); H.set(pos, col, w++, p[0], p[1], p[2], wd, r, g, b, a)
    }
    const cnt = (f: number) => Math.floor(n * f)
    // the outline as a loop, for binding and ribs
    const loop: [number, number][] = []
    for (let u = 0; u <= BODY_L; u += 0.02) loop.push([u, hw(u)])
    for (let u = BODY_L; u >= 0; u -= 0.02) loop.push([u, -hw(u)])
    const seg = loop.map((p, i) => { const q = loop[(i + 1) % loop.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) })
    const perim = seg.reduce((a, b) => a + b, 0)
    const onLoop = (f: number): [number, number, number] => {
      let d = f * perim, i = 0
      while (d > seg[i] && i < seg.length - 1) { d -= seg[i]; i++ }
      const p = loop[i], q = loop[(i + 1) % loop.length], t = d / (seg[i] || 1)
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, i]
    }
    const plate = (u: number, v: number) => Math.abs(v) < hw(u)
    const wood = (v: number) => 0.78 + 0.22 * Math.sin(v * 64 + Math.sin(v * 9) * 1.3)     // the grain of the spruce top runs along the neck

    // 1) soundboard (w = 1): amber spruce, with the hole left open
    for (let k = cnt(0.26); k > 0;) {
      const u = rand() * BODY_L, v = (rand() * 2 - 1) * 1.36
      if (!plate(u, v) || Math.hypot(u - HOLE_U, v) < HOLE_R + 0.02) continue
      const gr = wood(v)
      put(u, v, 0, 1, 0.96, 0.7, 0.4, (0.22 + 0.16 * gr) * (0.7 + 0.6 * rand())); k--
    }
    // 2) back plate, dimmer, and the ribs (the sides), deeper at the tail
    for (let k = cnt(0.07); k > 0;) {
      const u = rand() * BODY_L, v = (rand() * 2 - 1) * 1.36
      if (!plate(u, v)) continue
      put(u, v, -depthAt(u), 0, 0.72, 0.44, 0.24, 0.09 * (0.6 + 0.8 * rand())); k--
    }
    for (let k = cnt(0.1); k > 0; k--) {
      const f = onLoop(rand()), z = -rand() * depthAt(f[0])
      put(f[0], f[1], z, 0, 0.8, 0.5, 0.28, 0.2 * (0.6 + 0.8 * rand()))
    }
    // 3) binding: cream lines round the top edge (bright) and the back edge (dim)
    for (let k = cnt(0.035); k > 0; k--) { const f = onLoop(rand()); put(f[0], f[1], 0.004, 0, 1.0, 0.93, 0.76, 0.55 * (0.7 + 0.5 * rand())) }
    for (let k = cnt(0.015); k > 0; k--) { const f = onLoop(rand()); put(f[0], f[1], -depthAt(f[0]), 0, 0.95, 0.85, 0.65, 0.22) }
    // 4) rosette: three rings (the outer two bright, a pearl chequer between) and the hole's rim, which glows with the strings (w = 2)
    for (const [r, share, c] of [[0.385, 0.01, [1.0, 0.82, 0.5]], [0.43, 0.012, [0.7, 0.9, 1.0]], [0.47, 0.01, [1.0, 0.82, 0.5]]] as const) {
      for (let k = cnt(share); k > 0; k--) { const a = rand() * 6.2832; put(HOLE_U + Math.cos(a) * r, Math.sin(a) * r, 0.004, 2, c[0], c[1], c[2], 0.7 * (0.7 + 0.5 * rand())) }
    }
    for (let k = cnt(0.008); k > 0; k--) {   // pearl chequer
      const seg2 = Math.floor(rand() * 48), a = ((seg2 + rand() * 0.6) / 48) * 6.2832, r = 0.4 + 0.02 * rand() + (seg2 % 2) * 0.015
      put(HOLE_U + Math.cos(a) * r, Math.sin(a) * r, 0.004, 2, 0.95, 0.95, 1.0, 0.6)
    }
    for (let k = cnt(0.012); k > 0; k--) { const a = rand() * 6.2832; put(HOLE_U + Math.cos(a) * HOLE_R, Math.sin(a) * HOLE_R, -rand() * 0.09, 2, 1.0, 0.75, 0.45, 0.5) }
    // 5) bridge (rosewood), bone saddle, pins
    for (let k = cnt(0.016); k > 0; k--) {
      const u = SADDLE_U - 0.16 + rand() * 0.34, v = (rand() * 2 - 1) * 0.62
      const edge = Math.abs(v) / 0.62; if (edge > 1 - 0.18 * Math.pow(Math.abs(u - SADDLE_U) / 0.17, 2)) continue
      put(u, v, rand() * 0.07, 0, 0.68, 0.42, 0.3, 0.55 * (0.7 + 0.5 * rand()))
    }
    for (let k = cnt(0.004); k > 0; k--) put(SADDLE_U + (rand() - 0.5) * 0.02, (rand() * 2 - 1) * 0.33, 0.07 + rand() * 0.025, 3, 1.0, 0.97, 0.9, 0.85)
    for (let i = 0; i < N_STR; i++) for (let k = cnt(0.0012); k > 0; k--) { const a = rand() * 6.2832, r = 0.016 * Math.sqrt(rand()); put(SADDLE_U - 0.1 + Math.cos(a) * r, saddleV(i) + Math.sin(a) * r, 0.072, 3, 0.97, 0.95, 0.9, 0.85) }
    // 6) neck: dark fretboard, silver frets, pearl inlays, bone nut
    for (let k = cnt(0.06); k > 0; k--) {
      const u = FRET_END + rand() * (NUT_U - FRET_END), v = (rand() * 2 - 1) * neckHW(u)
      put(u, v, 0.03, 0, 0.55, 0.38, 0.3, 0.2 * (0.7 + 0.5 * rand()))
    }
    for (let k = cnt(0.02); k > 0; k--) {   // the neck's back and sides: it has some thickness
      const u = FRET_END + rand() * (HEAD_END - 0.95 - FRET_END), side = rand() < 0.5 ? -1 : 1
      put(u, side * neckHW(u), 0.03 - rand() * 0.15, 0, 0.7, 0.45, 0.28, 0.2)
    }
    for (let f = 1; f <= 17; f++) {
      const u = fretU(f), c = Math.floor(cnt(0.04) / 17)
      for (let k = 0; k < c; k++) put(u + (rand() - 0.5) * 0.012, (rand() * 2 - 1) * neckHW(u), 0.035, 3, 0.85, 0.9, 1.0, 0.3 * (0.7 + 0.5 * rand()))
    }
    for (const f of [3, 5, 7, 9, 15, 17, 12]) {
      const u = (fretU(f) + fretU(f - 1)) / 2, offs = f === 12 ? [-0.06, 0.06] : [0]
      for (const o of offs) for (let k = cnt(0.0012); k > 0; k--) { const a = rand() * 6.2832, r = 0.028 * Math.sqrt(rand()); put(u + Math.cos(a) * r, o + Math.sin(a) * r, 0.036, 3, 1, 1, 1, 0.85) }
    }
    for (let k = cnt(0.003); k > 0; k--) put(NUT_U + (rand() - 0.5) * 0.04, (rand() * 2 - 1) * 0.16, 0.03 + rand() * 0.03, 3, 1.0, 0.97, 0.9, 0.5)
    // 7) headstock, tuners, the strings' runs to the posts
    for (let k = cnt(0.03); k > 0; k--) {
      const u = NUT_U + rand() * 0.95, v = (rand() * 2 - 1) * headHW(u)
      put(u, v, -0.03 * ((u - NUT_U) / 0.95), 0, 0.62, 0.42, 0.3, 0.3 * (0.7 + 0.5 * rand()))
    }
    const posts: [number, number][] = []
    for (let i = 0; i < 6; i++) { const side = i < 3 ? 1 : -1, row = i < 3 ? i : 5 - i; posts.push([NUT_U + 0.22 + row * 0.25, side * 0.115]) }
    for (let i = 0; i < 6; i++) {
      const [pu, pv] = posts[i], side = Math.sign(pv)
      for (let k = cnt(0.0022); k > 0; k--) { const a = rand() * 6.2832, r = 0.03 * Math.sqrt(rand()); put(pu + Math.cos(a) * r, pv + Math.sin(a) * r, 0.02, 3, 0.9, 0.93, 1.0, 0.7) }
      for (let k = cnt(0.0018); k > 0; k--) put(pu, pv + side * (0.03 + rand() * (headHW(pu) - 0.03 + 0.04)), -0.02 - rand() * 0.03, 3, 0.8, 0.84, 0.9, 0.5)
      for (let k = cnt(0.0016); k > 0; k--) { const a = rand() * 6.2832, r = 0.04 * Math.sqrt(rand()); put(pu + Math.cos(a) * r * 0.9, pv + side * (headHW(pu) + 0.06) + Math.sin(a) * r, -0.035, 3, 0.96, 0.92, 0.82, 0.5) }
      const sv = nutV(i); const c = cnt(0.002)
      for (let k = 0; k < c; k++) { const s = rand(); put(NUT_U + (pu - NUT_U) * s, sv + (pv - sv) * s, 0.045 - 0.025 * s, 0, 0.85, 0.9, 1.0, 0.28) }
    }
    // 8) the six strings: w = 100 + string + 0.99 s. Bass strings are wound (bronze), the treble three plain steel.
    for (let i = 0; i < N_STR; i++) {
      const c = i < 3 ? [1.0, 0.74, 0.46] : [0.86, 0.93, 1.0], count = cnt(0.0135)
      for (let k = 0; k < count; k++) {
        const s = (k + rand()) / count, p = strPt(i, s), j = 0.003 * (i < 3 ? 1.4 : 0.8)
        put(p[0], p[1] + (rand() - 0.5) * j, p[2] + (rand() - 0.5) * j, 100 + i + s * 0.99, c[0], c[1], c[2], i < 3 ? 0.42 : 0.36)
      }
    }
    // 9) a faint dust of amber behind the instrument
    H.dust(pos, col, w, n, rand, 6.5, 0.04, [0.9, 0.7, 0.45])
    for (let i = w; i < n; i++) pos[i * 4 + 3] = 4
  },
  uniforms,
  glsl: /* glsl */ `
uniform float u_guitar_t0[6]; uniform float u_guitar_amp[6]; uniform float u_guitar_pp[6]; uniform float u_guitar_f[6]; uniform float u_guitar_en;
vec3 anim_guitar(vec3 p, vec4 d, vec4 r, float t) {
  float w = d.w;
  if (w >= 99.5) {
    int i = int(floor(w - 100.0 + 0.01));
    float s = clamp(fract(w) / 0.99, 0.0, 1.0);
    float disp = 0.003 * sin(t * 1.3 + float(i) * 1.7) * sin(3.14159 * s);     // sympathetic shimmer, always there
    float tt = t - u_guitar_t0[i] + (r.x - 0.5) * 0.024;                       // a touch of temporal blur
    if (tt > 0.0 && tt < 5.0) {
      float A = u_guitar_amp[i], pp = u_guitar_pp[i];
      for (int n = 1; n <= 4; n++) {
        float fn = float(n);
        float a = sin(fn * 3.14159 * pp) / (fn * fn);
        float om = 6.28318 * u_guitar_f[i] * fn * (1.0 + 0.0007 * fn * fn);
        disp += A * a * sin(fn * 3.14159 * s) * cos(om * tt) * exp(-tt * (0.5 + 0.5 * fn));
      }
    }
    p += vec3(${VDIR[0].toFixed(5)}, ${VDIR[1].toFixed(5)}, 0.0) * disp + vec3(0.0, 0.0, 0.5) * disp;
  } else if (w > 0.5 && w < 1.5) {
    // the top plate breathes with the energy in the strings
    float dh = length(p.xy - vec2(${hole[0].toFixed(4)}, ${hole[1].toFixed(4)}));
    p.z += u_guitar_en * 0.018 * sin(t * 9.0 - dh * 7.0) * exp(-dh * 0.5);
  }
  return p;
}
float size_guitar(vec4 d, vec4 r, float t) {
  float w = d.w;
  if (w >= 99.5) return 1.05;
  if (w > 1.5 && w < 2.5) return 0.9;
  if (w > 2.5 && w < 3.5) return 1.15;
  if (w > 0.5 && w < 1.5) return 0.9;
  return 0.85;
}
vec4 color_guitar(vec4 c, vec4 d, vec4 r, float t) {
  float w = d.w;
  if (w >= 99.5) {
    int i = int(floor(w - 100.0 + 0.01));
    float tt = t - u_guitar_t0[i];
    float flash = tt > 0.0 ? exp(-tt * 2.2) * clamp(u_guitar_amp[i] / ${AMP_MAX.toFixed(3)}, 0.0, 1.0) : 0.0;
    c.rgb = mix(c.rgb, vec3(1.0, 0.97, 0.9), flash * 0.6);
    c.a *= 1.0 + 1.6 * flash;
  } else if (w > 1.5 && w < 2.5) {
    c.a *= 1.0 + u_guitar_en * 2.2 + 0.12 * sin(t * 1.4 + r.y * 6.0);
    c.rgb = mix(c.rgb, vec3(1.0, 0.85, 0.55), u_guitar_en * 0.5);
  } else if (w > 2.5 && w < 3.5) {
    c.a *= 0.8 + 0.2 * step(0.97, fract(r.w * 91.0 + t * 0.11)) * 4.0;
  }
  return c;
}`,
  camera: { pos: [0, 0.3, 10.5], target: [0, 0, 0], fov: 35 },
  pointSize: 1.9,
  drift: 0.006,
  update(t) {
    curT = t
    let en = 0
    for (let i = 0; i < N_STR; i++) { const tt = t - uniforms.u_guitar_t0.value[i]; if (tt > 0) en = Math.max(en, (uniforms.u_guitar_amp.value[i] / AMP_MAX) * Math.exp(-tt * 1.3)) }
    uniforms.u_guitar_en.value = en
    const v3 = (window as any).__v3, field = v3?.field, sh = field?.shown as { a: string; b: string; mix: number } | undefined
    const here = !!sh && ((sh.b === 'guitar' && sh.mix > 0.85) || (sh.a === 'guitar' && sh.mix < 0.15))
    live = here && !!field?.camera
    if (here && !arrived) { arrived = true; strumVisual() }
    if (!sh || (sh.b !== 'guitar' && sh.a !== 'guitar') || (sh.a !== 'guitar' && sh.mix < 0.4)) arrived = false
    if (live) {
      const W = innerWidth, Hh = innerHeight
      for (let i = 0; i < N_STR; i++) {
        const [ax, ay] = toScreen(strEnds[i].a, field.camera, W, Hh), [bx, by] = toScreen(strEnds[i].b, field.camera, W, Hh)
        const sg = screenSeg[i]; sg.ax = ax; sg.ay = ay; sg.bx = bx; sg.by = by
      }
    }
  },
}
export default form
