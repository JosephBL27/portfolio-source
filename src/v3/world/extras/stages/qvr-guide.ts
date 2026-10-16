// The QVR instrument's plain-language layer (stages/qvr.ts owns the scene and the maths; this file owns the words and the DOM that explains them):
//   words      what each dial setting means, a pin's tag, the walkthrough copy. Plain sentences; the parameter values stay small and secondary.
//   Axes       an SVG over the canvas whose lines and words are projected from the object every frame (strike along the front edge, expiry along the right
//              edge, and height as a ruler up beside the post: an arrow, 20/40/60% marks and a plain-words callout), so they stay attached while the visitor
//              turns it
//   Tour       the four-step walkthrough card. A vanilla TypeScript + CSS port of the 21st.dev "Product Tour Popover" by shadcnspace (a step popover with a
//              sliding, fading body, progress dots that stretch to the current step, Skip and Next): React and Radix dropped, anime.js for the slide
// Everything it creates is appended to the stage's data-proof="skip" root: simulated numbers in a labelled simulation, never copy that states a fact.
import { animate } from 'animejs'
import './qvr-guide.css'

export type P = [number, number]
const NS = 'http://www.w3.org/2000/svg'

// ---------------------------------------------------------------------------------------------------------------- words
export const levelWord = (v: number) => (v < 0.13 ? 'quiet' : v < 0.19 ? 'calm' : v < 0.26 ? 'nervous' : 'stressed')
export const levelLine = (v: number) => `At the money, near-term options price in swings of about ${Math.round(v * 100)}% a year.`
export const skewWord = (r: number) => (r <= -0.72 ? 'steep' : r <= -0.45 ? 'tilted' : r <= -0.15 ? 'slight' : r <= 0.1 ? 'flat' : 'reversed')
export const skewLine = (r: number) => (
  r <= -0.72 ? 'Protection against a fall costs far more than a bet on a rise.'
    : r <= -0.45 ? 'Protection against a fall costs more than a bet on a rise.'
      : r <= -0.15 ? 'Protection against a fall costs a little more than a bet on a rise.'
        : r <= 0.1 ? 'Protection and bets on a rise cost about the same.'
          : 'Bets on a rise cost more than protection against a fall.')
export const smileWord = (e: number) => (e < 0.5 ? 'shallow' : e < 0.95 ? 'moderate' : e < 1.35 ? 'deep' : 'very deep')
export const smileLine = (e: number) => (
  e < 0.5 ? 'Options far from the current price cost little more than those at it.'
    : e < 0.95 ? 'Options far from the current price cost noticeably more than those at it.'
      : e < 1.35 ? 'Options far from the current price cost much more than those at it.'
        : 'Options far from the current price carry a steep premium.')
export const CAPPED = ' Held at its limit for this skew, so the prices stay consistent.'

/** a pin's strike in plain words, from its strike as a share of the spot price (the model's forward moneyness, rates ignored in this simulation) */
export function strikeText(kOverF: number) {
  const d = Math.round(kOverF - 100)
  if (Math.abs(d) <= 1) return 'strike at the money'
  return `strike ${Math.abs(d)}% ${d < 0 ? 'below' : 'above'} today\u2019s price`
}
/** a maturity in years, in words ("20 days", "3 months", "1.5 years") */
export function tenorText(T: number) {
  const d = T * 365
  if (d < 7.5) return '1 week'
  if (d < 60) return `${Math.round(d)} days`
  if (T < 1 - 1e-6) { const m = Math.round(T * 12); return `${m} months` }
  const y = Math.round(T * 10) / 10
  return `${y === Math.round(y) ? Math.round(y) : y.toFixed(1)} ${y === 1 ? 'year' : 'years'}`
}
export const expiryText = (T: number) => `expires in ${tenorText(T)}`

