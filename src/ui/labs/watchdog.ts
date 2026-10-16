// Watchdog lab: a 24 hour timeline of scheduled jobs. Click a job to break it, pick how it breaks, and watch the hourly sweep catch it.
// The rule is the project's: check the output, never the exit code. A job that ran and made nothing is stale; an artifact the sweep cannot
// read is NOT CHECKED, never ok. Simulation: job names, schedules and ages are generic and made up; nothing here is a real job.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: lab:fail (a job breaks), lab:drag (alert / recovery), lab:tick (hourly sweep).
import './watchdog.css'
import { h, shell, clock, mover, esc, type LabOpts } from './lib/sys-kit'
import { frameLoop, gate, sitePaused, type LabHandle } from './lib/kit'

type Mode = 'missed' | 'empty' | 'unreadable'
type St = 'ok' | 'stale' | 'nochk' | 'retry' | 'rec'
interface Job { id: string; name: string; art: string; hours: number[]; max: number; st: St; broken: Mode | null; lastOk: number; retryAt: number; alerted: boolean; ticks: ('future' | 'ok' | 'miss' | 'empty' | 'unread')[]; extras: { t: number; k: string }[] }
const mk = (id: string, name: string, art: string, every: number, off: number, max: number): Job => ({ id, name, art, hours: Array.from({ length: Math.ceil((24 - off) / every) }, (_, i) => off + i * every), max, st: 'ok', broken: null, lastOk: 0, retryAt: -1, alerted: false, ticks: [], extras: [] })
const START = 7.2
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'missed', label: 'Missed run', hint: 'The job never fires' },
  { id: 'empty', label: 'Empty output', hint: 'It runs, exits 0, makes nothing' },
  { id: 'unreadable', label: 'Unreadable artifact', hint: 'The sweep cannot read what it made' },
]
const PILL: Record<St, string> = { ok: 'OK', stale: 'STALE', nochk: 'NOT CHECKED', retry: 'RETRYING', rec: 'RECOVERED' }
const fmt = (t: number) => { const m = Math.floor((((t % 24) + 24) % 24) * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cue = gate(opts.emit, 160), cueFail = gate(opts.emit, 300), cueTick = gate(opts.emit, 700)
  const ck = clock(reduced), move = mover(reduced)
  const { root, body, status, sr, q } = shell(host, 'wd', { kicker: 'Interactive model, one day of scheduled jobs', title: 'Break a job and watch it get caught', reduced, note: '<b>Simulation.</b> Generic job names and made-up schedules. The rule is real: check what the job made, never its exit code.' })
  const jobs: Job[] = [
    mk('sync', 'Notes sync', 'timestamp', 1, 0, 2), mk('snap', 'Snapshot', 'commit', 2, 0, 3), mk('link', 'Link check', 'log line', 3, 1, 4),
    mk('cache', 'Cache sweep', 'swept folder', 4, 2, 5), mk('digest', 'Morning digest', 'dated note', 6, 6, 7), mk('rep', 'Weekly report', 'rendered file', 8, 3, 9),
  ]
  let mode: Mode = 'missed', t = START, playing = !reduced && !sitePaused(), lastSweep = Math.floor(START), dirty = true
  body.innerHTML = `
  <div class="wd-ctl"><div class="wd-modes" role="group" aria-label="How the job breaks">${MODES.map((m, i) => `<button type="button" class="sys-chip${i === 0 ? ' is-on' : ''}" data-m="${m.id}" title="${m.hint}">${m.label}</button>`).join('')}</div>
    <div class="wd-tools"><span class="wd-clk" aria-label="Simulated time"><b>${fmt(t)}</b><i hidden>fast forward</i></span><button type="button" class="sys-btn is-ghost" data-a="play">${playing ? 'Pause' : 'Play'}</button><button type="button" class="sys-btn is-ghost" data-a="step">Step an hour</button></div></div>
  <section class="sys-panel wd-tl" aria-label="Job timeline" style="--lw:110px;--pw:78px">
    <div class="wd-axis" aria-hidden="true"><span></span><div>${[0, 6, 12, 18, 24].map(x => `<u style="left:${(x / 24) * 100}%">${String(x).padStart(2, '0')}</u>`).join('')}</div><span></span></div>
    <ol class="wd-rows">${jobs.map(j => `<li class="wd-row" data-j="${j.id}" data-s="ok"><button type="button" class="wd-name" aria-label="Break ${j.name}"><b>${j.name}</b><small>checks: ${j.art}</small></button>
      <div class="wd-track">${j.hours.map((hh, k) => `<i class="wd-tick" data-k="${k}" style="left:${(hh / 24) * 100}%"></i>`).join('')}<span class="wd-ex"></span></div><span class="wd-pill">OK</span></li>`).join('')}</ol>
    <div class="wd-cursor" aria-hidden="true"><span></span></div>
    <div class="wd-toasts" aria-live="off"></div>
  </section>
  <ol class="wd-log" aria-label="Event log"><li class="is-empty">Click a job name to break it. The sweep runs on the hour.</li></ol>`
  const rows = new Map(jobs.map(j => [j.id, q<HTMLElement>(`.wd-row[data-j="${j.id}"]`)]))
  const cursor = q('.wd-cursor'), tl = q('.wd-tl'), toasts = q('.wd-toasts'), logEl = q('.wd-log'), clkB = q('.wd-clk b'), clkI = q('.wd-clk i'), playB = q<HTMLButtonElement>('[data-a="play"]')
  const say = (s: string) => { status.innerHTML = s; sr.textContent = status.textContent }
  let nLog = 0
  const log = (s: string, kind = '') => {
    if (!nLog++) logEl.innerHTML = ''
    const li = h('li', kind); li.innerHTML = `<b>${fmt(t)}</b><span>${s}</span>`; logEl.prepend(li)
    while (logEl.children.length > 5) logEl.lastElementChild!.remove()
    move(li, { opacity: [0, 1], x: [-8, 0], duration: 240, ease: 'outCubic' })
  }
  const toast = (title: string, text: string, kind: string) => {
    const el = h('div', `wd-toast ${kind}`); el.innerHTML = `<i aria-hidden="true"></i><div><b>${esc(title)}</b><span>${esc(text)}</span></div>`; toasts.prepend(el)
    move(el, { opacity: [0, 1], x: [40, 0], duration: 360, ease: 'outBack' })
    while (toasts.children.length > 2) toasts.lastElementChild!.remove()
    window.setTimeout(() => el.remove(), 5200)
  }
  // history before the first frame: every tick that already passed is a good run
  const seed = () => jobs.forEach(j => { j.ticks = j.hours.map(hh => (hh <= t ? 'ok' : 'future')); const done = j.hours.filter(hh => hh <= t); j.lastOk = done.length ? done[done.length - 1] : t - 0.2; j.st = 'ok'; j.broken = null; j.alerted = false; j.extras = [] })
  seed()

  const fire = (j: Job, k: number) => {
    if (!j.broken) { j.ticks[k] = 'ok'; j.lastOk = j.hours[k]; return }
    j.ticks[k] = j.broken === 'missed' ? 'miss' : j.broken === 'empty' ? 'empty' : 'unread'
    if (j.broken === 'empty') log(`<b>${j.name}</b> ran and exited 0, but made nothing`, 'is-warn')
  }
  const sweep = () => {
    cueTick('lab:tick')
    for (const j of jobs) {
      const age = t - j.lastOk
      if (j.st === 'retry') continue
      if (j.broken === 'unreadable' && j.ticks.some(x => x === 'unread') && j.st !== 'nochk') {
        j.st = 'nochk'; j.alerted = true; cue('lab:drag'); log(`<b>${j.name}</b> NOT CHECKED: the sweep cannot read the artifact, so it is not called ok`, 'is-warn')
        toast(`${j.name}: NOT CHECKED`, 'Could not read the artifact. Needs a look.', 'is-warn'); say(`<b>${j.name}</b> is NOT CHECKED, never ok. Click it to repair`)
      } else if (!j.broken && j.st === 'rec') j.st = 'ok'
      else if (j.broken && j.broken !== 'unreadable' && j.st === 'ok' && age > j.max) {
        j.st = 'stale'; j.alerted = true; j.retryAt = t + 1; cue('lab:drag')
        log(`<b>${j.name}</b> STALE: no new ${j.art} in ${Math.floor(age)} h, the limit is ${j.max} h`, 'is-bad')
        toast(`${j.name}: stale`, `No new ${j.art} for ${Math.floor(age)} h`, 'is-bad'); say(`<b>Alert sent.</b> The watchdog retries ${j.name} in an hour`)
      }
    }
    dirty = true
  }
  const retries = () => {
    for (const j of jobs) if ((j.st === 'stale') && j.retryAt >= 0 && t >= j.retryAt) {
      j.st = 'retry'; j.retryAt = t + 0.5; log(`Retrying <b>${j.name}</b>`); dirty = true
    } else if (j.st === 'retry' && t >= j.retryAt) {
      j.broken = null; j.lastOk = t; j.st = 'rec'; j.alerted = false; j.extras.push({ t, k: 'retry' }); cue('lab:drag')
      log(`<b>${j.name}</b> recovered: the retry made a fresh ${j.art}`, 'is-ok'); toast(`${j.name}: recovered`, `Fresh ${j.art} found`, 'is-ok'); say(`<b>${j.name}</b> is back. Break another job`); dirty = true
    }
  }
  const advance = (dt: number) => {
    let left = dt
    while (left > 0) {
      const a = Math.min(left, 0.2), t0 = t; t += a; left -= a
      if (t >= 24) { t -= 24; jobs.forEach(j => { j.ticks = j.ticks.map(() => 'future'); j.lastOk -= 24; j.retryAt = j.retryAt >= 0 ? j.retryAt - 24 : -1; j.extras = [] }); lastSweep = -1 }
      else jobs.forEach(j => j.hours.forEach((hh, k) => { if (hh > t0 && hh <= t && j.ticks[k] === 'future') fire(j, k) }))
      retries()
      if (Math.floor(t) > lastSweep) { lastSweep = Math.floor(t); sweep() }
      dirty = true
    }
  }
  const unresolved = () => jobs.some(j => j.broken && (j.st === 'ok' || j.st === 'stale' || j.st === 'retry'))
  const pct = () => (t / 24) * 100
  const paint = () => {
    for (const j of jobs) {
      const r = rows.get(j.id)!; r.dataset.s = j.st; r.querySelector('.wd-pill')!.textContent = PILL[j.st]
      r.classList.toggle('is-broken', !!j.broken)
      r.querySelectorAll<HTMLElement>('.wd-tick').forEach((e, k) => { e.dataset.s = j.ticks[k] })
      const ex = r.querySelector('.wd-ex')!; if (ex.childElementCount !== j.extras.length) ex.innerHTML = j.extras.map(e => `<s style="left:${(e.t / 24) * 100}%"></s>`).join('')
    }
    dirty = false
  }
  const place = () => { cursor.style.left = `calc(var(--lw) + 12px + var(--g) + (100% - var(--lw) - var(--pw) - 24px - 2 * var(--g)) * ${t / 24})` }
  const show = () => { clkB.textContent = fmt(t); place(); if (dirty) paint(); clkI.hidden = !(unresolved() && playing) }
  const loop = frameLoop(root, dt => {
    if (playing && (!sitePaused() || unresolved())) advance(dt * (unresolved() ? 5.5 : 1.1))
    show(); return playing && (!sitePaused() || unresolved())
  })
  const setPlay = (on: boolean) => { playing = on; playB.textContent = on ? 'Pause' : 'Play'; if (on) loop.wake() }
  const breakJob = (j: Job) => {
    if (j.broken || j.st === 'nochk') {
      j.broken = null; j.st = 'rec'; j.lastOk = t; j.alerted = false; j.retryAt = -1; j.ticks = j.ticks.map(x => (x === 'unread' ? 'ok' : x)); j.extras.push({ t, k: 'fix' }); cue('lab:drag')
      log(`<b>${j.name}</b> repaired by hand`, 'is-ok'); say(`<b>${j.name}</b> repaired`); dirty = true; show(); return
    }
    j.broken = mode; cueFail('lab:fail'); log(`<b>${j.name}</b> broken: ${MODES.find(m => m.id === mode)!.label.toLowerCase()}`)
    say(reduced ? `<b>${j.name}</b> is broken. Press Step an hour to move time` : `<b>${j.name}</b> is broken. Time speeds up until the sweep catches it`)
    if (!reduced) setPlay(true)
    // an unreadable artifact only shows up when the job next runs, so the run that is due next is the one that produces it
    dirty = true; show(); loop.wake()
  }
  jobs.forEach(j => rows.get(j.id)!.querySelector('.wd-name')!.addEventListener('click', () => breakJob(j)))
  root.querySelectorAll<HTMLElement>('[data-m]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.m as Mode; root.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('is-on', x === b)) }))
  playB.addEventListener('click', () => setPlay(!playing))
  root.querySelector('[data-a="step"]')!.addEventListener('click', () => { advance(1); show(); loop.wake() })
  say(reduced ? 'Press <b>Step an hour</b> to move time, and click a job to break it' : 'Click a <b>job name</b> to break it. The sweep runs on the hour')
  paint(); place(); loop.wake()
  return { dispose() { ck.dispose(); loop.dispose(); host.innerHTML = '' } }
}
