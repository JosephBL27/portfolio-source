// The reading desk: the project detail dialog (concept 3.5, the dialog beat of 3.4, motion 5).
// Content first: the dialog is readable within 120 ms; choreography never blocks it.
// Motion owns the DOM springs (entrance, steps, close). Anime owns the SVG pipeline draw,
// the capsule's run along it, and the kicker's scrambled number. Never both on one element.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '../styles/desk.css'
import { animate as mAnimate } from 'motion'
import { animate as aAnimate, svg as aSvg, scrambleText, cubicBezier } from 'animejs'
import { projects, mediaFor, url, network, type Project, type MediaItem } from '../data'
import { state } from '../state'
import { bus } from '../bus'

export interface DeskOptions { onClose?(id: string): void; onStep?(id: string): void }
export interface Desk { open(id: string): void; close(): void; isOpen(): boolean; current(): string | null }

// Motion language (concept section 5)
const ENTER = { type: 'spring' as const, stiffness: 260, damping: 30 }
const PUFF = { type: 'spring' as const, stiffness: 520, damping: 28, mass: 1 }
const VENT: [number, number, number, number] = [0.55, 0, 1, 0.45]
const DRAW_EASE = cubicBezier(0.3, 0, 0.1, 1)

const TOTAL = projects.length
const pad = (n: number) => String(n).padStart(2, '0')
const NO_MEDIA_NOTE = 'No screenshot: this sheet is drawn from the pipeline data.'
const CHOMCHOM_CREDIT = 'Screenshots: ChomChomTech'

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}

function caption(p: Project, m: MediaItem): string {
  return p.id === 'chomchom' ? `${m.caption}. ${CHOMCHOM_CREDIT}` : m.caption
}

function stationFor(id: string): string | null {
  const n = network.nodes.find(x => x.project === id && x.kind !== 'brain') ?? network.nodes.find(x => x.project === id)
  return n ? n.id : null
}

// ---------- average colour (one small downsample per image, cached; no per-frame readback) ----------
const glowCache = new Map<string, string>()
function averageColour(src: string): Promise<string | null> {
  const hit = glowCache.get(src)
  if (hit) return Promise.resolve(hit)
  return new Promise(resolve => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 12
        const g = c.getContext('2d', { willReadFrequently: true })!
        g.drawImage(img, 0, 0, 12, 12)
        const d = g.getImageData(0, 0, 12, 12).data
        let r = 0, gg = 0, b = 0, w = 0
        for (let i = 0; i < d.length; i += 4) {
          // weight saturated pixels up so a UI's accent colour wins over flat greys
          const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2])
          const k = 0.35 + (mx - mn) / 255
          r += d[i] * k; gg += d[i + 1] * k; b += d[i + 2] * k; w += k
        }
        const col = lightish(r / w, gg / w, b / w)
        glowCache.set(src, col); resolve(col)
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}
// A backlight is light, not shadow: lift lightness and saturation so dark UIs still glow.
function lightish(r: number, g: number, b: number): string {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
  let hh = 0, s = 0
  const l = (mx + mn) / 2
  if (mx !== mn) {
    const dd = mx - mn
    s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn)
    hh = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4
    hh *= 60
  }
  const S = Math.min(0.85, s * 1.35 + 0.08), L = Math.min(0.68, Math.max(0.56, l))
  return `hsl(${hh.toFixed(0)} ${(S * 100).toFixed(0)}% ${(L * 100).toFixed(0)}%)`
}

// ---------- the pipeline as a pneumatic tube line (SVG) ----------
interface TubeGeo { W: number; H: number; y: number; x0: number; x1: number; r: number; yIn: number; yOut: number
  outer: number; inner: number; sw: number; sh: number; font: number; cap: number; xs: number[] }

function tubeGeo(n: number, big: boolean): TubeGeo {
  const g = big
    ? { W: 1000, H: 760, y: 384, x0: 72, x1: 928, r: 36, yIn: 58, yOut: 640, outer: 26, inner: 22, sw: 74, sh: 46, font: 19, cap: 1.9 }
    : { W: 480, H: 92, y: 46, x0: 10, x1: 470, r: 16, yIn: 4, yOut: 88, outer: 11, inner: 9, sw: 30, sh: 20, font: 10, cap: 1 }
  const pad = big ? 92 : 46
  const a = g.x0 + g.r + pad, b = g.x1 - g.r - pad
  const xs = Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)))
  return { ...g, xs }
}

