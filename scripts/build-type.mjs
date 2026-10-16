// Bakes the monumental 3D name (src/v3/world/extras/hero3d.ts) into public/models/type-bodoni.json.
//
//   node scripts/build-type.mjs
//
// What it does: takes the Bodoni Moda variable font the site already ships (OFL-1.1, @fontsource-variable/bodoni-moda),
// pins it to the SAME instance the particle name and the DOM twin use (wght 900, opsz 96: browsers pick opsz = font size in
// px, clamped to the axis, so a 340 px mask is opsz 96), shapes "JOSEPH" and "BLUMBERG" with HarfBuzz (so kerning matches the
// browser's), and writes only the 12 glyphs those words need as a three.js typeface JSON (the FontLoader / Font format:
// `glyphs[ch] = { ha, x_min, x_max, o: "m x y l x y q ex ey cx cy ..." }`, resolution 1000) plus a `lines` block with each
// letter's baked x origin. The runtime loads that one small file; nothing is fetched from the font at runtime.
//
// Why not opentype.js + TTFLoader: in three r186 TTFLoader imports opentype.js from a CDN (examples/jsm/libs no longer ships
// it), and neither reads WOFF2 nor applies variable-font axes. fontTools does all of that offline.
//
// Needs Python with fonttools, brotli and uharfbuzz. This is a BUILD tool, not a project dependency: run it only when the
// name or the font changes, and commit the JSON. If your python lacks them:
//   python3 -m venv /tmp/type-venv && /tmp/type-venv/bin/pip install fonttools brotli uharfbuzz
//   BUILD_TYPE_PY=/tmp/type-venv/bin/python node scripts/build-type.mjs
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'node_modules/@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-opsz-normal.woff2')
const OUT = join(root, 'public/models/type-bodoni.json')
const LINES = ['JOSEPH', 'BLUMBERG']
const AXES = { wght: 900, opsz: 96 }
const py = process.env.BUILD_TYPE_PY || 'python3'

const probe = spawnSync(py, ['-I', '-c', 'import fontTools, brotli, uharfbuzz'], { encoding: 'utf8' })
if (probe.status !== 0) {
  console.error(`[build-type] ${py} needs fonttools, brotli and uharfbuzz.\n  python3 -m venv /tmp/type-venv && /tmp/type-venv/bin/pip install fonttools brotli uharfbuzz\n  BUILD_TYPE_PY=/tmp/type-venv/bin/python node scripts/build-type.mjs\n${probe.stderr}`)
  process.exit(1)
}

const work = mkdtempSync(join(tmpdir(), 'build-type-'))
const ttf = join(work, 'bodoni-900-96.ttf')

const PY = String.raw`
import sys, json
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
import uharfbuzz as hb

woff2, ttf_out, axes_json, lines_json = sys.argv[1:5]
axes, lines = json.loads(axes_json), json.loads(lines_json)

font = TTFont(woff2)
font = instancer.instantiateVariableFont(font, axes)
font.flavor = None
font.save(ttf_out)
font = TTFont(ttf_out)
upem = font['head'].unitsPerEm
K = 1000.0 / upem                       # font units -> 1/1000 em (the typeface JSON resolution)
gs = font.getGlyphSet()
cmap = font.getBestCmap()
r2 = lambda v: round(v * K, 2)

class Rec(BasePen):
    def __init__(self, gs):
        super().__init__(gs); self.o = []
    def _moveTo(self, p): self.o.append('m %s %s' % (r2(p[0]), r2(p[1])))
    def _lineTo(self, p): self.o.append('l %s %s' % (r2(p[0]), r2(p[1])))
    # typeface.js quadratic: end point first, control point second
    def _qCurveToOne(self, c, e): self.o.append('q %s %s %s %s' % (r2(e[0]), r2(e[1]), r2(c[0]), r2(c[1])))
    def _curveToOne(self, c1, c2, e): raise SystemExit('cubic outline in a TrueType glyph: unexpected')
    def _closePath(self): pass
    def _endPath(self): pass

need = sorted(set(''.join(lines)))
glyphs = {}
for ch in need:
    name = cmap[ord(ch)]
    pen = Rec(gs); gs[name].draw(pen)
    bp = BoundsPen(gs); gs[name].draw(bp)
    x0, y0, x1, y1 = bp.bounds
    glyphs[ch] = {'ha': r2(font['hmtx'][name][0]), 'x_min': r2(x0), 'x_max': r2(x1), 'y_min': r2(y0), 'y_max': r2(y1), 'o': ' '.join(pen.o)}

blob = hb.Blob.from_file_path(ttf_out)
hbfont = hb.Font(hb.Face(blob))
out_lines = []
for text in lines:
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(hbfont, buf, {'kern': True, 'liga': False, 'calt': False})
    x, xs = 0.0, []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        xs.append(round((x + pos.x_offset) * K, 2)); x += pos.x_advance
    out_lines.append({'text': text, 'x': xs, 'advance': round(x * K, 2)})

json.dump({
    'familyName': 'Bodoni Moda', 'license': 'OFL-1.1 (c) 2020 The Bodoni Moda Project Authors', 'axes': axes,
    'resolution': 1000, 'capHeight': r2(font['OS/2'].sCapHeight), 'glyphs': glyphs, 'lines': out_lines,
    # fields three's Font.generateShapes reads (line height); the values are the font's own, in 1/1000 em
    'boundingBox': {'xMin': r2(font['head'].xMin), 'xMax': r2(font['head'].xMax), 'yMin': r2(font['head'].yMin), 'yMax': r2(font['head'].yMax)},
    'ascender': r2(font['hhea'].ascent), 'descender': r2(font['hhea'].descent),
    'underlinePosition': r2(font['post'].underlinePosition), 'underlineThickness': r2(font['post'].underlineThickness),
}, sys.stdout, separators=(',', ':'))
`

const json = execFileSync(py, ['-I', '-', SRC, ttf, JSON.stringify(AXES), JSON.stringify(LINES)], { input: PY, encoding: 'utf8', maxBuffer: 1 << 26 })
// sanity: parseable, every needed glyph present and non-empty
const data = JSON.parse(json)
for (const ch of new Set(LINES.join(''))) if (!data.glyphs[ch]?.o) throw new Error(`glyph ${ch} missing`)
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(data) + '\n')
console.log(`[build-type] ${Object.keys(data.glyphs).length} glyphs (${[...new Set(LINES.join(''))].join('')}), ${statSync(OUT).size} bytes -> ${OUT.replace(root + '/', '')}`)
for (const l of data.lines) console.log(`  ${l.text}: advance ${l.advance}  x: ${l.x.join(', ')}`)
