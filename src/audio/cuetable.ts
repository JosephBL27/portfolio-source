// PNEUMA v9 cue table: every cue id the engine implements, with the payload to render it with, how long to render, and a one-line
// description of the sound. It is the single source for the offline check (scripts/sfx-check.mjs renders every row through the real
// master chain and reports peak and RMS) and for the table in docs/research/sfx-v9.md.
import type { CueOpts } from './kit'

export type CueGroup = 'legacy' | 'hub' | 'tv' | 'pov' | 'type' | 'glyph' | 'brain' | 'lab' | 'evidence' | 'count' | 'guitar' | 'sig' | 'trans' | 'obj' | 'music'
export interface CueRow {
  id: string
  group: CueGroup
  /** payload the emitter would send (the event's data) */
  opts?: CueOpts
  /** seconds to render */
  secs: number
  /** the cue counts as audible if its peak is above this many dBFS (tiny, deliberate sounds like the odometer tick get a lower bar) */
  min: number
  desc: string
  /** a scripted scene instead of one cue: events at t seconds (cues and/or flight updates); `id` is then a label */
  script?: { t: number; cue?: [string, CueOpts?]; flight?: { speed: number; area: string; mix: number; wp: number } }[]
}

const row = (group: CueGroup, id: string, secs: number, desc: string, opts?: CueOpts, min = -45): CueRow => ({ id, group, opts, secs, min, desc })
const sig = (id: string, secs: number, desc: string): CueRow => row('sig', `sig.${id}`, secs, desc, undefined, -40)

/** a continuous gesture as a series of events at a given cadence */
const stream = (id: string, n: number, dt: number, at: (i: number) => CueOpts, t0 = 0.05) =>
  Array.from({ length: n }, (_, i) => ({ t: t0 + i * dt, cue: [id, at(i)] as [string, CueOpts] }))

