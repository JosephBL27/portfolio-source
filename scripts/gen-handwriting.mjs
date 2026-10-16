// Single-stroke handwriting glyphs for the Education chalkboard (wave 24 r6; the r5 board used EMS Elfin).
// Source: EMS Tech (Sheldon B. Michaels / Windell H. Oskay, SIL Open Font License; a derivative of "Architects Daughter" by Kimberly Geswein),
// the single-line SVG font from the Evil Mad Scientist Hershey Text set, fetched from github.com/techninja/hersheytextjs (MIT) and vendored at
// scripts/data/ems-tech.svg. A hand-lettered print with a tall x-height: it stays legible in chalk at phone size, where Elfin's small 'o' and 'n' blurred. Only the characters src/data/coursework.json needs are kept, and the cubic segments are flattened to polylines.
//   node scripts/gen-handwriting.mjs   ->   src/data/handwriting-tech.json  { font, upm, xHeight, capHeight, glyphs: { ch: { adv, strokes: [[x,y,x,y,...], ...] } } }
// y is up (baseline 0), in font units (1000 per em). The stage (src/v3/world/extras/stages/chalkboard/hand.ts) turns it into chalk strokes.
import { readFileSync, writeFileSync } from 'node:fs'
const root = new URL('../', import.meta.url)
const svg = readFileSync(new URL('scripts/data/ems-tech.svg', root), 'utf8')
const cw = JSON.parse(readFileSync(new URL('src/data/coursework.json', root), 'utf8'))
const need = new Set(' +')
const walk = v => { if (typeof v === 'string') { for (const c of v) need.add(c) } else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!k.startsWith('_') && k !== 'source' && k !== 'id') walk(x) }
walk(cw); for (const c of 'PQSD()fx;,') need.add(c)     // the sketches' labels (supply and demand, the normal density) and the joins of the program line
const dec = s => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'")
const R = n => Math.round(n * 10) / 10
function parse(d) {
  const t = d.match(/[MLCZmlcz]|-?\d*\.?\d+(?:e-?\d+)?/g) || []
  const out = []; let cur = null, i = 0, cmd = '', px = 0, py = 0
  const num = () => +t[i++]
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++]
    if (cmd === 'M') { if (cur && cur.length > 2) out.push(cur); px = num(); py = num(); cur = [R(px), R(py)] }
    else if (cmd === 'L') { px = num(); py = num(); cur.push(R(px), R(py)) }
    else if (cmd === 'C') {
      const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num()
      for (let k = 1; k <= 7; k++) { const s = k / 7, u = 1 - s; cur.push(R(u ** 3 * px + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s ** 3 * x), R(u ** 3 * py + 3 * u * u * s * y1 + 3 * u * s * s * y2 + s ** 3 * y)) }
      px = x; py = y
    } else if (cmd === 'Z' || cmd === 'z') { if (cur) cur.push(cur[0], cur[1]) } else i++
  }
  if (cur && cur.length > 2) out.push(cur)
  return out
}
const glyphs = {}
for (const m of svg.matchAll(/<glyph\s+([^>]*?)\/>/g)) {
  const a = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x => [x[1], x[2]]))
  if (a.unicode === undefined) continue
  const ch = dec(a.unicode)
  if (!need.has(ch)) continue
  const adv = +(a['horiz-adv-x'] ?? 400)
  // guard against stray subpaths (EMS Elfin's ';' carried a copy of its dot at x = 4006): drop any subpath that sits wholly outside the glyph's box
  const strokes = parse(a.d ?? '').filter(st => { const xs = st.filter((_, i) => i % 2 === 0); return Math.min(...xs) < adv * 2 && Math.max(...xs) > -adv })
  glyphs[ch] = { adv, strokes }
}
// Hand-drawn replacements for two glyphs that do not survive chalk at the size the board is read at (a 100% crop of "Calculus I–III" showed the numerals
// fusing into a bar and the en dash reading as a hyphen). Same stroke style as the font: a few points, slightly off-true.
//   I   a capital with serifs (three strokes: the bar, a top serif, a foot), advance 420, so a run of them reads as separate numerals and not as '!' or '|'
//   –   an en dash about half an em long (the font's is 0.3 em, a hyphen with a longer tail), with room on both sides
const OVERRIDE = {
  'I': { adv: 420, strokes: [[205, 666, 203, 520, 201, 340, 203, 180, 204, 24], [122, 662, 205, 672, 288, 666], [118, 26, 204, 17, 290, 23]] },
  '–': { adv: 600, strokes: [[80, 243, 210, 252, 340, 258, 470, 262, 530, 262]] },
}
for (const [ch, g] of Object.entries(OVERRIDE)) if (need.has(ch)) glyphs[ch] = g
const missing = [...need].filter(c => !glyphs[c])
if (missing.length) { console.error('missing glyphs:', JSON.stringify(missing)); process.exit(1) }
const out = { font: 'EMS Tech', licence: 'SIL Open Font License 1.1', upm: 1000, xHeight: 450, capHeight: 680, glyphs }
writeFileSync(new URL('src/data/handwriting-tech.json', root), JSON.stringify(out))
console.log('glyphs', Object.keys(glyphs).length, 'chars', [...need].sort().join(''), 'bytes', JSON.stringify(out).length)
