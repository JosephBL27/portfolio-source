// FORM "campus" — Education, "The Way to Chicago". A particle map of the continental US (silhouette sampled
// from the paper figure public/media/wwii/imbalance-map-lg.webp, kept faint) standing like a leaned-back chart.
// A gold route arcs from the Bay Area (Piedmont High School, Laney College) to Ann Arbor (University of
// Michigan) and hooks back to Chicago (University of Chicago), where a small gothic skyline stands up out of
// the map. A pulse travels the route on a 12 s loop; the stations flash as it passes and the towers rise and
// glow when it arrives. Station positions come from real latitude and longitude run through the same Albers
// equal-area conic the figure uses; labels are read from src/data/site.json (education).
//
// d.w encodes the kind: -1 dust · 0..1 route (w = u along the route) · 2 land fill · 2.5 coast · 3 graticule ·
// 5 tower · 10+u station (u = route parameter where the pulse reaches it).
import type { FormDef } from './types'
import { H } from './ctx'
import site from '../../data/site.json'

const MAP = '/media/wwii/imbalance-map-lg.webp'
const GOLD: [number, number, number] = [0.851, 0.643, 0.255]       // #D9A441
const GOLD_HOT: [number, number, number] = [1.0, 0.86, 0.52]
const IVORY: [number, number, number] = [0.93, 0.9, 0.82]
const SLATE: [number, number, number] = [0.5, 0.6, 0.8]
const f = (n: number) => n.toFixed(5)
const D2R = Math.PI / 180

// ---- geography (lat, lon) -------------------------------------------------------------------------
const GEO = {
  piedmont: [37.8238, -122.2316] as const,
  laney: [37.7956, -122.2655] as const,
  annarbor: [42.2808, -83.7430] as const,
  chicago: [41.7886, -87.5987] as const,                 // Hyde Park, University of Chicago
}
// Albers equal-area conic, CONUS parameters (EPSG:5070): origin 23N 96W, parallels 29.5N and 45.5N
function albers(lat: number, lon: number): [number, number] {
  const p1 = 29.5 * D2R, p2 = 45.5 * D2R, p0 = 23 * D2R, l0 = -96 * D2R
  const n = (Math.sin(p1) + Math.sin(p2)) / 2, C = Math.cos(p1) ** 2 + 2 * n * Math.sin(p1)
  const rho = (ph: number) => Math.sqrt(C - 2 * n * Math.sin(ph)) / n
  const th = n * (lon * D2R - l0)
  return [rho(lat * D2R) * Math.sin(th), rho(p0) - rho(lat * D2R) * Math.cos(th)]
}
// extreme points of the contiguous US (lat, lon) used to register the figure's pixels to the projection. In a conic
// the westmost x is on the California/Oregon coast and the highest y is the 49th parallel's western end (the parallels
// smile), so each extreme is taken over a few candidates rather than one named point.
const WEST = Math.min(...[[48.38, -124.73], [42.84, -124.57], [40.44, -124.41]].map(c => albers(c[0], c[1])[0]))
const EAST = Math.max(...[[44.81, -66.95], [44.9, -66.98]].map(c => albers(c[0], c[1])[0]))
const NORTH = Math.max(...[[49.0, -123.03], [49.0, -122.76], [48.38, -124.73]].map(c => albers(c[0], c[1])[1]))

