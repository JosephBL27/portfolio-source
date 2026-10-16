// PNEUMA v9 arrival signatures: what each waypoint sounds like when the camera comes to rest at it ('sig.<waypointId>').
//
// Each one is a short, physical sound for the thing on screen (cards and chips, keys and a timer, a muffled alarm, a swirling pad,
// a drawer and a typewriter, a shop bell, a closing bell, a spinning globe, an elevator, a chapel bell, chalk, a page and a brass ratchet,
// wood, a needle, a chess piece, synapses), built from the same palette as everything else: tonal parts sit on harmonics of the
// TV's 60 Hz hum (so the chapel bell's prime, quint and nominal are 240, 360 and 480 Hz), transients are filtered noise.
// Every signature opens with a quiet tuner tick, so arriving at an area still sounds like the camera landing on a channel.
import {
  envGain, type Eng,
  osc, sweep, gain, bq, noiseNode, adsr, swell, out, hz, clamp, rnd,
  vTick, vThud, vChannel, vGlass, vPluck, grainFM, vBell, crackleBuf,
} from './kit'
import { vGuitarStrum } from './guitar'
import { vTypeShatter } from './voices-hub'

/** A resonant wooden knock: narrow band-passed noise over a damped low sine. */
function vWood(e: Eng, t: number, f: number, a: number, pan = 0, q = 20) {
  const n = noiseNode(e, t, 0.06)
  const bp = bq(e, 'bandpass', f, q)
  const env = adsr(e, t, a * 3.2, 0.0005, 0.03)
  n.connect(bp); bp.connect(env); out(e, env, e.fx, { pan, tube: 0.15, room: 0.1 })
  const o = osc(e, 'sine', f * 0.56, t, 0.1)
  sweep(o.frequency, f * 0.62, f * 0.56, t, 0.01)
  const oe = adsr(e, t, a * 0.6, 0.0008, 0.05)
  o.connect(oe); out(e, oe, e.fx, { pan, tube: 0.1 })
}
/** Chalk: noise with a stick-slip flutter, band-passed and sliding. */
function vChalk(e: Eng, t: number, dur: number, f0: number, f1: number, a: number, pan = 0) {
  const n = noiseNode(e, t, dur + 0.05)
  const bp = bq(e, 'bandpass', f0, 1.6)
  bp.frequency.setValueAtTime(f0, t); bp.frequency.linearRampToValueAtTime(f1, t + dur)
  const am = gain(e, 0.5), lf = osc(e, 'sawtooth', rnd(60, 90), t, dur + 0.05), ld = gain(e, 0.5)
  lf.connect(ld); ld.connect(am.gain)
  const env = envGain(e)
  env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(a, t + 0.012)
  env.gain.setValueAtTime(a, t + Math.max(0.013, dur - 0.02)); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02)
  n.connect(bp); bp.connect(am); am.connect(env); out(e, env, e.fx, { pan, tube: 0.1 })
}
/** A page or card riffle: air across paper, sliding up. */
function vRiffle(e: Eng, t: number, dur: number, f0: number, f1: number, a: number, pan = 0, rate = 70) {
  const n = noiseNode(e, t, dur + 0.05)
  const bp = bq(e, 'bandpass', f0, 0.9)
  bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const am = gain(e, 0.6), lf = osc(e, 'sine', rate, t, dur + 0.05), ld = gain(e, 0.4)
  lf.connect(ld); ld.connect(am.gain)
  const env = swell(e, t, a, dur * 0.15, dur * 0.85)
  n.connect(bp); bp.connect(am); am.connect(env); out(e, env, e.fx, { pan, tube: 0.12 })
}
/** A soft sine blip with a tick in front of it. */
function vBlip(e: Eng, t: number, f: number, a: number, pan = 0, dec = 0.03) {
  const o = osc(e, 'sine', f, t, dec + 0.05)
  const env = adsr(e, t, a, 0.001, dec)
  o.connect(env); out(e, env, e.fx, { pan, tube: 0.25, room: 0.2 })
  vTick(e, t, f * 1.7, a * 0.7, pan, 6)
}

// ------------------------------------------------------------------ the signatures

