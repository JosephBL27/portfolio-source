// Deterministic radial layout of Joseph's nervous-system.json.
// Brain globe at the origin; brain nodes are ports on its rim; agents on a middle ring;
// sources on the outer left arc; outputs on the outer right arc. Every tube is a smooth
// 3D curve that bows off the wall (+z) so crossings read as plumbing passing over plumbing.
import * as THREE from 'three'
import { network, type NetNode, type NetEdge } from '../data'

export const GLOBE_R = 0.62
export const WALL_Z = -0.32

export interface Station {
  node: NetNode
  index: number
  pos: THREE.Vector3
  angle: number
  ring: 'port' | 'agent' | 'source' | 'output'
}
export interface Route {
  edge: NetEdge
  index: number
  from: Station
  to: Station
  curve: THREE.CubicBezierCurve3
  length: number
  radius: number
  bulge: number
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 100000) / 100000
}

const ELLIPSE = { port: [0.86, 0.86], agent: [1.85, 1.5], source: [3.05, 2.2], output: [3.05, 2.2] } as const

export function buildLayout() {
  const nodes = network.nodes
  const edges = network.edges
  const byId = new Map(nodes.map(n => [n.id, n]))
  const nbrs = new Map<string, string[]>()
  for (const n of nodes) nbrs.set(n.id, [])
  for (const e of edges) { nbrs.get(e.from)!.push(e.to); nbrs.get(e.to)!.push(e.from) }

  const ringOf = (n: NetNode): Station['ring'] =>
    n.kind === 'brain' ? 'port' : n.kind === 'source' ? 'source' : n.kind === 'output' ? 'output' : 'agent'

  // Initial angles: sources spread over the left arc, outputs over the right arc, others even.
  const angle = new Map<string, number>()
  const groups: Record<Station['ring'], NetNode[]> = { port: [], agent: [], source: [], output: [] }
  for (const n of nodes) groups[ringOf(n)].push(n)
  const spread = (list: NetNode[], a0: number, a1: number) =>
    list.forEach((n, i) => angle.set(n.id, a0 + (a1 - a0) * ((i + 0.5) / list.length)))
  spread(groups.source, Math.PI * 0.62, Math.PI * 1.38)
  spread(groups.output, -Math.PI * 0.33, Math.PI * 0.33)
  spread(groups.agent, 0, Math.PI * 2)
  spread(groups.port, 0, Math.PI * 2)

  // Barycentric sweeps: each movable ring takes the circular mean angle of its neighbours,
  // then is re-spread evenly in that order (keeps spacing legible).
  const circMean = (ids: string[]) => {
    let x = 0, y = 0
    for (const id of ids) { const a = angle.get(id)!; x += Math.cos(a); y += Math.sin(a) }
    return Math.atan2(y, x)
  }
  const resweep = (list: NetNode[], a0: number, a1: number, full: boolean) => {
    const scored = list.map(n => ({ n, a: circMean(nbrs.get(n.id)!) }))
    if (full) {
      scored.sort((p, q) => p.a - q.a)
      // rotate so the biggest gap sits at the bottom; keep even spacing
      const base = scored.length ? scored[0].a : 0
      scored.forEach((s, i) => angle.set(s.n.id, base + (Math.PI * 2 * i) / scored.length))
    } else {
      // arcs: map to [a0, a1] preserving sort; angles near pi for sources need unwrapping
      const unwrap = (a: number) => { let v = a; while (v < a0 - Math.PI) v += Math.PI * 2; while (v > a1 + Math.PI) v -= Math.PI * 2; return v }
      scored.forEach(s => (s.a = unwrap(s.a)))
      scored.sort((p, q) => p.a - q.a)
      scored.forEach((s, i) => angle.set(s.n.id, a0 + (a1 - a0) * ((i + 0.5) / scored.length)))
    }
  }
  for (let it = 0; it < 24; it++) {
    resweep(groups.agent, 0, 0, true)
    resweep(groups.port, 0, 0, true)
    resweep(groups.source, Math.PI * 0.6, Math.PI * 1.4, false)
    resweep(groups.output, -Math.PI * 0.36, Math.PI * 0.36, false)
  }
  // Sources are listed top-to-bottom on the left: flip so that sort order reads downward.
  const stations: Station[] = nodes.map((n, index) => {
    const ring = ringOf(n)
    const a = angle.get(n.id)!
    const [rx, ry] = ELLIPSE[ring]
    const jitter = ring === 'agent' ? (hash(n.id) - 0.5) * 0.22 : 0
    const pos = new THREE.Vector3(Math.cos(a) * (rx + jitter), Math.sin(a) * (ry + jitter * 0.7), ring === 'port' ? 0.22 : 0)
    return { node: n, index, pos, angle: a, ring }
  })
  const st = new Map(stations.map(s => [s.node.id, s]))

  // Routes: cubic Béziers that leave each station perpendicular-ish and bow away from the globe.
  const routes: Route[] = edges.map((edge, index) => {
    const from = st.get(edge.from)!, to = st.get(edge.to)!
    const a = from.pos.clone(), b = to.pos.clone()
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const h = hash(edge.from + '>' + edge.to)
    // keep away from the globe unless an end is a port
    const touchesBrain = from.ring === 'port' || to.ring === 'port'
    const minR = touchesBrain ? 0.0 : GLOBE_R + 0.42
    const m2 = new THREE.Vector2(mid.x, mid.y)
    if (m2.length() < minR) {
      if (m2.length() < 1e-3) m2.set(0, 1)
      m2.setLength(minR + 0.1)
    }
    const bulge = 0.18 + h * 0.55
    const dir = b.clone().sub(a)
    const len = dir.length()
    const c1 = a.clone().lerp(new THREE.Vector3(m2.x, m2.y, 0), 0.62)
    const c2 = b.clone().lerp(new THREE.Vector3(m2.x, m2.y, 0), 0.62)
    c1.z = a.z + bulge * Math.min(1, len / 2)
    c2.z = b.z + bulge * Math.min(1, len / 2)
    // ports leave the globe radially outward
    if (from.ring === 'port') c1.copy(a).add(new THREE.Vector3(a.x, a.y, 0).setLength(0.55)).setZ(a.z + 0.2)
    if (to.ring === 'port') c2.copy(b).add(new THREE.Vector3(b.x, b.y, 0).setLength(0.55)).setZ(b.z + 0.2)
    let curve = new THREE.CubicBezierCurve3(a, c1, c2, b)
    // bend around the globe: tubes that do not plug into it must clear it
    if (!touchesBrain) {
      const clear = GLOBE_R + 0.32
      const minDist = (c: THREE.CubicBezierCurve3) => { let m = 9; for (let i = 0; i <= 40; i++) { const p = c.getPoint(i / 40); m = Math.min(m, Math.hypot(p.x, p.y)) } return m }
      if (minDist(curve) < clear) {
        const d2 = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize()
        let nrm = new THREE.Vector2(-d2.y, d2.x)
        const m0 = new THREE.Vector2(mid.x, mid.y)
        if (nrm.dot(m0) < 0 || (m0.length() < 0.05 && h < 0.5)) nrm = nrm.multiplyScalar(-1)
        for (let k = 0.5; k < 4; k += 0.18) {
          const q1 = a.clone().lerp(b, 0.22).add(new THREE.Vector3(nrm.x * k, nrm.y * k, 0)); q1.z = c1.z
          const q2 = a.clone().lerp(b, 0.78).add(new THREE.Vector3(nrm.x * k, nrm.y * k, 0)); q2.z = c2.z
          const cand = new THREE.CubicBezierCurve3(a, q1, q2, b)
          curve = cand
          if (minDist(cand) >= clear) break
        }
      }
    }
    const major = /daily|hourly|min|60 s/.test(edge.cadence)
    return { edge, index, from, to, curve, length: curve.getLength(), radius: major ? 0.0125 : 0.0095, bulge }
  })
  return { stations, routes, byId: st }
}
export type Layout = ReturnType<typeof buildLayout>
