// Reference form (and the engine's fallback): a breathing ivory sphere with a vermilion core.
import type { FormDef } from './types'
import { H } from './ctx'
const form: FormDef = {
  id: 'sphere',
  build(ctx, pos, col) {
    const n = ctx.count
    for (let i = 0; i < n; i++) {
      const u = ctx.rand() * 2 - 1, th = ctx.rand() * Math.PI * 2, s = Math.sqrt(1 - u * u)
      const core = i < n * 0.08
      const r = core ? 0.35 * Math.cbrt(ctx.rand()) : 1.6 + (ctx.rand() - 0.5) * 0.04
      const c = core ? H.hex('#FF4A2B') : H.hex('#EDE6D6')
      H.set(pos, col, i, Math.cos(th) * s * r, u * r, Math.sin(th) * s * r, 0, c[0], c[1], c[2], core ? 0.9 : 0.35)
    }
  },
  glsl: /* glsl */ `
vec3 anim_sphere(vec3 p, vec4 d, vec4 r, float t) { return p * (1.0 + 0.03 * sin(t * 1.3 + r.x * 6.28)); }`,
  camera: { pos: [0, 0, 7], target: [0, 0, 0] },
}
export default form
