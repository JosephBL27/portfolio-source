// TABLE: a 3/4-view poker table (Table Model + Hand Compass). Felt oval with an accent sheen, a padded
// rail, six seat rings, chip stacks, a deck, and seven cards that are DEALT in a loop by anim_table (11 s: deal, hold about 6 s, sweep back):
// two hole cards and five board cards slide from the deck, flip face-up with rank and suit glyphs,
// then everything sweeps back to the deck. Cycle = 11 s (see TBL_CYC).
//
// Particle data layout (pos.w = class):
//   0 dust   1 felt   2 rail   3+0.1*seat seat ring   4 chips   5 deck   6, 7 (reserved: the equity bar, removed in v15)   8 hand-compass ring   9 lamp haze   10 felt lines   11 rail stitching
//   100 + 10*card + layer  (layer 0 outline, 1 face, 2 back); pos.xyz = card-local (x, y, z-offset)
import type { FormDef } from './types'
import { H } from './ctx'

// ---- geometry (world units; y up, +z toward the camera) ----
const FA = 3.55, FB = 2.05           // felt half axes
const RT = 0.17                      // rail tube radius
const RA = FA + RT, RB = FB + RT     // rail centre-line half axes
const SA = 3.0, SB = 1.68            // seat ellipse
const CW = 0.86, CH = 1.2            // card size (v15: x1.35 so the pips and indices are legible at the stop)
const DCW = 0.64, DCH = 0.89         // the deck is the old, smaller size
const DECK: [number, number] = [2.72, -1.32]
const L = (() => { const v = [-0.35, 0.78, 0.52], m = Math.hypot(v[0], v[1], v[2]); return [v[0] / m, v[1] / m, v[2] / m] })()

// cards: [rank, suit]. suits 0 spade, 1 heart, 2 diamond, 3 club. 0,1 are the hole cards.
const CARDS: [string, number][] = [['A', 0], ['K', 0], ['Q', 0], ['J', 1], ['10', 2], ['4', 3], ['2', 0]]

function ellipseLUT(a: number, b: number, n = 720) {
  const cum = new Float32Array(n + 1)
  let px = a, pz = 0
  for (let i = 1; i <= n; i++) { const th = (i / n) * Math.PI * 2, x = a * Math.cos(th), z = b * Math.sin(th); cum[i] = cum[i - 1] + Math.hypot(x - px, z - pz); px = x; pz = z }
  return cum
}
function ellipseParam(cum: Float32Array, u: number) {
  const n = cum.length - 1, target = u * cum[n]
  let lo = 0, hi = n
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < target) lo = m; else hi = m }
  const f = (target - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo])
  return ((lo + f) / n) * Math.PI * 2
}

// point inside a suit pip, returns coords in roughly [-1,1]^2 (rejection sampling)
function suitPoint(suit: number, rand: () => number): [number, number] {
  for (let tries = 0; tries < 60; tries++) {
    if (suit === 2) {
      const x = rand() * 2 - 1, y = rand() * 2 - 1
      if (Math.abs(x) * 1.3 + Math.abs(y) <= 1) return [x, y]
      continue
    }
    if (suit === 3) {
      const k = rand()
      if (k < 0.8) {
        const c = Math.floor(rand() * 3), cx = [0, -0.5, 0.5][c], cy = [0.45, -0.15, -0.15][c], a = rand() * 6.2832, r = 0.38 * Math.sqrt(rand())
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
      }
      const y = -1 + rand() * 0.95, hw = 0.07 + 0.3 * (1 - (y + 1) / 0.95) * 0.9
      return [(rand() * 2 - 1) * hw, y]
    }
    const flip = suit === 0
    if (suit === 0 && rand() < 0.12) { const y = -1 + rand() * 0.6, hw = 0.09 + 0.3 * (1 - (y + 1) / 0.6); return [(rand() * 2 - 1) * hw, y] }
    const X = (rand() * 2 - 1) * 1.15, Y = -1.05 + rand() * 2.35
    const a = X * X + Y * Y - 1
    if (a * a * a - X * X * Y * Y * Y <= 0) {
      const nx = X / 1.15, ny = (Y - 0.125) / 1.175
      return flip ? [nx * 0.92, -ny * 0.88 + 0.12] : [nx, ny]
    }
  }
  return [0, 0]
}

