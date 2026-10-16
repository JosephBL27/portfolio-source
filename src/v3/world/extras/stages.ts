// UNIT 8S: waypoint STAGES. Five waypoints that were only particle forms get a modelled scene each, every one in a different rendering style:
//   alarm   (SELFORGE)      a PBR iPhone lying on a lacquered nightstand, its screen glowing red and counting pushups
//   drill   (ZETA)          chunky emissive seven-segment digits as extruded meshes, split-flap flips, 30 climbing to 80
//   market  (Love Island)   the phase portrait as glowing tubes and ribbons that draw themselves on, two beads per couple
//   record  (WWII)          a printed paper map: the US as a folded paper relief, counties rising as bars
//   pair    (thrift)        a cut-paper collage of halftone shapes with drop shadows, assembling
// This file is the framework: it places each stage's root on its waypoint, reads the flight state into (arrive, depart), keeps the particle
// field dimmed to dust while a stage owns the frame (field.setFieldAlpha: the arbiter in main.ts takes the lowest request per frame, so a
// stage re-asserts its value every frame and calls setFieldAlpha(1) once on release), builds each stage lazily as the flight approaches,
// and times the whole thing (window.__atmos.cpu.stages).
//   arrive  0..1  the leg INTO the waypoint (the flight's eased leg progress), 1 once there; scrubbing back replays the entrance in reverse
//   depart  0..1  the leg OUT of it; scrubbing back replays the exit in reverse
// Rail jumps and teleports are smoothed by a rate limit (5 per second) so a stage never pops. Reduced motion: no flight, so the stages show
// at their waypoint in the resting state (reduced = true) and nowhere else.
// ?extras=-stages switches them off. window.__stages = { recs, ... } for measurement.
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import { FRAMING, WAYPOINTS, freeRegion } from '../layout'
import type { FlightState } from '../flight'
import { extraOn, isOn, isPhone, reducedMotion, timed } from './lib/flags'
import { sharedEnv } from './env'
import { sstep, stageTip, viewOf, type StageDef, type StageFrame, type StageInst } from './stages/common'
import alarm from './stages/alarm'
import drill from './stages/drill'
import market from './stages/market'
import record from './stages/record'
import pair from './stages/pair'
import watchdog from './stages/watchdog'
import secretary from './stages/secretary'
import qvr from './stages/qvr'
import chalkboard from './stages/chalkboard'

const DEFS: StageDef[] = [alarm, drill, market, record, pair, watchdog, secretary, qvr, chalkboard]
const RATE = 5            // per second: the fastest a stage's arrive / depart may move (teleports and rail jumps only; a scrub is slower)

