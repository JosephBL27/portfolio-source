// FORM "cloudflare" — Work, the Cloudflare (NET) pitch. A particle Earth: continents are sampled from a
// public-domain land mask (Natural Earth 110m land, rasterised to public/media/geo/land-110m-1024x512.png,
// source in docs/research/forms-sources.md) and coloured from NASA Blue Marble Next Generation (topography + bathymetry,
// December 2004; public/media/geo/blue-marble-1024.jpg). The night side is lit by NASA Black Marble 2016 city lights
// (public/media/geo/black-marble-2048.jpg), sampled with probability proportional to luminance; the sun is fixed in view
// space, so as the planet turns the lights sweep through a soft terminator. Credits: src/data/credits.json.
// Coast points glow brighter, a graticule and a faint ocean stipple give the sphere its body. About 70 glowing edge nodes sit on major cities and send ripples; arcs of request
// traffic leap between them and bright packets fly along every arc; an inclined ring of packets circles the
// planet. Orange #F48120 accent, slow eastward rotation. The nodes are major cities, not a claim about where
// any company's data centres are; no counts are stated.
//
// pos.w = class + phase. 0 land · 1 graticule · 2 ocean · 3 atmosphere (limb glow) · 4 node core · 5 node halo
// · 6 ripple (phase = angle) · 7 arc line (phase = arc id) · 8 packet (phase = arc id) · 9 orbit ring · 10 stars · 11 night lights
import type { FormDef } from './types'
import { H, seeded } from './ctx'

const TAU = Math.PI * 2, D = Math.PI / 180
const R = 2.05
const ORANGE: [number, number, number] = [0.957, 0.506, 0.125]
const AMBER: [number, number, number] = [1.0, 0.72, 0.28]
const HOT: [number, number, number] = [1.0, 0.9, 0.7]
const LAND: [number, number, number] = [0.62, 0.74, 0.92]
const SEA: [number, number, number] = [0.3, 0.44, 0.72]
const NIGHT_AMBER: [number, number, number] = [1.0, 0.72, 0.38]   // city lights (warm amber)
const NIGHT_HOT: [number, number, number] = [1.0, 0.93, 0.78]
// the sun, fixed in view space (x right, y up, z toward the camera): the right-hand side of the disc is day, the left is night
const SUN = (() => { const v = [0.62, 0.3, 0.62], l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l) })()
const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

