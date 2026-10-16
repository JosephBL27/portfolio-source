// The TV parts for the shared v4 scene: the big hub orb TV, the small arc TVs, the reel render
// pipeline that feeds their screens, and the title cards for projects that have no reel.
// Geometry and the CRT face are the v2 set (src/gl/tv.ts, src/gl/crt.ts); this file only re-hangs them
// as Object3D parts that live inside the particle field's scene. CRT scanlines / warp exist only in the
// screen material (the CRT shader); the shell, bezel and chain are plain PBR.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { ReelDef } from '../../reels/types'
import { createCRTMaterial, type CRTMaterial } from '../../gl/crt'
import { loadGLB, meshesByName, withAO } from './glbmodel'
import { TAU, OPEN, LIP_Z, LIP_R, VIS_R, VIS_Z, SAG, PIC_W, PIC_H, PIVOT_Y, REEL_VERT, bulgedDisc, latheZ, cylZ, knurl, frameAt } from '../../gl/tv'

const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace'
const DIDONE = '"Bodoni Moda Variable", "Bodoni Moda", "Bodoni 72", Didot, serif'

// ------------------------------------------------------------------ display-referred output
/**
 * The v3 post stack is display-referred: particle shaders write sRGB values straight into a linear
 * HalfFloat target and the final pass writes them out raw. Anything lit by three (PBR, the CRT face,
 * the glass brain) normally ends in `linearToOutputTexel`, which is the identity on a render target, so
 * it would come out dark and over-saturated. This swaps the final encode for a real sRGB OETF.
 */
export function displayReferred<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = function (shader) {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <colorspace_fragment>', 'gl_FragColor = sRGBTransferOETF( gl_FragColor );')
      .replace(/linearToOutputTexel\s*\(/g, 'sRGBTransferOETF(')
  }
  m.customProgramCacheKey = () => 'display-referred'
  m.needsUpdate = true
  return m
}

// ------------------------------------------------------------------ environment
/** A dark studio: near-black room with four softboxes, so gloss black stays black and chrome keeps its highlights. */
export function makeTVEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  room.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) (m.material as THREE.MeshStandardMaterial).color.setScalar(0.035) })
  const box = (w: number, h: number, x: number, y: number, z: number, k: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(k), side: THREE.DoubleSide }))
    m.position.set(x, y + 3.5, z); room.add(m); m.lookAt(0, 0, 0)
  }
  box(5.5, 3.2, -5.2, 4.6, 6.2, 4.5)
  box(0.9, 7.5, 6.2, 0.6, 4.4, 5.5)
  box(0.6, 7.0, -7.4, 0.4, -3.2, 3.5)
  box(4.0, 4.0, 0, 9.5, 0.5, 1.2)
  const prev = renderer.getRenderTarget()
  const t = pmrem.fromScene(room, 0.03).texture
  renderer.setRenderTarget(prev)
  room.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose() } })
  pmrem.dispose()
  return t
}

// ------------------------------------------------------------------ shared kit
export interface TVKit {
  env: THREE.Texture
  shell: THREE.MeshPhysicalMaterial
  chrome: THREE.MeshPhysicalMaterial
  satin: THREE.MeshPhysicalMaterial
  /** the long chain: darker, rougher chrome so a thin mirror doesn't bloom into a white line */
  chain: THREE.MeshPhysicalMaterial
  gloss: THREE.MeshPhysicalMaterial
  accent: THREE.MeshPhysicalMaterial
  dotMat: THREE.MeshPhysicalMaterial
  tickOff: THREE.MeshBasicMaterial
  tickOn: THREE.MeshBasicMaterial
  ledMat: THREE.MeshBasicMaterial
  pic: THREE.Vector2
  /** shared (empty) OSD texture for the small sets */
  osdMini: THREE.CanvasTexture
  miniShell: THREE.BufferGeometry
  miniBezel: THREE.BufferGeometry
  miniFace: THREE.BufferGeometry
  miniHit: THREE.BufferGeometry
  miniLoop: THREE.BufferGeometry
  hitMat: THREE.Material
  dispose(): void
}

