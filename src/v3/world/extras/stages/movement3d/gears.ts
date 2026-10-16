// Geometry for the 3D movement (watchdog stop, approach B): 2D outlines (THREE.Vector2 loops, counter-clockwise, y up) for involute wheels and
// pinions, a Swiss club-tooth escape wheel, crossed-out (spoked) wheel windows, thick polylines with round ends (bridges), and the extrude /
// merge helpers that turn them into bevelled BufferGeometry with two material groups: 0 = the faces (caps), 1 = the flanks and bevels (anglage).
//
// The involute flank is the same port as ../movement/geom.ts (OpenJSCAD "Parametric Involute Gear", MIT, credits.json "jscad-involute-gear"):
// pitch radius m*n/2, addendum m, dedendum 1.25 m, base radius rp cos(20 deg), tooth width on the base circle pi/N + 2 inv(alpha), flank sampled
// with t^(2/3) spacing. Here it returns points instead of SVG path data, tooth 0 centred on angle 0 (so ../movement/geom.ts meshPhase applies).
import * as THREE from 'three'

export const TAU = Math.PI * 2
const V = (r: number, a: number) => new THREE.Vector2(r * Math.cos(a), r * Math.sin(a))

export interface Gear { n: number; m: number; rp: number; ro: number; rr: number; rb: number; pts: THREE.Vector2[] }

/** a closed involute outline, tooth 0 centred on angle 0 */
export function involute(n: number, m: number, steps = 4, pa = 20, clr = 0.25): Gear {
  const alpha = (pa * Math.PI) / 180
  const rp = (m * n) / 2, rb = rp * Math.cos(alpha), ro = rp + m, rr = Math.max(rp - m * (1 + clr), m * 0.6)
  const tp = Math.sqrt(rp * rp - rb * rb) / rb
  const wb = Math.PI / n + 2 * (tp - Math.atan(tp))
  const tMin = rr > rb ? Math.sqrt((rr / rb) ** 2 - 1) : 0
  let tMax = Math.sqrt(ro * ro - rb * rb) / rb
  const phi = (t: number) => t - Math.atan(t)
  while (phi(tMax) > wb / 2 && tMax > tMin) tMax *= 0.98
  const rad = (t: number) => rb * Math.sqrt(1 + t * t)
  const tau = TAU / n, pts: THREE.Vector2[] = []
  const TIP = 3, ROOT = n > 30 ? 3 : 4
  for (let k = 0; k < n; k++) {
    const c = k * tau, s = c - wb / 2, e = c + wb / 2
    if (rr < rb) pts.push(V(rr, s))
    for (let i = 0; i <= steps; i++) { const t = tMin + (tMax - tMin) * Math.pow(i / steps, 2 / 3); pts.push(V(rad(t), s + phi(t))) }
    const a0 = s + phi(tMax), a1 = e - phi(tMax)
    for (let j = 1; j < TIP; j++) pts.push(V(rad(tMax), a0 + ((a1 - a0) * j) / TIP))
    for (let i = steps; i >= 0; i--) { const t = tMin + (tMax - tMin) * Math.pow(i / steps, 2 / 3); pts.push(V(rad(t), e - phi(t))) }
    if (rr < rb) pts.push(V(rr, e))
    const r0 = rr < rb ? e : e - phi(tMin), ns = c + tau - wb / 2, r1 = rr < rb ? ns : ns + phi(tMin)
    for (let j = 1; j < ROOT; j++) pts.push(V(rr, r0 + ((r1 - r0) * j) / ROOT))
  }
  return { n, m, rp, ro, rr, rb, pts }
}

/** the Swiss club-tooth escape wheel for a wheel turning CLOCKWISE (teeth lean toward decreasing angle). Tooth k's locking corner is at
 *  angle k*tau - LOCK_U*tau (radius ro). */
export const LOCK_U = 0.42
export function clubWheel(n: number, ro: number, rr: number): THREE.Vector2[] {
  const tau = TAU / n, h = ro - rr, pts: THREE.Vector2[] = []
  for (let k = 0; k < n; k++) {
    const a = k * tau
    // trailing root, back of the tooth rising to the heel of the club, the impulse face up to the locking corner, a short locking face,
    // then the undercut front face back down to the root (the tip leans forward, in the direction of turning)
    const prof: [number, number][] = [[rr, 0], [rr + 0.3 * h, -0.03], [rr + 0.62 * h, -0.1], [ro - 0.22 * h, -0.22], [ro - 0.08 * h, -0.33], [ro, -LOCK_U], [ro - 0.1 * h, -0.445], [rr + 0.45 * h, -0.4], [rr, -0.37]]
    for (const [r, u] of prof) pts.push(V(r, a + u * tau))
    for (let j = 1; j < 4; j++) pts.push(V(rr, a - 0.37 * tau - ((0.63 * tau) * j) / 4))
  }
  return pts.reverse()  // counter-clockwise like every other outline here
}

