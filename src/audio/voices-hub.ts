// PNEUMA v9 interaction voices: the dial, buttons and power of the hub TV, grabbing and spinning the small TVs,
// dragging the point of view, the background type, glyph bursts, lab sliders, evidence cards and the odometer.
//
// Same family as the rest of the palette (see kit.ts): every pitch is a harmonic of the TV's 60 Hz hum, every surface
// owns its sound (bakelite = a hard tick over a damped knock, cabinet = resonant creak, air = pink noise, glass = FM grains).
// One-shot voices schedule at `t`. Continuous voices (tv:spin, pov:drag) are created once and STEERED by every event
// (a dead-man gate re-armed per event), never retriggered, so a fast drag is one smooth sound and not a machine gun.
import {
  envGain, type Eng, type CueOpts, type ContVoice,
  osc, sweep, gain, bq, noiseNode, adsr, swell, out, steer, hash01, degHz, hz, clamp, lerp, rnd, jit,
  vTick, vThud, grainFM, vGlass,
} from './kit'

const panOf = (id: unknown) => (hash01(String(id ?? 'hub')) - 0.5) * 0.9

// ------------------------------------------------------------------ the hub TV: dial, buttons, power

/** Bakelite detent: a hard tick as the ball rides over the notch, a softer one as it seats, and a damped knock whose pitch is the channel's degree. */
export function vDetent(e: Eng, t: number, k: number, o: CueOpts) {
  const ch = Number(o.ch ?? o.i ?? 0) || 0
  const f = degHz(ch) * jit(0.012)
  vTick(e, t, 2400 * jit(0.04), 0.5 * k, 0, 6, e.ui)
  vTick(e, t + 0.011, 1750, 0.26 * k, 0, 5, e.ui)
  const kn = osc(e, 'sine', f * 1.07, t, 0.14)
  sweep(kn.frequency, f * 1.07, f, t, 0.014)
  const ke = adsr(e, t, 0.22 * k, 0.0012, 0.06)
  kn.connect(ke); out(e, ke, e.ui, { tube: 0.2 })
  // the second partial gives the knock a hard, plastic edge
  const k2 = osc(e, 'sine', f * 2.76, t, 0.05)
  const k2e = adsr(e, t, 0.07 * k, 0.001, 0.02)
  k2.connect(k2e); out(e, k2e, e.ui)
  vThud(e, t, 150, 0.16 * k, 0.035, e.ui)
}

/** Channel change: a burst of static, then a tuned chirp that settles on the channel's degree of the 60 Hz series. */
export function vChannelChirp(e: Eng, t: number, k: number, o: CueOpts) {
  const ch = Number(o.i ?? o.ch ?? 0) || 0
  const f = degHz(ch)
  const n = noiseNode(e, t, 0.2)
  const bp = bq(e, 'bandpass', 900, 0.6)
  bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(3600, t + 0.07)
  const ne = adsr(e, t, 0.34 * k, 0.002, 0.085)
  n.connect(bp); bp.connect(ne); out(e, ne, e.fx, { tube: 0.25 })
  // the chirp starts a hair after the burst and lands on pitch
  const c1 = osc(e, 'sine', f, t + 0.02, 0.3)
  sweep(c1.frequency, f * 0.62, f, t + 0.02, 0.085)
  const ce = adsr(e, t + 0.02, 0.2 * k, 0.003, 0.15)
  c1.connect(ce); out(e, ce, e.fx, { tube: 0.3, room: 0.2 })
  const c2 = osc(e, 'sine', f * 2, t + 0.02, 0.2)
  sweep(c2.frequency, f * 1.24, f * 2, t + 0.02, 0.085)
  const c2e = adsr(e, t + 0.02, 0.06 * k, 0.003, 0.09)
  c2.connect(c2e); out(e, c2e, e.fx, { tube: 0.3 })
  vTick(e, t, 3400, 0.22 * k, 0, 5)
}

