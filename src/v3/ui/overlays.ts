// Overlay layer (v4): one fixed layer of copy panels, one per overlay id. Nothing scrolls with the page;
// everything is a function of the flight state (overlay / overlayNext / overlayK):
//   titles   scrubbed by the leg progress k: outgoing leaves 0..0.30, art alone, incoming arrives 0.78..0.96
//   info     time-based (CSS transitions): 520 ms, 70 ms stagger in; 180 ms, 40 ms stagger out; hysteresis
// Type is always crisp DOM: normal blend, solid ink, a soft scrim behind body copy, titles at the lane edge.
// v4 5B2: the titles are deconstructable type (deconstruct.ts): split into letters, assembled / shattered by a scrubbed anime.js
// timeline whose playhead is the flight window (ti / to), so scrolling back reassembles the word. Body copy never gets letter effects.
import { animate } from 'animejs'
import type { Waypoint } from '../world/layout'
import { flightAt } from '../world/flight'
import { AREA_COPY, AREA_NAME, AREA_PLAIN, ABOUT_BEATS, ABOUT_LINE3, ABOUT_LINES, AREA_ORDER, EDUCATION, FIRST_SCREEN, INSTRUMENT_IDS, SITE, copyFor, isInstrument, projName, routeLine, secondaryCtas, shortName, sourceCta, typeLine, type OverlayCopy, type StopInfo } from './copy'
import { Clock, Deco, Hero, Rig, cue, idle, msFor, splitChars, type Split } from './deconstruct'
import { MorphLine } from './morph'
import { state as appState } from '../../state'
import type { FlightState } from './types'
import { clamp, fmtNum, h, isRm, parseFigure, sstep } from './util'

export interface OverlayEnv {
  onOpen(projectId: string, fromEl: HTMLElement): void
  onJump(areaId: string): void
  /** 7C: the first screen's two actions: fly on to the establishing shot, and open the Index menu */
  onTour?(): void
  onIndex?(): void
  /** 10A: the autoplay tour */
  onPlay?(): void
  /** 8C: the first screen's third action (the Overview page), and a stop chip on an area card (fly to that waypoint) */
  onOverview?(): void
  onStop?(waypointId: string): void
}

/** the school line of the first screen: the 'name' overlay's kicker in copy.ts, without the class year */
const NAME_KICKER = 'University of Chicago \u00b7 Economics + Computational and Applied Math'
/** w11: the title is never set on more lines than this (the long mathecon title must stay on two lines at 1440).
 *  w12: every title now carries a real name ("Love Island Dynamics", "Second Brain"), so two lines is the ceiling everywhere. */
const MAX_LINES: Record<string, number> = { mathecon: 2, hall: 2 }
const MAX_LINES_DEFAULT = 2
/** w12: a title lane that must stay clear of art beside it: the share of the viewport width its right edge may reach (landscape only).
 *  The hall's first window starts at 0.36 W, so "Five Windows" may not run past 0.34 W. */
const LANE_CAP: Record<string, number> = { hall: 0.34 }
/** w12: touch pointers get their own wording ("Swipe up", "Tap a window"). One media query, read once; the text is swapped live if the pointer changes. */
const mqCoarse = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : null
function ptrText(el: HTMLElement, fine: string, coarse: string): HTMLElement {
  const set = () => { el.textContent = mqCoarse?.matches ? coarse : fine }
  set(); mqCoarse?.addEventListener('change', set)
  return el
}
/** w11: the stop copy hangs under its title instead of sitting at the bottom edge (no 200 px gap on desktop) */
const PULL_UP = new Set(['instrument', 'mathecon'])
/** w11: set-piece legs (a doorway, a long walk): the outgoing title fades in 0.3 s instead of breaking apart, the incoming one waits until the leg is past 0.6 */
const SET_LEGS = new Set(['gate>hall', 'hall>hold', 'chomchom>secretary'])
/** a rail jump arms the destination title once the camera is within this share of the jump left to fly */
const ARM_LEFT = 0.3
const SMALL = new Set(['the', 'off', 'of', 'a', 'an', 'in', 'on'])
function splitTitle(t: string): { lead: string; big: string } {
  const words = t.split(' ')
  let k = 0
  while (k < words.length - 1 && SMALL.has(words[k].toLowerCase())) k++
  return { lead: words.slice(0, k).join(' '), big: words.slice(k).join(' ') }
}

/** w11: what the layer knows about the leg being flown: the overlay a rail jump is about to reach, a set-piece leg, and how far through the leg the camera is (0..1, linear in time) */
interface LegCtx { arm: string | null; set: boolean; lt: number }
const rvIdx = (el: HTMLElement, i: number) => { el.style.setProperty('--i', String(i)); return el }

export class Overlay {
  readonly el: HTMLElement
  readonly id: string
  readonly copy: OverlayCopy
  private env: OverlayEnv
  private titleEl: HTMLElement | null = null
  private infoEl: HTMLElement | null = null
  private hasLead = false
  private bigEl: HTMLElement | null = null
  private words: string[] = []
  private beats: HTMLElement[] = []
  private fnum: HTMLElement | null = null
  private fig: ReturnType<typeof parseFigure> = null
  private counted = false
  private ti = -1; private to = -1
  private on = false; private vis = false; private live = false
  private beat = -1
  eduDetail: HTMLElement | null = null
  // deconstructable type
  private deco: Deco | null = null
  private hero: Hero | null = null
  /** wave-22 #23: the prologue's Ovid line morphs into its English and back (morph.ts) */
  private mx: MorphLine | null = null
  private bigFs: HTMLElement | null = null          // the element whose font size scales the scatter
  private clock = new Clock()
  private pendingClock = false
  private dxOn = false; private prevVis = false
  private xf = false; private jumpClocked = false
  private cuedIn = false; private cuedOut = false; private toMax = 0
  private vars = { px: NaN, py: NaN, rx: NaN, ry: NaN, tdx: NaN, tdy: NaN }
  /** where the incoming window of the title starts (leg progress k): the name condenses early, out of the particle cloud */
  private inStart = 0.7
  /** viewport rects of the copy blocks (header + info), measured at layout; the anchors keep their tags out of these */
  rects: { l: number; t: number; r: number; b: number }[] = []

