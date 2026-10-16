// PNEUMA v4 sound design: ONE family of sounds derived from the central TV.
//
// Raw Web Audio, no library (decision record: docs/research/sfx.md). Everything is synthesized;
// nothing autoplays. The engine is written once against BaseAudioContext, so the live site and the
// offline level checks (lab/sfx.html) run the exact same code.
//
// The family: the TV's mains hum is 60 Hz. Every pitch in the palette is a harmonic of 60 Hz
// (120, 180, 240 ... 960 ...), so the drones, plucks, glass and bowed tones are all "in tune with the TV".
// Surfaces own their sound: screen = hum/degauss/whine, glass = detuned inharmonic partials,
// particles = grains, camera = air bed whose filter follows speed.
//
// Chain: bed (ducked under UI) + fx + ui -> master -> HPF 28 Hz -> shelf -> compressor -> limiter -> soft clip -> out,
// with a short "tube" reverb (shared with sound.ts) and a longer dark "room" reverb as sends.
//
// Reduced motion: no air bed, no drones, no ambient events, no morph/flight sounds; only discrete UI
// sounds plus the power-on/off and a plain channel tick on arrival.
import { setSound } from '../state'
import {
  AREA_KEYS, MASTER, PREF, asArea, buildEngine, clamp, db, hz, jit, lerp, rnd,
  osc, sweep, gain, bq, noiseNode, adsr, swell, out, duckUnder,
  vThud, vChannel, vTick, vGlass, vPluck, grainFM, crackleBuf, vOakRelease,
  type AreaKey, type CueOpts, type Eng, type Drone, type Air, type Beds,
} from './kit'

import {
  vDetent, vChannelChirp, vButton, vHubPoweron, vHubPoweroff, vTvGrab, vTvSpin, vTvRelease, vPovGrab, vPovDrag, vPovRelease, vPovReturn,
  vTypeAssemble, vTypeShatter, vGlyphBurst, vBrainPulse, vLabDrag, vLabArb, vEvidenceFlip, vEvidenceZoom, vCountTick,
} from './voices-hub'
import { vSig, vTransObj, SIG_IDS, SIG_ALIAS, SIG_LEGACY, SIG_NAMES, TRANS_OBJ_IDS } from './voices-sig'
import { vGuitarPluck, vGuitarStrum } from './guitar'
import { musicUpdate, musicPump, stopMusic } from './music'

export { AREA_KEYS, buildEngine }
export type { AreaKey, CueOpts, Eng }

// ------------------------------------------------------------------ public types

/** speed: 0..1 normalized camera speed (negative = flying backwards). area: area the camera is at / flying toward.
 *  mix: 0..1 how settled the camera is at `area` (1 = dwelling). wp: float waypoint index (monotonic with scroll). t: seconds. */
export interface FlightState { speed: number; area: string; mix: number; wp: number; t: number
  /** a timed rail jump is flying: wp is only a rough position, so crossing waypoints must not fire a morph shimmer (the caller cues one morph itself) */
  quiet?: boolean }
export interface SceneEvent { t: number; flight?: FlightState; cue?: [string, CueOpts?] }

const V4_CUE_IDS = ['wind', 'poweron', 'poweroff', 'channel', 'morph', 'land', 'whoosh', 'wake', 'hover', 'click', 'open', 'close', ...AREA_KEYS] as const
/** v9 world and UI events: the names emitters use. sfx.cue(name, data) plays the matching sound; any other name is a no-op. */
export const EVENT_IDS = [
  'hub:detent', 'hub:channel', 'hub:button', 'hub:poweron', 'hub:poweroff', 'tv:grab', 'tv:spin', 'tv:release',
  'pov:grab', 'pov:drag', 'pov:release', 'pov:return', 'type:assemble', 'type:shatter', 'glyph:burst',
  'lab:drag', 'lab:arb', 'evidence:flip', 'evidence:zoom', 'count:tick', 'brain:pulse', 'guitar:pluck', 'guitar:strum', 'chalk:tap',
] as const
/** Arrival signatures 'sig.<id>': one per waypoint id (and its form-id aliases). Any other 'sig.<id>' plays a quiet default settle. */
export const SIG_CUE_IDS: string[] = SIG_IDS.map(i => `sig.${i}`)
/** Every id accepted by sfx.cue(). WAYPOINTS[].sound ids are a subset ('morph.<area>' and '.rev' variants also work). */
export const CUE_IDS: readonly string[] = [...V4_CUE_IDS, ...EVENT_IDS, ...SIG_CUE_IDS, ...TRANS_OBJ_IDS, 'tr:exit']
export const ALL_CUE_IDS: string[] = [...CUE_IDS]


// ------------------------------------------------------------------ set pieces: the TV itself

function vPoweron(e: Eng, t: number, k: number) {
  // degauss thump + a damped 60 Hz wobble (the shadow mask shaking)
  const th = osc(e, 'sine', 96, t, 0.6)
  sweep(th.frequency, 96, 42, t, 0.11)
  const the = adsr(e, t, 0.62 * k, 0.003, 0.34)
  th.connect(the); out(e, the, e.fx, { tube: 0.3, room: 0.25 })

  const wam = gain(e, 0.55)
  const lfo = osc(e, 'sine', 7.5, t, 0.9), depth = gain(e, 0.45)
  lfo.connect(depth); depth.connect(wam.gain)
  const wenv = adsr(e, t, 0.2 * k, 0.012, 0.62)
  for (const [f, a] of [[hz(1), 1], [hz(2), 0.7], [hz(3), 0.4]] as const) {
    const o = osc(e, 'sine', f, t, 0.9); const g = gain(e, a); o.connect(g); g.connect(wam)
  }
  wam.connect(wenv); out(e, wenv, e.fx, { tube: 0.3 })

  // raster opens: static sweeps up as the line becomes a picture
  const n = noiseNode(e, t, 0.5)
  const bp = bq(e, 'bandpass', 300, 0.8)
  bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(6500, t + 0.36)
  const hp = bq(e, 'highpass', 150)
  const ne = adsr(e, t + 0.005, 0.2 * k, 0.012, 0.4)
  n.connect(bp); bp.connect(hp); hp.connect(ne); out(e, ne, e.fx, { tube: 0.3 })

  // flyback whine rises, gently, then settles (the TV is on)
  const w = osc(e, 'sine', 11800, t, 2.5)
  sweep(w.frequency, 11800, 15400, t, 1.0)
  const we = e.ctx.createGain()
  we.gain.setValueAtTime(0, t); we.gain.linearRampToValueAtTime(0.034 * k, t + 0.75)
  we.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
  w.connect(we); out(e, we, e.fx)

  // warm harmonic pad: the hum's own overtones wake up
  for (const [n2, a] of [[2, 1], [3, 0.8], [4, 0.55]] as const) {
    const o = osc(e, 'sine', hz(n2), t + 0.15, 3.0)
    const g = swell(e, t + 0.15, 0.075 * k * a, 0.9, 1.5)
    o.connect(g); out(e, g, e.fx, { room: 0.5 })
  }
}

