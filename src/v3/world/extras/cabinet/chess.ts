// STAGE "knight": a real chess set that replays the Opera Game (Morphy, Paris 1858, public domain), move by move, while the visitor stays.
//   board   a glossy marble-and-walnut board with inlaid squares, thin gold stringing, a maple-ish frame with engraved coordinates, standing on a
//           plinth with a brass edge and ledges for the captured pieces. The top is a thin transparent lacquer over a hollow plinth; the pieces are
//           mirrored under it (the same meshes, flipped), so the board shows them reflected.
//   pieces  32 Staunton pieces turned on a lathe (lathe.ts): ivory and ebony, glossy, lit by the world's lights and the shared studio.
//   replay  every SAN move is resolved against the LEGAL moves of the position (rules.ts) before it is animated: arcing hops (the knight leaps),
//           captures knock the victim up onto the ledge, castling moves king and rook, the last move mates and the black king topples. Then the
//           pieces glide home and it starts again. scripts/test-opera.mjs checks the moves and the final position.
//   hero    a larger knight stands on the front ledge, turning slowly toward the board.
//   touch   hover a piece to lift it (it floats, a ring lights under it) and its LEGAL moves in the position being shown light up as dots (rings for captures);
//           press a piece to give it a nudge. Two brass buttons on the front ledge step the replay one move back / forward (it plays the move, or runs it in reverse),
//           the plate between them names the move on the board; leave it alone for a few seconds and the replay carries on from there.
// Reduced motion: the final (mating) position, still. All motion is a pure function of the stage clock, so the entrance is reversible.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { FlightState } from '../../flight'
import { loadFonts, fontOf } from '../lib/atlas'
import { sharedEnv } from '../env'
import { loadGLB, meshesByName, withAO } from '../../glbmodel'
import { stamp } from '../spaces/games-fx'
import { OPERA_GAME, colourOf, legalMoves, replay, startPosition, type Ply } from './rules'
import { pieceGeo, type Kind } from './lathe'
import { D, bake, blobTexture, canvasTex, clamp01, damp, disposeTree, easeOutBack, enter, glowTexture, lerp, makeBlobs, precompile, setBlob, sstep, type Kit } from './kit'
import type { Stage } from './stage'

// ---- dimensions (local units; the plinth's top plane is y = 0, +z toward White and the camera)
const S = 0.7, HB = 4 * S, BORDER = 0.34, SIDE = 0.3, BACK = 0.92, FRONT = 0.96
const W = 2 * (HB + BORDER + SIDE), DEPTH = 2 * HB + 2 * BORDER + BACK + FRONT, CZ = (FRONT - BACK) / 2
const SLAB = 0.42
const STRETCH = 1.12
const RAD: Record<Kind, number> = { P: 0.22, R: 0.27, N: 0.27, B: 0.26, Q: 0.29, K: 0.3 }
const NAT: Record<Kind, number> = { P: 2.32, R: 2.52, N: 3.57, B: 3.3, Q: 2.85, K: 3.45 }
const sqX = (f: number) => (f - 3.5) * S
const sqZ = (r: number) => (3.5 - r) * S
const LEDGE_Z = -(HB + BORDER + BACK / 2)                 // back ledge: where captured pieces stand
const HERO_AT = new THREE.Vector3(-2.15, 0, HB + BORDER + FRONT / 2)

