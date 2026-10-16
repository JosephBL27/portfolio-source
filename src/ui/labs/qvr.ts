// QVR lab: an interactive textbook model of an implied-volatility surface and of a leveraged-ETF closing flow.
// Illustrative model with invented parameters. Not QVR's data, code or results.
//   Surface : SSVI, Gatheral & Jacquier (2014), "Arbitrage-free SVI volatility surfaces" (Quantitative Finance 14(1)).
//   Flow    : Cheng & Madhavan (2009), "The Dynamics of Leveraged and Inverse Exchange-Traded Funds".
// Canvas 2D on purpose: crisp lines, no extra WebGL context beside the site's own, deterministic for screenshots.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Emits lab:drag {param, value 0..1} and lab:arb {on}.
import './qvr.css'
import {
  BUMP, DEFAULTS, FWD, K_MAX, K_MIN, RATE, T_MAX, T_MIN, atmVol, black76, bumpAt, bumpPeak, durrleman, dwdT, fitSlice,
  intradayPath, kOf, mulberry, phi, rebalanceFlow, scanArb, sliceSigma, ssviSigma, sufficient, tOf, theta, uOf,
  type SSVIParams,
} from './qvr-math'

export interface LabOpts { emit(name: string, data?: any): void; reduced: boolean }

const NK = 64, NT = 44
const BW = 2.2, BD = 1.5, BH = 1.15
const MATS = [{ l: '1W', T: 7 / 365 }, { l: '1M', T: 1 / 12 }, { l: '3M', T: 0.25 }, { l: '6M', T: 0.5 }, { l: '1Y', T: 1 }, { l: '2Y', T: 2 }]
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const pct = (v: number, d = 1) => (v * 100).toFixed(d) + '%'
const sgn = (v: number, d = 2) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d)
const mat = (T: number) => (T < 0.08 ? `${Math.round(T * 365)}d` : T < 0.995 ? `${(T * 12).toFixed(1)}M` : `${T.toFixed(2)}Y`)
const hash = (a: number, b: number) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)

type Mode = 'surface' | 'flow'
const RAMP: [number, number, number][] = [[30, 16, 78], [92, 54, 186], [180, 140, 255], [246, 238, 255]]
function ramp(h: number, out: number[]) {
  h = clamp(h, 0, 1) * 3
  const i = Math.min(2, Math.floor(h)), f = h - i
  out[0] = lerp(RAMP[i][0], RAMP[i + 1][0], f); out[1] = lerp(RAMP[i][1], RAMP[i + 1][1], f); out[2] = lerp(RAMP[i][2], RAMP[i + 1][2], f)
}

