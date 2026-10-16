// Poker core for the Table Model lab: a 7-card evaluator, a preflop hand ranking for opponent ranges, and a Monte Carlo equity estimate.
// Self-contained (no imports) so the browser worker, the main-thread fallback and scripts/test-equity.mjs all run the same code.
// Cards are ints 0..51: rank*4 + suit, rank 0..12 = 2..A, suit 0..3 = s h d c.
export const RANKS = '23456789TJQKA'
export const SUITS = 'shdc'
export const SUIT_GLYPH = ['♠', '♥', '♦', '♣']
export const cardRank = (c: number) => c >> 2
export const cardSuit = (c: number) => c & 3
export const cardName = (c: number) => RANKS[c >> 2] + SUITS[c & 3]

export function mulberryRng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

const rc = new Int8Array(13)
const sm = new Int32Array(4)
const sc = new Int8Array(4)

function straightHigh(mask: number) {
  for (let h = 12; h >= 4; h--) { const m = 31 << (h - 4); if ((mask & m) === m) return h }
  if ((mask & 0x100f) === 0x100f) return 3
  return -1
}
function top5(mask: number) {
  let s = 0, i = 0
  for (let r = 12; r >= 0 && i < 5; r--) if (mask & (1 << r)) { s |= r << (16 - 4 * i); i++ }
  return s
}

/** a number that orders any 7 cards (or 5/6) by poker strength; equal numbers tie */
export function score(cards: ArrayLike<number>, n = cards.length): number {
  rc.fill(0); sm.fill(0); sc.fill(0)
  let all = 0
  for (let i = 0; i < n; i++) { const c = cards[i], r = c >> 2, s = c & 3; rc[r]++; sm[s] |= 1 << r; sc[s]++; all |= 1 << r }
  for (let s = 0; s < 4; s++) {
    if (sc[s] >= 5) {
      const sf = straightHigh(sm[s])
      if (sf >= 0) return (8 << 20) | (sf << 16)
      // a flush can be beaten by quads or a boat, which cannot coexist with 5 suited cards in 7, so it stands
      return (5 << 20) | top5(sm[s])
    }
  }
  let quad = -1
  const trips: number[] = [], pairs: number[] = []
  for (let r = 12; r >= 0; r--) { const k = rc[r]; if (k === 4) quad = r; else if (k === 3) trips.push(r); else if (k === 2) pairs.push(r) }
  if (quad >= 0) { let k = 0; for (let r = 12; r >= 0; r--) if (r !== quad && rc[r]) { k = r; break } return (7 << 20) | (quad << 16) | (k << 12) }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const p = trips.length > 1 ? Math.max(trips[1], pairs.length ? pairs[0] : -1) : pairs[0]
    return (6 << 20) | (trips[0] << 16) | (p << 12)
  }
  const st = straightHigh(all)
  if (st >= 0) return (4 << 20) | (st << 16)
  if (trips.length) {
    let s = (3 << 20) | (trips[0] << 16), sh = 12
    for (let r = 12; r >= 0 && sh >= 8; r--) if (r !== trips[0] && rc[r]) { s |= r << sh; sh -= 4 }
    return s
  }
  if (pairs.length >= 2) {
    let k = 0; for (let r = 12; r >= 0; r--) if (r !== pairs[0] && r !== pairs[1] && rc[r]) { k = r; break }
    return (2 << 20) | (pairs[0] << 16) | (pairs[1] << 12) | (k << 8)
  }
  if (pairs.length === 1) {
    let s = (1 << 20) | (pairs[0] << 16), sh = 12
    for (let r = 12; r >= 0 && sh >= 4; r--) if (r !== pairs[0] && rc[r]) { s |= r << sh; sh -= 4 }
    return s
  }
  return top5(all)
}

