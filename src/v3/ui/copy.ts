// Overlay copy registry. Sources: docs/V4-COPY.md (areas, About), src/data/site.json (bio, education),
// src/v3/chapters.ts (per-project bodies and figures), src/data/projects.json (the Work and Systems beats added in
// v9: line and key figure are verbatim). Strings marked NEW are unapproved mock copy that needs Joseph's ruling
// (they are listed as NEW in docs/V4-COPY.md, except the 'world' title and body).
import { CHAPTERS } from '../chapters'
import { WAYPOINTS, type AreaId } from '../world/layout'
import siteRaw from '../../data/site.json'
import projectsRaw from '../../data/projects.json'
import { url } from '../../data'

export interface ProjectLink { label: string; url: string; kind: string }
export interface ProjectLite {
  id: string; name: string; kind: string; line: string; period: string; keyFigure: { value: string; label: string }
  /** 7C: a plain noun phrase for what the work is ("iPhone app", "Stock pitch"), and the year it started (projects.json) */
  type: string; year: string; role: string
  demo?: { label: string; url: string }; links?: ProjectLink[]
}
export const PROJECTS = projectsRaw as unknown as ProjectLite[]
export const projName = (id: string) => PROJECTS.find(p => p.id === id)?.name ?? id
export const projOf = (id: string) => PROJECTS.find(p => p.id === id)
/** the reading instruments (projects.json kind "instrument"): their repo is their primary link on every surface */
export const isInstrument = (id: string) => projOf(id)?.kind === 'instrument'
export const INSTRUMENT_IDS = PROJECTS.filter(p => p.kind === 'instrument').map(p => p.id)

/** 7C (NEW copy): the plain type line of a project card, built only from projects.json facts: "iPhone app · 2026 · Designer, builder and device tester". */
export function typeLine(id: string): string {
  const p = projOf(id)
  return p ? [p.type, p.year, p.role].filter(Boolean).join(' \u00b7 ') : ''
}

/** a local path (docs/x.pdf, demos/x/) or an absolute URL, resolved the way the case view resolves it (a folder means its index.html) */
export const hrefOf = (u: string) => (/^(https?:|mailto:)/.test(u) ? u : url(u.endsWith('/') ? `${u}index.html` : u))
export const isExternal = (href: string) => /^https?:/.test(href) && (() => { try { return new URL(href).origin !== location.origin } catch { return true } })()

