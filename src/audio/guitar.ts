// A plucked steel-string acoustic from an extended Karplus-Strong / commuted-waveguide model. Synthesis, not samples: no download weight, the
// pitch is exact to the site's 60 Hz-ratio scheme, velocity and pick position are continuous, and there is no licence to carry.
//
// Tuning: standard (E2 A2 D3 G3 B3 E4), every string a simple ratio of the TV's 60 Hz hum (TUNING_HZ stays the reference), with a seeded
// +-0.8 cent detune between strings (TUNED_HZ), so the six never sit perfectly still against each other:
//   E2 82.5 = 60 x 11/8    A2 110 = 60 x 11/6    D3 146.67 = 60 x 22/9    G3 196 = 60 x 49/15    B3 246.67 = 60 x 37/9    E4 330 = 60 x 11/2
//
// One string, per polarisation (two per string, mixed 70/30; the second +0.6 cent and decaying 1.3x faster, which gives the slow beat and
// the two-stage decay):
//   excitation x[n]   velocity-shaped noise (one-pole lowpass, 1.2 kHz at v 0.1 up to 7 kHz at v 1) under a 2-6 ms attack, then
//                     the pick-position comb y[n] = x[n] - x[n - round(beta N)] (beta 0.11 hard .. 0.2 soft, three steps) and the
//                     pick-direction lowpass (1-p)/(1-p z^-1) (p 0.9 down-stroke, 0.5 up-stroke)
//   body              ONE impulse response per sample rate (12 decaying modes, T60 0.3 s low .. 0.03 s high, plus a 60 ms noise tail)
//                     convolved with the excitation BEFORE it enters the loop (Smith / Karjalainen commuted synthesis: the body costs
//                     nothing per sample once the pluck is rendered)
//   loop              integer delay + first-order Thiran allpass for the fraction, dispersion allpasses on the wound strings
//                     (2 on E2 A2 D3, 1 on G3, none on B3 E4; each coefficient is solved so partial 12 sits at its inharmonicity target),
//                     and a first-order pole-zero loop filter g (b0 + b1 z^-1) / (1 - p z^-1) fitted to two decay targets: T60 of the
//                     fundamental 6.5 s (E2) falling to 3.5 s (E4), and T60 at 4 kHz 0.35 s. (A pure one-pole cannot make the upper
//                     partials die 3x faster than the fundamental AND hit those two targets: the zero lets the loss grow roughly with
//                     frequency up to the shelf, as on a real string.) The loop length is corrected for the phase delay of every
//                     filter at f0, so the pitch stays exact.
//   output EQ         highpass 70 Hz, +1.5 dB at 2.2 kHz, -3 dB high shelf above 7 kHz, baked into the cached buffer
//
// Rendering is to cached AudioBuffers: velocity in 6 steps, pick position in 3 (it follows velocity), direction 2. Rendering is sliceable
// (<= 6 ms of idle time at a time); guitarWarm() pre-renders the common ones, and is called only once the flight is within 2 stops of the
// guitar. Nothing renders at boot. The engine voice adds a room send, a tiny early-reflection pair (8 and 13 ms, -14 dB) and the quiet
// sympathetic ring of the open strings that share a partial with the plucked one.
//
// Exports: pluck(string, velocity) and strum(velocity, dir) play through the site's sound engine (and do nothing while sound is off);
// vGuitarPluck / vGuitarStrum are the engine voices (src/audio/sfx.ts routes 'guitar:pluck' and 'sig.guitar' to them).
import { gain, out, clamp, lerp, db, type Eng } from './kit'

export const STRING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] as const
export const TUNING_HZ = [60 * 11 / 8, 60 * 11 / 6, 60 * 22 / 9, 60 * 49 / 15, 60 * 37 / 9, 60 * 11 / 2] as const

/** seeded noise so that the same string and velocity always render the same pluck (the offline level check stays repeatable) */
function prng(seed: number) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 * 2 - 1 } }

const detRand = prng(0x5eed17)
/** the seeded detune of each string, cents (|c| <= 0.8) */
export const DETUNE_CENTS: readonly number[] = TUNING_HZ.map(() => +(detRand() * 0.8).toFixed(2))
/** the pitch each string is actually rendered at: TUNING_HZ plus its seeded detune */
export const TUNED_HZ: readonly number[] = TUNING_HZ.map((f, i) => f * Math.pow(2, DETUNE_CENTS[i] / 1200))

