import type { ReelDef } from './types'

// A Living Chronology: an astrolabe of four turning rings over a dark bronze plate.
// Outer ring: 185 fine ticks (one per episode). Second: a Greek-key meander band.
// Third: 24 seal-like glyph cells (one per book), stepping like an escapement.
// Fourth: a forty-mark day count, stepping the other way. A rete turns in the hub and an
// alidade sweeps over everything, warming what it passes. Engraving is embossed against a
// fixed light, so tick walls glint as they cross the anisotropic highlight. Layers sit at
// different depths for parallax with uMouse. No loops except two small fixed ones (glints).
const reel: ReelDef = {
  id: 'rings',
  projectId: 'metamorphoses',
  title: 'A Living Chronology',
  medium: 'Four turning rings, after the reading instrument’s compass',
  colors: { bg: '#080706', ink: '#F1E3C4', accent: '#D9A852' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;

#define TAU 6.2831853
#define PI 3.14159265

float px;
vec2 LDIR;

float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}
// escapement: move over the first 35% of the beat with a damped overshoot, then hold
float beat(float x) {
  float k = clamp(x / 0.35, 0.0, 1.0);
  return 1.0 - exp(-6.0 * k) * cos(9.0 * k);
}
float band(float r, float a, float b) { return smoothstep(a - px, a + px, r) * smoothstep(b + px, b - px, r); }
float groove(float r, float c, float w) { return 1.0 - smoothstep(w, w + 1.5 * px, abs(r - c)); }

// ---- engraving masks, in each ring's local frame ----
float maskA(vec2 lp, float rot) {
  float r = length(lp);
  float a = atan(lp.y, lp.x) - rot;
  float x = a / TAU * 185.0;
  float k = floor(x + 0.5);
  float dx = abs(x - k) * TAU * r / 185.0;
  float major = step(mod(k, 5.0), 0.5);
  float r0 = mix(0.4415, 0.432, major);
  float tw = mix(0.0009, 0.0014, major);
  float tick = (1.0 - smoothstep(tw, tw + 1.3 * px, dx)) * band(r, r0, 0.4575);
  float ch = groove(r, 0.4225, 0.0014) + groove(r, 0.4075, 0.0009);
  // a dot on every fifth tick between the channels
  float dotA = 1.0 - smoothstep(0.0021, 0.0021 + 1.3 * px, length(vec2(dx, r - 0.415)));
  return clamp(max(tick, ch) + dotA * major, 0.0, 1.0);
}
float keyBit(float c, float rw) {
  float m = 62.0;
  if (rw < 0.5) m = 63.0; else if (rw < 1.5) m = 2.0; else if (rw < 2.5) m = 58.0; else if (rw < 3.5) m = 42.0; else if (rw < 4.5) m = 34.0;
  return mod(floor(m / exp2(c)), 2.0);
}
float keyAt(vec2 c) {
  if (c.y < -0.5 || c.y > 5.5) return 0.0;
  return keyBit(mod(c.x, 6.0), c.y);
}
float maskB(vec2 lp, float rot) {
  float r = length(lp);
  float a = atan(lp.y, lp.x) - rot;
  float U = 0.0072;
  vec2 g = vec2(a / TAU * 300.0, (r - 0.3295) / U) - 0.5;
  vec2 c0 = floor(g);
  vec2 f = fract(g);
  float cp = U / px;
  vec2 w = clamp((f - 0.5) * cp + 0.5, 0.0, 1.0);
  float k = mix(mix(keyAt(c0), keyAt(c0 + vec2(1.0, 0.0)), w.x),
                mix(keyAt(c0 + vec2(0.0, 1.0)), keyAt(c0 + vec2(1.0, 1.0)), w.x), w.y);
  k = mix(0.42 * band(r, 0.3295, 0.3295 + 6.0 * U), k, smoothstep(1.6, 3.0, cp));
  float borders = groove(r, 0.3235, 0.0011) + groove(r, 0.3785, 0.0011);
  return clamp(k + borders, 0.0, 1.0);
}
float glyphBits(float k, float col) {
  // seal-like 3x5 glyphs: mirrored columns, so every glyph is symmetric
  float bits = floor(h21(vec2(k, col * 3.7 + 1.9)) * 32.0);
  if (col > 0.5) bits = max(bits, 4.0 + 17.0 * step(0.5, h21(vec2(k, 8.0))));
  return bits;
}
float maskC(vec2 lp, float rot, out float cellK) {
  float r = length(lp);
  float a = atan(lp.y, lp.x) - rot;
  float x = a / TAU * 24.0;
  float k = floor(x);
  cellK = mod(k, 24.0);
  float la = (fract(x) - 0.5) * TAU / 24.0 * r;       // arc offset from cell centre
  float div = 1.0 - smoothstep(0.0011, 0.0011 + 1.3 * px, abs(abs(la) - TAU / 48.0 * r));
  div *= band(r, 0.232, 0.292);
  float G = 0.0088;
  vec2 gp = vec2(la / G + 1.5, (r - 0.262) / G + 2.5);
  vec2 gi = floor(gp);
  vec2 gf = fract(gp) - 0.5;
  float pix = 0.0;
  if (gi.x >= 0.0 && gi.x <= 2.0 && gi.y >= 0.0 && gi.y <= 4.0) {
    float colI = gi.x > 1.5 ? 0.0 : gi.x;
    float bits = glyphBits(cellK, colI);
    float on = mod(floor(bits / exp2(gi.y)), 2.0);
    float sq = max(abs(gf.x), abs(gf.y));
    pix = on * (1.0 - smoothstep(0.36, 0.36 + 1.3 * px / G, sq));
  }
  // seal frame: rounded square around each glyph
  vec2 fq = abs(vec2(la, r - 0.262)) - vec2(0.0205, 0.0285);
  float fd = length(max(fq, 0.0)) + min(max(fq.x, fq.y), 0.0) - 0.004;
  float frameG = 1.0 - smoothstep(0.0009, 0.0009 + 1.3 * px, abs(fd));
  float rims = groove(r, 0.2265, 0.0011) + groove(r, 0.2975, 0.0011);
  return clamp(max(max(pix, frameG), max(div, rims)), 0.0, 1.0);
}
float maskD(vec2 lp, float rot) {
  float r = length(lp);
  float a = atan(lp.y, lp.x) - rot;
  float x = a / TAU * 40.0;
  float k = floor(x + 0.5);
  float dx = (x - k) * TAU * r / 40.0;
  float big = step(mod(k, 10.0), 0.5);
  vec2 q = vec2(dx, r - 0.1735);
  float dm = (abs(q.x) + abs(q.y)) - mix(0.0042, 0.0075, big);   // diamonds
  float mk = 1.0 - smoothstep(0.0, 1.3 * px, dm);
  float rims = groove(r, 0.1525, 0.001) + groove(r, 0.1945, 0.001);
  return clamp(mk + rims, 0.0, 1.0);
}
float maskHub(vec2 lp, float rot) {
  float r = length(lp);
  float a = atan(lp.y, lp.x) - rot;
  // eight-pointed rete star (straight-edged polygon), outline only, plus its inner octagon
  float seg = TAU / 16.0;
  float sa = mod(a, 2.0 * seg) - seg;                    // fold into one point
  vec2 q = r * vec2(cos(sa), abs(sin(sa)));
  vec2 tip = vec2(0.112, 0.0), notch = vec2(0.046 * cos(seg), 0.046 * sin(seg));
  vec2 e = notch - tip;
  float sd = length(q - tip - e * clamp(dot(q - tip, e) / dot(e, e), 0.0, 1.0));
  float sl = 1.0 - smoothstep(0.0011, 0.0011 + 1.4 * px, sd);
  float ray = 1.0 - smoothstep(0.0007, 0.0007 + 1.3 * px, abs(q.y)) ;
  sl = max(sl, ray * step(0.03, r) * step(r, 0.112) * 0.9);
  float rims = groove(r, 0.064, 0.0009) + groove(r, 0.118, 0.0011) + groove(r, 0.026, 0.0009);
  return clamp(sl + rims, 0.0, 1.0);
}

// brushed metal with bevelled edges and a fixed anisotropic highlight
vec3 metal(vec2 lp, float ri, float ro, float seed, float tone) {
  float r = length(lp);
  vec2 u = lp / max(r, 1e-4);
  float a = atan(lp.y, lp.x);
  float bw = 0.0065;
  float tOut = 1.0 - smoothstep(0.0, bw, ro - r);
  float tIn = 1.0 - smoothstep(0.0, bw, r - ri);
  float dif = dot(u, LDIR) * (tOut - tIn);
  float br = vnoise(vec2(r * 1700.0, a * 2.0 + seed)) * 0.6 + vnoise(vec2(r * 420.0, a * 1.3 + seed * 3.0)) * 0.4;
  float al = dot(u, LDIR);
  float spec = pow(max(al, 0.0), 10.0) * 0.95 + pow(max(-al, 0.0), 18.0) * 0.3;
  spec *= 0.55 + 0.9 * br;
  vec3 gold = vec3(0.80, 0.58, 0.30) * tone;
  vec3 c = gold * (0.26 + 0.24 * br) * (1.0 + 1.35 * dif);
  c += vec3(1.0, 0.84, 0.56) * spec * (0.7 + 0.5 * tone);
  c += vec3(1.0, 0.9, 0.7) * max(dif, 0.0) * 0.35 * (tOut + tIn);
  return c;
}
// recessed engraving lit from LDIR: dark floor, one bright wall, one dark wall
vec3 engrave(vec3 c, float e, float eToL, float eFromL, float specAt) {
  vec3 floorC = c * 0.22 + vec3(0.03, 0.018, 0.008);
  vec3 o = mix(c, floorC, e);
  float litWall = e * (1.0 - eFromL);
  float darkWall = e * (1.0 - eToL);
  o += vec3(1.0, 0.86, 0.6) * litWall * (0.35 + 1.6 * specAt);
  o *= 1.0 - 0.55 * darkWall;
  return o;
}

vec3 glint(vec2 d, float s) {
  float core = exp(-dot(d, d) / (0.0022 * 0.0022 + px * px * 2.0));
  float rays = exp(-abs(d.x) / (0.0007 + 0.6 * px)) * exp(-abs(d.y) / 0.028)
             + exp(-abs(d.y) / (0.0007 + 0.6 * px)) * exp(-abs(d.x) / 0.028);
  vec2 dr = vec2(d.x + d.y, d.x - d.y) * 0.7071;
  float rays2 = exp(-abs(dr.x) / (0.0006 + 0.5 * px)) * exp(-abs(dr.y) / 0.012)
              + exp(-abs(dr.y) / (0.0006 + 0.5 * px)) * exp(-abs(dr.x) / 0.012);
  return vec3(1.0, 0.92, 0.75) * (core * 1.4 + rays * 0.7 + rays2 * 0.3 + exp(-length(d) / 0.02) * 0.12) * s;
}

void main() {
  px = 1.0 / uRes.y;
  LDIR = normalize(vec2(-0.55, 0.835));
  float I = clamp(uIntensity, 0.0, 1.0);
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float T = mod(uTime, 3600.0) + uSeed * 61.0;
  vec2 p = p0 / 1.02;

  // parallax: mouse plus a slow idle sway
  vec2 par = (uMouse - 0.5) * 2.0 + vec2(sin(T * 0.23), cos(T * 0.19)) * 0.22;
  vec2 cA = par * 0.004, cB = par * 0.008, cC = par * 0.012, cD = par * 0.016, cH = par * 0.020, cP = par * 0.028;

  // rotations
  float rotA = mod(T * 0.022, TAU);
  float rotB = mod(-T * 0.037, TAU);
  float bc = T / 3.0;
  float rotC = mod((floor(bc) + beat(fract(bc))) * TAU / 24.0, TAU);
  float velC = clamp(abs(beat(fract(bc) + 0.02) - beat(fract(bc))) / 0.02 * 0.35, 0.0, 1.0);
  float bd = (T + 0.75) / 1.5;
  float rotD = mod(-(floor(bd) + beat(fract(bd))) * TAU / 40.0, TAU);
  float velD = clamp(abs(beat(fract(bd) + 0.02) - beat(fract(bd))) / 0.02 * 0.35, 0.0, 1.0);
  float rotH = mod(T * 0.05, TAU);
  float pa = mod(T * 0.21 + 0.6, TAU);

  // ---- ground: black, faint sky arcs and stars ----
  vec3 col = vec3(0.022, 0.019, 0.016) + vec3(0.05, 0.035, 0.02) * exp(-length(p0) * 2.2);
  vec2 sp = (p0 - par * 0.006) * 70.0;
  vec2 sid = floor(sp);
  float sr = h21(sid + floor(uSeed * 9.0));
  vec2 so = vec2(h21(sid + 1.3), h21(sid + 4.7)) - 0.5;
  float star = step(0.93, sr) * (1.0 - smoothstep(0.03, 0.09, length(fract(sp) - 0.5 - so * 0.6)));
  col += vec3(0.85, 0.76, 0.6) * star * (0.12 + 0.18 * sin(T * (1.0 + sr * 3.0) + sr * 50.0)) * smoothstep(0.47, 0.6, length(p));
  float rr0 = length(p - cA * 0.5);
  col += vec3(0.5, 0.4, 0.26) * (groove(rr0, 0.585, 0.0006) * 0.12 + groove(rr0, 0.72, 0.0006) * 0.07);

  // mater (base plate) behind the rings
  float rM = length(p);
  float mater = band(rM, 0.0, 0.478);
  vec3 mcol = vec3(0.07, 0.048, 0.026) * (0.8 + 0.3 * vnoise(vec2(rM * 900.0, atan(p.y, p.x) * 2.0)));
  mcol *= 0.6 + 0.4 * smoothstep(0.478, 0.40, rM);
  col = mix(col, mcol, mater);
  // drop shadow of the rings onto the plate
  vec2 shOff = -LDIR * 0.006;
  float shadowR = length(p - cB + shOff);
  float sh = smoothstep(0.012, 0.0, abs(shadowR - 0.43)) * 0.0;
  col *= 1.0 - sh;

  // sweep: warmth trailing the alidade
  float angP = atan(p.y, p.x);
  float behind = mod(pa - angP, TAU);
  float sweep = exp(-behind * 1.8) * (0.55 + 0.45 * I);
  float specLine = 0.0;

  // ---- ring A: 185 ticks ----
  vec2 lA = p - cA;
  float rA = length(lA);
  if (rA > 0.392 && rA < 0.47) {
    float cov = band(rA, 0.395, 0.465);
    vec3 m = metal(lA, 0.395, 0.465, 1.0, 1.0);
    float sa = pow(max(dot(lA / rA, LDIR), 0.0), 14.0);
    float e = maskA(lA, rotA);
    vec3 c = engrave(m, e, maskA(lA + LDIR * 0.0016, rotA), maskA(lA - LDIR * 0.0016, rotA), sa);
    c += vec3(1.0, 0.6, 0.25) * sweep * 0.22 * (0.4 + e);
    col = mix(col, c, cov);
  }
  // ---- ring B: Greek key ----
  vec2 lB = p - cB;
  float rB = length(lB);
  if (rB > 0.312 && rB < 0.389) {
    float cov = band(rB, 0.315, 0.386);
    vec3 m = metal(lB, 0.315, 0.386, 7.0, 0.92);
    float sa = pow(max(dot(lB / rB, LDIR), 0.0), 14.0);
    float e = maskB(lB, rotB);
    vec3 c = engrave(m, e, maskB(lB + LDIR * 0.0016, rotB), maskB(lB - LDIR * 0.0016, rotB), sa);
    c += vec3(1.0, 0.6, 0.25) * sweep * 0.2 * (0.4 + e);
    col = mix(col, c, cov);
  }
  // ---- ring C: 24 seals, stepping ----
  vec2 lC = p - cC;
  float rC = length(lC);
  if (rC > 0.215 && rC < 0.309) {
    float cov = band(rC, 0.218, 0.306);
    vec3 m = metal(lC, 0.218, 0.306, 13.0, 1.05);
    float sa = pow(max(dot(lC / rC, LDIR), 0.0), 14.0);
    float kC, kd;
    float e = maskC(lC, rotC, kC);
    vec3 c = engrave(m, e, maskC(lC + LDIR * 0.0016, rotC, kd), maskC(lC - LDIR * 0.0016, rotC, kd), sa);
    // the cell under the alidade glows like lit enamel
    float pk = mod(floor((pa - rotC - cC.x * 0.0) / TAU * 24.0), 24.0);
    float onCell = step(abs(kC - pk), 0.1);
    c += vec3(1.0, 0.72, 0.36) * e * onCell * (0.75 + 0.25 * sin(T * 6.0)) * (0.6 + 0.4 * I);
    c += vec3(1.0, 0.6, 0.25) * sweep * 0.2 * (0.4 + e);
    col = mix(col, c, cov);
  }
  // ---- ring D: forty-day count, stepping the other way ----
  vec2 lD = p - cD;
  float rD = length(lD);
  if (rD > 0.136 && rD < 0.212) {
    float cov = band(rD, 0.139, 0.209);
    vec3 m = metal(lD, 0.139, 0.209, 19.0, 0.95);
    float sa = pow(max(dot(lD / rD, LDIR), 0.0), 14.0);
    float e = maskD(lD, rotD);
    vec3 c = engrave(m, e, maskD(lD + LDIR * 0.0016, rotD), maskD(lD - LDIR * 0.0016, rotD), sa);
    c += vec3(1.0, 0.6, 0.25) * sweep * 0.22 * (0.4 + e);
    col = mix(col, c, cov);
  }
  // ---- hub with turning rete ----
  vec2 lH = p - cH;
  float rH = length(lH);
  if (rH < 0.131) {
    float cov = band(rH, 0.0, 0.128);
    vec3 m = metal(lH, 0.0, 0.128, 23.0, 1.1);
    float sa = pow(max(dot(lH / max(rH, 1e-4), LDIR), 0.0), 14.0);
    float e = maskHub(lH, rotH);
    vec3 c = engrave(m, e, maskHub(lH + LDIR * 0.0016, rotH), maskHub(lH - LDIR * 0.0016, rotH), sa);
    col = mix(col, c, cov);
  }

  // broad spot from the upper left: the instrument falls into shadow toward the lower right
  float spot = 0.50 + 0.85 * smoothstep(-0.55, 0.45, dot(p, LDIR)) ;
  col *= mix(1.0, spot, mater);

  // ---- alidade: shadow, then the rule itself ----
  vec2 dir = vec2(cos(pa), sin(pa));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 lP = p - cP;
  vec2 lS = lP + LDIR * 0.011;
  float alS = dot(lS, dir), acS = dot(lS, nrm);
  float hwS = alS > 0.0 ? mix(0.0062, 0.0008, smoothstep(0.03, 0.472, alS)) : mix(0.0062, 0.004, smoothstep(0.0, 0.2, -alS));
  float shP = smoothstep(hwS + 0.006, hwS - 0.002, abs(acS)) * step(-0.205, alS) * step(alS, 0.474);
  shP = max(shP, smoothstep(0.03, 0.012, length(lS + dir * 0.175)));
  col *= 1.0 - 0.6 * shP * band(rM, 0.0, 0.478);
  float al = dot(lP, dir), ac = dot(lP, nrm);
  float hw = al > 0.0 ? mix(0.0062, 0.0008, smoothstep(0.03, 0.472, al)) : mix(0.0062, 0.004, smoothstep(0.0, 0.2, -al));
  float rule = (1.0 - smoothstep(hw - px, hw + px, abs(ac))) * smoothstep(-0.205 - px, -0.205 + px, al) * smoothstep(0.474 + px, 0.474 - px, al);
  float cw = length(lP + dir * 0.175);
  float weight = 1.0 - smoothstep(0.0125 - px, 0.0125 + px, cw);
  float pin = 1.0 - smoothstep(0.0165 - px, 0.0165 + px, length(lP));
  float cover = max(max(rule, weight), pin);
  if (cover > 0.0) {
    float side = clamp(ac / max(hw, 1e-4), -1.0, 1.0);
    vec2 n2 = nrm * side;
    float dif = dot(n2, LDIR);
    float glintAlong = pow(max(dot(nrm, LDIR) * sign(ac), 0.0), 2.0);
    vec3 pc = vec3(0.86, 0.64, 0.34) * (0.42 + 0.9 * max(dif, 0.0) - 0.25 * max(-dif, 0.0));
    pc += vec3(1.0, 0.9, 0.7) * smoothstep(0.6, 1.0, abs(side)) * glintAlong * 0.6;
    pc += vec3(1.0, 0.95, 0.85) * (1.0 - smoothstep(0.0, 1.2 * px, abs(ac))) * 0.25 * step(0.02, al);
    // counterweight and centre pin: domed
    vec2 wn = (lP + dir * 0.175) / 0.0125;
    vec2 pn = lP / 0.0165;
    float domeW = clamp(dot(wn, LDIR) * 0.8 + 0.4, 0.0, 1.5);
    float domeP = clamp(dot(pn, LDIR) * 0.8 + 0.4, 0.0, 1.5);
    pc = mix(pc, vec3(0.86, 0.64, 0.34) * (0.3 + 0.7 * domeW) + vec3(1.0, 0.9, 0.7) * pow(max(1.0 - length(wn - LDIR * 0.45), 0.0), 6.0) * 1.2, weight * (1.0 - rule * 0.5));
    pc = mix(pc, vec3(0.9, 0.68, 0.36) * (0.3 + 0.7 * domeP) + vec3(1.0, 0.94, 0.8) * pow(max(1.0 - length(pn - LDIR * 0.45), 0.0), 6.0) * 1.4, pin);
    col = mix(col, pc, cover);
  }

  // ---- glints where the highlight crosses each rim; they flare as engraving passes ----
  float tickPass = pow(0.5 + 0.5 * cos(TAU * ((atan(LDIR.y, LDIR.x) - rotA) / TAU * 185.0)), 24.0);
  vec3 glt = vec3(0.0);
  glt += glint(p - (cA + LDIR * 0.4645), 0.25 + 0.75 * tickPass);
  glt += glint(p - (cB + LDIR * 0.3855), 0.18 + 0.3 * (0.5 + 0.5 * sin(T * 1.7)));
  glt += glint(p - (cC + LDIR * 0.3055), 0.12 + 1.1 * velC);
  glt += glint(p - (cD + LDIR * 0.2085), 0.10 + 1.0 * velD);
  glt += glint(p - (cP + LDIR * 0.0105), 0.35);
  col += glt * (0.45 + 0.55 * I);

  // ---- grade ----
  col = col / (1.0 + 0.3 * max(col - 0.85, 0.0));
  float vig = smoothstep(1.25, 0.25, length(p0 * vec2(0.82, 1.05)));
  col *= 0.38 + 0.62 * vig;
  float gr = h21(gl_FragCoord.xy + fract(T * 9.1) * 421.0) - 0.5;
  col += gr * (0.03 + 0.02 * I);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
}
export default reel
