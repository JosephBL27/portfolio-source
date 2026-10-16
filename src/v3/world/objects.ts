// The solid things in the shared v4 scene, drawn next to the particle field:
//   * the HUB: one big orb TV at the centre of the world. It turns to face the camera as the camera orbits,
//     plays the reel of whichever area is current (tear + static on a change), powers on at the 'name'
//     waypoint and powers off to a line and a dot on the closing line (powerOff(k)).
//   * an ARC of small orb TVs per area, one per project, facing the area's camera. Featured ones (the
//     waypoint's `tvs`) lift and play live; only the three nearest the view axis render a reel each frame,
//     the rest hold their last frame. Projects without a reel get a poster (name + real key figure).
//   * the GLASS BRAIN at the Mind area (brainglass.ts).
// CRT scanlines / warp live only inside screen materials; shells and chain are plain PBR.
//
//   const world = createWorld(field, { reels: REELS, onOpen: (id, rect) => openCase(id, rect) })
//   field.onFrame((t, dt) => world.update(flightState, t, dt))
//   world.pick(x, y); world.screenRect(id | 'hub'); world.powerOff(k)
//   world.hitTest(x, y) -> { id, part }; world.partScreen(id, part) -> { x, y, r }  (parts: screen body dial btnA btnB)
// The sets are OPERABLE (this file owns the pointer): the hub's dial turns through magnet detents and changes channel, its
// two buttons are power and channel-surf, a press on any body spins it with inertia (it springs back to face the camera),
// and a clean click on a screen opens the work. A press that moves > 6 px never opens. Empty space is the POV extra's.
// Integration needs from the field: (1) the post composer's render targets must have a depth buffer
// (createPost makes them depthBuffer:false; the TVs are opaque and depth-tested), ideally samples:4;
// (2) call update() from field.onFrame, and run the onBeforeRender callbacks right before post.render();
// (3) this module writes sRGB-encoded colour (the post stack is display-referred): pass display:false
// if the post ever adds its own sRGB output pass.
import * as THREE from 'three'
import type { ReelDef } from '../../reels/types'
import { projects } from '../../data'
import { state as app } from '../../state'
import { AREAS, HUB, WAYPOINTS, area as areaOf, type Area, type AreaId, type Waypoint } from './layout'
import { createKit, createHubTV, createMiniTV, createCardTexture, displayReferred, ReelPipe, PICTURE_EDGE, type HubTV, type MiniTV, type TVKit } from './tvset'
import { createBrainGlass, type BrainGlass } from './brainglass'
import { occ, findSlot, labelWidth, hitsAny, writeHoles, type Box, type Slot as TvSlot } from './occlusion'
import { PIVOT_Y } from '../../gl/tv'

// ------------------------------------------------------------------ public types
export interface WorldField {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  addObject(o: THREE.Object3D): void
  /** run `cb` once per frame just before the scene is rendered (the world draws its reel render targets here) */
  onBeforeRender(cb: () => void): void
  /** v11: the particle Points and the displayed morph pair; the guard reads the subject's bounds from the morph shader's bound state */
  points?: THREE.Points
  shown?: { a: string; b: string; mix: number }
}
/** What the flight tells the world each frame. Structural: `flight.ts`'s FlightState satisfies it. */
export interface FlightState {
  /** waypoint index we are at / leaving (flight.ts), or an id / waypoint; fractional indexes are fine */
  wp: number | string | { id: string }
  /** waypoint index we are heading to, and the eased leg progress (flight.ts). With both, the world sees a fractional index. */
  next?: number
  t?: number
  /** current area; defaults to the waypoint's area */
  area?: AreaId | string | { id: string }
  /** flight.ts camera speed shape 0..1 (unused for now) */
  speed?: number
  cam?: unknown
  /** v10: which copy panels are up (origin / destination overlay id) and how visible each is, 0..1: the TVs keep clear of the lanes in proportion */
  overlay?: string
  overlayNext?: string
  overlayOut?: number
  overlayIn?: number
  /** at rest on a waypoint (flight.ts); the dial's affordance shows only while the world stop dwells */
  dwelling?: boolean
}
export type WorldEvent = 'hub:poweron' | 'hub:poweroff' | 'hub:channel' | 'hub:detent' | 'hub:button' | 'tv:on' | 'tv:hover' | 'tv:open' | 'tv:grab' | 'tv:spin' | 'tv:release' | 'brain:pulse'
export interface WorldInfo { id?: string; area?: AreaId; k?: number; i?: number; ch?: number; which?: 'A' | 'B'; down?: boolean; speed?: number }
/** what a pointer can land on: the hub has all five, a small set only 'body' */
export type Part = 'screen' | 'body' | 'dial' | 'btnA' | 'btnB'
export interface PartHit { id: string; part: Part }
export interface WorldOpts {
  reels: ReelDef[]
  onOpen(projectId: string, rect: DOMRect | null): void
  /** sound / UI hooks */
  onEvent?(name: WorldEvent, info?: WorldInfo): void
  /** true while something covers the world (the case view): the pointer is ignored */
  blocked?(): boolean
  /** hub TV scale (default 3: the orb is 6 units across, ~9 tall with the chain ring) */
  hubScale?: number
  /** glass brain radius (default 2.7) */
  brainRadius?: number
  /** per-area overrides for the arc of small TVs */
  arcs?: Partial<Record<AreaId, Partial<ArcCfg>>>
  /** radius of each small TV (default 0.9) */
  miniRadius?: number
  /** attach pointer listeners (on window, acting on presses that land on the canvas): hover, dial, buttons, spin, click to open (default true) */
  interactive?: boolean
  /** encode output as sRGB inside the TV/brain materials (the v3 post is display-referred). Default true. */
  display?: boolean
}
export interface GlowSource { position: THREE.Vector3; color: THREE.Color; intensity: number; radius: number }
export interface World {
  update(state: FlightState, t: number, dt: number): void
  /** viewport coords -> project id of the small TV under the pointer (or the hub's current project on its screen), else null */
  pick(clientX: number, clientY: number): string | null
  /** projected picture rectangle in client px, or null when off screen / behind the camera */
  screenRect(projectId: string | 'hub'): DOMRect | null
  /** 0 = on .. 1 = fully off: raster collapses to a line, then a dot, then black. Reversible. */
  powerOff(k: number): void
  /** hover state for a project (the UI calls this with pick()'s result; also done internally when interactive) */
  setHover(projectId: string | null): void
  /** what is under the pointer: { id: 'hub' | projectId, part }, or null for empty space (generous around the dial and buttons) */
  hitTest(clientX: number, clientY: number): PartHit | null
  /** where a part is on screen (client px, r = its hit radius in px), or null when off screen / behind the camera */
  partScreen(id: string, part: Part): { x: number; y: number; r: number } | null
  /** true while a TV is being dragged (moved > 6 px) and for 250 ms after: post-drag clicks must be ignored */
  readonly dragging: boolean
  /** the POV extra reports its own drag here so the world keeps the one shared flag */
  markDrag(active: boolean): void
  /** displayed pose of a set: yaw (rad, as drawn), spin (the visitor's offset from camera-facing), grabbed */
  tvPose(id: string | 'hub'): { yaw: number; spin: number; grabbed: boolean } | null
  /** step the hub channel (keyboard [ and ]); holds like the dial does */
  nudgeChannel(d: number): void
  /** the hub's power button (keyboard P) */
  togglePower(): void
  /** open a project as if its TV was clicked */
  open(projectId: string): void
  /** light sources the particle shader can use: the hub screen and the live small TVs */
  glow(): GlowSource[]
  readonly hubProject: string | null
  readonly brain: BrainGlass
  readonly root: THREE.Group
  stats(): { minis: number; live: number; awake: boolean; hubOn: number; /** v20: 0 on the name screen (no TV, chain or rings), 1 from the world stop */ hubShow: number; /** power-off collapse 0..1 */ hubOff: number; hubChannel: number; hubProject: string | null; /** the visitor chose the channel and it holds */ hubHeld: boolean; drawCalls: number }
  /** v11: projected boxes (client px) of every TV on screen and its visibility 0..1: 'hub' (the shell), 'hub-chain', or a project id. For tests and the guard's own report. */
  tvRects(): { id: string; l: number; t: number; r: number; b: number; shown: number }[]
  /** v11: what the TVs keep clear of this frame (client px): the subject's bounds, the copy, the HUD, and the featured TV's slot */
  zones(): { subject: Box[]; copy: Box[]; hud: Box[]; slot: Box | null }
  dispose(): void
}

// ------------------------------------------------------------------ helpers
const clamp = THREE.MathUtils.clamp
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const TAU = Math.PI * 2
const damp = (cur: number, goal: number, tau: number, dt: number) => goal + (cur - goal) * Math.exp(-dt / Math.max(1e-4, tau))
const hash01 = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return ((h >>> 0) % 10007) / 10007 }
const easeOutBack = (x: number) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }

class Spring {
  v = 0
  target: number
  constructor(public x: number, public k: number, public c: number) { this.target = x }
  step(dt: number) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n
    for (let i = 0; i < n; i++) { const a = -this.k * (this.x - this.target) - this.c * this.v; this.v += a * h; this.x += this.v * h }
  }
  snap(x = this.target) { this.x = x; this.target = x; this.v = 0 }
}

const wpIndexOf = (w: FlightState['wp']): number => {
  if (typeof w === 'number') return clamp(w, 0, WAYPOINTS.length - 1)
  const id = typeof w === 'string' ? w : w.id
  const i = WAYPOINTS.findIndex(x => x.id === id)
  return i < 0 ? 0 : i
}
const areaIdOf = (a: FlightState['area'], fallback: AreaId): AreaId => (a == null ? fallback : (typeof a === 'string' ? a : a.id) as AreaId)

