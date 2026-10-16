// The hall as ONE object (unit 10H): built once, shared by extras/hall.ts (which owns when it shows, the pointer, the caption) and transitions/doors.ts (which flies the
// camera through the doorway). A pure function of HallFrame: nothing here remembers anything but the springs' closed forms, so scrolling back replays the room in reverse.
import * as THREE from 'three'
import { HALL, hallStopX } from '../../layout'
import { makeShared, precompile, springResp, sstep, clamp01, gradTexture, type Env, type Shared } from '../transitions/common'
import { buildFacade, FACADE_K, WALL_BACK, HW as FHW, YS as FYS, seamMaterial } from './facade'
import { FarDoors } from './fardoor'
import { atlasPainter, interestsFrom, type Interest } from './glass'
import { hallMaterial, makeHallUniforms, WIN, type HallUniforms } from './material'
import { buildShell, L as HL, HW as HHW } from './shell'
import { loadPhotoreal, type PhotorealRoom } from './photoreal'
import { LANE_GLSL } from '../lib/lane'
import site from '../../../../data/site.json'

export interface HallEnv { scene: THREE.Scene; renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera; lane: Env['lane']; res: THREE.Vector2; q: Env['q'] }
export interface HallFrame {
  t: number; dt: number
  /** copy on screen 0..1 (dims the stone in the copy lane) */
  copy: number
  /** dissolve-in of the room and of the front, 0..1 */
  hallIn: number; facadeIn: number
  /** progress of the doors leg (the hinges and the light at the doorway), or null when the doors simply stand open. At the gate dwell it is 0: the leaves stand shut with a seam of light between them. */
  u: number | null
  /** progress of the exit leg (hall > hold: the far doors swing open), or null while the far doors stand shut */
  exit: number | null
  /** 0..1 hover glow of each window, and 1 for the window of the stop we stand at */
  hover: number[]; active: number[]
  /** 0..1 travelling glint of each window (the first-arrival line of light and the idle shimmer) */
  glint: number[]
  /** the dive into one window: which, and how far (0..1); the glass runs to full gain */
  dive: { i: number; k: number } | null
  reduced: boolean
}
export const INTERESTS: Interest[] = interestsFrom((site as { bio: { offBoard: string } }).bio.offBoard)

