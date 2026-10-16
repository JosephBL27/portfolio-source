// v4 UI layer: ONE continuous scroll track + a fixed overlay layer + HUD + cursor + entry gate + index.
// The page scroll is the only input: progress() = scrollY over the track (SCROLL_VH, see track.ts).
// main feeds the flight state back in (setFlight), the projected TV positions (setAnchors) and the camera.
//   const ui = initV4UI({ waypoints: WAYPOINTS, onOpen, onEnter })
//   each frame: const p = ui.progress(); ...flight...; ui.setFlight(state); ui.setCamera(pos, target); ui.setAnchors(list)
import '@fontsource-variable/bodoni-moda/opsz.css'
import '@fontsource-variable/bodoni-moda/opsz-italic.css'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '../styles/tokens.css'
import '../styles/overlays.css'
import '../styles/hud.css'
import '../styles/nav.css'
import '../styles/autoplay.css'
import type { Waypoint } from '../world/layout'
import { state as appState } from '../../state'
import { initAnchors } from './anchors'
import { AREA_COPY, AREA_ORDER } from './copy'
import { initCursor } from './cursor'
import { buildIndex } from './epilogue'
import { CASE_REELS } from '../../reels/index'
import { buildHud, type RailStop } from './hud'
import { initLoader } from './loader'
import { initNav, type Nav } from './nav'
import { initTour } from './autoplay'
import { OverlayLayer } from './overlays'
import { Track } from './track'
import type { AnchorIn, FlightState, Vec3 } from './types'
import { clamp, fontsReady, h } from './util'

export type { AnchorIn, FlightState } from './types'

export interface V4UI {
  /** 0..1 over the one continuous scroll track (raw scroll, no smoothing; the flight smooths it) */
  progress(): number
  setFlight(state: FlightState): void
  setAnchors(list: AnchorIn[]): void
  setLoading(p: number): void
  ready(): void
  setCamera(pos: Vec3, target?: Vec3): void
  /** extras */
  jumpToArea(areaId: string): void
  /** navigation: go('work' | 'qvr' | 'school' | 'world' ...), the Index menu and the contact sheet (nav.ts) */
  readonly nav: Nav
  enter(withSound?: boolean): void
  readonly scrollVh: number
}

