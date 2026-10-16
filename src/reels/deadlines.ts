import type { ReelDef } from './types'

// Recruiting OS, as a reel: exactly 447 points (one per tracked program) laid on an endless
// 52-week calendar floor with seven colour lanes, seen in perspective with a depth of field that
// racks to follow the "now" line. The camera rides the line. Points ahead of it are hollow and dim;
// they swell, fill and lock on as it approaches, flash and throw rings across the floor as it passes,
// then settle to embers. The floor swells into a wake around the line, a light curtain stands on it
// and fountains sparks from every point it crosses, a wall of stacked bars behind the lanes (one
// stack per week, one colour per lane) rises as the line passes, and every lane keeps a running tally.
// Positions are generative (a monotone warp per lane so deadlines cluster the way seasons do); the
// count is the real one: 92+41+77+58+66+49+64 = 447. The point lookup inverts the warp with Newton
// steps, so a pixel only tests the few points around it in its own lane and the nearer neighbour.
const reel: ReelDef = {
  id: 'deadlines',
  projectId: 'recruiting-os',
  title: '447 deadlines',
  medium: 'Every tracked program as a point on the calendar',
  colors: { bg: '#07080D', ink: '#F4F1E8', accent: '#F2C14E' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;

const float DL_W = 52.0;        // weeks in the (endless, periodic) calendar
const float DL_LW = 2.4;        // lane width, world z
const float DL_ZMAX = 16.8;     // 7 lanes
const float DL_ZW = 17.2;       // the bar wall behind the lanes
const float DL_VEL = 1.45;      // weeks per second, the pace of the now line
const float DL_TAU = 6.2831853;

float dh1(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float dh2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float dss(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }

// points per lane; sums to 447
float dN(float l) { return l < 0.5 ? 92.0 : (l < 1.5 ? 41.0 : (l < 2.5 ? 77.0 : (l < 3.5 ? 58.0 : (l < 4.5 ? 66.0 : (l < 5.5 ? 49.0 : 64.0))))); }
vec3 dLane(float l) {
  if (l < 0.5) return vec3(1.00, 0.30, 0.24);
  if (l < 1.5) return vec3(1.00, 0.55, 0.16);
  if (l < 2.5) return vec3(1.00, 0.80, 0.24);
  if (l < 3.5) return vec3(0.92, 0.94, 0.98);
  if (l < 4.5) return vec3(0.28, 0.90, 0.58);
  if (l < 5.5) return vec3(0.24, 0.72, 1.00);
  return vec3(0.62, 0.50, 1.00);
}
vec2 dPh(float l) { return vec2(dh1(l * 3.7 + 0.2), dh1(l * 5.1 + 0.9)); }
// monotone season warp, 0..1 -> 0..1, periodic (slope stays between 0.35 and 1.65)
float dWarp(float u, vec2 ph) {
  float x = u - 0.45 * sin(DL_TAU * (2.0 * u + ph.x)) / 12.566371 - 0.2 * sin(DL_TAU * (5.0 * u + ph.y)) / 31.415927;
  float x0 = -0.45 * sin(DL_TAU * ph.x) / 12.566371 - 0.2 * sin(DL_TAU * ph.y) / 31.415927;
  return x - x0;
}
float dWarpD(float u, vec2 ph) { return 1.0 - 0.45 * cos(DL_TAU * (2.0 * u + ph.x)) - 0.2 * cos(DL_TAU * (5.0 * u + ph.y)); }
float dInv(float x, vec2 ph) { float u = x; for (int it = 0; it < 4; it++) u = clamp(u - (dWarp(u, ph) - x) / dWarpD(u, ph), 0.0, 1.0); return u; }
float dLine(float d, float hw, float aa) { return (1.0 - dss(0.0, hw + aa, d)) * (hw / (hw + aa)); }
// point j of lane l: x in the 0..W calendar, z offset in the lane, weight
float dXj(float j, float l, float Nn, vec2 ph) { float hj = dh2(vec2(j, l) + 0.37); return dWarp((j + 0.5 + 0.36 * (hj - 0.5)) / Nn, ph) * DL_W; }

// the floor swells into a wake around the line (d = weeks ahead of it)
float dH(float d) { return 0.50 * (d > 0.0 ? exp(-d / 2.2) : exp(d / 3.2) * cos(d * 1.45)); }

// 3x5 pixel digits
float dGlyph(float d, vec2 g) {
  if (g.x < 0.0 || g.x >= 3.0 || g.y < 0.0 || g.y >= 5.0) return 0.0;
  float b = d < 0.5 ? 31599.0 : (d < 1.5 ? 11415.0 : (d < 2.5 ? 29671.0 : (d < 3.5 ? 29647.0 : (d < 4.5 ? 23497.0 :
            (d < 5.5 ? 31183.0 : (d < 6.5 ? 31215.0 : (d < 7.5 ? 29257.0 : (d < 8.5 ? 31727.0 : 31695.0))))))));
  float idx = 14.0 - (floor(g.y) * 3.0 + floor(g.x));
  return mod(floor(b / exp2(idx)), 2.0);
}
// g.x in cells from the left edge of the first digit, g.y in cells from the top; returns ink, z = leading-zero flag
vec2 dNum(float v, vec2 g, float nd) {
  float slot = floor(g.x / 4.0);
  if (slot < 0.0 || slot >= nd) return vec2(0.0);
  float place = nd - 1.0 - slot;
  float sc = place < 0.5 ? 1.0 : (place < 1.5 ? 10.0 : 100.0);
  float dig = mod(floor(v / sc + 0.001), 10.0);
  float lead = (v < sc - 0.5 && place > 0.5) ? 1.0 : 0.0;
  return vec2(dGlyph(dig, vec2(g.x - slot * 4.0, g.y)), lead);
}
// how many points of lane l the line has passed at wrapped position xn; .y = x of the last one
vec2 dTally(float l, float xn) {
  float Nn = dN(l); vec2 ph = dPh(l);
  float u = dInv(xn / DL_W, ph);
  float je = floor(u * Nn);
  float cnt = max(je - 2.0, 0.0), last = -9.0;
  for (int k = -2; k <= 2; k++) {
    float j = je + float(k);
    if (j < 0.0 || j > Nn - 0.5) continue;
    float Xj = dXj(j, l, Nn, ph);
    if (Xj < xn) { cnt = j + 1.0; last = Xj; }
  }
  return vec2(cnt, last);
}

// the wall of stacked bars: one stack per week, one segment per lane, height = that lane's density.
// Ahead of the line a stack is only a ghost outline; as the line passes it fills from the base.
vec3 dWall(float X, float Y, float now, float aa, float pulse) {
  float Xa = X + now;
  float wk = floor(Xa);
  float xc = wk + 0.5;
  float cyc = floor(xc / DL_W);
  float xw = xc - cyc * DL_W;
  float rel = xc - now;
  float age = -rel / DL_VEL;
  float fx = Xa - wk;
  float bx = 0.5 - abs(fx - 0.5);
  float covX = dss(0.055 - aa, 0.055 + aa, bx);
  float gf = rel > 0.0 ? 0.0 : 1.0 - exp(-age * 2.4) * cos(age * 6.0);
  float lit = rel > 0.0 ? 0.0 : exp(-age * 5.0);
  float afterglow = rel > 0.0 ? 0.0 : exp(-age * 0.22);
  float cum = 0.0;
  vec3 c = vec3(0.0);
  float ew = aa * 1.2 + 0.012;
  for (int l = 0; l < 7; l++) {
    float fl = float(l);
    float Nn = dN(fl); vec2 ph = dPh(fl);
    float u = dInv(xw / DL_W, ph);
    float seg = Nn / (DL_W * dWarpD(u, ph)) * 0.46;
    float y0 = cum, y1 = cum + seg, yf = y0 + seg * gf;
    vec3 lc = dLane(fl);
    float inFill = dss(y0 - aa, y0 + aa, Y) * (1.0 - dss(yf - aa, yf + aa, Y));
    float inGhost = dss(y0 - aa, y0 + aa, Y) * (1.0 - dss(y1 - aa, y1 + aa, Y));
    float edge = exp(-abs(Y - y1) / ew) + exp(-abs(Y - y0) / ew);
    float bright = 0.13 + 0.42 * afterglow + 1.5 * lit;
    c += lc * (inFill * bright + inGhost * 0.030 * (1.0 - gf * 0.6) + edge * (rel > 0.0 ? 0.075 : 0.20 + 0.7 * lit) * min(1.0, 0.04 / ew + 0.3));
    cum = y1;
  }
  c *= covX;
  c += vec3(1.0, 0.96, 0.9) * exp(-abs(Y - cum) / (aa * 1.4 + 0.012)) * (rel > 0.0 ? 0.10 : 0.30 + 1.3 * lit) * covX;
  c *= 1.0 + 1.6 * exp(-abs(rel) / 1.6) + 1.4 * pulse * exp(-abs(rel) * 0.12);
  return c;
}

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float S = min(uRes.y, uRes.x / 1.5);
  // tall canvases (phones, the case view): close in so the lanes fill the frame
  float tall = clamp((1.2 - uRes.x / uRes.y) * 1.6, 0.0, 1.0);
  S *= mix(1.0, 1.7, tall);
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / S;
  float px = 1.0 / S;
  vec2 mo = uMouse - 0.5;
  float T = uTime + uSeed * 40.0;
  float now = mod(T * DL_VEL, DL_W);
  // screens of 300..760 px are shown minified (the TV renders 960x720 into a ~300 px picture): bolder strokes there
  float mf = mix(clamp(uRes.y / 300.0, 1.0, 2.4), 1.0, dss(700.0, 800.0, uRes.y));
  float pscale = mix(1.5, 1.0, I) * (1.0 + 0.4 * (mf - 1.0));
  // quarter ends (every 13 weeks): the line flares, a shock runs out along the floor, the camera leans in
  float qa = mod(now, 13.0) / DL_VEL;
  float pulse = exp(-qa * 2.4) * (now < 13.0 ? 1.7 : 1.0);

  // camera rides the line (x = 0 is the line): low three-quarter view over the lanes
  float yaw = -0.36 + 0.05 * sin(T * 0.071) + mo.x * 0.14;
  float pit = 0.60 + 0.025 * sin(T * 0.053 + 1.0) + mo.y * 0.08;
  float cd = mix(21.0, 28.0, I) * (1.0 - 0.03 * pulse);
  vec3 tgt = vec3(mix(3.2, 5.6, I) * (1.0 - 0.8 * tall), 0.0, 8.6);
  vec3 ro = tgt + cd * vec3(sin(yaw) * cos(pit), sin(pit), -cos(yaw) * cos(pit));
  vec3 fw = normalize(tgt - ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  const float FOVK = 0.64;
  vec3 rd = normalize(fw + (p.x * rt + p.y * up) * FOVK);

  float tf = length(vec3(0.0, 0.0, 6.0) - ro);   // focus: the line, mid lanes
  float dofk = 0.0062 * mix(0.45, 1.0, I);

  vec3 col = mix(vec3(0.030, 0.026, 0.040), vec3(0.012, 0.012, 0.022), dss(-0.5, 0.55, p.y));
  float tFloor = 1e9;
  vec3 hp = vec3(0.0);
  if (rd.y < -0.0008) {
    float t = -ro.y / rd.y;
    for (int i = 0; i < 5; i++) { vec3 q = ro + rd * t; t = (ro.y - dH(q.x)) / (-rd.y); }
    tFloor = t; hp = ro + rd * t;
  }
  float tWall = rd.z > 1e-4 ? (DL_ZW - ro.z) / rd.z : 1e9;
  bool wallHit = tWall > 0.0 && tWall < tFloor;
  float tEnd = min(tFloor, tWall);

  if (wallHit) {
    vec3 wp = ro + rd * tWall;
    float blur = dofk * abs(tWall - tf);
    float aa = tWall * FOVK * px * 1.2 + blur;
    float fog = exp(-max(tWall - 26.0, 0.0) * 0.022);
    vec3 w = dWall(wp.x, wp.y, now, aa, pulse);
    // base line where the wall meets the ground
    w += vec3(0.8, 0.8, 0.9) * exp(-abs(wp.y) / (aa * 1.2 + 0.02)) * 0.12;
    col += w * fog;
  } else if (tFloor < 1e8 && hp.z < DL_ZW + 0.1) {
    float X = hp.x, Z = hp.z;
    float tp = tFloor;
    float Xa = X + now;
    float cyc = floor(Xa / DL_W);
    float fp = tp * FOVK * px;
    float fz = fp / max(-rd.y, 0.12);
    float blur = dofk * abs(tp - tf);
    float fog = exp(-max(tp - 24.0, 0.0) * 0.030);
    float inZ = dss(-0.3, 0.0, Z) * (1.0 - dss(DL_ZMAX, DL_ZMAX + 0.3, Z));
    vec3 pc = vec3(0.026, 0.028, 0.040) * inZ;
    float aaX = fp * 1.3 + blur, aaZ = fz * 1.3 + blur;

    // lanes: panel tint, rail, and the afterglow the line leaves behind
    float lane0 = floor(Z / DL_LW);
    float zc = Z - (lane0 + 0.5) * DL_LW;
    float lcl = clamp(lane0, 0.0, 6.0);
    vec3 lc0 = dLane(lcl);
    float behind = 1.0 - dss(-0.3, 0.3, X);
    float trail = exp(min(X, 0.0) * 0.26) * behind;
    pc += lc0 * 0.020 * inZ;
    pc += lc0 * dLine(abs(zc), 0.035 * mf, aaZ) * (0.16 + 1.1 * trail) * inZ;
    pc += lc0 * exp(-abs(zc) / 0.55) * 0.20 * trail * inZ;
    pc += lc0 * exp(-abs(zc) / 1.3) * 0.045 * trail * inZ;

    // calendar grid: weeks, months, quarters, lane borders, week ticks on the near edge
    float wk = abs(fract(Xa + 0.5) - 0.5);
    float mth = abs(fract(Xa / 4.3333333 + 0.5) - 0.5) * 4.3333333;
    float qtr = abs(fract(Xa / 13.0 + 0.5) - 0.5) * 13.0;
    float lz = abs(fract(Z / DL_LW + 0.5) - 0.5) * DL_LW;
    float dense = 1.0 - dss(0.10, 0.34, fp);
    vec3 gcol = vec3(0.80, 0.82, 0.92);
    pc += gcol * dLine(wk, 0.006, aaX) * 0.12 * dense * inZ;
    pc += gcol * dLine(mth, 0.012, aaX) * 0.24 * inZ;
    pc += gcol * dLine(qtr, 0.020, aaX) * 0.30 * inZ;
    pc += gcol * dLine(lz, 0.010, aaZ) * 0.20 * step(-0.01, Z) * step(Z, DL_ZMAX + 0.01);
    float tick = dLine(wk, 0.02, aaX) * step(-0.62, Z) * step(Z, -0.16) + dLine(mth, 0.035, aaX) * step(-1.1, Z) * step(Z, -0.16);
    pc += gcol * min(tick, 1.0) * 0.40;

    // the now line on the floor, its glow, warm spill ahead of it
    float zin = dss(-1.4, 0.0, Z) * (1.0 - dss(DL_ZMAX, DL_ZMAX + 1.4, Z));
    pc += vec3(1.0, 0.97, 0.92) * dLine(abs(X), 0.045 * mf, aaX) * 3.4 * (1.0 + 1.1 * pulse) * zin;
    pc += vec3(1.0, 0.84, 0.62) * (exp(-abs(X) / 0.45) * 0.30 + exp(-abs(X) / 2.2) * 0.09) * zin;
    pc += vec3(1.0, 0.80, 0.55) * (X > 0.0 ? exp(-X / 6.0) * 0.045 : 0.0) * inZ;
    pc += vec3(1.0, 0.88, 0.70) * exp(-abs(abs(X) - qa * 8.0) / (0.30 + qa * 0.5)) * exp(-qa * 1.2) * 0.55 * inZ;

    // points: this lane and the nearer neighbour lane
    float zl0 = Z - (lane0 + 0.5) * DL_LW;
    for (int li = 0; li < 2; li++) {
      float lane = lane0 + (li == 0 ? 0.0 : (zl0 > 0.0 ? 1.0 : -1.0));
      if (lane < -0.5 || lane > 6.5) continue;
      float Nn = dN(lane);
      vec2 ph = dPh(lane);
      vec3 lc = dLane(lane);
      float zl = Z - (lane + 0.5) * DL_LW;
      float Xw = Xa - cyc * DL_W;
      float u = dInv(Xw / DL_W, ph);
      float jc = floor(u * Nn);
      for (int k = -3; k <= 3; k++) {
        float j = jc + float(k);
        float jw = j, sh = 0.0;
        if (j < -0.5) { jw = j + Nn; sh = -DL_W; }
        else if (j > Nn - 0.5) { jw = j - Nn; sh = DL_W; }
        float Xrel = dXj(jw, lane, Nn, ph) + sh + cyc * DL_W - now;   // weeks ahead of the line
        float Zj = (dh2(vec2(lane, jw) * 1.31 + 4.1) - 0.5) * 0.7;
        float wj = 0.80 + 0.95 * pow(dh2(vec2(jw, lane) * 0.77 + 8.3), 2.0);
        vec2 dv = vec2(X - Xrel, zl - Zj);
        float dd = length(dv);
        if (dd > 2.1 + blur * 3.0) continue;
        float aaP = fp * 0.9 + blur;
        float R0 = 0.115 * wj * pscale;
        vec3 add = vec3(0.0);
        if (Xrel > 0.0) {
          float a = exp(-Xrel / 4.2);
          float R = R0 * (1.0 + 0.6 * a * a * a);
          float norm = min(1.0, (R * R) / ((R + aaP * 0.6) * (R + aaP * 0.6)));
          float disc = (1.0 - dss(max(R - aaP * 0.5, 0.0), R + aaP, dd)) * norm;
          float fill = a * a;
          float br = 0.50 + 0.7 * a + 2.0 * a * a * a;
          float rw = 0.016 * pscale + aaP * 0.7;
          float hollow = exp(-abs(dd - R * 1.5) / rw) * min(1.0, 0.03 / rw + 0.5) * norm;
          vec3 pcol = mix(lc, vec3(1.0, 0.97, 0.93), 0.5 * a * a * a);
          add += pcol * (disc * (0.30 + 0.9 * fill) * br + hollow * 0.55 * (1.0 - 0.7 * fill));
          add += lc * exp(-dd / (R * 2.2 + aaP + 0.02)) * br * 0.26 * norm;
          if (Xrel < 1.8) {
            float rr = R * 1.5 + 0.06 + Xrel * 0.34;
            add += lc * exp(-abs(dd - rr) / (0.010 + aaP * 0.6)) * (1.0 - Xrel / 1.8) * 0.9 * norm * mix(0.6, 1.0, I);
          }
        } else {
          float age = -Xrel / DL_VEL;
          float fl = exp(-age * 3.2);
          float R = R0 * (1.0 + 1.1 * fl);
          float norm = min(1.0, (R * R) / ((R + aaP * 0.6) * (R + aaP * 0.6)));
          float disc = (1.0 - dss(max(R - aaP * 0.5, 0.0), R + aaP, dd)) * norm;
          float br = 0.42 + 0.30 * exp(-age * 0.25) + 3.6 * fl;
          vec3 pcol = mix(lc, vec3(1.0, 0.98, 0.95), 0.75 * fl);
          add += pcol * disc * br;
          add += lc * exp(-dd / (R * 2.4 + aaP + 0.02)) * br * 0.30 * norm;
          // rings thrown across the floor
          float big = smoothstep(1.15, 1.7, wj);
          for (int ri = 0; ri < 3; ri++) {
            float fr = float(ri);
            if (ri == 2 && big < 0.01) continue;
            float ag = age - fr * 0.20;
            if (ag < 0.0 || ag > 2.8) continue;
            float gr = 1.0 - exp(-ag * (2.3 - 0.4 * fr));
            float rr = R0 + (0.62 + 0.55 * big + 0.12 * fr) * gr * (0.8 + 0.3 * wj);
            float rw = 0.012 + 0.04 * gr + aaP * 0.7;
            float ring = exp(-abs(dd - rr) / rw) * exp(-ag * (1.5 + 0.5 * fr)) * min(1.0, 0.035 / rw + 0.45);
            add += (lc * 1.6 + vec3(0.8) * exp(-ag * 5.0)) * ring * (0.95 - 0.18 * fr);
          }
          // flash disc
          add += lc * exp(-dd * dd / (0.18 * wj + aaP * aaP)) * exp(-age * 7.0) * 1.1;
        }
        pc += add * (1.0 - dss(1.3, 2.1 + blur * 3.0, dd));
      }
    }

    // running tally per lane, printed on the floor behind the line, a tabular 3x5 pixel face
    if (Z > 0.0 && Z < DL_ZMAX && X < -0.25 && X > -2.1 && fp < 0.12) {
      float cell = 0.13;
      float tl = lane0;
      float zt = Z - (tl + 0.5) * DL_LW;        // from lane centre
      vec2 g = vec2((X + 2.0) / cell, (0.5 * 5.0 * cell - zt - 0.0) / cell);
      g.y = (2.5 * cell - zt) / cell;           // top of glyph is the far side
      vec2 tally = dTally(clamp(tl, 0.0, 6.0), now);
      vec2 nm = dNum(tally.x, g, 3.0);
      float since = (now - tally.y) / DL_VEL;
      float pulse = exp(-since * 3.0);
      float vis = 1.0 - dss(0.06, 0.12, fp);
      vec3 lcT = dLane(clamp(tl, 0.0, 6.0));
      pc += lcT * nm.x * (nm.y > 0.5 ? 0.09 : 0.85 + 1.8 * pulse) * vis * 0.9;
    }
    col += pc * fog;
    col = mix(col, vec3(0.020, 0.022, 0.036), (1.0 - fog) * 0.8);
  }

  // light curtain standing on the line, and the sparks every deadline throws up through it
  if (abs(rd.x) > 1e-4) {
    float tX = -ro.x / rd.x;
    if (tX > 0.0 && tX < tEnd) {
      vec3 cp = ro + rd * tX;
      float h0 = dH(0.0);
      float y = cp.y - h0;
      if (y > 0.0 && cp.z > -1.5 && cp.z < DL_ZMAX + 1.5) {
        float zin = dss(-1.2, 0.5, cp.z) * (1.0 - dss(DL_ZMAX - 0.5, DL_ZMAX + 1.4, cp.z));
        float rays = 0.78 + 0.22 * sin(cp.z * 2.9 + T * 0.7) * sin(cp.z * 1.3 - T * 0.45);
        float fog = exp(-max(tX - 24.0, 0.0) * 0.030);
        float cl = dss(0.0, 0.25, y);
        col += vec3(1.0, 0.92, 0.82) * (exp(-y * 0.34) * 0.20 + exp(-y * 2.0) * 0.22) * zin * rays * fog * cl;
      }
    }
  }


  // sparks and light shafts thrown up by every deadline the line has just crossed (true 3D, so they
  // read from any angle): ray-to-point and ray-to-segment distances, only for rays through the zone
  vec3 ird = 1.0 / (rd + vec3(1e-5));
  vec3 bt0 = (vec3(-3.4, -0.8, -2.6) - ro) * ird, bt1 = (vec3(0.9, 5.2, 19.8) - ro) * ird;
  vec3 bmn = min(bt0, bt1), bmx = max(bt0, bt1);
  if (min(min(bmx.x, bmx.y), bmx.z) > max(max(max(bmn.x, bmn.y), bmn.z), 0.0)) {
    {
      vec3 sp = vec3(0.0);
      float fpx = FOVK * px;
      for (int l = 0; l < 7; l++) {
        float fl = float(l);
        float Nn = dN(fl); vec2 ph = dPh(fl);
        vec3 lcs = dLane(fl);
        float ju = floor(dInv(now / DL_W, ph) * Nn);
        for (int k = -3; k <= 1; k++) {
          float j = ju + float(k);
          float jw = j, sh = 0.0;
          if (j < -0.5) { jw = j + Nn; sh = -DL_W; }
          else if (j > Nn - 0.5) { jw = j - Nn; sh = DL_W; }
          float xr = dXj(jw, fl, Nn, ph) + sh - now;
          float age = -xr / DL_VEL;
          if (age < 0.0 || age > 1.8) continue;
          float zj = (fl + 0.5) * DL_LW + (dh2(vec2(fl, jw) * 1.31 + 4.1) - 0.5) * 0.7;
          float wj = 0.80 + 0.95 * pow(dh2(vec2(jw, fl) * 0.77 + 8.3), 2.0);
          vec3 S0 = vec3(xr, dH(xr), zj);
          // the shaft
          float hb = (1.2 + 2.2 * wj) * (1.0 - exp(-age * 14.0)) * pscale;
          float lifeB = exp(-age * 2.2);
          vec3 w0 = ro - S0;
          float b = rd.y, dq = dot(rd, w0), eq = w0.y;
          float den = max(1.0 - b * b, 1e-4);
          float tq = clamp((eq - b * dq) / den, 0.0, hb);
          float sq = b * tq - dq;
          vec3 cpq = ro + rd * sq - (S0 + vec3(0.0, tq, 0.0));
          float dB = length(cpq);
          float rB = (0.055 + 0.030 * wj) * pscale;
          float prof = 1.0 - 0.75 * tq / max(hb, 0.05);
          sp += mix(lcs, vec3(1.0), 0.55) * exp(-dB / (rB + sq * fpx * 0.9)) * lifeB * prof * 1.5 * step(0.0, sq);
          // the sparks
          for (int q = 0; q < 4; q++) {
            float rq = dh2(vec2(jw * 1.7 + float(q) * 3.1, fl + 0.5));
            float vz = (rq - 0.5) * 2.6, vx = (dh1(rq * 57.0 + float(q)) - 0.5) * 1.2;
            float vy = (1.8 + 2.8 * dh1(rq * 91.0 + float(q))) * (0.65 + 0.35 * wj);
            vec3 S = S0 + vec3(vx * age, vy * age - 1.5 * age * age, vz * age);
            if (S.y < S0.y) continue;
            vec3 r = S - ro;
            float ts = dot(r, rd);
            if (ts < 0.0 || ts > tEnd + 0.3) continue;
            float d = length(cross(r, rd));
            float life = 1.0 - age / 1.8;
            float rs = (0.045 + 0.04 * rq) * life * pscale + 0.006;
            sp += mix(lcs, vec3(1.0), 0.5 * life) * exp(-d / (rs + ts * fpx * 0.8)) * life * (0.7 + 0.6 * sin(age * 40.0 + rq * 20.0)) * 1.6;
          }
        }
      }
      col += sp;
    }
  }

  // air: a glow band above the wall, and two layers of slow bokeh dust for depth
  col += vec3(0.034, 0.024, 0.045) * exp(-pow((p.y - 0.26) / 0.20, 2.0)) * (1.0 - dss(0.2, 0.9, abs(p.x)));
  col += vec3(0.5, 0.36, 0.28) * exp(-length(p - vec2(-0.12, 0.26)) * 2.4) * 0.030;
  for (int dl = 0; dl < 2; dl++) {
    float fd = float(dl);
    vec2 dpp = p * (7.0 + 6.0 * fd) + vec2(T * (0.05 + 0.04 * fd), -T * (0.03 + 0.05 * fd));
    vec2 dc = floor(dpp);
    float hd = dh2(dc + 11.0 * fd);
    vec2 dj = vec2(dh2(dc + 3.7), dh2(dc + 9.1));
    float dr = (0.07 + 0.19 * hd * hd) * (1.0 + 0.25 * fd);
    float dd2 = length(fract(dpp) - (0.3 + 0.4 * dj));
    float tw = 0.5 + 0.5 * sin(T * (0.4 + 0.5 * hd) + hd * 40.0);
    float vis = step(0.55, hd) * (1.0 - dss(dr * 0.6, dr, dd2));
    col += mix(vec3(1.0, 0.82, 0.6), vec3(0.6, 0.75, 1.0), dh2(dc + 5.5)) * vis * tw * mix(0.022, 0.040, I) * (1.0 + 0.5 * pulse);
  }

  col = 1.0 - exp(-max(col, vec3(0.0)) * 1.35);
  col = pow(col, vec3(0.92));
  float vig = 1.0 - dss(0.45, 1.3, length(p * vec2(0.76, 1.0)));
  col *= mix(0.45, 1.0, vig);
  col += (dh2(gl_FragCoord.xy + fract(uTime * 7.31) * 157.0) - 0.5) * mix(0.010, 0.026, I);

  // total tally, top right: passed / 447, over a progress rule
  {
    float cell = 0.0068 * (1.0 + 0.3 * (mf - 1.0));
    vec2 o = vec2(min(0.385, 0.5 * uRes.x / S - 30.0 * cell - 0.015), 0.40);
    vec2 g = (p - o) / cell; g.y = -g.y;
    float tot = 0.0;
    if (g.x > -1.0 && g.x < 30.0 && g.y > -1.0 && g.y < 8.0) {
      for (int l = 0; l < 7; l++) tot += dTally(float(l), now).x;
      vec2 a = dNum(tot, g, 3.0);
      vec2 b = dNum(447.0, vec2(g.x - 16.0, g.y), 3.0);
      float sl = (g.x > 12.0 && g.x < 15.0 && g.y > 0.0 && g.y < 5.0) ? 1.0 : 0.0;
      float slash = (g.x > 12.0 && g.x < 15.0) ? step(abs((g.x - 12.0) - (4.5 - g.y) * 0.6), 0.55) * step(0.0, g.y) * step(g.y, 5.0) : 0.0;
      float bar = step(0.0, g.x) * step(g.x, 24.0) * step(6.2, g.y) * step(g.y, 7.0);
      float prog = step(g.x, 24.0 * tot / 447.0);
      col += vec3(1.0, 0.93, 0.80) * (a.x * (a.y > 0.5 ? 0.30 : 0.95) + slash * 0.45 + b.x * 0.30 + bar * (0.10 + 0.7 * prog)) * 0.9;
    }
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
}
export default reel
