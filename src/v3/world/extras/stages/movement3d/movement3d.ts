// "THE MOVEMENT", photoreal path (wave 24, approach B): a high-horology skeleton movement with a flying tourbillon, built as a three.js r186 object
// at the watchdog stop and driven by anime.js 4.5. Every wheel is one of the jobs the watchdog checks; hover any part for its watch name and its
// job, word for word from src/data/nervous-system.json. The DOM + SVG movement (../movement) stays as the fallback (?movement=svg, or a failed build).
//
//   train      barrel 72 -> centre pinion 12 | centre wheel 96 -> third pinion 8 | third wheel 60 -> tourbillon (cage) pinion 12 | fixed fourth wheel 48
//              round the cage, the escape pinion 12 rolling on it | escape wheel 15 club teeth | pallet fork | balance 1 Hz (two beats a second).
//              Degrees per centre-wheel degree: barrel 1/6, third 12, cage 60 (once a minute: the cage is the small seconds), escape 240 relative to
//              the cage (300 absolute: it also rides round with the cage). The centre wheel turns once an hour, so the hands keep the visitor's time.
//              Motion works: cannon pinion 12 -> minute wheel 36 / pinion 10 -> hour wheel 40. Keyless works: crown -> crown wheel 24 -> ratchet 48 on
//              the barrel arbor, with a click. Involute flanks (./gears.ts, the jscad MIT port) and the meshing phases of ../movement/geom.ts.
//   escapement each beat the impulse pin swings the fork from one banking pin to the other: the escape wheel recoils a hair as it unlocks, is pushed
//              through the impulse, DROPS free to the other pallet and LOCKS there; the drop and the lock are real steps in sim.E (see beat()).
//              The balance amplitude follows the mainspring tension; below the lift angle the watch stops. The cage carries the whole escapement.
//   finish     ruthenium plate with perlage, rhodium bridges with Côtes de Genève and mirror anglage, gold-filled engraving (words only), 18k gold
//              wheels with circular graining and polished chamfers, heat-blued screws with slots (thin-film iridescence), rubies in gold chatons,
//              a black-polished tourbillon cage, a Breguet overcoil hairspring that breathes, the mainspring coiling in the open barrel as you wind
//              (both springs are ribbons placed in the vertex shader), an Incabloc-style shock spring, a regulator index, a power-reserve dial.
//              MeshPhysicalMaterial everywhere: anisotropy maps for the brushing (./finish.ts), the shared studio PMREM turned to face the camera, clearcoat on the
//              polished case and the black lacquer, thin-film iridescence on the blued steel. A domed sapphire crystal over the hands adds only its own reflection of the
//              studio (additive, tinted toward an anti-reflective blue) and fades out while the movement is exploded. Rubies are NOT transmissive: a transmissive material
//              makes three.js redraw every opaque object of the field into a second target each frame, so they carry ior 1.77 + clearcoat + sheen instead. The Poly Haven
//              studio HDRI (stages/studio.ts) was tried against the shared PMREM (__mv3.setEnv('hdri')): darker and more contrasty, the plate reads as carbon; the shared one stays.
//   anime      a createTimer runs the simulation (balance, escapement, run-down, coast); createAnimatable proxies smooth the fork during back-drive
//              and the pointer parallax; createDraggable is the crown (x winds or sets the hands, y pulls it out); one createTimeline explodes the
//              movement into labelled layers (plain proxy objects, never an Euler), and svg.createDrawable draws the leader lines on.
//   interact   drag the crown sideways to wind (the power reserve rises), pull it up to set the hands (the balance stops: hacking), drag any wheel to
//              back-drive the train at its true ratio, Explode / Assemble, a Loupe that re-renders the movement magnified under the pointer (a
//              second camera with setViewOffset into a render target shown on a lens mesh: no GPU read-back), Slow (one eighth speed).
//   honesty    the DOM root is data-proof="skip" and says Simulation; the only numerals shown are the schedules quoted from nervous-system.json.
//   reduced    no timer: the movement rests assembled; a Step button advances one beat; winding, dragging, explode and the loupe still answer.
//   fit        frame() gets a lane {top, floor} from the stage (a phone: the band between the copy's title and its info block; a desktop: the HUD's foot to the bottom pill)
//              and, on a landscape window narrower than 1.55:1, the free region beside the copy (layout.ts freeRegion): the case shrinks and slides until crown, case,
//              controls and note sit inside it. The movement stands on the camera's ray through that screen point (unprojected), sized in pixels.
//   time       the hands show the visitor's real time: every visit (present rising from 0) re-syncs them, assembles the movement, pushes the crown in and winds the
//              spring enough to run; while it runs the train keeps them (the centre wheel turns once an hour).
//   touch      a finger on a wheel that turns (found within a fingertip's reach), on the crown, or anywhere on the movement with the loupe on, belongs to the movement:
//              the page does not scroll under it and the swipe stepper does not see it; a tap names the part above the fingertip, clear of the controls and the note.
//   perf       about 110 draw calls and 190k triangles for the stage (budget 120 / 400k), InstancedMesh for the screws, every shader compiled ahead of arrival, no GPU
//              read-back (the loupe renders into a target shown on a lens mesh), the timer pauses off-stop / hidden / Pause, one raycast per 24 ms from the pointer.
import * as THREE from 'three'
import { animate, createAnimatable, createDraggable, createScope, createTimeline, createTimer, spring, stagger, svg, type Draggable, type JSAnimation, type Scope, type Timeline, type Timer } from 'animejs'
import NS from '../../../../../data/nervous-system.json'
import { state as appState } from '../../../../../state'
import { meshPhase } from '../movement/geom'
import { freeRegion } from '../../../layout'
import { studioEnv } from '../studio'
import { capsulePath, circle, circleX, clubWheel, crownGeo, extrude, involute, lathe, LOCAL_UV, LOCK_U, mergeMat, pinion, PLATE_UV, ribbon, rod, spokeWindows, taperPath, TAU } from './gears'
import { aoTexture, circularMap, cotesMap, makeMats, perlageMap, printTextures, springMat, type AOShape } from './finish'
import './mv3.css'

const D2R = Math.PI / 180
type XY = [number, number]
const pol = (r: number, deg: number, o: XY = [0, 0]): XY => [o[0] + r * Math.cos(deg * D2R), o[1] + r * Math.sin(deg * D2R)]
const dirRad = (a: XY, b: XY) => Math.atan2(b[1] - a[1], b[0] - a[0])
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x)
const tick = () => new Promise<void>(r => setTimeout(r, 0))

// ------------------------------------------------------------------------------------------------ layout (movement units: the case is 1000 across, y up)
const mC = 2.6, mB = 3.6, mR = 3.0, mT = 3.4, mF = 82 / 30, m2 = 2.2, m3 = 52.8 / 25
const C: XY = [0, 0]
const B = pol(42 * mB, 132)
const CW: XY = [0, B[1] + Math.sqrt((36 * mR) ** 2 - B[0] ** 2)]
const K: XY = [-20, -240], CAGE_K = 1.12
const T = circleX(C, 52 * mC, K, 36 * mT, 1)
const MW = pol(24 * m2, 205)
const PR: XY = [214, 166], PR_R = 64, PR_SWEEP = 100 * D2R
// the cage (local to K): balance at the centre, pallet pivot V and escape wheel E on one line (a straight-line lever)
const E_R = 82, V_R = 52, ESC_RO = 25, ESC_RR = 18.5, R_PIN = 7, DELTA = 8, LF = V_R - R_PIN, LIFT = (DELTA * LF) / R_PIN, BAL_R = 48, CAGE_R = 120
const CASE_TOP = 100, CRYSTAL_Z = 118, CRYSTAL_R = 462
const STEP = 12, RESERVE_S = 240, FULL_WIND = 900, CROWN_TO_RATCHET = 0.5, BEAT_HZ = 2

const JOBS = new Map<string, { label: string; schedule: string }>((NS as { nodes: { id: string; label: string; schedule: string }[] }).nodes.map(n => [n.id, n]))
type Drag = 'train' | 'wind' | 'hands'
interface Meta { name: string; job: string; drag?: Drag; ratio?: number }
const PART: Record<string, Meta> = {
  barrel: { name: 'Barrel and mainspring', job: 'secretary', drag: 'train', ratio: 1 / 6 },
  centre: { name: 'Centre wheel, minutes', job: 'watchdog', drag: 'train', ratio: -1 },
  third: { name: 'Third wheel', job: 'snapshot', drag: 'train', ratio: 12 },
  cage: { name: 'Flying tourbillon cage, seconds', job: 'keeper', drag: 'train', ratio: -60 },
  fixed: { name: 'Fixed fourth wheel', job: 'claude-code' },
  escape: { name: 'Escape wheel, club teeth', job: 'gmail', drag: 'train', ratio: -300 },
  pallet: { name: 'Pallet fork, ruby pallets', job: 'skills' },
  balance: { name: 'Balance, timing screws', job: 'vault' },
  hairspring: { name: 'Breguet overcoil hairspring', job: 'axe' },
  regulator: { name: 'Regulator index', job: 'recalibrator' },
  shock: { name: 'Shock-protection spring', job: 'backup' },
  ratchet: { name: 'Ratchet wheel', job: 'steward', drag: 'wind', ratio: 1 },
  click: { name: 'Click and click spring', job: 'steward' },
  crownwheel: { name: 'Crown wheel', job: 'carta', drag: 'wind', ratio: -2 },
  minute: { name: 'Minute wheel', job: 'audit', drag: 'hands', ratio: 1 / 3 },
  hour: { name: 'Hour wheel', job: 'recruiting', drag: 'hands', ratio: -1 / 12 },
  reserve: { name: 'Power-reserve indicator', job: 'health' },
  bridges: { name: 'Bridges, Côtes de Genève', job: 'boot' },
  plate: { name: 'Main plate, perlage', job: 'daily' },
  dial: { name: 'Chapter ring', job: 'gcal' },
  hands: { name: 'Heat-blued hands', job: 'status' },
  screws: { name: 'Blued screws', job: 'organizer' },
  jewels: { name: 'Rubies in gold chatons', job: 'claims' },
}
const LABELS: { t: string; s: string }[] = [
  { t: 'Main plate', s: 'perlage on ruthenium' }, { t: 'Barrel', s: 'the mainspring, coiled' }, { t: 'Going train', s: 'gold wheels, polished chamfers' },
  { t: 'Flying tourbillon', s: 'the cage turns once a minute' }, { t: 'Bridges', s: 'Côtes de Genève, anglage' }, { t: 'Keyless works', s: 'ratchet, crown wheel, click' },
  { t: 'Motion works', s: 'minute and hour wheels' }, { t: 'Hands', s: 'heat-blued steel' }, { t: 'Swiss lever escapement', s: 'club teeth, ruby pallets' },
  { t: 'Balance', s: 'Breguet overcoil, shock spring' },
]

export interface Mv3Opts {
  renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera; scene: THREE.Scene; env: THREE.Texture
  root: THREE.Group; view: { dir: THREE.Vector3; dist: number; fov: number }
  emit(name: string, data?: unknown): void; reduced(): boolean; prewarm(o: THREE.Object3D): void
}
export interface Mv3Frame {
  present: number; held: boolean; phone: boolean; covered: boolean; visH: number; portrait: boolean
  /** the band (viewport px) the movement may use: the crown rises no higher than `top`, the controls end above `floor` */
  lane?: { top: number; floor: number }
}
export interface Mv3Handle {
  frame(f: Mv3Frame): void
  hover(ray: THREE.Raycaster, x: number, y: number): 'pointer' | 'grab' | null
  down(ray: THREE.Raycaster, x: number, y: number): 'drag' | 'tap' | null
  move(ray: THREE.Raycaster, x: number, y: number): void
  up(moved: boolean): void
  /** the pointer left the stage */
  leave(): void
  /** the flight left the stop: the movement, its controls and the tags it silenced go with it (the scene keeps its state) */
  hide(): void
  grabbing(): boolean
  /** the particle alpha this stop asks for (the scope dims to dust while the movement is exploded) */
  dust(): number
  info(): Record<string, unknown>
  dispose(): void
}

// ------------------------------------------------------------------------------------------------ spring shaders (the ribbons)
const HAIR_GLSL = /* glsl */`
vec3 springPos(float u, float side, out vec3 n) {
  float turns = 9.0;
  float r = mix(7.0, 36.0, u) * (1.0 - 0.045 * uB * (1.0 - u) * u * 4.0);
  float a = 1.1 + u * turns * 6.2831853 + uB * (1.0 - u);
  vec2 d = vec2(cos(a), sin(a));
  n = normalize(vec3(d * side * 0.7, 1.0));
  return vec3(d * (r + side * 0.62), 0.0);
}`
const MAIN_GLSL = /* glsl */`
vec3 springPos(float u, float side, out vec3 n) {
  float turns = mix(5.5, 11.5, uT);
  float b = mix(0.45, 2.3, uT);
  float r = 15.0 + 96.0 * pow(u, b);
  float a = mix(uA0, uA1, u) + u * turns * 6.2831853;
  vec2 d = vec2(cos(a), sin(a));
  n = normalize(vec3(d * side * 0.6, 1.0));
  return vec3(d * (r + side * 1.05), 0.0);
}`

