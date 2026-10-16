// A turnable ring compass for the reading-instrument labs (Odyssey, Liaozhai): the Metamorphoses lab's idea made configurable. Layers sit at
// different depths in CSS 3D and tilt toward the pointer; ONE ring turns (drag, fling, arrow keys; lib/dial.ts, Anime.js createDraggable) and
// lands on a mark under a fixed window; a folio turns like a page to describe the mark. Everything it draws comes from the config it is given,
// so each lab states only names its project already carries. The lab root carries data-proof="skip".
// LAB CONTRACT: mount via volvelle(host, opts, cfg). Cue: lab:drag { param, value 0..1 } as each mark passes the window.
import './volvelle.css'
import { animate } from 'animejs'
import { createDial, type Dial } from './dial'
import { clamp, esc, gate, onFirstView, sitePaused, spring, stepSpring, type LabHandle, type LabOpts } from './kit'

export interface VolvelleCfg {
  cls: string                          // theme class on the root, e.g. 'oy'
  n: number                            // marks on the turning ring
  labels: string[]                     // what each mark says (n entries)
  radial: boolean                      // labels run along the radius (long labels) or sit upright
  aria: string                         // the ring's slider label, e.g. 'Book of the Odyssey'
  unit: string                         // 'Book', 'Register'
  motto: string                        // text run around the outer band, ends with a separator
  cells: number                        // marks on the inner scale
  cellsOn?: (mark: number) => number[] // which inner cells light for a mark (none: a fixed scale)
  centre: 'sun' | 'seal'
  heading: { kicker: string; title: string; note: string }
  foot: string
  folio(mark: number): string         // HTML for the page beside the wheel
  valueText(mark: number): string
  start?: number
  demo?: number                        // the first-sight demonstration turns to this mark
}

const C = 300
const pt = (r: number, deg: number): [number, number] => { const a = (deg * Math.PI) / 180; return [C + r * Math.sin(a), C - r * Math.cos(a)] }
const f = (n: number) => n.toFixed(2)
function sector(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0), big = a1 - a0 > 180 ? 1 : 0
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${big} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 ${big} 0 ${f(x3)} ${f(y3)}Z`
}
const arcPath = (r: number, a0: number, a1: number) => { const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1); return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}` }

const RB0 = 150, RB1 = 238       // the turning ring's band
const RC0 = 98, RC1 = 142        // the inner scale
const RM0 = 244, RM1 = 274       // the motto band

