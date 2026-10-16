// The show on the deck (unit 15M), built into the turntable stage (cabinet/records.ts):
//   * a SPECTRUM CROWN: 96 thin blades standing on the platter's rim, one per frequency band, mirrored about the back of the deck (bass at the back, highs toward the viewer),
//     each with a falling peak cap, coloured from the song's palette, taller on the hit
//   * EMBERS thrown off the crown on a kick (a few on a snare): ballistic points computed in the vertex shader from their birth time
//   * the VINYL's surface uniforms: a kaleidoscope of the sleeve folded into mirror segments (visible on the grooves' highlight and faintly everywhere), a ring that
//     runs out from the label on every kick, a rim that glows with the level
// Nothing is created until the first song; idle it costs nothing (invisible, no uniform writes beyond uK = 0).
import * as THREE from 'three'
import { MUSIC, pump, newHits } from './bus'

const N = 96, NE = 180, R_RING = 1.74, MAXH = 1.25, TAU = Math.PI * 2

const BAR_V = /* glsl */ `
attribute float aH; attribute float aPk; uniform float uK, uMaxH, uCap, uPetal; varying float vY; varying float vH; varying vec2 vLocal;
void main() {
  vec3 p = position; float h = max(aH, 0.004) * uMaxH * uK;
  float widen = 1.0 + uPetal * 1.6 * (1.0 - position.y);                       // petals: wider at the foot
  if (uCap > 0.5) { p.y = aPk * uMaxH * uK + position.y * 0.035 + 0.02; p.x *= 1.25; vY = 1.5; }
  else { p.y = position.y * h; p.x *= widen; vY = position.y; }
  vH = aH; vLocal = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
}`
const BAR_F = /* glsl */ `
precision highp float; uniform vec3 uA, uB; uniform float uK, uCap; varying float vY; varying float vH; varying vec2 vLocal;
void main() {
  if (uCap > 0.5) { gl_FragColor = vec4(mix(uB, vec3(1.0), 0.45) * 1.1, 0.8 * uK); return; }
  vec3 c = mix(uA, uB, smoothstep(0.0, 1.0, vY)) * (0.5 + 0.8 * vH);
  c += vec3(1.0) * smoothstep(0.88, 1.0, vY) * 0.25;                                   // a hot tip
  float a = (0.15 + 0.38 * vH) * (1.0 - 0.6 * vY) * uK;
  gl_FragColor = vec4(c, a);
}`
const EMB_V = /* glsl */ `
attribute vec4 aSeed; attribute float aBorn; uniform float uT, uPx, uK; uniform vec3 uA, uB; varying vec3 vC; varying float vA;
void main() {
  float age = uT - aBorn, life = 1.1 + aSeed.w * 1.4;
  if (aBorn < 0.0 || age < 0.0 || age > life) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; vC = vec3(0.0); return; }
  float ang = aSeed.x * 6.2831853, sp = 0.5 + aSeed.y * 1.5;
  vec3 o = vec3(cos(ang) * ${R_RING.toFixed(2)}, 0.58, sin(ang) * ${R_RING.toFixed(2)});
  vec3 v = vec3(cos(ang) * 0.35 * sp - sin(ang) * 0.25, 1.1 + 1.5 * sp * aSeed.z, sin(ang) * 0.35 * sp + cos(ang) * 0.25);
  vec3 p = o + v * age + vec3(0.0, -0.55 * age * age, 0.0);
  p.x += sin(age * 4.0 + aSeed.z * 20.0) * 0.06 * age;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  float f = age / life; vA = (1.0 - f) * smoothstep(0.0, 0.06, age) * uK;
  gl_PointSize = clamp(uPx * (0.16 + 0.12 * aSeed.y) * (1.0 - 0.5 * f) * 90.0 / max(1.0, -mv.z), 1.0, 22.0);
  vC = mix(uA, uB, aSeed.z) * 1.7 + vec3(0.6) * (1.0 - f) * (1.0 - f);
}`
const EMB_F = /* glsl */ `precision highp float; varying vec3 vC; varying float vA; void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0); gl_FragColor = vec4(vC, a * vA); }`

