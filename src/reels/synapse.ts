import type { ReelDef } from './types'

// Second Brain, as a reel: a link graph that fires outward from one core, the way every agent boots
// from the same vault and writes back to it. Three depth layers of jittered-grid nodes (one node per
// cell, edges only between neighbours, one diagonal per block so the mesh reads as a triangulation).
// Every node has an arrival time from the core (its distance plus a hop jitter, BFS-like); a wave leaves
// the core every few seconds, pulses run along each edge from the earlier node to the later one, nodes
// flare as pulses land, and the path they lit stays warm for a moment. Waves have random reach, so some
// die out a few hops from the core and some cross the whole field. Parallax by layer follows uMouse.
const reel: ReelDef = {
  id: 'synapse',
  projectId: 'second-brain',
  title: 'Synapse',
  medium: "A link graph firing, after the vault's notes and links",
  colors: { bg: '#08080A', ink: '#EEE8DA', accent: '#FF5A3D' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;

const float SY_P = 3.4;      // seconds between waves leaving the core
const float SY_V = 2.35;     // seconds of travel per screen unit

float sh1(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float sh2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 sh22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float sss(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
vec2 srot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

float sWave(float wi, float ta, float Ls) {
  float a = sh1(wi * 3.17 + Ls * 1.31 + 0.5);
  float reach = mix(1.3, 3.8, sh1(wi * 7.13 + Ls * 2.9 + 1.5));
  return (0.45 + 0.55 * a) * sss(reach, reach * 0.45, ta);
}

float sKeep(vec2 a, vec2 b, float Ls) {
  vec2 dd = b - a;
  float hs = sh2(a + b + abs(dd) * vec2(17.3, 31.7) + Ls);
  if (abs(dd.x) + abs(dd.y) > 1.5) {
    float mainD = step(0.0, dd.x * dd.y);
    float pick = step(0.5, sh2(min(a, b) * 1.31 + Ls + 3.7));
    return (abs(mainD - pick) < 0.5 ? 1.0 : 0.0) * step(hs, 0.84);
  }
  return step(hs, 0.80);
}

// cheap cull: is the pixel within reach of the segment A-B at all
bool sNear(vec2 w, vec2 A, vec2 B, float zoom, float lim) {
  vec2 pa = w - A, ba = B - A;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) / zoom <= lim;
}

// one edge, A to B (world units); pulse runs from the earlier arrival to the later one
vec3 sEdge(vec2 w, vec2 A, vec2 B, float tA, float tB, float tl, float zoom, float lw, float soft, float px, float Ls, float vis, vec3 CREAM, vec3 VERM) {
  vec2 pa = w - A, ba = B - A;
  float ll = dot(ba, ba);
  float h = clamp(dot(pa, ba) / ll, 0.0, 1.0);
  float d = length(pa - ba * h) / zoom;
  if (d > 0.02 + soft * 3.0) return vec3(0.0);
  float norm = min(1.0, (lw + 1.5 * px) / (lw + soft));
  float core = (1.0 - sss(lw, lw + soft + px, d)) * norm;
  float t0 = min(tA, tB), t1 = max(tA, tB);
  float hh = tA <= tB ? h : 1.0 - h;
  float dl = t1 - t0 + 0.07;
  float rel = tl - t0;
  float tau = mod(rel, SY_P);
  float str = sWave(floor(rel / SY_P), t0, Ls);
  float reach = tau - hh * dl;
  float en = reach > 0.0 ? exp(-reach * 2.8) : 0.0;
  float along = (tau / dl - hh) * sqrt(ll);
  float head = tau < dl + 0.05 ? exp(-along * along * 70.0) : 0.0;
  vec3 c = CREAM * 0.06 * vis * core;
  c += mix(CREAM, VERM, 0.8) * en * 0.5 * str * (core + exp(-d / (0.004 + soft)) * 0.15 * norm);
  c += (VERM * 1.8 + vec3(1.0, 0.85, 0.75) * 1.1 * head) * head * str * (core * 1.6 + exp(-d / (0.0035 + soft)) * 0.7 * norm);
  return c;
}

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float S = min(uRes.y, uRes.x / 1.3);
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / S;
  float px = 1.0 / S;
  vec2 mo = uMouse - 0.5;
  float t = uTime + uSeed * 37.0;
  // screens of 300..760 px are shown minified (the TV renders 960x720 into a ~300 px picture), so strokes
  // widen and brighten there; at 800 px and up the drawing is untouched
  float mf = mix(clamp(uRes.y / 300.0, 1.0, 2.4), 1.0, sss(700.0, 800.0, uRes.y));
  float mb = 1.0 + 0.85 * (mf - 1.0);
  vec3 CREAM = vec3(0.93, 0.89, 0.81);
  vec3 VERM = vec3(1.0, 0.33, 0.20);
  vec3 col = vec3(0.018, 0.018, 0.022) + vec3(0.035, 0.018, 0.016) * exp(-length(p) * 2.2);

  for (int L = 0; L < 3; L++) {
    float fl = float(L);
    float dens = fl < 0.5 ? 12.5 : (fl < 1.5 ? 6.2 : 2.6);
    float par = fl < 0.5 ? 0.012 : (fl < 1.5 ? 0.032 : 0.10);
    float bright = fl < 0.5 ? 0.36 : (fl < 1.5 ? 1.0 : mix(0.20, 0.5, I));
    float soft = fl < 0.5 ? 0.0012 : (fl < 1.5 ? 0.0 : 0.012);
    float lw = (fl < 0.5 ? 0.00045 : (fl < 1.5 ? 0.0007 : 0.0016)) * mf;
    float nsc = (fl < 0.5 ? 0.6 : (fl < 1.5 ? 1.0 : 2.2)) * pow(mf, 0.7);
    float tl = t - (fl < 0.5 ? 0.5 : (fl < 1.5 ? 0.0 : -0.3));
    float ang = t * (fl < 0.5 ? 0.010 : (fl < 1.5 ? -0.006 : 0.004)) + fl * 1.7;
    float zoom = dens * (1.0 + 0.03 * sin(t * 0.17 + fl * 2.0));
    float Ls = fl * 19.31 + 0.7;
    vec2 cs = -mo * par;
    vec2 cw = vec2(0.37 + fl * 17.0, 0.61 + fl * 9.0);
    vec2 w = srot(p - cs, ang) * zoom + cw;
    vec2 ci = floor(w);
    float soft2 = soft + px;

    float vis = mix(0.30, 1.0, exp(-length(p - cs) * 1.5));
    vec2 np[9]; float ta[9]; float ex[9];
    vec3 lc = vec3(0.0);
    // nodes (computed once, drawn in the same pass)
    for (int j = 0; j < 9; j++) {
      vec2 id = ci + vec2(float(j - (j / 3) * 3) - 1.0, float(j / 3) - 1.0);
      vec2 jit = sh22(id + Ls);
      vec2 pos = id + 0.5 + (jit - 0.5) * 0.72 + 0.05 * vec2(sin(t * 0.55 + jit.x * 6.28), cos(t * 0.47 + jit.y * 6.28));
      float dist = length(pos - cw);
      float e = step(0.14, sh2(id * 1.7 + Ls)) * step(0.85, dist);
      float tn = (dist + 0.85 * sh2(id * 3.1 + Ls)) / dens * SY_V;
      np[j] = pos; ex[j] = e; ta[j] = tn;
      if (e < 0.5) continue;
      float dn = length(w - pos) / zoom;
      float hub = pow(sh2(id * 5.3 + Ls), 5.0);
      float rN = (0.0036 + 0.0095 * hub) * nsc;
      if (dn > rN * 6.0 + 0.04 + soft2 * 3.0) continue;
      float rel = tl - tn;
      float tau = mod(rel, SY_P);
      float str = sWave(floor(rel / SY_P), tn, Ls);
      float fl2 = exp(-tau * 3.0) * str;
      float rN2 = rN * (1.0 + 0.6 * fl2);
      float norm = min(1.0, (rN + px) / (rN + soft2));
      float disc = (1.0 - sss(rN2 - px, rN2 + soft2, dn)) * norm;
      float halo = exp(-dn / (rN * 2.2 + soft2 + 0.003)) * norm;
      float rip = exp(-abs(dn - (rN2 + 0.004 + tau * 0.06)) / (0.0016 + soft2)) * exp(-tau * 2.4) * str * norm;
      lc += mix(CREAM * 0.75 * vis, vec3(1.0, 0.95, 0.88) * 1.8, fl2) * disc;
      lc += VERM * (halo * ((0.015 + 0.06 * hub) * vis + 1.1 * fl2) + rip * 0.6);
    }
    // edges: centre cell to its 8 neighbours, plus the 4 ring pairs that can cross the centre cell
    for (int j = 0; j < 9; j++) {
      if (j == 4) continue;
      vec2 o = vec2(float(j - (j / 3) * 3) - 1.0, float(j / 3) - 1.0);
      if (ex[4] * ex[j] > 0.5 && sNear(w, np[4], np[j], zoom, 0.02 + soft2 * 3.0) && sKeep(ci, ci + o, Ls) > 0.5)
        lc += sEdge(w, np[4], np[j], ta[4], ta[j], tl, zoom, lw, soft2, px, Ls, vis, CREAM, VERM);
    }
    if (ex[1] * ex[3] > 0.5 && sNear(w, np[1], np[3], zoom, 0.02 + soft2 * 3.0) && sKeep(ci + vec2(0.0, -1.0), ci + vec2(-1.0, 0.0), Ls) > 0.5) lc += sEdge(w, np[1], np[3], ta[1], ta[3], tl, zoom, lw, soft2, px, Ls, vis, CREAM, VERM);
    if (ex[1] * ex[5] > 0.5 && sNear(w, np[1], np[5], zoom, 0.02 + soft2 * 3.0) && sKeep(ci + vec2(0.0, -1.0), ci + vec2(1.0, 0.0), Ls) > 0.5) lc += sEdge(w, np[1], np[5], ta[1], ta[5], tl, zoom, lw, soft2, px, Ls, vis, CREAM, VERM);
    if (ex[7] * ex[3] > 0.5 && sNear(w, np[7], np[3], zoom, 0.02 + soft2 * 3.0) && sKeep(ci + vec2(0.0, 1.0), ci + vec2(-1.0, 0.0), Ls) > 0.5) lc += sEdge(w, np[7], np[3], ta[7], ta[3], tl, zoom, lw, soft2, px, Ls, vis, CREAM, VERM);
    if (ex[7] * ex[5] > 0.5 && sNear(w, np[7], np[5], zoom, 0.02 + soft2 * 3.0) && sKeep(ci + vec2(0.0, 1.0), ci + vec2(1.0, 0.0), Ls) > 0.5) lc += sEdge(w, np[7], np[5], ta[7], ta[5], tl, zoom, lw, soft2, px, Ls, vis, CREAM, VERM);

    // the core: its first ring of links
    if (fl > 0.5 && fl < 1.5) {
      vec2 cc = floor(cw);
      for (int j = 0; j < 9; j++) {
        vec2 id = cc + vec2(float(j - (j / 3) * 3) - 1.0, float(j / 3) - 1.0);
        vec2 jit = sh22(id + Ls);
        vec2 pos = id + 0.5 + (jit - 0.5) * 0.72 + 0.05 * vec2(sin(t * 0.55 + jit.x * 6.28), cos(t * 0.47 + jit.y * 6.28));
        float dist = length(pos - cw);
        float e = step(0.14, sh2(id * 1.7 + Ls)) * step(0.85, dist) * step(dist, 1.75);
        if (e < 0.5) continue;
        float tn = (dist + 0.85 * sh2(id * 3.1 + Ls)) / dens * SY_V;
        lc += sEdge(w, cw, pos, 0.0, tn, tl, zoom, lw * 1.3, soft2, px, Ls, 1.0, CREAM, VERM) * 1.2;
      }
    }
    col += lc * bright * mb;
  }

  // core
  {
    vec2 cs = -mo * 0.032;
    float dc = length(p - cs);
    float tc = mod(t, SY_P);
    float beat = exp(-tc * 3.6);
    float rc = 0.019 * (1.0 + 0.18 * beat);
    col += vec3(1.0, 0.96, 0.9) * (1.0 - sss(rc - px, rc + px, dc)) * (1.1 + 0.9 * beat);
    col += VERM * (exp(-dc / 0.028) * 0.45 + exp(-dc / 0.11) * 0.16) * (0.55 + 0.9 * beat);
    col += CREAM * exp(-abs(dc - 0.040) / max(px, 0.0006)) * 0.22;
    float dash = step(0.5, fract(atan(p.y - cs.y, p.x - cs.x) / 6.2831853 * 48.0 + t * 0.05));
    col += CREAM * exp(-abs(dc - 0.062) / max(px, 0.0006)) * 0.13 * dash * sss(260.0, 480.0, S);
    float wf = tc / SY_V;
    col += VERM * exp(-abs(dc - wf) / 0.01) * 0.07 * (1.0 - tc / SY_P) * smoothstep(0.03, 0.08, wf) * I;
  }

  col = 1.0 - exp(-col * 1.15);
  float vig = 1.0 - sss(0.35, 1.2, length(p * vec2(0.82, 1.06)));
  col *= mix(0.38, 1.0, vig);
  col += (sh2(gl_FragCoord.xy + fract(uTime * 7.31) * 157.0) - 0.5) * mix(0.012, 0.036, I);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`,
}
export default reel
