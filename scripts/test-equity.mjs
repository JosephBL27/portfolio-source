// Poker equity sanity check for the Table Model lab: AA vs a random hand preflop is about 85%; also a few evaluator and range checks.
// usage: node scripts/test-equity.mjs   (needs a Node that runs .ts directly, 22.18+)
import { score, runEquity, equityOf, mulberryRng, rangeCombos, priceOptions } from '../src/ui/labs/lib/model-equity.ts'
const c = s => 'shdc'.length && ('23456789TJQKA'.indexOf(s[0]) * 4 + 'shdc'.indexOf(s[1]))
let bad = 0
const ok = (name, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + ' ' + extra); if (!cond) bad++ }
const t = runEquity([c('As'), c('Ah')], [], null, 300000, mulberryRng(7))
const eq = equityOf(t) * 100
ok('AA vs random hand ~ 85%', Math.abs(eq - 85.2) <= 2, eq.toFixed(2) + '%')
const t2 = runEquity([c('7s'), c('2h')], [], null, 200000, mulberryRng(9))
ok('72o vs random ~ 35%', Math.abs(equityOf(t2) * 100 - 34.6) <= 2, (equityOf(t2) * 100).toFixed(2) + '%')
const t3 = runEquity([c('As'), c('Ks')], [], null, 200000, mulberryRng(3))
ok('AKs vs random ~ 67%', Math.abs(equityOf(t3) * 100 - 67) <= 2, (equityOf(t3) * 100).toFixed(2) + '%')
const sc = h => score(h.map(c))
ok('flush > straight', sc(['As', 'Ks', '9s', '4s', '2s', '3d', '7c']) > sc(['9s', '8h', '7d', '6c', '5s', '2d', 'Kc']))
ok('wheel is a straight, 6-high beats it', sc(['Ah', '2d', '3c', '4s', '5h', 'Kd', '9c']) < sc(['6h', '2d', '3c', '4s', '5h', 'Kd', '9c']))
ok('full house > flush', sc(['Ks', 'Kh', 'Kd', '2c', '2s', '9h', '4d']) > sc(['As', 'Ks', '9s', '4s', '2s', '3d', '7c']))
ok('kicker decides pair', sc(['As', 'Ah', 'Kd', '3c', '2s', '9h', '4d']) > sc(['Ac', 'Ad', 'Qd', '3h', '2d', '9s', '4c']))
const top5 = rangeCombos(0.05)
ok('top 5% range is ~66 combos', top5.length / 2 >= 60 && top5.length / 2 <= 90, String(top5.length / 2))
const p = priceOptions(0.5, 10, 5, 0.3)
ok('pot odds: call 5 into 10 needs 25%', Math.abs(p.need - 0.25) < 1e-9)
ok('EV call at 50% equity = 0.5*20-5 = 5', Math.abs(p.call - 5) < 1e-9, String(p.call))
console.log(bad ? `${bad} FAILED` : 'all passed'); process.exit(bad ? 1 : 0)