/** a circle outline */
export function circle(r: number, seg = 0, cx = 0, cy = 0): THREE.Vector2[] {
  const n = seg || Math.max(24, Math.min(160, Math.round(r * 0.9)))
  const p: THREE.Vector2[] = []
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; p.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a))) }
  return p
}

/** the windows of a crossed-out wheel: k curved spokes of width w between the hub (radius rh) and the rim (inner radius ri), as hole loops */
export function spokeWindows(k: number, rh: number, ri: number, w: number, bend = 0.28, a0 = 0): THREE.Vector2[][] {
  const holes: THREE.Vector2[][] = []
  const spokeAt = (j: number, r: number) => a0 + (j / k) * TAU + bend * ((r - rh) / (ri - rh))
  const N = 10, R = 14
  for (let j = 0; j < k; j++) {
    const h: THREE.Vector2[] = []
    // right edge of spoke j going out, rim arc, left edge of spoke j+1 coming in, hub arc back (fillet-ish: the corners are pulled in a little)
    const fil = w * 0.55
    for (let i = 0; i <= N; i++) { const r = rh + fil + ((ri - fil - rh - fil) * i) / N; h.push(V(r, spokeAt(j, r) + (w / 2) / r)) }
    const aS = spokeAt(j, ri) + (w / 2 + fil) / ri, aE = spokeAt(j + 1, ri) - (w / 2 + fil) / ri
    for (let i = 0; i <= R; i++) h.push(V(ri, aS + ((aE - aS) * i) / R))
    for (let i = N; i >= 0; i--) { const r = rh + fil + ((ri - fil - rh - fil) * i) / N; h.push(V(r, spokeAt(j + 1, r) - (w / 2) / r)) }
    const bS = spokeAt(j + 1, rh) - (w / 2 + fil) / rh, bE = spokeAt(j, rh) + (w / 2 + fil) / rh
    for (let i = 1; i < R; i++) h.push(V(rh, bS + ((bE - bS) * i) / R))
    holes.push(h)
  }
  return holes
}

/** a thick polyline (round ends, round outer joins, mitred inner joins), as one counter-clockwise outline loop; points [x, y] */
export function capsulePath(pts: [number, number][], w: number, seg = 12): THREE.Vector2[] {
  const r = w / 2, n = pts.length, out: THREE.Vector2[] = []
  const d: [number, number][] = []
  for (let i = 0; i < n - 1; i++) { const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy) || 1; d.push([dx / l, dy / l]) }
  const P = (c: [number, number], nx: number, ny: number, k = r) => out.push(new THREE.Vector2(c[0] + nx * k, c[1] + ny * k))
  const arc = (c: [number, number], a0: number, a1: number) => {
    let dd = a1 - a0; while (dd > Math.PI) dd -= TAU; while (dd < -Math.PI) dd += TAU
    const k = Math.max(2, Math.ceil((Math.abs(dd) / Math.PI) * seg))
    for (let j = 0; j <= k; j++) { const a = a0 + (dd * j) / k; P(c, Math.cos(a), Math.sin(a)) }
  }
  const join = (i: number, sideSign: number, forward: boolean) => {
    // corner at pts[i] between segment i-1 and i; sideSign +1 = left offset, -1 = right offset
    const A = d[i - 1], B = d[i]
    const nA: [number, number] = [-A[1] * sideSign, A[0] * sideSign], nB: [number, number] = [-B[1] * sideSign, B[0] * sideSign]
    const cross = A[0] * B[1] - A[1] * B[0]
    const inner = sideSign > 0 ? cross > 0 : cross < 0
    if (Math.abs(cross) < 1e-4) { P(pts[i], nA[0], nA[1]); return }
    if (inner) { const k = r / (1 + nA[0] * nB[0] + nA[1] * nB[1]); P(pts[i], nA[0] + nB[0], nA[1] + nB[1], k); return }
    const a0 = Math.atan2(nA[1], nA[0]), a1 = Math.atan2(nB[1], nB[0])
    if (forward) arc(pts[i], a0, a1); else arc(pts[i], a1, a0)
  }
  P(pts[0], -d[0][1], d[0][0])
  for (let i = 1; i < n - 1; i++) join(i, 1, true)
  const aL = Math.atan2(d[n - 2][1], d[n - 2][0])
  for (let j = 0; j <= seg; j++) { const a = aL + Math.PI / 2 - (Math.PI * j) / seg; P(pts[n - 1], Math.cos(a), Math.sin(a)) }
  for (let i = n - 2; i >= 1; i--) join(i, -1, false)
  const a0 = Math.atan2(d[0][1], d[0][0])
  for (let j = 0; j < seg; j++) { const a = a0 - Math.PI / 2 - (Math.PI * j) / seg; P(pts[0], Math.cos(a), Math.sin(a)) }
  const o = dedupe(out)
  return THREE.ShapeUtils.isClockWise(o) ? o.reverse() : o
}
/** a tapered bridge outline: a polyline whose width eases from point to point (ws[i] at pts[i]), round ends, smooth sides (each
 *  segment is subdivided so the flanks curve with the width) */