const TOP_FRAG = /* glsl */ `
uniform sampler2D tText; uniform vec2 uDim; uniform float uS, uB, uCz;
vec3 goldC = vec3(0.86, 0.66, 0.30);
void main() {
  vec2 q = vec2((vUv.x - 0.5) * uDim.x, uCz + (0.5 - vUv.y) * uDim.y);      // world x, z on the plinth top
  float hb = 4.0 * uS;
  vec2 a = abs(q);
  vec3 col; float alpha = 1.0;
  float mx = max(a.x, a.y);
  if (mx < hb) {
    float f = floor((q.x + hb) / uS), r = floor((hb - q.y) / uS);
    bool light = mod(f + r, 2.0) > 0.5;
    vec2 loc = vec2(q.x + hb - f * uS, hb - q.y - r * uS) / uS;              // 0..1 inside the square
    vec2 off = vec2(f * 4.17 + r * 1.3, r * 3.71 - f * 0.9);
    if (light) {
      col = marble(q * 1.55 + off, f * 7.0 + r * 3.0, vec3(0.93, 0.915, 0.88), vec3(0.42, 0.43, 0.47));
      col += (h21(floor(q * 400.0)) - 0.5) * 0.02;
    } else {
      mat2 R = ((int(f + r) / 2) % 2 == 0) ? mat2(1.0, 0.0, 0.0, 1.0) : mat2(0.0, 1.0, -1.0, 0.0);
      col = wood(R * (q * 1.9 + off), vec3(0.14, 0.075, 0.04), vec3(0.30, 0.16, 0.085), 5.0, f * 3.1 + r);
    }
    // a hair-thin joint where the inlay meets: the dark squares are inset a touch
    vec2 e = min(loc, 1.0 - loc) * uS;
    float edge = min(e.x, e.y);
    col *= mix(0.62, 1.0, smoothstep(0.0, 0.007, edge));
    if (!light) col *= mix(0.86, 1.0, smoothstep(0.007, 0.03, edge));
    alpha = 0.80;
  } else if (mx < hb + uB) {
    // frame: mitred walnut, grain runs along each side; a gold string inside and out
    bool sideStrip = a.x > a.y;
    vec2 p = sideStrip ? vec2(q.y, q.x) : q;
    col = wood(p * vec2(1.4, 1.9), vec3(0.24, 0.115, 0.06), vec3(0.46, 0.235, 0.11), 6.0, sideStrip ? 4.0 : 9.0);
    float d = mx - hb;
    float string1 = 1.0 - smoothstep(0.0, 0.004, abs(d - 0.032) - 0.006);
    float string2 = 1.0 - smoothstep(0.0, 0.004, abs(d - (uB - 0.028)) - 0.005);
    col = mix(col, goldC, max(string1, string2) * 0.95);
    alpha = 0.93;
  } else {
    // the ledges: darker walnut, a gold line near the edge
    col = wood(q * vec2(1.2, 2.6) + vec2(0.0, q.x * 0.0), vec3(0.11, 0.06, 0.035), vec3(0.24, 0.125, 0.065), 5.0, 2.0);
    float edgeLine = 1.0 - smoothstep(0.0, 0.004, abs(mx - (hb + uB + 0.07)) - 0.004);
    col = mix(col, goldC * 0.7, edgeLine * 0.55);
    alpha = 1.0;
  }
  vec4 tx = texture2D(tText, vUv);
  col = mix(col, vec3(0.93, 0.78, 0.42), tx.a * 0.96);
  gl_FragColor = vec4(col, alpha);
}`
const SIDE_FRAG = /* glsl */ `void main() { vec2 q = vec2(vUv.x * 7.0, vUv.y * 0.6); vec3 c = wood(q, vec3(0.12, 0.06, 0.035), vec3(0.28, 0.14, 0.075), 5.0, 8.0); gl_FragColor = vec4(c, 1.0); }`

// ---- the replay schedule
type SegKind = 'arc' | 'fly' | 'topple' | 'home'
interface Seg { k: SegKind; t0: number; t1: number; ax: number; az: number; bx: number; bz: number; h: number; spin: number; nx?: number; nz?: number }
interface PieceO {
  kind: Kind; white: boolean; i: number
  pivot: THREE.Group; mesh: THREE.Mesh; twin: THREE.Group; proxy: THREE.Mesh
  hx: number; hz: number; segs: Seg[]; lift: number; poke: number; hero: boolean
}
const tick = () => new Promise<void>(r => requestAnimationFrame(() => r()))
const TOP_PAUSE = 5.2, HOME_T = 1.15, START_AT = 1.5

