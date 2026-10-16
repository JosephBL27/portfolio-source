import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './styles/base.css'
import { animate, scroll, inView, stagger as mStagger } from 'motion'
import { splitText, stagger, animate as aAnimate, utils, spring } from 'animejs'
import type { Stage } from './gl/stage'
import { projects, network, graph, site } from './data'
import { state, setNight, setPaused, setSound } from './state'
import { bus } from './bus'
import { chicagoNowMinutes, clockLabel, storyIndex, SIM_MIN_PER_SEC, WEEK } from './sim/schedule'
const GLOBE_R = 0.62

// Optional modules built in parallel. import.meta.glob returns {} if a file does not exist yet.
const optional = import.meta.glob(['./gl/brain.ts', './ui/halftone.ts', './ui/offboard.ts', './audio/sound.ts', './ui/boot.ts', './gl/tv.ts', './ui/works.ts', './ui/case.ts'])
const load = async <T = any>(p: string): Promise<T | null> => {
  if (!optional[p]) return null
  try { return (await optional[p]()) as T } catch (e) { console.warn('module not ready', p, e); return null }
}

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll(s)) as T[]
document.documentElement.dataset.theme = state.night ? 'night' : 'day'
if (state.reduced) document.documentElement.classList.add('reduced')

// ---------------------------------------------------------------- WebGL stage
const canvas = $<HTMLCanvasElement>('#gl')
let stage: Stage | null = null
const progress = { v: 0.2 }
// three.js lives in its own chunk: text and fonts paint first, the system streams in
const glReady = import('./gl/stage').then(m => {
  try { stage = m.createStage(canvas, document.getElementById('gl-top') as HTMLCanvasElement) } catch (e) { console.warn('WebGL unavailable', e); canvas.remove(); return }
  progress.v += 0.2
  initGL()
}).catch(e => console.warn('gl chunk failed', e))

// Brain: the parallel module if present, else a placeholder globe.
let brain: any = null
async function mountBrain() {
  if (!stage) return
  const mod = await load<any>('./gl/brain.ts')
  if (mod?.createBrain) {
    brain = mod.createBrain({ radius: GLOBE_R, envMap: stage.envMap })
    stage.brainSlot.add(brain.group)
    brain.setNight?.(state.night)
  }
  await stage.warm()
  glWarm = true
  progress.v += 0.3
}

// ---------------------------------------------------------------- sim clock
let sim = chicagoNowMinutes()
let lastT = performance.now()
let scrubbing = false
const flightsListeners: ((n: number) => void)[] = []

// ---------------------------------------------------------------- station labels
const labelsEl = $('#labels')
const labelEls = new Map<string, HTMLElement>()
function initGL() {
  if (!stage) return
  for (const s of stage.network.layout.stations) {
    const el = document.createElement('span')
    el.className = 'lab' + (s.ring === 'source' ? ' src' : s.ring === 'output' ? ' out' : '')
    el.textContent = s.node.label
    labelsEl.appendChild(el); labelEls.set(s.node.id, el)
  }
  stage.network.onArrive((s, f) => {
    if (s.ring === 'port') {
      if (brain?.pulseAt) brain.pulseAt(s.pos)
      else brain?.pulse?.()
    }
    const el = labelEls.get(s.node.id)
    if (el && labelOpacity > 0.3) { el.classList.add('hot'); setTimeout(() => el.classList.remove('hot'), 420) }
    if (state.sound && labelOpacity > 0.3) soundMod?.sound?.tick?.()
  })
  if (state.night) stage.setNight(true)
  mountBrain()
}
const screenPts: { id: string; x: number; y: number; z: number; s: any }[] = []
let labelOpacity = 0
const placed: { x: number; y: number; w: number; h: number }[] = []
const labelW = new Map<string, number>()
let hoverId: string | null = null
const hoverNbrs = new Set<string>()
let netDim = 1
let brainW = 0, brainScroll = 0
const brainDrag = { yaw: 0, pitch: 0 }

