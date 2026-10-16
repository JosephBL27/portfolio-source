// Morph text (wave-22 #23): one line that changes form into another line and back. The prologue's Ovid line melts into its
// English and returns, so the first words of the site do what the poem says ("forms changed into new bodies").
// Ported from VengeanceUI morph-text (github.com/Ashutoshx7/VengeanceUI, MIT, (c) 2025-2026 Ashutoshx7, pinned 87f5a77,
// src/components/ui/morph-text.tsx); credited in src/data/credits.json. React and Tailwind dropped, structure and values kept:
//   - the SVG threshold: a feColorMatrix alpha row with upstream's gain of 25, then feComposite atop the source graphic, so
//     blurred ink fuses into one liquid shape while resting glyph edges keep their own antialiasing;
//   - the keyframe shape: the outgoing line blurs while its opacity halves, then leaves with a slight scale up; the incoming
//     one is its mirror (in from a slight scale down), ease-in-out on every segment.
// Changed for this site (and why):
//   - the threshold cut: upstream's 0 0 0 25 -9 cuts at alpha 0.36, tuned for 700-weight type at about 10rem. Instrument Serif italic 400
//     has thin strokes; blurred and at half opacity they peak low, so the upstream cut erases the middle of the morph at small sizes.
//     First pass (28-44 px, one line): offset -5 (cut at 0.2). Second pass, after the line became a two-line monument (up to 64 px, stems
//     of 5-6 px), freeze frames at 35 / 50 / 65 percent showed -5 fusing each line into a solid slab, -7 still a smeared band and -8 (cut at
//     0.32) a thin letterform skeleton, so the offset is -8 with the crossing blur cut to 0.035em (see overlays.css). A 0.5 px blur after
//     the cut puts the antialiasing back (the blur(0.6px) Magic UI adds after its own threshold);
//   - two lines, not a word list: upstream's two words would not overlap (each word's window is 1/N of the cycle), and the
//     threshold only makes bridges where both shapes exist at once, so here the two lines cross over the same window;
//   - a sentence, not a word: holds of 5-6 s instead of 3 s, blur in em (it scales with the clamp() size), scale 0.97..1.03
//     instead of 0.8..1.2 (20% of a 900 px line would swing its ends by 90 px);
//   - type: the vendored Instrument Serif italic (the voice face); upstream's runtime Google Fonts @import is gone;
//   - reduced motion through isRm() (none upstream): the caller never runs the clock and CSS keeps the English as a static line;
//   - cost: nothing at rest. The threshold filter and the two animations exist only during the 1.8 s morph; a hold is plain text.
//     The morph animates opacity, filter: blur() and scale only, as one-shot CSS animations; the phase clock is advanced from the
//     overlay's per-frame apply() (one comparison per frame), so the site's Pause, the flight and reduced motion all stop it.
//     Chrome does not composite these keyframes (a blur moves pixels: the trace reports compositeFailed 4096), so for 1.8 s in every
//     7 s the two wrappers restyle and repaint on the main thread; a trace over one cycle measured no rise in style, paint or long tasks.
//   Magic UI morphing-text (same technique: harder 0 0 0 255 -140 threshold, no feComposite, a rAF loop writing two filters per
//   frame) was compared and not used: its loop writes both filters on every frame forever, holds included (its cooldown resets them
//   each frame), its hard threshold crunches Instrument Serif's italic hairlines, and its scrub-friendliness is not needed (the
//   title's scrub is Deco's). Its 0.6 px blur after the threshold is borrowed (see the threshold cut above).
import { h } from './util'

/** phase lengths in ms: the first Latin hold (after the title assembles), then hold B, morph, hold A, morph ... */
export const MX = { first: 3200, holdA: 5600, holdB: 5200, morph: 1800 }
const PHASE = ['', 'mx-tb', 'mx-b1', 'mx-ta'] as const   // 0 hold A, 1 A -> B, 2 hold B, 3 B -> A
const FILTER_ID = 'mx-goo'

let filterMade = false
/** the one shared threshold filter (hidden, zero-size, out of the a11y tree) */
function ensureFilter() {
  if (filterMade || typeof document === 'undefined') return
  filterMade = true
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0')
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none')
  // the region is padded (y -60%, height 220%) so the blurred ink of a one-line block is not clipped at its top and bottom edges
  svg.innerHTML = `<defs><filter id="${FILTER_ID}" x="-8%" y="-60%" width="116%" height="220%" color-interpolation-filters="sRGB">`
    + '<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -8" result="cut"/>'
    + '<feGaussianBlur in="cut" stdDeviation="0.5" result="goo"/>'
    + '<feComposite in="SourceGraphic" in2="goo" operator="atop"/></filter></defs>'
  document.body.append(svg)
}

