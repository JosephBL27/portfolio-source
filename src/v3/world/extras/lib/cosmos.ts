// v20: how much of the flight is "the cosmos": the first two screens (clouds, name) are the sky and nothing else (no hanging TV, no type rings, no floor);
// the TV arrives with the name > world leg and powers on at the world stop. The weights are pure functions of the flight state, so a scrub back is exact.
import type { FlightState } from '../../flight'
import { sstep } from './flags'

/** the flight as a float waypoint index: wp while dwelling, wp + (next - wp) * t on a leg */
export const flightIdx = (st: FlightState) => (st.dwelling || st.next == null ? st.wp : st.wp + (st.next - st.wp) * st.t)
/** 1 at the name stop, 0 at clouds and from the dive on: the Milky Way band is brought up behind the letters only here */
export const nameW = (st: FlightState) => Math.max(0, 1 - Math.abs(flightIdx(st) - 1)) * portraitBoost()
/** portrait phones see a narrow slice of the sky, so the name stop's weight is lifted past 1 (more band and nebula); desktop is exactly 1 */
const portraitBoost = () => (typeof innerWidth === 'number' && innerHeight > innerWidth * 1.1 ? 1.5 : 1)
/** 1 on the clouds and name stops, eased to 0 by idx 1.3 (the TV is fully in by then) */
export const cosmosK = (st: FlightState) => 1 - sstep(1.0, 1.3, flightIdx(st))