export function createChess(): Stage {
  const root = new THREE.Group(); root.name = 'cab-knight'; root.userData.contactShadow = { size: 5, opacity: 0.5 }
  const pick: THREE.Object3D[] = []
  const pieces: PieceO[] = []
  let kit: Kit
  let ply: Ply[] = []
  let T_MATE = 0, T_LOOP = 0
  let built = false
  let blobs: THREE.InstancedMesh, ring: THREE.Mesh, ringMat: THREE.MeshBasicMaterial, checkRing: THREE.Mesh, checkMat: THREE.MeshBasicMaterial, hoverRing: THREE.Mesh, hoverMat: THREE.MeshBasicMaterial
  let heroPool: THREE.Mesh
  const mirror = new THREE.Group(); mirror.scale.y = -1
  const checks: { t: number; x: number; z: number }[] = []
  const lands: { t: number; x: number; z: number }[] = []
  let hovered: PieceO | null = null
  const plyT0: number[] = [], endT: number[] = []
  let manualTarget: number | null = null, idleT = 0, hoverBtn = -1, btnDip = [0, 0], btnHov = [0, 0], wallT = 0, lastSound = 0
  let dotM: THREE.MeshBasicMaterial, capM: THREE.MeshBasicMaterial
  const btns: THREE.Mesh[] = [], dotPool: THREE.Mesh[] = [], ringPool: THREE.Mesh[] = []
  let dotKey = '', labelK = -2, labelTex: THREE.CanvasTexture, labelG: CanvasRenderingContext2D
  let clock = 0, wasHidden = true

  // ------------------------------------------------------------------ build
  async function build(k: Kit) {
    kit = k
    const env = sharedEnv(k.renderer)
    await loadFonts(1500)
    // ---- the top: marble, walnut, frame, engraved coordinates (GPU bake + a small text canvas)
    const text = canvasTex(2048, 2048, (g, w, h) => {
      g.clearRect(0, 0, w, h)
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'
      const px = (x: number) => ((x + W / 2) / W) * w, py = (z: number) => ((z - (CZ - DEPTH / 2)) / DEPTH) * h
      g.font = fontOf('roman', Math.round(w * 0.0215))
      const mid = HB + BORDER / 2
      for (let f = 0; f < 8; f++) { const ch = 'abcdefgh'[f]; g.fillText(ch, px(sqX(f)), py(mid) + 3); g.fillText(ch, px(sqX(f)), py(-mid) + 3) }
      for (let r = 0; r < 8; r++) { const ch = String(r + 1); g.fillText(ch, px(-mid), py(sqZ(r)) + 3); g.fillText(ch, px(mid), py(sqZ(r)) + 3) }
    })
    const topRT = bake(k.renderer, 2048, 2048, TOP_FRAG, { tText: { value: text }, uDim: { value: new THREE.Vector2(W, DEPTH) }, uS: { value: S }, uB: { value: BORDER }, uCz: { value: CZ } })
    text.dispose()
    await tick()
    const sideRT = bake(k.renderer, 512, 128, SIDE_FRAG)
    const topMat = new THREE.MeshPhysicalMaterial({
      map: topRT.texture, transparent: true, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMap: env, envMapIntensity: 1.5,
    })
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, DEPTH), topMat)
    top.rotation.x = -Math.PI / 2; top.position.set(0, 0, CZ); top.renderOrder = 1
    // ---- the plinth: a hollow walnut slab (open top: the lacquered top is transparent, so the reflections show through), brass edging
    const sideMat = new THREE.MeshStandardMaterial({ map: sideRT.texture, roughness: 0.38, metalness: 0, envMap: env, envMapIntensity: 1.1 })
    const hidden = new THREE.MeshBasicMaterial({ visible: false })
    // the frame, the brass beads and the pedestal come from Blender (scripts/blender/chess.py: moulded walnut, brass that follows the rounded corners, a chamfered base); null = the boxes below
    const glb = await loadGLB('chess-board')
    const BASE_H = 1.95
    const baseMat = new THREE.MeshStandardMaterial({ color: D(0.03, 0.026, 0.024), roughness: 0.28, metalness: 0.6, envMap: env, envMapIntensity: 1.2 })
    const brass = new THREE.MeshStandardMaterial({ color: D(0.86, 0.66, 0.34), metalness: 1, roughness: 0.26, envMap: env, envMapIntensity: 1.8 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, DEPTH - 0.4), new THREE.MeshBasicMaterial({ color: D(0.01, 0.008, 0.007), toneMapped: false }))
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1.9, CZ)
    if (glb) {
      const parts = meshesByName(glb)
      const mats: Record<string, THREE.Material> = { slab: withAO(sideMat, { direct: 0.3 }), brass: withAO(brass, { direct: 0.2 }), base: withAO(baseMat, { direct: 0.3 }) }
      for (const [n, m] of parts) if (mats[n]) { m.material = mats[n]; m.parent?.remove(m); root.add(m) }
      root.add(top, floor)
    } else {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, SLAB, DEPTH), [sideMat, sideMat, hidden, hidden, sideMat, sideMat])
    slab.position.set(0, -SLAB / 2, CZ)
    // below the walnut: a deep, dark, glossy pedestal (the pieces' reflections need room under the top, and this hides their ends)
    const base = new THREE.Mesh(new THREE.BoxGeometry(W - 0.34, BASE_H, DEPTH - 0.34), [baseMat, baseMat, hidden, baseMat, baseMat, baseMat])
    base.position.set(0, -SLAB - BASE_H / 2 + 0.02, CZ)
    const trim = (w: number, d: number, x: number, z: number, y: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.045, d), brass); m.position.set(x, y, z); return m }
    const T = 0.06
    root.add(top, slab, base, floor,
      trim(W + T, T, 0, CZ - DEPTH / 2, -0.012), trim(W + T, T, 0, CZ + DEPTH / 2, -0.012), trim(T, DEPTH + T, -W / 2, CZ, -0.012), trim(T, DEPTH + T, W / 2, CZ, -0.012),
      trim(W + T, T, 0, CZ - DEPTH / 2, -SLAB + 0.02), trim(W + T, T, 0, CZ + DEPTH / 2, -SLAB + 0.02), trim(T, DEPTH + T, -W / 2, CZ, -SLAB + 0.02), trim(T, DEPTH + T, W / 2, CZ, -SLAB + 0.02))
    }
    // ---- pieces
    const matW = new THREE.MeshPhysicalMaterial({ color: D(0.86, 0.77, 0.62), roughness: 0.34, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.14, vertexColors: true, envMap: env, envMapIntensity: 1.5 })
    const matB = new THREE.MeshPhysicalMaterial({ color: D(0.075, 0.066, 0.06), roughness: 0.24, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, vertexColors: true, envMap: env, envMapIntensity: 2.0 })
    const geos = new Map<Kind, THREE.BufferGeometry>(), lowGeos = new Map<Kind, THREE.BufferGeometry>()
    await tick()
    for (const kd of ['P', 'R', 'N', 'B', 'Q', 'K'] as Kind[]) { geos.set(kd, pieceGeo(kd, 0)); await tick() }
    for (const kd of ['P', 'R', 'N', 'B', 'Q', 'K'] as Kind[]) lowGeos.set(kd, pieceGeo(kd, 1))
    await tick()
    const proxyGeo = new THREE.CylinderGeometry(1, 1, 1, 10); proxyGeo.translate(0, 0.5, 0)
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false })
    const back = 'RNBQKBNR'
    const make = (kind: Kind, white: boolean, f: number, r: number, hero = false): PieceO => {
      const R = RAD[kind] * (hero ? 1.75 : 1), Hh = NAT[kind] * RAD[kind] * STRETCH * (hero ? 1.75 : 1)
      const pivot = new THREE.Group(), twin = new THREE.Group()
      const mesh = new THREE.Mesh(geos.get(kind)!, white ? matW : matB); mesh.scale.set(R, R * STRETCH, R)
      if (kind === 'N') mesh.rotation.y = white ? (5 * Math.PI) / 6 : Math.PI / 6          // profile, turned a little toward the camera: White looks right, Black looks left
      pivot.add(mesh)
      const t2 = new THREE.Mesh(lowGeos.get(kind)!, mesh.material); t2.scale.copy(mesh.scale); t2.rotation.copy(mesh.rotation); twin.add(t2)
      const proxy = new THREE.Mesh(proxyGeo, proxyMat); proxy.scale.set(R * 1.05, Hh * 1.02, R * 1.05)
      pivot.add(proxy)
      const p: PieceO = { kind, white, i: pieces.length, pivot, mesh, twin, proxy, hx: hero ? HERO_AT.x : sqX(f), hz: hero ? HERO_AT.z : sqZ(r), segs: [], lift: 0, poke: 0, hero }
      proxy.userData.piece = p
      pivot.position.set(p.hx, 0, p.hz); twin.position.copy(pivot.position)
      root.add(pivot); mirror.add(twin); pick.push(proxy); pieces.push(p)
      return p
    }
    const grid: (PieceO | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null))
    for (let f = 0; f < 8; f++) {
      grid[0][f] = make(back[f] as Kind, true, f, 0); grid[1][f] = make('P', true, f, 1)
      grid[6][f] = make('P', false, f, 6); grid[7][f] = make(back[f] as Kind, false, f, 7)
    }
    const hero = make('N', true, 0, 0, true)
    root.add(mirror)
    // ---- soft contact shadows, rings, the hero's pool of light
    blobs = makeBlobs(pieces.length + 1, 0.5); root.add(blobs)
    const ringGeo = new THREE.RingGeometry(0.78, 1, 48); ringGeo.rotateX(-Math.PI / 2)
    const mkRing = (rgb: [number, number, number]) => { const m = new THREE.MeshBasicMaterial({ color: D(...rgb), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); const me = new THREE.Mesh(ringGeo, m); me.position.y = 0.006; me.visible = false; me.renderOrder = 5; root.add(me); return [me, m] as const }
    ;[ring, ringMat] = mkRing([0.95, 0.8, 0.5]); [checkRing, checkMat] = mkRing([1.0, 0.28, 0.2]); [hoverRing, hoverMat] = mkRing([1.0, 0.86, 0.55])
    const dotGeo = new THREE.CircleGeometry(0.15, 24); dotGeo.rotateX(-Math.PI / 2)
    const dotMat = new THREE.MeshBasicMaterial({ color: D(0.86, 0.52, 0.06), transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
    const capMat = new THREE.MeshBasicMaterial({ color: D(0.86, 0.16, 0.1), transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
    const capGeo = new THREE.RingGeometry(0.22, 0.3, 28); capGeo.rotateX(-Math.PI / 2)
    for (let i = 0; i < 30; i++) {
      const d = new THREE.Mesh(dotGeo, dotMat), c2 = new THREE.Mesh(capGeo, capMat); d.visible = c2.visible = false; d.renderOrder = c2.renderOrder = 6
      root.add(d, c2); dotPool.push(d); ringPool.push(c2)
    }
    dotM = dotMat; capM = capMat
    heroPool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(1, 0.74, 0.42), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
    heroPool.rotation.x = -Math.PI / 2; heroPool.scale.set(2.6, 2.6, 1); heroPool.position.set(HERO_AT.x, 0.008, HERO_AT.z); heroPool.renderOrder = 3
    root.add(heroPool)
    // ---- the move pad on the front ledge: two brass step buttons and a plate that names the move on the board
    const ledgeZ = HB + BORDER + FRONT / 2
    const plateTex = (draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => canvasTex(256, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e8c987'); gr.addColorStop(0.5, '#c79b52'); gr.addColorStop(1, '#a87e3a'); g.fillStyle = gr; g.fillRect(0, 0, w, h)
      g.strokeStyle = 'rgba(255,240,200,0.55)'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); draw(g, w, h)
    })
    const arrow = (dir: number) => plateTex((g, w, h) => { g.fillStyle = '#2a1a0a'; g.beginPath(); g.moveTo(w / 2 + dir * 34, h / 2); g.lineTo(w / 2 - dir * 24, h / 2 - 34); g.lineTo(w / 2 - dir * 24, h / 2 + 34); g.closePath(); g.fill(); g.fillRect(w / 2 + dir * 34 - (dir > 0 ? 0 : -6), h / 2 - 34, 6, 68) })
    ;[-1, 1].forEach((dir, bi) => {
      const mat = new THREE.MeshStandardMaterial({ map: arrow(dir), roughness: 0.3, metalness: 0.55, envMap: env, envMapIntensity: 1.5, emissive: new THREE.Color(0, 0, 0) })
      const b = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.1, 0.36, 3, 0.04), mat)
      b.position.set(dir * 1.3, 0.05, ledgeZ); b.userData.btn = bi; b.userData.base = 0.05
      root.add(b); btns.push(b); pick.push(b)
    })
    const LW = 512, LH = 160
    const lab = canvasTex(LW, LH, () => {}); labelTex = lab as unknown as THREE.CanvasTexture; labelG = (lab.image as HTMLCanvasElement).getContext('2d')!
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 0.52), new THREE.MeshBasicMaterial({ map: lab, toneMapped: false })); plate.rotation.x = -Math.PI / 2; plate.position.set(0, 0.012, ledgeZ); root.add(plate)
    drawLabel(-1)
    // ---- the schedule: legal moves only (rules.ts throws on anything else)
    ply = replay(OPERA_GAME)
    schedule(grid)
    precompile(k, root)
    root.visible = false
    built = true
  }

  /** build every piece's list of motions from the game */
  function schedule(grid: (PieceO | null)[][]) {
    const at: (PieceO | null)[][] = grid.map(r => r.slice())
    let t = START_AT, wCap = 0, bCap = 0
    plyT0.length = 0; endT.length = 0
    const slot = (white: boolean) => white ? [-3.0 + 0.46 * wCap++, LEDGE_Z] : [3.0 - 0.46 * bCap++, LEDGE_Z]   // a captured WHITE piece goes to the left end, a black one to the right
    ply.forEach((pl, n) => {
      const m = pl.move, from = at[m.from[1]][m.from[0]]
      if (!from) throw new Error(`replay: no piece on ${m.from} at ply ${n + 1}`)
      plyT0.push(t)
      const dist = Math.hypot(m.to[0] - m.from[0], m.to[1] - m.from[1])
      const knight = from.kind === 'N'
      const dur = knight ? 0.95 : 0.62 + 0.07 * Math.min(4, dist)
      const h = knight ? 0.95 : (m.capture ? 0.5 : 0.3) + 0.03 * dist
      let segEnd = t + dur
      from.segs.push({ k: 'arc', t0: t, t1: t + dur, ax: sqX(m.from[0]), az: sqZ(m.from[1]), bx: sqX(m.to[0]), bz: sqZ(m.to[1]), h, spin: 0 })
      if (m.castle) {
        const rk = at[m.castle.rookFrom[1]][m.castle.rookFrom[0]]!
        rk.segs.push({ k: 'arc', t0: t + dur * 0.2, t1: t + dur * 1.15, ax: sqX(m.castle.rookFrom[0]), az: sqZ(m.castle.rookFrom[1]), bx: sqX(m.castle.rookTo[0]), bz: sqZ(m.castle.rookTo[1]), h: 0.55, spin: 0 })
        at[m.castle.rookTo[1]][m.castle.rookTo[0]] = rk; at[m.castle.rookFrom[1]][m.castle.rookFrom[0]] = null
        segEnd = Math.max(segEnd, t + dur * 1.15)
      }
      if (m.capture && m.captureAt) {
        const vic = at[m.captureAt[1]][m.captureAt[0]]!
        const [sx, sz] = slot(vic.white)
        const tf = t + dur * 0.76
        vic.segs.push({ k: 'fly', t0: tf, t1: tf + 0.85, ax: sqX(m.captureAt[0]), az: sqZ(m.captureAt[1]), bx: sx, bz: sz, h: 1.25, spin: (n % 2 ? 1 : -1) * Math.PI * 2 })
        at[m.captureAt[1]][m.captureAt[0]] = null
        segEnd = Math.max(segEnd, tf + 0.85)
      }
      at[m.from[1]][m.from[0]] = null; at[m.to[1]][m.to[0]] = from
      lands.push({ t: t + dur, x: sqX(m.to[0]), z: sqZ(m.to[1]) })
      t += dur + (m.capture ? 0.62 : 0.42) + (m.check ? 0.35 : 0)
      endT.push(Math.min(segEnd, t))
    })
    // the mate: the black king topples away from the rook
    const last = ply[ply.length - 1].move
    const bk = pieces.find(p => p.kind === 'K' && !p.white)!
    const kx = sqX(4), kz = sqZ(7)
    void last
    bk.segs.push({ k: 'topple', t0: t - 0.2, t1: t + 0.75, ax: kx, az: kz, bx: kx, bz: kz, h: 0, spin: 0, nx: 0.35, nz: -0.94 })
    T_MATE = t + 0.75
    endT[endT.length - 1] = T_MATE
    // glide home
    let idx = 0
    for (const p of pieces) {
      if (p.hero) continue
      const lastSeg = p.segs[p.segs.length - 1]
      const sx = lastSeg ? lastSeg.bx : p.hx, sz = lastSeg ? lastSeg.bz : p.hz
      const t0 = T_MATE + TOP_PAUSE + (idx++ % 16) * 0.035
      if (Math.hypot(sx - p.hx, sz - p.hz) > 0.01 || (lastSeg && lastSeg.k === 'topple')) p.segs.push({ k: 'home', t0, t1: t0 + HOME_T, ax: sx, az: sz, bx: p.hx, bz: p.hz, h: 0.45, spin: 0 })
    }
    T_LOOP = T_MATE + TOP_PAUSE + HOME_T + 0.6 + 16 * 0.035
    // checks: fill the king's square
    checks.length = 0
    ply.forEach((pl, n) => {
      if (!pl.move.check) return
      const kingW = pl.move.piece === pl.move.piece.toUpperCase() ? 'k' : 'K'
      let kx2 = 0, kz2 = 0
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) if (pl.after.board[r][f] === kingW) { kx2 = sqX(f); kz2 = sqZ(r) }
      checks.push({ t: lands[n].t + 0.02, x: kx2, z: kz2 })
    })
  }

  /** the plate between the buttons: the move now on the board, and how far through the game it is */
  function drawLabel(k: number) {
    labelK = k
    const g = labelG, w = 512, h = 160
    g.fillStyle = '#16110b'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(232,201,135,0.5)'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8)
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f0d9a2'
    const san = k <= 0 ? 'Start' : ply[k - 1].move.san, no = Math.ceil(Math.max(1, k) / 2), pre = k <= 0 ? '' : k % 2 ? `${no}. ` : `${no}\u2026 `
    g.font = fontOf('roman', 78); g.fillText(pre + san, w / 2, h * 0.42)
    g.fillStyle = 'rgba(240,217,162,0.62)'; g.font = fontOf('roman', 36); g.fillText(`${Math.max(0, k)} / ${ply.length}`, w / 2, h * 0.82)
    labelTex.needsUpdate = true
  }
  /** plies whose move has landed by stage time c */
  const doneAt = (c: number) => { let k = 0; while (k < lands.length && lands[k].t <= c + 0.001) k++; return k }
  const startedAt = (c: number) => { let k = 0; while (k < plyT0.length && plyT0[k] <= c + 0.001) k++; return k }
  const holdAt = (k: number) => (k <= 0 ? START_AT - 0.4 : endT[Math.min(k, endT.length) - 1])
  function step(dir: number) {
    const total = ply.length
    if (manualTarget == null) manualTarget = doneAt(clock) + (startedAt(clock) > doneAt(clock) && dir > 0 ? 1 : 0)
    if (dir > 0 && manualTarget >= total) { clock = holdAt(0); manualTarget = 0 }
    else manualTarget = Math.max(0, Math.min(total, manualTarget + dir))
    if (kit.reduced()) clock = holdAt(manualTarget)
    idleT = 0; kit.emit('obj:move', { dir }); stamp('moveAt')
  }
  /** light the dots of the hovered piece's legal moves in the position now on the board */
  function showMoves(p: PieceO | null, moving: boolean, k: number) {
    const key = p && !moving && !p.hero ? `${p.i}:${k}` : ''
    if (key === dotKey) return
    dotKey = key
    for (const d of dotPool) d.visible = false
    for (const d of ringPool) d.visible = false
    if (!p || !key) return
    const f = Math.round(p.pivot.position.x / S + 3.5), r = Math.round(3.5 - p.pivot.position.z / S)
    if (f < 0 || f > 7 || r < 0 || r > 7) return
    const pos = k <= 0 ? startPosition() : ply[k - 1].after, ch = pos.board[r]?.[f]
    if (!ch || (ch === ch.toUpperCase()) !== p.white || ch.toUpperCase() !== p.kind) return
    const mv = legalMoves({ ...pos, turn: colourOf(ch), ep: pos.turn === colourOf(ch) ? pos.ep : null }).filter(m => m.from[0] === f && m.from[1] === r)
    let di = 0, ri = 0
    for (const m of mv) {
      const cap = !!m.capture, m3 = cap ? ringPool[ri++] : dotPool[di++]
      if (!m3) continue
      m3.visible = true; m3.position.set(sqX(m.to[0]), 0.012, sqZ(m.to[1]))
    }
  }

  // ------------------------------------------------------------------ the pose of one piece at stage time t
  const Q = new THREE.Quaternion(), AX = new THREE.Vector3(), EDGE = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0)
  function pose(p: PieceO, t: number) {
    let x = p.hx, z = p.hz, y = 0, yaw = 0, tip = 0, nx = 0, nz = 0
    for (const s of p.segs) {
      if (t >= s.t1) { x = s.bx; z = s.bz; y = 0; yaw = s.k === 'fly' ? s.spin : 0; if (s.k === 'topple') { tip = Math.PI / 2 * 0.985; nx = s.nx!; nz = s.nz! } else tip = 0; continue }
      if (t >= s.t0) {
        const u = (t - s.t0) / (s.t1 - s.t0)
        if (s.k === 'topple') { const e = u < 0.78 ? Math.pow(u / 0.78, 2.1) : 1 - 0.05 * Math.sin(((u - 0.78) / 0.22) * Math.PI); tip = Math.PI / 2 * 0.985 * e; nx = s.nx!; nz = s.nz!; x = s.bx; z = s.bz }
        else {
          const e = s.k === 'fly' ? u : u * u * (3 - 2 * u)
          x = lerp(s.ax, s.bx, e); z = lerp(s.az, s.bz, e)
          y = s.k === 'fly' ? s.h * 4 * u * (1 - u) : s.h * Math.sin(Math.PI * u)
          if (s.k === 'fly') yaw = s.spin * u
          tip = s.k === 'home' ? tip * (1 - sstep(0, 0.35, u)) : 0
        }
      }
      break
    }
    return { x, z, y, yaw, tip, nx, nz }
  }

  // ------------------------------------------------------------------ frame
  function update(time: number, dt: number, r: number, dwell: boolean, _st: FlightState) {
    if (!built) return
    const rm = kit.reduced()
    if (r <= 0.0005) { if (!wasHidden) { wasHidden = true; clock = 0 } root.visible = false; return }
    wasHidden = false; root.visible = true
    // ---- the whole set rises onto its plinth as the camera arrives (and sinks as it leaves), a pure function of r
    enter(root, r, rm)
    // ---- the clock: it runs while the visitor stays (the dwell), not while the camera flies
    wallT += dt
    if (rm) clock = manualTarget != null ? holdAt(manualTarget) : T_MATE + 0.5
    else if (dwell && r > 0.98) {
      if (manualTarget != null) {                                           // stepped by hand: run (or rewind) to the hold time of the target ply, then wait
        const goal = holdAt(manualTarget), d = goal - clock, sp = 1.8 * Math.min(dt, 0.1)
        clock += Math.abs(d) <= sp ? d : Math.sign(d) * sp
        if (Math.abs(goal - clock) < 1e-6) { idleT += dt; if (idleT > 14) manualTarget = null } else idleT = 0
      } else { clock += Math.min(dt, 0.1); if (clock > T_LOOP) clock = 0 }
    }
    // ---- poses
    const rise = (i: number) => (rm ? 1 : easeOutBack(clamp01((r - 0.3 - 0.011 * i) / 0.42), 1.25))
    for (let n = 0; n < pieces.length; n++) {
      const p = pieces[n]
      let { x, z, y, yaw, tip, nx, nz } = pose(p, clock)
      const moving = p.segs.some(s => clock >= s.t0 && clock < s.t1)
      const wantLift = p === hovered && !moving && !rm ? 1 : 0
      p.lift = damp(p.lift, wantLift, 0.09, dt); p.poke = damp(p.poke, 0, 0.18, dt)
      const drop = (1 - rise(p.hero ? 0 : n)) * 2.2
      let base = 0
      if (p.hero) {
        p.pivot.rotation.y = (rm ? 0.1 : 0.34 * Math.sin(time * 0.31) + 0.05) + p.poke * 6.283
        base = 0.14 * p.lift
      }
      p.pivot.position.set(x, y + drop + p.lift * 0.26 + p.poke * 0.18 + base, z)
      if (tip > 0) {
        AX.set(nz, 0, -nx).normalize(); Q.setFromAxisAngle(AX, tip); EDGE.set(nx, 0, nz).normalize().multiplyScalar(RAD[p.kind])
        p.pivot.quaternion.copy(Q)
        p.pivot.position.x += EDGE.x - EDGE.clone().applyQuaternion(Q).x; p.pivot.position.z += EDGE.z - EDGE.clone().applyQuaternion(Q).z; p.pivot.position.y += EDGE.y - EDGE.clone().applyQuaternion(Q).y
      } else if (!p.hero) { p.pivot.quaternion.setFromAxisAngle(UPV, yaw) }
      p.twin.position.copy(p.pivot.position); p.twin.quaternion.copy(p.pivot.quaternion)
      p.twin.visible = !p.hero && Math.abs(p.pivot.position.z) < HB + BORDER && Math.abs(p.pivot.position.x) < HB + BORDER   // the ledges are opaque: nothing is reflected there
      // blob: a soft pool under the piece, wider and fainter as it lifts
      const hgt = p.pivot.position.y
      const R = RAD[p.kind] * (p.hero ? 1.75 : 1)
      setBlob(blobs, n, x, 0.004, z, R * 3.3 * (1 + hgt * 0.9), R * 3.3 * (1 + hgt * 0.9))
    }
    heroPool.visible = true
    const doneK = doneAt(clock)
    if (labelK !== doneK) drawLabel(doneK)
    const hov = hovered && !rm && !pieces.some(q => q === hovered && q.segs.some(sg => clock >= sg.t0 && clock < sg.t1)) ? hovered : null
    showMoves(hov, !hov && !!hovered, doneK)
    const lift = hov ? hov.lift : 0
    dotM.opacity = 0.9 * lift * (0.8 + 0.2 * Math.sin(time * 5)); capM.opacity = 0.95 * lift
    for (let b = 0; b < 2; b++) {
      btnHov[b] = damp(btnHov[b], hoverBtn === b ? 1 : 0, 0.08, dt); btnDip[b] = damp(btnDip[b], 0, 0.12, dt)
      const bm = btns[b]; bm.position.y = 0.05 - 0.035 * btnDip[b] + 0.012 * btnHov[b]
      ;(bm.material as THREE.MeshStandardMaterial).emissive.setRGB(0.45 * btnHov[b], 0.3 * btnHov[b], 0.1 * btnHov[b])
    }
    // ---- ripples: a ring where a move lands, a red pulse under a king in check
    const rp = lands.find(l => clock >= l.t && clock < l.t + 0.9)
    if (rp && !rm) { const u = (clock - rp.t) / 0.9; ring.visible = true; ring.position.set(rp.x, 0.006, rp.z); const s = lerp(0.2, 0.72, 1 - Math.pow(1 - u, 2)); ring.scale.set(s, 1, s); ringMat.opacity = 0.5 * (1 - u) } else ring.visible = false
    const cp = checks.find(c => clock >= c.t && clock < c.t + 1.5)
    if (cp && !rm) { const u = (clock - cp.t) / 1.5; checkRing.visible = true; checkRing.position.set(cp.x, 0.007, cp.z); const s = lerp(0.3, 0.62, u); checkRing.scale.set(s, 1, s); checkMat.opacity = 0.9 * (1 - u) * (0.6 + 0.4 * Math.sin(u * 22)) } else checkRing.visible = false
    if (hovered && !rm) { hoverRing.visible = true; hoverRing.position.set(hovered.pivot.position.x, 0.008, hovered.pivot.position.z); const s = RAD[hovered.kind] * (hovered.hero ? 1.75 : 1) * 1.9; hoverRing.scale.set(s, 1, s); hoverMat.opacity = 0.55 * hovered.lift } else hoverRing.visible = false
    blobs.instanceMatrix.needsUpdate = true
  }

  return {
    id: 'knight', root, dim: 0.05, pick,
    build, update,
    hover(o) {
      hoverBtn = typeof o?.userData.btn === 'number' ? (o.userData.btn as number) : -1
      const p = (o?.userData.piece as PieceO | undefined) ?? null
      if (p !== hovered) { hovered = p; if (p && wallT - lastSound > 0.1) { lastSound = wallT; kit.emit('cab:hover', { piece: p.kind }); stamp('hoverAt'); kit.emit('obj:lift', { piece: p.kind }) } }
    },
    press(o) {
      if (typeof o?.userData.btn === 'number') { const b = o.userData.btn as number; btnDip[b] = 1; step(b === 0 ? -1 : 1); return }
      const p = (o?.userData.piece as PieceO | undefined); if (p) { p.poke = 1; kit.emit('cab:press', { piece: p.kind }) }
    },
    act(name) { if (name === 'next') { step(1); return 'Stepped forward one move.' } if (name === 'prev') { step(-1); return 'Stepped back one move.' } return '' },
    demo() { step(1) },
    api: { get clock() { return clock }, set clock(v: number) { clock = v }, btns, get manualTarget() { return manualTarget }, get dotsShown() { return dotPool.filter(d => d.visible).length + ringPool.filter(d => d.visible).length }, get done() { return labelK }, get T_MATE() { return T_MATE }, get T_LOOP() { return T_LOOP }, get plies() { return ply }, pieces, get hovered() { return hovered ? `${hovered.white ? 'w' : 'b'}${hovered.kind}${hovered.hero ? ' hero' : ''}` : null } },
    dispose() { disposeTree(root); blobTexture().dispose() },
  }
}