/** A / B buttons. Down = a heavy clunk with a latch click and a little spring in it; up = the spring letting go (a tick and a short twang). */
export function vButton(e: Eng, t: number, k: number, o: CueOpts) {
  const A = String(o.which ?? 'A').toUpperCase() !== 'B'
  const down = o.down !== false
  const base = A ? 118 : 142
  if (down) {
    const th = osc(e, 'sine', base, t, 0.25)
    sweep(th.frequency, base, base * 0.44, t, 0.06)
    const the = adsr(e, t, 0.4 * k, 0.002, 0.12)
    th.connect(the); out(e, the, e.ui, { tube: 0.2, room: 0.1 })
    vThud(e, t, A ? 66 : 78, 0.26 * k, 0.07, e.ui)
    vTick(e, t, 3100, 0.34 * k, 0, 6, e.ui)            // the latch
    vTick(e, t + 0.007, 1500, 0.34 * k, 0, 4, e.ui)   // the housing answering
    const n = noiseNode(e, t, 0.08)
    const lp = bq(e, 'lowpass', 900)
    const ne = adsr(e, t, 0.22 * k, 0.002, 0.04)
    n.connect(lp); lp.connect(ne); out(e, ne, e.ui)
    // the spring, compressed: a small metallic wobble that dies fast
    const sp = osc(e, 'sine', hz(7), t + 0.006, 0.12)
    sweep(sp.frequency, hz(7), hz(7) * 0.93, t + 0.006, 0.09)
    const spe = adsr(e, t + 0.006, 0.05 * k, 0.002, 0.07)
    sp.connect(spe); out(e, spe, e.ui, { tube: 0.2 })
  } else {
    vTick(e, t, 4300, 0.34 * k, 0, 7, e.ui)
    vTick(e, t + 0.009, 2200, 0.2 * k, 0, 4, e.ui)
    // the twang: a short pitched wobble, a little sharp at first
    const f = hz(A ? 16 : 18)
    const tw = osc(e, 'sine', f * 1.05, t + 0.002, 0.3)
    sweep(tw.frequency, f * 1.05, f, t + 0.002, 0.03)
    const vib = osc(e, 'sine', 34, t + 0.002, 0.3), vd = gain(e, f * 0.012)
    vib.connect(vd); vd.connect(tw.frequency)
    const twe = adsr(e, t + 0.002, 0.11 * k, 0.002, 0.15)
    tw.connect(twe); out(e, twe, e.ui, { tube: 0.3 })
    vThud(e, t + 0.01, A ? 92 : 104, 0.2 * k, 0.04, e.ui)
  }
}

/** Front-panel power on: a damped degauss (the 60 Hz coil decaying with a beat), the raster opening, and a flyback whine that
 *  rises but is kept low and filtered, so it fades out of hearing as it climbs. */
export function vHubPoweron(e: Eng, t: number, k: number) {
  // degauss: 56 and 64 Hz beat at 8 Hz, wobbling down over about a second
  const dg = gain(e, 1)
  for (const f of [56, 64, 120]) { const o = osc(e, 'sine', f, t, 1.2); const g = gain(e, f === 120 ? 0.3 : 0.7); o.connect(g); g.connect(dg) }
  const dge = envGain(e)
  dge.gain.setValueAtTime(0.0001, t); dge.gain.exponentialRampToValueAtTime(0.5 * k, t + 0.012); dge.gain.exponentialRampToValueAtTime(0.0001, t + 1.05)
  dg.connect(dge); out(e, dge, e.fx, { tube: 0.3, room: 0.2 })
  // the thump
  const th = osc(e, 'sine', 100, t, 0.5)
  sweep(th.frequency, 100, 44, t, 0.1)
  const the = adsr(e, t, 0.55 * k, 0.003, 0.26)
  th.connect(the); out(e, the, e.fx, { tube: 0.3, room: 0.2 })
  // the coil's crackle
  const cn = noiseNode(e, t, 0.2)
  const clp = bq(e, 'lowpass', 700)
  const cne = adsr(e, t, 0.2 * k, 0.003, 0.12)
  cn.connect(clp); clp.connect(cne); out(e, cne, e.fx)
  // the raster opens: static sweeps up
  const n = noiseNode(e, t + 0.04, 0.45)
  const bp = bq(e, 'bandpass', 400, 0.8)
  bp.frequency.setValueAtTime(400, t + 0.04); bp.frequency.exponentialRampToValueAtTime(5200, t + 0.34)
  const ne = adsr(e, t + 0.04, 0.17 * k, 0.015, 0.3)
  n.connect(bp); bp.connect(ne); out(e, ne, e.fx, { tube: 0.3 })
  // the whine: rises 5.5 to 15.4 kHz through a low-pass, so the climb thins out instead of getting shrill
  const w = osc(e, 'sine', 5500, t + 0.08, 1.7)
  sweep(w.frequency, 5500, 15400, t + 0.08, 1.0)
  const wlp = bq(e, 'lowpass', 8500, 0.5)
  const we = envGain(e)
  we.gain.setValueAtTime(0, t + 0.08); we.gain.linearRampToValueAtTime(0.045 * k, t + 0.5); we.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
  w.connect(wlp); wlp.connect(we); out(e, we, e.fx)
  // the hum's own overtones wake up under it
  for (const [n2, a] of [[2, 1], [3, 0.7]] as const) {
    const o = osc(e, 'sine', hz(n2), t + 0.1, 2.0)
    const g = swell(e, t + 0.1, 0.06 * k * a, 0.5, 1.1)
    o.connect(g); out(e, g, e.fx, { room: 0.45 })
  }
}

