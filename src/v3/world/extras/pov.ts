// POV: click-drag on empty space swings the point of view.
// The camera orbits the flight's own target (cam.target) through adjustCam, so the flight is never fought: scroll still
// flies, and the moment the scroll moves (or after ~1.6 s idle) the view springs back onto the flight pose.
//   yaw  +-70 deg   pitch -15..+35 deg   damped follow while held, a short glide on release, critically damped return
// Drag right = the scene turns with the hand (the camera goes left); drag down = the camera rises.
// Also here: touch (one finger, horizontal: touch-action is pan-y so vertical still scrolls), keyboard (left / right nudge
// the orbit; [ and ] change the hub channel, P toggles its power) and the first-dwell hint beside the hub.
// Presses that land on a TV part belong to the world (world.hitTest); so does anything that is not the bare canvas.
// Events: pov:grab, pov:drag {speed}, pov:release {speed}, pov:return.
import type { Extra, ExtraCtx } from '../../main'
import { WAYPOINTS } from '../layout'

const RAD = Math.PI / 180
const YAW_MAX = 70 * RAD, PITCH_MIN = -15 * RAD, PITCH_MAX = 35 * RAD
const KX = 0.0034, KY = 0.0028          // rad per px
const TAP = 6                           // px before a press becomes a drag
const IDLE_BACK = 1.6                   // s of rest before the view returns by itself
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
/** analytic critically damped follower: returns [x, v] after dt (omega ~ 1 / time constant) */
const crit = (x: number, v: number, target: number, w: number, dt: number): [number, number] => {
  const d = x - target, e = Math.exp(-w * dt), tmp = (v + w * d) * dt
  return [target + (d + tmp) * e, (v - w * tmp) * e]
}

type Mode = 'rest' | 'drag' | 'hold' | 'return'
interface Grab { pid: number; x0: number; y0: number; yaw0: number; pitch0: number; moved: boolean; lx: number; ly: number; lt: number; vx: number; vy: number; touch: boolean; emitAt: number }

