// Evidence: the showpieces of a case view.
//   buildWall  : a work's real media as a curved arc of glossy panels in CSS 3D. Drag, sideways scroll, keys and the page
//                scroll all bend it; a sheen follows the pointer; the front panel plays if it is a video.
//   buildBook  : a page-flip book of the project's actual PDF (pages pre-rendered by scripts/render-books.mjs).
//   odometer   : digit columns that roll to the exact figure from the data, then hand the text back untouched.
//   assemble / shatter : the title's letters fly out of the TV screen rect and fly back into it.
// Anime.js owns every moving part in this file; the case shell keeps Motion. No element is animated by both.
// Honesty: nothing here invents a number. Counters render the figure already in src/data; page counters are structure.
import { animate as aAnimate, stagger as aStagger } from 'animejs'
import { url, type MediaItem } from '../data'
import booksRaw from './books.json'

export interface Hooks {
  cue(name: string, data?: unknown): void
  reduced(): boolean
  /** reduced motion or the site's Pause switch: nothing moves on its own */
  still(): boolean
  open(items: MediaItem[], k: number, from: HTMLElement | null): void
}
export interface Part { el: HTMLElement; mount(): void; layout(): void; dispose(): void; card(k: number): HTMLElement | null }
export type Box = { left: number; top: number; width: number; height: number }
type Stop = { stop(): void } | { cancel(): unknown }
// anime's types are strict about param shapes that are valid at runtime (function values, from/to objects)
// kept (S1): without this cast tsc 6.0 fails on the (_, i) function values (rotate, delay, the glyph and char tweens) and on a nullable querySelector target at :541
const A = aAnimate as unknown as (t: unknown, p: Record<string, unknown>) => { cancel(): unknown; then(a: () => void, b?: () => void): unknown }
const S = aStagger

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)
const pad = (n: number) => String(n).padStart(2, '0')
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c])
const finePointer = matchMedia('(hover: hover) and (pointer: fine)')
function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}
const CHEV = {
  prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>',
}

