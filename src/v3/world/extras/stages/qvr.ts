// STAGE qvr (waypoint 'surface', the first project a visitor meets): THE VOLATILITY INSTRUMENT. A museum desk object, lit like a product photograph:
// a walnut plinth on a shadow-gap foot, a brushed aluminium deck, machined strike / maturity rails and an implied-vol post with engraved scales, a thin
// glass vitrine, and 40 x 28 brass pins rising through the deck to an SSVI implied-volatility surface (Gatheral and Jacquier 2014, a public model;
// src/ui/labs/qvr-math.ts, the same maths as the particle form and the case lab). Labelled on the object and in the DOM: a simulation, not QVR data.
//   model     scripts/blender/qvr_instrument.py -> public/models/glb/qvr-instrument.glb (Draco + WebP, Cycles-baked AO in COLOR_0); the pins are ONE
//             InstancedMesh of the GLB's 'pin' (one draw call): the head rides the instance's y, the rod stretches down to the deck in the vertex shader
//   light     a PMREM of Poly Haven "Studio Small 09" (CC0, 512 x 256 .hdr) on every material here (userData.ownEnv keeps env.ts from swapping it);
//             no lights are added (a light would change every lit program in the scene)
//   interact  drag the object to turn it (inertia, then an anime.js spring settles it); three knurled dials on the fascia set the LEVEL (θ, the ATM
//             vol), the SKEW (ρ) and the SMILE (η, the curvature): each is an anime.js createDraggable (x mapped to rotate, 24 detents, onSettle) on a
//             DOM proxy over the 3D knob, with a native range input for the keyboard and screen readers. Every detent re-targets the pins with an anime.js
//             grid stagger (the three.js adapter animates the InstancedMesh proxies) rippling from the deck edge nearest the dial, and the part of the
//             surface that dial governs glows for a moment. Hover or tap a pin for a tag in words (strike, expiry, implied vol).
//   legible   (r6) qvr-guide.ts + qvr-guide.css: strike, expiry and implied volatility labelled ON the object (projected axes that follow the turn), each
//             knob named for what it does with a word for its setting (the Greek letters are small print), a four-step walkthrough (one pin, height, skew
//             and term structure, the shock) whose steps drive the pins with anime.js, and a console that keeps clear of the HUD at every window size
//   honesty   readouts live in data-proof="skip" roots; η is held at the no-arbitrage bound η(1 + |ρ|) <= 2 (the lab note's sufficient condition)
//   reduced   no flight, no ripple (the pins jump), dials and turn still work; Pause stops nothing here (all motion is visitor-initiated)
//   fallback  until the GLB and the HDR arrive (or if either fails) nothing shows and the particle surface keeps the frame (dust 1)
// window.__qvr = { info(), pinScreen(ix, iz), centreScreen(), setParams(p) } for the probes.
import * as THREE from 'three'
import { animate, createDraggable, spring, stagger, utils, type Draggable, type EasingParam, type JSAnimation } from 'animejs'
import { getInstances } from 'animejs/adapters/three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { loadGLB, meshesByName, withAO } from '../../glbmodel'
import { freeRegion } from '../../layout'
import { DEFAULTS, K_MAX, K_MIN, kOf, ssviSigma, tOf, uOf, type SSVIParams } from '../../../../ui/labs/qvr-math'
import { Axes, CAPPED, TOUR, Tour, VOL_MARKS, levelLine, levelWord, skewLine, skewWord, smileLine, smileWord, strikeText, expiryText } from './qvr-guide'
import { canvasTex, clamp01, easeInCubic, easeOutBack, easeOutCubic, lit, mergeGeos, rayPlaneLocal, tryMark, type StageBuildCtx, type StageDef, type StageFrame, type StagePointer } from './common'

// ---- the same numbers as scripts/blender/qvr_instrument.py ----
const NX = 40, NZ = 28, P = 0.13
const AX = (NX - 1) * P, AZ = (NZ - 1) * P
const DECK_W = AX + 0.62, DECK_D = AZ + 0.62
const PL_W = 6.5, PL_Y0 = -0.62, PL_Y1 = -0.05, PL_Z1 = AZ / 2 + 0.95
const RAIL_H = 0.12, RAIL_W = 0.16, RAIL_Z = AZ / 2 + 0.36, RAIL_X = AX / 2 + 0.36
const POST_X = -(AX / 2 + 0.36), POST_Z = -(AZ / 2 + 0.36), POST_H = 1.6
const FAS_Y = (PL_Y0 + PL_Y1) / 2, FAS_H = 0.44, FAS_T = 0.02, FAS_W = PL_W - 0.5
const DIAL_X = [-2.45, -1.55, -0.65], DIAL_R = 0.19, KNOB_L = 0.13
const DY = FAS_Y + 0.025, FZ = PL_Z1
const HEAD_H = 0.03, ROD_LEN = 1.0
const BASE = import.meta.env.BASE_URL
const VIOLET = '#B48CFF'

/** pin height above the deck for an implied vol (the vol post's scale uses the same map) */
const hOf = (iv: number) => Math.min(1.52, Math.max(0.05, 0.06 + (iv - 0.08) * 2.4))
const ixOf = (x: number) => Math.round((x + AX / 2) / P)
/** maturity coordinate of a pin row: the back row (iz = 0) is one week, the front row (iz = NZ-1, toward the viewer) two years, so the steep
 *  short-dated smile stands at the back against the vol post and nothing tall hides the rest of the surface */
const uRow = (iz: number) => iz / (NZ - 1)

// ---- the dials: 24 detents over a 270 degree sweep ----
const SWEEP = 135, STEP = 270 / 24
interface DialDef { k: 'theta' | 'rho' | 'eta'; sym: string; name: string; min: number; max: number; fmt: (v: number) => string; word: (v: number) => string; line: (v: number) => string }
/** named for what each does; the Greek letter is the model's own name for it and stays small */
const DIALS: DialDef[] = [
  { k: 'theta', sym: 'θ', name: 'Level', min: 0.10, max: 0.34, fmt: v => (v * 100).toFixed(1) + '%', word: levelWord, line: levelLine },
  { k: 'rho', sym: 'ρ', name: 'Skew', min: -0.9, max: 0.3, fmt: v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2), word: skewWord, line: skewLine },
  { k: 'eta', sym: 'η', name: 'Smile', min: 0.2, max: 1.64, fmt: v => v.toFixed(2), word: smileWord, line: smileLine },
]
type P2 = [number, number]
/** where the at-the-money strike falls along the strike axis (0 = the lowest strike, 1 = the highest) */
const ATM_FRAC = (0 - K_MIN) / (K_MAX - K_MIN)
const valOf = (d: DialDef, deg: number) => d.min + ((deg + SWEEP) / 270) * (d.max - d.min)
const degOf = (d: DialDef, v: number) => Math.round((((v - d.min) / (d.max - d.min)) * 270 - SWEEP) / STEP) * STEP

// ---- the HDR studio PMREM (once) ----
let studioP: Promise<THREE.Texture | null> | null = null
function studioEnv(renderer: THREE.WebGLRenderer): Promise<THREE.Texture | null> {
  return (studioP ??= (async () => {
    try {
      const t = await new HDRLoader().loadAsync(`${BASE}media/hdri/studio_small_09-512.hdr`)
      t.mapping = THREE.EquirectangularReflectionMapping
      const prev = renderer.getRenderTarget()
      const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromEquirectangular(t)
      renderer.setRenderTarget(prev)
      t.dispose(); pm.dispose()
      return rt.texture
    } catch (e) { console.warn('[qvr] studio HDRI unavailable', e); return null }
  })())
}

// ---- engraving: black-filled cuts on a transparent canvas, laid over a face as a decal ----
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace'
function decal(tex: THREE.Texture, w: number, h: number, env: THREE.Texture, key: string, rough = 0.55) {
  const m = lit(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: rough, metalness: 0.15, envMap: env, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }), 'qvr-decal-' + key)
  m.userData.ownEnv = true
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
}
const INK = 'rgba(10, 9, 9, 0.92)'

// ---- the glass: a photographic set of its own (product-shot glass on black). Camera-space strip lights, so the streaks hold still while the
// object turns under them and slide across the panes like a real turntable shoot; edges from the pane box itself (the second-nearest face distance)
const GLASS_VERT = /* glsl */`
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main() {
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz; vN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`
const GLASS_FRAG = /* glsl */`
uniform vec3 uHalf; uniform vec4 uL; uniform float uY0, uGain, uEdge, uLift;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
float band(float x, float a, float b, float s) { return smoothstep(a - s, a + s, x) * (1.0 - smoothstep(b - s, b + s, x)); }
void main() {
  vec3 N = normalize(vN), V = normalize(vV);
  if (!gl_FrontFacing) N = -N;
  float c = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.04 + 0.96 * pow(1.0 - c, 5.0);
  vec3 R = reflect(-V, N);
  float az = atan(R.x, R.z), el = asin(clamp(R.y, -1.0, 1.0));
  // the set (radiance, display-referred). The tilt toward the camera makes every upright pane mirror the low half of the room, so the strips
  // stand low: a key strip camera right (the front pane catches it once turned about 17 degrees toward it), a narrow fill strip camera left (the
  // front pane at rest), a narrow overhead softbox (a streak across the lid, about a fifth of it), a rim strip behind on the right (the right-hand
  // pane at rest). Sized against a CPU model of this shader (rest pose: front pane lit about a third, right pane 45%, lid 18%, peaks near 0.1)
  float L = uL.x * band(az, 0.45, 0.62, 0.05) * band(el, -0.95, 0.5, 0.16)
          + uL.y * band(az, -1.32, -1.18, 0.03) * band(el, -0.9, 0.3, 0.15)
          + uL.z * band(el, 0.95, 1.3, 0.08)
          + uL.w * band(az, 1.95, 2.2, 0.06) * band(el, -0.45, 0.55, 0.2);
  // polished edges: on a face the nearest box side is the face itself, the second nearest is the distance to the pane's edge
  vec3 d = vec3(uHalf.x - abs(vP.x), min(uHalf.y - vP.y, vP.y - uY0), uHalf.z - abs(vP.z));
  float mn = min(d.x, min(d.y, d.z)), mx = max(d.x, max(d.y, d.z)), mid = d.x + d.y + d.z - mn - mx;
  float aa = fwidth(mid);
  float edge = 1.0 - smoothstep(0.006, 0.02 + aa * 1.5, mid);
  float e = edge * uEdge * (0.55 + 0.45 * min(L, 1.0)) * (0.6 + 0.4 * (1.0 - c));
  vec3 col = vec3(1.0, 0.985, 0.96) * (L * F * uGain + uLift * F) + vec3(0.8, 0.94, 0.9) * e;
  col = col / (1.0 + 0.25 * col);
  gl_FragColor = vec4(col, clamp(F * 0.85 + e * 0.6, 0.0, 0.9));
}`
function glassMat(bb: THREE.Box3) {
  return new THREE.ShaderMaterial({
    name: 'qvr-glass', vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG,
    uniforms: { uHalf: { value: new THREE.Vector3(Math.max(-bb.min.x, bb.max.x), bb.max.y, Math.max(-bb.min.z, bb.max.z)) }, uY0: { value: bb.min.y }, uGain: { value: 1.4 }, uEdge: { value: 0.75 }, uLift: { value: 0.06 }, uL: { value: new THREE.Vector4(3, 1.6, 1.6, 1.5) } },
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  })
}

