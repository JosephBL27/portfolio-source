// A stroke-drawn line diagram that heads each case view (unit 14V). It is the project's own pipeline (projects.json "pipeline", the same station
// names the Pipeline section lists) drawn as one hairline that runs station to station: dots sit on a flowing S-curve, the line draws on with
// anime.js createDrawable when the diagram scrolls into view. Words only (no numerals); the whole figure is decorative (aria-hidden), the real list is
// the Pipeline section below it. Reduced motion draws it at once. The SVG is measured from the laid-out dots, so it follows any width (a row on a desktop,
// a staggered column on a phone) and is redrawn by a ResizeObserver.
import { animate, svg, stagger } from 'animejs'

export interface Diagram { el: HTMLElement; mount(): void; layout(): void; dispose(): void; card(k: number): HTMLElement | null }
const NS = 'http://www.w3.org/2000/svg'

export function buildDiagram(steps: { step: string }[], opts: { reduced: () => boolean }): Diagram | null {
  if (steps.length < 2) return null
  const el = document.createElement('section')
  el.className = 'cv-sec cv-dia'
  el.setAttribute('aria-hidden', 'true')
  el.dataset.proof = 'skip'
  const fig = document.createElement('div'); fig.className = 'dia'
  const ol = document.createElement('ol'); ol.className = 'dia__st'
  for (const s of steps) {
    const li = document.createElement('li')
    const dot = document.createElement('i'); dot.className = 'dia__dot'
    const nm = document.createElement('span'); nm.className = 'dia__nm mono'; nm.textContent = s.step
    li.append(dot, nm); ol.append(li)
  }
  const sv = document.createElementNS(NS, 'svg'); sv.setAttribute('class', 'dia__svg'); sv.setAttribute('focusable', 'false')
  const base = document.createElementNS(NS, 'path'); base.setAttribute('class', 'dia__base')
  const line = document.createElementNS(NS, 'path'); line.setAttribute('class', 'dia__line')
  sv.append(base, line)
  fig.append(sv, ol); el.append(fig)

  let ro: ResizeObserver | null = null, io: IntersectionObserver | null = null, drawn = false, anims: { cancel(): unknown }[] = [], raf = 0
  const dots = () => Array.from(ol.querySelectorAll<HTMLElement>('.dia__dot'))

  const measure = () => {
    const r = fig.getBoundingClientRect()
    if (r.width < 8) return
    const pts = dots().map(d => { const b = d.getBoundingClientRect(); return [b.left - r.left + b.width / 2, b.top - r.top + b.height / 2] })
    sv.setAttribute('viewBox', `0 0 ${r.width.toFixed(1)} ${r.height.toFixed(1)}`)
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k]
      if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) { const m = (x0 + x1) / 2; d += `C${m.toFixed(1)} ${y0.toFixed(1)} ${m.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}` }
      else { const m = (y0 + y1) / 2; d += `C${x0.toFixed(1)} ${m.toFixed(1)} ${x1.toFixed(1)} ${m.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}` }
    }
    base.setAttribute('d', d); line.setAttribute('d', d)
  }
  const play = () => {
    if (drawn) return
    drawn = true
    el.classList.add('is-in')
    if (opts.reduced()) return
    const [dr] = svg.createDrawable(line)
    anims.push(animate(dr, { draw: ['0 0', '0 1'], duration: 1500, ease: 'inOut(3)' }))
    anims.push(animate(dots(), { scale: [0, 1], opacity: [0, 1], delay: stagger(1500 / steps.length, { start: 120 }), duration: 380, ease: 'out(3)' }))
    anims.push(animate(Array.from(ol.querySelectorAll('.dia__nm')), { opacity: [0, 1], delay: stagger(1500 / steps.length, { start: 220 }), duration: 420, ease: 'out(2)' }))
  }
  return {
    el,
    mount() {
      raf = requestAnimationFrame(() => {
        measure()
        ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure) })
        ro.observe(fig)
        if (opts.reduced()) { drawn = true; el.classList.add('is-in'); return }
        el.classList.add('is-armed')
        io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io?.disconnect(); io = null; play() } }, { threshold: 0.2 })
        io.observe(el)
      })
    },
    layout() { measure() },
    dispose() { cancelAnimationFrame(raf); ro?.disconnect(); io?.disconnect(); anims.forEach(a => a.cancel()); anims = [] },
    card: () => null,
  }
}
