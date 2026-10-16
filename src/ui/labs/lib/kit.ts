// Shared plumbing for the case-view labs (finder-organizer, second-brain, ...). No dependencies.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Every lab root carries data-proof="skip".
export interface LabOpts { emit(name: string, data?: any): void; reduced: boolean }
export interface LabHandle { dispose(): void }

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (t: number) => t * t * (3 - 2 * t)
export const easeOut3 = (t: number) => 1 - (1 - t) ** 3
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
export const TAU = Math.PI * 2
export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c])

/** deterministic PRNG so screenshots and reloads draw the same picture */
export function mulberry(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

/** the site's Pause switch: nothing may start moving on its own while it is on (a visitor's own drag or click still plays) */
export const sitePaused = () => document.documentElement.classList.contains('paused')

/** a cue that cannot fire faster than `ms` and never throws */
export function gate(emit: LabOpts['emit'], ms: number) {
  let last = -1e9
  return (name: string, data?: unknown) => {
    const t = performance.now(); if (t - last < ms) return
    last = t; try { emit(name, data) } catch { /* sound must never break the page */ }
  }
}

/** a damped spring on one number; semi-implicit Euler, stable for dt <= 1/30 */
export interface Spring { x: number; v: number; k: number; c: number }
export const spring = (x = 0, k = 140, c = 18): Spring => ({ x, v: 0, k, c })
export function stepSpring(s: Spring, target: number, dt: number) {
  const a = s.k * (target - s.x) - s.c * s.v
  s.v += a * dt; s.x += s.v * dt
  return s.x
}

/** fit a canvas to its box at devicePixelRatio (capped at 2); calls back with CSS-pixel size */
export function fitCanvas(canvas: HTMLCanvasElement, onSize: (w: number, h: number, dpr: number) => void) {
  const apply = () => {
    // layout size, not getBoundingClientRect: the case view scales its card while it opens and a lab may tilt in 3D, neither changes the layout box
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr) }
    onSize(w, h, dpr)
  }
  const ro = new ResizeObserver(apply); ro.observe(canvas); apply()
  return { refit: apply, dispose: () => ro.disconnect() }
}

/** an on-demand rAF loop: runs while the host is on screen and the tab is visible; `wake()` runs it again after it idled */
export function frameLoop(host: Element, step: (dt: number, now: number) => boolean | void) {
  let raf = 0, last = 0, visible = true, dead = false, running = false
  const tick = (ms: number) => {
    raf = 0
    if (dead) return
    const t = ms / 1000, dt = Math.min(1 / 24, last ? t - last : 1 / 60); last = t
    const more = step(dt, t)
    if (more !== false && visible && !document.hidden) raf = requestAnimationFrame(tick)
    else { running = false; last = 0 }
  }
  const wake = () => { if (dead || raf || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(tick) }
  const io = new IntersectionObserver(es => { visible = es[0]?.isIntersecting ?? true; if (visible) wake() }, { threshold: 0.01 })
  io.observe(host)
  const vis = () => { if (!document.hidden) wake() }
  document.addEventListener('visibilitychange', vis)
  return {
    wake,
    get running() { return running },
    get visible() { return visible },
    dispose() { dead = true; cancelAnimationFrame(raf); io.disconnect(); document.removeEventListener('visibilitychange', vis) },
  }
}

/** runs `cb` once when the host first shows at least `ratio` of itself; used to start a lab's first play */
export function onFirstView(host: Element, cb: () => void, ratio = 0.35) {
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); cb() } }, { threshold: ratio })
  io.observe(host)
  return () => io.disconnect()
}
