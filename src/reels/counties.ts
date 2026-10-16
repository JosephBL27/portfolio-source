import type { ReelDef } from './types'
import { FONT_GLSL, T, W } from './font'
import { COUNTIES_GRID } from './counties-grid'

// County by county: a relief of the continental US, one column per map cell. The footprint and the
// sign and size of every cell come from the paper's own county figure (the imbalance index,
// loss against investment), quantised to a 96 x 60 grid at build time and baked into the shader as
// bit-packed constants, so there are no textures. Blue side (investment exceeds loss) cools, red side
// (loss exceeds investment) warms to parchment gold. Heights are the index magnitude, in three steps
// plus a fixed per-cell jitter inside each step. An 18-second cycle that opens on the held relief:
// a scan line crosses, the columns settle, then rise again as a wave from west to east. Oblique projection with a
// front-to-back column march (<= 17 cell lookups per pixel). The cell grid is a simplification of the
// figure, not county geometry.
const f1 = (n: number) => n.toFixed(1)
const G = COUNTIES_GRID
// chunk = 4 floats = 32 cells; chunks run row-major, 3 per row
function chunkTree(lo: number, hi: number, ind: string): string {
  if (hi - lo === 1) {
    const d = G.data.slice(lo * 4, lo * 4 + 4)
    while (d.length < 4) d.push(0)
    return `${ind}return vec4(${d.map(f1).join(', ')});\n`
  }
  const mid = (lo + hi) >> 1
  return `${ind}if (i < ${f1(mid - 0.5)}) {\n${chunkTree(lo, mid, ind + '  ')}${ind}} else {\n${chunkTree(mid, hi, ind + '  ')}${ind}}\n`
}
const NCH = Math.ceil(G.data.length / 4)