function vPoweroff(e: Eng, t: number, k: number) {
  // image collapses to a line: 1400 -> 40 Hz in 240 ms
  const o = osc(e, 'sine', 1400, t, 0.5)
  sweep(o.frequency, 1400, 40, t, 0.24)
  const env = e.ctx.createGain()
  env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(0.4 * k, t + 0.012)
  env.gain.setValueAtTime(0.4 * k, t + 0.2); env.gain.exponentialRampToValueAtTime(0.0001, t + 0.27)
  o.connect(env); out(e, env, e.fx, { tube: 0.3 })
  // the whine collapses with it
  const w = osc(e, 'sine', 15400, t, 0.4)
  sweep(w.frequency, 15400, 2600, t, 0.22)
  const we = gain(e, 0.04 * k); we.gain.setValueAtTime(0.04 * k, t + 0.1); we.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
  w.connect(we); out(e, we, e.fx)
  // snow closing in
  const n = noiseNode(e, t, 0.35)
  const bp = bq(e, 'bandpass', 3200, 1.1)
  bp.frequency.setValueAtTime(3200, t); bp.frequency.exponentialRampToValueAtTime(900, t + 0.24)
  const ne = adsr(e, t, 0.1 * k, 0.01, 0.24)
  n.connect(bp); bp.connect(ne); out(e, ne, e.fx)
  // pop as the line becomes a dot
  const pn = noiseNode(e, t + 0.24, 0.03)
  const hp = bq(e, 'highpass', 1500)
  const pe = adsr(e, t + 0.24, 0.34 * k, 0.0006, 0.012)
  pn.connect(hp); hp.connect(pe); out(e, pe, e.fx, { tube: 0.4 })
  vThud(e, t + 0.24, 70, 0.55 * k, 0.11)
  // the phosphor dot rings out and fades
  const d = osc(e, 'sine', 1900, t + 0.25, 1.8)
  const de = adsr(e, t + 0.25, 0.03 * k, 0.012, 1.3)
  d.connect(de); out(e, de, e.fx, { room: 0.6, tube: 0.3 })
  // low exhale
  const s = osc(e, 'sine', 80, t + 0.26, 0.9); sweep(s.frequency, 80, 48, t + 0.26, 0.54)
  const se = swell(e, t + 0.26, 0.16 * k, 0.05, 0.6)
  s.connect(se); out(e, se, e.fx, { room: 0.3 })
}

function vWind(e: Eng, t: number, k: number, pan = 0) {
  const dur = 3.4
  const n = noiseNode(e, t, dur, true)
  const bp = bq(e, 'bandpass', 260, 0.9)
  bp.frequency.setValueAtTime(260, t); bp.frequency.linearRampToValueAtTime(780, t + 1.6); bp.frequency.linearRampToValueAtTime(520, t + dur)
  const lp = bq(e, 'lowpass', 2200)
  const env = swell(e, t, 0.9 * k, 1.1, 2.2)
  const p = e.ctx.createStereoPanner()
  p.pan.setValueAtTime(clamp(pan - 0.5, -1, 1), t); p.pan.linearRampToValueAtTime(clamp(pan + 0.5, -1, 1), t + dur)
  n.connect(bp); bp.connect(lp); lp.connect(env); env.connect(p)
  p.connect(e.fx); const s = gain(e, 0.4); p.connect(s); s.connect(e.room)
  // thin high gusts riding on top
  const n2 = noiseNode(e, t, dur, true)
  const b2 = bq(e, 'bandpass', 1500, 1.4); sweep(b2.frequency, 1500, 2400, t, dur, true)
  const e2 = swell(e, t + 0.2, 0.26 * k, 1.3, 1.8)
  const am = gain(e, 0.7), lfo = osc(e, 'sine', 0.7, t, dur + 0.5), ld = gain(e, 0.3)
  lfo.connect(ld); ld.connect(am.gain)
  n2.connect(b2); b2.connect(e2); e2.connect(am); out(e, am, e.fx, { pan: -pan * 0.4, room: 0.3 })
}

function vWhoosh(e: Eng, t: number, rev: boolean, k: number, pan = 0) {
  const r = rev ? 0.8 : 1
  const n = noiseNode(e, t, 1.0, true)
  const bp = bq(e, 'bandpass', 250 * r, 1.0)
  bp.frequency.setValueAtTime(250 * r, t); bp.frequency.exponentialRampToValueAtTime(3200 * r, t + 0.48); bp.frequency.exponentialRampToValueAtTime(500 * r, t + 0.95)
  const env = swell(e, t, 0.75 * k, 0.4, 0.5)
  const p = e.ctx.createStereoPanner()
  const d = rev ? -1 : 1
  p.pan.setValueAtTime(clamp(pan - 0.35 * d, -1, 1), t); p.pan.linearRampToValueAtTime(clamp(pan + 0.35 * d, -1, 1), t + 0.95)
  n.connect(bp); bp.connect(env); env.connect(p); p.connect(e.fx)
  const s = gain(e, 0.25); p.connect(s); s.connect(e.tube)
}

/** The small TVs waking one after another (about 0.34 s per area, six areas): ONE cue, a rising run on the 60 Hz series with a soft static bloom under it. */
function vWake(e: Eng, t: number, k: number) {
  const seq = [8, 9, 10, 12, 15, 16]
  seq.forEach((n, i) => {
    const at = t + i * 0.34, f = hz(n)
    const o = osc(e, 'sine', f, at, 0.5)
    const env = adsr(e, at, (0.05 + 0.012 * i) * k, 0.004, 0.16)
    o.connect(env); out(e, env, e.fx, { tube: 0.35, room: 0.3, pan: (i - 2.5) * 0.14 })
    vTick(e, at, 3200 + i * 380, 0.1 * k, (i - 2.5) * 0.14, 6)
  })
  const n = noiseNode(e, t, 2.3)
  const bp = bq(e, 'bandpass', 1600, 0.6)
  bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(5200, t + 2.0)
  const ne = swell(e, t, 0.05 * k, 1.1, 1.0)
  n.connect(bp); bp.connect(ne); out(e, ne, e.fx, { room: 0.3 })
}

// ------------------------------------------------------------------ per-area voices

