// Track model: ONE continuous scroll track. The flight module (src/v3/world/flight.ts) owns the truth about where each
// waypoint sits on the track (SCROLL_VH, waypointP, nearestWaypoint); when it is present we use its numbers so the UI and
// the camera agree exactly. Otherwise a local model from the waypoint weights stands in (travel INTO a waypoint, then dwell).
// Units: SCROLL_VH is the track height in VIEWPORTS (flight.ts), so the scroll range is (SCROLL_VH - 1) viewports.
import type { Waypoint } from '../world/layout'
import { clamp } from './util'

const flightMods = import.meta.glob('../world/flight.ts', { eager: true }) as Record<string, Record<string, unknown>>
const F = Object.values(flightMods)[0] as undefined | { SCROLL_VH?: number; waypointP?: (i: number) => number; nearestWaypoint?: (p: number) => number }
const external = !!(F && typeof F.waypointP === 'function' && typeof F.nearestWaypoint === 'function' && typeof F.SCROLL_VH === 'number')

export interface Seg { i: number; start: number; arrive: number; end: number } // normalised 0..1
export class Track {
  segs: Seg[] = []
  total = 1
  /** track height in viewports (the scroll range is one viewport less) */
  scrollVh = 31
  constructor(readonly wps: Waypoint[]) {
    let acc = 0
    const raw = wps.map(w => { const s = { start: acc, arrive: acc + w.travel, end: acc + w.travel + w.dwell }; acc = s.end; return s })
    this.total = Math.max(1e-6, acc)
    this.segs = raw.map((s, i) => ({ i, start: s.start / this.total, arrive: s.arrive / this.total, end: s.end / this.total }))
    this.scrollVh = external ? (F!.SCROLL_VH as number) : Math.round(this.total * 0.8 * 100) / 100
  }
  /** nearest waypoint (by the middle of its dwell) to progress p */
  wpAt(p: number): number {
    if (external) return F!.nearestWaypoint!(p)
    let best = 0, bd = 9
    this.segs.forEach((s, i) => { const d = Math.abs((s.arrive + s.end) / 2 - p); if (d < bd) { bd = d; best = i } })
    return best
  }
  /** progress at which waypoint i is settled and its copy is fully in (the middle of its dwell) */
  stop(i: number): number {
    const k = clamp(i, 0, this.segs.length - 1) | 0
    if (external) return F!.waypointP!(k)
    const s = this.segs[k]
    return (s.arrive + s.end) / 2
  }
}
