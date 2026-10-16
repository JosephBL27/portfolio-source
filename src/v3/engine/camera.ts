// Camera rig for the particle field: a critically damped spring toward the camera of whichever
// form dominates (A -> B blended by the morph mix), pointer parallax, a dolly kick from scroll
// velocity and a very slow idle drift. Narrow (phone) viewports are dollied back so a form's
// width still fits. Reduced motion: no parallax, no kick, no idle drift.
import * as THREE from 'three'

export interface CamSpec { pos: [number, number, number]; target: [number, number, number]; fov?: number; /** half extent (world units, about the target) that must stay in frame on a narrow viewport; default CameraRig.halfWidth */ halfWidth?: number }
export const DEFAULT_CAM: CamSpec = { pos: [0, 0, 9], target: [0, 0, 0], fov: 35 }

/** Critically damped smoothing (the closed-form "smooth damp"): no overshoot, no tuning needed
 *  beyond the time it takes to arrive. Returns [value, velocity]. */
export function smoothDamp(cur: number, target: number, vel: number, smoothTime: number, dt: number): [number, number] {
  const om = 2 / Math.max(1e-4, smoothTime), x = om * dt
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const ch = cur - target, tmp = (vel + om * ch) * dt
  return [target + (ch + tmp) * e, (vel - om * tmp) * e]
}