// ---- layout: map plane (u right, v up, n toward the viewer) leaned back by LEAN -----------------------
const MAP_W = 6.9
const LEAN = 0.26
const W = (u: number, v: number, n: number): [number, number, number] => [u, v * Math.cos(LEAN) + n * Math.sin(LEAN), n * Math.cos(LEAN) - v * Math.sin(LEAN)]
// projected metres -> map-plane units: x centred on the US, y hung from the northern extreme, frame centred on the southern tip
const SOUTH = albers(24.55, -81.8)[1]
const V_TOP = (MAP_W * (NORTH - SOUTH)) / (EAST - WEST) / 2
const mapUV = (X: number, Y: number): [number, number] => [MAP_W * ((X - WEST) / (EAST - WEST) - 0.5), V_TOP - (MAP_W * (NORTH - Y)) / (EAST - WEST)]
const geoUV = (lat: number, lon: number): [number, number] => { const [X, Y] = albers(lat, lon); return mapUV(X, Y) }
const U_P = geoUV(...GEO.piedmont), U_L = geoUV(...GEO.laney), U_A = geoUV(...GEO.annarbor), U_C = geoUV(...GEO.chicago)
const TBASE = W(U_C[0] - 0.3, U_C[1] + 0.04, 0.03)               // foot of the skyline, world frame

const edu = site.education as { school: string }[]
const nameOf = (needle: string, fallback: string) => edu.find(e => e.school.includes(needle))?.school ?? fallback

