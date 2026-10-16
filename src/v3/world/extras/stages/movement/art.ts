// Static art for "The Movement" (wave 24, approach A: deep SVG): the part list (positions, tooth counts, ratios, phases, job ids) and the
// plate, bridge, fixed-wheel and dial SVG. No anime.js and no DOM here, so a probe can compose the assembled movement as one SVG string.
//
// Layout (movement units: a 1000 x 1000 box, centre 0,0, y down). The going train, every mesh at its true centre distance (module from geometry):
//   barrel 72 (B) -> centre pinion 12 (C) | centre wheel 96 -> third pinion 8 (T) | third wheel 60 -> cage pinion 12 (F): the cage turns once a minute
//   flying tourbillon at F: escape pinion 12 rolls round the FIXED fourth wheel 48, so the escape wheel turns 4x per cage turn relative to the cage
//   escapement inside the cage: escape wheel 15 club teeth -> pallet fork (two ruby stones, 60 degree span, tangential locking) -> roller and impulse
//   jewel -> balance 1 Hz (two beats a second) with timing screws -> Breguet-overcoil hairspring; a shock spring and a regulator index on the cock.
//   ratios (degrees per centre-wheel degree): barrel -1/6, third -12, cage +60, escape +240 relative to the cage (+300 absolute), fixed wheel 0.
//   motion works: cannon pinion 12 -> minute wheel 36 / pinion 10 -> hour wheel 40 (x12). keyless: crown wheel 24 -> ratchet 48, with a click.
// Finishing: anthracite plate with perlage; rhodium bridges with Cotes de Geneve, polished bevels (under-strokes, and feSpecularLighting in the
// main view only), engraved gold-filled lettering (words only); blued screws with slots; rubies in gold chatons with chaton screws; gold wheels
// with crossed-out curved spokes and chamfers; black-polished steel cage. Every rotating part is plain vector (no filter) so it rotates on the
// compositor; the filters live on static layers.
import { arcD, circle, escapeWheel, hairspring, involute, meshPhase, mainspring, pt, ringSector, sawWheel, TAU, windows } from './geom'

const DEG = 180 / Math.PI
export const ACCENT = '#FF4A2B'
const f2 = (v: number) => (Math.round(v * 100) / 100).toString()
/** an unseen disc that keeps a skeleton wheel hoverable and grabbable across its windows (fill transparent still counts as painted for pointer-events) */
const hitDisc = (r: number) => `<circle r="${f2(r)}" fill="transparent" class="mv-hit"/>`

// ------------------------------------------------------------------------------------------------ layout
const dirP = (a: readonly number[], b: readonly number[]) => Math.atan2(b[1] - a[1], b[0] - a[0])
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(b[0] - a[0], b[1] - a[1])
const F0 = [0, 250] as const
const T0 = [F0[0] + 200 * Math.cos(-50 / DEG), F0[1] + 200 * Math.sin(-50 / DEG)] as const
export const P = { C: [0, 0], B: [-135, -150], T: T0, F: F0, K: [-30, -318], MW: [55, -45], R: [300, -60] } as const
const modOf = (a: readonly number[], b: readonly number[], n1: number, n2: number) => (dist(a, b) * 2) / (n1 + n2)
export const M1 = modOf(P.B, P.C, 72, 12), M2 = modOf(P.C, P.T, 96, 8), M3 = modOf(P.T, P.F, 60, 12), MK = modOf(P.B, P.K, 48, 24)
const MM = dist(P.C, P.MW) / 24, MH = dist(P.C, P.MW) / 25
/** the tourbillon, in cage coordinates (+y points at the escape wheel when the cage is at 0) */
export const CAGE = { R: 168, E: 122, re: 38, ri: 28.5, P: 122 - 38 / Math.cos(30 / DEG), bal: 64, FORK: 6 }
export const M4 = CAGE.E / 30
/** the hairspring: collet radius, units a coil, stud radius (movement.ts re-draws it from the balance angle) */
export const HAIR = { r0: 7, pitch: 3.3, r1: 44 }
/** escape wheel angle (cage frame) at rest with the entry stone locking: a tooth's locking corner sits on the entry stone (see buildParts) */
export const ESC_REST = 14.4 - 3.6
export const DRUM = involute(72, M1)
/** the ratchet's click: its pivot sits above-left of the barrel and the nose rests on the ratchet's saw teeth at nine o'clock, so the pawl runs with the wheel when it winds and jams it the other way */
const RATCHET = involute(48, MK)
export const CLICK_AT = [P.B[0] + (RATCHET.ro + 20) * Math.cos(192 / DEG), P.B[1] + (RATCHET.ro + 20) * Math.sin(192 / DEG)] as const
export const SPRING = { r0: 30, r1: DRUM.rr * 0.86 - 3 }

export interface Part {
  id: string; layer: number; at: readonly number[]; r: number
  /** svg markup in local units (centred) */ svg: string
  /** degrees of this part per centre-wheel degree (0 = not on the going train) */ ratio: number
  /** phase in degrees */ phase: number
  drive?: 'wind' | 'crownwheel' | 'click' | 'balance' | 'hair' | 'spring' | 'pallet' | 'cage' | 'escape' | 'hand-h' | 'hand-m' | 'motion' | 'reserve' | 'stem'
  /** a child of another part (the tourbillon cage): `at` is in the parent's frame */ parent?: string
  /** hairspring band: share of the balance angle */ k?: number
  job?: string; name?: string; drag?: 'train' | 'wind'
  sheen?: boolean; shadow?: boolean; blur?: boolean; hit?: boolean
  el?: HTMLDivElement; rot?: Element; anim?: { rotate(v: number, duration?: number): unknown }; last?: number; hi?: HTMLDivElement; blurEl?: HTMLDivElement; spd?: number
  /** the loupe's copy */ lg?: SVGGElement; llast?: number
}

/** watch names for the hover tip, and the job each part stands for (ids from src/data/nervous-system.json) */
export const NAMES: Record<string, { name: string; job?: string }> = {
  barrel: { name: 'Barrel', job: 'secretary' }, spring: { name: 'Mainspring', job: 'backup' }, 'centre-pinion': { name: 'Centre pinion', job: 'watchdog' },
  centre: { name: 'Centre wheel', job: 'watchdog' }, 'third-pinion': { name: 'Third pinion', job: 'snapshot' }, third: { name: 'Third wheel', job: 'snapshot' },
  'cage-pinion': { name: 'Cage pinion', job: 'keeper' }, cage: { name: 'Tourbillon cage', job: 'keeper' }, 'escape-pinion': { name: 'Escape pinion', job: 'gmail' },
  escape: { name: 'Escape wheel', job: 'gmail' }, pallet: { name: 'Pallet fork', job: 'skills' }, balance: { name: 'Balance', job: 'vault' },
  'hair-0': { name: 'Hairspring', job: 'sessions' }, ratchet: { name: 'Ratchet wheel', job: 'steward' }, crownwheel: { name: 'Crown wheel', job: 'carta' },
  click: { name: 'Click', job: 'organizer' }, 'hour-wheel': { name: 'Hour wheel', job: 'recruiting' }, 'minute-wheel': { name: 'Minute wheel', job: 'audit' },
  'minute-pinion': { name: 'Minute pinion', job: 'audit' }, cannon: { name: 'Cannon pinion', job: 'watchdog' }, reserve: { name: 'Power reserve', job: 'status' },
  'fixed-wheel': { name: 'Fixed fourth wheel', job: 'programs' }, 'barrel-bridge': { name: 'Barrel bridge', job: 'boot' }, 'train-bridge': { name: 'Train bridge', job: 'daily' },
  regulator: { name: 'Regulator index', job: 'recalibrator' }, shock: { name: 'Shock spring', job: 'health' }, cock: { name: 'Balance cock', job: 'boot' },
  roller: { name: 'Impulse roller', job: 'claude-code' }, stud: { name: 'Hairspring stud', job: 'sessions' }, 'reserve-scale': { name: 'Power reserve', job: 'status' },
}

