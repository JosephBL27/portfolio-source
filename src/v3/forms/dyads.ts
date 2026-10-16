// DYADS: behavioral thrift research (shoppers who arrive in pairs). A thrift store in 3/4 view: four rows of
// clothing racks (rails with hanging garment silhouettes as muted particle strips), back-wall shelving, a
// glowing sign, and 12 pairs of small particle shoppers walking the aisles. Six pairs walk together all the
// time; six split to search separately (opposite ends of the aisle, opposite racks) and later rejoin.
// anim_dyads derives every walker's path from the pair id (pos.w) alone; a faint thread and floor band tie
// each pair, strong when together, gone when apart. It depicts the design, never results.
// pos.w classes: 0 dust, 1 garment, 2 rail/frame (static), 3 floor, 4 shelving + items, 5 sign,
// 10 head, 11 torso, 12 arm L, 13 arm R, 14 leg L, 15 leg R (class + fig/64, fig = 2*pair + who),
// 16 thread (+ pair/32), 17 floor band (+ pair/32). pos.xyz of 10..15 = figure-local (feet at origin, +x forward).
import type { FormDef } from './types'
import { H } from './ctx'

const FL = -1.55, RH = -0.12, ZW = -3.1, XS = 4.0, XR = 3.5
const ROWS = [-2.25, -1.05, 0.15, 1.35]
const LANES = [-1.65, -0.45, 0.75, 2.05]
const PAIRS = 12
const PAL: number[][] = [[0.62, 0.38, 0.40], [0.45, 0.58, 0.48], [0.78, 0.62, 0.30], [0.33, 0.45, 0.62], [0.65, 0.37, 0.26], [0.82, 0.78, 0.68], [0.30, 0.32, 0.38], [0.50, 0.40, 0.58], [0.28, 0.58, 0.56], [0.70, 0.50, 0.44]]