/** Front-panel power off: the picture collapses to a line (a quick downward zip), then to a dot (a pop) that rings and fades. */
export function vHubPoweroff(e: Eng, t: number, k: number) {
  const z = osc(e, 'sine', 2600, t, 0.4)
  sweep(z.frequency, 2600, 55, t, 0.19)
  const ze = envGain(e)
  ze.gain.setValueAtTime(0.0001, t); ze.gain.linearRampToValueAtTime(0.4 * k, t + 0.01)
  ze.gain.setValueAtTime(0.4 * k, t + 0.14); ze.gain.exponentialRampToValueAtTime(0.0001, t + 0.21)
  z.connect(ze); out(e, ze, e.fx, { tube: 0.3 })
  const z2 = osc(e, 'triangle', 1300, t, 0.4)
  sweep(z2.frequency, 1300, 40, t, 0.19)
  const z2e = adsr(e, t, 0.14 * k, 0.01, 0.17)
  z2.connect(z2e); out(e, z2e, e.fx)
  const n = noiseNode(e, t, 0.3)
  const bp = bq(e, 'bandpass', 4200, 1.0)
  bp.frequency.setValueAtTime(4200, t); bp.frequency.exponentialRampToValueAtTime(700, t + 0.2)
  const ne = adsr(e, t, 0.12 * k, 0.01, 0.2)
  n.connect(bp); bp.connect(ne); out(e, ne, e.fx)
  // the dot
  const pn = noiseNode(e, t + 0.2, 0.03)
  const hp = bq(e, 'highpass', 1600)
  const pe = adsr(e, t + 0.2, 0.3 * k, 0.0006, 0.012)
  pn.connect(hp); hp.connect(pe); out(e, pe, e.fx, { tube: 0.4 })
  vThud(e, t + 0.2, 64, 0.42 * k, 0.1)
  const d = osc(e, 'sine', 1920, t + 0.21, 1.4)
  const de = adsr(e, t + 0.21, 0.035 * k, 0.01, 1.0)
  d.connect(de); out(e, de, e.fx, { room: 0.55, tube: 0.3 })
}

// ------------------------------------------------------------------ the small TVs: grab, spin, release

/** A resonant creak: noise through a narrow band-pass that slides, with a stick-slip amplitude flutter. */
function creak(e: Eng, t: number, a: number, f0: number, f1: number, dur: number, rate: number, pan: number) {
  const n = noiseNode(e, t, dur + 0.05)
  const bp = bq(e, 'bandpass', f0, 16)
  bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const am = gain(e, 0.5), lfo = osc(e, 'triangle', rate, t, dur + 0.05), ld = gain(e, 0.5)
  lfo.connect(ld); ld.connect(am.gain)
  const env = swell(e, t, a, dur * 0.35, dur * 0.65)
  n.connect(bp); bp.connect(am); am.connect(env)
  out(e, env, e.fx, { pan, tube: 0.12 })
}

/** Grab a small TV: the cabinet takes the weight (a creak and a low knock) and a hand closes on it (a breath of cloth). */
export function vTvGrab(e: Eng, t: number, k: number, o: CueOpts) {
  const pan = panOf(o.id)
  creak(e, t, 0.9 * k, 260, 430, 0.17, 19, pan)
  vThud(e, t + 0.012, 112, 0.2 * k, 0.07, e.fx)
  const n = noiseNode(e, t, 0.1)
  const hp = bq(e, 'highpass', 1300)
  const lp = bq(e, 'lowpass', 4200)
  const ne = swell(e, t, 0.13 * k, 0.03, 0.06)
  n.connect(hp); hp.connect(lp); lp.connect(ne); out(e, ne, e.fx, { pan })
}

