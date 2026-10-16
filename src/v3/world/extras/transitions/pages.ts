// SET PIECE 3: the book.  leg knight > reader.
// A giant open book (maroon cloth boards with a gold border, page blocks, a brass clasp) materialises in front of the chess form and
// seven leaves turn past the camera, one after another, each bending through the turn (the free edge lags while it lifts and runs ahead as it
// falls: a closed-form curl evaluated in the vertex shader by integrating the page's curvature along its width), each carrying Ovid's Latin
// (Metamorphoses I, the lines the site already quotes, then the ones that follow). The camera orbits down over the spread, passes close to the
// last leaf, and as that leaf lands the book dissolves into light and the Homer bust rises where it lay. Scroll back and the leaves turn back.
import * as THREE from 'three'
import {
  type CamPose, type Env, type FrameIn, type FrameOut, type Leg, type Piece, KIND, box, cyl, gradTexture, keys, lensShift, lerp, makeShared, merge, precompile, sstep, sstep5,
  stageMaterial, wrapPi, xf, type Shared,
} from './common'
import { fontOf, loadFonts } from '../lib/atlas'
import { LANE_GLSL } from '../lib/lane'

const W = 2.6, H = 3.6, N = 7, DZ = 0.05, TB = 0.26, KB = 0.86
const A0 = 0.13, A_STEP = 0.075, A_LEN = 0.17
const FIRST_FACE = 2 * (N + 1)     // the recto of the first turning leaf: the page the camera sees first (drop capital)

// Ovid, Metamorphoses I.1-17 (public domain), one verse per line
const OVID = [
  'In nova fert animus mutatas dicere formas', 'corpora; di, coeptis (nam vos mutastis et illas)', 'adspirate meis primaque ab origine mundi', 'ad mea perpetuum deducite tempora carmen.',
  'Ante mare et terras et quod tegit omnia caelum', 'unus erat toto naturae vultus in orbe,', 'quem dixere chaos: rudis indigestaque moles', 'nec quicquam nisi pondus iners congestaque eodem', 'non bene iunctarum discordia semina rerum.',
  'Nullus adhuc mundo praebebat lumina Titan,', 'nec nova crescendo reparabat cornua Phoebe,', 'nec circumfuso pendebat in aere tellus', 'ponderibus librata suis, nec bracchia longo', 'margine terrarum porrexerat Amphitrite;',
  'utque erat et tellus illic et pontus et aer,', 'sic erat instabilis tellus, innabilis unda,', 'lucis egens aer; nulli sua forma manebat,',
]

function pageTexture(face: number, aniso: number): THREE.CanvasTexture {
  const cw = 576, ch = 800
  const c = document.createElement('canvas'); c.width = cw; c.height = ch
  const g = c.getContext('2d')!
  g.clearRect(0, 0, cw, ch)
  g.textBaseline = 'alphabetic'
  const ink = '#2a1d16'
  // running head
  g.fillStyle = 'rgba(70,44,30,0.8)'; g.font = fontOf('mono', 13); g.textAlign = 'center'
  g.fillText(face % 2 ? 'LIBER · PRIMVS' : 'METAMORPHOSEON', cw / 2, 58)
  g.fillStyle = 'rgba(90,60,40,0.55)'; g.fillRect(cw * 0.18, 70, cw * 0.64, 1.5)
  g.textAlign = 'left'
  const lines = 10, x0 = 66, y0 = 130, lh = 56
  for (let i = 0; i < lines; i++) {
    const idx = ((((face - FIRST_FACE) % 34) + 34) % 34 * 4 + i) % OVID.length
    let txt = OVID[idx]
    g.fillStyle = ink; g.font = fontOf('serif', 30)
    let x = x0
    if (face === FIRST_FACE && i === 0) {
      // drop cap on the very first page the camera sees
      g.fillStyle = '#7a1018'; g.font = `400 112px "Bodoni Moda Variable", "Bodoni Moda", "Instrument Serif", serif`
      g.fillText(txt[0], x0 - 4, y0 + 66)
      g.fillStyle = ink; g.font = fontOf('serif', 30)
      g.fillText(txt.slice(1), x0 + 76, y0 + 8); continue
    }
    if (face === FIRST_FACE && i === 1) x = x0 + 86
    if (i === lines - 1 && face % 3 === 1) txt = txt.replace(/[,;:.]$/, '')
    // fit the verse to the measure
    let px = 30; while (g.measureText(txt).width > cw - x - 62 && px > 18) { px--; g.font = fontOf('serif', px) }
    g.fillText(txt, x, y0 + i * lh)
  }
  // ornament
  g.fillStyle = 'rgba(122,16,24,0.7)'; g.font = fontOf('serif', 26); g.textAlign = 'center'; g.fillText('❦', cw / 2, ch - 72)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = aniso; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true
  return t
}

