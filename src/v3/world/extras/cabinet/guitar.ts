// STAGE "guitar": a spruce-and-rosewood body, neck and headstock, a rosewood bridge with a bone saddle, and SIX REAL STRINGS (thin tubes
// that vibrate as standing waves, the same modes and rates as the particle form). ONE guitar: the particle form (forms/guitar.ts) behind it is
// dimmed to a faint dust (dim 0.12; the cabinet manager's alpha arbiter) and stops listening for the pointer while this stage is present
// (window.__guitarMesh). W11: the instrument stands UPRIGHT on a stand (a tripod, a cradle under the tail, a neck rest) on the small stage riser of
// spaces/guitar.ts, leaning back a few degrees; the strings now run up the screen, so the pointer sweep crosses them sideways. The sweep lives here:
// the strings' end points are projected through the live camera, and a stroke that crosses one plucks it (audio/guitar.ts, Karplus-Strong) and shakes
// the tube. Invisible boxes over the strings and the body are the pick proxies (the cursor turns to a pointer, the tip appears). Reduced motion: still.
// v16 (the voice is now a commuted-waveguide steel string, see audio/guitar.ts): the sweep's speed sets the pluck velocity (slow 0.35, fast 0.95) and, when one
// pointer move crosses several strings, their spacing (28 ms slow .. 8 ms fast); the sweep's direction sets the pick direction (low to high = down-stroke).
// Each string's swing starts at an amplitude from that velocity and dies with ITS OWN T60 (6.5 s on E2 .. 3.5 s on E4, the numbers the audio uses), with a fast
// shimmer at a rate that scales with the string's pitch: the tube swells and glows a little while it rings, as a blurred string does. This is feedback for a
// direct manipulation (the visitor strokes the string, the string answers): motion that tells the hand it was heard. It runs per frame in JS because the shape
// is a standing wave of 44 vertices, not a CSS property; reduced motion keeps the strings still (the sound stays).
import * as THREE from 'three'
import type { FlightState } from '../../flight'
import { sharedEnv } from '../env'
import { bake, D, disposeTree, enter, precompile, type Kit } from './kit'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { WAYPOINTS } from '../../layout'
import type { Stage } from './stage'
import { pluck, strum as strumAudio, strumPlan, guitarWarm } from '../../../../audio/guitar'