/** one end of a settle: what an element looked like (computed, so it includes a running keyframe) */
type Look = { opacity: string; filter: string; scale: string }
const SETTLE_MS = 150

export class MorphLine {
  /** the stack: line A (the caller's element, left in place for its own owner) and line B share one grid cell */
  readonly el: HTMLElement
  private readonly a: HTMLElement
  private readonly bi: HTMLElement
  private ph = 0
  private end = 0                // performance.now() at which the current phase ends; 0 = the clock is stopped
  private left = MX.first        // ms left in the current phase while stopped
  private paused = false
  private fx: Animation[] = []   // the settle animations in flight (leave())

  constructor(a: HTMLElement, bText: string) {
    ensureFilter()
    a.classList.add('mx-a')
    this.a = a
    this.bi = h('span', { class: 'mx-bi', text: bText })
    this.el = h('span', { class: 'mx' }, a, h('span', { class: 'mx-b', 'aria-hidden': 'true' }, this.bi))
    this.el.style.setProperty('--mx-d', MX.morph + 'ms')
  }

  get phase() { return this.ph }

  /** every frame while the stop is the current one and fully up. run = allowed to move (not reduced motion, not Pause, no dialog over it):
   *  a stopped clock holds the frame it is on (a morph caught mid-way stays mid-way) and picks up where it left off. */
  tick(now: number, run: boolean) {
    if (!run) {
      if (this.end) { this.left = Math.max(0, this.end - now); this.end = 0 }
      this.pause(true)
      return
    }
    if (!this.end) { this.end = now + this.left; this.pause(false) }
    if (now < this.end) return
    this.ph = (this.ph + 1) % 4
    this.show()
    this.end = now + (this.ph === 0 ? MX.holdA : this.ph === 2 ? MX.holdB : MX.morph)
  }

  /** nothing to put back: the Latin hold with the clock at its start */
  private get atRest() { return this.ph === 0 && !this.end && this.left === MX.first && !this.paused }

  /** back to line A at rest, clock stopped, at once (the overlay left the screen, or reduced motion came on) */
  reset() {
    if (this.atRest) return
    this.cancelFx()
    this.rest()
  }

  /** the stop is being left (or has not been reached yet): the Latin line is the one the site's letter shatter breaks apart, so it has to be
   *  the line on screen. Whatever was showing (English hold, a morph caught mid-way) is put back to the Latin rest with a short settle from its
   *  current look instead of a pop, and the cycle starts over from the Latin hold when the stop is current again. Cheap to call every frame. */
  leave() {
    if (this.atRest) return
    const from = this.ph !== 0 ? [this.look(this.a), this.look(this.bi)] : null
    this.cancelFx()
    this.rest()
    if (from) this.settle(from[0], from[1])
  }

  private rest() {
    this.ph = 0; this.end = 0; this.left = MX.first
    this.show(); this.pause(false)
  }

  private show() {
    this.el.classList.remove('mx-tb', 'mx-b1', 'mx-ta')
    const c = PHASE[this.ph]
    if (c) this.el.classList.add(c)
  }
  /** a morph caught mid-way holds its frame (CSS animation-play-state), so the clock and the pixels stay in step */
  private pause(on: boolean) { if (on !== this.paused) { this.paused = on; this.el.classList.toggle('mx-p', on) } }

  private look(e: HTMLElement): Look {
    const c = getComputedStyle(e)
    return { opacity: c.opacity, filter: c.filter, scale: c.scale === 'none' ? '1' : c.scale }
  }
  /** Latin up to full, English down to nothing, both from the look they had (one-shot Web Animations: opacity, blur and scale only) */
  private settle(a: Look, b: Look) {
    const go = (e: HTMLElement, from: Look, opacity: string) => {
      try {
        const an = e.animate([from, { opacity, filter: 'blur(0px)', scale: '1' }], { duration: SETTLE_MS, easing: 'ease-out' })
        const done = () => { const i = this.fx.indexOf(an); if (i >= 0) this.fx.splice(i, 1) }
        an.onfinish = done; an.oncancel = done
        this.fx.push(an)
      } catch { /* no Web Animations: the pop is the fallback */ }
    }
    go(this.a, a, '1'); go(this.bi, b, '0')
  }
  private cancelFx() { for (const an of this.fx.splice(0)) an.cancel() }
}