  constructor(copy: OverlayCopy, env: OverlayEnv, wp?: Waypoint) {
    this.copy = copy; this.id = copy.id; this.env = env
    if (copy.kind === 'name') this.inStart = 0.56
    const c = copy
    const el = h('section', { class: `ov k-${c.kind}`, id: 'ov-' + c.id, 'data-side': c.side, 'data-id': c.id, 'data-area': c.area ?? '', 'aria-label': c.lead ? `${c.lead}: ${c.title}` : c.title })
    el.style.setProperty('--a', c.accent)
    this.el = el
    let n = 0

    // ---- header: kicker + title (scrubbed)
    // w12: "II · Systems": the numeral, a dot, the plain area name (one text run, so a screen reader and a test both read "II · Systems")
    const kicker = h('div', { class: 'kicker mono' },
      c.numeral ? h('span', { class: 'k-num', text: c.numeral }) : null,
      c.numeral ? h('span', { class: 'k-sep', 'aria-hidden': 'true', text: ' \u00b7 ' }) : null,
      h('span', { class: 'k-text', text: c.kicker }))
    const sr = c.kind === 'name' || c.kind === 'epilogue'
    const tag = c.kind === 'prologue' ? 'p' : 'h2'
    const titleEl = h(tag, { class: 'title' + (sr ? ' sr' : '') + (c.kind === 'prologue' ? ' epigraph' : ''), 'aria-label': c.lead ? `${c.lead}: ${c.title}` : c.title })
    const kText = kicker.querySelector('.k-text') as HTMLElement | null
    if (c.kind === 'prologue') {
      const epi = h('span', { class: 'tl epi', 'aria-hidden': 'true', title: c.body })
      const sp = splitChars(epi, c.title)
      // wave-22 #23: Deco keeps the Latin letters (assemble / shatter); the morph owns only the two line wrappers, and the English is the chapter's own body copy
      if (c.body) { this.mx = new MorphLine(epi, c.body); titleEl.append(this.mx.el) } else titleEl.append(epi)
      this.bigFs = epi
      this.deco = new Deco(sp.chars, sp.words, sp.wordOf, c.id, { kicker: kText })
    } else if (!sr) {
      const { lead, big } = c.lead != null ? { lead: c.lead, big: c.title } : splitTitle(c.title)
      this.words = big.split(' ')
      this.hasLead = !!lead
      const sp: Split = { chars: [], words: [], wordOf: [] }
      if (lead) { const le = h('span', { class: 'tl lead', 'aria-hidden': 'true', style: '--li:0' }); splitChars(le, lead, sp); titleEl.append(le) }
      this.bigEl = h('span', { class: 'tl big', 'aria-hidden': 'true', style: `--li:${lead ? 1 : 0}` })
      splitChars(this.bigEl, big, sp)
      titleEl.append(this.bigEl); this.bigFs = this.bigEl
      this.deco = new Deco(sp.chars, sp.words, sp.wordOf, c.id, { kicker: kText })
    } else titleEl.textContent = c.title
    this.titleEl = titleEl
    const head = h('header', { class: 'head' }, kicker, titleEl)
    el.append(head)
    // the name: the particles spell it, a DOM twin lies in the same world plane (see Hero)
    if (c.kind === 'name' && wp) { this.hero = new Hero(wp); el.append(this.hero.el) }

    // ---- info (time-based pieces, class .rv)
    const info = h('div', { class: 'info' })
    const push = (e: HTMLElement) => { e.classList.add('rv'); rvIdx(e, n++); info.append(e) }

    if (c.kind === 'prologue') {
      // w12: the first screen orients before it decorates. wave-22 #23: the Latin line is the screen's monument (it morphs into its translation and
      // back, see the title above); then who he is, the claim, how to move (three rows), the route and exactly two buttons.
      // wave-22 #23: the same text as before; while the line morphs, the translation is read by screen readers only and the source stays as a label
      head.append(h('p', { class: 'epi-tr' }, h('span', { class: 'tr-en', text: `${c.body} \u00b7 ` }), h('span', { class: 'tr-src', text: c.kicker })))
      push(h('div', { class: 'ident' }, h('h1', { class: 'id-name', text: SITE.name }), h('p', { class: 'school', text: NAME_KICKER + ' \u00b7 Class of 2029' })))
      push(h('p', { class: 'claim-line', text: SITE.claim }))
      const how = h('ul', { class: 'how', role: 'list', 'aria-label': 'How this works' })
      FIRST_SCREEN.how.forEach(r => {
        const cue = h('b', { class: 'hw-k' }); ptrText(cue, r.cue.fine, r.cue.coarse)
        const li = h('li', {}, cue, h('span', { text: r.rest }))
        if (r.cue2) li.append(h('b', { class: 'hw-k', text: r.cue2 }), h('span', { text: r.rest2 }))
        how.append(li)
      })
      push(how)
      push(h('p', { class: 'route' }, h('span', { class: 'rt-l mono', text: FIRST_SCREEN.routeLabel }), ' ', h('span', { class: 'rt-v', text: routeLine() })))
      const go0 = h('button', { class: 'open pri', type: 'button', 'data-cursor': '', 'aria-label': FIRST_SCREEN.start.aria }, h('span', { class: 'ot', text: FIRST_SCREEN.start.label }), h('span', { class: 'ar', 'aria-hidden': 'true', text: FIRST_SCREEN.start.arrow }))
      go0.addEventListener('click', () => env.onTour?.())
      const pl0 = h('button', { class: 'open', type: 'button', 'data-cursor': '', 'aria-label': FIRST_SCREEN.tour.aria }, h('span', { class: 'ot', text: FIRST_SCREEN.tour.label }), h('span', { class: 'ar', 'aria-hidden': 'true', text: FIRST_SCREEN.tour.arrow }))
      pl0.addEventListener('click', () => env.onPlay?.())
      push(h('div', { class: 'acts first-acts' }, go0, pl0))
    } else if (c.kind === 'name') {
      // w11: the name stop is the name in particles plus two lines; the action row lives on the first screen and in the top bar
      push(h('p', { class: 'claim', text: c.body }))
      push(h('p', { class: 'school', text: c.kicker }))
    } else if (c.kind === 'world') {
      push(h('p', { class: 'body', text: c.body }))
      const toc = h('ol', { class: 'toc' })
      AREA_ORDER.forEach(a => {
        const ac = AREA_COPY[a], nm = AREA_NAME[a] ?? ac.kicker
        const b = h('button', { class: 'toc-row', type: 'button', 'data-cursor': '', 'data-area': a, 'aria-label': `Area ${ac.numeral}: ${nm}. ${AREA_PLAIN[a] ?? ''}. Jump there.` },
          h('span', { class: 'tn mono', text: ac.numeral, 'aria-hidden': 'true' }), h('span', { class: 'tt', text: nm, 'aria-hidden': 'true' }), h('span', { class: 'tk mono', text: AREA_PLAIN[a] ?? '', 'aria-hidden': 'true' }))
        b.style.setProperty('--a', ac.accent)
        b.addEventListener('click', () => env.onJump(a))
        toc.append(h('li', {}, b))
      })
      push(toc)
    } else if (c.kind === 'epilogue') {
      // the finale's console is its own layer (world/extras/finale.ts); this overlay only names the stop for screen readers and the deep link
    } else if (c.kind === 'offboard') {
      ABOUT_LINES.forEach(l => push(h('p', { class: 'body', text: l })))
      const bw = h('div', { class: 'beats', 'aria-hidden': 'true' })
      ABOUT_BEATS.forEach(b => { const be = h('div', { class: 'beat' }, h('span', { class: 'bf', text: b.big }), h('span', { class: 'bl', text: b.small })); this.beats.push(be); bw.append(be) })
      push(bw)
      info.append(h('p', { class: 'sr', text: ABOUT_LINE3 }))
    } else if (c.kind === 'interest' && c.interest) {
      // w11: title (head), the stat, one affordance line, two chips. No paragraphs; phones keep the stat and the line only.
      const it = c.interest
      push(h('p', { class: 'stat' }, h('span', { class: 'sv', text: it.stat.value }), h('span', { class: 'sl', text: it.stat.label })))
      push(h('p', { class: 'afford mono', text: it.afford }))
      const chip = (label: string, id: string, aria: string) => {
        const b = h('button', { class: 'open chip', type: 'button', 'data-cursor': '', 'data-stop': id, 'aria-label': aria }, h('span', { class: 'ot', text: label }))
        b.addEventListener('click', () => env.onStop?.(id))
        return b
      }
      push(h('div', { class: 'also int-nav' }, chip('\u2190 ' + it.prev.label, it.prev.id, `Back to ${it.prev.label.toLowerCase()}`), chip(`Next: ${it.next.label} \u2192`, it.next.id, `Next: ${it.next.label}`)))
    } else {
      if (c.what) push(h('p', { class: 'what', text: c.what }))
      if (c.body) { const l = h('p', { class: 'lede' }); if (c.bodyCoarse) ptrText(l, c.body, c.bodyCoarse); else l.textContent = c.body; push(l) }
      if (c.bio) push(h('p', { class: 'body bio', text: c.bio }))
      if (c.afford) push(ptrText(h('p', { class: 'afford mono' }), c.afford.fine, c.afford.coarse ?? c.afford.fine))
      if (c.id === 'education') {
        const list = h('ul', { class: 'edu' })
        const detail = h('p', { class: 'edu-detail', id: 'edu-detail', 'aria-live': 'polite', text: EDUCATION[0]?.notes ?? '' })
        this.eduDetail = detail
        const rows: HTMLElement[] = []
        const sel = (i: number) => { detail.textContent = EDUCATION[i].notes; rows.forEach((r, k) => r.setAttribute('aria-expanded', String(k === i))) }
        EDUCATION.forEach((e, i) => {
          // w11: on a portrait screen the motto's translation and the "Before Chicago" row stay folded until the motto row is tapped
          const r = h('button', { class: 'edu-row', type: 'button', 'aria-expanded': String(i === 0), 'aria-controls': 'edu-detail', 'data-cursor': '' },
            h('span', { class: 'es', text: e.school }),
            h('span', { class: 'ep mono' }, h('span', { class: 'ep-t', text: e.program }), h('span', { class: 'ep-s', text: ' \u00b7 ' }), h('span', { class: 'ep-y', text: e.years }), i === 0 ? h('span', { class: 'ep-more', 'aria-hidden': 'true', text: '+' }) : null))
          r.addEventListener('pointerenter', () => sel(i)); r.addEventListener('focus', () => sel(i)); r.addEventListener('click', () => { sel(i); if (i === 0) list.classList.toggle('x') })
          rows.push(r); list.append(h('li', {}, r))
        })
        push(list); push(detail)
        // the reading instruments the area's copy names: their repos, one link each
        push(this.buildSources(INSTRUMENT_IDS))
      }
      if (c.featured && c.proj) push(this.buildCard(c, env))
      else {
        if (c.proj) {
          const p = h('div', { class: 'proj' })
          if (c.proj.kicker) p.append(h('div', { class: 'pk mono', text: c.proj.kicker }))
          if (c.proj.body) p.append(h('p', { class: 'body', text: c.proj.body }))
          if (c.proj.figure) p.append(this.buildFigure(c.proj.figure))
          push(p)
        }
        if (c.projects.length) push(this.buildChips(c.projects, env, 'Case study'))
      }
      if (c.stops) push(this.buildStops(c.stops, env, c.stopsLabel))
    }
    el.append(info)
    this.infoEl = info
  }