const form: FormDef = {
  id: 'dyads',
  async build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const boost = Math.pow(262144 / N, 0.8)
    const TEAL = H.hex('#7FD1C7'), IV = H.hex('#EDE6D6')
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, c: number[], a: number) => { if (idx < N) H.set(pos, col, idx++, x, y, z, w, c[0], c[1], c[2], a * boost) }
    const take = (f: number) => Math.max(1, Math.floor(f * N))
    const line = (a: number[], b: number[], n: number, c: number[], al: number, w = 2) => {
      for (let i = 0; i < n; i++) { const u = rand(); put(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, w, c, al) }
    }

    // ---- sign: "THRIFT" on the back wall ----
    const sw = 1100, sh = 300
    const img = await ctx.textMask('THRIFT', { font: '800 230px "Bodoni Moda Variable", Didot, Georgia, serif', width: sw, height: sh })
    let x0 = sw, x1 = 0, y0 = sh, y1 = 0
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (img.data[(y * sw + x) * 4 + 3] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    if (x1 <= x0) { x0 = 0; x1 = sw; y0 = 0; y1 = sh }
    const SGN = { x: -1.55, y: 1.42, w: 3.0 }, ssc = SGN.w / (x1 - x0 + 1)
    for (const q of H.sampleMask(img, take(0.045), rand)) put(SGN.x + (q[0] - (x0 + x1) / 2) * ssc, SGN.y - (q[1] - (y0 + y1) / 2) * ssc, ZW + 0.04, 5, [0.55, 0.95, 0.88], 0.8)
    const fw = SGN.w / 2 + 0.22, fh = ((y1 - y0 + 1) * ssc) / 2 + 0.2
    const frame = [[-fw, -fh], [fw, -fh], [fw, fh], [-fw, fh], [-fw, -fh]].map(q => [SGN.x + q[0], SGN.y + q[1], ZW + 0.04])
    for (let k = 0; k < 4; k++) line(frame[k], frame[k + 1], take(0.003), TEAL, 0.6, 5)
    line([SGN.x - fw * 0.7, SGN.y + fh, ZW + 0.04], [SGN.x - fw * 0.7, 2.35, ZW + 0.04], 220, TEAL, 0.3, 5)
    line([SGN.x + fw * 0.7, SGN.y + fh, ZW + 0.04], [SGN.x + fw * 0.7, 2.35, ZW + 0.04], 220, TEAL, 0.3, 5)

    // ---- back wall shelving with folded stacks ----
    const SH = [-1.3, -0.72, -0.14, 0.44]
    for (const y of SH) line([-XS, y, ZW], [XS, y, ZW], take(0.003), IV, 0.4, 4)
    for (let k = 0; k <= 6; k++) line([-XS + k * (2 * XS / 6), FL, ZW], [-XS + k * (2 * XS / 6), 0.95, ZW], take(0.0018), IV, 0.3, 4)
    const nItems = take(0.04)
    for (let i = 0; i < nItems; i++) {
      const s = Math.floor(rand() * 4), bw = 0.22 + 0.2 * ((i % 7) / 7), cx = -XS + 0.2 + ((i * 0.6180339) % 1) * (2 * XS - 0.4), h = 0.1 + 0.16 * (((i * 7) % 5) / 5)
      const c = PAL[(i * 3 + s) % PAL.length]
      put(cx + (rand() - 0.5) * bw, SH[s] + 0.01 + rand() * h, ZW + 0.03 * rand(), 4, c, 0.34)
    }
    // ---- floor outline, lane guides, soft aisle bands ----
    const floorEdges: number[][][] = [[[-XS, FL, ZW], [XS, FL, ZW]], [[XS, FL, ZW], [XS, FL, 2.8]], [[XS, FL, 2.8], [-XS, FL, 2.8]], [[-XS, FL, 2.8], [-XS, FL, ZW]]]
    floorEdges.forEach(e => line(e[0], e[1], take(0.0045), TEAL, 0.6, 3))
    for (const e of [[-XS, ZW], [XS, ZW]]) line([e[0], FL, e[1]], [e[0], 1.1, e[1]], take(0.002), TEAL, 0.35, 3)
    for (const z of LANES) { for (let k = 0; k < 40; k++) { const x = -XR + (k / 39) * 2 * XR; line([x, FL, z], [x + 0.08, FL, z], 14, TEAL, 0.5, 3) } }
    const nFl = take(0.04)
    for (let i = 0; i < nFl; i++) {
      const lane = rand() < 0.7
      const z = lane ? LANES[Math.floor(rand() * 4)] + (rand() * 2 - 1) * 0.42 : ZW + rand() * (2.8 - ZW)
      put((rand() * 2 - 1) * XS, FL, z, 3, TEAL, lane ? 0.055 : 0.025)
    }

    // ---- racks: rail, posts, feet ----
    for (const zr of ROWS) {
      line([-XR, RH, zr], [XR, RH, zr], take(0.0075), [0.8, 0.95, 0.92], 0.65, 2)
      for (const sx of [-XR, XR]) { line([sx, FL, zr], [sx, RH, zr], take(0.0025), [0.7, 0.85, 0.82], 0.5, 2); line([sx, FL, zr - 0.35], [sx, FL, zr + 0.35], take(0.0012), [0.7, 0.85, 0.82], 0.5, 2) }
      line([0, FL, zr], [0, RH, zr], take(0.0012), [0.7, 0.85, 0.82], 0.35, 2)
    }

    // ---- garments ----
    const GH = [0.55, 0.85, 0.75, 0.95, 0.5]
    const hwOf = (ty: number, f: number): number => {
      if (ty === 0) return f < 0.14 ? 0.06 + 0.14 * (f / 0.14) : f < 0.42 ? 0.2 : 0.15
      if (ty === 1) return f < 0.15 ? 0.06 + 0.08 * (f / 0.15) : f < 0.4 ? 0.14 - 0.04 * ((f - 0.15) / 0.25) : 0.1 + 0.11 * ((f - 0.4) / 0.6)
      if (ty === 2) return 0.12 - 0.02 * f
      if (ty === 3) return f < 0.12 ? 0.07 + 0.14 * (f / 0.12) : 0.21 + 0.02 * f
      return 0.09 + 0.11 * f
    }
    const per = 26, nGar = ROWS.length * per
    const garN = Math.max(60, Math.floor(take(0.55) / nGar))
    for (let ri = 0; ri < ROWS.length; ri++) {
      for (let gi = 0; gi < per; gi++) {
        const gx = -XR + 0.1 + (gi + 0.5 * rand()) * ((2 * XR - 0.2) / per), ty = Math.floor(rand() * 5)
        const rot = 1.5 + rand() * 0.55, cr = Math.cos(rot), sr = Math.sin(rot)
        const base = PAL[Math.floor(rand() * PAL.length)], gh = GH[ty] * (0.88 + 0.24 * rand()), stripe = rand() < 0.25, top = RH - 0.045
        const zr = ROWS[ri] + (rand() - 0.5) * 0.06
        for (let k = 0; k < garN; k++) {
          if (rand() < 0.05) { // hanger bar and hook
            const u = (rand() * 2 - 1) * (hwOf(ty, 0.1) + 0.03)
            put(gx + u * sr, top + 0.02 + (rand() - 0.5) * 0.01, zr + u * cr, 1, [0.85, 0.85, 0.8], 0.5); continue
          }
          if (rand() < 0.32) { // silhouette edge: sides and hem make the garment read as clothing
            let f = rand(), u = (rand() < 0.5 ? -1 : 1) * hwOf(ty, f)
            if (rand() < 0.18) { f = 1; u = (rand() * 2 - 1) * hwOf(ty, 1) }
            const eb = 1.2 - 0.2 * f
            put(gx + u * sr, top - f * gh, zr + u * cr, 1, [Math.min(1, base[0] * eb + 0.1), Math.min(1, base[1] * eb + 0.1), Math.min(1, base[2] * eb + 0.1)], 0.85); continue
          }
          let f = 0, u = 0
          for (let tr = 0; tr < 8; tr++) { f = rand(); u = (rand() * 2 - 1) * 0.24; if (Math.abs(u) < hwOf(ty, f) && !(ty === 2 && f > 0.3 && Math.abs(u) < 0.014)) break }
          const sh = 0.8 + 0.3 * rand() - 0.25 * f + (stripe && Math.floor(f * gh / 0.055) % 2 ? 0.28 : 0)
          put(gx + u * sr + (rand() - 0.5) * 0.03, top - f * gh, zr + u * cr, 1, [base[0] * sh, base[1] * sh, base[2] * sh], 0.62)
        }
      }
    }

    // ---- shoppers ----
    const nFig = take(0.1) / (PAIRS * 2)
    const parts: [number, number][] = [[10, 0.14], [11, 0.30], [12, 0.12], [13, 0.12], [14, 0.16], [15, 0.16]]
    for (let fig = 0; fig < PAIRS * 2; fig++) {
      for (const [cl, fr] of parts) {
        const n = Math.floor(nFig * fr), w = cl + fig / 64
        for (let i = 0; i < n; i++) {
          let x = 0, y = 0, z = 0
          if (cl === 10) { let a = 0, b = 0, c = 0; do { a = rand() * 2 - 1; b = rand() * 2 - 1; c = rand() * 2 - 1 } while (a * a + b * b + c * c > 1); x = a * 0.08; y = 1.04 + b * 0.09; z = c * 0.08 }
          else if (cl === 11) { const f = rand(), th = rand() * 6.2832, rr = Math.sqrt(rand()); y = 0.5 + f * 0.44; x = Math.cos(th) * rr * 0.065; z = Math.sin(th) * rr * 0.12 * (0.78 + 0.28 * f) }
          else if (cl <= 13) { const u = rand(), sd = cl === 12 ? -1 : 1; y = 0.93 - u * 0.36; z = sd * 0.145 + (rand() - 0.5) * 0.03; x = (rand() - 0.5) * 0.03 }
          else { const u = rand(), sd = cl === 14 ? -1 : 1; y = 0.52 - u * 0.52; z = sd * 0.058 + (rand() - 0.5) * 0.04; x = (rand() - 0.5) * 0.04 + (u > 0.97 ? 0.025 : 0) }
          put(x, y, z, w, TEAL, 0.6)
        }
      }
    }
    // ---- threads and floor bands tie each pair ----
    const nT = take(0.02) / PAIRS, nB = take(0.018) / PAIRS
    for (let pr = 0; pr < PAIRS; pr++) {
      for (let i = 0; i < nT; i++) put(0, 0, 0, 16 + pr / 32, TEAL, 0.55)
      for (let i = 0; i < nB; i++) put(0, 0, 0, 17 + pr / 32, TEAL, 0.45)
    }
    // ---- dust ----
    H.dust(pos, col, idx, N, rand, 6.6, 0.07 * boost, [0.7, 0.9, 0.86])
    for (let i = idx; i < N; i++) pos[i * 4 + 3] = 0
  },
  glsl: /* glsl */ `
const float DY_FL = ${FL.toFixed(2)};
const float DY_RH = ${RH.toFixed(2)};
float dy_split(float p) { return mod(p + floor(p / 4.0), 2.0); }
float dy_lane(float p) { float l = mod(p, 4.0); return l < 0.5 ? -1.65 : (l < 1.5 ? -0.45 : (l < 2.5 ? 0.75 : 2.05)); }
float dy_s(float pr, float t) {
  float ph = fract(t / 26.0 + pr * 0.173);
  return smoothstep(0.12, 0.32, ph) * (1.0 - smoothstep(0.62, 0.82, ph)) * dy_split(pr);
}
vec2 dy_xz(float pr, float who, float t) {
  float j = floor(pr / 4.0);
  float xc = (j - 1.0) * 2.2 + 0.6 * sin(t * (0.21 + 0.017 * pr) + pr * 1.9);
  float s = dy_s(pr, t);
  float sg = who < 0.5 ? -1.0 : 1.0;
  float x = xc + sg * s * 1.3 + 0.22 * s * sin(t * 0.5 + pr * 3.1 + who * 2.0);
  x = x * pow(1.0 + pow(abs(x) / 3.5, 6.0), -0.16667);
  float z = dy_lane(pr) + sg * (0.17 + 0.10 * s);
  return vec2(x, z);
}
float dy_fig(float w) { return floor(fract(w) * 64.0 + 0.5); }
vec3 anim_dyads(vec3 p, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl < 0.5) return p + 0.04 * vec3(sin(t * 0.13 + r.x * 40.0), sin(t * 0.11 + r.y * 40.0), sin(t * 0.09 + r.z * 40.0));
  if (cl < 1.5) { // garment: pendulum sway of the hem
    float hang = max(0.0, DY_RH - p.y);
    return p + vec3(0.0, 0.0, 0.016 * hang * sin(t * 1.15 + p.x * 6.3 + r.x * 0.8));
  }
  if (cl < 9.5) return p;
  if (cl < 15.5) {
    float fig = dy_fig(d.w);
    float pr = floor(fig * 0.5), who = fig - pr * 2.0;
    vec2 a = dy_xz(pr, who, t - 0.05), b = dy_xz(pr, who, t + 0.05), c = dy_xz(pr, who, t);
    vec2 v = (b - a) / 0.1;
    float sp = length(v);
    float amp = smoothstep(0.015, 0.16, sp);
    float yaw = 3.14159265 * (1.0 - smoothstep(-0.05, 0.05, v.x));
    float ph = t * 5.0 + pr * 1.3 + who * 0.7;
    float sw = 0.55 * amp * sin(ph);
    vec3 q = p;
    float ang = 0.0, py = 0.0;
    if (cl > 13.5) { py = 0.52; ang = (cl < 14.5 ? 1.0 : -1.0) * sw; }
    else if (cl > 11.5) { py = 0.92; ang = (cl < 12.5 ? -1.0 : 1.0) * sw * 0.8; }
    if (py > 0.0) {
      float dy = q.y - py, ca = cos(ang), sa = sin(ang);
      q = vec3(q.x * ca - dy * sa, py + q.x * sa + dy * ca, q.z);
    }
    q.y += 0.02 * amp * abs(sin(ph));
    if (cl > 9.5 && cl < 11.5) q.x += 0.03 * amp * sin(ph * 0.5);
    float cy = cos(yaw), sy = sin(yaw);
    q = vec3(q.x * cy + q.z * sy, q.y, -q.x * sy + q.z * cy);
    return vec3(c.x + q.x, DY_FL + q.y, c.y + q.z);
  }
  float pr = floor(fract(d.w) * 32.0 + 0.5);
  vec2 a = dy_xz(pr, 0.0, t), b = dy_xz(pr, 1.0, t);
  if (cl < 16.5) { // thread at waist height, sagging
    float u = r.y;
    vec2 m = mix(a, b, u);
    return vec3(m.x, DY_FL + 0.62 - 0.07 * sin(u * 3.14159265) + 0.012 * sin(t * 3.0 + u * 30.0 + r.z * 6.0), m.y);
  }
  vec2 mid = 0.5 * (a + b); vec2 dv = b - a; float dist = length(dv);
  vec2 dir = dist > 0.01 ? dv / dist : vec2(1.0, 0.0), perp = vec2(-dir.y, dir.x);
  float th = r.y * 6.2831853;
  float A = 0.5 * dist + 0.4 + 0.02 * sin(t * 1.3 + pr), B = 0.34 + 0.015 * sin(t * 1.7 + pr * 2.0);
  vec2 e = mid + dir * cos(th) * A + perp * sin(th) * B;
  return vec3(e.x, DY_FL + 0.012, e.y);
}
float size_dyads(vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl > 9.5 && cl < 15.5) return 1.55;
  if (cl > 15.5 && cl < 16.5) return 1.0;
  if (cl > 16.5) return 0.9;
  if (cl > 4.5 && cl < 5.5) return 1.3;
  return 1.0;
}
vec4 color_dyads(vec4 c, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl < 0.5) return c;
  if (cl > 9.5 && cl < 15.5) {
    float fig = dy_fig(d.w);
    float who = fig - floor(fig * 0.5) * 2.0;
    vec3 rgb = who < 0.5 ? vec3(1.0, 0.91, 0.76) : vec3(0.42, 0.9, 0.84);
    float k = cl < 10.5 ? 1.3 : (cl < 11.5 ? 1.0 : 0.82);
    return vec4(rgb * k, c.a);
  }
  if (cl > 15.5) {
    float pr = floor(fract(d.w) * 32.0 + 0.5);
    float dist = length(dy_xz(pr, 0.0, t) - dy_xz(pr, 1.0, t));
    float near = 1.0 - smoothstep(0.4, 1.7, dist);
    float a = cl < 16.5 ? c.a * near * (0.6 + 0.4 * sin(t * 3.0 + r.y * 40.0)) : c.a * (0.35 + 0.65 * near);
    return vec4(c.rgb, a);
  }
  if (cl > 4.5 && cl < 5.5) return vec4(c.rgb, c.a * (0.88 + 0.12 * sin(t * 2.0 + r.x * 2.0)) * (1.0 - 0.5 * step(0.985, sin(t * 0.7) * sin(t * 1.9))));
  return c;
}`,
  camera: { pos: [3.9, 4.2, 11.2], target: [1.5, 0.0, -0.3], fov: 35 },
  pointSize: 1.6,
  drift: 0.01,
}
export default form
