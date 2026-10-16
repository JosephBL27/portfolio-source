// Blueprint annotations (unit 14V): at each project stop, a thin ivory leader line draws on from a dot on the part of the 3D subject that matters out to a
// short label on the open side of the screen (opposite the copy lane). The dot is a projected world point (the form's place), so the line follows the subject
// while the camera drifts; nothing is drawn while the camera flies, while a dialog is open, or when the label would land on copy (it fades instead).
//   world stop      one leader per area, labelled with the area's name (AREA_NAME)
//   a project stop  the project's key figure (projects.json keyFigure, verbatim)
//   an interest     the stop's one thing to try (copy.ts INTEREST afford, verbatim)
// Words and numbers are never written here; everything comes from copy.ts / projects.json. The layer is decorative (aria-hidden, no pointer events).
// Cost per frame: one Vector3.project and one transform write per item, only when the stop dwells.
import * as THREE from 'three'
import '../styles/annotate.css'
import '../../ui/fx'
import { WAYPOINTS, AREAS, type Waypoint } from '../world/layout'
import { AREA_NAME, INTEREST, projOf } from './copy'
import type { FlightState } from '../world/flight'

type V3 = [number, number, number]
interface Spec { at?: V3; /** a screen point instead of a world point (the hub's dial is found by the world) */ px?: () => [number, number] | null; head: string; sub?: string }
interface Item { spec: Spec; el: HTMLElement; lab: HTMLElement; x: number; y: number; w: number; h: number; on: boolean; ok: boolean; dirx: number; diry: number }

/** where on each interest's object the leader lands, as a lift above its floor point (world units) */
const LIFT: Record<string, number> = { hold: 3.2, meeple: 1.2, records: 0.9, guitar: 2.6, knight: 2.2 }
/** a project stop's leader lands off the form's centre (world units: x, y, z), where the form has a part worth pointing at or the centre is already taken by a hint */
const NUDGE: Record<string, V3> = { mind: [0, 1.5, 0] }

function specsFor(w: Waypoint, world: { partScreen?(id: string, part: string): { x: number; y: number } | null } | null): Spec[] {
  // the first stop's one thing to operate; the words are the first screen's own hint (pov.ts: "Drag to look around · Turn the dial")
  if (w.id === 'world') return world?.partScreen ? [{ px: () => { const d = world.partScreen!('hub', 'dial'); return d ? [d.x, d.y] : null }, head: 'Turn the dial' }] : []
  if (INTEREST[w.id]) return [{ at: [w.place.at[0], w.place.at[1] + (LIFT[w.id] ?? 1.5), w.place.at[2]], head: INTEREST[w.id].afford }]
  const pid = w.tvs?.[0]
  const p = pid ? projOf(pid) : undefined
  if (p) { const n = NUDGE[w.id] ?? [0, 0, 0]; return [{ at: [w.place.at[0] + n[0], w.place.at[1] + n[1], w.place.at[2] + n[2]] as V3, head: p.keyFigure.value, sub: p.keyFigure.label }] }
  return []
}

