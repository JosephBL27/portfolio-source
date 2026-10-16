// Second Brain lab: one day of the vault, played in 24 seconds.
// 9 sources, 19 agents, the vault and 7 outputs from src/data/nervous-system.json; the vault itself is the real note graph from
// src/data/brain-graph.json (478 notes, 1,887 links, one colour per folder). Every node fires at the cadence its schedule states;
// comets run the edges, and a comet that lands on a vault area lights a few notes of that folder and spreads along real links.
// The day is a pure function of the clock, so the scrub bar and the keyboard can go anywhere in it. Hover or tap a node for what it is;
// vault areas are named by folder, never by note title. Ported from ~/PORTFOLIO/src/sb/brain/NervousSystem.tsx (React, 2,140 lines):
// the cadence parser and the firing rules are carried over (lib/day-sim.ts), the layout is new: the agents orbit the vault.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: brain:pulse (a comet lands in the vault), lab:drag (the clock is scrubbed).
import './second-brain.css'
import nervousRaw from '../../data/nervous-system.json'
import projectsRaw from '../../data/projects.json'
import { buildDay, wrap24, type DData, type Day } from './lib/day-sim'
import { GROUP_COLOR, loadVault, wave, type VaultGraph } from './lib/vault-graph'
import { TAU, clamp, esc, fitCanvas, frameLoop, gate, lerp, mulberry, onFirstView, sitePaused, type LabHandle, type LabOpts } from './lib/kit'