function sigTable(e: Eng, t: number, k: number, pan: number) {
  // a card flicked across felt, then a stack of ceramic chips
  for (const [d, len, a] of [[0.02, 0.05, 0.24], [0.085, 0.05, 0.2], [0.15, 0.06, 0.28]] as const) vRiffle(e, t + d, len, 1400, 5200, a * k, pan + rnd(-0.25, 0.25), 90)
  vTick(e, t + 0.22, 1100, 0.3 * k, pan, 3); vThud(e, t + 0.22, 190, 0.16 * k, 0.04)
  ;[[0.3, 2700, 1], [0.36, 3000, 0.8], [0.405, 2500, 0.7]].forEach(([d, f, a], i) => {
    const at = t + d, pn = pan + (i - 1) * 0.22
    for (const [r, amp, dec] of [[1, 1, 0.035], [1.52, 0.55, 0.025]] as const) {
      const o = osc(e, 'sine', f * r, at, dec + 0.04)
      const env = adsr(e, at, 0.13 * k * a * amp, 0.0008, dec)
      o.connect(env); out(e, env, e.fx, { pan: pn, tube: 0.25, room: 0.15 })
    }
    vTick(e, at, 4600, 0.28 * k * a, pn, 6)
  })
}

function sigDrill(e: Eng, t: number, k: number, pan: number) {
  // a burst of key ticks (accelerating, like fast typing), a space-bar thunk, then a kitchen-timer beep twice
  let at = t + 0.03
  for (let i = 0; i < 8; i++) {
    const p = pan + rnd(-0.25, 0.25), low = i === 7
    vTick(e, at, low ? 1200 : rnd(2300, 3400), (low ? 0.4 : 0.28) * k, p, low ? 3 : 7)
    vThud(e, at, low ? 150 : rnd(210, 300), 0.06 * k, 0.025)
    at += 0.075 - 0.032 * (i / 7) + rnd(0, 0.02)
  }
  for (const d of [0.55, 0.69]) {
    const b = osc(e, 'sine', hz(40), t + d, 0.12)
    const be = envGain(e)
    be.gain.setValueAtTime(0.0001, t + d); be.gain.linearRampToValueAtTime(0.1 * k, t + d + 0.006)
    be.gain.setValueAtTime(0.1 * k, t + d + 0.07); be.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.095)
    b.connect(be); out(e, be, e.fx, { pan, tube: 0.25, room: 0.15 })
  }
}

function sigAlarm(e: Eng, t: number, k: number, pan: number) {
  // an alarm heard through a pillow: three chirps under a low-pass, a phone's motor buzzing under them
  for (let i = 0; i < 3; i++) {
    const at = t + 0.03 + i * 0.15
    const o = osc(e, 'square', hz(16), at, 0.12)
    sweep(o.frequency, hz(16), hz(16) * 1.12, at, 0.07)
    const lp = bq(e, 'lowpass', 900, 0.6)
    const env = envGain(e)
    env.gain.setValueAtTime(0.0001, at); env.gain.linearRampToValueAtTime(0.1 * k, at + 0.008)
    env.gain.setValueAtTime(0.1 * k, at + 0.065); env.gain.exponentialRampToValueAtTime(0.0001, at + 0.1)
    o.connect(lp); lp.connect(env); out(e, env, e.fx, { pan, tube: 0.3, room: 0.2 })
  }
  const m = osc(e, 'sine', 150, t + 0.02, 0.6)
  const am = gain(e, 0.5), lf = osc(e, 'sine', 33, t + 0.02, 0.6), ld = gain(e, 0.5)
  lf.connect(ld); ld.connect(am.gain)
  const me = envGain(e)
  me.gain.setValueAtTime(0.0001, t + 0.02); me.gain.linearRampToValueAtTime(0.14 * k, t + 0.05)
  me.gain.setValueAtTime(0.14 * k, t + 0.4); me.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
  m.connect(am); am.connect(me); out(e, me, e.fx, { pan })
  vThud(e, t + 0.5, 80, 0.12 * k, 0.1)
}