// ------------------------------------------------------------------ constants
const K_DISP = [2, 2, 2, 1, 0, 0]                      // dispersion allpass sections per string
const DISP_CENTS12 = [12.4, 15, 18, 10, 0, 0]          // target sharpness of partial 12 against 12 f0 (inharmonicity B ~ 1e-4 .. 2e-4)
const T60_F0 = (si: number) => 6.5 - 3.0 * (si / 5)    // seconds for the fundamental to fall 60 dB: 6.5 (E2) .. 3.5 (E4)
const T60_4K = 0.35                                    // seconds for 4 kHz to fall 60 dB
const LOOP_FC = [1500, 1500, 1500, 1800, 2600, 3400]   // Hz: the corner of the loop filter's lowpass pole (higher on the plain strings, whose partials are not dispersed: the lowpass's own phase slope would stretch them)
const POL2_CENTS = 0.6, POL2_FAST = 1.3, POL_MIX = 0.7 // second polarisation: +0.6 cent, 1.3x faster decay, mixed 30%
const DURATION = (si: number) => 3.4 - 0.25 * si       // seconds rendered per string
const FADE_OUT = 0.3
const TARGET_RMS = 0.12                                // every cached buffer is normalised to this RMS over its first 0.4 s; the voice gain does the dynamics
/** the six velocity steps and the pick position that goes with each (hard = near the bridge) */
export const VEL_STEPS = [0.1, 0.27, 0.44, 0.61, 0.78, 0.95] as const
const PICK_BETA = [0.11, 0.155, 0.2] as const
const pickOf = (vi: number) => (vi >= 4 ? 0 : vi >= 2 ? 1 : 2)
const velIndex = (v: number) => clamp(Math.round((v - 0.1) / 0.17), 0, 5)
/** voice gain by velocity (the buffers are level-matched, so this is the whole dynamic range) */
export const pluckLevel = (v: number) => 0.2 + 0.8 * Math.pow(clamp(v, 0, 1), 1.3)

// ------------------------------------------------------------------ small filter maths (phase and magnitude, used to fit the loop)
/** phase (radians, negative) of the first-order allpass (a + z^-1) / (1 + a z^-1) */
function apPhase(a: number, w: number): number { const s = Math.sin(w), c = Math.cos(w); return Math.atan2(-s, a + c) - Math.atan2(-a * s, 1 + a * c) }
/** loop filter (g = 1): magnitude and phase of [(1 - m p) - p (1 - m) z^-1] / (1 - p z^-1) */
function lpResp(p: number, m: number, w: number): { mag: number; ph: number } {
  const c = Math.cos(w), s = Math.sin(w)
  const n1 = p * (1 - m), nr = (1 - m * p) - n1 * c, ni = n1 * s, dr = 1 - p * c, di = p * s
  return { mag: Math.hypot(nr, ni) / Math.hypot(dr, di), ph: Math.atan2(ni, nr) - Math.atan2(di, dr) }
}

interface Loop { N: number; a1: number; K: number; aD: number; g: number; b0: number; b1: number; p: number; T: number }

/** fit the loop filter: |H(f0)| gives the fundamental's T60, |H(4 kHz)| the upper one (bisection on the zero's weight m) */
function designLoop(sr: number, si: number, f0: number, t60f0: number, t604k: number): { g: number; m: number; p: number } {
  const p = Math.exp(-2 * Math.PI * LOOP_FC[si] / sr), w0 = 2 * Math.PI * f0 / sr, w4 = 2 * Math.PI * 4000 / sr
  const tgt0 = Math.pow(10, -3 / (t60f0 * f0)), tgt4 = Math.pow(10, -3 / (t604k * f0))
  const res = (m: number) => (tgt0 / lpResp(p, m, w0).mag) * lpResp(p, m, w4).mag - tgt4
  let lo = 0, hi = 0.98
  for (let i = 0; i < 44; i++) { const mid = (lo + hi) / 2; if (res(mid) > 0) lo = mid; else hi = mid }
  const m = (lo + hi) / 2
  return { g: tgt0 / lpResp(p, m, w0).mag, m, p }
}

