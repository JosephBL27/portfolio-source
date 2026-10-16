// Shared kit for the physical set pieces of src/v3/world/extras/transitions.ts (unit 6T).
//   * the piece contract (Leg, Env, FrameIn, FrameOut, Piece)
//   * pure maths: closed-form damped springs (reversible hinges), monotone keyframe curves, smoothsteps
//   * ONE procedural surface shader ("stage material"): limestone courses, oak planks, iron, brass, polished flags, cloth, carved relief,
//     stained glass, emissive. It does its own lighting (a cool hemisphere, a moon key, two warm point lights the piece moves around),
//     so adding a set piece never changes the scene's light count (that would recompile every TV material). It writes display-referred
//     colour like the rest of the world, dissolves in and out through a noisy edge that burns bright (the particle world's idiom), and
//     fades itself inside the copy lane while copy is on screen (legibility first).
//   * geometry helpers: tagged merges (one draw call per piece part), pointed arches, voussoirs, lathe columns.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { ExtraCtx } from '../../../main'
import type { FlightState } from '../../flight'
import type { Waypoint } from '../../layout'
import { LANE_GLSL, LANE_ON, Lane } from '../lib/lane'

// ------------------------------------------------------------------------------------------ contract
export interface CamPose { pos: [number, number, number]; target: [number, number, number]; fov: number }
export interface Leg {
  key: string
  i0: number; i1: number
  A: Waypoint; B: Waypoint
  /** p range of the leg in the scroll track */
  p0: number; p1: number
}
export interface Env {
  ctx: ExtraCtx
  field: any
  scene: THREE.Scene
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  world: any
  lane: Lane
  /** the flight's own camera at leg progress u (0..1 linear) */
  flightCam(u: number): CamPose
  /** flight state at leg progress u */
  stateAt(u: number): FlightState
  /** one canvas-pixel buffer size shared by every piece */
  res: THREE.Vector2
  /** a still-image budget switch for the screenshot harness (?tr=...) */
  q: { shadows: boolean; dust: boolean; reflect: boolean }
}
export interface FrameIn { u: number; t: number; dt: number; st: FlightState; copy: number; dir: 1 | -1 }
export interface FrameOut {
  /** particle alpha (1 = the usual field) */
  field: number
  /** extra additive post flash 0..1 (host draws it as a camera-attached quad) */
  flash: number
  flashCol: [number, number, number]
}
export interface Piece {
  leg: Leg
  /** allocate geometry + compile (host calls it once, shortly before the leg is reached) */
  build(env: Env): void
  /** update the stage for leg progress u. Pure in u (apart from time-based shimmer). */
  frame(inp: FrameIn, out: FrameOut, env: Env): void
  /** the camera at leg progress u (already lead-compensated by the host); return null to leave the flight's pose */
  camera(u: number, base: CamPose, env: Env): CamPose | null
  /** u thresholds where a named cue fires (either direction) */
  cues: { at: number; name: string }[]
  /** hide / show the whole stage */
  setVisible(v: boolean, env: Env): void
  dispose(): void
}

// ------------------------------------------------------------------------------------------ maths
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
export const sstep5 = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10) }
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3)
export const easeIn = (t: number) => clamp01(t) * clamp01(t) * clamp01(t)
export const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
export const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
export function hash1(n: number) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
export function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
/**
 * Unit step response of a damped spring, closed form (a pure function of time, so scrubbing back replays the swing exactly).
 * zeta < 1 overshoots by exp(-pi zeta / sqrt(1 - zeta^2)); w = natural frequency (rad per unit of tau).
 */
export function springResp(tau: number, w: number, zeta: number): number {
  if (tau <= 0) return 0
  if (zeta >= 1) return 1 - Math.exp(-w * tau) * (1 + w * tau)
  const wd = w * Math.sqrt(1 - zeta * zeta), e = Math.exp(-zeta * w * tau)
  return 1 - e * (Math.cos(wd * tau) + (zeta * w / wd) * Math.sin(wd * tau))
}
/** monotone cubic (Fritsch-Carlson) through [x, y] keys: smooth, no overshoot between keys. */
export function keys(k: [number, number][]) {
  const n = k.length, xs = k.map(a => a[0]), ys = k.map(a => a[1])
  const d: number[] = [], m: number[] = new Array(n).fill(0)
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
  m[0] = d[0]; m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b
    if (s > 9) { const tt = 3 / Math.sqrt(s); m[i] = tt * a * d[i]; m[i + 1] = tt * b * d[i] }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0; while (x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
  }
}

