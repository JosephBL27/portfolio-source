// UNIT 15R: the producer of the signal bus (world/signals.ts). Once per frame it measures what the visitor and the world are doing (pointer, flight,
// hub TV, music, brain pulses, shooting stars, the particle morph) and writes it into shared uniforms, so the particle field, the stars, the nebulae,
// the constellations, the haze and the background equations all react to the same things and therefore to each other. Cost: a few vector ops per
// frame (measured in window.__atmos.cpu.reactive); the shaders do the rest and skip their branches when a signal is zero.
// Reduced motion: only the TV colour tint runs (colour, no motion). Phones: no pointer effect. ?extras=-reactive switches it all off.
// QA: window.__sig = { U, S }; __sig.fakeMusic(true/false) drives the music signals without audio (for stills); __sig.pulse() fires a brain pulse.
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import type { FlightState } from '../flight'
import { AREAS } from '../layout'
import { S, U } from '../signals'
import { turntable } from '../../../audio/turntable'
import { toV3, vibeOf } from './vibe/presets'
import { clamp01, damp, extraOn, isOn, isPhone, reducedMotion, sstep, timed } from './lib/flags'

const FIELD_KEYS = ['uSgPtr', 'uSgRo', 'uSgPv', 'uSgPcol', 'uSgMus', 'uSgMc', 'uSgRip'] as const

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('reactive') || !ctx.field?.scene) return
  const camera: THREE.PerspectiveCamera = ctx.field.camera, phone = isPhone()
  const fieldMat = ctx.field.points?.material as THREE.ShaderMaterial | undefined
  if (fieldMat?.uniforms) {
    for (const k of FIELD_KEYS) fieldMat.uniforms[k] = (U as Record<string, THREE.IUniform>)[k]
    fieldMat.needsUpdate = true   // the program's uniform list is built once: rebuild it so the new uniforms are uploaded
  }
  const fu = fieldMat?.uniforms as Record<string, { value: any }> | undefined

  // ---- pointer
  let px = 0, py = 0, havePtr = false, lastMoveAt = -99, pvx = 0, pvy = 0, pres = 0, ptrSpd = 0, inWindow = true
  if (!phone) {
    addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return
      const nx = (e.clientX / innerWidth) * 2 - 1, ny = -((e.clientY / innerHeight) * 2 - 1), now = performance.now()
      if (havePtr) { const dt = Math.max(0.008, (now - lastMoveAt * 1000) / 1000); pvx += ((nx - px) / dt - pvx) * 0.35; pvy += ((ny - py) / dt - pvy) * 0.35 }
      px = nx; py = ny; havePtr = true; lastMoveAt = now / 1000; inWindow = true
    }, { passive: true })
    document.documentElement.addEventListener('pointerleave', () => { inWindow = false })
  }

  // ---- state
  const prevCam = new THREE.Vector3(), head = new THREE.Vector3(0, 0, -1), vel = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3()
  const right = new THREE.Vector3(), upv = new THREE.Vector3(), hue = new THREE.Vector3(1, 1, 1), accent = new THREE.Color(), baseP = new THREE.Vector3(0.62, 0.78, 1)
  let haveCam = false, spd = 0, beta = 0, frame = 0, hubOn = 0, hubOff = 0, tvAmt = 0, tvKick = 0, morph = 0
  let bassS = 0, midS = 0, highS = 0, lvlS = 0, mk = 0, ripPhase = 1, ripAmp = 0, lastRip = 0, prevBeat = 0, synT = 0, flow = 0
  let pulseT = 9, trackKey = ''
  let fake: { bass: number; mid: number; high: number } | null = null
  const songCol = new THREE.Vector3(0.7, 0.8, 1)
  const flareTau = 0.9
  const cons = () => (window as unknown as { __astro?: { constellations?: { centers: THREE.Vector3[]; group: THREE.Object3D } } }).__astro?.constellations

  ctx.on((name) => {
    if (name === 'brain:pulse') pulseT = 0
    else if (name === 'hub:channel' || name === 'hub:detent') tvKick = 1
  })

  const update = (_t: number, dt0: number, st: FlightState) => {
    const rm = reducedMotion(), dt = Math.min(dt0, 0.1), now = performance.now()
    S.live = true; frame++
    camera.updateMatrixWorld()
    U.uSgRo.value.copy(camera.position)

    // ---------------- hub TV: its channel colour + power (colour only, so it also runs under reduced motion)
    if (frame % 3 === 0 && ctx.world?.stats) { const s = ctx.world.stats(); hubOn = s.hubOn ?? 0; hubOff = s.hubOff ?? 0 }
    let tvGoal = 0
    const L0 = fu?.uLight?.value?.[0] as THREE.Vector4 | undefined, C0 = fu?.uLightCol?.value?.[0] as THREE.Vector3 | undefined
    if (L0 && C0 && L0.w > 0) {
      const m = Math.max(C0.x, C0.y, C0.z, 1e-4), mn = Math.min(C0.x, C0.y, C0.z)
      tmp.set(C0.x / m, C0.y / m, C0.z / m)
      hue.x = damp(hue.x, tmp.x, 0.35, dt); hue.y = damp(hue.y, tmp.y, 0.35, dt); hue.z = damp(hue.z, tmp.z, 0.35, dt)
      tvGoal = Math.min(1, hubOn) * (1 - hubOff) * (0.4 + 0.6 * clamp01((m - mn) / m * 1.6))
    }
    tvAmt = damp(tvAmt, tvGoal, 0.6, dt); tvKick *= Math.exp(-dt / 0.55)
    U.uSgTv.value.set(hue.x, hue.y, hue.z, tvAmt); S.tvOn = tvAmt
    U.uSgBr.value.w = rm ? 0 : tvKick
    if (rm) {   // colour only: everything that moves is off
      U.uSgPtr.value.w = 0; U.uSgPtrC.value.z = 0; U.uSgHead.value.w = 0; U.uSgMus.value.set(0, 0, 0, 0); U.uSgRip.value.set(1, 0, 0, 0); U.uSgShim.value.w = 0
      U.uSgBr.value.x = 0; U.uSgBr.value.y = 0; U.uSgBr.value.z = 0; S.flare.fill(0); S.speed = 0; S.music = false
      return
    }

    // ---------------- flight: real camera velocity -> heading and a fan-out strength
    if (haveCam && dt > 1e-4) {
      vel.copy(camera.position).sub(prevCam).multiplyScalar(1 / dt)
      const raw = Math.min(1, vel.length() / 30)
      spd = damp(spd, raw, raw > spd ? 0.18 : 0.5, dt)
      if (raw > 0.04) { tmp.copy(vel).normalize(); head.lerp(tmp, 1 - Math.exp(-dt / 0.25)).normalize() }
    }
    prevCam.copy(camera.position); haveCam = true
    beta = 0.36 * sstep(0.05, 0.6, spd)
    U.uSgHead.value.set(head.x, head.y, head.z, beta); S.speed = spd
    flow += dt * (0.25 + 4.0 * spd)
    U.uSgFlow.value = flow

    // ---------------- pointer: a light and a gentle gravity well
    const idle = now / 1000 - lastMoveAt
    const goal = phone || !havePtr || !inWindow ? 0 : idle < 1.4 ? 1 : Math.max(0, 1 - (idle - 1.4) / 3.2) * 0.8 + 0.0
    pres = damp(pres, goal, goal > pres ? 0.12 : 0.9, dt)
    pvx *= Math.exp(-dt / 0.25); pvy *= Math.exp(-dt / 0.25)
    ptrSpd = damp(ptrSpd, Math.min(1, Math.hypot(pvx, pvy) / 2.6), 0.15, dt)
    if (pres > 0.003) {
      tmp.set(px, py, 0.5).unproject(camera).sub(camera.position).normalize()
      const w = pres * (0.4 + 0.6 * ptrSpd)
      U.uSgPtr.value.set(tmp.x, tmp.y, tmp.z, w)
      U.uSgPtrC.value.set(px / camera.projectionMatrix.elements[0], py / camera.projectionMatrix.elements[5], pres, 0)
      right.setFromMatrixColumn(camera.matrixWorld, 0); upv.setFromMatrixColumn(camera.matrixWorld, 1)
      U.uSgPv.value.copy(right).multiplyScalar(pvx / 2.6).addScaledVector(upv, pvy / 2.6)
      const a = AREAS.find(x => x.id === st.area)
      if (a) { accent.set(a.accent); U.uSgPcol.value.set(baseP.x, baseP.y, baseP.z).lerp(tmp2.set(accent.r, accent.g, accent.b), 0.35) }
    } else { U.uSgPtr.value.w = 0; U.uSgPtrC.value.z = 0 }

    // ---------------- music: bass / mids / highs and a ring across the cloud on every hit
    const playing = !!fake || (turntable.playing && !!turntable.track)
    mk = damp(mk, playing ? 1 : 0, playing ? 0.5 : 0.7, dt); S.music = mk > 0.02
    if (mk > 0.003 || playing) {
      let bass = 0, mid = 0, high = 0, beat = 0
      if (fake) { bass = fake.bass; mid = fake.mid; high = fake.high; synT += dt; if (synT > 0.55) { synT = 0; beat = 0.9 } }
      else {
        const b = turntable.bands(now), tr = turntable.track
        if (tr) { const key = `${tr.title}|${tr.artist}`; if (key !== trackKey) { trackKey = key; toV3(vibeOf(tr).flareColor, songCol) } }
        if (playing && !b.real) { synT += dt; const per = 60 / (vibeOf(tr).bpm || 100); if (synT >= per) { synT -= per; beat = 0.7 } bass = 0.3 + 0.2 * Math.max(0, 1 - synT * 4); mid = 0.3; high = 0.2 }
        else { bass = b.bass; mid = b.mid; high = b.high; beat = b.beat }
      }
      bassS = damp(bassS, clamp01((bass - 0.12) / 0.55), 0.06, dt); midS = damp(midS, clamp01((mid - 0.1) / 0.5), 0.1, dt); highS = damp(highS, clamp01(high / 0.4), 0.1, dt)
      lvlS = damp(lvlS, Math.min(1, (bassS + midS + highS) / 1.6), 0.1, dt)
      if (beat > 0.5 && prevBeat <= 0.5 && now - lastRip > 340) { lastRip = now; ripPhase = 0; ripAmp = Math.min(1, 0.45 + beat * 0.6) }
      prevBeat = beat
    } else { bassS = midS = highS = lvlS = 0; prevBeat = 0 }
    ripPhase = Math.min(1, ripPhase + dt / 1.5)
    U.uSgMus.value.set(bassS * mk, midS * mk, highS * mk, lvlS * mk)
    U.uSgRip.value.set(ripPhase, ripPhase >= 1 ? 0 : ripAmp * mk * (1 - ripPhase) * (1 - ripPhase), 0, 0)
    U.uSgMc.value.copy(songCol)

    // ---------------- brain pulse: a bright run along the constellation lines
    pulseT += dt
    U.uSgBr.value.x = Math.min(1.35, pulseT / 1.1 * 1.35); U.uSgBr.value.y = pulseT < 1.9 ? 1 - sstep(0.9, 1.9, pulseT) : 0

    // ---------------- morph in flight: the sky billows while the particles travel
    const mix = (fu?.uMix?.value as number | undefined) ?? 0
    morph = damp(morph, Math.sin(Math.PI * Math.min(1, Math.max(0, mix))), 0.2, dt); U.uSgBr.value.z = morph

    // ---------------- shooting star: where it is on screen, which constellation it passes, which equations it lights
    const sh = S.shoot
    if (sh.on && sh.env > 0.02) {
      tmp.copy(sh.dir).multiplyScalar(60).add(camera.position).project(camera)
      if (tmp.z < 1) {
        U.uSgShim.value.set(tmp.x, tmp.y, 0.34, sh.env)
        const c = cons()
        if (c?.group.visible) {
          const asp = innerWidth / innerHeight
          c.centers.forEach((p, i) => {
            tmp2.copy(p).project(camera); if (tmp2.z >= 1) return
            const d = Math.hypot((tmp2.x - tmp.x) * asp, tmp2.y - tmp.y)
            if (d < 0.5) S.flare[i] = Math.max(S.flare[i], sh.env * (1 - d / 0.5))
          })
        }
      } else U.uSgShim.value.w = 0
    } else U.uSgShim.value.w = damp(U.uSgShim.value.w, 0, 0.25, dt)
    for (let i = 0; i < S.flare.length; i++) S.flare[i] *= Math.exp(-dt / flareTau)
  }
  const timedUpdate = timed('reactive', update)
  ;(window as unknown as { __sig: unknown }).__sig = {
    U, S,
    /** QA: drive the music signals without audio */
    fakeMusic(on: boolean, o?: { bass?: number; mid?: number; high?: number }) { fake = on ? { bass: o?.bass ?? 0.6, mid: o?.mid ?? 0.5, high: o?.high ?? 0.4 } : null },
    pulse() { pulseT = 0 },
    /** QA: place the pointer without a real mouse */
    point(nx: number, ny: number, vx = 0, vy = 0) { px = nx; py = ny; havePtr = true; inWindow = true; lastMoveAt = performance.now() / 1000; pvx = vx; pvy = vy },
  }
  return {
    update(t, dt, st) {
      if (!isOn('reactive')) { if (S.live) { S.live = false; U.uSgPtr.value.w = 0; U.uSgPtrC.value.z = 0; U.uSgHead.value.w = 0; U.uSgTv.value.w = 0; U.uSgMus.value.set(0, 0, 0, 0); U.uSgRip.value.y = 0; U.uSgBr.value.set(0, 0, 0, 0); U.uSgShim.value.w = 0; S.flare.fill(0) } return }
      timedUpdate(t, dt, st)
    },
  }
}