const LEAF_V = /* glsl */ `
uniform float uP, uW, uZ0, uZ1;
varying vec2 vUv; varying vec3 vN; varying vec3 vWP; varying vec3 vL; 
void main() {
  float PI = 3.14159265;
  float s = position.x, p = uP;
  float theta = PI * p;
  float lag = 1.5 * sin(PI * p) * (1.0 - 2.0 * p);
  float rip = 0.1 * sin(PI * p);
  const int NS = 16;
  float ds = s / float(NS); vec2 q = vec2(0.0);
  for (int i = 0; i < NS; i++) {
    float sm = (float(i) + 0.5) * ds, k = sm / uW;
    float phi = theta - lag * pow(k, 1.15) + rip * sin(sm * 3.2 - p * 9.0);
    q += vec2(cos(phi), sin(phi)) * ds;
  }
  float kk = s / uW, phiS = theta - lag * pow(kk, 1.15) + rip * sin(s * 3.2 - p * 9.0);
  vec3 pos = vec3(q.x, position.y * (1.0 - 0.025 * sin(PI * p) * kk), q.y + mix(uZ0, uZ1, p));
  vN = normalize(mat3(modelMatrix) * vec3(-sin(phiS), 0.0, cos(phiS)));
  vUv = uv; vL = position;
  vec4 w = modelMatrix * vec4(pos, 1.0); vWP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const LEAF_F = /* glsl */ `
