// Unit 10A: the recruiter's autoplay tour. "Watch the tour" flies the existing rail through the best stops on its own, one plain
// caption per stop (every caption is verbatim data/copy: projects.json lines, site.json, the education body). Any wheel, key, pointer or touch
// outside the tour's own controls ends it where the visitor is (the leg in flight lands, nothing snaps back); Esc ends it too.
// It moves the camera only through env.fly (the rail jump in ui.ts), never through the test hook.
import { animate, stagger } from 'animejs'
import type { Waypoint } from '../world/layout'
import { AREA_COPY, AREA_NAME, AREA_ORDER, AREA_PLAIN, SITE, projOf } from './copy'
import { h } from './util'

export interface TourEnv {
  waypoints: Waypoint[]
  /** fly to waypoint i (the rail jump) */
  fly(i: number): void
  reduced(): boolean
  /** something modal is open: do not start */
  blocked(): boolean
}
export interface Tour { start(): void; stop(): void; toggle(): void; readonly running: boolean }

const parts = SITE.offBoard.split(', ')
const line = (id: string) => projOf(id)?.line ?? ''
/** the stops, in order of what a recruiter should meet first: waypoint id and its one-line caption. Every caption is data (projects.json lines, site.json, the area names in copy.ts). */
const ROUTE = AREA_ORDER.map(a => AREA_NAME[a] ?? a).join(', ')
const STOPS: { id: string; say: () => string }[] = [
  { id: 'name', say: () => SITE.claim },
  { id: 'world', say: () => `Six areas, in this order: ${ROUTE}.` },
  { id: 'surface', say: () => line('qvr') },
  { id: 'cloudflare', say: () => line('cloudflare') },
  { id: 'secretary', say: () => line('secretary') },
  { id: 'drill', say: () => line('zeta') },
  { id: 'market', say: () => line('love-island') },
  { id: 'mind', say: () => line('second-brain') },
  { id: 'school', say: () => AREA_COPY.education.body },
  // the gate (outside the hall's closed doors) gets the plain area line; the next stop is the adjacent waypoint, flown as ONE leg so the doors set piece plays
  { id: 'gate', say: () => AREA_PLAIN.about },
  { id: 'hall', say: () => parts.slice(0, 2).join(', ') + '.' },
  { id: 'records', say: () => (parts[3] ? parts[3].replace(/^and\s+/i, '') : '') },
  // the contact finale carries its own card (email, copy, links), so the tour adds no caption there and hands over to it
  { id: 'epilogue', say: () => '' },
]
/** the waypoint ids of the tour, in order (tests print it) */
export const TOUR_STOPS = STOPS.map(s => s.id)

const FLY_MAX = 5200           // ms: give up waiting for a flight to report arrival
const FLY_MAX_DOORS = 9000    // the gate-to-hall leg holds the 5 s doors set piece, so it waits longer
const dwellMs = (s: string) => Math.min(8200, Math.max(3600, 2300 + s.length * 40))

