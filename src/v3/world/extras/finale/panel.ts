// The finale's DOM: the last stop IS the overview. The same page the O key opens (ui/overview.ts buildOverviewBody) shown inline over a quiet scrim: the
// contact first (both addresses, each with its own Copy; LinkedIn, GitHub, Replay the tour), then Experience, Education, every project and the credits.
// Facts only from src/data. It is one scroll container (overscroll contained, so the flight never moves under it), a labelled region for screen readers,
// and it is built once, in idle time, and only laid out while it is on screen.
import { animate, stagger } from 'animejs'
import type { Waypoint } from '../../layout'
import { buildOverviewBody } from '../../../ui/overview'
import { h } from '../../../ui/util'
import { attachSpotlight } from '../../../../ui/fx'

export interface PanelEnv {
  waypoints: Waypoint[]
  /** open a project's case study (the same call a TV makes) */
  open(projectId: string, el: HTMLElement | null): void
  /** fly to a waypoint id, an area id, a project id or 'world' */
  go(token: string): boolean
  replay(): void
  chime(): void
}
export interface Panel {
  root: HTMLElement
  /** show amount 0..1 (visibility + enter choreography) */
  setVis(v: number, reduced: boolean): void
  /** build the page now (the finale calls it in idle time; setVis calls it on first need) */
  warm(): void
  /** the ending is the page on screen and takes input */
  active(): boolean
  /** back to the top of the page, and the name takes focus */
  toTop(): void
}

/** the keys that scroll a page: with focus inside the ending they scroll it, and ui.ts must not read them as flight steps */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

export function buildPanel(env: PanelEnv): Panel {
  const html = document.documentElement
  const root = h('div', { class: 'fin', id: 'finale' })
  const scrim = h('div', { class: 'fin-scrim', 'aria-hidden': 'true' })
  const scroll = h('section', { class: 'fin-scroll', tabindex: -1, role: 'region', 'aria-labelledby': 'fin-h' })
  root.append(scrim, scroll)

  let built = false, bar: HTMLElement | null = null, title: HTMLElement | null = null, parts: HTMLElement[] = []
  const hud = () => parseFloat(getComputedStyle(root).getPropertyValue('--fin-hud')) || 80
  /** the sticky bits (the Projects bar, the left column) clear the HUD and the anchor row */
  const syncBar = () => {
    if (!bar) return
    root.style.setProperty('--ovw-bar', `${Math.round(hud() + bar.offsetHeight)}px`)
    const pj = scroll.querySelector<HTMLElement>('.ovw-pjbar')
    if (pj) root.style.setProperty('--fin-pj', `${pj.offsetHeight}px`)
  }

  const warm = () => {
    if (built) return
    built = true
    const body = buildOverviewBody({
      env: { waypoints: env.waypoints, open: env.open, go: env.go },
      idp: 'fin', scroller: () => scroll, inset: () => hud() + (bar?.offsetHeight ?? 44),
      inline: { replay: () => { env.chime(); env.replay() } },
    })
    title = body.title
    bar = h('div', { class: 'fin-bar' }, body.anchors)
    scroll.append(bar, h('div', { class: 'ovw-in fin-in' }, body.head, body.cols, body.credits, body.foot))
    attachSpotlight(scroll, '.ovw-row, .ovw-fact.is-go')
    const ro = new ResizeObserver(syncBar)
    ro.observe(bar); const pj = scroll.querySelector('.ovw-pjbar'); if (pj) ro.observe(pj)
    syncBar()
    // the first screen's pieces arrive one after another (the same set the dialog staggers)
    parts = [...scroll.querySelectorAll<HTMLElement>('.ovw-id > *, .ovw-contact, .ovw-side > section, .ovw-pjbar, .ovw-g:first-of-type .ovw-row')]
  }

  // ---- keys: with focus inside, the scroll keys scroll the page (not the flight); Escape backs out to the hub, like it does from inside an area
  scroll.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    if (SCROLL_KEYS.has(e.key) && !(e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) e.stopPropagation()
  })
  scroll.addEventListener('click', e => { if ((e.target as Element | null)?.closest?.('.cp')) env.chime() })

  // ---- show / hide
  let live = false, on = false, tl: ReturnType<typeof animate> | null = null, outT = 0
  const hide = () => parts.forEach(p => { p.style.opacity = '0' })
  const clear = () => parts.forEach(p => { p.style.opacity = ''; p.style.transform = '' })
  const enter = (rm: boolean) => {
    tl?.cancel(); tl = null
    if (rm) { clear(); return }
    hide()
    tl = animate(parts, { opacity: [0, 1], translateY: [16, 0], delay: stagger(36, { start: 60 }), duration: 640, ease: 'out(4)', onComplete: clear })
  }
  return {
    root,
    warm,
    active: () => on,
    toTop() {
      if (!on) return
      scroll.scrollTo({ top: 0, behavior: html.classList.contains('rm') ? 'auto' : 'smooth' })
      title?.focus({ preventScroll: true })
    },
    setVis(v, rm) {
      root.classList.toggle('rm', rm)
      const want = v > 0.02
      if (want && !built) warm()
      if (want !== live) {
        // dropping from the dwell to nothing in one frame (a jump to another stop): fade out over a moment instead of cutting
        const abrupt = !want && root.classList.contains('on') && !rm
        live = want
        clearTimeout(outT)
        if (want) { root.classList.remove('out'); root.classList.add('live'); if (!rm && !on) hide() }
        else if (abrupt) { root.classList.add('out'); root.style.setProperty('--v', '0'); outT = window.setTimeout(() => { root.classList.remove('live', 'out') }, 260) }
        else root.classList.remove('live')
      }
      if (want || !root.classList.contains('out')) root.style.setProperty('--v', String(Math.min(1, Math.max(0, v))))
      const nowOn = v > 0.82
      if (nowOn && !on) {
        on = true; root.classList.add('on'); html.classList.add('fin-on')
        enter(rm)
        // the ending is the page now: it takes focus on arrival (no ring), so the arrow keys, Space and PageUp / PageDown scroll it at once, and a screen reader is told where it is
        if (!document.querySelector('dialog[open]')) scroll.focus({ preventScroll: true })
      } else if (!nowOn && on && v < 0.55) {
        on = false; root.classList.remove('on'); html.classList.remove('fin-on')
        tl?.cancel(); tl = null
        scroll.scrollTop = 0
        if (!rm) hide()
      }
    },
  }
}
