// Cloudflare lab: "What the price already assumes". A reverse DCF runs a valuation backwards: it starts from the share price and asks what growth
// the market already expects. The deck solved it at a 10.8% cost of capital and a 30x free-cash-flow exit: $191.58 implied 44% revenue growth a
// year for 5 years, or 20% a year for 10. The dial lets a visitor try their own growth rate; the strip beside it shows where the four weighted
// scenarios landed. Only numbers from src/data/projects.json appear as facts. The dial's own readouts are the visitor's setting, plain arithmetic
// on the dial (compound growth), and sit under the label "your setting". Base and Bull prices are not in the data, so they are not drawn.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: lab:drag while the dial turns, hub:detent when it seats on a notch.
import './lib/model-base.css'
import './cloudflare.css'
import { animate } from 'animejs'
import { clamp, esc, gate, type LabHandle, type LabOpts } from './lib/kit'

// ---- the deck's numbers (src/data/projects.json, id "cloudflare")
const PRICE = 191.58, TARGET = 242.53, BEAR = 70.28, SUPER = 535.89, GRID_LO = 147.45, GRID_HI = 301.44
const WACC = '10.8%', EXIT = '30x', UPSIDE = '26.6%'
const NOTCH: Record<number, number> = { 5: 44, 10: 20 }          // implied revenue growth a year, by horizon in years
const WEIGHTS: [string, number][] = [['Bear', 10], ['Base', 50], ['Bull', 30], ['Super-Bull', 10]]
const G_MAX = 60, SWEEP = 240, R = 104, CX = 150, CY = 142
const usd = (v: number) => '$' + v.toFixed(2)

