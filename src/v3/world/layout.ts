// ===================================================================================
// v4 WORLD CONTRACT — one continuous world around ONE central object: the orb TV.
// The scroll track drives a single camera flight through WAYPOINTS. At each waypoint the
// particle field shows one FORM placed in world space (offset + yaw + scale), the camera
// frames it, and the overlay layer shows that waypoint's copy. Between waypoints the camera
// flies along a smooth path while the particles stream from the old form's place to the
// new one (the morph shader interpolates world positions, so travel = a river of light).
//
// Geometry: the central TV hangs at HUB. Six AREAS sit on a ring around it (radius RING,
// varying heights), so the TV is visible — glowing, its screen on the current channel —
// from every area. Each area hangs an arc of small TVs, one per project (ref 1's arc of
// cards around a figure; ALCHE's curved panels). The camera never cuts: it orbits the hub.
//
// ABOUT (w11 "flow"): the About area is three places in a row, all off the ring along one axis (the nave axis of the hall).
//   gate  : outside. The hall's facade and its closed doors stand on the right half of the frame (the copy on the left). Every jump to About lands here
//           (nav.ts firstOfArea('about') is the first 'about' waypoint), so the doors are never skipped.
//   hall  : inside, in the middle of the nave, looking down it at the five lancet windows (the interests) and the far doors in the end wall.
//   five SPACES (INTEREST_SPACES) beyond the end wall, a gallery along the same axis that alternates sides: hold, meeple, records, guitar, knight.
//           Each interest is an object in its own open space with its own backdrop; the camera leaves the hall through the far doors (hall>hold set piece).
// Builders may TUNE the numbers (positions, dwell/travel weights) but keep the shape and
// the ids. Copy for each waypoint lives in docs/V4-COPY.md / src/v3/chapters.ts.
// ===================================================================================
export type Vec3 = [number, number, number]
export type AreaId = 'hub' | 'mind' | 'systems' | 'research' | 'work' | 'education' | 'about'

export const HUB: Vec3 = [0, 0, 0]
export const RING = 24

export interface Area { id: AreaId; angle: number; height: number; center: Vec3; accent: string; projects: string[] }
const ring = (deg: number, h: number): Vec3 => { const a = (deg * Math.PI) / 180; return [Math.sin(a) * RING, h, Math.cos(a) * RING] }

export const AREAS: Area[] = [
  // w12 (flow): ARRAY ORDER = FLIGHT ORDER (forms/orbits.ts reads AREAS[0].angle and AREAS[1]-AREAS[0] as the ring step). Work first (the QVR quant internship and the two equity pitches), then the builds behind the claim, then the models of behaviour, the second brain, school, and last the person.
  { id: 'work', angle: 25, height: -2, center: ring(25, -2), accent: '#B48CFF', projects: ['qvr', 'cloudflare', 'appfolio', 'recruiting-os', 'chomchom'] },
  { id: 'systems', angle: 85, height: -1.5, center: ring(85, -1.5), accent: '#FF4A2B', projects: ['secretary', 'watchdog', 'selforge', 'zeta', 'table-model', 'hand-compass'] },
  { id: 'research', angle: 145, height: 2.5, center: ring(145, 2.5), accent: '#FF6A8A', projects: ['love-island', 'wwii', 'thrift'] },
  { id: 'mind', angle: 205, height: 2, center: ring(205, 2), accent: '#8FB8FF', projects: ['second-brain', 'skills', 'axe-os', 'carta'] },
  { id: 'education', angle: 265, height: 1.5, center: ring(265, 1.5), accent: '#D9A441', projects: ['metamorphoses', 'odyssey', 'liaozhai'] },
  { id: 'about', angle: 325, height: -1, center: ring(325, -1), accent: '#EDE6D6', projects: [] },
]
export const area = (id: AreaId) => AREAS.find(a => a.id === id)