function spinVoice(e: Eng, at: number, id: unknown): ContVoice {
  const c = e.ctx
  const out_ = gain(e, 0)
  const pan = c.createStereoPanner(); pan.pan.value = panOf(id)
  const w = c.createBufferSource(); w.buffer = e.pink; w.loop = true; w.start(at, Math.random() * 3)
  const wbp = bq(e, 'bandpass', 300, 0.8), wg = gain(e, 0)
  w.connect(wbp); wbp.connect(wg); wg.connect(pan)
  const cr = c.createBufferSource(); cr.buffer = e.noise; cr.loop = true; cr.start(at, Math.random())
  const cbp = bq(e, 'bandpass', 420, 14), am = gain(e, 0.5), cg = gain(e, 0)
  const lfo = c.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 6; lfo.start(at)
  const ld = gain(e, 0.5)
  lfo.connect(ld); ld.connect(am.gain)
  cr.connect(cbp); cbp.connect(am); am.connect(cg); cg.connect(pan)
  pan.connect(out_)
  out(e, out_, e.fx, { room: 0.15 })
  return { end: -1, out: out_, nodes: [w, cr, lfo], p: { wf: wbp.frequency, wg: wg.gain, cf: cbp.frequency, cg: cg.gain, lf: lfo.frequency } }
}

/** Keep a continuous voice alive for `hold` s after `at`, then let it fall away over ~`tail` s. Every event re-arms it. */
function arm(v: ContVoice, at: number, hold: number, tail: number) {
  steer(v.out.gain, 1, at, 0.03)
  v.out.gain.setTargetAtTime(0, at + hold, tail / 4)
  v.end = at + hold + tail * 1.6
  for (const n of v.nodes) { try { n.stop(v.end + 0.2) } catch { /* already stopped */ } }
}
function voice(e: Eng, key: string, at: number, make: () => ContVoice): ContVoice {
  let v = e.cont.get(key)
  if (!v || v.end < at) { v = make(); e.cont.set(key, v) }
  return v
}
/** Let a continuous voice go now (a release): quick fade, then it is spent. */
function drop(e: Eng, key: string, at: number, tc = 0.06) {
  const v = e.cont.get(key)
  if (!v) return
  steer(v.out.gain, 0, at, tc)
  v.end = Math.min(v.end, at + tc * 7)
  for (const n of v.nodes) { try { n.stop(at + tc * 8 + 0.1) } catch { /* */ } }
}

/** Spin a small TV (continuous): creak rate and air whoosh follow `speed` 0..1; one voice, steered. */
export function vTvSpin(e: Eng, t: number, k: number, o: CueOpts) {
  const s = clamp(Number(o.speed ?? 0.4))
  const v = voice(e, 'tv:spin', t, () => spinVoice(e, t, o.id))
  steer(v.p.wf, 240 + 2300 * Math.pow(s, 1.1), t)
  steer(v.p.wg, 0.55 * k * Math.pow(s, 1.25), t)
  steer(v.p.cf, 330 + 330 * s, t)
  steer(v.p.cg, 0.2 * k * (0.2 + 0.8 * s) * (s > 0.02 ? 1 : 0), t)
  steer(v.p.lf, 5 + 21 * s, t)
  arm(v, t, 0.3, 0.3)
}

/** Let go of a small TV: the cabinet settles (a creak and a soft thunk) and the air spins down, as long as the throw was fast. */
export function vTvRelease(e: Eng, t: number, k: number, o: CueOpts) {
  const s = clamp(Number(o.speed ?? 0.5))
  const pan = panOf(o.id)
  drop(e, 'tv:spin', t, 0.05)
  creak(e, t + 0.005, (0.35 + 0.6 * s) * k, 520, 270, 0.2 + 0.2 * s, 13, pan)
  vThud(e, t + 0.02, 96, 0.28 * k, 0.07, e.fx)
  if (s > 0.06) {
    const dur = 0.35 + 0.95 * s
    const n = noiseNode(e, t, dur + 0.1, true)
    const bp = bq(e, 'bandpass', 240 + 2000 * s, 0.8)
    bp.frequency.setValueAtTime(240 + 2000 * s, t); bp.frequency.exponentialRampToValueAtTime(170, t + dur)
    const env = swell(e, t, 0.5 * k * s, 0.04, dur)
    const p = e.ctx.createStereoPanner(); p.pan.value = pan
    n.connect(bp); bp.connect(env); env.connect(p); p.connect(e.fx)
  }
}

// ------------------------------------------------------------------ point of view: grab, drag, release, return

/** Take hold of the view: a soft intake of air (a breath in with the band sliding up) and a faint touch. */
export function vPovGrab(e: Eng, t: number, k: number) {
  const n = noiseNode(e, t, 0.4, true)
  const bp = bq(e, 'bandpass', 380, 0.9)
  bp.frequency.setValueAtTime(380, t); bp.frequency.exponentialRampToValueAtTime(1000, t + 0.24)
  const lp = bq(e, 'lowpass', 2000)
  const env = swell(e, t, 0.42 * k, 0.1, 0.18)
  n.connect(bp); bp.connect(lp); lp.connect(env); out(e, env, e.fx, { room: 0.2 })
  vThud(e, t, 74, 0.1 * k, 0.05, e.fx)
}

