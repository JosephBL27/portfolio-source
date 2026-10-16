// v20 colour grade. One look per area, authored as a handful of readable numbers, packed into a flat parameter vector so that a cross-fade along
// the flight is a single lerp (and a damped follow on the CPU) and the shader stays one constant-cost block.
//
// v20 (the colour regression fix): the v17-v19 grade ran a luminance-keyed gradient-map tint, a "colourise" that REPLACED the pixel's hue with the
// tint, a channel mixer, a selective desaturation outside one accent hue, a soft black point and a lifted colour floor. Measured at the secretary stop
// the five coloured arrows (red, blue, violet, green, yellow) came out one amber, the work stops went graphite, and the blacks were milk-navy. All of that is
// gone. What remains is deliberately barely there and cannot move a hue:
//
//   exposure -> gentle filmic shoulder (ACES-fit mixed in, a small share) -> white balance (a multiplicative gain, a few percent) -> contrast about a
//   mid-grey pivot -> gamma -> saturation + vibrance (never below 1: a look may add colour, never take it away).
//
// Halation (a faint fringe on hot edges), a faint anamorphic streak and the vignette live in post.ts's pass and read the numbers below. All of it is
// canvas-only: DOM text is never touched.
import type { AreaId } from '../world/layout'

export type LookId = AreaId | 'finale'
type V3 = [number, number, number]

export interface Look {
  note: string
  /** colour floor (only the legacy `?grade=old` uses it: every v20 look leaves it at 0 so the blacks stay black) */
  lift: V3
  /** white balance: a multiplicative gain, a few percent either way, so an area leans slightly warm or cool and no hue is replaced */
  gain: V3
  gamma: number
  contrast: number
  /** never below 1 */
  sat: number
  vibrance: number
  /** share of the ACES fit mixed into the display-referred picture (0 = none) */
  film: number
  /** halation and the anamorphic streak take the colour of the picture they bloom from (hue kept); these are only their amounts */
  halation: number
  streak: number
  /** multiplier on the vignette depth (a neutral darkening: the corners never fall toward a hue) */
  vig: number
  /** multiplier on the film grain (the base grain is 0.01, so this stays at or under 1.2) */
  grain: number
}

const NEUTRAL: Look = {
  note: 'neutral', lift: [0, 0, 0], gain: [1, 1, 1], gamma: 1, contrast: 1, sat: 1, vibrance: 0, film: 0,
  halation: 0, streak: 0, vig: 1, grain: 1,
}
const L = (o: Partial<Look>): Look => ({ ...NEUTRAL, ...o })
/** the shared base of every v20 look: a whisper of film curve and contrast, a touch of saturation, a faint halation and streak, no tint anywhere */
const BASE: Partial<Look> = { contrast: 1.04, sat: 1.1, vibrance: 0.2, film: 0.16, halation: 0.06, streak: 0.08, vig: 1.05 }

export const LOOKS: Record<LookId, Look> = {
  hub:       L({ ...BASE, note: 'neutral night, a hair cool', gain: [0.99, 1, 1.02] }),
  mind:      L({ ...BASE, note: 'a hair cool', gain: [0.98, 1, 1.03], sat: 1.3, vibrance: 0.4 }),
  systems:   L({ ...BASE, note: 'a hair warm', gain: [1.03, 1, 0.97] }),
  research:  L({ ...BASE, note: 'a hair warm', gain: [1.02, 1, 0.98], sat: 1.1 }),
  work:      L({ ...BASE, note: 'neutral', gain: [1, 1, 1.01], sat: 1.12 }),
  education: L({ ...BASE, note: 'warm candle', gain: [1.03, 1, 0.96], sat: 1.35, vibrance: 0.45 }),
  about:     L({ ...BASE, note: 'neutral, jewel tones, a deeper vignette and a firmer toe (the hall is an interior: its vault and corners stay near black, p5 <= 0.03 halfway through the gate)', gain: [1.01, 1, 0.99], sat: 1.08, vibrance: 0.3, contrast: 1.2, vig: 1.45 }),
  finale:    L({ ...BASE, note: 'a hair cool', gain: [0.98, 1, 1.03] }),
}

/** the pre-v17 grade (w12 lift / gamma / gain / saturation, nothing else): `?grade=old`, the "before" of the before / after shots */
export interface GradeSpec { lift: V3; gain: V3; gamma: number; sat: number; note: string }
export const OLD_GRADES: Record<AreaId, GradeSpec> = {
  hub:       { lift: [0, 0, 0],             gain: [1, 1, 1],          gamma: 1,    sat: 1,    note: 'neutral' },
  work:      { lift: [0.012, 0.005, 0.026], gain: [0.99, 0.99, 1.02], gamma: 1,    sat: 1.04, note: 'cool violet shadows' },
  systems:   { lift: [0.024, 0.004, 0.004], gain: [1.03, 0.99, 0.97], gamma: 1,    sat: 1.06, note: 'warm red highlights' },
  research:  { lift: [0.022, 0.004, 0.012], gain: [1.02, 0.99, 1.00], gamma: 1,    sat: 1.05, note: 'rose' },
  mind:      { lift: [0.002, 0.012, 0.028], gain: [0.98, 1.00, 1.03], gamma: 1,    sat: 1.04, note: 'cool blue' },
  education: { lift: [0.024, 0.016, 0.002], gain: [1.03, 1.01, 0.96], gamma: 1,    sat: 1.07, note: 'warm gold' },
  about:     { lift: [0.020, 0.015, 0.006], gain: [1.02, 1.01, 0.98], gamma: 0.99, sat: 1.03, note: 'warm ivory' },
}
export const OLD_LOOKS = Object.fromEntries((Object.keys(OLD_GRADES) as AreaId[]).map(k => [k, L({ ...OLD_GRADES[k] })])) as Record<LookId, Look>
OLD_LOOKS.finale = OLD_LOOKS.hub

// ---- the packed vector (the order is the contract between pack() and the uniform writer in post.ts)
export const N = 15
export const NEUTRAL_VEC = pack(NEUTRAL)
export function pack(l: Look, out: Float32Array | number[] = new Float32Array(N)): Float32Array | number[] {
  const v = [
    ...l.lift, ...l.gain, 1 / Math.max(0.5, l.gamma), l.contrast, l.sat, l.vibrance, l.film,
    l.halation, l.streak, l.vig, l.grain,
  ]
  for (let i = 0; i < N; i++) out[i] = v[i] ?? 0
  return out
}
// index map
export const I = { lift: 0, gain: 3, gamma: 6, contrast: 7, sat: 8, vibrance: 9, film: 10, halation: 11, streak: 12, vig: 13, grain: 14 } as const