/** the whole loop of one polarisation at pitch f0: the integer delay and Thiran allpass are set so that N + every filter's phase delay at f0 = sr / f0 */
function designPol(sr: number, si: number, aD: number, centsOff: number, fast: number): Loop {
  const f0 = TUNED_HZ[si] * Math.pow(2, centsOff / 1200), T = sr / f0, w0 = 2 * Math.PI / T, K = K_DISP[si]
  const lp = designLoop(sr, si, f0, T60_F0(si) / fast, T60_4K / fast)
  const tauLP = -lpResp(lp.p, lp.m, w0).ph / w0
  const tauAP = K * (-apPhase(aD, w0) / w0)
  const rest = T - tauLP - tauAP
  const N = Math.max(2, Math.floor(rest - 0.6))
  const want = rest - N
  let D = want, a1 = 0
  for (let i = 0; i < 6; i++) { a1 = (1 - D) / (1 + D); D += want - (-apPhase(a1, w0) / w0) }
  return { N, a1, K, aD, g: lp.g, b0: 1 - lp.m * lp.p, b1: -lp.p * (1 - lp.m), p: lp.p, T }
}

/** frequency (in cents against n f0) of partial n of the loop `L` (every filter's phase included) */
function partialCents(sr: number, si: number, L: Loop, n: number): number {
  const f0 = TUNED_HZ[si], w0 = 2 * Math.PI * f0 / sr
  const F = (w: number) => w * L.N - apPhase(L.a1, w) - L.K * apPhase(L.aD, w) - phLoop(L, w) - 2 * Math.PI * n
  let lo = n * w0 * 0.9, hi = Math.min(3.0, n * w0 * 1.25)
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (F(mid) < 0) lo = mid; else hi = mid }
  return 1200 * Math.log2(((lo + hi) / 2) / (n * w0))
}
/** phase of the loop filter's pole-zero from its coefficients (b0, b1, p) */
function phLoop(L: Loop, w: number): number {
  const c = Math.cos(w), s = Math.sin(w), nr = L.b0 + L.b1 * c, ni = -L.b1 * s, dr = 1 - L.p * c, di = L.p * s
  return Math.atan2(ni, nr) - Math.atan2(di, dr)
}

interface Design { pol: [Loop, Loop]; aD: number }
const designCache = new Map<string, Design>()
/** per string and sample rate: the two polarisations' loops (cached). The dispersion coefficient is bisected until partial 12 is DISP_CENTS12 sharp. */
export function guitarDesign(sr: number, si: number): Design {
  const key = `${sr}:${si}`
  let d = designCache.get(key)
  if (d) return d
  let aD = 0
  if (K_DISP[si] > 0) {
    let lo = -0.985, hi = 0                                  // more negative = stiffer
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2
      const c = partialCents(sr, si, designPol(sr, si, mid, 0, 1), 12)
      if (c > DISP_CENTS12[si]) lo = mid; else hi = mid
    }
    aD = (lo + hi) / 2
  }
  d = { pol: [designPol(sr, si, aD, 0, 1), designPol(sr, si, aD, POL2_CENTS, POL2_FAST)], aD }
  designCache.set(key, d)
  return d
}
/** how sharp partial n of string si rings against n f0, in cents (the model's own prediction; the check measures the audio) */
export function modelPartialCents(sr: number, si: number, n: number): number { return partialCents(sr, si, guitarDesign(sr, si).pol[0], n) }

// ------------------------------------------------------------------ the body: one impulse response per sample rate
const BODY_MODES = [98, 110, 205, 230, 395, 470, 590, 720, 1100, 1700, 2500, 3300] as const
const BODY_PEAK = [1, 0.9, 0.7, 0.7, 0.5, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25] as const   // relative height of each resonance peak
const bodyCache = new Map<number, Float64Array>()
/** top plate, air and rib modes as decaying sinusoids (T60 0.3 s at 98 Hz falling to 0.03 s at 3.3 kHz, seeded phases) plus a 60 ms lowpassed noise tail. Energy 1. */
export function bodyImpulse(sr: number): Float64Array {
  const hit = bodyCache.get(sr)
  if (hit) return hit
  const L = Math.round(sr * 0.07), h = new Float64Array(L), rand = prng(0xb0d1)
  BODY_MODES.forEach((f, i) => {
    const t60 = 0.3 * Math.pow(f / 98, -0.655), amp = BODY_PEAK[i] / t60, ph = (rand() * 0.5 + 0.5) * 2 * Math.PI, k = 6.908 / t60
    for (let n = 0; n < L; n++) { const t = n / sr; h[n] += amp * Math.exp(-k * t) * Math.sin(2 * Math.PI * f * t + ph) }
  })
  let lp = 0; const a = Math.exp(-2 * Math.PI * 1800 / sr)
  for (let n = 0; n < L; n++) { const t = n / sr; lp = (1 - a) * rand() + a * lp; h[n] += 5.5 * lp * Math.exp(-6.908 * t / 0.06) }
  const fi = Math.round(sr * 0.012)                       // the last 12 ms fade, so the IR never ends on a step
  for (let n = 0; n < fi; n++) h[L - 1 - n] *= 0.5 - 0.5 * Math.cos(Math.PI * n / fi)
  let e = 0; for (let n = 0; n < L; n++) e += h[n] * h[n]
  const s = 1 / Math.sqrt(e); for (let n = 0; n < L; n++) h[n] *= s
  bodyCache.set(sr, h)
  return h
}