/** Morph shimmer: the texture while particles stream from one form to the next. ~1 s, peaks at the middle. */
function vShimmer(e: Eng, t: number, area: AreaKey, rev: boolean, k0: number, pan = 0) {
  const k = k0 * MORPH_TRIM[area]
  const r = rev ? 0.8 : 1
  const uOf = (i: number, n: number) => (rev ? 1 - i / (n - 1) : i / (n - 1))
  switch (area) {
    case 'mind': { // glassy FM grains: inharmonic partials of the 60 Hz series, rising (falling when reversed)
      const car = [hz(12), hz(18), hz(27), hz(36), hz(45)], N = 18
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1), p = uOf(i, N)
        const f = car[Math.min(car.length - 1, Math.floor(p * (car.length - 1) + Math.random() * 1.4))] * r
        grainFM(e, t + u * 0.95, f, 2.76, 1.4 * (1 - 0.6 * u), rnd(0.09, 0.17), 0.075 * k * Math.pow(Math.sin(Math.PI * u), 1.4), pan + rnd(-0.6, 0.6), { room: 0.4 })
      }
      break
    }
    case 'systems': { // tight micro-ticks that accelerate then settle
      let tt = 0
      const N = 18
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1)
        vTick(e, t + tt, rnd(2200, 5600) * r, 0.2 * k * (0.35 + 0.65 * Math.sin(Math.PI * u)), pan + rnd(-0.5, 0.5), 4)
        tt += 0.075 - 0.053 * Math.sin(Math.PI * u)
      }
      break
    }
    case 'research': { // soft bowed tones
      for (const [n2, d] of [[5, 0], [6, 0.05], [7, 0.16]] as const) {
        for (const dt of [0.998, 1.002]) {
          const f = hz(n2) * dt * r
          const o = osc(e, 'sawtooth', f, t + d, 1.6)
          const vib = osc(e, 'sine', 5 + Math.random() * 0.4, t + d, 1.6), vd = gain(e, f * 0.003)
          vib.connect(vd); vd.connect(o.frequency)
          const lp = bq(e, 'lowpass', 1100, 0.7)
          const g = swell(e, t + d, 0.04 * k, 0.4, 0.55, 0.1)
          o.connect(lp); lp.connect(g); out(e, g, e.fx, { pan: pan + rnd(-0.3, 0.3), room: 0.4 })
        }
      }
      break
    }
    case 'work': { // low pulses, crescendo (decrescendo when reversed)
      const amps = [0.32, 0.5, 0.7]
      if (rev) amps.reverse()
      for (let i = 0; i < 3; i++) vThud(e, t + i * 0.17, 74 * r, amps[i] * k, 0.14)
      const n = noiseNode(e, t, 0.9)
      const lp = bq(e, 'lowpass', 230)
      const ne = swell(e, t, 0.2 * k, 0.45, 0.4)
      n.connect(lp); lp.connect(ne); out(e, ne, e.fx)
      break
    }
    case 'education': { // lyre cascade
      const seq = [8, 10, 12, 15, 16].map(n2 => hz(n2) * r)
      if (rev) seq.reverse()
      seq.forEach((f, i) => vPluck(e, t + i * 0.085, f, 0.3 * k * (1 - i * 0.09), pan + (i - 2) * 0.18))
      break
    }
    case 'about': { // warm vinyl crackle swells under a soft pad
      const n = e.ctx.createBufferSource(); n.buffer = crackleBuf(e.ctx); n.loop = true; n.start(t, Math.random() * 2, 1.6)
      const bp = bq(e, 'bandpass', 1500, 0.55)
      const env = swell(e, t, 0.6 * k, 0.28, 0.75)
      n.connect(bp); bp.connect(env); out(e, env, e.fx, { pan, tube: 0.15 })
      for (const n2 of [3, 4, 5]) {
        const o = osc(e, 'sine', hz(n2) * r, t, 1.3)
        const g = swell(e, t, 0.055 * k, 0.45, 0.7)
        o.connect(g); out(e, g, e.fx, { room: 0.45 })
      }
      break
    }
    default: { // hub: sparse light grains
      const car = [hz(4), hz(6), hz(8)], N = 9
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1)
        grainFM(e, t + u * 0.9, car[i % 3] * r * (rev ? 0.5 : 1), 2.0, 0.8, rnd(0.1, 0.18), 0.06 * k * Math.sin(Math.PI * u), pan + rnd(-0.4, 0.4), { room: 0.4 })
      }
    }
  }
}


/** Arrival: a landing + a short tonal settle that is the area's signature. */
function vArrive(e: Eng, t: number, area: AreaKey, k0: number, pan = 0) {
  const k = k0 * ARRIVE_TRIM[area]
  vChannel(e, t, k * 0.7, pan, 0.6)
  switch (area) {
    case 'mind':
      vThud(e, t + 0.01, 84, 0.2 * k, 0.12)
      vGlass(e, t + 0.03, hz(12), 0.2 * k, pan - 0.15); vGlass(e, t + 0.09, hz(18), 0.13 * k, pan + 0.2)
      break
    case 'systems':
      vThud(e, t + 0.01, 96, 0.22 * k, 0.07)
      vTick(e, t + 0.02, 3100, 0.5 * k, pan - 0.2, 7); vTick(e, t + 0.075, 4200, 0.4 * k, pan + 0.2, 7)
      break
    case 'research': {
      vThud(e, t + 0.01, 78, 0.16 * k, 0.12)
      for (const [n2, d] of [[5, 0], [6, 0.03]] as const) {
        for (const dt of [0.998, 1.002]) {
          const o = osc(e, 'sawtooth', hz(n2) * dt, t + d, 2)
          const lp = bq(e, 'lowpass', 850, 0.7)
          const g = swell(e, t + d, 0.06 * k, 0.22, 1.2)
          o.connect(lp); lp.connect(g); out(e, g, e.fx, { pan: pan + (dt - 1) * 80, room: 0.5 })
        }
      }
      break
    }
    case 'work':
      vThud(e, t + 0.01, 62, 0.5 * k, 0.2); vThud(e, t + 0.23, 56, 0.4 * k, 0.24)
      break
    case 'education':
      vThud(e, t + 0.01, 88, 0.1 * k, 0.08)
      vPluck(e, t + 0.02, hz(8), 0.42 * k, pan - 0.2); vPluck(e, t + 0.12, hz(12), 0.34 * k, pan + 0.1); vPluck(e, t + 0.22, hz(16), 0.28 * k, pan + 0.25)
      break
    case 'about': {
      vThud(e, t + 0.0, 54, 0.4 * k, 0.12) // stylus drop
      const n = e.ctx.createBufferSource(); n.buffer = crackleBuf(e.ctx); n.loop = true; n.start(t, Math.random() * 2, 1.4)
      const bp = bq(e, 'bandpass', 1700, 0.5)
      const env = swell(e, t, 0.55 * k, 0.1, 1.1)
      n.connect(bp); bp.connect(env); out(e, env, e.fx, { pan })
      for (const n2 of [3, 4, 5]) {
        const o = osc(e, 'sine', hz(n2), t + 0.05, 2.4)
        const g = swell(e, t + 0.05, 0.06 * k, 0.5, 1.4)
        o.connect(g); out(e, g, e.fx, { room: 0.5 })
      }
      break
    }
    default:
      vThud(e, t + 0.01, 70, 0.22 * k, 0.12)
      for (const n2 of [2, 3]) { const o = osc(e, 'sine', hz(n2), t, 1.6); const g = swell(e, t, 0.08 * k, 0.2, 1.1); o.connect(g); out(e, g, e.fx, { room: 0.5 }) }
  }
}

// ------------------------------------------------------------------ UI voices