// =====================================================================================
// The evidence wall
// =====================================================================================
export function buildWall(items: MediaItem[], hk: Hooks, scroller: HTMLElement, label: string): Part {
  const n = items.length
  const root = h('div', 'cv-wall')
  root.dataset.rv = ''
  if (!hk.still()) root.classList.add('is-pre')
  root.innerHTML = `
    <div class="wl-stage" role="group" aria-roledescription="carousel" aria-label="${esc(label)}">
      <ul class="wl-ring" role="list"></ul>
      <div class="wl-floor" aria-hidden="true"></div>
    </div>
    <div class="wl-bar">
      <button type="button" class="wl-nav case__glass" data-d="-1" aria-label="Previous panel">${CHEV.prev}</button>
      <span class="wl-rail" aria-hidden="true"><i></i></span>
      <button type="button" class="wl-nav case__glass" data-d="1" aria-label="Next panel">${CHEV.next}</button>
    </div>
    <p class="cv-evcap"><span class="mono"></span><span></span></p>
    <p class="cv-evhint mono">${finePointer.matches ? 'Drag or scroll sideways to turn · click the front panel to open it large' : 'Swipe to turn · tap the front panel to open it large'}</p>`
  const stage = root.querySelector<HTMLElement>('.wl-stage')!
  const ring = root.querySelector<HTMLElement>('.wl-ring')!
  const rail = root.querySelector<HTMLElement>('.wl-rail i')!
  const capN = root.querySelector<HTMLElement>('.cv-evcap .mono')!
  const capT = root.querySelector<HTMLElement>('.cv-evcap span:last-child')!
  const navs = Array.from(root.querySelectorAll<HTMLButtonElement>('.wl-nav'))
  navs.forEach(b => { b.hidden = n < 2 })
  if (n < 2) root.querySelector<HTMLElement>('.wl-bar')!.hidden = true

  const lis: HTMLElement[] = [], btns: HTMLButtonElement[] = [], shades: HTMLElement[] = [], ins: HTMLElement[] = []
  items.forEach((it, k) => {
    const li = h('li', 'wl-p'), inn = h('div', 'wl-in')
    const b = h('button', 'wl-btn'); b.type = 'button'
    b.setAttribute('aria-label', `${it.kind === 'video' ? 'Play video' : 'Open'}: ${it.caption}`)
    const img = h('img'); img.alt = ''; img.decoding = 'async'; img.draggable = false; img.loading = k < 6 ? 'eager' : 'lazy'; img.src = url(it.sm)
    const ar = it.width / it.height
    if (ar < 0.46 || ar > 1.9) b.classList.add('is-fit')
    const shade = h('span', 'wl-shade'), sheen = h('span', 'wl-sheen'), num = h('span', 'n mono', `E${pad(k + 1)}`)
    shade.setAttribute('aria-hidden', 'true'); sheen.setAttribute('aria-hidden', 'true')
    b.append(img, shade, sheen, num)
    if (it.kind === 'video') { const pl = h('span', 'play'); pl.setAttribute('aria-hidden', 'true'); b.append(pl) }
    const refl = h('span', 'wl-refl'); refl.setAttribute('aria-hidden', 'true')
    const ri = h('img'); ri.alt = ''; ri.draggable = false; ri.decoding = 'async'; ri.src = url(it.sm); refl.append(ri)
    inn.append(b, refl); li.append(inn); ring.append(li)
    lis.push(li); btns.push(b); shades.push(shade); ins.push(inn)
  })

  // ---- geometry: panels sit on a cylinder, spaced by arc length so mixed aspect ratios keep an even gutter
  let W = 700, ph = 300, R = 800, maxS = 0
  let pw: number[] = [], c: number[] = []
  const hidden: boolean[] = items.map(() => false)
  function layout() {
    W = stage.clientWidth || 700
    const narrow = W < 520
    // wide panels would leave no room for their neighbours on the arc: size the row of panels by the typical (75th percentile) aspect
    const ars = items.map(it => clamp(it.width / it.height, 0.46, 1.9)).sort((a, b) => a - b)
    const q = ars[Math.min(n - 1, Math.ceil(0.75 * (n - 1)))] ?? 1
    ph = Math.round(clamp(Math.min(W * (narrow ? 0.72 : 0.45), (W * 0.56) / Math.max(0.5, q)), 170, 340))
    stage.style.setProperty('--ph', `${ph}px`)
    stage.style.height = `${ph + (narrow ? 104 : 140)}px`
    const gap = narrow ? 26 : 44
    pw = items.map(it => Math.min(W * 0.62, ph * clamp(it.width / it.height, 0.46, 1.9)))
    c = []
    pw.forEach((w, i) => { c.push(i === 0 ? 0 : c[i - 1] + pw[i - 1] / 2 + gap + w / 2) })
    maxS = c[n - 1] ?? 0
    // narrow panels (phone screens) sit on a tighter circle so the curve reads; wide ones keep a long, calm arc
    const mid = [...pw].sort((a, b) => a - b)[Math.floor(n / 2)] ?? 300
    R = clamp(Math.min(W * 1.05, mid * 3.2 + 120), narrow ? 360 : 480, 1000)
    lis.forEach((li, i) => { li.style.width = `${pw[i]}px`; li.style.height = `${ph}px`; li.style.marginLeft = `${-pw[i] / 2}px` })
    sig = ''
    draw()
  }

  // ---- state
  let s = 0, v = 0, target = 0, cur = -1
  let dragging = false, down = false, wheelUntil = 0, justDragged = false
  let x0 = 0, y0 = 0, s0 = 0, lastX = 0, lastT = 0, vel = 0, downFront = -1
  let bend = 0, ex = 0, pitch = 0, lastSt = scroller.scrollTop
  const pn = { x: 0, y: 0, tx: 0, ty: 0 }
  let vis = false, raf = 0, last = 0, sig = '', entered = false, disposed = false
  let enterAnim: { cancel(): unknown } | null = null
  let wheelT = 0, lastFlipCue = 0
  const live = new Map<number, HTMLVideoElement>()

  const nearest = (x: number) => { let b = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = Math.abs(c[i] - x); if (d < bd) { bd = d; b = i } } return b }
  const rubber = (x: number) => (x < 0 ? x * 0.32 : x > maxS ? maxS + (x - maxS) * 0.32 : x)

  function draw() {
    if (!c.length) return
    const Rb = R * (1 - 0.28 * bend)
    const key = `${s.toFixed(1)}|${bend.toFixed(3)}|${ex.toFixed(3)}|${pitch.toFixed(2)}|${pn.x.toFixed(2)}|${pn.y.toFixed(2)}|${R}`
    if (key === sig) return
    sig = key
    ring.style.transform = `translateZ(${(-Rb).toFixed(1)}px) rotateX(${pitch.toFixed(2)}deg) rotateY(${ex.toFixed(4)}rad)`
    stage.style.perspectiveOrigin = `${(50 + pn.x * 9).toFixed(1)}% ${(46 + pn.y * 7).toFixed(1)}%`
    for (let i = 0; i < n; i++) {
      const a = (c[i] - s) / Rb, ab = Math.abs(a)
      if (ab > 1.3) { if (!hidden[i]) { lis[i].style.visibility = 'hidden'; hidden[i] = true } continue }
      if (hidden[i]) { lis[i].style.visibility = ''; hidden[i] = false }
      lis[i].style.transform = `rotateY(${a.toFixed(4)}rad) translateZ(${Rb.toFixed(1)}px)`
      shades[i].style.opacity = (Math.pow(clamp(ab / 0.95, 0, 1), 1.15) * 0.66).toFixed(3)
      lis[i].style.pointerEvents = ab > 0.95 ? 'none' : ''
    }
  }

  function setFront(i: number, user: boolean) {
    if (i === cur) return
    const first = cur < 0
    cur = i
    btns.forEach((b, k) => { if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current') })
    capN.textContent = `E${pad(i + 1)} / ${pad(n)}`
    capT.textContent = items[i].caption
    rail.style.transform = `scaleX(${n > 1 ? ((i + 1) / n).toFixed(4) : 1})`
    items.forEach((it, k) => { if (it.kind === 'video') { if (k === i) liveOn(k); else if (!btns[k].matches(':hover')) liveOff(k) } })
    if (!first && user) { const t = performance.now(); if (t - lastFlipCue > 110) { lastFlipCue = t; hk.cue('evidence:flip') } }
  }
  function liveOn(k: number) {
    if (live.has(k) || hk.still() || !vis) return
    const v2 = h('video', 'wl-live'); v2.muted = true; v2.loop = true; v2.playsInline = true; v2.preload = 'auto'; v2.tabIndex = -1
    v2.setAttribute('aria-hidden', 'true'); v2.src = url(items[k].lg)
    btns[k].insertBefore(v2, btns[k].querySelector('.wl-shade'))
    live.set(k, v2)
    v2.play().then(() => v2.classList.add('is-on')).catch(() => { /* autoplay refused: the poster stays */ })
  }
  function liveOff(k: number) { live.get(k)?.remove(); live.delete(k) }

  function frame(now: number) {
    raf = 0
    if (disposed || !vis) return
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now
    let moving = false
    if (!dragging && now >= wheelUntil) {
      if (hk.reduced()) { if (s !== target) { s = target; moving = true } v = 0 }
      else {
        const K = 130, C = 2 * Math.sqrt(K) * 0.78
        v += (K * (target - s) - C * v) * dt; s += v * dt
        if (Math.abs(target - s) < 0.2 && Math.abs(v) < 3) { s = target; v = 0 } else moving = true
      }
    } else moving = true
    if (!hk.still()) {
      const sr = scroller.getBoundingClientRect(), rr = root.getBoundingClientRect()
      const nv = clamp(((rr.top + rr.height / 2) - (sr.top + sr.height / 2)) / Math.max(1, sr.height), -1, 1)
      const st = scroller.scrollTop, sv = Math.abs(st - lastSt) / Math.max(0.001, dt); lastSt = st
      bend = lerp(bend, clamp(sv / 2600, 0, 1), 0.14)
      ex = lerp(ex, -nv * 0.16, 0.09)
      pitch = lerp(pitch, nv * 3 - pn.y * 2.4, 0.09)
    } else { bend = 0; ex = 0; pitch = 0 }
    pn.x = lerp(pn.x, pn.tx, 0.08); pn.y = lerp(pn.y, pn.ty, 0.08)
    draw()
    setFront(nearest(s), true)
    if (!hk.still() || moving || dragging) raf = requestAnimationFrame(frame)
  }
  const kick = () => { if (!raf && vis && !disposed) { last = 0; raf = requestAnimationFrame(frame) } }
  function go(k: number) {
    k = clamp(k, 0, n - 1)
    target = c[k]; v = 0
    kick()
  }

  // ---- first time in view: panels fly up into the arc
  function enter() {
    if (entered) return
    entered = true
    root.classList.remove('is-pre')
    if (hk.still()) return
    enterAnim = A(ins, { opacity: [0, 1], translateY: [90, 0], scale: [0.84, 1], rotate: (_: unknown, i: number) => [i % 2 ? 4 : -4, 0],
      delay: S(75), duration: 1150, ease: 'out(4)' })
  }
  const io = new IntersectionObserver(es => {
    vis = es.some(e => e.isIntersecting)
    if (vis) { enter(); lastSt = scroller.scrollTop; if (cur >= 0) liveOn(cur); kick() }
    else { for (const k of Array.from(live.keys())) liveOff(k) }
  }, { root: scroller, rootMargin: '8% 0px 8% 0px', threshold: 0.01 })

  // ---- pointer: drag with a throw, rubber band at the ends, snap to the nearest panel
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    down = true; dragging = false; x0 = lastX = e.clientX; y0 = e.clientY; s0 = s; vel = 0; lastT = performance.now()
  })
  stage.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect()
    pn.tx = clamp(((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2, -1, 1)
    pn.ty = clamp(((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2, -1, 1)
    if (!hk.still()) kick()
    if (!down) return
    const dx = e.clientX - x0, dy = e.clientY - y0
    if (!dragging) {
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 1.1) {
        dragging = true; stage.setPointerCapture(e.pointerId); stage.classList.add('is-drag'); hk.cue('pov:grab')
      } else return
    }
    const prev = s
    s = rubber(s0 - dx * 1.08); v = 0
    const now = performance.now(), dt = Math.max(1, now - lastT)
    vel = lerp(vel, ((s - prev) / dt) * 1000, 0.45); lastT = now; lastX = e.clientX
    kick(); draw()
  })
  const release = () => {
    if (!down) return
    down = false
    if (!dragging) return
    dragging = false; stage.classList.remove('is-drag')
    justDragged = true; setTimeout(() => { justDragged = false }, 0)
    const proj = s + (hk.reduced() ? 0 : clamp(vel, -2600, 2600) * 0.26)
    target = c[nearest(clamp(proj, 0, maxS))]; v = hk.reduced() ? 0 : clamp(vel, -2600, 2600) * 0.5
    kick()
  }
  stage.addEventListener('pointerup', release)
  stage.addEventListener('pointercancel', release)
  stage.addEventListener('pointerleave', () => { pn.tx = 0; pn.ty = 0 })
  root.addEventListener('click', e => { if (justDragged) { e.preventDefault(); e.stopPropagation() } }, true)
  // sideways trackpad scroll turns the wall; vertical scroll still belongs to the page
  stage.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2 || n < 2) return
    e.preventDefault()
    s = clamp(s + e.deltaX * 1.15, -60, maxS + 60); v = 0
    wheelUntil = performance.now() + 150
    clearTimeout(wheelT)
    wheelT = window.setTimeout(() => { target = c[nearest(clamp(s, 0, maxS))]; kick() }, 150)
    kick()
  }, { passive: false })

  // ---- panels: sheen follows the pointer, the front panel opens, a side panel comes to the front
  btns.forEach((b, k) => {
    b.addEventListener('pointerdown', () => { downFront = cur === k ? k : -1 })
    b.addEventListener('focus', () => go(k))
    b.addEventListener('click', e => {
      if (e.detail === 0 || downFront === k) hk.open(items, k, b)
      else go(k)
    })
    if (items[k].kind === 'video') {
      b.addEventListener('pointerenter', () => liveOn(k))
      b.addEventListener('pointerleave', () => { if (cur !== k) liveOff(k) })
    }
    b.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || dragging) return
      const r = b.getBoundingClientRect()
      const mx = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1), my = clamp((e.clientY - r.top) / Math.max(1, r.height), 0, 1)
      b.style.setProperty('--mx', `${(mx * 100).toFixed(1)}%`); b.style.setProperty('--my', `${(my * 100).toFixed(1)}%`)
      b.style.setProperty('--tx', `${((mx - 0.5) * 12).toFixed(2)}deg`); b.style.setProperty('--ty', `${((0.5 - my) * 9).toFixed(2)}deg`)
    })
    b.addEventListener('pointerleave', () => { b.style.setProperty('--tx', '0deg'); b.style.setProperty('--ty', '0deg') })
  })
  navs.forEach(b => b.addEventListener('click', () => go((cur < 0 ? 0 : cur) + +b.dataset.d!)))
  root.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault(); e.stopPropagation()
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : clamp(i + (e.key === 'ArrowLeft' ? -1 : 1), 0, n - 1)
    go(j); requestAnimationFrame(() => requestAnimationFrame(() => btns[j].focus({ preventScroll: true })))
  })
  const ro = new ResizeObserver(() => layout())

  return {
    el: root,
    mount() { layout(); setFront(0, false); ro.observe(stage); io.observe(root) },
    layout,
    card: k => btns[k] ?? null,
    dispose() {
      disposed = true
      cancelAnimationFrame(raf); clearTimeout(wheelT)
      io.disconnect(); ro.disconnect(); enterAnim?.cancel()
      for (const k of Array.from(live.keys())) liveOff(k)
    },
  }
}

