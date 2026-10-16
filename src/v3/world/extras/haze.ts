// UNIT 14S: atmosphere between and behind the stops. Everything is additive, depth-tested, drawn before the copy, off with ?extras=-haze or
// window.__atmos.on.haze = false, and holds still under reduced motion.
//   haze/warp.ts    star streaks proportional to the flight's speed (travel)
//   haze/clouds.ts  nebula clouds in the gaps between areas that the camera flies through (travel)
//   haze/comet.ts   an occasional comet with a dust tail (travel)
//   haze/shafts.ts  light shafts: a cone under the hub screen, beams behind the hall's windows (depth)
//   haze/ground.ts  low ground haze that catches each area's coloured light (depth). v20: no horizon wash, no ambient floor: the sky stays black
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import { AREAS, WAYPOINTS } from '../layout'
import { damp, extraOn, isOn, isPhone, reducedMotion, sstep, timed } from './lib/flags'
import { createWarp } from './haze/warp'
import { createClouds } from './haze/clouds'
import { createComet } from './haze/comet'
import { createShafts } from './haze/shafts'
import { createGround } from './haze/ground'

/** v20: the floor haze is a whisper under the pad you stand at (the black was better: light on the floor adds to every form's pixels and greys them) */
const GROUND_K = 0.4

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('haze') || !ctx.field?.scene) return
  const scene: THREE.Scene = ctx.field.scene, camera: THREE.PerspectiveCamera = ctx.field.camera, phone = isPhone()
  const warp = createWarp(phone), clouds = createClouds(phone), comet = createComet(phone), shafts = createShafts(phone), ground = createGround()
  const rideCam = new THREE.Group(); rideCam.name = 'haze-ride'; rideCam.userData.noReflect = true; rideCam.add(comet.group)   // rides with the camera
  for (const o of [warp.mesh, clouds.group, shafts.group, ground.group, rideCam]) { o.userData.noReflect = true; scene.add(o) }
  warp.mesh.name = 'haze-warp'; clouds.group.name = 'haze-clouds'; shafts.group.name = 'haze-shafts'; ground.group.name = 'haze-ground'
  const hallIdx = WAYPOINTS.findIndex(w => w.id === 'hall'), gateIdx = WAYPOINTS.findIndex(w => w.id === 'gate')
  let clock = 0, vis = 0, hubK = 0, hallK = 0, hubOn = 0, hubShow = 1, frame = 0
  const on = new Float32Array(6)
  ;(window as unknown as { __haze: unknown }).__haze = { warp, clouds, comet, shafts, ground }
  const all = [warp.mesh, clouds.group, shafts.group, ground.group, rideCam]

  return {
    update: timed('haze', (t, dt, st) => {
      const live = isOn('haze'), rm = reducedMotion(); frame++
      for (const o of all) o.visible = live
      if (!live) return
      dt = Math.min(dt, 0.1); clock += dt
      vis = rm ? 1 : sstep(0, 2.5, clock) // arrives after the stars
      const wf = st.wp + (st.dwelling ? 0 : st.t), calm = 0.25 + 0.75 * sstep(0.6, 2, wf)   // the prologue's particle cloud is the picture
      const tt = rm ? 0 : t
      rideCam.position.copy(camera.position)
      // travel: the warp and the comet belong to the legs; clouds are seen in flight and, faintly, at rest
      const leg = st.dwelling ? 0 : 1, speed = leg * st.speed
      if (!rm) warp.update(speed, dt, vis * calm); else warp.mesh.visible = false
      clouds.update(tt, camera, vis * calm * (rm ? 0.6 : 0.5 + 0.5 * leg) * (1 - hallK))   // v20: not inside the hall (a roof is not a sky: the clouds lifted its vault to p5 0.047 on the way in)
      comet.update(dt, !!leg && st.speed > 0.2 && calm > 0.8, rm)
      // depth: hub cone follows the hub screen; hall beams belong to the hall and its gate
      if (frame % 3 === 0 && ctx.world?.stats) { const s = ctx.world.stats(); hubOn = s.hubOn ?? 0; hubShow = s.hubShow ?? 1 }
      const hubG = damp(hubK, Math.min(1, 0.25 + hubOn * 0.75) * calm * hubShow, 0.5, dt); hubK = rm ? 0.6 * calm * hubShow : hubG
      const inHall = (st.wp === hallIdx || st.wp === gateIdx || st.next === hallIdx || st.next === gateIdx) ? 1 : 0
      hallK = rm ? inHall : damp(hallK, inHall, 0.8, dt)
      shafts.update(tt, camera, hubK, hallK)
      // ground haze: area pads light up like the mirror's
      const a0 = AREAS.findIndex(a => a.id === st.area), dst = WAYPOINTS[Math.max(0, Math.min(WAYPOINTS.length - 1, st.next))].area, a1 = AREAS.findIndex(a => a.id === dst), k = st.dwelling ? 0 : st.t
      for (let i = 0; i < 6; i++) on[i] = rm ? (i === a0 ? 1 : 0) : damp(on[i], (i === a0 ? 1 - k : 0) + (i === a1 ? k : 0), 0.4, dt)
      for (const m of ground.mats) { m.uniforms.uT.value = tt; m.uniforms.uOn.value = on; m.uniforms.uHub.value = Math.min(1, hubOn) * hubShow; m.uniforms.uGain.value = vis * calm * (phone ? 0 : GROUND_K) }
      ground.group.visible = !phone
    }),
  }
}
