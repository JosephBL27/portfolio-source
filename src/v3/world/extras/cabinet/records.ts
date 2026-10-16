// STAGE "records": a turntable. Walnut plinth, a machined platter with strobe dots on its edge, a black vinyl whose grooves catch light as two
// wedge-shaped highlights (an anisotropic sheen: grooves are circles, so the highlight is perpendicular to them), a label that glows, and a
// tonearm that DROPS on arrival: the platter spins up, the arm swings out over the lead-in, hovers, and lowers onto the groove with a small bounce,
// then creeps inward while the record plays. Leave and the arm lifts and parks. Press the deck (or the arm) to lift / drop the needle.
// A big cover sleeve leans behind the deck (abstract art, no type). Reduced motion: the arm down on the record, nothing turning.
// REAL MUSIC (unit 9D): src/data/music.json lists Joseph's picks (resolved at build time to 30 s iTunes previews, scripts/resolve-music.mjs). The crate
// (ui/crate.ts) drags a sleeve onto the platter: the sleeve swings back to lean behind the deck, the vinyl drops onto the spindle, the platter spins up,
// the arm lands and the preview plays (audio/turntable.ts). Lifting the arm (press the deck or the arm, or the crate button) stops it. With no picks
// the deck keeps its house record. Dev only: ?musicFixture=1 loads lab/music-fixture.json.
import * as THREE from 'three'
import type { FlightState } from '../../flight'
import { sharedEnv } from '../env'
import { loadGLB, meshesByName, withAO } from '../../glbmodel'
import { bake, canvasTex, D, damp, disposeTree, easeInOut, enter, lerp, sstep, Spring, precompile, type Kit } from './kit'
import { sfx } from '../../../../audio/sfx'
import { turntable, type Track } from '../../../../audio/turntable'
import { mountCrate, type Crate, type CrateState } from '../../../ui/crate'
import music from '../../../../data/music.json'
import { halo, pedestal } from './props'
import { createDeckViz, type DeckViz } from '../musicviz/deckviz'
import { MUSIC } from '../musicviz/bus'
import type { Stage } from './stage'

const TAU = Math.PI * 2
const PLINTH = { w: 5.2, h: 0.5, d: 4.1 }
const C = new THREE.Vector2(-0.55, 0.12)              // platter centre (x, z)
const P = new THREE.Vector2(1.85, -1.3)               // tonearm pivot (x, z)
const Y_PLATTER = 0.5 + 0.06, Y_REC = Y_PLATTER + 0.2   // top of the platter, top of the record
const REC_R = 1.46, LABEL_R = 0.5
const ARM_Y = Y_REC + 0.3, ARM_L = 2.92
/** arm yaw (rad, direction from the pivot, measured from +x toward +z) that puts the stylus on groove radius rho */
function yawFor(rho: number): number {
  const base = Math.atan2(C.y - P.y, C.x - P.x)
  let lo = base - 0.9, hi = base + 0.9
  // rho(alpha) is monotone over this window: bisect
  const f = (a: number) => Math.hypot(P.x + ARM_L * Math.cos(a) - C.x, P.y + ARM_L * Math.sin(a) - C.y)
  const incr = f(hi) > f(lo)
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if ((f(m) < rho) === incr) lo = m; else hi = m }
  return (lo + hi) / 2
}
const REST_YAW = (() => { const a = yawFor(REC_R + 0.1); return a })()
const YAW_OUT = yawFor(1.42), YAW_IN = yawFor(0.62)
const PARK = YAW_OUT - 0.36                              // beyond the record's edge: where the arm rests

