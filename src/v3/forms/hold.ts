// FORM "hold" — a bouldering hold: a lumpy resin jug with a countersunk bolt hole and bolt head, bolted
// to a textured wall panel (T-nut grid, panel seams, chalk), with a few smaller holds around it.
// Every hold is a silhouette inflated off the wall (pillow profile + resin lumps); particles carry a packed
// normal and are lit in the shader with a key light that drifts slowly, so the resin glints and the cast
// shadow on the wall stays soft.
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


const vn = (x: number, y: number) => { // smooth value noise in [-1, 1]
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy) * 2 - 1
}
const ELLIPSE = (cx: number, cy: number, rx: number, ry: number, rot = 0) => (g: CanvasRenderingContext2D) => { g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); g.fill() }
const holeAt = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over' }
// main jug: a kidney-bean blob with a heavy upper lip, bolt hole at (262, 190)
const mainDraw = (g: CanvasRenderingContext2D) => {
  g.beginPath()
  g.moveTo(40, 196)
  g.bezierCurveTo(30, 130, 90, 72, 176, 60)
  g.bezierCurveTo(250, 50, 300, 78, 352, 66)
  g.bezierCurveTo(430, 50, 500, 96, 504, 168)
  g.bezierCurveTo(508, 236, 470, 296, 400, 312)
  g.bezierCurveTo(350, 324, 330, 292, 282, 306)
  g.bezierCurveTo(240, 320, 214, 340, 160, 332)
  g.bezierCurveTo(90, 322, 50, 262, 40, 196)
  g.closePath(); g.fill()
  holeAt(g, 262, 188, 24)
}
const slopeDraw = (g: CanvasRenderingContext2D) => { ELLIPSE(120, 112, 100, 88, -0.2)(g); holeAt(g, 120, 112, 14) }
const pinchDraw = (g: CanvasRenderingContext2D) => {
  g.beginPath()
  g.moveTo(70, 30); g.bezierCurveTo(116, 10, 150, 40, 146, 90); g.bezierCurveTo(144, 140, 170, 170, 150, 220)
  g.bezierCurveTo(130, 262, 76, 262, 60, 220); g.bezierCurveTo(48, 180, 70, 150, 64, 100); g.bezierCurveTo(60, 70, 50, 50, 70, 30)
  g.closePath(); g.fill(); holeAt(g, 104, 140, 13)
}
const railDraw = (g: CanvasRenderingContext2D) => {
  g.beginPath(); g.moveTo(20, 60); g.bezierCurveTo(60, 24, 200, 30, 290, 40); g.bezierCurveTo(330, 46, 346, 80, 322, 100)
  g.bezierCurveTo(280, 126, 120, 120, 40, 108); g.bezierCurveTo(14, 100, 8, 76, 20, 60); g.closePath(); g.fill(); holeAt(g, 170, 76, 12)
}
const chipDraw = (g: CanvasRenderingContext2D) => { ELLIPSE(70, 64, 54, 42, 0.5)(g); holeAt(g, 70, 64, 9) }

const WALL_X = 4.35, WALL_Y = 2.65, GX = 0.62
type Spec = { res?: number; draw: (g: CanvasRenderingContext2D) => void; W: number; Hh: number; hx: number; hy: number; hr: number; sc: number; node: [number, number]; rot: number; hgt: number; rad: number; lump: number; tint: number[]; mat: number }
const SPECS: Spec[] = [
  { res: 0.78, draw: mainDraw, W: 520, Hh: 380, hx: 262, hy: 188, hr: 24, sc: 0.0062, node: [0, 0], rot: -0.06, hgt: 0.70, rad: 0.60, lump: 0.10, tint: [1.0, 0.40, 0.24], mat: 0 },
  { draw: slopeDraw, W: 250, Hh: 230, hx: 120, hy: 112, hr: 14, sc: 0.0066, node: [-5, 2], rot: 0.4, hgt: 0.34, rad: 0.62, lump: 0.10, tint: [0.96, 0.92, 0.80], mat: 1 },
  { draw: pinchDraw, W: 210, Hh: 280, hx: 104, hy: 140, hr: 13, sc: 0.0072, node: [4, 1], rot: 0.35, hgt: 0.42, rad: 0.30, lump: 0.14, tint: [0.70, 0.82, 0.94], mat: 1 },
  { draw: railDraw, W: 350, Hh: 150, hx: 170, hy: 76, hr: 12, sc: 0.0062, node: [-4, -2], rot: -0.1, hgt: 0.30, rad: 0.28, lump: 0.08, tint: [0.97, 0.74, 0.40], mat: 1 },
  { draw: chipDraw, W: 140, Hh: 130, hx: 70, hy: 64, hr: 9, sc: 0.0066, node: [3, -2], rot: 0.9, hgt: 0.22, rad: 0.28, lump: 0.10, tint: [0.95, 0.90, 0.80], mat: 1 },
  { draw: chipDraw, W: 140, Hh: 130, hx: 70, hy: 64, hr: 9, sc: 0.0058, node: [5, -1], rot: -0.6, hgt: 0.2, rad: 0.28, lump: 0.10, tint: [0.62, 0.78, 0.76], mat: 1 },
]

