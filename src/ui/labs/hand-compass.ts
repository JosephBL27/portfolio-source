// Hand Compass lab: a drill table in miniature. Five example spots written for this page: a hand, a board and a price. Pick an action and lock it
// in; only then does the reference answer appear, with a grade from Best Move to Blunder, an EV-loss scale and a bar for what each option is worth.
// The grading is ILLUSTRATIVE. Draw equities are exact combinatorics (outs over unseen cards) and pot odds are exact; everything that needs an
// opponent model (fold rates, calling ranges, preflop tiers) is an assumed number, and the sheet says so with a HEURISTIC tag. There is no solver
// here: the real app's SOLVED grade comes from a solver the live demo does not run. All of it sits under data-proof="skip".
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: evidence:flip (cards dealt), lab:arb (a choice is picked), hub:button (locked in),
// brain:pulse (a Best Move).
import './lib/model-base.css'
import './hand-compass.css'
import { animate, spring, stagger } from 'animejs'
import { esc, gate, onFirstView, type LabHandle, type LabOpts } from './lib/kit'

type Cancelable = { cancel(): unknown }
type Tag = 'EXACT MATH' | 'HEURISTIC'
interface Opt { id: string; label: string; ev: number; tag: Tag }
interface Spot {
  street: 'Preflop' | 'Flop' | 'Turn' | 'River'
  name: string; hero: string[]; board: string[]; pos: string; vs: string
  pot: number; bet: number            // pot before the bet, and the bet you face (0 when it is checked to you or you act first)
  scene: string; need?: { call: number; pct: number; have: number; how: string }
  opts: Opt[]; lesson: string
}

const comb = (n: number, k: number) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r }
/** the chance that at least one of `outs` cards shows up in the next `draws` cards, from `unseen` unknown cards: exact */
const hitChance = (outs: number, unseen: number, draws: number) => 1 - comb(unseen - outs, draws) / comb(unseen, draws)
/** EV (chips, counting the pot share) of a bet or raise that gets a fold `f` of the time and is called otherwise, winning `eq` of the time then */
const aggressionEV = (win: number, risk: number, f: number, eq: number, called: number) => f * win + (1 - f) * (eq * called - risk)

// ---- spot 1: checked to you, top pair, a bet-size choice (assumed fold rates and calling-range equity)
const P1 = 6
const bet1 = (frac: number, f: number, eq: number) => aggressionEV(P1, P1 * frac, f, eq, P1 + 2 * P1 * frac)
// ---- spot 2: flush draw on the flop, facing a half-pot bet (exact equity; the raise uses an assumed fold rate)
const EQ2 = hitChance(9, 47, 2)
// ---- spot 3: open-ended straight draw on the turn, facing a three-quarter-pot bet (exact equity, one card to come)
const EQ3 = hitChance(8, 46, 1)
// ---- spot 5: bluff-catcher on the river facing a pot bet (assumed share of bluffs in his range)
const EQ5 = 0.4