export interface Cta { label: string; href: string; external: boolean; kind: string; aria: string }
const HOST_LABEL: Record<string, string> = { 'apps.apple.com': 'App Store' }
/** 7C: the secondary actions of a project card, at most two, same order everywhere: demo (Live demo / Paper / Deck), Code, then a live link when there is no demo. */
export function secondaryCtas(id: string): Cta[] {
  const p = projOf(id)
  if (!p) return []
  const links = p.links ?? []
  const out: Cta[] = []
  const seen = new Set<string>()
  const add = (label: string, u: string, kind: string, what: string) => {
    const href = hrefOf(u)
    if (seen.has(href) || out.length >= 2) return
    seen.add(href)
    const external = isExternal(href)
    out.push({ label, href, external, kind, aria: `${label}: ${p.name}${what ? `, ${what}` : ''}${external ? ' (opens in a new tab)' : ''}` })
  }
  const docKind = (u: string) => links.find(l => l.url === u)?.kind
  const code = links.find(l => l.kind === 'code')
  // a reading instrument's repo leads: it is the one thing the instrument stop asks the visitor to take away
  if (code && isInstrument(id)) add('Source code', code.url, 'code', code.label)
  if (p.demo) add(/\.pdf($|\?)/i.test(p.demo.url) ? (docKind(p.demo.url) === 'deck' ? 'Deck' : 'Paper') : 'Live demo', p.demo.url, 'demo', p.demo.label)
  if (!p.demo) {
    const live = links.find(l => l.kind === 'live')
    if (live) {
      const host = (() => { try { return new URL(hrefOf(live.url), location.origin).hostname } catch { return '' } })()
      const own = !/^https?:/.test(hrefOf(live.url)) || host === location.hostname
      const trimmed = live.label.replace(new RegExp('^' + p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '')
      add(HOST_LABEL[host] ?? (own ? 'Live demo' : trimmed && trimmed.length <= 20 ? trimmed[0].toUpperCase() + trimmed.slice(1) : 'Live site'), live.url, 'live', live.label)
    }
  }
  if (code && !isInstrument(id)) add('Source code', code.url, 'code', code.label)
  const doc = links.find(l => l.kind === 'paper' || l.kind === 'deck')
  if (doc) add(doc.kind === 'deck' ? 'Deck' : 'Paper', doc.url, doc.kind, doc.label)
  return out
}
/** the repo of a project as one link (the Source code row of the reading instruments: stop, education list, Index) */
export function sourceCta(id: string): Cta | null {
  const p = projOf(id), code = p?.links?.find(l => l.kind === 'code')
  if (!p || !code) return null
  const href = hrefOf(code.url), external = isExternal(href)
  return { label: 'Source code', href, external, kind: 'code', aria: `Source code: ${p.name}${external ? ' (opens in a new tab)' : ''}` }
}
const site = siteRaw as any
export const SITE = site.bio as { name: string; claim: string; intro: string; email: string; linkedin: string; offBoard: string }
export interface Edu { school: string; program: string; years: string; notes: string }
const EDU_DATA = site.education as Edu[]
const uchi = EDU_DATA.find(e => /Chicago/.test(e.school))!
const before = EDU_DATA.filter(e => e !== uchi)
/** Chicago's motto and its translation (the form lettering CRESCAT SCIENTIA · VITA EXCOLATUR is the same line). NEW copy. */
export const MOTTO = { latin: 'Crescat scientia, vita excolatur', english: 'Let knowledge grow from more to more; and so be human life enriched' }
/** The education overlay lists two rows: Chicago's motto (the hero), then ONE quiet line for everything before Chicago.
 *  The title and lede above already say University of Chicago and the degrees, so the list does not repeat them. */
export const EDUCATION: Edu[] = [
  { school: MOTTO.latin, program: MOTTO.english, years: 'University motto', notes: uchi.notes },
  { school: 'Before Chicago', program: before.map(e => e.school).join(', '), years: `${Math.min(...before.map(e => +/\d{4}/.exec(e.years)![0]))} - ${Math.max(...before.map(e => +(/(\d{4})\D*$/.exec(e.years)?.[1] ?? 0)))}`, notes: before.find(e => /Michigan/.test(e.school))?.notes ?? '' },
]

export interface AreaCopy { id: AreaId; numeral: string; kicker: string; title: string; body: string; accent: string }
/** w12: the six areas in flight order (Work I to About VI). `kicker` is the plain area name (it is the HUD, rail and overlay label, so they cannot drift apart);
 *  `title` is the old poetic title, which the first stop of an area now shows as the small italic line above the plain name. */
export const AREA_COPY: Record<string, AreaCopy> = {
  work: { id: 'work', numeral: 'I', kicker: 'Work', title: 'Built for Others', body: 'A research internship at a volatility-focused investment firm, two stock pitches, the lesson pipeline for a learning-games startup, and the tracker behind my own recruiting.', accent: '#B48CFF' },
  systems: { id: 'systems', numeral: 'II', kicker: 'Systems', title: 'Left Running', body: 'The Secretary reads four inboxes four times a day, and a watchdog checks every job each hour for the thing it was supposed to make.', accent: '#FF4A2B' },
  research: { id: 'research', numeral: 'III', kicker: 'Research', title: 'The Hidden Grammar', body: 'Couples as coupled equations, 3,073 counties after a war, and shoppers sent into thrift stores in pairs.', accent: '#FF6A8A' },
  mind: { id: 'mind', numeral: 'IV', kicker: 'Second Brain', title: 'Where the Mind Leads', body: 'Everything I build runs through one Obsidian brain: my agents read it first and commit what they learn back to it.', accent: '#8FB8FF' },
  education: { id: 'education', numeral: 'V', kicker: 'Education', title: 'University of Chicago', body: 'Economics (BA) and Computational and Applied Mathematics (BS), class of 2029.', accent: '#D9A441' },
  about: { id: 'about', numeral: 'VI', kicker: 'About', title: 'Off the Board', body: '', accent: '#EDE6D6' },
}
export const AREA_ORDER = ['work', 'systems', 'research', 'mind', 'education', 'about']
/** 7C (NEW copy), w12 shortened: what each area IS in a few words, for a visitor who has never seen the site (the contents list, the Index preview, the tour). */
export const AREA_PLAIN: Record<string, string> = {
  work: 'An internship, pitches and a startup',
  systems: 'Agents and apps I run every day',
  research: 'Studies of human behavior',
  mind: 'The shared memory my agents use',
  education: 'Chicago and my reading instruments',
  about: 'Five things away from the screen',
}
/** w12 (NEW): ONE sentence per area saying what is in it; shown under the plain title on the first stop of the area. Every noun traces to projects.json or site.json. */
export const AREA_WHAT: Record<string, string> = {
  work: 'A quantitative research internship at QVR Advisors, two stock pitches, the tracker behind my recruiting and a learning-games startup.',
  systems: 'Agents and apps I built and run every day: an inbox secretary, a job watchdog, an alarm, an arithmetic drill and a poker model.',
  research: 'Three studies of behavior: a model of reality-TV couples, war investment across American counties, and a field design for thrift shoppers.',
  mind: 'The shared memory my agents read before they work and write back to after.',
  education: 'Economics and Computational and Applied Mathematics at the University of Chicago, and the reading instruments I built for Ovid, Homer and Pu Songling.',
  about: 'Five things I do away from the screen: bouldering, board games, records, guitar and chess.',
}

/** w12 (NEW): the first screen. Row 1 changes with the pointer; every area name is read from AREA_NAME so the route cannot drift from the flight. */
export const FIRST_SCREEN = {
  how: [
    { cue: { fine: 'Scroll', coarse: 'Swipe up' }, rest: ' to fly from stop to stop' },
    { cue: { fine: 'Open case study', coarse: 'Open case study' }, rest: ' on any project for the full story' },
    { cue: { fine: 'Index (M)', coarse: 'Index (M)' }, rest: ' to jump to an area, ', cue2: 'Overview (O)', rest2: ' to see everything on one page' },
  ],
  routeLabel: 'The route:',
  start: { label: 'Start', arrow: '\u2193', aria: 'Start: fly to the first stop' },
  tour: { label: 'Watch the tour', arrow: '\u25b6', aria: 'Watch the guided tour: the best stops, flown automatically' },
}
export const routeLine = () => AREA_ORDER.map(a => AREA_NAME[a] ?? a).join(' \u2192 ')

/** 10H (NEW): the lede of the hall card (no figure; the numbers sit in the window captions, which read site.json) */
export const HALL_BODY = 'A long hall with five windows, one for each thing I do away from the screen.'
/** w11 copy (NEW): the About section is the doors (gate), the hall, then one stop per interest. Lines are listed as NEW in docs/V4-COPY.md section 17. */
export const GATE_LEDE = 'Five windows, one for each thing I do away from the screen.'  // w12: no longer shown (the area sentence says it); kept for the tour
export const GATE_AFFORD = { fine: 'Scroll to open the doors', coarse: 'Swipe up to open the doors' }
export const HALL_TITLE = 'Five Windows'
export const HALL_LINE = {
  fine: 'Hover a window to light it. Click to step through the glass, or keep scrolling and leave by the far doors.',
  coarse: 'Tap a window to step through the glass, or keep swiping and leave by the far doors.',
}

/** About lines 1 and 2 (V4-COPY section 3); line 3 is the four beats below (verbatim site.json offBoard, minus its lead). */
export const ABOUT_LINES = [
  'I study economics and computational and applied math at the University of Chicago, and I build systems that run themselves.',
  'I turn old books into instruments, with wheels and charts for Ovid, Homer and Pu Songling that sit beside the print text, and I build poker tools that price and grade my own decisions.',
]
// v10 (NEW copy): guitar joins the Off the Board beats, in the order of the About waypoints (hold, meeple, records, guitar, knight).
// The figure is bio.guitar in site.json ("16", "years playing guitar"); the beat reads "16" / "years on guitar" (the figure alone is the big line, so it never wraps over the paragraph above it).
const GUITAR_BEAT = { big: site.bio.guitar.value as string, small: 'years on guitar' }
export const ABOUT_BEATS = (() => {
  const beats = CHAPTERS.find(c => c.id === 'offboard')!.beats.map(b => ({ big: b.lines?.[0] ?? '', small: b.lines?.slice(1).join(' ') ?? '' }))
  const at = beats.findIndex(b => /records/i.test(b.small))
  beats.splice(at >= 0 ? at + 1 : beats.length, 0, GUITAR_BEAT)
  return beats
})()
export const ABOUT_LINE3 = SITE.offBoard.replace(/^Off the board:\s*/i, '')

export type OverlayKind = 'prologue' | 'name' | 'world' | 'area' | 'sub' | 'offboard' | 'interest' | 'epilogue'
export interface OverlayCopy {
  id: string
  kind: OverlayKind
  side: 'l' | 'r' | 'c'
  area?: string
  accent: string
  /** header kicker (mono) */
  kicker: string
  numeral?: string
  /** title text, rendered in the lane at the top (w12: the plain big title) */
  title: string
  /** w12: the small italic line above the big title (the old poetic title); when absent the title is split on its leading small words */
  lead?: string
  /** area body (first overlay of an area) */
  body?: string
  /** w12: the same line for touch pointers (the hall's "Tap a window") */
  bodyCoarse?: string
  /** project block */
  proj?: { kicker: string; body: string; figure?: { value: string; label: string } }
  projects: string[]
  /** 7C: the project this beat is about (one card, same shape everywhere) and the other TVs featured here ("Also here") */
  featured?: string
  also?: string[]
  /** 7C: the area in plain words (first beat of an area only) */
  what?: string
  /** 8C: the stops of this area in flight order (first beat of an area with more than one stop; each flies there) */
  stops?: StopInfo[]
  /** w11: the label of the stop row when it is not "N stops" (market: "Also in Research") */
  stopsLabel?: string
  /** w11: one mono affordance line; `coarse` replaces `fine` on touch pointers */
  afford?: { fine: string; coarse?: string }
  /** w11: a short paragraph under the lede that phones hide (the hall's bio) */
  bio?: string
  /** w11: one interest stop of the About section (stat from site.json, one affordance line, two chips) */
  interest?: { n: number; stat: { value: string; label: string }; afford: string; prev: { id: string; label: string }; next: { id: string; label: string } }
}

const chapter = (id: string) => CHAPTERS.find(c => c.id === id)

const FIRST_OF_AREA = new Set(['mind', 'secretary', 'market', 'surface', 'school', 'education', 'offboard', 'gate'])
/** 7C: the project each chapter-backed beat is about (the beats of BEATS carry their own `project`) */
const FEATURED: Record<string, string> = { mind: 'second-brain', alarm: 'selforge', drill: 'zeta', table: 'table-model', market: 'love-island', record: 'wwii', pair: 'thrift', surface: 'qvr', instrument: 'metamorphoses' }
/** w12: the area sentence of the Second Brain intro already says what the project does, so its card leaves the sentence out */
const LEDE_SAYS_IT = new Set(['mind'])
/** w12: the first stop of an area: the plain area name is the big title, the old poetic title the small italic lead, one sentence says what is inside */
function asIntro(o: OverlayCopy, area: string): OverlayCopy {
  const ac = AREA_COPY[area]
  if (!ac) return o
  o.lead = ac.title; o.title = AREA_NAME[area] ?? ac.kicker; o.what = AREA_WHAT[area]; o.body = undefined
  return o
}
/** the card of a beat: the project's own sentence and key figure (verbatim from projects.json), the name, and the other TVs featured here */
function cardOf(o: OverlayCopy, pid: string, tvs: string[], first: boolean, id: string): OverlayCopy {
  const pj = projOf(pid)
  if (!pj) return o
  o.featured = pid
  o.also = tvs.filter(t => t !== pid)
  o.proj = { kicker: pj.name, body: first && LEDE_SAYS_IT.has(id) ? '' : pj.line, figure: pj.keyFigure }
  if (first) asIntro(o, o.area ?? '')
  else { o.lead = o.title; o.title = shortName(pid) }   // w12: a project stop is titled with the project; the poetic title becomes the small line above it
  return o
}

/** v9 beats that have no chapter in chapters.ts. Title and kicker are NEW; body is the project's own `line` and the figure its
 *  `keyFigure`, both verbatim from projects.json (so every numeral traces to src/data). `project` is the projects.json id. */
const BEATS: Record<string, { side: 'l' | 'r'; title: string; kicker: string; project?: string; body?: string; noBody?: boolean; areaKicker?: string }> = {
  secretary: { side: 'l', title: '', kicker: 'Secretary', project: 'secretary', noBody: true },   // first of Systems: the area body already says what it does
  watchdog: { side: 'r', title: 'The Watchdog', kicker: 'Job Watchdog', project: 'watchdog' },
  cloudflare: { side: 'r', title: 'The Edge', kicker: 'Cloudflare (NET) Pitch', project: 'cloudflare' },
  appfolio: { side: 'l', title: 'The Second Act', kicker: 'AppFolio (APPF) Pitch', project: 'appfolio' },
  recruiting: { side: 'r', title: 'The Deadline Board', kicker: 'Recruiting OS', project: 'recruiting-os' },
  chomchom: { side: 'l', title: 'The Lesson Map', kicker: 'ChomChom', project: 'chomchom' },
  mathecon: { side: 'l', title: 'Economics + Applied Math', areaKicker: 'Economics and Computational and Applied Mathematics', kicker: '', body: 'The coursework behind it, written out in chalk: mathematics, economics and finance.' },
}

const HAS_GATE = WAYPOINTS.some(w => w.id === 'gate')
/** w11 (NEW): the five interest stops, in flight order. Stats come from site.json through ABOUT_BEATS (V8, 80+, 400+, the guitar figure, 1750); the line under each is the one thing to try. */
const INTEREST_ORDER = ['hold', 'meeple', 'records', 'guitar', 'knight']
export const INTEREST: Record<string, { title: string; afford: string }> = {
  hold: { title: 'Bouldering', afford: 'Press a hold to climb the next move, then time the dyno' },
  meeple: { title: 'Board games', afford: 'Press a die to throw them all' },
  records: { title: 'Records', afford: 'Pick a sleeve and drop it on the platter' },
  guitar: { title: 'Guitar', afford: 'Sweep the pointer across the strings' },
  knight: { title: 'Chess', afford: 'The Opera Game, move by move. Step it with the brass buttons' },
}
function interestCopy(id: string, ac: AreaCopy): OverlayCopy {
  const n = INTEREST_ORDER.indexOf(id), it = INTEREST[id], b = ABOUT_BEATS[n]
  const stat = id === 'guitar' ? { value: site.bio.guitar.value as string, label: site.bio.guitar.label as string } : { value: b.big, label: b.small }
  const nx = INTEREST_ORDER[n + 1]
  const next = nx ? { id: nx, label: INTEREST[nx].title } : { id: 'epilogue', label: 'Contact' }
  return {
    id, kind: 'interest', side: 'r', area: 'about', accent: ac.accent, kicker: `${ac.title} \u00b7 0${n + 1}`, numeral: ac.numeral, title: it.title, projects: [],
    interest: { n: n + 1, stat, afford: it.afford, prev: { id: 'hall', label: 'The hall' }, next },
  }
}

/** build the copy for an overlay id; `tvs` are the project ids featured on its waypoints */
function baseCopyFor(id: string, area: string, tvs: string[]): OverlayCopy {
  const ac = AREA_COPY[area]
  if (id === 'prologue') {
    const c = chapter('prologue')!
    return { id, kind: 'prologue', side: 'c', accent: c.accent, kicker: c.kicker, title: c.title, body: c.body, projects: [] }
  }
  if (id === 'name') {
    return { id, kind: 'name', side: 'c', accent: '#EDE6D6', kicker: 'University of Chicago · Economics + Computational and Applied Math · Class of 2029', title: SITE.name, body: SITE.claim, projects: [] }
  }
  if (id === 'world') {
    // NEW (not in V4-COPY): the establishing shot names the idea once
    return { id, kind: 'world', side: 'l', accent: '#EDE6D6', kicker: 'The world', title: 'The Six areas', body: 'One screen at the centre and six areas around it. Scroll and the camera takes you round in this order, or pick one.', projects: [] }
  }
  if (id === 'epilogue') {
    const c = chapter('epilogue')!
    return { id, kind: 'epilogue', side: 'l', accent: '#FF4A2B', kicker: c.kicker, title: c.title, body: c.body, projects: [] }
  }
  if (INTEREST[id]) return interestCopy(id, ac)
  if (id === 'gate') {
    // w11 (NEW): the doors open the About section: kicker "VI · About", the area title, a plain line, the lede, and one affordance line
    return asIntro({ id, kind: 'area', side: 'l', area, accent: ac.accent, kicker: ac.kicker, numeral: ac.numeral, title: ac.title, afford: GATE_AFFORD, projects: [] }, area)
  }
  if (id === 'hall') {
    if (HAS_GATE) {
      // w11 (NEW): once the doors have their own stop, the hall is a plain sub-stop: "Five Windows", one line, and the bio once (desktop only)
      return { id, kind: 'sub', side: 'l', area, accent: ac.accent, kicker: ac.kicker, numeral: ac.numeral, title: HALL_TITLE, body: HALL_LINE.fine, bodyCoarse: HALL_LINE.coarse, bio: ABOUT_LINES.join(' '), projects: [] }
    }
    // 10H (NEW copy): the first card of the About area, standing in the hall; the five windows are the interests, the stop chips fly to each. The hint under the windows lives in extras/hall.ts.
    return { id, kind: 'area', side: 'l', area, accent: ac.accent, kicker: ac.kicker, numeral: ac.numeral, title: ac.title, body: HALL_BODY, projects: [] }
  }
  if (id === 'offboard') {
    return { id, kind: 'offboard', side: 'r', area, accent: ac.accent, kicker: ac.kicker, numeral: ac.numeral, title: ac.title, projects: [] }
  }
  // v9 beats without a chapter: secretary, watchdog, cloudflare, appfolio, recruiting, chomchom, mathecon
  const bt = BEATS[id]
  if (bt) {
    const pj = bt.project ? PROJECTS.find(p => p.id === bt.project) : undefined
    const first = FIRST_OF_AREA.has(id)
    const o: OverlayCopy = {
      id, kind: first ? 'area' : 'sub', side: bt.side, area, accent: ac?.accent ?? '#EDE6D6',
      kicker: bt.areaKicker ?? ac?.kicker ?? '', numeral: ac?.numeral,
      title: first ? ac.title : bt.title,
      body: first ? ac.body : undefined,
      projects: tvs,
    }
    if (bt.project && pj) return cardOf(o, bt.project, tvs, first, id)
    const body = bt.noBody ? '' : (bt.body ?? pj?.line ?? '')
    o.proj = { kicker: bt.kicker, body, figure: pj?.keyFigure }
    if (first) asIntro(o, area)
    return o
  }
  // chapter-backed overlays: mind, alarm, drill, table, market, record, pair, surface, instrument; education has its own list
  const ch = chapter(id === 'education' ? 'instrument' : id)
  const first = FIRST_OF_AREA.has(id)
  const sides: Record<string, 'l' | 'r'> = { mind: 'r', alarm: 'l', drill: 'r', table: 'l', market: 'r', record: 'l', pair: 'r', surface: 'l', education: 'r', instrument: 'r' }
  const o: OverlayCopy = {
    id, kind: first ? 'area' : 'sub', side: sides[id] ?? 'l', area, accent: ac?.accent ?? ch?.accent ?? '#EDE6D6',
    kicker: ac?.kicker ?? '', numeral: ac?.numeral,
    title: first ? ac.title : (ch?.title ?? id),
    body: first ? ac.body : undefined,
    projects: tvs,
  }
  if (id === 'education') return asIntro(o, area)
  if (FEATURED[id]) { if (ch?.accent && !first) o.accent = ch.accent; return cardOf(o, FEATURED[id], tvs, first, id) }
  if (ch) {
    const same = first && ch.body === ac.body
    o.proj = { kicker: ch.kicker === ac?.kicker ? '' : ch.kicker, body: same ? '' : (ch.body ?? ''), figure: ch.figure }
    if (ch.accent && !first) o.accent = ch.accent
    if (first && ch.accent) o.accent = ac.accent
    if (first) asIntro(o, area)
  }
  return o
}

/** build the copy for an overlay id, plus (8C) the stop list on the first card of an area that has more than one stop */
export function copyFor(id: string, area: string, tvs: string[]): OverlayCopy {
  const o = baseCopyFor(id, area, tvs)
  if (o.kind === 'area') { const s = stopsOf(area); if (s.length > 1) o.stops = s }
  return o
}

// ---------------------------------------------------------------------------------------------------------------------
// 8C: where the visitor is, in plain words. One model feeds the HUD ("Job Watchdog, 2 of 5 in Systems"), the area cards
// (the stop list), the Index menu (counts) and the Overview. Everything derives from WAYPOINTS and projects.json, so a stop
// that another unit adds to layout.ts shows up here without an edit.
// ---------------------------------------------------------------------------------------------------------------------
/** short area names (the Index and the Overview use them; 'Systems' and 'Research' are NEW, see docs/V4-COPY.md) */
export const AREA_NAME: Record<string, string> = { hub: 'The Hub', mind: 'Second Brain', systems: 'Systems', research: 'Research', work: 'Work', education: 'Education', about: 'About' }

/** short names for the stops whose project name is too long for a one-line readout (NEW copy) */
const SHORT: Record<string, string> = { thrift: 'Thrift study', cloudflare: 'Cloudflare pitch', appfolio: 'AppFolio pitch', odyssey: 'Odyssey', metamorphoses: 'Metamorphoses', liaozhai: 'Liaozhai' }
/** stops that are not about one project (NEW copy) */
const STOP_NAME: Record<string, string> = {
  clouds: 'Opening', name: 'Name', world: 'The six areas', epilogue: 'Contact',
  school: 'University of Chicago', mathecon: 'Economics and math', instrument: 'Reading instruments',
  gate: 'The doors', hall: 'The hall', hold: 'Bouldering', meeple: 'Board games', records: 'Records', guitar: 'Guitar', knight: 'Chess', reader: 'Reading',
}
export const shortName = (pid: string) => SHORT[pid] ?? projName(pid)
const titleCase = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, ' ')

