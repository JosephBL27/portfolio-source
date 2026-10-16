// An anatomically proportioned human brain, built from maths (no scan, no download).
//
// Units: the brain is 2 long (z, anterior = +z), 1.66 wide (x), and about 1.1 tall at the cerebrum (y up); the brainstem hangs
// to y = -0.95. One unit is about 83 mm, so the proportions are a real adult brain's (length 167 mm, width 140 mm, height 93 mm).
//
//   base shape  two cerebral hemispheres (blended ellipsoids: frontal, dorsal/parietal, occipital, temporal lobes) split by the
//               longitudinal fissure, joined under it by the diencephalon; cerebellum (two hemispheres and the vermis) behind
//               the brainstem; brainstem (midbrain, pons, medulla) as a tapered capsule.
//   folds       the lateral (Sylvian), central (Rolando), parieto-occipital and superior temporal sulci as named grooves, then
//               gyri and sulci as the zero set of a domain-warped noise field (grooves where the field crosses zero), and
//               fine parallel folia on the cerebellum.
//   surface     naive surface nets over a narrow band of the field. The heavy mesh is baked offline by scripts/build-brain.mjs
//               into public/models/brain.bin; at run time the .bin is loaded (or a coarse mesh is made when it is missing).
//
// This file imports nothing so that Node can run it directly (node --experimental-strip-types is the default on Node 24).
// Public domain-style provenance: every number here is authored for this site; no third-party mesh or atlas is used.

export interface BrainMesh {
  pos: Float32Array          // xyz, brain units
  nrm: Float32Array          // unit normals
  fold: Float32Array         // 0 on a gyral crown .. 1 at the floor of a sulcus
  region: Uint8Array         // REGIONS index
  idx: Uint32Array
}

export const REGIONS = ['prefrontal', 'frontal', 'parietal', 'occipital', 'temporal-upper', 'temporal-lower', 'cerebellum', 'brainstem', 'deep'] as const
export const R_PREFRONTAL = 0, R_FRONTAL = 1, R_PARIETAL = 2, R_OCCIPITAL = 3, R_TEMP_UP = 4, R_TEMP_LO = 5, R_CEREBELLUM = 6, R_STEM = 7, R_DEEP = 8

// ------------------------------------------------------------------ noise (improved Perlin, seeded)
const PERM = new Uint8Array(512)
{
  const p = Array.from({ length: 256 }, (_, i) => i)
  let s = 20261008
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const gr = (h: number, x: number, y: number, z: number) => {
  h &= 15
  const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v)
}
export function noise3(x: number, y: number, z: number): number {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z)
  x -= X; y -= Y; z -= Z
  const xi = X & 255, yi = Y & 255, zi = Z & 255
  const u = fade(x), v = fade(y), w = fade(z)
  const A = PERM[xi] + yi, AA = PERM[A] + zi, AB = PERM[A + 1] + zi, B = PERM[xi + 1] + yi, BA = PERM[B] + zi, BB = PERM[B + 1] + zi
  const l = (a: number, b: number, t: number) => a + t * (b - a)
  return l(
    l(l(gr(PERM[AA], x, y, z), gr(PERM[BA], x - 1, y, z), u), l(gr(PERM[AB], x, y - 1, z), gr(PERM[BB], x - 1, y - 1, z), u), v),
    l(l(gr(PERM[AA + 1], x, y, z - 1), gr(PERM[BA + 1], x - 1, y, z - 1), u), l(gr(PERM[AB + 1], x, y - 1, z - 1), gr(PERM[BB + 1], x - 1, y - 1, z - 1), u), v), w)
}

// ------------------------------------------------------------------ signed-distance helpers (approximate, good near the surface)
const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25 }
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k)
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
function ell(x: number, y: number, z: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): number {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz
  const k0 = Math.sqrt(px * px + py * py + pz * pz)
  const k1 = Math.sqrt((px * px) / (rx * rx) + (py * py) / (ry * ry) + (pz * pz) / (rz * rz))
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz)
}
/** ellipsoid whose long (z) axis is pitched by `a` radians about x (a > 0 sends the +z end downwards) */
function ellP(x: number, y: number, z: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, a: number): number {
  const dy = y - cy, dz = z - cz, c = Math.cos(a), s = Math.sin(a)
  return ell(x, cy + dy * c - dz * s, cz + dy * s + dz * c, cx, cy, cz, rx, ry, rz)
}
function roundCone(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r1: number, r2: number): number {
  const bax = bx - ax, bay = by - ay, baz = bz - az
  const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2
  const pax = px - ax, pay = py - ay, paz = pz - az
  const y = pax * bax + pay * bay + paz * baz, z = y - l2
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y
  const x2 = qx * qx + qy * qy + qz * qz, y2 = y * y * l2, z2 = z * z * l2
  const k = Math.sign(rr) * rr * rr * x2
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1
}