const DAY_SECONDS = 24
const START_HOUR = 4.5
const KC = ['#6fd3d9', '#f2b37c', '#9fd47c', '#f3e9d6']
const KNAME = ['Source', 'Agent', 'Vault area', 'Output']
const fmtClock = (h: number) => { const m = Math.floor(wrap24(h) * 60 + 1e-6); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
const projName = (id: string) => (projectsRaw as { id: string; name: string }[]).find(p => p.id === id)?.name ?? id
/** note titles never show: this one node label and one detail sentence name a vault note, so they are reworded */
const clean = (s: string) => s.replace(/Brain Health/g, 'the health dashboard')
/** vault areas by folder type. Only folders the data itself names or the vault layout confirms are shown; the rest stay generic */
const AREA: Record<string, { title: string; folder?: string; group: number }> = {
  vault: { title: 'The vault', group: -1 },
  boot: { title: 'Boot files', group: 8 },
  projects: { title: 'Project notes', folder: '10 Projects', group: 1 },
  daily: { title: 'Daily notes', folder: '50 Daily', group: 5 },
  sessions: { title: 'Session logs', folder: '20 Areas', group: 2 },
  health: { title: 'Health dashboard', folder: '90 Meta', group: 8 },
  courses: { title: 'Course notes', folder: '20 Areas', group: 2 },
  axe: { title: 'Agent rules', folder: '90 Meta', group: 8 },
  claims: { title: 'Evidence claims', group: 1 },
}

interface Route { pts: Float32Array; len: Float32Array; total: number; ax: number; ay: number; bx: number; by: number }
interface Layout {
  W: number; H: number; tall: boolean; cx: number; cy: number; R: number; ring: number; u: number
  x: Float64Array; y: Float64Array; routes: Route[]; vx: Float32Array; vy: Float32Array
}

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cueDrag = gate(opts.emit, 80), cuePulse = gate(opts.emit, 320)
  const day: Day = buildDay(nervousRaw as unknown as DData, START_HOUR)
  const vg: VaultGraph = loadVault()
  const N = day.nodes.length
  const counts = [0, 0, 0, 0]; day.kind.forEach(k => counts[k]++)
  const vaultIdx = day.idx.get('vault') ?? -1

  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'sb'
  root.setAttribute('data-proof', 'skip')
  const folderChips = vg.groups.map((name, g) => ({ name, g, n: vg.byGroup[g].length })).filter(f => f.n > 0)
  root.innerHTML = `
  <header class="sb-head">
    <div>
      <span class="sb-kicker">Interactive model, one day of the vault</span>
      <h3 class="sb-title">A day in 24 seconds</h3>
    </div>
    <p class="sb-note" role="note">Each node fires at the cadence its schedule states. Weekly jobs share this one day. Vault areas are named by folder, never by note title.</p>
  </header>
  <div class="sb-stage">
    <canvas class="sb-cv" role="img" aria-label="Nine sources feed nineteen agents that orbit the vault, drawn as its ${vg.n} notes. Pulses run from sources through agents into the vault and out to seven outputs, over one simulated day. Hover or tap a node to read what it does. The clock and the scrub bar below move through the day."></canvas>
    <div class="sb-tip" hidden></div>
  </div>
  <ul class="sb-key" aria-hidden="true">${KNAME.map((k, i) => `<li><i style="background:${KC[i]}"></i>${i === 2 ? `The vault <b>${vg.n}</b> notes` : `${k}s <b>${counts[i]}</b>`}</li>`).join('')}</ul>
  <div class="sb-ctl">
    <button type="button" class="sb-play" aria-label="Pause the day" aria-pressed="true"><svg viewBox="0 0 16 16" aria-hidden="true"><path class="p" d="M4 3h3v10H4zM9 3h3v10H9z"/><path class="q" d="M4 2.5 13 8l-9 5.5z"/></svg></button>
    <div class="sb-clock" aria-hidden="true"><b>${fmtClock(START_HOUR)}</b><span>Chicago time</span></div>
    <div class="sb-scrub">
      <canvas class="sb-strip" aria-hidden="true"></canvas>
      <i class="sb-cursor" aria-hidden="true"></i>
      <input class="sb-range" type="range" min="0" max="1439" step="1" value="${Math.round(START_HOUR * 60)}" aria-label="Time of day, Chicago" aria-valuetext="${fmtClock(START_HOUR)}">
      <span class="sb-ticks" aria-hidden="true"><em>00</em><em>06</em><em>12</em><em>18</em><em>24</em></span>
    </div>
  </div>
  <div class="sb-ticker">
    <p class="sb-story" aria-live="off"></p>
    <div class="sb-card" hidden></div>
  </div>
  <ul class="sb-folders" aria-label="Vault folders, colours of the notes in the disc">${folderChips.map(f => `<li><button type="button" class="sb-chip" data-g="${f.g}"><i style="background:${GROUP_COLOR[f.g]}"></i>${esc(f.name)}<b>${f.n}</b></button></li>`).join('')}</ul>
  <p class="sb-hint">Drag the clock to any hour. Hover a node, or tap one, to see what feeds it and what it feeds; click to keep it open. Hover a folder to find its notes in the vault.</p>`
  host.append(root)
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T
  const cv = $<HTMLCanvasElement>('.sb-cv'), g = cv.getContext('2d')!
  const strip = $<HTMLCanvasElement>('.sb-strip'), sg = strip.getContext('2d')!
  const clockEl = $('.sb-clock b'), storyEl = $('.sb-story'), cardEl = $('.sb-card'), tipEl = $('.sb-tip'), cursorEl = $('.sb-cursor')
  const range = $<HTMLInputElement>('.sb-range'), playBtn = $<HTMLButtonElement>('.sb-play')
  const css = getComputedStyle(root)
  const MONO = () => css.getPropertyValue('--sb-mono').trim() || 'ui-monospace, Menlo, monospace'

  // ------------------------------------------------------------------------------------------------ state
  let h = reduced ? 7.35 : START_HOUR, prevH = h
  let playing = false, scrubbing = false, resumeAfter = false
  let focus = -1, pinned = -1, hoverNote = -1, groupFocus = -1, groupLock = -1
  let lastStory = -2, lastClock = ''
  let L: Layout
  let dpr = 1
  let sprites: HTMLCanvasElement[] = []
  let baseLinks: HTMLCanvasElement | null = null
  const heat = new Float32Array(vg.n)

  // landing waves, one per vault arrival: which notes light, and in what hop order
  const AREA_GROUP = (id: string, k: number) => {
    const a = AREA[id]
    if (a && a.group >= 0) return a.group
    const pool = [1, 2, 2, 3, 5, 5, 8, 8, 6]; return pool[Math.floor(mulberry(k * 977 + 5)() * pool.length)]
  }
  const waves = day.arrivals.map((a, k) => wave(vg, AREA_GROUP(day.nodes[a.node].id, k), mulberry(k * 131 + 17)()))

  // ------------------------------------------------------------------------------------------------ layout
  // The vault sits in the middle; the agents orbit it; sources stand on one side and outputs on the other. A short relaxation
  // (springs on the edges, repulsion between nodes, a wall round the disc) places them, so the picture follows the data.
  function relax(W: number, H: number, tall: boolean): Layout {
    const cx = W / 2, cy = H / 2
    const u = clamp(Math.min(W, H) / 440, 0.78, 1.35)
    const R = tall ? Math.min(W * 0.2, H * 0.15) : Math.min(W * 0.15, H * 0.27)
    const ring = R * 1.17
    const ax = tall ? 1 : 0, cr = tall ? 0 : 1            // ax: the axis sources and outputs stand along... (index into [x,y])
    const pos = new Float64Array(N * 2)
    const kinds = day.kind
    const rnd = mulberry(20261009)
    const bySide: number[][] = [[], [], [], []]; kinds.forEach((k, i) => bySide[k].push(i))
    const margin = tall ? H * 0.065 : W * 0.075
    const spread = (list: number[], axisVal: number, lo: number, hi: number) => list.forEach((i, k) => { pos[i * 2 + ax] = axisVal; pos[i * 2 + cr] = lo + ((k + 0.5) / list.length) * (hi - lo) })
    const crossLo = (tall ? W : H) * 0.07, crossHi = (tall ? W : H) * 0.93
    spread(bySide[0], tall ? margin : margin, crossLo, crossHi)
    spread(bySide[3], tall ? H - margin : W - margin, crossLo, crossHi)
    const portAngle = new Float64Array(N)
    const ports = bySide[2].filter(i => i !== vaultIdx)
    ports.forEach((i, k) => { portAngle[i] = ((k + 0.5) / ports.length) * TAU + rnd() * 0.2; pos[i * 2] = cx + Math.cos(portAngle[i]) * ring; pos[i * 2 + 1] = cy + Math.sin(portAngle[i]) * ring })
    if (vaultIdx >= 0) { pos[vaultIdx * 2] = cx; pos[vaultIdx * 2 + 1] = cy }
    bySide[1].forEach((i, k) => { const a = (k / bySide[1].length) * TAU + 0.3; pos[i * 2] = cx + Math.cos(a) * W * 0.3; pos[i * 2 + 1] = cy + Math.sin(a) * H * 0.36 })
    const vel = new Float64Array(N * 2)
    const rest = (a: number, b: number) => { const ka = kinds[a], kb = kinds[b]; const sc = Math.min(W, H); if (ka === 0 || kb === 0) return sc * 0.36; if (ka === 3 || kb === 3) return sc * 0.34; if (ka === 2 || kb === 2) return R * 0.7; return sc * 0.2 }
    const fixed = (i: number) => kinds[i] === 0 || kinds[i] === 3
    for (let it = 0; it < 520; it++) {
      const cool = 1 - it / 620
      const f = new Float64Array(N * 2)
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        if (i === vaultIdx || j === vaultIdx) continue
        const dx = pos[i * 2] - pos[j * 2], dy = pos[i * 2 + 1] - pos[j * 2 + 1]
        const d2 = dx * dx + dy * dy + 4, d = Math.sqrt(d2)
        const rep = (kinds[i] === 1 && kinds[j] === 1 ? 5200 : 2600) * u * u / d2
        const fx = (dx / d) * rep, fy = (dy / d) * rep
        f[i * 2] += fx; f[i * 2 + 1] += fy; f[j * 2] -= fx; f[j * 2 + 1] -= fy
      }
      for (const e of day.edges) {
        if (e.a === vaultIdx || e.b === vaultIdx) { const o = e.a === vaultIdx ? e.b : e.a; const dx = cx - pos[o * 2], dy = cy - pos[o * 2 + 1], d = Math.hypot(dx, dy) + 1e-6, L0 = R * 1.9, k = 0.012 * (d - L0); f[o * 2] += (dx / d) * k; f[o * 2 + 1] += (dy / d) * k; continue }
        const dx = pos[e.b * 2] - pos[e.a * 2], dy = pos[e.b * 2 + 1] - pos[e.a * 2 + 1], d = Math.hypot(dx, dy) + 1e-6, k = 0.02 * (d - rest(e.a, e.b))
        f[e.a * 2] += (dx / d) * k; f[e.a * 2 + 1] += (dy / d) * k; f[e.b * 2] -= (dx / d) * k; f[e.b * 2 + 1] -= (dy / d) * k
      }
      for (const i of bySide[1]) {            // the wall round the disc, and a soft pull so the orbit stays an orbit
        const dx = pos[i * 2] - cx, dy = pos[i * 2 + 1] - cy, d = Math.hypot(dx, dy) + 1e-6, wall = R * 1.75
        if (d < wall) { f[i * 2] += (dx / d) * (wall - d) * 0.9; f[i * 2 + 1] += (dy / d) * (wall - d) * 0.9 }
      }
      for (let i = 0; i < N; i++) {
        if (i === vaultIdx) continue
        if (kinds[i] === 2) {                // a port slides along the ring
          const tx = -Math.sin(portAngle[i]), ty = Math.cos(portAngle[i])
          portAngle[i] += ((f[i * 2] * tx + f[i * 2 + 1] * ty) * 0.0016) * cool
          pos[i * 2] = cx + Math.cos(portAngle[i]) * ring; pos[i * 2 + 1] = cy + Math.sin(portAngle[i]) * ring; continue
        }
        if (fixed(i)) { vel[i * 2 + cr] = (vel[i * 2 + cr] + f[i * 2 + cr]) * 0.82; pos[i * 2 + cr] = clamp(pos[i * 2 + cr] + vel[i * 2 + cr] * cool * 0.5, crossLo, crossHi); continue }
        vel[i * 2] = (vel[i * 2] + f[i * 2]) * 0.8; vel[i * 2 + 1] = (vel[i * 2 + 1] + f[i * 2 + 1]) * 0.8
        pos[i * 2] = clamp(pos[i * 2] + vel[i * 2] * cool * 0.5, tall ? W * 0.1 : W * 0.2, tall ? W * 0.9 : W * 0.8); pos[i * 2 + 1] = clamp(pos[i * 2 + 1] + vel[i * 2 + 1] * cool * 0.5, H * 0.06, H * 0.94)
      }
    }
    const x = new Float64Array(N), y = new Float64Array(N)
    for (let i = 0; i < N; i++) { x[i] = pos[i * 2]; y[i] = pos[i * 2 + 1] }
    // routes: a gentle cubic from each node to the next; edges at the vault end on the ring, facing the other end
    const routes = day.edges.map((e, k): Route => {
      let ax2 = x[e.a], ay2 = y[e.a], bx2 = x[e.b], by2 = y[e.b]
      const rim = (ox: number, oy: number) => { const a = Math.atan2(oy - cy, ox - cx); return [cx + Math.cos(a) * ring, cy + Math.sin(a) * ring] as const }
      if (e.a === vaultIdx) [ax2, ay2] = rim(bx2, by2)
      if (e.b === vaultIdx) [bx2, by2] = rim(ax2, ay2)
      const dx = bx2 - ax2, dy = by2 - ay2, len = Math.hypot(dx, dy) + 1e-6, nx = -dy / len, ny = dx / len
      const bend = len * 0.16 * (((k * 2654435761) >>> 0) % 2 ? 1 : -1)
      const c1x = ax2 + dx * 0.3 + nx * bend, c1y = ay2 + dy * 0.3 + ny * bend, c2x = ax2 + dx * 0.7 + nx * bend, c2y = ay2 + dy * 0.7 + ny * bend
      const S = 36, pts = new Float32Array((S + 1) * 2), cl = new Float32Array(S + 1)
      for (let s = 0; s <= S; s++) {
        const t = s / S, m = 1 - t
        pts[s * 2] = m * m * m * ax2 + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t * t * t * bx2
        pts[s * 2 + 1] = m * m * m * ay2 + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t * t * t * by2
        if (s) cl[s] = cl[s - 1] + Math.hypot(pts[s * 2] - pts[s * 2 - 2], pts[s * 2 + 1] - pts[s * 2 - 1])
      }
      return { pts, len: cl, total: cl[S] || 1, ax: ax2, ay: ay2, bx: bx2, by: by2 }
    })
    // vault notes in canvas space
    const vx = new Float32Array(vg.n), vy = new Float32Array(vg.n)
    // the force layout packs most notes into a dense core: spread the radius (r^0.5) so the whole disc is used; angles and neighbours are untouched
    for (let i = 0; i < vg.n; i++) { const r = Math.hypot(vg.x[i], vg.y[i]) || 1e-6, rr = (R * 0.96) * (r / vg.maxR) ** 0.5; vx[i] = cx + (vg.x[i] / r) * rr; vy[i] = cy + (vg.y[i] / r) * rr }
    return { W, H, tall, cx, cy, R, ring, u, x, y, routes, vx, vy }
  }
  const at = (r: Route, s: number): [number, number] => {
    const target = clamp(s, 0, 1) * r.total
    let lo = 0, hi = r.len.length - 1
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (r.len[mid] < target) lo = mid; else hi = mid }
    const span = r.len[hi] - r.len[lo] || 1, f = (target - r.len[lo]) / span
    return [lerp(r.pts[lo * 2], r.pts[hi * 2], f), lerp(r.pts[lo * 2 + 1], r.pts[hi * 2 + 1], f)]
  }

  function buildLayers() {
    const { W, H } = L
    // glow sprites, one per kind (drawn additively on the heads of the comets)
    sprites = KC.map(c => { const s = 64, cvs = document.createElement('canvas'); cvs.width = cvs.height = s; const x = cvs.getContext('2d')!, gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, c + 'ff'); gr.addColorStop(0.25, c + 'aa'); gr.addColorStop(1, c + '00'); x.fillStyle = gr; x.fillRect(0, 0, s, s); return cvs })
    // the vault's links, drawn once: faint hairlines under the live notes
    baseLinks = document.createElement('canvas'); baseLinks.width = Math.ceil(W * dpr); baseLinks.height = Math.ceil(H * dpr)
    const b = baseLinks.getContext('2d')!; b.scale(dpr, dpr)
    b.strokeStyle = 'rgba(190,225,205,.085)'; b.lineWidth = 0.6; b.beginPath()
    for (let i = 0; i < vg.links.length; i += 2) { const a = vg.links[i], c = vg.links[i + 1]; b.moveTo(L.vx[a], L.vy[a]); b.lineTo(L.vx[c], L.vy[c]) }
    b.stroke()
    // the activity strip under the scrub bar
    const sw = strip.clientWidth || 600, shh = strip.clientHeight || 28
    strip.width = Math.round(sw * dpr); strip.height = Math.round(shh * dpr)
    sg.setTransform(dpr, 0, 0, dpr, 0, 0); sg.clearRect(0, 0, sw, shh)
    const mx = Math.max(1, ...day.perHour), bw = sw / 24
    for (let k = 0; k < 24; k++) { const v = day.perHour[k] / mx, bh = 3 + v * (shh - 5); sg.fillStyle = `rgba(159,212,124,${0.2 + v * 0.55})`; sg.beginPath(); sg.roundRect(k * bw + 1.5, shh - bh, bw - 3, bh, 2); sg.fill() }
  }
  // ------------------------------------------------------------------------------------------------ pointer
  const nodeAt = (px: number, py: number) => {
    let best = -1, bd = (13 * L.u) ** 2
    for (let i = 0; i < N; i++) { if (i === vaultIdx) continue; const d = (L.x[i] - px) ** 2 + (L.y[i] - py) ** 2; if (d < bd) { bd = d; best = i } }
    return best
  }
  const noteAt = (px: number, py: number) => {
    if ((px - L.cx) ** 2 + (py - L.cy) ** 2 > (L.R * 1.04) ** 2) return -1
    let best = -1, bd = (6.5 * L.u) ** 2
    for (let i = 0; i < vg.n; i++) { const d = (L.vx[i] - px) ** 2 + (L.vy[i] - py) ** 2; if (d < bd) { bd = d; best = i } }
    return best
  }
  const local = (e: PointerEvent) => { if (e.target === cv && Number.isFinite(e.offsetX)) return { x: e.offsetX, y: e.offsetY }; const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / Math.max(1, r.width)) * L.W, y: ((e.clientY - r.top) / Math.max(1, r.height)) * L.H } }
  function showCard(i: number) {
    const nd = day.nodes[i], k = day.kind[i], a = AREA[nd.id]
    const rd: string[] = [], wr: string[] = []
    for (const e of day.edges) { if (e.b === i) rd.push(shortName(e.a)); if (e.a === i) wr.push(shortName(e.b)) }
    const uniq = (l: string[]) => [...new Set(l)].slice(0, 7)
    const detail = nd.id === 'vault' ? `${vg.stats.notes} notes and ${vg.stats.links} linked pairs that every agent reads from and writes to` : clean(nd.detail)
    const pid = nd.project && nd.project !== 'second-brain' ? nd.project : null
    cardEl.innerHTML = `<span class="sb-card-k" style="--c:${KC[k]}"><i></i>${KNAME[k]}${a?.folder ? ` · ${esc(a.folder)}` : ''}</span>
      <h4>${esc(nodeTitle(i))}</h4><p class="sb-card-s">${esc(nd.schedule)}</p><p>${esc(detail)}</p>
      ${rd.length ? `<p class="sb-card-l"><b>Reads</b> ${uniq(rd).map(esc).join(', ')}</p>` : ''}${wr.length ? `<p class="sb-card-l"><b>Writes</b> ${uniq(wr).map(esc).join(', ')}</p>` : ''}
      ${pid ? `<button type="button" class="sb-open" data-p="${esc(pid)}">Open ${esc(projName(pid))}</button>` : ''}`
    cardEl.hidden = false; storyEl.hidden = true
  }
  function hideCard() { cardEl.hidden = true; storyEl.hidden = false }
  const nodeTitle = (i: number) => { const nd = day.nodes[i]; return AREA[nd.id]?.title ?? clean(nd.label) }
  const shortName = (i: number) => nodeTitle(i)
  function setFocus(i: number) { if (i === focus) return; focus = i; if (i >= 0) showCard(i); else if (pinned >= 0) showCard(pinned); else hideCard(); loop.wake() }
  cv.addEventListener('pointermove', e => {
    if (!L) return
    const p = local(e), n = nodeAt(p.x, p.y)
    cv.style.cursor = n >= 0 ? 'pointer' : 'default'
    if (n >= 0) { if (hoverNote >= 0) { hoverNote = -1; tipEl.hidden = true } setFocus(n); return }
    if (focus >= 0 && pinned < 0) setFocus(-1)
    const m = noteAt(p.x, p.y)
    if (m !== hoverNote) {
      hoverNote = m
      if (m < 0) tipEl.hidden = true
      else { tipEl.hidden = false; tipEl.textContent = `${vg.groups[vg.g[m]]} · ${vg.deg[m]} link${vg.deg[m] === 1 ? '' : 's'}` }
      loop.wake()
    }
    if (m >= 0) { tipEl.style.left = `${clamp(p.x, 60, L.W - 60)}px`; tipEl.style.top = `${Math.max(6, p.y - 30)}px` }
  })
  // leaving the canvas keeps the card for a beat, so the pointer can travel to its button; a click on a node pins it for good
  let leaveT = 0, overCard = false
  cv.addEventListener('pointerleave', () => { hoverNote = -1; tipEl.hidden = true; clearTimeout(leaveT); leaveT = window.setTimeout(() => { if (pinned < 0 && !overCard) setFocus(-1) }, 600); loop.wake() })
  cv.addEventListener('pointerenter', () => clearTimeout(leaveT))
  cardEl.addEventListener('pointerenter', () => { overCard = true; clearTimeout(leaveT) })
  cardEl.addEventListener('pointerleave', () => { overCard = false; clearTimeout(leaveT); leaveT = window.setTimeout(() => { if (pinned < 0) setFocus(-1) }, 300) })
  cv.addEventListener('click', e => { const p = local(e), n = nodeAt(p.x, p.y); pinned = n >= 0 && n !== pinned ? n : -1; if (pinned >= 0) { focus = pinned; showCard(pinned) } else { focus = -1; hideCard() } loop.wake() })
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && pinned >= 0) { pinned = -1; focus = -1; hideCard(); loop.wake() } }
  root.addEventListener('keydown', onKey)
  cardEl.addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('.sb-open'); const pid = b?.dataset.p; if (pid) (window as unknown as { __v3?: { openWork?(id: string): void } }).__v3?.openWork?.(pid) })
  root.querySelectorAll<HTMLButtonElement>('.sb-chip').forEach(b => {
    const gi = Number(b.dataset.g)
    b.addEventListener('pointerenter', () => { groupFocus = gi; loop.wake() })
    b.addEventListener('pointerleave', () => { groupFocus = groupLock; loop.wake() })
    b.addEventListener('focus', () => { groupFocus = gi; loop.wake() })
    b.addEventListener('blur', () => { groupFocus = groupLock; loop.wake() })
    b.addEventListener('click', () => { groupLock = groupLock === gi ? -1 : gi; groupFocus = groupLock < 0 ? gi : groupLock; b.setAttribute('aria-pressed', String(groupLock === gi)); root.querySelectorAll('.sb-chip').forEach(o => { if (o !== b) o.setAttribute('aria-pressed', 'false') }); loop.wake() })
  })

  // ------------------------------------------------------------------------------------------------ clock
  const setPlaying = (on: boolean) => {
    playing = on; playBtn.setAttribute('aria-pressed', String(on)); playBtn.setAttribute('aria-label', on ? 'Pause the day' : 'Play the day'); playBtn.classList.toggle('is-paused', !on)
    if (on) loop.wake()
  }
  playBtn.addEventListener('click', () => setPlaying(!playing))
  const fromRange = () => { h = Number(range.value) / 60; cueDrag('lab:drag', { param: 'clock', value: h / 24 }); loop.wake() }
  range.addEventListener('pointerdown', () => { scrubbing = true; resumeAfter = playing; setPlaying(false) })
  range.addEventListener('input', () => { fromRange(); prevH = h })
  const endScrub = () => { if (!scrubbing) return; scrubbing = false; if (resumeAfter) setPlaying(true) }
  range.addEventListener('pointerup', endScrub); range.addEventListener('pointercancel', endScrub); range.addEventListener('blur', endScrub)
  range.addEventListener('keydown', e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) { resumeAfter = playing || resumeAfter; setPlaying(false) } })

  // ------------------------------------------------------------------------------------------------ step
  function step(dt: number): boolean {
    if (playing && !scrubbing) { prevH = h; h = wrap24(h + (dt * 24) / DAY_SECONDS) }
    else prevH = h
    // a comet that lands on a vault area, while the day plays, is a sound
    if (playing && !scrubbing) {
      const lo = prevH <= h ? prevH : prevH - 24
      for (const a of day.arrivals) { const t = prevH <= h ? a.t : (a.t > prevH ? a.t - 24 : a.t); if (a.into && t > lo && t <= h) cuePulse('brain:pulse'); }
    }
    draw()
    // dom: clock, range, cursor, story
    const c = fmtClock(h)
    if (c !== lastClock) { lastClock = c; clockEl.textContent = c; range.value = String(Math.floor(wrap24(h) * 60)); range.setAttribute('aria-valuetext', c) }
    cursorEl.style.left = `${(wrap24(h) / 24) * 100}%`
    let si = -1, best = 99
    day.story.forEach((s, i) => { const d = wrap24(h - s); if (d < best) { best = d; si = i } })
    if (si !== lastStory) { lastStory = si; storyEl.textContent = (nervousRaw as unknown as DData).story[si] ?? ''; storyEl.classList.remove('is-in'); void storyEl.offsetWidth; storyEl.classList.add('is-in') }
    return playing && !scrubbing
  }

  // ------------------------------------------------------------------------------------------------ draw
  const lastBefore = (arr: Float32Array, t: number): number => {          // age of the latest fire at or before t (hours), wrapping the day; Infinity if none
    let best = Infinity
    for (let i = 0; i < arr.length; i++) { let d = t - arr[i]; if (d < 0) d += 24; if (d < best) best = d }
    return best
  }
  const rgba = (hex: string, a: number) => { const v = parseInt(hex.slice(1), 16); return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})` }
  const focusEdges = () => { const set = new Set<number>(), nb = new Set<number>(); if (focus >= 0) day.edges.forEach((e, k) => { if (e.a === focus || e.b === focus) { set.add(k); nb.add(e.a); nb.add(e.b) } }); return { set, nb } }

  function draw() {
    if (!L) return
    const { W, H, cx, cy, R, ring, u } = L
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H)
    const { set: fe, nb } = focusEdges()
    const dim = focus >= 0 ? 0.45 : 1
    // routes
    g.lineWidth = 1; g.lineCap = 'round'
    day.edges.forEach((e, k) => {
      const r = L.routes[k], hot = fe.has(k)
      g.strokeStyle = hot ? rgba(KC[day.kind[e.a]], 0.62) : `rgba(205,225,215,${0.11 * dim + 0.015})`
      g.lineWidth = hot ? 1.5 : 0.9
      g.beginPath(); g.moveTo(r.pts[0], r.pts[1]); for (let s = 1; s < r.pts.length / 2; s++) g.lineTo(r.pts[s * 2], r.pts[s * 2 + 1]); g.stroke()
    })
    // the vault: a disc of notes with a dial round it
    const bg = g.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.12); bg.addColorStop(0, 'rgba(34,64,52,.72)'); bg.addColorStop(0.75, 'rgba(14,30,26,.78)'); bg.addColorStop(1, 'rgba(8,16,14,.5)')
    g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, R * 1.06, 0, TAU); g.fill()
    if (baseLinks) g.drawImage(baseLinks, 0, 0, W, H)
    // heat from the landings of the last two hours
    heat.fill(0)
    const wnd = 2.4
    for (let k = 0; k < day.arrivals.length; k++) {
      const a = day.arrivals[k]; let age = h - a.t; if (age < 0) age += 24
      if (age > wnd) continue
      const wv = waves[k], amp = a.into ? 1 : 0.55
      for (let q = 0; q < wv.nodes.length; q++) {
        const ak = age - wv.hops[q] * 0.1; if (ak < 0) continue
        const v = amp * (1 - 0.17 * wv.hops[q]) * (1 - ak / (wnd - 0.3)); if (v > heat[wv.nodes[q]]) heat[wv.nodes[q]] = v
      }
    }
    // lit links, then notes
    g.lineWidth = 0.9
    for (let i = 0; i < vg.links.length; i += 2) {
      const a = vg.links[i], b = vg.links[i + 1], v = Math.min(heat[a], heat[b])
      if (v > 0.04) { g.strokeStyle = rgba(GROUP_COLOR[vg.g[a]], Math.min(0.85, v * 0.9)); g.beginPath(); g.moveTo(L.vx[a], L.vy[a]); g.lineTo(L.vx[b], L.vy[b]); g.stroke() }
    }
    const gf = groupFocus
    for (let i = 0; i < vg.n; i++) {
      const hv = heat[i], gi = vg.g[i], on = gf < 0 || gf === gi
      const r0 = (0.9 + Math.min(2.4, vg.deg[i] * 0.07)) * u, rr = r0 * (1 + hv * 1.3 + (i === hoverNote ? 0.8 : 0) + (gf === gi ? 0.25 : 0))
      const al = on ? clamp(0.5 + hv * 0.5 + (gf === gi ? 0.25 : 0), 0, 1) : 0.1
      g.fillStyle = rgba(GROUP_COLOR[gi], al); g.beginPath(); g.arc(L.vx[i], L.vy[i], rr, 0, TAU); g.fill()
      if (hv > 0.35) { g.fillStyle = rgba(GROUP_COLOR[gi], (hv - 0.35) * 0.35); g.beginPath(); g.arc(L.vx[i], L.vy[i], rr * 3, 0, TAU); g.fill() }
    }
    // the dial: 24 ticks, a sweep that trails the hand, and the hand
    g.strokeStyle = 'rgba(190,225,205,.2)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, ring, 0, TAU); g.stroke()
    for (let t = 0; t < 24; t++) {
      const a = (t / 24) * TAU - Math.PI / 2, major = t % 6 === 0, r1 = ring + 3, r2 = ring + (major ? 10 : 6)
      g.strokeStyle = major ? 'rgba(220,240,228,.55)' : 'rgba(190,225,205,.28)'; g.lineWidth = major ? 1.4 : 1
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke()
    }
    const ha = (wrap24(h) / 24) * TAU - Math.PI / 2
    for (let s = 0; s < 20; s++) { const a0 = ha - ((s + 1) / 20) * 0.9, a1 = ha - (s / 20) * 0.9; g.strokeStyle = rgba('#9fd47c', (1 - s / 20) * 0.5); g.lineWidth = 2.2; g.beginPath(); g.arc(cx, cy, ring, a0, a1); g.stroke() }
    const hx = cx + Math.cos(ha) * ring, hy = cy + Math.sin(ha) * ring
    g.drawImage(sprites[2], hx - 11, hy - 11, 22, 22); g.fillStyle = '#e9ffd8'; g.beginPath(); g.arc(hx, hy, 2.4, 0, TAU); g.fill()
    // shimmer on the always-on edges
    g.save(); g.setLineDash([2, 9]); g.lineDashOffset = -wrap24(h) * 22; g.lineWidth = 1.1
    for (const k of day.shimmer) { const r = L.routes[k]; g.strokeStyle = rgba(KC[day.kind[day.edges[k].a]], fe.size && !fe.has(k) ? 0.12 : 0.42); g.beginPath(); g.moveTo(r.pts[0], r.pts[1]); for (let s = 1; s < r.pts.length / 2; s++) g.lineTo(r.pts[s * 2], r.pts[s * 2 + 1]); g.stroke() }
    g.restore()
    // comets
    g.globalCompositeOperation = 'lighter'
    for (const p of day.pulses) {
      if (h < p.t0 || h >= p.t1) continue
      const e = day.edges[p.e], r = L.routes[p.e], s = (h - p.t0) / (p.t1 - p.t0), kk = day.kind[e.a], faded = fe.size && !fe.has(p.e) ? 0.35 : 1
      const tail = 0.2, N2 = 6
      let [px, py] = at(r, s)
      for (let q = 1; q <= N2; q++) {
        const [qx, qy] = at(r, s - (q / N2) * tail)
        g.strokeStyle = rgba(KC[kk], (1 - q / (N2 + 1)) * 0.85 * faded); g.lineWidth = (2.6 - q * 0.28) * Math.min(1.3, u)
        g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.stroke(); px = qx; py = qy
      }
      const [hx2, hy2] = at(r, s); g.globalAlpha = faded; g.drawImage(sprites[kk], hx2 - 9 * u, hy2 - 9 * u, 18 * u, 18 * u); g.globalAlpha = 1
    }
    g.globalCompositeOperation = 'source-over'
    // nodes
    const font = `500 ${Math.round(11 * Math.min(1.15, u))}px ${MONO()}`
    g.font = font; g.textBaseline = 'middle'
    const labels: [number, number, string, number, number, number][] = []
    for (let i = 0; i < N; i++) {
      if (i === vaultIdx) continue
      const k = day.kind[i], x = L.x[i], y = L.y[i], age = lastBefore(day.lights[i], wrap24(h))
      const r0 = (k === 1 ? 4.4 : 3.7) * u, dimN = focus >= 0 && !nb.has(i) ? 0.4 : 1
      const f = age < 1.6 ? (1 - age / 1.6) ** 2 : 0, breath = day.breath[i] ? 0.5 + 0.5 * Math.sin(wrap24(h) * 7 + i) : 0
      if (f > 0.01 || breath) { g.strokeStyle = rgba(KC[k], (f * 0.8 + breath * 0.25) * dimN); g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, r0 + 3 + (1 - f) * 11 * (f > 0 ? 1 : 0) + breath * 2, 0, TAU); g.stroke() }
      g.fillStyle = rgba(KC[k], (0.62 + f * 0.38) * dimN); g.beginPath(); g.arc(x, y, r0 + f * 1.6, 0, TAU); g.fill()
      if (k === 2) { g.strokeStyle = rgba(KC[k], 0.9 * dimN); g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r0 + 2.2, 0, TAU); g.stroke() }
      const fired = age < 1.5 && age > 0.05 && focus < 0
      const isFocus = i === focus || (nb.has(i) && focus >= 0)
      const statik = !L.tall && W >= 620 && (k === 0 || k === 3) && focus < 0
      if (isFocus || fired || statik) labels.push([x, y, nodeTitle(i), isFocus ? (i === focus ? 1 : 0.85) : fired ? Math.min(1, age / 0.2, (1.5 - age) / 0.5) : 0.5, k, isFocus ? (i === focus ? 3 : 2) : fired ? 1 : 0])
    }
    // labels last, on a soft plate so they read over the routes; a label that would sit on a placed one is skipped (focus first, then what just fired, then the quiet ones)
    labels.sort((a, b) => b[5] - a[5])
    const placed: number[][] = []
    for (const [x, y, t, al, k] of labels) {
      const w = g.measureText(t).width, right = x < cx
      const lx = right ? x + 9 * u : x - 9 * u - w
      const px2 = clamp(lx, 4, W - w - 4), x0 = px2 - 4, x1 = px2 + w + 4, y0 = y - 8, y1 = y + 8
      if (placed.some(r => x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1])) continue
      placed.push([x0, y0, x1, y1])
      g.globalAlpha = al; g.fillStyle = 'rgba(6,14,12,.78)'; g.beginPath(); g.roundRect(x0, y0, w + 8, 16, 5); g.fill()
      g.fillStyle = k === 1 ? '#ffe3c8' : '#e8f4ee'; g.textAlign = 'left'; g.fillText(t, px2, y + 0.5); g.globalAlpha = 1
    }
    g.textAlign = 'center'; g.fillStyle = 'rgba(220,240,228,.62)'; g.font = `500 ${Math.round(10 * Math.min(1.15, u))}px ${MONO()}`
    for (const t of [0, 6, 12, 18]) { const a = (t / 24) * TAU - Math.PI / 2; g.fillText(String(t).padStart(2, '0'), cx + Math.cos(a) * (ring + 21), cy + Math.sin(a) * (ring + 21)) }
  }

  // ------------------------------------------------------------------------------------------------ boot
  const loop = frameLoop(host, step)
  const fitHandle = fitCanvas(cv, (w, hh, d) => {
    dpr = d
    L = relax(w, hh, w < 580)
    buildLayers(); draw(); loop.wake()
  })
  const ro = new ResizeObserver(() => { if (L) buildLayers(); draw(); loop.wake() })
  ro.observe(strip)
  setPlaying(false)
  lastClock = ''
  if (!reduced && !sitePaused()) onFirstView(host, () => { if (!scrubbing) setPlaying(true) }, 0.4)
  playBtn.classList.toggle('is-paused', true)
  draw(); step(0); loop.wake()

  return {
    dispose() {
      loop.dispose(); fitHandle.dispose(); ro.disconnect(); clearTimeout(leaveT)
      root.removeEventListener('keydown', onKey)
      host.innerHTML = ''
    },
  }
}