// =====================================================================================
// The page-flip book
// =====================================================================================
interface BookSpec { pdf: string; pages: number; width: number; height: number; dir: string; prefix: string; ext: string }
const BOOKS = booksRaw as unknown as Record<string, BookSpec>
export const hasBook = (id: string) => !!BOOKS[id]

export function buildBook(id: string, title: string, link: { href: string; label: string } | null, hk: Hooks, scroller: HTMLElement): Part | null {
  const spec = BOOKS[id]
  if (!spec) return null
  const N = spec.pages
  const items: MediaItem[] = Array.from({ length: N }, (_, i) => {
    const src = `${spec.dir}/${spec.prefix}${pad(i + 1)}.${spec.ext}`
    return { slug: `p-${pad(i + 1)}`, lg: src, sm: src, width: spec.width, height: spec.height, orientation: spec.width > spec.height ? 'landscape' : 'portrait',
      kind: 'page', alt: `Page ${i + 1} of ${N}, ${title}`, caption: `Page ${i + 1} of ${N}` }
  })
  const single = innerWidth < 700
  const L = single ? N : Math.ceil(N / 2)
  const frontOf = (j: number) => (single ? j : 2 * j)
  const backOf = (j: number) => (single ? -1 : 2 * j + 1 < N ? 2 * j + 1 : -1)

  const root = h('div', 'cv-book')
  root.dataset.rv = ''
  root.classList.toggle('is-single', single)
  root.innerHTML = `
    <div class="bk-stage" role="group" aria-label="${esc(title)}, the paper. Turn pages with the buttons, the arrow keys, or by dragging a page.">
      <div class="bk-tilt"><div class="bk-book"></div></div>
      <div class="bk-shadow" aria-hidden="true"></div>
    </div>
    <div class="bk-bar">
      <button type="button" class="wl-nav case__glass" data-d="-1" aria-label="Turn back a page">${CHEV.prev}</button>
      <input class="bk-range" type="range" min="0" max="${L}" step="1" value="0" aria-label="Turn to a spread">
      <button type="button" class="wl-nav case__glass" data-d="1" aria-label="Turn the page">${CHEV.next}</button>
      <span class="bk-count mono" data-proof="skip" aria-live="polite"></span>
    </div>
    <div class="bk-actions">
      <button type="button" class="bk-open case__glass mono">Open the page large</button>
      ${link ? '<a class="bk-read mono" target="_blank" rel="noopener"><span></span><i aria-hidden="true">↗</i></a>' : ''}
    </div>
    <p class="cv-evhint mono">${finePointer.matches ? 'Drag a page edge or click a page to turn it' : 'Swipe a page, or use the arrows'}</p>`
  const stage = root.querySelector<HTMLElement>('.bk-stage')!
  const tilt = root.querySelector<HTMLElement>('.bk-tilt')!
  const book = root.querySelector<HTMLElement>('.bk-book')!
  const shadow = root.querySelector<HTMLElement>('.bk-shadow')!
  const range = root.querySelector<HTMLInputElement>('.bk-range')!
  const count = root.querySelector<HTMLElement>('.bk-count')!
  const navs = Array.from(root.querySelectorAll<HTMLButtonElement>('.wl-nav'))
  const openBtn = root.querySelector<HTMLButtonElement>('.bk-open')!
  if (link) { const a = root.querySelector<HTMLAnchorElement>('.bk-read')!; a.href = link.href; a.querySelector('span')!.textContent = link.label; a.setAttribute('aria-label', `${link.label} (opens in a new tab)`) }

  interface Leaf { el: HTMLElement; f: HTMLElement; b: HTMLElement; fs: HTMLElement; bs: HTMLElement; fi: HTMLImageElement; bi: HTMLImageElement | null; loaded: boolean }
  const leaves: Leaf[] = []
  const blkR = h('div', 'bk-blk bk-blk--r'), blkL = h('div', 'bk-blk bk-blk--l')
  blkR.setAttribute('aria-hidden', 'true'); blkL.setAttribute('aria-hidden', 'true')
  book.append(blkR, blkL)
  for (let j = 0; j < L; j++) {
    const el = h('div', 'bk-leaf'), f = h('div', 'bk-f'), b = h('div', 'bk-b')
    const fi = h('img'); fi.alt = ''; fi.draggable = false; fi.decoding = 'async'
    const fs = h('span', 'bk-sh'), bs = h('span', 'bk-sh')
    f.append(fi, fs)
    let bi: HTMLImageElement | null = null
    if (backOf(j) >= 0) { bi = h('img'); bi.alt = ''; bi.draggable = false; bi.decoding = 'async'; b.append(bi) }
    b.append(bs)
    el.append(f, b); book.append(el)
    leaves.push({ el, f, b, fs, bs, fi, bi, loaded: false })
  }

  let Wp = 280, Hp = 360, f = 0
  const prog: number[] = leaves.map(() => 0)
  const anims: ({ cancel(): unknown } | null)[] = leaves.map(() => null)
  let vis = false, entered = false, disposed = false, lastCue = 0
  let enterAnim: { cancel(): unknown } | null = null
  const ar = spec.width / spec.height

  function ensure() {
    for (let j = Math.max(0, f - 3); j <= Math.min(L - 1, f + 4); j++) {
      const lf = leaves[j]
      if (lf.loaded) continue
      lf.loaded = true
      lf.fi.src = url(items[frontOf(j)].sm)
      if (lf.bi) lf.bi.src = url(items[backOf(j)].sm)
    }
  }
  function apply() {
    for (let j = 0; j < L; j++) {
      const p = prog[j], lf = leaves[j]
      const near = Math.abs(j - f) <= 3
      lf.el.style.display = near || (p > 0.001 && p < 0.999) ? '' : 'none'
      const lift = Math.sin(p * Math.PI) * 38
      const z = lerp(L - j, j + 1, smooth(p)) * 0.75 + lift
      lf.el.style.transform = `translateZ(${z.toFixed(2)}px) rotateY(${(-p * 180).toFixed(2)}deg)`
      const mid = Math.sin(p * Math.PI)
      lf.fs.style.opacity = (mid * 0.5).toFixed(3)
      lf.bs.style.opacity = (mid * 0.5).toFixed(3)
      lf.el.style.opacity = single ? (1 - smooth(clamp((p - 0.55) / 0.45, 0, 1))).toFixed(3) : ''
    }
    // the page block under each side thickens with the pages it holds
    const done = prog.reduce((a, b) => a + b, 0)
    const tR = Math.max(0, (L - done) / L) * 13, tL = Math.max(0, done / L) * 13
    blkR.style.setProperty('--t', `${tR.toFixed(1)}px`); blkL.style.setProperty('--t', `${tL.toFixed(1)}px`)
    blkR.style.opacity = tR < 0.6 ? '0' : '1'; blkL.style.opacity = single || tL < 0.6 ? '0' : '1'
    if (!single) {
      const shift = -(Wp / 2) * (1 - smooth(prog[0])) + (Wp / 2) * smooth(prog[L - 1])
      book.style.transform = `translateX(${shift.toFixed(1)}px)`
      shadow.style.transform = `translateX(${shift.toFixed(1)}px)`
    }
  }
  function layout() {
    const W = stage.clientWidth || 700
    const maxH = single ? 430 : 400
    Wp = single ? Math.min(W * 0.76, maxH * ar) : Math.min((W - 24) / 2, maxH * ar)
    Hp = Wp / ar
    stage.style.height = `${Math.round(Hp + 64)}px`
    const bw = single ? Wp : Wp * 2
    book.style.width = `${bw}px`; book.style.height = `${Hp}px`; book.style.marginLeft = `${-bw / 2}px`
    shadow.style.width = `${bw}px`; shadow.style.marginLeft = `${-bw / 2}px`
    leaves.forEach(lf => { lf.el.style.left = `${single ? 0 : Wp}px`; lf.el.style.width = `${Wp}px`; lf.el.style.height = `${Hp}px` })
    for (const [blk, left] of [[blkR, single ? 0 : Wp], [blkL, 0]] as const) { blk.style.left = `${left}px`; blk.style.setProperty('--w', `${Wp}px`); blk.style.height = `${Hp}px` }
    apply()
  }
  function spreadInfo() {
    const r = single ? f + 1 : 2 * f + 1, l = single ? -1 : 2 * f
    const pr = r <= N ? r : -1, pl = l >= 1 && l <= N ? l : -1
    return { pl, pr }
  }
  function onSpread(emit: boolean) {
    ensure()
    const { pl, pr } = spreadInfo()
    const b = pr > 0 ? pr : pl
    count.textContent = pl > 0 && pr > 0 ? `Pages ${pl}-${pr} of ${N}` : `Page ${b} of ${N}`
    range.value = String(f)
    range.style.setProperty('--fill', `${((f / L) * 100).toFixed(1)}%`)
    range.setAttribute('aria-valuetext', count.textContent)
    navs[0].disabled = f <= 0; navs[1].disabled = f >= L
    if (emit) { const t = performance.now(); if (t - lastCue > 90) { lastCue = t; hk.cue('evidence:flip') } }
  }
  function turn(j: number, to: 0 | 1, ms = 880) {
    anims[j]?.cancel()
    if (hk.reduced() || ms === 0) { prog[j] = to; apply(); return }
    const o = { p: prog[j] }
    anims[j] = A(o, { p: to, duration: ms * Math.abs(to - prog[j]) + 160, ease: 'out(4)', onUpdate: () => { prog[j] = o.p; apply() }, onComplete: () => { prog[j] = to; apply() } })
  }
  function flip(d: 1 | -1, ms?: number) {
    if (d > 0 && f >= L) return
    if (d < 0 && f <= 0) return
    const j = d > 0 ? f : f - 1
    f += d
    turn(j, d > 0 ? 1 : 0, ms)
    onSpread(true)
    apply()
  }
  function goto(to: number) {
    to = clamp(to, 0, L)
    const dist = Math.abs(to - f)
    if (!dist) return
    const d = to > f ? 1 : -1
    if (dist > 7 || hk.reduced()) {
      while (f !== to) { const j = d > 0 ? f : f - 1; f += d; prog[j] = d > 0 ? 1 : 0; anims[j]?.cancel() }
      onSpread(true); apply(); return
    }
    for (let i = 0; i < dist; i++) window.setTimeout(() => { if (!disposed) flip(d as 1 | -1, 620) }, i * 85)
  }

  // ---- drag a page edge; a click on a page turns it; a fling decides
  let drag: { j: number; side: 'r' | 'l' | null; x0: number; p0: number; vx: number; lx: number; lt: number; moved: boolean; id: number } | null = null
  const spineX = () => {
    const r = stage.getBoundingClientRect(), W = r.width
    const shift = single ? 0 : -(Wp / 2) * (1 - smooth(prog[0])) + (Wp / 2) * smooth(prog[L - 1])
    return single ? r.left + (W - Wp) / 2 : r.left + W / 2 + shift
  }
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const side = single ? null : e.clientX >= spineX() ? 'r' : 'l'
    drag = { j: -1, side, x0: e.clientX, p0: 0, vx: 0, lx: e.clientX, lt: performance.now(), moved: false, id: e.pointerId }
  })
  stage.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect()
    tilt.style.setProperty('--ry', `${(((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 9).toFixed(2)}`)
    tilt.style.setProperty('--rx', `${(((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * -6).toFixed(2)}`)
    if (!drag) return
    const dx = e.clientX - drag.x0
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return
      if (single) drag.side = dx < 0 ? 'r' : 'l'
      drag.j = drag.side === 'r' ? f : f - 1
      if (drag.j < 0 || drag.j >= L) { drag = null; return }
      drag.p0 = prog[drag.j]; drag.moved = true
      anims[drag.j]?.cancel(); stage.setPointerCapture(drag.id); stage.classList.add('is-drag')
    }
    const now = performance.now()
    drag.vx = lerp(drag.vx, (e.clientX - drag.lx) / Math.max(1, now - drag.lt), 0.5); drag.lx = e.clientX; drag.lt = now
    prog[drag.j] = clamp(drag.p0 - dx / (Wp * 1.05), 0, 1)
    apply()
  })
  const endDrag = (cancel: boolean) => {
    const d = drag; drag = null
    stage.classList.remove('is-drag')
    if (!d) return
    if (!d.moved) { if (!cancel && d.side) flip(d.side === 'r' ? 1 : -1); else if (!cancel && single) flip(1); return }
    const was = d.side === 'r' ? 0 : 1
    const to: 0 | 1 = Math.abs(d.vx) > 0.35 ? (d.vx < 0 ? 1 : 0) : prog[d.j] > 0.5 ? 1 : 0
    turn(d.j, to, 620)
    if (to !== was) { f += to === 1 ? 1 : -1; onSpread(true) }
    apply()
  }
  stage.addEventListener('pointerup', () => endDrag(false))
  stage.addEventListener('pointercancel', () => endDrag(true))
  stage.addEventListener('pointerleave', () => { tilt.style.setProperty('--ry', '0'); tilt.style.setProperty('--rx', '0') })
  navs.forEach(b => b.addEventListener('click', () => flip(+b.dataset.d! as 1 | -1)))
  range.addEventListener('input', () => goto(+range.value))
  openBtn.addEventListener('click', () => { const { pl, pr } = spreadInfo(); const k = (pr > 0 ? pr : pl) - 1; hk.open(items, k, cardEl(k)) })
  root.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    if ((e.target as HTMLElement).closest('a, input')) return
    e.preventDefault(); e.stopPropagation()
    flip(e.key === 'ArrowLeft' ? -1 : 1)
  })
  stage.tabIndex = 0
  const cardEl = (k: number): HTMLElement | null => {
    const j = single ? k : Math.floor(k / 2)
    const lf = leaves[j]
    return lf ? (single || k % 2 === 0 ? lf.f : lf.b) : null
  }
  const io = new IntersectionObserver(es => {
    vis = es.some(e => e.isIntersecting)
    if (vis && !entered) {
      entered = true
      root.classList.remove('is-pre')
      if (!hk.still()) {
        enterAnim = A(stage.querySelector('.bk-tilt'), { opacity: [0, 1], translateY: [70, 0], rotateX: [18, 0], duration: 1100, ease: 'out(4)' })
        // the cover opens a little, as if someone just set the paper down
        window.setTimeout(() => {
          if (disposed || f !== 0 || hk.reduced() || prog[0] > 0.001) return
          const o = { p: 0 }
          anims[0] = A(o, { p: [0, 0.07, 0], duration: 900, ease: 'inOut(2)', onUpdate: () => { prog[0] = o.p; apply() }, onComplete: () => { prog[0] = 0; apply() } })
        }, 900)
      }
    }
  }, { root: scroller, rootMargin: '8% 0px', threshold: 0.01 })
  if (!hk.still()) root.classList.add('is-pre')
  const ro = new ResizeObserver(() => layout())

  return {
    el: root,
    mount() { layout(); onSpread(false); ro.observe(stage); io.observe(root) },
    layout,
    card: cardEl,
    dispose() {
      disposed = true
      io.disconnect(); ro.disconnect(); enterAnim?.cancel()
      anims.forEach(a => a?.cancel())
    },
  }
}