// ------------------------------------------------------------------ the base shape
let lastCB = 1                // distance to the cerebellum from the last base() call (masks cortex folds and drives the folia)
/** The smooth brain without folds. Negative inside. */
export function brainBase(x: number, y: number, z: number): number {
  const ax = Math.abs(x)
  // one hemisphere (mirrored by |x|): frontal, dorsal, occipital and temporal lobes blended
  let h = ell(ax, y, z, 0.27, 0.10, 0.50, 0.55, 0.45, 0.50)
  h = smin(h, ell(ax, y, z, 0.28, 0.16, -0.04, 0.55, 0.50, 0.74), 0.17)
  h = smin(h, ell(ax, y, z, 0.26, -0.02, -0.60, 0.52, 0.38, 0.40), 0.15)
  h = smin(h, ellP(ax, y, z, 0.5, -0.27, 0.13, 0.3, 0.19, 0.5, 0.2), 0.12)
  // longitudinal fissure: a slab at the midline, open everywhere except where the diencephalon bridges the halves
  const slab = ax - (0.018 + 0.014 * sstep(0.2, 0.7, y))
  const bridge = ell(x, y, z, 0, -0.10, -0.10, 0.32, 0.22, 0.30)
  h = smax(h, Math.min(-slab, bridge), 0.03)
  // cerebellum: two hemispheres and the vermis, close under the occipital lobes
  const cb = smin(ell(ax, y, z, 0.22, -0.43, -0.67, 0.36, 0.19, 0.31), ell(x, y, z, 0, -0.41, -0.63, 0.15, 0.18, 0.27), 0.07)
  lastCB = cb
  // brainstem: midbrain, pons and medulla
  const stem = smin(roundCone(x, y, z, 0, -0.14, 0.0, 0, -0.9, -0.25, 0.22, 0.09), ell(x, y, z, 0, -0.5, 0.06, 0.18, 0.13, 0.18), 0.08)
  const core = ell(x, y, z, 0, -0.14, -0.06, 0.3, 0.19, 0.3)
  return smin(smin(h, cb, 0.035), smin(stem, core, 0.1), 0.08)
}

/** Named grooves: distance to a polyline in the (y, z) plane, gated by how lateral the point is. */
const SYLVIAN: [number, number][] = [[-0.14, 0.58], [-0.08, 0.35], [0.0, 0.08], [0.08, -0.2], [0.17, -0.45], [0.24, -0.62]]
const CENTRAL: [number, number][] = [[0.66, -0.02], [0.5, 0.02], [0.3, 0.1], [0.12, 0.18]]
const PARIETO_OCC: [number, number][] = [[0.6, -0.42], [0.4, -0.46], [0.2, -0.4]]
const STS: [number, number][] = [[-0.3, 0.35], [-0.22, 0.12], [-0.13, -0.12], [-0.04, -0.36], [0.04, -0.56]]
function polyDist(py: number, pz: number, P: [number, number][]): number {
  let best = 1e9
  for (let i = 0; i < P.length - 1; i++) {
    const ay = P[i][0], az = P[i][1], by = P[i + 1][0], bz = P[i + 1][1]
    const vy = by - ay, vz = bz - az, wy = py - ay, wz = pz - az
    const t = Math.min(1, Math.max(0, (wy * vy + wz * vz) / (vy * vy + vz * vz)))
    const dy = wy - vy * t, dz = wz - vz * t
    best = Math.min(best, dy * dy + dz * dz)
  }
  return Math.sqrt(best)
}
const gauss = (d: number, w: number) => Math.exp(-(d * d) / (w * w))

