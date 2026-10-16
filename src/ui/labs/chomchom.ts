// ChomChom lab: a playable slice of the kids' mindfulness app.
// The home screen is a road map with five stops (names from the project's own media captions: Daily Check-in, Mindfulness Challenge, Story,
// Games, Journaling). Tap a stop and the car drives there along the road. One stop is fully playable: a breathing exercise where the circle
// grows while you hold and shrinks when you let go. Everything here is a SIMULATION of the idea, not the shipped app or its content.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: hub:detent (car arrives), count:tick (a breath), brain:pulse (level complete).
import './chomchom.css'
import { animate } from 'motion'
import { clamp, easeInOut, esc, gate, type LabHandle, type LabOpts } from './lib/kit'
import { owner, shell } from './lib/prod-kit'

interface Stop { id: string; name: string; at: number; icon: string }
const STOPS: Stop[] = [
  { id: 'checkin', name: 'Daily Check-in', at: 0.07, icon: '☺' },
  { id: 'mind', name: 'Mindfulness Challenge', at: 0.3, icon: '❁' },
  { id: 'story', name: 'Story', at: 0.52, icon: '❦' },
  { id: 'games', name: 'Games', at: 0.74, icon: '◆' },
  { id: 'journal', name: 'Journaling', at: 0.95, icon: '✎' },
]
const ROAD = 'M36 238 C 120 238, 120 118, 214 128 S 318 258, 392 196 S 500 66, 566 112'
const MOODS = ['Happy', 'Calm', 'Tired', 'Wiggly']
const BREATHS = 3, SECS = 4

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced
  const cue = gate(opts.emit, 90)
  const own = owner()
  const sh = shell(host, 'pl-cc', { acc: '#b79cff', acc2: '#dccfff', glow: '183, 156, 255' },
    'Interactive model, Simulation', 'The road-map home screen',
    'Simulation of the idea, not the shipped app: five stops on a map, and one of them, a breathing exercise, is playable.',
    'Tap a stop and the car drives there. At the Mindfulness Challenge, press and hold the circle to breathe in, let go to breathe out.')
  sh.body.innerHTML = `
  <div class="cc-grid">
    <div class="cc-map pl-panel">
      <svg viewBox="0 0 600 300" class="cc-svg" aria-hidden="true">
        <defs><pattern id="ccdots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.2" fill="rgba(183,156,255,.14)"/></pattern></defs>
        <rect width="600" height="300" fill="url(#ccdots)"/>
        <path d="${ROAD}" class="cc-verge"/><path d="${ROAD}" class="cc-road"/><path d="${ROAD}" class="cc-lane"/>
        <g class="cc-car"><rect x="-15" y="-8" width="30" height="16" rx="6"/><rect x="-3" y="-6" width="11" height="12" rx="3" class="win"/><circle cx="-9" cy="9" r="3.5"/><circle cx="9" cy="9" r="3.5"/></g>
      </svg>
      ${STOPS.map(s => `<button type="button" class="cc-stop" data-id="${s.id}" aria-label="${esc(s.name)}"><i>${s.icon}</i><span>${esc(s.name)}</span></button>`).join('')}
    </div>
    <div class="cc-card pl-panel" aria-live="polite"></div>
  </div>`
  const q = <T extends Element>(s: string) => sh.root.querySelector<T>(s)!
  const road = q<SVGPathElement>('.cc-road'), car = q<SVGGElement>('.cc-car'), card = q<HTMLElement>('.cc-card')
  const buttons = [...sh.root.querySelectorAll<HTMLButtonElement>('.cc-stop')]
  sh.root.classList.add('is-home')
  const total = road.getTotalLength()
  let pos = 0, cur = '', driving: { stop(): void } | null = null, cleanup: (() => void) | null = null

  const place = (f: number, dir = 1) => {
    const a = road.getPointAtLength(clamp(f, 0, 1) * total), b = road.getPointAtLength(clamp(f + 0.004 * dir, 0, 1) * total)
    const ang = (Math.atan2((b.y - a.y) * dir, (b.x - a.x) * dir) * 180) / Math.PI
    const flip = Math.abs(ang) > 90
    car.setAttribute('transform', `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${flip ? ang + 180 : ang}) scale(${flip ? -1 : 1} 1)`)
  }
  const layout = () => {
    STOPS.forEach((s, i) => {
      const p = road.getPointAtLength(s.at * total)
      buttons[i].style.left = `${(p.x / 600) * 100}%`; buttons[i].style.top = `${(p.y / 300) * 100}%`
    })
  }
  layout(); place(0)

  /** a stop's content card; the Mindfulness Challenge mounts the playable breathing exercise */
  const show = (s: Stop) => {
    cleanup?.(); cleanup = null; cur = s.id; sh.root.classList.remove('is-home')
    buttons.forEach(b => b.classList.toggle('is-here', b.dataset.id === s.id))
    const head = `<span class="pl-lab">Stop &middot; ${esc(s.name)}</span>`
    if (s.id === 'checkin') {
      card.innerHTML = `${head}<h4>How are you feeling today?</h4><div class="cc-moods">${MOODS.map(m => `<button type="button" class="pl-btn" data-m="${m}">${m}</button>`).join('')}</div><p class="cc-say">Pick one. There is no wrong answer.</p>`
      card.querySelectorAll<HTMLButtonElement>('.cc-moods button').forEach(b => b.addEventListener('click', () => {
        card.querySelectorAll('.cc-moods button').forEach(x => x.classList.toggle('is-on', x === b))
        card.querySelector('.cc-say')!.textContent = `Thanks for telling me. Feeling ${b.dataset.m!.toLowerCase()} is okay.`; cue('count:tick')
      }))
    } else if (s.id === 'mind') breathe(head)
    else if (s.id === 'story') {
      card.innerHTML = `${head}<h4>A story about learning to bike</h4><p class="cc-sub">How might the child feel when the bike wobbles?</p><div class="cc-opts">${['Nervous', 'Proud', 'Sleepy'].map(o => `<button type="button" class="pl-btn" data-o="${o}">${o}</button>`).join('')}</div><p class="cc-say">Story questions ask about feelings (sample question, Simulation).</p>`
      card.querySelectorAll<HTMLButtonElement>('.cc-opts button').forEach(b => b.addEventListener('click', () => {
        card.querySelectorAll('.cc-opts button').forEach(x => x.classList.toggle('is-on', x === b))
        card.querySelector('.cc-say')!.textContent = `Many children say ${b.dataset.o!.toLowerCase()}. Why do you think so?`; cue('count:tick')
      }))
    } else if (s.id === 'games') {
      card.innerHTML = `${head}<h4>Learning games</h4><p class="cc-sub">Each lesson is tagged for reading level, teaching intent and sensory load, so the next one fits the child.</p><p class="cc-say">Try the Mindfulness Challenge stop for the playable exercise.</p>`
    } else {
      card.innerHTML = `${head}<h4>Journaling</h4><label class="cc-sub" for="cc-j">Finish the sentence</label><textarea id="cc-j" class="cc-ta" rows="3" maxlength="120" placeholder="Today I felt..."></textarea><button type="button" class="pl-btn cc-save">Stamp it</button><p class="cc-say">Nothing is saved; this is a Simulation.</p>`
      card.querySelector('.cc-save')!.addEventListener('click', () => { card.querySelector('.cc-say')!.textContent = 'Stamped. Nice work today.'; card.classList.remove('stamp'); void card.offsetWidth; card.classList.add('stamp'); cue('count:tick') })
    }
    if (!reduced) animate(card, { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0px)'] }, { duration: 0.35, ease: [0.2, 0.9, 0.3, 1] })
  }

  /** the breathing exercise: hold = inhale (circle grows over 4 s), release = exhale; three full breaths complete the level */
  function breathe(head: string) {
    card.innerHTML = `${head}<h4>Breathe with the cloud</h4>
      <div class="cc-air"><i class="cc-guide"></i><i class="cc-halo cc-halo-a"></i><i class="cc-halo cc-halo-b"></i><button type="button" class="cc-orb" aria-label="Press and hold to breathe in, release to breathe out"><span class="cc-orb-t">Hold</span></button></div>
      <p class="cc-say cc-instr">Press and hold to breathe in.</p>
      <div class="cc-stars" aria-hidden="true">${'<i></i>'.repeat(BREATHS)}</div>
      <button type="button" class="pl-btn cc-again" hidden>Play again</button>`
    const air = card.querySelector<HTMLElement>('.cc-air')!, orb = card.querySelector<HTMLButtonElement>('.cc-orb')!, instr = card.querySelector<HTMLElement>('.cc-instr')!, stars = [...card.querySelectorAll<HTMLElement>('.cc-stars i')]
    const t = card.querySelector<HTMLElement>('.cc-orb-t')!, again = card.querySelector<HTMLButtonElement>('.cc-again')!
    let lvl = 0, held = false, breaths = 0, peaked = false, raf = 0, last = 0, dead = false, fin = false
    const tick = (ms: number) => {
      raf = 0; if (dead) return
      const dt = Math.min(1 / 20, last ? (ms - last) / 1000 : 1 / 60); last = ms
      lvl = clamp(lvl + (held ? dt : -dt * 0.9) / SECS, 0, 1)
      { const b = easeInOut(lvl).toFixed(3); orb.style.setProperty('--b', b); air.style.setProperty('--b', b) }
      if (held && lvl > 0.85 && !peaked && !fin) { peaked = true; instr.textContent = 'Now let it out slowly.'; t.textContent = 'Release' }
      if (!held && peaked && lvl < 0.12 && !fin) {
        peaked = false; breaths++; stars[breaths - 1]?.classList.add('on'); cue('count:tick')
        if (breaths >= BREATHS) { fin = true; instr.textContent = 'Level complete. You breathed with the cloud.'; t.textContent = 'Done'; again.hidden = false; cue('brain:pulse'); card.classList.add('win') }
        else { instr.textContent = 'Good breath. Hold to breathe in again.'; t.textContent = 'Hold' }
      }
      if (held || lvl > 0) { raf = requestAnimationFrame(tick) } else last = 0
    }
    const go = () => { if (!raf && !dead) raf = requestAnimationFrame(tick) }
    const hold = (on: boolean) => { if (fin || held === on) return; held = on; orb.classList.toggle('is-held', on); if (on && !peaked) { instr.textContent = 'Breathe in...'; t.textContent = 'In' } if (!on && !peaked && lvl < 0.85) { instr.textContent = 'Hold longer, until the cloud is big.'; t.textContent = 'Hold' } go() }
    orb.addEventListener('pointerdown', e => { e.preventDefault(); orb.setPointerCapture?.(e.pointerId); hold(true) })
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) orb.addEventListener(ev, () => hold(false))
    orb.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) hold(true) } })
    orb.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); hold(false) } })
    orb.addEventListener('contextmenu', e => e.preventDefault())
    again.addEventListener('click', () => { breaths = 0; fin = false; peaked = false; stars.forEach(s => s.classList.remove('on')); again.hidden = true; card.classList.remove('win'); instr.textContent = 'Press and hold to breathe in.'; t.textContent = 'Hold'; orb.focus({ preventScroll: true }) })
    cleanup = () => { dead = true; cancelAnimationFrame(raf) }
  }

  const driveTo = (s: Stop) => {
    if (s.id === cur && !driving) return
    driving?.stop(); card.classList.remove('win')
    buttons.forEach(b => b.classList.toggle('is-here', false))
    const from = pos, dir = s.at >= from ? 1 : -1, dist = Math.abs(s.at - from)
    sh.root.classList.add('is-driving')
    const done = () => { pos = s.at; place(pos, dir); sh.root.classList.remove('is-driving'); driving = null; cue('hub:detent'); show(s) }
    if (reduced || dist < 0.001) { done(); return }
    const a = animate(0, 1, { duration: 0.5 + dist * 2.2, ease: [0.45, 0, 0.25, 1], onUpdate: v => { pos = from + (s.at - from) * v; place(pos, dir) }, onComplete: done })
    driving = { stop: () => { a.stop(); pos = pos } }
  }
  buttons.forEach((b, i) => b.addEventListener('click', () => driveTo(STOPS[i])))
  card.innerHTML = '<span class="pl-lab">Home screen</span><h4>Where to today?</h4><p class="cc-sub">Tap a stop on the map. The car drives there.</p>'
  const ro = new ResizeObserver(layout); ro.observe(q('.cc-map'))
  return { dispose() { ro.disconnect(); driving?.stop(); cleanup?.(); own.dispose(); host.innerHTML = '' } }
}