// =====================================================================================
// Odometer: every glyph is a real character of the figure, rising from translateY(105%) and opacity 0 into its place, one after another.
// Nothing rolls: no column of 0-9 ever shows a value that is not in the data, so a paused frame or a recording only ever shows the real
// figure. (Same approach as startCount in src/v3/ui/overlays.ts.) Each glyph starts hidden inline, so nothing flashes before its turn.
// The text node comes back untouched at the end.
// =====================================================================================
const DATEISH = /\b(19|20)\d\d\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/
export function odometer(el: HTMLElement, final: string, hk: Hooks, o: { delay: number; duration: number; ticks?: boolean }): Stop | null {
  if (hk.still() || !/\d/.test(final) || DATEISH.test(final)) return null
  el.textContent = ''
  el.classList.add('is-od')
  const glyphs: HTMLElement[] = []
  for (const ch of final) {
    if (ch === ' ') { el.append(document.createTextNode(ch)); continue }
    const wrap = h('span', 'od-d'), g = h('span', 'od-c', ch)
    g.style.transform = 'translateY(105%)'; g.style.opacity = '0'
    wrap.append(g); el.append(wrap); glyphs.push(g)
  }
  const step = glyphs.length > 1 ? Math.min(70, Math.max(30, (o.duration * 0.6) / (glyphs.length - 1))) : 0
  const each = Math.max(480, o.duration * 0.55)
  const timers: number[] = []
  if (o.ticks) {
    // at most four detents, spread across the digits as they land
    const digits = glyphs.filter(g => /\d/.test(g.textContent ?? ''))
    const n = Math.min(4, digits.length)
    for (let k = 0; k < n; k++) {
      const i = glyphs.indexOf(digits[Math.floor(k * digits.length / n)])
      timers.push(window.setTimeout(() => hk.cue('count:tick'), o.delay + i * step + each * 0.35))
    }
  }
  const a = A(glyphs, { translateY: ['105%', '0%'], opacity: [0, 1], duration: each, delay: (_: unknown, i: number) => o.delay + i * step, ease: 'out(4)',
    onComplete: () => { el.classList.remove('is-od'); el.textContent = final } })
  return { cancel() { timers.forEach(window.clearTimeout); return a.cancel() } }
}