const LENS_VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const LENS_FRAG = /* glsl */`
uniform sampler2D tMap; uniform float uOpacity; varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5; float r = length(c) * 2.0;
  if (r > 1.0) discard;
  vec2 uv = 0.5 + c * (1.0 - 0.07 * r * r);
  vec3 col = texture2D(tMap, uv).rgb;
  col *= 1.0 - 0.32 * smoothstep(0.78, 1.0, r);
  col += vec3(0.045) * smoothstep(0.55, 0.0, length(c - vec2(-0.17, 0.2)));
  gl_FragColor = vec4(col, uOpacity * (1.0 - smoothstep(0.975, 1.0, r)));
}`

// ------------------------------------------------------------------------------------------------ build
export async function buildMovement3D(c: Mv3Opts): Promise<Mv3Handle> {
  const phone = innerWidth <= 760
  const rm0 = c.reduced()
  try { await Promise.all([document.fonts?.load('600 30px "IBM Plex Mono"'), document.fonts?.load('italic 400 30px "Bodoni Moda"')]) } catch { /* fallback fonts draw the print */ }
  const [perl, cotes, circ] = [await perlageMap(phone ? 768 : 1024), await cotesMap(phone ? 768 : 1024), await circularMap(512)]
  const print = printTextures({
    cage: K, cageR: [128 * CAGE_K, 140 * CAGE_K], pr: PR, prR: PR_R - 8, prSweep: PR_SWEEP,
    words: [
      { text: 'JOB WATCHDOG', at: [-236, -276], rot: -50 * D2R, size: 15.5 },
      { text: 'SIMULATION', at: [352, -44], rot: 11.9 * D2R, size: 12.5 },
      { text: 'FLYING TOURBILLON', at: [-322, 160], rot: -10.2 * D2R, size: 13 },
    ],
  }, phone ? 1024 : 2048)
  // contact shadows on the plate (the same outlines the bridges are cut from)
  // the bridges: tapered arms, broad where two screws hold them to the plate, slim where they carry a pivot
  const brPaths: { p: XY[]; w: number[] }[] = [
    { p: [[-458, 182], [-300, 160], [B[0] - 6, B[1] + 2]], w: [92, 70, 54] },
    { p: [[-206, 300], CW, [172, 302]], w: [38, 22, 38] },
    { p: [[458, -22], [250, -66], T, C], w: [54, 38, 30, 24] },
    { p: [[-460, -84], [-300, -200], [-172, -352]], w: [70, 48, 34] },
  ]
  const brOutline = (b: { p: XY[]; w: number[] }) => taperPath(b.p, b.w)
  const aoShapes: AOShape[] = [
    ...brPaths.map(b => ({ pts: brOutline(b).map(v => [v.x, v.y] as [number, number]), blur: 9, a: 0.82 })),
    { c: B, r: 134, blur: 16, a: 0.7 }, { c: C, r: 128, r0: 30, blur: 10, a: 0.32 }, { c: T, r: 106, r0: 20, blur: 9, a: 0.3 },
    { c: K, r: 136, r0: 118, blur: 9, a: 0.6 }, { c: K, r: 118, blur: 22, a: 0.22 }, { c: PR, r: 66, blur: 12, a: 0.75 }, { c: MW, r: 42, blur: 9, a: 0.35 },
  ]
  const ao = aoTexture(aoShapes, phone ? 512 : 1024)
  await tick()
  // the studio's front faces the camera: the view direction in world space
  const dirW = c.view.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), c.root.rotation.y)
  const { m, list: matList } = makeMats({ env: c.env, rotY: Math.atan2(dirW.x, dirW.z), perl, cotes, circ, ink: print.ink, engrave: print.engrave, ao })
  const crystalMat = m.crystal as THREE.MeshPhysicalMaterial
  const textures: THREE.Texture[] = [perl, cotes, circ, print.ink, print.engrave, ao]
  const geos: THREE.BufferGeometry[] = []
  const picks: THREE.Mesh[] = []
  const radius = new Map<string, number>()

  const mv = new THREE.Group(); mv.name = 'mv3'
  const tilt = new THREE.Group(); mv.add(tilt)
  const layers: THREE.Group[] = []
  for (let i = 0; i < 9; i++) { const g = new THREE.Group(); g.name = 'mv3-layer-' + i; tilt.add(g); layers.push(g) }
  const [L0, L1, L2, L3, L4, L5, L6, L7, L8] = layers
  const piv = (parent: THREE.Object3D, at: XY, name: string) => { const g = new THREE.Group(); g.name = name; g.position.set(at[0], at[1], 0); parent.add(g); return g }
  const mk = (g: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], parent: THREE.Object3D, part?: string, r?: number) => {
    const me = new THREE.Mesh(g, mat); parent.add(me); geos.push(g)
    if (part) { me.userData.part = part; picks.push(me); if (r && !radius.has(part)) radius.set(part, r) }
    return me
  }
  const FG = (a: THREE.Material, b: THREE.Material) => [a, b]
  const at = (x: number, y: number, z = 0, rz = 0) => new THREE.Matrix4().makeRotationZ(rz).setPosition(x, y, z)

  // ---- case, pendant, crown, stem (layer 0)
  mk(extrude(circle(498, 200), [circle(455, 200)], -30, CASE_TOP, 7, PLATE_UV()), FG(m.caseSatin, m.case), L0)
  const pend = new THREE.CylinderGeometry(19, 23, 34, 40); pend.translate(0, 510, 17)
  mk(pend, m.case, L0)
  const crown = new THREE.Group(); crown.position.set(0, 524, 17); L0.add(crown)
  mk(crownGeo(31, 44, 22), FG(m.case, m.steel), crown, 'crown', 34)
  const stem = new THREE.Group(); stem.position.set(0, 0, 17); L0.add(stem)
  const stemG = new THREE.CylinderGeometry(4.2, 4.2, 266, 12); stemG.translate(0, 190 + 133, 0)
  const wpin = new THREE.CylinderGeometry(9, 9, 16, 12); wpin.translate(0, 200, 0)
  mk(mergeMat([{ g: stemG, m: 0 }, { g: wpin, m: 1 }]), FG(m.steel, m.steelSatin), stem)
  // ---- the main plate (perlage) and the polished sink round the tourbillon aperture
  mk(extrude(circle(456, 220), [], -12, 0, 1.2, PLATE_UV()), FG(m.plate, m.plateEdge), L0, 'plate', 456)
  mk(extrude(circle(126 * CAGE_K, 160, K[0], K[1]), [circle(122 * CAGE_K, 160, K[0], K[1])], 0, 1.8, 0.8, PLATE_UV()), FG(m.rhodPolish, m.rhodPolish), L0)
  await tick()

  // ---- barrel (layer 1): toothed drum, wall, floor, open cover, arbor, mainspring
  const barrel = piv(L1, B, 'barrel')
  const bt = involute(72, mB)
  mk(extrude(bt.pts, [circle(116, 140)], 1, 9, 0.7, LOCAL_UV(bt.ro)), FG(m.goldFace, m.goldPolish), barrel, 'barrel', bt.ro)
  mk(mergeMat([
    { g: extrude(circle(124, 140), [circle(116, 140)], 9, 30, 1.2, LOCAL_UV(124)) },
    { g: extrude(circle(116, 120), [circle(15, 24)], 1, 3, 0.4, LOCAL_UV(124)) },
    { g: extrude(circle(124, 140), spokeWindows(5, 30, 104, 16, 0.3, 0.3), 30, 33, 0.9, LOCAL_UV(124)) },
  ]), FG(m.goldDrum, m.goldPolish), barrel, 'barrel')
  const springU = { uT: { value: 0.8 }, uA0: { value: 0 }, uA1: { value: 0 } }
  const mainMat = springMat(m.steel as THREE.MeshPhysicalMaterial, 'main', MAIN_GLSL, springU)
  const mainGeo = ribbon(900, (u, s) => { const r = 15 + 96 * Math.pow(u, 1.8) + s * 1.05, a = u * 10.3 * TAU; return [r * Math.cos(a), r * Math.sin(a), 0] })
  const mainMesh = mk(mainGeo, mainMat, piv(L1, B, 'mainspring'), 'barrel'); mainMesh.position.z = 18; mainMesh.frustumCulled = false
  mk(rod(13, 1, 34, 20), m.steel, piv(L1, B, 'arbor'))
  await tick()

  // ---- going train (layer 2): centre wheel + pinion, third wheel + pinion
  const centre = piv(L2, C, 'centre')
  const cg = involute(96, mC)
  mk(extrude(cg.pts, [...spokeWindows(5, 22, cg.rr - 13, 9, 0.32)], 10, 14, 0.7, LOCAL_UV(cg.ro)), FG(m.goldFace, m.goldPolish), centre, 'centre', cg.ro)
  mk(pinion(12, mB, 1, 9, 6), FG(m.steel, m.steelBlack), centre, 'centre')
  const third = piv(L2, T, 'third')
  const tg = involute(60, mT)
  mk(extrude(tg.pts, spokeWindows(4, 15, tg.rr - 11, 8, 0.3), 17, 21, 0.7, LOCAL_UV(tg.ro)), FG(m.goldFace, m.goldPolish), third, 'third', tg.ro)
  const tpPh = meshPhase(0, 96, 8, dirRad(C, T)) / D2R
  const tp = mk(pinion(8, mC, 9, 17, 4), FG(m.steel, m.steelBlack), third, 'third'); tp.rotation.z = tpPh * D2R
  // the barrel's phase against the centre pinion
  const barrelPh = meshPhase(0, 12, 72, dirRad(C, B)) / D2R
  await tick()

  // ---- the tourbillon (layer 3): fixed fourth wheel on the plate, the cage and everything it carries
  const fg = involute(48, mF)
  const fixedP = piv(L3, K, 'fixed'); fixedP.scale.setScalar(CAGE_K)
  mk(extrude(fg.pts, spokeWindows(4, 12, fg.rr - 9, 6, 0.25), 0.4, 3.6, 0.5, LOCAL_UV(fg.ro)), FG(m.steelDark, m.steelBlack), fixedP, 'fixed', fg.ro)
  const cage = piv(L3, K, 'cage'); cage.scale.setScalar(CAGE_K)
  const cagePinP = piv(L3, K, 'cage-pinion')
  const cageSub = [new THREE.Group(), new THREE.Group(), new THREE.Group()]   // escapement, balance, top frame: pulled apart in the exploded view
  for (const g of cageSub) cage.add(g)
  const cpPh = meshPhase(0, 60, 12, dirRad(T, K)) / D2R
  const cagePin = mk(pinion(12, mT, 17, 21, 2), FG(m.steel, m.steelBlack), cagePinP, 'cage')
  mk(mergeMat([
    { g: extrude(circle(CAGE_R, 160), [circle(CAGE_R - 8, 160)], 24, 27, 0.9, LOCAL_UV(CAGE_R)) },
    ...[0, 120, 240].map(a => ({ g: rod(4, 27, 72, 16, ...pol(CAGE_R - 4, a)) })),
  ]), FG(m.steelDark, m.steelBlack), cage, 'cage', CAGE_R)
  // the top frame: ring and three lyre arms to the balance's shock setting, the seconds pointer, the escape cock with its chaton
  mk(extrude(circle(CAGE_R, 160), spokeWindows(3, 15, CAGE_R - 8, 8, 0.55, 30 * D2R), 72, 76, 1.2, LOCAL_UV(CAGE_R)), FG(m.steelDark, m.steelBlack), cageSub[2], 'cage')
  mk(extrude(capsulePath([[0, -(CAGE_R - 12)], [0, -(CAGE_R + 18)]], 3.6), [], 76, 77.6, 0.5, LOCAL_UV(140)), FG(m.bluedBright, m.bluedBright), cageSub[2], 'cage')
  mk(extrude(capsulePath([pol(CAGE_R - 5, 90), [0, E_R]], 12), [], 66, 70, 1, LOCAL_UV(CAGE_R)), FG(m.steelDark, m.steelBlack), cageSub[0], 'cage')
  /** a ruby in a gold chaton, held by two blued screws (the chaton and the screws are one geometry with two material groups) */
  const chaton = (x: number, y: number, z: number, r: number, parent: THREE.Object3D) => {
    const cs = [0.7, 0.7 + 3.4].map(a => ({ g: extrude(circle(r * 0.26, 14, x + r * 1.42 * Math.cos(a), y + r * 1.42 * Math.sin(a)), [], z, z + 2.3, 0.45, LOCAL_UV(r)), m: 1 }))
    mk(mergeMat([{ g: extrude(circle(r, 48, x, y), [circle(r * 0.6, 32, x, y)], z, z + 1.8, 0.6, LOCAL_UV(r)), m: 0 }, ...cs]), FG(m.goldPolish, m.blued), parent, 'jewels')
    const j = lathe([[0, 0], [r * 0.62, 0], [r * 0.6, 0.8], [r * 0.42, 1.6], [0, 1.9]], 28); j.translate(x, y, z + 0.4)
    mk(j, m.ruby, parent, 'jewels')
  }
  chaton(0, E_R, 70, 7.2, cageSub[0])
  // the pallet cock: a short black-polished arm over the fork's pivot, with its jewel
  mk(extrude(capsulePath([pol(CAGE_R - 5, 38), [0, V_R]], 10), [], 62, 65.5, 0.9, LOCAL_UV(CAGE_R)), FG(m.steelDark, m.steelBlack), cageSub[0], 'cage')
  chaton(0, V_R, 65.5, 6, cageSub[0])
  // escape wheel + pinion (rotates relative to the cage)
  const esc = piv(cageSub[0], [0, E_R], 'escape')
  mk(extrude(clubWheel(15, ESC_RO, ESC_RR), spokeWindows(5, 4.6, ESC_RR - 4, 2.6, 0, 0), 40, 43, 0.45, LOCAL_UV(ESC_RO)), FG(m.steel, m.steelBlack), esc, 'escape', ESC_RO)
  const escPin = mk(pinion(12, mF, 0.4, 9, 0), FG(m.steel, m.steelBlack), esc, 'escape')
  mk(rod(1.6, 9, 66, 10), m.steel, esc)
  // pallet fork about V: arms to the two ruby pallets, the lever, the horns round the impulse pin; banking pins on the cage
  const fork = piv(cageSub[0], [0, V_R], 'pallet')
  const Ec: XY = [0, E_R - V_R]   // escape centre in fork-local coordinates
  const Pp = pol(ESC_RO - 1.4, 300, Ec), Pm = pol(ESC_RO - 1.4, 240, Ec)
  mk(mergeMat([
    { g: extrude(capsulePath([Pm, [0, 0], Pp], 4.6), [], 46, 48.6, 0.5, LOCAL_UV(30)) },
    { g: extrude(capsulePath([[0, 0], [0, -(LF - 5)]], 4.2), [], 46, 48.6, 0.5, LOCAL_UV(30)) },
    { g: extrude(capsulePath([[-3.3, -(LF - 6)], [-3.3, -(LF + 2.2)]], 2.3), [], 46, 48.6, 0.4, LOCAL_UV(30)) },
    { g: extrude(capsulePath([[3.3, -(LF - 6)], [3.3, -(LF + 2.2)]], 2.3), [], 46, 48.6, 0.4, LOCAL_UV(30)) },
    { g: extrude(circle(5.2, 24), [], 46, 49, 0.6, LOCAL_UV(30)) },
  ]), FG(m.steelDark, m.steelBlack), fork, 'pallet', 22)
  const stoneGeo = (p: XY, deg: number) => { const g = new THREE.BoxGeometry(3, 9, 7); g.translate(0, 3.2, 0); g.rotateZ(deg * D2R - Math.PI / 2); g.translate(p[0], p[1], 44); return g }
  mk(mergeMat([{ g: stoneGeo(Pp, 300) }, { g: stoneGeo(Pm, 240) }]), m.ruby, fork, 'pallet')
  mk(mergeMat([{ g: rod(1.3, 38, 50, 10, 5.4, V_R - 12) }, { g: rod(1.3, 38, 50, 10, -5.4, V_R - 12) }]), m.steel, cageSub[0])
  // balance: gold rim, three arms, timing screws; roller with the impulse jewel; staff
  const bal = piv(cageSub[1], [0, 0], 'balance')
  const scr: { g: THREE.BufferGeometry; at: THREE.Matrix4 }[] = []
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.31; const g = new THREE.CylinderGeometry(2.3, 2.3, 5, 12); g.rotateZ(-Math.PI / 2); scr.push({ g, at: new THREE.Matrix4().makeRotationZ(a).setPosition((BAL_R + 2.4) * Math.cos(a), (BAL_R + 2.4) * Math.sin(a), 56) }) }
  mk(mergeMat([{ g: extrude(circle(BAL_R, 120), spokeWindows(3, 7, BAL_R - 6, 4.6, 0, 90 * D2R), 54, 58, 0.6, LOCAL_UV(BAL_R)) }, ...scr]), FG(m.goldDrum, m.goldPolish), bal, 'balance', BAL_R + 6)
  mk(mergeMat([{ g: extrude(circle(8.5, 40), [], 48, 52.5, 0.5, LOCAL_UV(9)) }, { g: rod(2, 40, 76, 12) }]), FG(m.steel, m.steelBlack), bal, 'balance')
  mk(rod(1.25, 44, 50, 10, 0, R_PIN), m.ruby, bal, 'balance')
  // hairspring (Breguet overcoil: the last coil raised and curved in to the stud), stud, regulator index with curb pins
  const hairU = { uB: { value: 0 } }
  const aEnd = 1.1 + 9 * TAU
  const over: [number, number, number][] = []
  for (let i = 0; i <= 40; i++) { const v = i / 40, a = aEnd + v * 4.1, r = 36 - 10 * THREE.MathUtils.smoothstep(v, 0.12, 1), z = 2.6 * THREE.MathUtils.smoothstep(v, 0, 0.25); over.push([r * Math.cos(a), r * Math.sin(a), z]) }
  const hairMat = springMat(m.bluedBright as THREE.MeshPhysicalMaterial, 'hair', HAIR_GLSL, hairU)
  const hairGeo = ribbon(760, (u, s) => { const r = 7 + 29 * u + s * 0.62, a = 1.1 + u * 9 * TAU; return [r * Math.cos(a), r * Math.sin(a), 0] }, { pts: over, w: 1.24 })
  const hair = mk(hairGeo, hairMat, cageSub[1], 'hairspring', 37); hair.position.z = 62; hair.frustumCulled = false
  const studA = (aEnd + 4.1) / D2R, studP = pol(26, studA)
  mk(new THREE.BoxGeometry(5, 5, 6).translate(studP[0], studP[1], 65), m.steelBlack, cageSub[1], 'hairspring')
  const curb = pol(26, studA - 14)
  mk(mergeMat([
    { g: extrude(capsulePath([[0, 0], curb], 3.2), [], 65.4, 66.8, 0.4, LOCAL_UV(80)) },
    { g: extrude(capsulePath([[0, 0], pol(72, studA - 14 + 180 + 22)], 3), [], 65.4, 66.8, 0.4, LOCAL_UV(80)) },
    { g: extrude(circle(7, 32), [circle(3, 16)], 65.4, 67, 0.5, LOCAL_UV(80)) },
  ]), FG(m.steelBlack, m.steel), cageSub[1], 'regulator', 20)
  mk(mergeMat([{ g: rod(0.8, 61, 65.5, 8, ...pol(1.6, studA + 76, curb)) }, { g: rod(0.8, 61, 65.5, 8, ...pol(1.6, studA - 104, curb)) }]), m.steel, cageSub[1], 'regulator')
  // the shock spring (a lyre) and the cap jewel on the cage's top hub
  const lyreA: XY[] = [[-2.6, -7.6], [-8.8, -2.6], [-8, 5.2], [-2.8, 8.4]], lyreB = lyreA.map(([x, y]) => [-x, y] as XY)
  mk(mergeMat([{ g: extrude(capsulePath(lyreA, 1.7), [], 76.4, 77.6, 0.3, LOCAL_UV(12)) }, { g: extrude(capsulePath(lyreB, 1.7), [], 76.4, 77.6, 0.3, LOCAL_UV(12)) }]), FG(m.goldPolish, m.goldPolish), cageSub[2], 'shock', 11)
  chaton(0, 0, 76, 5.4, cageSub[2])
  await tick()

  // ---- bridges (layer 4): rhodium, Côtes de Genève, mirror anglage, gold-filled engraving; bosses a hair proud of the bridge
  const bosses: [XY, number][] = [[B, 46], [CW, 24], [T, 26], [C, 26]]
  mk(mergeMat([
    ...brPaths.map(b => ({ g: extrude(brOutline(b), [], 34, 44, 3.4, PLATE_UV(), 3) })),
    ...bosses.map(([p, r]) => ({ g: extrude(circle(r, 64, p[0], p[1]), [], 34, 45.4, 3.4, PLATE_UV(), 3) })),
  ]), FG(m.rhodFace, m.rhodPolish), L4, 'bridges', 60)
  chaton(T[0], T[1], 45.4, 15, L4)
  // blued screws: one InstancedMesh (slotted domed heads)
  const half = (s: number) => { const sh: XY[] = []; for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + (i / 24) * Math.PI; sh.push([Math.cos(a) * 1, Math.sin(a) * 1]) } return sh.map(([x, y]) => new THREE.Vector2(s * (x * 1 + 0.09), y)) }
  const headR = half(1), headL = half(-1).reverse()
  const scrGeo = mergeMat([
    { g: extrude(headR, [], 0.28, 0.95, 0.3, LOCAL_UV(1), 3) },
    { g: extrude(headL, [], 0.28, 0.95, 0.3, LOCAL_UV(1), 3) },
    { g: extrude(circle(0.97, 32), [], 0, 0.3, 0.06, LOCAL_UV(1), 1) },
  ])
  const screwAt: [number, number, number, number][] = [
    [-424, 178, 44, 10.5], [-300, 170, 44, 10.5], [-188, 300, 44, 9], [156, 302, 44, 9], [430, -25, 44, 10], [250, -70, 44, 9],
    [-434, -98, 44, 10], [-177, -346, 44, 9.5], ...[45, 225].map(a => { const p = pol(19.5, a, T); return [p[0], p[1], 47, 3.6] as [number, number, number, number] }),
    [PR[0] - 50, PR[1] - 30, 53.5, 4], [PR[0] + 50, PR[1] - 30, 53.5, 4],
  ]
  const screws = new THREE.InstancedMesh(scrGeo, [m.blued, m.blued], screwAt.length); geos.push(scrGeo)
  screwAt.forEach(([x, y, z, r], i) => { screws.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ((i * 1.37) % 3.1) + 0.3), new THREE.Vector3(r, r, r * 3.2))) })
  screws.computeBoundingSphere(); screws.userData.part = 'screws'; L4.add(screws); picks.push(screws)
  await tick()

  // ---- keyless works (layer 5): ratchet with snailing, crown wheel, click and its spring
  const ratchet = piv(L5, B, 'ratchet')
  const rg = involute(48, mR)
  mk(extrude(rg.pts, spokeWindows(5, 19, rg.rr - 9, 9, 0.42), 46, 51, 0.8, LOCAL_UV(rg.ro)), FG(m.steelSatin, m.steel), ratchet, 'ratchet', rg.ro)
  const bigScrew = (parent: THREE.Object3D, z: number, r: number) => { const s = new THREE.Mesh(scrGeo, [m.blued, m.blued]); s.position.z = z; s.scale.set(r, r, r * 3.2); s.rotation.z = 0.5; s.userData.part = 'screws'; picks.push(s); parent.add(s) }
  bigScrew(ratchet, 51, 13)
  const crownWheel = piv(L5, CW, 'crownwheel')
  const kg = involute(24, mR)
  const cwPh = meshPhase(0, 48, 24, dirRad(B, CW)) / D2R
  mk(extrude(kg.pts, [], 46, 50.4, 0.7, LOCAL_UV(kg.ro)), FG(m.steelSatin, m.steel), crownWheel, 'crownwheel', kg.ro).rotation.z = cwPh * D2R
  bigScrew(crownWheel, 50.4, 8)
  const clickP = pol(112, 213, B), clickTip = pol(73.5, 236, B)
  const click = piv(L5, clickP, 'click')
  mk(extrude(capsulePath([[0, 0], [clickTip[0] - clickP[0], clickTip[1] - clickP[1]]], 9), [], 46, 49.4, 0.7, LOCAL_UV(40)), FG(m.steelBlack, m.steel), click, 'click', 20)
  mk(extrude(capsulePath([pol(120, 199, B), pol(136, 212, B), pol(140, 231, B)], 3.2), [], 46, 48.6, 0.4, PLATE_UV()), FG(m.blued, m.blued), L5, 'click')
  await tick()

  // ---- motion works + power reserve (layer 6)
  const cannon = piv(L6, C, 'cannon')
  mk(mergeMat([{ g: pinion(12, m2, 52, 57, 0) }, { g: rod(6, 57, 98, 16), m: 1 }]), FG(m.steel, m.steelBlack), cannon, 'hands')
  const minuteW = piv(L6, MW, 'minute')
  const mwg = involute(36, m2), mpg = 10
  const mwPh = meshPhase(0, 12, 36, dirRad(C, MW)) / D2R
  mk(extrude(mwg.pts, spokeWindows(4, 8, mwg.rr - 6, 5, 0.3), 52, 55, 0.5, LOCAL_UV(mwg.ro)), FG(m.goldFace, m.goldPolish), minuteW, 'minute', mwg.ro).rotation.z = mwPh * D2R
  mk(pinion(mpg, m3, 55, 59.5, 0), FG(m.steel, m.steelBlack), minuteW, 'minute')
  const hourW = piv(L6, C, 'hour')
  const hwg = involute(40, m3)
  const hwPh = meshPhase(0, 10, 40, dirRad(MW, C)) / D2R
  mk(extrude(hwg.pts, [circle(9, 24), ...spokeWindows(4, 14, hwg.rr - 6, 5, 0.3)], 60, 63, 0.5, LOCAL_UV(hwg.ro)), FG(m.goldFace, m.goldPolish), hourW, 'hour', hwg.ro).rotation.z = hwPh * D2R
  mk(extrude(circle(PR_R, 120, PR[0], PR[1]), [], 50, 53.5, 1, PLATE_UV()), FG(m.lacquer, m.rhodPolish), L6, 'reserve', PR_R)
  const prHand = piv(L6, PR, 'reserve-hand')
  mk(mergeMat([{ g: extrude([new THREE.Vector2(-12, -2.2), new THREE.Vector2(48, -0.9), new THREE.Vector2(54, 0), new THREE.Vector2(48, 0.9), new THREE.Vector2(-12, 2.2)], [], 54, 55.6, 0.4, LOCAL_UV(56)) }, { g: extrude(circle(5, 24), [], 54, 56.4, 0.6, LOCAL_UV(56)) }]), FG(m.blued, m.blued), prHand, 'reserve')
  await tick()

  // ---- chapter ring and hands (layer 7)
  mk(extrude(circle(456, 220), [circle(404, 200)], 58, 62.5, 1.4, PLATE_UV()), FG(m.lacquer, m.rhodPolish), L7, 'dial', 456)
  const hourH = piv(L7, C, 'hand-h'), minH = piv(L7, C, 'hand-m')
  mk(mergeMat([
    { g: extrude(capsulePath([[-36, 0], [178, 0]], 7.5), [], 84, 86.4, 0.5, LOCAL_UV(250)) },
    { g: extrude(circle(19.5, 48, 198, 0), [circle(12.5, 40, 198, 0)], 84, 86.4, 0.5, LOCAL_UV(250)) },
    { g: extrude([new THREE.Vector2(216, -3), new THREE.Vector2(242, -0.6), new THREE.Vector2(246, 0), new THREE.Vector2(242, 0.6), new THREE.Vector2(216, 3)], [], 84, 86.4, 0.5, LOCAL_UV(250)) },
    { g: extrude(circle(13, 32, -36, 0), [], 84, 86.4, 0.5, LOCAL_UV(250)) },
  ]), FG(m.blued, m.blued), hourH, 'hands', 250)
  mk(mergeMat([
    { g: extrude([new THREE.Vector2(-52, -4.5), new THREE.Vector2(0, -5.5), new THREE.Vector2(286, -2.4), new THREE.Vector2(286, 2.4), new THREE.Vector2(0, 5.5), new THREE.Vector2(-52, 4.5)], [], 92, 94.2, 0.5, LOCAL_UV(400)) },
    { g: extrude(circle(15, 40, 302, 0), [circle(9.5, 32, 302, 0)], 92, 94.2, 0.5, LOCAL_UV(400)) },
    { g: extrude([new THREE.Vector2(316, -2.2), new THREE.Vector2(392, -0.5), new THREE.Vector2(398, 0), new THREE.Vector2(392, 0.5), new THREE.Vector2(316, 2.2)], [], 92, 94.2, 0.5, LOCAL_UV(400)) },
  ]), FG(m.blued, m.blued), minH, 'hands', 400)
  mk(mergeMat([{ g: rod(11, 80, 98, 24) }, { g: lathe([[0, 98], [6.5, 98], [6, 100], [3.5, 101.4], [0, 101.8]], 24), m: 1 }]), FG(m.blued, m.goldPolish), L7, 'hands')
  // a centre seconds hand (ruby red, the stop's accent): it reads the cage angle, so it ticks with every beat of the escapement and stops when the
  // balance does (hacking, run-down). Under the cap and below the crystal's dome (the dome falls to z 99.6 at r 420), above the minute hand
  const secH = piv(L7, C, 'hand-sec')
  mk(mergeMat([
    { g: extrude([new THREE.Vector2(-92, -2.4), new THREE.Vector2(0, -1.7), new THREE.Vector2(410, -0.6), new THREE.Vector2(410, 0.6), new THREE.Vector2(0, 1.7), new THREE.Vector2(-92, 2.4)], [], 95.2, 96.4, 0.3, LOCAL_UV(410)) },
    { g: extrude(circle(10, 32, -80, 0), [], 95.2, 96.4, 0.3, LOCAL_UV(410)) },
  ]), FG(m.ruby, m.ruby), secH, 'hands', 410)

  // ---- the sapphire crystal (layer 8): a shallow dome (sphere cap, radius 4800) over the hands, a black dielectric that only adds its reflection of the studio (additive
  // blending, specular tinted a little toward the blue of an anti-reflective coat); it fades out while the movement is exploded
  const cap = new THREE.SphereGeometry(4800, 72, 10, 0, TAU, 0, Math.asin(CRYSTAL_R / 4800)); cap.rotateX(Math.PI / 2); cap.translate(0, 0, CRYSTAL_Z - 4800)
  const crystal = mk(cap, m.crystal, L8); crystal.renderOrder = 6

  // ---- hover ring (Systems vermilion), reparented to the hovered part
  const hiMat = new THREE.MeshBasicMaterial({ color: 0xff4a2b, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, toneMapped: false })
  const hiRing = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 120), hiMat); hiRing.renderOrder = 9; hiRing.visible = false; geos.push(hiRing.geometry)

  // ---- the loupe: a render target, a lens mesh in the scene (not in the movement, so the loupe never sees itself)
  const rt = new THREE.WebGLRenderTarget(phone ? 384 : 512, phone ? 384 : 512, { samples: phone ? 0 : 4, type: THREE.UnsignedByteType })
  const lensMat = new THREE.ShaderMaterial({ vertexShader: LENS_VERT, fragmentShader: LENS_FRAG, uniforms: { tMap: { value: rt.texture }, uOpacity: { value: 1 } }, transparent: true, depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true })
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lensMat); lens.renderOrder = 10; lens.visible = false; lens.frustumCulled = false; lens.name = 'mv3-lens'
  geos.push(lens.geometry); c.scene.add(lens)
  const loupeCam = new THREE.PerspectiveCamera()

  c.root.add(mv)
  mv.visible = false

  // ================================================================================================ simulation
  const t0 = new Date(), tMount = t0.getTime()
  const s0 = t0.getSeconds() + t0.getMilliseconds() / 1000, m0 = t0.getMinutes() + s0 / 60, h0 = (t0.getHours() % 12) + m0 / 60
  const cage0 = 90 - 6 * s0 - 270   // the seconds pointer (local 270 deg) reads the visitor's seconds
  // escape-wheel phase: at E = 0 a tooth's locking corner rests on the pallet at 300 deg (round E), a hair behind its face
  const psi0 = 300 + 4.2 + LOCK_U * 24
  // escape pinion's tooth phase against the fixed wheel (meshPhase of a 12 rolling round a 48), relative to the escape wheel
  const escPinOff = (5 * (90 + cage0) + 180 - 15) - (cage0 + psi0)
  escPin.rotation.z = escPinOff * D2R
  cagePin.rotation.z = (cpPh - cage0) * D2R
  // which banking side holds the pallet at 300 deg in the lock (the deeper one)
  const Ew = new THREE.Vector2(...Ec), stoneDepth = (s: number) => new THREE.Vector2(...Pp).rotateAround(new THREE.Vector2(0, 0), s * DELTA * D2R).distanceTo(Ew)
  const bankEven = stoneDepth(1) < stoneDepth(-1) ? 1 : -1
  const sim = {
    E: 0, Ebase: 0, bank: bankEven, beats: 0, th: -bankEven * 200, A: rm0 ? 0 : 200, Av: 0, ph: -bankEven * Math.PI / 2,
    fork: bankEven * DELTA, T: 0.82, W: 0, hs: 0, crown: 0, pull: 0, pulled: false, slow: false, engaged: true,
    dragging: null as string | null, coast: { v: 0 }, held: false, present: 0, running: false, lastFrame: 0, hovered: null as string | null, exploded: false,
    loupe: false, lx: -1, ly: -1, lastDetent: 0, g: 0, restartAt: 0,
  }
  const cwOf = () => sim.E / 240
  const parity = (n: number) => (((n % 2) + 2) % 2 === 0 ? bankEven : -bankEven)
  /** the fork's travel fraction q (0 at the bank it rests on, 1 at the other) -> the escape wheel's progress through the half step:
   *  unlock (a small recoil), impulse (pushed by the tooth on the pallet's impulse face), DROP (free, to the other pallet) and LOCK */
  const gOf = (q: number) => (q < 0.14 ? -0.05 * (q / 0.14) : q < 0.86 ? -0.05 + 0.9 * ((q - 0.14) / 0.72) : 1)
  const forkOf = (th: number) => -DELTA * clamp(th / LIFT, -1, 1)
  const escapement = () => {
    if (!sim.engaged) { sim.fork = sim.bank * DELTA; sim.g = 0; sim.E = sim.Ebase; return }
    const f = forkOf(sim.th)
    let q = clamp((sim.bank * DELTA - f) / (2 * sim.bank * DELTA), 0, 1)
    if (q >= 1) { sim.Ebase += STEP; sim.bank = -sim.bank; sim.beats++; q = 0; if (sim.hovered || sim.dragging) c.emit('count:tick') }
    sim.fork = f; sim.g = gOf(q); sim.E = sim.Ebase + STEP * sim.g
  }
  const settleTrain = () => { sim.Ebase = STEP * Math.floor(sim.E / STEP + 1e-6); sim.bank = parity(Math.round(sim.Ebase / STEP)); sim.E = sim.Ebase; sim.g = 0 }
  const restart = () => { settleTrain(); sim.engaged = false; sim.A = Math.min(sim.A, 20); sim.ph = -sim.bank * Math.PI / 2; sim.th = sim.A * Math.sin(sim.ph); sim.restartAt = performance.now() }
  const targetAmp = () => (sim.T > 0.03 && !sim.pulled && !sim.dragging ? LIFT + 45 + 195 * Math.min(1, sim.T / 0.5) : 0)
  const forkA = createAnimatable({ f: sim.fork }, { f: { duration: 70, ease: 'out(3)' } }) as unknown as { f(v?: number, d?: number): number }
  let forkTarget = 0

  const stepSim = (dtReal: number) => {
    const dt = dtReal * (sim.slow ? 1 / 6 : 1)
    if (!appState.paused || sim.dragging) {
      const tgt = targetAmp(), k = sim.pulled ? 260 : 7, cc = 2 * Math.sqrt(k) * (sim.pulled ? 1 : 0.8)
      sim.Av += (k * (tgt - sim.A) - cc * sim.Av) * dt; sim.A = Math.max(0, sim.A + sim.Av * dt)
      if (!sim.dragging && Math.abs(sim.coast.v) < 0.02) {
        sim.ph += TAU * (BEAT_HZ / 2) * dt
        sim.th = sim.A * Math.sin(sim.ph)
        // engage once the swing clears the lift angle again (after winding, a back-drive or the crown going back in)
        if (!sim.engaged && sim.A > LIFT * 1.04 && Math.abs(sim.th) > LIFT) sim.engaged = Math.sign(sim.th) === -sim.bank
        if (sim.engaged && sim.A < LIFT * 1.02) { settleTrain(); sim.engaged = false }
        escapement()
        if (sim.engaged) sim.T = Math.max(0, sim.T - dt / RESERVE_S)
      }
    }
    // coast after a back-drive (visitor-initiated, so it plays under the site's Pause too)
    if (Math.abs(sim.coast.v) > 0.02 && !sim.dragging) { sim.E += 240 * sim.coast.v * dtReal; settleSoft() }
  }
  /** during a back-drive: the fork flips with the escape wheel's half steps, smoothed by an animatable */
  const settleSoft = () => {
    const n = Math.floor(sim.E / STEP + 1e-6)
    const b = parity(n)
    if (b !== forkTarget) { forkTarget = b; forkA.f(b * DELTA, c.reduced() ? 0 : 70) }
    sim.Ebase = n * STEP; sim.bank = b; sim.g = (sim.E - sim.Ebase) / STEP; sim.fork = forkA.f()
  }

  // ---- winding, setting
  const root = document.createElement('div')
  root.className = 'mv3'; root.setAttribute('data-proof', 'skip'); root.setAttribute('role', 'group')
  root.setAttribute('aria-label', 'The Movement: a simulated watch movement with a flying tourbillon. Each part stands for a job the watchdog checks.')
  root.innerHTML = `<svg class="mv3-leads" aria-hidden="true"></svg><div class="mv3-labs" aria-hidden="true"></div><div class="mv3-loupe" aria-hidden="true"><b>Loupe</b></div>`
    + `<div class="mv3-crown"><span class="mv3-crown-proxy" aria-hidden="true"></span><input class="mv3-crown-key" type="range" min="0" max="100" step="1" value="82" aria-label="Mainspring: raise to wind the crown"></div>`
    + `<div class="mv3-ctl"><button type="button" class="mv3-btn mv3-wind">Wind</button><button type="button" class="mv3-btn mv3-set" aria-pressed="false">Set hands</button>`
    + `<button type="button" class="mv3-btn mv3-explode" aria-pressed="false">Explode</button><button type="button" class="mv3-btn mv3-loupe-btn" aria-pressed="false">Loupe</button>`
    + (rm0 ? `<button type="button" class="mv3-btn mv3-step">Step</button>` : phone ? '' : `<button type="button" class="mv3-btn mv3-slow" aria-pressed="false">Slow</button>`) + `</div>`
    + `<p class="mv3-note">Simulation<span class="mv3-note-more"> · drag the crown to wind, pull it up to set the hands</span></p>`
  document.body.append(root)
  const $ = <E extends Element>(s: string) => root.querySelector(s) as E
  const crownWrap = $<HTMLDivElement>('.mv3-crown'), crownEl = $<HTMLSpanElement>('.mv3-crown-proxy'), crownKey = $<HTMLInputElement>('.mv3-crown-key')
  const ctl = $<HTMLDivElement>('.mv3-ctl'), note = $<HTMLParagraphElement>('.mv3-note'), noteMore = $<HTMLSpanElement>('.mv3-note-more'), loupeEl = $<HTMLDivElement>('.mv3-loupe')
  const leads = $<SVGSVGElement>('.mv3-leads'), labs = $<HTMLDivElement>('.mv3-labs')
  const windBtn = $<HTMLButtonElement>('.mv3-wind'), setBtn = $<HTMLButtonElement>('.mv3-set'), explodeBtn = $<HTMLButtonElement>('.mv3-explode'), loupeBtn = $<HTMLButtonElement>('.mv3-loupe-btn')
  const slowBtn = root.querySelector('.mv3-slow') as HTMLButtonElement | null, stepBtn = root.querySelector('.mv3-step') as HTMLButtonElement | null
  const tip = tipEl(() => avoid)

  const wind = (dR: number) => {
    if (dR <= 0) return
    const d = Math.min(dR, (1 - sim.T) * FULL_WIND)
    if (d <= 0) return
    const pitch = 360 / 48, before = Math.floor(sim.W / pitch)
    sim.W += d; sim.T = Math.min(1, sim.T + d / FULL_WIND)
    root.classList.add('was-wound')
    const after = Math.floor(sim.W / pitch)
    if (after !== before) c.emit('hub:detent', { ch: after % 12 })
    if (!sim.engaged && sim.T > 0.03 && performance.now() - sim.restartAt > 400) restart()
  }
  const setHands = (dMin: number) => { sim.hs += dMin }
  const onCrown = (deg: number) => {
    const d = deg - sim.crown
    sim.crown = deg
    if (Math.floor(deg / 15) !== sim.lastDetent) { sim.lastDetent = Math.floor(deg / 15); if (sim.pulled || d < 0) c.emit('hub:detent', { ch: 3 }) }
    if (sim.pulled) setHands(d * 0.5)
    else if (d > 0) wind(d * CROWN_TO_RATCHET)
  }
  const setPulled = (on: boolean) => {
    if (on === sim.pulled) return
    sim.pulled = on
    setBtn.setAttribute('aria-pressed', String(on)); setBtn.textContent = on ? 'Push crown' : 'Set hands'; noteMore.textContent = on ? ' · setting the hands: the balance is stopped, drag the crown sideways' : ' · drag the crown to wind, pull it up to set the hands'; sizes.ok = false
    crownKey.setAttribute('aria-label', on ? 'Hands: move to set the time' : 'Mainspring: raise to wind the crown')
    c.emit(on ? 'open' : 'close')
    if (on) { settleTrain(); sim.engaged = false } else restart()
    if (crownDrag && Math.abs(crownDrag.y - (on ? -24 : 0)) > 1) crownDrag.setY(on ? -24 : 0)
  }

  // ================================================================================================ anime: scope, timer, crown, explode
  let scope: Scope | null = null, timer: Timer | null = null, tl: Timeline | null = null, crownDrag: Draggable | null = null, coastAnim: JSAnimation | null = null
  const ex = { tilt: 0, lay: layers.map(() => ({ k: 0 })), sub: cageSub.map(() => ({ k: 0 })) }
  const par = createAnimatable({ x: 0, y: 0 }, { x: { duration: 900, ease: 'out(3)' }, y: { duration: 900, ease: 'out(3)' } }) as unknown as { x(v?: number): number; y(v?: number): number }
  const labEls: { el: HTMLDivElement; path: SVGPathElement; dot: SVGCircleElement }[] = []
  for (const l of LABELS) {
    const el = document.createElement('div'); el.className = 'mv3-lab'; el.innerHTML = '<b></b><i></i>'
    ;(el.firstChild as HTMLElement).textContent = l.t; (el.lastChild as HTMLElement).textContent = l.s
    labs.append(el)
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'), dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    dot.setAttribute('r', '2.2'); dot.style.opacity = '0'
    leads.append(path, dot); labEls.push({ el, path, dot })
  }
  let drawables: SVGElement[] = [], labAnim: JSAnimation | null = null, labOn = false
  scope = createScope({ root }).add(() => {
    crownDrag = createDraggable(crownEl, {
      x: { mapTo: 'rotate', snap: 15 }, y: { snap: 24 },
      container: [-24, Infinity, 0, -Infinity],
      dragSpeed: 1.4, velocityMultiplier: c.reduced() ? 0 : 0.6,
      releaseEase: c.reduced() ? 'out(3)' : spring({ duration: 520, bounce: 0.16 }),
      onGrab: () => { root.classList.add('winding'); hoverPart(null) },
      onUpdate: d => { onCrown(d.x); sim.pull = clamp(-d.y / 24, 0, 1) },
      onSettle: d => { onCrown(d.x); sim.pull = clamp(-d.y / 24, 0, 1); setPulled(d.y < -12); root.classList.remove('winding') },
      onRelease: () => { window.setTimeout(() => root.classList.remove('winding'), 700) },
    })
    tl = createTimeline({ autoplay: false, defaults: { ease: 'inOut(3)' } })
      .add(ex, { tilt: 1, duration: 1000 }, 0)
      .add(ex.lay, { k: 1, duration: 1100, ease: 'out(4)', delay: stagger(70) }, 220)
      .add(ex.sub, { k: 1, duration: 900, ease: 'out(3)', delay: stagger(90) }, 620)
    drawables = svg.createDrawable(labEls.map(l => l.path)) as unknown as SVGElement[]
    let failed = false
    if (!c.reduced()) timer = createTimer({ autoplay: false, onUpdate: self => { if (failed) return; try { stepSim(Math.max(0, Math.min(0.05, (Number.isFinite(self.deltaTime) ? self.deltaTime : 0) / 1000))) } catch (e) { failed = true; console.warn('[movement3d] stopped', e); timer?.pause() } } })
    return () => { /* listeners are removed in dispose */ }
  })
  const showLabels = (on: boolean) => {
    if (on === labOn) return
    labOn = on
    labAnim?.cancel()
    const els = labEls.map(l => l.el), dots = labEls.map(l => l.dot)
    if (c.reduced()) { for (const e of els) e.style.opacity = on ? '1' : '0'; for (const d of dots) d.style.opacity = on ? '1' : '0'; for (const d of drawables) (d as SVGPathElement).setAttribute('stroke-dasharray', on ? '1000 0' : '0 1000'); return }
    labAnim = animate(drawables, { draw: on ? ['0 0', '0 1'] : ['0 1', '0 0'], duration: on ? 620 : 260, delay: stagger(on ? 55 : 0), ease: 'inOut(2)' })
    animate(els, { opacity: on ? [0, 1] : 0, x: on ? [6, 0] : 0, duration: on ? 420 : 200, delay: stagger(on ? 55 : 0, { start: on ? 380 : 0 }), ease: 'out(3)' })
    animate(dots, { opacity: on ? 1 : 0, duration: 200, delay: stagger(on ? 55 : 0) })
  }
  const setExplode = (on: boolean) => {
    sim.exploded = on
    explodeBtn.setAttribute('aria-pressed', String(on)); explodeBtn.textContent = on ? 'Assemble' : 'Explode'
    if (!tl) return
    if (c.reduced()) tl.seek(on ? tl.duration : 0); else if (on) tl.play(); else tl.reverse()
    if (!on) showLabels(false)
    c.emit(on ? 'open' : 'close')
  }

  // ---- buttons
  const turn = { deg: 0 }
  windBtn.addEventListener('click', () => {
    if (!crownDrag) return
    const to = crownDrag.x + 120
    if (c.reduced()) { crownDrag.setX(to); onCrown(to); return }
    turn.deg = crownDrag.x
    animate(turn, { deg: to, duration: 620, ease: spring({ duration: 620, bounce: 0.12 }), onUpdate: () => { crownDrag?.setX(turn.deg); onCrown(turn.deg) } })
  })
  setBtn.addEventListener('click', () => setPulled(!sim.pulled))
  explodeBtn.addEventListener('click', () => setExplode(!sim.exploded))
  /** the loupe on or off; while it is on the site's decorative cursor ring would sit on the lens's centre, so it steps aside (the native cursor stays) */
  const setLoupe = (on: boolean) => {
    sim.loupe = on; loupeBtn.setAttribute('aria-pressed', String(on))
    if (on && sim.lx < 0) { const s = screenOf(escWorld()); sim.lx = s[0]; sim.ly = s[1] }
    document.documentElement.classList.toggle('mv3-loupe-on', on)
    if (!on) loupeEl.classList.remove('on')
  }
  loupeBtn.addEventListener('click', () => setLoupe(!sim.loupe))
  slowBtn?.addEventListener('click', () => { sim.slow = !sim.slow; slowBtn.setAttribute('aria-pressed', String(sim.slow)) })
  stepBtn?.addEventListener('click', () => {
    if (sim.T <= 0.01) { const r = stepBtn.getBoundingClientRect(); tip.show(r.left, r.top - 48, 'Wind it first', 'the mainspring is down'); return }
    sim.Ebase += STEP; sim.E = sim.Ebase; sim.bank = -sim.bank; sim.beats++; sim.T = Math.max(0, sim.T - 0.004); sim.th = -sim.bank * 60; sim.fork = sim.bank * DELTA
  })
  crownKey.addEventListener('input', () => {
    const want = Number(crownKey.value) / 100
    if (sim.pulled) { setHands((want - sim.T) * 60); crownKey.value = String(Math.round(sim.T * 100)); return }
    const d = want - sim.T
    if (d > 0) { wind(d * FULL_WIND); crownDrag?.setX(crownDrag.x + d * FULL_WIND / CROWN_TO_RATCHET); sim.crown = crownDrag?.x ?? sim.crown }
    else crownKey.value = String(Math.round(sim.T * 100))
  })
  let crownTimer = 0
  const crownTip = (e: PointerEvent) => {
    if (!sim.held) return
    const touch = e.pointerType === 'touch'
    tip.show(e.clientX, e.clientY, 'The crown', sim.pulled ? 'drag sideways to set the hands, down to run' : 'drag sideways to wind, up to set the hands', touch ? 'above' : 'cursor')
    window.clearTimeout(crownTimer)
    if (touch) crownTimer = window.setTimeout(() => tip.hide(), 1800)     // a tap's tip goes by itself (pointerleave fires right after a finger lifts)
  }
  crownEl.addEventListener('pointerenter', crownTip)
  crownEl.addEventListener('pointerdown', crownTip)
  crownEl.addEventListener('pointerleave', e => { if (e.pointerType === 'touch') return; if (!sim.dragging) tip.hide() })
  // a finger on the crown is the crown's: the site's swipe stepper must not see it
  crownEl.addEventListener('touchstart', e => e.stopPropagation(), { passive: true })

  // ================================================================================================ projection helpers
  // scratch vectors (the frame, the labels and the loupe allocate nothing per frame)
  const v3 = new THREE.Vector3(), camW = new THREE.Vector3(), rootW = new THREE.Vector3(), rayD = new THREE.Vector3(), mvW = new THREE.Vector3()
  const pool = Array.from({ length: 96 }, () => new THREE.Vector3()); let poolI = 0
  const screenOf = (w: THREE.Vector3): [number, number] => { v3.copy(w).project(c.camera); return [(v3.x + 1) / 2 * innerWidth, (1 - v3.y) / 2 * innerHeight] }
  const worldOf = (obj: THREE.Object3D, x = 0, y = 0, z = 0) => obj.localToWorld(pool[poolI++ % pool.length].set(x, y, z))
  const escWorld = () => worldOf(cageSub[0], 0, E_R - 8, 44)

  // ================================================================================================ pointer
  const partAt = (ray: THREE.Raycaster): { part: string; obj: THREE.Object3D } | null => {
    if (!mv.visible) return null
    const hits = ray.intersectObjects(picks, false)
    for (const h of hits) { const p = (h.object.userData.part as string | undefined); if (p && p !== 'crown') return { part: p, obj: h.object } }
    return null
  }
  /** a finger is ~14 px wide: when the exact pick is not a wheel that turns, look for one within a fingertip's reach (9 rays: the touch point and a ring of 8) and take the nearest */
  const FINGER = 15
  const tmpRay = new THREE.Raycaster(), tNdc0 = new THREE.Vector2()
  const partNear = (ray: THREE.Raycaster, x: number, y: number, finger: boolean): { part: string; obj: THREE.Object3D } | null => {
    const exact = partAt(ray)
    if (!finger || (exact && PART[exact.part]?.drag)) return exact
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU
      tmpRay.setFromCamera(tNdc0.set(((x + FINGER * Math.cos(a)) / innerWidth) * 2 - 1, -((y + FINGER * Math.sin(a)) / innerHeight) * 2 + 1), c.camera)
      const q = partAt(tmpRay)
      if (q && PART[q.part]?.drag) return q
    }
    return exact
  }
  const pivotOf = (part: string, obj: THREE.Object3D): THREE.Object3D => {
    const want: Record<string, string> = { barrel: 'barrel', centre: 'centre', third: 'third', cage: 'cage', escape: 'escape', ratchet: 'ratchet', crownwheel: 'crownwheel', minute: 'minute', hour: 'hour', balance: 'balance', pallet: 'pallet', fixed: 'fixed', reserve: 'reserve-hand' }
    let o: THREE.Object3D | null = obj
    while (o && o !== mv) { if (o.name === want[part]) return o; o = o.parent }
    return obj.parent ?? obj
  }
  /** the last pointer's kind: a finger has no hover, so its pick is made on the spot and its tip hangs above the fingertip */
  let lastType = 'mouse'
  const onPtr = (e: PointerEvent) => { lastType = e.pointerType }
  window.addEventListener('pointerdown', onPtr, { capture: true, passive: true }); window.addEventListener('pointermove', onPtr, { capture: true, passive: true })
  const touching = () => lastType === 'touch'
  const hoverPart = (p: { part: string; obj: THREE.Object3D } | null, x = 0, y = 0) => {
    sim.hovered = p?.part ?? null
    if (!p) { tip.hide(); hiRing.visible = false; return }
    const meta = PART[p.part], j = meta ? JOBS.get(meta.job) : undefined
    if (meta) tip.show(x, y, meta.name, j ? j.label : '', j ? j.schedule : '', touching() ? 'above' : 'cursor')
    const r = radius.get(p.part)
    if (r && meta?.drag) {
      const pv = pivotOf(p.part, p.obj)
      if (hiRing.parent !== pv) pv.add(hiRing)
      hiRing.scale.setScalar(r + 3); hiRing.position.set(0, 0, 100); hiRing.visible = true
    } else hiRing.visible = false
  }
  let grab: { part: string; drag: Drag; ratio: number; cx: number; cy: number; a: number; hist: [number, number][]; loupe?: boolean } | null = null
  const pointerAngle = (x: number, y: number, cx: number, cy: number) => Math.atan2(y - cy, x - cx) / D2R
  const handle: Mv3Handle = {
    hover(ray, x, y) {
      if (!sim.held) return null
      par.x(clamp((x / innerWidth - 0.5) * 2, -1, 1)); par.y(clamp((y / innerHeight - 0.5) * 2, -1, 1))
      if (sim.loupe) { sim.lx = x; sim.ly = y }
      // the pick itself runs once per frame (frame()), not once per pointer event; the cursor answers from the last pick
      // a pick is one raycast against ~55 meshes: made on the spot (stages.ts calls leave() whenever this returns null, which would cancel a queued pick) but at most one
      // per 24 ms from the pointer; a finger always picks at once
      pq.ray.copy(ray.ray); pq.x = x; pq.y = y; pq.on = true
      const now = performance.now()
      if (touching() || now - lastPickAt > 24) { lastPickAt = now; runPick() }
      if (!lastPick.inside) return lastPick.cursor
      return lastPick.cursor ?? (sim.loupe ? 'pointer' : null)
    },
    down(ray, x, y) {
      if (!sim.held) return null
      const p = partNear(ray, x, y, touching())
      const meta = p ? PART[p.part] : undefined
      if (!p || !meta?.drag) {
        if (sim.loupe && overMovement(x, y)) { grab = { part: '', drag: 'train', ratio: 0, cx: 0, cy: 0, a: 0, hist: [], loupe: true }; sim.lx = x; sim.ly = y; return 'drag' }
        const co = overMovement(x, y) ? mv.getObjectByName('centre') : undefined
        if (co) {
          // bridges, plate and dial cover most of the train: a press there still back-drives it, turning the centre wheel under the pointer at its true ratio
          const pv = pivotOf('centre', co); pv.updateWorldMatrix(true, false)
          const [cx, cy] = screenOf(worldOf(pv))
          grab = { part: p?.part ?? 'centre', drag: 'train', ratio: PART.centre.ratio ?? -1, cx, cy, a: pointerAngle(x, y, cx, cy), hist: [[performance.now(), cwOf()]] }
          sim.dragging = 'centre'; coastAnim?.cancel(); sim.coast.v = 0; settleTrain(); sim.engaged = false; forkTarget = sim.bank; forkA.f(sim.bank * DELTA, 0)
          if (p) hoverPart(p, x, y)
          c.emit('tv:grab')
          return 'drag'
        }
        return p ? 'tap' : null
      }
      const pv = pivotOf(p.part, p.obj); pv.updateWorldMatrix(true, false)
      const [cx, cy] = screenOf(worldOf(pv))
      grab = { part: p.part, drag: meta.drag, ratio: meta.ratio ?? 1, cx, cy, a: pointerAngle(x, y, cx, cy), hist: [[performance.now(), cwOf()]] }
      if (meta.drag === 'train') { sim.dragging = p.part; coastAnim?.cancel(); sim.coast.v = 0; settleTrain(); sim.engaged = false; forkTarget = sim.bank; forkA.f(sim.bank * DELTA, 0) }
      hoverPart(p, x, y)
      c.emit('tv:grab')
      return 'drag'
    },
    move(_ray, x, y) {
      if (!grab) return
      if (grab.loupe) { sim.lx = x; sim.ly = y; return }
      const a = pointerAngle(x, y, grab.cx, grab.cy)
      let d = a - grab.a; if (d > 180) d -= 360; if (d < -180) d += 360
      grab.a = a
      const dCCW = -d   // screen y points down: a clockwise drag on screen is a negative angle here
      if (grab.drag === 'wind') wind(dCCW / grab.ratio)
      else if (grab.drag === 'hands') setHands(-(dCCW / grab.ratio))
      else {
        const before = Math.floor(sim.E / STEP)
        sim.E += 240 * (dCCW / grab.ratio)
        settleSoft()
        if (Math.floor(sim.E / STEP) !== before) c.emit('count:tick')
        const now = performance.now(); grab.hist.push([now, cwOf()]); while (grab.hist.length > 2 && now - grab.hist[0][0] > 90) grab.hist.shift()
      }
      const meta = PART[grab.part], j = meta ? JOBS.get(meta.job) : undefined
      if (meta) tip.show(x, y, meta.name, j?.label ?? '', j?.schedule ?? '', touching() ? 'above' : 'cursor')
    },
    up() {
      const g = grab; grab = null
      if (!g) return
      if (g.loupe) return
      if (!touching()) tip.hide()
      if (g.drag === 'train') {
        sim.dragging = null
        if (!c.reduced() && g.hist.length > 1) {
          const [ta, ca] = g.hist[0], [tb, cb] = g.hist[g.hist.length - 1]
          const v = tb > ta ? ((cb - ca) / (tb - ta)) * 1000 : 0
          if (Math.abs(v) > 0.02) { sim.coast.v = v; coastAnim = animate(sim.coast, { v: 0, duration: 1600, ease: 'out(3)', onComplete: () => restart() }) } else restart()
        } else restart()
      }
      c.emit('tv:release')
    },
    leave() { pq.on = false; lastPick.cursor = null; lastPick.inside = false; if (!grab) hoverPart(null) },
    hide() { sim.held = false; sim.present = 0; everVisible = false; mv.visible = false; lens.visible = false; pq.on = false; lastPick.cursor = null; lastPick.inside = false; setRunning(false); setShown(false); setLoupe(false) },
    grabbing: () => !!grab,
    dust: () => 1 - 0.86 * ex.tilt,
    info: () => info(),
    frame: f => frame(f),
    dispose: () => dispose(),
  }
  const pq = { ray: new THREE.Ray(), x: 0, y: 0, on: false }, lastPick: { cursor: 'pointer' | 'grab' | null; inside: boolean } = { cursor: null, inside: false }
  const pickRay = new THREE.Raycaster()
  let lastPickAt = 0
  const runPick = () => {
    if (!pq.on) return
    pq.on = false
    pickRay.ray.copy(pq.ray)
    const p = partAt(pickRay)
    hoverPart(p, pq.x, pq.y)
    lastPick.inside = overMovement(pq.x, pq.y)
    lastPick.cursor = p ? (PART[p.part]?.drag ? 'grab' : 'pointer') : sim.loupe && lastPick.inside ? 'pointer' : null
  }
  const overMovement = (x: number, y: number) => { const [cx, cy] = screenOf(worldOf(tilt)); return Math.hypot(x - cx, y - cy) < screenR * 1.02 }

  // ---- touch: a finger on a wheel that turns (or, with the loupe on, anywhere on the movement) belongs to the movement: the page does not scroll under it and the site's
  // swipe stepper does not see it. The canvas is touch-action pan-y (pov.ts), so a vertical drag would otherwise scroll the page off the stop mid-drag.
  let touchOwn = false
  const tNdc = new THREE.Vector2()
  const onTouchStart = (e: TouchEvent) => {
    touchOwn = false
    if (!sim.held || e.touches.length !== 1 || e.target !== c.renderer.domElement) return
    const t = e.touches[0]
    pickRay.setFromCamera(tNdc.set((t.clientX / innerWidth) * 2 - 1, -(t.clientY / innerHeight) * 2 + 1), c.camera)
    const p = partNear(pickRay, t.clientX, t.clientY, true)
    if ((p && PART[p.part]?.drag) || (sim.loupe && overMovement(t.clientX, t.clientY))) { touchOwn = true; e.stopPropagation() }
  }
  const onTouchMove = (e: TouchEvent) => { if (touchOwn && e.cancelable) e.preventDefault() }
  const onTouchEnd = () => { touchOwn = false }
  window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd, { passive: true }); window.addEventListener('touchcancel', onTouchEnd, { passive: true })

  // ================================================================================================ frame: place, apply the simulation, DOM, loupe
  let shown = false, screenR = 200, lastCtl = '', lastCrown = '', everVisible = false, lastS = -1, visitAt = performance.now()
  const up = new THREE.Vector3(0, 1, 0), basis = new THREE.Matrix4(), zA = new THREE.Vector3(), xA = new THREE.Vector3(), yA = new THREE.Vector3(), fwd = new THREE.Vector3(), dirV = new THREE.Vector3()
  const GAP = 10, MIN_S = 170, CROWN_UP = 0.085, OFF_W = 2.15
  /** base size of the case in px: a phone gets the band between the title and the copy (the lane shrinks it further), a desktop a share of the window */
  const sizeOf = (ph: boolean) => Math.round(ph ? Math.min(innerWidth * 0.92, innerHeight * 0.46) : Math.max(320, Math.min(innerHeight * 0.68, innerWidth * 0.43, 680)))
  /** the movement's box for this frame: the base size, shrunk (and slid) until crown, case, controls and note all fit the lane; on a landscape window narrower than 1.55:1
   *  the free region beside the copy lane (layout.ts freeRegion) is what it may use. (x, y): the stage root's centre on screen. */
  const fit = (f: Mv3Frame, x: number, y: number): { s: number; cx: number; cy: number } => {
    let base = sizeOf(f.phone)
    const fr = f.phone ? null : freeRegion('watchdog')
    if (fr) base = Math.round(base + (Math.min(680, Math.round(innerHeight * 0.68 / fr.pull), Math.floor((fr.b - fr.a) * 0.96)) - base) * fr.t)
    const ln = f.lane
    if (!ln) return { s: base, cx: x, cy: y }
    const below = GAP + sizes.ctlH + sizes.noteH
    const s = Math.max(MIN_S, Math.min(base, Math.floor((ln.floor - ln.top - below) / (1 + CROWN_UP))))
    const lo = ln.top + (CROWN_UP + 0.5) * s, hi = ln.floor - below - 0.5 * s
    const cx = fr && fr.b - fr.a >= s ? x + (Math.min(fr.b - s / 2, Math.max(fr.a + s / 2, x)) - x) * fr.t : x
    return { s, cx, cy: hi >= lo ? Math.min(hi, Math.max(lo, y)) : lo }
  }
  const apply = () => {
    const cw = cwOf(), hcw = cw + sim.hs
    const cageA = cage0 - 60 * cw
    cage.rotation.z = cageA * D2R; cagePinP.rotation.z = cageA * D2R
    esc.rotation.z = (psi0 - sim.E) * D2R
    fork.rotation.z = sim.fork * D2R
    bal.rotation.z = sim.th * D2R; hairU.uB.value = sim.th * D2R
    barrel.rotation.z = (barrelPh + cw / 6) * D2R
    centre.rotation.z = -cw * D2R
    third.rotation.z = 12 * cw * D2R
    ratchet.rotation.z = sim.W * D2R
    crownWheel.rotation.z = -2 * sim.W * D2R
    const pitch = 360 / 48, u = (((sim.W % pitch) + pitch) % pitch) / pitch
    click.rotation.z = -6 * D2R * Math.sin(u * Math.PI)
    springU.uT.value = sim.T; springU.uA0.value = sim.W * D2R; springU.uA1.value = (barrelPh + cw / 6) * D2R
    cannon.rotation.z = -hcw * D2R
    minuteW.rotation.z = (hcw / 3) * D2R
    hourW.rotation.z = (-hcw / 12) * D2R
    minH.rotation.z = (90 - (m0 * 6 + hcw)) * D2R
    hourH.rotation.z = (90 - (h0 * 30 + hcw / 12)) * D2R
    secH.rotation.z = (cageA + 270) * D2R   // the cage pointer sits at local 270 deg: the same reading, on the centre arbor
    prHand.rotation.z = (90 + (PR_SWEEP / D2R) / 2 - sim.T * (PR_SWEEP / D2R)) * D2R
    crown.rotation.y = -sim.crown * D2R; stem.rotation.y = -sim.crown * D2R
    crown.position.y = 524 + 13 * sim.pull; stem.position.y = 13 * sim.pull
    // explode: layers fan out toward the viewer, the cage's escapement / balance / top frame separate inside it, the stack tilts to a three-quarter view
    for (let i = 0; i < layers.length; i++) layers[i].position.z = ex.lay[i].k * i * 62
    crystalMat.opacity = Math.max(0, 1 - 1.6 * ex.tilt); crystal.visible = crystalMat.opacity > 0.01
    for (let i = 0; i < cageSub.length; i++) cageSub[i].position.z = ex.sub[i].k * (i + 1) * 46
    const t = ex.tilt
    // a slow sway (the studio's strips slide across the metal the way they do on a turntable); none under reduced motion
    const ts = c.reduced() ? 0 : (performance.now() - visitAt) / 1000      // from the start of this visit: the same picture at the same second after every arrival
    const swX = Math.sin(ts * 0.23) * 0.018, swY = Math.sin(ts * 0.17 + 1.3) * 0.026
    tilt.rotation.set(-0.27 - 0.72 * t + par.y() * 0.035 + swX, 0.13 + 0.32 * t + par.x() * 0.05 + swY, 0.12 * t)
    tilt.scale.setScalar(1 - 0.32 * t); tilt.position.y = -70 * t
  }
  /** a visit starts: the hands show the real time again, the crown is in, the movement is assembled and the spring is wound enough to run */
  const resync = () => {
    sim.hs = ((Date.now() - tMount) / 60000) * 6 - cwOf()
    if (sim.exploded) setExplode(false)
    if (sim.pulled) setPulled(false)
    if (sim.loupe) setLoupe(false)
    if (sim.T < 0.5) sim.T = 0.62
    apply()
  }
  const frame = (f: Mv3Frame) => {
    sim.lastFrame = performance.now()
    sim.held = f.held; sim.present = f.present
    const vis = f.present > 0.05
    mv.visible = vis
    if (!vis) { everVisible = false; setRunning(false); setShown(false); lens.visible = false; return }
    if (!everVisible) { everVisible = true; visitAt = performance.now(); resync() }
    runPick()
    // place: the stage root's centre on screen, then the fit (lane, free region); the movement stands on the camera's ray through that point, a little toward the camera
    // from the root, and is sized in pixels (1000 movement units = S px)
    const rs = c.root.scale.x || 1
    c.camera.getWorldPosition(camW); c.camera.getWorldDirection(fwd)
    c.root.updateWorldMatrix(true, false)
    rootW.setFromMatrixPosition(c.root.matrixWorld)
    const rc = screenOf(rootW)
    const depth = Math.max(1, rootW.clone().sub(camW).dot(fwd) - OFF_W)
    const tanH = Math.tan((c.camera.fov * D2R) / 2)
    const fb = fit(f, rc[0], rc[1] - (f.phone ? 0 : 0.012 * innerHeight))
    const S = fb.s
    // the ray through the wanted centre, cut at `depth` along the camera's forward axis
    dirV.set((fb.cx / innerWidth) * 2 - 1, -(fb.cy / innerHeight) * 2 + 1, 0.5).unproject(c.camera).sub(camW).normalize()
    dirV.multiplyScalar(depth / Math.max(0.2, dirV.dot(fwd))).add(camW)
    c.root.worldToLocal(dirV)
    mv.position.copy(dirV)
    const enter = 0.72 + 0.28 * (1 - Math.pow(1 - f.present, 3))      // it settles in with the camera: 72 percent to full size over the entrance
    mv.scale.setScalar(((S * 2 * depth * tanH) / innerHeight / 1000 / rs) * enter)
    screenR = (S / 2) * enter * (1 - 0.32 * ex.tilt)
    if (S !== lastS) { lastS = S; sizes.ok = false; lastCtl = '' }
    zA.copy(c.view.dir).normalize(); xA.crossVectors(up, zA).normalize(); yA.crossVectors(zA, xA)
    basis.makeBasis(xA, yA, zA); mv.quaternion.setFromRotationMatrix(basis)
    apply()
    setRunning(!c.reduced() && !document.hidden && f.present > 0.05)
    // DOM: crown proxy, controls, note, labels; only while held and nothing covers it
    const on = f.held && !f.covered
    setShown(on)
    mv.updateWorldMatrix(true, true)
    if (on) {
      const cr = screenOf(worldOf(crown, 0, 22, 0)), ck = `${Math.round(cr[0])},${Math.round(cr[1])}`
      if (ck !== lastCrown) { lastCrown = ck; crownWrap.style.transform = `translate(${Math.round(cr[0])}px,${Math.round(cr[1])}px)` }
      const ctr = screenOf(worldOf(tilt)), bot = screenOf(worldOf(L0, 0, -500, 0))
      if (!sizes.ok) measure()
      const w = sizes.ctl, nb = sizes.note, stacked = f.phone && innerWidth <= 760
      const floor = f.lane ? f.lane.floor : innerHeight - (f.phone ? 150 : 74)
      const yC = Math.max(Math.min(Math.max(bot[1], ctr[1] + screenR) + GAP, floor - sizes.ctlH - (stacked ? 0 : sizes.noteH)), 8)
      const xC = Math.round(clamp(ctr[0] - w / 2, 8, innerWidth - w - 8))
      const k = `${Math.round(ctr[0])},${Math.round(yC)},${w},${stacked ? 1 : 0},${Math.round(ctr[1] - screenR)}`
      if (k !== lastCtl) {
        lastCtl = k
        ctl.style.transform = `translate(${xC}px,${Math.round(yC)}px)`
        // a phone has no room under the controls: the note hangs in the case's top-left corner, at the page margin
        const nx = stacked ? 16 : Math.round(clamp(ctr[0] - nb / 2, 8, innerWidth - nb - 8)), ny = stacked ? Math.round(ctr[1] - screenR + 2) : Math.round(yC + sizes.ctlH + 10)
        note.style.transform = `translate(${nx}px,${ny}px)`
        avoid[0] = [xC, yC, w, sizes.ctlH]; avoid[1] = [nx, ny, nb, note.offsetHeight || 15]
      }
      if (labOn || sim.exploded) placeLabels(ctr)
      if (sim.exploded && !labOn && ex.tilt > 0.85 && !f.phone) showLabels(true)
    }
    // loupe: a second camera on the same view, offset into the patch under the pointer, rendered into the target the lens shows
    const wantLoupe = on && sim.loupe && sim.lx >= 0
    loupeEl.classList.toggle('on', wantLoupe)
    lens.visible = wantLoupe
    if (wantLoupe) renderLoupe(f.phone)
  }
  // DOM sizes are measured once when the controls appear (and after a resize), never inside the frame
  const sizes = { ok: false, ctl: 420, ctlH: 36, note: 300, noteH: 22, lab: LABELS.map(() => 170) }
  const measure = () => {
    sizes.ok = true; sizes.ctl = ctl.offsetWidth || 420; sizes.ctlH = ctl.offsetHeight || 36; sizes.note = note.offsetWidth || 300
    sizes.noteH = innerWidth <= 760 ? 0 : (note.offsetHeight || 15) + 8; sizes.lab = labEls.map(l => l.el.offsetWidth || 170)
  }
  /** rects (x, y, w, h) a tip must keep clear of: the controls and the note (plain numbers, set when they are placed; no DOM read on a pointer move) */
  const avoid: [number, number, number, number][] = [[0, 0, 0, 0], [0, 0, 0, 0]]
  const onResize = () => { sizes.ok = false; lastCtl = '' }
  window.addEventListener('resize', onResize)
  const placeLabels = (ctr: [number, number]) => {
    const anchors: THREE.Vector3[] = [
      worldOf(L0, ...pol(456, 200), 0), worldOf(L1, ...pol(133, 175, B), 30), worldOf(L2, ...pol(105, -10, T), 20), worldOf(L3, ...pol(CAGE_R * CAGE_K, 200, K), 50),
      worldOf(L4, 452, -24, 44), worldOf(L5, ...pol(39, 10, CW), 48), worldOf(L6, ...pol(40, 180, MW), 54), worldOf(L7, ...pol(456, 10), 62),
      worldOf(esc, 0, 0, 43), worldOf(bal, 0, 0, 58),
    ]
    const pts = anchors.map(a => screenOf(a))
    // the columns sit just outside the projected stack (the case at the bottom, the chapter ring on top)
    let x0 = ctr[0] - screenR, x1 = ctr[0] + screenR
    for (const [lay, r] of [[L0, 498], [L7, 456], [L4, 452]] as [THREE.Object3D, number][]) for (let i = 0; i < 16; i++) { const p = screenOf(worldOf(lay, ...pol(r, i * 22.5), 40)); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]) }
    let colL = x0 - 26, colR = x1 + 26
    if (!sizes.ok) measure()
    const wL = Math.max(...sizes.lab.filter((_, i) => i === 0 || i === 1 || i === 3 || i === 6 || i === 9))
    if (colL - wL < 10) colL = 10 + wL
    const wR = Math.max(...sizes.lab.filter((_, i) => i === 2 || i === 4 || i === 5 || i === 7 || i === 8))
    if (colR + wR > innerWidth - 10) colR = innerWidth - 10 - wR
    const sides = [-1, -1, 1, -1, 1, 1, -1, 1, 1, -1]
    // de-overlap per column: sort by y, keep 34 px apart
    for (const s of [-1, 1]) {
      const idx = pts.map((_, i) => i).filter(i => sides[i] === s).sort((a, b) => pts[a][1] - pts[b][1])
      let last = -1e9
      const ys = new Map<number, number>()
      for (const i of idx) { const y = Math.max(pts[i][1], last + 34); ys.set(i, y); last = y }
      for (const i of idx) {
        const L = labEls[i], y = ys.get(i)!, x = s < 0 ? colL : colR
        const w = sizes.lab[i]
        L.el.classList.toggle('l', s < 0); L.el.classList.toggle('r', s > 0)
        L.el.style.left = `${Math.round(s < 0 ? x - w : x)}px`; L.el.style.top = `${Math.round(y - 9)}px`
        const [ax, ay] = pts[i], ex2 = x + (s < 0 ? 8 : -8)
        L.path.setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)}L${(ax + (ex2 - ax) * 0.55).toFixed(1)} ${y.toFixed(1)}L${ex2.toFixed(1)} ${y.toFixed(1)}`)
        L.dot.setAttribute('cx', ax.toFixed(1)); L.dot.setAttribute('cy', ay.toFixed(1))
      }
    }
  }
  const prevClear = new THREE.Color()
  const renderLoupe = (ph: boolean) => {
    const L = ph ? 150 : 210, zoom = ph ? 2.4 : 2.8
    root.style.setProperty('--L', L + 'px')
    loupeEl.style.transform = `translate(${Math.round(sim.lx)}px,${Math.round(sim.ly)}px)`
    loupeEl.style.left = '0px'; loupeEl.style.top = '0px'
    const w = L / zoom
    c.camera.updateMatrixWorld()
    loupeCam.copy(c.camera)
    loupeCam.setViewOffset(innerWidth, innerHeight, sim.lx - w / 2, sim.ly - w / 2, w, w)
    loupeCam.updateProjectionMatrix()
    // the lens: a disc facing the camera on the pointer's ray, in front of the movement
    rayD.set((sim.lx / innerWidth) * 2 - 1, -(sim.ly / innerHeight) * 2 + 1, 0.5).unproject(c.camera).sub(camW).normalize()
    const d = Math.max(0.5, camW.distanceTo(mvW.setFromMatrixPosition(mv.matrixWorld)) - 1.2)
    lens.position.copy(camW).addScaledVector(rayD, d)
    lens.quaternion.copy(c.camera.quaternion)
    lens.scale.setScalar(((L * 2 * d * Math.tan((c.camera.fov * D2R) / 2)) / innerHeight) * 0.985)
    const r = c.renderer, prevRT = r.getRenderTarget(), prevA = r.getClearAlpha(); r.getClearColor(prevClear)
    const ring = hiRing.visible; hiRing.visible = false
    try {
      r.setRenderTarget(rt); r.setClearColor(0x050506, 1); r.clear(true, true, false)
      r.render(mv, loupeCam)
    } finally { r.setRenderTarget(prevRT); r.setClearColor(prevClear, prevA); hiRing.visible = ring }
  }
  const setShown = (on: boolean) => {
    if (on === shown) return
    shown = on
    root.classList.toggle('on', on); root.classList.toggle('held', on)
    for (const b of [windBtn, setBtn, explodeBtn, loupeBtn, slowBtn, stepBtn, crownKey]) if (b) { b.tabIndex = on ? 0 : -1; b.disabled = !on }
    if (on) crownDrag?.enable(); else crownDrag?.disable()
    if (!on) { hoverPart(null); grab = null; if (sim.dragging) { sim.dragging = null; restart() } }
    document.documentElement.classList.toggle('ann-quiet', on)
  }
  const setRunning = (run: boolean) => {
    if (!timer || run === sim.running) return
    sim.running = run
    if (run) timer.play(); else timer.pause()
  }
  // the watchdog's timer stops when frames stop coming (the stage left the screen)
  const watch = window.setInterval(() => { if (performance.now() - sim.lastFrame > 250) setRunning(false) }, 250)

  // ---- compile everything now (with the scene's lights, and without them for the loupe), upload the textures
  for (const t of textures) { try { c.renderer.initTexture(t) } catch { /* the first frame uploads it */ } }
  mv.visible = true
  c.prewarm(mv)
  try { void (c.renderer as THREE.WebGLRenderer & { compileAsync?: (o: THREE.Object3D, cam: THREE.Camera) => Promise<unknown> }).compileAsync?.(mv, c.camera) } catch { /* compiled on first use */ }
  mv.visible = false
  apply()

  // ---- probes
  const info = () => ({
    mode: '3d', E: +sim.E.toFixed(3), cw: +cwOf().toFixed(5), beats: sim.beats, T: +sim.T.toFixed(3), A: +sim.A.toFixed(1), th: +sim.th.toFixed(1), fork: +sim.fork.toFixed(2),
    engaged: sim.engaged, pulled: sim.pulled, slow: sim.slow, exploded: sim.exploded, tilt: +ex.tilt.toFixed(3), loupe: sim.loupe, running: sim.running, held: sim.held,
    W: +sim.W.toFixed(1), hs: +sim.hs.toFixed(2), parts: picks.length, draws: c.renderer.info.render.calls, tris: c.renderer.info.render.triangles,
  })
  const handsDeg = () => ({ minute: (((90 - minH.rotation.z / D2R) % 360) + 360) % 360, hour: (((90 - hourH.rotation.z / D2R) % 360) + 360) % 360, second: (((90 - secH.rotation.z / D2R) % 360) + 360) % 360 })
  const angles = () => ({ t: performance.now(), hands: handsDeg(), balance: sim.th, escRel: sim.E, escAbs: -(sim.E) + (cage0 - 60 * cwOf()), cage: cage0 - 60 * cwOf(), third: 12 * cwOf(), centre: -cwOf(), barrel: cwOf() / 6, fork: sim.fork, beats: sim.beats, T: sim.T, A: sim.A })
  ;(window as unknown as { __mv3?: unknown }).__mv3 = {
    info, angles,
    sample: (ms = 2000) => new Promise(res => { const out: ReturnType<typeof angles>[] = []; const t0s = performance.now(); const f = () => { out.push(angles()); if (performance.now() - t0s < ms) requestAnimationFrame(f); else res(out) }; requestAnimationFrame(f) }),
    /** which part a pick at client (x, y) finds (look-dev / tests): the exact hit, then what a fingertip would take */
    hitAt: (x: number, y: number) => { tmpRay.setFromCamera(tNdc0.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), c.camera); const e = partAt(tmpRay), f = partNear(tmpRay, x, y, true); return [e?.part ?? null, f?.part ?? null] },
    partScreen: (id: string) => { const o = mv.getObjectByName(id); if (!o) return null; o.updateWorldMatrix(true, false); return screenOf(worldOf(o)) },
    pointScreen: (id: string, x: number, y: number, z: number) => { const o = mv.getObjectByName(id); if (!o) return null; return screenOf(worldOf(o, x, y, z)) },
    crownScreen: () => { const r = crownEl.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] },
    centreScreen: () => screenOf(worldOf(tilt)), radius: () => screenR,
    /** look-dev: turn the studio about x / y (radians, added to the camera-facing base) and scale one material's reflections */
    envRot: (x: number, y: number) => { for (const mm of [...matList, mainMat, hairMat]) (mm as THREE.MeshStandardMaterial).envMapRotation.set(x, Math.atan2(dirW.x, dirW.z) + y, 0) },
    /** look-dev: swap every material's environment between the shared procedural studio and the Poly Haven HDRI studio (async) */
    setEnv: async (name: 'shared' | 'hdri') => { const e = name === 'hdri' ? await studioEnv(c.renderer) : c.env; if (!e) return false; for (const mm of [...matList, mainMat, hairMat]) { (mm as THREE.MeshStandardMaterial).envMap = e; mm.needsUpdate = true } return true },
    matK: (k: string, v: number) => { const mm = (m as Record<string, THREE.Material>)[k] as THREE.MeshStandardMaterial | undefined; if (mm) mm.envMapIntensity = v },
    /** the stage's own cost: draw calls (one per mesh, one per material group of a multi-material mesh), triangles, materials, geometries */
    stats: () => {
      let tris = 0, meshes = 0, draws = 0
      mv.traverse(o => {
        const me = o as THREE.Mesh
        if (!me.isMesh || !me.geometry) return
        meshes++
        const g = me.geometry, n = g.index ? g.index.count : g.getAttribute('position').count, k = (me as THREE.InstancedMesh).isInstancedMesh ? (me as THREE.InstancedMesh).count : 1
        tris += (n / 3) * k
        draws += Array.isArray(me.material) ? Math.max(1, g.groups.filter(q => q.count > 0).length) : 1
      })
      return { meshes, draws, tris: Math.round(tris), materials: matList.length + 2 }
    },
  }

  function dispose() {
    window.clearInterval(watch); window.clearTimeout(crownTimer); window.removeEventListener('resize', onResize)
    window.removeEventListener('pointerdown', onPtr, true); window.removeEventListener('pointermove', onPtr, true)
    window.removeEventListener('touchstart', onTouchStart, true); window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd); window.removeEventListener('touchcancel', onTouchEnd)
    timer?.pause(); tl?.revert(); crownDrag?.revert(); coastAnim?.cancel(); labAnim?.cancel(); scope?.revert()
    setShown(false); setLoupe(false); tip.drop(); root.remove()
    document.documentElement.classList.remove('ann-quiet', 'mv3-loupe-on')
    c.root.remove(mv); c.scene.remove(lens)
    for (const g of geos) g.dispose()
    for (const mm of [...matList, mainMat, hairMat, hiMat, lensMat]) mm.dispose()
    for (const t of textures) t.dispose()
    rt.dispose()
    delete (window as unknown as { __mv3?: unknown }).__mv3
  }
  return handle
}

// a tooltip in the stage-tip style, accent = Systems vermilion. Its box is measured once per change of content (never on a pointer move). 'cursor' hangs it beside the
// pointer, 'above' over a fingertip. On a phone, and for a finger, it keeps clear of the controls and the note: it moves to whichever side of them is nearer.
type TipMode = 'cursor' | 'above'
let tipNode: HTMLDivElement | null = null
function tipEl(avoid: () => [number, number, number, number][]) {
  if (!tipNode) { tipNode = document.createElement('div'); tipNode.className = 'mv3-tip'; tipNode.setAttribute('data-proof', 'skip'); tipNode.setAttribute('aria-hidden', 'true'); document.body.append(tipNode) }
  const el = tipNode
  let w = 180, h = 50
  return {
    show(x: number, y: number, title: string, job?: string, sched?: string, mode: TipMode = 'cursor') {
      const k = title + '|' + (job ?? '') + '|' + (sched ?? '')
      if (el.dataset.k !== k) {
        el.dataset.k = k; el.innerHTML = '<b></b><span></span><i></i>'
        ;(el.children[0] as HTMLElement).textContent = title; (el.children[1] as HTMLElement).textContent = job ?? ''; (el.children[2] as HTMLElement).textContent = sched ?? ''
        const [b, s2, i] = el.children as unknown as HTMLElement[]
        s2.style.display = job ? '' : 'none'; i.style.display = sched ? '' : 'none'; void b
        w = el.offsetWidth || w; h = el.offsetHeight || h
      }
      const floor = innerWidth <= 760 ? innerHeight - 84 : innerHeight - 8
      const left = mode === 'above' ? x - w / 2 : x + 18, top = mode === 'above' ? y - h - 28 : y + 20
      const L = Math.round(Math.max(8, Math.min(innerWidth - w - 8, left)))
      let T = Math.round(Math.max(8, Math.min(floor - h, top)))
      if (mode === 'above' || innerWidth <= 760) {
        const GAP = 8, rs = avoid().filter(r => r[2] > 2 && r[3] > 2)
        for (let pass = 0; pass < 3; pass++) {
          const hit = rs.find(r => L < r[0] + r[2] + GAP && L + w > r[0] - GAP && T < r[1] + r[3] + GAP && T + h > r[1] - GAP)
          if (!hit) break
          const upT = hit[1] - GAP - h, down = hit[1] + hit[3] + GAP
          const okUp = upT >= 8, okDown = down + h <= floor
          T = okUp && (!okDown || Math.abs(upT - T) <= Math.abs(down - T)) ? upT : okDown ? down : Math.max(8, Math.min(floor - h, upT))
        }
      }
      el.style.transform = `translate(${L}px,${Math.round(T)}px)`
      el.classList.add('on')
    },
    hide() { el.classList.remove('on') },
    drop() { el.remove(); if (tipNode === el) tipNode = null },
  }
}