/** Sulcal depth 0..1 at a point near the surface (1 = the floor of a sulcus), and the extra depth of the cerebellar folia. */
function foldField(x: number, y: number, z: number, cb: number): { groove: number; folia: number } {
  const ax = Math.abs(x)
  // the named sulci wander: they are never straight lines on a real brain
  const qy = y + 0.04 * noise3(x * 3.3, y * 3.3, z * 3.3 + 1.7), qz = z + 0.04 * noise3(x * 3.3 + 8.1, y * 3.3, z * 3.3)
  // named grooves
  const lat = sstep(0.3, 0.5, ax)
  let big = 1.0 * gauss(polyDist(qy, qz, SYLVIAN), 0.034) * lat
  big = Math.max(big, 0.8 * gauss(polyDist(qy, qz, STS), 0.022) * sstep(0.4, 0.6, ax))
  big = Math.max(big, 0.85 * gauss(polyDist(qy, qz, CENTRAL), 0.02) * sstep(0.08, 0.2, ax))
  big = Math.max(big, 0.7 * gauss(polyDist(qy, qz, PARIETO_OCC), 0.02) * sstep(0.08, 0.2, ax))
  // gyri and sulci: the zero set of a warped noise field
  const wx = x + 0.1 * noise3(x * 2.1 + 5.2, y * 2.1, z * 2.1), wy = y + 0.1 * noise3(x * 2.1, y * 2.1 + 9.1, z * 2.1), wz = z + 0.1 * noise3(x * 2.1, y * 2.1, z * 2.1 + 3.7)
  const s = noise3(wx * 7.2, wy * 7.2, wz * 7.2) + 0.4 * noise3(wx * 14.7 + 4.7, wy * 14.7, wz * 14.7)
  const sulci = sstep(0.3, 0.95, Math.exp(-(s * s) / (2 * 0.12 * 0.12))) * (0.6 + 0.4 * sstep(-0.4, 0.4, noise3(wx * 1.6, wy * 1.6, wz * 1.6)))
  // where the cortex is not (cerebellum, brainstem) the cortical folds fade out
  const stemZone = (1 - sstep(0.16, 0.26, ax)) * (1 - sstep(-0.32, -0.26, y)) * sstep(-0.5, -0.4, z)
  const cbm = sstep(0.07, 0.0, cb)
  const cortex = (1 - cbm) * (1 - stemZone)
  const groove = Math.min(1, Math.max(big, sulci) * cortex)
  // cerebellar folia: fine parallel ridges, curved a little with the lobe
  const ph = (y * 22 + 2.6 * noise3(x * 1.7, y * 1.2, z * 1.7) + 0.9 * z) * Math.PI * 2
  const folia = Math.pow(0.5 + 0.5 * Math.cos(ph), 6) * cbm
  return { groove, folia }
}

const AMP = 0.03, AMP_FOLIA = 0.012
/** The full field: smooth brain plus folds. Negative inside, zero on the surface. */
export function brainField(x: number, y: number, z: number, folds = true): number {
  const b = brainBase(x, y, z)
  if (!folds || b > 0.1 || b < -0.1) return b
  const f = foldField(x, y, z, lastCB)
  return b + AMP * f.groove + AMP_FOLIA * f.folia
}
/** Depth of the groove at a point (0..1), for shading. */
export function brainFold(x: number, y: number, z: number): number {
  brainBase(x, y, z)
  const f = foldField(x, y, z, lastCB)
  return Math.min(1, f.groove + f.folia * 0.6)
}

// ------------------------------------------------------------------ regions (a lobe map, used for shading and for placing the vault's folders)
/** the line of the lateral fissure in (z, y): y = 0.05 - 0.32 z */
const syl = (z: number) => 0.05 - 0.32 * z
export function regionAt(x: number, y: number, z: number): number {
  const ax = Math.abs(x)
  if (y < -0.22 && z < -0.3) return R_CEREBELLUM
  if (ax < 0.22 && y < -0.3 && z > -0.5) return R_STEM
  if (ax < 0.3 && y > -0.3 && y < 0.1 && Math.abs(z) < 0.3) return R_DEEP
  if (y > syl(z)) return z > 0.45 ? R_PREFRONTAL : z > 0.04 ? R_FRONTAL : z > -0.4 ? R_PARIETAL : R_OCCIPITAL
  if (z < -0.5) return R_OCCIPITAL
  return y > syl(z) - 0.2 ? R_TEMP_UP : R_TEMP_LO
}

// ------------------------------------------------------------------ surface nets
export const BOUNDS = { x0: -0.92, x1: 0.92, y0: -1.1, y1: 0.74, z0: -1.06, z1: 1.06 }