// ---- the form's dimensions (forms/guitar.ts; 1 unit ~ 143 mm)
const BODY_L = 3.64, SADDLE_U = 1.3, SCALE = 4.5, NUT_U = SADDLE_U + SCALE, HEAD_END = NUT_U + 0.95
const HOLE_U = 2.5, HOLE_R = 0.36
const OUTLINE: [number, number][] = [[0, 0], [0.03, 0.4], [0.1, 0.7], [0.2, 0.93], [0.45, 1.22], [0.9, 1.34], [1.4, 1.22], [1.8, 1.02], [2.05, 0.97], [2.4, 1.03], [2.8, 1.02], [3.15, 0.86], [3.45, 0.52], [3.64, 0.22]]
const depthAt = (u: number) => 0.62 + 0.17 * (1 - u / BODY_L)
function hw(u: number): number {
  const n = OUTLINE.length
  if (u <= 0) return 0
  if (u >= OUTLINE[n - 1][0]) return OUTLINE[n - 1][1]
  let i = 0; while (OUTLINE[i + 1][0] < u) i++
  const p0 = OUTLINE[Math.max(0, i - 1)], p1 = OUTLINE[i], p2 = OUTLINE[i + 1], p3 = OUTLINE[Math.min(n - 1, i + 2)]
  const h = p2[0] - p1[0], t = (u - p1[0]) / h, t2 = t * t, t3 = t2 * t
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0])) * h, m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0])) * h
  return Math.max(0, (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2)
}
const fretU = (n: number) => NUT_U - SCALE * (1 - Math.pow(2, -n / 12))
const FRET_END = fretU(17)
const neckHW = (u: number) => 0.15 + 0.08 * Math.min(1, Math.max(0, (NUT_U - u) / (NUT_U - FRET_END)))
const headHW = (u: number) => 0.17 + 0.1 * Math.pow((u - NUT_U) / 0.95, 0.8)
// ---- strings: the same layout and vibration as the particle form
const N_STR = 6, SEG = 44, SIDES = 6
const saddleV = (i: number) => (i - 2.5) * 0.115, nutV = (i: number) => (i - 2.5) * 0.05
const strPt = (i: number, s: number): [number, number, number] => [SADDLE_U + SCALE * s, saddleV(i) + (nutV(i) - saddleV(i)) * s, 0.075 - 0.03 * s]
const F_VIS = [82.5, 110, 440 / 3, 196, 740 / 3, 330].map(f => (f / 82.5) * 1.5)
const AMP_MAX = 0.085
// how long each string rings (seconds to fall 60 dB: the numbers audio/guitar.ts uses) and the rate of its blur shimmer (Hz, scaled with pitch)
const T60 = [6.5, 5.9, 5.3, 4.7, 4.1, 3.5]
const DECAY = T60.map(t => 6.908 / t)
const SHIMMER = [82.5, 110, 440 / 3, 196, 740 / 3, 330].map(f => 9 * (f / 82.5))
const GUITAR_WP = WAYPOINTS.findIndex(w => w.id === 'guitar')
/** sweep speed (px/ms at a 900 px high window) -> pluck velocity: slow 0.35 .. fast 0.95 */
const velOf = (speed: number) => 0.35 + 0.6 * Math.min(1, Math.max(0, (speed * (900 / Math.max(300, innerHeight)) - 0.12) / 2.4))
const spacingOf = (speed: number) => 0.028 - 0.02 * Math.min(1, Math.max(0, (speed * (900 / Math.max(300, innerHeight)) - 0.12) / 2.4))
const STR_R = [0.0105, 0.0095, 0.0085, 0.0075, 0.0068, 0.0062]
// the stand: the stage root carries the waypoint's scale (layout place.scale); the riser of the space (spaces/guitar.ts RISER.h) is 0.36 world units high
const ROOT_S = (WAYPOINTS.find(w => w.id === 'guitar')?.place.scale ?? 1)
const RISER_TOP = 0.36 / ROOT_S                          // stage-local height of the riser's top
const Y_BODY = RISER_TOP + 0.5                            // where the tail of the body sits (stage-local)
const TOP_WORLD = 3.85                                    // world height of the top of the headstock above the floor
const K_UP = (TOP_WORLD / ROOT_S - Y_BODY) / HEAD_END     // instrument units -> stage-local units (the body is ~1.2 world units wide)
const LEAN = -0.085                                       // rad: the neck leans back against the stand

