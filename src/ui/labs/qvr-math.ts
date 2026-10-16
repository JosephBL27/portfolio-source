// Textbook volatility models for the QVR lab. Pure functions, no DOM, no imports (so node can load it
// directly in scripts/test-vol.mjs). Illustrative model with invented parameters: this is NOT QVR's
// data, code or results, and it says nothing about how QVR models anything.
//
//   SSVI  : Gatheral & Jacquier (2014), "Arbitrage-free SVI volatility surfaces", Quantitative Finance 14(1).
//           w(k,theta) = theta/2 * (1 + rho*phi*k + sqrt((phi*k + rho)^2 + 1 - rho^2)),
//           phi(theta) = eta / (theta^gamma * (1+theta)^(1-gamma)),  sigma = sqrt(w / T).
//   Flows : Cheng & Madhavan (2009), "The Dynamics of Leveraged and Inverse Exchange-Traded Funds",
//           Journal of Investment Management 7(4): a daily-reset fund of leverage L must trade
//           about L(L-1) * r * AUM near the close.

export interface SSVIParams {
  /** short-end ATM implied vol (T -> 0) */
  level: number
  /** long-end ATM uplift: sigma_atm(inf) = level * (1 + slope) */
  slope: number
  rho: number
  eta: number
  gamma: number
}

export const DEFAULTS: SSVIParams = { level: 0.17, slope: 0.35, rho: -0.7, eta: 0.8, gamma: 0.5 }
export const K_MIN = -0.5
export const K_MAX = 0.4
export const T_MIN = 7 / 365
export const T_MAX = 2
export const TAU = 0.6 // years, time constant of the ATM term structure
export const RATE = 0.03 // continuously compounded rate for the discount factor in the readout
export const FWD = 100 // illustrative forward level for the Black-76 readout

/** log-spaced maturity from a 0..1 coordinate */
export const tOf = (u: number): number => T_MIN * Math.pow(T_MAX / T_MIN, u)
export const uOf = (T: number): number => Math.log(T / T_MIN) / Math.log(T_MAX / T_MIN)
export const kOf = (u: number): number => K_MIN + (K_MAX - K_MIN) * u

export const atmVol = (p: SSVIParams, T: number): number => p.level * (1 + p.slope * (1 - Math.exp(-T / TAU)))
/** ATM total variance theta(T) = sigma_atm(T)^2 * T */
export const theta = (p: SSVIParams, T: number): number => { const s = atmVol(p, T); return s * s * T }
export const phi = (p: SSVIParams, th: number): number => p.eta / (Math.pow(th, p.gamma) * Math.pow(1 + th, 1 - p.gamma))

/** SSVI total implied variance at log-moneyness k = ln(K/F) and maturity T (years) */
export function ssviW(p: SSVIParams, k: number, T: number): number {
  const th = theta(p, T), ph = phi(p, th), x = ph * k + p.rho
  return 0.5 * th * (1 + p.rho * ph * k + Math.sqrt(x * x + 1 - p.rho * p.rho))
}
export const ssviSigma = (p: SSVIParams, k: number, T: number): number => Math.sqrt(Math.max(ssviW(p, k, T), 1e-12) / T)

/** Durrleman's g(k): the butterfly (density) condition. g >= 0 for all k means no butterfly arbitrage. */
export function durrleman(p: SSVIParams, k: number, T: number): number {
  const th = theta(p, T), ph = phi(p, th), r = p.rho
  const x = ph * k + r, R = Math.sqrt(x * x + 1 - r * r)
  const w = 0.5 * th * (1 + r * ph * k + R)
  const w1 = 0.5 * th * ph * (r + x / R)
  const w2 = 0.5 * th * ph * ph * (1 - r * r) / (R * R * R)
  const a = 1 - (k * w1) / (2 * w)
  return a * a - 0.25 * w1 * w1 * (1 / w + 0.25) + 0.5 * w2
}
/** Calendar condition: dw/dT at fixed k, by central difference (relative step). Must be >= 0. */
export function dwdT(p: SSVIParams, k: number, T: number): number {
  const h = T * 1e-3
  return (ssviW(p, k, T + h) - ssviW(p, k, T - h)) / (2 * h)
}
/** Sufficient condition for no butterfly arbitrage on the power-law SSVI (see the lab note) */
export const sufficient = (p: SSVIParams): boolean => p.eta * (1 + Math.abs(p.rho)) <= 2

