// HUD (v4): crop marks, identity, sound + pause, a live camera readout, a plain "where am I" block, and one
// continuous progress rail whose stops are the six areas (plus the prologue and the epilogue).
// 8C: the block at bottom right names the area, the stop and the position in plain words ("II · Systems / Job Watchdog /
// 2 of 5 in Systems"); nav.ts works out the stop (it knows the flight), copy.ts holds the names.
// All numbers are real: the readout is fed by setCamera() every frame, nothing is decorative data.
// w12: the camera telemetry (CAM / LOOK / AREA / FLIGHT) is debug output, so it is off unless the URL carries ?hud=full.
// w12: `#hud .next` is the one persistent next-stop cue ("Scroll ↓ · Next: Cloudflare pitch"); overlays carry no scroll cue of their own.
import { animate, scrambleText } from 'animejs'
import { sound } from '../../audio/sound'
import { bus } from '../../bus'
import { setPaused, state as appState } from '../../state'
import { AREA_COPY, AREA_ORDER, areaLabel, positionOf, stopAt, type StopInfo } from './copy'
import type { FlightState, Vec3 } from './types'
import { clamp, h, isRm, sgn } from './util'

export interface RailStop { id: string; label: string; numeral: string; p: number }
/** nav.ts supplies the top-bar controls (Index, Contact, back to the hub) and the ring radar; the HUD only places them */
export interface HudEnv { stops: RailStop[]; onJump(stop: RailStop): void; onTop(): void; nav?: { bar: HTMLElement; map: HTMLElement; where?(): StopInfo | null } }

