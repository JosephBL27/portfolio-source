// The coupled-ODE couple model from the Love Island paper, for the lab. Illustrative parameters only (the paper does not estimate them from data).
//   dA/dt = -aA*A + bA*B + gA*S(t) + d*A*B        dB/dt = -aB*B + bB*A + gB*S(t) + d*A*B
// A, B are the two partners' affection; S(t) is the appeal term, 1 plus any public-vote shocks, which decay.
export interface Params { aA: number; aB: number; bA: number; bB: number; g: number; d: number }
export interface Shock { t0: number; s: number }
export const DEFAULTS: Params = { aA: 0.6, aB: 0.5, bA: 0.25, bB: 0.3, g: 0.5, d: 0 }
export const TAU = 3
export const CAP = 6

export const appeal = (t: number, shocks: Shock[]) => { let s = 1; for (const k of shocks) if (t >= k.t0) s += k.s * Math.exp(-(t - k.t0) / TAU); return s }

function f(p: Params, S: number, A: number, B: number): [number, number] {
  return [-p.aA * A + p.bA * B + p.g * S + p.d * A * B, -p.aB * B + p.bB * A + p.g * S + p.d * A * B]
}
/** one RK4 step of size dt from time t */
export function rk4(p: Params, shocks: Shock[], t: number, A: number, B: number, dt: number): [number, number] {
  const S0 = appeal(t, shocks), S1 = appeal(t + dt / 2, shocks), S2 = appeal(t + dt, shocks)
  const k1 = f(p, S0, A, B), k2 = f(p, S1, A + dt / 2 * k1[0], B + dt / 2 * k1[1]), k3 = f(p, S1, A + dt / 2 * k2[0], B + dt / 2 * k2[1]), k4 = f(p, S2, A + dt * k3[0], B + dt * k3[1])
  return [A + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), B + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])]
}
export const field = (p: Params, A: number, B: number) => f(p, 1, A, B)

export interface Fixed { A: number; B: number; stable: boolean; tr: number; det: number }
/** resting states with no public-vote shock (S = 1), and whether each is stable (trace < 0 and determinant > 0) */
export function fixedPoints(p: Params): Fixed[] {
  const c = p.g, e = 0, q = p.bA + p.aB, k = p.aA + p.bB
  const a2 = p.d * k, a1 = p.bA * k + p.d * e - p.aA * q, a0 = p.bA * e + c * q
  const xs: number[] = []
  if (Math.abs(a2) < 1e-9) { if (Math.abs(a1) > 1e-9) xs.push(-a0 / a1) } else {
    const D = a1 * a1 - 4 * a2 * a0
    if (D >= 0) { const r = Math.sqrt(D); xs.push((-a1 - r) / (2 * a2), (-a1 + r) / (2 * a2)) }
  }
  return xs.map(A => {
    const B = (k * A + e) / q
    const j11 = -p.aA + p.d * B, j12 = p.bA + p.d * A, j21 = p.bB + p.d * B, j22 = -p.aB + p.d * A
    const tr = j11 + j22, det = j11 * j22 - j12 * j21
    return { A, B, tr, det, stable: tr < 0 && det > 0 }
  }).filter(r => Number.isFinite(r.A) && Number.isFinite(r.B))
}
/** a whole run from (A0,B0) with no shocks, for the faint flow lines */
export function trajectory(p: Params, A0: number, B0: number, T = 30, dt = 0.1): [number, number][] {
  const out: [number, number][] = [[A0, B0]]; let A = A0, B = B0
  for (let t = 0; t < T; t += dt) { [A, B] = rk4(p, [], t, A, B, dt); if (!(Math.abs(A) < CAP && Math.abs(B) < CAP)) break; out.push([A, B]) }
  return out
}
