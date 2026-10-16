// The case view: how a work opens up. A full-screen <dialog> grows out of the TV screen (or an
// index row) with the work's reel running behind it the whole way, so opening a work feels like
// flying into the set. Then the case unfolds over the reel; on wide screens the reel docks into a
// floating panel in front of a halftone flower as you read. Prev/next is a channel change.
// Motion owns the shell's DOM motion (the fly, reveals, lightbox). Anime owns the title's letters (splitText: they fly out of
// the TV screen and assemble, then shatter back on close), the odometer counters, the scramble, the SVG pipeline and everything in
// ./evidence.ts (the curved evidence wall and the page-flip book). Never both on one element.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '../styles/case.css'
import { buildDiagram, buildHeaderFx } from './fx'
import { mountFluid } from './fx/fluid'
import { animate as mAnimate, stagger as mStagger } from 'motion'
import { animate as aAnimate, svg as aSvg, createTimeline, splitText } from 'animejs'
import type { ReelDef } from '../reels/types'
import { createReelCanvas, type ReelCanvas } from '../reels/mini'
import { projects, mediaFor, url, type Project, type MediaItem } from '../data'
import { state } from '../state'
import { bus } from '../bus'
import { buildWall, buildBook, hasBook, odometer, assemble, shatter, type Hooks, type Part } from './evidence'
import { gooeyLines, type Gooey } from './gooey'
import { projectLink } from './links'

// ---------- sound: the SFX engine is optional and loads on its own; every cue is guarded ----------
let sfxRef: { cue?(name: string, o?: unknown): void } | null = null
void import('../audio/sfx').then(m => { sfxRef = (m as { sfx?: typeof sfxRef }).sfx ?? null }).catch(() => { /* no sound module */ })
const cue = (name: string, data?: unknown) => { try { sfxRef?.cue?.(name, data) } catch { /* sound must never break the page */ } }

// ---------- labs: src/ui/labs/<projectId>.ts mounts an interactive model as the first section ----------
type LabMod = { mount(host: HTMLElement, o: { emit(name: string, data?: unknown): void; reduced: boolean }): { dispose(): void } }
const labs = import.meta.glob<LabMod>('./labs/*.ts')
const labFor = (id: string) => labs[`./labs/${id}.ts`] ?? null
const hrefOf = (u: string) => (/^(https?:|mailto:)/.test(u) ? u : url(u.endsWith('/') ? `${u}index.html` : u))

export interface CaseOptions { reels: ReelDef[]; onClose?(i: number): void; onStep?(i: number): void }
export interface CaseView { open(i: number, fromRect?: DOMRect): void; close(): void; isOpen(): boolean }

type Bez = [number, number, number, number]
type Box = { left: number; top: number; width: number; height: number }
type Stop = { stop(): void } | { cancel(): unknown }
const FLY: Bez = [0.22, 1, 0.36, 1]          // fast out, long settle: the rush into the screen
const OUT: Bez = [0.16, 1, 0.3, 1]
const IN: Bez = [0.55, 0, 1, 0.45]
const COLLAPSE: Bez = [0.7, 0, 0.3, 1]
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)
const pad = (n: number) => String(n).padStart(2, '0')
const ambient = () => !state.reduced && !state.paused
const finePointer = matchMedia('(hover: hover) and (pointer: fine)')
// the reel's caption is left out when it is empty or only says what the project's line already says
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const lum = (hex: string) => { const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 }
const repeatsLine = (cap: string, line: string) => !norm(cap) || norm(line).includes(norm(cap))

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}
// a Motion animation is a thenable: this settles when it finishes (or is stopped), never throws
const done = (a: { then(onResolve: () => void, onReject?: () => void): unknown }): Promise<void> => new Promise(res => { a.then(() => res(), () => res()) })
const stopAll = (xs: Stop[]) => { for (const x of xs) { try { 'stop' in x ? x.stop() : x.cancel() } catch { /* already gone */ } } xs.length = 0 }
const ICON = {
  back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>',
  prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>',
  x: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>',
  link: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.7.7M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.5 8.8a2.6 2.6 0 0 0 3.7 3.7l.7-.7"/></svg>',
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.6 3 3 6-7"/></svg>',
}

// ---------- scramble that always resolves to the exact copy ("Channel 01 / 06") ----------
// Digits churn through digits and letters through letters; spaces and punctuation never move, so the
// line keeps its shape and settles left to right. Anime owns the clock; the last frame is the real text.
function scrambleTo(el: HTMLElement, final: string, duration: number, delay: number): Stop {
  const D = '0123456789', L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const n = final.length
  const frame = (p: number) => {
    const settled = p * (n + 3) - 3            // a short lead-in where nothing has landed yet
    let out = ''
    for (let i = 0; i < n; i++) {
      const c = final[i]
      if (i < settled || !/[0-9A-Za-z]/.test(c)) out += c
      else { const set = /[0-9]/.test(c) ? D : L; out += set[Math.floor(Math.random() * set.length)] }
    }
    return out
  }
  el.textContent = frame(0)
  const o = { p: 0 }
  let last = 0
  return aAnimate(o, { p: 1, duration, delay, ease: 'linear',
    onUpdate: () => { const now = performance.now(); if (now - last > 36) { last = now; el.textContent = frame(o.p) } },
    onComplete: () => { el.textContent = final } })
}

// ---------- name fitting: the variable width axis does the layout ----------
// Short names set wide (wdth 125); long names condense toward 62 or break onto two or three lines.
function balance(words: string[], L: number): string[] {
  if (L <= 1 || words.length < L) return [words.join(' ')]
  const len = (a: number, b: number) => words.slice(a, b).join(' ').length
  let best: number[] = [], bestW = Infinity
  const n = words.length
  if (L === 2) for (let i = 1; i < n; i++) { const w = Math.max(len(0, i), len(i, n)); if (w < bestW) { bestW = w; best = [i] } }
  else for (let i = 1; i < n - 1; i++) for (let j = i + 1; j < n; j++) { const w = Math.max(len(0, i), len(i, j), len(j, n)); if (w < bestW) { bestW = w; best = [i, j] } }
  const cuts = [0, ...best, n]
  return cuts.slice(0, -1).map((c, k) => words.slice(c, cuts[k + 1]).join(' '))
}
const WDTH = [125, 112.5, 100, 87.5, 75, 62.5]
// condensed cuts need looser tracking and a wider word space or the letters fuse
const trackFor = (wd: number) => { const t = (wd - 62.5) / 62.5; return { ls: `${lerp(-0.008, -0.036, t).toFixed(4)}em`, ws: `${lerp(0.09, 0, t).toFixed(3)}em` } }
function fitName(meas: HTMLElement, text: string, maxW: number, maxH: number, maxLines: number) {
  const words = text.split(' ')
  let best = { lines: [text], size: 40, wdth: 100, score: -1 }
  for (let L = 1; L <= Math.min(maxLines, words.length); L++) {
    const lines = balance(words, L)
    for (const wd of WDTH) {
      meas.style.fontStretch = wd + '%'
      const tr = trackFor(wd); meas.style.letterSpacing = tr.ls; meas.style.wordSpacing = tr.ws
      let w = 0
      for (const line of lines) { meas.textContent = line; w = Math.max(w, meas.getBoundingClientRect().width) }
      const size = Math.min(maxH / (L * 0.9), (maxW / Math.max(1, w)) * 98.5)
      const score = size * (0.84 + 0.16 * (wd - 62.5) / 62.5) * (L === 1 ? 1 : L === 2 ? 0.86 : 0.74)
      if (score > best.score) best = { lines, size, wdth: wd, score }
    }
  }
  return best
}

// ---------- halftone, drawn once per size/theme (no per-frame work) ----------
function cssVar(el: Element, name: string, fb: string) { return getComputedStyle(el).getPropertyValue(name).trim() || fb }
function drawFlower(cv: HTMLCanvasElement, size: number, color: string) {
  const dpr = Math.min(devicePixelRatio, 2)
  cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr)
  cv.style.width = size + 'px'; cv.style.height = size + 'px'
  const g = cv.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, size, size)
  g.fillStyle = color
  const c = size / 2, R = size * 0.5, cell = Math.max(7, size / 74)
  for (let y = -c; y <= c; y += cell * 0.866) {
    const row = Math.round(y / (cell * 0.866))
    for (let x = -c + (row & 1 ? cell / 2 : 0); x <= c; x += cell) {
      const r = Math.hypot(x, y), th = Math.atan2(y, x)
      const edge = R * (0.5 + 0.5 * Math.pow(Math.abs(Math.cos(2 * th + 0.4)), 0.55)) * (0.94 + 0.06 * Math.sin(th * 7))
      const t = 1 - r / edge
      if (t <= 0) continue
      const k = smooth(clamp01(t / 0.62)) * (0.78 + 0.22 * Math.sin(x * 0.05 + y * 0.07))
      const rad = cell * 0.5 * k
      if (rad < 0.45) continue
      g.beginPath(); g.arc(c + x, c + y, rad, 0, Math.PI * 2); g.fill()
    }
  }
}
function drawEdge(cv: HTMLCanvasElement, color: string) {
  const w = cv.clientWidth, hgt = cv.clientHeight
  if (!w || !hgt) return
  const dpr = Math.min(devicePixelRatio, 2)
  cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr)
  const g = cv.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.fillStyle = color
  const cell = 9
  for (let y = 0; y <= hgt + cell; y += cell * 0.866) {
    const row = Math.round(y / (cell * 0.866)), t = Math.pow(y / hgt, 1.35)
    const rad = cell * 0.74 * t
    if (rad < 0.4) continue
    for (let x = row & 1 ? cell / 2 : 0; x <= w + cell; x += cell) { g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill() }
  }
}
function noiseURL() {
  const c = document.createElement('canvas'); c.width = c.height = 110
  const g = c.getContext('2d')!, d = g.createImageData(110, 110)
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255 * Math.random(); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255 }
  g.putImageData(d, 0, 0)
  return `url(${c.toDataURL()})`
}

