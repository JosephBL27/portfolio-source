// FORM "zeta" (chapter V, The Drill). A giant seven-segment "80" (the best strict score) glowing like a phosphor
// display, ringed by a 120-tick countdown dial whose sweep hand eats the seconds, over a field of small flickering
// arithmetic problems (set in IBM Plex Mono, sampled from one text mask) of which one "active" problem is solved
// at a time. color_zeta adds scanline banding, a travelling bright band and a phosphor shimmer.
import '@fontsource/ibm-plex-mono/500.css'
import type { FormDef } from './types'
import { H } from './ctx'

// ---- seven segment geometry (digit-local, y up) ------------------------------------------------
const HW = 0.68, HHt = 1.25, T = 0.135, C = 0.02, GAP = 0.03, GX = 1.5 // half width/height, half bar thickness, tip inset, diagonal gap, digit offset
type P2 = [number, number]
const hexH = (yc: number, cx: number): P2[] => [[cx - HW + C, yc], [cx - HW + C + T, yc + T], [cx + HW - C - T, yc + T], [cx + HW - C, yc], [cx + HW - C - T, yc - T], [cx - HW + C + T, yc - T]]
const hexV = (xc: number, y0: number, y1: number): P2[] => [[xc, y1], [xc + T, y1 - T], [xc + T, y0 + T], [xc, y0], [xc - T, y0 + T], [xc - T, y1 - T]]
const Y1 = HHt - 2 * T + C - GAP * Math.SQRT2, Y0 = T - C + GAP * Math.SQRT2
// segments: a top, b upper right, c lower right, d bottom, e lower left, f upper left, g middle
const segs = (cx: number): P2[][] => [
  hexH(HHt - T, cx), hexV(cx + HW - T, Y0, Y1), hexV(cx + HW - T, -Y1, -Y0), hexH(-(HHt - T), cx),
  hexV(cx - HW + T, -Y1, -Y0), hexV(cx - HW + T, Y0, Y1), hexH(0, cx),
]
const LIT = [[0, 1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5]] // digit 8, digit 0
const DIGIT_X = [-GX * 0.56, GX * 0.56]

// ---- the problem field (a monospace text grid) ---------------------------------------------------
const COLS = 11, ROWS = 13, CELLCH = 10, ADV = 0.6, FONT_PX = 36, PXW = 0.005
const ROW_PX = 100, CANVAS_W = 2400, CANVAS_H = ROWS * ROW_PX
const FX0 = -7.4, FY0 = (CANVAS_H * PXW) / 2
const cellId: number[][] = []
let NC = 0
for (let r = 0; r < ROWS; r++) {
  cellId.push([])
  for (let c = 0; c < COLS; c++) {
    const xs = FX0 + (c * CELLCH + (r % 2 ? 5 : 0)) * ADV * FONT_PX * PXW, xc = xs + 0.42, y = FY0 - ROW_PX * PXW * (r + 0.5)
    const ex = xc / 3.45, ey = y / 3.0
    const ok = ex * ex + ey * ey > 1 && xc < 4.5
    cellId[r].push(ok ? NC++ : -1)
  }
}
let STEP = 29; while (NC % STEP === 0) STEP += 2
const problems = (() => {
  let s = 0x2f6e2b1; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
  const pick = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  return () => {
    const k = rnd()
    if (k < 0.34) return `${pick(12, 99)} × ${pick(3, 12)}`
    if (k < 0.62) return `${pick(11, 99)} + ${pick(11, 99)}`
    if (k < 0.82) return `${pick(30, 140)} - ${pick(11, 29)}`
    const b = pick(3, 12); return `${b * pick(4, 14)} ÷ ${b}`
  }
})()

// ---- dial -----------------------------------------------------------------------------------------
const RR = 2.3, NT = 120