const form: FormDef = {
  id: 'hold',
  build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    let k = 0
    const put = (x: number, y: number, z: number, w: number, r: number, g: number, b: number, a: number) => { if (k < N) H.set(pos, col, k++, x, y, z, w, r, g, b, a) }
    const holds = SPECS.map(sp0 => {
      const f = sp0.res ?? 1
      const sp: Spec = { ...sp0, W: Math.round(sp0.W * f), Hh: Math.round(sp0.Hh * f), hx: sp0.hx * f, hy: sp0.hy * f, hr: sp0.hr * f, sc: sp0.sc / f }
      return { sp, R: raster(g => { g.scale(f, f); sp0.draw(g) }, sp.W, sp.Hh, 3) }
    })
    // density in particles per world unit^2 on a hold surface
    const RHO = N * 0.40 / 7.4
    const sampleDepth = (d: Float32Array, W: number, x: number, y: number) => {
      const xi = Math.max(0, Math.min(W - 2, Math.floor(x))), yi = Math.max(0, Math.floor(y)), fx = x - xi, fy = y - yi
      const i = yi * W + xi
      return (d[i] * (1 - fx) + d[i + 1] * fx) * (1 - fy) + (d[i + W] * (1 - fx) + d[i + W + 1] * fx) * fy
    }
    for (const { sp, R } of holds) {
      const { W, Hh, depth, inside } = R
      const SC = sp.sc, cr = Math.cos(sp.rot), sr = Math.sin(sp.rot)
      const nx0 = sp.node[0] * GX, ny0 = sp.node[1] * GX
      const prof = (d: number) => d >= sp.rad ? sp.hgt : sp.hgt * Math.sqrt(Math.max(0, 1 - (1 - d / sp.rad) * (1 - d / sp.rad)))
      const hz = (x: number, y: number) => {
        const d = sampleDepth(depth, W, x, y) * SC
        const l = 1 + sp.lump * (0.65 * vn(x * 0.03 + sp.node[0], y * 0.03 + sp.node[1]) + 0.35 * vn(x * 0.085, y * 0.085))
        // heavier toward the top, like a real jug lip
        const top = 1 + 0.18 * (1 - y / Hh)
        return prof(d) * l * top
      }
      const toWorld = (x: number, y: number): [number, number] => {
        const lx = (x - sp.hx) * SC, ly = (sp.hy - y) * SC
        return [nx0 + lx * cr - ly * sr, ny0 + lx * sr + ly * cr]
      }
      // pixel-wise stratified emission; the height field is cached once per pixel
      const hzg = new Float32Array(W * Hh)
      for (let i = 0; i < W * Hh; i++) if (inside[i] && depth[i] >= 0.4) hzg[i] = hz((i % W) + 0.5, Math.floor(i / W) + 0.5)
      const G = (i: number) => (inside[i] && depth[i] >= 0.4 ? hzg[i] : 0)
      for (let i = W + 1; i < W * Hh - W - 1; i++) {
        if (!inside[i] || depth[i] < 0.4) continue
        const px0 = i % W, py0 = Math.floor(i / W)
        const sx = (G(i + 1) - G(i - 1)) / (2 * SC), sy = (G(i + W) - G(i - W)) / (2 * SC)
        const wgt = Math.sqrt(1 + sx * sx + sy * sy)
        const cnt = Math.floor(RHO * SC * SC * Math.min(wgt, 4) + rand())
        for (let q = 0; q < cnt; q++) {
          const fx = rand(), fy = rand()
          const x = px0 + fx, y = py0 + fy
          const z = hzg[i] + (sx * (fx - 0.5) + sy * (fy - 0.5)) * SC
          const [wx, wy] = toWorld(x, y)
          const nnx = -sx, nny = sy
          const rnx = nnx * cr - nny * sr, rny = nnx * sr + nny * cr
          const dpx = depth[i]
          const dW = dpx * SC
          const hdist = Math.hypot(x - sp.hx, y - sp.hy)
          let tone = 0.88 + 0.12 * vn(x * 0.4, y * 0.4)
          if (hdist < sp.hr + 5) tone *= 1.5 // countersink lip
          const ao = 0.5 + 0.5 * Math.min(1, dW / 0.22)
          put(wx, wy, z, pack(rnx, rny, 1, sp.mat), sp.tint[0] * tone, sp.tint[1] * tone, sp.tint[2] * tone, 0.55 * ao)
        }
      }
      // bolt head sitting in the hole
      const holeW = sp.hr * SC
      const [bx, by] = toWorld(sp.hx, sp.hy)
      const nb = Math.floor(N * (sp.mat === 0 ? 0.010 : 0.003))
      for (let q = 0; q < nb; q++) {
        const r = holeW * 0.78 * Math.sqrt(rand()), th = rand() * 6.283185
        const hexo = r < holeW * 0.3 ? 0.08 : 1.1
        put(bx + r * Math.cos(th), by + r * Math.sin(th), 0.035, pack(0, 0, 1, 1), 0.82 * hexo, 0.84 * hexo, 0.88 * hexo, 0.55)
      }
    }
    // ---------------- the wall -------------------------------------------------------------------
    const main = holds[0], mainSp = main.sp
    const insideAny = (x: number, y: number) => {
      for (const { sp, R } of holds) {
        const cr = Math.cos(-sp.rot), sr = Math.sin(-sp.rot)
        const dx = x - sp.node[0] * GX, dy = y - sp.node[1] * GX
        const lx = dx * cr - dy * sr, ly = dx * sr + dy * cr
        const px = sp.hx + lx / sp.sc, py = sp.hy - ly / sp.sc
        if (px < 1 || py < 1 || px >= R.W - 1 || py >= R.Hh - 1) continue
        if (R.inside[Math.floor(py) * R.W + Math.floor(px)] && R.depth[Math.floor(py) * R.W + Math.floor(px)] > 1.5) return true
      }
      return false
    }
    const shadowAt = (x: number, y: number) => {
      // soft shadow of the main hold, thrown down and to the right by the key light
      const sx = x - 0.34 - mainSp.node[0] * GX, sy = y + 0.30 - mainSp.node[1] * GX
      const cr = Math.cos(-mainSp.rot), sr = Math.sin(-mainSp.rot)
      const lx = sx * cr - sy * sr, ly = sx * sr + sy * cr
      const px = mainSp.hx + lx / mainSp.sc, py = mainSp.hy - ly / mainSp.sc
      if (px < 0 || py < 0 || px >= main.R.W || py >= main.R.Hh) return 0
      return main.R.blur[Math.floor(py) * main.R.W + Math.floor(px)]
    }
    const nWall = Math.floor(N * 0.30)
    const pw = Math.sqrt((2 * WALL_X * 2 * WALL_Y) / nWall)
    const nxw = Math.ceil(2 * WALL_X / pw), nyw = Math.ceil(2 * WALL_Y / pw)
    for (let i = 0; i < nxw; i++) for (let j = 0; j < nyw; j++) {
      const x = -WALL_X + ((i + rand()) / nxw) * 2 * WALL_X, y = -WALL_Y + ((j + rand()) / nyw) * 2 * WALL_Y
      // nearest T-nut
      const gi = Math.round(x / GX), gj = Math.round(y / GX)
      const tx = x - gi * GX, ty = y - gj * GX, tr = Math.hypot(tx, ty)
      if (tr < 0.085) continue
      if (insideAny(x, y)) continue
      const pool = Math.exp(-(((x + 0.3) * (x + 0.3)) / 10 + ((y - 0.1) * (y - 0.1)) / 5))
      const sh = 1 - 0.78 * Math.min(1, shadowAt(x, y) * 1.2)
      // painted plywood: sandy speckle catches the raking light
      const jx = (rand() - 0.5) * 0.7, jy = (rand() - 0.5) * 0.7
      const sp = 0.5 + 0.5 * hash(i * 1.7, j * 2.3)
      const rimBoost = tr < 0.115 ? 2.6 : 1
      // panel seams
      const sx2 = Math.abs(((x + 0.31) / (4 * GX)) - Math.round((x + 0.31) / (4 * GX))) * (4 * GX), sy2 = Math.abs(((y + 0.31) / (3 * GX)) - Math.round((y + 0.31) / (3 * GX))) * (3 * GX)
      const seam = (sx2 < 0.016 || sy2 < 0.016) ? 2.2 : 1
      put(x, y, 0.0, pack(jx, jy, 1, 2), 0.88, 0.88, 0.86, 0.62 * sh * (0.5 + sp) * rimBoost * seam * (0.35 + 0.65 * pool))
    }
    // T-nut rings (bright rims around the dark holes)
    for (let gi = -7; gi <= 7; gi++) for (let gj = -5; gj <= 5; gj++) {
      const hx = gi * GX, hy = gj * GX
      if (Math.abs(hx) > WALL_X || Math.abs(hy) > WALL_Y || insideAny(hx, hy)) continue
      const pool = Math.exp(-(((hx + 0.3) * (hx + 0.3)) / 10 + ((hy - 0.1) * (hy - 0.1)) / 5))
      const sh = 1 - 0.78 * Math.min(1, shadowAt(hx, hy) * 1.2)
      const n = Math.floor(N * 0.0006)
      for (let q = 0; q < n; q++) {
        const th = rand() * 6.283185, r = 0.085 + rand() * 0.035
        put(hx + r * Math.cos(th), hy + r * Math.sin(th), 0.0, pack(-Math.cos(th) * 0.6, -Math.sin(th) * 0.6, 1, 2), 0.95, 0.95, 0.92, 0.5 * (0.3 + 0.7 * pool) * sh)
      }
    }
    // ---------------- chalk: puffs near the jug, a drift of fine dust ----------------------------------
    const puffs: number[][] = [[-0.55, 1.1, 0.45, 0.42], [0.4, 1.2, 0.5, 0.34], [-1.3, 0.2, 0.3, 0.3], [0.95, -0.8, 0.35, 0.4], [-0.1, -1.0, 0.25, 0.5]]
    const nChalk = Math.floor(N * 0.07)
    for (let q = 0; q < nChalk; q++) {
      const p = puffs[Math.floor(rand() * puffs.length)]
      const g1 = () => (rand() + rand() + rand() - 1.5) * 0.9
      put(p[0] + g1() * p[3], p[1] + g1() * p[3] * 0.9, p[2] + Math.abs(g1()) * p[3], pack(0, 0, 1, 3), 1, 0.98, 0.94, 0.07 + 0.12 * rand())
    }
    while (k < N) put((rand() - 0.5) * 9.2, (rand() - 0.5) * 5.6, 0.1 + Math.pow(rand(), 1.7) * 3.0, pack(0, 0, 1, 4), 1, 0.96, 0.9, 0.04 + 0.12 * Math.pow(rand(), 2))
  },
  glsl: /* glsl */ `
vec3 hd_n(float w, out float mat) {
  float v = floor(w + 0.5);
  mat = mod(v, 8.0); v = floor(v / 8.0);
  float a = mod(v, 64.0); v = floor(v / 64.0);
  float b = mod(v, 64.0); float c = floor(v / 64.0);
  return normalize(vec3(a, b, c) / 63.0 * 2.0 - 1.0);
}
vec3 anim_hold(vec3 p, vec4 d, vec4 r, float t) {
  float mat; hd_n(d.w, mat);
  if (mat > 2.5) {
    float s = mat > 3.5 ? 1.0 : 0.6;
    p += s * vec3(sin(t * 0.21 + r.x * 40.0) * 0.14, cos(t * 0.17 + r.y * 40.0) * 0.14 - 0.03 * t * (mat > 3.5 ? 0.0 : 0.15), sin(t * 0.25 + r.z * 40.0) * 0.1);
    if (mat < 3.5) p.y = mod(p.y + 1.6, 3.4) - 1.6;
  }
  return p;
}
float size_hold(vec4 d, vec4 r, float t) { float mat; hd_n(d.w, mat); return mat > 3.5 ? 0.75 : (mat > 2.5 ? 1.5 : (mat > 1.5 ? 1.2 : 1.0)); }
vec4 color_hold(vec4 c, vec4 d, vec4 r, float t) {
  float mat; vec3 n = hd_n(d.w, mat);
  if (mat > 2.5) { c.a *= 0.55 + 0.45 * sin(t * 1.3 + r.w * 40.0); return c; }
  // a key light that drifts along the wall (like a headtorch), plus a cool rim from the right
  vec3 L1 = normalize(vec3(-0.62 + 0.28 * sin(t * 0.33), 0.55 + 0.1 * sin(t * 0.21), 0.42));
  vec3 L2 = normalize(vec3(0.8, -0.1, 0.45));
  float dif = max(dot(n, L1), 0.0);
  float rim = pow(1.0 - max(n.z, 0.0), 2.0) * (0.35 + 0.65 * max(dot(n, L2), 0.0));
  vec3 Hv = normalize(L1 + vec3(0.0, 0.0, 1.0));
  float sp = pow(max(dot(n, Hv), 0.0), 26.0);
  float wall = mat > 1.5 ? 1.0 : 0.0;
  vec3 rgb = c.rgb * (0.10 + (1.1 - 0.35 * wall) * dif) + vec3(0.55, 0.72, 1.0) * rim * 0.55 + vec3(1.0, 0.92, 0.82) * sp * (0.95 - 0.55 * wall);
  return vec4(rgb, c.a);
}`,
  camera: { pos: [2.8, 1.1, 8.2], target: [0.0, 0.0, 0.0], fov: 35 },
  pointSize: 2.4,
  drift: 0.002,
}
export default form
