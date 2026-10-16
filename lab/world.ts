// World lab: /lab/world.html
// The shared-scene TVs (hub orb, per-area arcs) and the glass brain, on a free orbit camera, with a stand-in
// particle backdrop and the real post stack. Query:
//   ?p=<0..1>          drive the world from the real flight (flight.ts) at scroll progress p (camera + state + power-off), with a scrub slider
//   ?wp=<waypoint id>   start there (no tween)     ?off=<0..1>  power-off progress     ?t=<sec>  freeze the clock
//   ?msaa=<n>           MSAA samples on the composer targets (default 4)     ?free=1  start in free orbit around the hub
// window.__world = { world, go(id, instant?), setOff(k), camera, controls, post, hudText() }
import '@fontsource-variable/bodoni-moda/opsz.css'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { REELS } from '../src/reels'
import { createPost } from '../src/v3/engine/post'
import { AREAS, WAYPOINTS } from '../src/v3/world/layout'
import { createWorld } from '../src/v3/world/objects'
import { flightAt, powerOffAt, waypointP, waypointIndex, legRange, type FlightState } from '../src/v3/world/flight'

const q = new URLSearchParams(location.search)
const canvas = document.getElementById('gl') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false })
renderer.setClearColor(0x000000, 1)
renderer.info.autoReset = false
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true; controls.dampingFactor = 0.08

// ---- the post stack, with a depth buffer on the composer targets (the TVs are opaque and need depth testing)
let cssW = innerWidth, cssH = innerHeight
const dpr = Math.min(devicePixelRatio || 1, 1.5)
renderer.setPixelRatio(dpr); renderer.setSize(cssW, cssH, false)
const post = createPost(renderer, scene, camera, cssW, cssH, dpr)
const samples = +(q.get('msaa') ?? 4)
for (const t of [post.composer.renderTarget1, post.composer.renderTarget2]) { t.depthBuffer = true; t.samples = samples }
Object.assign(post.settings, { aberration: 0.004, grain: 0.02, warp: 0.012, autoExposure: false })
post.apply(); post.setFade(1)
addEventListener('resize', () => { cssW = innerWidth; cssH = innerHeight; renderer.setSize(cssW, cssH, false); post.setSize(cssW, cssH, dpr); camera.aspect = cssW / cssH; camera.updateProjectionMatrix() })
camera.aspect = cssW / cssH; camera.updateProjectionMatrix()

// ---- stand-in particles: dust shell + a soft cloud at every area + a ring around the hub
{
  const pos: number[] = [], col: number[] = []
  const rnd = (() => { let s = 11; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 } })()
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.2
  for (let i = 0; i < 9000; i++) { const r = 30 + rnd() * 70, a = rnd() * 6.283, b = Math.acos(2 * rnd() - 1); pos.push(r * Math.sin(b) * Math.cos(a), r * Math.cos(b) * 0.6, r * Math.sin(b) * Math.sin(a)); col.push(0.10, 0.10, 0.11) }
  for (const a of AREAS) {
    const c = new THREE.Color(a.accent)
    for (let i = 0; i < 2600; i++) { pos.push(a.center[0] + gauss() * 2.4, a.center[1] + gauss() * 2.4, a.center[2] + gauss() * 2.4); col.push(c.r * 0.45, c.g * 0.45, c.b * 0.45) }
  }
  for (let i = 0; i < 3000; i++) { const th = rnd() * 6.283, r = 24 + gauss() * 0.5; pos.push(Math.sin(th) * r, gauss() * 0.4, Math.cos(th) * r); col.push(0.25, 0.23, 0.2) }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  const m = new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })
  scene.add(new THREE.Points(g, m))
}

// ---- the world
const before: (() => void)[] = []
const world = createWorld({
  renderer, scene, camera,
  addObject: o => scene.add(o),
  onBeforeRender: cb => { before.push(cb) },
}, {
  reels: REELS,
  onOpen: (id, rect) => { console.log('open', id, rect && [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)]) },
  onEvent: (n, info) => { if (q.has('log')) console.log('event', n, JSON.stringify(info ?? {})) },
})

