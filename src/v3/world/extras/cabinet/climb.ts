// STAGE "hold": an overhanging bouldering wall (v13 rebuild). A natural birch plywood panel leans out 30 degrees over a crash pad; it carries a T-nut grid, sheet
// seams with screw heads, chalk smudges that follow the holds, two bolt-on volumes, and 20 sculpted resin holds (jugs with a scooped cup, crimps with a lip,
// round slopers, waisted pinches, a pocket with a finger hole, side-pulls). Every hold is its own analytic height field (not a blob): a rounded footprint,
// a steep resin sidewall and a type-specific top, shaded with a grit bump, speckled vertex colour, clearcoat and a bolt in a countersink, standing on the
// T-nut it is bolted to. One orange route is taped: yellow tape under each hold, START and TOP tags, and a V8 grade tag at the foot (V8 is the grade in the data).
// A soft key light falls from the upper left (baked into the panel and the hold shadows); a floor shadow darkens the pad under the overhang.
//   auto     a light climbs the route hold by hold, flashing each hold and puffing chalk, then rests and starts again
//   hover    a route hold lifts in brightness and the NEXT move is shown: that hold pulses and a thread of light runs to it
//   press    the climbing light jumps to the pressed hold (chalk puff, sound) and waits there a few seconds before the climb carries on from it
// Reduced motion: the route lit softly, no light moving; hover still shows the next move (a static thread). Cursor, hit testing and presence come from cabinet.ts.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { FlightState } from '../../flight'
import { sharedEnv } from '../env'
import { bake, blobTexture, canvasTex, D, disposeTree, enter, glowTexture, lerp, sstep, precompile, type Kit } from './kit'
import { fbm3d } from './props'
import type { Stage } from './stage'

// ---- the wall, in metres-ish scene units. The panel pivots about its foot; local +z is the face normal, +y runs up the wall, tilted out toward the viewer.
const PW = 4.6, PH = 5.8, PT = 0.28, TILT = 0.52, FOOT: [number, number, number] = [0, 0.62, -1.15], NUT = 0.3
type HoldType = 'jug' | 'crimp' | 'sloper' | 'pinch' | 'pocket' | 'side'
interface HoldSpec { t: HoldType; x: number; y: number; rot: number; s: number; col: [number, number, number]; route: number }
const snap = (v: number) => (Math.round(v / NUT - 0.5) + 0.5) * NUT
const ORANGE: [number, number, number] = [1.0, 0.4, 0.12]
const C = { teal: [0.1, 0.6, 0.62], violet: [0.52, 0.28, 0.8], lime: [0.68, 0.88, 0.22], yellow: [0.98, 0.8, 0.18], pink: [0.95, 0.38, 0.6], bone: [0.88, 0.86, 0.8], blue: [0.18, 0.42, 0.86] } as Record<string, [number, number, number]>
const H = (t: HoldType, x: number, y: number, rot: number, s: number, col: [number, number, number], route = -1): HoldSpec => ({ t, x: snap(x), y: snap(y), rot, s, col, route })
const HOLDS: HoldSpec[] = [
  H('jug', -1.35, 0.9, 0.25, 1.0, ORANGE, 0), H('crimp', -0.75, 1.65, -0.2, 1.0, ORANGE, 1), H('sloper', 0.15, 2.25, 0.3, 1.05, ORANGE, 2), H('pinch', 1.05, 2.85, 0.08, 1.0, ORANGE, 3),
  H('side', 0.45, 3.6, 1.45, 1.0, ORANGE, 4), H('crimp', -0.45, 4.2, 0.35, 0.95, ORANGE, 5), H('jug', 0.45, 4.8, -0.2, 1.0, ORANGE, 6), H('jug', 1.05, 5.4, 0.15, 0.92, ORANGE, 7),
  H('sloper', 1.65, 3.75, -0.4, 0.9, C.teal), H('crimp', -1.95, 2.55, 0.2, 0.9, C.teal), H('pocket', 1.95, 2.55, 0, 0.85, C.violet), H('jug', -1.95, 4.95, 0.6, 0.85, C.violet),
  H('pinch', 1.95, 4.65, -0.2, 0.85, C.lime), H('side', -0.75, 3.0, 0.9, 0.85, C.lime), H('sloper', 1.65, 5.25, 0.3, 0.8, C.yellow), H('crimp', -1.85, 5.25, -0.3, 0.8, C.yellow),
  H('jug', 0.0, 0.6, 0.1, 0.8, C.pink), H('pinch', 1.95, 3.15, 0.1, 0.78, C.pink), H('sloper', -0.75, 5.55, -0.2, 0.8, C.bone), H('crimp', -0.15, 3.15, 0.12, 0.85, C.blue),
  H('crimp', 0.75, 1.35, 0.1, 0.8, C.teal), H('pinch', -1.35, 2.1, 0.0, 0.8, C.violet), H('sloper', 1.35, 4.05, 0.2, 0.9, C.pink), H('crimp', -1.95, 1.35, -0.1, 0.8, C.yellow), H('pinch', -0.15, 5.25, 0.15, 0.8, C.lime), H('sloper', 1.95, 5.55, 0.3, 0.75, C.blue),
]
const N_ROUTE = 8
const HS = 0.56                                   // hold scale: a hold is a hand wide, a couple of T-nuts across, not a boulder

