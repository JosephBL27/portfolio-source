// Per-song looks for the show (the 8 picks in src/data/music.json). The authored `vibe` (palette, tempo, ripple, strobe, rain, spark) already sets the mood of the post pass;
// this derives how the room's instruments behave from the same numbers, with a few hand-set accents per song. Nothing here names or quotes anything but the title.
import type { Vibe } from '../vibe/presets'

export interface Mood {
  /** mirror segments of the vinyl's kaleidoscope */
  kal: number
  /** how many of the four light beams are on, how hard they snap to a new aim on a hit (0 = a slow sweep only), and their width */
  beams: number; snap: number; beamW: number
  /** the frequency landscape: height gain and how crisp its contour lines are */
  land: number; crisp: number
  /** embers thrown off the ring on a kick, per kick (0..1) and the sparkle that rides the highs (motes in the shafts) */
  ember: number; sparkle: number
  /** rain streaks on the window, a fast flicker on the snare (kept under 3 Hz by consumers) */
  rain: number; flick: number
  /** the spectrum ring: 0 = thin blades, 1 = wide soft petals */
  petal: number
}
const BASE: Mood = { kal: 6, beams: 3, snap: 0.5, beamW: 1, land: 1, crisp: 0.5, ember: 0.5, sparkle: 0.3, rain: 0, flick: 0, petal: 0.3 }
const BY_TITLE: [RegExp, Partial<Mood>][] = [
  [/the chain/i, { kal: 6, beams: 2, snap: 0.3, land: 1.35, ember: 0.7, petal: 0.55 }],
  [/day in the life/i, { kal: 8, beams: 3, snap: 0.1, beamW: 1.5, land: 1.1, crisp: 0.15, ember: 0.2, sparkle: 0.5, petal: 0.9 }],
  [/london calling/i, { kal: 12, beams: 4, snap: 1, beamW: 0.7, land: 1.2, crisp: 0.9, ember: 1, flick: 0.4, petal: 0 }],
  [/tambourine/i, { kal: 6, beams: 2, snap: 0.2, beamW: 1.3, land: 0.8, crisp: 0.3, ember: 0.3, sparkle: 0.6, petal: 0.8 }],
  [/reaper/i, { kal: 10, beams: 3, snap: 0.5, land: 1, crisp: 0.7, ember: 0.3, sparkle: 1, petal: 0.1 }],
  [/through the wire/i, { kal: 8, beams: 3, snap: 0.35, land: 1.25, ember: 0.6, petal: 0.5 }],
  [/hunger strike/i, { kal: 6, beams: 2, snap: 0.15, beamW: 0.8, land: 0.9, crisp: 0.8, ember: 0.1, sparkle: 0.1, rain: 1, petal: 0.2 }],
  [/rest for the wicked/i, { kal: 8, beams: 4, snap: 0.9, beamW: 0.8, land: 1.1, crisp: 1, ember: 0.9, flick: 0.6, petal: 0 }],
]
export function moodOf(t: { title?: string } | null, v: Vibe): Mood {
  const m: Mood = { ...BASE, kal: v.bpm < 90 ? 8 : v.bpm < 125 ? 6 : 10, snap: v.ripple === 'snare' ? 0.8 : 0.4, rain: v.rain, sparkle: Math.max(0.2, v.spark), flick: v.strobe * 4 }
  for (const [re, o] of BY_TITLE) if (t?.title && re.test(t.title)) Object.assign(m, o)
  return m
}
