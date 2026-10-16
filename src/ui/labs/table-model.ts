// Table Model lab: "Simulation of the method". Deal a hand, pick or draw cards, and watch every option get priced.
// A Monte Carlo equity estimate (a Web Worker, streamed in batches so the page never blocks) against a chosen opponent range feeds the
// pot-odds math and the expected value of fold, call and raise. Everything here is invented: the opponent, the pot and the assumed fold rate.
// It says nothing about the extension's own results; the speed shown is this browser tab, not the extension.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cue: lab:click on a deal.
import './lib/model-base.css'
import './table-model.css'
import { animate, stagger } from 'animejs'
import { RANKS, SUIT_GLYPH, cardName, equityOf, equitySE, mulberryRng, priceOptions, rangeCombos, runEquity, type EquityTally } from './lib/model-equity'
import { esc, gate, type LabHandle, type LabOpts } from './lib/kit'

const RANGES: [string, number][] = [['Any hand', 1], ['Top 40%', 0.4], ['Top 15%', 0.15], ['Top 5%', 0.05]]
const BETS: [string, number][] = [['Checked to you', 0], ['1/3 pot', 1 / 3], ['1/2 pot', 0.5], ['3/4 pot', 0.75], ['Pot', 1]]
const TOTAL = 30000, BATCH = 3000
const red = (c: number) => (c & 3) === 1 || (c & 3) === 2
const cardHTML = (c: number) => `<b class="tm-r">${RANKS[c >> 2]}</b><i class="tm-s">${SUIT_GLYPH[c & 3]}</i>`
const card = (s: string) => RANKS.indexOf(s[0]) * 4 + 'shdc'.indexOf(s[1])
const fmt = (v: number) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1)

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced, cue = gate(opts.emit, 120)
  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'ml tm' + (reduced ? ' is-reduced' : '')
  root.setAttribute('data-proof', 'skip')

  // ---------------------------------------------------------------- state
  const st = { hero: [card('As'), card('Kd')] as number[], board: [card('Kh'), card('7c'), card('2d')] as number[], active: -1, range: 1, bet: 2, pot: 12, fold: 35 }
  let tally: EquityTally = { wins: 0, ties: 0, n: 0 }, running = false, ms = 0, jobId = 0, dead = false
  let worker: Worker | null = null, fbTimer = 0

  root.innerHTML = `
  <header class="ml-head">
    <div><span class="ml-kicker">Interactive model <span class="ml-sim" style="margin-left:8px">Simulation of the method</span></span><h3 class="ml-title">Price every action on a hand</h3></div>
    <p class="ml-note" role="note">Pick your cards or deal them, set the pot and the bet. The model plays out thousands of runouts against a range and prices fold, call and raise. The table is invented.</p>
  </header>
  <div class="ml-cols">
    <div>
      <section class="ml-p tm-felt" aria-label="Cards">
        <span class="ml-lab">Your hand</span>
        <div class="tm-slots tm-slots--hero"></div>
        <span class="ml-lab" style="margin-top:12px">Board <span class="tm-street"></span></span>
        <div class="tm-slots tm-slots--board"></div>
        <div class="ml-row" style="margin-top:12px">
          <button class="ml-btn ml-btn--acc" data-act="deal" type="button">Deal a hand</button>
          <button class="ml-btn" data-act="next" type="button">Next street</button>
          <button class="ml-btn" data-act="clear" type="button">Clear board</button>
        </div>
      </section>
      <section class="ml-p" aria-label="Card picker"><span class="ml-lab">Or tap a slot, then a card</span><div class="tm-pick" role="group" aria-label="Choose a card"></div>
        <div class="tm-two" role="group" aria-label="Choose a card in two steps">
          <span class="ml-lab">1. Suit</span><div class="tm-su-row"></div>
          <span class="ml-lab">2. Rank</span><div class="tm-rk-row"></div>
          <button class="ml-btn tm-rand" type="button" data-act="random">Random card</button>
        </div></section>
    </div>
    <div>
      <section class="ml-p" aria-label="Opponent and pot">
        <span class="ml-lab">Opponent plays</span>
        <div class="ml-row tm-ranges" role="group" aria-label="Opponent range"></div>
        <span class="ml-lab" style="margin-top:12px">Their action</span>
        <div class="ml-row tm-bets" role="group" aria-label="Opponent bet"></div>
        <label class="ml-sl" style="margin-top:12px"><span>Pot before their bet (big blinds)</span><output class="tm-potv"></output><input class="tm-pot" type="range" min="4" max="60" step="1"></label>
        <label class="ml-sl" style="margin-bottom:0"><span>Assumed: how often they fold to a raise</span><output class="tm-foldv"></output><input class="tm-fold" type="range" min="0" max="80" step="5"></label>
      </section>
      <section class="ml-p tm-eq" aria-live="polite" aria-label="Equity and pot odds">
        <div class="tm-eqtop"><div><span class="ml-lab">Your equity</span><div class="ml-big tm-eqv">--</div></div><div class="tm-eqmeta ml-mono"></div></div>
        <div class="tm-bar" aria-hidden="true"><i class="tm-ci"></i><i class="tm-fill"></i><i class="tm-need"><em></em></i></div>
        <p class="ml-small tm-odds"></p>
      </section>
      <section class="ml-p" aria-label="Expected value of each option">
        <span class="ml-lab">Expected value of each option (big blinds)</span>
        <div class="tm-ev"></div>
        <div class="tm-place"><span class="ml-lab" style="margin:0">Placard</span><b class="tm-best"></b></div>
        <p class="ml-small" style="margin-top:8px">Raise assumes the opponent folds as often as you set, and holds the same equity when called. A real engine narrows the range after every action.</p>
      </section>
    </div>
  </div>`
  host.appendChild(root)
  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T
  const heroEl = $('.tm-slots--hero'), boardEl = $('.tm-slots--board'), pickEl = $('.tm-pick')
  const slotEls: HTMLButtonElement[] = []
  for (let i = 0; i < 7; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tm-slot'; b.dataset.i = String(i)
    ;(i < 2 ? heroEl : boardEl).appendChild(b); slotEls.push(b)
  }
  const pickEls: HTMLButtonElement[] = []
  for (let s = 0; s < 4; s++) for (let r = 12; r >= 0; r--) {
    const c = r * 4 + s, b = document.createElement('button'); b.type = 'button'; b.className = 'tm-pc' + (red(c) ? ' is-red' : ''); b.dataset.c = String(c)
    b.setAttribute('aria-label', `${RANKS[r]} of ${['spades', 'hearts', 'diamonds', 'clubs'][s]}`); b.innerHTML = cardHTML(c); pickEl.appendChild(b); pickEls.push(b)
  }
  // touch: a two-step picker (a suit row, then a rank row, chips of at least 44px) in place of the 13 x 4 grid, plus a Random button
  const SUIT_NAME = ['spades', 'hearts', 'diamonds', 'clubs']
  let pickSuit = -1
  const suEl = $('.tm-su-row'), rkEl = $('.tm-rk-row')
  const suBtns: HTMLButtonElement[] = [], rkBtns: HTMLButtonElement[] = []
  for (let s = 0; s < 4; s++) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tm-su' + (s === 1 || s === 2 ? ' is-red' : ''); b.dataset.s = String(s); b.setAttribute('aria-label', SUIT_NAME[s]); b.setAttribute('aria-pressed', 'false'); b.textContent = SUIT_GLYPH[s]; suEl.appendChild(b); suBtns.push(b) }
  for (let r = 12; r >= 0; r--) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tm-rk'; b.dataset.r = String(r); b.textContent = RANKS[r]; rkEl.appendChild(b); rkBtns.push(b) }
  const rangeEl = $('.tm-ranges'), betEl = $('.tm-bets')
  RANGES.forEach(([n], k) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ml-chip'; b.textContent = n; b.dataset.k = String(k); rangeEl.appendChild(b) })
  BETS.forEach(([n], k) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ml-chip'; b.textContent = n; b.dataset.k = String(k); betEl.appendChild(b) })
  const potIn = $('.tm-pot') as unknown as HTMLInputElement, foldIn = $('.tm-fold') as unknown as HTMLInputElement
  potIn.value = String(st.pot); foldIn.value = String(st.fold)

  // ---------------------------------------------------------------- equity engine
  function effBoard() { let k = 0; while (k < st.board.length && st.board[k] >= 0) k++; return st.board.slice(0, k >= 5 ? 5 : k >= 4 ? 4 : k >= 3 ? 3 : 0) }
  function startWorker() {
    try { worker = new Worker(new URL('./lib/model-equity-worker.ts', import.meta.url), { type: 'module' }); worker.onmessage = e => onTally(e.data); worker.onerror = () => { worker?.terminate(); worker = null; recompute() } } catch { worker = null }
  }
  function onTally(m: { id: number; wins: number; ties: number; n: number; done: boolean; ms: number }) {
    if (m.id !== jobId || dead) return
    tally = { wins: m.wins, ties: m.ties, n: m.n }; running = !m.done; ms = m.ms; paint()
  }
  function recompute() {
    clearTimeout(fbTimer)
    const hero = st.hero.filter(c => c >= 0)
    jobId++; tally = { wins: 0, ties: 0, n: 0 }; ms = 0
    if (hero.length < 2) { running = false; paint(); return }
    const board = effBoard(), pct = RANGES[st.range][1], id = jobId
    running = true
    if (worker) { worker.postMessage({ id, hero, board, pct, total: TOTAL, batch: BATCH, seed: 1 + id }); paint(); return }
    // fallback: the same engine on the main thread, a small batch per timeout so input stays responsive
    const rng = mulberryRng(1 + id), combos = pct >= 1 ? null : rangeCombos(pct), t = { wins: 0, ties: 0, n: 0 }, t0 = performance.now()
    const step = () => { if (id !== jobId || dead) return; runEquity(hero, board, combos, 1500, rng, t); tally = { ...t }; ms = performance.now() - t0; running = t.n < TOTAL; paint(); if (running) fbTimer = window.setTimeout(step, 0) }
    step()
  }

  // ---------------------------------------------------------------- paint
  const eqv = $('.tm-eqv'), eqmeta = $('.tm-eqmeta'), fill = $('.tm-fill'), ci = $('.tm-ci'), needEl = $('.tm-need'), needLab = needEl.querySelector('em') as HTMLElement
  const oddsEl = $('.tm-odds'), evEl = $('.tm-ev'), bestEl = $('.tm-best'), streetEl = $('.tm-street')
  let shownEq = -1
  const rows = ['Fold', 'Call', 'Raise'].map(n => { const r = document.createElement('div'); r.className = 'tm-evr'; r.innerHTML = `<span class="tm-evn">${n}</span><div class="tm-evt"><i class="tm-evb"></i></div><b class="tm-evv ml-mono"></b>`; evEl.appendChild(r); return r })

  function paintSlots() {
    const sh = [...st.hero, ...st.board.concat([-1, -1, -1, -1, -1]).slice(0, 5)]
    const board = effBoard()
    slotEls.forEach((b, i) => {
      const c = i < 2 ? (st.hero[i] ?? -1) : (st.board[i - 2] ?? -1)
      b.className = 'tm-slot' + (c >= 0 ? ' is-card' + (red(c) ? ' is-red' : '') : '') + (st.active === i ? ' is-active' : '') + (i >= 2 && c >= 0 && i - 2 >= board.length ? ' is-idle' : '')
      b.innerHTML = c >= 0 ? cardHTML(c) : '<span class="tm-ph">' + (i < 2 ? '+' : i < 5 ? 'F' : i === 5 ? 'T' : 'R') + '</span>'
      b.setAttribute('aria-label', (i < 2 ? `Hole card ${i + 1}` : `Board card ${i - 1}`) + (c >= 0 ? `: ${cardName(c)}` : ': empty'))
    })
    void sh
    const used = new Set([...st.hero, ...st.board].filter(c => c >= 0))
    pickEls.forEach(b => { const c = +b.dataset.c!; b.disabled = used.has(c) && !(st.active >= 0 && (st.active < 2 ? st.hero[st.active] : st.board[st.active - 2]) === c) ; b.classList.toggle('is-used', used.has(c)) })
    suBtns.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.s! === pickSuit)))
    rkEl.classList.toggle('is-wait', pickSuit < 0)
    rkBtns.forEach(b => {
      const r = +b.dataset.r!, c = pickSuit < 0 ? -1 : r * 4 + pickSuit
      b.disabled = pickSuit < 0 || (used.has(c) && !(st.active >= 0 && (st.active < 2 ? st.hero[st.active] : st.board[st.active - 2]) === c))
      b.classList.toggle('is-red', pickSuit === 1 || pickSuit === 2)
      b.setAttribute('aria-label', pickSuit < 0 ? `${RANKS[r]}: pick a suit first` : `${RANKS[r]} of ${SUIT_NAME[pickSuit]}`)
    })
    streetEl.textContent = board.length === 0 ? '(preflop)' : board.length === 3 ? '(flop)' : board.length === 4 ? '(turn)' : '(river)'
  }
  function paint() {
    const eq = equityOf(tally), se = equitySE(tally), B = st.bet === 0 ? 0 : Math.round(st.pot * BETS[st.bet][1]), P = st.pot, f = st.fold / 100
    const ready = tally.n > 0
    eqv.textContent = ready ? (eq * 100).toFixed(1) + '%' : '--'
    eqmeta.innerHTML = ready ? `${tally.n.toLocaleString('en-US')} runouts<br>±${(se * 196).toFixed(1)} points<br>${running ? 'estimating…' : ms.toFixed(0) + ' ms in this tab'}` : st.hero.filter(c => c >= 0).length < 2 ? 'Pick two hole cards' : 'starting…'
    const lo = Math.max(0, eq - 1.96 * se), hi = Math.min(1, eq + 1.96 * se)
    fill.style.transform = `scaleX(${eq.toFixed(4)})`; ci.style.transform = `translateX(${(lo * 100).toFixed(2)}%) scaleX(${(hi - lo).toFixed(4)})`
    const px = priceOptions(eq, P, B, f)
    needEl.style.left = (px.need * 100).toFixed(2) + '%'; needEl.hidden = B === 0; needLab.textContent = `need ${(px.need * 100).toFixed(0)}%`
    oddsEl.innerHTML = B === 0 ? `Checked to you, so seeing more cards is free. A bet of ${px.R} would be the pot-sized question.` :
      `Pot odds: call ${B} to win ${P + B}. You need ${B} ÷ (${P} + 2×${B}) = <b>${(px.need * 100).toFixed(1)}%</b> equity to break even${ready ? `; you have <b>${(eq * 100).toFixed(1)}%</b>, so calling is ${eq >= px.need ? 'profitable' : 'a loser'} on its own.` : '.'}`
    const evs = [px.fold, px.call, px.raise], mx = Math.max(Math.abs(px.call), Math.abs(px.raise), P * 0.5, 1)
    const names = ['Fold', B === 0 ? 'Check' : `Call ${B}`, B === 0 ? `Bet ${px.R}` : `Raise to ${px.R}`]
    const bi = evs.indexOf(Math.max(...evs))
    rows.forEach((r, i) => {
      const v = ready ? evs[i] : 0, bar = r.querySelector('.tm-evb') as HTMLElement
      ;(r.querySelector('.tm-evn') as HTMLElement).textContent = names[i]
      ;(r.querySelector('.tm-evv') as HTMLElement).textContent = ready ? (i === 0 ? '0.0' : fmt(v)) : '--'
      const frac = Math.abs(v) / mx // the bar spans half the track: it starts at 50% (or left of it when negative) and scales by frac / 2
      bar.style.transform = `translateX(${(v >= 0 ? 50 : 50 - frac * 50).toFixed(2)}%) scaleX(${(frac / 2).toFixed(4)})`
      bar.classList.toggle('is-neg', v < 0); r.classList.toggle('is-best', ready && i === bi)
    })
    bestEl.textContent = ready ? `${names[bi]}  ·  ${bi === 0 ? 'EV 0.0' : 'EV ' + fmt(evs[bi])} bb` : '--'
    if (ready && shownEq !== bi && !reduced) { animate(bestEl, { scale: [0.94, 1], duration: 260, ease: 'outBack' }) }
    shownEq = bi
  }
  function paintControls() {
    ;[...rangeEl.children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === st.range)))
    ;[...betEl.children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === st.bet)))
    ;($('.tm-potv') as HTMLElement).textContent = String(st.pot) + ' bb'
    ;($('.tm-foldv') as HTMLElement).textContent = st.fold + '%'
  }

  // ---------------------------------------------------------------- interaction
  const used = () => new Set([...st.hero, ...st.board].filter(c => c >= 0))
  function freeCards(n: number) { const u = used(), out: number[] = []; while (out.length < n) { const c = (Math.random() * 52) | 0; if (!u.has(c) && !out.includes(c)) out.push(c) } return out }
  function changed(flash?: HTMLElement[]) {
    paintSlots(); paintControls(); recompute()
    if (flash && !reduced) animate(flash, { scale: [0.86, 1], opacity: [0.3, 1], duration: 320, delay: stagger(55), ease: 'outBack' })
  }
  /** the slot a picked card lands in: the active one, else the first empty hole card, else the next board card (-1 when the table is full) */
  function nextSlot() {
    let i = st.active
    if (i < 0) { i = st.hero.findIndex(x => x < 0); if (i < 0) { if (st.hero.length < 2) i = st.hero.length; else { const b = st.board.length; i = b < 5 ? 2 + b : -1 } } }
    return i
  }
  function placeCard(c: number) {
    const i = nextSlot()
    if (i < 0) return
    if (i < 2) { st.hero[i] = c } else { const bi = i - 2; if (bi > st.board.length) return; st.board[bi] = c }
    // advance to the next empty slot
    const nxt = (() => { for (let k = 0; k < 7; k++) { const v = k < 2 ? st.hero[k] ?? -1 : st.board[k - 2] ?? -1; if (v < 0 && (k < 2 || k - 2 === st.board.length)) return k } return -1 })()
    st.active = nxt; pickSuit = -1; changed([slotEls[i]])
  }
  root.addEventListener('click', e => {
    const t = e.target as HTMLElement, act = t.closest<HTMLElement>('[data-act]')?.dataset.act
    if (act === 'deal') { st.hero = [-1, -1]; st.board = []; const h = freeCards(2); st.hero = h; st.active = -1; cue('lab:click'); changed([slotEls[0], slotEls[1]]); return }
    if (act === 'next') {
      const b = effBoard(); const n = b.length === 0 ? 3 : b.length === 3 ? 4 : b.length === 4 ? 5 : 0
      if (!n) { st.board = []; changed(); return }
      const fresh = freeCards(n - b.length); st.board = b.concat(fresh); st.active = -1; cue('lab:click'); changed(slotEls.slice(2 + b.length, 2 + n)); return
    }
    if (act === 'clear') { st.board = []; st.active = -1; changed(); return }
    const slot = t.closest<HTMLElement>('.tm-slot')
    if (slot) { const i = +slot.dataset.i!; st.active = st.active === i ? -1 : i; paintSlots(); pickEl.scrollIntoView?.({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); return }
    const pc = t.closest<HTMLElement>('.tm-pc')
    if (pc && !(pc as HTMLButtonElement).disabled) { placeCard(+pc.dataset.c!); return }
    const su = t.closest<HTMLElement>('.tm-su')
    if (su) { pickSuit = pickSuit === +su.dataset.s! ? -1 : +su.dataset.s!; paintSlots(); return }
    const rk = t.closest<HTMLButtonElement>('.tm-rk')
    if (rk && !rk.disabled && pickSuit >= 0) { placeCard(+rk.dataset.r! * 4 + pickSuit); return }
    if (t.closest('[data-act="random"]')) { if (nextSlot() < 0) return; placeCard(freeCards(1)[0]); return }
    const ch = t.closest<HTMLElement>('.ml-chip')
    if (ch) { const k = +ch.dataset.k!; if (ch.parentElement === rangeEl) st.range = k; else st.bet = k; paintControls(); recompute(); paint() }
  })
  potIn.addEventListener('input', () => { st.pot = +potIn.value; paintControls(); paint() })
  foldIn.addEventListener('input', () => { st.fold = +foldIn.value; paintControls(); paint() })
  // pot and fold only reprice; they do not change equity

  startWorker(); paintSlots(); paintControls(); paint(); recompute()
  return { dispose() { dead = true; clearTimeout(fbTimer); worker?.terminate(); worker = null; host.innerHTML = '' } }
}
void esc
