// ===================================================================================
// v4 FLIGHT — one scalar p (0..1 of the scroll track) -> the whole world's state.
//
// p is spread over the WAYPOINTS of layout.ts: for each waypoint a TRAVEL leg into it (weight
// `travel`) and then a DWELL at it (weight `dwell`). Camera, morph, overlay and sound are all
// pure functions of p, so scrolling backwards replays the flight exactly in reverse.
//
//   - during a leg the camera follows a centripetal Catmull-Rom path through the waypoint cameras
//     (position and look-at separately; FOV eased), with cubic-bezier(0.65,0,0.35,1) easing;
//   - the morph is mix = smoothstep(0.25, 0.80, t): particles leave as the camera accelerates and
//     are formed before it finishes arriving;
//   - overlays follow the motion spec: outgoing text p 0-0.30, art alone 0.30-0.78, incoming
//     0.78-0.96 (t = eased leg progress);
//   - during a dwell nothing freezes: the camera orbits +-4 deg about the subject as you scroll.
//
// Time-based smoothing (the follower with the 0.9 s morph floor / 1.8 s leg floor) is NOT here:
// flightAt is pure. FlightFollower (below) turns raw scroll progress into a smooth p.
//
// PACING (unit 7B). Every leg has an authored duration, LEG_SECS: 1.35-1.95 s by how far the camera and its subject travel; the four set pieces fly longer
// (SET_PIECE_SECS: the doors 5.0 s, the far-door exit 3.4 s, the TV portal 2.4 s, the finale 3.6 s, the glass 2.0 s; phones and reduced motion run no set pieces, so they fall back to the ordinary length, except the finale). A stepped gesture (ui/stepper.ts) flies ONE waypoint as a
// timed HOP on the follower (planHop: pre-roll out of the dwell, the leg, settle into the next dwell; retargeting carries velocity), so one wheel
// gesture, key press or swipe is one waypoint at one pace. Scrubbing by hand still goes through the damped follower, and settles to the nearer dwell
// when it stops. For legs longer than ~2 s the copy's own clock (overlayK, OV_WARP) is drawn closer together so no leg is dark for more than 1 s.
// ===================================================================================
import { smoothDamp } from '../engine/camera'
import { WAYPOINTS, type AreaId, type Placement, type Vec3 } from './layout'
import { isPhone, reducedMotion } from './extras/lib/flags'

/** layout weight -> viewport heights of scroll, for DWELLS (at 0.8 the dwells alone are ~18 viewports) */
export const DWELL_SCALE = 0.6
/** layout weight -> viewport heights of scroll, for TRAVEL legs. 0.6 against 0.8 puts the track at ~65% dwell / 35% travel (motion spec 6.2) */
export const TRAVEL_SCALE = 0.48
/** kept for older imports */
export const SCROLL_SCALE = DWELL_SCALE
/** every waypoint's art stays fully formed (its dwell plus the formed ends of the two legs beside it) for at least this many viewports: no sub-beat is a flicker */
export const MIN_FORMED_U = 1.04

export interface FlightState {
  /** waypoint index we are at / leaving (during a leg: the origin) */
  wp: number
  /** waypoint index we are heading to (== wp while dwelling) */
  next: number
  /** EASED leg progress 0..1 (the "p" of the motion spec); 0 while dwelling */
  t: number
  /** form ids: a = shown at the start, b = heading to (a === b while dwelling) */
  a: string
  b: string
  /** morph amount a -> b, smoothstep(0.25, 0.80, t) */
  mix: number
  placeA: Placement
  placeB: Placement
  cam: { pos: Vec3; target: Vec3; fov: number }
  /** 0..1 camera speed shape (1 = peak of a long leg, 0.08 = the dwell floor) */
  speed: number
  area: AreaId
  /** overlay id of the origin waypoint and of the destination (equal while dwelling or when a leg keeps the overlay) */
  overlay: string
  overlayNext: string
  /** = t: eased leg progress. The UI windows it (outgoing copy leaves 0..0.30, art alone 0.30..0.78, incoming arrives 0.78..0.96); 0 while dwelling */
  overlayK: number
  // ---- extras (not in the minimal contract)
  /** `overlay` visibility 1 -> 0 over t 0..0.30 (1 while dwelling) — the same window, pre-computed */
  overlayOut: number
  /** `overlayNext` visibility 0 -> 1 over t 0.78..0.96 (1 while dwelling) */
  overlayIn: number
  /** overall scroll progress this state was computed from */
  p: number
  /** true while standing at a waypoint */
  dwelling: boolean
  /** 0..1 progress through the current dwell (0 during legs) */
  local: number
  /** raw (linear) leg progress 0..1 */
  raw: number
  /** project ids featured by the origin and destination waypoints */
  tvsA: string[]
  tvsB: string[]
  /** sound cue of the destination waypoint (arrival cue) */
  sound?: string
  /** authored duration (seconds) of the leg being flown, 0 while dwelling (LEG_SECS) */
  legSecs?: number
}

