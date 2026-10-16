// Background equations and numbers: type that populates the dark behind each area's subject.
//
// Each waypoint owns a GROUP of lines (generic maths, or numbers that exist in src/data). A group lives on a slow carousel behind the
// subject (a disc perpendicular to the area's outward axis, 5-18 units behind it, radius 7-16 so the middle stays clear). As the camera
// approaches, the group ASSEMBLES: lines fly in from scattered positions and either type themselves cell by cell, decode out of
// scrambled digits, or fade up. When the flight leaves (the morph starts) the group SCATTERS outward and dissolves, fast.
// Legibility rules: alpha <= 0.35, crisp mipmapped atlas text (lib/atlas.ts), depth-faded, and every fragment inside the waypoint's
// copy lane (the side opposite the subject, see layout.ts `frame`) is masked out, so the type never sits behind the copy.
// Honours ?extras=0 and ?extras=-glyphs. Hidden from the mirror pass (userData.noReflect).
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import { AREAS, WAYPOINTS } from '../layout'
import { atmos, clamp01, extraOn, isOn, isPhone, lerp, reducedMotion, rng, sstep, timed } from './lib/flags'
import { buildAtlas, loadFonts, type FontKind, type LineSpec, type Slot } from './lib/atlas'
import { Lane } from './lib/lane'
import { HOLES, HOLES_GLSL } from '../occlusion'
import { U as SIGU } from '../signals'

type Mode = 'fade' | 'type' | 'decode'
interface Item { t: string; kind?: FontKind; mode?: Mode; em?: number; copies?: number; bright?: number }
/** `hold`: brightness while its waypoint is held (default 1); a stop whose subject is a dense object keeps its type quieter behind it */
interface GroupDef { id: string; area: string; wps: string[]; preview?: boolean; hold?: number; items: Item[] }

// ---------------------------------------------------------------------------------------------- content
/** Zetamac-style problems with the answers: every one correct by construction */
function arithmetic(n: number, seed: number): string[] {
  const r = rng(seed), out = ['37 × 4 = 148', '126 − 58 = 68', '84 ÷ 7 = 12']
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1))
  while (out.length < n) {
    const k = ri(0, 3)
    if (k === 0) { const a = ri(2, 99), b = ri(2, 99); out.push(`${a} + ${b} = ${a + b}`) }
    else if (k === 1) { const a = ri(2, 99), b = ri(2, 99); out.push(`${a + b} − ${a} = ${b}`) }
    else if (k === 2) { const a = ri(2, 12), b = ri(2, 99); out.push(`${a} × ${b} = ${a * b}`) }
    else { const a = ri(2, 12), b = ri(2, 99); out.push(`${a * b} ÷ ${a} = ${b}`) }
  }
  return out
}
const M = (t: string, mode: Mode = 'type', em = 0.62, o: Partial<Item> = {}): Item => ({ t, kind: 'mono', mode, em, ...o })
const S = (t: string, em = 1.0, mode: Mode = 'type', o: Partial<Item> = {}): Item => ({ t, kind: 'serif', mode, em, ...o })
const BIG = (t: string, em = 1.9): Item => ({ t, kind: 'mono', mode: 'decode', em, bright: 0.62 })

