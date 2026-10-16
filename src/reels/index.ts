// The featured reels, in channel order (id, then the project it belongs to):
//   ember (selforge), synapse (second-brain), felt (table-model), spots (hand-compass), phase (love-island),
//   digits (zeta), surface (qvr), counties (wwii), dyads (thrift), rings (metamorphoses), deadlines (recruiting-os),
//   cloudflare (cloudflare), appfolio (appfolio), chomchom (chomchom), secretary (secretary), watchdog (watchdog)
import type { ReelDef } from './types'
import { TEST_REEL } from './test'
import ember from './ember'
import synapse from './synapse'
import felt from './felt'
import spots from './spots'
import phase from './phase'
import digits from './digits'
import surface from './surface'
import counties from './counties'
import dyads from './dyads'
import rings from './rings'
import deadlines from './deadlines'
import cloudflare from './cloudflare'
import appfolio from './appfolio'
import chomchom from './chomchom'
import secretary from './secretary'
import watchdog from './watchdog'
import axeos from './axeos'
import skills from './skills'
import finder from './finder'
import carta from './carta'
import odyssey from './odyssey'
import liaozhai from './liaozhai'
import studyloop from './studyloop'
import { posterReel, type PosterStyle } from './poster'
import projects from '../data/projects.json'

export const REELS: ReelDef[] = [ember, synapse, felt, spots, phase, digits, surface, counties, dyads, rings, deadlines, cloudflare, appfolio, chomchom, secretary, watchdog].filter(Boolean)
if (!REELS.length) REELS.push(TEST_REEL)

/** Channel index of the reel that belongs to a project, or -1 when the project has no reel. */
export function reelFor(projectId: string): number {
  return REELS.findIndex(r => r.projectId === projectId)
}

// v11 (unit 7C): every project opens a case view. A work with no reel of its own gets a poster in its own colour, so no button is ever a
// silent no-op. REELS stays the hub TV's channel list (real reels only); CASE_REELS is what the case view, the Index and the CTAs use.
const POSTER_STYLE: Record<string, PosterStyle> = {
  skills: { accent: '#8FB8FF', variant: 0 },
  'axe-os': { accent: '#B7A6FF', variant: 3 },
  carta: { accent: '#D9B779', variant: 1 },
  'finder-organizer': { accent: '#F2884A', variant: 2 },
  'notebooklm-study-loop': { accent: '#F2B441', variant: 1 },
  odyssey: { accent: '#D9A441', variant: 1 },
  liaozhai: { accent: '#D2625A', variant: 3 },
}
// v14 (unit 10R): bespoke reels for the seven works that had only a poster. They live in the case view and project TVs, not the hub channel list.
const CASE_ONLY: ReelDef[] = [axeos, skills, finder, carta, odyssey, liaozhai, studyloop]
const posters: ReelDef[] = (projects as { id: string; name: string }[])
  .filter(p => !REELS.some(r => r.projectId === p.id) && !CASE_ONLY.some(r => r.projectId === p.id))
  .map(p => posterReel(p.id, p.name, POSTER_STYLE[p.id] ?? { accent: '#EDE6D6' }))
export const CASE_REELS: ReelDef[] = [...REELS, ...CASE_ONLY, ...posters]
/** Case-view channel of a project (every project in projects.json has one), or -1 for an unknown id. */
export function caseIndexFor(projectId: string): number {
  return CASE_REELS.findIndex(r => r.projectId === projectId)
}
export type { ReelDef }
