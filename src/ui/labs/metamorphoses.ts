// Metamorphoses lab: the reading compass as a turnable volvelle. Ported from ~/PORTFOLIO/src/sb/stages/stage-metamorphoses.tsx and dial.ts.
// Three of the instrument's four rings: Ovid's six mythic eras (static), his 15 books (you turn this one: drag, fling, arrow keys), and the
// episodes of the book under the window (the ring refills when you land). Anime.js createDraggable owns the book ring (mapTo rotate, snap,
// a release that carries on with the hand's own speed); the discs sit at different depths, tilt toward the pointer, and catch a specular
// highlight. Landing on a book flips a folio open beside the wheel.
// Honesty: book and era names are Ovid's (the same labels the world's compass form carries); the per-book episode counts are the live
// instrument's and sum to the 120 in projects.json; only Book I's episode titles are shown (they are the ones the site already carries).
// The fourth ring (theme lenses) and the episode scenes live in the live instrument and are not reproduced.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cue: lab:drag { param: 'book', value 0..1 } as each book passes the window.
import './metamorphoses.css'
import { animate, stagger } from 'animejs'
import projectsRaw from '../../data/projects.json'
import { createDial, type Dial } from './lib/dial'
import { TAU, clamp, esc, gate, onFirstView, sitePaused, spring, stepSpring, type LabHandle, type LabOpts } from './lib/kit'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV']
/** episodes on each book's ring in the live instrument, Book I to XV; they sum to the project's 120 */
const EPISODES = [8, 7, 7, 9, 7, 7, 8, 8, 8, 10, 9, 7, 8, 10, 7]
const ERAS: [string, number, number][] = [['Primordial Age', 0, 3], ['Early Heroic Age', 3, 8], ['Mature Heroic Age', 8, 11], ['Trojan War', 11, 13], ['Troy to Rome', 13, 14], ['Roman History', 14, 15]]
const BOOK1 = ['Creation', 'The Four Ages', 'Lycaon', 'The Great Flood', 'Deucalion & Pyrrha', 'Apollo & Daphne', 'Io', 'Pan & Syrinx']
const MOTTO = 'OMNIA MUTANTUR · NIHIL INTERIT · '
const STEP = 360 / 15
const P = (projectsRaw as { id: string; metrics: { value: string; label: string }[] }[]).find(p => p.id === 'metamorphoses')
const TOTAL = EPISODES.reduce((a, b) => a + b, 0)
void P
const C = 300
const pt = (r: number, deg: number): [number, number] => { const a = (deg * Math.PI) / 180; return [C + r * Math.sin(a), C - r * Math.cos(a)] }
const f = (n: number) => n.toFixed(2)
/** an annular sector between two radii, clockwise from a0 to a1 degrees (0 = top) */
function sector(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0), big = a1 - a0 > 180 ? 1 : 0
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${big} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 ${big} 0 ${f(x3)} ${f(y3)}Z`
}
const arcPath = (r: number, a0: number, a1: number, cw: boolean) => {
  const [x0, y0] = pt(r, cw ? a0 : a1), [x1, y1] = pt(r, cw ? a1 : a0)
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} ${cw ? 1 : 0} ${f(x1)} ${f(y1)}`
}
const eraOf = (book: number) => ERAS.findIndex(e => book >= e[1] && book < e[2])

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cue = gate(opts.emit, 55)
  const uid = `mc${Math.random().toString(36).slice(2, 7)}`
  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'mc'
  root.setAttribute('data-proof', 'skip')

  // ------------------------------------------------------------------------------------------------ the five discs
  const bez = Array.from({ length: 120 }, (_, k) => { const a = k * 3, [x0, y0] = pt(274, a), [x1, y1] = pt(k % 5 === 0 ? 286 : 281, a); return `<path d="M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}" class="${k % 5 === 0 ? 'mc-tk mc-tk--l' : 'mc-tk'}"/>` }).join('')
  const plate = `<svg viewBox="0 0 600 600" aria-hidden="true">
    <defs><radialGradient id="${uid}-br" cx="50%" cy="40%" r="62%"><stop offset="0" stop-color="#3a2c15"/><stop offset="0.7" stop-color="#1b140a"/><stop offset="1" stop-color="#0d0905"/></radialGradient>
    <radialGradient id="${uid}-sh" cx="50%" cy="50%" r="50%"><stop offset="0.82" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
    <circle cx="${C}" cy="${C + 10}" r="306" fill="url(#${uid}-sh)"/>
    <circle cx="${C}" cy="${C}" r="294" fill="url(#${uid}-br)" class="mc-bez"/><circle cx="${C}" cy="${C}" r="290" class="mc-line"/><circle cx="${C}" cy="${C}" r="272" class="mc-line"/>${bez}
  </svg>`
  const eraSvg = `<svg viewBox="0 0 600 600" aria-hidden="true"><defs>${ERAS.map((e, k) => { const a0 = e[1] * STEP, a1 = e[2] * STEP, mid = (a0 + a1) / 2, cw = !(mid > 95 && mid < 265); return `<path id="${uid}-e${k}" d="${arcPath(cw ? 243 : 253, a0 + 1.2, a1 - 1.2, cw)}"/>` }).join('')}</defs>
    <circle cx="${C}" cy="${C}" r="268" class="mc-base"/><circle cx="${C}" cy="${C}" r="226" class="mc-line"/>
    ${ERAS.map((e, k) => { const a0 = e[1] * STEP, a1 = e[2] * STEP, arcLen = ((a1 - a0) * Math.PI / 180) * 247, fs = clamp((arcLen * 0.86) / (e[0].length * 0.7), 8.2, 12), [dx0, dy0] = pt(226, a0), [dx1, dy1] = pt(268, a0)
      return `<g class="mc-era" data-k="${k}"><path d="${sector(226, 268, a0, a1)}" class="mc-era-bg"/><path d="M${f(dx0)} ${f(dy0)}L${f(dx1)} ${f(dy1)}" class="mc-div"/><text class="mc-era-t" style="font-size:${fs.toFixed(1)}px"><textPath href="#${uid}-e${k}" startOffset="50%" text-anchor="middle">${esc(e[0].toUpperCase())}</textPath></text></g>` }).join('')}
  </svg>`
  const bookSvg = `<svg viewBox="0 0 600 600" class="mc-ring" role="slider" tabindex="0" aria-label="Book of the Metamorphoses. Drag to turn, or use the arrow keys." aria-valuemin="1" aria-valuemax="15" aria-valuenow="1" aria-valuetext="Book I">
    <path d="${sector(158, 222, 0, 179.99)}${sector(158, 222, 180, 359.99)}" class="mc-base mc-hit"/>
    ${ROMAN.map((rn, k) => { const a0 = k * STEP - STEP / 2, a1 = k * STEP + STEP / 2, [tx, ty] = pt(192, k * STEP)
      return `<g class="mc-book" data-k="${k}"><path d="${sector(158, 222, a0 + 0.5, a1 - 0.5)}" class="mc-book-bg mc-hit"/><text x="${f(tx)}" y="${f(ty)}" class="mc-num" transform="rotate(${f(k * STEP)} ${f(tx)} ${f(ty)})" text-anchor="middle" dominant-baseline="central">${rn}</text></g>` }).join('')}
    <circle cx="${C}" cy="${C}" r="222" class="mc-line"/><circle cx="${C}" cy="${C}" r="158" class="mc-line"/>
  </svg>`
  const epsSvg = `<svg viewBox="0 0 600 600"><circle cx="${C}" cy="${C}" r="152" class="mc-base"/><circle cx="${C}" cy="${C}" r="102" class="mc-line"/><g class="mc-eps"></g></svg>`
  const sunSvg = `<svg viewBox="0 0 600 600" aria-hidden="true"><defs><radialGradient id="${uid}-sun" cx="46%" cy="40%" r="62%"><stop offset="0" stop-color="#fff2c4"/><stop offset="0.45" stop-color="#f0b84a"/><stop offset="1" stop-color="#9a5f16"/></radialGradient>
    <path id="${uid}-mo" d="${arcPath(88, 0.01, 359.9, true)}"/></defs>
    <circle cx="${C}" cy="${C}" r="100" class="mc-base"/><circle cx="${C}" cy="${C}" r="76" class="mc-line"/>
    <text class="mc-motto"><textPath href="#${uid}-mo" textLength="${(2 * Math.PI * 88 - 6).toFixed(0)}" lengthAdjust="spacing">${MOTTO}</textPath></text>
    <g class="mc-rays">${Array.from({ length: 24 }, (_, k) => { const [ax, ay] = pt(72, k * 15 - 3), [bx, by] = pt(72, k * 15 + 3), [cx2, cy2] = pt(k % 2 ? 62 : 52, k * 15); return `<path d="M${f(ax)} ${f(ay)}L${f(cx2)} ${f(cy2)}L${f(bx)} ${f(by)}Z"/>` }).join('')}</g>
    <circle cx="${C}" cy="${C}" r="42" fill="url(#${uid}-sun)" class="mc-sunface"/><path d="M${C - 18} ${C - 3}q9 -9 18 0q9 -9 18 0M${C - 14} ${C + 14}q14 9 28 0" class="mc-face"/>
    <path d="${sector(150, 228, -STEP / 2 - 0.2, STEP / 2 + 0.2)}" class="mc-win"/><path d="M${C - 9} ${C - 300}L${C + 9} ${C - 300}L${C} ${C - 276}Z" class="mc-ptr"/></svg>`

  root.innerHTML = `
  <header class="mc-head">
    <div><span class="mc-kicker">Interactive model, the reading compass</span><h3 class="mc-title">Turn to any of the 15 books</h3></div>
    <p class="mc-note" role="note">Drag the ring of books, fling it, or use the arrow keys. The episode ring refills with the book under the window.</p>
  </header>
  <div class="mc-grid">
    <div class="mc-stage">
      <div class="mc-disc">
        <div class="mc-layer" style="--z:0px">${plate}</div>
        <div class="mc-layer" style="--z:10px">${eraSvg}</div>
        <div class="mc-layer mc-layer--grab" style="--z:22px">${bookSvg}</div>
        <div class="mc-layer" style="--z:34px">${epsSvg}</div>
        <div class="mc-layer" style="--z:46px">${sunSvg}</div>
        <div class="mc-spec" aria-hidden="true"></div>
      </div>
    </div>
    <article class="mc-folio" aria-live="polite"><div class="mc-page"></div></article>
  </div>
  <nav class="mc-jump" aria-label="Jump to a book">${ROMAN.map((r, k) => `<button type="button" data-k="${k}" aria-label="Book ${r}">${r}</button>`).join('')}</nav>
  <p class="mc-foot">Book and era names are Ovid's. Episode counts per book are the live instrument's and sum to ${TOTAL}. Only Book I's episode titles are shown here; the theme ring and the scenes are in the live instrument.</p>`
  host.append(root)
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T
  const ring = $<SVGSVGElement>('.mc-ring') as unknown as HTMLElement
  const disc = $('.mc-disc'), stage = $('.mc-stage'), spec = $('.mc-spec'), page = $('.mc-page'), epsG = $<SVGGElement>('.mc-eps')
  const bookEls = Array.from(root.querySelectorAll<SVGGElement>('.mc-book')), eraEls = Array.from(root.querySelectorAll<SVGGElement>('.mc-era'))
  const jumpBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('.mc-jump button'))

  // ------------------------------------------------------------------------------------------------ the folio and the episode ring
  let cur = 0, shown = -1
  const startOf = (b: number) => EPISODES.slice(0, b).reduce((a, c) => a + c, 0) + 1
  const folioHTML = (b: number) => {
    const n = EPISODES[b], s = startOf(b), e = eraOf(b)
    const list = Array.from({ length: n }, (_, k) => `<li data-k="${k}"><i>${k + 1}</i><span>${b === 0 ? esc(BOOK1[k]) : `Episode ${k + 1}`}</span></li>`).join('')
    return `<p class="mc-liber">Liber</p><b class="mc-bnum">${ROMAN[b]}</b><h4 class="mc-eraname">${esc(ERAS[e][0])}</h4>
      <p class="mc-count"><b>${n}</b> episodes, numbers ${s} to ${s + n - 1} of ${TOTAL}</p><ol class="mc-eplist${b === 0 ? ' is-named' : ''}">${list}</ol>`
  }
  function buildEpisodes(b: number, animateIn: boolean) {
    const n = EPISODES[b], a = 360 / n
    epsG.innerHTML = Array.from({ length: n }, (_, k) => {
      const a0 = k * a + 0.9, a1 = (k + 1) * a - 0.9, [tx, ty] = pt(127, (k + 0.5) * a)
      return `<g class="mc-ep" data-k="${k}"><path d="${sector(106, 148, a0, a1)}" class="mc-ep-bg"/><text x="${f(tx)}" y="${f(ty)}" text-anchor="middle" dominant-baseline="central" class="mc-ep-n">${k + 1}</text></g>`
    }).join('')
    if (animateIn && !reduced) animate(epsG.querySelectorAll('.mc-ep'), { opacity: [0, 1], scale: [0.7, 1], duration: 420, delay: stagger(26), ease: 'out(3)' })
  }
  const hi = (k: number) => { root.querySelectorAll('.mc-ep, .mc-eplist li').forEach(el => el.classList.toggle('is-hi', (el as HTMLElement).dataset.k === String(k))) }
  root.addEventListener('pointerover', e => { const el = (e.target as Element).closest<HTMLElement>('.mc-ep, .mc-eplist li'); if (el) hi(Number(el.dataset.k)) })
  root.addEventListener('pointerout', e => { if ((e.target as Element).closest('.mc-ep, .mc-eplist li')) hi(-1) })

  function show(b: number, flip: boolean) {
    if (b === shown) return
    const first = shown < 0; shown = b
    bookEls.forEach((el, k) => el.classList.toggle('is-on', k === b))
    const e = eraOf(b); eraEls.forEach((el, k) => el.classList.toggle('is-on', k === e))
    jumpBtns.forEach((el, k) => el.setAttribute('aria-current', String(k === b)))
    ring.setAttribute('aria-valuenow', String(b + 1)); ring.setAttribute('aria-valuetext', `Book ${ROMAN[b]}, ${ERAS[e][0]}, ${EPISODES[b]} episodes`)
    const swap = () => { page.innerHTML = folioHTML(b); buildEpisodes(b, !first) }
    if (!flip || reduced || first) { swap(); return }
    // the folio turns like a page: it swings edge-on, the next book's page replaces it, and it swings back open
    const A = animate
    A(page, { rotateY: [0, -86], opacity: [1, 0.2], duration: 150, ease: 'in(2)' }).then(() => { swap(); A(page, { rotateY: [86, 0], opacity: [0.2, 1], duration: 380, ease: 'out(3)' }) })
  }

  // ------------------------------------------------------------------------------------------------ the dial
  const dial: Dial = createDial(ring, {
    steps: 15, reduce: reduced, radius: 192 / 600, start: 0,
    onPass: i => { cue('lab:drag', { param: 'book', value: i / 14 }) },
    onLand: i => { cur = i; cue('lab:drag', { param: 'book', value: i / 14 }); show(i, true) },
  })
  show(0, false)
  const onKey = (e: KeyboardEvent) => {
    const k = e.key
    if (k === 'ArrowRight' || k === 'ArrowUp') dial.step(1)
    else if (k === 'ArrowLeft' || k === 'ArrowDown') dial.step(-1)
    else if (k === 'Home') dial.jump(0)
    else if (k === 'End') dial.jump(14)
    else if (k === 'PageUp') dial.jump((cur + 5) % 15)
    else if (k === 'PageDown') dial.jump((cur + 10) % 15)
    else return
    e.preventDefault(); e.stopPropagation()          // the case view steps to the next work on the same arrow keys
  }
  ring.addEventListener('keydown', onKey)
  const onJump = (e: Event) => { const b = (e.target as Element).closest<HTMLButtonElement>('button[data-k]'); if (b) dial.jump(Number(b.dataset.k)) }
  root.querySelector('.mc-jump')!.addEventListener('click', onJump)

  // ------------------------------------------------------------------------------------------------ depth: tilt toward the pointer, a specular highlight
  const rx = spring(0, 70, 13), ry = spring(0, 70, 13)
  let tx = 0, ty = 0, raf = 0, dragging = false, last = 0
  const pump = (ms: number) => {
    raf = 0
    const dt = Math.min(1 / 30, last ? (ms - last) / 1000 : 1 / 60); last = ms
    stepSpring(rx, tx, dt); stepSpring(ry, ty, dt)
    disc.style.transform = `rotateX(${rx.x.toFixed(2)}deg) rotateY(${ry.x.toFixed(2)}deg)`
    if (Math.abs(rx.x - tx) > 0.02 || Math.abs(ry.x - ty) > 0.02 || Math.abs(rx.v) + Math.abs(ry.v) > 0.05) raf = requestAnimationFrame(pump); else last = 0
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(pump) }
  const onMove = (e: PointerEvent) => {
    if (reduced) return
    const r = stage.getBoundingClientRect(), nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1), ny = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1)
    spec.style.setProperty('--sx', `${((nx + 1) * 50).toFixed(1)}%`); spec.style.setProperty('--sy', `${((ny + 1) * 50).toFixed(1)}%`); spec.style.opacity = '1'
    if (dragging) return
    ty = nx * 9; tx = -ny * 7; kick()
  }
  const onLeave = () => { if (dragging) return; tx = ty = 0; spec.style.opacity = '0'; kick() }
  stage.addEventListener('pointermove', onMove); stage.addEventListener('pointerleave', onLeave)
  ring.addEventListener('pointerdown', () => { dragging = true; tx = ty = 0; kick() })
  const onUp = () => { dragging = false }
  window.addEventListener('pointerup', onUp)

  // a first demonstration: the ring turns to Book IV, so the episode ring visibly refills (only when nothing is asked to hold still)
  const cancelView = reduced || sitePaused() ? () => {} : onFirstView(host, () => { if (cur === 0) dial.jump(3) }, 0.5)

  return {
    dispose() {
      cancelView(); cancelAnimationFrame(raf)
      ring.removeEventListener('keydown', onKey); stage.removeEventListener('pointermove', onMove); stage.removeEventListener('pointerleave', onLeave); window.removeEventListener('pointerup', onUp)
      dial.revert(); host.innerHTML = ''
    },
  }
}
void TAU