export function taperPath(pts: [number, number][], ws: number[], seg = 14, sub = 10): THREE.Vector2[] {
  // resample the centreline with a smoothstep width profile
  const P: [number, number][] = [], W: number[] = []
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < sub; k++) {
    const t = k / sub, e = t * t * (3 - 2 * t)
    P.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]); W.push(ws[i] + (ws[i + 1] - ws[i]) * e)
  }
  P.push(pts[pts.length - 1]); W.push(ws[ws.length - 1])
  const n = P.length, nor: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
    nor.push([-dy / l, dx / l])
  }
  const out: THREE.Vector2[] = []
  for (let i = 0; i < n; i++) out.push(new THREE.Vector2(P[i][0] + nor[i][0] * W[i] / 2, P[i][1] + nor[i][1] * W[i] / 2))
  const aE = Math.atan2(nor[n - 1][1], nor[n - 1][0])
  for (let j = 1; j < seg; j++) { const a = aE - (Math.PI * j) / seg; out.push(new THREE.Vector2(P[n - 1][0] + Math.cos(a) * W[n - 1] / 2, P[n - 1][1] + Math.sin(a) * W[n - 1] / 2)) }
  for (let i = n - 1; i >= 0; i--) out.push(new THREE.Vector2(P[i][0] - nor[i][0] * W[i] / 2, P[i][1] - nor[i][1] * W[i] / 2))
  const aS = Math.atan2(-nor[0][1], -nor[0][0])
  for (let j = 1; j < seg; j++) { const a = aS - (Math.PI * j) / seg; out.push(new THREE.Vector2(P[0][0] + Math.cos(a) * W[0] / 2, P[0][1] + Math.sin(a) * W[0] / 2)) }
  const o = dedupe(out)
  return THREE.ShapeUtils.isClockWise(o) ? o.reverse() : o
}
function dedupe(p: THREE.Vector2[]): THREE.Vector2[] {
  const o: THREE.Vector2[] = []
  for (const q of p) if (!o.length || o[o.length - 1].distanceToSquared(q) > 1e-4) o.push(q)
  if (o.length > 2 && o[0].distanceToSquared(o[o.length - 1]) < 1e-4) o.pop()
  return o
}

