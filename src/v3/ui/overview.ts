// Overview (8C): the whole portfolio on one fast, scannable page, for a recruiter who has a minute.
//   Joseph's one-line claim, Education, Experience, every project grouped by what it is, Interests, Contact.
//   Opens from the top bar, the first screen, the key O or the link #overview; a blurred world stays behind it.
//   Every row opens its case study or flies to its stop in the tour. Nothing here is new data: names, dates, sentences and figures
//   come from site.json and projects.json (copy.ts), so proofread.mjs reads the same numerals the files hold.
// The page itself is buildOverviewBody(): the dialog below wraps it in a modal, and the last stop of the tour (world/extras/finale.ts) shows the same body
// inline, with the contact first. The two never share ids (idp), and the heading levels shift down one for the inline copy, which sits under the page's own h1.
// nav.ts owns the dialog's place among the others (Index, Contact, the case view) and passes in what a row may do.
import { animate, stagger } from 'animejs'
import '../styles/overview.css'
import { AREAS, type Waypoint } from '../world/layout'
import { ABOUT_LINE3, AREA_COPY, AREA_NAME, AREA_ORDER, PROJECTS, SITE, projOf, secondaryCtas, type ProjectLite } from './copy'
import { buildContact } from './epilogue'
import siteRaw from '../../data/site.json'
import { h, isRm } from './util'
import { attachBeams, attachSpotlight } from '../../ui/fx'
import { mountFluid, type FluidHandle } from '../../ui/fx/fluid'
import { liquidGlass, autoGlass } from '../../ui/fx/glass'

export interface OverviewEnv {
  waypoints: Waypoint[]
  /** open a project's case study (the same call a TV and an overlay button make) */
  open(projectId: string, el: HTMLElement | null): void
  /** fly to a waypoint id, an area id or 'world'; closes the Overview */
  go(token: string): boolean
  /** told when the dialog shows or hides (nav.ts keeps the hash and the page scroll lock) */
  onToggle(open: boolean): void
}
export interface Overview { el: HTMLDialogElement; open(): void; close(instant?: boolean): void; isOpen(): boolean }

interface Edu { school: string; program: string; years: string; notes: string }
const EDU = (siteRaw as unknown as { education: Edu[] }).education
const CHICAGO = EDU.find(e => /Chicago/.test(e.school))!
const MICHIGAN = EDU.find(e => /Michigan/.test(e.school))
const EARLIER = EDU.filter(e => e !== CHICAGO && e !== MICHIGAN)
const classOf = /class of (\d{4})/i.exec(CHICAGO.notes)?.[1] ?? ''

/** The Projects column follows the flight: one group per area in AREA_ORDER (layout AREAS lists its projects in flight order), with the education group
 *  named for what it holds. A project that no area lists is placed by its kind at the end of the nearest group (agents and tools join the Second Brain,
 *  apps join Systems, stock pitches and papers join Research or Work, instruments join Education), so a project added to projects.json always shows up. */
const GROUP_TITLE: Record<string, string> = { education: 'Reading instruments' }
const GROUP_CHIP: Record<string, string> = { education: 'Instruments', systems: 'Systems', mind: 'Second Brain' }
export const KIND_HOME: Record<string, string> = { agent: 'mind', tool: 'mind', app: 'systems', research: 'research', instrument: 'education', work: 'work' }
/** projects that sit in Experience instead of the groups (role level only) */
const EXPERIENCE_ONLY = new Set(['qvr'])