const reel: ReelDef = {
  id: 'counties',
  projectId: 'wwii',
  title: 'County by county',
  medium: "A relief of the paper's county figure: columns rise where the imbalance index is large",
  colors: { bg: '#05070B', ink: '#F0E6CF', accent: '#E9A24A' },
  frag: /* glsl */ `precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uSeed;
uniform float uIntensity;
${FONT_GLSL}
#define PI 3.14159265
#define GW ${f1(G.w)}
#define GH ${f1(G.h)}
#define CYC 18.0
#define GAP 0.10
#define KMAX 24

vec4 cChunk(float i) {
${chunkTree(0, NCH, '  ')}}

float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 0 off the map; 1..3 investment exceeds loss (low..high); 4..6 loss exceeds investment
float cellCode(float cx, float r) {
  if (cx < 0.0 || cx > GW - 0.5 || r < 0.0 || r > GH - 0.5) return 0.0;
  vec4 ch = cChunk(r * 3.0 + floor(cx / 32.0));
  float c32 = cx - 32.0 * floor(cx / 32.0);
  float k = floor(c32 / 8.0);
  float f = k < 0.5 ? ch.x : (k < 1.5 ? ch.y : (k < 2.5 ? ch.z : ch.w));
  float j = c32 - 8.0 * k;
  float inv = j < 0.5 ? 1.0 : (j < 1.5 ? 0.125 : (j < 2.5 ? 0.015625 : (j < 3.5 ? 0.001953125 : (j < 4.5 ? 0.000244140625 : (j < 5.5 ? 0.000030517578125 : (j < 6.5 ? 0.000003814697265625 : 0.000000476837158203125))))));
  float v = floor(f * inv);
  return v - 8.0 * floor(v * 0.125);
}

vec3 warm(float m) { return mix(vec3(1.0, 0.36, 0.08), vec3(1.0, 0.86, 0.46), m); }
vec3 cool(float m) { return mix(vec3(0.05, 0.30, 0.90), vec3(0.42, 0.88, 1.0), m); }

void main() {
  float I = clamp(uIntensity, 0.0, 1.0);
  float asp = uRes.x / uRes.y;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float px = 1.0 / uRes.y;
  vec2 mo = uMouse - 0.5;
  float ph = mod(uTime + 9.0, CYC);   // opens on the held relief, so a still frame is already complete

  float cs = min(asp * 0.92, 1.45) / GW;
  float tilt = 0.58 - 0.10 * mo.y * I;
  float rowH = cs * tilt;
  float hmax = 7.0 * cs;
  float kr = ceil((hmax + rowH) / rowH);
  float Y0 = -0.5 * (GH * rowH + hmax) - 0.012;
  vec2 pan = vec2(0.014 * mo.x * I, 0.0);
  vec2 q = p - pan;

  float cxf = (q.x + 0.5 * GW * cs) / cs;
  float cx = floor(cxf);
  float u = cxf - cx;
  float yr = (q.y - Y0) / rowH;
  float r0 = floor(yr);

  // ambient: faint floor and graticule dots under everything
  vec3 col = vec3(0.012, 0.016, 0.024);
  col += vec3(0.012, 0.016, 0.026) * smoothstep(1.3, 0.0, length(p * vec2(0.8, 1.2)));
  {
    vec2 gp = vec2(cxf / 4.0 - 0.5, yr / 4.0 - 0.5);
    vec2 gd = (fract(gp) - 0.5) * vec2(4.0 * cs, 4.0 * rowH);
    float dd = length(gd);
    float inReg = step(-6.0, cxf) * step(cxf, GW + 6.0) * step(-6.0, yr) * step(yr, GH + 6.0);
    col += vec3(0.30, 0.38, 0.55) * smoothstep(px * 1.2, 0.0, dd - 0.0011) * 0.10 * inReg;
  }

  float sweepX = (ph - 3.0) / 12.0 * 1.5 - 0.25;
  vec3 hz = vec3(0.0);
  float hit = 0.0;

  if (cx > -1.0 && cx < GW && r0 > -2.0 && r0 - kr < GH) {
    for (int i = 0; i < KMAX; i++) {
      float fi = float(i);
      if (fi > kr) break;
      float r = r0 - kr + fi;
      if (r < 0.0 || r > GH - 0.5) continue;
      float code = cellCode(cx, r);
      if (code < 0.5) continue;
      float side = step(3.5, code);
      float lv = code - 3.0 * side;
      float hh = h21(vec2(cx * 1.31 + 3.7, r * 0.77 + 9.1));
      float mag = clamp((lv - 1.0 + hh * 0.96) / 3.0, 0.0, 1.0);
      float fx = cx / GW;
      // column rise (west to east) and settle
      float ign = 1.0;
      float t0 = 1.0 + fx * 3.4 + hh * 1.2;
      float x = clamp((ph - t0) / 2.4, 0.0, 1.0);
      float ez = 1.0 - pow(1.0 - x, 3.0);
      ez += 0.07 * sin(x * PI) * (1.0 - x);
      float tf = 15.0 + (1.0 - fx) * 0.8 + hh * 0.5;
      float fall = 1.0 - smoothstep(tf, tf + 1.8, ph);
      float grow = ez * fall;
      float breathe = 1.0 + 0.05 * sin(uTime * 0.8 + cx * 0.21 + r * 0.33) * grow;
      float ht = cs * (0.22 + 6.4 * pow(mag, 2.2) * grow * breathe) * ign;
      float yf = Y0 + (r + GAP) * rowH;
      float yt = Y0 + (r + 1.0 - GAP) * rowH + ht;
      float inX = step(GAP, u) * step(u, 1.0 - GAP);
      if (q.y < yf || q.y > yt) continue;
      if (inX < 0.5) { // gap between columns: spill a little of the neighbour's light
        float sp = 0.5 + 0.5 * mag;
        hz = (side > 0.5 ? warm(mag) : cool(mag)) * 0.10 * sp * smoothstep(yf, yf + ht + rowH, q.y);
        continue;
      }
      vec3 tint = side > 0.5 ? warm(mag) : cool(mag);
      float jit = 0.82 + 0.36 * h21(vec2(r * 3.1 + 1.0, cx * 2.3 + 7.0));
      float rise = grow * (1.0 - grow) * 4.0;
            float fog = mix(1.0, 0.80, r / GH);
      float scan = exp(-pow((fx + 0.10 * r / GH - sweepX) / 0.03, 2.0)) * smoothstep(1.5, 4.5, ph) * (1.0 - smoothstep(15.0, 16.5, ph));
      float blipT = floor(uTime * 1.6);
      float blip = step(0.9935, h21(vec2(cx, r) + blipT * 7.3 + uSeed * 31.0)) * (1.0 - fract(uTime * 1.6));
      float yFaceTop = yf + ht;
      float edgeX = min(u - GAP, 1.0 - GAP - u) / (1.0 - 2.0 * GAP);
      vec3 c;
      if (q.y < yFaceTop) {
        float v = (q.y - yf) / max(ht, 1e-4);
        float shade = mix(0.05, 0.46, pow(v, 1.6)) * (0.5 + 0.5 * mag) * mix(0.72, 1.0, smoothstep(0.0, 0.22, edgeX));
        c = tint * shade * jit * fog * (1.0 + 0.9 * scan + 0.5 * rise);
      } else {
        float tu = clamp((u - GAP) / (1.0 - 2.0 * GAP), 0.0, 1.0);
        float tv = clamp((q.y - yFaceTop) / ((1.0 - 2.0 * GAP) * rowH), 0.0, 1.0);
        float eb = min(min(tu, 1.0 - tu), min(tv, 1.0 - tv));
        float edge = 1.0 - smoothstep(0.0, 0.22, eb);
        float body = 0.55 + 1.05 * mag;
        c = tint * (body * (0.78 + 0.22 * (1.0 - edge)) + edge * (0.35 + 0.5 * mag)) * jit * fog;
        c *= 1.0 + 1.1 * scan + 0.9 * rise;
        c += mix(tint, vec3(1.0, 0.95, 0.85), 0.5) * blip * 1.2;
        c += vec3(1.0, 0.92, 0.75) * edge * mag * mag * 0.35 * grow;
      }
      col = c;
      hit = 1.0;
      break;
    }
  }
  if (hit < 0.5) {
    col += hz;
    // haze: columns glow into the air above them (coarse taps on the rows behind)
    if (cx > -9.0 && cx < GW + 9.0) {
      float hs = 0.0; vec3 hc = vec3(0.0);
      for (int j = 0; j < 4; j++) {
        float fj = float(j);
        float rr = r0 - 2.0 - fj * 3.0;
        float cc = cx + (mod(fj, 2.0) < 0.5 ? -2.0 : 2.0);
        float cd = cellCode(cc, rr);
        float on = step(0.5, cd);
        float sd = step(3.5, cd);
        hs += on * (0.3 + 0.2 * (cd - 3.0 * sd)) * (1.0 - fj * 0.2);
        hc += on * (sd > 0.5 ? vec3(1.0, 0.62, 0.26) : vec3(0.30, 0.62, 1.0));
      }
      col += hc / max(hs * 3.0, 1.0) * hs * 0.045 * smoothstep(0.0, 1.0, ph - 1.5) * (1.0 - smoothstep(15.0, 17.0, ph));
    }
  }

  // ---- HUD: title, legend ----
  vec3 inkC = vec3(0.94, 0.89, 0.76);
  {
    float ut = 0.0030;
    vec2 o1 = vec2(-0.5 * asp + 0.055, 0.5 - 0.075);
    col += inkC * fText((p - o1) / ut, ${T('COUNTY INDEX')}, ut / px) * 0.62;
    vec2 o2 = o1 - vec2(0.0, 0.026);
    col += inkC * fText((p - o2) / ut, ${T('STD DEV')}, ut / px) * 0.32;
    float lw = 0.42, lx0 = -0.5 * asp + 0.055, ly = -0.5 + 0.092;
    float tt = (p.x - lx0) / lw;
    float inB = step(0.0, tt) * step(tt, 1.0) * step(abs(p.y - ly), 0.0055);
    float s = tt * 2.0 - 1.0;
    float am = pow(abs(s), 0.85);
    vec3 lc = (s < 0.0 ? cool(am) : warm(am)) * (0.10 + 0.9 * am);
    col = mix(col, lc * 1.1, inB * 0.92);
    float tick = step(abs(p.x - (lx0 + lw * 0.5)), 0.0006) * step(abs(p.y - ly + 0.0055), 0.0085);
    col += inkC * tick * 0.55;
    float ul = 0.0022;
    col += cool(0.8) * fText((p - vec2(lx0, ly - 0.030)) / ul, ${T('INVEST>LOSS')}, ul / px) * 0.62;
    col += warm(0.7) * fText((p - vec2(lx0 + lw - ${f1(W('LOSS>INVEST'))} * ul, ly - 0.030)) / ul, ${T('LOSS>INVEST')}, ul / px) * 0.62;
  }

  col = 1.0 - exp(-col * 1.75);
  col = pow(col, vec3(0.94));
  float vig = smoothstep(1.3, 0.35, length(p * vec2(0.8, 1.15)));
  col *= mix(0.45, 1.0, vig);
  col += (h21(gl_FragCoord.xy + fract(uTime * 3.7) * 91.0) - 0.5) * mix(0.010, 0.026, I);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`,
}
export default reel