// ------------------------------------------------------------------------------------------------ part builders
const goldWheel = (n: number, m: number, spokes: number, opts: { grad?: string; bend?: number; hubK?: number } = {}) => {
  const g = involute(n, m)
  const rim = g.rr - Math.max(5, m * 1.7), hub = Math.max(12, g.rr * (opts.hubK ?? 0.16)), w = Math.max(3.4, g.rr * 0.034)
  const win = windows(spokes, hub, rim, w, opts.bend ?? 0.42)
  const arbor = Math.max(4.5, hub * 0.32)
  return {
    r: g.ro,
    svg: hitDisc(g.rr) + `<path d="${g.path}${win}${circle(arbor)}" fill="url(#${opts.grad ?? 'mv-gold'})" fill-rule="evenodd" class="mv-hit"/>`
      + `<path d="${g.path}" fill="none" stroke="#4a3206" stroke-opacity=".55" stroke-width=".8"/>`
      + `<path d="${win}" fill="none" stroke="#fff1c4" stroke-opacity=".62" stroke-width="1.5"/>`
      + `<path d="${win}" fill="none" stroke="#3a2705" stroke-opacity=".55" stroke-width=".6"/>`
      + `<circle r="${f2(rim + 1.6)}" fill="none" stroke="#fff3cc" stroke-opacity=".34" stroke-width=".9"/>`
      + `<circle r="${f2(hub - 2)}" fill="none" stroke="#fff1c4" stroke-opacity=".45" stroke-width="1.1"/>`
      + `<circle r="${f2(arbor + 3.2)}" fill="url(#mv-steel-hi)"/><circle r="${f2(arbor)}" fill="url(#mv-pivot)"/>`,
  }
}
const steelPinion = (n: number, m: number) => {
  const g = involute(n, m)
  return { r: g.ro, svg: `<path d="${g.path}" fill="url(#mv-steel)" stroke="#0b0c0e" stroke-width=".7" class="mv-hit"/><circle r="${f2(g.rr * 0.72)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/><circle r="${f2(g.rr * 0.42)}" fill="url(#mv-steel-hi)"/><circle r="${f2(g.rr * 0.2)}" fill="url(#mv-pivot)"/>` }
}
/** a blued screw with its slot (slots of one bridge aligned, as a watchmaker sets them) */
export const screw = (x: number, y: number, r = 9.5, a = 30) => `<g transform="translate(${f2(x)} ${f2(y)})"><circle r="${f2(r + 2.2)}" fill="#0b0c0e" opacity=".7"/>`
  + `<circle r="${f2(r)}" fill="url(#mv-blued)"/><g transform="rotate(${a})"><rect x="${f2(-r * 0.95)}" y="${f2(-r * 0.15)}" width="${f2(r * 1.9)}" height="${f2(r * 0.3)}" fill="#050a1c"/>`
  + `<rect x="${f2(-r * 0.95)}" y="${f2(r * 0.15)}" width="${f2(r * 1.9)}" height="${f2(r * 0.08)}" fill="#a9c4ff" opacity=".45"/></g>`
  + `<circle r="${f2(r)}" fill="none" stroke="#c9dbff" stroke-opacity=".55" stroke-width=".7"/><circle cx="${f2(-r * 0.38)}" cy="${f2(-r * 0.42)}" r="${f2(r * 0.22)}" fill="#e6efff" opacity=".55"/></g>`
/** a ruby in a gold chaton held by three small screws */
export const jewel = (x: number, y: number, r = 8, screws = true) => {
  let s = `<g transform="translate(${f2(x)} ${f2(y)})"><circle r="${f2(r * 2.15)}" fill="#0b0c0e" opacity=".55"/><circle r="${f2(r * 1.95)}" fill="url(#mv-chaton)"/>`
    + `<circle r="${f2(r * 1.95)}" fill="none" stroke="#fff4c9" stroke-opacity=".6" stroke-width=".9"/><circle r="${f2(r * 1.25)}" fill="none" stroke="#5c3f08" stroke-opacity=".7" stroke-width=".8"/>`
    + `<circle r="${f2(r)}" fill="url(#mv-ruby)"/><circle r="${f2(r * 0.34)}" fill="#3a0010"/><circle r="${f2(r * 0.34)}" fill="none" stroke="#ff9aa8" stroke-opacity=".6" stroke-width=".5"/>`
    + `<ellipse cx="${f2(-r * 0.36)}" cy="${f2(-r * 0.42)}" rx="${f2(r * 0.3)}" ry="${f2(r * 0.18)}" fill="#fff" opacity=".8" transform="rotate(-35 ${f2(-r * 0.36)} ${f2(-r * 0.42)})"/>`
  if (screws) for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU - Math.PI / 2 + 0.5; s += `<g transform="translate(${pt(r * 2.45, a)})"><circle r="${f2(r * 0.42)}" fill="url(#mv-blued)"/><rect x="${f2(-r * 0.4)}" y="-.5" width="${f2(r * 0.8)}" height="1" fill="#050a1c" transform="rotate(${f2(a * DEG + 90)})"/></g>` }
  return s + '</g>'
}

