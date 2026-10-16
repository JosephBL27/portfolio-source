// FORM "hold3d": a climbing hold (a bolt-on jug with a finger scoop, crimp lip and side nub), modelled in
// Spline from boolean/subdivision primitives, read back through the HTML bridge and lit per frame as
// surface points. See docs/research/spline.md. Built with the sculpt factory in ./bust.
import type { FormDef } from './types'
import { sculpt } from './bust'

const form: FormDef = sculpt({
  id: 'hold3d',
  url: '/models/hold3d.bin',
  size: 1.7,
  yaw0: -0.22,
  tilt: 0.16,
  sway: 0.3,
  albedo: [0.96, 0.9, 0.78],
  key: [1.0, 0.9, 0.74],
  fill: [0.55, 0.65, 0.95],
  spec: 0.55,
  shine: 34,
  alpha: 0.8,
  pointSize: 2.2,
  camera: { pos: [0, 1.2, 8.8], target: [0, 0, 0] },
})
export default form