function vHover(e: Eng, t: number, k: number) {
  const f = 2600 * jit(0.04)
  const n = noiseNode(e, t, 0.01)
  const bp = bq(e, 'bandpass', f, 3)
  const ne = adsr(e, t, 0.1 * k, 0.0005, 0.004)
  n.connect(bp); bp.connect(ne); out(e, ne, e.ui, { tube: 0.1 })
  const o = osc(e, 'sine', 2100 * jit(0.03), t, 0.04)
  const oe = adsr(e, t, 0.035 * k, 0.001, 0.014)
  o.connect(oe); out(e, oe, e.ui, { tube: 0.1 })
}
function vClick(e: Eng, t: number, k: number) {
  duckUnder(e, t, 0.6, 0.12)
  const n = noiseNode(e, t, 0.03)
  const bp = bq(e, 'bandpass', 3200, 1.3)
  const ne = adsr(e, t, 0.3 * k, 0.0006, 0.011)
  n.connect(bp); bp.connect(ne); out(e, ne, e.ui, { tube: 0.15 })
  const o = osc(e, 'sine', 1200, t, 0.1)
  const oe = adsr(e, t, 0.15 * k, 0.001, 0.05)
  o.connect(oe); out(e, oe, e.ui, { tube: 0.15 })
  const lo = osc(e, 'sine', 160, t, 0.06)
  const le = adsr(e, t, 0.12 * k, 0.001, 0.025)
  lo.connect(le); out(e, le, e.ui)
}
function vOpen(e: Eng, t: number, k: number) {
  duckUnder(e, t, 0.5, 0.5)
  // the tube swells as the camera pushes into the screen
  const n = noiseNode(e, t, 0.7)
  const bp = bq(e, 'bandpass', 220, 1.3)
  bp.frequency.setValueAtTime(220, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.5)
  const ne = swell(e, t, 0.3 * k, 0.4, 0.22)
  n.connect(bp); bp.connect(ne); out(e, ne, e.ui, { tube: 0.35, room: 0.25 })
  const o = osc(e, 'sine', 90, t, 0.7); sweep(o.frequency, 90, 200, t, 0.5)
  const oe = swell(e, t, 0.28 * k, 0.42, 0.2)
  o.connect(oe); out(e, oe, e.ui, { tube: 0.3 })
  vGlass(e, t + 0.46, hz(24), 0.06 * k, 0, e.ui)
}
function vClose(e: Eng, t: number, k: number) {
  duckUnder(e, t, 0.55, 0.35)
  const n = noiseNode(e, t, 0.5)
  const bp = bq(e, 'bandpass', 1800, 1.2)
  bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(160, t + 0.32)
  const ne = swell(e, t, 0.26 * k, 0.05, 0.28)
  n.connect(bp); bp.connect(ne); out(e, ne, e.ui, { tube: 0.35, room: 0.2 })
  const o = osc(e, 'sine', 200, t, 0.5); sweep(o.frequency, 200, 70, t, 0.3)
  const oe = swell(e, t, 0.22 * k, 0.04, 0.26)
  o.connect(oe); out(e, oe, e.ui, { tube: 0.3 })
  vThud(e, t + 0.3, 78, 0.28 * k, 0.07, e.ui)
}

// ------------------------------------------------------------------ continuous beds

interface DroneSpec { h: number[]; type: OscillatorType; lp: number; level: number; pulse?: number; vib?: number; tape?: number; crackle?: boolean; spread?: number; beat?: number }
/** harmonic numbers of the 60 Hz series; level = linear gain at the drone bus (calibrated in lab/sfx.html) */
const DRONES: Record<AreaKey, DroneSpec> = {
  hub: { h: [2, 3, 4], type: 'sine', lp: 900, level: 0.007 },
  mind: { h: [4, 6, 9, 15], type: 'sine', lp: 2400, level: 0.0102, beat: 0.35, spread: 0.5 },
  systems: { h: [2, 3, 4, 6], type: 'triangle', lp: 800, level: 0.0157, pulse: 3.0 },
  research: { h: [3, 4, 5, 7], type: 'sawtooth', lp: 480, level: 0.0127, vib: 4.6, beat: 0.25 },
  work: { h: [1, 2, 3], type: 'sine', lp: 600, level: 0.0126, pulse: 0.8 },
  education: { h: [4, 5, 6, 8], type: 'sine', lp: 2000, level: 0.0095, spread: 0.6, beat: 0.2 },
  about: { h: [3, 4, 5, 6], type: 'sine', lp: 1600, level: 0.0091, tape: 0.35, crackle: true },
}

function makeDrone(e: Eng, area: AreaKey): Drone {
  const sp = DRONES[area], c = e.ctx, t0 = c.currentTime
  const out_ = gain(e, 0)
  const nodes: AudioScheduledSourceNode[] = []
  const lp = bq(e, 'lowpass', sp.lp, 0.6)
  const am = gain(e, sp.pulse ? 0.55 : 1)
  lp.connect(am); am.connect(out_)
  if (sp.pulse) {
    const l = c.createOscillator(); l.frequency.value = sp.pulse; const d = gain(e, 0.45); l.connect(d); d.connect(am.gain); l.start(t0); nodes.push(l)
  }
  sp.h.forEach((h, i) => {
    const f = hz(h)
    const a = 1 / Math.pow(h, 0.45)
    const pan = sp.spread ? (i / Math.max(1, sp.h.length - 1) - 0.5) * 2 * sp.spread : 0
    const voice = gain(e, a * 0.5)
    const p = c.createStereoPanner(); p.pan.value = pan
    for (const sgn of [-1, 1]) {
      const o = c.createOscillator(); o.type = sp.type
      o.frequency.value = f + sgn * (sp.beat ?? 0.18) * 0.5
      if (sp.vib) { const v = c.createOscillator(); v.frequency.value = sp.vib * jit(0.06); const vd = gain(e, f * 0.002); v.connect(vd); vd.connect(o.frequency); v.start(t0); nodes.push(v) }
      if (sp.tape) { const v = c.createOscillator(); v.frequency.value = sp.tape * jit(0.2); const vd = gain(e, 4); v.connect(vd); vd.connect(o.detune); v.start(t0); nodes.push(v) }
      o.start(t0); nodes.push(o); o.connect(voice)
    }
    voice.connect(p); p.connect(lp)
  })
  if (sp.type === 'sawtooth') { // slow bow-swell on the cutoff
    const l = c.createOscillator(); l.frequency.value = 0.09; const d = gain(e, 160); l.connect(d); d.connect(lp.frequency); l.start(t0); nodes.push(l)
  }
  out(e, out_, e.bed, { room: 0.35 })
  if (sp.crackle) { // the vinyl surface under the About chord
    const s = c.createBufferSource(); s.buffer = crackleBuf(c); s.loop = true; s.start(t0)
    const bp = bq(e, 'bandpass', 1800, 0.5), g = gain(e, 0.5)
    s.connect(bp); bp.connect(g); g.connect(out_); nodes.push(s)
  }
  return { out: out_, nodes, idleSince: Infinity }
}

