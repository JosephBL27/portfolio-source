// PNEUMA v9 music bed: a slow generative pad, one chord per area, every note a harmonic of the TV's 60 Hz hum.
//
// Not a loop and not a melody: each area owns a chord (a set of harmonic numbers) and, while the camera dwells there, a note from
// that chord swells in every few seconds (2 to 3 s to arrive, 7 to 9 s all told), so two or three overlap and the chord is always
// slightly different. Because every note is n x 60 Hz the pad is always consonant with the hum and the drones under it, whichever
// notes happen to sound together. The areas have their own bus; the camera's area mix crossfades them (about 2 s), exactly as the
// drones do, and flying dims the whole bed. Notes are scheduled by `musicPump` against the audio clock, so the live site (a timer),
// the offline renderer and the lab run the same code. Silent until the TV is on; off in reduced motion.
import { type Eng, type AreaKey, type MusicState, AREA_KEYS, envGain, osc, bq, gain, out, rnd, hz, clamp, jit } from './kit'

interface Chord {
  h: number[]                 // harmonic numbers of 60 Hz the pad draws its notes from
  type: OscillatorType
  lp: number                  // low-pass cutoff (Hz)
  level: number               // area bus gain when dwelling (linear)
  every: [number, number]     // seconds between note onsets
  a: number; hold: number; r: number   // swell: attack, hold, release (s)
  wobble?: number             // slow pitch wobble (cents), for the tape-like About pad
}

export const CHORDS: Record<AreaKey, Chord> = {
  hub: { h: [2, 3, 4, 6, 8], type: 'sine', lp: 1400, level: 0.24, every: [3.2, 5.2], a: 2.8, hold: 2.2, r: 3.6 },
  mind: { h: [4, 6, 9, 11, 15], type: 'sine', lp: 2600, level: 0.23, every: [2.4, 4.4], a: 2.4, hold: 1.8, r: 3.8 },
  systems: { h: [3, 4, 5, 6, 8, 10], type: 'triangle', lp: 1500, level: 0.3, every: [1.9, 3.4], a: 1.8, hold: 1.4, r: 3.0 },
  research: { h: [5, 6, 7, 9, 10], type: 'sawtooth', lp: 620, level: 0.34, every: [3.0, 5.2], a: 3.2, hold: 2.0, r: 4.0 },
  work: { h: [2, 3, 4, 5, 6], type: 'triangle', lp: 900, level: 0.17, every: [3.4, 5.6], a: 3.0, hold: 2.4, r: 3.8 },
  education: { h: [4, 5, 6, 8, 9, 10, 12], type: 'sine', lp: 2300, level: 0.2, every: [2.2, 4.0], a: 2.4, hold: 1.8, r: 3.4 },
  about: { h: [3, 5, 6, 9, 10], type: 'sine', lp: 1700, level: 0.155, every: [3.0, 5.0], a: 2.8, hold: 2.2, r: 4.0, wobble: 7 },
}
/** Linear level of the whole bed at the music bus, calibrated in the offline report (lab / scripts/sfx-check.mjs) so the pad sits under the drones. */
export const MUSIC_LEVEL = 0.034

function ensureMusic(e: Eng, at: number): MusicState {
  if (e.music) return e.music
  const bus = gain(e, 0)
  out(e, bus, e.bed, { room: 0.45 })
  const areas = new Map<AreaKey, GainNode>()
  for (const a of AREA_KEYS) { const g = gain(e, 0); g.connect(bus); areas.set(a, g) }
  e.music = { bus, areas, next: at, last: new Map(), note: new Map(), tgt: new Map(), busTgt: -1, area: 'hub', mix: 0, sp: 0, on: false }
  return e.music
}