// ---------- easing ----------
/** CSS cubic-bezier(x1,y1,x2,y2) as a function of x */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const X = (t: number) => ((ax * t + bx) * t + cx) * t
  const Y = (t: number) => ((ay * t + by) * t + cy) * t
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i++) { const e = X(t) - x; const d = dX(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d }
    let lo = 0, hi = 1
    if (t < 0 || t > 1 || Math.abs(X(t) - x) > 1e-5) { t = x; for (let i = 0; i < 24; i++) { const v = X(t); if (v < x) lo = t; else hi = t; t = (lo + hi) / 2 } }
    return Y(t)
  }
}
export const legEase = bezier(0.65, 0, 0.35, 1)
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const EASE_PEAK = (() => { let m = 0; for (let i = 0; i < 200; i++) { const x = i / 200; m = Math.max(m, (legEase(x + 0.002) - legEase(Math.max(0, x - 0.002))) / (x + 0.002 - Math.max(0, x - 0.002))) } return m })()
const easeSpeed = (t: number) => { const h = 0.01, a = Math.max(0, t - h), b = Math.min(1, t + h); return (legEase(b) - legEase(a)) / (b - a) / EASE_PEAK }

// ---------- centripetal Catmull-Rom (Barry-Goldman), segment p1 -> p2 ----------
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
function crSeg(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, u: number): Vec3 {
  const d = (a: Vec3, b: Vec3) => Math.max(1e-3, Math.sqrt(dist3(a, b)))
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3)
  const t = t1 + (t2 - t1) * u
  const out: Vec3 = [0, 0, 0]
  for (let k = 0; k < 3; k++) {
    const A1 = ((t1 - t) * p0[k] + (t - t0) * p1[k]) / (t1 - t0)
    const A2 = ((t2 - t) * p1[k] + (t - t1) * p2[k]) / (t2 - t1)
    const A3 = ((t3 - t) * p2[k] + (t - t2) * p3[k]) / (t3 - t2)
    const B1 = ((t2 - t) * A1 + (t - t0) * A2) / (t2 - t0)
    const B2 = ((t3 - t) * A2 + (t - t1) * A3) / (t3 - t1)
    out[k] = ((t2 - t) * B1 + (t - t1) * B2) / (t2 - t1)
  }
  return out
}

// ---------- dwell orbit: the camera drifts a few degrees about the subject as you scroll ----------
const orbitAbout = (pos: Vec3, target: Vec3, ang: number): Vec3 => {
  const x = pos[0] - target[0], z = pos[2] - target[2], c = Math.cos(ang), s = Math.sin(ang)
  return [target[0] + c * x + s * z, pos[1], target[2] - s * x + c * z]
}
const N = WAYPOINTS.length
const ORBIT: number[] = WAYPOINTS.map((w, i) => {
  const same = (WAYPOINTS[i - 1]?.area === w.area && w.area !== 'hub') || (WAYPOINTS[i + 1]?.area === w.area && w.area !== 'hub')
  return same ? 0.025 : w.area === 'hub' ? 0.03 : 0.07 // rad; +-0.07 rad = +-4 deg
})
const camOf = (i: number) => WAYPOINTS[i].cam
const fovOf = (i: number) => WAYPOINTS[i].cam.fov ?? 35
/** pose at the START of the dwell (arrival) and at its END (departure) */
const arrivePos = (i: number) => orbitAbout(camOf(i).pos, camOf(i).target, -ORBIT[i])
const departPos = (i: number) => orbitAbout(camOf(i).pos, camOf(i).target, +ORBIT[i])