export function createKit(renderer: THREE.WebGLRenderer, display = true): TVKit {
  const env = makeTVEnv(renderer)
  const fin = <T extends THREE.Material>(m: T) => (display ? displayReferred(m) : m)
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => fin(new THREE.MeshPhysicalMaterial({ envMap: env, ...p }))
  const shell = phys({ color: '#08090A', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.55 })
  const chrome = phys({ color: 0xdadde0, metalness: 1, roughness: 0.14, envMapIntensity: 0.85 })
  const satin = phys({ color: 0xc4c7cb, metalness: 1, roughness: 0.3, envMapIntensity: 0.8 })
  const chain = phys({ color: 0xa4a8ad, metalness: 1, roughness: 0.34, envMapIntensity: 0.6 })
  const gloss = phys({ color: 0x0c0c0d, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 })
  const accent = phys({ color: '#E8472D', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 })
  const dotMat = phys({ color: '#5B5E63', roughness: 0.3, metalness: 0.85 })
  const tickOff = fin(new THREE.MeshBasicMaterial({ color: '#2B2D30' }))
  const tickOn = fin(new THREE.MeshBasicMaterial({ color: '#FF6A4D' }))
  const ledMat = fin(new THREE.MeshBasicMaterial({ color: '#4CC38A' }))

  // OSD for the small sets: empty. The "VIEW" tag is DOM (the UI places it with screenRect), never text burnt into a screen.
  const c = document.createElement('canvas'); c.width = 4; c.height = 4
  const osdMini = new THREE.CanvasTexture(c)

  const miniBezel = latheZ([
    [VIS_R - 0.02, VIS_Z - 0.03], [VIS_R + 0.002, VIS_Z + 0.004], [VIS_R + 0.006, VIS_Z + 0.05],
    [VIS_R + 0.013, VIS_Z + 0.079], [VIS_R + 0.028, VIS_Z + 0.093], [LIP_R - 0.012, VIS_Z + 0.096],
    [LIP_R + 0.006, VIS_Z + 0.085], [LIP_R + 0.015, VIS_Z + 0.062], [LIP_R + 0.017, LIP_Z - 0.03], [LIP_R + 0.002, LIP_Z - 0.07],
  ], 72)
  return {
    env, shell, chrome, satin, chain, gloss, accent, dotMat, tickOff, tickOn, ledMat,
    pic: new THREE.Vector2(PIC_W / (2 * VIS_R), PIC_H / (2 * VIS_R)),
    osdMini,
    miniShell: new THREE.SphereGeometry(1, 72, 52, 0, TAU, OPEN, Math.PI - OPEN).rotateX(Math.PI / 2),
    miniBezel,
    miniFace: bulgedDisc(VIS_R + 0.006, SAG, 22, 72),
    miniHit: new THREE.SphereGeometry(1.06, 14, 10),
    miniLoop: new THREE.TorusGeometry(0.075, 0.016, 10, 28),
    hitMat: new THREE.MeshBasicMaterial({ visible: false }),
    dispose() {
      for (const m of [shell, chrome, satin, chain, gloss, accent, dotMat, tickOff, tickOn, ledMat]) m.dispose()
      for (const gg of [this.miniShell, this.miniBezel, this.miniFace, this.miniHit, this.miniLoop]) gg.dispose()
      osdMini.dispose(); env.dispose(); this.hitMat.dispose()
    },
  }
}

// ------------------------------------------------------------------ picture outline (for screenRect)
function pictureOutline(): THREE.Vector3[] {
  const out: THREE.Vector3[] = [], R = VIS_R + 0.006, kx = PIC_W * R / VIS_R, ky = PIC_H * R / VIS_R
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU, c = Math.cos(a), sn = Math.sin(a)
    const t = Math.pow(Math.pow(Math.abs(c), 5) + Math.pow(Math.abs(sn), 5), -0.2)
    const ex = t * c, ey = t * sn
    let qx = ex, qy = ey
    for (let k = 0; k < 8; k++) { const r2 = qx * qx + (qy * 0.75) * (qy * 0.75), f = 1 + 0.055 * r2 + 0.025 * r2 * r2; qx = ex / f; qy = ey / f }
    const x = qx * kx, y = qy * ky
    out.push(new THREE.Vector3(x, y, SAG * (1 - (x * x + y * y) / (R * R))))
  }
  return out
}
export const PICTURE_EDGE = pictureOutline()