const beamV = /* glsl */ `
attribute vec3 aAxis; attribute vec4 aBeam; attribute vec4 aCol; // x = length, y = width0, z = width1, w = seed; rgb + window
varying vec2 vUv; varying vec4 vCol; varying float vSeed;
void main() {
  vUv = uv; vSeed = aBeam.w; vCol = aCol;
  vec3 axisW = normalize(mat3(modelMatrix) * aAxis);
  vec3 o = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 c = o + axisW * aBeam.x * uv.x;
  vec3 lat = normalize(cross(axisW, cameraPosition - c));
  float wd = mix(aBeam.y, aBeam.z, uv.x);
  gl_Position = projectionMatrix * viewMatrix * vec4(c + lat * (uv.y - 0.5) * wd, 1.0);
}`
const beamF = /* glsl */ `
precision highp float;
uniform float uI, uTime, uK[5]; varying vec2 vUv; varying vec4 vCol; varying float vSeed;
float h(float x) { return fract(sin(x * 91.3 + vSeed * 17.0) * 43758.5); }
float vn(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h(i), h(i + 1.0), f); }
void main() {
  float across = 1.0 - abs(vUv.y - 0.5) * 2.0; across = pow(max(across, 0.0), 1.8);
  float along = smoothstep(0.0, 0.06, vUv.x) * pow(1.0 - vUv.x, 1.25);
  float flick = 0.74 + 0.26 * vn(vUv.x * 4.0 - uTime * 0.25 + vSeed * 9.0);
  float a = across * along * flick * uI * uK[int(vCol.w + 0.5)];
  gl_FragColor = vec4(vCol.rgb * a, a);
}`
const glassV = /* glsl */ `
attribute float aWin; varying vec2 vUv; varying float vW; varying vec3 vP;
void main() { vUv = uv; vW = aWin; vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`
const glassF = /* glsl */ `
precision highp float;
uniform sampler2D tGlass; uniform float uGain[5], uTime, uDissolve, uVis, uCopy; varying vec2 vUv; varying float vW; varying vec3 vP;
${LANE_GLSL}
float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y), mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main() {
  if (uDissolve < 0.995 && vn(vP * 2.6 + vec3(3.0, 1.0, 7.0)) * 0.8 + 0.18 * vn(vP * 13.0) >= uDissolve * 1.25 - 0.12) discard;
  vec2 uv = vec2((vW + vUv.x) / 5.0, vUv.y);
  vec3 c = texture2D(tGlass, uv).rgb;
  float g = uGain[int(vW + 0.5)];
  // sun behind the glass: the lower middle of each lancet burns a little warmer, and the light breathes
  float glow = 0.9 + 0.22 * (1.0 - abs(vUv.x - 0.5) * 1.6) * (1.0 - vUv.y * 0.6);
  float shimmer = 0.97 + 0.03 * sin(uTime * 0.7 + vW * 1.7 + vUv.y * 6.0);
  vec3 col = c * g * glow * shimmer * uVis;
  col *= 1.0 - 0.55 * uCopy * (1.0 - laneMask());
  gl_FragColor = vec4(col, 1.0);
}`
const DUST_V = /* glsl */ `
attribute vec4 aD; uniform float uTime, uI, uScale; varying float vA;
void main() {
  vec3 p = position + vec3(sin(uTime * 0.21 + aD.x * 6.28) * 0.5, sin(uTime * 0.17 + aD.y * 6.28) * 0.4 + uTime * 0.025 * aD.z, cos(uTime * 0.19 + aD.w * 6.28) * 0.5);
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vA = uI * (0.35 + 0.65 * fract(aD.x * 7.3 + uTime * 0.15));
  gl_PointSize = clamp(uScale * (0.5 + aD.z * 0.9) / -mv.z, 1.0, 5.0);
}`
const DUST_F = /* glsl */ `precision highp float; varying float vA; void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA; gl_FragColor = vec4(vec3(1.0, 0.82, 0.58) * a, a); }`
const SPILL_F = /* glsl */ `
precision highp float; uniform float uI, uOpen; uniform vec3 uCol; varying vec2 vUv;
void main() { float z = vUv.y; float w = (0.16 + 0.75 * z) * (0.35 + 0.65 * uOpen); float across = 1.0 - smoothstep(0.0, w, abs(vUv.x - 0.5) * 2.0);
  float len = pow(1.0 - z, 1.5) * smoothstep(0.0, 0.03, z); float a = across * across * len * uI * (0.15 + 0.85 * uOpen); gl_FragColor = vec4(uCol * a, a); }`
const FLOOD_F = /* glsl */ `
precision highp float; uniform float uA; uniform vec3 uCol; varying vec2 vUv;
void main() { vec2 d = vUv - 0.5; float r = length(d * vec2(1.35, 1.0)); float core = 1.0 - smoothstep(0.0, 0.62, r);
  float a = clamp(uA * (0.4 + 1.1 * core * core), 0.0, 1.0); gl_FragColor = vec4(uCol * a * 0.9, a); }`
const plainV = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'

function additive(frag: string, vert: string | null, uniforms: Record<string, THREE.IUniform>, side: THREE.Side = THREE.DoubleSide): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: vert ?? plainV, fragmentShader: frag, uniforms, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side })
}