  /** the key figure of a block: the value (digits rise into place on arrival) over its label */
  private buildFigure(f: { value: string; label: string }): HTMLElement {
    this.fig = parseFigure(f.value)
    const fv = h('span', { class: 'fv', 'aria-label': f.value })
    fv.style.setProperty('--n', String(Math.max(4, f.value.length)))
    if (this.fig) {
      if (this.fig.pre) fv.append(h('span', { class: 'pre', text: this.fig.pre, 'aria-hidden': 'true' }))
      this.fnum = h('span', { class: 'num', text: fmtNum(this.fig.target, this.fig.dec, this.fig.comma), 'aria-hidden': 'true' })
      fv.append(this.fnum)
      if (this.fig.suf) fv.append(h('span', { class: 'suf', text: this.fig.suf.trim(), 'aria-hidden': 'true' }))
    } else fv.textContent = f.value
    return h('div', { class: 'fig' }, fv, h('span', { class: 'fl mono', text: f.label }))
  }

  /** a row of small buttons, each opening a project's case study */
  private buildChips(ids: string[], env: OverlayEnv, label: string): HTMLElement {
    const row = h('div', { class: 'also' }, h('span', { class: 'also-lab mono', text: label === 'Case study' ? 'Open' : label }))
    ids.forEach(pid => {
      const b = h('button', { class: 'open chip', type: 'button', 'data-cursor': '', 'data-project': pid, 'aria-label': 'Open case study: ' + projName(pid) },
        h('span', { class: 'ot', text: 'Open: ' + shortName(pid) }), h('span', { class: 'ar', 'aria-hidden': 'true', text: '↗' }))
      b.addEventListener('click', () => env.onOpen(pid, b))
      row.append(b)
    })
    return row
  }