const VINYL_VERT = /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`
const VINYL_FRAG = /* glsl */ `
precision highp float;
varying vec3 vW; uniform vec3 uC; uniform float uTime, uLive;
uniform sampler2D uArt; uniform float uKal, uKaleid, uRot, uRingR, uRingA, uLvl, uBass; uniform vec3 uPA, uPB;   // 15M: the show on the grooves
float band(float r, float a, float b) { return smoothstep(a - 0.004, a, r) * (1.0 - smoothstep(b, b + 0.004, r)); }
vec3 aniso(vec3 T, vec3 V, vec3 L, float shin, vec3 col) { vec3 H = normalize(L + V); float th = dot(T, H); return col * pow(sqrt(max(0.0, 1.0 - th * th)), shin); }
void main() {
  vec3 Vv = cameraPosition - vW; vec3 V = normalize(Vv);
  vec2 d = vW.xz - uC.xz; float r = length(d);
  vec3 radial = normalize(vec3(d.x, 0.0, d.y) + vec3(1e-5)); vec3 T = vec3(-radial.z, 0.0, radial.x);
  // grooves: a fine ring texture that fades to its mean when a ring is smaller than a pixel
  float fw = fwidth(r) * 1800.0; float gAmp = 1.0 - smoothstep(0.35, 1.2, fw);
  float g = 0.5 + 0.5 * cos(r * 1800.0 + sin(r * 37.0) * 3.0);
  // track gaps: smooth, glossier bands between the songs, lead-in and run-out
  float gap = band(r, 1.385, 1.43) + band(r, 1.255, 1.275) + band(r, 1.07, 1.09) + band(r, 0.9, 0.915) + band(r, 0.735, 0.755) + band(r, 0.57, 0.62);
  vec3 col = vec3(0.012, 0.012, 0.014) * (0.9 + 0.1 * g * gAmp);
  float sheen = mix(0.8 + 0.4 * g * gAmp, 1.45, clamp(gap, 0.0, 1.0));
  col += aniso(T, V, normalize(vec3(-0.55, 0.78, 0.5)), 70.0, vec3(1.0, 0.86, 0.66) * 0.55) * sheen;
  col += aniso(T, V, normalize(vec3(0.7, 0.5, -0.45)), 90.0, vec3(0.62, 0.74, 1.0) * 0.36) * sheen;
  col += aniso(T, V, normalize(vec3(0.0, 1.0, 0.25)), 40.0, vec3(1.0, 0.96, 0.9) * 0.12) * sheen;
  // a very light rainbow where the grooves diffract
  float th = dot(T, normalize(normalize(vec3(-0.55, 0.78, 0.5)) + V));
  col += (0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + th * 9.0 + r * 5.0)) * 0.012 * pow(1.0 - abs(th), 3.0);
  // the polished rim catches light
  col += vec3(0.55, 0.5, 0.45) * smoothstep(1.43, 1.46, r) * 0.22;
  // 15M: a kaleidoscope of the sleeve, folded into mirror segments that turn with the record; it lives in the grooves' highlight (strongest in the wedge the light
  // makes) and faintly everywhere, a ring runs out from the label on every kick, and the rim glows with the level
  float rim = smoothstep(0.52, 0.62, r) * (1.0 - smoothstep(1.38, 1.46, r));
  if (uKaleid > 0.002) {
    float seg = 6.2831853 / uKal, a = mod(atan(d.y, d.x) - uRot, seg); a = abs(a - 0.5 * seg) + uRot * 0.17 + uTime * 0.05;
    float rr = clamp((r - 0.5) / 0.96, 0.0, 1.0); float zr = (0.05 + 0.42 * rr) * (1.0 - 0.12 * uBass);
    vec3 art = texture2D(uArt, 0.5 + vec2(cos(a), sin(a)) * zr).rgb;
    float wedge = pow(sqrt(max(0.0, 1.0 - th * th)), 26.0);
    col += art * (0.2 + 1.0 * wedge + 0.45 * uBass) * (0.78 + 0.22 * g * gAmp) * rim * uKaleid * 0.72;
    float ring = exp(-pow((r - uRingR) / 0.05, 2.0)) * uRingA;
    col += mix(uPA, uPB, 0.55) * ring * 1.0 * rim * uKaleid;
    col += uPB * uLvl * smoothstep(1.39, 1.46, r) * 0.55 * uKaleid;
  }
  gl_FragColor = vec4(col, 1.0);
}`

export function createRecords(): Stage {
  const root = new THREE.Group(); root.name = 'cab-records'; root.userData.contactShadow = { size: 4, opacity: 0.55 }
  const pick: THREE.Object3D[] = []
  let kit: Kit, built = false
  let disc: THREE.Group, platter: THREE.Object3D, arm: THREE.Group, armLift: THREE.Group, led: THREE.Mesh, labelMat: THREE.MeshBasicMaterial, vinylMat: THREE.ShaderMaterial
  let viz: DeckViz
  let needleGlow: THREE.Mesh, needleRing: THREE.Mesh, labelHalo: THREE.Mesh
  const lift = new Spring(1, 140, 13)
  let yaw = PARK, omega = 0, tauPlay = 0, playing = true, wasDown = false, spinAng = 0, needleT = -9, wasPresent = false
  // ---- the visitor's record (user mode): phase 'sleeve' (sleeve swings back) -> 'drop' (vinyl lands) -> 'ready' (spin up, arm, audio)
  let picks: Track[] = [], crate: Crate | null = null, userMode = false, curIdx = -1, phase: 'house' | 'sleeve' | 'drop' | 'ready' = 'house', phaseT = 0
  let sleeve: THREE.Mesh, sleeveMat: THREE.MeshStandardMaterial, coverMat: THREE.MeshStandardMaterial, coverTex0: THREE.Texture | null = null, coverArt: THREE.Texture | null = null
  let labelHouse: THREE.Texture, labelUser: THREE.CanvasTexture, labelCv: HTMLCanvasElement
  let audioOn = false, ended = false, lastState: CrateState | '' = '', lastProg = -1, discDrop = 0, discDropV = 0, msgT = 0
  // sound the visitor switched off THEMSELVES this session (a page that merely never had sound on is not "off": PUT IT ON turns it on): watched, since sfx.ts has no event for it
  let explicitOff = false, soundWas = sfx.enabled, needleSounded = false, watch = 0
  const dropSpring = new Spring(0, 160, 11)
  const SLEEVE_FROM = new THREE.Vector3(C.x, Y_REC + 1.0, C.y), SLEEVE_TO = new THREE.Vector3(-0.9, 1.5, -2.62)

  async function build(k: Kit) {
    kit = k
    const env = sharedEnv(k.renderer)
    // ---- baked textures: walnut for the plinth, the cover art, the label
    const woodRT = bake(k.renderer, 1024, 512, `void main() { vec2 q = vec2(vUv.x * 5.0, vUv.y * 2.4); vec3 c = wood(q, vec3(0.2, 0.1, 0.055), vec3(0.4, 0.21, 0.1), 5.5, 3.0); float f = smoothstep(0.0, 0.01, vUv.y) * smoothstep(1.0, 0.99, vUv.y); gl_FragColor = vec4(c * (0.92 + 0.08 * f), 1.0); }`)
    const labelTex = canvasTex(512, 512, (g, w, h) => {
      const c = w / 2
      const gr = g.createRadialGradient(c, c, 0, c, c, c)
      gr.addColorStop(0, '#ffd9a0'); gr.addColorStop(0.55, '#ff9a4a'); gr.addColorStop(1, '#d9531c')
      g.fillStyle = gr; g.fillRect(0, 0, w, h)
      g.strokeStyle = 'rgba(40,12,4,0.55)'; g.lineWidth = 3
      for (const r of [0.93, 0.86, 0.5]) { g.beginPath(); g.arc(c, c, c * r, 0, TAU); g.stroke() }
      // an off-centre mark, so the turning is visible: a half-moon and a small star
      g.fillStyle = 'rgba(40,12,4,0.85)'; g.beginPath(); g.arc(c, c, c * 0.72, -0.3, Math.PI * 0.62, false); g.arc(c + 28, c + 18, c * 0.62, Math.PI * 0.62, -0.3, true); g.fill()
      g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? c * 0.07 : c * 0.17; g.lineTo(c + Math.cos(a) * rr, c * 0.4 + Math.sin(a) * rr) } g.closePath(); g.fillStyle = 'rgba(255,240,210,0.95)'; g.fill()
      g.fillStyle = '#120804'; g.beginPath(); g.arc(c, c, c * 0.045, 0, TAU); g.fill()
    })
    const coverTex = canvasTex(768, 768, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1d2a44'); gr.addColorStop(0.5, '#a5522e'); gr.addColorStop(1, '#f1b25c')
      g.fillStyle = gr; g.fillRect(0, 0, w, h)
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(w * 0.5, h * 0.58, w * (0.07 + i * 0.056), 0, TAU); g.lineWidth = 6 + i * 1.2; g.strokeStyle = `rgba(255,${210 - i * 12},${150 - i * 8},${0.85 - i * 0.07})`; g.stroke() }
      g.fillStyle = '#10161f'; g.beginPath(); g.arc(w * 0.5, h * 0.58, w * 0.06, 0, TAU); g.fill()
      g.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 400; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    })
    const stroboTex = canvasTex(1024, 16, (g, w, h) => { g.fillStyle = '#2a2c30'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8d4cc'; for (let i = 0; i < 90; i++) g.fillRect((i / 90) * w, h * 0.22, w / 90 * 0.45, h * 0.56) }, { repeat: true })

    const ped = pedestal(env, 3.7); root.add(ped)
    // ---- the Blender-authored deck (scripts/blender/turntable.py): bevelled walnut plinth, steel plate, platter, felt, spindle, controls, tonearm. Lazy; null = the procedural deck below.
    const glb = await loadGLB('turntable')
    const parts = glb ? meshesByName(glb) : null
    const brushed = new THREE.MeshStandardMaterial({ color: D(0.78, 0.76, 0.72), metalness: 1, roughness: 0.34, envMap: env, envMapIntensity: 1.7 })
    const woodMat = new THREE.MeshStandardMaterial({ map: woodRT.texture, roughness: 0.42, envMap: env, envMapIntensity: 1.3 })
    const stroboMat = new THREE.MeshStandardMaterial({ map: stroboTex, metalness: 0.6, roughness: 0.4, envMap: env, envMapIntensity: 1.4 })
    if (parts) {
      const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ envMap: env, ...p })
      const mats: Record<string, THREE.Material> = {
        plinth: withAO(woodMat), plate: withAO(std({ color: D(0.3, 0.3, 0.31), metalness: 0.92, roughness: 0.36, envMapIntensity: 1.5 })),
        trim: withAO(brushed), dark: withAO(std({ color: D(0.022, 0.022, 0.025), roughness: 0.62, envMapIntensity: 0.9 })),
        mat: withAO(std({ color: D(0.05, 0.05, 0.056), roughness: 0.94, envMapIntensity: 0.5 })), platter_body: withAO(brushed), platter_strobe: withAO(stroboMat),
        armcap: withAO(std({ color: D(0.1, 0.1, 0.11), metalness: 0.8, roughness: 0.3, envMapIntensity: 1.3 })),
        arm_metal: withAO(std({ color: D(0.86, 0.85, 0.82), metalness: 1, roughness: 0.22, envMapIntensity: 2.0 }), { direct: 0.2 }),
        arm_dark: withAO(std({ color: D(0.07, 0.07, 0.08), metalness: 0.4, roughness: 0.3, envMapIntensity: 1.3 }), { direct: 0.2 }),
        arm_cart: withAO(std({ color: D(0.8, 0.28, 0.1), metalness: 0.2, roughness: 0.35, envMapIntensity: 1.2 }), { direct: 0.2 }),
      }
      for (const [n, m] of parts) if (mats[n]) m.material = mats[n]
      // the platter parts turn about the spindle, the arm parts yaw and lift about the pivot: both sets are re-parented under groups that records.ts drives
      platter = new THREE.Group(); platter.position.copy(parts.get('platter_body')!.position)
      for (const n of ['platter_body', 'platter_strobe']) { const m = parts.get(n)!; m.position.set(0, 0, 0); platter.add(m) }
      for (const n of ['plinth', 'plate', 'trim', 'dark', 'mat', 'armcap']) { const m = parts.get(n)!; m.parent?.remove(m); root.add(m) }
    } else {
    // ---- plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(PLINTH.w, PLINTH.h, PLINTH.d), woodMat)
    plinth.position.set(0, PLINTH.h / 2 + 0.04, 0)
    const feet = [[-2.3, -1.8], [2.3, -1.8], [-2.3, 1.8], [2.3, 1.8]].map(([x, z]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.08, 24), brushed); m.position.set(x, 0.04, z); return m })
    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(PLINTH.w - 0.2, 0.025, PLINTH.d - 0.2), new THREE.MeshStandardMaterial({ color: D(0.46, 0.46, 0.47), metalness: 0.95, roughness: 0.4, envMap: env, envMapIntensity: 1.5 }))
    topPlate.position.set(0, PLINTH.h + 0.04 + 0.012, 0)
    root.add(plinth, topPlate, ...feet)
    }
    // ---- platter, mat, record, label, spindle
    if (!parts) {
      platter = new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.58, 0.12, 128), [stroboMat, brushed, brushed])
      platter.position.set(C.x, Y_PLATTER - 0.06, C.y)
      const mat = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.04, 96), new THREE.MeshStandardMaterial({ color: D(0.06, 0.06, 0.065), roughness: 0.8 }))
      mat.position.set(C.x, Y_PLATTER + 0.02 + 0.0, C.y)
      const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 12), brushed); spindle.position.set(C.x, Y_REC + 0.1, C.y)
      root.add(mat, spindle)
    }
    disc = new THREE.Group(); disc.position.set(C.x, Y_PLATTER + 0.04, C.y)
    viz = createDeckViz({ root, cx: C.x, cz: C.y, y: Y_PLATTER + 0.02, reduced: () => kit.reduced(), phone: false })
    vinylMat = new THREE.ShaderMaterial({ vertexShader: VINYL_VERT, fragmentShader: VINYL_FRAG, uniforms: { uC: { value: new THREE.Vector3() }, uTime: { value: 0 }, uLive: { value: 1 }, ...viz.vinylU } })
    const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(REC_R, REC_R, 0.03, 160), vinylMat); vinyl.position.y = 0.015
    labelHouse = labelTex
    labelCv = document.createElement('canvas'); labelCv.width = labelCv.height = 512
    labelUser = new THREE.CanvasTexture(labelCv); labelUser.colorSpace = THREE.SRGBColorSpace
    labelMat = new THREE.MeshBasicMaterial({ map: labelTex, toneMapped: false })
    const label = new THREE.Mesh(new THREE.CircleGeometry(LABEL_R, 64), labelMat); label.rotation.x = -Math.PI / 2; label.position.y = 0.032
    disc.add(vinyl, label)
    labelHalo = halo(1.7, [1, 0.62, 0.28], 0.55); labelHalo.position.set(C.x, Y_REC + 0.03, C.y)
    root.add(platter, disc, labelHalo)
    // ---- tonearm: static base, a yawing assembly, a lifting arm
    arm = new THREE.Group(); arm.position.set(P.x, ARM_Y, P.y)
    armLift = new THREE.Group(); arm.add(armLift)
    if (parts) {
      for (const n of ['arm_metal', 'arm_dark', 'arm_cart']) { const m = parts.get(n)!; m.position.set(0, 0, 0); armLift.add(m) }
    } else {
      const tubeMat = new THREE.MeshStandardMaterial({ color: D(0.86, 0.85, 0.82), metalness: 1, roughness: 0.22, envMap: env, envMapIntensity: 2.0 })
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.046, ARM_L - 0.5, 16), tubeMat); tube.rotation.z = Math.PI / 2; tube.position.set((ARM_L - 0.5) / 2 - 0.05, 0, 0)
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.15), new THREE.MeshStandardMaterial({ color: D(0.07, 0.07, 0.08), metalness: 0.4, roughness: 0.3, envMap: env, envMapIntensity: 1.3 }))
      shell.position.set(ARM_L - 0.28, -0.02, 0)
      const cart = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.13), new THREE.MeshStandardMaterial({ color: D(0.8, 0.28, 0.1), metalness: 0.2, roughness: 0.35, envMap: env, envMapIntensity: 1.2 }))
      cart.position.set(ARM_L - 0.1, -0.1, 0)
      const stylus = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.1, 8), brushed); stylus.position.set(ARM_L, -0.2, 0); stylus.rotation.z = Math.PI
      const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.46, 32), brushed); cw.rotation.z = Math.PI / 2; cw.position.set(-0.46, 0, 0)
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8), tubeMat); finger.position.set(ARM_L - 0.46, -0.04, 0.2); finger.rotation.x = Math.PI / 2 - 0.5
      armLift.add(tube, shell, cart, stylus, cw, finger)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.5, 40), brushed); base.position.set(P.x, PLINTH.h + 0.04 + 0.25, P.y)
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.16, 32), new THREE.MeshStandardMaterial({ color: D(0.1, 0.1, 0.11), metalness: 0.8, roughness: 0.3, envMap: env, envMapIntensity: 1.3 }))
      cap.position.set(P.x, ARM_Y - 0.14, P.y)
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.12, 32), brushed); knob.position.set(-2.05, PLINTH.h + 0.12, 1.55)
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 24), brushed); btn.position.set(-1.6, PLINTH.h + 0.1, 1.62)
      root.add(base, cap, knob, btn)
    }
    // the needle's contact: a tiny light and a ring on the groove
    needleGlow = halo(0.5, [1, 0.8, 0.5], 0.0); needleGlow.visible = false
    needleRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), new THREE.MeshBasicMaterial({ color: D(1, 0.8, 0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); needleRing.rotation.x = -Math.PI / 2; needleRing.visible = false; needleRing.renderOrder = 4
    root.add(arm, needleGlow, needleRing)
    // ---- controls, an LED
    led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: D(1, 0.28, 0.12), toneMapped: false })); led.position.set(-1.2, PLINTH.h + 0.085, 1.62)
    root.add(led)
    // ---- the cover leaning behind the deck
    coverMat = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.5, envMap: env, envMapIntensity: 0.9 }); coverTex0 = coverTex
    const cover = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.0, 0.05), [new THREE.MeshStandardMaterial({ color: D(0.8, 0.78, 0.72), roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: D(0.8, 0.78, 0.72), roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: D(0.8, 0.78, 0.72), roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: D(0.8, 0.78, 0.72), roughness: 0.7 }),
      coverMat, new THREE.MeshStandardMaterial({ color: D(0.7, 0.68, 0.62), roughness: 0.8 })])
    cover.position.set(-0.9, 1.5, -2.62); cover.rotation.x = -0.1; cover.rotation.y = 0.1
    root.add(cover)
    // the sleeve the visitor drops: flat over the platter, then swings back to lean where the cover stands
    sleeveMat = new THREE.MeshStandardMaterial({ color: D(0.8, 0.78, 0.72), roughness: 0.5, envMap: env, envMapIntensity: 0.9 })
    sleeve = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.0, 0.05), [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ color: D(0.8, 0.78, 0.72), roughness: 0.7 })).concat([sleeveMat, new THREE.MeshStandardMaterial({ color: D(0.7, 0.68, 0.62), roughness: 0.8 })]))
    sleeve.visible = false; root.add(sleeve)
    // ---- pick: the deck and the arm
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false })
    const pDeck = new THREE.Mesh(new THREE.BoxGeometry(PLINTH.w, 1.0, PLINTH.d), proxyMat); pDeck.position.set(0, 0.6, 0); pDeck.userData.what = 'deck'
    const pArm = new THREE.Mesh(new THREE.BoxGeometry(ARM_L, 0.5, 0.5), proxyMat); pArm.position.set(ARM_L / 2, 0, 0); pArm.userData.what = 'arm'; armLift.add(pArm)
    root.add(pDeck); pick.push(pArm, pDeck)
    precompile(k, root)
    built = true
    await initCrate()
  }

  // ------------------------------------------------------------ the crate and the visitor's record
  async function initCrate() {
    picks = ((music as { picks?: Track[] }).picks ?? []).filter(p => p.title && p.artist)
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('musicFixture')) {   // dev only: stripped from production builds
      try { picks = ((await (await fetch(`${import.meta.env.BASE_URL}lab/music-fixture.json`)).json()) as { picks: Track[] }).picks } catch { /* no fixture */ }
    }
    picks = picks.filter(p => p.previewUrl || !import.meta.env.PROD)
    crate = mountCrate({
      picks,
      soundOn: () => sfx.enabled,
      turnSoundOn: () => { void sfx.init() },
      soundExplicitOff: () => explicitOff,
      platter: platterBox,
      onDrop: (t, i) => { if (!t) eject(); else loadTrack(t, i) },
      onToggleArm,
      reduced: () => kit.reduced(),
    })
    watch = window.setInterval(() => { if (soundWas && !sfx.enabled) explicitOff = true; else if (sfx.enabled) explicitOff = false; soundWas = sfx.enabled }, 250)
    turntable.onEnded(() => { ended = true; playing = false })
    turntable.onError(why => crate?.setMessage(why))
    ;(root.userData as { crate?: Crate }).crate = crate
  }
  /** the drop target on screen: the platter's ellipse, plus the whole deck's footprint (a sleeve let go anywhere over the turntable, the plinth included, lands: the
   *  visitor aims at "the record player", not at the exact circle, and the pick proxy the cursor shows a hand over is the deck box) */
  function platterBox() {
    const cv = kit.renderer.domElement.getBoundingClientRect(), v = new THREE.Vector3()
    root.updateMatrixWorld(true)
    const pr = (x: number, y: number, z: number) => { v.set(x, y, z); root.localToWorld(v); v.project(kit.camera); return { x: cv.left + (v.x * 0.5 + 0.5) * cv.width, y: cv.top + (-v.y * 0.5 + 0.5) * cv.height } }
    const c = pr(C.x, Y_REC + 0.02, C.y)
    if (!isFinite(c.x) || !isFinite(c.y)) return null
    // the drawn platter: its rim (a cylinder 1.58 wide, 0.12 tall) and the vinyl standing on it; the outline is the convex hull of both rings' projections, so the drop target
    // is the platter as the visitor sees it, whatever the camera's yaw and the stage's fit scale are
    const ring: { x: number; y: number }[] = []
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * TAU, ca = Math.cos(a), sa = Math.sin(a)
      ring.push(pr(C.x + 1.58 * ca, Y_PLATTER - 0.06, C.y + 1.58 * sa), pr(C.x + 1.58 * ca, Y_PLATTER, C.y + 1.58 * sa), pr(C.x + REC_R * ca, Y_REC + 0.03, C.y + REC_R * sa))
    }
    const pts = ring.filter(p => isFinite(p.x) && isFinite(p.y)).sort((p, q) => p.x - q.x || p.y - q.y)
    const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
    const half = (list: { x: number; y: number }[]) => { const h: { x: number; y: number }[] = []; for (const p of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p) } h.pop(); return h }
    const poly = half(pts).concat(half([...pts].reverse()))
    const xs = poly.map(p => p.x), ys = poly.map(p => p.y)
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const hy = PLINTH.h + 0.04, hw = PLINTH.w / 2, hd = PLINTH.d / 2
    const q = [pr(-hw, hy, -hd), pr(hw, hy, -hd), pr(-hw, hy, hd), pr(hw, hy, hd), pr(-hw, hy + 1.0, -hd), pr(hw, hy + 1.0, -hd)]
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: Math.max(30, (x1 - x0) / 2), ry: Math.max(24, (y1 - y0) / 2), poly, deck: { x0: Math.min(...q.map(p => p.x)), x1: Math.max(...q.map(p => p.x)), y0: Math.min(...q.map(p => p.y)), y1: Math.max(...q.map(p => p.y)) } }
  }
  function paintLabel(img: HTMLImageElement | null) {
    const g = labelCv.getContext('2d')!, c = 256
    g.clearRect(0, 0, 512, 512)
    g.save(); g.beginPath(); g.arc(c, c, c, 0, TAU); g.clip()
    if (img) g.drawImage(img, 0, 0, 512, 512)
    else { const gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, '#ffd9a0'); gr.addColorStop(1, '#d9531c'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512) }
    g.restore()
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.beginPath(); g.arc(c, c, c * 0.93, 0, TAU); g.stroke()
    g.fillStyle = '#120804'; g.beginPath(); g.arc(c, c, c * 0.05, 0, TAU); g.fill()
    labelUser.needsUpdate = true
  }
  function loadTrack(t: Track, i: number) {
    // an interrupted record (another one picked while this one plays) stops first
    if (audioOn) { turntable.pause(0.12); audioOn = false }
    sfx.cue('cab:press'); kit.emit('cab:sleeve', { i })
    userMode = true; curIdx = i; ended = false; playing = true; tauPlay = 0; omega = 0; yaw = PARK; lift.x = 1; lift.v = 0; wasDown = false
    phase = kit.reduced() ? 'ready' : 'sleeve'; phaseT = 0; discDrop = 1.3; dropSpring.x = 1.3; dropSpring.v = 0
    labelMat.map = labelUser; labelMat.needsUpdate = true; paintLabel(null); viz.setArt(null)
    turntable.load(t)
    needleSounded = false
    // the click that put the record on is the gesture: the music starts NOW (a short fade-in), the needle's thump follows when the arm lands
    if (sfx.enabled && !document.hidden) { audioOn = true; sfx.setMusic(false); turntable.start() }
    if (t.artwork) {
      const img = new Image(); img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (curIdx !== i) return
        paintLabel(img)
        coverArt?.dispose(); coverArt = new THREE.Texture(img); coverArt.colorSpace = THREE.SRGBColorSpace; coverArt.anisotropy = 8; coverArt.needsUpdate = true
        sleeveMat.map = coverArt; sleeveMat.color.setScalar(1); sleeveMat.needsUpdate = true; viz.setArt(coverArt)
        if (phase === 'ready' || phaseT > 0.9) { coverMat.map = coverArt; coverMat.needsUpdate = true }
      }
      img.src = t.artwork
    } else { sleeveMat.map = null; sleeveMat.color.copy(D(0.35, 0.2, 0.1)); sleeveMat.needsUpdate = true }
    disc.visible = phase === 'ready'
    sleeve.visible = phase === 'sleeve'
    crate?.setCurrent(i, 'loading')
  }
  function eject() {
    if (audioOn) { turntable.pause(0.12); audioOn = false; sfx.setMusic(true) }
    turntable.unload(); userMode = false; curIdx = -1; phase = 'house'; ended = false
    labelMat.map = labelHouse; labelMat.needsUpdate = true; viz.setArt(null)
    coverMat.map = coverTex0; coverMat.needsUpdate = true
    disc.visible = true; sleeve.visible = false; disc.position.y = Y_PLATTER + 0.04
    playing = true; tauPlay = 0
    crate?.setCurrent(-1, 'none'); lastState = ''
  }
  function onToggleArm() {
    if (!userMode || phase !== 'ready') return
    if (ended) { ended = false; turntable.rewind(); playing = true; tauPlay = 0.3; return }
    playing = !playing; if (playing) tauPlay = Math.min(tauPlay, 0.2)
    kit.emit('cab:press', { what: 'arm', playing })
  }
  const caseOpen = () => !!(window as unknown as { __v3?: { caseView?: { isOpen?: () => boolean } } }).__v3?.caseView?.isOpen?.()

  /** the audio follows the needle: sound while it is down on a visitor's record, the site's sound is on and the page is visible */
  function reconcileAudio(here: boolean) {
    const want = userMode && playing && (here || audioOn) && sfx.enabled && !document.hidden && !ended
    if (want && !audioOn) { audioOn = true; sfx.setMusic(false); turntable.start() }
    else if (!want && audioOn) { audioOn = false; turntable.pause(); sfx.setMusic(true); needleSounded = false }
  }

  function setArm(y: number, l: number) { arm.rotation.y = -y; armLift.rotation.z = l * 0.105 }

  function update(time: number, dt: number, r: number, dwell: boolean, _st: FlightState) {
    if (!built) return
    const rm = kit.reduced()
    if (r <= 0.0005) {
      root.visible = false
      if (audioOn && userMode && !ended) { crate?.setVisible(false); return }             // the visitor's record keeps playing as the flight goes on (the now-playing pill and the turntable stop it)
      if (wasPresent) {
        wasPresent = false; tauPlay = 0; yaw = PARK; lift.x = 1; lift.v = 0; omega = 0; wasDown = false
        if (userMode) playing = false                       // the visitor's record waits with the arm parked: no sound starts by itself
        reconcileAudio(false); crate?.setVisible(false)
      }
      return
    }
    wasPresent = true; root.visible = true
    enter(root, r, rm, 2.6)
    // ---- the record player's own state machine (a function of how long the visitor has stayed, tauPlay)
    const here = dwell && r > 0.98
    if (userMode && !dwell && playing && !audioOn) playing = false      // leaving: a record that is not yet playing waits; a playing one carries on
    // ---- the visitor's record: the sleeve swings back, the vinyl lands
    if (userMode && phase !== 'ready') {
      phaseT += dt
      const u = Math.min(1, phaseT / 0.5)
      if (phase === 'sleeve') {
        const e = easeInOut(u), arc = Math.sin(u * Math.PI) * 0.6
        sleeve.position.lerpVectors(SLEEVE_FROM, SLEEVE_TO, e); sleeve.position.y += arc
        sleeve.rotation.set(lerp(-Math.PI / 2, -0.1, e), lerp(0, 0.1, e), 0)
        sleeve.visible = true
        if (phaseT > 0.26 && !disc.visible) { disc.visible = true; dropSpring.x = 1.3; dropSpring.v = 0 }
        if (u >= 1) { sleeve.visible = false; if (coverArt) { coverMat.map = coverArt; coverMat.needsUpdate = true } phase = 'drop' }
      }
      if (disc.visible) {
        const was = dropSpring.x; dropSpring.step(0, dt)
        disc.position.y = Y_PLATTER + 0.04 + Math.max(0, dropSpring.x)
        if (was > 0.02 && dropSpring.x <= 0.02 && dropSpring.v < 0) kit.emit('cab:landed', {})
      }
      if (phase === 'drop' && Math.abs(dropSpring.x) < 0.01 && Math.abs(dropSpring.v) < 0.05) { disc.position.y = Y_PLATTER + 0.04; phase = 'ready'; tauPlay = 0 }
    }
    if (rm) {
      yaw = yawFor(1.25); omega = 0
      const down = !userMode || (phase === 'ready' && playing)
      lift.x = down ? 0 : 1
      if (userMode) { if (down && !wasDown) wasDown = true; else if (!down && wasDown) wasDown = false }
    } else {
      const run = playing && (here || (audioOn && userMode)) && (!userMode || phase === 'ready')
      if (run) tauPlay += dt; else if (!playing || !dwell) tauPlay = Math.max(0, tauPlay - dt * 2)
      const wantOmega = run ? 3.49 * sstep(0, 1.1, tauPlay) : 0
      omega = damp(omega, wantOmega, run ? 0.4 : 0.9, dt)
      const rho = 1.42 - 0.011 * Math.max(0, tauPlay - 2.6)
      const wantYaw = run && tauPlay > (userMode ? 0.1 : 0.9) ? yawFor(Math.max(0.62, rho)) : PARK
      yaw = damp(yaw, wantYaw, run ? 0.34 : 0.28, dt)
      const wantLift = run && tauPlay > (userMode ? 0.5 : 2.4) ? 0 : 1
      lift.step(wantLift, dt)
      if (lift.x < 0.04 && !wasDown) { wasDown = true; needleT = time; if (!userMode) kit.emit('cab:needle', { down: true }); else if (audioOn && !needleSounded) { needleSounded = true; turntable.needle() } }
      if (lift.x > 0.35 && wasDown) { wasDown = false; needleSounded = false; if (!userMode) kit.emit('cab:needle', { down: false }) }
    }
    if (userMode || audioOn) reconcileAudio(here)
    // ---- the crate follows the visitor: shown while standing at this waypoint, not over the case view or the index
    crate?.setVisible(here && !caseOpen() && !document.documentElement.classList.contains('in-index') && !document.documentElement.classList.contains('is-loading'))
    if (crate && userMode) {
      const st: CrateState = ended ? 'ended' : phase !== 'ready' ? 'loading' : !playing ? 'lifted' : audioOn && turntable.playing ? 'playing' : 'loading'
      if (st !== lastState) { lastState = st; crate.setCurrent(curIdx, st) }
      const pr = turntable.duration > 0 ? turntable.currentTime / turntable.duration : 0
      if (Math.abs(pr - lastProg) > 0.004) { lastProg = pr; crate.setProgress(pr) }
    }
    if (crate) crate.setSpectrum(MUSIC.spec, MUSIC.k, MUSIC.k > 0.02 ? [MUSIC.pal[0].r * 0.5 + MUSIC.pal[2].r * 0.5, MUSIC.pal[0].g * 0.5 + MUSIC.pal[2].g * 0.5, MUSIC.pal[0].b * 0.5 + MUSIC.pal[2].b * 0.5] : null)
    setArm(yaw, Math.max(0, lift.x))
    spinAng += omega * dt; disc.rotation.y = spinAng; platter.rotation.y = spinAng
    disc.getWorldPosition(vinylMat.uniforms.uC.value as THREE.Vector3); vinylMat.uniforms.uTime.value = time
    viz.update(time, dt, spinAng)
    // ---- the label glows (and breathes), the LED shows play
    const breathe = 1.15 + 0.22 * Math.sin(time * 1.9) + (omega > 0.5 ? 0.12 : 0)
    labelMat.color.setScalar(breathe)
    ;(labelHalo.material as THREE.MeshBasicMaterial).opacity = 0.32 + 0.22 * Math.sin(time * 1.9) + 0.2 * Math.min(1, omega / 3.49)
    ;(led.material as THREE.MeshBasicMaterial).color.copy(D(1, 0.28, 0.12)).multiplyScalar(omega > 0.5 ? 1.6 + 0.4 * Math.sin(time * 3) : 0.25)
    // ---- the needle's contact
    const tip = new THREE.Vector3(ARM_L, -0.2, 0)
    if (lift.x < 0.5) {
      armLift.localToWorld(tip); root.worldToLocal(tip)
      needleGlow.visible = true; needleGlow.position.set(tip.x, Y_REC + 0.035, tip.z)
      ;(needleGlow.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - lift.x * 2) * (omega > 0.5 ? 1 : 0.4)
      const u = (time - needleT) / 0.9
      if (u >= 0 && u < 1) { needleRing.visible = true; needleRing.position.set(tip.x, Y_REC + 0.036, tip.z); const s = lerp(0.05, 0.5, 1 - (1 - u) * (1 - u)); needleRing.scale.set(s, 1, s); (needleRing.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - u) } else needleRing.visible = false
    } else { needleGlow.visible = false; needleRing.visible = false }
  }

  return {
    id: 'records', root, dim: 0.06, pick, build, update,
    press(o) { if (!o) return; if (userMode) { onToggleArm(); return } playing = !playing; if (playing) tauPlay = Math.min(tauPlay, 0.2); kit.emit('cab:press', { what: o.userData.what, playing }) },
    act(name) {
      if (name !== 'toggle') return ''
      if (userMode) { onToggleArm(); return playing ? 'The needle is down.' : 'The arm is lifted.' }
      playing = !playing; if (playing) tauPlay = Math.min(tauPlay, 0.2)
      kit.emit('cab:press', { what: 'deck', playing })
      return playing ? 'The record is spinning.' : 'The record has stopped.'
    },
    api: {
      get tau() { return tauPlay }, set tau(v: number) { tauPlay = v }, get playing() { return playing },
      get user() { return { userMode, phase, curIdx, audioOn, wasDown, omega, ended, audio: turntable.status() } },
      load: (i: number) => loadTrack(picks[i], i), eject, platterBox, get picks() { return picks },
    },
    dispose() { clearInterval(watch); if (audioOn) { turntable.pause(0.05); sfx.setMusic(true) } turntable.unload(); crate?.dispose(); coverArt?.dispose(); viz?.dispose(); disposeTree(root) },
  }
}