function tubeSVG(p: Project, uid: string, big: boolean): string {
  const n = p.pipeline.length
  const G = tubeGeo(n, big)
  const { W, H, y, x0, x1, r, yIn, yOut, sw, sh, font, cap } = G
  const d = `M ${x0} ${yIn} V ${y - r} Q ${x0} ${y} ${x0 + r} ${y} H ${x1 - r} Q ${x1} ${y} ${x1} ${y + r} V ${yOut}`
  const cell = big ? 6 : 3.4, dot = big ? 1.25 : 0.72
  const stations = G.xs.map((x, i) => {
    const sx = -sw / 2, sy = -sh / 2, off = big ? 6 : 2.6
    return `<g transform="translate(${x.toFixed(1)} ${y})"><g class="tube__station" data-i="${i}">
      <rect class="tube__shadow" x="${sx + off}" y="${sy + off}" width="${sw}" height="${sh}" rx="${big ? 6 : 3}" fill="url(#ht-${uid})"/>
      <rect class="tube__plate" x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${big ? 6 : 3}"/>
      ${big ? `<line class="tube__plate-rule" x1="${sx + 10}" x2="${-sx - 10}" y1="${sy + 11}" y2="${sy + 11}"/>` : ''}
      <text class="tube__num" x="0" y="${big ? 9 : 3.6}" font-size="${font}" text-anchor="middle">${pad(i + 1)}</text>
    </g></g>`
  }).join('')
  // flanges where the tube meets the sheet edge
  const fl = big ? 16 : 7, ft = big ? 6 : 3
  const flanges = `<rect class="tube__flange" x="${x0 - fl}" y="${yIn}" width="${fl * 2}" height="${ft}" rx="1"/>
    <rect class="tube__flange" x="${x1 - fl}" y="${yOut - ft}" width="${fl * 2}" height="${ft}" rx="1"/>`
  const capW = 22 * cap, capH = 8.4 * cap
  const rider = `<g class="tube__rider"><rect class="tube__cap-body" x="${-capW / 2}" y="${-capH / 2}" width="${capW}" height="${capH}" rx="${capH / 2}"/>
    <rect class="tube__cap-end" x="${capW / 2 - capH * 0.9}" y="${-capH / 2}" width="${capH * 0.9}" height="${capH}" rx="${capH / 2}"/>
    <rect class="tube__cap-end" x="${-capW / 2}" y="${-capH / 2}" width="${capH * 0.9}" height="${capH}" rx="${capH / 2}"/></g>`
  const grid = big
    ? `<pattern id="gm-${uid}" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 H 0 V 20" class="print__grid-minor"/></pattern>
       <pattern id="gM-${uid}" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#gm-${uid})"/><path d="M 100 0 H 0 V 100" class="print__grid-major"/></pattern>`
    : ''
  const sheet = big
    ? `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#gM-${uid})"/>
       <rect class="print__frame" x="14" y="14" width="${W - 28}" height="${H - 28}"/>
       <rect class="print__frame print__frame--in" x="22" y="22" width="${W - 44}" height="${H - 44}"/>
       ${[0, 1, 2, 3, 4].map(k => `<line class="print__tick" x1="${22 + (k * (W - 44)) / 4}" x2="${22 + (k * (W - 44)) / 4}" y1="14" y2="22"/><line class="print__tick" x1="${22 + (k * (W - 44)) / 4}" x2="${22 + (k * (W - 44)) / 4}" y1="${H - 22}" y2="${H - 14}"/>`).join('')}
       <g class="print__dim"><line x1="${G.xs[0]}" x2="${G.xs[n - 1]}" y1="${H - 176}" y2="${H - 176}"/>
         <line x1="${G.xs[0]}" x2="${G.xs[0]}" y1="${H - 184}" y2="${H - 168}"/><line x1="${G.xs[n - 1]}" x2="${G.xs[n - 1]}" y1="${H - 184}" y2="${H - 168}"/>
         <path d="M ${G.xs[0]} ${H - 176} l 9 -4 v 8 z M ${G.xs[n - 1]} ${H - 176} l -9 -4 v 8 z" class="print__arrow"/>
         <rect x="${(G.xs[0] + G.xs[n - 1]) / 2 - 92}" y="${H - 184}" width="184" height="16" class="print__knock"/>
         <text class="print__dimtext" x="${(G.xs[0] + G.xs[n - 1]) / 2}" y="${H - 172}" text-anchor="middle">PIPELINE · ${pad(n)} STAGES</text></g>
       <text class="print__io" x="${x0 - 22}" y="${yIn + 26}" text-anchor="end">IN</text>
       <text class="print__io" x="${x1 - 24}" y="${yOut - 8}" text-anchor="end">OUT</text>`
    : ''
  return `<svg class="tube ${big ? 'tube--big' : 'tube--mini'}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs><pattern id="ht-${uid}" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="${cell / 2}" cy="${cell / 2}" r="${dot}" class="tube__dot"/></pattern>${grid}</defs>
    ${sheet}
    <path class="tube__halo" d="${d}" stroke-width="${G.outer + (big ? 18 : 8)}" stroke="url(#ht-${uid})" transform="translate(${big ? 7 : 3} ${big ? 8 : 3.5})"/>
    <path class="tube__rim tube__draw" d="${d}" stroke-width="${G.outer}"/>
    <path class="tube__glass tube__draw" d="${d}" stroke-width="${G.inner}"/>
    <path class="tube__shine tube__draw" d="${d}" stroke-width="${big ? 1.4 : 0.8}" transform="translate(0 ${-G.inner * 0.24})"/>
    <path class="tube__track" id="track-${uid}" d="${d}"/>
    ${flanges}${rider}${stations}
  </svg>`
}

