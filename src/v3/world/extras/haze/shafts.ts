// Depth 1/2: volumetric light shafts as additive geometry (cheaper and steadier than a screen-space god-ray pass, and they cannot smear over the
// copy): a soft cone under the hub screen, and a slanted fan of dust-lit beams behind each of the hall's five windows. Edges soften with the view
// angle, grain drifts along the beam, everything is additive and depth-tested.
import * as THREE from 'three'
import { HALL, hallPt, hallStopX, HUB } from '../../layout'
import { NOISE } from './noise'
import { U as SIGU } from '../../signals'

const FLOOR_Y = -6.6
const SHAFT_FRAG = `${NOISE} uniform float uT, uA; uniform vec3 uC; varying vec2 vUv; varying vec3 vN, vV;
  void main(){
    float along = vUv.y;                                    // 0 at the source, 1 at the floor
    float g = vn(vec2(vUv.x * 26.0, along * 2.0 - uT * 0.06)) * 0.6 + vn(vec2(vUv.x * 61.0 + 3.0, along * 3.0 - uT * 0.1)) * 0.4;
    float soft = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
    float a = soft * (0.35 + 0.9 * g) * smoothstep(0.0, 0.12, along) * pow(1.0 - along, 1.15);
    gl_FragColor = vec4(uC * a * uA, 1.0); }`
const SHAFT_VERT = 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }'
const mat = (c: THREE.Color) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
  uniforms: { uT: { value: 0 }, uA: { value: 0 }, uC: { value: c } }, vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG })

export function createShafts(phone: boolean) {
  const group = new THREE.Group(), geos: THREE.BufferGeometry[] = [], mats: THREE.ShaderMaterial[] = []
  group.userData.noReflect = true
  // hub: an open cone from just under the screen to the floor
  const top = HUB[1] - 1.8, cg = new THREE.CylinderGeometry(1.4, 13, top - FLOOR_Y, phone ? 24 : 48, 1, true)
  cg.translate(0, -(top - FLOOR_Y) / 2 + top, 0); geos.push(cg)
  // CylinderGeometry uv.y runs 1 at the top to 0 at the bottom: flip it so 0 = source
  const uv = cg.getAttribute('uv') as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
  const hubM = mat(new THREE.Color(1.0, 0.62, 0.36)); mats.push(hubM)
  const hub = new THREE.Mesh(cg, hubM); hub.position.set(HUB[0], 0, HUB[2]); hub.frustumCulled = false; hub.renderOrder = -1; group.add(hub)
  // hall: five beams, a window at the end wall to a patch of floor in front of it, slanted toward the entrance
  const hallM: THREE.ShaderMaterial[] = [], cols = ['#ffd58a', '#ff8fa6', '#9fc4ff', '#8fe6b8', '#c4a3ff']
  const hallGrp = new THREE.Group(); hallGrp.visible = false; group.add(hallGrp)
  for (let i = 0; i < 5; i++) {
    const lx = hallStopX(i), d0 = HALL.len - 0.4, d1 = HALL.len - 14
    const A = hallPt(lx, 11.5, d0), B = hallPt(lx + 0.9, 0.2, d1)
    const half = 1.1, wx = Math.cos(HALL.yaw) * half, wz = -Math.sin(HALL.yaw) * half   // across-nave direction
    const p = new Float32Array([A[0] - wx, A[1], A[2] - wz, A[0] + wx, A[1], A[2] + wz, B[0] - wx * 2.6, B[1], B[2] - wz * 2.6, B[0] + wx * 2.6, B[1], B[2] + wz * 2.6])
    const g = new THREE.BufferGeometry(); geos.push(g)
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2))
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(12).map((_, k) => (k % 3 === 1 ? 0 : k % 3 === 0 ? Math.sin(HALL.yaw) : Math.cos(HALL.yaw))), 3)); g.setIndex([0, 2, 1, 1, 2, 3])
    const m = mat(new THREE.Color(cols[i]).multiplyScalar(0.9)); mats.push(m); hallM.push(m)
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = -1; hallGrp.add(mesh)
  }
  const hc = new THREE.Vector3(...hallPt(0, 5, 18))
  return {
    group,
    update(t: number, cam: THREE.Camera, hubK: number, hallK: number) {
      const d = cam.position.distanceTo(hc), near = 1 - Math.min(1, Math.max(0, (d - 18) / 22))
      hubM.uniforms.uA.value = hubK * 0.22 * (1 + 0.35 * SIGU.uSgMus.value.x); hubM.uniforms.uT.value = t; hub.visible = hubK > 0.01
      // v19: the cone takes the hub TV's channel colour (warm white when the glass is off or grey)
      const tv = SIGU.uSgTv.value, k = Math.min(1, tv.w * 0.85); hubM.uniforms.uC.value.setRGB(1.0 + (0.25 + 0.75 * tv.x - 1.0) * k, 0.62 + (0.25 + 0.75 * tv.y - 0.62) * k, 0.36 + (0.25 + 0.75 * tv.z - 0.36) * k)
      hallGrp.visible = hallK * near > 0.01
      for (const m of hallM) { m.uniforms.uA.value = hallK * near * 0.2; m.uniforms.uT.value = t }
    },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); group.removeFromParent() },
  }
}
