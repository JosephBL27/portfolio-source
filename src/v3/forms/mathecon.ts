// FORM "mathecon" — Education, second beat: Computational and Applied Mathematics + Economics. A living
// chalkboard in chalk-white particles on a slate panel with a wooden frame and chalk tray. Four zones:
//   top left   six hand-set equations that write in left to right (a chalk tip leads) and dissolve in turn,
//              three lines at a time: x′ = Ax · ∂u/∂t = Δu · max U(x) s.t. p·x ≤ m · MC = MR · ∇f(x) = 0 · Ax = λx
//   top right  supply and demand: demand shifts (the old curve stays as a ghost) and the equilibrium dot
//              slides along the supply curve, its dashed guides stretching to the axes
//   bottom left a 3D loss surface; a ball takes discrete gradient-descent steps (marked) into the minimum
//   bottom right consumer choice: indifference curve and budget line; a price change pivots the budget and
//              the optimum slides. Nothing here states a number; it is the mathematics itself.
//
// v15: the equations are 1.4x larger, the board brighter, and the supply-demand drawing writes itself on as the stop arrives: axes, then the supply
// curve, then the demand curve (a chalk tip leads each), then the equilibrium dot and its guides. All of it is a pure function of how present this form is
// (u_mathecon_pres = 0..1, read from the flight's morph state), so scrolling back un-draws it in reverse.
//
// pos.w = class + phase. Classes: 0 slate wash · 1 frame · 2 static chalk · 4 supply · 5 demand (moves) ·
// 6 demand ghost · 7 equilibrium dot · 8 guides · 10 surface wire · 11 surface wash · 12 descent path
// (phase = step) · 13 step markers (phase = step) · 14 ball · 15 trail · 16 budget line · 17 indifference
// curve (moves) · 18 indifference ghosts · 19 optimum dot · 20..25 equations (phase = position along the line,
// 0..0.98 of the ink width) · 30 chalk dust.
import type { FormDef } from './types'
import { H } from './ctx'

type C3 = [number, number, number]
const TAU = Math.PI * 2
const CHALK: C3 = [0.94, 0.95, 0.91], BLUE: C3 = [0.6, 0.8, 1.0], PINK: C3 = [1.0, 0.66, 0.58], GOLD: C3 = [1.0, 0.82, 0.36]
const WOOD: C3 = [0.66, 0.46, 0.28], SLATE: C3 = [0.38, 0.5, 0.54], CRIM: C3 = [0.9, 0.35, 0.4]
// geometry shared with GLSL
const O1 = [0.85, 0.45], K1 = [2.9, 1.45]          // supply-demand origin and extent
const O2 = [1.3, -2.0], K2 = [2.35, 1.6]           // consumer-choice origin and extent
const C3P = [-1.75, -1.28]                         // loss surface centre
const UM = [0.3, -0.2], U0 = [-0.85, 0.8]          // minimum and starting point of the descent
const EQS = ['x′ = Ax', '∂u/∂t = Δu', 'max U(x) s.t. p·x ≤ m', 'MC = MR', '∇f(x) = 0', 'Ax = λx']
const EQ_X0 = -3.75, EQ_Y = [1.78, 1.12, 0.46]
const SERIF = '"Times New Roman", Times, "STIX Two Text", serif'

// the loss surface (same formula in GLSL)
const hgt = (u: number, v: number) => { const a = u - UM[0], b = v - UM[1]; return 0.3 * (a * a + 1.5 * b * b) + 0.04 * Math.sin(4.2 * u + 1.0) * Math.cos(3.6 * v) }
const COS = 0.5, SIN = 0.866
const surf = (u: number, v: number): [number, number, number] => { const h = hgt(u, v), z = v * 0.95; return [C3P[0] + u * 1.7, C3P[1] + h * COS - z * SIN, z * COS + h * SIN] }
const gd = (k: number): [number, number] => [UM[0] + (U0[0] - UM[0]) * Math.pow(0.72, k), UM[1] + (U0[1] - UM[1]) * Math.pow(0.62, k)]

