// Thrift lab: the DESIGN of the field experiment, as a synthetic simulation. Pairs arrive at a store; each lands in a store / date / time block and
// is randomized inside it to "browse together" or "search separately". Press Arrive (or let it run) and the block grid and the balance table update.
// Switch to "Let pairs choose" to see the kind of imbalance randomizing is there to remove. No outcomes, no estimates and no counts from the
// manuscript appear here; every pair, covariate and tally is generated in your browser.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cue: lab:click on each arrival.
import './lib/model-base.css'
import './thrift.css'
import { animate } from 'animejs'
import { COVS, SLOTS, STORES, createExperiment, type Mode, type Pair } from './lib/model-thrift'
import { gate, sitePaused, type LabHandle, type LabOpts } from './lib/kit'

const MAXG = 6
const pct = (v: number) => Math.round(v * 100) + '%'
const glyph = (arm: string) => arm === 'together'
  ? '<svg viewBox="0 0 22 10" aria-hidden="true"><circle cx="6" cy="5" r="4"/><circle cx="16" cy="5" r="4"/><path d="M8 5h6"/></svg>'
  : '<svg viewBox="0 0 22 10" aria-hidden="true"><circle cx="3.5" cy="5" r="3"/><circle cx="18.5" cy="5" r="3"/></svg>'

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced, cue = gate(opts.emit, 70)
  host.innerHTML = ''
  const root = document.createElement('div'); root.className = 'ml th' + (reduced ? ' is-reduced' : ''); root.setAttribute('data-proof', 'skip')
  root.innerHTML = `
  <header class="ml-head">
    <div><span class="ml-kicker">Interactive model <span class="ml-sim" style="margin-left:8px">Simulation of the design</span></span><h3 class="ml-title">Who browses together? A coin decides</h3></div>
    <p class="ml-note" role="note">Press Arrive. Each synthetic pair lands in a block, then a slip drawn inside that block sends it to browse together or search apart. Design only: no outcomes here.</p>
  </header>
  <div class="ml-cols">
    <div>
      <section class="ml-p" aria-label="Arrivals">
        <div class="ml-row" style="margin-bottom:12px">
          <button class="ml-btn ml-btn--acc th-arrive" type="button">Arrive</button>
          <button class="ml-btn th-run" type="button" aria-pressed="false"></button>
          <button class="ml-btn th-reset" type="button">Reset</button>
          <span class="ml-mono th-count" aria-live="polite"></span>
        </div>
        <div class="th-card" aria-live="polite"><div class="th-pair"></div><div class="th-says"><span class="ml-lab" style="margin:0">Arriving pair</span><b class="th-line">Press Arrive</b><span class="ml-small th-cov"></span></div></div>
      </section>
      <section class="ml-p" aria-label="Blocks">
        <span class="ml-lab">Store x date x time blocks <span class="th-key"><i class="th-k th-k--t"></i>together <i class="th-k th-k--a"></i>apart</span></span>
        <div class="th-grid" role="table" aria-label="Pairs assigned in each block"></div>
      </section>
    </div>
    <div>
      <section class="ml-p" aria-label="How pairs are assigned">
        <span class="ml-lab">Assignment rule</span>
        <div class="ml-row th-modes" role="group" aria-label="Assignment rule"><button class="ml-chip" data-m="random" type="button">Randomize within block</button><button class="ml-chip" data-m="choose" type="button">Let pairs choose</button></div>
        <p class="ml-small th-rule" style="margin-top:10px"></p>
      </section>
      <section class="ml-p" aria-label="Balance table">
        <span class="ml-lab">Balance on baseline traits (synthetic)</span>
        <div class="th-bal"></div>
        <p class="ml-small th-bnote" style="margin-top:8px"></p>
      </section>
    </div>
  </div>`
  host.appendChild(root)
  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T
  const grid = $('.th-grid'), bal = $('.th-bal'), runBtn = $('.th-run'), card = $('.th-card')
  let mode: Mode = 'random', ex = createExperiment(11, mode), timer = 0, running = false, dead = false, seed = 11

  // grid
  const cells: HTMLElement[] = []
  const hdr = document.createElement('div'); hdr.className = 'th-row th-row--h'; hdr.innerHTML = '<span></span>' + SLOTS.map(s => `<span class="th-ch">${s}</span>`).join(''); grid.appendChild(hdr)
  STORES.forEach((s, si) => {
    const r = document.createElement('div'); r.className = 'th-row'; r.innerHTML = `<span class="th-rh">${s}</span>`
    SLOTS.forEach((_, ti) => { const c = document.createElement('div'); c.className = 'th-cell'; c.dataset.b = String(si * SLOTS.length + ti); r.appendChild(c); cells.push(c) })
    grid.appendChild(r)
  })
  // balance rows
  const brows = COVS.map(n => { const r = document.createElement('div'); r.className = 'th-br'; r.innerHTML = `<span class="th-bn">${n}</span><span class="th-bv ml-mono"></span><div class="th-bt" aria-hidden="true"><i class="th-band"></i><i class="th-dot"></i></div><b class="th-bs ml-mono"></b>`; bal.appendChild(r); return r })
  const head = document.createElement('div'); head.className = 'th-br th-br--h'; head.innerHTML = '<span></span><span class="ml-mono">together | apart</span><span class="ml-mono th-axl">gap, in standard units</span><span></span>'; bal.prepend(head)

  function paintCell(b: number, newest?: number) {
    const [t, a] = ex.blockCounts(b), c = cells[b], ps = ex.pairs.filter(p => p.block === b)
    const shown = ps.slice(-MAXG)
    c.innerHTML = shown.map(p => `<span class="th-g th-g--${p.arm === 'together' ? 't' : 'a'}${p.id === newest ? ' is-new' : ''}">${glyph(p.arm)}</span>`).join('') + (ps.length > MAXG ? `<span class="th-more">+${ps.length - MAXG}</span>` : '')
    c.setAttribute('aria-label', `${STORES[(b / SLOTS.length) | 0]}, ${SLOTS[b % SLOTS.length]}: ${t} together, ${a} apart`)
    c.classList.toggle('is-even', t === a && t > 0)
  }
  function paintBalance() {
    const rows = ex.balance(), [t, a] = ex.totals(), none = ex.pairs.length < 4
    rows.forEach((r, i) => {
      const el = brows[i], clamp = Math.max(-0.8, Math.min(0.8, r.smd)), off = Math.abs(r.smd) > 0.1
      ;(el.querySelector('.th-bv') as HTMLElement).textContent = none ? '--' : `${pct(r.pT)} | ${pct(r.pA)}`
      ;(el.querySelector('.th-dot') as HTMLElement).style.left = (50 + (clamp / 0.8) * 50).toFixed(1) + '%'
      ;(el.querySelector('.th-dot') as HTMLElement).classList.toggle('is-off', !none && off)
      const s = el.querySelector('.th-bs') as HTMLElement; s.textContent = none ? '' : (r.smd >= 0 ? '+' : '−') + Math.abs(r.smd).toFixed(2); s.classList.toggle('is-off', !none && off)
    })
    $('.th-count').textContent = `${ex.pairs.length} pairs  ·  ${t} together, ${a} apart`
    $('.th-bnote').textContent = mode === 'random' ? 'Dots sit near zero and drift closer as pairs accumulate; the shaded band is a gap of 0.1 or less.' : 'Pairs who pick for themselves differ from those who split up: dots are pushed outside the band, and more pairs do not fix it.'
  }
  function paintMode() {
    ;[...root.querySelectorAll<HTMLElement>('.th-modes .ml-chip')].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === mode)))
    $('.th-rule').textContent = mode === 'random' ? 'Each block holds one "together" slip and one "apart" slip. Pairs draw in turn, so the two groups stay within one pair of each other in every block, and chance alone decides who gets which.' : 'Here each pair picks for itself. In this made-up world, older pairs and pairs arriving by car prefer to stay together, so the groups differ before anything is bought.'
  }
  function showPair(p: Pair) {
    const line = $('.th-line'), pair = $('.th-pair')
    pair.innerHTML = `<span class="th-big th-big--${p.arm === 'together' ? 't' : 'a'}">${glyph(p.arm)}</span>`
    line.textContent = `${STORES[(p.block / SLOTS.length) | 0]}, ${SLOTS[p.block % SLOTS.length]}: ${p.arm === 'together' ? 'browse together' : 'search separately'}`
    $('.th-cov').textContent = p.cov.map((v, k) => (v ? '' : 'not ') + COVS[k].toLowerCase()).join('; ')
    card.classList.toggle('is-t', p.arm === 'together'); card.classList.toggle('is-a', p.arm === 'apart')
    if (!reduced) { animate(pair.firstElementChild as HTMLElement, { translateX: ['-120%', '0%'], opacity: [0, 1], duration: 380, ease: 'outCubic' }); animate(line, { opacity: [0, 1], translateY: [6, 0], duration: 320, delay: 160, ease: 'outCubic' }) }
  }
  function arrive(quiet = false) {
    const p = ex.arrive(); paintCell(p.block, p.id)
    if (!quiet) { showPair(p); cue('lab:click'); const c = cells[p.block]; if (!reduced) animate(c, { backgroundColor: ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.04)'], duration: 600, ease: 'outQuad' }) }
    paintBalance(); return p
  }
  function repaintAll() { cells.forEach((_, b) => paintCell(b)); paintBalance(); paintMode() }
  function reset(preseed: number) {
    seed += 7; ex = createExperiment(seed, mode); for (let i = 0; i < preseed; i++) ex.arrive()
    $('.th-line').textContent = 'Press Arrive'; $('.th-cov').textContent = ''; $('.th-pair').innerHTML = ''; card.classList.remove('is-t', 'is-a'); repaintAll()
  }
  const setRun = (on: boolean) => { running = on; runBtn.setAttribute('aria-pressed', String(on)); runBtn.textContent = reduced ? 'Add 10 pairs' : on ? 'Pause' : 'Let it run'; clearTimeout(timer); if (on && !reduced) tick() }
  function tick() { if (!running || dead) return; if (!sitePaused()) arrive(); timer = window.setTimeout(tick, 650) }

  root.addEventListener('click', e => {
    const t = e.target as HTMLElement
    if (t.closest('.th-arrive')) arrive()
    else if (t.closest('.th-run')) { if (reduced) { for (let i = 0; i < 9; i++) arrive(true); arrive() } else setRun(!running) }
    else if (t.closest('.th-reset')) { setRun(false); reset(0) }
    else { const m = t.closest<HTMLElement>('[data-m]'); if (m && m.dataset.m !== mode) { mode = m.dataset.m as Mode; setRun(false); reset(40) } }
  })
  const io = new IntersectionObserver(es => { if (!es[0].isIntersecting && running) setRun(false) }, { threshold: 0 }); io.observe(host)
  reset(14); setRun(false)
  return { dispose() { dead = true; clearTimeout(timer); io.disconnect(); host.innerHTML = '' } }
}