// ------------------------------------------------------------------ the excitation
/** velocity-shaped noise, attack, pick-position comb, pick-direction lowpass. Lengths are in samples at sr. */
function excitation(sr: number, si: number, vq: number, pick: number, dir: 1 | -1): Float64Array {
  const rand = prng(1000 + si * 77 + Math.round(vq * 100) + pick * 13 + (dir > 0 ? 0 : 5))
  const att = lerp(0.006, 0.002, clamp((vq - 0.1) / 0.85)), tau = 0.0025
  const Lx = Math.round(sr * (att + 4 * tau))
  const fc = 1200 * Math.pow(7000 / 1200, clamp((vq - 0.1) / 0.9))
  const a = Math.exp(-2 * Math.PI * fc / sr)
  const T = sr / TUNED_HZ[si], d = Math.max(1, Math.round(PICK_BETA[pick] * T))
  const x = new Float64Array(Lx + d + 80)
  let lp = 0
  for (let n = 0; n < Lx; n++) {
    lp = (1 - a) * rand() + a * lp
    const t = n / sr, env = t < att ? 0.5 - 0.5 * Math.cos(Math.PI * t / att) : Math.exp(-(t - att) / tau)
    x[n] = lp * env
  }
  const y = new Float64Array(x.length)
  const p = dir > 0 ? 0.9 : 0.5
  let z = 0
  for (let n = 0; n < x.length; n++) {
    const c = x[n] - (n >= d ? x[n - d] : 0)
    z = (1 - p) * c + p * z
    y[n] = z
  }
  return y
}

// ------------------------------------------------------------------ the output EQ (RBJ biquads, baked into the cached buffer)
type Bq = { b0: number; b1: number; b2: number; a1: number; a2: number }
function eqSections(sr: number): Bq[] {
  const mk = (type: 'hp' | 'pk' | 'hs', f: number, q: number, gdb: number): Bq => {
    const A = Math.pow(10, gdb / 40), w = 2 * Math.PI * f / sr, c = Math.cos(w), s = Math.sin(w)
    let b0, b1, b2, a0, a1, a2
    if (type === 'hp') { const al = s / (2 * q); b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al }
    else if (type === 'pk') { const al = s / (2 * q); b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A }
    else { const al = s / 2 * Math.SQRT2, r = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * c + r); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - r); a0 = (A + 1) - (A - 1) * c + r; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - r }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
  }
  return [mk('hp', 70, 0.7071, 0), mk('pk', 2200, 0.9, 1.5), mk('hs', 7000, 1, -3)]
}

// ------------------------------------------------------------------ the renderer (sliceable)
interface Pol { N: number; buf: Float64Array; pos: number; a1: number; aD: number; K: number; g: number; b0: number; b1: number; p: number
  tx: number; ty: number; x0: number; y0: number; x1: number; y1: number; lx: number; lw: number }