const GROUPS: GroupDef[] = [
  { id: 'mind', area: 'mind', wps: ['mind'], preview: true, items: [
    M('478 notes · 1,887 links', 'type', 0.78),
    ...['00', '10', '20', '30', '40', '50', '60', '70', '90'].map(t => BIG(t, 1.7)),
    M('[[wikilink]]', 'type', 0.7, { copies: 2 }), M('[[wikilink|alias]]', 'type', 0.62), M('![[embed]]', 'decode', 0.62), M('#tag/subtag', 'type', 0.62),
    M('- [ ] follow-up', 'type', 0.6), M('---', 'type', 0.7), M('tags: [ ]', 'type', 0.6), M('title: …', 'type', 0.6),
  ] },
  { id: 'alarm', area: 'systems', wps: ['alarm'], preview: true, items: [
    M('66,636 lines of Swift', 'type', 0.78),
    S('θ(t) = 2π·t / T', 1.05), S('f(t) = sin(2πt / T)', 1.0), S('Σ repᵢ = n', 1.0), S('Δt = t₁ − t₀', 0.95), S('ω = 2π / T', 0.95),
    BIG('06', 1.9), M('00 : 00', 'decode', 0.9, { bright: 0.7 }), M('n = n + 1', 'type', 0.66), M('while (t < T)', 'type', 0.62),
  ] },
  { id: 'drill', area: 'systems', wps: ['drill'], items: [
    ...arithmetic(15, 7).map((t, i) => M(t, i % 4 === 3 ? 'type' : 'decode', 0.64)),
    M('120 s', 'decode', 1.1, { bright: 0.7 }),
  ] },
  { id: 'table', area: 'systems', wps: ['table'], items: [
    S('pot odds = call ÷ (pot + call)', 1.0), S('A♠K♠ vs Q♥Q♦', 1.25), S('EV = p·win − (1 − p)·call', 1.0), S('equity ≈ outs × 4', 0.95), S('call ÷ (pot + call)', 1.0),
    M('2.0 ms median per decision', 'type', 0.66), M('960 replayed practice spots', 'type', 0.66), BIG('960', 1.5), M('A♠ K♠', 'type', 0.8), M('Q♥ Q♦', 'type', 0.8),
  ] },
  { id: 'market', area: 'research', wps: ['market'], preview: true, items: [
    S('dx/dt = a·x + b·y', 1.25), S('dy/dt = c·x + d·y', 1.25), S('λ² − tr(A)λ + det(A) = 0', 1.0), S('A = [ a  b ; c  d ]', 1.05), S('ẋ = Ax', 1.1),
    M('dx/dt', 'type', 0.7), M('dy/dt', 'type', 0.7), M('t → ∞', 'type', 0.7),
  ] },
  { id: 'record', area: 'research', wps: ['record'], items: [
    ...['1940', '1941', '1942', '1943', '1944', '1945'].map(t => BIG(t, 1.9)),
    S('y = β₀ + β₁x + ε', 1.2), M('3,073 counties', 'type', 0.78), S('ŷ = β̂₀ + β̂₁x', 1.0), M('1940 – 1945', 'decode', 0.9),
  ] },
  { id: 'pair', area: 'research', wps: ['pair'], items: [
    S('y = β₀ + β₁x + ε', 1.2), S('Y = β₀ + β₁T + ε', 1.15), S('H₀ : β₁ = 0', 1.1), M('browse together', 'type', 0.72), M('search apart', 'type', 0.72),
    M('T = 1', 'decode', 0.9), M('T = 0', 'decode', 0.9), M('2 conditions', 'type', 0.72), S('E[Y | T = 1] − E[Y | T = 0]', 1.0),
  ] },
  { id: 'surface', area: 'work', wps: ['surface'], preview: true, hold: 0.42, items: [
    S('C = S·N(d₁) − K·e^(−rT)·N(d₂)', 1.2), S('d₁ = [ln(S/K) + (r + σ²/2)T] / σ√T', 1.0), S('d₂ = d₁ − σ√T', 1.05),
    S('w(k,θ) = θ/2 (1 + ρφk + √((φk+ρ)² + 1 − ρ²))', 0.95), S('Δ = ∂C/∂S', 1.3), S('Γ = ∂²C/∂S²', 1.1), S('L(L−1)', 1.2),
    BIG('NET', 1.7), BIG('APPF', 1.7), M('GET /  200 OK', 'type', 0.7, { copies: 2 }), M('ν = ∂C/∂σ', 'type', 0.7),
  ] },
  // the school stop keeps to the university's own words (the Latin motto and the name); the equations moved to the chalkboard stop below
  { id: 'school', area: 'education', wps: ['school'], preview: true, items: [
    { t: 'CRESCAT SCIENTIA', kind: 'roman', mode: 'fade', em: 1.5 }, { t: 'VITA EXCOLATUR', kind: 'roman', mode: 'fade', em: 1.2 },
    { t: 'CRESCAT SCIENTIA', kind: 'roman', mode: 'fade', em: 0.9 }, { t: 'VITA EXCOLATUR', kind: 'roman', mode: 'fade', em: 0.8 },
    M('UNIVERSITY OF CHICAGO', 'type', 0.7), M('ECONOMICS', 'decode', 0.8, { bright: 0.7 }), M('COMPUTATIONAL AND APPLIED MATHEMATICS', 'type', 0.58),
  ] },
  { id: 'mathecon', area: 'education', wps: ['mathecon'], items: [
    S('Qd = Qs', 1.5), S('ℒ = u(x) − λ(p·x − m)', 1.15), S('∇f(x) = 0', 1.45), S('MU₁ / p₁ = MU₂ / p₂', 1.0), M('Qd = Qs', 'decode', 0.8),
    S('MC = MR', 1.1), M('p·x ≤ m', 'type', 0.7),
  ] },
  { id: 'instrument', area: 'education', wps: ['instrument'], items: [
    S('In nova fert animus', 1.5, 'type'), S('e^(iπ) + 1 = 0', 1.45), S('Ax = λx', 1.5), S('f̂(ξ) = ∫ f(x) e^(−2πixξ) dx', 1.05), S('det(A − λI) = 0', 1.1),
    S('In nova fert animus', 0.95, 'fade'), M('e^(iπ) = −1', 'type', 0.7),
  ] },
  { id: 'chess', area: 'about', wps: ['hold', 'meeple', 'knight'], preview: true, items: [
    M('1. e4 e5 2. Nf3 Nc6', 'type', 0.92), M('3. Bb5 a6 4. Ba4 Nf6', 'type', 0.78), M('5. O-O Be7', 'type', 0.78), BIG('V8', 2.1), M('1. e4 e5 2. Nf3 Nc6', 'type', 0.66), M('Nf3', 'decode', 1.1, { bright: 0.7 }), M('e4', 'decode', 1.1, { bright: 0.7 }), M('V8', 'decode', 1.0),
  ] },
  { id: 'vinyl', area: 'about', wps: ['records'], items: [
    M('33⅓ rpm', 'type', 1.0, { copies: 2 }), BIG('33', 2.0), M('33⅓ rpm', 'type', 0.7), M('LP', 'decode', 1.2, { bright: 0.7 }),
  ] },
  { id: 'hall', area: 'about', wps: ['hall'], items: [
    { t: 'CRESCAT SCIENTIA', kind: 'roman', mode: 'fade', em: 1.5 }, { t: 'VITA EXCOLATUR', kind: 'roman', mode: 'fade', em: 1.2 },
    S('∫ e^(−x²) dx = √π / 2', 1.1), S('Σ 1/n² = π² / 6', 1.2), S('df/dx = lim (f(x + h) − f(x)) / h', 1.0),
    M('lim (1 + 1/n)^n = e', 'type', 0.7), M('∫ x dx = x² / 2', 'decode', 0.9),
  ] },
]