export interface Placement { at: Vec3; yaw?: number; scale?: number }
export interface Waypoint {
  id: string
  area: AreaId
  form: string                 // FORM id (src/v3/forms)
  place: Placement             // where the form sits in the world
  cam: { pos: Vec3; target: Vec3; fov?: number }
  /** v8 framing: where the subject sits on a landscape screen, in NDC (x: -1 left .. 1 right; y: -1 bottom .. 1 top). The copy lane is on the
   *  opposite side (overlay side l = copy left = subject right). Applied as a lens-style pan of pos+target (see reframe); ignored on portrait. */
  frame?: [number, number]
  /** wave 24 (windows narrower than 1.55:1): how wide the subject stands at its authored camera distance, in screen heights (px width / window height, measured at 1440x900: the
   *  1.5..98.5 percentile box of the form, trimmed of its ground). With a span, reframe() centres the subject in the free region beside its copy lane and, if it is wider than that
   *  region, pulls the camera back until it fits. 0 = centre only (a modelled stage sizes itself: extras/stages.ts). Absent = the legacy lens pan alone. */
  span?: number
  /** portrait only: multiply the camera distance (wide forms like the name need room on a phone) */
  back?: number
  /** portrait only (v10): raise the subject on the phone screen by this much NDC (a vertical lens pan, after the pull-back): a tall copy block (the About room) leaves the art less room under the title */
  lift?: number
  dwell: number                // relative scroll weight spent STILL at this waypoint
  travel: number               // relative scroll weight of the flight INTO this waypoint
  tvs?: string[]               // project ids whose small TVs are featured here (lit, live reels)
  overlay: string              // overlay id (chapter id in chapters.ts or an area id)
  sound?: string               // optional sound cue id for arrival
}

/** camera that looks at an area from outside the ring, slightly off-axis so the hub TV shows behind */
function areaCam(a: Area, dist = 10, side = 0.18, lift = 1.2): Waypoint['cam'] {
  const ang = (a.angle * Math.PI) / 180 + side
  const r = RING + dist
  return { pos: [Math.sin(ang) * r, a.height + lift, Math.cos(ang) * r], target: a.center, fov: 35 }
}
const at = (a: Area, dx = 0, dy = 0, dz = 0): Vec3 => [a.center[0] + dx, a.center[1] + dy, a.center[2] + dz]
const yawTo = (a: Area) => (a.angle * Math.PI) / 180 // forms authored facing +z; this turns them to face outward from the hub
const A = (id: AreaId) => area(id)!
/** a 3/4-from-above camera over a form: azimuth `az` rad off the area's outward direction, elevation `el` deg, distance `r` */
function overCam(a: Area, centre: Vec3, az = 0, el = 40, r = 12, fov = 35): Waypoint['cam'] {
  const A0 = (a.angle * Math.PI) / 180 + az, E = (el * Math.PI) / 180
  return { pos: [centre[0] + Math.sin(A0) * Math.cos(E) * r, centre[1] + Math.sin(E) * r, centre[2] + Math.cos(A0) * Math.cos(E) * r], target: [centre[0], centre[1] + 0.2, centre[2]], fov }
}

/** v9: a ring camera set by its distance E to the area centre instead of by its distance outside the ring (a big `side` otherwise
 *  pulls the camera far away: the chord grows with the angle). The camera sits `side` rad round the ring from the area, E units from its centre. */
function ringCam(a: Area, side: number, E: number, lift = 1.2, fov = 35): Waypoint['cam'] {
  const D = RING * Math.cos(side) + Math.sqrt(Math.max(0, E * E - RING * RING * Math.sin(side) ** 2))
  const ang = (a.angle * Math.PI) / 180 + side
  return { pos: [Math.sin(ang) * D, a.height + lift, Math.cos(ang) * D], target: a.center, fov }
}
/** the yaw (added to yawTo) that turns a flat-faced form toward a ringCam(side, E); k = 1 faces it square, 0.7 keeps a 3/4 view */
function faceYaw(side: number, E: number, k = 0.7): number {
  const D = RING * Math.cos(side) + Math.sqrt(Math.max(0, E * E - RING * RING * Math.sin(side) ** 2))
  return k * Math.atan2(D * Math.sin(side), D * Math.cos(side) - RING)
}