// ------------------------------------------------------------------------------------------ stage material
export interface Shared {
  uTime: THREE.IUniform<number>
  uDissolve: THREE.IUniform<number>
  uWarm: THREE.IUniform<number>
  uWarm2: THREE.IUniform<number>
  uAmb: THREE.IUniform<number>
  uMoon: THREE.IUniform<number>
  uGlow: THREE.IUniform<number>
  uCopy: THREE.IUniform<number>
  uLightPos: THREE.IUniform<THREE.Vector3>
  uLight2Pos: THREE.IUniform<THREE.Vector3>
  uWarmCol: THREE.IUniform<THREE.Color>
  uEdge: THREE.IUniform<THREE.Color>
  uTymC: THREE.IUniform<THREE.Vector2>
  uLane: THREE.IUniform<THREE.Vector4>
  uRes: THREE.IUniform<THREE.Vector2>
  uLaneOn: THREE.IUniform<number>
}
export function makeShared(env: Env): Shared {
  return {
    uTime: { value: 0 }, uDissolve: { value: 0 }, uWarm: { value: 0 }, uWarm2: { value: 0 }, uAmb: { value: 0.16 }, uMoon: { value: 1 }, uGlow: { value: 0.0 },
    uCopy: { value: 0 }, uLightPos: { value: new THREE.Vector3() }, uLight2Pos: { value: new THREE.Vector3() },
    uWarmCol: { value: new THREE.Color(1.0, 0.62, 0.3) }, uEdge: { value: new THREE.Color(1.0, 0.72, 0.4) }, uTymC: { value: new THREE.Vector2(0, 3.9) },
    uLane: { value: env.lane.u }, uRes: { value: env.res }, uLaneOn: LANE_ON,
  }
}

export const KIND = { stone: 0, wood: 1, iron: 2, brass: 3, floor: 4, glow: 5, cloth: 6, paper: 7, emis: 8, carved: 9, shard: 10 } as const

