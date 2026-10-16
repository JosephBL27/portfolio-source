// Composes ONE morph shader from all registered forms (see forms/types.ts for the contract).
// The engine binds two forms (A, B) by integer id and a mix 0..1; each particle travels from
// its slot in A to its slot in B.
//
// v10 "particle dynamics": the way a particle gets from A to B is a CHOREOGRAPHY picked per leg (MORPH_STYLE, keyed by the
// destination form), and the way it is DRAWN is a per-form style (FORM_STYLE). Both tables are exported so layout owners
// can tune them. Everything is a stateless function of (mix, time) per particle: scrubbing a leg back and forth gives the same
// frame at the same mix, and a particle sits exactly on its slot in A at mix 0 and in B at mix 1 whatever the style.
//
//   choreographies (MORPH_STYLES):
//     swirl    the original: a curl-noise swirl, every particle on its own random delay
//     pour     particles stream out along a thin liquid arc that swings past the hub TV screen
//     print    the target is built layer by layer from the bottom, 24 slabs, with a bright scan line at each deposit
//     shatter  the source bursts into a debris sphere (spinning), hangs, and the target assembles from that far field
//     sweep    a planar wavefront crosses the target left to right; particles are thrown across as it passes
//     gravity  particles fall, bounce once on the mirror floor (FLOOR_Y), then lift into the target
//     threads  1024 bundles of 256 particles funnel onto straight lines from one form to the other
//
//   render styles (FormStyle in forms/types.ts): disc / hard pixel / ring / streak shapes, sharpness (glow .. hard), a lit
//   "solid" look (each dot shaded as a sphere lit by the hub screen), an alpha-like blend feel, size and gain.
import type { FormDef, FormStyle } from '../forms/types'
import { HUB } from '../world/layout'

export const CURL = /* glsl */ `
vec3 pcurl(vec3 p) {
  // cheap divergence-free-ish field from a sum of rotated sines
  vec3 q = p;
  vec3 a = vec3(sin(q.y * 1.7 + q.z * 0.9), sin(q.z * 1.3 + q.x * 1.1), sin(q.x * 1.5 + q.y * 0.7));
  vec3 b = vec3(cos(q.z * 2.3 - q.y * 0.6), cos(q.x * 2.1 - q.z * 0.8), cos(q.y * 1.9 - q.x * 1.2));
  return cross(a, b) + 0.5 * vec3(sin(q.y * 3.1 + 1.3), sin(q.z * 2.9 + 2.1), sin(q.x * 3.3 + 0.7));
}`

// ---------------------------------------------------------------------------------------------------------------------
// tuning tables
// ---------------------------------------------------------------------------------------------------------------------
export const MORPH_STYLES = ['swirl', 'pour', 'print', 'shatter', 'sweep', 'gravity', 'threads'] as const
export type MorphStyle = (typeof MORPH_STYLES)[number]
/** the choreography of a leg, keyed by the DESTINATION form id (the form a forward scroll arrives at). Unlisted forms swirl.
 *  Scrolling back plays the same leg in reverse with the same style. Reduced motion forces 'swirl'. */
export const MORPH_STYLE: Record<string, MorphStyle> = {
  name: 'sweep',          // the title is revealed by a wavefront, left to right
  orbits: 'shatter',      // the name bursts, the world assembles from the far field
  brain: 'threads',       // synapse lines
  secretary: 'print',     // a machine, printed layer by layer
  watchdog: 'sweep',
  pushup: 'gravity',      // a push-up is a fight with gravity
  zeta: 'print',
  table: 'gravity',       // chips and cards dropped on the felt
  phase: 'swirl',         // the market: the original turbulence
  counties: 'sweep',      // a map revealed by a wavefront
  dyads: 'pour',
  surface: 'print',       // the vol surface plotted slab by slab
  cloudflare: 'threads',  // network lines
  appfolio: 'shatter',
  recruiting: 'pour',
  chomchom: 'gravity',
  uchicago: 'print',      // stone, laid course by course
  mathecon: 'sweep',
  compass: 'swirl',
  hold: 'pour',
  meeple: 'gravity',
  guitar: 'threads',      // strings
  turntable3d: 'sweep',
  knight: 'shatter',
  bust: 'print',
  epilogue: 'pour',       // everything flows back through the screen
}
export const morphStyleId = (id: string | undefined): number => Math.max(0, MORPH_STYLES.indexOf((id && MORPH_STYLE[id]) || 'swirl'))

