// Carta lab: a linked-note corpus drawn as a portolan chart. Each territory is an arc of coast sized by how many notes it holds and washed by how
// long since it last changed (bright gold is fresh, cool grey is stale); straight rhumb lines across the sea count the links that cross from one
// territory into another; the most-linked notes are named ports. Pick a territory or a port (on the chart or in the gazetteer beside it) and its
// lines light up. "Redraw" steps through four sample Sundays and the chart re-forms.
// Honesty: this is a SAMPLE corpus of eight generic territories and five generic ports, invented for the page. It is not my vault and carries no
// note titles. Ages are stated as a minimum, because the real tool reads them from git history. The real chart's own figures live in the case
// header; nothing here claims them. Everything is under data-proof="skip".
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: lab:arb (a territory or port is picked), lab:drag (a redraw), count:tick (a Sunday).
import './carta.css'
import { animate } from 'animejs'
import { clamp, gate, onFirstView, type LabHandle, type LabOpts } from './lib/kit'

const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
// per Sunday (0..3): notes in each territory, and days since the last change (a floor)
const NOTES = [[118, 84, 62, 50, 38, 27, 19, 14], [121, 88, 63, 52, 41, 27, 19, 15], [124, 90, 66, 52, 44, 28, 20, 15], [126, 95, 66, 55, 47, 28, 20, 17]]
const AGE = [[18, 44, 92, 160, 28, 240, 410, 75], [25, 51, 99, 167, 7, 247, 417, 82], [4, 58, 106, 174, 14, 254, 424, 89], [11, 65, 113, 3, 21, 261, 431, 96]]
// links crossing a border: [territory, territory, count]; the counts grow a little each Sunday
const LANES: [number, number, number][] = [[0, 1, 34], [0, 2, 22], [0, 4, 18], [0, 3, 9], [1, 2, 16], [1, 3, 12], [1, 5, 7], [2, 4, 10], [2, 6, 5], [3, 5, 8], [4, 7, 6], [0, 7, 11], [5, 6, 4], [1, 4, 13]]
const LANE_GROW = [0, 1, 2, 3].map(w => LANES.map((l, k) => l[2] + Math.round(w * (0.6 + (k % 3) * 0.5))))
// ports: the most-linked notes. [territory, where along its arc 0..1, links]
const PORTS: [number, number, number][] = [[0, 0.3, 31], [1, 0.62, 22], [0, 0.78, 18], [2, 0.4, 14], [4, 0.5, 11]]
const TOTAL_PORTS = PORTS.length
const SUNDAYS = ['Sunday 1', 'Sunday 2', 'Sunday 3', 'Sunday 4']

