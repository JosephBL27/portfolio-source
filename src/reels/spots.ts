import type { ReelDef } from './types'
import { FONT_GLSL, T, C, W } from './font'
import { CARD_GLSL } from './cards'

// Spots: Hand Compass as an instrument. A spot is dealt into the middle of a 240 degree dial, the
// answer stays LOCKED while a cursor hops over FOLD / CALL / RAISE, then the choice is committed and
// the five-step scale (Best Move, Good Move, Inaccuracy, Mistake, Blunder) is swept end to end by a
// radar wedge before the marker springs back onto the actual grade, which names itself on the right.
// Step list on the left follows the app's pipeline (Deal, Commit, Solve, Grade); the tag (SOLVED,
// HEURISTIC, EXACT MATH) are the three labels the app uses for where a grade comes from.
// Spots, choices and grades are simulated: the grade order cycles through all five.
// GLSL ES 1.00, no textures; the only loops are the 5-slot sparks and 3 chips.
const f1 = (n: number) => n.toFixed(1)
const reel: ReelDef = {
  id: 'spots',
  projectId: 'hand-compass',
  title: 'Spots',
  medium: 'A simulated spot graded on the app’s five-step scale, Best Move to Blunder',
  colors: { bg: '#05060A', ink: '#F1EBDA', accent: '#3FBF8A' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;
${FONT_GLSL}
${CARD_GLSL}
#define CYC 12.0
#define DCX 0.0
#define DCY 0.012
#define RO 0.340
#define RI 0.282
#define A0 -2.0944
#define ASPAN 4.18879

float cyc;
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
float H(float a, float b) { return h21(vec2(a + cyc * 13.17, b + 5.3 + cyc * 0.71)); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float ease(float x) { x = clamp(x, 0.0, 1.0); return 1.0 - pow(1.0 - x, 3.0); }
float eio(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }

vec3 gcol(float i) {
  if (i < 0.5) return vec3(0.16, 0.84, 0.54);
  if (i < 1.5) return vec3(0.64, 0.88, 0.26);
  if (i < 2.5) return vec3(0.98, 0.80, 0.22);
  if (i < 3.5) return vec3(0.98, 0.52, 0.17);
  return vec3(0.95, 0.26, 0.26);
}
// scale position 0..1 -> colour, continuous
vec3 gramp(float f) {
  float x = clamp(f, 0.0, 1.0) * 5.0 - 0.5;
  float i = clamp(floor(x), 0.0, 3.0);
  return mix(gcol(i), gcol(i + 1.0), smoothstep(0.35, 0.65, clamp(x - i, 0.0, 1.0)));
}
float gWidth(float i) { return i < 0.5 ? ${f1(W('BEST MOVE'))} : (i < 1.5 ? ${f1(W('GOOD MOVE'))} : (i < 2.5 ? ${f1(W('INACCURACY'))} : (i < 3.5 ? ${f1(W('MISTAKE'))} : ${f1(W('BLUNDER'))}))); }
float gLab(vec2 q, float i, float sc) {
  if (i < 0.5) return fText(q, ${T('BEST MOVE')}, sc);
  if (i < 1.5) return fText(q, ${T('GOOD MOVE')}, sc);
  if (i < 2.5) return fText(q, ${T('INACCURACY')}, sc);
  if (i < 3.5) return fText(q, ${T('MISTAKE')}, sc);
  return fText(q, ${T('BLUNDER')}, sc);
}
// a word that scrambles then resolves left to right (prog 0..1)
float fScr(vec2 q, vec4 s, float n, float sc, float prog) {
  float i = floor(q.x / 6.0);
  if (i < 0.0 || i >= n || q.y < -0.6 || q.y > 7.6) return 0.0;
  float code = fCode(s, i);
  if (code > 0.5 && i + 0.5 > prog * n) code = ${C('A')} + floor(h21(vec2(i, floor(uTime * 22.0) + cyc)) * 26.0);
  return fChar(vec2(q.x - i * 6.0, q.y), code, sc);
}
float gWord(vec2 q, float i, float sc, float prog) {
  if (i < 0.5) return fScr(q, ${T('BEST MOVE')}, sc, prog);
  if (i < 1.5) return fScr(q, ${T('GOOD MOVE')}, sc, prog);
  if (i < 2.5) return fScr(q, ${T('INACCURACY')}, sc, prog);
  if (i < 3.5) return fScr(q, ${T('MISTAKE')}, sc, prog);
  return fScr(q, ${T('BLUNDER')}, sc, prog);
}

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float S = min(uRes.y, uRes.x / 1.45);
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uRes) / S;
  float px = 1.0 / S;
  vec2 mo = uMouse - 0.5;
  float Tm = mod(uTime, 3600.0) + uSeed * CYC;
  cyc = floor(Tm / CYC);
  lt = Tm - cyc * CYC;

  // the spot of this cycle
  float grade = mod(cyc * 2.0 + floor(uSeed * 5.0), 5.0);
  float chosen = floor(H(1.0, 0.0) * 3.0);
  float tag = H(2.0, 0.0) < 0.62 ? 0.0 : (H(3.0, 0.0) < 0.5 ? 1.0 : 2.0);
  // phases
  float tCommit = 3.25, tWipe0 = 3.35, tWipe1 = 4.75, tSettle = 4.75;
  float wipe = eio((lt - tWipe0) / (tWipe1 - tWipe0));
  float gF = (grade + 0.5) / 5.0;
  float k = clamp((lt - tSettle) / 1.0, 0.0, 1.0);
  float revealed = step(tWipe0, lt);
  float fm = lt < tSettle ? wipe : (gF + (1.0 - gF) * exp(-5.0 * k) * cos(10.0 * k));
  float settle = eio((lt - 5.4) / 0.8);
  float out0 = eio((lt - 11.0) / 0.9);

  vec2 DC = vec2(DCX, DCY) + mo * 0.012;
  vec2 q = p0 - DC;
  float r = length(q);
  float ang = atan(q.x, q.y);
  float f = (ang - A0) / ASPAN;

  // ===== ground: a compass rose, quietly turning =====
  vec3 col = vec3(0.010, 0.012, 0.018) + vec3(0.012, 0.016, 0.026) * exp(-dot(p0, p0) * 1.1);
  {
    float rr = r;
    float roseA = ang / 6.2831853 + Tm * 0.004;
    float tk = abs(fract(roseA * 72.0 + 0.5) - 0.5) * 6.2831853 * rr / 72.0;
    float major = step(abs(fract(roseA * 8.0 + 0.5) - 0.5), 0.0125);
    float band = smoothstep(0.455, 0.46, rr) * smoothstep(0.50 + 0.025 * major, 0.495 + 0.025 * major, rr);
    col += vec3(0.30, 0.34, 0.42) * smoothstep(px * 1.2 + 0.0004, 0.0, tk - 0.0004) * band * 0.45;
    for (int j = 0; j < 4; j++) {
      float fj = float(j);
      float rj = 0.455 + fj * 0.14 + (fj > 0.5 ? 0.0 : 0.0);
      col += vec3(0.26, 0.30, 0.40) * smoothstep(px * 1.4, 0.0, abs(rr - rj) - 0.0003) * (0.20 - 0.03 * fj);
    }
    // reticle
    float ax = min(abs(q.x), abs(q.y));
    col += vec3(0.24, 0.28, 0.36) * smoothstep(px * 1.2, 0.0, ax - 0.0002) * smoothstep(0.36, 0.5, rr) * 0.22;
  }

  // ===== the plate =====
  {
    float plate = smoothstep(px * 1.4, 0.0, r - (RO + 0.040));
    vec3 pc = mix(vec3(0.022, 0.026, 0.036), vec3(0.050, 0.056, 0.072), smoothstep(0.30, 0.46, r));
    pc += vec3(0.05, 0.055, 0.07) * smoothstep(px * 1.6, 0.0, abs(r - (RO + 0.038)) - 0.0008);
    pc *= 0.85 + 0.25 * vnoise(q * 90.0) * smoothstep(0.34, 0.2, r);
    col = mix(col, pc, plate);
  }
  vec3 amb = gcol(grade) * settle * (1.0 - out0);
  col += amb * exp(-max(r - RO, 0.0) / 0.12) * 0.10 * smoothstep(0.0, 0.2, r);

  // ===== the five-step ring =====
  float inRing = step(RI - 0.005, r) * step(r, RO + 0.005);
  if (inRing > 0.5 && f > -0.01 && f < 1.01) {
    float fi = clamp(f, 0.0, 0.9999);
    float si = floor(fi * 5.0);
    float u = fi * 5.0 - si;
    float segLen = ASPAN / 5.0 * r;
    float gap = smoothstep(0.0020, 0.0020 + px * 1.2, min(u, 1.0 - u) * segLen);
    float v = (r - RI) / (RO - RI);
    float edge = smoothstep(0.0, px * 1.5 / (RO - RI), v) * smoothstep(1.0, 1.0 - px * 1.5 / (RO - RI), v);
    vec3 sc = gcol(si);
    // lit state: dim and locked, then swept, then the grade stays bright
    float lock = 0.10 + 0.05 * sin(fi * 60.0 - Tm * 3.0) * (1.0 - revealed);
    float sweptOn = smoothstep(wipe + 0.012, wipe - 0.012, f) * revealed;
    float isG = abs(si - grade) < 0.5 ? 1.0 : 0.0;
    float keep = mix(1.0, mix(0.22, 1.0, isG), settle);
    float lit = mix(lock, 1.0, sweptOn) * mix(1.0, keep, step(tSettle, lt));
    lit = mix(lit, lock, out0);
    // bevel from a light up and to the left
    vec2 rd = q / max(r, 1e-4);
    float shade = 0.70 + 0.55 * clamp((2.0 * v - 1.0) * dot(rd, normalize(vec2(-0.5, 0.85))), -1.0, 1.0) + 0.0;
    float spec = pow(max((2.0 * v - 1.0) * dot(rd, normalize(vec2(-0.5, 0.85))), 0.0), 3.0) * 0.4;
    vec3 c = sc * (0.35 + 0.95 * lit) * shade + vec3(1.0, 0.97, 0.9) * spec * lit;
    c += sc * 0.55 * isG * settle * (0.65 + 0.35 * sin(Tm * 4.0)) * smoothstep(0.7, 0.2, abs(v - 0.5) * 2.0);
    // the sweep head burns white
    float head = exp(-abs(f - wipe) / 0.012) * revealed * step(lt, tWipe1 + 0.15);
    c += vec3(1.0, 0.95, 0.85) * head * 0.9;
    // the ring sits in the plate: an inner groove each side
    c *= 0.82 + 0.18 * smoothstep(0.0, 0.14, v) * smoothstep(1.0, 0.86, v);
    col = mix(col, c, edge * gap);
  }
  // fine ticks inside the ring (101 steps), longer every tenth
  {
    float tf = f * 100.0;
    float ti = floor(tf + 0.5);
    float dx = abs(tf - ti) * ASPAN / 100.0 * r;
    float major = step(abs(mod(ti, 10.0)), 0.5);
    float rlo = RI - 0.014 - 0.008 * major, rhi = RI - 0.004;
    float on = step(0.0, ti) * step(ti, 100.0) * step(rlo, r) * step(r, rhi);
    float tickLit = mix(0.25, 1.0, step(ti / 100.0, wipe) * revealed);
    col += vec3(0.62, 0.68, 0.78) * smoothstep(px * 1.2 + 0.0005, 0.0, dx - 0.0004) * on * tickLit * 0.7;
  }
  // light bleeding out of the ring onto the plate
  {
    float fi = clamp(f, 0.0, 0.9999);
    float si = floor(fi * 5.0);
    float sweptOn = smoothstep(wipe + 0.01, wipe - 0.01, f) * revealed;
    float isG = abs(si - grade) < 0.5 ? 1.0 : 0.0;
    float lit = sweptOn * mix(1.0, mix(0.15, 1.0, isG), settle) * (1.0 - out0);
    float inA = step(-0.01, f) * step(f, 1.01);
    col += gcol(si) * exp(-max(r - RO, 0.0) / 0.03) * step(RO, r) * lit * 0.20 * inA;
    col += gcol(si) * exp(-max(RI - r, 0.0) / 0.05) * step(r, RI) * lit * 0.12 * inA;
  }

  // ===== the radar wedge and the needle line =====
  {
    float aM = A0 + fm * ASPAN;
    float da = aM - ang;
    float inA = step(0.0, da) * step(f, 1.01);
    float tailLen = 0.45;
    float wedge = exp(-da / tailLen) * inA * smoothstep(RI - 0.02, RI - 0.2, r) * smoothstep(0.02, 0.12, r);
    float actv = revealed * (1.0 - smoothstep(tSettle + 0.9, tSettle + 1.5, lt));
    col += gramp(fm) * wedge * 0.20 * actv;
    // needle: a hairline from the ring toward the middle, behind the cards
    float nd = abs(sin(ang - aM)) * r;
    float nOn = step(r, RI) * step(0.05, r) * step(0.0, dot(q, vec2(sin(aM), cos(aM))));
    float nlife = revealed * (1.0 - out0);
    col += gramp(fm) * smoothstep(px * 1.2, 0.0, nd - 0.0006) * nOn * smoothstep(0.05, 0.25, r) * 0.55 * nlife;
  }

  // ===== interior: a little table =====
  {
    float inside = smoothstep(px * 1.2, 0.0, r - (RI - 0.018));
    vec3 ic = vec3(0.012, 0.014, 0.020) + vec3(0.02, 0.025, 0.035) * smoothstep(0.28, 0.0, r);
    ic += vec3(0.05, 0.09, 0.07) * exp(-r * 9.0) * 0.4;
    ic += amb * 0.10 * smoothstep(0.1, 0.27, r);
    // concentric engraving
    ic += vec3(0.07, 0.08, 0.10) * smoothstep(px * 1.4, 0.0, abs(r - 0.205) - 0.0003) * 0.7;
    ic += vec3(0.07, 0.08, 0.10) * smoothstep(px * 1.4, 0.0, abs(r - 0.145) - 0.0003) * 0.5;
    col = mix(col, ic, inside * step(r, RI));
    // the beam lives above this base; cards come after the wedge below
  }

  // wedge and needle were drawn on the plate; repaint them over the interior so they show
  {
    float aM = A0 + fm * ASPAN;
    float da = aM - ang;
    float inA = step(0.0, da) * step(f, 1.01);
    float wedge = exp(-da / 0.45) * inA * smoothstep(RI - 0.02, RI - 0.2, r) * smoothstep(0.02, 0.12, r);
    float actv = revealed * (1.0 - smoothstep(tSettle + 0.9, tSettle + 1.5, lt));
    col += gramp(fm) * wedge * 0.20 * actv * step(r, RI);
    float nd = abs(sin(ang - aM)) * r;
    float nOn = step(r, RI) * step(0.05, r) * step(0.0, dot(q, vec2(sin(aM), cos(aM))));
    col += gramp(fm) * smoothstep(px * 1.2, 0.0, nd - 0.0006) * nOn * smoothstep(0.05, 0.25, r) * 0.55 * revealed * (1.0 - out0);
  }

  // ===== cards: the flop above, the hero's two cards fanned below =====
  float cardsOut = out0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float t0 = 0.15 + fi * 0.15;
    float u = ease((lt - t0) / 0.5);
    if (u <= 0.0 || cardsOut >= 1.0) continue;
    vec2 tgt = DC + vec2((fi - 1.0) * 0.080, 0.092);
    vec2 pos = mix(tgt + vec2(0.0, 0.34), tgt, u);
    float flip = eio((lt - t0 - 0.35) / 0.4);
    float Wc = 0.066;
    float lift = sin(u * PI);
    vec2 rel = p0 - pos;
    col *= 1.0 - cardShadow(rel - vec2(0.004 + 0.01 * lift, -0.005 - 0.01 * lift), Wc, 0.006 + 0.01 * lift) * (1.0 - cardsOut);
    vec4 cd = card(rot(-(1.0 - u) * 0.8 * (fi - 1.0)) * rel, Wc, flip, vec2(floor(H(10.0 + fi, 1.0) * 13.0), floor(H(20.0 + fi, 2.0) * 4.0)), px);
    col = mix(col, cd.rgb, cd.a * (1.0 - cardsOut));
  }
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float t0 = 0.75 + fi * 0.18;
    float u = ease((lt - t0) / 0.55);
    if (u <= 0.0 || cardsOut >= 1.0) continue;
    float spread = mix(0.0, 0.34, u);
    float th = (fi - 0.5) * spread;
    vec2 pivot = DC + vec2(0.0, -0.228);
    vec2 pos = pivot + 0.142 * vec2(sin(th), cos(th));
    pos.y -= (1.0 - u) * 0.22;
    float flip = eio((lt - t0 - 0.45) / 0.4);
    float Wc = 0.098;
    vec2 rel = p0 - pos;
    col *= 1.0 - cardShadow(rot(th) * (rel - vec2(0.005, -0.008)), Wc, 0.009) * (1.0 - cardsOut);
    vec4 cd = card(rot(th) * rel, Wc, flip, vec2(floor(H(30.0 + fi, 3.0) * 13.0), floor(H(40.0 + fi, 4.0) * 4.0)), px);
    col = mix(col, cd.rgb, cd.a * (1.0 - cardsOut));
  }

  // ===== marker on the ring =====
  {
    float aM = A0 + fm * ASPAN;
    vec2 mp = DC + (RI + RO) * 0.5 * vec2(sin(aM), cos(aM));
    float md = length(p0 - mp);
    float vis = revealed * (1.0 - out0);
    vec3 mc = gramp(fm);
    col += mc * exp(-md / 0.016) * 0.85 * vis;
    col = mix(col, vec3(1.0, 0.98, 0.94), smoothstep(px * 1.3, 0.0, md - 0.0075) * vis);
    // pointer wedge on the inside edge
    vec2 rl = rot(aM) * (p0 - DC);                      // y up along the marker's radius
    float tri = max(abs(rl.x) * 1.6 + (rl.y - (RI - 0.030)) * 1.0 - 0.0, 0.0);
    float tr = smoothstep(px * 1.3, 0.0, max(abs(rl.x) * 1.5 + (RI - 0.004 - rl.y) * 0.0 + (rl.y - (RI - 0.004)) * 1.0, -(rl.y - (RI - 0.034)))) ;
    col += vec3(1.0) * tr * vis * 0.0;
    float pw = 0.0;
    pw = smoothstep(px * 1.3, 0.0, max(abs(rl.x) - (rl.y - (RI - 0.036)) * 0.55, max((RI - 0.036) - rl.y, rl.y - (RI - 0.006))));
    col = mix(col, vec3(1.0, 0.98, 0.94), pw * vis);
  }

  // ===== labels around the dial =====
  {
    float u = 0.0028;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float a = A0 + (fi + 0.5) / 5.0 * ASPAN;
      vec2 anc = DC + (RO + 0.062) * vec2(sin(a), cos(a));
      float w = gWidth(fi) * u;
      float al = 0.5 - 0.5 * sin(a);
      al = clamp(al * 1.1 - 0.05, 0.0, 1.0);
      vec2 org = anc - vec2(al * w, 0.5 * 7.0 * u - (cos(a) < 0.0 ? 0.0 : 0.0));
      float lab = gLab((p0 - org) / u, fi, u / px);
      float isG = abs(fi - grade) < 0.5 ? 1.0 : 0.0;
      float on = mix(0.38, 1.0, isG * settle);
      on = mix(on, 0.38, out0);
      vec3 lc = mix(vec3(0.62, 0.68, 0.78), gcol(fi) * 1.1, isG * settle);
      col = mix(col, lc * mix(0.85, 1.1, isG * settle), lab * on);
    }
  }

  // ===== left: the pipeline steps =====
  {
    float u = 0.0032;
    float stepNow = lt < 1.8 ? 0.0 : (lt < tWipe0 ? 1.0 : (lt < 4.9 ? 2.0 : 3.0));
    float x0 = -0.700;
    for (int j = 0; j < 4; j++) {
      float fj = float(j);
      float y = -0.112 - fj * 0.056;
      float on = abs(fj - stepNow) < 0.5 ? 1.0 : 0.0;
      float done = fj < stepNow - 0.5 ? 1.0 : 0.0;
      vec2 lq = (p0 - vec2(x0 + 0.030, y - 3.5 * u)) / u;
      float lab = fj < 0.5 ? fText(lq, ${T('DEAL')}, u / px) : (fj < 1.5 ? fText(lq, ${T('COMMIT')}, u / px) : (fj < 2.5 ? fText(lq, ${T('SOLVE')}, u / px) : fText(lq, ${T('GRADE')}, u / px)));
      vec3 lc = mix(vec3(0.55, 0.60, 0.70), vec3(0.95, 0.97, 1.0), on);
      lc = mix(lc, vec3(0.30, 0.78, 0.56), done * 0.6);
      col = mix(col, lc, lab * (0.55 + 0.45 * on));
      // node
      float nd = length(p0 - vec2(x0 + 0.008, y));
      vec3 nc = mix(vec3(0.16, 0.18, 0.22), mix(vec3(0.30, 0.78, 0.56), vec3(0.95, 0.97, 1.0), on), max(on, done));
      col = mix(col, nc, smoothstep(px * 1.2, 0.0, nd - 0.0058));
      col += vec3(0.95, 0.97, 1.0) * exp(-nd / 0.012) * on * 0.35;
      // connector
      if (fj < 3.5) col += vec3(0.3, 0.35, 0.45) * smoothstep(px * 1.2, 0.0, abs(p0.x - (x0 + 0.008)) - 0.0003) * step(y - 0.058 + 0.008, p0.y) * step(p0.y, y - 0.008) * (0.35 + 0.65 * done);
    }
  }

  // ===== right: the result =====
  {
    float x0 = 0.545;
    float ry = -0.185;
    float u = 0.0026;
    float resP = eio((lt - tSettle - 0.1) / 0.5);
    vec3 gc = gcol(grade);
    col = mix(col, vec3(0.62, 0.68, 0.78), fText((p0 - vec2(x0, ry + 0.150)) / u, ${T('GRADE')}, u / px) * 0.65);
    float w = gWidth(grade);
    float us = min(0.0040, 0.150 / w);
    float word = gWord((p0 - vec2(x0, ry + 0.088)) / us, grade, us / px, clamp((lt - tSettle - 0.1) / 0.8, 0.0, 1.0));
    col = mix(col, gc * 1.15, word * resP * (1.0 - out0));
    col += gc * 0.10 * exp(-length((p0 - vec2(x0 + 0.08, ry + 0.1)) * vec2(1.0, 2.4)) / 0.10) * resP * (1.0 - out0);
    // EV-loss scale: five bars, a marker at the grade
    float by = ry + 0.040;
    float bw = 0.150;
    vec2 bq = p0 - vec2(x0, by);
    float inBar = step(0.0, bq.x) * step(bq.x, bw);
    float seg = floor(clamp(bq.x / bw, 0.0, 0.9999) * 5.0);
    float su = bq.x / bw * 5.0 - seg;
    float bar = smoothstep(px, 0.0, abs(bq.y) - 0.0042) * inBar * smoothstep(0.0, 0.02, min(su, 1.0 - su));
    col = mix(col, gcol(seg) * mix(0.35, 1.0, resP), bar * 0.95);
    float mx = x0 + bw * (grade + 0.5) / 5.0;
    float tri = smoothstep(px * 1.3, 0.0, max(abs(p0.x - mx) - (p0.y - (by + 0.008)) * 0.0 - 0.0, 0.0));
    float mk = smoothstep(px * 1.3, 0.0, max(abs(p0.x - mx) * 1.0 - (by + 0.026 - p0.y) * 0.9, max(p0.y - (by + 0.0085), (by + 0.026) - p0.y)));
    col = mix(col, vec3(1.0, 0.98, 0.94), mk * resP * (1.0 - out0));
    col = mix(col, vec3(0.62, 0.68, 0.78), fText((p0 - vec2(x0, by - 0.030)) / u, ${T('EV LOSS')}, u / px) * 0.65);
    // the tag: where the grade comes from
    vec2 tq = (p0 - vec2(x0 + 0.010, ry - 0.034)) / u;
    float tw = tag < 0.5 ? ${f1(W('SOLVED'))} : (tag < 1.5 ? ${f1(W('HEURISTIC'))} : ${f1(W('EXACT MATH'))});
    float tl = tag < 0.5 ? fText(tq, ${T('SOLVED')}, u / px) : (tag < 1.5 ? fText(tq, ${T('HEURISTIC')}, u / px) : fText(tq, ${T('EXACT MATH')}, u / px));
    vec2 chipC = vec2(x0 + 0.010 + tw * u * 0.5, ry - 0.034 + 3.5 * u);
    float cd = sdBox(p0 - chipC, vec2(tw * u * 0.5 + 0.012, 0.0125), 0.0125);
    vec3 tc = tag < 0.5 ? vec3(0.30, 0.82, 0.58) : (tag < 1.5 ? vec3(0.96, 0.74, 0.30) : vec3(0.52, 0.72, 0.98));
    float tp = eio((lt - tSettle - 0.5) / 0.4) * (1.0 - out0);
    col = mix(col, tc * 0.14, smoothstep(px, -px, cd) * tp);
    col += tc * smoothstep(px * 1.4, 0.0, abs(cd) - px * 0.5) * 0.8 * tp;
    col = mix(col, tc * 1.15, tl * tp);
  }

  // ===== bottom: the choice, and the lock =====
  {
    float u = 0.0026;
    float showCh = ease((lt - 1.5) / 0.4) * (1.0 - out0);
    float hop = lt < tCommit ? mod(floor((lt - 1.9) / 0.34), 3.0) : chosen;
    if (lt < 1.9) hop = -1.0;
    float cy = DC.y - 0.290;
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      vec2 c = vec2(DC.x + (fj - 1.0) * 0.128, cy);
      float d = sdBox(p0 - c, vec2(0.052, 0.0175), 0.0175);
      float sel = abs(fj - hop) < 0.5 ? 1.0 : 0.0;
      float committed = step(tCommit, lt);
      float flash = exp(-(lt - tCommit) * 5.0) * step(tCommit, lt) * sel;
      vec3 bc = mix(vec3(0.62, 0.68, 0.78), vec3(0.96, 0.98, 1.0), sel);
      col = mix(col, bc * 0.10 * (1.0 + 4.0 * sel * committed), smoothstep(px, -px, d) * showCh);
      col += bc * smoothstep(px * 1.4, 0.0, abs(d) - px * 0.5) * (0.30 + 0.7 * sel) * showCh;
      col += bc * flash * exp(-max(d, 0.0) / 0.03) * 0.8 * showCh;
      vec2 lq = (p0 - c + vec2((fj < 0.5 ? 23.0 : (fj < 1.5 ? 23.0 : 29.0)) * u * 0.5, 3.5 * u)) / u;
      float lab = fj < 0.5 ? fText(lq, ${T('FOLD')}, u / px) : (fj < 1.5 ? fText(lq, ${T('CALL')}, u / px) : fText(lq, ${T('RAISE')}, u / px));
      col = mix(col, bc * mix(0.8, 1.15, sel), lab * showCh * mix(0.65, 1.0, sel));
    }
    // status line under the chips
    float stp = (1.0 - out0);
    vec2 sq = (p0 - vec2(DC.x, cy - 0.052)) / u;
    float lk = lt < tCommit ? fText(sq + vec2(${f1(W('LOCKED') / 2)}, 0.0), ${T('LOCKED')}, u / px) : fText(sq + vec2(${f1(W('COMMITTED') / 2)}, 0.0), ${T('COMMITTED')}, u / px);
    float lkOn = step(0.3, lt);
    vec3 lc = lt < tCommit ? vec3(0.62, 0.68, 0.78) : vec3(0.30, 0.82, 0.58);
    col = mix(col, lc, lk * lkOn * stp * (0.55 + 0.45 * step(tCommit, lt)));
  }

  // ===== dust and sparks on the active segment =====
  {
    float lamp = exp(-dot(p0 * vec2(0.9, 1.2), p0 * vec2(0.9, 1.2)) * 2.0);
    for (int L = 0; L < 2; L++) {
      float fl = float(L);
      vec2 g = (p0 - mo * 0.04 * (1.0 + fl)) * (12.0 + 9.0 * fl) + vec2(0.0, -Tm * (0.14 + 0.09 * fl)) + fl * 5.1;
      vec2 id = floor(g), fr = fract(g) - 0.5;
      float rr = h21(id + fl * 11.0);
      vec2 off = (vec2(h21(id + 1.3), h21(id + 4.1)) - 0.5) * 0.6;
      float tw = 0.5 + 0.5 * sin(Tm * (1.0 + rr * 2.0) + rr * 40.0);
      col += vec3(0.7, 0.8, 1.0) * smoothstep(0.07, 0.0, length(fr - off)) * step(0.82, rr) * tw * lamp * 0.4 * (0.5 + 0.5 * I);
    }
    if (settle > 0.01 && lt < 11.5) {
      float aG = A0 + gF * ASPAN;
      for (int j = 0; j < 12; j++) {
        float fj = float(j);
        float a = aG + (H(60.0, fj) - 0.5) * (ASPAN / 5.0) * 0.9;
        float ph = fract(Tm * (0.25 + 0.2 * H(61.0, fj)) + H(62.0, fj));
        float rr = RO + 0.004 + ph * (0.05 + 0.07 * H(63.0, fj));
        vec2 sp = DC + rr * vec2(sin(a), cos(a));
        col += gcol(grade) * exp(-length(p0 - sp) / 0.0045) * (1.0 - ph) * 0.9 * settle * (1.0 - out0);
      }
    }
  }

  // ===== grade =====
  col = col / (1.0 + 0.18 * max(col - 0.85, 0.0));
  float vig = smoothstep(1.3, 0.28, length(p0 * vec2(0.82, 1.1)));
  col *= 0.4 + 0.6 * vig;
  col += (h21(gl_FragCoord.xy + fract(uTime * 9.3) * 211.0) - 0.5) * (0.018 + 0.018 * I);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
}
export default reel
