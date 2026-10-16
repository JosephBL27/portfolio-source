// The music bus (unit 15M): ONE per-frame reading of the turntable's analyser, shared by everything that reacts to a song: the room (wall equaliser, landscape, beams,
// VU meters, speakers, lamp), the deck (spectrum ring, embers, the vinyl's kaleidoscope), the sky (nebula) and the post pass (vibe.ts). Read-only on the audio.
// `pump(now)` is idempotent inside a frame (the first caller computes, later callers within 4 ms reuse), so no module has to own the order.
// `MUSIC.k` is how much of the show is on (0..1, eases up in 0.9 s, down in 0.6 s): every consumer scales by it, so everything falls back to calm when the record stops.
// Without a real analyser (the preview host refused CORS) a synthetic spectrum follows the song's tempo, the same way vibe.ts always did.
import * as THREE from 'three'
import { turntable, SPEC_N, type Track } from '../../../../audio/turntable'
import { artColors, vibeOf, type Vibe } from '../vibe/presets'
import { moodOf, type Mood } from './moods'
import { DH } from '../cabinet/kit'

export { SPEC_N }
export interface Music {
  k: number; on: boolean; real: boolean
  level: number; sub: number; bass: number; mid: number; high: number
  /** 1 on a kick / on a snare or hat, decaying */
  beat: number; snare: number
  /** the count of kicks and snares since the song began (a consumer that wants "a new hit this frame" compares against its own copy) */
  beats: number; snares: number
  /** analog VU ballistics (about 300 ms), left / right, 0..1; peak = the slow-falling max */
  vuL: number; vuR: number; peak: number
  /** the spectrum, SPEC_N log bands, smoothed (fast attack, slow release), and a peak-hold copy that falls */
  spec: Float32Array; hold: Float32Array
  /** seconds into the song; phase = an accumulator that runs faster when the music is loud (drives slow drifts) */
  songT: number; phase: number
  pal: [THREE.Color, THREE.Color, THREE.Color]; vibe: Vibe; mood: Mood; title: string
}
export const MUSIC: Music = {
  k: 0, on: false, real: false, level: 0, sub: 0, bass: 0, mid: 0, high: 0, beat: 0, snare: 0, beats: 0, snares: 0, vuL: 0, vuR: 0, peak: 0,
  spec: new Float32Array(SPEC_N), hold: new Float32Array(SPEC_N), songT: 0, phase: 0,
  pal: [DH('#c8884a'), DH('#1a1008'), DH('#ffd9a8')], vibe: vibeOf(null), mood: moodOf(null, vibeOf(null)), title: '',
}

let last = -1, trackKey = '', syn = 0, synBeat = 0, lastBeatSeen = 0, lastBeats = 0, lastSnares = 0
const goal: [THREE.Color, THREE.Color, THREE.Color] = [DH('#c8884a'), DH('#1a1008'), DH('#ffd9a8')]

const DC = (v: THREE.Vector3) => new THREE.Color().setRGB(v.x, v.y, v.z, THREE.LinearSRGBColorSpace)
function setTrack(t: Track | null) {
  const key = t ? `${t.title}|${t.artist}` : ''
  if (key === trackKey) return
  trackKey = key; MUSIC.songT = 0; MUSIC.beats = MUSIC.snares = lastBeats = lastSnares = 0
  if (!t) return
  const v = vibeOf(t); MUSIC.vibe = v; MUSIC.mood = moodOf(t, v); MUSIC.title = t.title
  goal[0].copy(DH(v.palette[0])); goal[1].copy(DH(v.palette[1])); goal[2].copy(DH(v.palette[2]))   // display-referred, like every colour in the cabinet
  void artColors(t.artwork).then(cols => {                       // the sleeve's own colours nudge the preset's (as vibe.ts does for the post pass)
    if (trackKey !== key || !cols.length) return
    goal[0].lerp(DC(cols[0]), 0.4)
    if (cols[1]) goal[2].lerp(DC(cols[1]), 0.35)
  })
}

const avg = new Float32Array(SPEC_N)
const att = (cur: number, to: number, dt: number, up: number, down: number) => cur + (to - cur) * (1 - Math.exp(-dt / (to > cur ? up : down)))