// ---- the hall (unit 10H, Joseph 2026-10-09). One stone hall stands off the About ring, its doors facing the Education area's last stop (the compass).
// Hall-local coordinates: lx across (looking down the nave, +lx is on the LEFT), y up from the floor, d DEPTH into the hall (0 at the door sill, HALL.len at the
// end wall with the five interest windows). hallPt turns them into world space; extras/hall.ts and transitions/doors.ts build the room from the same numbers.
// Clearances (checked): >= 20 from the hub, >= 10 from the mind ring, >= 13 from Education.
export const HALL = { at: [-12.7, -4.5, 26.0] as Vec3, yaw: 0.7236, len: 36, hw: 7.6, height: 17.2 }
export function hallPt(lx: number, y: number, d: number): Vec3 {
  const c = Math.cos(HALL.yaw), s = Math.sin(HALL.yaw)
  return [HALL.at[0] + lx * c + d * s, HALL.at[1] + y, HALL.at[2] - lx * s + d * c]
}
/** the five interests, left to right as you face the windows (also the order of the stops hold .. knight); lx = where the window and the object that stands before it sit */
export const HALL_STOPS = ['hold', 'meeple', 'records', 'guitar', 'knight'] as const
export const HALL_PITCH = 3.1
export const hallStopX = (i: number) => (2 - i) * HALL_PITCH
/** w11: the five interests live in open SPACES beyond the hall's end wall (d = HALL.len), a gallery along the nave axis that alternates sides.
 *  at = the floor centre in world coordinates (floor y = HALL.at[1]); yaw = the yaw of the object's front (local +z faces the arriving camera, the backdrop goes on its -z side); i = the window index 0..4 */
export interface InterestSpace { id: 'hold' | 'meeple' | 'records' | 'guitar' | 'knight'; i: number; at: Vec3; yaw: number; radius: number }
const SPACE_YAW = HALL.yaw + Math.PI
export const INTEREST_SPACES: InterestSpace[] = [
  { id: 'hold', i: 0, at: hallPt(4.5, 0, 56), yaw: SPACE_YAW, radius: 8 },
  { id: 'meeple', i: 1, at: hallPt(-4.5, 0, 74), yaw: SPACE_YAW, radius: 8 },
  { id: 'records', i: 2, at: hallPt(4.5, 0, 92), yaw: SPACE_YAW, radius: 8 },
  { id: 'guitar', i: 3, at: hallPt(-4.5, 0, 110), yaw: SPACE_YAW, radius: 8 },
  { id: 'knight', i: 4, at: hallPt(4.5, 0, 128), yaw: SPACE_YAW, radius: 8 },
]
/** a camera before an interest's object: azimuth `az` rad off the line back toward the hall (0 = square on, the object facing the camera), elevation `el` deg, distance `r`; looks `lookY` above the floor centre of space i */
function spaceCam(i: number, az: number, el: number, r: number, fov = 36, lookY = 1.3): Waypoint['cam'] {
  const c = INTEREST_SPACES[i].at, A0 = INTEREST_SPACES[i].yaw + az, E = (el * Math.PI) / 180
  return { pos: [c[0] + Math.sin(A0) * Math.cos(E) * r, c[1] + Math.sin(E) * r, c[2] + Math.cos(A0) * Math.cos(E) * r], target: [c[0], c[1] + lookY, c[2]], fov }
}
const spaceAt = (i: number, dy = 0): Vec3 => { const c = INTEREST_SPACES[i].at; return [c[0], c[1] + dy, c[2]] }