// Draw the tube (600 ms), light each station as the line reaches it, then run one capsule once.
function runTube(root: Element, uid: string, p: Project, big: boolean): () => void {
  const svgEl = root.querySelector('svg.tube') as SVGSVGElement | null
  if (!svgEl) return () => {}
  const stations = Array.from(svgEl.querySelectorAll<SVGGElement>('.tube__station'))
  const rider = svgEl.querySelector<SVGGElement>('.tube__rider')!
  const labels = Array.from(root.querySelectorAll<HTMLElement>('.print__label'))
  if (state.reduced) { svgEl.classList.add('is-static'); return () => {} }
  const G = tubeGeo(p.pipeline.length, big)
  const drawables = aSvg.createDrawable(svgEl.querySelectorAll('.tube__draw'))
  svgEl.classList.add('is-armed')
  const anims: { cancel(): unknown }[] = []
  let done = false
  const go = () => {
    if (done) return
    done = true
    svgEl.classList.add('is-drawing')
    anims.push(aAnimate(drawables, { draw: ['0 0', '0 1'], duration: 600, ease: 'out(3)' }))
    const span = G.x1 - G.x0
    stations.forEach((s, i) => {
      const t = Math.max(0, ((G.xs[i] - G.x0) / span) * 520)
      anims.push(aAnimate(s, { opacity: [0, 1], duration: 140, delay: t, ease: 'out(2)' }))
      if (labels[i]) anims.push(aAnimate(labels[i], { opacity: [0, 1], translateY: [i % 2 ? -6 : 6, 0], duration: 260, delay: t + 40, ease: 'out(3)' }))
    })
    if (state.paused) { rider.style.opacity = '0'; return }
    const mp = aSvg.createMotionPath(svgEl.querySelector('.tube__track')!)
    if (!mp) return
    anims.push(aAnimate(rider, {
      ...mp, duration: big ? 1500 : 1100, delay: 620, ease: DRAW_EASE,
      opacity: { from: 0, to: 1, duration: 120, delay: 620, ease: 'linear' },
      onComplete: () => { anims.push(aAnimate(rider, { opacity: 0, duration: 220, ease: 'in(2)' })) },
    }))
  }
  let io: IntersectionObserver | null = null
  if (big) requestAnimationFrame(go)
  else {
    io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io?.disconnect(); go() } }, { threshold: 0.45 })
    io.observe(svgEl)
  }
  return () => { io?.disconnect(); anims.forEach(a => a.cancel()) }
}

// ---------- the module ----------
let singleton: Desk | null = null

