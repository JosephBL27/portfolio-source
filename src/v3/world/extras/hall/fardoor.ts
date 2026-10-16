// The far doors of the hall (w11): two oak leaves on iron straps in the end wall, centred at lx = 0 below the middle lancet. They stand CLOSED at the hall dwell with a
// thin cool light seam between them (night beyond), and swing OUTWARD (away from the nave) on the same closed-form hinge springs as the front doors while the exit piece
// (transitions/exit.ts, leg hall > hold) walks the camera through. Pure function of the exit leg's progress: scrolling back closes them.
import * as THREE from 'three'
import { springResp, sstep, type Shared } from '../transitions/common'
import { leafGeometry, seamMaterial } from './facade'
import { hallMaterial, type HallUniforms } from './material'
import { DOOR, L, lancetRise } from './shell'

const NIGHT_F = /* glsl */ `
precision highp float; uniform float uI; varying vec2 vUv;
void main() { vec2 d = (vUv - vec2(0.5, 0.35)) * vec2(1.5, 1.0); float g = 1.0 - smoothstep(0.0, 0.62, length(d)); float a = g * g * uI;
  gl_FragColor = vec4(vec3(0.09, 0.15, 0.34) * a, a); }`

export class FarDoors {
  readonly group = new THREE.Group()
  private leafL = new THREE.Group()
  private leafR = new THREE.Group()
  private seam: THREE.Mesh
  private night: THREE.Mesh
  constructor(sh: Shared, hu: HallUniforms) {
    const ty = DOOR.h - lancetRise(DOOR.hw) + 0.2           // leaves reach the tympanum
    const W = DOOR.hw - 0.012, H = ty - DOOR.base
    const geo = leafGeometry(W, H, -1)                       // straps face the nave (-z)
    const mat = hallMaterial(sh, hu, { tint: 0x8a6a48 })
    for (const [g, sgn] of [[this.leafL, -1], [this.leafR, 1]] as [THREE.Group, number][]) {
      const m = new THREE.Mesh(geo, mat); m.name = 'hall-far-leaf'; m.frustumCulled = false
      g.add(m); g.position.set(sgn * DOOR.hw, DOOR.base, L - 0.5); g.scale.x = -sgn
      this.group.add(g)
    }
    // the light seam between the leaves (cool, thin) and the night glow that shows through them once they part
    const sm = seamMaterial([0.55, 0.72, 1.0])
    this.seam = new THREE.Mesh(new THREE.PlaneGeometry(0.7, H), sm); this.seam.geometry.translate(0, H / 2, 0)
    this.seam.position.set(0, DOOR.base, L - 0.78); this.seam.renderOrder = 6; this.seam.frustumCulled = false
    const nm = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: NIGHT_F, uniforms: { uI: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    this.night = new THREE.Mesh(new THREE.PlaneGeometry(2 * DOOR.hw, DOOR.h), nm); this.night.position.set(0, DOOR.h / 2, L + 0.25); this.night.renderOrder = 5; this.night.frustumCulled = false
    this.group.add(this.seam, this.night)
    this.group.name = 'hall-far-doors'
  }
  /** `e` = progress of the exit leg (0..1), or null when the doors simply stand shut (the hall dwell and everything before it) */
  frame(e: number | null) {
    const A = 1.5
    let aL = 0, aR = 0
    if (e != null) {
      aL = Math.min(1.8, A * springResp(Math.max(0, e - 0.15), 13.5, 0.55))
      aR = Math.min(1.8, A * springResp(Math.max(0, e - 0.17), 15, 0.6))
    }
    // outward: toward +z (away from the nave), so the left leaf (hinge at -x, extending +x) turns by -angle
    this.leafL.rotation.y = -aL; this.leafR.rotation.y = aR
    const open = Math.min(1, 0.5 * (aL + aR) / A)
    const sm = this.seam.material as THREE.ShaderMaterial, nm = this.night.material as THREE.ShaderMaterial
    sm.uniforms.uI.value = 0.85 * (1 - sstep(0.0, 0.5, open))
    nm.uniforms.uI.value = 1.1 * sstep(0.1, 0.8, open) * (e == null ? 0 : 1 - sstep(0.62, 0.82, e))
  }
}
