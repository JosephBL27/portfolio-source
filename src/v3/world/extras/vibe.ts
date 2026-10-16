// UNIT 10V: the world listens. While a record plays (audio/turntable.ts exposes band levels + onsets from an AnalyserNode), the final post pass
// reacts: bass or snare hits send a soft ripple across the screen from the platter (from screen centre once the visitor has flown on), the sky /
// fog / grade take the song's palette (authored preset in music.json + the sleeve's dominant colours), flares bloom on the beat, the mids breathe the
// picture, and per-song extras (rain, sparkle, a slow saturation swell, a tiny snare strobe) set the mood. The music keeps playing and the visuals keep
// reacting as the visitor flies on, until they stop it from the now-playing pill or the turntable.
// Comfort: every trigger is rate-limited to under 3 Hz, ripple displacement stays near 1% of the screen, the strobe is a few percent of brightness.
// Reduced motion: colour (wash, grade, saturation) only. Ambient (no music): chalk dust, candle light, groove sheen (vibe/ambient.ts).
// Contract: install(ctx) -> { update }. ?extras=-vibe switches it off. window.__vibe for QA.
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import type { FlightState } from '../flight'
import { WAYPOINTS } from '../layout'
import { turntable } from '../../../audio/turntable'
import { mountNowPlaying } from '../../ui/crate'
import { extraOn, isOn, reducedMotion, damp, lerp, timed } from './lib/flags'
import { artColors, toV3, vibeOf, type Vibe } from './vibe/presets'
import { createAmbient } from './vibe/ambient'
import { pump } from './musicviz/bus'