// ---------------------------------------------------------------- scroll → framing
const sectionIds = ['hero', 'work', 'index', 'network', 'brain', 'about', 'offboard', 'contact']
const sections = sectionIds.map(id => document.getElementById(id)!)
const smooth = (x: number) => x * x * (3 - 2 * x)
let navCur = ''
function framingForScroll() {
  const y = scrollY + innerHeight * 0.55
  let i = 0
  for (let k = 0; k < sections.length; k++) if ((secTop[k] ?? 0) <= y) i = k
  let t = 0
  if (i + 1 < sections.length) {
    const span = secTop[i + 1] - secTop[i]
    t = Math.min(1, Math.max(0, (y - secTop[i] - span * 0.45) / (span * 0.55)))
  }
  stage?.setScrollFraming(sectionIds[i], sectionIds[i + 1] ?? sectionIds[i], smooth(t))
  // labels show while the network framing dominates; the brain framing dims the plumbing
  const cur = sectionIds[i], nxt = sectionIds[i + 1]
  if (cur !== navCur) {
    navCur = cur
    const h = ({ hero: '', work: '#work', index: '#index', network: '#network', brain: '#network', about: '#contact', offboard: '#contact', contact: '#contact' } as Record<string, string>)[cur] ?? ''
    $$('.bar-nav a').forEach(a => (a.getAttribute('href') === h ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')))
  }
  const net = cur === 'network' ? 1 - t : nxt === 'network' ? t : 0
  const br = cur === 'brain' ? 1 - smooth(t) * 0.0 : cur === 'network' ? smooth(t) : 0
  netDim = 1 - 0.68 * br
  brainW = br
  const bi = sectionIds.indexOf('brain')
  brainScroll = Math.min(1, Math.max(0, (scrollY + innerHeight - secTop[bi]) / (secH[bi] + innerHeight)))
  labelOpacity = Math.max(0, Math.min(1, net * 1.4 - 0.25))
}

// ---------------------------------------------------------------- hero capsule + name gap
const slot = $('.name .slot')
const w1 = $('.name .w1'), w2 = $('.name .w2')
let heroP = 0
let heroIntroT0 = -1 // set when the boot hands over; the hero capsule flies in from the right
scroll((p: number) => { heroP = p }, { target: $('#hero'), offset: ['start start', 'end start'] })

// ---------------------------------------------------------------- measurements (no forced layout in the loop)
let slotDoc = { x: 0, y: 0, w: 0, h: 0 }
let secTop: number[] = [], secH: number[] = []
let wrapped = false
const keepOut = () => $$('.hero-inner > *, .panel, .cue, .live')
function measure() {
  const r = slot.getBoundingClientRect()
  slotDoc = { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }
  secTop = sections.map(s => s.offsetTop); secH = sections.map(s => s.offsetHeight)
  wrapped = w2.offsetTop > w1.offsetTop + 4
}
new ResizeObserver(measure).observe(document.body)
document.fonts.ready.then(measure)
measure()
// opaque sections hide the main canvas; skip drawing it there
const OPAQUE = ['work', 'index', 'about', 'offboard']
function glCovered() {
  const y0 = scrollY, y1 = scrollY + innerHeight
  // covered when the viewport lies inside one contiguous run of opaque sections
  let runStart = -1
  for (let k = 0; k < sectionIds.length; k++) {
    const op = OPAQUE.includes(sectionIds[k])
    if (op && runStart < 0) runStart = secTop[k]
    if (!op) runStart = -1
    if (op && runStart >= 0 && y0 >= runStart && y1 <= secTop[k] + secH[k]) return true
  }
  return false
}
let idleFrames = 0
for (const t of ['pointermove', 'pointerdown', 'wheel', 'keydown', 'scroll', 'resize']) addEventListener(t, () => (idleFrames = 0), { passive: true })
let glWarm = false
const heroTrk = createTracker(document.getElementById('trackers')!, 'accent')
const tvTrk = createTracker(document.getElementById('trackers')!)

// ---------------------------------------------------------------- render loop
let visible = true
document.addEventListener('visibilitychange', () => { visible = !document.hidden; lastT = performance.now() })
let storyI = -1
const liveClock = $('#live-clock'), liveStory = $('#live-story'), bigClock = $('#big-clock')
const storyLis: HTMLElement[] = []

function frame(now: number) {
  requestAnimationFrame(frame)
  if (!visible) return
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now
  if (!state.paused && !state.reduced && !scrubbing) sim = (sim + dt * SIM_MIN_PER_SEC) % WEEK
  // clock + story
  const lbl = clockLabel(sim)
  if (liveClock.textContent !== lbl) { liveClock.textContent = lbl; bigClock.textContent = lbl; drawHand() }
  const si = storyIndex(sim)
  if (si !== storyI) {
    storyI = si
    liveStory.textContent = network.story[si]
    storyLis.forEach((li, k) => li.classList.toggle('on', k === si))
  }
  if (!stage || !glWarm) return
  // hero capsule follows its DOM slot, launches on scroll, the name closes its gap
  const launch = Math.min(1, Math.max(0, (heroP - 0.08) / 0.5))
  const gap = Math.min(1, Math.max(0, (heroP - 0.12) / 0.3))
  const slotRect = new DOMRect(slotDoc.x, slotDoc.y - scrollY, slotDoc.w, slotDoc.h)
  const intro = heroIntroT0 < 0 ? 0 : state.reduced ? 1 : Math.min(1, (now - heroIntroT0) / 1100)
  if (intro < 1) {
    // arrive: fast off the line from the right edge, brake on air, one small seat bounce
    const e = 1 - Math.pow(1 - intro, 3.2)
    const bounce = intro > 0.78 ? Math.sin(((intro - 0.78) / 0.22) * Math.PI) * 0.06 : 0
    const cx = slotRect.left + slotRect.width / 2 + (1 - e) * (innerWidth * 0.75)
    stage.heroCapsule.setScreen(cx, slotRect.top + slotRect.height / 2 - Math.sin(e * Math.PI) * 40, slotRect.width * 0.98 * (1 + bounce), -(1 - e) * 0.35, heroIntroT0 < 0 ? 0 : 1)
    stage.heroCapsule.setSpin(heroIntroT0 < 0 ? 0 : 2 + 26 * (1 - e))
  } else {
    stage.heroCapsule.setSpin(null)
    const narrow = innerWidth <= 860
    stage.heroCapsule.place(slotRect.bottom > -200 ? slotRect : null, launch, narrow ? 1 - Math.min(1, launch / 0.3) : 1 - Math.max(0, (launch - 0.7) / 0.3))
  }
  const shift = slotRect.width * 0.5 * smooth(gap)
  const tx1 = `translateX(${shift}px)`, tx2 = wrapped ? 'none' : `translateX(${-shift}px)`
  if (w1.style.transform !== tx1) w1.style.transform = tx1
  if (w2.style.transform !== tx2) w2.style.transform = tx2

  // trackers: the capsule while it sits in the name, the TV screen while the set is on
  if (!state.reduced) {
    const heroVis = slotRect.bottom > 0 && slotRect.top < innerHeight && launch < 0.05 && intro >= 1
    heroTrk.set(heroVis ? slotRect : null, 'NO. 01 · IN TRANSIT')
    heroTrk.step(dt)
    const wr = $('#work').getBoundingClientRect()
    const sr = wr.top < innerHeight * 0.3 && wr.bottom > innerHeight * 0.7 ? tv?.screenRect?.() : null
    tvTrk.set(sr && sr.width > 10 ? sr : null, `CH ${String(channel + 1).padStart(2, '0')} · ON AIR`)
    tvTrk.step(dt)
  }
  framingForScroll()
  const covered = glCovered()
  if (!covered) {
    stage.network.setDim(netDim)
    const flights = stage.network.update(sim, state.paused ? 0 : dt)
    flightsListeners.forEach(f => f(flights.length))
    if (brain?.setTurn) {
      const sy = state.reduced ? 0 : (smooth(Math.min(1, Math.max(0, (brainScroll - 0.3) / 0.45))) * 1.25)
      brain.setTurn(sy + brainDrag.yaw, 0.18 * Math.sin(sy * 1.3) + brainDrag.pitch)
    }
    brain?.setGlow?.(stage.network.capsGlow)
    brain?.update?.(dt, now / 1000)
  }
  // paused and nothing moving: stop drawing after ~0.5 s
  idleFrames = state.paused && !scrubbing && stage.isSettled() ? idleFrames + 1 : 0
  stage.render(!covered && idleFrames < 30)
  // labels
  if (labelOpacity > 0.01 && !covered) {
    labelsEl.style.display = ''
    stage.network.stationScreen(stage.camera, innerWidth, innerHeight, screenPts)
    placed.length = 0
    for (const k of keepOut()) { const r = k.getBoundingClientRect(); if (r.width && r.bottom > 0 && r.top < innerHeight) placed.push({ x: r.left - 6, y: r.top - 4, w: r.width + 12, h: r.height + 8 }) }
    // ports first (inside the globe ring), then by importance: sources/outputs, then agents
    const order = screenPts.slice().sort((a, b) => (a.s.ring === 'port' ? -1 : 0) - (b.s.ring === 'port' ? -1 : 0))
    for (const p of order) {
      const el = labelEls.get(p.id)!
      let w = labelW.get(p.id) ?? 0
      if (!w) { w = el.offsetWidth; if (w) labelW.set(p.id, w); else w = 80 }
      const h = 15
      const below = p.s.ring === 'port' ? false : p.s.pos.y < 0.15
      const tries: [number, number][] = below ? [[0, 20], [0, -34], [w / 2 + 22, -7], [-w / 2 - 22, -7], [0, 34]] : [[0, -34], [0, 20], [w / 2 + 22, -7], [-w / 2 - 22, -7], [0, -48]]
      let ok: [number, number] | null = null
      for (const [dx, dy] of tries) {
        const cx = Math.min(innerWidth - w / 2 - 6, Math.max(w / 2 + 6, p.x + dx))
        const box = { x: cx - w / 2, y: p.y + dy, w, h }
        if (!placed.some(b => box.x < b.x + b.w + 4 && box.x + box.w + 4 > b.x && box.y < b.y + b.h + 2 && box.y + box.h + 2 > b.y)) { ok = [cx - p.x, dy]; placed.push(box); break }
      }
      const [dx, dy] = ok ?? tries[0]
      el.style.transform = `translate(${Math.round(p.x + dx)}px, ${Math.round(p.y + dy)}px) translate(-50%, 0)`
      el.style.opacity = String((ok ? 1 : innerWidth <= 860 ? 0 : 0.12) * (hoverId && hoverId !== p.id && !hoverNbrs.has(p.id) ? 0.3 : 1) * labelOpacity)
    }
  } else if (labelsEl.style.display !== 'none') labelsEl.style.display = 'none'
}
requestAnimationFrame(frame)


// ---------------------------------------------------------------- station hover card
let focusStation: (id: string) => void = () => {}
bus.on('station', ({ id }) => id && focusStation(id))
{
  const card = $('#card')
  const kindName: Record<string, string> = { source: 'Source', agent: 'Agent', brain: 'Brain', output: 'Output' }
  let lastMove = 0, leaveT = 0
  addEventListener('pointermove', e => {
    if (!stage || labelOpacity < 0.5 || (e.target as any)?.closest?.('.panel,.bar,dialog')) { if (hoverId) setHover(null); return }
    const now = performance.now(); if (now - lastMove < 30) return; lastMove = now
    let best: any = null, bd = 26 * 26
    for (const p of screenPts) { const d = (p.x - e.clientX) ** 2 + (p.y - e.clientY) ** 2; if (d < bd) { bd = d; best = p } }
    if (best) { clearTimeout(leaveT); leaveT = 0; setHover(best.id) }
    else if (hoverId && !leaveT) leaveT = window.setTimeout(() => { leaveT = 0; setHover(null) }, 120)
    if (best && card.dataset.id !== best.id) {
      card.dataset.id = best.id
      const n = best.s.node
      const proj = n.project ? projects.find(p => p.id === n.project) : null
      card.innerHTML = `<p class="mono dim">${kindName[n.kind]} · ${n.schedule}</p><p class="card-t">${n.label}</p><p class="card-d">${n.detail}</p>${proj && reelIndexFor(proj.id) >= 0 ? `<p class="mono card-p">Click to open ${proj.name} →</p>` : proj ? `<p class="mono card-p dim">Part of ${proj.name}</p>` : ''}`
    }
    if (best) {
      card.hidden = false
      const x = Math.min(innerWidth - 300, best.x + 24), y = Math.max(64, Math.min(innerHeight - 180, best.y - 20))
      card.style.transform = `translate(${x}px, ${y}px)`
    }
  }, { passive: true })
  focusStation = (id: string) => {
    document.getElementById('network')!.scrollIntoView({ behavior: state.reduced ? 'auto' : 'smooth' })
    const hn = document.getElementById('h-network')!; hn.tabIndex = -1; hn.focus({ preventScroll: true })
    setTimeout(() => { setHover(id); setTimeout(() => setHover(null), 3200) }, state.reduced ? 50 : 900)
  }
  function setHover(id: string | null) {
    if (id === hoverId) return
    hoverId = id; hoverNbrs.clear()
    if (id) network.edges.forEach(e => { if (e.from === id) hoverNbrs.add(e.to); if (e.to === id) hoverNbrs.add(e.from) })
    stage?.network.setFocus(id)
    if (!id) { card.hidden = true; card.dataset.id = '' }
    document.body.style.cursor = id ? 'pointer' : ''
  }
  addEventListener('click', e => {
    if (!hoverId || (e.target as HTMLElement).closest('a,button,.panel,dialog')) return
    const n = network.nodes.find(x => x.id === hoverId)
    if (n?.project) openProject(n.project, null)
  })
}

// ---------------------------------------------------------------- drag the network (springs back)
{
  const SEAT = spring({ stiffness: 380, damping: 26 })
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
  let down = false, sx = 0, sy = 0, brainMode = false
  const off = { yaw: 0, pitch: 0 }, base = { yaw: 0, pitch: 0 }, bBase = { yaw: 0, pitch: 0 }
  let back: any = null, bBack: any = null
  addEventListener('pointerdown', e => {
    const t = e.target as HTMLElement
    if (t.closest('a,button,input,summary,table,.panel,dialog,.dial,.bar,.work,.index-section') || e.button !== 0) return
    back?.cancel?.(); bBack?.cancel?.(); back = bBack = null
    down = true; sx = e.clientX; sy = e.clientY
    brainMode = brainW > 0.5
    base.yaw = off.yaw; base.pitch = off.pitch; bBase.yaw = brainDrag.yaw; bBase.pitch = brainDrag.pitch
  })
  addEventListener('pointermove', e => {
    if (!down || !stage) return
    const dx = e.clientX - sx, dy = e.clientY - sy
    if (brainMode) { brainDrag.yaw = bBase.yaw + dx / innerWidth * 4; brainDrag.pitch = clamp(bBase.pitch + dy / innerHeight * 2.5, -0.9, 0.9); return }
    off.yaw = clamp(base.yaw - dx / innerWidth * 1.4, -0.6, 0.6); off.pitch = clamp(base.pitch - dy / innerHeight * 0.9, -0.35, 0.35)
    stage.setDrag(off.yaw, off.pitch)
  })
  const release = () => {
    if (!down) return
    down = false
    if (state.reduced) { off.yaw = off.pitch = 0; brainDrag.pitch = 0; stage?.setDrag(0, 0); return }
    if (brainMode) { bBack = aAnimate(brainDrag, { pitch: 0, ease: SEAT }); return }
    back = aAnimate(off, { yaw: 0, pitch: 0, ease: SEAT, onUpdate: () => stage?.setDrag(off.yaw, off.pitch) })
  }
  addEventListener('pointerup', release)
  addEventListener('pointercancel', release)
}

// ---------------------------------------------------------------- hero copy
let heroIn = () => {}
{
  const proof = $('#proof')
  const running = projects.filter(p => p.status === 'running').length
  const sb = projects.find(p => p.id === 'second-brain')!
  const cells: [string, string][] = [
    [String(projects.length), 'projects'],
    [String(running), 'running'],
    [sb.metrics[4].value, 'scheduled jobs write into the brain'],
    [sb.metrics[3].value, 'agents boot from it'],
  ]
  proof.innerHTML = cells.map(([v, l]) => `<li><b>${v}</b><span>${l}</span></li>`).join('')
  // entrance: prepared now (hidden), played when the boot hands over
  if (!state.reduced) {
    const chars = [w1, w2].flatMap(w => splitText(w, { chars: { wrap: 'clip' } }).chars)
    utils.set(chars, { y: '105%' })
    $$<HTMLElement>('.live, .cue').forEach(e => (e.style.opacity = '0'))
    heroIn = () => {
      aAnimate(chars, { y: ['105%', '0%'], duration: 900, delay: stagger(22, { start: 60 }), ease: 'outExpo' })
      animate($$('.hero .reveal'), { opacity: [0, 1], y: [14, 0] }, { delay: mStagger(0.07, { startDelay: 0.3 }), duration: 0.7, ease: [0.2, 0.9, 0.3, 1] })
      animate('.live, .cue', { opacity: [0, 1] }, { delay: 0.7, duration: 0.6 })
    }
  } else $$('.reveal').forEach(e => (e.style.opacity = '1'))
}

// ---------------------------------------------------------------- network panel: story, dial, list
{
  const ol = $('#story')
  network.story.forEach(s => { const li = document.createElement('li'); li.textContent = s; ol.appendChild(li); storyLis.push(li) })
  const list = $('#stationList')
  const kinds: [string, string][] = [['source', 'Sources'], ['agent', 'Agents'], ['brain', 'Brain'], ['output', 'Outputs']]
  list.innerHTML = kinds.map(([k, t]) => `<h3>${t}</h3><ul>${network.nodes.filter(n => n.kind === k).map(n => `<li><b>${n.label}</b> · ${n.schedule}. ${n.detail}</li>`).join('')}</ul>`).join('') +
    `<h3>Tubes</h3><ul>${network.edges.map(e => { const a = network.nodes.find(n => n.id === e.from)!, b = network.nodes.find(n => n.id === e.to)!; return `<li>${a.label} → ${b.label}: ${e.label}, ${e.cadence}</li>` }).join('')}</ul>`
}
const dial = $<SVGSVGElement>('#dial')
let handEl: SVGLineElement
{
  const NS = 'http://www.w3.org/2000/svg'
  const mk = (tag: string, attrs: Record<string, string | number>) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, String(attrs[k])); dial.appendChild(e); return e }
  mk('circle', { cx: 84, cy: 84, r: 78, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1 })
  mk('circle', { cx: 84, cy: 84, r: 62, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.5 })
  for (let h = 0; h < 24; h++) {
    const a = (h / 24) * Math.PI * 2 - Math.PI / 2, major = h % 6 === 0
    const r0 = major ? 50 : 56
    mk('line', { x1: 84 + Math.cos(a) * r0, y1: 84 + Math.sin(a) * r0, x2: 84 + Math.cos(a) * 62, y2: 84 + Math.sin(a) * 62, stroke: 'var(--ink)', 'stroke-width': major ? 1.5 : 0.8 })
    if (major) { const t = mk('text', { x: 84 + Math.cos(a) * 40, y: 84 + Math.sin(a) * 40 + 3.5, 'text-anchor': 'middle', 'font-size': 9, 'font-family': 'IBM Plex Mono', fill: 'var(--graphite)' }); t.textContent = String(h).padStart(2, '0') }
  }
  // pips at real job times
  const times = new Set<number>()
  network.nodes.forEach(n => n.times.forEach(t => { const [h, m] = t.split(':').map(Number); times.add(h * 60 + m) }))
  times.forEach(m => { const a = (m / 1440) * Math.PI * 2 - Math.PI / 2; mk('circle', { cx: 84 + Math.cos(a) * 70, cy: 84 + Math.sin(a) * 70, r: 2.6, fill: 'var(--brain)' }) })
  handEl = mk('line', { x1: 84, y1: 84, x2: 84, y2: 26, stroke: 'var(--brain)', 'stroke-width': 2, 'stroke-linecap': 'round' }) as SVGLineElement
  mk('circle', { cx: 84, cy: 84, r: 4, fill: 'var(--brain)' })
  const setFromPointer = (e: PointerEvent) => {
    const r = dial.getBoundingClientRect()
    const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) + Math.PI / 2
    const m = (((a / (Math.PI * 2)) % 1) + 1) % 1 * 1440
    sim = Math.floor(sim / 1440) * 1440 + m
    drawHand()
  }
  dial.addEventListener('pointerdown', e => { scrubbing = true; dial.setPointerCapture(e.pointerId); setFromPointer(e) })
  dial.addEventListener('pointermove', e => { if (scrubbing) setFromPointer(e) })
  dial.addEventListener('pointerup', () => { scrubbing = false })
  dial.addEventListener('pointercancel', () => { scrubbing = false })
  dial.addEventListener('lostpointercapture', () => { scrubbing = false })
  dial.addEventListener('keydown', e => {
    const st = e.shiftKey ? 60 : 15
    const d = ({ ArrowRight: st, ArrowUp: st, ArrowLeft: -st, ArrowDown: -st, PageUp: 180, PageDown: -180 } as Record<string, number>)[e.key]
    if (!d) return
    e.preventDefault(); sim = ((sim + d) % WEEK + WEEK) % WEEK; drawHand()
  })
}
function drawHand() {
  const m = sim % 1440
  const a = (m / 1440) * Math.PI * 2 - Math.PI / 2
  handEl?.setAttribute('x2', String(84 + Math.cos(a) * 60))
  handEl?.setAttribute('y2', String(84 + Math.sin(a) * 60))
  dial.setAttribute('aria-valuenow', String(Math.round(m)))
  dial.setAttribute('aria-valuetext', clockLabel(sim))
}