export function buildParts(t0: Date): Part[] {
  const parts: Part[] = []
  const add = (p: Omit<Part, 'phase'> & { phase?: number }) => { const q: Part = { phase: 0, ...p }; const n = NAMES[q.id]; if (n) { q.name ??= n.name; q.job ??= n.job } parts.push(q); return q }
  const ph = (thp: number, np: number, nc: number, from: readonly number[], to: readonly number[]) => meshPhase(thp, np, nc, dirP(from, to)) * DEG
  const s0 = t0.getSeconds() + t0.getMilliseconds() / 1000, m0 = t0.getMinutes() + s0 / 60, h0 = (t0.getHours() % 12) + m0 / 60

  // ---- layer 1: the open barrel and its mainspring, the centre pinion
  const drum = DRUM, wall = drum.rr * 0.86
  add({ id: 'barrel', layer: 1, at: P.B, r: drum.ro, ratio: -1 / 6, phase: ph(0, 12, 72, P.C, P.B), drag: 'train', sheen: true, shadow: true,
    svg: `<circle r="${f2(wall)}" fill="url(#mv-barrel-floor)" class="mv-hit"/>`
      + `<path d="${drum.path}${circle(wall)}" fill="url(#mv-gold)" fill-rule="evenodd" class="mv-hit"/>`
      + `<path d="${drum.path}" fill="none" stroke="#4a3206" stroke-opacity=".5" stroke-width=".8"/>`
      + `<circle r="${f2(wall)}" fill="none" stroke="#1d1404" stroke-width="5" stroke-opacity=".85"/><circle r="${f2(wall + 3.5)}" fill="none" stroke="#fff1c4" stroke-opacity=".5" stroke-width="1.2"/>`
      + `<circle r="${f2(wall - 6)}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="7"/>` })
  add({ id: 'spring', layer: 1, at: P.B, r: SPRING.r1 + 4, ratio: -1 / 6, phase: 0, drive: 'spring', drag: 'train',
    svg: `<path class="mv-spring-sh" d="${mainspring(SPRING.r0, SPRING.r1, 11, 0.62)}" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="5" stroke-linejoin="round" transform="translate(1.3 2)"/>`
      + `<path class="mv-spring mv-hit" d="${mainspring(SPRING.r0, SPRING.r1, 11, 0.62)}" fill="none" stroke="url(#mv-spring-g)" stroke-width="4" stroke-linejoin="round"/>`
      + `<path class="mv-spring-hl" d="${mainspring(SPRING.r0, SPRING.r1, 11, 0.62)}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".8" transform="translate(-.5 -.6)"/>`
      + `<circle r="${SPRING.r0 - 1}" fill="url(#mv-steel-hi)"/><path d="M${SPRING.r0 - 2} -5 L${SPRING.r0 + 4} 0 L${SPRING.r0 - 2} 5Z" fill="#0b0c0e"/><circle r="${SPRING.r0 * 0.45}" fill="url(#mv-pivot)"/>` })
  const cp = steelPinion(12, M1)
  add({ id: 'centre-pinion', layer: 1, at: P.C, r: cp.r, ratio: 1, svg: cp.svg, drag: 'train' })
  // ---- layer 2: centre wheel (once an hour) + third pinion
  const cwh = goldWheel(96, M2, 5, { bend: 0.48 })
  add({ id: 'centre', layer: 2, at: P.C, r: cwh.r, ratio: 1, svg: cwh.svg, drag: 'train', sheen: true, shadow: true, blur: true })
  const tp = steelPinion(8, M2)
  add({ id: 'third-pinion', layer: 2, at: P.T, r: tp.r, ratio: -12, phase: ph(0, 96, 8, P.C, P.T), svg: tp.svg, drag: 'train' })
  // ---- layer 3: third wheel + the cage pinion (the cage is carried by it, once a minute)
  const tw = goldWheel(60, M3, 5, { grad: 'mv-gold-hi', bend: -0.44 })
  const thirdPh = ph(0, 96, 8, P.C, P.T)
  add({ id: 'third', layer: 3, at: P.T, r: tw.r, ratio: -12, phase: thirdPh, svg: tw.svg, drag: 'train', sheen: true, shadow: true, blur: true })
  const kp = steelPinion(12, M3)
  add({ id: 'cage-pinion', layer: 3, at: P.F, r: kp.r, ratio: 60, phase: meshPhase(thirdPh / DEG, 60, 12, dirP(P.T, P.F)) * DEG, svg: kp.svg, drag: 'train' })

  // ---- layer 7: the flying tourbillon cage (once a minute; its arrow reads the seconds) and the escapement it carries
  const C = CAGE
  const cagePhase = s0 * 6
  add({ id: 'cage', layer: 7, at: P.F, r: C.R + 22, ratio: 60, phase: cagePhase, drive: 'cage', drag: 'train', svg: cageBase(), shadow: true })
  // escape pinion: rolls round the fixed wheel (48) on the outside; its phase from the tangency condition at the cage's start angle
  const ep = steelPinion(12, M4)
  const dir0 = cagePhase + 90
  const pinAbs0 = (meshPhase(0, 48, 12, dir0 / DEG) * DEG)
  add({ id: 'escape-pinion', layer: 7, parent: 'cage', at: [0, C.E], r: ep.r, ratio: 240, phase: pinAbs0 - cagePhase, drive: 'escape', svg: ep.svg, drag: 'train' })
  add({ id: 'escape', layer: 7, parent: 'cage', at: [0, C.E], r: C.re + 2, ratio: 240, phase: ESC_REST, drive: 'escape', drag: 'train',
    svg: hitDisc(C.ri * 0.9) + `<path d="${escapeWheel(15, C.re, C.ri)}${windows(5, 6.5, C.ri * 0.74, 1.9, 0.5)}${circle(2.6)}" fill="url(#mv-steel-hi)" fill-rule="evenodd" stroke="#0b0c0e" stroke-width=".5" class="mv-hit"/>`
      + `<path d="${windows(5, 6.5, C.ri * 0.74, 1.9, 0.5)}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".7"/>`
      + `<circle r="${f2(C.ri * 0.86)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".6"/><circle r="5.2" fill="url(#mv-pivot)"/>` })
  // pallet fork, local frame at the pivot: +y toward the escape wheel, -y toward the balance. Stones on the tangents of the escape circle (60 degree span).
  const stone = (x: number, y: number, a: number) => `<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(a)})"><rect x="-2.3" y="-11" width="4.6" height="12.4" rx=".6" fill="url(#mv-ruby-flat)"/><rect x="-2.3" y="-11" width="1.2" height="12.4" fill="#fff" opacity=".45"/></g>`
  const sx = C.re * Math.sin(30 / DEG), sy = C.E - C.re * Math.cos(30 / DEG) - C.P
  const fl = C.P - 11                               // fork length: pivot to the impulse jewel at the roller (balance frame y = 11)
  add({ id: 'pallet', layer: 7, parent: 'cage', at: [0, C.P], r: fl + 10, ratio: 0, drive: 'pallet',
    svg: `<path d="M-5 4 L${f2(-sx - 3)} ${f2(sy - 7)} L${f2(-sx + 2)} ${f2(sy - 9)} L-1 -2 Z M5 4 L${f2(sx + 3)} ${f2(sy - 7)} L${f2(sx - 2)} ${f2(sy - 9)} L1 -2 Z" fill="url(#mv-steel-hi)" stroke="#0b0c0e" stroke-width=".5" class="mv-hit"/>`
      + stone(-sx, sy, -30) + stone(sx, sy, 30)
      + `<path d="M-4.2 4 L-2.6 ${f2(-fl + 12)} L-6 ${f2(-fl + 4)} L-5 ${f2(-fl - 4)} L-1.8 ${f2(-fl - 3)} L-2.2 ${f2(-fl + 3)} L2.2 ${f2(-fl + 3)} L1.8 ${f2(-fl - 3)} L5 ${f2(-fl - 4)} L6 ${f2(-fl + 4)} L2.6 ${f2(-fl + 12)} L4.2 4 Z" fill="url(#mv-steel-hi)" stroke="#0b0c0e" stroke-width=".5" class="mv-hit"/>`
      + `<path d="M0 0 L0 ${f2(-fl + 13)}" stroke="#fff" stroke-opacity=".5" stroke-width=".6"/><circle cy="${f2(-fl + 9)}" r="1.1" fill="#d9dde4"/>`
      + `<circle r="6.5" fill="url(#mv-steel-hi)" stroke="#0b0c0e" stroke-width=".5"/><circle r="2.8" fill="url(#mv-pivot)"/>` })
  // balance: roller with impulse jewel (+y at rest, in the fork notch), gold rim with timing screws, two arms; hairspring above
  const br = C.bal
  let tscr = ''
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + TAU / 32, big = i % 4 === 0, rr = big ? 3.9 : 3.2, x = (br + 3.2) * Math.cos(a), y = (br + 3.2) * Math.sin(a)
    tscr += `<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(a * DEG)})"><circle r="${rr}" fill="url(#mv-gold-solid)" stroke="#5c3f08" stroke-width=".4"/><rect x="-.5" y="${-rr * 0.9}" width="1" height="${rr * 1.8}" fill="#3a2705"/></g>`
  }
  add({ id: 'balance', layer: 7, parent: 'cage', at: [0, 0], r: br + 9, ratio: 0, drive: 'balance', sheen: false,
    svg: `<circle r="14" fill="url(#mv-steel)"/><circle r="14" fill="none" stroke="#0b0c0e" stroke-width=".6"/><path d="M-6 0 A6 6 0 1 1 6 0" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width=".8"/>`
      + `<rect x="-2" y="8.2" width="4" height="7.5" rx="1.2" fill="url(#mv-ruby-flat)" stroke="#5a0012" stroke-width=".4" class="mv-roller"/>`
      + `<path d="${circle(br)}${circle(br - 7.5)}" fill="url(#mv-gold-solid)" fill-rule="evenodd" stroke="#5c3f08" stroke-width=".5" class="mv-hit"/>`
      + `<circle r="${br - 1.2}" fill="none" stroke="#fff4c9" stroke-opacity=".6" stroke-width=".8"/>${tscr}`
      + `<path d="M${-(br - 6)} -3.4 L-9 -4.2 A10 10 0 0 1 9 -4.2 L${br - 6} -3.4 L${br - 6} 3.4 L9 4.2 A10 10 0 0 1 -9 4.2 L${-(br - 6)} 3.4Z" fill="url(#mv-gold-solid)" stroke="#5c3f08" stroke-width=".5" class="mv-hit"/>`
      + `<path d="M${-(br - 7)} -1.4 L${br - 7} -1.4" stroke="#fff4c9" stroke-opacity=".55" stroke-width=".7"/><circle r="6" fill="url(#mv-gold-solid)"/><circle r="2.2" fill="url(#mv-pivot)"/>` })
  // hairspring: ONE smooth Archimedean spiral (movement.ts re-draws it from the balance angle: the inner end turns with the collet, the twist falls to nothing
  // at the stud, so the coils open and close as it breathes). The Breguet overcoil and the stud are on the cage top.
  const { r0: h0r, pitch: hp, r1: hr } = HAIR
  add({ id: 'hair-0', layer: 7, parent: 'cage', at: [0, 0], r: hr + 2, ratio: 0, drive: 'hair', name: 'Hairspring', job: 'sessions',
    svg: hitDisc(hr) + `<path class="mv-hair" d="${hairspring(h0r, hp, hr, 0)}" fill="none" stroke="url(#mv-blued-l)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<circle r="5" fill="url(#mv-steel-hi)"/><circle r="2" fill="url(#mv-pivot)"/>` })

  // ---- layer 6: keyless works on the barrel bridge: skeleton ratchet 48 (the mainspring shows through), crown wheel 24, click
  const rw = RATCHET, kw = involute(24, MK)
  // the ratchet is open-worked: saw teeth 15 deep, a thin rim under them, five slim spokes: the mainspring (and the barrel floor) show through the big windows
  const rRoot = rw.ro - 15, rIn = rRoot - 10
  const rwin = windows(5, 27, rIn, 4.6, 0.0)
  const rsaw = sawWheel(48, rw.ro, rRoot, -0.465 * (TAU / 48))        // valleys on the odd half-pitches, where the crown wheel's teeth mesh
  add({ id: 'ratchet', layer: 6, at: P.B, r: rw.ro, ratio: 0, drive: 'wind', drag: 'wind', sheen: true, shadow: true, blur: true,
    svg: hitDisc(rIn) + `<path d="${rsaw}${rwin}" fill="url(#mv-sun)" fill-rule="evenodd" stroke="#0b0c0e" stroke-width=".7" class="mv-hit"/>`
      + `<path d="${rwin}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.5"/><path d="${rwin}" fill="none" stroke="#0b0c0e" stroke-opacity=".6" stroke-width=".5"/>`
      + `<circle r="${f2(rRoot - 2.5)}" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="1.1"/><circle r="27" fill="url(#mv-steel-hi)"/>`
      + screw(0, 0, 15, 30) })
  add({ id: 'crownwheel', layer: 6, at: P.K, r: kw.ro, ratio: 0, drive: 'crownwheel', phase: meshPhase(0, 48, 24, dirP(P.B, P.K)) * DEG, drag: 'wind', sheen: true, shadow: true,
    svg: hitDisc(kw.rr * 0.78) + `<path d="${kw.path}${windows(4, 16, kw.rr * 0.76, 4.5, 0.3)}" fill="url(#mv-sun)" fill-rule="evenodd" stroke="#0b0c0e" stroke-width=".7" class="mv-hit"/>`
      + `<path d="${windows(4, 16, kw.rr * 0.76, 4.5, 0.3)}" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="1.2"/>` + screw(0, 0, 11, 60) })
  // the click: a slender pawl, pivot at the screw, nose on the saw teeth (drawn pointing along +x, then turned to look at the ratchet)
  add({ id: 'click', layer: 6, at: CLICK_AT, r: 44, ratio: 0, drive: 'click',
    svg: `<g transform="rotate(62)" class="mv-hit"><path d="M-8 -6.4 L19 -3.8 L31 -4.4 L39.5 -1.6 L35 1.8 L21 3.3 L-8 6.4 Q-14 0 -8 -6.4Z" fill="url(#mv-steel-hi)" stroke="#0b0c0e" stroke-width=".6"/>`
      + `<path d="M-3 -3.4 L28 -2.6" stroke="#fff" stroke-opacity=".7" stroke-width=".8"/><path d="M33 -3.6 L39 -1.4" stroke="#0b0c0e" stroke-opacity=".5" stroke-width=".6"/></g>` + screw(0, 0, 7, 10) })

  // ---- layer 8: motion works and the power-reserve hand
  const cnp = steelPinion(12, MM), mw = involute(36, MM), mp = steelPinion(10, MH), hw = involute(40, MH)
  const set = { drive: 'motion' as const }
  add({ id: 'hour-wheel', layer: 8, at: P.C, r: hw.ro, ratio: 1 / 12, phase: meshPhase(0, 10, 40, dirP(P.MW, P.C)) * DEG, drag: 'train', ...set,
    svg: hitDisc(hw.rr * 0.8) + `<path d="${hw.path}${windows(6, 14, hw.rr * 0.8, 3, 0.2)}" fill="url(#mv-gold-hi)" fill-rule="evenodd" stroke="#4a3206" stroke-width=".6" class="mv-hit"/><path d="${windows(6, 14, hw.rr * 0.8, 3, 0.2)}" fill="none" stroke="#fff1c4" stroke-opacity=".55" stroke-width="1"/>` })
  add({ id: 'minute-wheel', layer: 8, at: P.MW, r: mw.ro, ratio: -1 / 3, phase: meshPhase(0, 12, 36, dirP(P.C, P.MW)) * DEG, drag: 'train', ...set,
    svg: hitDisc(mw.rr * 0.78) + `<path d="${mw.path}${windows(5, 12, mw.rr * 0.78, 3, 0.3)}" fill="url(#mv-gold)" fill-rule="evenodd" stroke="#4a3206" stroke-width=".6" class="mv-hit"/><path d="${windows(5, 12, mw.rr * 0.78, 3, 0.3)}" fill="none" stroke="#fff1c4" stroke-opacity=".55" stroke-width="1"/>` })
  add({ id: 'minute-pinion', layer: 8, at: P.MW, r: mp.r, ratio: -1 / 3, svg: mp.svg, drag: 'train', ...set })
  add({ id: 'cannon', layer: 8, at: P.C, r: cnp.r, ratio: 1, svg: cnp.svg, drag: 'train', ...set })
  add({ id: 'reserve', layer: 8, at: P.R, r: 112, ratio: 0, drive: 'reserve', phase: 0,
    svg: `<path d="M-24 -3 L84 -1.4 L98 0 L84 1.4 L-24 3 Q-30 0 -24 -3Z" fill="url(#mv-blued-l)" stroke="#06112e" stroke-width=".6" class="mv-hit"/><circle cx="-22" r="7" fill="url(#mv-blued)"/><circle r="8" fill="url(#mv-blued)"/><circle r="3" fill="url(#mv-gold-solid)"/>` })

  // ---- layer 9: hands (real local time at mount; the cannon pinion slips when the crown sets them)
  const pomme = (x: number, r: number) => `<circle cx="${x}" r="${r}" fill="none" stroke="url(#mv-blued-l)" stroke-width="${f2(r * 0.42)}"/><circle cx="${x}" r="${f2(r * 0.42)}" fill="#050506"/>`
  add({ id: 'hand-h', layer: 9, at: P.C, r: 300, ratio: 1 / 12, phase: -90 + h0 * 30, drive: 'hand-h',
    svg: `<path d="M-46 -8 Q-58 0 -46 8 L0 7 L172 2.6 L196 2.6 L196 -2.6 L172 -2.6 L0 -7Z" fill="url(#mv-blued-l)" stroke="#050d2a" stroke-width=".8"/>${pomme(186, 13)}<path d="M200 -2 L232 0 L200 2Z" fill="url(#mv-blued-l)"/><path d="M0 -1.1 L176 -.6" stroke="#cfe0ff" stroke-opacity=".55" stroke-width=".8"/>` })
  add({ id: 'hand-m', layer: 9, at: P.C, r: 400, ratio: 1, phase: -90 + m0 * 6, drive: 'hand-m',
    svg: `<path d="M-64 -6 Q-76 0 -64 6 L0 5.4 L300 1.8 L322 1.8 L322 -1.8 L300 -1.8 L0 -5.4Z" fill="url(#mv-blued-l)" stroke="#050d2a" stroke-width=".7"/>${pomme(312, 10)}<path d="M324 -1.4 L392 0 L324 1.4Z" fill="url(#mv-blued-l)"/>`
      + `<path d="M0 -.9 L304 -.5" stroke="#cfe0ff" stroke-opacity=".55" stroke-width=".7"/><circle r="15" fill="url(#mv-blued)"/><circle r="6.5" fill="url(#mv-gold-solid)"/><circle r="2.4" fill="url(#mv-pivot)"/>` })
  // ---- layer 0: the stem slides when the crown is pulled
  add({ id: 'stem', layer: 0, at: [0, -385], r: 90, ratio: 0, drive: 'stem',
    svg: `<rect x="-7" y="-85" width="14" height="150" fill="url(#mv-steel-h)"/><rect x="-11" y="10" width="22" height="26" rx="3" fill="url(#mv-steel-h)" stroke="#0b0c0e" stroke-width=".6"/><path d="M-11 16 H11 M-11 22 H11 M-11 28 H11" stroke="#0b0c0e" stroke-opacity=".6" stroke-width=".8"/>` })
  return parts
}

