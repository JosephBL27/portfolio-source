// Lathe-turned Staunton chess pieces, and the sculpted knight (unit 8O).
//  * `lathe()`: a turned solid from an (r, y) profile with real creases (a crease is a duplicated vertex with two normals, so a collar's
//    edge stays crisp while the cove under it stays smooth); three's LatheGeometry smooths every corner.
//  * `profile()`: smooth Catmull-Rom runs between creases, so a profile is a handful of control points.
//  * pawn, rook (crenellated), bishop (mitre with its slit, ball), queen (crown of balls), king (cross).
//  * the knight: the silhouette of the particle knight (forms/knight.ts) inflated into a pillow (thickness follows the distance to the
//    outline), meshed on a grid with rim stitching, carved with an eye, nostril, mouth and mane strands, standing on a turned base.
// Every geometry carries position / normal / uv / colour (vertex colour darkens recesses) so they can merge into one draw call per piece.
import * as THREE from 'three'
import { merge, paint, uniformGeo } from './kit'

export type LP = [number, number, number?]      // r, y, 1 = crease at this point
const S = 1

/** sample smooth runs between creases; returns [r, y, crease] */
export function profile(ctrl: LP[], perUnit = 26): [number, number, boolean][] {
  const out: [number, number, boolean][] = []
  let run: LP[] = []
  const flush = () => {
    if (run.length < 2) return
    const v = run.map(p => new THREE.Vector2(p[0], p[1]))
    let len = 0; for (let i = 1; i < v.length; i++) len += v[i].distanceTo(v[i - 1])
    const n = Math.max(1, Math.ceil(len * perUnit))
    const pts = run.length === 2 ? [v[0], v[1]] : new THREE.SplineCurve(v).getPoints(n)
    if (run.length === 2 && n > 1) { pts.length = 0; for (let i = 0; i <= n; i++) pts.push(v[0].clone().lerp(v[1], i / n)) }
    pts.forEach((p, i) => { if (out.length && i === 0) { out[out.length - 1][2] = true; return } out.push([Math.max(0, p.x), p.y, false]) })
  }
  ctrl.forEach((p, i) => {
    run.push(p)
    if (p[2] && i > 0 && i < ctrl.length - 1) { flush(); run = [p] }
  })
  flush()
  return out
}

