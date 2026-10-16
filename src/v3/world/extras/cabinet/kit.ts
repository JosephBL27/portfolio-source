// Shared kit of the cabinet (unit 8O): the real objects that stand where the interests used to be particle forms.
//  * display-referred colour: the world writes linear material output straight to the canvas (post.ts has no transfer function), so every
//    colour here is authored as the number it should LOOK like (`D()`), and baked textures stay un-decoded (NoColorSpace)
//  * `bake()`: procedural textures drawn ON THE GPU into a render target (marble, walnut, resin grit, painted plywood ...): a 2048 px marble
//    costs a fraction of a millisecond, where the same noise on the CPU would stall a frame for half a second
//  * the GLSL noise library those bakes share, a soft blob-shadow texture, small spring / easing helpers
import * as THREE from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { flightAt, type FlightState } from '../../flight'

export { mergeGeometries }
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3)
export const easeInOut = (t: number) => { const x = clamp01(t); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
export const damp = (cur: number, goal: number, tau: number, dt: number) => goal + (cur - goal) * Math.exp(-dt / Math.max(1e-4, tau))
/** a "back-out" overshoot (settles with one small bounce past 1): the rise of an object onto its plinth */
export const easeOutBack = (t: number, k = 1.45) => { const x = clamp01(t) - 1; return 1 + (k + 1) * x * x * x + k * x * x }
export function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** display-referred colour: the three numbers are what the pixel should read (no sRGB decode) */
export const D = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace)
/** display-referred colour from a '#rrggbb' string */
export const DH = (hex: string) => { const n = parseInt(hex.replace('#', ''), 16); return D(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255) }

// ------------------------------------------------------------------------------------------------ GPU bake
const BAKE_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
/** shared GLSL: hash, value noise, fbm, ridged noise, voronoi, rotation */
export const NOISE = /* glsl */ `
float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 h22(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 6; i++) { s += a * vn(p); p = m * p; a *= 0.5; } return s; }
float fbm3(vec2 p) { float a = 0.5, s = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 3; i++) { s += a * vn(p); p = m * p; a *= 0.5; } return s; }
float ridge(vec2 p) { float a = 0.5, s = 0.0; mat2 m = mat2(1.7, 1.1, -1.1, 1.7); for (int i = 0; i < 5; i++) { s += a * (1.0 - abs(2.0 * vn(p) - 1.0)); p = m * p; a *= 0.5; } return s; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// cellular (F1, F2) distances
vec2 vor(vec2 p) { vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = h22(i + g); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; } return vec2(d1, d2); }
`
/** wood: p in plane units, grain runs along x. c0 = early wood, c1 = late wood (ring lines), returns rgb */
export const WOOD = /* glsl */ `
vec3 wood(vec2 p, vec3 c0, vec3 c1, float ringsPerUnit, float seed) {
  float warp = fbm(vec2(p.x * 0.55 + seed, p.y * 1.3)) * 2.2 + 0.5 * fbm(vec2(p.x * 2.2, p.y * 6.0 + seed));
  float r = p.y * ringsPerUnit + warp * 3.0;
  float ring = smoothstep(0.0, 0.85, fract(r)) * (1.0 - smoothstep(0.85, 1.0, fract(r)));
  float fibre = fbm3(vec2(p.x * 7.0 + seed * 3.0, p.y * 90.0)) ;
  float pores = smoothstep(0.62, 0.8, vn(vec2(p.x * 38.0, p.y * 150.0 + seed)));
  vec3 c = mix(c0, c1, clamp(ring * 0.75 + fibre * 0.5, 0.0, 1.0));
  return c * (1.0 - 0.14 * pores);
}`
/** marble: white with grey and warm veining */
export const MARBLE = /* glsl */ `
vec3 marble(vec2 p, float seed, vec3 base, vec3 vein) {
  float n = fbm(p * 1.1 + seed);
  float w = fbm(p * 2.6 + seed * 2.0 + n * 2.0);
  float v = abs(sin((p.x * 1.1 + p.y * 0.6) * 3.2 + n * 7.0 + w * 3.5));
  float thin = pow(1.0 - v, 9.0), wide = pow(1.0 - v, 3.0) * 0.28;
  float cloud = fbm(p * 3.2 + seed) * 0.5;
  vec3 c = base * (1.0 - 0.14 * cloud);
  c = mix(c, vein, clamp(thin * 0.8 + wide * (0.3 + 0.7 * w), 0.0, 0.85));
  return c;
}`