// ------------------------------------------------------------------------------------------------ the cage (cage frame; rotates once a minute)
function cageBase(): string {
  const C = CAGE
  let s = `<circle r="${C.R + 6}" fill="#000" opacity=".35"/>`
  // ring
  s += `<path d="${circle(C.R)}${circle(C.R - 10)}" fill="url(#mv-black)" fill-rule="evenodd" class="mv-hit"/><circle r="${C.R - .7}" fill="none" stroke="#f4f6f9" stroke-opacity=".95" stroke-width="1.5"/><circle r="${C.R - 9.5}" fill="none" stroke="#f4f6f9" stroke-opacity=".6" stroke-width="1"/>`
  // three lyre arms to the hub (the escape wheel sits between the lower two)
  for (const a of [-90, 30, 150]) {
    const r = a / DEG, n = r + Math.PI / 2
    const w0 = 6.5, w1 = 3.6, h0 = 26, h1 = C.R - 6
    const p = (rad: number, off: number) => `${f2(rad * Math.cos(r) + off * Math.cos(n))} ${f2(rad * Math.sin(r) + off * Math.sin(n))}`
    const hole = `M${p(h0 + 30, 0)} Q${p((h0 + h1) / 2, 2.6)} ${p(h1 - 30, 0)} Q${p((h0 + h1) / 2, -2.6)} ${p(h0 + 30, 0)}Z`
    s += `<path d="M${p(h0, -w0)} Q${p((h0 + h1) / 2, -w1 * 1.6)} ${p(h1, -w1 * 1.4)} L${p(h1, w1 * 1.4)} Q${p((h0 + h1) / 2, w1 * 1.6)} ${p(h0, w0)} Z${hole}" fill="url(#mv-black)" fill-rule="evenodd" class="mv-hit"/>`
      + `<path d="${hole}" fill="none" stroke="#f4f6f9" stroke-opacity=".7" stroke-width=".8"/><path d="M${p(h0, -w0)} Q${p((h0 + h1) / 2, -w1 * 1.6)} ${p(h1, -w1 * 1.4)}" fill="none" stroke="#f4f6f9" stroke-opacity=".6" stroke-width=".8"/>`
      + screw((C.R - 5) * Math.cos(r), (C.R - 5) * Math.sin(r), 5.2, a + 90)
  }
  s += `<circle r="27" fill="url(#mv-black)"/><circle r="26.4" fill="none" stroke="#f4f6f9" stroke-opacity=".6" stroke-width=".8"/>`
  // the seconds arrow at the end of the upper arm (reads the seconds ring on the plate)
  s += `<path d="M-3 ${-C.R + 4} L-3 ${-C.R - 4} L-6.5 ${-C.R - 4} L0 ${-C.R - 22} L6.5 ${-C.R - 4} L3 ${-C.R - 4} L3 ${-C.R + 4}Z" fill="url(#mv-blued-l)" stroke="#06112e" stroke-width=".5"/>`
  // banking pins either side of the fork, near its pivot
  const by = C.P - 12, bx = 12 * Math.sin(C.FORK / DEG) + 4.6 + 2.1
  s += `<circle cx="${f2(-bx)}" cy="${f2(by)}" r="2.1" fill="url(#mv-steel-hi)" stroke="#0b0c0e" stroke-width=".4"/><circle cx="${f2(bx)}" cy="${f2(by)}" r="2.1" fill="url(#mv-steel-hi)" stroke="#0b0c0e" stroke-width=".4"/>`
  return s
}
/** above the balance: balance cock with jewel and shock spring, regulator index, stud and Breguet overcoil, escape and pallet cocks */
export function cageTop(): string {
  const C = CAGE
  const ca = -150 / DEG, n = ca + Math.PI / 2
  const p = (rad: number, off: number, a = ca, nn = n) => `${f2(rad * Math.cos(a) + off * Math.cos(nn))} ${f2(rad * Math.sin(a) + off * Math.sin(nn))}`
  let s = ''
  // Breguet overcoil: from the outermost coil, lifted over the spring, to the stud (a shadow first, then the blued wire)
  const hEnd = ((HAIR.r1 - HAIR.r0) / HAIR.pitch) * TAU
  const e = [HAIR.r1 * Math.cos(hEnd), HAIR.r1 * Math.sin(hEnd)]
  const st = [34 * Math.cos(-40 / DEG), 34 * Math.sin(-40 / DEG)]
  const oc = `M${f2(e[0])} ${f2(e[1])} C${f2(e[0] * 1.08)} ${f2(e[1] * 1.08 - 14)} ${f2(st[0] + 22)} ${f2(st[1] + 18)} ${f2(st[0])} ${f2(st[1])}`
  s += `<path d="${oc}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="2.2" transform="translate(1.6 2.2)"/><path d="${oc}" fill="none" stroke="url(#mv-blued-l)" stroke-width="1.15"/>`
  s += `<g class="mv-hit" data-part="stud"><rect x="${f2(st[0] - 6)}" y="${f2(st[1] - 4)}" width="12" height="8" rx="1.5" fill="url(#mv-steel-hi)" stroke="#0b0c0e" stroke-width=".5" transform="rotate(-40 ${f2(st[0])} ${f2(st[1])})"/>${screw(st[0] + 9 * Math.cos(-40 / DEG), st[1] + 9 * Math.sin(-40 / DEG), 3.4, 20)}</g>`
  // regulator index: pivots on the cock, its pins straddle the outer coil; a fine scale on the cock tail
  const ri = -66 / DEG
  s += `<g class="mv-hit" data-part="regulator"><path d="M${pt(14, ri + Math.PI)} L${pt(40, ri + Math.PI + 0.04)} L${pt(40, ri + Math.PI - 0.04)}Z M${pt(-3, ri + 0.6)} L${pt(46, ri + 0.03)} L${pt(46, ri - 0.03)} L${pt(-3, ri - 0.6)}Z" fill="url(#mv-steel-hi)" stroke="#0b0c0e" stroke-width=".45"/>`
    + `<circle cx="${f2(44.6 * Math.cos(ri + 0.05))}" cy="${f2(44.6 * Math.sin(ri + 0.05))}" r="1.3" fill="#e8ecf1"/><circle cx="${f2(44.6 * Math.cos(ri - 0.05))}" cy="${f2(44.6 * Math.sin(ri - 0.05))}" r="1.3" fill="#e8ecf1"/></g>`
  // balance cock: a tapered black-polished arm from the cage ring to a pad over the balance staff
  s += `<g class="mv-hit" data-part="cock"><path d="M${p(C.R - 4, -7)} Q${p(80, -4.5)} ${p(18, -12)} A15 15 0 1 1 ${p(18, 12)} Q${p(80, 4.5)} ${p(C.R - 4, 7)} Z" fill="url(#mv-black)" stroke="#0b0c0e" stroke-width=".6"/>`
    + `<path d="M${p(C.R - 6, -5.6)} Q${p(80, -3.4)} ${p(20, -10)}" fill="none" stroke="#f4f6f9" stroke-opacity=".75" stroke-width=".9"/>`
  for (let i = -3; i <= 3; i++) { const a = ri + Math.PI + i * 0.045; s += `<path d="M${pt(30, a)} L${pt(i % 3 === 0 ? 37 : 34, a)}" stroke="#d9c38a" stroke-width=".7"/>` }
  s += `<text x="${p(34, -12).split(' ')[0]}" y="${p(34, -12).split(' ')[1]}" class="mv-eng-s" text-anchor="middle">+</text><text x="${p(34, 13).split(' ')[0]}" y="${p(34, 13).split(' ')[1]}" class="mv-eng-s" text-anchor="middle">-</text>`
  s += screw(...(p(C.R - 18, 0).split(' ').map(Number) as [number, number]), 4.2, -60) + `</g>`
  // the balance jewel with its shock spring (a lyre)
  s += jewel(0, 0, 5.2, false)
  s += `<path class="mv-hit" data-part="shock" d="M-9 6 C-17 -3 -9 -15 0 -12 C9 -15 17 -3 9 6 M-9 6 C-6 2 -4 -4 0 -6 C4 -4 6 2 9 6" fill="none" stroke="url(#mv-gold-edge)" stroke-width="1.5" stroke-linecap="round"/>`
  // escape cock and pallet cock: slim black-polished bars from the cage to a jewelled pad. They come in from the side so the escape wheel and the pallet
  // stones stay in the open (the pallet cock runs level with the fork's pivot, clear of the stones and the wheel's top)
  const bar = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L
    return `<path d="M${f2(x0 + nx * w0)} ${f2(y0 + ny * w0)} L${f2(x1 + nx * w1)} ${f2(y1 + ny * w1)} A${f2(w1)} ${f2(w1)} 0 1 0 ${f2(x1 - nx * w1)} ${f2(y1 - ny * w1)} L${f2(x0 - nx * w0)} ${f2(y0 - ny * w0)}Z" fill="url(#mv-black)" stroke="#0b0c0e" stroke-width=".5"/>`
      + `<path d="M${f2(x0 + nx * w0)} ${f2(y0 + ny * w0)} L${f2(x1 + nx * w1)} ${f2(y1 + ny * w1)}" stroke="#f4f6f9" stroke-opacity=".75" stroke-width=".8"/>`
  }
  s += bar(77, 145, 0, C.E, 5, 2.6) + jewel(0, C.E, 4.6, false) + bar(-145, C.P, 0, C.P, 4.4, 2.4) + jewel(0, C.P, 3.6, false)
  return s
}

