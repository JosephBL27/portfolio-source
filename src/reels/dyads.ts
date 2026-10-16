import type { ReelDef } from './types'
import { FONT_GLSL, T, W } from './font'

// Together or apart: a thrift store seen from above, with pairs of shoppers walking the aisles.
// This is the pair design from the draft manuscript, drawn as motion: a pair arrives at the door, a
// ring marks the assignment, and then either both members browse side by side on one path (a short
// bright tether) or each takes a different path through the aisles (a long dashed thread) until they
// meet again at the exit. Racks light up as people pass. Seven pairs run staggered 24-second laps,
// alternating condition. It is a simulation of the design only: no purchases, rates or results are shown.
// Per pixel: 14 shoppers x 7 path segments, analytic trails (no feedback buffer), no textures.
const f1 = (n: number) => n.toFixed(1)
const reel: ReelDef = {
  id: 'dyads',
  projectId: 'thrift',
  title: 'Together or apart',
  medium: 'A simulated pair design: shoppers browse the aisles together or apart and meet at the exit',
  colors: { bg: '#07080B', ink: '#EEE7D6', accent: '#F4B04F' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;
${FONT_GLSL}
#define PI 3.14159265
#define TAU 6.2831853
#define AS 0.145      // aisle spacing
#define YB -0.300     // bottom cross aisle
#define YT 0.300      // top cross aisle
#define YD -0.345     // door
#define CYC 24.0

float h1(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 wpt(float k, float xa, float xb) {
  if (k < 0.5) return vec2(0.0, YD);
  if (k < 1.5) return vec2(0.0, YB);
  if (k < 2.5) return vec2(xa, YB);
  if (k < 3.5) return vec2(xa, YT);
  if (k < 4.5) return vec2(xb, YT);
  if (k < 5.5) return vec2(xb, YB);
  if (k < 6.5) return vec2(0.0, YB);
  return vec2(0.0, YD);
}
float segD(vec2 p, vec2 a, vec2 b, out float t) {
  vec2 pa = p - a, ba = b - a;
  t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * t);
}
float pathLen(float xa, float xb) { return (YB - YD) * 2.0 + abs(xa) + (YT - YB) * 2.0 + abs(xb - xa) + abs(xb); }
// one shopper: position at progress s, plus the comet trail intensity at pixel p
float shopper(vec2 p, float s, float xa, float xb, float px, out vec2 head) {
  float D = s * pathLen(xa, xb);
  float cum = 0.0, tr = 0.0;
  head = vec2(0.0, YD);
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    vec2 a = wpt(fk, xa, xb), b = wpt(fk + 1.0, xa, xb);
    vec2 ab = b - a;
    float len = max(length(ab), 1e-4);
    float t;
    float d = segD(p, a, b, t);
    float age = D - (cum + t * len);
    if (age > 0.0 && age < 0.42) {
      float line = smoothstep(px * 1.4, 0.0, d - 0.0011) + exp(-d / 0.0045) * 0.22;
      tr += line * exp(-age * 8.0);
    }
    if (D >= cum && D < cum + len) head = a + ab / len * (D - cum);
    cum += len;
  }
  return tr;
}
vec3 ribHue(float h) {
  if (h < 0.2) return vec3(0.85, 0.58, 0.26);
  if (h < 0.4) return vec3(0.22, 0.60, 0.60);
  if (h < 0.6) return vec3(0.76, 0.32, 0.42);
  if (h < 0.8) return vec3(0.42, 0.48, 0.70);
  return vec3(0.50, 0.66, 0.40);
}

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float asp = uRes.x / uRes.y;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float S = min(1.0, asp / 1.5);
  vec2 mo = uMouse - 0.5;
  vec2 w = p / S - vec2(0.012 * mo.x * I, 0.008 * mo.y * I) + vec2(0.0, 0.02);
  float px = 1.0 / (uRes.y * S);
  vec3 GOLD = vec3(1.0, 0.70, 0.26), CYAN = vec3(0.30, 0.78, 1.0);

  // ---------------- pairs ----------------
  vec3 acc = vec3(0.0);   // additive light from shoppers
  vec3 near = vec3(0.0);  // light the racks receive
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float tt = uTime + fi * (CYC / 7.0) + 2.9 * h1(fi * 5.1 + 0.3);
    float n = floor(tt / CYC);
    float sw = (tt / CYC - n) / 0.9;
    if (sw >= 1.0) continue;
    float hk = fi * 13.7 + n * 5.31 + 1.7;
    float apart = mod(fi + n, 2.0);
    float a1 = floor(h1(hk) * 7.0);
    float b1 = mod(a1 + 2.0 + floor(h1(hk + 3.3) * 4.0), 7.0);
    float a2 = apart > 0.5 ? mod(a1 + 2.0 + floor(h1(hk + 7.7) * 3.0), 7.0) : a1;
    float b2 = apart > 0.5 ? mod(b1 + 2.0 + floor(h1(hk + 9.1) * 3.0), 7.0) : b1;
    float xa1 = (a1 - 3.0) * AS, xb1 = (b1 - 3.0) * AS, xa2 = (a2 - 3.0) * AS, xb2 = (b2 - 3.0) * AS;
    float env = smoothstep(0.0, 0.025, sw) * (1.0 - smoothstep(0.985, 1.0, sw));
    float reveal = smoothstep(0.03, 0.09, sw);
    vec3 tint = mix(vec3(1.0, 0.97, 0.90), apart > 0.5 ? CYAN : GOLD, reveal);
    float ph2 = apart > 0.5 ? 1.7 : 0.0;
    float sA = clamp(sw + 0.008 * sin(sw * 70.0 + fi * 2.0), 0.0, 1.0);
    float sB = clamp(sw + 0.008 * sin(sw * 70.0 + fi * 2.0 + ph2), 0.0, 1.0);
    vec2 oA = apart > 0.5 ? vec2(0.0) : vec2(0.011, 0.007);
    vec2 oB = apart > 0.5 ? vec2(0.0) : vec2(-0.011, -0.007);
    vec2 hA, hB;
    float tA = shopper(w - oA, sA, xa1, xb1, px, hA);
    float tB = shopper(w - oB, sB, xa2, xb2, px, hB);
    hA += oA; hB += oB;
    float dA = length(w - hA), dB = length(w - hB);
    float trailK = apart > 0.5 ? 0.75 : 1.0;
    acc += tint * (tA + tB) * 0.55 * trailK * env;
    // heads
    float coreA = smoothstep(0.0068, 0.0040, dA), coreB = smoothstep(0.0068, 0.0040, dB);
    acc += (mix(tint, vec3(1.0), 0.65) * (coreA + coreB) + tint * (exp(-dA / 0.011) + exp(-dB / 0.011)) * 0.40 + tint * (exp(-dA / 0.04) + exp(-dB / 0.04)) * 0.07) * env;
    near += tint * (exp(-dA * dA / 0.0030) + exp(-dB * dB / 0.0030)) * env;
    // tether between the two members
    float tt2;
    float dl = segD(w, hA, hB, tt2);
    float sep = length(hA - hB);
    if (apart > 0.5) {
      float dash = step(0.5, fract(tt2 * sep * 38.0 - uTime * 1.5));
      acc += CYAN * smoothstep(px * 1.2, 0.0, dl - 0.0007) * dash * 0.30 * exp(-sep * 1.2) * env;
    } else {
      acc += tint * (smoothstep(px * 1.4, 0.0, dl - 0.0016) * 0.95 + exp(-dl / 0.006) * 0.30) * env;
      vec2 mid = 0.5 * (hA + hB);
      acc += GOLD * exp(-dot(w - mid, w - mid) / 0.0016) * 0.12 * env;
    }
    // assignment ring at the door; reunion ring at the exit
    float dd = length(w - vec2(0.0, YD));
    float rg = clamp(sw / 0.14, 0.0, 1.0);
    acc += tint * exp(-abs(dd - (0.012 + rg * 0.10)) / 0.0035) * (1.0 - rg) * (1.0 - rg) * 0.9 * step(sw, 0.14);
    float rx = clamp((sw - 0.955) / 0.045, 0.0, 1.0);
    acc += tint * exp(-abs(dd - (0.012 + rx * 0.09)) / 0.0035) * (1.0 - rx) * 0.6 * step(0.955, sw) * apart;
  }

  // ---------------- the store ----------------
  vec3 col = vec3(0.016, 0.017, 0.022);
  col += vec3(0.020, 0.022, 0.030) * smoothstep(1.2, 0.1, length(w * vec2(0.9, 1.3)));
  vec2 sb = abs(w) - vec2(0.62, 0.37);
  float inStore = step(max(sb.x, sb.y), 0.0);
  // floor tiles
  vec2 ft = abs(fract(w / 0.058 + 0.5) - 0.5) * 0.058;
  col += vec3(0.5, 0.58, 0.78) * smoothstep(px * 1.2, 0.0, min(ft.x, ft.y) - 0.0002) * 0.030 * inStore;
  // racks: ribbed rectangles between the aisles
  {
    float gx = w.x / AS;
    float m = floor(gx);
    float fx = gx - m - 0.5;
    float rackX = step(abs(fx), 0.225) * step(-4.5, m) * step(m, 3.5);
    float rackY = step(abs(w.y), 0.255);
    float inR = rackX * rackY;
    float ci = floor(w.y / 0.0068);
    float fy = fract(w.y / 0.0068);
    float rib = smoothstep(0.08, 0.24, fy) * smoothstep(0.92, 0.76, fy);
    float hh = h21(vec2(ci * 0.37 + 2.0, m * 3.1 + 5.0));
    vec3 hue = ribHue(hh);
    float pulse = 0.65 + 0.35 * sin(uTime * 3.0 + hh * 40.0);
    vec3 rc = hue * rib * (0.075 + 0.075 * h21(vec2(ci, m)) ) + hue * rib * near * 0.9 * pulse;
    col += rc * inR;
    // rack outline
    vec2 rd = abs(vec2(fx * AS, w.y)) - vec2(0.225 * AS, 0.255);
    float ro = abs(length(max(rd, 0.0)) + min(max(rd.x, rd.y), 0.0));
    col += vec3(0.55, 0.62, 0.8) * smoothstep(px * 1.3, 0.0, ro - 0.0004) * 0.10 * rackX * step(abs(w.y), 0.262);
  }
  // walls with a door gap, door ticks
  {
    float wd = abs(max(sb.x, sb.y));
    float gap = step(abs(w.x), 0.050) * step(w.y, -0.30);
    col += vec3(0.62, 0.68, 0.84) * smoothstep(px * 1.4, 0.0, wd - 0.0016) * 0.30 * (1.0 - gap);
    float tick = smoothstep(px * 1.3, 0.0, abs(abs(w.x) - 0.050) - 0.0012) * step(abs(w.y + 0.372), 0.012);
    col += vec3(0.95, 0.85, 0.62) * tick * 0.45;
    // corridor guide dots
    col += vec3(0.5, 0.6, 0.8) * smoothstep(px * 1.2, 0.0, abs(w.y - YB) - 0.0002) * 0.03 * inStore * step(abs(w.x), 0.5);
    col += vec3(0.5, 0.6, 0.8) * smoothstep(px * 1.2, 0.0, abs(w.y - YT) - 0.0002) * 0.03 * inStore * step(abs(w.x), 0.5);
  }
  col += near * 0.018 * inStore;
  col += acc;

  // ---------------- labels ----------------
  vec3 inkC = vec3(0.93, 0.89, 0.78);
  {
    float ut = 0.0026;
    col += inkC * fText((w - vec2(-${f1(W('ENTRY/EXIT') * 0.5)} * ut, -0.408)) / ut, ${T('ENTRY/EXIT')}, ut / px) * 0.55;
    float u0 = 0.0030;
    vec2 o1 = vec2(-0.5 * asp / S + 0.05, 0.5 / S - 0.07);
    col += inkC * fText((w - o1) / u0, ${T('PAIR DESIGN')}, u0 / px) * 0.62;
    col += inkC * fText((w - o1 + vec2(0.0, 0.025)) / u0, ${T('SIMULATED')}, u0 / px) * 0.32;
    // legend: two little pairs
    float ul = 0.0024;
    vec2 L0 = vec2(-0.60, -0.452);
    vec2 g1 = L0, g2 = L0 + vec2(0.30, 0.0);
    float gA = length(w - g1 - vec2(-0.012, 0.0)), gB = length(w - g1 - vec2(0.012, 0.0));
    col += GOLD * (smoothstep(0.0055, 0.0035, gA) + smoothstep(0.0055, 0.0035, gB) + smoothstep(px * 1.3, 0.0, abs(w.y - g1.y) - 0.0011) * step(abs(w.x - g1.x), 0.012) * 0.9);
    float cA = length(w - g2 - vec2(-0.020, 0.0)), cB = length(w - g2 - vec2(0.020, 0.0));
    float cd = step(0.5, fract((w.x - g2.x) / 0.0105));
    col += CYAN * (smoothstep(0.0055, 0.0035, cA) + smoothstep(0.0055, 0.0035, cB) + smoothstep(px * 1.3, 0.0, abs(w.y - g2.y) - 0.0009) * step(abs(w.x - g2.x), 0.020) * cd * 0.6);
    col += GOLD * fText((w - g1 - vec2(0.028, -0.0085)) / ul, ${T('TOGETHER')}, ul / px) * 0.75;
    col += CYAN * fText((w - g2 - vec2(0.038, -0.0085)) / ul, ${T('APART')}, ul / px) * 0.75;
  }

  col = 1.0 - exp(-col * 1.6);
  float vig = smoothstep(1.3, 0.3, length(p * vec2(0.85, 1.15)));
  col *= mix(0.40, 1.0, vig);
  col += (h21(gl_FragCoord.xy + fract(uTime * 3.7) * 91.0) - 0.5) * mix(0.010, 0.026, I);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`,
}
export default reel
