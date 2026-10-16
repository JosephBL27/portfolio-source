import type { ReelDef } from './types'
import { FONT_GLSL, T, W } from './font'

// Second Act: a row of apartment blocks at dusk over a wet street. Windows are customers: the cycle
// opens with 39.5 percent of the windows lit (8,218 customers in 2015 against 20,784 in 2024) and
// the rest come on, flashing as they do, slowly. Over the roofs a satin ribbon draws on and rises,
// twisting as it climbs: revenue per customer, $10,520 in 2016 to $38,210 in 2024. At the 17.5
// percent a year the filings give, the value grows by a constant factor, so the ribbon is that
// exponential between the two reported endpoints (the years in between are not data, they are
// the curve). The pick of windows, the sky and the reflections are illustrative.
// GLSL ES 1.00; no loops beyond the font; the city is analytic (five blocks, cell lookup).
const reel: ReelDef = {
  id: 'appfolio',
  projectId: 'appfolio',
  title: 'Second Act',
  medium: 'Apartment windows lighting up under a rising revenue-per-customer ribbon',
  colors: { bg: '#070B1A', ink: '#FFF1D6', accent: '#FFC24B' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;
${FONT_GLSL}
#define PI 3.14159265
#define GROUND -0.40
#define CYC 16.0
#define RX0 -0.56
#define RX1 0.58
#define RY0 0.0
#define RY1 0.35
#define GK 1.2897
const vec3 AMB = vec3(1.0, 0.76, 0.29);
float Tm, FR;

float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float topOf(float bi) { return bi < 0.5 ? -0.16 : (bi < 1.5 ? -0.05 : (bi < 2.5 ? -0.12 : (bi < 3.5 ? -0.02 : -0.14))); }

// the blocks: rgb + coverage at p (the street reflection calls this with the mirrored point)
vec4 city(vec2 p, float px) {
  float bx = (p.x + 0.60) / 0.245;
  float bi = floor(bx);
  float lx = (bx - bi) * 0.245;
  if (bi < 0.0 || bi > 4.0 || lx > 0.22) return vec4(0.0);
  float top = topOf(bi);
  float ry = p.y - GROUND;
  // a penthouse box and a mast
  float pent = step(top, p.y) * step(p.y, top + 0.028) * step(0.07, lx) * step(lx, 0.15) * step(0.5, mod(bi, 2.0) + 0.5 * step(2.5, bi));
  if (p.y > top && pent < 0.5) return vec4(0.0);
  if (p.y < GROUND) return vec4(0.0);
  vec3 wall = mix(vec3(0.030, 0.038, 0.085), vec3(0.060, 0.062, 0.120), smoothstep(0.0, top - GROUND, ry));
  if (pent > 0.5) return vec4(wall * 0.8, 1.0);
  float cx = floor(lx / 0.055), cy = floor(ry / 0.05);
  float fx = fract(lx / 0.055), fy = fract(ry / 0.05);
  float nf = floor((top - GROUND) / 0.05);
  vec2 q = vec2(fx - 0.5, fy - 0.5);
  float key = h21(vec2(bi * 7.0 + cx, cy + bi * 13.0));
  float elig = step(h21(vec2(bi * 5.0 + cx + 3.0, cy * 1.7 + bi)), 0.9);
  float order = key * 0.85 + (bi * 0.245 + cx * 0.055 + 0.6) / 1.2 * 0.15;
  float lit = smoothstep(0.0, 0.03, FR - order) * elig * step(cy, nf - 1.0);
  float flash = exp(-max(FR - order, 0.0) * 55.0) * lit;
  vec2 d = abs(q) - vec2(0.27, 0.27);
  float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 0.04;
  float win = smoothstep(px * 1.4, 0.0, sd) * step(cy, nf - 1.0);
  vec3 wc = AMB * (0.78 + 0.45 * h21(vec2(cx + 9.0, cy + bi * 3.0))) * (1.0 + 1.6 * flash);
  vec3 dark = vec3(0.020, 0.030, 0.070) + vec3(0.03, 0.02, 0.03) * (1.0 - fy);
  vec3 c = wall;
  // light spilling onto the wall around a lit window, plus a thin slab line per floor
  c += AMB * lit * exp(-dot(q, q) * 7.0) * 0.20;
  c *= 1.0 - 0.35 * smoothstep(0.06, 0.0, fy);
  c = mix(c, mix(dark, wc, lit), win);
  // a left-hand rim catches the last light
  c += vec3(0.30, 0.16, 0.20) * smoothstep(0.012, 0.0, lx) * 0.8;
  return vec4(c, 1.0);
}

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float S = min(uRes.y, uRes.x / 1.3);
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uRes) / S;
  float px = 1.0 / S;
  vec2 mo = uMouse - 0.5;
  Tm = mod(uTime, 7200.0) + uSeed * CYC * 3.0;
  float Tc = mod(Tm, CYC);
  float pg = clamp((Tc - 1.2) / 9.5, 0.0, 1.0);
  float ease = pg * pg * (3.0 - 2.0 * pg);
  float out_ = smoothstep(14.0, 15.6, Tc);
  FR = (0.395 * smoothstep(0.0, 1.0, Tc) + 0.605 * ease) * (1.0 - out_);
  float xh = 1.0 - (1.0 - pg) * (1.0 - pg);
  vec2 par = mo * vec2(0.020, 0.012);
  vec2 p = p0 - par * 0.5;

  // dusk sky, a warm band at the roofline and a few stars
  vec3 col = mix(vec3(0.010, 0.016, 0.060), vec3(0.020, 0.030, 0.100), smoothstep(0.5, -0.1, p.y));
  col = mix(col, vec3(0.30, 0.15, 0.17), pow(smoothstep(0.25, -0.40, p.y), 2.2) * (0.85 + 0.15 * sin(p.x * 3.0 + 1.0)));
  col += AMB * 0.05 * exp(-dot(p - vec2(0.15, -0.22), p - vec2(0.15, -0.22)) * 4.0);
  {
    vec2 g = p * 30.0; vec2 id = floor(g), f = fract(g) - 0.5;
    float r = h21(id);
    col += vec3(0.8, 0.85, 1.0) * smoothstep(0.07, 0.0, length(f - (vec2(h21(id + 1.3), h21(id + 4.7)) - 0.5) * 0.6)) * step(0.94, r) * smoothstep(-0.12, 0.35, p.y) * (0.5 + 0.5 * sin(Tm * (0.7 + r) + r * 40.0)) * 0.55;
  }

  // the blocks, and their reflection in the wet street
  vec4 cty = city(p, px);
  col = mix(col, cty.rgb, cty.a);
  if (p.y < GROUND) {
    float dep = GROUND - p.y;
    col = mix(vec3(0.020, 0.024, 0.052), vec3(0.008, 0.010, 0.026), smoothstep(0.0, 0.10, dep));
    vec2 rp = vec2(p.x + 0.0035 * sin(p.y * 90.0 + Tm * 1.7) * (0.4 + dep * 6.0), GROUND + dep);
    vec4 r = city(rp, px * 2.5);
    col = mix(col, r.rgb * 0.62 + vec3(0.03, 0.02, 0.03), r.a * (1.0 - smoothstep(0.0, 0.10, dep)) * 0.9);
    col += AMB * 0.05 * smoothstep(0.02, 0.0, dep);
  }
  // a mast light on the fourth block
  {
    float tb = topOf(3.0);
    vec2 mp = vec2(-0.60 + 3.0 * 0.245 + 0.11, tb + 0.075);
    float mast = smoothstep(px * 1.2, 0.0, abs(p.x - mp.x) - 0.0008) * step(tb, p.y) * step(p.y, mp.y);
    col = mix(col, vec3(0.10, 0.10, 0.16), mast);
    col += vec3(1.0, 0.30, 0.20) * exp(-dot(p - mp, p - mp) / 0.00004) * (0.35 + 0.65 * step(0.0, sin(Tm * 3.0)));
  }

  // the ribbon: revenue per customer, drawn on left to right
  float xn = (p.x - RX0) / (RX1 - RX0);
  float rib = 1.0 - out_;
  vec2 hpos;
  {
    float eh = exp(GK * xh);
    hpos = vec2(RX0 + xh * (RX1 - RX0), RY0 + (RY1 - RY0) * (eh - 1.0) / (exp(GK) - 1.0));
  }
  if (xn > -0.05 && xn < xh + 0.04) {
    float e = exp(GK * xn);
    float yc = RY0 + (RY1 - RY0) * (e - 1.0) / (exp(GK) - 1.0);
    float m = (RY1 - RY0) * GK * e / (exp(GK) - 1.0) / (RX1 - RX0);
    float nrm = sqrt(1.0 + m * m);
    float ph = p.x * 11.0 - Tm * 1.2 * (0.5 + 0.5 * I);
    float cph = cos(ph);
    float taper = smoothstep(-0.02, 0.07, xn) * mix(1.0, 0.18, smoothstep(0.07, 0.0, xh - xn));
    float hw = 0.030 * nrm * max(abs(cph), 0.05) * max(taper, 0.02);
    float dy = p.y - yc;
    float v = dy / hw;
    float cover = clamp((hw - abs(dy)) / (px * 1.3) + 0.5, 0.0, 1.0) * smoothstep(xh, xh - 0.012, xn) * smoothstep(-0.02, 0.0, xn) * rib;
    float shade = 0.40 + 0.60 * abs(cph);
    vec3 face = cph > 0.0 ? vec3(1.0, 0.80, 0.38) : vec3(0.86, 0.46, 0.20);
    float sheen = pow(0.5 + 0.5 * sin(ph * 2.0 + v * 1.6), 5.0);
    vec3 rc = face * shade + vec3(1.0, 0.95, 0.80) * sheen * 0.35 * abs(cph);
    rc = mix(rc, vec3(1.0, 0.95, 0.82), smoothstep(0.80, 1.0, abs(v)) * 0.40);
    rc *= 0.75 + 0.25 * smoothstep(-0.4, 0.5, p.y - yc + 0.1 * v);
    col = mix(col, rc, cover);
    float dist = abs(dy) / nrm;
    col += AMB * exp(-dist * dist / 0.0011) * 0.32 * smoothstep(xh, xh - 0.05, xn) * smoothstep(-0.02, 0.02, xn) * rib;
  }
  // the head of the ribbon
  {
    vec2 d = p - hpos;
    float h = rib * step(0.001, xh);
    col += vec3(1.0, 0.93, 0.75) * exp(-dot(d, d) / 0.00006) * 1.3 * h;
    col += AMB * exp(-dot(d, d) / 0.0016) * 0.45 * h;
  }

  // the timeline: one tick a year, the marker rides the head
  {
    float ty = 0.468;
    float inx = step(RX0 - 0.002, p.x) * step(p.x, RX1 + 0.002);
    col += vec3(0.55, 0.55, 0.75) * smoothstep(px * 1.2, 0.0, abs(p.y - ty) - 0.0004) * inx * 0.35;
    float k = floor((xn * 8.0) + 0.5);
    float tx = RX0 + k / 8.0 * (RX1 - RX0);
    float on = step(k / 8.0, xh + 0.001) * rib;
    float tk = smoothstep(px * 1.5, 0.0, abs(p.x - tx) - 0.0006) * step(abs(p.y - ty), 0.008) * step(0.0, k) * step(k, 8.0);
    col = mix(col, mix(vec3(0.45, 0.45, 0.65), AMB, on), tk);
    col += AMB * exp(-dot(p - vec2(hpos.x, ty), p - vec2(hpos.x, ty)) / 0.00008) * 0.9 * rib * step(0.001, xh);
  }

  // labels
  col *= 1.0 - 0.75 * smoothstep(0.02, 0.0, max(abs(p0.x + 0.52) - 0.12, abs(p0.y + 0.452) - 0.036));
  {
    float u = 0.0026;
    vec3 ink = vec3(1.0, 0.94, 0.82);
    col = mix(col, ink * 0.75, fText((p0 - vec2(-0.62, 0.372)) / u, ${T('REVENUE PER')}, u / px) * 0.9);
    col = mix(col, ink * 0.75, fText((p0 - vec2(-0.62, 0.340)) / u, ${T('CUSTOMER')}, u / px) * 0.9);
    col = mix(col, AMB, fText((p0 - vec2(-0.62, 0.304)) / u, ${T('17.5% CAGR')}, u / px) * 0.95);
    col = mix(col, ink * 0.6, fText((p0 - vec2(RX0 - 0.02, 0.427)) / u, ${T('2016')}, u / px) * 0.9);
    col = mix(col, ink * 0.6 * (0.4 + 0.6 * smoothstep(0.9, 1.0, xh)), fText((p0 - vec2(RX1 - ${(W('2024') * 0.0026).toFixed(4)} + 0.02, 0.427)) / u, ${T('2024')}, u / px) * 0.9);
    col = mix(col, AMB, fText((p0 - vec2(-0.585, 0.058)) / u, ${T('$10,520')}, u / px) * 0.95 * rib * smoothstep(0.0, 0.05, xh));
    float endA = smoothstep(0.93, 1.0, xh) * rib;
    col = mix(col, vec3(1.0, 0.95, 0.80), fText((p0 - vec2(hpos.x - ${(W('$38,210') * 0.0026).toFixed(4)} + 0.02, hpos.y - 0.165)) / u, ${T('$38,210')}, u / px) * endA);
    col = mix(col, ink * 0.65, fText((p0 - vec2(-0.62, -0.428)) / u, ${T('WINDOWS LIT:')}, u / px) * 0.85);
    col = mix(col, AMB, fText((p0 - vec2(-0.62, -0.461)) / u, ${T('CUSTOMERS')}, u / px) * 0.95);
  }

  // grade
  col = col / (1.0 + 0.25 * max(col - 0.9, 0.0));
  float vig = smoothstep(1.3, 0.25, length(p0 * vec2(0.8, 1.1)));
  col *= 0.32 + 0.68 * vig;
  col += (h21(gl_FragCoord.xy + fract(uTime * 9.7) * 191.0) - 0.5) * (0.016 + 0.018 * I);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
}
export default reel