const C = 300, R0 = 212, R1 = 250, RL = 203, RT = 272
const GAP = 3
const pt = (r: number, deg: number): [number, number] => { const a = (deg * Math.PI) / 180; return [C + r * Math.sin(a), C - r * Math.cos(a)] }
const f = (n: number) => n.toFixed(1)
function sector(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0), big = a1 - a0 > 180 ? 1 : 0
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${big} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 ${big} 0 ${f(x3)} ${f(y3)}Z`
}
const FRESH = [243, 201, 112], STALE = [92, 100, 114]
const wash = (age: number) => { const t = clamp(age / 420, 0, 1), e = Math.sqrt(t); return `rgb(${FRESH.map((v, i) => Math.round(v + (STALE[i] - v) * e)).join(',')})` }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const NS = 'http://www.w3.org/2000/svg'

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cue = gate(opts.emit, 70)
  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'ct' + (reduced ? ' is-reduced' : '')
  root.setAttribute('data-proof', 'skip')
  root.innerHTML = `
  <header class="ct-head">
    <div><span class="ct-kicker">Interactive model <span class="ct-sim">Sample corpus</span></span><h3 class="ct-title">Read a knowledge base as a sea chart</h3></div>
    <p class="ct-note" role="note">Eight invented territories and five invented ports, not my vault. Pick a territory or a port and the lines that cross its border light up. Redraw steps through four sample Sundays.</p>
  </header>
  <div class="ct-cols">
    <div class="ct-left"><figure class="ct-fig">
      <svg class="ct-svg" viewBox="0 0 600 600" role="img" aria-label="A portolan chart of eight sample territories with rhumb lines between them and five named ports. The gazetteer beside it lists the same data."></svg>
      <figcaption class="ct-key" aria-hidden="true"><span>Fresh</span><i></i><span>Stale: 400+ days</span><em>Arc length: notes · Line weight: links crossing</em></figcaption>
    </figure>
      <section class="ct-read" aria-live="polite"><p class="ct-readout"></p></section></div>
    <div class="ct-side">
      <section class="ct-gaz" aria-label="Gazetteer">
        <div class="ct-gh"><span class="ct-lab">Gazetteer</span><button type="button" class="ct-redraw" aria-label="Redraw the chart for the next sample Sunday"><span class="ct-sun"></span><b>Redraw</b></button></div>
        <ul class="ct-terrs"></ul>
        <span class="ct-lab ct-lab--p">Named ports, most linked first</span>
        <ul class="ct-ports"></ul>
      </section>
    </div>
  </div>
  <p class="ct-foot">Ages are floors: the real tool reads each note's age from version-control history, so a figure means "at least this many days". Links come from the resolved link graph, not from searching text for brackets. Names and counts on this page are made up to show the reading.</p>`
  host.append(root)
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T
  const svg = $<SVGSVGElement>('.ct-svg'), readout = $('.ct-readout'), terrsEl = $('.ct-terrs'), portsEl = $('.ct-ports'), redraw = $<HTMLButtonElement>('.ct-redraw'), sunEl = $('.ct-sun')

  // ------------------------------------------------------------------------------------------------ the chart's static layers
  const mk = <K extends keyof SVGElementTagNameMap>(tag: K, cls: string, parent: Element = svg) => { const e = document.createElementNS(NS, tag); e.setAttribute('class', cls); parent.append(e); return e }
  const defs = document.createElementNS(NS, 'defs'); svg.append(defs)
  defs.innerHTML = `<radialGradient id="ctsea" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#1b2a30"/><stop offset="0.7" stop-color="#10181c"/><stop offset="1" stop-color="#0b1013"/></radialGradient>`
  mk('circle', 'ct-sea').setAttribute('r', '291')
  svg.querySelector('.ct-sea')!.setAttribute('cx', String(C)); svg.querySelector('.ct-sea')!.setAttribute('cy', String(C))
  const web = mk('g', 'ct-web')
  for (let k = 0; k < 32; k++) { const [x, y] = pt(RL, k * 11.25), l = mk('line', k % 2 ? 'ct-rb ct-rb--f' : 'ct-rb', web); l.setAttribute('x1', String(C)); l.setAttribute('y1', String(C)); l.setAttribute('x2', f(x)); l.setAttribute('y2', f(y)) }
  const ringLine = mk('circle', 'ct-ring'); ringLine.setAttribute('cx', String(C)); ringLine.setAttribute('cy', String(C)); ringLine.setAttribute('r', String(RL + 2))
  const lanesG = mk('g', 'ct-lanes'), arcsG = mk('g', 'ct-arcs'), portsG = mk('g', 'ct-ptsg'), labG = mk('g', 'ct-labs')
  // the compass rose: eight points with the north point drawn long and labelled
  const rose = mk('g', 'ct-rose')
  rose.innerHTML = [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const long = a % 90 === 0, r = long ? 40 : 24, [x, y] = pt(r, a), [lx, ly] = pt(6, a - 90), [rx, ry] = pt(6, a + 90); return `<path d="M${f(lx)} ${f(ly)}L${f(x)} ${f(y)}L${f(rx)} ${f(ry)}Z" class="${a === 0 ? 'ct-rn' : ''}"/>` }).join('') + `<circle cx="${C}" cy="${C}" r="5"/>`
  const north = mk('text', 'ct-north'); north.textContent = 'N'

  const arcEls = NAMES.map((n, k) => { const g = mk('g', 'ct-arc', arcsG); g.dataset.k = String(k); const p = mk('path', 'ct-band', g); return { g, p } })
  const labEls = NAMES.map(n => { const t = mk('text', 'ct-tl', labG); t.textContent = n; return t })
  const laneEls = LANES.map(() => mk('line', 'ct-lane', lanesG))
  const portEls = PORTS.map((p, i) => { const g = mk('g', 'ct-pt', portsG); g.dataset.p = String(i); const c = mk('circle', 'ct-pc', g); const t = mk('text', 'ct-pn', g); t.textContent = String(i + 1); return { g, c, t } })

  // ------------------------------------------------------------------------------------------------ state: the numbers being drawn (blended between Sundays)
  const live = { notes: NOTES[0].slice(), age: AGE[0].slice(), lane: LANE_GROW[0].slice(), grow: reduced ? 1 : 0 }
  let week = 0, sel = -1, selPort = -1, u = 1, anim: { cancel(): unknown } | null = null, growAnim: { cancel(): unknown } | null = null
  const spans: [number, number][] = NAMES.map(() => [0, 0])

  function layout() {
    // arcs close the circle: each gets a share of what is left after the gaps (never under 14 degrees); while the coast is being drawn in, each sweeps out from its own start
    const room = 360 - GAP * NAMES.length, total = live.notes.reduce((x, y) => x + y, 0)
    const raw = live.notes.map(n => Math.max(14, (n / total) * room)), k = room / raw.reduce((x, y) => x + y, 0)
    let a = GAP / 2
    raw.forEach((w, i) => { spans[i] = [a, a + w * k * live.grow]; a += w * k + GAP })
  }
  const mid = (k: number) => (spans[k][0] + spans[k][1]) / 2

  function paint() {
    layout()
    u = 600 / Math.max(240, svg.clientWidth || 600)
    svg.style.setProperty('--u', String(u))
    // arcs
    NAMES.forEach((n, k) => {
      const [a0, a1] = spans[k]
      arcEls[k].p.setAttribute('d', a1 - a0 > 0.5 ? sector(R0, R1, a0, a1) : '')
      arcEls[k].p.style.fill = wash(live.age[k])
      const [lx, ly] = pt(RT, mid(k)); labEls[k].setAttribute('x', f(lx)); labEls[k].setAttribute('y', f(ly)); labEls[k].style.opacity = String(clamp((live.grow - 0.6) / 0.4, 0, 1))
    })
    // lanes: each territory spreads its lines along the inner side of its arc so they do not all meet at one point
    const slots: Record<number, number[]> = {}
    LANES.forEach((l, i) => { (slots[l[0]] ||= []).push(i); (slots[l[1]] ||= []).push(i) })
    const end = (k: number, i: number) => { const list = slots[k], j = list.indexOf(i), [a0, a1] = spans[k], w = (a1 - a0) * 0.7; return pt(RL, mid(k) + (list.length > 1 ? (j / (list.length - 1) - 0.5) * w : 0)) }
    const wmax = Math.max(...live.lane)
    LANES.forEach((l, i) => {
      const [x1, y1] = end(l[0], i), [x2, y2] = end(l[1], i), e = laneEls[i]
      e.setAttribute('x1', f(x1)); e.setAttribute('y1', f(y1)); e.setAttribute('x2', f(x2)); e.setAttribute('y2', f(y2))
      e.style.strokeWidth = String((0.8 + (live.lane[i] / wmax) * 3.6) * u * 0.72)
      const on = sel >= 0 && (l[0] === sel || l[1] === sel)
      e.classList.toggle('is-on', on); e.classList.toggle('is-dim', sel >= 0 && !on)
      e.style.opacity = String(live.grow)
    })
    // ports sit on the band
    PORTS.forEach((p, i) => {
      const [a0, a1] = spans[p[0]], [x, y] = pt((R0 + R1) / 2, lerp(a0, a1, p[1])), els = portEls[i]
      els.c.setAttribute('cx', f(x)); els.c.setAttribute('cy', f(y)); els.c.setAttribute('r', f(9.5 * u * 0.78))
      els.t.setAttribute('x', f(x)); els.t.setAttribute('y', f(y))
      els.g.style.opacity = String(clamp((live.grow - 0.7) / 0.3, 0, 1))
      els.g.classList.toggle('is-on', selPort === i)
    })
    north.setAttribute('x', String(C)); north.setAttribute('y', String(C - 50 * u * 0.7))
    arcEls.forEach((a, k) => { a.g.classList.toggle('is-on', k === sel); a.g.classList.toggle('is-dim', sel >= 0 && k !== sel && !LANES.some(l => (l[0] === sel && l[1] === k) || (l[1] === sel && l[0] === k))) })
  }

  // ------------------------------------------------------------------------------------------------ the gazetteer
  const ageTxt = (d: number) => (d < 1 ? 'today' : d < 14 ? `${Math.round(d)} d` : `${Math.round(d)}+ d`)
  function gaz() {
    terrsEl.innerHTML = NAMES.map((n, k) => `<li><button type="button" class="ct-terr" data-k="${k}" aria-pressed="${k === sel}"><i class="ct-sw" style="background:${wash(live.age[k])}"></i><b>Territory ${n}</b><span class="ct-n">${Math.round(live.notes[k])} notes</span><span class="ct-a">${ageTxt(live.age[k])}</span></button></li>`).join('')
    portsEl.innerHTML = PORTS.map((p, i) => ({ p, i })).sort((a, b) => b.p[2] - a.p[2]).map(({ p, i }) => `<li><button type="button" class="ct-port" data-k="${i}" aria-pressed="${i === selPort}"><i class="ct-pn2">${i + 1}</i><b>Port ${i + 1}</b><span class="ct-n">${p[2]} links</span><span class="ct-a">in ${NAMES[p[0]]}</span></button></li>`).join('')
  }
  function read() {
    if (selPort >= 0) {
      const p = PORTS[selPort]
      readout.innerHTML = `<b class="ct-r1">Port ${selPort + 1}</b> is the most-linked note in Territory ${NAMES[p[0]]}, with ${p[2]} links. Ports are where traffic concentrates: a note that many others point to.`
    } else if (sel >= 0) {
      let out = 0, top = -1, topW = 0
      LANES.forEach((l, i) => { if (l[0] === sel || l[1] === sel) { out += live.lane[i]; if (live.lane[i] > topW) { topW = live.lane[i]; top = l[0] === sel ? l[1] : l[0] } } })
      readout.innerHTML = `<b class="ct-r1">Territory ${NAMES[sel]}</b> holds ${Math.round(live.notes[sel])} notes, last changed at least ${Math.round(live.age[sel])} days ago. ${out} links cross its border${top >= 0 ? `, most of them to Territory ${NAMES[top]}` : ''}.`
    } else readout.innerHTML = `<b class="ct-r1">How to read it.</b> Longer arcs hold more notes. Bright gold changed recently; grey has sat untouched. A heavier line means more links crossing between two territories. Numbered ports are the most-linked notes.`
  }
  function select(k: number, port = -1) {
    sel = port >= 0 ? PORTS[port][0] : k === sel ? -1 : k
    selPort = port >= 0 ? (port === selPort ? -1 : port) : -1
    if (port >= 0 && selPort < 0) sel = -1
    cue('lab:arb', { on: sel >= 0 })
    gaz(); read(); paint()
  }

  // ------------------------------------------------------------------------------------------------ events
  const onClick = (e: Event) => {
    const t = e.target as Element
    const tb = t.closest<HTMLElement>('.ct-terr'); if (tb) { select(Number(tb.dataset.k)); return }
    const pb = t.closest<HTMLElement>('.ct-port'); if (pb) { select(-1, Number(pb.dataset.k)); return }
    const pg = t.closest<SVGGElement>('.ct-pt'); if (pg) { select(-1, Number(pg.dataset.p)); return }
    const ag = t.closest<SVGGElement>('.ct-arc'); if (ag) { select(Number(ag.dataset.k)); return }
    if (t.closest('.ct-redraw')) nextSunday()
  }
  let hover = -1
  const onOver = (e: Event) => {
    const ag = (e.target as Element).closest<SVGGElement>('.ct-arc'), k = ag ? Number(ag.dataset.k) : -1
    if (k === hover || sel >= 0) return
    hover = k; const keep = sel; sel = k; paint(); sel = keep
  }
  root.addEventListener('click', onClick); svg.addEventListener('pointerover', onOver); svg.addEventListener('pointerleave', () => { if (hover >= 0) { hover = -1; paint() } })

  function nextSunday() {
    const from = { notes: live.notes.slice(), age: live.age.slice(), lane: live.lane.slice() }
    week = (week + 1) % 4
    sunEl.textContent = SUNDAYS[week]
    cue('lab:drag', { param: 'sunday', value: week / 3 }); cue('count:tick')
    const toN = NOTES[week], toA = AGE[week], toL = LANE_GROW[week]
    anim?.cancel()
    if (reduced) { live.notes = toN.slice(); live.age = toA.slice(); live.lane = toL.slice(); gaz(); read(); paint(); return }
    const t = { v: 0 }
    anim = animate(t, { v: 1, duration: 1100, ease: 'inOut(3)', onUpdate: () => {
      live.notes = from.notes.map((x, i) => lerp(x, toN[i], t.v)); live.age = from.age.map((x, i) => lerp(x, toA[i], t.v)); live.lane = from.lane.map((x, i) => lerp(x, toL[i], t.v)); paint()
    }, onComplete: () => { gaz(); read() } }) as { cancel(): unknown }
  }
  sunEl.textContent = SUNDAYS[0]

  const ro = new ResizeObserver(() => paint()); ro.observe(svg)
  gaz(); read(); paint()
  // first sight: the coast is drawn in, arcs sweeping out from the north point, then the lines across the sea
  const cancelView = reduced ? () => {} : onFirstView(host, () => {
    const t = { v: 0 }
    growAnim = animate(t, { v: 1, duration: 1500, ease: 'out(3)', onUpdate: () => { live.grow = t.v; paint() }, onComplete: () => { live.grow = 1; paint() } }) as { cancel(): unknown }
  }, 0.25)
  void TOTAL_PORTS

  return {
    dispose() {
      cancelView(); anim?.cancel(); growAnim?.cancel(); ro.disconnect()
      root.removeEventListener('click', onClick); svg.removeEventListener('pointerover', onOver)
      host.innerHTML = ''
    },
  }
}