function sigMarket(e: Eng, t: number, k: number, pan: number) {
  // a pad of 4:6:7:9 that swirls round the listener, with a band of air circling at 1.3 Hz
  const lp = bq(e, 'lowpass', 1100, 0.7)
  const lfo = osc(e, 'sine', 0.9, t, 3), ld = gain(e, 420)
  lfo.connect(ld); ld.connect(lp.frequency)
  const env = swell(e, t, 0.09 * k, 0.8, 1.9, 0.2)
  for (const n2 of [4, 6, 7, 9]) for (const dt of [-0.14, 0.14]) {
    const o = osc(e, n2 > 6 ? 'sine' : 'triangle', hz(n2) + dt, t, 3.2); const g = gain(e, 1 / Math.pow(n2, 0.4)); o.connect(g); g.connect(lp)
  }
  lp.connect(env); out(e, env, e.fx, { pan, room: 0.55 })
  const n = noiseNode(e, t, 2.4, true)
  const bp = bq(e, 'bandpass', 500, 1.2)
  bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(1500, t + 1.1); bp.frequency.exponentialRampToValueAtTime(650, t + 2.2)
  const p = e.ctx.createStereoPanner(), pl = osc(e, 'sine', 1.3, t, 2.5), pd = gain(e, 0.85)
  pl.connect(pd); pd.connect(p.pan)
  const ne = swell(e, t + 0.1, 0.2 * k, 0.9, 1.3)
  n.connect(bp); bp.connect(ne); ne.connect(p); p.connect(e.fx)
  const rs = gain(e, 0.4); p.connect(rs); rs.connect(e.room)
}

function sigRecord(e: Eng, t: number, k: number, pan: number) {
  // an archive drawer rolled out on runners and stopped hard, folders riffled, then typewriter keys, a bell and a carriage return
  const n = noiseNode(e, t, 0.45, true)
  const lp = bq(e, 'lowpass', 520)
  const env = swell(e, t, 0.3 * k, 0.12, 0.28)
  n.connect(lp); lp.connect(env); out(e, env, e.fx, { pan: pan - 0.2, room: 0.15 })
  const r = osc(e, 'sine', 66, t, 0.5)
  sweep(r.frequency, 66, 92, t, 0.32)
  const re = swell(e, t, 0.14 * k, 0.1, 0.25)
  r.connect(re); out(e, re, e.fx, { pan: pan - 0.2 })
  vThud(e, t + 0.34, 86, 0.36 * k, 0.1); vTick(e, t + 0.34, 1300, 0.3 * k, pan - 0.2, 3)
  for (let i = 0; i < 3; i++) vTick(e, t + 0.4 + i * 0.045, rnd(1400, 2000), 0.12 * k, pan - 0.1, 4)
  for (let i = 0; i < 4; i++) {
    const at = t + 0.62 + i * 0.12 + rnd(0, 0.02), p = pan + 0.1 + i * 0.05
    vTick(e, at, rnd(1800, 2300), 0.32 * k, p, 6); vThud(e, at, 170, 0.1 * k, 0.03)
  }
  vBell(e, t + 1.12, hz(40), 0.1 * k, [[1, 1, 0.9], [2.76, 0.25, 0.4]], { pan: pan + 0.2, tube: 0.25, room: 0.3 })
  vRiffle(e, t + 1.2, 0.14, 800, 280, 0.1 * k, pan + 0.2, 25)
}

function sigPair(e: Eng, t: number, k: number, pan: number) {
  // the bell over a shop door (two strikes of a small bright bell), then two footsteps coming in
  const parts = [[1, 1, 0.55], [2.76, 0.45, 0.4], [5.4, 0.2, 0.22]] as const
  vBell(e, t + 0.02, hz(36), 0.2 * k, parts, { pan: pan + 0.1, tube: 0.3, room: 0.3 })
  vBell(e, t + 0.13, hz(45), 0.16 * k, parts, { pan: pan - 0.1, tube: 0.3, room: 0.3 })
  ;[[0.62, 84, -0.18], [0.95, 76, 0.18]].forEach(([d, f, p]) => {
    vThud(e, t + d, f, 0.28 * k, 0.09)
    const n = noiseNode(e, t + d, 0.05)
    const lp = bq(e, 'lowpass', 1300)
    const ne = adsr(e, t + d, 0.09 * k, 0.004, 0.035)
    n.connect(lp); lp.connect(ne); out(e, ne, e.fx, { pan: pan + p })
  })
}

