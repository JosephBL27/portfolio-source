// Typed access to the vetted data copied from ~/PORTFOLIO/src/data. Never invent numbers.
import projectsRaw from './data/projects.json'
import siteRaw from './data/site.json'
import networkRaw from './data/nervous-system.json'
import graphRaw from './data/brain-graph.json'
import mediaRaw from './data/media.json'

export interface Metric { value: string; label: string }
export interface Project {
  id: string; name: string; kind: string; flagship?: boolean; status: string; statusLabel: string
  period: string; role: string; line: string; keyFigure: Metric; summary: string; why: string
  mechanism: string; pipeline: { step: string; detail: string }[]; metrics: Metric[]; stack: string[]
  links: { label: string; url: string; kind: string }[]; credits?: string
}
export interface MediaItem {
  slug: string; lg: string; sm: string; width: number; height: number; orientation: string
  kind: 'video' | 'screenshot' | string; alt: string; caption: string
}
export interface NetNode { id: string; label: string; kind: 'source' | 'agent' | 'brain' | 'output'; project: string | null; schedule: string; times: string[]; detail: string }
export interface NetEdge { from: string; to: string; label: string; cadence: string }
export interface Graph { stats: any; groups: string[]; nodes: [number, number, number, number][]; links: [number, number][] }

export const projects = projectsRaw as unknown as Project[]
export const site = siteRaw as unknown as { bio: { name: string; claim: string; intro: string; email: string; linkedin: string; offBoard: string } }
export const network = networkRaw as unknown as { nodes: NetNode[]; edges: NetEdge[]; story: string[] }
export const graph = graphRaw as unknown as Graph

// Privacy exclusions (docs/research/content-assets.md): note titles visible in these images.
const EXCLUDE = /note-brain-health|note-brain-architecture|live-portolan|live-rhumb|live-phone/
const mediaAll = mediaRaw as unknown as Record<string, MediaItem[]>
export const media: Record<string, MediaItem[]> = Object.fromEntries(
  Object.entries(mediaAll).map(([k, v]) => [k, v.filter(m => !EXCLUDE.test(m.slug) && !EXCLUDE.test(m.lg))])
)
// media.json keys use folder names; map project ids that differ.
const MEDIA_KEY: Record<string, string> = {}
export const mediaFor = (id: string): MediaItem[] => media[MEDIA_KEY[id] ?? id] ?? []
// every asset URL goes through here, so a build under a subpath (GitHub Pages) resolves the same files
export const url = (p: string) => import.meta.env.BASE_URL + p.replace(/^\//, '')
