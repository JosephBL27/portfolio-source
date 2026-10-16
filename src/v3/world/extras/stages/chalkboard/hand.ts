// The hand of the Education chalkboard: lays Joseph's coursework out as single-stroke chalk handwriting and schedules the write-on.
// Pure geometry, no three.js and no DOM. src/data/handwriting-tech.json (EMS Tech, SIL OFL, scripts/gen-handwriting.mjs) gives the strokes of each
// character; the layout sets them on the board with a person's irregularities (a tilt per line, a baseline that wanders, letters a little off size and
// angle) and gives every stroke a chalk pressure profile (heavier where the stick lands, lighter where it lifts, with the odd skip). Two layouts: a wide
// board (desktop, 3.2 x 2.0) and a tall one (phone, 2.2 x 2.95), the same words in both.
// Board units, origin top-left, y down. The schedule (seconds) runs heading first, then the program, then the groups, then the two sketches.
export interface HandFont { upm: number; xHeight: number; capHeight: number; glyphs: Record<string, { adv: number; strokes: number[][] }> }
export interface CourseData {
  title: string
  program: { school: string; degrees: string[] }
  groups: { id: string; heading: string; courses: string[] }[]
}
export type Chalk = 'white' | 'pink' | 'blue'
export interface ChalkStroke { pts: Float32Array; cum: Float32Array; len: number; chalk: Chalk; w: number; t0: number; dur: number; seed: number; press: number; dot?: boolean }
export interface ChalkLine { label: string; strokes: ChalkStroke[]; t0: number; dur: number }
export interface Layout { lines: ChalkLine[]; total: number; W: number; H: number }
/** chalk as it reads on dark slate (display-referred sRGB): a warm white, a pale pink and a pale blue used only as accents */
export const CHALK: Record<Chalk, [number, number, number]> = { white: [240, 238, 228], pink: [244, 186, 192], blue: [176, 206, 240] }
export const WIDE = { W: 3.2, H: 2.0 }, TALL = { W: 2.2, H: 2.95 }
/** a font stroke shorter than this (font units, 1000 to the em) is a dot */
const DOT_LEN = 60
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

interface Raw { pts: number[]; chalk: Chalk; w: number; gap: number; press: number; dot?: boolean }   // gap: seconds the stick is lifted before this stroke
const lenOf = (p: number[]) => { let s = 0; for (let i = 2; i < p.length; i += 2) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return s }

/** the width of a string in board units at em size `em` (no jitter): for fitting lines */
export const measure = (font: HandFont, s: string, em: number) => [...s].reduce((w, ch) => w + (font.glyphs[ch]?.adv ?? 400), 0) * em / font.upm

