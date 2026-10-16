// AppFolio lab: "Where the growth came from". Revenue is customers x units per customer x revenue per unit, and the pitch's point is that the
// customer count flattens while each customer pays more. Every figure shown is from src/data/projects.json (id "appfolio"): revenue per customer
// $10,520 (2016) to $38,210 (2024); 17.5% a year against 9.5% for customers; customers 8,218 (2015) to 20,784 (2024), the logistic fit reaching
// 24,204 by 2030; value-added services 60.2% (2019) to 76.2% (2024); GAAP operating margin -15.3% (2022) to 17.1% (2024).
// The data has no yearly series, so nothing between the stated years is shown as a figure: "Play" only animates from one stated end to the
// other, and the curve is drawn through the three stated customer counts (2015, 2024, 2030). Its shape is a drawing, not the deck's fit.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: count:tick while the figures roll, hub:detent when a stop is picked.
import './lib/model-base.css'
import './appfolio.css'
import { animate } from 'animejs'
import { lerp, smooth, gate, type LabHandle, type LabOpts } from './lib/kit'

const CUST = { 2015: 8218, 2024: 20784, 2030: 24204 } as const
const RPC = { 2016: 10520, 2024: 38210 } as const
const VAS = { 2019: 60.2, 2024: 76.2 } as const
const MARGIN = { 2022: -15.3, 2024: 17.1 } as const
const CAGR = { rpc: 17.5, cust: 9.5 } as const
const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const usd = (n: number) => '$' + fmt(n)

// the logistic curve through the three stated points: 1/N = A + B q^t (t in years after 2015), solved once for q by bisection
function logistic() {
  const y1 = 1 / CUST[2015], y2 = 1 / CUST[2024], y3 = 1 / CUST[2030], target = (y1 - y2) / (y2 - y3)
  let lo = 1e-6, hi = 0.999999
  for (let i = 0; i < 120; i++) { const q = (lo + hi) / 2, f = (1 - q ** 9) / (q ** 9 * (1 - q ** 6)) - target; if (f > 0) lo = q; else hi = q }
  const q = lo, B = (y1 - y2) / (1 - q ** 9), A = y1 - B
  return (year: number) => 1 / (A + B * q ** (year - 2015))
}

