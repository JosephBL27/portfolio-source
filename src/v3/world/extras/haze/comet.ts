// Travel moment 3: an occasional comet. A bright nucleus on the far shell and two tails (a thin blue ion tail and a broader warm dust tail that
// curves and widens), drifting slowly for ~11 s. Only launched during a flight leg, never twice within a minute. Rides with the camera.
import * as THREE from 'three'
import { rng } from '../lib/flags'

export function createComet(phone: boolean) {
  const ION = phone ? 40 : 70, DUST = phone ? 70 : 140, N = 1 + ION + DUST, r = rng(0xc0e7 ^ (Date.now() & 0xffff))
  const pos = new Float32Array(N * 3), size = new Float32Array(N), col = new Float32Array(N * 4), jit = new Float32Array(N * 2)
  for (let i = 0; i < N * 2; i++) jit[i] = r() * 2 - 1
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 4))
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { uDpr: { value: Math.min(2, devicePixelRatio || 1) } },
    vertexShader: 'attribute float aSize; attribute vec4 aCol; uniform float uDpr; varying vec4 vC; void main(){ vC = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uDpr; }',
    fragmentShader: 'varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 1.7) * vC.a; gl_FragColor = vec4(vC.rgb * a, 1.0); }' })
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -3; pts.visible = false
  const grp = new THREE.Group(); grp.add(pts); grp.userData.noReflect = true
  const S = { on: false, age: 0, dur: 11, az: 0, el: 0, daz: 0, del: 0 }
  let cool = 25 + r() * 25
  const R = 92, put = (i: number, az: number, el: number, off: number, up: number) => {
    const c = Math.cos(el + up)
    pos[i * 3] = Math.sin(az + off) * c * R; pos[i * 3 + 1] = Math.sin(el + up) * R; pos[i * 3 + 2] = Math.cos(az + off) * c * R
  }
  const launch = () => { S.on = true; S.age = 0; S.az = r() * 6.28; S.el = 0.12 + r() * 0.35; const a = r() * 6.28; S.daz = Math.cos(a) * 0.035; S.del = Math.sin(a) * 0.012 - 0.004; pts.visible = true }
  return {
    group: grp,
    update(dt: number, legOk: boolean, rm: boolean) {
      if (rm) { pts.visible = false; S.on = false; return }
      cool -= dt
      if (!S.on && legOk && cool <= 0) { launch(); cool = 60 + r() * 50 }
      if (!S.on) return
      S.age += dt; const u = S.age / S.dur
      if (u >= 1) { S.on = false; pts.visible = false; return }
      const env = Math.sin(Math.PI * u), az = S.az + S.daz * S.age, el = S.el + S.del * S.age
      const tx = -Math.sign(S.daz || 1), ty = -Math.sign(S.del || 1) * 0.3   // the tail trails behind the motion
      put(0, az, el, 0, 0); size[0] = 22; col.set([0.9, 0.96, 1, 1.5 * env], 0)
      for (let k = 0; k < ION; k++) {
        const i = 1 + k, f = (k + 1) / ION, L = f * 0.2
        put(i, az, el, tx * L + jit[i * 2] * 0.0016 * f, ty * L * 0.2 + jit[i * 2 + 1] * 0.0016 * f)
        size[i] = 5 * (1 - f * 0.7) + 1.2; col.set([0.55, 0.78, 1, 0.8 * (1 - f) * (1 - f) * env], i * 4)
      }
      for (let k = 0; k < DUST; k++) {
        const i = 1 + ION + k, f = (k + 1) / DUST, L = f * 0.14, curve = f * f * 0.04, sp = 0.004 * f
        put(i, az, el, tx * L + jit[i * 2] * sp, ty * L * 0.2 + curve + jit[i * 2 + 1] * sp)
        size[i] = 9 + 16 * f; col.set([1, 0.78, 0.5, 0.17 * (1 - f) * env], i * 4)
      }
      g.attributes.position.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.aCol.needsUpdate = true
    },
    dispose() { g.dispose(); m.dispose(); grp.removeFromParent() },
  }
}