export interface DeckViz {
  /** merge into the vinyl ShaderMaterial's uniforms (by reference) */
  vinylU: Record<string, THREE.IUniform>
  setArt(tex: THREE.Texture | null): void
  update(t: number, dt: number, spin: number): void
  dispose(): void
}
export function createDeckViz(o: { root: THREE.Group; cx: number; cz: number; y: number; reduced(): boolean; phone: boolean }): DeckViz {
  const { root } = o
  const group = new THREE.Group(); group.name = 'deckviz'; group.position.set(o.cx, o.y, o.cz); group.visible = false; group.renderOrder = 6; root.add(group)
  const shared = { uK: { value: 0 }, uMaxH: { value: MAXH }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uPetal: { value: 0.3 } }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(0.05, 1, 0.05), pv = new THREE.Vector3()
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0)
  const aH = new THREE.InstancedBufferAttribute(new Float32Array(N), 1), aPk = new THREE.InstancedBufferAttribute(new Float32Array(N), 1)
  aH.setUsage(THREE.DynamicDrawUsage); aPk.setUsage(THREE.DynamicDrawUsage)
  const mk = (cap: number) => {
    const g = geo.clone(); g.setAttribute('aH', aH); g.setAttribute('aPk', aPk)
    const mat = new THREE.ShaderMaterial({ vertexShader: BAR_V, fragmentShader: BAR_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, uniforms: { ...shared, uCap: { value: cap } } })
    const im = new THREE.InstancedMesh(g, mat, N); im.frustumCulled = false; im.renderOrder = 6; im.userData.noReflect = true
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU; q.setFromAxisAngle(UP, -a + Math.PI / 2); pv.set(Math.cos(a) * R_RING, 0.0, Math.sin(a) * R_RING); m4.compose(pv, q, sc); im.setMatrixAt(i, m4)
    }
    im.instanceMatrix.needsUpdate = true; return im
  }
  const bars = mk(0), caps = mk(1)
  // the bin of each blade: bass at the back of the deck (-z in stage space: angle 3pi/2 here), mirrored, so the loud low end stands tallest behind the platter
  const bin = new Int16Array(N)
  for (let i = 0; i < N; i++) { const a = (i / N) * TAU; let d = (((a - 1.5 * Math.PI) % TAU) + TAU) % TAU; if (d > Math.PI) d = TAU - d; bin[i] = Math.min(47, Math.floor((d / Math.PI) * 47.99)) }
  // a soft light ring on the rim
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
  const ring = new THREE.Mesh(new THREE.RingGeometry(R_RING - 0.07, R_RING + 0.07, 128), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; ring.renderOrder = 5
  // embers
  const eg = new THREE.BufferGeometry(), eSeed = new Float32Array(NE * 4), eBorn = new Float32Array(NE).fill(-1)
  for (let i = 0; i < NE; i++) for (let c = 0; c < 4; c++) eSeed[i * 4 + c] = Math.random()
  eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NE * 3), 3)); eg.setAttribute('aSeed', new THREE.BufferAttribute(eSeed, 4)); eg.setAttribute('aBorn', new THREE.BufferAttribute(eBorn, 1))
  eg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.5, 0), 6)
  const eu = { uT: { value: 0 }, uPx: { value: 1 }, uK: shared.uK, uA: shared.uA, uB: shared.uB }
  const emb = new THREE.Points(eg, new THREE.ShaderMaterial({ vertexShader: EMB_V, fragmentShader: EMB_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: eu }))
  emb.frustumCulled = false; emb.renderOrder = 7; emb.userData.noReflect = true
  group.add(bars, caps, ring, emb)

  // vinyl uniforms (read by the vinyl fragment shader in cabinet/records.ts)
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true
  const vinylU: Record<string, THREE.IUniform> = {
    uArt: { value: blank }, uKal: { value: 6 }, uKaleid: { value: 0 }, uRot: { value: 0 }, uRingR: { value: 9 }, uRingA: { value: 0 }, uLvl: { value: 0 }, uBass: { value: 0 },
    uPA: { value: new THREE.Color() }, uPB: { value: new THREE.Color() },
  }
  let art: THREE.Texture | null = null, emberAt = 0, ringT = 9, spawnI = 0
  const seen = { b: 0, s: 0 }, hot = new THREE.Color()
  return {
    vinylU,
    setArt(tex) { art = tex; vinylU.uArt.value = tex ?? blank },
    update(t, dt, spin) {
      const M = pump(), rm = o.reduced()
      const show = M.k > 0.004
      group.visible = show && !rm
      vinylU.uKaleid.value = show ? M.k * (art ? 1 : 0.5) * (rm ? 0.6 : 1) : 0
      if (!show) { vinylU.uRingA.value = 0; vinylU.uLvl.value = 0; return }
      const mood = M.mood, hit = newHits(seen)
      shared.uK.value = M.k; shared.uA.value.copy(M.pal[0]).multiplyScalar(1.1); shared.uB.value.copy(M.pal[2]).lerp(hot.setRGB(1, 1, 1), 0.15); shared.uPetal.value = mood.petal
      vinylU.uPA.value.copy(M.pal[0]); vinylU.uPB.value.copy(M.pal[2]); vinylU.uKal.value = mood.kal
      vinylU.uRot.value = spin; vinylU.uLvl.value = M.level * M.k; vinylU.uBass.value = M.bass * M.k
      ringT += dt
      if (hit.beat) { ringT = 0; if (!rm && t - emberAt > 0.05) { emberAt = t; spawn(t, Math.round(14 * mood.ember * (0.6 + M.beat)), true) } }
      if (hit.snare && mood.ember > 0.5 && !rm) spawn(t, Math.round(4 * mood.ember), false)
      vinylU.uRingR.value = 0.5 + ringT * 2.3; vinylU.uRingA.value = Math.max(0, 1 - ringT / 0.55) * M.k
      eu.uT.value = t; eu.uPx.value = Math.min(2, devicePixelRatio || 1)
      if (group.visible) {
        const h = aH.array as Float32Array, pk = aPk.array as Float32Array
        for (let i = 0; i < N; i++) {
          const b = bin[i], v = (M.spec[b] * 0.6 + M.spec[Math.max(0, b - 1)] * 0.2 + M.spec[Math.min(47, b + 1)] * 0.2)
          const hv = Math.min(1, Math.pow(v, 0.95) * (b < 8 ? 1 + 0.35 * M.beat : 1) * 1.1)
          h[i] = hv; pk[i] = Math.max(hv, M.hold[b])
        }
        aH.needsUpdate = true; aPk.needsUpdate = true
        ringMat.color.copy(M.pal[2]); ringMat.opacity = M.k * (0.12 + 0.35 * M.bass + 0.25 * M.beat)
      }
    },
    dispose() { geo.dispose(); bars.geometry.dispose(); caps.geometry.dispose(); (bars.material as THREE.Material).dispose(); (caps.material as THREE.Material).dispose(); ring.geometry.dispose(); ringMat.dispose(); eg.dispose(); (emb.material as THREE.Material).dispose(); blank.dispose(); group.removeFromParent() },
  }
  function spawn(t: number, n: number, kick: boolean) {
    const sd = eg.getAttribute('aSeed') as THREE.BufferAttribute, bn = eg.getAttribute('aBorn') as THREE.BufferAttribute
    for (let k = 0; k < n; k++) {
      const i = (spawnI++) % NE
      // embers rise from the back of the crown (where the bass blades stand tall), a few anywhere
      const base = kick ? 0.75 + (Math.random() - 0.5) * 0.5 : Math.random()
      sd.setXYZW(i, base, Math.random(), Math.random(), Math.random()); bn.setX(i, t)
    }
    sd.needsUpdate = true; bn.needsUpdate = true
  }
}
