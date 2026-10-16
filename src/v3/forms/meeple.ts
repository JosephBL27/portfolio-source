// FORM "meeple" — a chunky wooden board-game meeple with real depth (silhouette extruded with a rounded
// bevel), two dice and a small stack of cards on a pool of table light. Lit per particle in the shader from
// a packed normal, so the meeple can turn slowly and the light stays put.
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

const meepleDraw = (g: CanvasRenderingContext2D) => {
  g.beginPath(); g.arc(200, 94, 62, 0, Math.PI * 2); g.fill()
  g.beginPath()
  g.moveTo(146, 140)
  g.bezierCurveTo(116, 148, 78, 156, 50, 172)
  g.bezierCurveTo(14, 190, 4, 228, 24, 250)
  g.bezierCurveTo(42, 268, 80, 266, 112, 262)
  g.bezierCurveTo(116, 300, 90, 352, 58, 398)
  g.bezierCurveTo(40, 424, 46, 464, 84, 466)
  g.lineTo(156, 466)
  g.bezierCurveTo(176, 466, 178, 446, 176, 424)
  g.bezierCurveTo(176, 384, 182, 346, 200, 334)
  g.bezierCurveTo(218, 346, 224, 384, 224, 424)
  g.bezierCurveTo(222, 446, 224, 466, 244, 466)
  g.lineTo(316, 466)
  g.bezierCurveTo(354, 464, 360, 424, 342, 398)
  g.bezierCurveTo(310, 352, 284, 300, 288, 262)
  g.bezierCurveTo(320, 266, 358, 268, 376, 250)
  g.bezierCurveTo(396, 228, 386, 190, 350, 172)
  g.bezierCurveTo(322, 156, 284, 148, 254, 140)
  g.closePath(); g.fill()
}