/** default render style per form id (a FormDef.style overrides it). Several forms look different from the plain additive disc. */
export const FORM_STYLE: Record<string, FormStyle> = {
  zeta: { shape: 'pixel', size: 2.4, sharp: 1, thin: 0.6, gain: 0.26 },                 // hard pixel squares
  surface: { shape: 'ring', size: 3.0, sharp: 0.6, thin: 0.7, gain: 0.22 },             // crisp ring dots
  uchicago: { solid: 1, size: 1.7, sharp: 0.35, opaque: 0.5, thin: 0.3, gain: 0.5 },  // warm solid stone
  brain: { shape: 'disc', size: 1.6, sharp: -1, gain: 0.9 },                // soft glowing discs
  counties: { size: 0.6, sharp: 0.2, gain: 2.0 },                           // fine dust
  table: { shape: 'streak', streak: 4, size: 1.0, gain: 1.0 },             // streaked felt
  bust: { solid: 0.85, size: 1.3, opaque: 0.4, gain: 0.65 },                // marble
  meeple: { solid: 0.7, size: 1.3, sharp: 0.3, opaque: 0.3, gain: 0.65 },   // painted wood
  knight: { solid: 0.8, size: 1.25, sharp: 0.3, opaque: 0.35, gain: 0.65 },
}

/** world y of the mirror floor: 'gravity' bounces here (keep in sync with FLOOR_Y in world/extras/mirror.ts) */
export const FLOOR_Y = -6.6
/** where the hub screen is: the 'pour' arcs swing past it */
export const HUB_AIM: [number, number, number] = [HUB[0], HUB[1] + 0.3, HUB[2]]

/** FormStyle -> the numbers the shader wants: s1 = (square, ring, elongation, sharp), s2 = (solid, opaque, gain, thin), size = multiplier on pointSize */
export function packFormStyle(st: FormStyle | undefined): { s1: [number, number, number, number]; s2: [number, number, number, number]; size: number } {
  if (!st) return { s1: [0, 0, 1, 0], s2: [0, 0, 1, 0], size: 1 }
  const sq = st.shape === 'pixel' ? 1 : 0, ring = st.shape === 'ring' ? 1 : 0, el = st.shape === 'streak' ? Math.max(1, st.streak ?? 4) : 1
  return { s1: [sq, ring, el, Math.max(-1, Math.min(1, st.sharp ?? 0))], s2: [Math.max(0, Math.min(1, st.solid ?? 0)), Math.max(0, Math.min(1, st.opaque ?? 0)), st.gain ?? 1, Math.max(0, Math.min(0.9, st.thin ?? 0))], size: st.size ?? 1 }
}