export const WAYPOINTS: Waypoint[] = [
  // ---- prologue: fly through cloud toward the hub; the TV appears through the mist
  { id: 'clouds', area: 'hub', form: 'fog', place: { at: [0, 0, 40] }, cam: { pos: [13.5, 0.3, 36], target: [-4, 0, 35.6], fov: 40 }, back: 0.94, lift: 0.1, dwell: 1.2, travel: 0, overlay: 'prologue', sound: 'wind' },
  { id: 'name', area: 'hub', form: 'name', place: { at: [0, -0.2, 14] }, cam: { pos: [0, 0.4, 24], target: [0, 0, 10], fov: 36 }, frame: [0, 0.13], back: 2.4, dwell: 1.4, travel: 1.0, overlay: 'name', sound: 'poweron' },
  // ---- establishing shot: the whole world, the TV at its centre, six lit areas on the ring
  { id: 'world', area: 'hub', form: 'orbits', place: { at: [0, 0, 0] }, cam: { pos: [38, 16, 44], target: [0, -1, 0], fov: 38 }, frame: [0.2, 0], back: 1.35, lift: 0.22, dwell: 1.0, travel: 1.2, overlay: 'world' },
  // ---- w12 flight order: Work (QVR quant research + the two equity pitches) -> Systems -> Research -> Second Brain -> Education -> About. Each area's ring angle is in AREAS.
  { id: 'surface', area: 'work', form: 'surface', place: { at: at(A('work')), yaw: yawTo(A('work')), scale: 0.92 }, cam: areaCam(A('work'), 12), frame: [0.30, 0], span: 0, back: 1.92, lift: 0.36, dwell: 1.3, travel: 1.4, tvs: ['qvr'], overlay: 'surface', sound: 'work' },
  { id: 'cloudflare', area: 'work', form: 'cloudflare', place: { at: at(A('work'), 0, 0.2, 0), yaw: yawTo(A('work')) + faceYaw(0.26, 11, 0.5), scale: 0.85 }, cam: ringCam(A('work'), 0.26, 11, 0.8), frame: [-0.3, 0], span: 0.55, back: 1.79, lift: 0.08, dwell: 1.2, travel: 0.7, tvs: ['cloudflare'], overlay: 'cloudflare', sound: 'sig.cloudflare' },
  { id: 'appfolio', area: 'work', form: 'appfolio', place: { at: at(A('work'), 0, 0.1, 0), yaw: yawTo(A('work')) + faceYaw(0.34, 12.5), scale: 0.86 }, cam: ringCam(A('work'), 0.34, 12.5, 0.6), frame: [0.3, 0], span: 0.86, back: 3.07, lift: 0.11, dwell: 1.2, travel: 0.7, tvs: ['appfolio'], overlay: 'appfolio', sound: 'sig.appfolio' },
  { id: 'recruiting', area: 'work', form: 'recruiting', place: { at: at(A('work')), yaw: yawTo(A('work')) + faceYaw(0.42, 12.5), scale: 0.75 }, cam: ringCam(A('work'), 0.42, 12.5, 0.4), frame: [-0.3, 0], span: 0.68, back: 1.68, lift: 0.14, dwell: 1.1, travel: 0.7, tvs: ['recruiting-os'], overlay: 'recruiting', sound: 'sig.recruiting' },
  { id: 'chomchom', area: 'work', form: 'chomchom', place: { at: at(A('work'), 0, -0.1, 0), yaw: yawTo(A('work')) + faceYaw(0.5, 12.5), scale: 0.74 }, cam: ringCam(A('work'), 0.5, 12.5, 1.8), frame: [0.28, 0], span: 0.69, back: 1.56, lift: 0.3, dwell: 1.2, travel: 0.7, tvs: ['chomchom'], overlay: 'chomchom', sound: 'sig.chomchom' },
  // ---- Systems
  { id: 'secretary', area: 'systems', form: 'secretary', place: { at: at(A('systems')), yaw: yawTo(A('systems')) + faceYaw(-0.14, 11.5), scale: 0.9 }, cam: ringCam(A('systems'), -0.14, 11.5, 0.6), frame: [0.3, 0], span: 0.95, back: 3.29, lift: 0.3, dwell: 1.3, travel: 1.4, tvs: ['secretary'], overlay: 'secretary', sound: 'systems' },
  { id: 'watchdog', area: 'systems', form: 'watchdog', place: { at: at(A('systems'), 0, 0.2, 0), yaw: yawTo(A('systems')) + faceYaw(0.04, 11, 0.5), scale: 1.0 }, cam: ringCam(A('systems'), 0.04, 11, 1.8), frame: [-0.3, 0], span: 0.7, back: 2.37, lift: 0.1, dwell: 1.1, travel: 0.7, tvs: ['watchdog'], overlay: 'watchdog', sound: 'sig.watchdog' },
  { id: 'alarm', area: 'systems', form: 'pushup', place: { at: at(A('systems'), 0, 0, 0), yaw: yawTo(A('systems')) }, cam: areaCam(A('systems'), 9.5, 0.12), frame: [0.2, 0], span: 0, back: 2.26, lift: 0.15, dwell: 1.3, travel: 0.7, tvs: ['selforge'], overlay: 'alarm' },
  { id: 'drill', area: 'systems', form: 'zeta', place: { at: at(A('systems'), 0, 0.4, 0), yaw: yawTo(A('systems')) + 0.25 }, cam: areaCam(A('systems'), 9.5, 0.32), frame: [-0.3, 0], span: 0, back: 1.44, lift: 0.09, dwell: 1.1, travel: 0.7, tvs: ['zeta'], overlay: 'drill' },
  { id: 'table', area: 'systems', form: 'table', place: { at: at(A('systems'), 0, -0.3, 0), yaw: yawTo(A('systems')) + 0.5 }, cam: overCam(A('systems'), at(A('systems'), 0, -0.3, 0), 0.5, 36, 12.8), frame: [0.24, 0], span: 0.8, back: 4.76, lift: 0.09, dwell: 1.3, travel: 0.7, tvs: ['table-model', 'hand-compass'], overlay: 'table' },
  // ---- Research
  { id: 'market', area: 'research', form: 'phase', place: { at: at(A('research')), yaw: yawTo(A('research')) }, cam: areaCam(A('research'), 10), frame: [-0.34, 0], span: 0, back: 3.84, lift: 0.29, dwell: 1.2, travel: 1.4, tvs: ['love-island'], overlay: 'market', sound: 'research' },
  { id: 'record', area: 'research', form: 'counties', place: { at: at(A('research'), 0, -0.4, 0), yaw: yawTo(A('research')) + 0.3 }, cam: overCam(A('research'), at(A('research'), 0, -0.4, 0), 0.3, 46, 12.5), frame: [0.3, 0], span: 0, back: 2.18, lift: 0.22, dwell: 1.2, travel: 0.7, tvs: ['wwii'], overlay: 'record' },
  { id: 'pair', area: 'research', form: 'dyads', place: { at: at(A('research'), 0, -0.3, 0), yaw: yawTo(A('research')) + 0.6 }, cam: areaCam(A('research'), 10, 0.62, 1.6), frame: [-0.3, 0], span: 0, back: 1.44, lift: 0.16, dwell: 1.1, travel: 0.7, tvs: ['thrift'], overlay: 'pair' },
  // ---- Second Brain
  { id: 'mind', area: 'mind', form: 'brain', place: { at: at(A('mind')), yaw: yawTo(A('mind')) }, cam: areaCam(A('mind'), 12.5), frame: [-0.42, 0], span: 0.68, back: 2.56, lift: 0.15, dwell: 1.6, travel: 1.4, tvs: A('mind').projects, overlay: 'mind', sound: 'mind' },
  // ---- Education
  { id: 'school', area: 'education', form: 'uchicago', place: { at: at(A('education')), yaw: yawTo(A('education')) + faceYaw(0.1, 10.5, 0.5), scale: 0.72 }, cam: ringCam(A('education'), 0.1, 10.5, 0.8), frame: [-0.32, 0], span: 0.95, back: 2.23, lift: 0.16, dwell: 1.4, travel: 1.4, overlay: 'education', sound: 'education' },
  { id: 'mathecon', area: 'education', form: 'mathecon', place: { at: at(A('education'), 0, 0.1, 0), yaw: yawTo(A('education')) + faceYaw(0.26, 11.5), scale: 0.76 }, cam: ringCam(A('education'), 0.26, 11.5, 0.6), frame: [0.3, 0], span: 0, back: 2.1, lift: -0.06, dwell: 1.4, travel: 0.7, overlay: 'mathecon', sound: 'sig.mathecon' },
  { id: 'instrument', area: 'education', form: 'compass', place: { at: at(A('education'), 0, 0.2, 0), yaw: yawTo(A('education')) + faceYaw(0.42, 12, 0.6), scale: 1.05 }, cam: ringCam(A('education'), 0.42, 12, 1.2), frame: [-0.3, 0], span: 0.52, back: 2.54, lift: 0.27, dwell: 1.3, travel: 0.7, tvs: ['metamorphoses', 'odyssey', 'liaozhai'], overlay: 'instrument' },
  // ---- About (w11): the gate (outside, the closed doors on the right of the frame), the hall (inside, the nave and its five lancets), then the five interests, each in its own open space beyond the hall's end wall.
  { id: 'gate', area: 'about', form: 'fog', place: { at: hallPt(0, 5, -6), yaw: HALL.yaw }, cam: { pos: hallPt(0, 2.8, -15), target: hallPt(0, 5.2, 0), fov: 40 }, frame: [0.22, 0], back: 1.3, lift: 0.1, dwell: 1.2, travel: 1.2, overlay: 'gate', sound: 'sig.hall' },
  { id: 'hall', area: 'about', form: 'fog', place: { at: hallPt(0, 5, 17), yaw: HALL.yaw }, cam: { pos: hallPt(0, 3.6, 18), target: hallPt(0, 8.6, 36), fov: 46 }, frame: [0.35, 0], span: 1, back: 1.1, dwell: 1.7, travel: 1.6, overlay: 'hall' },
  { id: 'hold', area: 'about', form: 'hold', place: { at: spaceAt(0), yaw: INTEREST_SPACES[0].yaw + 0.1 }, cam: spaceCam(0, 0, 14, 13.5, 44, 2.75), frame: [-0.22, 0], span: 0.6, back: 1.13, lift: 0.17, dwell: 0.9, travel: 1.4, overlay: 'hold', sound: 'about' },
  { id: 'meeple', area: 'about', form: 'meeple', place: { at: spaceAt(1), yaw: INTEREST_SPACES[1].yaw + 0.25 }, cam: spaceCam(1, 0, 54, 21.5, 44, 1.75), frame: [-0.22, 0], span: 0.38, back: 0.98, lift: 0.29, dwell: 0.9, travel: 0.7, overlay: 'meeple' },
  { id: 'records', area: 'about', form: 'turntable3d', place: { at: spaceAt(2), yaw: INTEREST_SPACES[2].yaw + 0.45 }, cam: spaceCam(2, 0.25, 30, 15.5, 40, 1.25), frame: [-0.3, 0], span: 0.5, back: 1.75, lift: 0.55, dwell: 0.9, travel: 0.7, overlay: 'records' },
  { id: 'guitar', area: 'about', form: 'guitar', place: { at: spaceAt(3), yaw: INTEREST_SPACES[3].yaw + 0.62, scale: 1.45 }, cam: spaceCam(3, 0, 20, 10, 40, 2.0), frame: [-0.22, 0], span: 0.4, back: 2.5, lift: 0.13, dwell: 0.9, travel: 0.7, overlay: 'guitar', sound: 'sig.guitar' },
  { id: 'knight', area: 'about', form: 'knight', place: { at: spaceAt(4, 2.4), yaw: INTEREST_SPACES[4].yaw + 0.62 }, cam: spaceCam(4, 0, 46, 21, 44, 1.25), frame: [-0.22, 0], span: 0.55, back: 1.15, lift: 0.36, dwell: 0.9, travel: 0.7, overlay: 'knight' },
  // ---- the finale: a contact page (Joseph 2026-10-09: not the Latin line on the hanging TV). Built by src/v3/world/extras/finale.ts: the camera rises into a night sky over the lit ring world; the form is the establishing shot's 'orbits'.
  { id: 'epilogue', area: 'hub', form: 'orbits', place: { at: [0, 0, 0] }, cam: { pos: [0, 54, 50], target: [0, -2, 0], fov: 40 }, frame: [-0.3, 0], back: 1.5, lift: 0.55, dwell: 1.4, travel: 1.6, overlay: 'epilogue', sound: 'sig.world' },
]