export function meshBrain(h = 0.0115, folds = true): BrainMesh {
  const { x0, y0, z0 } = BOUNDS
  const nx = Math.ceil((BOUNDS.x1 - x0) / h) + 1, ny = Math.ceil((BOUNDS.y1 - y0) / h) + 1, nz = Math.ceil((BOUNDS.z1 - z0) / h) + 1
  const f = new Float32Array(nx * ny * nz)
  const at = (i: number, j: number, k: number) => (k * ny + j) * nx + i
  // evaluate the field in blocks of 4^3 corners, skipping the blocks that are far from the surface
  const B = 4
  for (let bk = 0; bk < nz; bk += B) for (let bj = 0; bj < ny; bj += B) for (let bi = 0; bi < nx; bi += B) {
    const cx = x0 + (bi + B / 2) * h, cy = y0 + (bj + B / 2) * h, cz = z0 + (bk + B / 2) * h
    const d0 = brainBase(cx, cy, cz)
    const skip = Math.abs(d0) > 0.19
    for (let k = bk; k < Math.min(nz, bk + B); k++) for (let j = bj; j < Math.min(ny, bj + B); j++) for (let i = bi; i < Math.min(nx, bi + B); i++) {
      f[at(i, j, k)] = skip ? Math.sign(d0) * 0.2 : brainField(x0 + i * h, y0 + j * h, z0 + k * h, folds)
    }
  }
  const cell = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1)
  const cAt = (i: number, j: number, k: number) => (k * (ny - 1) + j) * (nx - 1) + i
  const P: number[] = []
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
  const cv = new Float32Array(8)
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0
    for (let c = 0; c < 8; c++) { const v = f[at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]; cv[c] = v; if (v < 0) mask |= 1 << c }
    if (mask === 0 || mask === 255) continue
    let sx = 0, sy = 0, sz = 0, n = 0
    for (const [a, b] of EDGES) {
      const va = cv[a], vb = cv[b]
      if ((va < 0) === (vb < 0)) continue
      const t = va / (va - vb)
      sx += (a & 1) + t * ((b & 1) - (a & 1)); sy += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1)); sz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1)); n++
    }
    cell[cAt(i, j, k)] = P.length / 3
    P.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h)
  }
  // quads: one per grid edge that crosses the surface
  const I: number[] = []
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I.push(a, c, b, a, d, c); else I.push(a, b, c, a, c, d) }
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = f[at(i, j, k)] < 0
    if (v0 !== (f[at(i + 1, j, k)] < 0)) quad(cell[cAt(i, j - 1, k - 1)], cell[cAt(i, j, k - 1)], cell[cAt(i, j, k)], cell[cAt(i, j - 1, k)], !v0)
    if (v0 !== (f[at(i, j + 1, k)] < 0)) quad(cell[cAt(i - 1, j, k - 1)], cell[cAt(i - 1, j, k)], cell[cAt(i, j, k)], cell[cAt(i, j, k - 1)], !v0)
    if (v0 !== (f[at(i, j, k + 1)] < 0)) quad(cell[cAt(i - 1, j - 1, k)], cell[cAt(i, j - 1, k)], cell[cAt(i, j, k)], cell[cAt(i - 1, j, k)], !v0)
  }
  const nv = P.length / 3
  const pos = Float32Array.from(P), nrm = new Float32Array(nv * 3), fold = new Float32Array(nv), region = new Uint8Array(nv)
  // winding: triangles must face along the gradient (outwards); decided before smoothing, while the field is still exact
  let agree = 0
  for (let t = 0; t < Math.min(I.length, 3000); t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx
    const e0 = h * 0.45, px = pos[a], py = pos[a + 1], pz = pos[a + 2]
    const gx = brainField(px + e0, py, pz, folds) - brainField(px - e0, py, pz, folds), gy = brainField(px, py + e0, pz, folds) - brainField(px, py - e0, pz, folds), gz = brainField(px, py, pz + e0, folds) - brainField(px, py, pz - e0, folds)
    agree += Math.sign(cx * gx + cy * gy + cz * gz)
  }
  if (agree < 0) for (let t = 0; t < I.length; t += 3) { const q = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = q }
  smooth(pos, I, 3)
  const nn = new Float32Array(nv * 3)
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx
    for (const k of [a, b, c]) { nn[k] += cx; nn[k + 1] += cy; nn[k + 2] += cz }
  }
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2]
    const l = Math.hypot(nn[v * 3], nn[v * 3 + 1], nn[v * 3 + 2]) || 1
    nrm[v * 3] = nn[v * 3] / l; nrm[v * 3 + 1] = nn[v * 3 + 1] / l; nrm[v * 3 + 2] = nn[v * 3 + 2] / l
    fold[v] = folds ? brainFold(x, y, z) : 0
    region[v] = regionAt(x, y, z)
  }
  return { pos, nrm, fold, region, idx: Uint32Array.from(I) }
}

