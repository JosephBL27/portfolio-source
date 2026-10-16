// A small, complete chess rules engine for the cabinet's replay of the Opera Game (Morphy vs the Duke of Brunswick and Count Isouard, Paris 1858,
// a public-domain game). It exists so the 3D board never plays a move the rules do not allow: every SAN token is resolved against the generated
// LEGAL moves of the current position (king safety, castling rights and path, en passant, promotion, disambiguation), exactly one may match, and
// the replay is built from the result. `scripts/test-opera.mjs` replays the game and checks the final position.
// Erasable TypeScript only (no enums / parameter properties), so Node can run this file directly.
export type Colour = 'w' | 'b'
export type Kind = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'
/** a piece is its FEN letter: upper case white, lower case black */
export type Piece = string
/** board[rank][file], rank 0 = rank 1 (White's back rank), file 0 = a */
export type Board = (Piece | null)[][]
export interface Position { board: Board; turn: Colour; castle: { K: boolean; Q: boolean; k: boolean; q: boolean }; ep: [number, number] | null; half: number; full: number }
export interface Move {
  from: [number, number]; to: [number, number]; piece: Piece
  capture: Piece | null; captureAt: [number, number] | null
  promote: Piece | null
  castle: null | { rookFrom: [number, number]; rookTo: [number, number] }
  san: string
  check: boolean; mate: boolean
}

export const colourOf = (p: Piece): Colour => (p === p.toUpperCase() ? 'w' : 'b')
export const kindOf = (p: Piece): Kind => p.toUpperCase() as Kind
const FILES = 'abcdefgh'
export const sq = (f: number, r: number) => FILES[f] + (r + 1)
export const parseSq = (s: string): [number, number] => [FILES.indexOf(s[0]), Number(s[1]) - 1]

export function startPosition(): Position {
  const board: Board = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null))
  const back = 'RNBQKBNR'
  for (let f = 0; f < 8; f++) { board[0][f] = back[f]; board[1][f] = 'P'; board[6][f] = 'p'; board[7][f] = back[f].toLowerCase() }
  return { board, turn: 'w', castle: { K: true, Q: true, k: true, q: true }, ep: null, half: 0, full: 1 }
}

const cloneBoard = (b: Board): Board => b.map(r => r.slice())
const inside = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8
const KNIGHT: [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const KING: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
const DIAG: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
const ORTH: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/** is square (f, r) attacked by any piece of colour `by`? */
export function attacked(board: Board, f: number, r: number, by: Colour): boolean {
  const own = (p: Piece | null, k: string) => !!p && colourOf(p) === by && p.toUpperCase() === k
  const pr = by === 'w' ? r - 1 : r + 1                           // a pawn of `by` attacks diagonally forward: it stands one rank behind the target
  for (const df of [-1, 1]) if (inside(f + df, pr) && own(board[pr][f + df], 'P')) return true
  for (const [df, dr] of KNIGHT) if (inside(f + df, r + dr) && own(board[r + dr][f + df], 'N')) return true
  for (const [df, dr] of KING) if (inside(f + df, r + dr) && own(board[r + dr][f + df], 'K')) return true
  for (const [df, dr] of DIAG) for (let x = f + df, y = r + dr; inside(x, y); x += df, y += dr) { const p = board[y][x]; if (p) { if (own(p, 'B') || own(p, 'Q')) return true; break } }
  for (const [df, dr] of ORTH) for (let x = f + df, y = r + dr; inside(x, y); x += df, y += dr) { const p = board[y][x]; if (p) { if (own(p, 'R') || own(p, 'Q')) return true; break } }
  return false
}
const kingOf = (board: Board, c: Colour): [number, number] => {
  const k = c === 'w' ? 'K' : 'k'
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) if (board[r][f] === k) return [f, r]
  throw new Error('no king')
}
export const inCheck = (pos: Position, c: Colour): boolean => { const [f, r] = kingOf(pos.board, c); return attacked(pos.board, f, r, c === 'w' ? 'b' : 'w') }