export function buildStage(c: StageBuildCtx) {
  const root = new THREE.Group()
  const face = new THREE.Group(), tilt = new THREE.Group(), turn = new THREE.Group()
  root.add(face); face.add(tilt); tilt.add(turn)
  // face the authored camera square, then tilt the top toward it (a 3/4-from-above product view: the waypoint camera is nearly level) and turn
  // the object a little so the fascia and the maturity rail both read; the visitor's turn adds to `yaw`
  face.rotation.y = Math.atan2(c.view.dir.x, c.view.dir.z)
  const TILT = 0.42
  tilt.rotation.x = TILT
  const YAW0 = -0.5
  const st = { yaw: YAW0 }
  turn.rotation.y = YAW0
  turn.position.y = -0.35
  turn.visible = false
  const html = document.documentElement
  const rm = () => html.classList.contains('rm')

  const params: SSVIParams = { ...DEFAULTS }
  const val = { theta: DEFAULTS.level, rho: DEFAULTS.rho, eta: DEFAULTS.eta }
  let etaHeld = false
  const apply = () => {
    params.level = val.theta; params.rho = val.rho
    const bound = 2 / (1 + Math.abs(val.rho))
    etaHeld = val.eta > bound
    params.eta = Math.min(val.eta, bound)
  }
  apply()
  const H = new Float32Array(NX * NZ)
  const IV = new Float32Array(NX * NZ)
  const solve = () => {
    for (let iz = 0; iz < NZ; iz++) {
      const T = tOf(uRow(iz))
      for (let ix = 0; ix < NX; ix++) { const v = ssviSigma(params, kOf(ix / (NX - 1)), T); IV[iz * NX + ix] = v; H[iz * NX + ix] = hOf(v) }
    }
  }
  solve()

  let ready = false
  let pins: THREE.InstancedMesh | null = null
  let proxies: { y: number }[] = []
  const knobs: THREE.Object3D[] = []
  let glass: THREE.ShaderMaterial | null = null
  const inst = {
    root,
    dust: 1,
    size: [7.2, 4.4] as [number, number],
    update,
    leave: () => { if (ready && !broken) leaveStage() },
    pointer: undefined as StagePointer | undefined,
    hint: ['Drag to turn it', 'tap a pin to read it, turn a dial, or take the tour'] as [string, string],
  }

  // -------------------------------------------------------------------------------------------- build (async: GLB + HDR)
  void (async () => {
    const [gltf, env] = await Promise.all([loadGLB('qvr-instrument'), studioEnv(c.renderer)])
    if (!gltf || !env) return
    try { await document.fonts?.load(`500 40px ${MONO}`) } catch { /* the fallback mono draws the scales */ }
    const by = meshesByName(gltf)
    const own = <T extends THREE.Material>(m: T, k = 1) => { (m as unknown as THREE.MeshStandardMaterial).envMap = env; (m as unknown as THREE.MeshStandardMaterial).envMapIntensity = k; m.userData.ownEnv = true; return m }
    const src = (n: string) => by.get(n)?.material as THREE.MeshStandardMaterial | undefined
    const disposeLater: THREE.Material[] = []
    // walnut: the Poly Haven maps under a lacquer clearcoat
    const w0 = src('plinth')
    const walnut = withAO(lit(own(new THREE.MeshPhysicalMaterial({ map: w0?.map ?? null, normalMap: w0?.normalMap ?? null, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: w0?.roughnessMap ?? null, roughness: 0.85, metalness: 0, clearcoat: 0.62, clearcoatRoughness: 0.2 }), 0.95), 'qvr-walnut'), { direct: 0.5, spec: 0.8 })
    const a0 = src('deck')
    const alu = withAO(lit(own(new THREE.MeshStandardMaterial({ map: a0?.map ?? null, normalMap: a0?.normalMap ?? null, roughnessMap: a0?.roughnessMap ?? null, color: 0xdfe2e6, roughness: 0.95, metalness: 1 }), 1.0), 'qvr-alu'), { direct: 0.5, spec: 0.9 })
    const f0 = src('dialface_0')
    const dialMat = withAO(lit(own(new THREE.MeshStandardMaterial({ map: f0?.map ?? null, normalMap: f0?.normalMap ?? null, roughnessMap: f0?.roughnessMap ?? null, color: 0xe6e8ea, roughness: 0.9, metalness: 1 }), 1.1), 'qvr-dialface'), { direct: 0.4, spec: 0.7 })
    const brassK = withAO(lit(own(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.86, 0.64, 0.33), metalness: 1, roughness: 0.27, clearcoat: 0.3, clearcoatRoughness: 0.15 }), 1.25), 'qvr-brass-knob'), { direct: 0.3, spec: 0.6 })
    const footMat = withAO(lit(own(new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.55, metalness: 0 }), 0.6), 'qvr-foot'), { direct: 0.5 })
    disposeLater.push(walnut, alu, dialMat, brassK, footMat)
    const set = (n: string, m: THREE.Material) => { const me = by.get(n); if (me) { (me.material as THREE.Material).dispose(); me.material = m } }
    set('plinth', walnut); set('foot', footMat)
    for (const n of ['deck', 'rail_strike', 'rail_maturity', 'post_vol', 'fascia']) set(n, alu)
    for (let i = 0; i < 3; i++) set('dialface_' + i, dialMat)
    for (const n of ['knob_theta', 'knob_rho', 'knob_eta']) { set(n, brassK); const k = by.get(n); if (k) knobs.push(k) }
    // the vitrine: clear glass on a black set reads by two things only, its polished edges and the long softbox streaks it mirrors. The PMREM studio
    // mirrored a grey room into every pane (eight additive layers through two panes: the milky box), so the panes get their own photographic set
    // instead (glassMat: three analytic strip lights in camera space, Schlick Fresnel, premultiplied so a pane dims what is behind it by F only),
    // plus a depth-only twin drawn after it so the bloom's mesh mask keeps the streaks crisp instead of haloing them
    const vit = by.get('vitrine') as THREE.Mesh | undefined
    if (vit) {
      vit.geometry.computeBoundingBox()
      const g = glassMat(vit.geometry.boundingBox!)
      ;(vit.material as THREE.Material).dispose(); vit.material = g; vit.renderOrder = 3; disposeLater.push(g)
      const dm = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true })
      const dOnly = new THREE.Mesh(vit.geometry, dm); dOnly.renderOrder = 4; dOnly.name = 'qvr-glass-depth'
      vit.add(dOnly); disposeLater.push(dm)
      glass = g
    }
    // the pins: ONE InstancedMesh of the GLB's pin; rod vertices (aRod = 1) stretch down to the deck
    const pinSrc = by.get('pin')
    if (pinSrc) {
      const geo = pinSrc.geometry.clone()
      geo.deleteAttribute('color'); geo.deleteAttribute('uv')
      const pa = geo.getAttribute('position'), rod = new Float32Array(pa.count)
      for (let i = 0; i < pa.count; i++) rod[i] = pa.getY(i) < -HEAD_H - 0.0005 ? 1 : 0
      geo.setAttribute('aRod', new THREE.BufferAttribute(rod, 1))
      const pinMat = lit(own(new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.2, clearcoat: 0.25, clearcoatRoughness: 0.1 }), 1.3), 'qvr-pin', sh => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float aRod;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
          if (aRod > 0.5) { float hI = instanceMatrix[3].y; transformed.y = -${HEAD_H.toFixed(3)} + (transformed.y + ${HEAD_H.toFixed(3)}) * max(hI - ${HEAD_H.toFixed(3)}, 0.0) / ${ROD_LEN.toFixed(3)}; }
          #endif`)
      })
      disposeLater.push(pinMat)
      const im = new THREE.InstancedMesh(geo, pinMat, NX * NZ)
      im.name = 'qvr-pins'; im.frustumCulled = false
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      const m4 = new THREE.Matrix4(), brass = new THREE.Color(0.9, 0.68, 0.36)
      for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
        const i = iz * NX + ix
        m4.makeTranslation(-AX / 2 + ix * P, 0.05, -AZ / 2 + iz * P); im.setMatrixAt(i, m4); im.setColorAt(i, brass)
      }
      im.instanceColor!.setUsage(THREE.DynamicDrawUsage)
      turn.add(im); pins = im
      proxies = getInstances(im) as unknown as { y: number }[]
      pinSrc.removeFromParent(); pinSrc.geometry.dispose()
    }
    turn.add(gltf)

    // ---- engravings ----
    // the deck: a hole at every pin with a bright chamfer, and a fine border round the field
    const pxu = 250
    const dk = canvasTex(Math.round(DECK_W * pxu), Math.round(DECK_D * pxu), (g, w, h) => {
      g.clearRect(0, 0, w, h)
      for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
        const x = (DECK_W / 2 - AX / 2 + ix * P) * pxu, y = (DECK_D / 2 - AZ / 2 + iz * P) * pxu
        g.fillStyle = 'rgba(235, 238, 242, 0.55)'; g.beginPath(); g.arc(x, y, 0.033 * pxu, 0, Math.PI * 2); g.fill()
        g.fillStyle = 'rgba(4, 4, 5, 0.96)'; g.beginPath(); g.arc(x, y + 0.002 * pxu, 0.026 * pxu, 0, Math.PI * 2); g.fill()
      }
      g.strokeStyle = INK; g.lineWidth = 0.006 * pxu
      g.strokeRect((DECK_W / 2 - AX / 2 - 0.13) * pxu, (DECK_D / 2 - AZ / 2 - 0.13) * pxu, (AX + 0.26) * pxu, (AZ + 0.26) * pxu)
    }, { aniso: 8 })
    const deckDecal = decal(dk.tex, DECK_W, DECK_D, env, 'deck', 0.4)
    deckDecal.rotation.x = -Math.PI / 2; deckDecal.position.set(0, 0.0012, 0); turn.add(deckDecal)

    // strike rail (front): a tick at every pin column, labels K/F at every fifth
    const sw = AX + 0.42, spx = 4096 / sw
    const sr = canvasTex(4096, Math.round(RAIL_W * spx), (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = INK
      for (let ix = 0; ix < NX; ix++) {
        const x = (sw / 2 - AX / 2 + ix * P) * spx, major = ix % 5 === 0 || ix === NX - 1
        g.fillRect(x - 2.5, 0, 5, h * (major ? 0.36 : 0.2))
        if (major) { g.font = `500 ${Math.round(h * 0.3)}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(String(Math.round(Math.exp(kOf(ix / (NX - 1))) * 100)), x, h * 0.84) }
      }
      g.font = `500 ${Math.round(h * 0.22)}px ${MONO}`; g.textAlign = 'left'; (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '6px'
      g.fillText('STRIKE  K/F %', 18, h * 0.84)
    }, { aniso: 8 })
    const strike = decal(sr.tex, sw, RAIL_W, env, 'strike')
    strike.rotation.x = -Math.PI / 2; strike.position.set(0, RAIL_H + 0.0009, RAIL_Z); turn.add(strike)

    // maturity rail (right): a tick at every pin row, tenor labels where they fall
    const md = AZ + 0.42, mpx = 4096 / md
    const TENORS: [string, number][] = [['1W', 7 / 365], ['1M', 1 / 12], ['3M', 0.25], ['6M', 0.5], ['1Y', 1], ['2Y', 2]]
    const mr = canvasTex(Math.round(RAIL_W * mpx), 4096, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = INK
      // canvas top = the back of the rail (one week)
      for (let iz = 0; iz < NZ; iz++) { const y = (md / 2 - AZ / 2 + iz * P) * mpx; g.fillRect(0, y - 2.5, w * 0.2, 5) }
      g.font = `500 ${Math.round(w * 0.3)}px ${MONO}`; g.textBaseline = 'middle'
      for (const [lab, T] of TENORS) {
        const iz = uOf(T) * (NZ - 1), y = (md / 2 - AZ / 2 + iz * P) * mpx
        g.fillRect(0, y - 3, w * 0.36, 6)
        g.save(); g.translate(w * 0.68, y); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(lab, 0, 0); g.restore()
      }
    }, { aniso: 8 })
    const mat = decal(mr.tex, RAIL_W, md, env, 'maturity')
    mat.rotation.x = -Math.PI / 2; mat.position.set(RAIL_X, RAIL_H + 0.0009, 0); turn.add(mat)

    // implied-vol post (back left), front face: ticks every 5 vol points at the pin height map, labels every 10
    const ppx = 1536 / POST_H
    const pr = canvasTex(Math.round(0.12 * ppx), 1536, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = INK; g.textBaseline = 'middle'
      for (let v = 10; v <= 65; v += 5) {
        const y = h - hOf(v / 100) * ppx, major = v % 10 === 0
        g.fillRect(0, y - 2, w * (major ? 0.42 : 0.24), 4)
        if (major) { g.font = `500 ${Math.round(w * 0.3)}px ${MONO}`; g.textAlign = 'right'; g.fillText(String(v), w * 0.96, y) }
      }
      g.save(); g.translate(w * 0.5, h * 0.035); g.font = `500 ${Math.round(w * 0.22)}px ${MONO}`; g.textAlign = 'center'; g.fillText('IV %', 0, 0); g.restore()
    }, { aniso: 8 })
    const post = decal(pr.tex, 0.12, POST_H, env, 'post')
    post.position.set(POST_X, POST_H / 2, POST_Z + 0.06 + 0.0009); turn.add(post)

    // fascia: the instrument's plate on the right (the honesty label); the dial names are the DOM labels under the knobs
    const fpx = 3072 / FAS_W
    const fr = canvasTex(3072, Math.round(FAS_H * fpx), (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = INK; g.textBaseline = 'alphabetic'; g.textAlign = 'left'
      const X = (x: number) => (x + FAS_W / 2) * fpx, Y = (y: number) => (FAS_H / 2 - (y - FAS_Y)) * fpx
      // (the dials are named by the DOM labels under them, once: an engraved copy would only repeat them in small dark letters)
      const px0 = X(0.35)
      g.fillRect(px0, Y(FAS_Y + 0.14), 0.004 * fpx, 0.28 * fpx)
      g.font = `500 ${Math.round(0.058 * fpx)}px ${MONO}`; (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.round(0.012 * fpx)}px`
      g.fillText('VOLATILITY INSTRUMENT', px0 + 0.06 * fpx, Y(FAS_Y + 0.06))
      g.font = `500 ${Math.round(0.031 * fpx)}px ${MONO}`; (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${Math.round(0.006 * fpx)}px`
      g.fillText('SIMULATION · SSVI, GATHERAL AND JACQUIER 2014', px0 + 0.06 * fpx, Y(FAS_Y - 0.03))
      g.fillText('A PUBLIC MODEL, NOT QVR DATA', px0 + 0.06 * fpx, Y(FAS_Y - 0.085))
    }, { aniso: 8 })
    const fas = decal(fr.tex, FAS_W, FAS_H, env, 'fascia', 0.6)
    fas.position.set(0, FAS_Y, FZ + FAS_T + 0.0009); turn.add(fas)

    // dial rings: 25 ticks over the sweep on the brushed face, one texture, three discs in one mesh
    const rg = canvasTex(512, 512, (g, w) => {
      g.clearRect(0, 0, w, w); g.fillStyle = INK; const cx = w / 2, R = w / 2
      for (let j = 0; j <= 24; j++) {
        const a = (-SWEEP + j * STEP) * Math.PI / 180, major = j % 6 === 0
        const r0 = R * (major ? 0.74 : 0.8), r1 = R * 0.93
        g.save(); g.translate(cx, cx); g.rotate(a); g.fillRect(-(major ? 3.2 : 2), -r1, major ? 6.4 : 4, r1 - r0); g.restore()
      }
    }, { aniso: 8 })
    const discs = DIAL_X.map(x => { const d = new THREE.CircleGeometry(DIAL_R, 48); d.translate(x, DY, FZ + FAS_T + 0.0125); return d })
    const ringMat = lit(own(new THREE.MeshStandardMaterial({ map: rg.tex, transparent: true, roughness: 0.55, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }), 0.6), 'qvr-decal-ring')
    turn.add(new THREE.Mesh(mergeGeos(discs), ringMat))
    // knob index lines in violet enamel (the stop's accent marks the active parts only)
    const idxMat = lit(new THREE.MeshBasicMaterial({ color: VIOLET }), 'qvr-index')
    for (const k of knobs) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.07), idxMat); l.position.set(0, 0.052, KNOB_L + 0.0016); k.add(l) }

    // first frame state: the pins at rest on the deck (the entrance raises them)
    for (const p of proxies) p.y = 0.05
    for (const [i, d] of DIALS.entries()) if (knobs[i]) knobs[i].rotation.z = -THREE.MathUtils.degToRad(degOf(d, val[d.k]))
    turn.visible = true
    c.prewarm(root)
    ready = true
    inst.dust = 0.1
  })()

  // -------------------------------------------------------------------------------------------- the pins: entrance (scrubbed), dial ripples (anime)
  let ripple: JSAnimation | null = null
  let owner: 'flight' | 'anime' = 'flight'
  const dEnter = new Float32Array(NX * NZ)
  for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) dEnter[iz * NX + ix] = Math.hypot(ix / (NX - 1) - 0.5, iz / (NZ - 1) - 0.5) / Math.SQRT1_2
  /** re-solve the surface and send the pins to it: a grid stagger from cell `from` (reduced motion: they jump) */
  let lastRipple = 0, pendingFrom = -1, rippleTimer = 0
  /** where pin i belongs: the surface, and in the walkthrough's first step the one pin it speaks of stands a little proud of it */
  const RISE = 0.3
  const hOfPin = (i: number) => H[i] + (tourPhase === 0 && i === TOUR_PIN ? RISE : 0)
  const rippleTo = (from: number) => {
    solve()
    if (!pins || owner !== 'anime') return
    const now = performance.now()
    if (now - lastRipple < 90) { pendingFrom = from; if (!rippleTimer) rippleTimer = window.setTimeout(() => { rippleTimer = 0; const f = pendingFrom; pendingFrom = -1; if (f >= 0) rippleTo(f) }, 90); return }
    lastRipple = now
    if (rm()) { ripple?.cancel(); ripple = null; for (let i = 0; i < proxies.length; i++) proxies[i].y = hOfPin(i); return }
    ripple = animate(proxies, {
      y: ((_: unknown, i: number) => hOfPin(i)) as unknown as number,
      delay: stagger(9, { grid: [NX, NZ], from }),
      ease: spring({ duration: 360, bounce: 0.3 }),
      composition: 'replace',
    })
  }

  // -------------------------------------------------------------------------------------------- DOM: the interface layer (one data-proof="skip" root)
  const layer = document.createElement('div')
  layer.className = 'qvr-ui'; layer.setAttribute('data-proof', 'skip')
  const axes = new Axes(layer)
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement = layer) => { const e = document.createElement(tag); e.className = cls; parent.append(e); return e }
  const read = el('div', 'qvr-read'); read.setAttribute('aria-hidden', 'true')
  const ring = el('div', 'qvr-ring'); ring.setAttribute('aria-hidden', 'true'); const ringI = el('i', '', ring)
  const lead = el('div', 'qvr-lead'); lead.setAttribute('aria-hidden', 'true')   // phone: a hairline from the docked tag to the pin's ring
  const ctl = el('div', 'qvr-ctl')
  const tourBtn = el('button', 'qvr-btn go', ctl); tourBtn.type = 'button'; tourBtn.setAttribute('aria-expanded', 'false'); tourBtn.textContent = 'Take the tour'
  tourBtn.title = 'Four short steps: what a pin is, what height means, why the surface leans, what a shock does'
  const shockBtn = el('button', 'qvr-btn', ctl); shockBtn.type = 'button'; shockBtn.setAttribute('aria-pressed', 'false')
  shockBtn.innerHTML = '<svg viewBox="0 0 22 12" aria-hidden="true"><path d="M1 3 L6 4 L9 2.5 L12 10.5 L15 7 L21 8.5"/></svg><span class="qlb">Market shock</span>'
  shockBtn.title = 'Simulated: a sudden scare lifts the whole surface, short-dated pins first, then it settles back'
  const turnWrap = el('label', 'qvr-turn', ctl)
  const turnIn = document.createElement('input'); turnIn.type = 'range'; turnIn.min = '-70'; turnIn.max = '70'; turnIn.step = '5'
  turnIn.setAttribute('aria-label', 'Turn the instrument')
  const turnTag = document.createElement('span'); turnTag.setAttribute('aria-hidden', 'true')
  turnWrap.append(turnIn, turnTag)
  const foot = el('div', 'qvr-foot')
  const words = el('div', 'qvr-words', foot)
  const sim = el('div', 'qvr-sim', foot)
  const SIM_TEXT = 'Simulation · SSVI, a public model, not QVR data'
  sim.textContent = SIM_TEXT
  let shocked = false, shown = false, broken = false
  // the market shock's state (below); declared before the dials, whose first setDeg reads it
  const SHOCK = { level: 0.28, slope: -0.38, rho: -0.86 }   // about 3% of the pins hit the scale's top (the lid), the long end sinks a little
  const jolt = { y: 0, rx: 0 }, heat = { k: 0 }
  const H0 = new Float32Array(NX * NZ)
  let shockTimer = 0, heatOn = false
  const shockAnims: JSAnimation[] = []
  let settle: JSAnimation | null = null

  // ---- pin colours: ONE writer. Brass, then the walkthrough's height ramp / lean / sweep, a dial's glow, the shock's heat, a hovered pin's row and column
  const brassC = new THREE.Color(0.9, 0.68, 0.36), hiC = new THREE.Color(1.15, 0.86, 1.5), sliceC = new THREE.Color(1.02, 0.8, 0.5)
  const heatC = new THREE.Color(0.98, 0.62, 1.45), hotC = new THREE.Color(1.0, 0.74, 1.4), tint = new THREE.Color()
  let hoverPin = -1, tapPin = -1, tapUntil = 0, stickyPin = -1
  let colourMode: 'none' | 'height' | 'one' = 'none'
  const fx = { lean: 0, band: -1, glow: 0 }
  let glowKind: DialDef['k'] | null = null, colourDirty = true, wasBusy = false
  /** how much of the surface a turning dial lights: the whole of it (level), the left falling to the right (skew), the two wings (smile) */
  const glowW = (k: DialDef['k'], ix: number): number => {
    const u = ix / (NX - 1)
    return k === 'theta' ? 0.55 : k === 'rho' ? (1 - u) * (1 - u) : Math.pow(Math.abs(u - 0.5) * 2, 1.6)
  }
  function recolor() {
    if (!pins) return
    const busy = heatOn || colourMode !== 'none' || fx.lean > 0.001 || fx.band >= 0 || fx.glow > 0.001 || hoverPin >= 0 || stickyPin >= 0
    if (!busy && !colourDirty && !wasBusy) return
    for (let i = 0; i < proxies.length; i++) {
      const ix = i % NX, iz = (i / NX) | 0
      tint.copy(brassC)
      if (colourMode === 'height') tint.lerp(hotC, clamp01((proxies[i].y - 0.05) / 1.35))
      else if (colourMode === 'one') tint.multiplyScalar(0.34)
      if (fx.lean > 0.001) { const w = 1 - ix / (NX - 1); tint.lerp(hotC, fx.lean * w * w * 0.9) }
      if (fx.band >= 0) { const d = (iz - fx.band) / 2.2; tint.lerp(hotC, Math.exp(-d * d) * 0.85) }
      if (fx.glow > 0.001 && glowKind) tint.lerp(hotC, fx.glow * glowW(glowKind, ix))
      if (heatOn) tint.lerp(heatC, Math.min(1, Math.abs(proxies[i].y - H0[i]) * 1.6) * heat.k)
      pins.setColorAt(i, tint)
    }
    if (!heatOn) {
      if (hoverPin >= 0) {
        const ix = hoverPin % NX, iz = (hoverPin / NX) | 0
        for (let x = 0; x < NX; x++) pins.setColorAt(iz * NX + x, sliceC)
        for (let z = 0; z < NZ; z++) pins.setColorAt(z * NX + ix, sliceC)
        pins.setColorAt(hoverPin, hiC)
      }
      if (stickyPin >= 0) pins.setColorAt(stickyPin, hiC)
    }
    pins.instanceColor!.needsUpdate = true
    colourDirty = false; wasBusy = busy
  }
  const setHover = (i: number) => { if (i !== hoverPin) { hoverPin = i; colourDirty = true } }
  let glowTimer = 0, litTimer = 0, glowAnim: JSAnimation | null = null
  /** a dial turned: its part of the surface glows for a moment and its axis lights up */
  const dialGlow = (k: DialDef['k']) => {
    if (glowKind !== k) { glowKind = k; fx.glow = 0 }
    glowAnim?.cancel()
    if (rm()) fx.glow = 0.8; else glowAnim = animate(fx, { glow: 0.8, duration: 160, ease: 'out(2)' })
    axes.light(k === 'theta' ? ['vol'] : ['strike'])
    window.clearTimeout(glowTimer); window.clearTimeout(litTimer)
    glowTimer = window.setTimeout(() => {
      glowAnim?.cancel()
      if (rm()) fx.glow = 0; else glowAnim = animate(fx, { glow: 0, duration: 700, ease: 'out(2)' })
    }, 800)
    litTimer = window.setTimeout(() => axes.light(tourLight), 1000)
  }

  // ---- the words under each knob (the Greek letters are the small print)
  const kl: HTMLDivElement[] = [], klW: HTMLElement[] = [], klV: HTMLElement[] = [], uiTag: HTMLElement[] = [], uiInput: HTMLInputElement[] = []
  const effective = (d: DialDef) => (d.k === 'theta' ? params.level : d.k === 'rho' ? params.rho : params.eta)
  function updateWords() {
    DIALS.forEach((d, i) => {
      const v = effective(d), w = d.word(v), line = d.line(v) + (d.k === 'eta' && etaHeld && !shocked ? CAPPED : '')
      if (klW[i]) { klW[i].textContent = w; klV[i].textContent = `${d.sym} ${d.fmt(v)}` }
      if (uiTag[i]) uiTag[i].innerHTML = `<b>${d.name}: ${w}</b>${line}<small>${d.sym} ${d.fmt(v)}</small>`
      uiInput[i]?.setAttribute('aria-valuetext', `${w}. ${line}`)
    })
    words.innerHTML = DIALS.map(d => `${d.name} <b>${d.word(effective(d))}</b>`).join('&nbsp;&nbsp;·&nbsp;&nbsp;')
    sim.textContent = shocked ? 'Simulated market shock, it settles back by itself' : SIM_TEXT
  }

  // the walkthrough's state (read by the dials' first setDeg, so declared before them)
  let tourPhase = -1
  let tourLight: ('strike' | 'time' | 'vol')[] = []
  const tourFx: JSAnimation[] = []
  let ringAnim: JSAnimation | null = null
  const rawDeg = (d: DialDef, v: number) => ((v - d.min) / (d.max - d.min)) * 270 - SWEEP
  const TOUR_PIN = Math.round(uOf(0.25) * (NZ - 1)) * NX + Math.round(ATM_FRAC * (NX - 1))
  const flatH = (_: unknown, i: number) => H[i]
  let mark: ReturnType<typeof tryMark> | null = null
  document.body.append(layer)
  interface DialUI { el: HTMLDivElement; rotor: HTMLDivElement; input: HTMLInputElement; tag: HTMLSpanElement; drag: Draggable | null; deg: number; tx: number; ty: number; away: boolean }
  const dialUI: DialUI[] = DIALS.map((d, i) => {
    const e = el('div', 'qvr-dial'); e.dataset.k = d.k
    const rotor = el('div', 'rotor', e)
    const input = el('input', '', e); input.type = 'range'; input.min = '0'; input.max = '24'; input.step = '1'
    input.setAttribute('aria-label', `${d.name}, the ${d.sym} knob`)
    const tag = el('span', 'tag', e); tag.setAttribute('aria-hidden', 'true')
    const sym = el('span', 'sym', e); sym.setAttribute('aria-hidden', 'true'); sym.textContent = d.name
    // the name and the word under the knob
    const lab = el('div', 'qvr-kl'); lab.setAttribute('aria-hidden', 'true')
    lab.innerHTML = `<span class="n">${d.name}</span><span class="w"></span><span class="v"></span>`
    kl[i] = lab; klW[i] = lab.querySelector('.w') as HTMLElement; klV[i] = lab.querySelector('.v') as HTMLElement; uiTag[i] = tag; uiInput[i] = input
    const ui: DialUI = { el: e, rotor, input, tag, drag: null, deg: degOf(d, val[d.k]), tx: NaN, ty: NaN, away: false }
    const setDeg = (deg: number, fromIdx: number) => {
      deg = Math.max(-SWEEP, Math.min(SWEEP, Math.round(deg / STEP) * STEP))
      const changed = deg !== ui.deg
      ui.deg = deg
      if (shocked || shockTimer || shockAnims.length) cancelShock()
      if (changed && tourPhase >= 0 && tourPhase !== 0) stopTourFx(true)
      val[d.k] = valOf(d, deg); apply()
      if (knobs[i]) knobs[i].rotation.z = -THREE.MathUtils.degToRad(deg)
      input.value = String(Math.round((deg + SWEEP) / STEP))
      updateWords()
      if (changed) { rippleTo(fromIdx); mark?.dismiss(); dialGlow(d.k); lab.classList.add('hot'); window.setTimeout(() => lab.classList.remove('hot'), 900); if (shown) c.emit('hub:detent') }
    }
    const from = (NZ - 1) * NX + Math.max(0, Math.min(NX - 1, ixOf(DIAL_X[i])))
    setDeg(ui.deg, from)
    ui.drag = createDraggable(rotor, {
      x: { mapTo: 'rotate', snap: STEP },
      y: false,
      container: [0, SWEEP, 0, -SWEEP],
      containerFriction: 0.9,
      dragSpeed: 0.9,
      velocityMultiplier: rm() ? 0 : 0.35,
      releaseEase: spring({ duration: 520, bounce: 0.18 }),
      onGrab: () => { e.classList.add('turning') },
      onUpdate: dd => setDeg(dd.x, from),
      onSettle: dd => { setDeg(dd.x, from); e.classList.remove('turning') },
      onRelease: () => { window.setTimeout(() => e.classList.remove('turning'), 900) },
    })
    ui.drag.setX(ui.deg)
    // keyboard: the native range input (arrows, Home, End); the flight and the point-of-view keys ignore keys aimed at an input
    input.addEventListener('input', () => {
      const deg = -SWEEP + Number(input.value) * STEP
      ui.drag?.setX(deg)
      setDeg(deg, from)
    })
    return ui
  })
  // the tour card and the walkthrough's scene (the card is built after the dials: its callbacks read them)
  function stopTourFx(restore: boolean) {
    for (const a of tourFx) a.cancel()
    tourFx.length = 0
    ringAnim?.cancel(); ringAnim = null; ringI.style.opacity = '0'
    fx.lean = 0; fx.band = -1; colourMode = 'none'; stickyPin = -1; colourDirty = true
    tourLight = []; axes.light([])
    if (shocked || shockAnims.length) cancelShock()
    tourPhase = -1
    if (restore) {
      apply(); solve()
      knobs.forEach((k, i) => { k.rotation.z = -THREE.MathUtils.degToRad(dialUI[i].deg) })
      updateWords()
      rippleTo(Math.floor(NZ / 2) * NX + Math.floor(NX / 2))
    }
  }
  function tourStep(i: number, from: number) {
    if (from >= 0) stopTourFx(true)
    tourPhase = i
    mark?.dismiss()
    if (!pins || owner !== 'anime') return
    ripple?.cancel(); ripple = null
    const lights: Record<number, ('strike' | 'time' | 'vol')[]> = { 0: ['strike', 'time'], 1: ['vol'], 2: ['strike', 'time'], 3: ['time'] }
    tourLight = lights[i] ?? []; axes.light(tourLight)
    if (i === 0) {
      // one pin: lit, ringed, tagged, and raised
      stickyPin = TOUR_PIN; colourMode = 'one'; colourDirty = true
      if (rm()) { ringI.style.opacity = '0.9'; proxies[TOUR_PIN].y = H[TOUR_PIN] + RISE }
      else {
        ringAnim = animate(ringI, { scale: [1, 2.4], opacity: [0.95, 0], duration: 1400, ease: 'out(2)', loop: true })
        tourFx.push(ringAnim)
        // it lifts above its neighbours and stays up for the whole step, so the eye finds it at once
        tourFx.push(animate(proxies[TOUR_PIN], { y: [{ to: H[TOUR_PIN] + RISE + 0.14, duration: 260, ease: 'out(3)' }, { to: H[TOUR_PIN] + RISE, ease: spring({ duration: 420, bounce: 0.4 }) }], composition: 'replace' }))
      }
    } else if (i === 1) {
      // height: the surface drops flat and rises again row by row (a grid stagger from the back row), pins coloured by how tall they stand
      colourMode = 'height'
      if (rm()) { for (let k = 0; k < proxies.length; k++) proxies[k].y = H[k]; return }
      const lift = () => { tourFx.push(animate(proxies, { y: flatH as unknown as number, delay: stagger(26, { grid: [NX, NZ], from: 'first', axis: 'y' }), duration: 720, ease: 'out(3)', composition: 'replace' })) }
      tourFx.push(animate(proxies, { y: 0.05, duration: 240, ease: 'inOut(2)', composition: 'replace', onComplete: lift }))
    } else if (i === 2) {
      // skew: the surface starts symmetric and the left side climbs to where the Skew dial has it; then a band sweeps from the short end to the long end
      if (rm()) { fx.lean = 1; return }
      const target = val.rho, demo = { r: 0, lean: 0 }
      const sweep = () => { tourFx.push(animate(fx, { band: [0, NZ - 1], duration: 2000, ease: 'linear', onComplete: () => { fx.band = -1; colourDirty = true } })) }
      const run = () => { tourFx.push(animate(demo, {
        r: target, lean: 1, duration: 1500, ease: 'inOut(2)',
        onUpdate: () => {
          params.rho = demo.r; params.eta = Math.min(val.eta, 2 / (1 + Math.abs(demo.r))); solve()
          for (let k = 0; k < proxies.length; k++) proxies[k].y = H[k]
          fx.lean = demo.lean
          if (knobs[1]) knobs[1].rotation.z = -THREE.MathUtils.degToRad(rawDeg(DIALS[1], demo.r))
        },
        onComplete: sweep,
      })) }
      params.rho = 0; params.eta = Math.min(val.eta, 2); solve()
      tourFx.push(animate(proxies, { y: flatH as unknown as number, duration: 320, ease: 'out(3)', composition: 'replace', onComplete: run }))
    } else if (i === 3) {
      shock()
    }
  }
  const tour = new Tour(layer, {
    steps: TOUR, rm,
    onStep: (i, from) => tourStep(i, from),
    onClose: () => {
      stopTourFx(true)
      html.classList.remove('qvr-tour-on')
      tourBtn.setAttribute('aria-expanded', 'false'); ctl.classList.remove('hide'); capMeasured = 0
    },
  })
  tourBtn.addEventListener('click', () => {
    if (tour.isOpen) { tour.close('skip'); return }
    if (!ready || owner !== 'anime') return
    tourBtn.setAttribute('aria-expanded', 'true'); ctl.classList.add('hide'); capMeasured = 0
    html.classList.add('qvr-tour-on')   // phone: the stop's copy steps aside while the sheet is up (qvr-guide.css)
    tour.open(tourBtn)
  })
  updateWords()
  tour.setSim(SIM_TEXT)

  // -------------------------------------------------------------------------------------------- the market shock (simulated, and labelled so)
  // ATM vol jumps, the term structure inverts (the short end spikes most) and the skew steepens toward the bound. The pins take it as ONE mechanical
  // wave from the short-dated low-strike corner (the puts that are bid first), each on a stiff spring so it overshoots and clacks back; the
  // instrument jolts on its foot, the pins that rose run violet hot for a moment, the level and skew knobs spin to the shocked values. Then the surface
  // mean-reverts in a slower wave from the far corner and the knobs return to where the visitor left them.
  const knobDeg = (i: number) => (i === 0 ? degOf(DIALS[0], params.level) : i === 1 ? degOf(DIALS[1], params.rho) : dialUI[i].deg)
  const knobsTo = (ease: EasingParam) => knobs.forEach((k, i) => {
    const z = -THREE.MathUtils.degToRad(knobDeg(i))
    if (rm()) { k.rotation.z = z; return }
    const kz = { z: k.rotation.z }   // a plain proxy: the knob's Euler is written in onUpdate, never handed to the three adapter
    shockAnims.push(animate(kz, { z, ease, composition: 'replace', onUpdate: () => { k.rotation.z = kz.z } }))
  })
  function shock() {
    if (!ready || !pins || owner !== 'anime' || shocked) return
    cancelShock()
    shocked = true; mark?.dismiss(); setHover(-1)
    shockBtn.setAttribute('aria-pressed', 'true')
    H0.set(H)
    params.level = SHOCK.level; params.slope = SHOCK.slope; params.rho = SHOCK.rho; params.eta = Math.min(val.eta, 2 / (1 + Math.abs(SHOCK.rho)))
    solve(); updateWords()
    c.emit('land')   // the sound engine's soft 72 Hz thud, under the jolt
    shockTimer = window.setTimeout(relax, rm() ? 2600 : 2300)
    ripple?.cancel(); ripple = null
    if (rm()) { for (let i = 0; i < proxies.length; i++) proxies[i].y = H[i]; knobsTo('linear'); return }
    ripple = animate(proxies, { y: flatH as unknown as number, delay: stagger(11, { grid: [NX, NZ], from: 0 }), ease: spring({ duration: 300, bounce: 0.45 }), composition: 'replace' })
    shockAnims.push(
      animate(jolt, { y: [{ to: -0.06, duration: 80, ease: 'out(2)' }, { to: 0, ease: spring({ duration: 420, bounce: 0.5 }) }], rx: [{ to: 0.02, duration: 80, ease: 'out(2)' }, { to: 0, ease: spring({ duration: 520, bounce: 0.45 }) }], composition: 'replace' }),
      animate(heat, { k: [{ to: 1, duration: 160, ease: 'out(2)' }, { to: 0, duration: 1900, ease: 'inOut(2)' }], composition: 'replace' }),
    )
    heatOn = true
    knobsTo(spring({ duration: 380, bounce: 0.3 }))
  }
  function relax() {
    shockTimer = 0
    if (!shocked) return
    shocked = false; shockBtn.setAttribute('aria-pressed', 'false')
    params.slope = DEFAULTS.slope; apply(); solve(); updateWords()
    ripple?.cancel(); ripple = null
    if (rm() || owner !== 'anime') { for (let i = 0; i < proxies.length; i++) proxies[i].y = H[i]; knobsTo('linear'); return }
    ripple = animate(proxies, { y: flatH as unknown as number, delay: stagger(8, { grid: [NX, NZ], from: NX * NZ - 1 }), duration: 1100, ease: 'inOut(3)', composition: 'replace' })
    knobsTo(spring({ duration: 700, bounce: 0.12 }))
  }
  /** drop a shock at once (a dial turned mid-shock, or the stop is leaving): the surface goes back to the dials without a wave */
  function cancelShock() {
    const had = shocked || shockAnims.length > 0
    window.clearTimeout(shockTimer); shockTimer = 0
    for (const a of shockAnims) a.cancel()
    shockAnims.length = 0
    jolt.y = 0; jolt.rx = 0; heat.k = 0
    if (shocked) { shocked = false; shockBtn.setAttribute('aria-pressed', 'false'); params.slope = DEFAULTS.slope; apply(); updateWords() }
    if (had) knobs.forEach((k, i) => { k.rotation.z = -THREE.MathUtils.degToRad(dialUI[i].deg) })
  }
  // the press ripple: Magic UI's Ripple Button (MIT, registry/magicui/ripple-button.tsx, clone cdb348c), ported to one anime.js tween on a span the
  // button owns: a disc the button's larger side across, centred on the press (the centre for a key press), scale 0 to 2 while it fades from 0.3
  const ripplePress = (btn: HTMLElement, e: MouseEvent) => {
    if (rm()) return
    const r = btn.getBoundingClientRect(), size = Math.max(r.width, r.height)
    const x = e.detail === 0 ? r.width / 2 : e.clientX - r.left, y = e.detail === 0 ? r.height / 2 : e.clientY - r.top
    const sp = document.createElement('span'); sp.className = 'rip'
    sp.style.cssText = `width:${size}px;height:${size}px;left:${x - size / 2}px;top:${y - size / 2}px`
    btn.append(sp)
    animate(sp, { scale: [0, 2], opacity: [0.3, 0], duration: 600, ease: 'out(2)', onComplete: () => sp.remove() })
  }
  shockBtn.addEventListener('click', e => { ripplePress(shockBtn, e); if (shocked) { window.clearTimeout(shockTimer); relax() } else shock() })
  tourBtn.addEventListener('click', e => ripplePress(tourBtn, e))

  // -------------------------------------------------------------------------------------------- turning: a soft range, so the fascia never faces away
  const YMIN = -1.25, YMAX = 1.25, RB = 0.3
  const rubber = (y: number) => (y < YMIN ? YMIN - RB * (1 - Math.exp(-(YMIN - y) / RB)) : y > YMAX ? YMAX + RB * (1 - Math.exp(-(y - YMAX) / RB)) : y)
  const turnText = () => {
    const deg = Math.round(THREE.MathUtils.radToDeg(st.yaw) / 5) * 5
    if (document.activeElement !== turnIn) turnIn.value = String(deg)
    turnTag.innerHTML = `Turn ← → <b>${deg}°</b>`
  }
  turnText()
  turnIn.addEventListener('input', () => {
    const to = THREE.MathUtils.degToRad(Number(turnIn.value))
    settle?.cancel(); settle = null; mark?.dismiss()
    if (rm()) st.yaw = to; else settle = animate(st, { yaw: to, ease: spring({ duration: 520, bounce: 0.14 }), composition: 'replace' })
    turnTag.innerHTML = `Turn ← → <b>${turnIn.value}°</b>`
  })

  // -------------------------------------------------------------------------------------------- pointer: drag the object to turn it, hover a pin
  const box = new THREE.Box3(new THREE.Vector3(-PL_W / 2, PL_Y0 - 0.1, -AZ / 2 - 0.7), new THREE.Vector3(PL_W / 2, 1.7, PL_Z1 + 0.2))
  const inv = new THREE.Matrix4(), lray = new THREE.Ray(), hitP = new THREE.Vector3(), tmpV = new THREE.Vector3()
  const toLocal = (ray: THREE.Raycaster) => { turn.updateWorldMatrix(true, false); inv.copy(turn.matrixWorld).invert(); lray.copy(ray.ray).applyMatrix4(inv); return lray }
  /** ray-march the pin field (local frame) and return the pin index under the ray, or -1 */
  const field = new THREE.Box3(new THREE.Vector3(-AX / 2 - 0.07, 0, -AZ / 2 - 0.07), new THREE.Vector3(AX / 2 + 0.07, 1.6, AZ / 2 + 0.07))
  const pinAt = (r: THREE.Ray): number => {
    const t0 = r.intersectBox(field, hitP)
    if (!t0) return -1
    const start = r.origin.distanceTo(hitP)
    for (let s = 0; s < 260; s++) {
      r.at(start + s * 0.02, tmpV)
      const ix = ixOf(tmpV.x), iz = Math.round((tmpV.z + AZ / 2) / P)
      if (ix < 0 || ix >= NX || iz < 0 || iz >= NZ) { if (s > 4 && (tmpV.y < 0 || Math.abs(tmpV.x) > AX / 2 + 0.2 || Math.abs(tmpV.z) > AZ / 2 + 0.2)) break; continue }
      const i = iz * NX + ix, top = proxies[i]?.y ?? H[i]
      if (tmpV.y <= top + 0.004) { const dx = tmpV.x - (-AX / 2 + ix * P), dz = tmpV.z - (-AZ / 2 + iz * P); if (dx * dx + dz * dz < 0.06 * 0.06 || tmpV.y < top - 0.02) return i }
      if (tmpV.y < 0) break
    }
    return -1
  }
  // a pin's tag, in words: strike, expiry and implied vol (simulated numbers). Hover, a tap, or the walkthrough's lit pin. It stays inside the free area
  // (below the top bar, or on a phone inside the gap between the title and the dials), beside the pin and never over the title or the console
  let readKey = '', readOn = false, readW = 200, readH = 52, readX = NaN, readY = NaN, tapRingOn = false
  const syncRead = () => {
    const now = performance.now()
    const i = !shown ? -1 : hoverPin >= 0 ? hoverPin : tapPin >= 0 && now < tapUntil ? tapPin : stickyPin
    if (i < 0) {
      lead.classList.remove('on')
      if (readOn) { readOn = false; read.classList.remove('on'); ring.style.visibility = 'hidden' }
      if (tapRingOn) { tapRingOn = false; ringI.style.opacity = '0' }
      return
    }
    const ix = i % NX, iz = (i / NX) | 0
    const key = `${i}:${IV[i].toFixed(3)}`
    if (key !== readKey) {
      readKey = key
      const K = Math.exp(kOf(ix / (NX - 1))) * 100, T = tOf(uRow(iz))
      read.innerHTML = `<span class="a">${strikeText(K)}</span><span class="a">${expiryText(T)}</span><span class="b">implied volatility <em>${(IV[i] * 100).toFixed(1)}%</em><span class="yr"> a year</span></span>`
      readW = read.offsetWidth || readW; readH = read.offsetHeight || readH
    }
    const s = pinScreen(ix, iz)
    if (!s) return
    const phone = innerWidth <= 760
    const z = phone ? phoneZones() : null
    const lo = z ? z.top : 84, hi = z ? z.bot : innerHeight - 8
    let x = Math.round(Math.max(8, Math.min(innerWidth - readW - 8, s[0] + 18 + readW > innerWidth - 8 ? s[0] - 18 - readW : s[0] + 18)))
    const above = s[1] - readH - 14
    let y = Math.round(Math.max(lo, Math.min(hi - readH, above >= lo ? above : s[1] + 18)))
    // phone: the instrument fills the band under the title, so a tag beside the pin would sit on it. It docks in the free corner right of the title instead
    // (above the instrument, clear of the heading), and a hairline leads from it to the pin's ring. Where that corner is too small (a short, narrow phone)
    // the tag stays beside the pin as before.
    let docked = false
    if (z) {
      const dx = Math.round(innerWidth - 12 - readW)
      if (dx >= z.titleRight + 10 && z.slotTop + readH <= z.top + 6) { x = dx; y = Math.round(z.slotTop); docked = true }
    }
    if (x !== readX || y !== readY) { readX = x; readY = y; read.style.transform = `translate(${x}px, ${y}px)` }
    if (docked) {
      const x0 = Math.max(x + 10, Math.min(x + readW - 10, s[0])), y0 = y + readH, vx = s[0] - x0, vy = s[1] - y0, d = Math.hypot(vx, vy), len = d - 18
      if (len > 6) { lead.style.transform = `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px) rotate(${Math.atan2(vy, vx).toFixed(4)}rad) scaleX(${(len / 100).toFixed(4)})`; lead.classList.add('on') } else lead.classList.remove('on')
    } else lead.classList.remove('on')
    // a ring marks the pin the tag speaks of when the cursor is not on it: the walkthrough's pin, or the one a finger just tapped
    const tapRing = hoverPin < 0 && stickyPin < 0 && i === tapPin
    ring.style.visibility = (stickyPin >= 0 && i === stickyPin) || tapRing ? 'visible' : 'hidden'
    ring.style.transform = `translate(${Math.round(s[0])}px, ${Math.round(s[1])}px)`
    if (tapRing && !tapRingOn) { tapRingOn = true; ringI.style.opacity = '0.85' } else if (!tapRing && tapRingOn) { tapRingOn = false; ringI.style.opacity = '0' }
    if (!readOn) { readOn = true; read.classList.add('on') }
  }
  let drag: { x0: number; yaw0: number; lastX: number; lastT: number; v: number; pin: number } | null = null
  const pointer: StagePointer = {
    hover(ray) {
      const r = toLocal(ray)
      if (!r.intersectBox(box, hitP)) { setHover(-1); return null }
      setHover(pinAt(r))
      return 'grab'
    },
    down(ray, x) {
      const r = toLocal(ray)
      if (!r.intersectBox(box, hitP)) return null
      settle?.cancel(); settle = null
      drag = { x0: x, yaw0: st.yaw, lastX: x, lastT: performance.now(), v: 0, pin: pinAt(r) }
      mark?.dismiss()
      return 'drag'
    },
    move(ray, x) {
      if (!drag) return
      const now = performance.now(), dt = Math.max(1, now - drag.lastT)
      drag.v = drag.v * 0.6 + ((x - drag.lastX) / dt) * 0.4
      drag.lastX = x; drag.lastT = now
      st.yaw = rubber(drag.yaw0 + (x - drag.x0) * 0.0085)
      setHover(-1)
    },
    up(moved) {
      if (!drag) return
      const v = drag.v, pin = drag.pin; drag = null
      if (!moved && pin >= 0) { pluck(pin); tapPin = pin; tapUntil = performance.now() + 2600; return }
      // inertia, then a spring settles the turn inside the soft range (a throw past the end springs back from it)
      const to = Math.max(YMIN, Math.min(YMAX, st.yaw + (rm() ? 0 : Math.max(-1.2, Math.min(1.2, v * 0.0085 * 260)))))
      if (rm()) { st.yaw = to; turnText(); return }
      settle = animate(st, { yaw: to, ease: spring({ duration: 900, bounce: 0.12 }), composition: 'replace', onComplete: turnText })
    },
    leave() { setHover(-1) },
  }

  /** a tap on a pin plucks it: the pin and its neighbours dip and spring back, a ring travelling out from the touched pin (the surface is unchanged) */
  function pluck(i: number) {
    if (!pins || owner !== 'anime' || rm() || shocked || tourPhase >= 1) return
    const px = i % NX, pz = (i / NX) | 0
    const dip = (j: number) => -0.16 * Math.exp(-Math.hypot((j % NX) - px, ((j / NX) | 0) - pz) / 5)
    ripple?.cancel()
    ripple = animate(proxies, {
      y: [{ to: ((_: unknown, j: number) => H[j] + dip(j)) as unknown as number, duration: 90, ease: 'out(2)' }, { to: flatH as unknown as number, ease: spring({ duration: 320, bounce: 0.5 }) }],
      delay: stagger(16, { grid: [NX, NZ], from: i }),
      composition: 'replace',
    })
    c.emit('hub:detent')
  }

  Object.defineProperty(inst, 'pointer', { get: () => (ready ? pointer : undefined) })

  // -------------------------------------------------------------------------------------------- screen positions (DOM proxies, axes, readout, probes)
  const proj = new THREE.Vector3()
  const screenOf = (o: THREE.Object3D | THREE.Vector3, out: [number, number] = [0, 0]): [number, number] | null => {
    if ((o as THREE.Object3D).isObject3D) (o as THREE.Object3D).getWorldPosition(proj); else proj.copy(o as THREE.Vector3)
    proj.project(c.camera)
    if (proj.z > 1) return null
    out[0] = (proj.x + 1) / 2 * innerWidth; out[1] = (1 - proj.y) / 2 * innerHeight
    return out
  }
  function pinScreen(ix: number, iz: number): [number, number] | null {
    const i = iz * NX + ix
    turn.updateWorldMatrix(true, false)
    return screenOf(tmpV.set(-AX / 2 + ix * P, (proxies[i]?.y ?? H[i]) + 0.01, -AZ / 2 + iz * P).applyMatrix4(turn.matrixWorld))
  }
  const knobFront = new THREE.Vector3(), kxy: [number, number][] = [[0, 0], [0, 0], [0, 0]]
  const camP = new THREE.Vector3(), knobN = new THREE.Vector3(), toCam = new THREE.Vector3(), facing = [1, 1, 1]
  const restA = new THREE.Vector3(), Y_AXIS = new THREE.Vector3(0, 1, 0), cornerV = new THREE.Vector3()
  const capXY = [NaN, NaN, NaN, NaN, NaN, NaN]
  // the plinth's bottom outline (foot included), for keeping the DOM under it
  const PL_Z0 = -AZ / 2 - 0.62, BOT: [number, number][] = [[-PL_W / 2, PL_Z0], [PL_W / 2, PL_Z0], [PL_W / 2, PL_Z1], [-PL_W / 2, PL_Z1]]
  const botS: [number, number][] = [[0, 0], [0, 0], [0, 0], [0, 0]]
  let botOk = false
  /** project the plinth's bottom outline once per frame (lowestUnder then costs nothing, however many places it is asked about) */
  const projectBottom = () => {
    botOk = true
    for (let j = 0; j < 4; j++) if (!screenOf(cornerV.set(BOT[j][0], PL_Y0 - 0.09, BOT[j][1]).applyMatrix4(turn.matrixWorld), botS[j])) { botOk = false; break }
  }
  /** the lowest screen y of the plinth's bottom outline over the screen columns x0..x1 (-Infinity where it does not reach them) */
  const lowestUnder = (x0: number, x1: number) => {
    if (!botOk) return -Infinity
    let m = -Infinity
    for (let j = 0; j < 4; j++) {
      const [ax, ay] = botS[j], [bx, by] = botS[(j + 1) % 4]
      const lo = Math.max(x0, Math.min(ax, bx)), hi = Math.min(x1, Math.max(ax, bx))
      if (lo > hi) continue
      if (Math.abs(bx - ax) < 1e-3) { m = Math.max(m, ay, by); continue }
      const k = (by - ay) / (bx - ax)
      m = Math.max(m, ay + k * (lo - ax), ay + k * (hi - ax))
    }
    return m
  }

  // ---- the axes: end points in the object's own frame (strike along the front strip of the plinth, expiry down the right strip, volatility up beside the post)
  const SZ = AZ / 2 + 0.66, TX = RAIL_X + 0.22, STRIP_Y = PL_Y1 + 0.006, VX = POST_X - 0.32
  const aStrike: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(-AX / 2, STRIP_Y, SZ), new THREE.Vector3(AX / 2, STRIP_Y, SZ)]
  const aTime: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(TX, STRIP_Y, AZ / 2), new THREE.Vector3(TX, STRIP_Y, -AZ / 2)]
  const aVol: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(VX, 0.01, POST_Z), new THREE.Vector3(VX, POST_H + 0.02, POST_Z)]
  // the height ruler's marks: where an implied vol of 20, 40 and 60 % stands (the same height map as the pins)
  const aMarks = [0.2, 0.4, 0.6].map(v => new THREE.Vector3(VX, hOf(v), POST_Z))
  const mS: P2[] = [[0, 0], [0, 0], [0, 0]]
  const marksOf = (): P2[] | null => {
    for (let k = 0; k < VOL_MARKS.length; k++) if (!screenOf(cornerV.copy(aMarks[k]).applyMatrix4(turn.matrixWorld), mS[k])) return null
    return mS
  }
  const pS: [P2, P2, P2, P2, P2, P2] = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], ctrS: P2 = [0, 0]
  const axisPair = (v: [THREE.Vector3, THREE.Vector3], a: P2, b: P2): [P2, P2] | null => {
    const s0 = screenOf(cornerV.copy(v[0]).applyMatrix4(turn.matrixWorld), a), s1 = screenOf(cornerV.copy(v[1]).applyMatrix4(turn.matrixWorld), b)
    return s0 && s1 ? [a, b] : null
  }

  // ---- fit: the whole object is kept inside the band between the top bar and the console, wherever the window is short (measured at the rest pose
  // with the fit undone, then scaled about the object's origin and lifted: two numbers, smoothed)
  const fitS = { v: 1, t: 1 }, fitL = { v: 0, t: 0 }
  let fitSig = '', fitKnown = false
  // the object's own extent: the plinth's outline (foot included) and the glass lid
  const bcorners: THREE.Vector3[] = []
  for (const x of [-PL_W / 2, PL_W / 2]) for (const y of [PL_Y0 - 0.09, 1.72]) for (const z of [PL_Z0, PL_Z1]) bcorners.push(new THREE.Vector3(x, y, z))
  const rulerTip = new THREE.Vector3(VX, POST_H + 0.1, POST_Z)   // the height ruler's arrow tip stands at the top of the post (phone fit only: the desktop fit is unchanged)
  const o0 = new THREE.Vector3(), o1 = new THREE.Vector3(), o2 = new THREE.Vector3(), q0: P2 = [0, 0]
  /** the callout's left limit: it stands above the copy's title and may reach a little into the lane's margin; on a landscape window narrower than 1.55:1 the title stands higher
   *  (it follows the window's height), so the callout keeps to the free region beside the lane instead (layout.ts freeRegion, faded in with the framing) */
  const calloutMinX = () => { const x = Math.min(500, innerWidth * 0.34) - 30, fr = freeRegion('surface'); return fr ? x + (fr.a - x) * fr.t : x }
  function measureFit(phone: boolean) {
    const z = phone ? phoneZones() : null
    const sig = `${innerWidth}x${innerHeight}:${root.scale.x.toFixed(4)}:${c.camera.position.x.toFixed(2)},${c.camera.position.y.toFixed(2)},${c.camera.position.z.toFixed(2)}${z ? `:${Math.round(z.top)},${Math.round(z.bot)}` : ''}`
    if (sig === fitSig) return
    fitSig = sig
    const sv = face.scale.x, lv = face.position.y, yv = turn.rotation.y, py = turn.position.y, tv = tilt.rotation.x
    // the desktop fit measures the entrance pose (turn 0.35 lower than where the stage is held); a phone has no slack for that difference, so it measures the held pose
    face.scale.setScalar(1); face.position.y = 0; turn.rotation.y = YAW0; turn.position.y = z ? 0 : -0.35; tilt.rotation.x = TILT
    root.updateWorldMatrix(true, true)
    let top = Infinity, bot = -Infinity, lft = Infinity, rgt = -Infinity, ok = true
    for (const v of z ? [...bcorners, rulerTip] : bcorners) { const s = screenOf(cornerV.copy(v).applyMatrix4(turn.matrixWorld), q0); if (!s) { ok = false; break } top = Math.min(top, s[1]); bot = Math.max(bot, s[1]); lft = Math.min(lft, s[0]); rgt = Math.max(rgt, s[0]) }
    // the gain: screen pixels per root unit of lift, and the origin's screen position
    face.getWorldPosition(o0); const sy0 = screenOf(o2.copy(o0), q0) ? q0[1] : 0, sx0 = q0[0]
    o1.copy(o0).y += 0.5; const sy1 = screenOf(o1, q0) ? q0[1] : sy0
    face.scale.setScalar(sv); face.position.y = lv; turn.rotation.y = yv; turn.position.y = py; tilt.rotation.x = tv
    if (!ok || !isFinite(top) || !isFinite(bot) || sy1 === sy0) return
    const gain = ((sy1 - sy0) / 0.5) * root.scale.x   // screen px per root unit of lift (negative: up is toward smaller y)
    const pillTop = (() => { const n = document.querySelector('#hud .next') as HTMLElement | null; const r = n?.getBoundingClientRect(); return r && r.width > 4 && innerWidth > 1100 ? r.top : innerHeight - 64 })()
    // phone: the band between the title (the copy's own head) and the console, which sits just above the copy; desktop: between the top bar and the console
    const topT = z ? z.top : 92
    const botT = z ? z.bot : pillTop - 12 - 150
    const h0 = bot - top, avail = Math.max(z ? 70 : 120, botT - topT)
    // wave 24: on a landscape window narrower than 1.55:1 the object also has to fit the free region beside the copy lane (layout.ts freeRegion), scaled about its origin like the
    // height; the stage's own scale (stages.ts) has already brought it close, this takes up what its nominal size misses (the foot, the lid, the pose's turn)
    const fr = z ? null : freeRegion('surface')
    let Sx = 1
    if (fr && sx0 > lft && rgt > sx0) Sx = 1 + (Math.min(1, (sx0 - fr.a) / (sx0 - lft), (fr.b - sx0) / (rgt - sx0)) - 1) * fr.t
    const S = Math.max(z ? 0.4 : 0.6, Math.min(1, avail / h0, Sx))
    const nTop = sy0 + (top - sy0) * S, nBot = sy0 + (bot - sy0) * S
    // centre the scaled box in the band (or push it up just enough, when it is the shorter of the two)
    const want = Math.min(topT + (avail - (nBot - nTop)) / 2, botT - (nBot - nTop))
    const shiftPx = want - nTop
    // a phone has to be able to push the instrument well below where the camera rests it (the title and the stop's copy own the rest of the screen)
    fitS.t = S; fitL.t = Math.max(z ? -2.6 : -0.8, Math.min(1.6, shiftPx / gain))
    if (!fitKnown) { fitKnown = true; fitS.v = fitS.t; fitL.v = fitL.t }
  }

  // ---- obstacles: the HUD pieces and the lit TV's label the console must stay clear of (read every quarter second)
  interface R { l: number; t: number; r: number; b: number }
  let obsAt = 0, obsRects: R[] = []
  const rectOf = (e: Element | null, pad = 0): R | null => {
    if (!e) return null
    const b = e.getBoundingClientRect()
    if (b.width < 2 || b.height < 2) return null
    const cs = getComputedStyle(e)
    if (cs.visibility === 'hidden' || +cs.opacity < 0.05) return null
    return { l: b.left - pad, t: b.top - pad, r: b.right + pad, b: b.bottom + pad }
  }
  const obstacles = (): R[] => {
    const now = performance.now()
    if (now - obsAt > 250) {
      obsAt = now; obsRects = []
      const add = (r: R | null) => { if (r) obsRects.push(r) }
      document.querySelectorAll('#anchors .an.vis .lb').forEach(n => add(rectOf(n, 8)))
      add(rectOf(document.querySelector('#hud .next'), 8)); add(rectOf(document.querySelector('#hud .ct'), 8)); add(rectOf(document.querySelector('#pov-hint.on'), 6))
      const tv = (window as unknown as { __v3?: { world?: { screenRect?: (id: string) => DOMRect | null } } }).__v3?.world?.screenRect?.('qvr')
      if (tv && tv.width > 4) { const tx = (tv.left + tv.right) / 2, ty = (tv.top + tv.bottom) / 2, tr = 0.8 * Math.max(tv.width, tv.height) + 12; obsRects.push({ l: tx - tr, t: ty - tr, r: tx + tr, b: ty + tr }) }   // the screen is about 60% of the bezel: pad to the bezel, then a gap
      if (innerWidth > 760) obsRects.push({ l: 0, t: 90, r: Math.min(500, innerWidth * 0.34), b: innerHeight })   // the copy lane
    }
    return obsRects
  }
  /** the top-left of a w x h block as near (cx - w / 2) as it gets that is clear of every obstacle and below the plinth; `over` is the overlap left (0: clear).
   *  The plinth's lower edge slopes, so the y each column needs is asked of the projected outline (lowestUnder) at that column */
  const clampX = (x: number, w: number) => Math.max(8, Math.min(innerWidth - w - 8, x))
  const place = (w: number, h: number, cx: number, yMin: number): { x: number; y: number; over: number } => {
    const rs = obstacles(), maxY = innerHeight - 10 - h, x0 = clampX(cx - w / 2, w)
    const overlap = (x: number, y: number) => {
      let a = 0
      for (const r of rs) { const ox = Math.min(x + w, r.r) - Math.max(x, r.l), oy = Math.min(y + h, r.b) - Math.max(y, r.t); if (ox > 0 && oy > 0) a += ox * oy }
      return a
    }
    let best = { x: x0, y: maxY, over: Infinity }
    for (let d = 0; d < innerWidth; d += 12) for (const sgn of d ? [-1, 1] : [1]) {
      const x = clampX(x0 + sgn * d, w)
      const need = Math.max(yMin, lowestUnder(x, x + w) + 14), y = Math.min(need, maxY)
      const o = overlap(x, y) + Math.max(0, need - y) * w * 4   // no room below the plinth: pushed up into it, which counts as overlap
      if (o < best.over - 1e-6) best = { x, y, over: o }
      if (o === 0) return best
    }
    return best
  }
  // the phone: the stop's copy owns the top (its head) and the bottom (its text); the instrument, its dials and its words live in the gap between them
  let zAt = 0, zHead = 112, zInfo = 0, zKick = 82, zTitleR = 160
  const phoneZones = () => {
    const now = performance.now()
    if (now - zAt > 250) {
      zAt = now
      let hb = 0, it = Infinity, kb = 0, tr = 0
      for (const ov of document.querySelectorAll('.ov.vis')) {
        const h = rectOf(ov.querySelector('.head')), n = rectOf(ov.querySelector('.info'))
        if (h) {
          hb = Math.max(hb, h.b)
          // the corner beside the title: under the kicker line, right of the widest title word (the lead line is about as wide as a short word)
          const k = rectOf(ov.querySelector('.head .kicker')); if (k) kb = Math.max(kb, k.b)
          for (const w of ov.querySelectorAll('.head .title .tl.big .dw')) { const r = rectOf(w); if (r) tr = Math.max(tr, r.r) }
          const ld = ov.querySelector('.head .title .tl.lead'); if (ld) { const rg = document.createRange(); rg.selectNodeContents(ld); const r = rg.getBoundingClientRect(); if (r.width > 2) tr = Math.max(tr, r.right) }
        }
        if (n) it = Math.min(it, n.t)
      }
      zHead = hb > 0 ? hb : 112
      zInfo = isFinite(it) ? it : innerHeight * 0.5
      zKick = kb > 0 ? kb : 82; zTitleR = tr > 0 ? tr : 160
    }
    const footTop = zInfo - 9 - footH, rowTop = footTop - 2 - 44
    return { top: Math.max(96, zHead + 8), bot: rowTop - 3, rowTop, footTop, slotTop: zKick + 8, titleRight: zTitleR }
  }
  let compact = false
  let capMeasured = 0, ctlW = 250, ctlH = 36, footW = 340, footH = 28, tourWSet = -1
  const CARD_W = [520, 450, 390, 340]

  // -------------------------------------------------------------------------------------------- hand-over and hide
  /** the stop is no longer held (the flight left it, or has not arrived): the pins belong to the flight again and everything the visitor started stops */
  function release() {
    if (owner !== 'anime') return
    owner = 'flight'; tour.close('leave'); cancelShock(); solve(); updateWords(); ripple?.cancel(); ripple = null; settle?.cancel(); settle = null; drag = null; setHover(-1); tapPin = -1
  }
  /** the interface layer on or off: the buttons, dials and the tag only exist while the stop is held and nothing covers it */
  function setShown(on: boolean) {
    if (on === shown) return
    shown = on; layer.classList.toggle('on', on)
    // the instrument labels itself (axes, scales, the plate, this console): the stop's blueprint leader would only cross the pins
    html.classList.toggle('ann-quiet', on)
    for (const u of dialUI) { u.input.tabIndex = on ? 0 : -1; u.input.disabled = !on; if (on) u.drag?.enable(); else u.drag?.disable() }
    shockBtn.tabIndex = tourBtn.tabIndex = turnIn.tabIndex = on ? 0 : -1; shockBtn.disabled = tourBtn.disabled = turnIn.disabled = !on
    if (!on) { tour.close('leave'); read.classList.remove('on'); readOn = false; ring.style.visibility = 'hidden'; setHover(-1) }
  }
  /** stages.ts: the stage went invisible. update() is not called for a hidden stage (and reduced motion removes it in one frame), so this is the only place the
   *  overlay can be taken down: without it the buttons, words and honesty line would stay over the next stop */
  function leaveStage() {
    release(); setShown(false)
    mark?.update(false, 0.016, true)
  }

  // -------------------------------------------------------------------------------------------- frame
  function update(f: StageFrame) {
    if (!ready || broken) return
    try { frame(f) } catch (e) { broken = true; turn.visible = false; inst.dust = 1; layer.remove(); html.classList.remove('ann-quiet', 'qvr-tour-on'); console.warn('[qvr] stage stopped', e) }
  }
  function frame(f: StageFrame) {
    // entrance: the instrument rises a little and settles; the pins spring up from the deck to the surface, centre first, each overshooting a
    // little like a sprung plunger (scrubbed with the leg, so scrolling back replays it in reverse)
    const a = f.arrive, d = f.depart
    const held = a > 0.97 && d < 0.02
    const phone = innerWidth <= 760
    if (a > 0.3 && d < 0.02) measureFit(phone)
    const kf = 1 - Math.exp(-f.dt / 0.18)
    fitS.v += (fitS.t - fitS.v) * kf; fitL.v += (fitL.t - fitL.v) * kf
    face.scale.setScalar(fitS.v); face.position.y = fitL.v
    turn.position.y = -0.35 * (1 - easeOutCubic(clamp01(a / 0.8))) - 0.25 * easeInCubic(clamp01(d / 0.9)) + jolt.y
    turn.rotation.y = st.yaw
    tilt.rotation.x = TILT + jolt.rx
    if (held) {
      if (owner !== 'anime') { owner = 'anime'; for (let i = 0; i < proxies.length; i++) proxies[i].y = H[i] }
    } else {
      release()
      const rmNow = f.reduced
      for (let i = 0; i < proxies.length; i++) {
        const e = rmNow ? 1 : easeOutBack(clamp01((a - 0.3 - 0.3 * dEnter[i]) / 0.3), 2.2) * (1 - easeInCubic(clamp01((d - 0.05 * dEnter[i]) / 0.45)))
        proxies[i].y = 0.05 + (H[i] - 0.05) * e
      }
    }
    // the shock's heat fades with its envelope; every colour then comes from the one writer
    if (heatOn && heat.k < 0.002 && !shocked) { heatOn = false; colourDirty = true }
    recolor()
    // DOM: dial proxies over the knobs, the console under the plinth; only while the stop is held and nothing covers it
    const covered = html.classList.contains('in-index') || html.classList.contains('is-loading') || !!(window as unknown as { __v3?: { caseView?: { isOpen?: () => boolean } } }).__v3?.caseView?.isOpen?.()
    const on = held && !covered
    setShown(on)
    if (on) {
      turn.updateWorldMatrix(true, true)
      const small = phone || innerWidth < 1000
      layer.classList.toggle('phone', phone)
      // desktop: an invisible 44 px proxy over each 3D knob. Phone: the knobs are about 35 px apart there, so the proxies become a visible row of
      // three 44 px rings (named) with the two buttons beside them, just under the plinth
      let ky = 0, n = 0
      c.camera.getWorldPosition(camP)
      knobs.forEach((k, i) => {
        knobFront.set(0, 0, KNOB_L); k.localToWorld(knobFront)
        // a knob turned away from the camera gives up its proxy (the soft turn range keeps them in view, this covers the rubber band)
        facing[i] = knobN.set(0, 0, 1).transformDirection(k.matrixWorld).dot(toCam.copy(camP).sub(knobFront).normalize())
        const s = screenOf(knobFront, kxy[i]); if (!s) return
        ky = Math.max(ky, s[1]); n++
      })
      // measured sizes (the words change, the window changes)
      const now = performance.now()
      if (now - capMeasured > 300) {
        capMeasured = now
        ctlW = ctl.offsetWidth || ctlW; ctlH = ctl.offsetHeight || ctlH; footW = foot.offsetWidth || footW; footH = foot.offsetHeight || footH
        const wantL = phone ? 'Tour' : 'Take the tour', wantS = phone ? 'Shock' : 'Market shock'
        if (tourBtn.textContent !== wantL) tourBtn.textContent = wantL
        const sl = shockBtn.querySelector('.qlb'); if (sl && sl.textContent !== wantS) sl.textContent = wantS
      }
      // the console block: the buttons (or the tour card in their place), then the honesty line and, on a phone, the words
      const rowX = innerWidth / 2
      let cx = 0, cy = 0, fx0 = 0, fy0 = 0
      projectBottom()
      if (phone) {
        // one 44 px row: [ring ring ring] [Tour] [Shock], the words and the honesty line under it: all between the copy's title above and its text below
        const z = phoneZones()
        const ringsW = 3 * 44 + 2 * 8, totalW = ringsW + 14 + ctlW
        const x0 = Math.max(10, rowX - totalW / 2)
        cx = x0 + ringsW + 14; cy = z.rowTop
        fx0 = rowX - footW / 2; fy0 = z.footTop
        if (n === knobs.length) dialUI.forEach((u, i) => {
          const tx = Math.round(x0 + 22 + i * 52), ty = Math.round(z.rowTop + 22)
          if (tx !== u.tx || ty !== u.ty) { u.tx = tx; u.ty = ty; u.el.style.transform = `translate(${tx}px, ${ty}px)` }
          if (u.away) { u.away = false; u.el.classList.remove('away') }
        })
      } else {
        // under the plinth, in front of the fascia, clear of the HUD pieces, the lit TV and its label. The walkthrough card takes the buttons' place, as wide as
        // the gap allows (widest first); whichever width finds a clear spot wins, otherwise the one that overlaps least
        restA.set(0.4, PL_Y0 - 0.12, PL_Z1).applyAxisAngle(Y_AXIS, YAW0); restA.y += turn.position.y
        tilt.updateWorldMatrix(true, false)
        const cs = screenOf(restA.applyMatrix4(tilt.matrixWorld))
        const x = cs ? Math.max(130, Math.min(innerWidth - 130, cs[0])) : rowX
        const yMin = cs ? cs[1] + 18 : 0
        if (tour.isOpen) {
          let best: { x: number; y: number; over: number; w: number } | null = null
          for (const w0 of CARD_W) {
            const w = Math.min(w0, innerWidth - 24), sp = place(w, tour.sizeFor(w), x, yMin)
            if (!best || sp.over < best.over) best = { ...sp, w }
            if (sp.over === 0) break
          }
          if (best!.w !== tourWSet) { tourWSet = best!.w; tour.el.style.width = `${best!.w}px` }
          cx = best!.x; cy = best!.y
        } else {
          const bw = Math.max(ctlW, footW), bh = ctlH + 7 + footH, sp = place(bw, bh, x, yMin)
          cx = sp.x + (bw - ctlW) / 2; fx0 = sp.x + (bw - footW) / 2; cy = sp.y; fy0 = sp.y + ctlH + 7
        }
        if (n === knobs.length) dialUI.forEach((u, i) => {
          const tx = Math.round(kxy[i][0]), ty = Math.round(kxy[i][1])
          if (tx !== u.tx || ty !== u.ty) { u.tx = tx; u.ty = ty; u.el.style.transform = `translate(${tx}px, ${ty}px)` }
          const away = facing[i] < 0.3
          if (away !== u.away) { u.away = away; u.el.classList.toggle('away', away); kl[i].classList.toggle('away', away) }
        })
      }
      // the words under the knobs follow the knobs; where the knobs stand closer than a label is wide, the labels shrink to a name and a word
      if (!phone && n === knobs.length) {
        const sp = Math.min(Math.abs(kxy[1][0] - kxy[0][0]), Math.abs(kxy[2][0] - kxy[1][0])), c = sp < (compact ? 78 : 72)
        if (c !== compact) { compact = c; layer.classList.toggle('compact', c) }
      }
      // the three labels each stay under their knob, but never closer than 76 px (a compact label's 54 px plus its plate and a gap): where the knobs stand
      // closer than that the outer two labels slide outward from the middle one (at most 40 px), so the words and their plates never touch
      if (!phone && n === knobs.length) {
        const D = 76, ord = [0, 1, 2].sort((a, b) => kxy[a][0] - kxy[b][0]), cxl = [kxy[0][0], kxy[1][0], kxy[2][0]], m = kxy[ord[1]][0]
        cxl[ord[0]] = Math.max(Math.min(kxy[ord[0]][0], m - D), kxy[ord[0]][0] - 40)
        cxl[ord[2]] = Math.min(Math.max(kxy[ord[2]][0], m + D), kxy[ord[2]][0] + 40)
        kl.forEach((l, i) => { l.style.transform = `translate(${Math.round(cxl[i])}px, ${Math.round(kxy[i][1] + 30)}px)` })
      }
      // place the console block, the foot and the card
      const put = (e: HTMLElement, x: number, y: number, slot: number) => {
        const tx = Math.round(x), ty = Math.round(y)
        if (tx !== capXY[slot * 2] || ty !== capXY[slot * 2 + 1]) { capXY[slot * 2] = tx; capXY[slot * 2 + 1] = ty; e.style.transform = `translate(${tx}px, ${ty}px)` }
      }
      put(ctl, cx, cy, 0)
      put(foot, fx0, fy0, 1)
      if (tour.isOpen || tour.el.classList.contains('open')) {
        if (phone) {
          if (tourWSet !== innerWidth - 24) { tourWSet = innerWidth - 24; tour.el.style.width = `${tourWSet}px` }
          put(tour.el, 12, innerHeight - 82 - tour.sizeFor(tourWSet), 2)
        } else put(tour.el, cx, cy, 2)
      }
      // the axes, projected from the object's own frame
      const ctr = screenOf(tmpV.set(0, 0.3, 0).applyMatrix4(turn.matrixWorld), ctrS)
      axes.update({
        on: true, small, centre: ctr ? ctrS : [innerWidth / 2, innerHeight / 2], atm: ATM_FRAC,
        strike: axisPair(aStrike, pS[0], pS[1]), time: axisPair(aTime, pS[2], pS[3]), vol: axisPair(aVol, pS[4], pS[5]), marks: marksOf(), minY: phone ? phoneZones().top : 70, minX: innerWidth > 760 ? calloutMinX() : 8,   // the callout stands above the copy's title, so it may reach a little into the lane's margin
      })
      syncRead()
    }
    if (!mark && ready) mark = tryMark('qvr', 'Drag to turn · turn a dial', () => { turn.updateWorldMatrix(true, false); return tmpV.set(0.6, 1.2, 0).applyMatrix4(turn.matrixWorld) }, c.camera, VIOLET)
    mark?.update(on && !tour.isOpen, f.dt, f.reduced)
  }

  ;(window as unknown as { __qvr: unknown }).__qvr = {
    info: () => ({ ready, owner, shocked, heatOn, heat: +heat.k.toFixed(3), away: facing.map(v => +v.toFixed(2)), yaw: +st.yaw.toFixed(3), params: { ...params }, dials: dialUI.map(u => u.deg), etaHeld, calls: c.renderer.info.render.calls, h0: +H[0].toFixed(3), hMax: +Math.max(...H).toFixed(3), y0: +(proxies[0]?.y ?? 0).toFixed(3), fit: { s: +fitS.v.toFixed(3), l: +fitL.v.toFixed(3) }, tour: { open: tour.isOpen, step: tour.i, phase: tourPhase }, tag: read.textContent, words: klW.map(e => e.textContent), ctl: [capXY[0], capXY[1]], foot: [capXY[2], capXY[3]] }),
    pinScreen, centreScreen: () => { turn.updateWorldMatrix(true, false); return screenOf(new THREE.Vector3(0, 0.3, 0).applyMatrix4(turn.matrixWorld)) },
    tourPin: () => { const i = TOUR_PIN; return pinScreen(i % NX, (i / NX) | 0) },
    setParams: (p: Partial<typeof val>) => { Object.assign(val, p); apply(); rippleTo((NZ - 1) * NX) },
    rows: () => [0, 7, 14, 21, 27].map(z => +proxies[z * NX + 20].y.toFixed(3)),
    colourAt: (i: number) => { const col = new THREE.Color(); pins?.getColorAt(i, col); return [+col.r.toFixed(2), +col.g.toFixed(2), +col.b.toFixed(2)] },
    glass: () => glass?.uniforms ?? null,
    utils,
  }
  return inst
}

const def: StageDef = { id: 'surface', build: buildStage }
export default def