// =====================================================================================
// The title: letters fly out of the TV screen rect and assemble; on close they fly back and shatter
// =====================================================================================
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
function centers(chars: HTMLElement[]) {
  return chars.map(c => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] as const })
}
export function assemble(chars: HTMLElement[], src: Box, hk: Hooks, host: HTMLElement): Stop | null {
  if (hk.reduced() || !chars.length) return null
  for (const c of chars) { c.style.transform = 'none'; c.style.opacity = '0' }
  const pts = centers(chars)
  const dx: number[] = [], dy: number[] = [], rot: number[] = [], sc: number[] = []
  pts.forEach(([cx, cy]) => {
    const ox = src.left + src.width * rnd(0.12, 0.88), oy = src.top + src.height * rnd(0.12, 0.88)
    dx.push(ox - cx); dy.push(oy - cy); rot.push(rnd(-300, 300)); sc.push(rnd(0.12, 0.4))
  })
  hk.cue('type:assemble', { n: chars.length })
  const a = A(chars, {
    translateX: (_: unknown, i: number) => [dx[i], 0], translateY: (_: unknown, i: number) => [dy[i], 0],
    rotate: (_: unknown, i: number) => [rot[i], 0], scale: (_: unknown, i: number) => [sc[i], 1],
    opacity: { from: 0, to: 1, duration: 240, ease: 'linear' },
    duration: 1250, delay: S(26, { from: 'center' }), ease: 'out(4)',
    onComplete: () => {
      for (const c of chars) { c.style.transform = ''; c.style.opacity = '' }
      host.classList.add('is-land'); window.setTimeout(() => host.classList.remove('is-land'), 520)
    },
  })
  return a as unknown as Stop
}
export function shatter(chars: HTMLElement[], dest: Box, hk: Hooks): { cancel(): unknown; then(a: () => void, b?: () => void): unknown } | null {
  if (hk.reduced() || !chars.length) return null
  for (const c of chars) { c.style.transform = 'none' }
  const pts = centers(chars)
  const dx: number[] = [], dy: number[] = [], rot: number[] = []
  pts.forEach(([cx, cy]) => {
    dx.push(dest.left + dest.width * rnd(0.15, 0.85) - cx); dy.push(dest.top + dest.height * rnd(0.15, 0.85) - cy); rot.push(rnd(-260, 260))
  })
  hk.cue('type:shatter', { n: chars.length })
  return A(chars, {
    translateX: (_: unknown, i: number) => [0, dx[i]], translateY: (_: unknown, i: number) => [0, dy[i]],
    rotate: (_: unknown, i: number) => [0, rot[i]], scale: [1, 0.12],
    opacity: { from: 1, to: 0, duration: 260, delay: 160, ease: 'in(2)' },
    duration: 520, delay: S(12, { from: 'last' }), ease: 'in(3)',
  })
}
