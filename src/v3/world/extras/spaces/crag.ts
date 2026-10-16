// The granite of the climbing-wall space. Two sources, one result, two modes:
//   1. public/models/crag.glb, modelled and AO-baked in Blender (scripts/blender/crag.py): two meshes, 'backdrop' (the cliff mass and its buttresses) and 'foreground'
//      (three boulders and a little scree), float vertex colour = granite albedo x ambient occlusion
//   2. a procedural crag (noise-displaced, squared-off icosahedra with analytic vertex AO), used when the fetch or the parse fails, or on ?nocrag=1
//   mode 'boulders' (the Yosemite backdrop is up): ONLY the foreground, dark, framing the base of the wall; mode 'full' (the fallback): the whole crag as before.
// Both return the same group: a MeshStandardMaterial with vertex colours, the shared studio env and the spaces' depth fog. Space-local axes: x right, y up, -z away.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fbm3d } from '../cabinet/props'
import { fogify, lcg, type SpaceKit } from './common'

export interface Crag { group: THREE.Group; source: 'glb' | 'procedural'; tris: number; ms: number }

const triCount = (g: THREE.Object3D) => { let n = 0; g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { const gg = m.geometry; n += (gg.index ? gg.index.count : gg.getAttribute('position').count) / 3 } }); return Math.round(n) }
const material = (k: SpaceKit, gain = 1.45, env = 0.55) => granite(fogify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0, color: new THREE.Color(gain, gain, gain), envMap: k.env, envMapIntensity: env }), k.fog))
/** dark foreground boulders: they read as silhouettes against the lit valley, with only the key and rim catching their edges */
const BOULDER_GAIN = 0.9, BOULDER_ENV = 0.3
export type CragMode = 'full' | 'boulders'

/** fine granite relief the mesh is too coarse to carry: a world-space 3D noise bump on the normal and dark pits in the albedo (the vertex colour already holds the large forms and the baked occlusion) */
function granite(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const prev = m.onBeforeCompile
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r)
    sh.vertexShader = 'varying vec3 vSpW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = 'varying vec3 vSpW;\nfloat spH(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float n = 0.0; for (int c = 0; c < 8; c++) { vec3 o = vec3(float(c & 1), float((c >> 1) & 1), float((c >> 2) & 1)); vec3 q = i + o; float h = fract(sin(dot(q, vec3(127.1, 311.7, 74.7))) * 43758.5453); n += h * ((o.x > 0.5 ? f.x : 1.0 - f.x) * (o.y > 0.5 ? f.y : 1.0 - f.y) * (o.z > 0.5 ? f.z : 1.0 - f.z)); } return n; }\n'
      + 'float spR(vec3 p) { return spH(p * 5.0) * 0.55 + spH(p * 13.0) * 0.3 + spH(p * 31.0) * 0.15; }\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat spPit = spR(vSpW); diffuseColor.rgb *= 0.72 + 0.5 * spPit;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ vec3 Nw = normalize(inverseTransformDirection(normal, viewMatrix)); float e = 0.045; float h0 = spR(vSpW); vec3 g = vec3(spR(vSpW + vec3(e, 0.0, 0.0)) - h0, spR(vSpW + vec3(0.0, e, 0.0)) - h0, spR(vSpW + vec3(0.0, 0.0, e)) - h0) / e; Nw = normalize(Nw - 0.16 * (g - dot(g, Nw) * Nw)); normal = normalize((viewMatrix * vec4(Nw, 0.0)).xyz); }')
  }
  const key = m.customProgramCacheKey
  m.customProgramCacheKey = () => key.call(m) + '-granite'
  return m
}

