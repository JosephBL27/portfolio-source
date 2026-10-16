// The copy lane: the side of the screen opposite the subject (layout.ts `frame`), where the overlay's title and body sit.
// Atmosphere effects mask themselves out of it. u = (side: -1 copy left / +1 copy right / 0 centred, edge, ramp, portrait 0/1);
// in a shader: `u = nd.x * -sign(side); mask = smoothstep(edge, edge + ramp, u)` (nd = gl_FragCoord / resolution * 2 - 1).
import * as THREE from 'three'
import { WAYPOINTS } from '../../layout'
import { HOLES_GLSL } from '../../occlusion'
import type { FlightState } from '../../flight'

export const laneSideOf = (wi: number) => {
  const w = WAYPOINTS[Math.max(0, Math.min(WAYPOINTS.length - 1, wi))]
  if (w.frame && Math.abs(w.frame[0]) > 0.05) return w.frame[0] > 0 ? -1 : 1
  return w.id === 'epilogue' ? -1 : 0
}

export class Lane {
  readonly u = new THREE.Vector4(0, -0.3, 0.34, 0)
  /** debugging / measurement: ignore the lane */
  off = false
  private side = 0
  update(st: FlightState, dt: number) {
    const vw = innerWidth, vh = innerHeight, aspect = vw / Math.max(1, vh)
    const li = st.dwelling ? st.wp : st.t < 0.5 ? st.wp : st.next
    this.side += (laneSideOf(li) - this.side) * (1 - Math.exp(-dt / 0.2))
    const laneW = Math.min(Math.max(vw * 0.31, 380), 560) + Math.max(24, vw * 0.03) + 70
    const portrait = aspect < 0.9 && !this.off
    this.u.set(this.off ? 0 : this.side, Math.min(0.1, -1 + (2 * laneW) / vw), 0.34, portrait ? 1 : 0)
    return this.u
  }
}

/** shared on/off for the lane mask: the mirror switches it off while it draws the reflection (screen coordinates mean something else there) */
export const LANE_ON = { value: 1 }
/** GLSL: `uniform vec4 uLane; uniform vec2 uRes; uniform float uLaneOn;` and `float laneMask()` = 0 inside the copy lane, 1 on the free side */
export const LANE_GLSL = /* glsl */ `
uniform vec4 uLane; uniform vec2 uRes; uniform float uLaneOn;
${HOLES_GLSL}
float laneMask() {
  vec2 nd = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  float m = 1.0;
  if (uLane.w > 0.5) m = smoothstep(-0.34, -0.04, nd.y) * (1.0 - smoothstep(0.5, 0.76, nd.y));
  else if (abs(uLane.x) > 0.001) { float u = nd.x * -sign(uLane.x); m = mix(1.0, smoothstep(uLane.y, uLane.y + uLane.z, u), abs(uLane.x)); }
  // v11: and nothing glows inside the subject's bounds or a copy box (occlusion.ts zones); off with the lane in the reflection pass
  return mix(1.0, m * holeMask(gl_FragCoord.xy / uRes), uLaneOn);
}`