/** turn a profile (bottom to top, r >= 0) about the y axis */
export function lathe(prof: [number, number, boolean][], seg = 56): THREE.BufferGeometry {
  // per-vertex ring entries: creases are doubled
  interface E { r: number; y: number; nr: number; ny: number; link: boolean; v: number }
  const segN: [number, number][] = []                       // outward normal (r, y) of segment i -> i+1
  for (let i = 0; i < prof.length - 1; i++) { const dr = prof[i + 1][0] - prof[i][0], dy = prof[i + 1][1] - prof[i][1], l = Math.hypot(dr, dy) || 1; segN.push([dy / l, -dr / l]) }
  const es: E[] = []
  let arc = 0
  for (let i = 0; i < prof.length; i++) {
    if (i > 0) arc += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1])
    const a = segN[i - 1], b = segN[i]
    if (!a) es.push({ r: prof[i][0], y: prof[i][1], nr: b[0], ny: b[1], link: true, v: arc })
    else if (!b) es.push({ r: prof[i][0], y: prof[i][1], nr: a[0], ny: a[1], link: false, v: arc })
    else if (prof[i][2]) { es.push({ r: prof[i][0], y: prof[i][1], nr: a[0], ny: a[1], link: false, v: arc }); es.push({ r: prof[i][0], y: prof[i][1], nr: b[0], ny: b[1], link: true, v: arc }) }
    else { const nr = a[0] + b[0], ny = a[1] + b[1], l = Math.hypot(nr, ny) || 1; es.push({ r: prof[i][0], y: prof[i][1], nr: nr / l, ny: ny / l, link: true, v: arc }) }
  }
  const K = es.length, pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = []
  for (let i = 0; i <= seg; i++) {
    const phi = (i / seg) * Math.PI * 2, s = Math.sin(phi), c = Math.cos(phi)
    for (const e of es) { pos.push(e.r * s, e.y, e.r * c); nor.push(e.nr * s, e.ny, e.nr * c); uv.push(i / seg, e.v) }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < K - 1; j++) {
    if (!es[j].link) continue
    const a = i * K + j, b = (i + 1) * K + j, c = b + 1, d = a + 1
    idx.push(a, b, d, c, d, b)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

// ------------------------------------------------------------------------------------------------ the common foot and collar
const FOOT: LP[] = [[0, 0], [1, 0, S], [1, 0.12], [0.97, 0.18], [0.9, 0.205, S], [0.86, 0.24], [0.8, 0.3]]
const collar = (y: number, r: number): LP[] => [[r * 0.62, y, S], [r, y + 0.02, S], [r * 1.04, y + 0.07], [r, y + 0.12, S], [r * 0.64, y + 0.15, S]]

function ball(r: number, x: number, y: number, z: number): THREE.BufferGeometry { const g = new THREE.SphereGeometry(r, q.ball[0], q.ball[1]); g.translate(x, y, z); return g }
function roundedBar(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const s = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r
  s.moveTo(-x, -h / 2); s.lineTo(x, -h / 2); s.absarc(x, -y, r, -Math.PI / 2, 0); s.lineTo(w / 2, y); s.absarc(x, y, r, 0, Math.PI / 2); s.lineTo(-x, h / 2); s.absarc(-x, y, r, Math.PI / 2, Math.PI); s.lineTo(-w / 2, -y); s.absarc(-x, -y, r, Math.PI, Math.PI * 1.5)
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r * 0.5, bevelEnabled: true, bevelSize: r * 0.5, bevelThickness: r * 0.5, bevelSegments: 3, curveSegments: 6 })
  g.translate(0, 0, -(d - r) / 2)
  return g
}

export type Kind = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'
/** level of detail: 0 = the pieces you look at, 1 = the mirror image under the board (a tenth of the triangles) */
interface Q { seg: number; per: number; cell: number; ball: [number, number] }
const QUAL: Q[] = [{ seg: 44, per: 11, cell: 4, ball: [14, 9] }, { seg: 18, per: 4, cell: 8, ball: [7, 5] }]
let q: Q = QUAL[0]
/** natural-unit height of each piece (in base radii), for placing a lifted piece's shadow, the hover glow, ... */
export const NATURAL_H: Record<Kind, number> = { P: 2.32, R: 2.52, N: 3.57, B: 3.3, Q: 2.85, K: 3.45 }

