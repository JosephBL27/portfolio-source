// ZETA lab: "Try the drill". A playable mental-math drill in the style of Zetamac (addition, subtraction, multiplication and division, with a
// visible countdown) that times every question the way the extension does, then files each one under a family (x7, /8, carry, borrow ...) and
// shows how long each family took. The visitor's own score and timings are theirs: they sit under "your run" inside data-proof="skip", and
// nothing is saved or sent. The only facts shown from the project are in src/data/projects.json (id "zeta"): the best strict score of 80
// (from 30), and the evidence gate: a family counts as weak only after 15 observations across 2 runs show it at least 1.2 times slower than its
// operation's median. Keyboard first: type the answer (it submits itself), Enter starts, Esc ends. On a coarse pointer a number pad appears.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: count:tick per correct answer, lab:click on start, hub:detent on the end.
import './lib/model-base.css'
import './zeta.css'
import { animate } from 'animejs'
import { esc, gate, type LabHandle, type LabOpts } from './lib/kit'

const BEST = 80, FROM = 30                    // best strict score, from the first logged run
const GATE_N = 15, GATE_RUNS = 2, GATE_X = 1.2
const FULL = 120                              // the drill the 80 belongs to, in seconds
type Op = 'add' | 'sub' | 'mul' | 'div'
interface Q { a: number; b: number; op: Op; text: string; ans: number; fam: string }
interface Obs { fam: string; op: Op; ms: number; run: number }
const OPN: Record<Op, string> = { add: 'Addition', sub: 'Subtraction', mul: 'Multiplication', div: 'Division' }
const ri = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1))
const median = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0 }

