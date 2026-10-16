// Navigation (v10): the visitor can always get to the section they want.
//   - a persistent top bar: Overview (O), Index (M), Contact (C), and a back-to-the-hub chevron while inside an area
//   - the Overview (overview.ts): one scannable page for a recruiter (education, experience, every project, contact); #overview deep-links to it
//   - the Index menu: the hub and six areas as large serif entries, each with its projects; one live reel preview
//   - a ring radar (bottom-left on a desktop; not drawn in the phone band): where the camera is, which way it faces, click an area to fly there
//   - keys: M menu, C contact, 1-6 areas in ring order, 0 / H the hub, Esc closes (or, from inside an area, flies back to the hub)
//     (the arrow keys stay with the POV nudge in world/extras/pov.ts)
//   - deep links: #work, #qvr, #school ... fly there on load; every dwell replaces the hash, explicit moves push it (back / forward work)
//   - area labels hung on the ring at the establishing shot: click to fly
// ui.ts owns the flight (jumpTo) and passes it in as env.fly; nothing here moves the camera itself.
import { animate, stagger } from 'animejs'
import { AREAS, type Waypoint } from '../world/layout'
import { CASE_REELS } from '../../reels/index'
import { createReelCanvas, type ReelCanvas } from '../../reels/mini'
import { AREA_COPY, AREA_NAME, AREA_ORDER, AREA_PLAIN, PROJECTS, stopAt, stopsOf, type StopInfo } from './copy'
import { buildContact, LINKS } from './epilogue'
import { buildOverview, KIND_HOME } from './overview'
import type { FlightState, Vec3 } from './types'
import { h, isRm } from './util'
import { state as appState } from '../../state'

export interface NavEnv {
  waypoints: Waypoint[]
  /** fly the camera to waypoint i (the rail jump: a timed flight of at most 3.2 s) */
  fly(wp: number): void
  /** 10A: start or end the autoplay tour (T) */
  playTour?(): void
  /** open a project's case view (the same call the TV and the overlay buttons make) */
  open(projectId: string, el: HTMLElement | null): void
  canOpen(projectId: string): boolean
  /** copy blocks on screen, so in-world labels never sit on text */
  blockers(): { l: number; t: number; r: number; b: number }[]
}
export interface Nav {
  /** the top-bar controls: slot into the HUD's top row */
  bar: HTMLElement
  /** the ring radar: slot into the HUD */
  map: HTMLElement
  /** in-world area labels: append to <body> */
  labels: HTMLElement
  frame(area: string, cam: { pos: Vec3; target: Vec3 } | null, jumping: boolean): void
  onFlight(st: FlightState, jumping: boolean): void
  /** go to an area id, project id, waypoint id, 'world' or 'top'; false when the token is unknown */
  go(token: string, push?: boolean): boolean
  /** 8C: where the camera is, in plain words (area, stop name, "2 of 5 in Systems"); the HUD reads it every frame */
  where(): StopInfo | null
  /** the case view opened on a project (its id), stepped to another, or closed (null): the address bar follows it, so it always holds the link to what is on screen */
  caseShown(projectId: string | null): void
  openOverview(): void
  closeOverview(instant?: boolean): void
  openMenu(): void
  closeMenu(instant?: boolean): void
  openContact(): void
  closeContact(instant?: boolean): void
}

/** Short names for the big menu entries (copy.ts AREA_NAME: 'Systems', 'Research' and 'The Hub' are NEW, docs/V4-COPY.md; the rest are the area kickers). */
const NAME = AREA_NAME
/** the hub entry's plain line: the world overlay's own wording (copy.ts 'world' body) */
const HUB_LINE = 'One screen and six areas around it'
const INK = '#EDE6D6'
const VB = 34 // radar half-extent in world units: the ring is 24, the camera clamps at 31
const FOV_HALF = (17.5 * Math.PI) / 180
const reelOf = (id: string) => CASE_REELS.find(r => r.projectId === id)
const projOf = (id: string) => PROJECTS.find(p => p.id === id)
const areaProjects = (a: string) => AREAS.find(x => x.id === a)?.projects ?? []

type DwellState = FlightState & { dwelling?: boolean }
interface Target { wp: number; hash: string; open?: string }

