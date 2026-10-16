// STAGE "meeple": wooden meeples, dice, cubes and tokens tumble onto a round game table with a hex-tile map, driven by a small rigid-body integrator.
//   * every body is a box for the physics (8 corner contacts against the table plane, sequential impulses with friction and restitution, a circular
//     rim, bounding-circle push-apart between bodies, sleeping), a meeple / die / cube / coin for the eye
//   * they drop one after another when the stage arrives, settle, and every few seconds a die is flicked up and rolls again; press any piece to toss it
//   * soft contact shadows (an instanced blob per body that widens and fades with height)
//   * hover any piece and a ring lights under it; click a die and ALL the dice are thrown (a hard flick, they tumble, bounce off the rim and settle), then a plate
//     above the table reads the faces that ended up on top; click a meeple or a token and it is flipped up on its own
// Reduced motion: the pieces are simulated to rest before the first frame and stay put.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { FlightState } from '../../flight'
import { sharedEnv } from '../env'
import { bake, canvasTex, D, disposeTree, enter, makeBlobs, rng, setBlob, precompile, type Kit } from './kit'
import { lathe, profile, type LP } from './lathe'
import type { Stage } from './stage'
import { stamp } from '../spaces/games-fx'

const G = 24, DT = 1 / 120
const TABLE_R = 3.25, FELT_R = 3.0, PLAY_R = 2.72, TOP_Y = 0.34

interface Body {
  kind: 'meeple' | 'die' | 'cube' | 'coin'
  p: THREE.Vector3; q: THREE.Quaternion; v: THREE.Vector3; w: THREE.Vector3
  m: number; h: THREE.Vector3; invI: THREE.Vector3; rad: number
  group: THREE.Group; sleep: number; delay: number; live: boolean; maxY: number
}
const _R = new THREE.Matrix4(), _M = new THREE.Matrix3()
const e3 = new THREE.Vector3(), r3 = new THREE.Vector3(), n3 = new THREE.Vector3(), t3 = new THREE.Vector3(), c3 = new THREE.Vector3(), a3 = new THREE.Vector3(), b3 = new THREE.Vector3()
const CORNERS: [number, number, number][] = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]]
/** world-frame inverse inertia times a vector: R diag(invI) R^T x */
function mulInvI(b: Body, x: THREE.Vector3, out: THREE.Vector3) {
  _R.makeRotationFromQuaternion(b.q); _M.setFromMatrix4(_R)
  const m = _M.elements   // column-major
  // y = R^T x
  const y0 = m[0] * x.x + m[1] * x.y + m[2] * x.z, y1 = m[3] * x.x + m[4] * x.y + m[5] * x.z, y2 = m[6] * x.x + m[7] * x.y + m[8] * x.z
  const z0 = y0 * b.invI.x, z1 = y1 * b.invI.y, z2 = y2 * b.invI.z
  return out.set(m[0] * z0 + m[3] * z1 + m[6] * z2, m[1] * z0 + m[4] * z1 + m[7] * z2, m[2] * z0 + m[5] * z1 + m[8] * z2)
}