  /** 8C: the stops of an area on its first card, in flight order; each chip flies to that stop */
  private buildStops(stops: StopInfo[], env: OverlayEnv, label?: string): HTMLElement {
    const row = h('div', { class: 'also stops' + (label ? ' one' : ''), role: 'group', 'aria-label': `${stops.length} stops in this area` }, h('span', { class: 'also-lab mono', text: label ?? `${stops.length} stops` }))
    stops.forEach(s => {
      const b = h('button', { class: 'open chip', type: 'button', 'data-cursor': '', 'data-stop': s.id, title: s.name, 'aria-label': `Stop ${s.i} of ${s.n}: ${s.name}. Fly there.` }, h('span', { class: 'sn', text: String(s.i) }), h('span', { class: 'ot', text: s.name }))
      b.addEventListener('click', () => env.onStop?.(s.id))
      row.append(b)
    })
    return row
  }

  /** 7C: the project card, the same at every waypoint: name, a plain type line, one sentence, one key figure, Case study (primary), then Live demo / Paper / Deck / Code */
  private buildCard(c: OverlayCopy, env: OverlayEnv): HTMLElement {
    const pid = c.featured!, name = projName(pid)
    const card = h('div', { class: 'proj pcard', 'data-project': pid })
    card.append(h('div', { class: 'pk mono', text: c.proj!.kicker }), h('p', { class: 'pt mono', text: typeLine(pid) }))
    if (c.proj!.body) card.append(h('p', { class: 'body', text: c.proj!.body }))
    if (c.proj!.figure) card.append(this.buildFigure(c.proj!.figure))
    const acts = h('div', { class: 'acts pa' })
    const main = h('button', { class: 'open pri', type: 'button', 'data-cursor': '', 'data-project': pid, 'aria-label': 'Open case study: ' + name },
      h('span', { class: 'ot', text: 'Open case study' }), h('span', { class: 'ar', 'aria-hidden': 'true', text: '↗' }))
    main.addEventListener('click', () => env.onOpen(pid, main))
    acts.append(main)
    for (const k of secondaryCtas(pid)) {
      const a = h('a', { class: 'sec mono', href: k.href, 'data-cursor': '', 'aria-label': k.aria, 'data-kind': k.kind },
        h('span', { text: k.label }), h('span', { class: 'ar', 'aria-hidden': 'true', text: '↗' }))
      // every secondary link leaves the flight, so it opens in its own tab (a local demo or a PDF as much as an external site)
      a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer')
      acts.append(a)
    }
    card.append(acts)
    // w12: an area intro carries ONE chip row (its stops); the other TVs of the stop come back on the stops that follow
    if (c.also?.length && !c.stops) {
      card.append(this.buildChips(c.also, env, 'Also here'))
      const repos = c.also.filter(isInstrument)
      if (repos.length) card.append(this.buildSources(repos))
    }
    return card
  }

  /** a row of repo links, one per reading instrument: the source is one click from the stop, not behind the case study */
  private buildSources(ids: string[]): HTMLElement {
    const row = h('div', { class: 'also src-row' }, h('span', { class: 'also-lab mono', text: 'Source code' }))
    ids.forEach(pid => {
      const k = sourceCta(pid)
      if (!k) return
      row.append(h('a', { class: 'sec mono', href: k.href, target: '_blank', rel: 'noopener noreferrer', 'data-cursor': '', 'data-kind': 'code', 'aria-label': k.aria },
        h('span', { text: shortName(pid) }), h('span', { class: 'ar', 'aria-hidden': 'true', text: '↗' })))
    })
    return row
  }