function sigSurface(e: Eng, t: number, k: number, pan: number) {
  // a closing bell (a heavy brass bell struck twice, ringing) and a soft ticker tape that speeds up and settles
  const parts = [[0.5, 0.5, 2.2], [1, 1, 1.9], [1.5, 0.6, 1.4], [2.01, 0.5, 1.1], [2.76, 0.35, 0.7], [4.1, 0.15, 0.4]] as const
  vBell(e, t + 0.02, hz(5), 0.34 * k, parts, { pan, tube: 0.2, room: 0.55 })
  vBell(e, t + 0.34, hz(5), 0.24 * k, parts, { pan, tube: 0.2, room: 0.55 })
  vThud(e, t + 0.02, 70, 0.14 * k, 0.1)
  let at = t + 0.7
  for (let i = 0; i < 14; i++) {
    const u = i / 13
    vTick(e, at, rnd(3000, 5200), 0.15 * k * (0.5 + 0.5 * Math.sin(Math.PI * u)), pan + rnd(-0.5, 0.5), 8)
    at += 0.11 - 0.06 * Math.sin(Math.PI * u) + rnd(0, 0.02)
  }
}

function sigCloudflare(e: Eng, t: number, k: number, pan: number) {
  // a globe turning (a low hum with a 2 Hz roll in it) and packets circling the room as short blips
  const mix = gain(e, 1)
  for (const [n2, a] of [[3, 1], [6, 0.45]] as const) { const o = osc(e, 'sine', hz(n2), t, 2.4); const g = gain(e, a); o.connect(g); g.connect(mix) }
  const am = gain(e, 0.7), lf = osc(e, 'sine', 2.1, t, 2.4), ld = gain(e, 0.3)
  lf.connect(ld); ld.connect(am.gain)
  const lp = bq(e, 'lowpass', 800)
  const env = swell(e, t, 0.08 * k, 0.5, 1.4, 0.3)
  mix.connect(lp); lp.connect(am); am.connect(env); out(e, env, e.fx, { room: 0.4 })
  const seq = [24, 30, 36, 30, 40, 36, 45, 30]
  seq.forEach((h, i) => {
    const at = t + 0.12 + i * 0.13, p = clamp(Math.sin((i / seq.length) * Math.PI * 2 + 0.6) * 0.9, -1, 1)
    vBlip(e, at, hz(h), 0.2 * k, p)
    if (i % 3 === 2) vBlip(e, at + 0.07, hz(h) * 0.75, 0.1 * k, -p)
  })
}

function sigAppfolio(e: Eng, t: number, k: number, pan: number) {
  // an elevator's arrival chime, then the doors sliding open and a soft stop
  vBell(e, t + 0.04, hz(22), 0.3 * k, [[1, 1, 1.1], [2.01, 0.3, 0.7], [3.0, 0.1, 0.35]], { pan, tube: 0.25, room: 0.35 })
  vThud(e, t + 0.03, 68, 0.1 * k, 0.1)
  const n = noiseNode(e, t, 1.2, true)
  const bp = bq(e, 'bandpass', 500, 0.9)
  bp.frequency.setValueAtTime(500, t + 0.45); bp.frequency.exponentialRampToValueAtTime(1400, t + 0.95)
  const env = swell(e, t + 0.45, 0.14 * k, 0.15, 0.4)
  n.connect(bp); bp.connect(env); out(e, env, e.fx, { pan, room: 0.15 })
  vThud(e, t + 1.0, 82, 0.1 * k, 0.07)
}

function sigSchool(e: Eng, t: number, k: number, pan: number) {
  // a chapel bell. Partials follow a real bell (hum, prime, tierce, quint, nominal, ...): struck at 480 Hz (harmonic 8) the prime, quint
  // and nominal land on 480, 720 and 960 Hz, so it rings in tune with the TV. Struck high, then answered a fourth lower (harmonic 6).
  const bell = [[0.5, 0.55, 4.2], [1, 1, 3.4], [1.183, 0.7, 2.6], [1.506, 0.55, 2.3], [2, 0.6, 2.0], [2.514, 0.28, 1.3], [2.662, 0.24, 1.1], [3.011, 0.2, 0.9], [4.166, 0.12, 0.5]] as const
  vBell(e, t + 0.02, hz(8), 0.3 * k, bell, { pan: pan + 0.1, tube: 0.1, room: 0.8 })
  vTick(e, t + 0.02, 2600, 0.2 * k, pan, 3)
  vBell(e, t + 1.15, hz(6), 0.34 * k, bell, { pan: pan - 0.1, tube: 0.1, room: 0.8 })
  vThud(e, t + 1.15, 62, 0.12 * k, 0.12)
}