function ensureBeds(e: Eng): Beds {
  if (e.beds) return e.beds
  const c = e.ctx, t0 = c.currentTime
  // air bed: pink body + a thinner whoosh layer, both following camera speed
  const body = c.createBufferSource(); body.buffer = e.pink; body.loop = true; body.start(t0, Math.random() * 3)
  const bp = bq(e, 'bandpass', 220, 0.7), g = gain(e, 0)
  const whoosh = c.createBufferSource(); whoosh.buffer = e.noise; whoosh.loop = true; whoosh.start(t0, Math.random())
  const bp2 = bq(e, 'bandpass', 1400, 1.2), g2 = gain(e, 0)
  const pan = c.createStereoPanner()
  body.connect(bp); bp.connect(g); g.connect(pan)
  whoosh.connect(bp2); bp2.connect(g2); g2.connect(pan)
  pan.connect(e.bed)
  const air: Air = { bp, bp2, g, g2, pan, srcs: [body, whoosh] }
  // hum: the TV's mains hum (60 Hz series) and a barely-there flyback whine
  const hg = gain(e, 0), fl = gain(e, 0.75)
  const humLp = bq(e, 'lowpass', 520, 0.5)
  for (const [n, a, dt] of [[1, 0.7, 0], [1, 0.4, 0.07], [2, 0.5, 0], [3, 0.4, 0.05], [4, 0.28, 0], [5, 0.16, 0.04]] as const) {
    const o = c.createOscillator(); o.frequency.value = hz(n) + dt; const og = gain(e, a * 0.35); o.connect(og); og.connect(humLp); o.start(t0)
  }
  const flutter = c.createOscillator(); flutter.frequency.value = 0.07; const fd = gain(e, 0.25); flutter.connect(fd); fd.connect(fl.gain); flutter.start(t0)
  humLp.connect(fl); fl.connect(hg); out(e, hg, e.bed, { room: 0.2 })
  const wh = c.createOscillator(); wh.frequency.value = 15700; const wg = gain(e, 0); wh.connect(wg); wg.connect(e.bed); wh.start(t0)
  e.beds = { air, hum: { g: hg, whine: wg }, drones: new Map() }
  return e.beds
}

function stopBeds(e: Eng) {
  stopMusic(e)
  const t0 = e.ctx.currentTime
  for (const v of e.cont.values()) { v.out.gain.setTargetAtTime(0, t0, 0.03); for (const n of v.nodes) { try { n.stop(t0 + 0.3) } catch { /* */ } } }
  e.cont.clear()
  const b = e.beds; if (!b) return
  const t = e.ctx.currentTime
  for (const s of b.air.srcs) { try { s.stop(t) } catch { /* already stopped */ } }
  for (const d of b.drones.values()) for (const n of d.nodes) { try { n.stop(t) } catch { /* */ } }
  e.beds = null
}

/** Update every continuous layer from the flight state. `at` is the audio-clock time to schedule against. */
function flight(e: Eng, s: FlightState, at: number) {
  const beds = ensureBeds(e)
  if (!e.seen) { e.seen = true; e.lastWp = s.wp } // first frame (deep link / late init) must not read as a waypoint crossing
  const sp = clamp(Math.abs(s.speed))
  const d = s.wp - e.lastWp
  if (Math.abs(d) > 1e-4) e.dir = d > 0 ? 1 : -1
  const area = asArea(s.area)
  // TV state: powered off by the epilogue, back on if the visitor scrolls back, on once past the name
  if (e.forcedOff && s.wp < e.offWp - 0.4) e.forcedOff = false
  if (!e.forcedOff && (s.wp >= 1 || area !== 'hub')) e.tvOn = true
  const reduced = e.reduced

  // air bed: cutoff 200 Hz -> 4 kHz with speed, level up ~28 dB; pitch-down + darker when flying backwards
  const rev = s.speed < 0 || (e.dir < 0 && sp > 0.02)
  const k = rev ? 0.8 : 1
  const prologue = s.wp < 1
  const fc = 200 * Math.pow(20, Math.pow(sp, 0.9)) * k
  const floor = prologue ? db(-38) : db(-60)
  const lvl = reduced ? 0 : (floor + (db(-19) - floor) * Math.pow(sp, 1.7)) * Math.pow(200 / Math.max(200, fc), 0.15)
  const tc = sp > 0.05 ? 0.07 : 0.22
  const A = beds.air
  A.bp.frequency.setTargetAtTime(fc, at, tc)
  A.bp2.frequency.setTargetAtTime(Math.min(7000, fc * 1.9), at, tc)
  A.g.gain.setTargetAtTime(lvl, at, tc)
  A.g2.gain.setTargetAtTime(reduced ? 0 : lvl * 0.55 * Math.pow(sp, 0.8), at, tc)
  A.pan.pan.setTargetAtTime(clamp(e.dir * (0.12 + 0.38 * sp), -0.6, 0.6) * (sp > 0.02 ? 1 : 0), at, 0.15)
  for (const src of A.srcs) src.playbackRate.setTargetAtTime(rev ? 0.8 : 1, at, 0.12)

  // hum + whine: present while the TV is on
  const on = e.tvOn && !reduced
  beds.hum.g.gain.setTargetAtTime(on ? db(-39) : 0, at, 0.6)
  beds.hum.whine.gain.setTargetAtTime(on ? db(-62) : 0, at, 0.8)

  // area drones crossfade; the active one is dimmed while the camera is in flight
  for (const a of AREA_KEYS) {
    const active = on && a === area
    if (active) { let dr = beds.drones.get(a); if (!dr) { dr = makeDrone(e, a); beds.drones.set(a, dr) } }
    const dr = beds.drones.get(a)
    if (!dr) continue
    const target = active ? DRONES[a].level * (0.35 + 0.65 * clamp(s.mix)) * (1 - 0.4 * sp) : 0
    dr.out.gain.setTargetAtTime(target, at, active ? 0.75 : 0.9)
    dr.idleSince = active ? Infinity : (dr.idleSince === Infinity ? at : dr.idleSince)
  }

  // the music bed: one chord per area, crossfaded like the drones, notes launched by musicPump
  musicUpdate(e, at, area, s.mix, sp, on)

  // morph shimmer: one per waypoint crossing at p ~ 0.52 of the leg (no per-form ticks; rail jumps get one)
  const crossed = Math.floor(s.wp - 0.52) !== Math.floor(e.lastWp - 0.52)
  if (crossed && !s.quiet && sp > 0.04 && !reduced && at - e.lastMorph > 0.9) {
    const same = area === e.lastMorphArea
    tracer?.({ id: 'shimmer', at, k: same ? 0.65 : 1 })
    vShimmer(e, at + 0.01, area, e.dir < 0, same ? 0.65 : 1, 0)
    e.lastMorph = at; e.lastMorphArea = area
  }
  e.lastWp = s.wp
  e.area = area
}