const TABLE_Y = -1.5
const form: FormDef = {
  id: 'meeple',
  build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    let k = 0
    const put = (x: number, y: number, z: number, w: number, r: number, g: number, b: number, a: number) => { if (k < N) H.set(pos, col, k++, x, y, z, w, r, g, b, a) }
    // ---------------- meeple -------------------------------------------------------------
    const R = raster(meepleDraw, 400, 480, 5)
    const SC = 3.05 / 470, HALF = 0.40, RB = 0.18
    const { W, Hh, depth, inside } = R
    const prof = (d: number) => d >= RB ? HALF : (HALF - RB) + Math.sqrt(Math.max(0, RB * RB - (RB - d) * (RB - d)))
    const slope = (d: number) => d >= RB ? 0 : Math.min(4, (RB - d) / Math.max(1e-4, Math.sqrt(Math.max(0, RB * RB - (RB - d) * (RB - d)))))
    // cumulative area weights over inside pixels (area of the inflated surface is dA * sqrt(1+slope^2))
    const idx: number[] = [], cdf: number[] = []
    let acc = 0, edgeBand = 0
    for (let i = 0; i < W * Hh; i++) {
      if (!inside[i] || depth[i] < 0.5) continue
      const d = depth[i] * SC
      acc += Math.sqrt(1 + slope(d) * slope(d)); idx.push(i); cdf.push(acc)
      if (depth[i] < 1.6) edgeBand++
    }
    const M = Math.floor(N * 0.46)
    const faceArea = 2 * acc * SC * SC, wallArea = (edgeBand / 1.1) * SC * SC * 2 * (HALF - RB)
    const nWall = Math.floor(M * wallArea / (wallArea + faceArea)), nFace = M - nWall
    const grad = (x: number, y: number) => {
      const xi = Math.min(W - 2, Math.max(1, Math.round(x))), yi = Math.min(Hh - 2, Math.max(1, Math.round(y))), i = yi * W + xi
      return [(depth[i + 1] - depth[i - 1]) * 0.5, (depth[i + W] - depth[i - W]) * 0.5]
    }
    const wood = (x: number, y: number) => 0.74 + 0.26 * Math.sin((x * 2.3 + 0.8 * Math.sin(y * 3.1 + x * 0.7) + y * 0.15) * 14) + 0.06 * hash(Math.floor(x * 90), Math.floor(y * 90))
    const woodCol = [1.0, 0.74, 0.44]
    // stratified: every inside pixel emits floor(expected + rand) particles per side, so coverage has no clumps
    const dens = nFace / (2 * acc)
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j], wgt = j ? cdf[j] - cdf[j - 1] : cdf[0]
      const dpx = depth[i], d = dpx * SC, sl = slope(d)
      const px0 = i % W, py0 = Math.floor(i / W)
      for (let side = 1; side >= -1; side -= 2) {
        const cnt = Math.floor(dens * wgt * (side > 0 ? 1.45 : 0.3) + rand())
        for (let q = 0; q < cnt; q++) {
          const x = px0 + rand(), y = py0 + rand()
          const [gx, gy] = grad(x, y)
          const wx = (x - 200) * SC, wy = (470 - y) * SC + TABLE_Y
          const wd = wood(wx, wy), ao = 0.78 + 0.22 * Math.min(1, dpx / 14)
          put(wx, wy, side * prof(d), pack(-sl * gx, sl * gy, side, 0), woodCol[0] * wd, woodCol[1] * wd, woodCol[2] * wd, 0.55 * ao)
        }
      }
    }
    const band: number[] = []
    for (const i of idx) if (depth[i] < 1.6) band.push(i)
    const wdens = nWall / band.length
    for (const i of band) {
      const cnt = Math.floor(wdens + rand())
      for (let q = 0; q < cnt; q++) {
        const x = (i % W) + rand(), y = Math.floor(i / W) + rand()
        const [gx, gy] = grad(x, y)
        const gl = Math.hypot(gx, gy) || 1
        const z = (rand() * 2 - 1) * (HALF - RB)
        const wx = (x - 200) * SC, wy = (470 - y) * SC + TABLE_Y
        const wd = wood(wx, wy) * 0.9
        put(wx, wy, z, pack(-gx / gl, gy / gl, 0, 0), woodCol[0] * wd, woodCol[1] * wd, woodCol[2] * wd, 0.5)
      }
    }
    // ---------------- dice (stratified lattice on five faces) --------------------------------
    const pips: number[][][] = [
      [[0, 0]], [[-1, -1], [1, 1]], [[-1, -1], [0, 0], [1, 1]], [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    ]
    // n, u axis, v axis ; pip count per face (opposite faces sum to 7)
    const faces: [number[], number[], number[], number][] = [
      [[1, 0, 0], [0, 0, -1], [0, 1, 0], 3], [[-1, 0, 0], [0, 0, 1], [0, 1, 0], 4], [[0, 1, 0], [1, 0, 0], [0, 0, 1], 6],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0], 2], [[0, 0, -1], [-1, 0, 0], [0, 1, 0], 5],
    ]
    const dice = (cx: number, cz: number, size: number, yaw: number, pitch: number) => {
      const a = size / 2, rr = size * 0.13
      const cy = TABLE_Y + a, cyw = Math.cos(yaw), syw = Math.sin(yaw)
      const n = Math.ceil(size / pitch)
      for (const f of faces) {
        // additive points have no occlusion, so only faces that look toward the camera are drawn
        const fnx = f[0][0] * cyw + f[0][2] * syw, fnz = -f[0][0] * syw + f[0][2] * cyw
        if (fnx * 0.27 + f[0][1] * 0.15 + fnz * 0.95 < 0.02) continue
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const U = ((i + 0.5 + (rand() - 0.5) * 0.9) / n) * 2 - 1, V = ((j + 0.5 + (rand() - 0.5) * 0.9) / n) * 2 - 1
        let x = (f[0][0] + f[1][0] * U + f[2][0] * V) * a, y = (f[0][1] + f[1][1] * U + f[2][1] * V) * a, z = (f[0][2] + f[1][2] * U + f[2][2] * V) * a
        let nx = f[0][0], ny = f[0][1], nz = f[0][2]
        const ix = Math.max(-(a - rr), Math.min(a - rr, x)), iy = Math.max(-(a - rr), Math.min(a - rr, y)), iz = Math.max(-(a - rr), Math.min(a - rr, z))
        const dx = x - ix, dy = y - iy, dz = z - iz, dl = Math.hypot(dx, dy, dz)
        let shade = 1
        const interior = Math.abs(U) <= 1 - rr / a && Math.abs(V) <= 1 - rr / a
        if (dl > 1e-6) { nx = dx / dl; ny = dy / dl; nz = dz / dl; x = ix + nx * rr; y = iy + ny * rr; z = iz + nz * rr; if (!interior) shade = 1.15 }
        if (interior) for (const p of pips[f[3] - 1]) {
          const rd = Math.hypot(U - p[0] * 0.5, V - p[1] * 0.5)
          if (rd < 0.15) shade = 0.05; else if (rd < 0.20) shade = 1.45
        }
        const x3 = x * cyw + z * syw, z3 = -x * syw + z * cyw
        const nx3 = nx * cyw + nz * syw, nz3 = -nx * syw + nz * cyw
        put(cx + x3, cy + y, cz + z3, pack(nx3, ny, nz3, 1), 0.95 * shade, 0.93 * shade, 0.86 * shade, 0.62 * Math.min(1.25, shade * 0.85 + 0.15))
        }
      }
    }
    dice(-1.95, 1.05, 0.72, 0.55, 0.0125)
    dice(1.75, 1.5, 0.62, -0.4, 0.0125)
    dice(-1.0, 1.8, 0.46, 1.1, 0.0125)
    // ---------------- cards: a hand fanned upright behind, and a squared deck on the table -------
    const CW = 0.95, CH = 1.32, RC = 0.12
    const cardAt = (face: { x: number; y: number; z: number }[], uvList: number[][]) => void 0
    void cardAt
    const rot3 = (v: number[], rx: number, ry: number, rz: number) => {
      // roll about z, tip about x, then yaw about y
      let [x, y, z] = v
      let x1 = x * Math.cos(rz) - y * Math.sin(rz), y1 = x * Math.sin(rz) + y * Math.cos(rz); x = x1; y = y1
      let y2 = y * Math.cos(rx) - z * Math.sin(rx), z2 = y * Math.sin(rx) + z * Math.cos(rx); y = y2; z = z2
      let x3 = x * Math.cos(ry) + z * Math.sin(ry), z3 = -x * Math.sin(ry) + z * Math.cos(ry); x = x3; z = z3
      return [x, y, z]
    }
    const cardPlate = (px: number, py: number, pz: number, rx: number, ry: number, rz: number, off: number[], pitch: number, thick: number, tone: number) => {
      const nu = Math.ceil(CW / pitch), nv = Math.ceil(CH / pitch)
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const u = ((i + 0.5 + (rand() - 0.5) * 0.9) / nu - 0.5) * CW, v = ((j + 0.5 + (rand() - 0.5) * 0.9) / nv - 0.5) * CH
        const cxr = Math.max(0, Math.abs(u) - (CW / 2 - RC)), cyr = Math.max(0, Math.abs(v) - (CH / 2 - RC))
        if (cxr * cxr + cyr * cyr > RC * RC) continue
        const edgeD = Math.min(CW / 2 - Math.abs(u), CH / 2 - Math.abs(v))
        let sh = edgeD < 0.035 ? 1.35 : (edgeD < 0.075 ? 0.18 : 0.55)
        if (edgeD >= 0.075) { const lat = Math.abs(Math.sin((u + v) * 20)) * Math.abs(Math.sin((u - v) * 20)); sh = 0.25 + 0.9 * lat }
        const pnt = rot3([u + off[0], v + off[1], thick], rx, ry, rz), nn = rot3([0, 0, 1], rx, ry, rz)
        put(px + pnt[0], py + pnt[1], pz + pnt[2], pack(nn[0], nn[1], nn[2], 2), 0.93 * sh * tone, 0.9 * sh * tone, 0.82 * sh * tone, 0.55)
      }
    }
    // upright fan (pivot at the bottom centre of each card, standing behind and to the right)
    for (let c = 0; c < 3; c++) {
      const ang = (c - 1) * 0.26
      cardPlate(1.95, TABLE_Y, -1.35 + c * 0.02, -0.1, -0.35, ang, [0, CH / 2], 0.0135, 0.0, 0.85 + 0.08 * c)
    }
    // a deck lying flat: only the top card is drawn full, the rest as a stack of edges
    const deckX = 2.55, deckZ = 0.55, deckY = TABLE_Y
    cardPlate(deckX, deckY + 0.11, deckZ, -Math.PI / 2, 0.35, 0, [0, 0], 0.0125, 0, 1.0)
    for (let c = 0; c < 9; c++) {
      const y0 = deckY + 0.01 + c * 0.0115
      const ang = 0.35 + (rand() - 0.5) * 0.05
      for (let e = 0; e < 4; e++) {
        const len = e % 2 ? CH : CW
        const cnt = Math.floor(len / 0.0125)
        for (let q = 0; q < cnt; q++) {
          const t = (q + rand()) / cnt - 0.5
          const lu = e % 2 ? (e === 1 ? CW / 2 : -CW / 2) : t * CW, lv = e % 2 ? t * CH : (e === 0 ? CH / 2 : -CH / 2)
          const cxr = Math.max(0, Math.abs(lu) - (CW / 2 - RC)), cyr = Math.max(0, Math.abs(lv) - (CH / 2 - RC))
          if (cxr * cxr + cyr * cyr > RC * RC * 1.4) continue
          // card lies in the x-z plane (v maps to z)
          const x1 = lu, z1 = lv
          const x3 = x1 * Math.cos(ang) + z1 * Math.sin(ang), z3 = -x1 * Math.sin(ang) + z1 * Math.cos(ang)
          const nx = e % 2 ? (e === 1 ? 1 : -1) : 0, nz = e % 2 ? 0 : (e === 0 ? 1 : -1)
          put(deckX + x3, y0 + rand() * 0.0115, deckZ + z3, pack(nx * Math.cos(ang) + nz * Math.sin(ang), 0, -nx * Math.sin(ang) + nz * Math.cos(ang), 2), 0.95, 0.93, 0.86, 0.5)
        }
      }
    }
    // ---------------- table: a pool of light with a hole of shadow under the meeple ----------
    const nTable = Math.floor(N * 0.10)
    for (let q = 0; q < nTable; q++) {
      const r = 4.4 * Math.sqrt(rand()), th = rand() * Math.PI * 2
      const x = Math.cos(th) * r, z = Math.sin(th) * r * 0.8 + 0.2
      const pool = Math.exp(-(r * r) / 8.5)
      const shadow = 1 - 0.8 * Math.exp(-((x * x) / 1.4 + ((z + 0.1) * (z + 0.1)) / 0.5))
      const rip = 0.35 + 0.65 * Math.pow(Math.abs(Math.sin(r * 11)), 10)
      put(x, TABLE_Y - 0.004, z, pack(0, 1, 0, 3), 0.95, 0.9, 0.78, 0.5 * pool * shadow * rip)
    }
    // dust motes in the light
    while (k < N) {
      put((rand() - 0.5) * 8, TABLE_Y + rand() * 4.2, (rand() - 0.5) * 5 - 0.5, pack(0, 1, 0, 4), 1, 0.93, 0.8, 0.05 + 0.18 * Math.pow(rand(), 3))
    }
  },
  glsl: /* glsl */ `
vec3 mpl_n(float w, out float mat) {
  float v = floor(w + 0.5);
  mat = mod(v, 8.0); v = floor(v / 8.0);
  float a = mod(v, 64.0); v = floor(v / 64.0);
  float b = mod(v, 64.0); float c = floor(v / 64.0);
  return normalize(vec3(a, b, c) / 63.0 * 2.0 - 1.0);
}
float mpl_ang(float t) { return 0.62 * sin(t * 0.42) + 0.12 * sin(t * 0.9 + 1.0); }
vec3 mpl_rot(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
vec3 anim_meeple(vec3 p, vec4 d, vec4 r, float t) {
  float mat; vec3 n = mpl_n(d.w, mat);
  if (mat < 0.5) { p = mpl_rot(p - vec3(0.0, 0.0, 0.0), mpl_ang(t)); p.y += 0.02 * sin(t * 1.3); }
  else if (mat > 3.5) { p += vec3(sin(t * 0.3 + r.x * 30.0) * 0.12, 0.10 * t * (0.2 + r.y) , cos(t * 0.27 + r.z * 30.0) * 0.12); p.y = -1.5 + mod(p.y + 1.5, 4.2); }
  return p;
}
float size_meeple(vec4 d, vec4 r, float t) { float mat; mpl_n(d.w, mat); return mat > 3.5 ? 0.7 : (mat > 2.5 ? 0.9 : 1.0); }
vec4 color_meeple(vec4 c, vec4 d, vec4 r, float t) {
  float mat; vec3 n = mpl_n(d.w, mat);
  if (mat > 2.5) { if (mat > 3.5) c.a *= 0.6 + 0.4 * sin(t * 1.7 + r.w * 40.0); return c; }
  if (mat < 0.5) n = mpl_rot(n, mpl_ang(t));
  vec3 L1 = normalize(vec3(-0.78, 0.50, 0.38));
  vec3 L2 = normalize(vec3(0.75, 0.25, -0.55));
  float dif = max(dot(n, L1), 0.0);
  float rim = pow(1.0 - max(n.z, 0.0), 2.2) * (0.5 + 0.5 * dot(n, L2));
  vec3 Hv = normalize(L1 + vec3(0.0, 0.0, 1.0));
  float sp = pow(max(dot(n, Hv), 0.0), 36.0);
  vec3 rgb = c.rgb * (0.10 + 1.25 * dif) + vec3(0.62, 0.78, 1.0) * rim * 0.55 + vec3(1.0, 0.95, 0.85) * sp * 0.9;
  return vec4(rgb, c.a);
}`,
  camera: { pos: [2.4, 1.3, 8.4], target: [0.0, -0.1, 0.0], fov: 35 },
  pointSize: 2.5,
  drift: 0.002,
}
export default form