// ---------- segment table ----------
// Weights are in VIEWPORT HEIGHTS of scroll. A dwell is at least long enough that the form is fully formed for MIN_FORMED_U.
interface Seg { kind: 'dwell' | 'leg'; i: number; w: number; start: number; end: number }
const frac = (test: (loc: number) => boolean) => { let n = 0; for (let k = 0; k < 400; k++) if (test((k + 0.5) / 400)) n++; return n / 400 }
/** share of a leg (by scroll) where the incoming form is already fully formed (mix >= 0.98) / the outgoing form has not started to leave (mix <= 0.02) */
const FORMED_IN = frac(l => smooth(0.25, 0.80, legEase(l)) >= 0.98)
const FORMED_OUT = frac(l => smooth(0.25, 0.80, legEase(l)) <= 0.02)
const TRAVEL_U: number[] = WAYPOINTS.map((w, i) => (i > 0 ? w.travel * TRAVEL_SCALE : 0))
const DWELL_U: number[] = WAYPOINTS.map((w, i) => {
  const ends = TRAVEL_U[i] * FORMED_IN + (i + 1 < N ? TRAVEL_U[i + 1] * FORMED_OUT : 0)
  return Math.max(w.dwell * DWELL_SCALE, MIN_FORMED_U - ends)
})
const SEGS: Seg[] = []
let TOTAL_W = 0
for (let i = 0; i < N; i++) {
  if (TRAVEL_U[i] > 0) { SEGS.push({ kind: 'leg', i, w: TRAVEL_U[i], start: TOTAL_W, end: TOTAL_W + TRAVEL_U[i] }); TOTAL_W += TRAVEL_U[i] }
  SEGS.push({ kind: 'dwell', i, w: DWELL_U[i], start: TOTAL_W, end: TOTAL_W + DWELL_U[i] }); TOTAL_W += DWELL_U[i]
}
/** total scroll-track height in viewport heights (the track is SCROLL_VH * 100vh tall; scroll range = SCROLL_VH - 1 viewports) */
export const SCROLL_VH = Math.round(TOTAL_W * 100) / 100
const segAtU = (u: number): Seg => {
  let lo = 0, hi = SEGS.length - 1
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SEGS[m].start <= u) lo = m; else hi = m - 1 }
  return SEGS[lo]
}
const dwellSeg = (i: number) => SEGS.find(s => s.kind === 'dwell' && s.i === i)!
const legSeg = (i: number) => SEGS.find(s => s.kind === 'leg' && s.i === i)

/** p at the middle of waypoint i's dwell (the "fully formed, text in" pose) */
export const waypointP = (i: number): number => { const s = dwellSeg(Math.max(0, Math.min(N - 1, i))); return (s.start + s.w * 0.5) / TOTAL_W }
/** [p0, p1] of waypoint i's dwell */
export const dwellRange = (i: number): [number, number] => { const s = dwellSeg(i); return [s.start / TOTAL_W, s.end / TOTAL_W] }
/** [p0, p1] of the leg into waypoint i (null for the first waypoint) */
export const legRange = (i: number): [number, number] | null => { const s = legSeg(i); return s ? [s.start / TOTAL_W, s.end / TOTAL_W] : null }
export const waypointIndex = (id: string) => WAYPOINTS.findIndex(w => w.id === id)
/** the waypoint whose dwell middle is nearest to p (for rails and reduced motion) */
export const nearestWaypoint = (p: number): number => {
  let best = 0, bd = 9
  for (let i = 0; i < N; i++) { const d = Math.abs(waypointP(i) - p); if (d < bd) { bd = d; best = i } }
  return best
}
/** the camera speed of a leg is scaled by how far it travels (a short in-area slide is slow) */
const legScale = (i: number) => Math.min(1, Math.max(0.12, dist3(camOf(i - 1).pos, camOf(i).pos) / 22))