export interface BakeOpts { wrap?: THREE.Wrapping; aniso?: number; mip?: boolean }
/** draw `frag` over a w x h render target and return it (RGBA8, display-referred, mipmapped). The fragment gets `vUv` and the noise library */
export function bake(renderer: THREE.WebGLRenderer, w: number, h: number, frag: string, uniforms: Record<string, THREE.IUniform> = {}, o: BakeOpts = {}): THREE.WebGLRenderTarget {
  const mip = o.mip !== false
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, generateMipmaps: mip,
    minFilter: mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: o.wrap ?? THREE.RepeatWrapping, wrapT: o.wrap ?? THREE.RepeatWrapping,
  })
  rt.texture.anisotropy = Math.min(o.aniso ?? 8, renderer.capabilities.getMaxAnisotropy())
  const mat = new THREE.ShaderMaterial({
    vertexShader: BAKE_VERT, uniforms, depthTest: false, depthWrite: false,
    fragmentShader: `precision highp float; varying vec2 vUv;\n${NOISE}\n${WOOD}\n${MARBLE}\n${frag}`,
  })
  const quad = new FullScreenQuad(mat)
  const prev = renderer.getRenderTarget()
  renderer.setRenderTarget(rt)
  try { quad.render(renderer) } finally { renderer.setRenderTarget(prev); quad.dispose(); mat.dispose() }
  return rt
}

/** a canvas as a display-referred texture */
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, o: { aniso?: number; repeat?: boolean } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')!
  draw(g, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  t.anisotropy = o.aniso ?? 8
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.needsUpdate = true
  return t
}

/** a soft round contact shadow (alpha falls off like a gaussian); use as `alphaMap`-style opacity on a black plane */
let blob: THREE.Texture | null = null
export function blobTexture(): THREE.Texture {
  if (blob) return blob
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  for (let i = 0; i <= 12; i++) { const t = i / 12; gr.addColorStop(t, `rgba(0,0,0,${Math.exp(-t * t * 3.6).toFixed(3)})`) }
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
  blob = new THREE.CanvasTexture(c); blob.colorSpace = THREE.NoColorSpace
  return blob
}
/** a soft round glow in a colour (for additive pools of light and hover rings) */
const glows = new Map<string, THREE.Texture>()
export function glowTexture(r = 1, g = 0.8, b = 0.5): THREE.Texture {
  const key = `${r},${g},${b}`, hit = glows.get(key); if (hit) return hit
  const c = document.createElement('canvas'); c.width = c.height = 128
  const x = c.getContext('2d')!
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  for (let i = 0; i <= 10; i++) { const t = i / 10, a = Math.exp(-t * t * 4.2) * (1 - t * t * t); gr.addColorStop(t, `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a.toFixed(3)})`) }
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; glows.set(key, t)
  return t
}
/** an InstancedMesh of `n` flat blob shadows lying on the plane y = 0 of its parent (set matrices with `setBlob`) */
export function makeBlobs(n: number, opacity = 0.55): THREE.InstancedMesh {
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2)
  const m = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, color: 0x000000, toneMapped: false })
  const im = new THREE.InstancedMesh(g, m, n); im.frustumCulled = false; im.renderOrder = 4
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  return im
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3()
export function setBlob(im: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sz: number, yaw = 0) {
  _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw); _s.set(sx, 1, sz); _p.set(x, y, z)
  _m.compose(_p, _q, _s); im.setMatrixAt(i, _m)
}

/** merge geometries that may differ in attributes: everything gets position, normal, uv and a colour (white by default) */
export function uniformGeo(g: THREE.BufferGeometry, rgb: [number, number, number] = [1, 1, 1]): THREE.BufferGeometry {
  let x = g.index ? g.toNonIndexed() : g
  if (x === g) x = g.clone()
  if (!x.getAttribute('uv')) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.getAttribute('position').count * 2), 2))
  if (!x.getAttribute('normal')) x.computeVertexNormals()
  if (!x.getAttribute('color')) {
    const n = x.getAttribute('position').count, a = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { a[i * 3] = rgb[0]; a[i * 3 + 1] = rgb[1]; a[i * 3 + 2] = rgb[2] }
    x.setAttribute('color', new THREE.BufferAttribute(a, 3))
  }
  for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) x.deleteAttribute(k)
  return x
}
export const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map(g => uniformGeo(g)), false)!
/** paint every vertex of a geometry with a colour */
export function paint(g: THREE.BufferGeometry, rgb: [number, number, number]): THREE.BufferGeometry {
  const n = g.getAttribute('position').count, a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { a[i * 3] = rgb[0]; a[i * 3 + 1] = rgb[1]; a[i * 3 + 2] = rgb[2] }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}

