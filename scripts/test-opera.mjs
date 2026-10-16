// Verifies the cabinet's chess replay: every move of the Opera Game (Morphy, Paris 1858) is LEGAL in the position it is played in
// (resolved against the generated legal moves, exactly one match), the game ends in checkmate, and the final position equals the published one.
// usage: node scripts/test-opera.mjs     (Node 22.18+/24 runs the .ts rules file directly)
import { OPERA_GAME, OPERA_FINAL_FEN, replay, fen, legalMoves, startPosition, inCheck } from '../src/v3/world/extras/cabinet/rules.ts'

let fail = 0
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fail++ }

// sanity: perft on the start position (20, 400, 8902 nodes at depths 1-3) proves the move generator itself
const perft = (pos, d, step) => d === 0 ? 1 : legalMoves(pos).reduce((n, m) => n + perft(step(pos, m), d - 1, step), 0)
import { applyMove } from '../src/v3/world/extras/cabinet/rules.ts'
const p0 = startPosition()
ok(perft(p0, 1, applyMove) === 20, 'perft(1) = 20')
ok(perft(p0, 2, applyMove) === 400, 'perft(2) = 400')
ok(perft(p0, 3, applyMove) === 8902, 'perft(3) = 8902')

const plies = replay(OPERA_GAME)
ok(plies.length === 33, `the game has 33 plies (17 moves, Black's 17th never played): got ${plies.length}`)
plies.forEach((p, i) => { if (p.move.san !== OPERA_GAME[i]) { console.log(`  note: ply ${i + 1} SAN ${OPERA_GAME[i]} resolved as ${p.move.san}`); } })
const last = plies[plies.length - 1]
ok(last.move.mate, 'the last move (Rd8) gives checkmate')
ok(inCheck(last.after, 'b') && legalMoves(last.after).length === 0, 'Black is in check with no legal move')
ok(fen(last.after) === OPERA_FINAL_FEN, `final position matches the published one\n   got  ${fen(last.after)}\n   want ${OPERA_FINAL_FEN}`)
const caps = plies.filter(p => p.move.capture).map(p => p.move.san)
console.log('  captures:', caps.join(' '))
ok(plies[22].move.castle !== null && plies[22].move.san === 'O-O-O', 'ply 23 is White\'s queen-side castling (king c1, rook d1)')
console.log(`  ${plies.map((p, i) => (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + p.move.san).join(' ')}`)
process.exit(fail ? 1 : 0)