// ---------- authored pacing (unit 7B) ----------
/** monotone cubic (Fritsch-Carlson) through the knots: C1, never overshoots, so a time warp built from it stays a clean ease */
export function monoCubic(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length, h: number[] = [], d: number[] = [], m: number[] = []
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i] }
  m[0] = d[0]; m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (h[i - 1] + h[i])) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i])
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / d[i], b = m[i + 1] / d[i], q = a * a + b * b
    if (q > 9) { const k = 3 / Math.sqrt(q); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i] }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (i < n - 2 && x > xs[i + 1]) i++
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1]
  }
}
/** set pieces fly longer than an ordinary leg: seconds of the leg itself (the pre-roll and the settle come on top) */
export const SET_PIECE_SECS: Record<string, number> = {
  'gate>hall': 5.0,       // w11: the doors of the hall: they open, the camera walks through the doorway and the hall opens round it (was instrument>hall, 6.0 s)
  'hall>hold': 3.4,       // w11: the far-door exit: out through the end wall into the first interest's space
  'name>world': 2.4,      // the TV portal (was 3.0 s)
  'knight>epilogue': 3.6, // the finale: up through the roof and out into the night sky
  'mind>school': 2.0,     // the glass: the brain's shell bursts into the UChicago form (w12 re-key, was mind>secretary, 2.5 s before that)
}
const LEG_MIN_S = 1.35, LEG_MAX_S = 1.95 // was 1.8 / 2.6: ordinary legs about 25% quicker
/** the one set piece that also runs on phones and under reduced motion (the finale: ui/epilogue + extras/finale.ts) */
const SET_PIECE_ALWAYS = new Set(['knight>epilogue'])
const ordinarySecs = (i: number) => {
  const far = Math.max(dist3(camOf(i - 1).pos, camOf(i).pos), dist3(camOf(i - 1).target, camOf(i).target))
  const f = Math.sqrt(clamp01((far - 2) / 41))
  return Math.round((LEG_MIN_S + (LEG_MAX_S - LEG_MIN_S) * f) * 20) / 20
}
function legSecsFor(i: number, setPieces: boolean): number {
  if (i === 0) return 0
  const key = `${WAYPOINTS[i - 1].id}>${WAYPOINTS[i].id}`, set = SET_PIECE_SECS[key]
  if (set && (setPieces || SET_PIECE_ALWAYS.has(key))) return set
  return ordinarySecs(i)
}
/** authored duration of the leg INTO waypoint i, in seconds (0 for the first waypoint). Ordinary legs run 1.35-1.95 s by how far the camera and its subject travel.
 *  Set pieces (SET_PIECE_SECS) apply only where they can run: phones and reduced motion fly the ordinary length. Recomputed IN PLACE by refreshLegSecs() (on resize), so the array and legSeconds() stay live. */
export const LEG_SECS: number[] = WAYPOINTS.map((_, i) => legSecsFor(i, !isPhone() && !reducedMotion()))
export const legSeconds = (i: number) => LEG_SECS[Math.max(0, Math.min(N - 1, i))]

// Equal attention: the UI windows overlayK (outgoing copy leaves 0..0.30, incoming arrives 0.78..0.96). On the eased clock the gap with no copy
// at half strength grows with the leg (about 0.4 x its length: 2 s at 5 s). Past MAX_DARK seconds the windows are drawn closer together in TIME:
// k is re-mapped through a monotone curve so the outgoing copy holds longer and the incoming copy arrives sooner; the camera and the morph keep t.
const OUT_HALF = 0.15, IN_HALF = 0.87, MAX_DARK = 1.0
const invEase = (y: number) => { let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (legEase(m) < y) lo = m; else hi = m } return (lo + hi) / 2 }
const R_OUT = invEase(OUT_HALF), R_IN = invEase(IN_HALF)
const warpFor = (j: number, D: number): ((x: number) => number) | null => {
  if (j === 0 || (R_IN - R_OUT) * D <= MAX_DARK) return null
  const a = 0.5 - MAX_DARK / (2 * D), b = 0.5 + MAX_DARK / (2 * D)
  return monoCubic([0, a, b, 1], [0, OUT_HALF, IN_HALF, 1])
}
const OV_WARP: (((x: number) => number) | null)[] = LEG_SECS.map((D, j) => warpFor(j, D))
/** recompute LEG_SECS and the copy's clocks in place (the viewport decides isPhone(); the layout's reframe moves the cameras). Track geometry (legRange, waypointP, dwellRange) is built from the layout WEIGHTS, not seconds, so it does not move. */
let spLast = !isPhone() && !reducedMotion()
export function refreshLegSecs() {
  const sp = spLast = !isPhone() && !reducedMotion()
  for (let i = 0; i < N; i++) { LEG_SECS[i] = legSecsFor(i, sp); OV_WARP[i] = warpFor(i, LEG_SECS[i]) }
}
/** a gesture is about to plan a flight: if reduced motion was switched on or off since the last refresh, the set pieces' lengths follow it */
const ensureLegSecs = () => { if ((!isPhone() && !reducedMotion()) !== spLast) refreshLegSecs() }
if (typeof window !== 'undefined') {
  let rq = 0
  // layout.ts reframes in a rAF after a resize; this runs in the rAF queued right after it (same frame, same order), so it sees the new cameras
  window.addEventListener('resize', () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => requestAnimationFrame(refreshLegSecs)) })
}
/** darkest stretch of a leg in seconds: the time between the outgoing copy at half strength and the incoming copy at half strength (0 when both legs show the same overlay) */
export function darkSeconds(j: number): number {
  if (j <= 0 || WAYPOINTS[j - 1].overlay === WAYPOINTS[j].overlay) return 0
  return OV_WARP[j] ? MAX_DARK : (R_IN - R_OUT) * LEG_SECS[j]
}