  /** fit the title to its lane: the longest word must fit, the whole block must stay inside the title band */
  fit(vw: number, vh: number, measure: (words: string[]) => { w: number[]; space: number }) {
    if (this.copy.kind === 'prologue') { this.placePrologue(vw, vh); return }
    if (!this.bigEl || !this.titleEl || !this.infoEl) return
    const mobile = vw <= 760
    let lane = mobile ? vw - 2 * Math.max(16, vw * 0.04) : Math.min(Math.max(vw * 0.31, 380), 560)
    // w12: a lane that must stay clear of art beside it (the hall's first window): right edge <= cap * W, measured from the head's own left edge
    const cap = LANE_CAP[this.id]
    if (cap && !mobile && vw > vh) lane = Math.min(lane, Math.max(220, vw * cap - (parseFloat(getComputedStyle(this.titleEl.parentElement as HTMLElement).left) || 0) - 2))
    let fmax = mobile ? Math.min(vh * 0.13, vw * 0.2) : vh * 0.2
    if (mobile && this.copy.kind === 'interest') fmax = Math.min(fmax, vh * 0.075)
    const maxLines = mobile && this.copy.kind === 'interest' ? 1 : (MAX_LINES[this.id] ?? MAX_LINES_DEFAULT)
    // the title band is what the info block leaves free between the header and the bottom copy
    const head = this.titleEl.parentElement as HTMLElement
    const headTop = parseFloat(getComputedStyle(head).top) || 0
    const infoBottom = parseFloat(getComputedStyle(this.infoEl).bottom) || 0
    const free = vh - headTop - this.titleEl.offsetTop - this.infoEl.offsetHeight - infoBottom - 34
    const band = Math.min(vh * (mobile ? 0.27 : 0.46), Math.max(vh * 0.14, free))
    const { w, space } = measure(this.words)
    let fs = fmax
    const maxWord = Math.max(...w)
    fs = Math.min(fs, (lane / maxWord) * 100)
    for (; fs > 28; fs -= 2) {
      const f = fs / 100
      let lines = 1, x = 0
      this.words.forEach((_, i) => { const ww = w[i] * f; if (x && x + space * f + ww > lane) { lines++; x = ww } else x += (x ? space * f : 0) + ww })
      if (lines <= maxLines && lines * fs * 0.9 + (this.hasLead ? fs * 0.3 : 0) <= band) break
    }
    this.el.style.setProperty('--fs', fs.toFixed(1) + 'px')
    this.el.style.setProperty('--lane', lane.toFixed(0) + 'px')
    // a capped title is checked against the real layout (the browser balances the lines, so the width model can be a pixel short)
    if (maxLines < 99) {
      const tops = () => new Set([...this.el.querySelectorAll<HTMLElement>('.title .tl.big .dw')].map(e => Math.round(e.offsetTop))).size
      for (let g = 0; g < 14 && fs > 28 && tops() > maxLines; g++) { fs -= 2; this.el.style.setProperty('--fs', fs.toFixed(1) + 'px') }
    }
    this.placeInfo(mobile)
  }

  /** wave-22 #23: the first screen's info block is centred at 54% of the window, but the Ovid monument above it is two lines now, so on a short window the block
   *  is moved down until it clears the head by 36px (it was 130px clear with the one-line epigraph). Phones anchor it at the bottom (CSS), nothing to do. */
  private placePrologue(vw: number, vh: number) {
    const info = this.infoEl, head = this.el.querySelector<HTMLElement>('.head')
    if (!info || !head) return
    if (vw <= 760) { info.style.top = ''; return }
    info.style.top = Math.round(Math.max(vh * 0.54, head.offsetTop + head.offsetHeight + 36 + info.offsetHeight / 2)) + 'px'
  }

  /** w11: the height of the info block (phones hang an interest title just above it) and, for the stops in PULL_UP, the info pulled up under the title on desktop */
  placeInfo(mobile: boolean) {
    const info = this.infoEl, head = this.el.querySelector<HTMLElement>('.head')
    if (!info || !head) return
    this.el.style.setProperty('--ih', info.offsetHeight + 'px')
    if (PULL_UP.has(this.id) && !mobile) {
      info.style.bottom = 'auto'
      info.style.top = Math.round(head.offsetTop + head.offsetHeight + 26) + 'px'
    } else { info.style.top = ''; info.style.bottom = '' }
  }

  /** 8C: the stop list of an area card is the first thing to give way when the copy gets tight (a short window): names, then numbers, then the row.
   *  Returns true when the mode changed (the title is fitted again, the card is shorter now). */
  trimStops(): boolean {
    const row = this.infoEl?.querySelector<HTMLElement>('.stops')
    const head = this.el.querySelector<HTMLElement>('.head')
    if (!row || !head || !this.infoEl) return false
    const before = row.className
    // w11: a labelled row (market's "Also in Research") is ONE row: the position badges go first when the chips do not fit
    if (row.classList.contains('one')) {
      row.classList.remove('is-short')
      const chips = [...row.querySelectorAll<HTMLElement>('.chip')]
      if (chips.length > 1 && chips.some(c => c.offsetTop > chips[0].offsetTop + 2)) row.classList.add('is-short')
    }
    for (const mode of ['', 'is-num', 'is-off']) {
      row.classList.remove('is-num', 'is-off')
      if (mode) row.classList.add(mode)
      if (this.infoEl.offsetTop >= head.offsetTop + head.offsetHeight + 12) break
    }
    return row.className !== before
  }