type Raw = Omit<Move, 'san' | 'check' | 'mate'>
function pseudo(pos: Position): Raw[] {
  const out: Raw[] = [], b = pos.board, me = pos.turn, foe: Colour = me === 'w' ? 'b' : 'w'
  const push = (from: [number, number], to: [number, number], piece: Piece, extra: Partial<Raw> = {}) => {
    const t = b[to[1]][to[0]]
    out.push({ from, to, piece, capture: t, captureAt: t ? to : null, promote: null, castle: null, ...extra })
  }
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = b[r][f]; if (!p || colourOf(p) !== me) continue
    const k = kindOf(p), from: [number, number] = [f, r]
    if (k === 'P') {
      const dir = me === 'w' ? 1 : -1, start = me === 'w' ? 1 : 6, last = me === 'w' ? 7 : 0
      const promo = (to: [number, number], extra: Partial<Raw>) => {
        if (to[1] === last) for (const q of 'QRBN') push(from, to, p, { ...extra, promote: me === 'w' ? q : q.toLowerCase() })
        else push(from, to, p, extra)
      }
      if (inside(f, r + dir) && !b[r + dir][f]) {
        promo([f, r + dir], { capture: null, captureAt: null })
        if (r === start && !b[r + 2 * dir][f]) push(from, [f, r + 2 * dir], p, { capture: null, captureAt: null })
      }
      for (const df of [-1, 1]) {
        const x = f + df, y = r + dir; if (!inside(x, y)) continue
        const t = b[y][x]
        if (t && colourOf(t) === foe) promo([x, y], { capture: t, captureAt: [x, y] })
        else if (!t && pos.ep && pos.ep[0] === x && pos.ep[1] === y) push(from, [x, y], p, { capture: b[r][x], captureAt: [x, r] })
      }
    } else if (k === 'N' || k === 'K') {
      for (const [df, dr] of k === 'N' ? KNIGHT : KING) {
        const x = f + df, y = r + dr; if (!inside(x, y)) continue
        const t = b[y][x]; if (t && colourOf(t) === me) continue
        push(from, [x, y], p)
      }
      if (k === 'K') {
        const rank = me === 'w' ? 0 : 7
        if (f === 4 && r === rank && !attacked(b, 4, rank, foe)) {
          const rk = me === 'w' ? 'R' : 'r'
          if ((me === 'w' ? pos.castle.K : pos.castle.k) && b[rank][7] === rk && !b[rank][5] && !b[rank][6] && !attacked(b, 5, rank, foe) && !attacked(b, 6, rank, foe))
            push(from, [6, rank], p, { castle: { rookFrom: [7, rank], rookTo: [5, rank] } })
          if ((me === 'w' ? pos.castle.Q : pos.castle.q) && b[rank][0] === rk && !b[rank][1] && !b[rank][2] && !b[rank][3] && !attacked(b, 3, rank, foe) && !attacked(b, 2, rank, foe))
            push(from, [2, rank], p, { castle: { rookFrom: [0, rank], rookTo: [3, rank] } })
        }
      }
    } else {
      const dirs = k === 'B' ? DIAG : k === 'R' ? ORTH : [...DIAG, ...ORTH]
      for (const [df, dr] of dirs) for (let x = f + df, y = r + dr; inside(x, y); x += df, y += dr) {
        const t = b[y][x]
        if (t) { if (colourOf(t) !== me) push(from, [x, y], p); break }
        push(from, [x, y], p)
      }
    }
  }
  return out
}

/** play a raw move on a copy of the position (no SAN, no check flags) */
function play(pos: Position, m: Raw): Position {
  const b = cloneBoard(pos.board)
  if (m.captureAt) b[m.captureAt[1]][m.captureAt[0]] = null
  b[m.from[1]][m.from[0]] = null
  b[m.to[1]][m.to[0]] = m.promote ?? m.piece
  if (m.castle) { b[m.castle.rookFrom[1]][m.castle.rookFrom[0]] = null; b[m.castle.rookTo[1]][m.castle.rookTo[0]] = pos.turn === 'w' ? 'R' : 'r' }
  const castle = { ...pos.castle }
  const k = kindOf(m.piece)
  if (k === 'K') { if (pos.turn === 'w') { castle.K = false; castle.Q = false } else { castle.k = false; castle.q = false } }
  const touch = (s: [number, number]) => { if (s[0] === 0 && s[1] === 0) castle.Q = false; if (s[0] === 7 && s[1] === 0) castle.K = false; if (s[0] === 0 && s[1] === 7) castle.q = false; if (s[0] === 7 && s[1] === 7) castle.k = false }
  touch(m.from); touch(m.to)
  const ep: [number, number] | null = k === 'P' && Math.abs(m.to[1] - m.from[1]) === 2 ? [m.from[0], (m.from[1] + m.to[1]) / 2] : null
  return { board: b, turn: pos.turn === 'w' ? 'b' : 'w', castle, ep, half: k === 'P' || m.capture ? 0 : pos.half + 1, full: pos.full + (pos.turn === 'b' ? 1 : 0) }
}