const VERT = /* glsl */ `
attribute float aKind;
varying vec3 vW; varying vec3 vN; varying vec3 vL; varying vec2 vUv; varying float vK;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vL = position; vUv = uv; vK = aKind;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime, uDissolve, uWarm, uWarm2, uAmb, uMoon, uGlow, uCopy;
uniform vec3 uLightPos, uLight2Pos, uWarmCol, uEdge, uTint;
uniform vec2 uTymC;
varying vec3 vW; varying vec3 vN; varying vec3 vL; varying vec2 vUv; varying float vK;
${LANE_GLSL}

float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
float fbm2(vec3 p) { return 0.6 * vn(p) + 0.4 * vn(p * 2.3 + 3.7); }

struct Surf { vec3 alb; float rough; float metal; float h; vec3 emis; float ao; float bump; };

void stoneS(vec3 P, vec3 N, out Surf s) {
  vec3 an = abs(N); vec2 q; float face = 0.0;
  if (an.z >= an.x && an.z >= an.y) q = P.xy; else if (an.x >= an.y) { q = P.zy; face = 7.0; } else { q = P.xz; face = 13.0; }
  float ch = 0.58, row = floor(q.y / ch);
  float bl = 1.0 + 0.9 * h13(vec3(row, 3.7, 1.3 + face));
  float off = bl * h13(vec3(row, 9.1, 4.4 + face));
  float cx = (q.x + off) / bl, col = floor(cx);
  vec2 f = vec2(fract(cx) * bl, fract(q.y / ch) * ch);
  float e = min(min(f.x, bl - f.x), min(f.y, ch - f.y));
  float joint = 1.0 - smoothstep(0.010, 0.034, e);
  float bid = h13(vec3(col, row, 2.0 + face));
  float n1 = fbm(P * 2.6), n2 = vn(P * 15.0), n3 = vn(P * 40.0);
  float bevel = smoothstep(0.0, 0.075, e);
  s.h = bevel * 0.55 + n1 * 0.35 + n2 * 0.07 + n3 * 0.02 - joint * 0.45;
  vec3 base = uTint * (0.74 + 0.4 * bid) * (0.78 + 0.46 * n1);
  base *= 1.0 - 0.42 * joint;
  base = mix(base, base * vec3(0.8, 0.88, 0.66), smoothstep(0.55, 0.92, n2) * 0.45);
  s.alb = base; s.rough = 0.9; s.metal = 0.0; s.emis = vec3(0.0); s.ao = 1.0 - 0.4 * joint - 0.12 * (1.0 - bevel); s.bump = 0.7;
}
void woodS(vec3 P, vec3 N, out Surf s) {
  float pw = 0.3125, pid = floor(P.x / pw + 0.0001), fx = fract(P.x / pw) * pw, edge = min(fx, pw - fx);
  float gap = 1.0 - smoothstep(0.003, 0.02, edge);
  float g = fbm(vec3(P.x * 16.0 + pid * 7.0, P.y * 1.0 + pid * 3.0, P.z * 5.0));
  float rings = 0.5 + 0.5 * sin(P.x * 34.0 + g * 7.0 + pid * 2.0);
  float cross = 1.0 - smoothstep(0.004, 0.018, abs(fract(P.y / 0.92 + pid * 0.37) - 0.5) - 0.495);
  s.h = 0.5 * (1.0 - gap) + rings * 0.05 + g * 0.05 + 0.0 * cross;
  vec3 oak = mix(vec3(0.17, 0.095, 0.045), vec3(0.34, 0.2, 0.1), g);
  oak *= (0.82 + 0.34 * h13(vec3(pid, 1.0, 2.0))) * (0.74 + 0.3 * rings);
  oak = mix(oak, vec3(0.02, 0.014, 0.01), gap * 0.92);
  s.alb = oak; s.rough = 0.58; s.metal = 0.0; s.emis = vec3(0.0); s.ao = 1.0 - 0.7 * gap; s.bump = 1.1;
}
void ironS(vec3 P, out Surf s) {
  float n = fbm(P * 9.0), r = smoothstep(0.58, 0.8, fbm(P * 3.1 + 11.0));
  s.alb = mix(vec3(0.07, 0.072, 0.08), vec3(0.2, 0.09, 0.045), r * 0.7) * (0.8 + 0.5 * n);
  s.rough = 0.36 + 0.4 * n + 0.2 * r; s.metal = 0.85 - 0.5 * r; s.h = n * 0.25; s.emis = vec3(0.0); s.ao = 1.0; s.bump = 0.45;
}
void brassS(vec3 P, out Surf s) {
  float n = fbm(P * 12.0);
  s.alb = vec3(0.82, 0.58, 0.24) * (0.7 + 0.5 * n); s.rough = 0.3 + 0.2 * n; s.metal = 0.95; s.h = n * 0.1; s.emis = vec3(0.0); s.ao = 1.0; s.bump = 0.3;
}
void floorS(vec3 P, out Surf s) {
  float c = cos(0.05), sn = sin(0.05); vec2 q = vec2(c * P.x - sn * P.z, sn * P.x + c * P.z) / vec2(1.25, 1.9);
  vec2 id = floor(q), f = fract(q); float e = min(min(f.x, 1.0 - f.x) * 1.25, min(f.y, 1.0 - f.y) * 1.9);
  float joint = 1.0 - smoothstep(0.012, 0.04, e);
  float tone = h13(vec3(id, 3.3)), n = fbm(vec3(P.x * 1.7, 0.0, P.z * 1.7)), vein = smoothstep(0.7, 0.95, vn(vec3(P.x * 6.0 + n * 4.0, 0.0, P.z * 1.2)));
  s.alb = mix(vec3(0.09, 0.085, 0.095), vec3(0.2, 0.18, 0.16), tone * 0.6 + n * 0.4) * (1.0 - 0.7 * joint) * (1.0 + 0.5 * vein);
  s.rough = 0.22 + 0.5 * joint; s.metal = 0.0; s.h = (1.0 - joint) * 0.3 + n * 0.1; s.emis = vec3(0.0); s.ao = 1.0 - 0.5 * joint; s.bump = 0.35;
}
void clothS(vec3 P, out Surf s) {
  vec2 uv = vUv; float wf = 1.0 - smoothstep(0.004, 0.012, max(fwidth(uv.x), fwidth(uv.y)));
  float weave = 0.5 + wf * (0.25 * sin(uv.x * 120.0) + 0.25 * sin(uv.y * 150.0));
  float border = smoothstep(0.045, 0.05, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y))) - smoothstep(0.075, 0.08, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  vec2 c = abs(uv - vec2(0.5, 0.55)); float dia = 1.0 - smoothstep(0.0, 0.015, abs(c.x * 0.9 + c.y * 0.45 - 0.2));
  vec3 maroon = vec3(0.42, 0.035, 0.07) * (0.7 + 0.35 * weave);
  s.alb = mix(maroon, vec3(0.9, 0.64, 0.24), clamp(border + dia * 0.9, 0.0, 1.0));
  s.rough = 0.85; s.metal = 0.0; s.h = weave * 0.25; s.emis = vec3(0.0); s.ao = 1.0; s.bump = 0.5;
}
void carvedS(vec3 P, vec3 N, out Surf s) {
  vec2 q = P.xy - uTymC; float r = length(q), a = atan(q.y, q.x);
  float rose = r - (0.62 + 0.07 * cos(a * 8.0));
  float rim = 1.0 - smoothstep(0.0, 0.035, abs(rose));
  vec2 qa = abs(q); float d4 = min(length(qa - vec2(0.2, 0.0)), length(qa - vec2(0.0, 0.2))) - 0.19; // quatrefoil
  float petals = 1.0 - smoothstep(-0.015, 0.015, d4);
  float boss = 1.0 - smoothstep(0.0, 0.05, r - 0.06);
  float ring2 = 1.0 - smoothstep(0.0, 0.03, abs(r - 0.4));
  float lobes = 0.5 + 0.5 * cos(a * 8.0 + 0.0);
  float spokes = (1.0 - smoothstep(0.0, 0.03, abs(fract(a * 8.0 / 6.2831853 + 0.5) - 0.5) * r * 0.78)) * step(0.4, r) * step(r, 0.6);
  float rel = rim * 0.7 + petals * 0.9 + boss * 0.7 + ring2 * 0.4 + spokes * 0.45;
  vec3 st = vec3(0.0); Surf b; stoneS(P, N, b);
  s = b; s.h = b.h * 0.35 + rel * 1.2; s.alb = b.alb * (0.82 + 0.5 * clamp(rel, 0.0, 1.0)) + vec3(0.1, 0.07, 0.03) * boss;
  s.ao = b.ao * (0.62 + 0.38 * clamp(rel * 1.4, 0.0, 1.0)); s.bump = 1.5;
}
void glowS(vec3 P, out Surf s) {
  // stained glass: voronoi-ish cells of gold / amber / maroon / pale between dark lead, a pointed-window mullion pattern
  vec2 uv = vUv * vec2(5.0, 9.0); vec2 id = floor(uv), f = fract(uv); float best = 9.0, second = 9.0; vec2 bc = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)); vec2 o = vec2(h13(vec3(id + g, 1.0)), h13(vec3(id + g, 2.0)));
    float d = length(g + o - f); if (d < best) { second = best; best = d; bc = id + g; } else if (d < second) second = d;
  }
  float lead = 1.0 - smoothstep(0.02, 0.07, second - best);
  float pick = h13(vec3(bc, 5.0));
  vec3 c = pick < 0.35 ? vec3(1.0, 0.72, 0.28) : pick < 0.6 ? vec3(1.0, 0.5, 0.18) : pick < 0.8 ? vec3(0.78, 0.1, 0.14) : vec3(1.0, 0.92, 0.7);
  float mull = 1.0 - smoothstep(0.0, 0.012, abs(vUv.x - 0.5));
  s.alb = vec3(0.02); s.rough = 0.5; s.metal = 0.0; s.h = 0.0; s.ao = 1.0; s.bump = 0.0;
  s.emis = mix(c * (0.9 + 0.5 * h13(vec3(bc, 9.0))), vec3(0.01), clamp(lead + mull * 0.8, 0.0, 1.0)) * uGlow;
}
void paperS(vec3 P, out Surf s) {
  float ln = 0.5 + 0.5 * sin(P.y * 520.0 + fbm(P * 20.0) * 3.0);
  s.alb = vec3(0.86, 0.79, 0.64) * (0.72 + 0.28 * ln); s.rough = 0.9; s.metal = 0.0; s.h = ln * 0.2; s.emis = vec3(0.0); s.ao = 1.0; s.bump = 0.4;
}

vec3 envFake(vec3 R, vec3 P) {
  vec3 col = mix(vec3(0.012, 0.014, 0.022), vec3(0.06, 0.075, 0.12), clamp(R.y * 0.5 + 0.5, 0.0, 1.0));
  vec3 L1 = normalize(uLightPos - P), L2 = normalize(uLight2Pos - P);
  col += uWarmCol * (pow(max(dot(R, L1), 0.0), 7.0) * 1.6 * uWarm + pow(max(dot(R, L2), 0.0), 7.0) * 1.2 * uWarm2);
  col += vec3(0.5, 0.62, 0.9) * pow(max(dot(R, normalize(vec3(-0.4, 0.8, 0.5))), 0.0), 24.0) * 0.5 * uMoon;
  return col;
}
vec3 pointL(vec3 P, vec3 N, vec3 V, vec3 alb, float rough, float metal, vec3 lp, vec3 lc, float k) {
  vec3 Lv = lp - P; float d2 = dot(Lv, Lv); vec3 L = Lv * inversesqrt(max(d2, 1e-4));
  float att = 1.0 / (1.0 + d2 * k), nl = max(dot(N, L) * 0.85 + 0.15, 0.0);
  vec3 H = normalize(L + V); float sp = pow(max(dot(N, H), 0.0), mix(180.0, 6.0, rough)) * (1.0 - rough * 0.8);
  vec3 F0 = mix(vec3(0.04), alb, metal);
  return (alb * (1.0 - metal) * nl + F0 * sp * 2.2 + F0 * metal * nl * 0.6) * lc * att;
}

void main() {
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  // ---- dissolve: a fine noisy edge that burns bright (the particle world's materialise); the copy lane: no stage there while copy is on screen
  float rim = 0.0;
  if (uDissolve < 0.995 || uCopy > 0.002) {
    float dn = fbm(vW * 2.6 + vec3(3.0, 1.0, 7.0)) * 0.8 + 0.18 * vn(vW * 13.0);
    float inLane = 1.0 - laneMask();
    float thr = uDissolve * 1.25 - 0.12;
    if (dn >= thr) discard;
    if (dn >= thr - uCopy * inLane * 1.5) discard;
    rim = smoothstep(thr - 0.05, thr, dn);
  }
  Surf s; s.emis = vec3(0.0);
  int k = int(vK + 0.5);
  vec3 P = vL;
  if (k == 0) stoneS(P, N, s);
  else if (k == 1) woodS(P, N, s);
  else if (k == 2) ironS(P, s);
  else if (k == 3) brassS(P, s);
  else if (k == 4) floorS(vW, s);
  else if (k == 5) glowS(P, s);
  else if (k == 6) clothS(P, s);
  else if (k == 7) paperS(P, s);
  else if (k == 9) carvedS(P, N, s);
  else {
    // the lit room seen through the doorway: a bright floor and far window, columns in silhouette, a falloff to the jambs
    vec2 q = vUv;
    float g = 1.0 - smoothstep(0.0, 0.85, length((q - vec2(0.5, 0.42)) * vec2(1.3, 0.8)));
    float col = 0.0;
    for (int i = 0; i < 3; i++) { float cx = 0.5 + (float(i) - 1.0) * 0.26; float w = 0.018 + 0.012 * abs(float(i) - 1.0); col = max(col, 1.0 - smoothstep(w, w * 1.8, abs(q.x - cx))); }
    float win = (1.0 - smoothstep(0.1, 0.16, abs(q.x - 0.5))) * smoothstep(0.38, 0.45, q.y) * (1.0 - smoothstep(0.78, 0.84, q.y - abs(q.x - 0.5) * 0.9));
    float floorG = smoothstep(0.38, 0.0, q.y);
    vec3 wcol = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.88, 0.62), g * g);
    vec3 e = wcol * (0.35 + 1.5 * g + 0.7 * floorG) + vec3(1.0, 0.8, 0.5) * win * 0.9;
    e *= 1.0 - col * 0.82 * smoothstep(0.1, 0.45, q.y);
    s.alb = vec3(0.0); s.rough = 1.0; s.metal = 0.0; s.h = 0.0; s.ao = 1.0; s.bump = 0.0;
    s.emis = e * (0.25 + 1.3 * uWarm);
  }
  // ---- screen-space bump (no tangents needed)
  {
    vec3 dpx = dFdx(vW), dpy = dFdy(vW); float dhx = dFdx(s.h), dhy = dFdy(s.h);
    vec3 r1 = cross(dpy, N), r2 = cross(N, dpx); float det = dot(dpx, r1);
    vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
    N = normalize(abs(det) * N - grad * s.bump * 0.2);
  }
  // ---- lighting (display-referred, hand-tuned)
  vec3 col = s.alb * uAmb * (0.55 + 0.45 * N.y) * vec3(0.6, 0.68, 0.95);
  vec3 Lm = normalize(vec3(-0.4, 0.8, 0.5));
  col += s.alb * (1.0 - s.metal) * vec3(0.28, 0.34, 0.5) * max(dot(N, Lm), 0.0) * 0.5 * uMoon;
  col += pointL(vW, N, V, s.alb, s.rough, s.metal, uLightPos, uWarmCol * uWarm * 3.4, 0.08);
  col += pointL(vW, N, V, s.alb, s.rough, s.metal, uLight2Pos, uWarmCol * uWarm2 * 3.0, 0.05);
  vec3 R = reflect(-V, N); float fr = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  col += envFake(R, vW) * (mix(vec3(0.04), s.alb, s.metal) + fr * (1.0 - s.rough) * 0.6) * (1.0 - s.rough * 0.85);
  col *= s.ao;
  col += s.emis;
  col += uEdge * rim * 2.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`