export function layoutBoard(c: CourseData, font: HandFont, tall: boolean, seed = 7): Layout {
  const rnd = mulberry32(seed), jr = (a: number) => (rnd() - 0.5) * 2 * a
  type RawLine = { label: string; raws: Raw[]; gap: number }
  const lines: RawLine[] = []
  const { W, H } = tall ? TALL : WIDE

  /** one line of text: baseline y at x0, em size in board units; shrinks the em if the line would run past maxW */
  const text = (label: string, s: string, x0: number, y0: number, em: number, chalk: Chalk, w: number, o: { tilt?: number; lineGap?: number; maxW?: number; press?: number } = {}) => {
    if (o.maxW) { const mw = measure(font, s, em) * 1.03; if (mw > o.maxW) em *= o.maxW / mw }
    const k = em / font.upm, tilt = o.tilt ?? jr(0.011), raws: Raw[] = []
    let x = 0, wander = jr(em * 0.02), first = true
    for (const ch of s) {
      const g = font.glyphs[ch]
      if (!g) { x += 400 * k; continue }
      if (ch === ' ') { x += g.adv * k * (1.05 + jr(0.12)); continue }
      const rot = jr(0.045), sc = 1 + jr(0.035), dy = (wander += jr(em * 0.006)) + jr(em * 0.01)
      const cx = g.adv / 2, cr = Math.cos(rot), sr = Math.sin(rot)
      for (const st of g.strokes) {
        const pts: number[] = []
        for (let i = 0; i < st.length; i += 2) {
          const px = (st[i] - cx) * sc, py = st[i + 1] * sc
          const rx = px * cr - py * sr + cx, ry = px * sr + py * cr
          const X = x + rx * k, Y = -ry * k + dy
          pts.push(x0 + X, y0 + Y + X * tilt)
        }
        // a dot (the full stops of B.S., the top of the semicolon, the i): in the font it is a stroke a few units long, which becomes one dab of the stick
        // (the centre twice, drawn by chalk.ts as a small blot: no tooth, no holes, so it reads as a point however small the board is on screen)
        const dot = lenOf(st) < DOT_LEN
        if (dot) { let cx0 = 0, cy0 = 0; for (let i = 0; i < pts.length; i += 2) { cx0 += pts[i]; cy0 += pts[i + 1] } cx0 /= pts.length / 2; cy0 /= pts.length / 2; pts.length = 0; pts.push(cx0, cy0, cx0, cy0) }
        raws.push({ pts, chalk, w: w * (1 + jr(0.07)), gap: first ? 0 : 0.03 + rnd() * 0.022, press: (o.press ?? 1) * (0.86 + rnd() * 0.22), dot })
        first = false
      }
      x += g.adv * k * (1 + jr(0.025))
    }
    lines.push({ label, raws, gap: o.lineGap ?? 0.2 })
    return { w: x, em }
  }
  /** a chalk rule: a slightly bowed line with a wobble */
  const rule = (label: string, x0: number, x1: number, y: number, chalk: Chalk, w: number, o: { sag?: number; lineGap?: number; press?: number } = {}) => {
    const n = 26, pts: number[] = [], slope = jr(0.01)
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push(x0 + (x1 - x0) * t, y + (x1 - x0) * t * slope + Math.sin(t * Math.PI) * (o.sag ?? 0.006) + Math.sin(t * 9 + rnd() * 3) * 0.0016) }
    lines.push({ label, raws: [{ pts, chalk, w, gap: 0, press: o.press ?? 0.9 }], gap: o.lineGap ?? 0.18 })
  }
  const poly = (label: string, pts: number[], chalk: Chalk, w: number, gap = 0.06, press = 0.95) => { lines.push({ label, raws: [{ pts, chalk, w, gap: 0, press }], gap }) }
  const quad = (a: number[], q: number[], b: number[], n = 18) => { const o: number[] = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push(u * u * a[0] + 2 * u * t * q[0] + t * t * b[0] + jr(0.0012), u * u * a[1] + 2 * u * t * q[1] + t * t * b[1] + jr(0.0012)) } return o }

  /** supply and demand: two axes with arrowheads, the curves crossing, the equilibrium dotted down to the axes (Microeconomics) */
  const sketchSD = (AXX: number, AXY: number, TOPY: number, RIGHT: number, lab: number) => {
    const sw = (RIGHT - AXX), sh = (AXY - TOPY)
    poly('sd-y', [AXX, AXY + 0.004, AXX + 0.002, (AXY + TOPY) / 2, AXX, TOPY + 0.012], 'white', 0.0085, 0.05)
    poly('sd-ya', [AXX - 0.024, TOPY + 0.046, AXX, TOPY + 0.008, AXX + 0.024, TOPY + 0.046], 'white', 0.0085, 0.04)
    poly('sd-x', [AXX - 0.004, AXY, (AXX + RIGHT) / 2, AXY + 0.003, RIGHT - 0.01, AXY], 'white', 0.0085, 0.05)
    poly('sd-xa', [RIGHT - 0.042, AXY - 0.023, RIGHT, AXY, RIGHT - 0.042, AXY + 0.023], 'white', 0.0085, 0.05)
    poly('sd-S', quad([AXX + sw * 0.1, AXY - sh * 0.12], [AXX + sw * 0.5, AXY - sh * 0.25], [AXX + sw * 0.94, AXY - sh * 0.84]), 'blue', 0.0105, 0.07)
    poly('sd-D', quad([AXX + sw * 0.1, TOPY + sh * 0.2], [AXX + sw * 0.48, AXY - sh * 0.53], [AXX + sw * 0.94, AXY - sh * 0.15]), 'pink', 0.0105, 0.12)
    // where they cross (solved on the two quadratics by bisection on x)
    const at = (a: number[], q: number[], b: number[], t: number) => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * q[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * q[1] + t * t * b[1]]
    const Sa = [AXX + sw * 0.1, AXY - sh * 0.12], Sq = [AXX + sw * 0.5, AXY - sh * 0.25], Sb = [AXX + sw * 0.94, AXY - sh * 0.84]
    const Da = [AXX + sw * 0.1, TOPY + sh * 0.2], Dq = [AXX + sw * 0.48, AXY - sh * 0.53], Db = [AXX + sw * 0.94, AXY - sh * 0.15]
    let best = [0, 0], bd = 1e9
    for (let i = 0; i <= 200; i++) {
      // a point on S, then the point on D at the same x (D's x grows with t, so bisect), and keep the closest pair
      const s = at(Sa, Sq, Sb, i / 200)
      let lo = 0, hi = 1
      for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (at(Da, Dq, Db, m)[0] < s[0]) lo = m; else hi = m }
      const e = Math.abs(at(Da, Dq, Db, lo)[1] - s[1])
      if (e < bd) { bd = e; best = s }
    }
    const [ex, ey] = best
    lines.push({ label: 'sd-dot', raws: [{ pts: [ex - 0.006, ey, ex + 0.004, ey - 0.007, ex + 0.008, ey + 0.002, ex, ey + 0.008, ex - 0.007, ey + 0.001], chalk: 'white', w: 0.014, gap: 0, press: 1.1 }], gap: 0.05 })
    for (let i = 0; i < 3; i++) { const ya = ey + 0.025 + i * ((AXY - ey - 0.02) / 3); poly(`sd-gv${i}`, [ex + jr(0.002), ya, ex + jr(0.002), ya + 0.024], 'white', 0.007, 0.01, 0.7) }
    for (let i = 0; i < 4; i++) { const xa = AXX + 0.02 + i * ((ex - AXX - 0.04) / 4); poly(`sd-gh${i}`, [xa, ey + jr(0.002), xa + 0.028, ey + jr(0.002)], 'white', 0.007, 0.01, 0.7) }
    text('sd-P', 'P', AXX - 0.074 - lab * 0.7, TOPY + lab * 0.95, lab, 'white', 0.008, { tilt: 0, lineGap: 0.04 })
    text('sd-Q', 'Q', RIGHT - lab * 0.45, AXY + lab * 1.6, lab, 'white', 0.008, { tilt: 0, lineGap: 0.04 })
    text('sd-Sl', 'S', Sb[0] + 0.02, Sb[1] + lab * 0.25, lab, 'blue', 0.0085, { tilt: 0, lineGap: 0.04 })
    text('sd-Dl', 'D', Db[0] + 0.02, Db[1] + lab * 0.3, lab, 'pink', 0.0085, { tilt: 0, lineGap: 0.24 })
  }
  /** the standard normal density with its right tail hatched (Probability Theory): an axis, the bell, a few hatch strokes (no label: it reads at a glance) */
  const sketchNormal = (x0: number, base: number, wid: number, ht: number, lab: number) => {
    poly('nd-x', [x0 - 0.02, base, x0 + wid / 2, base + 0.003, x0 + wid + 0.02, base], 'white', 0.0085, 0.05)
    const bell: number[] = []
    const n = 34
    for (let i = 0; i <= n; i++) { const u = -3 + (6 * i) / n, x = x0 + ((u + 3) / 6) * wid, y = base - ht * Math.exp(-u * u / 2) - 0.004; bell.push(x + jr(0.0012), y + jr(0.0012)) }
    poly('nd-bell', bell, 'white', 0.0098, 0.08, 1)
    // the tail beyond 1.3 sigma, hatched in pale blue
    for (let i = 0; i < 5; i++) {
      const u = 1.35 + i * 0.32, x = x0 + ((u + 3) / 6) * wid, top = base - ht * Math.exp(-u * u / 2) - 0.006
      poly(`nd-h${i}`, [x - 0.012, base - 0.004, x + 0.004 + jr(0.002), top + 0.004], 'blue', 0.0068, 0.01, 0.75)
    }
    void lab
  }

  const M = 0.17
  if (!tall) {
    // ---- the wide board: heading and program across the top, the two sketches top right, then two columns ----
    const hd = text('school', c.program.school, M, 0.3, 0.15, 'white', 0.0125, { tilt: -0.004, lineGap: 0.1, press: 1.08 })
    rule('school-rule', M - 0.02, M + hd.w + 0.05, 0.36, 'white', 0.0095, { sag: 0.008, lineGap: 0.26 })
    text('deg-0', c.program.degrees[0] + ';', M, 0.53, 0.098, 'white', 0.0094, { lineGap: 0.12, maxW: 1.95 })
    text('deg-1', c.program.degrees[1], M, 0.67, 0.098, 'white', 0.0094, { lineGap: 0.32, maxW: 1.95 })
    const colX = [M, 1.75], top = 0.93, PITCH = 0.153, cem = 0.112, hem = 0.116
    const g0 = c.groups[0], rest = c.groups.slice(1)
    const heading = (g: CourseData['groups'][number], x: number, y: number) => {
      const r = text(`${g.id}-h`, g.heading, x, y, hem, 'white', 0.0104, { lineGap: 0.06, press: 1.05 })
      rule(`${g.id}-hr`, x - 0.01, x + r.w + 0.04, y + 0.04, 'pink', 0.0082, { sag: 0.004, lineGap: 0.16, press: 0.8 })
    }
    heading(g0, colX[0], top)
    g0.courses.forEach((cr, i) => text(`${g0.id}-${i}`, cr, colX[0], top + 0.165 + i * PITCH, cem, 'white', 0.0098, { lineGap: 0.14, maxW: 1.5 }))
    let y = top
    for (const g of rest) {
      heading(g, colX[1], y)
      g.courses.forEach((cr, i) => text(`${g.id}-${i}`, cr, colX[1], y + 0.165 + i * PITCH, cem, 'white', 0.0098, { lineGap: 0.14, maxW: 1.32 }))
      y += 0.165 + g.courses.length * PITCH + 0.02
    }
    sketchSD(2.32, 0.6, 0.12, 2.98, 0.085)
    sketchNormal(2.75, 1.46, 0.35, 0.25, 0.07)
  } else {
    // ---- the tall board (phone): one column for the heading, the program and Mathematics, then Economics and Finance side by side ----
    const hd = text('school', c.program.school, M - 0.03, 0.27, 0.13, 'white', 0.0118, { tilt: -0.004, lineGap: 0.1, maxW: W - 2 * M + 0.06, press: 1.08 })
    rule('school-rule', M - 0.05, M + hd.w + 0.02, 0.325, 'white', 0.009, { sag: 0.007, lineGap: 0.24 })
    // the program, wrapped by hand (the same words): "B.S. Computational and / Applied Mathematics; / B.A. Economics"
    const d0 = c.program.degrees[0], cut = d0.lastIndexOf(' and ') + 4
    text('deg-0a', d0.slice(0, cut), M, 0.47, 0.105, 'white', 0.0092, { lineGap: 0.1, maxW: W - 2 * M })
    text('deg-0b', d0.slice(cut + 1) + ';', M, 0.61, 0.105, 'white', 0.0092, { lineGap: 0.1, maxW: W - 2 * M })
    text('deg-1', c.program.degrees[1], M, 0.75, 0.105, 'white', 0.0092, { lineGap: 0.3, maxW: W - 2 * M })
    const PITCH = 0.15, cem = 0.125, hem = 0.118
    const heading = (g: CourseData['groups'][number], x: number, y: number) => {
      const r = text(`${g.id}-h`, g.heading, x, y, hem, 'white', 0.0102, { lineGap: 0.06, press: 1.05 })
      rule(`${g.id}-hr`, x - 0.01, x + r.w + 0.03, y + 0.042, 'pink', 0.008, { sag: 0.004, lineGap: 0.14, press: 0.8 })
    }
    const g0 = c.groups[0]
    let y = 0.96
    heading(g0, M, y)
    g0.courses.forEach((cr, i) => text(`${g0.id}-${i}`, cr, M, y + 0.172 + i * PITCH, cem, 'white', 0.0098, { lineGap: 0.12, maxW: W - 2 * M }))
    y += 0.172 + (g0.courses.length - 1) * PITCH + 0.2
    // Economics and Finance side by side at one size (the first draft squeezed the right column to 0.09 em). A title wider than its column is wrapped at its
    // last space, the way a person runs out of board: "Mathematical / Finance", "Financial / Accounting"
    const eem = 0.118, cols = [M, 1.3], colW = [cols[1] - cols[0] - 0.09, W - cols[1] - 0.08]
    c.groups.slice(1).forEach((g, gi) => {
      heading(g, cols[gi], y)
      let row = 0
      g.courses.forEach((cr, i) => {
        const sp = cr.lastIndexOf(' '), wrap = sp > 0 && measure(font, cr, eem) > colW[gi]
        for (const [k, part] of (wrap ? [cr.slice(0, sp), cr.slice(sp + 1)] : [cr]).entries()) {
          text(`${g.id}-${i}${k ? 'b' : ''}`, part, cols[gi], y + 0.168 + row * 0.15, eem, 'white', 0.0094, { lineGap: 0.12, maxW: colW[gi] })
          row++
        }
        row += 0.25      // a little air between titles, so a wrapped title is not mistaken for two
      })
    })
    sketchSD(1.52, 1.15, 0.8, 2.08, 0.07)
    void H
  }

  // ---- schedule: a stick moves at about 0.75 board units a second, lifts between strokes, pauses between lines ----
  const SPEED = 0.75
  const out: ChalkLine[] = []
  let t = 0.2, sid = 1
  for (const ln of lines) {
    const strokes: ChalkStroke[] = []
    const lt0 = t
    for (const r of ln.raws) {
      t += r.gap
      const len = lenOf(r.pts), dur = r.dot ? 0.07 : Math.max(0.05, len / SPEED * (0.9 + rnd() * 0.25))
      const n = r.pts.length / 2, pts = new Float32Array(r.pts), cum = new Float32Array(n)
      for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1])
      strokes.push({ pts, cum, len: cum[n - 1], chalk: r.chalk, w: r.w, t0: t, dur, seed: sid++ * 7919 + seed, press: r.press, dot: r.dot })
      t += dur
    }
    out.push({ label: ln.label, strokes, t0: lt0, dur: t - lt0 })
    t += ln.gap
  }
  // the whole board is written in about thirteen seconds after arrival: slower than the marker was, so the hand can be followed
  const TARGET = 13.2, k = TARGET / t
  for (const ln of out) { ln.t0 *= k; ln.dur *= k; for (const s of ln.strokes) { s.t0 *= k; s.dur *= k } }
  return { lines: out, total: TARGET + 0.2, W, H }
}

// ---------------------------------------------------------------------------------------------------------------- timing
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * Math.pow(x, 0.92)))
/** the fraction of a stroke that is down at global time t (a hand eases in and out of each stroke) */
export const strokeAt = (s: ChalkStroke, t: number) => ease((t - s.t0) / s.dur)
/** the point at arc length a along a stroke: x, y and the index of the segment's far end */
export function pointAt(s: ChalkStroke, a: number): [number, number, number] {
  const n = s.pts.length / 2
  let i = 1
  while (i < n - 1 && s.cum[i] < a) i++
  const c0 = s.cum[i - 1], c1 = s.cum[i], u = c1 > c0 ? Math.max(0, Math.min(1, (a - c0) / (c1 - c0))) : 1
  return [s.pts[i * 2 - 2] + (s.pts[i * 2] - s.pts[i * 2 - 2]) * u, s.pts[i * 2 - 1] + (s.pts[i * 2 + 1] - s.pts[i * 2 - 1]) * u, i]
}