// ---------------------------------------------------------------- brain panel: folders
{
  const el = $('#folders')
  const counts = graph.stats.folders as Record<string, number>
  graph.groups.forEach((g, i) => {
    const b = document.createElement('button')
    b.className = 'folder'; b.setAttribute('aria-pressed', 'false')
    b.innerHTML = `<span>${g === 'other' ? 'Root' : g}</span><b>${counts[g] ?? 0}</b>`
    if (!counts[g]) b.disabled = true
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true'
      $$('.folder', el).forEach(x => x.setAttribute('aria-pressed', 'false'))
      b.setAttribute('aria-pressed', String(on))
      brain?.focusFolder?.(on ? i : null)
    })
    el.appendChild(b)
  })
}

// ---------------------------------------------------------------- the set: TV + index + case view
import { REELS } from './reels'
import { createTracker } from './ui/tracker'
const featured = REELS
const reelIndexFor = (projectId: string) => featured.findIndex(r => r.projectId === projectId)
let tv: any = null
let lastPointer: { x: number; y: number } | null = null
addEventListener('pointerdown', e => { lastPointer = { x: e.clientX, y: e.clientY } }, { passive: true, capture: true })
let caseView: any = null
let channel = 0
let lastScrollCh = -1
const caseReady = load<any>('./ui/case.ts').then(m => { if (m?.initCase) caseView = m.initCase({ reels: featured, onStep: (i: number) => setChannel(i, true), onClose: () => {} }) })
function screenFrom(el?: HTMLElement | null): DOMRect | undefined {
  if (el) return el.getBoundingClientRect()
  const r = tv?.screenRect?.()
  if (r && r.width > 4 && r.bottom > 0 && r.top < innerHeight) return r
  return lastPointer ? new DOMRect(lastPointer.x - 80, lastPointer.y - 50, 160, 100) : new DOMRect(innerWidth / 2 - 80, innerHeight / 2 - 50, 160, 100)
}
async function openWork(i: number, fromEl?: HTMLElement | null) {
  bus.emit('dispatch', { id: featured[i]?.projectId ?? '' })
  soundMod?.sound?.thwoop?.()
  await caseReady
  if (caseView) caseView.open(i, screenFrom(fromEl))
}
// back-compat: anything that asks for a project by id opens its work if featured
function openProject(id: string, fromEl?: HTMLElement | null) {
  const i = reelIndexFor(id)
  if (i >= 0) openWork(i, fromEl)
}
const chN = $('#ch-n'), chTitle = $('#ch-title'), chMedium = $('#ch-medium'), chDots = $('#ch-dots')
$('#ch-total').textContent = String(featured.length).padStart(2, '0')
chDots.innerHTML = featured.map((r, i) => `<li><button class="dot" data-ch="${i}" aria-label="Channel ${i + 1}: ${projects.find(p => p.id === r.projectId)?.name ?? r.title}"><span class="mono">${String(i + 1).padStart(2, '0')}</span></button></li>`).join('')
chDots.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-ch]') as HTMLElement | null; if (b) setChannel(+b.dataset.ch!, false, true) })
function renderChannelUI(i: number) {
  const r = featured[i]; if (!r) return
  const p = projects.find(x => x.id === r.projectId)
  chN.textContent = String(i + 1).padStart(2, '0')
  chMedium.textContent = `${r.title} · ${r.medium}`
  chTitle.textContent = p?.name ?? r.title
  $$('.dot', chDots).forEach((d, k) => d.setAttribute('aria-current', String(k === i)))
  document.documentElement.style.setProperty('--ch-accent', r.colors.accent)
  if (!state.reduced) {
    aAnimate(chTitle, { opacity: [0, 1], y: ['40%', '0%'], duration: 520, ease: 'outExpo' })
    aAnimate(chMedium, { opacity: [0, 1], duration: 400, delay: 120 })
  }
}
function setChannel(i: number, fromCase = false, scrollTo = false) {
  const n = featured.length
  i = ((i % n) + n) % n
  if (i === channel && tv?.channel?.() === i) return
  channel = i
  tv?.setChannel?.(i)
  renderChannelUI(i)
  soundMod?.sound?.tick?.()
  if (scrollTo && !fromCase) {
    // keep scroll in sync with the dial so the next scroll does not jump back
    const w = $('#work'); const span = w.offsetHeight - innerHeight
    lastScrollCh = i
    scrollToY(w.offsetTop + span * ((i + 0.5) / n))
  }
}
function syncScrollTo(i: number) {
  const w = $('#work'), r = w.getBoundingClientRect()
  if (r.top > 1 || r.bottom < innerHeight - 1) return // only while the set is pinned
  const span = w.offsetHeight - innerHeight
  lastScrollCh = i
  scrollToY(w.offsetTop + span * ((i + 0.5) / featured.length))
}
function scrollToY(y: number) { window.scrollTo({ top: y, behavior: state.reduced ? 'auto' : 'smooth' }) }
renderChannelUI(0)
$('#ch-prev').addEventListener('click', () => setChannel(channel - 1, false, true))
$('#ch-next').addEventListener('click', () => setChannel(channel + 1, false, true))
$('#ch-open').addEventListener('click', () => openWork(channel))
// scroll through the pinned set changes channel, like turning the dial
scroll((p: number) => {
  const ch = Math.min(featured.length - 1, Math.floor(p * featured.length * 0.999))
  tv?.setScroll?.(p)
  if (ch !== lastScrollCh) { lastScrollCh = ch; if (ch !== channel) setChannel(ch) }
}, { target: $('#work'), offset: ['start start', 'end end'] })
addEventListener('keydown', e => {
  if (caseView?.isOpen?.() || (e.target as HTMLElement).closest?.('input,textarea,[contenteditable]')) return
  const r = $('#work').getBoundingClientRect()
  if (r.top > innerHeight * 0.5 || r.bottom < innerHeight * 0.5) return
  if (e.key === 'ArrowRight') { e.preventDefault(); setChannel(channel + 1, false, true) }
  if (e.key === 'ArrowLeft') { e.preventDefault(); setChannel(channel - 1, false, true) }
  if (e.key === 'Enter' && document.activeElement === document.body) openWork(channel)
})
load<any>('./gl/tv.ts').then(m => {
  if (!m?.createTV) return
  try {
    tv = m.createTV($<HTMLCanvasElement>('#tv'), { reels: featured, onChannel: (i: number) => { if (i !== channel) { channel = i; renderChannelUI(i); syncScrollTo(i) } }, onOpen: (i: number) => openWork(i) })
    tv.setChannel(channel, { instant: true })
    tv.setNight?.(state.night)
    bus.on('theme', ({ night }) => tv?.setNight?.(night))
    bus.on('pause', ({ paused }) => tv?.setPaused?.(paused))
  } catch (e) { console.warn('tv failed', e) }
})
load<any>('./ui/works.ts').then(m => { if (m?.initWorks) m.initWorks($('#index'), { reels: featured, onOpen: (i: number, el: HTMLElement) => openWork(i, el) }) })
document.addEventListener('click', e => {
  const a = (e.target as HTMLElement).closest('[data-open]') as HTMLElement | null
  if (a) { e.preventDefault(); openProject(a.dataset.open!, a) }
})

