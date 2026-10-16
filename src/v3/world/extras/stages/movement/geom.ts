// Gear geometry for "The Movement" (watchdog stop): SVG path data for involute spur wheels and pinions, a club-tooth escape wheel, and the
// small helpers the layout needs (meshing phase, polar points, spirals).
//
// The involute flank is ported from the OpenJSCAD "Parametric Involute Gear" example (packages/examples/parameters/gear.js, MIT, Joost
// Nieuwenhuijse and Simon Clark; credits.json id "jscad-involute-gear"): circular pitch p = pi*m, addendum = m, dedendum = m + clearance,
// base radius = pitch radius * cos(pressure angle), tooth width at the base circle = pi/N + 2*inv(alpha_pitch), and the flank sampled with the
// same t^(2/3) spacing. What is new here: the 2D outline is traced as one closed SVG path (flank, tip arc, flank, root arc per tooth) instead
// of a union of extruded polygons, and the flank starts on the root circle when the root lies outside the base circle (N >= 42).
// The meshing phase is the standard tangency condition (OriginKit "Cog Train" states the same formula; read as a reference only, no code taken).
// Angles are in radians in screen convention (y down, so a positive angle turns clockwise), matching CSS rotate().

const TAU = Math.PI * 2
const f = (v: number) => (Math.round(v * 100) / 100).toString()
const pt = (r: number, a: number) => `${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`

export interface Involute { n: number; m: number; rp: number; rb: number; ro: number; rr: number; path: string }

/** a closed involute outline, tooth 0 centred on angle 0. `m` module (pitch radius = m*n/2), `pa` pressure angle in degrees, `clr` clearance in modules */
export function involute(n: number, m: number, pa = 20, clr = 0.25, steps = 5): Involute {
  const alpha = (pa * Math.PI) / 180
  const add = m, ded = m * (1 + clr)
  const rp = (m * n) / 2, rb = rp * Math.cos(alpha), ro = rp + add, rr = Math.max(rp - ded, m * 0.6)
  const tp = Math.sqrt(rp * rp - rb * rb) / rb
  const wb = Math.PI / n + 2 * (tp - Math.atan(tp))          // angular tooth width on the base circle
  const tMin = rr > rb ? Math.sqrt((rr / rb) ** 2 - 1) : 0
  let tMax = Math.sqrt(ro * ro - rb * rb) / rb
  const phi = (t: number) => t - Math.atan(t)
  while (phi(tMax) > wb / 2 && tMax > tMin) tMax *= 0.98       // pointed tooth: stop the flank where the two sides meet
  const rad = (t: number) => rb * Math.sqrt(1 + t * t)
  const tau = TAU / n
  let d = ''
  for (let k = 0; k < n; k++) {
    const c = k * tau, s = c - wb / 2, e = c + wb / 2
    // root (or radial drop from the base circle) leading into flank A
    const a0 = s + phi(tMin)
    if (k === 0) d += `M${pt(rr, rr < rb ? s : a0)}`
    if (rr < rb) d += `L${pt(rb, s)}`
    for (let i = 0; i <= steps; i++) {
      const t = tMin + (tMax - tMin) * Math.pow(i / steps, 2 / 3)
      d += `L${pt(rad(t), s + phi(t))}`
    }
    // tip arc
    d += `A${f(ro)} ${f(ro)} 0 0 1 ${pt(rad(tMax), e - phi(tMax))}`
    for (let i = steps; i >= 0; i--) {
      const t = tMin + (tMax - tMin) * Math.pow(i / steps, 2 / 3)
      d += `L${pt(rad(t), e - phi(t))}`
    }
    if (rr < rb) d += `L${pt(rr, e)}`
    // root arc to the next tooth's flank A
    const ns = c + tau - wb / 2, na = rr < rb ? ns : ns + phi(tMin)
    d += `A${f(rr)} ${f(rr)} 0 0 1 ${pt(rr, na)}`
  }
  return { n, m, rp, rb, ro, rr, path: d + 'Z' }
}

/** a circle as path data (for even-odd holes) */
export const circle = (r: number, cx = 0, cy = 0) => `M${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 1 ${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 1 ${f(cx + r)} ${f(cy)}Z`

