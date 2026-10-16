// Web Worker for the Table Model lab: runs the Monte Carlo in batches so the page never blocks, streaming a running tally.
import { mulberryRng, rangeCombos, runEquity, type EquityTally } from './model-equity'
interface Job { id: number; hero: number[]; board: number[]; pct: number; total: number; batch: number; seed: number }
const ctx = self as unknown as { onmessage: ((e: { data: Job }) => void) | null; postMessage(m: unknown): void }
let latest = 0
ctx.onmessage = e => {
  const j = e.data; latest = j.id
  const rng = mulberryRng(j.seed), combos = j.pct >= 1 ? null : rangeCombos(j.pct), tally: EquityTally = { wins: 0, ties: 0, n: 0 }
  const t0 = performance.now()
  const step = () => {
    if (latest !== j.id) return
    runEquity(j.hero, j.board, combos, j.batch, rng, tally)
    const done = tally.n >= j.total
    ctx.postMessage({ id: j.id, wins: tally.wins, ties: tally.ties, n: tally.n, done, ms: performance.now() - t0 })
    if (!done) setTimeout(step, 0)
  }
  step()
}