// ---------------------------------------------------------------- toggles
let soundMod: any = null
{
  const tp = $('#t-pause'), ts = $('#t-sound'), tn = $('#t-night')
  tn.setAttribute('aria-pressed', String(state.night))
  tp.addEventListener('click', () => { setPaused(!state.paused); tp.classList.toggle('on', state.paused); document.documentElement.classList.toggle('paused', state.paused); tp.querySelector('.tl')!.textContent = state.paused ? 'Resume' : 'Pause' })
  ts.addEventListener('click', async () => {
    soundMod = soundMod ?? (await load<any>('./audio/sound.ts'))
    const on = !state.sound
    if (on) await soundMod?.sound?.enable?.(); else soundMod?.sound?.disable?.()
    setSound(on); ts.setAttribute('aria-pressed', String(on)); ts.textContent = on ? 'Sound on' : 'Sound off'
    if (on) soundMod?.sound?.thwoop?.()
  })
  tn.addEventListener('click', () => {
    const go = () => { setNight(!state.night); tn.setAttribute('aria-pressed', String(state.night)) }
    const vt = (document as any).startViewTransition
    vt && !state.reduced ? vt.call(document, go) : go()
  })
  bus.on('theme', ({ night }) => { stage?.setNight(night); brain?.setNight?.(night); document.querySelector('meta[name=theme-color]')?.setAttribute('content', night ? '#0E0F10' : '#EEECE6') })
}

