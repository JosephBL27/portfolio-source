// v3 "Metamorphoses": the site is one particle world that changes form chapter by chapter.
// Copy marked NEW is written for the mock and needs Joseph's approval; everything else is
// vetted (src/data/*.json). Numbers must exist in src/data (scripts/proofread.mjs).
export interface Beat { form: string; lines?: string[] }
export interface Chapter {
  id: string
  numeral: string                 // w12: the numeral of the AREA this chapter sits in (Work I, Systems II, Research III, Second Brain IV, Education V, About VI); empty outside the six areas
  kicker: string                  // small mono label
  title: string                   // huge serif title
  beats: Beat[]                   // forms shown in order while this chapter is on screen
  body?: string                   // one paragraph
  figure?: { value: string; label: string } // the chapter's key figure
  projects?: string[]             // project ids that "Open the work" leads to (case view)
  accent: string                  // accent colour
  scroll: number                  // height in viewport units
}

// w12: listed in flight order (Work, Systems, Research, Second Brain, Education, About); the overlay copy reads each chapter by id, so the order is for the reader of this file.
export const CHAPTERS: Chapter[] = [
  {
    id: 'prologue', numeral: '', kicker: 'Ovid, Metamorphoses 1.1', accent: '#EDE6D6', scroll: 220,
    title: 'In nova fert animus mutatas dicere formas corpora.',
    body: 'My mind leads me to tell of forms changed into new bodies.',
    beats: [{ form: 'fog' }, { form: 'name' }],
  },
  {
    id: 'surface', numeral: 'I', kicker: 'QVR Advisors', title: 'The Surface', accent: '#B48CFF', scroll: 200,
    body: 'Quantitative research internship, June to December 2025: how mechanical ETF rebalancing distorts short-term volatility pricing, and models of the implied volatility surface.',
    beats: [{ form: 'surface' }], projects: ['qvr'],
  },
  {
    id: 'alarm', numeral: 'II', kicker: 'SELFORGE', title: 'The Alarm', accent: '#FF4A2B', scroll: 200,
    body: 'An iPhone alarm that keeps ringing until the camera has counted my pushups.',
    figure: { value: '66,636', label: 'lines of Swift' },
    beats: [{ form: 'pushup' }], projects: ['selforge'],
  },
  {
    id: 'drill', numeral: 'II', kicker: 'ZETA', title: 'The Drill', accent: '#F2B441', scroll: 180,
    body: 'A Chrome extension and a dashboard for Zetamac, the 120-second arithmetic drill used in trading-interview prep.',
    figure: { value: '80', label: 'best strict score, from 30' },
    beats: [{ form: 'zeta' }], projects: ['zeta'],
  },
  {
    id: 'table', numeral: 'II', kicker: 'Table Model · Hand Compass', title: 'The Table', accent: '#3FBF8A', scroll: 220,
    body: 'Table Model reads a live poker table hand by hand and prices every action. Hand Compass deals a spot, hides the answer until I commit, then grades the choice.',
    figure: { value: '2.0 ms', label: 'per decision' },
    beats: [{ form: 'table' }], projects: ['table-model', 'hand-compass'],
  },
  {
    id: 'market', numeral: 'III', kicker: 'Love Island Dynamics', title: 'The Market', accent: '#FF6A8A', scroll: 200,
    body: 'Each couple modelled as a pair of coupled differential equations, plus a voting public.',
    figure: { value: 'about $4,000', label: 'earned trading on Kalshi' },
    beats: [{ form: 'phase' }], projects: ['love-island'],
  },
  {
    id: 'record', numeral: 'III', kicker: 'Unequal Mobilization', title: 'The Record', accent: '#E8D5A8', scroll: 200,
    body: 'Did the American counties that gave the most men in World War II receive the most federal war investment?',
    figure: { value: '0.69', label: 'tracked industry, not war deaths' },
    beats: [{ form: 'counties' }], projects: ['wwii'],
  },
  {
    id: 'pair', numeral: 'III', kicker: 'Behavioral thrift research', title: 'The Pair', accent: '#7FD1C7', scroll: 180,
    body: 'Shopping together or searching separately? A field-experiment design for shoppers who arrive at thrift stores in pairs.',
    beats: [{ form: 'dyads' }], projects: ['thrift'],
  },
  {
    id: 'mind', numeral: 'IV', kicker: 'Second Brain', title: 'The Mind', accent: '#8FB8FF', scroll: 260,
    body: 'Everything I build runs through one Obsidian brain: my agents read it first and commit what they learn back to it.',
    figure: { value: '478', label: 'notes and 1,887 links in the vault graph, 4 Oct 2026' },
    beats: [{ form: 'brain', lines: ['Each point is a note. Each thread is a link.', 'Ten folders, one memory.', 'Three agents boot from it and write back.'] }],
    projects: ['second-brain'],
  },
  {
    id: 'instrument', numeral: 'V', kicker: 'Metamorphoses: A Living Chronology', title: 'The Instrument', accent: '#D9A441', scroll: 220,
    body: 'A compass of four rings: Ovid’s mythic eras, his 15 books, the episodes of the book you are reading, and its themes.',
    figure: { value: '120', label: 'episodes on one turning compass' },
    beats: [{ form: 'compass' }], projects: ['metamorphoses'],
  },
  {
    id: 'offboard', numeral: 'VI', kicker: 'Off the board', title: 'Off the Board', accent: '#EDE6D6', scroll: 260,
    body: 'Off the board: bouldering (V8 at my peak), 80+ board games, 400+ records and CDs, 1750 on Chess.com.',
    beats: [
      { form: 'hold', lines: ['V8', 'at my peak'] },
      { form: 'meeple', lines: ['80+', 'board games'] },
      { form: 'record', lines: ['400+', 'records and CDs'] },
      { form: 'knight', lines: ['1750', 'on Chess.com'] },
    ],
  },
  {
    id: 'epilogue', numeral: '', kicker: 'Contact', accent: '#FF4A2B', scroll: 200,
    title: 'Tell me what you are building.',
    body: 'Internships, research, a hard problem. A short note is plenty.',
    beats: [{ form: 'epilogue' }],
  },
]