const SPOTS: Spot[] = [
  {
    street: 'Flop', name: 'Top pair, checked to you', hero: ['As', 'Kd'], board: ['Ks', '7d', '2c'], pos: 'You, button', vs: 'Villain, big blind', pot: P1, bet: 0,
    scene: 'He checks. The board is dry and you hold top pair with the best kicker. How big do you bet, if at all?',
    opts: [
      { id: 'chk', label: 'Check', ev: 0.62 * P1, tag: 'HEURISTIC' },
      { id: 'b3', label: 'Bet 1/3 pot', ev: bet1(1 / 3, 0.28, 0.72), tag: 'HEURISTIC' },
      { id: 'b23', label: 'Bet 2/3 pot', ev: bet1(2 / 3, 0.4, 0.66), tag: 'HEURISTIC' },
      { id: 'bp', label: 'Bet pot', ev: bet1(1, 0.5, 0.6), tag: 'HEURISTIC' },
    ],
    lesson: 'On a dry board the hands that call you are mostly worse pairs and weak draws, so a bet earns from them. Checking gives away the pot for free. The gap between the bet sizes is small here, which is why two of them grade close to the best. The fold rates are assumed.',
  },
  {
    street: 'Flop', name: 'Flush draw facing a bet', hero: ['Qs', 'Js'], board: ['Kh', '7s', '3s'], pos: 'You, big blind', vs: 'Villain, button', pot: 8, bet: 4,
    scene: 'He bets half the pot. You hold a flush draw with two cards to come. Fold, call or raise?',
    need: { call: 4, pct: 4 / (8 + 4 + 4), have: EQ2, how: '9 clean outs of 47 unseen cards, two to come' },
    opts: [
      { id: 'fold', label: 'Fold', ev: 0, tag: 'EXACT MATH' },
      { id: 'call', label: 'Call 4', ev: EQ2 * 16 - 4, tag: 'EXACT MATH' },
      { id: 'raise', label: 'Raise to 12', ev: aggressionEV(8 + 4, 12, 0.22, 0.33, 32), tag: 'HEURISTIC' },
    ],
    lesson: 'You need a quarter of the final pot and a flush draw has a little over a third by the river, so a call is clearly worth more than a fold. A raise can come close if he folds often enough; that part rests on a fold rate this page assumes, so treat it as a rule of thumb.',
  },
  {
    street: 'Turn', name: 'Straight draw, one card left', hero: ['8c', '7d'], board: ['9d', '5s', '2c', 'Kh'], pos: 'You, big blind', vs: 'Villain, button', pot: 8, bet: 6,
    scene: 'He bets three quarters of the pot on the turn. You have an open-ended straight draw and one card to come.',
    need: { call: 6, pct: 6 / (8 + 6 + 6), have: EQ3, how: '8 outs of 46 unseen cards, one to come' },
    opts: [
      { id: 'fold', label: 'Fold', ev: 0, tag: 'EXACT MATH' },
      { id: 'call', label: 'Call 6', ev: EQ3 * 20 - 6, tag: 'EXACT MATH' },
      { id: 'raise', label: 'Raise to 18', ev: aggressionEV(8 + 6, 18, 0.3, 0.17, 44), tag: 'HEURISTIC' },
    ],
    lesson: 'With one card left the price is the whole question: you need about a third of the pot and hold under a fifth. Calling loses chips on average. The only thing that could fix it is extra money won on the river when you hit, and this page leaves that out, so the grade is a lesson and not a verdict.',
  },
  {
    street: 'Preflop', name: 'Folded to you on the button', hero: ['Kc', 'Qc'], board: [], pos: 'You, button', vs: 'Blinds behind', pot: 1.5, bet: 0,
    scene: 'Everyone folds to you. King-queen suited is a strong open from the button. What is your play?',
    opts: [
      { id: 'fold', label: 'Fold', ev: 0, tag: 'HEURISTIC' },
      { id: 'limp', label: 'Call 1', ev: 0.12, tag: 'HEURISTIC' },
      { id: 'r25', label: 'Raise to 2.5', ev: 0.52, tag: 'HEURISTIC' },
      { id: 'r35', label: 'Raise to 3.5', ev: 0.46, tag: 'HEURISTIC' },
    ],
    lesson: 'Suited broadway hands play well when you have the last move after the flop. Raising takes the initiative and often wins the blinds at once; folding throws away a profitable hand. These values come from a rule-of-thumb tier, not a solver, and are placeholders for the idea.',
  },
  {
    street: 'River', name: 'Bluff-catcher facing a pot bet', hero: ['Jc', '9d'], board: ['Jh', '8c', '4d', '2s', '3h'], pos: 'You, big blind', vs: 'Villain, button', pot: 10, bet: 10,
    scene: 'The river bricks and he bets the full pot. You hold top pair with a weak kicker. Your read: he bluffs about two in five of the time he bets here.',
    need: { call: 10, pct: 10 / 30, have: EQ5, how: 'your assumed read of how often he is bluffing' },
    opts: [
      { id: 'fold', label: 'Fold', ev: 0, tag: 'HEURISTIC' },
      { id: 'call', label: 'Call 10', ev: EQ5 * 30 - 10, tag: 'HEURISTIC' },
      { id: 'raise', label: 'Raise to 30', ev: aggressionEV(20, 30, 0.1, 0.0, 70), tag: 'HEURISTIC' },
    ],
    lesson: 'A pot-sized bet only needs to be wrong a third of the time for a call to break even. If your read of his bluffs is right, calling wins chips. If you think he never bluffs, folding is the answer, so the grade depends on the read. That is the point of the drill: to make the read explicit.',
  },
]