// ---------------------------------------------------------------- about: echo copies converge as you scroll in
{
  const host = $('[data-echo]')
  const N = 5
  const copies: HTMLElement[] = []
  for (let k = 1; k <= N; k++) {
    const c = document.createElement('div')
    c.className = 'echo-copy'; c.setAttribute('aria-hidden', 'true')
    c.innerHTML = host.innerHTML
    host.appendChild(c); copies.push(c)
  }
  const apply = (p: number) => {
    // p: 0 entering → 1 settled. Echoes trail upward and fan out, then collapse into the line.
    const spread = state.reduced ? 0 : Math.max(0, 1 - p) ** 1.4
    copies.forEach((c, k) => {
      const i = k + 1
      c.style.transform = `translateY(${-i * 26 * spread}px) scale(${1 - i * 0.012 * spread})`
      c.style.opacity = String(spread > 0.002 ? (0.5 - i * 0.08) * Math.min(1, spread * 3) : 0)
    })
  }
  apply(0)
  scroll((p: number) => apply(Math.min(1, p * 1.25)), { target: $('#about'), offset: ['start end', 'center center'] })
}

// ---------------------------------------------------------------- contact
{
  const live = $('#live')
  $('#copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(site.bio.email); live.textContent = ''; requestAnimationFrame(() => (live.textContent = 'Address copied')); $('#copy span:last-child').textContent = 'Copied' }
    catch { live.textContent = site.bio.email; $('#copy span:last-child').textContent = site.bio.email }
    setTimeout(() => ($('#copy span:last-child').textContent = 'Copy address'), 1600)
  })
  const cap = $('.sendcap')
  $$('[data-send]').forEach(a => a.addEventListener('click', () => {
    soundMod?.sound?.thwoop?.()
    if (state.reduced) return
    animate(cap, { opacity: [1, 1, 0], y: [0, -innerHeight * 1.1] }, { duration: 0.6, ease: [0.55, 0, 1, 0.45] })
  }))
  inView('.contact-h', el => { if (!state.reduced) animate(el, { opacity: [0, 1], y: [30, 0] }, { duration: 0.8, ease: [0.2, 0.9, 0.3, 1] }) })
}