function build(p: number): FlightState {
  p = Math.min(1, Math.max(0, p))
  const u = p * TOTAL_W
  const sg = segAtU(u)
  const loc = sg.w > 0 ? Math.min(1, Math.max(0, (u - sg.start) / sg.w)) : 0
  if (sg.kind === 'dwell') {
    const i = sg.i, w = WAYPOINTS[i], c = w.cam
    const ang = ORBIT[i] * (2 * loc - 1)
    const pos = orbitAbout(c.pos, c.target, ang)
    return {
      wp: i, next: i, t: 0, a: w.form, b: w.form, mix: 0, placeA: w.place, placeB: w.place,
      cam: { pos, target: [c.target[0], c.target[1], c.target[2]], fov: c.fov ?? 35 },
      speed: 0.08, area: w.area, overlay: w.overlay, overlayNext: w.overlay, overlayK: 0, overlayOut: 1, overlayIn: 1,
      p, dwelling: true, local: loc, raw: 0, tvsA: w.tvs ?? [], tvsB: w.tvs ?? [], sound: w.sound, legSecs: 0,
    }
  }
  const j = sg.i, i = j - 1, wa = WAYPOINTS[i], wb = WAYPOINTS[j]
  const t = legEase(loc)
  const p0 = camOf(Math.max(0, i - 1)).pos, p1 = departPos(i), p2 = arrivePos(j), p3 = camOf(Math.min(N - 1, j + 1)).pos
  const q0 = i - 1 >= 0 ? p0 : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1], 2 * p1[2] - p2[2]] as Vec3
  const q3 = j + 1 < N ? p3 : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1], 2 * p2[2] - p1[2]] as Vec3
  const pos = crSeg(q0, p1, p2, q3, t)
  const T0 = i - 1 >= 0 ? camOf(i - 1).target : null, T1 = camOf(i).target, T2 = camOf(j).target, T3 = j + 1 < N ? camOf(j + 1).target : null
  const tq0: Vec3 = T0 ?? [2 * T1[0] - T2[0], 2 * T1[1] - T2[1], 2 * T1[2] - T2[2]]
  const tq3: Vec3 = T3 ?? [2 * T2[0] - T1[0], 2 * T2[1] - T1[1], 2 * T2[2] - T1[2]]
  // the look-at leads the position a little, so the camera looks into the turn
  const tl = legEase(Math.min(1, loc + 0.05))
  const target = crSeg(tq0, T1, T2, tq3, tl)
  const fov = lerp(fovOf(i), fovOf(j), t)
  const same = wa.overlay === wb.overlay
  const k = OV_WARP[j] ? OV_WARP[j]!(loc) : t // the copy's own clock (see OV_WARP); equal to t on every leg that is short enough
  const out = 1 - smooth(0, 0.30, k), inn = smooth(0.78, 0.96, k)
  return {
    wp: i, next: j, t, a: wa.form, b: wb.form, mix: smooth(0.25, 0.80, t), placeA: wa.place, placeB: wb.place,
    cam: { pos, target, fov },
    speed: Math.max(0.08, easeSpeed(loc) * legScale(j)),
    area: t < 0.5 ? wa.area : wb.area, overlay: wa.overlay, overlayNext: wb.overlay, overlayK: k,
    overlayOut: same ? 1 : out, overlayIn: same ? 1 : inn,
    p, dwelling: false, local: 0, raw: loc, tvsA: wa.tvs ?? [], tvsB: wb.tvs ?? [], sound: wb.sound, legSecs: LEG_SECS[j],
  }
}

/** the whole world at scroll progress p (0..1). Pure and reversible. */
export function flightAt(p: number): FlightState { return build(p) }

/** TV power-off amount 0..1 for the epilogue: 0 until the closing line is up, then the TV collapses to a dot over the rest of the dwell (scroll-scrubbed; main.ts uses powerOffArmed for the timed version) */
export function powerOffAt(s: FlightState): number {
  if (s.wp !== N - 1 || !s.dwelling) return 0
  return smooth(0.22, 0.88, s.local)
}
/** true once the closing line is up in the epilogue dwell (hysteresis: `was` keeps it armed a little longer on the way back) */
export function powerOffArmed(s: FlightState, was = false): boolean {
  if (s.wp !== N - 1 || !s.dwelling) return false
  return s.local >= (was ? 0.14 : 0.24)
}

