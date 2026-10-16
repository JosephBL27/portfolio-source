// The dive (w11): click a stained-glass window and the camera flies INTO its glass; a flood of that window's light expands from the window's screen point, and at full cover
// the visit CUTS to the interest's own space (extras/hall.ts calls nav.go + follower.snap), then the flood drains to reveal it.
// This file holds the pieces with no scene access: the timeline maths and the full-screen flood element (#hall-flood: pointer-events none, above the canvas, below #hud).
//   push   0.9 s (0.6 s on a phone): the camera pushes at the glass on an ease-in cubic with the lens narrowing 6 degrees; the flood runs from nothing to full cover, arriving as the push ends
//   cut    one tick: the interest takes over (nav.go, snap)
//   wait   the flood holds until the target dwell is on screen (at least 0.3 s after the cut, at most 3 s)
//   drain  0.7 s: the flood opens up from the middle and fades
// Reduced motion: no push and no radial: a 0.25 s crossfade through the same flood, a 0.25 s drain.

export const easeInCubic = (t: number) => t * t * t
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

export type DivePhase = 'push' | 'wait' | 'drain'
export interface DiveRun {
  i: number
  phase: DivePhase
  t0: number            // ms: start of the push
  tCut: number          // ms: when the cut happened (0 until then)
  tDrain: number        // ms: when the drain began
  push: number          // seconds the push lasts
  x: number; y: number  // the window's screen point, px
  reduced: boolean
  /** the target waypoint index */
  target: number
}

export const PUSH_S = 0.9, PUSH_PHONE_S = 0.6, FADE_S = 0.25, DRAIN_S = 0.7, HOLD_MIN_S = 0.3, HOLD_MAX_S = 3.0

/** 0..1 push progress at `now` */
export const pushK = (d: DiveRun, now: number) => clamp01((now - d.t0) / 1000 / d.push)

export interface Flood { el: HTMLDivElement; show(d: DiveRun, now: number, rgb: [number, number, number]): void; hide(): void; on: boolean }

export function createFlood(): Flood {
  const el = document.createElement('div')
  el.id = 'hall-flood'; el.setAttribute('aria-hidden', 'true')
  document.body.append(el)
  let on = false
  const f: Flood = {
    el, get on() { return on },
    set on(v: boolean) { on = v },
    hide() { if (!on) return; on = false; el.classList.remove('on', 'drain'); el.style.removeProperty('--fr'); el.style.removeProperty('--fh'); el.style.removeProperty('--fo') },
    show(d, now, rgb) {
      const W = innerWidth, H = innerHeight
      const rMax = Math.hypot(Math.max(d.x, W - d.x), Math.max(d.y, H - d.y)) + 24
      let r = rMax, o = 1, hole = 0
      if (d.phase === 'push') {
        const k = pushK(d, now)
        if (d.reduced) { r = rMax; o = easeOutCubic(k) } else r = rMax * Math.pow(clamp01(k / 0.98), 1.6) // from a point to full cover, arriving as the push ends
      } else if (d.phase === 'drain') {
        const k = clamp01((now - d.tDrain) / 1000 / (d.reduced ? FADE_S : DRAIN_S))
        if (d.reduced) o = 1 - k
        else { hole = easeOutCubic(k) * Math.hypot(W, H) * 0.62; o = 1 - Math.pow(k, 2.2) }
      }
      if (!on) { on = true; el.classList.add('on') }
      el.classList.toggle('drain', d.phase === 'drain' && !d.reduced)
      const [R, G, B] = rgb
      const s = el.style
      s.setProperty('--fx', d.x.toFixed(1) + 'px'); s.setProperty('--fy', d.y.toFixed(1) + 'px')
      s.setProperty('--fr', r.toFixed(1) + 'px'); s.setProperty('--fh', hole.toFixed(1) + 'px'); s.setProperty('--fo', o.toFixed(3))
      s.setProperty('--fc', `${Math.round(R * 255)},${Math.round(G * 255)},${Math.round(B * 255)}`)
      s.setProperty('--fcd', `${Math.round(R * 120)},${Math.round(G * 120)},${Math.round(B * 120)}`)
    },
  }
  return f
}
