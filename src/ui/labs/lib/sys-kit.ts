// Shared plumbing for the four agent/systems labs. Cancellable waits, a pointer drag helper, a text scramble, animejs wrappers.
import './sys-base.css'
import { animate, stagger } from 'animejs'
import { esc, type LabOpts } from './kit'

export { esc, stagger }
export type { LabOpts }

export const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string) => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e
}

/** the shell every sys lab shares: header + a body slot. Returns the root and the pieces. */
export function shell(host: HTMLElement, cls: string, o: { kicker: string; title: string; note: string; reduced: boolean }) {
  host.innerHTML = ''
  const root = h('div', `sys ${cls}${o.reduced ? ' is-reduced' : ''}`)
  root.setAttribute('data-proof', 'skip')
  root.innerHTML = `<header class="sys-head"><div><span class="sys-kicker">${esc(o.kicker)}</span><h3 class="sys-title">${esc(o.title)}</h3></div><p class="sys-note" role="note">${o.note}</p></header><div class="sys-body"></div><p class="sys-status" aria-hidden="true"></p><p class="sys-sr" aria-live="polite"></p>`
  host.append(root)
  function q<T extends Element = HTMLElement>(s: string): T { return root.querySelector(s) as T }
  return { root, body: q('.sys-body'), status: q('.sys-status'), sr: q('.sys-sr'), q }
}

/** timers and waits that die with the lab; in reduced motion waits collapse so a run still completes, only without movement */
export function clock(reduced: boolean) {
  let dead = false; const ids = new Set<number>()
  const wait = (ms: number) => new Promise<boolean>(res => {
    if (dead) return res(false)
    const id = window.setTimeout(() => { ids.delete(id); res(!dead) }, reduced ? Math.min(ms, 90) : ms); ids.add(id)
  })
  return { wait, get dead() { return dead }, dispose() { dead = true; ids.forEach(clearTimeout); ids.clear() } }
}

/** a motion helper that does nothing visible in reduced motion: the end state is applied at once */
export function mover(reduced: boolean) {
  return (targets: any, params: Record<string, any>) => {
    if (reduced) {
      const list: Element[] = typeof targets === 'string' ? Array.from(document.querySelectorAll(targets)) : Array.isArray(targets) ? targets : targets instanceof NodeList ? Array.from(targets) : [targets]
      for (const el of list) for (const [k, v] of Object.entries(params)) {
        if (['duration', 'delay', 'ease', 'onComplete', 'composition'].includes(k)) continue
        const val = Array.isArray(v) ? v[v.length - 1] : v
        if (typeof val === 'number' || typeof val === 'string') { const s = (el as HTMLElement).style; if (k === 'opacity') s.opacity = String(val); else if (k === 'x' || k === 'y' || k === 'scale' || k === 'rotate') s.setProperty(`--${k}`, String(val)) }
      }
      params.onComplete?.()
      return null
    }
    return animate(targets, params)
  }
}

/** type a string in with a scramble of random glyphs resolving left to right */
export function scramble(el: HTMLElement, text: string, reduced: boolean, ms = 520) {
  if (reduced) { el.textContent = text; return }
  const glyphs = '01<>/_-+=#%'; const t0 = performance.now()
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / ms), n = Math.floor(k * text.length)
    el.textContent = text.slice(0, n) + (n < text.length ? Array.from({ length: Math.min(4, text.length - n) }, () => glyphs[(Math.random() * glyphs.length) | 0]).join('') : '')
    if (k < 1 && el.isConnected) requestAnimationFrame(tick); else el.textContent = text
  }
  tick()
}

/** pointer drag for a card: it follows the pointer, then `drop` decides; return false from drop to spring back. Touch-safe (touch-action none on the handle). */
export function dragCard(card: HTMLElement, o: { onStart?(): void; onMove?(x: number, y: number): void; drop(x: number, y: number): boolean | void; reduced: boolean }) {
  let sx = 0, sy = 0, id = -1, ox = 0, oy = 0
  card.style.touchAction = 'none'
  const move = (e: PointerEvent) => { if (e.pointerId !== id) return; ox = e.clientX - sx; oy = e.clientY - sy; card.style.transform = `translate(${ox}px, ${oy}px) scale(1.03)`; o.onMove?.(e.clientX, e.clientY) }
  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return
    id = -1; card.releasePointerCapture?.(e.pointerId); card.classList.remove('is-drag')
    card.removeEventListener('pointermove', move); card.removeEventListener('pointerup', up); card.removeEventListener('pointercancel', up)
    const kept = o.drop(e.clientX, e.clientY)
    if (kept === false) {
      if (o.reduced) card.style.transform = ''
      else { card.style.transform = ''; animate(card, { x: [ox, 0], y: [oy, 0], duration: 320, ease: 'outBack' }) }
    } else card.style.transform = ''
  }
  card.addEventListener('pointerdown', e => {
    if (id !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) return
    id = e.pointerId; sx = e.clientX; sy = e.clientY; ox = oy = 0; card.setPointerCapture(id); card.classList.add('is-drag')
    card.addEventListener('pointermove', move); card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up); o.onStart?.()
  })
}

/** the element under a viewport point that matches `sel` */
export const under = (x: number, y: number, sel: string) => (document.elementsFromPoint(x, y).find(e => e.matches(sel)) as HTMLElement | undefined) ?? null