// ---------------------------------------------------------------------------------------------------------------------
// GLSL: the choreographies. mp_path(style, mix, ...) -> position + colour progress + "in flight" 0..1 + a flash + turbulence scale
// ---------------------------------------------------------------------------------------------------------------------
const PATHS = /* glsl */ `
struct MPath { vec3 p; float kc; float fl; float flash; float tk; float ga; vec3 fcol; };
float mp_ss(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
vec3 mp_bez(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float u) { float v = 1.0 - u; return v * v * v * p0 + 3.0 * v * v * u * p1 + 3.0 * v * u * u * p2 + u * u * u * p3; }
vec3 mp_rotY(vec3 p, vec3 c, float th) { float cs = cos(th), sn = sin(th); vec3 d = p - c; return c + vec3(cs * d.x + sn * d.z, d.y, -sn * d.x + cs * d.z); }

MPath mp_path(int sid, float m, vec3 a, vec3 b, vec3 aL, vec3 bL, vec3 cA, vec3 cB) {
  const float PI = 3.14159265;
  MPath o; o.flash = 0.0; o.tk = 1.0; o.ga = 1.0; o.fcol = vec3(1.0, 0.85, 0.6);
  vec4 r = rnd;
  if (sid == 1) {
    // ---- pour: a thin liquid stream along an arc that swings past the hub screen
    float hrel = clamp((a.y - cA.y) / max(0.5, (uBndA.y - uBndA.x) * uScaleA) + 0.5, 0.0, 1.0);
    float ord = mix(r.x, 1.0 - hrel, 0.55);
    float u = mp_ss(ord * 0.5, ord * 0.5 + 0.5, m);
    float pull = 0.92 * mp_ss(4.0, 16.0, distance(cA, cB));
    vec3 c1 = mix(cA + vec3(0.0, 3.5, 0.0), uHub, pull), c2 = mix(cB + vec3(0.0, 3.5, 0.0), uHub, pull);
    float bump = pow(max(sin(PI * u), 0.0), 0.7), wid = mix(1.0, 0.2, bump);
    vec3 off = mix(a - cA, b - cB, mp_ss(0.2, 0.8, u)) * wid;
    o.p = mp_bez(cA, c1, c2, cB, u) + off;
    o.kc = mp_ss(0.35, 0.65, u); o.fl = max(sin(PI * u), 0.0); o.tk = 0.2;
    o.p.y += sin(u * 18.0 - uTime * 3.0 + r.y * 6.0) * 0.16 * o.fl;
    o.ga = mix(1.0, 0.28, bump); o.flash = 0.15 * o.fl; o.fcol = vec3(0.75, 0.9, 1.0);
  } else if (sid == 2) {
    // ---- print: 24 slabs, bottom first. A slab's particles lift off the source, hover above their layer, then drop in
    float H = max(0.2, (uBndB.y - uBndB.x) * uScaleB);
    float yb = clamp((b.y - (cB.y - 0.5 * H)) / H, 0.0, 1.0);
    float yq = (floor(yb * 23.999) + 0.5) / 24.0;
    float tArr = 0.34 + 0.56 * yq + (r.y - 0.5) * 0.012;
    float u = clamp((m - (tArr - 0.30)) / 0.30, 0.0, 1.0);
    float ex = mp_ss(0.0, 0.82, u);
    float hover = b.y + 2.2 + 2.0 * r.z;
    float y = mix(mix(a.y, hover, mp_ss(0.0, 0.45, u)), b.y, mp_ss(0.72, 1.0, u));
    o.p = vec3(mix(a.x, b.x, ex), y, mix(a.z, b.z, ex));
    o.kc = mp_ss(0.4, 0.95, u); o.fl = max(sin(PI * u), 0.0); o.tk = 0.15;
    float dt = (m - tArr) / 0.03; o.flash = 1.1 * exp(-dt * dt) * step(0.001, m) * step(m, 0.999); o.fcol = vec3(1.0, 0.82, 0.55);
  } else if (sid == 3) {
    // ---- shatter: burst into a debris sphere around the midpoint, hang, assemble
    vec3 cm = 0.5 * (cA + cB);
    vec3 dir = normalize(r.yzw * 2.0 - 1.0 + vec3(0.0001));
    vec3 M = cm + dir * (5.0 + 8.0 * r.w) * vec3(1.0, 0.7, 1.0);
    float k = clamp((m - r.x * 0.28) / 0.72, 0.0, 1.0);
    vec3 P;
    if (k < 0.5) { float u = k * 2.0, e = 1.0 - (1.0 - u) * (1.0 - u) * (1.0 - u); P = mix(a, M, e); }
    else { float u = (k - 0.5) * 2.0, e = u * u * (3.0 - 2.0 * u); P = mix(M, b, e); }
    o.p = mp_rotY(P, cm, (r.z - 0.5) * 7.0 * sin(PI * k));
    o.kc = mp_ss(0.38, 0.62, k); o.fl = max(sin(PI * k), 0.0); o.tk = 0.45;
    o.flash = 0.3 * o.fl; o.fcol = vec3(1.0, 0.7, 0.45);
  } else if (sid == 4) {
    // ---- sweep: a planar front crosses the target along its own x axis
    float s = clamp((bL.x - uBndB.z) / max(0.1, uBndB.w - uBndB.z), 0.0, 1.0);
    float tF = 0.28 + 0.46 * s + (r.y - 0.5) * 0.03; // front arrival time: never before 0.26 (u must be 0 at mix 0) nor after ~0.76
    float u = mp_ss(tF - 0.26, tF, m);
    vec3 ax = vec3(cos(uPlaceB.w), 0.0, -sin(uPlaceB.w));
    o.p = mix(a, b, u) + ax * 1.1 * sin(PI * u) * (0.4 + r.z) + vec3(0.0, 1.0, 0.0) * 0.6 * sin(PI * u) * sin(s * 16.0 + u * 6.0);
    o.kc = mp_ss(0.35, 0.8, u); o.fl = max(sin(PI * u), 0.0); o.tk = 0.25;
    float dt = (m - tF) / 0.028; o.flash = 0.6 * exp(-dt * dt) * step(0.001, m) * step(m, 0.999); o.fcol = vec3(0.65, 0.88, 1.0);
  } else if (sid == 5) {
    // ---- gravity: free fall to the floor, one bounce with a splash, then a lift into the target
    const float T1 = 0.36, T2 = 0.52;
    // the bounce plane is the mirror floor, lifted when both forms hang high so the impact stays in the shot
    float fy = max(uFloorY, min(cA.y - 0.5 * (uBndA.y - uBndA.x) * uScaleA, cB.y - 0.5 * (uBndB.y - uBndB.x) * uScaleB) - 0.5);
    float drop = max(a.y - fy, 0.5);
    float u = clamp((m - r.x * 0.3) / 0.7, 0.0, 1.0);
    vec2 sd = normalize(vec2(r.y - 0.5, r.w - 0.5) + vec2(0.0001, 0.0));
    vec2 land = a.xz + sd * (0.25 * drop + 0.8) * (0.2 + 0.8 * sqrt(r.z));
    vec3 P;
    if (u < T1) { float v = u / T1; vec2 xz = mix(a.xz, land, 0.5 * v * v); P = vec3(xz.x, a.y - drop * v * v, xz.y); }
    else if (u < T2) {
      float v = (u - T1) / (T2 - T1), H = (0.8 + 0.18 * drop) * (0.5 + r.y);
      vec2 xz = mix(mix(a.xz, land, 0.5), land, v);
      P = vec3(xz.x, fy + 4.0 * H * v * (1.0 - v), xz.y);
    } else { float v = mp_ss(T2, 1.0, u); P = mix(vec3(land.x, fy, land.y), b, v); P.y += sin(PI * v) * 0.8 * r.z; }
    o.p = P; o.kc = mp_ss(0.5, 0.95, u); o.fl = max(sin(PI * u), 0.0); o.tk = 0.35;
    o.ga = 1.0 - 0.4 * mp_ss(0.15, 0.3, u) * (1.0 - mp_ss(0.62, 0.8, u)); // a pile on a plane is dense: dim it a little while it lies there
    float dt = (u - T1) / 0.05; o.flash = 1.0 * exp(-dt * dt) * step(0.001, m) * step(m, 0.999); o.fcol = vec3(1.0, 0.78, 0.5);
  } else if (sid == 6) {
    // ---- threads: bundles of 256 particles funnel onto one straight line (leader texel -> leader texel), ride it, fan out
    vec2 lref = (floor(ref * uTexW / 16.0) * 16.0 + 8.5) / uTexW;
    vec3 aLd = place(texture2D(uPosA, lref).xyz, uPlaceA, uScaleA), bLd = place(texture2D(uPosB, lref).xyz, uPlaceB, uScaleB);
    float u = mp_ss(r.x * 0.45, r.x * 0.45 + 0.55, m);
    float c1 = mp_ss(0.0, 0.28, u), d3 = mp_ss(0.72, 1.0, u), s = mp_ss(0.18, 0.82, u);
    o.p = mix(aLd, bLd, s) + (a - aLd) * (1.0 - c1) + (b - bLd) * d3;
    o.kc = mp_ss(0.55, 0.9, u); o.fl = max(sin(PI * u), 0.0); o.tk = 0.03;
    o.flash = 0.7 * c1 * (1.0 - d3) * o.fl; o.fcol = vec3(0.7, 0.9, 1.0);
  } else {
    // ---- swirl (the original)
    float delay = r.x * uSpread;
    float k = smoothstep(delay, delay + (1.0 - uSpread), m);
    o.p = mix(a, b, k); o.kc = k; o.fl = sin(PI * k);
  }
  return o;
}`