const W = 360, H = 210, PL = 44, PR = 14, PT = 16, PB = 30
const X = (yr: number) => PL + ((yr - 2015) / 15) * (W - PL - PR)
const Y = (n: number) => H - PB - (n / 27000) * (H - PT - PB)

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced, cue = gate(opts.emit, 70)
  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'ml af' + (reduced ? ' is-reduced' : '')
  root.setAttribute('data-proof', 'skip')
  const N = logistic()

  const pathOf = (a: number, b: number) => { let s = ''; for (let yr = a; yr <= b + 1e-9; yr += 0.25) s += `${s ? 'L' : 'M'}${X(yr).toFixed(1)} ${Y(N(yr)).toFixed(1)}`; return s }
  const d = pathOf(2015, 2024), dFore = pathOf(2024, 2030)
  const yTicks = [0, 10000, 20000].map(v => `<line class="af-grid" x1="${PL}" x2="${W - PR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${PL - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${v === 0 ? '0' : (v / 1000) + 'k'}</text>`).join('')
  const xTicks = [2015, 2020, 2025, 2030].map(yr => `<text x="${X(yr).toFixed(1)}" y="${H - 8}" text-anchor="middle">${yr}</text>`).join('')
  const tri = [2025, 2026, 2027, 2028, 2029, 2030].map(yr => { const x = X(yr), y = Y(N(yr)); return `<path class="af-tri" d="M${x.toFixed(1)} ${(y - 5).toFixed(1)} L${(x + 4.5).toFixed(1)} ${(y + 3.5).toFixed(1)} L${(x - 4.5).toFixed(1)} ${(y + 3.5).toFixed(1)} Z"/>` }).join('')

  root.innerHTML = `
  <header class="ml-head">
    <div><span class="ml-kicker">Interactive model <span class="ml-sim" style="margin-left:8px">From the 10-Ks</span></span><h3 class="ml-title">Where the growth came from</h3></div>
    <p class="ml-note" role="note">Revenue is customers times units per customer times revenue per unit. Pick a stop on the curve, or play the years, and see which factor did the work.</p>
  </header>
  <div class="af-eq" role="group" aria-label="Revenue equals customers times units per customer times revenue per unit">
    <span class="af-term af-term--r"><i>Revenue</i></span><b aria-hidden="true">=</b>
    <button type="button" class="af-term" data-f="cust"><i>Customers</i><small>slowing: ${CAGR.cust}% a year</small></button><b aria-hidden="true">&times;</b>
    <button type="button" class="af-term" data-f="rpc"><i>Units per customer</i><small>&times; revenue per unit</small></button><b aria-hidden="true">&times;</b>
    <button type="button" class="af-term" data-f="rpc"><i>Revenue per unit</i><small>together: ${CAGR.rpc}% a year</small></button>
  </div>
  <div class="ml-row af-tool"><button type="button" class="ml-btn ml-btn--acc af-play" data-act="play">Play the years</button><span class="ml-small">Runs each figure from its first stated year to its last.</span></div>
  <div class="ml-cols af-cols">
    <section class="ml-p af-p af-p--cust" data-f="cust" aria-label="Customers, with the logistic fit">
      <span class="ml-lab">Customers: the curve flattens</span>
      <div class="af-big"><b class="af-cv">${fmt(CUST[2024])}</b><span class="af-cy ml-mono">2024</span></div>
      <svg class="af-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Customers rise from 8,218 in 2015 to 20,784 in 2024, and a logistic curve flattens to 24,204 in 2030">
        ${yTicks}${xTicks}
        <line class="af-split" x1="${X(2024).toFixed(1)}" x2="${X(2024).toFixed(1)}" y1="${PT}" y2="${H - PB}"/>
        <text class="af-fc" x="${(X(2024) + 6).toFixed(1)}" y="${H - PB - 8}">Fit, projected</text>
        <path class="af-curve af-curve--f" d="${dFore}"/><path class="af-curve" d="${d}"/>${tri}
        <circle class="af-dot" r="6.5" cx="${X(2024)}" cy="${Y(CUST[2024])}"/>
        <text class="af-pt" x="${X(2024)}" y="${Y(CUST[2024]) - 12}" text-anchor="middle"></text>
      </svg>
      <div class="ml-row af-stops" role="group" aria-label="Pick a year"><button class="ml-chip" type="button" data-yr="2015" aria-pressed="false">2015</button><button class="ml-chip" type="button" data-yr="2024" aria-pressed="true">2024</button><button class="ml-chip" type="button" data-yr="2030" aria-pressed="false">2030, fitted</button></div>
      <p class="ml-small af-fn">The curve is drawn through the three stated counts. Each year's gain is smaller than the last, which is the pitch's point.</p>
    </section>
    <section class="ml-p af-p af-p--rpc" data-f="rpc" aria-label="Revenue per customer">
      <span class="ml-lab">Revenue per customer, 2016 to 2024</span>
      <div class="af-bars">
        <div class="af-bar"><div class="af-col"><i class="af-b af-b--0" style="height:${(RPC[2016] / RPC[2024]) * 100}%"></i></div><b>${usd(RPC[2016])}</b><span class="ml-mono">2016</span></div>
        <div class="af-bar"><div class="af-col"><i class="af-b af-b--1" style="height:100%"></i></div><b class="af-rv">${usd(RPC[2024])}</b><span class="ml-mono">2024</span></div>
      </div>
      <span class="ml-lab" style="margin-top:14px">Growth a year, 2016 to 2024</span>
      <div class="af-cg">
        <div class="af-row"><span>Revenue per customer</span><div class="af-tr"><i class="af-g af-g--r" style="width:${(CAGR.rpc / 20) * 100}%"></i></div><b>${CAGR.rpc}%</b></div>
        <div class="af-row"><span>Customers</span><div class="af-tr"><i class="af-g af-g--c" style="width:${(CAGR.cust / 20) * 100}%"></i></div><b>${CAGR.cust}%</b></div>
      </div>
      <p class="ml-small af-fn">Bars are drawn to the two rates. Revenue per customer grew almost twice as fast, so most of the pitch's growth is each customer paying more.</p>
    </section>
  </div>
  <section class="ml-p af-vas" data-f="rpc" aria-label="Value-added services share and operating margin">
    <div class="af-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="af-rt" cx="60" cy="60" r="48" pathLength="100"/><circle class="af-rf" cx="60" cy="60" r="48" pathLength="100" stroke-dasharray="${VAS[2024]} 100" transform="rotate(-90 60 60)"/></svg><b class="af-vv">${VAS[2024]}%</b></div>
    <div class="af-vt"><span class="ml-lab">Value-added services, share of revenue</span>
      <p class="ml-small">The add-ons that ride on top of the core software climbed from <b>${VAS[2019]}%</b> in 2019 to <b>${VAS[2024]}%</b> in 2024. That is the revenue-per-customer story in one dial.</p>
      <p class="ml-small">GAAP operating margin: <b>&minus;${Math.abs(MARGIN[2022])}%</b> in 2022 to <b>${MARGIN[2024]}%</b> in 2024.</p></div>
  </section>`
  host.appendChild(root)
  const $ = <T extends Element>(s: string) => root.querySelector(s) as T
  const dot = $<SVGCircleElement>('.af-dot'), pt = $<SVGTextElement>('.af-pt'), cv = $('.af-cv'), cy = $('.af-cy')
  const stops = [...root.querySelectorAll<HTMLButtonElement>('.af-stops .ml-chip')]
  const b1 = $<HTMLElement>('.af-b--1'), rv = $('.af-rv'), rf = $<SVGCircleElement>('.af-rf'), vv = $('.af-vv'), gr = $<HTMLElement>('.af-g--r'), gc = $<HTMLElement>('.af-g--c')
  let stop = 2024, playing: { pause(): unknown; cancel(): unknown } | null = null, dotAnim: { cancel(): unknown } | null = null, timer = 0

  const setDot = (yr: number, label: string) => {
    dot.setAttribute('cx', String(X(yr))); dot.setAttribute('cy', String(Y(N(yr))))
    pt.setAttribute('x', String(Math.min(X(yr), W - 30))); pt.setAttribute('y', String(Y(N(yr)) - 13)); pt.textContent = label
  }
  const showStop = (yr: 2015 | 2024 | 2030, animateIt: boolean) => {
    stop = yr
    stops.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.yr! === yr)))
    cy.textContent = yr === 2030 ? '2030, fitted' : String(yr)
    const target = CUST[yr], from = parseInt(cv.textContent!.replace(/,/g, ''), 10) || target
    const x0 = +dot.getAttribute('cx')!, label = fmt(target)
    if (!animateIt || reduced) { cv.textContent = label; setDot(yr, label); return }
    dotAnim?.cancel()
    const o = { u: 0 }
    dotAnim = animate(o, { u: 1, duration: 520, ease: 'inOut(3)', onUpdate: () => {
      const cx = lerp(x0, X(yr), o.u), year = 2015 + ((cx - PL) / (W - PL - PR)) * 15
      dot.setAttribute('cx', cx.toFixed(1)); dot.setAttribute('cy', Y(N(year)).toFixed(1)); cv.textContent = fmt(lerp(from, target, smooth(o.u))); pt.textContent = ''
    }, onComplete: () => { cv.textContent = label; setDot(yr, label) } })
  }

  const rest = () => {
    showStop(2024, false); rv.textContent = usd(RPC[2024]); b1.style.height = '100%'; vv.textContent = VAS[2024] + '%'; rf.style.strokeDasharray = `${VAS[2024]} 100`
    gr.style.width = `${(CAGR.rpc / 20) * 100}%`; gc.style.width = `${(CAGR.cust / 20) * 100}%`
  }
  // play: every factor runs from its first stated figure to its last. The numbers roll; they land on the stated ones.
  function play() {
    if (reduced) { rest(); return }
    playing?.cancel(); dotAnim?.cancel(); clearTimeout(timer)
    root.classList.add('is-playing')
    stops.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.yr! === 2015)))
    cy.textContent = '2015 to 2024'; pt.textContent = ''
    const o = { t: 0 }
    let lastTick = 0
    playing = animate(o, { t: 1, duration: 3200, ease: 'inOut(2)', onUpdate: () => {
      const e = o.t
      const yr = 2015 + e * 9
      dot.setAttribute('cx', X(yr).toFixed(1)); dot.setAttribute('cy', Y(N(yr)).toFixed(1))
      cv.textContent = fmt(lerp(CUST[2015], CUST[2024], e))
      const r = Math.min(1, Math.max(0, (e - 0.1) / 0.9))
      rv.textContent = usd(lerp(RPC[2016], RPC[2024], r)); b1.style.height = `${lerp(RPC[2016] / RPC[2024], 1, r) * 100}%`
      vv.textContent = lerp(VAS[2019], VAS[2024], e).toFixed(1) + '%'; rf.style.strokeDasharray = `${lerp(VAS[2019], VAS[2024], e)} 100`
      gr.style.width = `${lerp(0, CAGR.rpc / 20, e) * 100}%`; gc.style.width = `${lerp(0, CAGR.cust / 20, e) * 100}%`
      const now = performance.now(); if (now - lastTick > 160) { lastTick = now; cue('count:tick') }
    }, onComplete: () => { root.classList.remove('is-playing'); rest(); cue('hub:detent', { ch: 4 }) } })
  }

  root.addEventListener('click', e => {
    const t = e.target as HTMLElement
    const s = t.closest<HTMLElement>('.af-stops .ml-chip')
    if (s) { playing?.cancel(); root.classList.remove('is-playing'); showStop(+s.dataset.yr! as 2015 | 2024 | 2030, true); cue('hub:detent', { ch: 4 }); return }
    if (t.closest('[data-act="play"]')) { play(); return }
    const f = t.closest<HTMLElement>('.af-term[data-f]')
    if (f) {
      const k = f.dataset.f!
      root.querySelectorAll<HTMLElement>('.af-p, .af-vas').forEach(p => p.classList.toggle('is-hot', p.dataset.f === k))
      clearTimeout(timer); timer = window.setTimeout(() => root.querySelectorAll('.is-hot').forEach(p => p.classList.remove('is-hot')), 2200)
      cue('lab:click')
    }
  })
  rest()
  return { dispose() { playing?.cancel(); dotAnim?.cancel(); clearTimeout(timer); host.innerHTML = '' } }
}