export function initDesk(opts: DeskOptions = {}): Desk {
  if (singleton) return singleton
  const dlg = h('dialog', 'desk')
  dlg.setAttribute('aria-modal', 'true')
  dlg.setAttribute('aria-labelledby', 'desk-title')
  dlg.innerHTML = `
    <div class="desk__body">
      <div class="desk__shadow" aria-hidden="true"></div>
      <div class="desk__sheet">
        <header class="desk__bar">
          <div class="desk__mark"><svg viewBox="0 0 30 12" aria-hidden="true"><rect x="0.6" y="0.6" width="28.8" height="10.8" rx="5.4" class="mark__body"/><rect x="22.6" y="0.6" width="6.8" height="10.8" rx="5.4" class="mark__cap"/></svg><span>PNEUMA</span><span class="desk__mark-sub">Reading desk</span></div>
          <p class="desk__keys" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> project</span><span><kbd>←</kbd><kbd>→</kbd> plate</span><span><kbd>Esc</kbd> send it back</span></p>
          <button type="button" class="desk__close"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3 2.5 6.5 6 10M3 6.5h6.5a4 4 0 0 1 0 8H8"/></svg><span>Send it back</span></button>
        </header>
        <section class="desk__light" aria-label="Lightbox"></section>
        <article class="desk__info" tabindex="-1"></article>
      </div>
    </div>
    <p class="desk__sr" aria-live="polite"></p>`
  document.body.appendChild(dlg)

  const body = dlg.querySelector<HTMLElement>('.desk__body')!
  const sheet = dlg.querySelector<HTMLElement>('.desk__sheet')!
  const light = dlg.querySelector<HTMLElement>('.desk__light')!
  const info = dlg.querySelector<HTMLElement>('.desk__info')!
  const live = dlg.querySelector<HTMLElement>('.desk__sr')!
  const closeBtn = dlg.querySelector<HTMLButtonElement>('.desk__close')!

  let cur: string | null = null
  let plate = 0
  let opener: HTMLElement | null = null
  let cleanups: (() => void)[] = []
  let closing = false
  let items: MediaItem[] = []
  let uidN = 0

  const project = (id: string) => projects.find(p => p.id === id)
  const indexOf = (id: string) => projects.findIndex(p => p.id === id)

  bus.on('pause', ({ paused }) => dlg.classList.toggle('is-paused', paused))
  dlg.classList.toggle('is-paused', state.paused)

  // ---------- right column: the spec sheet ----------
  function renderInfo(p: Project, i: number) {
    info.textContent = ''
    const uid = `m${++uidN}`
    const head = h('header', 'desk__head')
    const kicker = h('p', 'desk__kicker')
    const kickText = `No. ${pad(i + 1)} / ${pad(TOTAL)} · ${p.kind.toUpperCase()} · ${p.period.toUpperCase()}`
    kicker.innerHTML = `<span class="desk__sr">${kickText}</span><span aria-hidden="true">No. <span class="desk__kicker-n">${pad(i + 1)}</span> / ${pad(TOTAL)}</span><span aria-hidden="true" class="desk__dot">·</span><span aria-hidden="true">${p.kind.toUpperCase()}</span><span aria-hidden="true" class="desk__dot">·</span><span aria-hidden="true">${p.period.toUpperCase()}</span>`
    const title = h('h2', 'desk__name', p.name)
    title.style.setProperty('--word', String(Math.max(6, ...p.name.split(/\s+/).map(w => [...w].length))))
    title.id = 'desk-title'; title.tabIndex = -1
    const status = h('p', 'desk__status')
    status.innerHTML = `<span class="lamp lamp--${p.status}" aria-hidden="true"></span>`
    status.append(h('span', 'desk__status-label', p.statusLabel))
    const role = h('p', 'desk__role', p.role)
    head.append(kicker, title, status, role)

    const line = h('p', 'desk__line', p.line)

    const kf = h('div', 'desk__kf')
    const kfv = h('p', 'desk__kf-value', p.keyFigure.value)
    kfv.style.setProperty('--len', String(Math.max(3, [...p.keyFigure.value].length)))
    kf.append(h('p', 'desk__label', 'Key figure'), kfv, h('p', 'desk__kf-label', p.keyFigure.label))

    const summary = h('p', 'desk__prose desk__summary', p.summary)

    const sec = (name: string, ...kids: Node[]) => {
      const s = h('section', 'desk__sec')
      const hd = h('h3', 'desk__label', name)
      s.append(hd, ...kids)
      return s
    }

    const table = h('table', 'desk__manifest')
    const tb = h('tbody')
    for (const m of p.metrics) {
      const tr = h('tr')
      const v = h('td', 'desk__mv', m.value)
      const l = h('th', 'desk__ml', m.label); l.scope = 'row'
      tr.append(v, l); tb.append(tr)
    }
    table.append(tb)

    const pipe = h('div', 'desk__pipe')
    pipe.innerHTML = tubeSVG(p, uid, false)
    const ol = h('ol', 'desk__steps')
    p.pipeline.forEach((s, k) => {
      const li = h('li')
      li.append(h('span', 'desk__step-n', pad(k + 1)))
      const tx = h('div')
      tx.append(h('p', 'desk__step', s.step), h('p', 'desk__step-d', s.detail))
      li.append(tx); ol.append(li)
    })
    pipe.append(ol)

    const brain = h('aside', 'desk__brain')
    brain.innerHTML = `<p class="desk__label"><span class="desk__brain-dot" aria-hidden="true"></span>Through the brain</p>`
    brain.append(h('p', 'desk__brain-text', (p as any).brain ?? ''))

    const chips = h('ul', 'desk__chips')
    p.stack.forEach(s => chips.append(h('li', undefined, s)))

    const parts: Node[] = [head, line, kf, summary,
      sec('Manifest', table), sec('Why', h('p', 'desk__prose', p.why)), sec('How it works', h('p', 'desk__prose', p.mechanism)),
      sec('Pipeline', pipe)]
    if ((p as any).brain) parts.push(brain)
    parts.push(sec('Stack', chips))
    if (p.links.length) {
      const ul = h('ul', 'desk__links')
      for (const l of p.links) {
        const li = h('li')
        const a = h('a', undefined)
        a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer'
        a.innerHTML = `<span class="desk__link-kind">${l.kind.toUpperCase()}</span><span class="desk__link-text"></span><span class="desk__arrow" aria-hidden="true">↗</span>`
        a.querySelector('.desk__link-text')!.textContent = l.label
        li.append(a); ul.append(li)
      }
      parts.push(sec('Links', ul))
    }
    if (p.credits) parts.push(sec('Credits', h('p', 'desk__credits', p.credits)))

    const st = stationFor(p.id)
    const foot = h('footer', 'desk__foot')
    if (st) {
      const run = h('button', 'desk__run'); run.type = 'button'
      run.innerHTML = `<span>See it run</span><span aria-hidden="true">→</span>`
      run.addEventListener('click', () => close(() => bus.emit('station', { id: st })))
      foot.append(run)
    }
    const prevP = projects[(i - 1 + TOTAL) % TOTAL], nextP = projects[(i + 1) % TOTAL]
    const nav = h('nav', 'desk__nav'); nav.setAttribute('aria-label', 'Other projects')
    const mk = (dir: -1 | 1, q: Project) => {
      const b = h('button', `desk__step-btn desk__step-btn--${dir < 0 ? 'prev' : 'next'}`); b.type = 'button'
      const qi = indexOf(q.id)
      b.innerHTML = `<span class="desk__step-k"><kbd aria-hidden="true">${dir < 0 ? '↑' : '↓'}</kbd> ${dir < 0 ? 'Previous' : 'Next'} · No. ${pad(qi + 1)}</span><span class="desk__step-name"></span>`
      b.querySelector('.desk__step-name')!.textContent = q.name
      b.addEventListener('click', () => step(dir))
      return b
    }
    nav.append(mk(-1, prevP), mk(1, nextP))
    foot.append(nav)
    parts.push(foot)

    info.append(...parts)
    cleanups.push(runTube(pipe, uid, p, false))

    // scrambled-in kicker number (decorative twin; the real text is the aria-label)
    if (!state.reduced) {
      const n = info.querySelector<HTMLElement>('.desk__kicker-n')
      if (n) {
        const a = aAnimate(n, { innerHTML: scrambleText({ text: pad(i + 1), chars: 'numbers', seed: i + 3 }), duration: 280 })
        cleanups.push(() => { a.cancel(); n.textContent = pad(i + 1) })
      }
    }
  }

  // ---------- left column: the lightbox ----------
  function renderLight(p: Project, i: number) {
    light.textContent = ''
    items = mediaFor(p.id)
    plate = 0
    light.classList.toggle('is-print', items.length === 0)
    const top = h('div', 'desk__light-top')
    top.innerHTML = `<span class="desk__label">${items.length ? 'Lightbox' : 'Sheet'} · No. ${pad(i + 1)}</span>`
    const stage = h('figure', 'desk__stage')
    const glow = h('div', 'desk__glow'); glow.setAttribute('aria-hidden', 'true')
    const frame = h('div', 'desk__frame')
    const crops = h('div', 'desk__crops'); crops.setAttribute('aria-hidden', 'true')
    crops.innerHTML = '<i></i><i></i><i></i><i></i>'
    stage.append(glow, frame, crops)
    const cap = h('figcaption', 'desk__caption')
    const bottom = h('div', 'desk__light-bottom')

    if (!items.length) {
      top.append(h('span', 'desk__label desk__label--dim', 'Drawn from pipeline data'))
      const uid = `b${++uidN}`
      const print = h('div', 'print')
      print.innerHTML = tubeSVG(p, uid, true)
      const G = tubeGeo(p.pipeline.length, true)
      print.style.aspectRatio = `${G.W} / ${G.H}`
      print.style.width = `min(calc(100cqw - 44px), calc((100cqh - 44px) * ${(G.W / G.H).toFixed(4)}))`
      const labels = h('div', 'print__labels')
      p.pipeline.forEach((s, k) => {
        const below = k % 2 === 1
        const lab = h('div', `print__label ${below ? 'print__label--below' : 'print__label--above'}`)
        const gap = G.xs.length > 1 ? G.xs[1] - G.xs[0] : 400
        const w = Math.min(2 * gap - 30, 310)
        const lo = G.x0 + 36, hi = G.x1 - 36 - w
        const left = Math.max(lo, Math.min(hi, G.xs[k] - w / 2))
        lab.style.left = `${(left / G.W) * 100}%`
        lab.style.width = `${(w / G.W) * 100}%`
        lab.style.setProperty('--lead', `${((G.xs[k] - left) / w) * 100}%`)
        lab.style.textAlign = left === lo ? 'left' : left === hi ? 'right' : 'center'
        if (below) lab.style.top = `${((G.y + G.sh / 2 + 20) / G.H) * 100}%`
        else lab.style.bottom = `${((G.H - (G.y - G.sh / 2 - 20)) / G.H) * 100}%`
        lab.append(h('p', 'print__step', s.step), h('p', 'print__detail', s.detail))
        labels.append(lab)
      })
      const block = h('div', 'print__block')
      block.innerHTML = `<div><span>Project</span><b></b></div><div><span>Sheet</span><b>No. ${pad(i + 1)} / ${pad(TOTAL)}</b></div><div><span>Kind</span><b>${p.kind.toUpperCase()}</b></div><div><span>Stages</span><b>${pad(p.pipeline.length)}</b></div>`
      block.querySelector('b')!.textContent = p.name
      const legend = h('div', 'print__block print__block--legend')
      legend.innerHTML = `<div><span>Status</span><b><i class="lamp lamp--${p.status}" aria-hidden="true"></i></b></div><div><span>Period</span><b>${p.period.toUpperCase()}</b></div>`
      legend.querySelector('b')!.append(p.statusLabel)
      const head = h('div', 'print__head')
      head.append(h('span', 'print__kick', 'Pipeline print'), h('span', 'print__title', p.name))
      print.append(labels, block, legend, head)
      frame.append(print)
      cap.textContent = NO_MEDIA_NOTE
      bottom.append(cap)
      light.append(top, stage, bottom)
      setGlow(null)
      cleanups.push(runTube(print, uid, p, true))
      return
    }

    const counter = h('p', 'desk__counter')
    counter.setAttribute('aria-live', 'polite')
    const prev = h('button', 'desk__arrowbtn'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous image'); prev.textContent = '‹'
    const next = h('button', 'desk__arrowbtn'); next.type = 'button'; next.setAttribute('aria-label', 'Next image'); next.textContent = '›'
    prev.addEventListener('click', () => showPlate(plate - 1, -1))
    next.addEventListener('click', () => showPlate(plate + 1, 1))
    const ctrls = h('div', 'desk__ctrls')
    ctrls.append(prev, counter, next)
    if (items.length < 2) { prev.disabled = true; next.disabled = true }
    bottom.append(ctrls, cap)
    top.append(h('span', 'desk__label desk__label--dim desk__kind'))

    const strip = h('div', 'desk__strip')
    if (items.length > 1) {
      items.forEach((m, k) => {
        const b = h('button', 'desk__thumb'); b.type = 'button'
        b.setAttribute('aria-label', `Image ${k + 1}: ${m.caption}`)
        const im = h('img'); im.src = url(m.sm); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'
        im.width = m.width; im.height = m.height
        b.append(im)
        if (m.kind === 'video') b.classList.add('is-video')
        b.addEventListener('click', () => showPlate(k, k >= plate ? 1 : -1))
        strip.append(b)
      })
    }
    light.append(top, stage, bottom, strip)
    showPlate(0, 0)
  }

  function setGlow(col: string | null) {
    const stageGlow = light.querySelector<HTMLElement>('.desk__glow')
    if (col) {
      light.style.setProperty('--glow', col)
      light.classList.add('has-glow')
      document.documentElement.style.setProperty('--desk-glow', col)
      window.dispatchEvent(new CustomEvent('pneuma:deskglow', { detail: { id: cur, color: col } }))
    } else {
      light.classList.remove('has-glow')
      document.documentElement.style.removeProperty('--desk-glow')
    }
    void stageGlow
  }

  function showPlate(k: number, dir: number) {
    if (!items.length || !cur) return
    const p = project(cur)!
    plate = (k + items.length) % items.length
    const m = items[plate]
    const frame = light.querySelector<HTMLElement>('.desk__frame')!
    const cap = light.querySelector<HTMLElement>('.desk__caption')!
    const counter = light.querySelector<HTMLElement>('.desk__counter')!
    frame.textContent = ''
    frame.classList.toggle('is-phone', m.width / m.height < 0.6)
    let media: HTMLImageElement | HTMLVideoElement
    if (m.kind === 'video') {
      const v = h('video')
      v.controls = true; v.muted = true; v.playsInline = true; v.preload = 'none'
      v.setAttribute('playsinline', ''); v.setAttribute('muted', '')
      v.poster = url(m.sm); v.src = url(m.lg)
      v.setAttribute('aria-label', m.alt)
      v.width = m.width; v.height = m.height
      media = v
    } else {
      const im = h('img')
      im.src = url(m.lg); im.alt = m.alt; im.decoding = 'async'
      im.width = m.width; im.height = m.height
      media = im
    }
    media.style.aspectRatio = `${m.width} / ${m.height}`
    frame.append(media)
    cap.textContent = caption(p, m)
    counter.textContent = `${plate + 1} / ${items.length}`
    const kindEl = light.querySelector<HTMLElement>('.desk__kind')
    if (kindEl) kindEl.textContent = `${m.kind} · ${m.width} × ${m.height}`
    light.querySelectorAll('.desk__thumb').forEach((t, j) => {
      t.classList.toggle('is-on', j === plate)
      if (j === plate) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current')
    })
    const on = light.querySelector<HTMLElement>('.desk__thumb.is-on')
    on?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: state.reduced ? 'auto' : 'smooth' })
    const id = cur
    averageColour(url(m.sm)).then(col => { if (cur === id && items[plate] === m) setGlow(col) })
    // preload the neighbour
    const nx = items[(plate + 1) % items.length]
    if (nx && nx.kind !== 'video') { const pre = new Image(); pre.decoding = 'async'; pre.src = url(nx.lg) }
    if (!state.reduced) resolveHalftone(frame, dir)
  }

  // The halftone-to-photograph reveal: print dots grow until they merge into the image.
  function resolveHalftone(frame: HTMLElement, dir: number) {
    frame.classList.add('is-resolving')
    frame.style.setProperty('--ht', '0px')
    const a = mAnimate(0, 7.2, {
      duration: 0.46, ease: [0.3, 0, 0.1, 1],
      onUpdate: v => frame.style.setProperty('--ht', `${v.toFixed(2)}px`),
      onComplete: () => { frame.classList.remove('is-resolving'); frame.style.removeProperty('--ht') },
    })
    const b = mAnimate(frame, { x: [dir * 22, 0], scale: [0.985, 1] }, PUFF)
    cleanups.push(() => { a.stop(); b.stop(); frame.classList.remove('is-resolving') })
  }

  function teardown() { cleanups.forEach(f => f()); cleanups = [] }

  function render(id: string) {
    const i = indexOf(id)
    const p = projects[i]
    teardown()
    cur = id
    renderLight(p, i)
    renderInfo(p, i)
    info.scrollTop = 0
    sheet.scrollTop = 0
    dlg.dataset.project = id
    dlg.dataset.kind = p.kind
    live.textContent = `Opening No. ${pad(i + 1)}, ${p.name}.`
  }

  function open(id: string) {
    const p = project(id)
    if (!p) { console.warn('[desk] unknown project', id); return }
    if (dlg.open && cur === id && !closing) return
    if (dlg.open && !closing) { swap(id, 1); return }
    closing = false
    const ae = document.activeElement as HTMLElement | null
    if (ae && !dlg.contains(ae) && ae !== document.body) opener = ae
    render(id)
    if (!dlg.open) dlg.showModal()
    dlg.classList.remove('is-closing')
    ;(dlg.querySelector('#desk-title') as HTMLElement | null)?.focus({ preventScroll: true })
    if (state.reduced) return
    // the sheet lands on the desk opaque (no see-through frame); the text slides in on the spring
    mAnimate(body, { y: [14, 0], scale: [0.99, 1] }, ENTER)
    mAnimate(info, { x: [48, 0], opacity: [0, 1] }, { ...ENTER, opacity: { duration: 0.12, ease: 'easeOut' } })
  }

  // ↑/↓: next project, fast. Content swaps at once; the lead may run the fast-route choreography.
  function swap(id: string, dir: number) {
    render(id)
    ;(dlg.querySelector('#desk-title') as HTMLElement | null)?.focus({ preventScroll: true })
    if (state.reduced) return
    mAnimate(info, { y: [dir * 28, 0], opacity: [0, 1] }, { ...ENTER, opacity: { duration: 0.12, ease: 'easeOut' } })
  }

  function step(dir: -1 | 1) {
    if (!cur) return
    const i = indexOf(cur)
    const q = projects[(i + dir + TOTAL) % TOTAL]
    swap(q.id, dir)
    opts.onStep?.(q.id)
  }

  // `then` runs after the dialog has closed; when present, focus is left to it (See it run).
  function close(then?: () => void) {
    if (!dlg.open || closing) return
    closing = true
    const id = cur!
    const finish = () => {
      if (!closing) return
      closing = false
      dlg.close()
      teardown()
      cur = null
      dlg.classList.remove('is-closing')
      setGlow(null)
      const o = opener; opener = null
      if (!then && o && o.isConnected) o.focus()
      opts.onClose?.(id)
      bus.emit('deskclose', { id })
      then?.()
    }
    if (state.reduced) { finish(); return }
    dlg.classList.add('is-closing')
    mAnimate(body, { opacity: 0, x: 24 }, { duration: 0.2, ease: VENT }).then(() => {
      finish()
      mAnimate(body, { opacity: 1, x: 0 }, { duration: 0 })
    })
  }

  // Esc arrives as a cancel event: run our own close so focus and callbacks are right.
  dlg.addEventListener('cancel', e => { e.preventDefault(); close() })
  closeBtn.addEventListener('click', () => close())
  // click on the backdrop (outside the sheet) sends it back
  dlg.addEventListener('pointerdown', e => {
    if (e.target === dlg) { const r = sheet.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close() }
  })
  dlg.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target as HTMLElement
    if (t.closest('video, input, textarea, select')) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (items.length > 1) { e.preventDefault(); const d = e.key === 'ArrowLeft' ? -1 : 1; showPlate(plate + d, d) }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); step(e.key === 'ArrowUp' ? -1 : 1)
    }
  })

  singleton = {
    open,
    close: () => close(),
    isOpen: () => dlg.open && !closing,
    current: () => (dlg.open ? cur : null),
  }
  return singleton
}