export interface ArbScan {
  nk: number
  nT: number
  g: Float32Array // nT rows of nk
  cal: Float32Array // dw/dT, same layout
  minG: number
  minCal: number
  butterfly: number // count of grid points with g < -tol
  calendar: number // count of grid points with dw/dT < -tol
}
export function scanArb(p: SSVIParams, nk = 200, nT = 40, tol = 1e-12): ArbScan {
  const g = new Float32Array(nk * nT), cal = new Float32Array(nk * nT)
  let minG = Infinity, minCal = Infinity, butterfly = 0, calendar = 0
  for (let j = 0; j < nT; j++) {
    const T = tOf(j / (nT - 1))
    for (let i = 0; i < nk; i++) {
      const k = kOf(i / (nk - 1))
      const gv = durrleman(p, k, T), cv = dwdT(p, k, T)
      g[j * nk + i] = gv; cal[j * nk + i] = cv
      if (gv < minG) minG = gv
      if (cv < minCal) minCal = cv
      if (gv < -tol) butterfly++
      if (cv < -tol) calendar++
    }
  }
  return { nk, nT, g, cal, minG, minCal, butterfly, calendar }
}

// ---------------------------------------------------------------------------------------------------
// Black-76 (Black-Scholes on a forward). All sensitivities are for the option, with D = exp(-r T).
// ---------------------------------------------------------------------------------------------------
/** Standard normal CDF, double precision (West 2005, after Hart 1968): error below 1e-15, exactly symmetric */
export function normCdf(x: number): number {
  const a = Math.abs(x)
  let c: number
  if (a > 37) c = 0
  else {
    const e = Math.exp(-a * a / 2)
    if (a < 7.07106781186547) {
      let b = 3.52624965998911e-2 * a + 0.700383064443688
      b = b * a + 6.37396220353165
      b = b * a + 33.912866078383
      b = b * a + 112.079291497871
      b = b * a + 221.213596169931
      b = b * a + 220.206867912376
      c = e * b
      b = 8.83883476483184e-2 * a + 1.75566716318264
      b = b * a + 16.064177579207
      b = b * a + 86.7807322029461
      b = b * a + 296.564248779674
      b = b * a + 637.333633378831
      b = b * a + 793.826512519948
      b = b * a + 440.413735824752
      c = c / b
    } else {
      let b = a + 0.65
      b = a + 4 / b
      b = a + 3 / b
      b = a + 2 / b
      b = a + 1 / b
      c = e / b / 2.506628274631
    }
  }
  return x > 0 ? 1 - c : c
}
export const normPdf = (x: number): number => Math.exp(-0.5 * x * x) / 2.5066282746310002

export interface BlackOut { price: number; delta: number; gamma: number; vega: number; d1: number; d2: number }
export function black76(F: number, K: number, T: number, sigma: number, r: number, call: boolean): BlackOut {
  const D = Math.exp(-r * T), sq = sigma * Math.sqrt(T)
  const d1 = (Math.log(F / K) + 0.5 * sigma * sigma * T) / sq, d2 = d1 - sq
  const pdf = normPdf(d1)
  const price = call ? D * (F * normCdf(d1) - K * normCdf(d2)) : D * (K * normCdf(-d2) - F * normCdf(-d1))
  const delta = call ? D * normCdf(d1) : -D * normCdf(-d1)
  return { price, delta, gamma: D * pdf / (F * sq), vega: D * F * pdf * Math.sqrt(T), d1, d2 }
}

// ---------------------------------------------------------------------------------------------------
// Leveraged-ETF rebalancing sketch (mechanism only; every constant below is invented)
// ---------------------------------------------------------------------------------------------------
/** Closing rebalance of a daily-reset fund: L(L-1) * r * AUM. Positive = buy the underlying exposure. */
export const rebalanceFlow = (L: number, r: number, aum: number): number => L * (L - 1) * r * aum
export const BUMP = {
  max: 0.03, // largest short-dated vol bump, in vol (0.03 = 3 vol points)
  flowScale: 1.0, // flow at which the bump reaches ~63% of max (illustrative, $bn)
  tau: 1.8, // sessions: e-folding time of the decay
  tMat: 0.09, // years: the bump fades out along maturity as exp(-T/tMat)
}
/** Peak short-dated vol bump (vol) produced by a closing flow of the given size */
export const bumpPeak = (flow: number): number => BUMP.max * (1 - Math.exp(-Math.abs(flow) / BUMP.flowScale))
/** Bump left `sessions` trading days after the close (0 = the close itself), at maturity T */
export const bumpAt = (flow: number, sessions: number, T: number): number =>
  bumpPeak(flow) * Math.exp(-Math.max(sessions, 0) / BUMP.tau) * Math.exp(-T / BUMP.tMat)

