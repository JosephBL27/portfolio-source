// Skills lab: a request is split into units, and each unit is routed to one named public skill with a reason and a test it can fail.
// Simulation: the splitter is a small keyword table, the skills are public open-source ones, and no real prompt history is shown.
// Drag a unit onto another skill to reroute it, then Run tests: a skill that does not cover the unit fails that unit's test.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: lab:drag (a route lands), lab:fail (a test fails).
import './skills.css'
import { animate } from 'animejs'
import { h, shell, clock, mover, scramble, dragCard, under, esc, type LabOpts } from './lib/sys-kit'
import { gate, onFirstView, sitePaused, type LabHandle } from './lib/kit'

interface Skill { id: string; blurb: string; covers: Record<string, string> }
const SKILLS: Skill[] = [
  { id: 'gstack', blurb: 'Review, QA and ship workflow', covers: { review: 'Reads the diff as a staff reviewer would', qa: 'Runs the app and writes regression checks', measure: 'Benchmarks before and after, so the claim is measured' } },
  { id: 'impeccable', blurb: 'Interface critique and polish', covers: { ui: 'Judges hierarchy, type, colour and spacing against known anti-patterns' } },
  { id: 'avoid-ai-writing', blurb: 'Strips AI tells from prose', covers: { writing: 'Rewrites the text so it reads like a person wrote it' } },
  { id: 'watch', blurb: 'Video to frames and transcript', covers: { video: 'Downloads the video, samples frames and pulls the transcript' } },
  { id: 'find-skills', blurb: 'Searches the open skill ecosystem', covers: { discover: 'Nothing installed fits, so search for an existing tool before building one' } },
  { id: 'animejs', blurb: 'Anime.js timelines and stagger', covers: { motion: 'Knows the timeline, stagger and scrub API for this library' } },
  { id: 'web-design-guidelines', blurb: 'Checks UI against interface rules', covers: { a11y: 'Audits focus, labels, touch targets and contrast' } },
  { id: 'vercel-react-best-practices', blurb: 'React performance rules', covers: { perf: 'Applies bundle, render and data-fetching rules for React' } },
]
interface Unit { label: string; need: string; test: string }
const RULES: [RegExp, Unit[]][] = [
  [/faster|slow|performance|speed|lag|heavy/i, [
    { label: 'Find what makes it slow', need: 'perf', test: 'The slow path is named, with a rule behind it' },
    { label: 'Check the page against interface rules', need: 'a11y', test: 'No rule violations left in the changed markup' },
    { label: 'Measure it again after the change', need: 'measure', test: 'A before and an after number, side by side' }] ],
  [/video|watch|youtube|transcript|clip|lecture/i, [
    { label: 'Pull the frames and the transcript', need: 'video', test: 'A transcript exists and frames cover the whole video' },
    { label: 'Write the summary in plain prose', need: 'writing', test: 'The summary has no stock AI phrasing' }] ],
  [/diff|review|pull request|\bpr\b|code|merge|ship/i, [
    { label: 'Review the diff for bugs', need: 'review', test: 'Each finding points at a line and a failing case' },
    { label: 'Run it and check for regressions', need: 'qa', test: 'The checks that failed before now pass' }] ],
  [/design|\bui\b|landing|layout|ugly|polish|look/i, [
    { label: 'Critique hierarchy, type and spacing', need: 'ui', test: 'Each issue names an element and a fix' },
    { label: 'Check accessibility and touch targets', need: 'a11y', test: 'Every control is reachable and labelled' }] ],
  [/animat|motion|transition|stagger|timeline/i, [{ label: 'Build the timeline and stagger', need: 'motion', test: 'It plays, scrubs and respects reduced motion' }] ],
  [/write|essay|email|draft|post|copy|rewrite|sound/i, [{ label: 'Rewrite so it sounds human', need: 'writing', test: 'The detector score drops and the meaning is unchanged' }] ],
  [/skill|tool|library|find|is there|search/i, [{ label: 'Search for an existing tool', need: 'discover', test: 'A named candidate with a source and a licence' }] ],
]
const CHIPS = ['Make this page faster', 'Watch this video and summarize it', 'Review my diff before I ship']
const FALLBACK: Unit[] = [{ label: 'Search before building anything', need: 'discover', test: 'A named candidate with a source and a licence' }]

