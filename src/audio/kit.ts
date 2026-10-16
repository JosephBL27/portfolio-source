// PNEUMA v9 sound kit: the engine type, node helpers and the shared voices every cue is built from.
// Extracted from sfx.ts so the interaction voices, arrival signatures and music bed can share them without import cycles.
import { makeNoise, makeTubeIR } from './sound'

export type AreaKey = 'hub' | 'mind' | 'systems' | 'research' | 'work' | 'education' | 'about'
/** Cue options. `pan` and `intensity` are common to all cues; world events also pass their own payload through (id, speed, ch, value, ...). */
export interface CueOpts { pan?: number; intensity?: number; [k: string]: any }
export const AREA_KEYS: AreaKey[] = ['hub', 'mind', 'systems', 'research', 'work', 'education', 'about']

// ------------------------------------------------------------------ small helpers

export const F0 = 60
export const hz = (n: number) => F0 * n
export const db = (d: number) => Math.pow(10, d / 20)
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u
export const rnd = (a: number, b: number) => a + Math.random() * (b - a)
export const jit = (amt: number) => 1 + (Math.random() * 2 - 1) * amt
export const asArea = (s: string): AreaKey => ((AREA_KEYS as string[]).includes(s) ? (s as AreaKey) : 'hub')

export const MASTER = 0.9
export const PREF = 'pneuma-sound'

// ------------------------------------------------------------------ engine

export interface Drone { out: GainNode; nodes: AudioScheduledSourceNode[]; idleSince: number }
export interface Air { bp: BiquadFilterNode; bp2: BiquadFilterNode; g: GainNode; g2: GainNode; pan: StereoPannerNode; srcs: AudioBufferSourceNode[] }
export interface Hum { g: GainNode; whine: GainNode }
export interface Beds { air: Air; hum: Hum; drones: Map<AreaKey, Drone> }

export interface Eng {
  ctx: BaseAudioContext
  fx: GainNode; ui: GainNode; bed: GainNode; duck: GainNode
  tube: GainNode; room: GainNode
  master: GainNode
  analyser: AnalyserNode
  noise: AudioBuffer; pink: AudioBuffer
  beds: Beds | null
  reduced: boolean
  tvOn: boolean; forcedOff: boolean; offWp: number
  lastWp: number; dir: 1 | -1; seen: boolean
  lastMorph: number; lastMorphArea: AreaKey
  area: AreaKey
  level: number
  /** v9 continuous voices (tv spin, pov wind), keyed by name; each one is a dead-man switch re-armed by every event */
  cont: Map<string, ContVoice>
  /** v9 lab:drag step memory, per param */
  labStep: Map<string, { step: number; at: number }>
  /** v9 generative music bed (null until the TV is on and an area is dwelling) and its user switch */
  music: MusicState | null
  musicOn: boolean
}

/** A voice kept alive by repeated events: `out` is the dead-man gate, `p` the params the events steer. */
export interface ContVoice { end: number; out: GainNode; nodes: AudioScheduledSourceNode[]; p: Record<string, AudioParam> }
/** The music bed: one bus per area (crossfaded by the camera's area mix) under a shared bus. */
export interface MusicState { bus: GainNode; areas: Map<AreaKey, GainNode>; next: number; last: Map<AreaKey, number>; note: Map<AreaKey, number>; tgt: Map<AreaKey, number>; busTgt: number; area: AreaKey; mix: number; sp: number; on: boolean }

export const bufCache = new Map<string, AudioBuffer>()
/** Build (once per sample rate) a buffer by evaluating fn(t, i) for each sample. */
export function synth(ctx: BaseAudioContext, key: string, sec: number, fn: (t: number, i: number) => number, peak = 1): AudioBuffer {
  const k = `${ctx.sampleRate}:${key}`
  const hit = bufCache.get(k)
  if (hit) return hit
  const len = Math.floor(ctx.sampleRate * sec)
  const b = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = b.getChannelData(0)
  let mx = 1e-9
  for (let i = 0; i < len; i++) { d[i] = fn(i / ctx.sampleRate, i); mx = Math.max(mx, Math.abs(d[i])) }
  const s = peak / mx
  for (let i = 0; i < len; i++) d[i] *= s
  bufCache.set(k, b)
  return b
}