/** the label text is data (copy.ts) and scrambleText writes innerHTML: escape it first, the way deconstruct.ts does (S4) */
const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function buildHud(env: HudEnv) {
  const { stops } = env
  const lib = h('span', { class: 'lib', text: 'START' })
  const nm = h('span', { class: 'nm mono', text: 'Opening' })
  const pos = h('span', { class: 'pos mono', text: '' })
  const ct = h('div', { class: 'ct', 'aria-hidden': 'true' }, lib, nm, pos)
  const live = h('p', { class: 'sr', role: 'status', 'aria-live': 'polite' })

  const mk = (k: string, cls = '') => h('div', { class: 'r ' + cls }, h('b', { class: 'mono', text: k }), h('span', { class: 'mono', text: '' }))
  const rCam = mk('CAM'), rLook = mk('LOOK'), rArea = mk('AREA', 'hot'), rFlight = mk('FLIGHT')
  const full = new URLSearchParams(location.search).get('hud') === 'full'
  const ro = h('div', { class: 'ro' + (full ? ' full' : ''), 'aria-hidden': 'true' }, rCam, rLook, rArea, rFlight)
  const sp = (r: HTMLElement) => r.lastElementChild as HTMLElement
  // live telemetry is drawn from data-v by CSS (::after), so it is a readout, not page text (proofread reads page text)
  const setV = (r: HTMLElement, t: string) => { const e = sp(r); if (e.dataset.v !== t) e.dataset.v = t }

  // controls: real glyphs (inline SVG, currentColor) plus a text label that is visible on desktop and clipped, never display:none, on a phone.
  // aria-pressed carries the state; the accessible name names the state in words.
  const SVG = (inner: string) => `<svg class="gl" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`
  const SPK = '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" stroke="none"/>'
  const GLYPH = {
    soundOn: SVG(SPK + '<path d="M15.2 9.2a4 4 0 0 1 0 5.6"/><path d="M17.8 6.6a7.6 7.6 0 0 1 0 10.8"/>'),
    soundOff: SVG(SPK + '<path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
    pause: SVG('<path d="M8.5 6v12M15.5 6v12" stroke-width="2.4"/>'),
    play: SVG('<path d="M8 5.8v12.4L18.4 12z" fill="currentColor" stroke="none"/>'),
  }
  const glyph = (html: string) => { const e = document.createElement('span'); e.className = 'ic'; e.setAttribute('aria-hidden', 'true'); e.innerHTML = html; return e }
  const soundIc = glyph(GLYPH.soundOff), pauseIc = glyph(GLYPH.pause)
  const soundTx = h('span', { class: 'tx', text: 'Sound' }), pauseTx = h('span', { class: 'tx', text: 'Pause' })
  const soundBtn = h('button', { class: 'tog', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Sound off', 'data-cursor': '' }, soundIc, soundTx)
  const pauseBtn = h('button', { class: 'tog', type: 'button', 'aria-label': 'Pause the world', 'data-cursor': '' }, pauseIc, pauseTx)
  const syncSound = () => {
    const on = sound.on || appState.sound
    soundBtn.setAttribute('aria-pressed', String(on)); soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off')
    soundIc.innerHTML = on ? GLYPH.soundOn : GLYPH.soundOff
  }
  const syncPause = () => {
    const p = appState.paused
    pauseBtn.classList.toggle('is-paused', p); pauseBtn.setAttribute('aria-pressed', String(p))
    pauseBtn.setAttribute('aria-label', p ? 'Resume' : 'Pause the world')
    pauseTx.textContent = p ? 'Resume' : 'Pause'; pauseIc.innerHTML = p ? GLYPH.play : GLYPH.pause
  }
  soundBtn.addEventListener('click', () => { if (sound.on) sound.disable(); else void sound.enable() })
  pauseBtn.addEventListener('click', () => setPaused(!appState.paused))
  bus.on('sound', syncSound); bus.on('pause', syncPause); syncSound(); syncPause()

  const idLink = h('a', { class: 'id', href: '#', 'data-cursor': '', 'aria-label': 'Joseph Blumberg, back to the start' }, h('b', {}, h('span', { class: 'nf', text: 'Joseph Blumberg' }), h('span', { class: 'ni', 'aria-hidden': 'true', text: 'JB' })), h('span', { class: 'mono', text: 'Portfolio · 2026' }))
  idLink.addEventListener('click', e => { e.preventDefault(); env.onTop() })

  // rail
  const rail = h('nav', { class: 'rail', 'aria-label': 'Areas' })
  const fill = h('i', { class: 'fill' })
  rail.append(fill)
  const ticks: HTMLElement[] = []
  stops.forEach(s => {
    const area = s.numeral ? `area ${s.numeral}: ` : ''
    const b = h('button', { class: 'tk', type: 'button', 'data-cursor': '', 'aria-label': `Go to ${area}${s.label}` },
      h('span', { class: 'tl mono', 'aria-hidden': 'true' }, h('b', { text: s.numeral || '·' }), h('span', { class: 'tn', text: s.label })))
    b.addEventListener('click', () => env.onJump(s))
    ticks.push(b); rail.append(b)
  })
  const placeRail = () => stops.forEach((s, i) => { ticks[i].style.top = (clamp(s.p) * 100).toFixed(3) + '%' })
  placeRail()

  // ---- the next-stop cue: bottom-centre on a desktop, in the bottom band on a phone. A real <button>: a click or tap takes exactly one step.
  const coarse = matchMedia('(pointer: coarse)')
  const nxArrow = h('i', { class: 'nx-ar', 'aria-hidden': 'true' })
  const nxHow = h('span', { class: 'nx-how' })
  const nxSep = h('span', { class: 'nx-sep', text: ' \u00b7 ' })
  const nxName = h('span', { class: 'nx-nm' })
  const next = h('button', { class: 'next mono', type: 'button', 'data-cursor': '', 'data-state': 'leg' }, nxHow, nxSep, nxName)
  let nxWp = -1, nxCoarse: boolean | null = null, atEnd = false, nxDwell = false, nxT = 0
  const paintNext = (wp: number) => {
    const isLast = !stopAt(wp + 1)
    if (wp === nxWp && coarse.matches === nxCoarse && isLast === atEnd) return
    nxWp = wp; nxCoarse = coarse.matches; atEnd = isLast
    const nm = stopAt(wp + 1)?.name ?? ''
    if (isLast) {
      nxHow.textContent = 'Back to the start'; nxSep.textContent = ''; nxName.textContent = ''
      nxArrow.textContent = '\u2191'; next.setAttribute('aria-label', 'Back to the start')
    } else {
      nxHow.textContent = nxCoarse ? 'Swipe up' : 'Scroll'; nxSep.textContent = ' \u00b7 '; nxName.textContent = `Next: ${nm}`
      nxArrow.textContent = nxCoarse ? '' : '\u2193'; next.setAttribute('aria-label', `Next stop: ${nm}`)
    }
    next.classList.toggle('is-end', isLast); next.classList.toggle('is-touch', !!nxCoarse)
    // the arrow sits after the verb ("Scroll ↓"), and after "Back to the start ↑"; on touch the verb says it all and a drawn chevron bobs instead
    nxHow.append(nxArrow.textContent ? document.createTextNode(' ') : '', nxArrow)
  }
  const stepper = () => (window as unknown as { __v3?: { stepper?: { step(d: 1 | -1, via?: string): boolean } } }).__v3?.stepper
  next.addEventListener('click', () => {
    if (next.dataset.state !== 'dwell') return
    if (atEnd) { env.onTop(); return }
    stepper()?.step(1, 'key')
  })
  // the cue is a quiet furniture item: it fades in 600 ms after a dwell begins, falls to .15 while a leg flies, and never animates under reduced motion
  const setDwell = (on: boolean) => {
    if (on === nxDwell) return
    nxDwell = on
    window.clearTimeout(nxT)
    if (!on) { next.dataset.state = 'leg'; return }
    if (isRm()) { next.dataset.state = 'dwell'; return }
    nxT = window.setTimeout(() => { if (nxDwell) next.dataset.state = 'dwell' }, 600)
  }
  coarse.addEventListener?.('change', () => paintNext(Math.max(0, nxWp)))
  // the bob belongs to the arrow only and rests while the page is hidden
  const pageBob = () => next.classList.toggle('is-hidden', document.hidden)
  document.addEventListener('visibilitychange', pageBob); pageBob()
  paintNext(0)

  const root = h('div', { id: 'hud' },
    h('i', { class: 'cm tl' }), h('i', { class: 'cm tr' }), h('i', { class: 'cm bl' }), h('i', { class: 'cm br' }), h('i', { class: 'xm t' }), h('i', { class: 'xm b' }),
    h('div', { class: 'top' }, idLink, h('div', { class: 'rt' }, env.nav?.bar, h('div', { class: 'tg' }, soundBtn, pauseBtn))),
    env.nav?.map, ro, ct, next, rail, live)

  // the camera readout is quiet furniture: after 4 s without pointer movement it fades to .35, and any move brings it back
  let idleT = 0
  const wake = () => { ro.classList.remove('idle'); window.clearTimeout(idleT); idleT = window.setTimeout(() => ro.classList.add('idle'), 4000) }
  addEventListener('pointermove', wake, { passive: true }); addEventListener('pointerdown', wake, { passive: true }); wake()

  let curArea = '', frame = 0, scr = 0
  const setArea = (id: string) => {
    curArea = id
    let accent = '#EDE6D6', stopIdx = 0
    const ac = AREA_COPY[id]
    if (ac) { accent = ac.accent; stopIdx = 1 + AREA_ORDER.indexOf(id) }
    else if (id === 'epilogue') stopIdx = stops.length - 1
    ticks.forEach((t, k) => t.classList.toggle('act', k === stopIdx))
    document.documentElement.style.setProperty('--accent', accent)
    paintArea()
    if (!env.nav?.where) setStop(null)
  }
  // 8C: the plain-words block. The area line scrambles in when the area changes; the stop name and the position change with the stop.
  let curStop: StopInfo | null = null, libTxt = ''
  // the AREA row: "III  Systems" inside an area, "The World" at the world stop, "Epilogue" / "Prologue" otherwise
  const paintArea = () => {
    const ac = AREA_COPY[curArea]
    sp(rArea).textContent = curStop?.id === 'world' ? 'The World' : ac ? `${ac.numeral}  ${ac.kicker}` : curArea === 'epilogue' ? 'Epilogue' : 'Prologue'
  }
  const setStop = (w: StopInfo | null) => {
    curStop = w
    paintArea()
    const ac = w ? AREA_COPY[w.area] : null
    const txt = w ? `${ac ? ac.numeral + ' \u00b7 ' : ''}${areaLabel(w)}` : curArea === 'epilogue' ? 'End' : ac ? AREA_NAME_OF(curArea) : 'Start'
    if (txt !== libTxt) {
      libTxt = txt
      if (isRm()) lib.textContent = txt
      else { window.clearTimeout(scr); scr = window.setTimeout(() => animate(lib, { innerHTML: scrambleText({ text: escHtml(txt.toUpperCase()), chars: 'A-Z0-9/', cursor: true, duration: 520 }) }), 120) }
    }
    nm.textContent = w ? w.name : ''
    pos.textContent = w ? positionOf(w) : ''
    live.textContent = w ? `${areaLabel(w)}: ${w.name}. ${positionOf(w)}.` : ''
  }
  const AREA_NAME_OF = (id: string) => AREA_COPY[id]?.kicker ?? id

  return {
    el: root, placeRail,
    /** ui.ts feeds the flight state: the cue follows the dwell (the stop we rest at) and names the stop after it */
    setFlight(st: FlightState) {
      const dw = !!(st as FlightState & { dwelling?: boolean }).dwelling && st.wp != null
      if (dw) paintNext(st.wp!)
      setDwell(dw)
    },
    update(area: string, progress: number, flight: number, cam: { pos: Vec3; target: Vec3 } | null) {
      if (area !== curArea) setArea(area)
      const w = env.nav?.where?.() ?? null
      if (w !== curStop && env.nav?.where) setStop(w)
      fill.style.setProperty('--prog', progress.toFixed(4))
      if (!full || ++frame % 2 || !cam) return
      setV(rCam, `${sgn(cam.pos[0], 1, 2)} ${sgn(cam.pos[1], 1, 2)} ${sgn(cam.pos[2], 1, 2)}`)
      setV(rLook, `${sgn(cam.target[0], 1, 2)} ${sgn(cam.target[1], 1, 2)} ${sgn(cam.target[2], 1, 2)}`)
      setV(rFlight, `${(flight * 100).toFixed(1).padStart(5, '0')} %`)
    },
  }
}
