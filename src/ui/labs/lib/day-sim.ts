// One day of the brain's nervous system as a pure function of time. Ported from ~/PORTFOLIO/src/sb/brain/NervousSystem.tsx
// (planFor, storyStarts, the push/pull firing rules and the session ordering), minus its layout: here every pulse is just
// (edge, start hour, end hour), so any hour of the day can be drawn without replaying the ones before it, which is what makes the clock scrubbable.
// Data: src/data/nervous-system.json. Cadence text is parsed, never invented: a node with no time of its own gets a deterministic hour from its id.
export type Kind = 'source' | 'agent' | 'brain' | 'output'
export interface DNode { id: string; label: string; kind: Kind; project: string | null; schedule: string; times?: string[]; detail: string }
export interface DEdge { from: string; to: string; label: string; cadence?: string }
export interface DData { nodes: DNode[]; edges: DEdge[]; story: string[] }
export interface Pulse { e: number; t0: number; t1: number }
export interface Arrival { t: number; node: number; into: boolean }
export interface Day {
  nodes: DNode[]; edges: { a: number; b: number; label: string; cadence?: string }[]
  kind: number[]; idx: Map<string, number>
  pulses: Pulse[]
  lights: Float32Array[]             // per node: hours it fires (arrivals and departures), sorted
  arrivals: Arrival[]                // pulses landing on / leaving a vault area, sorted: they light notes in the graph
  shimmer: number[]                  // edges with a continuous cadence (every few minutes, always on)
  breath: Uint8Array                 // nodes that run continuously
  story: number[]                    // the hour each story line starts
  perHour: number[]                  // pulses starting in each hour (the scrub bar's activity strip)
}

export const KIND_INDEX: Record<Kind, number> = { source: 0, agent: 1, brain: 2, output: 3 }
const SESSIONS = [10, 14.5, 20.25]
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const wrap24 = (t: number) => ((t % 24) + 24) % 24
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const toHours = (t: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(t.trim()); return m ? (Number(m[1]) % 24) + Number(m[2]) / 60 : NaN }
function range(start: number, step: number) { const out: number[] = []; for (let t = start; t < 24 - 1e-6; t += step) out.push(t); return out }

interface Plan { times: number[]; shimmer: boolean; session: boolean }
/** a human cadence ("4x daily", "hourly", "Sundays 08:45", "every 5 min") as fire hours over one day */
function planFor(schedule: string, times: string[] | undefined, key: string, kind: Kind): Plan {
  const s = schedule.toLowerCase(), hv = hash(key)
  const plan = (t: number[]): Plan => ({ times: t, shimmer: false, session: false })
  const fixed = (times ?? []).map(toHours).filter(t => Number.isFinite(t))
  const inText = [...s.matchAll(/(\d{1,2}):(\d{2})/g)].map(m => (Number(m[1]) % 24) + Number(m[2]) / 60)
  const at = fixed.length ? fixed : inText
  const minutes = /every\s*(\d+)\s*(?:m\b|min)/.exec(s)
  if (minutes) {
    const n = Number(minutes[1])
    if (n <= 15) return { times: [], shimmer: true, session: false }
    const step = Math.max(n, 30) / 60
    return plan(range(at.length ? at[0] % step : ((hv % 4) * step) / 4, step))
  }
  if (/every\s*\d+\s*s\b/.test(s)) return { times: [], shimmer: true, session: false }
  if (/always|continuous|real.?time|\blive\b|stream/.test(s)) return { times: [], shimmer: true, session: false }
  if (/hourly|every\s*hour|every\s*60/.test(s)) return plan(range(at.length ? at[0] % 1 : (hv % 4) / 4, 1))
  const hours = /every\s*(\d+)\s*h/.exec(s)
  if (hours) { const step = clamp(Number(hours[1]), 1, 24); return plan(range(at.length ? at[0] % step : hv % step, step)) }
  if (/session/.test(s)) return { times: [], shimmer: false, session: true }
  if (at.length) return plan(at)
  const nx = /(\d+)\s*(?:x|times)\b/.exec(s)
  const count = nx ? clamp(Number(nx[1]), 1, 24) : /twice/.test(s) ? 2 : 0
  if (count) return plan(Array.from({ length: count }, (_, k) => 7 + (15 * (k + 0.5)) / count))
  if (/night/.test(s)) return plan([1.5 + (hv % 4) * 0.5])
  if (/morning/.test(s)) return plan([7 + (hv % 4) * 0.25])
  if (/evening/.test(s)) return plan([19 + (hv % 4) * 0.25])
  if (/daily|every day|each day|week|mon|tue|wed|thu|fri|sat|sun/.test(s)) return plan([8 + (hv % 13)])
  if (kind === 'agent') return plan([9 + (hv % 12) + ((hv >> 4) % 4) / 4])
  return plan([])
}