// ---- v8 framing: shift pos+target sideways (a lens-style pan: the view direction does not change) so the subject sits
// opposite its copy lane. Sized in NDC, so it is aspect-correct; fades out toward square and is off on portrait (phone
// layout: title on top, copy at the bottom, subject in the middle). Mutates WAYPOINTS[i].cam in place, flight.ts reads it each frame.
// (areaCam hands out Area.center as the target: give every waypoint its own arrays before anything mutates them)
//
// wave 24: the legacy pan scales with the aspect (full strength at 1.55:1, 57% at 1024x768) while the copy lane is a fixed 380..560 px, so on a 4:3 window the
// subject sat under the lane. Between 1.55:1 and 1.47:1 the framing fades over to the FREE REGION: the strip of the window between the copy lane (measured from the
// overlay's own header and info blocks, once per resize) and the far edge. The subject is centred in that strip and, when its authored width (`span`) is wider than the
// strip, the camera is pulled back along the view axis until it fits. At 1.55:1 and wider (1440x900, 1280x720, 1920x1080, ...) and on portrait nothing changes.
WAYPOINTS.forEach(w => { w.cam.pos = [...w.cam.pos]; w.cam.target = [...w.cam.target] })
const BASE = WAYPOINTS.map(w => ({ pos: [...w.cam.pos] as Vec3, target: [...w.cam.target] as Vec3 }))

