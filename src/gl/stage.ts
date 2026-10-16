// Renderer, lights, camera rig (scroll framings + drag + pointer parallax), the hero capsule
// overlay, and the render loop. The DOM stays the source of truth; this canvas is decoration
// that happens to be true.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createNetwork, type Network } from './network'
import { createTubeGlass } from './tubeGlass'
import { palette } from '../theme'
import { state } from '../state'

export interface Framing { pos: THREE.Vector3; target: THREE.Vector3; fov: number }
export const FRAMINGS: Record<string, Framing> = {
  hero: { pos: new THREE.Vector3(-1.1, -5.0, 2.05), target: new THREE.Vector3(-1.25, 2.9, -0.3), fov: 32 },
  work: { pos: new THREE.Vector3(-1.1, -5.0, 2.05), target: new THREE.Vector3(-1.25, 2.9, -0.3), fov: 32 },
  index: { pos: new THREE.Vector3(-1.1, -5.0, 2.05), target: new THREE.Vector3(-1.25, 2.9, -0.3), fov: 32 },
  network: { pos: new THREE.Vector3(1.85, -0.25, 14.2), target: new THREE.Vector3(1.85, -0.1, 0), fov: 28 },
  brain: { pos: new THREE.Vector3(-0.78, -0.05, 4.15), target: new THREE.Vector3(-0.78, 0.0, 0), fov: 28 },
  dispatch: { pos: new THREE.Vector3(-0.78, -0.05, 4.15), target: new THREE.Vector3(-0.78, 0.0, 0), fov: 28 },
  about: { pos: new THREE.Vector3(0, -9.0, 5.8), target: new THREE.Vector3(0, 0.6, 0), fov: 30 },
  offboard: { pos: new THREE.Vector3(0, -9.0, 5.8), target: new THREE.Vector3(0, 0.6, 0), fov: 30 },
  contact: { pos: new THREE.Vector3(0, -9.0, 5.8), target: new THREE.Vector3(0, 2.3, 0), fov: 30 },
}

// Phones and tablets: the panel stacks below, so centre the subject and back off to fit
const NARROW = matchMedia('(max-width: 860px)')
const FIT: Record<string, Framing> = {}
function fitFramings() {
  for (const k in FIT) delete FIT[k]
  if (!NARROW.matches) return
  const t = Math.tan(14 * Math.PI / 180), a = innerWidth / innerHeight
  const fit = (halfW: number, minD: number, py: number, ty: number): Framing => {
    const d = Math.max(minD, halfW / (t * a)), s = 0.2 * d * t
    return { pos: new THREE.Vector3(0, py - s, d), target: new THREE.Vector3(0, ty - s, 0), fov: 28 }
  }
  FIT.network = fit(3.1, 14.2, -0.25, -0.1)
  FIT.brain = FIT.dispatch = fit(0.78, 4.15, -0.05, 0)
}
fitFramings()
NARROW.addEventListener('change', fitFramings)

export interface Stage {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  network: Network
  envMap: THREE.Texture
  brainSlot: THREE.Group
  setFraming(f: Framing): void
  setScrollFraming(a: string, b: string, t: number): void
  setDrag(yaw: number, pitch: number): void
  heroCapsule: HeroCapsule
  /** fly a courier capsule between two screen rects; resolves on arrival */
  courier(from: DOMRect, to: DOMRect, opts?: { fast?: boolean }): Promise<void>
  setNight(n: boolean): void
  /** step + draw; main=false skips the (covered) main canvas but keeps the top overlay alive */
  render(main?: boolean): void
  isSettled(): boolean
  warm(): Promise<void>
  size(): { w: number; h: number }
}

export interface HeroCapsule {
  group: THREE.Group
  place(rect: DOMRect | null, launch: number, opacity: number): void
  /** place by screen px: centre, width of the whole capsule in px, roll, opacity */
  setScreen(cx: number, cy: number, widthPx: number, rotZ: number, opacity: number, z?: number): void
  setSpin(rps: number | null): void
  update(dt: number, t: number): void
}

