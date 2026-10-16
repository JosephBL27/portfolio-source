// UNIT 8O: the cabinet. The interests of the About room (V8 climbing, board games, records, guitar, chess) stop being particle forms and become
// REAL objects: modelled, textured and lit meshes that stand where the form stood, each with its own motion.
//   knight   a marble-and-walnut chess set that replays the Opera Game (Morphy, 1858) move by move, lathe-turned Staunton pieces, hover to lift
//   records  a turntable: plinth, platter, spinning vinyl with a glowing label, a tonearm that drops on arrival
//   meeple   wooden meeples and dice tumbling onto a hex game board (a small rigid-body integrator); press a die to roll it
//   hold     a climbing wall panel with resin holds; the route lights up hold by hold
//   guitar   (see cabinet/guitar.ts) a spruce body behind the particle strings
// Each object is a Stage (cabinet/stage.ts): it is PRESENT (r 0..1) while the camera arrives at its waypoint and falls to 0 as it leaves, a pure
// function of the flight, so scrolling back replays the entrance in reverse (the object rises onto its plinth / sinks; nothing dissolves).
// While a stage is present the particle form behind it dims to a faint dust: every frame the lowest request wins (main.ts arbiter), and one
// release call (alpha 1) when no stage is present. Every stage sits where layout.ts places its waypoint's form.
// W11: the stages stand at their waypoint's place, no longer shifted or scaled to a window (the interests live in their own spaces now: extras/spaces.ts), and every
// stage is discoverable: a tip on the first hover over a pickable part (a tap shows it on touch), a one-shot idle demonstration 3 s after arrival while the visitor has
// not touched the stage, and one visually hidden, focusable button per action (with an aria-live line saying what happened).
// Contract: install(ctx) -> { update }. ?extras=-cabinet switches the whole thing off. window.__cab.{stages, report()} for tests.
// Reduced motion: stages are simply present at their waypoint, static. Cost: each stage's CPU is timed into window.__atmos.cpu['cab:<id>'].
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import { WAYPOINTS } from '../layout'
import type { FlightState } from '../flight'
import { extraOn, isOn, isPhone, reducedMotion, timed } from './lib/flags'
import { sharedEnv } from './env'
import { stageTip } from './stages/common'
import { INTERESTS } from './hall/rig'
import { destinationWp, jumpRoute, lerp, sstep, type Kit } from './cabinet/kit'
import type { Stage } from './cabinet/stage'

type Maker = () => Stage
const MAKERS: Record<string, () => Promise<Maker>> = {
  knight: async () => (await import('./cabinet/chess')).createChess,
}
// the other stages register themselves below as their modules land (import.meta.glob keeps this file free of a hard dependency on each)
const OPTIONAL = import.meta.glob<{ default?: unknown } & Record<string, unknown>>(['./cabinet/records.ts', './cabinet/meeples.ts', './cabinet/boulder.ts', './cabinet/guitar.ts'])
const OPT_MAKER: Record<string, [string, string]> = { records: ['./cabinet/records.ts', 'createRecords'], meeple: ['./cabinet/meeples.ts', 'createMeeples'], hold: ['./cabinet/boulder.ts', 'createBoulder'], guitar: ['./cabinet/guitar.ts', 'createGuitar'] }
for (const [id, [path, fn]] of Object.entries(OPT_MAKER)) {
  if (OPTIONAL[path]) MAKERS[id] = async () => (await OPTIONAL[path]())[fn] as Maker
}

interface Entry { id: string; wp: number; stage: Stage | null; state: 'idle' | 'building' | 'ready' | 'failed'; r: number; ms: number; step: (t: number, dt: number, r: number, dwell: boolean, st: FlightState) => void }

