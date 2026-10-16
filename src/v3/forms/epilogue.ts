// FORM "epilogue": a quiet night of stars. The finale (src/v3/world/extras/finale.ts) is a contact page above the ring world and draws the
// lit map with the 'orbits' form (the waypoint uses it); this form is only a sparse star dust, kept so the id stays valid. No text, no Latin.
import type { FormDef } from './types'
import { H } from './ctx'

const form: FormDef = {
  id: 'epilogue',
  async build(ctx, pos, col) {
    const rand = ctx.rand
    for (let i = 0; i < ctx.count; i++) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 14 + 40 * Math.cbrt(rand())
      const b = 0.5 + 0.5 * rand()
      H.set(pos, col, i, Math.cos(th) * s * r, u * r * 0.7, Math.sin(th) * s * r, 0, 0.8 * b, 0.86 * b, 1.0 * b, 0.03 + 0.1 * Math.pow(rand(), 4))
    }
  },
  camera: { pos: [0, 0, 20], target: [0, 0, 0], fov: 36 },
  pointSize: 1.2,
  drift: 0.004,
}
export default form