/** the free-region rules (px unless noted); exported so a measurement script can try other values */
export const FRAMING = {
  from: 1.55,       // aspect at and above which the legacy framing is used, unchanged
  full: 1.47,       // aspect at and below which the free-region framing is at full strength
  gap: 24,          // between the copy lane and the subject
  edge: 14,         // beyond the page padding, between the subject and the window edge
  fill: 0.94,       // the share of the free width a subject (its authored span) may fill
  stageFill: 0.88,  // the same for a modelled stage, measured in window widths (extras/stages.ts: the stage's own size undercounts its frame and ledge)
  maxPull: 1.7,     // the farthest the camera is pulled back
}
/** where waypoint `id`'s subject may stand on a landscape window narrower than FRAMING.from: [a, b] in px, the centre in NDC (c), the weight of this framing (t, 0..1)
 *  and the camera pull-back already applied (pull). Cached by reframe(), so a stage may read it every frame. null: the legacy framing is in force. */
export interface FreeRegion { a: number; b: number; c: number; t: number; pull: number }
const FREE = new Map<string, FreeRegion>()
export const freeRegion = (id: string): FreeRegion | null => FREE.get(id) ?? null

/** the copy lane of waypoint w in px: [left, right] edges of its header and info blocks as laid out now (offsets, so the entrance transforms do not matter). While the
 *  overlays do not exist yet it is the standard lane of ui/overlays.ts fit(): min(max(31vw, 380), 560) wide, pad + 10 from the left edge or pad + 44 from the right. */
