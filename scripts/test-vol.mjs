// Numeric acceptance tests for the QVR lab models (src/ui/labs/qvr-math.ts). Run: node scripts/test-vol.mjs
// Node >= 22.18 strips the TypeScript types on import, so the tests exercise the exact file the lab ships.
import * as M from '../src/ui/labs/qvr-math.ts'

let failed = 0
const ok = (cond, msg, extra = '') => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${extra ? '  ' + extra : ''}`) }
const rnd = M.mulberry(20251006)
const U = (a, b) => a + (b - a) * rnd()

// ---- normal CDF vs an independent power series (Marsaglia 2004), |err| < 1e-15 ----
const series = x => { let t = x, s = x; for (let i = 1; i < 500; i++) { t *= x * x / (2 * i + 1); s += t; if (Math.abs(t) < 1e-20) break } return 0.5 + s * Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) }
let cdfErr = 0
for (let x = -7; x <= 7; x += 0.003) cdfErr = Math.max(cdfErr, Math.abs(M.normCdf(x) - series(x)))
ok(cdfErr < 1e-14, 'normCdf matches the power series on [-7, 7]', `max err ${cdfErr.toExponential(2)}`)

// ---- (i) Durrleman g(k) >= 0 on a 200 x 40 grid whenever eta(1+|rho|) <= 2 ----
// The sufficient condition is for the power-law phi with gamma <= 1/2; for gamma > 1/2 the product
// theta*phi^2 grows without bound as theta -> 0 and the very short end can break (shown below).
let cases = 0, worstG = Infinity
const tryP = p => { const s = M.scanArb(p, 200, 40); cases++; if (s.minG < worstG) worstG = s.minG }
for (const rho of [-0.95, -0.7, -0.3, 0, 0.3, 0.7, 0.95]) for (const gamma of [0.05, 0.25, 0.5]) for (const f of [0.25, 0.6, 1]) {
  const eta = (2 / (1 + Math.abs(rho))) * f // from comfortably inside to exactly on the boundary
  for (const level of [0.08, 0.17, 0.45]) for (const slope of [-0.5, 0.35, 0.9]) tryP({ level, slope, rho, eta, gamma })
}
for (let i = 0; i < 400; i++) {
  const rho = U(-0.95, 0.95), gamma = U(0.05, 0.5)
  tryP({ level: U(0.06, 0.6), slope: U(-0.6, 0.9), rho, eta: U(0.05, 2 / (1 + Math.abs(rho))), gamma })
}
ok(worstG >= -1e-12, `g(k) >= 0 on 200x40 for ${cases} parameter sets with eta(1+|rho|) <= 2, gamma <= 1/2`, `min g = ${worstG.toExponential(3)}`)
const bad = M.scanArb({ ...M.DEFAULTS, eta: 3, rho: -0.9 }, 200, 40)
ok(bad.butterfly > 0 && bad.minG < 0, 'detector flags butterfly arbitrage when eta(1+|rho|) is far past 2', `${bad.butterfly}/8000 points, min g = ${bad.minG.toFixed(3)}`)
const bad2 = M.scanArb({ ...M.DEFAULTS, gamma: 0.8 }, 200, 40)
ok(bad2.butterfly > 0, 'detector flags the short-end butterfly break for gamma > 1/2', `${bad2.butterfly}/8000 points`)
const defaults = M.scanArb(M.DEFAULTS, 200, 40)
ok(defaults.butterfly === 0 && defaults.calendar === 0, 'default surface is clean on both conditions', `min g ${defaults.minG.toFixed(3)}, min dw/dT ${defaults.minCal.toFixed(4)}`)

// analytic derivatives inside g vs numerical derivatives of w
{
  const p = { level: 0.2, slope: 0.3, rho: -0.55, eta: 1.1, gamma: 0.4 }
  let m = 0
  for (const T of [0.05, 0.3, 1.2]) for (const k of [-0.4, -0.1, 0, 0.2, 0.35]) {
    const h = 1e-5, w = M.ssviW(p, k, T)
    const w1 = (M.ssviW(p, k + h, T) - M.ssviW(p, k - h, T)) / (2 * h)
    const w2 = (M.ssviW(p, k + h, T) - 2 * w + M.ssviW(p, k - h, T)) / (h * h)
    const g = (1 - k * w1 / (2 * w)) ** 2 - 0.25 * w1 * w1 * (1 / w + 0.25) + 0.5 * w2
    m = Math.max(m, Math.abs(g - M.durrleman(p, k, T)))
  }
  ok(m < 1e-4, 'analytic g(k) matches finite differences of w(k)', `max diff ${m.toExponential(2)}`)
}
ok(Math.abs(M.ssviW(M.DEFAULTS, 0, 0.75) - M.theta(M.DEFAULTS, 0.75)) < 1e-15, 'w(0, T) equals the ATM total variance theta(T)')

// ---- calendar: dw/dT >= 0 ----
const steep = M.scanArb({ ...M.DEFAULTS, slope: -0.85 }, 200, 40)
ok(steep.calendar > 0 && steep.minCal < 0, 'detector flags calendar arbitrage for a steeply inverted term structure', `${steep.calendar} points, min dw/dT = ${steep.minCal.toFixed(4)}`)
let calOk = true
for (let i = 0; i < 200; i++) { const s = M.scanArb({ level: U(0.06, 0.6), slope: U(-0.6, 0.9), rho: U(-0.95, 0.95), eta: U(0.05, 2), gamma: U(0.05, 0.95) }, 60, 24); if (s.calendar) calOk = false }
ok(calOk, 'no calendar flag for slope >= -0.6, gamma <= 0.95 (theta increasing, theta*phi increasing)')

// ---- (ii) Black-76 Greeks vs central finite differences ----
let eD = 0, eG = 0, eV = 0
const price = (F, K, T, s, r, c) => M.black76(F, K, T, s, r, c).price
for (let i = 0; i < 300; i++) {
  const F = U(60, 160), K = F * Math.exp(U(-0.45, 0.4)), T = U(7 / 365, 2), s = U(0.08, 0.9), r = U(0, 0.06), call = i % 2 === 0
  const g = M.black76(F, K, T, s, r, call)
  const hF = F * 1e-4, hs = 1e-5
  const dFD = (price(F + hF, K, T, s, r, call) - price(F - hF, K, T, s, r, call)) / (2 * hF)
  const gFD = (price(F + hF, K, T, s, r, call) - 2 * g.price + price(F - hF, K, T, s, r, call)) / (hF * hF)
  const vFD = (price(F, K, T, s + hs, r, call) - price(F, K, T, s - hs, r, call)) / (2 * hs)
  eD = Math.max(eD, Math.abs(g.delta - dFD)); eG = Math.max(eG, Math.abs(g.gamma - gFD)); eV = Math.max(eV, Math.abs(g.vega - vFD))
}
ok(eD < 1e-4, 'delta matches central finite difference', `max abs err ${eD.toExponential(2)}`)
ok(eG < 1e-4, 'gamma matches central finite difference', `max abs err ${eG.toExponential(2)}`)
ok(eV < 1e-4, 'vega matches central finite difference', `max abs err ${eV.toExponential(2)}`)

// ---- (iii) put-call parity: C - P = D (F - K) ----
let eP = 0
for (let i = 0; i < 2000; i++) {
  const F = U(20, 300), K = F * Math.exp(U(-0.5, 0.45)), T = U(7 / 365, 2), s = U(0.05, 1.2), r = U(-0.01, 0.07)
  const C = M.black76(F, K, T, s, r, true).price, P = M.black76(F, K, T, s, r, false).price
  eP = Math.max(eP, Math.abs(C - P - Math.exp(-r * T) * (F - K)))
}
ok(eP < 1e-9, 'put-call parity C - P = D(F - K) on 2000 random cases', `max residual ${eP.toExponential(2)}`)
{ const a = M.black76(100, 100, 0.5, 0.2, 0, true); ok(Math.abs(a.price - 5.6370) < 5e-4, 'ATM call, F=K=100, T=0.5, sigma=0.2, r=0 is about 5.637', `got ${a.price.toFixed(4)}`) }

// ---- rebalancing sketch ----
const near = (a, b) => Math.abs(a - b) < 1e-12
ok(near(M.rebalanceFlow(2, 0.01, 1), 0.02) && near(M.rebalanceFlow(3, 0.01, 1), 0.06) && near(M.rebalanceFlow(-1, 0.01, 1), 0.02) && near(M.rebalanceFlow(-2, -0.02, 2), -0.24), 'L(L-1) r AUM: +2x +1% -> 0.02, +3x -> 0.06, -1x +1% -> 0.02, -2x -2% AUM 2 -> -0.24')
ok(M.bumpAt(1, 3, 0.02) < M.bumpAt(1, 0, 0.02) && M.bumpAt(1, 0, 1) < M.bumpAt(1, 0, 0.02), 'bump decays over sessions and fades with maturity')
const pth = M.intradayPath(7, 0.013)
ok(Math.abs(pth[78] - 0.013) < 1e-6 && pth[0] === 0, 'intraday path starts at 0 and closes on the day return')

// ---- slice fit recovers a noiseless SSVI slice ----
{
  const T = 0.25, th = M.theta(M.DEFAULTS, T), ph = M.phi(M.DEFAULTS, th), ks = [], sg = []
  for (let i = 0; i < 25; i++) { const k = -0.4 + i * 0.03; ks.push(k); sg.push(M.ssviSigma(M.DEFAULTS, k, T)) }
  const f = M.fitSlice(ks, sg, T, { theta: th * 1.2, rho: -0.3, phi: ph * 0.7 })
  ok(f.rmse < 1e-5, 'Nelder-Mead slice fit recovers noiseless quotes', `rmse ${f.rmse.toExponential(2)}, rho ${f.rho.toFixed(3)} vs ${M.DEFAULTS.rho}`)
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed')
process.exit(failed ? 1 : 0)
