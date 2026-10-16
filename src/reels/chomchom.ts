import type { ReelDef } from './types'
import { FONT_GLSL, T } from './font'

// Breathe: a soap bubble that breathes in and out while it drifts along a winding activity road,
// after the kids' home-screen map in ChomChom (Daily Checkin, Mindfulness Challenge, Story, Games,
// Journaling). It pauses at each of the five stops, the badge hops and throws confetti, and the
// stop keeps a ring once visited. A guide ring behind the bubble swells and shrinks with the
// breath, and the caption flips between BREATHE IN and BREATHE OUT. The road, trees, clouds and
// badge pictograms are drawn here from scratch (no app art is sampled). The trip is illustrative.
// GLSL ES 1.00; loops bounded (5 stops, 3 clouds, 12 confetti). No textures.
const reel: ReelDef = {
  id: 'chomchom',
  projectId: 'chomchom',
  title: 'Breathe',
  medium: "A breathing bubble travelling a winding activity road, after the app's home-screen map",
  colors: { bg: '#1E5C3A', ink: '#F5FFF0', accent: '#A78BFA' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;
${FONT_GLSL}
#define PI 3.14159265
#define STOP 3.7
#define TRAV 1.3
#define CYC 18.5
#define RW 0.050
float Tm;

float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float roadY(float x) { return 0.20 * sin(5.2 * x + 0.35) - 0.02; }
float roadM(float x) { return 0.20 * 5.2 * cos(5.2 * x + 0.35); }
float stopX(float k) { return -0.52 + 0.26 * k; }
float box(vec2 q, vec2 c, vec2 h, float r) { vec2 d = abs(q - c) - h + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
float cir(vec2 q, vec2 c, float r) { return length(q - c) - r; }
float cov(float sd, float aa) { return clamp(0.5 - sd / aa, 0.0, 1.0); }

// pictograms in badge space (-1..1): rgb + alpha
vec4 icon(float k, vec2 q, float aa) {
  vec3 c = vec3(0.0); float a = 0.0;
  if (k < 0.5) {
    // daily check-in: three ticked rows
    c = vec3(0.42, 0.30, 0.88);
    float m = 0.0;
    for (int i = 0; i < 3; i++) {
      float y = 0.42 - float(i) * 0.42;
      m = max(m, cov(cir(q, vec2(-0.52, y), 0.11), aa));
      m = max(m, cov(box(q, vec2(0.22, y), vec2(0.46, 0.065), 0.06), aa));
    }
    a = m;
  } else if (k < 1.5) {
    // mindfulness: a soft cloud-brain
    float sd = min(min(cir(q, vec2(-0.28, -0.05), 0.40), cir(q, vec2(0.28, -0.05), 0.40)), min(cir(q, vec2(0.0, 0.26), 0.38), box(q, vec2(0.0, -0.18), vec2(0.58, 0.22), 0.2)));
    c = vec3(0.98, 0.58, 0.78);
    a = cov(sd, aa);
    float fold = cov(abs(q.x + 0.05 * sin(q.y * 9.0)) - 0.025, aa) * step(-0.25, q.y) * step(q.y, 0.52);
    c = mix(c, vec3(0.80, 0.30, 0.55), fold * 0.8);
  } else if (k < 2.5) {
    // story: an open book
    float sdl = box(q, vec2(-0.36, 0.0), vec2(0.34, 0.42), 0.06);
    float sdr = box(q, vec2(0.36, 0.0), vec2(0.34, 0.42), 0.06);
    c = vec3(0.20, 0.52, 0.95);
    a = cov(min(sdl, sdr), aa);
    float lines = cov(abs(fract(q.y * 3.2) - 0.5) - 0.16, aa) * step(abs(q.x), 0.66) * step(0.08, abs(q.x)) * step(abs(q.y), 0.28);
    c = mix(c, vec3(0.88, 0.95, 1.0), lines * 0.9);
  } else if (k < 3.5) {
    // games: a gamepad
    float sd = min(box(q, vec2(0.0, 0.0), vec2(0.70, 0.36), 0.28), min(cir(q, vec2(-0.5, -0.26), 0.28), cir(q, vec2(0.5, -0.26), 0.28)));
    c = vec3(0.36, 0.44, 0.72);
    a = cov(sd, aa);
    float crs = max(cov(box(q, vec2(-0.40, 0.04), vec2(0.20, 0.06), 0.02), aa), cov(box(q, vec2(-0.40, 0.04), vec2(0.06, 0.20), 0.02), aa));
    float dots = max(cov(cir(q, vec2(0.34, 0.12), 0.08), aa), cov(cir(q, vec2(0.52, -0.02), 0.08), aa));
    c = mix(c, vec3(1.0, 0.98, 0.95), max(crs, dots));
  } else {
    // journaling: a notebook with a pencil
    float sd = box(q, vec2(-0.08, 0.0), vec2(0.46, 0.58), 0.08);
    c = vec3(0.24, 0.50, 0.88);
    a = cov(sd, aa);
    float ln = cov(abs(fract((q.y + 0.1) * 3.4) - 0.5) - 0.12, aa) * step(abs(q.x + 0.08), 0.30) * step(abs(q.y + 0.1), 0.36);
    c = mix(c, vec3(0.86, 0.93, 1.0), ln * 0.9);
    vec2 r = vec2(q.x - 0.40 + q.y * 0.9, q.y);
    float pen = cov(abs(q.x - q.y * 0.70 - 0.34) - 0.07, aa) * step(abs(q.y - 0.05), 0.44);
    c = mix(c, vec3(1.0, 0.68, 0.18), pen);
    a = max(a, pen);
  }
  return vec4(c, a);
}

float lab(vec2 p, vec2 c, vec4 s, float n, float px, out float pill) {
  float u = 0.0023;
  float w = (n * 6.0 - 1.0) * u;
  vec2 q = p - c + vec2(w * 0.5, 0.0095);
  pill = cov(box(p, c, vec2(w * 0.5 + 0.014, 0.0145), 0.0145), px * 1.5);
  return fText(q / u, s, n, u / px);
}

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float S = min(uRes.y, uRes.x / 1.3);
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uRes) / S;
  float px = 1.0 / S;
  vec2 mo = uMouse - 0.5;
  Tm = mod(uTime, 7200.0) + uSeed * CYC;
  vec2 p = p0 + mo * vec2(0.020, 0.014);   // a little parallax

  // ---- where the bubble is ----
  float tc = mod(Tm, CYC);
  float kk = floor(tc / STOP);
  float tl = tc - kk * STOP;
  float xPrev = kk < 0.5 ? -0.70 : stopX(kk - 1.0);
  float xNext = stopX(kk);
  float a = smoothstep(0.0, TRAV, tl);
  float bxp = mix(xPrev, xNext, a);
  float moving = 1.0 - smoothstep(TRAV - 0.1, TRAV + 0.2, tl);
  float breath = 0.5 - 0.5 * cos(2.0 * PI * Tm / 5.0);
  float inhale = step(0.0, sin(2.0 * PI * Tm / 5.0));
  float born = smoothstep(0.0, 0.6, tc) * (1.0 - smoothstep(CYC - 0.8, CYC - 0.1, tc));

  // ---- the map: mown stripes, soft light ----
  float stripe = smoothstep(-0.01, 0.01, sin((p.x + p.y * 0.6) * 15.0));
  vec3 col = mix(vec3(0.20, 0.58, 0.36), vec3(0.25, 0.65, 0.40), stripe);
  col *= 0.92 + 0.12 * h21(floor(p * 90.0));
  col = mix(col, vec3(0.30, 0.72, 0.46), 0.35 * exp(-dot(p - vec2(0.0, 0.0), p - vec2(0.0, 0.0)) * 1.6));

  // trees in the empty cells
  {
    vec2 g = p / 0.15;
    vec2 id = floor(g);
    float hh = h21(id + 3.7);
    vec2 tp = (id + 0.5 + (vec2(h21(id + 1.3), h21(id + 8.1)) - 0.5) * 0.5) * 0.15;
    float rd = abs(tp.y - roadY(tp.x)) / sqrt(1.0 + roadM(tp.x) * roadM(tp.x));
    float near = 1.0;
    for (int i = 0; i < 5; i++) { vec2 sp = vec2(stopX(float(i)), roadY(stopX(float(i)))); near = min(near, length(tp - sp)); }
    if (hh > 0.40 && rd > 0.13 && near > 0.17 && abs(tp.x) < 0.74) {
      float sway = 0.003 * sin(Tm * 1.4 + hh * 20.0);
      float r = 0.026 + 0.012 * h21(id + 9.1);
      vec2 d = p - tp - vec2(sway, 0.004);
      float shadow = cov(length((p - tp - vec2(0.012, -0.010)) * vec2(1.0, 1.5)) - r, px * 2.5);
      col = mix(col, col * 0.78, shadow * 0.55);
      float can = cov(length(d) - r, px * 1.5);
      vec3 tc2 = mix(vec3(0.10, 0.42, 0.24), vec3(0.18, 0.55, 0.30), smoothstep(-r, r, d.x + d.y));
      col = mix(col, tc2, can);
    }
  }

  // ---- the road ----
  float m = roadM(p.x);
  float dr = (p.y - roadY(p.x)) / sqrt(1.0 + m * m);
  float adr = abs(dr);
  float curb = cov(adr - (RW + 0.008), px * 1.5);
  col = mix(col, vec3(0.88, 0.92, 0.80), curb * 0.85);
  float rd2 = cov(adr - RW, px * 1.5);
  vec3 asphalt = mix(vec3(0.12, 0.13, 0.21), vec3(0.17, 0.18, 0.27), smoothstep(RW, 0.0, adr) * 0.5);
  col = mix(col, asphalt, rd2);
  float dash = step(0.5, fract(p.x * 17.0 * sqrt(1.0 + m * m) * 0.62)) * cov(adr - 0.003, px * 1.2);
  col = mix(col, vec3(0.96, 0.96, 0.92), dash * rd2 * 0.9);
  // the stretch the bubble has covered glows faintly
  float prog = (kk * STOP + (kk < 0.5 ? 0.0 : 0.0));
  float doneX = bxp;
  float covered = step(p.x, doneX) * step(-0.70, p.x) * rd2 * born;
  col = mix(col, col + vec3(0.30, 0.22, 0.55) * 0.5, covered * smoothstep(RW, 0.0, adr) * 0.5);

  // ---- clouds ----
  for (int i = 0; i < 3; i++) {
    if (float(i) > 1.0 + 2.0 * I) break;
    float fi = float(i);
    float cx = mod(Tm * (0.012 + 0.004 * fi) + fi * 0.55, 1.9) - 0.95;
    vec2 cp = vec2(cx, 0.34 - fi * 0.42 + 0.03 * sin(fi * 5.0));
    float sd = min(min(cir(p, cp, 0.040), cir(p, cp + vec2(0.045, -0.006), 0.032)), min(cir(p, cp + vec2(-0.045, -0.008), 0.030), box(p, cp + vec2(0.0, -0.018), vec2(0.07, 0.016), 0.016)));
    col = mix(col, vec3(0.97, 1.0, 0.97), cov(sd, px * 2.0) * 0.38);
  }

  // ---- the five stops ----
  float lit = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 c = vec2(stopX(fi), roadY(stopX(fi)));
    float arrive = fi * STOP + TRAV;
    float age = tc - arrive;
    float visited = step(0.0, age);
    // the hop and the ring when the bubble lands
    float hop = age > 0.0 ? exp(-age * 4.5) * sin(age * 13.0) * 0.35 : 0.0;
    float sc = 1.0 + hop + 0.06 * (1.0 - visited) * sin(Tm * 2.0 + fi);
    float rb = 0.054 * sc;
    vec2 q = (p - c - vec2(0.0, max(hop, 0.0) * 0.03)) / rb;
    float aa = px / rb * 1.5;
    float halo = exp(-dot(q, q) * 0.5) * 0.28 * (0.5 + 0.5 * visited);
    col += vec3(1.0, 1.0, 0.95) * halo * 0.5;
    float disc = cov(length(q) - 1.0, aa);
    float ring = cov(abs(length(q) - 1.05) - 0.10, aa);
    vec3 ringC = mix(vec3(0.92, 0.95, 0.90), mix(vec3(0.66, 0.55, 0.98), vec3(1.0, 0.86, 0.45), 0.35 * exp(-age * 0.4)), visited);
    col = mix(col, ringC, ring);
    col = mix(col, vec3(0.99, 0.99, 0.96), disc);
    vec4 ic = icon(fi, q * 1.18, aa * 1.18);
    col = mix(col, ic.rgb, ic.a * disc * (0.65 + 0.35 * visited));
    // confetti
    if (age > 0.0 && age < 1.6) {
      for (int j = 0; j < 12; j++) {
        float fj = float(j);
        float ang = fj * 0.5236 + h11(fi * 9.0 + fj) * 0.4;
        float sp = 0.10 + 0.10 * h11(fj + fi * 3.0);
        vec2 pp = c + vec2(cos(ang), sin(ang)) * sp * (1.0 - exp(-age * 3.0)) / 3.0 * 3.0 - vec2(0.0, 0.06 * age * age);
        float sz = 0.0045 * (1.0 - age / 1.6);
        vec3 cc = j - 3 * (j / 3) == 0 ? vec3(1.0, 0.85, 0.35) : (j - 3 * (j / 3) == 1 ? vec3(0.65, 0.55, 1.0) : vec3(1.0, 0.55, 0.75));
        col = mix(col, cc, cov(length(p - pp) - sz, px * 1.5) * (1.0 - age / 1.6));
      }
    }
    lit += halo;
  }
  // stop labels, on dark pills
  {
    float pl;
    float t0 = lab(p, vec2(stopX(0.0), roadY(stopX(0.0)) - 0.098), ${T('CHECKIN')}, px, pl);
    col = mix(col, vec3(0.04, 0.12, 0.10), pl * 0.55); col = mix(col, vec3(1.0), t0 * 0.95);
    float t1 = lab(p, vec2(stopX(1.0), roadY(stopX(1.0)) - 0.098), ${T('MINDFULNESS')}, px, pl);
    col = mix(col, vec3(0.04, 0.12, 0.10), pl * 0.55); col = mix(col, vec3(1.0), t1 * 0.95);
    float t2 = lab(p, vec2(stopX(2.0), roadY(stopX(2.0)) - 0.098), ${T('STORY')}, px, pl);
    col = mix(col, vec3(0.04, 0.12, 0.10), pl * 0.55); col = mix(col, vec3(1.0), t2 * 0.95);
    float t3 = lab(p, vec2(stopX(3.0), roadY(stopX(3.0)) - 0.098), ${T('GAMES')}, px, pl);
    col = mix(col, vec3(0.04, 0.12, 0.10), pl * 0.55); col = mix(col, vec3(1.0), t3 * 0.95);
    float t4 = lab(p, vec2(stopX(4.0), roadY(stopX(4.0)) - 0.098), ${T('JOURNALING')}, px, pl);
    col = mix(col, vec3(0.04, 0.12, 0.10), pl * 0.55); col = mix(col, vec3(1.0), t4 * 0.95);
  }

  // ---- the bubble ----
  {
    vec2 bc = vec2(bxp, roadY(bxp) + 0.115 + 0.010 * sin(Tm * 1.9));
    float rr = 0.066 * (1.0 + 0.30 * breath) * (0.6 + 0.4 * born) * (1.0 + 0.05 * moving * sin(Tm * 9.0));
    vec2 d = p - bc;
    // a soft shadow on the road
    vec2 sh = p - vec2(bc.x, roadY(bxp) - 0.012);
    col = mix(col, col * 0.55, exp(-dot(sh * vec2(1.0, 3.2), sh * vec2(1.0, 3.2)) / (rr * rr * 0.9)) * 0.55 * born);
    // breathing guide ring
    float gr = 0.095 + 0.055 * breath;
    float gd = abs(length(d) - gr);
    col += vec3(0.95, 0.92, 1.0) * smoothstep(px * 1.6, 0.0, gd - 0.0007) * 0.38 * born;
    col += vec3(0.75, 0.65, 1.0) * exp(-gd * gd / 0.00010) * 0.14 * born;
    float ang = atan(d.y, d.x);
    float wob = 1.0 + 0.028 * sin(ang * 3.0 + Tm * 2.1) + 0.018 * sin(ang * 5.0 - Tm * 1.6);
    float rw = rr * wob;
    float L = length(d);
    if (L < rw * 1.12) {
      float rn = L / rw;
      float z = sqrt(max(1.0 - rn * rn, 0.0));
      vec3 n = vec3(d / rw, z);
      float fres = pow(1.0 - z, 2.4);
      float film = 0.35 + 0.9 * (1.0 - z) + 0.25 * sin(n.x * 3.1 + n.y * 2.3 + Tm * 0.8) + 0.12 * sin(Tm * 0.5);
      vec3 irid = 0.55 + 0.45 * cos(6.2831 * (film * vec3(1.0, 1.0, 1.0) + vec3(0.0, 0.33, 0.66)));
      float al = clamp(0.10 + 0.70 * fres, 0.0, 0.85) * (1.0 - smoothstep(0.96, 1.08, rn));
      // what is behind it, bent a little
      col = mix(col, col * 1.08 + vec3(0.05, 0.05, 0.09), (1.0 - smoothstep(0.0, 1.0, rn)) * 0.45);
      col = mix(col, irid, al * born);
      // inner light that breathes
      col += vec3(0.85, 0.80, 1.0) * exp(-rn * rn * 3.2) * (0.14 + 0.18 * breath) * born;
      // a big window highlight, a small one opposite
      vec2 hq = (d / rw - vec2(-0.40, 0.46)) * vec2(1.0, 1.7);
      col += vec3(1.0) * cov(length(hq) - 0.20, 0.10) * 0.85 * born;
      vec2 hq2 = (d / rw - vec2(0.42, -0.42)) * vec2(1.3, 1.0);
      col += vec3(1.0) * cov(length(hq2) - 0.07, 0.08) * 0.5 * born;
      col += vec3(1.0, 0.95, 1.0) * smoothstep(0.035, 0.0, abs(rn - 0.98)) * 0.35 * born;
    }
    // a few motes rising off it while it rests
    for (int j = 0; j < 6; j++) {
      float fj = float(j);
      float life = fract(Tm * 0.25 + fj * 0.17);
      vec2 mp = bc + vec2((h11(fj + kk * 7.0) - 0.5) * 0.14, 0.06 + 0.16 * life);
      col += vec3(1.0, 0.96, 1.0) * exp(-dot(p - mp, p - mp) / 0.000012) * sin(life * PI) * (1.0 - moving) * 0.8 * born * step(0.5, h11(fj + 3.0 + kk));
    }
  }

  // ---- caption ----
  {
    float u = 0.0028;
    float w = 11.0 * 6.0 - 1.0;
    vec2 cq = (p0 - vec2(-w * 0.5 * u, 0.425)) / u;
    float tin = fText(cq, ${T('BREATHE IN')}, u / px) * inhale;
    float tout = fText(cq, ${T('BREATHE OUT')}, u / px) * (1.0 - inhale);
    float shd = fText(cq - vec2(-0.7, 0.7), ${T('BREATHE IN')}, u / px) * inhale + fText(cq - vec2(-0.7, 0.7), ${T('BREATHE OUT')}, u / px) * (1.0 - inhale);
    col = mix(col, vec3(0.03, 0.12, 0.08), shd * 0.5);
    col = mix(col, vec3(1.0, 0.99, 0.95), (tin + tout) * 0.95);
  }

  // ---- grade: a gentle vignette, warm film grain ----
  float vig = smoothstep(1.35, 0.30, length(p0 * vec2(0.8, 1.05)));
  col *= 0.55 + 0.45 * vig;
  col = col / (1.0 + 0.2 * max(col - 0.95, 0.0));
  col += (h21(gl_FragCoord.xy + fract(uTime * 9.7) * 191.0) - 0.5) * (0.014 + 0.016 * I);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
}
export default reel