/** One pad note: a detuned pair of oscillators through a low-pass, swelling in and out on the area's bus. */
function padNote(e: Eng, m: MusicState, t: number, area: AreaKey, n: number, vel: number) {
  const C = CHORDS[area], f = hz(n)
  const dur = C.a + C.hold + C.r
  const g = envGain(e)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vel, t + C.a)
  g.gain.setValueAtTime(vel, t + C.a + C.hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const lp = bq(e, 'lowpass', C.lp * (n > 8 ? 0.8 : 1), 0.5)
  lp.connect(g)
  for (const sgn of [-1, 1]) {
    const o = osc(e, C.type, f + sgn * 0.11 * jit(0.4), t, dur + 0.1)
    if (C.wobble) { const w = e.ctx.createOscillator(); w.frequency.value = 0.31 * jit(0.2); const wd = gain(e, C.wobble); w.connect(wd); wd.connect(o.detune); w.start(t); w.stop(t + dur + 0.1) }
    o.connect(lp)
  }
  const p = e.ctx.createStereoPanner(); p.pan.value = rnd(-0.55, 0.55)
  g.connect(p); p.connect(m.areas.get(area)!)
}

/** Steer the bed from the flight state (call whenever the flight updates). `on` = the TV is on and motion is allowed. */
export function musicUpdate(e: Eng, at: number, area: AreaKey, mix: number, sp: number, on: boolean) {
  const m = ensureMusic(e, at)
  const live = on && e.musicOn
  if (live && !m.on) m.next = Math.max(m.next, at)   // coming on (or back on): start a new chord straight away
  else if (live && area !== m.area) m.next = Math.min(m.next, at + 0.4) // a new area: its chord enters within half a second, not whenever the last area's next note was due
  m.area = area; m.mix = mix; m.sp = sp; m.on = live
  const dim = 0.4 + 0.6 * clamp(mix) * (1 - 0.55 * clamp(sp))
  for (const a of AREA_KEYS) {
    const target = live && a === area ? CHORDS[a].level * dim : 0
    const prev = m.tgt.get(a) ?? -1
    if (target === 0 && prev === 0) continue          // nothing to do for an area that is already silent
    if (Math.abs(target - prev) < 0.002 * (CHORDS[a].level || 1) && target !== 0) continue
    m.tgt.set(a, target)
    m.areas.get(a)!.gain.setTargetAtTime(target, at, a === area ? 0.9 : 0.8)
  }
  const busT = live ? MUSIC_LEVEL : 0
  if (busT !== m.busTgt) { m.busTgt = busT; m.bus.gain.setTargetAtTime(busT, at, 0.5) }
}

/** Launch every note whose onset is before `upTo` (an audio-clock time) for the area the camera is dwelling in. */
export function musicPump(e: Eng, upTo: number) {
  const m = e.music
  if (!m || !m.on) return
  let guard = 0
  while (m.next <= upTo && guard++ < 6) {
    const area = m.area, C = CHORDS[area]
    // first notes of a new chord: root and fifth-ish, together, so the area is announced before it wanders
    const fresh = (m.last.get(area) ?? -1e9) < m.next - 14
    const prev = m.note.get(area) ?? -1
    let n = C.h[Math.floor(Math.random() * C.h.length)]
    if (n === prev && C.h.length > 1) n = C.h[(C.h.indexOf(n) + 1 + Math.floor(Math.random() * (C.h.length - 1))) % C.h.length]
    const t = Math.max(m.next, e.ctx.currentTime)
    padNote(e, m, t, area, n, 0.8)
    if (fresh) padNote(e, m, t + 0.35, area, C.h[Math.min(C.h.length - 1, 1)] * (Math.random() < 0.5 ? 1 : 2), 0.55)
    // a quiet octave above now and then (airy), never below the hum's 2nd harmonic
    if (Math.random() < 0.28) padNote(e, m, t + rnd(0.6, 1.4), area, n * 2, 0.35)
    m.last.set(area, t); m.note.set(area, n)
    m.next = t + rnd(C.every[0], C.every[1])
  }
  if (guard >= 6) m.next = upTo + 1 // we were far behind (a long idle): skip ahead rather than pile notes
}

/** Fade the bed out and forget it (sound turned off). */
export function stopMusic(e: Eng) {
  const m = e.music
  if (!m) return
  m.bus.gain.setTargetAtTime(0, e.ctx.currentTime, 0.05)
  e.music = null
}