export interface TourStep { title: string; text: string }
export const TOUR: TourStep[] = [
  { title: 'One pin is one option', text: 'Each brass pin is one option: a strike price and an expiry date. Hover or tap a pin and its tag spells it out.' },
  { title: 'Height is implied volatility', text: 'A taller pin means the market expects bigger price moves. Implied volatility is that expectation, quoted as a yearly percentage.' },
  { title: 'Why the surface leans', text: 'Protection against a fall costs more than a bet on a rise, so the left side stands taller. That lean is the skew.' },
  { title: 'A market shock', text: 'A scare hits. Short-dated pins jump first and highest, long-dated ones barely move, then it all settles back. Simulated, not a forecast.' },
]

// ---------------------------------------------------------------------------------------------------------------- axes
interface Ax { path: SVGPathElement; heads: SVGPathElement[]; txt: SVGTextPathElement[]; tx: SVGTextElement[]; flip: boolean | null; dy: number; set: string }
/** do three words fit along a line `len` px long, the middle one centred */
const fits3 = (f: [string, string, string], len: number, cw: number) => f[0].length * cw + 18 <= len / 2 - (f[1].length * cw) / 2 && f[2].length * cw + 18 <= len / 2 - (f[1].length * cw) / 2

export interface AxesIn {
  on: boolean
  /** a small instrument (a phone, or a narrow window): smaller type, shorter words */
  small: boolean
  centre: P
  /** screen ends of each axis: low strike to high strike; the front row to the back row; the post's foot to its top */
  strike: [P, P] | null
  time: [P, P] | null
  vol: [P, P] | null
  /** where the at-the-money strike falls along the strike axis, 0..1 from the low end */
  atm: number
  /** the marks on the height ruler (20, 40, 60 %): screen position of each, low to high */
  marks: P[] | null
  /** the highest screen y the plain-words callout may take (below the top bar; on a phone, below the copy's title) */
  minY: number
  /** the left-most screen x the callout may take (right of the copy lane on a desktop) */
  minX: number
}
export const VOL_MARKS = ['20%', '40%', '60%']

export class Axes {
  readonly svg: SVGSVGElement
  readonly iv: HTMLDivElement
  private ax: Record<'strike' | 'time' | 'vol', Ax>
  private tick: SVGPathElement
  /** the height ruler: a dark halo under its line (so it reads over bright pins), its marks, their labels, and the word at the foot */
  private halo: SVGPathElement
  private marks: SVGPathElement
  private markTx: SVGTextElement[] = []
  private ivK: HTMLElement
  private ivW = 0
  private ivH = 0
  private ivMax = 0
  private lastSmall: boolean | null = null

  constructor(host: HTMLElement) {
    this.svg = document.createElementNS(NS, 'svg'); this.svg.setAttribute('class', 'qvr-axes'); this.svg.setAttribute('aria-hidden', 'true')
    const mk = (id: string, texts: number): Ax => {
      const path = document.createElementNS(NS, 'path'); path.setAttribute('class', 'ax'); path.id = `qvr-ax-${id}`
      this.svg.append(path)
      const heads = [0, 1].map(() => { const h = document.createElementNS(NS, 'path'); h.setAttribute('class', 'head'); this.svg.append(h); return h })
      const txt: SVGTextPathElement[] = [], tx: SVGTextElement[] = []
      for (let i = 0; i < texts; i++) {
        const t = document.createElementNS(NS, 'text'), tp = document.createElementNS(NS, 'textPath')
        const anchor = i === 0 ? 'start' : i === 2 ? 'end' : 'middle'
        tp.setAttribute('href', `#qvr-ax-${id}`); tp.setAttribute('startOffset', i === 0 ? '0%' : i === 2 ? '100%' : '50%'); tp.setAttribute('text-anchor', anchor)
        t.setAttribute('text-anchor', anchor)
        t.append(tp); this.svg.append(t); txt.push(tp); tx.push(t)
      }
      return { path, heads, txt, tx, flip: null, dy: NaN, set: '' }
    }
    const strike = mk('strike', 4), time = mk('time', 4)
    this.halo = document.createElementNS(NS, 'path'); this.halo.setAttribute('class', 'halo'); this.svg.append(this.halo)
    this.ax = { strike, time, vol: mk('vol', 0) }
    this.ax.vol.path.classList.add('vol')
    this.marks = document.createElementNS(NS, 'path'); this.marks.setAttribute('class', 'vmarks'); this.svg.append(this.marks)
    for (let k = 0; k < VOL_MARKS.length + 1; k++) { const t = document.createElementNS(NS, 'text'); t.setAttribute('class', 'vt'); t.setAttribute('text-anchor', 'end'); t.textContent = k < VOL_MARKS.length ? VOL_MARKS[k] : 'CALMER'; this.svg.append(t); this.markTx.push(t) }
    this.tick = document.createElementNS(NS, 'path'); this.tick.setAttribute('class', 'tick'); this.svg.append(this.tick)
    this.iv = document.createElement('div'); this.iv.className = 'qvr-iv'
    this.iv.innerHTML = '<span class="k"></span><span class="g">a taller pin means the market expects bigger price moves</span>'
    this.ivK = this.iv.querySelector('.k') as HTMLElement
    this.ivK.textContent = 'Height = implied volatility'
    host.append(this.svg, this.iv)
  }