export const CUE_TABLE: CueRow[] = [
  // ---- the v4 palette (unchanged; included so the check covers every id the engine accepts)
  row('legacy', 'poweron', 3.4, 'degauss thump, raster sweep, flyback whine, harmonic pad (the name waypoint)', undefined, -30),
  row('legacy', 'poweroff', 3.2, 'collapse to a line, a pop at the dot, phosphor ring (the epilogue)', undefined, -30),
  row('legacy', 'channel', 1.2, 'static burst, detent tick, 170 Hz chunk'),
  row('legacy', 'wind', 4.4, 'pink-noise swell sweeping 260 to 780 Hz, panned left to right (the clouds)', undefined, -40),
  row('legacy', 'whoosh', 1.6, 'rail-jump air sweep'),
  row('legacy', 'whoosh.rev', 1.6, 'the same, backwards (rate 0.8, pan reversed)'),
  row('legacy', 'land', 1.2, 'soft 72 Hz landing thud'),
  row('legacy', 'morph', 2.4, 'morph shimmer for the area the camera is in', undefined, -50),
  row('legacy', 'wake', 3.2, 'the small TVs waking: a rising run on the 60 Hz series with a static bloom', undefined, -40),
  row('legacy', 'hover', 0.5, 'dry tick and a 2.1 kHz blip', undefined, -50),
  row('legacy', 'click', 0.8, 'noise tick, 1.2 kHz blip, 160 Hz body; ducks the bed'),
  row('legacy', 'open', 1.6, 'tube swell as the camera pushes into a screen'),
  row('legacy', 'close', 1.4, 'the reverse, with a thud'),
  ...(['hub', 'mind', 'systems', 'research', 'work', 'education', 'about'] as const).map(a => row('legacy', a, 3.2, `area arrival: channel tick, landing and the ${a} settle`, undefined, -40)),
  ...(['hub', 'mind', 'systems', 'research', 'work', 'education', 'about'] as const).map(a => row('legacy', `morph.${a}`, 2.4, `morph shimmer for ${a}`, undefined, -50)),

  // ---- the hub TV
  row('hub', 'hub:detent', 0.6, 'bakelite detent: hard tick over the notch, softer one as it seats, damped knock pitched to the channel degree of the 60 Hz series', { ch: 3 }),
  row('hub', 'hub:channel', 1.0, 'static burst plus a tuned chirp that lands on the channel degree', { i: 3 }),
  row('hub', 'hub:button', 0.8, 'A button down: heavy clunk, latch click, a little spring in it', { which: 'A', down: true }),
  row('hub', 'hub:button', 0.8, 'A button up: the spring letting go (tick and short twang)', { which: 'A', down: false }),
  row('hub', 'hub:poweron', 2.4, 'degauss wobble (56 and 64 Hz beating), thump, raster open, flyback whine rising low and filtered', undefined, -30),
  row('hub', 'hub:poweroff', 2.2, 'collapse zip to the dot: downward sweep, pop, ringing phosphor dot', { k: 0 }, -30),

  // ---- the small TVs
  row('tv', 'tv:grab', 0.8, 'cabinet creak, a low knock, a breath of cloth', { id: 'qvr' }),
  row('tv', 'tv:spin', 1.4, 'continuous: stick-slip creak and air whoosh scaled by speed (one voice, steered)', { id: 'qvr', speed: 0.7 }, -50),
  row('tv', 'tv:release', 1.8, 'creak settling, soft thunk, air spinning down (longer for a faster throw)', { id: 'qvr', speed: 0.7 }),

  // ---- point of view
  row('pov', 'pov:grab', 0.9, 'soft air intake, faint touch'),
  row('pov', 'pov:drag', 1.4, 'continuous wind; pitch and level follow speed, stereo sweep widens with speed (one voice, steered)', { speed: 0.6 }, -50),
  row('pov', 'pov:release', 1.8, 'wind falling away, longer the faster it was moving', { speed: 0.6 }),
  row('pov', 'pov:return', 1.4, 'spring settle: a sine ringing round its rest pitch, air sweep home, soft landing'),

  // ---- type and glyphs
  row('type', 'type:assemble', 1.6, 'granular ticks that accelerate and rise through the series, panned left to right, wider with more letters, then a glass lock', { n: 10 }),
  row('type', 'type:shatter', 2.0, 'crack, then a scatter of glassy FM grains, sizzle over them', { n: 10 }),
  ...(['mind', 'systems', 'research', 'work', 'education', 'about'] as const).map(a => row('glyph', 'glyph:burst', 1.2, `soft chalk and print flurry (${a})`, { area: a })),

  // ---- labs, evidence, odometer
  row('lab', 'lab:drag', 0.5, 'soft detent per slider step; pitch is harmonic 8 to 24 of the hum by value', { param: 'sigma', value: 0.5 }),
  row('lab', 'lab:arb', 1.0, 'arbitrage flagged: a low double buzz', { on: true }),
  row('lab', 'lab:arb', 0.8, 'arbitrage cleared: relay release, a click and a short falling thud', { on: false }),
  row('evidence', 'evidence:flip', 0.8, 'paper flip: air riffle, then the page lands'),
  row('evidence', 'evidence:zoom', 0.8, 'lens focus: motor whirr gliding up, a click, a glass ping'),
  row('count', 'count:tick', 0.4, 'odometer tick: dry detent, tiny', undefined, -55),
  row('guitar', 'guitar:pluck', 3.2, 'one plucked steel string (A2, down-stroke): commuted-waveguide Karplus-Strong with a wooden body, a pick-position comb, two polarisations beating, a faint sympathetic ring from the open strings that share a partial, an 8 and 13 ms early-reflection pair and a small room', { string: 1, velocity: 0.7 }, -45),
  row('guitar', 'guitar:strum', 3.0, 'a down-strum low to high, the strings 8 to 28 ms apart by sweep speed with a little jitter, each about 12% softer than the last (an up-strum starts at E4)', { velocity: 0.6, dir: 1 }, -45),
  row('brain', 'brain:pulse', 0.9, 'a pulse through the glass brain: a run of tiny spikes and a grain of glass', { area: 'mind' }, -50),

  // ---- arrival signatures, one per waypoint
  sig('table', 2.0, 'card flicks across felt, then a stack of ceramic chips'),
  sig('drill', 2.0, 'eight key ticks (accelerating), a space-bar thunk, a kitchen-timer beep twice'),
  sig('alarm', 1.8, 'three muffled alarm chirps under a low-pass, a phone motor buzzing, a pillow thud'),
  sig('market', 4.0, 'a swirling pad (4:6:7:9 of the hum) with air circling the listener'),
  sig('record', 2.4, 'archive drawer rolled out and stopped, folders riffled, typewriter keys, a bell, a carriage return'),
  sig('pair', 2.2, 'a shop-door bell struck twice, then two footsteps'),
  sig('surface', 3.4, 'a heavy closing bell struck twice, then a soft ticker tape that speeds up and settles'),
  sig('cloudflare', 3.2, 'a turning globe (hum with a 2 Hz roll), packet blips circling the stereo field'),
  sig('appfolio', 2.6, 'an elevator chime, doors sliding open, a soft stop'),
  sig('school', 5.0, 'a chapel bell with real bell partials (prime, quint and nominal on 480, 720 and 960 Hz), struck high then answered a fourth lower'),
  sig('mathecon', 1.8, 'chalk on a board: long stroke, short, a curve, the tap of a full stop'),
  sig('instrument', 2.0, 'a page turned, then a brass ratchet slowing to a stop with a clink'),
  sig('meeple', 1.2, 'a wooden piece set down twice, a slide of wood between'),
  sig('records', 3.4, 'needle zip and drop, the crackle of the groove opening, a warm hum under it'),
  sig('knight', 1.4, 'a chess knight lifted, carried, put down on a wooden board'),
  sig('mind', 2.2, 'synapses firing: bursts of tiny spikes, some answered by a spark of glass'),
  sig('secretary', 1.6, 'a mail chime: two plucked notes a third apart, paper settling'),
  sig('watchdog', 2.2, 'a sonar ping with two echoes, a heartbeat under it'),
  sig('recruiting', 1.8, 'two knocks on a door, then two notes a fifth apart, rising'),
  sig('chomchom', 1.4, 'chomp, chomp, gulp'),
  sig('guitar', 2.6, 'a soft down-strum on six plucked strings, tuned to ratios of the hum'),
  sig('clouds', 4.4, 'legacy wind (the clouds)'),
  sig('name', 3.4, 'legacy power-on (the name)'),
  sig('world', 3.2, 'legacy hub settle (the establishing shot)'),
  sig('hold', 3.2, 'legacy About settle'),
  sig('epilogue', 3.2, 'legacy power-off'),
  sig('some-id-we-do-not-know', 1.4, 'any unrecognised id: quiet landing and a two-note settle'),

  // ---- transitions and objects (voices-sig.ts vTransObj: each one a wrapper over an arrival voice)
  row('trans', 'tr:doors', 1.0, 'door hinges: a stick-slip creak sliding up, then the leaves landing', { dir: 1, u: 0.16 }),
  row('trans', 'tr:portal', 1.0, 'the camera breaks through a screen: CRT static burst and detent', { dir: 1, u: 0.42 }),
  row('trans', 'tr:pages', 0.4, 'one page lifting off a stack: short air riffle over paper', { dir: 1, u: 0.3, page: 2 }),
  row('trans', 'tr:shatter', 2.0, 'a shell bursts: crack, glassy FM grain scatter, sizzle over it', { dir: 1, u: 0.34 }),
  row('trans', 'tr:mosaic', 0.6, 'first cards go over: one flick across felt and a tick', { dir: 1, u: 0.16 }),
  row('trans', 'tr:panels', 1.0, 'a panel crosses the lens: slow air whoosh', { dir: 1, u: 0.14 }),
  row('trans', 'tr:exit', 1.4, 'the hall\'s far doors let go: an iron latch click and wooden knock, a heavy 64 Hz leaf thud with a dark ring, a slow hinge creak, one knock as the leaf settles', { dir: 1, u: 0.18 }),
  row('trans', 'tr:curtain', 1.0, 'cloth lifts off the floor: soft rustle of air', { dir: 1, u: 0.18 }),
  row('obj', 'obj:roll', 0.6, 'dice tumbling on wood: six clacks, quieter each time, then a thud'),
  row('obj', 'obj:snooze', 0.3, 'soft button: a sine blip with a tick'),
  row('obj', 'obj:move', 0.6, 'chess piece set down on wood: knock, felt thud, tick at contact'),
]

