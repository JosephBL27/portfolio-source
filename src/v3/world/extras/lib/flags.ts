// Shared helpers for the atmosphere extras (glyphs, mirror, rings).
//   ?extras=0            skip every extra that honours the flag (measurement: "all off")
//   ?extras=-mirror      skip just that one (also -glyphs, -rings; comma separated: -mirror,-rings)
//   ?extras=glyphs       run ONLY the listed extras
import { state } from '../../../../state'

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()

export function extraOn(name: string): boolean {
  const q = params.get('extras')
  if (q == null || q === '') return true
  if (q === '0' || q === 'off' || q === 'none') return false
  const parts = q.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.includes('-' + name)) return false
  const only = parts.filter(s => !s.startsWith('-') && s !== '1' && s !== 'all')
  return only.length ? only.includes(name) : true
}

/** a phone / touch-first device: smaller counts, no reflection */
export const isPhone = () => typeof innerWidth === 'number' && (innerWidth <= 760 || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse) and (max-width: 1100px)').matches))
export const reducedMotion = () => state.reduced || (typeof document !== 'undefined' && document.documentElement.classList.contains('rm'))

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
export const damp = (cur: number, goal: number, tau: number, dt: number) => goal + (cur - goal) * Math.exp(-dt / Math.max(1e-4, tau))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** deterministic rng (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// ---- measurement hooks (window.__atmos): flip an extra on/off at runtime, and read the CPU ms its update() costs (smoothed)
interface AtmosHooks { on: Record<string, boolean>; cpu: Record<string, number> }
export const atmos: AtmosHooks = (() => { const w = window as unknown as { __atmos?: Partial<AtmosHooks> & Record<string, unknown> }; const a = (w.__atmos ??= {}); a.on ??= {}; a.cpu ??= {}; return a as unknown as AtmosHooks })()
export const isOn = (name: string) => atmos.on[name] !== false
/** time one update() call and fold it into window.__atmos.cpu[name] */
export function timed<A extends unknown[]>(name: string, fn: (...a: A) => void) {
  return (...a: A) => { const t0 = performance.now(); fn(...a); const ms = performance.now() - t0; atmos.cpu[name] = (atmos.cpu[name] ?? ms) * 0.95 + ms * 0.05 }
}
