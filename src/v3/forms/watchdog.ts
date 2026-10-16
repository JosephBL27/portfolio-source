// WATCHDOG: the Job Watchdog as a radar scope. A phosphor disc seen from above at an angle, range rings
// and a 24-tick bezel (24 checks, hourly), a bright beam sweeping clockwise once every 8 s and leaving
// a decaying phosphor wedge behind it. 24 blips, one per check: 20 on job outputs (mostly green-fresh,
// three amber-stale), 2 credential-age checks (hollow rings) and 2 paused jobs (dim, slow blink). Each
// blip flashes and sends a ping ring when the beam crosses it; a strip of 24 cells at the foot of the
// scope lights in the same order. Disc-local coordinates; the tilt is applied in GLSL.
//
// pos.w classes: 0 dust  1 phosphor field  2 rings/crosshair  3 blip (+angle)  4 beam  5 ping (+angle)
//   6 bezel/strip frame  7 strip cell (+angle)  8 hub  9 clutter speckle  10 halo
//   11 paused blip (+angle)  12 credential ring (+angle)  13 heartbeat trace under the strip.  angle = atan2(y,x) in [0,2pi) / 2pi * 0.999
//
// HEARTBEAT (w12): each time the beam crosses a blip, an ECG-style pulse (P, QRS, T) runs outward along the strip from that blip's cell, drawn as a
// trace of dots under the cells, and the blip's ping ring flares. Every pose is a pure function of the shader time t (the 24 crossing phases are baked
// into the GLSL as constants, so there is no state). One uniform, u_watchdog_pulse, switches the whole thing off for reduced motion (a flat, static trace).
// The pointer layer (world/extras/stages/watchdog.ts) reads blipsLocal() / blipWorld() and drives u_watchdog_hi (the hovered blip) and
// u_watchdog_pc / _pt (a clicked blip re-fires its flash and ping from that moment).
import type { FormDef } from './types'
import { H, makeCtx } from './ctx'

const TAU = Math.PI * 2, RS = 2.35, OMEGA = TAU / 8, TX = -0.92, TY = 0.12
const GREEN = [0.25, 1.0, 0.5], AMBER = [1.0, 0.7, 0.2], PAUSED = [0.55, 0.66, 0.85]
const SY = -2.95, PXs = 0.19, TRACE_Y = SY - 0.4, ECG_V = 3.3
export type BlipKind = 'job' | 'cred' | 'pause'
export interface Blip { x: number; y: number; kind: BlipKind; amber: boolean; /** encoded angle (the fract of pos.w), 0..0.999 */ code: number; /** seconds into the 8 s sweep when the beam crosses it */ cross: number; /** its cell on the strip, in beam order */ cell: number }