const form: FormDef = {
  id: 'table',
  async build(ctx, pos, col) {
    const N = ctx.count, rand = ctx.rand
    const boost = Math.pow(262144 / N, 0.8)         // keep brightness when there are fewer particles
    const ACC = H.hex('#3FBF8A'), IV = H.hex('#EDE6D6'), RED = H.hex('#FF6B57')
    let idx = 0
    const put = (x: number, y: number, z: number, w: number, r: number, g: number, b: number, a: number) => { H.set(pos, col, idx++, x, y, z, w, r, g, b, a) }
    const take = (frac: number) => Math.max(1, Math.floor(frac * N))

    // ---------------- glyph masks (cards) ----------------
    const ranks = Array.from(new Set(CARDS.map(c => c[0])))
    const rankPts: Record<string, [number, number, number][]> = {}
    for (const r of ranks) {
      const m = await ctx.textMask(r, { font: '700 200px "Bodoni Moda Variable", "Bodoni 72", Georgia, serif', width: 256, height: 256 })
      rankPts[r] = H.sampleMask(m, 1200, rand)
    }

    // ---------------- felt ----------------
    const feltN = take(0.16)
    for (let j = 0; j < feltN; j++) {
      const rho = Math.sqrt(rand()), ph = rand() * 6.2832
      const x = FA * rho * Math.cos(ph), z = FB * rho * Math.sin(ph)
      const spot = Math.exp(-((x * x) / 6.0 + ((z - 0.1) * (z - 0.1)) / 1.9))   // pendant-lamp pool of light
      const sheen = Math.pow(spot, 1.6)
      const edge = 1 - 0.55 * Math.pow(rho, 6)
      // v15: the felt was an over-bloomed green smear (big points, a strong sheen). Smaller points, a dark baize and a faint lamp pool: the cards and chips now carry the light
      const gr = 0.03 + sheen * 0.08, gg = 0.34 + sheen * 0.22, gb = 0.22 + sheen * 0.16
      const n = 0.7 + 0.6 * rand()
      put(x, 0, z, 1, gr, gg, gb, (0.034 + 0.034 * spot) * edge * n * boost)
    }

    // ---------------- felt lines: betting oval, board zone, seat spokes, emblem ----------------
    const lineN = take(0.04)
    const oval = ellipseLUT(FA * 0.93, FB * 0.93)
    let li = 0
    const lineA = Math.floor(lineN * 0.42), lineB = Math.floor(lineN * 0.36), lineC = Math.floor(lineN * 0.12)
    for (; li < lineA; li++) {                        // betting oval (solid, accent)
      const th = ellipseParam(oval, rand())
      put(FA * 0.93 * Math.cos(th), 0.004, FB * 0.93 * Math.sin(th), 10, ACC[0], ACC[1], ACC[2], 0.55 * boost)
    }
    for (; li < lineA + lineB; li++) {                // community-card zone: rounded rectangle
      const bx = 2.6, bz0 = -0.76, bz1 = 0.6, rr = 0.26
      const per = 2 * (2 * bx + (bz1 - bz0)) , u = rand() * per
      let x: number, z: number
      const wx = 2 * bx, hz = bz1 - bz0
      if (u < wx) { x = -bx + u; z = bz0 } else if (u < wx + hz) { x = bx; z = bz0 + (u - wx) } else if (u < 2 * wx + hz) { x = bx - (u - wx - hz); z = bz1 } else { x = -bx; z = bz1 - (u - 2 * wx - hz) }
      void rr
      const dash = 0.5 + 0.5 * Math.sin(u * 22)
      put(x, 0.004, z, 10, IV[0] * 0.8, IV[1] * 0.9, IV[2] * 0.8, 0.30 * (dash > 0.35 ? 1 : 0.15) * boost)
    }
    for (; li < lineA + lineB + lineC; li++) {        // inner betting ring (pot)
      const th = rand() * 6.2832
      put(1.2 * Math.cos(th), 0.004, 0.62 + 0.40 * Math.sin(th), 10, ACC[0], ACC[1], ACC[2], 0.28 * boost)
    }
    for (; li < lineN; li++) {                        // engraved spade emblem at the back of the felt
      const [sx, sy] = suitPoint(0, rand)
      put(sx * 0.30, 0.004, -1.52 - sy * 0.30, 10, ACC[0], ACC[1], ACC[2], 0.34 * boost)
    }

    // ---------------- rail (padded tube) ----------------
    const railN = take(0.10)
    const railLUT = ellipseLUT(RA, RB)
    const stitchN = Math.floor(railN * 0.10)
    for (let j = 0; j < railN; j++) {
      const th = ellipseParam(railLUT, rand())
      const nxr = Math.cos(th) / RA, nzr = Math.sin(th) / RB, nm = Math.hypot(nxr, nzr), nx = nxr / nm, nz = nzr / nm
      const stitch = j < stitchN
      const ph = stitch ? 0.62 + (rand() - 0.5) * 0.02 : rand() * 6.2832     // phi: angle around the tube, 0 = outward
      const cph = Math.cos(ph) , sph = Math.sin(ph)
      const x = RA * Math.cos(th) + RT * cph * nx * -1, z = RB * Math.sin(th) + RT * cph * nz * -1
      const y = 0.13 + RT * sph * 0.95
      // normal of the tube surface: radial (inward-pointing for cph>0) + up
      const Nx = -cph * nx, Ny = sph, Nz = -cph * nz
      const diff = Math.max(0, Nx * L[0] + Ny * L[1] + Nz * L[2])
      const rim = Math.pow(1 - Math.abs(Ny * 0.0 + (Nz * 0.5 + 0.5)), 3) * 0.0
      const pad = 0.72 + 0.28 * Math.cos(th * 46)                              // cushion segmentation
      if (stitch) {
        const dash = Math.sin(th * 150) > -0.2 ? 1 : 0.1
        put(x, y, z, 11, IV[0], IV[1], IV[2] * 0.9, 0.55 * dash * boost)
      } else {
        const lit = 0.12 + 0.88 * Math.pow(diff, 1.4)
        put(x, y, z, 2, 0.34 + lit * 0.66, 0.24 + lit * 0.58, 0.17 + lit * 0.42, (0.04 + 0.17 * lit * lit + rim) * pad * boost)
      }
    }

    // ---------------- seats ----------------
    const seatN = take(0.022)
    const seats: [number, number][] = []
    for (let k = 0; k < 6; k++) { const th = Math.PI / 2 + k * Math.PI / 3; seats.push([SA * Math.cos(th), SB * Math.sin(th)]) }
    for (let j = 0; j < seatN; j++) {
      const k = j % 6, [sx, sz] = seats[k], kind = rand()
      const hero = k === 0
      const wv = 3 + k * 0.1
      let r: number, a: number, rad = 0, al: number
      if (kind < 0.40) { rad = 0.26; a = rand() * 6.2832; al = 0.75 }
      else if (kind < 0.62) { rad = 0.19; a = rand() * 6.2832; al = 0.4 }
      else if (kind < 0.76) { const ti = Math.floor(rand() * 12); a = (ti / 12) * 6.2832 + (rand() - 0.5) * 0.03; rad = 0.29 + rand() * 0.06; al = 0.6 }
      else { rad = 0.17 * Math.sqrt(rand()); a = rand() * 6.2832; al = 0.14 }
      r = rad
      const c = hero ? ACC : IV
      put(sx + Math.cos(a) * r, 0.006, sz + Math.sin(a) * r, wv, c[0], c[1], c[2], al * boost)
    }

    // ---------------- chip stacks ----------------
    // v15: one stack at each seat (inside its ring) and a small one beside it, so the table reads as six players with chips, not scattered piles
    const CHIPC: [number, number, number][] = [[0.22, 0.66, 0.46], [0.86, 0.26, 0.22], [0.27, 0.47, 0.92], [0.93, 0.87, 0.72], [0.86, 0.26, 0.22], [0.27, 0.47, 0.92]]
    const STACKN = [8, 6, 7, 5, 7, 6]
    const chipDefs: { x: number; z: number; n: number; c: [number, number, number] }[] = []
    seats.forEach(([sx, sz], k) => {
      const mx = k === 0 ? -0.0 : 0, mz = 0                         // the hero seat's chips sit on its ring too
      // the hero seat's hole cards lie across its ring, so its stacks sit a step to the right of them
      const hx = k === 0 ? 1.62 : sx, hz = k === 0 ? 1.45 : sz
      chipDefs.push({ x: hx + mx, z: hz + mz, n: STACKN[k], c: CHIPC[k] })
      const ix = k === 0 ? 0.3 : 0, iz = k === 0 ? -0.2 : 0                          // the small stack: a step along the rail
      const tx = k === 0 ? 0 : -sz / SB * 0.5 * (k === 3 ? 1 : 0.8), tz = k === 0 ? 0 : sx / SA * 0.5
      chipDefs.push({ x: hx + ix + tx, z: hz + iz + tz, n: 3, c: CHIPC[(k + 3) % 6] })
    })
    const chips: { x: number; y: number; z: number; c: [number, number, number]; top: boolean }[] = []
    for (const s of chipDefs) for (let i = 0; i < s.n; i++) chips.push({ x: s.x + (rand() - 0.5) * 0.012, y: 0.028 + i * 0.062, z: s.z + (rand() - 0.5) * 0.012, c: s.c, top: i === s.n - 1 })
    const chipN = take(0.13)
    const CR = 0.175, CHH = 0.056
    for (let j = 0; j < chipN; j++) {
      const ch = chips[j % chips.length]
      const topFace = ch.top && rand() < 0.42
      if (topFace) {
        const kind = rand(), a = rand() * 6.2832
        let rr: number, cc = ch.c, al = 0.5
        if (kind < 0.35) { rr = CR * (0.92 + 0.06 * rand()); cc = IV as any; al = 0.6 }
        else if (kind < 0.62) { rr = CR * (0.56 + 0.04 * rand()); cc = ch.c; al = 0.65 }
        else if (kind < 0.78) { rr = CR * 0.25 * Math.sqrt(rand()); cc = IV as any; al = 0.55 }
        else { rr = CR * Math.sqrt(rand()); al = 0.22 }
        put(ch.x + Math.cos(a) * rr, ch.y + CHH * 0.5 + 0.002, ch.z + Math.sin(a) * rr, 4, cc[0], cc[1], cc[2], al * boost)
      } else {
        const a = rand() * 6.2832, y = ch.y + (rand() - 0.5) * CHH
        const stripe = Math.sin(a * 4) > 0.25
        const nxs = Math.cos(a), nzs = Math.sin(a)
        const lit = 0.3 + 0.7 * Math.max(0, nxs * L[0] + nzs * L[2] + 0.3)
        const c = stripe ? IV : ch.c
        put(ch.x + nxs * CR, y, ch.z + nzs * CR, 4, c[0], c[1], c[2], (stripe ? 0.52 : 0.46) * lit * boost)
      }
    }

    // ---------------- deck (box of cards) ----------------
    const deckN = take(0.032)
    const DH = 0.24, dyaw = 0.32, dcy = Math.cos(dyaw), dsy = Math.sin(dyaw)
    for (let j = 0; j < deckN; j++) {
      const kind = rand()
      let lx = 0, ly = 0, lz = 0, al = 0.5
      if (kind < 0.30) {                              // the 12 edges of the box
        const e = Math.floor(rand() * 12), t = rand() - 0.5
        if (e < 8) {
          ly = e < 4 ? 0 : DH
          const sd = e % 4
          if (sd === 0) { lz = -DCH / 2; lx = t * DCW } else if (sd === 1) { lx = DCW / 2; lz = t * DCH } else if (sd === 2) { lz = DCH / 2; lx = t * DCW } else { lx = -DCW / 2; lz = t * DCH }
        } else { const cc = e - 8; lx = (cc & 1 ? 1 : -1) * DCW / 2; lz = (cc & 2 ? 1 : -1) * DCH / 2; ly = (t + 0.5) * DH }
        al = 0.8
      } else if (kind < 0.62) {                       // card layers on the four side faces
        const face = Math.floor(rand() * 4), y = Math.floor(rand() * 20) / 20 * DH + 0.002, t = rand() - 0.5
        if (face === 0) { lx = t * DCW; lz = DCH / 2 } else if (face === 1) { lx = DCW / 2; lz = t * DCH } else if (face === 2) { lx = t * DCW; lz = -DCH / 2 } else { lx = -DCW / 2; lz = t * DCH }
        ly = y; al = 0.42
      } else if (kind < 0.92) {                       // top face: lattice back
        lx = (rand() - 0.5) * (DCW - 0.04); lz = (rand() - 0.5) * (DCH - 0.04); ly = DH
        const lat = Math.abs(((lx + lz) * 14 + 50) % 2 - 1) < 0.14 || Math.abs(((lx - lz) * 14 + 50) % 2 - 1) < 0.14
        al = lat ? 0.5 : 0.08
      } else { lx = (rand() - 0.5) * DCW; lz = (rand() - 0.5) * DCH; ly = DH * rand(); al = 0.06 }
      const wx = lx * dcy + lz * dsy + DECK[0], wz = -lx * dsy + lz * dcy + DECK[1]
      put(wx, ly, wz, 5, IV[0], IV[1], IV[2] * 0.9, al * boost)
    }

    // ---------------- cards ----------------
    // v15: crisp rectangles. A hard rounded outline, a lit pale face, corner indices and a big suit pip, in small points so bloom cannot smear them.
    // The two hole cards (k = 0, 1) carry an accent outline and a brighter face; the five board cards are ivory.
    const cardN = take(0.031)
    const SCL = 1.35
    for (let k = 0; k < 7; k++) {
      const [rk, su] = CARDS[k], red = su === 1 || su === 2, hole = k < 2
      const ink = red ? RED : IV
      const wBase = 100 + k * 10
      const nOut = Math.floor(cardN * 0.17), nFill = Math.floor(cardN * 0.2), nGly = Math.floor(cardN * 0.45), nBack = cardN - nOut - nFill - nGly
      const OUT = hole ? [1.0, 1.0, 0.95] : [IV[0] * 0.9, IV[1] * 0.9, IV[2] * 0.85]
      // outline (shared by both faces)
      const rr = 0.07, per = 2 * (CW - 2 * rr) + 2 * (CH - 2 * rr) + 2 * Math.PI * rr
      for (let j = 0; j < nOut; j++) {
        let u = rand() * per, x: number, y: number
        const s1 = CW - 2 * rr, s2 = CH - 2 * rr, arc = Math.PI * rr / 2
        if (u < s1) { x = -s1 / 2 + u; y = CH / 2 }
        else if ((u -= s1) < arc) { const a = u / rr; x = s1 / 2 + Math.sin(a) * rr; y = s2 / 2 + Math.cos(a) * rr }
        else if ((u -= arc) < s2) { x = CW / 2; y = s2 / 2 - u }
        else if ((u -= s2) < arc) { const a = u / rr; x = s1 / 2 + Math.cos(a) * rr; y = -s2 / 2 - Math.sin(a) * rr }
        else if ((u -= arc) < s1) { x = s1 / 2 - u; y = -CH / 2 }
        else if ((u -= s1) < arc) { const a = u / rr; x = -s1 / 2 - Math.sin(a) * rr; y = -s2 / 2 - Math.cos(a) * rr }
        else if ((u -= arc) < s2) { x = -CW / 2; y = -s2 / 2 + u }
        else { u -= s2; const a = u / rr; x = -s1 / 2 - Math.cos(a) * rr; y = s2 / 2 + Math.sin(a) * rr }
        put(x, y, 0, wBase, OUT[0], OUT[1], OUT[2], (hole ? 1.0 : 0.9) * boost)
      }
      // face: a lit pale body (the hole cards brighter), so the card reads as a card and the ink sits on it
      for (let j = 0; j < nFill; j++) put((rand() - 0.5) * (CW - 0.05), (rand() - 0.5) * (CH - 0.05), 0.004, wBase + 1, 0.9, 0.9, 0.84, (hole ? 0.24 : 0.13) * boost)
      // face: glyphs
      let gi = 0
      const gly = (cx: number, cy: number, scale: number, rot: number, pts: [number, number][], al: number) => {
        const c = Math.cos(rot), s = Math.sin(rot)
        for (const [px, py] of pts) { const x = px * scale, y = py * scale; put(cx + x * c - y * s, cy + x * s + y * c, 0.008, wBase + 1, ink[0], ink[1], ink[2], al * boost); gi++ }
      }
      const rp = rankPts[rk]
      const nRank = Math.floor(nGly * 0.17), nSuitS = Math.floor(nGly * 0.05), nPip = nGly - 2 * nRank - 2 * nSuitS
      const rankPts2 = (n: number): [number, number][] => { const o: [number, number][] = []; for (let i = 0; i < n; i++) { const p = rp[i % rp.length]; o.push([(p[0] - 128) / 256, -(p[1] - 128) / 256 - 0.0]) } return o }
      const suitPts2 = (n: number): [number, number][] => { const o: [number, number][] = []; for (let i = 0; i < n; i++) o.push(suitPoint(su, rand)); return o }
      const rkTop = rankPts2(nRank), rkBot = rankPts2(nRank), sTop = suitPts2(nSuitS), sBot = suitPts2(nSuitS), pip = suitPts2(nPip)
      const rs = (rk === '10' ? 0.205 : 0.27) * SCL
      gly(-CW / 2 + 0.115 * SCL, CH / 2 - 0.125 * SCL, rs, 0, rkTop, 1.0)
      gly(-CW / 2 + 0.115 * SCL, CH / 2 - 0.235 * SCL, 0.052 * SCL, 0, sTop, 1.0)
      gly(CW / 2 - 0.115 * SCL, -CH / 2 + 0.125 * SCL, rs, Math.PI, rkBot, 1.0)
      gly(CW / 2 - 0.115 * SCL, -CH / 2 + 0.235 * SCL, 0.052 * SCL, Math.PI, sBot, 1.0)
      gly(0.0, 0.0, 0.135 * SCL, 0, pip, 0.8)
      // back: lattice + inner border + medallion
      for (let j = 0; j < nBack; j++) {
        const kind = rand(); let x: number, y: number, al: number
        if (kind < 0.18) { // inner border
          const u = rand() * 4, bw = CW - 0.1, bh = CH - 0.1
          if (u < 1) { x = (rand() - 0.5) * bw; y = bh / 2 } else if (u < 2) { x = (rand() - 0.5) * bw; y = -bh / 2 } else if (u < 3) { x = bw / 2; y = (rand() - 0.5) * bh } else { x = -bw / 2; y = (rand() - 0.5) * bh }
          al = 0.7
        } else if (kind < 0.30) { const a = rand() * 6.2832, rr2 = 0.14 + (rand() < 0.5 ? 0 : 0.055) ; x = Math.cos(a) * rr2; y = Math.sin(a) * rr2; al = 0.9 }
        else { x = (rand() - 0.5) * (CW - 0.12); y = (rand() - 0.5) * (CH - 0.12); const s1 = Math.abs(((x + y) * 11 + 100) % 2 - 1), s2 = Math.abs(((x - y) * 11 + 100) % 2 - 1); al = (s1 < 0.12 || s2 < 0.12) ? 0.55 : 0.03 }
        put(x, y, -0.004, wBase + 2, ACC[0] * 0.6 + 0.2, ACC[1] * 0.75 + 0.1, ACC[2] * 0.7 + 0.1, al * boost)
      }
    }

    // ---------------- equity bar: removed in v15. It stood as a separate frame below the table (its own plane, not on the felt), read as a stray rectangle, and the
    // hand compass already carries the 'what are my odds' idea. Its particle budget went to the cards. (Classes 6 and 7 stay reserved in the shader.)

    // ---------------- hand-compass ring around the hero cards ----------------
    const hcN = take(0.014)
    for (let j = 0; j < hcN; j++) {
      const kind = rand(), a = rand() * 6.2832
      let r: number, al = 0.3
      if (kind < 0.42) { r = 1.00 } else if (kind < 0.55) { r = 0.93; al = 0.15 }
      else if (kind < 0.85) { const t = Math.floor(rand() * 48), major = t % 12 === 0; const aa = (t / 48) * 6.2832 + (rand() - 0.5) * 0.01; r = 1.0 + (rand() * (major ? 0.17 : 0.07)) * (rand() < 0.5 ? 1 : -1); put(0.0 + Math.cos(aa) * r, 0.008, 1.42 + Math.sin(aa) * r * 0.97, 8, ACC[0], ACC[1], ACC[2], (major ? 0.9 : 0.4) * boost); continue }
      else { // needle: a thin kite pointing north, its own class (swings in anim)
        const u = rand(); r = 0.92 * u; put((rand() - 0.5) * 0.012 * (1 - u * 0.9), 0.01, 1.42 - r, 12, IV[0], IV[1], IV[2], (0.25 + 0.5 * u * u) * boost); continue
      }
      put(Math.cos(a) * r, 0.008, 1.42 + Math.sin(a) * r * 0.97, 8, ACC[0], ACC[1], ACC[2], al * boost)
    }

    // ---------------- lamp haze: faint cone of light over the table ----------------
    const hazeN = take(0.04), HT = 3.4
    for (let j = 0; j < hazeN; j++) {
      const y = HT * (1 - Math.cbrt(rand())) - 0.15
      const rmax = 3.1 * (1 - Math.max(0, y) / (HT + 0.2)) + 0.12
      const rho = rmax * Math.sqrt(rand()), a = rand() * 6.2832
      const fall = Math.exp(-(rho * rho) / (rmax * rmax * 0.5))
      put(Math.cos(a) * rho * 1.08, y, Math.sin(a) * rho * 0.62 - 0.05, 9, 0.85, 0.95, 0.88, (0.014 + 0.03 * fall) * boost * (0.4 + rand()))
    }

    // ---------------- dust: the rest ----------------
    H.dust(pos, col, idx, N, rand, 7.4, 0.10 * boost, [0.85, 0.9, 0.85])
    for (let i = idx; i < N; i++) pos[i * 4 + 3] = 0
  },
  glsl: /* glsl */ `
const float TBL_CYC = 11.0;
const float TBL_PI = 3.14159265;
float tbl_start(float k) {
  if (k < 0.5) return 0.2;
  if (k < 1.5) return 0.6;
  if (k < 2.5) return 1.5;
  if (k < 3.5) return 1.8;
  if (k < 4.5) return 2.1;
  if (k < 5.5) return 3.0;
  return 3.9;
}
vec3 tbl_slot(float k) {            // x, z, yaw of the final pose
  if (k < 0.5) return vec3(-0.5, 1.42, 0.13);
  if (k < 1.5) return vec3(0.5, 1.42, -0.13);
  return vec3((k - 4.0) * 0.95, 0.02, 0.0);
}
float tbl_q(float k, float t) {     // 0 on the deck .. 1 in its slot
  float tc = mod(t, TBL_CYC);
  float s = clamp((tc - tbl_start(k)) / 0.8, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - s, 3.0);
  float rs = 9.4 + (6.0 - k) * 0.11;
  float r = clamp((tc - rs) / 0.7, 0.0, 1.0);
  float er = r * r * (3.0 - 2.0 * r);
  return e * (1.0 - er);
}
float tbl_fill(float t) {
  float tc = mod(t, TBL_CYC);
  return 0.64 * smoothstep(5.0, 6.8, tc) * (1.0 - smoothstep(9.0, 10.2, tc));
}
vec3 anim_table(vec3 p, vec4 d, vec4 r, float t) {
  float w = d.w;
  if (w >= 100.0) {
    float k = floor((w - 100.0) / 10.0 + 0.001);
    float layer = w - 100.0 - k * 10.0;
    float q = tbl_q(k, t);
    vec3 sl = tbl_slot(k);
    float flip = smoothstep(0.08, 0.72, q);
    float th = TBL_PI * (1.0 - flip);
    float phi = 0.66 * smoothstep(0.05, 0.95, q) + 0.30 * sin(TBL_PI * q);   // 38 degrees: nearly face-on to the 36 degree camera, and low enough not to stand in front of the back seat's chips
    float c = cos(th), s = sin(th);
    vec3 v = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
    float cp = cos(phi), sp = sin(phi);
    vec3 wv = vec3(v.x, v.y * sp + v.z * cp, -v.y * cp + v.z * sp);
    float yaw = mix(0.32, sl.z, smoothstep(0.0, 1.0, q)) + 0.10 * sin(TBL_PI * q) * (0.5 - fract(k * 0.37));
    float cy = cos(yaw), sy = sin(yaw);
    wv = vec3(wv.x * cy + wv.z * sy, wv.y, -wv.x * sy + wv.z * cy);
    float yc = mix(0.262, 0.012, q) + ${(CH / 2).toFixed(3)} * sp + 0.62 * sin(TBL_PI * q);
    vec3 ctr = vec3(mix(${DECK[0].toFixed(3)}, sl.x, q), yc, mix(${DECK[1].toFixed(3)}, sl.y, q));
    return ctr + wv;
  }
  float cl = floor(w + 0.001);
  if (cl < 0.5) return p + 0.07 * vec3(sin(t * 0.31 + r.x * 6.283), sin(t * 0.23 + r.y * 6.283), cos(t * 0.27 + r.z * 6.283));
  if (cl > 8.5 && cl < 9.5) {
    float a = t * (0.03 + 0.04 * r.w), c = cos(a), s = sin(a);
    return vec3(c * p.x - s * p.z, p.y + 0.10 * sin(t * 0.4 + r.x * 6.283), s * p.x + c * p.z);
  }
  if (cl > 7.5 && cl < 8.5) {
    float a = t * 0.22, c = cos(a), s = sin(a); float zz = p.z - 1.42;
    return vec3(c * p.x - s * zz, p.y, 1.42 + s * p.x + c * zz);
  }
  if (cl > 11.5 && cl < 12.5) {
    float tc = mod(t, TBL_CYC);
    float a = 0.55 * sin(t * 0.8) * exp(-0.0 * t) + 0.9 * sin(t * 2.1) * 0.12;
    float c = cos(a), s = sin(a); float zz = p.z - 1.42;
    return vec3(c * p.x - s * zz, p.y, 1.42 + s * p.x + c * zz);
  }
  if (cl > 3.5 && cl < 4.5) return p + vec3(0.0, 0.0035 * sin(t * 1.3 + p.x * 9.0), 0.0);
  return p;
}
float size_table(vec4 d, vec4 r, float t) {
  float w = d.w;
  if (w >= 100.0) { float layer = w - 100.0 - floor((w - 100.0) / 10.0 + 0.001) * 10.0; return layer > 0.5 && layer < 1.5 ? 0.68 : 0.8; }
  float cl = floor(w + 0.001);
  if (cl < 0.5) return 1.3;
  if (cl > 8.5 && cl < 9.5) return 2.0;
  if (cl > 0.5 && cl < 1.5) return 1.5;
  if (cl > 1.5 && cl < 2.5) return 1.3;
  if (cl > 11.5) return 0.8;
  return 1.0;
}
vec4 color_table(vec4 c, vec4 d, vec4 r, float t) {
  float w = d.w;
  float tc = mod(t, TBL_CYC);
  if (w >= 100.0) {
    float k = floor((w - 100.0) / 10.0 + 0.001);
    float layer = w - 100.0 - k * 10.0;
    float q = tbl_q(k, t);
    float flip = smoothstep(0.08, 0.72, q);
    float face = cos(TBL_PI * (1.0 - flip));
    float vis = layer < 0.5 ? 1.0 : (layer < 1.5 ? smoothstep(0.02, 0.3, face) : smoothstep(0.02, 0.3, -face));
    float since = tc - (tbl_start(k) + 0.8);
    float flash = (since > 0.0 && since < 1.6) ? exp(-since * 3.2) : 0.0;
    c.rgb += vec3(0.20, 0.75, 0.50) * flash * (layer < 0.5 ? 1.0 : 0.25);
    c.a *= vis * (1.0 + 0.9 * flash);
    return c;
  }
  float cl = floor(w + 0.001);
  if (cl > 0.5 && cl < 1.5) {
    float u = d.x * 0.7 + d.z * 0.45;
    float band = exp(-pow((u - (fract(t * 0.055) * 10.0 - 5.0)) / 0.8, 2.0));
    c.rgb += vec3(0.10, 0.42, 0.30) * band * 0.9;
    c.a *= 1.0 + band * 0.9;
    return c;
  }
  if (cl > 2.5 && cl < 3.5) {
    float seat = floor(fract(w) * 10.0 + 0.5);
    float act = floor(mod(t * 0.8, 6.0));
    float on = 1.0 - smoothstep(0.0, 1.0, abs(mod(t * 0.8, 6.0) - (seat + 0.5)));
    c.rgb = mix(c.rgb, vec3(0.25, 0.82, 0.58), on * 0.8);
    c.a *= 1.0 + on * 1.6;
    return c;
  }
  if (cl > 6.5 && cl < 7.5) {
    float f = fract(w) / 0.99;
    float fl = tbl_fill(t);
    float vis = 1.0 - smoothstep(fl - 0.004, fl + 0.004, f);
    float head = exp(-pow((f - fl) / 0.03, 2.0)) * step(0.01, fl);
    c.rgb = mix(c.rgb, vec3(0.85, 1.0, 0.92), head * 0.8 + f * 0.25);
    c.a *= vis * (1.0 + head * 1.8);
    return c;
  }
  if (cl > 7.5 && cl < 8.5) { c.a *= 0.65 + 0.35 * sin(t * 1.4 + d.x * 2.0); return c; }
  return c;
}`,
  camera: { pos: [0, 5.6, 7.4], target: [0, -0.2, 0.2], fov: 34 },
  pointSize: 1.9,
  drift: 0.006,
}
export default form