/** curved wheel crossings (spokes) between the hub and the rim, as one stroked path */
export function crossings(k: number, rHub: number, rRim: number, bend = 0.32): string {
  let d = ''
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU, b = a + bend
    const mid = (rHub + rRim) / 2
    d += `M${pt(rHub * 0.9, a)}Q${pt(mid, a + bend * 0.35)} ${pt(rRim * 1.02, b)}`
  }
  return d
}

/** the Swiss club-tooth escape wheel (n teeth, turning clockwise in screen space so the teeth lean forward) */
export function escapeWheel(n: number, ro: number, rr: number): string {
  const tau = TAU / n
  let d = ''
  for (let k = 0; k < n; k++) {
    const a = k * tau
    const pts: [number, number][] = [
      [rr, a], [ro * 0.985, a + tau * 0.2], [ro, a + tau * 0.34], [ro * 0.93, a + tau * 0.44], [rr + (ro - rr) * 0.32, a + tau * 0.52], [rr, a + tau * 0.7],
    ]
    d += (k === 0 ? 'M' : 'L') + pts.map(([r, t]) => pt(r, t)).join('L')
    d += `A${f(rr)} ${f(rr)} 0 0 1 ${pt(rr, a + tau)}`
  }
  return d + 'Z'
}

/** phase (radians) that a child wheel of `nc` teeth must start at to mesh with a parent of `np` teeth at angle `thp`, the child's centre lying at direction `dir` from the parent */
export function meshPhase(thp: number, np: number, nc: number, dir: number): number {
  return dir + Math.PI - Math.PI / nc + (np / nc) * (dir - thp)
}

/** an Archimedean-ish spiral from r0 to r1 with `turns` turns; `bunch` > 1 crowds the coils toward the centre (a wound mainspring) */
export function spiral(r0: number, r1: number, turns: number, bunch = 1, a0 = 0, steps = 0): string {
  const n = steps || Math.max(48, Math.round(turns * 36))
  let d = ''
  for (let i = 0; i <= n; i++) {
    const u = i / n, r = r0 + (r1 - r0) * Math.pow(u, bunch), a = a0 + u * turns * TAU
    d += (i ? 'L' : 'M') + pt(r, a)
  }
  return d
}

export { TAU, pt }

// ------------------------------------------------------------------------------------------------ wave 24: crossed-out wheels, arcs, rings
/** the windows of a crossed-out wheel: `k` curved spokes of half-width `w` (units) between hub `rh` and rim `rr`, as even-odd holes.
 *  Each window is bounded by the hub arc, a spoke edge, the rim arc and the next spoke edge; `bend` (radians) sweeps the spokes. */
export function windows(k: number, rh: number, rr: number, w: number, bend = 0.38): string {
  let d = ''
  const tau = TAU / k
  for (let i = 0; i < k; i++) {
    const a0 = i * tau, a1 = a0 + tau
    const dh = w / rh, dr = w / rr
    const h0 = a0 + dh, h1 = a1 - dh, r0 = a0 + bend + dr, r1 = a1 + bend - dr
    const m = (rh + rr) / 2
    // hub arc (h0 -> h1), spoke edge out to the rim (h1 -> r1), rim arc back (r1 -> r0), spoke edge back in (r0 -> h0)
    d += `M${pt(rh, h0)}A${f(rh)} ${f(rh)} 0 0 1 ${pt(rh, h1)}`
    d += `Q${pt(m, a1 + bend * 0.38 - (dh + dr) / 2)} ${pt(rr, r1)}`
    d += `A${f(rr)} ${f(rr)} 0 0 0 ${pt(rr, r0)}`
    d += `Q${pt(m, a0 + bend * 0.38 + (dh + dr) / 2)} ${pt(rh, h0)}Z`
  }
  return d
}

/** an arc as path data from angle a0 to a1 (radians, clockwise) */
export const arcD = (r: number, a0: number, a1: number, cx = 0, cy = 0) =>
  `M${f(cx + r * Math.cos(a0))} ${f(cy + r * Math.sin(a0))}A${f(r)} ${f(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f(cx + r * Math.cos(a1))} ${f(cy + r * Math.sin(a1))}`

/** an annular sector (ring segment) as a closed path */
export const ringSector = (r0: number, r1: number, a0: number, a1: number) =>
  `M${pt(r1, a0)}A${f(r1)} ${f(r1)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(r1, a1)}L${pt(r0, a1)}A${f(r0)} ${f(r0)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 0 ${pt(r0, a0)}Z`