export interface V4Opts {
  waypoints: Waypoint[]
  onOpen(projectId: string, fromEl: HTMLElement | null): void
  onEnter(withSound: boolean): void
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function initV4UI(opts: V4Opts): V4UI {
  const { waypoints, onOpen, onEnter } = opts
  const html = document.documentElement
  html.classList.add('is-loading')
  try { history.scrollRestoration = 'manual' } catch { /* ignore */ }
  window.scrollTo(0, 0)

  // reduced motion: the OS setting or the app state
  const mq = matchMedia('(prefers-reduced-motion: reduce)')
  const syncRm = () => html.classList.toggle('rm', mq.matches || appState.reduced)
  syncRm(); mq.addEventListener('change', syncRm)
  const isRm = () => html.classList.contains('rm')

  let vw = innerWidth, vhPx = innerHeight
  const setVh = () => html.style.setProperty('--vh', vhPx + 'px')
  setVh()

  const track = new Track(waypoints)
  const ovArea = new Map<string, string>()
  waypoints.forEach(w => { if (!ovArea.has(w.overlay)) ovArea.set(w.overlay, w.area) })
  const areaOfOverlay = (id: string) => { const a = ovArea.get(id); return a && AREA_COPY[a] ? a : id === 'epilogue' ? 'epilogue' : 'prologue' }

  // ---- DOM
  let trackEl = document.getElementById('track')
  if (!trackEl) { trackEl = h('main', { id: 'track' }); document.body.append(trackEl) }
  trackEl.setAttribute('aria-label', 'Joseph Blumberg: portfolio')
  trackEl.setAttribute('role', 'presentation')
  let range = 1 // scroll distance of the track in px
  const measure = () => {
    range = Math.max(1, (track.scrollVh - 1) * vhPx)
    trackEl!.style.height = range + vhPx + 'px'
  }
  measure()

  // ---- jump (rail, links, Home/End) and step (keys): the flight follows; copy fades through
  let jumping = false, jumpT0 = 0, jumpTarget = '', jumpP = 0, jumpAreaId = ''
  let scrollAnim = 0
  const cancelAnim = () => { if (scrollAnim) { cancelAnimationFrame(scrollAnim); scrollAnim = 0 } }
  const progressNow = () => clamp(window.scrollY / Math.max(1, range))
  const overlayAt = (p: number) => waypoints[track.wpAt(p)].overlay
  const jumpTo = (p: number) => {
    cancelAnim()
    const wi = track.wpAt(p)
    jumpTarget = waypoints[wi].overlay; jumpP = p; jumpAreaId = areaOfOverlay(jumpTarget)
    if (Math.abs(p - progressNow()) < 0.004) return
    jumping = true; jumpT0 = performance.now(); html.classList.add('jumping')
    window.scrollTo({ top: p * range, behavior: 'auto' })
  }
  // a keyboard step sets the goal outright: the flight follower already flies it at the leg floor (no second easing on top)
  const stepTo = (p: number) => { cancelAnim(); window.scrollTo({ top: p * range, behavior: 'auto' }) }
  const jumpArea = (areaId: string) => {
    const i = waypoints.findIndex(w => w.area === areaId)
    if (i >= 0) jumpTo(track.stop(i))
  }
  const stops: RailStop[] = [{ id: 'prologue', label: 'Prooemium', numeral: '', p: 0 }]
  AREA_ORDER.forEach(a => {
    const i = waypoints.findIndex(w => w.area === a)
    if (i >= 0) stops.push({ id: a, label: AREA_COPY[a].kicker, numeral: AREA_COPY[a].numeral, p: track.stop(i) })
  })
  stops.push({ id: 'epilogue', label: 'Contact', numeral: '', p: track.stop(waypoints.length - 1) })
  const onStop = (s: RailStop) => jumpTo(s.p)

  // 10A: the autoplay tour flies the rail (jumpTo) through the best stops; it never touches the test hook
  const tour = initTour({ waypoints, fly: i => jumpTo(track.stop(i)), reduced: isRm, blocked: () => !!document.querySelector('dialog[open]') })
  const layer = new OverlayLayer(waypoints, {
    onOpen: (id, el) => onOpen(id, el), onJump: jumpArea,
    // 7C: the first screen's two actions. The tour starts with the establishing shot (the six areas); `nav` is created just below, before any click can land.
    onTour: () => { const i = waypoints.findIndex(w => w.id === 'world'); if (i >= 0) jumpTo(track.stop(i)) },
    onIndex: () => nav.openMenu(),
    onPlay: () => tour.start(),
    // 8C: the first screen's Overview button, and the stop chips on an area card
    onOverview: () => nav.openOverview(),
    onStop: id => { nav.go(id) },
  })
  trackEl.after(layer.root)
  const index = buildIndex({ onOpen: (id, el) => onOpen(id, el), onJump: jumpArea, onTop: () => jumpTo(0) })
  trackEl.after(index.el)

  // navigation that is always there: Index and Contact in the top bar, the ring radar, deep links, number keys, area labels in the world
  const hasCase = new Set<string>(CASE_REELS.map(r => r.projectId))
  const nav = initNav({ playTour: () => tour.toggle(), waypoints, fly: i => jumpTo(track.stop(i)), open: (id, el) => onOpen(id, el), canOpen: id => hasCase.has(id), blockers: () => layer.activeRects() })
  document.body.append(nav.labels)

  const anchorsRoot = h('div', { id: 'anchors', 'aria-hidden': 'true' })
  document.body.append(anchorsRoot)
  const anchors = initAnchors(anchorsRoot, (id, el) => onOpen(id, el))

  const hud = buildHud({ stops, onJump: onStop, onTop: () => jumpTo(0), nav })
  document.body.append(hud.el)
  const cursor = initCursor()
  const loader = initLoader(withSound => onEnter(withSound))

  // ---- layout
  const layoutAll = () => layer.layout(vw, vhPx)
  layoutAll()
  fontsReady().then(layoutAll)
  let rz = 0
  addEventListener('resize', () => {
    cancelAnimationFrame(rz)
    rz = requestAnimationFrame(() => {
      const wChanged = innerWidth !== vw, hBig = Math.abs(innerHeight - vhPx) > 120
      vw = innerWidth
      if (wChanged || hBig) { vhPx = innerHeight; setVh() }
      measure(); layoutAll()
    })
  })

  // ---- keyboard: a step is one waypoint (native arrows would move 40 px of a 30-screen track)
  const interactive = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')
  const onButtonLike = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('button, a[href], summary, [role="button"]')
  addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    if (document.querySelector('dialog[open]') || html.classList.contains('is-loading') || interactive(e.target)) return
    if (window.scrollY > range + 4) return // in the index: native scrolling
    const k = e.key
    let dir = 0
    if (k === 'ArrowDown' || k === 'PageDown' || k === 'ArrowRight') dir = 1
    else if (k === 'ArrowUp' || k === 'PageUp' || k === 'ArrowLeft') dir = -1
    else if (k === ' ' && !onButtonLike(e.target)) dir = e.shiftKey ? -1 : 1
    else if (k === 'Home') { e.preventDefault(); jumpTo(0); return }
    else if (k === 'End') { e.preventDefault(); jumpTo(track.stop(waypoints.length - 1)); return }
    if (!dir) return
    e.preventDefault()
    const p = progressNow()
    const cur = track.wpAt(p)
    const settled = Math.abs(p - track.stop(cur)) < 0.004 || (cur === 0 && p <= track.stop(0))
    let to = cur
    if (dir > 0) to = !settled && p < track.stop(cur) ? cur : cur + 1
    else to = !settled && p > track.stop(cur) ? cur : cur - 1
    to = clamp(to, 0, waypoints.length - 1)
    stepTo(track.stop(to))
  })
  for (const ev of ['wheel', 'touchstart'] as const) addEventListener(ev, cancelAnim, { passive: true })

  // ---- per-frame
  let cam: { pos: Vec3; target: Vec3 } | null = null
  let flight: FlightState = { overlay: waypoints[0].overlay, overlayNext: waypoints[0].overlay, overlayK: 0 }
  let lastT = 0, idxTop = Infinity, idxOn = false, areaNow = 'prologue'
  const loop = (now: number) => {
    requestAnimationFrame(loop)
    const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.016
    lastT = now
    cursor.update(dt)
    const p = progressNow()
    idxTop = range + vhPx
    const inIdx = window.scrollY + vhPx * 0.5 > idxTop
    if (inIdx !== idxOn) { idxOn = inIdx; html.classList.toggle('in-index', inIdx) }
    const fp = flight.p ?? p
    hud.update(areaNow, fp, fp, cam)
    nav.frame(areaNow, cam, jumping)
  }
  requestAnimationFrame(loop)

  return {
    scrollVh: track.scrollVh,
    progress: progressNow,
    setFlight(st) {
      flight = st
      const k = clamp(st.overlayK)
      if (jumping) {
        const arrived = (st.overlay === jumpTarget && (st.overlayNext === jumpTarget || k < 0.02)) || (st.overlayNext === jumpTarget && k > 0.98) || (st.p != null && Math.abs(st.p - jumpP) < 0.004)
        const now = performance.now()
        if ((arrived && now - jumpT0 > 320) || now - jumpT0 > 9000) { jumping = false; html.classList.remove('jumping') }
      }
      // the waypoint whose beat is current: the origin until the leg is half done, then the destination
      const wp = st.wp != null ? (st.next != null && k >= 0.5 ? st.next : st.wp) : track.wpAt(progressNow())
      layer.update(st, wp, jumping)
      nav.onFlight(st, jumping)
      hud.setFlight(st)
      // while a jump is flying, the HUD names the destination (it never strobes through the areas in between)
      areaNow = jumping ? jumpAreaId : st.area && AREA_COPY[st.area] ? st.area : areaOfOverlay(k < 0.5 ? st.overlay : st.overlayNext)
    },
    setAnchors(list) { anchors.set(list, layer.activeRects()) },
    setLoading(p) { loader.setLoading(p) },
    ready() { loader.ready() },
    setCamera(pos, target) { cam = { pos, target: target ?? cam?.target ?? [0, 0, 0] } },
    jumpToArea: jumpArea,
    nav,
    enter(withSound = false) { (document.querySelector('#loader .gate-btn' + (withSound ? '.primary' : ':not(.primary)')) as HTMLElement | null)?.click() },
  }
}