function laneOf(w: Waypoint, vw: number, side: 1 | -1, pad: number): [number, number] {
  const ov = typeof document !== 'undefined' ? document.getElementById('ov-' + w.overlay) : null
  if (ov) {
    let l = Infinity, r = -Infinity
    for (const sel of ['.head', '.info']) {
      const e = ov.querySelector<HTMLElement>(sel)
      if (e && e.offsetWidth > 0) { l = Math.min(l, e.offsetLeft); r = Math.max(r, e.offsetLeft + e.offsetWidth) }
    }
    if (r > l) return [l, r]
  }
  const lane = Math.min(Math.max(vw * 0.31, 380), 560)
  return side > 0 ? [pad + 10, pad + 10 + lane] : [vw - pad - 44 - lane, vw - pad - 44]
}

export function reframe(vw = 1600, vh = 900) {
  const aspect = vw / Math.max(1, vh)
  const k = Math.min(1, Math.max(0, (aspect - 1.05) / 0.5))
  // the weight of the free-region framing: 0 at FRAMING.from and wider, 1 at FRAMING.full and narrower; never on a phone-width window
  const t = vw > 760 && aspect >= 1.05 ? Math.min(1, Math.max(0, (FRAMING.from - aspect) / (FRAMING.from - FRAMING.full))) : 0
  const pad = Math.min(44, Math.max(16, vw * 0.026))
  FREE.clear()
  WAYPOINTS.forEach((w, i) => {
    const b = BASE[i], f = w.frame
    const pos = [...b.pos] as Vec3, tgt = [...b.target] as Vec3
    let cx = f ? f[0] * k : 0          // where the subject stands, in NDC x
    if (f && t > 0 && w.span !== undefined && f[0] !== 0) {
      const side = f[0] > 0 ? 1 : -1   // 1: the subject is on the right, the copy on the left
      const [l, r] = laneOf(w, vw, side, pad)
      const a = side > 0 ? r + FRAMING.gap : pad + FRAMING.edge
      const e = side > 0 ? vw - pad - FRAMING.edge : l - FRAMING.gap
      if (e - a > 160) {
        const pull = 1 + (w.span > 0 ? Math.min(FRAMING.maxPull, Math.max(1, (w.span * vh) / ((e - a) * FRAMING.fill))) - 1 : 0) * t
        const c = (a + e) / vw - 1
        cx += (c - cx) * t
        if (pull !== 1) for (let q = 0; q < 3; q++) pos[q] = tgt[q] + (pos[q] - tgt[q]) * pull
        FREE.set(w.id, { a, b: e, c, t, pull })
      }
    }
    if (f && (k > 0 || cx !== 0)) {
      const dx = tgt[0] - pos[0], dy = tgt[1] - pos[1], dz = tgt[2] - pos[2]
      const D = Math.hypot(dx, dy, dz) || 1
      const rl = Math.hypot(dx, dz) || 1, rx = -dz / rl, rz = dx / rl // right = dir x up (horizontal)
      const halfH = D * Math.tan(((w.cam.fov ?? 35) * Math.PI) / 360), halfW = halfH * aspect
      const sx = -cx * halfW, sy = -(f[1] ?? 0) * k * halfH
      for (const v of [pos, tgt]) { v[0] += rx * sx; v[2] += rz * sx; v[1] += sy }
    }
    // portrait: pull back (fades in between 1.05:1 and 0.6:1)
    const pk = Math.min(1, Math.max(0, (1.05 - aspect) / 0.45)), bk = 1 + ((w.back ?? 1) - 1) * pk
    if (bk !== 1) for (let a = 0; a < 3; a++) pos[a] = tgt[a] + (pos[a] - tgt[a]) * bk
    if (w.lift && pk > 0) {
      const D = Math.hypot(tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]) || 1
      const sy = -w.lift * pk * D * Math.tan(((w.cam.fov ?? 35) * Math.PI) / 360)
      pos[1] += sy; tgt[1] += sy
    }
    for (let a = 0; a < 3; a++) { w.cam.pos[a] = pos[a]; w.cam.target[a] = tgt[a] }
  })
}
if (typeof window !== 'undefined') {
  reframe(window.innerWidth, window.innerHeight)
  let rz = 0, rz2 = 0
  const again = () => reframe(window.innerWidth, window.innerHeight)
  // the overlays lay out in the same frame as a resize and may run after this: frame once now (the legacy numbers are right at once), and again a frame later, when the lane is measured
  window.addEventListener('resize', () => { cancelAnimationFrame(rz); cancelAnimationFrame(rz2); rz = requestAnimationFrame(() => { again(); rz2 = requestAnimationFrame(again) }) })
  // the first layout of the overlays: measured lanes replace the standard-lane fallback
  window.addEventListener('v3:ready', () => requestAnimationFrame(again), { once: true })
}