function makeHeroCapsule(envMap: THREE.Texture): HeroCapsule {
  const day = palette(false)
  const group = new THREE.Group()
  const R = 0.28, L = 0.98
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(R, L, 12, 48),
    createTubeGlass({ tint: '#EEF3F5', rim: day.ink, glow: '#ffffff' }, { tint: '#22303a', rim: '#e3ecf2', glow: '#ffffff' }, { rimPow: 2.0, body: 0.12, rimA: 0.92 }),
  )
  body.renderOrder = 3
  const capMat = new THREE.MeshPhysicalMaterial({ color: day.brain, metalness: 0.35, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMap, envMapIntensity: 1.0 })
  const ringMat = new THREE.MeshPhysicalMaterial({ color: '#C9CDD1', metalness: 1, roughness: 0.26, envMap, envMapIntensity: 1.2 })
  const spin = new THREE.Group()
  // caps: a domed shell + a machined collar on each end
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), capMat)
    cap.position.y = s * (L / 2)
    cap.scale.set(1, 0.92, 1)
    if (s < 0) cap.rotation.x = Math.PI
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.035, R * 1.035, 0.16, 48), capMat)
    cyl.position.y = s * (L / 2 - 0.08)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 1.04, 0.012, 10, 64), ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = s * (L / 2 - 0.17)
    const ring2 = ring.clone(); ring2.position.y = s * (L / 2 - 0.21)
    spin.add(cap, cyl, ring, ring2)
  }
  // inner rolled sheet: an Archimedean spiral ribbon with a halftone print
  const turns = 3.2, segs = 220, width = L * 0.86
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const a = t * turns * Math.PI * 2
    const r = R * (0.32 + 0.48 * t)
    for (let k = 0; k < 2; k++) {
      pos.push(Math.cos(a) * r, (k - 0.5) * width, Math.sin(a) * r)
      uv.push(t, k)
    }
    if (i < segs) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2) }
  }
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  sg.setIndex(idx); sg.computeVertexNormals()
  const sheetMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uPaper: { value: new THREE.Color('#F7F5F0') }, uInk: { value: new THREE.Color(day.ink) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uPaper; uniform vec3 uInk; varying vec2 vUv; varying vec3 vN;
      void main(){
        vec2 q = vec2(vUv.x * 120.0, vUv.y * 16.0); vec2 f = fract(q) - 0.5;
        float band = smoothstep(0.2, 0.8, sin(vUv.x * 40.0) * 0.5 + 0.5) * smoothstep(0.05, 0.3, vUv.y) * smoothstep(0.95, 0.7, vUv.y);
        float r = sqrt(band) * 0.5; float d = 1.0 - smoothstep(r - 0.06, r + 0.06, length(f));
        float sh = 0.6 + 0.4 * abs(vN.z);
        vec3 c = mix(uPaper, uInk, d * 0.9) * sh;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  })
  const sheet = new THREE.Mesh(sg, sheetMat)
  spin.add(sheet)
  spin.add(body)
  group.add(spin)
  group.rotation.z = Math.PI / 2 // lie horizontal in the name slot
  let launchV = 0
  let spinOverride: number | null = null
  let swayT = 0
  const wpp = () => (2 * 10 * Math.tan((18 / 2) * Math.PI / 180)) / innerHeight
  function setScreen(cx: number, cy: number, widthPx: number, rotZ: number, opacity: number, z = 0) {
    const k = wpp()
    group.visible = opacity > 0.01
    group.position.set((cx - innerWidth / 2) * k, -(cy - innerHeight / 2) * k, z)
    group.scale.setScalar((widthPx * k) / (L + 2 * R))
    group.rotation.z = Math.PI / 2 + rotZ
    ;(body.material as THREE.ShaderMaterial).uniforms.uDim.value = opacity
  }

  return {
    group,
    setScreen,
    setSpin(rps) { spinOverride = rps },
    place(rect, launch, opacity) {
      group.visible = !!rect && opacity > 0.01
      if (!rect) return
      // world units per px at z=0 for the overlay camera (fov 18, z 10)
      const H = innerHeight, W = innerWidth
      const wpp = (2 * 10 * Math.tan((18 / 2) * Math.PI / 180)) / H
      const cx = (rect.left + rect.width / 2 - W / 2) * wpp
      const cy = -(rect.top + rect.height / 2 - H / 2) * wpp
      const scale = (rect.width * wpp) / (L + 2 * R) * 0.98
      // launch: drop and dive toward the network below, shrinking
      const l = launch
      group.position.set(cx + l * l * 1.4, cy - l * 2.2, l * -1.5)
      group.scale.setScalar(scale * (1 - 0.55 * l))
      group.rotation.z = Math.PI / 2 + l * 0.9
      launchV = l
      ;(body.material as THREE.ShaderMaterial).uniforms.uDim.value = opacity
    },
    update(dt, t) {
      const still = state.reduced || (state.paused && spinOverride === null)
      spin.rotation.y += dt * (spinOverride ?? (still ? 0 : 0.7 + launchV * 22))
      if (!still) { swayT += dt; group.rotation.x = Math.sin(swayT * 0.6) * 0.08 }
    },
  }
}

