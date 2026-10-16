import type { ReelDef } from './types'
import { FONT_GLSL, T, W } from './font'

// Edge: a dot-matrix globe turning in the dark, a lattice of edge locations lit on its land, and
// requests arcing in from clients to the nearest of them. Each arc draws on with a hot head and
// a fading trail, and the location it lands on pings a ring across the surface. A comet circles
// the globe on a tilted orbit, and a scrolling traffic trace at the bottom takes a bump at every
// arrival. It follows the pitch's thesis in one picture: Cloudflare is paid for traffic, not seats.
// The coastlines, the edge locations and the requests are generative, not real geography or logs.
// The land mask is a 3D value-noise fbm. The same function is ported to TS, so the edge locations
// and client points are placed on land at module load and baked into the shader as constants.
// GLSL ES 1.00; loops are bounded (26 locations, 6 arcs x 12 segments, gated by a per-arc screen
// bounding test). No textures.
const fr = (x: number) => x - Math.floor(x)
function h31(x: number, y: number, z: number): number {
  let a = fr(x * 0.1031), b = fr(y * 0.1031), c = fr(z * 0.1031)
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33)
  a += d; b += d; c += d
  return fr((a + b) * c)
}
const sm = (f: number) => f * f * (3 - 2 * f)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
function vn3(px: number, py: number, pz: number): number {
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz)
  const fx = sm(px - ix), fy = sm(py - iy), fz = sm(pz - iz)
  const g = (a: number, b: number, c: number) => h31(ix + a, iy + b, iz + c)
  return mix(
    mix(mix(g(0, 0, 0), g(1, 0, 0), fx), mix(g(0, 1, 0), g(1, 1, 0), fx), fy),
    mix(mix(g(0, 0, 1), g(1, 0, 1), fx), mix(g(0, 1, 1), g(1, 1, 1), fx), fy), fz)
}
const THR = 0.515
function landJs(nx: number, ny: number, nz: number): number {
  let px = nx * 1.6 + 3.1, py = ny * 1.6 + 1.7, pz = nz * 1.6 + 5.3, a = 0.5, s = 0
  for (let o = 0; o < 4; o++) { s += a * vn3(px, py, pz); px = px * 2.03 + 1.7; py = py * 2.03 + 9.2; pz = pz * 2.03 + 3.1; a *= 0.5 }
  return s / 0.9375
}
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function pick(n: number, seed: number, margin: number, minD: number, lat: number): number[][] {
  const r = rng(seed), out: number[][] = []
  for (let guard = 0; out.length < n && guard < 8000; guard++) {
    const y = (r() * 2 - 1) * lat, ph = r() * Math.PI * 2, q = Math.sqrt(1 - y * y)
    const p = [q * Math.cos(ph), y, q * Math.sin(ph)]
    if (landJs(p[0], p[1], p[2]) < THR + margin) continue
    if (out.some(o => Math.hypot(o[0] - p[0], o[1] - p[1], o[2] - p[2]) < minD)) continue
    out.push(p)
  }
  return out
}
const POPS = pick(26, 7, 0.05, 0.20, 0.82)
const CLIENTS = pick(20, 31, 0.03, 0.12, 0.80)
function lut(name: string, pts: number[][]): string {
  const rec = (lo: number, hi: number, ind: string): string => hi - lo === 1
    ? `${ind}return vec3(${pts[lo].map(v => v.toFixed(4)).join(', ')});\n`
    : `${ind}if (i < ${((lo + hi) >> 1) - 0.5}) {\n${rec(lo, (lo + hi) >> 1, ind + '  ')}${ind}}\n${rec((lo + hi) >> 1, hi, ind)}`
  return `vec3 ${name}(float i) {\n${rec(0, pts.length, '  ')}}\n`
}
const NP = POPS.length, NC = CLIENTS.length