function groupsWithProjects() {
  const placed = new Set<string>()
  const out = AREA_ORDER.filter(id => AREA_COPY[id] && AREAS.some(a => a.id === id)).map(id => {
    const g = { id, title: GROUP_TITLE[id] ?? AREA_NAME[id] ?? id, chip: GROUP_CHIP[id] ?? AREA_NAME[id] ?? id, accent: AREA_COPY[id].accent }
    return { g, list: [] as ProjectLite[] }
  })
  for (const x of out) for (const id of AREAS.find(a => a.id === x.g.id)?.projects ?? []) { const p = projOf(id); if (p && !EXPERIENCE_ONLY.has(id) && !placed.has(id)) { x.list.push(p); placed.add(id) } }
  for (const p of PROJECTS) {
    if (placed.has(p.id) || EXPERIENCE_ONLY.has(p.id)) continue
    const home = out.find(x => x.g.id === KIND_HOME[p.kind]) ?? out[out.length - 1]
    home?.list.push(p); placed.add(p.id)
  }
  return out
}

/** the credits for the real-world imagery (src/data/credits.json, written by the imagery package). import.meta.glob resolves to {} when the file is absent, so a
 *  missing file renders no section instead of breaking the build. */
export interface Credit { id?: string; what?: string; title?: string; source?: string; author?: string; licence?: string; url?: string; retrieved?: string }
const creditFiles = import.meta.glob('../../data/credits.json', { eager: true, import: 'default' }) as Record<string, unknown>
export const CREDITS: Credit[] = (() => {
  const v = Object.values(creditFiles)[0] as unknown
  const list = Array.isArray(v) ? v : v && typeof v === 'object' && Array.isArray((v as { credits?: unknown }).credits) ? (v as { credits: unknown[] }).credits : []
  return list.filter((c): c is Credit => !!c && typeof c === 'object')
})()

const ARROW = '<svg viewBox="0 0 12 12" width="11" height="11" focusable="false"><path d="M3 9 9 3M4.2 3H9v4.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>'
const arrow = () => { const s = h('span', { class: 'ovw-ar', 'aria-hidden': 'true' }); s.innerHTML = ARROW; return s }

/** The ending's copy for the contact card (NEW, docs/V4-COPY.md section 14): no numerals, nothing to trace */
export const END_LINE = 'Tell me what you are building.'
export const END_SUB = 'Internships, research, a hard problem. A short note is plenty.'

/** the ending (world/extras/finale.ts) registers itself here: while it is the page on screen, O and the Overview button bring it back to its top instead of stacking a second copy on it */
let ending: { active(): boolean; toTop(): void } | null = null
export function registerEnding(e: { active(): boolean; toTop(): void } | null): void { ending = e }

export interface BodyOpts {
  env: Pick<OverviewEnv, 'waypoints' | 'open' | 'go'>
  /** the element that scrolls the body (the dialog, or the ending's scroller) */
  scroller(): HTMLElement
  /** px at the top of the scroller that the sticky bits and the anchor jumps keep clear (the dialog's bar; the HUD and the anchor row in the ending) */
  inset(): number
  /** id prefix: the dialog is 'ovw', the ending 'fin' (both can exist at once, so ids never repeat) */
  idp: string
  /** the ending: heading levels one lower (the name is an h2), the contact leads with its own invitation and a Replay button, no beams, a way back to the top.
   *  Its Credits control (in the contact block) opens the same list in a dialog, so the long list is not the last thing on the page (`credits: true` prints it). */
  inline?: { replay(): void; credits?: boolean }
}
export interface OverviewBody {
  head: HTMLElement
  cols: HTMLElement
  credits: HTMLElement | null
  foot: HTMLElement | null
  /** the section anchors, for the caller's bar */
  anchors: HTMLElement
  /** the heading that names the page (takes focus when the page is brought to its top) */
  title: HTMLElement
}

