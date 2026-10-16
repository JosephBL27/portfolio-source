// Shared pieces of the waypoint stages (unit 8S): the contract every stage file implements, the display-referred material patch,
// easing / spring helpers, canvas-texture helpers, and a couple of geometry builders.
//
// A STAGE is a small three.js scene (real meshes, its own rendering style) that owns one waypoint while the particle form behind it
// dims to dust. stages.ts places its root at the waypoint (position, yaw, scale), tells it how far in / out it is, and keeps the
// particle alpha. Every pose a stage draws is a closed-form function of (arrive, depart, t, tIn), so scrubbing the scroll back
// replays the entrance or exit exactly in reverse; only idle loops (a counter ticking, beads orbiting) use the clock.
import * as THREE from 'three'
import { displayReferred } from '../../tvset'
import { WAYPOINTS } from '../../layout'

/** what a stage is told every frame it is visible */
export interface StageFrame {
  /** seconds of clock (the engine's t) and the frame step */
  t: number; dt: number
  /** 0..1 entrance progress (scrubbed by the flight leg into this waypoint; 1 once there) */
  arrive: number
  /** 0..1 exit progress (scrubbed by the flight leg out of this waypoint; 0 while it is held) */
  depart: number
  /** seconds since the stage was fully in (the idle clock: 0 until arrive reaches ~0.9, reset when it leaves) */
  tIn: number
  /** reduced motion: draw the final resting state, no loops */
  reduced: boolean
  /** phone-sized screen: the stage keeps its triangle and canvas budget small */
  phone: boolean
  /** viewport aspect (w / h) */
  aspect: number
  /** the world size of the visible window at the stage's distance (stages.ts scales the root so `size` fits it) */
  visW: number; visH: number
  /** play a named sound cue (ignored by the sfx engine when it does not know the name or sound is off) */
  emit(name: string, data?: unknown): void
}
export interface StageBuildCtx {
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  scene: THREE.Scene
  /** the shared PMREM studio (env.ts) */
  env: THREE.Texture
  phone: boolean
  /** waypoint index of this stage, and its camera as authored (pan and pull-back baked in): pos, target in world space */
  wp: number
  /** the direction from the subject toward the camera, in the stage root's local frame (x right, y up, z toward the viewer), and the distance */
  view: { dir: THREE.Vector3; dist: number; fov: number }
  /** hook for the idle sound cues */
  emit(name: string, data?: unknown): void
  /** upload textures and create the shader programs of `root` now (stages that finish building asynchronously call it when they are ready) */
  prewarm(root: THREE.Object3D): void
}
export interface StageInst {
  /** everything the stage owns; stages.ts adds it to the scene, positions it and toggles `visible` */
  root: THREE.Group
  update(f: StageFrame): void
  /** the stage stopped being visible (the flight left it, or stages were switched off): update() is not called for a hidden stage, so a stage that owns
   *  DOM, timers or key listeners drops them here (called once per hide, also when reduced motion removes it in a single frame) */
  leave?(): void
  /** particle alpha while the stage is fully in (the dust left behind it); default 0.16 */
  dust?: number
  /** the stage's footprint on screen at rest, in root units [w, h]: stages.ts scales the root down so it fits the window (a phone gets the band between title and copy) */
  size?: [number, number]
  /** optional interaction: stages.ts owns the events (hover, press, drag, keys) and hands the stage a world-space ray */
  pointer?: StagePointer
  /** a touch that lands on nothing the stage can use still gets this tip at the finger (title, optional sub), so a phone is never silent */
  hint?: [string, string?]
}
/** What a stage does with the pointer. `ray` is the camera ray through the pointer (world space), x / y the client position. Only called while the stage is
 *  fully in and held (arrive 1, depart 0); a stage must never claim a press it does not use (empty space belongs to the point-of-view drag). */