/** the 24 blips: Poisson-ish placement, 20 job + 2 credential + 2 paused. Deterministic: the first thing the form's seeded rand draws. */
function layoutBlips(rand: () => number): Blip[] {
  const blips: Blip[] = []
  const place = (kind: BlipKind, r0: number, r1: number, n: number, minD: number) => {
    for (let i = 0, g = 0; i < n && g < 4000; g++) {
      const r = RS * (r0 + (r1 - r0) * Math.sqrt(rand())), a = rand() * TAU, x = r * Math.cos(a), y = r * Math.sin(a)
      if (blips.some(b => Math.hypot(b.x - x, b.y - y) < minD)) continue
      blips.push({ x, y, kind, amber: false, code: 0, cross: 0, cell: 0 }); i++
    }
  }
  place('job', 0.4, 0.93, 20, 0.5); place('cred', 0.25, 0.4, 2, 0.5); place('pause', 0.1, 0.22, 2, 0.4)
  const jobs = blips.filter(b => b.kind === 'job')
  for (const k of [2, 9, 15]) if (jobs[k]) jobs[k].amber = true
  for (const b of blips) {
    let a = Math.atan2(b.y, b.x); if (a < 0) a += TAU
    b.code = a / TAU * 0.999
    b.cross = ((((Math.PI / 2 - Math.atan2(b.y, b.x)) % TAU) + TAU) % TAU) / OMEGA
  }
  ;[...blips].sort((p, q) => p.cross - q.cross).forEach((b, i) => { b.cell = i })
  return blips
}
let cached: Blip[] | null = null
/** the blips in disc-local coordinates (the same layout the build draws: replayed from the form's own seed) */
export function blipsLocal(): Blip[] { return cached ?? (cached = layoutBlips(makeCtx('watchdog', 1).rand)) }
/** a blip's resting position after the form's tilt (what the vertex shader's wd_tilt does), in form space */
export function blipForm(b: Blip, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const z0 = 0.03, ca = Math.cos(TX), sa = Math.sin(TX), cb = Math.cos(TY), sb = Math.sin(TY)
  const y1 = b.y * ca - z0 * sa, z1 = b.y * sa + z0 * ca
  out[0] = b.x * cb + z1 * sb; out[1] = y1; out[2] = -b.x * sb + z1 * cb
  return out
}
/** a blip's position in the world for a waypoint placement ({ at, yaw, scale }: the shader's place()) */
export function blipWorld(b: Blip, pl: { at: readonly number[]; yaw?: number; scale?: number }, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const p = blipForm(b, out), s = pl.scale ?? 1, yaw = pl.yaw ?? 0, c = Math.cos(yaw), q = Math.sin(yaw), x = p[0] * s, y = p[1] * s, z = p[2] * s
  out[0] = c * x + q * z + pl.at[0]; out[1] = y + pl.at[1]; out[2] = -q * x + c * z + pl.at[2]
  return out
}
/** plain words for a blip's state, for the pointer's tip (no digits, no job names) */
export function blipState(b: Blip): { key: 'fresh' | 'stale' | 'paused' | 'credential'; words: string } {
  if (b.kind === 'pause') return { key: 'paused', words: 'Paused' }
  if (b.kind === 'cred') return { key: 'credential', words: 'Credential check' }
  return b.amber ? { key: 'stale', words: 'Stale: its output is late' } : { key: 'fresh', words: 'Fresh: made what it should this hour' }
}

/** live uniforms (shared objects: the pointer layer writes .value). pulse 0 = no heartbeat (reduced motion); hi = encoded angle of the hovered blip or -1; pc / pt = a clicked blip's code and the time of the click, cx = its strip cell's x */
const rmNow = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || (typeof document !== 'undefined' && document.documentElement.classList.contains('rm'))
export const watchdogUniforms = { pulse: { value: rmNow() ? 0 : 1 }, hi: { value: -1 }, pc: { value: -1 }, pt: { value: -99 }, cx: { value: 0 } }

const trace = blipsLocal()
const cellOf = (): { cw: number[]; cx: number[] } => {
  const cw = new Array(24).fill(0), cx = new Array(24).fill(0)
  for (const b of trace) { cw[b.cell] = b.cross; cx[b.cell] = (b.cell - 11.5) * PXs }
  return { cw, cx }
}
const CELLS = cellOf()
const f5 = (n: number) => n.toFixed(5)