function split(text: string): Unit[] {
  const out: Unit[] = [], seen = new Set<string>()
  for (const [re, us] of RULES) if (re.test(text)) for (const u of us) if (!seen.has(u.need) && out.length < 4) { seen.add(u.need); out.push(u) }
  return out.length ? out : FALLBACK
}
const fit = (need: string) => SKILLS.find(s => need in s.covers)!

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cue = gate(opts.emit, 140), cueFail = gate(opts.emit, 400)
  const ck = clock(reduced), move = mover(reduced)
  const { root, body, status, sr, q } = shell(host, 'sk', { kicker: 'Interactive model, one request through the router', title: 'Split the request, route every unit', reduced, note: '<b>Simulation.</b> A small keyword table does the splitting. The skills are public open-source ones; the habit of one skill and one test per unit is the real design.' })
  body.innerHTML = `
  <form class="sk-in" autocomplete="off"><input class="sys-in" name="t" maxlength="90" aria-label="A request" placeholder="Type a request" value="${esc(CHIPS[1])}"><button class="sys-btn" type="submit">Route it</button></form>
  <div class="sk-chips ax-chips" role="group" aria-label="Example requests">${CHIPS.map(c => `<button type="button" class="sys-chip" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <div class="sk-grid">
    <svg class="sk-wires" aria-hidden="true"></svg>
    <section class="sk-units" aria-label="Work units"><span class="sys-lbl">Units</span><ol class="sk-ul"></ol></section>
    <section class="sk-board" aria-label="Skills"><span class="sys-lbl">Skills</span><div class="sk-tiles">${SKILLS.map(s => `<div class="sk-tile" data-s="${s.id}"><b>${s.id}</b><span>${s.blurb}</span><i class="sk-n" aria-hidden="true"></i></div>`).join('')}</div></section>
  </div>
  <div class="sk-bar"><button type="button" class="sys-btn" data-a="test" disabled>Run tests</button><button type="button" class="sys-btn is-ghost" data-a="reset" disabled>Reset routes</button></div>
  <p class="sys-hint">Drag a unit onto a different skill to reroute it, then run the tests. A unit is done when its test passes, not when a tool ran.</p>`
  const input = q<HTMLInputElement>('.sys-in'), form = q<HTMLFormElement>('.sk-in'), ul = q('.sk-ul'), grid = q('.sk-grid')
  const svg = q<SVGSVGElement>('.sk-wires'), btnTest = q<HTMLButtonElement>('[data-a="test"]'), btnReset = q<HTMLButtonElement>('[data-a="reset"]')
  const tiles = new Map(SKILLS.map(s => [s.id, q(`.sk-tile[data-s="${s.id}"]`)]))
  interface Row { u: Unit; el: HTMLElement; route: string; auto: string; path: SVGPathElement; need(): boolean }
  let rows: Row[] = [], token = 0
  const say = (t: string) => { status.innerHTML = t; sr.textContent = status.textContent }

  const wide = () => grid.clientWidth > 640
  const wire = (r: Row, anim = false) => {
    if (!wide()) { r.path.setAttribute('d', ''); return }
    const g = grid.getBoundingClientRect(), a = r.el.getBoundingClientRect(), t = tiles.get(r.route)!.getBoundingClientRect()
    const x1 = a.right - g.left, y1 = a.top + a.height / 2 - g.top, x2 = t.left - g.left, y2 = t.top + t.height / 2 - g.top, dx = Math.max(24, (x2 - x1) * 0.55)
    r.path.setAttribute('d', `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`)
    if (anim && !reduced) { const len = r.path.getTotalLength(); r.path.style.strokeDasharray = `${len}`; animate(r.path, { strokeDashoffset: [len, 0], duration: 520, ease: 'outCubic', onComplete: () => { r.path.style.strokeDasharray = '' } }) }
  }
  const wireAll = () => rows.forEach(r => wire(r))
  const counts = () => { tiles.forEach((t, id) => { const n = rows.filter(r => r.route === id).length; t.querySelector('.sk-n')!.textContent = n ? String(n) : ''; t.classList.toggle('is-used', n > 0) }) }
  const paint = (r: Row, animateText: boolean) => {
    const s = SKILLS.find(k => k.id === r.route)!, ok = r.need() 
    r.el.dataset.fit = ok ? '1' : '0'
    r.el.querySelector<HTMLElement>('.sk-tag')!.textContent = `→ ${r.route}`
    const why = r.el.querySelector<HTMLElement>('.sk-why')!
    const txt = ok ? s.covers[r.u.need] : `Routed by hand: ${s.id} does not cover this unit`
    if (animateText) scramble(why, txt, reduced, 420); else why.textContent = txt
    r.el.querySelector('.sk-res')!.textContent = ''; r.el.classList.remove('is-pass', 'is-fail')
    r.path.classList.toggle('is-off', !ok)
  }
  async function run(text: string) {
    const my = ++token, alive = () => my === token && !ck.dead
    ul.innerHTML = ''; svg.innerHTML = ''; rows = []; counts(); tiles.forEach(t => t.classList.remove('is-hit'))
    btnTest.disabled = true; btnReset.disabled = true
    const units = split(text)
    say(`<b>Splitting</b> the request into ${units.length} unit${units.length > 1 ? 's' : ''}`)
    units.forEach((u, i) => {
      const li = h('li', 'sk-u'); li.innerHTML = `<b class="sk-i">${i + 1}</b><div><strong>${esc(u.label)}</strong><span class="sk-tag">…</span><p class="sk-why"></p><p class="sk-test">Test: ${esc(u.test)}</p><em class="sk-res"></em></div>`
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); svg.append(path)
      const r: Row = { u, el: li, route: fit(u.need).id, auto: fit(u.need).id, path, need: () => r.u.need in SKILLS.find(s => s.id === r.route)!.covers }
      ul.append(li); rows.push(r)
      dragCard(li, { reduced, onStart: () => li.classList.add('is-lift'),
        onMove: (x, y) => { tiles.forEach(t => t.classList.remove('is-hit')); under(x, y, '.sk-tile')?.classList.add('is-hit') },
        drop: (x, y) => {
          li.classList.remove('is-lift'); tiles.forEach(t => t.classList.remove('is-hit'))
          const t = under(x, y, '.sk-tile'); if (!t) return false
          r.route = t.dataset.s!; cue('lab:drag'); paint(r, true); wire(r, true); counts(); btnReset.disabled = false
          say(r.need() ? `<b>${esc(r.u.label)}</b> now goes to ${r.route}` : `<b>${r.route}</b> does not cover that unit. Run the tests to see it fail`)
        } })
    })
    move(rows.map(r => r.el), { opacity: [0, 1], y: [10, 0], delay: (_: unknown, i: number) => i * 120, duration: 300, ease: 'outCubic' })
    await ck.wait(260 + units.length * 120); if (!alive()) return
    for (const r of rows) {
      r.route = r.auto; paint(r, true); wire(r, true); counts(); cue('lab:drag')
      tiles.get(r.route)!.classList.add('is-hit'); const t = tiles.get(r.route)!; setTimeout(() => t.classList.remove('is-hit'), 500)
      if (!await ck.wait(380)) return
    }
    btnTest.disabled = false; say(`<b>Routed.</b> Drag a unit onto another skill, or run the tests`)
  }
  async function test() {
    const my = ++token, alive = () => my === token && !ck.dead
    btnTest.disabled = true; let pass = 0
    for (const r of rows) {
      r.el.classList.add('is-run'); if (!await ck.wait(380)) return; if (!alive()) return
      const ok = r.need(); r.el.classList.remove('is-run'); r.el.classList.add(ok ? 'is-pass' : 'is-fail')
      r.el.querySelector('.sk-res')!.textContent = ok ? 'Test passed' : 'Test failed: no skill here covers this'
      if (ok) pass++; else cueFail('lab:fail'); cue('lab:drag')
    }
    btnTest.disabled = false
    say(pass === rows.length ? `<b>${pass} of ${rows.length}</b> tests pass, so every unit is done` : `<b>${pass} of ${rows.length}</b> tests pass. Reroute the red unit and run again`)
  }
  form.addEventListener('submit', e => { e.preventDefault(); const t = input.value.trim(); if (t) { root.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('is-on', (b as HTMLElement).dataset.c === t)); run(t) } })
  root.querySelectorAll<HTMLElement>('[data-c]').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.c!; form.requestSubmit() }))
  btnTest.addEventListener('click', test)
  btnReset.addEventListener('click', () => { token++; rows.forEach(r => { r.route = r.auto; paint(r, false); wire(r, true) }); counts(); btnReset.disabled = true; btnTest.disabled = false; say('<b>Routes reset.</b>') })
  const ro = new ResizeObserver(() => wireAll()); ro.observe(grid)
  root.querySelector('[data-c]:nth-child(2)')!.classList.add('is-on')
  say('Press <b>Route it</b>, or pick a request above')
  const off = onFirstView(root, () => { if (!reduced && !sitePaused()) run(input.value) }, 0.15)
  return { dispose() { token++; ck.dispose(); off(); ro.disconnect(); host.innerHTML = '' } }
}