/** Chen-style preflop strength, used only to order hands into "top X%" ranges */
function chen(r1: number, r2: number, suited: boolean) {
  const hi = Math.max(r1, r2), lo = Math.min(r1, r2)
  const pts = (r: number) => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2)
  let s = pts(hi)
  if (hi === lo) return Math.max(5, s * 2) + hi * 0.01
  if (suited) s += 2
  const gap = hi - lo - 1
  s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5
  if (gap <= 1 && hi < 10) s += 1
  return s + hi * 0.01 + lo * 0.001
}

const rangeCache = new Map<number, Int8Array>()
/** every two-card combo in the top `pct` (0..1) of starting hands, as a flat [a,b,a,b,...] array */
export function rangeCombos(pct: number): Int8Array {
  const key = Math.round(pct * 1000)
  const hit = rangeCache.get(key); if (hit) return hit
  const all: { a: number; b: number; s: number }[] = []
  for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) all.push({ a, b, s: chen(a >> 2, b >> 2, (a & 3) === (b & 3)) })
  all.sort((x, y) => y.s - x.s)
  // keep whole classes: cut where the strength changes after the target count
  let n = Math.max(6, Math.round(all.length * pct))
  while (n < all.length && all[n].s === all[n - 1].s) n++
  const out = new Int8Array(n * 2)
  for (let i = 0; i < n; i++) { out[i * 2] = all[i].a; out[i * 2 + 1] = all[i].b }
  rangeCache.set(key, out)
  return out
}

export interface EquityTally { wins: number; ties: number; n: number }
/** simulate `iters` random runouts. `combos` null = a uniformly random opposing hand. */
export function runEquity(hero: number[], board: number[], combos: Int8Array | null, iters: number, rng: () => number, tally: EquityTally = { wins: 0, ties: 0, n: 0 }): EquityTally {
  const dead = new Uint8Array(52)
  for (const c of hero) dead[c] = 1
  for (const c of board) dead[c] = 1
  const need = 5 - board.length
  const h = new Int8Array(7), o = new Int8Array(7)
  h[0] = hero[0]; h[1] = hero[1]
  for (let i = 0; i < board.length; i++) { h[2 + i] = board[i]; o[2 + i] = board[i] }
  const used: number[] = []
  const draw = () => { for (;;) { const c = (rng() * 52) | 0; if (!dead[c]) { dead[c] = 1; used.push(c); return c } } }
  for (let it = 0; it < iters; it++) {
    used.length = 0
    if (combos) {
      const m = combos.length >> 1
      let a = 0, b = 0, tries = 0
      for (;;) { const k = (rng() * m) | 0; a = combos[k * 2]; b = combos[k * 2 + 1]; if (!dead[a] && !dead[b]) break; if (++tries > 400) { a = -1; break } }
      if (a < 0) continue
      dead[a] = 1; dead[b] = 1; used.push(a, b)
      o[0] = a; o[1] = b
    } else { o[0] = draw(); o[1] = draw() }
    for (let i = 0; i < need; i++) { const c = draw(); h[2 + board.length + i] = c; o[2 + board.length + i] = c }
    const sh = score(h, 7), so = score(o, 7)
    if (sh > so) tally.wins++; else if (sh === so) tally.ties++
    tally.n++
    for (const c of used) dead[c] = 0
  }
  return tally
}
export const equityOf = (t: EquityTally) => (t.n ? (t.wins + t.ties / 2) / t.n : 0)
/** standard error of the equity estimate */
export const equitySE = (t: EquityTally) => { if (!t.n) return 0; const p = equityOf(t); return Math.sqrt(Math.max(p * (1 - p), 0.0001) / t.n) }

/** one expected-value line per option, in big blinds relative to now. P = pot before the opponent's bet, B = the bet to call (0 = checked to us). */
export function priceOptions(eq: number, P: number, B: number, foldFreq: number) {
  const R = B > 0 ? B * 3 : Math.max(1, Math.round(P * 0.66))
  const call = eq * (P + 2 * B) - B
  const raise = foldFreq * (P + B) + (1 - foldFreq) * (eq * (P + 2 * R) - R)
  return { fold: 0, call, raise, R, need: B > 0 ? B / (P + 2 * B) : 0 }
}