export function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const gauss = (rand: () => number): number => { const u = Math.max(rand(), 1e-9); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()) }
/** A deterministic intraday index path (n+1 points, 5-minute bars), a Brownian bridge from 0 to the day return r. */
export function intradayPath(seed: number, r: number, n = 78, dayVol = 0.011): Float32Array {
  const rand = mulberry(seed), w = new Float64Array(n + 1)
  for (let i = 1; i <= n; i++) w[i] = w[i - 1] + gauss(rand) * dayVol / Math.sqrt(n)
  const out = new Float32Array(n + 1)
  for (let i = 0; i <= n; i++) out[i] = w[i] - (i / n) * w[n] + (i / n) * r
  return out
}

// ---------------------------------------------------------------------------------------------------
// Slice fit: re-fit an SSVI slice (theta, rho, phi) to noisy quotes by Nelder-Mead
// ---------------------------------------------------------------------------------------------------
export interface SliceFit { theta: number; rho: number; phi: number; rmse: number }
const sliceW = (th: number, rho: number, ph: number, k: number): number => { const x = ph * k + rho; return 0.5 * th * (1 + rho * ph * k + Math.sqrt(x * x + 1 - rho * rho)) }
export function fitSlice(ks: ArrayLike<number>, sig: ArrayLike<number>, T: number, start: { theta: number; rho: number; phi: number }): SliceFit {
  const cost = (v: number[]): number => {
    const th = v[0], rho = v[1], ph = v[2]
    if (th <= 1e-9 || ph <= 1e-6 || Math.abs(rho) >= 0.999) return 1e9
    let s = 0
    for (let i = 0; i < ks.length; i++) { const m = Math.sqrt(sliceW(th, rho, ph, ks[i]) / T) - sig[i]; s += m * m }
    return s / ks.length
  }
  const x0 = [start.theta, start.rho, start.phi]
  const step = [start.theta * 0.15, 0.12, start.phi * 0.2]
  let sx: number[][] = [x0, ...x0.map((_, i) => x0.map((v, j) => (j === i ? v + step[i] : v)))]
  let f = sx.map(cost)
  for (let it = 0; it < 220; it++) {
    const ord = f.map((_, i) => i).sort((a, b) => f[a] - f[b])
    sx = ord.map(i => sx[i]); f = ord.map(i => f[i])
    if (f[3] - f[0] < 1e-14) break
    const c = [0, 1, 2].map(j => (sx[0][j] + sx[1][j] + sx[2][j]) / 3)
    const at = (a: number) => c.map((v, j) => v + a * (sx[3][j] - v))
    const xr = at(-1), fr = cost(xr)
    if (fr < f[0]) { const xe = at(-2), fe = cost(xe); if (fe < fr) { sx[3] = xe; f[3] = fe } else { sx[3] = xr; f[3] = fr } }
    else if (fr < f[2]) { sx[3] = xr; f[3] = fr }
    else {
      const xc = at(fr < f[3] ? -0.5 : 0.5), fc = cost(xc)
      if (fc < Math.min(fr, f[3])) { sx[3] = xc; f[3] = fc }
      else for (let i = 1; i < 4; i++) { sx[i] = sx[i].map((v, j) => sx[0][j] + 0.5 * (v - sx[0][j])); f[i] = cost(sx[i]) }
    }
  }
  const b = f.indexOf(Math.min(...f))
  return { theta: sx[b][0], rho: sx[b][1], phi: sx[b][2], rmse: Math.sqrt(f[b]) }
}
export const sliceSigma = (f: { theta: number; rho: number; phi: number }, k: number, T: number): number => Math.sqrt(sliceW(f.theta, f.rho, f.phi, k) / T)