precision highp float;
uniform sampler2D tF, tB; uniform float uDissolve, uGlow, uCopy; uniform vec3 uKey, uKeyCol, uEdge;
varying vec2 vUv; varying vec3 vN; varying vec3 vWP; varying vec3 vL;
${LANE_GLSL}
float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y), mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main() {
  bool ff = gl_FrontFacing;
  vec3 N = normalize(vN); if (!ff) N = -N;
  vec3 V = normalize(cameraPosition - vWP);
  float rim = 0.0;
  if (uDissolve < 0.995 || uCopy > 0.002) {
    float dn = (vn(vWP * 2.6 + vec3(3.0, 1.0, 7.0)) * 0.6 + vn(vWP * 5.0) * 0.3) * 0.9 + 0.1 * vn(vWP * 13.0);
    float inLane = 1.0 - laneMask();
    float thr = uDissolve * 1.25 - 0.12;
    if (dn >= thr) discard;
    if (dn >= thr - uCopy * inLane * 1.5) discard;
    rim = smoothstep(thr - 0.05, thr, dn);
  }
  vec2 tuv = ff ? vUv : vec2(1.0 - vUv.x, vUv.y);
  vec4 tex = ff ? texture2D(tF, tuv) : texture2D(tB, tuv);
  float fibre = vn(vec3(vUv * vec2(60.0, 80.0), 2.0)) * 0.5 + vn(vec3(vUv * 14.0, 5.0)) * 0.5;
  vec3 paper = vec3(0.93, 0.87, 0.73) * (0.9 + 0.12 * fibre);
  float gutter = smoothstep(0.0, 0.2, vUv.x), edge = 1.0 - 0.18 * smoothstep(0.86, 1.0, vUv.x);
  vec3 L = normalize(uKey);
  float nl = dot(N, L), wrap = max(nl * 0.5 + 0.5, 0.0), lam = max(nl, 0.0);
  float trans = max(-nl, 0.0) * 0.4;
  vec3 base = mix(paper, tex.rgb, tex.a);
  vec3 col = base * (0.28 + 0.8 * wrap + 0.3 * lam) * mix(0.42, 1.0, gutter) * edge * uKeyCol;
  col += paper * trans * vec3(1.0, 0.66, 0.36) * (1.0 - tex.a * 0.8);
  col += vec3(1.0, 0.8, 0.52) * 0.12 * uGlow * (1.0 - tex.a) * (0.4 + 0.6 * gutter);
  col += pow(1.0 - max(dot(N, V), 0.0), 4.0) * vec3(0.6, 0.5, 0.4) * 0.12;
  col += uEdge * rim * 2.0;
  gl_FragColor = vec4(col, 1.0);
}`

export function createPages(leg: Leg): Piece {
  let built = false
  const root = new THREE.Group(), book = new THREE.Group(); root.name = 'tr-pages'; root.add(book)
  const leaves: { mat: THREE.ShaderMaterial; mesh: THREE.Mesh }[] = []
  let sh!: Shared, halo!: THREE.Mesh, haloMat!: THREE.MeshBasicMaterial
  const lu = { uKey: { value: new THREE.Vector3(0.3, 0.6, 0.75) }, uKeyCol: { value: new THREE.Color(1.0, 0.9, 0.78) }, uGlow: { value: 0 }, uEdge: { value: new THREE.Color(1.0, 0.78, 0.45) } }
  const bc = new THREE.Vector3(), a = new THREE.Vector3()
  let yaw = 0, bookReady = false

  const place = (env: Env) => {
    const S = env.flightCam(0), C = leg.B.place.at
    const k = lensShift(S.pos, S.target, S.fov, leg.A.frame, -1)
    bc.set(C[0], C[1] - 1.65, C[2])
    a.set(k.pos[0] - bc.x, 0, k.pos[2] - bc.z).normalize()
    yaw = Math.atan2(a.x, a.z)
    root.position.copy(bc); root.rotation.set(0, yaw, 0)
    book.rotation.set(-0.3, 0, 0)
    root.updateMatrixWorld(true)
  }

  const piece: Piece = {
    leg,
    cues: Array.from({ length: N }, (_, i) => ({ at: A0 + A_STEP * i + 0.02, name: 'tr:pages' })),
    build(env) {
      if (built) return
      built = true
      sh = makeShared(env)
      sh.uWarmCol.value.set(1.0, 0.78, 0.5)
      const parts: THREE.BufferGeometry[] = []
      // boards, spine, page blocks, clasp
      parts.push(box(2 * W + 0.4, H + 0.24, 0.07, [0, 0, -0.035], KIND.cloth, undefined, 0.02))
      parts.push(cyl(0.2, 0.2, H + 0.24, [0, 0, -0.05], KIND.cloth, 14))
      for (const sgn of [-1, 1]) {
        parts.push(box(W - 0.02, H - 0.05, TB, [sgn * (W / 2 + 0.005), 0, TB / 2], KIND.paper, undefined, 0.012))
        parts.push(box(0.2, 0.46, 0.05, [sgn * (W + 0.18), 0, 0.02], KIND.brass, undefined, 0.01))
      }
      parts.push(box(0.04, H + 0.2, 0.09, [0, 0, 0.02], KIND.brass, undefined, 0.005))
      const sm = new THREE.Mesh(merge(parts), stageMaterial(sh, { tint: 0xb2a488 })); sm.name = 'tr-book-static'
      book.add(sm)
      // the leaves
      const lg = xf(new THREE.PlaneGeometry(W, H, 44, 20), [W / 2, 0, 0])
      for (let i = -1; i <= N; i++) {
        const stat = i < 0 || i >= N                       // -1: the leaf already lying on the left; N: the one still on the right when the last turn is done
        const k = Math.max(0, Math.min(N - 1, i))
        const mat = new THREE.ShaderMaterial({
          vertexShader: LEAF_V, fragmentShader: LEAF_F, side: THREE.DoubleSide,
          uniforms: {
            uP: { value: i < 0 ? 1 : 0 }, uW: { value: W }, uZ0: { value: i >= N ? TB + 0.012 : TB + 0.045 + (N - 1 - k) * DZ }, uZ1: { value: i < 0 ? TB + 0.012 : TB + 0.045 + k * DZ },
            tF: { value: pageTexture(2 * (i + N + 1), 4) }, tB: { value: pageTexture(2 * (i + N + 1) + 1, 4) }, uDissolve: sh.uDissolve, uCopy: sh.uCopy,
            uLane: sh.uLane, uRes: sh.uRes, uLaneOn: sh.uLaneOn, ...lu,
          } as unknown as Record<string, THREE.IUniform>,
        })
        const m = new THREE.Mesh(lg, mat); m.frustumCulled = false; m.name = 'tr-leaf'
        book.add(m); if (!stat) leaves.push({ mat, mesh: m })
      }
      // lamp halo: soft additive light behind the spread
      haloMat = new THREE.MeshBasicMaterial({ map: gradTexture('radial', 128), color: new THREE.Color(1.0, 0.72, 0.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
      halo = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), haloMat); halo.position.set(0, 0, -0.5); halo.renderOrder = -1
      book.add(halo)
      book.scale.setScalar(KB)
      root.visible = false
      if (!env.q.reflect) root.userData.noReflect = true
      env.scene.add(root)
      void loadFonts()
      place(env); bookReady = true
      precompile(env, root)
    },
    setVisible(v) { root.visible = v && bookReady },
    frame(inp: FrameIn, out: FrameOut, env: Env) {
      if (!bookReady) return
      const { u, t } = inp
      place(env)
      const dB = sstep(0.0, 0.12, u) * (1 - sstep(0.8, 0.95, u))
      sh.uDissolve.value = dB; sh.uTime.value = t; sh.uCopy.value = inp.copy
      sh.uAmb.value = 0.5; sh.uMoon.value = 1.6; sh.uWarm.value = 0.9
      // the key lamp sits above and in front of the book (book-local), in world space for the shaders
      const lamp = new THREE.Vector3(1.2, 3.2, 4.2).applyMatrix4(book.matrixWorld)
      sh.uLightPos.value.copy(lamp); sh.uLight2Pos.value.copy(lamp)
      lu.uKey.value.copy(lamp).sub(bc).normalize()
      lu.uGlow.value = dB
      for (let i = 0; i < N; i++) leaves[i].mat.uniforms.uP.value = sstep5(A0 + A_STEP * i, A0 + A_STEP * i + A_LEN, u)
      const pop = 0.88 + 0.12 * sstep5(0, 0.14, u)
      book.scale.setScalar(KB * pop)
      book.position.y = 0.25 * (1 - sstep(0, 0.14, u)) + 0.04 * Math.sin(t * 1.3)
      haloMat.opacity = 0.5 * dB
      root.visible = dB > 0.002
      out.field = u < 0.6 ? lerp(1, 0.28, sstep(0.04, 0.2, u)) : lerp(0.28, 1, sstep(0.58, 0.92, u))
    },
    camera(u, base, env) {
      if (!bookReady) return null
      const A = env.flightCam(0), B = env.flightCam(1)
      const fA = lensShift(A.pos, A.target, A.fov, leg.A.frame, -1), fB = lensShift(B.pos, B.target, B.fov, leg.B.frame, -1)
      const rel = (p: [number, number, number]) => new THREE.Vector3(p[0] - bc.x, p[1] - bc.y, p[2] - bc.z)
      const r0 = rel(fA.pos), r1 = rel(fB.pos)
      const d0 = r0.length(), d1 = r1.length(), az0 = Math.atan2(r0.x, r0.z), az1 = az0 + wrapPi(Math.atan2(r1.x, r1.z) - az0)
      const el0 = Math.asin(r0.y / d0), el1 = Math.asin(r1.y / d1)
      const d = keys([[0, d0], [0.1, d0 * 0.92], [0.45, d0 * 0.52], [0.7, d0 * 0.48], [1, d1]])(u)
      const el = keys([[0, el0], [0.28, Math.max(el0, 0.5)], [0.62, 0.78], [0.8, lerp(0.7, el1, 0.5)], [1, el1]])(u)
      const az = lerp(az0, az1, sstep(0.55, 1, u)) + 0.12 * Math.sin(u * 5.2) * Math.sin(Math.PI * u)
      const pos: [number, number, number] = [bc.x + d * Math.cos(el) * Math.sin(az), bc.y + d * Math.sin(el), bc.z + d * Math.cos(el) * Math.cos(az)]
      const e1 = sstep(0, 0.24, u), e2 = sstep(0.68, 1, u)
      const t0 = [lerp(fA.tgt[0], bc.x, e1), lerp(fA.tgt[1], bc.y + 0.3, e1), lerp(fA.tgt[2], bc.z, e1)]
      const tgt: [number, number, number] = [lerp(t0[0], fB.tgt[0], e2), lerp(t0[1], fB.tgt[1], e2), lerp(t0[2], fB.tgt[2], e2)]
      const fov = lerp(A.fov, B.fov, u)
      const fr: [number, number] = [lerp(leg.A.frame?.[0] ?? 0, leg.B.frame?.[0] ?? 0, u), 0]
      const s = lensShift(pos, tgt, fov, fr, 1)
      void base
      return { pos: s.pos, target: s.tgt, fov } as CamPose
    },
    dispose() { root.removeFromParent() },
  }
  return piece
}