function sigMathecon(e: Eng, t: number, k: number, pan: number) {
  // chalk on a board: a long stroke, a short one, a curve, and the tap of a full stop
  vChalk(e, t + 0.03, 0.16, 2200, 3300, 0.2 * k, pan - 0.2)
  vTick(e, t + 0.2, 2100, 0.22 * k, pan - 0.2, 4)
  vChalk(e, t + 0.27, 0.1, 3000, 2400, 0.17 * k, pan)
  vChalk(e, t + 0.42, 0.22, 2000, 3400, 0.18 * k, pan + 0.15)
  vChalk(e, t + 0.66, 0.1, 3400, 2500, 0.15 * k, pan + 0.2)
  vTick(e, t + 0.78, 2300, 0.3 * k, pan + 0.2, 4); vThud(e, t + 0.78, 210, 0.05 * k, 0.02)
}

function sigInstrument(e: Eng, t: number, k: number, pan: number) {
  // a page turned (air over paper, then it lands), and a brass ratchet slowing down to a stop
  vRiffle(e, t + 0.02, 0.17, 500, 3400, 0.3 * k, pan - 0.15, 55)
  vTick(e, t + 0.2, 700, 0.22 * k, pan - 0.1, 2); vThud(e, t + 0.2, 160, 0.1 * k, 0.05)
  let at = t + 0.42
  for (let i = 0; i < 9; i++) {
    const p = pan + 0.15
    vTick(e, at, 4000, 0.26 * k, p, 7)
    const o = osc(e, 'sine', hz(36) * (1 + 0.012 * i), at, 0.06)
    const oe = adsr(e, at, 0.06 * k, 0.0008, 0.025)
    o.connect(oe); out(e, oe, e.fx, { pan: p, tube: 0.25 })
    at += 0.03 + 0.011 * i
  }
  vBell(e, at + 0.02, hz(15), 0.12 * k, [[1, 1, 0.45], [2.4, 0.4, 0.3], [3.7, 0.2, 0.2]], { pan: pan + 0.15, tube: 0.3, room: 0.25 })
}

function sigMeeple(e: Eng, t: number, k: number, pan: number) {
  // a wooden piece set down on a board twice, a slide of wood on wood before the second
  vWood(e, t + 0.02, 900, 0.3 * k, pan - 0.1); vThud(e, t + 0.02, 130, 0.12 * k, 0.04)
  const n = noiseNode(e, t + 0.1, 0.1)
  const lp = bq(e, 'lowpass', 1000)
  const ne = swell(e, t + 0.1, 0.07 * k, 0.03, 0.05)
  n.connect(lp); lp.connect(ne); out(e, ne, e.fx, { pan: pan + 0.1 })
  vWood(e, t + 0.19, 760, 0.22 * k, pan + 0.1); vThud(e, t + 0.19, 120, 0.09 * k, 0.04)
}

function sigRecords(e: Eng, t: number, k: number, pan: number) {
  // a needle lands on a record: the quick zip of the groove, a bump, then the crackle of the surface opening and a warm hum underneath
  const zn = noiseNode(e, t, 0.1)
  const zbp = bq(e, 'bandpass', 6000, 1.2)
  zbp.frequency.setValueAtTime(6000, t); zbp.frequency.exponentialRampToValueAtTime(1400, t + 0.07)
  const ze = adsr(e, t, 0.16 * k, 0.002, 0.07)
  zn.connect(zbp); zbp.connect(ze); out(e, ze, e.fx, { pan })
  vThud(e, t + 0.04, 52, 0.42 * k, 0.15); vThud(e, t + 0.11, 64, 0.16 * k, 0.07)
  const c = e.ctx.createBufferSource(); c.buffer = crackleBuf(e.ctx); c.loop = true; c.start(t + 0.06, Math.random() * 2, 1.9)
  const cbp = bq(e, 'bandpass', 1700, 0.5)
  const ce = swell(e, t + 0.06, 0.55 * k, 0.15, 1.5)
  c.connect(cbp); cbp.connect(ce); out(e, ce, e.fx, { pan, tube: 0.1 })
  for (const n2 of [1, 2, 3]) {
    const o = osc(e, 'sine', hz(n2), t + 0.1, 2.4); const g = swell(e, t + 0.1, 0.05 * k / n2, 0.5, 1.5)
    o.connect(g); out(e, g, e.fx, { room: 0.4 })
  }
}