const reel: ReelDef = {
  id: 'cloudflare',
  projectId: 'cloudflare',
  title: 'Edge',
  medium: 'An illustrative globe of edge locations, with requests arcing in from clients',
  colors: { bg: '#0B0705', ink: '#FBE9D3', accent: '#F48120' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;
${FONT_GLSL}
#define PI 3.14159265
#define GD 3.4
#define FOC 1.07
#define THR ${THR.toFixed(3)}
#define NPF ${NP}.0
#define NCF ${NC}.0
#define NPI ${NP}
#define DLAT 0.0524
const vec2 CEN = vec2(0.0, 0.035);
const vec3 ORG = vec3(0.957, 0.506, 0.125);

float Tm, SPIN, TILT, CS, SN, CT, ST, SPINR, SS;

float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float h31(vec3 p) { vec3 p3 = fract(p * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 0.0)), h31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(h31(i + vec3(0.0, 0.0, 1.0)), h31(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 1.0)), h31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float land(vec3 n) {
  vec3 p = n * 1.6 + vec3(3.1, 1.7, 5.3);
  float a = 0.5, s = 0.0;
  for (int o = 0; o < 4; o++) { s += a * vn3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s / 0.9375;
}
${lut('pop', POPS)}
${lut('client', CLIENTS)}

vec3 toView(vec3 l) {
  vec3 a = vec3(l.x * CS + l.z * SN, l.y, -l.x * SN + l.z * CS);
  return vec3(a.x, a.y * CT - a.z * ST, a.y * ST + a.z * CT);
}
vec3 toLocal(vec3 v) {
  vec3 a = vec3(v.x, v.y * CT + v.z * ST, -v.y * ST + v.z * CT);
  return vec3(a.x * CS - a.z * SN, a.y, a.x * SN + a.z * CS);
}
vec2 proj(vec3 V) { return FOC * V.xy / (GD - V.z) + CEN; }
float vis(vec3 V) { return smoothstep(1.0 / GD - 0.03, 1.0 / GD + 0.10, V.z); }
vec3 slr(vec3 a, vec3 b, float s, float om, float so) { return (sin((1.0 - s) * om) * a + sin(s * om) * b) / so; }

// one request: client, edge location, phase u in 0..1 of its flight, its period
void arcSetup(float i, out vec3 A, out vec3 B, out float u, out float per) {
  per = 3.3 + 0.41 * i;
  float ph = Tm / per + i * 0.37;
  float k = floor(ph);
  u = ph - k;
  float th = (k - i * 0.37 + 0.3) * per * SPINR - 0.6;
  vec3 face = normalize(vec3(-sin(th), 0.25, cos(th)));
  vec3 c0 = client(floor(h11(k * 7.13 + i * 13.7) * NCF)), c1 = client(floor(h11(k * 5.31 + i * 3.9 + 5.0) * NCF));
  A = dot(c0, face) > dot(c1, face) ? c0 : c1;
  vec3 d0 = pop(floor(h11(k * 3.77 + i * 5.31 + 11.0) * NPF)), d1 = pop(floor(h11(k * 9.31 + i * 2.7 + 17.0) * NPF));
  B = dot(d0, face) > dot(d1, face) ? d0 : d1;
}
float flight(float u) { float x = clamp(u / 0.5, 0.0, 1.0); return 1.0 - (1.0 - x) * (1.0 - x); }

// the glow of one arc at screen point p
vec3 arcCol(float i, vec2 p) {
  vec3 A, B; float u, per;
  arcSetup(i, A, B, u, per);
  float om = acos(clamp(dot(A, B), -0.97, 0.97)), so = sin(om);
  float lift = 0.05 + 0.15 * om / PI;
  vec2 sA = proj(toView(A)), sB = proj(toView(B));
  vec2 sM = proj(toView(slr(A, B, 0.5, om, so) * (1.0 + lift)));
  vec2 s1 = proj(toView(slr(A, B, 0.25, om, so) * (1.0 + lift * 0.7071)));
  vec2 s3 = proj(toView(slr(A, B, 0.75, om, so) * (1.0 + lift * 0.7071)));
  vec2 lo = min(min(sA, sB), min(sM, min(s1, s3))) - 0.05;
  vec2 hi = max(max(sA, sB), max(sM, max(s1, s3))) + 0.05;
  if (p.x < lo.x || p.x > hi.x || p.y < lo.y || p.y > hi.y) return vec3(0.0);
  float hd = flight(u);
  float fade = 1.0 - smoothstep(0.66, 0.98, u);
  vec2 prev = sA;
  vec3 vprev = toView(A);
  float best = 1e3, bt = 0.0, bv = 0.0;
  for (int j = 1; j <= 12; j++) {
    float s = float(j) / 12.0;
    vec3 V = toView(slr(A, B, s, om, so) * (1.0 + lift * sin(PI * s)));
    vec2 sp = proj(V);
    vec2 pa = p - prev, ba = sp - prev;
    float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    float d = length(pa - ba * hh);
    if (d < best) { best = d; bt = (float(j - 1) + hh) / 12.0; bv = vis(mix(vprev, V, hh)); }
    prev = sp; vprev = V;
  }
  float tr = hd - bt;
  float on = step(0.0, tr) * fade * bv;
  float inten = (0.20 + 1.15 * exp(-tr * 5.5)) * on;
  vec3 c = mix(ORG, vec3(1.0, 0.88, 0.70), exp(-tr * 9.0)) * inten;
  float w = 0.0022;
  vec3 o = c * (exp(-best * best / (w * w)) * 1.15 + exp(-best * best / (w * w * 22.0)) * 0.30);
  // the head
  vec3 Vh = toView(slr(A, B, hd, om, so) * (1.0 + lift * sin(PI * hd)));
  float dh = length(p - proj(Vh));
  o += vec3(1.0, 0.92, 0.78) * exp(-dh * dh / 0.00005) * vis(Vh) * fade * step(hd, 0.999) * 1.1;
  // the client ping and the arrival burst
  vec3 VA = toView(A * 1.004);
  float ring = abs(length(p - sA) - 0.006 - 0.05 * clamp(u / 0.35, 0.0, 1.0));
  o += ORG * exp(-ring * ring / 0.000006) * vis(VA) * (1.0 - smoothstep(0.0, 0.35, u)) * 0.8;
  o += vec3(1.0, 0.9, 0.8) * exp(-dot(p - sA, p - sA) / 0.00004) * vis(VA) * fade * 0.7;
  float ab = max(u - 0.5, 0.0) * per;
  o += vec3(1.0, 0.85, 0.6) * exp(-dot(p - sB, p - sB) / 0.00012) * exp(-ab * 2.6) * vis(toView(B)) * step(0.5, u) * 1.1;
  return o;
}

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  SS = min(uRes.y, uRes.x / 1.3);
  vec2 p0 = (gl_FragCoord.xy - 0.5 * uRes) / SS;
  float px = 1.0 / SS;
  vec2 mo = uMouse - 0.5;
  Tm = mod(uTime, 7200.0) + uSeed * 30.0;
  SPINR = 0.07 + 0.05 * I;
  SPIN = Tm * SPINR - 0.6 + mo.x * 0.9;
  TILT = 0.42 + mo.y * 0.25;
  CS = cos(SPIN); SN = sin(SPIN); CT = cos(TILT); ST = sin(TILT);
  float nA = I < 0.5 ? 4.0 : 6.0;

  vec2 pc = p0 - CEN;
  vec3 ro = vec3(0.0, 0.0, GD);
  vec3 rd = normalize(vec3(pc, -FOC));
  // night: warm black with a low glow behind the globe
  vec3 col = mix(vec3(0.030, 0.016, 0.010), vec3(0.006, 0.004, 0.004), smoothstep(-0.5, 0.55, p0.y));
  col += ORG * 0.050 * exp(-dot(pc, pc) * 3.2);
  {
    vec2 g = p0 * 22.0; vec2 id = floor(g), f = fract(g) - 0.5;
    float r = h21(id);
    col += vec3(1.0, 0.85, 0.7) * smoothstep(0.07, 0.0, length(f - (vec2(h21(id + 1.3), h21(id + 4.7)) - 0.5) * 0.6)) * step(0.93, r) * (0.5 + 0.5 * sin(Tm * (0.8 + r) + r * 40.0)) * 0.30;
  }

  float bb = dot(ro, rd), cc = dot(ro, ro) - 1.0, disc = bb * bb - cc;
  float tHit = 1e9;
  bool hit = false;
  if (disc > 0.0) { tHit = -bb - sqrt(disc); hit = tHit > 0.0; }
  float dmin = length(cross(ro, rd));

  // orbit: a tilted ring with a comet
  vec3 on = normalize(vec3(0.22, 0.93, 0.30));
  vec3 e1 = normalize(cross(on, vec3(0.0, 0.0, 1.0))), e2 = cross(on, e1);
  float tR = -dot(ro, on) / dot(rd, on);
  float ringV = 0.0;
  vec3 ringAdd = vec3(0.0);
  if (tR > 0.0 && tR < tHit) {
    vec3 Q = ro + rd * tR;
    float rl = length(Q);
    float pf = tR / (FOC * SS);
    float dd = abs(rl - 1.52);
    float phi = atan(dot(Q, e2), dot(Q, e1));
    float dl = mod(Tm * 0.34 - phi, 2.0 * PI);
    float tail = exp(-dl * 1.7) * step(dl, 4.5);
    ringV = smoothstep(pf * 1.4 + 0.0018, 0.0, dd) * (0.28 + 0.9 * tail);
    ringAdd += mix(ORG, vec3(1.0, 0.9, 0.75), tail * tail) * ringV;
    float dc = length(vec2(dd, min(dl, 2.0 * PI - dl) * rl));
    ringAdd += vec3(1.0, 0.92, 0.8) * exp(-dc * dc / (pf * pf * 14.0 + 1e-6)) * 0.9;
  }

  if (hit) {
    vec3 P = ro + rd * tHit;
    vec3 nl = toLocal(P);
    float pf = tHit / (FOC * SS);
    float cosv = max(dot(P, -rd), 0.18);
    float aa = pf / cosv;
    vec3 L = normalize(vec3(-0.55, 0.50, 0.68));
    float dif = max(dot(P, L), 0.0);
    // dot-matrix land
    float lat = asin(clamp(nl.y, -1.0, 1.0)), lon = atan(nl.x, nl.z);
    float row = floor(lat / DLAT + 0.5);
    float latc = row * DLAT;
    float cols = max(floor(2.0 * PI * cos(latc) / DLAT), 1.0);
    float dlon = 2.0 * PI / cols;
    float lonc = floor(lon / dlon + 0.5) * dlon;
    vec3 cdir = vec3(cos(latc) * sin(lonc), sin(latc), cos(latc) * cos(lonc));
    float ang = length(nl - cdir);
    float lv = land(cdir);
    float isLand = smoothstep(THR - 0.012, THR + 0.012, lv);
    float rad = DLAT * mix(0.20, 0.40, isLand);
    float dotm = smoothstep(rad + aa, rad - aa, ang);
    vec3 sph = vec3(0.020, 0.012, 0.010) + vec3(0.050, 0.022, 0.010) * dif;
    vec3 lc = mix(vec3(1.0, 0.86, 0.68), vec3(1.0, 0.70, 0.40), smoothstep(THR, 0.8, lv));
    vec3 dcol = mix(ORG * 0.34, lc * (0.30 + 0.85 * dif), isLand);
    vec3 c = mix(sph, dcol, dotm * mix(0.8, 1.0, isLand));
    // edge locations: bright nodes with a halo
    for (int i = 0; i < NPI; i++) {
      vec3 pp = pop(float(i));
      float a = length(nl - pp);
      if (a < 0.14) {
        float tw = 0.65 + 0.35 * sin(Tm * (1.1 + h11(float(i))) + float(i) * 2.3);
        float core = smoothstep(0.024 + aa, 0.024 - aa, a);
        c = mix(c, vec3(1.0, 0.86, 0.62), core * 0.95);
        c += ORG * exp(-a * a / 0.0016) * 0.65 * tw;
      }
    }
    // a ring runs across the surface from every landing
    for (int i = 0; i < 6; i++) {
      if (float(i) >= nA) break;
      vec3 A, B; float u, per;
      arcSetup(float(i), A, B, u, per);
      if (u > 0.5) {
        float ab = (u - 0.5) * per;
        float a = length(nl - B);
        float rr = abs(a - 0.06 - ab * 0.17);
        c += ORG * exp(-rr * rr / (0.0004 + aa * aa * 3.0)) * exp(-ab * 1.5) * 0.85;
      }
    }
    // the shaded limb: the night side falls away, a warm rim catches the edge
    float fres = pow(1.0 - max(dot(P, -rd), 0.0), 3.0);
    c *= 0.35 + 0.65 * smoothstep(-0.25, 0.55, dif + 0.25);
    c += ORG * fres * 0.55 + vec3(1.0, 0.8, 0.6) * fres * fres * 0.25;
    col = c;
  } else {
    // atmosphere
    float g = exp(-(dmin - 1.0) * 11.0) * smoothstep(0.7, 1.0, dmin);
    col += ORG * g * 0.55 + vec3(1.0, 0.7, 0.45) * g * g * 0.4;
  }
  col += ringAdd;

  // requests
  for (int i = 0; i < 6; i++) {
    if (float(i) >= nA) break;
    col += arcCol(float(i), p0);
  }

  // traffic: a scrolling trace that takes a bump at every arrival
  {
    vec2 q = vec2(p0.x - 0.17, p0.y + 0.470);
    float wx = 0.45, hy = 0.095;
    if (q.x > -0.01 && q.x < wx + 0.01 && q.y > -0.012 && q.y < hy + 0.012) {
      float xr = clamp(q.x / wx, 0.0, 1.0);
      float tau = Tm - (1.0 - xr) * 22.0;
      float v = 0.04 + 0.16 * xr + 0.05 * sin(tau * 1.7) * sin(tau * 0.53);
      for (int i = 0; i < 6; i++) {
        if (float(i) >= nA) break;
        float fi = float(i);
        float per = 3.3 + 0.41 * fi;
        float kk = tau / per + fi * 0.37 - 0.5;
        float dt = (kk - floor(kk + 0.5)) * per;
        v += 0.26 * exp(-dt * dt / 0.5) * (0.6 + 0.4 * xr);
      }
      float h = (v / (v + 0.2)) * 0.9 * hy;
      float inside = smoothstep(px * 1.2, 0.0, q.y - h) * step(0.0, q.y);
      float edge = smoothstep(px * 2.2 + 0.0012, 0.0, abs(q.y - h));
      col = mix(col, ORG * (0.12 + 0.55 * (1.0 - q.y / hy)), inside * 0.55);
      col += vec3(1.0, 0.72, 0.42) * edge * 0.95;
      col += vec3(1.0, 0.9, 0.8) * exp(-dot(q - vec2(wx, h), q - vec2(wx, h)) / 0.00005) * 0.9;
      col += ORG * smoothstep(px * 1.5, 0.0, abs(q.y)) * 0.4;
    }
  }

  // labels
  {
    float u = 0.0026;
    vec3 ink = vec3(1.0, 0.91, 0.80);
    col = mix(col, ORG, fText((p0 - vec2(-0.62, 0.445)) / u, ${T('EDGE NETWORK')}, u / px) * 0.95);
    col = mix(col, ink * 0.55, fText((p0 - vec2(0.62 - ${W('ILLUSTRATIVE') * 0.0026}, 0.445)) / u, ${T('ILLUSTRATIVE')}, u / px) * 0.85);
    col = mix(col, ink * 0.7, fText((p0 - vec2(-0.62, -0.395)) / u, ${T('CHARGED FOR')}, u / px) * 0.9);
    col = mix(col, ink, fText((p0 - vec2(-0.62, -0.428)) / u, ${T('TRAFFIC,')}, u / px) * 0.95);
    col = mix(col, ink, fText((p0 - vec2(-0.62, -0.461)) / u, ${T('NOT SEATS')}, u / px) * 0.95);
    col = mix(col, ORG, fText((p0 - vec2(0.17, -0.355)) / u, ${T('TRAFFIC')}, u / px) * 0.85);
  }

  // grade
  col = col / (1.0 + 0.25 * max(col - 0.9, 0.0));
  float vig = smoothstep(1.3, 0.25, length(p0 * vec2(0.8, 1.1)));
  col *= 0.30 + 0.70 * vig;
  col += (h21(gl_FragCoord.xy + fract(uTime * 9.7) * 191.0) - 0.5) * (0.016 + 0.018 * I);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
}
export default reel