/** triangles in a subtree (for the report) */
function tris(o: THREE.Object3D): number {
  let n = 0
  o.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh && m.geometry) { const g = m.geometry as THREE.BufferGeometry; n += (g.index ? g.index.count : g.getAttribute('position').count) / 3 * ((m as THREE.InstancedMesh).count ?? 1) } })
  return Math.round(n)
}

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('cabinet') || !ctx.field?.scene) return
  const field = ctx.field, renderer: THREE.WebGLRenderer = field.renderer, camera: THREE.PerspectiveCamera = field.camera
  const html = document.documentElement
  const kit: Kit = {
    scene: field.scene, renderer, camera, env: sharedEnv(renderer), phone: isPhone(), reduced: reducedMotion,
    emit: (name, data) => { try { ctx.emit(name, data) } catch { /* sound is optional */ } },
  }
  const entries: Entry[] = []
  for (const id of Object.keys(MAKERS)) {
    const wp = WAYPOINTS.findIndex(w => w.id === id)
    if (wp < 0) continue
    entries.push({ id, wp, stage: null, state: 'idle', r: 0, ms: 0, step: () => {} })
  }
  if (!entries.length) return

  // ---- presence: 1 while dwelling at the waypoint, rising as the camera arrives (0.42..0.92 of the leg), sinking as it leaves (0.04..0.5)
  let jr: ReturnType<typeof jumpRoute> = null          // this frame's rail jump (set at the top of update)
  const presence = (i: number, st: FlightState): number => {
    // a rail jump skips the legs between its ends: the stage at the destination rises, the one at the origin sinks, and nothing else shows on the way (the active stage follows the destination)
    if (jr) return i === jr.to ? sstep(0.45, 0.95, jr.k) : i === jr.from ? 1 - sstep(0.05, 0.5, jr.k) : 0
    if (st.dwelling) return st.wp === i ? 1 : 0
    if (st.next === i) return sstep(0.42, 0.92, st.t)
    if (st.wp === i) return 1 - sstep(0.04, 0.5, st.t)
    return 0
  }
  const wpF = (st: FlightState) => (st.dwelling ? st.wp : st.wp + st.t)

  // ---- build: one stage per frame, nearest first, a few waypoints before the visitor gets there (or at once on a jump)
  let building = 0
  const startBuild = async (e: Entry) => {
    e.state = 'building'; building++
    const t0 = performance.now()
    try {
      const make = await MAKERS[e.id]()
      const stage = make()
      const w = WAYPOINTS[e.wp]
      stage.root.position.set(w.place.at[0], w.place.at[1], w.place.at[2])
      stage.root.userData.x0 = w.place.at[0]; stage.root.userData.z0 = w.place.at[2]; stage.root.userData.y0 = w.place.at[1]; stage.root.userData.yaw0 = w.place.yaw ?? 0; stage.root.userData.s0 = (w.place.scale ?? 1) * (stage.scale ?? 1)
      stage.root.rotation.y = w.place.yaw ?? 0
      stage.root.visible = false
      await stage.build(kit)
      field.addObject(stage.root)
      e.stage = stage; e.state = 'ready'; e.ms = performance.now() - t0
      const win = window as unknown as { __cab?: { stages: Record<string, Stage> } }
      ;(win.__cab ??= { stages: {} }).stages[e.id] = stage
      const cpu = timed('cab:' + e.id, stage.update.bind(stage))
      e.step = (t, dt, r, dwell, st) => cpu(t, dt, r, dwell, st)
    } catch (err) { e.state = 'failed'; console.warn('[cabinet] stage failed', e.id, err) }
    building = Math.max(0, building - 1)
  }

  // ---- pointer: hover lifts a chess piece, a press rolls a die. Only the stage that is present and standing still listens.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  let px = -1, py = -1, dirty = false, hoverStage: Stage | null = null, hoverObj: THREE.Object3D | null = null
  const canvas = ctx.canvas
  const blocked = () => html.classList.contains('in-index') || html.classList.contains('is-loading') || !!(window as unknown as { __v3?: { caseView?: { isOpen?: () => boolean } } }).__v3?.caseView?.isOpen?.()
  const onMove = (ev: PointerEvent) => { if (ev.pointerType === 'touch') return; px = ev.clientX; py = ev.clientY; dirty = true }
  let touching = false, touchT = 0
  const onLeave = () => { if (touching) return; px = py = -1; dirty = true; hideTip() }          // a lifted finger "leaves" at once: the tap's tip stays
  const onDown = (ev: PointerEvent) => {
    // a tap acts as a press and shows the tip at the tap point (touch has no hover to find the part first)
    touching = ev.pointerType === 'touch'
    if (!active?.stage?.pick || blocked()) return
    px = ev.clientX; py = ev.clientY; pick()
    if (touching) { window.clearTimeout(touchT); touchT = window.setTimeout(() => { touching = false; px = py = -1; dirty = true }, 1800) }
    if (hoverObj && hoverStage?.press) {
      hoverStage.press(hoverObj)
      const id = active.id
      if (touching) { showTip(id, px, py); tipUntil = performance.now() + 2200; window.setTimeout(() => { if (tipId === id && performance.now() >= tipUntil) hideTip() }, 2300); used[id] = true }   // the tip stays a moment, but only the first tap shows it
      else markUsed(id)
    } else if (touching) { setHover(hoverStage, null) }
  }
  const style = document.createElement('style')
  style.textContent = 'html.cab-hover, html.cab-hover body, html.cab-hover main, html.cab-hover #field { cursor: pointer !important }'
  document.head.append(style)
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  document.addEventListener('pointerleave', onLeave)
  let active: Entry | null = null
  const setHover = (s: Stage | null, o: THREE.Object3D | null) => {
    if (hoverStage && hoverStage !== s) hoverStage.hover?.(null)
    hoverStage = s; hoverObj = o
    s?.hover?.(o)
    html.classList.toggle('cab-hover', !!o)
  }
  function pick() {
    const a = active
    if (!a?.stage?.pick || !canvas || px < 0 || blocked() || a.r < 0.97) { setHover(a?.stage ?? null, null); return }
    const rc = canvas.getBoundingClientRect()
    if (px < rc.left || px > rc.right || py < rc.top || py > rc.bottom) { setHover(a.stage, null); return }
    ndc.set(((px - rc.left) / rc.width) * 2 - 1, -(((py - rc.top) / rc.height) * 2 - 1))
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObjects(a.stage.pick, false)[0]
    setHover(a.stage, hit ? hit.object : null)
    if (hit && !touching) showTip(a.id, px, py)
    else if (!touching && performance.now() > tipUntil) hideTip()
  }

  // ---- discoverability: the tip, the idle demonstration, the hidden buttons (all keyed by stage id)
  const TIPS: Record<string, string> = { hold: 'Press a hold', meeple: 'Press a die', records: 'Drop a sleeve on the platter', guitar: 'Sweep across the strings', knight: 'Lift a piece · step with the brass buttons' }
  const ACTS: Record<string, [string, string][]> = {
    hold: [['climb', 'Climb']], meeple: [['roll', 'Roll the dice']], records: [['toggle', 'Play or stop the record']], guitar: [['pluck', 'Pluck the strings']],
    knight: [['next', 'Next move'], ['prev', 'Previous move']],
  }
  const tip = stageTip()
  const used: Record<string, boolean> = {}                  // the visitor has acted on this stage: no more tips, no more demonstrations
  const dwellT: Record<string, number> = {}, demoed: Record<string, boolean> = {}
  const accent = (id: string) => { const c = INTERESTS.find(i => i.id === id)?.light ?? [1, 0.42, 0.24]; return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})` }
  let tipUntil = 0
  let tipId = ''                                           // the stage whose tip is up: a tip belongs to its stop and leaves with it (see update)
  const showTip = (id: string, x: number, y: number) => { if (!used[id] && TIPS[id]) { tip.show(x, y, TIPS[id], undefined, accent(id)); tipId = id } }
  const hideTip = () => { tipId = ''; tip.hide() }
  const markUsed = (id: string) => { used[id] = true; hideTip() }

  // the hidden buttons: visually clipped, but in the tab order while their stage stands at its dwell; revealed as a small pill when focused
  const acts = document.createElement('div'); acts.className = 'cab-acts'; acts.setAttribute('data-proof', 'skip'); acts.hidden = true
  const live = document.createElement('div'); live.className = 'cab-live'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('data-proof', 'skip')
  const actBtns: Record<string, HTMLButtonElement[]> = {}
  for (const [id, list] of Object.entries(ACTS)) {
    actBtns[id] = list.map(([name, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.stage = id; b.dataset.act = name; b.hidden = true
      b.addEventListener('click', () => {
        const st = entries.find(e => e.id === id)?.stage; if (!st?.act) return
        markUsed(id)
        const said = st.act(name); live.textContent = ''; window.setTimeout(() => { live.textContent = said }, 30)
      })
      acts.append(b); return b
    })
  }
  document.body.append(acts, live)
  const actStyle = document.createElement('style')
  actStyle.textContent = '.cab-acts button,.cab-live{position:fixed;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;opacity:.01}'
    + '.cab-acts button:focus-visible{width:auto;height:auto;margin:0;overflow:visible;clip:auto;clip-path:none;opacity:1;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:80;padding:11px 18px;border-radius:999px;background:rgba(10,10,12,.88);border:1px solid rgba(255,255,255,.4);color:#f1ece0;font:500 12px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;box-shadow:0 0 0 2px rgba(255,255,255,.14),0 10px 30px rgba(0,0,0,.5);cursor:pointer;outline:none}'
  document.head.append(actStyle)
  let actsFor = ''
  const syncActs = (e: Entry | null, ready: boolean) => {
    const id = ready && e ? e.id : ''
    if (id === actsFor) return
    actsFor = id
    for (const [sid, list] of Object.entries(actBtns)) for (const b of list) b.hidden = sid !== id
    acts.hidden = !id
  }

  // ---- particle alpha: lowest request wins, re-asserted every frame while a stage holds the frame, released once
  let owning = false

  const update = (t: number, dt: number, st: FlightState) => {
    const rm = reducedMotion()
    jr = jumpRoute()
    // build scheduling: the stop the visitor is heading for builds at once (in parallel with anything already building: a jump must not wait in the queue behind a stage they are leaving)
    const dest = entries.find(e => e.wp === destinationWp(st))
    if (dest && dest.state === 'idle') void startBuild(dest)
    if (!building) {
      let best: Entry | null = null, bd = 1e9
      for (const e of entries) {
        if (e.state !== 'idle') continue
        const d = Math.abs(wpF(st) - e.wp)
        if (d < bd) { bd = d; best = e }
      }
      if (best && bd <= 3.5) void startBuild(best)
    }
    let a = 1, any = false, top: Entry | null = null, topR = 0
    for (const e of entries) {
      let r = presence(e.wp, st)
      if (rm) r = st.dwelling && st.wp === e.wp ? 1 : 0
      e.r = r
      if (e.stage && e.state === 'ready') {
        e.step(t, dt, r, st.dwelling && st.wp === e.wp, st)
        if (r > 0.001) { any = true; a = Math.min(a, lerp(1, e.stage.dim, sstep(0, 0.7, r))); if (r > topR) { topR = r; top = e } }
      } else if (r > 0.5 && e.state === 'idle' && !building) void startBuild(e)
    }
    active = top
    // a tip is raised by the pointer over a part, but it must not wait for the pointer to move again: it leaves with its stop (a flight away, a jump, the Index or a case view opening)
    if (tipId && (!top || top.id !== tipId || topR < 0.97 || blocked())) hideTip()
    if (any) { field.setFieldAlpha?.(a); owning = true } else if (owning) { field.setFieldAlpha?.(1); owning = false }
    if (dirty || (active && (hoverObj || px >= 0) && Math.floor(t * 30) !== Math.floor((t - dt) * 30))) { dirty = false; pick() }
    if (!active && hoverObj) { setHover(null, null); hideTip() }
    // ---- the stage that stands at its dwell: the hidden buttons, the idle demonstration, "the visitor has acted" for stages that listen on their own (the strings)
    const here = top && st.dwelling && st.wp === top.wp && topR >= 0.97 ? top : null
    syncActs(here, !!here && !blocked())
    for (const e of entries) {
      if (!e.stage) continue
      const on = here === e
      if (!on) { if (e.r < 0.5) { dwellT[e.id] = 0; demoed[e.id] = false } continue }
      const plucked = (e.stage.api as { plucks?: number } | undefined)?.plucks
      if (plucked && plucked > 0 && !used[e.id]) markUsed(e.id)
      dwellT[e.id] = (dwellT[e.id] ?? 0) + dt
      if (!used[e.id] && !demoed[e.id] && !rm && dwellT[e.id] > 3 && !blocked() && !document.hidden) { demoed[e.id] = true; try { e.stage.demo?.() } catch { /* a demonstration must never break the page */ } }
    }
  }
  const timedUpdate = timed('cabinet', update)
  ;(window as unknown as { __cab?: Record<string, unknown> }).__cab = Object.assign((window as unknown as { __cab?: Record<string, unknown> }).__cab ?? { stages: {} }, {
    entries, used, tip, report: () => entries.map(e => ({ id: e.id, state: e.state, r: +e.r.toFixed(3), buildMs: Math.round(e.ms), tris: e.stage ? tris(e.stage.root) : 0 })),
  })
  Object.defineProperty((window as unknown as { __cab: object }).__cab, 'activeId', { get: () => active?.id ?? null, configurable: true })   // the stage that holds the frame (tests)
  return { update(t, dt, st) { if (!isOn('cabinet')) { if (owning) { field.setFieldAlpha?.(1); owning = false } for (const e of entries) if (e.stage) e.stage.root.visible = false; syncActs(null, false); hideTip(); return } timedUpdate(t, dt, st) } }
}