export function install(ctx: ExtraCtx): Extra | void {
  const canvas = ctx.canvas
  if (!canvas) return
  const html = document.documentElement
  const world = ctx.world as { hitTest?(x: number, y: number): { id: string } | null; markDrag?(a: boolean): void; screenRect?(id: string): DOMRect | null; nudgeChannel?(d: number): void; togglePower?(): void; zones?(): { copy: { l: number; t: number; r: number; b: number }[] }; tvRects?(): { id: string; l: number; t: number; r: number; b: number }[] } | null
  const rm = () => html.classList.contains('rm')
  const inHall = () => { const s = ctx.state(); return s.dwelling && WAYPOINTS[s.wp]?.id === 'hall' }

  let yaw = 0, pitch = 0, vYaw = 0, vPitch = 0      // what is drawn
  let tYaw = 0, tPitch = 0, iYaw = 0, iPitch = 0     // where it is heading, and the glide after a release
  let mode: Mode = 'rest', idleAt = 0, p0 = 0, grab: Grab | null = null   // idleAt: wall-clock ms of the last touch (the return waits on the clock, not on frames)
  const progress = (st: { p?: number }) => ctx.ui?.progress?.() ?? st.p ?? 0
  let lastP = 0
  // Reuse the Opus crag's fixed-eye look-around adapter; the baked ring supplies all bearings.
  let look = false
  const yawLim = () => look ? Infinity : YAW_MAX
  const pitchLo = () => look ? -35 * RAD : PITCH_MIN
  const pitchHi = () => look ? 60 * RAD : PITCH_MAX

  const startReturn = (quiet = false) => {
    if (mode === 'return' || mode === 'rest') return
    if (look) { const turn = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2; yaw -= turn; tYaw -= turn }
    if (!quiet && Math.abs(yaw) + Math.abs(pitch) > 0.02) ctx.emit('pov:return')
    mode = 'return'; iYaw = iPitch = 0
  }

  // ---- pointer
  canvas.style.touchAction = 'pan-y'
  const noSelect = (e: Event) => e.preventDefault()
  const onDown = (e: PointerEvent) => {
    if (inHall() || html.classList.contains('hall-photo')) return
    if (e.button !== 0 || !e.isPrimary || grab || e.target !== canvas) return
    if (html.classList.contains('is-loading') || html.classList.contains('in-index')) return
    if (world?.hitTest?.(e.clientX, e.clientY)) return                   // a TV part: the world owns this press
    grab = { pid: e.pointerId, x0: e.clientX, y0: e.clientY, yaw0: yaw, pitch0: pitch, moved: false, lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0, touch: e.pointerType === 'touch', emitAt: 0 }
    try { canvas.setPointerCapture(e.pointerId) } catch { /* the pointer is gone */ }
    document.addEventListener('selectstart', noSelect)
    html.classList.add('pov-drag')
  }
  const onMove = (e: PointerEvent) => {
    const g = grab
    if (!g || e.pointerId !== g.pid) return
    if (!g.moved) {
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < TAP) return
      g.moved = true; g.x0 = e.clientX; g.y0 = e.clientY; g.yaw0 = yaw; g.pitch0 = pitch     // no jump: the drag starts from here
      g.lx = e.clientX; g.ly = e.clientY; g.lt = performance.now()
      mode = 'drag'; iYaw = iPitch = 0; p0 = lastP
      world?.markDrag?.(true)
      ctx.emit('pov:grab')
      return
    }
    tYaw = clamp(g.yaw0 - (e.clientX - g.x0) * KX, -yawLim(), yawLim())
    tPitch = clamp(g.pitch0 + (e.clientY - g.y0) * (g.touch ? KY * 0.5 : KY), pitchLo(), pitchHi())
    const now = performance.now(), dtm = Math.max(1, now - g.lt) / 1000
    g.vx = g.vx * 0.6 + ((e.clientX - g.lx) / dtm) * 0.4
    g.vy = g.vy * 0.6 + ((e.clientY - g.ly) / dtm) * 0.4
    g.lx = e.clientX; g.ly = e.clientY; g.lt = now
    if (now - g.emitAt > 90) { g.emitAt = now; ctx.emit('pov:drag', { speed: clamp(Math.hypot(g.vx, g.vy) / 1800, 0, 1) }) }
  }
  const onUp = (e: PointerEvent) => {
    const g = grab
    if (!g || e.pointerId !== g.pid) return
    grab = null
    document.removeEventListener('selectstart', noSelect)
    try { canvas.releasePointerCapture(e.pointerId) } catch { /* already released */ }
    html.classList.remove('pov-drag')
    if (!g.moved) return
    const stale = performance.now() - g.lt > 90 || e.type === 'pointercancel'
    const sp = clamp(Math.hypot(g.vx, g.vy) / 1800, 0, 1)
    if (stale || rm()) { iYaw = 0; iPitch = 0 } else { iYaw = clamp(-g.vx * KX * 0.35, -4, 4); iPitch = clamp(g.vy * KY * 0.35, -2, 2) }
    if (mode === 'drag') { mode = 'hold'; idleAt = performance.now(); p0 = lastP }
    world?.markDrag?.(false)
    ctx.emit('pov:release', { speed: stale ? 0 : sp })
  }
  addEventListener('pointerdown', onDown)
  addEventListener('pointermove', onMove, { passive: true })
  addEventListener('pointerup', onUp)
  addEventListener('pointercancel', onUp)

  // ---- keyboard (capture: left / right are the orbit here, ahead of the waypoint stepper; up / down / page keys / space still step)
  const nudge = (dir: number) => {
    const base = mode === 'rest' || mode === 'return' ? yaw : tYaw
    tYaw = clamp(base + dir * 0.12, -yawLim(), yawLim())
    if (mode === 'rest' || mode === 'return') tPitch = pitch
    iYaw = iPitch = 0; mode = 'hold'; idleAt = performance.now(); p0 = lastP
    ctx.emit('pov:drag', { speed: 0.25 })
  }
  addEventListener('keydown', e => {
    if (inHall() || html.classList.contains('hall-photo')) return
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    if (document.querySelector('dialog[open]') || html.classList.contains('is-loading') || html.classList.contains('in-index')) return
    if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return
    const k = e.key
    if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); nudge(k === 'ArrowRight' ? 1 : -1) }
    else if (k === ']' || k === '[') { e.preventDefault(); world?.nudgeChannel?.(k === ']' ? 1 : -1) }
    else if ((k === 'p' || k === 'P') && !e.shiftKey) { e.preventDefault(); world?.togglePower?.() }
  }, true)

  // ---- first-dwell hint: a quiet pill, bottom centre, above the phone HUD's bottom 72 px (+ safe area): its bottom edge sits at innerHeight - 96 or higher
  const style = document.createElement('style')
  style.textContent = '#pov-hint { position: fixed; left: 0; top: 0; z-index: var(--z-anchors, 50); pointer-events: none; opacity: 0; white-space: nowrap; box-sizing: border-box; max-width: calc(100vw - 24px); overflow: hidden; text-overflow: ellipsis; padding: 6px 12px; border-radius: 999px; background: rgba(5, 5, 6, .72); color: var(--ink); font-size: 10.5px; line-height: 1.2; letter-spacing: .14em; transition: opacity .7s var(--ease-out, ease-out); will-change: transform, opacity }\n#pov-hint.on { opacity: .92 }\nhtml.rm #pov-hint { transition: none }'
  document.head.append(style)
  const hint = document.createElement('div')
  hint.id = 'pov-hint'; hint.className = 'mono'; hint.setAttribute('aria-hidden', 'true')
  const coarse = matchMedia('(pointer: coarse)')
  const hintText = () => (coarse.matches ? 'Drag to look around · Tap the screen' : 'Drag to look around · Turn the dial')
  hint.textContent = hintText()
  document.body.append(hint)
  let hintDone = false, hintShown = 0, hintOn = false
  const finishHint = () => { hintDone = true }
  const off = ctx.on(name => { if (name === 'pov:grab' || name === 'hub:detent' || name === 'tv:grab' || name === 'hub:button') finishHint() })
  const worldIdx = WAYPOINTS.findIndex(w => w.id === 'world')

  // test hook (like __v3.goto): the orbit offset in degrees, so a test can tell the view's own return apart from the camera rig's idle sway
  ;(window as unknown as { __pov?: unknown }).__pov = { state: () => ({ yawDeg: yaw / RAD, pitchDeg: pitch / RAD, mode, held: !!grab, look }) }

  return {
    adjustCam(cam, dt, st) {
      if (inHall() || html.classList.contains('hall-photo')) {
        yaw = pitch = vYaw = vPitch = tYaw = tPitch = iYaw = iPitch = 0; mode = 'rest'
        look = false
        return cam
      }
      lastP = progress(st)
      const here = st.dwelling && WAYPOINTS[st.wp]?.id === 'hold'
      if (here && !look && mode === 'rest') look = true
      else if (look && !here && mode === 'rest') look = false
      if (look && !here) startReturn()
      // the scroll moving on hands the view back to the flight at once
      if ((mode === 'hold' || mode === 'drag') && Math.abs(lastP - p0) > 0.0006) startReturn()
      if (mode === 'hold') {
        tYaw = clamp(tYaw + iYaw * dt, -yawLim(), yawLim()); tPitch = clamp(tPitch + iPitch * dt, pitchLo(), pitchHi())
        const f = Math.exp(-dt * 3.4); iYaw *= f; iPitch *= f
        if (!look && performance.now() - idleAt > IDLE_BACK * 1000) startReturn()
      }
      if (mode === 'return') { tYaw = 0; tPitch = 0 }
      const w = mode === 'drag' ? 20 : mode === 'return' ? (rm() ? 18 : 7.4) : 12
      if (mode !== 'rest') {
        ;[yaw, vYaw] = crit(yaw, vYaw, tYaw, w, dt)
        ;[pitch, vPitch] = crit(pitch, vPitch, tPitch, w, dt)
        if (mode === 'return' && Math.abs(yaw) < 1e-4 && Math.abs(pitch) < 1e-4 && Math.abs(vYaw) < 5e-4 && Math.abs(vPitch) < 5e-4) { yaw = pitch = vYaw = vPitch = tYaw = tPitch = 0; mode = 'rest' }
      }
      if (yaw === 0 && pitch === 0) return cam
      if (look) {
        const fx = cam.target[0] - cam.pos[0], fy = cam.target[1] - cam.pos[1], fz = cam.target[2] - cam.pos[2]
        const len = Math.hypot(fx, fy, fz), az = Math.atan2(fx, -fz) + yaw
        const el = clamp(Math.asin(clamp(fy / (len || 1), -1, 1)) + pitch, -1.35, 1.35), ce = Math.cos(el)
        return { ...cam, target: [cam.pos[0] + len * ce * Math.sin(az), cam.pos[1] + len * Math.sin(el), cam.pos[2] - len * ce * Math.cos(az)] }
      }
      // orbit about the flight's own target
      const tx = cam.target[0], ty = cam.target[1], tz = cam.target[2]
      const ox = cam.pos[0] - tx, oy = cam.pos[1] - ty, oz = cam.pos[2] - tz
      const r = Math.hypot(ox, oy, oz)
      if (r < 1e-4) return cam
      const az = Math.atan2(ox, oz) + yaw
      const el = clamp(Math.asin(clamp(oy / r, -1, 1)) + pitch, -1.35, 1.35)
      const ce = Math.cos(el)
      return { ...cam, pos: [tx + r * ce * Math.sin(az), ty + r * Math.sin(el), tz + r * ce * Math.cos(az)] as typeof cam.pos }
    },
    update(_t, dt, st) {
      // the hint: while we dwell at the world waypoint, until the visitor first drags / turns / presses anything
      const here = st.dwelling && st.wp === worldIdx && !html.classList.contains('is-loading') && mode === 'rest'
      const rect = here && !hintDone ? world?.screenRect?.('hub') ?? null : null
      const want = !!rect && !grab
      if (want && rect) {
        hintShown += dt
        if (hintShown > 14) finishHint()
        const txt = hintText()
        if (hint.textContent !== txt) hint.textContent = txt
        const hw = hint.offsetWidth || 260, hh = hint.offsetHeight || 26
        const x = innerWidth / 2
        let y = innerHeight - 96 - hh
        // on a phone the copy list fills the bottom: if the pill would sit on it, it rides just above the copy instead (never on the set itself)
        const pl = x - hw / 2, pr = x + hw / 2
        let top = Infinity
        for (const b of world?.zones?.().copy ?? []) if (b.l < pr && b.r > pl && b.t < y + hh && b.b > y) top = Math.min(top, b.t)
        if (top < Infinity) {
          const hub = world?.tvRects?.().find(r => r.id === 'hub')
          const y2 = top - 10 - hh
          if (!hub || y2 > hub.b + 6) y = y2
        }
        hint.style.transform = `translate3d(${(x - hw / 2).toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      }
      const on = want && !hintDone
      if (on !== hintOn) { hintOn = on; hint.classList.toggle('on', on) }
      void off
    },
  }
}