function pawn(): THREE.BufferGeometry {
  const ctrl: LP[] = [...FOOT, [0.62, 0.42], [0.5, 0.62], [0.42, 0.86], [0.4, 1.0], [0.42, 1.1, S], ...collar(1.12, 0.66), [0.4, 1.3, S], [0.36, 1.36], [0.34, 1.45]]
  const pts = profile(ctrl, q.per)
  // head: a sphere r 0.5 centred y 1.82
  const R = 0.5, cy = 1.82, t0 = Math.asin(0.34 / R)
  const nh = q === QUAL[0] ? 12 : 5
  for (let i = 1; i <= nh; i++) { const t = t0 + ((Math.PI - t0) * i) / nh; pts.push([R * Math.sin(t), cy - R * Math.cos(t), false]) }
  // the pieces are drawn with vertexColors (the knight's slit, the merged parts carry a 'color' attribute): a bare lathe has none, and a missing
  // colour attribute reads as black in WebGL, which turned the white pawns ebony. Give it an explicit all-white one.
  const g = lathe(pts, q.seg)
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3))
  return g
}
function rook(): THREE.BufferGeometry {
  const ctrl: LP[] = [...FOOT, [0.66, 0.42], [0.58, 0.7], [0.55, 1.15], [0.58, 1.42], [0.7, 1.6, S], [0.74, 1.64, S], [0.9, 1.7, S], [0.9, 2.15, S], [0.62, 2.15, S], [0, 2.15, S]]
  const body = lathe(profile(ctrl, q.per), q.seg)
  const parts: THREE.BufferGeometry[] = [body]
  // six merlons: annular sectors, bevelled
  const N = 6, span = (Math.PI * 2) / N * 0.58
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2 - span / 2, a1 = a0 + span
    const sh = new THREE.Shape(); sh.absarc(0, 0, 0.9, a0, a1, false); sh.absarc(0, 0, 0.62, a1, a0, true); sh.closePath()
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.34, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 6 })
    g.rotateX(-Math.PI / 2); g.translate(0, 2.15, 0)
    parts.push(g)
  }
  return merge(parts)
}
function bishop(): THREE.BufferGeometry {
  const ctrl: LP[] = [...FOOT, [0.62, 0.42], [0.5, 0.62], [0.42, 0.86], [0.4, 1.0], [0.42, 1.08, S], ...collar(1.1, 0.66), [0.4, 1.28, S], [0.36, 1.34], [0.34, 1.42, S], [0.5, 1.46, S], [0.53, 1.5], [0.5, 1.55, S], [0.4, 1.6, S]]
  const pts = profile(ctrl, q.per)
  // mitre: an egg, semi-axes a x b, centred y 2.15
  const a = 0.62, b = 0.86, cy = 2.26, t0 = Math.asin(0.4 / a) + 0.0, t1 = Math.PI - Math.asin(0.13 / a)
  const nm = q === QUAL[0] ? 18 : 6
  for (let i = 1; i <= nm; i++) { const t = t0 + ((t1 - t0) * i) / nm; pts.push([a * Math.sin(t), cy - b * Math.cos(t), false]) }
  const mit = lathe(pts, q === QUAL[0] ? 56 : 18)
  // the slit: push vertices of the mitre inward across a tilted plane, darken them
  const P = mit.getAttribute('position'), Cn = new Float32Array(P.count * 3).fill(1), tilt = 0.62
  const nx = Math.cos(tilt), ny = Math.sin(tilt)               // normal of the cutting plane (in the x-y plane); the cut is a diagonal band across the front (+z)
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i)
    if (y < 2.0 || y > 2.95 || z < 0.02) continue
    const d = (x - 0.0) * nx + (y - 2.62) * ny
    const w = 0.07, k = Math.max(0, 1 - Math.abs(d) / w)
    if (k > 0) { const f = 1 - 0.16 * k * k; P.setX(i, x * f); P.setZ(i, z * f); const c = 1 - 0.85 * k; Cn[i * 3] = c; Cn[i * 3 + 1] = c; Cn[i * 3 + 2] = c }
  }
  mit.setAttribute('color', new THREE.BufferAttribute(Cn, 3))
  mit.computeVertexNormals()
  return merge([mit, ball(0.17, 0, 3.12, 0)])
}
function queen(): THREE.BufferGeometry {
  const ctrl: LP[] = [...FOOT, [0.62, 0.42], [0.5, 0.62], [0.42, 0.86], [0.4, 1.0], [0.42, 1.08, S], ...collar(1.1, 0.7), [0.4, 1.28, S], [0.4, 1.4], [0.5, 1.66], [0.66, 1.94], [0.82, 2.2], [0.9, 2.34, S], [0.9, 2.42, S], [0.62, 2.46, S], [0.4, 2.46, S], [0, 2.46, S]]
  const parts: THREE.BufferGeometry[] = [lathe(profile(ctrl, q.per), q.seg)]
  const n = q === QUAL[0] ? 10 : 6
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = 0.78
    parts.push(ball(0.085, r * Math.sin(a), 2.54, r * Math.cos(a)))
  }
  parts.push(ball(0.2, 0, 2.62, 0))
  return merge(parts)
}
function king(): THREE.BufferGeometry {
  const ctrl: LP[] = [...FOOT, [0.62, 0.42], [0.5, 0.62], [0.42, 0.86], [0.4, 1.0], [0.42, 1.08, S], ...collar(1.1, 0.7), [0.4, 1.28, S], [0.4, 1.4], [0.5, 1.7], [0.66, 2.0], [0.8, 2.26], [0.86, 2.42, S], [0.84, 2.52], [0.7, 2.62, S], [0.4, 2.68, S], [0.3, 2.72], [0.24, 2.8, S], [0, 2.82, S]]
  const parts: THREE.BufferGeometry[] = [lathe(profile(ctrl, q.per), q.seg)]
  const v = roundedBar(0.2, 0.62, 0.2, 0.05); v.translate(0, 3.1, 0)
  const h = roundedBar(0.5, 0.18, 0.2, 0.05); h.translate(0, 3.2, 0)
  parts.push(v, h)
  return merge(parts)
}