// ------------------------------------------------------------------------------------------------ shared defs: gradients, patterns, filters
export function defs(): string {
  return `<svg class="mv-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <radialGradient id="mv-gold" cx="50%" cy="50%" r="2.6%" spreadMethod="repeat"><stop offset="0" stop-color="#ecca7c"/><stop offset=".5" stop-color="#c99a45"/><stop offset="1" stop-color="#e6c172"/></radialGradient>
  <radialGradient id="mv-gold-hi" cx="50%" cy="50%" r="3.2%" spreadMethod="repeat"><stop offset="0" stop-color="#f4da98"/><stop offset=".5" stop-color="#d4a955"/><stop offset="1" stop-color="#efcf86"/></radialGradient>
  <radialGradient id="mv-gold-solid" cx="34%" cy="30%" r="80%"><stop offset="0" stop-color="#fff0b8"/><stop offset=".42" stop-color="#d8aa48"/><stop offset="1" stop-color="#6e4a0f"/></radialGradient>
  <radialGradient id="mv-chaton" cx="36%" cy="32%" r="78%"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#d9ad4f"/><stop offset=".82" stop-color="#9c7020"/><stop offset="1" stop-color="#5c3f08"/></radialGradient>
  <linearGradient id="mv-gold-edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4c9"/><stop offset=".5" stop-color="#d9b25f"/><stop offset="1" stop-color="#8a6420"/></linearGradient>
  <radialGradient id="mv-barrel-floor" cx="50%" cy="50%" r="1.4%" spreadMethod="repeat"><stop offset="0" stop-color="#4b3410"/><stop offset=".5" stop-color="#36250a"/><stop offset="1" stop-color="#47310f"/></radialGradient>
  <linearGradient id="mv-spring-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1f5"/><stop offset=".4" stop-color="#9aa2ad"/><stop offset=".6" stop-color="#d3d8df"/><stop offset="1" stop-color="#6b7480"/></linearGradient>
  <linearGradient id="mv-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f9"/><stop offset=".45" stop-color="#9aa3ae"/><stop offset=".55" stop-color="#c9d0d8"/><stop offset="1" stop-color="#5b6470"/></linearGradient>
  <linearGradient id="mv-steel-hi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#b9c1cb"/><stop offset=".6" stop-color="#e3e8ee"/><stop offset="1" stop-color="#6d7783"/></linearGradient>
  <linearGradient id="mv-steel-h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5b6470"/><stop offset=".35" stop-color="#f4f6f9"/><stop offset=".6" stop-color="#9aa3ae"/><stop offset="1" stop-color="#3e444c"/></linearGradient>
  <radialGradient id="mv-pivot" cx="40%" cy="38%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#aab2bd"/><stop offset="1" stop-color="#3e444c"/></radialGradient>
  <radialGradient id="mv-sun" cx="50%" cy="50%" r="0.9%" spreadMethod="repeat"><stop offset="0" stop-color="#b4bbc4"/><stop offset=".5" stop-color="#6c747e"/><stop offset="1" stop-color="#a8b0b9"/></radialGradient>
  <linearGradient id="mv-black" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3f46"/><stop offset=".38" stop-color="#0c0d0f"/><stop offset=".5" stop-color="#7f8892"/><stop offset=".56" stop-color="#121417"/><stop offset="1" stop-color="#050506"/></linearGradient>
  <radialGradient id="mv-blued" cx="34%" cy="30%" r="80%"><stop offset="0" stop-color="#a9c4ff"/><stop offset=".3" stop-color="#3a63e0"/><stop offset=".72" stop-color="#14287e"/><stop offset="1" stop-color="#0a1546"/></radialGradient>
  <linearGradient id="mv-blued-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fa3ff"/><stop offset=".45" stop-color="#2a4dc4"/><stop offset=".55" stop-color="#16297a"/><stop offset="1" stop-color="#3c64e0"/></linearGradient>
  <radialGradient id="mv-ruby" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#ffd1d6"/><stop offset=".22" stop-color="#ff2a4a"/><stop offset=".7" stop-color="#9c0322"/><stop offset="1" stop-color="#4a0010"/></radialGradient>
  <linearGradient id="mv-ruby-flat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff6a80"/><stop offset=".5" stop-color="#d0062c"/><stop offset="1" stop-color="#6a0016"/></linearGradient>
  <radialGradient id="mv-perl" cx="36%" cy="32%" r="70%"><stop offset="0" stop-color="#34373c"/><stop offset=".28" stop-color="#26282c"/><stop offset=".55" stop-color="#1c1d20"/><stop offset=".8" stop-color="#232529"/><stop offset="1" stop-color="#18191c"/></radialGradient>
  <pattern id="mv-perlage" width="22" height="19.05" patternUnits="userSpaceOnUse"><rect width="22" height="19.05" fill="#17181b"/><circle cx="0" cy="0" r="12" fill="url(#mv-perl)" stroke="#101113" stroke-width=".5"/><circle cx="22" cy="0" r="12" fill="url(#mv-perl)" stroke="#101113" stroke-width=".5"/><circle cx="11" cy="9.525" r="12" fill="url(#mv-perl)" stroke="#101113" stroke-width=".5"/><circle cx="0" cy="19.05" r="12" fill="url(#mv-perl)" stroke="#101113" stroke-width=".5"/><circle cx="22" cy="19.05" r="12" fill="url(#mv-perl)" stroke="#101113" stroke-width=".5"/></pattern>
  <linearGradient id="mv-cotes-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa1aa"/><stop offset=".22" stop-color="#c4cad1"/><stop offset=".46" stop-color="#e4e8ec"/><stop offset=".7" stop-color="#b7bec6"/><stop offset="1" stop-color="#959ca5"/></linearGradient>
  <pattern id="mv-cotes" width="42" height="42" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><rect width="42" height="42" fill="url(#mv-cotes-g)"/><rect width=".6" height="42" fill="#5d646d" opacity=".5"/><rect x="18" width="5" height="42" fill="#fff" opacity=".16"/></pattern>
  <linearGradient id="mv-bevel" gradientUnits="userSpaceOnUse" x1="-380" y1="-380" x2="380" y2="380"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d8dde3"/><stop offset=".7" stop-color="#8b929b"/><stop offset="1" stop-color="#4c535c"/></linearGradient>
  <linearGradient id="mv-case" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3f5f8"/><stop offset=".3" stop-color="#6b727c"/><stop offset=".55" stop-color="#d7dce2"/><stop offset=".8" stop-color="#3e444c"/><stop offset="1" stop-color="#a9b0b9"/></linearGradient>
  <radialGradient id="mv-recess" cx="50%" cy="44%" r="54%"><stop offset="0" stop-color="#262a30"/><stop offset=".55" stop-color="#1a1d21"/><stop offset=".86" stop-color="#0f1113"/><stop offset="1" stop-color="#050506"/></radialGradient>
  <clipPath id="mv-plate-clip"><circle r="462"/></clipPath>
  <filter id="mv-f-bridge" x="-6%" y="-6%" width="114%" height="114%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.85" numOctaves="2" seed="11" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="dw"/>
    <feComposite in="dw" in2="SourceAlpha" operator="in" result="dc"/><feMerge result="d"><feMergeNode in="SourceGraphic"/><feMergeNode in="dc"/></feMerge>
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="b"/>
    <feSpecularLighting in="b" surfaceScale="3.4" specularConstant="1.05" specularExponent="26" lighting-color="#ffffff" result="s"><feDistantLight azimuth="225" elevation="36"/></feSpecularLighting>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/>
    <feComposite in="d" in2="sp" operator="arithmetic" k1="0" k2="1" k3=".62" k4="0" result="lit"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="sb"/><feOffset in="sb" dx="7" dy="11" result="so"/>
    <feFlood flood-color="#000" flood-opacity=".62"/><feComposite in2="so" operator="in" result="sh"/>
    <feMerge><feMergeNode in="sh"/><feMergeNode in="lit"/></feMerge>
  </filter>
  <filter id="mv-f-shadow" x="-10%" y="-10%" width="125%" height="125%"><feGaussianBlur in="SourceAlpha" stdDeviation="7"/><feOffset dx="6" dy="10" result="o"/><feFlood flood-color="#000" flood-opacity=".6"/><feComposite in2="o" operator="in" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="mv-f-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="3" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0" result="g"/><feComposite in="g" in2="SourceAlpha" operator="in" result="gi"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gi"/></feMerge></filter>
  <filter id="mv-f-blur8" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs></svg>`
}

