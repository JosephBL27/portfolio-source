// Render every page of the four public PDFs into numbered WebP pages for the case view's page-flip book.
// usage: node scripts/render-books.mjs        (needs ghostscript `gs` and `cwebp` on PATH; no network)
// writes public/media/<id>/book/p-NN.webp and src/ui/books.json (page count, size, source PDF per project).
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const BOOKS = [
  { id: 'wwii', pdf: 'docs/unequal-mobilization-wwii-paper.pdf' },
  { id: 'love-island', pdf: 'docs/romantic-dynamics-love-island-paper.pdf' },
  { id: 'cloudflare', pdf: 'docs/cloudflare-net-stock-pitch.pdf' },
  { id: 'appfolio', pdf: 'docs/appfolio-appf-the-second-act.pdf' },
]
const out = {}
for (const b of BOOKS) {
  const pdf = join(root, 'public', b.pdf)
  if (!existsSync(pdf)) { console.warn('missing', pdf); continue }
  const dir = join(root, 'public/media', b.id, 'book')
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  const tmp = join(dir, '_png'); mkdirSync(tmp)
  execFileSync('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=png16m', '-r100', '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4',
    `-sOutputFile=${join(tmp, 'p-%02d.png')}`, pdf], { stdio: 'inherit' })
  const pngs = readdirSync(tmp).filter(f => f.endsWith('.png')).sort()
  let bytes = 0, w = 0, h = 0
  for (const f of pngs) {
    const dst = join(dir, f.replace('.png', '.webp'))
    execFileSync('cwebp', ['-quiet', '-q', '72', '-m', '6', '-sharp_yuv', join(tmp, f), '-o', dst])
    bytes += statSync(dst).size
    if (!w) { const s = execFileSync('webpinfo', [dst]).toString(); const m = s.match(/Width: (\d+)[\s\S]*?Height: (\d+)/); if (m) { w = +m[1]; h = +m[2] } }
  }
  rmSync(tmp, { recursive: true, force: true })
  out[b.id] = { pdf: b.pdf, pages: pngs.length, width: w, height: h, dir: `media/${b.id}/book`, prefix: 'p-', ext: 'webp' }
  console.log(b.id, pngs.length, 'pages', w + 'x' + h, (bytes / 1e6).toFixed(2) + ' MB')
}
writeFileSync(join(root, 'src/ui/books.json'), JSON.stringify(out, null, 1) + '\n')
console.log('wrote src/ui/books.json')