export function mount(host: HTMLElement, opts: LabOpts): { dispose(): void; stats(): { renderMs: number } } {
  const reduced = opts.reduced
  const emit = (n: string, d?: any) => { try { opts.emit(n, d) } catch {} }
  const lastEmit: Record<string, number> = {}
  const emitDrag = (param: string, value: number) => {
    const now = performance.now()
    if (now - (lastEmit[param] ?? 0) < 90) return
    lastEmit[param] = now; emit('lab:drag', { param, value: clamp(value, 0, 1) })
  }

  // ------------------------------------------------------------------------------------------------ state
  const S = {
    p: { ...DEFAULTS } as SSVIParams,
    mode: 'surface' as Mode,
    pickK: -0.05, pickU: uOf(0.25),
    hover: null as null | { k: number; u: number; x: number; y: number },
    yaw: 0.52, pitch: 0.5, vyaw: 0, vpitch: 0, idleSince: 0,
    sLo: 0.1, sHi: 0.8, tLo: 0.1, tHi: 0.8,
    flow: { L: 3, r: 0.03, aum: 8, session: 0, play: !reduced, phase: 0, hold: 0 },
    arbOn: false, arbKey: '',
    tween: null as null | { from: SSVIParams; to: SSVIParams; t0: number; dur: number },
  }
  let dirty = true, visible = true, raf = 0, last = 0, tsec = 0, disposed = false
  let lastPanels = 0

  // ------------------------------------------------------------------------------------------------ DOM
  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'vl'
  root.setAttribute('data-proof', 'skip')
  root.innerHTML = `
  <header class="vl-head">
    <div class="vl-titles">
      <span class="vl-kicker">Interactive textbook model</span>
      <h3 class="vl-title">Implied-volatility surface</h3>
    </div>
    <div class="vl-tabs" role="tablist" aria-label="Lab mode">
      <button type="button" role="tab" class="vl-tab" data-mode="surface" aria-selected="true">Surface</button>
      <button type="button" role="tab" class="vl-tab" data-mode="flow" aria-selected="false">Rebalancing flow</button>
    </div>
    <p class="vl-note" role="note"><b>Illustrative model with invented parameters. Not QVR's data, code or results.</b></p>
  </header>
  <div class="vl-stage">
    <div class="vl-main">
    <div class="vl-view">
      <canvas class="vl-3d" tabindex="0" role="img" aria-label="Three-dimensional implied volatility surface. Drag to orbit, hover to read a value, click to pin a strike and maturity. Arrow keys orbit."></canvas>
      <div class="vl-pill" aria-live="polite"><i class="vl-dot"></i><span class="vl-pill-t"></span></div>
      <div class="vl-tip" hidden></div>
      <div class="vl-viewtools"><button type="button" class="vl-mini" data-act="reset-view">Reset view</button><span class="vl-hint">drag to orbit &middot; click to pin</span></div>
    </div>
    <section class="vl-grp vl-pick" data-for="surface">
        <h4 class="vl-h">Pick a point</h4>
        <div class="vl-chips" role="group" aria-label="Maturity"></div>
        <div class="vl-sliders" data-sliders="pick"></div>
    </section>
    </div>
    <aside class="vl-side">
      <section class="vl-grp" data-for="surface">
        <h4 class="vl-h">SSVI parameters</h4>
        <div class="vl-sliders" data-sliders="p"></div>
        <div class="vl-presets" role="group" aria-label="Presets"></div>
        <div class="vl-arb" aria-live="polite"><div class="vl-arb-h"></div><p class="vl-arb-b"></p></div>
        <h4 class="vl-h">Reading the surface</h4>
        <ul class="vl-key"><li><i></i>iso-vol contour line</li><li><i class="k-s"></i>picked maturity slice, drag to move the pick</li><li><i class="k-q"></i>synthetic quote, with a little noise</li><li><i class="k-r"></i>red glow: a no-arbitrage condition breaks here</li></ul>
      </section>
      <section class="vl-grp" data-for="flow" hidden>
        <h4 class="vl-h">Closing flow of a daily-reset fund</h4>
        <div class="vl-chips" data-chips="lev" role="group" aria-label="Leverage"></div>
        <div class="vl-sliders" data-sliders="flow"></div>
        <div class="vl-playrow"><button type="button" class="vl-mini vl-play" data-act="play">Pause</button><span class="vl-hint">mechanism sketch, constants invented</span></div>
        <p class="vl-copy">A fund that resets its leverage <i>L</i> each day must trade about <b><i>L</i>(<i>L</i>&minus;1) &middot; r &middot; AUM</b> near the close. Here that flow is assumed to lift short-dated implied vol, which then decays over the next sessions. It is a sketch of the mechanism, not a measurement.</p>
      </section>
    </aside>
  </div>
  <div class="vl-panels" data-for="surface">
    <figure class="vl-panel vl-smile"><figcaption><b class="vl-pt-smile"></b><span>sigma against log-moneyness k</span></figcaption><div class="vl-chart"><svg viewBox="0 0 380 230" preserveAspectRatio="xMidYMid meet"></svg><div class="vl-hit" data-hit="smile"></div></div><div class="vl-legend"><i class="l-q"></i>synthetic quotes<i class="l-m"></i>SSVI slice<i class="l-f"></i>re-fit to the dots <span class="vl-fit"></span></div></figure>
    <figure class="vl-panel vl-term"><figcaption><b>Term structure</b><span>ATM sigma and skew against T</span></figcaption><div class="vl-chart"><svg viewBox="0 0 380 230" preserveAspectRatio="xMidYMid meet"></svg><div class="vl-hit" data-hit="term"></div></div><div class="vl-legend"><i class="l-m"></i>ATM sigma<i class="l-s"></i>skew, sigma(k=&minus;0.1) &minus; sigma(k=+0.1)</div></figure>
    <figure class="vl-panel vl-black"><figcaption><b>Black-76 at the pick</b><span>F = ${FWD}, r = ${(RATE * 100).toFixed(0)}%, flat vol read off the surface</span></figcaption><div class="vl-black-body"></div></figure>
  </div>
  <div class="vl-panels" data-for="flow" hidden>
    <figure class="vl-panel vl-path"><figcaption><b>Index, intraday</b><span>5-minute bars, last 15 min shaded</span></figcaption><div class="vl-chart"><svg viewBox="0 0 380 230" preserveAspectRatio="xMidYMid meet"></svg></div></figure>
    <figure class="vl-panel vl-flowbar"><figcaption><b>Closing flow</b><span>L(L&minus;1) &middot; r &middot; AUM</span></figcaption><div class="vl-chart"><svg viewBox="0 0 380 230" preserveAspectRatio="xMidYMid meet"></svg></div><div class="vl-legend vl-formula"></div></figure>
    <figure class="vl-panel vl-bump"><figcaption><b>Short-dated vol after the close</b><span>transient bump, invented decay</span></figcaption><div class="vl-chart"><svg viewBox="0 0 380 230" preserveAspectRatio="xMidYMid meet"></svg></div><div class="vl-legend vl-bumpread"></div></figure>
  </div>
  <footer class="vl-refs">
    <span><b>SSVI:</b> Gatheral &amp; Jacquier (2014), &ldquo;Arbitrage-free SVI volatility surfaces&rdquo;, <i>Quantitative Finance</i> 14(1). Butterfly check: Durrleman's g(k). Calendar check: &part;w/&part;T &ge; 0.</span>
    <span><b>Flows:</b> Cheng &amp; Madhavan (2009), &ldquo;The Dynamics of Leveraged and Inverse Exchange-Traded Funds&rdquo;.</span>
    <span>Quote dots are synthetic. Black-76 sensitivities use the surface vol as a flat vol (no sticky-strike skew correction).</span>
  </footer>`
  host.append(root)
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T
  const canvas = $<HTMLCanvasElement>('.vl-3d')
  const g = canvas.getContext('2d')!
  const view = $('.vl-view'), tip = $('.vl-tip'), pill = $('.vl-pill'), pillT = $('.vl-pill-t')

  // ------------------------------------------------------------------------------------------------ sliders
  interface SDef { key: string; label: string; min: number; max: number; step: number; get(): number; set(v: number): void; fmt(v: number): string; group: string; light?: boolean }
  const sliders: { def: SDef; el: HTMLElement; sync(): void }[] = []
  function makeSlider(def: SDef, into: HTMLElement) {
    const el = document.createElement('div')
    el.className = 'vl-sl'
    el.innerHTML = `<div class="vl-sl-top"><span class="vl-sl-label">${def.label}</span><output class="vl-sl-val"></output></div><div class="vl-sl-track" role="slider" tabindex="0" aria-label="${def.label}" aria-valuemin="${def.min}" aria-valuemax="${def.max}"><div class="vl-sl-fill"></div><div class="vl-sl-thumb"></div></div>`
    const track = el.querySelector('.vl-sl-track') as HTMLElement, val = el.querySelector('output') as HTMLElement
    const fill = el.querySelector('.vl-sl-fill') as HTMLElement, thumb = el.querySelector('.vl-sl-thumb') as HTMLElement
    const norm = (v: number) => (v - def.min) / (def.max - def.min)
    const sync = () => {
      const v = def.get(), n = norm(v)
      fill.style.transform = `scaleX(${n})`; thumb.style.left = `${n * 100}%`
      val.textContent = def.fmt(v)
      track.setAttribute('aria-valuenow', String(+v.toFixed(4))); track.setAttribute('aria-valuetext', def.fmt(v))
    }
    const apply = (v: number) => {
      v = clamp(Math.round(v / def.step) * def.step, def.min, def.max)
      if (Math.abs(v - def.get()) < 1e-12) return
      if (!def.light) S.tween = null; def.set(v); sync(); dirty = true; panelsDirty = true; emitDrag(def.key, norm(v)); if (!def.light) onParamsChanged(def.group === 'p')
    }
    const at = (e: PointerEvent) => { const r = track.getBoundingClientRect(); apply(def.min + clamp((e.clientX - r.left) / r.width, 0, 1) * (def.max - def.min)) }
    track.addEventListener('pointerdown', e => { track.setPointerCapture(e.pointerId); track.classList.add('is-drag'); at(e); e.preventDefault() })
    track.addEventListener('pointermove', e => { if (track.hasPointerCapture(e.pointerId)) at(e) })
    const end = (e: PointerEvent) => { track.classList.remove('is-drag'); if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId) }
    track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end)
    track.addEventListener('keydown', e => {
      const big = def.step * Math.max(1, Math.round((def.max - def.min) / def.step / 10))
      const k = e.key, v = def.get()
      let nv: number | null = null
      if (k === 'ArrowRight' || k === 'ArrowUp') nv = v + def.step
      else if (k === 'ArrowLeft' || k === 'ArrowDown') nv = v - def.step
      else if (k === 'PageUp') nv = v + big
      else if (k === 'PageDown') nv = v - big
      else if (k === 'Home') nv = def.min
      else if (k === 'End') nv = def.max
      if (nv !== null) { e.preventDefault(); apply(nv) }
    })
    into.append(el)
    const rec = { def, el, sync }; sliders.push(rec); sync(); return rec
  }
  const P = S.p
  const pSl = $('[data-sliders="p"]'), pickSl = $('[data-sliders="pick"]'), flowSl = $('[data-sliders="flow"]')
  const defs: SDef[] = [
    { key: 'level', label: 'ATM vol level', min: 0.08, max: 0.6, step: 0.005, get: () => P.level, set: v => { P.level = v }, fmt: v => pct(v), group: 'p' },
    { key: 'slope', label: 'Term-structure slope', min: -0.9, max: 0.9, step: 0.01, get: () => P.slope, set: v => { P.slope = v }, fmt: v => `${sgn(v * 100, 0)}% long end`, group: 'p' },
    { key: 'rho', label: 'Skew ρ', min: -0.95, max: 0.95, step: 0.01, get: () => P.rho, set: v => { P.rho = v }, fmt: v => sgn(v), group: 'p' },
    { key: 'eta', label: 'Curvature η', min: 0.1, max: 3, step: 0.05, get: () => P.eta, set: v => { P.eta = v }, fmt: v => v.toFixed(2), group: 'p' },
    { key: 'gamma', label: 'Decay γ', min: 0.05, max: 0.95, step: 0.05, get: () => P.gamma, set: v => { P.gamma = v }, fmt: v => v.toFixed(2), group: 'p' },
  ]
  for (const d of defs) makeSlider(d, pSl)
  makeSlider({ key: 'strike', label: 'Strike (log-moneyness k)', min: K_MIN, max: K_MAX, step: 0.005, get: () => S.pickK, set: v => { S.pickK = v }, fmt: v => `k ${sgn(v)} · K ${(FWD * Math.exp(v)).toFixed(1)}`, group: 'pick', light: true }, pickSl)
  makeSlider({ key: 'maturity', label: 'Maturity T', min: 0, max: 1, step: 0.005, get: () => S.pickU, set: v => { S.pickU = v }, fmt: v => mat(tOf(v)), group: 'pick', light: true }, pickSl)
  makeSlider({ key: 'ret', label: 'Index return on the day, r', min: -0.05, max: 0.05, step: 0.0025, get: () => S.flow.r, set: v => { S.flow.r = v; S.flow.play = false; syncPlay() }, fmt: v => sgn(v * 100, 2) + '%', group: 'flow' }, flowSl)
  makeSlider({ key: 'aum', label: 'Fund AUM (invented)', min: 1, max: 25, step: 0.5, get: () => S.flow.aum, set: v => { S.flow.aum = v }, fmt: v => `$${v.toFixed(1)}bn`, group: 'flow' }, flowSl)
  makeSlider({ key: 'session', label: 'Sessions after the close', min: 0, max: 6, step: 1, get: () => S.flow.session, set: v => { S.flow.session = v; S.flow.play = false; syncPlay() }, fmt: v => (v === 0 ? 'at the close' : `T+${v}`), group: 'flow' }, flowSl)

  // presets, maturity chips, leverage chips
  const PRESETS: { l: string; p: Partial<SSVIParams> }[] = [
    { l: 'Reset', p: DEFAULTS },
    { l: 'Steep skew', p: { rho: -0.92, eta: 1.3, slope: 0.5, level: 0.15, gamma: 0.5 } },
    { l: 'Break butterfly', p: { rho: -0.85, eta: 2.9, gamma: 0.5, slope: 0.35, level: 0.17 } },
    { l: 'Break calendar', p: { slope: -0.86, rho: -0.7, eta: 0.8, gamma: 0.5, level: 0.17 } },
  ]
  const presets = $('.vl-presets')
  presets.innerHTML = PRESETS.map((pr, i) => `<button type="button" class="vl-chip" data-preset="${i}">${pr.l}</button>`).join('')
  const matChips = $('.vl-chips[aria-label="Maturity"]')
  matChips.innerHTML = MATS.map((m, i) => `<button type="button" class="vl-chip" data-mat="${i}">${m.l}</button>`).join('')
  const levChips = $('[data-chips="lev"]')
  const LEVS = [2, 3, -1, -2, -3]
  levChips.innerHTML = LEVS.map(l => `<button type="button" class="vl-chip" data-lev="${l}">${l > 0 ? '+' : '−'}${Math.abs(l)}x</button>`).join('')

  function syncChips() {
    matChips.querySelectorAll<HTMLElement>('.vl-chip').forEach((b, i) => b.setAttribute('aria-pressed', String(Math.abs(uOf(MATS[i].T) - S.pickU) < 0.004)))
    levChips.querySelectorAll<HTMLElement>('.vl-chip').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.lev! === S.flow.L)))
  }
  function tweenTo(to: Partial<SSVIParams>) {
    const target = { ...S.p, ...to } as SSVIParams
    if (reduced) { Object.assign(S.p, target); sliders.forEach(s => s.sync()); onParamsChanged(); return }
    S.tween = { from: { ...S.p }, to: target, t0: tsec, dur: 0.55 }
  }
  root.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null
    if (!b) return
    if (b.dataset.mode) { setMode(b.dataset.mode as Mode); return }
    if (b.dataset.preset) { tweenTo(PRESETS[+b.dataset.preset].p); emitDrag('preset', +b.dataset.preset / 3); return }
    if (b.dataset.mat) { S.pickU = uOf(MATS[+b.dataset.mat].T); syncAll(); emitDrag('maturity', S.pickU); return }
    if (b.dataset.lev) { S.flow.L = +b.dataset.lev; S.flow.play = false; syncPlay(); syncChips(); onParamsChanged(); emitDrag('leverage', (S.flow.L + 3) / 6); return }
    if (b.dataset.act === 'reset-view') { S.yaw = 0.52; S.pitch = 0.5; S.vyaw = S.vpitch = 0; dirty = true; return }
    if (b.dataset.act === 'play') { S.flow.play = !S.flow.play; if (S.flow.play) S.flow.phase = 0; syncPlay(); return }
  })
  function syncPlay() { const b = $('.vl-play'); b.textContent = S.flow.play ? 'Pause' : 'Play the day' }
  function setMode(m: Mode) {
    S.mode = m
    root.dataset.mode = m
    root.querySelectorAll<HTMLElement>('.vl-tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.mode === m)))
    root.querySelectorAll<HTMLElement>('[data-for]').forEach(s => { s.hidden = s.dataset.for !== m })
    $('.vl-title').textContent = m === 'surface' ? 'Implied-volatility surface' : 'Rebalancing flow and short-dated vol'
    if (m === 'flow') { S.flow.phase = 0; S.flow.play = !reduced; syncPlay() }
    onParamsChanged(); resize(); dirty = true; syncAll()
  }
  function syncAll() { sliders.forEach(s => s.sync()); syncChips(); dirty = true; panelsDirty = true }

  // ------------------------------------------------------------------------------------------------ grid caches
  const nCell = (NK - 1) * (NT - 1)
  const kArr = new Float32Array(NK), uArr = new Float32Array(NT), TArr = new Float32Array(NT)
  for (let i = 0; i < NK; i++) kArr[i] = kOf(i / (NK - 1))
  for (let j = 0; j < NT; j++) { uArr[j] = j / (NT - 1); TArr[j] = tOf(uArr[j]) }
  const X = new Float32Array(NK * NT), Y = new Float32Array(NK * NT), Zc = new Float32Array(NK * NT)
  const SIG = new Float32Array(NK * NT), BASE = new Float32Array(NK * NT), BUMPV = new Float32Array(NK * NT)
  const BF = new Uint8Array(NK * NT), CAL = new Uint8Array(NK * NT)
  const PX = new Float32Array(NK * NT), PY = new Float32Array(NK * NT), RX = new Float32Array(NK * NT), RY = new Float32Array(NK * NT)
  const xOfK = (k: number) => ((k - K_MIN) / (K_MAX - K_MIN) - 0.5) * BW
  const zOfU = (u: number) => (0.5 - u) * BD
  for (let j = 0; j < NT; j++) for (let i = 0; i < NK; i++) { X[j * NK + i] = xOfK(kArr[i]); Zc[j * NK + i] = zOfU(uArr[j]) }
  let segStart = new Uint32Array(nCell + 1), segs = new Float32Array(0), levels: number[] = []
  let scan = scanArb(S.p, 200, 40)
  const flowNow = () => rebalanceFlow(S.flow.L, S.flow.r, S.flow.aum)

  function onParamsChanged(rescan = true) {
    const flowMode = S.mode === 'flow'
    const fl = flowNow(), ses = S.flow.session
    let mn = 9, mx = 0
    for (let j = 0; j < NT; j++) for (let i = 0; i < NK; i++) {
      const v = j * NK + i
      const b = ssviSigma(S.p, kArr[i], TArr[j])
      const bu = flowMode ? bumpAt(fl, ses, TArr[j]) : 0
      BASE[v] = b; BUMPV[v] = bu; SIG[v] = b + bu
      if (SIG[v] < mn) mn = SIG[v]
      if (SIG[v] > mx) mx = SIG[v]
      BF[v] = durrleman(S.p, kArr[i], TArr[j]) < -1e-9 ? 1 : 0
      CAL[v] = dwdT(S.p, kArr[i], TArr[j]) < -1e-9 ? 1 : 0
    }
    // axis range (eased in update)
    S.tLo = Math.max(0, 0.05 * Math.floor((mn - 0.015) / 0.05)); S.tHi = 0.05 * Math.ceil((mx + 0.015) / 0.05)
    if (S.tHi - S.tLo < 0.2) S.tHi = S.tLo + 0.2
    // contours: marching triangles per cell
    const step = S.tHi - S.tLo > 0.4 ? 0.05 : 0.025
    levels = []
    for (let l = Math.ceil(mn / step) * step; l < mx; l += step) levels.push(+l.toFixed(4))
    const out: number[] = [], starts = new Uint32Array(nCell + 1)
    const tri = (a: number, b: number, c: number, lv: number, li: number) => {
      const sa = SIG[a] - lv, sb = SIG[b] - lv, sc = SIG[c] - lv
      const pts: number[] = []
      const edge = (p: number, q: number, sp: number, sq: number) => { if ((sp < 0) !== (sq < 0)) { const t = sp / (sp - sq); pts.push(lerp(X[p], X[q], t), lerp(Zc[p], Zc[q], t)) } }
      edge(a, b, sa, sb); edge(b, c, sb, sc); edge(c, a, sc, sa)
      if (pts.length === 4) out.push(pts[0], pts[1], pts[2], pts[3], li)
    }
    for (let j = 0; j < NT - 1; j++) for (let i = 0; i < NK - 1; i++) {
      const c = j * (NK - 1) + i; starts[c] = out.length
      const v00 = j * NK + i, v10 = v00 + 1, v01 = v00 + NK, v11 = v01 + 1
      const lo = Math.min(SIG[v00], SIG[v10], SIG[v01], SIG[v11]), hi = Math.max(SIG[v00], SIG[v10], SIG[v01], SIG[v11])
      for (let li = 0; li < levels.length; li++) { const lv = levels[li]; if (lv < lo || lv > hi) continue; tri(v00, v10, v11, lv, li); tri(v00, v11, v01, lv, li) }
    }
    starts[nCell] = out.length
    segStart = starts; segs = Float32Array.from(out)
    // arbitrage scan (the stated grid) and the badge
    if (rescan) { scan = scanArb(S.p, 200, 40); updateArb() }
    panelsDirty = true; dirty = true
  }
  let panelsDirty = true

  function updateArb() {
    const p = S.p, cond = p.eta * (1 + Math.abs(p.rho)), n = scan.nk * scan.nT
    const bf = scan.butterfly > 0, cal = scan.calendar > 0, ok = sufficient(p) && p.gamma <= 0.5
    let key: string, head: string, body: string
    if (bf || cal) {
      const parts: string[] = []
      if (bf) parts.push(`<b>Butterfly.</b> Durrleman's g(k) is negative at ${pct(scan.butterfly / n, 1)} of the 200 × 40 grid (min g = ${scan.minG.toFixed(2)}), so the implied density goes negative there. Sufficient condition: η(1+|ρ|) ≤ 2 with γ ≤ ½. Here η(1+|ρ|) = ${cond.toFixed(2)}${p.gamma > 0.5 ? ` and γ = ${p.gamma.toFixed(2)} &gt; ½, which lets θφ² blow up as T → 0, so the shortest expiries break first` : ''}.`)
      if (cal) parts.push(`<b>Calendar.</b> ∂w/∂T is negative at ${pct(scan.calendar / n, 1)} of the grid (min ${scan.minCal.toFixed(4)}): total variance falls as maturity grows, so a longer option would be worth less than a shorter one. The ATM term structure is inverted too steeply.`)
      key = bf && cal ? 'both' : bf ? 'bf' : 'cal'
      head = bf && cal ? 'Butterfly and calendar arbitrage' : bf ? 'Butterfly arbitrage: g(k) < 0' : 'Calendar arbitrage: ∂w/∂T < 0'
      body = parts.join('<br>')
    } else if (ok) {
      key = 'clean'; head = 'No static arbitrage on the grid'
      body = `g(k) ≥ 0 and ∂w/∂T ≥ 0 at all 8,000 grid points (min g = ${scan.minG.toFixed(2)}). η(1+|ρ|) = ${cond.toFixed(2)} ≤ 2 with γ ≤ ½: inside the sufficient condition.`
    } else {
      key = 'warn'; head = 'Clean here, outside the sufficient condition'
      body = `g(k) ≥ 0 and ∂w/∂T ≥ 0 on this grid (min g = ${scan.minG.toFixed(2)}), but η(1+|ρ|) = ${cond.toFixed(2)}${cond > 2 ? ' > 2' : ''}${p.gamma > 0.5 ? `, γ = ${p.gamma.toFixed(2)} > ½` : ''}. The condition is sufficient, not necessary; a finer grid or a shorter expiry could still fail.`
    }
    const arb = $('.vl-arb')
    arb.dataset.state = key; pill.dataset.state = key
    $('.vl-arb-h').textContent = head; $('.vl-arb-b').innerHTML = body
    pillT.textContent = key === 'clean' ? 'No arbitrage on the grid' : key === 'warn' ? 'Clean, outside the sufficient condition' : head
    const on = bf || cal
    if (on !== S.arbOn) { S.arbOn = on; emit('lab:arb', { on }) }
  }

  // ------------------------------------------------------------------------------------------------ canvas size
  let cw = 600, ch = 380, dpr = 1
  function resize() {
    const r = view.getBoundingClientRect()
    if (r.width < 10) return
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    cw = Math.round(r.width); ch = Math.round(r.height)
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr)
    dirty = true
  }
  const ro = new ResizeObserver(() => resize())
  ro.observe(view)

  // ------------------------------------------------------------------------------------------------ 3D render
  const col = [0, 0, 0]
  const order = new Uint16Array(nCell), keys = new Float32Array(nCell)
  const ccx = new Float32Array(nCell), ccz = new Float32Array(nCell)
  for (let j = 0; j < NT - 1; j++) for (let i = 0; i < NK - 1; i++) { const v = j * NK + i; ccx[j * (NK - 1) + i] = (X[v] + X[v + 1]) / 2; ccz[j * (NK - 1) + i] = (Zc[v] + Zc[v + NK]) / 2 }
  for (let c = 0; c < nCell; c++) order[c] = c
  const cam = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0, rx: 0, rz: 0, ux: 0, uy: 0, uz: 0, F: 600, ox: 0, oy: 0 }
  const TGT = { x: 0, y: 0.34 * BH, z: 0 }
  const yOf = (s: number) => clamp((s - S.sLo) / (S.sHi - S.sLo), -0.04, 1.08) * BH
  function camRaw(yaw: number, pitch: number, dist: number) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch), fov = 30 * Math.PI / 180
    cam.x = TGT.x + dist * Math.sin(yaw) * cp; cam.y = TGT.y + dist * sp; cam.z = TGT.z + dist * Math.cos(yaw) * cp
    let fx = TGT.x - cam.x, fy = TGT.y - cam.y, fz = TGT.z - cam.z
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl
    cam.fx = fx; cam.fy = fy; cam.fz = fz
    const rl = Math.hypot(fz, fx) || 1; cam.rx = -fz / rl; cam.rz = fx / rl
    // up = right x forward, right = (rx, 0, rz)
    cam.ux = -cam.rz * fy; cam.uy = cam.rz * fx - cam.rx * fz; cam.uz = cam.rx * fy
    cam.F = (ch * 0.5) / Math.tan(fov / 2)
    cam.ox = 0; cam.oy = 0
  }
  // box extents on screen for the current camera
  const bb = { x0: 0, x1: 0, y0: 0, y1: 0 }
  function boxBounds() {
    bb.x0 = bb.y0 = 1e9; bb.x1 = bb.y1 = -1e9
    for (let n = 0; n < 8; n++) {
      const p = pr(n & 1 ? BW / 2 : -BW / 2, n & 2 ? BH : 0, n & 4 ? BD / 2 : -BD / 2)
      bb.x0 = Math.min(bb.x0, p.x); bb.x1 = Math.max(bb.x1, p.x); bb.y0 = Math.min(bb.y0, p.y); bb.y1 = Math.max(bb.y1, p.y)
    }
  }
  // distance that keeps the whole box in view at every yaw for this pitch (stable while orbiting)
  let fitKey = '', fitDist = 6
  function fit() {
    const key = `${S.pitch.toFixed(3)}|${cw}|${ch}`
    if (key === fitKey) return fitDist
    fitKey = key
    let d = 6
    for (let it = 0; it < 4; it++) {
      let worst = 0
      for (let n = 0; n < 12; n++) {
        camRaw((n / 12) * Math.PI * 2, S.pitch, d); boxBounds()
        const m = cw < 520 ? 30 : 38
        worst = Math.max(worst, (bb.x1 - bb.x0 + 2 * m) / cw, (bb.y1 - bb.y0) / (ch * 0.8))
      }
      d *= worst
    }
    return (fitDist = d)
  }
  function setCam() {
    const d = fit()
    camRaw(S.yaw, S.pitch, d)
    boxBounds()
    cam.ox = cw / 2 - (bb.x0 + bb.x1) / 2; cam.oy = ch / 2 + 14 - (bb.y0 + bb.y1) / 2
  }
  const proj = { x: 0, y: 0, d: 1 }
  function pr(x: number, y: number, z: number) {
    const vx = x - cam.x, vy = y - cam.y, vz = z - cam.z
    const d = vx * cam.fx + vy * cam.fy + vz * cam.fz
    const s = cam.F / d
    proj.x = cw / 2 + cam.ox + (vx * cam.rx + vz * cam.rz) * s
    proj.y = ch * 0.5 + cam.oy - (vx * cam.ux + vy * cam.uy + vz * cam.uz) * s
    proj.d = d
    return proj
  }

  const prc = (x: number, y: number, z: number) => { pr(x, y, z); return { x: proj.x, y: proj.y } }
  const qk = Array.from({ length: 9 }, (_, i) => -0.44 + i * 0.1)
  const qT = MATS.map(m => m.T)
  const qNoise = (a: number, b: number, k: number, t: number) => {
    const base = hash(a, b) * 2 - 1, ph = hash(b + 17, a + 3) * 6.283
    const w = reduced ? 0 : Math.sin(t * (0.7 + 0.5 * hash(a + 5, b + 9)) + ph)
    return (0.7 * base + 0.35 * w) * (0.0035 + 0.008 * Math.abs(k))
  }

  const pulse = () => (reduced ? 0.5 : 0.5 + 0.5 * Math.sin(tsec * 3.2))

  function render() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, cw, ch)
    setCam()
    // vertices
    const ymirror = true
    for (let v = 0; v < NK * NT; v++) {
      Y[v] = yOf(SIG[v])
      let p = pr(X[v], Y[v], Zc[v]); PX[v] = p.x; PY[v] = p.y
      if (ymirror) { p = pr(X[v], -Y[v], Zc[v]); RX[v] = p.x; RY[v] = p.y }
    }
    // order: far to near along the horizontal view direction
    const hl = Math.hypot(cam.fx, cam.fz) || 1, hx = cam.fx / hl, hz = cam.fz / hl
    for (let c = 0; c < nCell; c++) keys[c] = ccx[c] * hx + ccz[c] * hz
    order.sort((a, b) => keys[b] - keys[a])
    drawBackdrop()
    const cell = (c: number) => { const j = (c / (NK - 1)) | 0, i = c - j * (NK - 1); return j * NK + i }
    // glossy floor: a stage larger than the plot, with the mirrored surface clipped to it and fading with height
    {
      const M = 0.95
      const f0 = prc(-BW / 2 - M, 0, -BD / 2 - 0.3), f1 = prc(BW / 2 + M, 0, -BD / 2 - 0.3), f2 = prc(BW / 2 + M, 0, BD / 2 + M), f3 = prc(-BW / 2 - M, 0, BD / 2 + M)
      g.save()
      g.beginPath(); g.moveTo(f0.x, f0.y); g.lineTo(f1.x, f1.y); g.lineTo(f2.x, f2.y); g.lineTo(f3.x, f3.y); g.closePath()
      const cn = prc(0, 0, 0), grad = g.createRadialGradient(cn.x, cn.y, 10, cn.x, cn.y, Math.max(cw, ch) * 0.55)
      grad.addColorStop(0, 'rgba(60,40,120,0.34)'); grad.addColorStop(1, 'rgba(10,6,22,0)')
      g.fillStyle = grad; g.fill(); g.clip()
      for (let n = 0; n < nCell; n++) {
        const c = order[n], v = cell(c), a = v, b = v + 1, d = v + NK + 1, e = v + NK
        const h = (SIG[a] + SIG[b] + SIG[d] + SIG[e]) * 0.25, hy = (Y[a] + Y[b] + Y[d] + Y[e]) * 0.25 / BH
        ramp((h - S.sLo) / (S.sHi - S.sLo), col)
        g.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${(0.2 * (1 - 0.85 * clamp(hy, 0, 1))).toFixed(3)})`
        g.beginPath(); g.moveTo(RX[a], RY[a]); g.lineTo(RX[b], RY[b]); g.lineTo(RX[d], RY[d]); g.lineTo(RX[e], RY[e]); g.closePath(); g.fill()
      }
      g.restore()
    }
    drawFloor()
    // main surface
    const Lx = -0.42, Ly = 0.78, Lz = 0.46, Ll = Math.hypot(Lx, Ly, Lz)
    const lx = Lx / Ll, ly = Ly / Ll, lz = Lz / Ll
    const slicePick = S.pickU * (NT - 1), jPick = Math.min(NT - 2, Math.floor(slicePick)), fPick = slicePick - jPick
    const kPickI = ((S.pickK - K_MIN) / (K_MAX - K_MIN)) * (NK - 1), iPick = Math.min(NK - 2, Math.floor(kPickI)), gPick = kPickI - iPick
    const gridT = [0, 8, 16, 24, 32, 40]
    const pul = pulse(), bumpMode = S.mode === 'flow'
    const violators: number[] = []
    g.lineJoin = 'round'
    for (let n = 0; n < nCell; n++) {
      const c = order[n], v = cell(c), a = v, b = v + 1, d = v + NK + 1, e = v + NK
      const j = (c / (NK - 1)) | 0, i = c - j * (NK - 1)
      // normal from the two edge vectors
      const ax = X[b] - X[a], ay = Y[b] - Y[a], bz = Zc[e] - Zc[a], by = Y[e] - Y[a]
      let nx = ay * bz, ny = -ax * bz, nz = ax * by
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl
      const cxm = (X[a] + X[d]) / 2, cym = (Y[a] + Y[d]) / 2, czm = (Zc[a] + Zc[d]) / 2
      let vx = cam.x - cxm, vy = cam.y - cym, vz = cam.z - czm; const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl
      const dif = Math.max(0, nx * lx + ny * ly + nz * lz)
      let hx2 = lx + vx, hy2 = ly + vy, hz2 = lz + vz; const hl2 = Math.hypot(hx2, hy2, hz2) || 1; hx2 /= hl2; hy2 /= hl2; hz2 /= hl2
      const spec = Math.pow(Math.max(0, nx * hx2 + ny * hy2 + nz * hz2), 36)
      const fres = Math.pow(1 - Math.max(0, nx * vx + ny * vy + nz * vz), 3)
      const hh = (SIG[a] + SIG[b] + SIG[d] + SIG[e]) * 0.25
      ramp((hh - S.sLo) / (S.sHi - S.sLo), col)
      let r = col[0] * (0.42 + 0.78 * dif) + 120 * spec + 40 * fres
      let gg = col[1] * (0.42 + 0.78 * dif) + 110 * spec + 28 * fres
      let bb = col[2] * (0.42 + 0.78 * dif) + 140 * spec + 60 * fres
      if (bumpMode) { const bm = clamp(((BUMPV[a] + BUMPV[b] + BUMPV[d] + BUMPV[e]) * 0.25) / 0.012, 0, 1); r = lerp(r, 255, bm * 0.55); gg = lerp(gg, 150, bm * 0.5); bb = lerp(bb, 215, bm * 0.5) }
      const bfl = BF[a] | BF[b] | BF[d] | BF[e], cal = CAL[a] | CAL[b] | CAL[d] | CAL[e]
      if (bfl || cal) {
        const k = 0.66 + 0.2 * pul
        const tr = bfl ? 255 : 255, tg = bfl ? 48 : 122, tb = bfl ? 82 : 52
        r = lerp(r, tr, k); gg = lerp(gg, tg, k); bb = lerp(bb, tb, k); violators.push(c)
      }
      const fs = `rgb(${Math.min(255, r) | 0},${Math.min(255, gg) | 0},${Math.min(255, bb) | 0})`
      g.fillStyle = fs; g.strokeStyle = fs; g.lineWidth = 0.9
      g.beginPath(); g.moveTo(PX[a], PY[a]); g.lineTo(PX[b], PY[b]); g.lineTo(PX[d], PY[d]); g.lineTo(PX[e], PY[e]); g.closePath(); g.fill(); g.stroke()
      // mesh lines (every 4th along each axis), then iso-vol contours
      if (i % 4 === 0) { g.strokeStyle = 'rgba(235,222,255,0.16)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(PX[a], PY[a]); g.lineTo(PX[e], PY[e]); g.stroke() }
      if (gridT.includes(j)) { g.strokeStyle = 'rgba(235,222,255,0.2)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(PX[a], PY[a]); g.lineTo(PX[b], PY[b]); g.stroke() }
      const s0 = segStart[c], s1 = segStart[c + 1]
      if (s1 > s0) {
        g.strokeStyle = bfl || cal ? 'rgba(255,230,235,0.55)' : 'rgba(246,238,255,0.5)'; g.lineWidth = 0.9; g.beginPath()
        for (let q = s0; q < s1; q += 5) {
          const yy = yOf(levels[segs[q + 4]])
          let p = pr(segs[q], yy + 0.003, segs[q + 1]); g.moveTo(p.x, p.y)
          p = pr(segs[q + 2], yy + 0.003, segs[q + 3]); g.lineTo(p.x, p.y)
        }
        g.stroke()
      }
      // the picked maturity slice, and the picked strike line
      if (j === jPick) {
        const ya = lerp(Y[a], Y[e], fPick), yb = lerp(Y[b], Y[d], fPick), za = lerp(Zc[a], Zc[e], fPick)
        let p = pr(X[a], ya + 0.006, za); const x0 = p.x, y0 = p.y; p = pr(X[b], yb + 0.006, za)
        g.strokeStyle = '#B48CFF'; g.lineWidth = 2.4; g.shadowColor = 'rgba(180,140,255,0.9)'; g.shadowBlur = 6
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(p.x, p.y); g.stroke(); g.shadowBlur = 0
      }
      if (i === iPick) {
        const xa = lerp(X[a], X[b], gPick), ya = lerp(Y[a], Y[b], gPick), yb = lerp(Y[e], Y[d], gPick)
        let p = pr(xa, ya + 0.006, Zc[a]); const x0 = p.x, y0 = p.y; p = pr(xa, yb + 0.006, Zc[e])
        g.strokeStyle = 'rgba(255,240,214,0.85)'; g.lineWidth = 1.3
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(p.x, p.y); g.stroke()
      }
      drawBeadsFor(c, i, j)
    }
    g.shadowBlur = 0
    if (violators.length && violators.length < 1400) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.shadowColor = 'rgba(255,50,90,0.95)'; g.shadowBlur = 16; g.fillStyle = `rgba(255,40,80,${0.07 + 0.05 * pul})`
      g.beginPath()
      for (const c of violators) { const v = cell(c); g.moveTo(PX[v], PY[v]); g.lineTo(PX[v + 1], PY[v + 1]); g.lineTo(PX[v + NK + 1], PY[v + NK + 1]); g.lineTo(PX[v + NK], PY[v + NK]); g.closePath() }
      g.fill(); g.restore()
    }
    drawLabels()
    drawProbes()
  }

  // quote beads: synthetic quotes on a lattice, drawn in their cell's turn so the surface occludes them
  const beadMap = new Map<number, [number, number, number, number][]>()
  function rebuildBeads() {
    beadMap.clear()
    for (let m = 0; m < qT.length; m++) for (let q = 0; q < qk.length; q++) {
      const k = qk[q], T = qT[m], u = uOf(T)
      const i = Math.min(NK - 2, Math.floor(((k - K_MIN) / (K_MAX - K_MIN)) * (NK - 1))), j = Math.min(NT - 2, Math.floor(u * (NT - 1)))
      const c = j * (NK - 1) + i
      const arr = beadMap.get(c) ?? []; arr.push([k, T, q, m]); beadMap.set(c, arr)
    }
  }
  rebuildBeads()
  function drawBeadsFor(c: number, _i: number, _j: number) {
    const arr = beadMap.get(c)
    if (!arr) return
    for (const [k, T, q, m] of arr) {
      const s = ssviSigma(S.p, k, T) + (S.mode === 'flow' ? bumpAt(flowNow(), S.flow.session, T) : 0) + qNoise(q, m, k, tsec)
      const p = pr(xOfK(k), yOf(s) + 0.012, zOfU(uOf(T)))
      g.fillStyle = 'rgba(255,240,210,0.95)'; g.beginPath(); g.arc(p.x, p.y, 2.1, 0, 6.2832); g.fill()
      g.strokeStyle = 'rgba(255,225,170,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, 4.2, 0, 6.2832); g.stroke()
    }
  }

  const scaleTicks = () => { const span = S.sHi - S.sLo, step = span > 0.95 ? 0.2 : span > 0.45 ? 0.1 : 0.05; const t: number[] = []; for (let v = Math.ceil(S.sLo / step - 1e-6) * step; v <= S.sHi + 1e-6; v += step) t.push(+v.toFixed(3)); return t }
  function drawBackdrop() {
    // two back walls with a faint level grid
    const sx = cam.x > 0 ? -1 : 1, sz = cam.z > 0 ? -1 : 1
    const xw = sx * BW / 2, zw = sz * BD / 2
    g.save()
    g.fillStyle = 'rgba(40,24,86,0.22)'
    let a = prc(xw, 0, -zw), b = prc(xw, BH, -zw), c2 = prc(xw, BH, zw), d2 = prc(xw, 0, zw)
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c2.x, c2.y); g.lineTo(d2.x, d2.y); g.closePath(); g.fill()
    a = prc(-BW / 2, 0, zw); b = prc(-BW / 2, BH, zw); c2 = prc(BW / 2, BH, zw); d2 = prc(BW / 2, 0, zw)
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c2.x, c2.y); g.lineTo(d2.x, d2.y); g.closePath(); g.fill()
    g.strokeStyle = 'rgba(200,175,255,0.13)'; g.lineWidth = 0.7; g.beginPath()
    for (const t of scaleTicks()) {
      const y = yOf(t)
      let p = pr(xw, y, -zw); g.moveTo(p.x, p.y); p = pr(xw, y, zw); g.lineTo(p.x, p.y)
      p = pr(-BW / 2, y, zw); g.moveTo(p.x, p.y); p = pr(BW / 2, y, zw); g.lineTo(p.x, p.y)
    }
    for (let q = 0; q <= 9; q++) {
      const k = K_MIN + (q / 9) * (K_MAX - K_MIN)
      let p = pr(xOfK(k), 0, zw); g.moveTo(p.x, p.y); p = pr(xOfK(k), BH, zw); g.lineTo(p.x, p.y)
    }
    for (const m of MATS) {
      const z = zOfU(uOf(m.T))
      let p = pr(xw, 0, z); g.moveTo(p.x, p.y); p = pr(xw, BH, z); g.lineTo(p.x, p.y)
    }
    g.stroke(); g.restore()
  }
  function drawFloor() {
    g.save()
    const a = prc(-BW / 2, 0, -BD / 2), b = prc(BW / 2, 0, -BD / 2), c = prc(BW / 2, 0, BD / 2), d = prc(-BW / 2, 0, BD / 2)
    const pts = [[a.x, a.y], [b.x, b.y], [c.x, c.y], [d.x, d.y]]
    g.fillStyle = 'rgba(14,9,30,0.5)'; g.beginPath(); pts.forEach((p, n) => (n ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill()
    g.strokeStyle = 'rgba(200,175,255,0.2)'; g.lineWidth = 0.7; g.beginPath()
    for (let q = 0; q <= 9; q++) { const x = xOfK(K_MIN + (q / 9) * (K_MAX - K_MIN)); let p = pr(x, 0, -BD / 2); g.moveTo(p.x, p.y); p = pr(x, 0, BD / 2); g.lineTo(p.x, p.y) }
    for (const m of MATS) { const z = zOfU(uOf(m.T)); let p = pr(-BW / 2, 0, z); g.moveTo(p.x, p.y); p = pr(BW / 2, 0, z); g.lineTo(p.x, p.y) }
    g.stroke()
    g.strokeStyle = 'rgba(237,230,250,0.5)'; g.lineWidth = 1; g.beginPath(); pts.forEach((p, n) => (n ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke()
    g.restore()
  }
  function drawLabels() {
    g.save()
    g.font = `500 ${cw < 480 ? 9.5 : 10.5}px "IBM Plex Mono", ui-monospace, monospace`
    g.fillStyle = 'rgba(232,223,250,0.74)'; g.textBaseline = 'middle'
    const fz = cam.z > 0 ? 1 : -1, fx = cam.x > 0 ? 1 : -1
    const c0 = prc(0, 0, 0), eK = prc(0, 0, fz * BD / 2), eT = prc(fx * BW / 2, 0, 0)
    const unit = (a: { x: number; y: number }) => { const dx = a.x - c0.x, dy = a.y - c0.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l } }
    const dK = unit(eK), dT = unit(eT)
    const label = (txt: string, x: number, y: number, z: number, d: { x: number; y: number }, off: number, al: CanvasTextAlign = 'center') => {
      const p = pr(x, y, z); g.textAlign = al; g.fillText(txt, p.x + d.x * off, p.y + d.y * off)
    }
    for (let q = 0; q <= 4; q++) { const k = -0.4 + q * 0.2; if (k > K_MAX + 1e-9) break; label(sgn(k, 1), xOfK(k), 0, fz * BD / 2, dK, 14) }
    for (const m of MATS) label(m.l, fx * BW / 2, 0, zOfU(uOf(m.T)), dT, 16)
    // vol ticks on the leftmost vertical edge of the box (clear of the surface), with a halo for legibility
    let best = { x: 0, z: 0, px: 1e9 }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = pr(sx * BW / 2, 0, sz * BD / 2); if (p.x < best.px) best = { x: sx * BW / 2, z: sz * BD / 2, px: p.x } }
    g.textAlign = 'right'
    for (const t of scaleTicks()) { const p = pr(best.x, yOf(t), best.z); g.fillText(`${Math.round(t * 100)}%`, p.x - 9, p.y) }
    g.fillStyle = 'rgba(180,140,255,0.95)'; g.font = `600 ${cw < 480 ? 10 : 11}px "Archivo Variable", system-ui, sans-serif`
    { const p = pr(0, 0, fz * BD / 2); g.textAlign = 'center'; g.fillText('log-moneyness k', p.x + dK.x * 40, p.y + dK.y * 40 + 6) }
    label('maturity T', fx * BW / 2, 0, 0, dT, 44)
    { const p = pr(best.x, BH, best.z); g.textAlign = 'left'; g.fillText('implied vol \u03c3', Math.max(8, p.x - 34), p.y - 16) }
    g.restore()
  }
  function ring(x: number, y: number, r: number, col: string, w: number) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.stroke() }
  function drawProbes() {
    const mark = (k: number, u: number, pinned: boolean) => {
      const T = tOf(u), s = ssviSigma(S.p, k, T) + (S.mode === 'flow' ? bumpAt(flowNow(), S.flow.session, T) : 0)
      const x = xOfK(k), z = zOfU(u), y = yOf(s)
      const t = pr(x, y + 0.01, z), tx = t.x, ty = t.y, f = pr(x, 0, z)
      g.save()
      g.strokeStyle = pinned ? 'rgba(255,240,214,0.7)' : 'rgba(220,205,255,0.5)'; g.lineWidth = 1; g.setLineDash([3, 3])
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(f.x, f.y); g.stroke(); g.setLineDash([])
      ring(tx, ty, pinned ? 6 : 4.5, pinned ? '#FFF0D6' : '#EDE6FA', pinned ? 2 : 1.4)
      g.fillStyle = pinned ? '#FFF0D6' : '#B48CFF'; g.beginPath(); g.arc(tx, ty, pinned ? 2.4 : 1.8, 0, 6.2832); g.fill()
      g.restore()
    }
    mark(S.pickK, S.pickU, true)
    if (S.hover) mark(S.hover.k, S.hover.u, false)
  }

  // hover picking: nearest cell under the pointer, front to back
  function pickAt(mx: number, my: number): { k: number; u: number } | null {
    for (let n = nCell - 1; n >= 0; n--) {
      const c = order[n], j = (c / (NK - 1)) | 0, i = c - j * (NK - 1), a = j * NK + i, b = a + 1, d = a + NK + 1, e = a + NK
      const x0 = Math.min(PX[a], PX[b], PX[d], PX[e]), x1 = Math.max(PX[a], PX[b], PX[d], PX[e])
      if (mx < x0 || mx > x1) continue
      const y0 = Math.min(PY[a], PY[b], PY[d], PY[e]), y1 = Math.max(PY[a], PY[b], PY[d], PY[e])
      if (my < y0 || my > y1) continue
      // two triangles (a,b,d) and (a,d,e) with barycentric coordinates in grid space
      const tri = (p: number, q: number, r: number, ip: number[], iq: number[], ir: number[]) => {
        const den = (PY[q] - PY[r]) * (PX[p] - PX[r]) + (PX[r] - PX[q]) * (PY[p] - PY[r])
        if (Math.abs(den) < 1e-9) return null
        const l1 = ((PY[q] - PY[r]) * (mx - PX[r]) + (PX[r] - PX[q]) * (my - PY[r])) / den
        const l2 = ((PY[r] - PY[p]) * (mx - PX[r]) + (PX[p] - PX[r]) * (my - PY[r])) / den
        const l3 = 1 - l1 - l2
        if (l1 < -0.001 || l2 < -0.001 || l3 < -0.001) return null
        return { i: l1 * ip[0] + l2 * iq[0] + l3 * ir[0], j: l1 * ip[1] + l2 * iq[1] + l3 * ir[1] }
      }
      const r1 = tri(a, b, d, [i, j], [i + 1, j], [i + 1, j + 1]) ?? tri(a, d, e, [i, j], [i + 1, j + 1], [i, j + 1])
      if (r1) return { k: K_MIN + (r1.i / (NK - 1)) * (K_MAX - K_MIN), u: clamp(r1.j / (NT - 1), 0, 1) }
    }
    return null
  }

  // ------------------------------------------------------------------------------------------------ pointer: orbit, hover, pin
  let drag: null | { id: number; x: number; y: number; sx: number; sy: number; moved: number; touch: boolean; t: number } = null
  canvas.addEventListener('pointerdown', e => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0, touch: e.pointerType === 'touch', t: performance.now() }
    canvas.setPointerCapture(e.pointerId); S.vyaw = S.vpitch = 0; S.idleSince = tsec
  })
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top
    if (drag && drag.id === e.pointerId) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy)
      if (drag.moved > 5) {
        S.yaw -= dx * 0.0085; S.vyaw = -dx * 0.0085
        if (!drag.touch) { S.pitch = clamp(S.pitch + dy * 0.006, 0.12, 1.36); S.vpitch = dy * 0.006 }
        S.hover = null; tip.hidden = true; dirty = true; S.idleSince = tsec
        emitDrag('orbit', (((S.yaw / 6.2832) % 1) + 1) % 1)
      }
      return
    }
    hoverPt = { x: mx, y: my }; dirty = true
  })
  const endDrag = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return
    const wasClick = drag.moved < 6 && performance.now() - drag.t < 600
    drag = null
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    if (wasClick) {
      const r = canvas.getBoundingClientRect(), h = pickAt(e.clientX - r.left, e.clientY - r.top)
      if (h) { S.pickK = h.k; S.pickU = h.u; syncAll(); emitDrag('pick', (h.k - K_MIN) / (K_MAX - K_MIN)) }
    }
  }
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag)
  canvas.addEventListener('pointerleave', () => { hoverPt = null; S.hover = null; tip.hidden = true; dirty = true })
  canvas.addEventListener('dblclick', () => { S.yaw = 0.52; S.pitch = 0.5; dirty = true })
  canvas.addEventListener('keydown', e => {
    const k = e.key
    if (k === 'ArrowLeft') S.yaw += 0.09; else if (k === 'ArrowRight') S.yaw -= 0.09
    else if (k === 'ArrowUp') S.pitch = clamp(S.pitch + 0.06, 0.12, 1.36); else if (k === 'ArrowDown') S.pitch = clamp(S.pitch - 0.06, 0.12, 1.36)
    else return
    e.preventDefault(); S.idleSince = tsec; dirty = true; emitDrag('orbit', (((S.yaw / 6.2832) % 1) + 1) % 1)
  })
  let hoverPt: null | { x: number; y: number } = null

  // ------------------------------------------------------------------------------------------------ SVG panels
  const svgSmile = $<SVGSVGElement>('.vl-smile svg'), svgTerm = $<SVGSVGElement>('.vl-term svg')
  const svgPath = $<SVGSVGElement>('.vl-path svg'), svgFlow = $<SVGSVGElement>('.vl-flowbar svg'), svgBump = $<SVGSVGElement>('.vl-bump svg')
  const blackBody = $('.vl-black-body')
  const W = 380, Hh = 230, ML = 42, MR = 36, MT = 14, MB = 34
  const axisX = (v: number, a: number, b: number) => ML + ((v - a) / (b - a)) * (W - ML - MR)
  const axisY = (v: number, a: number, b: number) => Hh - MB - ((v - a) / (b - a)) * (Hh - MB - MT)
  const line = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')

  let smileGeom = { kLo: K_MIN, kHi: K_MAX, sLo: 0, sHi: 1 }
  function drawSmile() {
    const T = tOf(S.pickU), pt = $('.vl-pt-smile'); pt.textContent = `Smile at T = ${mat(T)}`
    const nq = 25, ks: number[] = [], qs: number[] = []
    const bump = (S.mode === 'flow' ? bumpAt(flowNow(), S.flow.session, T) : 0)
    for (let i = 0; i < nq; i++) { const k = K_MIN + 0.02 + (i / (nq - 1)) * (K_MAX - K_MIN - 0.04); ks.push(k); qs.push(ssviSigma(S.p, k, T) + bump + qNoise(i, 91, k, tsec) * 1.4) }
    const th = theta(S.p, T), fit = fitSlice(ks, qs, T, { theta: th * 0.92, rho: clamp(S.p.rho * 0.8, -0.9, 0.9), phi: phi(S.p, th) * 1.12 })
    const curve: [number, number][] = [], fitc: [number, number][] = []
    const N = 90; let lo = 9, hi = 0
    const sv: number[] = []
    for (let i = 0; i <= N; i++) { const k = kOf(i / N), s = ssviSigma(S.p, k, T) + bump; sv.push(s); lo = Math.min(lo, s); hi = Math.max(hi, s) }
    for (const q of qs) { lo = Math.min(lo, q); hi = Math.max(hi, q) }
    const sLo = Math.max(0, Math.floor((lo - 0.01) / 0.05) * 0.05), sHi = Math.ceil((hi + 0.01) / 0.05) * 0.05
    smileGeom = { kLo: K_MIN, kHi: K_MAX, sLo, sHi }
    for (let i = 0; i <= N; i++) { const k = kOf(i / N); curve.push([axisX(k, K_MIN, K_MAX), axisY(sv[i], sLo, sHi)]); fitc.push([axisX(k, K_MIN, K_MAX), axisY(sliceSigma(fit, k, T) + 0, sLo, sHi)]) }
    // butterfly-violating stretches of this slice
    let bad = ''
    let runStart = -1
    for (let i = 0; i <= N + 1; i++) {
      const isBad = i <= N && durrleman(S.p, kOf(i / N), T) < -1e-9
      if (isBad && runStart < 0) runStart = i
      if (!isBad && runStart >= 0) { const x0 = axisX(kOf(runStart / N), K_MIN, K_MAX), x1 = axisX(kOf(Math.min(i - 1, N) / N), K_MIN, K_MAX); bad += `<rect class="s-bad" x="${x0.toFixed(1)}" y="${MT}" width="${Math.max(2, x1 - x0).toFixed(1)}" height="${Hh - MT - MB}"/>`; runStart = -1 }
    }
    let grid = ''
    const sStep = sHi - sLo > 0.45 ? 0.1 : 0.05
    for (let v = Math.ceil(sLo / sStep - 1e-6) * sStep; v <= sHi + 1e-6; v += sStep) grid += `<line class="s-grid" x1="${ML}" x2="${W - MR}" y1="${axisY(v, sLo, sHi).toFixed(1)}" y2="${axisY(v, sLo, sHi).toFixed(1)}"/><text class="s-tick" x="${ML - 6}" y="${(axisY(v, sLo, sHi) + 3.5).toFixed(1)}" text-anchor="end">${Math.round(v * 100)}%</text>`
    for (let q = 0; q <= 4; q++) { const k = -0.4 + q * 0.2; grid += `<line class="s-grid v" x1="${axisX(k, K_MIN, K_MAX).toFixed(1)}" x2="${axisX(k, K_MIN, K_MAX).toFixed(1)}" y1="${MT}" y2="${Hh - MB}"/><text class="s-tick" x="${axisX(k, K_MIN, K_MAX).toFixed(1)}" y="${Hh - MB + 14}" text-anchor="middle">${sgn(k, 1)}</text>` }
    const dots = ks.map((k, i) => `<circle class="s-q" cx="${axisX(k, K_MIN, K_MAX).toFixed(1)}" cy="${axisY(qs[i], sLo, sHi).toFixed(1)}" r="2.4"/>`).join('')
    const px = axisX(S.pickK, K_MIN, K_MAX), ps = ssviSigma(S.p, S.pickK, T) + bump
    const hv = hoverK !== null ? `<line class="s-hov" x1="${axisX(hoverK, K_MIN, K_MAX).toFixed(1)}" x2="${axisX(hoverK, K_MIN, K_MAX).toFixed(1)}" y1="${MT}" y2="${Hh - MB}"/><text class="s-hovt" x="${Math.min(W - 70, axisX(hoverK, K_MIN, K_MAX) + 6).toFixed(1)}" y="${MT + 12}">k ${sgn(hoverK)} · ${pct(ssviSigma(S.p, hoverK, T) + bump)}</text>` : ''
    svgSmile.innerHTML = `${grid}${bad}<path class="s-fit" d="${line(fitc)}"/><path class="s-model" d="${line(curve)}"/>${dots}<line class="s-pick" x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${MT}" y2="${Hh - MB}"/><circle class="s-pickd" cx="${px.toFixed(1)}" cy="${axisY(ps, sLo, sHi).toFixed(1)}" r="4.2"/>${hv}<text class="s-ax" x="${W / 2}" y="${Hh - 3}" text-anchor="middle">log-moneyness k</text>`
    $('.vl-fit').textContent = `rms ${(fit.rmse * 100).toFixed(2)} vol pt`
  }
  let hoverK: number | null = null

  let termGeom = { sLo: 0, sHi: 1 }
  let hoverU: number | null = null
  function drawTerm() {
    const N = 80, atm: [number, number][] = [], sk: [number, number][] = []
    let lo = 9, hi = 0; const av: number[] = [], kv: number[] = []
    for (let i = 0; i <= N; i++) {
      const T = tOf(i / N), a = ssviSigma(S.p, 0, T) + (S.mode === 'flow' ? bumpAt(flowNow(), S.flow.session, T) : 0)
      av.push(a); lo = Math.min(lo, a); hi = Math.max(hi, a)
      kv.push(ssviSigma(S.p, -0.1, T) - ssviSigma(S.p, 0.1, T))
    }
    const sLo = Math.max(0, Math.floor((Math.min(lo, 0.12) - 0.01) / 0.05) * 0.05), sHi = Math.max(Math.ceil((hi + 0.02) / 0.05) * 0.05, sLo + 0.2)
    termGeom = { sLo, sHi }
    const kmax = Math.max(0.04, ...kv), kmin = Math.min(0, ...kv)
    for (let i = 0; i <= N; i++) { const x = axisX(i / N, 0, 1); atm.push([x, axisY(av[i], sLo, sHi)]); sk.push([x, axisY(kv[i], kmin, kmax * 1.1)]) }
    let grid = ''
    const sStep = sHi - sLo > 0.45 ? 0.1 : 0.05
    for (let v = Math.ceil(sLo / sStep - 1e-6) * sStep; v <= sHi + 1e-6; v += sStep) grid += `<line class="s-grid" x1="${ML}" x2="${W - MR}" y1="${axisY(v, sLo, sHi).toFixed(1)}" y2="${axisY(v, sLo, sHi).toFixed(1)}"/><text class="s-tick" x="${ML - 6}" y="${(axisY(v, sLo, sHi) + 3.5).toFixed(1)}" text-anchor="end">${Math.round(v * 100)}%</text>`
    for (const m of MATS) grid += `<line class="s-grid v" x1="${axisX(uOf(m.T), 0, 1).toFixed(1)}" x2="${axisX(uOf(m.T), 0, 1).toFixed(1)}" y1="${MT}" y2="${Hh - MB}"/><text class="s-tick" x="${axisX(uOf(m.T), 0, 1).toFixed(1)}" y="${Hh - MB + 14}" text-anchor="middle">${m.l}</text>`
    const px = axisX(S.pickU, 0, 1), T = tOf(S.pickU), a = ssviSigma(S.p, 0, T) + (S.mode === 'flow' ? bumpAt(flowNow(), S.flow.session, T) : 0)
    const hv = hoverU !== null ? `<line class="s-hov" x1="${axisX(hoverU, 0, 1).toFixed(1)}" x2="${axisX(hoverU, 0, 1).toFixed(1)}" y1="${MT}" y2="${Hh - MB}"/><text class="s-hovt" x="${Math.min(W - 90, axisX(hoverU, 0, 1) + 6).toFixed(1)}" y="${MT + 12}">${mat(tOf(hoverU))} · ATM ${pct(ssviSigma(S.p, 0, tOf(hoverU)))}</text>` : ''
    let rax = ''
    for (const v of [0, kmax * 1.1 / 2, kmax * 1.1]) rax += `<text class="s-tick s-rt" x="${W - MR + 6}" y="${(axisY(v, kmin, kmax * 1.1) + 3.5).toFixed(1)}">${(v * 100).toFixed(0)}${v > 0 && v === kmax * 1.1 ? ' pt' : ''}</text>`
    svgTerm.innerHTML = `${grid}${rax}<path class="s-skew" d="${line(sk)}"/><path class="s-model" d="${line(atm)}"/><line class="s-pick" x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${MT}" y2="${Hh - MB}"/><circle class="s-pickd" cx="${px.toFixed(1)}" cy="${axisY(a, sLo, sHi).toFixed(1)}" r="4.2"/>${hv}<text class="s-ax" x="${W / 2}" y="${Hh - 3}" text-anchor="middle">maturity T (log scale)</text>`
  }

  function drawBlack() {
    const T = tOf(S.pickU), k = S.pickK, K = FWD * Math.exp(k)
    const sig = ssviSigma(S.p, k, T) + (S.mode === 'flow' ? bumpAt(flowNow(), S.flow.session, T) : 0)
    const c = black76(FWD, K, T, sig, RATE, true), p = black76(FWD, K, T, sig, RATE, false)
    const D = Math.exp(-RATE * T), par = c.price - p.price - D * (FWD - K)
    const w = sig * sig * T
    blackBody.innerHTML = `
      <div class="vl-bk-head"><span>K <b>${K.toFixed(2)}</b></span><span>T <b>${mat(T)}</b></span><span>σ <b>${pct(sig, 2)}</b></span><span>w <b>${w.toFixed(5)}</b></span></div>
      <table class="vl-bk"><thead><tr><th></th><th>Call</th><th>Put</th></tr></thead><tbody>
        <tr><th>Price</th><td>${c.price.toFixed(3)}</td><td>${p.price.toFixed(3)}</td></tr>
        <tr><th>Delta</th><td>${sgn(c.delta, 4)}</td><td>${sgn(p.delta, 4)}</td></tr>
        <tr><th>Gamma</th><td colspan="2">${c.gamma.toFixed(5)}</td></tr>
        <tr><th>Vega / vol pt</th><td colspan="2">${(c.vega / 100).toFixed(4)}</td></tr>
      </tbody></table>
      <p class="vl-bk-foot">d<sub>1</sub> = ${sgn(c.d1, 3)}, d<sub>2</sub> = ${sgn(c.d2, 3)}. Parity C − P − D(F−K) = ${par.toExponential(1)}.</p>`
  }

  // ---- flow panels
  function flowTimeline() {
    // phase 0..1: path (0..0.5), close window and flow bar (0.5..0.64), sessions (0.64..1)
    const ph = S.flow.phase
    return { pathP: clamp(ph / 0.5, 0, 1), flowP: clamp((ph - 0.5) / 0.14, 0, 1), sessF: clamp((ph - 0.64) / 0.34, 0, 1) }
  }
  function drawFlow() {
    const f = S.flow, tl = S.flow.play || f.phase > 0 ? flowTimeline() : { pathP: 1, flowP: 1, sessF: 0 }
    const pathP = f.play ? tl.pathP : 1, flowP = f.play ? tl.flowP : 1
    const n = 78, pth = intradayPath(7, f.r, n)
    let lo = 0, hi = 0
    for (let i = 0; i <= n; i++) { lo = Math.min(lo, pth[i]); hi = Math.max(hi, pth[i]) }
    const pad = Math.max(0.006, (hi - lo) * 0.15); lo -= pad; hi += pad
    const upto = Math.floor(pathP * n)
    const pts: [number, number][] = []
    for (let i = 0; i <= upto; i++) pts.push([axisX(i / n, 0, 1), axisY(pth[i] * 100, lo * 100, hi * 100)])
    const full: [number, number][] = []
    for (let i = 0; i <= n; i++) full.push([axisX(i / n, 0, 1), axisY(pth[i] * 100, lo * 100, hi * 100)])
    let grid = ''
    const stp = hi - lo > 0.06 ? 2 : 1
    for (let v = Math.ceil(lo * 100 / stp) * stp; v <= hi * 100; v += stp) grid += `<line class="s-grid" x1="${ML}" x2="${W - MR}" y1="${axisY(v, lo * 100, hi * 100).toFixed(1)}" y2="${axisY(v, lo * 100, hi * 100).toFixed(1)}"/><text class="s-tick" x="${ML - 6}" y="${(axisY(v, lo * 100, hi * 100) + 3.5).toFixed(1)}" text-anchor="end">${v === 0 ? '0' : sgn(v, 0)}%</text>`
    const zeroY = axisY(0, lo * 100, hi * 100)
    const cw0 = axisX(75 / 78, 0, 1)
    for (const [i, lab] of [[0, '9:30'], [26, '12:00'], [52, '14:30'], [78, '16:00']] as const) grid += `<text class="s-tick" x="${axisX(i / 78, 0, 1).toFixed(1)}" y="${Hh - MB + 14}" text-anchor="${i === 0 ? 'start' : i === 78 ? 'end' : 'middle'}">${lab}</text>`
    const cur = pts[pts.length - 1] ?? [ML, zeroY]
    svgPath.innerHTML = `${grid}<rect class="s-win" x="${cw0.toFixed(1)}" y="${MT}" width="${(W - MR - cw0).toFixed(1)}" height="${Hh - MT - MB}"/><line class="s-zero" x1="${ML}" x2="${W - MR}" y1="${zeroY.toFixed(1)}" y2="${zeroY.toFixed(1)}"/><path class="s-ghost" d="${line(full)}"/><path class="s-model" d="${line(pts)}"/><circle class="s-pickd" cx="${cur[0].toFixed(1)}" cy="${cur[1].toFixed(1)}" r="4"/><text class="s-ax" x="${W / 2}" y="${Hh - 3}" text-anchor="middle">invented intraday path, ends at r = ${sgn(f.r * 100, 2)}%</text>`
    // closing flow bar
    const flow = flowNow(), L = f.L
    const span = [0.5, 1, 2, 4, 8].find(v => v >= Math.abs(flow) * 1.05) ?? 8 // axis half-width in $bn, steps with the flow
    const sc = (v: number) => ((v / span) * 0.5 + 0.5) * (W - ML - MR) + ML
    const cur2 = flow * flowP, x0 = sc(0), x1 = sc(cur2)
    let ax = ''
    const tk = span / 4
    for (let q = -4; q <= 4; q++) { const v = q * tk; ax += `<line class="s-grid v" x1="${sc(v).toFixed(1)}" x2="${sc(v).toFixed(1)}" y1="${MT + 30}" y2="${Hh - MB - 30}"/><text class="s-tick" x="${sc(v).toFixed(1)}" y="${Hh - MB - 14}" text-anchor="middle">${v === 0 ? '0' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(span < 4 ? 1 : 0)}</text>` }
    const barCol = flow >= 0 ? 'f-buy' : 'f-sell'
    svgFlow.innerHTML = `${ax}<rect class="f-bar ${barCol}" x="${Math.min(x0, x1).toFixed(1)}" y="${(MT + 52).toFixed(1)}" width="${Math.max(0.5, Math.abs(x1 - x0)).toFixed(1)}" height="46" rx="3"/><line class="s-zero" x1="${x0.toFixed(1)}" x2="${x0.toFixed(1)}" y1="${MT + 36}" y2="${MT + 114}"/><text class="s-big" x="${W / 2}" y="${MT + 22}" text-anchor="middle">${flow >= 0 ? 'buy' : 'sell'} $${Math.abs(cur2).toFixed(2)}bn into the close</text><text class="s-ax" x="${W / 2}" y="${Hh - 3}" text-anchor="middle">exposure in $bn, axis steps with the size</text>`
    $('.vl-formula').innerHTML = `<span>${sgn(L, 0).replace('+', '')} &times; ${sgn(L - 1, 0).replace('+', '')} &times; ${sgn(f.r * 100, 2)}% &times; $${f.aum.toFixed(1)}bn = <b>${sgn(flow, 2)} $bn</b></span>`
    // bump chart: per-session bars and the current atm 1w vol
    const peak = bumpPeak(flow), ses = f.play ? Math.round(tl.sessF * 6) : f.session
    const maxB = BUMP.max * 100
    let bars = '', ax2 = ''
    for (let v = 0; v <= 3; v++) ax2 += `<line class="s-grid" x1="${ML}" x2="${W - MR}" y1="${axisY(v, 0, maxB * 1.05).toFixed(1)}" y2="${axisY(v, 0, maxB * 1.05).toFixed(1)}"/><text class="s-tick" x="${ML - 6}" y="${(axisY(v, 0, maxB * 1.05) + 3.5).toFixed(1)}" text-anchor="end">${v}</text>`
    const bw = (W - ML - MR) / 7
    const curve: [number, number][] = []
    for (let s = 0; s <= 6; s++) {
      const v = peak * Math.exp(-s / BUMP.tau) * 100, x = ML + s * bw + bw * 0.14
      const on = s === ses
      bars += `<rect class="b-bar${on ? ' on' : ''}${s > ses && f.play ? ' dim' : ''}" x="${x.toFixed(1)}" y="${axisY(v, 0, maxB * 1.05).toFixed(1)}" width="${(bw * 0.72).toFixed(1)}" height="${Math.max(0.5, axisY(0, 0, maxB * 1.05) - axisY(v, 0, maxB * 1.05)).toFixed(1)}" rx="2"/><text class="s-tick" x="${(x + bw * 0.36).toFixed(1)}" y="${Hh - MB + 14}" text-anchor="middle">${s === 0 ? 'close' : 'T+' + s}</text>`
      curve.push([x + bw * 0.36, axisY(v, 0, maxB * 1.05)])
    }
    svgBump.innerHTML = `${ax2}${bars}<path class="s-model" d="${line(curve)}"/><text class="s-ax" x="${W / 2}" y="${Hh - 3}" text-anchor="middle">vol points added to the 1-week ATM</text>`
    const T1 = MATS[0].T, base = atmVol(S.p, T1), now = bumpAt(flow, ses, T1)
    $('.vl-bumpread').innerHTML = `<span>1W ATM vol ${pct(base, 2)} + <b>${(now * 100).toFixed(2)} pt</b> = ${pct(base + now, 2)}${ses === 0 ? ' at the close' : ` at T+${ses}`}</span>`
  }

  // panel hit areas: smile (strike), term (maturity)
  const hitSmile = $('[data-hit="smile"]'), hitTerm = $('[data-hit="term"]')
  const hitK = (e: PointerEvent) => { const r = hitSmile.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; return clamp(K_MIN + ((x - ML) / (W - ML - MR)) * (K_MAX - K_MIN), K_MIN, K_MAX) }
  const hitU = (e: PointerEvent) => { const r = hitTerm.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; return clamp((x - ML) / (W - ML - MR), 0, 1) }
  hitSmile.addEventListener('pointermove', e => { hoverK = hitK(e); panelsDirty = true; if (e.buttons) { S.pickK = hoverK; syncAll(); emitDrag('strike', (hoverK - K_MIN) / (K_MAX - K_MIN)) } })
  hitSmile.addEventListener('pointerleave', () => { hoverK = null; panelsDirty = true })
  hitSmile.addEventListener('pointerdown', e => { hitSmile.setPointerCapture(e.pointerId); S.pickK = hitK(e); syncAll(); emitDrag('strike', (S.pickK - K_MIN) / (K_MAX - K_MIN)) })
  hitTerm.addEventListener('pointermove', e => { hoverU = hitU(e); panelsDirty = true; if (e.buttons) { S.pickU = hoverU; syncAll(); emitDrag('maturity', S.pickU) } })
  hitTerm.addEventListener('pointerleave', () => { hoverU = null; panelsDirty = true })
  hitTerm.addEventListener('pointerdown', e => { hitTerm.setPointerCapture(e.pointerId); S.pickU = hitU(e); syncAll(); emitDrag('maturity', S.pickU) })

  function drawPanels() {
    if (S.mode === 'surface') { drawSmile(); drawTerm(); drawBlack() } else drawFlow()
  }

  // ------------------------------------------------------------------------------------------------ tooltip
  function updateHover() {
    if (!hoverPt || drag) { if (!hoverPt) { S.hover = null; tip.hidden = true } return }
    const h = pickAt(hoverPt.x, hoverPt.y)
    if (!h) { S.hover = null; tip.hidden = true; return }
    S.hover = { k: h.k, u: h.u, x: hoverPt.x, y: hoverPt.y }
    const T = tOf(h.u), s = ssviSigma(S.p, h.k, T) + (S.mode === 'flow' ? bumpAt(flowNow(), S.flow.session, T) : 0)
    tip.hidden = false
    tip.innerHTML = `<b>${pct(s, 1)}</b><span>k ${sgn(h.k)} &middot; K ${(FWD * Math.exp(h.k)).toFixed(1)}</span><span>T ${mat(T)}</span>`
    const tw = 150, x = clamp(hoverPt.x + 14, 4, cw - tw), y = clamp(hoverPt.y - 54, 4, ch - 56)
    tip.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`
  }

  // ------------------------------------------------------------------------------------------------ loop
  let panelClock = 0
  function update(dt: number) {
    // slider-driven preset tween
    if (S.tween) {
      const t = clamp((tsec - S.tween.t0) / S.tween.dur, 0, 1), e = t * t * (3 - 2 * t)
      for (const key of ['level', 'slope', 'rho', 'eta', 'gamma'] as const) S.p[key] = lerp(S.tween.from[key], S.tween.to[key], e)
      sliders.forEach(s => s.sync()); onParamsChanged()
      if (t >= 1) S.tween = null
    }
    // axis range easing
    const k = 1 - Math.exp(-dt * 7)
    if (Math.abs(S.sLo - S.tLo) > 1e-4 || Math.abs(S.sHi - S.tHi) > 1e-4) { S.sLo += (S.tLo - S.sLo) * k; S.sHi += (S.tHi - S.sHi) * k; dirty = true } else { S.sLo = S.tLo; S.sHi = S.tHi }
    // inertia and idle sway
    if (!drag) {
      if (Math.abs(S.vyaw) > 1e-4 || Math.abs(S.vpitch) > 1e-4) { S.yaw += S.vyaw; S.pitch = clamp(S.pitch + S.vpitch, 0.12, 1.36); S.vyaw *= 0.92; S.vpitch *= 0.92; dirty = true }
      else if (!reduced && tsec - S.idleSince > 3) { S.yaw += Math.cos(tsec * 0.18) * 0.0016; dirty = true }
    }
    // the flow timeline
    if (S.mode === 'flow' && S.flow.play && !reduced) {
      S.flow.phase += dt / 12
      if (S.flow.phase >= 1) { S.flow.hold += dt; if (S.flow.hold > 1.6) { S.flow.phase = 0; S.flow.hold = 0 } }
      const ses = Math.round(flowTimeline().sessF * 6)
      if (ses !== S.flow.session) { S.flow.session = ses; sliders.forEach(s => s.sync()); onParamsChanged() }
      panelsDirty = true
    }
  }
  function frame(ts: number) {
    if (disposed) return
    raf = requestAnimationFrame(frame)
    if (!visible || document.hidden) { last = ts; return }
    const idle = !drag && !S.tween && !hoverPt
    if (!reduced && idle && ts - last < 32) return
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts; tsec = ts / 1000
    update(dt)
    const anim = !reduced || dirty
    if (dirty || (!reduced && anim)) {
      if (cw > 10) { const t0 = performance.now(); setCam(); render(); updateHover(); dirty = false; lastRender = ts; renderMs += (performance.now() - t0 - renderMs) * 0.1 }
    }
    if (panelsDirty || (!reduced && ts - panelClock > 90)) { panelClock = ts; panelsDirty = false; drawPanels() }
  }
  let lastRender = 0, renderMs = 0
  const io = new IntersectionObserver(es => { visible = es[0]?.isIntersecting ?? true; if (visible) dirty = true }, { threshold: 0.01 })
  io.observe(root)

  // first paint
  syncPlay(); syncChips(); setMode('surface')
  onParamsChanged(); S.sLo = S.tLo; S.sHi = S.tHi
  resize(); drawPanels()
  raf = requestAnimationFrame(frame)

  return {
    stats: () => ({ renderMs }),
    dispose() {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      root.remove()
    },
  }
}