// ---------------------------------------------------------------- optional parallel modules
const bootDone = load<any>('./ui/boot.ts').then(async m => {
  if (m?.runBoot) await m.runBoot({ progress: () => Math.min(1, progress.v + (document.fonts.status === 'loaded' ? 0.3 : 0)) })
  heroIn()
  await glReady
  heroIntroT0 = performance.now()
})
bootDone.then(() => load<any>('./ui/halftone.ts')).then(m => {
  if (!m?.mountHalftone) return
  const ink = () => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()
  const hs = $$<HTMLCanvasElement>('#corners .ht').map((c, i) => m.mountHalftone(c, c.dataset.shape, { ink: ink(), cell: 7, turnSeconds: i ? -80 : 60 }))
  const aura = $<HTMLCanvasElement>('.work-aura')
  if (aura) hs.push(m.mountHalftone(aura, 'record', { ink: ink(), cell: 9, turnSeconds: 90, shadow: false }))
  bus.on('theme', () => requestAnimationFrame(() => hs.forEach(h => h.setInk(ink()))))
  let cornersOff = false
  const corners = hs.slice(0, 2)
  bus.on('pause', ({ paused }) => { corners.forEach(h => h.setPaused(paused || cornersOff)); hs.slice(2).forEach(h => h.setPaused(paused)) })
  // corner pieces fade as the hero leaves, and stop redrawing once gone
  scroll((p: number) => {
    const el = $('#corners'), o = 1 - Math.min(1, p * 1.6)
    el.style.opacity = String(o)
    const offNow = o <= 0
    if (offNow !== cornersOff) { cornersOff = offNow; el.style.visibility = offNow ? 'hidden' : ''; corners.forEach(h => h.setPaused(offNow || state.paused)) }
  }, { target: $('#hero'), offset: ['start start', 'end start'] })
})
bootDone.then(() => load<any>('./ui/offboard.ts')).then(m => { m?.initOffBoard?.($('#offboard')); measure() })

document.fonts.ready.then(() => (progress.v += 0.3))

// expose for debugging and screenshots
;(window as any).__pneuma = { get sim() { return sim }, set sim(v: number) { sim = v }, get stage() { return stage }, get tv() { return tv }, utils }