// ------------------------------------------------------------------------------------------------ the knight
const SW = 400, SH = 580
/** the silhouette of forms/knight.ts (nose to the left, mane to the right), y down, in raster pixels */
function knightPath(g: CanvasRenderingContext2D) {
  g.beginPath()
  g.moveTo(112, 580); g.lineTo(112, 500)
  g.bezierCurveTo(108, 476, 100, 452, 104, 428); g.bezierCurveTo(110, 404, 134, 394, 144, 376)
  g.bezierCurveTo(116, 372, 86, 366, 62, 354); g.bezierCurveTo(36, 346, 18, 336, 12, 320)
  g.bezierCurveTo(4, 302, 8, 284, 18, 268); g.bezierCurveTo(38, 232, 70, 186, 104, 142)
  g.bezierCurveTo(116, 124, 120, 108, 122, 92); g.lineTo(128, 36); g.bezierCurveTo(132, 18, 140, 6, 150, 2)
  g.bezierCurveTo(160, 16, 168, 38, 172, 60); g.bezierCurveTo(194, 52, 222, 58, 246, 76)
  g.bezierCurveTo(232, 88, 240, 102, 264, 108); g.bezierCurveTo(246, 124, 256, 138, 284, 142)
  g.bezierCurveTo(266, 160, 278, 174, 306, 176); g.bezierCurveTo(288, 196, 300, 210, 328, 212)
  g.bezierCurveTo(310, 234, 322, 250, 348, 250); g.bezierCurveTo(332, 282, 342, 312, 354, 332)
  g.bezierCurveTo(358, 382, 352, 432, 358, 472); g.lineTo(360, 500); g.lineTo(360, 580)
  g.closePath(); g.fill()
}
const MOUTH: number[][] = [[18, 318], [52, 334], [100, 346], [138, 358]]
const segDist = (x: number, y: number, pts: number[][]) => {
  let best = 1e9
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1], dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy))
  }
  return best
}