const mkPol = (L: Loop): Pol => ({ N: L.N, buf: new Float64Array(L.N), pos: 0, a1: L.a1, aD: L.aD, K: L.K, g: L.g, b0: L.b0, b1: L.b1, p: L.p, tx: 0, ty: 0, x0: 0, y0: 0, x1: 0, y1: 0, lx: 0, lw: 0 })
function stepPol(q: Pol, e: number): number {
  const d = q.buf[q.pos]
  let s = q.a1 * d + q.tx - q.a1 * q.ty; q.tx = d; q.ty = s
  if (q.K > 0) { const u = q.aD * s + q.x0 - q.aD * q.y0; q.x0 = s; q.y0 = u; s = u }
  if (q.K > 1) { const u = q.aD * s + q.x1 - q.aD * q.y1; q.x1 = s; q.y1 = u; s = u }
  const w = q.b0 * s + q.b1 * q.lx + q.p * q.lw; q.lx = s; q.lw = w
  const v = e + q.g * w
  q.buf[q.pos] = v; if (++q.pos === q.N) q.pos = 0
  return v
}

export interface RenderOpts { body?: boolean; eq?: boolean; raw?: boolean }
class Job {
  readonly y: Float32Array
  /** the AudioBuffer whose channel the render writes into (no second copy), when the caller wants a buffer */
  readonly buf: AudioBuffer | null
  private n = 0
  private q1: Pol; private q2: Pol
  private ex: Float64Array; private xin: Float64Array; private ir: Float64Array | null
  private eq: Bq[] | null; private z1: number[] = [0, 0, 0]; private z2: number[] = [0, 0, 0]
  private e2 = 0; private rmsN: number
  private raw: boolean
  constructor(readonly sr: number, si: number, xin: Float64Array, len: number, o: RenderOpts = {}, rmsSecs = 0.4, buf: AudioBuffer | null = null) {
    const d = guitarDesign(sr, si)
    this.q1 = mkPol(d.pol[0]); this.q2 = mkPol(d.pol[1])
    this.xin = xin
    this.ir = o.body === false ? null : bodyImpulse(sr)
    this.ex = this.ir ? new Float64Array(xin.length + this.ir.length - 1) : xin
    this.filled = this.ir ? 0 : this.ex.length
    this.buf = buf
    this.y = buf ? buf.getChannelData(0) : new Float32Array(len)
    this.eq = o.eq === false ? null : eqSections(sr)
    this.rmsN = Math.min(len, Math.round(sr * rmsSecs))
    this.raw = !!o.raw
  }
  private filled: number
  /** convolve the excitation with the body for output samples [filled, upto) */
  private fillEx(upto: number) {
    const ir = this.ir!, x = this.xin, ex = this.ex, Lx = x.length, Li = ir.length
    for (let n = this.filled; n < upto; n++) {
      let acc = 0
      const k0 = Math.max(0, n - Li + 1), k1 = Math.min(n, Lx - 1)
      for (let k = k0; k <= k1; k++) acc += x[k] * ir[n - k]
      ex[n] = acc
    }
    this.filled = Math.max(this.filled, upto)
  }
  private chunk(n0: number, n1: number) {
    const ex = this.ex, y = this.y, q1 = this.q1, q2 = this.q2, eq = this.eq
    if (this.ir && this.filled < Math.min(n1, ex.length)) this.fillEx(Math.min(n1, ex.length))
    for (let n = n0; n < n1; n++) {
      const e = n < ex.length ? ex[n] : 0
      let r = POL_MIX * stepPol(q1, e) + (1 - POL_MIX) * stepPol(q2, e)
      if (eq) for (let j = 0; j < 3; j++) { const b = eq[j], o = b.b0 * r + this.z1[j]; this.z1[j] = b.b1 * r - b.a1 * o + this.z2[j]; this.z2[j] = b.b2 * r - b.a2 * o; r = o }
      y[n] = r
      if (n < this.rmsN) this.e2 += r * r
    }
  }
  done = false
  /** run for about `ms` milliseconds; true when finished */
  step(ms: number): boolean {
    const t0 = performance.now(), len = this.y.length
    while (this.n < len) {
      const n1 = Math.min(len, this.n + 512)
      this.chunk(this.n, n1); this.n = n1
      if (performance.now() - t0 > ms && this.n < len) return false
    }
    if (!this.done) this.finish()
    return true
  }
  private finish() {
    const y = this.y, len = y.length, sr = this.sr
    const s = this.raw ? 1 : TARGET_RMS / Math.sqrt(this.e2 / Math.max(1, this.rmsN) + 1e-20)
    const fo = Math.min(len, Math.round(sr * FADE_OUT))
    for (let n = 0; n < len; n++) y[n] *= s
    for (let n = 0; n < fo; n++) y[len - 1 - n] *= 0.5 - 0.5 * Math.cos(Math.PI * n / fo)
    this.done = true
  }
  run(): Float32Array { while (!this.step(1e9)) { /* until done */ } return this.y }
}

