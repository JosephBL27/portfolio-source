// The vault as a graph: 478 notes, 1,887 links, folder per note, from src/data/brain-graph.json (no titles, no paths: x/y from a force layout normalised to -1..1).
// Used by the second-brain lab: the notes are the disc the pulses land in, and a landing lights a few notes in the right folder and spreads along real links.
import raw from '../../../data/brain-graph.json'

interface Raw { stats: { notes: number; links: number; folders: Record<string, number>; orphans: number; wikilinkInstances: number }; groups: string[]; nodes: number[][]; links: number[][] }
const R = raw as unknown as Raw

export interface VaultGraph {
  n: number; x: Float32Array; y: Float32Array; g: Uint8Array; deg: Uint16Array
  links: Uint16Array                  // pairs
  adj: number[][]
  byGroup: number[][]                 // notes of each folder, highest degree first
  groups: string[]
  stats: Raw['stats']
  maxR: number
}
/** one hue per vault folder, spaced around the wheel and held to one lightness so the disc reads as a single instrument */
export const GROUP_COLOR = ['#f5c45e', '#7fd9b0', '#8fb8ff', '#c79bff', '#8b95a6', '#ff9d7a', '#ff8fb8', '#ffd98a', '#5fd3e0', '#b9c4d0']

let cache: VaultGraph | null = null
export function loadVault(): VaultGraph {
  if (cache) return cache
  const n = R.nodes.length
  const x = new Float32Array(n), y = new Float32Array(n), g = new Uint8Array(n), deg = new Uint16Array(n)
  let maxR = 0
  R.nodes.forEach((nd, i) => { x[i] = nd[0]; y[i] = nd[1]; g[i] = nd[2]; deg[i] = nd[3]; maxR = Math.max(maxR, Math.hypot(nd[0], nd[1])) })
  const links = new Uint16Array(R.links.length * 2)
  const adj: number[][] = Array.from({ length: n }, () => [])
  R.links.forEach((l, i) => { links[i * 2] = l[0]; links[i * 2 + 1] = l[1]; adj[l[0]].push(l[1]); adj[l[1]].push(l[0]) })
  const byGroup: number[][] = R.groups.map(() => [])
  for (let i = 0; i < n; i++) byGroup[g[i]].push(i)
  byGroup.forEach(l => l.sort((a, b) => deg[b] - deg[a]))
  cache = { n, x, y, g, deg, links, adj, byGroup, groups: R.groups, stats: R.stats, maxR }
  return cache
}

/** the notes a landing lights: one seed in `group` (a well-linked one, picked by `pick` in 0..1), then outwards along real links, three hops, at most `cap` notes */
export function wave(vg: VaultGraph, group: number, pick: number, cap = 46): { nodes: Int32Array; hops: Uint8Array } {
  const pool = vg.byGroup[group]?.length ? vg.byGroup[group] : vg.byGroup[1]
  const top = pool.slice(0, Math.max(1, Math.ceil(pool.length * 0.4)))
  const seed = top[Math.floor(pick * top.length) % top.length]
  const nodes: number[] = [seed], hops: number[] = [0], seen = new Set<number>([seed])
  for (let h = 0, from = 0; h < 3 && nodes.length < cap; h++) {
    const end = nodes.length
    for (let i = from; i < end && nodes.length < cap; i++) {
      const nb = vg.adj[nodes[i]].slice().sort((a, b) => vg.deg[b] - vg.deg[a])
      for (let k = 0; k < nb.length && k < 7 && nodes.length < cap; k++) { const m = nb[k]; if (!seen.has(m)) { seen.add(m); nodes.push(m); hops.push(h + 1) } }
    }
    from = end
  }
  return { nodes: Int32Array.from(nodes), hops: Uint8Array.from(hops) }
}