// ---- the sculpted holds: z(x, y) over a footprint, polar-gridded, normals from finite differences of the height field (no seams, no blobs)
interface Shape { a: number; b: number; n: number; Hh: number; shear: number; z(x: number, y: number): number }
const SN = (x: number, y: number, a: number, b: number, n: number) => Math.pow(Math.pow(Math.abs(x / a), n) + Math.pow(Math.abs(y / b), n), 1 / n)
const side = (r: number, p: number, q: number) => (r >= 1 ? 0 : Math.pow(1 - Math.pow(r, p), q))        // rounded shoulder, steep resin sidewall at the foot
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
function shapeOf(t: HoldType): Shape {
  switch (t) {
    case 'jug': { const a = 0.62, b = 0.46, Hh = 0.42; return { a, b, n: 2.6, Hh, shear: 0, z: (x, y) => {
      const r = SN(x, y, a, b, 2.6), dome = Hh * side(r, 3, 0.42) * (0.9 + 0.2 * (y / b))
      const d = Math.hypot(x / 0.4, (y - 0.08) / 0.3), cup = 1 - sm(0.45, 1.1, d)        // the scoop for the fingers, open to the top of the wall
      return Math.max(0, dome - cup * Hh * 0.66) + 0.012 * side(r, 3, 0.42) } } }
    case 'crimp': { const a = 0.7, b = 0.17, Hh = 0.21; return { a, b, n: 4.6, Hh, shear: 0, z: (x, y) => {
      const r = SN(x, y, a, b, 4.6), tt = (y / b + 1) / 2
      return Hh * side(r, 4, 0.36) * (0.42 + 0.58 * sm(0, 1, tt)) * (1 + 0.16 * sm(0.78, 1, tt)) } } }       // thick at the edge you hang from, tapering down
    case 'sloper': { const a = 0.78, b = 0.6, Hh = 0.34; return { a, b, n: 2.2, Hh, shear: 0.1, z: (x, y) => {
      const r = SN(x, y, a, b, 2.2); return Hh * side(r, 2.4, 0.66) * (1 + 0.1 * (y / b)) } } }
    case 'pinch': { const a = 0.27, b = 0.62, Hh = 0.52; const aw = (y: number) => a * (1 - 0.3 * Math.exp(-3 * (y / b) * (y / b))); return { a, b, n: 2.8, Hh, shear: 0, z: (x, y) => {
      const r = SN(x, y, aw(y), b, 2.6); return Hh * side(r, 2.7, 0.5) * (0.86 + 0.14 * (1 - (y / b) * (y / b))) } } }      // a waisted blade: the thumb goes round the front
    case 'pocket': { const a = 0.5, b = 0.46, Hh = 0.24; return { a, b, n: 2.4, Hh, shear: 0, z: (x, y) => {
      const r = SN(x, y, a, b, 2.4), base = Hh * side(r, 3, 0.4), d = Math.hypot(x / 0.17, (y - 0.01) / 0.22)
      const rim = 1 + 0.12 * Math.exp(-Math.pow((d - 1.3) / 0.3, 2)); return 0.012 + (base * rim - 0.012) * sm(0.82, 1.12, d) } } }       // a finger hole through the middle
    default: { const a = 0.28, b = 0.6, Hh = 0.5, sh = 0.2; return { a, b, n: 3, Hh, shear: sh, z: (x, y) => {
      const xs = x - sh * y, r = SN(xs, y, a, b, 2.8); return Hh * side(r, 2.7, 0.5) * (0.5 + 0.5 * sm(-1, 1, xs / a)) } } }                 // a wedge: tall on one side, for side-pulls
  }
}
const NR = 14, NT = 72
function holdGeo(t: HoldType, seed: number): { geo: THREE.BufferGeometry; sh: Shape } {
  const sh = shapeOf(t), nz = (x: number, y: number) => fbm3d(x * 5 + seed, y * 5 + seed * 0.7, seed, 2) - 0.5
  const zf = (X: number, Y: number) => { const x = X - sh.shear * Y; return sh.z(x, Y) * (1 + 0.05 * nz(X, Y)) }
  const nv = 1 + NR * NT, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3)
  let k = 0
  const put = (X: number, Y: number) => {
    const z = zf(X, Y), e = 0.012
    const dzx = (zf(X + e, Y) - zf(X - e, Y)) / (2 * e), dzy = (zf(X, Y + e) - zf(X, Y - e)) / (2 * e), il = 1 / Math.hypot(dzx, dzy, 1)
    pos.set([X, Y, z], k * 3); nor.set([-dzx * il, -dzy * il, il], k * 3); uv.set([X / sh.a * 0.5 + 0.5, Y / sh.b * 0.5 + 0.5], k * 2)
    const v = 0.93 + 0.14 * (fbm3d(X * 9 + seed, Y * 9, seed * 0.3, 2)) + 0.05 * (z / sh.Hh)      // mottled resin, lighter on the crown
    col.set([v, v, v], k * 3); k++
  }
  put(0, 0)
  for (let i = 1; i <= NR; i++) {
    const r = Math.pow(i / NR, 0.82)
    for (let j = 0; j < NT; j++) {
      const th = (j / NT) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), wob = 1 + 0.035 * Math.sin(th * 3 + seed) + 0.02 * Math.sin(th * 5 + seed * 2)
      const ox = sh.a * Math.sign(c) * Math.pow(Math.abs(c), 2 / sh.n) * wob, oy = sh.b * Math.sign(s) * Math.pow(Math.abs(s), 2 / sh.n) * wob
      put(r * ox + sh.shear * r * oy, r * oy)
    }
  }
  const idx: number[] = []
  for (let j = 0; j < NT; j++) idx.push(0, 1 + j, 1 + ((j + 1) % NT))
  for (let i = 1; i < NR; i++) for (let j = 0; j < NT; j++) {
    const a = 1 + (i - 1) * NT + j, b = 1 + (i - 1) * NT + ((j + 1) % NT), c2 = 1 + i * NT + j, d = 1 + i * NT + ((j + 1) % NT)
    idx.push(a, c2, b, b, c2, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  return { geo: g, sh }
}

interface HoldObj { mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial; spec: HoldSpec; base: THREE.Color; top: number; sh: Shape }

export function createClimb(): Stage {
  const root = new THREE.Group(); root.name = 'cab-hold'
  root.userData.contactShadow = { size: 6, opacity: 0.5 }       // the render package draws a soft contact shadow under the wall and its pad (shared contract)
  let kit: Kit, built = false
  const wall = new THREE.Group()
  const holds: HoldObj[] = []
  const route: number[] = []                       // hold index of route step i
  const pick: THREE.Object3D[] = []
  const puffs: { s: THREE.Sprite; t: number }[] = []
  const dots: THREE.Sprite[] = []
  let orb: THREE.Sprite, orbHalo: THREE.Sprite, next: THREE.Sprite
  const SEG = 0.7, REST = 1.8
  let clock = 0, lastHit = -1, hot = -1, manualI = -1, manualUntil = 0, now = 0, lastTick = 0
  const orbAt = new THREE.Vector3(), orbGoal = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3()

  async function build(k: Kit) {
    kit = k
    const env = sharedEnv(k.renderer)
    // ---- the plywood face: four birch sheets (grain runs up the wall), seams with screws, the T-nut grid, a key light from the upper left
    const face = bake(k.renderer, 1536, 1856, `
      const float PW = ${PW.toFixed(3)}, PH = ${PH.toFixed(3)}, S = ${NUT.toFixed(3)};
      void main() {
        vec2 p = vec2((vUv.x - 0.5) * PW, vUv.y * PH);
        float sx = step(0.0, p.x), sy = step(PH * 0.5, p.y), seed = sx * 3.0 + sy * 7.0;
        vec3 col = wood(vec2(p.y * 0.9 + seed * 2.3, p.x * 1.5 + seed), vec3(0.80, 0.64, 0.41), vec3(0.64, 0.47, 0.27), 7.0, seed);
        col *= 0.93 + 0.1 * fbm(p * 2.0 + seed);
        float sp = h21(floor(p * 220.0)); col *= 1.0 - 0.18 * step(0.992, sp); col += 0.1 * step(0.9965, h21(floor(p * 180.0) + 5.0));
        float seam = min(abs(p.x) - 0.006, abs(p.y - PH * 0.5) - 0.006); col = mix(col, vec3(0.1, 0.07, 0.04), 1.0 - smoothstep(0.0, 0.006, seam));
        vec2 sc = vec2(p.x, mod(p.y, 0.3) - 0.15); float onV = 1.0 - smoothstep(0.012, 0.016, length(vec2(abs(p.x) - 0.075, sc.y)));
        col = mix(col, vec3(0.45, 0.45, 0.47), onV * 0.8);
        // T-nuts: a dark threaded hole in a steel lip, a hair of shadow round it
        vec2 c = (floor(p / S) + 0.5) * S; float d = length(p - c);
        col *= 1.0 - 0.16 * smoothstep(0.05, 0.026, d);
        col = mix(col, vec3(0.58, 0.58, 0.6), (1.0 - smoothstep(0.024, 0.028, d)) * 0.85);
        col = mix(col, vec3(0.04, 0.03, 0.025), 1.0 - smoothstep(0.011, 0.015, d));
        col += vec3(0.18) * smoothstep(0.007, 0.0, length(p - c - vec2(-0.013, 0.015))) * (1.0 - smoothstep(0.024, 0.028, d));
        // the key light: a warm pool high on the left, falling away to the right and down; the foot is in shade
        vec2 pp = (p - vec2(-0.9, 4.3)) * vec2(0.2, 0.15);
        col *= (0.72 + 0.5 * exp(-dot(pp, pp))) * (0.8 + 0.2 * smoothstep(0.0, 1.6, p.y));
        col *= mix(vec3(1.0), vec3(1.0, 0.94, 0.84), exp(-dot(pp, pp)));
        vec2 e = min(vec2(vUv.x, 1.0 - vUv.x), vec2(vUv.y, 1.0 - vUv.y)); col *= 0.8 + 0.2 * smoothstep(0.0, 0.025, min(e.x * 1.3, e.y));
        gl_FragColor = vec4(col, 1.0);
      }`)
    const grit = bake(k.renderer, 512, 512, `void main() { float n = 0.5 + 0.5 * (fbm(vUv * 110.0) - 0.5) * 2.0; n = clamp(n + 0.3 * (h21(floor(vUv * 512.0)) - 0.5), 0.0, 1.0); gl_FragColor = vec4(vec3(n), 1.0); }`)
    const plyEdge = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#c9a874'; g.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#a07f4e' : '#dcc08e'; g.fillRect(0, (i / 14) * h, w, h / 28) } }, { repeat: true })

    const steel = new THREE.MeshStandardMaterial({ color: D(0.16, 0.17, 0.19), roughness: 0.42, metalness: 0.75, envMap: env, envMapIntensity: 1.2 })
    // ---- base plinth, rear legs and braces (steel), the crash pad
    const baseBlk = new THREE.Mesh(new RoundedBoxGeometry(PW + 0.4, 0.5, 1.5, 3, 0.06), steel); baseBlk.position.set(0, 0.25, FOOT[2] - 0.18)
    const faceMat = new THREE.MeshStandardMaterial({ map: face.texture, color: new THREE.Color(1.3, 1.3, 1.3), roughness: 0.58, envMap: env, envMapIntensity: 0.9 })
    const edgeMat = new THREE.MeshStandardMaterial({ map: plyEdge, roughness: 0.7, envMap: env, envMapIntensity: 0.6 })
    const backMat = new THREE.MeshStandardMaterial({ color: D(0.42, 0.32, 0.22), roughness: 0.85 })
    const panel = new THREE.Mesh(new THREE.BoxGeometry(PW, PH, PT), [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, backMat])
    panel.position.set(0, PH / 2, -PT / 2)
    wall.add(panel)
    wall.position.set(...FOOT); wall.rotation.x = TILT; wall.updateMatrix()
    const beam = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 10), steel)
      m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpA.copy(b).sub(a).normalize()); return m
    }
    for (const x of [-1.8, 1.8]) {
      const top = new THREE.Vector3(x, 4.7, -PT).applyMatrix4(wall.matrix), mid = new THREE.Vector3(x, 2.2, -PT).applyMatrix4(wall.matrix), foot = new THREE.Vector3(x, 0.4, FOOT[2] - 2.1)
      root.add(beam(foot, top, 0.07), beam(foot.clone().add(new THREE.Vector3(0, 0, 0.5)), mid, 0.05))
    }
    // the crash pad: dark vinyl with piping and fold seams, a soft shadow of the overhang across it
    const pad = new THREE.Mesh(new RoundedBoxGeometry(PW + 0.3, 0.3, 2.9, 4, 0.1), new THREE.MeshStandardMaterial({
      map: canvasTex(512, 512, (g, w, h) => {
        g.fillStyle = '#2b3646'; g.fillRect(0, 0, w, h)
        for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${(Math.random() * 0.035).toFixed(3)})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2) }
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 6; for (const y of [h / 3, (2 * h) / 3]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
        g.strokeStyle = 'rgba(255,106,33,0.65)'; g.lineWidth = 5; g.strokeRect(12, 12, w - 24, h - 24)
      }), roughness: 0.52, envMap: env, envMapIntensity: 0.8 }))
    pad.position.set(0, 0.15, 0.2)
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x000000, transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false }))
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(PW * 1.15, 4.2, 1); shadow.position.set(0.15, 0.306, 0.4); shadow.renderOrder = 2
    root.add(baseBlk, pad, shadow, wall)

    // ---- chalk: smudges and drips above and beside the holds, a few hand-wide swipes
    const chalk = canvasTex(1024, 1280, (g, w, h) => {
      let s = 17; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
      const X = (x: number) => (x / PW + 0.5) * w, Y = (y: number) => (1 - y / PH) * h
      for (const hd of HOLDS) {
        const n = hd.route >= 0 ? 7 : 4
        for (let i = 0; i < n; i++) {
          const x = X(hd.x + (r() - 0.5) * 0.7 * hd.s), y = Y(hd.y + 0.12 + r() * 0.5 * hd.s), rad = (14 + r() * 34) * hd.s
          const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(250,250,244,${(0.1 + r() * 0.22).toFixed(2)})`); gr.addColorStop(1, 'rgba(250,250,244,0)')
          g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
        }
        g.strokeStyle = 'rgba(250,250,244,0.16)'; g.lineWidth = 3; g.lineCap = 'round'
        for (let i = 0; i < 3; i++) { const x = X(hd.x + (r() - 0.5) * 0.5), y = Y(hd.y + 0.2); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 10, y + 20 + r() * 70); g.stroke() }
      }
      for (let i = 0; i < 9; i++) { const x = r() * w, y = h * (0.15 + r() * 0.6), rw = 40 + r() * 80; const gr = g.createRadialGradient(x, y, 0, x, y, rw); gr.addColorStop(0, 'rgba(250,250,244,0.09)'); gr.addColorStop(1, 'rgba(250,250,244,0)'); g.fillStyle = gr; g.fillRect(x - rw, y - rw, rw * 2, rw * 2) }
    })
    const chalkMesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: chalk, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.5 }))
    chalkMesh.position.set(0, PH / 2, 0.003); chalkMesh.renderOrder = 1; wall.add(chalkMesh)

    // ---- volumes: two bolt-on shapes (a painted wedge and a dark chamfered block), bevelled, grit-textured
    const gritTex = grit.texture
    const vol = (cx: number, cy: number, pts: [number, number][], depth: number, c: [number, number, number]) => {
      const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath()
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3 }), new THREE.MeshPhysicalMaterial({ color: D(...c), roughness: 0.55, clearcoat: 0.2, bumpMap: gritTex, bumpScale: 0.5, envMap: env, envMapIntensity: 1.0 }))
      m.position.set(cx, cy, 0.004); wall.add(m)
      for (const [bx, by] of [[0.18, 0.18], [-0.18, 0.18]] as const) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), steel); b.rotation.x = Math.PI / 2; b.position.set(cx + pts[0][0] + 0.3 + bx, cy + pts[0][1] + 0.28 + by, depth + 0.07); wall.add(b) }
    }
    vol(1.65, 1.2, [[-0.55, -0.42], [0.55, -0.42], [0.55, 0.42]], 0.5, [0.8, 0.79, 0.74])
    vol(-1.6, 3.6, [[-0.5, -0.38], [0.5, -0.38], [-0.5, 0.38]], 0.42, [0.3, 0.4, 0.4])

    // ---- the holds
    const aoMat = new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false })
    const boltMat = new THREE.MeshStandardMaterial({ color: D(0.64, 0.64, 0.67), metalness: 1, roughness: 0.3, envMap: env, envMapIntensity: 1.5 })
    const sinkMat = new THREE.MeshBasicMaterial({ color: 0x050403, toneMapped: false })
    HOLDS.forEach((spec, i) => {
      const { geo, sh } = holdGeo(spec.t, i * 3.17 + 1)
      const base = D(...spec.col)
      const mat = new THREE.MeshPhysicalMaterial({
        color: base.clone(), vertexColors: true, roughness: spec.t === 'sloper' ? 0.6 : 0.4, clearcoat: spec.t === 'sloper' ? 0.15 : 0.5, clearcoatRoughness: 0.3,
        bumpMap: gritTex, bumpScale: 1.1, envMap: env, envMapIntensity: 1.45, emissive: new THREE.Color(0, 0, 0),
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.scale.setScalar(spec.s * HS); mesh.rotation.z = spec.rot; mesh.position.set(spec.x, spec.y, 0.006)
      // the countersunk bolt in the middle
      const zc = sh.z(0, 0)
      const sink = new THREE.Mesh(new THREE.CircleGeometry(0.058, 16), sinkMat); sink.position.set(0, 0, zc + 0.003)
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.02, 12), boltMat); bolt.rotation.x = Math.PI / 2; bolt.position.set(0, 0, zc + 0.006)
      mesh.add(sink, bolt)
      wall.add(mesh)
      const ao = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), aoMat)
      ao.scale.setScalar(2.3 * spec.s * Math.max(sh.a, sh.b) * HS); ao.position.set(spec.x + 0.05 * spec.s, spec.y - 0.065 * spec.s, 0.0045); ao.renderOrder = 2; wall.add(ao)
      holds.push({ mesh, mat, spec, base, top: zc, sh })
      if (spec.route >= 0) {
        route[spec.route] = i
        const prox = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); prox.position.set(spec.x, spec.y, 0.12); prox.userData.route = spec.route
        wall.add(prox); pick.push(prox)
      }
    })

    // ---- tape: a yellow strip under each route hold, START and TOP tags at the ends, and the V8 grade tag at the foot
    const tapeTex = (label: string, w: number, h: number) => canvasTex(Math.round(w * 400), Math.round(h * 400), (g, cw, ch) => {
      g.fillStyle = '#f4d23a'; g.beginPath(); g.moveTo(0, 3)
      for (let x = 0; x <= cw; x += 12) g.lineTo(x, 3 + (x % 24 ? 3 : 0)); g.lineTo(cw, ch - 3); for (let x = cw; x >= 0; x -= 12) g.lineTo(x, ch - 3 - (x % 24 ? 3 : 0)); g.closePath(); g.fill()
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 3, cw, ch * 0.28)
      if (label) { g.fillStyle = '#15110a'; g.font = '800 ' + Math.round(ch * 0.64) + 'px "Archivo Variable","Archivo","Arial Black",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '4px'; g.fillText(label, cw / 2, ch / 2 + 2) }
    })
    const tapeMat = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false, color: 0xf2f2f2 })
    route.forEach((hi, i) => {
      const h = holds[hi], label = i === 0 ? 'START' : i === N_ROUTE - 1 ? 'TOP' : ''
      const w = label ? 0.58 : 0.3, hh = label ? 0.15 : 0.085
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), tapeMat(tapeTex(label, w, hh)))
      m.position.set(h.spec.x + (i % 2 ? 0.06 : -0.05), h.spec.y - (h.sh.b * h.spec.s * HS + 0.1), 0.007); m.rotation.z = (i % 3 - 1) * 0.07; m.renderOrder = 3; wall.add(m)
    })
    const v8 = canvasTex(320, 200, (g, w, h) => {
      g.fillStyle = '#f6f1e4'; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 26); g.fill(); g.lineWidth = 10; g.strokeStyle = '#ff6a21'; g.stroke()
      g.fillStyle = '#17110c'; g.font = '800 128px "Archivo Variable","Archivo","Arial Black",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('V8', w / 2, h / 2 + 8)
      g.fillStyle = '#d9d2c2'; g.beginPath(); g.arc(w - 34, 34, 8, 0, 7); g.fill()
    })
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.425), new THREE.MeshBasicMaterial({ map: v8, transparent: true, toneMapped: false }))
    tag.position.set(snap(-1.95), 0.5, 0.009); tag.rotation.z = 0.06; tag.renderOrder = 4; wall.add(tag)
    // a brass-lit hint of the V8 tag: a soft pool under it so it reads from across the room
    const tagGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshBasicMaterial({ map: glowTexture(1, 0.62, 0.3), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    tagGlow.position.copy(tag.position).setZ(0.008); tagGlow.renderOrder = 3; wall.add(tagGlow)

    // ---- the climbing light, its chalk, the thread that shows the next move
    const sp = (rgb: [number, number, number], a: number) => new THREE.SpriteMaterial({ map: glowTexture(...rgb), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: a, toneMapped: false })
    orb = new THREE.Sprite(sp([1, 0.62, 0.28], 0.95)); orb.scale.setScalar(0.62); orbHalo = new THREE.Sprite(sp([1, 0.5, 0.2], 0.3)); orbHalo.scale.setScalar(1.7)
    next = new THREE.Sprite(sp([1, 0.86, 0.5], 0)); next.scale.setScalar(0.9)
    wall.add(orbHalo, orb, next)
    for (let i = 0; i < 14; i++) { const d = new THREE.Sprite(sp([1, 0.95, 0.7], 0)); d.scale.setScalar(0.17); d.visible = false; wall.add(d); dots.push(d) }
    const cs = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,250,0.85)'); gr.addColorStop(0.5, 'rgba(240,240,232,0.35)'); gr.addColorStop(1, 'rgba(240,240,232,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h) })
    for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cs, transparent: true, depthWrite: false, opacity: 0, toneMapped: false })); s.visible = false; s.renderOrder = 6; wall.add(s); puffs.push({ s, t: -9 }) }
    precompile(k, root)
    built = true
  }

  const CYCLE = () => N_ROUTE * SEG + REST
  /** where the light stands for route clock t: on hold i, then flowing to i + 1 in the last 60% of the segment */
  function routePoint(t: number, out: THREE.Vector3) {
    const u = t / SEG, i = Math.min(N_ROUTE - 1, Math.floor(u)), f = u - i
    const a = holds[route[i]].spec, b = holds[route[Math.min(i + 1, N_ROUTE - 1)]].spec
    const e = i >= N_ROUTE - 1 ? 0 : sstep(0.4, 1.0, f), ee = e * e * (3 - 2 * e)
    out.set(lerp(a.x, b.x, ee), lerp(a.y, b.y, ee) + 0.16 * Math.sin(Math.PI * ee), 0.5)
    return i
  }
  const puff = (i: number, time: number) => {
    const h = holds[route[i]].spec, pf = puffs.find(p => time - p.t > 1.4) ?? puffs[0]
    pf.t = time; pf.s.position.set(h.x, h.y + 0.18, 0.45); pf.s.visible = true
  }

  function update(time: number, dt: number, r: number, dwell: boolean, _st: FlightState) {
    if (!built) return
    const rm = kit.reduced()
    if (r <= 0.0005) { root.visible = false; clock = 0; return }
    root.visible = true
    enter(root, r, rm, 2.6)
    now = time
    const manual = !rm && manualI >= 0 && time < manualUntil
    if (!manual && manualI >= 0) manualI = -1
    if (!rm && dwell && r > 0.97) { if (manual) clock = manualI * SEG; else clock += Math.min(dt, 0.1) }
    const T = CYCLE(), ct = rm ? 0 : clock % T
    // ---- the climbing light (it eases to wherever the climb is, so a press makes it travel)
    if (rm) { orb.visible = false; orbHalo.visible = false } else {
      const live = (ct < N_ROUTE * SEG && clock > 0.2) || manual
      orb.visible = orbHalo.visible = live
      if (live) {
        const i = routePoint(ct, orbGoal)
        const k = 1 - Math.exp(-dt / (manual ? 0.1 : 0.04)); orbAt.lerp(orbGoal, clock < 0.3 ? 1 : k)
        orb.position.copy(orbAt); orbHalo.position.copy(orbAt)
        const pulse = 0.5 + 0.5 * Math.sin(time * 10)
        orb.scale.setScalar(0.5 + 0.14 * pulse); orbHalo.scale.setScalar(1.45 + 0.4 * pulse)
        if (!manual && i !== lastHit && ct - i * SEG < SEG * 0.5) { lastHit = i; puff(i, time); kit.emit('cab:grab', { i }) }
      } else lastHit = -1
    }
    // ---- glow per route hold: the trail behind the light, a soft resting glow, the hovered hold bright, the next move pulsing
    const nextI = hot >= 0 ? hot + 1 : manual ? manualI + 1 : -1
    holds.forEach((h, k) => {
      const ri = h.spec.route
      let glow = 0
      if (ri >= 0) {
        if (rm) glow = 0.35
        else {
          const since = ct - ri * SEG
          glow = since < 0 ? 0 : Math.exp(-since * 1.2) * (ct < N_ROUTE * SEG ? 1 : 0)
          if (ct >= N_ROUTE * SEG) glow = Math.max(glow, 0.5 * (1 - sstep(0, REST * 0.9, ct - N_ROUTE * SEG)))
          glow = 0.1 + 0.6 * glow
        }
        if (ri === hot) glow = 0.95
        else if (ri === nextI) glow = Math.max(glow, rm ? 0.75 : 0.5 + 0.35 * Math.sin(time * 7))
        else if (manual && ri === manualI) glow = Math.max(glow, 0.8)
      }
      h.mat.emissive.setRGB(h.base.r * glow * 0.85, h.base.g * glow * 0.85, h.base.b * glow * 0.85)
      const lift = ri >= 0 && ri === hot ? 1 : 0
      h.mesh.position.z += (0.006 + 0.025 * lift - h.mesh.position.z) * Math.min(1, dt * 14)
    })
    // ---- the next move: a pulse on the target hold and a thread of dots running to it from the hovered / pressed hold
    const showThread = nextI >= 1 && nextI < N_ROUTE
    if (showThread) {
      const a = holds[route[nextI - 1]].spec, b = holds[route[nextI]].spec
      next.visible = true; next.position.set(b.x, b.y, 0.45); next.scale.setScalar(1.25 + 0.3 * Math.sin(time * 7)); (next.material as THREE.SpriteMaterial).opacity = 0.95
      dots.forEach((d, k) => {
        const u = ((k / dots.length) + (rm ? 0 : time * 0.7)) % 1
        d.visible = true; d.position.set(lerp(a.x, b.x, u), lerp(a.y, b.y, u) + 0.12 * Math.sin(Math.PI * u), 0.42)
        ;(d.material as THREE.SpriteMaterial).opacity = Math.sin(Math.PI * u); d.scale.setScalar(0.16 + 0.26 * Math.sin(Math.PI * u))
      })
    } else { next.visible = false; for (const d of dots) d.visible = false }
    // ---- chalk drifting up from each grab
    for (const p of puffs) {
      const u = (time - p.t) / 1.4
      if (u < 0 || u > 1) { p.s.visible = false; continue }
      p.s.visible = true; p.s.position.y += dt * 0.35; p.s.scale.setScalar(0.35 + 0.9 * u); (p.s.material as THREE.SpriteMaterial).opacity = 0.7 * (1 - u) * (1 - u)
    }
  }

  /** the climbing light hops to the next route hold (what pressing it does, from the keyboard or the idle demonstration) */
  function hop() {
    const cur = manualI >= 0 ? manualI : Math.min(N_ROUTE - 1, Math.floor((clock % CYCLE()) / SEG)), k = (cur + 1) % N_ROUTE
    if (kit.reduced()) { puff(k, now); kit.emit('obj:move', { i: k }); return k }
    manualI = k; manualUntil = now + 6; clock = k * SEG; puff(k, now); kit.emit('obj:move', { i: k })
    return k
  }
  const routeOf = (o: THREE.Object3D | null) => (typeof o?.userData.route === 'number' ? (o.userData.route as number) : -1)
  return {
    id: 'hold', root, dim: 0.05, pick, build, update,
    hover(o) { const k = routeOf(o); if (k !== hot) { hot = k; if (k >= 0 && now - lastTick > 0.08) { lastTick = now; kit.emit('obj:tick', { i: k }) } } },
    press(o) {
      const k = routeOf(o); if (k < 0) return
      if (kit.reduced()) { puff(k, now); kit.emit('obj:move', { i: k }); return }
      manualI = k; manualUntil = now + 6; clock = k * SEG; puff(k, now); kit.emit('obj:move', { i: k })
    },
    act(name) { if (name !== 'climb') return ''; hop(); return 'The climbing light moved to the next hold.' },
    demo() { hop() },
    api: { get clock() { return clock }, set clock(v: number) { clock = v }, holds, route, get hot() { return hot }, hop },
    dispose() { disposeTree(root) },
  }
}