// ------------------------------------------------------------------------------------------------ static layers (each: an unfiltered art group the loupe re-uses by id, plus main-view-only filter extras)
const eng = (text: string, x: number, y: number, a: number, size: number, ls = 3) =>
  `<g transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(a)})"><text class="mv-eng" text-anchor="middle" dominant-baseline="central" font-size="${size}" letter-spacing="${ls}" fill="#141518" stroke="#141518" stroke-width="1.6" stroke-linejoin="round">${text}</text>`
  + `<text class="mv-eng" text-anchor="middle" dominant-baseline="central" font-size="${size}" letter-spacing="${ls}" fill="url(#mv-gold-edge)">${text}</text></g>`

export function plateSvg(): string {
  const F = P.F
  let secs = ''
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - Math.PI / 2, big = i % 5 === 0, r0 = big ? 176 : 179.5, r1 = big ? 191 : 186
    secs += `<line x1="${f2(F[0] + r0 * Math.cos(a))}" y1="${f2(F[1] + r0 * Math.sin(a))}" x2="${f2(F[0] + r1 * Math.cos(a))}" y2="${f2(F[1] + r1 * Math.sin(a))}" stroke="#EDE6D6" stroke-opacity="${big ? 0.85 : 0.42}" stroke-width="${big ? 2.2 : 1}"/>`
  }
  const sink = (p: readonly number[], r: number) => `<circle cx="${f2(p[0])}" cy="${f2(p[1])}" r="${r}" fill="#060607"/><circle cx="${f2(p[0])}" cy="${f2(p[1])}" r="${r}" fill="none" stroke="url(#mv-bevel)" stroke-width="2"/>`
  const art = `<g id="mvs-plate">`
    + `<circle r="492" fill="url(#mv-case)"/><circle r="486" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.4"/><circle r="472" fill="none" stroke="#1d2126" stroke-width="7"/>`
    + `<circle r="468" fill="url(#mv-bevel)"/><circle r="462" fill="url(#mv-perlage)"/>`
    // the tourbillon aperture: a recess with a polished chamfer, then the engraved seconds ring
    + `<circle cx="${F[0]}" cy="${F[1]}" r="174" fill="url(#mv-recess)"/><circle cx="${F[0]}" cy="${F[1]}" r="174" fill="none" stroke="url(#mv-bevel)" stroke-width="3.4"/>${secs}`
    + `<circle cx="${F[0]}" cy="${F[1]}" r="193.5" fill="none" stroke="#EDE6D6" stroke-opacity=".22" stroke-width=".8"/>`
    + sink(P.MW, 16) + sink(P.R, 14)
    + `<path id="mv-arc-tb" d="${arcD(204, (-178 / 180) * Math.PI, (-132 / 180) * Math.PI, F[0], F[1])}" fill="none"/>`
    + `<text class="mv-eng" font-size="12.5" letter-spacing="3.4" fill="#EDE6D6" fill-opacity=".72"><textPath href="#mv-arc-tb" startOffset="50%" text-anchor="middle">TOURBILLON</textPath></text>`
    + `<path id="mv-arc-rim" d="${arcD(444, (122 / 180) * Math.PI, (160 / 180) * Math.PI)}" fill="none"/>`
    + `<text class="mv-eng" font-size="11.5" letter-spacing="4" fill="#EDE6D6" fill-opacity=".6"><textPath href="#mv-arc-rim" startOffset="50%" text-anchor="middle">SIMULATED MOVEMENT</textPath></text>`
    + `</g>`
  return `<svg viewBox="-500 -500 1000 1000" class="mv-full" aria-hidden="true"><g filter="url(#mv-f-grain)">${art}</g></svg>`
}