export interface StagePointer {
  /** hover test on pointer move: the cursor to show ('pointer' or 'grab'), or null (nothing here) */
  hover(ray: THREE.Raycaster, x: number, y: number): 'pointer' | 'grab' | null
  /** press: 'drag' keeps the pointer (move / up follow), 'tap' is a one-shot action, null passes the press on */
  down(ray: THREE.Raycaster, x: number, y: number): 'drag' | 'tap' | null
  move?(ray: THREE.Raycaster, x: number, y: number): void
  up?(moved: boolean): void
  /** the pointer left, or the stage is going away: drop any hover state */
  leave?(): void
  /** keyboard, only offered while the stage says it wants it: return true to consume the key */
  key?(e: KeyboardEvent): boolean
}
export interface StageDef { id: string; build(c: StageBuildCtx): StageInst }

// ---------------------------------------------------------------------------------------------------------------- maths
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** window: 0 before a, rises to 1 at b (smoothstep) */
export const win = (x: number, a: number, b: number) => sstep(a, b, x)
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3)
export const easeInCubic = (x: number) => { x = clamp01(x); return x * x * x }
export const easeInOutCubic = (x: number) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
export const easeOutBack = (x: number, k = 1.70158) => { x = clamp01(x); const c = k + 1; return 1 + c * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2) }
/** damped spring step response in seconds since the hit: 0 at t = 0, overshoots, settles at 1 */
export const springOut = (t: number, freq = 2.2, damp = 5.5) => (t <= 0 ? 0 : 1 - Math.exp(-damp * t) * (Math.cos(freq * 6.2831853 * t) + (damp / (freq * 6.2831853)) * Math.sin(freq * 6.2831853 * t)))
/** deterministic rng (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// ---------------------------------------------------------------------------------------------------------------- materials
/** a lit material that writes display-referred colour like the TV shells (the field's final pass adds no transfer function); `extra` may patch the shader after */
export function lit<T extends THREE.Material>(m: T, key: string, extra?: (shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }) => void): T {
  m.onBeforeCompile = function (shader) {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <colorspace_fragment>', 'gl_FragColor = sRGBTransferOETF( gl_FragColor );')
      .replace(/linearToOutputTexel\s*\(/g, 'sRGBTransferOETF(')
    extra?.(shader)
  }
  m.customProgramCacheKey = () => 'stage-' + key
  m.needsUpdate = true
  return m
}
export { displayReferred }

/** additive glow material (no depth write: it blooms like the particles do, since the bloom's mesh mask keys on depth) */
export function glowMat(map: THREE.Texture | null, color: THREE.ColorRepresentation, opacity = 1) {
  const m = new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  return lit(m, 'glow')
}

/** additive glow sprite material (billboards; blooms like the particles) */
export function glowSpriteMat(color: THREE.ColorRepresentation, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: radialTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  return lit(m, 'glow-sprite')
}

let glowTex: THREE.CanvasTexture | null = null
/** a white radial falloff (gaussian-ish), for halos and light pools */
export function radialTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  for (let i = 0; i <= 8; i++) { const x = i / 8; gr.addColorStop(x, `rgba(255,255,255,${Math.exp(-x * x * 4.2).toFixed(4)})`) }
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace
  return glowTex
}

/** a canvas texture: draw(g, w, h) once now; call tex.needsUpdate = true after redrawing */
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, o: { srgb?: boolean; mips?: boolean; aniso?: number } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')!
  draw(g, w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace
  tex.generateMipmaps = o.mips !== false
  tex.minFilter = tex.generateMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
  tex.anisotropy = o.aniso ?? 4
  return { tex, canvas: c, g }
}

// ---------------------------------------------------------------------------------------------------------------- geometry
export function roundedRectShape(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2
  r = Math.min(r, w / 2, h / 2)
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}
export function polyShape(pts: [number, number][]): THREE.Shape {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s
}
/** rewrite a shape geometry's uv to 0..1 over its bounding box (planar), so a canvas drawn over the bbox maps exactly */
export function bboxUV(geo: THREE.BufferGeometry, b?: { x0: number; y0: number; x1: number; y1: number }) {
  geo.computeBoundingBox()
  const bb = geo.boundingBox!, x0 = b?.x0 ?? bb.min.x, y0 = b?.y0 ?? bb.min.y, w = (b?.x1 ?? bb.max.x) - x0, h = (b?.y1 ?? bb.max.y) - y0
  const p = geo.getAttribute('position'), uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - x0) / w; uv[i * 2 + 1] = (p.getY(i) - y0) / h }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}
