// UNIT 15R: the signal bus. One small module that every background effect can read and a few write, so the effects visibly influence each other
// instead of each living on its own clock. reactive.ts (extras/) is the producer: once per frame it measures the pointer, the flight, the hub TV,
// the music and the brain, and writes the numbers into `U` (shared uniform objects: put the same object in any ShaderMaterial and it follows) and
// `S` (plain state for CPU consumers). Effects that detect something themselves (the shooting star in astro/stars.ts) write it into `S` directly.
//
//   pointer    -> particles lean toward it and are dragged along it (compose.ts), stars lens toward it (stars.ts), star streaks bend (warp.ts),
//                 the nebula it passes over lights up (sky.ts)
//   flight     -> stars fan out around the heading (stars.ts), the background equations stretch (glyphs.ts), the nebula flow speeds up (sky.ts)
//   hub TV     -> its channel colour tints the nebula (sky.ts), the ground haze and the hub light cone (haze/*)
//   music      -> bass swells the particle cloud and sends a ring across it from the hub (compose.ts), the same beat lifts the nebula, runs along
//                 the constellation lines and kicks the rings (sky.ts, constellations.ts, rings.ts); mids breathe the equations (glyphs.ts)
//   brain      -> a pulse event sends a bright run along every constellation line (constellations.ts)
//   shooting star -> flares the constellation it passes and shimmers the equations under it (constellations.ts, glyphs.ts)
//   morph      -> the nebula billows faster while the particles are in flight (sky.ts)
// Everything is zero by default, so a module that reads the bus with no producer installed behaves exactly as before. Reduced motion: the producer
// only drives the TV colour tint (colour, no motion).
import * as THREE from 'three'

const v4 = (x = 0, y = 0, z = 0, w = 0) => ({ value: new THREE.Vector4(x, y, z, w) })

/** shared uniform objects: reference them (same object) from any ShaderMaterial that declares the uniform */
export const U = {
  /** xyz = world ray direction from the camera through the pointer, w = presence 0..1 (0 = no pointer effect) */
  uSgPtr: v4(0, 0, -1, 0),
  /** camera-space pointer for view-space shaders: xy = ndc * tan(half fov) per axis (so xy * depth is the view-space point), z = presence */
  uSgPtrC: v4(0, 0, 0, 0),
  /** camera position (world) */
  uSgRo: { value: new THREE.Vector3() },
  /** pointer motion as a world-space vector (camera right/up * ndc speed), roughly 0..1 long */
  uSgPv: { value: new THREE.Vector3() },
  /** the pointer's light colour */
  uSgPcol: { value: new THREE.Vector3(0.62, 0.78, 1.0) },
  /** flight heading (world unit vector) in xyz, w = how fast we fly 0..0.4 (relativistic-style fan-out strength) */
  uSgHead: v4(0, 0, -1, 0),
  /** hub TV: xyz = channel hue (brightest channel = 1), w = amount 0..1 (power * how coloured) */
  uSgTv: v4(1, 1, 1, 0),
  /** music: bass, mid, high, level (0..1, smoothed) */
  uSgMus: v4(),
  /** the song's own colour (rgb) */
  uSgMc: { value: new THREE.Vector3(0.7, 0.8, 1) },
  /** beat ripple: x = phase 0..1 since the last hit, y = amplitude (decays), z/w unused */
  uSgRip: v4(1, 0, 0, 0),
  /** brain / morph: x = pulse run position 0..1.3, y = pulse envelope, z = particle morph in flight 0..1, w = TV channel-change kick */
  uSgBr: v4(),
  /** shimmer: xy = shooting star head in ndc, z = radius (ndc height units), w = amplitude */
  uSgShim: v4(0, 0, 0.3, 0),
  /** accumulated flow phase (never goes backwards: speeds the sky's billow without a jump) */
  uSgFlow: { value: 0 },
}

/** plain state for CPU consumers (and window.__sig for QA) */
export const S = {
  /** the producer (extras/reactive.ts) is installed and running */
  live: false,
  /** shooting star: written by astro/stars.ts while one flies */
  shoot: { on: false, env: 0, dir: new THREE.Vector3(0, 0, -1) },
  /** per-constellation flare 0..1 (AREAS order): written by reactive.ts when the shooting star passes over one */
  flare: new Float32Array(8),
  /** flight speed 0..1 (real camera speed, smoothed) */
  speed: 0,
  /** music playing */
  music: false,
  /** hub TV is on */
  tvOn: 0,
}