/** a section of an Archimedean spiral (r = r0 + pitch * turns) between radii ra and rb; used for the hairspring's breathing bands */
export function spiralBand(r0: number, pitch: number, ra: number, rb: number, a0 = 0): string {
  // r(theta) = r0 + pitch * theta / TAU
  const t0 = ((ra - r0) / pitch) * TAU, t1 = ((rb - r0) / pitch) * TAU
  const n = Math.max(24, Math.round(((t1 - t0) / TAU) * 64))
  let d = ''
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n, r = r0 + (pitch * t) / TAU
    d += (i ? 'L' : 'M') + pt(r, t + a0)
  }
  return d
}

/** the mainspring inside its barrel: `turns` coils from the arbor (ra) to the drum wall (rb); tension 1 packs the coils on the arbor, 0 against the wall */
export function mainspring(ra: number, rb: number, turns: number, tension: number): string {
  const n = Math.round(turns * 40)
  let d = ''
  const k = 0.3 + 3.6 * tension           // exponent: >1 crowds the coils onto the arbor (wound), <1 lets them out against the drum wall (let down)
  const inner = ra + (rb - ra) * (0.04 + 0.02 * (1 - tension)), outer = rb - (rb - ra) * (0.02 + 0.5 * tension * tension * 0.4)
  for (let i = 0; i <= n; i++) {
    const u = i / n, r = inner + (outer - inner) * Math.pow(u, k), a = u * turns * TAU
    d += (i ? 'L' : 'M') + pt(r, a)
  }
  // the last half-turn lies flat on the drum wall (the bridle)
  for (let i = 1; i <= 16; i++) { const a = turns * TAU + (i / 16) * Math.PI; d += 'L' + pt(rb - 1.5, a) }
  return d
}

// ------------------------------------------------------------------------------------------------ wave 24 fix: saw teeth and a one-piece hairspring
/** a ratchet wheel's saw ("wolf") teeth: each tooth rises along a gentle ramp on its low-angle side and drops radially on its high-angle side, so a click
 *  rides up the ramp when the wheel turns the winding way and drops behind the tooth when it tries to run back. `a0` turns the whole outline (radians). */
export function sawWheel(n: number, ro: number, rr: number, a0 = 0): string {
  const tau = TAU / n
  let d = ''
  for (let k = 0; k < n; k++) {
    const a = a0 + k * tau
    d += (k === 0 ? 'M' : 'L') + `${pt(rr, a)}L${pt(ro, a + tau * 0.86)}L${pt(ro * 0.985, a + tau * 0.9)}L${pt(rr, a + tau * 0.935)}A${f(rr)} ${f(rr)} 0 0 1 ${pt(rr, a + tau)}`
  }
  return d + 'Z'
}

/** the whole hairspring as ONE smooth path (Catmull-Rom through points of an Archimedean spiral from the collet at `r0` to the stud at `r1`, `pitch` units a coil).
 *  `alpha` (radians) carries the inner end round with the balance and falls off linearly to nothing at the stud, so the coils open and close as it swings. */
export function hairspring(r0: number, pitch: number, r1: number, alpha: number): string {
  const T = ((r1 - r0) / pitch) * TAU
  const n = Math.max(8, Math.ceil(T / (TAU / 9)))
  const px = new Array<number>(n + 1), py = new Array<number>(n + 1)
  for (let i = 0; i <= n; i++) {
    const t = (T * i) / n, r = r0 + (pitch * t) / TAU, a = t + alpha * (1 - t / T)
    px[i] = r * Math.cos(a); py[i] = r * Math.sin(a)
  }
  let d = `M${f(px[0])} ${f(py[0])}`
  for (let i = 0; i < n; i++) {
    const i0 = i > 0 ? i - 1 : 0, i3 = i + 2 <= n ? i + 2 : n
    d += `C${f(px[i] + (px[i + 1] - px[i0]) / 6)} ${f(py[i] + (py[i + 1] - py[i0]) / 6)} ${f(px[i + 1] - (px[i3] - px[i]) / 6)} ${f(py[i + 1] - (py[i3] - py[i]) / 6)} ${f(px[i + 1])} ${f(py[i + 1])}`
  }
  return d
}