/** Taubin smoothing (lambda/mu passes): removes the surface-nets stair steps without shrinking the brain. */
function smooth(pos: Float32Array, I: number[], iters: number) {
  const nv = pos.length / 3
  const deg = new Uint32Array(nv + 1)
  for (let t = 0; t < I.length; t++) deg[I[t] + 1] += 2
  for (let v = 0; v < nv; v++) deg[v + 1] += deg[v]
  const adj = new Uint32Array(deg[nv]), fill = new Uint32Array(nv)
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = I[t + k], b = I[t + (k + 1) % 3], c = I[t + (k + 2) % 3]
    adj[deg[a] + fill[a]++] = b; adj[deg[a] + fill[a]++] = c
  }
  const tmp = new Float32Array(pos.length)
  const pass = (lam: number) => {
    for (let v = 0; v < nv; v++) {
      const s = deg[v], e = deg[v] + fill[v]
      if (e === s) { tmp[v * 3] = pos[v * 3]; tmp[v * 3 + 1] = pos[v * 3 + 1]; tmp[v * 3 + 2] = pos[v * 3 + 2]; continue }
      let ax = 0, ay = 0, az = 0
      for (let k = s; k < e; k++) { const u = adj[k] * 3; ax += pos[u]; ay += pos[u + 1]; az += pos[u + 2] }
      const n = e - s
      tmp[v * 3] = pos[v * 3] + lam * (ax / n - pos[v * 3]); tmp[v * 3 + 1] = pos[v * 3 + 1] + lam * (ay / n - pos[v * 3 + 1]); tmp[v * 3 + 2] = pos[v * 3 + 2] + lam * (az / n - pos[v * 3 + 2])
    }
    pos.set(tmp)
  }
  for (let i = 0; i < iters; i++) { pass(0.5); pass(-0.53) }
}
// ------------------------------------------------------------------ .bin (de)serialisation
const MAGIC = 0x314e5242 // 'BRN1'
const Q = 30000
/** header (5 x u32: magic, vertices, indices, index bytes, reserved) then int16 xyz, int8 xyz + u8 fold, u8 region (padded to 4), indices */
export function packBrain(m: BrainMesh): ArrayBuffer {
  const nv = m.pos.length / 3, ni = m.idx.length, wide = nv > 65535
  const posB = nv * 6 + ((4 - ((nv * 6) % 4)) % 4), nrmB = nv * 4, regB = nv + ((4 - (nv % 4)) % 4)
  const buf = new ArrayBuffer(20 + posB + nrmB + regB + ni * (wide ? 4 : 2))
  new Uint32Array(buf, 0, 5).set([MAGIC, nv, ni, wide ? 4 : 2, 0])
  const p = new Int16Array(buf, 20, nv * 3), n = new Int8Array(buf, 20 + posB, nv * 4), fo = new Uint8Array(buf, 20 + posB, nv * 4), r = new Uint8Array(buf, 20 + posB + nrmB, nv)
  for (let i = 0; i < nv; i++) {
    p[i * 3] = Math.round(m.pos[i * 3] * Q); p[i * 3 + 1] = Math.round(m.pos[i * 3 + 1] * Q); p[i * 3 + 2] = Math.round(m.pos[i * 3 + 2] * Q)
    n[i * 4] = Math.round(m.nrm[i * 3] * 127); n[i * 4 + 1] = Math.round(m.nrm[i * 3 + 1] * 127); n[i * 4 + 2] = Math.round(m.nrm[i * 3 + 2] * 127)
    fo[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, m.fold[i])) * 255)
    r[i] = m.region[i]
  }
  const ioff = 20 + posB + nrmB + regB
  if (wide) new Uint32Array(buf, ioff, ni).set(m.idx); else new Uint16Array(buf, ioff, ni).set(m.idx)
  return buf
}
export function unpackBrain(buf: ArrayBuffer): BrainMesh {
  const hd = new Uint32Array(buf, 0, 5)
  if (hd[0] !== MAGIC) throw new Error('brain.bin: bad magic')
  const nv = hd[1], ni = hd[2], wide = hd[3] === 4
  const posB = nv * 6 + ((4 - ((nv * 6) % 4)) % 4), nrmB = nv * 4, regB = nv + ((4 - (nv % 4)) % 4)
  const p = new Int16Array(buf, 20, nv * 3), n = new Int8Array(buf, 20 + posB, nv * 4), fo = new Uint8Array(buf, 20 + posB, nv * 4), r = new Uint8Array(buf, 20 + posB + nrmB, nv)
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), fold = new Float32Array(nv), region = new Uint8Array(nv)
  for (let i = 0; i < nv; i++) {
    pos[i * 3] = p[i * 3] / Q; pos[i * 3 + 1] = p[i * 3 + 1] / Q; pos[i * 3 + 2] = p[i * 3 + 2] / Q
    const nx = n[i * 4] / 127, ny = n[i * 4 + 1] / 127, nz = n[i * 4 + 2] / 127, l = Math.hypot(nx, ny, nz) || 1
    nrm[i * 3] = nx / l; nrm[i * 3 + 1] = ny / l; nrm[i * 3 + 2] = nz / l
    fold[i] = fo[i * 4 + 3] / 255; region[i] = r[i]
  }
  const ioff = 20 + posB + nrmB + regB
  const idx = Uint32Array.from(wide ? new Uint32Array(buf, ioff, ni) : new Uint16Array(buf, ioff, ni))
  return { pos, nrm, fold, region, idx }
}