export interface MatOpts { tint?: THREE.ColorRepresentation; side?: THREE.Side }
export function stageMaterial(sh: Shared, o: MatOpts = {}): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: o.side ?? THREE.FrontSide,
    uniforms: { ...sh, uTint: { value: new THREE.Color(o.tint ?? 0x8a7d6a) } } as unknown as Record<string, THREE.IUniform>,
  })
  return m
}

// ------------------------------------------------------------------------------------------ geometry helpers
/** give a geometry a per-vertex material kind (KIND.*) */
export function tag(g: THREE.BufferGeometry, kind: number): THREE.BufferGeometry {
  const n = g.getAttribute('position').count
  g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n).fill(kind), 1))
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  if (!g.getAttribute('normal')) g.computeVertexNormals()
  return g
}
export function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const ng = list.map(g => { const x = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv', 'aKind'].includes(k)) x.deleteAttribute(k); return x })
  const out = mergeGeometries(ng, false)
  if (!out) throw new Error('merge failed')
  out.computeBoundingSphere(); out.computeBoundingBox()
  return out
}
const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), E4 = new THREE.Euler(), V3a = new THREE.Vector3(), V3b = new THREE.Vector3(1, 1, 1)
export function xf(g: THREE.BufferGeometry, p: [number, number, number], rot: [number, number, number] = [0, 0, 0], s: [number, number, number] | number = 1): THREE.BufferGeometry {
  E4.set(rot[0], rot[1], rot[2], 'YXZ'); Q4.setFromEuler(E4)
  if (typeof s === 'number') V3b.set(s, s, s); else V3b.set(s[0], s[1], s[2])
  M4.compose(V3a.set(p[0], p[1], p[2]), Q4, V3b); g.applyMatrix4(M4); return g
}
export const box = (w: number, h: number, d: number, p: [number, number, number], kind: number, rot?: [number, number, number], r = 0.02) =>
  tag(xf(r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)) : new THREE.BoxGeometry(w, h, d), p, rot), kind)
