// Re-runnable fetch + resize for the real-world imagery package. Node only (global fetch) plus ffmpeg. Never runs at page load.
//   node scripts/fetch-imagery.mjs [--force] [--no-copy]
// Downloads each source into a scratch dir (skipped when already there unless --force), resizes it with ffmpeg to its size cap,
// writes a sidecar <asset>.json (licence line quoted from the source page, source URL, credit), then copies asset + sidecar into
// public/ and rewrites src/data/credits.json from the manifest below. Nothing is ever hotlinked: the site loads only the vendored copies.
//   scratch dir: $W12_SCRATCH or <os tmp>/w12-imagery        ffmpeg: $FFMPEG or /opt/homebrew/bin/ffmpeg
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRATCH = process.env.W12_SCRATCH || join(tmpdir(), 'w12-imagery')
const FFMPEG = process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg'
const FORCE = process.argv.includes('--force'), NOCOPY = process.argv.includes('--no-copy')
const RAW = join(SCRATCH, 'raw'), OUT = join(SCRATCH, 'out')
mkdirSync(RAW, { recursive: true }); mkdirSync(OUT, { recursive: true })
const RETRIEVED = '2026-10-09'

const NASA_LICENCE = 'NASA content – images, audio, video, and media files used in the rendition of 3-dimensional models, such as texture maps and polygon data in any format – generally are not subject to copyright in the United States. … NASA should be acknowledged as the source of the material.'
const NASA_LICENCE_URL = 'https://www.nasa.gov/nasa-brand-center/images-and-media/'
const SVS_LICENCE = 'All of our content is in the public domain (unless otherwise noted), meaning that it is free to download, use, and redistribute for whatever purposes you see fit.'
const LOC_LICENCE = 'The content of the Library of Congress Geography and Map Division digitized collections is free to use and reuse unless a Rights Advisory statement is present that indicates otherwise. Credit Line: Library of Congress, Geography and Map Division.'
const NE_LICENCE = 'All versions of Natural Earth raster + vector map data found on this website are in the public domain. You may use the maps in any manner, including modifying the content and design, electronic dissemination, and offset printing.'