// ------------------------------------------------------------------ the small set
export interface MiniTV {
  /** positioned + oriented by the caller (yaw/pitch on `spin`) */
  root: THREE.Group
  spin: THREE.Group
  screen: THREE.Mesh
  crt: CRTMaterial
  hit: THREE.Mesh
  setTexture(t: THREE.Texture): void
}
export function createMiniTV(kit: TVKit, tex: THREE.Texture, display = true): MiniTV {
  const root = new THREE.Group()
  const spin = new THREE.Group(); spin.rotation.order = 'YXZ'
  root.add(spin)
  spin.add(new THREE.Mesh(kit.miniShell, kit.shell))
  const bezel = new THREE.Mesh(kit.miniBezel, kit.chrome); spin.add(bezel)
  const loop = new THREE.Mesh(kit.miniLoop, kit.chrome); loop.position.set(0, 1.04, 0); spin.add(loop)
  const crt = createCRTMaterial({ tex, osd: kit.osdMini, pic: kit.pic })
  crt.uniforms.uGain.value = 1.35
  if (display) displayReferred(crt)
  const screen = new THREE.Mesh(kit.miniFace, crt); screen.position.z = VIS_Z; spin.add(screen)
  const hit = new THREE.Mesh(kit.miniHit, kit.hitMat); hit.visible = false; spin.add(hit)
  return { root, spin, screen, crt, hit, setTexture(t) { crt.uniforms.uTex.value = t } }
}

// ------------------------------------------------------------------ the hub set (big orb TV)
export interface HubTV {
  /** scaled group; put it at the hub */
  root: THREE.Group
  pivot: THREE.Group      // swings from the top ring
  spin: THREE.Group       // yaw / pitch of the set
  screen: THREE.Mesh
  crt: CRTMaterial
  knob: THREE.Object3D
  pressA: THREE.Object3D
  pressB: THREE.Object3D
  hit: THREE.Mesh[]       // screen + body (each tagged userData.part = 'screen' | 'body')
  screenHit: THREE.Mesh
  /** the dial's own frame (local +z = out of the shell): drag maths happen in this plane */
  dial: THREE.Group
  /** invisible pick volumes for the controls (tagged userData.part = 'dial' | 'btnA' | 'btnB'), raycast before the body */
  grip: { dial: THREE.Mesh; btnA: THREE.Mesh; btnB: THREE.Mesh }
  light: THREE.PointLight
  led: THREE.MeshBasicMaterial
  /** light the tick of the current channel */
  setTick(i: number): void
  osd: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; draw(ch: number, title: string): void }
  scale: number
  dispose(): void
}

function chainLinks(kit: TVKit, parts: { P0: THREE.Vector3; P1: THREE.Vector3 }[], longFrom: number, longLen: number, C: number) {
  const linkGeo = new THREE.TorusGeometry(0.03 * C, 0.0078 * C, 10, 24).scale(1.55, 1, 1)
  const mats: THREE.Matrix4[] = []
  const Z = new THREE.Vector3(0, 0, 1)
  const run = (P0: THREE.Vector3, u: THREE.Vector3, L: number, pitch: number) => {
    const cnt = Math.max(2, Math.round(L / pitch))
    for (let i = 0; i < cnt; i++) {
      const w = i % 2 === 0 ? Z.clone() : new THREE.Vector3().crossVectors(Z, u).normalize()
      const m = new THREE.Matrix4().makeBasis(u, w, new THREE.Vector3().crossVectors(u, w))
      m.setPosition(P0.clone().addScaledVector(u, pitch * (i + 0.5)))
      mats.push(m)
    }
  }
  const pitch = 0.075 * C
  for (const { P0, P1 } of parts) { const u = P1.clone().sub(P0); const L = u.length(); u.normalize(); run(P0, u, L, L / Math.max(3, Math.round(L / pitch))) }
  // the long chain upward out of frame
  run(new THREE.Vector3(0, longFrom, 0), new THREE.Vector3(0, 1, 0), longLen, pitch)
  const inst = new THREE.InstancedMesh(linkGeo, kit.chain, mats.length)
  mats.forEach((m, i) => inst.setMatrixAt(i, m))
  inst.instanceMatrix.needsUpdate = true
  inst.frustumCulled = false
  return inst
}