  /** (re)measure the copy blocks after fonts and sizes settled */
  measureRects() {
    this.rects = []
    for (const e of [this.el.querySelector('.head'), this.infoEl] as (HTMLElement | null)[]) {
      if (!e || this.copy.kind === 'name' && e.classList.contains('head')) continue
      const l = e.offsetLeft, t = e.offsetTop
      this.rects.push({ l, t, r: l + e.offsetWidth, b: t + e.offsetHeight })
    }
  }
  get inView() { return this.on || this.ti * (1 - this.to) > 0.4 }

  private startCount() {
    if (this.counted || !this.fig || !this.fnum) return
    this.counted = true
    if (isRm()) return
    // Only the real figure is ever on screen: its digits rise into place one after another (a count-up would show
    // values that are not the figure, and a paused frame or a video would freeze one of them).
    const f = this.fig, num = this.fnum
    const text = fmtNum(f.target, f.dec, f.comma)
    num.textContent = ''
    num.style.clipPath = 'inset(-0.1em -0.05em 0 -0.05em)'
    const digits = [...text].map(ch => h('span', { text: ch, style: 'display:inline-block;transform:translateY(105%);opacity:0' }))
    num.append(...digits)
    window.setTimeout(() => {
      digits.forEach((d, i) => animate(d, { translateY: ['105%', '0%'], opacity: [0, 1], duration: 620, delay: i * 55, ease: 'out(4)' }))
    }, 380)
  }

  // ---- deconstructable type ----------------------------------------------------------------------------------------------
  private get dco(): Deco | null { return this.hero ? this.hero.deco : this.deco }
  /** idle-time: build the paused timeline so the first frame of a title never pays for it */
  buildDx() { if (!this.hero) this.deco?.build(); else this.hero.deco?.build() }
  /** read phase of the letter geometry (layout()): the centre of every letter relative to its title block */
  readDx() {
    if (!this.deco || !this.titleEl) return null
    const fe = this.bigFs
    return { m: this.deco.read(this.titleEl), size: fe ? parseFloat(getComputedStyle(fe).fontSize) || 100 : 100 }
  }
  writeDx(r: ReturnType<Overlay['readDx']>) { if (r && this.deco) this.deco.write(r.m, r.size) }
  buildHero(vw: number, vh: number): boolean { const ok = !!this.hero?.build(vw, vh); if (ok) this.hero!.deco?.build(); return ok }
  heroUpdate(project: (p: number[]) => { x: number; y: number }, t: number) { if (this.vis) this.hero?.update(project, t) }

  private leaveDx() {
    this.dxOn = false; this.el.classList.remove('dx', 'xf'); this.xf = false; this.jumpClocked = false; this.clock.stop(); this.pendingClock = false
    this.dco?.rest()
    this.cuedIn = this.cuedOut = false
  }

  /** drive the title's timeline from the flight window; the letters are the only thing that moves (the head's own scrub is switched off by .dx) */
  private driveDx(ti: number, to0: number, jumpEdge: boolean, rig: Rig, x: LegCtx & { a: string; b: string }) {
    const d = this.dco
    if (!d) return
    if (isRm()) { if (this.dxOn) this.leaveDx(); this.prevVis = this.vis; return }
    const arm = x.arm === this.id
    // w11: on a set-piece leg the outgoing title holds still and cross-fades (CSS .xf, 0.3 s) instead of breaking apart across the doorway
    const setOut = x.set && this.id === x.a && x.a !== x.b
    const to = setOut ? 0 : to0
    const xf = setOut && to0 > 0.03
    if (xf !== this.xf) { this.xf = xf; this.el.classList.toggle('xf', xf) }
    if (!this.vis && !arm) { this.prevVis = false; this.jumpClocked = false; if (this.xf && !setOut) { this.xf = false; this.el.classList.remove('xf') } return }   // w12: the class stays on for the whole set-piece leg, not only while the title is still visible
    if (!this.dxOn) { this.dxOn = true; this.el.classList.add('dx') }
    // w11: a rail jump starts the assemble when the camera is within 30% of the target (the copy is still hidden), so the title is whole as it appears
    if (arm && !this.jumpClocked && !document.documentElement.classList.contains('is-loading')) {
      this.jumpClocked = true; this.pendingClock = false; this.clock.start(0, 760)
      cue('type:assemble', d.n); this.cuedIn = true; this.cuedOut = false
    }
    // an arrival that was not scrubbed (first view after the gate) assembles on the clock instead
    if (!this.jumpClocked && (!this.prevVis || jumpEdge) && ti > 0.98 && to < 0.02) { this.clock.stop(); this.pendingClock = true }
    this.prevVis = this.vis
    if (this.pendingClock && !document.documentElement.classList.contains('is-loading')) {
      this.pendingClock = false; this.clock.start(); cue('type:assemble', d.n); this.cuedIn = true; this.cuedOut = false
    }
    if (to < 0.0005 && this.clock.ms >= 0 && ti < 0.98 && !this.jumpClocked) this.clock.stop()      // scrubbing took over again
    const ms = msFor(ti, to, this.pendingClock ? 0 : this.clock.ms)
    // once per transition: the cue fires when the title starts to form / starts to break, and again when a scroll back re-forms it
    if (ti > 0.03 && to < 0.001 && !this.cuedIn) { this.cuedIn = true; this.cuedOut = false; cue('type:assemble', d.n) }
    else if (ti < 0.01) this.cuedIn = false
    this.toMax = to < 0.0005 ? 0 : Math.max(this.toMax, to)
    if (to > 0.03 && !this.cuedOut) { this.cuedOut = true; cue('type:shatter', d.n) }
    else if (this.cuedOut && to < 0.35 && this.toMax > 0.6) { this.cuedOut = false; this.toMax = to; cue('type:assemble', d.n) }
    else if (to < 0.0005) this.cuedOut = false
    d.drive(ms, rig)
  }