export function makePink(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate, L = Math.floor(sr * 6), xf = Math.floor(sr * 0.5)
  const gen = new Float32Array(L + xf)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < gen.length; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898
    gen[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926
  }
  const buf = ctx.createBuffer(1, L, sr), d = buf.getChannelData(0)
  for (let i = 0; i < L; i++) {
    if (i < xf) { const u = i / xf; d[i] = gen[i] * Math.sqrt(u) + gen[L + i] * Math.sqrt(1 - u) } else d[i] = gen[i]
  }
  return buf
}

/** Longer, darker, wider than the tube: lets bells and drones bloom. */
export function makeRoomIR(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate, len = Math.floor(sr * 1.7), pre = Math.floor(sr * 0.012)
  const ir = ctx.createBuffer(2, len, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    let lp = 0
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr
      lp += 0.1 * ((Math.random() * 2 - 1) - lp) // dark tail
      d[i] = lp * Math.exp(-t / 0.42) * Math.min(1, (i - pre) / 220) * 2.4
    }
  }
  return ir
}

export function buildEngine(ctx: BaseAudioContext, dest: AudioNode, level = MASTER): Eng {
  const g = (v: number) => { const n = ctx.createGain(); n.gain.value = v; return n }
  const pre = g(1)
  const fx = g(1), ui = g(1), bed = g(1), duck = g(1)
  fx.connect(pre); ui.connect(pre); bed.connect(duck); duck.connect(pre)

  const tubeIn = g(1), roomIn = g(1)
  const tubeC = ctx.createConvolver(); tubeC.buffer = makeTubeIR(ctx)
  const roomC = ctx.createConvolver(); roomC.buffer = makeRoomIR(ctx)
  const tubeRet = g(0.5), roomRet = g(0.5)
  tubeIn.connect(tubeC); tubeC.connect(tubeRet); tubeRet.connect(pre)
  roomIn.connect(roomC); roomC.connect(roomRet); roomRet.connect(pre)

  const master = g(level)
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28; hp.Q.value = 0.5
  const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 7500; shelf.gain.value = -3.5
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -22; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.2
  const lim = ctx.createDynamicsCompressor()
  lim.threshold.value = -5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1
  // final soft clip: guarantees |x| < 0.89 (-1 dBFS) even when the limiter's lookahead is missed
  const clip = ctx.createWaveShaper()
  const N = 2048, curve = new Float32Array(N), C = 0.89
  for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; curve[i] = C * Math.tanh(x / C) }
  clip.curve = curve; clip.oversample = '2x'
  pre.connect(master); master.connect(hp); hp.connect(shelf); shelf.connect(comp); comp.connect(lim); lim.connect(clip); clip.connect(dest)
  const analyser = ctx.createAnalyser(); analyser.fftSize = 1024
  clip.connect(analyser)

  return {
    ctx, fx, ui, bed, duck, tube: tubeIn, room: roomIn, master, analyser,
    noise: makeNoise(ctx, 2), pink: makePink(ctx), beds: null,
    reduced: false, tvOn: false, forcedOff: false, offWp: Infinity, lastWp: 0, dir: 1, seen: false,
    lastMorph: -9, lastMorphArea: 'hub', area: 'hub', level,
    cont: new Map(), labStep: new Map(), music: null, musicOn: true,
  }
}

// ------------------------------------------------------------------ node helpers

export function osc(e: Eng, type: OscillatorType, f: number, t: number, dur: number): OscillatorNode {
  const o = e.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); o.stop(t + dur); return o
}
/** Schedule a sweep that starts exactly at t (a bare ramp would start at currentTime and glide through the pre-roll). */
export function sweep(p: AudioParam, from: number, to: number, t: number, dur: number, lin = false) {
  p.setValueAtTime(from, t)
  if (lin) p.linearRampToValueAtTime(to, t + dur); else p.exponentialRampToValueAtTime(to, t + dur)
}
export function gain(e: Eng, v = 1): GainNode { const n = e.ctx.createGain(); n.gain.value = v; return n }
export function bq(e: Eng, type: BiquadFilterType, f: number, q = 1, g = 0): BiquadFilterNode {
  const n = e.ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = g; return n
}
export function noiseNode(e: Eng, t: number, dur: number, pink = false): AudioBufferSourceNode {
  const b = pink ? e.pink : e.noise
  const s = e.ctx.createBufferSource(); s.buffer = b; s.loop = true
  s.start(t, Math.random() * Math.max(0, b.duration - 0.6), dur + 0.05)
  return s
}
/** An envelope gain that is SILENT until its first automation event. (A bare GainNode sits at 1 before the first event, so a source that
 *  starts earlier than its envelope leaks at full level until then.) */