// ---------- the pipeline tube ----------
interface Pipe { start(): void; pause(): void; resume(): void; layout(): void; dispose(): void }
function buildPipe(sec: HTMLElement, p: Project): Pipe {
  const ol = sec.querySelector('ol')!
  const lis = Array.from(ol.children) as HTMLElement[]
  const NS = 'http://www.w3.org/2000/svg'
  const svgEl = document.createElementNS(NS, 'svg')
  svgEl.setAttribute('aria-hidden', 'true')
  ol.prepend(svgEl)
  let pts: [number, number][] = [], cum: number[] = [], total = 1, vertical = false
  let drawn = !ambient(), tl: ReturnType<typeof createTimeline> | null = null
  const anims: Stop[] = []
  const pulses: (ReturnType<typeof aAnimate> | undefined)[] = []   // one ring pulse per station, replaced on each visit (the loop would otherwise retain ~58/min)
  const pos = { t: 0 }
  let groups: SVGGElement[] = [], cap: SVGGElement | null = null, hot = -1
  function layout() {
    const w = ol.clientWidth
    vertical = w / Math.max(1, lis.length) < 118
    sec.classList.toggle('is-v', vertical)
    const W = ol.clientWidth, H = ol.clientHeight
    svgEl.setAttribute('width', String(W)); svgEl.setAttribute('height', String(H)); svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`)
    const anchors = lis.map(li => vertical ? [20, li.offsetTop + 12] as [number, number] : [li.offsetLeft + 12, 22] as [number, number])
    const first = anchors[0], last = anchors[anchors.length - 1]
    pts = vertical ? [[first[0], first[1] - 14], ...anchors, [last[0], last[1] + 18]] : [[first[0] - 12, first[1]], ...anchors, [Math.min(W, last[0] + 120), last[1]]]
    cum = [0]
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]))
    total = cum[cum.length - 1] || 1
    const d = 'M ' + pts.map(q => q.join(' ')).join(' L ')
    svgEl.innerHTML = `
      <path class="tb-rim tb-draw" d="${d}" stroke-width="15"/>
      <path class="tb-core tb-draw" d="${d}" stroke-width="11"/>
      <path class="tb-glint" d="${d}" stroke-width="1.2" transform="translate(0 -2.5)"/>
      ${anchors.map(([x, y], k) => `<g class="tb-g" data-k="${k}"><circle class="tb-ring" cx="${x}" cy="${y}" r="12"/><circle class="tb-st" cx="${x}" cy="${y}" r="10"/><circle class="tb-dot" cx="${x}" cy="${y}" r="3.2"/></g>`).join('')}
      <g class="tb-cap" style="opacity:${pos.t > 0.002 && pos.t < 0.998 ? 1 : 0}"><rect class="tb-capglow" x="-17" y="-6" width="34" height="12" rx="6"/><rect x="-14" y="-4.5" width="28" height="9" rx="4.5"/><rect class="tb-band" x="-3" y="-4.5" width="2" height="9"/></g>`
    groups = Array.from(svgEl.querySelectorAll<SVGGElement>('.tb-g'))
    cap = svgEl.querySelector<SVGGElement>('.tb-cap')
    const glint = svgEl.querySelector<SVGPathElement>('.tb-glint')!
    if (vertical) glint.setAttribute('transform', 'translate(-2.5 0)')
    if (!drawn) {
      svgEl.querySelectorAll<SVGPathElement>('.tb-draw, .tb-glint').forEach(pe => { pe.style.opacity = '0' })
      groups.forEach(g => { g.style.opacity = '0' })
    }
    place()
  }
  function at(len: number): [number, number, number] {
    let k = 1
    while (k < cum.length - 1 && cum[k] < len) k++
    const a = pts[k - 1], b = pts[k], seg = cum[k] - cum[k - 1] || 1, u = clamp01((len - cum[k - 1]) / seg)
    return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI]
  }
  function place() {
    if (!cap) return
    const [x, y, r] = at(pos.t * total)
    cap.setAttribute('transform', `translate(${x} ${y}) rotate(${r})`)
    cap.style.opacity = pos.t > 0.002 && pos.t < 0.998 ? '1' : '0'
    // light the station the capsule is sitting at
    let k = -1
    for (let i = 0; i < lis.length; i++) if (Math.abs(cum[i + 1] - pos.t * total) < 16) k = i
    if (k !== hot) {
      if (hot >= 0) { groups[hot]?.classList.remove('is-hot'); lis[hot]?.classList.remove('is-hot') }
      if (k >= 0) {
        groups[k]?.classList.add('is-hot'); lis[k]?.classList.add('is-hot')
        const ring = groups[k]?.querySelector('.tb-ring')
        if (ring && ambient()) { pulses[k]?.cancel(); pulses[k] = aAnimate(ring, { r: [10, 24], opacity: [0.9, 0], duration: 700, ease: 'out(3)' }) }
      }
      hot = k
    }
  }
  function start() {
    if (drawn && tl) return
    if (!ambient()) {
      drawn = true
      svgEl.querySelectorAll<SVGElement>('.tb-draw, .tb-glint, .tb-g').forEach(e => { e.style.opacity = '' })
      return
    }
    drawn = true
    svgEl.querySelectorAll<SVGElement>('.tb-draw, .tb-glint').forEach(e => { e.style.opacity = '' })
    const drawables = aSvg.createDrawable(svgEl.querySelectorAll('.tb-draw'))
    anims.push(aAnimate(drawables, { draw: ['0 0', '0 1'], duration: 1100, ease: 'inOut(3)' }))
    anims.push(aAnimate(svgEl.querySelector('.tb-glint')!, { opacity: [0, 1], duration: 600, delay: 700 }))
    groups.forEach((g, k) => {
      const delay = (cum[k + 1] / total) * 1000
      anims.push(aAnimate(g, { opacity: [0, 1], scale: [0.4, 1], duration: 420, delay, ease: 'out(4)' }))
    })
    // the capsule hops station to station, dwelling at each, then loops
    const t = createTimeline({ loop: true, loopDelay: 900, autoplay: false, onUpdate: place })
    for (let k = 0; k < lis.length; k++) t.add(pos, { t: cum[k + 1] / total, duration: 520, ease: 'inOut(3)' }, k === 0 ? 0 : '+=260')
    t.add(pos, { t: 1, duration: 420, ease: 'in(3)' }, '+=260')
    t.add(pos, { t: 0, duration: 1 })
    tl = t
    setTimeout(() => { if (tl === t && !state.paused) t.play() }, 1150)
  }
  const ro = new ResizeObserver(() => layout())
  ro.observe(ol)
  return {
    start, layout,
    pause() { tl?.pause() },
    resume() { if (tl && ambient()) tl.resume() },
    dispose() { ro.disconnect(); tl?.pause(); tl?.cancel(); stopAll(anims); pulses.forEach(a => a?.cancel()); pulses.length = 0 },
  }
}

// =====================================================================================
export function initCase(opts: CaseOptions): CaseView {
  const reels = opts.reels
  const N = reels.length
  const wrap = (i: number) => ((i % N) + N) % N
  const projOf = (i: number): Project => projects.find(p => p.id === reels[i]?.projectId) ?? projects[0]

  // ---------- shell ----------
  const dlg = h('dialog', 'case')
  dlg.setAttribute('aria-labelledby', 'case-name')
  dlg.setAttribute('aria-describedby', 'case-line')
  dlg.innerHTML = `
    <div class="case__frame">
      <canvas class="case__flower" aria-hidden="true"></canvas>
      <div class="case__fly">
        <div class="case__screen">
          <div class="case__tv" role="img"><canvas class="case__reel"></canvas><canvas class="case__ghost"></canvas><div class="case__noise"></div><div class="case__roll"></div></div>
          <div class="case__crt"></div>
        </div>
      </div>
      <div class="case__scrim" aria-hidden="true"></div>
      <div class="case__cap mono" aria-hidden="true"><b class="cap-ch"><span class="lamp"></span>CH 01</b><span class="cap-t"></span><span class="cap-tc">00:00:00</span><span class="cap-m"></span></div>
      <div class="case__scroll" tabindex="-1"><div class="case__stage"></div></div>
      <header class="case__bar">
        <button type="button" class="case__back case__glass mono" aria-label="Close case study"><span class="ico">${ICON.x}</span><span>Close case study</span></button>
        <nav class="case__chs case__glass" aria-label="Channels"><span class="case__chn mono" aria-hidden="true"><b>01</b> / ${pad(N)}</span><span class="case__dots"></span></nav>
        <div class="case__steps">
          <button type="button" class="case__copy case__glass mono" title="Copy link" aria-label="Copy link to this case study"><span class="ico">${ICON.link}${ICON.check}</span><span class="lb">Copy link</span></button>
          <button type="button" class="case__step case__glass mono" data-d="-1">${ICON.prev}<span>Prev</span><kbd>←</kbd></button>
          <button type="button" class="case__step case__glass mono" data-d="1"><kbd>→</kbd><span>Next</span>${ICON.next}</button>
        </div>
        <p class="sr case__live" role="status" aria-live="polite"></p>
      </header>
      <div class="case__prog" aria-hidden="true"></div>
      <div class="case__flash" aria-hidden="true"></div>
    </div>
    <span class="cv-name__m" aria-hidden="true"></span>`
  document.body.append(dlg)
  const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = dlg) => r.querySelector(s) as T
  const frame = $('.case__frame'), fly = $('.case__fly'), screen = $('.case__screen'), tv = $('.case__tv')
  const reelCv = $<HTMLCanvasElement>('.case__reel'), ghost = $<HTMLCanvasElement>('.case__ghost')
  const flower = $<HTMLCanvasElement>('.case__flower'), crt = $('.case__crt'), scrim = $('.case__scrim'), flash = $('.case__flash')
  const prog = $('.case__prog')
  const cap = $('.case__cap'), capCh = $('.cap-ch'), capT = $('.cap-t'), capTc = $('.cap-tc'), capM = $('.cap-m')
  const scroller = $('.case__scroll'), stage = $('.case__stage'), bar = $('.case__bar')
  const backBtn = $<HTMLButtonElement>('.case__back'), chn = $('.case__chn'), dots = $('.case__dots')
  const stepBtns = Array.from(dlg.querySelectorAll<HTMLButtonElement>('.case__step'))
  const copyBtn = $<HTMLButtonElement>('.case__copy'), copyLb = $('.case__copy .lb'), live = $('.case__live')
  const meas = $('.cv-name__m')
  dlg.style.setProperty('--noise', noiseURL())
  dots.innerHTML = reels.map((r, k) => `<button type="button" class="case__dot" data-ch="${k}" aria-label="Channel ${pad(k + 1)}: ${projOf(k).name}"></button>`).join('')
  const dotEls = Array.from(dots.querySelectorAll<HTMLButtonElement>('.case__dot'))

  // ---------- state ----------
  let rc: ReelCanvas | null = null
  let cur = 0, openFlag = false, closing = false, busy = false
  let ownClose = 0
  let from: Box = { left: 0, top: 0, width: 0, height: 0 }
  let opener: HTMLElement | null = null
  let flyT = 1
  let dock = false, dockP = 0
  let vw = innerWidth, vh = innerHeight
  let dockBox: Box = { left: 0, top: 0, width: 0, height: 0 }
  let scrRect: Box = { left: 0, top: 0, width: vw, height: vh }
  let art: Article | null = null
  let flyAnim: Stop | null = null
  const ptr = { x: vw / 2, y: vh / 2, in: false }
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }
  const tilt = { x: 0, y: 0 }
  let raf = 0, t0 = 0

  function ensureReel() {
    if (!rc) rc = createReelCanvas(reelCv, reels[cur], { dpr: innerWidth < 900 ? 1.5 : 1.25, intensity: 1 })
  }
  function setAccent(i: number) {
    const r = reels[i]
    dlg.style.setProperty('--acc', r.colors.accent)
    // a reel on pale paper (Liaozhai) gets a hero in its own ink instead of white type over a grey wash
    dlg.classList.toggle('is-lite', lum(r.colors.bg) > 0.5)
    dotEls.forEach((d, k) => d.setAttribute('aria-current', String(k === i)))
    chn.innerHTML = `<b>${pad(i + 1)}</b> / ${pad(N)}`
    const pv = projOf(wrap(i - 1)), nx = projOf(wrap(i + 1))
    stepBtns[0].setAttribute('aria-label', `Previous work: ${pv.name}`)
    stepBtns[1].setAttribute('aria-label', `Next work: ${nx.name}`)
    // deep links: the dialog says whose case it shows, and Copy link follows Prev / Next (the control's label goes back to "Copy link")
    dlg.dataset.project = r.projectId
    copyBtn.dataset.href = projectLink(r.projectId)
    copyBtn.setAttribute('aria-label', `Copy link to the ${projOf(i).name} case study`)
    resetCopy()
    capCh.innerHTML = `<span class="lamp"></span>CH ${pad(i + 1)}`
    capT.textContent = r.title
    capM.textContent = r.medium
    // the reel's accessible name is its caption (the glass box below is only a visual reveal)
    tv.setAttribute('aria-label', r.medium.trim() || r.title)
  }

  // ---------- geometry: the fly (open/close) and the dock (scroll) ----------
  function measure() {
    vw = innerWidth; vh = innerHeight
    dock = vw >= 900 && !state.reduced
    dlg.classList.toggle('is-dock', dock)
    // from 1400px the lab column widens to about 880px, and the docked reel panel gives way to it
    const wide = vw >= 1400, col = wide ? Math.min(880, Math.round(vw * 0.62) - 48) : Math.min(Math.round(vw * 0.56) - 48, 860)
    dlg.style.setProperty('--col', `${col}px`)
    const left = wide ? col + 48 + 28 : Math.round(vw * 0.6), w = vw - left - 48, hh = w * vh / vw
    dockBox = { left, top: Math.round(68 + (vh - 68 - hh - 64) / 2), width: w, height: hh }
    const fs = Math.round(w * 1.42)
    if (flower.width !== Math.round(fs * Math.min(devicePixelRatio, 2))) drawFlower(flower, fs, cssVar(dlg, '--ink', '#ECEAE3'))
    flower.style.left = `${left + w / 2 - fs / 2}px`; flower.style.top = `${dockBox.top + hh / 2 - fs / 2}px`
    cap.style.left = `${left}px`; cap.style.top = `${dockBox.top + hh + 18}px`; cap.style.width = `${w}px`
    if (art) { fitHero(art); art.pipe?.layout(); const edge = art.root.querySelector<HTMLCanvasElement>('.cv-edge'); if (edge) drawEdge(edge, cssVar(dlg, '--paper', '#0E0F10')) }
    update()
  }
  function setFly(t: number) {
    flyT = t
    const r = from
    const sc = Math.max(r.width / vw, r.height / vh)
    const s = lerp(sc, 1, t)
    const tx = lerp(r.left + r.width / 2 - (sc * vw) / 2, 0, t), ty = lerp(r.top + r.height / 2 - (sc * vh) / 2, 0, t)
    fly.style.transform = t >= 1 ? '' : `translate(${tx}px, ${ty}px) scale(${s})`
    const top = lerp(r.top, 0, t), left = lerp(r.left, 0, t)
    const right = lerp(vw - r.left - r.width, 0, t), bottom = lerp(vh - r.top - r.height, 0, t)
    frame.style.clipPath = t >= 1 ? '' : `inset(${top}px ${right}px ${bottom}px ${left}px round ${lerp(18, 0, smooth(t))}px)`
    crt.style.setProperty('--crt', String(lerp(0.85, 0.16, smooth(t)) + dockP * 0.3))
  }
  function update() {
    const st = scroller.scrollTop
    if (dock) {
      dockP = clamp01(st / (vh * 0.42))
      const e = smooth(dockP)
      const s = lerp(1, dockBox.width / vw, e)
      const cx = lerp(vw / 2, dockBox.left + dockBox.width / 2, e), cy = lerp(vh / 2, dockBox.top + dockBox.height / 2, e)
      const rx = -tilt.y * 7 * e, ry = tilt.x * 9 * e
      screen.style.transform = e <= 0 ? '' : `translate(${cx - vw / 2}px, ${cy - vh / 2}px) scale(${s}) perspective(1600px) rotateX(${rx}deg) rotateY(${ry}deg)`
      screen.style.borderRadius = e <= 0 ? '' : `${(20 * e) / s}px`
      screen.style.boxShadow = e <= 0.01 ? '' : `0 0 0 ${1 / s}px rgb(255 255 255 / ${0.14 * e}), 0 ${50 / s}px ${110 / s}px ${-30 / s}px color-mix(in srgb, var(--acc) ${Math.round(70 * e)}%, transparent)`
      flower.style.opacity = String(e * 0.92)
      cap.style.opacity = String(clamp01((dockP - 0.75) / 0.25))
      scrim.style.opacity = '0'
      scrRect = { left: cx - (vw * s) / 2, top: cy - (vh * s) / 2, width: vw * s, height: vh * s }
    } else {
      dockP = 0
      screen.style.transform = ''; screen.style.borderRadius = ''; screen.style.boxShadow = ''
      flower.style.opacity = '0'; cap.style.opacity = '0'
      scrim.style.opacity = String(clamp01(st / (vh * 0.9)) * 0.5)
      scrRect = { left: 0, top: 0, width: vw, height: vh }
    }
    // over the hero the bar speaks in the screen's night palette (matters when the site theme is light)
    dlg.classList.toggle('is-hero', st < vh * (dock ? 0.28 : 0.92))
    const room = scroller.scrollHeight - scroller.clientHeight
    prog.style.transform = `scaleX(${room > 0 ? clamp01(st / room).toFixed(4) : 0})`
    if (flyT >= 1) crt.style.setProperty('--crt', String(0.16 + dockP * 0.3))
    if (art) art.hero.style.opacity = dock ? String(1 - clamp01((st - vh * 0.04) / (vh * 0.24))) : ''
  }

  // ---------- one rAF while open: pointer easing, tilt, name weight, timecode ----------
  function tick(now: number) {
    raf = 0
    if (!openFlag) return
    mouse.x = lerp(mouse.x, mouse.tx, 0.08); mouse.y = lerp(mouse.y, mouse.ty, 0.08)
    rc?.setMouse(mouse.x, mouse.y)
    const tx = ptr.in ? (ptr.x - (scrRect.left + scrRect.width / 2)) / vw : 0
    const ty = ptr.in ? (ptr.y - (scrRect.top + scrRect.height / 2)) / vh : 0
    const ox = tilt.x, oy = tilt.y
    tilt.x = lerp(tilt.x, Math.max(-1, Math.min(1, tx * 2)), 0.07); tilt.y = lerp(tilt.y, Math.max(-1, Math.min(1, ty * 2)), 0.07)
    if (dockP > 0 && (Math.abs(tilt.x - ox) > 1e-4 || Math.abs(tilt.y - oy) > 1e-4)) update()
    if (art) weighName(art)
    if (dockP > 0.7) {
      const s = (now - t0) / 1000, f = Math.floor((s % 1) * 24)
      capTc.textContent = `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}:${pad(f)}`
    }
    if (ambient()) raf = requestAnimationFrame(tick)
  }
  function kick() { if (!raf && openFlag && ambient()) raf = requestAnimationFrame(tick) }
  dlg.addEventListener('pointermove', e => {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.in = true
    // the reel's caption shows while the pointer is over the reel (the screen rect: the whole frame up top, the docked panel after the scroll)
    dlg.classList.toggle('is-reel-hot', e.clientX >= scrRect.left && e.clientX <= scrRect.left + scrRect.width && e.clientY >= scrRect.top && e.clientY <= scrRect.top + scrRect.height)
    mouse.tx = clamp01((e.clientX - scrRect.left) / scrRect.width); mouse.ty = 1 - clamp01((e.clientY - scrRect.top) / scrRect.height)
    if (!ambient()) rc?.setMouse(mouse.tx, mouse.ty)
    kick()
  })
  dlg.addEventListener('pointerleave', () => { ptr.in = false; dlg.classList.remove('is-reel-hot'); mouse.tx = 0.5; mouse.ty = 0.5; kick() })
  scroller.addEventListener('scroll', () => { update() }, { passive: true })
  addEventListener('resize', () => { if (openFlag) measure() })
  bus.on('pause', () => { dlg.classList.toggle('is-still', !ambient()); if (art) { state.paused ? art.pipe?.pause() : art.pipe?.resume() } kick() })
  bus.on('theme', () => {
    if (!openFlag) return
    requestAnimationFrame(() => {
      drawFlower(flower, Math.round(dockBox.width * 1.42), cssVar(dlg, '--ink', '#ECEAE3'))
      const edge = art?.root.querySelector<HTMLCanvasElement>('.cv-edge'); if (edge) drawEdge(edge, cssVar(dlg, '--paper', '#0E0F10'))
    })
  })

  // what ./evidence.ts needs from the shell
  const hk: Hooks = {
    cue,
    reduced: () => state.reduced,
    still: () => !ambient(),
    open: (items, k, from) => openLightbox(items, k, from),
  }

  // ---------- the article ----------
  interface Article {
    root: HTMLElement; hero: HTMLElement; name: HTMLElement; lines: HTMLElement; echoes: HTMLElement[]
    chars: HTMLElement[]; charW: number[]; size: number; pipe: Pipe | null; cleanup: (() => void)[]; anims: Stop[]
    parts: Part[]; labHost: HTMLElement | null; dead: boolean; gooeys: Gooey[]
  }
  function build(i: number): Article {
    const p = projOf(i), r = reels[i], m = mediaFor(p.id)
    const root = h('article', 'cv')
    root.dataset.ch = String(i)
    const hero = h('section', 'cv-hero')
    hero.innerHTML = `
      <canvas class="cv-edge" aria-hidden="true"></canvas>
      <div class="cv-top">
        <p class="cv-kicker case__glass mono"><span class="lamp" aria-hidden="true"></span><span class="cv-case">Case study</span><span class="sep" aria-hidden="true">·</span><span class="cv-ch">${pad(i + 1)} / ${pad(N)}</span><span class="sep" aria-hidden="true">·</span><span>${r.title}</span></p>
        <p class="cv-onscreen case__glass" aria-hidden="true"><span class="mono">On screen</span><span></span></p>
      </div>
      <div></div>
      <div class="cv-namebox"><h2 class="cv-name" id="case-name" tabindex="-1"><span class="sr"></span></h2></div>
      <div>
        <div class="cv-rule" aria-hidden="true"></div>
        <div class="cv-row">
          <p class="cv-line" id="case-line"></p>
          <dl class="cv-meta mono">
            <div><dt>Status</dt><dd><span class="st" data-s="${p.status}"></span></dd></div>
            <div><dt>Period</dt><dd></dd></div>
            <div><dt>Role</dt><dd></dd></div>
          </dl>
          <p class="cv-kf"><span class="cv-kf__v"></span><span class="cv-kf__l mono"></span></p>
        </div>
      </div>
      <button type="button" class="cv-cue mono"><i aria-hidden="true"></i>Scroll for the case</button>`
    // the caption box is omitted when empty or repeating the line; the reel's aria-label still carries the caption
    if (repeatsLine(r.medium, p.line)) hero.querySelector('.cv-onscreen')?.remove()
    else hero.querySelector('.cv-onscreen span:last-child')!.textContent = r.medium
    hero.querySelector('.cv-name .sr')!.textContent = p.name
    hero.querySelector('.cv-line')!.textContent = p.line
    const dds = hero.querySelectorAll('.cv-meta dd')
    dds[0].querySelector('.st')!.textContent = p.statusLabel
    dds[1].textContent = p.period
    dds[2].textContent = p.role
    const kfv = hero.querySelector<HTMLElement>('.cv-kf__v')!
    kfv.textContent = p.keyFigure.value
    kfv.style.setProperty('--kfl', String(Math.max(4, p.keyFigure.value.length)))
    hero.querySelector('.cv-kf__l')!.textContent = p.keyFigure.label
    hero.querySelector('.cv-cue')!.addEventListener('click', () => {
      const body = root.querySelector<HTMLElement>('.cv-body')!
      scroller.scrollTo({ top: body.offsetTop - (dock ? 0 : 40), behavior: state.reduced ? 'auto' : 'smooth' })
    })

    const name = hero.querySelector<HTMLElement>('.cv-name')!
    const lines = h('span', 'cv-lines'); lines.setAttribute('aria-hidden', 'true')
    name.append(lines)

    // body
    const body = h('div', 'cv-body')
    const parts: Part[] = []
    let sn = 0
    const sec = (cls: string, label: string, n?: string) => {
      const s = h('section', `cv-sec ${cls}`)
      s.innerHTML = `<h3 class="cv-h mono" data-rv><b>${pad(++sn)}</b> ${label}${n ? `<span class="n">${n}</span>` : ''}</h3>`
      body.append(s)
      return s
    }
    const sum = h('section', 'cv-sec'); sum.innerHTML = `<p class="cv-sum"></p>`; sum.querySelector('p')!.textContent = p.summary; body.append(sum)

    // the interactive model, when this project has one (src/ui/labs/<id>.ts)
    let labHost: HTMLElement | null = null
    if (labFor(p.id)) {
      const ls = sec('cv-lab', 'Try the model')
      labHost = h('div', 'cv-labhost'); labHost.dataset.proof = 'skip'; labHost.dataset.rv = ''
      ls.append(labHost)
    }

    const ms = sec('cv-msec', 'Metrics', `${pad(p.metrics.length)} figures`)
    const grid = h('ul', 'cv-metrics'); ms.append(grid)
    p.metrics.forEach((mt, k) => {
      const li = h('li', 'cv-m'); li.dataset.rv = ''; li.style.setProperty('--rd', `${(k % 3) * 0.07 + Math.floor(k / 3) * 0.05}s`)
      const v = h('span', 'cv-m__v', mt.value); if (mt.value.length > 11) v.classList.add('is-long')
      li.append(v, h('p', 'cv-m__l', mt.label)); grid.append(li)
    })

    // evidence first: the project's own graphics are the point. A PDF project gets the page-flip book; media gets the wall.
    const demo = (p as Project & { demo?: { label: string; url: string } }).demo
    const paperLink = p.links.find(l => l.kind === 'paper' || l.kind === 'deck')
    const wantsBook = hasBook(p.id)
    if (wantsBook) {
      const noun = paperLink?.kind === 'deck' ? 'The deck' : 'The paper'
      const bs = sec('cv-ev cv-evbook', noun)
      const bk = buildBook(p.id, p.name, paperLink ? { href: hrefOf(paperLink.url), label: demo?.label ?? `Read the ${paperLink.kind}` } : null, hk, scroller)
      if (bk) { bs.append(bk.el); parts.push(bk) }
    }
    const wallItems = wantsBook ? m.filter(it => it.kind !== 'page') : m
    if (wallItems.length) {
      const es = sec('cv-ev', 'Evidence', `${pad(wallItems.length)} items`)
      const wl = buildWall(wallItems, hk, scroller, `Evidence for ${p.name}, ${wallItems.length} items`)
      es.append(wl.el); parts.push(wl)
    }

    const prose = sec('cv-psec', 'The idea')
    for (const [k, label, text] of [['A', 'Why', p.why], ['B', 'How it works', p.mechanism]] as const) {
      const d = h('div', 'cv-prose')
      d.innerHTML = `<h3 class="mono"><b>${k}</b>${label}</h3><p></p>`
      d.querySelector('p')!.textContent = text
      prose.append(d)
    }

    // v10: a project may carry a dated lineage (src/data/projects.json "lineage"): a text-only strip of how the question changed
    const lineage = (p as Project & { lineage?: { year: string; step: string }[] }).lineage
    if (lineage?.length) {
      const lin = sec('cv-lin', 'How the question changed', `${pad(lineage.length)} steps`)
      const lol = h('ol')
      lineage.forEach((it, k) => {
        const li = h('li'); li.dataset.rv = ''; li.style.setProperty('--rd', `${k * 0.08}s`)
        li.append(h('span', 'y mono', it.year), h('p', 't', it.step)); lol.append(li)
      })
      lin.append(lol)
    }

    const ps = sec('cv-pipe', 'Pipeline', `${pad(p.pipeline.length)} stations`)
    const ol = h('ol'); ol.dataset.rv = ''
    p.pipeline.forEach((st, k) => {
      const li = h('li')
      li.innerHTML = `<span class="k mono">${pad(k + 1)}</span><b></b><span class="d"></span>`
      li.querySelector('b')!.textContent = st.step; li.querySelector('.d')!.textContent = st.detail
      ol.append(li)
    })
    ps.append(ol)

    const ss = sec('cv-ssec', 'Stack', `${pad(p.stack.length)} parts`)
    const chips = h('ul', 'cv-chips'); chips.dataset.rv = ''
    p.stack.forEach(s => chips.append(h('li', 'cv-chip', s)))
    ss.append(chips)

    // links: the live demo first (when it is not already listed), then the rest. Local links get a real file target.
    const links = p.links.map(l => ({ ...l }))
    if (demo && !links.some(l => hrefOf(l.url) === hrefOf(demo.url))) links.unshift({ label: demo.label, url: demo.url, kind: 'demo' })
    // a reading instrument's source leads its links (the same order as its stop and the Overview); the source row is the primary one
    if (p.kind === 'instrument') links.sort((x, y) => Number(y.kind === 'code') - Number(x.kind === 'code'))
    if (links.length) {
      const ls = sec('cv-links', 'Links')
      const ul = h('ul'); ul.dataset.rv = ''
      for (const l of links) {
        const li = h('li'), a = h('a')
        a.href = hrefOf(l.url)
        a.target = '_blank'; a.rel = 'noopener'
        if (l.kind === 'code') a.classList.add('is-src')
        a.innerHTML = `<span class="t"></span><span class="k mono"></span><span class="ar" aria-hidden="true">↗</span>`
        a.querySelector('.t')!.textContent = l.label; a.querySelector('.k')!.textContent = l.kind === 'code' ? 'source' : l.kind
        a.setAttribute('aria-label', `${l.label} (opens in a new tab)`)
        li.append(a); ul.append(li)
      }
      ls.append(ul)
    }

    const cleanup: (() => void)[] = []
    const nx = projOf(wrap(i + 1))
    const fin = h('section', 'cv-sec')
    if (p.credits) { const c = h('p', 'cv-credits'); c.textContent = p.credits; fin.append(c) }
    const next = h('button', 'cv-next'); next.type = 'button'; next.dataset.rv = ''
    next.innerHTML = `<span class="mono"><b>Up next</b>Channel ${pad(wrap(i + 1) + 1)} / ${pad(N)} · ${reels[wrap(i + 1)].title}</span><span class="nm"></span>`
    next.querySelector<HTMLElement>('.nm')!.dataset.t = nx.name
    next.querySelector('.nm')!.innerHTML = `${nx.name.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as Record<string, string>)[c])}<span class="ar">→</span>`
    next.addEventListener('click', () => go(wrap(i + 1), true))
    fin.append(next)
    body.append(fin)

    // 14V: a faint grid with meteors behind the header, and the project's pipeline drawn as one line at the head of the body
    hero.prepend(buildHeaderFx())
    const dia = buildDiagram(p.pipeline, { reduced: () => !ambient() })
    if (dia) { body.prepend(dia.el); parts.push(dia) }
    root.append(hero, body)
    // wave-22 #22: the body's prose reveals line by line (VengeanceUI gooey-text-reveal, src/ui/gooey.ts); the title keeps its own assemble
    const gooeys: Gooey[] = Array.from(body.querySelectorAll<HTMLElement>('.cv-sum, .cv-prose p, .cv-credits'), el => gooeyLines(el, scroller))
    gooeys.forEach(g => cleanup.push(() => g.dispose()))
    const a: Article = { root, hero, name, lines, echoes: [], chars: [], charW: [], size: 100, pipe: null, cleanup, anims: [], parts, labHost, dead: false, gooeys }
    // 15F: GPU ink behind the header in the project's own accent; the pointer stirs it, a playing record pushes it
    { const fl = mountFluid(hero, { tints: [r.colors.accent, `color-mix(in srgb, ${r.colors.accent} 50%, #fff)`], strength: 0.9 }); a.cleanup.push(() => fl.unmount()) }
    return a
  }

  // set the name: fit, split into lines/words/chars, echo copies for the reveal
  function fitHero(a: Article) {
    const p = projOf(+a.root.dataset.ch!)
    const phone = vw < 900
    const maxW = vw - (phone ? 40 : 96) - 4
    const maxH = phone ? Math.min(vh * 0.27, 230) : Math.min(vh * 0.3, 290)
    const fit = fitName(meas, p.name, maxW, maxH, phone ? 3 : 2)
    a.size = fit.size
    a.name.style.fontSize = `${fit.size.toFixed(1)}px`
    a.name.style.fontStretch = `${fit.wdth}%`
    const tr = trackFor(fit.wdth); a.name.style.letterSpacing = tr.ls; a.name.style.wordSpacing = tr.ws
    const key = fit.lines.join('|') + fit.wdth
    if (a.lines.dataset.key === key) return
    a.lines.dataset.key = key
    a.lines.innerHTML = ''
    a.chars = []
    for (const line of fit.lines) {
      const l = h('span', 'cv-l'); l.textContent = line
      a.lines.append(l)
      // anime.js splitText turns the line into .cv-w words and .cv-c letters (they are what flies, assembles and thins under the pointer)
      const sp = splitText(l, { words: { class: 'cv-w' }, chars: { class: 'cv-c' }, accessible: false })
      sp.resizeObserver.disconnect()
      a.chars.push(...(sp.chars as HTMLElement[]))
    }
    a.echoes.forEach(e => e.remove())
    a.echoes = [1, 2, 3].map(k => { const e = a.lines.cloneNode(true) as HTMLElement; e.className = 'cv-lines cv-echo'; e.dataset.k = String(k); a.name.append(e); return e })
    a.charW = a.chars.map(() => 800)
  }
  // characters near the pointer thin out: the variable weight axis follows your hand
  function weighName(a: Article) {
    if (!a.chars.length || !finePointer.matches) return
    const hr = a.name.getBoundingClientRect()
    const near = ptr.in && ptr.y > hr.top - a.size && ptr.y < hr.bottom + a.size * 0.6 && dockP < 0.5
    if (!near && a.charW.every(w => w === 800)) return
    const sig = a.size * 0.9
    // read every position first, then write: no layout thrash
    const target = a.chars.map(c => {
      if (!near) return 800
      const cx = hr.left + c.offsetLeft + c.offsetWidth / 2, cy = hr.top + c.offsetTop + c.offsetHeight / 2
      const d2 = (ptr.x - cx) ** 2 + (ptr.y - cy) ** 2
      return Math.round(800 - 560 * Math.exp(-d2 / (2 * sig * sig)))
    })
    target.forEach((w, k) => { if (Math.abs(w - a.charW[k]) > 8 || (w === 800 && a.charW[k] !== 800)) { a.charW[k] = w; a.chars[k].style.fontWeight = String(w) } })
  }

  // the body's gooey reveals are armed once the case is at rest (after the fly, or at a channel change's mount)
  function armGooey(a: Article | null) { a?.gooeys.forEach(g => g.arm()) }
  function arm(a: Article) {
    if (!ambient() && state.reduced) return
    a.root.classList.add('is-armed')
    const io = new IntersectionObserver(es => {
      for (const e of es) {
        if (!e.isIntersecting) continue
        const t = e.target as HTMLElement
        t.classList.add('is-in')
        io.unobserve(t)
        if (t.classList.contains('cv-m')) countUp(a, t.querySelector<HTMLElement>('.cv-m__v')!, 1100, 120, true)
        if (t.matches('.cv-pipe ol')) a.pipe?.start()
        if (t.matches('.cv-chips')) a.anims.push(mAnimate(Array.from(t.children), { opacity: [0, 1], transform: ['translateY(10px) scale(0.92)', 'translateY(0px) scale(1)'] }, { duration: 0.5, delay: mStagger(0.035, { startDelay: 0.15 }), ease: OUT }))
      }
    }, { root: scroller, threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    a.root.querySelectorAll('[data-rv]').forEach(e => io.observe(e))
    a.cleanup.push(() => io.disconnect())
  }
  // odometer: digit columns roll to the exact figure in the data (see evidence.ts); the text node is handed back at the end
  function countUp(a: Article, el: HTMLElement, duration: number, delay: number, ticks = false) {
    const final = el.textContent ?? ''
    if (!ambient()) return
    const stop = odometer(el, final, hk, { delay, duration, ticks })
    if (!stop) return
    a.anims.push(stop)
    a.cleanup.push(() => { el.classList.remove('is-od'); el.textContent = final })
  }

  function mount(i: number) {
    const a = build(i)
    stage.append(a.root)
    art = a
    fitHero(a)
    const edge = a.root.querySelector<HTMLCanvasElement>('.cv-edge')
    if (edge) requestAnimationFrame(() => drawEdge(edge, cssVar(dlg, '--paper', '#0E0F10')))
    const pipeSec = a.root.querySelector<HTMLElement>('.cv-pipe')
    if (pipeSec) { a.pipe = buildPipe(pipeSec, projOf(i)); if (!ambient()) a.pipe.start() }
    arm(a)
    a.parts.forEach(pt => pt.mount())
    // the lab loads on its own chunk; if the article is gone by then it is dropped
    const load = a.labHost ? labFor(projOf(i).id) : null
    if (load && a.labHost) {
      const host = a.labHost
      load().then(mod => {
        if (a.dead) return
        const h2 = mod.mount(host, { emit: (name, data) => cue(name, data), reduced: state.reduced })
        a.cleanup.push(() => h2.dispose())
      }).catch(e => console.warn('[case] lab failed to mount', e))
    }
    return a
  }
  function unmount(a: Article) {
    a.dead = true
    stopAll(a.anims)
    a.parts.forEach(pt => pt.dispose())
    a.cleanup.forEach(f => f()); a.cleanup = []
    a.pipe?.dispose()
    a.root.remove()
    if (art === a) art = null
  }

  // the hero choreography; d = start delay in seconds; src = the TV screen rect the title's letters fly out of
  function intro(a: Article, d: number, src: Box) {
    if (state.reduced) return
    const q = <T extends Element = HTMLElement>(s: string) => a.hero.querySelector(s) as T
    const set = (els: Element[], css: Partial<CSSStyleDeclaration>) => els.forEach(e => Object.assign((e as HTMLElement).style, css))
    // the caption box is not part of the intro: it is hidden until the pointer or keyboard focus reaches the reel (CSS owns its state)
    const top = [q('.cv-kicker')]
    const row = Array.from(a.hero.querySelectorAll('.cv-line, .cv-meta > div, .cv-kf'))
    const rule = q('.cv-rule'), cue2 = q('.cv-cue')
    set([...top, ...row, cue2], { opacity: '0' })
    set(a.chars, { opacity: '0' })
    rule.style.transform = 'scaleX(0)'
    // the letters fly free of the line mask
    a.lines.querySelectorAll('.cv-l').forEach(l => l.classList.add('is-open'))
    const A = a.anims
    A.push(mAnimate(top, { opacity: [0, 1], transform: ['translateY(-12px)', 'none'] }, { duration: 0.6, delay: mStagger(0.08, { startDelay: d }), ease: OUT }))
    const ch = q('.cv-ch')
    if (ch) {
      const finalText = ch.textContent ?? ''
      A.push(scrambleTo(ch, finalText, 620, d * 1000 + 40))
      a.cleanup.push(() => { ch.textContent = finalText })
    }
    // anime.js splitText deconstruction: every letter leaves the TV screen at its own angle and assembles into the name
    const t = window.setTimeout(() => { const s2 = assemble(a.chars, src, hk, a.name); if (s2) A.push(s2) }, d * 1000)
    a.cleanup.push(() => { clearTimeout(t); set(a.chars, { opacity: '', transform: '' }) })
    a.echoes.forEach((e, k) => {
      A.push(mAnimate(e, { opacity: [0, 0.5 / (k + 1), 0], transform: [`translateY(${0.34 * (k + 1)}em)`, `translateY(${0.2 * (k + 1)}em)`, 'translateY(0em)'] },
        { duration: 1.25, delay: d + 0.8 + k * 0.07, ease: OUT, times: [0, 0.4, 1] }))
    })
    A.push(mAnimate(rule, { transform: ['scaleX(0)', 'scaleX(1)'] }, { duration: 1.1, delay: d + 0.45, ease: OUT }))
    A.push(mAnimate(row, { opacity: [0, 1], transform: ['translateY(18px)', 'none'] }, { duration: 0.75, delay: mStagger(0.06, { startDelay: d + 0.7 }), ease: OUT }))
    A.push(mAnimate(cue2, { opacity: [0, 1] }, { duration: 0.6, delay: d + 1.2 }))
    countUp(a, q('.cv-kf__v'), 1500, (d + 0.75) * 1000, true)
  }

  // ---------- channel change: RGB split + tear on the reel, content crossfade ----------
  const snapR = document.createElement('canvas'), snapC = document.createElement('canvas')
  let glitchRaf = 0
  function glitch(swap: () => void) {
    if (!rc?.gl) { swap(); return }
    const W = Math.max(2, Math.round(reelCv.width / 2)), H = Math.max(2, Math.round(reelCv.height / 2))
    for (const c of [ghost, snapR, snapC]) { c.width = W; c.height = H }
    rc.draw()   // fresh frame in the drawing buffer, read in the same task
    const tint = (c: HTMLCanvasElement, col: string) => {
      const g = c.getContext('2d')!
      g.globalCompositeOperation = 'source-over'; g.drawImage(reelCv, 0, 0, W, H)
      g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, W, H)
      g.globalCompositeOperation = 'source-over'
    }
    tint(snapR, '#ff0000'); tint(snapC, '#00ffff')
    swap()
    const g = ghost.getContext('2d')!
    tv.classList.remove('is-glitch'); void tv.offsetWidth; tv.classList.add('is-glitch')
    cancelAnimationFrame(glitchRaf)
    const t0g = performance.now(), dur = 640
    let seed = 1
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    const frameFn = (now: number) => {
      const t = clamp01((now - t0g) / dur)
      seed = 1 + Math.floor(t * 23) * 7919   // re-roll the tear ~23 times over the change
      g.clearRect(0, 0, W, H)
      const split = Math.sin(Math.PI * Math.min(1, t * 1.25))
      const dx = Math.round(split * W * 0.022)
      const reveal = smooth(clamp01((t - 0.28) / 0.62))
      let y = 0
      while (y < H) {
        const bh = Math.max(2, Math.round(rnd() * rnd() * H * 0.12))
        if (rnd() > reveal) {
          const tear = rnd() < 0.3 ? (rnd() - 0.5) * W * 0.14 * split : 0
          g.globalCompositeOperation = 'source-over'; g.drawImage(snapR, 0, y, W, bh, tear + dx, y, W, bh)
          g.globalCompositeOperation = 'lighter'; g.drawImage(snapC, 0, y, W, bh, tear - dx, y, W, bh)
        }
        y += bh
      }
      g.globalCompositeOperation = 'source-over'
      for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(255,255,255,${(rnd() * 0.5 * split).toFixed(3)})`; g.fillRect(0, rnd() * H, W, 1 + rnd() * 3) }
      if (t < 1) glitchRaf = requestAnimationFrame(frameFn)
      else { g.clearRect(0, 0, W, H); tv.classList.remove('is-glitch') }
    }
    glitchRaf = requestAnimationFrame(frameFn)
  }

  let pending: number | null = null    // a channel change asked for mid-change plays right after, so fast keys never drop
  async function go(next: number, fromInside = false) {
    next = wrap(next)
    if (!openFlag || closing) return
    if (busy) { pending = next; return }
    if (next === cur) return
    busy = true
    const old = art
    const hadFocusInside = fromInside || (!!old && old.root.contains(document.activeElement))
    cur = next
    setAccent(next)
    const nr = reels[next]
    if (state.reduced) {
      rc?.setReel(nr); rc?.draw()
      if (old) unmount(old)
      scroller.scrollTop = 0
      armGooey(mount(next)); update()
    } else {
      glitch(() => { rc?.setReel(nr) })
      const flashA = mAnimate(flash, { opacity: [0, 0.22, 0] }, { duration: 0.32, times: [0, 0.2, 1] })
      const tasks: Promise<unknown>[] = []
      if (old) tasks.push(done(mAnimate(old.root, { opacity: [1, 0], filter: ['blur(0px)', 'blur(10px)'], transform: ['translateY(0px)', 'translateY(-16px)'] }, { duration: 0.22, ease: IN })))
      const st = scroller.scrollTop
      if (st > 2) tasks.push(done(mAnimate(st, 0, { duration: 0.42, ease: [0.6, 0, 0.2, 1], onUpdate: v => { scroller.scrollTop = v } })))
      await Promise.all(tasks)
      void flashA
      if (old) unmount(old)
      scroller.scrollTop = 0
      const a = mount(next)
      armGooey(a)
      update()
      intro(a, 0.02, { left: vw * 0.34, top: vh * 0.3, width: vw * 0.32, height: vh * 0.32 })
    }
    if (hadFocusInside) art?.name.focus({ preventScroll: true })
    busy = false
    opts.onStep?.(next)
    const q = pending; pending = null
    if (q !== null && q !== cur && openFlag && !closing) go(q, hadFocusInside)
  }

  // ---------- lightbox: evidence opens large, grown from its card ----------
  const lb = h('dialog', 'case-lb')
  lb.setAttribute('aria-label', 'Evidence')
  lb.innerHTML = `<div class="case-lb__bg"></div><figure class="case-lb__fig"></figure><p class="case-lb__cap"><span class="mono"></span><span></span></p>
    <button type="button" class="case-lb__x case__glass mono">${ICON.x}<span>Close</span></button>
    <button type="button" class="case-lb__nav case__glass" data-d="-1" aria-label="Previous item">${ICON.prev}</button>
    <button type="button" class="case-lb__nav case__glass" data-d="1" aria-label="Next item">${ICON.next}</button>`
  frame.append(lb)
  const lbFig = lb.querySelector<HTMLElement>('.case-lb__fig')!, lbBg = lb.querySelector<HTMLElement>('.case-lb__bg')!
  const lbCapN = lb.querySelector<HTMLElement>('.case-lb__cap .mono')!, lbCapT = lb.querySelector<HTMLElement>('.case-lb__cap span:last-child')!
  const lbNav = Array.from(lb.querySelectorAll<HTMLButtonElement>('.case-lb__nav'))
  let lbItems: MediaItem[] = [], lbK = 0, lbCard: HTMLElement | null = null, lbBusy = false, lbZoom = false
  function lbMedia(it: MediaItem): HTMLElement {
    if (it.kind === 'video') {
      const v = h('video', 'case-lb__media')
      v.controls = true; v.muted = true; v.playsInline = true; v.preload = 'metadata'
      v.poster = url(it.sm); v.src = url(it.lg)
      v.setAttribute('aria-label', it.alt || it.caption)
      return v
    }
    const img = h('img', 'case-lb__media'); img.alt = it.alt || it.caption; img.src = url(it.lg); img.decoding = 'async'
    img.width = it.width; img.height = it.height
    return img
  }
  function lbShow(k: number) {
    lbK = (k + lbItems.length) % lbItems.length
    const it = lbItems[lbK]
    lbFig.innerHTML = ''
    lbZoom = false
    const el = lbMedia(it)
    const box = lbFig.getBoundingClientRect()
    const s = Math.min(box.width / it.width, box.height / it.height, 1.6)
    el.style.width = `${Math.round(it.width * s)}px`; el.style.height = `${Math.round(it.height * s)}px`
    lbFig.append(el)
    lbCapN.textContent = `E${pad(lbK + 1)} / ${pad(lbItems.length)}`
    lbCapT.textContent = it.caption
    lbNav.forEach(b => { b.hidden = lbItems.length < 2 })
    return el
  }
  // the card the lightbox grows from and shrinks back to: asked of whichever part opened it (wall panel, book page)
  let lbOwner: Part | null = null
  function cardOf(k: number) { return lbOwner?.card(k) ?? null }
  function flipFrom(el: HTMLElement, card: HTMLElement | null, reverse: boolean) {
    const fr = el.getBoundingClientRect()
    if (!card || state.reduced || !fr.width) return Promise.resolve()
    const cr = card.getBoundingClientRect()
    const s = Math.max(cr.width / fr.width, cr.height / fr.height)
    const tf = `translate(${cr.left + cr.width / 2 - (fr.left + fr.width / 2)}px, ${cr.top + cr.height / 2 - (fr.top + fr.height / 2)}px) scale(${s})`
    const rest = 'translate(0px, 0px) scale(1)'
    const kf = reverse ? [rest, tf] : [tf, rest]
    return done(mAnimate(el, { transform: kf, opacity: reverse ? [1, 0.2] : [0.4, 1] }, reverse ? { duration: 0.34, ease: IN } : { type: 'spring', visualDuration: 0.5, bounce: 0.14 }))
  }
  function openLightbox(items: MediaItem[], k: number, card: HTMLElement | null) {
    lbItems = items; lbCard = card
    lbOwner = (card && art?.parts.find(pt => pt.el.contains(card))) || null
    const it = items[k]
    lb.showModal()
    const el = lbShow(k)
    lb.querySelector<HTMLButtonElement>('.case-lb__x')!.focus({ preventScroll: true })
    cue('evidence:zoom', { on: true })
    if (state.reduced) return
    // rack focus: the world behind the glass pulls out of focus while the evidence grows out of its card
    mAnimate(lbBg, { opacity: [0, 1] }, { duration: 0.42 })
    const go2 = () => flipFrom(el, card, false)
    if (el instanceof HTMLImageElement && !el.complete) { el.style.opacity = '0'; el.addEventListener('load', () => { el.style.opacity = ''; go2() }, { once: true }) } else go2()
    void it
  }
  async function closeLightbox() {
    if (lbBusy || !lb.open) return
    lbBusy = true
    const el = lbFig.firstElementChild as HTMLElement | null
    if (el instanceof HTMLVideoElement) el.pause()
    const card = cardOf(lbK) ?? lbCard
    if (el && !state.reduced) await Promise.all([flipFrom(el, card, true), done(mAnimate(lbBg, { opacity: [1, 0] }, { duration: 0.3 }))])
    lb.close()
    lbFig.innerHTML = ''
    card?.focus({ preventScroll: true })
    card?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    lbBusy = false
  }
  lb.addEventListener('cancel', e => { e.preventDefault(); closeLightbox() })
  lb.querySelector('.case-lb__x')!.addEventListener('click', () => closeLightbox())
  lbBg.addEventListener('click', () => closeLightbox())
  lbNav.forEach(b => b.addEventListener('click', () => { const el = lbShow(lbK + +b.dataset.d!); if (!state.reduced) mAnimate(el, { opacity: [0, 1], transform: [`translateX(${+b.dataset.d! * 40}px)`, 'none'] }, { duration: 0.4, ease: OUT }) }))
  lb.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); lbNav[e.key === 'ArrowLeft' ? 0 : 1].click() }
  })
  // click the large image to zoom into it; the pointer then pans the zoomed image
  const zoomOrigin = (el: HTMLElement, e: MouseEvent) => {
    const r = lbFig.getBoundingClientRect()
    el.style.transformOrigin = `${(clamp01((e.clientX - r.left) / r.width) * 100).toFixed(1)}% ${(clamp01((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`
  }
  lbFig.addEventListener('click', e => {
    const el = lbFig.firstElementChild
    if (!(el instanceof HTMLImageElement) || e.target !== el) return
    lbZoom = !lbZoom
    el.classList.toggle('is-zoom', lbZoom)
    el.style.transition = state.reduced ? 'none' : 'transform .55s cubic-bezier(.2, .9, .3, 1), transform-origin .18s ease-out'
    if (lbZoom) { zoomOrigin(el, e); el.style.transform = 'scale(2.4)' } else el.style.transform = 'scale(1)'
    cue('evidence:zoom', { on: lbZoom })
  })
  lb.addEventListener('pointermove', e => {
    const el = lbFig.firstElementChild
    if (lbZoom && el instanceof HTMLImageElement) zoomOrigin(el, e)
  })

  // ---------- open / close ----------
  function open(i: number, fromRect?: DOMRect) {
    i = wrap(i)
    if (openFlag && !closing) { go(i); return }
    if (closing) finishClose(true)
    openFlag = true
    cur = i
    const ae = document.activeElement
    opener = ae instanceof HTMLElement && ae !== document.body ? ae : null
    vw = innerWidth; vh = innerHeight
    from = fromRect && fromRect.width > 4 && fromRect.height > 4
      ? { left: fromRect.left, top: fromRect.top, width: fromRect.width, height: fromRect.height }
      : { left: vw * 0.32, top: vh * 0.32, width: vw * 0.36, height: vh * 0.36 }
    ensureReel()
    rc!.setReel(reels[i]); rc!.setIntensity(1)
    setAccent(i)
    dlg.classList.toggle('is-still', !ambient())
    if (art) unmount(art)
    dlg.showModal()
    scroller.scrollTop = 0
    measure()
    const a = mount(i)
    measure()
    t0 = performance.now()
    a.name.focus({ preventScroll: true })
    if (state.reduced) {
      setFly(1); armGooey(a); dlg.classList.add('is-dim'); rc!.draw(); return
    }
    setFly(0)
    rc!.draw()
    requestAnimationFrame(() => dlg.classList.add('is-dim'))
    bar.style.opacity = '0'
    // power-on: a lighter version of the channel-change static and roll rides the fly
    tv.classList.remove('is-tune'); void tv.offsetWidth; tv.classList.add('is-tune')
    setTimeout(() => tv.classList.remove('is-tune'), 800)
    flyAnim = mAnimate(0, 1, { duration: 0.74, ease: FLY, onUpdate: setFly, onComplete: () => { setFly(1); armGooey(a) } })
    mAnimate(flash, { opacity: [0, 0.28, 0] }, { duration: 0.42, times: [0, 0.18, 1], ease: 'easeOut' })
    mAnimate(bar, { opacity: [0, 1], transform: ['translateY(-18px)', 'none'] }, { duration: 0.6, delay: 0.42, ease: OUT })
    intro(a, 0.34, from)
    kick()
  }

  // Closing runs in parallel and ends by 0.8 s: the page folds, the title's letters shatter back into the TV screen and the frame collapses
  // onto it all at once. A timer finishes the close at the cap even if an animation lags, and any key or click while it plays finishes it at once.
  const CLOSE_CAP = 800
  let closeTimer = 0
  let closeAnims: Stop[] = []
  function close() {
    if (!openFlag) return
    if (closing) { finishClose(); return }
    if (lb.open) { lb.close(); lbFig.innerHTML = '' }
    closing = true
    if (state.reduced) { finishClose(); return }
    if (flyAnim) stopAll([flyAnim])
    const a = art
    const A = closeAnims
    const body = a?.root.querySelector<HTMLElement>('.cv-body')
    const st = scroller.scrollTop
    if (a && body) A.push(mAnimate(body, { opacity: [1, 0], transform: ['translateY(0px)', 'translateY(14px)'] }, { duration: 0.18, ease: IN }))
    A.push(mAnimate(bar, { opacity: [1, 0] }, { duration: 0.16 }))
    if (st > 2) A.push(mAnimate(st, 0, { duration: 0.26, ease: [0.6, 0, 0.2, 1], onUpdate: v => { scroller.scrollTop = v } }))
    if (a) {
      const sh = shatter(a.chars, from, hk)
      if (sh) { try { (sh as unknown as { speed: number }).speed = 1.7 } catch { /* a fixed-speed animation */ } A.push(sh as unknown as Stop) }
      const heroRest = Array.from(a.hero.querySelectorAll<HTMLElement>('.cv-top, .cv-rule, .cv-row, .cv-cue, .cv-echo'))
      if (heroRest.length) A.push(mAnimate(heroRest, { opacity: [1, 0] }, { duration: 0.2 }))
      A.push(mAnimate(a.root, { opacity: [1, 0] }, { duration: 0.14, delay: 0.3 }))
    }
    dlg.classList.remove('is-dim')
    const back = mAnimate(flyT, 0, { duration: 0.46, delay: 0.14, ease: COLLAPSE, onUpdate: setFly })
    flyAnim = back
    A.push(mAnimate(flash, { opacity: [0, 0.3, 0] }, { duration: 0.2, delay: 0.5 }))
    closeTimer = window.setTimeout(() => { if (closing) finishClose() }, CLOSE_CAP - 80)
  }
  // the first focusable control of the page, for when the opener is gone (a test hook or a link that was replaced)
  function firstControl(): HTMLElement | null {
    const sel = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      if (dlg.contains(el) || lb.contains(el) || el.closest('[inert], [hidden]')) continue
      const r = el.getClientRects()
      if (!r.length || getComputedStyle(el).visibility === 'hidden') continue
      return el
    }
    return null
  }
  function finishClose(silent = false) {
    const i = cur
    clearTimeout(closeTimer); stopAll(closeAnims)
    closing = false
    openFlag = false
    cancelAnimationFrame(raf); raf = 0
    cancelAnimationFrame(glitchRaf); tv.classList.remove('is-glitch', 'is-tune')
    if (flyAnim) stopAll([flyAnim])
    if (art) unmount(art)
    dlg.classList.remove('is-dim')
    if (dlg.open) { ownClose++; dlg.close() }
    frame.style.clipPath = ''; fly.style.transform = ''; bar.style.opacity = ''; bar.style.transform = ''; flash.style.opacity = '0'
    if (!silent) {
      // focus goes back to what opened the case; with no opener, to the first control of the page (never to <body>)
      const back = opener && opener.isConnected ? opener : firstControl()
      back?.focus({ preventScroll: true })
      opts.onClose?.(i)
    }
  }

  // ---------- controls ----------
  dlg.addEventListener('cancel', e => { e.preventDefault(); close() })
  const skipClose = (e: Event) => { if (closing) { e.preventDefault(); e.stopPropagation(); finishClose() } }
  dlg.addEventListener('keydown', skipClose, true); dlg.addEventListener('pointerdown', skipClose, true); dlg.addEventListener('click', skipClose, true)
  // 7C: dlg.close() queues its 'close' event. When a CTA reopens the case while the previous one is still closing, finishClose(true) runs inside open(),
  // and that stale event would then close the freshly opened dialog (a silent no-op for the click). Events we caused ourselves are skipped.
  dlg.addEventListener('close', () => { if (ownClose > 0) { ownClose--; return } if (openFlag && !closing) finishClose() })
  backBtn.addEventListener('click', () => close())
  // Copy link: the canonical URL of the case on screen (src/ui/links.ts). Clipboard API first, then a hidden textarea and execCommand for an insecure context or a
  // refused permission; the live region in the header says what happened, and when both fail the label points at the address bar, which already holds the link.
  let copyT = 0
  function resetCopy() { clearTimeout(copyT); copyBtn.classList.remove('is-done'); copyLb.textContent = 'Copy link' }
  async function writeClipboard(text: string): Promise<boolean> {
    try { await navigator.clipboard.writeText(text); return true } catch { /* no permission or no secure context: fall through */ }
    const ta = document.createElement('textarea')
    ta.value = text; ta.readOnly = true; ta.setAttribute('aria-hidden', 'true'); ta.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0'
    dlg.append(ta); ta.select() // inside the dialog: a modal dialog leaves nothing outside it focusable
    let ok = false
    try { ok = document.execCommand('copy') } catch { /* blocked */ }
    ta.remove()
    return ok
  }
  copyBtn.addEventListener('click', async () => {
    const href = copyBtn.dataset.href || projectLink(projOf(cur).id), name = projOf(cur).name
    const ok = await writeClipboard(href)
    copyBtn.focus({ preventScroll: true })
    clearTimeout(copyT)
    copyBtn.classList.toggle('is-done', ok)
    copyLb.textContent = ok ? 'Copied' : 'In URL bar'
    const shown = href.replace(/^https:\/\//, '')
    live.textContent = ''
    requestAnimationFrame(() => { live.textContent = ok ? `Link to ${name} copied: ${shown}` : `Copying was blocked. The address bar holds the link to ${name}: ${shown}` })
    copyT = window.setTimeout(resetCopy, 2200)
  })
  const target = () => pending ?? cur
  stepBtns.forEach(b => b.addEventListener('click', () => go(target() + +b.dataset.d!)))
  dots.addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ch]'); if (b) go(+b.dataset.ch!) })
  dlg.addEventListener('keydown', e => {
    if (lb.open || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const t = e.target as HTMLElement
    if (t.closest('.cv-wall, .cv-book, input, textarea, select, video, [contenteditable]')) return
    e.preventDefault()
    go(target() + (e.key === 'ArrowLeft' ? -1 : 1))
  })

  return { open, close: () => { close() }, isOpen: () => openFlag }
}