const ASSEMBLE_S = 2.1, SCATTER_S = 0.65, PREVIEW = 0.58
const STRIP = '0123456789+−×÷=%'

// ---------------------------------------------------------------------------------------------- shaders
const VERT = /* glsl */ `
uniform float uTime;
uniform vec3 uGrp[16];
uniform vec4 uSgHead;   // v19 signal bus: w = how fast the flight is (0..0.36): the equations stretch with it
attribute vec4 aA, aB, aC, aD, aU, aS, aE;
attribute vec3 aK;
varying vec2 vQ; varying vec4 vU, vD; varying vec3 vCol; varying float vR, vAlpha, vSeed, vGhost;
void main() {
  vec3 gp = uGrp[int(aC.w + 0.5)];
  float r = clamp(gp.x * 1.6 - aC.z, 0.0, 1.0);
  if (r <= 0.001 || gp.y <= 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float e = r * r * (3.0 - 2.0 * r);
  float ang = aA.w;
  vec3 outw = vec3(sin(ang), 0.0, cos(ang)), side = vec3(cos(ang), 0.0, -sin(ang));
  float th = aB.z + uTime * aB.w;
  float gk = gp.z;                                  // 1 = the full carousel, less = a tight cluster at the area (the world preview)
  vec3 home = aA.xyz + (side * (aB.x * cos(th)) + vec3(0.0, aB.x * sin(th) * 0.5 + aE.x, 0.0)) * gk - outw * aB.y * gk;
  float sc = 1.0 - e; sc = sc * sc * sc;
  vec3 c = home + aS.xyz * aS.w * sc;
  vec3 toCam = cameraPosition - c;
  float dist = length(toCam);
  vec3 f = normalize(vec3(toCam.x, 0.0, toCam.z) + vec3(1e-5, 0.0, 1e-5));
  float sk = aD.z + (1.0 - e) * 1.9 * sign(aD.z + 1e-4);
  f = vec3(f.x * cos(sk) - f.z * sin(sk), 0.0, f.x * sin(sk) + f.z * cos(sk));
  vec3 right = vec3(f.z, 0.0, -f.x), up = vec3(0.0, 1.0, 0.0);
  float cr = cos(aD.w), sr = sin(aD.w);
  vec3 R = right * cr + up * sr, U = -right * sr + up * cr;
  float h = aC.x * (0.35 + 0.65 * e) * clamp(dist / 30.0, 1.0, 2.5);
  float w = h * aC.y * (1.0 + 1.5 * uSgHead.w);
  vec3 wp = c + R * position.x * w + U * position.y * h;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  vQ = position.xy + 0.5; vU = aU; vD = aD; vCol = aK; vR = r; vSeed = aE.y; vGhost = aE.z;
  vAlpha = gp.y * aE.w * smoothstep(1.5, 7.0, dist) * (1.0 - smoothstep(70.0, 120.0, dist)) * (1.0 - 0.7 * uSgHead.w);   // stretched type spends its light over more area
}`
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tAtlas; uniform vec4 uStrip, uLane; uniform vec2 uRes, uCss; uniform float uTime, uAmax;
uniform vec4 uSgShim, uSgMus;   // v19 signal bus: shooting-star shimmer (xy ndc, z radius, w amount), music (y = mids)
${HOLES_GLSL}
varying vec2 vQ; varying vec4 vU, vD; varying vec3 vCol; varying float vR, vAlpha, vSeed, vGhost;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float x = vQ.x, n = vD.y, mode = vD.x;
  vec2 uvL = vec2(mix(vU.x, vU.z, x), mix(vU.w, vU.y, vQ.y));
  vec2 dx = dFdx(uvL), dy = dFdy(uvL);
  float cov = textureGrad(tAtlas, uvL, dx, dy).r;
  float vis = 1.0;
  if (mode < 0.5) {
    vis = smoothstep(0.0, 0.55, vR);
  } else if (mode < 1.5) {                       // typed cell by cell, caret block on the cell being typed
    float ci = floor(x * n), head = vR * 1.15 * n;
    vis = step(ci + 0.5, head);
    float cur = step(abs(ci - floor(head)), 0.5) * step(vR, 0.985) * step(0.02, vR);
    float fx = fract(x * n);
    float block = step(0.14, fx) * step(fx, 0.72) * step(0.12, vQ.y) * step(vQ.y, 0.88);
    cov = max(cov * vis, cur * block * 0.85); vis = 1.0;
  } else {                                       // decode: each cell churns through digits, then settles on the real glyph
    float ci = floor(x * n), fx = fract(x * n);
    float ct = (ci / n) * 0.45 + hash(vec2(ci, vSeed)) * 0.42;
    float s0 = ct * 0.5, s1 = s0 + 0.3;
    if (vR < s0) vis = 0.0;
    else if (vR < s1) {
      float j = floor(hash(vec2(ci + vSeed * 7.0, floor(uTime * 15.0 + ci * 1.7))) * 16.0);
      float cu = (vU.z - vU.x) / n;
      vec2 uvS = vec2(uStrip.x + (j + fx) * cu, mix(uStrip.w, uStrip.y, vQ.y));
      cov = textureGrad(tAtlas, uvS, dx, dy).r;
    }
  }
  // the copy lane (opposite the subject) stays clean: x runs toward the free side of the screen
  vec2 nd = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  float lane = 1.0;
  if (uLane.w > 0.5) lane = smoothstep(-0.34, -0.04, nd.y) * (1.0 - smoothstep(0.5, 0.76, nd.y));
  else if (abs(uLane.x) > 0.001) { float u = nd.x * -sign(uLane.x); lane = mix(1.0, smoothstep(uLane.y, uLane.y + uLane.z, u), abs(uLane.x)); }
  // the copy-side third of the screen holds the title / lede / list: type there is held at 0.15 (the lane above is normally 0 already)
  if (uLane.w < 0.5 && abs(uLane.x) > 0.001) { float u3 = nd.x * -sign(uLane.x); lane *= mix(1.0, mix(0.15, 1.0, smoothstep(-0.36, -0.30, u3)), abs(uLane.x)); }
  // v11: never inside the subject's bounds or a copy box
  lane *= holeMask(gl_FragCoord.xy / uRes);
  // the HUD row along the top (wordmark, nav, toggles): type there stays a whisper
  vec2 cp = gl_FragCoord.xy / uRes * uCss; float py = uCss.y - cp.y;
  lane *= mix(0.2, 1.0, smoothstep(48.0, 82.0, py));
  // the ghost markup ([[wikilink|alias]], ![[embed]]) stays out of the top-left wordmark box (0..300 x 0..70 px) and out of both title columns
  if (vGhost > 0.5) {
    float band = smoothstep(96.0, 120.0, py) * (1.0 - smoothstep(380.0, 410.0, py));
    lane *= 1.0 - (1.0 - smoothstep(300.0, 340.0, cp.x)) * (1.0 - smoothstep(70.0, 100.0, py));
    lane *= 1.0 - (1.0 - smoothstep(480.0, 520.0, cp.x)) * band;
    lane *= 1.0 - smoothstep(uCss.x - 520.0, uCss.x - 480.0, cp.x) * band;
  }
  float a = min(0.35, cov * vis * vAlpha * lane * uAmax * (1.0 + 0.35 * uSgMus.y));   // the mids breathe the type
  // a shooting star passing over the type makes it shimmer: brighter, whiter, a fast flicker per glyph
  vec3 col = vCol;
  if (uSgShim.w > 0.002) {
    vec2 dd = (nd - uSgShim.xy) * vec2(uRes.x / uRes.y, 1.0);
    float sk = uSgShim.w * exp(-dot(dd, dd) / (uSgShim.z * uSgShim.z)) * (0.65 + 0.35 * sin(uTime * 9.0 + vSeed * 40.0 + x * 12.0));
    a = min(0.55, a * (1.0 + 2.6 * sk) + cov * lane * vAlpha * 0.35 * sk); col = mix(col, vec3(1.0, 0.97, 0.9), 0.65 * sk);
  }
  if (a < 0.002) discard;
  gl_FragColor = vec4(col, a);
}`

// ---------------------------------------------------------------------------------------------- install
export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('glyphs') || !ctx.field?.scene) return
  const phone = isPhone()
  const scene: THREE.Scene = ctx.field.scene
  const renderer: THREE.WebGLRenderer = ctx.field.renderer
  const accentOf = (id: string) => new THREE.Color(AREAS.find(a => a.id === id)?.accent ?? '#EDE6D6')
  const grpR = new Float32Array(GROUPS.length), grpTarget = new Float32Array(GROUPS.length)
  const grpUni = Array.from({ length: 16 }, () => new THREE.Vector3(0, 0, 1))
  const lane = new Lane(), laneU = lane.u
  const uni = {
    uTime: { value: 0 }, uGrp: { value: grpUni }, tAtlas: { value: null as THREE.Texture | null }, uStrip: { value: new THREE.Vector4() },
    uLane: { value: laneU }, uRes: { value: new THREE.Vector2(1440, 900) }, uCss: { value: new THREE.Vector2(1440, 900) }, uAmax: { value: 0.3 }, uHole: HOLES, uSgHead: SIGU.uSgHead, uSgShim: SIGU.uSgShim, uSgMus: SIGU.uSgMus,
  }
  let mesh: THREE.Mesh | null = null, ready = false
  let phase = 0, drag = 0, lastDwell = -1
  const dbg = { get laneOff() { return lane.off }, set laneOff(v: boolean) { lane.off = v }, uni, grpR }
  ;(atmos as unknown as Record<string, unknown>).glyphs = dbg
  const v2 = new THREE.Vector2()

  ctx.on((name, data) => {
    if (name === 'pov:drag') drag = Math.max(drag, Math.min(1, data?.speed ?? 0.6))
    else if (name === 'pov:grab') drag = Math.max(drag, 0.3)
  })

  const build = async () => {
    await loadFonts()
    // ---- gather the lines
    const specs: LineSpec[] = [{ key: 'mono|__strip', text: STRIP, kind: 'mono', px: 48 }]
    const keyOf = (it: Item) => `${it.kind ?? 'mono'}|${it.t}`
    for (const g of GROUPS) for (const it of g.items) specs.push({ key: keyOf(it), text: it.t, kind: it.kind ?? 'mono', px: (it.kind ?? 'mono') === 'mono' ? 48 : 64 })
    const maxT = Math.min(4096, renderer.capabilities.maxTextureSize || 4096)
    const { tex, slots } = buildAtlas(maxT, maxT >= 4096 ? 2048 : 1024, specs, Math.min(8, renderer.capabilities.getMaxAnisotropy()))
    const strip = slots.get('mono|__strip') as Slot
    uni.tAtlas.value = tex; uni.uStrip.value.set(strip.u0, strip.v0, strip.u1, strip.v1)

    // ---- instances
    interface Inst { a: number[]; b: number[]; c: number[]; d: number[]; u: number[]; s: number[]; e: number[]; k: number[] }
    const I: Inst = { a: [], b: [], c: [], d: [], u: [], s: [], e: [], k: [] }
    const MODE = { fade: 0, type: 1, decode: 2 }
    GROUPS.forEach((g, gi) => {
      const area = AREAS.find(a => a.id === g.area)!
      const col = accentOf(g.area).lerp(new THREE.Color('#EDE6D6'), 0.55)
      const list: Item[] = []
      for (const it of g.items) for (let c = 0; c < (it.copies ?? 1); c++) list.push(it)
      // a thin group repeats its smaller lines (a new place each time) so every area has a populated background
      const small = g.items.filter(it => (it.em ?? 0.7) <= 1.4)
      for (let k = 0; list.length < 15 && small.length; k++) list.push({ ...small[k % small.length], em: (small[k % small.length].em ?? 0.7) * (0.8 + 0.1 * ((k * 7) % 4)) })
      const use = phone ? list.slice(0, Math.max(6, Math.ceil(list.length * 0.55))) : list
      const r = rng(0x9e3779b1 ^ (gi * 7919))
      const N = use.length, off = r() * 6.28
      // the copy lane is on the side opposite the subject: keep the carousel's lateral extent on the free side so most of it survives the lane mask
      const w0 = WAYPOINTS.find(x => x.id === g.wps[0]), fx = w0?.frame?.[0] ?? 0, gs = Math.abs(fx) > 0.05 ? (fx > 0 ? -1 : 1) : 0
      const latOk = (x: number) => gs === 0 || (gs * x < 7.5 && gs * x > -9)
      const gdir = gi % 2 ? 1 : -1
      const placed: { x: number; y: number; w: number; h: number }[] = []
      // biggest first so the small lines fit around them
      const order = use.map((it, i) => i).sort((a, b) => (use[b].em ?? 0.7) - (use[a].em ?? 0.7))
      order.forEach((i, rank) => {
        const it = use[i]
        const slot = slots.get(keyOf(it)); if (!slot) return
        const big = (it.em ?? 0.7) > 1.4
        const h = (it.em ?? 0.7) * 1.5, w = h * (slot.w / slot.h)
        let best: { th: number; rho: number; depth: number; y0: number; pen: number } | null = null
        for (let k = 0; k < 40 && !(best && best.pen === 0); k++) {
          const rho = lerp(6.2, 14.5, r()), depth = lerp(6, 18, r()), y0 = (r() * 2 - 1) * 1.4
          let th = off + (rank * 2.39996 + k * 0.97) + r() * 0.5, t = 0
          while (!latOk(rho * Math.cos(th)) && t++ < 16) th += 0.55 + r() * 0.5
          if (!latOk(rho * Math.cos(th))) continue
          const D = 14 + depth, bx = (rho * Math.cos(th)) / D, by = (rho * Math.sin(th) * 0.5 + y0) / D, bw = (w * Math.max(1, (D + 8) / 30)) / D, bh = (h * Math.max(1, (D + 8) / 30)) / D
          let pen = 0
          for (const p of placed) { const ox = Math.max(0, (bw + p.w) * 0.54 - Math.abs(bx - p.x)), oy = Math.max(0, (bh + p.h) * 0.58 - Math.abs(by - p.y)); pen += ox * oy * 1e4 }
          if (!best || pen < best.pen) best = { th, rho, depth, y0, pen }
        }
        if (!best) best = { th: off + rank, rho: 8, depth: 10, y0: 0, pen: 0 }
        const D = 14 + best.depth
        placed.push({ x: (best.rho * Math.cos(best.th)) / D, y: (best.rho * Math.sin(best.th) * 0.5 + best.y0) / D, w: (w * Math.max(1, (D + 8) / 30)) / D, h: (h * Math.max(1, (D + 8) / 30)) / D })
        const omega = gdir * (0.034 + 0.03 * ((best.depth - 6) / 12)) * (0.9 + 0.2 * r())
        const dir = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize()
        const mode = MODE[it.mode ?? 'type']
        I.a.push(area.center[0], area.center[1], area.center[2], (area.angle * Math.PI) / 180)
        I.b.push(best.rho, best.depth, best.th, omega)
        I.c.push(h, slot.w / slot.h, (rank / Math.max(1, N)) * 0.45 + r() * 0.15, gi)
        I.d.push(mode, slot.n, (r() * 2 - 1) * 0.42, (r() * 2 - 1) * 0.07)
        I.u.push(slot.u0, slot.v0, slot.u1, slot.v1)
        I.s.push(dir.x, dir.y, dir.z, 5 + r() * 6)
        I.e.push(best.y0, r() * 100, /^!?\[\[/.test(it.t) ? 1 : 0, (it.bright ?? 1) * (big ? 0.72 : 0.7 + 0.3 * r()))
        I.k.push(col.r, col.g, col.b)
      })
    })
    const count = I.c.length / 4
    const base = new THREE.PlaneGeometry(1, 1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index; geo.setAttribute('position', base.getAttribute('position')); geo.setAttribute('uv', base.getAttribute('uv'))
    const put = (name: string, arr: number[], sz: number) => geo.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(arr), sz))
    put('aA', I.a, 4); put('aB', I.b, 4); put('aC', I.c, 4); put('aD', I.d, 4); put('aU', I.u, 4); put('aS', I.s, 4); put('aE', I.e, 4); put('aK', I.k, 3)
    geo.instanceCount = count
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: uni, transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending })
    mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = 'atmos-glyphs'; mesh.userData.noReflect = true
    ctx.field.addObject(mesh)
    ready = true
  }
  build().catch(e => console.warn('[glyphs] build failed', e))

  const step = (_t: number, dt: number, st: Parameters<NonNullable<Extra['update']>>[2]) => {
    {
      if (!ready || !mesh) return
      const rm = reducedMotion()
      // ---- which group is wanted: the waypoint we stand at, or (in the second half of a leg) the one we are flying into
      const wi = st.dwelling ? st.wp : st.t >= 0.5 ? st.next : -1
      const cur = wi >= 0 ? WAYPOINTS[wi].id : null
      for (let g = 0; g < GROUPS.length; g++) {
        const G = GROUPS[g]
        grpTarget[g] = cur && G.wps.includes(cur) ? 1 : cur === 'world' && G.preview ? PREVIEW : 0
      }
      // ---- arrival: the group of the waypoint we have just reached assembles, and the sound engine is told
      if (st.dwelling) {
        if (lastDwell !== st.wp) {
          lastDwell = st.wp
          const id = WAYPOINTS[st.wp].id
          const G = GROUPS.find(x => x.wps.includes(id))
          if (G) ctx.emit('glyph:burst', { area: G.area })
        }
      } else lastDwell = -1
      for (let g = 0; g < GROUPS.length; g++) {
        const r = grpR[g], goal = grpTarget[g]
        grpR[g] = rm ? r + Math.sign(goal - r) * Math.min(Math.abs(goal - r), dt / 0.3)
          : goal > r ? Math.min(goal, r + dt / ASSEMBLE_S) : Math.max(goal, r - dt / SCATTER_S)
        const f = GROUPS[g].preview ? sstep(PREVIEW + 0.02, 1, grpR[g]) : 1   // a preview group (the world shot) is a small dim cluster until its waypoint arrives
        grpUni[g].set(grpR[g], grpR[g] > 0.001 ? lerp(0.55, 1, f) * lerp(1, GROUPS[g].hold ?? 1, f) : 0, lerp(0.5, 1, f))
      }
      // ---- the orbit clock speeds up with scroll speed and POV drags
      drag *= Math.exp(-dt / 0.6)
      phase += dt * (rm ? 0 : 1 + 4 * st.speed + 7 * drag)
      uni.uTime.value = phase
      // ---- lane
      lane.update(st, dt)
      renderer.getDrawingBufferSize(v2); uni.uRes.value.copy(v2); uni.uCss.value.set(innerWidth, innerHeight)
    }
  }
  const timedStep = timed('glyphs', step)
  return { update(t, dt, st) { if (!isOn('glyphs')) { if (mesh) mesh.visible = false; return } if (mesh) mesh.visible = true; timedStep(t, dt, st) } }
}
void clamp01; void sstep
