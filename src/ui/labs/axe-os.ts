// AXE_OS lab: a task goes in, gets a depth (R0 to R4), and walks the gates that depth owes: research first, an acquisition check, an attempt
// guarded by the retry breaker, an independent check, and the evidence written back. Simulation: the classifier here is a small keyword scorer,
// the gate names and the "two identical failures" rule come from this project's entry in src/data/projects.json. No real policy or note names.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: lab:drag (a gate lands), lab:fail (breaker trips).
import './axe-os.css'
import { h, shell, clock, mover, scramble, esc, type LabOpts } from './lib/sys-kit'
import { gate, onFirstView, sitePaused, type LabHandle } from './lib/kit'

const LEVELS = [
  { r: 'R0', name: 'Reflex', line: 'One reversible edit. Just do it.' },
  { r: 'R1', name: 'Quick', line: 'Small and local. A quick look first.' },
  { r: 'R2', name: 'Standard', line: 'A real feature. Compare options first.' },
  { r: 'R3', name: 'Foundational', line: 'New dependency or structure. Full gates.' },
  { r: 'R4', name: 'High stakes', line: 'Hard to undo. An owner rules before it ships.' },
]
const SIGNALS: [number, RegExp, string][] = [
  [4, /\b(production|prod|migrat\w*|delete|drop|credential\w*|secret\w*|token\w*|payment\w*|irreversible|permission\w*|auth\w*)\b/i, 'hard to undo'],
  [3, /\b(framework|dependenc\w*|librar\w*|package|integrat\w*|architect\w*|foundation\w*|from scratch|agent|infrastructure|new service)\b/i, 'new structure'],
  [2, /\b(feature|build|add|design|refactor|api|dashboard|workflow|page|component)\b/i, 'real feature'],
  [1, /\b(fix|update|change|rename|tweak|bump|adjust|move|bug)\b/i, 'small change'],
  [0, /\b(typo|comment|readme|wording|format\w*|spelling|whitespace)\b/i, 'cosmetic'],
]
const CHIPS = ['Fix a typo in a README', 'Add a dark mode toggle', 'Integrate a new charting library', 'Migrate production data to a new auth layer']
const GATES = [
  { id: 'classify', name: 'Classify depth' },
  { id: 'research', name: 'Research first' },
  { id: 'acq', name: 'Acquisition check' },
  { id: 'attempt', name: 'Attempt + retry breaker' },
  { id: 'verify', name: 'Independent check' },
  { id: 'evidence', name: 'Write evidence back' },
]
const METHODS = ['Hand-write it', 'Reuse a package', 'Use a built-in']
const ACQ = ['Source', 'License', 'Pinned version', 'Rollback']