type Grade = { id: string; name: string; max: number; icon: string }
const GRADES: Grade[] = [
  { id: 'best', name: 'Best Move', max: 0.0001, icon: 'M3 8.5l3.2 3.2L13 4.8' },
  { id: 'good', name: 'Good', max: 0.04, icon: 'M3 8.5l3.2 3.2L13 4.8' },
  { id: 'inacc', name: 'Inaccuracy', max: 0.12, icon: 'M8 3v6M8 12v.5' },
  { id: 'mist', name: 'Mistake', max: 0.35, icon: 'M8 3v6M8 12v.5' },
  { id: 'blun', name: 'Blunder', max: Infinity, icon: 'M4 4l8 8M12 4l-8 8' },
]
const gradeOf = (lossFrac: number) => GRADES.findIndex(g => lossFrac <= g.max)
const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' } as Record<string, string>
const cardHTML = (c: string) => `<span class="hc-card ${c[1] === 'h' || c[1] === 'd' ? 'is-red' : ''}" role="img" aria-label="${c[0] === 'T' ? '10' : c[0]} of ${({ s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' } as Record<string, string>)[c[1]]}"><b>${c[0]}</b><i>${SUIT[c[1]]}</i></span>`
const num = (v: number) => (Math.abs(v) < 0.005 ? '0.0' : (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1))
const chips = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cue = gate(opts.emit, 80)
  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'ml hc' + (reduced ? ' is-reduced' : '')
  root.setAttribute('data-proof', 'skip')
  root.innerHTML = `
  <header class="ml-head">
    <div><span class="ml-kicker">Interactive model <span class="ml-sim" style="margin-left:8px">Illustration of the method</span></span><h3 class="ml-title">Deal a spot, commit, then see the grade</h3></div>
    <p class="ml-note" role="note">Five example spots written for this page. The answer stays hidden until you lock in a choice. Draw odds are exact; fold rates and ranges are assumed, and the grade says which is which. No solver runs here.</p>
  </header>
  <nav class="hc-rail" aria-label="Choose a spot"></nav>
  <div class="ml-cols hc-cols">
    <section class="hc-table" aria-label="The table">
      <div class="hc-felt" aria-hidden="true"></div>
      <div class="hc-vs"><span class="hc-who"></span><span class="hc-bet" hidden></span></div>
      <div class="hc-mid"><div class="hc-board" aria-label="Board"></div><p class="hc-pot"><span>Pot</span> <b></b></p></div>
      <div class="hc-me"><div class="hc-hand" aria-label="Your hand"></div><span class="hc-who hc-who--me"></span></div>
    </section>
    <section class="hc-side" aria-live="polite">
      <p class="hc-street"></p>
      <h4 class="hc-name"></h4>
      <p class="hc-scene"></p>
      <p class="hc-need" hidden></p>
      <div class="hc-acts" role="group" aria-label="Your action"></div>
      <div class="hc-lock-row"><button type="button" class="ml-btn ml-btn--acc hc-lock" disabled>Lock in my answer</button><span class="hc-hint">The reference answer is hidden until you do.</span></div>
      <div class="hc-sheet" hidden></div>
    </section>
  </div>
  <p class="ml-small hc-foot">Grades compare what each option is worth in chips and measure your loss against the pot: Best Move, Good, Inaccuracy, Mistake, Blunder. EXACT MATH means the numbers are counted from the cards and the price. HEURISTIC means a rule of thumb or an assumed opponent.</p>`
  host.append(root)
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T
  const rail = $('.hc-rail'), table = $('.hc-table'), vsWho = $('.hc-vs .hc-who'), vsBet = $('.hc-bet'), boardEl = $('.hc-board'), potB = $('.hc-pot b')
  const handEl = $('.hc-hand'), meWho = $('.hc-who--me'), street = $('.hc-street'), nameEl = $('.hc-name'), scene = $('.hc-scene'), need = $('.hc-need')
  const acts = $('.hc-acts'), lock = $<HTMLButtonElement>('.hc-lock'), hint = $('.hc-hint'), sheet = $('.hc-sheet')
  rail.innerHTML = SPOTS.map((s, k) => `<button type="button" class="ml-chip hc-tab" data-k="${k}" aria-label="Spot ${k + 1}: ${esc(s.name)}"><b>${k + 1}</b><span>${s.street}</span></button>`).join('')
  const tabs = Array.from(rail.querySelectorAll<HTMLButtonElement>('.hc-tab'))

  const live: Cancelable[] = []
  const play = (a: unknown) => { live.push(a as Cancelable); if (live.length > 24) live.shift(); return a }
  const stop = () => { for (const a of live.splice(0)) { try { a.cancel() } catch { /* done */ } } }

  let cur = 0, pick = -1, done = false
  const results: (number | null)[] = SPOTS.map(() => null)       // the grade index the visitor got on each spot

  function renderTabs() {
    tabs.forEach((t, k) => {
      t.setAttribute('aria-current', String(k === cur))
      const r = results[k]
      t.classList.toggle('is-done', r != null)
      t.dataset.grade = r == null ? '' : GRADES[r].id
    })
  }

  function deal(k: number, animateIn = true) {
    stop()
    cur = k; pick = -1; done = false
    const s = SPOTS[k]
    street.textContent = `${s.street} · ${s.pos} · ${s.vs}`
    nameEl.textContent = s.name
    scene.textContent = s.scene
    vsWho.textContent = s.vs
    meWho.textContent = s.pos
    potB.textContent = chips(s.pot + s.bet)
    vsBet.hidden = !s.bet
    vsBet.textContent = s.bet ? `bets ${chips(s.bet)}` : ''
    boardEl.innerHTML = Array.from({ length: 5 }, (_, i) => (s.board[i] ? cardHTML(s.board[i]) : `<span class="hc-card is-empty" aria-hidden="true"></span>`)).join('')
    handEl.innerHTML = s.hero.map(cardHTML).join('')
    if (s.need) {
      need.hidden = false
      need.innerHTML = `<span>Price</span> You must put in <b>${chips(s.need.call)}</b> to win <b>${chips(s.pot + 2 * s.bet)}</b>, so you need <b>${(s.need.pct * 100).toFixed(0)}%</b>. <span class="hc-need-q">Work out what your hand is worth before you commit.</span>`
    } else need.hidden = true
    acts.innerHTML = s.opts.map((o, i) => `<button type="button" class="ml-chip hc-act" data-i="${i}" aria-pressed="false">${esc(o.label)}</button>`).join('')
    lock.disabled = true; lock.hidden = false; hint.hidden = false
    sheet.hidden = true; sheet.innerHTML = ''
    renderTabs()
    if (animateIn && !reduced) {
      const cards = Array.from(table.querySelectorAll<HTMLElement>('.hc-card:not(.is-empty)'))
      play(animate(cards, { opacity: [0, 1], translateY: [-18, 0], rotateX: [70, 0], duration: 520, delay: stagger(60), ease: 'out(3)' }))
      play(animate(table.querySelector('.hc-pot')!, { opacity: [0, 1], scale: [0.85, 1], duration: 420, delay: 120, ease: 'out(3)' }))
      if (s.bet) play(animate(vsBet, { opacity: [0, 1], translateY: [-10, 0], duration: 420, delay: 340, ease: 'out(3)' }))
      cue('evidence:flip')
    }
  }

  function choose(i: number) {
    if (done) return
    pick = i
    acts.querySelectorAll<HTMLButtonElement>('.hc-act').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)))
    lock.disabled = false
    cue('lab:arb', { on: true })
  }

  function commit() {
    if (done || pick < 0) return
    done = true
    const s = SPOTS[cur]
    const evs = s.opts.map(o => o.ev), best = evs.indexOf(Math.max(...evs))
    const pool = s.pot + s.bet * 2 || s.pot + 1.5     // the size of the fight: pot plus his bet and your call, so losses read as a share of what was in play
    const loss = evs[best] - evs[pick], lossFrac = Math.max(0, loss) / pool
    const g = pick === best ? 0 : Math.max(1, gradeOf(lossFrac))
    results[cur] = g
    const tag: Tag = s.opts[pick].tag === 'EXACT MATH' && s.opts[best].tag === 'EXACT MATH' ? 'EXACT MATH' : 'HEURISTIC'
    const lo = Math.min(0, ...evs), hi = Math.max(0, ...evs), span = hi - lo || 1
    const zero = ((0 - lo) / span) * 100
    const rows = s.opts.map((o, i) => {
      const w = (Math.abs(o.ev) / span) * 100
      const left = o.ev >= 0 ? zero : zero - w
      return `<li class="hc-row${i === best ? ' is-best' : ''}${i === pick ? ' is-you' : ''}"><span class="hc-rl">${esc(o.label)}${i === best ? ' <em>reference</em>' : ''}${i === pick ? ' <em class="you">you</em>' : ''}</span>
        <span class="hc-bar"><i class="${o.ev >= 0 ? 'pos' : 'neg'}" style="left:${left.toFixed(1)}%;width:${w.toFixed(1)}%"></i><u style="left:${zero.toFixed(1)}%"></u></span>
        <span class="hc-rv">${num(o.ev)}</span></li>`
    }).join('')
    const scale = GRADES.map((x, i) => `<li class="${i === g ? 'is-on' : ''}" data-g="${x.id}"><span>${x.name}</span></li>`).join('')
    const detail = s.need
      ? `<p class="hc-eq">Price needs <b>${(s.need.pct * 100).toFixed(0)}%</b>. Your hand has <b>${(s.need.have * 100).toFixed(1)}%</b>: ${esc(s.need.how)}.</p>`
      : ''
    sheet.innerHTML = `
      <div class="hc-grade" data-g="${GRADES[g].id}">
        <span class="hc-gi" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="${GRADES[g].icon}"/></svg></span>
        <div><h5>${GRADES[g].name}</h5><p>${pick === best ? 'You picked the reference answer.' : `Reference answer: ${esc(s.opts[best].label)}. You gave up ${loss.toFixed(2)} chips.`}</p></div>
        <span class="hc-tag" data-t="${tag === 'EXACT MATH' ? 'exact' : 'heur'}">${tag}</span>
      </div>
      <ol class="hc-scale" aria-label="EV-loss scale">${scale}</ol>
      <div class="hc-evb"><p class="hc-evt">What each option is worth, in chips, against folding at zero</p><ul class="hc-rows">${rows}</ul></div>
      ${detail}
      <p class="hc-lesson">${esc(s.lesson)}</p>
      <div class="ml-row hc-next"><button type="button" class="ml-btn ml-btn--acc" data-act="next">${cur < SPOTS.length - 1 ? 'Deal the next spot' : 'Back to spot 1'}</button><button type="button" class="ml-btn" data-act="again">Replay this spot</button></div>`
    sheet.hidden = false
    lock.hidden = true; hint.hidden = true
    acts.querySelectorAll<HTMLButtonElement>('.hc-act').forEach((b, i) => { b.disabled = true; b.classList.toggle('is-best', i === best); b.classList.toggle('is-pick', i === pick) })
    renderTabs()
    cue('hub:button', { down: true })
    if (g === 0) cue('brain:pulse')
    if (!reduced) {
      play(animate(sheet, { opacity: [0, 1], translateY: [18, 0], duration: 460, ease: 'out(3)' }))
      play(animate(sheet.querySelectorAll('.hc-bar i'), { scaleX: [0, 1], duration: 620, delay: stagger(70, { start: 160 }), ease: 'out(3)' }))
      const on = sheet.querySelector('.hc-scale .is-on')
      if (on) play(animate(on, { scale: [0.8, 1], duration: 700, ease: spring({ duration: 560, bounce: 0.35 }) }))
    }
    sheet.scrollIntoView?.({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }

  const onClick = (e: Event) => {
    const t = e.target as Element
    const act = t.closest<HTMLButtonElement>('.hc-act')
    if (act && !act.disabled) { choose(Number(act.dataset.i)); return }
    const tab = t.closest<HTMLButtonElement>('.hc-tab')
    if (tab) { deal(Number(tab.dataset.k)); return }
    if (t.closest('.hc-lock')) { commit(); return }
    const nx = t.closest<HTMLButtonElement>('[data-act]')
    if (nx?.dataset.act === 'next') deal((cur + 1) % SPOTS.length)
    else if (nx?.dataset.act === 'again') deal(cur)
  }
  root.addEventListener('click', onClick)
  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const t = e.target as Element
    if (!root.contains(t)) return
    // the digit keys pick an action while focus is inside the lab; the case view keeps the arrow keys for the next work
    if (/^[1-6]$/.test(e.key) && !done && Number(e.key) <= SPOTS[cur].opts.length) { choose(Number(e.key) - 1); e.stopPropagation() }
    else if (e.key === 'Enter' && !done && pick >= 0 && t === lock) { /* the button handles it */ }
  }
  root.addEventListener('keydown', onKey)

  deal(0, false)
  // the first time the lab is seen, the first spot is dealt in front of the visitor (nothing moves again until they act)
  const cancelView = reduced ? () => {} : onFirstView(host, () => { if (pick < 0 && cur === 0) deal(0, true) }, 0.4)

  return {
    dispose() {
      cancelView(); stop()
      root.removeEventListener('click', onClick); root.removeEventListener('keydown', onKey)
      host.innerHTML = ''
    },
  }
}
