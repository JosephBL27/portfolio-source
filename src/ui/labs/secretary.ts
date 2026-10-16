// Secretary lab: twelve synthetic messages from four inboxes. Drag one into a lane, or run the triage: what needs action becomes one ranked
// list, anything with a date also gets a tentative "Maybe:" hold, a request seen in two apps is matched on a key and becomes one row.
// Simulation: every sender and subject is made up on purpose. Only the shape of the pipeline (four sources, four priority tiers, one list,
// tentative holds, four runs a day) comes from this project's entry in src/data/projects.json.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: lab:drag (an item lands), lab:fail (a drop is refused).
import './secretary.css'
import { animate } from 'animejs'
import { h, shell, clock, mover, dragCard, under, esc, type LabOpts } from './lib/sys-kit'
import { gate, onFirstView, sitePaused, type LabHandle } from './lib/kit'

interface Mail { id: string; src: number; from: string; subj: string; tier: 1 | 2 | 3 | 4; key: string; when?: { d: number; t: string } }
const SRC = ['Gmail', 'Outlook', 'iMessage', 'WhatsApp']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAIL: Mail[] = [
  { id: 'g1', src: 0, from: 'Example Office', subj: 'Sample form due Friday', tier: 1, key: 'form', when: { d: 4, t: '10:00' } },
  { id: 'g2', src: 0, from: 'Sample Store', subj: 'Weekly offers, sample only', tier: 4, key: 'offers' },
  { id: 'g3', src: 0, from: 'Example Teammate', subj: 'Can you send the sample slides?', tier: 2, key: 'slides' },
  { id: 'o1', src: 1, from: 'Example Office', subj: 'Reminder: sample form', tier: 1, key: 'form', when: { d: 4, t: '10:00' } },
  { id: 'o2', src: 1, from: 'Example Group', subj: 'Room change, Tuesday session', tier: 2, key: 'room', when: { d: 1, t: '15:00' } },
  { id: 'o3', src: 1, from: 'Example Library', subj: 'Sample notice, item due back', tier: 3, key: 'lib' },
  { id: 'i1', src: 2, from: 'Friend A', subj: 'Dinner Thursday?', tier: 3, key: 'dinner', when: { d: 3, t: '19:00' } },
  { id: 'i2', src: 2, from: 'Friend B', subj: 'Funny sample picture', tier: 4, key: 'pic' },
  { id: 'i3', src: 2, from: 'Example Manager', subj: 'Can you cover Saturday?', tier: 2, key: 'cover', when: { d: 5, t: '11:00' } },
  { id: 'w1', src: 3, from: 'Sample Club', subj: 'Meeting moved to Monday', tier: 2, key: 'club', when: { d: 0, t: '17:00' } },
  { id: 'w2', src: 3, from: 'Sample Club', subj: 'New photos in the group', tier: 4, key: 'photos' },
  { id: 'w3', src: 3, from: 'Example Teammate', subj: 'Slides ready yet?', tier: 2, key: 'slides' },
]
const TIERN = ['', 'P1 today', 'P2 this week', 'P3 when free', 'P4 no action']

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cue = gate(opts.emit, 120), cueFail = gate(opts.emit, 400)
  const ck = clock(reduced), move = mover(reduced)
  const { root, body, status, sr, q } = shell(host, 'sc', { kicker: 'Interactive model, one triage run', title: 'Four inboxes in, one list out', reduced, note: '<b>Simulation.</b> Every sender and subject is made up on purpose. Only the shape is real: four sources, four tiers, one list, tentative holds.' })
  body.innerHTML = `
  <div class="sc-top"><button type="button" class="sys-btn" data-a="run">Run triage</button><button type="button" class="sys-btn is-ghost" data-a="reset">Reset</button>
    <span class="sc-runs" aria-label="Four runs a day">${[1, 2, 3, 4].map(n => `<u data-n="${n}">${n}</u>`).join('')}<small>runs today</small></span></div>
  <div class="sc-grid">
    <section class="sc-inb" aria-label="Four inboxes">${SRC.map((s, i) => `<div class="sc-box sys-panel" data-src="${i}"><span class="sys-lbl">${s}</span><div class="sc-cards">${MAIL.filter(m => m.src === i).map(m => `<div class="sc-mail" data-id="${m.id}" tabindex="0" role="button" aria-label="${esc(m.subj)}. Drag to a lane, or press Enter to send it where the agent would"><small>${esc(m.from)}</small><b>${esc(m.subj)}</b></div>`).join('')}</div></div>`).join('')}</section>
    <section class="sc-lanes">
      <div class="sc-lane sys-panel" data-lane="act"><span class="sys-lbl">Action list, ranked</span><ol class="sc-list"><li class="is-empty">Drop a message here</li></ol></div>
      <div class="sc-lane sys-panel" data-lane="hold"><span class="sys-lbl">Calendar holds</span><div class="sc-cal">${DAYS.map((d, i) => `<div class="sc-day" data-d="${i}"><i>${d}</i><div class="sc-holds"></div></div>`).join('')}</div></div>
      <div class="sc-lane sys-panel" data-lane="skip"><span class="sys-lbl">No action</span><ul class="sc-skip"><li class="is-empty">Drop noise here</li></ul></div>
    </section>
  </div>
  <p class="sys-hint">Drag a message into a lane. The Secretary files each one by its own rules, so it will tell you when it would have chosen differently.</p>`
  const list = q('.sc-list'), skip = q('.sc-skip'), runB = q<HTMLButtonElement>('[data-a="run"]'), runs = Array.from(root.querySelectorAll<HTMLElement>('.sc-runs u'))
  const cards = new Map<string, HTMLElement>(MAIL.map(m => [m.id, q<HTMLElement>(`.sc-mail[data-id="${m.id}"]`)] as [string, HTMLElement]))
  const rowsByKey = new Map<string, HTMLElement>(), holdKeys = new Set<string>(), done = new Set<string>()
  let busy = false, runN = 0
  const say = (t: string) => { status.innerHTML = t; sr.textContent = status.textContent }
  const byId = (id: string) => MAIL.find(m => m.id === id)!

  const addRow = (m: Mail) => {
    if (list.querySelector('.is-empty')) list.innerHTML = ''
    const ex = rowsByKey.get(m.key)
    if (ex) { const n = ex.querySelectorAll('em u').length + 1; ex.querySelector('em')!.insertAdjacentHTML('beforeend', `<u>${SRC[m.src]}</u>`); ex.dataset.n = String(n); move(ex, { scale: [1.04, 1], duration: 360, ease: 'outBack' }); return 'merged' }
    const li = h('li', 'sc-row'); li.dataset.tier = String(m.tier); li.style.order = String(m.tier)
    li.innerHTML = `<b class="sc-t">P${m.tier}</b><span>${esc(m.subj)}</span><em><u>${SRC[m.src]}</u></em>`; list.append(li); rowsByKey.set(m.key, li)
    move(li, { opacity: [0, 1], x: [-14, 0], duration: 320, ease: 'outCubic' }); return 'new'
  }
  const addHold = (m: Mail) => {
    if (!m.when || holdKeys.has(m.key)) return false
    holdKeys.add(m.key)
    const el = h('div', 'sc-hold'); el.style.order = m.when.t.replace(':', ''); el.innerHTML = `<b>Maybe:</b> ${esc(m.subj)}<small>${m.when.t}</small>`
    root.querySelector(`.sc-day[data-d="${m.when.d}"] .sc-holds`)!.append(el); move(el, { opacity: [0, 1], scale: [0.7, 1], duration: 360, ease: 'outBack' }); return true
  }
  const addSkip = (m: Mail) => { if (skip.querySelector('.is-empty')) skip.innerHTML = ''; const li = h('li', '', m.subj); skip.append(li); move(li, { opacity: [0, 1], duration: 240 }) }
  const consume = (id: string) => { done.add(id); const c = cards.get(id)!; c.hidden = true; const n = root.querySelectorAll(`.sc-box[data-src="${byId(id).src}"] .sc-mail:not([hidden])`).length; root.querySelector(`.sc-box[data-src="${byId(id).src}"]`)!.classList.toggle('is-empty', n === 0) }
  const fly = async (id: string, to: Element) => {
    const c = cards.get(id)!
    if (!reduced) {
      const rr = root.getBoundingClientRect(), a = c.getBoundingClientRect(), b = to.getBoundingClientRect()
      const g = c.cloneNode(true) as HTMLElement; g.classList.add('sc-fly'); g.style.cssText = `left:${a.left - rr.left}px;top:${a.top - rr.top}px;width:${a.width}px;height:${a.height}px`; root.append(g)
      animate(g, { x: b.left + b.width / 2 - a.left - a.width / 2, y: b.top + 30 - a.top, scale: 0.55, opacity: [1, 0.2], duration: 520, ease: 'inOutCubic' })
      c.style.visibility = 'hidden'; await ck.wait(520); g.remove(); c.style.visibility = ''
    }
    consume(id)
  }
  const place = (m: Mail, lane: string): string => {
    cue('lab:drag')
    if (lane === 'skip') { addSkip(m); return m.tier < 4 ? `You skipped a <b>P${m.tier}</b> message. The Secretary would have kept it` : 'Filed as no action, as the Secretary would' }
    if (lane === 'hold') { const ok = addHold(m); return ok ? `Held <b>Maybe:</b> ${esc(m.subj)}. A hold only goes in tentatively` : 'Already held' }
    const r = addRow(m); const hold = m.when ? addHold(m) : false
    const note = m.tier === 4 ? ' It is P4, so the Secretary would have filed it as no action' : ''
    return `${r === 'merged' ? `Matched on a stable key: one row, <b>${SRC[m.src]}</b> added as a second source` : `Ranked as <b>P${m.tier}</b>, ${TIERN[m.tier].split(' ').slice(1).join(' ')}`}${hold ? ', and a tentative hold was added' : ''}.${note}`
  }
  const lanePick = (m: Mail) => (m.tier === 4 ? 'skip' : 'act')

  MAIL.forEach(m => {
    const c = cards.get(m.id)!
    dragCard(c, { reduced,
      onMove: (x, y) => root.querySelectorAll('.sc-lane').forEach(l => l.classList.toggle('is-hit', l === under(x, y, '.sc-lane'))),
      drop: (x, y) => {
        root.querySelectorAll('.sc-lane').forEach(l => l.classList.remove('is-hit'))
        if (busy) return false
        const lane = under(x, y, '.sc-lane')?.dataset.lane; if (!lane) return false
        if (lane === 'hold' && !m.when) { cueFail('lab:fail'); say(`<b>No date in that message</b>, so there is nothing to hold`); return false }
        say(place(m, lane)); consume(m.id)
      } })
    c.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); say(place(m, lanePick(m))); consume(m.id) } })
  })

  async function triage() {
    if (busy) return; busy = true; runB.disabled = true
    const todo = MAIL.filter(m => !done.has(m.id))
    if (!todo.length) { busy = false; runB.disabled = false; say('<b>Inbox is empty.</b> Reset to run it again'); return }
    runN = Math.min(4, runN + 1); runs.forEach((u, i) => u.classList.toggle('is-on', i < runN)); say(`<b>Run ${runN} of 4.</b> Reading four inboxes`)
    await Promise.all(todo.map(async (m, i) => {
      if (!await ck.wait(i * 150)) return
      const lane = lanePick(m)
      await fly(m.id, root.querySelector(`.sc-lane[data-lane="${lane}"]`)!); if (ck.dead) return
      place(m, lane)
    }))
    if (ck.dead) return
    const rows = list.querySelectorAll('.sc-row').length, holds = holdKeys.size
    say(`<b>One list.</b> ${rows} rows, ${holds} tentative holds. A request seen in two apps became one row`)
    busy = false; runB.disabled = false
  }
  function reset() {
    if (busy) return
    done.clear(); rowsByKey.clear(); holdKeys.clear(); runN = 0; runs.forEach(u => u.classList.remove('is-on'))
    list.innerHTML = '<li class="is-empty">Drop a message here</li>'; skip.innerHTML = '<li class="is-empty">Drop noise here</li>'
    root.querySelectorAll('.sc-holds').forEach(e => { e.innerHTML = '' }); cards.forEach(c => { c.hidden = false }); root.querySelectorAll('.sc-box').forEach(b => b.classList.remove('is-empty'))
    say('Reset. Drag a message, or press <b>Run triage</b>')
  }
  runB.addEventListener('click', triage)
  q('[data-a="reset"]').addEventListener('click', reset)
  say('Press <b>Run triage</b>, or drag a message into a lane')
  const off = onFirstView(root, () => { if (!reduced && !sitePaused() && !done.size) triage() }, 0.15)
  return { dispose() { ck.dispose(); off(); host.innerHTML = '' } }
}