function windVoice(e: Eng, at: number): ContVoice {
  const c = e.ctx
  const out_ = gain(e, 0)
  const pan = c.createStereoPanner(), plfo = c.createOscillator(), pd = gain(e, 0.15)
  plfo.frequency.value = 0.37; plfo.start(at); plfo.connect(pd); pd.connect(pan.pan)
  const b = c.createBufferSource(); b.buffer = e.pink; b.loop = true; b.start(at, Math.random() * 3)
  const bp = bq(e, 'bandpass', 300, 0.8), lp = bq(e, 'lowpass', 2800), g = gain(e, 0)
  b.connect(bp); bp.connect(lp); lp.connect(g); g.connect(pan)
  const t2 = c.createBufferSource(); t2.buffer = e.noise; t2.loop = true; t2.start(at, Math.random())
  const bp2 = bq(e, 'bandpass', 900, 1.6), g2 = gain(e, 0)
  t2.connect(bp2); bp2.connect(g2); g2.connect(pan)
  pan.connect(out_)
  out(e, out_, e.fx, { room: 0.3 })
  return { end: -1, out: out_, nodes: [b, t2, plfo], p: { f: bp.frequency, g: g.gain, f2: bp2.frequency, g2: g2.gain, pd: pd.gain, pl: plfo.frequency, pan: pan.pan } }
}

/** Drag the view (continuous): wind whose pitch and level follow `speed` and whose stereo image sweeps wider the faster you spin.
 *  An event may carry `dir` (-1 left .. 1 right); without it the wind circles slowly, as if it went round you. */
export function vPovDrag(e: Eng, t: number, k: number, o: CueOpts) {
  const s = clamp(Number(o.speed ?? 0.3))
  const v = voice(e, 'pov:drag', t, () => windVoice(e, t))
  steer(v.p.f, 280 + 2500 * Math.pow(s, 1.15), t)
  steer(v.p.g, 0.04 * k + 0.9 * k * Math.pow(s, 1.6), t)
  steer(v.p.f2, 700 + 3000 * s, t)
  steer(v.p.g2, 0.5 * k * Math.pow(s, 2.2), t)
  if (typeof o.dir === 'number') { // a direction was given: the wind sits on that side, further out the faster it goes
    steer(v.p.pan, clamp(o.dir, -1, 1) * (0.2 + 0.65 * s), t, 0.1)
    steer(v.p.pd, 0.02, t, 0.1)
  } else {
    steer(v.p.pd, 0.12 + 0.72 * s, t, 0.1)
    steer(v.p.pl, 0.3 + 0.9 * s, t, 0.2)
  }
  arm(v, t, 0.3, 0.28)
}

/** Let go of the view: the wind falls away, longer the faster it was moving. */
export function vPovRelease(e: Eng, t: number, k: number, o: CueOpts) {
  const s = clamp(Number(o.speed ?? 0.3))
  drop(e, 'pov:drag', t, 0.1)
  const dur = 0.3 + 0.9 * s
  const n = noiseNode(e, t, dur + 0.1, true)
  const bp = bq(e, 'bandpass', 300 + 1800 * s, 0.9)
  bp.frequency.setValueAtTime(300 + 1800 * s, t); bp.frequency.exponentialRampToValueAtTime(200, t + dur)
  const env = swell(e, t, (0.16 + 0.5 * s) * k, 0.03, dur)
  const p = e.ctx.createStereoPanner(); p.pan.setValueAtTime(0.4, t); p.pan.linearRampToValueAtTime(-0.3, t + dur)
  n.connect(bp); bp.connect(env); env.connect(p); p.connect(e.fx); const rs = gain(e, 0.3); p.connect(rs); rs.connect(e.room)
  vTick(e, t, 2000, 0.07 * k, 0, 3)
}

/** The view springs back to the flight path: a damped spring (a sine whose pitch rings round its rest value and settles),
 *  an air sweep going home and a soft landing. */
