// UNIT 10F: the finale. After the chess (the knight stands in its own space, far beyond the hall's end wall) the camera rises up and out, back over the
// hall and the ring, through a deck of cloud laid where the rise begins, into a night sky above the whole ring world. The six areas glow below as a quiet
// background. The last stop IS the overview: the page the O key opens is shown inline over that sky, the contact first (both addresses, LinkedIn, GitHub,
// Replay the tour), then Experience, Education and every project (world/extras/finale/panel.ts, ui/overview.ts). The project Index that used to follow the
// track is gone, so a link to #index (the skip link, the Index menu's footer) flies to this stop.
// Contract: install(ctx) -> { update, adjustCam }. ?extras=-finale switches it off. Reduced motion: fixed pose, static page.
import * as THREE from 'three'
import type { Extra, ExtraCtx } from '../../main'
import type { FlightState } from '../flight'
import { WAYPOINTS } from '../layout'
import { extraOn, isPhone, reducedMotion, sstep, lerp, timed } from './lib/flags'
import { createSky } from './finale/sky'
import { buildPanel } from './finale/panel'
import { registerEnding } from '../../ui/overview'
import '../../styles/finale.css'

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('finale') || !ctx.field?.scene) return
  const LAST = WAYPOINTS.length - 1
  if (WAYPOINTS[LAST].id !== 'epilogue') return
  const scene: THREE.Scene = ctx.field.scene
  const sky = createSky(isPhone()); scene.add(sky.group)
  const nav = () => ctx.ui?.nav as { go?(token: string, push?: boolean): boolean } | undefined
  // while the curtain is down the nav's own deep-link path waits for it; afterwards the same call a rail click makes
  const toEnd = () => { if (document.documentElement.classList.contains('is-loading')) location.hash = '#epilogue'; else nav()?.go?.('epilogue') }
  const panel = buildPanel({
    waypoints: WAYPOINTS,
    open: (id, el) => ctx.openWork(id, el),
    go: token => !!nav()?.go?.(token),
    replay: () => { nav()?.go?.('top') },
    chime: () => ctx.emit('obj:snooze'),
  })
  document.body.append(panel.root)
  registerEnding({ active: panel.active, toTop: panel.toTop })
  // the page is built in idle time (it is only laid out while it is on screen), so the arrival never pays for the DOM
  if ('requestIdleCallback' in window) requestIdleCallback(() => panel.warm(), { timeout: 3000 }); else setTimeout(() => panel.warm(), 1500)

  // ---- #index is gone: its links (the skip link, the Index menu's footer) and a typed #index land on the ending instead
  const skip = document.querySelector<HTMLAnchorElement>('a.skip[href="#index"]')
  if (skip) skip.textContent = 'Skip to the overview and contact'
  addEventListener('click', e => {
    const a = (e.target as Element | null)?.closest?.('a[href="#index"]')
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault(); toEnd()
  })
  if (location.hash.toLowerCase() === '#index') location.hash = '#epilogue'   // fires the nav's own deep-link path (it waits for the curtain to lift)
  addEventListener('hashchange', () => { if (location.hash.toLowerCase() === '#index') toEnd() })
  // Escape backs out to the hub from the ending, as it does from inside an area (a dialog open over it keeps its own Escape)
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented || !panel.active() || document.querySelector('dialog[open]')) return
    e.preventDefault(); nav()?.go?.('world')
  })

  /** how far into the finale: 1 at the dwell, the eased leg progress while flying into it */
  const finOf = (st: FlightState) => (st.dwelling ? (st.wp === LAST ? 1 : 0) : st.next === LAST ? st.t : 0)

  return {
    adjustCam(cam, _dt, st) {
      if (st.dwelling || st.next !== LAST || reducedMotion()) return cam
      // up first, then out: height leads, the sideways drift to the high vantage follows, the gaze tilts down last. The rise starts a long way out
      // (the knight's space, beyond the hall), so the gaze stays on the board while the camera climbs through the cloud, then swings to the ring.
      const A = WAYPOINTS[LAST - 1].cam, B = WAYPOINTS[LAST].cam, t = st.t
      const y = lerp(A.pos[1], B.pos[1], sstep(0, 0.7, t)), hx = sstep(0.2, 1, t)
      const mine = {
        pos: [lerp(A.pos[0], B.pos[0], hx), y, lerp(A.pos[2], B.pos[2], hx)] as [number, number, number],
        target: [lerp(A.target[0], B.target[0], sstep(0.32, 0.98, t)), lerp(A.target[1], B.target[1], sstep(0.32, 0.98, t)), lerp(A.target[2], B.target[2], sstep(0.32, 0.98, t))] as [number, number, number],
      }
      const w = sstep(0, 0.1, t) * (1 - sstep(0.86, 1, t))
      const mix = (a: number[], b: number[]) => a.map((x, i) => x + (b[i] - x) * w) as [number, number, number]
      return { pos: mix(cam.pos, mine.pos), target: mix(cam.target, mine.target), fov: cam.fov }
    },
    update: timed('finale', (t, _dt, st) => {
      const fin = finOf(st), rm = reducedMotion()
      sky.update(t, rm ? (fin > 0.5 ? 1 : 0) : fin, ctx.field.camera.position, -1, rm)
      // the page arrives with the copy: from the last 22% of the leg
      panel.setVis(rm ? (fin > 0.5 ? 1 : 0) : sstep(0.78, 0.96, fin), rm)
    }),
  }
}
