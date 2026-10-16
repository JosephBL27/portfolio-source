import type { ReelDef } from './types'
import { FONT_GLSL, T, W } from './font'

// Four Inboxes: the Secretary's run, as a picture. Four streams (Gmail, Outlook, iMessage, WhatsApp)
// carry envelopes and message bubbles from the left. The ones that need action glow and survive;
// the rest dim and drop away. All four lanes merge into one triage node, which sends tier-coloured
// chips out along a bus to a register of exactly 20 columns, one row per chip. Rows with a date
// then let a hold fall onto the calendar: a dashed, tentative "Maybe:" block. A clock in the corner
// has four quarters and its hand advances one quarter per run (four runs a day), and at the end
// of each run all four sources tick in the run log, even when a source found nothing.
// The messages, tiers and holds are generative, not mail. The four tier colours are decoration.
// GLSL ES 1.00; loops bounded (4 lanes x 2 candidates, 2 chips, 6 events). No textures.
const reel: ReelDef = {
  id: 'secretary',
  projectId: 'secretary',
  title: 'Four Inboxes',
  medium: 'Four message streams merging into one register, with tentative holds on a calendar',
  colors: { bg: '#080C18', ink: '#E8EEFF', accent: '#7FB2FF' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;
${FONT_GLSL}
#define PI 3.14159265
#define CYC 16.0
#define RX0 0.14
#define RCW 0.024
#define RY1 0.425
#define RRH 0.034
#define CX0 0.14
#define CDW 0.096
#define CY1 -0.095
#define CHR 0.052
#define YT 0.01
#define TX -0.035
const vec3 ACC = vec3(0.50, 0.70, 1.0);
float Tm, Tc, OUT;

float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float cov(float sd, float aa) { return clamp(0.5 - sd / aa, 0.0, 1.0); }
float box(vec2 q, vec2 c, vec2 h, float r) { vec2 d = abs(q - c) - h + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
float laneY(float j) { return 0.255 - j * 0.165; }
float laneP(float yj, float x) { return mix(yj, YT, smoothstep(-0.40, -0.12, x)); }
vec3 laneTint(float j) { return j < 0.5 ? vec3(0.96, 0.50, 0.45) : (j < 1.5 ? vec3(0.45, 0.66, 0.98) : (j < 2.5 ? vec3(0.45, 0.88, 0.58) : vec3(0.36, 0.82, 0.76))); }
vec3 tierC(float t) { return t < 0.5 ? vec3(0.09, 0.07, 0.14) : (t < 1.5 ? vec3(0.95, 0.30, 0.32) : (t < 2.5 ? vec3(0.98, 0.76, 0.25) : vec3(0.40, 0.85, 0.55))); }
float tierOf(float n) { return floor(h11(n * 3.3 + 1.7) * 4.0); }
float rowY(float n) { return RY1 - (n + 0.5) * RRH; }
float arrOf(float n) { return 1.5 + 0.8 * n; }
float hasDate(float n) { return step(0.5, h11(n * 5.7 + 2.9)); }

// envelopes (Gmail, Outlook) and bubbles (iMessage, WhatsApp) running along their lane
vec4 lanePk(float j, vec2 p, float px) {
  float yj = laneY(j);
  float v = 0.15, per = 0.86, off = j * 0.23 + 0.1, x0 = -0.64;
  float mc = (Tm - off - (p.x - x0) / v) / per;
  vec3 oc = vec3(0.0); float oa = 0.0;
  for (int s = 0; s < 2; s++) {
    float m = floor(mc) + float(s);
    float xp = x0 + v * (Tm - off - m * per);
    float act = step(0.42, h21(vec2(m, j * 3.1 + 1.0)));
    float drop = (1.0 - act) * smoothstep(-0.48, -0.28, xp);
    float merge = smoothstep(-0.12, -0.05, xp);
    float al = (1.0 - drop) * (1.0 - merge) * smoothstep(-0.66, -0.58, xp);
    float sc = 1.0 - 0.45 * merge - 0.5 * drop;
    float cy0 = laneP(yj, xp);
    float ang = atan((laneP(yj, xp + 0.01) - laneP(yj, xp - 0.01)) / 0.02) * 0.6;
    vec2 dq = p - vec2(xp, cy0);
    vec2 q = vec2(dq.x * cos(ang) + dq.y * sin(ang), -dq.x * sin(ang) + dq.y * cos(ang)) / sc;
    float sd, fl = 0.0;
    if (j < 1.5) {
      sd = box(q, vec2(0.0), vec2(0.028, 0.019), 0.004);
      fl = cov(abs(q.y - (0.019 - abs(q.x) * 0.75)) - 0.0016, px * 1.4) * step(-0.004, q.y);
    } else {
      sd = min(box(q, vec2(0.0, 0.004), vec2(0.028, 0.017), 0.011), length(q - vec2(-0.016, -0.016)) - 0.006);
      fl = cov(abs(q.y - 0.004) - 0.0016, px * 1.4) * step(abs(q.x), 0.016);
    }
    float mk = cov(sd * sc, px * 1.3) * al;
    vec3 tint = laneTint(j);
    vec3 c = mix(vec3(0.34, 0.37, 0.48), mix(tint, vec3(1.0), 0.20), act);
    c = mix(c, vec3(0.06, 0.07, 0.12), fl * 0.55);
    float ga = exp(-max(sd * sc, 0.0) / 0.011) * 0.45 * act * al * (1.0 - mk);
    float ta = mk + ga * (1.0 - mk);
    if (ta > oa) { oc = (c * mk + ACC * ga) / max(ta, 1e-4); oa = ta; }
  }
  return vec4(oc, oa);
}

// the register: 20 columns, 12 rows; each row is written as its chip arrives
vec4 reg(vec2 p, float px) {
  vec2 q = vec2(p.x - RX0, RY1 - p.y);
  float WD = 20.0 * RCW;
  if (q.x < -0.003 || q.x > WD + 0.003 || q.y < -0.003 || q.y > 12.0 * RRH + 0.003) return vec4(0.0);
  float r = clamp(floor(q.y / RRH), 0.0, 11.0);
  vec2 f = vec2(fract(q.x / RCW), fract(q.y / RRH));
  vec3 col = vec3(0.040, 0.050, 0.090) + vec3(0.012) * mod(r, 2.0);
  float gx = smoothstep(px * 1.2, 0.0, min(f.x, 1.0 - f.x) * RCW);
  float gy = smoothstep(px * 1.2, 0.0, min(f.y, 1.0 - f.y) * RRH);
  col += vec3(0.60, 0.68, 1.0) * (gx * 0.05 + gy * 0.07);
  float arr = arrOf(r);
  float rv = smoothstep(arr, arr + 0.55, Tc) * (1.0 - OUT);
  float lx = q.x, ly = q.y - (r + 0.5) * RRH;
  if (rv > 0.0 && lx < rv * WD) {
    float t = tierOf(r);
    float sdc = box(vec2(lx, ly), vec2(RCW, 0.0), vec2(RCW * 0.88, 0.0095), 0.005);
    vec3 cc = tierC(t);
    col = mix(col, cc, cov(sdc, px * 1.3));
    col = mix(col, vec3(0.9, 0.9, 1.0), cov(abs(sdc + 0.0012) - 0.0008, px * 1.3) * step(t, 0.5) * 0.7);
    float sg = floor((lx - 2.0 * RCW) / (4.0 * RCW));
    if (lx > 2.0 * RCW && sg < 4.5) {
      float hb = h21(vec2(r * 3.0 + sg, 7.7));
      float len = (0.45 + 0.5 * h21(vec2(r + sg * 5.0, 1.9))) * 4.0 * RCW - 0.004;
      float st = 2.0 * RCW + sg * 4.0 * RCW + 0.002;
      float sdb = box(vec2(lx, ly), vec2(st + len * 0.5, 0.0), vec2(len * 0.5, 0.0036), 0.0036);
      vec3 bc = (sg > 1.5 && sg < 2.5 && hasDate(r) > 0.5) ? ACC : vec3(0.62, 0.68, 0.84) * 0.7;
      col = mix(col, bc, cov(sdb, px * 1.3) * step(0.18, hb));
    }
    col += vec3(0.8, 0.88, 1.0) * exp(-(Tc - arr) * 3.5) * 0.25 * step(arr, Tc);
  }
  return vec4(col, 1.0);
}

vec3 evt(float k) {
  return k < 0.5 ? vec3(0.0, 0.7, 1.5) : (k < 1.5 ? vec3(1.0, 2.9, 1.0) : (k < 2.5 ? vec3(2.0, 0.4, 2.0) : (k < 3.5 ? vec3(3.0, 2.4, 1.5) : (k < 4.5 ? vec3(4.0, 4.3, 1.0) : vec3(2.0, 3.9, 1.5)))));
}

// the calendar week with tentative holds dropping in
vec4 cal(vec2 p, float px) {
  vec2 q = vec2(p.x - CX0, CY1 - p.y);
  float WD = 5.0 * CDW, H = 6.0 * CHR;
  if (q.x < -0.003 || q.x > WD + 0.003 || q.y < -0.030 || q.y > H + 0.003) return vec4(0.0);
  vec3 col = vec3(0.040, 0.050, 0.090);
  float dx = min(fract(q.x / CDW), 1.0 - fract(q.x / CDW)) * CDW;
  float dy = min(fract(q.y / CHR), 1.0 - fract(q.y / CHR)) * CHR;
  col += vec3(0.60, 0.68, 1.0) * (smoothstep(px * 1.2, 0.0, dx) * 0.07 + smoothstep(px * 1.2, 0.0, dy) * 0.045 * step(0.0, q.y));
  if (q.y < 0.0) col = vec3(0.060, 0.072, 0.125) + vec3(0.0, 0.0, 0.0);
  // the hold falling from the register, then the block
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    vec3 e = evt(fk);
    float tk = 11.0 + 0.5 * fk;
    float age = Tc - tk;
    if (age > 0.0) {
      float al = 1.0 - OUT;
      vec2 c = vec2((e.x + 0.5) * CDW, (e.y + e.z * 0.5) * CHR);
      vec2 hf = vec2(CDW * 0.5 - 0.006, e.z * CHR * 0.5 - 0.003);
      float pop = 1.0 - exp(-age * 7.0) * cos(age * 14.0);
      vec2 qc = vec2(q.x - c.x, q.y - c.y) / max(pop, 0.2);
      float sd = box(qc, vec2(0.0), hf, 0.006);
      float fill = cov(sd, px * 1.4);
      col = mix(col, ACC * 0.40, fill * 0.55 * al);
      float edge = cov(abs(sd) - 0.0014, px * 1.4);
      float dash = step(0.5, fract((q.x + q.y) * 60.0));
      col = mix(col, ACC, edge * dash * al);
      if (e.z > 1.2) {
        float u = 0.0016;
        float tx = fText((p - vec2(CX0 + c.x - 0.5 * ${(W('MAYBE:') * 0.0016).toFixed(4)}, CY1 - c.y - 0.0055)) / u, ${T('MAYBE:')}, u / px);
        col = mix(col, vec3(0.92, 0.96, 1.0), tx * al * smoothstep(0.2, 0.5, age));
      } else {
        col = mix(col, vec3(0.8, 0.88, 1.0), cov(box(qc, vec2(0.0), vec2(0.022, 0.0025), 0.0025), px * 1.3) * 0.7 * al);
      }
    }
  }
  return vec4(col, 1.0);
}

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float S = min(uRes.y, uRes.x / 1.3);
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uRes) / S;
  float px = 1.0 / S;
  vec2 mo = uMouse - 0.5;
  Tm = mod(uTime, 7200.0) + uSeed * CYC * 2.0;
  Tc = mod(Tm, CYC);
  OUT = smoothstep(14.9, 15.9, Tc);
  float runIdx = mod(floor(Tm / CYC), 4.0);
  vec2 p = p0 + mo * vec2(0.012, 0.008);

  vec3 col = mix(vec3(0.020, 0.026, 0.052), vec3(0.036, 0.044, 0.080), smoothstep(-0.5, 0.5, p0.y));
  {
    vec2 g = p0 * 36.0; vec2 f = fract(g) - 0.5;
    col += vec3(0.5, 0.6, 1.0) * smoothstep(0.08, 0.0, length(f)) * 0.07;
  }

  // lane tracks and source names
  for (int i = 0; i < 4; i++) {
    float j = float(i);
    float yj = laneY(j);
    float dl = abs(p.y - laneP(yj, p.x)) * 0.92;
    float inl = step(-0.64, p.x) * step(p.x, TX - 0.02);
    float dsh = 0.5 + 0.5 * step(0.5, fract(p.x * 30.0 - Tm * 0.8));
    col += laneTint(j) * cov(dl - 0.0006, px * 1.4) * 0.22 * inl * dsh;
    vec4 pk = lanePk(j, p, px);
    col = mix(col, pk.rgb, pk.a);
  }
  {
    float u = 0.0022;
    col = mix(col, laneTint(0.0), fText((p0 - vec2(-0.64, laneY(0.0) + 0.034)) / u, ${T('GMAIL')}, u / px) * 0.95);
    col = mix(col, laneTint(1.0), fText((p0 - vec2(-0.64, laneY(1.0) + 0.034)) / u, ${T('OUTLOOK')}, u / px) * 0.95);
    col = mix(col, laneTint(2.0), fText((p0 - vec2(-0.64, laneY(2.0) + 0.034)) / u, ${T('IMESSAGE')}, u / px) * 0.95);
    col = mix(col, laneTint(3.0), fText((p0 - vec2(-0.64, laneY(3.0) + 0.034)) / u, ${T('WHATSAPP')}, u / px) * 0.95);
  }

  // triage node, the bus to the register, and the chips in flight
  {
    float chipBeat = Tc > 1.5 && Tc < 10.8 ? exp(-fract((Tc - 1.5) / 0.8) * 5.0) : 0.0;
    vec2 d = p0 - vec2(TX, YT);
    float L = length(d), a = atan(d.y, d.x);
    float hexr = 0.034 * (1.0 + 0.07 * cos(6.0 * a + Tm * 0.8));
    col += ACC * cov(abs(L - hexr) - 0.0016, px * 1.5) * (0.65 + 0.35 * chipBeat);
    col += ACC * exp(-L * L / 0.0012) * (0.14 + 0.28 * chipBeat);
    col = mix(col, vec3(0.92, 0.96, 1.0), cov(L - 0.007 * (1.0 + 0.5 * chipBeat), px * 1.5));
    float u = 0.0022;
    col = mix(col, vec3(0.85, 0.9, 1.0), fText((p0 - vec2(TX - ${(W('TRIAGE') * 0.0022 * 0.5).toFixed(4)}, YT - 0.066)) / u, ${T('TRIAGE')}, u / px) * 0.9);
    for (int i = 0; i < 4; i++) {
      vec2 sq = p0 - vec2(TX - 0.0375 + float(i) * 0.025, YT - 0.098);
      float t = float(i);
      col = mix(col, tierC(t), cov(box(sq, vec2(0.0), vec2(0.009), 0.003), px * 1.3));
      col = mix(col, vec3(0.9, 0.9, 1.0), cov(abs(box(sq, vec2(0.0), vec2(0.0105), 0.003) ) - 0.0007, px * 1.3) * step(t, 0.5) * 0.7);
    }
    // the bus and its feeder
    float feed = cov(abs(p0.y - YT) - 0.0007, px * 1.4) * step(TX + 0.036, p0.x) * step(p0.x, 0.128);
    col += ACC * feed * 0.25;
    float bus = cov(abs(p0.x - 0.128) - 0.0008, px * 1.4) * step(0.017, p0.y) * step(p0.y, RY1);
    col += ACC * bus * 0.22;
    float n0 = floor((Tc - 1.5) / 0.8) + 1.0;
    for (int s = 0; s < 2; s++) {
      float n = n0 + float(s);
      float arr = arrOf(n);
      float F = 0.95;
      float a2 = 1.0 - (arr - Tc) / F;
      if (n >= 0.0 && n < 11.5 && a2 > 0.0 && a2 < 1.0) {
        float e = a2 * a2 * (3.0 - 2.0 * a2);
        vec2 cp = vec2(mix(TX + 0.036, 0.152, a2), mix(YT, rowY(n), e));
        float sd = box(p0 - cp, vec2(0.0), vec2(0.020, 0.0095), 0.005);
        col += ACC * exp(-max(sd, 0.0) / 0.012) * 0.45;
        col = mix(col, tierC(tierOf(n)), cov(sd, px * 1.3));
        col = mix(col, vec3(0.9, 0.9, 1.0), cov(abs(sd + 0.0012) - 0.0008, px * 1.3) * step(tierOf(n), 0.5) * 0.7);
        // the flare when it lands in its row
        col += ACC * exp(-dot(p0 - vec2(0.140, rowY(n)), p0 - vec2(0.140, rowY(n))) / 0.0004) * smoothstep(0.85, 1.0, a2) * 0.9;
      }
    }
  }

  // register and calendar
  vec4 rg = reg(p0, px);
  col = mix(col, rg.rgb, rg.a);
  vec4 cl = cal(p0, px);
  col = mix(col, cl.rgb, cl.a);
  for (int k = 0; k < 6; k++) {
    vec3 e = evt(float(k));
    float age = Tc - (11.0 + 0.5 * float(k) - 0.4);
    float da = clamp(age / 0.4, 0.0, 1.0);
    float xc = CX0 + (e.x + 0.5) * CDW;
    float ytop = CY1 - e.y * CHR;
    float hy = mix(0.017, ytop, da);
    float on = step(0.0, age) * (1.0 - step(1.0, da)) * (1.0 - OUT);
    float ln = cov(abs(p0.x - xc) - 0.0008, px * 1.4) * step(hy, p0.y) * step(p0.y, min(hy + 0.09, 0.017)) * smoothstep(hy + 0.09, hy, p0.y);
    col += ACC * ln * on * 0.9;
    col += vec3(0.95, 0.98, 1.0) * exp(-dot(p0 - vec2(xc, hy), p0 - vec2(xc, hy)) / 0.00005) * on;
  }
  {
    float u = 0.0022;
    col = mix(col, ACC, fText((p0 - vec2(RX0, RY1 + 0.014)) / u, ${T('REGISTER')}, u / px) * 0.95);
    col = mix(col, ACC, fText((p0 - vec2(CX0, CY1 + 0.058)) / u, ${T('MAYBE: HOLDS')}, u / px) * 0.95);
    col = mix(col, vec3(0.6, 0.66, 0.85), fText((p0 - vec2(0.62 - ${(W('20 COLUMNS') * 0.0016).toFixed(4)}, RY1 + 0.017)) / 0.0016, ${T('20 COLUMNS')}, 0.0016 / px) * 0.8);
  }

  // the clock: one quarter per run, four runs a day
  {
    vec2 c = vec2(-0.565, 0.410);
    vec2 d = p0 - c;
    float L = length(d);
    col += vec3(0.55, 0.65, 1.0) * cov(abs(L - 0.052) - 0.0010, px * 1.4) * 0.55;
    float ang = atan(d.x, d.y);
    float q4 = abs(fract(ang / (0.5 * PI) + 0.5) - 0.5) * (0.5 * PI) * L;
    col += ACC * smoothstep(px * 1.4, 0.0, q4 - 0.0008) * step(0.040, L) * step(L, 0.052) * 0.9;
    float ha = (runIdx + Tc / CYC) * 0.5 * PI;
    vec2 hv = vec2(sin(ha), cos(ha));
    float t = clamp(dot(d, hv), 0.0, 0.043);
    float hd = length(d - hv * t);
    col = mix(col, vec3(1.0), cov(hd - 0.0016, px * 1.4) * step(L, 0.046));
    col = mix(col, ACC, cov(L - 0.004, px * 1.4));
    float u = 0.0022;
    col = mix(col, vec3(0.85, 0.9, 1.0), fText((p0 - vec2(-0.495, 0.418)) / u, ${T('4 RUNS')}, u / px) * 0.9);
    col = mix(col, vec3(0.85, 0.9, 1.0), fText((p0 - vec2(-0.495, 0.388)) / u, ${T('A DAY')}, u / px) * 0.9);
  }

  // the run log: all four sources tick at the end of a run, even at zero
  {
    float u = 0.0022;
    col = mix(col, vec3(0.6, 0.66, 0.85), fText((p0 - vec2(-0.64, -0.335)) / u, ${T('RUN LOG')}, u / px) * 0.85);
    for (int i = 0; i < 4; i++) {
      float j = float(i);
      vec2 sq = p0 - vec2(-0.632 + j * 0.036, -0.383);
      float on = smoothstep(13.2 + 0.3 * j, 13.45 + 0.3 * j, Tc) * (1.0 - OUT);
      col = mix(col, mix(vec3(0.12, 0.14, 0.22), laneTint(j), on), cov(box(sq, vec2(0.0), vec2(0.013), 0.004), px * 1.3));
      col += laneTint(j) * exp(-dot(sq, sq) / 0.0006) * 0.25 * on * exp(-(Tc - 13.2 - 0.3 * j) * 1.5) ;
    }
  }

  // grade
  float vig = smoothstep(1.3, 0.25, length(p0 * vec2(0.8, 1.1)));
  col *= 0.35 + 0.65 * vig;
  col = col / (1.0 + 0.2 * max(col - 0.95, 0.0));
  col += (h21(gl_FragCoord.xy + fract(uTime * 9.7) * 191.0) - 0.5) * (0.016 + 0.016 * I);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
}
export default reel
