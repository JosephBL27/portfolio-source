// Travel moment 2: nebula clouds you fly through. Soft billboards (three offset layers per cluster, so they slide against each other: parallax) in the
// gaps between areas, tinted by the neighbouring areas' accents. Each fades out as the camera reaches it (no pop, no wash) and with distance.
import * as THREE from 'three'
import { AREAS, RING } from '../../layout'
import { rng, sstep } from '../lib/flags'
import { NOISE } from './noise'

export function createClouds(phone: boolean) {
  const r = rng(0x6e6b), group = new THREE.Group(), geo = new THREE.PlaneGeometry(1, 1), items: { mesh: THREE.Mesh; m: THREE.ShaderMaterial; base: number; roll: number }[] = []
  group.userData.noReflect = true
  const clusters = phone ? 3 : AREAS.length
  for (let c = 0; c < clusters; c++) {
    const a = AREAS[c], b = AREAS[(c + 1) % AREAS.length], ang = ((a.angle + 30) * Math.PI) / 180
    const col1 = new THREE.Color(a.accent), col2 = new THREE.Color(b.accent)
    const rad = RING * (1.1 + 0.25 * r()), cy = (a.height + b.height) / 2 + 1 + r() * 5
    for (let l = 0; l < 3; l++) {
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
        uniforms: { uT: { value: 0 }, uA: { value: 0 }, uC1: { value: col1.clone().multiplyScalar(0.8) }, uC2: { value: col2.clone().multiplyScalar(0.8) }, uSeed: { value: c * 5.1 + l * 2.3 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `${NOISE} uniform float uT, uA, uSeed; uniform vec3 uC1, uC2; varying vec2 vUv;
          void main(){
            vec2 p = (vUv - 0.5) * 2.6 + uSeed; vec2 w = vec2(uT * 0.02, -uT * 0.014);
            vec2 q = vec2(fbm3(p + w), fbm3(p + 4.1 - w)); float f = fbm3(p * 1.2 + 2.2 * q);
            float m = smoothstep(1.0, 0.1, length(vUv - 0.5) * 2.0);
            float d = smoothstep(0.34, 0.8, f) * m * m;
            vec3 c = mix(uC1, uC2, smoothstep(0.25, 0.8, q.x + 0.3 * (vUv.x - 0.5))) * d + vec3(1.0, 0.93, 0.86) * pow(d, 3.0) * 0.25;
            gl_FragColor = vec4(c * uA, 1.0); }` })
      const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.renderOrder = -2; mesh.visible = false
      const s = (phone ? 30 : 34) + r() * 22
      mesh.position.set(Math.sin(ang) * rad + (r() - 0.5) * 8, cy + (r() - 0.5) * 6, Math.cos(ang) * rad + (r() - 0.5) * 8); mesh.scale.set(s, s * 0.7, 1)
      group.add(mesh); items.push({ mesh, m, base: 0.07 + 0.05 * r(), roll: r() * 6.28 })   // v20: ~0.27x: clouds colour the flight, they no longer fog the black
    }
  }
  return {
    group,
    update(t: number, cam: THREE.Camera, vis: number) {
      for (const it of items) {
        const d = it.mesh.position.distanceTo(cam.position)
        // fade as the camera reaches the cloud's centre: never a wall of colour at the lens
        const a = it.base * vis * sstep(2, 11, d) * (1 - sstep(70, 110, d))
        it.mesh.visible = a > 0.004
        if (!it.mesh.visible) continue
        it.m.uniforms.uA.value = a; it.m.uniforms.uT.value = t
        it.mesh.quaternion.copy(cam.quaternion); it.mesh.rotateZ(it.roll)   // billboard, each layer with its own roll
      }
    },
    dispose() { geo.dispose(); for (const i of items) i.m.dispose(); group.removeFromParent() },
  }
}
