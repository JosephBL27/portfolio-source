import type { ReelDef } from './types'

// Ember: a living flame inside a ring of ten rep ticks. Each rep is an up-down-up cycle
// (the flame squats and rises with it); the tick lights when the cycle closes, and after
// ten the ring flashes and resets. GLSL ES 1.00, bounded loops (fbm 5 x 4 calls, sparks 3).
const reel: ReelDef = {
  id: 'ember',
  projectId: 'selforge',
  title: 'Ember',
  medium: "Generative flame, after the app's code-drawn mascot",
  colors: { bg: '#0A0908', ink: '#F4E9DA', accent: '#FF6A4D' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;

#define TAU 6.2831853
#define REP 1.25
#define CYCLE 14.5

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
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(3.1, 1.7);
    a *= 0.5;
  }
  return s;
}

float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(3.1, 1.7);
    a *= 0.5;
  }
  return s * 1.143;
}

// heat 0..1 -> black body ramp: ember red, vermilion, gold, white-hot core
vec3 fireRamp(float h) {
  vec3 c = mix(vec3(0.0), vec3(0.42, 0.04, 0.015), smoothstep(0.0, 0.16, h));
  c = mix(c, vec3(1.0, 0.30, 0.15), smoothstep(0.10, 0.36, h));
  c = mix(c, vec3(1.0, 0.56, 0.18), smoothstep(0.32, 0.58, h));
  c = mix(c, vec3(1.0, 0.82, 0.44), smoothstep(0.55, 0.80, h));
  c = mix(c, vec3(1.0, 0.98, 0.93), smoothstep(0.78, 0.97, h));
  return c;
}

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float k = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * k);
}

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float px = 1.0 / uRes.y;
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float T = mod(uTime, 3600.0) + uSeed * 40.0;

  // ---- rep clock: up, down, up; tick lights as the cycle closes ----
  float lt = mod(T, CYCLE);
  float done = min(floor(lt / REP), 10.0);          // reps completed
  float ph = fract(lt / REP);                        // phase inside the current rep
  float counting = step(lt, 10.0 * REP);               // 1 while counting, 0 during the flash
  float depth = (smoothstep(0.06, 0.40, ph) - smoothstep(0.56, 0.94, ph)) * counting;
  float since = lt - 10.0 * REP;                     // seconds since the tenth rep
  float flash = (1.0 - counting) * exp(-since * 2.6);
  float lastLit = (lt - (done) * REP);               // seconds since the last tick lit
  float pop = (done > 0.5 ? exp(-lastLit * 5.0) : 0.0) * counting;

  // ---- heat shimmer: air above the flame wobbles everything behind it ----
  float shimMask = smoothstep(-0.05, 0.25, p0.y) * exp(-p0.x * p0.x * 14.0);
  vec2 shim = vec2(vnoise(p0 * 26.0 + vec2(0.0, -T * 5.0)), vnoise(p0 * 26.0 + vec2(7.3, -T * 5.0))) - 0.5;
  vec2 p = p0 + shim * 0.006 * shimMask * (0.4 + 0.6 * I);

  // ---- flame (only evaluated inside its box) ----
  float squash = 1.0 - 0.12 * depth + 0.07 * pop + 0.12 * flash;
  float H = 0.52 * squash;
  vec2 fb = vec2(0.0, -0.215);                       // flame base
  float lean = (vnoise(vec2(T * 0.45, 3.7 + uSeed * 9.0)) - 0.5) * 0.30 + (uMouse.x - 0.5) * 0.36;
  float heat = 0.0;
  if (abs(p.x) < 0.36 && p.y > fb.y - 0.14 && p.y < fb.y + H * 1.25) {
    vec2 q = (p - fb) / H;
    float y = q.y;
    float yc = clamp(y, 0.0, 1.2);
    q.x -= ((vnoise(vec2(yc * 1.3 - T * 0.8, T * 0.21 + uSeed * 5.0)) - 0.5) * 0.5 + lean) * yc * yc;
    q.x *= 1.0 + 0.12 * depth;
    vec2 nq = vec2(q.x * 2.3, y * 1.45 - T * 1.75);
    vec2 warp = vec2(fbm3(nq + vec2(1.7, uSeed * 11.0)), fbm3(nq + vec2(8.3, 2.8)));
    float n = fbm(nq * 1.7 + (warp - 0.5) * 2.2 * (0.6 + 0.4 * I) + vec2(0.0, -T * 1.1));
    float halfW = 0.29 * sqrt(clamp((y + 0.15) / 0.34, 0.0, 1.0)) * pow(clamp(1.0 - y * 0.92, 0.0, 1.0), 0.9) + 0.002;
    float ax = q.x / halfW;
    float env = clamp(1.0 - ax * ax, -1.0, 1.0) * step(-0.149, y);
    float h = env * (0.86 - y * 0.38) - (1.0 - n) * (0.20 + 1.0 * yc);
    h += 0.34 * exp(-pow(q.x / 0.07, 2.0) - pow((y - 0.10) / 0.13, 2.0));   // white-hot core
    h *= 0.92 + 0.35 * flash + 0.22 * pop;
    h = smoothstep(0.0, 0.92, h);
    heat = clamp(h + (n - 0.5) * 0.22 * h * (1.0 - h), 0.0, 1.0);   // inner striations
  }
  vec3 fire = fireRamp(heat) * smoothstep(0.015, 0.14, heat) * 1.18;

  // ---- halo light and a halftone aura: the flame's shadow-self, drawn in dots ----
  vec2 hp = (p - vec2(0.0, fb.y + H * 0.36)) * vec2(1.25, 0.95);
  float halo = exp(-length(hp) * 4.2) * (0.85 + 0.3 * flash + 0.2 * pop + 0.08 * sin(T * 11.0) * I);
  vec3 col = vec3(0.024, 0.020, 0.019);
  float cellPx = uRes.y / 72.0;
  vec2 hc = gl_FragCoord.xy / cellPx;
  vec2 hcell = floor(hc);
  vec2 hcen = (hcell + 0.5) * cellPx;                  // sample the aura at the dot centre
  vec2 pa = (hcen - 0.5 * uRes) / uRes.y;
  float aura = 0.0;
  float AH = 0.80 * squash;
  vec2 ab = vec2(0.0, -0.285);
  if (abs(pa.x) < 0.5 && pa.y > ab.y - 0.05 && pa.y < ab.y + AH * 1.15) {
    vec2 aq = (pa - ab) / AH;
    float ay = clamp(aq.y, 0.0, 1.2);
    aq.x -= ((vnoise(vec2(ay * 1.1 - T * 0.5, T * 0.13)) - 0.5) * 0.5 + lean * 0.8) * ay * ay;
    float an = fbm3(vec2(aq.x * 1.9, aq.y * 1.25 - T * 0.85) + uSeed * 3.0);
    float aw = 0.33 * sqrt(clamp((aq.y + 0.06) / 0.3, 0.0, 1.0)) * pow(clamp(1.0 - aq.y * 0.9, 0.0, 1.0), 0.8) + 0.002;
    float aax = aq.x / aw;
    aura = clamp(1.0 - aax * aax, -1.0, 1.0) * (1.0 - aq.y * 0.35) - (1.0 - an) * (0.18 + 0.85 * ay);
    aura = smoothstep(0.0, 0.55, aura) * smoothstep(0.98, 0.72, aq.y) * (0.92 + 0.25 * flash + 0.12 * pop);
  }
  float hd = length(fract(hc) - 0.5);
  float rad = sqrt(clamp(aura, 0.0, 1.0)) * 0.54;
  float dotm = 1.0 - smoothstep(rad - 0.06, rad + 0.04, hd);
  float crisp = smoothstep(2.6, 5.5, cellPx);
  float ht = mix(aura * 0.42, dotm, crisp) * step(0.04, aura);
  vec3 dotCol = mix(vec3(0.42, 0.06, 0.03), vec3(1.0, 0.36, 0.22), smoothstep(0.1, 0.9, aura));
  col += dotCol * ht * 0.78;
  col += vec3(1.0, 0.34, 0.16) * halo * 0.09;

  // ---- rep ring ----
  vec2 rp = p;
  float rr = length(rp);
  float ang = atan(rp.x, rp.y);                      // 0 at 12 o'clock, clockwise
  float a01 = fract(ang / TAU);
  // fine dial
  float minor = fract(a01 * 60.0 + 0.5) - 0.5;
  float minorD = abs(minor) * TAU * rr / 60.0;
  float dial = smoothstep(px * 1.2, 0.0, minorD - px * 0.25) * smoothstep(0.418, 0.416, rr) * smoothstep(0.404, 0.406, rr);
  float hair = smoothstep(px * 1.3, 0.0, abs(rr - 0.322)) + smoothstep(px * 1.3, 0.0, abs(rr - 0.428));
  col += vec3(0.30, 0.29, 0.28) * dial * 0.8 + vec3(0.17, 0.16, 0.155) * hair;
  // ten rep ticks
  float seg = a01 * 10.0;
  float idx = floor(seg + 0.5);
  float da = (seg - idx) / 10.0 * TAU * rr;
  idx = mod(idx, 10.0);
  float R0 = 0.338, R1 = 0.392;
  float tickD = length(vec2(da, rr - clamp(rr, R0, R1)));
  float tw = 0.0085;
  float tick = smoothstep(tw + px, tw - px, tickD);
  float tickGlow = exp(-tickD * 70.0);
  float lit = step(idx + 0.5, done);
  float fade = 1.0 - smoothstep(0.5, 1.9, since) * (1.0 - counting);   // all ticks drain after the flash
  lit *= fade;
  float isNew = step(abs(idx - (done - 1.0)), 0.1) * pop;
  float isCur = step(abs(idx - done), 0.1) * counting;
  float fillTo = R0 + (R1 - R0) * smoothstep(0.0, 0.95, ph);
  float partial = isCur * step(rr, fillTo) * (0.35 + 0.65 * depth);
  float radial = clamp((rr - R0) / (R1 - R0), 0.0, 1.0);
  vec3 litCol = mix(vec3(1.0, 0.86, 0.50), vec3(1.0, 0.36, 0.20), radial);
  litCol = mix(litCol, vec3(1.0, 0.97, 0.9), isNew * 0.8 + flash * 0.9);
  vec3 offCol = vec3(0.13, 0.125, 0.12);
  float on = max(lit, partial * 0.55);
  vec3 tickCol = offCol * (1.0 - on) + mix(vec3(0.62, 0.08, 0.03), litCol, on * on) * on;
  col = mix(col, tickCol, tick);
  col += litCol * tickGlow * (lit * 0.55 + isNew * 1.4 + partial * 0.25 + flash * 0.8) * (0.6 + 0.4 * I);

  // completion shockwave
  float wave = (1.0 - counting) * exp(-since * 1.6);
  float wr = 0.36 + since * 0.55;
  col += vec3(1.0, 0.55, 0.28) * smoothstep(0.02, 0.0, abs(rr - wr)) * wave * 0.9 * (0.5 + 0.5 * I);

  // ---- flame over everything ----
  col = col * (1.0 - smoothstep(0.0, 0.18, heat)) + fire;

  // ---- embers rising ----
  for (int L = 0; L < 3; L++) {
    float fl = float(L);
    float sc = 16.0 + fl * 10.0;
    vec2 sp = p * sc;
    float spd = 2.2 + fl * 0.9;
    sp.y -= T * spd;
    sp.x += sin(sp.y * 0.55 + fl * 2.0 + T * 0.7) * 0.35;
    vec2 id = floor(sp);
    vec2 f = fract(sp) - 0.5;
    float r1 = h21(id + fl * 31.0 + floor(uSeed * 50.0));
    vec2 off = (vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5) * 0.55;
    float ed = length((f - off) * vec2(1.0, 0.42)) * 0.85;
    float spread = 0.07 + max(p.y + 0.05, 0.0) * 0.6;
    float column = exp(-pow(p.x - lean * 0.18 * max(p.y + 0.2, 0.0), 2.0) / (spread * spread));
    float life = smoothstep(-0.06, 0.12, p.y) * (1.0 - smoothstep(0.18, 0.56, p.y + r1 * 0.14));
    float on = step(r1, 0.30 + 0.25 * I + 0.25 * flash);
    float twk = 0.55 + 0.45 * sin(T * (6.0 + r1 * 9.0) + r1 * 40.0);
    float spark = smoothstep(0.075, 0.0, ed) * on * column * life * twk;
    vec3 sc3 = mix(vec3(1.0, 0.42, 0.18), vec3(1.0, 0.85, 0.55), r1 * 2.5);
    col += sc3 * spark * (1.4 - fl * 0.3);
    col += sc3 * exp(-ed * 9.0) * on * column * life * 0.06;
  }

  // flash bloom
  col += vec3(1.0, 0.62, 0.32) * flash * exp(-length(p) * 3.0) * 0.35;

  // ---- grade: soft shoulder, vignette, grain ----
  col = col / (1.0 + 0.22 * max(col - 0.8, 0.0));
  float vig = smoothstep(1.25, 0.25, length(p0 * vec2(0.85, 1.05)));
  col *= 0.35 + 0.65 * vig;
  float g = h21(gl_FragCoord.xy + fract(T * 13.7) * 311.0) - 0.5;
  col += g * (0.035 + 0.025 * I);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
}
export default reel