// how present this form is: 1 while it is the picture on show (or the dwell), 0 when it is not part of the morph. Read from the flight's own state (window.__v3.state()),
// so it is the same number the particles' morph uses: a pure function of the scroll. Without a host (the form viewer) it stays 1.
let presence = 1
const readPresence = () => {
  const st = (window as unknown as { __v3?: { state?: () => { a?: string; b?: string; mix?: number } } }).__v3?.state?.()
  if (!st || typeof st.mix !== 'number') return 1
  const m = Math.min(1, Math.max(0, st.mix))
  return Math.min(1, (st.a === 'mathecon' ? 1 - m : 0) + (st.b === 'mathecon' ? m : 0))
}

const form: FormDef = {
  id: 'mathecon',
  async build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const S = N / 262144, B = Math.pow(1 / S, 0.8)
    const n = (x: number) => Math.max(1, Math.round(x * S))
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, c: C3, a: number) => { if (idx < N) H.set(pos, col, idx++, x, y, z, w, c[0], c[1], c[2], a * B) }
    const J = 0.006
    const jit = () => (rand() - 0.5) * J
    const curve = (fn: (s: number) => [number, number, number], cnt: number, cls: number, c: C3 | ((s: number) => C3), al: number | ((s: number) => number), ph?: (s: number) => number) => {
      const m = n(cnt)
      for (let i = 0; i < m; i++) { const s = (i + rand()) / m, p = fn(s); put(p[0] + jit(), p[1] + jit(), p[2] + jit(), cls + (ph ? ph(s) : rand() * 0.98), typeof c === 'function' ? c(s) : c, typeof al === 'function' ? al(s) : al) }
    }
    const line = (a: number[], b: number[], cnt: number, cls: number, c: C3, al: number, z = 0) => curve(s => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, z], cnt, cls, c, al)
    const dashed = (a: number[], b: number[], cnt: number, cls: number, c: C3, al: number, dash = 0.07) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), segs = Math.max(2, Math.round(len / dash)), per = Math.max(2, Math.round(n(cnt) / segs / 2))
      for (let k = 0; k < segs; k += 2) for (let i = 0; i < per; i++) { const s = (k + rand()) / segs; put(a[0] + (b[0] - a[0]) * s + jit(), a[1] + (b[1] - a[1]) * s + jit(), jit(), cls + rand() * 0.98, c, al) }
    }

    // ---- text masks (parallel) ----
    const mask = async (text: string, font: string, w: number, h: number) => {
      const img = await ctx.textMask(text, { font, width: w, height: h, align: 'left' })
      let x0 = w, x1 = 0, y0 = h, y1 = 0, ink = 0
      const d = img.data
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 127) { ink++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      if (!ink) { x0 = 0; x1 = w; y0 = 0; y1 = h }
      return { img, x0, x1: x1 + 1, y0, y1: y1 + 1, ink }
    }
    const EQF = `italic 700 130px ${SERIF}`, LBF = `italic 700 110px ${SERIF}`
    const [eqM, lbP, lbQ, lbS, lbD, lbX, lbY, lbU, cap] = await Promise.all([
      Promise.all(EQS.map(e => mask(e, EQF, 1900, 200))),
      mask('P', LBF, 160, 170), mask('Q', LBF, 160, 170), mask('S', LBF, 160, 170), mask('D', LBF, 160, 170),
      mask('x', LBF, 160, 170), mask('y', LBF, 160, 170), mask('U', LBF, 160, 170),
      mask('θ ← θ − η∇L(θ)', `italic 700 100px ${SERIF}`, 1100, 150),
    ])
    type M = Awaited<ReturnType<typeof mask>>
    // place a mask: left edge x0w, vertical centre yw, world per px k; returns bounds
    const stamp = (m: M, x0w: number, yw: number, k: number, cnt: number, cls: number, c: C3, al: number, phase?: (u: number) => number, z = 0) => {
      const cy = (m.y0 + m.y1) / 2, w = m.x1 - m.x0
      for (const q of H.sampleMask(m.img, n(cnt), rand)) {
        const u = (q[0] - m.x0) / w
        put(x0w + (q[0] - m.x0) * k + jit() * 0.4, yw + (cy - q[1]) * k + jit() * 0.4, z + jit() * 0.3, cls + (phase ? phase(Math.min(1, Math.max(0, u))) : rand() * 0.98), c, al)
      }
    }
    const label = (m: M, cxw: number, cyw: number, capH: number, cnt: number, cls: number, c: C3, al: number) => {
      const k = capH / (m.y1 - m.y0), w = (m.x1 - m.x0) * k
      stamp(m, cxw - w / 2, cyw, k, cnt, cls, c, al)
    }

    // ============ equations: three lines, slot = index mod 3, 14.4 s cycle ============
    {
      // v15: 1.4x the old size (0.0027 world units per px); the longest line is held to 4.1 units so it stops short of the supply-demand axes
      const K = 0.0027 * 1.4
      const tot = eqM.reduce((s, m) => s + m.ink, 0), budget = 19000 * 1.35
      eqM.forEach((m, e) => stamp(m, EQ_X0, EQ_Y[e % 3], Math.min(K, 4.1 / Math.max(1, m.x1 - m.x0)), budget * m.ink / tot, 20 + e, CHALK, 1.0, u => u * 0.98))
    }

    // ============ supply and demand ============
    const w1 = (q: number, p: number, z = 0): [number, number, number] => [O1[0] + q * K1[0], O1[1] + p * K1[1], z]
    line(w1(0, 0), w1(0, 1.1), 330, 2, CHALK, 0.8); line(w1(0, 0), w1(1.08, 0), 560, 2, CHALK, 0.8)
    for (const [a, b] of [[0, 1.1], [1.08, 0]]) { const tip = w1(a, b); for (const sgn of [-1, 1]) line(tip, a ? [tip[0] - 0.08, tip[1] + 0.05 * sgn] : [tip[0] + 0.05 * sgn, tip[1] - 0.08], 22, 2, CHALK, 0.8) }
    curve(s => w1(0.05 + 0.92 * s, 0.12 + 0.7 * (0.05 + 0.92 * s)), 1300, 4, BLUE, 0.55)
    curve(s => w1(0.04 + 0.74 * s, 0.95 - 0.75 * (0.04 + 0.74 * s)), 1300, 5, PINK, 0.6)
    curve(s => w1(0.04 + 0.74 * s, 0.95 - 0.75 * (0.04 + 0.74 * s)), 500, 6, PINK, 0.2)
    label(lbP, O1[0] - 0.17, O1[1] + K1[1] * 1.1 + 0.05, 0.17, 380, 2, CHALK, 0.9); label(lbQ, O1[0] + K1[0] * 1.08 + 0.17, O1[1] - 0.02, 0.17, 380, 2, CHALK, 0.9)
    label(lbS, O1[0] + K1[0] * 1.0 + 0.1, O1[1] + K1[1] * 0.82 + 0.02, 0.17, 380, 4, BLUE, 0.95)
    label(lbD, O1[0] + K1[0] * 0.84 + 0.12, O1[1] + K1[1] * 0.3 + 0.0, 0.17, 380, 5, PINK, 0.95)
    {
      const q0 = 0.83 / 1.45, p0 = 0.12 + 0.7 * q0, c = w1(q0, p0)
      for (let i = 0, m = n(900); i < m; i++) { const r = 0.055 * Math.sqrt(rand()), a = rand() * TAU; put(c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), 0.02, 7 + rand() * 0.98, GOLD, 0.8) }
      for (let i = 0, m = n(1100); i < m; i++) { const r = 0.05 + 0.3 * Math.pow(rand(), 1.6), a = rand() * TAU; put(c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), 0, 7 + rand() * 0.98, GOLD, 0.07) }
      dashed(w1(0, p0), w1(q0, p0), 700, 8, GOLD, 0.8); dashed(w1(q0, 0), w1(q0, p0), 700, 8, GOLD, 0.8)
    }

    // ============ the loss surface and the descent ============
    {
      const NL = 21
      const colOf = (u: number, v: number): C3 => { const h = Math.min(1, hgt(u, v) / 1.1), t = h; return [0.62 + 0.38 * t, 0.82 + 0.06 * t - 0.1 * t * t, 1.0 - 0.45 * t] }
      for (let i = 0; i < NL; i++) {
        const a = -1 + (2 * i) / (NL - 1), edge = i === 0 || i === NL - 1
        curve(s => { const b = -1 + 2 * s, p = surf(a, b); return p }, edge ? 720 : 520, 10, s => colOf(a, -1 + 2 * s), s => (0.34 + 0.28 * (0.5 * (1 + (-1 + 2 * s)))) * (edge ? 1.3 : 1))
        curve(s => { const b = -1 + 2 * s, p = surf(b, a); return p }, edge ? 720 : 520, 10, s => colOf(-1 + 2 * s, a), () => (0.34 + 0.28 * (0.5 * (1 + a))) * (edge ? 1.3 : 1))
      }
      for (let i = 0, m = n(8000); i < m; i++) { const u = rand() * 2 - 1, v = rand() * 2 - 1, p = surf(u, v); const c = colOf(u, v); put(p[0], p[1], p[2], 11 + rand() * 0.98, c, 0.07) }
      // descent path, markers and the minimum
      curve(s => { const k = s * 13, g = gd(k), p = surf(g[0], g[1]); return [p[0], p[1] + 0.02, p[2] + 0.02] }, 1500, 12, GOLD, 0.9, s => s * 0.98)
      for (let k = 0; k <= 13; k++) {
        const g = gd(k), p = surf(g[0], g[1])
        for (let i = 0, m = n(70); i < m; i++) { const r = 0.032 * Math.sqrt(rand()), a = rand() * TAU; put(p[0] + r * Math.cos(a), p[1] + 0.02 + r * Math.sin(a), p[2] + 0.02, 13 + (k / 13) * 0.98, [1.0, 0.94, 0.7], 1.0) }
      }
      for (let i = 0, m = n(650); i < m; i++) { const a = rand() * TAU, r = 0.048 * Math.sqrt(rand()); put(Math.cos(a) * r, Math.sin(a) * r, (rand() - 0.5) * 0.02, 14 + rand() * 0.98, [1.0, 0.96, 0.8], 0.9) } // ball (offsets only)
      for (let i = 0, m = n(1400); i < m; i++) put(0, 0, 0, 15 + rand() * 0.98, GOLD, 0.8)                                                             // trail
      const m0 = cap, k = 0.0030
      stamp(m0, -3.8, -2.2, k, 1100, 2, CHALK, 0.8)
    }

    // ============ consumer choice ============
    {
      const w2 = (x: number, y: number, z = 0): [number, number, number] => [O2[0] + x * K2[0], O2[1] + y * K2[1], z]
      line(w2(0, 0), w2(0, 1.08), 300, 2, CHALK, 0.8); line(w2(0, 0), w2(1.08, 0), 460, 2, CHALK, 0.8)
      for (const [a, b] of [[0, 1.08], [1.08, 0]]) { const tip = w2(a, b); for (const sgn of [-1, 1]) line(tip, a ? [tip[0] - 0.08, tip[1] + 0.05 * sgn] : [tip[0] + 0.05 * sgn, tip[1] - 0.08], 22, 2, CHALK, 0.8) }
      const x10 = 0.9, y1 = 0.85, c0 = x10 * y1 / 4
      curve(s => { const u = s; return w2(u * x10, (1 - u) * y1) }, 1100, 16, BLUE, 0.55)
      const ic = (c: number, cnt: number, cls: number, col2: C3, al: number) => { const lo = c / 1.3; curve(s => { const x = lo * Math.exp(s * Math.log(1.3 / lo)); const p = w2(x, c / x); return p }, cnt, cls, col2, (s) => { const x = lo * Math.exp(s * Math.log(1.3 / lo)), y = c / x; return x > 0.98 || y > 0.98 ? 0 : al }) }
      ic(c0, 1100, 17, PINK, 0.6); ic(0.06, 700, 18, CHALK, 0.28); ic(0.3, 700, 18, CHALK, 0.28)
      const oc = w2(x10 / 2, y1 / 2)
      for (let i = 0, m = n(700); i < m; i++) { const r = 0.05 * Math.sqrt(rand()), a = rand() * TAU; put(oc[0] + r * Math.cos(a), oc[1] + r * Math.sin(a), 0.02, 19 + rand() * 0.98, GOLD, 1.0) }
      for (let i = 0, m = n(800); i < m; i++) { const r = 0.05 + 0.28 * Math.pow(rand(), 1.6), a = rand() * TAU; put(oc[0] + r * Math.cos(a), oc[1] + r * Math.sin(a), 0, 19 + rand() * 0.98, GOLD, 0.07) }
      label(lbX, O2[0] + K2[0] * 1.08 + 0.17, O2[1] - 0.02, 0.15, 300, 2, CHALK, 0.9); label(lbY, O2[0] - 0.17, O2[1] + K2[1] * 1.08 + 0.05, 0.15, 300, 2, CHALK, 0.9)
      label(lbU, O2[0] + K2[0] * 0.76, O2[1] + K2[1] * 0.3, 0.15, 300, 18, PINK, 0.7)
    }

    // ============ the board: slate, frame, tray, dividers ============
    const BX = 4.1, BY = 2.4
    for (const [off, al] of [[0, 0.9], [0.045, 0.65], [0.09, 0.4]]) {
      line([-BX - off, -BY - off], [BX + off, -BY - off], 1500, 1, WOOD, al, 0.08); line([-BX - off, BY + off], [BX + off, BY + off], 1500, 1, WOOD, al, 0.08)
      line([-BX - off, -BY - off], [-BX - off, BY + off], 860, 1, WOOD, al, 0.08); line([BX + off, -BY - off], [BX + off, BY + off], 860, 1, WOOD, al, 0.08)
    }
    line([-3.9, -2.55], [3.9, -2.55], 600, 1, WOOD, 0.9, 0.18); line([-3.9, -2.62], [3.9, -2.62], 600, 1, WOOD, 0.6, 0.18)
    for (const [x0, c] of [[-2.6, CHALK], [-2.3, GOLD], [-2.05, PINK]] as [number, C3][]) { line([x0, -2.5], [x0 + 0.2, -2.46], 60, 2, c, 0.95, 0.2); line([x0, -2.47], [x0 + 0.2, -2.43], 60, 2, c, 0.95, 0.2) }
    for (const y of [-2.5, -2.43]) line([2.55, y], [3.0, y], 70, 2, CHALK, 0.5, 0.2)
    line([2.55, -2.5], [2.55, -2.43], 20, 2, CHALK, 0.5, 0.2); line([3.0, -2.5], [3.0, -2.43], 20, 2, CHALK, 0.5, 0.2)
    dashed([0.35, -2.2], [0.35, 2.25], 500, 2, CHALK, 0.22, 0.09); dashed([-4.0, 0.02], [4.0, 0.02], 700, 2, CHALK, 0.22, 0.09)

    // ============ slate grain and chalk dust fill the rest ============
    const wash = Math.min(Math.max(n(70000), 1), N - idx - n(12000))
    for (let i = 0; i < wash; i++) put((rand() * 2 - 1) * BX, (rand() * 2 - 1) * BY, -0.05 - rand() * 0.04, 0 + rand() * 0.98, SLATE, 0.125 + 0.07 * rand())   // v15: the slate reads as a lit panel (was 0.09..0.14)
    const used = idx
    for (let i = used, m = Math.min(N, used + n(12000)); i < m; i++) put((rand() * 2 - 1) * 4.6, (rand() * 2 - 1) * 2.9, 0.1 + rand() * 0.5, 30 + rand() * 0.98, CHALK, 0.1 + 0.2 * rand())
    H.dust(pos, col, idx, N, rand, 6.5, 0.04 * B, [0.7, 0.78, 0.8])
    for (let i = idx; i < N; i++) pos[i * 4 + 3] = 30.5
  },
  glsl: /* glsl */ `
uniform float u_mathecon_pres;
const vec2 MH_O1 = vec2(0.85, 0.45);
const vec2 MH_K1 = vec2(2.9, 1.45);
const vec2 MH_O2 = vec2(1.3, -2.0);
const vec2 MH_K2 = vec2(2.35, 1.6);
const vec2 MH_C3 = vec2(-1.75, -1.28);
const vec2 MH_UM = vec2(0.3, -0.2);
const vec2 MH_U0 = vec2(-0.85, 0.8);
float mh_e(float t) { float m = mod(t, 12.0); return smoothstep(2.0, 4.2, m) - smoothstep(7.0, 9.2, m); }
vec2 mh_eq(float t) { float sq = 0.24 * mh_e(t); float q = (0.83 + 0.75 * sq) / 1.45; return vec2(q, 0.12 + 0.7 * q); }
float mh_x1(float t) { return 0.9 / (1.0 + 0.8 * mh_e(t + 6.0)); }
float mh_h(vec2 uv) { vec2 a = uv - MH_UM; return 0.3 * (a.x * a.x + 1.5 * a.y * a.y) + 0.04 * sin(4.2 * uv.x + 1.0) * cos(3.6 * uv.y); }
vec3 mh_surf(vec2 uv) { float h = mh_h(uv), z = uv.y * 0.95; return vec3(MH_C3.x + uv.x * 1.7, MH_C3.y + h * 0.5 - z * 0.866, z * 0.5 + h * 0.866); }
vec2 mh_gd(float k) { return MH_UM + (MH_U0 - MH_UM) * vec2(pow(0.72, k), pow(0.62, k)); }
float mh_tau(float t) { return mod(t, 17.0); }
float mh_kb(float t) { return clamp((mh_tau(t) - 1.0) / 0.75, 0.0, 13.0); }
float mh_vis(float t) { float tau = mh_tau(t); return smoothstep(0.0, 0.8, tau) * (1.0 - smoothstep(15.0, 16.5, tau)); }
float mh_lt(float e, float t) { return mod(t - e * 2.4, 14.4); }
vec3 anim_mathecon(vec3 p, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl > 19.5 && cl < 25.5) {                                   // equations dissolve like chalk dust
    float lt = mh_lt(cl - 20.0, t);
    float dl = clamp((lt - 6.0 - r.x * 0.5) / 0.75, 0.0, 1.0);
    p.y -= dl * dl * (0.25 + 0.5 * r.y); p.x += (r.z - 0.5) * 0.35 * dl; p.z += (r.w - 0.5) * 0.3 * dl;
    return p;
  }
  if (cl > 4.5 && cl < 5.5) { p.x += 0.24 * mh_e(t) * MH_K1.x; return p; }
  if (cl > 6.5 && cl < 7.5) { p.xy += (mh_eq(t) - mh_eq(0.0)) * MH_K1; return p; }
  if (cl > 7.5 && cl < 8.5) { p.xy = MH_O1 + (p.xy - MH_O1) * (mh_eq(t) / mh_eq(0.0)); return p; }
  if (cl > 13.5 && cl < 15.5) {                                   // ball and trail ride the surface
    float kb = mh_kb(t);
    if (cl < 14.5) { vec3 b = mh_surf(mh_gd(kb)); return b + vec3(0.0, 0.06, 0.06) + p; }
    float kk = max(kb - r.x * r.x * 2.4, 0.0);
    return mh_surf(mh_gd(kk)) + vec3(0.0, 0.03, 0.03) + (r.yzw - 0.5) * 0.03;
  }
  if (cl > 15.5 && cl < 16.5) { p.x = MH_O2.x + (p.x - MH_O2.x) * mh_x1(t) / 0.9; return p; }
  if (cl > 16.5 && cl < 17.5) { p.xy = MH_O2 + (p.xy - MH_O2) * sqrt(mh_x1(t) / 0.9); return p; }
  if (cl > 18.5 && cl < 19.5) { p.x += (mh_x1(t) - 0.9) * 0.5 * MH_K2.x; return p; }
  if (cl > 29.5) { float k = 0.1 + 0.12 * r.y; p.y = mod(p.y + 2.9 - t * k, 5.8) - 2.9; p.x += 0.2 * sin(t * 0.4 + r.x * 6.283); return p; }
  return p;
}
float size_mathecon(vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl > 13.5 && cl < 14.5) return 1.6;
  if (cl > 14.5 && cl < 15.5) return 1.2;
  if (cl > 29.5) return 0.8;
  if (cl < 0.5) return 0.9;
  return 1.0;
}
vec4 color_mathecon(vec4 c, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001), ph = fract(d.w) / 0.98;
  float a = c.a; vec3 rgb = c.rgb;
  float P = u_mathecon_pres;
  // v15: the supply-demand drawing writes itself on (axes -> supply -> demand -> the dot and its guides), a chalk tip leading each curve
  if (cl > 3.5 && cl < 6.5) {
    float q = (d.x - MH_O1.x) / MH_K1.x;
    float s = cl < 4.5 ? (q - 0.05) / 0.92 : (q - 0.04) / 0.74;
    float head = (cl < 4.5 ? smoothstep(0.48, 0.84, P) : cl < 5.5 ? smoothstep(0.6, 0.93, P) : smoothstep(0.82, 1.0, P)) * 1.08;
    float tip = exp(-pow((s - head) / 0.035, 2.0)) * step(head, 1.04) * step(0.001, head);
    a *= step(s, head) * (1.0 + 1.6 * tip);
    rgb = mix(rgb, vec3(1.0, 0.9, 0.62), clamp(tip, 0.0, 1.0));
  } else if (cl > 6.5 && cl < 8.5) {
    a *= smoothstep(0.9, 1.0, P);
  } else if (cl > 1.5 && cl < 2.5 && d.x > MH_O1.x - 0.3 && d.y > MH_O1.y - 0.12 && d.x < MH_O1.x + MH_K1.x * 1.1 + 0.35 && d.y < MH_O1.y + MH_K1.y * 1.2) {
    a *= smoothstep(0.3, 0.55, P);                                // the axes and their labels come first
  }
  if (cl > 19.5 && cl < 25.5) {                                   // write in with a chalk tip, hold, dissolve
    float lt = mh_lt(cl - 20.0, t);
    float head = lt / 1.7;
    float dl = clamp((lt - 6.0 - r.x * 0.5) / 0.75, 0.0, 1.0);
    float vis = step(ph, head) * (1.0 - dl);
    float tip = exp(-pow((ph - head) / 0.025, 2.0)) * step(head, 1.04);
    a *= vis * (1.0 + 1.8 * tip) * (0.92 + 0.08 * sin(t * 1.3 + r.x * 40.0));
    rgb = mix(rgb, vec3(1.0, 0.86, 0.45), clamp(tip, 0.0, 1.0));
  } else if (cl > 4.5 && cl < 5.5) {
    float sq = 0.24 * mh_e(t); float lq = (d.x - MH_O1.x) / MH_K1.x + sq; a *= 1.0 - smoothstep(1.0, 1.06, lq);
  } else if (cl > 6.5 && cl < 7.5) {
    a *= 1.0 + 0.5 * sin(t * 2.4);
  } else if (cl > 7.5 && cl < 8.5) {
    a *= 0.7 + 0.3 * sin(t * 2.0 + d.x * 26.0 + d.y * 26.0);
  } else if (cl > 11.5 && cl < 12.5) {                            // the descent path lights up as the ball passes
    float kb = mh_kb(t), kp = ph * 13.0, vs = mh_vis(t);
    a *= 0.22 + 1.5 * step(kp, kb + 0.05) * vs;
  } else if (cl > 12.5 && cl < 13.5) {
    float kb = mh_kb(t), kp = ph * 13.0, vs = mh_vis(t);
    a *= 0.12 + 1.6 * step(kp, kb + 0.05) * vs;
  } else if (cl > 13.5 && cl < 14.5) {
    a *= mh_vis(t);
  } else if (cl > 14.5 && cl < 15.5) {
    float kb = mh_kb(t); float lag = r.x * r.x * 2.4; a *= mh_vis(t) * (1.0 - lag / 2.4) * step(lag, kb + 0.01) * (0.6 + 0.4 * smoothstep(0.0, 0.3, kb));
  } else if (cl > 16.5 && cl < 17.5) {
    float s = sqrt(mh_x1(t) / 0.9); vec2 lo = (d.xy - MH_O2) / MH_K2 * s; a *= (1.0 - smoothstep(0.96, 1.0, lo.y)) * (1.0 - smoothstep(0.96, 1.0, lo.x));
  } else if (cl > 18.5 && cl < 19.5) {
    a *= 1.0 + 0.5 * sin(t * 2.4 + 1.0);
  } else if (cl > 9.5 && cl < 11.5) {
    a *= 0.9 + 0.1 * sin(t * 0.9 + d.x * 3.0);
  } else if (cl > 29.5) {
    a *= 0.35 + 0.65 * (0.5 + 0.5 * sin(t * (0.5 + r.y * 1.5) + r.x * 60.0));
  } else if (cl < 0.5) {
    a *= 0.75 + 0.25 * sin(t * (0.3 + r.x) + r.y * 60.0);
  }
  return vec4(rgb, a);
}`,
  camera: { pos: [0, 0, 9.7], target: [0, 0, 0], fov: 35 },
  pointSize: 2.0,
  // v15: a brighter board (+25% gain, +10% size on top of the stronger slate and equation alphas)
  style: { gain: 1.25, size: 1.1 },
  uniforms: { u_mathecon_pres: { value: 1 } },
  update() { presence = readPresence(); form.uniforms!.u_mathecon_pres.value = presence },
  drift: 0.002,
}
export default form
