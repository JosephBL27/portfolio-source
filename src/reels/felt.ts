import type { ReelDef } from './types'
import { FONT_GLSL, T, C } from './font'
import { CARD_GLSL } from './cards'

// Felt: a live poker table from above, after Table Model (the Chrome extension that reads a PokerNow
// table hand by hand). Seven seats around a lit stadium of felt and leather rail; every 20 seconds a
// new hand is dealt, bet, swept into the pot, revealed and awarded. Each seat carries an equity ring;
// every street a pricing wave leaves the board and each ring re-prices as it passes. A folder drops
// out and the rest renormalise. A placard in the corner prices FOLD / CALL / RAISE as bars (no
// numerals). Hands, folds and equities are simulated (hash-driven), not a logged table.
// GLSL ES 1.00; loops are bounded (7 seats, <=4 chips, 12 pot chips, 14 sparks) and gated by
// per-region early-outs. No textures.
const reel: ReelDef = {
  id: 'felt',
  projectId: 'table-model',
  title: 'Felt',
  medium: 'A simulated poker table from above: cards dealt, bets swept, equity re-priced',
  colors: { bg: '#04100C', ink: '#F1EBDA', accent: '#3FBF8A' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;
${FONT_GLSL}
${CARD_GLSL}
#define CYC 20.0
#define LH 0.30
#define RR 0.31
#define NS 7

float hand;
float lt;

float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float H(float a, float b) { return h21(vec2(a + hand * 17.31, b + 3.7 + hand * 0.37)); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float sdStad(vec2 p, float L, float R) { p.x = abs(p.x); p.x = max(p.x - L, 0.0); return length(p) - R; }
float ease(float x) { x = clamp(x, 0.0, 1.0); return 1.0 - pow(1.0 - x, 3.0); }
float eio(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }

// ---------- seats and the hand ----------
vec4 seatG(float k) {
  if (k < 0.5) return vec4(0.0, -0.366, 0.0, 1.0);
  if (k < 1.5) return vec4(-0.30, -0.366, 0.0, 1.0);
  if (k < 2.5) return vec4(-0.664, 0.0, 1.0, 0.0);
  if (k < 3.5) return vec4(-0.30, 0.366, 0.0, -1.0);
  if (k < 4.5) return vec4(0.30, 0.366, 0.0, -1.0);
  if (k < 5.5) return vec4(0.664, 0.0, -1.0, 0.0);
  return vec4(0.30, -0.366, 0.0, 1.0);
}
float dealer() { return floor(H(0.0, 0.0) * 7.0); }
float orderOf(float k) { return mod(k - dealer() - 1.0 + 14.0, 7.0); }
float stageA() { return H(1.5, 0.0) < 0.80 ? 0.0 : floor(H(1.0, 0.0) * 7.0); }
float stageB() { return mod(stageA() + 1.0 + floor(H(2.0, 0.0) * 6.0), 7.0); }
// 0..3: folds during that betting round, 4: plays to the showdown
float foldStage(float k) {
  if (abs(k - stageA()) < 0.5 || abs(k - stageB()) < 0.5) return 4.0;
  float r = H(10.0 + k, 1.0);
  return r < 0.42 ? 0.0 : (r < 0.70 ? 1.0 : (r < 0.88 ? 2.0 : (r < 0.96 ? 3.0 : 4.0)));
}
float foldTime(float k) {
  float fs = foldStage(k);
  float base = fs < 0.5 ? 2.9 : (fs < 1.5 ? 6.3 : (fs < 2.5 ? 9.7 : 13.0));
  return fs > 3.5 ? 99.0 : base + 0.11 * orderOf(k);
}
float winner() { return H(3.0, 0.0) < 0.5 ? stageA() : stageB(); }
vec2 holeCard(float k, float c) { return vec2(floor(H(30.0 + k * 2.0 + c, 5.0) * 13.0), floor(H(50.0 + k * 2.0 + c, 6.0) * 4.0)); }
vec2 boardCard(float i) { return vec2(floor(H(80.0 + i, 7.0) * 13.0), floor(H(90.0 + i, 8.0) * 4.0)); }
float swT(float r) { return r < 0.5 ? 3.9 : (r < 1.5 ? 7.0 : (r < 2.5 ? 10.4 : 13.6)); }
float betT(float r) { return r < 0.5 ? 2.4 : (r < 1.5 ? 5.5 : (r < 2.5 ? 8.9 : 12.2)); }
float boardT(float i) { return i < 0.5 ? 4.2 : (i < 1.5 ? 4.36 : (i < 2.5 ? 4.52 : (i < 3.5 ? 7.5 : 10.9))); }
float streetStart(float s) { return s < 0.5 ? 0.0 : (s < 1.5 ? 4.9 : (s < 2.5 ? 8.2 : 11.6)); }
float curStreet() { return lt < 4.9 ? 0.0 : (lt < 8.2 ? 1.0 : (lt < 11.6 ? 2.0 : 3.0)); }
float strength(float k, float s) { float v = 0.10 + H(120.0 + k * 4.0 + s, 9.0); return v * v; }
float isActive(float k) { return lt < foldTime(k) ? 1.0 : 0.0; }
float seatDelay(float k) { vec4 g = seatG(k); return length(g.xy * vec2(0.75, 1.5)) / 0.55; }
// equity of seat k now, 0..1; moves when the pricing wave reaches the seat
float equity(float k) {
  float s = curStreet();
  float del = seatDelay(k);
  float a = eio((lt - streetStart(s) - 0.15 - del) / 0.6);
  float tot = 0.0, mine = 0.0;
  for (int j = 0; j < NS; j++) {
    float fj = float(j);
    float w = mix(strength(fj, max(s - 1.0, 0.0)), strength(fj, s), s < 0.5 ? 1.0 : a) * isActive(fj);
    tot += w;
    if (abs(fj - k) < 0.5) mine = w;
  }
  float e = tot > 0.0 ? mine / tot : 0.0;
  float fin = eio((lt - 14.3 - del) / 0.6);
  float win = abs(k - winner()) < 0.5 ? 1.0 : 0.0;
  float inShow = foldStage(k) > 3.5 ? 1.0 : 0.0;
  return mix(e, win, fin * inShow) * eio((lt - 2.1 - del) / 0.6);
}
float waveAt(float t0, vec2 p) {
  float age = lt - t0;
  if (age < 0.0 || age > 1.6) return 0.0;
  float r = length(p * vec2(0.75, 1.5));
  return exp(-abs(r - age * 0.55) / 0.014) * (1.0 - age / 1.6);
}

// ---------- the camera: a perspective view of the table plane, tilted and yawed by the pointer ----------
vec3 gC, gF, gU;
float gFoc, gS, gPsi;
vec4 planeHit(vec2 s, float z) {
  vec3 rd = normalize(gF * gFoc + vec3(1.0, 0.0, 0.0) * s.x + gU * s.y);
  float t = (z - gC.z) / rd.z;
  vec3 P = gC + rd * t;
  vec2 w = rot(gPsi) * P.xy;
  return vec4(w, t / (gFoc * gS) / sqrt(max(-rd.z, 0.25)), 0.0);
}
// a world point (on a plane at height z) back to screen space (S units, y up)
vec2 proj(vec2 W, float z) {
  vec3 P = vec3(rot(-gPsi) * W, z);
  vec3 v = P - gC;
  return gFoc * vec2(v.x, dot(v, gU)) / dot(v, gF);
}
void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float S = min(uRes.y, uRes.x / 1.45);
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uRes) / S;
  float Tm = mod(uTime, 7200.0) + uSeed * CYC;
  hand = floor(Tm / CYC);
  lt = Tm - hand * CYC;
  vec2 mo = uMouse - 0.5;
  // camera: 60 degrees up from the table, swaying slowly; the pointer yaws and tips it
  gS = S; gFoc = 2.4;
  float phi = 1.047 + 0.05 * sin(Tm * 0.15) + mo.y * 0.10;
  gPsi = 0.05 * sin(Tm * 0.21) + mo.x * 0.26;
  gC = gFoc * vec3(0.0, -cos(phi), sin(phi));
  gF = vec3(0.0, cos(phi), -sin(phi));
  gU = vec3(0.0, sin(phi), cos(phi));
  vec4 h0 = planeHit(p0, 0.0), h1 = planeHit(p0, 0.016), h2 = planeHit(p0, 0.030);
  vec2 p = h0.xy, pc = h1.xy, pa = h2.xy;      // felt, cards and chips, rail hardware
  float px = h0.z, pxc = h1.z, pxa = h2.z;
  float pxs = 1.0 / S;                          // screen pixel (S units)
  vec2 LD = normalize(vec2(-0.45, 0.85));
  vec3 acc = vec3(0.25, 0.80, 0.58);
  vec2 potC = vec2(0.0, 0.118);
  vec2 deck = vec2(0.0, 0.222);
  float cs = curStreet();

  // ===== room, rail, felt =====
  float dF = sdStad(p, LH, RR);
  vec3 col = vec3(0.008, 0.014, 0.014) + vec3(0.014, 0.030, 0.024) * exp(-dot(p0, p0) * 1.3);
  float railW = 0.046;
  col *= 1.0 - 0.8 * exp(-max(dF - railW, 0.0) / 0.06) * step(railW, dF);
  float par = abs(p.x) < LH ? p.x : sign(p.x) * (LH + atan(abs(p.y), abs(p.x) - LH) * (RR + dF));
  if (dF < railW + 0.01) {
    vec2 nrm = normalize(vec2(p.x - clamp(p.x, -LH, LH), p.y) + 1e-5);
    float t = clamp(dF / railW, 0.0, 1.0);
    float face = max(dot(nrm, LD), 0.0);
    vec3 lea = vec3(0.060, 0.040, 0.032) * (0.55 + 1.1 * face * sin(t * PI));
    lea += vec3(0.55, 0.40, 0.28) * pow(face, 2.5) * exp(-pow((t - 0.40) / 0.16, 2.0)) * 0.46;
    lea += vec3(0.10, 0.09, 0.08) * exp(-pow((t - 0.78) / 0.10, 2.0)) * 0.55 * (0.5 + face);
    float dash = smoothstep(0.35, 0.28, abs(fract(par * 95.0) - 0.5)) * smoothstep(px * 1.5, 0.0, abs(dF - railW * 0.58) - 0.0007);
    lea += vec3(0.45, 0.36, 0.26) * dash * 0.55;
    col = mix(col, lea, smoothstep(px * 1.2, 0.0, dF - railW));
    float led = smoothstep(0.0040, 0.0, abs(dF - 0.0028));
    float chase = 0.5 + 0.5 * sin(par * 9.0 - Tm * 1.6);
    col += acc * led * (0.55 + 0.6 * chase) * mix(0.7, 1.2, I) * step(0.0, dF);
  }
  if (dF < 0.0) {
    float fib = h21(floor(gl_FragCoord.xy * 0.8)) * 0.55 + vnoise(p * 330.0) * 0.45;
    float cloud = vnoise(p * 9.0 + 3.0) * 0.5 + vnoise(p * 21.0) * 0.25;
    vec3 felt = mix(vec3(0.018, 0.150, 0.100), vec3(0.055, 0.330, 0.225), cloud);
    felt *= 0.86 + 0.26 * fib;
    float pool = exp(-dot(p * vec2(0.85, 1.6), p * vec2(0.85, 1.6)) * 2.2);
    felt *= 0.34 + 1.20 * pool;
    felt += vec3(0.02, 0.08, 0.055) * pool * 0.7;
    felt += acc * 0.12 * exp(dF / 0.05) * mix(0.6, 1.0, I);
    float bl = smoothstep(px * 1.4, 0.0, abs(dF + 0.085) - 0.0006);
    felt = mix(felt, vec3(0.78, 0.74, 0.60) * (0.30 + 0.5 * pool), bl * 0.55);
    col = felt;
    float wv = waveAt(2.1, p) + waveAt(4.95, p) + waveAt(8.25, p) + waveAt(11.65, p) + waveAt(14.35, p) * 1.6;
    col += acc * wv * 0.38 * mix(0.6, 1.0, I);
  }

  // ===== bets and the pot =====
  for (int k = 0; k < NS; k++) {
    float fk = float(k);
    vec4 sg = seatG(fk);
    vec2 dirk = sg.zw, perp = vec2(-dirk.y, dirk.x);
    vec2 spot = sg.xy + dirk * 0.200;
    if (d2(p - spot) > 0.016) continue;
    float ord = orderOf(fk);
    float fs = foldStage(fk);
    for (int r = 0; r < 4; r++) {
      float fr = float(r);
      if (fs < fr + 0.5) continue;
      float t0 = betT(fr) + 0.12 * ord;
      float t1 = swT(fr) + 0.05 * ord;
      float appear = ease((lt - t0) / 0.45);
      float sweep = eio((lt - t1) / 0.55);
      if (appear <= 0.0 || sweep >= 1.0) continue;
      float nchip = 1.0 + floor(H(200.0 + fk * 4.0 + fr, 1.0) * 3.0);
      vec2 pos = mix(mix(sg.xy + dirk * 0.05, spot, appear), potC, sweep);
      float typ = fr < 0.5 ? 1.0 : (fr < 1.5 ? 2.0 : (fr < 2.5 ? 3.0 : 5.0));
      for (int c = 0; c < 4; c++) {
        float fc = float(c);
        if (fc > nchip - 0.5) break;
        vec2 cp = pos + vec2(0.0014 * fc, 0.0052 * fc) * (1.0 - sweep) + perp * (fr - 1.5) * 0.020 * (1.0 - sweep);
        col *= 1.0 - 0.45 * smoothstep(0.022, 0.0, length(p - cp - vec2(0.004, -0.005))) * (1.0 - sweep * 0.8);
        vec4 ch = chip(p - cp, 0.021 * (1.0 - 0.35 * sweep), typ, px);
        col = mix(col, ch.rgb, ch.a * (1.0 - sweep));
      }
    }
  }
  {
    float potCount = 0.0;
    for (int r = 0; r < 4; r++) {
      float fr = float(r);
      float done = step(swT(fr) + 0.55, lt);
      float inRound = 0.0;
      for (int k = 0; k < NS; k++) inRound += foldStage(float(k)) > fr + 0.5 ? 1.0 : 0.0;
      potCount += done * inRound * 1.6;
    }
    potCount = min(floor(potCount), 12.0);
    float aw = eio((lt - 15.0) / 0.9);
    vec4 wsg = seatG(winner());
    vec2 pc2 = mix(potC, wsg.xy + wsg.zw * 0.05, aw);
    if (d2(p - pc2) < 0.012 && potCount > 0.5 && lt < 16.0) {
      for (int j = 0; j < 12; j++) {
        float fj = float(j);
        if (fj > potCount - 0.5) break;
        vec2 off = (vec2(H(300.0 + fj, 2.0), H(320.0 + fj, 3.0)) - 0.5) * vec2(0.075, 0.032) * (1.0 - 0.5 * aw);
        vec2 cp = pc2 + off + vec2(0.0, 0.0045 * floor(fj / 4.0));
        float typ = floor(H(340.0 + fj, 4.0) * 6.0);
        col *= 1.0 - 0.42 * smoothstep(0.022, 0.0, length(p - cp - vec2(0.004, -0.005)));
        vec4 ch = chip(p - cp, 0.020, typ, px);
        col = mix(col, ch.rgb, ch.a * (1.0 - smoothstep(0.7, 1.0, aw)));
      }
    }
  }

  // ===== hole cards =====
  float endSlide = eio((lt - 16.8) / 0.8);
  for (int k = 0; k < NS; k++) {
    float fk = float(k);
    vec4 sg = seatG(fk);
    vec2 dirk = sg.zw, perp = vec2(-dirk.y, dirk.x);
    vec2 base = sg.xy + dirk * 0.104;
    float ord = orderOf(fk);
    float fs = foldStage(fk);
    float tf = foldTime(fk);
    float hero = fk < 0.5 ? 1.0 : 0.0;
    float W = hero > 0.5 ? 0.062 : 0.050;
    float rot0 = dirk.y > 0.5 ? 0.0 : (dirk.y < -0.5 ? PI : (dirk.x > 0.5 ? -PI * 0.5 : PI * 0.5));
    if (lt > 3.4 && d2(pc - base) > 0.0036 && lt < 17.0 && lt > tf + 0.7) continue;
    for (int c = 0; c < 2; c++) {
      float fc = float(c);
      float td = 0.7 + (fc * 7.0 + ord) * 0.085;
      float u = ease((lt - td) / 0.42);
      if (u <= 0.0) continue;
      float side = fc * 2.0 - 1.0;
      vec2 tgt = base + perp * side * W * 0.40 * (hero > 0.5 ? 1.15 : 1.0);
      float trot = side * 0.13 + rot0;
      float lift = sin(u * PI);
      vec2 pos = mix(deck, tgt, u) + vec2(0.0, 0.05 * lift);
      float rt = mix(side * 2.2 + 1.2, trot, u);
      float fo = eio((lt - tf) / 0.5);
      pos = mix(pos, mix(tgt, potC * 0.4, 0.5), fo);
      pos = mix(pos, deck, endSlide);
      float flip = 0.0;
      if (hero > 0.5) flip = eio((lt - td - 0.45) / 0.35);
      if (fs > 3.5) flip = max(flip, eio((lt - 14.0 - ord * 0.06 - fc * 0.1) / 0.4));
      float vis = (1.0 - fo) * (1.0 - endSlide);
      if (vis <= 0.003) continue;
      vec2 q = rot(-rt) * (pc - pos);
      float shadow = cardShadow(rot(-rt) * (p - pos - vec2(0.004 + 0.012 * lift, -0.006 - 0.014 * lift)), W, 0.007 + 0.01 * lift);
      col *= 1.0 - shadow * vis;
      vec4 cd = card(q, W * (0.85 + 0.15 * u) * (1.0 - 0.15 * fo), flip, holeCard(fk, fc), pxc);
      col = mix(col, cd.rgb, cd.a * vis);
    }
  }

  // ===== deck and board =====
  {
    for (int j = 0; j < 4; j++) {
      float fj = float(j);
      vec2 q = pc - deck - vec2(-0.0012, 0.0018) * fj;
      vec4 cd = card(q, 0.058, 0.0, vec2(0.0), pxc);
      if (j == 0) col *= 1.0 - cardShadow(p - deck - vec2(0.006, -0.01), 0.058, 0.01);
      col = mix(col, cd.rgb * (0.7 + 0.1 * fj), cd.a);
    }
  }
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float t0 = boardT(fi);
    float u = ease((lt - t0) / 0.40);
    if (u <= 0.0 || endSlide >= 1.0) continue;
    vec2 tgt = vec2((fi - 2.0) * 0.092, 0.0);
    float lift = sin(u * PI);
    vec2 pos = mix(mix(deck, tgt, u), deck, endSlide);
    float flip = eio((lt - t0 - 0.40) / 0.45);
    float W = 0.074;
    float vis = 1.0 - endSlide;
    col *= 1.0 - cardShadow(p - pos - vec2(0.005 + 0.012 * lift, -0.007 - 0.012 * lift), W, 0.008 + 0.01 * lift) * vis;
    vec4 cd = card(rot(-(1.0 - u) * 0.9 * (mod(fi, 2.0) * 2.0 - 1.0)) * (pc - pos), W, flip, boardCard(fi), pxc);
    col = mix(col, cd.rgb, cd.a * vis);
    float rd = smoothstep(t0 + 0.7, t0 + 0.95, lt) * (1.0 - smoothstep(t0 + 1.5, t0 + 2.0, lt));
    if (rd > 0.0) {
      vec2 hb = vec2(W * 0.5 + 0.010, W * 0.7 + 0.010);
      vec2 ad = abs(pc - tgt), e = abs(ad - hb);
      float lv = smoothstep(pxc * 1.4, 0.0, e.x - 0.0008) * step(ad.y, hb.y + 0.0008) * step(hb.y - ad.y, 0.017);
      float lh = smoothstep(pxc * 1.4, 0.0, e.y - 0.0008) * step(ad.x, hb.x + 0.0008) * step(hb.x - ad.x, 0.017);
      col += acc * max(lv, lh) * rd;
    }
  }

  // ===== dealer button =====
  {
    vec4 sg = seatG(dealer());
    vec2 dirk = sg.zw, perp = vec2(-dirk.y, dirk.x);
    vec2 bp = sg.xy + dirk * 0.135 + perp * 0.10;
    float pop = ease((lt - 0.1) / 0.5);
    vec2 q = pc - bp;
    float r = length(q);
    col *= 1.0 - 0.5 * smoothstep(0.03, 0.0, length(p - bp - vec2(0.004, -0.005))) * pop;
    float a = smoothstep(pxc * 1.2, -pxc * 0.4, r - 0.0165 * pop);
    vec3 bc = mix(vec3(0.95, 0.93, 0.86), vec3(0.78, 0.72, 0.6), smoothstep(0.0, 0.0165, r));
    bc = mix(bc, vec3(0.10, 0.10, 0.11), fChar(q / 0.0030 + vec2(2.5, 3.5), ${C('D')}, 0.0030 / pxc));
    col = mix(col, bc, a);
  }

  // ===== seats: avatar, equity ring (on the rail), billboard readouts =====
  for (int k = 0; k < NS; k++) {
    float fk = float(k);
    vec4 sg = seatG(fk);
    vec2 ap = sg.xy;
    vec2 dirk = sg.zw;
    float hero = fk < 0.5 ? 1.0 : 0.0;
    float R = hero > 0.5 ? 0.040 : 0.034;
    float act = isActive(fk);
    float e = equity(fk) * act;
    vec3 ac = hero > 0.5 ? vec3(0.98, 0.76, 0.34) : acc;
    float win = abs(fk - winner()) < 0.5 ? 1.0 : 0.0;
    vec2 q = pa - ap;
    if (d2(q) < 0.0144) {
      float r = length(q);
      col *= 1.0 - 0.55 * smoothstep(R + 0.03, R * 0.6, length(p - ap - vec2(0.004, -0.006)));
      float base = smoothstep(pxa * 1.2, -pxa * 0.4, r - R);
      vec3 bc = mix(vec3(0.020, 0.028, 0.030), vec3(0.090, 0.115, 0.12), smoothstep(R, -R * 0.3, q.y + q.x * 0.4));
      bc += vec3(0.05) * smoothstep(pxa * 1.5, 0.0, abs(r - R * 0.72) - pxa * 0.3);
      col = mix(col, bc, base);
      float ra = abs(r - (R + 0.0085));
      float ang = fract(atan(q.x, q.y) / TAU + 1.0);
      float track = smoothstep(0.0028 + pxa, 0.0028 - pxa, ra);
      col += vec3(0.14, 0.18, 0.17) * track * 0.55 * (0.4 + 0.6 * act);
      float arc = smoothstep(0.0034 + pxa, 0.0034 - pxa, ra) * step(ang, e) * act;
      float pulse = win * smoothstep(15.0, 15.6, lt) * (1.0 - smoothstep(17.0, 18.0, lt)) * (0.5 + 0.5 * sin(Tm * 6.0));
      col = mix(col, ac * (1.0 + 0.5 * pulse), arc);
      col += ac * exp(-max(ra - 0.003, 0.0) / 0.008) * 0.22 * step(ang, e) * act;
      float ha = e * TAU;
      col += ac * exp(-length(q - (R + 0.0085) * vec2(sin(ha), cos(ha))) / 0.006) * 0.6 * act * step(0.01, e);
    }
    // billboards: the seat number inside the puck, the equity readout beside it
    vec2 sa = proj(ap, 0.03);
    vec2 sq = (p0 - sa) / 0.0030 + vec2(2.5, 3.5);
    col = mix(col, vec3(0.86, 0.92, 0.90) * (0.35 + 0.65 * act), fChar(sq, ${C('1')} + fk, 0.0030 / pxs) * 0.95);
    vec2 side = abs(dirk.x) > 0.5 ? vec2(0.0, -1.0) : dirk * -1.0;
    vec2 ra2 = proj(ap + side * (R + 0.050), 0.03);
    float pct = floor(e * 100.0 + 0.5);
    float t10 = floor(pct / 10.0), t1 = pct - t10 * 10.0;
    float fsz = 0.0030;
    vec2 rq = (p0 - ra2) / fsz + vec2(8.5, 3.5);
    float txt = 0.0;
    if (rq.x > -2.0 && rq.x < 20.0 && rq.y > -1.0 && rq.y < 9.0) {
      if (act > 0.5) {
        if (pct >= 100.0) {
          txt = fChar(rq - vec2(-3.0, 0.0), ${C('1')}, fsz / pxs) + fChar(rq - vec2(3.0, 0.0), ${C('0')}, fsz / pxs) + fChar(rq - vec2(9.0, 0.0), ${C('0')}, fsz / pxs) + fChar(rq - vec2(15.0, 0.0), ${C('%')}, fsz / pxs);
        } else {
          txt = (t10 > 0.5 ? fChar(rq, ${C('0')} + t10, fsz / pxs) : 0.0) + fChar(rq - vec2(6.0, 0.0), ${C('0')} + t1, fsz / pxs) + fChar(rq - vec2(12.0, 0.0), ${C('%')}, fsz / pxs);
        }
      } else {
        txt = fText(rq - vec2(-1.5, 0.0), ${T('FOLD')}, fsz / pxs);
      }
    }
    col = mix(col, mix(vec3(0.60, 0.68, 0.66), ac * 1.1, 0.8 * act) * (0.55 + 0.45 * act), clamp(txt, 0.0, 1.0));
    if (win > 0.5 && lt > 15.3 && lt < 18.5) {
      float age = lt - 15.3;
      for (int j = 0; j < 14; j++) {
        float fj = float(j);
        float a2 = fj * 2.39996 + H(500.0, fj) * 0.6;
        float sp = 0.10 + 0.12 * H(501.0, fj);
        vec2 sqq = pa - ap - vec2(cos(a2), sin(a2)) * (R + sp * (1.0 - exp(-age * 2.2)) * 1.3) - vec2(0.0, -0.02 * age * age);
        float life = exp(-age * 1.3) * (0.6 + 0.4 * sin(age * 18.0 + fj * 3.0));
        col += ac * exp(-length(sqq) / 0.0045) * life * 0.9;
      }
    }
  }

  // ===== placard: the EV of every option, as bars (screen space) =====
  {
    vec2 o = vec2(-0.715, 0.442);
    vec2 sz = vec2(0.282, 0.150);
    vec2 q = p0 - o - vec2(sz.x * 0.5, -sz.y * 0.5);
    float d = sdBox(q, sz * 0.5, 0.012);
    col = mix(col, col * 0.30 + vec3(0.006, 0.022, 0.016), smoothstep(pxs, -pxs, d) * 0.93);
    col += acc * smoothstep(pxs * 1.5, 0.0, abs(d) - pxs * 0.4) * 0.40;
    float u = 0.0026;
    col = mix(col, vec3(0.84, 0.92, 0.89), fText((p0 - o - vec2(0.014, -0.0215)) / u, ${T('TABLE MODEL')}, u / pxs));
    float ev0 = 0.18 + 0.20 * H(400.0, 0.0), ev1 = 0.30 + 0.30 * H(401.0, 1.0), ev2 = 0.25 + 0.5 * H(402.0, 2.0);
    float sw = eio((lt - streetStart(cs) - 0.2) / 0.9);
    float best = ev2 > ev1 ? 2.0 : 1.0;
    if (cs > 2.5 && H(403.0, 0.0) < 0.35) best = 0.0;
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      float v = fj < 0.5 ? ev0 : (fj < 1.5 ? ev1 : ev2);
      v = mix(v * 0.2, v, sw);
      float rowy = o.y - 0.058 - fj * 0.030;
      float isb = abs(fj - best) < 0.5 ? 1.0 : 0.0;
      vec2 lq = (p0 - vec2(o.x + 0.014, rowy - 0.0092)) / u;
      float lab = fj < 0.5 ? fText(lq, ${T('FOLD')}, u / pxs) : (fj < 1.5 ? fText(lq, ${T('CALL')}, u / pxs) : fText(lq, ${T('RAISE')}, u / pxs));
      col = mix(col, mix(vec3(0.58, 0.66, 0.64), acc * 1.2, isb), lab);
      vec2 bq = p0 - vec2(o.x + 0.014 + 0.090, rowy);
      float bw = 0.150;
      float track = smoothstep(pxs, -pxs, sdBox(bq - vec2(bw * 0.5, 0.0), vec2(bw * 0.5, 0.0045), 0.002));
      float bd = sdBox(bq - vec2(bw * v * 0.5, 0.0), vec2(bw * v * 0.5, 0.0045), 0.002);
      col = mix(col, vec3(0.10, 0.17, 0.15), track * 0.9);
      col = mix(col, mix(vec3(0.45, 0.56, 0.54), acc * 1.2, isb), smoothstep(pxs, -pxs, bd));
      col += acc * isb * exp(-max(bd, 0.0) / 0.006) * 0.15 * sw;
    }
  }

  // ===== street ticker, bottom-right =====
  {
    float u = 0.0026;
    vec2 tq = (p0 - vec2(0.405, -0.462)) / u;
    for (int s = 0; s < 4; s++) {
      float fs2 = float(s);
      float on = abs(cs - fs2) < 0.5 ? 1.0 : 0.0;
      vec2 sq = tq - vec2(fs2 < 0.5 ? 0.0 : (fs2 < 1.5 ? 25.0 : (fs2 < 2.5 ? 55.0 : 85.0)), 0.0);
      float lab = fs2 < 0.5 ? fText(sq, ${T('PRE')}, u / pxs) : (fs2 < 1.5 ? fText(sq, ${T('FLOP')}, u / pxs) : (fs2 < 2.5 ? fText(sq, ${T('TURN')}, u / pxs) : fText(sq, ${T('RIVER')}, u / pxs)));
      col = mix(col, mix(vec3(0.40, 0.47, 0.45), acc * 1.15, on), lab * (0.7 + 0.3 * on));
    }
  }

  // ===== dust in the lamp light =====
  {
    float lamp = exp(-dot(p0 * vec2(0.9, 1.3), p0 * vec2(0.9, 1.3)) * 2.2);
    for (int L = 0; L < 2; L++) {
      float fl = float(L);
      vec2 g = (p0 - mo * 0.05 * (1.0 + fl)) * (13.0 + 9.0 * fl) + vec2(0.0, -Tm * (0.16 + 0.10 * fl)) + fl * 7.3;
      vec2 id = floor(g), f = fract(g) - 0.5;
      float r = h21(id + fl * 13.0);
      vec2 off = (vec2(h21(id + 1.7), h21(id + 4.3)) - 0.5) * 0.6 + vec2(0.15 * sin(Tm * 0.7 + r * 30.0), 0.0);
      float tw = 0.5 + 0.5 * sin(Tm * (1.0 + r * 2.0) + r * 40.0);
      col += vec3(0.75, 1.0, 0.88) * smoothstep(0.075, 0.0, length(f - off)) * step(0.80, r) * tw * lamp * 0.55 * (0.5 + 0.5 * I);
    }
  }

  // ===== grade =====
  col = col / (1.0 + 0.18 * max(col - 0.85, 0.0));
  float vig = smoothstep(1.35, 0.30, length(p0 * vec2(0.8, 1.05)));
  col *= 0.45 + 0.55 * vig;
  col += (h21(gl_FragCoord.xy + fract(uTime * 11.7) * 193.0) - 0.5) * (0.02 + 0.018 * I);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
}
export default reel