function step(b: Body, dt: number) {
  b.v.y -= G * dt
  b.v.multiplyScalar(1 - 0.05 * dt); b.w.multiplyScalar(1 - 0.5 * dt)
  b.p.addScaledVector(b.v, dt)
  // q += 0.5 * (w, 0) * q * dt
  const q = b.q, w = b.w, hx = w.x * dt * 0.5, hy = w.y * dt * 0.5, hz = w.z * dt * 0.5
  const nx = q.x + hx * q.w + hy * q.z - hz * q.y, ny = q.y + hy * q.w + hz * q.x - hx * q.z, nz = q.z + hz * q.w + hx * q.y - hy * q.x, nw = q.w - hx * q.x - hy * q.y - hz * q.z
  q.set(nx, ny, nz, nw).normalize()
  // ---- the table plane (y = 0), up to four impulse passes over the corners that are below it
  let hit = false
  for (let it = 0; it < 4; it++) {
    for (const cn of CORNERS) {
      r3.set(cn[0] * b.h.x, cn[1] * b.h.y, cn[2] * b.h.z).applyQuaternion(q)
      if (b.p.y + r3.y > 0.0005) continue
      hit = true
      c3.copy(w).cross(r3).add(b.v)                               // point velocity
      const vn = c3.y
      if (vn >= 0) continue
      n3.set(0, 1, 0)
      e3.copy(r3).cross(n3); mulInvI(b, e3, a3)                  // I^-1 (r x n)
      b3.copy(a3).cross(r3)
      const denom = 1 / b.m + b3.y
      const e = -vn > 2.2 ? 0.34 : 0
      const j = -(1 + e) * vn / denom
      b.v.y += j / b.m; w.addScaledVector(a3, j)
      // friction
      t3.set(c3.x, 0, c3.z); const vt = t3.length()
      if (vt > 1e-5) {
        t3.multiplyScalar(1 / vt)
        e3.copy(r3).cross(t3); mulInvI(b, e3, a3); b3.copy(a3).cross(r3)
        let jt = -vt / (1 / b.m + b3.dot(t3)); const lim = 0.55 * j; jt = Math.max(-lim, Math.min(lim, jt))
        b.v.addScaledVector(t3, jt / b.m); w.addScaledVector(a3, jt)
      }
    }
  }
  // penetration: lift the lowest corner onto the plane
  let low = 1e9
  for (const cn of CORNERS) { r3.set(cn[0] * b.h.x, cn[1] * b.h.y, cn[2] * b.h.z).applyQuaternion(q); low = Math.min(low, b.p.y + r3.y) }
  if (low < 0) b.p.y -= low
  if (hit) { w.multiplyScalar(1 - 1.6 * dt); b.v.x *= 1 - 0.9 * dt; b.v.z *= 1 - 0.9 * dt }
}

