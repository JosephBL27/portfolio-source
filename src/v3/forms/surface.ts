// SURFACE: QVR Advisors. An implied-volatility surface over strike x maturity, drawn like a plotted 3D chart.
// The sheet is a real SSVI surface (Gatheral & Jacquier 2014, "Arbitrage-free SVI volatility surfaces"):
//   w(k,theta) = theta/2 * (1 + rho*phi*k + sqrt((phi*k + rho)^2 + 1 - rho^2)),  phi = eta / (theta^g (1+theta)^(1-g)),
//   sigma = sqrt(w/T), theta(T) = sigma_atm(T)^2 * T with an upward ATM term structure, so the smile is steep and skewed
//   (higher vol at low strikes) at 1 week and flattens by 2 years. Same maths as src/ui/labs/qvr-math.ts, which the lab
//   and the node tests share. Illustrative parameters, not QVR data. The parameters breathe slowly (always inside
//   eta(1+|rho|) <= 2, so the surface never breaks the butterfly condition), iso-vol contour lines ride the moving
//   surface, synthetic quote dots shimmer on it, and ripple fronts (ETF rebalancing flows) sweep across maturities.
//   world: x = strike k * SX (low strikes left), z = maturity (short = front, log spaced), y = IV height
// pos.w classes: 1 sheet, 2 strike line (const k), 3 maturity line (const m), 4 floor heat map, 5 static hairline
// (axes, box, walls, ticks), 6 edge curve, 7 quote dot, 8 dust.
// pos.xz of classes 1,2,3,6,7 = (k, m) rest position; y is recomputed from the IV function every frame.
import type { FormDef } from './types'
import { H } from './ctx'
import { DEFAULTS, ssviSigma, tOf } from '../../ui/labs/qvr-math'

const SX = 3.2, SZ = 2.2, Y0 = -1.15
const YS = 3.2, IV0 = 0.12 // height per unit vol, and the vol that sits on the floor
const kReal = (k: number) => -0.05 + 0.45 * k // form coordinate [-1,1] -> log-moneyness [-0.5, 0.4]
const iv0 = (k: number, m: number) => ssviSigma(DEFAULTS, kReal(k), tOf(m))
const yOf = (iv: number) => Y0 + 0.08 + (iv - IV0) * YS
const QK = 13, QM = 8

