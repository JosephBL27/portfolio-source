// Odyssey lab: the reading wheel. The project is a four-ring instrument for Homer's poem, built on the wheel first made for Ovid; this lab turns the
// ring of its 24 books under a fixed window, with the poem's opening line around the rim and the 185-episode scale inside.
// Honesty: only names the site already carries are used: the 24 books, the opening line (Ándra moi énnepe, Moûsa), Book I (A House Without Its
// Master) and Book XXI (The Bow). The other books show their number only; episode titles, the movement ring and the theme ring live in the live
// instrument and are not reproduced. The inner scale is a fixed ruler of 185 marks, not a count per book.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cue: lab:drag { param: 'book', value 0..1 } as each book passes the window.
import './lib/volvelle.css'
import './odyssey.css'
import { volvelle } from './lib/volvelle'
import type { LabHandle, LabOpts } from './lib/kit'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV']
const NAMED: Record<number, string> = { 0: 'A House Without Its Master', 20: 'The Bow' }

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  return volvelle(host, opts, {
    cls: 'oy', n: 24, labels: ROMAN, radial: true, unit: 'Book', aria: 'Book of the Odyssey',
    motto: 'ÁNDRA MOI ÉNNEPE, MOÛSA · ÁNDRA MOI ÉNNEPE, MOÛSA · ', cells: 185, centre: 'sun',
    heading: { kicker: 'Interactive model, the reading wheel', title: 'Turn to any of the 24 books', note: 'Drag the ring, fling it, or use the arrow keys. The page beside the wheel turns to the book under the window.' },
    foot: 'Book names shown are the ones the live instrument carries on this site. The inner ruler marks the poem\'s 185 episodes; each has 4 registers in the live instrument, which also holds the forty-day count, the descent charts and the figure records.',
    valueText: m => `Book ${ROMAN[m]}${NAMED[m] ? `, ${NAMED[m]}` : ''}`,
    demo: 20,
    folio: m => `<p class="vv-eyebrow">Book</p><b class="vv-big">${ROMAN[m]}</b>
      <h4 class="vv-name">${NAMED[m] ?? `Book ${m + 1} of 24`}</h4>
      <p class="vv-text">${NAMED[m] ? 'Its reading sheet opens beside the wheel in the live instrument, with a summary and a constellation plate.' : 'Turn the wheel to Book I or Book XXI to see the two sheets this page can name. Every other book is a mark on the ring here, and a full reading sheet in the live instrument.'}</p>
      <ul class="vv-chips"><li>Book ${m + 1} of 24</li><li>185 episodes across the poem</li></ul>`,
  })
}
