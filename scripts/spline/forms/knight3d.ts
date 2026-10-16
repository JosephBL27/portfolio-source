// FORM "knight3d": a polished Staunton knight (Spline-generated mesh -> lit surface points).
// Chess note: Joseph's Chess.com peak is 1750 (src/data). Built with the sculpt factory in ./bust.
import type { FormDef } from './types'
import { sculpt } from './bust'

const form: FormDef = sculpt({
  id: 'knight3d',
  url: '/models/knight3d.bin',
  size: 2.1,
  albedo: [0.96, 0.9, 0.78],
  key: [1.0, 0.92, 0.78],
  spec: 0.95,
  shine: 70,
  sway: 0.38,
  alpha: 0.7,
  pointSize: 2.3,
})
export default form