// ------------------------------------------------------------------ arcs
/** Per-area arc of small TVs: a concave bow behind the form, seen from the area's camera. All numbers tunable per area. */
export interface ArcCfg {
  /** distance of the arc from the area centre */
  radius: number
  /** angle from the far axis (the way back toward the hub) of the innermost / outermost flanking pair, degrees */
  phi: [number, number]
  /** how far the arc recedes behind the form (1 = a true circle) */
  depth: number
  /** extra height of the crown TV (odd counts) */
  crownY: number
}
const ARC_DEFAULT: ArcCfg = { radius: 6.4, phi: [36, 56], depth: 0.8, crownY: 2.8 }
type Slot = { phi: number; crown: boolean }
/** left-to-right slots: pairs flanking the form, plus a crown when the count is odd */
function arcSlots(n: number, cfg: ArcCfg): Slot[] {
  const pairs = Math.floor(n / 2), out: Slot[] = []
  const lo = cfg.phi[0] - (pairs >= 3 ? 5 : 0), hi = cfg.phi[1] + (pairs >= 3 ? 3 : 0)
  for (let k = 0; k < pairs; k++) {
    const phi = pairs === 1 ? lo + (hi - lo) * 0.25 : lo + (hi - lo) * (k / (pairs - 1))
    out.push({ phi: -phi, crown: false }, { phi, crown: false })
  }
  if (n % 2 === 1) out.push({ phi: 0, crown: true })
  return out.sort((a, b) => a.phi - b.phi)
}
/** the arc is centred on the mean direction from the area centre to its waypoints' cameras, so it stays symmetric while the camera swings around the form */
function arcAxis(a: Area): number {
  let sx = 0, sz = 0
  for (const w of WAYPOINTS) if (w.area === a.id) { const dx = w.cam.pos[0] - a.center[0], dz = w.cam.pos[2] - a.center[2]; const l = Math.hypot(dx, dz) || 1; sx += dx / l; sz += dz / l }
  return sx || sz ? Math.atan2(sx, sz) : (a.angle * Math.PI) / 180
}
function arcPosition(a: Area, slot: Slot, k: number, cfg: ArcCfg): THREE.Vector3 {
  const ang = arcAxis(a)
  const out = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang))      // away from the hub
  const tan = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang))     // camera-right when looking inward
  const phi = (slot.phi * Math.PI) / 180
  const p = new THREE.Vector3(...a.center)
  p.addScaledVector(tan, Math.sin(phi) * cfg.radius).addScaledVector(out, -Math.cos(phi) * cfg.radius * (slot.crown ? 1.0 : cfg.depth))
  p.y += slot.crown ? cfg.crownY : 0.55 * (k % 2 ? 1 : -1) + 0.3 * Math.sin(k * 1.9 + a.angle * 0.05)
  return p
}

// ------------------------------------------------------------------ v11: the guard (occlusion.ts)
// The subject (the particle form), the copy and the HUD own the frame. Arcs of small TVs show only at the hub / world overview and in flight; at an area
// waypoint ONE featured TV sits in a small reserved slot (lower corner, side opposite the copy). Every frame each TV (and the hub shell + chain) is projected,
// and one that touches a zone (subject, copy) fades out in ~0.25 s and cannot be picked while it is gone. Hysteresis: it hides at 4 px, returns only 22 px clear.
const GUARD_IN = 4, GUARD_OUT = 22
const MAX_MINI_PX = 0.15   // a small set bigger than this fraction of the screen height (the camera flew close) is hidden: it would block the view

// ------------------------------------------------------------------ world
interface Mini {
  id: string
  area: Area
  name: string
  reel: number            // channel in opts.reels, -1 for a poster
  tv: MiniTV
  tex: THREE.Texture
  rt: THREE.WebGLRenderTarget | null
  base: THREE.Vector3
  pos: THREE.Vector3
  awake: boolean
  wakeAt: number
  power: number
  pop: number
  feat: number
  hover: number
  hoverGoal: number
  flash: number
  yaw: number
  pitch: number
  /** the visitor's spin on top of camera-facing (springs back to the nearest whole turn) */
  sy: Spring
  sx: Spring
  grab: boolean
  rendered: boolean
  emitted: boolean
  live: boolean
  seed: number
  score: number
  phase: number
  accent: THREE.Color
  /** v11: 0..1 hidden amount (1 - how visible): the arc / slot weight and the guard fade, folded together */
  fade: number
  /** v11 guard: hidden by the occlusion guard (with hysteresis) and its eased 0..1 amount */
  gh: boolean
  gf: number
  /** v11: the featured TV's pinned screen position (client px), eased */
  px: number
  py: number
  pinned: boolean
  /** v11: projected box of the TV at full size (client px) and whether it is in front of the camera */
  box: Box
  boxOk: boolean
}

