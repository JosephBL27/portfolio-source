// Physical transitions (unit 6T). A leg of the flight can carry a modelled set piece instead of a bare particle dissolve:
//   gate > hall         (10H, w11) the doors of the university: the camera starts front-on to the SHUT portal (the gate dwell), the leaves swing in, light floods out, the camera walks
//                       through into the real hall (extras/hall.ts) and ends mid-nave, at least 15 units past the sill, the doorway behind it
//   hall > hold         (w11) the far doors: the camera walks down the nave, the oak leaves under the middle window swing out, it passes through into the dark and eases onto
//                       the first interest (transitions/exit.ts)
//   name > world        the camera flies into the hub TV's screen (the screen shows the destination through a render target)
//   mind > school       (w12 re-key, was mind > secretary) the brain's glass shell cracks and bursts into tumbling shards that hand over to the UChicago form (Second Brain into Education)
//   table > market      (8M) the mosaic: the frame breaks into split-flap tiles in a diagonal wave, each card's back a slice of the next scene (mosaic.ts)
//   world > surface     (8M, re-keyed w12, was pair > surface) curved panels: the work area's projects on tall glossy panels sweep past the lens as the establishing shot gives way to Work, then part (panels.ts)
//   chomchom > secretary (8M, re-keyed w12, was chomchom > school) the curtain: oxblood velvet climbs the frame, the page ink inverts under its hem; Work into Systems is a change of room (curtain.ts)
// (pages.ts, the giant book of the retired knight > reader leg, stays in the tree but is not registered.)
// Every piece is a pure function of the leg's progress (hinges are closed-form damped springs, shards are ballistic arcs evaluated in the
// vertex shader), so scrolling back replays the leg exactly in reverse, in either direction. The particles dim through field.setFieldAlpha
// while a set piece carries the picture. Reduced motion never flies (fixed poses), so the pieces simply never show: the form crossfade stays. Phones run no set pieces.
// Sound cues emitted through ctx.emit (the sfx engine ignores ids it does not have; add them in src/audio):
//   tr:doors   at 18% of gate>hall, the hinges let go (creak, then the leaves' weight)               data { dir, u }
//   tr:flood   at 52%, the camera is in the doorway and the warm light takes the frame (swell)       data { dir, u }
//   tr:exit    at 18% of hall>hold, the far doors let go                                              data { dir, u }
//   tr:portal  at 40% of name>world, the camera breaks through the glass of the screen              data { dir, u }
//   tr:shatter at 34% of mind>school, the shell bursts                                                data { dir, u }
//   tr:crack   at 14% of mind>school, the first crack runs round the shell                            data { dir, u }
//   tr:mosaic  at 16% of table>market, the first cards go over                                        data { dir, u }
//   tr:panels  at 14% of world>surface, the first panel crosses the lens                              data { dir, u }
//   tr:curtain at 18% of chomchom>secretary, the cloth lifts off the floor                            data { dir, u }
// ?extras=-transitions switches it off; ?tr=noshadow,nodust trims the set pieces; window.__tr.pieces lists what is built.
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import { WAYPOINTS } from '../layout'
import { flightAt, legRange, monoCubic, type FlightState } from '../flight'
import { extraOn, isOn, isPhone, reducedMotion, timed } from './lib/flags'
import { Lane } from './lib/lane'
import { clamp01, lerp, sstep, type CamPose, type Env, type FrameOut, type Leg, type Piece } from './transitions/common'
import { createCurtain } from './transitions/curtain'
import { createDoors } from './transitions/doors'
import { createExit } from './transitions/exit'
import { createGlass } from './transitions/glass'
import { createMosaic } from './transitions/mosaic'
import { createPanels } from './transitions/panels'
import { createPortal } from './transitions/portal'

// ---- timing table. The authored LENGTH of each leg is flight.ts LEG_SECS / SET_PIECE_SECS (the follower flies it); this table holds each piece's own clock.
// `warp` re-times the piece against the leg: [leg progress, piece progress] knots through a monotone cubic. A flat stretch is a HELD BEAT: the camera creeps
// instead of stopping, so it never reads as a freeze, and scrolling back replays it in reverse (the warp is a pure function of the leg's linear progress).
//   gate>hall (5.0 s, w11): 0-0.6 s the camera creeps toward the shut doors; 0.6-2.2 s the leaves swing open on their hinge springs (piece 0.10 -> 0.45) as it closes in;
//   2.2-3.1 s the threshold (0.45 -> 0.60: the camera crosses the doorway, the hall opens up, a soft warm bloom, never a white-out); 3.1-5.0 s the slow walk in to the middle of the nave.
//   hall>hold (3.4 s, w11): no warp: the walk down the nave 0-0.4, the far leaves open 0.15-0.5, through the doorway 0.5-0.65, then the arc onto the hold pose.
interface Timing { warp?: [number, number][] }
/** the doors start at the gate (w11); until the flow package's waypoint lands they start at the compass */
const GATE = WAYPOINTS.some(w => w.id === 'gate') ? 'gate' : 'instrument'
export const TIMING: Record<string, Timing> = {
  [`${GATE}>hall`]: { warp: [[0, 0], [0.12, 0.1], [0.44, 0.45], [0.62, 0.6], [1, 1]] },
}
const warps = new Map<string, (x: number) => number>()
for (const [k, t] of Object.entries(TIMING)) if (t.warp) warps.set(k, monoCubic(t.warp.map(w => w[0]), t.warp.map(w => w[1])))

