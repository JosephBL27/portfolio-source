// The finale's sky: a star shell, a deck of cloud the camera rises through, and a light shaft + glow over each of the six areas.
// Everything is a pure function of (fin, rise, hover) so scrolling back replays it. fin = 0..1 how far into the finale we are.
// The stars, the Milky Way (NASA SVS Deep Star Maps 2020; credit in src/data/credits.json) and the nebulae are no longer drawn here: v17 (unit 13A) moved them to
// extras/astro.ts so the same sky lies behind the whole flight and the finale only turns its level up (gain / bloom of the band, a violet nebula glow, the aurora).
import * as THREE from 'three'
import { AREAS } from '../../layout'

const glowTex = (soft: number) => {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(soft, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
const rnd = (() => { let a = 7 >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } })()
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

export interface Sky {
  group: THREE.Group
  update(t: number, fin: number, cam: THREE.Vector3, hot: number, rm: boolean): void
  dispose(): void
}

export function createSky(phone: boolean): Sky {
  const group = new THREE.Group(); group.visible = false
  // ---- cloud deck: the rise now starts far out beyond the hall (the knight's own space), not above the hub, so the deck is laid around wherever the
  // rise begins (it follows the camera until the finale starts) and the camera climbs up through it, then leaves it behind as it swings over the ring
  const deck = new THREE.Group(); group.add(deck)
  const cloudTex = glowTex(0.35), clouds: THREE.Sprite[] = []
  for (let i = 0; i < (phone ? 18 : 34); i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex, color: new THREE.Color(0.55, 0.62, 0.78), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    const s = new THREE.Sprite(m), a = rnd() * Math.PI * 2, r = 70 * Math.sqrt(rnd())
    s.position.set(Math.cos(a) * r, 10 + rnd() * 8, Math.sin(a) * r); s.scale.setScalar(46 + rnd() * 46); s.userData.base = 0.13 + rnd() * 0.16; s.userData.ph = rnd() * 10
    clouds.push(s); deck.add(s)
  }

  // ---- beacons: glow + shaft per area
  const glow = glowTex(0.2)
  const beacons = AREAS.map(a => {
    const col = new THREE.Color(a.accent)
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    spr.position.set(a.center[0], a.center[1], a.center[2])
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.5, 34, 10, 1, true),
      new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uC: { value: col }, uO: { value: 0 } },
        vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 uC; uniform float uO; varying float vY; void main(){ float a = pow(1.0 - vY, 1.6) * uO; gl_FragColor = vec4(uC * a, a); }' }))
    shaft.position.set(a.center[0], a.center[1] + 17, a.center[2])
    group.add(spr, shaft)
    return { spr, shaft, ph: rnd() * 6 }
  })

  return {
    group,
    update(t, fin, cam, hot, rm) {
      group.visible = fin > 0.001
      if (fin < 0.03) deck.position.set(cam.x, 0, cam.z)   // not in the finale yet: the deck waits under the camera
      if (!group.visible) return
      const camY = cam.y
      const g = Math.exp(-(((camY - 14) / 9) ** 2)) * (fin < 1 ? 1 : 0.0)
      // the deck is invisible (g = 0) once the camera has climbed out of it; hidden sprites skip the huge additive overdraw that held the finale at ~20 fps
      deck.visible = g > 0.002
      if (deck.visible) for (const c of clouds) (c.material as THREE.SpriteMaterial).opacity = c.userData.base * g * (0.8 + 0.2 * Math.sin(t * 0.3 + c.userData.ph))
      const lit = sstep(0.45, 1, fin)
      beacons.forEach((b, i) => {
        const on = hot === i, pulse = rm ? 1 : 0.85 + 0.15 * Math.sin(t * 1.4 + b.ph)
        const k = lit * (on ? 1.9 : 1) * pulse
        ;(b.spr.material as THREE.SpriteMaterial).opacity = 0.55 * Math.min(1, k)
        b.spr.scale.setScalar((on ? 13 : 8.5) * (0.6 + 0.4 * lit) * pulse)
        ;(b.shaft.material as THREE.ShaderMaterial).uniforms.uO.value = 0.16 * k
      })
    },
    dispose() {
      group.removeFromParent(); cloudTex.dispose(); glow.dispose()
    },
  }
}