// ------------------------------------------------------------------------------------------------ extrude with anglage
export interface UVMap { /** cap uv = (x + ox) * k + 0.5 */ k: number; ox: number; oy: number }
/** plate-space uv (the movement's 1000-unit box; one canvas covers every part) or part-local uv (k = 1 / (2R), ox = oy = 0) */
function uvGen(m: UVMap) {
  return {
    generateTopUV(_g: unknown, v: number[], a: number, b: number, c: number) {
      const f = (i: number) => new THREE.Vector2((v[i * 3] + m.ox) * m.k + 0.5, (v[i * 3 + 1] + m.oy) * m.k + 0.5)
      return [f(a), f(b), f(c)]
    },
    generateSideWallUV(_g: unknown, v: number[], a: number, b: number, c: number, d: number) {
      const ax = v[a * 3], ay = v[a * 3 + 1], az = v[a * 3 + 2], bx = v[b * 3], by = v[b * 3 + 1], bz = v[b * 3 + 2]
      const cx = v[c * 3], cy = v[c * 3 + 1], cz = v[c * 3 + 2], dx = v[d * 3], dy = v[d * 3 + 1], dz = v[d * 3 + 2]
      const k = m.k
      if (Math.abs(ay - by) < Math.abs(ax - bx)) return [new THREE.Vector2(ax * k, 1 - az * k), new THREE.Vector2(bx * k, 1 - bz * k), new THREE.Vector2(cx * k, 1 - cz * k), new THREE.Vector2(dx * k, 1 - dz * k)]
      return [new THREE.Vector2(ay * k, 1 - az * k), new THREE.Vector2(by * k, 1 - bz * k), new THREE.Vector2(cy * k, 1 - cz * k), new THREE.Vector2(dy * k, 1 - dz * k)]
    },
  }
}
/** extrude an outline (+ holes) from z0 to z1 with a polished bevel `bev` on both faces (the bevel stays inside the outline) */
export function extrude(outer: THREE.Vector2[], holes: THREE.Vector2[][], z0: number, z1: number, bev: number, uv: UVMap, bevSeg = 2): THREE.BufferGeometry {
  const sh = new THREE.Shape(outer)
  for (const h of holes) sh.holes.push(new THREE.Path(h))
  const b = Math.max(0, Math.min(bev, (z1 - z0) * 0.45))
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: Math.max(0.01, z1 - z0 - 2 * b), steps: 1, curveSegments: 4,
    bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: b > 0 ? bevSeg : 0,
    UVGenerator: uvGen(uv) as unknown as THREE.ExtrudeGeometryOptions['UVGenerator'],
  })
  g.translate(0, 0, z0 + b)
  return g
}
export const PLATE_UV = (ox = 0, oy = 0): UVMap => ({ k: 1 / 1000, ox, oy })
export const LOCAL_UV = (r: number): UVMap => ({ k: 1 / (2 * r), ox: 0, oy: 0 })

/** concatenate geometries (converted to non-indexed), keeping one draw group per material index (0 faces, 1 flanks); `m` forces a material index */
export function mergeMat(list: { g: THREE.BufferGeometry; m?: number; at?: THREE.Matrix4 }[]): THREE.BufferGeometry {
  const parts = list.map(({ g, m, at }) => { const n = g.index ? g.toNonIndexed() : g; if (at) n.applyMatrix4(at); return { g: n, m } })
  const buckets = new Map<number, { g: THREE.BufferGeometry; s: number; c: number }[]>()
  for (const { g, m } of parts) {
    const cnt = g.getAttribute('position').count
    const groups = g.groups.length ? g.groups : [{ start: 0, count: cnt, materialIndex: 0 }]
    for (const gr of groups) { const mi = m ?? Math.min(1, gr.materialIndex ?? 0); if (!buckets.has(mi)) buckets.set(mi, []); buckets.get(mi)!.push({ g, s: gr.start, c: Math.min(gr.count, cnt - gr.start) }) }
  }
  let total = 0; for (const b of buckets.values()) for (const e of b) total += e.c
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2)
  const out = new THREE.BufferGeometry()
  let o = 0
  for (const mi of [...buckets.keys()].sort((a, b) => a - b)) {
    const start = o
    for (const { g, s, c } of buckets.get(mi)!) {
      const p = g.getAttribute('position').array as Float32Array, nn = g.getAttribute('normal')?.array as Float32Array | undefined, u = g.getAttribute('uv')?.array as Float32Array | undefined
      pos.set(p.subarray(s * 3, (s + c) * 3), o * 3)
      if (nn) nor.set(nn.subarray(s * 3, (s + c) * 3), o * 3)
      if (u) uv.set(u.subarray(s * 2, (s + c) * 2), o * 2)
      o += c
    }
    out.addGroup(start, o - start, mi)
  }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  for (const { g } of parts) g.dispose()
  out.computeBoundingSphere()
  return out
}