export function install(ctx: { field: { camera: THREE.Camera } | null; world: any; state(): FlightState }) {
  const field = ctx.field
  if (!field?.camera) return
  const html = document.documentElement
  const layer = document.createElement('div')
  layer.id = 'annot'; layer.setAttribute('aria-hidden', 'true')
  document.body.append(layer)
  const cache = new Map<string, Item[]>()
  const v = new THREE.Vector3()
  let curId = '', items: Item[] = [], armedAt = 0, blk: { l: number; t: number; r: number; b: number }[] = [], blkAt = -1e9, blkFor = ''

  const build = (w: Waypoint): Item[] => {
    const list = specsFor(w, ctx.world).map(spec => {
      const el = document.createElement('div'); el.className = 'ann'
      const lab = document.createElement('div'); lab.className = 'ann-l'
      const b = document.createElement('b'); b.className = 'ann-h mono'; b.textContent = spec.head; lab.append(b)
      if (spec.sub) { const s = document.createElement('span'); s.className = 'ann-s mono'; s.textContent = spec.sub; lab.append(s) }
      el.innerHTML = '<svg class="ann-svg" width="1" height="1" overflow="visible" focusable="false"><circle class="ann-r" r="9"/><circle class="ann-d" r="2.6"/><path class="ann-pb"/><path class="ann-p" pathLength="1"/></svg>'
      el.append(lab); layer.append(el)
      return { spec, el, lab, x: NaN, y: NaN, w: 0, h: 0, on: false, ok: true, dirx: 1, diry: -1 }
    })
    return list
  }
  /** the leader leaves the dot toward `dir` (away from the copy lane), bends once, runs flat, and the label hangs on its end */
  const shape = (it: Item, dirx: number, diry: number, portrait: boolean) => {
    if (it.dirx === dirx && it.diry === diry && it.w) return
    it.dirx = dirx; it.diry = diry
    let d: string, lx: number, ly: number
    if (portrait) { d = `M0 0V${diry * 44}`; lx = 0; ly = diry * 44 }
    else { const bx = dirx * 30, by = diry * 26, ex = bx + dirx * 78; d = `M0 0L${bx} ${by}H${ex}`; lx = ex; ly = by }
    it.el.querySelectorAll('path').forEach(pp => pp.setAttribute('d', d))
    it.lab.style.setProperty('--lx', lx + 'px'); it.lab.style.setProperty('--ly', ly + 'px')
    it.lab.dataset.al = portrait ? 'c' : dirx > 0 ? 'r' : 'l'
    it.lab.dataset.v = diry < 0 ? 'u' : 'd'
    it.w = it.lab.offsetWidth || 160; it.h = it.lab.offsetHeight || 36
  }
  const copyRects = (id: string, now: number) => {
    if (id === blkFor && now - blkAt < 300) return blk
    blkFor = id; blkAt = now; blk = []
    const root = document.getElementById('ov-' + id)
    if (root) for (const e of root.querySelectorAll<HTMLElement>('.info > *, .head, .pcard, h1, h2, p, .acts')) {
      const r = e.getBoundingClientRect()
      if (r.width > 8 && r.height > 8 && r.right > 0 && r.left < innerWidth) blk.push({ l: r.left - 8, t: r.top - 6, r: r.right + 8, b: r.bottom + 6 })
    }
    return blk
  }
  const sideOf = (id: string): number => {
    const o = document.getElementById('ov-' + id)
    const s = o?.getAttribute('data-side')
    return s === 'l' ? 1 : s === 'r' ? -1 : 1   // copy on the left: open side is the right (+1)
  }

  return {
    update(_t: number, _dt: number, st: FlightState) {
      const w = WAYPOINTS[st.wp]
      // html.ann-quiet: a stage that labels its own subject (the QVR instrument's engraved scales and plate) asks for the stop's leader to stand down
      const quiet = !st.dwelling || html.classList.contains('ann-quiet') || html.classList.contains('jumping') || html.classList.contains('is-loading') || html.classList.contains('in-index') || !!document.querySelector('dialog[open]')
      const id = quiet || !w ? '' : w.id
      if (id !== curId) {
        for (const it of items) { it.on = false; it.el.classList.remove('on') }
        curId = id; items = []
        if (id) { let c = cache.get(id); if (!c) { c = build(w); cache.set(id, c) } items = c; armedAt = performance.now() }
        blkFor = ''
      }
      if (!items.length) return
      const now = performance.now()
      const cam = field.camera
      const portrait = innerWidth < innerHeight * 0.9
      const rects = copyRects(w.overlay, now)
      const open = sideOf(w.overlay)
      for (const it of items) {
        let x: number, y: number, front = true
        if (it.spec.px) { const q = it.spec.px(); front = !!q; x = q ? q[0] : -999; y = q ? q[1] : -999 }
        else { v.set(...it.spec.at!).project(cam); x = (v.x * 0.5 + 0.5) * innerWidth; y = (-v.y * 0.5 + 0.5) * innerHeight; front = v.z > 0 && v.z < 1 }
        const vis = front && x > 24 && x < innerWidth - 24 && y > 24 && y < innerHeight - 24
        shape(it, open, y < innerHeight * 0.34 ? 1 : -1, portrait)
        if (!(Math.abs(x - it.x) <= 0.3) || !(Math.abs(y - it.y) <= 0.3)) { it.x = x; it.y = y; it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)` }
        // the label's box: if it lands on copy, or leaves the screen, the whole leader fades
        const lx = it.dirx * (portrait ? 0 : 30 + 78), ly = (portrait ? 44 : 26) * it.diry
        const left = it.x + lx + (portrait ? -it.w / 2 : it.dirx > 0 ? 8 : -it.w - 8), top = it.y + ly + (it.diry < 0 ? -it.h - 4 : 4)
        const hit = rects.some(r => left < r.r && left + it.w > r.l && top < r.b && top + it.h > r.t)
        const inside = left > 6 && left + it.w < innerWidth - 6 && top > 6 && top + it.h < innerHeight - 6
        const ok = vis && !hit && inside
        const want = ok && now - armedAt > 520
        if (want !== it.on) { it.on = want; it.el.classList.toggle('on', want) }
        it.ok = ok
      }
    },
  }
}
