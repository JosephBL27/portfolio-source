// Small shared props of the cabinet: the round display pedestal every stage but the chess table stands on, and a warm pool of light.
import * as THREE from 'three'
import { lathe, profile, type LP } from './lathe'
import { D, glowTexture } from './kit'

const S = 1
/** a round gallery pedestal: top plane at y = 0, `radius` wide, dark glossy metal with a brass inlay ring and a pool of warm light on it */
export function pedestal(env: THREE.Texture, radius: number, depth = 0.34): THREE.Group {
  const g = new THREE.Group(); g.name = 'pedestal'
  const ctrl: LP[] = [[0, -depth, S], [radius - 0.06, -depth, S], [radius, -depth + 0.08, S], [radius, -0.1, S], [radius - 0.04, -0.03], [radius - 0.1, 0, S], [0, 0, S]]
  const body = new THREE.Mesh(lathe(profile(ctrl, 8), 96), new THREE.MeshStandardMaterial({ color: D(0.04, 0.035, 0.032), metalness: 0.85, roughness: 0.26, envMap: env, envMapIntensity: 1.5 }))
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.22, 0.02, 8, 120), new THREE.MeshStandardMaterial({ color: D(0.86, 0.66, 0.34), metalness: 1, roughness: 0.26, envMap: env, envMapIntensity: 1.8 }))
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.002
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(1, 0.72, 0.4), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  pool.rotation.x = -Math.PI / 2; pool.scale.setScalar(radius * 2.1); pool.position.y = 0.006; pool.renderOrder = 2
  g.add(body, ring, pool)
  return g
}

/** a flat additive halo billboard-free disc (for lit labels, hover rings): lies on the xz plane of its parent */
export function halo(size: number, rgb: [number, number, number], opacity = 0.6): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(...rgb), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  m.rotation.x = -Math.PI / 2; m.scale.setScalar(size); m.renderOrder = 3
  return m
}

/** value noise in 3D (for bumpy resin / wood displacement), deterministic */
const h3 = (x: number, y: number, z: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s) }
export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(l(l(h3(ix, iy, iz), h3(ix + 1, iy, iz), u), l(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), u), v), l(l(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), u), l(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), u), v), w)
}
export const fbm3d = (x: number, y: number, z: number, oct = 3) => { let a = 0.5, s = 0, f = 1; for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5 } return s }