const TOP_FRAG = /* glsl */ `
uniform vec2 uO[14];
float hwA(float u) { if (u <= uO[0].x) return 0.0; for (int i = 0; i < 13; i++) { if (u < uO[i + 1].x) { float t = (u - uO[i].x) / (uO[i + 1].x - uO[i].x); t = t * t * (3.0 - 2.0 * t); return mix(uO[i].y, uO[i + 1].y, t); } } return uO[13].y; }
void main() {
  float u = vUv.x * ${BODY_L.toFixed(3)}, v = (vUv.y - 0.5) * 2.72;
  vec2 p = vec2(u, v);
  float hw = hwA(u), edge = hw - abs(v);                   // distance inside the outline (across)
  // spruce: grain runs along the neck (u); two bookmatched halves; a warm sunburst darkens toward the rim
  float g = fbm3(vec2(u * 0.9, abs(v) * 70.0)), g2 = fbm(vec2(u * 2.0, abs(v) * 9.0));
  vec3 col = mix(vec3(0.86, 0.69, 0.42), vec3(0.95, 0.8, 0.52), g * 0.9 + g2 * 0.3);
  col *= 0.92 + 0.14 * sin(abs(v) * 160.0 + g * 5.0);
  float burst = smoothstep(0.55, 0.0, edge);
  col = mix(col, vec3(0.42, 0.2, 0.06), burst * 0.75);
  // binding (cream) with a black-white purfling line inside it
  float bind = 1.0 - smoothstep(0.036, 0.04, edge);
  float purf = (1.0 - smoothstep(0.0, 0.006, abs(edge - 0.062))) * 0.8;
  col = mix(col, vec3(0.95, 0.9, 0.76), bind);
  col = mix(col, vec3(0.1, 0.07, 0.05), purf);
  // rosette round the sound hole
  float rr = length(p - vec2(${HOLE_U.toFixed(3)}, 0.0));
  float ring1 = 1.0 - smoothstep(0.0, 0.006, abs(rr - 0.385)), ring2 = 1.0 - smoothstep(0.0, 0.005, abs(rr - 0.47)), ring3 = 1.0 - smoothstep(0.0, 0.005, abs(rr - 0.43));
  float ang = atan(p.y, p.x - ${HOLE_U.toFixed(3)}), chk = step(0.5, fract(ang * 7.6394)) , band = smoothstep(0.396, 0.4, rr) * (1.0 - smoothstep(0.418, 0.422, rr));
  col = mix(col, vec3(0.15, 0.09, 0.05), max(ring1, ring2) * 0.9);
  col = mix(col, vec3(0.93, 0.9, 0.84), ring3 * 0.8);
  col = mix(col, mix(vec3(0.1, 0.07, 0.05), vec3(0.93, 0.9, 0.84), chk), band);
  // the hole itself: dark, with a soft inner edge
  float hole = 1.0 - smoothstep(${(HOLE_R - 0.012).toFixed(3)}, ${(HOLE_R + 0.004).toFixed(3)}, rr);
  col = mix(col, vec3(0.012, 0.008, 0.006), hole);
  // bridge: rosewood with a bone saddle and six pins
  vec2 b = abs(p - vec2(${SADDLE_U.toFixed(3)} + 0.01, 0.0));
  float br = 1.0 - smoothstep(0.0, 0.01, max(b.x - 0.17, b.y - (0.62 - 0.2 * pow(b.x / 0.17, 2.0))));
  vec3 rose = vec3(0.2, 0.09, 0.06) * (0.85 + 0.3 * fbm3(p * vec2(30.0, 6.0)));
  col = mix(col, rose, br);
  float saddle = (1.0 - smoothstep(0.0, 0.006, abs(u - ${SADDLE_U.toFixed(3)}) - 0.012)) * step(abs(v), 0.46) * br;
  col = mix(col, vec3(0.93, 0.9, 0.82), saddle);
  for (int i = 0; i < 6; i++) { float pv = (float(i) - 2.5) * 0.115; float d = length(p - vec2(${(SADDLE_U - 0.1).toFixed(3)}, pv)); col = mix(col, vec3(0.92, 0.9, 0.84), (1.0 - smoothstep(0.016, 0.02, d)) * br); }
  // a fine scuff and a pickguard-free finish gloss variation
  col *= 0.97 + 0.05 * h21(floor(p * 300.0));
  gl_FragColor = vec4(col, 1.0);
}`

interface Str { mesh: THREE.Mesh; pos: THREE.BufferAttribute; t0: number; amp: number; pp: number; live: boolean; mat: THREE.MeshStandardMaterial; env: number }

