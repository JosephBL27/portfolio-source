// Stepped navigation (unit 7B). One gesture = one waypoint.
//
//   wheel / trackpad   deltas are summed (a leaky sum, 30 px) until they make a gesture; that gesture fires ONE step and the rest of it (a trackpad's inertia
//                      runs 1-2 s) is swallowed: a new gesture is a silence of 180 ms, a sign flip, or a spike above the tail. While a leg flies the wheel is
//                      locked until the leg is done (plus a short hold); a REVERSE gesture is allowed at once, so the flight can always be turned round.
//   Space / PageDown / ArrowDown   (Shift+Space / PageUp / ArrowUp back) one press = one step; held-key repeats are ignored; a press while a leg flies is kept
//                      and taken the moment the leg is done (one deep).
//   touch              a swipe up/down = one step (drag distance 40 px, or a quick flick); the page does not scroll under the finger.
//   magnet             scrubbing stays possible (Option/Alt + wheel, the scrollbar where there is one, a drag of the page): when the input stops with the flight
//                      mid-leg, it eases to the nearer dwell (280 ms of stillness first).
// A step moves the scroll goal to the waypoint's stop (so index jumps, the rail, deep links and the HUD all keep reading the same scroll) and starts a timed
// HOP on the follower: the authored leg time (flight.ts LEG_SECS), pre-roll and settle on either side. The page past the track (the index) scrolls natively.
import { stepTarget, waypointP, segmentAt, type FlightFollower } from '../world/flight'

export interface StepperOpts {
  follower: FlightFollower
  /** number of waypoints */
  count: number
  /** the scroll goal 0..1 (ui.progress) */
  progress(): number
  /** move the scroll goal to p; returns the p the browser settled on (whole pixels) */
  setProgress(p: number): number
  /** scroll distance of the track in px (the index starts below it) */
  range(): number
  reduced(): boolean
  /** a test pinned p with __v3.goto: stand down */
  forced(): boolean
  /** something modal is open (the case view) */
  blocked(): boolean
}
export interface StepEvent { t: number; via: 'wheel' | 'key' | 'touch' | 'magnet'; dir: 1 | -1; to: number }
export interface Stepper {
  frame(nowMs: number): void
  /** take one step by hand (tests, the hint) */
  step(dir: 1 | -1, via?: StepEvent['via']): boolean
  /** scrubbing settles to the nearer dwell when input stops; switch off for screenshot scripts that park the scroll mid-leg */
  magnet: boolean
  /** every step taken, oldest first */
  log: StepEvent[]
}

const THRESH = 30          // px of wheel travel that make a gesture (one mouse notch is 100; a light trackpad flick passes it in a few events)
const LEAK = 0.5           // s: the running sum forgets with this time constant (a slow deliberate drift still adds up; a finger's jitter does not)
const FRESH_GAP = 180      // ms of silence that ends a gesture (event time, so a busy frame cannot invent a gap)
const IDLE_SNAP = 280      // ms of stillness before the magnet takes hold
const SWIPE_PX = 40, FLICK_PX = 16, FLICK_V = 0.45 // touch: distance, or a short quick flick (px, px/ms)
const REVERSE_AFTER = 0.2  // s into a hop before a reverse gesture is taken