// major cities (latitude, longitude): where the glowing nodes sit
const CITIES: [number, number][] = [
  [51.5, -0.1], [48.9, 2.35], [50.1, 8.7], [52.4, 4.9], [40.4, -3.7], [59.3, 18.1], [52.2, 21.0], [41.0, 29.0], [55.75, 37.6], [25.2, 55.3],
  [19.1, 72.9], [28.6, 77.2], [13.1, 80.3], [13.75, 100.5], [1.35, 103.8], [-6.2, 106.8], [22.3, 114.2], [31.2, 121.5], [39.9, 116.4], [25.0, 121.5],
  [37.6, 127.0], [35.7, 139.7], [34.7, 135.5], [14.6, 121.0], [-33.9, 151.2], [-37.8, 145.0], [-31.95, 115.9], [-36.85, 174.8], [-26.2, 28.0], [-33.9, 18.4],
  [-1.3, 36.8], [6.5, 3.4], [30.0, 31.2], [33.6, -7.6], [-23.55, -46.6], [-22.9, -43.2], [-34.6, -58.4], [-33.45, -70.65], [-12.05, -77.0], [4.7, -74.1],
  [19.4, -99.1], [34.05, -118.25], [37.8, -122.4], [47.6, -122.3], [39.7, -105.0], [32.8, -96.8], [41.9, -87.6], [33.75, -84.4], [25.8, -80.2], [40.7, -74.0],
  [43.65, -79.4], [39.0, -77.5], [21.3, -157.85], [61.2, -149.9], [64.1, -21.9], [32.1, 34.8], [24.7, 46.7], [24.9, 67.0], [3.14, 101.7], [21.0, 105.85],
  [10.8, 106.7], [38.7, -9.14], [45.5, 9.2], [48.2, 16.4], [53.35, -6.26], [60.2, 24.9],
]
const ll = (lat: number, lon: number): [number, number, number] => [Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D), Math.cos(lat * D) * Math.cos(lon * D)]
const NODES = CITIES.map(c => ll(c[0], c[1]))
// arcs: a fixed, seeded set of node pairs (shared by the CPU build and the GLSL tables)
const ARCS: [number, number][] = (() => {
  const rnd = seeded(20260210), out: [number, number][] = [], seen = new Set<string>()
  while (out.length < 84) {
    const a = Math.floor(rnd() * NODES.length), b = Math.floor(rnd() * NODES.length)
    if (a === b || seen.has(`${Math.min(a, b)}_${Math.max(a, b)}`)) continue
    const dot = NODES[a][0] * NODES[b][0] + NODES[a][1] * NODES[b][1] + NODES[a][2] * NODES[b][2], om = Math.acos(Math.max(-1, Math.min(1, dot)))
    if (om < 0.4 || om > 2.5) continue
    seen.add(`${Math.min(a, b)}_${Math.max(a, b)}`); out.push([a, b])
  }
  return out
})()
const NA = ARCS.length
const f4 = (v: number) => v.toFixed(4)
const v3s = (v: number[]) => `vec3(${f4(v[0])}, ${f4(v[1])}, ${f4(v[2])})`
const TABLE_A = `const vec3 CF_A[${NA}] = vec3[${NA}](${ARCS.map(a => v3s(NODES[a[0]])).join(', ')});`
const TABLE_B = `const vec3 CF_B[${NA}] = vec3[${NA}](${ARCS.map(a => v3s(NODES[a[1]])).join(', ')});`
const arcPoint = (a: number[], b: number[], s: number): [number, number, number] => {
  const om = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))), so = Math.max(Math.sin(om), 1e-3)
  const k = (1 + (0.05 + 0.4 * om / Math.PI) * Math.sin(Math.PI * s)) * R, w1 = Math.sin((1 - s) * om) / so, w2 = Math.sin(s * om) / so
  return [(a[0] * w1 + b[0] * w2) * k, (a[1] * w1 + b[1] * w2) * k, (a[2] * w1 + b[2] * w2) * k]
}