/** Zetamac's default ranges: a + b with both in 2..100, its reverse for subtraction, 2..12 times 2..100, and its reverse for division */
function nextQ(): Q {
  const op = (['add', 'sub', 'mul', 'div'] as Op[])[ri(0, 3)]
  if (op === 'add') { const a = ri(2, 100), b = ri(2, 100); return { a, b, op, text: `${a} + ${b}`, ans: a + b, fam: (a % 10) + (b % 10) >= 10 ? 'carry' : 'no carry' } }
  if (op === 'sub') { const a = ri(2, 100), b = ri(2, 100), s = a + b; return { a: s, b: a, op, text: `${s} − ${a}`, ans: b, fam: (s % 10) < (a % 10) ? 'borrow' : 'no borrow' } }
  if (op === 'mul') { const f = ri(2, 12), b = ri(2, 100); return { a: f, b, op, text: `${f} × ${b}`, ans: f * b, fam: `x${f}` } }
  const f = ri(2, 12), b = ri(2, 100); return { a: f * b, b: f, op, text: `${f * b} ÷ ${f}`, ans: b, fam: `/${f}` }
}
const opOfFam = (f: string): Op => f === 'carry' || f === 'no carry' ? 'add' : f === 'borrow' || f === 'no borrow' ? 'sub' : f[0] === 'x' ? 'mul' : 'div'

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced, cue = gate(opts.emit, 45), coarse = matchMedia('(pointer: coarse)').matches
  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'ml zt' + (reduced ? ' is-reduced' : '')
  root.setAttribute('data-proof', 'skip')
  root.innerHTML = `
  <header class="ml-head">
    <div><span class="ml-kicker">Interactive model <span class="ml-sim" style="margin-left:8px">Playable</span></span><h3 class="ml-title">Try the drill</h3></div>
    <p class="ml-note" role="note">A Zetamac-style drill that times each question and files it by family, as the extension does. Your run stays in this tab; nothing is saved or sent.</p>
  </header>
  <div class="ml-cols zt-cols">
    <section class="ml-p zt-play" aria-label="The drill">
      <div class="zt-top"><div class="zt-clock" aria-hidden="true"><b class="zt-t">${FULL}</b><span class="ml-lab">seconds</span></div><div class="zt-sc"><b class="zt-s">0</b><span class="ml-lab">correct</span></div></div>
      <div class="zt-bar" aria-hidden="true"><i></i></div>
      <div class="zt-stage" data-s="idle">
        <div class="zt-idle">
          <div class="ml-row zt-len" role="group" aria-label="Drill length"><button class="ml-chip" type="button" data-len="${FULL}" aria-pressed="true">${FULL} seconds</button><button class="ml-chip" type="button" data-len="30" aria-pressed="false">30 seconds</button></div>
          <button class="ml-btn ml-btn--acc zt-start" type="button">Start the drill <kbd>Enter</kbd></button>
          <p class="ml-small zt-rule">Type each answer; it submits itself. Esc ends the run.</p>
        </div>
        <div class="zt-run" hidden>
          <div class="zt-q" aria-live="off"><span class="zt-qt">&nbsp;</span><span class="zt-eq">=</span><input class="zt-in" type="text" inputmode="${coarse ? 'none' : 'numeric'}" pattern="[0-9]*" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Answer" maxlength="6"></div>
          <div class="zt-pad" ${coarse ? '' : 'hidden'}>${[7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => `<button type="button" class="zt-k" data-k="${n}">${n}</button>`).join('')}<button type="button" class="zt-k zt-k--s" data-k="end">End</button><button type="button" class="zt-k" data-k="0">0</button><button type="button" class="zt-k zt-k--s" data-k="del" aria-label="Delete">&#9003;</button></div>
        </div>
        <div class="zt-done" hidden>
          <span class="ml-lab">Your run</span>
          <div class="zt-big"><b class="zt-final">0</b><span>correct</span></div>
          <div class="zt-meter" role="img" aria-label="Your score against the best strict score"><div class="zt-mtr"><i class="zt-mf"></i><u class="zt-tg"><em></em></u></div></div>
          <p class="ml-small zt-vs"></p>
          <button class="ml-btn ml-btn--acc zt-again" type="button">Run it again</button>
        </div>
      </div>
      <p class="zt-sr" aria-live="polite" hidden></p>
    </section>
    <section class="ml-p zt-fam" aria-label="Time per family">
      <span class="ml-lab">Time per family <em>your run</em></span>
      <div class="zt-list" aria-live="polite"><p class="ml-small">Finish a run to see which families cost you time.</p></div>
      <div class="zt-gate"><span class="ml-lab">The evidence gate</span>
        <p class="ml-small">A family counts as weak only after <b>${GATE_N} observations across ${GATE_RUNS} runs</b> show it at least <b>${GATE_X} times</b> slower than its operation's median. One noisy run cannot redirect practice.</p>
        <p class="ml-small zt-runs"></p></div>
    </section>
  </div>`
  host.appendChild(root)
  const $ = <T extends Element>(s: string) => root.querySelector(s) as T
  const stage = $<HTMLElement>('.zt-stage'), idle = $<HTMLElement>('.zt-idle'), run = $<HTMLElement>('.zt-run'), done = $<HTMLElement>('.zt-done')
  const tEl = $('.zt-t'), sEl = $('.zt-s'), barI = $<HTMLElement>('.zt-bar i'), qt = $('.zt-qt'), inp = $<HTMLInputElement>('.zt-in')
  const list = $('.zt-list'), runsEl = $('.zt-runs'), sr = $<HTMLElement>('.zt-sr')
  const lenBtns = [...root.querySelectorAll<HTMLButtonElement>('.zt-len .ml-chip')]

  let len = FULL, running = false, endAt = 0, t0 = 0, tick = 0, q: Q | null = null, qStart = 0, score = 0, runNo = 0, dead = false
  let history: Obs[] = []          // every observation this tab has made, across runs; the gate reads it
  let cur: Obs[] = []
  const setState = (s: 'idle' | 'run' | 'done') => { stage.dataset.s = s; idle.hidden = s !== 'idle'; run.hidden = s !== 'run'; done.hidden = s !== 'done' }
  const fmtT = (ms: number) => String(Math.max(0, Math.ceil(ms / 1000)))

  function ask() { q = nextQ(); qt.textContent = q.text; inp.value = ''; qStart = performance.now() }
  function frame() {
    if (!running) return
    const left = endAt - performance.now()
    tEl.textContent = fmtT(left)
    barI.style.transform = `scaleX(${Math.max(0, left / (len * 1000)).toFixed(4)})`
    root.classList.toggle('is-late', left < 10000)
    if (left <= 0) { finish('time'); return }
    tick = requestAnimationFrame(frame)
  }
  function start() {
    if (running) return
    running = true; score = 0; cur = []; runNo++
    sEl.textContent = '0'; setState('run'); inp.disabled = false
    t0 = performance.now(); endAt = t0 + len * 1000
    cue('lab:click'); ask(); inp.focus({ preventScroll: true })
    cancelAnimationFrame(tick); tick = requestAnimationFrame(frame)
  }
  function finish(why: 'time' | 'esc') {
    if (!running) return
    running = false; cancelAnimationFrame(tick); inp.blur()
    history.push(...cur)
    setState('done')
    tEl.textContent = why === 'time' ? '0' : fmtT(endAt - performance.now()); barI.style.transform = `scaleX(${why === 'time' ? 0 : Math.max(0, (endAt - performance.now()) / (len * 1000))})`
    const finalEl = $('.zt-final'), vs = $('.zt-vs'), mf = $<HTMLElement>('.zt-mf'), tg = $<HTMLElement>('.zt-tg')
    const scale = Math.max(100, Math.ceil((score + 5) / 10) * 10), strict = len === FULL
    tg.style.left = `${(BEST / scale) * 100}%`; tg.hidden = !strict
    ;(tg.querySelector('em') as HTMLElement).textContent = `Best strict score ${BEST}, from ${FROM}`
    const set = (n: number) => { finalEl.textContent = String(Math.round(n)); mf.style.transform = `scaleX(${(Math.round(n) / scale).toFixed(4)})` }
    if (reduced) set(score); else { const o = { n: 0 }; animate(o, { n: score, duration: 650, ease: 'out(3)', onUpdate: () => set(o.n), onComplete: () => set(score) }) }
    vs.textContent = strict
      ? (score >= BEST ? `That reaches the best strict score of ${BEST}.` : `The target line is the best strict score of ${BEST}, up from ${FROM} on the first logged run. You are ${BEST - score} short of it.`)
      : `The ${BEST} line belongs to the ${FULL}-second drill, so a ${len}-second run is not compared with it.`
    sr.hidden = false; sr.textContent = `Run over. You answered ${score} correctly.`
    paintFamilies(); cue('hub:detent', { ch: 5 })
    queueMicrotask(() => $<HTMLButtonElement>('.zt-again').focus({ preventScroll: true }))
  }
  function check() {
    if (!running || !q || !inp.value) return
    if (inp.value === String(q.ans)) {
      const ms = performance.now() - qStart
      cur.push({ fam: q.fam, op: q.op, ms, run: runNo })
      score++; sEl.textContent = String(score); cue('count:tick')
      if (!reduced) animate(sEl, { scale: [1.25, 1], duration: 200, ease: 'out(3)' })
      ask()
    }
  }

  // ---- the family table: median time per family, set against its operation's median, behind the evidence gate
  function paintFamilies() {
    const byOp = new Map<Op, number[]>(), byFam = new Map<string, Obs[]>()
    for (const o of history) { (byOp.get(o.op) ?? byOp.set(o.op, []).get(o.op)!).push(o.ms); (byFam.get(o.fam) ?? byFam.set(o.fam, []).get(o.fam)!).push(o) }
    const rows = [...byFam.entries()].map(([fam, obs]) => {
      const op = opOfFam(fam), m = median(obs.map(o => o.ms)), om = median(byOp.get(op) ?? [m]), x = om ? m / om : 1
      const runsSeen = new Set(obs.map(o => o.run)).size, enough = obs.length >= GATE_N && runsSeen >= GATE_RUNS
      return { fam, op, n: obs.length, m, x, runsSeen, weak: enough && x >= GATE_X, enough }
    }).filter(r => r.n >= 1).sort((a, b) => b.x - a.x).slice(0, 8)
    if (!rows.length) { list.innerHTML = '<p class="ml-small">No answered questions yet.</p>'; return }
    const mx = Math.max(...rows.map(r => r.m))
    list.innerHTML = rows.map(r => {
      const slow = r.x >= GATE_X
      const tag = r.weak ? 'weak' : slow ? 'waiting' : 'ok'
      const why = r.weak ? `Weak: ${r.n} observations over ${r.runsSeen} runs` : slow ? `Slower, but the gate wants ${Math.max(0, GATE_N - r.n)} more observations and ${Math.max(0, GATE_RUNS - r.runsSeen)} more runs` : `${esc(OPN[r.op])}: in line`
      return `<div class="zt-fr is-${tag}"><b class="zt-fn">${esc(r.fam)}</b><div class="zt-ft"><i style="width:${(r.m / mx) * 100}%"></i></div><span class="zt-fm ml-mono">${(r.m / 1000).toFixed(1)} s</span><span class="zt-fx ml-mono">${r.x.toFixed(1)}x</span><em class="zt-fw">${why}</em></div>`
    }).join('')
    runsEl.textContent = `Runs this tab: ${runNo}. Observations: ${history.length}. Nothing counts as weak yet unless a family clears the gate.`
  }

  // ---- input
  inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, ''); check() })
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape' && running) { e.preventDefault(); e.stopPropagation(); finish('esc'); return }
    if (e.key === 'Enter' && stage.dataset.s === 'idle' && !(e.target as HTMLElement).closest('button')) { e.preventDefault(); start() }
  })
  root.addEventListener('click', e => {
    const t = e.target as HTMLElement
    if (t.closest('.zt-start, .zt-again')) { start(); return }
    const lb = t.closest<HTMLButtonElement>('.zt-len .ml-chip')
    if (lb) { len = +lb.dataset.len!; lenBtns.forEach(b => b.setAttribute('aria-pressed', String(b === lb))); tEl.textContent = String(len); barI.style.transform = 'scaleX(1)'; return }
    const k = t.closest<HTMLElement>('.zt-k')
    if (k) {
      const v = k.dataset.k!
      if (v === 'end') finish('esc')
      else if (v === 'del') inp.value = inp.value.slice(0, -1)
      else { inp.value += v; check() }
      return
    }
  })
  // a pad press must not steal focus from the answer box
  root.addEventListener('pointerdown', e => { if ((e.target as HTMLElement).closest('.zt-k')) e.preventDefault() })

  barI.style.transform = 'scaleX(1)'
  return { dispose() { dead = true; running = false; cancelAnimationFrame(tick); void dead; host.innerHTML = '' } }
}