// ---- fly-to buttons (a tween, not the real flight)
const panel = document.getElementById('panel')!
let curId = q.get('wp') ?? 'name'
let tween: { t: number; dur: number; p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; id: string } | null = null
const btns = new Map<string, HTMLButtonElement>()
function go(id: string, instant = false) {
  const wp = WAYPOINTS.find(w => w.id === id); if (!wp) return
  const p1 = new THREE.Vector3(...wp.cam.pos), t1 = new THREE.Vector3(...wp.cam.target)
  camera.fov = wp.cam.fov ?? 35; camera.updateProjectionMatrix()
  if (instant) { camera.position.copy(p1); controls.target.copy(t1); controls.update(); curId = id; tween = null }
  else tween = { t: 0, dur: 1.6, p0: camera.position.clone(), t0: controls.target.clone(), p1, t1, id }
  btns.forEach((b, k) => b.classList.toggle('on', k === id))
}
for (const w of WAYPOINTS) { const b = document.createElement('button'); b.textContent = w.id; b.onclick = () => go(w.id); panel.appendChild(b); btns.set(w.id, b) }
const offk = document.getElementById('offk') as HTMLInputElement, offv = document.getElementById('offv')!
const setOff = (k: number) => { offk.value = String(k); offv.textContent = k.toFixed(2); world.powerOff(k) }
offk.oninput = () => setOff(+offk.value)

// ---- DOM tags (what the UI layer would do with screenRect)
const tagLayer = document.getElementById('tags')!
const tagEls = new Map<string, HTMLSpanElement>()
for (const a of AREAS) for (const p of a.projects) { const s = document.createElement('span'); s.className = 'mono'; s.textContent = p; tagLayer.appendChild(s); tagEls.set(p, s) }
function updateTags() {
  for (const [id, el] of tagEls) {
    const r = q.has('tags') ? world.screenRect(id) : null
    el.style.display = r ? '' : 'none'
    if (r) { el.style.left = r.x + r.width / 2 + 'px'; el.style.top = r.y + r.height + 6 + 'px' }
  }
}

// ---- pick / hover
const forceHover = q.get('hover')
addEventListener('pointermove', e => { if (!forceHover) world.setHover(world.pick(e.clientX, e.clientY)) })
if (forceHover) world.setHover(forceHover)

// ---- loop
const hud = document.getElementById('hud')!
const flight = q.has('p')
let flightP = +(q.get('p') ?? 0), flightGoal = flightP
if (flight) {
  const sl = document.createElement('input'); sl.type = 'range'; sl.min = '0'; sl.max = '1'; sl.step = '0.0005'; sl.value = String(flightP)
  sl.style.cssText = 'position:fixed;left:12px;right:12px;bottom:40px;z-index:6;width:calc(100% - 24px)'
  sl.oninput = () => { flightGoal = +sl.value }
  document.body.appendChild(sl)
  ;(window as any).__flightTo = (p: number, snap = false) => { flightGoal = p; if (snap) flightP = p; sl.value = String(p) }
}
const fixedT = q.has('t') ? +q.get('t')! : null
let last = performance.now(), clock = 0, frames = 0
go(curId, true)
if (q.has('off')) setOff(+q.get('off')!)
function frame(now: number) {
  requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - last) / 1000); last = now
  clock += dt
  const t = fixedT ?? clock
  if (tween) {
    tween.t += dt; const k = Math.min(1, tween.t / tween.dur), e = k * k * (3 - 2 * k)
    camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e)
    if (k > 0.45) curId = tween.id
    if (k >= 1) { curId = tween.id; tween = null }
  }
  if (!flight) controls.update()
  if (flight) {
    flightP += (flightGoal - flightP) * (1 - Math.exp(-dt * 6))
    const fs = flightAt(flightP)
    camera.position.set(...fs.cam.pos); camera.lookAt(...fs.cam.target); camera.fov = fs.cam.fov; camera.updateProjectionMatrix()
    world.powerOff(powerOffAt(fs)); curId = WAYPOINTS[Math.round(fs.wp + (fs.next - fs.wp) * fs.t)]?.id ?? curId
    world.update(fs as FlightState, t, dt)
  } else world.update({ wp: curId }, t, dt)
  renderer.info.reset()
  for (const cb of before) cb()
  post.render(dt, t)
  updateTags()
  if (++frames % 15 === 0) { const s = world.stats(); hud.textContent = `${curId}  ${s.minis} tvs awake  ${s.live} live  hub ${s.hubOn.toFixed(2)} ch${s.hubChannel} ${s.hubProject ?? ''}  calls ${renderer.info.render.calls}  ${(1000 / Math.max(1, dt * 1000)).toFixed(0)} fps` }
}
requestAnimationFrame(frame)
;(window as any).__world = { waypointP, waypointIndex, legRange, world, go, setOff, camera, controls, post, renderer, get id() { return curId } }