export interface StopInfo {
  /** waypoint id (nav.go takes it) and its index in WAYPOINTS */
  id: string; wp: number
  /** plain name of the stop */
  name: string
  /** area id ('hub' for the opening three and the closing line) */
  area: string
  /** 1-based position inside the area, and the area's stop count */
  i: number; n: number
}
const stopsByArea = new Map<string, StopInfo[]>()
const stopByWp: StopInfo[] = []
WAYPOINTS.forEach((w, wp) => {
  const key = w.id === 'epilogue' ? 'end' : w.area
  const pid = FEATURED[w.overlay] ?? BEATS[w.overlay]?.project ?? (w.tvs?.length === 1 ? w.tvs[0] : undefined)
  const name = STOP_NAME[w.id] ?? (pid ? shortName(pid) : titleCase(w.id))
  const info: StopInfo = { id: w.id, wp, name, area: w.area, i: 0, n: 0 }
  const list = stopsByArea.get(key) ?? []
  list.push(info); stopsByArea.set(key, list); stopByWp.push(info)
})
stopsByArea.forEach(list => list.forEach((s, k) => { s.i = k + 1; s.n = list.length }))
/** the stops of an area in flight order ('hub' lists the opening three) */
export const stopsOf = (area: string): StopInfo[] => stopsByArea.get(area) ?? []
export const stopAt = (wp: number): StopInfo | null => stopByWp[wp] ?? null
/** the line under the stop name: "2 of 5 in Systems"; empty at the hub stops (w11: no "Stop 1 of 3") */
export function positionOf(s: StopInfo): string {
  if (s.id === 'epilogue') return 'The last stop'
  if (s.area === 'hub') return ''
  return `${s.i} of ${s.n} in ${AREA_NAME[s.area] ?? s.area}`
}
/** the area line of the readout: "Systems"; "Prologue" at the clouds and the name, "The World" at the world, "End" at the contact stop */
export function areaLabel(s: StopInfo): string {
  if (s.id === 'epilogue') return 'End'
  if (s.area === 'hub') return s.id === 'world' ? 'The World' : 'Prologue'
  return AREA_NAME[s.area] ?? s.area
}