/** the whole page: head (who, contact), the left column (Experience, Education, Interests), the Projects column, Credits */
export function buildOverviewBody(o: BodyOpts): OverviewBody {
  const { env, idp } = o
  const end = !!o.inline
  const T = { name: end ? 'h2' : 'h1', sec: end ? 'h3' : 'h2', grp: end ? 'h4' : 'h3' } as const
  const qvr = projOf('qvr'), chom = projOf('chomchom')
  const tamid = MICHIGAN && /TAMID/.test(MICHIGAN.notes) ? MICHIGAN : null

  /** the waypoint that shows a project: the beat that features it alone, else the first beat that features it with others */
  const stopOf = (pid: string): string | null => (env.waypoints.find(w => w.tvs?.length === 1 && w.tvs[0] === pid) ?? env.waypoints.find(w => w.tvs?.includes(pid)))?.id ?? null

  /** a project row: the name is the button that opens the case (stretched over the row); demo, paper and code links sit above it */
  const projectRow = (p: ProjectLite, accent: string): HTMLElement => {
    const fig = p.keyFigure
    const main = h('button', { class: 'ovw-main', type: 'button', 'data-cursor': '', 'data-project': p.id, 'aria-label': `Case study: ${p.name}. ${fig.value} ${fig.label}.` }, h('span', { class: 'ovw-nm', text: p.name }))
    main.addEventListener('click', () => env.open(p.id, main))
    const acts = h('p', { class: 'ovw-acts mono' }, h('span', { class: 'ovw-cs', 'aria-hidden': 'true' }, h('span', { text: 'Case study' }), arrow()))
    for (const k of secondaryCtas(p.id)) {
      const a = h('a', { class: 'ovw-sec', href: k.href, target: '_blank', rel: 'noopener noreferrer', 'data-cursor': '', 'aria-label': k.aria, 'data-kind': k.kind }, h('span', { text: k.label }), arrow())
      acts.append(a)
    }
    if (stopOf(p.id)) {
      const tour = h('button', { class: 'ovw-tour', type: 'button', 'data-cursor': '', 'data-stop': p.id, 'aria-label': `${p.name}: show it in the tour` }, h('span', { text: 'In the tour' }))
      tour.addEventListener('click', () => { const id = stopOf(p.id); if (id) env.go(id) })
      acts.append(tour)
    }
    const li = h('li', { class: 'ovw-row' },
      h('i', { class: 'ovw-sw', 'aria-hidden': 'true' }),
      h('div', { class: 'ovw-who' }, main, h('p', { class: 'ovw-type mono', text: [p.type, p.year].filter(Boolean).join(' · ') })),
      h('p', { class: 'ovw-line', text: p.line }),
      h('p', { class: 'ovw-fig' }, h('span', { class: 'v', text: fig.value }), h('span', { class: 'l', text: fig.label })),
      acts)
    li.style.setProperty('--a', accent)
    return li
  }

  /** an Education or Experience row: a name and a date over one plain line; a button when it goes somewhere */
  const factRow = (f: { name: string; when: string; line: string; go?: () => void; label?: string; id: string }): HTMLElement => {
    const nm = f.go
      ? h('button', { class: 'ovw-main', type: 'button', 'data-cursor': '', 'data-row': f.id, 'aria-label': f.label ?? f.name }, h('span', { class: 'ovw-nm', text: f.name }))
      : h('span', { class: 'ovw-nm', text: f.name })
    if (f.go) nm.addEventListener('click', f.go)
    return h('li', { class: 'ovw-fact' + (f.go ? ' is-go' : ''), 'data-row': f.id },
      h('div', { class: 'ovw-fh' }, nm, h('span', { class: 'ovw-when mono', text: f.when })),
      h('p', { class: 'ovw-fl', text: f.line }),
      f.go ? arrow() : null)
  }

  /** a station's entry (fieldwork: each station is a card with an arrow that goes in): flies the tour to this area (and closes the Overview) */
  const enter = (areaId: string, title: string): HTMLElement => {
    const b = h('button', { class: 'ovw-enter mono', type: 'button', 'data-cursor': '', 'data-station': areaId, 'aria-label': `${title}: enter this station in the tour` }, h('span', { text: 'Enter station' }), arrow())
    b.addEventListener('click', () => env.go(areaId))
    return b
  }

  // ---- head: the claim, the school line, contact
  const school = `${CHICAGO.school} · ${CHICAGO.program}${classOf ? ` · Class of ${classOf}` : ''}`
  const title = h(T.name, { id: `${idp}-h`, class: 'ovw-hn', tabindex: -1, autofocus: end ? undefined : true, text: SITE.name })
  const replay = o.inline
    ? h('button', { class: 'ovw-replay mono', type: 'button', 'data-cursor': '', 'aria-label': 'Replay the tour from the first screen' }, h('span', { text: 'Replay the tour' }), h('span', { class: 'ovw-rp', 'aria-hidden': 'true', text: '↺' }))
    : null
  if (replay && o.inline) replay.addEventListener('click', o.inline.replay)
  const id = h('div', { class: 'ovw-id' },
    title,
    h('p', { class: 'ovw-claim', text: SITE.claim }),
    h('p', { class: 'ovw-school', text: school }))
  const contact = end
    ? h('section', { class: 'ovw-contact ovw-glass', 'aria-label': 'Contact', 'data-end-contact': '' },
      h(T.sec, { class: 'ovw-ask', text: END_LINE }), h('p', { class: 'ovw-askp', text: END_SUB }), buildContact({ sheet: true }), replay)
    : h('div', { class: 'ovw-contact' }, buildContact({ sheet: true }))
  const head = h('section', { class: 'ovw-head' }, id, contact)

  // ---- left: Education, Experience, Interests
  const eduRows: HTMLElement[] = [
    factRow({ id: 'edu-uchicago', name: CHICAGO.school, when: CHICAGO.years, line: `${CHICAGO.program}${classOf ? `. Class of ${classOf}.` : ''}`, go: () => env.go('school'), label: `${CHICAGO.school}: fly to the education stop` }),
  ]
  if (MICHIGAN) eduRows.push(factRow({ id: 'edu-michigan', name: MICHIGAN.school, when: MICHIGAN.years, line: MICHIGAN.program }))
  const earlier = EARLIER.length ? h('p', { class: 'ovw-earlier', text: 'Earlier: ' + EARLIER.map(e => `${e.school} (${e.years})`).join(' and ') }) : null
  const education = h('section', { class: 'ovw-sec-edu', 'aria-labelledby': `${idp}-h-edu` }, h(T.sec, { id: `${idp}-h-edu`, class: 'ovw-hs', text: 'Education' }), h('ul', { class: 'ovw-facts' }, ...eduRows), earlier)

  const expRows: HTMLElement[] = []
  if (qvr) expRows.push(factRow({ id: 'exp-qvr', name: qvr.name, when: qvr.period, line: `${qvr.role} at a volatility-focused investment firm.`, go: () => env.open('qvr', null), label: `${qvr.name}, ${qvr.role}: open the case study` }))
  if (chom) expRows.push(factRow({ id: 'exp-chomchom', name: chom.name, when: chom.period, line: `${chom.role}. ${chom.line}`, go: () => env.open('chomchom', null), label: `${chom.name}, ${chom.role}: open the case study` }))
  if (tamid) {
    const co = projOf('cloudflare')
    expRows.push(factRow({ id: 'exp-tamid', name: 'TAMID at Michigan', when: 'University of Michigan', line: tamid.notes.replace(/^.*?TAMID at Michigan I /, '').replace(/^./, c => c.toUpperCase()).replace(/\. I also wrote.*$/, '.'), go: co ? () => env.open('cloudflare', null) : undefined, label: 'TAMID at Michigan: open the Cloudflare pitch' }))
  }
  const experience = h('section', { class: 'ovw-sec-exp', 'aria-labelledby': `${idp}-h-exp` }, h(T.sec, { id: `${idp}-h-exp`, class: 'ovw-hs', text: 'Experience' }), h('ul', { class: 'ovw-facts' }, ...expRows))

  const interestsLine = ABOUT_LINE3.replace(/^./, c => c.toUpperCase())
  const toAbout = h('button', { class: 'ovw-more', type: 'button', 'data-cursor': '' }, h('span', { text: 'See them in the tour' }), arrow())
  toAbout.addEventListener('click', () => env.go('about'))
  const interests = h('section', { class: 'ovw-sec-int', 'aria-labelledby': `${idp}-h-int` }, h(T.sec, { id: `${idp}-h-int`, class: 'ovw-hs', text: 'Interests' }), h('p', { class: 'ovw-fl', text: interestsLine }), toAbout)

  // ---- right: Projects, grouped by what they are
  const groups = groupsWithProjects().filter(x => x.list.length)
  const chips = h('nav', { class: 'ovw-chips', 'aria-label': 'Jump to a group of projects' })
  const secs: HTMLElement[] = []
  groups.forEach(({ g, list }) => {
    const ul = h('ul', { class: 'ovw-list' })
    list.forEach(p => ul.append(projectRow(p, g.accent)))
    const sec = h('section', { class: 'ovw-g', id: `${idp}-g-${g.id}`, 'aria-labelledby': `${idp}-gh-${g.id}` },
      h('header', { class: 'ovw-gh' },
        h(T.grp, { id: `${idp}-gh-${g.id}`, class: 'ovw-hg', text: g.title }),
        h('span', { class: 'ovw-gc mono', text: `${list.length} ${list.length === 1 ? 'project' : 'projects'}` }),
        enter(g.id, g.title)), ul)
    sec.style.setProperty('--a', g.accent)
    if (g.id === 'systems' && !end) attachBeams(ul, '.ovw-row', '.ovw-sw')   // 14V: a light travels between the systems (not on the ending: a looping paint under the live world)
    secs.push(sec)
    const chip = h('button', { class: 'ovw-chip mono', type: 'button', 'data-cursor': '', 'aria-label': `${g.title}: ${list.length} projects. Jump to the group.` }, h('i', { class: 'ovw-sw', 'aria-hidden': 'true' }), h('span', { text: g.chip }), h('b', { text: String(list.length) }))
    chip.style.setProperty('--a', g.accent)
    chip.addEventListener('click', () => sec.scrollIntoView({ behavior: isRm() ? 'auto' : 'smooth', block: 'start' }))
    chips.append(chip)
  })
  const projects = h('section', { class: 'ovw-projects', 'aria-labelledby': `${idp}-h-pj` },
    h('div', { class: 'ovw-pjbar' }, h(T.sec, { id: `${idp}-h-pj`, class: 'ovw-hs', text: 'Projects' }), chips), ...secs)

  const side = h('div', { class: 'ovw-side' }, experience, education, interests)
  const cols = h('div', { class: 'ovw-cols' }, side, projects)

  // ---- anchor row: each button scrolls the page to that section (smooth unless reduced motion). The dialog keeps its own order; the ending follows the page.
  const anchors = h('nav', { class: 'ovw-anchors', 'aria-label': 'Sections of the overview' })
  const SECTIONS: [string, string, HTMLElement | null][] = end
    ? [['Contact', 'contact', head], ['Experience', 'exp', experience], ['Education', 'edu', education], ['Projects', 'pj', projects], ['Interests', 'int', interests]]
    : [['Experience', 'exp', experience], ['Education', 'edu', education], ['Projects', 'pj', projects], ['Interests', 'int', interests], ['Contact', 'contact', head]]
  for (const [label, key, sec] of SECTIONS) {
    if (!sec) continue
    sec.id = sec.id || `${idp}-s-${key}`
    const b = h('button', { class: 'ovw-anc mono', type: 'button', 'data-cursor': '', 'data-anchor': key, 'aria-label': `Jump to ${label}` }, h('span', { text: label }))
    b.addEventListener('click', () => {
      const sc = o.scroller()
      const rel = (el: HTMLElement) => el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop
      // in the two-column layout the left column is sticky, so its sections are already on screen once the columns start: the dialog brings the page to the top
      // instead, the ending parks the columns at the sticky line so the whole left column and the Projects bar are in view
      const stuck = !!sec.closest('.ovw-side') && getComputedStyle(side).position === 'sticky'
      const top = sec === head ? 0 : stuck ? (end ? Math.max(0, rel(cols) - o.inset() - 16) : 0) : Math.max(0, rel(sec) - o.inset() - 8)
      sc.scrollTo({ top, behavior: isRm() ? 'auto' : 'smooth' })
      const hd = sec.querySelector<HTMLElement>('h1, h2, h3')
      if (hd) { hd.tabIndex = -1; hd.focus({ preventScroll: true }) }
      sec.classList.remove('ovw-flash'); void sec.offsetWidth; sec.classList.add('ovw-flash')
      window.setTimeout(() => sec.classList.remove('ovw-flash'), 1400)
    })
    anchors.append(b)
  }

  // ---- credits: one line per vendored real-world image (src/data/credits.json); nothing renders when the file is absent or empty
  const creditRow = (c: Credit): HTMLElement => {
    const label = c.title || c.what || c.id || 'Image'
    const nm = c.url
      ? h('a', { class: 'ovw-crn', href: c.url, target: '_blank', rel: 'noopener noreferrer', 'data-cursor': '', 'aria-label': `${label} (opens in a new tab)` }, h('span', { text: label }), arrow())
      : h('span', { class: 'ovw-crn', text: label })
    const rest = [c.author, c.licence, c.source].filter(Boolean).join(' · ')
    return h('li', { class: 'ovw-cr', 'data-credit': c.id ?? '' }, c.what && c.what !== label ? h('span', { class: 'ovw-crw mono', text: c.what }) : null, nm, rest ? h('span', { class: 'ovw-crr', text: rest }) : null)
  }
  const credits = CREDITS.length && (!end || o.inline?.credits)
    ? h('section', { class: 'ovw-credits', 'aria-labelledby': `${idp}-h-cr`, 'data-proof': 'skip' }, h(T.sec, { id: `${idp}-h-cr`, class: 'ovw-hs', text: 'Credits' }), h('ul', { class: 'ovw-crl' }, ...CREDITS.map(creditRow)))
    : null

  // ---- the ending's last line: a way back to the top of the page (Replay lives in the contact card)
  let foot: HTMLElement | null = null
  if (end) {
    const top = h('button', { class: 'ovw-more ovw-top', type: 'button', 'data-cursor': '' }, h('span', { text: 'Back to the top' }), h('span', { class: 'ovw-up', 'aria-hidden': 'true', text: '↑' }))
    top.addEventListener('click', () => { o.scroller().scrollTo({ top: 0, behavior: isRm() ? 'auto' : 'smooth' }); title.focus({ preventScroll: true }) })
    foot = h('footer', { class: 'ovw-foot' }, h('p', { class: 'ovw-sign mono', text: `${SITE.name} · ${CHICAGO.school}${classOf ? ` · Class of ${classOf}` : ''}` }), top)
  }

  return { head, cols, credits, foot, anchors, title }
}