function sigKnight(e: Eng, t: number, k: number, pan: number) {
  // a chess knight lifted, carried and put down (two taps; the second the real one), on a wooden board with a felt base
  vWood(e, t + 0.02, 1300, 0.12 * k, pan - 0.2, 14)
  const n = noiseNode(e, t + 0.06, 0.12)
  const bp = bq(e, 'bandpass', 600, 1)
  bp.frequency.setValueAtTime(500, t + 0.06); bp.frequency.exponentialRampToValueAtTime(900, t + 0.16)
  const ne = swell(e, t + 0.06, 0.05 * k, 0.04, 0.07)
  n.connect(bp); bp.connect(ne); out(e, ne, e.fx, { pan })
  vWood(e, t + 0.22, 820, 0.34 * k, pan + 0.2, 18); vThud(e, t + 0.22, 125, 0.16 * k, 0.05)
  vTick(e, t + 0.22, 2500, 0.2 * k, pan + 0.2, 4)
}

function sigMind(e: Eng, t: number, k: number, pan: number) {
  // synapses firing: bursts of tiny spikes, some answered by a spark of glass
  const bursts: [number, number][] = [[0.02, 1], [0.24, 0.8], [0.47, 0.65], [0.66, 0.45]]
  for (const [d, a] of bursts) {
    const m = 3 + Math.floor(Math.random() * 4)
    for (let i = 0; i < m; i++) {
      const at = t + d + Math.pow(Math.random(), 1.4) * 0.12, p = rnd(-0.8, 0.8)
      vTick(e, at, rnd(2500, 6500), 0.2 * k * a, p, 12)
      if (Math.random() < 0.4) grainFM(e, at + 0.004, hz(30 + 3 * Math.floor(Math.random() * 9)), 2.76, 1.2, rnd(0.03, 0.07), 0.06 * k * a, p, { room: 0.35 })
    }
  }
  const o = osc(e, 'sine', hz(6), t, 1.5)
  const env = swell(e, t, 0.05 * k, 0.4, 0.9)
  o.connect(env); out(e, env, e.fx, { room: 0.5 })
  vGlass(e, t + 0.5, hz(18), 0.08 * k, pan)
}

function sigSecretary(e: Eng, t: number, k: number, pan: number) {
  // a mail chime: two plucked notes a third apart, and a sheet of paper settling
  vPluck(e, t + 0.03, hz(16), 0.34 * k, pan - 0.1)
  vPluck(e, t + 0.17, hz(20), 0.3 * k, pan + 0.1)
  vRiffle(e, t + 0.34, 0.12, 1800, 700, 0.08 * k, pan, 40)
}

function sigWatchdog(e: Eng, t: number, k: number, pan: number) {
  // a sonar ping with two echoes, and a heartbeat under it (lub, dub): something is watching
  const f = hz(20)
  for (const [d, a, lp] of [[0, 1, 9000], [0.3, 0.4, 2400], [0.62, 0.16, 1400]] as const) {
    const o = osc(e, 'sine', f * 1.02, t + 0.02 + d, 1.0)
    sweep(o.frequency, f * 1.02, f, t + 0.02 + d, 0.06)
    const l = bq(e, 'lowpass', lp)
    const env = adsr(e, t + 0.02 + d, 0.22 * k * a, 0.004, 0.55)
    o.connect(l); l.connect(env); out(e, env, e.fx, { pan: pan + d * 0.4, tube: 0.2, room: 0.35 })
  }
  vThud(e, t + 0.12, 66, 0.3 * k, 0.1); vThud(e, t + 0.27, 60, 0.2 * k, 0.12)
}

function sigRecruiting(e: Eng, t: number, k: number, pan: number) {
  // two knocks on a door, then two notes a fifth apart, rising: someone is let in
  vWood(e, t + 0.02, 520, 0.3 * k, pan - 0.1, 10); vThud(e, t + 0.02, 108, 0.2 * k, 0.07)
  vWood(e, t + 0.17, 500, 0.26 * k, pan - 0.1, 10); vThud(e, t + 0.17, 102, 0.16 * k, 0.07)
  vPluck(e, t + 0.44, hz(10), 0.3 * k, pan - 0.05)
  vPluck(e, t + 0.6, hz(15), 0.3 * k, pan + 0.1)
}