export class HallRig {
  built = false
  readonly root = new THREE.Group()      // at HALL.at, yaw HALL.yaw; hall-local space
  readonly front = new THREE.Group()     // the facade, scaled and turned to the door
  readonly flood = { uA: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.72, 0.42) } }
  proxies: THREE.Mesh[] = []
  private shH!: Shared; private shD!: Shared; private hu!: HallUniforms
  private leafL!: THREE.Group; private leafR!: THREE.Group
  private bu = { uI: { value: 0 }, uTime: { value: 0 }, uK: { value: [0.4, 0.4, 0.4, 0.4, 0.4] } }
  private du = { uTime: { value: 0 }, uI: { value: 0 }, uScale: { value: 900 } }
  private hdu = { uTime: { value: 0 }, uI: { value: 0 }, uScale: { value: 900 } }
  /** drawing-buffer height in px (hall.ts keeps it current): sizes the dust motes */
  viewH = 900
  private doorB = { uI: { value: 0 }, uTime: { value: 0 }, uK: { value: [1, 1, 1, 1, 1] } }
  private su = { uI: { value: 0 }, uOpen: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.72, 0.42) } }
  private gu = { tGlass: { value: null as THREE.Texture | null }, uGain: { value: [1, 1, 1, 1, 1] }, uTime: { value: 0 }, uDissolve: { value: 0 }, uVis: { value: 1 }, uCopy: { value: 0 }, uLane: null as unknown as THREE.IUniform<THREE.Vector4>, uRes: null as unknown as THREE.IUniform<THREE.Vector2>, uLaneOn: null as unknown as THREE.IUniform<number> }
  private fSeam!: THREE.Mesh; private far!: FarDoors
  private doorBeams!: THREE.Mesh; private spill!: THREE.Mesh; private doorDust!: THREE.Points; private hallDust!: THREE.Points; private hallBeams!: THREE.Mesh; private floodQuad!: THREE.Mesh
  private tmp = new THREE.Vector3()
  private painter: ReturnType<typeof atlasPainter> | null = null
  private atlasTex: THREE.Texture | null = null
  private disposed = false
  glassState: 'procedural' | 'loading' | 'ready' | 'failed' = 'procedural'
  /** Same UV cells and shared uniform as the old atlas: hover, light projection,
   * reflections and the camera dive keep their original geometry and timing. */
  private loadGlass(renderer: THREE.WebGLRenderer) {
    if (new URLSearchParams(location.search).get('glass') === 'procedural') return
    this.glassState = 'loading'
    new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}media/hall/stained-glass-v2.webp`, texture => {
      if (this.disposed) { texture.dispose(); return }
      texture.colorSpace = THREE.NoColorSpace
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
      texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter
      const old = this.atlasTex
      this.atlasTex = texture; this.painter = null
      this.hu.tGlass.value = texture; this.gu.tGlass.value = texture
      old?.dispose(); this.glassState = 'ready'
    }, undefined, () => { this.glassState = 'failed' })
  }
  /** the stained glass is painted a few ms a frame after the room stands (its windows fill in one by one); true when every window is done */
  get glassDone() { return !this.painter }
  buildMs = 0
  /** the baked, photoreal hall (hall/photoreal.ts): null until it has loaded and compiled; the procedural shell stands in until then, and for good if it never arrives */
  photo: PhotorealRoom | null = null
  photoState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle'
  private stoneMesh: THREE.Mesh | null = null
  private sideMesh: THREE.Mesh | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private uploads: THREE.Texture[] = []
  get photoPending() { return this.uploads.length > 0 }
  /** frames left before the photoreal programs are checked (they are drawn a few frames first): a program that did not link would leave the room empty, so then the procedural stone comes back */
  private photoCheck = 0
  private checkPhoto() {
    const room = this.photo, r = this.renderer as unknown as { properties: { get(o: object): { currentProgram?: { diagnostics?: { runnable?: boolean } } } } } | null
    if (!room || !r) return
    const bad = room.materials.some(m => r.properties.get(m)?.currentProgram?.diagnostics?.runnable === false)
    if (!bad) return
    console.warn('[hall] a photoreal shader did not link: the procedural hall stays')
    room.group.visible = false
    if (this.stoneMesh) this.stoneMesh.visible = true
    if (this.sideMesh) this.sideMesh.scale.x = 1
    this.photoState = 'failed'
  }
  private async loadPhoto(env: HallEnv) {
    const mode = new URLSearchParams(location.search).get('hall')
    if (mode === 'capture' || mode === 'procedural') return
    this.photoState = 'loading'
    try {
      const room = await loadPhotoreal({ renderer: env.renderer, camera: env.camera, scene: env.scene }, this.shH, this.hu)
      if (!room) { this.photoState = 'failed'; return }
      room.group.name = 'hall-photoreal'
      this.root.add(room.group)
      this.root.updateMatrixWorld(true)
      void env.renderer.compileAsync(room.group, env.camera, env.scene).catch(() => {})
      // upload the textures one a frame (pump) instead of all at the first frame the room shows
      const seen = new Set<THREE.Texture>()
      for (const m of room.materials) for (const t of [m.map, m.lightMap]) if (t && !seen.has(t)) { seen.add(t); this.uploads.push(t) }
      this.photo = room
      this.photoState = 'ready'
      this.photoCheck = 6
      if (this.stoneMesh) this.stoneMesh.visible = false
      // the ornamental side panes (procedural glass) move into the recesses the baked walls have: 0.25 deep
      if (this.sideMesh) this.sideMesh.scale.x = (HHW + 0.25 - 0.02) / (HHW - 0.1)
    } catch (e) {
      console.warn('[hall] photoreal unavailable, procedural hall stays', e)
      this.photoState = 'failed'
    }
  }
  pump(budgetMs = 3) {
    if (this.uploads.length && this.renderer && !this.painter) {
      const t = this.uploads.shift()!
      try { this.renderer.initTexture(t) } catch { /* ignore: it uploads at first use */ }
    }
    const p = this.painter
    if (!p) return
    const t0 = performance.now()
    while (performance.now() - t0 < budgetMs) {
      const r = p.gen.next()
      if (r.done) { this.painter = null; if (this.atlasTex) this.atlasTex.needsUpdate = true; return }
      if (r.value === 1 && this.atlasTex) this.atlasTex.needsUpdate = true // the first two windows show early; the rest land with the last upload
    }
  }
  /** white-ish world position of window i's light (a little in front of the glass) */
  readonly winWorld: THREE.Vector3[] = []
  private winCol: THREE.Color[] = []

  /** hall-local -> world */
  toWorld(lx: number, y: number, d: number, out = new THREE.Vector3()): THREE.Vector3 { return out.set(lx, y, d).applyMatrix4(this.root.matrixWorld) }
  toLocal(v: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 { return out.copy(v).applyMatrix4(new THREE.Matrix4().copy(this.root.matrixWorld).invert()) }

  build(env: HallEnv) {
    if (this.built) return
    this.built = true
    const t0 = performance.now()
    const e = env as unknown as Env
    this.shH = makeShared(e); this.shD = makeShared(e)
    this.shD.uTymC.value.set(0, 2.9 + 0.95); this.shD.uWarmCol.value.set(1.0, 0.72, 0.42)
    this.shH.uWarmCol.value.set(1.0, 0.78, 0.5)
    this.hu = makeHallUniforms()
    const painter = atlasPainter(); this.painter = painter
    const atlas = new THREE.CanvasTexture(painter.canvas); atlas.colorSpace = THREE.NoColorSpace; atlas.generateMipmaps = true; atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.anisotropy = Math.min(8, env.renderer.capabilities.getMaxAnisotropy()); atlas.needsUpdate = true
    this.atlasTex = atlas; this.hu.tGlass.value = atlas; this.gu.tGlass.value = atlas
    this.gu.uLane = this.shH.uLane; this.gu.uRes = this.shH.uRes; this.gu.uLaneOn = this.shH.uLaneOn; this.gu.uCopy = this.shH.uCopy as unknown as { value: number }
    INTERESTS.forEach((it, i) => { this.hu.uWinCol.value[i].setRGB(it.light[0], it.light[1], it.light[2]); this.winCol.push(this.hu.uWinCol.value[i].clone()) })
    this.hu.uGain.value = this.gu.uGain.value // one array: the shader of the glass and the floor read the same gains

    const mat = hallMaterial(this.shH, this.hu, { tint: 0x6a6762 }) // w11: the stone ~25% darker (black ground, light-built forms)
    const glassMat = new THREE.ShaderMaterial({ vertexShader: glassV, fragmentShader: glassF, uniforms: this.gu as unknown as Record<string, THREE.IUniform>, side: THREE.DoubleSide })
    const sideMat = hallMaterial(this.shH, this.hu, { side: THREE.DoubleSide })
    const sh = buildShell(mat, glassMat, sideMat)
    this.stoneMesh = sh.stone; this.sideMesh = sh.side; this.renderer = env.renderer
    this.root.add(sh.stone, sh.glass, sh.side, ...sh.proxies)
    this.proxies = sh.proxies
    this.root.position.set(HALL.at[0], HALL.at[1], HALL.at[2]); this.root.rotation.y = HALL.yaw
    this.root.name = 'hall'; this.root.userData.noReflect = true

    // ---- the front: scaled, turned to the door, its inner face on the door plane
    const f = buildFacade(this.shD)
    this.leafL = f.leafL; this.leafR = f.leafR
    this.front.add(f.stone, f.steps, f.glow, f.leafL, f.leafR)
    // turned by PI the front maps its z to -d: its inner face (z = WALL_BACK) lands at d = -WALL_BACK K, so slide it back by that much to put the face on the door plane
    this.front.scale.setScalar(FACADE_K); this.front.rotation.y = Math.PI; this.front.position.set(0, 0, WALL_BACK * FACADE_K)
    this.front.name = 'hall-front'
    this.root.add(this.front)
    // the gate dwell: the leaves stand shut and a thin warm seam of light runs between them (it fades as they part)
    this.fSeam = new THREE.Mesh(new THREE.PlaneGeometry(0.8, FYS - 0.2), seamMaterial([1.0, 0.72, 0.42])); this.fSeam.geometry.translate(0, (FYS - 0.2) / 2, 0)
    this.fSeam.position.set(0, 0, -0.3); this.fSeam.renderOrder = 6; this.fSeam.frustumCulled = false
    this.front.add(this.fSeam)
    // the far doors in the end wall (closed at the hall dwell, open for the exit piece)
    this.far = new FarDoors(this.shH, this.hu); this.root.add(this.far.group)
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(13, 9), new THREE.MeshBasicMaterial({ map: gradTexture('radial', 128), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }))
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -0.72, 1.0); shadow.renderOrder = -2
    this.front.add(shadow)

    // ---- light out of the doorway: a fan of shafts, the spill on the steps, dust
    {
      const N = 9, pos: number[] = [], uv: number[] = [], ax: number[] = [], bm: number[] = [], cl: number[] = [], idx: number[] = []
      for (let i = 0; i < N; i++) {
        const yaw = (i / (N - 1) - 0.5) * 1.0, pitch = -0.04 - 0.1 * Math.abs(yaw) - 0.05 * ((i * 7) % 3), len = 7.5 + (i % 3) * 1.4
        const a = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)], b0 = pos.length / 3
        for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { pos.push(0, 1.8, -0.9); uv.push(x, y); ax.push(a[0], a[1], a[2]); bm.push(len * FACADE_K, (0.25 + 0.15 * (i % 2)) * FACADE_K, (1.4 + 0.5 * Math.abs(yaw)) * FACADE_K, i + 0.37); cl.push(1.0, 0.7, 0.4, 0) }
        idx.push(b0, b0 + 1, b0 + 2, b0 + 2, b0 + 1, b0 + 3)
      }
      const bg = new THREE.BufferGeometry()
      bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      bg.setAttribute('aAxis', new THREE.Float32BufferAttribute(ax, 3)); bg.setAttribute('aBeam', new THREE.Float32BufferAttribute(bm, 4)); bg.setAttribute('aCol', new THREE.Float32BufferAttribute(cl, 4)); bg.setIndex(idx)
      bg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 4), 60)
      this.doorBeams = new THREE.Mesh(bg, additive(beamF, beamV, this.doorB as unknown as Record<string, THREE.IUniform>)); this.doorBeams.frustumCulled = false; this.doorBeams.renderOrder = 6
      this.front.add(this.doorBeams)
      const sp = new THREE.PlaneGeometry(2, 9)
      sp.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, 0.03, 4.0))
      const suv = sp.getAttribute('uv') as THREE.BufferAttribute; for (let i = 0; i < suv.count; i++) suv.setY(i, 1 - suv.getY(i))
      this.spill = new THREE.Mesh(sp, additive(SPILL_F, null, this.su as unknown as Record<string, THREE.IUniform>)); this.spill.renderOrder = 5; this.spill.frustumCulled = false
      this.front.add(this.spill)
      const nD = env.q.dust ? 160 : 0, dp = new Float32Array(nD * 3), dd = new Float32Array(nD * 4)
      for (let i = 0; i < nD; i++) { dp[i * 3] = (Math.random() - 0.5) * 3.6; dp[i * 3 + 1] = 0.3 + Math.random() * 3.6; dp[i * 3 + 2] = -0.8 + Math.random() * 6.5; for (let c = 0; c < 4; c++) dd[i * 4 + c] = Math.random() }
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('aD', new THREE.BufferAttribute(dd, 4)); dg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 2.5), 30)
      this.doorDust = new THREE.Points(dg, additive(DUST_F, DUST_V, this.du as unknown as Record<string, THREE.IUniform>)); this.doorDust.frustumCulled = false; this.doorDust.renderOrder = 7
      this.front.add(this.doorDust)
    }
    // ---- light in the nave: a long coloured shaft from each window, dust in it
    {
      const pos: number[] = [], uv: number[] = [], ax: number[] = [], bm: number[] = [], cl: number[] = [], idx: number[] = []
      for (let i = 0; i < 5; i++) {
        const c = INTERESTS[i].light, xc = hallStopX(i)
        for (let r = 0; r < 3; r++) {
          const off = (r - 1) * 0.5, a = new THREE.Vector3(0.1 - 0.02 * r, -0.5 - 0.05 * r, -0.86).normalize(), b0 = pos.length / 3
          for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            pos.push(xc + off, WIN.sill + WIN.h * (0.38 + 0.2 * r), HL - 0.7); uv.push(x, y); ax.push(a.x, a.y, a.z)
            bm.push(28 - r * 3, 1.2 + 0.4 * r, 3.6 + 0.8 * r, i * 3 + r + 0.4); cl.push(c[0], c[1], c[2], i)
          }
          idx.push(b0, b0 + 1, b0 + 2, b0 + 2, b0 + 1, b0 + 3)
        }
      }
      const bg = new THREE.BufferGeometry()
      bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      bg.setAttribute('aAxis', new THREE.Float32BufferAttribute(ax, 3)); bg.setAttribute('aBeam', new THREE.Float32BufferAttribute(bm, 4)); bg.setAttribute('aCol', new THREE.Float32BufferAttribute(cl, 4)); bg.setIndex(idx)
      bg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 6, HL / 2), 60)
      this.hallBeams = new THREE.Mesh(bg, additive(beamF, beamV, this.bu as unknown as Record<string, THREE.IUniform>)); this.hallBeams.frustumCulled = false; this.hallBeams.renderOrder = 6
      this.root.add(this.hallBeams)
      const nD = env.q.dust ? 260 : 0, dp = new Float32Array(nD * 3), dd = new Float32Array(nD * 4)
      for (let i = 0; i < nD; i++) { dp[i * 3] = (Math.random() - 0.5) * 2 * (HHW - 1); dp[i * 3 + 1] = 0.6 + Math.random() * 11; dp[i * 3 + 2] = 3 + Math.random() * (HL - 5); for (let c = 0; c < 4; c++) dd[i * 4 + c] = Math.random() }
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('aD', new THREE.BufferAttribute(dd, 4)); dg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 6, HL / 2), 60)
      this.hallDust = new THREE.Points(dg, additive(DUST_F, DUST_V, this.hdu as unknown as Record<string, THREE.IUniform>)); this.hallDust.frustumCulled = false; this.hallDust.renderOrder = 7
      this.root.add(this.hallDust)
    }
    // ---- the doorway's warm bloom: a soft radial over the frame, only for the moment the camera crosses the threshold (never a white-out, never black)
    this.floodQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), additive(FLOOD_F, 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', this.flood as unknown as Record<string, THREE.IUniform>, THREE.FrontSide))
    ;(this.floodQuad.material as THREE.ShaderMaterial).depthTest = false; this.floodQuad.renderOrder = 100; this.floodQuad.frustumCulled = false; this.floodQuad.userData.noReflect = true
    this.floodQuad.visible = false
    env.scene.add(this.root, this.floodQuad)
    this.root.visible = false
    this.root.updateMatrixWorld(true)
    for (let i = 0; i < 5; i++) this.winWorld.push(this.toWorld(hallStopX(i), WIN.sill + WIN.h * 0.5, HL - 2.2))
    precompile(e, this.root, this.floodQuad)
    this.buildMs = performance.now() - t0
    this.loadGlass(env.renderer)
    void this.loadPhoto(env)
  }

  /** the room at this frame. `cam` is the live camera (hall-local position feeds the floor's mirror). */
  frame(f: HallFrame, cam: THREE.Vector3) {
    if (!this.built) return
    const vis = f.hallIn > 0.002 || f.facadeIn > 0.002
    this.root.visible = vis
    if (!vis) { this.floodQuad.visible = this.flood.uA.value > 0.003; return }
    const { shH, shD, hu } = this
    shH.uDissolve.value = f.hallIn; shD.uDissolve.value = f.facadeIn
    shH.uTime.value = shD.uTime.value = f.t
    shH.uCopy.value = f.copy * 0.8; shD.uCopy.value = f.copy
    // ---- the hinges: closed-form damped springs of the leg's progress, the right leaf a beat late; with no leg the doors stand open
    const A = 1.5
    let aL = A, aR = A, open = 1
    if (f.u != null) {
      const u = f.u
      aL = Math.min(1.78, A * springResp(Math.max(0, u - 0.1), 10.5, 0.5)); aR = Math.min(1.78, A * springResp(Math.max(0, u - 0.12), 11.5, 0.55))
      open = clamp01(0.5 * (aL + aR) / A)
    }
    this.leafL.rotation.y = aL; this.leafR.rotation.y = -aR
    // ---- light at the doorway (the passage glows as the leaves part, the light spills out onto the steps, then it is behind you)
    const u = f.u ?? 1
    const pulse = sstep(0.4, 0.47, u) * (1 - sstep(0.55, 0.65, u))
    const outside = f.u == null ? 0 : (1 - sstep(0.52, 0.64, u))
    shD.uWarm.value = (0.04 + 0.9 * sstep(0.1, 0.4, u) * (0.4 + 0.6 * open)) * (1 + 0.5 * pulse)
    shD.uAmb.value = 0.8; shD.uMoon.value = 3.0; shD.uGlow.value = 0.35 + 1.3 * sstep(0.1, 0.5, u)
    shD.uLightPos.value.copy(this.front.localToWorld(this.tmp.set(0, 1.9, -1.4)))
    shD.uLight2Pos.value.copy(shD.uLightPos.value)
    this.doorB.uI.value = 1.1 * open * outside * (0.85 + 0.15 * Math.sin(f.t * 0.9)); this.doorB.uTime.value = f.t
    this.su.uI.value = 1.3 * open * outside; this.su.uOpen.value = open
    this.du.uTime.value = f.reduced ? 0 : f.t; this.du.uI.value = 0.9 * Math.max(open * outside, f.hallIn * 0.5)
    this.du.uScale.value = this.viewH * 0.9; this.hdu.uScale.value = this.viewH * 0.9
    this.doorBeams.visible = this.spill.visible = this.doorDust.visible = outside > 0.01
    // ---- the room: coloured window lights. Only the window that is lit (hovered, travelled by the glint, or being dived into) throws a strong coloured shaft and
    // floor patch; the other four stay at about 35%.
    const lit = f.hallIn, dv = f.dive
    for (let i = 0; i < 5; i++) {
      const h = f.hover[i] ?? 0, a = f.active[i] ?? 0, gl = f.glint[i] ?? 0, dk = dv && dv.i === i ? dv.k : 0
      const s = Math.max(h, a, 0.55 * gl, dk)
      hu.uWinPos.value[i].copy(this.winWorld[i])
      hu.uWinI.value[i] = (0.28 + 0.8 * s + 0.5 * dk) * lit
      if (this.photo) this.photo.uniforms.uWinX.value[i] = (0.8 * s + 0.5 * dk) * lit       // the baked stone already carries the 0.28: only the lift is added
      hu.uSunK.value[i] = 0.35 + 0.65 * s
      this.bu.uK.value[i] = (0.35 + 0.65 * s) * 1.45
      this.gu.uGain.value[i] = 1.3 + 0.55 * h + 0.3 * a + 0.45 * gl + 1.4 * dk
    }
    this.far.frame(f.exit)
    // the gate dwell's seam of warm light between the shut leaves
    {
      const uu = f.u ?? 1
      ;(this.fSeam.material as THREE.ShaderMaterial).uniforms.uI.value = (f.u == null ? 0 : 0.95 * (1 - sstep(0.0, 0.35, open)) * (1 - sstep(0.1, 0.2, uu)) * (0.9 + 0.1 * Math.sin(f.t * 1.7)))
    }
    this.gu.uTime.value = f.reduced ? 0 : f.t; this.gu.uDissolve.value = f.hallIn
    this.bu.uI.value = 1.1 * lit; this.bu.uTime.value = f.reduced ? 0 : f.t
    hu.uHallLit.value = 1.0
    hu.uProj.value = 0.9 * lit
    this.toLocal(cam, hu.uCamL.value)
    shH.uWarm.value = 0.5 * lit; shH.uWarm2.value = 0.45 * lit; shH.uGlow.value = 1.6; shH.uAmb.value = 0.2; shH.uMoon.value = 0.22
    this.toWorld(0, 3.4, 8, shH.uLightPos.value); this.toWorld(0, 3.4, 22, shH.uLight2Pos.value)
    this.hallBeams.visible = this.hallDust.visible = f.hallIn > 0.05
    this.floodQuad.visible = this.flood.uA.value > 0.003
    this.hdu.uTime.value = f.reduced ? 0 : f.t; this.hdu.uI.value = 0.8 * lit
    if (this.photoCheck > 0 && this.root.visible && --this.photoCheck === 0) this.checkPhoto()
  }
  dispose() { this.disposed = true; this.root.removeFromParent(); this.floodQuad.removeFromParent(); this.photo?.dispose(); this.atlasTex?.dispose() }
}
let rig: HallRig | null = null
export const getRig = () => (rig ??= new HallRig())