const form: FormDef = {
  id: 'watchdog',
  build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const boost = Math.pow(262144 / N, 0.8)
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, c: number[], a: number) => { if (idx < N) H.set(pos, col, idx++, x, y, z, w, c[0], c[1], c[2], a * boost) }
    const take = (f: number) => Math.max(1, Math.floor(f * N))
    const ang = (x: number, y: number) => { let a = Math.atan2(y, x); if (a < 0) a += TAU; return a / TAU * 0.999 }
    const PH = [0.85, 1.0, 0.9], DIM = [0.35, 0.8, 0.5]

    // ---- blips: 20 job + 2 credential + 2 paused (layoutBlips: the first thing the seeded rand draws) ----
    const blips = layoutBlips(rand)
    const colOf = (b: Blip) => b.kind === 'pause' ? PAUSED : b.amber ? AMBER : GREEN

    // ---- phosphor field: the whole disc ----
    const nField = take(0.45)
    for (let i = 0; i < nField; i++) { const r = RS * Math.sqrt(rand()), a = rand() * TAU; put(r * Math.cos(a), r * Math.sin(a), 0, 1, PH, 0.034) }
    // ---- range rings, crosshair, spokes ----
    ;[0.25, 0.5, 0.75].forEach(f => { for (let i = 0; i < take(0.0095 * f / 0.5 + 0.004); i++) { const a = rand() * TAU, r = RS * f + (rand() - 0.5) * 0.006; put(r * Math.cos(a), r * Math.sin(a), 0.01, 2, DIM, 0.4) } })
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12, major = k % 3 === 0; for (let i = 0; i < take(major ? 0.006 : 0.0028); i++) { const r = RS * rand(); put(r * Math.cos(a), r * Math.sin(a), 0.01, 2, DIM, major ? 0.3 : 0.16) } }
    // ---- bezel: double ring, 360 fine ticks, 24 major marks ----
    for (const [rr, a, n] of [[RS, 0.7, 0.014], [RS + 0.07, 0.4, 0.01], [RS + 0.2, 0.5, 0.01]] as [number, number, number][]) for (let i = 0; i < take(n); i++) { const t = rand() * TAU; put((rr + (rand() - 0.5) * 0.006) * Math.cos(t), (rr + (rand() - 0.5) * 0.006) * Math.sin(t), 0.02, 6, PH, a) }
    for (let k = 0; k < 360; k++) {
      const major = k % 15 === 0, mid = k % 5 === 0, a = k * TAU / 360, r0 = RS + 0.07, r1 = r0 + (major ? 0.13 : mid ? 0.07 : 0.035)
      for (let i = 0; i < (major ? 14 : mid ? 7 : 3) * (N / 262144 > 0.5 ? 1 : 1); i++) { const r = r0 + rand() * (r1 - r0); put(r * Math.cos(a), r * Math.sin(a), 0.02, 6, major ? [0.9, 1.0, 0.95] : DIM, major ? 0.8 : 0.4) }
    }
    // ---- hub ----
    for (let i = 0; i < take(0.0025); i++) { const a = rand() * TAU, r = 0.09 * Math.sqrt(rand()); put(r * Math.cos(a), r * Math.sin(a), 0.03, 8, [0.8, 1.0, 0.9], 0.8) }
    for (let i = 0; i < take(0.002); i++) { const a = rand() * TAU; put(0.14 * Math.cos(a), 0.14 * Math.sin(a), 0.03, 8, GREEN, 0.7) }
    // ---- beam: a bright spoke from the hub to the rim ----
    for (let i = 0; i < take(0.011); i++) put(RS * rand(), (rand() - 0.5) * 0.012, 0.04, 4, [0.85, 1.0, 0.92], 0.8)
    // ---- blips + pings ----
    const nB = Math.floor(take(0.065) / blips.length), nP = Math.floor(take(0.055) / blips.length)
    for (const b of blips) {
      const c = colOf(b), a = ang(b.x, b.y)
      if (b.kind === 'cred') {
        for (let i = 0; i < nB; i++) { const t = rand() * TAU; put(b.x + 0.075 * Math.cos(t), b.y + 0.075 * Math.sin(t), 0.03, 12 + a, c, 0.6) }
        for (let i = 0; i < Math.floor(nB * 0.3); i++) { const t = rand() * TAU, r = 0.03 * Math.sqrt(rand()); put(b.x + r * Math.cos(t), b.y + r * Math.sin(t), 0.03, 12 + a, c, 0.5) }
      } else if (b.kind === 'pause') {
        for (let i = 0; i < nB; i++) { const t = rand() * TAU, r = 0.055 * Math.sqrt(rand()); put(b.x + r * Math.cos(t), b.y + r * Math.sin(t), 0.03, 11 + a, c, 0.45) }
      } else {
        for (let i = 0; i < nB; i++) { const t = rand() * TAU, r = 0.045 * Math.sqrt(-2 * Math.log(1 - rand() * 0.98)) * 0.7; put(b.x + r * Math.cos(t), b.y + r * Math.sin(t), 0.03, 3 + a, c, 0.5) }
      }
      if (b.kind !== 'pause') for (let i = 0; i < nP; i++) put(b.x, b.y, 0.02, 5 + a, c, 0.6)
    }
    // ---- status strip: 24 cells in beam order ----
    const order = [...blips].sort((p, q) => p.cell - q.cell).map(b => ({ b }))
    for (let i = 0; i < 24; i++) {
      const b = order[i].b, c = colOf(b), a = ang(b.x, b.y), cx = (i - 11.5) * PXs
      for (let j = 0; j < take(0.0017); j++) put(cx + (rand() - 0.5) * 0.15, SY + (rand() - 0.5) * 0.15, 0.02, 7 + a, c, 0.18)
      for (let j = 0; j < take(0.0013); j++) { const u = rand() * 4 * 0.15; const e = Math.floor(u / 0.15), f = (u % 0.15) - 0.075; const x = e === 0 ? f : e === 1 ? 0.075 : e === 2 ? -f : -0.075, y = e === 0 ? -0.075 : e === 1 ? f : e === 2 ? 0.075 : -f; put(cx + x, SY + y, 0.02, 7 + a, c, 0.55) }
    }
    for (let i = 0; i < take(0.0045); i++) { const e = rand() < 0.5 ? -1 : 1; put(-12 * PXs + (e > 0 ? 24 * PXs : 0) + (rand() - 0.5) * 0.003, SY + (rand() - 0.5) * 0.24, 0.02, 6, DIM, 0.3) }
    // ---- heartbeat trace: a baseline of dots under the cells, displaced by the ECG in the shader ----
    for (let i = 0; i < take(0.02); i++) put((rand() - 0.5) * (24 * PXs + 0.6), TRACE_Y + (rand() - 0.5) * 0.012, 0.02, 13, [0.55, 1.0, 0.75], 0.28)
    // ---- clutter speckle, halo ----
    for (let i = 0; i < take(0.05); i++) { const r = RS * 0.98 * Math.sqrt(rand()), a = rand() * TAU; put(r * Math.cos(a), r * Math.sin(a), 0.03, 9, [0.5, 1.0, 0.7], 0.5) }
    for (let i = 0; i < take(0.04); i++) { const r = RS * (1.15 + 0.5 * Math.pow(rand(), 1.5)), a = rand() * TAU; put(r * Math.cos(a), r * Math.sin(a), -0.05, 10, [0.3, 0.85, 0.6], 0.03) }
    // ---- dust ----
    H.dust(pos, col, idx, N, rand, 6.5, 0.07 * boost, [0.5, 0.95, 0.75])
    for (let i = idx; i < N; i++) pos[i * 4 + 3] = 0
  },
  glsl: /* glsl */ `
const float WD_TAU = 6.2831853;
const float WD_W = ${OMEGA.toFixed(5)};
const float WD_RS = ${RS.toFixed(3)};
const float WD_CW[24] = float[24](${CELLS.cw.map(f5).join(', ')});
const float WD_CX[24] = float[24](${CELLS.cx.map(f5).join(', ')});
uniform float u_watchdog_pulse; uniform float u_watchdog_hi; uniform float u_watchdog_pc; uniform float u_watchdog_pt; uniform float u_watchdog_cx;
float wd_beam(float t) { return 1.5707963 - WD_W * t; }
float wd_behind(float th, float t) { return mod(th - wd_beam(t), WD_TAU); }
vec3 wd_tilt(vec3 q) {
  float ca = cos(${TX}), sa = sin(${TX});
  q = vec3(q.x, q.y * ca - q.z * sa, q.y * sa + q.z * ca);
  float cb = cos(${TY}), sb = sin(${TY});
  return vec3(q.x * cb + q.z * sb, q.y, -q.x * sb + q.z * cb);
}
float wd_ang(float w) { return fract(w + 0.0) / 0.999 * WD_TAU; }
// seconds since the beam last crossed this blip; a clicked blip counts from the click when that is more recent
float wd_since(float w, float t) {
  float s = wd_behind(wd_ang(w), t) / WD_W;
  if (u_watchdog_pc >= 0.0 && abs(fract(w) - u_watchdog_pc) < 0.0004) { float s2 = t - u_watchdog_pt; if (s2 >= 0.0 && s2 < 6.0) s = min(s, s2); }
  return s;
}
float wd_isc(float w, float code) { return code >= 0.0 && abs(fract(w) - code) < 0.0004 ? 1.0 : 0.0; }
// one heartbeat: P, Q, R, S, T as gaussians; u = distance behind the front that carries it
float wd_g(float u, float c, float w) { float x = (u - c) / w; return exp(-x * x); }
float wd_beat(float u) { return 0.16 * wd_g(u, 0.2, 0.09) - 0.1 * wd_g(u, 0.5, 0.03) + 0.66 * wd_g(u, 0.58, 0.032) - 0.22 * wd_g(u, 0.67, 0.032) + 0.2 * wd_g(u, 1.04, 0.14); }
// the strip's trace: every cell launches a beat when the beam crosses its blip; the beat runs outward both ways at ${ECG_V} units a second and fades with age and distance
vec2 wd_trace(float x, float t) {
  float y = 0.0, e = 0.0;
  for (int i = 0; i < 24; i++) {
    float age = mod(t - WD_CW[i], 8.0), d = abs(x - WD_CX[i]), u = ${ECG_V.toFixed(2)} * age - d;
    if (u > 0.0 && u < 1.7) { float b = wd_beat(u) * exp(-d * 0.38 - age * 1.8); y += b; e += abs(b); }
  }
  if (u_watchdog_pc >= 0.0) {
    float age = t - u_watchdog_pt, d = abs(x - u_watchdog_cx), u = ${ECG_V.toFixed(2)} * age - d;
    if (age >= 0.0 && u > 0.0 && u < 1.7) { float b = 1.25 * wd_beat(u) * exp(-d * 0.3 - age * 1.4); y += b; e += abs(b); }
  }
  return vec2(y * 0.95, e) * u_watchdog_pulse;
}
vec3 anim_watchdog(vec3 p, vec4 d, vec4 r, float t) {
  float w = d.w, cl = floor(w + 0.001);
  if (cl < 0.5) return p + 0.06 * vec3(sin(t * 0.21 + r.x * 40.0), sin(t * 0.17 + r.y * 40.0), sin(t * 0.13 + r.z * 40.0));
  if (cl > 3.5 && cl < 4.5) {
    float b = wd_beam(t), c = cos(b), s = sin(b);
    return wd_tilt(vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z));
  }
  if (cl > 4.5 && cl < 5.5) {
    float since = wd_since(w, t);
    float rad = 0.02 + min(since, 1.6) * 0.34;
    float a = r.x * WD_TAU;
    return wd_tilt(vec3(p.x + cos(a) * rad, p.y + sin(a) * rad, p.z));
  }
  if (cl > 6.5 && cl < 7.5) {
    float since = wd_since(w, t);
    float lift = since < 0.8 ? 0.07 * exp(-since * 5.0) : 0.0;
    return wd_tilt(vec3(p.x, p.y, p.z + lift));
  }
  if (cl > 9.5 && cl < 10.5) return wd_tilt(p + 0.03 * vec3(sin(t * 0.3 + r.x * 40.0), sin(t * 0.25 + r.y * 40.0), 0.0));
  if (cl > 12.5 && cl < 13.5) return wd_tilt(vec3(p.x, p.y + wd_trace(p.x, t).x, p.z));
  return wd_tilt(p);
}
float size_watchdog(vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl < 0.5) return 1.3;
  if (cl < 1.5) return 1.25;
  if (cl > 3.5 && cl < 4.5) return 1.5;
  if ((cl > 2.5 && cl < 3.5) || (cl > 10.5 && cl < 13.0)) return (cl > 2.5 && cl < 3.5 ? 1.5 : 1.0) * (1.0 + 0.7 * wd_isc(d.w, u_watchdog_hi));
  if (cl > 8.5 && cl < 9.5) return 1.1;
  if (cl > 12.5 && cl < 13.5) return 1.25;
  return 1.0;
}
vec4 color_watchdog(vec4 c, vec4 d, vec4 r, float t) {
  float w = d.w, cl = floor(w + 0.001);
  vec3 rgb = c.rgb; float a = c.a;
  if (cl < 0.5) return vec4(rgb, a * (0.6 + 0.4 * sin(t * (0.5 + r.x) + r.y * 30.0)));
  if (cl < 1.5) {
    float th = atan(d.y, d.x), bh = wd_behind(th, t);
    float tr = exp(-bh * 1.9), edge = exp(-bh * 60.0);
    float rad = length(d.xy) / WD_RS;
    float tw = 0.75 + 0.25 * sin(t * 3.0 + r.x * 60.0);
    rgb = mix(vec3(0.25, 0.9, 0.5), vec3(0.7, 1.0, 0.8), edge);
    return vec4(rgb, a * (0.5 + 15.0 * tr * tw * (0.6 + 0.6 * rad) + 8.0 * edge));
  }
  if (cl > 1.5 && cl < 2.5) { float th = atan(d.y, d.x), bh = wd_behind(th, t); return vec4(rgb, a * (0.7 + 1.8 * exp(-bh * 2.2))); }
  if ((cl > 2.5 && cl < 3.5) || (cl > 10.5 && cl < 13.0)) {
    float since = wd_since(w, t);
    float fl = exp(-since * 0.75);
    float hi = wd_isc(w, u_watchdog_hi);
    float amber = step(0.8, rgb.r) * step(rgb.b, 0.3);
    float slow = cl > 10.5 && cl < 11.5 ? 0.35 + 0.65 * (0.5 + 0.5 * sin(t * 1.1 + d.x * 5.0)) * 0.6 : 1.0;
    float stale = amber * 0.4 * sin(t * 3.0 + d.x * 7.0);
    float k = cl > 10.5 && cl < 11.5 ? 0.6 : 1.0;
    return vec4(mix(rgb, vec3(1.0), clamp(fl * 0.55 * k + 0.35 * hi, 0.0, 1.0)), a * slow * (0.35 + 3.4 * fl * k + stale + 1.6 * hi));
  }
  if (cl > 3.5 && cl < 4.5) return vec4(rgb, a * (0.75 + 0.25 * sin(t * 40.0 + r.x * 20.0)));
  if (cl > 4.5 && cl < 5.5) {
    float since = wd_since(w, t);
    float vis = since < 2.0 ? exp(-since * 2.2) * smoothstep(0.0, 0.04, since) : 0.0;
    float flare = 1.0 + u_watchdog_pulse * 1.7 * exp(-since * 4.5);
    return vec4(mix(rgb, vec3(1.0), clamp(0.5 * (flare - 1.0), 0.0, 0.6)), a * vis * 1.6 * flare);
  }
  if (cl > 5.5 && cl < 6.5) { float th = atan(d.y, d.x), bh = wd_behind(th, t); return vec4(rgb, a * (0.65 + 1.2 * exp(-bh * 4.0))); }
  if (cl > 6.5 && cl < 7.5) {
    float since = wd_since(w, t);
    float fl = exp(-since * 0.6);
    float hi = wd_isc(w, u_watchdog_hi);
    return vec4(mix(rgb, vec3(1.0), clamp(fl * 0.5 + 0.3 * hi, 0.0, 1.0)), a * (0.5 + 3.2 * fl + 2.0 * hi));
  }
  if (cl > 7.5 && cl < 8.5) return vec4(rgb, a * (0.8 + 0.4 * sin(t * 2.0)));
  if (cl > 8.5 && cl < 9.5) {
    float th = atan(d.y, d.x), bh = wd_behind(th, t);
    float tw = pow(0.5 + 0.5 * sin(t * (1.5 + r.x * 3.0) + r.y * 80.0), 6.0);
    return vec4(rgb, a * (0.06 + tw * (0.8 + 2.2 * exp(-bh * 1.6))));
  }
  if (cl > 9.5 && cl < 10.5) return vec4(rgb, a * (0.7 + 0.3 * sin(t * 0.6 + d.x)));
  if (cl > 12.5 && cl < 13.5) {
    vec2 tr = wd_trace(d.x, t);
    float edge = smoothstep(1.35, 2.2, abs(d.x)) ;
    return vec4(mix(rgb, vec3(1.0), clamp(tr.y * 1.4, 0.0, 0.8)), a * (0.6 + 9.0 * tr.y) * (1.0 - 0.8 * edge));
  }
  return vec4(rgb, a);
}`,
  uniforms: { u_watchdog_pulse: watchdogUniforms.pulse, u_watchdog_hi: watchdogUniforms.hi, u_watchdog_pc: watchdogUniforms.pc, u_watchdog_pt: watchdogUniforms.pt, u_watchdog_cx: watchdogUniforms.cx },
  camera: { pos: [0, 0.8, 9.6], target: [0, -0.7, 0.5], fov: 35 },
  pointSize: 1.9,
  drift: 0.006,
}
export default form