export function createMeeples(): Stage {
  const root = new THREE.Group(); root.name = 'cab-meeple'; root.userData.contactShadow = { size: 5, opacity: 0.5 }
  const pick: THREE.Object3D[] = []
  const bodies: Body[] = []
  let kit: Kit, built = false, blobs: THREE.InstancedMesh, table: THREE.Group
  let ringM: THREE.Mesh, ringMat: THREE.MeshBasicMaterial, hoverB: Body | null = null, hoverK = 0, readout: THREE.Sprite, readTex: THREE.CanvasTexture, readG: CanvasRenderingContext2D
  let reading = false, readT = -9, wallT = 0, lastTick = 0, rolled = false
  let acc = 0, tDwell = 0, wasPresent = false, dropped = false, nextRoll = 6.5
  const rand = rng(0x6a3e)
  const order: Body[] = []

  const meepleShape = () => {
    const R: [number, number][] = [[0, 0.8], [0.11, 0.78], [0.155, 0.7], [0.13, 0.62], [0.09, 0.575], [0.16, 0.545], [0.3, 0.5], [0.385, 0.44], [0.39, 0.37], [0.32, 0.335], [0.2, 0.36], [0.155, 0.3], [0.17, 0.2], [0.205, 0.12], [0.245, 0.02], [0.2, -0.005], [0.1, 0.0], [0.05, 0.1], [0, 0.14]]
    const pts: THREE.Vector2[] = []
    for (const [x, y] of R) pts.push(new THREE.Vector2(x, y))
    for (let i = R.length - 2; i >= 1; i--) pts.push(new THREE.Vector2(-R[i][0], R[i][1]))
    const sm = new THREE.SplineCurve([...pts, pts[0]]).getPoints(150)
    return new THREE.Shape(sm)
  }

  async function build(k: Kit) {
    kit = k
    const env = sharedEnv(k.renderer)
    const grain = bake(k.renderer, 512, 512, `void main() { vec3 c = wood(vec2(vUv.x * 2.0, vUv.y * 6.0), vec3(1.0, 0.98, 0.94), vec3(0.84, 0.78, 0.7), 4.0, 1.7); gl_FragColor = vec4(c, 1.0); }`)
    const felt = bake(k.renderer, 1024, 1024, `void main() { vec2 q = (vUv - 0.5) * 6.0; vec3 c = wood(vec2(q.x, q.y * 1.6), vec3(0.2, 0.1, 0.055), vec3(0.4, 0.21, 0.1), 5.0, 6.0); gl_FragColor = vec4(c, 1.0); }`)
    const mapTex = canvasTex(1024, 1024, (g, w, h) => {
      const c = w / 2, r = rng(11)
      g.fillStyle = '#1b3358'; g.fillRect(0, 0, w, h)
      g.strokeStyle = 'rgba(160,200,235,0.18)'; g.lineWidth = 2
      for (let i = 0; i < 26; i++) { const yy = (i / 26) * h; g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, yy + Math.sin(x * 0.03 + i) * 5); g.stroke() }
      const HR = 64
      const pal = ['#5f8a3a', '#d6b24a', '#b5502d', '#7d7d86', '#8fbf5a', '#e3cf9a', '#3f6f3a', '#b5502d', '#d6b24a', '#5f8a3a']
      const cells: [number, number, string][] = []
      for (let q = -3; q <= 3; q++) for (let rr = -3; rr <= 3; rr++) {
        if (Math.abs(q + rr) > 3) continue
        const x = c + HR * Math.sqrt(3) * (q + rr / 2) * 1.0, y = c + HR * 1.5 * rr
        const col = pal[Math.floor(r() * pal.length)]
        cells.push([x, y, col])
        g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; g.lineTo(x + (HR - 3) * Math.cos(a), y + (HR - 3) * Math.sin(a)) } g.closePath()
        g.fillStyle = col; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(20,14,8,0.55)'; g.stroke()
        g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(x - HR * 0.8, y - HR * 0.42); g.lineTo(x, y - HR * 0.86); g.lineTo(x + HR * 0.8, y - HR * 0.42); g.stroke()
        for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(0,0,0,${(0.04 + r() * 0.07).toFixed(2)})`; g.fillRect(x + (r() - 0.5) * HR * 1.4, y + (r() - 0.5) * HR * 1.3, 3 + r() * 6, 3 + r() * 6) }
      }
      // number tokens (pips only: a cream disc with dots)
      for (const [x, y] of cells) { if (r() < 0.45) continue; g.fillStyle = '#efe3c3'; g.beginPath(); g.arc(x, y, 21, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(60,40,20,0.7)'; g.lineWidth = 2; g.stroke()
        const n = 1 + Math.floor(r() * 5); g.fillStyle = n >= 4 ? '#a02a1a' : '#2a1b10'; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(x + (i - (n - 1) / 2) * 7, y + 2, 2.4, 0, Math.PI * 2); g.fill() } }
      // the frame of the map
      g.lineWidth = 10; g.strokeStyle = 'rgba(240,215,160,0.5)'; g.beginPath(); g.arc(c, c, c - 14, 0, Math.PI * 2); g.stroke()
    })

    // ---- the table: a turned walnut body with a raised rim and the printed map inside
    table = new THREE.Group()
    const tp: LP[] = [[0, 0, 1], [TABLE_R - 0.1, 0, 1], [TABLE_R, 0.08, 1], [TABLE_R, 0.34], [TABLE_R - 0.05, 0.46, 1], [FELT_R + 0.02, 0.46, 1], [FELT_R, 0.343, 1], [0, 0.343, 1]]
    const tg = lathe(profile(tp, 8), 128)
    const wood = new THREE.MeshStandardMaterial({ map: felt.texture, roughness: 0.4, envMap: env, envMapIntensity: 1.4 })
    const tm = new THREE.Mesh(tg, wood)
    const map = new THREE.Mesh(new THREE.CircleGeometry(FELT_R, 96), new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.55, envMap: env, envMapIntensity: 0.9 }))
    map.rotation.x = -Math.PI / 2; map.position.y = TOP_Y + 0.008; map.renderOrder = 1
    table.add(tm, map); root.add(table)
    // ---- bodies
    const grainTex = grain.texture
    const meepleGeo = (() => {
      const g = new THREE.ExtrudeGeometry(meepleShape(), { depth: 0.2, bevelEnabled: true, bevelSize: 0.045, bevelThickness: 0.045, bevelSegments: 4, curveSegments: 4 })
      g.translate(0, -0.4, -0.1)
      const P = g.getAttribute('position'), uv = new Float32Array(P.count * 2)
      for (let i = 0; i < P.count; i++) { uv[i * 2] = P.getX(i) * 0.9 + P.getZ(i) * 0.2; uv[i * 2 + 1] = P.getY(i) * 0.9 + 0.5 }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals()
      return g
    })()
    const tints: [number, number, number][] = [[0.86, 0.2, 0.14], [0.16, 0.4, 0.84], [0.24, 0.62, 0.26], [0.98, 0.78, 0.18], [0.82, 0.64, 0.42], [0.58, 0.26, 0.7], [0.95, 0.5, 0.14]]
    const wmat = (t: [number, number, number]) => new THREE.MeshPhysicalMaterial({ color: D(...t), map: grainTex, roughness: 0.46, clearcoat: 0.35, clearcoatRoughness: 0.35, envMap: env, envMapIntensity: 1.3 })
    const pipTex = (base: string, pip: string, n: number) => canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < 80; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2)
      const P: Record<number, [number, number][]> = { 1: [[0.5, 0.5]], 2: [[0.28, 0.28], [0.72, 0.72]], 3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]], 4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]], 5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]], 6: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.5], [0.7, 0.5], [0.3, 0.75], [0.7, 0.75]] }
      g.fillStyle = pip; for (const [x, y] of P[n]) { g.beginPath(); g.arc(x * w, y * h, 12, 0, Math.PI * 2); g.fill() }
    })
    const dieMats = (base: string, pip: string) => [1, 2, 3, 4, 5, 6].map(n => new THREE.MeshPhysicalMaterial({ map: pipTex(base, pip, n), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, envMap: env, envMapIntensity: 1.2 }))
    const dieGeo = new RoundedBoxGeometry(0.52, 0.52, 0.52, 4, 0.07)
    const cubeGeo = new RoundedBoxGeometry(0.26, 0.26, 0.26, 3, 0.03)
    const coinGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.07, 40)
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false })
    const add = (kind: Body['kind'], mesh: THREE.Object3D, h: [number, number, number], mass: number) => {
      const g = new THREE.Group(); g.add(mesh)
      const hv = new THREE.Vector3(...h), m = mass
      const I = new THREE.Vector3((m / 3) * (hv.y * hv.y + hv.z * hv.z), (m / 3) * (hv.x * hv.x + hv.z * hv.z), (m / 3) * (hv.x * hv.x + hv.y * hv.y))
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(hv.x * 2.2, hv.y * 2.2, hv.z * 2.2), proxyMat); g.add(proxy)
      const b: Body = { kind, p: new THREE.Vector3(0, 9, 0), q: new THREE.Quaternion(), v: new THREE.Vector3(), w: new THREE.Vector3(), m, h: hv, invI: new THREE.Vector3(1 / I.x, 1 / I.y, 1 / I.z), rad: Math.hypot(hv.x, hv.z) * (kind === 'meeple' ? 0.75 : 0.9), group: g, sleep: 0, delay: 0, live: false, maxY: 0 }
      proxy.userData.body = b
      g.position.set(0, -9, 0); g.visible = false
      table.add(g); pick.push(proxy); bodies.push(b)
      return b
    }
    tints.forEach((t, i) => { if (i >= 6) return; const mesh = new THREE.Mesh(meepleGeo, wmat(t)); add('meeple', mesh, [0.3, 0.447, 0.145], 1.3) })
    const dm = [dieMats('#efe6d2', '#1c1511'), dieMats('#b8301f', '#f3e8d4'), dieMats('#2c4f8c', '#f3e8d4')]
    dm.forEach(ms => { const mesh = new THREE.Mesh(dieGeo, ms); add('die', mesh, [0.26, 0.26, 0.26], 1.0) })
    for (let i = 0; i < 7; i++) { const mesh = new THREE.Mesh(cubeGeo, wmat(tints[i % tints.length])); add('cube', mesh, [0.13, 0.13, 0.13], 0.28) }
    const coinMat = [0xf2c15a, 0xdfe3ea, 0xd98a58].map(h => new THREE.MeshStandardMaterial({ color: D(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255), metalness: 0.4, roughness: 0.34, envMap: env, envMapIntensity: 1.6 }))
    for (let i = 0; i < 6; i++) { const mesh = new THREE.Mesh(coinGeo, coinMat[i % 3]); add('coin', mesh, [0.19, 0.035, 0.19], 0.2) }
    blobs = makeBlobs(bodies.length, 0.5); blobs.position.y = TOP_Y; table.add(blobs)
    const rg = new THREE.RingGeometry(0.78, 1, 40); rg.rotateX(-Math.PI / 2)
    ringMat = new THREE.MeshBasicMaterial({ color: D(1.0, 0.86, 0.55), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    ringM = new THREE.Mesh(rg, ringMat); ringM.position.y = TOP_Y + 0.014; ringM.visible = false; ringM.renderOrder = 5; table.add(ringM)
    const rt = canvasTex(512, 128, () => {}); readTex = rt as unknown as THREE.CanvasTexture; readG = (rt.image as HTMLCanvasElement).getContext('2d')!
    readout = new THREE.Sprite(new THREE.SpriteMaterial({ map: rt, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 })); readout.scale.set(2.8, 0.7, 1); readout.position.set(0, TOP_Y + 1.95, 0); readout.renderOrder = 9; readout.visible = false; table.add(readout)
    table.position.y = 0
    root.userData.tableTop = TOP_Y
    for (const b of bodies) b.group.position.y = -9
    // the order in which they fall: shuffled, so colours mix
    const idx = bodies.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]] }
    for (const i of idx) order.push(bodies[i])
    precompile(k, root)
    built = true
    if (k.reduced()) { drop(); for (let i = 0; i < 900; i++) simulate(DT, 99); for (const b of bodies) b.live = true; sync() }
  }

  /** stagger-drop everything from above the table */
  function drop() {
    const placed: THREE.Vector2[] = []
    order.forEach((b, n) => {
      let x = 0, z = 0
      for (let tries = 0; tries < 40; tries++) {
        const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * (PLAY_R - 0.5); x = Math.cos(a) * rr; z = Math.sin(a) * rr
        if (placed.every(p => Math.hypot(p.x - x, p.y - z) > 0.62)) break
      }
      placed.push(new THREE.Vector2(x, z))
      b.p.set(x, 3.2 + rand() * 1.8, z); b.q.setFromEuler(new THREE.Euler(rand() * 6.28, rand() * 6.28, rand() * 6.28))
      b.v.set((rand() - 0.5) * 0.8, -0.5 * rand(), (rand() - 0.5) * 0.8); b.w.set((rand() - 0.5) * 9, (rand() - 0.5) * 9, (rand() - 0.5) * 9)
      b.delay = 0.1 + n * 0.14; b.live = false; b.sleep = 0
    })
    tDwell = 0; dropped = true; nextRoll = 7
  }
  function toss(b: Body, k = 1) {
    b.live = true; b.sleep = 0
    b.v.set((rand() - 0.5) * 1.2 * k, 5.4 * k + rand() * 1.2, (rand() - 0.5) * 1.2 * k); b.w.set((rand() - 0.5) * 20, (rand() - 0.5) * 20, (rand() - 0.5) * 20)
    if (b.p.y < 0.01 + b.h.y) b.p.y += 0.05
  }

  /** advance every live body by dt, with the rim and body-to-body push-apart; `pos` is the rest-test speed limit */
  function simulate(dt: number, _t: number) {
    for (const b of bodies) {
      if (!b.live) continue
      if (b.sleep > 0.5) continue
      step(b, dt)
      // rim: a circular wall
      const d = Math.hypot(b.p.x, b.p.z), lim = PLAY_R + 0.12 - b.rad * 0.6
      if (d > lim) {
        const nx = b.p.x / d, nz = b.p.z / d, vr = b.v.x * nx + b.v.z * nz
        b.p.x = nx * lim; b.p.z = nz * lim
        if (vr > 0) { b.v.x -= (1.35) * vr * nx; b.v.z -= 1.35 * vr * nz; b.w.multiplyScalar(0.92) }
      }
    }
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], c = bodies[j]; if (!a.live || !c.live) continue
      const dx = c.p.x - a.p.x, dz = c.p.z - a.p.z, rr = a.rad + c.rad, d2 = dx * dx + dz * dz
      if (d2 >= rr * rr || d2 < 1e-8) continue
      const hv = a.h.y + c.h.y + 0.1
      if (Math.abs(c.p.y - a.p.y) > Math.max(hv, 0.5)) continue
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, push = (rr - d) * 0.5
      a.p.x -= nx * push; a.p.z -= nz * push; c.p.x += nx * push; c.p.z += nz * push
      const rv = (c.v.x - a.v.x) * nx + (c.v.z - a.v.z) * nz
      if (rv < 0) { const j2 = -rv * 0.6 / (1 / a.m + 1 / c.m); a.v.x -= (j2 / a.m) * nx; a.v.z -= (j2 / a.m) * nz; c.v.x += (j2 / c.m) * nx; c.v.z += (j2 / c.m) * nz }
      a.sleep = 0; c.sleep = 0
    }
    for (const b of bodies) {
      if (!b.live) continue
      if (b.v.lengthSq() < 0.004 && b.w.lengthSq() < 0.03 && b.p.y < b.maxY + 0.45) b.sleep += dt; else b.sleep = 0
      if (b.sleep > 0.5) { b.v.set(0, 0, 0); b.w.set(0, 0, 0) }
    }
  }
  function sync() {
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]
      b.group.visible = b.live
      b.group.position.copy(b.p).setY(b.p.y + TOP_Y); b.group.quaternion.copy(b.q)
      // shadow
      const hgt = Math.max(0, b.p.y - lowest(b))
      const s = (b.kind === 'meeple' ? 0.86 : b.kind === 'die' ? 0.78 : b.kind === 'coin' ? 0.55 : 0.4) * (1 + hgt * 0.9)
      setBlob(blobs, i, b.p.x, 0.004, b.p.z, s * (b.live ? 1 : 0), s * (b.live ? 1 : 0))
    }
    blobs.instanceMatrix.needsUpdate = true
  }
  /** height of the body's lowest point above its centre: used for shadows */
  function lowest(b: Body) { let low = 1e9; for (const cn of CORNERS) { r3.set(cn[0] * b.h.x, cn[1] * b.h.y, cn[2] * b.h.z).applyQuaternion(b.q); low = Math.min(low, r3.y) } return -low }

  const AXES: [THREE.Vector3, number][] = [[new THREE.Vector3(1, 0, 0), 1], [new THREE.Vector3(-1, 0, 0), 2], [new THREE.Vector3(0, 1, 0), 3], [new THREE.Vector3(0, -1, 0), 4], [new THREE.Vector3(0, 0, 1), 5], [new THREE.Vector3(0, 0, -1), 6]]
  const faceUp = (b: Body) => { let best = 1, by = -2; for (const [a, n] of AXES) { const y = a.clone().applyQuaternion(b.q).y; if (y > by) { by = y; best = n } } return best }
  function drawRead(vals: number[]) {
    const g = readG; g.clearRect(0, 0, 512, 128)
    g.fillStyle = 'rgba(12,10,8,0.74)'; g.beginPath(); g.roundRect(8, 14, 496, 100, 22); g.fill(); g.strokeStyle = 'rgba(240,215,160,0.5)'; g.lineWidth = 3; g.stroke()
    g.fillStyle = '#f4e6c4'; g.font = '700 52px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(`${vals.join(' + ')} = ${vals.reduce((a, c) => a + c, 0)}`, 256, 66); readTex.needsUpdate = true
  }
  function rollDice() {
    for (const d of bodies) if (d.kind === 'die' && d.live) { toss(d, 1.18); d.w.multiplyScalar(1.3) }
    reading = true; rolled = true; readT = wallT; readout.visible = false
    kit.emit('obj:roll', { dice: 3 }); stamp('rollAt')
  }
  function update(time: number, dt: number, r: number, dwell: boolean, _st: FlightState) {
    if (!built) return
    const rm = kit.reduced()
    wallT += dt
    if (r <= 0.0005) { root.visible = false; if (wasPresent) { wasPresent = false; dropped = false; for (const b of bodies) { b.live = false; b.group.visible = false } } return }
    if (!wasPresent) { wasPresent = true }
    root.visible = true
    enter(root, r, rm, 2.4)
    if (rm) { if (!dropped) { drop(); for (let i = 0; i < 900; i++) simulate(DT, 99); for (const b of bodies) b.live = true; dropped = true }; sync(); return }
    if (!dropped && r > 0.86) drop()
    if (dropped) {
      acc = Math.min(acc + dt, 0.05)
      tDwell += dt
      for (const b of bodies) if (!b.live && tDwell > b.delay) { b.live = true }
      while (acc >= DT) { simulate(DT, time); acc -= DT }
      if (dwell && r > 0.98 && tDwell > nextRoll) {
        const dice = bodies.filter(b => b.kind === 'die' && b.live)
        if (dice.length) { toss(dice[Math.floor(rand() * dice.length)]); kit.emit('cab:roll', { auto: true }) }
        nextRoll = tDwell + 5.5 + rand() * 2.5
      }
    }
    sync()
    hoverFx(dt, rm)
  }
  /** the ring under the hovered piece, and the plate that reads the dice once they have all come to rest */
  function hoverFx(dt: number, rm: boolean) {
    hoverK += ((hoverB ? 1 : 0) - hoverK) * Math.min(1, dt * 14)
    ringM.visible = !!hoverB || hoverK > 0.02
    if (hoverB) { ringM.position.x = hoverB.p.x; ringM.position.z = hoverB.p.z; const s = Math.max(0.3, hoverB.rad * 1.55) * (1 + 0.05 * Math.sin(wallT * 6)); ringM.scale.set(s, 1, s) }
    ringMat.opacity = 0.7 * hoverK
    if (reading) {
      const dice = bodies.filter(b => b.kind === 'die' && b.live)
      if (wallT - readT > 0.5 && dice.length && dice.every(b => b.sleep > 0.5 || (b.v.lengthSq() < 0.03 && b.w.lengthSq() < 0.5 && b.p.y < b.maxY + 0.45))) { reading = false; readT = wallT; drawRead(dice.map(faceUp)); readout.visible = true; kit.emit('obj:settle') }
    }
    if (readout.visible || rolled) {
      const age = wallT - readT, a = rm ? 1 : Math.min(1, age * 5) * (1 - Math.min(1, Math.max(0, (age - 5.5) / 1.2)))
      if (!reading && rolled && age > 6.7) { readout.visible = false; rolled = false }
      ;(readout.material as THREE.SpriteMaterial).opacity = readout.visible ? a : 0
      readout.position.y = TOP_Y + 1.95 + (rm ? 0 : 0.06 * Math.sin(wallT * 2))
    }
  }

  return {
    id: 'meeple', root, dim: 0.05, pick, build, update, scale: 1.2,
    hover(o) { const b = (o?.userData.body as Body | undefined) ?? null; if (b !== hoverB) { hoverB = b; if (b && wallT - lastTick > 0.09) { lastTick = wallT; kit.emit('obj:tick', { kind: b.kind }) } } },
    press(o) {
      const b = o?.userData.body as Body | undefined; if (!b) return
      if (b.kind === 'die') { rollDice(); return }
      toss(b, b.kind === 'meeple' ? 0.8 : 1); kit.emit('obj:toss', { kind: b.kind })
    },
    act(name) { if (name !== 'roll') return ''; rollDice(); return 'The dice are rolling.' },
    demo() { const d = bodies.find(b => b.kind === 'die' && b.live); if (d) { toss(d, 1); kit.emit('obj:toss', { kind: 'die' }) } },
    api: { get bodies() { return bodies }, toss: (i: number) => toss(bodies[i]), rollDice, get reading() { return reading }, get tDwell() { return tDwell } },
    dispose() { disposeTree(root) },
  }
}