type Factory = (leg: Leg) => Piece
const TABLE: Record<string, Factory> = {
  [`${GATE}>hall`]: createDoors,  // 10H / w11: through the doors into the hall
  'hall>hold': createExit,        // w11: through the far doors toward the interests
  'mind>school': createGlass,     // w12: the brain's shell bursts into the UChicago form
  'name>world': createPortal,
  'table>market': createMosaic,   // 8M: the frame breaks into split-flap tiles (ALCHE mosaic)
  'chomchom>secretary': createCurtain, // 8M / w12: a velvet curtain rises, the page ink inverts under its hem (Work into Systems: a change of room)
  'world>surface': createPanels,  // 8M / w12: tall curved glossy panels sweep past the camera as the establishing shot gives way to Work, then part (Awwwards / ALCHE bent panels)
}
const FLAGS = new Set((typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tr') ?? '' : '').split(',').filter(Boolean))

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('transitions') || !ctx.field?.scene || FLAGS.has('0') || isPhone()) return
  const field = ctx.field, scene: THREE.Scene = field.scene, renderer: THREE.WebGLRenderer = field.renderer, camera: THREE.PerspectiveCamera = field.camera
  const lane = new Lane(), res = new THREE.Vector2(1440, 900)
  const legs = new Map<string, Leg>()
  for (const key of Object.keys(TABLE)) {
    const [a, b] = key.split('>'), i0 = WAYPOINTS.findIndex(w => w.id === a), i1 = WAYPOINTS.findIndex(w => w.id === b)
    if (i0 < 0 || i1 !== i0 + 1) { console.warn('[transitions] not a leg:', key); continue }
    const r = legRange(i1)
    if (!r) continue
    legs.set(key, { key, i0, i1, A: WAYPOINTS[i0], B: WAYPOINTS[i1], p0: r[0], p1: r[1] })
  }
  const base = { ctx, field, scene, renderer, camera, world: ctx.world, lane, res, q: { shadows: !FLAGS.has('noshadow'), dust: !FLAGS.has('nodust'), reflect: !FLAGS.has('noreflect') } }
  const pieces = new Map<string, { piece: Piece; leg: Leg; built: boolean; envp: Env }>()
  for (const [key, leg] of legs) {
    const envp: Env = {
      ...base,
      flightCam: (u: number) => { const c = flightAt(leg.p0 + clamp01(u) * (leg.p1 - leg.p0)).cam; return { pos: [...c.pos], target: [...c.target], fov: c.fov } as CamPose },
      stateAt: (u: number) => flightAt(leg.p0 + clamp01(u) * (leg.p1 - leg.p0)),
    }
    pieces.set(key, { piece: TABLE[key](leg), leg, built: false, envp })
  }
  // w12: window.__tr.pieces is an object keyed by leg (Object.keys(__tr.pieces) lists the built set pieces) that still answers the Map calls the older callers use (.get, .has, .keys, .values, .entries, .forEach, .size, for..of)
  const piecesView: Record<string, unknown> = {}
  for (const [k, v] of pieces) piecesView[k] = v
  const mapApi: Record<string, unknown> = { get: (k: string) => pieces.get(k), has: (k: string) => pieces.has(k), keys: () => pieces.keys(), values: () => pieces.values(), entries: () => pieces.entries(), forEach: (f: Parameters<typeof pieces.forEach>[0]) => pieces.forEach(f), [Symbol.iterator]: () => pieces[Symbol.iterator]() }
  for (const [k, v] of Object.entries(mapApi)) Object.defineProperty(piecesView, k, { value: v, enumerable: false })
  Object.defineProperty(piecesView, 'size', { get: () => pieces.size, enumerable: false })
  ;(window as unknown as { __tr: unknown }).__tr = { pieces: piecesView, legs, TIMING, warp: (key: string, x: number) => (warps.get(key) ?? ((v: number) => v))(x) }

  // ---- state shared across frames
  const iGate = WAYPOINTS.findIndex(w => w.id === GATE)
  let warmed = false
  let active: string | null = null, prevU = -1, uVel = 0, prevT = 0, fieldOwned = false, lastKey: string | null = null
  const out: FrameOut = { field: 1, flash: 0, flashCol: [1, 1, 1] }
  const jumping = () => !!(window as unknown as { __v3?: { follower?: { jump?: unknown } } }).__v3?.follower?.jump

  const keyOf = (st: FlightState) => (st.dwelling ? null : `${WAYPOINTS[st.wp]?.id}>${WAYPOINTS[st.next]?.id}`)
  const ensureBuilt = (rec: { piece: Piece; built: boolean; envp: Env }) => {
    if (rec.built) return
    rec.built = true
    try { rec.piece.build(rec.envp) } catch (e) { console.warn('[transitions] build failed', e) }
  }
  const release = () => {
    if (active) { const r = pieces.get(active); r?.piece.setVisible(false, r.envp) }
    if (fieldOwned) { field.setFieldAlpha?.(1); fieldOwned = false }
    active = null; prevU = -1
  }

  const step = (t: number, dt: number, st: FlightState) => {
    // pre-build the next piece when the flight is a couple of viewports from its leg (the shaders compile off the main path)
    for (const rec of pieces.values()) if (!rec.built && st.p > rec.leg.p0 - 0.05 && st.p < rec.leg.p1 + 0.01) ensureBuilt(rec)
    // w11 prewarm: within three waypoints of the gate, build the hall and BOTH door pieces and compile the scene once, so the first arrival has no compile hitch
    const wpF = st.dwelling ? st.wp : st.wp + st.t
    if (!warmed && wpF > iGate - 3.2 && wpF < iGate + 3.5) {
      const rin = pieces.get(`${GATE}>hall`), rout = pieces.get('hall>hold')
      for (const r of [rin, rout]) if (r) ensureBuilt(r)
      if ((!rin || rin.built) && (!rout || rout.built)) { warmed = true; void renderer.compileAsync(scene, camera).catch(() => {}) }
    }
    const key = keyOf(st)
    const rec = key ? pieces.get(key) : undefined
    if (!rec || reducedMotion() || jumping() || !rec.built) { if (active) release(); lastKey = key; return }
    if (active !== key) { if (active) release(); active = key }
    const u = clamp01(warps.get(key!)?.(st.raw) ?? st.raw) // the piece's own clock (TIMING)
    // cues: fire when a threshold is crossed in either direction
    if (prevU >= 0) for (const c of rec.piece.cues) if ((prevU < c.at) !== (u < c.at) && Math.abs(u - prevU) < 0.5) ctx.emit(c.name, { dir: u > prevU ? 1 : -1, u })
    uVel += ((prevU >= 0 && t > prevT ? (u - prevU) / Math.max(1e-3, Math.min(0.1, t - prevT)) : 0) - uVel) * (1 - Math.exp(-dt / 0.05))
    prevU = u; prevT = t
    const copy = st.t < 0.5 ? st.overlayOut : st.overlayIn
    lane.update(st, dt); renderer.getDrawingBufferSize(res)
    out.field = 1; out.flash = 0
    rec.piece.setVisible(true, rec.envp)
    rec.piece.frame({ u, t, dt, st, copy, dir: uVel >= 0 ? 1 : -1 }, out, rec.envp)
    field.setFieldAlpha?.(out.field); fieldOwned = true
    lastKey = key
  }
  const timedStep = timed('transitions', step)

  const camLead = 0.115
  return {
    update(t, dt, st) { if (!isOn('transitions')) { if (active) release(); return } timedStep(t, dt, st) },
    adjustCam(cam, _dt, st) {
      if (!active || !isOn('transitions')) return
      const rec = pieces.get(active)
      if (!rec || !rec.built) return
      const u = clamp01(clamp01(warps.get(active)?.(st.raw) ?? st.raw) + uVel * camLead)
      const pose = rec.piece.camera(u, cam, rec.envp)
      if (!pose) return undefined
      // the piece's path equals the flight pose at both ends; blend there so anything an earlier extra did to `cam` (a POV swing still returning) eases out instead of snapping
      const w = sstep(0, 0.05, u) * (1 - sstep(0.95, 1, u))
      const m3 = (a: CamPose['pos'], b: CamPose['pos']): CamPose['pos'] => [lerp(a[0], b[0], w), lerp(a[1], b[1], w), lerp(a[2], b[2], w)]
      return { pos: m3(cam.pos, pose.pos), target: m3(cam.target, pose.target), fov: lerp(cam.fov, pose.fov, w) }
    },
  }
}