const ang = (g: number) => -SWEEP / 2 + (clamp(g, 0, G_MAX) / G_MAX) * SWEEP
const pt = (deg: number, r = R) => { const a = (deg * Math.PI) / 180; return [CX + r * Math.sin(a), CY - r * Math.cos(a)] as const }
function arcPath(g0: number, g1: number, r = R) {
  const [x0, y0] = pt(ang(g0), r), [x1, y1] = pt(ang(g1), r), large = ang(g1) - ang(g0) > 180 ? 1 : 0
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced, cue = gate(opts.emit, 80)
  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'ml cf' + (reduced ? ' is-reduced' : '')
  root.setAttribute('data-proof', 'skip')

  const notchMarks = ([5, 10] as const).map(y => {
    const g = NOTCH[y], deg = ang(g), [x, yy] = pt(deg, R + 24), [x1, y1] = pt(deg, R - 14), [x2, y2] = pt(deg, R + 9)
    const anchor = deg > 12 ? 'start' : deg < -12 ? 'end' : 'middle'
    return `<g class="cf-notch" data-y="${y}"><line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/><text x="${x.toFixed(1)}" y="${(yy + 4).toFixed(1)}" text-anchor="${anchor}">${g}% for ${y} yrs</text></g>`
  }).join('')
  const ticks = [0, 10, 20, 30, 40, 50, 60].map(g => { const [x1, y1] = pt(ang(g), R + 5), [x2, y2] = pt(ang(g), R + 11); return `<line class="cf-tick" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>` }).join('')

  root.innerHTML = `
  <header class="ml-head">
    <div><span class="ml-kicker">Interactive model <span class="ml-sim" style="margin-left:8px">Reverse DCF</span></span><h3 class="ml-title">What the price already assumes</h3></div>
    <p class="ml-note" role="note">A reverse DCF starts from the price and solves for the growth the market already expects. Turn the dial to try a growth rate, then read where the deck's four scenarios landed.</p>
  </header>
  <div class="ml-cols cf-cols">
    <section class="ml-p cf-dial" aria-label="Implied revenue growth dial">
      <span class="ml-lab">Implied revenue growth, a year</span>
      <div class="ml-row cf-hz" role="group" aria-label="Years of growth"><button class="ml-chip" type="button" data-y="5" aria-pressed="true">5 years</button><button class="ml-chip" type="button" data-y="10" aria-pressed="false">10 years</button></div>
      <div class="cf-gauge">
        <svg viewBox="-30 0 380 196" class="cf-svg" role="presentation">
          <path class="cf-track" d="${arcPath(0, G_MAX)}"/>
          <path class="cf-fill" d="${arcPath(0, G_MAX)}" pathLength="100"/>
          ${ticks}${notchMarks}
          <g class="cf-knob" tabindex="0" role="slider" aria-label="Implied revenue growth a year" aria-valuemin="0" aria-valuemax="${G_MAX}" aria-valuenow="44">
            <circle class="cf-hit" r="30"/><circle class="cf-halo" r="15"/><circle class="cf-dot" r="9"/>
          </g>
          <text class="cf-gv" x="${CX}" y="${CY - 8}" text-anchor="middle"></text>
          <text class="cf-gl" x="${CX}" y="${CY + 14}" text-anchor="middle">a year</text>
        </svg>
      </div>
      <div class="ml-row cf-snaps"><button class="ml-btn" type="button" data-snap="5">Deck: 44% for 5 years</button><button class="ml-btn" type="button" data-snap="10">Deck: 20% for 10 years</button></div>
      <div class="cf-set" aria-live="polite">
        <span class="ml-lab">Your setting <em>arithmetic on the dial, not a deck figure</em></span>
        <p class="cf-line"></p>
        <p class="cf-verdict ml-small"></p>
      </div>
      <figure class="cf-path"><svg class="cf-path-svg" viewBox="0 0 320 120" role="img" aria-label="Revenue multiple by year: your setting against the deck's solved growth"></svg>
        <figcaption class="ml-small cf-pathcap"></figcaption></figure>
      <ul class="cf-facts" aria-label="Fixed inputs from the deck">
        <li><span class="ml-lab">Cost of capital</span><b>${WACC}</b></li><li><span class="ml-lab">Exit multiple</span><b>${EXIT} free cash flow</b></li><li><span class="ml-lab">Price at pitch</span><b>${usd(PRICE)}</b></li>
      </ul>
    </section>
    <section class="ml-p cf-scn" aria-label="Scenario prices">
      <span class="ml-lab">Four weighted scenarios against ${usd(PRICE)}</span>
      <div class="cf-strip" role="group" aria-label="Scenario price strip"></div>
      <p class="cf-bandnote"><i></i>Shaded band: ${usd(GRID_LO)} to ${usd(GRID_HI)}, the deck's cost-of-capital by exit-multiple grid</p>
      <div class="cf-upside"><b class="cf-upv">${UPSIDE}</b><span class="ml-small">probability-weighted upside: ${usd(TARGET)} target against the ${usd(PRICE)} price</span></div>
      <span class="ml-lab" style="margin-top:16px">How the four were weighted</span>
      <div class="cf-w" role="list"></div><ul class="cf-wkey"></ul>
      <p class="ml-small cf-wn">Base and Bull are in the deck; their prices are not repeated here. Bear and Super-Bull are the two ends of the range.</p>
    </section>
  </div>`
  host.appendChild(root)
  const $ = <T extends Element>(s: string) => root.querySelector(s) as T
  const knob = $<SVGGElement>('.cf-knob'), fill = $<SVGPathElement>('.cf-fill'), svg = $<SVGSVGElement>('.cf-svg')
  const gv = $<SVGTextElement>('.cf-gv'), line = $<HTMLElement>('.cf-line'), verdict = $<HTMLElement>('.cf-verdict')
  const pathSvg = $<SVGSVGElement>('.cf-path-svg'), pathCap = $<HTMLElement>('.cf-pathcap'), hz = [...root.querySelectorAll<HTMLButtonElement>('.cf-hz .ml-chip')]
  const notches = [...root.querySelectorAll<SVGGElement>('.cf-notch')]

  // ---- scenario strip: price axis from $0 to $560, four marks, the sensitivity band behind them
  const AX = 560, pos = (v: number) => (v / AX) * 100
  const strip = $<HTMLElement>('.cf-strip')
  const marks: { k: string; v: number; cls: string; name: string; side: 'up' | 'dn' }[] = [
    { k: 'bear', v: BEAR, cls: 'is-bear', name: 'Bear', side: 'up' }, { k: 'price', v: PRICE, cls: 'is-price', name: 'Price at pitch', side: 'dn' },
    { k: 'target', v: TARGET, cls: 'is-target', name: 'Weighted target', side: 'up' }, { k: 'super', v: SUPER, cls: 'is-super', name: 'Super-Bull', side: 'dn' },
  ]
  strip.innerHTML = `
    <div class="cf-axis"><i class="cf-band" style="left:${pos(GRID_LO)}%;width:${pos(GRID_HI) - pos(GRID_LO)}%"></i><i class="cf-gain" style="left:${pos(PRICE)}%;width:${pos(TARGET) - pos(PRICE)}%"></i>
      ${[0, 100, 200, 300, 400, 500].map(t => `<span class="cf-t" style="left:${pos(t)}%">${t === 0 ? '$0' : '$' + t}</span>`).join('')}</div>
    ${marks.map(m => `<button type="button" class="cf-mk ${m.cls} is-${m.side}" data-k="${m.k}" style="left:${pos(m.v)}%" aria-label="${esc(m.name)} ${usd(m.v)}"><i></i><span><em>${esc(m.name)}</em><b>${usd(m.v)}</b></span></button>`).join('')}`
  const wEl = $<HTMLElement>('.cf-w')
  wEl.innerHTML = WEIGHTS.map(([n, w]) => `<span class="cf-wseg" role="listitem" data-n="${n}" style="flex:${w}" title="${esc(n)} ${w}%"><b>${w}%</b></span>`).join('')
  $<HTMLElement>('.cf-wkey').innerHTML = WEIGHTS.map(([n, w]) => `<li data-n="${esc(n)}"><i></i>${esc(n)} <b>${w}%</b></li>`).join('')

  // ---- state
  let horizon: 5 | 10 = 5, g = 44, seated = true
  const reachNote = (v: number, y: number) => {
    const n = NOTCH[y]
    if (Math.abs(v - n) < 0.05) return `On the deck's notch: ${usd(PRICE)} asks for exactly this much growth at ${WACC} and ${EXIT}.`
    return v > n
      ? `Above the deck's ${n}% for ${y} years: if you believe this, the price asks for less growth than you expect.`
      : `Below the deck's ${n}% for ${y} years: at this growth the price would be asking for more than you expect.`
  }

  function paintPath() {
    const n = NOTCH[horizon], N = horizon
    const mine = (1 + g / 100) ** N, pitch = (1 + n / 100) ** N, top = Math.max(mine, pitch, 1.6) * 1.08
    const X = (t: number) => 34 + (t / N) * 270, Y = (m: number) => 104 - ((m - 1) / (top - 1)) * 86
    const curve = (r: number) => { let d = ''; for (let i = 0; i <= 24; i++) { const t = (i / 24) * N; d += `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y((1 + r / 100) ** t).toFixed(1)}` } return d }
    const step = N === 5 ? 1 : 2
    let xt = ''; for (let t = 0; t <= N; t += step) xt += `<text x="${X(t).toFixed(1)}" y="118" text-anchor="middle">${t}</text>`
    pathSvg.innerHTML = `<line class="cf-ax" x1="34" y1="104" x2="304" y2="104"/><line class="cf-ax" x1="34" y1="14" x2="34" y2="104"/>${xt}
      <text class="cf-yl" x="38" y="12">x today's revenue</text><path class="cf-pitchp" d="${curve(n)}"/><path class="cf-mine" d="${curve(g)}"/>
      <circle class="cf-end" cx="${X(N).toFixed(1)}" cy="${Y(mine).toFixed(1)}" r="4.5"/>`
    pathCap.innerHTML = `Revenue by year. <span class="cf-k cf-k--m"></span>your setting, <span class="cf-k cf-k--p"></span>the deck's ${n}% a year for ${N} years.`
  }
  function paint() {
    const n = NOTCH[horizon], mine = (1 + g / 100) ** horizon, round = Math.round(g * 10) / 10
    fill.style.strokeDasharray = `${(g / G_MAX) * 100} 100`
    const [kx, ky] = pt(ang(g))
    knob.setAttribute('transform', `translate(${kx.toFixed(2)} ${ky.toFixed(2)})`)
    knob.setAttribute('aria-valuenow', String(round)); knob.setAttribute('aria-valuetext', `${round} percent a year for ${horizon} years`)
    gv.textContent = `${Number.isInteger(round) ? round : round.toFixed(1)}%`
    line.innerHTML = `<b>${Number.isInteger(round) ? round : round.toFixed(1)}% a year for ${horizon} years</b> multiplies revenue <b>${mine.toFixed(1)}x</b>.`
    verdict.textContent = reachNote(g, horizon)
    root.classList.toggle('is-seated', Math.abs(g - n) < 0.05)
    notches.forEach(el => el.classList.toggle('is-on', +el.dataset.y! === horizon))
    paintPath()
  }

  // ---- dial: pointer turns it, keys step it, a notch pulls the knob in
  const MAGNET = 1.4
  const place = (v: number, fromPointer: boolean) => {
    let nv = clamp(v, 0, G_MAX)
    const n = NOTCH[horizon], other = NOTCH[horizon === 5 ? 10 : 5]
    let snapped = false
    for (const t of [n, other]) if (fromPointer && Math.abs(nv - t) < MAGNET) { nv = t; snapped = true }
    if (Math.abs(nv - g) < 0.001) return
    g = Math.round(nv * 10) / 10
    paint()
    if (snapped && !seated) { cue('hub:detent', { ch: 3 }); seated = true; if (!reduced) animate(knob.querySelector('.cf-halo')!, { r: [15, 22, 15], duration: 360, ease: 'out(3)' }) }
    else if (!snapped) { seated = false; cue('lab:drag', { param: 'growth', value: g / G_MAX }) }
  }
  const fromEvent = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect(), s = r.width / 380
    const dx = (e.clientX - r.left) / s - 30 - CX, dy = (e.clientY - r.top) / s - CY
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI                // 0 = up, clockwise positive
    deg = clamp(deg, -SWEEP / 2, SWEEP / 2)                         // the gap at the bottom pins to the nearer end
    return ((deg + SWEEP / 2) / SWEEP) * G_MAX
  }
  let dragging = false
  svg.addEventListener('pointerdown', e => { if (e.button) return; dragging = true; svg.setPointerCapture?.(e.pointerId); place(fromEvent(e), true); e.preventDefault() })
  svg.addEventListener('pointermove', e => { if (dragging) place(fromEvent(e), true) })
  const end = () => { dragging = false }
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end)
  knob.addEventListener('keydown', e => {
    const big = e.shiftKey ? 5 : 1
    const d: Record<string, number> = { ArrowRight: big, ArrowUp: big, ArrowLeft: -big, ArrowDown: -big, PageUp: 5, PageDown: -5 }
    let v: number | null = null
    if (e.key in d) v = g + d[e.key]; else if (e.key === 'Home') v = 0; else if (e.key === 'End') v = G_MAX
    if (v === null) return
    e.preventDefault(); e.stopPropagation()
    const was = g; place(Math.round(v), false)
    if (Math.abs(g - NOTCH[horizon]) < 0.05 && was !== g) { cue('hub:detent', { ch: 3 }); seated = true }
  })

  root.addEventListener('click', e => {
    const t = e.target as HTMLElement
    const chip = t.closest<HTMLElement>('.cf-hz .ml-chip')
    if (chip) {
      const y = +chip.dataset.y! as 5 | 10
      if (y === horizon) return
      horizon = y; hz.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.y! === y))); seated = false; paint(); return
    }
    const sn = t.closest<HTMLElement>('[data-snap]')
    if (sn) {
      const y = +sn.dataset.snap! as 5 | 10
      horizon = y; hz.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.y! === y)))
      const to = NOTCH[y], from = g
      cue('hub:detent', { ch: 3 })
      if (reduced) { g = to; seated = true; paint(); return }
      const o = { v: from }
      animate(o, { v: to, duration: 520, ease: 'out(3)', onUpdate: () => { g = Math.round(o.v * 10) / 10; paint() }, onComplete: () => { g = to; seated = true; paint() } })
      return
    }
    const mk = t.closest<HTMLElement>('.cf-mk')
    if (mk) strip.dataset.hot = strip.dataset.hot === mk.dataset.k ? '' : mk.dataset.k!
  })
  // hovering or focusing a weight highlights its price mark where the deck gives one
  const hot = (n: string | null) => { strip.dataset.hot = n === 'Bear' ? 'bear' : n === 'Super-Bull' ? 'super' : '' }
  root.querySelector('.cf-scn')!.addEventListener('pointerover', e => hot((e.target as HTMLElement).closest<HTMLElement>('.cf-wseg, .cf-wkey li')?.dataset.n ?? null))
  wEl.addEventListener('pointerleave', () => hot(null)); root.querySelector('.cf-wkey')!.addEventListener('pointerleave', () => hot(null))

  paint()
  // the arrow from price to target draws itself once, when the strip first shows
  const gain = $<HTMLElement>('.cf-gain')
  if (!reduced) {
    gain.style.transformOrigin = '0 50%'; gain.style.transform = 'scaleX(0)'
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); animate(gain, { scaleX: [0, 1], duration: 900, delay: 250, ease: 'out(4)' }) } }, { threshold: 0.4 })
    io.observe(strip)
    return { dispose() { io.disconnect(); host.innerHTML = '' } }
  }
  return { dispose() { host.innerHTML = '' } }
}
