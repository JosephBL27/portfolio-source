// Liaozhai lab: the register dial. The project sorts 30 tales into 15 reading paths on a concentric dial; this lab turns the ring of 15 registers
// and lights the two tales that belong to each (the project's own rule: every reading path holds exactly two tales).
// Honesty: only names the site already carries are used: register 01 (Yingning), register 03 (Painted Skin) and the figures of Painted Skin (Wang,
// Wang's wife, the painted-skin demon, the Taoist priest). Every other register shows its number only; the dossiers, the relation graph and the
// story chart live in the live register and are not reproduced.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cue: lab:drag { param: 'register', value 0..1 } as each register passes the window.
import './lib/volvelle.css'
import './liaozhai.css'
import { volvelle } from './lib/volvelle'
import type { LabHandle, LabOpts } from './lib/kit'

const LABELS = Array.from({ length: 15 }, (_, k) => String(k + 1).padStart(2, '0'))
const NAMED: Record<number, string> = { 0: 'Yingning', 2: 'Painted Skin' }
const FIGURES = ['Wang', 'Wang\'s wife', 'The painted-skin demon', 'The Taoist priest']

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  return volvelle(host, opts, {
    cls: 'lz', n: 15, labels: LABELS, radial: false, unit: 'Register', aria: 'Reading path of the register',
    motto: 'STRANGE TALES FROM A CHINESE STUDIO · THE UNOFFICIAL REGISTER · ', cells: 30, centre: 'seal',
    cellsOn: m => [m * 2, m * 2 + 1],
    heading: { kicker: 'Interactive model, the register dial', title: 'Turn to any of the 15 reading paths', note: 'Drag the ring, fling it, or use the arrow keys. Each path holds two tales; the two cells on the inner ring light as it lands.' },
    foot: 'Names shown are the ones this site already carries: register 01, Yingning, and register 03, Painted Skin with its four figures. The other registers show their number only. The full register has a dossier for each tale, a relation graph and a chart of recurring places.',
    valueText: m => `Register ${LABELS[m]}${NAMED[m] ? `, ${NAMED[m]}` : ''}`,
    demo: 2,
    folio: m => `<p class="vv-eyebrow">Register</p><b class="vv-big">${LABELS[m]}</b>
      <h4 class="vv-name">${NAMED[m] ?? `Reading path ${m + 1} of 15`}</h4>
      <p class="vv-text">${m === 2 ? 'Its dossier names the figures that ring the tale, its motif and its place, and links on to related tales.' : NAMED[m] ? 'The first tale of the dial. Its dossier opens beside the wheel in the live register.' : 'Two tales sit on this path. Turn to register 01 or 03 to see the two this page can name; the rest are a mark on the ring here and a dossier in the live register.'}</p>
      ${m === 2 ? `<ul class="vv-chips">${FIGURES.map(x => `<li>${x}</li>`).join('')}</ul>` : `<ul class="vv-chips"><li>Path ${m + 1} of 15</li><li>2 of 30 tales</li></ul>`}`,
  })
}