export function envGain(e: Eng): GainNode { const g = e.ctx.createGain(); g.gain.value = 0; return g }
/** percussive: exponential attack then exponential decay */
export function adsr(e: Eng, t: number, peak: number, a: number, d: number): GainNode {
  const v = envGain(e)
  v.gain.setValueAtTime(0.0001, t)
  v.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a)
  v.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
  return v
}
/** smooth swell: linear rise, hold, exponential fall */
export function swell(e: Eng, t: number, peak: number, a: number, r: number, hold = 0): GainNode {
  const v = envGain(e)
  v.gain.setValueAtTime(0, t)
  v.gain.linearRampToValueAtTime(peak, t + a)
  if (hold > 0) v.gain.setValueAtTime(peak, t + a + hold)
  v.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r)
  return v
}
/** route a voice end to a bus with optional pan and reverb sends */
export function out(e: Eng, n: AudioNode, bus: GainNode, o: { pan?: number; tube?: number; room?: number } = {}) {
  let last: AudioNode = n
  if (o.pan) { const p = e.ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); n.connect(p); last = p }
  last.connect(bus)
  if (o.tube) { const s = gain(e, o.tube); last.connect(s); s.connect(e.tube) }
  if (o.room) { const s = gain(e, o.room); last.connect(s); s.connect(e.room) }
}
export function duckUnder(e: Eng, t: number, amount: number, hold: number) {
  const p = e.duck.gain
  p.setTargetAtTime(amount, t, 0.012)
  p.setTargetAtTime(1, t + hold, 0.16)
}

// ------------------------------------------------------------------ shared voices

export const HANN = Float32Array.from({ length: 33 }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 32))

/** FM grain: sine carrier with an inharmonic modulator under a Hann envelope. */
export function grainFM(e: Eng, t: number, f: number, ratio: number, index: number, dur: number, amp: number, pan: number, o: { tube?: number; room?: number } = {}) {
  const c = osc(e, 'sine', f, t, dur + 0.02)
  const m = osc(e, 'sine', f * ratio, t, dur + 0.02)
  const mg = gain(e, index * f * ratio * 0.25)
  m.connect(mg); mg.connect(c.frequency)
  const env = e.ctx.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.setValueCurveAtTime(HANN.map(v => v * amp), t, dur)
  c.connect(env)
  out(e, env, e.fx, { pan, ...o })
}

/** Struck glass: four inharmonic partials, each a slightly detuned pair so the tail beats slowly. */
export function vGlass(e: Eng, t: number, f: number, a: number, pan = 0, bus: GainNode = e.fx) {
  const parts: [number, number, number][] = [[1, 1, 1.6], [2.32, 0.5, 1.1], [4.25, 0.28, 0.65], [6.63, 0.14, 0.4]]
  const sum = gain(e, a)
  for (const [r, amp, dec] of parts) {
    for (const dt of [1, 1.0034]) {
      const fr = f * r * dt
      if (fr > 9500) continue
      const o = osc(e, 'sine', fr, t, dec * 1.6 + 0.1)
      const env = e.ctx.createGain()
      env.gain.setValueAtTime(0.0001, t)
      env.gain.exponentialRampToValueAtTime(amp * 0.5, t + 0.004)
      env.gain.setTargetAtTime(0, t + 0.004, dec / 4.6)
      o.connect(env); env.connect(sum)
    }
  }
  out(e, sum, bus, { pan, tube: 0.2, room: 0.35 })
}