// ---- manifest -------------------------------------------------------------------------------------------------------------------------------
// Each asset: download(s) -> build() -> file in OUT -> public/<dest>. `credit` is the credits.json entry (the chrome package renders the list).
const ASSETS = [
  {
    file: 'blue-marble-1024.jpg', dest: 'public/media/geo', cap: 250 * 1024,
    download: [['bm.jpg', 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg']],
    build: (q, out) => ['-i', join(RAW, 'bm.jpg'), '-vf', 'scale=1024:512:flags=area', '-q:v', String(q), out],
    sidecar: { source: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/', file: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg', licence: NASA_LICENCE, licenceUrl: NASA_LICENCE_URL, credit: 'NASA Earth Observatory image by Reto Stöckli (Blue Marble: Next Generation, topography and bathymetry, December 2004)', processing: 'Downsampled from 5400x2700 to 1024x512 JPEG; used to colour the land and ocean particles of the Cloudflare globe.' },
    credit: { id: 'blue-marble', what: 'Land and ocean colour on the Cloudflare globe', title: 'Blue Marble: Next Generation, topography and bathymetry (December 2004)', source: 'NASA Earth Observatory', author: 'Reto Stöckli, NASA Earth Observatory', licence: 'NASA media usage guidelines: generally not subject to copyright in the United States; NASA acknowledged as the source', url: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/' },
  },
  {
    file: 'black-marble-2048.jpg', dest: 'public/media/geo', cap: 350 * 1024,
    download: [['night.jpg', 'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg']],
    build: (q, out) => ['-i', join(RAW, 'night.jpg'), '-vf', 'scale=2048:1024:flags=area', '-q:v', String(q), out],
    sidecar: { source: 'https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/', file: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg', licence: NASA_LICENCE, licenceUrl: NASA_LICENCE_URL, credit: 'NASA Earth Observatory image by Joshua Stevens, using Suomi NPP VIIRS data from Miguel Román, NASA GSFC (Black Marble 2016)', processing: 'Downsampled from 3600x1800 to 2048x1024 JPEG; luminance drives the sampling of the night-light particles on the Cloudflare globe.' },
    credit: { id: 'black-marble', what: 'City lights on the night side of the Cloudflare globe', title: 'Black Marble 2016, color maps (Earth at Night)', source: 'NASA Earth Observatory', author: 'Joshua Stevens; Suomi NPP VIIRS data from Miguel Román, NASA GSFC', licence: 'NASA media usage guidelines: generally not subject to copyright in the United States; NASA acknowledged as the source', url: 'https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/' },
  },
  {
    file: 'us-population-density-1940.jpg', dest: 'public/media/wwii/archive', cap: 400 * 1024,
    // LOC item 2011593047 (U.S. Census Bureau map, GPO 1942). IIIF 12.5% rendition = 3038x1878. The title block, legend and scale bar are painted out (delogo)
    // and the sheet is cropped to the country; both are cosmetic (the map is only a faint plate under the county bars).
    download: [['pop-full.jpg', 'https://tile.loc.gov/image-services/iiif/service:gmd:gmd370:g3701:g3701e:ct003336/full/pct:12.5/0/default.jpg']],
    build: (q, out) => ['-i', join(RAW, 'pop-full.jpg'), '-vf', 'delogo=x=2580:y=1300:w=440:h=330,delogo=x=120:y=1400:w=320:h=320,delogo=x=1700:y=1660:w=430:h=110,crop=2825:1744:91:55,scale=1600:-1:flags=lanczos', '-q:v', String(q), out],
    sidecar: { source: 'https://www.loc.gov/item/2011593047/', file: 'https://tile.loc.gov/image-services/iiif/service:gmd:gmd370:g3701:g3701e:ct003336/full/pct:12.5/0/default.jpg', licence: LOC_LICENCE, licenceUrl: 'https://www.loc.gov/legal/', credit: 'Library of Congress, Geography and Map Division. U.S. Department of Commerce, Bureau of the Census; Washington, D.C.: U.S. Government Printing Office, 1942.', processing: 'Cropped to the country, title block / legend / scale bar painted out, downsampled to 1600 px wide. LOC item rights field read on 2026-10-09: no Rights Advisory statement present.' },
    credit: { id: 'wwii-archive-map', what: 'The faint archival plate under the county bars on the WWII stop', title: 'United States population density map by minor civil divisions: 1940', source: 'Library of Congress, Geography and Map Division', author: 'U.S. Department of Commerce, Bureau of the Census (U.S. Government Printing Office, 1942)', licence: 'Free to use and reuse (Library of Congress; no Rights Advisory statement)', url: 'https://www.loc.gov/item/2011593047/' },
  },
  {
    file: 'milkyway-2048.jpg', dest: 'public/media/sky', cap: 450 * 1024,
    // the 4k OpenEXR is linear half-float: scale to 2048x1024 in float, then a gamma-2.2 curve with gain 0.7 (mean level matches NASA's own print JPEG)
    download: [['mw4k.exr', 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/milkyway_2020_4k.exr']],
    pre: () => { const lin = join(RAW, 'mw-lin.png'); if (FORCE || !existsSync(lin)) execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', join(RAW, 'mw4k.exr'), '-vf', 'scale=2048:1024:flags=area,format=gbrpf32le', '-frames:v', '1', '-f', 'image2', '-c:v', 'png', '-pix_fmt', 'rgb48be', lin]) },
    build: (q, out) => { const c = "clip(pow(val/maxval*0.7\\,0.4545)*maxval\\,0\\,maxval)"; return ['-i', join(RAW, 'mw-lin.png'), '-vf', `lutrgb=r='${c}':g='${c}':b='${c}',format=yuvj420p`, '-q:v', String(q), out] },
    sidecar: { source: 'https://svs.gsfc.nasa.gov/4851/', file: 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/milkyway_2020_4k.exr', licence: SVS_LICENCE, licenceUrl: 'https://svs.gsfc.nasa.gov/help/', credit: 'NASA/Goddard Space Flight Center Scientific Visualization Studio. Gaia DR2: ESA/Gaia/DPAC. Animator Ernie Wright (USRA). Gaia terms: "The Gaia data are open and free to use, provided credit is given to ESA/Gaia/DPAC."', processing: 'Deep Star Maps 2020, milkyway_2020_4k.exr (celestial coordinates), scaled to 2048x1024 and tone-mapped to sRGB JPEG.' },
    credit: { id: 'milky-way', what: 'The night sky behind the contact finale', title: 'Deep Star Maps 2020 (Milky Way, 4k)', source: 'NASA Scientific Visualization Studio', author: 'NASA/GSFC Scientific Visualization Studio; Gaia DR2: ESA/Gaia/DPAC', licence: 'Public domain (NASA SVS); Gaia data credit ESA/Gaia/DPAC', url: 'https://svs.gsfc.nasa.gov/4851/' },
  },
]
// Already vendored earlier (rasterised once from Natural Earth 110m land); no download here, only its sidecar + credit.
const LAND = {
  file: 'land-110m-1024x512.png', dest: 'public/media/geo',
  sidecar: { source: 'https://www.naturalearthdata.com/about/terms-of-use/', file: 'https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/', licence: NE_LICENCE, licenceUrl: 'https://www.naturalearthdata.com/about/terms-of-use/', credit: 'Natural Earth (Tom Patterson, Nathaniel Vaughn Kelso and contributors)', processing: 'Natural Earth 110m land rasterised to a 1024x512 equirectangular mask (white = land).' },
  credit: { id: 'natural-earth-land', what: 'Continent outlines on the Cloudflare globe (land mask)', title: 'Natural Earth 110m land', source: 'Natural Earth', author: 'Tom Patterson, Nathaniel Vaughn Kelso and contributors', licence: 'Public domain', url: 'https://www.naturalearthdata.com/about/terms-of-use/' },
}
// For the crag package's Yosemite backdrop, verbatim from the brief (the crag package may correct them).
const TERRAIN = [
  { id: 'terrain-dem', what: 'The mountains behind the climbing wall (Yosemite Valley elevation)', title: 'Terrain Tiles (Terrarium)', source: 'AWS Open Data', author: 'Mapzen; sources include USGS 3DEP', licence: 'Open data, attribution required', url: 'https://registry.opendata.aws/terrain-tiles/', retrieved: '2026-10-09' },
  { id: 'terrain-imagery', what: 'Aerial imagery on the Yosemite backdrop', title: 'USGS The National Map orthoimagery', source: 'The National Map', author: 'U.S. Geological Survey', licence: 'Public domain (U.S. Government work)', url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer', retrieved: '2026-10-09' },
]

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
const kb = n => `${(n / 1024).toFixed(0)} KB`
async function download(name, url) {
  const dest = join(RAW, name)
  if (!FORCE && existsSync(dest) && statSync(dest).size > 1000) return
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (portfolio imagery fetch)' } })
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer())); console.log(`  fetched ${name} ${kb(statSync(dest).size)}`)
}
function encode(a) {
  a.pre?.()
  const out = join(OUT, a.file)
  // best quality that fits the cap (ffmpeg mjpeg qscale 2 = best ... 31 = worst)
  for (let q = 2; q <= 24; q++) {
    sh(FFMPEG, ['-v', 'error', '-y', ...a.build(q, out)])
    if (statSync(out).size <= a.cap) { console.log(`  ${a.file}: q=${q}, ${kb(statSync(out).size)} (cap ${kb(a.cap)})`); return out }
  }
  throw new Error(`${a.file} cannot fit ${kb(a.cap)}`)
}
function sidecar(a, path) {
  const sc = { id: a.credit.id, asset: a.file, title: a.credit.title, ...a.sidecar, licenceLine: a.sidecar.licence, retrieved: RETRIEVED, bytes: statSync(path).size }
  delete sc.licence
  const p = path + '.json'; writeFileSync(p, JSON.stringify(sc, null, 2) + '\n'); return p
}
function put(file, dest) { const d = join(ROOT, dest); mkdirSync(d, { recursive: true }); copyFileSync(file, join(d, basename(file))) }

const credits = []
for (const a of ASSETS) {
  console.log(a.file)
  for (const [n, u] of a.download) await download(n, u)
  const out = encode(a), sc = sidecar(a, out)
  if (!NOCOPY) { put(out, a.dest); put(sc, a.dest) }
  credits.push({ ...a.credit, retrieved: RETRIEVED })
}
{ // the existing mask: sidecar only (the PNG is already in public/)
  if (!NOCOPY) sidecar(LAND, join(ROOT, LAND.dest, LAND.file))
  credits.unshift({ ...LAND.credit, retrieved: RETRIEVED })
}
credits.push(...TERRAIN)
if (!NOCOPY) { writeFileSync(join(ROOT, 'src/data/credits.json'), JSON.stringify(credits, null, 2) + '\n'); console.log(`credits.json: ${credits.length} entries`) }
