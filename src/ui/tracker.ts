// Tracker brackets: four corner marks + a mono label that follow a live object's screen
// bounds on a spring, like a camera's focus box. Purely decorative (aria-hidden).
export interface Tracker { set(r: DOMRect | null, label?: string): void; step(dt: number): void }
export function createTracker(host: HTMLElement, cls = ''): Tracker {
  const el = document.createElement('div')
  el.className = 'trk ' + cls
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML = '<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i><span class="trk-l mono"></span><span class="trk-x"></span>'
  host.appendChild(el)
  const lab = el.querySelector('.trk-l') as HTMLElement
  const cur = { x: 0, y: 0, w: 0, h: 0, o: 0 }, vel = { x: 0, y: 0, w: 0, h: 0 }
  let want: DOMRect | null = null, first = true, labelText = ''
  return {
    set(r, label) { want = r; if (label && label !== labelText) { labelText = label; lab.textContent = label } },
    step(dt) {
      const tgtO = want ? 1 : 0
      cur.o += (tgtO - cur.o) * Math.min(1, dt * 8)
      if (want) {
        const pad = 10
        const t = { x: want.left - pad, y: want.top - pad, w: want.width + pad * 2, h: want.height + pad * 2 }
        if (first) { Object.assign(cur, t); first = false }
        const k = 170, c = 2 * Math.sqrt(k) * 0.72 // a little under-damped: it overshoots, then locks on
        for (const key of ['x', 'y', 'w', 'h'] as const) {
          const a = (t[key] - cur[key]) * k - vel[key] * c
          vel[key] += a * dt; cur[key] += vel[key] * dt
        }
      }
      if (cur.o < 0.01) { if (el.style.display !== 'none') el.style.display = 'none'; return }
      el.style.display = ''
      el.style.opacity = cur.o.toFixed(3)
      el.style.transform = `translate(${cur.x.toFixed(1)}px, ${cur.y.toFixed(1)}px)`
      el.style.width = cur.w.toFixed(1) + 'px'
      el.style.height = cur.h.toFixed(1) + 'px'
    },
  }
}
