// Project captions: small mono tags anchored to the lit TV screens (main supplies the projected positions).
// Each tag is an "Open" affordance for its project. They duplicate the overlay's Open buttons, so they are
// hidden from assistive tech and out of the tab order; the overlay buttons are the keyboard path.
import { PROJECTS } from './copy'
import type { AnchorIn } from './types'
import { h } from './util'
import { occ } from '../world/occlusion'

interface A { el: HTMLButtonElement; lb: HTMLElement; x: number; y: number; vis: boolean; dx: number; seen: number; w: number; hid: boolean }
export interface Rect { l: number; t: number; r: number; b: number }
const known = new Set(PROJECTS.map(p => p.id))

export function initAnchors(root: HTMLElement, onOpen: (id: string, el: HTMLElement) => void) {
  const map = new Map<string, A>()
  let frame = 0
  return {
    set(list: AnchorIn[], blockers: Rect[] = []) {
      frame++
      const html = document.documentElement
      const hide = html.classList.contains('jumping') || html.classList.contains('in-index')
      for (const a of list) {
        let o = map.get(a.id)
        if (!o) {
          const lb = h('span', { class: 'lb' }, h('span', { class: 'nm mono', text: a.label }), h('span', { class: 'op mono', text: known.has(a.id) ? 'Open ↗' : '' }))
          const el = h('button', { class: 'an', type: 'button', tabindex: -1, 'aria-hidden': 'true', 'data-cursor': '', 'data-project': a.id }, h('i', { class: 'ld' }), h('i', { class: 'dt' }), lb)
          if (known.has(a.id)) el.addEventListener('click', () => onOpen(a.id, el))
          else el.disabled = true
          root.append(el)
          o = { el, lb, x: NaN, y: NaN, vis: false, dx: NaN, seen: frame, w: 0, hid: false }
          map.set(a.id, o)
          o.w = lb.offsetWidth || 220
        }
        o.seen = frame
        const nm = o.lb.firstElementChild as HTMLElement
        if (nm.textContent !== a.label) { nm.textContent = a.label; o.w = o.lb.offsetWidth || o.w }
        if (!(Math.abs(o.x - a.x) <= 0.04) || !(Math.abs(o.y - a.y) <= 0.04)) { o.x = a.x; o.y = a.y; o.el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)` }
        // keep the chip inside the viewport (it hangs centred under the point)
        const hw = (o.w || 236) / 2 + 12
        const dx = Math.max(0, hw - a.x) - Math.max(0, a.x + hw - innerWidth)
        if (dx !== o.dx) { o.dx = dx; o.el.style.setProperty('--dx', dx + 'px') }
        // a tag never sits on top of copy or of the HUD (the ring radar, the next-stop cue, the readout, the toggles): if its box would land on one, the dot stays and the tag steps aside.
        // The TV's slot (world/occlusion.ts findSlot) already keeps its own box clear of all of them, so this only catches a TV that is still gliding into its slot or a resize.
        const cl = a.x + dx - o.w / 2 - 10, cr = a.x + dx + o.w / 2 + 10, ct = a.y + 14, cb = a.y + 58
        const hit = blockers.some(r => cl < r.r && cr > r.l && ct < r.b && cb > r.t) || occ.hud.some(r => cl + 4 < r.r && cr - 4 > r.l && ct < r.b && cb > r.t)   // the HUD gets 6 px of air, the copy 10: the slot keeps 8 px clear of the HUD
        if (hit !== o.hid) { o.hid = hit; o.el.classList.toggle('aside', hit) }
        const v = !hide && a.visible && a.x > -40 && a.x < innerWidth + 40 && a.y > -40 && a.y < innerHeight + 40
        if (v !== o.vis) { o.vis = v; o.el.classList.toggle('vis', v) }
      }
      for (const [id, o] of map) if (o.seen !== frame) { o.vis = false; o.el.classList.remove('vis'); if (!list.length || frame - o.seen > 90) { o.el.remove(); map.delete(id) } }
    },
  }
}
