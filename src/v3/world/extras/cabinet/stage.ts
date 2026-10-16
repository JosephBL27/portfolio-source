// The contract between the cabinet manager (../cabinet.ts) and one object stage (chess, turntable, game table, climbing wall, guitar).
import type * as THREE from 'three'
import type { FlightState } from '../../flight'
import type { Kit } from './kit'

export interface Stage {
  /** waypoint id this stage owns (layout.ts) */
  id: string
  /** everything the stage draws; placed at the waypoint's place by the manager, hidden until the stage is present */
  root: THREE.Group
  /** a size multiplier on top of the waypoint's place.scale (a stage that reads small from its camera: the game table) */
  scale?: number
  /** particle alpha while the stage is fully present (the lowest request per frame wins, main.ts) */
  dim: number
  /** create geometry and materials (the manager calls it once, shortly before the waypoint is reached; may bake textures) */
  build(kit: Kit): void | Promise<void>
  /** every frame the stage is present. r: 0..1 presence (rises while the camera arrives, falls as it leaves: a pure function of the flight);
   *  dwell: standing at the waypoint; t: seconds; st: the flight state */
  update(t: number, dt: number, r: number, dwell: boolean, st: FlightState): void
  /** invisible proxies the pointer can hit (hover / press) */
  pick?: THREE.Object3D[]
  hover?(o: THREE.Object3D | null): void
  press?(o: THREE.Object3D | null): void
  /** one accessible action (the manager exposes each as a hidden, focusable button): returns the sentence the live region should say */
  act?(name: string): string
  /** a one-shot idle demonstration, played 3 s after arrival if the visitor has not touched the stage yet */
  demo?(): void
  /** a debug / test handle published on window.__cab[id] */
  api?: Record<string, unknown>
  dispose(): void
}
