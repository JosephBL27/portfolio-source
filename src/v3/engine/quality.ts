// Quality planning + the adaptive governor for the particle field.
//
// Textures are built ONCE at the base particle count (a perfect square, so a form is a W x W
// texture). Lower tiers never rebuild anything: they draw every `stride`-th particle through an
// index buffer (a uniform subsample, so every form keeps its proportions), and the last tier also
// trims the pixel ratio. The governor watches the median frame time and steps down one tier when
// the site cannot hold ~45 fps.

export interface Tier {
  /** draw every stride-th particle */
  stride: number
  /** multiplier on the capped device pixel ratio */
  dprMul: number
  /** point-size multiplier that keeps the apparent density when particles are dropped */
  sizeMul: number
  /** extra additive gain (0 = none) to keep brightness when particles are dropped */
  gain: number
}

export interface QualityPlan {
  /** textures are built at this many particles (perfect square) */
  base: number
  phone: boolean
  /** device pixel ratio cap */
  dprCap: number
  tiers: Tier[]
}

/** nearest perfect square at or below n (a form is a W x W texture) */
export const snapSquare = (n: number) => { const w = Math.max(16, Math.floor(Math.sqrt(n))); return w * w }

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** phone-class device: coarse primary pointer or a narrow viewport */
export function isPhone(): boolean {
  if (typeof matchMedia !== 'function') return false
  return matchMedia('(pointer: coarse)').matches || innerWidth < 760
}

export function planQuality(count?: number): QualityPlan {
  const phone = isPhone()
  const base = snapSquare(count ?? (phone ? 65536 : 262144))
  const dprCap = phone ? 1.25 : 1.5
  const tiers: Tier[] = phone
    ? [
        { stride: 1, dprMul: 1, sizeMul: 1, gain: 0 },
        { stride: 2, dprMul: 1, sizeMul: 1.15, gain: 0.2 },
        { stride: 2, dprMul: 0.8, sizeMul: 1.15, gain: 0.2 },
      ]
    : [
        { stride: 1, dprMul: 1, sizeMul: 1, gain: 0 },
        { stride: 2, dprMul: 1, sizeMul: 1.15, gain: 0.22 },
        { stride: 4, dprMul: 1, sizeMul: 1.32, gain: 0.5 },
        { stride: 4, dprMul: 0.75, sizeMul: 1.32, gain: 0.5 },
      ]
  return { base, phone, dprCap, tiers }
}

/** Rolling frame-time window with median / p95, and the "drop a tier" decision. */
export class Governor {
  private buf: Float32Array
  private n = 0          // samples currently stored
  private head = 0
  private skip: number   // frames still to ignore (shader compile, texture upload, wake-ups)
  private since = 0
  constructor(private size = 90, private warmup = 60, private thresholdMs = 22) {
    this.buf = new Float32Array(size)
    this.skip = warmup
  }
  /** forget everything and ignore the next `frames` frames */
  reset(frames = this.warmup) { this.n = 0; this.head = 0; this.since = 0; this.skip = frames }
  /** feed one raw frame interval (ms). Returns true when the field should drop a tier. */
  push(ms: number): boolean {
    if (this.skip > 0) { this.skip--; return false }
    if (ms > 250) return false // tab switch / debugger stall, not load
    this.buf[this.head] = ms; this.head = (this.head + 1) % this.size; this.n = Math.min(this.size, this.n + 1)
    if (this.n < this.size) return false
    if (++this.since < 30) return false
    this.since = 0
    return this.median() > this.thresholdMs
  }
  private sorted(): Float32Array { return Float32Array.from(this.buf.subarray(0, this.n)).sort() }
  median(): number { if (!this.n) return 0; const s = this.sorted(); return s[(s.length - 1) >> 1] }
  p95(): number { if (!this.n) return 0; const s = this.sorted(); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] }
  max(): number { let m = 0; for (let i = 0; i < this.n; i++) m = Math.max(m, this.buf[i]); return m }
  get samples() { return this.n }
}