/** Aliases (form ids and brief names) that must sound like their target; the check renders them too. */
export const SIG_ALIASES = ['zeta', 'pushup', 'phase', 'counties', 'dyads', 'uchicago', 'hall', 'compass', 'turntable3d', 'brain', 'qvr', 'recruiting-os']

/** Scripted gestures: a continuous event stream or a dwelling area, rendered as scenes. */
export const SCENES: CueRow[] = [
  { id: 'scene: pov drag (grab, 14 drags speed 0.1 to 0.95, release, return)', group: 'pov', secs: 3.6, min: -45, desc: 'one wind voice steered through a drag',
    script: [{ t: 0.05, cue: ['pov:grab'] }, ...stream('pov:drag', 14, 0.09, i => ({ speed: 0.1 + 0.065 * i }), 0.3), { t: 1.7, cue: ['pov:release', { speed: 0.9 }] }, { t: 2.3, cue: ['pov:return'] }] },
  { id: 'scene: tv spin (grab, 12 spin events, release)', group: 'tv', secs: 3.2, min: -45, desc: 'one creak and whoosh voice steered through a spin',
    script: [{ t: 0.05, cue: ['tv:grab', { id: 'zeta' }] }, ...stream('tv:spin', 12, 0.09, i => ({ id: 'zeta', speed: 0.15 + 0.07 * i }), 0.3), { t: 1.5, cue: ['tv:release', { id: 'zeta', speed: 0.9 }] }] },
  { id: 'scene: lab slider sweep 0 to 1 (60 events)', group: 'lab', secs: 2.0, min: -45, desc: 'a detent per slider step, silence between',
    script: stream('lab:drag', 60, 0.02, i => ({ param: 'sigma', value: i / 59 })) },
  { id: 'scene: odometer count (40 ticks, 35 ms apart)', group: 'count', secs: 2.0, min: -50, desc: 'a ratchet of ticks',
    script: stream('count:tick', 40, 0.035, () => ({})) },
  { id: 'scene: hub dial (3 detents + channels, A down and up)', group: 'hub', secs: 2.4, min: -45, desc: 'dial turned across three channels, the A button pressed and released',
    script: [0, 1, 2].flatMap(i => [{ t: 0.1 + i * 0.28, cue: ['hub:detent', { ch: i }] as [string, CueOpts] }, { t: 0.12 + i * 0.28, cue: ['hub:channel', { i }] as [string, CueOpts] }])
      .concat([{ t: 1.3, cue: ['hub:button', { which: 'A', down: true }] }, { t: 1.55, cue: ['hub:button', { which: 'A', down: false }] }]) },
  ...(['hub', 'mind', 'systems', 'research', 'work', 'education', 'about'] as const).map(a => ({
    id: `music bed: ${a} (TV on, dwelling 16 s, measured after 4 s)`, group: 'music' as const, secs: 16, min: -70, desc: `the ${a} chord as a generative pad over the drone`,
    script: [{ t: 0, flight: { speed: 0, area: a, mix: 1, wp: 3 } }],
  })),
]

