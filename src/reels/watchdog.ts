import type { ReelDef } from './types'
import { FONT_GLSL, T, W } from './font'

// Sweep: a radar scope with one spoke per check, exactly 24 of them: 20 on job outputs (round
// blips), 2 on credential age (diamonds), 2 on paused jobs (hollow, parked). Distance from the
// centre is the age of the thing the job was supposed to make, and the dashed ring is its maximum
// age. A healthy job's blip creeps outward along its spoke and snaps back to the centre when the
// job runs and makes a fresh artifact. Now and then one runs late: it crosses the ring, turns
// amber (stale) or red (missing), pulses, and its tick on the bezel lights. The sweep arm comes
// round once every six seconds and lights what it passes. A banner on the right reads ALL OK or
// STALE, the way the real thing alerts: one notification per job per day.
// Ages, lateness and timing are generative, not a log. GLSL ES 1.00; loops are bounded
// (3 neighbour spokes, 20 for the banner). No textures.
const reel: ReelDef = {
  id: 'watchdog',
  projectId: 'watchdog',
  title: 'Sweep',
  medium: 'A radar sweep over one blip for each of 24 scheduled-job checks',
  colors: { bg: '#050D0B', ink: '#DFFBEF', accent: '#5CF2B0' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;
${FONT_GLSL}
#define PI 3.14159265
#define TAU 6.2831853
#define RM 0.255
#define RS 0.415
#define SW 6.0
const vec2 CEN = vec2(0.0, -0.005);
const vec3 ACC = vec3(0.36, 0.95, 0.69);
const vec3 AMB = vec3(1.0, 0.72, 0.20);
const vec3 RED = vec3(1.0, 0.30, 0.30);
float Tm;

float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float cov(float sd, float aa) { return clamp(0.5 - sd / aa, 0.0, 1.0); }
float box(vec2 q, vec2 c, vec2 h, float r) { vec2 d = abs(q - c) - h + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }

// one check: x = radius, y = state (0 ok, 1 stale, 2 missing, 3 paused, 4 credential), z = age / max age
vec3 chk(float i) {
  float h = h11(i * 1.7 + 0.3);
  if (i > 21.5) return vec3(0.07 + 0.11 * h11(i * 3.1), 3.0, 0.0);
  float P = i < 19.5 ? 7.0 + 6.0 * h : (i < 20.5 ? 64.0 : 86.0);
  float x = Tm / P + h11(i * 9.1 + 4.0) * 7.0;
  float k = floor(x), f = fract(x);
  float late = i < 19.5 ? step(0.80, h21(vec2(i, k))) : 0.0;
  float miss = step(0.55, h21(vec2(i + 31.0, k)));
  float ageN = f * (1.0 + 0.6 * late) * 0.97;
  float st = i > 19.5 ? 4.0 : (ageN > 1.0 ? (miss > 0.5 ? 2.0 : 1.0) : 0.0);
  return vec3(0.03 + ageN * (RM - 0.03), st, ageN);
}
vec3 stCol(float st) { return st < 0.5 ? ACC : (st < 1.5 ? AMB : (st < 2.5 ? RED : (st < 3.5 ? vec3(0.45, 0.60, 0.55) : vec3(0.70, 0.85, 1.0)))); }

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float S = min(uRes.y, uRes.x / 1.3);
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uRes) / S;
  float px = 1.0 / S;
  vec2 mo = uMouse - 0.5;
  Tm = mod(uTime, 7200.0) + uSeed * 40.0;
  vec2 p = p0 + mo * vec2(0.010, 0.007);
  vec2 d = p - CEN;
  float r = length(d);
  float a = mod(atan(d.x, d.y), TAU);
  float sw = mod(Tm * TAU / SW, TAU);
  float beh = mod(sw - a, TAU);

  // the room: near-black green, a faint dot field
  vec3 col = mix(vec3(0.006, 0.020, 0.016), vec3(0.010, 0.032, 0.026), smoothstep(0.7, 0.0, length(p0)));
  col += ACC * smoothstep(0.07, 0.0, length(fract(p0 * 40.0) - 0.5)) * 0.025;

  // the scope
  float disc = smoothstep(RS + px, RS - px, r);
  col = mix(col, vec3(0.012, 0.050, 0.040) + ACC * 0.020 * (1.0 - r / RS), disc);
  // rings: faint thirds, the dashed maximum-age ring
  float ringF = cov(abs(r - 0.13) - 0.0005, px * 1.3) + cov(abs(r - 0.385) - 0.0005, px * 1.3);
  col += ACC * ringF * 0.10 * disc;
  float dash = step(0.5, fract(a * 26.0 / PI * 0.5));
  col += ACC * cov(abs(r - RM) - 0.0011, px * 1.3) * (0.30 + 0.45 * dash) * disc;
  col += ACC * exp(-pow(r - RM, 2.0) / 0.00015) * 0.05 * disc;
  float spokeA = abs(fract(a / (TAU / 24.0) + 0.5) - 0.5) * r * (TAU / 24.0);
  col += ACC * cov(spokeA - 0.0004, px * 1.3) * step(0.03, r) * step(r, RS) * 0.09;

  // the sweep: a fan trailing the arm, a bright leading edge
  float fan = exp(-beh * 2.3) * step(beh, 3.0);
  col += ACC * fan * 0.30 * disc * (0.8 + 0.2 * smoothstep(0.0, RS, r));
  col += vec3(0.85, 1.0, 0.93) * smoothstep(0.020, 0.0, beh) * smoothstep(0.0, 0.04, r) * disc * 0.55;

  // 24 spokes: an age bar and a blip each
  float i0 = floor(a / (TAU / 24.0) + 0.5);
  for (int jj = -1; jj <= 1; jj++) {
    float i = mod(i0 + float(jj) + 24.0, 24.0);
    vec3 c = chk(i);
    float th = i * (TAU / 24.0);
    float da = mod(a - th + PI, TAU) - PI;
    float along = r * cos(da), perp = r * sin(da);
    float since = mod(sw - th, TAU);
    float glow = exp(-since * 1.3);
    float st = c.y;
    vec3 sc = stCol(st);
    float stale = step(0.5, st) * step(st, 2.5);
    // the age bar, amber past the ring
    if (st < 3.5) {
      float barOn = step(0.03, along) * step(along, c.x) * step(0.0, cos(da));
      float inside = step(along, RM);
      vec3 bcol = mix(AMB * 0.9, sc * 0.55, inside);
      col += bcol * cov(abs(perp) - 0.0013, px * 1.4) * barOn * (0.40 + 0.80 * glow) * disc;
    }
    // the blip
    vec2 q = vec2(along - c.x, perp);
    float pulse = 1.0 + 0.25 * stale * sin(Tm * 6.0);
    float rad = 0.0105 * pulse;
    float sd;
    if (st > 3.5) sd = (abs(q.x) + abs(q.y)) * 0.72 - rad;
    else sd = length(q) - rad;
    if (st > 2.5 && st < 3.5) {
      col += vec3(0.45, 0.60, 0.55) * cov(abs(sd + 0.0016) - 0.0014, px * 1.3) * 0.7 * disc;
    } else {
      col += sc * cov(sd, px * 1.4) * (0.65 + 0.55 * glow) * disc;
      col += sc * exp(-max(sd, 0.0) / 0.012) * (0.12 + 0.55 * glow + 0.35 * stale) * disc;
    }
    // a stale or missing job rings out of its blip
    float rp = fract(Tm * 0.9 + i * 0.37);
    col += sc * cov(abs(length(q) - 0.012 - rp * 0.045) - 0.0009, px * 1.3) * (1.0 - rp) * stale * 0.9 * disc;
    // the tick on the bezel
    float tk = step(0.5, abs(float(jj)) * -1.0 + 1.0);
    float bez = cov(abs(perp) - 0.0016, px * 1.3) * step(RS - 0.014, along) * step(along, RS + 0.002) * step(0.0, cos(da));
    col += mix(ACC * 0.35, sc, stale) * bez * (0.55 + 0.9 * stale + 0.6 * glow) * tk;
  }
  // fine bezel marks and the rim
  float fine = cov(abs(fract(a / (TAU / 120.0) + 0.5) - 0.5) * r * (TAU / 120.0) - 0.0003, px * 1.2);
  col += ACC * fine * step(RS - 0.005, r) * step(r, RS) * 0.18;
  col += ACC * cov(abs(r - RS - 0.003) - 0.0013, px * 1.3) * 0.65;
  col += ACC * exp(-pow(r - RS - 0.003, 2.0) / 0.00012) * 0.07;

  // hub
  col += vec3(0.9, 1.0, 0.95) * cov(r - 0.006, px * 1.4);
  float hb = fract(Tm / SW);
  col += ACC * cov(abs(r - 0.012 - hb * 0.10) - 0.0007, px * 1.3) * (1.0 - hb) * 0.5 * disc;

  // labels
  {
    float u = 0.0022;
    vec3 ink = vec3(0.86, 0.98, 0.93);
    col = mix(col, ACC, fText((p0 - vec2(-0.64, 0.440)) / u, ${T('HOURLY SWEEP')}, u / px) * 0.95);
    col = mix(col, ink * 0.8, fText((p0 - vec2(0.64 - ${(W('24 CHECKS') * 0.0022).toFixed(4)}, 0.440)) / u, ${T('24 CHECKS')}, u / px) * 0.9);
    // the max-age label on a pill at the top of the ring
    float uu = 0.0017;
    float wm = ${(W('MAX AGE') * 0.0017).toFixed(4)};
    vec2 mc = CEN + vec2(0.0, RM);
    col = mix(col, vec3(0.012, 0.040, 0.034), cov(box(p0, mc, vec2(wm * 0.5 + 0.008, 0.0105), 0.0105), px * 1.4) * 0.92);
    col = mix(col, ACC, fText((p0 - mc + vec2(wm * 0.5, 0.0060)) / uu, ${T('MAX AGE')}, uu / px) * 0.95);
    // legend
    for (int k = 0; k < 5; k++) {
      float fk = float(k);
      vec2 lp = vec2(-0.625, 0.20 - fk * 0.045);
      vec2 q = p0 - lp;
      vec3 lc = stCol(fk < 0.5 ? 0.0 : (fk < 1.5 ? 1.0 : (fk < 2.5 ? 2.0 : (fk < 3.5 ? 3.0 : 4.0))));
      float sd = fk > 3.5 ? (abs(q.x) + abs(q.y)) * 0.72 - 0.0095 : length(q) - 0.0095;
      col += lc * (fk > 2.5 && fk < 3.5 ? cov(abs(sd + 0.0016) - 0.0014, px * 1.3) * 0.7 : cov(sd, px * 1.3)) ;
      vec2 tq = (p0 - lp - vec2(0.022, -0.0055)) / u;
      float tt = fk < 0.5 ? fText(tq, ${T('OK')}, u / px) : (fk < 1.5 ? fText(tq, ${T('STALE')}, u / px) : (fk < 2.5 ? fText(tq, ${T('MISSING')}, u / px) : (fk < 3.5 ? fText(tq, ${T('PAUSED')}, u / px) : fText(tq, ${T('CREDENTIAL')}, u / px))));
      col = mix(col, mix(ink * 0.75, lc, 0.35), tt * 0.9);
    }
    col = mix(col, ink * 0.55, fText((p0 - vec2(0.50, -0.385)) / u, ${T('ONE ALERT')}, u / px) * 0.9);
    col = mix(col, ink * 0.55, fText((p0 - vec2(0.50, -0.418)) / u, ${T('PER JOB')}, u / px) * 0.9);
    col = mix(col, ink * 0.55, fText((p0 - vec2(0.50, -0.451)) / u, ${T('PER DAY')}, u / px) * 0.9);
  }

  // the banner: ALL OK, or STALE while any job is past its ring
  {
    vec2 bc = vec2(0.545, 0.215);
    if (abs(p0.x - bc.x) < 0.10 && abs(p0.y - bc.y) < 0.03) {
      float anyS = 0.0;
      for (int i = 0; i < 20; i++) { float sti = chk(float(i)).y; anyS = max(anyS, step(0.5, sti) * step(sti, 2.5)); }
      vec3 bcol = mix(ACC, AMB, anyS);
      float pd = cov(box(p0, bc, vec2(0.082, 0.021), 0.021), px * 1.4);
      col = mix(col, vec3(0.012, 0.040, 0.034), pd * 0.9);
      col += bcol * cov(abs(box(p0, bc, vec2(0.082, 0.021), 0.021)) - 0.0010, px * 1.3) * 0.8;
      float u = 0.0022;
      float dotp = 0.5 + 0.5 * sin(Tm * 6.0);
      col += bcol * cov(length(p0 - bc - vec2(-0.058, 0.0)) - 0.0075, px * 1.4) * (1.0 - 0.4 * anyS * dotp);
      vec2 btq = (p0 - bc - vec2(-0.040, -0.0055)) / u;
      col = mix(col, bcol, (fText(btq, ${T('STALE')}, u / px) * anyS + fText(btq, ${T('ALL OK')}, u / px) * (1.0 - anyS)) * 0.95);
    }
  }

  // grade: scanlines, bloom of the bright, grain
  col *= 0.94 + 0.06 * sin(gl_FragCoord.y * 1.6);
  float vig = smoothstep(1.3, 0.25, length(p0 * vec2(0.8, 1.1)));
  col *= 0.35 + 0.65 * vig;
  col = col / (1.0 + 0.25 * max(col - 0.9, 0.0));
  col += (h21(gl_FragCoord.xy + fract(uTime * 9.7) * 191.0) - 0.5) * (0.018 + 0.016 * I);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
}
export default reel
