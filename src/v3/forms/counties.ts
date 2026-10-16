// FORM "counties" — Unequal Mobilization (WWII). A relief map of the continental US built from the
// paper's own county figure (public/media/wwii/imbalance-map-lg.webp): every county pixel block becomes a
// column of particles whose height is the colour intensity of the figure (darker = further from zero).
// Sign survives as a tint only: red side (loss exceeds investment) warms to parchment gold, blue side
// (investment exceeds loss) cools slightly. No claim is made beyond the figure itself.
import type { FormDef } from './types'
import { H } from './ctx'

const MAP = '/media/wwii/imbalance-map-lg.webp'

const form: FormDef = {
  id: 'counties',
  async build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const img = await ctx.image(MAP, N > 100000 ? 700 : 480)
    const { width: w, height: h, data } = img
    const px = w * h
    // ---- classify pixels: background (flood from border + legend corner), water, border line, land
    const bg = new Uint8Array(px) // 1 = background/exterior
    const isWhite = (i: number) => data[i * 4] >= 249 && data[i * 4 + 1] >= 249 && data[i * 4 + 2] >= 249
    const stack = new Int32Array(px)
    let sp = 0
    const push = (i: number) => { if (!bg[i] && isWhite(i)) { bg[i] = 1; stack[sp++] = i } }
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1) }
    const flood = (mark: Uint8Array, val: number) => {
      while (sp) {
        const i = stack[--sp], x = i % w, y = (i - x) / w
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const xx = x + dx, yy = y + dy
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          const j = yy * w + xx
          if (!mark[j] && isWhite(j)) { mark[j] = val; stack[sp++] = j }
        }
      }
    }
    flood(bg, 1)
    // legend (colour bar and its captions) lives in the lower-left corner of the figure
    const lx = Math.floor(w * 0.462), ly = Math.floor(h * 0.795)
    for (let y = ly; y < h; y++) for (let x = 0; x < lx; x++) bg[y * w + x] = 1
    // enclosed white areas of useful size are lakes: label them as water (2)
    const water = new Uint8Array(px)
    const minLake = Math.max(30, Math.floor(px * 0.00022))
    const seen = new Uint8Array(px)
    const comp: number[] = []
    for (let i0 = 0; i0 < px; i0++) {
      if (bg[i0] || seen[i0] || !isWhite(i0)) continue
      comp.length = 0; sp = 0; stack[sp++] = i0; seen[i0] = 1
      while (sp) {
        const i = stack[--sp]; comp.push(i)
        const x = i % w, y = (i - x) / w
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy
          if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          const j = yy * w + xx
          if (!seen[j] && !bg[j] && isWhite(j)) { seen[j] = 1; stack[sp++] = j }
        }
      }
      if (comp.length >= minLake) for (const i of comp) water[i] = 1
    }
    const mPix = new Float32Array(px), sPix = new Int8Array(px), valid = new Uint8Array(px), land = new Uint8Array(px)
    let minX = w, maxX = 0, minY = h, maxY = 0
    for (let i = 0; i < px; i++) {
      if (bg[i] || water[i]) continue
      land[i] = 1
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      const neutral = mx - mn < 16 && luma < 242 // thin grey state lines
      if (!neutral) {
        valid[i] = 1
        mPix[i] = Math.min(1, Math.max(0, (247 - luma) / 205))
        sPix[i] = r >= b ? 1 : -1
      }
      const x = i % w, y = (i - x) / w
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y
    }
    // ---- cell grid (cs px per cell); pick cs so the lattice of cap points fits the budget
    const Q = N > 150000 ? 3 : 2
    let cs = 3, gw = 0, gh = 0, hv = new Float32Array(0), mv = new Float32Array(0), sv = new Float32Array(0), nLand = 0
    const gather = (c: number) => {
      gw = Math.ceil((maxX - minX + 1) / c); gh = Math.ceil((maxY - minY + 1) / c)
      hv = new Float32Array(gw * gh).fill(-1); mv = new Float32Array(gw * gh); sv = new Float32Array(gw * gh)
      nLand = 0
      for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
        let n = 0, nv = 0, sm = 0, ss = 0, area = 0
        for (let y = minY + gy * c; y < Math.min(h, minY + gy * c + c); y++) for (let x = minX + gx * c; x < Math.min(w, minX + gx * c + c); x++) {
          const i = y * w + x; area++
          if (land[i]) { n++; if (valid[i]) { nv++; sm += mPix[i]; ss += sPix[i] * mPix[i] } }
        }
        if (n < area * 0.5) continue
        const m = nv ? sm / nv : 0
        mv[gy * gw + gx] = m; sv[gy * gw + gx] = nv && sm > 1e-4 ? ss / sm : 0
        hv[gy * gw + gx] = 0.03 + HM * Math.pow(m, 1.3)
        nLand++
      }
    }
    const HM = 0.5
    for (cs = 3; cs < 14; cs++) { gather(cs); if (nLand * Q * Q <= N * 0.36) break }
    const scale = 7.3 / (maxX - minX), cx0 = (minX + maxX) / 2, cz0 = (minY + maxY) / 2
    const cellW = cs * scale
    const wx = (gx: number) => (minX + gx * cs + cs / 2 - cx0) * scale
    const wz = (gy: number) => (minY + gy * cs + cs / 2 - cz0) * scale
    const at = (gx: number, gy: number) => (gx < 0 || gy < 0 || gx >= gw || gy >= gh ? 0 : Math.max(0, hv[gy * gw + gx]))
    // wall area (south, west, east, north) between each cell and its lower neighbour
    const DIRS: [number, number, number, number][] = [[0, 1, 1.0, 0], [-1, 0, 0.62, 1], [1, 0, 0.42, 2], [0, -1, 0.0, 3]]
    let wallArea = 0
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const hc = hv[gy * gw + gx]; if (hc < 0) continue
      for (const d of DIRS) { const dh = hc - at(gx + d[0], gy + d[1]); if (dh > 0.004) wallArea += dh * cellW * d[2] }
    }
    const capN = nLand * Q * Q
    const wallN = Math.min(N * 0.30, N * 0.9 - capN)
    const rho = Math.min(wallN / Math.max(1e-6, wallArea), 1 / Math.pow(cellW / Q, 2) * 1.5)
    const ivory = [0.94, 0.91, 0.82], gold = [1.0, 0.86, 0.56], cool = [0.72, 0.83, 1.0]
    let k = 0
    const put = (x: number, y: number, z: number, f: number, r: number, g: number, b: number, a: number) => {
      if (k < N) H.set(pos, col, k++, x, y, z, f, r, g, b, a)
    }
    const shade = [1.0, 0.62, 0.42, 0.2]
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const i = gy * gw + gx, hc = hv[i]; if (hc < 0) continue
      const m = mv[i], sg = sv[i]
      const X = wx(gx), Z = wz(gy)
      const tint = sg >= 0 ? gold : cool
      const tw = Math.min(1, m * 1.7)
      const rr = ivory[0] + (tint[0] - ivory[0]) * tw, gg = ivory[1] + (tint[1] - ivory[1]) * tw, bb = ivory[2] + (tint[2] - ivory[2]) * tw
      const edge = at(gx, gy + 1) === 0 || at(gx - 1, gy) === 0 || at(gx + 1, gy) === 0 || at(gx, gy - 1) === 0
      const wf = 0.1 + 0.9 * m
      // top surface: a regular lattice of bright points, one mosaic tile per cell
      for (let a = 0; a < Q; a++) for (let b = 0; b < Q; b++) {
        put(X + ((a + 0.5) / Q - 0.5) * cellW + (rand() - 0.5) * cellW * 0.10, hc, Z + ((b + 0.5) / Q - 0.5) * cellW + (rand() - 0.5) * cellW * 0.10, wf,
          rr, gg, bb, (0.42 + 1.05 * m * m + 0.4 * m + (edge ? 0.22 : 0)) * 0.8)
      }
      // faces: wherever this cell stands taller than its neighbour, fill the cliff with points
      for (const d of DIRS) {
        const hn = at(gx + d[0], gy + d[1]), dh = hc - hn
        if (dh <= 0.004) continue
        const cnt = Math.floor(dh * cellW * d[2] * rho + rand())
        for (let q = 0; q < cnt; q++) {
          const u = (rand() - 0.5) * cellW, yy = hn + rand() * dh
          const ao = 0.45 + 0.55 * Math.min(1, yy / 0.22)
          const px = d[0] ? X + d[0] * cellW * 0.5 : X + u, pz = d[1] ? Z + d[1] * cellW * 0.5 : Z + u
          put(px, yy, pz, wf, rr, gg, bb, (0.10 + 0.34 * m) * (0.35 + 0.65 * shade[d[3]]) * ao * 1.0)
        }
      }
    }
    // atmospheric haze above the map (w = -1); fills whatever is left so every particle is used
    while (k < N) {
      put((rand() - 0.5) * 9.4, 0.08 + Math.pow(rand(), 1.7) * 2.3, (rand() - 0.5) * 6.2, -1, 0.93, 0.89, 0.8, 0.015 + 0.04 * rand())
    }
  },
  glsl: /* glsl */ `
float cnt_crest(float x, float t) {
  float s = fract(x * 0.17 - t * 0.14);
  float d = (s - 0.12) / 0.10;
  return exp(-d * d);
}
vec3 anim_counties(vec3 p, vec4 d, vec4 r, float t) {
  if (d.w < -0.5) return p + vec3(sin(t * 0.30 + r.x * 40.0), 0.5 * sin(t * 0.40 + r.y * 40.0), cos(t * 0.25 + r.z * 40.0)) * 0.09;
  p.y *= 0.84 + 0.46 * cnt_crest(p.x, t);
  return p;
}
float size_counties(vec4 d, vec4 r, float t) { return d.w < -0.5 ? 1.0 : 0.85; }
vec4 color_counties(vec4 c, vec4 d, vec4 r, float t) {
  float k = cnt_crest(d.x, t);
  if (d.w < -0.5) return c;
  c.rgb = mix(c.rgb, vec3(1.0, 0.9, 0.62), 0.35 * k * d.w);
  c.a *= 1.0 + 0.6 * k * max(d.w, 0.15);
  return c;
}`,
  camera: { pos: [0, 6.6, 6.2], target: [0, 0.1, 0.1], fov: 35 },
  pointSize: 2.3,
  drift: 0.003,
}
export default form