/** layer 4 (static): the fixed fourth wheel the escape pinion rolls round, screwed to the plate; the cage's cast shadow under it */
export function fixedSvg(): string {
  const F = P.F, g = involute(48, M4), rim = g.rr - 6, hub = 34, win = windows(6, hub, rim, 4, 0.5)
  const art = `<g id="mvs-fixed"><g transform="translate(${F[0]} ${F[1]})" class="mv-hit" data-part="fixed-wheel">`
    + `<path d="${g.path}${win}${circle(13)}" fill="url(#mv-gold)" fill-rule="evenodd"/><path d="${g.path}" fill="none" stroke="#4a3206" stroke-opacity=".55" stroke-width=".8"/>`
    + `<path d="${win}" fill="none" stroke="#fff1c4" stroke-opacity=".6" stroke-width="1.4"/><circle r="${rim + 1.4}" fill="none" stroke="#fff3cc" stroke-opacity=".35" stroke-width=".8"/>`
    + screw(22 * Math.cos(-1.2), 22 * Math.sin(-1.2), 5.5, 30) + screw(22 * Math.cos(0.9), 22 * Math.sin(0.9), 5.5, 30) + screw(22 * Math.cos(3.0), 22 * Math.sin(3.0), 5.5, 30)
    + `</g></g>`
  return `<svg viewBox="-500 -500 1000 1000" class="mv-full" aria-hidden="true"><circle cx="${F[0] + 10}" cy="${F[1] + 16}" r="${CAGE.R - 4}" fill="#000" opacity=".5" filter="url(#mv-f-blur8)"/><g filter="url(#mv-f-shadow)">${art}</g></svg>`
}