export function pump(now = performance.now()): Music {
  if (last >= 0 && now - last < 4) return MUSIC
  const dt = last < 0 ? 0.016 : Math.min(0.1, (now - last) / 1000); last = now
  const M = MUSIC, playing = turntable.playing && !!turntable.track
  if (playing) setTrack(turntable.track)
  M.on = playing
  M.k = att(M.k, playing ? 1 : 0, dt, 0.9, 0.6)
  if (M.k < 0.004 && !playing) {                                     // fully calm: nothing to compute (the arrays settle to zero once)
    if (M.level > 0.001 || M.beat > 0.001) { M.level = M.bass = M.mid = M.high = M.sub = M.beat = M.snare = M.vuL = M.vuR = M.peak = 0; M.spec.fill(0); M.hold.fill(0) }
    return M
  }
  if (playing) M.songT += dt
  for (let i = 0; i < 3; i++) M.pal[i].lerp(goal[i], 1 - Math.exp(-dt / 0.5))
  const b = turntable.bands(now), s = turntable.spectrum()
  M.real = b.real
  if (b.real) {
    if (b.beat > M.beat) { M.beat = b.beat; M.beats++ } else M.beat = b.beat
    if (b.snare > M.snare) { M.snare = b.snare; M.snares++ } else M.snare = b.snare
    // each band is read against its own recent average: a sustained note sits mid-height, a hit stands tall (and the picture never pegs at the top whatever the master level is)
    const ka = 1 - Math.exp(-dt / 3.5)
    for (let i = 0; i < SPEC_N; i++) {
      const v = s.spec[i]; avg[i] += (v - avg[i]) * ka
      const rel = v / (avg[i] * 1.35 + 0.1), x = Math.max(0, Math.min(1, rel * 0.7)) * Math.min(1, 0.35 + v * 3)
      M.spec[i] = att(M.spec[i], x, dt, 0.035, 0.16)
    }
    let lo = 0, mi = 0, hi = 0; for (let i = 0; i < 10; i++) lo += M.spec[i]; for (let i = 10; i < 33; i++) mi += M.spec[i]; for (let i = 33; i < SPEC_N; i++) hi += M.spec[i]
    M.sub = lo / 10; M.bass = lo / 10; M.mid = mi / 23; M.high = hi / 15; M.level = (lo + mi + hi) / SPEC_N
    M.vuL = att(M.vuL, s.l, dt, 0.3, 0.45); M.vuR = att(M.vuR, s.r, dt, 0.3, 0.45)
  } else if (playing) {
    // a synthetic show at the song's tempo: a kick on the beat, a snare on the off-beat, a gentle breathing in the mids
    const per = 60 / M.vibe.bpm; syn += dt; M.beat *= Math.exp(-dt / 0.16); M.snare *= Math.exp(-dt / 0.12)
    if (syn >= per) { syn -= per; lastBeatSeen++; if (lastBeatSeen % 2) { M.beat = 0.9; M.beats++ } else { M.snare = 0.8; M.snares++ } }
    synBeat = att(synBeat, 0, dt, 0.1, 0.18); if (M.beat > 0.85) synBeat = 1
    M.bass = 0.2 + 0.4 * synBeat; M.sub = M.bass * 0.8; M.mid = 0.3 + 0.12 * Math.sin(M.songT * 1.7); M.high = 0.15 + 0.2 * M.snare; M.level = 0.35 + 0.3 * synBeat
    for (let i = 0; i < SPEC_N; i++) {
      const x = i / SPEC_N, env = x < 0.3 ? synBeat * (1 - x * 1.6) : x < 0.7 ? 0.28 + 0.16 * Math.sin(M.songT * 2.1 + i * 0.7) : 0.12 + 0.55 * M.snare * x
      M.spec[i] = att(M.spec[i], Math.max(0, env * (0.8 + 0.2 * Math.sin(i * 12.9898 + M.songT * 3))), dt, 0.04, 0.16)
    }
    M.vuL = att(M.vuL, 0.45 + 0.3 * synBeat, dt, 0.3, 0.45); M.vuR = att(M.vuR, 0.42 + 0.3 * synBeat, dt, 0.3, 0.45)
  } else {                                                           // the record stopped: everything falls away
    const f = Math.exp(-dt / 0.25)
    M.level *= f; M.bass *= f; M.mid *= f; M.high *= f; M.sub *= f; M.beat *= f; M.snare *= f; M.vuL *= f; M.vuR *= f
    for (let i = 0; i < SPEC_N; i++) M.spec[i] *= f
  }
  const fall = Math.exp(-dt / 0.9)
  for (let i = 0; i < SPEC_N; i++) { const v = M.spec[i]; M.hold[i] = v >= M.hold[i] ? v : Math.max(v, M.hold[i] * fall - dt * 0.12) }
  M.peak = Math.max(Math.max(M.vuL, M.vuR), M.peak * Math.exp(-dt / 1.1))
  M.phase += dt * (0.25 + 1.6 * M.level) * M.k
  lastBeats = M.beats; lastSnares = M.snares
  return M
}
/** true once for each new kick / snare a consumer has not yet seen: pass your own counter holder */
export const newHits = (seen: { b: number; s: number }) => { const r = { beat: MUSIC.beats !== seen.b, snare: MUSIC.snares !== seen.s }; seen.b = MUSIC.beats; seen.s = MUSIC.snares; return r }
export const _dbg = () => ({ lastBeats, lastSnares })