function xinFor(sr: number, si: number, vi: number, dir: 1 | -1): Float64Array { return excitation(sr, si, VEL_STEPS[vi], pickOf(vi), dir) }
/** an empty mono AudioBuffer (made from a context when there is one; the constructor needs none, so the idle pre-render can run before any context is asked) */
function emptyBuffer(ctx: BaseAudioContext | null, sr: number, len: number): AudioBuffer {
  return ctx ? ctx.createBuffer(1, len, sr) : new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: sr })
}
/** a pluck render; `into` = null renders to a plain array (the test hook), otherwise into an AudioBuffer made from that context (or none) */
function jobFor(sr: number, si: number, vi: number, dir: 1 | -1, o: RenderOpts = {}, into: BaseAudioContext | null | false = false): Job {
  const len = Math.floor(sr * DURATION(si))
  return new Job(sr, si, xinFor(sr, si, vi, dir), len, o, 0.4, into === false ? null : emptyBuffer(into, sr, len))
}

/** the samples of one pluck (no AudioBuffer): the test hook. o.body = false drops the commuted body, o.raw = true skips level normalisation. */
export function pluckSamples(sr: number, string: number, velocity: number, dir: 1 | -1 = 1, o: RenderOpts = {}): Float32Array {
  const si = clamp(Math.round(string), 0, 5)
  return jobFor(sr, si, velIndex(velocity), dir, o).run()
}

// ------------------------------------------------------------------ sympathetic strings
interface Pair { from: number; to: number; freqs: { f: number; a: number }[] }
let pairs: Pair[] | null = null
/** for every ordered pair of open strings, the partials of the plucked one that land within +-12 cents of a partial of the other */
export function sympatheticPairs(): Pair[] {
  if (pairs) return pairs
  pairs = []
  for (let s = 0; s < 6; s++) for (let j = 0; j < 6; j++) {
    if (s === j) continue
    const freqs: { f: number; a: number }[] = []
    for (let m = 1; m <= 8; m++) for (let n = 1; n <= 8; n++) {
      const fs = m * TUNED_HZ[s], fj = n * TUNED_HZ[j]
      if (Math.abs(1200 * Math.log2(fs / fj)) <= 12) freqs.push({ f: (fs + fj) / 2, a: 1 / m })
    }
    if (freqs.length) pairs.push({ from: s, to: j, freqs })
  }
  return pairs
}
const SYM_SECS = 1.6
function symJob(sr: number, p: Pair): Job {
  const L = Math.round(sr * 0.3), x = new Float64Array(L), att = Math.round(sr * 0.04), rel = Math.round(sr * 0.05)
  for (let n = 0; n < L; n++) {
    const env = n < att ? 0.5 - 0.5 * Math.cos(Math.PI * n / att) : n > L - rel ? 0.5 - 0.5 * Math.cos(Math.PI * (L - n) / rel) : 1   // the 40 ms onset
    let v = 0; for (const q of p.freqs) v += q.a * Math.sin(2 * Math.PI * q.f * n / sr)
    x[n] = v * env * 0.05
  }
  const len = Math.floor(sr * SYM_SECS)
  return new Job(sr, p.to, x, len, { body: false }, 0.5, emptyBuffer(null, sr, len))
}

// ------------------------------------------------------------------ cache and AudioBuffers
const cache = new Map<string, AudioBuffer>()
const keyOf = (sr: number, si: number, vi: number, dir: number) => `${sr}:${si}:${vi}:${dir}`
/** One plucked string, rendered to a (cached) buffer. velocity 0..1 (6 steps), dir 1 = down-stroke (p 0.9), -1 = up-stroke (p 0.5). */
export function pluckBuffer(ctx: BaseAudioContext, string: number, velocity: number, dir: 1 | -1 = 1): AudioBuffer {
  const si = clamp(Math.round(string), 0, 5), vi = velIndex(velocity), d = dir < 0 ? -1 : 1
  const key = keyOf(ctx.sampleRate, si, vi, d)
  const hit = cache.get(key)
  if (hit) return hit
  const job = jobFor(ctx.sampleRate, si, vi, d, {}, ctx); job.run()
  cache.set(key, job.buf!)
  return job.buf!
}
const symCache = new Map<string, AudioBuffer>()
const symKey = (sr: number, p: Pair) => `${sr}:${p.from}>${p.to}`
function symBuffer(sr: number, p: Pair): AudioBuffer {
  const key = symKey(sr, p)
  let b = symCache.get(key)
  if (!b) { const j = symJob(sr, p); j.run(); b = j.buf!; symCache.set(key, b) }
  return b
}

