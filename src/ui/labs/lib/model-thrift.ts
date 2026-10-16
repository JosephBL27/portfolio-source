// Block randomization for the thrift lab's SYNTHETIC simulation of the design (not the study's data, counts or results).
// Pairs arrive in a store / date / time block; within the block, one "together" and one "apart" slip are shuffled and drawn in turn (permuted blocks of 2),
// so the two arms never differ by more than one pair in any block. A second mode lets pairs pick for themselves, with a made-up preference
// that depends on their covariates, to show what randomizing removes.
export const STORES = ['Store A', 'Store B', 'Store C']
export const SLOTS = ['Date 1 AM', 'Date 1 PM', 'Date 2 AM', 'Date 2 PM']
export const COVS = ['Both 50 or older', 'Arrived by car', 'First visit to this store'] as const
export type Arm = 'together' | 'apart'
export interface Pair { id: number; block: number; cov: boolean[]; arm: Arm }
export type Mode = 'random' | 'choose'

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

export function createExperiment(seed: number, mode: Mode) {
  const r = rng(seed), urns: Arm[][] = Array.from({ length: STORES.length * SLOTS.length }, () => []), pairs: Pair[] = []
  const draw = (b: number): Arm => {
    if (!urns[b].length) urns[b] = r() < 0.5 ? ['together', 'apart'] : ['apart', 'together']
    return urns[b].shift()!
  }
  return {
    pairs, mode,
    arrive(): Pair {
      const block = (r() * urns.length) | 0
      const cov = [r() < 0.3, r() < 0.5, r() < 0.4]
      let arm: Arm
      if (mode === 'random') arm = draw(block)
      else { const pt = 0.5 + (cov[0] ? 0.3 : -0.1) + (cov[1] ? 0.15 : -0.1) - (cov[2] ? 0.25 : 0); arm = r() < Math.min(0.92, Math.max(0.08, pt)) ? 'together' : 'apart' }
      const p: Pair = { id: pairs.length + 1, block, cov, arm }; pairs.push(p); return p
    },
    blockCounts(b: number) { let t = 0, a = 0; for (const p of pairs) if (p.block === b) p.arm === 'together' ? t++ : a++; return [t, a] as const },
    balance() {
      const nT = pairs.filter(p => p.arm === 'together').length, nA = pairs.length - nT
      return COVS.map((name, k) => {
        const pT = nT ? pairs.filter(p => p.arm === 'together' && p.cov[k]).length / nT : 0, pA = nA ? pairs.filter(p => p.arm === 'apart' && p.cov[k]).length / nA : 0
        const sd = Math.sqrt((pT * (1 - pT) + pA * (1 - pA)) / 2), smd = nT > 1 && nA > 1 && sd > 0 ? (pT - pA) / sd : 0
        return { name, pT, pA, smd }
      })
    },
    totals() { const t = pairs.filter(p => p.arm === 'together').length; return [t, pairs.length - t] as const },
  }
}