/** Sparse ambient events that make a dwelling area feel alive. Called by the live scheduler (and the lab). */
function ambient(e: Eng, area: AreaKey, at: number): number {
  switch (area) {
    case 'mind': vGlass(e, at, hz(([24, 27, 30, 36, 45] as const)[Math.floor(Math.random() * 5)]), 0.03, rnd(-0.7, 0.7)); return rnd(3.5, 7)
    case 'systems': { const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) vTick(e, at + i * rnd(0.05, 0.11), rnd(2400, 5200), 0.11, rnd(-0.6, 0.6), 9); return rnd(2.2, 5) }
    case 'education': vPluck(e, at, hz(([8, 9, 10, 12, 15, 16, 18, 20] as const)[Math.floor(Math.random() * 8)]), 0.11, rnd(-0.5, 0.5)); return rnd(2.8, 5.5)
    default: return 8
  }
}

// ------------------------------------------------------------------ cue router

/** Per-cue trims (linear), set from the offline LUFS report in lab/sfx.html so the palette sits in one loudness family:
 *  set pieces (power on/off) momentary <= -14 LUFS, arrivals about -21, morph textures about -23, UI well below. */
const TRIM_V4: Record<string, number> = { poweron: 0.75, poweroff: 0.27, wind: 0.5, click: 0.4, open: 0.35, close: 0.6, whoosh: 1, hover: 1.2, land: 1, channel: 1, wake: 1 }
/** v9 trims, one per cue (see TARGETS in cuetable.ts): `node scripts/sfx-check.mjs --trims out.json` measures every cue and writes the multipliers that put it on its target peak or loudness. */
const TRIM_V9: Record<string, number> = {
  // TRIMS:BEGIN
  'brain:pulse': 0.418, 'count:tick': 0.534, 'evidence:flip': 0.901, 'evidence:zoom': 0.466,
  'glyph:burst': 0.565, 'hub:button:down': 0.551, 'hub:button:up': 0.66, 'hub:channel': 0.717,
  'hub:detent': 0.681, 'hub:poweroff': 0.192, 'hub:poweron': 0.337, 'lab:arb:off': 0.444,
  'lab:arb:on': 0.315, 'lab:drag': 0.468, 'pov:drag': 0.333, 'pov:grab': 0.543,
  'pov:release': 0.74, 'pov:return': 0.616, 'tv:grab': 0.808, 'tv:release': 0.667,
  'tv:spin': 0.663, 'type:assemble': 0.366, 'type:shatter': 0.413, 'sig.alarm': 0.326,
  'sig.appfolio': 0.243, 'sig.chomchom': 0.606, 'sig.cloudflare': 0.466, 'sig.default': 0.375,
  'sig.drill': 0.399, 'sig.instrument': 1.436, 'sig.knight': 0.58, 'sig.market': 0.252,
  'sig.mathecon': 1.531, 'sig.meeple': 0.889, 'sig.mind': 0.616, 'sig.pair': 0.532,
  'sig.reader': 0.263, 'sig.record': 0.504, 'sig.records': 0.369, 'sig.recruiting': 0.338,
  'sig.school': 0.481, 'sig.secretary': 0.278, 'sig.surface': 0.32, 'sig.table': 0.947,
  'sig.watchdog': 0.375, 'sig.guitar': 0.26, 'guitar:pluck': 0.39, 'guitar:strum': 0.17, 'tr:exit': 0.04,
  // TRIMS:END
}
export const TRIM: Record<string, number> = { ...TRIM_V4, ...TRIM_V9 }
const ARRIVE_TRIM: Record<AreaKey, number> = { hub: 0.5, mind: 0.5, systems: 1.5, research: 0.9, work: 0.45, education: 0.32, about: 0.5 }
const MORPH_TRIM: Record<AreaKey, number> = { hub: 1, mind: 0.63, systems: 4.2, research: 0.7, work: 0.35, education: 0.25, about: 0.5 }
/** Minimum ms between two identical cues. Scroll-driven cues (arrivals, power, channel, whoosh, morph, wake) never repeat within 600 ms (the default);
 *  UI and continuous events are only de-bounced, and the continuous ones (spin, drag) are steered, not retriggered, so this is just a floor. */
const GAP: Record<string, number> = {
  hover: 200, click: 40, open: 120, close: 120,
  'hub:detent': 28, 'hub:channel': 90, 'hub:button': 35, 'tv:grab': 140, 'tv:spin': 30, 'tv:release': 140,
  'pov:grab': 140, 'pov:drag': 30, 'pov:release': 140, 'pov:return': 450, 'type:assemble': 350, 'type:shatter': 350, 'glyph:burst': 250,
  'lab:drag': 22, 'lab:arb': 120, 'evidence:flip': 110, 'evidence:zoom': 150, 'count:tick': 28, 'brain:pulse': 900, 'guitar:pluck': 30, 'guitar:strum': 400,
}
/** Events that stay audible under reduced motion: discrete answers to a deliberate action. Continuous or animated sounds (spin, drag, return,
 *  type, glyphs, odometer) are not here and are dropped. */
const REDUCED_OK = new Set([
  'poweron', 'poweroff', 'channel', 'hover', 'click', 'open', 'close',
  'hub:detent', 'hub:channel', 'hub:button', 'hub:poweron', 'hub:poweroff', 'tv:grab', 'tv:release', 'lab:drag', 'lab:arb', 'evidence:flip', 'evidence:zoom', 'guitar:pluck',
])
const lastCue = new Map<string, number>()
/** Test/QA hook: called for every sound that is actually scheduled (cues and the flight's morph shimmer). */
export type CueTrace = (ev: { id: string; at: number; k: number }) => void
let tracer: CueTrace | null = null

/** the front-panel power buttons drive the same TV state as the story's power cues, so hum, drones and the music bed follow the screen */
function tvPower(e: Eng, on: boolean) {
  if (on) { e.tvOn = true; e.forcedOff = false; e.offWp = Infinity } else { e.tvOn = false; e.forcedOff = true; e.offWp = e.lastWp }
}
/** the de-bounce key: payload variants that are different sounds (button A down vs B up, arb on vs off, one slider vs another) do not block each other */
function cueKey(id: string, o?: CueOpts): string {
  const c = id === 'hub:poweron' ? 'poweron' : id === 'hub:poweroff' ? 'poweroff' : id
  if (!o) return c
  return `${c}|${o.which ?? ''}${o.down === undefined ? '' : o.down ? 'd' : 'u'}${o.on === undefined ? '' : o.on ? '1' : '0'}${o.param ?? ''}`
}

/** The key a cue's trim is stored under: a payload variant that sounds like a different thing (button down vs up, arb on vs off) and a signature's canonical id. */
export function trimKey(id: string, o: CueOpts = {}): string {
  if (id === 'hub:button') return `hub:button:${o.down === false ? 'up' : 'down'}`
  if (id === 'lab:arb') return `lab:arb:${o.on === false ? 'off' : 'on'}`
  if (id.startsWith('sig.')) { const sid = id.slice(4), c = SIG_ALIAS[sid] ?? sid; return SIG_NAMES.includes(c) || c in SIG_LEGACY ? `sig.${c}` : 'sig.default' }
  return id
}
const trimFor = (id: string, o: CueOpts) => TRIM[trimKey(id, o)] ?? TRIM[id.split('.')[0]] ?? 1