// ------------------------------------------------------------------ engine voices
/** two early reflections, 8 and 13 ms, -14 dB each, panned apart; returns the node strings send into */
function makeRefl(e: Eng, pan: number): GainNode {
  const inp = gain(e, 1)
  for (const [ms, side] of [[8, -0.4], [13, 0.4]] as const) {
    const d = e.ctx.createDelay(0.05); d.delayTime.value = ms / 1000
    const g = gain(e, db(-14))
    inp.connect(d); d.connect(g); out(e, g, e.fx, { pan: clamp(pan + side, -1, 1) })
  }
  return inp
}
export interface PluckOpts { k?: number; dir?: 1 | -1; room?: number; sym?: boolean; refl?: GainNode }

/** One string, played through the engine at time t. */
export function vGuitarPluck(e: Eng, t: number, string: number, velocity: number, pan = 0, o: PluckOpts = {}) {
  const si = clamp(Math.round(string), 0, 5), v = clamp(velocity, 0.05, 1), dir = (o.dir ?? 1) < 0 ? -1 : 1
  const s = e.ctx.createBufferSource(); s.buffer = pluckBuffer(e.ctx, si, v, dir); s.start(t)
  const gv = (o.k ?? 1) * pluckLevel(v)
  const g = gain(e, gv)
  s.connect(g)
  const pn = clamp(pan + (si - 2.5) * 0.06, -1, 1)
  out(e, g, e.fx, { pan: pn, tube: 0.05, room: o.room ?? 0.35 - 0.1 * v })
  g.connect(o.refl ?? makeRefl(e, pan))
  if (o.sym !== false) {
    const sr = e.ctx.sampleRate
    for (const p of sympatheticPairs()) {
      if (p.from !== si) continue
      const b = symCache.get(symKey(sr, p))                 // only what is already rendered: the voice never renders on the audio path
      if (!b) continue
      const ss = e.ctx.createBufferSource(); ss.buffer = b; ss.start(t)
      const sg = gain(e, gv * db(-32))
      ss.connect(sg); out(e, sg, e.fx, { pan: clamp(pan + (p.to - 2.5) * 0.06, -1, 1), room: 0.3 })
    }
  }
}

/** Where each string of a strum starts: seconds after the first, and its velocity. Spacing is 8 ms (fast sweep) to 28 ms (slow), +-2 ms of jitter
 *  (every gap kept inside 8..30 ms), velocity falling about 12% across the strum. An up-strum starts at E4 and usually skips E2 (and A2 when soft). */
export function strumPlan(velocity: number, dir: 1 | -1 = 1, speed = velocity, rng: () => number = Math.random): { string: number; dt: number; v: number }[] {
  const v0 = clamp(velocity, 0.1, 1), sp = lerp(0.028, 0.008, clamp(speed))
  const order = dir < 0 ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5]
  const played = order.filter(i => !(dir < 0 && ((i === 0 && rng() < 0.85) || (i === 1 && v0 < 0.5 && rng() < 0.7))))
  const res: { string: number; dt: number; v: number }[] = []
  let prev = 0
  played.forEach((string, k) => {
    const raw = k * sp + (k ? (rng() * 2 - 1) * 0.002 : 0)
    const dt = k ? prev + clamp(raw - prev, 0.008, 0.03) : 0
    prev = dt
    res.push({ string, dt, v: clamp(v0 * (1 - 0.12 * (played.length > 1 ? k / (played.length - 1) : 0)), 0.1, 1) })
  })
  return res
}

/** A strum across the strings: down-strum low to high, up-strum from E4. `speed` (0..1, default the velocity) sets the spacing. */
export function vGuitarStrum(e: Eng, t: number, k: number, pan = 0, dir: 1 | -1 = 1, velocity = 0.5, speed = velocity) {
  const refl = makeRefl(e, pan)
  for (const p of strumPlan(velocity, dir, speed)) vGuitarPluck(e, t + p.dt, p.string, p.v, pan, { k, dir, refl, sym: false })
}