// ---------- stations: waypoint index as a continuous coordinate along the track (dwell middle = integer) ----------
const MID: number[] = WAYPOINTS.map((_, i) => waypointP(i))
/** fractional waypoint index at progress p (waypointP(i) -> i) */
export function stationAt(p: number): number {
  if (p <= MID[0]) return 0
  if (p >= MID[N - 1]) return N - 1
  let lo = 0, hi = N - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (MID[m] <= p) lo = m; else hi = m }
  return lo + (p - MID[lo]) / (MID[hi] - MID[lo])
}
/** rail jump duration (seconds) for a flight across `stations` waypoints: clamp(0.9 + 0.3 x stations, 1.2, 2.2) (w11: was 0.45 / 1.4 / 3.0; 28 stops make the long jumps long enough). */
export const jumpDuration = (stations: number) => Math.min(2.2, Math.max(1.2, 0.9 + 0.3 * stations))

// ---------- stepping (unit 7B): one gesture = one waypoint ----------
/** which segment p is in: 'dwell' at waypoint i, or the 'leg' INTO waypoint i; loc 0..1 through it */
export function segmentAt(p: number): { kind: 'dwell' | 'leg'; i: number; loc: number } {
  const sg = segAtU(clamp01(p) * TOTAL_W)
  return { kind: sg.kind, i: sg.i, loc: sg.w > 0 ? clamp01((clamp01(p) * TOTAL_W - sg.start) / sg.w) : 0 }
}
/** the waypoint one step from p: from a dwell, the next/previous one; from inside a leg, the dwell ahead (dir 1) or behind (dir -1) */
export function stepTarget(p: number, dir: 1 | -1): number {
  const sg = segAtU(clamp01(p) * TOTAL_W)
  return Math.min(N - 1, Math.max(0, sg.kind === 'dwell' ? sg.i + dir : dir > 0 ? sg.i : sg.i - 1))
}

// A HOP is one timed flight from where the follower is to a waypoint's rest pose, in three kinds of phase:
//   leg    p moves LINEARLY through the leg for its authored LEG_SECS (the leg's own cubic-bezier is already inside flightAt, so one ease, not two);
//   dwell  the camera drifts through the +-4 deg orbit of the dwell: DEP_S to leave it, ARR_S to settle into the next, smoothstepped so it never kicks.
// A hop that starts mid-flight carries the velocity it had (minus its own opening velocity) for CARRY_T s, so a retarget or a reversal bends instead of snapping.
const DEP_S = 0.62, ARR_S = 0.9, PASS_S = 0.6, CARRY_T = 0.7
/** after the last leg phase a hop stays "locked" (the next gesture is ignored) this long: the copy has been fully in since before the leg ended; this is the hold */
const HOP_HOLD = 0.12
interface HopPhase { t0: number; t1: number; p0: number; p1: number; ease: 0 | 1 }
export interface Hop { from: number; g: number; dir: 1 | -1; phases: HopPhase[]; total: number; t: number; carry: number; legEnd: number }
function planHop(from: number, goal: number, v0: number, maxTotal = Infinity): Hop | null {
  const u0 = from * TOTAL_W, u1 = goal * TOTAL_W
  if (Math.abs(u1 - u0) < 1e-5) return null
  const dir: 1 | -1 = u1 > u0 ? 1 : -1
  const lo = Math.min(u0, u1), hi = Math.max(u0, u1)
  const parts: { sg: Seg; a: number; b: number }[] = []
  for (const sg of SEGS) { const a = Math.max(lo, sg.start), b = Math.min(hi, sg.end); if (b - a > 1e-6) parts.push({ sg, a, b }) }
  if (dir < 0) parts.reverse()
  const phases: HopPhase[] = []
  let t = 0, legEnd = 0
  parts.forEach((pt, k) => {
    const frac = (pt.b - pt.a) / pt.sg.w, last = k === parts.length - 1, isLeg = pt.sg.kind === 'leg'
    const dur = Math.max(1e-3, isLeg ? LEG_SECS[pt.sg.i] * frac : (last ? ARR_S : k === 0 ? DEP_S : PASS_S) * frac)
    phases.push({ t0: t, t1: t + dur, p0: (dir > 0 ? pt.a : pt.b) / TOTAL_W, p1: (dir > 0 ? pt.b : pt.a) / TOTAL_W, ease: isLeg ? 0 : 1 })
    t += dur
    if (isLeg) legEnd = t
  })
  if (!phases.length) return null
  if (t > maxTotal) { const f = maxTotal / t; for (const ph of phases) { ph.t0 *= f; ph.t1 *= f } t *= f; legEnd *= f }
  const f0 = phases[0], vp0 = f0.ease === 0 ? (f0.p1 - f0.p0) / (f0.t1 - f0.t0) : 0
  return { from, g: goal, dir, phases, total: t, t: 0, carry: v0 - vp0, legEnd }
}
function hopAt(h: Hop, t: number): number {
  t = Math.min(h.total, Math.max(0, t))
  let ph = h.phases[h.phases.length - 1]
  for (const q of h.phases) if (t <= q.t1) { ph = q; break }
  const x = clamp01((t - ph.t0) / (ph.t1 - ph.t0))
  const e = ph.ease === 0 ? x : x * x * (3 - 2 * x)
  const w = Math.max(0, 1 - t / Math.min(h.total, CARRY_T))
  return ph.p0 + (ph.p1 - ph.p0) * e + h.carry * t * w * w
}
/** seconds a hop from p to p2 would take (for tests and for the UI's "how long will this fly") */
export const hopSeconds = (p: number, p2: number, maxTotal = Infinity) => planHop(p, p2, 0, maxTotal)?.total ?? 0