export function initTour(env: TourEnv): Tour {
  const html = document.documentElement
  const idx = STOPS.map(s => env.waypoints.findIndex(w => w.id === s.id))
  const list = STOPS.map((s, k) => ({ ...s, wp: idx[k] })).filter(s => s.wp >= 0)

  const fill = h('i', { class: 'tr-fill' })
  const ticks = h('div', { class: 'tr-ticks', 'aria-hidden': 'true' }, ...list.map(() => h('i')))
  const bar = h('div', { class: 'tr-bar', role: 'progressbar', 'aria-label': 'Tour progress', 'aria-valuemin': '0', 'aria-valuemax': String(list.length), 'aria-valuenow': '0' }, fill, ticks)
  const say = h('p', { class: 'tr-say' })
  const live = h('p', { class: 'sr', 'aria-live': 'polite' })
  const nEl = h('span', { 'data-proof': 'skip' })
  const status = h('p', { class: 'tr-st mono' }, 'Tour ', nEl, ' · Space to pause · Esc to leave')
  const bPause = h('button', { type: 'button', class: 'tr-b mono', 'data-cursor': '', 'aria-label': 'Pause the tour' }, 'Pause')
  const bSkip = h('button', { type: 'button', class: 'tr-b mono', 'data-cursor': '', 'aria-label': 'Skip to the next stop' }, 'Skip')
  const bEnd = h('button', { type: 'button', class: 'tr-b mono', 'data-cursor': '', 'aria-label': 'End the tour, Escape' }, 'End', h('kbd', { class: 'mono', 'aria-hidden': 'true', text: 'Esc' }))
  const root = h('section', { id: 'tour', class: 'tour', hidden: true, 'aria-label': 'Guided tour' }, say, live, status, h('div', { class: 'tr-row' }, bar, bPause, bSkip, bEnd))
  document.body.append(root)

  let running = false, paused = false, skip = false, run = 0, t0 = 0
  let sIdx = 0, frac = 0, raf = 0, synth = false
  const norm = (t: string) => t.replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim().toLowerCase()
  /** the title and claim text the visible overlay already shows: a caption that repeats one of them is dropped */
  const onScreen = () => {
    const out = new Set<string>()
    document.querySelectorAll<HTMLElement>('.ov.vis .title, .ov.vis .claim, .ov.vis .claim-line').forEach(e => { out.add(norm(e.getAttribute('aria-label') || e.textContent || '')) })
    return out
  }
  const setPause = (p: boolean) => {
    paused = p
    bPause.textContent = p ? 'Play' : 'Pause'; bPause.setAttribute('aria-label', p ? 'Resume the tour' : 'Pause the tour')
    root.classList.toggle('paused', p)
  }
  // the panel's height lifts anything docked above it (the crate of songs)
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => html.style.setProperty('--tour-h', root.offsetHeight + 'px')) : null

  const sleep = (ms: number, tok: number) => new Promise<void>(res => setTimeout(res, ms)).then(() => tok === run)
  const setBar = () => {
    fill.style.transform = `scaleX(${Math.min(1, (sIdx + frac) / list.length)})`
    bar.setAttribute('aria-valuenow', String(Math.min(list.length, sIdx + (frac >= 1 ? 1 : 0))))
  }
  const showSay = (text: string, accent: string) => {
    root.style.setProperty('--tr-a', accent)
    say.replaceChildren(...text.split(' ').map((w, k, a) => h('span', { class: 'tr-w', 'aria-hidden': 'true' }, w + (k < a.length - 1 ? ' ' : ''))))
    live.textContent = text
    if (!env.reduced()) animate(say.querySelectorAll('.tr-w'), { opacity: [0, 1], translateY: [9, 0], filter: ['blur(5px)', 'blur(0px)'], delay: stagger(34), duration: 520, ease: 'outExpo' })
  }
  const hideSay = async () => {
    if (env.reduced()) { say.replaceChildren(); return }
    const a = animate(say, { opacity: [1, 0], duration: 240, ease: 'outQuad' })
    await new Promise<void>(r => setTimeout(r, 250)); a.cancel(); say.style.opacity = ''; say.replaceChildren()
  }

  /** wait for the rail jump to report arrival: the `jumping` class goes up with the flight and comes down on landing */
  async function arrive(tok: number, max = FLY_MAX) {
    const t = performance.now()
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    const rm = env.reduced()
    while (tok === run && !skip && html.classList.contains('jumping') && performance.now() - t < (rm ? 1200 : max)) await new Promise<void>(r => setTimeout(r, 60))
    return tok === run
  }
  /** the camera's flight state, read only to know when a leg has landed (the tour never moves the camera through it) */
  const flightNow = (): { wp: number; next: number; dwelling: boolean } | null => {
    try { return (window as unknown as { __v3?: { state?: () => { wp: number; next: number; dwelling: boolean } } }).__v3?.state?.() ?? null } catch { return null }
  }
  /** one keyboard step to the adjacent waypoint `to`: the stepper flies the leg at its authored length (the doors set piece runs); if the stepper declines, fall back to the rail jump */
  async function stepLeg(to: number, tok: number) {
    synth = true
    try { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true })) } finally { synth = false }
    await new Promise<void>(r => setTimeout(r, 380))
    if (tok !== run) return false
    const s0 = flightNow()
    if (s0 && s0.dwelling && s0.wp !== to) env.fly(to)
    if (!s0) { await new Promise<void>(r => setTimeout(r, env.reduced() ? 1200 : 5800)); return tok === run }
    const t = performance.now()
    while (tok === run && !skip && performance.now() - t < (env.reduced() ? 2000 : FLY_MAX_DOORS)) {
      const s = flightNow()
      if (s && s.dwelling && s.wp === to) break
      await new Promise<void>(r => setTimeout(r, 80))
    }
    return tok === run
  }
  /** a dwell that a pause freezes and a skip cuts short; drives the progress fill */
  async function dwell(ms: number, tok: number) {
    let left = ms, last = performance.now()
    while (left > 0 && tok === run && !skip) {
      await new Promise<void>(r => (raf = requestAnimationFrame(() => r())))
      const now = performance.now(), dt = now - last; last = now
      if (!paused) left -= dt
      frac = 0.18 + 0.82 * (1 - Math.max(0, left) / ms); setBar()
    }
    return tok === run
  }

  async function play(tok: number) {
    for (sIdx = 0; sIdx < list.length; sIdx++) {
      const s = list[sIdx]
      skip = false; frac = 0; setBar()
      nEl.textContent = `${sIdx + 1}/${list.length}`
      // gate -> hall: the very next waypoint, so it is flown as ONE authored leg (a step, not a rail jump, which is capped at 2.8 s): the 5 s doors set piece plays
      const doors = s.id === 'hall' && sIdx > 0 && list[sIdx - 1].id === 'gate' && s.wp === list[sIdx - 1].wp + 1
      if (doors) { if (!(await stepLeg(s.wp, tok))) return }
      else { env.fly(s.wp); frac = 0.04; setBar(); if (!(await arrive(tok))) return }
      frac = 0.04; setBar()
      if (s.id === 'epilogue') { frac = 1; setBar(); if (tok === run) { live.textContent = 'The tour is over. Contact is on screen.'; await sleep(900, tok); if (tok === run) end(true) } return }
      if (skip) { frac = 1; setBar(); continue }
      const text = s.say() && !onScreen().has(norm(s.say())) ? s.say() : ''
      if (text) showSay(text, AREA_COPY[env.waypoints[s.wp].area]?.accent ?? '#EDE6D6')
      else root.style.setProperty('--tr-a', AREA_COPY[env.waypoints[s.wp].area]?.accent ?? '#EDE6D6')
      if (!(await dwell(text ? dwellMs(text) : 2400, tok))) return
      frac = 1; setBar()
      if (sIdx < list.length - 1) await hideSay()
      if (tok !== run) return
    }
  }

  function end(done = false) {
    if (!running) return
    running = false; run++; cancelAnimationFrame(raf)
    removeEventListener('wheel', onInput, true); removeEventListener('keydown', onKey, true)
    removeEventListener('pointerdown', onInput, true); removeEventListener('touchstart', onInput, true)
    html.classList.remove('touring'); html.style.removeProperty('--tour-h'); ro?.disconnect()
    setPause(false)
    root.classList.remove('on')
    setTimeout(() => { if (!running) { root.hidden = true; say.replaceChildren(); live.textContent = '' } }, env.reduced() ? 0 : 420)
    if (done) live.textContent = 'The tour is over.'
  }
  const own = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('#tour, .is-tour')
  function onInput(e: Event) {
    if (own(e.target) || e.timeStamp <= t0) return
    end()
  }
  function onKey(e: KeyboardEvent) {
    if (synth) return // the tour's own step key (stepLeg)
    if (own(e.target) && (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ')) return // the tour's own buttons keep working from the keyboard
    if (e.key === 't' || e.key === 'T') return // nav's T toggles (it ends the tour)
    if (e.key === ' ' && !own(e.target)) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) setPause(!paused); return } // Space pauses
    if (e.timeStamp <= t0 || (e.repeat && e.timeStamp - t0 < 400)) return
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return
    end()
  }

  function start() {
    if (running || env.blocked() || html.classList.contains('is-loading') || !list.length) return
    running = true; paused = false; skip = false; sIdx = 0; frac = 0; t0 = performance.now()
    const tok = ++run
    setPause(false)
    html.classList.add('touring')
    root.hidden = false; setBar(); ro?.observe(root)
    requestAnimationFrame(() => root.classList.add('on'))
    addEventListener('wheel', onInput, { capture: true, passive: true }); addEventListener('keydown', onKey, true)
    addEventListener('pointerdown', onInput, true); addEventListener('touchstart', onInput, { capture: true, passive: true })
    void play(tok)
  }
  bPause.addEventListener('click', () => setPause(!paused))
  bSkip.addEventListener('click', () => { skip = true })
  bEnd.addEventListener('click', () => end())

  return { start, stop: () => end(), toggle: () => (running ? end() : start()), get running() { return running } }
}