export const cyl = (rt: number, rb: number, h: number, p: [number, number, number], kind: number, seg = 14, rot?: [number, number, number]) =>
  tag(xf(new THREE.CylinderGeometry(rt, rb, h, seg, 1), p, rot), kind)
export const sph = (r: number, p: [number, number, number], kind: number, w = 10, h = 7, sc: [number, number, number] | number = 1) =>
  tag(xf(new THREE.SphereGeometry(r, w, h), p, [0, 0, 0], sc), kind)
export function lathe(profile: [number, number][], p: [number, number, number], kind: number, seg = 16): THREE.BufferGeometry {
  return tag(xf(new THREE.LatheGeometry(profile.map(a => new THREE.Vector2(a[0], a[1])), seg), p), kind)
}
export function extrude(shape: THREE.Shape, depth: number, bevel: number, kind: number, p: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], curve = 6): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: curve, steps: 1 })
  return tag(xf(g, p, rot), kind)
}

/** a two-centre pointed arch: spring line y = ys, half span hw, radius R (> hw). Returns the upper boundary, left spring -> apex -> right spring, offset radially by `off`. */
export function pointedArch(hw: number, ys: number, R: number, off = 0, n = 10): { pts: THREE.Vector2[]; apex: number } {
  const cxL = -hw + R, r = R + off, aEnd = Math.acos(-cxL / r)
  const L: THREE.Vector2[] = []
  for (let i = 0; i <= n; i++) { const a = Math.PI + (aEnd - Math.PI) * (i / n); L.push(new THREE.Vector2(cxL + r * Math.cos(a), ys + r * Math.sin(a))) }
  const Rr = L.slice(0, -1).reverse().map(p => new THREE.Vector2(-p.x, p.y))
  return { pts: [...L, ...Rr], apex: ys + Math.sqrt(r * r - cxL * cxL) }
}
/** voussoirs of one arch order: wedges between radius r0..r1, `perArc` stones per side (the last is a half keystone cut on the axis), extruded z0..z1 */
export function voussoirs(hw: number, ys: number, R: number, r0: number, r1: number, z0: number, z1: number, perArc: number, kind: number): THREE.BufferGeometry[] {
  const cxL = -hw + R, out: THREE.BufferGeometry[] = []
  const aEnd = (r: number) => Math.acos(-cxL / r)
  const aTop = aEnd((r0 + r1) / 2)
  const P = (a: number, r: number) => new THREE.Vector2(cxL + r * Math.cos(a), ys + r * Math.sin(a))
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < perArc; i++) {
      const aA = Math.PI + (aTop - Math.PI) * (i / perArc), aB = Math.PI + (aTop - Math.PI) * ((i + 1) / perArc)
      const ia = aA + (aB - aA) * 0.025, ib = aB - (aB - aA) * 0.025
      const sh = new THREE.Shape()
      const q: THREE.Vector2[] = i < perArc - 1
        ? [P(ia, r0), P(ia, r1), P(ib, r1), P(ib, r0)]
        : [P(ia, r0), P(ia, r1), new THREE.Vector2(0.006, ys + Math.sqrt(r1 * r1 - cxL * cxL)), new THREE.Vector2(0.006, ys + Math.sqrt(r0 * r0 - cxL * cxL))]
      sh.moveTo(q[0].x, q[0].y); for (let k = 1; k < 4; k++) sh.lineTo(q[k].x, q[k].y); sh.closePath()
      let g = extrude(sh, z1 - z0, 0.012, kind, [0, 0, z0])
      if (side === 1) { xf(g, [0, 0, 0], [0, 0, 0], [-1, 1, 1]); flipWinding(g) }
      out.push(g)
    }
  }
  return out
}
/** a mirror (negative scale) reverses winding: flip it back so back-face culling stays right */
export function flipWinding(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), uv = g.getAttribute('uv'), kd = g.getAttribute('aKind')
  if (g.index) { const ix = g.index; for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i + 1), b = ix.getX(i + 2); ix.setX(i + 1, b); ix.setX(i + 2, a) } ix.needsUpdate = true; return }
  const swap = (at: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined) => {
    if (!at) return
    const n = at.itemSize
    for (let i = 0; i < at.count; i += 3) for (let c = 0; c < n; c++) { const a = at.getComponent(i + 1, c), b = at.getComponent(i + 2, c); at.setComponent(i + 1, c, b); at.setComponent(i + 2, c, a) }
  }
  swap(pos); swap(nor); swap(uv); swap(kd)
}