/** every legal move of the side to move (SAN, check and mate flags filled in) */
export function legalMoves(pos: Position): Move[] {
  const raws = pseudo(pos).filter(m => !inCheck(play(pos, m), pos.turn))
  return raws.map(m => {
    const next = play(pos, m)
    const check = inCheck(next, next.turn)
    const mate = check && pseudo(next).every(n => inCheck(play(next, n), next.turn))
    return { ...m, san: sanOf(pos, m, raws) + (mate ? '#' : check ? '+' : ''), check, mate }
  })
}
function sanOf(pos: Position, m: Raw, all: Raw[]): string {
  if (m.castle) return m.to[0] === 6 ? 'O-O' : 'O-O-O'
  const k = kindOf(m.piece)
  let s = ''
  if (k === 'P') { if (m.capture) s += FILES[m.from[0]] + 'x'; s += sq(...m.to); if (m.promote) s += '=' + m.promote.toUpperCase(); return s }
  s += k
  const rivals = all.filter(o => o.piece === m.piece && o.to[0] === m.to[0] && o.to[1] === m.to[1] && (o.from[0] !== m.from[0] || o.from[1] !== m.from[1]))
  if (rivals.length) {
    if (rivals.every(o => o.from[0] !== m.from[0])) s += FILES[m.from[0]]
    else if (rivals.every(o => o.from[1] !== m.from[1])) s += m.from[1] + 1
    else s += sq(...m.from)
  }
  return s + (m.capture ? 'x' : '') + sq(...m.to)
}

export function applyMove(pos: Position, m: Move): Position { return play(pos, m) }

/** resolve a SAN token (check marks optional) to the one legal move it names, or throw */
export function moveFromSan(pos: Position, token: string): Move {
  const norm = (s: string) => s.replace(/[+#!?]/g, '').replace(/0/g, 'O')
  const want = norm(token)
  const hits = legalMoves(pos).filter(m => norm(m.san) === want)
  if (hits.length !== 1) throw new Error(`"${token}" matches ${hits.length} legal moves at ${fen(pos)}`)
  return hits[0]
}

export function fen(pos: Position): string {
  const rows: string[] = []
  for (let r = 7; r >= 0; r--) {
    let s = '', n = 0
    for (let f = 0; f < 8; f++) { const p = pos.board[r][f]; if (!p) n++; else { if (n) { s += n; n = 0 } s += p } }
    rows.push(s + (n ? n : ''))
  }
  const c = (pos.castle.K ? 'K' : '') + (pos.castle.Q ? 'Q' : '') + (pos.castle.k ? 'k' : '') + (pos.castle.q ? 'q' : '')
  return `${rows.join('/')} ${pos.turn} ${c || '-'} ${pos.ep ? sq(...pos.ep) : '-'} ${pos.half} ${pos.full}`
}

// ---- the game
/** Morphy - Duke of Brunswick and Count Isouard, Paris 1858 (the Opera Game), movetext only */
export const OPERA_GAME = [
  'e4', 'e5', 'Nf3', 'd6', 'd4', 'Bg4', 'dxe5', 'Bxf3', 'Qxf3', 'dxe5', 'Bc4', 'Nf6', 'Qb3', 'Qe7', 'Nc3', 'c6', 'Bg5', 'b5',
  'Nxb5', 'cxb5', 'Bxb5+', 'Nbd7', 'O-O-O', 'Rd8', 'Rxd7', 'Rxd7', 'Rd1', 'Qe6', 'Bxd7+', 'Nxd7', 'Qb8+', 'Nxb8', 'Rd8#',
]
/** the final position of the Opera Game (Black has just been mated), as published */
export const OPERA_FINAL_FEN = '1n1Rkb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2K5 b k - 1 17'

export interface Ply { move: Move; before: Position; after: Position }
/** play a SAN list from the start (or from `from`), returning every ply with its position before and after */
export function replay(sans: readonly string[], from: Position = startPosition()): Ply[] {
  const out: Ply[] = []
  let pos = from
  for (const s of sans) { const move = moveFromSan(pos, s); const after = applyMove(pos, move); out.push({ move, before: pos, after }); pos = after }
  return out
}
