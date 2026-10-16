import type { ReelDef } from './types'
import { FONT_GLSL, T, W } from './font'

// Surface: an implied-volatility surface being re-priced. The height field is a real SSVI surface
// (Gatheral & Jacquier 2014): total variance w = theta/2 * (1 + rho*phi*k + sqrt((phi*k + rho)^2 + 1 - rho^2)),
// phi = eta / (sqrt(theta) * sqrt(1 + theta)), theta(T) = sigma_atm(T)^2 * T with an upward ATM term structure,
// sigma = sqrt(w / T), over k in [-0.5, 0.4] and T from one week to two years (log spaced, short expiries in front).
// The front edge is a steep skewed smile (higher vol at low strikes) and the back is nearly flat. Iso-vol contours
// are drawn on the surface and a lattice of synthetic quote dots jitters around it. Every six seconds a
// scheduled rebalance lands at a point on the short end: a beam of order flow drops in, a ring of
// re-pricing runs outward through strike and expiry, the local level lifts and settles. The ripples,
// the beam, the quote dots and every number-free label are illustrative (invented parameters, not firm data).
// Raymarched in GLSL ES 1.00: <= 54 steps, 4 bisection steps, 3 normal samples, 35 quote dots. No textures.
const f1 = (n: number) => n.toFixed(1)
const reel: ReelDef = {
  id: 'surface',
  projectId: 'qvr',
  title: 'Surface',
  medium: 'An illustrative SSVI implied-volatility surface with synthetic quotes, re-priced by scheduled rebalancing flows',
  colors: { bg: '#07050F', ink: '#EFE9FF', accent: '#B48CFF' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;
${FONT_GLSL}
#define PI 3.14159265
#define PER 6.5
#define YS 2.6
#define IV0 0.10
#define XM 1.5
#define ZM 2.0

float Tm;
vec3 ro, fw, rt, upv;
float FOC, SS;

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
float eio(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }

// ---- the events: where and when a rebalance lands ----
vec2 evPos(float e) { return vec2((h21(vec2(e, 1.7)) - 0.5) * 1.9, 0.12 + 0.75 * h21(vec2(e, 4.2))); }
// ripple + local lift of one event at (x, z); returns (wave, lift)
vec2 evWave(float e, vec2 xz) {
  float age = Tm - e * PER;
  if (age < 0.0 || age > 6.0) return vec2(0.0);
  vec2 d = xz - evPos(e);
  d.y *= 1.35;
  float r = length(d);
  float front = age * 1.55 + 0.08;
  float env = smoothstep(front, front - 0.30, r);
  float wave = 0.034 * exp(-age * 0.62) * cos(r * 9.5 - age * 7.5) * exp(-r * 0.85) * env;
  float lift = 0.040 * exp(-age * 0.55) * exp(-r * r * 0.55) * eio(age * 3.0);
  return vec2(wave, lift);
}
// implied vol at (x, z): SSVI over log-moneyness k and log-spaced maturity (z = 0 front, one week; z = ZM back, two years)
float ivBase(float x, float z) {
  float m = clamp(z / ZM, 0.0, 1.0);
  float T = 0.0191781 * pow(104.2857, m);
  float k = -0.05 + 0.45 * (x / XM);
  float lvl = 0.17 + 0.010 * sin(Tm * 0.31 + z * 2.0);
  float rho = -0.70 + 0.08 * sin(Tm * 0.17 + 0.6);
  float eta = 0.80 + 0.06 * sin(Tm * 0.21 + 2.2);
  float sa = lvl * (1.0 + 0.35 * (1.0 - exp(-T / 0.6)));
  float th = sa * sa * T;
  float ph = eta / (sqrt(th) * sqrt(1.0 + th));
  float xx = ph * k + rho;
  float w = 0.5 * th * (1.0 + rho * ph * k + sqrt(xx * xx + 1.0 - rho * rho));
  return sqrt(w / T);
}
float hAt(vec2 xz) {
  float e = floor(Tm / PER);
  vec2 a = evWave(e, xz), b = evWave(e - 1.0, xz);
  return (ivBase(xz.x, xz.y) - IV0 + a.x + a.y + b.x + b.y) * YS;
}
float waveOnly(vec2 xz) {
  float e = floor(Tm / PER);
  return evWave(e, xz).x + evWave(e - 1.0, xz).x;
}

vec3 ramp(float h) {
  vec3 c = mix(vec3(0.030, 0.025, 0.150), vec3(0.24, 0.15, 0.72), smoothstep(0.0, 0.35, h));
  c = mix(c, vec3(0.56, 0.36, 1.00), smoothstep(0.25, 0.62, h));
  c = mix(c, vec3(1.00, 0.46, 0.80), smoothstep(0.55, 0.88, h));
  c = mix(c, vec3(1.00, 0.88, 0.94), smoothstep(0.85, 1.05, h));
  return c;
}
vec2 scr(vec3 P) { vec3 v = P - ro; return FOC * vec2(dot(v, rt), dot(v, upv)) / dot(v, fw); }

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float S = min(uRes.y, uRes.x / 1.45);
  SS = S;
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uRes) / S;
  float px = 1.0 / S;
  vec2 mo = uMouse - 0.5;
  Tm = mod(uTime, 7200.0) + uSeed * PER * 4.0;
  float evIdx = floor(Tm / PER);
  float age = Tm - evIdx * PER;

  // camera: a slow sway, the pointer swings it
  FOC = 1.85;
  float az = 0.30 + 0.20 * sin(Tm * 0.11) + mo.x * 0.55;
  float el = 0.50 + 0.04 * sin(Tm * 0.09) + mo.y * 0.22;
  float R = 6.3;
  vec3 tg = vec3(-0.1, 0.62, 0.95);
  ro = tg + R * vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el));
  fw = normalize(tg - ro);
  rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  upv = cross(fw, rt);
  vec3 rd = normalize(fw * FOC + rt * p0.x + upv * p0.y);

  // ground: a deep violet haze, brighter low on the screen behind the plot
  vec3 col = mix(vec3(0.020, 0.012, 0.045), vec3(0.004, 0.003, 0.010), smoothstep(-0.5, 0.55, p0.y));
  col += vec3(0.10, 0.045, 0.22) * exp(-dot(p0 - vec2(0.0, -0.08), p0 - vec2(0.0, -0.08)) * 2.4) * 0.55;

  // ---- ray vs the plot box ----
  vec3 bmin = vec3(-XM, 0.0, 0.0), bmax = vec3(XM, 1.75, ZM);
  vec3 inv = 1.0 / rd;
  vec3 t0v = (bmin - ro) * inv, t1v = (bmax - ro) * inv;
  vec3 tmn = min(t0v, t1v), tmx = max(t0v, t1v);
  float tn = max(max(tmn.x, tmn.y), tmn.z), tf = min(min(tmx.x, tmx.y), tmx.z);
  float tHit = 1e9;
  bool hit = false;
  vec3 hp = vec3(0.0), nrm = vec3(0.0, 1.0, 0.0);
  float wall = 0.0;
  if (tf > max(tn, 0.0)) {
    float t = max(tn, 0.0) + 0.002;
    vec3 p = ro + rd * t;
    if (p.y < hAt(p.xz) + 0.0005) {
      hit = true; wall = 1.0; hp = p; tHit = t;
      vec3 a = abs(p - clamp(p, bmin, bmax));
      nrm = (abs(p.z - bmin.z) < 0.01) ? vec3(0.0, 0.0, -1.0) : (p.x < 0.0 ? vec3(-1.0, 0.0, 0.0) : vec3(1.0, 0.0, 0.0));
    } else {
      float tprev = t;
      float lim = 36.0 + 18.0 * I;
      for (int i = 0; i < 54; i++) {
        if (float(i) > lim) break;
        p = ro + rd * t;
        float d = p.y - hAt(p.xz);
        if (d < 0.0) { hit = true; break; }
        tprev = t;
        t += max(0.012, d * 0.42);
        if (t > tf) break;
      }
      if (hit) {
        float a = tprev, b = t;
        for (int j = 0; j < 4; j++) {
          float m = 0.5 * (a + b);
          vec3 q = ro + rd * m;
          if (q.y < hAt(q.xz)) b = m; else a = m;
        }
        tHit = 0.5 * (a + b);
        hp = ro + rd * tHit;
      }
    }
  }

  // ---- shade ----
  if (hit) {
    float pf = tHit / (FOC * S);                       // world size of one screen pixel here
    if (wall < 0.5) {
      float e = 0.010;
      float hx = hAt(hp.xz + vec2(e, 0.0)) - hAt(hp.xz - vec2(e, 0.0));
      float hz = hAt(hp.xz + vec2(0.0, e)) - hAt(hp.xz - vec2(0.0, e));
      nrm = normalize(vec3(-hx, 2.0 * e, -hz));
      float slope = length(vec2(hx, hz)) / (2.0 * e);
      float hn = pow(clamp((hp.y / YS - 0.02) / 0.5, 0.0, 1.1), 0.72);
      vec3 base = ramp(hn);
      vec3 L = normalize(vec3(-0.45, 0.80, -0.40));
      float dif = max(dot(nrm, L), 0.0);
      float fres = pow(1.0 - max(dot(nrm, -rd), 0.0), 3.0);
      vec3 c = base * (0.30 + 0.80 * dif);
      c += vec3(0.55, 0.40, 1.00) * fres * 0.45;
      // strike lines (x) and expiry lines (z): fine, with a bolder every fourth
      float lw = max(pf * 0.85, 0.0007);
      float gx = abs(fract(hp.x * 3.3333 + 0.5) - 0.5) / 3.3333;
      float gz = abs(fract(hp.z * 5.0 + 0.5) - 0.5) / 5.0;
      float mx = abs(fract(hp.x * 0.8333 + 0.5) - 0.5) / 0.8333;
      float mz = abs(fract(hp.z * 1.25 + 0.5) - 0.5) / 1.25;
      float grid = max(smoothstep(lw * 1.3, 0.0, gx - lw * 0.4), smoothstep(lw * 1.3, 0.0, gz - lw * 0.4));
      float major = max(smoothstep(lw * 1.6, 0.0, mx - lw * 0.6), smoothstep(lw * 1.6, 0.0, mz - lw * 0.6));
      c = mix(c, vec3(0.78, 0.66, 1.0), grid * 0.38 + major * 0.40);
      // iso-vol contours
      float cf = (hp.y / YS + IV0) / 0.025;
      float cd = abs(fract(cf + 0.5) - 0.5) * 0.025 * YS;
      float contour = smoothstep(max(pf * slope * 1.1, 0.0006) + 0.0004, 0.0, cd);
      c = mix(c, vec3(1.0, 0.86, 0.96), contour * 0.30);
      // re-pricing crests glow
      float wv = waveOnly(hp.xz);
      c += vec3(0.60, 0.88, 1.0) * pow(clamp(abs(wv) / 0.034, 0.0, 1.2), 2.0) * 0.55;
      // the new level lifts and fades back
      c += vec3(1.0, 0.55, 0.85) * clamp(evWave(evIdx, hp.xz).y / 0.04, 0.0, 1.0) * 0.32;
      // front edge = the SSVI slice, drawn hot
      float fe = smoothstep(lw * 3.0, 0.0, hp.z - 0.0) * 0.0;
      c += vec3(1.0, 0.92, 1.0) * smoothstep(0.012 + lw * 2.0, 0.0, hp.z) * 0.55;
      col = c;
      // distance haze
      col = mix(col, vec3(0.020, 0.012, 0.050), smoothstep(4.0, 8.0, tHit) * 0.6);
    } else {
      // a wall of the plot box, below the surface: dark glass with level lines and the profile edge
      float hh = hAt(hp.xz);
      vec3 wc = mix(vec3(0.020, 0.014, 0.075), vec3(0.11, 0.06, 0.30), smoothstep(0.0, hh, hp.y));
      wc *= 0.55 + 0.35 * (abs(nrm.x) > 0.5 ? 0.6 : 1.0);
      float lw = max(pf * 0.9, 0.0007);
      float lv = abs(fract(hp.y * 4.5 + 0.5) - 0.5) / 4.5;
      float hz = nrm.z != 0.0 ? abs(fract(hp.x * 3.3333 + 0.5) - 0.5) / 3.3333 : abs(fract(hp.z * 5.0 + 0.5) - 0.5) / 5.0;
      wc = mix(wc, vec3(0.62, 0.50, 1.0), smoothstep(lw * 1.2, 0.0, lv) * 0.22);
      wc = mix(wc, vec3(0.62, 0.50, 1.0), smoothstep(lw * 1.2, 0.0, hz) * 0.10);
      // profile edge: the top of the wall is the cut through the surface
      float edge = smoothstep(0.016 + lw * 2.0, 0.0, hh - hp.y);
      wc += vec3(0.95, 0.80, 1.0) * edge * 0.95;
      col = wc;
    }
  }

  // ---- an order-flow beam drops onto the surface at the event ----
  {
    vec2 ep = evPos(evIdx);
    float h0 = hAt(ep) ;
    vec2 u = ro.xz - ep, w = rd.xz;
    float tc = -dot(u, w) / max(dot(w, w), 1e-6);
    vec2 dh = u + w * tc;
    float yc = ro.y + rd.y * tc;
    float beamTop = h0 + 1.15;
    float vis = step(0.0, tc) * step(tc, tHit) * smoothstep(h0 - 0.05, h0 + 0.02, yc) * smoothstep(beamTop, beamTop - 0.5, yc);
    float strike = exp(-age * 2.2) * smoothstep(0.0, 0.05, age);
    float sw = 0.012 + 0.010 * tc * 0.12;
    col += vec3(0.85, 0.72, 1.0) * exp(-dot(dh, dh) / (sw * sw)) * vis * strike * 1.6;
    col += vec3(0.50, 0.32, 1.0) * exp(-dot(dh, dh) / (sw * sw * 36.0)) * vis * strike * 0.35;
    // a flare where it lands
    vec2 sp = scr(vec3(ep.x, h0, ep.y));
    col += vec3(1.0, 0.88, 1.0) * exp(-length(p0 - sp) / 0.020) * exp(-age * 3.0) * 0.8;
    col += vec3(0.65, 0.45, 1.0) * exp(-length((p0 - sp) * vec2(1.0, 2.6)) / 0.12) * exp(-age * 1.6) * 0.30;
    // its name, riding above the beam for a moment
    vec2 lp = scr(vec3(ep.x, h0 + 0.75, ep.y));
    float u0 = 0.0030;
    float lab = fText((p0 - lp - vec2(0.012, -0.006)) / u0, ${T('REBALANCE')}, u0 / px);
    col = mix(col, vec3(0.92, 0.84, 1.0), lab * smoothstep(0.1, 0.4, age) * smoothstep(3.0, 2.2, age) * 0.95);
    float tick = smoothstep(px * 1.4, 0.0, abs(p0.x - lp.x) - 0.0004) * step(p0.y, lp.y) * step(sp.y, p0.y);
    col += vec3(0.8, 0.7, 1.0) * tick * 0.0;
  }

  // ---- axis names: billboards anchored to the plot box ----
  {
    float u = 0.0028;
    vec3 gcol = vec3(0.62, 0.55, 0.86);
    vec2 a1 = scr(vec3(0.0, -0.06, -0.12));
    col = mix(col, gcol, fText((p0 - a1 + vec2(${f1(W('STRIKE') * 0.5)} * u, 0.0)) / u, ${T('STRIKE')}, u / px) * 0.85);
    vec2 a2 = scr(vec3(-XM - 0.18, 0.0, 1.0));
    col = mix(col, gcol, fText((p0 - a2 + vec2(${f1(W('EXPIRY'))} * u, 0.0)) / u, ${T('EXPIRY')}, u / px) * 0.85);
    vec2 a3 = scr(vec3(-XM, 1.68, 0.0));
    col = mix(col, gcol, fText((p0 - a3 + vec2(${f1(W('IMPLIED VOL'))} * u * 0.0, -0.01)) / u, ${T('IMPLIED VOL')}, u / px) * 0.85);
    vec2 a4 = scr(vec3(0.0, 0.0, -0.02));
    col = mix(col, vec3(0.92, 0.86, 1.0), fText((p0 - a4 - vec2(-${f1(W('ATM') * 0.5)} * u, 0.044)) / u, ${T('ATM')}, u / px) * 0.0);
    vec2 a5 = scr(vec3(XM, (ivBase(XM, 0.0) - IV0) * YS, 0.0));
    col = mix(col, vec3(1.0, 0.90, 1.0), fText((p0 - a5 - vec2(0.018, 0.0)) / u, ${T('SSVI SLICE')}, u / px) * 0.95);
    // the front edge's end cap
    col += vec3(1.0, 0.9, 1.0) * exp(-length(p0 - a5) / 0.006) * 0.5;
  }

  // ---- synthetic quotes: a 7 x 5 lattice of listed quotes jittering around the surface ----
  if (I > 0.05) {
    float qd = 0.0;
    for (int a = 0; a < 7; a++) {
      float fa = float(a);
      float qx = (-0.9 + 0.3 * fa) * XM;
      for (int b = 0; b < 5; b++) {
        float fb = float(b);
        float qz = (0.08 + 0.21 * fb) * ZM;
        // a dot rides a vertical line through the plot, so test the pixel against that line first (cheap)
        vec2 sa = scr(vec3(qx, 0.0, qz)), sb = scr(vec3(qx, 1.6, qz));
        vec2 pa = p0 - sa, ba = sb - sa;
        float hs = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        if (length(pa - ba * hs) > 0.035) continue;
        vec2 qid = vec2(fa, fb);
        float n1 = h21(qid + 3.1), n2 = h21(qid + 9.7);
        float nz = sin(Tm * (0.9 + 0.8 * n1) + n1 * 40.0) * 0.6 + sin(Tm * 0.37 + n2 * 30.0) * 0.5;
        vec3 P = vec3(qx, hAt(vec2(qx, qz)) + 0.006 * (1.0 + 0.9 * abs(qx / XM)) * nz * YS + 0.022, qz);
        float dq = length(p0 - scr(P));
        float vis = step(length(P - ro), tHit + 0.07);
        float flick = 0.65 + 0.35 * sin(Tm * (1.6 + n2) + n1 * 20.0);
        qd += (exp(-dq * dq / (0.0058 * 0.0058)) + 0.22 * exp(-dq / 0.017)) * vis * flick;
      }
    }
    col += vec3(1.0, 0.93, 0.78) * qd * 0.9;
  }
  // its legend, bottom right
  {
    float u = 0.0025;
    vec2 lq = (p0 - vec2(0.34, -0.455)) / u;
    float lab = fText(lq, ${T('SYNTHETIC')}, u / px) + fText(lq - vec2(57.0, 0.0), ${T('QUOTES')}, u / px);
    col = mix(col, vec3(0.62, 0.55, 0.86), clamp(lab, 0.0, 1.0) * 0.8);
    col += vec3(1.0, 0.93, 0.78) * exp(-length(p0 - vec2(0.322, -0.4585)) / 0.0045) * 0.9;
  }

  // ---- the four research threads, bottom left ----
  {
    float u = 0.0027;
    float act = age < 1.4 ? 0.0 : (age < 3.0 ? 1.0 : (age < 5.0 ? 2.0 : 3.0));
    for (int j = 0; j < 4; j++) {
      float fj = float(j);
      float on = abs(fj - act) < 0.5 ? 1.0 : 0.0;
      vec2 q = (p0 - vec2(-0.70 + fj * 0.0, -0.44 + fj * 0.0));
      float x = -0.70 + (fj < 0.5 ? 0.0 : (fj < 1.5 ? 0.115 : (fj < 2.5 ? 0.30 : 0.44)));
      vec2 lq = (p0 - vec2(x, -0.455)) / u;
      float lab = fj < 0.5 ? fText(lq, ${T('FLOWS')}, u / px) : (fj < 1.5 ? fText(lq, ${T('FAIR VALUE')}, u / px) : (fj < 2.5 ? fText(lq, ${T('SURFACE')}, u / px) : fText(lq, ${T('TEST')}, u / px)));
      col = mix(col, mix(vec3(0.38, 0.34, 0.55), vec3(0.95, 0.90, 1.0), on), lab * (0.65 + 0.35 * on));
      col += vec3(0.7, 0.55, 1.0) * smoothstep(0.0012 + px, 0.0, abs(p0.y + 0.468) - 0.0006) * step(x, p0.x) * step(p0.x, x + (fj < 0.5 ? 0.09 : (fj < 1.5 ? 0.17 : (fj < 2.5 ? 0.115 : 0.065)))) * on * 0.9;
    }
  }

  // ---- stars of dust in the haze ----
  {
    vec2 g = p0 * 24.0 + vec2(0.0, -Tm * 0.15);
    vec2 id = floor(g), f = fract(g) - 0.5;
    float r = h21(id);
    vec2 off = (vec2(h21(id + 1.3), h21(id + 4.7)) - 0.5) * 0.6;
    col += vec3(0.7, 0.6, 1.0) * smoothstep(0.06, 0.0, length(f - off)) * step(0.90, r) * (0.5 + 0.5 * sin(Tm * (1.0 + r) + r * 30.0)) * 0.35 * (hit ? 0.2 : 1.0);
  }

  // ---- grade ----
  col = col / (1.0 + 0.22 * max(col - 0.9, 0.0));
  float vig = smoothstep(1.3, 0.25, length(p0 * vec2(0.8, 1.1)));
  col *= 0.35 + 0.65 * vig;
  col += (h21(gl_FragCoord.xy + fract(uTime * 9.7) * 191.0) - 0.5) * (0.018 + 0.018 * I);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
}
export default reel