const form: FormDef = {
  id: 'campus',
  async build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const img = await ctx.image(MAP, N > 100000 ? 900 : 560)
    const { width: w, height: h, data } = img
    const px = w * h
    // ---- silhouette: flood the white exterior from the border, cut the legend corner
    const bg = new Uint8Array(px)
    const white = (i: number) => data[i * 4] >= 249 && data[i * 4 + 1] >= 249 && data[i * 4 + 2] >= 249
    const stack = new Int32Array(px)
    let sp = 0
    const push = (i: number) => { if (!bg[i] && white(i)) { bg[i] = 1; stack[sp++] = i } }
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1) }
    while (sp) {
      const i = stack[--sp], x = i % w, y = (i - x) / w
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
        const j = yy * w + xx
        if (!bg[j] && white(j)) { bg[j] = 1; stack[sp++] = j }
      }
    }
    const lx = Math.floor(w * 0.462), ly = Math.floor(h * 0.795)
    for (let y = ly; y < h; y++) for (let x = 0; x < lx; x++) bg[y * w + x] = 1
    let minX = w, maxX = 0, minY = h, maxY = 0
    const land: number[] = [], edge: number[] = []
    for (let i = 0; i < px; i++) {
      if (bg[i]) continue
      const x = i % w, y = (i - x) / w
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y
      land.push(i)
      const nb = (x > 0 ? bg[i - 1] : 1) | (x < w - 1 ? bg[i + 1] : 1) | (y > 0 ? bg[i - w] : 1) | (y < h - 1 ? bg[i + w] : 1)
      if (nb) edge.push(i)
    }
    // pixel -> projected metres: x from the west/east extremes, y from the northern extreme (isotropic scale)
    const sx = (maxX + 1 - minX) / (EAST - WEST)            // px per projected metre
    const pxUV = (xp: number, yp: number): [number, number] => mapUV(WEST + (xp - minX) / sx, NORTH - (yp - minY) / sx)
    const toUV = pxUV

    let k = 0
    const put = (x: number, y: number, z: number, wv: number, c: number[], a: number) => { if (k < N) H.set(pos, col, k++, x, y, z, wv, c[0], c[1], c[2], a) }
    const gauss = () => { let u = 0; while (u < 1e-6) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * rand()) }
    const putUV = (u: number, v: number, n: number, wv: number, c: number[], a: number) => { const p = W(u, v, n); put(p[0], p[1], p[2], wv, c, a) }

    // ---- land fill (very faint) and coast / border line
    const nLand = Math.floor(N * 0.3), nEdge = Math.floor(N * 0.16)
    for (let q = 0; q < nLand; q++) {
      const i = land[Math.floor(rand() * land.length)]
      const xp = (i % w) + rand(), yp = Math.floor(i / w) + rand()
      const [u, v] = toUV(xp, yp)
      putUV(u, v, (rand() - 0.5) * 0.03, 2, SLATE, 0.11 + 0.12 * rand())
    }
    for (let q = 0; q < nEdge; q++) {
      const i = edge[Math.floor(rand() * edge.length)]
      const xp = (i % w) + rand(), yp = Math.floor(i / w) + rand()
      const [u, v] = toUV(xp, yp)
      putUV(u, v, (rand() - 0.5) * 0.02, 2.5, IVORY, 0.3 + 0.25 * rand())
    }

    // ---- graticule: parallels every 5 degrees, meridians every 10, clipped to the map frame
    const nGrat = Math.floor(N * 0.035)
    const lines: { lat?: number; lon?: number }[] = []
    for (let la = 25; la <= 50; la += 5) lines.push({ lat: la })
    for (let lo = -125; lo <= -65; lo += 10) lines.push({ lon: lo })
    for (let q = 0, guard = 0; q < nGrat && guard < nGrat * 12; guard++) {
      const L = lines[Math.floor(rand() * lines.length)]
      const t = rand()
      const lat = L.lat ?? 22 + t * 30, lon = L.lon ?? -128 + t * 66
      const [u, v] = geoUV(lat, lon)
      if (Math.abs(u) > MAP_W / 2 + 0.4 || v > V_TOP + 0.3 || v < -V_TOP - 0.3) continue
      putUV(u, v, 0, 3, SLATE, 0.16 + 0.1 * rand()); q++
    }

    // ---- route: Bay Area -> Ann Arbor (high arc) -> Chicago (short hook back), gold
    const P = U_P, L = U_L, B: [number, number] = [(P[0] + L[0]) / 2, (P[1] + L[1]) / 2]
    const A = U_A, C = U_C
    const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1])
    const len1 = dist(B, A) * 1.12, len2 = dist(A, C) * 1.4
    const uA = len1 / (len1 + len2)
    // leg 1 bows north (great-circle feel) and lifts toward the viewer; leg 2 is a small arc
    const leg = (a: number[], b: number[], bowV: number, lift: number, t: number): [number, number, number] => {
      const m = Math.sin(Math.PI * t)
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + bowV * m, lift * m]
    }
    const routeAt = (u: number): [number, number, number] =>
      u <= uA ? leg(B, A, 0.55, 0.85, u / uA) : leg(A, C, -0.06, 0.2, (u - uA) / (1 - uA))
    const nRoute = Math.floor(N * 0.12), nGlow = Math.floor(N * 0.04)
    for (let q = 0; q < nRoute; q++) {
      const u = rand(), [a, b, n] = routeAt(u)
      putUV(a + gauss() * 0.009, b + gauss() * 0.009, n + gauss() * 0.009, u, GOLD, 0.5 + 0.4 * rand())
    }
    for (let q = 0; q < nGlow; q++) {
      const u = rand(), [a, b, n] = routeAt(u)
      putUV(a + gauss() * 0.05, b + gauss() * 0.05, n + gauss() * 0.05, u, GOLD, 0.07 + 0.1 * rand())
    }
    // ground shadow of the arc on the map, so the lift reads
    for (let q = 0; q < Math.floor(N * 0.012); q++) {
      const u = rand(), [a, b] = routeAt(u)
      putUV(a + gauss() * 0.012, b + gauss() * 0.012, 0.005, u, GOLD, 0.18)
    }

    // ---- stations: core + two flat rings each; the Bay Area carries two (Piedmont, Laney)
    const stations: { uv: [number, number]; u: number; c: number[]; r: number }[] = [
      { uv: [P[0] + 0.0, P[1] + 0.045], u: 0, c: GOLD_HOT, r: 0.1 },
      { uv: [L[0] + 0.0, L[1] - 0.045], u: 0, c: GOLD_HOT, r: 0.1 },
      { uv: A, u: uA, c: [1.0, 0.82, 0.3], r: 0.12 },
      { uv: C, u: 1, c: GOLD_HOT, r: 0.14 },
    ]
    for (const s of stations) {
      const wv = 10 + s.u
      for (let q = 0; q < Math.floor(N * 0.0025); q++) {
        const rr = 0.045 * Math.pow(rand(), 0.6), th = rand() * Math.PI * 2
        putUV(s.uv[0] + Math.cos(th) * rr, s.uv[1] + Math.sin(th) * rr, 0.03 + gauss() * 0.01, wv, s.c, 0.5 + 0.9 * rand())
      }
      for (let q = 0; q < Math.floor(N * 0.0018); q++) {
        const th = rand() * Math.PI * 2, rr = s.r + gauss() * 0.006
        putUV(s.uv[0] + Math.cos(th) * rr, s.uv[1] + Math.sin(th) * rr, 0.03, wv, s.c, 0.5)
      }
      for (let q = 0; q < Math.floor(N * 0.001); q++) {
        const th = rand() * Math.PI * 2, rr = s.r * 1.9 + gauss() * 0.008
        putUV(s.uv[0] + Math.cos(th) * rr, s.uv[1] + Math.sin(th) * rr, 0.03, wv, s.c, 0.2)
      }
      // a short stem up from the map, so each station reads as a pin
      for (let q = 0; q < Math.floor(N * 0.0007); q++) putUV(s.uv[0] + gauss() * 0.004, s.uv[1] + gauss() * 0.004, 0.03 + rand() * 0.3, wv, s.c, 0.35)
    }

    // ---- gothic skyline at Chicago (world frame, rising along +y from the map surface)
    const base = TBASE
    const nTower = Math.floor(N * 0.1)
    const tw: [number, number, number][] = []                 // sampled tower points
    const tcol = [0.98, 0.84, 0.5]
    const edgePts = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, n: number) => {
      for (let q = 0; q < n; q++) { const t = rand(); tw.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t]) }
    }
    const faceXY = (x0: number, x1: number, y0: number, y1: number, z: number, n: number) => { for (let q = 0; q < n; q++) tw.push([x0 + (x1 - x0) * rand(), y0 + (y1 - y0) * rand(), z]) }
    const faceZY = (z0: number, z1: number, y0: number, y1: number, x: number, n: number) => { for (let q = 0; q < n; q++) tw.push([x, y0 + (y1 - y0) * rand(), z0 + (z1 - z0) * rand()]) }
    const lancet = (cx: number, y0: number, hw: number, hh: number, z: number, n: number) => {    // pointed arch window on a front face
      for (let q = 0; q < n; q++) {
        const t = rand() * 2 - 1, a = Math.abs(t)
        const ys = y0 + hh * 0.55
        const y = a < 0.01 ? y0 + hh : (rand() < 0.5 ? y0 + (ys - y0) * rand() : ys + (y0 + hh - ys) * Math.pow(1 - a, 0.8))
        if (y < ys) tw.push([cx + (rand() < 0.5 ? -hw : hw), y, z]); else tw.push([cx + t * hw, y, z])
      }
    }
    const spire = (cx: number, y0: number, cz: number, hw: number, hh: number, n: number) => {      // square pyramid: edges + faces
      for (let q = 0; q < n; q++) {
        const t = rand(), s = (1 - t) * hw
        if (rand() < 0.55) { const e = Math.floor(rand() * 4); const sx = e % 2 ? 1 : -1, sz = e < 2 ? 1 : -1; tw.push([cx + sx * s, y0 + t * hh, cz + sz * s]) }
        else { const side = Math.floor(rand() * 4), a = (rand() * 2 - 1) * s; if (side === 0) tw.push([cx + a, y0 + t * hh, cz + s]); else if (side === 1) tw.push([cx + a, y0 + t * hh, cz - s]); else if (side === 2) tw.push([cx + s, y0 + t * hh, cz + a]); else tw.push([cx - s, y0 + t * hh, cz + a]) }
      }
    }
    interface Tower { dx: number; hw: number; hh: number; sp: number; win: number; pin: boolean }
    const TOWERS: Tower[] = [
      { dx: 0.0, hw: 0.075, hh: 0.62, sp: 0.2, win: 3, pin: true },
      { dx: 0.13, hw: 0.065, hh: 0.84, sp: 0.3, win: 4, pin: true },
      { dx: 0.25, hw: 0.1, hh: 0.4, sp: 0.1, win: 2, pin: true },
      { dx: 0.375, hw: 0.06, hh: 0.95, sp: 0.34, win: 5, pin: false },
      { dx: 0.48, hw: 0.075, hh: 0.55, sp: 0.18, win: 3, pin: true },
      { dx: 0.585, hw: 0.05, hh: 0.34, sp: 0.14, win: 2, pin: false },
    ]
    const per = Math.floor(nTower / TOWERS.length)
    for (const T of TOWERS) {
      const x = T.dx, hw = T.hw, hh = T.hh, z = 0
      const budget = per
      // shaft: faint faces + bright vertical edges + string courses
      faceXY(x - hw, x + hw, 0, hh, z + hw, Math.floor(budget * 0.12)); faceXY(x - hw, x + hw, 0, hh, z - hw, Math.floor(budget * 0.05))
      faceZY(z - hw, z + hw, 0, hh, x + hw, Math.floor(budget * 0.05)); faceZY(z - hw, z + hw, 0, hh, x - hw, Math.floor(budget * 0.05))
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) edgePts(x + sx * hw, 0, z + sz * hw, x + sx * hw, hh, z + sz * hw, Math.floor(budget * 0.045))
      for (let c = 1; c <= 3; c++) { const y = (hh * c) / 4; edgePts(x - hw, y, z + hw, x + hw, y, z + hw, Math.floor(budget * 0.025)); edgePts(x + hw, y, z - hw, x + hw, y, z + hw, Math.floor(budget * 0.012)) }
      // lancet windows up the front
      for (let wn = 0; wn < T.win; wn++) lancet(x, hh * (0.1 + (0.62 * wn) / Math.max(1, T.win)), hw * 0.42, hh * 0.11, z + hw + 0.002, Math.floor(budget * 0.045))
      // parapet + crenellations
      edgePts(x - hw * 1.1, hh, z + hw * 1.1, x + hw * 1.1, hh, z + hw * 1.1, Math.floor(budget * 0.04))
      for (let m = 0; m < 5; m++) edgePts(x - hw + (m * hw * 2) / 4, hh, z + hw * 1.1, x - hw + (m * hw * 2) / 4, hh + hw * 0.4, z + hw * 1.1, Math.floor(budget * 0.012))
      // spire
      spire(x, hh, z, hw * 0.95, T.sp, Math.floor(budget * 0.2))
      // corner pinnacles
      if (T.pin) for (const sx of [-1, 1]) for (const sz of [-1, 1]) spire(x + sx * hw * 1.05, hh, z + sz * hw * 1.05, hw * 0.2, hw * 1.7, Math.floor(budget * 0.025))
    }
    // tower ground line
    edgePts(-0.1, 0, 0.05, 0.7, 0, 0.05, Math.floor(nTower * 0.05))
    for (let q = 0; q < nTower; q++) {
      const t = tw[Math.min(tw.length - 1, Math.floor((q * tw.length) / nTower))]
      put(base[0] + t[0], base[1] + t[1], base[2] + t[2], 5, tcol, 0.45 + 0.6 * rand())
    }

    // ---- dust behind the map so it floats in space
    while (k < N) {
      put((rand() - 0.5) * 12, (rand() - 0.5) * 6.5, -0.3 - rand() * 3.5, -1, [0.8, 0.84, 0.95], 0.015 + 0.06 * Math.pow(rand(), 2))
    }
  },
  glsl: /* glsl */ `
float cmp_cycle(float t) { return mod(t, 12.0); }
float cmp_head(float t) { return clamp(cmp_cycle(t) / 7.0, 0.0, 1.0); }
float cmp_life(float t) { return 1.0 - smoothstep(10.0, 11.6, cmp_cycle(t)); }
vec3 anim_campus(vec3 p, vec4 d, vec4 r, float t) {
  float w = d.w;
  if (w < -0.5) return p + vec3(sin(t * 0.2 + r.x * 40.0), 0.6 * sin(t * 0.27 + r.y * 40.0), cos(t * 0.17 + r.z * 40.0)) * 0.07;
  if (w > 4.5 && w < 6.0) {                      // gothic skyline: stands a touch lower, then rises as the pulse arrives
    float c = cmp_cycle(t);
    float g = smoothstep(6.5, 8.6, c) * (1.0 - smoothstep(10.0, 11.8, c));
    float by = ${f(TBASE[1])};
    return vec3(p.x, by + (p.y - by) * (0.86 + 0.14 * g), p.z);
  }
  return p;
}
float size_campus(vec4 d, vec4 r, float t) {
  float w = d.w;
  if (w < -0.5) return 0.8;
  if (w >= 10.0) return 1.8;
  if (w > 4.5 && w < 6.0) return 0.95;
  if (w > 2.9 && w < 3.1) return 0.7;
  if (w > 1.9) return 0.8;
  return 1.1;
}
vec4 color_campus(vec4 c, vec4 d, vec4 r, float t) {
  float w = d.w;
  float head = cmp_head(t), life = cmp_life(t);
  if (w < -0.5) return c;
  if (w <= 1.0) {                                // route: unlit ahead of the pulse, bright head, steady glow behind it
    float behind = head - w;
    float lit = behind < 0.0 ? 0.16 : 0.8 + 2.6 * exp(-behind * 14.0);
    c.a *= mix(0.16, lit, life);
    c.rgb = mix(c.rgb, vec3(1.0, 0.93, 0.7), 0.7 * exp(-max(behind, 0.0) * 30.0) * step(0.0, behind));
  } else if (w >= 10.0) {                        // station: flashes as the pulse passes, then keeps a glow
    float u = w - 10.0;
    float behind = head - u;
    float flash = behind >= 0.0 ? exp(-behind * 7.0) : 0.0;
    c.a *= mix(0.45, 0.8 + 1.4 * flash, life);
    c.rgb += vec3(0.25, 0.2, 0.1) * flash;
  } else if (w > 4.5 && w < 6.0) {               // towers: dim until the pulse arrives, then lit with twinkling windows
    float arrive = smoothstep(6.6, 8.2, cmp_cycle(t)) * life;
    float tw = step(0.93, fract(r.x * 37.0 + floor(t * 0.7) * 0.31));
    c.a *= 0.4 + 0.85 * arrive + tw * 1.4 * arrive;
  } else if (w > 2.4 && w < 2.6) {               // coast: a slow shimmer along the outline
    c.a *= 0.8 + 0.4 * sin(t * 0.6 + d.x * 1.6 + d.y * 1.1);
  }
  return c;
}`,
  camera: { pos: [0, 1.2, 10], target: [0, 0.1, 0], fov: 35 },
  pointSize: 2.2,
  drift: 0.004,
  anchors: [
    { id: 'piedmont', label: nameOf('Piedmont', 'Piedmont High School'), pos: W(U_P[0], U_P[1] + 0.16, 0.2) },
    { id: 'laney', label: nameOf('Laney', 'Laney College'), pos: W(U_L[0], U_L[1] - 0.2, 0.2) },
    { id: 'michigan', label: nameOf('Michigan', 'University of Michigan'), pos: W(U_A[0], U_A[1] + 0.3, 0.2) },
    { id: 'chicago', label: nameOf('Chicago', 'University of Chicago'), pos: [TBASE[0] + 0.1, TBASE[1] + 1.55, TBASE[2]] },
  ],
}
export default form