export function createWorld(field: WorldField, opts: WorldOpts): World {
  const { renderer, camera } = field
  const display = opts.display !== false
  const reels = opts.reels
  const reelOf = (pid: string) => reels.findIndex(r => r.projectId === pid)
  const reduced = () => app.reduced
  const emit = (n: WorldEvent, info?: WorldInfo) => { try { opts.onEvent?.(n, info) } catch (e) { console.error(e) } }

  const root = new THREE.Group(); root.name = 'world-objects'
  field.addObject(root)
  const kit: TVKit = createKit(renderer, display)
  const pipe = new ReelPipe(renderer, reels)
  pipe.precompile()

  // lights: the shells are lit mostly by the environment; these add a rim and a soft key
  const key = new THREE.DirectionalLight(0xfff1e4, 0.7); key.position.set(-30, 40, 40)
  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.0); rim.position.set(36, 10, -32)
  root.add(key, rim)

  // ---------- hub
  const S = opts.hubScale ?? 3
  const defaultCh = Math.max(0, reelOf('second-brain'))
  const hubRT = pipe.makeTarget(768, 576)
  const hub: HubTV = createHubTV(kit, hubRT.texture, { scale: S, channels: Math.max(1, reels.length), display })
  hub.root.position.set(...HUB)
  root.add(hub.root)
  const H = {
    ch: defaultCh,            // channel currently on the glass
    want: defaultCh,
    change: { t: -1, swapped: true },
    power: 0, goal: 0,
    offK: 0,
    yaw: new Spring(0, 6, 2.6), pitch: new Spring(0, 30, 7.5), dial: new Spring(0, 260, 17),
    dialK: 0, dialPrev: 0, dialStat: 0,             // v15: the dial's turning speed -> a CRT-static flicker on the glass
    osdT: 99, flash: 0, seen: false,
    project: null as string | null,
    lastRead: -1e9, pending: false, nRead: 0,
    visible: false, frac: 0,
    avg: new THREE.Color(), avgGoal: [new THREE.Color(), new THREE.Color(), new THREE.Color()], lightCol: new THREE.Color(),
    seed: 0.37,
    // operable: the visitor's choices, held until the scroll moves on
    show: 0,                                                 // v20: 0..1 how much of the hub set (TV + chain) is brought in (0 on the name screen, 1 from the world stop)
    gh: false, gf: 0,                                       // v11 guard: hidden by the occlusion guard (hysteresis) and its eased 0..1 amount
    fit: 1, fitGoal: 1,                                      // v11 guard: at the hub waypoints the set squeezes (down to 0.5) to clear the copy instead of vanishing
    userCh: null as number | null, userWp: '',           // a channel picked on the dial / keys / surf button holds while we dwell at that waypoint
    manual: null as 0 | 1 | null, manualAuto: 0, autoNow: 0,         // power button: overrides the scroll's power until the scroll crosses the on/off threshold
    surf: null as { list: number[]; acc: number } | null,
    pressA: new Spring(0, 900, 38), pressB: new Spring(0, 900, 38),
    grab: false, dialDrag: false,                          // the pointer owns the yaw / pitch springs, the dial spring
  }
  const NCH = Math.max(1, reels.length)
  const STEP = (Math.PI * 2) / NCH
  const drawChannel = () => { hub.osd.draw(H.ch, reels[H.ch]?.title ?? ''); hub.setTick(H.ch); H.osdT = 0; H.lastRead = -1e9; H.nRead = 0 }   // r7: a new picture: sample its colour at the next chance
  drawChannel(); H.osdT = 99
  document.fonts?.load?.('600 40px "IBM Plex Mono"').then(() => hub.osd.draw(H.ch, reels[H.ch]?.title ?? '')).catch(() => {})

  // the screen as light: a 3x1 average of the hub reel, read back a few times a second
  const tinyRT = new THREE.WebGLRenderTarget(3, 1, { depthBuffer: false })
  const tinyMat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: hubRT.texture } },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D uTex; void main() { vec2 uv = vec2(gl_FragCoord.x / 3.0, 0.5); gl_FragColor = vec4(textureLod(uTex, uv, 7.0).rgb, 1.0); }',
    depthTest: false, depthWrite: false,
  })
  const tinyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), tinyMat); tinyQuad.frustumCulled = false
  const tinyScene = new THREE.Scene(); tinyScene.add(tinyQuad)
  const tinyCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const tinyBuf = new Uint8Array(12)

  // ---------- minis
  const minis: Mini[] = []
  const miniById = new Map<string, Mini>()
  const R = opts.miniRadius ?? 0.9
  const pjById = new Map(projects.map(p => [p.id, p]))
  for (const a of AREAS) {
    const n = a.projects.length
    const cfg: ArcCfg = { ...ARC_DEFAULT, ...(opts.arcs?.[a.id] ?? {}) }
    const slots = arcSlots(n, cfg)
    a.projects.forEach((pid, i) => {
      const pj = pjById.get(pid)
      const reel = reelOf(pid)
      let tex: THREE.Texture, rt: THREE.WebGLRenderTarget | null = null
      if (reel >= 0) { rt = pipe.makeTarget(320, 240); tex = rt.texture }
      else tex = createCardTexture({ name: pj?.name ?? pid, period: pj?.period ?? '', kind: pj?.kind ?? '', value: pj?.keyFigure.value ?? '', label: pj?.keyFigure.label ?? '', accent: a.accent })
      const tv = createMiniTV(kit, tex, display)
      tv.root.visible = false
      root.add(tv.root)
      const base = arcPosition(a, slots[i], i, cfg)
      const accent = new THREE.Color(reel >= 0 ? reels[reel].colors.accent : a.accent)
      const m: Mini = {
        id: pid, area: a, name: pj?.name ?? pid, reel, tv, tex, rt, base, pos: base.clone(),
        awake: false, wakeAt: 0, power: 0, pop: 0, feat: 0, hover: 0, hoverGoal: 0, flash: 0, yaw: 0, pitch: 0, sy: new Spring(0, 10, 2.4), sx: new Spring(0, 16, 3.6), grab: false,
        rendered: reel < 0, emitted: false, live: false, seed: hash01(pid), score: -1, phase: hash01(pid + 'b') * 6.28, accent, fade: 0,
        gh: false, gf: 0, px: 0, py: 0, pinned: false, box: { l: 0, t: 0, r: 0, b: 0 }, boxOk: false,
      }
      tv.root.position.copy(base)
      minis.push(m); miniById.set(pid, m)
    })
  }

  // ---------- brain
  const mindArea = areaOf('mind')!
  const brain: BrainGlass = createBrainGlass({
    envMap: kit.env, radius: opts.brainRadius ?? 2.7, at: mindArea.center, display,
    onPulse: () => emit('brain:pulse', { area: 'mind' }),
  })
  root.add(brain.group)

  // compile every program up front (the minis and the brain are hidden until the cascade)
  {
    const vis = [root, brain.group, ...minis.map(m => m.tv.root)].map(o => [o, o.visible] as const)
    brain.group.visible = true; minis.forEach(m => { m.tv.root.visible = true })
    renderer.compileAsync(root, camera).catch(() => {})
    vis.forEach(([o, v]) => { o.visible = v })
    brain.group.visible = false; minis.forEach(m => { m.tv.root.visible = false })
  }

  // ---------- per-frame state
  let awakeAll = false
  let brainT0 = 0
  let nowT = 0, frameNo = 0, flying = false, lastIdx = -1
  let curWp: Waypoint = WAYPOINTS[0]
  let curArea: AreaId = 'hub'
  let hoverId: string | null = null
  let calm = 0   // 1 in the About room: every screen turns down so the paragraph is the loudest thing
  let hubWasOn = false
  // ---------- v11 frame-wide guard state (prepFrame)
  let CR: DOMRect = renderer.domElement.getBoundingClientRect()
  let tanV = 0.3
  let hubScaleLast = S
  const pp = { x: 0, y: 0, ppu: 0 }
  const hubShell: Box = { l: 0, t: 0, r: 0, b: 0 }, hubChain: Box = { l: 0, t: 0, r: 0, b: 0 }
  let hubShellOk = false, hubChainOk = false
  const slotCache = new Map<string, { slot: TvSlot | null; at: number }>()
  let slotNow: TvSlot | null = null
  let brainGoal = 1, brainK = 1   // v11: the glass brain belongs to the Mind area: it stands down (shrinks, dims) while another area has the frame
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4()
  const camPos = new THREE.Vector3(), camFwd = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3()
  const camRight = new THREE.Vector3(), camUp = new THREE.Vector3()
  const hubPos = new THREE.Vector3(...HUB)
  const sphere = new THREE.Sphere()
  let liveSet: Mini[] = []
  let jobs: Mini[] = []

  // ---------- v11 guard helpers
  /** client px of a world point at the camera's current pose (pp), false when it is behind the camera */
  function viewPt(p: THREE.Vector3): boolean {
    tmp2.copy(p).sub(camPos)
    const dz = tmp2.dot(camFwd)
    if (dz < camera.near + 0.05) return false
    pp.ppu = CR.height / (2 * dz * tanV)
    pp.x = CR.left + CR.width / 2 + tmp2.dot(camRight) * pp.ppu
    pp.y = CR.top + CR.height / 2 - tmp2.dot(camUp) * pp.ppu
    return true
  }
  /** the box of a sphere (centre p, world radius wr) in client px; its pixel radius, or -1 behind the camera */
  function ballBox(p: THREE.Vector3, wr: number, out: Box): number {
    if (!viewPt(p)) return -1
    const rr = wr * pp.ppu
    out.l = pp.x - rr; out.r = pp.x + rr; out.t = pp.y - rr; out.b = pp.y + rr
    return rr
  }
  const hw1 = new THREE.Vector3(), hw2 = new THREE.Vector3()
  /** a point of the hub's model frame in world space at FULL size (the guard's boxes never shrink with the fade) */
  function hubWorld(x: number, y: number, z: number, out: THREE.Vector3) {
    out.set(x, y, z); hub.spin.localToWorld(out)
    out.sub(hubPos).multiplyScalar(S / Math.max(1e-4, hubScaleLast)).add(hubPos)
    return out
  }
  /** the hub's shell (a circle) and chain (a thin strip up out of the frame) as boxes in client px */
  function hubBoxes() {
    hubShellOk = ballBox(hubWorld(0, 0, 0, hw1), 1.04 * S, hubShell) >= 0
    hubChainOk = false
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, cw = 0
    for (const u of [0, 0.02, 0.06, 0.15, 0.3, 0.6, 1]) {
      if (!viewPt(hubWorld(0, PIVOT_Y + 16 * u, 0, hw2))) continue
      cw = Math.max(cw, 0.34 * S * pp.ppu + 2)
      l = Math.min(l, pp.x); r = Math.max(r, pp.x); t = Math.min(t, pp.y); b = Math.max(b, pp.y)
      hubChainOk = true
    }
    if (hubChainOk) { hubChain.l = l - cw; hubChain.r = r + cw; hubChain.t = Math.max(CR.top, t); hubChain.b = Math.min(CR.bottom, b) }
    if (hubChainOk && hubChain.b <= hubChain.t) hubChainOk = false
  }
  /** once per frame, before the hub and the minis: camera basis, the zones (subject / copy / HUD), the shader holes, the hub's boxes and its guard */
  function prepFrame(dt: number) {
    camera.getWorldDirection(camFwd)
    camRight.setFromMatrixColumn(camera.matrixWorld, 0); camUp.setFromMatrixColumn(camera.matrixWorld, 1)
    CR = renderer.domElement.getBoundingClientRect()
    tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const fx = field
    if (fx.points && fx.shown) occ.update({ camera, canvas: renderer.domElement, points: fx.points, shown: fx.shown }, performance.now())
    writeHoles(window.innerWidth, window.innerHeight)
    hubBoxes()
    // the hub: at a hub waypoint it squeezes (about its own centre, down to 0.5) until its boxes clear the zones: the finale's TV must stay. Elsewhere it simply goes.
    const zs = occ.zones, hubWp = curWp.area === 'hub'
    const cx = (hubShell.l + hubShell.r) / 2, cy = (hubShell.t + hubShell.b) / 2
    const fits = (k: number, m: number) => {
      if (hubShellOk && hitsAny({ l: cx - (cx - hubShell.l) * k, r: cx + (hubShell.r - cx) * k, t: cy - (cy - hubShell.t) * k, b: cy + (hubShell.b - cy) * k }, zs, m)) return false
      // v15: on a phone the chain (a thin strip up out of the frame) always crosses the title above the set, so checking it hid the whole hub at the world stop and the
      // visitor never saw the one thing they are meant to tap. At the hub waypoints in portrait only the shell has to clear the copy; the chain runs behind the title.
      if (hubChainOk && !(hubWp && CR.width < 760)) {
        const xc = (hubChain.l + hubChain.r) / 2
        if (hitsAny({ l: xc - (xc - hubChain.l) * k, r: xc + (hubChain.r - xc) * k, t: hubChain.t, b: hubShellOk ? cy - (cy - hubShell.t) * k : hubChain.b }, zs, m)) return false
      }
      return true
    }
    const fitK = (m: number) => { for (const k of hubWp ? [1, 0.93, 0.86, 0.79, 0.72, 0.65, 0.58, 0.5] : [1]) if (fits(k, m)) return k; return 0 }
    const kA = fitK(GUARD_IN), kB = fitK(GUARD_OUT)   // must / comfortable: shrink when the current size touches a zone, grow back only once there is room to spare
    let goal = H.fitGoal
    if (goal === 0 ? kB > 0 : kA < goal) goal = goal === 0 ? kB : kA
    else if (kB > goal) goal = kB
    H.fitGoal = goal
    H.gh = goal === 0
    H.fit = reduced() ? Math.max(goal, 0.5) : damp(H.fit, Math.max(goal, 0.5), 0.16, dt)
    H.gf = reduced() ? (H.gh ? 1 : 0) : damp(H.gf, H.gh ? 1 : 0, 0.07, dt)
  }
  /** the reserved spot of a waypoint's featured TV, re-found ~6x a second and kept while it stays clear */
  function slotOf(w: Waypoint, now: number, vw: number, vh: number): TvSlot | null {
    const c = slotCache.get(w.id)
    if (c && now - c.at < 160) return c.slot
    const rPx = Math.round(clamp(0.062 * Math.min(vh, vw * 1.2), 28, 56))
    const extra: Box[] = []
    if (H.gf < 0.5 && H.show > 0.5) { if (hubShellOk) extra.push(hubShell); if (hubChainOk) extra.push(hubChain) }
    const fid = w.tvs?.[0], nm = fid ? miniById.get(fid)?.name : undefined   // the slot's box is as wide as the tag under the TV (a long name ran onto the radar)
    const slot = findSlot(vw, vh, rPx, occ.zones, occ.hud, extra, occ.copySide, c?.slot ?? null, nm ? labelWidth(nm, vw <= 760) : 0)
    slotCache.set(w.id, { slot, at: now })
    return slot
  }

  // ---------- v15: the dial's affordance (the world stop's hub is the one thing the visitor is meant to operate)
  // A slow pulse ring on the knob plus a 'CH 02 / 08' micro-label of the channel on the glass and the channel count, while the world stop dwells.
  // UI-state numerals: data-proof="skip", aria-hidden. The ring stops once the visitor has turned the dial; the label stays while we dwell.
  let dialUsed = false
  const aff = document.createElement('div')
  aff.id = 'hub-aff'; aff.setAttribute('aria-hidden', 'true'); aff.setAttribute('data-proof', 'skip')
  aff.innerHTML = '<i class="ring"></i><i class="ring r2"></i><span class="lab"></span>'
  const affLab = aff.querySelector('.lab') as HTMLElement
  const affStyle = document.createElement('style')
  affStyle.textContent = `#hub-aff { position: fixed; left: 0; top: 0; z-index: var(--z-anchors, 50); pointer-events: none; opacity: 0; transition: opacity .6s var(--ease-out, ease-out); will-change: transform, opacity; --r: 18px }
#hub-aff.on { opacity: 1 }
#hub-aff .ring { position: absolute; left: calc(var(--r) * -1); top: calc(var(--r) * -1); width: calc(var(--r) * 2); height: calc(var(--r) * 2); box-sizing: border-box; border-radius: 50%; border: 1.5px solid rgba(237, 230, 214, .8); box-shadow: 0 0 10px rgba(237, 230, 214, .25); opacity: 0; transform: scale(.85); animation: hub-aff-pulse 2.8s cubic-bezier(.2, .6, .3, 1) infinite }
#hub-aff .ring.r2 { animation-delay: 1.4s }
#hub-aff.used .ring { display: none }
#hub-aff .lab { position: absolute; left: calc(var(--r) + 14px); top: -10px; padding: 4px 8px; border-radius: 999px; background: rgba(5, 5, 6, .72); color: var(--ink, #EDE6D6); font: 500 10px/1 var(--mono, "IBM Plex Mono", ui-monospace, monospace); letter-spacing: .14em; white-space: nowrap }
#hub-aff.flip .lab { left: auto; right: calc(var(--r) + 14px) }
@keyframes hub-aff-pulse { 0% { opacity: .85; transform: scale(.85) } 70% { opacity: 0; transform: scale(1.75) } 100% { opacity: 0; transform: scale(1.75) } }
html.rm #hub-aff .ring { animation: none; opacity: .55; transform: scale(1) } html.rm #hub-aff .ring.r2 { display: none } html.rm #hub-aff { transition: none }`
  document.head.append(affStyle); document.body.append(aff)
  let affOn = false, affTxt = ''
  function updateAff(st: FlightState) {
    const html_ = document.documentElement
    const here = !!st.dwelling && curWp.id === 'world' && H.power > 0.9 && H.offK < 0.01 && H.gf < 0.35 && !blocked() && !html_.classList.contains('in-index')
    let d: { x: number; y: number; r: number } | null = null
    if (here) d = partScreen('hub', 'dial')
    const on = !!d
    if (on !== affOn) { affOn = on; aff.classList.toggle('on', on) }
    if (!d) return
    const txt = `CH ${String(H.ch + 1).padStart(2, '0')} / ${String(NCH).padStart(2, '0')}`
    if (txt !== affTxt) { affTxt = txt; affLab.textContent = txt }
    aff.style.setProperty('--r', `${(d.r + 4).toFixed(1)}px`)
    aff.style.transform = `translate3d(${d.x.toFixed(1)}px, ${d.y.toFixed(1)}px, 0)`
    aff.classList.toggle('flip', d.x > window.innerWidth - 150)
    aff.classList.toggle('used', dialUsed)
  }

  // ---------- hub channel
  const hubProjectFor = (wp: Waypoint): string | null => {
    const has = (ids?: string[]) => ids?.find(id => reelOf(id) >= 0) ?? null
    return has(wp.tvs) ?? (wp.area !== 'hub' ? has(areaOf(wp.area)?.projects) : null)
  }
  /** put `ch` on the glass: the scroll's own change plays the whole 350 ms tear; `fast` (dial / surf) swaps at once and plays the static burst */
  const applyChannel = (ch: number, fast = false): boolean => {
    if (ch === H.want) return false
    H.want = ch
    if (H.power < 0.3 || reduced()) { H.ch = ch; H.change.t = -1; H.change.swapped = true; drawChannel(); H.osdT = 0 }
    else if (fast) { H.ch = ch; H.change = { t: 140, swapped: true }; drawChannel(); H.flash = Math.max(H.flash, 0.3) }
    else { H.change = { t: 0, swapped: false } }
    return true
  }
  const setHubChannel = (ch: number) => {
    if (applyChannel(ch)) emit('hub:channel', { i: ch, id: reels[ch]?.projectId })
  }
  const mod = (n: number, m: number) => ((n % m) + m) % m
  /** the visitor's pick: holds while we dwell at this waypoint (the scroll moving on resumes the automatic channels) */
  const userChannel = (ch: number) => {
    const changed = applyChannel(ch, true)
    H.userCh = H.want; H.userWp = curWp.id
    H.project = reels[H.want]?.projectId ?? H.project
    if (changed) { dialUsed = true; emit('hub:detent', { ch: H.want }) }
    return changed
  }
  const settleChannel = () => emit('hub:channel', { i: H.want, id: reels[H.want]?.projectId })

  // ---------- update
  function updateHub(t: number, dt: number, idx: number) {
    const rd = reduced()
    // power: on at the 'name' waypoint, back off if the visitor scrolls back before it; the power button overrides it until the scroll crosses that line again
    // v20: the name screen is the cosmos (no hanging TV behind the name): the set stays gone through 'clouds' and 'name', is brought in over the leg into 'world' and powers on as it
    // arrives (the hub:poweron cue fires there, since the world owns the cue)
    const worldI = Math.max(1, WAYPOINTS.findIndex(w => w.id === 'world'))
    H.show = smooth(1.02, 1.3, idx)   // the set drops in behind the letters as they break apart, full size before the dive crosses the glass (idx 1.4)
    const auto = idx >= worldI - 0.3 ? 1 : 0
    H.autoNow = auto
    if (H.manual != null && H.manualAuto !== auto) H.manual = null
    H.goal = H.manual ?? auto
    const rate = H.goal > H.power ? 1 / 0.72 : 1 / 0.38
    const prev = H.power
    H.power = rd ? H.goal : H.power + clamp(H.goal - H.power, -rate * dt, rate * dt)
    if (H.goal > 0 && prev <= 0.001 && H.power > 0.001) { emit('hub:poweron'); H.flash = 0.6; H.osdT = 0 }
    if (H.goal === 0 && prev > 0.2 && H.power <= 0.2) emit('hub:poweroff', { k: 0 })

    // face the camera (spring: a little overshoot as the camera orbits)
    camera.getWorldPosition(camPos)
    const dx = camPos.x - hubPos.x, dz = camPos.z - hubPos.z, dy = camPos.y - hubPos.y
    const yawGoal = Math.atan2(dx, dz) - 0.32   // a quarter turn short of square-on, as in v2: the dial side shows and the orb reads as an object
    H.yaw.target = H.yaw.x + wrapPi(yawGoal - H.yaw.x)
    H.pitch.target = clamp(-Math.atan2(dy, Math.hypot(dx, dz)) * 0.7, -0.3, 0.3)
    if (H.grab) { /* the pointer holds the set: yaw / pitch are set by the drag */ }
    else if (rd) { H.yaw.snap(H.yaw.target); H.pitch.snap(H.pitch.target) }
    else { H.yaw.k = 6; H.yaw.c = 2.6; H.yaw.step(dt); H.pitch.step(dt) }
    const sway = rd ? 0 : 1
    hub.pivot.position.y = 1.42 + Math.sin(t * 0.85) * 0.035 * sway
    hub.pivot.rotation.z = Math.sin(t * 0.53) * 0.018 * sway
    hub.pivot.rotation.x = Math.sin(t * 0.41 + 1.3) * 0.012 * sway
    hub.spin.rotation.y = H.yaw.x + Math.sin(t * 0.31) * 0.05 * sway
    hub.spin.rotation.x = H.pitch.x

    // dial follows the channel (while the visitor's hand is on it, the hand sets it)
    if (!H.dialDrag) {
      const k = Math.round(H.dialK + wrapPi((H.ch - (((H.dialK % NCH) + NCH) % NCH)) * STEP) / STEP)
      H.dialK = k; H.dial.target = k * STEP
      if (rd) H.dial.snap(); else H.dial.step(dt)
    }
    hub.knob.rotation.z = -H.dial.x
    // v15: the harder the knob turns, the more the picture flickers (fast attack, slower release); a held-still knob is quiet
    {
      const dv = rd ? 0 : Math.abs(H.dial.x - H.dialPrev) / Math.max(dt, 1e-3)
      H.dialPrev = H.dial.x
      const goal = clamp(dv / 5, 0, 1)
      H.dialStat = damp(H.dialStat, goal, goal > H.dialStat ? 0.03 : 0.16, dt)
    }

    // the two push buttons travel with a stiff spring; B's surf flips through a few channels, then lands
    H.pressA.step(dt); H.pressB.step(dt)
    hub.pressA.position.z = -0.022 * H.pressA.x
    hub.pressB.position.z = -0.022 * H.pressB.x
    if (H.surf) {
      H.surf.acc += dt
      const gap = rd ? 0.05 : 0.085
      while (H.surf && H.surf.acc >= gap) {
        H.surf.acc -= gap
        const ch = H.surf.list.shift()
        if (ch != null) userChannel(ch)
        if (!H.surf.list.length) { H.surf = null; settleChannel() }
      }
    }

    // channel change: 350 ms tear + static + roll, swap at 40%
    let tear = 0, stat = 0, roll = 0
    if (H.change.t >= 0) {
      H.change.t += dt * 1000
      const k = H.change.t / 350
      tear = k < 1 ? Math.pow(Math.sin(Math.PI * Math.min(k, 1)), 0.6) : 0
      stat = Math.exp(-Math.pow((k - 0.4) / 0.14, 2)) * 0.95
      roll = k < 0.4 ? -0.12 * smooth(0.1, 0.4, k) : 0.55 * Math.exp(-(k - 0.4) * 6.5) * Math.cos((k - 0.4) * 7.5)
      if (!H.change.swapped && k >= 0.4) { H.change.swapped = true; H.ch = H.want; drawChannel(); H.flash = Math.max(H.flash, 0.35) }
      if (k >= 1.5) H.change.t = -1
    }
    if (H.dialStat > 0.01) stat = Math.max(stat, H.dialStat * (0.5 + 0.2 * Math.sin(t * 91) * Math.sin(t * 37)))   // v15: dial-turn static, flickering
    H.flash *= Math.exp(-dt * 7)
    H.osdT += dt

    // power-off (the finale): vertical collapse -> line -> dot -> hold -> afterglow -> black
    let pw = H.power, fade = 1
    if (H.offK > 0) {
      const k = H.offK
      let p: number
      if (k < 0.25) { const e = Math.pow(k / 0.25, 3); p = 1 - 0.74 * e }
      else if (k < 0.37) { const e = smooth(0, 1, (k - 0.25) / 0.12); p = 0.26 - 0.24 * e }
      else p = 0.02
      fade = k < 0.42 ? 1 : k >= 1 ? 0 : Math.exp(-((k - 0.42) / 0.58) * 4.6)
      pw = Math.min(pw, p)
      if (k >= 1) pw = 0
    }
    const hubOn = pw > 0.001 && fade > 0.002
    const u = hub.crt.uniforms
    u.uTime.value = t
    u.uPower.value = pw
    u.uFade.value = fade
    u.uTear.value = tear; u.uStatic.value = stat; u.uRoll.value = roll; u.uFlash.value = H.flash
    const osdA = H.power > 0.99 ? (H.osdT < 1.8 ? 1 : Math.max(0, 1 - (H.osdT - 1.8) / 0.35)) : 0
    u.uOSDa.value = osdA * (H.offK > 0 ? 0 : 1)
    u.uHover.value = hoverId && hoverId === H.project && H.power > 0.99 ? 1 : 0
    u.uNight.value = 1
    u.uRefl.value = 0.85
    u.uGain.value = 1.5 * (1 - 0.45 * calm)

    // is the hub in view, and how much of the frame does its picture fill (CRT detail fades out when it fills the frame)
    sphere.center.copy(hubPos); sphere.radius = S * 1.25
    H.visible = frustum.intersectsSphere(sphere) && H.gf < 0.98 && H.show > 0.002
    const dist = Math.max(1, camPos.distanceTo(hubPos))
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    H.frac = (2 * 0.48 * S) / visH
    u.uCrt.value = 1 - 0.75 * smooth(0.3, 0.55, H.frac)

    // screen light
    for (let i = 0; i < 3; i++) H.lightCol.lerp(H.avgGoal[i], (1 - Math.exp(-dt * 2.4)) / 3)   // r7: samples arrive 1.5 a second (were 6): glide between them (tau ~0.4 s)
    H.avg.copy(H.lightCol)
    u.uTint.value.copy(H.avg)
    const lum = pw * pw * fade
    hub.light.color.copy(H.lightCol)
    hub.light.intensity = (28 + stat * 30 + H.flash * 40) * lum * (1 - 0.5 * calm) * (1 - H.gf) * H.show
    hub.led.color.set(H.power > 0.01 && H.offK < 0.4 ? '#4CC38A' : '#1d2a23')
    hubWasOn = hubOn
    // v11 guard: a hub that touches the subject or the copy shrinks away (it is not pickable while it is gone)
    hub.root.visible = H.gf < 0.995 && H.show > 0.002
    hub.root.scale.setScalar(S * H.fit * Math.max(1e-3, 1 - smooth(0, 1, H.gf)) * Math.max(0.02, H.show))
    return hubOn
  }

  const hubOnNow = () => hubWasOn

  function updateMinis(t: number, dt: number, idx: number) {
    const rd = reduced()
    const wantAwake = idx >= 1.7
    if (wantAwake && !awakeAll) {
      awakeAll = true
      AREAS.forEach((a, ai) => minis.filter(m => m.area === a).forEach((m, si) => { m.wakeAt = t + (rd ? 0 : ai * 0.34 + si * 0.11); m.awake = true; m.emitted = false; m.power = rd ? 1 : 0; m.pop = rd ? 1 : 0; m.tv.root.visible = true; m.tv.crt.uniforms.uPower.value = 0 }))
    } else if (!wantAwake && awakeAll) {
      awakeAll = false
      for (const m of minis) { m.awake = false; m.power = 0; m.pop = 0; m.tv.root.visible = false; m.live = false }
    }
    const vw = window.innerWidth, vh = window.innerHeight, nowMs = performance.now()
    // v11: where each TV may be. The flight is a leg i0 -> i1 (f = eased progress, fractional index). `settle` is 1 where we stand and falls to 0 by 0.3 of the way away.
    const N1 = WAYPOINTS.length - 1
    const i0 = clamp(Math.floor(idx), 0, N1), i1 = Math.min(N1, i0 + 1), f = clamp(idx - i0, 0, 1)
    const s0 = 1 - smooth(0, 0.3, f), s1 = i1 === i0 ? 0 : 1 - smooth(0, 0.3, 1 - f)
    const w0 = WAYPOINTS[i0], w1 = WAYPOINTS[i1]
    const at0 = w0.area !== 'hub', at1 = w1.area !== 'hub'
    // arcs: only at the hub / world overview and in flight; never while we stand at an area, nor between two waypoints of one area
    const arcW = at0 && at1 && w0.area === w1.area ? 0 : 1 - Math.max(at0 ? s0 : 0, at1 ? s1 : 0)
    brainGoal = Math.max(arcW, at0 && w0.area === 'mind' ? s0 : 0, at1 && w1.area === 'mind' ? s1 : 0)
    const featOf = (w: Waypoint) => (w.area !== 'hub' ? w.tvs?.[0] : undefined)   // at most ONE featured TV per waypoint
    const f0 = featOf(w0), f1 = featOf(w1)
    const zs = occ.zones
    slotNow = null
    const distT = camPos.distanceTo(tmp.set(...curWp.cam.target))
    for (const m of minis) {
      if (!m.awake) continue
      const started = t >= m.wakeAt
      if (started && !m.emitted) { m.emitted = true; emit('tv:on', { id: m.id, area: m.area.id }) }
      if (started) { m.pop = rd ? 1 : Math.min(1, m.pop + dt / 0.6); m.power = rd ? 1 : Math.min(1, m.power + dt / 0.55) }
      m.tv.root.visible = started || m.pop > 0
      // the featured TV: pinned in its reserved slot while we stand at its waypoint (weight fk), an arc member otherwise
      const e0 = f0 === m.id ? s0 : 0, e1 = f1 === m.id ? s1 : 0
      let fk = 0, sl: TvSlot | null = null
      if (e0 > 0 || e1 > 0) { sl = e0 >= e1 ? slotOf(w0, nowMs, vw, vh) : slotOf(w1, nowMs, vw, vh); fk = sl ? smooth(0, 1, Math.max(e0, e1)) : 0 }
      m.feat = fk
      if (sl && fk > 0.5) slotNow = sl
      m.hoverGoal = hoverId === m.id ? 1 : 0
      m.hover = rd ? m.hoverGoal : damp(m.hover, m.hoverGoal, 0.09, dt)
      m.flash *= Math.exp(-dt * 8)

      // pose: bob, hover lift toward the camera, face the camera (a blend of nominal and actual yaw)
      const bob = rd ? 0 : Math.sin(t * 0.7 + m.phase) * 0.12
      m.pos.copy(m.base); m.pos.y += bob
      let scFull = R * (0.72 + 0.28 * easeOutBack(Math.min(1, m.pop))) * (1 + 0.05 * m.hover)
      if (sl && fk > 0.001) {
        // the slot is a screen spot: ray through it, at a depth in front of the subject, sized to the slot's pixel radius
        if (!m.pinned || rd) { m.px = sl.x; m.py = sl.y; m.pinned = true } else { m.px = damp(m.px, sl.x, 0.12, dt); m.py = damp(m.py, sl.y, 0.12, dt) }
        const dz = clamp(0.45 * distT, 3.5, 30), ppu = CR.height / (2 * dz * tanV)
        const nx = (m.px - CR.left - CR.width / 2) / (CR.width / 2), ny = -(m.py - CR.top - CR.height / 2) / (CR.height / 2)
        tmp2.copy(camPos).addScaledVector(camFwd, dz).addScaledVector(camRight, nx * tanV * (CR.width / CR.height) * dz).addScaledVector(camUp, ny * tanV * dz)
        tmp2.y += bob * 0.25
        m.pos.lerp(tmp2, fk)
        scFull += (sl.r / ppu / 1.1 - scFull) * fk
      } else m.pinned = false
      tmp.copy(camPos).sub(m.pos); const horiz = Math.hypot(tmp.x, tmp.z)
      const yawGoal = Math.atan2(tmp.x, tmp.z)
      m.yaw += wrapPi(yawGoal - m.yaw) * (rd ? 1 : 1 - Math.exp(-dt * 3.5))
      m.pitch += (clamp(-Math.atan2(tmp.y, horiz) * 0.6, -0.3, 0.3) - m.pitch) * (rd ? 1 : 1 - Math.exp(-dt * 3.5))
      tmp.normalize()
      m.pos.addScaledVector(tmp, 0.6 * m.hover)
      // v11 guard: the TV's box (at full size) against the zones; hide at 4 px, return only once 22 px clear; a set that fills the view (the camera flew close) is hidden
      const rr = ballBox(m.pos, scFull * 1.1, m.box)
      m.boxOk = rr >= 0
      const vis0 = arcW + (1 - arcW) * fk
      if (rr >= 0 && vis0 > 0.01) m.gh = (fk < 0.5 && rr > MAX_MINI_PX * CR.height) || hitsAny(m.box, zs, m.gh && fk < 0.5 ? GUARD_OUT : GUARD_IN)   // pinned in its slot: the slot already keeps 14 px clear, so no hysteresis band
      else if (vis0 <= 0.01) m.gh = false
      m.gf = rd ? (m.gh ? 1 : 0) : damp(m.gf, m.gh ? 1 : 0, 0.07, dt)
      m.fade = clamp(1 - vis0 * (1 - m.gf), 0, 1)   // no easing of its own: every part is already smooth, and an eased value lags on a slow frame
      const sc = scFull * Math.max(0.02, 1 - smooth(0, 1, m.fade))
      if (m.fade > 0.995) m.tv.root.visible = false
      m.tv.root.position.copy(m.pos)
      // the visitor's spin rides on top: while held the pointer sets it; let go and it coasts, then settles on the nearest whole turn
      if (!m.grab) {
        if (rd) { m.sy.snap(0); m.sx.snap(0) }
        else {
          m.sy.target = Math.round(m.sy.x / TAU) * TAU; m.sx.target = 0
          m.sy.step(dt); m.sx.step(dt)
          if (m.sy.target !== 0 && Math.abs(m.sy.x - m.sy.target) < 2e-3 && Math.abs(m.sy.v) < 2e-3) m.sy.snap(0)
        }
      }
      m.tv.spin.rotation.set(m.pitch + m.sx.x, m.yaw + m.sy.x + (rd ? 0 : Math.sin(t * 0.5 + m.phase) * 0.04), 0)
      m.tv.root.scale.setScalar(sc)

      // screen
      const u = m.tv.crt.uniforms
      const inArea = m.area.id === curArea
      const level = (m.feat > 0.01 ? 0.7 + 0.45 * m.feat : inArea ? 0.62 : 0.4) * (1 - 0.5 * calm)
      u.uTime.value = t + m.phase * 3
      u.uPower.value = m.power * (1 - smooth(0, 0.8, m.fade))
      u.uGain.value = 1.35 * level * (1 + m.hover * 0.12)
      u.uHover.value = m.hover
      u.uFlash.value = m.flash
      u.uNight.value = 1
      u.uCrt.value = 1
      u.uRefl.value = 0.8
      // priority for live rendering: angle from the view axis, featured first
      tmp2.copy(m.pos).sub(camPos); const d = tmp2.length(); tmp2.divideScalar(Math.max(1e-3, d))
      const cosA = tmp2.dot(camFwd)
      m.score = d < 90 ? cosA + m.feat * 0.5 + (inArea ? 0.1 : 0) : -2
    }
    // the three best-placed TVs go live; everything else keeps its last frame
    liveSet = []; jobs = []
    if (awakeAll) {
      const cand = minis.filter(m => m.awake && m.reel >= 0 && m.power > 0.25 && m.fade < 0.5 && (m.score > Math.cos(THREE.MathUtils.degToRad(38)) - 0.05 || m.feat > 0.5)).sort((a, b) => b.score - a.score)
      liveSet = cand.slice(0, 3)
    }
    for (const m of minis) m.live = false
    liveSet.forEach(m => { m.live = true })
    // first frames (posters) for anything that has not shown a picture yet, two per frame
    let first = 2
    for (const m of minis) {
      if (!m.awake || m.reel < 0 || m.rendered || m.power < 0.15) continue
      if (first-- <= 0) break
      jobs.push(m)
    }
    for (const m of liveSet) if (!jobs.includes(m) && ((frameNo + minis.indexOf(m)) & 1) === 0) jobs.push(m)
  }

  // ---------- reel passes (run by the field just before it renders the scene)
  function beforeRender() {
    const rd = reduced()
    // hub reel
    if (H.visible && H.power > 0.02 && H.offK < 0.99 && (H.frac > 0.02 || frameNo % 6 === 0)) {
      pipe.render(H.ch, hubRT, nowT, H.seed)
      // screen average for the light, ~6x a second
      const now = performance.now()
      // r7: the screen average is the ONE read-back left in the site, and each one ends in a synchronous GPU round trip (getBufferSubData: it waits out the frame in the GPU process,
      // 16 ms on a quiet machine, 50+ ms when the GPU is busy). So: never mid-flight; only while the picture matters (it fills >= 3 percent of the view height: from the far stops
      // the light just holds its last colour); three quick samples after a channel change (the colour glides between samples, see lightCol below), then one every 4 s (was 6 a second).
      if (!H.pending && !flying && H.frac > 0.03 && now - H.lastRead > (H.nRead < 3 ? 650 : 4000)) {
        H.lastRead = now; H.pending = true; H.nRead++
        const prev = renderer.getRenderTarget()
        renderer.setRenderTarget(tinyRT); renderer.render(tinyScene, tinyCam); renderer.setRenderTarget(prev)
        renderer.readRenderTargetPixelsAsync(tinyRT, 0, 0, 3, 1, tinyBuf).then(() => {
          for (let i = 0; i < 3; i++) H.avgGoal[i].setRGB(tinyBuf[i * 4] / 255, tinyBuf[i * 4 + 1] / 255, tinyBuf[i * 4 + 2] / 255, THREE.SRGBColorSpace)
        }).catch(() => {}).finally(() => { H.pending = false })
      }
    }
    // small TVs
    for (const m of jobs) {
      if (!m.rt) continue
      pipe.render(m.reel, m.rt, nowT * (rd ? 0 : 1) + m.seed * 40, m.seed)
      m.rendered = true
    }
  }
  field.onBeforeRender(beforeRender)

  // ---------- picking
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const canvas = renderer.domElement
  const html = document.documentElement
  const hubProject = () => H.project
  const GRIPS = ['dial', 'btnA', 'btnB'] as const
  const GRIP_R = { dial: 0.25, btnA: 0.045, btnB: 0.045 } // local radius of each pick volume (hub units, before the set's scale)
  /** v15: screen-space pick floors, px (max(GRIP_R * S * pxPerUnit, floor)): the controls are ~17 / 3 px across from the world stop, a fingertip or a mouse needs more.
   *  A press that misses the little mesh but lands within the floor of a control counts as on it (nearest centre wins); the screen's floor is a radius around its centre. */
  // w12: a fingertip needs more than a mouse: on a coarse pointer the screen's floor is 30 px (a press within it of the picture's centre is on the screen), 24 px otherwise
  const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  const PICK_FLOOR = { dial: 14, btnA: 11, btnB: 11, screen: COARSE ? 30 : 24 } as const
  const gripList = GRIPS.map(g => hub.grip[g])
  interface Detail { id: string; part: Part; mini: Mini | null }
  const camNow = new THREE.Vector3(), gv = new THREE.Vector3(), gn = new THREE.Vector3(), gp = new THREE.Vector3()
  const pxPerUnit = (dist: number, rectH: number) => rectH / (2 * Math.max(0.1, dist) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
  /** the set's controls are small from the far waypoints: when the mesh is under its floor, a press within PICK_FLOOR px of its centre counts as on it */
  function nearGrip(cx: number, cy: number, r: DOMRect): Part | null {
    camera.getWorldPosition(camNow)
    let best: Part | null = null, bd = Infinity
    for (const part of GRIPS) {
      const g = hub.grip[part]
      g.updateWorldMatrix(true, false)
      g.getWorldPosition(gv)
      const rpx = GRIP_R[part] * S * pxPerUnit(gv.distanceTo(camNow), r.height), floor = PICK_FLOOR[part]
      if (rpx >= floor) continue
      gn.set(0, 0, 1).transformDirection(g.matrixWorld)
      gp.copy(camNow).sub(gv).normalize()
      if (gn.dot(gp) < 0.1) continue                 // turned away: the control is round the back
      gv.project(camera)
      if (gv.z > 1) continue
      const d = Math.hypot(r.left + (gv.x * 0.5 + 0.5) * r.width - cx, r.top + (-gv.y * 0.5 + 0.5) * r.height - cy)
      if (d <= floor && d < bd) { bd = d; best = part }
    }
    return best
  }
  /** the picture is under its floor (a small hub from a far waypoint): a press within PICK_FLOOR.screen px of its centre is on the screen */
  function nearScreen(cx: number, cy: number): boolean {
    const rc = rectOf(hub.screen)
    if (!rc) return false
    return Math.min(rc.width, rc.height) / 2 < PICK_FLOOR.screen && Math.hypot(cx - (rc.x + rc.width / 2), cy - (rc.y + rc.height / 2)) <= PICK_FLOOR.screen
  }
  function hitDetail(cx: number, cy: number): Detail | null {
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return null
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    camera.updateMatrixWorld()
    ray.setFromCamera(ndc, camera)
    const objs: THREE.Object3D[] = H.gf < 0.35 && H.show > 0.9 ? [...gripList, ...hub.hit] : []   // v11: a hub the guard has hidden cannot be picked
    for (const m of minis) if (m.awake && m.power > 0.25 && m.tv.root.visible && m.fade < 0.5) objs.push(m.tv.hit)
    const hits = ray.intersectObjects(objs, false)
    let first = hits[0]                                   // the nearest thing wins: the hub's shell hides whatever is behind it
    if (first && gripList.includes(first.object as THREE.Mesh)) {
      // two controls can overlap along the ray (the buttons sit close together, seen edge-on): the one whose centre is nearest the pointer wins
      let bd = Infinity
      for (const h of hits) {
        if (!gripList.includes(h.object as THREE.Mesh)) continue
        h.object.getWorldPosition(gv).project(camera)
        const d = Math.hypot(r.left + (gv.x * 0.5 + 0.5) * r.width - cx, r.top + (-gv.y * 0.5 + 0.5) * r.height - cy)
        if (d < bd) { bd = d; first = h }
      }
    }
    if (first) {
      let part = first.object.userData.part as Part | undefined
      if (part) {
        // the picture sits just inside the body's pick sphere: a ray that reaches the screen at all is on the screen
        if (part === 'body' && hits.some(h => h.object === hub.screenHit)) part = 'screen'
        if (part === 'body' || part === 'screen') { const g = nearGrip(cx, cy, r); if (g) return { id: 'hub', part: g, mini: null } }
        if (part === 'body' && nearScreen(cx, cy)) part = 'screen'
        return { id: 'hub', part, mini: null }
      }
      const m = minis.find(mm => mm.tv.hit === first.object)
      return m ? { id: m.id, part: 'body', mini: m } : null
    }
    const g = nearGrip(cx, cy, r)
    return g ? { id: 'hub', part: g, mini: null } : null
  }
  /** project id under the pointer: a small set, or the hub's current project on its lit screen */
  function pick(cx: number, cy: number): string | null {
    const d = hitDetail(cx, cy)
    if (!d) return null
    if (d.id === 'hub') return d.part === 'screen' && H.power > 0.9 ? H.project : null
    return d.id
  }
  function hitTest(cx: number, cy: number): PartHit | null { const d = hitDetail(cx, cy); return d ? { id: d.id, part: d.part } : null }
  function rectOf(mesh: THREE.Object3D): DOMRect | null {
    camera.updateMatrixWorld()
    mesh.updateWorldMatrix(true, false)
    const r = canvas.getBoundingClientRect()
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const p of PICTURE_EDGE) {
      tmp.copy(p).applyMatrix4(mesh.matrixWorld)
      tmp2.copy(tmp).applyMatrix4(camera.matrixWorldInverse)
      if (tmp2.z > -camera.near) return null
      tmp.project(camera)
      const x = r.left + (tmp.x * 0.5 + 0.5) * r.width, y = r.top + (-tmp.y * 0.5 + 0.5) * r.height
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
    }
    if (x1 < r.left || x0 > r.right || y1 < r.top || y0 > r.bottom) return null
    return new DOMRect(x0, y0, x1 - x0, y1 - y0)
  }
  function screenRect(id: string | 'hub') {
    if (id === 'hub') return hub.root.visible && H.gf < 0.5 && H.show > 0.5 && H.power > 0.01 ? rectOf(hub.screen) : null
    const m = miniById.get(id)
    return m && m.awake && m.tv.root.visible && m.fade < 0.5 ? rectOf(m.tv.screen) : null
  }
  /** client px of a world point (null: behind the camera or outside the canvas) */
  function toClient(p: THREE.Vector3, worldR: number): { x: number; y: number; r: number } | null {
    const r = canvas.getBoundingClientRect()
    camera.updateMatrixWorld()
    camera.getWorldPosition(camNow)
    const q = gp.copy(p).applyMatrix4(camera.matrixWorldInverse)
    if (q.z > -camera.near) return null
    const dist = p.distanceTo(camNow)
    const ndcP = gv.copy(p).project(camera)
    const x = r.left + (ndcP.x * 0.5 + 0.5) * r.width, y = r.top + (-ndcP.y * 0.5 + 0.5) * r.height
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null
    return { x, y, r: worldR * pxPerUnit(dist, r.height) }
  }
  function partScreen(id: string, part: Part) {
    const v = new THREE.Vector3()
    if (id === 'hub') {
      if (H.gf >= 0.35 || H.show < 0.9) return null
      if (part === 'dial' || part === 'btnA' || part === 'btnB') {
        const g = hub.grip[part]; g.updateWorldMatrix(true, false); g.getWorldPosition(v)
        const c = toClient(v, GRIP_R[part] * S)
        return c ? { x: c.x, y: c.y, r: Math.max(c.r, PICK_FLOOR[part]) } : null
      }
      if (part === 'screen') { const rc = rectOf(hub.screen); return rc ? { x: rc.x + rc.width / 2, y: rc.y + rc.height / 2, r: Math.max(Math.min(rc.width, rc.height) / 2, PICK_FLOOR.screen) } : null }
      // body: a point on the shell that really hits as 'body' (the rim, away from the dial and the buttons), found by looking
      const c = toClient(hub.root.getWorldPosition(v), 1.02 * S)
      if (!c) return null
      for (const f of [0.9, 0.82, 0.7, 0.55]) for (let k = 0; k < 18; k++) {
        const a = Math.PI * (0.75 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) / 9) // from the lower left outward
        const x = c.x + Math.cos(a) * c.r * f, y = c.y + Math.sin(a) * c.r * f
        const h = hitDetail(x, y)
        if (h && h.id === 'hub' && h.part === 'body') return { x, y, r: c.r * 0.08 }
      }
      return null
    }
    const m = miniById.get(id)
    if (!m || !m.awake || !m.tv.root.visible || m.fade >= 0.5) return null
    m.tv.hit.updateWorldMatrix(true, false); m.tv.hit.getWorldPosition(v)
    return toClient(v, 1.06 * m.tv.root.scale.x)
  }
  function setHover(id: string | null) {
    if (id === hoverId) return
    hoverId = id
    if (id) { const m = miniById.get(id); if (m) { m.flash = 0.25; emit('tv:hover', { id, area: m.area.id }) } }
  }
  function open(id: string) {
    const m = miniById.get(id)
    if (m) m.flash = 0.6
    emit('tv:open', { id })
    opts.onOpen(id, screenRect(id))
  }
  function openHub() {
    const id = H.project
    if (!id || H.power < 0.9) return
    H.flash = Math.max(H.flash, 0.5)
    emit('tv:open', { id })
    opts.onOpen(id, screenRect('hub'))
  }

  // ---------- operating the hub
  const userPower = () => {
    const on = H.goal === 1
    H.manual = on ? 0 : 1; H.manualAuto = H.autoNow
  }
  const startSurf = () => {
    const list: number[] = []
    let c = H.want
    for (let i = 0; i < Math.min(5, NCH - 1); i++) { c = mod(c + 1, NCH); list.push(c) }
    if (list.length) H.surf = { list, acc: 1 }   // acc >= the gap: the first flip is immediate
  }
  const magnet = (raw: number) => { const k = raw / STEP, r = Math.round(k), f = k - r; return (r + Math.sign(f) * Math.pow(Math.abs(f) * 2, 2.4) / 2) * STEP }
  const dPlane = new THREE.Plane(), dHit = new THREE.Vector3(), dN = new THREE.Vector3(), dP = new THREE.Vector3()
  /** pointer -> the knob's own plane: angle + radius in dial units, so a drag tracks the visible knob however the set is turned or foreshortened */
  function dialPolar(cx: number, cy: number): { a: number; d: number } | null {
    const r = canvas.getBoundingClientRect()
    hub.dial.updateWorldMatrix(true, false); camera.updateMatrixWorld()
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    dN.set(0, 0, 1).transformDirection(hub.dial.matrixWorld)
    dP.set(0, 0, 0.1).applyMatrix4(hub.dial.matrixWorld)
    dPlane.setFromNormalAndCoplanarPoint(dN, dP)
    if (!ray.ray.intersectPlane(dPlane, dHit)) return null
    hub.dial.worldToLocal(dHit)
    return { a: Math.atan2(dHit.y, dHit.x), d: Math.hypot(dHit.x, dHit.y) }
  }

  // ---------- pointer: hover, dial, buttons, spin, click (a press that did not drag)
  type Drag = {
    pid: number; kind: 'spin' | 'dial' | 'btn'; id: string; part: Part; mini: Mini | null
    x0: number; y0: number; moved: boolean
    sy: Spring | null; sp: Spring | null; y0s: number; p0s: number; lt: number; ly: number; lp: number; vy: number; vp: number; emitAt: number
    ang: number | null; raw: number; dialMoved: boolean; touch: boolean
  }
  let drag: Drag | null = null
  let dragMoved = false, povActive = false, dragEnd = -1e9
  const isDragging = () => dragMoved || povActive || performance.now() - dragEnd < 250
  const NEAR = 16, TAP = 6
  const noSelect = (e: Event) => e.preventDefault()
  const blocked = () => !!opts.blocked?.() || html.classList.contains('is-loading')
  const cursorClasses = ['tv-hover', 'tv-grab', 'tv-drag'] as const
  let cursorNow = ''
  /** html classes the cursor ring and main's stylesheet read: tv-hover (pointer: opens / presses), tv-grab (a hand: spins / turns), tv-drag (closed hand) */
  function setCursor(c: '' | 'tv-hover' | 'tv-grab' | 'tv-drag') {
    if (c === cursorNow) return
    cursorNow = c
    for (const k of cursorClasses) html.classList.toggle(k, k === c)
  }
  let hoverQ = false, hx = -1, hy = -1, overCanvas = false
  function updateHover() {
    if (drag || !overCanvas || blocked() || isDragging()) { if (!drag) { setHover(null); setCursor('') } return }
    const d = hitDetail(hx, hy)
    let id: string | null = null, c: '' | 'tv-hover' | 'tv-grab' = ''
    if (d) {
      if (d.id !== 'hub') { id = d.id; c = 'tv-hover' }
      else if (d.part === 'screen' && H.power > 0.9) { id = H.project; c = 'tv-hover' }
      else if (d.part === 'btnA' || d.part === 'btnB') c = 'tv-hover'
      else c = 'tv-grab'
    }
    setHover(id); setCursor(c)
  }
  const onMove = (e: PointerEvent) => {
    if (drag && e.pointerId === drag.pid) { dragMove(e, drag); return }
    if (e.pointerType === 'touch') return
    hx = e.clientX; hy = e.clientY
    overCanvas = e.target === canvas
    if (hoverQ) return
    hoverQ = true
    requestAnimationFrame(() => { hoverQ = false; updateHover() })
  }
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary || drag || e.target !== canvas || blocked()) return
    const h = hitDetail(e.clientX, e.clientY)
    if (!h) return
    const hub_ = h.id === 'hub'
    const kind: Drag['kind'] = hub_ && h.part === 'dial' ? 'dial' : hub_ && (h.part === 'btnA' || h.part === 'btnB') ? 'btn' : 'spin'
    const sy = kind !== 'spin' ? null : hub_ ? H.yaw : h.mini!.sy
    const sp = kind !== 'spin' ? null : hub_ ? H.pitch : h.mini!.sx
    const dp = kind === 'dial' ? dialPolar(e.clientX, e.clientY) : null
    drag = {
      pid: e.pointerId, kind, id: h.id, part: h.part, mini: h.mini, x0: e.clientX, y0: e.clientY, moved: false,
      sy, sp, y0s: sy?.x ?? 0, p0s: sp?.x ?? 0, lt: performance.now(), ly: sy?.x ?? 0, lp: sp?.x ?? 0, vy: 0, vp: 0, emitAt: 0,
      ang: dp && dp.d > 0.03 ? dp.a : null, raw: H.dial.x, dialMoved: false, touch: e.pointerType === 'touch',
    }
    if (kind === 'dial') { H.dialDrag = true; H.surf = null; H.dial.v = 0; H.dial.target = H.dial.x }
    if (kind === 'btn') {
      const A = h.part === 'btnA'
      ;(A ? H.pressA : H.pressB).target = 1
      emit('hub:button', { which: A ? 'A' : 'B', down: true })
    }
    try { canvas.setPointerCapture(e.pointerId) } catch { /* the pointer is gone */ }
    document.addEventListener('selectstart', noSelect) // dragging a set must not paint a text selection over the page
    if (kind === 'dial') setCursor('tv-drag')
  }
  function dragMove(e: PointerEvent, d: Drag) {
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0
    if (!d.moved && Math.hypot(dx, dy) > TAP) {
      d.moved = true
      if (d.kind === 'spin') {
        dragMoved = true
        if (d.mini) d.mini.grab = true; else H.grab = true
        d.sy!.v = 0; d.sp!.v = 0
        setHover(null); setCursor('tv-drag')
        emit('tv:grab', { id: d.id })
      }
    }
    if (d.kind === 'spin' && d.moved) {
      d.sy!.x = d.y0s + dx * 0.0085; d.sy!.v = 0
      d.sp!.x = clamp(d.p0s + dy * 0.004, d.mini ? -0.5 : -0.45, d.mini ? 0.5 : 0.55); d.sp!.v = 0
      const now = performance.now(), dtm = Math.max(1, now - d.lt) / 1000
      d.vy = d.vy * 0.6 + ((d.sy!.x - d.ly) / dtm) * 0.4
      d.vp = d.vp * 0.6 + ((d.sp!.x - d.lp) / dtm) * 0.4
      d.lt = now; d.ly = d.sy!.x; d.lp = d.sp!.x
      if (now - d.emitAt > 90) { d.emitAt = now; emit('tv:spin', { id: d.id, speed: clamp(Math.abs(d.vy) / 14, 0, 1) }) }
    } else if (d.kind === 'dial') {
      const dp = dialPolar(e.clientX, e.clientY)
      if (dp && dp.d > 0.03) {
        if (d.ang !== null) d.raw -= wrapPi(dp.a - d.ang) // clockwise on screen = the next channel
        d.ang = dp.a
      }
      if (d.moved) { d.dialMoved = true; setCursor('tv-drag') }
      H.dial.x = magnet(d.raw); H.dial.v = 0; H.dial.target = H.dial.x
      const k = Math.round(d.raw / STEP)
      if (k !== H.dialK) { H.dialK = k; userChannel(mod(k, NCH)) }
    } else if (d.kind === 'btn') {
      const h = hitDetail(e.clientX, e.clientY)
      ;(d.part === 'btnA' ? H.pressA : H.pressB).target = (h && h.id === 'hub' && h.part === d.part) || Math.hypot(dx, dy) < NEAR ? 1 : 0
    }
  }
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pid) return
    const d = drag; drag = null
    document.removeEventListener('selectstart', noSelect)
    try { canvas.releasePointerCapture(e.pointerId) } catch { /* already released */ }
    const cancelled = e.type === 'pointercancel'
    if (d.kind === 'spin') {
      if (d.mini) d.mini.grab = false; else H.grab = false
      if (d.moved) {
        const stale = performance.now() - d.lt > 90
        d.sy!.v = stale || reduced() ? 0 : clamp(d.vy, -18, 18)
        d.sp!.v = stale || reduced() ? 0 : clamp(d.vp, -6, 6)
        emit('tv:release', { id: d.id, speed: stale ? 0 : clamp(Math.abs(d.vy) / 14, 0, 1) })
      } else if (!cancelled) {
        // v15: on a phone a tap anywhere on the orb's shell opens its current channel, exactly like a click on the glass (the dial and the buttons keep their own jobs)
        if (d.id === 'hub') { if (d.part === 'screen' || (d.touch && d.part === 'body')) openHub() }
        else open(d.id)
      }
    } else if (d.kind === 'dial') {
      H.dialDrag = false
      if (!cancelled && !d.dialMoved && !d.moved) { userChannel(mod(H.want + 1, NCH)) }   // a click on the knob: next channel
      if (!cancelled) settleChannel()
    } else {
      const A = d.part === 'btnA'
      ;(A ? H.pressA : H.pressB).target = 0
      emit('hub:button', { which: A ? 'A' : 'B', down: false })
      const h = hitDetail(e.clientX, e.clientY)
      if (!cancelled && ((h && h.id === 'hub' && h.part === d.part) || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < NEAR)) { if (A) userPower(); else startSurf() }
    }
    if (d.moved) { dragMoved = false; dragEnd = performance.now() }
    setCursor('')
    hx = e.clientX; hy = e.clientY; overCanvas = e.pointerType !== 'touch' && document.elementFromPoint(hx, hy) === canvas
    if (!hoverQ) { hoverQ = true; requestAnimationFrame(() => { hoverQ = false; updateHover() }) }
  }
  const onLeave = () => { overCanvas = false; if (!drag) { setHover(null); setCursor('') } }
  if (opts.interactive !== false) {
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    canvas.addEventListener('pointerleave', onLeave)
  }

  // ---------- API
  const api: World = {
    update(st, t, dt) {
      dt = clamp(dt, 0, 0.1)
      nowT = t; frameNo++
      const from = wpIndexOf(st.wp)
      const idx = st.next != null && st.t != null ? from + (clamp(st.next, 0, WAYPOINTS.length - 1) - from) * clamp(st.t, 0, 1) : from
      curWp = WAYPOINTS[Math.round(idx)] ?? WAYPOINTS[0]
      flying = Math.abs(idx - lastIdx) > 1e-4; lastIdx = idx
      curArea = areaIdOf(st.area, curWp.area)
      calm = damp(calm, curArea === 'about' ? 1 : 0, 0.5, dt)
      camera.updateMatrixWorld()
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      frustum.setFromProjectionMatrix(pv)
      camera.getWorldPosition(camPos)
      prepFrame(dt)

      // hub channel follows the current area's featured project, unless the visitor picked one (held while we dwell at that waypoint)
      if (H.userCh != null && curWp.id !== H.userWp) H.userCh = null
      const hp = hubProjectFor(curWp)
      if (H.userCh != null || H.surf) { /* the visitor's pick holds */ }
      else if (hp) { const ch = reelOf(hp); H.project = hp; if (ch >= 0) setHubChannel(ch) }
      else if (!H.project) H.project = reels[H.ch]?.projectId ?? null

      updateHub(t, dt, idx)
      updateMinis(t, dt, idx)
      updateAff(st)
      if (overCanvas && !drag && frameNo % 5 === 0) updateHover()   // sets slide under a still pointer while the camera flies: keep the hover and the cursor honest
      brainK = reduced() ? brainGoal : damp(brainK, brainGoal, 0.3, dt)
      brain.update(t, dt, camera, (awakeAll ? smooth(0, 1, Math.min(1, (t - brainT0) / 1.1)) : 0) * brainK)
      if (!awakeAll) brainT0 = t
      root.updateMatrixWorld(true)
      hubScaleLast = hub.root.scale.x
    },
    pick, screenRect, hitTest, partScreen,
    get dragging() { return isDragging() },
    markDrag(active) { povActive = active; if (!active) dragEnd = performance.now() },
    tvPose(id) {
      if (id === 'hub') return { yaw: hub.spin.rotation.y, spin: H.yaw.x - H.yaw.target, grabbed: H.grab }
      const m = miniById.get(id)
      return m ? { yaw: m.tv.spin.rotation.y, spin: m.sy.x, grabbed: m.grab } : null
    },
    nudgeChannel(dd) { H.surf = null; userChannel(mod(H.want + (dd < 0 ? -1 : 1), NCH)); settleChannel() },
    togglePower() { userPower() },
    powerOff(k) {
      const was = H.offK
      H.offK = clamp(k, 0, 1)
      if (was < 0.001 && H.offK > 0.001) emit('hub:poweroff', { k: H.offK })
      if (was >= 0.001 && H.offK < 0.001) emit('hub:poweron')
    },
    setHover, open,
    glow() {
      const out: GlowSource[] = []
      if (H.power > 0.01) {
        const l = H.power * H.power * (H.offK > 0 ? Math.max(0, 1 - H.offK * 1.6) : 1) * (1 - H.gf)
        out.push({ position: hub.light.getWorldPosition(new THREE.Vector3()), color: H.lightCol.clone(), intensity: l, radius: S * 9 })
      }
      for (const m of liveSet) out.push({ position: m.pos.clone(), color: m.accent.clone(), intensity: 0.35 + 0.4 * m.feat, radius: 6 })
      return out
    },
    get hubProject() { return hubProject() },
    brain, root,
    tvRects() {
      const out: { id: string; l: number; t: number; r: number; b: number; shown: number }[] = []
      if (hub.root.visible) {
        const k = H.fit * Math.max(0, 1 - smooth(0, 1, H.gf)), cx = (hubShell.l + hubShell.r) / 2, cy = (hubShell.t + hubShell.b) / 2
        if (hubShellOk) out.push({ id: 'hub', l: cx - (cx - hubShell.l) * k, r: cx + (hubShell.r - cx) * k, t: cy - (cy - hubShell.t) * k, b: cy + (hubShell.b - cy) * k, shown: 1 - H.gf })
        if (hubChainOk) out.push({ id: 'hub-chain', ...hubChain, shown: 1 - H.gf })
      }
      for (const m of minis) if (m.awake && m.tv.root.visible && m.boxOk) out.push({ id: m.id, ...m.box, shown: 1 - m.fade })
      return out
    },
    zones: () => ({ subject: occ.subject.map(b => ({ ...b })), copy: occ.copy.map(b => ({ ...b })), hud: occ.hud.map(b => ({ ...b })), slot: slotNow ? { ...slotNow.box } : null }),
    stats: () => ({ minis: minis.filter(m => m.awake).length, live: liveSet.length, awake: awakeAll, hubOn: H.power, hubShow: H.show, hubOff: H.offK, hubChannel: H.ch, hubProject: H.project, hubHeld: H.userCh != null, drawCalls: renderer.info.render.calls }),
    dispose() {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); canvas.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('selectstart', noSelect); setCursor('')
      aff.remove(); affStyle.remove()
      root.removeFromParent()
      brain.dispose(); hub.dispose(); hubRT.dispose(); tinyRT.dispose(); tinyMat.dispose()
      for (const m of minis) { m.tv.crt.dispose(); m.rt?.dispose(); if (!m.rt) m.tex.dispose() }
      pipe.dispose(); kit.dispose()
    },
  }
  void hubOnNow; void displayReferred
  return api
}