export function vPovReturn(e: Eng, t: number, k: number) {
  const f = hz(5), dur = 0.62, N = 96
  const curve = new Float32Array(N)
  for (let i = 0; i < N; i++) { const u = (i / (N - 1)) * dur; curve[i] = f * (1 + 0.16 * Math.exp(-u / 0.11) * Math.cos(2 * Math.PI * 7 * u)) }
  const s = osc(e, 'sine', f, t, dur + 0.25)
  s.frequency.setValueCurveAtTime(curve, t, dur)
  const se = adsr(e, t, 0.2 * k, 0.012, 0.5)
  s.connect(se); out(e, se, e.fx, { tube: 0.3, room: 0.25 })
  const s2 = osc(e, 'sine', f * 2, t, dur + 0.25)
  const c2 = curve.map(v => v * 2); s2.frequency.setValueCurveAtTime(c2, t, dur)
  const s2e = adsr(e, t, 0.05 * k, 0.012, 0.3)
  s2.connect(s2e); out(e, s2e, e.fx, { tube: 0.3 })
  const n = noiseNode(e, t, 0.5, true)
  const bp = bq(e, 'bandpass', 1500, 0.9)
  bp.frequency.setValueAtTime(1500, t); bp.frequency.exponentialRampToValueAtTime(260, t + 0.4)
  const ne = swell(e, t, 0.22 * k, 0.05, 0.34)
  n.connect(bp); bp.connect(ne); out(e, ne, e.fx, { room: 0.2 })
  vThud(e, t + 0.3, 84, 0.2 * k, 0.1, e.fx)
}

// ------------------------------------------------------------------ type: assemble and shatter

/** Letters assembling: granular ticks that speed up and rise through the 60 Hz series, panned left to right,
 *  spread wider the more letters there are. A glass note locks it at the end. */
export function vTypeAssemble(e: Eng, t: number, k: number, o: CueOpts) {
  const n = clamp(Math.round(Number(o.n ?? 8) || 8), 2, 60)
  const N = clamp(Math.round(6 + n * 0.8), 6, 24)
  const dur = clamp(0.26 + 0.02 * n, 0.3, 0.8)
  const spread = clamp(0.22 + 0.05 * n, 0.25, 0.95)
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1)
    const tt = t + dur * (1 - Math.pow(1 - u, 1.7)), pan = lerp(-spread, spread, u) + rnd(-0.06, 0.06)
    const f = hz(10 + Math.round(u * 20))
    grainFM(e, tt, f * jit(0.01), 2.0, 0.45, 0.03, (0.05 + 0.1 * u) * k, pan, { tube: 0.1 })
    vTick(e, tt, 3000 + 2600 * u, (0.06 + 0.1 * u) * k, pan, 6)
  }
  vGlass(e, t + dur + 0.02, hz(30), 0.07 * k, 0)
}

/** Letters shattering: a crack, then glassy grains scattering in a fast-decaying cloud, with a shimmer of sizzle over them. */
export function vTypeShatter(e: Eng, t: number, k: number, o: CueOpts) {
  const n = clamp(Math.round(Number(o.n ?? 8) || 8), 2, 60)
  const G = clamp(10 + n, 12, 28), spread = clamp(0.4 + 0.04 * n, 0.5, 0.95)
  vTick(e, t, 3600, 0.5 * k, 0, 2)
  const cn = noiseNode(e, t, 0.1)
  const hp = bq(e, 'highpass', 2800)
  const ce = adsr(e, t, 0.3 * k, 0.0008, 0.05)
  cn.connect(hp); hp.connect(ce); out(e, ce, e.fx, { tube: 0.35 })
  for (let i = 0; i < G; i++) {
    const u = i / (G - 1), tt = t + 0.01 + 0.62 * Math.pow(u, 1.9)
    const f = hz(24 + 3 * Math.floor(Math.random() * 14)) // 1.4 to 3.5 kHz, always on a harmonic
    grainFM(e, tt, f, 2.76, 1.6, rnd(0.04, 0.1), (0.13 - 0.08 * u) * k, rnd(-spread, spread), { tube: 0.2, room: 0.25 })
  }
  const sn = noiseNode(e, t, 0.7)
  const shp = bq(e, 'highpass', 5200)
  const se = swell(e, t + 0.02, 0.045 * k, 0.05, 0.5)
  sn.connect(shp); shp.connect(se); out(e, se, e.fx, { room: 0.2 })
}

// ------------------------------------------------------------------ glyph burst