/** Lyre/bell pluck: additive with a stiff-string (slightly sharp) overtone series, high partials decaying fastest. */
export function pluckBuf(ctx: BaseAudioContext, f: number): AudioBuffer {
  return synth(ctx, `pluck${Math.round(f)}`, 2.4, (t) => {
    let s = 0
    for (let k = 1; k <= 8; k++) {
      const fk = f * k * (1 + 0.0011 * k * k)
      if (fk > 9000) break
      s += Math.sin(2 * Math.PI * fk * t) * Math.exp(-t * (1.5 + 1.25 * k)) / Math.pow(k, 1.15)
    }
    return s * Math.min(1, t / 0.0015)
  }, 0.9)
}
export function vPluck(e: Eng, t: number, f: number, a: number, pan = 0, bus: GainNode = e.fx) {
  const s = e.ctx.createBufferSource(); s.buffer = pluckBuf(e.ctx, f); s.start(t)
  const g = gain(e, a); s.connect(g)
  out(e, g, bus, { pan, tube: 0.12, room: 0.5 })
}

/** Dry tick: ~3 ms band-passed noise. */
export function vTick(e: Eng, t: number, f: number, a: number, pan = 0, q = 8, bus: GainNode = e.fx) {
  const n = noiseNode(e, t, 0.012)
  const bp = bq(e, 'bandpass', f, q)
  const env = e.ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(a, t + 0.0006)
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.006)
  n.connect(bp); bp.connect(env)
  out(e, env, bus, { pan, tube: 0.18 })
}

/** Soft low thud (landing weight). */
export function vThud(e: Eng, t: number, f: number, a: number, dec: number, bus: GainNode = e.fx) {
  const o = osc(e, 'sine', f * 1.5, t, dec + 0.15)
  sweep(o.frequency, f * 1.5, f, t, 0.05)
  const env = adsr(e, t, a, 0.003, dec)
  o.connect(env)
  out(e, env, bus, { tube: 0.25, room: 0.15 })
  // felt: a breath of low-passed noise so it lands rather than hums
  const n = noiseNode(e, t, 0.08)
  const lp = bq(e, 'lowpass', 380)
  const ne = adsr(e, t, a * 0.45, 0.002, 0.05)
  n.connect(lp); lp.connect(ne)
  out(e, ne, bus)
}

/** Static burst + detent click. */
export function vChannel(e: Eng, t: number, k: number, pan = 0, soft = 1) {
  const n = noiseNode(e, t, 0.2)
  const bp = bq(e, 'bandpass', rnd(2000, 2800), 0.55)
  const env = adsr(e, t, 0.2 * k * soft, 0.002, rnd(0.07, 0.11))
  n.connect(bp); bp.connect(env)
  out(e, env, e.fx, { pan, tube: 0.22 })
  vTick(e, t + 0.004, 3600, 0.22 * k * soft, pan, 5)
  vThud(e, t + 0.002, 170, 0.14 * k * soft, 0.04)
}

/** Vinyl crackle: Poisson clicks of random size over a faint surface hiss; loopable. */
export const crackleCache = new Map<number, AudioBuffer>()
export function crackleBuf(ctx: BaseAudioContext): AudioBuffer {
  const cached = crackleCache.get(ctx.sampleRate)
  if (cached) return cached
  const sr = ctx.sampleRate, len = Math.floor(sr * 4)
  const hits = new Float32Array(len)
  let lp = 0
  for (let i = 0; i < len; i++) {
    lp += 0.2 * ((Math.random() * 2 - 1) - lp)
    hits[i] = lp * 0.012
    if (Math.random() < 11 / sr) { const a = Math.pow(Math.random(), 2.2) * (Math.random() < 0.5 ? -1 : 1); for (let j = 0; j < 90 && i + j < len; j++) hits[i + j] += a * Math.exp(-j / 18) * (j % 2 ? 0.7 : 1) }
    if (Math.random() < 1.3 / sr) { const a = (0.5 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1); for (let j = 0; j < 220 && i + j < len; j++) hits[i + j] += a * Math.exp(-j / 45) }
  }
  const b = synth(ctx, 'crackle', 4, (_t, i) => hits[i], 0.9)
  crackleCache.set(sr, b)
  return b
}

// ------------------------------------------------------------------ v9 shared bits