  /** pointer + camera tilt and the travel heading go to CSS as four numbers (the glyphs are never re-transformed for them) */
  applyRig(rig: Rig, to: number) {
    if (!this.dxOn || !this.vis) return
    const v = this.vars
    const ry = clamp(-rig.yaw * 0.38, -22, 22) + rig.px * 3.2, rx = clamp(rig.pitch * 0.3, -12, 12) - rig.py * 2.2
    const px = clamp(rig.px * 0.8 - rig.yaw / 30, -1.2, 1.2), py = clamp(rig.py * 0.8 + rig.pitch / 24, -1.2, 1.2)
    const st = this.el.style
    if (!(Math.abs(px - v.px) < 0.004)) { v.px = px; st.setProperty('--px', px.toFixed(3)) }
    if (!(Math.abs(py - v.py) < 0.004)) { v.py = py; st.setProperty('--py', py.toFixed(3)) }
    if (!(Math.abs(ry - v.ry) < 0.03) || !(Math.abs(rx - v.rx) < 0.03)) {
      v.ry = ry; v.rx = rx; st.setProperty('--ry', ry.toFixed(2)); st.setProperty('--rx', rx.toFixed(2))
      // a title at rest carries no transform at all (it stays pixel-crisp); the plane tilt only exists while it is tilted
      st.setProperty('--tf', Math.abs(ry) + Math.abs(rx) < 0.12 ? 'none' : `perspective(1600px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`)
    }
    if (to > 0.0005) {
      const tx = rig.dirX * rig.dm * 0.16, ty = rig.dirY * rig.dm * 0.16
      if (!(Math.abs(tx - v.tdx) < 1)) { v.tdx = tx; st.setProperty('--tdx', tx.toFixed(0) + 'px') }
      if (!(Math.abs(ty - v.tdy) < 1)) { v.tdy = ty; st.setProperty('--tdy', ty.toFixed(0) + 'px') }
    }
  }

  apply(A: string, B: string, k: number, wp: number, firstBeatWp: number, jumping: boolean, rig: Rig, jumpEdge: boolean, x: LegCtx) {
    let ti = 0, to = 1, want = false
    if (A === B) { if (this.id === A) { ti = 1; to = 0; want = true } }
    else if (this.id === A) { ti = 1; to = sstep(0, 0.3, k); want = this.on ? k < 0.04 : k < 0.02 }
    else if (this.id === B) {
      ti = sstep(this.inStart, 0.96, k); to = 0; want = this.on ? k >= 0.78 : k >= 0.82
      // w11: on a set-piece leg nothing of the incoming stop shows until the leg is past 0.6 (the warped copy clock would bring it up in the doorway)
      if (x.set) { const g = sstep(0.6, 0.72, x.lt); ti = Math.min(ti, g); if (g < 1) want = false }
    }
    if (jumping) want = false
    const vis = ti * (1 - to) > 0.002 || want
    if (Math.abs(ti - this.ti) > 0.002) { this.ti = ti; this.el.style.setProperty('--ti', ti.toFixed(3)) }
    if (Math.abs(to - this.to) > 0.002) { this.to = to; this.el.style.setProperty('--to', to.toFixed(3)) }
    if (vis !== this.vis) { this.vis = vis; this.el.classList.toggle('vis', vis) }
    if (want !== this.on) {
      this.on = want; this.el.classList.toggle('in', want)
      if (want) this.startCount()
    }
    const live = want && ti * (1 - to) > 0.5
    if (live !== this.live) { this.live = live; this.el.classList.toggle('live', live) }
    this.driveDx(ti, to, jumpEdge, rig, { ...x, a: A, b: B })
    this.applyRig(rig, to)
    if (this.mx) {
      // the morph runs only while the first screen is the current stop, fully up, still and uncovered (no loader, Index, jump or open dialog); it holds
      // its frame under the site's Pause. Off screen or under reduced motion it rests on the Latin at once. While the stop is being left (the title's
      // shatter has begun, `to`) or has not been reached yet (`want`), whatever was showing goes back to the Latin: the letter shatter is Deco's and
      // it only has the Latin letters, so the line it breaks apart must be on screen; the cycle then starts over from the Latin hold.
      if (!vis || isRm()) this.mx.reset()
      else if (!want || to > 0.0005) this.mx.leave()
      else {
        const hc = document.documentElement.classList
        this.mx.tick(performance.now(), live && !appState.paused && !hc.contains('is-loading') && !hc.contains('in-index') && !hc.contains('jumping') && !document.querySelector('dialog[open]'))
      }
    }
    if (this.beats.length && want) {
      // waypoints past the last beat (the closing bust) show no figure
      const raw = Math.round(wp - firstBeatWp)
      const b = raw >= this.beats.length ? -1 : clamp(raw, 0, this.beats.length - 1)
      if (b !== this.beat) { this.beat = b; this.beats.forEach((e, i) => e.classList.toggle('on', i === b)) }
    }
  }
}

export class OverlayLayer {
  readonly root: HTMLElement
  readonly list: Overlay[] = []
  private measureEl: HTMLElement
  private firstBeatWp = 0
  private wps: Waypoint[]
  private rig = new Rig()
  private wasJumping = false
  private vw = innerWidth; private vh = innerHeight
  private heroBuilt = false
  private shaderT = 0
  private heroSub = false
  private jp0 = 0
  private goalCache = { p: -1, id: '' }