const GLYPH: Record<string, { f: number; q: number; n: number; dur: number }> = {
  mind: { f: 3300, q: 4, n: 8, dur: 0.24 },      // glass dust
  systems: { f: 2700, q: 8, n: 10, dur: 0.2 },   // type bars striking
  research: { f: 2100, q: 3, n: 8, dur: 0.26 },  // chalk
  work: { f: 1500, q: 4, n: 6, dur: 0.22 },      // ledger stamps
  education: { f: 2300, q: 3, n: 8, dur: 0.26 }, // chalk
  about: { f: 1800, q: 3, n: 6, dur: 0.24 },     // pencil
  hub: { f: 2400, q: 3, n: 7, dur: 0.22 },
}
/** Glyphs assembling in the background: a soft chalk-and-print flurry, a little brush of pressure under it. */
export function vGlyphBurst(e: Eng, t: number, k: number, o: CueOpts) {
  const G = GLYPH[String(o.area ?? 'hub')] ?? GLYPH.hub
  for (let i = 0; i < G.n; i++) {
    const tt = t + G.dur * Math.pow(Math.random(), 0.85)
    const n = noiseNode(e, tt, 0.03)
    const bp = bq(e, 'bandpass', G.f * rnd(0.8, 1.25), G.q)
    const env = adsr(e, tt, rnd(0.07, 0.15) * k, 0.0015, rnd(0.008, 0.02))
    const p = e.ctx.createStereoPanner(); p.pan.value = rnd(-0.7, 0.7)
    n.connect(bp); bp.connect(env); env.connect(p); p.connect(e.fx)
  }
  const n = noiseNode(e, t, G.dur + 0.1, true)
  const bp = bq(e, 'bandpass', G.f * 0.55, 0.8)
  const env = swell(e, t, 0.1 * k, G.dur * 0.4, G.dur * 0.8)
  n.connect(bp); bp.connect(env); out(e, env, e.fx, { room: 0.15 })
  vThud(e, t + G.dur * 0.55, 118, 0.09 * k, 0.05, e.fx)
}

// ------------------------------------------------------------------ the glass brain

/** A pulse travelling through the glass brain (emitted every few seconds while it is on screen): a short run of tiny spikes and one grain of glass. */
export function vBrainPulse(e: Eng, t: number, k: number) {
  const m = 3 + Math.floor(Math.random() * 3)
  for (let i = 0; i < m; i++) {
    const at = t + i * rnd(0.03, 0.07), p = rnd(-0.6, 0.6)
    vTick(e, at, rnd(3000, 6200), (0.16 - 0.02 * i) * k, p, 12)
  }
  grainFM(e, t + 0.02, hz(30 + 3 * Math.floor(Math.random() * 9)), 2.76, 1.2, rnd(0.05, 0.09), 0.1 * k, rnd(-0.4, 0.4), { room: 0.4 })
}

// ------------------------------------------------------------------ labs, evidence, odometer

/** Lab slider: a soft detent for every step of the slider (24 per travel), pitched by the value on the harmonic 8 to 24 of the hum.
 *  Moving inside a step is silent, so a drag ticks like a ratchet instead of buzzing. */
export function vLabDrag(e: Eng, t: number, k: number, o: CueOpts) {
  const v = clamp(Number(o.value ?? 0.5)), key = String(o.param ?? 'p')
  const step = Math.round(v * 24), prev = e.labStep.get(key)
  if (prev && t - prev.at < 1.5) {
    if (prev.step === step) return
    if (Math.abs(v * 24 - prev.step) < 0.62) return // hysteresis: a value hovering on a step boundary does not flutter between two steps
  }
  e.labStep.set(key, { step, at: t })
  const f = hz(8 + Math.round(v * 16)), pan = (hash01(key) - 0.5) * 0.6
  const kn = osc(e, 'sine', f, t, 0.08)
  const ke = adsr(e, t, 0.22 * k, 0.0012, 0.032)
  kn.connect(ke); out(e, ke, e.ui, { pan, tube: 0.15 })
  const k2 = osc(e, 'sine', f * 2.76, t, 0.04)
  const k2e = adsr(e, t, 0.05 * k, 0.001, 0.014)
  k2.connect(k2e); out(e, k2e, e.ui, { pan })
  vTick(e, t, f * 2.3, 0.14 * k, pan, 5, e.ui)
}

/** Arbitrage flag. On: a low double buzz (a warning, not an alarm). Off: the relay lets go (a click and a short falling thud). */
export function vLabArb(e: Eng, t: number, k: number, o: CueOpts) {
  if (o.on === false) {
    vTick(e, t, 2300, 0.26 * k, 0, 5, e.ui)
    const d = osc(e, 'sine', 200, t, 0.3)
    sweep(d.frequency, 200, 88, t, 0.14)
    const de = adsr(e, t, 0.2 * k, 0.003, 0.12)
    d.connect(de); out(e, de, e.ui, { tube: 0.2 })
    vThud(e, t + 0.005, 92, 0.16 * k, 0.05, e.ui)
    return
  }
  for (const [d, ln] of [[0, 0.1], [0.17, 0.14]] as const) {
    const at = t + d
    const mix = gain(e, 1)
    for (const [f, a] of [[hz(2), 1], [hz(3) * 1.004, 0.7]] as const) {
      const o1 = osc(e, 'sawtooth', f, at, ln + 0.1); const g = gain(e, a); o1.connect(g); g.connect(mix)
    }
    const lp = bq(e, 'lowpass', 720, 2)
    const env = envGain(e)
    env.gain.setValueAtTime(0.0001, at); env.gain.linearRampToValueAtTime(0.16 * k, at + 0.012)
    env.gain.setValueAtTime(0.16 * k, at + ln - 0.015); env.gain.exponentialRampToValueAtTime(0.0001, at + ln + 0.04)
    mix.connect(lp); lp.connect(env); out(e, env, e.ui, { tube: 0.2 })
    const sub = osc(e, 'sine', hz(1), at, ln + 0.1)
    const sube = adsr(e, at, 0.16 * k, 0.01, ln)
    sub.connect(sube); out(e, sube, e.ui)
  }
  vTick(e, t, 1900, 0.22 * k, 0, 4, e.ui)
}

