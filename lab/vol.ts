// Lab: the QVR volatility lab, standalone. URL params:
//   ?mode=flow            start on the rebalancing-flow tab (&session=0..6, &L=2|3|-1|-2|-3, &play=1 to let it run)
//   ?preset=0..3          apply a preset (0 reset, 1 steep skew, 2 break butterfly, 3 break calendar)
//   ?pick=k,u             pin a point (k in [-0.5,0.4], u 0..1 on the log-maturity axis)
//   ?hover=x,y            hover the 3D view at canvas px     ?w=760  constrain the host width (case-view column)
//   ?reduced=1            reduced motion      ?bare=1  no event log
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/500.css'
import { mount } from '../src/ui/labs/qvr'

const q = new URLSearchParams(location.search)
if (q.has('bare')) document.body.classList.add('bare')
if (q.has('w')) document.getElementById('host')!.style.maxWidth = q.get('w') + 'px'
const log = document.getElementById('log')!
const events: { name: string; data: unknown }[] = []
const reduced = q.has('reduced') ? q.get('reduced') !== '0' : matchMedia('(prefers-reduced-motion: reduce)').matches
const handle = mount(document.getElementById('host')!, {
  reduced,
  emit(name, data) {
    events.push({ name, data })
    log.textContent = events.slice(-8).map(e => `${e.name} ${JSON.stringify(e.data ?? '')}`).join('\n')
  },
})
const $ = (s: string) => document.querySelector(s) as HTMLElement | null
const click = (s: string) => $(s)?.click()
if (q.get('mode') === 'flow') click('.vl-tab[data-mode="flow"]')
if (q.has('L')) click(`[data-lev="${q.get('L')}"]`)
if (q.has('session')) { const t = $('.vl-sl-track[aria-label^="Sessions"]'); const s = +q.get('session')!; if (t) { t.focus(); for (let i = 0; i < s; i++) t.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) } }
if (q.get('mode') === 'flow' && !q.has('play')) { const b = $('.vl-play'); if (b && b.textContent === 'Pause') b.click() }
if (q.has('preset')) click(`[data-preset="${q.get('preset')}"]`)
if (q.has('pick')) {
  const [k, u] = q.get('pick')!.split(',').map(Number)
  const tr = (label: string, v: number, lo: number, hi: number) => {
    const t = $(`.vl-sl-track[aria-label^="${label}"]`); if (!t) return
    const r = t.getBoundingClientRect(); const x = r.left + ((v - lo) / (hi - lo)) * r.width
    for (const type of ['pointerdown', 'pointerup']) t.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: r.top + r.height / 2, pointerId: 1, bubbles: true }))
  }
  tr('Strike', k, -0.5, 0.4); tr('Maturity', u, 0, 1)
}
;(window as any).__vol = { handle, events, ready: true }
if (q.has('hover')) {
  const [x, y] = q.get('hover')!.split(',').map(Number)
  setTimeout(() => { const c = $('.vl-3d')!, r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + x, clientY: r.top + y, pointerId: 2, bubbles: true })) }, 600)
}
