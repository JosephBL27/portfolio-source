// The frequency landscape (unit 15M): a polar waterfall lying on the floor around the deck. Angle = frequency (bass behind the deck, highs toward the viewer, mirrored),
// distance from the deck = time (the newest slice nearest, older ones travel outward and sink), height = loudness. Drawn as glowing contour lines over a faint fill, additive,
// in the song's palette; a ring runs across it on every kick. 96 x 28 bytes of history, one small texture upload at about 28 Hz; the mesh is one 33 x 193 grid.
import * as THREE from 'three'
import { SPEC_N, type Music } from './bus'

const COLS = 96, ROWS = 28, NR = 28, NA = 192

const VERT = /* glsl */ `
uniform sampler2D uHist; uniform float uR0, uR1, uAmp, uK; varying vec2 vUv; varying float vH; varying float vD; varying float vTh;
void main() {
  vUv = uv; float th = (uv.x - 0.5) * 6.2831853, v = uv.y, rad = mix(uR0, uR1, v);
  float h = texture2D(uHist, vec2(uv.x, v * 0.97 + 0.015)).r;
  float fall = (1.0 - 0.5 * smoothstep(0.0, 1.0, v)) * smoothstep(0.0, 0.07, v);
  vH = h * fall; vD = v; vTh = th;
  vec3 p = vec3(sin(th) * rad, h * fall * uAmp * uK + 0.012, -cos(th) * rad);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}`
const FRAG = /* glsl */ `
precision highp float; uniform vec3 uA, uB; uniform float uK, uPres, uCrisp, uRing, uRingA, uBass; varying vec2 vUv; varying float vH; varying float vD; varying float vTh;
void main() {
  float cu = vUv.x * ${(COLS / 2).toFixed(1)}, cv = vUv.y * ${(ROWS / 2).toFixed(1)};
  float du = abs(fract(cu) - 0.5), dv = abs(fract(cv) - 0.5), fu = fwidth(cu), fv = fwidth(cv);
  float w = mix(0.2, 0.05, uCrisp);
  float dlu = 0.5 - du, dlv = 0.5 - dv;                                          // distance to the nearest line: 0 on it
  float lu = 1.0 - smoothstep(w * 0.5 - fu, w * 0.5 + fu * 1.5, dlu);
  float lv = 1.0 - smoothstep(w * 0.5 - fv, w * 0.5 + fv * 1.5, dlv);
  float lines = max(lu * 0.55, lv) * (0.22 + 1.5 * vH);
  float fill = vH * 0.3;
  float edge = smoothstep(0.0, 0.1, vD) * (1.0 - smoothstep(0.68, 1.0, vD));
  float rw = exp(-pow((vD - uRing) / 0.08, 2.0)) * uRingA;
  vec3 c = mix(uA, uB, clamp(vH * 1.8, 0.0, 1.0)) * 0.95;
  float front = smoothstep(1.7, 3.0, abs(vTh));                                   // the near side (toward the viewer) steps back so it never crowds the tray
  float a = (lines + fill + rw * 0.55) * edge * uK * (0.7 + 0.5 * uBass) * (1.0 - 0.72 * front);
  gl_FragColor = vec4(c + vec3(0.5) * rw * edge, a * uPres);
}`

export interface Landscape { mesh: THREE.Mesh; update(M: Music, dt: number, t: number): void; dispose(): void }
export function createLandscape(o: { r0: number; r1: number; pres: { value: number } }): Landscape {
  const data = new Uint8Array(COLS * ROWS)
  const hist = new THREE.DataTexture(data, COLS, ROWS, THREE.RedFormat, THREE.UnsignedByteType)
  hist.magFilter = THREE.LinearFilter; hist.minFilter = THREE.LinearFilter; hist.wrapS = THREE.RepeatWrapping; hist.wrapT = THREE.ClampToEdgeWrapping; hist.needsUpdate = true
  const g = new THREE.BufferGeometry(), pos = new Float32Array((NA + 1) * (NR + 1) * 3), uv = new Float32Array((NA + 1) * (NR + 1) * 2), idx: number[] = []
  for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) { const k = j * (NA + 1) + i; uv[k * 2] = i / NA; uv[k * 2 + 1] = j / NR }
  for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d) }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx)
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), o.r1 + 2)
  const U = {
    uHist: { value: hist }, uR0: { value: o.r0 }, uR1: { value: o.r1 }, uAmp: { value: 0.7 }, uK: { value: 0 }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() },
    uPres: o.pres, uCrisp: { value: 0.5 }, uRing: { value: 2 }, uRingA: { value: 0 }, uBass: { value: 0 },
  }
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.visible = false; mesh.name = 'landscape'; mesh.userData.noReflect = true
  let acc = 0, ringT = 9, seenB = 0
  const row = new Uint8Array(COLS)
  return {
    mesh,
    update(M, dt) {
      const show = M.k > 0.004
      mesh.visible = show
      if (!show) { if (data.some(v => v)) { data.fill(0); hist.needsUpdate = true } return }
      U.uK.value = M.k; U.uA.value.copy(M.pal[0]); U.uB.value.copy(M.pal[2]); U.uCrisp.value = M.mood.crisp; U.uAmp.value = 0.62 * M.mood.land; U.uBass.value = M.bass
      if (M.beats !== seenB) { seenB = M.beats; ringT = 0 }
      ringT += dt; U.uRing.value = Math.min(1.2, ringT * 0.9); U.uRingA.value = Math.max(0, 1 - ringT / 1.1)
      acc += dt
      if (acc >= 1 / 28) {
        acc = 0
        for (let c = 0; c < COLS; c++) {
          const d = Math.abs((c + 0.5) / COLS - 0.5) * 2 * (SPEC_N - 1), i0 = Math.floor(d), i1 = Math.min(SPEC_N - 1, i0 + 1), f = d - i0
          const v = M.spec[i0] * (1 - f) + M.spec[i1] * f
          row[c] = Math.min(255, Math.round(v * 255))
        }
        data.copyWithin(COLS, 0, COLS * (ROWS - 1)); data.set(row, 0); hist.needsUpdate = true
      }
    },
    dispose() { g.dispose(); mat.dispose(); hist.dispose() },
  }
}
