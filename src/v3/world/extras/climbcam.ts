// The climb at the "hold" stop (w23): while the climber in cabinet/boulder.ts is on the problem the camera zooms in on her; when she sends the V8 it pulls back and
// rises over the forest, then returns.
// The stage animates window.__holdCam.k and .near (0..1, anime.js, eased); this extra only bends the flight's pose by them, and only while the flight stands at "hold".
// Runs before pov.ts in the adjustCam chain (glob order), so the look-around still works on top. Reduced motion: the stage never raises k. ?extras=-climbcam switches it off.
import type { Extra, ExtraCtx } from '../../main'
import { WAYPOINTS } from '../layout'

export function install(ctx: ExtraCtx): Extra | void {
  const holdI = WAYPOINTS.findIndex(w => w.id === 'hold')
  if (holdI < 0) return
  return {
    adjustCam(cam, _dt, st) {
      const hc = (window as unknown as { __holdCam?: { k: number; near?: number; fy?: number } }).__holdCam, k = hc?.k ?? 0, near = hc?.near ?? 0
      if ((k <= 1e-4 && near <= 1e-4) || !st.dwelling || st.wp !== holdI || !ctx) return cam
      const [px, py, pz] = cam.pos, [tx, ty, tz] = cam.target
      // the lean-in is a ZOOM from the same eye (the backdrop is projected from the eye: a dolly would re-project the photograph's floor and smear it), and the aim follows
      // the climber's height (fy, world y, published by the stage) so she stays in frame; the send pulls the eye back and up over the forest
      const fy = hc?.fy ?? ty, aimY = ty + (fy - ty) * 0.75 * near
      const back = 1 + 0.6 * k
      return { ...cam, fov: cam.fov * (1 - 0.3 * near), pos: [tx + (px - tx) * back, py + 2.4 * k, tz + (pz - tz) * back] as typeof cam.pos, target: [tx, aimY + 0.9 * k, tz] as typeof cam.target }
    },
  }
}