export function createHubTV(kit: TVKit, tex: THREE.Texture, opts: { scale?: number; channels: number; chainLength?: number; display?: boolean }): HubTV {
  const S = opts.scale ?? 3
  const N = Math.max(1, opts.channels)
  const STEP = TAU / N
  const root = new THREE.Group(); root.scale.setScalar(S); root.name = 'hub-tv'
  const pivot = new THREE.Group(); pivot.position.y = PIVOT_Y
  const hang = new THREE.Group(); hang.position.y = -PIVOT_Y
  const spin = new THREE.Group(); spin.rotation.order = 'YXZ'
  const model = new THREE.Group()
  root.add(pivot); pivot.add(hang); hang.add(spin); spin.add(model)
  const hit: THREE.Mesh[] = []
  const owned: { dispose(): void }[] = []
  const own = <T extends { dispose(): void }>(o: T) => { owned.push(o); return o }

  const shell = new THREE.Mesh(own(new THREE.SphereGeometry(1, 160, 112, 0, TAU, OPEN, Math.PI - OPEN).rotateX(Math.PI / 2)), kit.shell)
  model.add(shell)
  const proxy = new THREE.Mesh(own(new THREE.SphereGeometry(1.02, 24, 16)), new THREE.MeshBasicMaterial()); proxy.visible = false; proxy.userData.part = 'body'; model.add(proxy); hit.push(proxy)

  const bezel = new THREE.Mesh(own(latheZ([
    [VIS_R - 0.02, VIS_Z - 0.03], [VIS_R + 0.002, VIS_Z + 0.004], [VIS_R + 0.006, VIS_Z + 0.05],
    [VIS_R + 0.013, VIS_Z + 0.079], [VIS_R + 0.028, VIS_Z + 0.093], [LIP_R - 0.012, VIS_Z + 0.096],
    [LIP_R + 0.006, VIS_Z + 0.085], [LIP_R + 0.015, VIS_Z + 0.062], [LIP_R + 0.017, LIP_Z - 0.03], [LIP_R + 0.002, LIP_Z - 0.07],
  ], 160)), kit.chrome)
  model.add(bezel)
  const gasket = new THREE.Mesh(own(new THREE.TorusGeometry(VIS_R + 0.004, 0.009, 10, 160)), kit.gloss)
  gasket.position.z = VIS_Z + 0.006; model.add(gasket)

  // OSD (channel banner on top, "open" hint below)
  const osdCanvas = document.createElement('canvas'); osdCanvas.width = 960; osdCanvas.height = 720
  const osdTex = own(new THREE.CanvasTexture(osdCanvas))
  const drawOSD = (ch: number, title: string) => {
    const g = osdCanvas.getContext('2d')!
    g.clearRect(0, 0, 960, 720)
    g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowOffsetX = 5; g.shadowOffsetY = 5; g.shadowBlur = 0
    g.fillStyle = '#F4F1E8'; g.textBaseline = 'alphabetic'; g.textAlign = 'left'
    g.font = `600 34px ${MONO}`; g.fillText('CH', 92, 128)
    g.font = `600 108px ${MONO}`; g.fillText(String(ch + 1).padStart(2, '0'), 152, 168)
    if (title) { g.font = `500 32px ${MONO}`; g.fillText(title.toUpperCase(), 96, 222) }
    g.textAlign = 'right'; g.font = `600 36px ${MONO}`
    g.fillText('OPEN ↗', 960 - 92, 720 - 96)
    osdTex.needsUpdate = true
  }

  const crt = createCRTMaterial({ tex, osd: osdTex, pic: kit.pic })
  if (opts.display !== false) displayReferred(crt)
  const screen = new THREE.Mesh(own(bulgedDisc(VIS_R + 0.006, SAG)), crt)
  screen.position.z = VIS_Z
  screen.userData.part = 'screen'
  model.add(screen); hit.push(screen)

  const light = new THREE.PointLight(0xffffff, 0, 70, 1.6)
  light.position.set(0, -0.05, 1.25)
  model.add(light)

  // control side: dial, two push buttons, power LED, halftone speaker grille
  const D1 = new THREE.Vector3(0.86, 0.36, 0.3).normalize()
  const f1 = frameAt(D1)
  const onSphere = (du: number, dv: number) => D1.clone().addScaledVector(f1.x, du).addScaledVector(f1.y, dv).normalize()
  const dial = new THREE.Group()
  dial.position.copy(D1).multiplyScalar(0.986); dial.quaternion.setFromRotationMatrix(f1.m)
  model.add(dial)
  dial.add(new THREE.Mesh(own(latheZ([[0, 0.024], [0.165, 0.024], [0.18, 0.018], [0.187, 0.004], [0.188, -0.05]], 96)), kit.satin))
  const ticks: THREE.Mesh[] = []
  const tickGeo = own(cylZ(0.013, 0.013, 0.008, 20))
  for (let k = 0; k < N; k++) {
    const t = new THREE.Mesh(tickGeo, kit.tickOff)
    const a = Math.PI / 2 - k * STEP
    t.position.set(Math.cos(a) * 0.152, Math.sin(a) * 0.152, 0.026)
    dial.add(t); ticks.push(t)
  }
  // pick volumes for the controls: generous (the dial is ~20 px across from the far waypoints), invisible, never rendered
  const gripMat = own(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
  const gripMesh = (parent: THREE.Object3D, part: string, r: number, h: number, z: number) => {
    const m = new THREE.Mesh(own(new THREE.CylinderGeometry(r, r, h, 20).rotateX(Math.PI / 2)), gripMat)
    m.visible = false; m.position.z = z; m.userData.part = part; parent.add(m); return m
  }
  const dialGrip = gripMesh(dial, 'dial', 0.25, 0.3, 0.1)
  const knob = new THREE.Group(); knob.position.z = 0.024; dial.add(knob)
  const flange = new THREE.Mesh(own(cylZ(0.124, 0.12, 0.016)), kit.chrome); flange.position.z = 0.008
  const knurled = new THREE.Mesh(own(knurl(0.1, 0.072, 30)), kit.chrome); knurled.position.z = 0.016 + 0.036
  const cap = new THREE.Mesh(own(latheZ([[0, 0.094], [0.06, 0.092], [0.084, 0.088], [0.091, 0.082], [0.093, 0.0]], 64)), kit.gloss)
  const pointer = new THREE.Mesh(own(new THREE.BoxGeometry(0.014, 0.066, 0.006)), kit.accent); pointer.position.set(0, 0.047, 0.095)
  knob.add(flange, knurled, cap, pointer)

  const makeButton = (dir: THREE.Vector3, mat: THREE.Material) => {
    const f = frameAt(dir)
    const g = new THREE.Group(); g.position.copy(dir).multiplyScalar(0.992); g.quaternion.setFromRotationMatrix(f.m)
    const collar = new THREE.Mesh(own(latheZ([[0.03, 0.012], [0.042, 0.016], [0.05, 0.012], [0.054, 0.0], [0.054, -0.03]], 48)), kit.satin)
    const travel = new THREE.Group()
    travel.add(new THREE.Mesh(own(latheZ([[0, 0.044], [0.022, 0.043], [0.03, 0.039], [0.033, 0.03], [0.033, -0.01]], 48)), mat))
    g.add(collar, travel); model.add(g)
    return { travel, g }
  }
  const btnA = makeButton(onSphere(-0.07, -0.27), kit.gloss)
  const btnB = makeButton(onSphere(0.065, -0.27), kit.accent)
  const pressA = btnA.travel, pressB = btnB.travel
  const btnAGrip = gripMesh(btnA.g, 'btnA', 0.045, 0.06, 0.025)
  const btnBGrip = gripMesh(btnB.g, 'btnB', 0.045, 0.06, 0.025)
  const ledDir = onSphere(-0.005, -0.385)
  const led = new THREE.Mesh(own(new THREE.SphereGeometry(0.014, 16, 12)), kit.ledMat)
  led.position.copy(ledDir).multiplyScalar(1.002); model.add(led)
  const hw: THREE.Object3D[] = []         // the procedural hardware the Blender model replaces (shell, bezel, gasket, bosses, eyelets, top ring, LED ring)
  const ledRing = new THREE.Mesh(own(new THREE.TorusGeometry(0.02, 0.004, 8, 24)), kit.satin)
  ledRing.position.copy(ledDir); ledRing.quaternion.setFromRotationMatrix(frameAt(ledDir).m); model.add(ledRing)
  {
    const G = onSphere(0.0, -0.7), fg = frameAt(G)
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
    const grille = new THREE.InstancedMesh(own(cylZ(1, 1, 1, 14)), kit.dotMat, dots.length)
    dots.forEach((m, i) => grille.setMatrixAt(i, m))
    grille.instanceMatrix.needsUpdate = true
    model.add(grille)
  }

  // chain: bosses + eyelets on the shell, two runs up to a top ring, then ONE chain up out of the frame
  {
    const C = 1.8
    const ringTop = new THREE.Mesh(own(new THREE.TorusGeometry(0.088 * 1.5, 0.016 * 1.5, 16, 56)), kit.chain)
    ringTop.position.y = PIVOT_Y; model.add(ringTop); hw.push(ringTop)
    const runs: { P0: THREE.Vector3; P1: THREE.Vector3 }[] = []
    for (const sx of [-1, 1]) {
      const ax = 0.3 * sx, ay = Math.sqrt(1 - 0.09)
      const nrm = new THREE.Vector3(ax, ay, 0).normalize()
      const boss = new THREE.Mesh(own(latheZ([[0, 0.03], [0.034, 0.028], [0.046, 0.012], [0.052, -0.02]], 40)), kit.satin)
      boss.position.copy(nrm).multiplyScalar(0.995); boss.quaternion.setFromRotationMatrix(frameAt(nrm).m); model.add(boss); hw.push(boss)
      const eye = new THREE.Mesh(own(new THREE.TorusGeometry(0.034, 0.0105, 12, 36)), kit.chrome)
      const eyeC = nrm.clone().multiplyScalar(1.0).add(new THREE.Vector3(0, 0.058, 0))
      eye.position.copy(eyeC); model.add(eye); hw.push(eye)
      runs.push({ P0: eyeC.clone().add(new THREE.Vector3(0, 0.03, 0)), P1: new THREE.Vector3(0.05 * sx, PIVOT_Y - 0.1, 0) })
    }
    const inst = chainLinks(kit, runs, PIVOT_Y + 0.08, opts.chainLength ?? 16, C)
    own(inst.geometry); model.add(inst)
  }

  hw.push(shell, bezel, gasket, ledRing)
  // ---- the Blender-authored hardware (scripts/blender/hub_tv.py): fetched a moment after the set exists, swapped in without a pop (same silhouette); any failure keeps the procedural parts
  let gone = false
  const glbOwn: { dispose(): void }[] = []
  window.setTimeout(() => {
    if (gone) return
    void loadGLB('hub-tv').then(g => {
      if (!g || gone) { g?.traverse(o => { (o as THREE.Mesh).geometry?.dispose() }); return }
      const parts = meshesByName(g)
      const m = (base: THREE.MeshPhysicalMaterial, direct = 0.35) => { const x = withAO(base, { direct }); glbOwn.push(x); return x }
      const mats: Record<string, THREE.Material> = {
        shell: m(kit.shell, 0.3), bezel: m(kit.chrome), gasket: m(kit.gloss), band: m(kit.chrome), controls: m(kit.chrome), hardware: m(kit.satin), ringtop: m(kit.chain),
      }
      for (const [n, mesh] of parts) { if (!mats[n]) continue; mesh.material = mats[n]; glbOwn.push(mesh.geometry); mesh.frustumCulled = false; model.add(mesh) }
      for (const o of hw) o.visible = false
    })
  }, 1200)

  const setTick = (i: number) => ticks.forEach((t, k) => { t.material = k === i ? kit.tickOn : kit.tickOff })
  return {
    root, pivot, spin, screen, crt, knob, pressA, pressB, hit, screenHit: screen, dial, grip: { dial: dialGrip, btnA: btnAGrip, btnB: btnBGrip }, light, led: kit.ledMat, setTick,
    osd: { canvas: osdCanvas, tex: osdTex, draw: drawOSD }, scale: S,
    dispose() { gone = true; owned.forEach(o => o.dispose()); glbOwn.forEach(o => o.dispose()); crt.dispose() },
  }
}

// ------------------------------------------------------------------ reel pipeline
/** Renders reel fragment shaders into render targets. One quad, one set of shared uniforms, one material per reel (lazy). */
export class ReelPipe {
  private u = {
    uTime: { value: 0 }, uRes: { value: new THREE.Vector2(320, 240) }, uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uNight: { value: 1 }, uSeed: { value: 0.5 }, uIntensity: { value: 1 },
  }
  private mats: (THREE.RawShaderMaterial | null)[]
  private quad = new THREE.PlaneGeometry(2, 2)
  private mesh: THREE.Mesh
  private scene = new THREE.Scene()
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private fallback = new THREE.MeshBasicMaterial({ color: 0x111111 })
  constructor(private renderer: THREE.WebGLRenderer, readonly reels: ReelDef[]) {
    this.mats = reels.map(() => null)
    this.mesh = new THREE.Mesh(this.quad, this.fallback); this.mesh.frustumCulled = false
    this.scene.add(this.mesh)
  }
  private mat(i: number) {
    let m = this.mats[i]
    if (!m) { m = new THREE.RawShaderMaterial({ vertexShader: REEL_VERT, fragmentShader: this.reels[i].frag, uniforms: this.u, depthTest: false, depthWrite: false }); this.mats[i] = m }
    return m
  }
  /** background-compile every reel so the first channel change never hitches */
  precompile() {
    const pre = new THREE.Scene()
    this.reels.forEach((_, i) => { const q = new THREE.Mesh(this.quad, this.mat(i)); q.frustumCulled = false; pre.add(q) })
    return this.renderer.compileAsync(pre, this.cam).catch(() => {})
  }
  makeTarget(w: number, h: number) {
    return new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter })
  }
  render(i: number, rt: THREE.WebGLRenderTarget, time: number, seed: number, mouse?: THREE.Vector2) {
    if (i < 0 || i >= this.reels.length) return
    const r = this.renderer
    this.mesh.material = this.mat(i)
    this.u.uTime.value = time; this.u.uSeed.value = seed; this.u.uRes.value.set(rt.width, rt.height)
    this.u.uMouse.value.copy(mouse ?? CENTRE)
    this.u.uIntensity.value = rt.width >= 600 ? 1 : 0.8
    const prevRT = r.getRenderTarget(), prevAuto = r.autoClear
    r.autoClear = true
    r.setRenderTarget(rt)
    r.render(this.scene, this.cam)
    r.setRenderTarget(prevRT)
    r.autoClear = prevAuto
  }
  dispose() { this.mats.forEach(m => m?.dispose()); this.quad.dispose(); this.fallback.dispose() }
}
const CENTRE = new THREE.Vector2(0.5, 0.5)