function sigChomchom(e: Eng, t: number, k: number, pan: number) {
  // a cheerful chomp, chomp, gulp
  const chomp = (at: number, a: number, f: number) => {
    const n = noiseNode(e, at, 0.12)
    const bp = bq(e, 'bandpass', 900, 1.2)
    const ne = adsr(e, at, 0.3 * k * a, 0.004, 0.06)
    n.connect(bp); bp.connect(ne); out(e, ne, e.fx, { pan, tube: 0.15 })
    const o = osc(e, 'sine', f, at, 0.12)
    sweep(o.frequency, f, f * 0.46, at, 0.08)
    const oe = adsr(e, at, 0.2 * k * a, 0.004, 0.08)
    o.connect(oe); out(e, oe, e.fx, { pan, tube: 0.2 })
    vTick(e, at, 2600, 0.2 * k * a, pan, 5)
  }
  chomp(t + 0.03, 0.8, hz(8)); chomp(t + 0.26, 1, hz(7))
  const g = osc(e, 'sine', hz(4), t + 0.54, 0.12)
  sweep(g.frequency, hz(4), hz(8), t + 0.54, 0.07)
  const ge = adsr(e, t + 0.54, 0.16 * k, 0.005, 0.07)
  g.connect(ge); out(e, ge, e.fx, { pan, tube: 0.2 })
  vTick(e, t + 0.6, 3200, 0.1 * k, pan, 8)
}

function sigGuitar(e: Eng, t: number, k: number, pan: number) {
  // a soft down-strum on six strings (Karplus-Strong, tuned to ratios of the hum), a breath of wood under it
  vThud(e, t + 0.01, 96, 0.08 * k, 0.05)
  vGuitarStrum(e, t + 0.03, k, pan, 1, 0.42)
}

function sigDefault(e: Eng, t: number, k: number, pan: number) {
  // an id we do not know: a quiet landing and a two-note settle on the hum's own series
  vThud(e, t + 0.01, 72, 0.16 * k, 0.1)
  vPluck(e, t + 0.03, hz(8), 0.26 * k, pan - 0.1)
  vPluck(e, t + 0.16, hz(12), 0.22 * k, pan + 0.1)
}

// ------------------------------------------------------------------ transitions and objects (tr:*, obj:*)
// One-shots from the scene code, each built from the arrival voices above so they stay in the same palette.

/** A door's hinges: a stick-slip creak (noise band-passed and sliding up, fluttering at 11 Hz), then the leaves' weight landing. */
function vDoorCreak(e: Eng, t: number, k: number, pan: number) {
  const n = noiseNode(e, t, 0.75)
  const bp = bq(e, 'bandpass', 380, 3)
  bp.frequency.setValueAtTime(380, t); bp.frequency.linearRampToValueAtTime(820, t + 0.6)
  const am = gain(e, 0.5), lf = osc(e, 'sine', 11, t, 0.75), ld = gain(e, 0.5)
  lf.connect(ld); ld.connect(am.gain)
  const env = swell(e, t, 0.14 * k, 0.12, 0.45)
  n.connect(bp); bp.connect(am); am.connect(env); out(e, env, e.fx, { pan, tube: 0.15, room: 0.2 })
  vThud(e, t + 0.55, 88, 0.2 * k, 0.12)
  vWood(e, t + 0.55, 300, 0.12 * k, pan, 12)
}
/** Dice tumbling on wood: six clacks, a little quieter and a little later each time, then a soft settle. */
function vRoll(e: Eng, t: number, k: number, pan: number) {
  let at = t
  for (let i = 0; i < 6; i++) {
    vWood(e, at, rnd(1000, 1400), 0.26 * k * (1 - i * 0.12), pan + rnd(-0.3, 0.3), 16)
    at += 0.045 + i * 0.012 + rnd(0, 0.01)
  }
  vThud(e, at, 110, 0.1 * k, 0.05)
}
/** A chess piece set down on wood: the knock, a felt thud under it, a tick at the contact. */
function vMove(e: Eng, t: number, k: number, pan: number) {
  vWood(e, t, 820, 0.3 * k, pan, 18); vThud(e, t, 125, 0.12 * k, 0.05); vTick(e, t, 2500, 0.16 * k, pan, 4)
}