export function composeVertex(forms: FormDef[]): string {
  const has = (f: FormDef, fn: string) => !!f.glsl && new RegExp(`\\b${fn}_${f.id}\\s*\\(`).test(f.glsl)
  const branch = (fn: string, call: string, fallback: string) =>
    forms.map((f, i) => (has(f, fn) ? `  if (id == ${i}) return ${fn}_${f.id}(${call});\n` : '')).join('') + `  return ${fallback};\n`
  return /* glsl */ `
precision highp float;
uniform sampler2D uPosA; uniform sampler2D uPosB; uniform sampler2D uColA; uniform sampler2D uColB;
uniform int uIdA; uniform int uIdB;
uniform float uMix; uniform float uTime; uniform float uTurb; uniform float uDriftA; uniform float uDriftB;
uniform float uSizeA; uniform float uSizeB; uniform float uPointSize; uniform float uDpr; uniform float uSpread;
uniform float uMinPx; // v4: minimum point size in target pixels (0 = 1 device px); the field's exposure meter sets 1 so its tiny target stays energy-exact
// v4 world placement: each bound form can sit anywhere in the world (identity by default)
uniform vec4 uPlaceA; uniform vec4 uPlaceB; // xyz = offset, w = yaw (radians)
uniform float uScaleA; uniform float uScaleB;
vec3 place(vec3 p, vec4 pl, float s) { float c = cos(pl.w), q = sin(pl.w); p *= s; return vec3(c * p.x + q * p.z, p.y, -q * p.x + c * p.z) + pl.xyz; }
uniform vec3 uMouse; uniform float uMouseR; uniform float uMouseK;
// v19 signal bus (world/signals.ts; reactive.ts adds these to the material at runtime: until then they are zero and every branch below is skipped)
uniform vec4 uSgPtr; uniform vec3 uSgRo; uniform vec3 uSgPv; uniform vec3 uSgPcol; // pointer ray (xyz, w = presence), camera, pointer motion, light colour
uniform vec4 uSgMus; uniform vec4 uSgRip; uniform vec3 uSgMc;                          // music bands, beat ring (x phase, y amp), the song's colour
// v10 dynamics (all optional: a host that sets none of them gets the original swirl and plain additive discs)
uniform float uStyle;        // choreography id of this pair (MORPH_STYLES index)
uniform vec4 uBndA; uniform vec4 uBndB; // local bounds of each form: (ymin, ymax, xmin, xmax)
uniform vec3 uCenA; uniform vec3 uCenB; // world centre of each bound form (placement applied to the bounds centre; the field computes it on the CPU)
uniform float uFloorY; uniform vec3 uHub; uniform float uTexW;
uniform vec4 uS1A; uniform vec4 uS1B; uniform vec4 uS2A; uniform vec4 uS2B; // render styles, see packFormStyle
uniform vec4 uLight[4]; uniform vec3 uLightCol[4]; uniform float uTintK; // hub / live-TV light sources: xyz + radius, rgb * intensity
uniform float uMixV; uniform float uStreakK; uniform vec2 uRes; // |d mix / dt|, streak strength (0 = off), canvas size in css px
attribute vec2 ref; attribute vec4 rnd;
varying vec4 vCol; varying float vDepth;
varying vec4 vShape;  // x square, y ring, z elongation (sprite is an ellipse 1 : 1/z), w sharp (-1 glow .. 1 hard)
varying vec2 vDir;    // screen direction of the elongation
varying vec3 vSolid;  // x solid amount, y macro lambert, z opaque amount
varying vec3 vL;      // view-space direction to the key light, length = its intensity
uniform sampler2D uExpo; uniform float uExpoOn; // the auto-exposure lives on the GPU (field.ts): a 1x1 float texture, never read back; uExpoOn 0 = not driven (gain 1)
varying float vExpo;
${CURL}
${forms.map(f => f.glsl ?? '').join('\n')}
vec3 animForm(int id, vec3 p, vec4 d, vec4 r, float t) {
${branch('anim', 'p, d, r, t', 'p')}}
float sizeForm(int id, vec4 d, vec4 r, float t) {
${branch('size', 'd, r, t', '1.0')}}
vec4 colorForm(int id, vec4 c, vec4 d, vec4 r, float t) {
${branch('color', 'c, d, r, t', 'c')}}
${PATHS}
void main() {
  vExpo = uExpoOn > 0.5 ? texelFetch(uExpo, ivec2(0), 0).r : 1.0;
  vec4 dA = texture2D(uPosA, ref), dB = texture2D(uPosB, ref);
  float t = uTime;
  vec3 aL = animForm(uIdA, dA.xyz, dA, rnd, t), bL = animForm(uIdB, dB.xyz, dB, rnd, t);
  vec3 a = place(aL, uPlaceA, uScaleA), b = place(bL, uPlaceB, uScaleB);
  int sid = int(uStyle + 0.5);
  vec3 cA = uCenA, cB = uCenB;
  MPath o = mp_path(sid, uMix, a, b, aL, bL, cA, cB);
  float k = o.kc, flight = o.fl;
  vec3 p = o.p;
  float drift = mix(uDriftA, uDriftB, k);
  p += pcurl(p * 0.42 + vec3(t * 0.07, -t * 0.05, t * 0.04) + rnd.yzw * 2.0) * (uTurb * flight * o.tk * (0.6 + rnd.w) + drift);
  // pointer: particles near the pointer ray part like water
  vec3 toM = p - uMouse; float dm = length(toM.xy);
  p += vec3(normalize(toM.xy + 1e-4), 0.25) * uMouseK * exp(-dm * dm / (uMouseR * uMouseR)) * (0.5 + rnd.z);
  // v19 signals: the pointer is a gentle gravity well and a light; the bass swells the cloud and each hit sends a ring out from the hub
  float sgGlow = 0.0, sgRing = 0.0;
  if (uSgPtr.w > 0.001) {
    vec3 rel = p - uSgRo; float tp = dot(rel, uSgPtr.xyz);
    if (tp > 0.5) {
      vec3 perp = rel - uSgPtr.xyz * tp; float R = 0.17 * tp + 0.6; float wq = exp(-dot(perp, perp) / (R * R)) * uSgPtr.w;
      p -= perp * (0.42 * wq);                        // the nearest particles lean toward the ray
      p += uSgPv * (R * wq * (0.5 + rnd.z));         // and are carried a little way along the pointer's motion
      sgGlow = wq;
    }
  }
  if (uSgRip.y > 0.001) {
    vec3 dh = p - uHub; float dl = length(dh), fr = (dl - uSgRip.x * 48.0) / 3.2;
    sgRing = exp(-fr * fr) * uSgRip.y; p += dh / (dl + 1e-3) * sgRing * 1.1;
  }
  if (uSgMus.x > 0.001) p += (p - uHub) * (uSgMus.x * 0.014 * (0.4 + rnd.w));
  vec4 cA4 = colorForm(uIdA, texture2D(uColA, ref), dA, rnd, t);
  vec4 cB4 = colorForm(uIdB, texture2D(uColB, ref), dB, rnd, t);
  vCol = mix(cA4, cB4, k);
  vCol.rgb += vec3(1.0, 0.45, 0.25) * flight * uTurb * 0.15 * rnd.y; // embers in flight
  vCol.a *= o.ga;
  vCol.rgb += o.fcol * o.flash * 0.9;                                  // style flash: scan line, wavefront, floor impact, thread glow
  // hub screen / live TV light: the channel's colour tints the particles near it
  if (uLight[0].w > 0.0) {
    vec3 tint = vec3(0.0);
    for (int i = 0; i < 4; i++) { float R = uLight[i].w; if (R > 0.0) { vec3 dd = p - uLight[i].xyz; tint += uLightCol[i] * exp(-dot(dd, dd) / (0.4 * R * R)); } }
    float tl = max(tint.r, max(tint.g, tint.b));
    if (tl > 0.001) { vec3 hue = tint / tl; float amt = clamp(tl * uTintK, 0.0, 0.62); vCol.rgb = mix(vCol.rgb, vCol.rgb * (0.35 + 1.45 * hue), amt) + tint * 0.035 * vCol.a; }
  }
  vCol.rgb += (uSgPcol * sgGlow * 0.95 + mix(vec3(0.85, 0.92, 1.0), uSgMc, 0.6) * sgRing * 0.9 + uSgMc * uSgMus.x * 0.05) * vCol.a;   // v19: the pointer's light, the beat ring, a bass flush in the song's colour
  float s = mix(uSizeA * sizeForm(uIdA, dA, rnd, t), uSizeB * sizeForm(uIdB, dB, rnd, t), k);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vDepth = -mv.z;
  float ps = uPointSize * s * uDpr * (9.0 / max(0.5, -mv.z)) * (0.75 + 0.5 * rnd.y);
  // v4 flight: far points never shrink below ~1 device px (they shimmer); the lost area is paid back as alpha.
  // Points nearer than ~2.5 units fade out and the size is capped, so flying through the cloud never blows out.
  { float minPs = uMinPx > 0.0 ? uMinPx : 1.0 * uDpr; if (ps < minPs) { vCol.a *= (ps * ps) / (minPs * minPs); ps = minPs; } }
  vCol.a *= smoothstep(0.25, 2.5, -mv.z);
  ps = min(ps, 40.0 * uDpr);
  // ---- v10 render style (blended A -> B with the colour progress)
  vec4 s1 = mix(uS1A, uS1B, k), s2 = mix(uS2A, uS2B, k);
  vCol.a *= s2.z > 0.0 ? s2.z : 1.0;
  if (uS2A.w + uS2B.w > 0.001) { // thinned form: a fixed pseudo-random subset is hidden (the rest carry bigger dots)
    float hh = fract(sin(dot(ref, vec2(12.9898, 78.233))) * 43758.5453);
    vCol.a *= 1.0 - (1.0 - smoothstep(s2.w, s2.w + 0.06, hh)) * smoothstep(0.0, 0.03, s2.w);
  }
  float eS = max(1.0, s1.z);
  float major = ps * sqrt(eS), minor = ps / sqrt(eS), major0 = major;
  vec2 dir = vec2(1.0, 0.0);
  if (uS1A.z + uS1B.z > 2.001) { // a static dash (brushed felt): along the form's own x axis, jittered per particle
    float yw = mix(uPlaceA.w, uPlaceB.w, k);
    vec3 xv = mat3(viewMatrix) * vec3(cos(yw), 0.0, -sin(yw));
    vec2 sd = normalize(xv.xy + vec2(1e-4)); float g = (rnd.z - 0.5) * 0.9, cg = cos(g), sg = sin(g);
    dir = vec2(cg * sd.x - sg * sd.y, sg * sd.x + cg * sd.y);
  }
  // motion streak: stretch along the particle's screen-space velocity (the derivative of its path over the mix), only while it is in flight
  if (uStreakK > 0.0 && uMixV > 0.0 && flight > 0.004 && uMix > 0.0005 && uMix < 0.9995) {
    MPath o2 = mp_path(sid, min(1.0, uMix + 0.015), a, b, aL, bL, cA, cB);
    vec4 q0 = projectionMatrix * modelViewMatrix * vec4(o.p, 1.0), q1 = projectionMatrix * modelViewMatrix * vec4(o2.p, 1.0);
    if (q0.w > 0.1 && q1.w > 0.1) {
      vec2 v = (q1.xy / q1.w - q0.xy / q0.w) * 0.5 * uRes / 0.015 * uMixV * 0.025; // css px over one 25 ms exposure
      float L = min(length(v), 28.0) * uStreakK * uDpr;
      if (L > 0.5) {
        float extra = major - ps;
        dir = normalize(dir * extra + (v / max(length(v), 1e-4)) * L + vec2(1e-5, 0.0));
        major += L;
        vCol.a *= pow(major0 / major, 0.45);
      }
    }
  }
  major = min(major, 40.0 * uDpr);
  vShape = vec4(s1.x, s1.y, clamp(major / max(minor, 0.5), 1.0, 40.0), s1.w);
  vDir = dir;
  // lit-surface look: a radial macro normal about the form's centre, lit by the key light (the hub screen)
  vL = vec3(0.0); vSolid = vec3(0.0, 0.5, s2.y);
  if (uS2A.x + uS2B.x > 0.0) {
    vec3 Lw = uLight[0].w > 0.0 ? normalize(uLight[0].xyz - p) : vec3(0.0, 1.0, 0.0);
    float keyI = clamp(dot(uLightCol[0], vec3(0.3333)), 0.0, 1.0);
    vL = mat3(viewMatrix) * Lw * (uLight[0].w > 0.0 ? keyI : 0.6);
    vSolid = vec3(s2.x, dot(normalize(p - mix(cA, cB, k) + vec3(1e-4)), Lw) * 0.5 + 0.5, s2.y);
  }
  gl_PointSize = major;
  if (vCol.a <= 0.002) gl_PointSize = 0.0;
}`
}