  /** highlight some axes (the walkthrough, a turning dial): any of 'strike' | 'time' | 'vol' */
  light(keys: ('strike' | 'time' | 'vol')[]) {
    for (const key of ['strike', 'time', 'vol'] as const) this.ax[key].path.classList.toggle('lit', keys.includes(key))
    this.iv.classList.toggle('lit', keys.includes('vol'))
    this.marks.classList.toggle('lit', keys.includes('vol'))
  }

  private head(h: SVGPathElement, tip: P, from: P, big = false) {
    const dx = tip[0] - from[0], dy = tip[1] - from[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, s = big ? 12 : 8, w = big ? 5.2 : 3.6
    h.setAttribute('d', `M${tip[0].toFixed(1)} ${tip[1].toFixed(1)}L${(tip[0] - ux * s - uy * w).toFixed(1)} ${(tip[1] - uy * s + ux * w).toFixed(1)}L${(tip[0] - ux * s + uy * w).toFixed(1)} ${(tip[1] - uy * s - ux * w).toFixed(1)}Z`)
  }

  /** lay one axis out: start at the left end (the lower end for an upright line), so the words always read upright; `labels` are [low end, middle, high end],
   *  `title` a second row of words under (or over) them, centred */
  private lay(a: Ax, lo0: P, hi0: P, labels: [string, string, string], midAt: number, title: string, side: 'in' | 'out', centre: P, gap: number, arrows: boolean, ext = 0) {
    let lo = lo0, hi = hi0
    if (ext > 0) {
      const dx = hi0[0] - lo0[0], dy = hi0[1] - lo0[1], l = Math.hypot(dx, dy) || 1
      lo = [lo0[0] - (dx / l) * ext, lo0[1] - (dy / l) * ext]; hi = [hi0[0] + (dx / l) * ext, hi0[1] + (dy / l) * ext]
    }
    const vertical = Math.abs(hi[0] - lo[0]) < Math.abs(hi[1] - lo[1]) * 0.6
    const flip = vertical ? lo[1] < hi[1] : lo[0] > hi[0]
    a.flip = flip
    const s = flip ? hi : lo, e = flip ? lo : hi
    a.path.setAttribute('d', `M${s[0].toFixed(1)} ${s[1].toFixed(1)}L${e[0].toFixed(1)} ${e[1].toFixed(1)}`)
    if (arrows) { this.head(a.heads[0], e, s); this.head(a.heads[1], s, e) } else { this.head(a.heads[0], hi, lo, true); a.heads[1].removeAttribute('d') }
    if (!a.txt.length) return
    // glyph-up is the left normal of the reading direction; put the words on the requested side of the line
    const dx = e[0] - s[0], dy = e[1] - s[1], l = Math.hypot(dx, dy) || 1
    const up: P = [dy / l, -dx / l], mx = (s[0] + e[0]) / 2 - centre[0], my = (s[1] + e[1]) / 2 - centre[1]
    const upIsOut = up[0] * mx + up[1] * my > 0
    const wantUp = side === 'out' ? upIsOut : !upIsOut
    const d = wantUp ? -gap : gap + 7, d2 = wantUp ? d - 17 : d + 17
    if (d !== a.dy) { a.dy = d; for (let k = 0; k < 3; k++) a.tx[k].setAttribute('dy', String(d)); a.tx[3].setAttribute('dy', String(d2)) }
    const key = (flip ? 'f' : 'n') + labels.join('|') + midAt.toFixed(3) + title
    if (key !== a.set) {
      a.set = key
      const [w0, wm, w1] = flip ? [labels[2], labels[1], labels[0]] : labels
      a.txt[0].textContent = w0; a.txt[1].textContent = wm; a.txt[2].textContent = w1; a.txt[3].textContent = title
      const mid = flip ? 1 - midAt : midAt
      a.txt[1].setAttribute('startOffset', `${(mid * 100).toFixed(1)}%`)
    }
  }

  update(i: AxesIn) {
    if (!i.on) return
    if (i.small !== this.lastSmall) { this.lastSmall = i.small; this.svg.parentElement?.classList.toggle('small', i.small); this.ivK.textContent = i.small ? 'Height = implied vol' : 'Height = implied volatility'; this.ivW = 0; this.ivH = 0; this.ivMax = 0 }
    const { strike, time, vol } = i
    const cw = i.small ? 6.4 : 8.1
    if (strike) {
      const len = Math.hypot(strike[1][0] - strike[0][0], strike[1][1] - strike[0][1])
      // richest first; the first that fits wins. An end word needs its own length plus a gap before the middle word; an empty end word needs nothing
      interface Form { w: [string, string, string]; gap?: number; title?: string }
      const forms: Form[] = [
        { w: ['STRIKE PRICE  \u00b7  DOWNSIDE (PUTS)', 'AT THE MONEY', 'UPSIDE (CALLS)'] },
        { w: ['STRIKE PRICE  \u00b7  DOWNSIDE', 'AT THE MONEY', 'UPSIDE'] },
        { w: ['STRIKE  \u00b7  DOWNSIDE', 'AT THE MONEY', 'UPSIDE'] },
        { w: ['STRIKE \u00b7 DOWNSIDE', 'AT THE MONEY', 'UPSIDE'], gap: 8 },
        // the axis name on a second row above the words: keeps "at the money" and its tick in a window too narrow for the name on the first row
        { w: ['DOWNSIDE', 'AT THE MONEY', 'UPSIDE'], title: 'STRIKE PRICE' },
      ]
      const fits = (f: [string, string, string], mid: number, gap = 14) => (f[0] ? f[0].length * cw + gap : 0) <= mid * len - (f[1].length * cw) / 2 && (f[2] ? f[2].length * cw + gap : 0) <= (1 - mid) * len - (f[1].length * cw) / 2
      let form = forms.find(f => fits(f.w, i.atm, f.gap)) ?? null
      // a short line (a small instrument): the end words with the name in the middle, then just the name, then a shorter name; each only where it fits
      if (!form) {
        const tries: [string, string, string][] = [['DOWNSIDE', 'STRIKE PRICE', 'UPSIDE'], ['LOW', 'STRIKE PRICE', 'HIGH'], ['', 'STRIKE PRICE', ''], ['', 'STRIKE', '']]
        form = { w: tries.find(f => fits(f, 0.5)) ?? tries[3] }
      }
      const words = form.w, atmShown = words[1] === 'AT THE MONEY'
      this.lay(this.ax.strike, strike[0], strike[1], words, atmShown ? i.atm : 0.5, form.title ?? '', 'in', i.centre, 5, true)
      // the at-the-money tick
      const fl = !!this.ax.strike.flip
      const f = fl ? 1 - i.atm : i.atm, s = fl ? strike[1] : strike[0], e = fl ? strike[0] : strike[1]
      const px = s[0] + (e[0] - s[0]) * f, py = s[1] + (e[1] - s[1]) * f, dx = e[0] - s[0], dy = e[1] - s[1], l = Math.hypot(dx, dy) || 1
      this.tick.setAttribute('d', atmShown ? `M${(px + dy / l * 5).toFixed(1)} ${(py - dx / l * 5).toFixed(1)}L${(px - dy / l * 5).toFixed(1)} ${(py + dx / l * 5).toFixed(1)}` : '')
    }
    if (time) {
      const len = Math.hypot(time[1][0] - time[0][0], time[1][1] - time[0][1])
      const full = ['2 YEARS', 'TIME TO EXPIRY', 'THIS WEEK'] as [string, string, string]
      const ends = ['2 YEARS', '', 'THIS WEEK'] as [string, string, string]
      let one = (full[0].length + full[2].length) * cw + 36 <= len && fits3(full, len, cw) ? full : ends
      // a line too short for its two end words runs on past the plinth until they fit. A small instrument has no room past either end (the near end
      // stands on the console), so it names the axis along the line instead and leaves the ends bare
      const need = (ends[0].length + ends[2].length) * cw + 40
      let ext = 0
      if (one === ends && len < need) {
        if (i.small) one = ['', len >= full[1].length * cw + 16 ? full[1] : 'EXPIRY', '']
        else ext = Math.min(70, (need - len) / 2)
      }
      this.lay(this.ax.time, time[0], time[1], one, 0.5, one[1] || !one[0] ? '' : 'TIME TO EXPIRY', 'out', i.centre, 6, true, ext)
    }
    if (vol) {
      this.lay(this.ax.vol, vol[0], vol[1], ['', '', ''], 0.5, '', 'out', i.centre, 0, false)
      this.halo.setAttribute('d', this.ax.vol.path.getAttribute('d') ?? '')
      // the ruler's marks run to the left of the line (the words side). A label is drawn only where it clears every label already drawn (the foot word
      // first, then the top mark, then the rest): a small instrument keeps its ticks and drops the numerals that would run into each other
      const mk = i.marks, nM = Math.min(mk?.length ?? 0, VOL_MARKS.length)
      const foot = vol[0], top = vol[1]
      const minGap = i.small ? 11 : 13, cwv = i.small ? 5.6 : 7.35
      const ys: number[] = [], shown: number[] = []
      const slot = (k: number, x: number, y: number) => { ys[k] = y; const t = this.markTx[k]; t.setAttribute('x', (x - 11).toFixed(1)); t.setAttribute('y', (y + 3.5).toFixed(1)) }
      let d = ''
      for (let k = 0; k < nM; k++) { const [x, y] = (mk as P[])[k]; d += `M${x.toFixed(1)} ${y.toFixed(1)}L${(x - 7).toFixed(1)} ${y.toFixed(1)}`; slot(k, x, y) }
      d += `M${foot[0].toFixed(1)} ${foot[1].toFixed(1)}L${(foot[0] - 7).toFixed(1)} ${foot[1].toFixed(1)}`
      slot(VOL_MARKS.length, foot[0], foot[1])
      for (const k of [VOL_MARKS.length, ...Array.from({ length: nM }, (_, j) => nM - 1 - j)]) {
        if (k < VOL_MARKS.length && k >= nM) continue
        if (shown.every(j => Math.abs(ys[j] - ys[k]) >= minGap)) shown.push(k)
      }
      for (let k = 0; k <= VOL_MARKS.length; k++) { const t = this.markTx[k]; if (shown.includes(k)) t.removeAttribute('display'); else t.setAttribute('display', 'none') }
      this.marks.setAttribute('d', d)
      // the plain-words callout: left of the mark labels, its top at the arrow's tip, its right edge clear of the widest label that stands beside it
      const lineX = Math.min(top[0], foot[0], ...(mk ?? []).slice(0, nM).map(m => m[0]))
      const y = Math.max(i.minY, top[1] - 8)
      if (!this.ivH) this.ivH = this.iv.offsetHeight || 56
      let lw = 3 * cwv
      for (const k of shown) if (ys[k] + 8 > y && ys[k] - 8 < y + this.ivH) lw = Math.max(lw, this.markTx[k].textContent!.length * cwv)
      const rightEdge = lineX - 11 - lw - 12
      const maxW = Math.round(Math.max(i.small ? 80 : 110, Math.min(i.small ? 150 : 230, rightEdge - i.minX)))
      if (maxW !== this.ivMax) { this.ivMax = maxW; this.iv.style.maxWidth = `${maxW}px`; this.ivW = 0; this.ivH = 0 }
      if (!this.ivW) { this.ivW = this.iv.offsetWidth || 190; this.ivH = this.iv.offsetHeight || 56 }
      const x = Math.max(4, rightEdge - this.ivW)
      this.iv.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------- tour
export interface TourOpts {
  steps: TourStep[]
  rm: () => boolean
  /** a step became current (the scene shows what it talks about); `from` is -1 on open */
  onStep(i: number, from: number): void
  /** the card closed: 'skip' (Skip, Escape), 'done' (the last Next), 'leave' (the stop went away) */
  onClose(why: 'skip' | 'done' | 'leave'): void
}

/** the keys that fly the site (the flight stepper listens for them on `window`, and ignores any key aimed at an input) */
const FLIGHT_KEYS = new Set(['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', ' '])

export class Tour {
  readonly el: HTMLElement
  i = 0
  open_ = false
  private count: HTMLElement; private dots: HTMLElement[]; private range: HTMLInputElement
  private body: HTMLElement; private ttl: HTMLElement; private txt: HTMLElement; private simEl: HTMLElement; private host: HTMLElement
  private back: HTMLButtonElement; private next: HTMLButtonElement; private skip: HTMLButtonElement
  private anim: ReturnType<typeof animate> | null = null
  private opener: HTMLElement | null = null
  private heights = new Map<number, number>()

  constructor(host: HTMLElement, private o: TourOpts) {
    this.host = host
    const n = o.steps.length
    const el = this.el = document.createElement('section'); el.className = 'qvr-tour'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Guided tour of the volatility instrument')
    // every step's words sit in one hidden stack under the live step (one grid cell), so the card is as tall as its longest step and never jumps
    const ghost = o.steps.map(s => `<div><span class="t-ttl">${s.title}</span><span class="t-txt">${s.text}</span></div>`).join('')
    el.innerHTML = `<span class="t-count"></span><div class="t-dots">${'<i></i>'.repeat(n)}<input type="range" min="1" max="${n}" step="1" value="1" aria-label="Tour step"></div><button type="button" class="t-skip">Skip</button><button type="button" class="qvr-btn t-btn t-back">Back</button><button type="button" class="qvr-btn go t-btn t-next">Next</button><div class="t-body"><div class="t-ghost" aria-hidden="true">${ghost}</div><div class="t-step" aria-live="polite"><span class="t-ttl"></span><span class="t-txt"></span></div></div><span class="t-sim"><span class="t-simt"></span><span class="t-keys">← → step  ·  Esc skip</span></span>`
    const q = <T extends Element>(s: string) => el.querySelector(s) as T
    this.count = q('.t-count'); this.dots = [...el.querySelectorAll('.t-dots i')] as HTMLElement[]; this.range = q('input')
    this.body = q('.t-step'); this.ttl = q('.t-step .t-ttl'); this.txt = q('.t-step .t-txt'); this.simEl = q('.t-simt')
    this.back = q('.t-back'); this.next = q('.t-next'); this.skip = q('.t-skip')
    // after a click the focus goes back to the step control, so the arrow keys keep working
    const refocus = () => { try { this.range.focus({ preventScroll: true }) } catch { /* closed */ } }
    this.next.addEventListener('click', () => { this.go(this.i + 1); if (this.open_) refocus() })
    this.back.addEventListener('click', () => { this.go(this.i - 1); if (this.open_) refocus() })
    this.skip.addEventListener('click', () => this.close('skip'))
    this.range.addEventListener('input', () => this.go(Number(this.range.value) - 1))
    // keys aimed at the card stay at the card (the stop's own keys, the point-of-view nudge and the flight stepper all ignore an input): left and right
    // step the tour, Escape skips it
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); this.close('skip') } })
    // ... but the flight's own keys are never swallowed: the range lets go of the focus and hands the key to the stepper, so Page Down still flies on
    this.range.addEventListener('keydown', e => {
      if (e.altKey || e.ctrlKey || e.metaKey || !FLIGHT_KEYS.has(e.key)) return
      e.preventDefault(); e.stopPropagation()
      this.range.blur()
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, code: e.code, shiftKey: e.shiftKey, repeat: e.repeat, bubbles: true, cancelable: true }))
    })
    if (document.fonts?.ready) void document.fonts.ready.then(() => this.invalidate())
    host.append(el)
  }

  get isOpen() { return this.open_ }
  /** the honesty line the card carries while it is open (the console's own line steps aside) */
  setSim(text: string) { this.simEl.textContent = text }

  /** the card's height at width `w` (cached: the words and the fonts do not change between windows) */
  sizeFor(w: number): number {
    let h = this.heights.get(w)
    if (h === undefined) {
      const prev = this.el.style.width
      this.el.style.width = `${w}px`
      h = this.el.offsetHeight
      this.el.style.width = prev
      this.heights.set(w, h)
    }
    return h
  }
  invalidate() { this.heights.clear() }

  private paint(i: number) {
    const s = this.o.steps[i], n = this.o.steps.length
    this.count.textContent = `Step ${i + 1} of ${n}`
    this.ttl.textContent = s.title; this.txt.textContent = s.text
    this.dots.forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('past', k < i) })
    this.range.value = String(i + 1); this.range.setAttribute('aria-valuetext', `Step ${i + 1} of ${n}: ${s.title}`)
    this.back.disabled = i === 0
    this.next.textContent = i === n - 1 ? 'Done' : 'Next'
  }

  open(opener?: HTMLElement | null) {
    if (this.open_) return
    this.open_ = true; this.i = 0; this.opener = opener ?? null
    this.paint(0)
    this.el.classList.add('open'); this.host.classList.add('tour-open')
    this.o.onStep(0, -1)
    try { this.range.focus({ preventScroll: true }) } catch { /* not focusable yet */ }
  }

  go(to: number) {
    if (!this.open_) return
    const n = this.o.steps.length
    if (to >= n) { this.close('done'); return }
    to = Math.max(0, to)
    if (to === this.i) { this.range.value = String(to + 1); return }
    const from = this.i; this.i = to
    this.anim?.cancel(); this.anim = null
    const swap = () => { this.paint(to); if (!this.o.rm()) this.anim = animate(this.body, { opacity: [0, 1], x: [from < to ? 16 : -16, 0], duration: 220, ease: 'out(3)' }) }
    if (this.o.rm()) swap()
    else { this.dots.forEach((d, k) => { d.classList.toggle('on', k === to); d.classList.toggle('past', k < to) }); this.anim = animate(this.body, { opacity: 0, x: from < to ? -14 : 14, duration: 110, ease: 'out(2)', onComplete: swap }) }
    this.o.onStep(to, from)
  }

  close(why: 'skip' | 'done' | 'leave') {
    if (!this.open_) return
    this.open_ = false
    this.anim?.cancel(); this.anim = null
    this.body.style.opacity = ''; this.body.style.transform = ''
    this.el.classList.remove('open'); this.host.classList.remove('tour-open')
    this.o.onClose(why)
    if (why !== 'leave') { const t = this.opener; if (t && !t.hasAttribute('disabled')) try { t.focus({ preventScroll: true }) } catch { /* gone */ } }
  }

  dispose() { this.anim?.cancel(); this.el.remove() }
}