export function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // tiny merge: all inputs must be non-indexed (or are converted) and share attributes (position, normal, uv)
  const parts = list.map(g => (g.index ? g.toNonIndexed() : g))
  let n = 0; for (const g of parts) n += g.getAttribute('position').count
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2)
  let o = 0
  for (const g of parts) {
    const p = g.getAttribute('position'), nn = g.getAttribute('normal'), u = g.getAttribute('uv')
    pos.set(p.array as Float32Array, o * 3); if (nn) nor.set(nn.array as Float32Array, o * 3); if (u) uv.set(u.array as Float32Array, o * 2)
    o += p.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return out
}

// ---------------------------------------------------------------------------------------------------------------- the camera, from the stage's point of view
/** the base camera of waypoint `i` in the root's local frame (root yaw = place.yaw) */
export function viewOf(i: number): { dir: THREE.Vector3; dist: number; fov: number } {
  const w = WAYPOINTS[i], c = w.cam
  const v = new THREE.Vector3(c.pos[0] - c.target[0], c.pos[1] - c.target[1], c.pos[2] - c.target[2])
  const dist = v.length(); v.divideScalar(dist || 1)
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), -(w.place.yaw ?? 0))
  return { dir: v, dist, fov: c.fov ?? 35 }
}

// ---------------------------------------------------------------------------------------------------------------- pointer helpers
const _inv = new THREE.Matrix4(), _lr = new THREE.Ray(), _pl = new THREE.Plane()
/** intersect the world ray with the plane through local point p0 (normal n, both in `obj`'s frame); returns the LOCAL point or null */
export function rayPlaneLocal(obj: THREE.Object3D, ray: THREE.Ray, n: THREE.Vector3, p0: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 | null {
  obj.updateWorldMatrix(true, false); _inv.copy(obj.matrixWorld).invert()
  _lr.copy(ray).applyMatrix4(_inv); _pl.setFromNormalAndCoplanarPoint(n, p0)
  return _lr.intersectPlane(_pl, out)
}

let tipEl: HTMLDivElement | null = null
/** a small dark-glass label that follows the pointer (a DOM node, outside every proofread subtree: its numerals are readings of the 3D object, not copy) */
export function stageTip() {
  if (!tipEl) {
    const st = document.createElement('style')
    st.textContent = '.stage-tip{position:fixed;left:0;top:0;z-index:70;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .14s ease-out,visibility 0s linear .14s;padding:7px 10px 7px 12px;border-radius:8px;background:rgba(10,10,12,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);color:#f1ece0;font:500 10.5px/1.45 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap;box-shadow:inset 2px 0 0 var(--tip,#ff6a3d),0 8px 24px rgba(0,0,0,.4)}.stage-tip.on{opacity:1;visibility:visible;transition:opacity .14s ease-out}.stage-tip b{display:block;font-weight:600;color:#fff;letter-spacing:.09em}.stage-tip i{font-style:normal;opacity:.62}.stage-tip.sa i{opacity:1;color:var(--tip,#ff6a3d);font-weight:600}@media (prefers-reduced-motion:reduce){.stage-tip,.stage-tip.on{transition:none}}'
    document.head.append(st)
    tipEl = document.createElement('div'); tipEl.className = 'stage-tip'; tipEl.setAttribute('data-proof', 'skip'); tipEl.setAttribute('aria-hidden', 'true')
    document.body.append(tipEl)
  }
  const el = tipEl
  return {
    show(x: number, y: number, title: string, sub?: string, accent?: string, subAccent = false) {
      const k = title + '|' + (sub ?? '')
      if (el.dataset.k !== k) { el.dataset.k = k; el.innerHTML = '<b></b>' + (sub ? '<i></i>' : ''); (el.firstChild as HTMLElement).textContent = title; if (sub) (el.lastChild as HTMLElement).textContent = sub }
      if (accent) el.style.setProperty('--tip', accent)
      el.classList.toggle('sa', subAccent)
      const w = el.offsetWidth || 160, h = el.offsetHeight || 34
      // phone HUD contract: the bottom 72px (plus the safe area) belongs to the HUD, so tips stay above innerHeight - 84
      const floor = innerWidth <= 760 ? innerHeight - 84 : innerHeight - 8
      el.style.transform = `translate(${Math.round(Math.max(8, Math.min(innerWidth - w - 8, x + 16)))}px,${Math.round(Math.max(8, Math.min(floor - h, y + 18)))}px)`
      el.classList.add('on')
    },
    hide() { el.classList.remove('on') },
  }
}

// ---------------------------------------------------------------------------------------------------------------- "try me" marks
const TRY_KEY = 'v15.try.'
const tryStored = (id: string) => { try { return localStorage.getItem(TRY_KEY + id) === '1' } catch { return false } }
const tryStore = (id: string) => { try { localStorage.setItem(TRY_KEY + id, '1') } catch { /* private mode: it just shows again next visit */ } }
let tryStyled = false
export interface TryMark {
  /** call every frame the stage is on screen: `on` = the visitor is dwelling at the thing and nothing covers it. Positions the mark and runs its 4 s of life. */
  update(on: boolean, dt: number, reduced?: boolean): void
  /** the visitor used the thing (or the mark has been seen): hide it for good and remember that in localStorage 'v15.try.<id>' */
  dismiss(): void
  readonly done: boolean
}
/**
 * A 14px pulsing ring plus a short mono label on the touchable thing. It shows on the first dwell for about 4 s, or until the first interaction, whichever comes first,
 * and is then remembered ('v15.try.<id>'). `point` is a world position, an object (its world origin) or a function returning one (null = not drawable right now).
 * Reduced motion: a static ring. Tips and labels stay above the phone HUD (innerHeight - 84). A DOM node outside every proofread subtree.
 */
export function tryMark(id: string, label: string, point: THREE.Vector3 | THREE.Object3D | (() => THREE.Vector3 | null), camera: THREE.Camera, accent = '#ff6a3d'): TryMark {
  if (!tryStyled) {
    tryStyled = true
    const st = document.createElement('style')
    st.textContent = '.try-mark{position:fixed;left:0;top:0;z-index:68;pointer-events:none;opacity:0;visibility:hidden;display:flex;align-items:center;gap:9px;transition:opacity .35s ease-out,visibility 0s linear .35s}.try-mark.on{opacity:1;visibility:visible;transition:opacity .35s ease-out}.try-mark.left{flex-direction:row-reverse}.try-mark i{flex:none;box-sizing:border-box;width:14px;height:14px;border-radius:50%;border:1.5px solid var(--try,#ff6a3d);background:rgba(10,10,12,.28);animation:try-ring 1.7s ease-out infinite}.try-mark.still i{animation:none;box-shadow:0 0 0 4px rgba(255,255,255,.07)}.try-mark b{font:600 10px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:#f1ece0;padding:5px 8px;border-radius:6px;background:rgba(10,10,12,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.12);white-space:nowrap}@keyframes try-ring{0%{box-shadow:0 0 0 0 rgba(255,255,255,.42)}100%{box-shadow:0 0 0 15px rgba(255,255,255,0)}}@media (prefers-reduced-motion:reduce){.try-mark i{animation:none;box-shadow:0 0 0 4px rgba(255,255,255,.07)}.try-mark,.try-mark.on{transition:none}}'
    document.head.append(st)
  }
  let done = tryStored(id), dw = 0, life = 0, lastUp = 0, watch = 0, el: HTMLDivElement | null = null
  const v = new THREE.Vector3()
  const html = document.documentElement
  const hide = () => { el?.classList.remove('on'); if (watch) { clearInterval(watch); watch = 0 } }
  const finish = () => { done = true; tryStore(id); hide() }
  const ensure = () => {
    if (el) return el
    el = document.createElement('div'); el.className = 'try-mark'; el.setAttribute('data-proof', 'skip'); el.setAttribute('aria-hidden', 'true'); el.dataset.try = id
    el.style.setProperty('--try', accent)
    el.innerHTML = '<i></i><b></b>'; (el.lastChild as HTMLElement).textContent = label
    document.body.append(el)
    return el
  }
  return {
    get done() { return done },
    dismiss() { if (!done) finish() },
    update(on, dt, reduced = false) {
      if (done) return
      lastUp = performance.now()
      const covered = html.classList.contains('in-index') || html.classList.contains('is-loading') || !!(window as unknown as { __v3?: { caseView?: { isOpen?: () => boolean } } }).__v3?.caseView?.isOpen?.()
      if (!on || covered) { dw = 0; hide(); return }
      dw += dt
      if (dw < 0.8) return
      life += dt
      if (life >= 4) { finish(); return }
      if (typeof point === 'function') { const q = point(); if (!q) { hide(); return } v.copy(q) }
      else if ((point as THREE.Object3D).isObject3D) (point as THREE.Object3D).getWorldPosition(v)
      else v.copy(point as THREE.Vector3)
      v.project(camera)
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { hide(); return }
      const e = ensure()
      e.classList.toggle('still', reduced)
      let x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight
      if (innerWidth <= 760) y = Math.min(y, innerHeight - 84 - 10)
      const w = e.offsetWidth || 130, left = x + w - 7 > innerWidth - 8
      e.classList.toggle('left', left)
      e.style.transform = `translate(${Math.round(left ? x + 7 - w : x - 7)}px,${Math.round(y - 7)}px)`
      e.classList.add('on')
      if (!watch) watch = window.setInterval(() => { if (performance.now() - lastUp > 250) { hide() } }, 250)
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------- keyboard / screen-reader twin of a canvas control
let srStyled = false
export interface SrAction { setLabel(t: string): void; /** call every frame the stage is held: true = focusable and in the reading order */ setActive(on: boolean): void; readonly el: HTMLButtonElement }
/**
 * A visually hidden, focusable button that does what a click on the 3D thing does (the canvas is invisible to the keyboard and to screen readers). It appears as a
 * small pill above the HUD while it has keyboard focus, so focus is never lost. It is removed from the tab order while its stage is not held (a stage that stops
 * updating because it left the screen is caught by a 250 ms watchdog).
 */
export function srAction(label: string, onActivate: () => void): SrAction {
  if (!srStyled) {
    srStyled = true
    const st = document.createElement('style')
    st.textContent = '.sr-act{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:90;clip:rect(0 0 0 0);clip-path:inset(50%);width:1px;height:1px;overflow:hidden;white-space:nowrap;padding:0;margin:0;border:0;background:transparent;color:#f1ece0;font:600 11px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase}.sr-act:focus-visible{clip:auto;clip-path:none;width:auto;height:auto;overflow:visible;padding:9px 14px;border-radius:999px;background:rgba(10,10,12,.88);border:1px solid #ff6a3d;outline:none}.sr-act[hidden]{display:none}'
    document.head.append(st)
  }
  const el = document.createElement('button'); el.type = 'button'; el.className = 'sr-act'; el.textContent = label; el.hidden = true; el.tabIndex = -1
  el.addEventListener('click', e => { e.preventDefault(); onActivate() })
  document.body.append(el)
  let up = 0, on = false, watch = 0
  const off = () => { on = false; el.hidden = true; el.tabIndex = -1; if (watch) { clearInterval(watch); watch = 0 } }
  return {
    el,
    setLabel(t) { if (el.textContent !== t) el.textContent = t },
    setActive(a) {
      up = performance.now()
      if (!a) { if (on) off(); return }
      if (!on) { on = true; el.hidden = false; el.tabIndex = 0 }
      if (!watch) watch = window.setInterval(() => { if (performance.now() - up > 250) off() }, 250)
    },
  }
}