/** a pinion: involute teeth extruded tall, with a polished arbor through it (z0..z1 the leaves, the arbor a little longer) */
export function pinion(n: number, m: number, z0: number, z1: number, arbor = 0): THREE.BufferGeometry {
  const g = involute(n, m, 3)
  const leaves = extrude(g.pts, [], z0, z1, Math.min(0.8, m * 0.25), LOCAL_UV(g.ro), 1)
  const ar = new THREE.CylinderGeometry(g.rr * 0.55, g.rr * 0.55, (z1 - z0) + arbor * 2, 16, 1); ar.rotateX(Math.PI / 2); ar.translate(0, 0, (z0 + z1) / 2)
  return mergeMat([{ g: leaves }, { g: ar, m: 1 }])
}

/** a lathe (profile [r, z] pairs) around z, as a geometry facing +z */
export function lathe(profile: [number, number][], seg = 32): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), seg)
  g.rotateX(Math.PI / 2)   // lathe axis y -> z
  return g
}

/** a cylinder along z from z0 to z1 */
export function rod(r: number, z0: number, z1: number, seg = 16, x = 0, y = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg, 1); g.rotateX(Math.PI / 2); g.translate(x, y, (z0 + z1) / 2); return g
}

/** the knurled crown: a fluted cylinder along +y (radius r, length L, `flutes` ridges), with a domed end */
export function crownGeo(r: number, L: number, flutes: number): THREE.BufferGeometry {
  const seg = flutes * 4, rows = 6
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = []
  const rad = (a: number) => r * (1 - 0.06 * Math.pow(0.5 + 0.5 * Math.cos(a * flutes), 2))
  for (let j = 0; j <= rows; j++) {
    const y = (j / rows) * L
    const taper = j === 0 || j === rows ? 0.94 : 1
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU, rr = rad(a) * taper
      pos.push(rr * Math.cos(a), y, rr * Math.sin(a))
      const da = 1e-3, dr = (rad(a + da) - rad(a - da)) / (2 * da)
      const tx = -rr * Math.sin(a) + dr * Math.cos(a), tz = rr * Math.cos(a) + dr * Math.sin(a)
      const nx = tz, nz = -tx, l = Math.hypot(nx, nz) || 1
      nor.push(nx / l, 0, nz / l); uv.push(i / seg, j / rows)
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1) }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx)
  // the domed end cap
  const cap = new THREE.SphereGeometry(r * 0.94, seg, 6, 0, TAU, 0, Math.PI * 0.32); cap.scale(1, 0.45, 1); cap.translate(0, L - r * 0.94 * 0.45 * Math.cos(Math.PI * 0.32), 0)
  return mergeMat([{ g, m: 1 }, { g: cap, m: 0 }])
}

/** a flat ribbon (a spring seen edge-on from above): the vertex shader places every vertex from (aU, aSide); position holds a static fallback */
export function ribbon(n: number, staticPos: (u: number, side: number) => [number, number, number], extra?: { pts: [number, number, number][]; w: number }): THREE.BufferGeometry {
  const pos: number[] = [], au: number[] = [], as: number[] = [], af: number[] = [], nor: number[] = [], idx: number[] = []
  for (let i = 0; i <= n; i++) { const u = i / n; for (const s of [-1, 1]) { pos.push(...staticPos(u, s)); au.push(u); as.push(s); af.push(0); nor.push(0, 0, 1) } }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  // a static tail (the Breguet overcoil), placed by `position` itself
  if (extra) {
    const base = pos.length / 3, P = extra.pts
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[Math.min(P.length - 1, i + 1)], o = P[Math.max(0, i - 1)]
      const tx = q[0] - o[0], ty = q[1] - o[1], l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l
      for (const s of [-1, 1]) { pos.push(p[0] + nx * s * extra.w / 2, p[1] + ny * s * extra.w / 2, p[2]); au.push(1); as.push(s); af.push(1); nor.push(0, 0, 1) }
    }
    for (let i = 0; i < P.length - 1; i++) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('aU', new THREE.Float32BufferAttribute(au, 1)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(as, 1)); g.setAttribute('aFix', new THREE.Float32BufferAttribute(af, 1))
  g.setIndex(idx)
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400)
  return g
}

/** intersection of the circles |p - a| = ra and |p - b| = rb; `side` +1 picks the one to the left of a->b */
export function circleX(a: [number, number], ra: number, b: [number, number], rb: number, side = 1): [number, number] {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy)
  const x = (d * d + ra * ra - rb * rb) / (2 * d), h = Math.sqrt(Math.max(0, ra * ra - x * x))
  const ux = dx / d, uy = dy / d
  return [a[0] + ux * x - uy * h * side, a[1] + uy * x + ux * h * side]
}