export function createGuitar(): Stage {
  const root = new THREE.Group(); root.name = 'cab-guitar'
  let kit: Kit, built = false
  let g: THREE.Group, inst: THREE.Group
  const strs: Str[] = []
  const pickBoxes: THREE.Object3D[] = []
  const seg = Array.from({ length: N_STR }, () => ({ ax: 0, ay: 0, bx: 0, by: 0 }))
  let clock = 0, hov = 0, hovered = false, armed = false, plucks = 0, arrived = false, present = 0, lastVel = 0, lastDir = 1
  let last: { x: number; y: number; t: number } | null = null
  const cool = new Array(N_STR).fill(0)
  const pv = new THREE.Vector3()

  /** pull string i: a = 0..1 of the maximum swing, p = where along it (0 saddle .. 1 nut) it is plucked, delay in seconds */
  function vibrate(i: number, a: number, p: number, delay = 0) {
    const s = strs[i]; if (!s) return
    s.t0 = clock + delay; s.amp = kit.reduced() ? 0 : AMP_MAX * Math.min(1, Math.max(0.15, a)); s.pp = Math.min(0.85, Math.max(0.15, p)); s.live = true
  }
  function shape(s: Str, i: number) {
    const tt = clock - s.t0, a = s.pos.array as Float32Array
    // the string's own decay: the fundamental falls 60 dB in T60[i]; the upper modes die faster, as the audio's loop filter makes them
    const ringing = tt > 0 && tt < T60[i] * 0.62 && s.amp > 0
    const fall = ringing ? Math.exp(-tt * DECAY[i]) : 0
    s.env = ringing ? (s.amp / AMP_MAX) * fall : 0
    const rr = STR_R[i] * (1 + 1.3 * s.env)                                   // the blur: the tube swells while it rings
    const shim = ringing ? s.amp * 0.3 * Math.exp(-tt * DECAY[i] * 1.5) * Math.sin(6.28318 * SHIMMER[i] * tt + i * 1.3) : 0
    for (let k = 0; k <= SEG; k++) {
      const u = k / SEG
      const b = strPt(i, u)
      let disp = 0.003 * Math.sin(clock * 1.3 + i * 1.7) * Math.sin(Math.PI * u)
      if (ringing) {
        for (let n = 1; n <= 4; n++) {
          const om = 6.28318 * F_VIS[i] * n * (1 + 0.0007 * n * n)
          disp += s.amp * (Math.sin(n * Math.PI * s.pp) / (n * n)) * Math.sin(n * Math.PI * u) * Math.cos(om * tt) * Math.exp(-tt * DECAY[i] * (1 + 0.7 * (n - 1)))
        }
        disp += shim * Math.sin(Math.PI * u)
      }
      for (let j = 0; j < SIDES; j++) {
        const th = (j / SIDES) * Math.PI * 2, o = (k * SIDES + j) * 3
        a[o] = b[0]; a[o + 1] = b[1] + disp + Math.sin(th) * rr; a[o + 2] = b[2] + 0.5 * disp + Math.cos(th) * rr
      }
    }
    s.pos.needsUpdate = true
    if (tt >= T60[i] * 0.62 || (tt > 0 && s.amp === 0)) { s.live = false; s.env = 0 }
  }
  const proj = (x: number, y: number, z: number): [number, number] => {
    pv.set(x, y, z); g.localToWorld(pv); pv.project(kit.camera)
    return [(pv.x * 0.5 + 0.5) * innerWidth, (-pv.y * 0.5 + 0.5) * innerHeight]
  }
  function hit(px: number, py: number, qx: number, qy: number, s: { ax: number; ay: number; bx: number; by: number }): number {
    const rx = qx - px, ry = qy - py, sx = s.bx - s.ax, sy = s.by - s.ay, den = rx * sy - ry * sx
    if (Math.abs(den) < 1e-6) return -1
    const t = ((s.ax - px) * sy - (s.ay - py) * sx) / den, u = ((s.ax - px) * ry - (s.ay - py) * rx) / den
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? u : -1
  }
  /** how far along the pointer's move (0..1) it meets string segment s */
  function tAlong(px: number, py: number, qx: number, qy: number, s: { ax: number; ay: number; bx: number; by: number }): number {
    const rx = qx - px, ry = qy - py, sx = s.bx - s.ax, sy = s.by - s.ay, den = rx * sy - ry * sx
    return Math.abs(den) < 1e-6 ? 0 : ((s.ax - px) * sy - (s.ay - py) * sx) / den
  }
  function onMove(e: PointerEvent) {
    if (e.pointerType === 'touch' && !armed) { last = { x: e.clientX, y: e.clientY, t: performance.now() }; return }
    const now = performance.now()
    if (armed && last && now - last.t < 300) {
      const dx = e.clientX - last.x, dy = e.clientY - last.y, speed = Math.hypot(dx, dy) / Math.max(1, now - last.t)
      // every string this move crosses, in the order the pointer meets them
      const cross: { i: number; u: number; t: number }[] = []
      for (let i = 0; i < N_STR; i++) {
        if (now < cool[i]) continue
        const u = hit(last.x, last.y, e.clientX, e.clientY, seg[i])
        if (u >= 0) cross.push({ i, u, t: tAlong(last.x, last.y, e.clientX, e.clientY, seg[i]) })
      }
      cross.sort((p, q) => p.t - q.t)
      // moving toward the higher strings (E2 -> E4) is a down-stroke, the other way an up-stroke
      const toward = Math.sign((seg[5].ax + seg[5].bx) - (seg[0].ax + seg[0].bx)) * Math.sign(dx)
      const dir: 1 | -1 = toward >= 0 ? 1 : -1
      const v0 = velOf(speed), sp = spacingOf(speed)
      let delay = 0
      cross.forEach((c, rank) => {
        cool[c.i] = now + 110
        const vel = Math.max(0.1, v0 * (1 - 0.12 * (cross.length > 1 ? rank / (cross.length - 1) : 0)))
        if (rank) delay += Math.min(0.03, Math.max(0.008, sp + (Math.random() * 2 - 1) * 0.002))      // the strum's own spacing: 8 ms fast .. 28 ms slow, every gap inside 8..30 ms
        vibrate(c.i, vel, c.u, delay); pluck(c.i, vel, { dir, delay }); plucks++
        lastVel = vel; lastDir = dir
      })
    }
    last = { x: e.clientX, y: e.clientY, t: now }
  }
  const cancel = () => { last = null }

  /** a folding stand: a tripod round a post behind the instrument, a padded cradle under the tail, a neck rest higher up */
  function buildStand(env: THREE.Texture): THREE.Group {
    const st = new THREE.Group(); st.name = 'stand'
    const tube = new THREE.MeshStandardMaterial({ color: D(0.05, 0.05, 0.056), metalness: 0.8, roughness: 0.38, envMap: env, envMapIntensity: 1.2 })
    const rubber = new THREE.MeshStandardMaterial({ color: D(0.02, 0.02, 0.02), roughness: 0.85 })
    const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, m = tube) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 10), m)
      mesh.position.copy(a).add(b).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return mesh
    }
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    const PZ = -0.3, hub = V(0, RISER_TOP + 0.13, PZ)
    const topY = Y_BODY + 4.0 * K_UP + 0.1
    st.add(rod(hub, V(0, topY, PZ), 0.016))
    for (const [x, z] of [[0, 0.42], [-0.54, -0.64], [0.54, -0.64]]) {
      st.add(rod(hub, V(x, RISER_TOP + 0.012, z), 0.013))
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), rubber); foot.scale.y = 0.6; foot.position.set(x, RISER_TOP + 0.014, z); st.add(foot)
    }
    // the cradle: a rod forward to under the tail, a padded bar across, two prongs up the lower bout
    const cy = Y_BODY - 0.04
    st.add(rod(V(0, cy, PZ), V(0, cy, -0.06), 0.014))
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.09), rubber); bar.position.set(0, cy + 0.025, -0.06); st.add(bar)
    for (const x of [-0.19, 0.19]) { const pr = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.26, 10), rubber); pr.position.set(x, cy + 0.15, -0.1); st.add(pr) }
    // the neck rest: a rod forward at the neck's height, a small U of rubber round the neck
    const ny = Y_BODY + 3.6 * K_UP
    st.add(rod(V(0, ny, PZ), V(0, ny, -0.04), 0.012))
    for (const x of [-0.045, 0.045]) { const pr = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.12, 8), rubber); pr.position.set(x, ny + 0.05, -0.02); st.add(pr) }
    return st
  }

  /** a gentle strum, low to high (audible only when the site's sound is on: the sound engine gates it). The string timing is the audio's own plan. */
  function strum(vel = 0.62) {
    const speed = 0.35
    for (const p of strumPlan(vel, 1, speed)) vibrate(p.string, p.v * (0.9 + 0.03 * p.string), 0.3 + 0.04 * p.string, p.dt)
    strumAudio(vel, 1, speed)
    plucks++
  }

  async function build(k: Kit) {
    kit = k
    const env = sharedEnv(k.renderer)
    const uO = OUTLINE.map(([a, b]) => new THREE.Vector2(a, b))
    const top = bake(k.renderer, 1024, 512, TOP_FRAG, { uO: { value: uO } })
    const ribs = bake(k.renderer, 512, 128, `void main() { vec2 q = vec2(vUv.x * 6.0, vUv.y * 0.8); vec3 c = wood(q, vec3(0.3, 0.14, 0.07), vec3(0.52, 0.25, 0.12), 8.0, 5.0); gl_FragColor = vec4(c, 1.0); }`)
    const maple = bake(k.renderer, 512, 128, `void main() { vec2 q = vec2(vUv.x * 5.0, vUv.y * 0.6); vec3 c = wood(q, vec3(0.7, 0.52, 0.31), vec3(0.86, 0.68, 0.43), 10.0, 2.0); gl_FragColor = vec4(c, 1.0); }`)
    const topMat = new THREE.MeshPhysicalMaterial({ map: top.texture, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMap: env, envMapIntensity: 1.4 })
    const ribMat = new THREE.MeshPhysicalMaterial({ map: ribs.texture, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15, envMap: env, envMapIntensity: 1.3 })
    const mapleMat = new THREE.MeshPhysicalMaterial({ map: maple.texture, roughness: 0.4, clearcoat: 0.5, envMap: env, envMapIntensity: 1.2 })
    const fretboardMat = new THREE.MeshPhysicalMaterial({ color: D(0.12, 0.065, 0.045), roughness: 0.4, clearcoat: 0.4, envMap: env, envMapIntensity: 1.1 })
    const chrome = new THREE.MeshStandardMaterial({ color: D(0.9, 0.9, 0.92), metalness: 1, roughness: 0.2, envMap: env, envMapIntensity: 2.0 })
    const bone = new THREE.MeshStandardMaterial({ color: D(0.93, 0.9, 0.82), roughness: 0.4, envMap: env, envMapIntensity: 1.0 })
    g = new THREE.Group()
    g.rotation.z = Math.PI / 2; g.scale.setScalar(K_UP)                  // body length u runs UP the screen, the face (+z) toward the camera
    // ---- body: the outline extruded back from the soundboard, tapering in depth toward the neck
    const sh = new THREE.Shape()
    const pts: [number, number][] = []
    for (let u = 0; u <= BODY_L + 1e-6; u += 0.04) pts.push([u, hw(Math.min(u, BODY_L))])
    sh.moveTo(0, 0); for (const [u, v] of pts) sh.lineTo(u, v); for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(pts[i][0], -pts[i][1]); sh.closePath()
    const BT = 0.035, D0 = 0.78
    const eg = new THREE.ExtrudeGeometry(sh, { depth: D0, bevelEnabled: true, bevelThickness: BT, bevelSize: BT, bevelOffset: -BT, bevelSegments: 3, curveSegments: 1 })
    eg.translate(0, 0, -(D0 + BT) - 0.012)
    const P = eg.getAttribute('position'), uv = eg.getAttribute('uv')
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i)
      if (z < -0.1) P.setZ(i, -0.012 - (-0.012 - z) * (depthAt(x) / D0))
      uv.setXY(i, x / BODY_L, y / 2.72 + 0.5)
    }
    const body = new THREE.Mesh(toCreasedNormals(eg, 0.6), [topMat, ribMat])
    g.add(body)
    // ---- neck: a maple core under a rosewood fretboard, frets, inlays, nut
    const strip = (u0: number, u1: number, w0: number, w1: number, depth: number, z0: number, mat: THREE.Material) => {
      const s = new THREE.Shape(); s.moveTo(u0, -w0); s.lineTo(u1, -w1); s.lineTo(u1, w1); s.lineTo(u0, w0); s.closePath()
      const e = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); e.translate(0, 0, z0)
      return new THREE.Mesh(e, mat)
    }
    g.add(strip(BODY_L - 0.6, NUT_U, neckHW(BODY_L - 0.6) * 0.92, neckHW(NUT_U) * 0.92, 0.16, -0.17, mapleMat))
    g.add(strip(FRET_END - 0.05, NUT_U, neckHW(FRET_END - 0.05), neckHW(NUT_U), 0.03, -0.0, fretboardMat))
    for (let f = 1; f <= 17; f++) { const u = fretU(f), m = new THREE.Mesh(new THREE.BoxGeometry(0.014, neckHW(u) * 2, 0.014), chrome); m.position.set(u, 0, 0.034); g.add(m) }
    for (const f of [3, 5, 7, 9, 15, 17, 12]) {
      const u = (fretU(f) + fretU(f - 1)) / 2, offs = f === 12 ? [-0.06, 0.06] : [0]
      for (const o of offs) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.027, 18), bone); m.position.set(u, o, 0.0315); g.add(m) }
    }
    const nut = new THREE.Mesh(new THREE.BoxGeometry(0.05, neckHW(NUT_U) * 2, 0.05), bone); nut.position.set(NUT_U, 0, 0.03); g.add(nut)
    // ---- headstock: a dark veneer plate, six chrome posts and buttons
    const head = new THREE.Shape(); const hp: [number, number][] = []
    for (let u = NUT_U; u <= HEAD_END; u += 0.05) hp.push([u, headHW(u)])
    head.moveTo(NUT_U, -hp[0][1]); for (const [u, v] of hp) head.lineTo(u, v); for (let i = hp.length - 1; i >= 0; i--) head.lineTo(hp[i][0], -hp[i][1]); head.closePath()
    const hg = new THREE.ExtrudeGeometry(head, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelOffset: -0.012, bevelSegments: 2, curveSegments: 1 }); hg.translate(0, 0, -0.045)
    g.add(new THREE.Mesh(toCreasedNormals(hg, 0.6), [fretboardMat, mapleMat]))
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? 1 : -1, row = i < 3 ? i : 5 - i, pu = NUT_U + 0.22 + row * 0.25, pv = side * 0.115
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.07, 14), chrome); post.rotation.x = Math.PI / 2; post.position.set(pu, pv, 0.03); g.add(post)
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, headHW(pu) + 0.1, 8), chrome); stem.rotation.x = 0; stem.position.set(pu, side * (headHW(pu) / 2 + 0.04), -0.045)
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.025, 20), bone); btn.rotation.x = Math.PI / 2; btn.position.set(pu, side * (headHW(pu) + 0.1), -0.045)
      g.add(stem, btn)
    }
    // ---- bridge (rosewood) with a bone saddle, and the six strings
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 0.06), new THREE.MeshStandardMaterial({ color: D(0.2, 0.09, 0.06), roughness: 0.4, envMap: env, envMapIntensity: 1.1 }))
    bridge.position.set(SADDLE_U + 0.01, 0, 0.03); g.add(bridge)
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.95, 0.02), bone); saddle.position.set(SADDLE_U, 0, 0.066); g.add(saddle)
    const idx: number[] = []
    for (let k = 0; k < SEG; k++) for (let j = 0; j < SIDES; j++) {
      const a = k * SIDES + j, b = k * SIDES + (j + 1) % SIDES, c = a + SIDES, d = b + SIDES
      idx.push(a, c, b, b, c, d)
    }
    for (let i = 0; i < N_STR; i++) {
      const wound = i < 3
      const mat = new THREE.MeshStandardMaterial({ color: wound ? D(0.86, 0.64, 0.36) : D(0.88, 0.92, 0.97), metalness: 1, roughness: wound ? 0.38 : 0.18, envMap: env, envMapIntensity: 2.2, emissive: new THREE.Color(0, 0, 0) })
      const geo = new THREE.BufferGeometry()
      const P = new THREE.BufferAttribute(new Float32Array((SEG + 1) * SIDES * 3), 3), Nn = new Float32Array((SEG + 1) * SIDES * 3)
      for (let k = 0; k <= SEG; k++) for (let j = 0; j < SIDES; j++) { const th = (j / SIDES) * Math.PI * 2, o = (k * SIDES + j) * 3; Nn[o] = 0; Nn[o + 1] = Math.sin(th); Nn[o + 2] = Math.cos(th) }
      geo.setAttribute('position', P); geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); geo.setIndex(idx)
      const m = new THREE.Mesh(geo, mat); m.frustumCulled = false
      g.add(m)
      const st: Str = { mesh: m, pos: P, t0: -99, amp: 0, pp: 0.5, live: false, mat, env: 0 }
      strs.push(st); shape(st, i)
    }
    // the pick proxies (so the cursor says "play me"), invisible: a wide box over the strings and one over the soundboard
    const invisible = new THREE.MeshBasicMaterial({ visible: false })
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(NUT_U - SADDLE_U + 0.1, 2.0, 0.5), invisible)
    proxy.position.set((SADDLE_U + NUT_U) / 2, 0, 0.05); g.add(proxy); pickBoxes.push(proxy)
    const bodyProxy = new THREE.Mesh(new THREE.BoxGeometry(BODY_L, 2.8, 0.5), invisible)
    bodyProxy.position.set(BODY_L / 2, 0, -0.1); g.add(bodyProxy); pickBoxes.push(bodyProxy)
    window.addEventListener('pointermove', onMove, { passive: true })
    for (const ev of ['pointerdown', 'pointercancel']) window.addEventListener(ev, cancel, { passive: true })
    // the instrument leans back a few degrees on its stand; its tail sits Y_BODY above the floor
    inst = new THREE.Group(); inst.position.set(0, Y_BODY, 0); inst.rotation.x = LEAN; inst.add(g); root.add(inst)
    root.add(buildStand(env))
    precompile(k, root)
    built = true
  }

  function update(time: number, dt: number, r: number, _dwell: boolean, st: FlightState) {
    if (!built) return
    // the audio pre-renders its pluck buffers only once the visitor is within 2 stops of the guitar (never at boot); it waits for the sound to be on
    if (Math.abs((st.dwelling ? st.wp : st.wp + st.t) - GUITAR_WP) <= 2) guitarWarm()
    const rm = kit.reduced()
    clock = time; present = r
    ;(window as unknown as { __guitarMesh?: boolean }).__guitarMesh = r > 0.5
    if (r <= 0.0005) { root.visible = false; armed = false; arrived = false; return }
    root.visible = true
    enter(root, r, rm, 2.2)
    // a tall thin instrument is small in a portrait window (the camera pulls back): grow it up to 45%, keeping the stand's feet on the riser
    const asp = innerWidth / Math.max(1, innerHeight), boost = 1 + 0.45 * Math.min(1, Math.max(0, (1.05 - asp) / 0.45))
    if (boost > 1.001) { root.scale.multiplyScalar(boost); root.position.y += 0.36 * (1 - boost) }
    // the strings: the sweep listens only once the instrument has settled (the manager's own hover gate is r >= 0.97)
    armed = r >= 0.9
    if (armed && !arrived) { arrived = true; for (let i = 0; i < N_STR; i++) vibrate(i, 0.5 * (0.85 + 0.03 * i), 0.3 + 0.04 * i, i * 0.045) }
    if (r < 0.5) arrived = false
    for (let i = 0; i < N_STR; i++) if (strs[i].live) shape(strs[i], i)
    hov += ((hovered ? 1 : 0) - hov) * Math.min(1, dt * 10)
    for (const s of strs) s.mat.emissive.setRGB(0.22 * hov + 0.5 * s.env, 0.16 * hov + 0.34 * s.env, 0.08 * hov + 0.14 * s.env)
    if (armed) {
      root.updateWorldMatrix(true, true)
      for (let i = 0; i < N_STR; i++) {
        const [ax, ay] = proj(...strPt(i, 0)), [bx, by] = proj(...strPt(i, 1))
        const q = seg[i]; q.ax = ax; q.ay = ay; q.bx = bx; q.by = by
      }
    }
  }

  return {
    id: 'guitar', root, dim: 0.004, build, update, pick: pickBoxes,
    hover(o) { hovered = !!o },
    act(name) { if (name !== 'pluck') return ''; strum(); return 'The strings are ringing.' },
    demo() { vibrate(3, 0.5, 0.4); pluck(3, 0.42) },
    api: { get plucks() { return plucks }, get segs() { return seg }, get armed() { return armed }, get present() { return present }, get lastVel() { return lastVel }, get lastDir() { return lastDir }, vibrate },
    dispose() { window.removeEventListener('pointermove', onMove); for (const ev of ['pointerdown', 'pointercancel']) window.removeEventListener(ev, cancel); (window as unknown as { __guitarMesh?: boolean }).__guitarMesh = false; disposeTree(root) },
  }
}