export function initStepper(o: StepperOpts): Stepper {
  const html = document.documentElement
  const f = o.follower
  const log: StepEvent[] = []
  const flags = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
  const enabled = flags.get('step') !== '0'
  const self: Stepper = { frame, step, magnet: flags.get('magnet') !== '0', log }

  const standing = () => o.forced() || o.reduced() // reduced motion: the goal snaps to the nearest waypoint in main, no hop
  const inTrack = () => window.scrollY <= o.range() + 4
  const overlayOpen = () => !!document.querySelector('dialog[open]') || html.classList.contains('is-loading') || html.classList.contains('in-index') || o.blocked()
  const scrollable = (el: Element | null) => {
    // a key event dispatched on `document` (or the window) has no style to read: only elements are asked
    for (let n = el; n && n.nodeType === 1 && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return true
    }
    return false
  }
  const live = (target: EventTarget | null) => enabled && !o.forced() && inTrack() && !overlayOpen() && !scrollable(target as Element | null)

  function step(dir: 1 | -1, via: StepEvent['via'] = 'key'): boolean {
    if (f.jump) return false
    const s = f.s
    const sg = segmentAt(s)
    // turned round while the camera is still in the dwell it was leaving (the pre-roll): settle back where we were, not on the waypoint behind
    const undo = !!f.hop && f.locked && f.hop.dir !== dir && sg.kind === 'dwell'
    const to = undo ? sg.i : stepTarget(s, dir)
    if (!undo && sg.kind === 'dwell' && to === sg.i) return false // the first / last waypoint: nowhere to go
    const p = o.setProgress(waypointP(to))
    if (!standing()) f.startHop(p)
    log.push({ t: performance.now(), via, dir, to })
    if (log.length > 400) log.shift()
    return true
  }
  /** may a gesture of this direction be taken now? (not while a leg flies, except a reverse of it) */
  const open = (dir: 1 | -1) => !f.locked || (!!f.hop && !f.jump && f.hop.dir !== dir && f.hop.t > REVERSE_AFTER)
  const atEnd = () => f.s >= waypointP(o.count - 1) - 1e-4 && !f.locked

  // ---------------- wheel ----------------
  let acc = 0, lastEv = -1e9, ema = 0, lastSign = 0, needFresh = true
  addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return // pinch zoom, and Option/Alt + wheel: a free scrub
    if (!live(e.target)) return
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1
    const dy = e.deltaY * unit, dx = e.deltaX * unit
    if (Math.abs(dx) > Math.abs(dy) || dy === 0) return
    const dir: 1 | -1 = dy > 0 ? 1 : -1
    if (dir > 0 && atEnd()) return // past the epilogue: the page scrolls on to the index
    e.preventDefault()
    const now = e.timeStamp, gap = now - lastEv, mag = Math.abs(dy)
    const fresh = gap > FRESH_GAP || Math.sign(dy) !== lastSign || mag > ema * 2.2 + 18
    ema = gap > FRESH_GAP ? mag : ema + (mag - ema) * 0.3
    lastEv = now; lastSign = Math.sign(dy)
    if (!open(dir)) { needFresh = true; acc = 0; return } // a leg is flying: swallow it
    if (fresh) { needFresh = false; acc = 0 } else if (needFresh) return // the tail of a gesture already taken
    acc = acc * Math.exp(-gap / 1000 / LEAK) + dy
    if (Math.abs(acc) >= THRESH) { acc = 0; needFresh = true; step(dir, 'wheel') }
  }, { passive: false })

  // ---------------- keys ----------------
  let pending: 1 | -1 | 0 = 0
  addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    if (!live(e.target) || (e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return
    const k = e.key
    let dir = 0
    if (k === 'ArrowDown' || k === 'PageDown') dir = 1
    else if (k === 'ArrowUp' || k === 'PageUp') dir = -1
    else if (k === ' ' && !(e.target as Element | null)?.closest?.('button, a[href], summary, [role="button"]')) dir = e.shiftKey ? -1 : 1
    if (!dir) return
    const d = dir as 1 | -1
    if (d > 0 && atEnd()) return // the last waypoint: leave it to ui.ts (it stays put)
    e.preventDefault()
    if (e.repeat) return
    if (open(d)) { pending = 0; step(d, 'key') } else if (!f.jump) pending = d
  }, true)

  // ---------------- touch ----------------
  let tId = -1, tx = 0, ty = 0, tt = 0, tDrag = false
  addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || !live(e.target)) { tId = -1; return }
    const t = e.touches[0]; tId = t.identifier; tx = t.clientX; ty = t.clientY; tt = performance.now(); tDrag = false
  }, { passive: true })
  addEventListener('touchmove', e => {
    if (tId < 0) return
    const t = [...e.touches].find(q => q.identifier === tId); if (!t) return
    const dy = t.clientY - ty, dx = t.clientX - tx
    if (!tDrag && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) tDrag = true
    if (tDrag && e.cancelable) e.preventDefault() // the finger steers a step, the page does not scroll under it
  }, { passive: false })
  const touchEnd = (e: TouchEvent) => {
    if (tId < 0) return
    const t = [...e.changedTouches].find(q => q.identifier === tId); if (!t) return
    tId = -1
    const dy = t.clientY - ty, dx = t.clientX - tx, ms = Math.max(1, performance.now() - tt)
    if (!tDrag || Math.abs(dy) < Math.abs(dx)) return
    if (Math.abs(dy) >= SWIPE_PX || (Math.abs(dy) >= FLICK_PX && Math.abs(dy) / ms >= FLICK_V)) {
      const dir: 1 | -1 = dy < 0 ? 1 : -1 // swipe up = next
      if (dir > 0 && atEnd()) return
      if (open(dir)) step(dir, 'touch')
    }
  }
  addEventListener('touchend', touchEnd, { passive: true })
  addEventListener('touchcancel', () => { tId = -1 }, { passive: true })

  // ---------------- per frame: queued key, magnet ----------------
  let held = false, lastG = -1, lastMove = 0
  addEventListener('pointerdown', () => { held = true }, true)
  addEventListener('pointerup', () => { held = false }, true)
  addEventListener('pointercancel', () => { held = false }, true)
  function frame(now: number) {
    if (!enabled) return
    if (pending && !f.locked && !f.jump && live(document.activeElement)) { const d = pending; pending = 0; step(d, 'key') }
    const g = o.progress()
    if (Math.abs(g - lastG) > 1e-6) { lastG = g; lastMove = now }
    if (!self.magnet || standing() || f.hop || f.jump || held || tId >= 0 || now - lastMove < IDLE_SNAP) return
    if (Math.abs(f.s - g) > 0.003 || !inTrack() || overlayOpen()) return // the follower has not caught up with the input yet
    const sg = segmentAt(g)
    if (sg.kind !== 'leg') return // inside a dwell the copy is already fully up: that is the rest the magnet is pulling toward
    const to = sg.loc >= 0.5 ? sg.i : sg.i - 1
    const p = o.setProgress(waypointP(to))
    f.startHop(p)
    log.push({ t: performance.now(), via: 'magnet', dir: to >= sg.i ? 1 : -1, to })
  }
  return self
}