/** when each story sentence shows: its own time if it names one, otherwise spaced between its neighbours */
export function storyStarts(lines: string[], startHour: number): number[] {
  const n = lines.length
  if (!n) return []
  const parsed = lines.map((s): number | null => {
    const m = /\b(\d{1,2}):(\d{2})\b/.exec(s)
    if (m) return wrap24((Number(m[1]) % 24) + Number(m[2]) / 60 - 0.35)
    const ap = /\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)/i.exec(s)
    if (ap) return wrap24((Number(ap[1]) % 12) + (/p/i.test(ap[2]) ? 12 : 0) - 0.35)
    if (/midnight/i.test(s)) return 23.65
    if (/\bnoon\b/i.test(s)) return 11.65
    return null
  })
  const known = parsed.flatMap((p, i) => (p === null ? [] : [i]))
  if (!known.length) return lines.map((_, i) => wrap24(startHour + (i * 24) / n))
  const out = new Array<number>(n)
  for (let k = 0; k < known.length; k++) {
    const a = known[k], b = known[(k + 1) % known.length]
    const ta = parsed[a] as number
    let tb = parsed[b] as number
    const steps = (b - a + n) % n || n
    if (tb <= ta) tb += 24
    out[a] = ta
    for (let s = 1; s < steps; s++) out[(a + s) % n] = wrap24(ta + ((tb - ta) * s) / steps)
  }
  return out
}

/** how long a pulse takes on an edge, in hours of the simulated day (one second of the 24 s loop each) */
const travel = (ka: number, kb: number, key: string) => {
  const base = ka === 0 ? 0.6 : kb === 3 ? 0.6 : ka === 2 || kb === 2 ? 0.48 : 0.5
  return base + ((hash(key) % 9) - 4) * 0.02
}

export function buildDay(data: DData, startHour: number): Day {
  const nodes = data.nodes, n = nodes.length
  const idx = new Map<string, number>(); nodes.forEach((nd, i) => idx.set(nd.id, i))
  const kind = nodes.map(nd => KIND_INDEX[nd.kind])
  const edges = data.edges.flatMap(e => { const a = idx.get(e.from), b = idx.get(e.to); return a === undefined || b === undefined ? [] : [{ a, b, label: e.label, cadence: e.cadence }] })
  const plans = nodes.map(nd => planFor(nd.schedule, nd.times, nd.id, nd.kind))

  // "every session" agents fire together at the session hours, upstream ones first
  const depth = new Array<number>(n).fill(0)
  for (let it = 0; it < n; it++) {
    let changed = false
    for (const { a, b } of edges) {
      if (!plans[a].session || !plans[b].session || kind[b] !== 1) continue
      if (depth[b] < depth[a] + 1 && depth[a] < 5) { depth[b] = depth[a] + 1; changed = true }
    }
    if (!changed) break
  }
  let rank = 0
  plans.forEach((p, i) => { if (p.session) plans[i] = { ...p, times: SESSIONS.map(s => s + depth[i] * 0.55 + (rank++ % 3) * 0.12) } })

  const lightsRaw: number[][] = nodes.map(() => [])
  const pulses: Pulse[] = []
  const arrivals: Arrival[] = []
  const shimmer: number[] = []
  const breath = new Uint8Array(n)
  const light = (j: number, t: number) => { lightsRaw[j].push(wrap24(t)) }

  edges.forEach((ed, e) => {
    const { a, b } = ed
    // agents pull from what they read; everything else pushes
    const pull = kind[b] === 1 && (kind[a] === 0 || kind[a] === 2 || kind[a] === 3)
    const driver = pull ? b : a
    const plan = ed.cadence ? planFor(ed.cadence, undefined, `${nodes[a].id}>${nodes[b].id}`, 'agent') : plans[driver]
    if (plan.shimmer) { shimmer.push(e); breath[driver] = 1; return }
    const dur = travel(kind[a], kind[b], `${nodes[a].id}>${nodes[b].id}`)
    for (const t of plan.times) {
      const t0 = pull ? t - dur : t, t1 = t0 + dur
      const w0 = wrap24(t0), w1 = w0 + dur
      pulses.push({ e, t0: w0, t1: w1 })
      if (w1 > 24) pulses.push({ e, t0: w0 - 24, t1: w1 - 24 })
      light(a, t0); light(b, t1)
      if (kind[b] === 2) arrivals.push({ t: wrap24(t1), node: b, into: true })
      else if (kind[a] === 2) arrivals.push({ t: wrap24(t0), node: a, into: false })
    }
  })
  plans.forEach((p, i) => { if (kind[i] === 1) { for (const t of p.times) light(i, t); if (p.shimmer) breath[i] = 1 } })
  pulses.sort((p, q) => p.t0 - q.t0)
  arrivals.sort((p, q) => p.t - q.t)
  const perHour = new Array<number>(24).fill(0)
  for (const p of pulses) { const h = Math.floor(wrap24(p.t0)); perHour[h]++ }
  return {
    nodes, edges, kind, idx, pulses,
    lights: lightsRaw.map(l => Float32Array.from(l.sort((x, y) => x - y))),
    arrivals, shimmer, breath, story: storyStarts(data.story, startHour), perHour,
  }
}