/** Paper flip: a fast riffle of air across the page, then the page landing (a soft slap with a little body). */
export function vEvidenceFlip(e: Eng, t: number, k: number) {
  const pan = rnd(-0.15, 0.15)
  const n = noiseNode(e, t, 0.12)
  const bp = bq(e, 'bandpass', 700, 0.9)
  bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(4200, t + 0.085)
  const am = gain(e, 0.6), lfo = osc(e, 'sine', 70, t, 0.12), ld = gain(e, 0.4)
  lfo.connect(ld); ld.connect(am.gain)
  const env = swell(e, t, 0.34 * k, 0.012, 0.075)
  n.connect(bp); bp.connect(am); am.connect(env); out(e, env, e.ui, { pan, tube: 0.12 })
  const sn = noiseNode(e, t + 0.088, 0.05)
  const sbp = bq(e, 'bandpass', 620, 1.1)
  const se = adsr(e, t + 0.088, 0.26 * k, 0.001, 0.028)
  sn.connect(sbp); sbp.connect(se); out(e, se, e.ui, { pan: pan * 0.5 })
  vThud(e, t + 0.09, 188, 0.1 * k, 0.04, e.ui)
}

/** Lens focus: a small motor whirr gliding up, and a soft click as it locks, with a thin glass ping on the lock. */
export function vEvidenceZoom(e: Eng, t: number, k: number, o: CueOpts) {
  const inn = !(o.dir !== undefined && Number(o.dir) < 0)
  const a = inn ? 1 : 1.6, b = inn ? 1.6 : 1
  const mo = osc(e, 'sawtooth', 170 * a, t, 0.3)
  sweep(mo.frequency, 170 * a, 170 * b, t, 0.15, true)
  const mlp = bq(e, 'lowpass', 1300, 1)
  const me = envGain(e)
  me.gain.setValueAtTime(0.0001, t); me.gain.linearRampToValueAtTime(0.1 * k, t + 0.02); me.gain.setValueAtTime(0.1 * k, t + 0.12); me.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
  mo.connect(mlp); mlp.connect(me); out(e, me, e.ui, { tube: 0.15 })
  const gl = osc(e, 'sine', hz(20) * a, t, 0.25)
  sweep(gl.frequency, hz(20) * a, hz(20) * b, t, 0.15, true)
  const ge = envGain(e)
  ge.gain.setValueAtTime(0.0001, t); ge.gain.linearRampToValueAtTime(0.07 * k, t + 0.03); ge.gain.setValueAtTime(0.07 * k, t + 0.12); ge.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
  gl.connect(ge); out(e, ge, e.ui, { tube: 0.2 })
  vTick(e, t + 0.16, 3600, 0.3 * k, 0, 7, e.ui)
  const ping = osc(e, 'sine', hz(inn ? 40 : 30), t + 0.16, 0.3)
  const pe = adsr(e, t + 0.16, 0.06 * k, 0.002, 0.1)
  ping.connect(pe); out(e, pe, e.ui, { tube: 0.3 })
}

/** Odometer tick: one dry mechanical detent, a hair different every time. Kept tiny so a fast count is a whisper of ratchet, not a stream of clicks. */
export function vCountTick(e: Eng, t: number, k: number) {
  vTick(e, t, 3000 * jit(0.06), 0.22 * k, 0, 9, e.ui)
  const o1 = osc(e, 'sine', 1750 * jit(0.04), t, 0.05)
  const oe = adsr(e, t, 0.06 * k, 0.001, 0.016)
  o1.connect(oe); out(e, oe, e.ui)
  const o2 = osc(e, 'sine', 420 * jit(0.04), t, 0.05)
  const o2e = adsr(e, t, 0.06 * k, 0.001, 0.014)
  o2.connect(o2e); out(e, o2e, e.ui)
}