  constructor(wps: Waypoint[], env: OverlayEnv) {
    this.wps = wps
    this.root = h('div', { id: 'overlays', role: 'presentation' })
    // overlay ids in flight order, with the area and the featured project ids gathered from their waypoints
    const order: string[] = []
    const meta = new Map<string, { area: string; tvs: string[] }>()
    wps.forEach((w, i) => {
      if (!meta.has(w.overlay)) { order.push(w.overlay); meta.set(w.overlay, { area: w.area, tvs: [] }) }
      const m = meta.get(w.overlay)!
      for (const t of w.tvs ?? []) if (!m.tvs.includes(t)) m.tvs.push(t)
      if (w.overlay === 'offboard' && !this.firstBeatWp) this.firstBeatWp = i
    })
    for (const id of order) {
      const m = meta.get(id)!
      this.list.push(new Overlay(copyFor(id, m.area, m.tvs), env, wps.find(w => w.overlay === id)))
    }
    this.root.append(...this.list.map(o => o.el))
    this.measureEl = h('div', { class: 'ov-measure', 'aria-hidden': 'true' })
    document.body.append(this.measureEl)
    // the letter timelines are cheap but not free: one per idle slot
    for (const o of this.list) idle(() => o.buildDx())
  }

  layout(vw: number, vh: number) {
    this.vw = vw; this.vh = vh
    const m = this.measureEl
    const measure = (words: string[]) => {
      m.innerHTML = ''
      const t = h('h2', { class: 'title' })
      t.style.setProperty('--fs', '100px')
      // same structure as the live title (a word of letter boxes), so the fit sees the same widths
      const spans = words.map(w => { const e = h('span', { class: 'tl big', style: 'display:inline-block;white-space:nowrap' }); splitChars(e, w); return e })
      const sp = h('span', { class: 'tl big', text: 'A A', style: 'display:inline-block;white-space:pre' })
      const sp0 = h('span', { class: 'tl big', text: 'AA', style: 'display:inline-block;white-space:pre' })
      t.append(...spans, sp, sp0); m.append(t)
      return { w: spans.map(s => s.getBoundingClientRect().width), space: sp.getBoundingClientRect().width - sp0.getBoundingClientRect().width }
    }
    for (const o of this.list) { o.fit(vw, vh, measure); if (o.trimStops()) o.fit(vw, vh, measure) }
    for (const o of this.list) o.measureRects()
    m.innerHTML = ''
    // letter geometry (the centre of each letter in its title block): all reads first, then all writes
    const geo = this.list.map(o => o.readDx())
    this.list.forEach((o, i) => o.writeDx(geo[i]))
    this.heroBuilt = false
    this.layoutHero()
  }

  /** the hero name needs the 900-weight Bodoni and the live camera; it is (re)built whenever both are there */
  private layoutHero() {
    const f = (window as unknown as { __v3?: { field?: { onFrame?: (cb: (t: number) => void) => void } } }).__v3?.field
    if (!f) return
    // the plane is placed right after the field's own render, with the camera and the shader time of that very frame
    if (!this.heroSub && f.onFrame) { this.heroSub = true; f.onFrame((t: number) => { this.shaderT = t; this.heroFrame() }) }
    let ok = true
    for (const o of this.list) if (o.copy.kind === 'name') ok = o.buildHero(this.vw, this.vh) && ok
    this.heroBuilt = ok
  }

  private heroFrame() {
    const f = (window as unknown as { __v3?: { field?: { project?: (p: number[]) => { x: number; y: number } } } }).__v3?.field
    if (!f?.project) return
    for (const o of this.list) o.heroUpdate(p => f.project!(p), this.shaderT)
  }

  /** the scroll goal 0..1: the track is range + one viewport tall (ui.ts), so the range is its height minus the viewport */
  private goalP(): number {
    const tr = document.getElementById('track')
    const range = (tr?.offsetHeight ?? 0) - innerHeight
    return range > 1 ? clamp(window.scrollY / range) : 0
  }
  private overlayAtP(p: number): string {
    if (Math.abs(p - this.goalCache.p) > 1e-6) this.goalCache = { p, id: flightAt(p).overlayNext }
    return this.goalCache.id
  }

  /** copy blocks currently on screen (anchor tags avoid them) */
  activeRects() {
    const out: { l: number; t: number; r: number; b: number }[] = []
    for (const o of this.list) if (o.inView) out.push(...o.rects)
    return out
  }

  update(st: FlightState, wp: number, jumping: boolean) {
    const k = clamp(st.overlayK)
    const now = performance.now()
    const rig = this.rig
    rig.dm = Math.max(this.vw, this.vh) * 0.6
    rig.step(st, this.wps, 1 - sstep(0.004, 0.05, k), now)
    const jumpEdge = this.wasJumping && !jumping
    if (jumping && !this.wasJumping) this.jp0 = st.p ?? 0
    this.wasJumping = jumping
    if (!this.heroBuilt) this.layoutHero()
    // w11: a rail jump arms its destination title once the camera is within 30% of the jump left to fly (the goal is the scroll position)
    let arm: string | null = null
    if (jumping && st.p != null) {
      const goal = this.goalP(), span = Math.abs(goal - this.jp0)
      if (span > 1e-4 && Math.abs(goal - st.p) <= ARM_LEFT * span) arm = this.overlayAtP(goal)
    }
    const wa = st.wp != null ? this.wps[st.wp]?.id : undefined, wb = st.next != null ? this.wps[st.next]?.id : undefined
    const set = !!wa && !!wb && wa !== wb && SET_LEGS.has(`${wa}>${wb}`)
    const lt = (st as FlightState & { raw?: number }).raw ?? st.overlayK
    const x: LegCtx = { arm, set, lt }
    for (const o of this.list) o.apply(st.overlay, st.overlayNext, k, wp, this.firstBeatWp, jumping, rig, jumpEdge, x)
    this.heroFrame()
  }
}