export const FRAGMENT = /* glsl */ `
precision highp float;
varying vec4 vCol; varying float vDepth;
varying vec4 vShape; varying vec2 vDir; varying vec3 vSolid; varying vec3 vL; varying float vExpo;
uniform float uFocus; uniform float uBokeh; uniform float uGainX; // uGainX: extra gain, 0 = none (optional; the field raises it when it draws fewer particles)
uniform float uFieldHide;   // v10: 0 = particles drawn (default, so hosts that never set it are unaffected), 1 = every particle hidden (Field.setFieldAlpha)
uniform float uAlphaBlend;  // v10: 1 when the material blends (ONE, ONE_MINUS_SRC_ALPHA): the alpha channel then carries the form's "opaque" amount
void main() {
  vec2 c = gl_PointCoord - 0.5; c.y = -c.y;
  float E = vShape.z;
  vec2 q = c;
  if (E > 1.01) { q = vec2(dot(c, vDir), dot(c, vec2(-vDir.y, vDir.x))); q.y *= E; }
  float d = length(q);
  if (vShape.x > 0.001) d = mix(d, max(abs(q.x), abs(q.y)), vShape.x);
  float soft = mix(0.5, 0.18, clamp(1.0 - abs(vDepth - uFocus) * uBokeh, 0.0, 1.0));
  float sharp = vShape.w;
  if (sharp > 0.0) soft = mix(soft, 0.03, sharp);
  float a = smoothstep(0.5, 0.5 - soft, d);
  if (sharp < 0.0) a = mix(a, exp(-d * d * 14.0) * smoothstep(0.5, 0.4, d), -sharp); // glowing disc: a bright core with a long tail
  if (vShape.y > 0.001) a *= mix(1.0, smoothstep(0.16, 0.3, d), vShape.y) * (1.0 + 0.35 * vShape.y);
  if (a <= 0.001) discard;
  vec3 col = vCol.rgb;
  if (vSolid.x > 0.001) {
    vec3 n = vec3(c * 2.0, 0.0); n.z = sqrt(max(0.0, 1.0 - dot(n.xy, n.xy)));
    float Ll = length(vL); vec3 Ld = vL / max(Ll, 1e-4);
    float lam = max(0.0, dot(n, Ld)), spec = pow(max(0.0, dot(reflect(-Ld, n), vec3(0.0, 0.0, 1.0))), 16.0);
    float shade = 0.38 + Ll * (0.6 * vSolid.y + 0.55 * lam + 0.3 * spec);
    col *= mix(1.0, shade, vSolid.x);
  }
  float fa = 1.0 - uFieldHide;
  float oa = uAlphaBlend > 0.5 ? clamp(vSolid.z * a * min(1.0, vCol.a), 0.0, 0.9) * fa : 1.0;
  gl_FragColor = vec4(col * vCol.a * a * (1.0 + uGainX) * vExpo * fa, oa);
}`

/** per-particle attributes for a W x H texture of particles */
export function particleAttributes(count: number, W: number, seed = 1) {
  const ref = new Float32Array(count * 2), rnd = new Float32Array(count * 4)
  let s = seed >>> 0
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  for (let i = 0; i < count; i++) {
    ref[i * 2] = ((i % W) + 0.5) / W; ref[i * 2 + 1] = (Math.floor(i / W) + 0.5) / (count / W)
    rnd[i * 4] = r(); rnd[i * 4 + 1] = r(); rnd[i * 4 + 2] = r(); rnd[i * 4 + 3] = r()
  }
  return { ref, rnd }
}
