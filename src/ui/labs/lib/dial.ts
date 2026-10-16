// One turnable dial for the reading instruments (the Metamorphoses compass, the Odyssey wheel): a sideways drag turns the ring, a fling
// carries on with the hand's own speed and lands on a mark, and the keys step one mark. Ported from ~/PORTFOLIO/src/sb/stages/dial.ts
// (Anime.js 4.5 createDraggable with mapTo rotate and snap). Anime.js owns the ring element's transform and nothing else.
// Release velocity is read off the pointer's own trail, because Anime's throw brakes, then surges, and ignores a flipped grab.
import { animate, createDraggable, spring, utils } from 'animejs'

export interface DialOptions {
  steps: number                        // marks around the ring
  reduce: boolean                      // the ring follows the finger, lets go without a throw, and keys turn it at once
  radius: number                       // mid radius of the grabbed marks as a fraction of the ring element's width
  start?: number
  onUpdate?: (deg: number) => void     // every drawn frame of the ring
  onPass?: (i: number) => void         // the mark under the window changes while the ring is held
  onLand: (i: number) => void          // the mark the ring will land on, the moment it is known
}
export interface Dial { step(dir: 1 | -1): void; jump(i: number): void; at(): number; revert(): void }

const SPEED = 0.5, THROW = 0.35, TAU = 0.1, MAX_THROW = 180, SPAN = 80, STALE = 50, RAD = 180 / Math.PI
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const carry = () => spring({ duration: 560, bounce: 0.14 })

export function createDial(ring: HTMLElement, o: DialOptions): Dial {
  const n = o.steps, STEP = 360 / n
  /** the ring turns anticlockwise to bring the next mark under the window */
  const bookAt = (deg: number) => ((Math.round(-deg / STEP) % n) + n) % n
  const snapTo = (deg: number) => Math.round(deg / STEP) * STEP
  const rest = -(o.start ?? 0) * STEP
  let aim = rest, from = rest, below = false, gain = SPEED, cancelled = false
  let tween: { cancel(): unknown; completed?: boolean } | null = null
  let trail: [number, number][] = []
  const land = (deg: number) => { aim = deg; o.onLand(bookAt(deg)) }

  const drag = createDraggable(ring, {
    x: { mapTo: 'rotate', snap: STEP, modifier: (v: number) => { o.onUpdate?.(v); return v } },
    y: false,                                              // touch-action: pan-y, the page still scrolls on touch
    container: [0, Infinity, 0, -Infinity],                // an unbounded turn
    dragSpeed: SPEED,
    velocityMultiplier: o.reduce ? 0 : THROW,
    maxVelocity: 1.2,
    releaseEase: o.reduce ? 'out(3)' : carry(),
    releaseStiffness: 300, releaseDamping: 30,
    cursor: { onHover: 'grab', onGrab: 'grabbing' },
    onGrab: (d: any) => { tween?.cancel(); tween = null; d.dragSpeed = below ? -gain : gain },
    onSnap: (d: any) => o.onPass?.(bookAt(d.destX)),
    onRelease: (d: any) => {
      if (cancelled) {
        cancelled = false
        const back = snapTo(from)
        if (o.reduce) d.animate.rotate(back, 240, 'out(3)')
        else { const s = carry(); d.animate.rotate(back, s.settlingDuration, s.ease) }
        land(back); return
      }
      if (o.reduce) { land(d.destX); return }
      const now = performance.now()
      const t = trail.filter(p => now - p[0] < SPAN), last = t[t.length - 1]
      const vx = t.length > 1 && now - last[0] < STALE ? (last[1] - t[0][1]) / (last[0] - t[0][0]) : 0
      const V = vx * d.dragSpeed * 1000
      const dest = snapTo(d.x + clamp(V * TAU, -MAX_THROW, MAX_THROW)), dist = dest - d.x
      const s = spring({ duration: 600, bounce: 0.06 })
      s.velocity = dist ? clamp(clamp(V, -MAX_THROW / TAU, MAX_THROW / TAU) / dist, 0, 1 / TAU) : 0
      d.animate.rotate(dest, s.settlingDuration, s.ease)
      land(dest)
    },
    onSettle: (d: any) => { if (tween && !tween.completed) return; land(d.x) },
  })
  drag.setX(rest, true)
  utils.set(ring, { rotate: rest })
  o.onUpdate?.(rest)

  const onMove = (e: PointerEvent) => { trail.push([e.timeStamp, e.clientX]); if (trail.length > 32) trail.shift() }
  const onEnd = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onEnd) }
  const onDown = (e: PointerEvent) => {
    drag.transforms.inversedMatrix = drag.transforms.getMatrix().inverse()      // the case card may still have been scaled when the dial was built
    const r = ring.getBoundingClientRect()
    below = e.clientY > r.top + r.height / 2
    // an <svg> has no offsetWidth: its layer, which is the same size and unturned, stands in
    gain = RAD / (o.radius * (ring.offsetWidth || ring.parentElement?.clientWidth || ring.clientWidth || 1))
    from = aim
    trail = [[e.timeStamp, e.clientX]]
    window.addEventListener('pointermove', onMove, { passive: true }); window.addEventListener('pointerup', onEnd)
  }
  const onCancel = () => { onEnd(); if (!drag.grabbed) return; cancelled = true; drag.handleUp() }
  ring.addEventListener('pointerdown', onDown); ring.addEventListener('pointercancel', onCancel)

  // keys tween a number into setX, so onUpdate runs exactly as it does for a drag
  const turnTo = (deg: number) => {
    if (drag.grabbed) return
    tween?.cancel(); tween = null
    if (drag.released) drag.stop()
    land(deg)
    if (o.reduce) { drag.setX(deg); return }
    const turn = { deg: drag.x }
    tween = animate(turn, { deg, ease: carry(), onUpdate: () => drag.setX(turn.deg) })
  }
  return {
    step: dir => turnTo(snapTo(aim) - dir * STEP),
    jump: i => { const fwd = (i - bookAt(aim) + n) % n; turnTo(snapTo(aim) - (fwd > n / 2 ? fwd - n : fwd) * STEP) },
    at: () => bookAt(aim),
    revert: () => { onEnd(); ring.removeEventListener('pointerdown', onDown); ring.removeEventListener('pointercancel', onCancel); tween?.cancel(); tween = null; try { drag.revert() } catch { /* already reverted */ } },
  }
}