/** layer 5 (static): barrel bridge and train bridge, Cotes de Geneve with polished bevels, jewels, blued screws, engraved lettering */
export function bridgesSvg(): string {
  const B = P.B, T = P.T, C = P.C, K = P.K
  const pieces: { d: string; w: number }[] = [
    { d: `M-470 -2 Q-300 -20 ${B[0]} ${B[1]}`, w: 62 }, { d: `M${B[0]} ${B[1]} Q-70 -250 ${K[0]} ${K[1]} Q40 -400 150 -470`, w: 50 },
    { d: `M470 214 Q300 222 ${f2(T[0])} ${f2(T[1])} Q60 60 ${C[0]} ${C[1]}`, w: 46 }, { d: `M${C[0]} ${C[1]} Q170 -120 262 -380`, w: 38 },
  ]
  const pads = [[B, 66], [K, 46], [T, 40], [C, 44]] as const
  const geo = (w: number) => pieces.map(p => `<path d="${p.d}" fill="none" stroke-width="${p.w + w}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')
    + pads.map(([q, r]) => `<circle cx="${f2(q[0])}" cy="${f2(q[1])}" r="${r + w / 2}"/>`).join('')
  // union look: a dark rim, the polished bevel, then the Cotes de Geneve face
  const body = `<g fill="#0b0c0e" stroke="#0b0c0e">${geo(7)}</g><g fill="url(#mv-bevel)" stroke="url(#mv-bevel)">${geo(3.4)}</g><g fill="url(#mv-cotes)" stroke="url(#mv-cotes)">${geo(-2)}</g>`
  const hit = `<g fill="transparent" stroke="transparent" class="mv-hit" data-part="barrel-bridge">${[pieces[0], pieces[1]].map(p => `<path d="${p.d}" fill="none" stroke-width="${p.w}" stroke-linecap="round"/>`).join('')}</g>`
    + `<g fill="transparent" stroke="transparent" class="mv-hit" data-part="train-bridge">${[pieces[2], pieces[3]].map(p => `<path d="${p.d}" fill="none" stroke-width="${p.w}" stroke-linecap="round"/>`).join('')}</g>`
  const lettering = eng('JOB WATCHDOG', -335, -34, -20.5, 15, 3.2)
    + eng('CHECKS EVERY JOB', 252, 171, 22, 12, 2.4)
    + eng('HOURLY', 176, -194, -59, 12, 3)
  const ornaments = jewel(T[0], T[1], 8.5) + screw(T[0] + 30 * Math.cos(2.4), T[1] + 30 * Math.sin(2.4), 7, 20) + screw(-418, -52, 10, 20)
    + screw(126, -440, 9.5, 20) + screw(424, 214, 9.5, 20) + screw(236, -334, 8.5, 20) + screw(58, 46, 8, 20) + screw(-246, -36, 8, 20)
    // the click spring (a polished steel wire, curving from its screw to the click)
  const ck = CLICK_AT
  const csd = `M${f2(ck[0] - 60)} ${f2(ck[1] - 62)} Q${f2(ck[0] - 40)} ${f2(ck[1] - 10)} ${f2(ck[0] + 7)} ${f2(ck[1] + 22)}`
  const cs = `<path d="${csd}" fill="none" stroke="#0b0c0e" stroke-width="5" stroke-linecap="round"/><path d="${csd}" fill="none" stroke="url(#mv-steel-hi)" stroke-width="2.6" stroke-linecap="round"/>` + screw(ck[0] - 60, ck[1] - 62, 6.5, 20)
  // the bridges stop at a round opening over the barrel (under the ratchet's rim, so no seam shows): the mainspring is seen through the ratchet's windows
  const open = `<mask id="mv-bridge-mask" maskUnits="userSpaceOnUse" x="-500" y="-500" width="1000" height="1000"><rect x="-500" y="-500" width="1000" height="1000" fill="#fff"/><circle cx="${B[0]}" cy="${B[1]}" r="${f2(RATCHET.ro - 19)}" fill="#000"/></mask>`
  const art = `<g id="mvs-bridges"><g clip-path="url(#mv-plate-clip)"><g mask="url(#mv-bridge-mask)">${body}</g></g>${lettering}${ornaments}${cs}</g>`
  return `<svg viewBox="-500 -500 1000 1000" class="mv-full" aria-hidden="true"><defs>${open}</defs><g filter="url(#mv-f-bridge)">${art}</g>${hit}</svg>`
}

/** layer 9 (static): chapter ring (open at six for the tourbillon), applied indices, the power-reserve scale */
export function dialSvg(): string {
  let ticks = ''
  for (let i = 0; i < 60; i++) {
    const deg = (i / 60) * 360 - 90
    if (deg > 62 && deg < 118) continue
    const a = (deg / 180) * Math.PI, big = i % 5 === 0
    if (big) {
      const r0 = 398, r1 = 438, w = i === 0 ? 4.5 : 6
      const draw = (off: number) => `<g transform="rotate(${f2(deg)})"><rect x="${r0}" y="${f2(off - w / 2)}" width="${r1 - r0}" height="${w}" rx="1" fill="#000" opacity=".55" transform="translate(3 4)"/><rect x="${r0}" y="${f2(off - w / 2)}" width="${r1 - r0}" height="${w}" rx="1" fill="url(#mv-gold-edge)"/><rect x="${r0 + 2}" y="${f2(off - w / 2 + 0.6)}" width="${r1 - r0 - 4}" height="1.1" fill="#fff8de" opacity=".8"/></g>`
      ticks += i === 0 ? draw(-5) + draw(5) : draw(0)
    } else ticks += `<line x1="${f2(444 * Math.cos(a))}" y1="${f2(444 * Math.sin(a))}" x2="${f2(454 * Math.cos(a))}" y2="${f2(454 * Math.sin(a))}" stroke="#EDE6D6" stroke-opacity=".5" stroke-width="1.3"/>`
  }
  // power reserve: 'down' at -150 degrees, 'up' at -30 degrees around its pivot
  const R = P.R, a0 = (-150 / 180) * Math.PI, a1 = (-30 / 180) * Math.PI
  let pr = `<path transform="translate(${R[0]} ${R[1]})" d="${ringSector(96, 104, a0, a1)}" fill="#EDE6D6" fill-opacity=".1" stroke="#EDE6D6" stroke-opacity=".5" stroke-width=".8"/>`
  for (let i = 0; i <= 12; i++) { const a = a0 + ((a1 - a0) * i) / 12, big = i % 3 === 0; pr += `<line x1="${f2(R[0] + 104 * Math.cos(a))}" y1="${f2(R[1] + 104 * Math.sin(a))}" x2="${f2(R[0] + (big ? 116 : 110) * Math.cos(a))}" y2="${f2(R[1] + (big ? 116 : 110) * Math.sin(a))}" stroke="#EDE6D6" stroke-opacity="${big ? 0.85 : 0.5}" stroke-width="${big ? 1.8 : 1}"/>` }
  pr += `<path d="${arcD(100, a0, a0 + (a1 - a0) * 0.18, R[0], R[1])}" fill="none" stroke="${ACCENT}" stroke-opacity=".9" stroke-width="5"/>`
  pr += `<text class="mv-eng" x="${f2(R[0] + 128 * Math.cos(a0))}" y="${f2(R[1] + 128 * Math.sin(a0) + 4)}" font-size="11" letter-spacing="2" text-anchor="middle" fill="#EDE6D6" fill-opacity=".8">DOWN</text>`
  pr += `<text class="mv-eng" x="${f2(R[0] + 126 * Math.cos(a1))}" y="${f2(R[1] + 126 * Math.sin(a1) + 4)}" font-size="11" letter-spacing="2" text-anchor="middle" fill="#EDE6D6" fill-opacity=".8">UP</text>`
  pr += `<text class="mv-eng" x="${R[0]}" y="${R[1] - 46}" font-size="9.5" letter-spacing="2.6" text-anchor="middle" fill="#EDE6D6" fill-opacity=".62">RESERVE</text>`
  const art = `<g id="mvs-dial"><circle r="456" fill="none" stroke="#EDE6D6" stroke-opacity=".18" stroke-width="1"/>${ticks}<g class="mv-hit" data-part="reserve-scale">${pr}</g></g>`
  return `<svg viewBox="-500 -500 1000 1000" class="mv-full" aria-hidden="true">${art}</svg>`
}

/** the parts the explode view labels: [layer, label, anchor x, anchor y] in movement units */
export const LABELS: [number, string, number, number][] = [
  [0, 'Case and plate', -452, 120], [1, 'Barrel and mainspring', -306, -150], [2, 'Centre wheel', -150, 30], [3, 'Third wheel', 0, 70],
  [4, 'Fixed fourth wheel', -100, 250], [5, 'Bridges', -430, -40], [6, 'Keyless works', -268, -150], [7, 'Flying tourbillon', -168, 250],
  [8, 'Motion works', 6, -26], [9, 'Chapter ring and hands', -440, -120],
]

/** the assembled movement as one static SVG string (a probe can render it without the app) */
export function composeStatic(at = new Date(2026, 9, 12, 10, 9, 30)): string {
  const parts = buildParts(at)
  const inner = (svg: string) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  const kids = (id: string) => parts.filter(p => p.parent === id).map(p => `<g transform="translate(${p.at[0]} ${p.at[1]}) rotate(${(p.phase || 0).toFixed(2)})">${p.svg}</g>`).join('')
  const layer = (i: number) => parts.filter(p => p.layer === i && !p.parent).map(p => `<g transform="translate(${p.at[0]} ${p.at[1]}) rotate(${(p.drive === 'reserve' ? -150 + 120 * 0.62 : p.drive === 'pallet' ? -CAGE.FORK : p.phase).toFixed(3)})">${p.svg}${p.id === 'cage' ? kids('cage') + cageTop() : ''}</g>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-560 -600 1120 1160" width="1120" height="1160"><rect x="-560" y="-600" width="1120" height="1160" fill="#050506"/>`
    + inner(defs()) + inner(plateSvg()) + layer(0) + layer(1) + layer(2) + layer(3) + inner(fixedSvg()) + inner(bridgesSvg()) + layer(6) + layer(7) + layer(8) + inner(dialSvg()) + layer(9) + `</svg>`
}