// ------------------------------------------------------------------ idle pre-render
export interface WarmState { started: number | null; done: boolean; built: number; total: number; sr: number; maxSliceMs: number; slices: number; over6: number }
const warm: WarmState = { started: null, done: false, built: 0, total: 0, sr: 0, maxSliceMs: 0, slices: 0, over6: 0 }
export function guitarWarmState(): WarmState { return { ...warm } }
type Task = { key: string; make: () => Job; sym?: Pair; prep?: () => void }
const idle = (f: () => void) => { if (typeof requestIdleCallback === 'function') requestIdleCallback(() => f(), { timeout: 600 }); else setTimeout(f, 40) }

/** Pre-render the common buffers in idle slices of at most 6 ms (down-strokes at all 6 velocities, up-strokes at 2, then the sympathetic rings).
 *  Call it once the flight is within 2 stops of the guitar; it waits for the sound engine, does nothing twice, and never runs at boot. */
export function guitarWarm(): void {
  if (warm.started !== null) return
  const st = sfxRef?.status?.()
  if (!st || !st.enabled || st.ctx === 'none' || !st.sampleRate) return
  const sr = st.sampleRate
  warm.started = performance.now(); warm.sr = sr
  const tasks: Task[] = [{ key: 'ir', make: null as unknown as () => Job, prep: () => { bodyImpulse(sr) } }]   // the body IR and each string's design are one small step each, so no slice pays for them inside a render
  for (let si = 0; si < 6; si++) tasks.push({ key: `design${si}`, make: null as unknown as () => Job, prep: () => { guitarDesign(sr, si) } })
  const add = (dir: 1 | -1, vis: number[]) => { for (const vi of vis) for (let si = 0; si < 6; si++) tasks.push({ key: keyOf(sr, si, vi, dir), make: () => jobFor(sr, si, vi, dir, {}, null) }) }
  add(1, [4, 3, 5, 2, 1, 0]); add(-1, [4, 2])
  for (const p of sympatheticPairs()) tasks.push({ key: symKey(sr, p), make: () => symJob(sr, p), sym: p })
  const todo = tasks.filter(t => t.prep || !(t.sym ? symCache.has(t.key) : cache.has(t.key)))
  warm.total = todo.filter(t => !t.prep).length
  let cur: { job: Job; task: Task } | null = null
  const pump = () => {
    const t0 = performance.now()
    while (performance.now() - t0 < 2.5) {
      if (!cur) { const t = todo.shift(); if (!t) break; if (t.prep) { t.prep(); continue } cur = { job: t.make(), task: t } }
      if (cur.job.step(0.8)) {
        const b = cur.job.buf!
        if (cur.task.sym) symCache.set(cur.task.key, b); else cache.set(cur.task.key, b)
        warm.built++; cur = null
      }
    }
    warm.slices++; const sl = performance.now() - t0; warm.maxSliceMs = Math.max(warm.maxSliceMs, sl); if (sl > 6) warm.over6++
    if (cur || todo.length) idle(pump); else warm.done = true
  }
  idle(pump)
}

// ------------------------------------------------------------------ the site-facing API (the engine is reached through sfx.cue, so every sound rule applies: sound off is silent, pages hidden are silent)
type Sfx = { cue(id: string, o?: Record<string, unknown>): void; status?(): { enabled: boolean; ctx: string; sampleRate?: number } }
let sfxRef: Sfx | null = null
void import('./sfx').then(m => { sfxRef = m.sfx as unknown as Sfx })

/** Pluck string 0 (E2) .. 5 (E4). velocity 0..1. dir 1 = down-stroke, -1 = up-stroke; delay in seconds (a sweep that crosses several strings in one event). */
export function pluck(stringIndex: number, velocity = 0.7, o: { dir?: 1 | -1; delay?: number } = {}): void {
  sfxRef?.cue('guitar:pluck', { string: stringIndex, velocity, dir: o.dir ?? 1, delay: o.delay ?? 0, param: String(stringIndex) })
}
/** Strum all six strings; dir 1 = low to high. speed (0..1) is the sweep speed: it sets the spacing between strings. */
export function strum(velocity = 0.6, dir: 1 | -1 = 1, speed?: number): void {
  sfxRef?.cue('guitar:strum', { velocity, dir, speed: speed ?? velocity })
}