const form: FormDef = {
  id: 'cloudflare',
  async build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const S = N / 262144, B = Math.pow(1 / S, 0.8)
    const n = (x: number) => Math.max(1, Math.round(x * S))
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, c: number[], a: number) => { if (idx < N) H.set(pos, col, idx++, x, y, z, w, c[0], c[1], c[2], a * B) }
    const sph = (lat: number, lon: number, r = R): [number, number, number] => { const v = ll(lat, lon); return [v[0] * r, v[1] * r, v[2] * r] }

    // ---- land mask ----
    const [img, bm, nl] = await Promise.all([
      ctx.image(`${BASE}media/geo/land-110m-1024x512.png`, 1024),
      ctx.image(`${BASE}media/geo/blue-marble-1024.jpg`, 1024),
      ctx.image(`${BASE}media/geo/black-marble-2048.jpg`, 1024),
    ])
    const W = img.width, Hh = img.height, px = img.data
    // NASA Blue Marble colour at (lat, lon), graded for particles: lifted, a little more saturated (the source is dark and soft)
    const earth = (lat: number, lon: number, lift: number): [number, number, number] => {
      const xx = Math.max(0, Math.min(bm.width - 1, Math.floor((lon + 180) / 360 * bm.width))), yy = Math.max(0, Math.min(bm.height - 1, Math.floor((90 - lat) / 180 * bm.height))), k = (yy * bm.width + xx) * 4
      let r = bm.data[k] / 255, g = bm.data[k + 1] / 255, b = bm.data[k + 2] / 255
      const l = 0.299 * r + 0.587 * g + 0.114 * b, sat = 1.35
      r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat
      return [clamp01(Math.pow(Math.max(0, r), 0.82) * lift), clamp01(Math.pow(Math.max(0, g), 0.82) * lift), clamp01(Math.pow(Math.max(0, b), 0.82) * lift)]
    }
    const isLand = (x: number, y: number) => { const xx = ((Math.floor(x) % W) + W) % W, yy = Math.max(0, Math.min(Hh - 1, Math.floor(y))); return px[(yy * W + xx) * 4] > 127 }

    // 1. land: uniform on the sphere, kept where the mask is land; coastline points glow
    for (let i = 0, m = n(88000), tries = 0; i < m && tries < m * 8; tries++) {
      const lon = rand() * 360 - 180, lat = Math.asin(rand() * 2 - 1) / D, x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * Hh
      if (!isLand(x, y)) continue
      i++
      const coast = !isLand(x + 3, y) || !isLand(x - 3, y) || !isLand(x, y + 3) || !isLand(x, y - 3)
      const p = sph(lat, lon, R * (1 + (rand() - 0.5) * 0.004))
      const e = earth(lat, lon, 1.75), cc: [number, number, number] = coast ? [e[0] * 0.7 + LAND[0] * 0.3, e[1] * 0.7 + LAND[1] * 0.3, e[2] * 0.7 + LAND[2] * 0.3] : e
      put(p[0], p[1], p[2], 0 + rand() * 0.98, cc, coast ? 0.85 : 0.62)
    }
    // 2. ocean stipple gives the sphere a body
    for (let i = 0, m = n(34000), tries = 0; i < m && tries < m * 8; tries++) {
      const lon = rand() * 360 - 180, lat = Math.asin(rand() * 2 - 1) / D
      if (isLand((lon + 180) / 360 * W, (90 - lat) / 180 * Hh)) continue
      const oc = earth(lat, lon, 3.0)
      i++; const p = sph(lat, lon, R * 0.998); put(p[0], p[1], p[2], 2 + rand() * 0.98, [oc[0] * 0.6 + SEA[0] * 0.4, oc[1] * 0.6 + SEA[1] * 0.4, oc[2] * 0.6 + SEA[2] * 0.4], 0.17)
    }
    // 3. graticule every 20 degrees
    for (let la = -80; la <= 80; la += 20) for (let i = 0, m = n(330); i < m; i++) { const p = sph(la, ((i + rand()) / m) * 360 - 180, R * 1.001); put(p[0], p[1], p[2], 1 + rand() * 0.98, SEA, la === 0 ? 0.28 : 0.15) }
    for (let lo = -180; lo < 180; lo += 20) for (let i = 0, m = n(250); i < m; i++) { const p = sph(((i + rand()) / m) * 180 - 90, lo, R * 1.001); put(p[0], p[1], p[2], 1 + rand() * 0.98, SEA, 0.13) }
    // 4. nodes: bright core, soft halo, two phases of ripple rings
    NODES.forEach((v, k) => {
      const c = [v[0] * R, v[1] * R, v[2] * R]
      for (let i = 0, m = n(110); i < m; i++) { const r = 0.02 * Math.sqrt(rand()), th = rand() * TAU, a = [Math.cos(th) * r, Math.sin(th) * r]; const e1 = norm(cross(v, [0, 1, 0])), e2 = cross(v, e1); const q = norm([v[0] + e1[0] * a[0] + e2[0] * a[1], v[1] + e1[1] * a[0] + e2[1] * a[1], v[2] + e1[2] * a[0] + e2[2] * a[1]]); put(q[0] * R * 1.006, q[1] * R * 1.006, q[2] * R * 1.006, 4 + rand() * 0.98, i % 7 ? ORANGE : HOT, 0.8) }
      for (let i = 0, m = n(70); i < m; i++) { const r = 0.03 + 0.16 * Math.pow(rand(), 1.5), th = rand() * TAU, a = [Math.cos(th) * r, Math.sin(th) * r]; const e1 = norm(cross(v, [0, 1, 0])), e2 = cross(v, e1); const q = norm([v[0] + e1[0] * a[0] + e2[0] * a[1], v[1] + e1[1] * a[0] + e2[1] * a[1], v[2] + e1[2] * a[0] + e2[2] * a[1]]); put(q[0] * R * 1.004, q[1] * R * 1.004, q[2] * R * 1.004, 5 + rand() * 0.98, ORANGE, 0.1) }
      for (let i = 0, m = n(130); i < m; i++) put(c[0], c[1], c[2], 6 + rand() * 0.98, ORANGE, 0.7)   // ripple rings (rest = node centre)
    })
    // 5. arcs: faint full line, and bright packets flying along each (positions are computed in GLSL)
    ARCS.forEach(([a, b], id) => {
      const ph = (id / NA) * 0.98
      for (let i = 0, m = n(230); i < m; i++) { const s = (i + rand()) / m, p = arcPoint(NODES[a], NODES[b], s); put(p[0], p[1], p[2], 7 + ph, ORANGE, 0.1 + 0.12 * Math.sin(Math.PI * s)) }
      for (let i = 0, m = n(220); i < m; i++) put(0, 0, 0, 8 + ph, AMBER, 0.7)
    })
    // 6. an inclined ring of packets circling the planet
    {
      const tilt = 62 * D, ct = Math.cos(tilt), st = Math.sin(tilt), RR = R * 1.42
      for (let i = 0, m = n(5200); i < m; i++) { const th = rand() * TAU, x = Math.cos(th) * RR, z = Math.sin(th) * RR; put(x, 0, z, 9 + 0.1, ORANGE, 0.1); void ct; void st }
      const packets = 16
      for (let k = 0; k < packets; k++) for (let i = 0, m = n(110); i < m; i++) { const th = (k / packets) * TAU - rand() * rand() * 0.28, x = Math.cos(th) * RR, z = Math.sin(th) * RR; put(x, 0, z, 9 + 0.9, AMBER, 0.7) }
    }
    // 6b. night lights: particles sampled with probability proportional to NASA Black Marble luminance (weighted by cos(lat), the area of an equirectangular
    // pixel), warm amber. The shader shows them only on the night side of the fixed sun, with a soft terminator.
    {
      const NW = nl.width, NH = nl.height, cdf = new Float64Array(NW * NH + 1), lumOf = new Float32Array(NW * NH)
      for (let y = 0; y < NH; y++) {
        const wlat = Math.cos((90 - (y + 0.5) / NH * 180) * D)
        for (let x = 0; x < NW; x++) {
          const k = (y * NW + x) * 4, l = (nl.data[k] * 0.3 + nl.data[k + 1] * 0.59 + nl.data[k + 2] * 0.11) / 255, i = y * NW + x
          lumOf[i] = l; cdf[i + 1] = cdf[i] + (l < 0.035 ? 0 : l) * wlat      // sensor noise in the dark is cut
        }
      }
      const total = cdf[NW * NH]
      if (total > 0) for (let i = 0, m = n(30000); i < m; i++) {
        const u = rand() * total
        let lo = 0, hi = NW * NH - 1
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid + 1] < u) lo = mid + 1; else hi = mid }
        const px0 = lo % NW, py0 = (lo - px0) / NW, lum = lumOf[lo]
        const lat = 90 - (py0 + rand()) / NH * 180, lon = (px0 + rand()) / NW * 360 - 180
        const p = sph(lat, lon, R * 1.002), hot = Math.min(1, lum * lum * 1.6)
        const cc: [number, number, number] = [NIGHT_AMBER[0] + (NIGHT_HOT[0] - NIGHT_AMBER[0]) * hot, NIGHT_AMBER[1] + (NIGHT_HOT[1] - NIGHT_AMBER[1]) * hot, NIGHT_AMBER[2] + (NIGHT_HOT[2] - NIGHT_AMBER[2]) * hot]
        put(p[0], p[1], p[2], 11 + rand() * 0.98, cc, 0.38 + 0.6 * Math.min(1, lum * 1.7))
      }
    }
    // 7. atmosphere (a limb glow, orange-tinted) and far dust
    for (let i = 0, m = n(22000); i < m; i++) { const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u), r = R * (1.01 + 0.2 * rand() * rand()); put(Math.cos(th) * s * r, u * r, Math.sin(th) * s * r, 3 + rand() * 0.98, [0.96, 0.52, 0.16], 0.1) }
    for (let i = 0, m = n(9000); i < m; i++) { const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u), r = 5.5 + rand() * 3; put(Math.cos(th) * s * r, u * r * 0.7, Math.sin(th) * s * r - 2, 10 + rand() * 0.98, [0.85, 0.88, 1.0], 0.1 + 0.4 * Math.pow(rand(), 3)) }
    H.dust(pos, col, idx, N, rand, 6.5, 0.04 * B, [0.8, 0.7, 0.6])
    for (let i = idx; i < N; i++) pos[i * 4 + 3] = 10.5
  },
  glsl: /* glsl */ `
${TABLE_A}
${TABLE_B}
const float CF_R = ${f4(R)};
const float CF_NA = ${NA}.0;
const float CF_PI = 3.14159265;
const vec3 CF_SUN = vec3(${f4(SUN[0])}, ${f4(SUN[1])}, ${f4(SUN[2])});
vec3 cf_rot(vec3 p, float t) {
  float a = 1.7 + t * 0.06; float c = cos(a), s = sin(a);
  p = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  float ct = cos(0.41), st = sin(0.41);
  return vec3(p.x * ct - p.y * st, p.x * st + p.y * ct, p.z);
}
vec3 cf_arc(int id, float s) {
  vec3 a = CF_A[id], b = CF_B[id];
  float om = acos(clamp(dot(a, b), -1.0, 1.0)); float so = max(sin(om), 0.001);
  vec3 u = (a * sin((1.0 - s) * om) + b * sin(s * om)) / so;
  return u * (1.0 + (0.05 + 0.4 * om / CF_PI) * sin(CF_PI * s)) * CF_R;
}
int cf_id(float ph) { return int(floor(ph / 0.98 * CF_NA + 0.5)); }
float cf_hash(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
float cf_head(int id, float t, float r_y) { return fract(t * (0.07 + 0.09 * cf_hash(float(id) + 0.3)) + cf_hash(float(id) * 1.7) + (r_y > 0.5 ? 0.5 : 0.0)); }
float cf_tail(float r_x) { return r_x * r_x * 0.2; }
vec3 cf_ring(vec3 p, float t) {
  vec3 ax = normalize(vec3(0.15, 0.88, 0.45)); float a = t * 0.22 + 0.0;
  return p * cos(a) + cross(ax, p) * sin(a) + ax * dot(ax, p) * (1.0 - cos(a));
}
vec3 anim_cloudflare(vec3 p, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001), ph = fract(d.w);
  if (cl > 10.5) return cf_rot(p, t);                               // night lights turn with the planet
  if (cl > 9.5) return p;
  if (cl > 8.5) {                                                   // orbit ring (tilted by the axis)
    vec3 ax = normalize(vec3(0.15, 0.88, 0.45));
    vec3 u = normalize(cross(ax, vec3(0.0, 0.0, 1.0))), v = cross(ax, u);
    float ang = atan(p.z, p.x);
    vec3 q = (u * cos(ang) + v * sin(ang)) * length(p.xz);
    return cf_ring(q, t);
  }
  if (cl > 7.5) {                                                   // packets
    int id = cf_id(ph); float tl = cf_tail(r.x); float s = cf_head(id, t, r.y) - tl;
    return cf_rot(cf_arc(id, max(s, 0.0)) * 1.004, t);
  }
  if (cl > 5.5 && cl < 6.5) {                                       // ripple rings expand from each node
    vec3 n = normalize(d.xyz); vec3 e1 = normalize(cross(n, vec3(0.0, 1.0, 0.0))); vec3 e2 = cross(n, e1);
    float rp = fract(t * 0.26 + cf_hash(dot(n, vec3(12.9, 78.2, 37.7))) + (r.x > 0.5 ? 0.5 : 0.0));
    float ang = ph / 0.98 * 6.2831853 * 1.0 + r.y * 6.2831853;
    vec3 q = normalize(n + (e1 * cos(ang) + e2 * sin(ang)) * tan(0.3 * rp));
    return cf_rot(q * CF_R * 1.005, t);
  }
  if (cl > 2.5 && cl < 3.5) return p;                               // atmosphere stays upright
  return cf_rot(p, t);
}
float size_cloudflare(vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl > 10.5) return 1.3;
  if (cl > 3.5 && cl < 4.5) return 1.3;
  if (cl > 7.5 && cl < 8.5) return 1.25;
  if (cl > 8.5 && cl < 9.5) return fract(d.w) > 0.5 ? 1.6 : 0.9;
  if (cl > 9.5) return 0.8;
  return 1.0;
}
vec4 color_cloudflare(vec4 c, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001), ph = fract(d.w);
  float a = c.a; vec3 rgb = c.rgb;
  if (cl > 10.5) {                                                  // night lights: only on the night side, twinkling, dim at the limb
    vec3 nn = normalize(cf_rot(d.xyz + vec3(0.0, 0.0, 1e-4), t));
    float night = 1.0 - smoothstep(-0.14, 0.1, dot(nn, CF_SUN));
    a *= night * (0.82 + 0.18 * sin(t * (1.0 + 3.0 * r.y) + r.x * 60.0)) * (0.1 + 0.9 * smoothstep(-0.3, 0.55, nn.z));
    return vec4(rgb, a);
  }
  if (cl > 9.5) { a *= 0.3 + 0.7 * (0.5 + 0.5 * sin(t * (0.5 + 2.0 * r.y) + r.x * 90.0)); return vec4(rgb, a); }
  if (cl > 8.5) { float h = step(0.5, ph); a *= mix(1.0, 1.0, h); return vec4(rgb, a); }
  vec3 n = normalize(cf_rot(d.xyz + vec3(0.0, 0.0, 1e-4), t));
  float f = n.z;
  if (cl > 7.5) {                                                   // packets: bright head, fading tail, dim on the far side
    int id = cf_id(ph); float tl = cf_tail(r.x); float s = cf_head(id, t, r.y) - tl;
    if (s < 0.0) return vec4(rgb, 0.0);
    vec3 pn = normalize(cf_arc(id, s)); float fz = normalize(cf_rot(pn, t)).z;
    a *= pow(1.0 - tl / 0.2, 1.6) * (0.25 + 0.75 * smoothstep(-0.35, 0.5, fz));
    rgb = mix(rgb, vec3(1.0, 0.95, 0.8), 0.55 * (1.0 - tl / 0.2));
    return vec4(rgb, a);
  }
  if (cl > 6.5) {                                                   // arc lines
    a *= 0.3 + 0.7 * smoothstep(-0.4, 0.6, f); return vec4(rgb, a);
  }
  if (cl > 5.5) {                                                   // ripples: fade as they grow
    float rp = fract(t * 0.26 + cf_hash(dot(normalize(d.xyz), vec3(12.9, 78.2, 37.7))) + (r.x > 0.5 ? 0.5 : 0.0));
    a *= pow(1.0 - rp, 1.5) * smoothstep(0.0, 0.06, rp) * (0.2 + 0.8 * smoothstep(-0.2, 0.4, f)); return vec4(rgb, a);
  }
  if (cl > 4.5) { a *= (0.15 + 0.85 * smoothstep(-0.3, 0.5, f)) * (0.75 + 0.25 * sin(t * 1.2 + d.x * 9.0 + d.y * 7.0)); return vec4(rgb, a); }
  if (cl > 3.5) { float nf = cf_hash(d.x * 7.1 + d.y * 3.3 + d.z * 1.9); a *= (0.1 + 0.9 * smoothstep(-0.35, 0.55, f)) * (0.85 + 0.15 * sin(t * 1.6 + nf * 30.0)); rgb = mix(rgb, vec3(1.0, 0.85, 0.5), 0.45); return vec4(rgb, a); }
  if (cl > 2.5) { vec3 nn = normalize(d.xyz); float rim = 1.0 - abs(nn.z); a *= pow(rim, 2.2) * 2.4; return vec4(rgb, a); }
  // land, ocean and graticule: dim on the far side, edge-lit at the limb, and day or night about the fixed sun
  float lit = 0.14 + 0.86 * smoothstep(-0.25, 0.8, f);
  float limb = 1.0 + 0.7 * pow(1.0 - abs(f), 3.0);
  float sd = dot(n, CF_SUN);
  float day = smoothstep(-0.14, 0.26, sd);
  float twi = exp(-pow(sd / 0.12, 2.0));                            // a warm band along the terminator
  rgb = mix(rgb * 0.42, rgb * 1.1, day);
  rgb = mix(rgb, vec3(1.0, 0.6, 0.3), 0.28 * twi * (cl < 0.5 ? 1.0 : 0.4));
  float floorA = cl < 0.5 ? 0.3 : 0.45;
  float boost = cl < 0.5 ? 1.0 + 0.5 * day : (cl < 1.5 ? 1.0 : 1.0 + 1.4 * day);   // sunlit land and sea read brighter than the night side
  return vec4(rgb, a * lit * limb * mix(floorA, 1.0, day) * boost);
}`,
  camera: { pos: [0, 0.5, 9.4], target: [0, 0.05, 0], fov: 35 },
  pointSize: 1.9,
  drift: 0.004,
}
const cross = (a: number[], b: number[]): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: number[]): [number, number, number] => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
export default form