// ---------- follower: raw scroll progress -> p with the speed caps of the motion spec ----------
const AVG_LEG = SEGS.filter(s => s.kind === 'leg').reduce((a, s) => a + s.w, 0) / Math.max(1, SEGS.filter(s => s.kind === 'leg').length)
/** a goal further than this many waypoints away that arrives in one step (rail, Home/End, links) is flown as a timed jump */
const JUMP_MIN_STATIONS = 1.6
/** a goal that moves by at least this much of the track, at this speed (track per second, about 18 viewports/s, far beyond any wheel or trackpad flick), is a click, not a scroll */
const TELEPORT = 0.012
const TELEPORT_RATE = 0.6
/** a running jump is abandoned (re-planned) if the goal drifts this far from where it was headed */
const RETARGET = 0.012
/** a click that lands one waypoint away (rail, Index, keys 1-6, a link) flies the authored leg, squeezed to at most this many seconds in all (arrival at the dwell by ~2.4 s) */
const JUMP_HOP_MAX = 2.8
export interface Jump { p0: number; g: number; dur: number; t: number; v0: number }
/**
 * Critically damped follower on p (smoothTime 0.30 s, no overshoot) with time floors: a leg takes at
 * least 1.5 s to cross and a dwell at least 0.5 s, however hard the input is thrown. The cap rises with the
 * distance to the goal so a hard scroll stays under ~3 legs/s.
 *
 * A click that moves the goal across more than ~1.6 waypoints in one step is a JUMP: a timed flight
 * (clamp(0.9 + 0.3 x stations, 1.2, 2.2) s, cubic-bezier(0.65,0,0.35,1), starting with the speed the follower already had) so
 * a rail click always lands within 2.4 s whatever the distance. `jump` is non-null while it flies; main.ts shows ONE morph
 * (source form -> destination form) for the whole jump instead of every form on the way.
 */