/** release a stage's GPU resources */
export function disposeTree(o: THREE.Object3D) {
  o.traverse(c => {
    const m = c as THREE.Mesh
    m.geometry?.dispose?.()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    for (const x of Array.isArray(mat) ? mat : mat ? [mat] : []) {
      for (const v of Object.values(x as unknown as Record<string, unknown>)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose()
      x.dispose()
    }
  })
}

/** The stop the visitor is heading for: the waypoint they dwell at, or the one the flight is closer to, or (a rail jump) the jump's destination. A jump skips every leg between its two
 *  ends, so the cabinet and the spaces key what they build and show on THIS, never on the legs the camera happens to fly through. */
export function destinationWp(st: FlightState): number {
  const j = (window as unknown as { __v3?: { follower?: { jump?: { g: number } | null } } }).__v3?.follower?.jump
  if (j) { const d = flightAt(j.g); return d.dwelling ? d.wp : Math.round(d.wp + d.t) }
  return st.dwelling ? st.wp : Math.round(st.wp + st.t)
}
/** a rail jump in flight as { from, to, k } (waypoint indices, k = its eased progress 0..1), or null */
export function jumpRoute(): { from: number; to: number; k: number } | null {
  const f = (window as unknown as { __v3?: { follower?: { jump?: { p0: number; g: number } | null; jumpProgress?: number } } }).__v3?.follower
  const j = f?.jump; if (!j) return null
  const a = flightAt(j.p0), b = flightAt(j.g)
  return { from: a.dwelling ? a.wp : Math.round(a.wp + a.t), to: b.dwelling ? b.wp : Math.round(b.wp + b.t), k: f?.jumpProgress ?? 0 }
}

/** what a stage receives: the renderer to bake with, the shared studio environment, switches */
export interface Kit {
  scene: THREE.Scene
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  env: THREE.Texture
  phone: boolean
  reduced(): boolean
  emit(name: string, data?: unknown): void
}

/** the shared entrance: the whole stage rises onto its pedestal, turning a little, as it becomes present (r 0..1). Returns the eased amount (it overshoots 1 slightly). */
export function enter(root: THREE.Object3D, r: number, rm: boolean, drop = 2.4): number {
  const e = rm ? 1 : easeOutBack(sstep(0, 1, r), 1.1)
  root.position.y = (root.userData.y0 as number) - (1 - e) * drop
  root.rotation.y = (root.userData.yaw0 as number) + (1 - e) * 0.7
  const fit = root.userData.fit as { s: number; dx: number; dz: number } | undefined
  root.scale.setScalar(((root.userData.s0 as number) || 1) * (rm ? 1 : lerp(0.82, 1, clamp01(e))) * (fit?.s ?? 1))
  root.position.x = (root.userData.x0 as number) + (fit?.dx ?? 0); root.position.z = (root.userData.z0 as number) + (fit?.dz ?? 0)
  return e
}
/** a damped spring (semi-implicit Euler, stable for any dt) */
export class Spring {
  x: number; v = 0
  constructor(x = 0, public k = 120, public c = 12) { this.x = x }
  step(goal: number, dt: number) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n
    for (let i = 0; i < n; i++) { this.v += (this.k * (goal - this.x) - this.c * this.v) * h; this.x += this.v * h }
    return this.x
  }
}

let VARIANT_RT: THREE.WebGLRenderTarget | null = null
/** compile a stage's programs in parallel (hidden meshes are included) against the REAL scene (its lights decide the program) and a HALF-FLOAT
 *  render target: the world is drawn into the composer's target, and a program is keyed by the output colour space, so compiling for the canvas
 *  would build programs nothing uses (and three then deletes them while the compile is still being polled: a GL warning per program) */
export function precompile(k: Kit, root: THREE.Object3D) {
  // one compile at a time: two overlapping compileAsync calls (a stage and a space built in the same moment) make three.js poll programs the other call just
  // recycled ("glGetProgramiv: Program object expected"), so they queue; a compile that never answers is abandoned after 6 s
  PRECOMPILE = PRECOMPILE.then(() => new Promise<void>(done => {
    const r = k.renderer
    const timer = window.setTimeout(done, 6000)
    const fin = () => { window.clearTimeout(timer); done() }
    try {
      VARIANT_RT ??= new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true })
      const prev = r.getRenderTarget()
      r.setRenderTarget(VARIANT_RT)
      try { void r.compileAsync(root, k.camera, k.scene).then(fin, fin) } finally { r.setRenderTarget(prev) }
    } catch { fin() /* the first frame compiles them */ }
  }))
}
let PRECOMPILE: Promise<void> = Promise.resolve()