/** Stable 0..1 hash of a string (FNV-1a): a TV id or a lab param always lands on the same pan. */
export function hash01(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10007) / 10007
}
/** The channel scale: twelve harmonics of the 60 Hz hum (480 to 1920 Hz). Channel i, lab step or letter lands on degree i. */
export const DEG = [8, 9, 10, 12, 15, 16, 18, 20, 24, 27, 30, 32] as const
export const degHz = (i: number) => hz(DEG[((Math.round(i) % DEG.length) + DEG.length) % DEG.length])
/** Retarget a param from `at`, dropping anything scheduled after it (continuous parameters are steered, never retriggered). */
export function steer(p: AudioParam, v: number, at: number, tc = 0.06) { p.cancelScheduledValues(at); p.setTargetAtTime(v, at, tc) }
/** Inharmonic bell: [ratio, amp, decay s] partials of f. Each is a plain sine with a fast attack and an exponential tail. */
export function vBell(e: Eng, t: number, f: number, a: number, parts: readonly (readonly [number, number, number])[], o: { pan?: number; tube?: number; room?: number; bus?: GainNode } = {}) {
  const sum = gain(e, a / parts.reduce((s, p) => s + p[1], 0)) // `a` is the bell's peak when every partial is in phase, however many partials it has
  for (const [r, amp, dec] of parts) {
    const fr = f * r
    if (fr > 9500) continue
    const os = osc(e, 'sine', fr, t, dec * 1.5 + 0.1)
    const env = envGain(e)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t + 0.003)
    env.gain.setTargetAtTime(0, t + 0.003, dec / 4.6)
    os.connect(env); env.connect(sum)
  }
  out(e, sum, o.bus ?? e.fx, { pan: o.pan, tube: o.tube, room: o.room })
}

/** A heavy oak door let go (the hall's far doors, tr:exit): the iron bar lifting out of its bracket, the leaf's weight coming off the frame
 *  (a low thud with a long dark ring), a slow stick-slip hinge creak, and one small knock as the leaf settles on its stop. */
export function vOakRelease(e: Eng, t: number, k: number, pan = 0) {
  // iron latch: a dry click and a short wooden knock
  vTick(e, t, 1700, 0.26 * k, pan, 6)
  const kn = noiseNode(e, t + 0.004, 0.09), kb = bq(e, 'bandpass', 520, 9), ke = adsr(e, t + 0.004, 0.5 * k, 0.001, 0.05)
  kn.connect(kb); kb.connect(ke); out(e, ke, e.fx, { pan, tube: 0.15, room: 0.2 })
  // the leaf's weight: a 64 Hz thud with a darker ring under it
  const th = osc(e, 'sine', 96, t + 0.03, 0.9)
  sweep(th.frequency, 96, 58, t + 0.03, 0.12)
  const te = adsr(e, t + 0.03, 0.62 * k, 0.004, 0.55)
  th.connect(te); out(e, te, e.fx, { pan, tube: 0.2, room: 0.3 })
  // hinge creak: noise through a sliding band, fluttering at 7 Hz
  const cn = noiseNode(e, t + 0.09, 0.9), cb = bq(e, 'bandpass', 170, 4.5)
  cb.frequency.setValueAtTime(170, t + 0.09); cb.frequency.linearRampToValueAtTime(330, t + 0.8)
  const am = gain(e, 0.55), lf = osc(e, 'sine', 7, t + 0.09, 0.9), ld = gain(e, 0.45)
  lf.connect(ld); ld.connect(am.gain)
  const ce = swell(e, t + 0.09, 0.22 * k, 0.18, 0.55)
  cn.connect(cb); cb.connect(am); am.connect(ce); out(e, ce, e.fx, { pan, tube: 0.15, room: 0.35 })
  // the leaf settling on its stop
  const sn = noiseNode(e, t + 0.5, 0.08), sb = bq(e, 'bandpass', 360, 8), se = adsr(e, t + 0.5, 0.2 * k, 0.001, 0.05)
  sn.connect(sb); sb.connect(se); out(e, se, e.fx, { pan, room: 0.25 })
  const st = osc(e, 'sine', 70, t + 0.5, 0.4), ste = adsr(e, t + 0.5, 0.2 * k, 0.003, 0.2)
  st.connect(ste); out(e, ste, e.fx, { pan, room: 0.25 })
}