// w14: lossless transport packing for the baked brain mesh (public/models/brain.bin, 3.3 MB, which Pages serves uncompressed).
// The .bin is already int16 / int8 quantised, so what is left is byte-level redundancy: shuffling the bytes into planes of like bytes and
// delta-coding neighbours (the mesh is a marching grid, so neighbours are close) lets gzip reach about 1.0 MB instead of 1.6 MB.
// Decoding restores the EXACT original bytes, so unpackBrain() and everything downstream are untouched. scripts/compress-assets.mjs runs these
// under node to write brain.bin.z and to verify the round trip.
//
// BRN1 layout (see brainShape.ts): 5 x u32 header (magic, nv, ni, index bytes, 0) | int16 xyz[nv] (+pad to 4) | int8 nrm xyz + u8 fold [nv x 4] | u8 region[nv] (+pad to 4) | indices
// Packed layout: the 20 header bytes | per position axis: low then high byte of the u16 delta to the previous vertex | per normal/fold channel: byte delta
// to the previous vertex | region bytes | indices as three byte planes of zigzag(index - (highest index so far + 1)).
const zHdr = (b: Uint8Array) => { const d = new DataView(b.buffer, b.byteOffset, b.byteLength); return { nv: d.getUint32(4, true), ni: d.getUint32(8, true), w: d.getUint32(12, true) } }
const zPad4 = (n: number) => (4 - (n % 4)) % 4

export function packBrainZ(raw: Uint8Array): Uint8Array {
  const { nv, ni, w } = zHdr(raw), posB = nv * 6 + zPad4(nv * 6), regB = nv + zPad4(nv), idxB = ni * w
  const out = new Uint8Array(20 + nv * 6 + nv * 4 + nv + ni * 3)
  out.set(raw.subarray(0, 20))
  let o = 20
  const pos = new DataView(raw.buffer, raw.byteOffset + 20, nv * 6)
  for (let c = 0; c < 3; c++) {
    let prev = 0
    for (let i = 0; i < nv; i++) { const v = pos.getUint16((i * 3 + c) * 2, true), d = (v - prev) & 0xffff; prev = v; out[o + i] = d & 255; out[o + nv + i] = d >> 8 }
    o += nv * 2
  }
  const nrm = raw.subarray(20 + posB, 20 + posB + nv * 4)
  for (let c = 0; c < 4; c++) { let prev = 0; for (let i = 0; i < nv; i++) { const v = nrm[i * 4 + c]; out[o + i] = (v - prev) & 255; prev = v } o += nv }
  out.set(raw.subarray(20 + posB + nv * 4, 20 + posB + nv * 4 + nv), o); o += nv
  const iv = new DataView(raw.buffer, raw.byteOffset + 20 + posB + nv * 4 + regB, idxB)
  let hw = -1
  for (let i = 0; i < ni; i++) {
    const v = w === 4 ? iv.getUint32(i * 4, true) : iv.getUint16(i * 2, true)
    const d = v - (hw + 1), z = d >= 0 ? d * 2 : -d * 2 - 1 // zigzag; 0 = the next unseen vertex, small positive = a short skip ahead, odd = a back-reference
    if (v > hw) hw = v
    out[o + i] = z & 255; out[o + ni + i] = (z >> 8) & 255; out[o + 2 * ni + i] = z >> 16
  }
  return out
}

export function restoreBrainZ(z: Uint8Array): ArrayBuffer {
  const { nv, ni, w } = zHdr(z), posB = nv * 6 + zPad4(nv * 6), regB = nv + zPad4(nv)
  const raw = new Uint8Array(20 + posB + nv * 4 + regB + ni * w)
  raw.set(z.subarray(0, 20))
  let o = 20
  const pos = new DataView(raw.buffer, 20, nv * 6)
  for (let c = 0; c < 3; c++) {
    let prev = 0
    for (let i = 0; i < nv; i++) { prev = (prev + (z[o + i] | (z[o + nv + i] << 8))) & 0xffff; pos.setUint16((i * 3 + c) * 2, prev, true) }
    o += nv * 2
  }
  for (let c = 0; c < 4; c++) { let prev = 0; for (let i = 0; i < nv; i++) { prev = (prev + z[o + i]) & 255; raw[20 + posB + i * 4 + c] = prev } o += nv }
  raw.set(z.subarray(o, o + nv), 20 + posB + nv * 4); o += nv
  const iv = new DataView(raw.buffer, 20 + posB + nv * 4 + regB, ni * w)
  let hw = -1
  for (let i = 0; i < ni; i++) {
    const q = z[o + i] | (z[o + ni + i] << 8) | (z[o + 2 * ni + i] << 16)
    const v = hw + 1 + (q & 1 ? -(q + 1) / 2 : q / 2)
    if (v > hw) hw = v
    if (w === 4) iv.setUint32(i * 4, v, true); else iv.setUint16(i * 2, v, true)
  }
  return raw.buffer
}