// ---------- radar ----------
interface Radar { el: HTMLElement; setArea(id: string): void; setCam(x: number, z: number, deg: number, cone: string): void; setHot(id: string | null): void }
let radarSeq = 0
function buildRadar(cls: string, pick: (area: string) => void, hot: (id: string | null) => void): Radar {
  const clipId = `mm-clip-${radarSeq++}`
  const pct = (v: number) => (50 + (v / (VB * 2)) * 100).toFixed(3) + '%'
  const spokes = AREAS.map(a => `<line x1="0" y1="0" x2="${a.center[0].toFixed(2)}" y2="${a.center[2].toFixed(2)}" style="--a:${a.accent}"/>`).join('')
  const wrap = document.createElement('div')
  wrap.innerHTML = `<svg class="mm-svg" viewBox="${-VB} ${-VB} ${VB * 2} ${VB * 2}" aria-hidden="true" focusable="false">` +
    `<defs><clipPath id="${clipId}"><circle r="${VB}"/></clipPath></defs><circle class="mm-r2" r="12"/><circle class="mm-r1" r="24"/><line class="mm-ax" x1="-31" y1="0" x2="31" y2="0"/><line class="mm-ax" x1="0" y1="-31" x2="0" y2="31"/>` +
    `${spokes}<path class="mm-cone" clip-path="url(#${clipId})" d=""/><circle class="mm-hub" r="2.3"/><g class="mm-cam"><path d="M0 -3.4 L2.4 2.5 L0 1.2 L-2.4 2.5 Z"/></g></svg>`
  const svg = wrap.firstElementChild as SVGSVGElement
  const camG = svg.querySelector('.mm-cam') as SVGGElement
  const cone = svg.querySelector('.mm-cone') as SVGPathElement
  const disc = h('div', { class: 'mm-disc' }, svg)
  const nodes = new Map<string, HTMLButtonElement>()
  const tip = h('span', { class: 'mm-tip mono', 'aria-hidden': 'true' })
  for (const a of AREAS) {
    const ac = AREA_COPY[a.id]
    const b = h('button', { class: 'mm-n', type: 'button', 'data-area': a.id, 'data-cursor': '', 'aria-label': `Fly to area ${ac.numeral}: ${NAME[a.id]}` })
    b.style.left = pct(a.center[0]); b.style.top = pct(a.center[2]); b.style.setProperty('--a', ac.accent)
    b.addEventListener('click', () => pick(a.id))
    // hover intent: 120 ms, so a pointer sweeping across the gauge does not flicker the tip and the labels
    let hoverT = 0
    b.addEventListener('pointerenter', () => { clearTimeout(hoverT); hoverT = window.setTimeout(() => hot(a.id), 120) })
    b.addEventListener('pointerleave', () => { clearTimeout(hoverT); hot(null) })
    b.addEventListener('focus', () => hot(a.id)); b.addEventListener('blur', () => hot(null))
    nodes.set(a.id, b); disc.append(b)
  }
  const el = h('div', { class: 'mm ' + cls }, disc, tip)
  let lastCam = ''
  return {
    el,
    setArea(id) { nodes.forEach((b, k) => { b.classList.toggle('act', k === id); if (k === id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current') }) },
    setCam(x, z, deg, c) {
      const k = x.toFixed(2) + z.toFixed(2) + deg.toFixed(0) + c
      if (k === lastCam) return
      lastCam = k
      camG.setAttribute('transform', `translate(${x.toFixed(2)} ${z.toFixed(2)}) rotate(${deg.toFixed(1)})`)
      cone.setAttribute('d', c)
    },
    setHot(id) {
      nodes.forEach((b, k) => b.classList.toggle('hot', k === id))
      el.classList.toggle('has-hot', !!id)
      tip.textContent = id ? `${AREA_COPY[id].numeral} · ${NAME[id]}` : ''
    },
  }
}

export function initNav(env: NavEnv): Nav {
  const html = document.documentElement
  const wps = env.waypoints
  const wpIdx = (id: string) => wps.findIndex(w => w.id === id)
  const firstOfArea = (a: string) => wps.findIndex(w => w.area === a)
  const worldI = wpIdx('world')
  const projectWp = (pid: string) => {
    let best = -1
    for (let i = 0; i < wps.length; i++) { const t = wps[i].tvs; if (t?.includes(pid)) { if (t.length === 1) return i; if (best < 0) best = i } }
    return best
  }

  // ---------- targets and the hash ----------
  /** hash token for the waypoint we are resting at: the area at its first beat, the project when a beat features exactly one */
  const dwellHash = (i: number) => {
    const w = wps[i]
    if (w.id === 'clouds') return ''
    if (w.area === 'hub') return w.id
    if (firstOfArea(w.area) === i) return w.area
    if (w.tvs && w.tvs.length === 1) return w.tvs[0]
    return w.area
  }
  // Project links: https://josephbl27.github.io/#<id> (docs/LINKS.md, checked by scripts/deeplink-check.mjs). An id is the lowercase, hyphenated id in projects.json.
  // Other spellings people type or copy from the text also resolve: a project's name as a slug (#love-island-dynamics), its repository name (#job-watchdog), its repoKey
  // (#war-research). An alias is dropped when two projects claim it or when it is already an id, an area, a stop or a reserved token, so none can shadow a real target.
  const slug = (s: string) => s.toLowerCase().replace(/[_\s]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
  const RESERVED = new Set(['top', 'start', 'clouds', 'hub', 'world', 'index', 'overview', 'contact'])
  const aliasOf = new Map<string, string>()
  {
    const claims = new Map<string, Set<string>>()
    const claim = (a: string, id: string) => { if (a && a !== id) { const s = claims.get(a) ?? new Set<string>(); s.add(id); claims.set(a, s) } }
    for (const p of PROJECTS) {
      claim(slug(p.name), p.id)
      const repoKey = (p as { repoKey?: string }).repoKey
      if (repoKey) claim(slug(repoKey), p.id)
      // the repository of a project with exactly one code link is its own; second-brain links three, so none of them is its alias
      const code = (p.links ?? []).filter(l => l.kind === 'code')
      if (code.length === 1) claim(slug(code[0].url.replace(/\/+$/, '').split('/').pop() ?? ''), p.id)
    }
    claims.forEach((ids, a) => { if (ids.size === 1 && !projOf(a) && !AREA_COPY[a] && wpIdx(a) < 0 && !RESERVED.has(a)) aliasOf.set(a, [...ids][0]) })
  }
  /** the area a project with no stop of its own belongs to: the area that lists it, else the group the Overview files it under (agents and tools join the Second Brain) */
  const homeArea = (pid: string) => AREAS.find(a => a.projects.includes(pid))?.id ?? KIND_HOME[projOf(pid)?.kind ?? '']
  const resolve = (raw: string): Target | null => {
    let t = raw.replace(/^#/, '').trim()
    try { t = decodeURIComponent(t) } catch { /* keep as is */ }
    t = t.toLowerCase().replace(/^\/+|\/+$/g, '').replace(/[_\s]+/g, '-')
    if (!t || t === 'top' || t === 'start' || t === 'clouds') return { wp: 0, hash: '' }
    if (t === 'hub' || t === 'world') return { wp: worldI, hash: 'world' }
    if (AREA_COPY[t]) { const i = firstOfArea(t); return i >= 0 ? { wp: i, hash: t } : null }
    const pid = projOf(t) ? t : aliasOf.get(t)
    if (pid) {
      // every project has a case view (reels/index.ts gives a poster to a project with no reel), so canOpen is true and the link opens its own case; the camera goes to the
      // project's stop, or, for a project with no stop (finder-organizer, notebooklm-study-loop), to its home area. The hash stays the project's own link.
      const open = env.canOpen(pid) ? pid : undefined
      const i = projectWp(pid)
      if (i >= 0) return { wp: i, hash: pid, open }
      const home = homeArea(pid), j = home ? firstOfArea(home) : -1
      return j >= 0 ? { wp: j, hash: pid, open } : null
    }
    const wi = wpIdx(t)
    return wi >= 0 ? { wp: wi, hash: dwellHash(wi) || t } : null
  }
  const setHash = (hash: string, push: boolean) => {
    const want = hash ? '#' + hash : ''
    if ((location.hash || '') === want) return
    try { const url = location.pathname + location.search + want; if (push) history.pushState(null, '', url); else history.replaceState(null, '', url) } catch { /* sandboxed */ }
  }

  let areaNow = 'prologue', intent: { wp: number; hash: string } | null = null
  let pendingOpen: { id: string; wp: number; t0: number } | null = null
  let boot: Target | null = null, bootContact = false, bootOverview = false, bootAt = 0
  const raw0 = location.hash.replace(/^#/, '').toLowerCase()
  if (raw0 === 'contact') bootContact = true
  else if (raw0 === 'overview') bootOverview = true
  else if (raw0 && raw0 !== 'index') { const t = resolve(raw0); if (t && t.wp > 0) boot = t }

  // ---------- the top bar ----------
  const btnIndex = h('button', { class: 'nbtn', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-keyshortcuts': 'M', 'data-cursor': '' },
    h('i', { class: 'bars', 'aria-hidden': 'true' }), h('span', { class: 'tx', text: 'Index' }), h('kbd', { class: 'kb mono', 'aria-hidden': 'true', text: 'M' }))
  const btnOverview = h('button', { class: 'nbtn is-overview', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-keyshortcuts': 'O', 'data-cursor': '' },
    h('span', { class: 'tx', text: 'Overview' }), h('kbd', { class: 'kb mono', 'aria-hidden': 'true', text: 'O' }))
  const btnContact = h('button', { class: 'nbtn is-contact', type: 'button', 'aria-haspopup': 'dialog', 'aria-keyshortcuts': 'C', 'data-cursor': '' },
    h('span', { class: 'tx', text: 'Contact' }), h('kbd', { class: 'kb mono', 'aria-hidden': 'true', text: 'C' }))
  const btnBack = h('button', { class: 'nbtn is-back', type: 'button', hidden: true, 'aria-label': 'Fly back to the hub', 'aria-keyshortcuts': '0', 'data-cursor': '' },
    h('span', { class: 'ch', 'aria-hidden': 'true', text: '‹' }), h('span', { class: 'tx', text: 'Hub' }), h('kbd', { class: 'kb mono', 'aria-hidden': 'true', text: '0' }))
  const btnTour = h('button', { class: 'nbtn is-tour', type: 'button', 'aria-keyshortcuts': 'T', 'aria-label': 'Play the guided tour', 'data-cursor': '' },
    h('span', { class: 'tx', text: 'Play tour' }), h('kbd', { class: 'kb mono', 'aria-hidden': 'true', text: 'T' }))
  const bar = h('div', { class: 'nb' }, btnBack, btnTour, btnOverview, btnIndex, btnContact)

  // ---------- go ----------
  const go = (t: Target, push = true) => {
    if (t.wp < 0) return
    closeMenu(true); closeSheet(true); closeOverview(true)
    if (push) setHash(t.hash, true)
    intent = { wp: t.wp, hash: t.hash }
    // a link followed while a case is open (a pasted hash, Back): the case switches to the new project at once and the camera flies to its stop behind it;
    // from a resting world the case opens once the camera has come to rest (onFlight)
    const caseUp = !!document.querySelector('dialog.case[open]')
    pendingOpen = t.open && !caseUp ? { id: t.open, wp: t.wp, t0: performance.now() } : null
    if (t.open && caseUp) env.open(t.open, null)
    env.fly(t.wp)
  }
  const goToken = (token: string, push = true) => { const t = resolve(token); if (!t) return false; go(t, push); return true }

  // ---------- radars (HUD + menu preview) and hot-state sync ----------
  const radars: Radar[] = []
  const labs: { id: string; el: HTMLButtonElement; x: number; y: number; vis: boolean; w: number; aside: boolean; dx: number; flip?: boolean }[] = []
  const menuRows = new Map<string, HTMLElement>()
  const setHot = (id: string | null) => {
    radars.forEach(r => r.setHot(id))
    labs.forEach(l => l.el.classList.toggle('hot', l.id === id))
  }
  const mkRadar = (cls: string) => { const r = buildRadar(cls, a => goToken(a), setHot); radars.push(r); return r }
  const hudRadar = mkRadar('mm-hud')
  // phones (<= 760 px): the radar is hidden by nav.css (it overprinted the HUD band); the Index in the top bar does its job
  hudRadar.el.setAttribute('role', 'group'); hudRadar.el.setAttribute('aria-label', 'Map of the six areas')

  // ---------- in-world area labels (the establishing shot) ----------
  const labelsEl = h('div', { id: 'area-labels', 'aria-hidden': 'true' })
  for (const a of AREAS) {
    const ac = AREA_COPY[a.id]
    const el = h('button', { class: 'al', type: 'button', tabindex: -1, 'data-cursor': '', 'data-area': a.id },
      h('i', { class: 'ld' }), h('i', { class: 'dt' }),
      h('span', { class: 'lb' }, h('b', { class: 'mono', text: ac.numeral }), h('span', { class: 'nm mono', text: NAME[a.id] }), h('span', { class: 'op mono', text: 'Fly ↗' })))
    el.style.setProperty('--a', ac.accent)
    el.addEventListener('click', () => goToken(a.id))
    el.addEventListener('pointerenter', () => setHot(a.id)); el.addEventListener('pointerleave', () => setHot(null))
    labelsEl.append(el)
    labs.push({ id: a.id, el, x: NaN, y: NaN, vis: false, w: 0, aside: false, dx: NaN })
  }

  // ---------- the Index menu ----------
  const menu = h('dialog', { class: 'nm', 'aria-label': 'Index: the hub, the six areas and their projects' })
  const entries = ['hub', ...AREA_ORDER, 'contact']
  const keyOf = (id: string) => (id === 'hub' ? '0' : id === 'contact' ? 'C' : String(AREA_ORDER.indexOf(id) + 1))
  const items: { id: string; li: HTMLElement; goBtn: HTMLButtonElement; tg: HTMLButtonElement | null }[] = []
  /** the first row with projects is where the menu opens, not the hub */
  const firstWithProjects = entries.find(id => id !== 'hub' && id !== 'contact' && areaProjects(id).length) ?? 'hub'
  let active = firstWithProjects
  let pvCanvas: HTMLCanvasElement | null = null, pvReel: ReelCanvas | null = null
  const pvStage = h('div', { class: 'nm-st' })
  const pvT = h('p', { class: 'nm-pvt' }), pvL = h('p', { class: 'nm-pvl' })
  const bigRadar = mkRadar('mm-big')
  pvStage.append(bigRadar.el)
  bigRadar.el.querySelectorAll('button').forEach(b => { b.tabIndex = -1 })
  const pv = h('aside', { class: 'nm-pv', 'aria-hidden': 'true' }, pvStage, pvT, pvL)

  const preview = (area: string, pid: string | null) => {
    const ac = AREA_COPY[area]
    const accent = ac?.accent ?? INK
    menu.style.setProperty('--nm-a', accent)
    const useReel = (pid ?? areaProjects(area).find(p => reelOf(p))) ?? null
    const reel = useReel ? reelOf(useReel) : undefined
    if (reel) {
      if (!pvCanvas) {
        pvCanvas = h('canvas', { class: 'nm-cv' })
        pvStage.prepend(pvCanvas)
        pvReel = createReelCanvas(pvCanvas, reel, { dpr: 1, intensity: 0.7 })
      } else pvReel?.setReel(reel)
    }
    pvStage.classList.toggle('has-reel', !!reel)
    bigRadar.setArea(AREAS.some(a => a.id === area) ? area : areaNow)
    const p = pid ? projOf(pid) : null
    pvT.textContent = p ? p.name : area === 'hub' ? NAME.hub : area === 'contact' ? 'Contact' : ac ? ac.title : ''
    pvL.textContent = p ? p.line : area === 'hub' ? HUB_LINE : area === 'contact' ? 'Email, LinkedIn and GitHub' : ac ? (AREA_PLAIN[area] ?? ac.kicker) : ''
  }
  const setActive = (id: string, pid: string | null = null) => {
    active = id
    items.forEach(it => it.li.classList.toggle('is-active', it.id === id))
    preview(id, pid)
  }

  const closeBtn = h('button', { class: 'nbtn nm-x', type: 'button', 'data-cursor': '' }, h('span', { class: 'tx', text: 'Close' }), h('kbd', { class: 'kb mono', 'aria-hidden': 'true', text: 'Esc' }))
  closeBtn.setAttribute('aria-label', 'Close the index')
  const list = h('ol', { class: 'nm-list' })
  entries.forEach(id => {
    const isArea = !!AREA_COPY[id]
    const accent = isArea ? AREA_COPY[id].accent : INK
    const sub = id === 'hub' ? HUB_LINE : id === 'contact' ? 'Email · LinkedIn · GitHub' : (AREA_PLAIN[id] ?? AREA_COPY[id].kicker)
    // 8C: every area says how big it is (stops in the flight, projects on its TVs); counts come from layout.ts and projects.json
    const nStops = isArea ? stopsOf(id).length : 0, nProj = isArea ? areaProjects(id).length : 0
    const count = id === 'hub' ? `${stopsOf('hub').length} stops` : isArea ? [`${nStops} ${nStops === 1 ? 'stop' : 'stops'}`, nProj ? `${nProj} ${nProj === 1 ? 'project' : 'projects'}` : ''].filter(Boolean).join(' \u00b7 ') : ''
    const numeral = isArea ? AREA_COPY[id].numeral : id === 'hub' ? '·' : '@'
    const pjId = `nm-pj-${id}`
    const goBtn = h('button', { class: 'nm-go', type: 'button', 'data-cursor': '', 'aria-label': id === 'contact' ? 'Contact: open the contact sheet' : `${NAME[id]}${isArea ? ', area ' + AREA_COPY[id].numeral : ''}${count ? ', ' + count : ''}: fly there` },
      h('span', { class: 'nm-n mono', 'aria-hidden': 'true', text: numeral }),
      h('span', { class: 'nm-name', text: id === 'contact' ? 'Contact' : NAME[id] }),
      h('span', { class: 'nm-k mono', 'aria-hidden': 'true' }, h('span', { text: sub }), count ? h('span', { class: 'nm-c', text: count }) : null),
      h('kbd', { class: 'nm-key mono', 'aria-hidden': 'true', text: keyOf(id) }))
    const kids = id === 'contact' ? [] : areaProjects(id)
    // an area with no projects (About) or the hub lists its STOPS in the right column instead, so the column is never empty (audit 3.60)
    const stopRows = id !== 'contact' && !kids.length ? stopsOf(id) : []
    const ul = h('ul', { class: 'nm-pl' })
    if (id === 'contact') {
      const ln = (label: string, href: string) => h('li', {}, h('a', { class: 'nm-p', href, target: href.startsWith('mailto') ? undefined : '_blank', rel: href.startsWith('mailto') ? undefined : 'noopener noreferrer', 'data-cursor': '' },
        h('i', { class: 'sw' }), h('span', { class: 'pn', text: label }), h('span', { class: 'po mono', 'aria-hidden': 'true', text: href.startsWith('mailto') ? 'Write' : 'Open ↗' })))
      ul.append(ln(LINKS.email, 'mailto:' + LINKS.email), ln(LINKS.emailUchicago, 'mailto:' + LINKS.emailUchicago), ln('LinkedIn', LINKS.linkedin), ln('GitHub', LINKS.github))
    } else {
      for (const st of stopRows) {
        const b = h('button', { class: 'nm-p', type: 'button', 'data-cursor': '', 'data-stop': st.id, 'aria-label': `${st.name}: fly there` },
          h('i', { class: 'sw' }), h('span', { class: 'pn', text: st.name }), h('span', { class: 'pkd mono', 'aria-hidden': 'true', text: String(st.i).padStart(2, '0') }), h('span', { class: 'po mono', 'aria-hidden': 'true', text: 'Fly ↗' }))
        b.addEventListener('click', () => { if (!goToken(st.id)) goToken(id) })
        const on = () => setActive(id)
        b.addEventListener('pointerenter', on); b.addEventListener('focus', on)
        ul.append(h('li', {}, b))
      }
      for (const pid of kids) {
        const p = projOf(pid); if (!p) continue
        const can = env.canOpen(pid)
        const b = h('button', { class: 'nm-p', type: 'button', 'data-cursor': '', 'data-project': pid, 'aria-label': `${p.name}: ${can ? 'fly there and open the work' : 'fly there'}` },
          h('i', { class: 'sw' }), h('span', { class: 'pn', text: p.name }), h('span', { class: 'pkd mono', 'aria-hidden': 'true', text: p.type || p.kind }), h('span', { class: 'po mono', 'aria-hidden': 'true', text: can ? 'Open ↗' : '' }))
        b.style.setProperty('--sw', reelOf(pid)?.colors.accent ?? accent)
        b.addEventListener('click', () => { if (!goToken(pid)) goToken(id) })
        const on = () => setActive(id, pid)
        b.addEventListener('pointerenter', on); b.addEventListener('focus', on)
        ul.append(h('li', {}, b))
      }
    }
    const pj = h('div', { class: 'nm-pj', id: pjId }, ul)
    const tg = kids.length || stopRows.length || id === 'contact'
      ? h('button', { class: 'nm-tg mono', type: 'button', 'aria-expanded': 'false', 'aria-controls': pjId, 'data-cursor': '', 'aria-label': id === 'contact' ? 'Show the contact links' : `Show the ${NAME[id]} ${kids.length ? 'projects' : 'stops'}` }, h('span', { class: 'cnt', text: String(id === 'contact' ? 3 : kids.length || stopRows.length) }), h('i', { class: 'chev', 'aria-hidden': 'true' }))
      : null
    const li = h('li', { class: 'nm-it', 'data-id': id }, goBtn, tg, pj)
    li.style.setProperty('--a', accent)
    goBtn.addEventListener('click', () => { if (id === 'contact') { closeMenu(true); openSheet() } else goToken(id === 'hub' ? 'world' : id) })
    tg?.addEventListener('click', () => {
      const open = !li.classList.contains('is-open')
      items.forEach(it => { it.li.classList.remove('is-open'); it.tg?.setAttribute('aria-expanded', 'false') })
      li.classList.toggle('is-open', open); tg.setAttribute('aria-expanded', String(open)); setActive(id)
    })
    // hover intent: sweeping the pointer across the list toward the project column must not flip the panel under it
    let hoverT = 0
    li.addEventListener('pointerenter', () => { if (!matchMedia('(min-width: 900px)').matches) return; clearTimeout(hoverT); hoverT = window.setTimeout(() => setActive(id), active === id ? 0 : 150) })
    li.addEventListener('pointerleave', () => clearTimeout(hoverT))
    li.addEventListener('focusin', e => { if (!(e.target as Element).closest('.nm-p')) setActive(id) })
    goBtn.addEventListener('pointerenter', () => setHot(isArea ? id : null)); goBtn.addEventListener('pointerleave', () => setHot(null))
    items.push({ id, li, goBtn, tg }); menuRows.set(id, li); list.append(li)
  })
  const legend = (k: string, t: string) => h('span', { class: 'lg' }, h('kbd', { class: 'mono', text: k }), h('span', { text: t }))
  const toIndex = h('a', { class: 'nm-ix mono', href: '#index', 'data-cursor': '', text: 'Every project, listed ↓' })
  toIndex.addEventListener('click', () => closeMenu(true))
  // Serra "quality controls": the footer's stillness toggle. Same label pair as the template; it flips the site's reduced-motion class (the OS setting still wins).
  const still = h('button', { class: 'nm-still mono', type: 'button', 'aria-pressed': 'false', 'data-cursor': '' })
  const osRm = matchMedia('(prefers-reduced-motion: reduce)')
  const syncStill = () => {
    const on = html.classList.contains('rm')
    still.setAttribute('aria-pressed', String(on)); still.textContent = on ? 'Enable cinematic journey' : 'Switch to stillness mode'
    still.disabled = osRm.matches
  }
  still.addEventListener('click', () => { appState.reduced = !html.classList.contains('rm'); html.classList.toggle('rm', appState.reduced); syncStill() })
  syncStill()
  menu.append(h('div', { class: 'nm-in' },
    h('header', { class: 'nm-top' }, h('p', { class: 'nm-h' }, h('b', { class: 'mono', text: 'Index' }), h('span', { text: 'Joseph Blumberg' })), closeBtn),
    h('div', { class: 'nm-body' }, list, pv),
    h('footer', { class: 'nm-foot' },
      h('p', { class: 'nm-legend mono', 'aria-label': 'Keyboard shortcuts' }, legend('O', 'Overview'), legend('T', 'Tour'), legend('M', 'Index'), legend('1-6', 'Areas'), legend('0', 'Hub'), legend('C', 'Contact'), legend('← →', 'Look around'), legend('Esc', 'Close or back')), still, toIndex)))
  document.body.append(menu)

  let menuT = 0
  /** focus goes back to whatever opened a dialog (the key shortcuts fall back to the button that owns it) */
  const opener = (fallback: HTMLElement): HTMLElement => { const ae = document.activeElement as HTMLElement | null; return ae && ae !== document.body && !ae.closest('dialog') ? ae : fallback }
  const restore = (el: HTMLElement | null) => { if (el && el.isConnected && !document.querySelector('dialog[open]')) el.focus({ preventScroll: true }) }
  let menuFrom: HTMLElement | null = null, sheetFrom: HTMLElement | null = null
  const openMenu = () => {
    if (menu.open || html.classList.contains('is-loading')) return
    if (document.querySelector('dialog[open]:not(.nm):not(.nc):not(.ovw)')) return
    menuFrom = opener(btnIndex)
    syncStill()
    closeSheet(true); closeOverview(true)
    clearTimeout(menuT)
    menu.showModal()
    html.classList.add('nav-open'); btnIndex.setAttribute('aria-expanded', 'true')
    setActive(AREA_COPY[areaNow] ? areaNow : areaNow === 'epilogue' ? 'contact' : firstWithProjects)
    requestAnimationFrame(() => menu.classList.add('on'))
    if (!isRm()) {
      const rows = list.querySelectorAll('.nm-go')
      animate(rows, { opacity: [0, 1], translateY: [34, 0], delay: stagger(42, { start: 90 }), duration: 760, ease: 'out(4)', onComplete: () => rows.forEach(r => { (r as HTMLElement).style.transform = ''; (r as HTMLElement).style.opacity = '' }) })
      animate(pv, { opacity: [0, 1], translateX: [28, 0], delay: 220, duration: 760, ease: 'out(4)', onComplete: () => { pv.style.transform = ''; pv.style.opacity = '' } })
    }
    ;(list.querySelector(`[data-id="${active}"] .nm-go`) as HTMLElement | null)?.focus({ preventScroll: true })
  }
  function closeMenu(instant = false) {
    if (!menu.open) return
    html.classList.remove('nav-open'); btnIndex.setAttribute('aria-expanded', 'false')
    menu.classList.remove('on')
    clearTimeout(menuT)
    const done = () => { if (menu.open) { menu.close(); restore(menuFrom) } }
    if (instant || isRm()) done(); else menuT = window.setTimeout(done, 240)
  }
  menu.addEventListener('cancel', e => { e.preventDefault(); closeMenu() })
  menu.addEventListener('close', () => { html.classList.remove('nav-open'); menu.classList.remove('on') })
  closeBtn.addEventListener('click', () => closeMenu())
  btnIndex.addEventListener('click', () => (menu.open ? closeMenu() : openMenu()))
  // up / down walk the big entries
  menu.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const rows = Array.from(menu.querySelectorAll<HTMLElement>('.nm-go'))
    const i = rows.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    e.preventDefault(); rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length].focus()
  })

  // ---------- the contact sheet ----------
  const sheet = h('dialog', { class: 'nc', 'aria-label': 'Contact' })
  const sheetX = h('button', { class: 'nbtn nm-x', type: 'button', 'aria-label': 'Close contact', 'data-cursor': '' }, h('span', { class: 'tx', text: 'Close' }), h('kbd', { class: 'kb mono', 'aria-hidden': 'true', text: 'Esc' }))
  sheet.append(h('div', { class: 'nc-in' }, h('div', { class: 'nc-top' }, h('p', { class: 'nc-h' }, h('b', { class: 'mono', text: 'Contact' }), h('span', { text: 'Joseph Blumberg' })), sheetX), buildContact({ sheet: true })))
  document.body.append(sheet)
  let sheetT = 0
  function openSheet() {
    if (sheet.open || html.classList.contains('is-loading')) return
    if (document.querySelector('dialog[open]:not(.nm):not(.nc):not(.ovw)')) return
    sheetFrom = menu.open ? menuFrom : opener(btnContact)
    closeMenu(true); closeOverview(true); clearTimeout(sheetT)
    sheet.showModal(); btnContact.setAttribute('aria-expanded', 'true')
    requestAnimationFrame(() => sheet.classList.add('on'))
    ;(sheet.querySelector('.cp') as HTMLElement | null)?.focus({ preventScroll: true })
  }
  function closeSheet(instant = false) {
    if (!sheet.open) return
    btnContact.setAttribute('aria-expanded', 'false'); sheet.classList.remove('on')
    clearTimeout(sheetT)
    const done = () => { if (sheet.open) { sheet.close(); restore(sheetFrom) } }
    if (instant || isRm()) done(); else sheetT = window.setTimeout(done, 220)
  }
  sheet.addEventListener('cancel', e => { e.preventDefault(); closeSheet() })
  sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet() })
  sheetX.addEventListener('click', () => closeSheet())
  btnContact.addEventListener('click', () => (sheet.open ? closeSheet() : openSheet()))
  btnBack.addEventListener('click', () => goToken('world'))

  // ---------- the Overview (8C): the whole portfolio on one page, over a blurred world ----------
  const overview = buildOverview({
    waypoints: wps,
    open: (id, el) => env.open(id, el),
    go: token => goToken(token),
    onToggle: on => {
      html.classList.toggle('ov-open', on); btnOverview.setAttribute('aria-expanded', String(on))
      if (on) setHash('overview', false)
      else if (location.hash.toLowerCase() === '#overview') setHash(dwellHash(curWp), false)
    },
  })
  document.body.append(overview.el)
  function openOverview() {
    if (overview.isOpen() || html.classList.contains('is-loading')) return
    if (document.querySelector('dialog[open]:not(.nm):not(.nc):not(.ovw)')) return
    closeMenu(true); closeSheet(true)
    overview.open()
  }
  function closeOverview(instant = false) { overview.close(instant) }
  btnOverview.addEventListener('click', () => (overview.isOpen() ? closeOverview() : openOverview()))

  const playTour = () => { closeMenu(true); closeSheet(true); closeOverview(true); env.playTour?.() }
  btnTour.addEventListener('click', playTour)
  // ---------- keys ----------
  addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    if (html.classList.contains('is-loading')) return
    if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return
    if (document.querySelector('dialog[open]:not(.nm):not(.nc):not(.ovw)')) return // the case view and the lightbox keep their own keys
    const k = e.key
    if (k === 'o' || k === 'O') { e.preventDefault(); if (overview.isOpen()) closeOverview(); else openOverview() }
    else if (k === 't' || k === 'T') { e.preventDefault(); playTour() }
    else if (k === 'm' || k === 'M') { e.preventDefault(); if (menu.open) closeMenu(); else { closeSheet(true); openMenu() } }
    else if (k === 'c' || k === 'C') { e.preventDefault(); if (sheet.open) closeSheet(); else openSheet() }
    else if (k === '0' || k === 'h' || k === 'H') { e.preventDefault(); goToken('world') }
    else if (k.length === 1 && k >= '1' && k <= '6') { e.preventDefault(); goToken(AREA_ORDER[+k - 1]) }
    else if (k === 'Escape' && !menu.open && !sheet.open && !overview.isOpen() && AREA_COPY[areaNow]) { e.preventDefault(); goToken('world') } // V4's "<": from inside an area, back out to the hub
  })
  addEventListener('hashchange', () => {
    const raw = location.hash.replace(/^#/, '').toLowerCase()
    if (raw === 'index') return // the project index below the track: native scroll
    if (raw === 'contact') { openSheet(); return }
    if (raw === 'overview') { if (html.classList.contains('is-loading')) bootOverview = true; else openOverview(); return }
    const t = resolve(raw)
    if (!t) return
    if (html.classList.contains('is-loading')) { boot = t.wp > 0 ? t : null; return }
    go(t, false)
  })

  // ---------- per frame ----------
  let lastArea = '', atWorld = false, dwellWp = -1, dwellAt = 0, writtenWp = -1
  /** the waypoint the readout names: the one whose beat is current (the origin until a leg is half done), or the destination of a jump */
  let curWp = 0
  const fieldOf = () => (window as unknown as { __v3?: { field?: { project?(p: Vec3): { x: number; y: number; visible: boolean } } } }).__v3?.field
  return {
    bar, map: hudRadar.el, labels: labelsEl,
    go: goToken, openMenu, closeMenu, openContact: openSheet, closeContact: closeSheet, openOverview, closeOverview,
    where: () => stopAt(curWp),
    caseShown(projectId) {
      if (projectId) setHash(projectId, false)
      // closed: the Overview (if the case was opened from it) is still the page on screen; else the hash a dwell here would write
      else if (overview.isOpen()) setHash('overview', false)
      else setHash(intent && intent.wp === curWp ? intent.hash : dwellHash(curWp), false)
    },
    frame(area, cam, jumping) {
      areaNow = area
      if (jumping) {
        // while a jump flies the readout names where it is going, never the stops in between
        const fa = firstOfArea(area)
        curWp = intent?.wp ?? (fa >= 0 ? fa : area === 'epilogue' ? wps.length - 1 : area === 'prologue' ? 0 : curWp)
      }
      if (area !== lastArea) {
        lastArea = area
        radars.forEach(r => r.setArea(area))
        btnBack.hidden = !AREA_COPY[area]
        menuRows.forEach((li, id) => { if (id === area) li.setAttribute('aria-current', 'location'); else li.removeAttribute('aria-current') })
      }
      const now = performance.now()
      // a deep link on load: once the curtain has lifted, fly there
      if (boot && html.classList.contains('is-ready')) {
        if (!bootAt) bootAt = now
        else if (now - bootAt > 900) { const b = boot; boot = null; go(b, false) }
      } else if (bootContact && html.classList.contains('is-ready')) {
        if (!bootAt) bootAt = now
        else if (now - bootAt > 900) { bootContact = false; openSheet() }
      } else if (bootOverview && html.classList.contains('is-ready')) {
        if (!bootAt) bootAt = now
        else if (now - bootAt > 900) { bootOverview = false; openOverview() }
      }
      if (cam) {
        let x = cam.pos[0], z = cam.pos[2]
        const d = Math.hypot(x, z), lim = VB - 3
        const far = d > lim // the interest spaces sit well outside the ring: pin the glyph to the rim and keep the cone inside the disc
        if (far) { x *= lim / d; z *= lim / d }
        const dx = cam.target[0] - cam.pos[0], dz = cam.target[2] - cam.pos[2]
        const a = Math.atan2(dx, -dz), L = far ? 9 : 15
        const c = `M${x.toFixed(2)} ${z.toFixed(2)}L${(x + Math.sin(a - FOV_HALF) * L).toFixed(2)} ${(z - Math.cos(a - FOV_HALF) * L).toFixed(2)}L${(x + Math.sin(a + FOV_HALF) * L).toFixed(2)} ${(z - Math.cos(a + FOV_HALF) * L).toFixed(2)}Z`
        const deg = (a * 180) / Math.PI
        hudRadar.setCam(x, z, deg, c)
        if (menu.open) bigRadar.setCam(x, z, deg, c)
      }
      // area labels hang on the ring at the establishing shot
      const on = atWorld && !jumping && !menu.open && !sheet.open && !html.classList.contains('in-index')
      const fld = on ? fieldOf() : undefined
      const blockers = fld?.project ? env.blockers() : []
      AREAS.forEach((ar, i) => {
        const l = labs[i]
        let v = false
        if (fld?.project) {
          const pt = fld.project(ar.center)
          if (pt.visible && pt.x > 30 && pt.x < innerWidth - 30 && pt.y > 90 && pt.y < innerHeight - 60) {
            v = true
            if (!l.w) l.w = l.el.querySelector<HTMLElement>('.lb')!.offsetWidth || 190
            // the right-hand rail owns the last 64 px: the label never reaches under it, and near the edge the chip flips to the left of its dot
            const x = Math.min(pt.x, innerWidth - 64)
            const flip = pt.x > innerWidth - 150
            if (flip !== l.flip) { l.flip = flip; l.el.classList.toggle('flip', flip) }
            if (!(Math.abs(l.x - x) <= 0.04) || !(Math.abs(l.y - pt.y) <= 0.04)) { l.x = x; l.y = pt.y; l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)` }
            const hw = l.w / 2 + 10
            // the chip hangs centred under its point; keep it inside the screen
            const dx = flip ? 0 : Math.max(0, hw - x) - Math.max(0, x + hw - (innerWidth - 64))
            if (dx !== l.dx) { l.dx = dx; l.el.style.setProperty('--dx', dx + 'px') }
            const hit = flip
              ? blockers.some(r => x - 16 - l.w < r.r && x - 8 > r.l && pt.y - 16 < r.b && pt.y + 16 > r.t)
              : blockers.some(r => x + dx - hw < r.r && x + dx + hw > r.l && pt.y + 10 < r.b && pt.y + 56 > r.t)
            if (hit !== l.aside) { l.aside = hit; l.el.classList.toggle('aside', hit) }
          }
        }
        if (v !== l.vis) { l.vis = v; l.el.classList.toggle('vis', v) }
      })
    },
    onFlight(st, jumping) {
      const s = st as DwellState
      if (!jumping && st.wp != null) curWp = st.next != null && st.overlayK >= 0.5 ? st.next : st.wp
      const dwelling = !!s.dwelling && st.wp != null
      atWorld = dwelling && st.wp === worldI
      const now = performance.now()
      if (!dwelling) { dwellWp = -1; return }
      if (st.wp !== dwellWp) { dwellWp = st.wp!; dwellAt = now }
      const settled = !jumping && now - dwellAt > 450
      // choosing a project flies there, then opens its case once the camera has come to rest
      if (pendingOpen) {
        if (settled && st.wp === pendingOpen.wp && now - pendingOpen.t0 > 600) { const id = pendingOpen.id; pendingOpen = null; env.open(id, null) }
        else if (now - pendingOpen.t0 > 30000) pendingOpen = null   // a deep link on a loaded page can fly the whole tour (well over 8 s) before it settles
      }
      // every dwell replaces the hash (a deep link keeps its own until we have left it)
      if (settled && !boot && !bootContact && !bootOverview && st.wp !== writtenWp && !(location.hash === '#index' && html.classList.contains('in-index'))) {
        writtenWp = st.wp!
        if (intent && intent.wp !== st.wp) intent = null
        if (location.hash.toLowerCase() === '#contact' || overview.isOpen()) return
        setHash(intent ? intent.hash : dwellHash(st.wp!), false)
      }
    },
  }
}