function classify(text: string) {
  const hits: { lvl: number; tag: string; word: string }[] = []
  let top = -1
  for (const [lvl, re, tag] of SIGNALS) { const m = text.match(re); if (m) { hits.push({ lvl, tag, word: m[0].toLowerCase() }); top = Math.max(top, lvl) } }
  if (top < 0) return { level: 1, hits, fallback: true }
  const level = Math.min(4, top + (hits.length >= 3 && top < 4 ? 1 : 0))
  return { level, hits, fallback: false }
}
const detail = (id: string, lvl: number) => ({
  classify: '',
  research: lvl <= 1 ? 'A quick look for an existing answer' : lvl === 2 ? 'Compare options before choosing' : 'Survey public repos and packages, compare top approaches',
  acq: 'Source, license, pinned version and rollback, all recorded',
  attempt: lvl === 0 ? 'Apply directly, one reversible change' : 'Two identical same-method failures stop the third try',
  verify: 'A second reviewer checks it, then the owner rules',
  evidence: lvl <= 1 ? 'A short log line' : lvl === 2 ? 'The decision and the reason' : 'Decision, reason, and what was learned',
} as Record<string, string>)[id]
const needs = (id: string, lvl: number) => id === 'research' ? lvl >= 1 : id === 'acq' ? lvl >= 3 : id === 'verify' ? lvl >= 4 : true

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cue = gate(opts.emit, 140), cueFail = gate(opts.emit, 400)
  const ck = clock(reduced), move = mover(reduced)
  const { root, body, status, sr, q } = shell(host, 'ax', { kicker: 'Interactive model, one task through the gates', title: 'Gear the task, then pass the gates', reduced, note: '<b>Simulation.</b> A small keyword scorer stands in for the real classifier. The gate names and the two-failure rule are the real design.' })
  body.innerHTML = `
  <form class="ax-in" autocomplete="off"><input class="sys-in" name="t" maxlength="90" aria-label="Describe a task" placeholder="Describe a task for an agent" value="${esc(CHIPS[2])}"><button class="sys-btn" type="submit">Run</button></form>
  <div class="ax-chips" role="group" aria-label="Example tasks">${CHIPS.map(c => `<button type="button" class="sys-chip" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <div class="ax-grid">
    <section class="sys-panel ax-depth" aria-label="Depth gauge"><span class="sys-lbl">Depth</span>
      <ol class="ax-lv">${LEVELS.map((l, i) => `<li data-i="${i}"><b>${l.r}</b><span>${l.name}</span><em>${l.line}</em></li>`).join('')}<i class="ax-needle" aria-hidden="true"></i></ol>
      <p class="ax-sig" aria-live="polite"><span class="sys-lbl">Signals</span><span class="ax-sigs"></span></p>
    </section>
    <section class="sys-panel ax-gates" aria-label="Gates"><span class="sys-lbl">Gates</span>
      <ol class="ax-gl">${GATES.map(g => `<li class="ax-g" data-g="${g.id}" data-s="idle"><i class="ax-dot" aria-hidden="true"></i><div><b>${g.name}</b><span class="ax-gd"></span>
        ${g.id === 'acq' ? `<span class="ax-acq">${ACQ.map(a => `<u>${a}</u>`).join('')}</span>` : ''}
        ${g.id === 'attempt' ? `<div class="ax-att" hidden><div class="ax-meth" role="group" aria-label="Method">${METHODS.map((m, i) => `<button type="button" class="sys-chip" data-m="${i}">${m}</button>`).join('')}</div>
          <div class="ax-attrow"><span class="ax-pips" aria-label="Failures with this method"><u></u><u></u></span><button type="button" class="sys-btn is-ghost" data-a="fail">Simulate a failure</button><button type="button" class="sys-btn" data-a="pass">Simulate a pass</button></div></div>` : ''}
        ${g.id === 'verify' ? `<button type="button" class="sys-btn ax-appr" data-a="appr" hidden>Owner approves</button>` : ''}
      </div></li>`).join('')}</ol>
    </section>
  </div>
  <section class="sys-panel ax-led" aria-label="Evidence ledger"><span class="sys-lbl">Evidence ledger</span><ol class="ax-ll"><li class="is-empty">Nothing written yet. Run a task.</li></ol></section>`
  const input = q<HTMLInputElement>('.sys-in'), form = q<HTMLFormElement>('.ax-in')
  const lvEls = Array.from(root.querySelectorAll<HTMLElement>('.ax-lv li')), needle = q('.ax-needle')
  const gEls = new Map(GATES.map(g => [g.id, q<HTMLElement>(`.ax-g[data-g="${g.id}"]`)]))
  const sigs = q('.ax-sigs'), ledger = q('.ax-ll'), att = q('.ax-att'), appr = q<HTMLButtonElement>('.ax-appr')
  const pips = Array.from(root.querySelectorAll<HTMLElement>('.ax-pips u')), methBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-m]'))
  let token = 0, method = 0, fails = [0, 0, 0], waitAttempt: ((ok: boolean) => void) | null = null, waitAppr: (() => void) | null = null, nLine = 0

  const say = (t: string) => { status.innerHTML = t; sr.textContent = status.textContent }
  const setG = (id: string, s: string) => { gEls.get(id)!.dataset.s = s }
  const log = (t: string, kind = '') => {
    if (!nLine++) ledger.innerHTML = ''
    const li = h('li', kind); li.innerHTML = `<b>${String(nLine).padStart(2, '0')}</b><span>${t}</span>`; ledger.append(li)
    move(li, { opacity: [0, 1], y: [8, 0], duration: 260, ease: 'outCubic' })
  }
  const moveNeedle = (i: number) => {
    lvEls.forEach((l, k) => l.classList.toggle('is-on', k === i))
    const y = lvEls[i].offsetTop
    needle.style.height = `${lvEls[i].offsetHeight}px`
    if (reduced) needle.style.transform = `translateY(${y}px)`; else move(needle, { y, duration: 620, ease: 'outElastic(1, .7)' })
    needle.style.opacity = '1'
  }
  const showMethod = () => {
    methBtns.forEach((b, i) => { b.classList.toggle('is-on', i === method); b.disabled = fails[i] >= 2; b.title = fails[i] >= 2 ? 'Blocked by the retry breaker' : '' })
    pips.forEach((p, i) => p.classList.toggle('is-on', i < fails[method]))
    const tripped = fails[method] >= 2
    q<HTMLButtonElement>('[data-a="fail"]').disabled = tripped; q<HTMLButtonElement>('[data-a="pass"]').disabled = tripped
  }
  const reset = () => {
    GATES.forEach(g => { setG(g.id, 'idle'); gEls.get(g.id)!.querySelector('.ax-gd')!.textContent = '' })
    root.querySelectorAll('.ax-acq u').forEach(u => u.classList.remove('is-on'))
    att.hidden = true; appr.hidden = true; waitAttempt = null; waitAppr = null
    fails = [0, 0, 0]; method = 0; nLine = 0; ledger.innerHTML = '<li class="is-empty">Nothing written yet. Run a task.</li>'
    lvEls.forEach(l => l.classList.remove('is-on')); needle.style.opacity = '0'; sigs.textContent = ''
  }

  async function run(text: string) {
    const my = ++token, alive = () => my === token && !ck.dead
    reset()
    const c = classify(text), lvl = c.level
    say(`<b>Classifying</b> the task`)
    setG('classify', 'active'); await ck.wait(380); if (!alive()) return
    sigs.innerHTML = c.fallback ? '<em>no strong signal, so it starts at R1</em>' : c.hits.map(s => `<u>${esc(s.word)} <small>${s.tag}</small></u>`).join('')
    move(sigs.querySelectorAll('u'), { opacity: [0, 1], y: [6, 0], delay: (_: unknown, i: number) => i * 90, duration: 240 })
    moveNeedle(lvl); cue('lab:drag')
    const lt = q('.ax-lv li.is-on b'); scramble(lt, LEVELS[lvl].r, reduced, 360)
    setG('classify', 'pass'); log(`Depth <b>${LEVELS[lvl].r}</b>, ${LEVELS[lvl].name.toLowerCase()}${c.hits.length ? '. Signals: ' + c.hits.map(s => esc(s.word)).join(', ') : ''}`)
    await ck.wait(520); if (!alive()) return

    for (const g of GATES.slice(1)) {
      const el = gEls.get(g.id)!
      el.querySelector('.ax-gd')!.textContent = detail(g.id, lvl)
      if (!needs(g.id, lvl)) { setG(g.id, 'skip'); el.querySelector('.ax-gd')!.textContent = `Not owed at ${LEVELS[lvl].r}`; continue }
      setG(g.id, 'active'); cue('lab:drag'); say(`<b>${g.name}</b> ${esc(detail(g.id, lvl)).toLowerCase()}`)
      if (g.id === 'research') { await ck.wait(760); if (!alive()) return; log(lvl >= 3 ? 'Researched first: public repos and packages searched, top approaches compared' : lvl === 2 ? 'Researched first: options compared, one chosen with a reason' : 'Quick look: nothing existing fits, so a small edit it is') }
      else if (g.id === 'acq') {
        const us = Array.from(el.querySelectorAll<HTMLElement>('.ax-acq u'))
        for (const u of us) { u.classList.add('is-on'); cue('lab:drag'); if (!await ck.wait(300)) return }
        if (!alive()) return; log('Acquisition gate: source, license, pinned version and rollback recorded')
      } else if (g.id === 'attempt') {
        if (lvl === 0) { await ck.wait(500); if (!alive()) return; log('Applied directly. One reversible change, nothing to retry') }
        else {
          att.hidden = false; showMethod(); say(`<b>Your turn.</b> Fail an attempt twice with the same method and watch the breaker`)
          for (;;) {
            const ok = await new Promise<boolean>(r => { waitAttempt = r }); waitAttempt = null; if (!alive()) return
            if (ok) { log(`Passed with <b>${METHODS[method]}</b>`, 'is-ok'); break }
            fails[method]++
            if (fails[method] >= 2) {
              setG('attempt', 'block'); cueFail('lab:fail')
              log(`Retry breaker tripped: <b>${METHODS[method]}</b> failed the same way twice. A third identical try is not allowed`, 'is-bad')
              say(`<b>Blocked.</b> Switch the tool or the method`)
              const next = fails.findIndex(f => f < 2); method = next < 0 ? 0 : next
              if (next < 0) { fails = [0, 0, 0]; method = 0 }
            } else log(`Attempt failed with <b>${METHODS[method]}</b> (first time)`, 'is-bad')
            showMethod()
            if (gEls.get('attempt')!.dataset.s === 'block' && fails[method] < 2) { setG('attempt', 'active'); log(`Method switched to <b>${METHODS[method]}</b>`) }
          }
        }
      } else if (g.id === 'verify') {
        await ck.wait(500); if (!alive()) return
        appr.hidden = false; setG('verify', 'wait'); say(`<b>Waiting for the owner.</b> High-stakes work does not ship on its own`)
        await new Promise<void>(r => { waitAppr = r }); waitAppr = null; if (!alive()) return
        appr.hidden = true; log('Independent check passed, then the owner ruled yes', 'is-ok')
      } else if (g.id === 'evidence') {
        await ck.wait(520); if (!alive()) return
        log(lvl <= 1 ? 'Wrote a short log line' : lvl === 2 ? 'Wrote the decision and the reason it was chosen' : 'Wrote the decision, the reason, and the lesson for next time', 'is-ok')
      } else await ck.wait(420)
      if (!alive()) return
      setG(g.id, 'pass')
    }
    say(`<b>Done.</b> ${LEVELS[lvl].r} work, gated and logged. Try another task`)
  }

  form.addEventListener('submit', e => { e.preventDefault(); const t = input.value.trim(); if (t) { root.querySelectorAll('.sys-chip[data-c]').forEach(b => b.classList.toggle('is-on', (b as HTMLElement).dataset.c === t)); run(t) } })
  root.querySelectorAll<HTMLElement>('[data-c]').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.c!; form.requestSubmit() }))
  methBtns.forEach((b, i) => b.addEventListener('click', () => { method = i; showMethod() }))
  root.querySelector('[data-a="fail"]')!.addEventListener('click', () => waitAttempt?.(false))
  root.querySelector('[data-a="pass"]')!.addEventListener('click', () => waitAttempt?.(true))
  appr.addEventListener('click', () => waitAppr?.())
  root.querySelectorAll('[data-c]')[2].classList.add('is-on')
  say('Press <b>Run</b>, or pick a task above')
  const off = onFirstView(root, () => { if (!reduced && !sitePaused()) run(input.value) }, 0.15)
  return { dispose() { token++; ck.dispose(); off(); waitAttempt?.(false); host.innerHTML = '' } }
}