/** soft round/linear alpha gradient as a texture (shadows and light spills are painted, not computed) */
export function gradTexture(kind: 'radial' | 'linearY' | 'beam' = 'radial', size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d')!
  if (kind === 'radial') {
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, size, size)
  } else if (kind === 'linearY') {
    const gr = g.createLinearGradient(0, 0, 0, size)
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, size, size)
  } else {
    const gr = g.createLinearGradient(0, 0, size, 0)
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, size, size)
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true
  return t
}

// ------------------------------------------------------------------------------------------ lens shift (layout.ts `reframe`, applied or undone)
/** layout.ts reframe(): pos and target are panned sideways so the subject sits at NDC frame[0] (landscape only). sign +1 applies it, -1 removes it. */
export function lensShift(pos: [number, number, number], tgt: [number, number, number], fov: number, frame: [number, number] | undefined, sign: 1 | -1, aspect = innerWidth / Math.max(1, innerHeight)): { pos: [number, number, number]; tgt: [number, number, number] } {
  const k = Math.min(1, Math.max(0, (aspect - 1.05) / 0.5))
  if (!frame || k <= 0) return { pos: [...pos], tgt: [...tgt] }
  const dx = tgt[0] - pos[0], dy = tgt[1] - pos[1], dz = tgt[2] - pos[2]
  const D = Math.hypot(dx, dy, dz) || 1, rl = Math.hypot(dx, dz) || 1, rx = -dz / rl, rz = dx / rl
  const halfH = D * Math.tan((fov * Math.PI) / 360), halfW = halfH * aspect
  const sx = -frame[0] * k * halfW * sign, sy = -(frame[1] ?? 0) * k * halfH * sign
  return { pos: [pos[0] + rx * sx, pos[1] + sy, pos[2] + rz * sx], tgt: [tgt[0] + rx * sx, tgt[1] + sy, tgt[2] + rz * sx] }
}

let VARIANT_RT: THREE.WebGLRenderTarget | null = null
/**
 * Compile the programs of hidden objects off the main path (KHR_parallel_shader_compile; hidden meshes are included, so no visibility juggling).
 * A program is keyed by the output colour space, which differs between the canvas and a render target, so it is compiled for BOTH: the mirror
 * floor's reflection pass and the portal's render target draw these meshes into a render target, and without the second variant the first
 * frame that shows the floor would stall on twelve fresh compiles.
 */
export function precompile(env: Env, ...objs: THREE.Object3D[]) {
  const r = env.renderer
  try {
    VARIANT_RT ??= new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true })
    for (const o of objs) {
      void r.compileAsync(o, env.camera, env.scene).catch(() => {})
      const prev = r.getRenderTarget()
      r.setRenderTarget(VARIANT_RT)
      try { void r.compileAsync(o, env.camera, env.scene).catch(() => {}) } finally { r.setRenderTarget(prev) }
    }
  } catch { /* ignore */ }
}