export function volvelle(host: HTMLElement, opts: LabOpts, cfg: VolvelleCfg): LabHandle {
  const reduced = opts.reduced, n = cfg.n, STEP = 360 / n
  const cue = gate(opts.emit, 55)
  const uid = `vv${Math.random().toString(36).slice(2, 7)}`
  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = `vv ${cfg.cls}`
  root.setAttribute('data-proof', 'skip')

  // ------------------------------------------------------------------------------------------------ the discs
  const ticks = Array.from({ length: 120 }, (_, k) => { const a = k * 3, [x0, y0] = pt(284, a), [x1, y1] = pt(k % 5 === 0 ? 292 : 288, a); return `<path d="M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}" class="${k % 5 === 0 ? 'vv-tk vv-tk--l' : 'vv-tk'}"/>` }).join('')
  const plate = `<svg viewBox="0 0 600 600" aria-hidden="true">
    <defs><radialGradient id="${uid}-br" cx="50%" cy="40%" r="62%"><stop offset="0" class="vv-s0"/><stop offset="0.7" class="vv-s1"/><stop offset="1" class="vv-s2"/></radialGradient>
    <radialGradient id="${uid}-sh" cx="50%" cy="50%" r="50%"><stop offset="0.82" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
    <circle cx="${C}" cy="${C + 10}" r="306" fill="url(#${uid}-sh)"/>
    <circle cx="${C}" cy="${C}" r="296" fill="url(#${uid}-br)" class="vv-bez"/><circle cx="${C}" cy="${C}" r="282" class="vv-line"/>${ticks}
  </svg>`
  const mottoSvg = `<svg viewBox="0 0 600 600" aria-hidden="true"><defs><path id="${uid}-mo" d="${arcPath((RM0 + RM1) / 2 - 4, 0.01, 359.9)}"/></defs>
    <circle cx="${C}" cy="${C}" r="${RM1}" class="vv-base"/><circle cx="${C}" cy="${C}" r="${RM0}" class="vv-line"/>
    <text class="vv-motto"><textPath href="#${uid}-mo" textLength="${(2 * Math.PI * ((RM0 + RM1) / 2 - 4) - 8).toFixed(0)}" lengthAdjust="spacing">${esc(cfg.motto)}</textPath></text></svg>`
  const ringSvg = `<svg viewBox="0 0 600 600" class="vv-ring" role="slider" tabindex="0" aria-label="${esc(cfg.aria)}. Drag to turn, or use the arrow keys." aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="1" aria-valuetext="${esc(cfg.valueText(0))}">
    <path d="${sector(RB0, RB1, 0, 179.99)}${sector(RB0, RB1, 180, 359.99)}" class="vv-base vv-hit"/>
    ${cfg.labels.map((lb, k) => {
      const a0 = k * STEP - STEP / 2, a1 = k * STEP + STEP / 2, [tx, ty] = pt((RB0 + RB1) / 2 + (cfg.radial ? 0 : 0), k * STEP)
      const ang = k * STEP, rot = cfg.radial ? (ang > 90 && ang < 270 ? ang + 90 : ang - 90) : ang
      return `<g class="vv-mark" data-k="${k}"><path d="${sector(RB0, RB1, a0 + 0.5, a1 - 0.5)}" class="vv-mark-bg vv-hit"/><text x="${f(tx)}" y="${f(ty)}" class="vv-num" transform="rotate(${f(rot)} ${f(tx)} ${f(ty)})" text-anchor="middle" dominant-baseline="central">${esc(lb)}</text></g>` }).join('')}
    <circle cx="${C}" cy="${C}" r="${RB1}" class="vv-line"/><circle cx="${C}" cy="${C}" r="${RB0}" class="vv-line"/>
  </svg>`
  const cellSvg = `<svg viewBox="0 0 600 600" aria-hidden="true"><circle cx="${C}" cy="${C}" r="${RC1 + 4}" class="vv-base"/><circle cx="${C}" cy="${C}" r="${RC0 - 6}" class="vv-line"/>
    ${Array.from({ length: cfg.cells }, (_, k) => { const a0 = (k / cfg.cells) * 360 + (cfg.cells < 60 ? 0.9 : 0.15), a1 = ((k + 1) / cfg.cells) * 360 - (cfg.cells < 60 ? 0.9 : 0.15); return `<path d="${sector(RC0, cfg.cells < 60 ? RC1 : RC0 + (k % 5 === 0 ? 40 : 28), a0, a1)}" class="vv-cell" data-k="${k}"/>` }).join('')}</svg>`
  const centre = cfg.centre === 'sun'
    ? `<defs><radialGradient id="${uid}-sun" cx="46%" cy="40%" r="62%"><stop offset="0" stop-color="#fff2c4"/><stop offset="0.45" stop-color="#f0b84a"/><stop offset="1" stop-color="#9a5f16"/></radialGradient></defs>
       <circle cx="${C}" cy="${C}" r="${RC0 - 12}" class="vv-base"/><g class="vv-rays">${Array.from({ length: 24 }, (_, k) => { const [ax, ay] = pt(64, k * 15 - 3), [bx, by] = pt(64, k * 15 + 3), [cx, cy] = pt(k % 2 ? 56 : 46, k * 15); return `<path d="M${f(ax)} ${f(ay)}L${f(cx)} ${f(cy)}L${f(bx)} ${f(by)}Z"/>` }).join('')}</g>
       <circle cx="${C}" cy="${C}" r="38" fill="url(#${uid}-sun)"/><path d="M${C - 16} ${C - 3}q8 -8 16 0q8 -8 16 0M${C - 12} ${C + 12}q12 8 24 0" class="vv-face"/>`
    : `<circle cx="${C}" cy="${C}" r="${RC0 - 12}" class="vv-base"/><rect x="${C - 40}" y="${C - 40}" width="80" height="80" rx="9" class="vv-seal"/><rect x="${C - 33}" y="${C - 33}" width="66" height="66" rx="5" class="vv-seal-in"/><text x="${C}" y="${C + 1}" class="vv-sealn" text-anchor="middle" dominant-baseline="central">01</text>`
  const topSvg = `<svg viewBox="0 0 600 600" aria-hidden="true">${centre}
    <path d="${sector(RB0 - 2, RB1 + 2, -STEP / 2 - 0.2, STEP / 2 + 0.2)}" class="vv-win"/><path d="M${C - 9} ${C - 296}L${C + 9} ${C - 296}L${C} ${C - 272}Z" class="vv-ptr"/></svg>`

  root.innerHTML = `
  <header class="vv-head">
    <div><span class="vv-kicker">${esc(cfg.heading.kicker)}</span><h3 class="vv-title">${esc(cfg.heading.title)}</h3></div>
    <p class="vv-notep" role="note">${esc(cfg.heading.note)}</p>
  </header>
  <div class="vv-grid">
    <div class="vv-stage"><div class="vv-disc">
      <div class="vv-layer" style="--z:0px">${plate}</div>
      <div class="vv-layer" style="--z:10px">${mottoSvg}</div>
      <div class="vv-layer vv-layer--grab" style="--z:24px">${ringSvg}</div>
      <div class="vv-layer" style="--z:36px">${cellSvg}</div>
      <div class="vv-layer" style="--z:48px">${topSvg}</div>
      <div class="vv-spec" aria-hidden="true"></div>
    </div></div>
    <article class="vv-folio" aria-live="polite"><div class="vv-page"></div></article>
  </div>
  <nav class="vv-jump" aria-label="Jump to a ${esc(cfg.unit.toLowerCase())}">${cfg.labels.map((r, k) => `<button type="button" data-k="${k}" aria-label="${esc(cfg.valueText(k))}">${esc(r)}</button>`).join('')}</nav>
  <p class="vv-foot">${esc(cfg.foot)}</p>`
  host.append(root)
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T
  const ring = $<SVGSVGElement>('.vv-ring') as unknown as HTMLElement
  const disc = $('.vv-disc'), stage = $('.vv-stage'), spec = $('.vv-spec'), page = $('.vv-page')
  const markEls = Array.from(root.querySelectorAll<SVGGElement>('.vv-mark'))
  const cellEls = Array.from(root.querySelectorAll<SVGPathElement>('.vv-cell'))
  const jumpBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('.vv-jump button'))
  const sealN = root.querySelector<SVGTextElement>('.vv-sealn')

  // ------------------------------------------------------------------------------------------------ the folio
  let cur = cfg.start ?? 0, shown = -1
  const live: { cancel(): unknown }[] = []
  function show(m: number, flip: boolean) {
    if (m === shown) return
    const first = shown < 0; shown = m
    markEls.forEach((el, k) => el.classList.toggle('is-on', k === m))
    jumpBtns.forEach((el, k) => el.setAttribute('aria-current', String(k === m)))
    const lit = new Set(cfg.cellsOn?.(m) ?? [])
    cellEls.forEach((el, k) => el.classList.toggle('is-on', lit.has(k)))
    if (sealN) sealN.textContent = cfg.labels[m]
    ring.setAttribute('aria-valuenow', String(m + 1)); ring.setAttribute('aria-valuetext', cfg.valueText(m))
    const swap = () => { page.innerHTML = cfg.folio(m) }
    if (!flip || reduced || first) { swap(); return }
    // the folio turns like a page: it swings edge-on, the next page replaces it, and it swings back open
    const A = animate
    live.splice(0).forEach(x => x.cancel())   // a new flip drops the last one (stops overlapping flips fighting; live stays at most 2 long)
    const a = A(page, { rotateY: [0, -86], opacity: [1, 0.2], duration: 150, ease: 'in(2)' })
    live.push(a)
    a.then(() => { swap(); live.push(A(page, { rotateY: [86, 0], opacity: [0.2, 1], duration: 380, ease: 'out(3)' })) })
  }

  // ------------------------------------------------------------------------------------------------ the dial
  const dial: Dial = createDial(ring, {
    steps: n, reduce: reduced, radius: ((RB0 + RB1) / 2) / 600, start: cfg.start ?? 0,
    onPass: i => cue('lab:drag', { param: cfg.unit.toLowerCase(), value: i / (n - 1) }),
    onLand: i => { cur = i; cue('lab:drag', { param: cfg.unit.toLowerCase(), value: i / (n - 1) }); show(i, true) },
  })
  show(cur, false)
  const onKey = (e: KeyboardEvent) => {
    const k = e.key
    if (k === 'ArrowRight' || k === 'ArrowUp') dial.step(1)
    else if (k === 'ArrowLeft' || k === 'ArrowDown') dial.step(-1)
    else if (k === 'Home') dial.jump(0)
    else if (k === 'End') dial.jump(n - 1)
    else if (k === 'PageUp') dial.jump((cur + 5) % n)
    else if (k === 'PageDown') dial.jump((cur + n - 5) % n)
    else return
    e.preventDefault(); e.stopPropagation()          // the case view steps to the next work on the same arrow keys
  }
  ring.addEventListener('keydown', onKey)
  const onJump = (e: Event) => { const b = (e.target as Element).closest<HTMLButtonElement>('button[data-k]'); if (b) dial.jump(Number(b.dataset.k)) }
  root.querySelector('.vv-jump')!.addEventListener('click', onJump)

  // ------------------------------------------------------------------------------------------------ type that stays at least 11px at any width
  const fit = () => root.style.setProperty('--u', (600 / Math.max(200, stage.clientWidth)).toFixed(3))
  const ro = new ResizeObserver(fit); ro.observe(stage); fit()

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

  // a first demonstration: the ring turns by itself once, so the page below it visibly changes (never when something is asked to hold still)
  const cancelView = reduced || sitePaused() || cfg.demo == null ? () => {} : onFirstView(host, () => { if (cur === (cfg.start ?? 0)) dial.jump(cfg.demo!) }, 0.5)

  return {
    dispose() {
      cancelView(); cancelAnimationFrame(raf); ro.disconnect()
      for (const a of live.splice(0)) { try { a.cancel() } catch { /* done */ } }
      ring.removeEventListener('keydown', onKey); stage.removeEventListener('pointermove', onMove); stage.removeEventListener('pointerleave', onLeave); window.removeEventListener('pointerup', onUp)
      dial.revert(); host.innerHTML = ''
    },
  }
}
