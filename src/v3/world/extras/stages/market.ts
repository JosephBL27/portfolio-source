// STAGE "market" (Love Island Dynamics). Style: neon tubes and light ribbons over a drafting grid. The paper models each couple as two
// coupled equations; here the phase portrait is drawn the way a physicist sketches it, as real tube meshes in 3D: each couple's trajectory is
// INTEGRATED (RK4) from its own equation pair and swept into a glowing tube, with a curtain of light dropping from it to the floor and two
// beads riding it (the pair, joined by a thread). Four couples settle into the stable focus; one (the hot white one) has a strong enough
// feedback term that it never settles and runs a limit cycle instead. The vertical axis is the public's support, which fades on its own.
//   entrance  the plot tips up out of a flat drafting sheet while the tubes draw themselves on, one couple after another, a bright head leading
//   exit      the tails retract into the focus (the tube is consumed from its far end) while the plot spins away
// Everything is a closed-form function of (arrive, depart) and the clock; the draw-on is a uniform in the tube shader (u in [start, prog]).
import * as THREE from 'three'
import { canvasTex, clamp01, easeInCubic, easeInOutCubic, easeOutCubic, glowMat, glowSpriteMat, lit, radialTexture, rayPlaneLocal, sstep, stageTip, tryMark, type StageBuildCtx, type StageDef, type StageFrame } from './common'

interface Couple { kind: 'focus' | 'cycle'; alpha: number; omega: number; x0: number; y0: number; h0: number; c0: number; c1: number; rad: number; phase: number }
const COUPLES: Couple[] = [
  { kind: 'focus', alpha: -0.2, omega: 1.35, x0: 2.55, y0: 0.0, h0: 1.15, c0: 0xff6a8a, c1: 0xffd3de, rad: 0.06, phase: 0.0 },
  { kind: 'focus', alpha: -0.15, omega: 1.55, x0: -1.75, y0: 1.85, h0: 0.55, c0: 0xffb86b, c1: 0xffe8c6, rad: 0.06, phase: 0.31 },
  { kind: 'focus', alpha: -0.12, omega: 1.25, x0: -0.7, y0: -2.55, h0: -0.2, c0: 0x8fb8ff, c1: 0xdbe8ff, rad: 0.06, phase: 0.55 },
  { kind: 'focus', alpha: -0.1, omega: 1.45, x0: 1.45, y0: -2.2, h0: 0.85, c0: 0x7fd1c7, c1: 0xd6f6f0, rad: 0.06, phase: 0.78 },
  { kind: 'cycle', alpha: 0.35, omega: 1.7, x0: 0.35, y0: 0.1, h0: 0.35, c0: 0xf4e6c4, c1: 0xffffff, rad: 0.07, phase: 0.12 },
]
const TDUR = 14, NS = 300
const FLOOR = -1.5, BOX = { x: 3.0, z: 2.35, top: 1.8 }
const RADIAL = 6

/** RK4 on x' = a x - w y - k x r^2, y' = a y + w x - k y r^2 (k = 0 for the settling couples: a pure damped rotation, a stable focus) */
function integrate(c: Couple): THREE.Vector3[] {
  const k = c.kind === 'cycle' ? 0.12 : 0
  const f = (x: number, y: number): [number, number] => { const r2 = x * x + y * y; return [c.alpha * x - c.omega * y - k * x * r2, c.alpha * y + c.omega * x - k * y * r2] }
  let x = c.x0, y = c.y0
  const pts: THREE.Vector3[] = [], sub = 4, h = TDUR / NS / sub
  for (let i = 0; i < NS; i++) {
    const t = (i / (NS - 1)) * TDUR
    const hh = c.kind === 'cycle' ? c.h0 + 0.12 * Math.sin(0.9 * t) : 0.05 + (c.h0 - 0.05) * Math.exp(-0.2 * t)
    pts.push(new THREE.Vector3(x, hh, y * 0.85))
    for (let s = 0; s < sub; s++) {
      const [k1x, k1y] = f(x, y), [k2x, k2y] = f(x + 0.5 * h * k1x, y + 0.5 * h * k1y), [k3x, k3y] = f(x + 0.5 * h * k2x, y + 0.5 * h * k2y), [k4x, k4y] = f(x + h * k3x, y + h * k3y)
      x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x); y += (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y)
    }
  }
  return pts
}