/** inside-distance (px) of the silhouette: rasterise, two box blurs for rounded corners, chamfer transform, light smoothing */
function distanceField(): { d: Float32Array; inside: Uint8Array } {
  const c = document.createElement('canvas'); c.width = SW; c.height = SH
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#fff'; knightPath(g)
  const px = g.getImageData(0, 0, SW, SH).data
  let a = new Float32Array(SW * SH); for (let i = 0; i < a.length; i++) a[i] = px[i * 4 + 3] / 255
  const tmp = new Float32Array(a.length), R = 4
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < SH; y++) { let s = 0; const row = y * SW
      for (let x = -R; x <= R; x++) s += a[row + Math.min(SW - 1, Math.max(0, x))]
      for (let x = 0; x < SW; x++) { tmp[row + x] = s / (2 * R + 1); s += a[row + Math.min(SW - 1, x + R + 1)] - a[row + Math.max(0, x - R)] } }
    for (let x = 0; x < SW; x++) { let s = 0
      for (let y = -R; y <= R; y++) s += tmp[Math.min(SH - 1, Math.max(0, y)) * SW + x]
      for (let y = 0; y < SH; y++) { a[y * SW + x] = s / (2 * R + 1); s += tmp[Math.min(SH - 1, y + R + 1) * SW + x] - tmp[Math.max(0, y - R) * SW + x] } }
  }
  const inside = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) inside[i] = a[i] > 0.5 ? 1 : 0
  const d = new Float32Array(a.length), SQ = Math.SQRT2
  for (let i = 0; i < d.length; i++) d[i] = inside[i] ? 1e6 : 0
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const i = y * SW + x; if (!inside[i]) continue
    let v = d[i]
    if (x === 0 || y === 0) v = Math.min(v, 1)
    else v = Math.min(v, d[i - 1] + 1, d[i - SW] + 1, d[i - SW - 1] + SQ, d[i - SW + 1] + SQ)
    d[i] = v }
  for (let y = SH - 1; y >= 0; y--) for (let x = SW - 1; x >= 0; x--) { const i = y * SW + x; if (!inside[i]) continue
    let v = d[i]
    if (x === SW - 1 || y === SH - 1) v = Math.min(v, 1)
    else v = Math.min(v, d[i + 1] + 1, d[i + SW] + 1, d[i + SW + 1] + SQ, d[i + SW - 1] + SQ)
    d[i] = v }
  const s2 = new Float32Array(d.length)
  for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) { const i = y * SW + x; s2[i] = inside[i] ? (d[i] * 4 + d[i - 1] + d[i + 1] + d[i - SW] + d[i + SW]) / 8 : 0 }
  return { d: s2, inside }
}

