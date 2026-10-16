// NotebookLM Study Loop lab: sources -> generated quiz cards -> answer -> spaced review.
// The visitor generates 3 cards from one public-domain source (a Metamorphoses fact set, SIMULATION content), answers each, rates how well
// they knew it, and watches the loop schedule them on a day axis. The real rule is kept: making an episode never marks a concept mastered;
// the script's own confidence estimate is capped at 2 of 3, and only the visitor's rating can reach 3 and retire a card from review.
// The intervals (1 / 3 / 7 days) are a SIMULATION, not the production schedule. Scrub the day slider to bring cards due, tap one to review it.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: evidence:flip (cards deal), count:tick (answer), brain:pulse (retired), lab:drag (day scrub).
import './notebooklm-study-loop.css'
import { animate } from 'motion'
import { esc, gate, type LabHandle, type LabOpts } from './lib/kit'
import { owner, shell } from './lib/prod-kit'

interface Card { id: number; q: string; opts: string[]; ok: number; conf: number; due: number | null; retired: boolean; seen: boolean }
const BANK: Omit<Card, 'id' | 'conf' | 'due' | 'retired' | 'seen'>[] = [
  { q: 'Who wrote the Metamorphoses?', opts: ['Ovid', 'Virgil', 'Homer'], ok: 0 },
  { q: 'Which language did Ovid write it in?', opts: ['Greek', 'Latin', 'French'], ok: 1 },
  { q: 'Daphne is turned into which tree?', opts: ['Olive', 'Oak', 'Laurel'], ok: 2 },
]
const SPAN = 10
const RATE = [{ k: 'Hardly', c: 1, d: 1 }, { k: 'Mostly', c: 2, d: 3 }, { k: 'Cold', c: 3, d: 0 }]

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cueFlip = gate(opts.emit, 100), cueTick = gate(opts.emit, 80), cuePulse = gate(opts.emit, 300), cueDrag = gate(opts.emit, 90)
  const own = owner()
  const sh = shell(host, 'pl-nb', { acc: '#f2b441', acc2: '#ffe0a3', glow: '242, 180, 65' },
    'Interactive model, Simulation', 'Sources in, cards out, review scheduled',
    'Simulation: one public-domain source and 3 sample cards. The intervals are illustrative, not the production schedule.',
    'Generate the cards, answer each, then rate how well you knew it. Only your own rating of "Cold" can retire a card; the script alone never gets past 2 of 3. Then scrub the day slider.')
  sh.body.innerHTML = `
  <ol class="nb-rail" aria-hidden="true"><li data-s="0">Source</li><li data-s="1">Cards</li><li data-s="2">Review</li></ol>
  <div class="nb-grid">
    <div class="nb-main pl-panel"></div>
    <div class="nb-board pl-panel">
      <div class="nb-boardhead"><span class="pl-lab">Review schedule</span><span class="pl-lab nb-day">Day 0</span></div>
      <div class="nb-axis" aria-label="Review schedule by day"><span class="nb-today"></span>${Array.from({ length: SPAN + 1 }, (_, i) => `<i class="nb-tick" style="left:${(i / SPAN) * 100}%"><em>${i}</em></i>`).join('')}<div class="nb-chips"></div></div>
      <label class="nb-scrub"><span class="pl-lab">Fast-forward the days</span><input class="nb-range" type="range" min="0" max="${SPAN}" step="1" value="0" aria-label="Fast-forward the days"></label>
      <p class="nb-ret pl-lab">Retired by your rating: <b class="nb-retn">0</b></p>
    </div>
  </div>`
  const q = <T extends Element>(s: string) => sh.root.querySelector<T>(s)!
  const main = q<HTMLElement>('.nb-main'), chips = q<HTMLElement>('.nb-chips'), range = q<HTMLInputElement>('.nb-range'), dayEl = q('.nb-day'), retn = q('.nb-retn')
  const steps = [...sh.root.querySelectorAll<HTMLElement>('.nb-rail li')]
  let cards: Card[] = [], queue: Card[] = [], day = 0, step = 0

  const setStep = (s: number) => { step = s; steps.forEach((li, i) => li.classList.toggle('on', i <= s)) }
  const dealIn = (els: ArrayLike<Element>, y = 14) => { if (!reduced) Array.from(els).forEach((el, i) => animate(el, { opacity: [0, 1], transform: [`translateY(${y}px)`, 'translateY(0px)'] }, { duration: 0.45, delay: i * 0.09, ease: [0.2, 0.9, 0.3, 1] })) }
  const dots = (n: number) => '<span class="nb-dots" aria-hidden="true">' + [1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}${i === 3 && n < 3 ? ' lock' : ''}"></i>`).join('') + '</span>'

  const renderBoard = () => {
    dayEl.textContent = `Day ${day}`
    q<HTMLElement>('.nb-today').style.left = `${(day / SPAN) * 100}%`
    const slot = new Map<number, number>()
    chips.innerHTML = ''
    cards.filter(c => c.due != null && !c.retired).forEach(c => {
      const row = slot.get(c.due!) ?? 0; slot.set(c.due!, row + 1)
      const b = document.createElement('button'); b.type = 'button'
      b.className = `nb-chip${c.due! <= day ? ' is-due' : ''}`; b.style.left = `${(c.due! / SPAN) * 100}%`; b.style.top = `${row * 34}px`
      b.innerHTML = `<b>${c.id + 1}</b>${dots(c.conf)}`; b.setAttribute('aria-label', `Card ${c.id + 1}, due day ${c.due}${c.due! <= day ? ', due now' : ''}`)
      b.addEventListener('click', () => { if (c.due! <= day) { queue = [c]; ask() } else flash(`Card ${c.id + 1} is not due yet. Move the slider to day ${c.due}.`) })
      chips.append(b)
    })
    chips.style.height = `${Math.max(1, ...slot.values()) * 34}px`
    retn.textContent = String(cards.filter(c => c.retired).length)
  }
  const flash = (s: string) => { const n = main.querySelector('.nb-msg'); if (n) n.textContent = s }

  const intro = () => {
    setStep(0)
    main.innerHTML = `<span class="pl-lab">Source &middot; public domain (Simulation)</span>
      <div class="nb-src"><b>Ovid, Metamorphoses</b><p>An epic of transformations, written in Latin. Gods and mortals change shape: a nymph becomes a tree, a boy becomes a flower.</p></div>
      <div class="nb-gate"><span class="pl-lab">Mastery gate</span><div class="nb-meter"><i class="nb-fill"></i><u class="nb-cap"><s>cap: 2 of 3</s></u></div></div>
      <button class="pl-btn nb-gen" type="button">Generate 3 quiz cards</button><p class="nb-msg">Making cards marks a concept as taught, never as mastered.</p>`
    q<HTMLButtonElement>('.nb-gen').addEventListener('click', () => {
      cueFlip('evidence:flip')
      cards = BANK.map((b, i) => ({ ...b, id: i, conf: 0, due: null, retired: false, seen: false })); queue = [...cards]
      const f = main.querySelector<HTMLElement>('.nb-fill')!; f.style.setProperty('--w', String(2 / 3)); f.classList.add('on')
      main.querySelector<HTMLElement>('.nb-msg')!.textContent = 'The script credits at most 2 of 3. The third notch is yours to give.'
      q<HTMLButtonElement>('.nb-gen').disabled = true
      own.timeout(ask, reduced ? 0 : 900)
    })
  }

  function ask() {
    const c = queue[0]
    if (!c) { setStep(2); main.innerHTML = `<span class="pl-lab">Loop scheduled</span><h4>The loop is set.</h4><p class="nb-sub">Move the day slider forward. Cards that come due light up; tap one to review it again. A wrong answer sends a card back to tomorrow.</p><button class="pl-btn nb-reset" type="button">Start over</button>`; q('.nb-reset').addEventListener('click', () => { cards = []; queue = []; day = 0; range.value = '0'; renderBoard(); intro() }); return }
    setStep(1)
    main.innerHTML = `<span class="pl-lab">Card ${c.id + 1} of ${cards.length}${c.seen ? ' &middot; review' : ''}</span><h4>${esc(c.q)}</h4>
      <div class="nb-opts">${c.opts.map((o, i) => `<button type="button" class="pl-btn nb-opt" data-i="${i}">${esc(o)}</button>`).join('')}</div><p class="nb-msg" aria-live="polite">Pick an answer.</p>`
    dealIn(main.querySelectorAll('.nb-opt'), 8)
    main.querySelectorAll<HTMLButtonElement>('.nb-opt').forEach(b => b.addEventListener('click', () => answer(c, +b.dataset.i!)))
  }
  function answer(c: Card, pick: number) {
    const right = pick === c.ok; cueTick('count:tick')
    main.querySelectorAll<HTMLButtonElement>('.nb-opt').forEach((b, i) => { b.disabled = true; b.classList.toggle('good', i === c.ok); b.classList.toggle('bad', i === pick && !right) })
    main.querySelector('.nb-msg')!.textContent = right ? 'Correct. How well did you know it?' : `Not quite: it is ${c.opts[c.ok]}. How well did you know it?`
    const r = document.createElement('div'); r.className = 'nb-rate'
    r.innerHTML = RATE.map((x, i) => `<button type="button" class="pl-btn" data-r="${i}">${x.k}</button>`).join(''); main.append(r); dealIn(r.children, 6)
    r.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.addEventListener('click', () => rate(c, right, RATE[+b.dataset.r!])))
  }
  function rate(c: Card, right: boolean, r: (typeof RATE)[number]) {
    c.seen = true; c.conf = right ? r.c : 1
    if (right && r.d === 0) { c.retired = true; c.due = null; cuePulse('brain:pulse') }
    else c.due = day + (right ? r.d : 1)
    queue.shift(); renderBoard()
    const note = c.retired ? 'Retired: your rating mastered it.' : `Back in ${c.due! - day} day${c.due! - day > 1 ? 's' : ''}${right ? '' : ' (a wrong answer overrides the rating)'}.`
    main.querySelector('.nb-msg')!.textContent = note
    own.timeout(ask, reduced ? 200 : 1100)
  }
  own.on(range, 'input', () => { day = +range.value; cueDrag('lab:drag', { value: day / SPAN }); renderBoard() })
  intro(); renderBoard()
  return { dispose() { own.dispose(); host.innerHTML = '' } }
}