/** a tube swept along `pts` with a parallel-transport frame; aU = arc position 0..1 */
function tubeGeo(pts: THREE.Vector3[], radius: (u: number) => number, radial: number): THREE.BufferGeometry {
  const n = pts.length, pos = new Float32Array(n * radial * 3), nor = new Float32Array(n * radial * 3), aU = new Float32Array(n * radial)
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), d = new THREE.Vector3()
  T.subVectors(pts[1], pts[0]).normalize()
  N.set(0, 1, 0); if (Math.abs(T.dot(N)) > 0.9) N.set(1, 0, 0)
  N.addScaledVector(T, -N.dot(T)).normalize()
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]
    T.subVectors(b, a).normalize()
    N.addScaledVector(T, -N.dot(T)).normalize(); B.crossVectors(T, N)
    const u = i / (n - 1), r = radius(u)
    for (let j = 0; j < radial; j++) {
      const ang = (j / radial) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang)
      d.set(N.x * c + B.x * s, N.y * c + B.y * s, N.z * c + B.z * s)
      const o = (i * radial + j) * 3
      pos[o] = pts[i].x + d.x * r; pos[o + 1] = pts[i].y + d.y * r; pos[o + 2] = pts[i].z + d.z * r
      nor[o] = d.x; nor[o + 1] = d.y; nor[o + 2] = d.z; aU[i * radial + j] = u
    }
  }
  const idx: number[] = []
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, e = (i + 1) * radial + (j + 1) % radial
    idx.push(a, c, b, b, c, e)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('aU', new THREE.BufferAttribute(aU, 1))
  g.setIndex(idx)
  return g
}
/** a curtain between the curve and the floor: two vertices per sample; aU along, aV = 0 at the curve .. 1 at the floor */
function curtainGeo(pts: THREE.Vector3[]): THREE.BufferGeometry {
  const n = pts.length, pos = new Float32Array(n * 2 * 3), aU = new Float32Array(n * 2), aV = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const p = pts[i], u = i / (n - 1)
    pos.set([p.x, p.y, p.z, p.x, FLOOR, p.z], i * 6); aU[i * 2] = aU[i * 2 + 1] = u; aV[i * 2] = 0; aV[i * 2 + 1] = 1
  }
  const idx: number[] = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aU', new THREE.BufferAttribute(aU, 1)); g.setAttribute('aV', new THREE.BufferAttribute(aV, 1)); g.setIndex(idx)
  return g
}

