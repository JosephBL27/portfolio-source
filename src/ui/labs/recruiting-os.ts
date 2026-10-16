// Recruiting OS lab: the deadline board.
// Eight made-up programs ("Firm A" to "Firm H", SIMULATION, no real firms) sit in four stages. Drag a card to another stage (or focus it and
// press the arrow keys) and the board re-sorts by deadline; the timeline dots and the ticking "next deadline" countdown follow. Only programs
// still being watched or prepared count toward the next deadline, so moving a card to Applied hands the countdown to the next firm.
// Each deadline carries its source label, as in the real app: official, estimated or secondary.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: lab:drag (grab), hub:detent (drop), count:tick (countdown hands over).
import './recruiting-os.css'
import { animate } from 'motion'
import { clamp, esc, gate, type LabHandle, type LabOpts } from './lib/kit'
import { owner, shell } from './lib/prod-kit'

const STAGES = ['Watching', 'Preparing', 'Applied', 'Interview']
interface Prog { id: number; name: string; lane: string; days: number; src: 'official' | 'estimated' | 'secondary'; stage: number }
const PROGS: Prog[] = [
  { id: 0, name: 'Firm A', lane: 'Quant', days: 0.4, src: 'official', stage: 1 },
  { id: 1, name: 'Firm B', lane: 'IB', days: 2.3, src: 'official', stage: 0 },
  { id: 2, name: 'Firm C', lane: 'HF', days: 5.1, src: 'estimated', stage: 1 },
  { id: 3, name: 'Firm D', lane: 'PE', days: 9.6, src: 'secondary', stage: 0 },
  { id: 4, name: 'Firm E', lane: 'AM', days: 14.2, src: 'official', stage: 2 },
  { id: 5, name: 'Firm F', lane: 'Quant', days: 21.7, src: 'estimated', stage: 0 },
  { id: 6, name: 'Firm G', lane: 'IB', days: 33.4, src: 'secondary', stage: 3 },
  { id: 7, name: 'Firm H', lane: 'Other', days: 47.9, src: 'official', stage: 0 },
]
const AXIS = 56, DAY = 86400000
const p2 = (n: number) => String(n).padStart(2, '0')

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cueGrab = gate(opts.emit, 150), cueDrop = gate(opts.emit, 80), cueHand = gate(opts.emit, 200)
  const own = owner()
  const sh = shell(host, 'pl-ro', { acc: '#4fd1c5', acc2: '#b5f0ea', glow: '79, 209, 197' },
    'Interactive model, Simulation', 'The deadline board',
    'Simulation: eight made-up programs with generic names. Dates run from the moment you open this page.',
    'Drag a card to another stage, or focus one and press the arrow keys. The columns re-sort by deadline and the countdown moves to the next program you still have to act on.')
  const t0 = Date.now()
  sh.body.innerHTML = `
  <div class="ro-top pl-panel">
    <div class="ro-next" aria-live="off"><span class="pl-lab">Next deadline</span><b class="ro-who">Firm A</b><b class="ro-clock">0d 00:00:00</b><span class="ro-src pl-lab"></span></div>
    <div class="ro-line" aria-hidden="true"><span class="ro-now"></span>${PROGS.map(p => `<i class="ro-dot" data-id="${p.id}" style="left:${(Math.min(p.days, AXIS) / AXIS) * 100}%"></i>`).join('')}</div>
  </div>
  <div class="ro-cols">${STAGES.map((s, i) => `<section class="ro-col pl-panel" data-st="${i}" aria-label="${s}"><h4 class="pl-lab">${s}<b class="ro-n">0</b></h4><div class="ro-list"></div></section>`).join('')}</div>
  <p class="ro-msg pl-lab" aria-live="polite">&nbsp;</p>`
  const q = <T extends Element>(s: string) => sh.root.querySelector<T>(s)!
  const lists = [...sh.root.querySelectorAll<HTMLElement>('.ro-list')], cols = [...sh.root.querySelectorAll<HTMLElement>('.ro-col')]
  const msg = q('.ro-msg'), who = q('.ro-who'), clock = q('.ro-clock'), srcEl = q('.ro-src')
  const dots = new Map(PROGS.map(p => [p.id, sh.root.querySelector<HTMLElement>(`.ro-dot[data-id="${p.id}"]`)!]))
  const els = new Map<number, HTMLElement>()
  let dragging = -1, lastNext = -1

  PROGS.forEach(p => {
    const el = document.createElement('div'); el.className = 'ro-card'; el.tabIndex = 0; el.dataset.id = String(p.id)
    el.innerHTML = `<span class="ro-grip" aria-hidden="true">&#8942;&#8942;</span><div class="ro-body"><b>${esc(p.name)}</b><span class="ro-lane">${p.lane}</span><span class="ro-due"></span></div><em class="ro-tag ${p.src}">${p.src}</em>`
    el.setAttribute('aria-label', `${p.name}, ${p.lane}. Arrow keys move it between stages.`)
    els.set(p.id, el)
  })
  const dueText = (p: Prog) => { const d = p.days - (Date.now() - t0) / DAY; return d < 1 ? `closes in ${Math.max(0, Math.round(d * 24))}h` : `closes in ${Math.round(d)}d` }

  /** place every card in its column, sorted by deadline, animating from where it was (FLIP) */
  const layout = (animateIt = true) => {
    const before = new Map<number, DOMRect>(); els.forEach((el, id) => before.set(id, el.getBoundingClientRect()))
    STAGES.forEach((_, s) => {
      const inS = PROGS.filter(p => p.stage === s).sort((a, b) => a.days - b.days)
      lists[s].append(...inS.map(p => els.get(p.id)!)); cols[s].querySelector('.ro-n')!.textContent = String(inS.length)
    })
    PROGS.forEach(p => { const e = els.get(p.id)!; e.dataset.st = String(p.stage); dots.get(p.id)!.dataset.st = String(p.stage); e.querySelector('.ro-due')!.textContent = dueText(p) })
    if (animateIt && !reduced) els.forEach((el, id) => {
      if (id === dragging) return
      const a = before.get(id)!, b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top
      if (Math.abs(dx) + Math.abs(dy) > 1) animate(el, { transform: [`translate(${dx}px, ${dy}px)`, 'translate(0px, 0px)'] }, { duration: 0.45, ease: [0.2, 0.9, 0.3, 1] })
    })
    tick()
  }
  const nextDue = () => PROGS.filter(p => p.stage <= 1).sort((a, b) => a.days - b.days)[0]
  const tick = () => {
    const n = nextDue(), now = (Date.now() - t0) / DAY
    q<HTMLElement>('.ro-now').style.left = `${(clamp(now, 0, AXIS) / AXIS) * 100}%`
    if (!n) { who.textContent = 'All handled'; clock.textContent = '--'; srcEl.textContent = ''; return }
    const ms = Math.max(0, n.days * DAY - (Date.now() - t0)), s = Math.floor(ms / 1000)
    who.textContent = n.name; srcEl.textContent = `${n.lane} · ${n.src}`
    clock.textContent = `${Math.floor(s / 86400)}d ${p2(Math.floor(s / 3600) % 24)}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}`
    dots.forEach((d, id) => d.classList.toggle('is-next', id === n.id))
    if (n.id !== lastNext) { if (lastNext >= 0) { cueHand('count:tick'); if (!reduced) animate(q('.ro-next'), { transform: ['scale(1.025)', 'scale(1)'] }, { duration: 0.4, ease: [0.2, 0.9, 0.3, 1] }) } lastNext = n.id }
  }
  const move = (p: Prog, st: number, how: string) => {
    if (st === p.stage || st < 0 || st >= STAGES.length) return
    p.stage = st; cueDrop('hub:detent'); layout(true)
    const n = nextDue(); msg.textContent = `${p.name} moved to ${STAGES[st]}. ${n ? `Next deadline: ${n.name}.` : 'Nothing left to act on.'}${how}`
  }

  // ---- drag (mouse anywhere on a card; touch from the grip so the page still scrolls) ----
  let drag: { p: Prog; el: HTMLElement; sx: number; sy: number; on: boolean; pid: number } | null = null
  const colAt = (x: number, y: number) => cols.findIndex(c => { const r = c.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top - 20 && y <= r.bottom + 20 })
  own.on(sh.root, 'pointerdown', (e: PointerEvent) => {
    const el = (e.target as Element).closest<HTMLElement>('.ro-card'); if (!el || e.button > 0) return
    if (e.pointerType === 'touch' && !(e.target as Element).closest('.ro-grip')) return
    drag = { p: PROGS[+el.dataset.id!], el, sx: e.clientX, sy: e.clientY, on: false, pid: e.pointerId }
  })
  own.on(window, 'pointermove', (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pid) return
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy
    if (!drag.on) { if (Math.hypot(dx, dy) < 5) return; drag.on = true; dragging = drag.p.id; drag.el.classList.add('is-drag'); try { drag.el.setPointerCapture(e.pointerId) } catch { /* ok */ } cueGrab('lab:drag', { value: 0.5 }) }
    drag.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${clamp(dx / 40, -4, 4)}deg)`
    const c = colAt(e.clientX, e.clientY); cols.forEach((x, i) => x.classList.toggle('is-over', i === c && c !== drag!.p.stage))
    dots.get(drag.p.id)!.classList.add('is-pick')
  })
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pid) return
    const d = drag; drag = null
    if (!d.on) return
    dragging = -1; d.el.classList.remove('is-drag'); cols.forEach(x => x.classList.remove('is-over')); dots.get(d.p.id)!.classList.remove('is-pick')
    const target = e.type === 'pointercancel' ? -1 : colAt(e.clientX, e.clientY)
    // settle from where the card was dropped: put it in its new place and animate the leftover offset away
    const r0 = d.el.getBoundingClientRect(); d.el.style.transform = ''
    if (target >= 0 && target !== d.p.stage) { d.p.stage = target; cueDrop('hub:detent'); const n = nextDue(); msg.textContent = `${d.p.name} moved to ${STAGES[target]}. ${n ? `Next deadline: ${n.name}.` : 'Nothing left to act on.'}` }
    layout(true)
    const r1 = d.el.getBoundingClientRect()
    if (!reduced) animate(d.el, { transform: [`translate(${r0.left - r1.left}px, ${r0.top - r1.top}px)`, 'translate(0px, 0px)'] }, { duration: 0.4, ease: [0.2, 0.9, 0.3, 1] })
  }
  own.on(window, 'pointerup', end); own.on(window, 'pointercancel', end)
  own.on(sh.root, 'keydown', (e: KeyboardEvent) => {
    const el = (e.target as Element).closest<HTMLElement>('.ro-card'); if (!el) return
    const p = PROGS[+el.dataset.id!]
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); move(p, p.stage + (e.key === 'ArrowRight' ? 1 : -1), ''); els.get(p.id)!.focus({ preventScroll: true }) }
  })
  own.on(sh.root, 'dragstart', (e: Event) => e.preventDefault())
  layout(false)
  own.interval(() => { if (!document.hidden) { tick(); els.forEach((el, id) => { el.querySelector('.ro-due')!.textContent = dueText(PROGS[id]) }) } }, 1000)
  return { dispose() { own.dispose(); host.innerHTML = '' } }
}