// ------------------------------------------------------------------ title cards (projects without a reel)
export interface CardData { name: string; period: string; kind: string; value: string; label: string; accent: string }
const wrap = (g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) => {
  const words = text.split(/\s+/), lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w
    if (g.measureText(t).width <= maxW || !cur) cur = t
    else { lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…' }
  return lines
}
/** A poster for a small TV: kind and period, the project name in Didone, the real key figure. All text is >= 24 px in the 512 x 384 texture. */
export function createCardTexture(d: CardData): THREE.CanvasTexture {
  const W = 512, H = 384
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  tex.anisotropy = 4
  const draw = () => {
    const g = c.getContext('2d')!
    g.clearRect(0, 0, W, H)
    const bg = g.createRadialGradient(W * 0.3, H * 0.2, 10, W / 2, H / 2, W * 0.75)
    bg.addColorStop(0, '#1b1d20'); bg.addColorStop(1, '#0b0c0d')
    g.fillStyle = bg; g.fillRect(0, 0, W, H)
    g.fillStyle = d.accent; g.fillRect(36, 40, 44, 3)
    g.textBaseline = 'alphabetic'; g.textAlign = 'left'
    g.fillStyle = '#9A978F'; g.font = `500 24px ${MONO}`
    g.fillText(`${d.kind.toUpperCase()}  ·  ${d.period}`.slice(0, 32), 36, 80)
    g.fillStyle = '#F4F1E8'; g.font = `700 46px ${DIDONE}`
    const lines = wrap(g, d.name, W - 72, 3)
    lines.forEach((l, i) => g.fillText(l, 36, 138 + i * 50))
    // key figure
    let size = 54
    g.font = `600 ${size}px ${MONO}`
    while (g.measureText(d.value).width > W - 72 && size > 28) { size -= 2; g.font = `600 ${size}px ${MONO}` }
    g.fillStyle = d.accent
    g.fillText(d.value, 36, 296)
    g.fillStyle = '#C9C5B9'; g.font = `500 24px ${MONO}`
    wrap(g, d.label, W - 72, 2).forEach((l, i) => g.fillText(l, 36, 330 + i * 28))
    tex.needsUpdate = true
  }
  draw()
  const fonts = document.fonts
  if (fonts?.load) Promise.all([fonts.load(`700 46px ${DIDONE}`), fonts.load(`600 54px ${MONO}`), fonts.load(`500 24px ${MONO}`)]).then(draw).catch(() => {})
  return tex
}
