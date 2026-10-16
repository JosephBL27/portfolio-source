// FORM "turntable3d": a record turntable with an LP, authored in Spline (primitives, 32 parts),
// read back through the HTML bridge and lit per frame as surface points. See docs/research/spline.md.
// Authored procedurally in Spline (run_code primitives) because generate_3d_model timed out on the first try.
import type { FormDef } from './types'
import { sculpt } from './bust'

const form: FormDef = sculpt({
  id: 'turntable3d',
  url: '/models/turntable3d.bin',
  size: 2.25,
  tilt: 0.5,
  offset: [0, -0.15, 0],
  albedo: [0.96, 0.9, 0.78],
  key: [1.0, 0.9, 0.74],
  fill: [0.55, 0.65, 0.95],
  spec: 0.6,
  shine: 40,
  sway: 0.28,
  alpha: 0.85,
  pointSize: 2.2,
  camera: { pos: [0, 2.9, 8.6], target: [0, -0.1, 0] },
})
export default form
