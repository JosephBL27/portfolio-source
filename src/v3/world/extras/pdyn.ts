// v10 particle dynamics glue (unit 6D). Feeds the world's light sources to the particle shader every other frame:
//   * the hub TV's current channel colour tints the particles near the screen (and is the key light of the 'solid' forms)
//   * the live small TVs of the area you are in tint the particles around them
// The engine (engine/field.ts) only knows about 4 lights, hub first; the rest is chosen here: the 3 live TVs nearest the camera.
// Honours ?extras=0 / ?extras=-pdyn.
import type { Extra, ExtraCtx } from '../../main'
import { extraOn, isOn, timed } from './lib/flags'

export function install(ctx: ExtraCtx): Extra | void {
  if (!extraOn('pdyn') || typeof ctx.field?.setLights !== 'function' || typeof ctx.world?.glow !== 'function') return
  const field = ctx.field, world = ctx.world
  let frame = 0, on = true
  const step = () => {
    if (++frame % 2) return
    const all: { position: { x: number; y: number; z: number }; color: unknown; intensity: number; radius: number }[] = world.glow()
    const hub = all.filter(l => l.radius > 12), rest = all.filter(l => l.radius <= 12)
    const c = field.camera.position
    rest.sort((a, b) => Math.hypot(a.position.x - c.x, a.position.y - c.y, a.position.z - c.z) - Math.hypot(b.position.x - c.x, b.position.y - c.y, b.position.z - c.z))
    field.setLights([...hub, ...rest].slice(0, 4))
  }
  const timedStep = timed('pdyn', step)
  return { update() { if (!isOn('pdyn')) { if (on) { on = false; field.setLights([]) } return } on = true; timedStep() } }
}