interface Rec {
  def: StageDef; wp: number
  inst: StageInst | null; building: boolean; failed: boolean
  a: number; d: number          // smoothed arrive / depart
  tIn: number; present: number; visible: boolean; fit: number
}

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('stages') || !ctx.field?.scene || !ctx.field?.renderer) return
  const field = ctx.field, scene: THREE.Scene = field.scene, renderer: THREE.WebGLRenderer = field.renderer, camera: THREE.PerspectiveCamera = field.camera
  const recs: Rec[] = []
  for (const def of DEFS) {
    const wp = WAYPOINTS.findIndex(w => w.id === def.id)
    if (wp < 0) { console.warn('[stages] no waypoint', def.id); continue }
    recs.push({ def, wp, inst: null, building: false, failed: false, a: 0, d: 0, tIn: 0, present: 0, visible: false, fit: -1 })
  }
  let owned = false
  const jumping = () => !!(window as unknown as { __v3?: { follower?: { jump?: unknown } } }).__v3?.follower?.jump
  const frame: StageFrame = { t: 0, dt: 0, arrive: 0, depart: 0, tIn: 0, reduced: false, phone: false, aspect: 1.6, visW: 10, visH: 6, emit: (n, d) => ctx.emit(n, d) }

  /** upload the stage's textures and create its shader programs now, off the main path (traverseVisible needs the root visible for the synchronous part) */
  const prewarm = (root: THREE.Object3D) => {
    const was = root.visible; root.visible = true
    const seen = new Set<THREE.Texture>()
    root.traverse(o => {
      const mm = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (!mm) return
      for (const m of Array.isArray(mm) ? mm : [mm]) for (const k of ['map', 'alphaMap'] as const) {
        const t = (m as THREE.MeshBasicMaterial)[k]
        if (t && t.isTexture && !seen.has(t)) { seen.add(t); try { renderer.initTexture(t) } catch { /* uploaded by the first frame */ } }
      }
    })
    try { void (renderer as THREE.WebGLRenderer & { compileAsync?: (o: THREE.Object3D, c: THREE.Camera, s?: THREE.Scene) => Promise<unknown> }).compileAsync?.(root, camera, scene) } catch { /* the first frame compiles them */ }
    root.visible = was
  }
  const build = (r: Rec) => {
    if (r.inst || r.failed) return
    try {
      const wp = WAYPOINTS[r.wp]
      const inst = r.def.build({ renderer, camera, scene, env: sharedEnv(renderer), phone: isPhone(), wp: r.wp, view: viewOf(r.wp), emit: (n, d) => ctx.emit(n, d), prewarm })
      const root = inst.root
      root.name = 'stage-' + r.def.id
      root.position.set(...wp.place.at); root.rotation.y = wp.place.yaw ?? 0; root.scale.setScalar(wp.place.scale ?? 1)
      root.visible = false
      field.addObject(root)
      prewarm(root)
      r.inst = inst
    } catch (e) { r.failed = true; console.warn('[stages] build failed', r.def.id, e) }
  }

  /** the flight state seen by waypoint i: (arrive, depart), both 0..1 */
  const phaseOf = (st: FlightState, i: number, rm: boolean): [number, number] => {
    if (st.dwelling) return st.wp === i ? [1, 0] : st.wp < i ? [0, 0] : [1, 1]
    if (rm) return [0, 0]
    if (st.next === i && st.wp !== i) return [st.t, 0]
    if (st.wp === i && st.next !== i) return [1, st.t]
    return st.wp < i ? [0, 0] : [1, 1]
  }
  const step = (t: number, dt: number, st: FlightState) => {
    const rm = reducedMotion(), jump = jumping(), phone = isPhone()
    const asp = innerWidth / Math.max(1, innerHeight)
    let want = 1, any = false, builtNow = false
    for (const r of recs) {
      // build when the flight is within two waypoints of it (a hitch-free approach); reduced motion builds on arrival only
      const near = Math.min(Math.abs(st.wp - r.wp), Math.abs(st.next - r.wp)) <= 2
      if (near && !r.inst && !r.failed && !builtNow) { build(r); builtNow = true }       // one build per frame
      if (!r.inst) continue
      let [aT, dT] = phaseOf(st, r.wp, rm)
      if (jump) { aT = r.a > 0 ? 1 : 0; dT = r.a > 0 ? 1 : 0 }           // a rail jump: whatever is showing leaves, nothing starts
      const curVis = r.a > 0.0005 && r.d < 0.9995, tgtVis = aT > 0.0005 && dT < 0.9995
      if (!curVis && !tgtVis) { r.a = aT; r.d = dT } else {
        const m = RATE * Math.min(dt, 0.05)
        r.a += Math.max(-m, Math.min(m, aT - r.a)); r.d += Math.max(-m, Math.min(m, dT - r.d))
      }
      if (rm) { r.a = aT; r.d = dT }
      const vis = r.a > 0.0005 && r.d < 0.9995
      if (vis !== r.visible) { r.visible = vis; r.inst.root.visible = vis; if (!vis) r.inst.leave?.() }
      if (!vis) { r.tIn = 0; r.present = 0; continue }
      r.tIn = r.a > 0.92 && r.d < 0.02 ? r.tIn + dt : (r.d > 0.02 || r.a < 0.5 ? 0 : r.tIn)
      r.present = sstep(0.25, 0.85, r.a) * (1 - sstep(0.04, 0.5, r.d))
      // fit: the footprint must sit inside the window (portrait: inside the band between the title and the copy), centred a little high
      const wpd = WAYPOINTS[r.wp], dc = wpd.cam, tanH = Math.tan(THREE.MathUtils.degToRad(dc.fov ?? 35) / 2)
      // the camera rig backs off on a narrow window until a form of half-width 2.9 (x the placement scale) fits (engine/camera.ts): same rule here
      const dist = Math.max(Math.hypot(dc.pos[0] - dc.target[0], dc.pos[1] - dc.target[1], dc.pos[2] - dc.target[2]), (2.9 * (wpd.place.scale ?? 1)) / (tanH * asp) * 0.95)
      const visH = 2 * dist * tanH, visW = visH * asp, portrait = asp < 0.85
      const [sw, sh] = r.inst.size ?? [4, 4]
      // wave 24: on a landscape window narrower than 1.55:1 the stage may fill only the free region beside the copy lane (layout.ts freeRegion), not 60% of the window; it fades in over 1.55..1.40
      const fr = portrait ? null : freeRegion(wpd.id)
      const wf = fr ? 0.6 + (Math.min(0.6, FRAMING.stageFill * (fr.b - fr.a) / innerWidth) - 0.6) * fr.t : portrait ? 0.86 : 0.6
      const k = Math.min(1, wf * visW / sw, (portrait ? 0.38 : 0.86) * visH / sh)
      r.fit = r.fit < 0 || rm ? k : r.fit + (k - r.fit) * (1 - Math.exp(-dt / 0.15))
      r.inst.root.scale.setScalar((wpd.place.scale ?? 1) * r.fit)
      r.inst.root.position.y = wpd.place.at[1] + (portrait ? 0.07 * visH : 0)
      frame.visW = visW; frame.visH = visH
      frame.t = t; frame.dt = dt; frame.arrive = r.a; frame.depart = r.d; frame.tIn = rm ? 99 : r.tIn; frame.reduced = rm; frame.phone = phone; frame.aspect = asp
      r.inst.update(frame)
      const dust = r.inst.dust ?? 0.16
      want = Math.min(want, 1 + (dust - 1) * r.present)
      any = true
    }
    if (any) { field.setFieldAlpha?.(want); owned = true }
    else if (owned) { field.setFieldAlpha?.(1); owned = false }
  }
  const timedStep = timed('stages', step)

  // ---- pointer: the stage that is fully in and held gets hover / press / drag / keys (never on empty space: a press the stage does not claim falls through to the
  // point-of-view drag, and a stage that claims one stops it here, in the capture phase, before pov.ts sees it)
  const canvas = ctx.canvas, html = document.documentElement
  const world = ctx.world as { dragging?: boolean } | null
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const cur = document.createElement('style')
  cur.textContent = 'html.stg-pointer, html.stg-pointer body, html.stg-pointer main, html.stg-pointer #field { cursor: pointer !important } html.stg-grab, html.stg-grab body, html.stg-grab main, html.stg-grab #field { cursor: grab !important } html.stg-grabbing, html.stg-grabbing body, html.stg-grabbing main, html.stg-grabbing #field { cursor: grabbing !important }'
  document.head.append(cur)
  const blocked = () => html.classList.contains('in-index') || html.classList.contains('is-loading') || !!(window as unknown as { __v3?: { caseView?: { isOpen?: () => boolean } } }).__v3?.caseView?.isOpen?.()
  const held = (): Rec | null => { for (const r of recs) if (r.inst?.pointer && r.visible && r.a > 0.97 && r.d < 0.02) return r; return null }
  const aim = (x: number, y: number) => {
    const rc = canvas!.getBoundingClientRect()
    ndc.set(((x - rc.left) / rc.width) * 2 - 1, -(((y - rc.top) / rc.height) * 2 - 1)); ray.setFromCamera(ndc, camera)
  }
  let hoverRec: Rec | null = null, grab: { id: number; rec: Rec; x0: number; y0: number; moved: boolean } | null = null
  const setCursor = (k: 'pointer' | 'grab' | 'grabbing' | null) => { html.classList.toggle('stg-pointer', k === 'pointer'); html.classList.toggle('stg-grab', k === 'grab'); html.classList.toggle('stg-grabbing', k === 'grabbing') }
  const dropHover = () => { if (hoverRec) { hoverRec.inst?.pointer?.leave?.(); hoverRec = null } setCursor(grab ? 'grabbing' : null) }
  const onMove = (e: PointerEvent) => {
    if (!canvas) return
    if (grab) {
      if (e.pointerId !== grab.id) return
      if (!grab.moved && Math.hypot(e.clientX - grab.x0, e.clientY - grab.y0) > 6) grab.moved = true
      aim(e.clientX, e.clientY); grab.rec.inst?.pointer?.move?.(ray, e.clientX, e.clientY); return
    }
    if (e.pointerType === 'touch') return
    const r = held()
    if (!r || e.target !== canvas || blocked() || world?.dragging || html.classList.contains('pov-drag')) { if (hoverRec || html.classList.contains('stg-pointer') || html.classList.contains('stg-grab')) dropHover(); return }
    aim(e.clientX, e.clientY)
    const k = r.inst!.pointer!.hover(ray, e.clientX, e.clientY)
    if (hoverRec && hoverRec !== r) hoverRec.inst?.pointer?.leave?.()
    hoverRec = k ? r : null
    if (!k) r.inst!.pointer!.leave?.()
    setCursor(k)
  }
  // touch has no hover: a finger that goes down on a held stage gets the same tip a pointer would (or the stage's hint when it landed on nothing usable) at the touch point
  const tTip = stageTip()
  let touchRec: Rec | null = null, touchUntil = 0
  const touchTip = (r: Rec, x: number, y: number) => {
    const k = r.inst!.pointer!.hover(ray, x, y)
    if (!k) { const h = r.inst!.hint; if (h) tTip.show(x, y, h[0], h[1], '#ff6a3d'); else tTip.hide() }
    touchRec = r; touchUntil = performance.now() + 2600
  }
  const onTouchUp = (e: PointerEvent) => { if (e.pointerType === 'touch' && touchRec) touchUntil = performance.now() + 1500 }
  const onDown = (e: PointerEvent) => {
    if (!canvas || grab || e.button !== 0 || !e.isPrimary || e.target !== canvas || blocked()) return
    const r = held(); if (!r) return
    aim(e.clientX, e.clientY)
    if (e.pointerType === 'touch') touchTip(r, e.clientX, e.clientY)
    const k = r.inst!.pointer!.down(ray, e.clientX, e.clientY)
    if (!k) return
    e.stopPropagation()
    if (k === 'drag') {
      grab = { id: e.pointerId, rec: r, x0: e.clientX, y0: e.clientY, moved: false }
      try { canvas.setPointerCapture(e.pointerId) } catch { /* the pointer is gone */ }
      setCursor('grabbing')
    }
  }
  const onUp = (e: PointerEvent) => {
    const g = grab; if (!g || e.pointerId !== g.id) return
    grab = null
    try { canvas?.releasePointerCapture(e.pointerId) } catch { /* already released */ }
    g.rec.inst?.pointer?.up?.(g.moved)
    setCursor(null)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (blocked()) return
    const r = held(); if (!r?.inst?.pointer?.key) return
    if (r.inst.pointer.key(e)) { e.preventDefault(); e.stopPropagation() }
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, true)
  window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp)
  window.addEventListener('pointerup', onTouchUp); window.addEventListener('pointercancel', onTouchUp)
  window.addEventListener('keydown', onKey, true)
  document.addEventListener('pointerleave', () => dropHover())
  ;(window as unknown as { __stages: unknown }).__stages = { recs, build: (id: string) => { const r = recs.find(x => x.def.id === id); if (r) build(r); return r } }

  return {
    update(t, dt, st) {
      if (!isOn('stages')) { if (owned) { field.setFieldAlpha?.(1); owned = false; for (const r of recs) if (r.inst) { r.inst.root.visible = false; if (r.visible) { r.visible = false; r.inst.leave?.() } } } return }
      timedStep(t, dt, st)
      if ((hoverRec || grab) && !held()) { grab = null; dropHover() }
      if (touchRec && (!held() || (!grab && performance.now() > touchUntil))) { touchRec.inst?.pointer?.leave?.(); tTip.hide(); touchRec = null }
    },
  }
}
