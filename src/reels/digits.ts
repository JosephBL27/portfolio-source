import type { ReelDef } from './types'
import { FONT_GLSL, T, W } from './font'

// ZETA, as a reel: a 120-second Zetamac-style run on a phosphor display.
// The focal form is the drill itself: the live problem and its answer field (ghosted 8s, calculator
// typing, a bloom on every resolve) inside a 120-tick countdown ring. Behind it a wall of past
// problems flickers in and resolves, and a score line climbs the screen with its count riding the head.
// Everything is procedural seven-segment SDF; there are no textures. Problems follow Zetamac's default
// ranges ((2-12) x (2-100), (2-100) + (2-100)); the pace is simulated, not a logged run. The run is tuned to finish
// on 80, the app's best strict score, and shows NEW BEST over the final readout.
const reel: ReelDef = {
  id: 'digits',
  projectId: 'zeta',
  title: '120 seconds',
  medium: 'Arithmetic drills in seven-segment light',
  colors: { bg: '#070504', ink: '#FFE2B4', accent: '#FFA43A' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;
${FONT_GLSL}

const float ZT_TAU = 6.2831853;
const float ZT_BIG = 100.0;
const float ZT_RS = 0.84;      // phase of a problem at which its answer resolves
const float ZT_SLOT = 1.49;    // mean seconds per problem (80 resolved by t = 119.1 s)
const float ZT_R0 = 0.372;     // countdown ring radius

float zh1(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float zh2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

// problems resolved by drill time t, as a monotone warp of a steady pace
float zSched(float t) { return t / ZT_SLOT + 0.18 * sin(t * 0.9) + 0.10 * sin(t * 2.3 + 1.0) - 0.0841471; }
float zScore(float t) { float u = zSched(t) - ZT_RS + 1.0; return floor(u) - 1.0 + smoothstep(0.0, 0.12, fract(u)); }

vec4 zProb(float id) {
  float h1 = zh1(id * 1.731 + 0.17), h2 = zh1(id * 2.917 + 5.3), h3 = zh1(id * 0.613 + 9.1);
  float op = step(0.45, h3);
  float a = op > 0.5 ? 2.0 + floor(h1 * 11.0) : 2.0 + floor(h1 * 99.0);
  float b = 2.0 + floor(h2 * 99.0);
  return vec4(a, b, op, op > 0.5 ? a * b : a + b);
}
float zNd(float n) { return n < 9.5 ? 1.0 : (n < 99.5 ? 2.0 : (n < 999.5 ? 3.0 : 4.0)); }
float zP10(float e) { return e < 0.5 ? 1.0 : (e < 1.5 ? 10.0 : (e < 2.5 ? 100.0 : 1000.0)); }
float zDigitL(float n, float nd, float i) { return floor(mod((n + 0.5) / zP10(nd - 1.0 - i), 10.0)); }
float zDigitR(float n, float r) { return floor(mod((n + 0.5) / zP10(r), 10.0)); }

float zMask(float d) {
  if (d < 0.5) return 63.0; if (d < 1.5) return 6.0; if (d < 2.5) return 91.0; if (d < 3.5) return 79.0;
  if (d < 4.5) return 102.0; if (d < 5.5) return 109.0; if (d < 6.5) return 125.0; if (d < 7.5) return 7.0;
  if (d < 8.5) return 127.0; if (d < 9.5) return 111.0; return 0.0;
}
float zBit(float m, float b) { return mod(floor(m / b + 0.01), 2.0); }
float zSeg(vec2 d, float L, float w) { return max(d.y - w, (d.x + d.y - L) * 0.7071); }

// glyph distance in glyph units (digit spans y -1..1). x: lit segments, y: unlit (ghost) segments.
// codes: 0-9 digits, 10 times, 11 plus, 12 equals, 13 blank, 14 ghost-only 8
vec2 zGlyph(vec2 g, float code) {
  if (code > 12.5 && code < 13.5) return vec2(ZT_BIG);
  g.x -= g.y * 0.11;
  const float W = 0.12;
  if (code > 9.5 && code < 12.5) {
    if (code < 10.5) {
      vec2 r = abs(vec2(g.x + g.y, g.x - g.y) * 0.7071);
      return vec2(min(zSeg(r, 0.50, W), zSeg(r.yx, 0.50, W)), ZT_BIG);
    }
    if (code < 11.5) { vec2 r = abs(g); return vec2(min(zSeg(r, 0.50, W), zSeg(r.yx, 0.50, W)), ZT_BIG); }
    return vec2(min(zSeg(abs(g - vec2(0.0, 0.28)), 0.52, W), zSeg(abs(g + vec2(0.0, 0.28)), 0.52, W)), ZT_BIG);
  }
  float m = zMask(code);
  float s0 = zSeg(abs(g - vec2(0.0, 0.94)), 0.49, W);
  float s1 = zSeg(abs(g - vec2(0.56, 0.47)).yx, 0.45, W);
  float s2 = zSeg(abs(g - vec2(0.56, -0.47)).yx, 0.45, W);
  float s3 = zSeg(abs(g + vec2(0.0, 0.94)), 0.49, W);
  float s4 = zSeg(abs(g + vec2(0.56, 0.47)).yx, 0.45, W);
  float s5 = zSeg(abs(g - vec2(-0.56, 0.47)).yx, 0.45, W);
  float s6 = zSeg(abs(g), 0.49, W);
  float on = ZT_BIG, off = ZT_BIG;
  if (zBit(m, 1.0) > 0.5) on = min(on, s0); else off = min(off, s0);
  if (zBit(m, 2.0) > 0.5) on = min(on, s1); else off = min(off, s1);
  if (zBit(m, 4.0) > 0.5) on = min(on, s2); else off = min(off, s2);
  if (zBit(m, 8.0) > 0.5) on = min(on, s3); else off = min(off, s3);
  if (zBit(m, 16.0) > 0.5) on = min(on, s4); else off = min(off, s4);
  if (zBit(m, 32.0) > 0.5) on = min(on, s5); else off = min(off, s5);
  if (zBit(m, 64.0) > 0.5) on = min(on, s6); else off = min(off, s6);
  return vec2(on, off);
}

// problem line: a, op, b, '='
float zCode1(float c, vec4 P, float na, float nb) {
  if (c < na - 0.5) return zDigitL(P.x, na, c);
  if (c < na + 0.5) return P.z > 0.5 ? 10.0 : 11.0;
  if (c < na + nb + 0.5) return zDigitL(P.y, nb, c - na - 1.0);
  return 12.0;
}

vec3 zShade(float d, float ghost, float px, float bright, float halo, vec3 amb, vec3 hot) {
  float core = smoothstep(px, -px, d);
  float inner = smoothstep(-0.02, -0.11, d);
  float dd = max(d, 0.0);
  float hl = exp(-dd * 2.4) * 0.20 + exp(-dd * 8.0) * 0.42;
  vec3 c = (amb * (core * 0.95 + hl * halo) + hot * inner * 0.85 * core) * bright;
  return c + amb * smoothstep(px, -px, ghost) * 0.05;
}

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float S = min(uRes.y, uRes.x / 1.45);
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / S;
  float pxs = 1.0 / S;
  vec2 mo = uMouse - 0.5;
  vec2 q = p * (1.0 + 0.05 * I * dot(p, p));
  vec3 AMB = vec3(1.0, 0.55, 0.16);
  vec3 HOT = vec3(1.0, 0.86, 0.60);

  float T = uTime + uSeed * 120.0;
  float run = floor(T / 126.0);
  float dt = T - run * 126.0;
  float act = step(dt, 120.0);
  float td = min(dt, 120.0);
  float s = zSched(td);
  float k = floor(s), ph = s - k;
  vec4 P = zProb(k + run * 157.0);
  float nd = zNd(P.w);
  float nt = clamp(floor((ph - ZT_RS) / 0.07) + nd, 0.0, nd);
  float res = step(ZT_RS, ph);
  float since = res > 0.5 ? (ph - ZT_RS) * ZT_SLOT : (ph + 1.0 - ZT_RS) * ZT_SLOT;
  if (k < 0.5 && res < 0.5) since = 99.0;
  if (act < 0.5) since = 99.0;
  float score = k + res;
  float bloom = exp(-since * 4.2);

  vec3 col = vec3(0.010, 0.007, 0.005);
  vec2 C = vec2(0.0, 0.0) + mo * 0.012;
  vec2 rc = q - C;
  float r = length(rc);

  // ---------- wall of past drills ----------
  {
    vec2 wq = q - mo * 0.04;
    float WH = 0.029, RH = 0.05, SL = 0.27;
    float wy = wq.y + T * 0.011;
    float row = floor(wy / RH);
    float wx = wq.x + zh1(row * 7.13 + 0.5) * SL + T * 0.004 * (mod(row, 2.0) - 0.5);
    float sc = floor(wx / SL);
    vec2 sid = vec2(sc, row);
    float hh = zh2(sid * 1.37 + 0.71);
    float per = 5.0 + 7.0 * zh2(sid * 1.3 + 4.1);
    float tt = T + hh * per;
    float cyc = floor(tt / per);
    float lph = tt - cyc * per;
    float live = step(0.42, zh2(sid * 2.1 + cyc * 1.7));
    vec4 WP = zProb(floor(zh2(sid + cyc * 0.37) * 9973.0));
    float na = zNd(WP.x), nb = zNd(WP.y), nw = zNd(WP.w);
    float tres = 0.8 + 0.9 * hh;
    float typed = clamp(floor((lph - tres) / 0.11) + nw, 0.0, nw);
    float cw = 0.648 * WH;
    float lx = wx - sc * SL - 0.012;
    float ci = floor(lx / cw);
    float wgs = 2.7 / WH;
    vec2 g = vec2((lx - (ci + 0.5) * cw) * wgs, (wy - (row + 0.5) * RH) * wgs);
    float nAll = na + nb + 2.0 + nw;
    if (live > 0.5 && ci >= 0.0 && ci < nAll - 0.5 && abs(g.y) < 1.6 && lph < per - 1.0) {
      float code = 13.0;
      if (ci < na + nb + 1.5) code = zCode1(ci, WP, na, nb);
      else if (ci - (na + nb + 2.0) < typed - 0.5) code = zDigitL(WP.w, nw, ci - (na + nb + 2.0));
      vec2 d = zGlyph(g, code);
      float fadeIn = mix(step(0.5, zh1(floor(T * 38.0) + hh * 91.0)), 1.0, smoothstep(0.05, 0.22, lph));
      float fadeOut = smoothstep(per - 1.0, per - 2.4, lph);
      float flash = lph > tres ? exp(-(lph - tres) * 2.6) : 0.0;
      float b = (0.085 + 0.40 * flash) * fadeIn * fadeOut;
      float mask = smoothstep(ZT_R0 - 0.02, ZT_R0 + 0.17, r) * mix(0.45, 1.0, I);
      float core = smoothstep(wgs * pxs * 1.4, -wgs * pxs * 1.4, d.x);
      col += AMB * (core + exp(-max(d.x, 0.0) * 5.0) * 0.25) * b * mask;
    }
  }

  // ---------- score line: climbs the screen across the 120 seconds ----------
  float hw = 0.5 * uRes.x / S;
  float xL = -hw + 0.08, xR = hw - 0.08;
  float yB = -0.43, yT = 0.41;
  float sy = (yT - yB) / 80.0;
  vec2 lq = q - mo * 0.02;
  {
    float tx = (lq.x - xL) / (xR - xL) * 120.0;
    float inT = step(0.0, tx) * step(tx, td);
    float f0 = yB + zScore(max(tx, 0.0)) * sy;
    float e = 0.18;
    float f1 = yB + zScore(max(tx - e, 0.0)) * sy, f2 = yB + zScore(tx + e) * sy;
    float slope = (f2 - f1) / (2.0 * e * (xR - xL) / 120.0);
    float dl = abs(lq.y - f0) / sqrt(1.0 + slope * slope);
    float inside = mix(0.22, 1.0, smoothstep(ZT_R0 - 0.03, ZT_R0 + 0.06, r));
    float lineC = smoothstep(pxs * 1.6, 0.0, dl - 0.0011);
    float lineG = exp(-dl / 0.006) * 0.35 + exp(-dl / 0.03) * 0.08;
    col += AMB * (lineC * 0.85 + lineG) * inT * inside * mix(0.6, 1.0, I);
    float under = step(lq.y, f0) * step(yB, lq.y) * inT;
    col += AMB * under * (0.010 + 0.05 * exp(-(f0 - lq.y) / 0.08)) * inside;
    // axis: baseline and a tick every 10 seconds
    float ax = smoothstep(pxs * 1.5, 0.0, abs(lq.y - yB + 0.012) - 0.0004) * step(xL, lq.x) * step(lq.x, xR);
    float tk = mod(tx + 5.0, 10.0) - 5.0;
    float tick = smoothstep(pxs * 1.4, 0.0, abs(tk * (xR - xL) / 120.0) - 0.0006) * step(abs(lq.y - yB + 0.02), 0.008) * step(-0.5, tx) * step(tx, 120.5);
    col += AMB * (ax * 0.10 + tick * mix(0.10, 0.45, step(tx, td)));
    // head and its score label
    vec2 H = vec2(xL + td / 120.0 * (xR - xL), yB + zScore(td) * sy);
    float dh = length(lq - H);
    float hb = 1.0 + 1.6 * bloom;
    col += (HOT * smoothstep(0.0075, 0.004, dh) + AMB * (exp(-dh / 0.012) * 0.5 + exp(-dh / 0.05) * 0.10)) * hb;
    float lH = 0.044;
    float ns = zNd(score);
    vec2 lo = H + vec2(0.022, 0.034);
    float lgs = 2.7 / lH;
    vec2 lg = (lq - lo) * lgs;
    float lci = floor(lg.x / 1.75);
    if (lci >= 0.0 && lci < ns - 0.5 && abs(lg.y) < 2.5) {
      vec2 d = zGlyph(vec2(lg.x - (lci + 0.5) * 1.75, lg.y), zDigitL(score, ns, lci));
      col += zShade(d.x, ZT_BIG, lgs * pxs, 0.85 + 0.6 * bloom, 1.0, AMB, HOT);
    }
  }

  // ---------- countdown ring: 120 ticks, one per second ----------
  {
    float turn = fract(atan(rc.x, rc.y) / ZT_TAU + 1.0);
    float e = td / 120.0;
    float ti = floor(turn * 120.0 + 0.5);
    float tim = mod(ti, 120.0);
    float tang = (turn * 120.0 - ti) / 120.0 * ZT_TAU * r;
    float major = step(mod(tim + 0.5, 10.0), 1.0);
    float five = step(mod(tim + 0.5, 5.0), 1.0);
    float tl = mix(mix(0.015, 0.025, five), 0.040, major);
    float tickD = max(abs(tang) - mix(0.0022, 0.0034, major), max(ZT_R0 - r, r - (ZT_R0 + tl)));
    float tickC = smoothstep(pxs * 1.2, -pxs * 0.6, tickD);
    float lit = step(td, tim + 1.0);
    float refill = dt > 124.4 ? step(turn, (dt - 124.4) / 1.6) : 0.0;
    lit = max(lit * act, refill);
    float age = td - (tim + 1.0);
    float ember = act * (age > 0.0 ? exp(-age * 0.8) : 0.0);
    float tb = lit * mix(0.62, 1.0, major) + ember * 0.9 + 0.075;
    col += mix(AMB, HOT, lit * major * 0.5) * tickC * tb;
    col += AMB * exp(-max(tickD, 0.0) / 0.004) * 0.10 * lit;
    // inner arc
    float ar = abs(r - (ZT_R0 - 0.016));
    float arcC = smoothstep(pxs * 1.4, 0.0, ar - 0.0009);
    float onArc = max(step(e, turn) * act, refill);
    col += AMB * arcC * mix(0.07, 0.6, onArc);
    // sweep head: radial beam plus a comet trail on the arc
    float da = fract(turn - e + 0.5) - 0.5;
    float tangH = da * ZT_TAU * r;
    float band = smoothstep(ZT_R0 - 0.05, ZT_R0 - 0.02, r) * smoothstep(ZT_R0 + 0.075, ZT_R0 + 0.045, r);
    col += (HOT * exp(-abs(tangH) / 0.0025) * 0.9 + AMB * exp(-abs(tangH) / 0.012) * 0.25) * band * act;
    float trail = da < 0.0 ? exp(da * ZT_TAU * 3.2) : 0.0;
    col += AMB * trail * exp(-ar / 0.005) * 0.5 * act;
    // outer hairline
    col += AMB * smoothstep(pxs * 1.4, 0.0, abs(r - (ZT_R0 + 0.062)) - 0.0005) * 0.10;
    // a pulse leaves the ring on every resolved answer
    float pr = ZT_R0 + 0.07 + since * 0.32;
    col += AMB * exp(-abs(r - pr) / 0.004) * exp(-since * 2.6) * 0.45 * I;
  }

  // ---------- the live drill ----------
  vec2 mq = q - C;
  {
    // countdown readout
    float cH = 0.050;
    float cgs = 2.7 / cH;
    float left = act > 0.5 ? ceil(120.0 - td) : 0.0;
    vec2 cg = (mq - vec2(-1.5 * 1.75 / cgs, 0.228)) * cgs;
    float cci = floor(cg.x / 1.75);
    if (cci >= 0.0 && cci < 2.5 && abs(cg.y) < 3.0) {
      float r3 = 2.0 - cci;
      float code = (left + 0.5 < zP10(r3) && r3 > 0.5) ? 14.0 : zDigitR(left, r3);
      vec2 d = zGlyph(vec2(cg.x - (cci + 0.5) * 1.75, cg.y), code);
      float warn = act * step(120.0 - td, 10.0) * (0.5 + 0.5 * step(0.5, fract(td * 2.0)));
      col += zShade(d.x, d.y, cgs * pxs, 0.62 + 0.5 * warn, 0.8, AMB, HOT);
    }

    // problem line
    float H1 = 0.115;
    float g1s = 2.7 / H1;
    float na = zNd(P.x), nb = zNd(P.y);
    float n1 = act > 0.5 ? na + nb + 2.0 : 0.0;
    vec2 g0 = (mq - vec2(-0.5 * n1 * 1.75 / g1s, 0.098)) * g1s;
    float flick = mix(step(0.45, zh1(floor(T * 40.0) + k * 3.0)), 1.0, smoothstep(0.035, 0.085, ph));
    if (abs(g0.y) < 5.0 && n1 > 0.5) {
      float ci = floor(g0.x / 1.75);
      float dOn = ZT_BIG, dGh = ZT_BIG;
      for (int j = -1; j <= 1; j++) {
        float c = ci + float(j);
        if (c < -0.5 || c > n1 - 0.5) continue;
        vec2 d = zGlyph(vec2(g0.x - (c + 0.5) * 1.75, g0.y), zCode1(c, P, na, nb));
        dOn = min(dOn, d.x); dGh = min(dGh, d.y);
      }
      col += zShade(dOn, dGh, g1s * pxs, flick * (0.92 + 0.35 * bloom), 1.0, AMB, HOT);
    }

    // answer field: four ghosted cells, calculator-style typing from the right
    float H2 = 0.165;
    float g2s = 2.7 / H2;
    vec2 a0 = (mq - vec2(-2.0 * 1.75 / g2s, -0.094)) * g2s;
    float val, nv, br;
    if (act < 0.5) {
      val = score; nv = zNd(score); br = 0.9 + 0.5 * (0.5 + 0.5 * sin(dt * 5.0));
    } else if (nt > 0.5) {
      val = floor((P.w + 0.5) / zP10(nd - nt)); nv = nt; br = 0.95 + 2.2 * bloom * res;
    } else {
      vec4 Pp = zProb(k - 1.0 + run * 157.0);
      val = Pp.w; nv = (k > 0.5) ? zNd(Pp.w) : 0.0; br = 2.4 * bloom;
    }
    if (abs(a0.y) < 5.0) {
      float ci = floor(a0.x / 1.75);
      float dOn = ZT_BIG, dGh = ZT_BIG;
      for (int j = -1; j <= 1; j++) {
        float c = ci + float(j);
        if (c < -0.5 || c > 3.5) continue;
        float rr = 3.0 - c;
        float code = rr < nv - 0.5 ? zDigitR(val, rr) : 14.0;
        vec2 d = zGlyph(vec2(a0.x - (c + 0.5) * 1.75, a0.y), code);
        dOn = min(dOn, d.x); dGh = min(dGh, d.y);
      }
      col += zShade(dOn, dGh, g2s * pxs, br, 1.0 + 0.8 * bloom, AMB, HOT);
      // broad bloom behind the field on resolve
      vec2 bq = abs(mq - vec2(0.0, -0.094)) - vec2(0.17, 0.05);
      float bd = length(max(bq, 0.0)) + min(max(bq.x, bq.y), 0.0);
      col += AMB * exp(-max(bd, 0.0) / 0.06) * 0.22 * bloom * res * mix(0.5, 1.0, I);
    }
    // underline cursor of the answer box
    float ul = smoothstep(pxs * 1.4, 0.0, abs(mq.y + 0.188) - 0.0008) * step(abs(mq.x), 0.21);
    float blink = act * (nt < 0.5 ? step(0.5, fract(T * 2.2)) : 0.0);
    col += AMB * ul * (0.18 + 0.5 * blink + 0.6 * bloom * res);
  }

  // ---------- new best: the 120 s run ends on 80 ----------
  {
    float bf = (1.0 - act) * smoothstep(0.1, 0.7, dt - 120.0);
    float ub = 0.0042;
    float tx = fText((mq - vec2(-${(W('NEW BEST') * 0.5).toFixed(1)} * ub, 0.080)) / ub, ${T('NEW BEST')}, ub / pxs);
    col += mix(AMB, HOT, 0.5) * tx * bf * (1.45 + 0.30 * sin(dt * 7.0));
    col += AMB * exp(-abs(r - (ZT_R0 + 0.07 + (dt - 120.0) * 0.20)) / 0.004) * exp(-(dt - 120.0) * 1.6) * (1.0 - act) * 0.5;
  }

  // ---------- CRT ----------
  col += AMB * 0.018 * bloom * I;
  float roll = exp(-pow(fract(q.y * 0.35 - T * 0.09) - 0.5, 2.0) * 50.0);
  col *= 1.0 + 0.06 * roll * I;
  col = 1.0 - exp(-col * 1.25);
  float scan = 0.5 + 0.5 * cos(gl_FragCoord.y * ZT_TAU / 3.0);
  col *= mix(1.0, 0.80 + 0.20 * scan, I * smoothstep(320.0, 640.0, uRes.y));
  float vig = smoothstep(1.25, 0.25, length(p * vec2(0.82, 1.08)));
  col *= mix(0.35, 1.0, vig);
  col += (zh2(gl_FragCoord.xy + fract(uTime * 7.31) * 157.0) - 0.5) * mix(0.012, 0.040, I);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`,
}
export default reel
