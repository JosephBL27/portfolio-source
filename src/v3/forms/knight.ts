// FORM "knight" — a chess knight (Staunton-style: turned base and collar, carved horse head with a
// scalloped mane) standing on a checkerboard of particles, with a faint reflection in the board.
// The head is a silhouette inflated into a pillow (thickness follows local width), the base is a lathe.
// Every particle carries a packed normal and is lit in the shader, so the piece can turn slowly.
import type { FormDef } from './types'
import { H } from './ctx'

// ---------------------------------------------------------------------------------------------
// silhouette -> inside-distance field
function raster(draw: (g: CanvasRenderingContext2D) => void, W: number, Hh: number, blurR: number) {
  const c = document.createElement('canvas'); c.width = W; c.height = Hh
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#fff'; draw(g)
  const px = g.getImageData(0, 0, W, Hh).data
  let a = new Float32Array(W * Hh); for (let i = 0; i < a.length; i++) a[i] = px[i * 4 + 3] / 255
  // two box blurs + threshold = rounded corners
  const tmp = new Float32Array(a.length)
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < Hh; y++) { let s = 0; const row = y * W
      for (let x = -blurR; x <= blurR; x++) s += a[row + Math.min(W - 1, Math.max(0, x))]
      for (let x = 0; x < W; x++) { tmp[row + x] = s / (2 * blurR + 1); s += a[row + Math.min(W - 1, x + blurR + 1)] - a[row + Math.max(0, x - blurR)] } }
    for (let x = 0; x < W; x++) { let s = 0
      for (let y = -blurR; y <= blurR; y++) s += tmp[Math.min(Hh - 1, Math.max(0, y)) * W + x]
      for (let y = 0; y < Hh; y++) { a[y * W + x] = s / (2 * blurR + 1); s += tmp[Math.min(Hh - 1, y + blurR + 1) * W + x] - tmp[Math.max(0, y - blurR) * W + x] } }
  }
  const inside = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) inside[i] = a[i] > 0.5 ? 1 : 0
  // chamfer distance to the outside
  const d = new Float32Array(a.length)
  for (let i = 0; i < d.length; i++) d[i] = inside[i] ? 1e6 : 0
  const S = Math.SQRT2
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!inside[i]) continue
    let v = d[i]
    if (x === 0 || y === 0) v = Math.min(v, 1)
    else v = Math.min(v, d[i - 1] + 1, d[i - W] + 1, d[i - W - 1] + S, d[i - W + 1 < i ? i - W + 1 : i] + S)
    d[i] = v }
  for (let y = Hh - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!inside[i]) continue
    let v = d[i]
    if (x === W - 1 || y === Hh - 1) v = Math.min(v, 1)
    else v = Math.min(v, d[i + 1] + 1, d[i + W] + 1, d[i + W + 1] + S, d[i + W - 1] + S)
    d[i] = v }
  // light smoothing of the distance field (kills stair-steps in the normals)
  const s2 = new Float32Array(d.length)
  for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x
    s2[i] = inside[i] ? (d[i] * 4 + d[i - 1] + d[i + 1] + d[i - W] + d[i + W]) / 8 : 0 }
  return { W, Hh, depth: s2, inside, blur: a }
}

// ---------------------------------------------------------------------------------------------
const pack = (nx: number, ny: number, nz: number, mat: number) => {
  const l = Math.hypot(nx, ny, nz) || 1
  const q = (v: number) => Math.max(0, Math.min(63, Math.round(((v / l) * 0.5 + 0.5) * 63)))
  return mat + 8 * (q(nx) + 64 * (q(ny) + 64 * q(nz)))
}
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s) }


const SW = 400, SHT = 580
const knightDraw = (g: CanvasRenderingContext2D) => {
  g.beginPath()
  g.moveTo(112, 580)
  g.lineTo(112, 500)
  g.bezierCurveTo(108, 476, 100, 452, 104, 428)           // chest
  g.bezierCurveTo(110, 404, 134, 394, 144, 376)           // throat
  g.bezierCurveTo(116, 372, 86, 366, 62, 354)             // underside of jaw
  g.bezierCurveTo(36, 346, 18, 336, 12, 320)              // chin
  g.bezierCurveTo(4, 302, 8, 284, 18, 268)                // nose
  g.bezierCurveTo(38, 232, 70, 186, 104, 142)             // bridge of the nose
  g.bezierCurveTo(116, 124, 120, 108, 122, 92)            // forehead
  g.lineTo(128, 36); g.bezierCurveTo(132, 18, 140, 6, 150, 2) // ear front
  g.bezierCurveTo(160, 16, 168, 38, 172, 60)              // ear back
  g.bezierCurveTo(194, 52, 222, 58, 246, 76)              // poll and start of mane
  g.bezierCurveTo(232, 88, 240, 102, 264, 108)
  g.bezierCurveTo(246, 124, 256, 138, 284, 142)
  g.bezierCurveTo(266, 160, 278, 174, 306, 176)
  g.bezierCurveTo(288, 196, 300, 210, 328, 212)
  g.bezierCurveTo(310, 234, 322, 250, 348, 250)
  g.bezierCurveTo(332, 282, 342, 312, 354, 332)
  g.bezierCurveTo(358, 382, 352, 432, 358, 472)
  g.lineTo(360, 500); g.lineTo(360, 580)
  g.closePath(); g.fill()
}