export class FlightFollower {
  s = 0; v = 0
  jump: Jump | null = null
  /** the running hop (a stepped or short-teleport flight to one waypoint); null when none */
  hop: Hop | null = null
  private lastGoal = -1
  private boost = 0
  constructor(public smoothTime = 0.3, public legFloor = 1.8, public dwellFloor = 0.9) {}
  snap(p: number) { this.s = p; this.v = 0; this.jump = null; this.hop = null; this.lastGoal = p; this.boost = 0 }
  /** fly one timed hop from here to p. The caller has already moved the scroll goal to p, so this is not a teleport. Returns false when we are already there. */
  startHop(p: number, maxTotal = Infinity): boolean {
    p = clamp01(p); ensureLegSecs()
    this.lastGoal = p; this.jump = null; this.boost = 0
    this.hop = planHop(this.s, p, this.v, maxTotal)
    return !!this.hop
  }
  /** true while a hop or a jump is still flying toward the point where the next gesture may be taken (leg done + a short hold) */
  get locked(): boolean { return !!this.jump || (!!this.hop && this.hop.t < this.hop.legEnd + HOP_HOLD) }
  /** eased 0..1 progress of the running jump (0 when none) */
  get jumpProgress(): number { const J = this.jump; return J ? legEase(Math.min(1, J.t / J.dur)) : 0 }
  /** `rawDt` is the real frame time (dt is clamped): a long hitch frame must not turn a fast scroll into a "click" */
  update(goal: number, dt: number, rawDt = dt): number {
    dt = Math.min(0.1, Math.max(0, dt))
    goal = Math.min(1, Math.max(0, goal))
    if (dt <= 0) return this.s
    const moved = this.lastGoal >= 0 ? Math.abs(goal - this.lastGoal) : 0
    const teleport = moved >= TELEPORT && moved / Math.max(1 / 120, rawDt) >= TELEPORT_RATE
    this.lastGoal = goal
    const stations = Math.abs(stationAt(goal) - stationAt(this.s))
    if (this.hop && (teleport || Math.abs(goal - this.hop.g) > RETARGET)) this.hop = null // somebody else moved the goal: the hop yields
    if (!this.hop && !this.jump && teleport && stations > 0.45 && stations <= JUMP_MIN_STATIONS) this.startHop(goal, JUMP_HOP_MAX) // a rail / menu click to the next waypoint flies its authored leg
    if (this.jump && (teleport || Math.abs(goal - this.jump.g) > RETARGET)) { this.boost = Math.max(this.boost, Math.abs(this.v) / Math.max(1e-6, this.nearCap(goal))); this.jump = null }
    if (!this.jump && teleport && stations > JUMP_MIN_STATIONS) this.jump = { p0: this.s, g: goal, dur: jumpDuration(stations), t: 0, v0: this.v }
    const H = this.hop
    if (H) {
      H.t += dt
      const prev = this.s
      this.s = clamp01(hopAt(H, H.t)); this.v = (this.s - prev) / dt
      if (H.t >= H.total) { this.s = Math.abs(goal - H.g) < RETARGET ? goal : H.g; this.v = 0; this.hop = null }
      return this.s
    }
    const J = this.jump
    if (J) {
      J.t += dt
      const u = Math.min(1, J.t / J.dur), prev = this.s
      // ease-in-out between the endpoints, plus the speed we already had, decaying to nothing by the end (no hitch when a jump starts mid-flight)
      let s = J.p0 + (J.g - J.p0) * legEase(u) + J.v0 * J.t * (1 - u) * (1 - u)
      if ((J.g - J.p0) * (s - J.g) > 0) s = J.g // never pass the goal
      this.s = Math.min(1, Math.max(0, s)); this.v = (this.s - prev) / dt
      if (u >= 1) { this.s = J.g; this.v = 0; this.jump = null }
      return this.s
    }
    const [ns0, nv] = smoothDamp(this.s, goal, this.v, this.smoothTime, dt)
    let step = ns0 - this.s
    const max = this.nearCap(goal) * (1 + this.boost) * dt
    this.boost *= Math.exp(-dt / 0.45)
    if (Math.abs(step) > max) { step = Math.sign(step) * max; this.v = step / dt } else this.v = nv
    this.s = Math.min(1, Math.max(0, this.s + step))
    if (Math.abs(goal - this.s) < 1e-6 && Math.abs(this.v) < 1e-5) { this.s = goal; this.v = 0 }
    return this.s
  }
  /**
   * Where the follower will be in `T` seconds if the goal stays put. The engine's camera rig trails its input by about 0.11 s,
   * so main.ts feeds the camera THIS pose: the camera then sits on the path instead of behind the morph. (Simulated with the real
   * follower law, so speed caps at segment boundaries and the jump profile are respected; a straight p + v T would overshoot at a boundary.)
   */
  predict(goal: number, T: number): number {
    const J = this.jump, H = this.hop, keep = { s: this.s, v: this.v, boost: this.boost, last: this.lastGoal, jt: J ? J.t : 0, ht: H ? H.t : 0 }
    let out = this.s
    for (let k = 0; k < 4; k++) out = this.update(goal, T / 4)
    this.s = keep.s; this.v = keep.v; this.boost = keep.boost; this.lastGoal = keep.last
    this.jump = J; if (J) J.t = keep.jt // the same object (main.ts tells jumps apart by identity)
    this.hop = H; if (H) H.t = keep.ht
    return out
  }
  /** the speed cap (p per second) of the segment we are in, raised with the distance to the goal */
  private nearCap(goal: number): number {
    const sg = segAtU(this.s * TOTAL_W)
    const floor = sg.kind === 'leg' ? this.legFloor : this.dwellFloor
    const dist = Math.abs(goal - this.s) * TOTAL_W / AVG_LEG
    const mult = Math.min(12, 1 + 0.75 * Math.max(0, dist - 1))
    return (sg.w / TOTAL_W / floor) * mult
  }
}
