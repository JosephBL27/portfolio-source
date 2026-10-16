// Build-time: resolve each pick in src/data/music.json (or the file given as argv[2]) through the iTunes Search API (no key) and write
// itunesId, previewUrl and artwork back. Picks that already carry a previewUrl are kept unless --force. Needs network; run by hand after editing the picks.
//   node scripts/resolve-music.mjs [path/to/music.json] [--force]
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const force = args.includes('--force')
const file = resolve(args.find(a => !a.startsWith('--')) ?? resolve(here, '../src/data/music.json'))
const data = JSON.parse(readFileSync(file, 'utf8'))
const norm = s => String(s).toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

let ok = 0, miss = 0
for (const p of data.picks ?? []) {
  if (p.previewUrl && !force) { ok++; continue }
  const term = encodeURIComponent(`${p.title} ${p.artist}`)
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=5`)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const { results } = await res.json()
    // prefer the result whose title and artist match; the API's first hit is the fallback
    const hit = results.find(r => norm(r.trackName) === norm(p.title) && norm(r.artistName).includes(norm(p.artist).split(' ')[0])) ?? results[0]
    if (!hit?.previewUrl) { console.warn('no preview for', p.title, '-', p.artist); miss++; continue }
    p.itunesId = hit.trackId
    p.previewUrl = hit.previewUrl
    p.artwork = String(hit.artworkUrl100 ?? '').replace(/\/\d+x\d+bb\./, '/600x600bb.')
    console.log('resolved', p.title, '-', p.artist, '->', hit.trackName, '/', hit.artistName)
    ok++
  } catch (e) { console.warn('failed', p.title, e.message); miss++ }
  await new Promise(r => setTimeout(r, 400)) // the API allows ~20 calls a minute
}
writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
console.log(`${ok} ok, ${miss} unresolved -> ${file}`)