const MOUTH: number[][] = [[18, 318], [52, 334], [100, 346], [138, 358]]
const segDist = (x: number, y: number, pts: number[][]) => {
  let best = 1e9
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1]
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy))
  }
  return best
}
const BOARD_Y = -1.9
const form: FormDef = {
  id: 'knight',
  build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    let k = 0
    const put = (x: number, y: number, z: number, w: number, r: number, g: number, b: number, a: number) => { if (k < N) H.set(pos, col, k++, x, y, z, w, r, g, b, a) }
    const SC = 2.1 / 500, HALF = 0.36, RB = 0.36
    const HEAD_Y0 = BOARD_Y + 0.9      // world y of the head's bottom (collar top)
    const ivory = [0.95, 0.92, 0.84]
    const refl: number[][] = []         // knight points kept for the board reflection
    // ---------------- head: inflated silhouette -------------------------------------------------
    const R = raster(knightDraw, SW, SHT, 4)
    const { W, Hh, depth, inside } = R
    const prof = (d: number) => d >= RB ? HALF : HALF * Math.sqrt(Math.max(0, 1 - (1 - d / RB) * (1 - d / RB)))
    const slope = (d: number) => d >= RB ? 0 : Math.min(4, ((1 - d / RB) * HALF / RB) / Math.max(1e-3, Math.sqrt(Math.max(0, 1 - (1 - d / RB) * (1 - d / RB)))))
    const idx: number[] = [], wts: number[] = []
    let acc = 0, band = 0
    for (let i = 0; i < W * Hh; i++) {
      if (!inside[i] || depth[i] < 0.5) continue
      if (Math.floor(i / W) > 500) continue
      const d = depth[i] * SC; const wgt = Math.sqrt(1 + slope(d) * slope(d))
      acc += wgt; idx.push(i); wts.push(wgt)
      if (depth[i] < 1.5) band++
    }
    const nHead = Math.floor(N * 0.36)
    const grad = (x: number, y: number) => {
      const xi = Math.min(W - 2, Math.max(1, Math.round(x))), yi = Math.min(Hh - 2, Math.max(1, Math.round(y))), i = yi * W + xi
      return [(depth[i + 1] - depth[i - 1]) * 0.5, (depth[i + W] - depth[i - W]) * 0.5]
    }
    const dens = nHead / (2 * acc * 1.0)
    const headPoint = (x: number, y: number, side: number, dpx: number, gx: number, gy: number, cull: number) => {
      const d = dpx * SC, sl = slope(d)
      const wx = (x - 205) * SC, wy = (500 - y) * SC + HEAD_Y0
      // face tone: ivory with a slow marble swirl; mane gets engraved strand lines that follow the outline
      let tone = 0.9 + 0.1 * Math.sin(wx * 5 + Math.sin(wy * 4) * 2)
      const maneZone = x > 190 && y > 50 && y < 340 ? 1 : 0
      if (maneZone) tone *= 0.55 + 0.45 * Math.pow(Math.abs(Math.sin(dpx * 0.42)), 2.2)
      // eye (recess + lid ring), nostril, mouth line
      const ex = (x - 100) * 1.0, ey = (y - 206) * 1.25, er = Math.hypot(ex, ey)
      if (er < 9) tone *= 0.05; else if (er < 16) tone *= 1.6
      const nx2 = x - 26, ny2 = y - 296, nr = Math.hypot(nx2, ny2)
      if (nr < 7) tone *= 0.06; else if (nr < 11) tone *= 1.5
      // lip line
      const md = segDist(x, y, MOUTH)
      if (md < 2.6) tone *= 0.12; else if (md < 5) tone *= 1.35
      const ear = x > 126 && x < 160 && y < 70 && dpx > 3 ? 0.55 : 1
      const z = side * prof(d)
      if (cull < 1 && rand() > cull) return
      put(wx, wy, z, pack(-sl * gx, sl * gy, side, 0), ivory[0] * tone * ear, ivory[1] * tone * ear, ivory[2] * tone * ear, 0.30 * (0.78 + 0.22 * Math.min(1, dpx / 12)))
      if (refl.length < 20000 && rand() < 0.15) refl.push([wx, wy, z, -sl * gx, sl * gy, side, tone * ear])
    }
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j], px0 = i % W, py0 = Math.floor(i / W), dpx = depth[i]
      for (let side = 1; side >= -1; side -= 2) {
        const cnt = Math.floor(dens * wts[j] * (side > 0 ? 1.5 : 0.12) + rand())
        for (let q = 0; q < cnt; q++) {
          const x = px0 + rand(), y = py0 + rand()
          const [gx, gy] = grad(x, y)
          headPoint(x, y, side, dpx, gx, gy, 1)
        }
      }
    }
    // thin side walls are covered by the pillow itself (profile reaches zero thickness at the outline)
    // ---------------- base: a turned lathe ------------------------------------------------------
    const prof2: number[][] = [
      [0.72, 0.00], [0.75, 0.035], [0.75, 0.09], [0.71, 0.145], [0.67, 0.18], [0.69, 0.225], [0.60, 0.29], [0.50, 0.38], [0.45, 0.50],
      [0.47, 0.58], [0.57, 0.64], [0.60, 0.68], [0.55, 0.725], [0.52, 0.77], [0.55, 0.83], [0.52, 0.90],
    ]
    const nBase = Math.floor(N * 0.11), pitchB = 0
    void pitchB
    let areaB = 0
    for (let i = 0; i < prof2.length - 1; i++) { const dr = prof2[i + 1][0] - prof2[i][0], dy = prof2[i + 1][1] - prof2[i][1]; areaB += Math.hypot(dr, dy) * 2 * Math.PI * (prof2[i][0] + prof2[i + 1][0]) / 2 }
    const bd = nBase / areaB
    for (let i = 0; i < prof2.length - 1; i++) {
      const [r0, y0] = prof2[i], [r1, y1] = prof2[i + 1]
      const L = Math.hypot(r1 - r0, y1 - y0), ravg = (r0 + r1) / 2
      const nr = Math.max(1, Math.round(L * Math.sqrt(bd)))
      const nrm = [y1 - y0, -(r1 - r0)]; const nl = Math.hypot(nrm[0], nrm[1]) || 1
      for (let a = 0; a < nr; a++) {
        const t = (a + rand()) / nr, r = r0 + (r1 - r0) * t, y = y0 + (y1 - y0) * t
        const m = Math.max(1, Math.round(2 * Math.PI * r * Math.sqrt(bd)))
        const ph = rand() * 6.283
        for (let b = 0; b < m; b++) {
          const th = ph + ((b + rand()) / m) * 6.283185
          const c = Math.cos(th), s2 = Math.sin(th)
          const nx = nrm[0] / nl * c, ny = nrm[1] / nl, nz = nrm[0] / nl * s2
          const ring = 0.85 + 0.15 * Math.sin(y * 70)
          const wy = BOARD_Y + y
          put(r * c, wy, r * s2, pack(nx, ny, nz, 0), ivory[0] * ring, ivory[1] * ring, ivory[2] * ring, 0.5)
          if (refl.length < 28000 && rand() < 0.1) refl.push([r * c, wy, r * s2, nx, ny, nz, ring])
        }
      }
      void ravg
    }
    // collar top: a closing disc under the head
    for (let q = 0, m = Math.floor(N * 0.012); q < m; q++) {
      const r = 0.52 * Math.sqrt(rand()), th = rand() * 6.283185
      put(r * Math.cos(th), BOARD_Y + 0.9, r * Math.sin(th), pack(0, 1, 0, 0), ivory[0] * 0.8, ivory[1] * 0.8, ivory[2] * 0.8, 0.4)
    }
    // ---------------- reflection in the polished board -----------------------------------------
    for (const q of refl) put(q[0], 2 * BOARD_Y - q[1], q[2], pack(q[3], -q[4], q[5], 3), ivory[0] * q[6], ivory[1] * q[6], ivory[2] * q[6], 0.2)
    // ---------------- checkerboard --------------------------------------------------------------
    const SQ = 1.3, COLS = 5, ROWS = 4
    const fade = (x: number, z: number) => Math.exp(-((x * x) / 28 + (z * z) / 16))
    let sumF = 0
    for (let c = -COLS; c <= COLS; c++) for (let r = -ROWS; r <= ROWS; r++) if (((c + r) & 1) !== 0) sumF += fade(c * SQ, r * SQ)
    const budgetLight = N * 0.20
    const pitch = Math.sqrt(SQ * SQ * sumF / budgetLight)
    for (let c = -COLS; c <= COLS; c++) for (let r = -ROWS; r <= ROWS; r++) {
      const light = ((c + r) & 1) !== 0
      const x0 = c * SQ, z0 = r * SQ
      const pp = light ? pitch : pitch * 2.6
      const n = Math.ceil(SQ / pp)
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = x0 + ((i + 0.5 + (rand() - 0.5) * 0.9) / n - 0.5) * SQ, z = z0 + ((j + 0.5 + (rand() - 0.5) * 0.9) / n - 0.5) * SQ
        const f = fade(x, z)
        if (rand() > f) continue
        const ex = Math.min(SQ / 2 - Math.abs(x - x0), SQ / 2 - Math.abs(z - z0))
        const edge = ex < 0.04 ? 1.5 : 1
        const hole = 1 - 0.85 * Math.exp(-((x * x) + (z * z)) / 0.45) // contact shadow under the foot
        put(x, BOARD_Y - 0.003, z, pack(0, 1, 0, light ? 1 : 2), 0.95, 0.92, 0.82, (light ? 0.5 : 0.1) * edge * Math.min(1, f * 1.4) * hole)
      }
    }
    // dust in the light
    while (k < N) put((rand() - 0.5) * 9, BOARD_Y + rand() * 5.4, (rand() - 0.5) * 6 - 0.4, pack(0, 1, 0, 4), 1, 0.94, 0.82, 0.05 + 0.16 * Math.pow(rand(), 3))
  },
  glsl: /* glsl */ `
vec3 kn_n(float w, out float mat) {
  float v = floor(w + 0.5);
  mat = mod(v, 8.0); v = floor(v / 8.0);
  float a = mod(v, 64.0); v = floor(v / 64.0);
  float b = mod(v, 64.0); float c = floor(v / 64.0);
  return normalize(vec3(a, b, c) / 63.0 * 2.0 - 1.0);
}
float kn_ang(float t) { return 0.5 * sin(t * 0.35) + 0.1 * sin(t * 0.8 + 1.0); }
vec3 kn_rot(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
vec3 anim_knight(vec3 p, vec4 d, vec4 r, float t) {
  float mat; kn_n(d.w, mat);
  if (mat < 0.5 || (mat > 2.5 && mat < 3.5)) p = kn_rot(p, kn_ang(t));
  else if (mat > 3.5) { p += vec3(sin(t * 0.3 + r.x * 30.0) * 0.12, 0.10 * t * (0.2 + r.y), cos(t * 0.27 + r.z * 30.0) * 0.12); p.y = -1.9 + mod(p.y + 1.9, 5.4); }
  return p;
}
float size_knight(vec4 d, vec4 r, float t) { float mat; kn_n(d.w, mat); return mat > 3.5 ? 0.7 : (mat > 0.5 && mat < 2.5 ? 0.9 : 1.0); }
vec4 color_knight(vec4 c, vec4 d, vec4 r, float t) {
  float mat; vec3 n = kn_n(d.w, mat);
  if (mat > 3.5) { c.a *= 0.6 + 0.4 * sin(t * 1.7 + r.w * 40.0); return c; }
  if (mat > 0.5 && mat < 2.5) return c;
  if (mat < 0.5 || mat > 2.5) n = kn_rot(n, kn_ang(t));
  vec3 L1 = normalize(vec3(-0.78, 0.50, 0.38));
  vec3 L2 = normalize(vec3(0.75, 0.25, -0.55));
  float dif = max(dot(n, L1), 0.0);
  float rim = pow(1.0 - max(n.z, 0.0), 2.2) * (0.5 + 0.5 * dot(n, L2));
  vec3 Hv = normalize(L1 + vec3(0.0, 0.0, 1.0));
  float sp = pow(max(dot(n, Hv), 0.0), 40.0);
  vec3 rgb = c.rgb * (0.09 + 1.25 * dif) + vec3(0.62, 0.78, 1.0) * rim * 0.6 + vec3(1.0, 0.95, 0.85) * sp * 0.8;
  return vec4(rgb, c.a);
}`,
  camera: { pos: [2.6, 3.4, 8.2], target: [0.0, -0.4, 0.0], fov: 35 },
  pointSize: 2.9,
  drift: 0.002,
}
export default form
