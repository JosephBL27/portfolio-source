// Shared kit for the 8M set pieces (mosaic, panels, curtain): a second camera on the same scene, drawn into a half-float render target, so a piece can
// show "the other shot" (the destination from where the flight will end, or the live view frozen into tiles) as a texture.
//   * Capture: one render target + camera; render(env, pose, opts) draws the scene from `pose` into it. Particle alpha (the arbiter hides the field
//     in the main frame) and the morph can be forced for the capture only and are always restored; the piece's own meshes are hidden for it.
//   * soft-clip GLSL: the render target holds raw HDR, the post stack soft-clips it, so a tile that shows it does the same (SOFT_GLSL).
//   * SCREEN_MAT: a premultiplied-over blend, no depth write against the scene (the pieces draw last, in front).
//   * a few shared curves: pure functions of leg progress only.
import * as THREE from 'three'
import type { CamPose, Env } from './common'
import { LANE_ON } from '../lib/lane'

export interface CaptureOpts {
  /** objects to hide while the capture is drawn (the piece's own meshes); atmos-mirror and every scene child flagged noReflect are always hidden */
  hide?: (THREE.Object3D | null | undefined)[]
  /** force the particle morph (0..1) for the capture; omit to show the field exactly as it is now */
  mix?: number
}

export class Capture {
  rt: THREE.WebGLRenderTarget | null = null
  readonly cam = new THREE.PerspectiveCamera(35, 1.6, 0.1, 400)
  constructor(private scale = 0.7, private maxW = 1280) {}
  get texture(): THREE.Texture | null { return this.rt?.texture ?? null }
  size(env: Env) {
    const w = Math.max(64, Math.round(Math.min(env.res.x * this.scale, this.maxW))), h = Math.max(64, Math.round(env.res.y * (w / Math.max(1, env.res.x))))
    if (!this.rt) {
      this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true, samples: 0 })
      const t = this.rt.texture; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false
    } else if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h)
  }
  render(env: Env, pose: CamPose, o: CaptureOpts = {}) {
    this.size(env)
    const rt = this.rt!, cam = this.cam, r = env.renderer, scene = env.scene
    cam.position.set(...pose.pos); cam.up.set(0, 1, 0); cam.lookAt(pose.target[0], pose.target[1], pose.target[2])
    cam.fov = pose.fov; cam.aspect = env.res.x / Math.max(1, env.res.y); cam.near = env.camera.near; cam.far = env.camera.far
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true)
    const hidden: THREE.Object3D[] = []
    const hideIt = (x: THREE.Object3D | null | undefined) => { if (x && x.visible && !hidden.includes(x)) { x.visible = false; hidden.push(x) } }
    for (const x of o.hide ?? []) hideIt(x)
    hideIt(scene.getObjectByName('atmos-mirror'))
    for (const ch of scene.children) if (ch.userData.noReflect) hideIt(ch)
    const pu = (env.field.points?.material as THREE.ShaderMaterial | undefined)?.uniforms as Record<string, THREE.IUniform> | undefined
    const dpr0 = pu?.uDpr?.value as number | undefined, hide0 = pu?.uFieldHide?.value as number | undefined, mix0 = pu?.uMix?.value as number | undefined
    if (pu?.uDpr && dpr0 != null) pu.uDpr.value = dpr0 * (rt.width / Math.max(1, env.res.x))      // point sizes follow the smaller target
    if (pu?.uFieldHide && hide0 != null) pu.uFieldHide.value = 0                                 // the arbiter may have the field hidden in the main frame; the capture shows it
    if (o.mix != null && pu?.uMix && mix0 != null) pu.uMix.value = o.mix
    const laneOn = LANE_ON.value; LANE_ON.value = 0
    const prevRT = r.getRenderTarget()
    try { r.setRenderTarget(rt); r.clear(); r.render(scene, cam) } finally {
      r.setRenderTarget(prevRT); LANE_ON.value = laneOn
      if (pu?.uDpr && dpr0 != null) pu.uDpr.value = dpr0
      if (pu?.uFieldHide && hide0 != null) pu.uFieldHide.value = hide0
      if (pu?.uMix && mix0 != null) pu.uMix.value = mix0
      for (const x of hidden) x.visible = true
    }
  }
  dispose() { this.rt?.dispose(); this.rt = null }
}

/** GLSL: the render target is raw HDR; the post stack soft-clips it before bloom, so a screen that shows it does too */
export const SOFT_GLSL = /* glsl */ `vec3 softClip(vec3 c) { return 1.0 - exp(-max(c, 0.0) * 2.1); }`

/** premultiplied-over, drawn last, no depth write (the piece sits in front of everything) */
export function overlayBlend(m: THREE.ShaderMaterial, depthTest = false) {
  m.transparent = true; m.depthWrite = false; m.depthTest = depthTest
  m.blending = THREE.CustomBlending; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor
}

/** the camera pose of the flight with the leg compressed to its first `f` share: arrives at the end pose at u = f and holds (the pieces that show the destination as a still need the camera there first) */
export function arriveBy(env: Env, u: number, f: number): CamPose {
  const w = Math.min(1, u / f)
  return env.flightCam(w)
}

/** out-back: ends at 1 after a small overshoot (a split-flap card settling, a curtain swinging to rest), closed form */
export function easeOutBack(t: number, s = 1.35): number {
  const x = Math.min(1, Math.max(0, t)) - 1
  return 1 + (s + 1) * x * x * x + s * x * x
}