export async function loadCrag(k: SpaceKit, mode: CragMode = 'full'): Promise<Crag> {
  const t0 = performance.now()
  const boulders = mode === 'boulders'
  if (!k.nocrag) {
    try {
      const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/crag.glb`)
      const meshes: THREE.Mesh[] = []
      gltf.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry.getAttribute('color')) meshes.push(m) })
      if (!meshes.length) throw new Error('crag.glb has no mesh with COLOR_0')
      const named = (n: string) => meshes.find(m => m.name.toLowerCase().includes(n) || m.parent?.name.toLowerCase().includes(n))
      const pick = boulders ? [named('foreground')] : meshes
      if (boulders && !pick[0]) throw new Error('crag.glb has no foreground boulders mesh (old single-mesh bake)')
      const g = new THREE.Group(); g.name = 'crag'
      const mat = boulders ? material(k, BOULDER_GAIN, BOULDER_ENV) : material(k)
      for (const src of pick as THREE.Mesh[]) { const m = new THREE.Mesh(src.geometry, mat); m.frustumCulled = false; g.add(m) }
      return { group: g, source: 'glb', tris: triCount(g), ms: performance.now() - t0 }
    } catch (e) { console.warn('[spaces] crag.glb unavailable, using the procedural crag', e) }
  }
  const g = await buildProcedural(k, mode)
  return { group: g, source: 'procedural', tris: triCount(g), ms: performance.now() - t0 }
}

// ---------------------------------------------------------------------------------------------------- procedural
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

interface RockSpec { at: [number, number, number]; half: [number, number, number]; seed: number; detail: number; square: number; rough: number; crack: number; flat?: number; yaw?: number }
/** a convex block: six jittered faces plus corner and edge cuts, (normal, distance) in rock units */
function planesFor(R: () => number, extra: number): { n: THREE.Vector3; d: number }[] {
  const pl: { n: THREE.Vector3; d: number }[] = []
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-6, R()))) * Math.cos(2 * Math.PI * R())
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const n = new THREE.Vector3(); n.setComponent(axis, sign)
    n.add(new THREE.Vector3((R() - 0.5) * 0.4, (R() - 0.5) * 0.4, (R() - 0.5) * 0.4)).normalize()
    pl.push({ n, d: 0.84 + R() * 0.16 })
  }
  for (let i = 0; i < extra; i++) pl.push({ n: new THREE.Vector3(gauss(), gauss(), gauss()).normalize(), d: 0.80 + R() * 0.17 })
  return pl
}
const K_SOFT = 11
/** distance along unit direction h to the soft-min of the planes: a convex polytope with rounded edges (the same construction as scripts/blender/crag.py) */
function softRadius(h: THREE.Vector3, planes: { n: THREE.Vector3; d: number }[]): number {
  let m = 1e9
  const ts: number[] = []
  for (const p of planes) { const c = p.n.dot(h); if (c > 0.03) { const t = p.d / c; ts.push(t); if (t < m) m = t } }
  let sum = 0; for (const t of ts) sum += Math.exp(-K_SOFT * (t - m))
  return m - Math.log(sum) / K_SOFT
}
function rockGeo(r: RockSpec): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, r.detail)
  g.deleteAttribute('normal'); g.deleteAttribute('uv')
  g = mergeVertices(g, 1e-4)
  const P = g.getAttribute('position'), n = P.count, col = new Float32Array(n * 3)
  const R = lcg(r.seed * 101 + 7)
  const planes = planesFor(R, 6 + Math.floor(r.square * 10))
  const joints: { n: THREE.Vector3; sp: number; ph: number }[] = []
  for (let i = 0; i < 3; i++) joints.push({ n: new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, i < 2 ? (R() - 0.5) * 0.7 : 0.7 + R() * 0.3).normalize(), sp: 1.3 + R() * 0.8, ph: R() })
  const off = [r.seed * 7.31, r.seed * 3.17, r.seed * 5.53]
  const cy = Math.cos(r.yaw ?? 0), sy = Math.sin(r.yaw ?? 0)
  const q = new THREE.Vector3(), h = new THREE.Vector3(), Pw = new THREE.Vector3(), crack = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    h.fromBufferAttribute(P, i).normalize()
    q.copy(h).multiplyScalar(softRadius(h, planes))
    Pw.set(q.x * r.half[0], q.y * r.half[1], q.z * r.half[2])
    const wob = fbm3d(Pw.x * 0.55 + off[0], Pw.y * 0.55 + off[1], Pw.z * 0.55 + off[2], 2) * 2 - 1
    let gm = 0
    for (const j of joints) { const u = Pw.dot(j.n) / j.sp + j.ph + 0.4 * wob, f = Math.abs(u - Math.floor(u) - 0.5) * j.sp; gm = Math.max(gm, 1 - Math.min(1, f / 0.2)) }
    const d = r.rough * (0.55 * (fbm3d(q.x * 2.6 + off[0], q.y * 2.6 + off[1], q.z * 2.6 + off[2], 3) * 2 - 1) + 0.2 * (fbm3d(q.x * 7 + off[0], q.y * 7 + off[1], q.z * 7 + off[2], 2) * 2 - 1)) - r.crack * gm * gm
    if ((r.flat ?? 0) > 0 && q.y > 0.25) q.y = q.y * (1 - r.flat!) + 0.25 * r.flat!
    const k = 1 + d
    const px = q.x * k * r.half[0], py = q.y * k * r.half[1], pz = q.z * k * r.half[2]
    P.setXYZ(i, r.at[0] + px * cy + pz * sy, r.at[1] + py, r.at[2] - px * sy + pz * cy)
    crack[i] = gm * gm
  }
  g.computeVertexNormals()
  const N = g.getAttribute('normal')
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ny = N.getY(i)
    // analytic AO: darker near the ground, in cracks, on downward faces, and toward the cliff's own interior
    const ao = Math.min(1, (0.46 + 0.54 * sm(-0.2, 2.6, y)) * (1 - 0.6 * crack[i]) * (0.62 + 0.38 * (ny * 0.5 + 0.5)) * (0.86 + 0.14 * sm(-7.5, -1, z)))
    // granite: warm/cool drift, speckle, lichen on upward faces, iron stain drips, crack linings
    const lump = fbm3d(x * 0.45 + 3.1, y * 0.45 + 1.7, z * 0.45 + 9.2, 3) * 2 - 1
    const spec = fbm3d(x * 7, y * 7, z * 7, 2) * 2 - 1
    const g0 = 1 + 0.18 * lump + 0.07 * spec
    let R_ = 0.58 * g0, G = 0.58 * g0, B = 0.59 * g0
    const w = Math.max(0, lump) * 0.5; R_ += (0.63 - R_) * w; G += (0.60 - G) * w; B += (0.56 - B) * w
    const lich = Math.max(0, (fbm3d(x * 1.1 + 8, y * 1.1 + 2, z * 1.1 + 5, 3) * 2 - 1) - 0.1) * 0.8 * Math.max(0, ny)
    R_ += (0.40 - R_) * lich; G += (0.44 - G) * lich; B += (0.36 - B) * lich
    const st = Math.min(0.5, Math.max(0, (fbm3d(x * 2.2 + 4, y * 0.35 + 1, z * 2.2 + 4, 3) * 2 - 1) - 0.12) * 1.6) * (1 - Math.max(0, ny) * 0.6)
    R_ += (0.5 - R_) * st; G += (0.42 - G) * st; B += (0.35 - B) * st
    const sh = (0.30 + 0.70 * Math.pow(ao, 1.15)) * (1 - 0.4 * crack[i])
    col[i * 3] = R_ * sh; col[i * 3 + 1] = G * sh; col[i * 3 + 2] = B * sh
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

const frame = () => new Promise<void>(res => requestAnimationFrame(() => res()))
async function buildProcedural(k: SpaceKit, mode: CragMode): Promise<THREE.Group> {
  const q = k.phone ? 0.8 : 1
  const d = (n: number) => Math.max(4, Math.round(n * q))
  // site axes: x right, y up, z toward the camera (the Blender script's Y is -z)
  const specs: RockSpec[] = [
    { at: [-1.7, 3.5, -5.4], half: [4.5, 4.2, 2.0], seed: 1, detail: d(18), square: 0.5, rough: 0.20, crack: 0.22, flat: 0.35, yaw: 0.05 },
    { at: [-5.6, 1.9, -2.6], half: [1.9, 2.1, 2.0], seed: 2, detail: d(11), square: 0.5, rough: 0.24, crack: 0.2, yaw: -0.12 },
    { at: [5.7, 1.5, -3.2], half: [1.8, 1.6, 1.9], seed: 3, detail: d(11), square: 0.5, rough: 0.24, crack: 0.2, yaw: 0.1 },
    { at: [-5.3, 0.8, 1.0], half: [1.25, 0.85, 1.15], seed: 4, detail: d(9), square: 0.35, rough: 0.2, crack: 0.14, yaw: 0.2 },
    { at: [5.5, 0.62, 1.5], half: [1.0, 0.65, 0.95], seed: 5, detail: d(9), square: 0.35, rough: 0.2, crack: 0.14, yaw: -0.15 },
    { at: [-3.0, 0.45, -2.2], half: [0.8, 0.45, 0.7], seed: 6, detail: d(7), square: 0.3, rough: 0.2, crack: 0.1 },
  ]
  if (mode === 'boulders') specs.splice(0, 3)                                         // the cliff and its two buttresses stay out: the valley is the backdrop
  const R = lcg(5)
  for (let i = 0; i < (mode === 'boulders' ? 5 : 12); i++) {
    let x = 0, z = 0
    for (let t = 0; t < 30; t++) {
      const a = R() * Math.PI * 2, r = 3.2 + R() * 4
      x = Math.cos(a) * r; z = -Math.sin(a) * r * 0.9
      if (!(Math.abs(x) < 2.9 && z > -1.8 && z < 2.6) && z < 3.5) break
    }
    const s = 0.18 + R() * 0.32
    specs.push({ at: [x, s * 0.35, z], half: [s * 1.2, s * 0.6, s], seed: 20 + i, detail: 4, square: 0.3, rough: 0.25, crack: 0, yaw: R() * 3 })
  }
  const geos: THREE.BufferGeometry[] = []
  for (const sp of specs) { geos.push(rockGeo(sp)); if (geos.length % 3 === 0) await frame() }
  const merged = mergeGeometries(geos, false)!
  geos.forEach(g => g.dispose())
  const mesh = new THREE.Mesh(merged, mode === 'boulders' ? material(k, BOULDER_GAIN, BOULDER_ENV) : material(k)); mesh.frustumCulled = false
  const g = new THREE.Group(); g.name = 'crag'; g.add(mesh)
  return g
}
