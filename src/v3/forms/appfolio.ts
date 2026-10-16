// FORM "appfolio" — Work, the AppFolio (APPF) pitch "The Second Act". A mixed-use apartment tower at dusk over a
// wet street, with a skyline behind it. Every window is a customer: the lights come on floor by floor, quickly at
// first and then more slowly (the customer curve flattening: the pitch's first act). Then the second act: a satin
// ribbon draws on across the street side and climbs in a curve that steepens as it rises (revenue per customer),
// twisting as it goes, and the lit windows turn from amber to warm white. The cycle fades and starts again every
// 18 s. No numbers appear anywhere in the form; the shape is the thesis. The skyline windows, the sky and the street
// reflections are illustrative. No logo, no company mark.
//
// pos.w = class + q (q in [0,1] stored as q*0.98 is the per-particle phase):
//  0 facade wash · 1 stone lines · 2 lit window (q = activation order, floor by floor) · 3 dark window frame ·
//  4 ribbon (q = u along the ribbon) · 6 skyline window (q = random) · 7 star · 8 street · 9 reflection (q as window) ·
//  10 roof beacon and mast · 11 haze · 12 ribbon sparks
import type { FormDef } from './types'
import { H } from './ctx'

type V3 = [number, number, number]
type C3 = [number, number, number]
interface Fr { o: V3; ex: V3; ey: V3 }
const TAU = Math.PI * 2
const G = -1.7

const SLATE: C3 = [0.5, 0.62, 0.86], SLATE_HI: C3 = [0.76, 0.86, 1.0], SLATE_LO: C3 = [0.34, 0.43, 0.66]
const AMBER: C3 = [1.0, 0.76, 0.29], GOLD: C3 = [1.0, 0.87, 0.52], PALE: C3 = [1.0, 0.94, 0.78], ORANGE: C3 = [1.0, 0.56, 0.2], TVBLUE: C3 = [0.66, 0.82, 1.0]
const RED: C3 = [1.0, 0.3, 0.22]

const sc = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const P = (f: Fr, s: number, t: number): V3 => add(add(f.o, sc(f.ex, s)), sc(f.ey, t))
const mix3 = (a: C3, b: C3, k: number): C3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]

// the ribbon's centre line (the same formula runs in GLSL): sweeps left to right, rises along a steepening curve and
// weaves from the street side to behind the tower and back
const KE = 1.9
const ribC = (u: number): V3 => [-3.3 + 6.6 * u, G + 0.15 + (3.9 * (Math.exp(KE * u) - 1)) / (Math.exp(KE) - 1), 0.9 * Math.sin(TAU * u + 0.6)]
const ribW = (u: number) => 0.14 + 0.3 * u
const ribTw = (u: number) => 7.0 * u
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const nrm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
const ribE = (u: number): V3 => {
  const a = ribC(Math.max(0, u - 0.004)), b = ribC(Math.min(1, u + 0.004))
  const T = nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), B = nrm(cross(T, [0, 1, 0])), Nn = cross(T, B), th = ribTw(u)
  return [B[0] * Math.cos(th) + Nn[0] * Math.sin(th), B[1] * Math.cos(th) + Nn[1] * Math.sin(th), B[2] * Math.cos(th) + Nn[2] * Math.sin(th)]
}
const f4 = (v: number) => v.toFixed(4)

