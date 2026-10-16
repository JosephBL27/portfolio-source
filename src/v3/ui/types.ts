// Shared types for the v4 UI layer.
// FlightState is what main feeds in every frame (from src/v3/world/flight.ts). Only the three overlay
// fields are required; everything else is optional and makes the HUD richer when present.
export interface FlightState {
  /** overlay id of the waypoint the camera is leaving (or resting at) */
  overlay: string
  /** overlay id of the waypoint it is flying to (equals `overlay` while dwelling) */
  overlayNext: string
  /** 0..1 progress along the current leg after easing: outgoing copy leaves 0..0.30, incoming arrives 0.78..0.96 */
  overlayK: number
  /** index into WAYPOINTS of the waypoint being left / rested at (flight.ts); `next` is the one being flown to */
  wp?: number
  next?: number
  /** the follower's smoothed overall progress 0..1 (flight.ts `p`), used for the rail and the readout */
  p?: number
  /** area id of the dominant waypoint (optional; derived from the overlay id when absent) */
  area?: string
  /** normalised camera speed, 0 at rest and about 1 at cruise (optional) */
  speed?: number
  /** the form on screen, for the HUD readout (optional) */
  form?: string
}

/** a projected label that main supplies for a lit TV (screen-space CSS px) */
export interface AnchorIn { id: string; label: string; x: number; y: number; visible: boolean }

export type Vec3 = [number, number, number]
