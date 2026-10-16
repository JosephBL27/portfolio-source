// The hero device: a real-time spherical "space-helmet" television, hung from a short chain,
// sitting on a round pedestal. Procedural three.js on its own WebGLRenderer (alpha canvas).
// The screen plays the current reel: reel.frag renders into a 960x720 target, the CRT shader
// (./crt.ts) puts it on a bulged glass face, and a 3x1 downsample of the target is read back
// ~6x/s to tint three point lights in front of the glass: the screen is the light source.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { ReelDef } from '../reels/types'
import { state } from '../state'
import { bus } from '../bus'
import { createCRTMaterial, type CRTMaterial } from './crt'

export interface TV {
  setChannel(i: number, opts?: { instant?: boolean }): void
  next(): void
  prev(): void
  channel(): number
  /** projected picture bounds in viewport px (same space as getBoundingClientRect) */
  screenRect(): DOMRect
  setNight(n: boolean): void
  setPaused(p: boolean): void
  /** 0..1 progress through the work section, for subtle camera/tilt */
  setScroll(p: number): void
  /** test hook: live pose + projected hot-spot positions in viewport px */
  debug(): TVDebug
  /** test hook: viewport px of the point at local angle `a` on the dial's face */
  dialRing(a: number): { x: number; y: number }
  dispose(): void
}
export interface TVDebug {
  cur: number; frames: number; why: string; yaw: number; pitch: number; dialK: number; dial: number; pressA: number; pressB: number
  dragging: string | null; changeT: number; powerT: number; osdT: number; flash: number; night: number
  pts: Record<'dial' | 'btnA' | 'btnB' | 'screen' | 'body' | 'ring', { x: number; y: number }>
  cursor: string
  raw: number
}

export const TAU = Math.PI * 2
const RT_W = 960, RT_H = 720
export const OPEN = THREE.MathUtils.degToRad(56)         // visor opening, angular radius
export const LIP_Z = Math.cos(OPEN), LIP_R = Math.sin(OPEN)
export const VIS_R = 0.768, VIS_Z = 0.548, SAG = 0.072   // bulged glass face
export const PIC_W = 0.64, PIC_H = PIC_W * 0.75          // picture half extents (4:3)
export const PIVOT_Y = 1.42                               // top ring, the pendulum pivot
const FLOOR_Y = -1.66
const HERO = { yaw: -0.4, pitch: 0.0 }
const CHANGE_MS = 350, POWER_MS = 1150
const DAY_SHELL = new THREE.Color('#F2F0EA'), NIGHT_SHELL = new THREE.Color('#0A0B0C')
const DAY_DOT = new THREE.Color('#141414'), NIGHT_DOT = new THREE.Color('#5B5E63')

class Spring {
  v = 0
  target: number
  constructor(public x: number, public k: number, public c: number) { this.target = x }
  step(dt: number) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n
    for (let i = 0; i < n; i++) { const a = -this.k * (this.x - this.target) - this.c * this.v; this.v += a * h; this.x += this.v * h }
  }
  get busy() { return Math.abs(this.v) > 3e-4 || Math.abs(this.x - this.target) > 3e-4 }
  snap(x = this.target) { this.x = x; this.target = x; this.v = 0 }
}

const mod = (a: number, n: number) => ((a % n) + n) % n
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = THREE.MathUtils.clamp
const ZERO2 = new THREE.Vector2()

// ---------- geometry helpers ----------
export function bulgedDisc(R: number, sag: number, rings = 40, segs = 144) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = []
  const n = new THREE.Vector3()
  for (let i = 0; i <= rings; i++) {
    const r = (i / rings) * R
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * TAU, x = Math.cos(a) * r, y = Math.sin(a) * r
      pos.push(x, y, sag * (1 - (r * r) / (R * R)))
      n.set((2 * sag * x) / (R * R), (2 * sag * y) / (R * R), 1).normalize()
      nor.push(n.x, n.y, n.z)
      uv.push(x / (2 * R) + 0.5, y / (2 * R) + 0.5)
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = i * (segs + 1) + j, b = a + segs + 1
    idx.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}
/** lathe around the local Z axis from [radius, z] pairs */
export function latheZ(pts: [number, number][], segs = 96) {
  return new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), segs).rotateX(Math.PI / 2)
}
export function cylZ(r0: number, r1: number, h: number, segs = 64) {
  return new THREE.CylinderGeometry(r1, r0, h, segs).rotateX(Math.PI / 2)
}
export function knurl(r: number, h: number, ridges: number) {
  const g = new THREE.CylinderGeometry(r, r, h, ridges * 6, 1)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), rr = Math.hypot(x, z)
    if (rr < r * 0.98) continue
    const w = Math.cos(Math.atan2(z, x) * ridges)
    const k = 1 + 0.05 * Math.sign(w) * Math.pow(Math.abs(w), 0.55)
    p.setX(i, x * k); p.setZ(i, z * k)
  }
  g.computeVertexNormals()
  return g.rotateX(Math.PI / 2)
}
/** a frame on the unit sphere: Z = outward normal, Y = toward world up */
export function frameAt(dir: THREE.Vector3) {
  const z = dir.clone().normalize()
  const y = new THREE.Vector3(0, 1, 0).addScaledVector(z, -z.y).normalize()
  const x = new THREE.Vector3().crossVectors(y, z)
  return { x, y, z, m: new THREE.Matrix4().makeBasis(x, y, z) }
}
export function radialTexture(stops: [number, string][]) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  for (const [o, col] of stops) gr.addColorStop(o, col)
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

export const REEL_VERT = `precision highp float;
attribute vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`