export function install(ctx: ExtraCtx): Extra | void {
  const field = ctx.field
  if (!extraOn('vibe') || !field?.post?.vibe || !ctx.canvas) return
  const post = field.post as { vibe: Record<string, { value: any }>; bloom: { strength: number }; settings: { bloomStrength: number }; apply(): void }
  const U = post.vibe
  const ambient = createAmbient(ctx)
  const iRec = WAYPOINTS.findIndex(w => w.id === 'records')
  const stages = () => (window as unknown as { __cab?: { stages?: Record<string, { api?: Record<string, any> }> } }).__cab?.stages ?? {}

  const pill = mountNowPlaying({
    stop: () => { const a = stages().records?.api as { eject?: () => void } | undefined; if (a?.eject) a.eject(); else turntable.unload() },
  })

  // ---- state
  let k = 0                                  // 0..1 how much of the song's look is on
  let vb: Vibe = vibeOf(null), trackKey = '', songT = 0
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), grade = new THREE.Vector3(), flc = new THREE.Vector3()
  const goalA = new THREE.Vector3(), goalC = new THREE.Vector3()
  const rings: { x: number; y: number; age: number; amp: number }[] = [0, 1, 2, 3].map(() => ({ x: 0.5, y: 0.5, age: 9, amp: 0 }))
  let ringI = 0, lastRip = -9, flare = 0, flx = 0.5, fly = 0.5, pulse = 0, strobe = 0, lastBeatSeen = 0, syn = 0
  let lvl = 0, lastTrig = 0, ripples = 0
  const baseBloom = () => post.settings.bloomStrength

  const platterUv = (): { x: number; y: number } | null => {
    const st = ctx.state(); const near = st.dwelling ? st.wp === iRec : Math.abs(st.wp + (st.next - st.wp) * st.t - iRec) < 0.5
    if (!near) return null
    const b = (stages().records?.api as { platterBox?: () => { x: number; y: number } | null } | undefined)?.platterBox?.()
    if (!b) return null
    const cv = ctx.canvas!.getBoundingClientRect()
    return { x: (b.x - cv.left) / cv.width, y: 1 - (b.y - cv.top) / cv.height }
  }
  const ripple = (amp: number, now: number) => {
    const o = platterUv() ?? { x: 0.5, y: 0.5 }, r = rings[ringI++ % 4]
    r.x = o.x; r.y = o.y; r.age = 0; r.amp = amp; lastRip = now; ripples++
    flx = o.x; fly = o.y
  }

  const setTrack = (t: typeof turntable.track) => {
    const key = t ? `${t.title}|${t.artist}` : ''
    if (key === trackKey) return
    trackKey = key; songT = 0
    if (!t) return
    vb = vibeOf(t)
    toV3(vb.palette[0], goalA); toV3(vb.palette[2], goalC); toV3(vb.palette[1], pb); toV3(vb.grade, grade); toV3(vb.flareColor, flc)
    void artColors(t.artwork).then(cols => {
      if (trackKey !== key || !cols.length) return
      goalA.lerp(cols[0].clone().multiplyScalar(1.1), 0.4); if (cols[1]) goalC.lerp(cols[1], 0.35)
      grade.lerp(cols[0], 0.2)
    })
  }

  const update = (t: number, dt: number, st: FlightState) => {
    const rm = reducedMotion(), now = performance.now()
    const playing = turntable.playing && !!turntable.track
    if (playing) setTrack(turntable.track)
    k = damp(k, playing ? 1 : 0, playing ? 0.9 : 0.6, dt)
    if (playing) songT += dt
    pill.sync(playing ? turntable.track : null)
    { const M = pump(now); pill.level(M.bass, M.mid, M.high, M.k) }

    const glow = ambient.update(t, dt, st, field.camera)
    const active = k > 0.003
    // v17: while a song colours the picture the area look steps back by up to 40 percent (the song's grade tints the look's highlight stop in the final pass), so the two never stack
    if (U.uLookK) U.uLookK.value = 1 - 0.4 * k
    const on = active || !!glow
    U.uVibe.value = on ? 1 : 0
    if (!on) { if (lvl !== 0) { lvl = 0; post.bloom.strength = baseBloom(); post.apply() } return }

    // ---- the song
    const b = turntable.bands(now)
    let beat = b.beat, snare = b.snare, mid = b.mid, bass = b.bass
    if (playing && !b.real) {                                  // preview played without an analyser: a quiet synthetic pulse at the song's tempo
      syn += dt; const per = 60 / vb.bpm
      if (syn >= per) { syn -= per; lastBeatSeen++; if (lastBeatSeen % 2) beat = 0.6; else snare = 0.55 }
      mid = 0.35; bass = 0.3
    }
    lvl = b.level
    if (active) {
      pa.copy(goalA); pc.copy(goalC)
      U.uPA.value.copy(pa); U.uPB.value.copy(pb); U.uPC.value.copy(pc); U.uGrade.value.copy(grade); U.uFlCol.value.copy(flc)
      const swell = vb.swell ? Math.min(1, songT / vb.swell) : 1
      U.uWash.value = vb.wash * 1.9 * k * (0.8 + 0.4 * (rm ? 0 : bass))
      U.uGradeAmt.value = vb.gradeAmt * k
      U.uSat.value = lerp(1, vb.sat, k * swell)
      if (!rm) {
        // triggers: at most one per 340 ms (under 3 Hz), whatever the music does
        const rippleHit = vb.ripple === 'bass' ? beat : snare, other = vb.ripple === 'bass' ? snare : beat
        if (now - lastRip > 340 && playing) {
          if (rippleHit > 0.5) ripple(Math.min(1.2, rippleHit * vb.rippleAmp * 1.1), now)
          else if (other > 0.7) ripple(other * vb.rippleAmp * 0.5, now)
        }
        const fl = vb.flare === 'beat' ? beat : vb.flare === 'snare' ? snare : 0
        if (fl > 0.55 && now - lastTrig > 340) { lastTrig = now; flare = Math.max(flare, 0.5 * Math.min(1, fl)) ; if (rings[(ringI + 3) % 4].age > 0.2) { const o = platterUv(); if (o) { flx = o.x; fly = o.y } } }
        if (vb.strobe && snare > 0.6) strobe = Math.max(strobe, vb.strobe * snare)
        flare *= Math.exp(-dt / 0.38); strobe *= Math.exp(-dt / 0.14)
        pulse = damp(pulse, 0.035 * mid + strobe, 0.06, dt) * k
        U.uRain.value = vb.rain * k * (0.5 + 0.5 * mid); U.uSpark.value = vb.spark * k * (0.4 + 0.9 * b.high)
        U.uFl.value.set(flx, fly, flare * k, 14)
        post.bloom.strength = baseBloom() * (1 + 0.45 * k * Math.max(beat * 0.8, bass * 0.4))
      } else { U.uRain.value = 0; U.uSpark.value = 0; U.uFl.value.z = 0; pulse = 0 }
    } else { U.uWash.value = 0; U.uGradeAmt.value = 0; U.uSat.value = 1; U.uRain.value = 0; U.uSpark.value = 0; U.uFl.value.z = 0; pulse = 0; flare = 0; if (post.bloom.strength !== baseBloom()) post.bloom.strength = baseBloom() }
    U.uPulse.value = pulse
    for (let i = 0; i < 4; i++) {
      const r = rings[i]; r.age += dt; if (r.age > 2.4) r.amp = 0
      ;(U.uRip.value[i] as THREE.Vector4).set(r.x, r.y, r.age, rm ? 0 : r.amp * (active ? 1 : 0))
    }
    if (glow) { U.uGlow.value.set(glow.x, glow.y, glow.z, glow.w); U.uGlowMode.value = glow.mode; U.uGlowR.value.set(glow.rx, glow.ry); U.uGlowCol.value.set(...glow.col) } else U.uGlow.value.z = 0
  }
  const timedUpdate = timed('vibe', update)
  ;(window as unknown as { __vibe?: unknown }).__vibe = {
    get k() { return k }, get ripples() { return ripples }, get vibe() { return vb }, get bands() { return turntable.bands() },
    get uniforms() { return { wash: U.uWash.value, sat: U.uSat.value, rip: U.uRip.value.map((v: THREE.Vector4) => v.toArray()), pulse: U.uPulse.value, vibe: U.uVibe.value, pa: U.uPA.value.toArray(), grade: U.uGrade.value.toArray() } },
    ripple: () => ripple(1, performance.now()),
  }
  return { update(t, dt, st) { if (!isOn('vibe')) { if (U.uVibe.value) { U.uVibe.value = 0; post.bloom.strength = baseBloom() } return } timedUpdate(t, dt, st) } }
}
