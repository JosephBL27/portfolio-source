// Loader + entry gate. A black curtain with a percent counter and the Ovid line resolving while the world builds.
// When the world is ready the same screen turns into the gate: "Enter with sound" (primary) / "Enter silently".
// The click is the user gesture that unlocks audio and powers the TV on, so onEnter() runs inside the handler.
// ?gate=0 enters silently as soon as the world is ready (for screenshots and tests).
import { animate, createTimeline } from 'animejs'
import '../styles/loader.css'
import siteRaw from '../../data/site.json'
import { SITE } from './copy'
import { clamp, h } from './util'

const LINE = 'In nova fert animus mutatas dicere formas corpora'
const NOISE = '01+×/·:▪▫#'
const NAME = SITE.name
const SCHOOL = (siteRaw as unknown as { education: { school: string }[] }).education.find(e => /Chicago/.test(e.school))?.school ?? ''
/** w12 (NEW copy, no digits): the gate says who and what before it asks how to enter */
const GATE_WHAT = 'Economics + Applied Math at the University of Chicago. Scroll to fly through the work; open any case study for the full story.'

export function initLoader(onEnter: (withSound: boolean) => void) {
  let root = document.getElementById('loader')
  if (!root) { root = h('div', { id: 'loader' }); document.body.prepend(root) }
  const rm = document.documentElement.classList.contains('rm')
  const skip = new URLSearchParams(location.search).get('gate') === '0'
  root.innerHTML = ''
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Loading, then enter')
  const line = h('p', { class: 'ld-line', 'aria-hidden': 'true' })
  const glyphs: { el: HTMLElement; ch: string }[] = []
  LINE.split(' ').forEach((w, wi, arr) => {
    const word = h('span', { style: 'display:inline-block;white-space:nowrap' })
    for (const ch of w) { const g = h('span', { class: 'g n', text: NOISE[(Math.random() * NOISE.length) | 0] }); glyphs.push({ el: g, ch }); word.append(g) }
    line.append(word); if (wi < arr.length - 1) line.append(' ')
  })
  const who = h('div', { class: 'ld-id' }, h('p', { class: 'ld-nm', text: NAME }), SCHOOL ? h('p', { class: 'ld-sc mono', text: SCHOOL }) : null)
  const stack = h('div', { class: 'ld-stack' }, line, who)
  const pct = h('div', { class: 'ld-pct', 'aria-hidden': 'true' }, h('span', { class: 'v', text: '000' }), h('small', { text: '%' }))
  const cap = h('div', { class: 'ld-cap', 'aria-hidden': 'true' }, 'Ovid, Metamorphoses 1.1', h('br'), 'Building the world')
  const status = h('p', { class: 'sr', role: 'status', text: 'Loading' })

  const bSound = h('button', { class: 'gate-btn primary', type: 'button', 'data-cursor': '' }, h('span', { text: 'Enter with sound' }), h('i', { class: 'gb-ar', 'aria-hidden': 'true', text: '→' }))
  const bSilent = h('button', { class: 'gate-btn', type: 'button', 'data-cursor': '' }, h('span', { text: 'Enter silently' }))
  const gate = h('div', { class: 'gate' },
    h('div', { class: 'gate-who' }, h('p', { class: 'gate-nm', text: NAME }), h('p', { class: 'gate-what', text: GATE_WHAT })),
    h('div', { class: 'gate-row' }, bSound, bSilent),
    h('p', { class: 'gate-n mono', text: 'Sound plays a soft score and a signature at each stop. Switch it off at any time.' }))
  gate.inert = true

  const inner = h('div', { class: 'ld-inner', style: 'display:contents' }, stack, h('div', { class: 'ld-meta' }, pct, cap), gate, h('div', { class: 'ld-bar' }), status)
  root.append(inner)
  const vEl = pct.querySelector('.v') as HTMLElement
  const bar = root.querySelector('.ld-bar') as HTMLElement

  let target = 0, shown = 0, isReady = false, done = false, entered = false, last = performance.now(), flick = 0, resolved = 0, gateUp = false
  const tick = (now: number) => {
    if (done) return
    requestAnimationFrame(tick)
    const dt = Math.min(0.1, (now - last) / 1000); last = now
    const ceil = isReady ? 100 : Math.min(94, target + 7)
    const goal = isReady ? 100 : Math.max(target, Math.min(ceil, shown + dt * 6))
    shown += (goal - shown) * Math.min(1, dt * (isReady ? 22 : 4)) // w14: once the world is ready the counter closes in 0.15 s (it took 0.4 s at 9/s) so the gate is not held back by the easing
    if (shown > 99.4 && isReady) shown = 100
    vEl.textContent = String(Math.round(shown)).padStart(3, '0')
    bar.style.setProperty('--p', (shown / 100).toFixed(4))
    const n = glyphs.length, want = Math.floor((shown / 100) * (n + 1))
    flick += dt
    for (let i = 0; i < n; i++) {
      const g = glyphs[i]
      if (i < want) { if (i >= resolved) { g.el.textContent = g.ch; g.el.classList.remove('n') } }
      else if (!rm && flick > 0.07) g.el.textContent = NOISE[(Math.random() * NOISE.length) | 0]
    }
    resolved = Math.max(resolved, want)
    if (flick > 0.07) flick = 0
    if (isReady && shown >= 100 && !gateUp) raiseGate()
  }
  requestAnimationFrame(tick)

  function raiseGate() {
    gateUp = true
    glyphs.forEach(g => { g.el.textContent = g.ch; g.el.classList.remove('n') })
    status.textContent = 'Ready. Choose how to enter.'
    ;(cap.lastChild as Text).textContent = 'Ready'
    root!.classList.add('is-gate')
    gate.inert = false
    root!.setAttribute('aria-label', 'Enter the portfolio')
    if (skip) { window.setTimeout(() => enter(false), 60); return }
    // keep focus off the page behind the curtain, on the primary choice
    window.setTimeout(() => bSound.focus({ preventScroll: true }), rm ? 0 : 420)
  }

  function enter(withSound: boolean) {
    if (entered) return
    entered = true; done = true
    onEnter(withSound) // synchronous: this is inside the user gesture
    const html = document.documentElement
    html.classList.remove('is-loading'); html.classList.add('is-ready')
    const end = () => { root!.remove() }
    if (rm) { animate(root!, { opacity: [1, 0], duration: 320, ease: 'linear', onComplete: end }); return }
    // curtain lifts: copy slides away first, then the black wipes up (ease-out, 620 ms; w14: was 760 ms from 160)
    createTimeline({ onComplete: end })
      .add(inner.querySelectorAll('.ld-stack, .ld-meta, .gate'), { opacity: [1, 0], translateY: [0, -22], duration: 260, ease: 'in(3)' }, 0)
      .add(root!, { clipPath: ['inset(0% 0% 0% 0%)', 'inset(0% 0% 100% 0%)'], duration: 620, ease: 'out(4)' }, 120)
  }
  bSound.addEventListener('click', () => enter(true))
  bSilent.addEventListener('click', () => enter(false))

  // never hold the screen for long: whatever has not been built keeps streaming in behind it
  const failsafe = window.setTimeout(() => api.ready(), 6000)
  const api = {
    setLoading(p: number) { target = Math.max(target, clamp(p, 0, 1) * 100) },
    ready() { clearTimeout(failsafe); target = 100; isReady = true },
  }
  return api
}