const TUBE_VS = /* glsl */ `attribute float aU; varying float vU; varying vec3 vN; varying vec3 vV;
void main() { vU = aU; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`
const TUBE_FS = /* glsl */ `varying float vU; varying vec3 vN; varying vec3 vV;
uniform float uStart, uProg, uTime, uHalo, uAlpha; uniform vec3 uC0, uC1;
void main() {
  if (vU > uProg || vU < uStart) discard;
  float head = smoothstep(0.07, 0.0, uProg - vU) * step(uProg, 0.995);
  float tail = smoothstep(0.0, 0.05, vU - uStart);
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
  float flow = 0.5 + 0.5 * sin(vU * 46.0 - uTime * 3.2);
  vec3 base = mix(uC0, uC1, smoothstep(0.0, 1.0, vU));
  if (uHalo > 0.5) {
    float soft = 0.25 + 0.75 * (1.0 - fres);
    float a = 0.13 * soft * tail * uAlpha * (0.6 + 0.4 * flow + head * 2.0);
    gl_FragColor = vec4(base + head * 0.5, a);
  } else {
    vec3 col = base * (0.62 + 0.55 * (1.0 - fres) + 0.18 * flow) + fres * 0.18 + head * vec3(1.0, 0.96, 0.9);
    gl_FragColor = vec4(col, 1.0);
  }
}`
const CUR_VS = /* glsl */ `attribute float aU; attribute float aV; varying float vU; varying float vV;
void main() { vU = aU; vV = aV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const CUR_FS = /* glsl */ `varying float vU; varying float vV; uniform float uStart, uProg, uAlpha, uTime; uniform vec3 uC0;
void main() {
  if (vU > uProg || vU < uStart) discard;
  float edge = smoothstep(0.0, 0.04, uProg - vU) * smoothstep(0.0, 0.05, vU - uStart);
  float band = 0.8 + 0.2 * sin(vU * 90.0 - uTime * 1.6);
  float a = pow(1.0 - vV, 2.2) * 0.17 * uAlpha * edge * band;
  gl_FragColor = vec4(uC0, a);
}`

export default {
  id: 'market',
  build(c: StageBuildCtx) {
    const { phone, view } = c
    const root = new THREE.Group()
    const az = Math.atan2(view.dir.x, view.dir.z), elev = Math.asin(THREE.MathUtils.clamp(view.dir.y, -1, 1))
    const TILT = THREE.MathUtils.clamp(Math.PI / 2 - (elev + THREE.MathUtils.degToRad(46)), 0.35, 1.05)
    const yawG = new THREE.Group(); yawG.rotation.y = az * 0.8; root.add(yawG)
    const rig = new THREE.Group(); yawG.add(rig)
    const tilt = new THREE.Group(); rig.add(tilt)                      // the plot's frame: x, z are the phase plane, y is the public's support
    const spin = new THREE.Group(); tilt.add(spin)

    // ---------------------------------------------------------------- the drafting floor: polar rings, spokes, the two state axes, the support axis
    const inkMat = (op: number) => lit(new THREE.LineBasicMaterial({ color: 0xede6d6, transparent: true, opacity: op, depthWrite: false }), 'ink')
    const seg: number[] = []
    const ringPts = (r: number, nseg = 96) => { for (let i = 0; i < nseg; i++) { const a0 = (i / nseg) * Math.PI * 2, a1 = ((i + 1) / nseg) * Math.PI * 2; seg.push(Math.cos(a0) * r, FLOOR, Math.sin(a0) * r * 0.85, Math.cos(a1) * r, FLOOR, Math.sin(a1) * r * 0.85) } }
    for (const r of [0.75, 1.5, 2.25, 3.0]) ringPts(r)
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; seg.push(Math.cos(a) * 0.3, FLOOR, Math.sin(a) * 0.3 * 0.85, Math.cos(a) * 3.0, FLOOR, Math.sin(a) * 3.0 * 0.85) }
    const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3))
    const grid = new THREE.LineSegments(gridGeo, inkMat(0.14)); spin.add(grid)
    const axGeo = new THREE.BufferGeometry(); axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-BOX.x, FLOOR, 0, BOX.x, FLOOR, 0, 0, FLOOR, -BOX.z, 0, FLOOR, BOX.z, 0, FLOOR, 0, 0, BOX.top, 0]), 3))
    const axes = new THREE.LineSegments(axGeo, inkMat(0.5)); spin.add(axes)
    // nullclines of a coupled pair: two lines through the focus on the floor, dashed by a canvas texture-free trick (many short segments)
    const dash: number[] = []
    for (const ang of [0.5, 2.1]) for (let i = -30; i < 30; i += 2) { const a = i * 0.1, b = (i + 1) * 0.1; dash.push(Math.cos(ang) * a, FLOOR, Math.sin(ang) * a * 0.85, Math.cos(ang) * b, FLOOR, Math.sin(ang) * b * 0.85) }
    const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dash), 3))
    const nulls = new THREE.LineSegments(dGeo, inkMat(0.34)); spin.add(nulls)
    // arrow tip on the support axis
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 10), lit(new THREE.MeshBasicMaterial({ color: 0xede6d6, toneMapped: false }), 'tip')); tip.position.set(0, BOX.top + 0.08, 0); spin.add(tip)
    // axis words as sprites
    const word = (txt: string, x: number, y: number, z: number) => {
      const t = canvasTex(384, 64, (g, w, h) => { g.fillStyle = 'rgba(237,230,214,0.82)'; g.font = '500 28px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '3px'; g.fillText(txt, w / 2, h / 2) })
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthWrite: false, toneMapped: false })); lit(s.material as THREE.SpriteMaterial, 'word')
      s.scale.set(2.1, 0.35, 1); s.position.set(x, y, z); spin.add(s)
      document.fonts?.ready.then(() => { t.g.clearRect(0, 0, 384, 64); t.g.fillStyle = 'rgba(237,230,214,0.82)'; t.g.font = '500 28px "IBM Plex Mono", ui-monospace, monospace'; t.g.textAlign = 'center'; t.g.textBaseline = 'middle'; t.g.letterSpacing = '3px'; t.g.fillText(txt, 192, 34); t.tex.needsUpdate = true }).catch(() => {})
      return s
    }
    const words = [word('ONE PARTNER', BOX.x - 1.2, FLOOR + 0.16, 0.25), word('THE OTHER', 0.55, FLOOR + 0.16, BOX.z - 0.25), word('PUBLIC SUPPORT', 0.0, BOX.top + 0.5, 0)]
    // the focus: a pulsing pool of light where the settling couples end
    const focus = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), glowMat(radialTexture(), 0xff8aa0, 0)); focus.rotation.x = -Math.PI / 2; focus.position.y = 0.05; spin.add(focus)
    const focusSprite = new THREE.Sprite(glowSpriteMat(0xffc9d4, 0)); focusSprite.scale.set(1.4, 1.4, 1); focusSprite.position.y = 0.05; spin.add(focusSprite)

    // ---------------------------------------------------------------- the couples
    interface Cp { c: Couple; pts: THREE.Vector3[]; coreM: THREE.Mesh; haloM: THREE.Mesh; curM: THREE.Mesh; rad: (u: number) => number; grabM: THREE.Mesh; replay: number; clock: number; startMark: THREE.Sprite; core: THREE.ShaderMaterial; halo: THREE.ShaderMaterial; cur: THREE.ShaderMaterial; thread: THREE.Line; beads: THREE.Mesh[]; sprites: THREE.Sprite[]; tp: Float32Array }
    const cps: Cp[] = []
    // a finger is a bigger target than a cursor: 1.5x grab radius on coarse pointers
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    const mkU = (c0: number, c1: number, halo: number, alpha: number) => ({
      uStart: { value: 0 }, uProg: { value: 0 }, uTime: { value: 0 }, uHalo: { value: halo }, uAlpha: { value: alpha },
      uC0: { value: new THREE.Color(c0) }, uC1: { value: new THREE.Color(c1) },
    })
    for (const c0 of COUPLES) {
      const pts = integrate(c0)
      const core = new THREE.ShaderMaterial({ vertexShader: TUBE_VS, fragmentShader: TUBE_FS, uniforms: mkU(c0.c0, c0.c1, 0, 1), side: THREE.DoubleSide })
      const halo = new THREE.ShaderMaterial({ vertexShader: TUBE_VS, fragmentShader: TUBE_FS, uniforms: mkU(c0.c0, c0.c1, 1, 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide })
      const cur = new THREE.ShaderMaterial({ vertexShader: CUR_VS, fragmentShader: CUR_FS, uniforms: { uStart: { value: 0 }, uProg: { value: 0 }, uAlpha: { value: 1 }, uTime: { value: 0 }, uC0: { value: new THREE.Color(c0.c0) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
      const rad = (u: number) => c0.rad * (0.7 + 0.5 * (1 - u * 0.4)) * (phone ? 1.15 : 1)
      const coreM = new THREE.Mesh(tubeGeo(pts, rad, RADIAL), core); coreM.frustumCulled = false
      const haloM = new THREE.Mesh(tubeGeo(pts, u => rad(u) * 3.4, RADIAL), halo); haloM.frustumCulled = false
      const curM = new THREE.Mesh(curtainGeo(pts), cur); curM.frustumCulled = false; curM.renderOrder = 1; haloM.renderOrder = 2
      spin.add(coreM, haloM, curM)
      // the pair: two beads and a thread
      const beadGeo = new THREE.SphereGeometry(0.1, phone ? 10 : 16, phone ? 8 : 12)
      const beads = [0, 1].map(() => { const m = new THREE.Mesh(beadGeo, lit(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 'bead')); m.visible = false; spin.add(m); return m })
      const sprites = [0, 1].map(() => { const s = new THREE.Sprite(glowSpriteMat(c0.c0, 0.9)); s.scale.set(0.8, 0.8, 1); s.visible = false; spin.add(s); return s })
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
      const thread = new THREE.Line(tg, lit(new THREE.LineBasicMaterial({ color: c0.c1, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 'thread')); thread.frustumCulled = false; spin.add(thread)
      const tp = new Float32Array(pts.length * 3); pts.forEach((p, i) => tp.set([p.x, p.y, p.z], i * 3))
      // an invisible, generous grab target that follows the lead bead, and a ring that marks where the trajectory starts
      const grabM = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 8), new THREE.MeshBasicMaterial({ visible: false })); grabM.visible = false; grabM.scale.setScalar(coarse ? 1.5 : 1); spin.add(grabM)
      const startMark = new THREE.Sprite(glowSpriteMat(c0.c1, 0)); startMark.scale.set(0.5, 0.5, 1); spin.add(startMark)
      cps.push({ c: c0, clock: 0, pts, coreM, haloM, curM, rad, grabM, replay: 1, startMark, core, halo, cur, thread, beads, sprites, tp })
    }
    const pointAt = (cp: Cp, u: number, out: THREE.Vector3) => {
      const f = clamp01(u) * (NS - 1), i = Math.min(NS - 2, Math.floor(f)), k = f - i, a = i * 3
      out.set(cp.tp[a] + (cp.tp[a + 3] - cp.tp[a]) * k, cp.tp[a + 1] + (cp.tp[a + 4] - cp.tp[a + 1]) * k, cp.tp[a + 2] + (cp.tp[a + 5] - cp.tp[a + 2]) * k)
    }
    const P = new THREE.Vector3(), Q = new THREE.Vector3()

    // ---- interaction: grab a bead and drag it across the phase plane; that is the couple's starting point, and its trajectory is re-integrated (RK4) and the
    // tube, halo and curtain redrawn under your hand, then drawn on again when you let go. A tap on a bead swings its start a fifth of a turn round the focus.
    const lbl = stageTip(), N_UP = new THREE.Vector3(0, 1, 0), hit3 = new THREE.Vector3(), p0 = new THREE.Vector3()
    let ptr: { x: number; y: number } | null = null     // the pointer's client position while it is over the stage (null: away)
    const proxV = new THREE.Vector3()
    // the beads slow to 30% while the pointer is within 80px of a couple's lead bead (so one can be taken); a bead you point at holds still
    const nearPtr = (cp: Cp) => {
      if (!ptr || !cp.grabM.visible) return false
      cp.grabM.getWorldPosition(proxV).project(c.camera)
      const dx = (proxV.x + 1) / 2 * innerWidth - ptr.x, dy = (1 - proxV.y) / 2 * innerHeight - ptr.y
      return dx * dx + dy * dy < 80 * 80
    }
    // the legend (signal-house: read the scale before the data): what colour and height mean, revealed in a wipe/lift stagger once the plot has settled
    const legend = document.createElement('div'); legend.className = 'mkt-legend'; legend.setAttribute('data-proof', 'skip'); legend.setAttribute('aria-hidden', 'true')
    legend.innerHTML = '<div class="ml-row"><span class="ml-sw ml-a"></span><span>Each line is one couple</span></div><div class="ml-row"><span class="ml-sw ml-b"></span><span>Settles when fading outweighs responding</span></div><div class="ml-row"><span class="ml-sw ml-c"></span><span>Affection feeds on itself: never settles</span></div><div class="ml-note">height = public support</div>'
    const lst = document.createElement('style')
    lst.textContent = '.mkt-legend{position:fixed;left:24px;top:116px;z-index:60;width:min(250px,64vw);pointer-events:none;opacity:0;visibility:hidden;transition:opacity .4s ease-out,visibility 0s linear .4s;font:500 9.5px/1.35 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:rgba(241,236,224,.82)}.mkt-legend.on{opacity:1;visibility:visible;transition:opacity .4s ease-out}.ml-row{display:flex;align-items:center;gap:10px;margin-bottom:6px}.ml-sw{flex:none;width:26px;height:3px;border-radius:2px}.ml-a{background:linear-gradient(90deg,#ff6a8a,#ffb86b,#8fb7ff,#7fd1c7)}.ml-b{background:#8fb8ff}.ml-c{background:#fff;box-shadow:0 0 6px rgba(255,255,255,.7)}.ml-note{margin-top:8px;opacity:.6}.mkt-legend.on .ml-row,.mkt-legend.on .ml-note{animation:sg-lift .6s cubic-bezier(.25,.8,.35,1) backwards}.mkt-legend.on .ml-row:nth-child(1){animation-name:sg-wipe;animation-duration:.95s;animation-timing-function:cubic-bezier(.16,1,.3,1);animation-delay:.34s}.mkt-legend.on .ml-row:nth-child(2){animation-delay:.74s}.mkt-legend.on .ml-row:nth-child(3){animation-delay:.88s}.mkt-legend.on .ml-note{animation-delay:1.08s}@keyframes sg-wipe{from{clip-path:inset(-.78em 0 calc(100% + .78em) 0);translate:0 9px;opacity:0}to{clip-path:inset(-.78em 0 -.78em 0);translate:0 0;opacity:1}}@keyframes sg-lift{from{opacity:0;translate:0 9px}to{opacity:1;translate:0 0}}@media (max-width:900px),(max-aspect-ratio:1/1){.mkt-legend{display:none}}@media (prefers-reduced-motion:reduce){.mkt-legend,.mkt-legend.on{transition:none}.mkt-legend *{animation:none!important}}'
    document.head.append(lst); document.body.append(legend)
    let legOn = false, legUp = 0, legWatch = 0
    const showLegend = (show: boolean) => {
      if (!show) { if (legOn) { legOn = false; legend.classList.remove('on'); if (legWatch) { clearInterval(legWatch); legWatch = 0 } } return }
      legUp = performance.now()
      if (!legWatch) legWatch = window.setInterval(() => { if (performance.now() - legUp > 250) showLegend(false) }, 250)
      if (!legOn) { legOn = true; legend.classList.add('on') }
    }
    const markAt = new THREE.Vector3()
    const mark = tryMark('market', 'Drag a bead', () => { for (const cp of cps) if (cp.grabM.visible) return cp.grabM.getWorldPosition(markAt); return null }, c.camera, '#ff6a8a')
    let held: Cp | null = null, hot: Cp | null = null, dirty: Cp | null = null, swayT = 0, emitM = (_n: string) => {}, rmNow = false
    const refit = (cp: Cp) => {
      cp.pts = integrate(cp.c); cp.pts.forEach((p, i) => cp.tp.set([p.x, p.y, p.z], i * 3))
      const swap = (m: THREE.Mesh, g: THREE.BufferGeometry) => { m.geometry.dispose(); m.geometry = g }
      swap(cp.coreM, tubeGeo(cp.pts, cp.rad, RADIAL)); swap(cp.haloM, tubeGeo(cp.pts, u => cp.rad(u) * 3.4, RADIAL)); swap(cp.curM, curtainGeo(cp.pts))
    }
    const grabAt = (ray: THREE.Raycaster): Cp | null => {
      spin.updateWorldMatrix(true, true)
      let best: Cp | null = null, bd = 1e9
      for (const cp of cps) { if (!cp.grabM.visible) continue; const h = ray.intersectObject(cp.grabM, false)[0]; if (h && h.distance < bd) { bd = h.distance; best = cp } }
      return best
    }
    const pointer = {
      hover(ray: THREE.Raycaster, x: number, y: number) {
        ptr = { x, y }
        hot = grabAt(ray)
        if (hot) lbl.show(x, y, 'Drag the bead', 'moves where this couple starts', '#' + hot.c.c0.toString(16).padStart(6, '0')); else lbl.hide()
        return hot ? 'grab' as const : null
      },
      down(ray: THREE.Raycaster) {
        const cp = grabAt(ray); if (!cp) return null
        mark.dismiss()
        held = cp; cp.replay = 1; emitM('obj:grab')
        return 'drag' as const
      },
      move(ray: THREE.Raycaster) {
        const cp = held; if (!cp) return
        p0.set(0, cp.c.h0, 0)
        if (!rayPlaneLocal(spin, ray.ray, N_UP, p0, hit3)) return
        let x = hit3.x, y = hit3.z / 0.85; const r = Math.hypot(x, y), lim = 3.15
        if (r > lim) { x *= lim / r; y *= lim / r }
        if (r < 0.4) { x *= 0.4 / Math.max(r, 1e-3); y *= 0.4 / Math.max(r, 1e-3) }
        cp.c.x0 = x; cp.c.y0 = y; dirty = cp
      },
      up(moved: boolean) {
        const cp = held; held = null; if (!cp) return
        if (!moved) { const a = 1.25, c = Math.cos(a), sn = Math.sin(a), x = cp.c.x0, y = cp.c.y0; cp.c.x0 = x * c - y * sn; cp.c.y0 = x * sn + y * c; refit(cp) }
        cp.replay = rmNow ? 1 : 0; emitM('obj:release')
      },
      leave() { hot = null; ptr = null; lbl.hide() },
    }
    const update = (f: StageFrame) => {
      emitM = n => f.emit(n); rmNow = f.reduced
      mark.update(f.tIn > 0.6 && f.depart < 0.02 && !held, f.dt, f.reduced)
      if (dirty) { refit(dirty); dirty = null }
      showLegend(f.depart < 0.02 && (f.reduced || f.arrive > 0.85))
      for (const cp of cps) {
        if (cp.replay < 1) cp.replay = Math.min(1, cp.replay + f.dt / 1.0)
        if (cp !== hot && cp !== held) cp.clock += f.dt * (nearPtr(cp) ? 0.3 : 1)      // a bead you point at holds still, so you can take it
        const on = cp === held || cp === hot
        const ms = cp.startMark; ms.position.copy(cp.pts[0]); const want = on ? 0.95 : 0.0
        ;(ms.material as THREE.SpriteMaterial).opacity += (want - (ms.material as THREE.SpriteMaterial).opacity) * Math.min(1, f.dt * 10)
        ms.scale.setScalar(0.55 + 0.08 * Math.sin(f.t * 6) * (on ? 1 : 0)); ms.visible = (ms.material as THREE.SpriteMaterial).opacity > 0.01
      }
      if (!held) swayT += f.dt
      const rm = f.reduced
      const sa = rm ? 1 : clamp01((f.arrive - 0.12) / 0.88), sd = rm ? 0 : sstep(0, 0.9, f.depart)
      // ---- the plot: tips up out of a flat sheet; sways like a held model; on the way out it spins and falls away
      const up = easeOutCubic(sstep(0, 0.6, sa))
      rig.position.set(0, -3.6 * (1 - up) - 6 * easeInCubic(sd), 0.6 * (1 - up))
      tilt.rotation.x = TILT + 0.9 * (1 - up) + 0.5 * easeInCubic(sd)
      spin.rotation.y = (rm ? 0.25 : Math.sin(swayT * 0.35) * 0.4 + 0.15) + 2.4 * (1 - easeInOutCubic(sstep(0, 0.9, sa))) + 3.2 * easeInCubic(sd)
      const sc = 1 - 0.25 * easeInCubic(sd); rig.scale.setScalar(sc)
      const fadeIn = sstep(0.05, 0.5, sa) * (1 - sstep(0.3, 0.8, sd))
      ;(grid.material as THREE.LineBasicMaterial).opacity = 0.14 * fadeIn; (axes.material as THREE.LineBasicMaterial).opacity = 0.5 * fadeIn; (nulls.material as THREE.LineBasicMaterial).opacity = 0.34 * fadeIn
      for (const w of words) (w.material as THREE.SpriteMaterial).opacity = fadeIn * 0.9
      tip.visible = fadeIn > 0.05
      // ---- the tubes: draw on in turn (head leading), retract into the focus on the way out
      const K = cps.length
      let sumDraw = 0
      cps.forEach((cp, k) => {
        const d0 = 0.18 + 0.13 * k
        const prog = Math.min(rm ? 1 : easeInOutCubic(clamp01((sa - d0) / 0.46)), cp.replay < 1 ? easeInOutCubic(cp.replay) : 1)
        const start = rm ? 0 : easeInOutCubic(clamp01((sd - 0.04 - 0.1 * (K - 1 - k) * 0.4) / 0.6))
        sumDraw += prog * (1 - start)
        for (const m of [cp.core, cp.halo, cp.cur]) { m.uniforms.uProg.value = prog >= 0.999 ? 1.01 : prog; m.uniforms.uStart.value = start; m.uniforms.uTime.value = rm ? 0 : f.t }
        // beads ride the finished tube
        const alive = prog >= 0.999 && start < 0.01 ? 1 : 0
        const spd = 0.063
        for (let b = 0; b < 2; b++) {
          let u = rm ? 0.18 + cp.c.phase * 0.5 - b * 0.03 : ((cp.clock * spd + cp.c.phase) % 1) - b * 0.03
          if (u < 0) u += 1
          let vis = alive * sstep(0, 0.03, u) * (1 - sstep(0.93, 1, u)) * (rm ? 1 : sstep(0, 0.5, f.tIn))
          if (cp === held) { vis = 1; u = b * 0.012 }
          pointAt(cp, u, P)
          const bead = cp.beads[b], spr = cp.sprites[b]
          if (b === 0) { cp.grabM.position.copy(P); cp.grabM.visible = vis > 0.5 }
          bead.visible = spr.visible = vis > 0.02
          if (bead.visible) { bead.position.copy(P); bead.scale.setScalar(vis * (cp.c.kind === 'cycle' ? 1.25 : 1) * (cp === hot || cp === held ? 1.4 : 1)); spr.position.copy(P); spr.scale.setScalar(0.6 * vis); (spr.material as THREE.SpriteMaterial).opacity = 0.6 * vis }
          const o = cp.thread.geometry.getAttribute('position') as THREE.BufferAttribute
          if (b === 0) { o.setXYZ(0, P.x, P.y, P.z) } else { o.setXYZ(1, P.x, P.y, P.z); o.needsUpdate = true; (cp.thread.material as THREE.LineBasicMaterial).opacity = 0.7 * vis }
        }
        void Q
      })
      const gl = sumDraw / K
      ;(focus.material as THREE.MeshBasicMaterial).opacity = 0.3 * gl * (0.8 + 0.2 * Math.sin(f.t * 2.1)); (focusSprite.material as THREE.SpriteMaterial).opacity = 0.22 * gl * (0.8 + 0.2 * Math.sin(f.t * 2.1 + 1))
    }
    return { root, update, dust: 0.09, size: [6.6, 5.6] as [number, number], pointer, hint: ['Drag a bead', 'moves where this couple starts'] as [string, string], debug: () => ({ starts: cps.map(c => [+c.c.x0.toFixed(2), +c.c.y0.toFixed(2)]), grab: cps.map(c => { const v = c.grabM.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z, c.grabM.visible] }) }) }
  },
} satisfies StageDef