const smooth01 = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t) }

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.05, 120)
  reducedMotion = false
  /** how much of a form's width must stay in frame on a narrow viewport (world units, half extent) */
  halfWidth = 2.9
  private p = [0, 0, 9]; private pv = [0, 0, 0]
  private t = [0, 0, 0]; private tv = [0, 0, 0]
  private f = 35; private fv = 0
  private px = 0; private pxv = 0; private py = 0; private pyv = 0   // smoothed pointer
  private kick = 0; private kickV = 0; private kickIn = 0             // dolly kick
  private nx = 0; private ny = 0                                       // raw pointer, -1..1
  private a: CamSpec = DEFAULT_CAM; private b: CamSpec = DEFAULT_CAM; private mix = 0
  private fresh = true
  // v4: camera driven directly by the flight (no per-form specs); light damping so it never trails the morph
  private direct: { pos: number[]; target: number[]; fov: number; hw: number } | null = null
  private prevP = [0, 0, 0]; private prevDir = [0, 0, -1]; private spd = 0; private yawRate = 0; private roll = 0; private fovAdd = 0
  /** 0..1 camera speed (units/s over SPEED_REF), smoothed; drives FOV and the speed look */
  speedNorm = 0
  private havePrev = false
  /** world units/s that count as speed 1 (a cruising long leg) */
  static SPEED_REF = 30
  private tmpR = new THREE.Vector3(); private tmpU = new THREE.Vector3(); private tmpD = new THREE.Vector3()
  /** sum of |velocity| and distance to goal: ~0 when the rig has settled */
  energy = 0
  /** world distance from camera to its look target (used for auto-focus) */
  distance = 9

  setAspect(a: number) { this.camera.aspect = a; this.camera.updateProjectionMatrix() }
  setTargets(a: CamSpec | undefined, b: CamSpec | undefined, mix: number) {
    this.a = a ?? DEFAULT_CAM; this.b = b ?? DEFAULT_CAM; this.mix = mix
  }
  /** v4: aim the camera straight at a flight pose (call every frame). hw = half extent (world units) that must stay in frame on a narrow viewport. */
  setDirect(pos: ArrayLike<number>, target: ArrayLike<number>, fov: number, hw?: number) {
    const d = this.direct ?? (this.direct = { pos: [0, 0, 0], target: [0, 0, 0], fov: 35, hw: this.halfWidth })
    for (let i = 0; i < 3; i++) { d.pos[i] = pos[i]; d.target[i] = target[i] }
    d.fov = fov; d.hw = hw ?? this.halfWidth
  }
  clearDirect() { this.direct = null }
  setPointer(nx: number, ny: number) { this.nx = nx; this.ny = ny }
  /** scroll velocity in viewport-heights per second (+ = scrolling down) */
  setVelocity(v: number) { this.kickIn = v }
  snap() { this.fresh = true; this.havePrev = false }

  update(dt: number, time: number) {
    dt = Math.min(dt, 0.1)
    const e = smooth01(this.mix), A = this.a, B = this.b, D = this.direct
    const lerp = (x: number, y: number) => x + (y - x) * e
    const goalP = D ? D.pos.slice() : [lerp(A.pos[0], B.pos[0]), lerp(A.pos[1], B.pos[1]), lerp(A.pos[2], B.pos[2])]
    const goalT = D ? D.target.slice() : [lerp(A.target[0], B.target[0]), lerp(A.target[1], B.target[1]), lerp(A.target[2], B.target[2])]
    const goalF = D ? D.fov : lerp(A.fov ?? 35, B.fov ?? 35)

    // narrow viewport: back off so the form's width fits
    const tanH = Math.tan((goalF * Math.PI) / 360), aspect = this.camera.aspect
    const dx = goalP[0] - goalT[0], dy = goalP[1] - goalT[1], dz = goalP[2] - goalT[2]
    const dist = Math.hypot(dx, dy, dz) || 1
    const hw = D ? D.hw : lerp(A.halfWidth ?? this.halfWidth, B.halfWidth ?? this.halfWidth)
    const need = (hw / (tanH * aspect)) * 0.95
    if (need > dist) { const s = need / dist; goalP[0] = goalT[0] + dx * s; goalP[1] = goalT[1] + dy * s; goalP[2] = goalT[2] + dz * s }

    if (this.fresh) { this.p = goalP.slice(); this.t = goalT.slice(); this.f = goalF; this.pv = [0, 0, 0]; this.tv = [0, 0, 0]; this.fv = 0; this.fresh = false }
    const ST = D ? (this.reducedMotion ? 0.02 : 0.11) : 0.62
    let en = 0
    for (let i = 0; i < 3; i++) {
      const [pp, pv] = smoothDamp(this.p[i], goalP[i], this.pv[i], ST, dt); this.p[i] = pp; this.pv[i] = pv
      const [tt, tv] = smoothDamp(this.t[i], goalT[i], this.tv[i], ST * 0.9, dt); this.t[i] = tt; this.tv[i] = tv
      en += Math.abs(pv) + Math.abs(tv) + Math.abs(pp - goalP[i]) + Math.abs(tt - goalT[i])
    }
    { const [ff, fv] = smoothDamp(this.f, goalF, this.fv, D ? ST : 0.55, dt); this.f = ff; this.fv = fv; en += Math.abs(fv) + Math.abs(ff - goalF) * 0.1 }

    // pointer parallax and scroll kick (both off for reduced motion)
    const rm = this.reducedMotion
    const wx = rm ? 0 : this.nx, wy = rm ? 0 : this.ny
    { const [v, vv] = smoothDamp(this.px, wx, this.pxv, 0.42, dt); this.px = v; this.pxv = vv; en += Math.abs(vv) + Math.abs(v - wx) }
    { const [v, vv] = smoothDamp(this.py, wy, this.pyv, 0.42, dt); this.py = v; this.pyv = vv; en += Math.abs(vv) + Math.abs(v - wy) }
    const kickGoal = rm ? 0 : Math.max(-3, Math.min(3, this.kickIn)) * (D ? 0.1 : 0.3) // v4: at most 0.3 units
    { const [v, vv] = smoothDamp(this.kick, kickGoal, this.kickV, 0.32, dt); this.kick = v; this.kickV = vv; en += Math.abs(vv) + Math.abs(v - kickGoal) }
    this.energy = en

    const P = this.p, T = this.t
    // speed look (v4): real camera speed -> FOV widening and a slight bank into turns
    {
      const first = !this.havePrev
      const inst = first ? 0 : Math.hypot(P[0] - this.prevP[0], P[1] - this.prevP[1], P[2] - this.prevP[2]) / Math.max(dt, 1e-3)
      this.havePrev = true
      this.spd += (inst - this.spd) * (1 - Math.exp(-dt / 0.12))
      const sn = Math.min(1, this.spd / CameraRig.SPEED_REF)
      this.speedNorm = sn
      const dx2 = T[0] - P[0], dz2 = T[2] - P[2], l2 = Math.hypot(dx2, dz2) || 1, nx2 = dx2 / l2, nz2 = dz2 / l2
      if (first) { this.prevDir[0] = nx2; this.prevDir[2] = nz2 }
      const dTheta = Math.atan2(this.prevDir[2] * nx2 - this.prevDir[0] * nz2, this.prevDir[0] * nx2 + this.prevDir[2] * nz2)
      this.prevDir[0] = nx2; this.prevDir[2] = nz2
      const yr = Math.max(-1.2, Math.min(1.2, dTheta / Math.max(dt, 1e-3)))
      this.yawRate += (yr - this.yawRate) * (1 - Math.exp(-dt / 0.3))
      this.prevP[0] = P[0]; this.prevP[1] = P[1]; this.prevP[2] = P[2]
      const look = D && !rm
      this.fovAdd += ((look ? 3.5 * sn : 0) - this.fovAdd) * (1 - Math.exp(-dt / 0.2))
      this.roll += ((look ? (this.yawRate / 0.6) * 0.0436 * Math.min(1, sn * 2) : 0) - this.roll) * (1 - Math.exp(-dt / 0.3))
      this.energy += Math.abs(this.fovAdd) * 0.2 + Math.abs(this.roll) * 4 + this.spd * 0.01
    }
    this.tmpD.set(T[0] - P[0], T[1] - P[1], T[2] - P[2])
    const d = this.tmpD.length() || 1; this.distance = d
    this.tmpD.multiplyScalar(1 / d)
    this.tmpR.crossVectors(this.tmpD, THREE.Object3D.DEFAULT_UP).normalize()
    this.tmpU.crossVectors(this.tmpR, this.tmpD).normalize()
    const k = d / 9 // parallax and drift scale with distance, so framing stays consistent
    const idle = rm ? 0 : 1
    const par = D ? 1 - 0.85 * this.speedNorm : 1 // pointer parallax never fights the path in flight
    const ox = this.px * 0.55 * k * par + Math.sin(time * 0.21) * 0.06 * k * idle
    const oy = -this.py * 0.32 * k * par + Math.sin(time * 0.17 + 1.3) * 0.04 * k * idle
    const cam = this.camera
    cam.position.set(
      P[0] + this.tmpR.x * ox + this.tmpU.x * oy + this.tmpD.x * this.kick,
      P[1] + this.tmpR.y * ox + this.tmpU.y * oy + this.tmpD.y * this.kick,
      P[2] + this.tmpR.z * ox + this.tmpU.z * oy + this.tmpD.z * this.kick,
    )
    cam.up.set(0, 1, 0)
    cam.lookAt(T[0], T[1], T[2])
    if (this.roll) cam.rotateZ(this.roll)
    const fov = this.f + Math.abs(this.kick) * 1.6 + this.fovAdd
    if (Math.abs(cam.fov - fov) > 1e-4) { cam.fov = fov; cam.updateProjectionMatrix() }
    cam.updateMatrixWorld()
  }
}