/** Calibration targets per cue (key = trimKey): the cue's peak (dBFS) and/or its loudest 400 ms (LUFS-M) should land here, so the palette
 *  sits in one loudness family with the v4 cues: arrivals peak about -9 and about -21 LUFS-M, set pieces <= -16 LUFS-M, physical touches
 *  peak -9 to -17 by how often they fire, the odometer and glyphs whispering. `sfx-check.mjs --trims` turns these into the TRIM table. */
export const TARGETS: Record<string, { peak?: number; lufs?: number }> = {
  'hub:detent': { peak: -11 }, 'hub:channel': { peak: -10 }, 'hub:button:down': { peak: -8 }, 'hub:button:up': { peak: -13 },
  'hub:poweron': { lufs: -18 }, 'hub:poweroff': { lufs: -19 },
  'tv:grab': { peak: -11 }, 'tv:spin': { lufs: -27 }, 'tv:release': { peak: -11 },
  'pov:grab': { peak: -17 }, 'pov:drag': { lufs: -28 }, 'pov:release': { peak: -18 }, 'pov:return': { peak: -12 },
  'type:assemble': { peak: -12 }, 'type:shatter': { peak: -9 }, 'glyph:burst': { peak: -19 },
  'lab:drag': { peak: -17 }, 'lab:arb:on': { peak: -12 }, 'lab:arb:off': { peak: -17 }, 'evidence:flip': { peak: -14 }, 'evidence:zoom': { peak: -13 },
  'count:tick': { peak: -23 }, 'chalk:tap': { peak: -30 }, 'brain:pulse': { peak: -22 }, 'guitar:pluck': { peak: -14 }, 'guitar:strum': { peak: -12 },
  'tr:doors': { peak: -16 }, 'tr:portal': { peak: -14 }, 'tr:pages': { peak: -22 }, 'tr:shatter': { peak: -11 }, 'tr:mosaic': { peak: -16 },
  'tr:panels': { lufs: -26 }, 'tr:curtain': { lufs: -28 }, 'tr:exit': { peak: -24 }, 'obj:roll': { peak: -15 }, 'obj:snooze': { peak: -20 }, 'obj:move': { peak: -15 },
}
/** Every signature: peak about -9 and about -21 LUFS-M (whichever binds first), so a sustained bell and a wooden knock arrive equally big. */
export const SIG_TARGET = { peak: -9, lufs: -21 }
