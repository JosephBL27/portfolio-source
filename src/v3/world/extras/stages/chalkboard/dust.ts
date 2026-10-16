// Chalk dust: powder shaken loose where the stick touches the slate (a puff as each stroke lands, a trickle along it) and where the felt eraser drags. It
// drifts sideways on a slow draught, sinks, and gathers in the groove at the foot of the slate (the top of the bottom rail) or, from the eraser, on the ledge,
// where it stays a while as a faint dusting. One Points object (one draw call), a fixed pool, positions in the board's own frame (x right, y up, z out of
// the slate). The size is set in screen pixels by the stage (px()); each speck has its own scale, so a puff is a few crisp grains and a few soft ones.
import * as THREE from 'three'
import { lit } from '../common'
import { mulberry32 } from './hand'

const N = 560
let speckTex: THREE.CanvasTexture | null = null
/** a small round grain with a firm core and a soft rim (a gaussian halo is too faint to read at 4 px) */
function speckTexture() {
  if (speckTex) return speckTex
  const c = document.createElement('canvas'); c.width = c.height = 32
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32)
  speckTex = new THREE.CanvasTexture(c); speckTex.colorSpace = THREE.SRGBColorSpace
  return speckTex
}

export class Dust {
  readonly points: THREE.Points
  private pos: Float32Array
  private col: Float32Array
  private scl: Float32Array
  private vel: Float32Array
  private life: Float32Array
  private fall: Float32Array
  private settled: Uint8Array
  private next = 0
  private rnd = mulberry32(29)
  private geo: THREE.BufferGeometry
  private mat: THREE.PointsMaterial
  private idle = true
  /** groove: the top of the bottom rail (y) where dust on the slate settles (z between the slate and the rail's front); ledge: the top of the chalk ledge and the
   *  z range it covers, where dust that came off in front of the rail lands */
  constructor(private groove: { y: number; z0: number; z1: number }, private ledge: { y: number; z0: number; z1: number }) {
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 4); this.vel = new Float32Array(N * 3); this.scl = new Float32Array(N).fill(1)
    this.life = new Float32Array(N); this.fall = new Float32Array(N); this.settled = new Uint8Array(N)
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.scl, 1).setUsage(THREE.DynamicDrawUsage))
    this.mat = lit(new THREE.PointsMaterial({ size: 0.02, map: speckTexture(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, toneMapped: false }), 'cb-dust2', sh => {
      sh.vertexShader = sh.vertexShader.replace('uniform float size;', 'uniform float size;\nattribute float aSize;').replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;')
    })
    this.points = new THREE.Points(this.geo, this.mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 2
  }
  /** the size of a speck of scale 1, in view-space units (the stage turns pixels into this every frame) */
  setSize(s: number) { this.mat.size = s }
  private spawn(x: number, y: number, z: number, rgb: [number, number, number], a0: number, s: number, vx: number, vy: number, vz: number, life: number, fall = 0) {
    const i = this.next; this.next = (this.next + 1) % N
    const j = i * 3, r = this.rnd
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z
    this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz
    this.life[i] = life; this.settled[i] = 0; this.scl[i] = s
    this.fall[i] = fall || (0.11 + 0.12 * r() + 0.03 * s)   // terminal speed, board units per second: bigger grains sink faster
    this.col[i * 4] = rgb[0] / 255; this.col[i * 4 + 1] = rgb[1] / 255; this.col[i * 4 + 2] = rgb[2] / 255; this.col[i * 4 + 3] = a0
    this.idle = false
  }
  /** a trickle: n grains shaken loose at board point (x, y) on the slate (z = the slate face); now and then a heavy one that drops straight to the groove */
  emit(x: number, y: number, z: number, n: number, rgb: [number, number, number]) {
    const r = this.rnd
    for (let k = 0; k < n; k++) {
      const heavy = r() < 0.1, drift = !heavy && r() < 0.14
      const s = heavy ? 1.1 + r() * 0.5 : 0.78 + r() * r() * 0.75
      // a drifter leaves the slate's pocket and falls in front of the rail to the ledge, where it joins the faint line of dust that gathers there
      this.spawn(x + (r() - 0.5) * 0.02, y + (r() - 0.5) * 0.016, z + 0.001 + r() * 0.008, rgb, heavy ? 0.5 + r() * 0.2 : 0.4 + r() * 0.4, s,
        (r() - 0.5) * 0.04, -0.01 - r() * 0.03, drift ? 0.075 + r() * 0.04 : 0.002 + r() * 0.01, heavy ? 7.5 : drift ? 8 + r() * 2 : 3 + r() * 2.5, heavy ? 0.42 + r() * 0.16 : drift ? 0.3 + r() * 0.16 : 0)
    }
  }
  /** a puff: n grains thrown off at once (a stroke landing, the eraser dragging), more spread and a lift before they sink; `fine` < 1 makes smaller, fainter, shorter-lived grains */
  puff(x: number, y: number, z: number, n: number, rgb: [number, number, number], spread = 1, fine = 1) {
    const r = this.rnd
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, sp = (0.03 + r() * 0.08) * spread, s = (0.8 + r() * r() * 0.85) * fine
      this.spawn(x + (r() - 0.5) * 0.03, y + (r() - 0.5) * 0.02, z + 0.002 + r() * 0.012, rgb, (0.45 + r() * 0.4) * Math.min(1, fine + 0.25), s, Math.cos(a) * sp, Math.sin(a) * sp * 0.7 + 0.025, (r() - 0.3) * 0.02, (3.2 + r() * 2.4) * (0.5 + 0.5 * fine))
    }
  }
  /** step the grains: a slow draught, a sink to a terminal speed with a little flutter; on a floor they stop and fade slowly */
  step(dt: number, t: number) {
    if (this.idle) return
    let live = false
    const drag = Math.exp(-2.3 * dt), sink = 1 - Math.exp(-1.6 * dt), g = this.groove, l = this.ledge
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) continue
      live = true
      this.life[i] -= dt
      const j = i * 3
      if (!this.settled[i]) {
        const wind = Math.sin(t * 0.55 + this.pos[j + 1] * 2.4 + i * 0.37) * 0.016 + Math.sin(t * 2.7 + i * 1.7) * 0.01
        this.vel[j] = this.vel[j] * drag + wind * (1 - drag)
        this.vel[j + 1] += (-this.fall[i] - this.vel[j + 1]) * sink
        this.vel[j + 2] *= drag
        this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt
        const z = this.pos[j + 2]
        if (z <= g.z1) {
          // on the slate's face: it cannot go into the slate or out through the rail's front
          if (z < g.z0) this.pos[j + 2] = g.z0
          if (this.pos[j + 1] <= g.y) { this.pos[j + 1] = g.y + 0.002 + this.rnd() * 0.004; this.settled[i] = 1; this.life[i] = Math.max(this.life[i], 11 + this.rnd() * 7) }
        } else if (z <= l.z1 && this.pos[j + 1] <= l.y && this.pos[j + 2] >= l.z0) {
          this.pos[j + 1] = l.y + 0.002; this.settled[i] = 1; this.life[i] = Math.max(this.life[i], 11 + this.rnd() * 7)
        } else if (this.pos[j + 1] < l.y - 0.5) this.life[i] = 0
      }
      const fade = Math.min(1, this.life[i] / (this.settled[i] ? 3 : 1.4))
      const a = this.col[i * 4 + 3]
      this.col[i * 4 + 3] = this.life[i] <= 0 ? 0 : Math.min(a, (this.settled[i] ? 0.5 : 0.8) * fade)
    }
    ;(this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true
    this.points.visible = live
    this.idle = !live
  }
  clear() { this.life.fill(0); this.col.fill(0); this.points.visible = false; this.idle = true }
  /** the live grain count (for the probes) */
  count() { let n = 0; for (let i = 0; i < N; i++) if (this.life[i] > 0 && this.col[i * 4 + 3] > 0.05) n++; return n }
  dispose() { this.geo.dispose(); this.mat.dispose() }
}
