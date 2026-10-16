import type { ReelDef } from './types'

// Phase portrait: a linear coupled system x' = Ax with complex eigenvalues (a stable focus),
// drawn exactly. In the system's own coordinates the trajectories are log spirals, so
// s = ln(rho) + K*theta is constant along each one; streamlines are level sets of s with a
// level-of-detail ladder so they never crowd below a few pixels. Dashes are advected along
// them by flight time. Two comets (the couple) ride trajectories on opposite sides of the
// focus and spiral in together; the season then resets. Nullclines and a plot frame are
// drawn like a figure. Bounded loops: 2 comets x 2 windings.
const reel: ReelDef = {
  id: 'phase',
  projectId: 'love-island',
  title: 'Phase portrait',
  medium: 'Coupled differential equations, drawn as a flow field',
  colors: { bg: '#0B0C0D', ink: '#EDE9DF', accent: '#FF6A4D' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;

#define TAU 6.2831853
#define PI 3.14159265
#define AL 0.25
#define OM 1.0
#define K 0.25
#define N0 128.0
#define PHI 0.52
#define SQ 1.42
#define RATE 0.62
#define SEASON 22.0
#define SIG 1.18

float px;

float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 toZ(vec2 d) {
  float c = cos(PHI), s = sin(PHI);
  vec2 z = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
  z.y *= SQ;
  return z;
}
vec2 fromZ(vec2 z) {
  z.y /= SQ;
  float c = cos(PHI), s = sin(PHI);
  return vec2(c * z.x - s * z.y, s * z.x + c * z.y);
}
vec2 flowZ(vec2 z) { return vec2(-AL * z.x - OM * z.y, OM * z.x - AL * z.y); }
vec2 flowS(vec2 d) { return fromZ(flowZ(toZ(d))); }

// distance (px) to a line through the origin with normal nrm, dashed along it
float hairline(vec2 d, vec2 nrm, float dashes, float lw) {
  float l = length(nrm);
  float dist = abs(dot(d, nrm)) / l / px;
  float along = dot(d, vec2(-nrm.y, nrm.x)) / l;
  float on = dashes > 0.0 ? step(0.45, fract(along * dashes)) : 1.0;
  return (1.0 - smoothstep(lw, lw + 1.0, dist)) * on;
}

void main() {
  px = 1.0 / uRes.y;
  float I = clamp(uIntensity, 0.0, 1.0);
  // screens of 300..760 px are shown minified (the TV renders 960x720 into a ~300 px picture): widen and lift strokes
  float mf = mix(clamp(uRes.y / 300.0, 1.0, 2.4), 1.0, smoothstep(700.0, 800.0, uRes.y));
  float mb = 1.0 + 0.55 * (mf - 1.0);
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float T = mod(uTime, 3600.0) + uSeed * 97.0;
  float aspect = uRes.x / uRes.y;

  // slow breathing camera
  float zoom = 1.0 + 0.035 * sin(T * 0.07);
  vec2 p = p0 / zoom;

  // drifting equilibrium
  vec2 f = vec2(0.075 * sin(T * 0.11 + 1.3), 0.05 * sin(T * 0.083 + 0.4)) + (uMouse - 0.5) * vec2(0.08, 0.06);
  vec2 d = p - f;
  vec2 z = toZ(d);
  float rho = max(length(z), 1e-4);
  float th = atan(z.y, z.x);
  float lr = log(rho);

  vec3 ink = vec3(0.040, 0.043, 0.047);
  vec3 cream = vec3(0.93, 0.905, 0.85);
  vec3 verm = vec3(1.0, 0.36, 0.22);
  vec3 cool = vec3(0.28, 0.68, 1.0);
  vec3 col = ink + vec3(0.018, 0.017, 0.016) * exp(-length(p0) * 1.6);

  // ---- comets: compute heads first, they light the field ----
  float si = floor((T + 3.0) / SEASON);
  float st = fract((T + 3.0) / SEASON);
  float tc = st * SEASON * RATE;
  float th0 = h21(vec2(si, 4.1 + floor(uSeed * 40.0))) * TAU;
  float cAlpha = smoothstep(0.0, 0.05, st) * (1.0 - smoothstep(0.90, 0.995, st));
  float lightA = 0.0, lightB = 0.0;
  vec3 trailC = vec3(0.0), trailCoreC = vec3(0.0);
  vec3 heads = vec3(0.0);
  for (int c = 0; c < 2; c++) {
    float fc = float(c);
    float r0 = mix(1.16, 0.94, fc);
    float t0 = th0 + fc * (PI + 0.42);
    float headTh = t0 + OM * tc;
    float hr = r0 * exp(-AL * tc);
    vec2 hp = f + fromZ(hr * vec2(cos(headTh), sin(headTh)));
    float dh = length(p - hp);
    vec3 pcl = mix(verm, cool, fc);
    float lg = exp(-dh * 7.0) * cAlpha;
    lightA += lg * (1.0 - fc); lightB += lg * fc;
    float core = exp(-pow(dh / (0.0042 + 1.6 * px), 2.0));
    float halo = exp(-dh / 0.022);
    float bloom = exp(-dh / 0.11);
    heads += (vec3(1.0, 0.97, 0.92) * core * 1.6 + pcl * halo * 0.85 + pcl * bloom * 0.20 * (0.5 + 0.5 * I)) * cAlpha;
    // trail: the same trajectory, sampled where it crosses this pixel's angle
    float nmax = floor((headTh - th) / TAU);
    for (int j = 0; j < 2; j++) {
      float tn = (th + TAU * (nmax - float(j)) - t0) / OM;
      float age = tc - tn;
      float TL = 6.8;
      if (age >= 0.0 && age <= TL) {
        float rn = r0 * exp(-AL * tn);
        float dz = abs(rho - rn) * 0.97 / SIG;          // screen units, near enough
        float a = 1.0 - age / TL;
        float w = max(mix(0.5, 3.0, a * a), mix(0.0006, 0.0034, a * a) / px);
        float dpx = dz / px;
        trailCoreC += mix(pcl, vec3(1.0, 0.9, 0.85), 0.45) * (1.0 - smoothstep(w * 0.45, w * 0.45 + 1.0, dpx)) * pow(a, 1.4);
        trailC += pcl * ((1.0 - smoothstep(w, w + 1.2, dpx)) * pow(a, 1.8) + exp(-dz / 0.012) * a * a * 0.22);
      }
    }
  }
  trailC *= cAlpha; trailCoreC *= cAlpha;
  float light = lightA + lightB;

  // ---- streamlines: level sets of s with a level-of-detail ladder ----
  float s = lr + K * th;
  float D = N0 / (TAU * K);
  float spacing0 = rho / (D * sqrt(1.0 + K * K) * SIG);
  float target = max(0.0135, 3.8 * px);
  float Lc = clamp(log2(target / spacing0), 0.0, 5.0);
  float Lf = floor(Lc);
  float sc = exp2(Lf);
  float g = s * D / sc;
  float nn = floor(g + 0.5);
  float dpx = abs(g - nn) * spacing0 * sc / px;
  float odd = mod(nn, 2.0);
  float lod = mix(1.0, 1.0 - fract(Lc), odd);
  float line = (1.0 - smoothstep(0.3 * mf, 1.15 * mf, dpx)) * lod;
  // per-lane identity, stable across LOD levels and the branch cut
  float lane = mod(nn * sc, N0);
  float hA = h21(vec2(lane, 1.7 + floor(uSeed * 23.0)));
  float hB = h21(vec2(lane, 9.3));
  float hC = h21(vec2(lane, 5.1));
  // dashes advected by flight time
  float tau = -lr / AL;
  float freq = 0.85 + 0.9 * hB;
  float ph = fract((tau - T * RATE) * freq + hA * 7.0);
  float dl = 0.18 + 0.32 * hC;
  float dash = smoothstep(0.0, dl, ph) * (1.0 - smoothstep(dl, dl + 0.035, ph));
  dash = pow(dash, 1.6);
  float hasDash = step(hA, 0.40 + 0.30 * I);
  float centre = smoothstep(0.012, 0.06, rho);         // let the focus breathe
  float edge = smoothstep(1.55, 1.05, rho);
  float base = 0.055 + 0.04 * hB;
  float bright = (base + dash * hasDash * (0.25 + 0.85 * hB * hB)) * centre * mb;
  vec3 lineCol = mix(cream, verm, clamp(lightA * 1.3, 0.0, 0.88));
  lineCol = mix(lineCol, cool, clamp(lightB * 1.3, 0.0, 0.88));
  col += lineCol * line * bright * (1.0 + light * 2.2) * edge;
  // soft flow sheen between lines so the field has a body
  col += cream * dash * hasDash * centre * 0.016 * exp(-dpx * 0.15);

  // ---- plot furniture: frame, ticks, zero axes, nullclines, equilibrium ----
  vec2 hb = vec2(0.5 * aspect, 0.5) - 0.055;
  vec2 q = abs(p0) - hb;
  float sdBox = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float frame = 1.0 - smoothstep(0.4, 1.4, abs(sdBox) / px);
  // ticks every 0.1, major every 0.5, pointing inward
  vec2 tk = abs(fract(p0 / 0.1 + 0.5) - 0.5) * 0.1 / px;
  vec2 tkm = abs(fract(p0 / 0.5 + 0.5) - 0.5) * 0.5 / px;
  float tlen = 0.012, tlenM = 0.024;
  float tickL = 0.0;
  // ticks on left/right edges (vary along y), on top/bottom edges (vary along x)
  float nearV = step(-q.x, tlen) * step(q.x, 0.0) * (1.0 - smoothstep(0.4, 1.2, tk.y));
  float nearVM = step(-q.x, tlenM) * step(q.x, 0.0) * (1.0 - smoothstep(0.4, 1.2, tkm.y));
  float nearH = step(-q.y, tlen) * step(q.y, 0.0) * (1.0 - smoothstep(0.4, 1.2, tk.x));
  float nearHM = step(-q.y, tlenM) * step(q.y, 0.0) * (1.0 - smoothstep(0.4, 1.2, tkm.x));
  tickL = max(max(nearV, nearVM), max(nearH, nearHM)) * step(q.x, 0.0) * step(q.y, 0.0);
  float furn = smoothstep(150.0, 320.0, uRes.y);        // fine furniture only when it can resolve
  col += vec3(0.42, 0.41, 0.39) * (frame * 0.55 + tickL * 0.5) * (0.35 + 0.65 * furn);
  float zx = (1.0 - smoothstep(0.3, 1.2, abs(p0.y) / px)) * step(q.x, 0.0);
  float zy = (1.0 - smoothstep(0.3, 1.2, abs(p0.x) / px)) * step(q.y, 0.0);
  col += vec3(0.30, 0.29, 0.28) * (zx + zy) * 0.22 * furn;
  // nullclines of the screen-space system: x' = 0 and y' = 0
  vec2 e1 = flowS(vec2(1.0, 0.0)), e2 = flowS(vec2(0.0, 1.0));
  vec2 row0 = vec2(e1.x, e2.x), row1 = vec2(e1.y, e2.y);
  float inside = step(q.x, 0.0) * step(q.y, 0.0);
  float nc = (hairline(d, row0, 70.0, 0.35) + hairline(d, row1, 0.0, 0.3) * 0.7) * inside;
  col += mix(cream, verm, 0.15) * nc * 0.20 * (0.5 + 0.5 * furn);
  // equilibrium marker: open circle and crosshair arms
  float dd = length(d);
  float ring = 1.0 - smoothstep(0.4, 1.3, abs(dd - 0.010) / px);
  vec2 ad = abs(d);
  float arms = (1.0 - smoothstep(0.3, 1.2, ad.y / px)) * step(0.018, ad.x) * step(ad.x, 0.034)
             + (1.0 - smoothstep(0.3, 1.2, ad.x / px)) * step(0.018, ad.y) * step(ad.y, 0.034);
  float settle = smoothstep(0.75, 1.0, st) * (1.0 - smoothstep(0.97, 1.0, st));
  col += cream * (ring * 0.85 + arms * 0.5);
  col += cream * exp(-dd / 0.03) * 0.05 + mix(verm, cool, 0.5 + 0.5 * sin(T * 0.8)) * exp(-dd / 0.05) * settle * 0.35;

  // ---- the couple ----
  col += trailC * 0.95 + trailCoreC * 0.9;
  col += heads;

  // ---- grade ----
  col = col / (1.0 + 0.25 * max(col - 0.85, 0.0));
  float vig = smoothstep(1.3, 0.3, length(p0 * vec2(0.8, 1.05)));
  col *= 0.42 + 0.58 * vig;
  float gr = h21(gl_FragCoord.xy + fract(T * 11.3) * 517.0) - 0.5;
  col += gr * (0.03 + 0.02 * I);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
}
export default reel