export function createStage(canvas: HTMLCanvasElement, topCanvas?: HTMLCanvasElement | null): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  // the hero capsule floats ABOVE the DOM text on its own transparent canvas
  const top = topCanvas ? new THREE.WebGLRenderer({ canvas: topCanvas, antialias: true, alpha: true, premultipliedAlpha: true }) : null
  const PR = () => Math.min(devicePixelRatio, 1.5)
  if (top) { top.setPixelRatio(PR()); top.setSize(innerWidth, innerHeight, false); top.toneMapping = THREE.NeutralToneMapping; top.outputColorSpace = THREE.SRGBColorSpace; top.setClearColor(0x000000, 0) }
  renderer.setPixelRatio(PR())
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.autoClear = false

  const pmrem = new THREE.PMREMGenerator(renderer)
  let envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  let topEnv = envMap
  if (top) { const p2 = new THREE.PMREMGenerator(top); topEnv = p2.fromScene(new RoomEnvironment(), 0.04).texture; p2.dispose() }

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(palette(state.night).paper)
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(-3, 4, 5)
  const hemi = new THREE.HemisphereLight('#ffffff', '#d8d2c4', 0.9)
  const core = new THREE.PointLight(palette(false).brain, 2.5, 2.4, 1.6); core.position.set(0, 0, 0.3)
  scene.add(key, hemi, core)

  const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.05, 80)
  const network = createNetwork(envMap)
  scene.add(network.group)
  const brainSlot = new THREE.Group()
  scene.add(brainSlot)

  // hero overlay
  const heroScene = new THREE.Scene()
  heroScene.add(new THREE.HemisphereLight('#ffffff', '#cfc8ba', 1.1))
  const hk = new THREE.DirectionalLight('#ffffff', 2.4); hk.position.set(-3, 4, 6); heroScene.add(hk)
  const heroCam = new THREE.PerspectiveCamera(18, innerWidth / innerHeight, 0.1, 50)
  heroCam.position.set(0, 0, 10)
  const heroCapsule = makeHeroCapsule(topEnv)
  heroScene.add(heroCapsule.group)
  const courierCap = makeHeroCapsule(topEnv)
  courierCap.group.visible = false
  heroScene.add(courierCap.group)
  let flying: { t0: number; dur: number; a: [number, number, number]; b: [number, number, number]; c: [number, number]; done: () => void } | null = null
  const easeDraw = (u: number) => { // cubic-bezier(0.3,0,0.1,1) — quick off the line, brakes on air
    let t = u; for (let i = 0; i < 6; i++) { const x = 3 * (1 - t) ** 2 * t * 0.3 + 3 * (1 - t) * t * t * 0.1 + t ** 3 - u; const d = 3 * (1 - t) ** 2 * 0.3 + 6 * (1 - t) * t * (0.1 - 0.3) + 3 * t * t * (1 - 0.1); t = Math.min(1, Math.max(0, t - x / (d || 1))) }
    return 3 * (1 - t) * t * t + t ** 3
  }
  function stepCourier(now: number) {
    if (!flying) return
    const u = Math.min(1, (now - flying.t0) / flying.dur)
    const e = easeDraw(u)
    const [ax, ay, aw] = flying.a, [bx, by, bw] = flying.b, [cx, cy] = flying.c
    // quadratic arc through a control point above the straight line
    const x = (1 - e) ** 2 * ax + 2 * (1 - e) * e * cx + e * e * bx
    const y = (1 - e) ** 2 * ay + 2 * (1 - e) * e * cy + e * e * by
    // arrival: one SEAT bounce in the last 18%
    const land = u > 0.82 ? Math.sin(((u - 0.82) / 0.18) * Math.PI) * 0.12 : 0
    const w = aw + (bw - aw) * e
    const roll = Math.atan2(by - ay, bx - ax) * (1 - e) * 0.35
    courierCap.setScreen(x, y, w * (1 + land), roll, u > 0.97 ? 1 - (u - 0.97) / 0.03 : 1, 1.5 * Math.sin(Math.PI * e))
    courierCap.setSpin(4 + 30 * Math.sin(Math.PI * u))
    if (u >= 1) { courierCap.group.visible = false; const d = flying.done; flying = null; d() }
  }

  // camera rig: critically damped spring toward the framing + drag offset
  const want = { pos: FRAMINGS.hero.pos.clone(), target: FRAMINGS.hero.target.clone(), fov: FRAMINGS.hero.fov }
  const cur = { pos: want.pos.clone(), target: want.target.clone(), fov: want.fov }
  const vel = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 0 }
  let drag = { yaw: 0, pitch: 0 }
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
  addEventListener('pointermove', e => { pointer.x = e.clientX / innerWidth - 0.5; pointer.y = e.clientY / innerHeight - 0.5 }, { passive: true })
  let first = true
  const _off = new THREE.Vector3(), _sph = new THREE.Spherical()
  const coarse = matchMedia('(pointer: coarse)')
  const tmpF: Framing = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 28 }

  function step(dt: number) {
    const w = 6.5
    const k = w * w, c = 2 * w
    if (first || state.reduced) { cur.pos.copy(want.pos); cur.target.copy(want.target); cur.fov = want.fov; first = false }
    else {
      const sp = (x: THREE.Vector3, v: THREE.Vector3, to: THREE.Vector3) => {
        const ax = (to.x - x.x) * k - v.x * c, ay = (to.y - x.y) * k - v.y * c, az = (to.z - x.z) * k - v.z * c
        v.x += ax * dt; v.y += ay * dt; v.z += az * dt
        x.x += v.x * dt; x.y += v.y * dt; x.z += v.z * dt
      }
      sp(cur.pos, vel.pos, want.pos); sp(cur.target, vel.target, want.target)
      const af = (want.fov - cur.fov) * k - vel.fov * c; vel.fov += af * dt; cur.fov += vel.fov * dt
    }
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 4)
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 4)
    const par = state.reduced || coarse.matches ? 0 : 1
    // orbit the camera around its target by drag + parallax
    const off = _off.copy(cur.pos).sub(cur.target)
    const sph = _sph.setFromVector3(off)
    sph.theta += drag.yaw + pointer.sx * 0.05 * par
    sph.phi = Math.min(Math.PI - 0.05, Math.max(0.05, sph.phi + drag.pitch + pointer.sy * 0.035 * par))
    camera.position.copy(cur.target).add(_off.setFromSpherical(sph))
    camera.fov = cur.fov
    camera.up.set(0, 1, 0)
    camera.lookAt(cur.target)
    camera.updateProjectionMatrix()
  }

  let last = performance.now()
  let topDirty = false
  function render(main = true) {
    const now = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    step(dt)
    heroCapsule.update(dt, now / 1000)
    courierCap.update(dt, now / 1000)
    stepCourier(now)
    if (main) { renderer.clear(); renderer.render(scene, camera) }
    if (top) {
      if (heroCapsule.group.visible || courierCap.group.visible) { top.clear(); top.render(heroScene, heroCam); topDirty = true }
      else if (topDirty) { top.clear(); topDirty = false }
    } else if (heroCapsule.group.visible) { renderer.clearDepth(); renderer.render(heroScene, heroCam) }
  }

  canvas.addEventListener('webglcontextrestored', () => {
    const p = new THREE.PMREMGenerator(renderer); const fresh = p.fromScene(new RoomEnvironment(), 0.04).texture; p.dispose()
    scene.traverse(o => { const m = (o as any).material; if (!m) return
      for (const mm of Array.isArray(m) ? m : [m]) { if (mm.envMap === envMap) { mm.envMap = fresh; mm.needsUpdate = true } if (mm.uniforms?.uEnv?.value === envMap) mm.uniforms.uEnv.value = fresh } })
    envMap = fresh
  })
  topCanvas?.addEventListener('webglcontextrestored', () => {
    if (!top) return
    const p = new THREE.PMREMGenerator(top); const fresh = p.fromScene(new RoomEnvironment(), 0.04).texture; p.dispose()
    heroScene.traverse(o => { const m = (o as any).material; if (!m) return; for (const mm of Array.isArray(m) ? m : [m]) if (mm.envMap === topEnv) { mm.envMap = fresh; mm.needsUpdate = true } })
    topEnv = fresh
  })
  function onResize() {
    renderer.setPixelRatio(PR()); top?.setPixelRatio(PR())
    renderer.setSize(innerWidth, innerHeight, false)
    top?.setSize(innerWidth, innerHeight, false)
    fitFramings()
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix()
    heroCam.aspect = innerWidth / innerHeight; heroCam.updateProjectionMatrix()
  }
  addEventListener('resize', onResize)

  return {
    renderer, scene, camera, network, envMap, brainSlot, heroCapsule,
    courier(from, to, opts = {}) {
      return new Promise<void>(resolve => {
        const a: [number, number, number] = [from.left + from.width * 0.12, from.top + from.height / 2, 120]
        const b: [number, number, number] = [to.left + to.width / 2, to.top + to.height / 2, Math.min(560, to.width * 0.62)]
        const c: [number, number] = [(a[0] + b[0]) / 2 - 120, Math.min(a[1], b[1]) - 260]
        flying = { t0: performance.now(), dur: opts.fast ? 520 : 860, a, b, c, done: resolve }
        courierCap.group.visible = true
      })
    },
    setFraming(f) { want.pos.copy(f.pos); want.target.copy(f.target); want.fov = f.fov },
    setScrollFraming(a, b, t) { const f = lerpFraming(FIT[a] ?? FRAMINGS[a], FIT[b] ?? FRAMINGS[b], t, tmpF); want.pos.copy(f.pos); want.target.copy(f.target); want.fov = f.fov },
    setDrag(yaw, pitch) { drag = { yaw, pitch } },
    setNight(n) {
      ;(scene.background as THREE.Color).set(palette(n).paper)
      network.setNight(n)
      hemi.intensity = n ? 0.25 : 0.9
      key.intensity = n ? 0.7 : 2.2
      core.intensity = n ? 5 : 2.5
    },
    render,
    isSettled: () => !flying && vel.pos.lengthSq() + vel.target.lengthSq() + vel.fov ** 2 < 1e-10 && Math.abs(pointer.x - pointer.sx) + Math.abs(pointer.y - pointer.sy) < 1e-4,
    async warm() {
      // compile every program up front so the first visible frame does not stall
      try { await renderer.compileAsync(scene, camera) } catch {}
      if (top) { const v = heroCapsule.group.visible; heroCapsule.group.visible = true; try { await top.compileAsync(heroScene, heroCam) } catch {} heroCapsule.group.visible = v }
    },
    size: () => ({ w: innerWidth, h: innerHeight }),
  }
}

export function lerpFraming(a: Framing, b: Framing, t: number, out: Framing) {
  out.pos.lerpVectors(a.pos, b.pos, t)
  out.target.lerpVectors(a.target, b.target, t)
  out.fov = a.fov + (b.fov - a.fov) * t
  return out
}