/** gunzip a response body (DecompressionStream: Chrome 80, Safari 16.4, Firefox 113); resolves null where it does not exist */
export async function gunzipResponse(r: Response): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined' || !r.body) return null
  return new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
}

/** w12 latency: on the v3 site (main.ts sets window.__v3Gate before anything loads) the big .bin waits for the loader gate ('v3:ready', which
 *  needs only the first three waypoints' forms) or 6 s, whichever is first, so it never delays the gate. Nothing that gates the loader may await it. */
function afterGate(): Promise<void> {
  const w = typeof window !== 'undefined' ? (window as unknown as { __v3Gate?: boolean; __v3Ready?: boolean }) : null
  if (!w || !w.__v3Gate || w.__v3Ready) return Promise.resolve()
  return new Promise<void>(res => { const t = setTimeout(res, 6000); window.addEventListener('v3:ready', () => { clearTimeout(t); res() }, { once: true }) })
}

/** w14: the 0.96 MB lossless transport copy (<url>.z, scripts/compress-assets.mjs) when the browser can gunzip it, else the plain 3.3 MB file. Low priority: it never races the first stops. */
async function fetchBrainBytes(url: string): Promise<ArrayBuffer> {
  try {
    const z = await fetch(url + '.z', { priority: 'low' })
    if (z.ok) { const bytes = await gunzipResponse(z); if (bytes) return restoreBrainZ(bytes) }
  } catch { /* fall back to the plain file */ }
  const r = await fetch(url, { priority: 'low' })
  if (!r.ok) throw new Error(String(r.status))
  return r.arrayBuffer()
}

let cached: Promise<BrainMesh> | null = null
/** the brain mesh, shared by the glass and the particle form: the baked .bin, or a coarse mesh if it cannot be loaded */
export function loadBrainMesh(url = '/models/brain.bin'): Promise<BrainMesh> {
  if (!cached) {
    cached = afterGate().then(() => fetchBrainBytes(url)).then(unpackBrain)
      .catch(() => new Promise<BrainMesh>(res => setTimeout(() => res(meshBrain(0.03)), 0)))
  }
  return cached
}

// ------------------------------------------------------------------ the vault inside the brain
/** which region each vault folder lives in (folder order of src/data/brain-graph.json groups) */
export const FOLDER_REGION: Record<string, number> = {
  '10 Projects': R_FRONTAL, '90 Meta': R_PREFRONTAL, '20 Areas': R_PARIETAL, '50 Daily': R_OCCIPITAL, '30 Resources': R_TEMP_UP,
  '60 People': R_TEMP_LO, '40 Archives': R_DEEP, other: R_CEREBELLUM, '00 Inbox': R_STEM, '70 Meetings': R_DEEP,
}
export const CORE: [number, number, number] = [0, -0.06, -0.04]

/** interior sample points of a region, on a regular grid (deterministic) */
function interior(region: number, depth = 0.07, step = 0.045): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let z = BOUNDS.z0; z <= BOUNDS.z1; z += step) for (let y = BOUNDS.y0; y <= BOUNDS.y1; y += step) for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += step) {
    if (brainBase(x, y, z) < -depth && regionAt(x, y, z) === region) out.push([x, y, z])
  }
  return out
}
function pca(pts: [number, number, number][]) {
  const n = pts.length, c: [number, number, number] = [0, 0, 0]
  for (const p of pts) { c[0] += p[0] / n; c[1] += p[1] / n; c[2] += p[2] / n }
  const m = [0, 0, 0, 0, 0, 0] // xx xy xz yy yz zz
  for (const p of pts) { const a = p[0] - c[0], b = p[1] - c[1], d = p[2] - c[2]; m[0] += a * a / n; m[1] += a * b / n; m[2] += a * d / n; m[3] += b * b / n; m[4] += b * d / n; m[5] += d * d / n }
  const mul = (v: number[]) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[1] * v[0] + m[3] * v[1] + m[4] * v[2], m[2] * v[0] + m[4] * v[1] + m[5] * v[2]]
  const norm = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
  const power = (seed: number[], deflate: number[][]) => {
    let v = norm(seed)
    for (let it = 0; it < 40; it++) { v = mul(v); for (const u of deflate) { const d = v[0] * u[0] + v[1] * u[1] + v[2] * u[2]; v = [v[0] - d * u[0], v[1] - d * u[1], v[2] - d * u[2]] } v = norm(v) }
    const q = mul(v); return { v, s: Math.sqrt(Math.max(0, q[0] * v[0] + q[1] * v[1] + q[2] * v[2])) }
  }
  const e1 = power([1, 0.3, 0.2], []), e2 = power([0.2, 1, 0.3], [e1.v]), e3 = power([0.3, 0.2, 1], [e1.v, e2.v])
  return { c, e: [e1, e2, e3] }
}
/**
 * Place every note inside its folder's region: the note's own layout coordinates (x, y relative to its folder, as laid out by the
 * real force simulation) are mapped onto the region's two principal axes, depth from a stable hash, and anything that lands outside
 * the brain is moved to the nearest interior point of the region.
 */