const form: FormDef = {
  id: 'appfolio',
  build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const S = N / 262144, B = Math.pow(1 / S, 0.8)
    const n = (x: number) => Math.max(1, Math.round(x * S))
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, c: C3, a: number) => { if (idx < N) H.set(pos, col, idx++, x, y, z, w, c[0], c[1], c[2], a * B) }
    const emit = (p: V3, cls: number, q: number, c: C3, a: number) => put(p[0], p[1], p[2], cls + Math.min(0.98, Math.max(0, q) * 0.98), c, a)
    const J = 0.004
    const seg = (a: V3, b: V3, cnt: number, cls: number, c: C3, al: number, q = -1) => {
      const m = n(cnt)
      for (let i = 0; i < m; i++) { const u = (i + rand()) / m; emit([a[0] + (b[0] - a[0]) * u + (rand() - 0.5) * J, a[1] + (b[1] - a[1]) * u + (rand() - 0.5) * J, a[2] + (b[2] - a[2]) * u + (rand() - 0.5) * J], cls, q < 0 ? rand() : q, c, al) }
    }
    const quad = (o: V3, du: V3, dv: V3, cnt: number, cls: number, c: C3, al: number) => {
      const m = n(cnt)
      for (let i = 0; i < m; i++) { const u = rand(), v = rand(); emit([o[0] + du[0] * u + dv[0] * v, o[1] + du[1] * u + dv[1] * v, o[2] + du[2] * u + dv[2] * v], cls, rand(), c, al) }
    }
    const seg2 = (f: Fr, s0: number, t0: number, s1: number, t1: number, cnt: number, cls: number, c: C3, al: number) => seg(P(f, s0, t0), P(f, s1, t1), cnt, cls, c, al)
    const rect2 = (f: Fr, s0: number, t0: number, s1: number, t1: number, cnt: number, cls: number, c: C3, al: number) => quad(P(f, s0, t0), sc(f.ex, s1 - s0), sc(f.ey, t1 - t0), cnt, cls, c, al)

    // ---- one window: lit glass (class 2, q = activation), a soft halo, a dark frame, and its street reflection (class 9) ----
    const WCOL = [AMBER, AMBER, AMBER, GOLD, GOLD, ORANGE, PALE, TVBLUE]
    const windowAt = (f: Fr, cs: number, yb: number, w: number, h: number, q: number, dens = 1) => {
      const wc = WCOL[Math.floor(rand() * WCOL.length)]
      const m = n(150 * dens)
      for (let i = 0; i < m; i++) {
        const s = cs + (rand() - 0.5) * w, t = yb + rand() * h
        const edge = Math.min(Math.abs(s - cs) / (w / 2), 1), fall = 1 - 0.28 * (t - yb) / h // glass is brightest low in the pane
        emit(P(f, s, t), 2, q, wc, (0.62 + 0.3 * rand()) * fall * (1 - 0.15 * edge))
      }
      const hh = n(12 * dens)
      for (let i = 0; i < hh; i++) emit(P(f, cs + (rand() - 0.5) * w * 2.0, yb + h / 2 + (rand() - 0.5) * h * 2.2), 2, q, wc, 0.05)
      // dark frame: sill, head, jambs, mullion (static, always on, so the tower reads when it is dark)
      const x0 = cs - w / 2, x1 = cs + w / 2, y1 = yb + h
      seg2(f, x0, yb, x1, yb, 14 * dens, 3, SLATE_HI, 0.55); seg2(f, x0, y1, x1, y1, 12 * dens, 3, SLATE, 0.4)
      seg2(f, x0, yb, x0, y1, 12 * dens, 3, SLATE, 0.4); seg2(f, x1, yb, x1, y1, 12 * dens, 3, SLATE, 0.4)
      seg2(f, cs, yb, cs, y1, 8 * dens, 3, SLATE_LO, 0.25)
      const gl = n(5 * dens); for (let i = 0; i < gl; i++) emit(P(f, cs + (rand() - 0.5) * w, yb + rand() * h), 3, rand(), SLATE_LO, 0.07)
      // reflection in the wet street: mirrored and smeared downward, lit when the window is
      const rf = n(34 * dens)
      if (f.o[2] > 0.3 && f.ex[0] === 1) for (let i = 0; i < rf; i++) { const s = cs + (rand() - 0.5) * w * 0.8, t = yb + rand() * h; const p = P(f, s, t); emit([p[0] + (rand() - 0.5) * 0.02, 2 * G - p[1] - Math.pow(rand(), 1.5) * 0.28, p[2] + 0.55 + rand() * 0.5], 9, q, wc, 0.34) }
    }

    // ============ 1. THE TOWER: podium shops, eleven floors, a crown, a mast ============
    const FH = 0.27, Y0 = G + 0.55, NF = 11, YT = Y0 + NF * FH
    const front: Fr = { o: [0, 0, 0.45], ex: [1, 0, 0], ey: [0, 1, 0] }
    const east: Fr = { o: [1.0, 0, -0.45], ex: [0, 0, 1], ey: [0, 1, 0] }
    const west: Fr = { o: [-1.0, 0, 0.45], ex: [0, 0, -1], ey: [0, 1, 0] }
    const qFloor = (fl: number) => Math.min(1, ((fl + 0.5) / NF) * 0.8 + rand() * 0.18)
    // facade wash and slabs
    rect2({ ...front, o: [-1.0, 0, 0.45] }, 0, Y0, 2.0, YT, 4200, 0, SLATE_LO, 0.05)
    rect2(east, 0, Y0, 0.9, YT, 1900, 0, SLATE_LO, 0.045); rect2(west, 0, Y0, 0.9, YT, 1900, 0, SLATE_LO, 0.045)
    for (let k = 0; k <= NF; k++) {
      const y = Y0 + k * FH
      seg([-1.02, y, 0.45], [1.02, y, 0.45], 110, 1, k === 0 || k === NF ? SLATE_HI : SLATE, k === 0 || k === NF ? 0.8 : 0.4)
      seg([1.0, y, 0.45], [1.0, y, -0.45], 40, 1, SLATE, 0.3); seg([-1.0, y, 0.45], [-1.0, y, -0.45], 40, 1, SLATE, 0.3)
    }
    for (const x of [-1.0, 1.0]) { seg([x, Y0, 0.45], [x, YT, 0.45], 220, 1, SLATE_HI, 0.85); seg([x, Y0, -0.45], [x, YT, -0.45], 120, 1, SLATE, 0.4) }
    for (let k = 1; k < 6; k++) seg([-1.0 + k * (2 / 6), Y0, 0.45], [-1.0 + k * (2 / 6), YT, 0.45], 130, 1, SLATE_LO, 0.22)
    // windows
    for (let fl = 0; fl < NF; fl++) {
      const yb = Y0 + fl * FH + 0.06
      for (let c = 0; c < 6; c++) windowAt(front, -1.0 + (c + 0.5) * (2 / 6), yb, 0.2, 0.17, qFloor(fl))
      for (let c = 0; c < 3; c++) { windowAt(east, (c + 0.5) * 0.3, yb, 0.17, 0.17, qFloor(fl), 0.9); windowAt(west, (c + 0.5) * 0.3, yb, 0.17, 0.17, qFloor(fl), 0.9) }
    }
    // balconies on some floors (a thin slab line under the windows)
    for (let fl = 2; fl < NF; fl += 3) for (let c = 0; c < 6; c += 2) seg([-1.0 + c * (2 / 6) + 0.04, Y0 + fl * FH + 0.045, 0.5], [-1.0 + (c + 1) * (2 / 6) - 0.04, Y0 + fl * FH + 0.045, 0.5], 24, 1, SLATE_HI, 0.55)
    // podium: wide base with six shop bays, awnings, a door
    {
      const pf: Fr = { o: [-1.8, 0, 0.6], ex: [1, 0, 0], ey: [0, 1, 0] }
      rect2(pf, 0, G, 3.6, Y0, 2400, 0, SLATE_LO, 0.05)
      seg([-1.8, G, 0.6], [-1.8, Y0, 0.6], 100, 1, SLATE_HI, 0.8); seg([1.8, G, 0.6], [1.8, Y0, 0.6], 100, 1, SLATE_HI, 0.8)
      seg([-1.8, Y0, 0.6], [1.8, Y0, 0.6], 250, 1, SLATE_HI, 0.85); seg([-1.8, Y0 - 0.03, 0.6], [1.8, Y0 - 0.03, 0.6], 200, 1, SLATE, 0.45)
      seg([-1.8, Y0, 0.6], [-1.8, Y0, -0.5], 60, 1, SLATE, 0.4); seg([1.8, Y0, 0.6], [1.8, Y0, -0.5], 60, 1, SLATE, 0.4)
      seg([-1.8, Y0, -0.5], [-1.0, Y0, -0.5], 50, 1, SLATE_LO, 0.3); seg([1.0, Y0, -0.5], [1.8, Y0, -0.5], 50, 1, SLATE_LO, 0.3)
      for (let b = 0; b < 6; b++) {
        const cs = -1.5 + b * 0.6, door = b === 2 || b === 3
        const q = 0.01 + rand() * 0.12
        windowAt(pf, cs, G + (door ? 0.02 : 0.1), door ? 0.26 : 0.42, door ? 0.36 : 0.26, q, door ? 1.5 : 2.2)
        // awning
        seg([cs - 0.27, Y0 - 0.07, 0.6], [cs + 0.27, Y0 - 0.07, 0.6], 36, 1, SLATE_HI, 0.7); seg([cs - 0.27, Y0 - 0.07, 0.6], [cs - 0.22, Y0 - 0.15, 0.78], 8, 1, SLATE, 0.5); seg([cs + 0.27, Y0 - 0.07, 0.6], [cs + 0.22, Y0 - 0.15, 0.78], 8, 1, SLATE, 0.5)
        seg([cs - 0.22, Y0 - 0.15, 0.78], [cs + 0.22, Y0 - 0.15, 0.78], 30, 1, SLATE_HI, 0.8)
        if (b < 5) seg([cs + 0.3, G, 0.6], [cs + 0.3, Y0, 0.6], 36, 1, SLATE, 0.5)
      }
    }
    // crown, water tank, mast and beacon
    {
      const cf: Fr = { o: [-0.62, 0, 0.3], ex: [1, 0, 0], ey: [0, 1, 0] }
      rect2(cf, 0, YT, 1.24, YT + 0.34, 1100, 0, SLATE_LO, 0.05)
      seg([-0.62, YT, 0.3], [-0.62, YT + 0.34, 0.3], 50, 1, SLATE_HI, 0.8); seg([0.62, YT, 0.3], [0.62, YT + 0.34, 0.3], 50, 1, SLATE_HI, 0.8)
      seg([-0.66, YT + 0.34, 0.3], [0.66, YT + 0.34, 0.3], 120, 1, SLATE_HI, 0.85)
      for (let c = 0; c < 3; c++) windowAt(cf, 0.2 + c * 0.42, YT + 0.08, 0.2, 0.17, 0.9 + 0.08 * rand(), 1.1)
      // roof tank on legs
      const tx = 0.28, tz = 0.0, ty = YT + 0.4
      for (let r = 0; r < 4; r++) { const y = ty + 0.04 + r * 0.05, m = n(46); for (let i = 0; i < m; i++) { const a = ((i + rand()) / m) * TAU; emit([tx + 0.13 * Math.cos(a), y, tz + 0.13 * Math.sin(a)], 1, rand(), SLATE_HI, 0.7) } }
      for (const dx of [-0.1, 0.1]) seg([tx + dx, YT + 0.34, tz], [tx + dx, ty, tz], 14, 1, SLATE, 0.6)
      seg([tx - 0.14, ty + 0.25, tz], [tx, ty + 0.34, tz], 12, 1, SLATE_HI, 0.8); seg([tx + 0.14, ty + 0.25, tz], [tx, ty + 0.34, tz], 12, 1, SLATE_HI, 0.8)
      // mast with a blinking beacon
      seg([-0.3, YT + 0.34, 0.0], [-0.3, YT + 1.0, 0.0], 120, 1, SLATE_HI, 0.9)
      for (const y of [YT + 0.55, YT + 0.78]) seg([-0.38, y, 0], [-0.22, y, 0], 12, 1, SLATE_HI, 0.8)
      const m = n(60); for (let i = 0; i < m; i++) { const r = 0.025 * Math.sqrt(rand()), a = rand() * TAU; emit([-0.3 + r * Math.cos(a), YT + 1.02 + r * Math.sin(a), r * Math.sin(a * 2)], 10, rand(), RED, 1.0) }
      const hm = n(180); for (let i = 0; i < hm; i++) { const r = 0.2 * Math.pow(rand(), 1.4), a = rand() * TAU, b = Math.acos(2 * rand() - 1); emit([-0.3 + r * Math.sin(b) * Math.cos(a), YT + 1.02 + r * Math.cos(b), r * Math.sin(b) * Math.sin(a)], 10, rand(), RED, 0.07) }
    }

    // ============ 2. THE SKYLINE: blocks behind, windows toggling slowly ============
    const blocks: { x0: number; x1: number; top: number; z: number; far: boolean }[] = [
      { x0: -4.0, x1: -2.7, top: 0.55, z: -1.5, far: false }, { x0: -2.6, x1: -1.5, top: 1.25, z: -1.6, far: false },
      { x0: 1.5, x1: 2.6, top: 0.95, z: -1.6, far: false }, { x0: 2.7, x1: 4.0, top: 0.25, z: -1.5, far: false },
      { x0: -3.4, x1: -2.1, top: 1.85, z: -2.7, far: true }, { x0: 2.0, x1: 3.3, top: 1.55, z: -2.7, far: true }, { x0: -1.1, x1: 0.1, top: 1.1, z: -3.1, far: true },
    ]
    for (const b of blocks) {
      const al = b.far ? 0.5 : 1, f: Fr = { o: [b.x0, 0, b.z], ex: [1, 0, 0], ey: [0, 1, 0] }, w = b.x1 - b.x0
      rect2(f, 0, G, w, b.top, Math.round(w * (b.top - G) * 380), 0, SLATE_LO, 0.04 * al)
      seg([b.x0, G, b.z], [b.x0, b.top, b.z], 80, 1, SLATE, 0.6 * al); seg([b.x1, G, b.z], [b.x1, b.top, b.z], 80, 1, SLATE, 0.6 * al)
      seg([b.x0 - 0.02, b.top, b.z], [b.x1 + 0.02, b.top, b.z], Math.round(w * 90), 1, SLATE_HI, 0.8 * al)
      const cols = Math.max(2, Math.round(w / 0.2)), rows = Math.max(2, Math.floor((b.top - G - 0.1) / 0.25))
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const cs = (c + 0.5) * (w / cols), yb = G + 0.1 + r * 0.25 + 0.04, q = rand(), m = n(26)
        for (let i = 0; i < m; i++) emit([b.x0 + cs + (rand() - 0.5) * 0.12, yb + rand() * 0.12, b.z], 6, q, rand() < 0.3 ? TVBLUE : AMBER, 0.5 * al)
        const dm = n(5); for (let i = 0; i < dm; i++) emit([b.x0 + cs + (rand() - 0.5) * 0.14, yb + (rand() - 0.1) * 0.14, b.z], 3, rand(), SLATE_LO, 0.12 * al)
      }
      // rooftop bits: a cooling unit and a flicker of an aerial
      seg([b.x0 + w * 0.3, b.top, b.z], [b.x0 + w * 0.3, b.top + 0.1, b.z], 14, 1, SLATE, 0.5 * al); seg([b.x0 + w * 0.3 - 0.08, b.top + 0.1, b.z], [b.x0 + w * 0.3 + 0.08, b.top + 0.1, b.z], 12, 1, SLATE, 0.5 * al)
    }

    // ============ 3. THE STREET: curb, lane dashes, lamps, wet streaks ============
    seg([-6.5, G, 0.6], [6.5, G, 0.6], 600, 8, SLATE_HI, 0.55)           // building line
    seg([-6.5, G, 1.45], [6.5, G, 1.45], 600, 8, SLATE_HI, 0.5)          // curb
    seg([-6.5, G, 1.5], [6.5, G, 1.5], 400, 8, SLATE_LO, 0.3)
    for (let x = -6.3; x < 6.4; x += 0.7) seg([x, G, 2.5], [x + 0.36, G, 2.5], 26, 8, GOLD, 0.45)
    quad([-6.5, G, 0.6], [13, 0, 0], [0, 0, 0.85], 1800, 8, SLATE_LO, 0.03)         // sidewalk
    quad([-6.5, G, 1.5], [13, 0, 0], [0, 0, 2.2], 4200, 8, SLATE_LO, 0.025)         // road, faint
    for (let i = 0, m = n(3400); i < m; i++) { const x = (rand() - 0.5) * 11, z = 0.7 + rand() * 2.8, ln = 0.05 + rand() * 0.28; seg([x, G - 0.002, z], [x + ln, G - 0.002, z], 3, 8, rand() < 0.5 ? AMBER : TVBLUE, 0.06 + 0.1 * rand()) }
    for (const lx of [-2.6, 2.55, -5.0, 5.0]) {
      seg([lx, G, 1.2], [lx, G + 1.25, 1.2], 70, 8, SLATE_HI, 0.75); seg([lx, G + 1.25, 1.2], [lx + (lx < 0 ? 0.28 : -0.28), G + 1.32, 1.2], 22, 8, SLATE_HI, 0.75)
      const bx = lx + (lx < 0 ? 0.28 : -0.28), by = G + 1.3
      for (let i = 0, m = n(160); i < m; i++) { const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u), r = 0.04 * Math.cbrt(rand()); emit([bx + Math.cos(th) * s * r, by + u * r, 1.2 + Math.sin(th) * s * r], 8, rand(), PALE, 0.9) }
      for (let i = 0, m = n(520); i < m; i++) { const u = rand() * 2 - 1, th = rand() * TAU, s = Math.sqrt(1 - u * u), r = 0.55 * Math.pow(rand(), 1.6); emit([bx + Math.cos(th) * s * r, by + u * r, 1.2 + Math.sin(th) * s * r], 8, rand(), AMBER, 0.05) }
      for (let i = 0, m = n(480); i < m; i++) { const th = rand() * TAU, r = 0.9 * Math.sqrt(rand()); emit([bx + Math.cos(th) * r, G + 0.005, 1.2 + Math.sin(th) * r * 0.7], 8, rand(), AMBER, 0.05 * (1 - r)) }
    }

    // ============ 4. THE RIBBON (the second act): revenue per customer ============
    {
      const m = n(30000)
      for (let i = 0; i < m; i++) {
        const u = rand(), v = rand() * 2 - 1, c = ribC(u), e = ribE(u), hw = (ribW(u) / 2) * v
        const base = mix3(ORANGE, GOLD, Math.min(1, u * 1.4)), cc = mix3(base, PALE, Math.max(0, u - 0.82) * 4.5)
        emit([c[0] + e[0] * hw, c[1] + e[1] * hw, c[2] + e[2] * hw], 4, u, cc, 0.22 + 0.55 * Math.pow(Math.abs(v), 3) + 0.15 * rand())
      }
      for (const sgn of [-1, 1]) {
        const me = n(4600)
        for (let i = 0; i < me; i++) { const u = (i + rand()) / me, c = ribC(u), e = ribE(u), hw = (ribW(u) / 2) * sgn; emit([c[0] + e[0] * hw, c[1] + e[1] * hw, c[2] + e[2] * hw], 4, u, mix3(GOLD, PALE, Math.max(0, u - 0.6)), 0.95) }
      }
      const sp = n(3200); for (let i = 0; i < sp; i++) put(0, 0, 0, 12 + rand() * 0.98, GOLD, 0.9)
    }

    // ============ 5. SKY: stars, a dusk haze band at the horizon, haze behind the tower ============
    for (let i = 0, m = n(3600); i < m; i++) { const th = rand() * Math.PI, ph = rand() * TAU, R = 14; emit([R * Math.sin(th) * Math.cos(ph) * 0.9, 0.3 + Math.abs(R * Math.cos(th)) * 0.34, -4.8 - rand() * 4], 7, rand(), [0.82, 0.88, 1.0], 0.15 + 0.6 * Math.pow(rand(), 3)) }
    for (let i = 0, m = n(7600); i < m; i++) { const y = G + Math.pow(rand(), 1.9) * 2.4; emit([(rand() - 0.5) * 12, y, -3.2 + rand() * 2.0], 11, rand(), mix3(ORANGE, [0.55, 0.45, 0.8], (y - G) / 2.4), 0.05 + 0.05 * (1 - (y - G) / 2.4)) }
    for (let i = 0, m = n(3600); i < m; i++) { const r = 2.4 * Math.pow(rand(), 0.8), a = rand() * TAU; emit([r * Math.cos(a) * 1.0, 0.3 + r * Math.sin(a) * 1.0, -1.0], 11, rand(), [0.5, 0.5, 0.85], 0.02 * (1 - r / 2.5)) }

    const used = idx
    H.dust(pos, col, idx, N, rand, 6.5, 0.045 * B, [0.7, 0.72, 0.9])
    for (let i = used; i < N; i++) pos[i * 4 + 3] = 7.5
  },
  glsl: /* glsl */ `
const float AF_CYC = 18.0;
const float AF_KE = ${f4(KE)};
const float AF_G = ${f4(G)};
float af_q(vec4 d) { return fract(d.w) / 0.98; }
float af_tc(float t) { return mod(t, AF_CYC); }
float af_ton(float q) { return -2.7 * log(1.0 - 0.95 * q); }
float af_fade(float tc) { return 1.0 - smoothstep(16.3, 17.7, tc); }
float af_head(float tc) { float k = smoothstep(7.2, 14.8, tc); return k * 1.015; }
vec3 af_c(float u) { return vec3(-3.3 + 6.6 * u, AF_G + 0.15 + 3.9 * (exp(AF_KE * u) - 1.0) / (exp(AF_KE) - 1.0), 0.9 * sin(6.2831853 * u + 0.6)); }
vec3 anim_appfolio(vec3 p, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl > 11.5) {                                                  // sparks stream off the ribbon's head
    float tc = af_tc(t), h = af_head(tc), u = clamp(h - r.x * r.x * 0.2, 0.0, 1.0);
    return af_c(u) + (r.yzw - 0.5) * (0.06 + 0.3 * r.x) + vec3(0.0, -0.08 * r.x * r.x, 0.0) * sin(t * 2.0 + r.y * 9.0);
  }
  if (cl > 3.5 && cl < 4.5) {                                       // the ribbon flutters
    float u = af_q(d);
    p.z += 0.05 * sin(t * 1.4 + u * 11.0) * (0.3 + u); p.y += 0.02 * sin(t * 1.1 + u * 8.0);
    return p;
  }
  if (cl > 10.5 && cl < 11.5) { p.x += sin(t * 0.07 + p.z * 0.9 + r.x * 3.0) * 0.4; p.y += sin(t * 0.2 + r.y * 20.0) * 0.03; }
  return p;
}
float size_appfolio(vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001);
  if (cl > 11.5) return 1.5;
  if (cl > 9.5 && cl < 10.5) return 1.8;
  if (cl > 6.5 && cl < 7.5) return 0.7 + 0.8 * r.x;
  if (cl > 3.5 && cl < 4.5) return 1.1;
  return 1.0;
}
vec4 color_appfolio(vec4 c, vec4 d, vec4 r, float t) {
  float cl = floor(d.w + 0.001), q = af_q(d), tc = af_tc(t);
  float a = c.a; vec3 rgb = c.rgb;
  float fd = af_fade(tc), hot = smoothstep(8.5, 14.5, tc);
  if (cl > 1.5 && cl < 2.5 || cl > 8.5 && cl < 9.5) {               // lit windows (and their reflections): floor by floor
    float ton = q < 0.3 ? -1.0 : af_ton((q - 0.3) / 0.7);                                // the first windows are already lit when the cycle opens
    float lit = smoothstep(ton, ton + 0.4, tc) * fd * smoothstep(0.0, 0.7, tc);
    float flash = step(ton, tc) * exp(-(tc - ton) * 4.5) * step(0.0, ton);
    a *= lit * (0.9 + 0.1 * sin(t * (1.0 + 2.0 * q) + q * 70.0)) * (1.0 + 2.2 * flash) * (1.0 + 0.35 * hot);
    rgb = mix(rgb, vec3(1.0, 0.93, 0.7), 0.45 * hot * lit + 0.5 * flash);
    if (cl > 8.5) a *= 0.7 + 0.3 * sin(t * 1.7 + d.x * 14.0 + r.x * 9.0);
  } else if (cl > 3.5 && cl < 4.5) {                                // the ribbon draws on, then holds
    float h = af_head(tc);
    float shown = 1.0 - smoothstep(h - 0.05, h, q);
    float tip = exp(-pow((q - h) / 0.03, 2.0)) * step(0.001, h) * step(h, 1.03);
    float sheen = 0.7 + 0.6 * pow(0.5 + 0.5 * sin(q * 34.0 - t * 2.4), 4.0);
    a *= (0.1 + 0.9 * shown) * sheen * (1.0 + 2.0 * tip) * mix(1.0, fd, step(0.02, h));
    rgb = mix(rgb, vec3(1.0, 0.95, 0.8), clamp(tip + 0.25 * sheen * shown * hot, 0.0, 1.0));
  } else if (cl > 11.5) {                                           // sparks
    float h = af_head(tc);
    a *= smoothstep(0.005, 0.05, h) * (1.0 - r.x) * fd * (0.5 + 0.5 * sin(t * (2.0 + 5.0 * r.w) + r.z * 40.0)) * (1.0 - 0.8 * smoothstep(1.0, 1.02, h));
  } else if (cl > 5.5 && cl < 6.5) {                                // skyline windows: slow toggles
    float tg = 0.5 + 0.5 * sin(t * (0.07 + 0.1 * fract(q * 7.3)) + q * 53.0);
    a *= smoothstep(0.42, 0.58, tg);
  } else if (cl > 9.5 && cl < 10.5) {                               // beacon
    float b = pow(max(0.0, sin(t * 2.6)), 6.0); a *= 0.12 + 0.88 * b;
  } else if (cl > 7.5 && cl < 8.5) {
    a *= 0.85 + 0.15 * sin(t * 2.1 + q * 60.0);
  } else if (cl > 6.5 && cl < 7.5) {
    a *= 0.35 + 0.65 * (0.5 + 0.5 * sin(t * (0.6 + 2.2 * r.y) + r.x * 90.0));
  } else if (cl > 10.5 && cl < 11.5) {
    a *= 0.7 + 0.3 * sin(t * 0.4 + r.x * 30.0);
  }
  return vec4(rgb, a);
}`,
  camera: { pos: [0, 0.5, 9.6], target: [0, 0.2, 0], fov: 35 },
  pointSize: 2.0,
  drift: 0.004,
}
export default form