function cueAt(e: Eng, id: string, at: number, o: CueOpts = {}) {
  tracer?.({ id, at, k: clamp(o.intensity ?? 1, 0, 2) * trimFor(id, o) })
  playCue(e, id, at, o)
}
function playCue(e: Eng, id: string, at: number, o: CueOpts) {
  const [head, ...rest] = id.split('.')
  const k = clamp(o.intensity ?? 1, 0, 2) * trimFor(id, o), pan = o.pan ?? 0
  const restArea = rest.find(r => (AREA_KEYS as string[]).includes(r))
  const isRev = rest.includes('rev')
  const reduced = e.reduced
  const isArea = (AREA_KEYS as string[]).includes(head)
  if (reduced && !REDUCED_OK.has(head) && !isArea) {
    if (head === 'sig') vChannel(e, at, k, pan, 0.8) // an arrival under reduced motion is a plain channel tick
    return
  }
  if (id === 'tr:exit') { vOakRelease(e, at, k, pan); return }                    // the hall's far doors let go (kit.ts)
  if (id.startsWith('tr:') || id.startsWith('obj:')) { vTransObj(e, at, id, k, pan); return } // transitions and objects: voices-sig TRANS_OBJ
  switch (head) {
    case 'wind': vWind(e, at, k, pan); break
    case 'poweron': vPoweron(e, at, k); tvPower(e, true); break
    case 'poweroff': vPoweroff(e, at, k); tvPower(e, false); break
    case 'channel': vChannel(e, at, k, pan); break
    case 'morph': vShimmer(e, at, asArea(restArea ?? e.area), isRev, k, pan); break
    case 'land': vThud(e, at, 72, 0.3 * k, 0.12); break
    case 'whoosh': vWhoosh(e, at, isRev, k, pan); break
    case 'wake': vWake(e, at, k); break
    case 'hover': vHover(e, at, k); break
    case 'click': vClick(e, at, k); break
    case 'open': vOpen(e, at, k); break
    case 'close': vClose(e, at, k); break
    // v9: the hub TV
    case 'hub:detent': vDetent(e, at, k, o); break
    case 'hub:channel': vChannelChirp(e, at, k, o); break
    case 'hub:button': vButton(e, at, k, o); break
    case 'hub:poweron': vHubPoweron(e, at, k); tvPower(e, true); break
    case 'hub:poweroff': vHubPoweroff(e, at, k); tvPower(e, false); break
    // v9: the small TVs, the point of view
    case 'tv:grab': vTvGrab(e, at, k, o); break
    case 'tv:spin': vTvSpin(e, at, k, o); break
    case 'tv:release': vTvRelease(e, at, k, o); break
    case 'pov:grab': vPovGrab(e, at, k); break
    case 'pov:drag': vPovDrag(e, at, k, o); break
    case 'pov:release': vPovRelease(e, at, k, o); break
    case 'pov:return': vPovReturn(e, at, k); break
    // v9: type, glyphs, labs, evidence, odometer
    case 'type:assemble': vTypeAssemble(e, at, k, o); break
    case 'type:shatter': vTypeShatter(e, at, k, o); break
    case 'glyph:burst': vGlyphBurst(e, at, k, o); break
    case 'lab:drag': vLabDrag(e, at, k, o); break
    case 'lab:arb': vLabArb(e, at, k, o); break
    case 'evidence:flip': vEvidenceFlip(e, at, k); break
    case 'evidence:zoom': vEvidenceZoom(e, at, k, o); break
    case 'count:tick': vCountTick(e, at, k); break
    case 'chalk:tap': vChalkTap(e, at, k * clamp(Number(o.velocity ?? 0.6), 0.2, 1), pan); break
    case 'brain:pulse': vBrainPulse(e, at, k); break
    case 'guitar:pluck': vGuitarPluck(e, at + clamp(Number(o.delay ?? 0), 0, 0.5), Number(o.string ?? 0), Number(o.velocity ?? 0.7), pan, { k, dir: Number(o.dir ?? 1) < 0 ? -1 : 1 }); break
    case 'guitar:strum': vGuitarStrum(e, at, k, pan, Number(o.dir ?? 1) < 0 ? -1 : 1, Number(o.velocity ?? 0.6), o.speed === undefined ? undefined : Number(o.speed)); break
    // v9: arrival signatures
    case 'sig': {
      const sid = rest.join('.')
      if (!vSig(e, at, sid, k, pan)) playCue(e, SIG_LEGACY[SIG_ALIAS[sid] ?? sid], at, o) // clouds, name, world, hold, epilogue reuse the older arrival cues
      break
    }
    default:
      if (isArea) { if (reduced) vChannel(e, at, k, pan, 0.8); else vArrive(e, at, head as AreaKey, k, pan) }
  }
}

/** chalk landing on slate (the Education chalkboard, one per word): a dry, bright tick and a short gritty scrape; very quiet */
function vChalkTap(e: Eng, t: number, k: number, pan = 0) {
  vTick(e, t, 3400 * (0.9 + Math.random() * 0.2), 0.16 * k, pan, 6, e.ui)
  const n = noiseNode(e, t + 0.004, 0.05)
  const bp = bq(e, 'bandpass', 5200 * (0.9 + Math.random() * 0.2), 2.2)
  const ne = adsr(e, t + 0.004, 0.035 * k, 0.003, 0.04)
  n.connect(bp); bp.connect(ne); out(e, ne, e.ui, { pan })
}

// ------------------------------------------------------------------ live singleton

interface Live { ctx: AudioContext; eng: Eng }
let live: Live | null = null
let on = false
let suspendTimer = 0
let warned = false
let ambientTimer = 0
let sweepTimer = 0
let flightState: FlightState | null = null
let lastFlightAt = 0
let lastFlightApply = 0
let nextAmbient = 0
const rmq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null

function setLevel(target: number, tc = 0.03) {
  if (!live) return
  const g = live.eng.master.gain, t = live.ctx.currentTime
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(target, t, tc)
}
function ready(): boolean { return on && !!live && live.ctx.state === 'running' && !document.hidden }

function onVisibility() {
  if (!live) return
  if (document.hidden) {
    setLevel(0, 0.015)
    clearTimeout(suspendTimer)
    suspendTimer = window.setTimeout(() => { if (document.hidden) void live?.ctx.suspend() }, 120)
  } else if (on) {
    clearTimeout(suspendTimer)
    void live.ctx.resume().then(() => setLevel(live!.eng.level))
  }
}
function onReducedChange() {
  if (!live) return
  live.eng.reduced = !!rmq?.matches
  if (live.eng.reduced && flightState) flight(live.eng, { ...flightState, speed: 0 }, live.ctx.currentTime)
}
function tickTimers() {
  if (!live || !on || document.hidden) return
  const e = live.eng, now = live.ctx.currentTime
  // ambient events only while dwelling in an area
  if (!e.reduced && flightState && e.tvOn && flightState.mix > 0.7 && Math.abs(flightState.speed) < 0.12 && now >= nextAmbient) {
    nextAmbient = now + ambient(e, asArea(flightState.area), now + 0.02)
  }
  // the music bed: launch the notes due in the next half second
  musicPump(e, now + 0.5)
  // dispose drones that have been silent for a while
  if (e.beds) for (const [a, d] of e.beds.drones) {
    if (d.idleSince !== Infinity && now - d.idleSince > 6) { for (const n of d.nodes) { try { n.stop(now) } catch { /* */ } } d.out.disconnect(); e.beds.drones.delete(a) }
  }
  // if flight updates stopped (page idle) let the air bed fall back to rest
  if (flightState && performance.now() - lastFlightAt > 600 && Math.abs(flightState.speed) > 0) {
    flightState = { ...flightState, speed: 0 }; flight(e, flightState, now)
  }
}

