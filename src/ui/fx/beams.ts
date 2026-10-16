// Animated beams (unit 14V): a hairline joins the swatches of a project list row to row, and a small light travels along it, so a group of systems reads as
// one connected thing. The SVG sits behind the rows; it is measured from the swatches (`.ovw-sw`) and redrawn when the list resizes. The pulse is a CSS
// stroke-dashoffset animation (fx.css) that only runs while the list is on screen. Decorative: aria-hidden, no text.
const NS = 'http://www.w3.org/2000/svg'

export function attachBeams(list: HTMLElement, rowSel: string, swSel: string): () => void {
  list.classList.add('fx-beamed')
  const sv = document.createElementNS(NS, 'svg')
  sv.setAttribute('class', 'fx-beams'); sv.setAttribute('aria-hidden', 'true'); sv.setAttribute('focusable', 'false')
  list.append(sv)
  let raf = 0, io: IntersectionObserver | null = null
  const draw = () => {
    raf = 0
    const lr = list.getBoundingClientRect()
    if (lr.height < 8) return
    const pts = Array.from(list.querySelectorAll<HTMLElement>(`${rowSel} ${swSel}`)).map(s => { const b = s.getBoundingClientRect(); return [b.left - lr.left + b.width / 2, b.top - lr.top + b.height / 2] })
    sv.setAttribute('viewBox', `0 0 ${lr.width.toFixed(0)} ${lr.height.toFixed(0)}`)
    sv.replaceChildren()
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], m = (y0 + y1) / 2, bow = (k % 2 ? 1 : -1) * 9
      const d = `M${x0.toFixed(1)} ${y0.toFixed(1)}C${(x0 + bow).toFixed(1)} ${m.toFixed(1)} ${(x1 + bow).toFixed(1)} ${m.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`
      const a = document.createElementNS(NS, 'path'); a.setAttribute('d', d); a.setAttribute('class', 'fx-beam__line')
      const b = document.createElementNS(NS, 'path'); b.setAttribute('d', d); b.setAttribute('class', 'fx-beam__pulse'); b.setAttribute('pathLength', '100')
      b.style.animationDelay = `${(-k * 0.55).toFixed(2)}s`
      sv.append(a, b)
    }
  }
  const sched = () => { if (!raf) raf = requestAnimationFrame(draw) }
  const ro = new ResizeObserver(sched); ro.observe(list)
  io = new IntersectionObserver(es => list.classList.toggle('fx-live', es.some(e => e.isIntersecting)), { threshold: 0 }); io.observe(list)
  sched()
  return () => { cancelAnimationFrame(raf); ro.disconnect(); io?.disconnect(); sv.remove(); list.classList.remove('fx-beamed', 'fx-live') }
}
