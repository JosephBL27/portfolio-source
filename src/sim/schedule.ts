// Pure-function schedule: capsule positions depend only on simulated time, so Pause,
// scrubbing and reduced motion all fall out of one function. Real clock times fire at
// their real minute; very frequent jobs are thinned so the tubes stay readable.
import type { Layout, Route } from './layout'

export const WEEK = 7 * 24 * 60 // minutes
export const SIM_MIN_PER_SEC = 36 // 1 simulated day = 40 real seconds
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export type CapColour = 'inbound' | 'ink' | 'delivered'
export interface Trip { route: Route; t0: number; dur: number; colour: CapColour; thinned: boolean; illustrative: boolean }
export interface Flight { trip: Trip; u: number }

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967296
}
const hm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }

/** Weekly departure minutes for one route, before travel offsets. */
function baseTimes(r: Route): { mins: number[]; thinned: boolean; illustrative: boolean } {
  const c = r.edge.cadence.toLowerCase()
  const nodeTimes = (r.to.node.times.length ? r.to.node.times : r.from.node.times).map(hm)
  const out: number[] = []
  const daily = (times: number[], days = [0, 1, 2, 3, 4, 5, 6]) => { for (const d of days) for (const t of times) out.push(d * 1440 + t) }
  const h = hash(r.edge.from + r.edge.to)
  if (c.includes('4x daily')) { daily([7, 12, 15, 20].map(x => x * 60)); return { mins: out, thinned: false, illustrative: false } }
  const at = c.match(/(\d\d):(\d\d)/)
  if (c.startsWith('sundays')) { daily([at ? hm(at[0]) : nodeTimes[0]], [0]); return { mins: out, thinned: false, illustrative: false } }
  if (c.startsWith('mondays')) { daily([at ? hm(at[0]) : nodeTimes[0]], [1]); return { mins: out, thinned: false, illustrative: false } }
  if (c.startsWith('wednesdays')) { daily([at ? hm(at[0]) : nodeTimes[0]], [3]); return { mins: out, thinned: false, illustrative: false } }
  if (c.startsWith('every 3 days')) { daily([nodeTimes[0] ?? 180], [0, 3, 6]); return { mins: out, thinned: false, illustrative: false } }
  if (c.startsWith('daily')) {
    const times = c.match(/\d\d:\d\d/g)?.map(hm) ?? nodeTimes
    daily(times.length ? times : nodeTimes); return { mins: out, thinned: false, illustrative: false }
  }
  if (/hourly|every \d+ min|every 60 s/.test(c)) {
    // thinned: one visual capsule per ~3 simulated hours (about 5 s of real time), staggered
    const step = 180, off = Math.floor(h * step)
    for (let t = off; t < WEEK; t += step) {
      if (c.includes('07:00-23:00')) { const m = t % 1440; if (m < 420 || m > 1380) continue }
      out.push(t)
    }
    return { mins: out, thinned: true, illustrative: false }
  }
  // "every session", "session start/end", "as they land", "when seeded": a seeded trickle
  for (let d = 0; d < 7; d++) {
    const n = 2 + Math.floor(hash(r.edge.label + d) * 3)
    for (let k = 0; k < n; k++) out.push(d * 1440 + 480 + Math.floor(hash(r.edge.from + r.edge.to + d + k) * 900))
  }
  return { mins: out, thinned: false, illustrative: true }
}

export function buildTrips(layout: Layout): Trip[] {
  const trips: Trip[] = []
  for (const r of layout.routes) {
    const { mins, thinned, illustrative } = baseTimes(r)
    // travel: accelerate off the line, brake on air; real seconds ∝ length
    const realSec = Math.min(1.6, Math.max(0.55, r.length / 2.6))
    const dur = realSec * SIM_MIN_PER_SEC
    // causality: tubes INTO a scheduled agent arrive at its time; tubes OUT leave just after
    const intoAgent = r.to.node.kind === 'agent' && r.to.node.times.length > 0
    const shift = intoAgent ? -dur : r.from.node.kind === 'agent' ? 6 : 0
    const colour: CapColour = r.from.node.kind === 'source' ? 'inbound' : r.to.node.kind === 'output' ? 'delivered' : 'ink'
    for (const m of mins) trips.push({ route: r, t0: (m + shift + WEEK) % WEEK, dur, colour, thinned, illustrative })
  }
  trips.sort((a, b) => a.t0 - b.t0)
  return trips
}

/** Capsules in flight at simulated minute `t` (0..WEEK). */
export function flightsAt(trips: Trip[], t: number, max = 48): Flight[] {
  const out: Flight[] = []
  for (const trip of trips) {
    let dt = t - trip.t0
    if (dt < 0) dt += WEEK
    if (dt >= 0 && dt <= trip.dur) out.push({ trip, u: dt / trip.dur })
    if (out.length >= max) break
  }
  return out
}

/** DRAW ease: cubic-bezier(0.3, 0, 0.1, 1) approximated by Newton steps. */
export function draw(u: number) {
  const x1 = 0.3, y1 = 0, x2 = 0.1, y2 = 1
  const bx = (t: number) => 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3
  const by = (t: number) => 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3
  let t = u
  for (let i = 0; i < 6; i++) {
    const x = bx(t) - u
    const d = (bx(t + 1e-4) - bx(t - 1e-4)) / 2e-4
    if (Math.abs(d) < 1e-6) break
    t = Math.min(1, Math.max(0, t - x / d))
  }
  return by(t)
}

export function chicagoNowMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
  const wd = parts.find(p => p.type === 'weekday')!.value.toUpperCase().slice(0, 3)
  const h = +parts.find(p => p.type === 'hour')!.value % 24
  const m = +parts.find(p => p.type === 'minute')!.value
  return DAYS.indexOf(wd) * 1440 + h * 60 + m
}
export function clockLabel(t: number) {
  const tt = ((t % WEEK) + WEEK) % WEEK
  const d = Math.floor(tt / 1440), m = Math.floor(tt % 1440)
  return `${DAYS[d]} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
/** Which of the six story lines the simulated clock is "in". */
export function storyIndex(t: number) {
  const tt = ((t % WEEK) + WEEK) % WEEK
  const d = Math.floor(tt / 1440), m = tt % 1440
  if (d === 0 && m >= 525 && m < 720) return 5
  if (m >= 300 && m < 420) return 0
  if (m >= 420 && m < 600) return 1
  if ((m >= 600 && m < 720) || (m >= 960 && m < 1080)) return 2
  if (m >= 1290 && m < 1380) return 4
  if (m % 60 < 8) return 4
  return 3
}