export function buildOverview(env: OverviewEnv): Overview {
  const dlg = h('dialog', { class: 'ovw', 'aria-labelledby': 'ovw-h' })
  let built = false, shown = false, t = 0
  /** whatever held focus when the dialog opened; Esc and Close hand it back */
  let opener: HTMLElement | null = null
  let barEl: HTMLElement | null = null
  let ink: FluidHandle | null = null

  const build = () => {
    if (built) return
    built = true

    // ---- top bar
    const close = h('button', { class: 'nbtn ovw-x', type: 'button', 'aria-label': 'Close the overview', 'data-cursor': '' }, h('span', { class: 'tx', text: 'Close' }), h('kbd', { class: 'kb mono', 'aria-hidden': 'true', text: 'Esc' }))
    close.addEventListener('click', () => api.close())
    const tour = h('button', { class: 'nbtn ovw-tourbtn', type: 'button', 'data-cursor': '' }, h('span', { class: 'tx', text: 'Start the tour' }), arrow())
    tour.addEventListener('click', () => env.go('world'))
    const body = buildOverviewBody({ env, idp: 'ovw', scroller: () => dlg, inset: () => barEl?.offsetHeight ?? 60 })
    const bar = h('header', { class: 'ovw-bar' }, h('div', { class: 'ovw-bari' }, h('p', { class: 'ovw-bt mono', text: 'Overview' }), h('div', { class: 'ovw-bb' }, tour, close)), body.anchors)
    barEl = bar

    dlg.append(bar, h('div', { class: 'ovw-in' }, body.head, body.cols, body.credits))
    attachSpotlight(dlg, '.ovw-row, .ovw-fact.is-go')   // 14V: a glow follows the pointer over the rows
    // 15F: liquid-glass cards (they refract the ink behind them); the Index and Contact sheets get the same rim from autoGlass
    dlg.querySelectorAll<HTMLElement>('.ovw-contact, .ovw-side > section').forEach(el => { el.classList.add('ovw-glass'); liquidGlass(el, { radius: 22 }) })
    autoGlass(['dialog.nm .nm-pv', 'dialog.nc .nc-in'])
  }

  const api: Overview = {
    el: dlg,
    isOpen: () => dlg.open && dlg.classList.contains('on'),
    open() {
      // the ending is already the overview: bring it back to its top (a second copy over it would only stack the same page twice)
      if (ending?.active()) { ending.toTop(); return }
      build()
      clearTimeout(t)
      if (!dlg.open) {
        const a = document.activeElement as HTMLElement | null
        opener = a && a !== document.body && !dlg.contains(a) ? a : null
        dlg.showModal()
      }
      dlg.scrollTop = 0
      ink ??= mountFluid(dlg, { fixed: true, strength: 0.62, signature: true, tints: AREA_ORDER.map(id => AREA_COPY[id]?.accent).filter(Boolean) as string[] })
      dlg.style.setProperty('--ovw-bar', (barEl?.offsetHeight ?? 60) + 'px')
      requestAnimationFrame(() => dlg.classList.add('on'))
      if (!shown) { shown = true; env.onToggle(true) }
      if (!isRm()) {
        const parts = dlg.querySelectorAll('.ovw-id > *, .ovw-contact, .ovw-side > section, .ovw-pjbar, .ovw-g:first-of-type .ovw-row')
        animate(parts, { opacity: [0, 1], translateY: [16, 0], delay: stagger(36, { start: 80 }), duration: 640, ease: 'out(4)', onComplete: () => parts.forEach(p => { (p as HTMLElement).style.transform = ''; (p as HTMLElement).style.opacity = '' }) })
      }
    },
    close(instant = false) {
      if (!dlg.open) return
      dlg.classList.remove('on')
      if (shown) { shown = false; env.onToggle(false) }
      clearTimeout(t)
      const done = () => { if (dlg.open && !dlg.classList.contains('on')) dlg.close() }
      if (instant || isRm()) done(); else t = window.setTimeout(done, 240)
    },
  }
  dlg.addEventListener('cancel', e => { e.preventDefault(); api.close() })
  dlg.addEventListener('close', () => {
    ink?.unmount(); ink = null   // 15F: the ink sleeps with the dialog
    dlg.classList.remove('on'); if (shown) { shown = false; env.onToggle(false) }
    // hand focus back to the opener (the top-bar button, or whatever had it); another dialog taking over keeps its own focus
    const o = opener; opener = null
    if (o && o.isConnected && !document.querySelector('dialog[open]')) o.focus({ preventScroll: true })
  })
  return api
}