export function layoutVault(nodes: [number, number, number, number][], groups: string[]): Float32Array {
  const byG = new Map<number, number[]>()
  nodes.forEach((n, i) => { if (!byG.has(n[2])) byG.set(n[2], []); byG.get(n[2])!.push(i) })
  const out = new Float32Array(nodes.length * 3)
  for (const [g, ids] of byG) {
    const reg = FOLDER_REGION[groups[g]] ?? R_DEEP
    const cand = interior(reg)
    if (!cand.length) continue
    const { c, e } = pca(cand)
    const cx = ids.reduce((a, i) => a + nodes[i][0], 0) / ids.length, cy = ids.reduce((a, i) => a + nodes[i][1], 0) / ids.length
    const ds = ids.map(i => Math.hypot(nodes[i][0] - cx, nodes[i][1] - cy)).sort((a, b) => a - b)
    const r90 = ds[Math.floor(ds.length * 0.9)] || 0.1
    for (const i of ids) {
      let u = (nodes[i][0] - cx) / r90, v = (nodes[i][1] - cy) / r90
      const l = Math.hypot(u, v)
      if (l > 1e-6) { const k = Math.tanh(l * 0.9) / l; u *= k; v *= k }
      const hz = (((Math.sin(i * 91.7 + 3.1) * 43758.5453) % 1) + 1) % 1
      const s = 1.55
      let p: [number, number, number] = [
        c[0] + e[0].v[0] * u * e[0].s * s + e[1].v[0] * v * e[1].s * s + e[2].v[0] * (hz - 0.5) * e[2].s * 2.6,
        c[1] + e[0].v[1] * u * e[0].s * s + e[1].v[1] * v * e[1].s * s + e[2].v[1] * (hz - 0.5) * e[2].s * 2.6,
        c[2] + e[0].v[2] * u * e[0].s * s + e[1].v[2] * v * e[1].s * s + e[2].v[2] * (hz - 0.5) * e[2].s * 2.6,
      ]
      if (brainBase(p[0], p[1], p[2]) > -0.06 || regionAt(p[0], p[1], p[2]) !== reg) {
        let bd = Infinity, bp = cand[0]
        for (const q of cand) { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2; if (d < bd) { bd = d; bp = q } }
        p = [bp[0] + (hz - 0.5) * 0.03, bp[1] + (((hz * 7.3) % 1) - 0.5) * 0.03, bp[2] + (((hz * 13.1) % 1) - 0.5) * 0.03]
      }
      out[i * 3] = p[0]; out[i * 3 + 1] = p[1]; out[i * 3 + 2] = p[2]
    }
  }
  return out
}
/** Control point of the quadratic Bezier for a link: links inside a folder arch gently, links between folders bundle toward the core like white matter. */
export function linkControl(a: [number, number, number], b: [number, number, number], cross: boolean, rnd: number): [number, number, number] {
  const k = cross ? 0.5 + 0.25 * rnd : 0.66 + 0.12 * rnd
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2
  return [CORE[0] + (mx - CORE[0]) * k, CORE[1] + (my - CORE[1]) * k, CORE[2] + (mz - CORE[2]) * k]
}

// ------------------------------------------------------------------ pose in the world
/** The brain is authored with its long axis on z. In the world it is seen from the side: anterior to screen right, and tipped a little toward the viewer. */
export const POSE = { yaw: Math.PI / 2, pitch: 0.2 }
export function poseVec(x: number, y: number, z: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  // rotate about y by yaw (x' = z, z' = -x for a quarter turn), then about x by pitch
  const cy = Math.cos(POSE.yaw), sy = Math.sin(POSE.yaw)
  const x1 = x * cy + z * sy, z1 = -x * sy + z * cy
  const cp = Math.cos(POSE.pitch), sp = Math.sin(POSE.pitch)
  out[0] = x1; out[1] = y * cp - z1 * sp; out[2] = y * sp + z1 * cp
  return out
}