/** Transition and object id -> voice. Each entry is a one-line wrapper over an existing voice (see the comment on each). */
const TRANS_OBJ: Record<string, (e: Eng, t: number, k: number, pan: number) => void> = {
  'tr:doors': vDoorCreak,                                                        // hinges creak, then the leaves' weight
  'tr:portal': (e, t, k, pan) => vChannel(e, t, 0.6 * k, pan, 1),                // the CRT's static burst and detent
  'tr:pages': (e, t, k, pan) => vRiffle(e, t, 0.12, 900, 3000, 0.16 * k, pan, 60), // a page lifting off the stack (short riffle)
  'tr:shatter': (e, t, k) => vTypeShatter(e, t, 0.6 * k, { n: 10 }),            // crack and glassy FM grain scatter (type:shatter)
  'tr:mosaic': (e, t, k, pan) => { vRiffle(e, t, 0.06, 1400, 5200, 0.22 * k, pan, 90); vTick(e, t + 0.05, 1100, 0.14 * k, pan, 3) }, // one card flick (sigTable's)
  'tr:panels': (e, t, k, pan) => vRiffle(e, t, 0.5, 350, 2400, 0.2 * k, pan, 5), // slow air whoosh across the lens
  'tr:curtain': (e, t, k, pan) => vRiffle(e, t, 0.45, 600, 1800, 0.12 * k, pan, 20), // soft cloth rustle, quieter than the whoosh
  'obj:roll': vRoll,                                                              // dice on wood
  'obj:snooze': (e, t, k, pan) => vBlip(e, t, hz(20), 0.18 * k, pan, 0.035),     // a soft blip with a tick (button)
  'obj:move': vMove,                                                              // chess clack
}
export const TRANS_OBJ_IDS: string[] = Object.keys(TRANS_OBJ)
/** Play the transition or object one-shot `id` (tr:* or obj:*). Returns false for an id it does not own. */
export function vTransObj(e: Eng, t: number, id: string, k: number, pan = 0): boolean {
  if (!Object.prototype.hasOwnProperty.call(TRANS_OBJ, id)) return false
  TRANS_OBJ[id](e, t, k, pan)
  return true
}

// ------------------------------------------------------------------ router

const SIGS: Record<string, (e: Eng, t: number, k: number, pan: number) => void> = {
  table: sigTable, drill: sigDrill, alarm: sigAlarm, market: sigMarket, record: sigRecord, pair: sigPair,
  surface: sigSurface, cloudflare: sigCloudflare, appfolio: sigAppfolio, school: sigSchool, mathecon: sigMathecon,
  instrument: sigInstrument, meeple: sigMeeple, records: sigRecords, knight: sigKnight, mind: sigMind,
  secretary: sigSecretary, watchdog: sigWatchdog, recruiting: sigRecruiting, chomchom: sigChomchom, guitar: sigGuitar,
}
/** Other names for the same arrival: the form ids and the sound-brief names. */
export const SIG_ALIAS: Record<string, string> = {
  zeta: 'drill', pushup: 'alarm', phase: 'market', counties: 'record', dyads: 'pair', uchicago: 'school', hall: 'school', compass: 'instrument',
  turntable3d: 'records', brain: 'mind', qvr: 'surface', 'recruiting-os': 'recruiting',
}
/** Waypoint ids whose arrival is one of the older cues (handled in sfx.ts): clouds is the wind, name the power-on, world the hub settle, hold the About settle, epilogue the power-off. */
export const SIG_LEGACY: Record<string, string> = { clouds: 'wind', name: 'poweron', world: 'hub', hold: 'about', epilogue: 'poweroff' }
export const SIG_NAMES = Object.keys(SIGS)
export const SIG_IDS = [...Object.keys(SIGS), ...Object.keys(SIG_ALIAS), ...Object.keys(SIG_LEGACY)]

/** Play the arrival signature `sig.<id>`. Returns false if the id is a legacy alias the caller must route itself. */
export function vSig(e: Eng, t: number, id: string, k: number, pan = 0): boolean {
  const key = SIG_ALIAS[id] ?? id
  if (SIG_LEGACY[key]) return false
  vChannel(e, t, k * 0.45, pan, 0.5)
  ;(SIGS[key] ?? sigDefault)(e, t + 0.03, k, pan)
  return true
}