const form: FormDef = {
  id: 'surface',
  build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const boost = Math.pow(262144 / N, 0.8)
    const VI = H.hex('#B48CFF'), IV = H.hex('#EDE6D6')
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, r: number, g: number, b: number, a: number) => { H.set(pos, col, idx++, x, y, z, w, r, g, b, a) }
    const take = (f: number) => Math.max(1, Math.floor(f * N))
    const kx = (k: number) => k * SX, mz = (m: number) => SZ * (1 - 2 * m)
    const onSurf = (k: number, m: number, w: number, a: number, jx = 0, lift = 0) =>
      put(kx(k) + (rand() - 0.5) * jx, yOf(iv0(k, m)) + lift + (rand() - 0.5) * 0.012, mz(m) + (rand() - 0.5) * jx, w, VI[0], 1, 0, a * boost)

    // ---- sheet: stratified lattice, one jittered particle per cell ----
    const nS = take(0.56)
    const Gv = Math.ceil(Math.sqrt(nS / (SX / SZ))), Gu = Math.ceil(nS / Gv)
    for (let i = 0; i < nS; i++) {
      const iu = i % Gu, jv = Math.floor(i / Gu)
      onSurf(((iu + rand()) / Gu) * 2 - 1, Math.min(1, (jv + rand()) / Gv), 1, 0.5)
    }
    // ---- grid lines along both axes ----
    const nLK = take(0.075), perK = Math.floor(nLK / 13)
    for (let j = 0; j < 13; j++) for (let i = 0; i < perK; i++) onSurf(-1 + j / 6, rand(), 2, 0.20, 0.006, 0.004)
    const nLM = take(0.075), perM = Math.floor(nLM / 11)
    for (let j = 0; j < 11; j++) for (let i = 0; i < perM; i++) onSurf(rand() * 2 - 1, j / 10, 3, 0.20, 0.006, 0.004)
    // ---- floor heat map ----
    const nF = take(0.035), Fv = Math.ceil(Math.sqrt(nF / (SX / SZ))), Fu = Math.ceil(nF / Fv)
    for (let i = 0; i < nF; i++) {
      const iu = i % Fu, jv = Math.floor(i / Fu)
      const k = ((iu + rand()) / Fu) * 2 - 1, m = Math.min(1, (jv + rand()) / Fv)
      put(kx(k), Y0, mz(m), 4, 1, 1, 0, 0.11 * boost)
    }
    // ---- edge curves: front (short maturity) smile, back, left ----
    const nE = take(0.034)
    for (let i = 0; i < nE; i++) {
      const q = rand()
      if (q < 0.55) onSurf(rand() * 2 - 1, 0, 6, 0.38, 0.004, 0.012)
      else if (q < 0.78) onSurf(rand() * 2 - 1, 1, 6, 0.4, 0.004, 0.012)
      else onSurf(-1, rand(), 6, 0.45, 0.004, 0.012)
    }
    // ---- synthetic quote dots: a QK x QM lattice of listed quotes, a small bright cluster each ----
    const nQ = take(0.02), perQ = Math.floor(nQ / (QK * QM))
    for (let a = 0; a < QK; a++) for (let b = 0; b < QM; b++) for (let i = 0; i < perQ; i++)
      onSurf(-0.9 + 0.15 * a, 0.04 + 0.92 * (b / (QM - 1)), 7, 0.55, 0.026, 0.022)
    // ---- hairlines: floor box, posts, ticks, back walls ----
    const nA = take(0.07)
    const line = (a: number[], b: number[], n: number, al: number) => {
      for (let i = 0; i < n; i++) { const u = rand(); put(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, 5, IV[0] * 0.92, IV[1] * 0.9, IV[2] * 1.05, al * boost) }
    }
    const budget = nA, start = idx
    const part = (f: number) => Math.floor(f * budget)
    const TOP = Y0 + 2.7
    // floor rectangle (front edge is the strike axis, right edge the maturity axis)
    line([-SX, Y0, SZ], [SX, Y0, SZ], part(0.12), 0.8); line([SX, Y0, SZ], [SX, Y0, -SZ], part(0.08), 0.8)
    line([SX, Y0, -SZ], [-SX, Y0, -SZ], part(0.06), 0.42); line([-SX, Y0, -SZ], [-SX, Y0, SZ], part(0.06), 0.42)
    // posts: back-left tall (implied vol axis), others short and faint
    line([-SX, Y0, -SZ], [-SX, TOP, -SZ], part(0.1), 0.85)
    line([SX, Y0, -SZ], [SX, Y0 + 1.2, -SZ], part(0.03), 0.3); line([-SX, Y0, SZ], [-SX, Y0 + 1.2, SZ], part(0.03), 0.3)
    // ticks
    for (let j = 0; j <= 12; j++) { const x = -SX + (j / 12) * 2 * SX; line([x, Y0, SZ], [x, Y0, SZ + (j % 2 ? 0.07 : 0.13)], 26, 0.8) }
    for (let j = 0; j <= 10; j++) { const z = SZ - (j / 10) * 2 * SZ; line([SX, Y0, z], [SX + (j % 5 ? 0.07 : 0.13), Y0, z], 26, 0.8) }
    for (let j = 0; j <= 10; j++) { const y = Y0 + j * 0.27; line([-SX, y, -SZ], [-SX - (j % 5 ? 0.07 : 0.13), y, -SZ], 26, 0.8) }
    // back walls: faint gridlines
    for (let j = 1; j <= 9; j++) { const y = Y0 + j * 0.27; line([-SX, y, -SZ], [SX, y, -SZ], part(0.012), 0.14); line([-SX, y, SZ], [-SX, y, -SZ], part(0.008), 0.14) }
    for (let j = 0; j <= 12; j++) { const x = -SX + (j / 12) * 2 * SX; line([x, Y0, -SZ], [x, TOP - 0.1, -SZ], part(0.01), 0.1) }
    for (let j = 1; j <= 5; j++) { const z = SZ - (j / 5) * 2 * SZ; line([-SX, Y0, z], [-SX, TOP - 0.1, z], part(0.008), 0.1) }
    while (idx - start < budget && idx < N) line([-SX, Y0, SZ], [SX, Y0, SZ], 1, 0.8)
    // ---- dust ----
    H.dust(pos, col, idx, N, rand, 6.6, 0.075 * boost, [0.78, 0.7, 0.95])
    for (let i = idx; i < N; i++) pos[i * 4 + 3] = 8
  },
  glsl: /* glsl */ `
const float SF_X = ${SX.toFixed(2)};
const float SF_Z = ${SZ.toFixed(2)};
const float SF_Y0 = ${Y0.toFixed(2)};
const float SF_YS = ${YS.toFixed(2)};
const float SF_IV0 = ${IV0.toFixed(2)};
const float SF_P1 = 7.0;
const float SF_P2 = 11.0;
const float SF_TMIN = 0.0191781;   // one week in years
const float SF_TR = 104.2857;      // 2 years / 1 week
// ripple fronts (ETF rebalancing flows) sweeping across maturities: returns (bump, envelope)
vec2 sf_ripple(float k, float m, float t, float P, float dir, float off) {
  float ph = fract(t / P + off);
  float f = ph * 1.7 - 0.35;
  if (dir < 0.0) f = 1.0 - f;
  float w = m - f;
  float env = exp(-w * w / (2.0 * 0.08 * 0.08)) * (0.65 + 0.35 * cos(k * 1.8 + off * 6.0));
  return vec2(env * cos(w * 32.0), env);
}
// SSVI implied vol at form coordinates (k in [-1,1], m in [0,1] log-maturity), parameters breathing slowly
float sf_ssvi(float ku, float m, float t) {
  float k = -0.05 + 0.45 * ku;
  float T = SF_TMIN * pow(SF_TR, clamp(m, 0.0, 1.0));
  float lvl = 0.17 + 0.012 * sin(t * 0.23) + 0.008 * sin(t * 0.11 + 1.0);
  float slope = 0.35 + 0.06 * sin(t * 0.13 + 2.0);
  float rho = -0.70 + 0.10 * sin(t * 0.17 + 0.6);
  float eta = 0.80 + 0.07 * sin(t * 0.21 + 2.2);
  float sa = lvl * (1.0 + slope * (1.0 - exp(-T / 0.6)));
  float th = sa * sa * T;
  float ph = eta / (sqrt(th) * sqrt(1.0 + th));
  float x = ph * k + rho;
  float w = 0.5 * th * (1.0 + rho * ph * k + sqrt(x * x + 1.0 - rho * rho));
  return sqrt(w / T);
}
float sf_iv(float k, float m, float t, out float hot) {
  float iv = sf_ssvi(k, m, t);
  vec2 r1 = sf_ripple(k, m, t, SF_P1, 1.0, 0.0), r2 = sf_ripple(k, m, t, SF_P2, -1.0, 0.45);
  iv += 0.020 * r1.x + 0.012 * r2.x;
  hot = r1.y + 0.6 * r2.y;
  return iv;
}
float sf_y(float iv) { return SF_Y0 + 0.08 + (iv - SF_IV0) * SF_YS; }
float sf_h(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
// a listed quote: which lattice cell, and how far its mid is jittering right now (in vol)
vec2 sf_quote(float k, float m, float t) {
  vec2 q = vec2(floor((k + 0.9) / 0.15 + 0.5), floor((m - 0.04) / 0.131429 + 0.5));
  float h1 = sf_h(q), h2 = sf_h(q + 7.3);
  float n = sin(t * (0.9 + 0.8 * h1) + h1 * 40.0) * 0.6 + sin(t * 0.37 + h2 * 30.0) * 0.5;
  return vec2(0.006 * (1.0 + 0.9 * abs(k)) * n, 0.5 + 0.5 * sin(t * (1.6 + h2) + h1 * 20.0));
}
vec3 anim_surface(vec3 p, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl > 7.5) return p + 0.05 * vec3(sin(t * 0.13 + r.x * 40.0), sin(t * 0.11 + r.y * 40.0), sin(t * 0.09 + r.z * 40.0));
  if (cl > 3.5 && cl < 5.5) return p;
  float k = p.x / SF_X, m = 0.5 - p.z / (2.0 * SF_Z), hot;
  float iv = sf_iv(k, m, t, hot);
  if (cl > 6.5) {
    vec2 qn = sf_quote(k, m, t);
    return vec3(p.x, sf_y(iv + qn.x) + 0.022, p.z);
  }
  float lift = cl < 1.5 ? (r.y - 0.5) * 0.012 : cl < 3.5 ? 0.004 : 0.014;
  return vec3(p.x, sf_y(iv) + lift + 0.0035 * sin(t * 1.3 + r.x * 60.0), p.z);
}
float size_surface(vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl < 1.5) return 0.95;
  if (cl < 3.5) return 1.1;
  if (cl < 4.5) return 0.85;
  if (cl < 5.5) return 0.9;
  if (cl < 6.5) return 1.25;
  if (cl < 7.5) return 1.25;
  return 1.0;
}
vec3 sf_ramp(float h) {
  vec3 c0 = vec3(0.13, 0.04, 0.33), c1 = vec3(0.52, 0.32, 0.93), c2 = vec3(0.78, 0.65, 1.0), c3 = vec3(0.97, 0.93, 0.85);
  if (h < 0.34) return mix(c0, c1, h / 0.34);
  if (h < 0.68) return mix(c1, c2, (h - 0.34) / 0.34);
  return mix(c2, c3, clamp((h - 0.68) / 0.32, 0.0, 1.0));
}
vec4 color_surface(vec4 c, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl < 0.5 || (cl > 4.5 && cl < 5.5) || cl > 7.5) return c;
  float k = d.x / SF_X, m = 0.5 - d.z / (2.0 * SF_Z), hot;
  float iv = sf_iv(k, m, t, hot);
  if (cl > 6.5) {
    vec2 qn = sf_quote(k, m, t);
    vec3 cream = vec3(0.99, 0.94, 0.82);
    return vec4(cream + vec3(0.6, 0.4, 0.2) * clamp(hot, 0.0, 1.0), c.a * (0.55 + 0.6 * qn.y));
  }
  float h = pow(clamp((iv - SF_IV0) / 0.56, 0.0, 1.2), 0.7);
  vec3 rgb = sf_ramp(h);
  float a = c.a;
  if (cl < 1.5) {
    a *= 0.55 + 0.5 * h;
    // iso-vol contour lines every 2.5 vol points, drawn where the moving surface crosses each level
    float e = 0.03, ex = e / SF_X, ez = e / (2.0 * SF_Z), hh;
    float gx = (sf_iv(k + ex, m, t, hh) - sf_iv(k - ex, m, t, hh)) / (2.0 * e);
    float gz = (sf_iv(k, m - ez, t, hh) - sf_iv(k, m + ez, t, hh)) / (2.0 * e);
    float slope = max(length(vec2(gx, gz)), 0.02);
    a /= 1.0 + 1.1 * slope;   // steep faces seen edge-on stack particles: keep them from blowing out
    float dist = abs(fract(iv / 0.025 + 0.5) - 0.5) * 0.025 / slope;
    float line = smoothstep(0.02, 0.005, dist);
    rgb = mix(rgb, vec3(0.99, 0.95, 0.88), line * 0.85);
    a *= 1.0 + 1.9 * line;
  }
  else if (cl < 3.5) { a *= 0.8 + 0.7 * h; rgb = mix(rgb, vec3(0.97, 0.93, 0.85), 0.25); }
  else if (cl < 4.5) { rgb = sf_ramp(h * 0.85) * 0.9; a *= 0.5 + h; }
  else { rgb = mix(rgb, vec3(0.97, 0.93, 0.85), 0.55); }
  rgb += vec3(0.97, 0.93, 0.85) * 0.55 * clamp(hot, 0.0, 1.0);
  a *= 1.0 + 1.1 * clamp(hot, 0.0, 1.0);
  return vec4(rgb, a);
}`,
  camera: { pos: [2.6, 5.2, 10.8], target: [1.1, -0.15, 0], fov: 35 },
  pointSize: 2.0,
  drift: 0.01,
  anchors: [
    { id: 'strike', label: 'Strike', pos: [0, Y0, SZ + 0.28] },
    { id: 'maturity', label: 'Maturity', pos: [SX + 0.32, Y0, 0] },
    { id: 'iv', label: 'Implied vol', pos: [-SX - 0.1, Y0 + 2.85, -SZ] },
  ],
}
export default form