export function createTV(canvas: HTMLCanvasElement, opts: { reels: ReelDef[]; onChannel?(i: number): void; onOpen?(i: number): void }): TV {
  const reels = opts.reels.length ? opts.reels : []
  const N = Math.max(1, reels.length)
  const STEP = TAU / N

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  // RoomEnvironment plus three softboxes; the night version darkens the room so gloss black stays black
  function makeEnv(dark: boolean) {
    const room = new RoomEnvironment()
    if (dark) room.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) (m.material as THREE.MeshStandardMaterial).color.setScalar(0.035) })
    const box = (w: number, h: number, x: number, y: number, z: number, k: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(k), side: THREE.DoubleSide }))
      m.position.set(x, y + 3.5, z); room.add(m); m.lookAt(0, 0, 0)
    }
    box(5.5, 3.2, -5.2, 4.6, 6.2, dark ? 7 : 5)
    box(0.9, 7.5, 6.2, 0.6, 4.4, dark ? 9 : 5)
    box(0.6, 7.0, -7.4, 0.4, -3.2, dark ? 6 : 3)
    box(4.0, 4.0, 0, 9.5, 0.5, dark ? 1.6 : 1.2)
    const t = pmrem.fromScene(room, 0.03).texture
    room.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose() } })
    return t
  }
  const envDay = makeEnv(false), envNight = makeEnv(true)
  scene.environment = state.night ? envNight : envDay

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 60)

  // ---------- reel pipeline ----------
  const reelRT = new THREE.WebGLRenderTarget(RT_W, RT_H, {
    depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
  })
  const reelU = {
    uTime: { value: 0 }, uRes: { value: new THREE.Vector2(RT_W, RT_H) }, uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uNight: { value: state.night ? 1 : 0 }, uSeed: { value: Math.random() }, uIntensity: { value: 1 },
  }
  const quad = new THREE.PlaneGeometry(2, 2)
  const reelMats = reels.map(r => new THREE.RawShaderMaterial({ vertexShader: REEL_VERT, fragmentShader: r.frag, uniforms: reelU, depthTest: false, depthWrite: false }))
  const reelQuad = new THREE.Mesh(quad, reelMats[0] ?? new THREE.MeshBasicMaterial({ color: 0x111111 }))
  reelQuad.frustumCulled = false
  const reelScene = new THREE.Scene(); reelScene.add(reelQuad)
  const flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  // precompile every channel in the background so a channel change never hitches
  if (reelMats.length > 1) {
    const pre = new THREE.Scene()
    reelMats.slice(1).forEach(m => { const q = new THREE.Mesh(quad, m); q.frustumCulled = false; pre.add(q) })
    renderer.compileAsync(pre, flatCam).catch(() => {})
  }

  // 3x1 average for the screen lights
  const tinyRT = new THREE.WebGLRenderTarget(3, 1, { depthBuffer: false })
  const tinyMat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: reelRT.texture } },
    vertexShader: `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D uTex; void main() { vec2 uv = vec2(gl_FragCoord.x / 3.0, 0.5); gl_FragColor = vec4(textureLod(uTex, uv, 7.0).rgb, 1.0); }`,
    depthTest: false, depthWrite: false,
  })
  const tinyQuad = new THREE.Mesh(quad, tinyMat); tinyQuad.frustumCulled = false
  const tinyScene = new THREE.Scene(); tinyScene.add(tinyQuad)
  const tinyBuf = new Uint8Array(12)
  let readPending = false, lastRead = -1e9
  const lightTarget = [new THREE.Color(), new THREE.Color(), new THREE.Color()]
  const lightCol = [new THREE.Color(), new THREE.Color(), new THREE.Color()]
  const avgCol = new THREE.Color()

  // on-screen display (channel banner top, hover hint bottom)
  const osdCanvas = document.createElement('canvas'); osdCanvas.width = RT_W; osdCanvas.height = RT_H
  const osdTex = new THREE.CanvasTexture(osdCanvas)
  const osdFont = '"IBM Plex Mono", ui-monospace, Menlo, monospace'
  function drawOSD() {
    const g = osdCanvas.getContext('2d')!
    g.clearRect(0, 0, RT_W, RT_H)
    g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowOffsetX = 5; g.shadowOffsetY = 5; g.shadowBlur = 0
    g.fillStyle = '#F4F1E8'; g.textBaseline = 'alphabetic'; g.textAlign = 'left'
    g.font = `600 34px ${osdFont}`
    g.fillText('CH', 92, 128)
    g.font = `600 108px ${osdFont}`
    g.fillText(String(cur + 1).padStart(2, '0'), 152, 168)
    const r = reels[cur]
    if (r) { g.font = `500 32px ${osdFont}`; g.fillText(r.title.toUpperCase(), 96, 222) }
    g.textAlign = 'right'; g.font = `600 36px ${osdFont}`
    g.fillText('OPEN ↗', RT_W - 92, RT_H - 96)
    osdTex.needsUpdate = true
  }

  // ---------- materials ----------
  const shellMat = new THREE.MeshPhysicalMaterial({ color: DAY_SHELL.clone(), roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1 })
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f5, metalness: 1, roughness: 0.12, envMapIntensity: 1.3 })
  const satin = new THREE.MeshPhysicalMaterial({ color: 0xd2d5d9, metalness: 1, roughness: 0.3, envMapIntensity: 1.1 })
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0d, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 })
  const accent = new THREE.MeshPhysicalMaterial({ color: '#E8472D', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 })
  const dotMat = new THREE.MeshPhysicalMaterial({ color: DAY_DOT.clone(), roughness: 0.55, metalness: 0.2 })
  const tickOff = new THREE.MeshBasicMaterial({ color: '#2B2D30' })
  const tickOn = new THREE.MeshBasicMaterial({ color: '#FF6A4D' })
  const ledMat = new THREE.MeshBasicMaterial({ color: '#4CC38A' })

  // ---------- the set ----------
  const pivot = new THREE.Group(); pivot.position.y = PIVOT_Y
  const hang = new THREE.Group(); hang.position.y = -PIVOT_Y
  const spin = new THREE.Group(); spin.rotation.order = 'YXZ'
  const model = new THREE.Group()
  scene.add(pivot); pivot.add(hang); hang.add(spin); spin.add(model)
  const pickables: THREE.Object3D[] = []
  const tag = <T extends THREE.Object3D>(o: T, hit: string) => { o.userData.hit = hit; pickables.push(o); return o }

  // shell with the visor opening facing +Z
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 112, 0, TAU, OPEN, Math.PI - OPEN).rotateX(Math.PI / 2), shellMat)
  model.add(shell)
  const proxy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20, 0, TAU, OPEN, Math.PI - OPEN).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial())
  proxy.visible = false; model.add(tag(proxy, 'body'))

  // chrome bezel: a stepped lens-barrel ring that stands proud of the lip
  const bezel = new THREE.Mesh(latheZ([
    [VIS_R - 0.02, VIS_Z - 0.03], [VIS_R + 0.002, VIS_Z + 0.004], [VIS_R + 0.006, VIS_Z + 0.05],
    [VIS_R + 0.013, VIS_Z + 0.079], [VIS_R + 0.028, VIS_Z + 0.093], [LIP_R - 0.012, VIS_Z + 0.096],
    [LIP_R + 0.006, VIS_Z + 0.085], [LIP_R + 0.015, VIS_Z + 0.062], [LIP_R + 0.017, LIP_Z - 0.03], [LIP_R + 0.002, LIP_Z - 0.07],
  ], 160), chrome)
  bezel.material = chrome; (bezel.material as THREE.Material).side = THREE.DoubleSide
  model.add(tag(bezel, 'body'))
  // dark inner gasket between bezel and glass
  const gasket = new THREE.Mesh(new THREE.TorusGeometry(VIS_R + 0.004, 0.009, 10, 160), gloss)
  gasket.position.z = VIS_Z + 0.006; model.add(gasket)

  // CRT face
  const crt: CRTMaterial = createCRTMaterial({ tex: reelRT.texture, osd: osdTex, pic: new THREE.Vector2(PIC_W / (2 * VIS_R), PIC_H / (2 * VIS_R)) })
  const screen = new THREE.Mesh(bulgedDisc(VIS_R + 0.006, SAG), crt)
  screen.position.z = VIS_Z
  model.add(tag(screen, 'screen'))

  // screen lights: in front of the glass, tinted from the picture
  const screenLights = [new THREE.PointLight(0xffffff, 0, 5, 2), new THREE.PointLight(0xffffff, 0, 5, 2), new THREE.PointLight(0xffffff, 0, 5, 2)]
  screenLights[0].position.set(-0.42, 0.06, 1.0)
  screenLights[1].position.set(0.0, -0.12, 1.06)
  screenLights[2].position.set(0.42, 0.06, 1.0)
  screenLights.forEach(l => model.add(l))

  // control side: dial, two push buttons, a power LED, the halftone speaker grille
  const D1 = new THREE.Vector3(0.86, 0.36, 0.3).normalize()
  const f1 = frameAt(D1)
  const onSphere = (du: number, dv: number) => D1.clone().addScaledVector(f1.x, du).addScaledVector(f1.y, dv).normalize()
  const dial = new THREE.Group()
  dial.position.copy(D1).multiplyScalar(0.986); dial.quaternion.setFromRotationMatrix(f1.m)
  model.add(dial)
  const esc = new THREE.Mesh(latheZ([[0, 0.024], [0.165, 0.024], [0.18, 0.018], [0.187, 0.004], [0.188, -0.05]], 96), satin)
  dial.add(tag(esc, 'dial'))
  const ticks: THREE.Mesh[] = []
  const tickGeo = cylZ(0.013, 0.013, 0.008, 20)
  for (let k = 0; k < N; k++) {
    const t = new THREE.Mesh(tickGeo, tickOff)
    const a = Math.PI / 2 - k * STEP
    t.position.set(Math.cos(a) * 0.152, Math.sin(a) * 0.152, 0.026)
    dial.add(t); ticks.push(t)
  }
  const knob = new THREE.Group(); knob.position.z = 0.024; dial.add(knob)
  const flange = new THREE.Mesh(cylZ(0.124, 0.12, 0.016), chrome); flange.position.z = 0.008
  const knurled = new THREE.Mesh(knurl(0.1, 0.072, 30), chrome); knurled.position.z = 0.016 + 0.036
  const cap = new THREE.Mesh(latheZ([[0, 0.094], [0.06, 0.092], [0.084, 0.088], [0.091, 0.082], [0.093, 0.0]], 64), gloss)
  cap.position.z = 0.0
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.066, 0.006), accent); pointer.position.set(0, 0.047, 0.095)
  knob.add(flange, knurled, cap, pointer)
  for (const m of [flange, knurled, cap, pointer]) tag(m, 'dial')

  const makeButton = (dir: THREE.Vector3, mat: THREE.Material, hit: string) => {
    const f = frameAt(dir)
    const g = new THREE.Group(); g.position.copy(dir).multiplyScalar(0.992); g.quaternion.setFromRotationMatrix(f.m)
    const collar = new THREE.Mesh(latheZ([[0.03, 0.012], [0.042, 0.016], [0.05, 0.012], [0.054, 0.0], [0.054, -0.03]], 48), satin)
    const travel = new THREE.Group()
    const capB = new THREE.Mesh(latheZ([[0, 0.044], [0.022, 0.043], [0.03, 0.039], [0.033, 0.03], [0.033, -0.01]], 48), mat)
    // generous invisible target: the visible cap is only ~10 px wide at hero scale
    const pad = new THREE.Mesh(cylZ(0.064, 0.064, 0.11, 20), new THREE.MeshBasicMaterial()); pad.visible = false
    travel.add(capB); g.add(collar, travel, pad); model.add(g)
    tag(collar, hit); tag(capB, hit); tag(pad, hit)
    return travel
  }
  const btnA = makeButton(onSphere(-0.07, -0.27), gloss, 'btnA')
  const btnB = makeButton(onSphere(0.065, -0.27), accent, 'btnB')
  const ledDir = onSphere(-0.005, -0.385)
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), ledMat)
  led.position.copy(ledDir).multiplyScalar(1.002); model.add(led)
  const ledRing = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 8, 24), satin)
  ledRing.position.copy(ledDir).multiplyScalar(1.0); ledRing.quaternion.setFromRotationMatrix(frameAt(ledDir).m); model.add(ledRing)

  // halftone grille: dots shrink from the centre outward, the page's halftone language in metal
  {
    const G = onSphere(0.0, -0.7)
    const fg = frameAt(G)
    const Rg = 0.25, sp = 0.031
    const dots: THREE.Matrix4[] = []
    const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
    for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) {
      const u = (i + (j & 1) * 0.5) * sp, v = j * sp * 0.866
      const d = Math.hypot(u, v)
      if (d > Rg) continue
      const t = 1 - d / Rg
      const rad = 0.0125 * (0.22 + 0.78 * Math.pow(t, 0.7))
      p.copy(G).addScaledVector(fg.x, u).addScaledVector(fg.y, v).normalize()
      q.setFromRotationMatrix(frameAt(p).m)
      s.set(rad, rad, 0.014)
      dots.push(new THREE.Matrix4().compose(p.clone().multiplyScalar(0.999), q.clone(), s.clone()))
    }
    const grille = new THREE.InstancedMesh(cylZ(1, 1, 1, 14), dotMat, dots.length)
    dots.forEach((m, i) => grille.setMatrixAt(i, m))
    grille.instanceMatrix.needsUpdate = true
    model.add(grille)
  }

  // pedestal
  const base = new THREE.Mesh(new THREE.LatheGeometry([
    [0.0, -1.39], [0.4, -1.39], [0.47, -1.383], [0.515, -1.366], [0.532, -1.34], [0.524, -1.314], [0.49, -1.296],
    [0.38, -1.276], [0.25, -1.249], [0.18, -1.21], [0.152, -1.15], [0.146, -1.05], [0.146, -0.94],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 128), shellMat)
  model.add(tag(base, 'body'))
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.158, 0.02, 16, 96), chrome)
  collarRing.rotation.x = Math.PI / 2; collarRing.position.y = -0.986; model.add(collarRing)
  const footRing = new THREE.Mesh(new THREE.TorusGeometry(0.527, 0.007, 10, 128), chrome)
  footRing.rotation.x = Math.PI / 2; footRing.position.y = -1.34; model.add(footRing)

  // chain: two runs of interlocked links from shell eyelets up to a top ring
  {
    const linkGeo = new THREE.TorusGeometry(0.03, 0.0078, 12, 32).scale(1.55, 1, 1)
    const ringTop = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.016, 20, 72), chrome)
    ringTop.position.y = PIVOT_Y; model.add(tag(ringTop, 'body'))
    for (const sx of [-1, 1]) {
      const ax = 0.3 * sx, ay = Math.sqrt(1 - 0.09)
      const nrm = new THREE.Vector3(ax, ay, 0).normalize()
      const boss = new THREE.Mesh(latheZ([[0, 0.03], [0.034, 0.028], [0.046, 0.012], [0.052, -0.02]], 40), satin)
      boss.position.copy(nrm).multiplyScalar(0.995); boss.quaternion.setFromRotationMatrix(frameAt(nrm).m); model.add(boss)
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0105, 12, 36), chrome)
      const eyeC = nrm.clone().multiplyScalar(1.0).add(new THREE.Vector3(0, 0.058, 0))
      eye.position.copy(eyeC); model.add(eye)
      const P0 = eyeC.clone().add(new THREE.Vector3(0, 0.03, 0))
      const P1 = new THREE.Vector3(0.05 * sx, PIVOT_Y - 0.072, 0)
      const u = P1.clone().sub(P0); const L = u.length(); u.normalize()
      let cnt = Math.max(3, Math.round(L / 0.075)); if (cnt % 2 === 0) cnt++
      const pitch = L / cnt
      const Z = new THREE.Vector3(0, 0, 1)
      for (let i = 0; i < cnt; i++) {
        const w = i % 2 === 0 ? Z.clone() : new THREE.Vector3().crossVectors(Z, u).normalize()
        const link = new THREE.Mesh(linkGeo, chrome)
        link.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, w, new THREE.Vector3().crossVectors(u, w)))
        link.position.copy(P0).addScaledVector(u, pitch * (i + 0.5))
        model.add(link)
      }
    }
  }

  // floor: soft contact shadow + a pool of screen light
  const shadowTex = radialTexture([[0, 'rgba(0,0,0,0.9)'], [0.28, 'rgba(0,0,0,0.5)'], [0.62, 'rgba(0,0,0,0.12)'], [1, 'rgba(0,0,0,0)']])
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false })
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7).rotateX(-Math.PI / 2), shadowMat)
  shadow.position.y = FLOOR_Y; shadow.renderOrder = -2; scene.add(shadow)
  const poolTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']])
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, depthWrite: false, blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, color: 0x000000,
  })
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.2).rotateX(-Math.PI / 2), poolMat)
  pool.position.set(0, FLOOR_Y + 0.002, 0.2); pool.renderOrder = -1; scene.add(pool)

  // studio lights
  const key = new THREE.DirectionalLight(0xfff6ec, 1.5); key.position.set(-3.2, 4.2, 4.0)
  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.6); rim.position.set(3.6, 1.6, -3.2)
  const rim2 = new THREE.DirectionalLight(0xffffff, 0.8); rim2.position.set(-3.6, 0.6, -2.6)
  scene.add(key, rim, rim2)

  // ---------- state ----------
  let cur = 0, alive = true, visible = false, everVisible = false
  let paused = state.paused
  let night = state.night ? 1 : 0, nightTarget = night
  let powerT = 0, powering = false, powerDone = false
  let tIdle = 0, tReel = 2.0
  let change = { t: -1, to: 0, swapped: true }
  let osdT = 99
  let scrollT = 0.5, scroll = 0.5
  let flash = 0
  const yaw = new Spring(HERO.yaw, 6, 2.6)
  const pitch = new Spring(HERO.pitch, 30, 7.5)
  const roll = new Spring(0, 9, 1.8)
  const dialS = new Spring(0, 260, 17)
  const pressA = new Spring(0, 900, 38), pressB = new Spring(0, 900, 38)
  const hoverS = new Spring(0, 120, 22)
  let dialK = 0
  const look = new THREE.Vector2(), lookT = new THREE.Vector2()
  const mouseT = new THREE.Vector2(0.5, 0.5)

  function reducedSprings() {
    const r = state.reduced
    yaw.k = r ? 70 : 6; yaw.c = r ? 2 * Math.sqrt(70) : 2.6
    dialS.c = r ? 2 * Math.sqrt(260) : 17
  }
  reducedSprings()
  if (!state.reduced) { yaw.x = HERO.yaw - 1.15; pitch.x = HERO.pitch + 0.12 } // entrance turn

  function swapReel(i: number) {
    const m = reelMats[i]; if (m) reelQuad.material = m
    drawOSD(); osdT = 0
    ticks.forEach((t, k) => (t.material = k === i ? tickOn : tickOff))
  }
  function dialTo(i: number) {
    // nearest detent k with k mod N === i
    let k = dialK + wrapPi((i - mod(dialK, N)) * STEP) / STEP
    k = Math.round(k)
    dialK = k; dialS.target = k * STEP
  }
  function changeTo(i: number, o: { instant?: boolean; fromDial?: boolean } = {}) {
    i = mod(Math.round(i), N)
    if (i === cur) { if (!o.fromDial) dialTo(i); kick(); return }
    cur = i
    if (!o.fromDial) dialTo(i)
    if (o.instant || state.reduced || !powerDone) { change.t = -1; swapReel(i) }
    else { change = { t: 0, to: i, swapped: false } }
    opts.onChannel?.(i)
    kick()
  }

  // the lit picture's true outline (squircle in signal space, un-barrelled), in screen-local coords
  const pictureEdge: THREE.Vector3[] = (() => {
    const out: THREE.Vector3[] = [], R = VIS_R + 0.006, kx = PIC_W * R / VIS_R, ky = PIC_H * R / VIS_R
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU, c = Math.cos(a), sn = Math.sin(a)
      const t = Math.pow(Math.pow(Math.abs(c), 5) + Math.pow(Math.abs(sn), 5), -0.2)
      const ex = t * c, ey = t * sn
      let qx = ex, qy = ey
      for (let k = 0; k < 8; k++) { const r2 = qx * qx + (qy * 0.75) * (qy * 0.75), f = 1 + 0.055 * r2 + 0.025 * r2 * r2; qx = ex / f; qy = ey / f }
      const x = qx * kx, y = qy * ky
      out.push(new THREE.Vector3(x, y, SAG * (1 - (x * x + y * y) / (R * R))))
    }
    return out
  })()

  // ---------- picking & pointer ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  function pick(cx: number, cy: number) {
    const r = canvas.getBoundingClientRect()
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const h = ray.intersectObjects(pickables, false)[0]
    return h ? { hit: h.object.userData.hit as string, uv: h.uv } : null
  }
  function project(v: THREE.Vector3) {
    const r = canvas.getBoundingClientRect()
    const p = v.clone().project(camera)
    return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height }
  }
  const noSelect = (e: Event) => e.preventDefault()
  type Drag = { id: number; kind: 'spin' | 'dial' | 'btnA' | 'btnB'; hit: string | null; x0: number; y0: number; moved: boolean; yaw0: number; pitch0: number; lt: number; ly: number; lp: number; vy: number; vp: number; ang: number | null; raw: number }
  let drag: Drag | null = null
  let hoverHit: string | null = null
  function setCursor(h: string | null) {
    canvas.style.cursor = drag?.kind === 'spin' && drag.moved ? 'grabbing' : h === 'screen' || h === 'dial' || h === 'btnA' || h === 'btnB' ? 'pointer' : h === 'body' ? 'grab' : ''
  }
  // pointer -> the knob's own plane: angle + radius in dial units, so dragging tracks the visible
  // knob exactly, however the set is turned or foreshortened
  const dialPlane = new THREE.Plane(), dialHit = new THREE.Vector3(), dialN = new THREE.Vector3(), dialP = new THREE.Vector3()
  function dialPolar(cx: number, cy: number): { a: number; d: number } | null {
    scene.updateMatrixWorld(); camera.updateMatrixWorld()
    const r = canvas.getBoundingClientRect()
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    dialN.set(0, 0, 1).transformDirection(dial.matrixWorld)
    dialP.set(0, 0, 0.1).applyMatrix4(dial.matrixWorld)
    dialPlane.setFromNormalAndCoplanarPoint(dialN, dialP)
    if (!ray.ray.intersectPlane(dialPlane, dialHit)) return null
    dial.worldToLocal(dialHit)
    return { a: Math.atan2(dialHit.y, dialHit.x), d: Math.hypot(dialHit.x, dialHit.y) }
  }
  const NEAR = 16 // px of wobble a press may drift (the set sways) and still count as a click
  const magnet = (raw: number) => { const k = raw / STEP, r = Math.round(k), f = k - r; return (r + Math.sign(f) * Math.pow(Math.abs(f) * 2, 2.4) / 2) * STEP }

  function onDown(e: PointerEvent) {
    if (e.button !== 0 || drag) return
    const h = pick(e.clientX, e.clientY)
    const kind: Drag['kind'] = h?.hit === 'dial' ? 'dial' : h?.hit === 'btnA' ? 'btnA' : h?.hit === 'btnB' ? 'btnB' : 'spin'
    if (kind === 'spin' && !h) return // empty canvas: let the page have it
    const dp = kind === 'dial' ? dialPolar(e.clientX, e.clientY) : null
    drag = { id: e.pointerId, kind, hit: h?.hit ?? null, x0: e.clientX, y0: e.clientY, moved: false, yaw0: yaw.x, pitch0: pitch.x,
      lt: performance.now(), ly: yaw.x, lp: pitch.x, vy: 0, vp: 0, ang: dp && dp.d > 0.03 ? dp.a : null, raw: dialS.x }
    if (kind === 'btnA') pressA.target = 1
    if (kind === 'btnB') pressB.target = 1
    if (h?.hit === 'screen') flash = 0.2
    try { canvas.setPointerCapture(e.pointerId) } catch {}
    document.addEventListener('selectstart', noSelect) // dragging the set must not paint a text selection over the page
    kick()
  }
  function onMove(e: PointerEvent) {
    const r = canvas.getBoundingClientRect()
    lookT.set(clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.5, 1.5), clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1.5, 1.5))
    if (!drag) {
      const h = e.target === canvas ? pick(e.clientX, e.clientY) : null
      const hit = h?.hit ?? null
      if (hit !== hoverHit) { hoverHit = hit; setCursor(hit) }
      hoverS.target = hit === 'screen' ? 1 : 0
      if (hit === 'screen' && h?.uv) {
        const qx = (h.uv.x - 0.5) / (PIC_W / (2 * VIS_R)), qy = (h.uv.y - 0.5) / (PIC_H / (2 * VIS_R))
        mouseT.set(clamp(qx * 0.5 + 0.5, 0, 1), clamp(qy * 0.5 + 0.5, 0, 1))
      } else mouseT.set(0.5, 0.5)
      if (!state.reduced) kick()
      return
    }
    if (e.pointerId !== drag.id) return
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0
    if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; setCursor(hoverHit) }
    if (drag.kind === 'spin' && drag.moved) {
      yaw.x = drag.yaw0 + dx * 0.0085; yaw.v = 0
      pitch.x = clamp(drag.pitch0 + dy * 0.004, -0.45, 0.55); pitch.v = 0
      const now = performance.now(), dt = Math.max(1, now - drag.lt) / 1000
      drag.vy = drag.vy * 0.6 + ((yaw.x - drag.ly) / dt) * 0.4
      drag.vp = drag.vp * 0.6 + ((pitch.x - drag.lp) / dt) * 0.4
      drag.lt = now; drag.ly = yaw.x; drag.lp = pitch.x
    } else if (drag.kind === 'dial') {
      const dp = dialPolar(e.clientX, e.clientY)
      if (dp && dp.d > 0.03) {
        if (drag.ang !== null) drag.raw -= wrapPi(dp.a - drag.ang) // clockwise on screen = next channel
        drag.ang = dp.a
      }
      dialS.x = magnet(drag.raw); dialS.v = 0; dialS.target = dialS.x
      const k = Math.round(drag.raw / STEP)
      if (k !== dialK) { dialK = k; changeTo(mod(k, N), { fromDial: true }) }
    } else if (drag.kind === 'btnA' || drag.kind === 'btnB') {
      const h = pick(e.clientX, e.clientY)
      const sp = drag.kind === 'btnA' ? pressA : pressB
      sp.target = h?.hit === drag.kind || Math.hypot(dx, dy) < NEAR ? 1 : 0
    }
    kick()
  }
  function onUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return
    const d = drag; drag = null
    document.removeEventListener('selectstart', noSelect)
    try { canvas.releasePointerCapture(e.pointerId) } catch {}
    const cancelled = e.type === 'pointercancel'
    if (d.kind === 'spin') {
      if (d.moved) {
        const stale = performance.now() - d.lt > 90
        yaw.v = stale ? 0 : clamp(d.vy, -18, 18)
        pitch.v = stale ? 0 : clamp(d.vp, -6, 6)
      } else if (!cancelled && d.hit === 'screen') { flash = 0.5; opts.onOpen?.(cur) }
    } else if (d.kind === 'dial') {
      if (!d.moved && !cancelled) next()
      else { dialS.target = dialK * STEP }
    } else {
      const sp = d.kind === 'btnA' ? pressA : pressB
      sp.target = 0
      const h = pick(e.clientX, e.clientY)
      if (!cancelled && (h?.hit === d.kind || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < NEAR)) d.kind === 'btnA' ? prev() : next()
    }
    setCursor(hoverHit)
    kick()
  }
  function onLeave() { if (!drag) { hoverHit = null; hoverS.target = 0; mouseT.set(0.5, 0.5); setCursor(null); kick() } }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('pointerleave', onLeave)
  canvas.style.touchAction = 'pan-y'
  const onWinMove = (e: PointerEvent) => { if (e.target !== canvas && !drag) { const r = canvas.getBoundingClientRect(); lookT.set(clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.5, 1.5), clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1.5, 1.5)); if (visible && !state.reduced) kick() } }
  window.addEventListener('pointermove', onWinMove, { passive: true })

  // ---------- layout ----------
  function fit() {
    const w = Math.max(2, canvas.clientWidth), h = Math.max(2, canvas.clientHeight)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2
    const hf = Math.atan(Math.tan(vf) * camera.aspect)
    const H = 3.8, W = 3.0 // the whole set incl. chain ring + pedestal; headroom for a fixed site header
    const dist = Math.max(H / 2 / Math.tan(vf), W / 2 / Math.tan(hf))
    // tall narrow screens: lift the set so the title/CTA block under it doesn't sit on the pedestal
    const lift = 0.5 * clamp((0.95 - camera.aspect) / 0.5, 0, 1)
    camera.position.set(0, 0.62, dist)
    camera.lookAt(0, -0.03 - lift, 0)
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(() => { fit(); kick() })
  ro.observe(canvas)
  fit()

  // ---------- frame ----------
  const tmp = new THREE.Vector3()
  function update(dt: number) {
    const reduced = state.reduced
    const running = !paused && !reduced
    if (running) { tIdle += dt; tReel += dt }
    reducedSprings()
    // power
    if (powering) {
      powerT += dt * 1000
      if (reduced || powerT >= POWER_MS) { powerT = POWER_MS; powering = false; powerDone = true; osdT = 0 }
    }
    const power = powerT / POWER_MS
    // night
    night += (nightTarget - night) * (reduced ? 1 : 1 - Math.exp(-dt * 5))
    if (Math.abs(nightTarget - night) < 0.002) night = nightTarget
    // springs
    if (everVisible && (!drag || drag.kind !== 'spin' || !drag.moved)) {
      const nearest = HERO.yaw + Math.round((yaw.x - HERO.yaw) / TAU) * TAU
      yaw.target = nearest; pitch.target = HERO.pitch
      yaw.step(dt); pitch.step(dt)
    }
    roll.target = clamp(-yaw.v * 0.012, -0.08, 0.08)
    roll.step(dt)
    if (!drag || drag.kind !== 'dial') dialS.step(dt)
    pressA.step(dt); pressB.step(dt); hoverS.step(dt)
    look.lerp(reduced ? ZERO2 : lookT, reduced ? 1 : 1 - Math.exp(-dt * 3))
    scroll += (scrollT - scroll) * (reduced ? 1 : 1 - Math.exp(-dt * 6))
    flash *= Math.exp(-dt * 9)
    // pose
    const bob = running ? Math.sin(tIdle * 0.85) * 0.035 : 0
    pivot.position.y = PIVOT_Y + bob
    pivot.rotation.z = roll.x + (running ? Math.sin(tIdle * 0.53) * 0.018 : 0)
    pivot.rotation.x = running ? Math.sin(tIdle * 0.41 + 1.3) * 0.012 : 0
    spin.rotation.y = yaw.x + (running ? Math.sin(tIdle * 0.31) * 0.06 : 0) + look.x * 0.09 + (scroll - 0.5) * 0.5
    spin.rotation.x = pitch.x + look.y * 0.05 + (scroll - 0.5) * -0.1
    knob.rotation.z = -dialS.x
    btnA.position.z = -0.022 * pressA.x
    btnB.position.z = -0.022 * pressB.x
    // channel change: 350 ms tear + static + roll, swap at 40%
    let tear = 0, stat = 0, rollV = 0
    if (change.t >= 0) {
      change.t += dt * 1000
      const k = change.t / CHANGE_MS
      tear = k < 1 ? Math.pow(Math.sin(Math.PI * Math.min(k, 1)), 0.6) : 0
      stat = Math.exp(-Math.pow((k - 0.4) / 0.14, 2)) * 0.95
      rollV = k < 0.4 ? -0.12 * THREE.MathUtils.smoothstep(k, 0.1, 0.4) : 0.55 * Math.exp(-(k - 0.4) * 6.5) * Math.cos((k - 0.4) * 7.5)
      if (!change.swapped && k >= 0.4) { change.swapped = true; swapReel(change.to); flash = Math.max(flash, 0.35) }
      if (k >= 1.5) change.t = -1
    }
    osdT += dt
    const osdA = powerDone ? (osdT < 1.8 ? 1 : Math.max(0, 1 - (osdT - 1.8) / 0.35)) : 0
    // uniforms
    const u = crt.uniforms
    u.uTime.value = tReel
    u.uPower.value = power
    u.uTear.value = tear
    u.uStatic.value = stat
    u.uRoll.value = rollV
    u.uFlash.value = flash
    u.uOSDa.value = osdA
    u.uHover.value = hoverS.x * (powerDone ? 1 : 0)
    u.uNight.value = night
    u.uRefl.value = THREE.MathUtils.lerp(1.0, 0.8, night)
    reelU.uTime.value = tReel
    reelU.uNight.value = night
    reelU.uMouse.value.lerp(mouseT, 1 - Math.exp(-dt * 6))
    // materials by theme
    shellMat.color.lerpColors(DAY_SHELL, NIGHT_SHELL, night)
    shellMat.roughness = THREE.MathUtils.lerp(0.34, 0.24, night)
    dotMat.color.lerpColors(DAY_DOT, NIGHT_DOT, night)
    dotMat.metalness = THREE.MathUtils.lerp(0.2, 0.85, night)
    dotMat.roughness = THREE.MathUtils.lerp(0.55, 0.3, night)
    scene.environment = night > 0.5 ? envNight : envDay
    scene.environmentIntensity = THREE.MathUtils.lerp(1.0, 0.9, night)
    key.intensity = THREE.MathUtils.lerp(1.5, 0.9, night)
    rim.intensity = THREE.MathUtils.lerp(1.2, 2.8, night)
    rim2.intensity = THREE.MathUtils.lerp(0.6, 1.6, night)
    // screen as light
    const kL = 1 - Math.exp(-dt * 7)
    avgCol.setRGB(0, 0, 0)
    for (let i = 0; i < 3; i++) {
      lightCol[i].lerp(lightTarget[i], kL)
      screenLights[i].color.copy(lightCol[i])
      screenLights[i].intensity = (1.4 + stat * 1.2 + flash) * Math.pow(power, 2) * THREE.MathUtils.lerp(1.0, 1.35, night)
      avgCol.r += lightCol[i].r / 3; avgCol.g += lightCol[i].g / 3; avgCol.b += lightCol[i].b / 3
    }
    u.uTint.value.copy(avgCol)
    ledMat.color.set(powerDone || powering ? '#4CC38A' : '#1d2a23')
    // floor
    tmp.setFromMatrixPosition(model.matrixWorld)
    scene.updateMatrixWorld()
    tmp.set(0, -1.38, 0).applyMatrix4(model.matrixWorld)
    const lift = tmp.y - FLOOR_Y
    shadow.position.x = tmp.x; shadow.position.z = tmp.z
    const ss = 0.9 + lift * 0.9
    shadow.scale.set(ss, 1, ss)
    shadowMat.opacity = clamp(0.95 - lift * 1.6, 0.15, 0.9) * THREE.MathUtils.lerp(0.55, 0.9, night)
    pool.position.x = tmp.x
    poolMat.color.copy(avgCol).multiplyScalar(THREE.MathUtils.lerp(0.35, 0.9, night) * power)
  }

  function render() {
    renderer.setRenderTarget(reelRT)
    renderer.render(reelScene, flatCam)
    const now = performance.now()
    if (!readPending && now - lastRead > 160) {
      lastRead = now; readPending = true
      renderer.setRenderTarget(tinyRT)
      renderer.render(tinyScene, flatCam)
      renderer.readRenderTargetPixelsAsync(tinyRT, 0, 0, 3, 1, tinyBuf).then(() => {
        for (let i = 0; i < 3; i++) lightTarget[i].setRGB(tinyBuf[i * 4] / 255, tinyBuf[i * 4 + 1] / 255, tinyBuf[i * 4 + 2] / 255, THREE.SRGBColorSpace)
      }).catch(() => {}).finally(() => { readPending = false })
    }
    renderer.setRenderTarget(null)
    renderer.render(scene, camera)
  }

  function busyWhy() {
    const w: string[] = []
    if (drag) w.push('drag'); if (yaw.busy) w.push('yaw'); if (pitch.busy) w.push('pitch'); if (roll.busy) w.push('roll'); if (dialS.busy) w.push('dial')
    if (pressA.busy || pressB.busy) w.push('press'); if (hoverS.busy) w.push('hover'); if (change.t >= 0) w.push('change'); if (powering) w.push('power')
    if (night !== nightTarget) w.push('night'); if (Math.abs(scroll - scrollT) > 1e-4) w.push('scroll'); if (flash > 0.01) w.push('flash')
    if (powerDone && osdT < 2.3) w.push('osd'); if (look.distanceTo(state.reduced ? ZERO2 : lookT) > 1e-3) w.push('look')
    return w.join(',')
  }
  function busy() {
    return !!drag || yaw.busy || pitch.busy || roll.busy || dialS.busy || pressA.busy || pressB.busy || hoverS.busy ||
      change.t >= 0 || powering || night !== nightTarget || Math.abs(scroll - scrollT) > 1e-4 || flash > 0.01 ||
      (powerDone && osdT < 2.3) || look.distanceTo(state.reduced ? ZERO2 : lookT) > 1e-3
  }
  let raf = 0, last = 0, frames = 0
  function frame(now: number) {
    raf = 0
    if (!alive || !visible || document.hidden) { last = 0; return }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
    last = now
    update(dt)
    render(); frames++
    if ((!paused && !state.reduced) || busy()) raf = requestAnimationFrame(frame)
    else last = 0
  }
  function kick() { if (!raf && alive) raf = requestAnimationFrame(frame) }

  // render whenever any of it is on screen; the power-on (and the turn to face you) waits until the
  // set is half in view so the slit isn't spent while the canvas is still sliding in
  const io = new IntersectionObserver(es => {
    const e = es[es.length - 1]
    visible = e?.isIntersecting ?? true
    if (visible && !everVisible && (state.reduced || (e?.intersectionRatio ?? 1) >= 0.5)) {
      everVisible = true
      if (state.reduced) { powerT = POWER_MS; powerDone = true; osdT = 0 } else { powering = true; powerT = 0 }
    }
    kick()
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] })
  io.observe(canvas)
  const onVis = () => kick()
  document.addEventListener('visibilitychange', onVis)
  const offTheme = bus.on('theme', ({ night: n }) => { nightTarget = n ? 1 : 0; kick() })
  const offPause = bus.on('pause', ({ paused: p }) => { paused = p; kick() })

  swapReel(0); osdT = 99
  if (document.fonts?.load) document.fonts.load(`600 40px ${osdFont}`).then(() => drawOSD()).catch(() => {})

  function next() { changeTo(cur + 1) }
  function prev() { changeTo(cur - 1) }

  const api: TV = {
    setChannel(i, o) { changeTo(i, { instant: o?.instant }) },
    next, prev,
    channel: () => cur,
    screenRect() {
      scene.updateMatrixWorld(); camera.updateMatrixWorld()
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      const v = new THREE.Vector3()
      for (const l of pictureEdge) {
        v.copy(l).applyMatrix4(screen.matrixWorld)
        const p = project(v)
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y)
      }
      return new DOMRect(x0, y0, x1 - x0, y1 - y0)
    },
    dialRing(a) { scene.updateMatrixWorld(); camera.updateMatrixWorld(); return project(new THREE.Vector3(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.1).applyMatrix4(dial.matrixWorld)) },
    debug() {
      scene.updateMatrixWorld(); camera.updateMatrixWorld()
      const at = (o: THREE.Object3D, l?: THREE.Vector3) => project((l ?? new THREE.Vector3()).applyMatrix4(o.matrixWorld))
      return {
        cur, frames, why: busyWhy(), yaw: yaw.x, pitch: pitch.x, dialK, dial: dialS.x, pressA: pressA.x, pressB: pressB.x,
        dragging: drag ? drag.kind + (drag.moved ? '*' : '') : null, changeT: change.t, powerT, osdT, flash, night,
        pts: { dial: at(knob, new THREE.Vector3(0, 0, 0.09)), btnA: at(btnA, new THREE.Vector3(0, 0, 0.04)), btnB: at(btnB, new THREE.Vector3(0, 0, 0.04)), screen: at(screen), body: at(model, new THREE.Vector3(-0.6, -0.55, 0.55)), ring: at(model, new THREE.Vector3(0, PIVOT_Y, 0)) },
        cursor: canvas.style.cursor, raw: drag?.raw ?? dialS.x,
      }
    },
    setNight(n) { nightTarget = n ? 1 : 0; kick() },
    setPaused(p) { paused = p; kick() },
    setScroll(p) { scrollT = clamp(p, 0, 1); kick() },
    dispose() {
      alive = false; cancelAnimationFrame(raf); delete (canvas as any).__tv
      io.disconnect(); ro.disconnect(); offTheme(); offPause()
      document.removeEventListener('visibilitychange', onVis); document.removeEventListener('selectstart', noSelect)
      window.removeEventListener('pointermove', onWinMove)
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp); canvas.removeEventListener('pointerleave', onLeave)
      const mats = new Set<THREE.Material>(), geos = new Set<THREE.BufferGeometry>()
      for (const s of [scene, reelScene, tinyScene]) s.traverse(o => {
        const m = o as THREE.Mesh
        if (m.geometry) geos.add(m.geometry)
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => mats.add(x))
      })
      reelMats.forEach(m => mats.add(m))
      geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose())
      ;[osdTex, shadowTex, poolTex, envDay, envNight].forEach(t => t.dispose())
      reelRT.dispose(); tinyRT.dispose(); pmrem.dispose(); renderer.dispose()
    },
  }
  ;(canvas as any).__tv = api // test hook: the integrated page can reach the instance via #tv.__tv
  return api
}