/** the knight's head: a pillow inflated from the silhouette, meshed on a grid (cell `cell` px) with its rim stitched, then carved. Natural units: base radius 1. */
function knightHead(cell = 4): THREE.BufferGeometry {
  const { d, inside } = distanceField()
  const U = 1.3 / 256                      // px -> natural units (the neck base is 256 px wide and sits on a collar 1.3 wide)
  const HALF = 85, RB = 85                 // px: half thickness, rounding radius
  const YCUT = 500, YBASE = 1.0
  const prof = (dp: number) => (dp >= RB ? HALF : HALF * Math.sqrt(Math.max(0, 1 - (1 - dp / RB) * (1 - dp / RB))))
  const GW = Math.floor(SW / cell) + 1, GH = Math.floor(YCUT / cell) + 1
  const dAt = (gx: number, gy: number) => { const x = gx * cell, y = gy * cell; if (x >= SW || y > YCUT) return 0; const i = y * SW + x; return inside[i] ? d[i] : 0 }
  const has = new Uint8Array(GW * GH)
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) has[gy * GW + gx] = dAt(gx, gy) >= 0.9 ? 1 : 0
  const full = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < GW - 1 && cy < GH - 1 && has[cy * GW + cx] && has[cy * GW + cx + 1] && has[(cy + 1) * GW + cx] && has[(cy + 1) * GW + cx + 1]
  const pos: number[] = [], col: number[] = [], idx: number[] = []
  const vid = new Map<number, number>()
  const vtx = (gx: number, gy: number, side: number): number => {
    const key = (gy * GW + gx) * 2 + (side > 0 ? 1 : 0)
    let id = vid.get(key); if (id !== undefined) return id
    const x = gx * cell, y = gy * cell, dp = dAt(gx, gy)
    let z = side * prof(dp)
    let tone = 1
    // ---- carving: eye, nostril, mouth, mane strands (px space)
    const er = Math.hypot(x - 100, (y - 206) * 1.25)
    if (er < 18) { z -= side * 11 * Math.pow(1 - er / 18, 1.2); if (er < 10) tone *= 0.05; else tone *= 1.1 }
    const nr = Math.hypot(x - 26, y - 296)
    if (nr < 13) { z -= side * 8 * (1 - nr / 13); if (nr < 7) tone *= 0.06 }
    const md = segDist(x, y, MOUTH)
    if (md < 5) { z -= side * 5 * (1 - md / 5); tone *= md < 2.4 ? 0.12 : 0.7 }
    if (x > 190 && y > 50 && y < 340) { const s = Math.pow(Math.abs(Math.sin(dp * 0.42)), 2.2); z -= side * 7 * (1 - s) * Math.min(1, dp / 14); tone *= 0.62 + 0.38 * s }
    if (x > 126 && x < 160 && y < 70 && dp > 3) tone *= 0.55         // the inner ear
    id = pos.length / 3
    pos.push((x - 232) * U, YBASE + (YCUT - y) * U, z * U)
    col.push(tone, tone, tone)
    vid.set(key, id)
    return id
  }
  const tri = (a: number, b: number, c: number) => idx.push(a, b, c)
  for (let cy = 0; cy < GH - 1; cy++) for (let cx = 0; cx < GW - 1; cx++) {
    if (!full(cx, cy)) continue
    // front sheet (z+): grid y runs downward, so (cx,cy) -> (cx+1,cy) -> (cx,cy+1) is clockwise seen from +z: flip
    const a = vtx(cx, cy, 1), b = vtx(cx + 1, cy, 1), c = vtx(cx, cy + 1, 1), e = vtx(cx + 1, cy + 1, 1)
    tri(a, c, b); tri(b, c, e)
    const a2 = vtx(cx, cy, -1), b2 = vtx(cx + 1, cy, -1), c2 = vtx(cx, cy + 1, -1), e2 = vtx(cx + 1, cy + 1, -1)
    tri(a2, b2, c2); tri(b2, e2, c2)
    // rim: each side of this cell with no full neighbour is a boundary edge: stitch front to back
    const edge = (gx0: number, gy0: number, gx1: number, gy1: number, nx: number, ny: number) => {
      // (nx, ny): outward direction in grid space (y down); the quad runs front0, front1, back1, back0
      const f0 = vtx(gx0, gy0, 1), f1 = vtx(gx1, gy1, 1), b0 = vtx(gx0, gy0, -1), b1 = vtx(gx1, gy1, -1)
      // winding so the normal faces outward: edge direction (ex, ey) in the x/y(up) plane, z toward the viewer
      const ex = gx1 - gx0, ey = -(gy1 - gy0), ox = nx, oy = -ny
      const cross = ex * oy - ey * ox                  // z of (edge x outward): positive = counter-clockwise
      if (cross > 0) { tri(f0, f1, b0); tri(f1, b1, b0) } else { tri(f0, b0, f1); tri(f1, b0, b1) }
    }
    if (!full(cx, cy - 1)) edge(cx, cy, cx + 1, cy, 0, -1)
    if (!full(cx, cy + 1)) edge(cx, cy + 1, cx + 1, cy + 1, 0, 1)
    if (!full(cx - 1, cy)) edge(cx, cy, cx, cy + 1, -1, 0)
    if (!full(cx + 1, cy)) edge(cx + 1, cy, cx + 1, cy + 1, 1, 0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // the neck is cut flat at the collar: its normals point down, which nothing sees; uv from the profile plane
  const P = g.getAttribute('position'), uv = new Float32Array(P.count * 2)
  for (let i = 0; i < P.count; i++) { uv[i * 2] = P.getX(i) * 0.5 + 0.5; uv[i * 2 + 1] = P.getY(i) * 0.25 }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}
function knight(): THREE.BufferGeometry {
  const ctrl: LP[] = [...FOOT, [0.64, 0.42], [0.56, 0.55], [0.52, 0.72], [0.5, 0.86, S], ...collar(0.88, 0.68), [0.64, 1.04, S], [0, 1.04, S]]
  const base = uniformGeo(lathe(profile(ctrl, q.per), q.seg))
  return merge([base, knightHead(q.cell)])
}

/** a Staunton piece at its natural size (base radius 1); scale to taste */
export function pieceGeo(kind: Kind, lod = 0): THREE.BufferGeometry {
  q = QUAL[Math.min(1, lod)]
  switch (kind) { case 'P': return pawn(); case 'R': return rook(); case 'N': return knight(); case 'B': return bishop(); case 'Q': return queen(); default: return king() }
}
export { paint }