export const sfx = {
  /** Create and start the engine. Call from the 'Enter with sound' gesture. */
  async init(): Promise<void> {
    if (!live) {
      const AC: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      const ctx = new AC({ latencyHint: 'interactive' })
      const eng = buildEngine(ctx, ctx.destination, MASTER)
      eng.master.gain.value = 0 // fade in once running; eng.level keeps the target
      eng.reduced = !!rmq?.matches
      live = { ctx, eng }
      document.addEventListener('visibilitychange', onVisibility)
      rmq?.addEventListener?.('change', onReducedChange)
    }
    on = true
    clearTimeout(suspendTimer)
    try { await live.ctx.resume() } catch { /* stays suspended until the next gesture */ }
    setLevel(document.hidden ? 0 : live.eng.level, 0.05)
    ensureBeds(live.eng)
    clearInterval(ambientTimer); ambientTimer = window.setInterval(tickTimers, 400)
    try { localStorage.setItem(PREF, '1') } catch { /* private mode */ }
    setSound(true)
  },
  get enabled(): boolean { return on },
  setEnabled(next: boolean): void {
    if (next) { void sfx.init(); return }
    on = false
    try { localStorage.setItem(PREF, '0') } catch { /* private mode */ }
    setSound(false)
    clearInterval(ambientTimer)
    if (live) {
      setLevel(0, 0.03)
      clearTimeout(suspendTimer)
      suspendTimer = window.setTimeout(() => { if (!on && live) { stopBeds(live.eng); void live.ctx.suspend() } }, 250)
    }
  },
  cue(id: string, opts?: CueOpts): void {
    if (!ready()) return
    // scroll-driven cues (arrivals, power, channel, whoosh, morph, wake) never repeat within 600 ms; UI cues are only de-bounced
    const head = id.split('.')[0]
    const min = GAP[head] ?? 600
    const key = cueKey(id, opts)
    const t = performance.now()
    if (t - (lastCue.get(key) ?? -1e9) < min) return
    lastCue.set(key, t)
    // a sound must never break the interaction that asked for it (a throw here would surface inside a drag or click handler)
    try { cueAt(live!.eng, id, live!.ctx.currentTime + 0.004, opts) } catch (err) { if (!warned) { warned = true; console.warn('[sfx] cue failed', id, err) } }
  },
  /** Camera/flight state, call every frame (throttled to ~30 Hz internally). */
  setFlight(s: FlightState): void {
    flightState = s
    if (!ready()) return
    const t = performance.now()
    lastFlightAt = t
    const e = live!.eng
    // never throttle a waypoint crossing, so the morph cue cannot be skipped
    const crossing = !s.quiet && e.seen && Math.floor(s.wp - 0.52) !== Math.floor(e.lastWp - 0.52)
    if (!crossing && t - lastFlightApply < 33) return
    lastFlightApply = t
    flight(e, s, live!.ctx.currentTime)
  },
  hover(): void { sfx.cue('hover') },
  click(): void { sfx.cue('click') },
  open(): void { sfx.cue('open') },
  close(): void { sfx.cue('close') },
  /** Peak level of the last analyser frame, in dBFS (for lab meters). */
  level(): number {
    if (!live) return -Infinity
    const a = live.eng.analyser, b = new Float32Array(a.fftSize)
    a.getFloatTimeDomainData(b)
    let m = 0; for (const v of b) m = Math.max(m, Math.abs(v))
    return 20 * Math.log10(m || 1e-6)
  },
  /** Engine state for QA and the HUD: whether sound is on, the AudioContext state and the master gain target. */
  status(): { enabled: boolean; ctx: string; master: number; hidden: boolean; sampleRate: number } {
    return { enabled: on, ctx: live?.ctx.state ?? 'none', master: live ? live.eng.master.gain.value : 0, hidden: document.hidden, sampleRate: live?.ctx.sampleRate ?? 0 }
  },
  /** QA hook: observe every scheduled sound (null to stop). */
  trace(fn: CueTrace | null): void { tracer = fn },
  /** Lab hook: force the reduced-motion path regardless of the OS setting. */
  forceReduced(v: boolean): void { if (live) { live.eng.reduced = v; if (v && flightState) flight(live.eng, { ...flightState, speed: 0 }, live.ctx.currentTime) } },
  /** The generative music bed (one chord per area) on or off; on by default. Sound off still silences everything. */
  setMusic(next: boolean): void {
    if (!live) return
    live.eng.musicOn = next
    if (flightState) flight(live.eng, flightState, live.ctx.currentTime)
  },
  /** Lab hook: run an ambient event now for the given area. */
  ambientNow(area: string): void { if (ready()) ambient(live!.eng, asArea(area), live!.ctx.currentTime + 0.01) },
}

/** True if the visitor turned sound on in an earlier visit. */
export function sfxWasOn(): boolean { try { return localStorage.getItem(PREF) === '1' } catch { return false } }

// ------------------------------------------------------------------ offline rendering (lab + level checks)

/** Render a scripted scene (cues + flight updates) through the real master chain. */
export async function renderScene(events: SceneEvent[], seconds: number, o: { reduced?: boolean; sampleRate?: number; music?: boolean } = {}): Promise<AudioBuffer> {
  const sr = o.sampleRate ?? 48000
  const ctx = new OfflineAudioContext(2, Math.floor(seconds * sr), sr)
  const eng = buildEngine(ctx, ctx.destination, MASTER)
  eng.reduced = !!o.reduced
  eng.musicOn = o.music !== false
  let last = 0
  for (const ev of [...events].sort((a, b) => a.t - b.t)) {
    musicPump(eng, ev.t) // the music bed's notes that fall due before this event, for the area the previous flight update set
    if (ev.flight) flight(eng, ev.flight, ev.t)
    if (ev.cue) cueAt(eng, ev.cue[0], ev.t, ev.cue[1])
    last = ev.t
  }
  for (let t = last; t < seconds; t += 0.25) musicPump(eng, t)
  return ctx.startRendering()
}
export function renderCue(id: string, opts?: CueOpts, seconds = 2.6, o: { reduced?: boolean; sampleRate?: number; music?: boolean } = {}): Promise<AudioBuffer> {
  const ev: SceneEvent[] = [{ t: 0.05, cue: [id, opts] }]
  // beds need an initial flight call to exist; area cues should be heard on a powered TV
  return renderScene(ev, seconds, o)
}
