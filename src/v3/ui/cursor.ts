// Cursor ring. The native cursor is NEVER hidden; this is a decorative 2 px ink ring with a dark halo that
// follows it with a little inertia (no blend: it reads on bright bloom and on black). It lives in the top
// layer (popover) so it shows above modal dialogs, and it is re-promoted whenever a dialog opens.
// It grows on interactive elements and, via html.tv-hover (set by the world), over TVs that open or press.
// Grab state: over empty canvas, a TV body or the dial (things a drag moves) the ring opens into two arcs "( )"
// (the visitor can drag here); while a drag is live (html.tv-drag / html.pov-drag) the arcs close up and take the accent.
import { h } from './util'
import '../styles/cursor.css'

export function initCursor() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
  if (!fine) return { update() {} }
  const ring = h('div', { class: 'ring' })
  const dot = h('div', { class: 'dot' }) as HTMLElement
  const lbl = h('div', { class: 'lbl' }) as HTMLElement
  const root = h('div', { id: 'cursor', 'aria-hidden': 'true' }, ring, dot, lbl)
  const pop = root as HTMLElement & { showPopover?: () => void; hidePopover?: () => void }
  const hasPopover = typeof pop.showPopover === 'function'
  if (hasPopover) root.setAttribute('popover', 'manual')
  document.body.append(root)
  const promote = () => {
    if (!hasPopover) return
    try { if (root.matches(':popover-open')) pop.hidePopover!(); pop.showPopover!() } catch { /* not connected yet */ }
  }
  promote()

  // any dialog that opens enters the top layer after the ring: put the ring back on top of it
  let queued = false
  const requeue = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; promote() }) }
  new MutationObserver(ms => { if (ms.some(m => (m.target as Element).tagName === 'DIALOG' || (m.target as Element).closest?.('dialog'))) requeue() })
    .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] })
  document.addEventListener('toggle', requeue, true)

  const html = document.documentElement
  const css = document.createElement('style')
  css.textContent = [
    '#cursor .ring.grab, #cursor .ring.grabbing { border-top-color: transparent; border-bottom-color: transparent; box-shadow: none; filter: drop-shadow(0 0 1.5px rgba(5,5,6,.95)); transition: scale .36s var(--ease-out), opacity .3s, border-color .18s; }',
    'html.tv-drag #cursor .ring.grabbing, html.pov-drag #cursor .ring.grabbing { border-left-color: var(--accent, #FF6A4D); border-right-color: var(--accent, #FF6A4D); }',
    'html.rm #cursor .ring.grab, html.rm #cursor .ring.grabbing { transition: none; }',
  ].join('\n')
  document.head.append(css)
  let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, seen = false, cs = 1, down = false, onField = false, lastEl: Element | null = null
  const setScale = (s: number) => { if (s !== cs) { cs = s; ring.style.setProperty('--cs', String(s)) } }
  const dragging = () => html.classList.contains('tv-drag') || html.classList.contains('pov-drag')
  const target = (t: Element | null) => (t?.closest?.('a, button, [data-cursor], input, textarea, summary, [role="button"]') ? 1.7 : html.classList.contains('tv-hover') ? 2.2 : dragging() ? 1 : onField || html.classList.contains('tv-grab') ? 1.35 : 1)
  addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY
    if (!seen) { seen = true; x = tx; y = ty; root.classList.add('on') }
    lastEl = e.target as Element | null
    onField = lastEl?.id === 'field'
    setScale(target(lastEl))
    ring.classList.toggle('hot', !!lastEl?.closest?.('a, button, [data-cursor], summary, [role="button"]'))
    // Serra: the tiny word "Enter" beneath the ring over the primary entry button
    const word = lastEl?.closest?.('.gate-btn.primary') ? 'Enter' : ''
    if (word !== lbl.textContent) lbl.textContent = word
    lbl.classList.toggle('on', !!word)
  }, { passive: true })
  addEventListener('pointerdown', () => { down = true; ring.classList.add('press') })
  addEventListener('pointerup', () => { down = false; ring.classList.remove('press') })
  document.addEventListener('pointerleave', () => root.classList.remove('on'))
  document.addEventListener('pointerenter', () => { if (seen) root.classList.add('on') })
  let tvWas = '', grabWas = ''
  return {
    update(dt: number) {
      // the world / POV extra set these classes; the ring follows them (no pointer event needed: a TV can slide under a still cursor)
      const hover = html.classList.contains('tv-hover'), drag = dragging(), grab = !hover && !drag && (onField || html.classList.contains('tv-grab'))
      const st = hover ? 'h' : drag ? 'd' : grab ? 'g' : ''
      if (st !== tvWas) { tvWas = st; if (!down) setScale(target(lastEl)) }
      const gs = drag ? 'grabbing' : grab ? 'grab' : ''
      if (gs !== grabWas) { grabWas = gs; ring.classList.toggle('grab', gs === 'grab'); ring.classList.toggle('grabbing', gs === 'grabbing') }
      const k = 1 - Math.pow(0.82, dt * 60) // Serra: 1 - 0.82^(dt/16.667ms)
      x += (tx - x) * k; y += (ty - y) * k
      root.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      dot.style.transform = `translate3d(${(tx - x).toFixed(1)}px, ${(ty - y).toFixed(1)}px, 0)` // the dot tracks the pointer directly
    },
  }
}
