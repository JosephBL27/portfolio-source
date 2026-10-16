// Pointer spotlight (unit 14V): a soft ivory glow that follows the pointer across a list of rows. One pointermove listener on the container writes two
// custom properties (--mx / --my, px inside the row) on the row under the pointer, in a single rAF; the glow itself is CSS (fx.css, .fx-spot::before).
// Fine pointers only: touch has no hover. Returns a dispose function.
export function attachSpotlight(root: HTMLElement, rowSel: string): () => void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {}
  let raf = 0, cur: HTMLElement | null = null, x = 0, y = 0, ev: PointerEvent | null = null
  const flush = () => {
    raf = 0
    if (!ev) return
    const row = (ev.target as Element | null)?.closest?.<HTMLElement>(rowSel) ?? null
    if (row !== cur) { cur?.classList.remove('fx-lit'); cur = row; cur?.classList.add('fx-lit') }
    if (cur) { const r = cur.getBoundingClientRect(); x = ev.clientX - r.left; y = ev.clientY - r.top; cur.style.setProperty('--mx', x.toFixed(0) + 'px'); cur.style.setProperty('--my', y.toFixed(0) + 'px') }
  }
  const move = (e: PointerEvent) => { ev = e; if (!raf) raf = requestAnimationFrame(flush) }
  const leave = () => { ev = null; cur?.classList.remove('fx-lit'); cur = null }
  root.addEventListener('pointermove', move, { passive: true })
  root.addEventListener('pointerleave', leave)
  root.querySelectorAll(rowSel).forEach(r => r.classList.add('fx-spot'))
  return () => { root.removeEventListener('pointermove', move); root.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf); leave() }
}