const polyArea = (p: P2[]) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1] } return Math.abs(a) / 2 }
const distSeg = (x: number, y: number, a: P2, b: P2) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t)
}
const inPoly = (x: number, y: number, p: P2[]) => {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])
    if (cr !== 0) { if (s !== 0 && Math.sign(cr) !== s) return false; s = Math.sign(cr) }
  }
  return true
}

const form: FormDef = {
  id: 'zeta',
  async build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    let k = 0
    const W = (kind: number, id: number) => kind + 16 * id
    const put = (x: number, y: number, z: number, w: number, r: number, g: number, b: number, a: number) => { if (k < N) H.set(pos, col, k++, x, y, z, w, r, g, b, a) }
    const amber = H.hex('#F2B441'), hot = [1, 0.95, 0.8]
    const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

    // ---- the lit digits (kind 0) and their unlit ghosts (kind 1) ---------------------------------------
    const sampleSeg = (poly: P2[], n: number, kind: number, id: number, alpha: number) => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
      for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
      for (let i = 0; i < n; i++) {
        let x = 0, y = 0
        do { x = x0 + (x1 - x0) * rand(); y = y0 + (y1 - y0) * rand() } while (!inPoly(x, y, poly))
        let de = 1e9; for (let e = 0; e < poly.length; e++) de = Math.min(de, distSeg(x, y, poly[e], poly[(e + 1) % poly.length]))
        const prof = Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, de / 0.08), 2)))
        const z = (rand() * 2 - 1) * 0.1 * prof
        const edge = Math.exp(-de / 0.03)
        const c = mix(amber, hot, 0.15 + 0.7 * edge)
        put(x, y, z, W(kind, id), c[0], c[1], c[2], alpha * (0.55 + 1.1 * edge))
      }
    }
    const nDigits = Math.floor(N * 0.28), nGhost = Math.floor(N * 0.008)
    for (let d = 0; d < 2; d++) {
      const S = segs(DIGIT_X[d]), tot = LIT[d].reduce((s, i) => s + polyArea(S[i]), 0)
      for (const i of LIT[d]) sampleSeg(S[i], Math.round((nDigits / 2) * polyArea(S[i]) / tot), 0, d * 8 + i, 0.5)
      for (let i = 0; i < 7; i++) if (!LIT[d].includes(i)) sampleSeg(S[i], Math.round((nGhost / 2) * polyArea(S[i]) / polyArea(S[6])), 1, d * 8 + i, 0.03)
    }
    // ---- phosphor halo: huge soft sprites around the digits (kind 5) ----------------------------------------
    const nHalo = Math.floor(N * 0.04)
    for (let i = 0; i < nHalo; i++) {
      const s = Math.floor(rand() * 2), cx = DIGIT_X[s]
      const a = rand() * Math.PI * 2, r = 0.45 + 1.1 * Math.pow(rand(), 0.9)
      put(cx + Math.cos(a) * r * 0.75, Math.sin(a) * r * 1.2, -0.25 - rand() * 0.4, W(5, 0), amber[0], amber[1] * 0.9, amber[2] * 0.7, 0.012 + 0.03 * Math.exp(-r * 1.5))
    }
    // ---- countdown dial: 120 ticks (kind 2, id = tick) + a thin circle (kind 3) ----------------------------------
    const nTick = Math.floor(N * 0.05), per = nTick / (NT + 14 * 1.5)
    for (let t = 0; t < NT; t++) {
      const major = t % 10 === 0, a = Math.PI / 2 - (t / NT) * Math.PI * 2
      const dx = Math.cos(a), dy = Math.sin(a), len = major ? 0.26 : 0.11, w = major ? 0.022 : 0.012
      const n = Math.round(per * (major ? 2.5 : 1) * (0.7 + 0.6 * (len / 0.26)) + rand())
      for (let i = 0; i < n; i++) {
        const rr = RR + len * rand(), off = (rand() * 2 - 1) * w
        put(dx * rr - dy * off, dy * rr + dx * off, (rand() * 2 - 1) * 0.02, W(2, t), amber[0], amber[1], amber[2], 0.2)
      }
    }
    const nArc = Math.floor(N * 0.02)
    for (let i = 0; i < nArc; i++) {
      const a = rand() * Math.PI * 2, rr = RR - 0.06 + (rand() - 0.5) * 0.012
      put(Math.cos(a) * rr, Math.sin(a) * rr, (rand() - 0.5) * 0.02, W(3, 0), amber[0], amber[1], amber[2], 0.2)
    }
    // ---- problems (kind 4): rows of monospace text, sampled from one mask ----------------------------------------
    const rows: string[] = []
    for (let r = 0; r < ROWS; r++) {
      let line = r % 2 ? ' '.repeat(5) : ''
      for (let c = 0; c < COLS; c++) line += cellId[r][c] >= 0 ? problems().padEnd(CELLCH, ' ') : ' '.repeat(CELLCH)
      rows.push(line)
    }
    const mask = await ctx.textMask(rows.join('\n'), { font: `500 ${FONT_PX}px "IBM Plex Mono", monospace`, width: CANVAS_W, height: CANVAS_H, align: 'left' })
    const nText = Math.floor(N * 0.27)
    const smp = H.sampleMask(mask, nText, rand, false, 0.45)
    const zOf = (id: number) => { const s = Math.sin(id * 91.7 + 3.1) * 43758.5453; return -0.45 - 2.0 * (s - Math.floor(s)) }
    for (const [px, py] of smp) {
      const row = Math.min(ROWS - 1, Math.floor(py / ROW_PX))
      const cc = Math.floor((px / (ADV * FONT_PX) - (row % 2 ? 5 : 0)) / CELLCH)
      const id = cc >= 0 && cc < COLS ? cellId[row][cc] : -1
      if (id < 0) continue
      const x = FX0 + px * PXW, y = FY0 - py * PXW, z = zOf(id)
      const fade = 0.3 + 0.7 * Math.min(1, Math.max(0, (x + 7.0) / 3.6)), depth = 1 - 0.3 * (-z - 0.45) / 2
      const c = mix(amber, [1, 0.88, 0.62], 0.25)
      put(x, y, z, W(4, id), c[0], c[1], c[2], 0.17 * fade * depth)
    }
    // ---- dust: amber specks (kind 6) ---------------------------------------------------------------------------------
    while (k < N) {
      const x = (rand() * 2 - 1) * 7.2 - 1.2, y = (rand() * 2 - 1) * 3.6, z = (rand() * 2 - 1) * 2.2 - 0.6
      put(x, y, z, W(6, 0), amber[0], amber[1] * 0.95, amber[2] * 0.8, 0.03 + 0.12 * Math.pow(rand(), 3))
    }
  },
  glsl: /* glsl */ `
const float PZ_CYC = 30.0;
const float PZ_NC = ${NC.toFixed(1)};
const float PZ_STEP = ${STEP.toFixed(1)};
const float PZ_R = ${RR.toFixed(3)};
vec3 pz_yaw(vec3 q, float a) { float c = cos(a), s = sin(a); return vec3(c * q.x + s * q.z, q.y, -s * q.x + c * q.z); }
float pz_h(float x) { return fract(sin(x * 12.9898 + 4.1414) * 43758.5453); }
vec3 anim_zeta(vec3 p, vec4 d, vec4 r, float t) {
  float kind = mod(d.w, 16.0);
  float a = 0.13 * sin(t * 0.37) + 0.035 * sin(t * 0.83 + 1.0);
  if (kind > 5.5) {
    vec3 q = p + vec3(sin(t * 0.13 + r.x * 40.0) * 0.2, 0.06 * t * (0.3 + r.y), cos(t * 0.11 + r.z * 40.0) * 0.15);
    q.y = mod(q.y + 3.6, 7.2) - 3.6;
    return q;
  }
  vec3 q = p;
  if (kind < 1.5) q *= 1.0 + 0.012 * sin(t * 1.6 + d.x);
  if (kind > 3.5 && kind < 4.5) a *= 0.7;
  return pz_yaw(q, a);
}
float size_zeta(vec4 d, vec4 r, float t) {
  float kind = mod(d.w, 16.0);
  if (kind < 0.5) return 1.0;
  if (kind < 1.5) return 0.9;
  if (kind > 4.5 && kind < 5.5) return 3.4;
  if (kind > 3.5 && kind < 4.5) return 0.8;
  return 0.85;
}
vec4 color_zeta(vec4 c, vec4 d, vec4 r, float t) {
  float kind = mod(d.w, 16.0), id = floor(d.w / 16.0 + 0.001);
  float scan = 0.8 + 0.2 * sin(d.y * 70.0 - t * 2.6);
  float sweepY = 3.6 - mod(t * 0.75, 8.6);
  float band = exp(-pow((d.y - sweepY) / 0.16, 2.0));
  float shimmer = 0.9 + 0.1 * sin(t * 9.0 + r.w * 60.0);
  vec3 hot = vec3(1.0, 0.95, 0.8);
  if (kind < 1.5) {
    vec3 rgb = c.rgb + hot * band * 0.7;
    float flick = 1.0 - 0.1 * step(0.985, sin(t * 2.3) * 0.5 + 0.5);
    return vec4(rgb, c.a * (kind < 0.5 ? scan * shimmer * flick * (1.0 + 1.1 * band) : (0.7 + 0.3 * sin(t * 0.8 + id))));
  }
  if (kind < 2.5 || kind < 3.5) {
    float f = fract(t / PZ_CYC);
    float frac = kind < 2.5 ? id / 120.0 : fract((1.5707963 - atan(d.y, d.x)) / 6.2831853);
    float dx = frac - f;
    float remain = step(0.0, dx);
    float head = exp(-abs(dx) * 120.0 / 1.6);
    float after = exp(min(dx, 0.0) * 120.0 / 7.0);
    float a = c.a * (remain * 1.0 + (1.0 - remain) * (0.12 + 0.8 * after)) * (0.8 + 0.2 * scan);
    vec3 rgb = mix(c.rgb, hot, head * 0.85);
    a *= 1.0 + 4.0 * head;
    a *= 1.0 + 2.5 * exp(-f * 60.0);
    return vec4(rgb, a);
  }
  if (kind < 4.5) {
    float cell = id;
    float h1 = pz_h(cell + 0.5), h2 = pz_h(cell * 1.7 + 9.0);
    float vis = 0.18 + 0.82 * smoothstep(-0.25, 0.55, sin(t * (0.45 + 1.0 * h1) + h2 * 40.0));
    float tick = t * 2.2;
    float act = 0.0;
    for (int j = 0; j < 4; j++) {
      float idx = mod((floor(tick) - float(j)) * PZ_STEP, PZ_NC);
      float w = (j == 0 ? smoothstep(0.0, 0.25, fract(tick)) : 1.0 - float(j) * 0.24);
      act += step(abs(cell - idx), 0.5) * w;
    }
    vec3 rgb = mix(c.rgb, hot, min(1.0, act) * 0.8) + hot * band * 0.25;
    float flick = 0.82 + 0.18 * sin(t * 23.0 + h2 * 60.0);
    return vec4(rgb, c.a * vis * scan * flick * (1.0 + 4.0 * act) + 0.0);
  }
  if (kind < 5.5) return vec4(c.rgb, c.a * (0.8 + 0.2 * sin(t * 1.4)) * (1.0 + 0.5 * band));
  c.a *= 0.6 + 0.4 * sin(t * 1.1 + r.w * 40.0);
  return c;
}`,
  camera: { pos: [-2.4, 0, 10.6], target: [-2.4, 0, 0], fov: 35 },
  pointSize: 2.2,
  drift: 0.004,
}
export default form
