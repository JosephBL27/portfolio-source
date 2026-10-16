#!/usr/bin/env node
// Build the Yosemite Valley backdrop of the climbing-wall space (w12 "crag"):  node scripts/build-terrain.mjs [scratchDir]
// BUILD-time only: the site never requests these services. Downloads into the scratch directory, then writes four files into public/terrain/:
//   yosemite-height.png  terrarium-encoded elevation (height_m = R*256 + G + B/256 - 32768), equirectangular, north up, B = 0 (1 m steps)
//   yosemite-color.jpg   USGS orthophoto, same box, north up
//   yosemite-shade.png   R = sun visibility (soft ray-marched shadow for the dusk sun), G = sky ambient occlusion (horizon-based). B unused (0)
//   yosemite.json        bounds, metres, tile lists, sun, retrieval date and the two source credits
// Sources (both open): AWS Terrain Tiles (Terrarium; Mapzen / AWS Open Data; sources include USGS 3DEP) and USGS The National Map orthoimagery (public domain).
// Decode and encode with ffmpeg (rawvideo rgb24) and plain Node, no npm packages.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(HERE, '../public/terrain')
const SCRATCH = path.resolve(process.argv[2] ?? '/private/tmp/claude-501/w12-crag/terrain-build')
const BOX = { lon0: -119.72, lon1: -119.5, lat0: 37.69, lat1: 37.78 }
const Z_H = 13, Z_C = 15                                    // elevation tiles z13 (~15 m/px here), orthophoto z15 (~3.8 m/px) downsampled
const W = 768, COLOR_W = 2560                               // output widths (heights / shade, colour); heights follow from the box so a pixel is square on the ground
const TUNNEL_VIEW = { lat: 37.7156, lon: -119.677, elev_m: 1340 }
const SUN = { azimuthDeg: 262, elevationDeg: 3 }            // the sun two minutes from setting on the day this was built (9 Oct: sunset azimuth 262 deg at 37.7 N), behind and a little right of the viewer: it lights El Capitan's south-west face and Half Dome's north-west face about equally
// The camera stands over the valley floor, 2.2 km up-valley of Tunnel View, looking east-north-east: El Capitan (left) and Half Dome (right of centre) stand clear of the climbing wall
// that fills the middle of the frame (from Tunnel View itself the two are only 16 degrees apart and the wall hides one of them), the valley opens between them down to the floor,
// and the south wall (Cathedral Rocks, Sentinel Dome) rises on the right.
const VIEW = { lat: 37.7195, lon: -119.655, bearingDeg: 62 }
const CHECKS = [
  { name: 'El Capitan summit', lat: 37.734, lon: -119.6377, lo: 2200, hi: 2400 },
  { name: 'Half Dome', lat: 37.7459, lon: -119.5332, lo: 2600, hi: 2750 },
  { name: 'El Cap Meadow', lat: 37.7243, lon: -119.6393, lo: 1150, hi: 1300 },
]
const CAPS = { height: 600e3, color: 900e3, shade: 300e3 }
const CREDITS = {
  elevation: 'Elevation: AWS Terrain Tiles (Terrarium), Mapzen / AWS Open Data; sources include USGS 3DEP',
  elevationUrls: ['https://registry.opendata.aws/terrain-tiles/', 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md'],
  imagery: 'Imagery: USGS The National Map orthoimagery, U.S. Geological Survey, public domain',
  imageryUrl: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer',
  // checked at the sources on the retrieval date
  verified: [
    'registry.opendata.aws/terrain-tiles: license = tilezen/joerd docs/attribution.md; managed by Mapzen, a Linux Foundation project',
    'attribution.md: "United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey"; 3DEP products are public domain, credit requested ("3DEP data courtesy of the U.S. Geological Survey")',
    'USGSImageryOnly MapServer copyrightText: "USDA, USGS The National Map: Orthoimagery. Data refreshed June, 2024.v1.2" (the USDA is co-credited: the California imagery includes USDA NAIP, a U.S. Government work)',
  ],
}

const rad = d => (d * Math.PI) / 180
const wx = (lon, z) => ((lon + 180) / 360) * 256 * 2 ** z
const wy = (lat, z) => (0.5 - Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2)) / (2 * Math.PI)) * 256 * 2 ** z
const mLat = lat => 111132.954 - 559.822 * Math.cos(rad(2 * lat)) + 1.175 * Math.cos(rad(4 * lat))
const mLon = lat => 111412.84 * Math.cos(rad(lat)) - 93.5 * Math.cos(rad(3 * lat)) + 0.118 * Math.cos(rad(5 * lat))
const latMid = (BOX.lat0 + BOX.lat1) / 2
const widthM = (BOX.lon1 - BOX.lon0) * mLon(latMid), heightM = (BOX.lat1 - BOX.lat0) * mLat(latMid)
const H = Math.round((W * heightM) / widthM), COLOR_H = Math.round((COLOR_W * heightM) / widthM)

fs.mkdirSync(SCRATCH, { recursive: true }); fs.mkdirSync(OUT, { recursive: true })
const log = (...a) => console.log(...a)

// ---------------------------------------------------------------------------------------------------- download + decode
async function fetchTo(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 100) return
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return
    } catch (e) { if (a === 4) throw new Error(`${url}: ${e.message}`); await new Promise(r => setTimeout(r, 400 * (a + 1))) }
  }
}
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k) } })) }
function decode(file) { return execFileSync(FFMPEG, ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 24 }) }
function encode(rgb, w, h, file, extra) {                       // raw frame through a scratch file (a pipe truncates a frame this large)
  const raw = path.join(SCRATCH, 'frame.rgb'); fs.writeFileSync(raw, rgb)
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', raw, '-frames:v', '1', ...extra, file])
}

/** tiles covering the box, mosaicked into one rgb24 buffer. Returns the mosaic and the world-pixel origin. */
async function mosaic(label, z, urlOf, ext) {
  const tx0 = Math.floor(wx(BOX.lon0, z) / 256), tx1 = Math.floor(wx(BOX.lon1, z) / 256)
  const ty0 = Math.floor(wy(BOX.lat1, z) / 256), ty1 = Math.floor(wy(BOX.lat0, z) / 256)
  const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1, tiles = []
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) tiles.push({ x, y })
  const dir = path.join(SCRATCH, label); fs.mkdirSync(dir, { recursive: true })
  const t0 = Date.now()
  await pool(tiles, 8, t => fetchTo(urlOf(z, t.x, t.y), path.join(dir, `${z}_${t.x}_${t.y}.${ext}`)))
  const mw = nx * 256, buf = Buffer.alloc(mw * ny * 256 * 3)
  for (const t of tiles) {
    const raw = decode(path.join(dir, `${z}_${t.x}_${t.y}.${ext}`))
    if (raw.length !== 256 * 256 * 3) throw new Error(`tile ${z}/${t.x}/${t.y} decoded to ${raw.length} bytes`)
    for (let r = 0; r < 256; r++) raw.copy(buf, ((t.y - ty0) * 256 + r) * mw * 3 + (t.x - tx0) * 256 * 3, r * 256 * 3, (r + 1) * 256 * 3)
  }
  log(`${label}: z${z} tiles x ${tx0}..${tx1}, y ${ty0}..${ty1} (${tiles.length}) in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  return { buf, mw, mh: ny * 256, ox: tx0 * 256, oy: ty0 * 256, z, tx0, tx1, ty0, ty1, count: tiles.length }
}

const hm = await mosaic('terrarium', Z_H, (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`, 'png')
const cm = await mosaic('usgs-imagery', Z_C, (z, x, y) => `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/${z}/${y}/${x}`, 'jpg')

// ---------------------------------------------------------------------------------------------------- resample to the equirectangular output grid
const lonAt = (i, w) => BOX.lon0 + ((i + 0.5) / w) * (BOX.lon1 - BOX.lon0)
const latAt = (j, h) => BOX.lat1 - ((j + 0.5) / h) * (BOX.lat1 - BOX.lat0)
function sampleHeight(m, px, py) {                         // bilinear elevation (m) at mosaic pixel centre coordinates
  px -= 0.5; py -= 0.5
  const x0 = Math.max(0, Math.min(m.mw - 2, Math.floor(px))), y0 = Math.max(0, Math.min(m.mh - 2, Math.floor(py))), fx = Math.min(1, Math.max(0, px - x0)), fy = Math.min(1, Math.max(0, py - y0))
  const at = (x, y) => { const k = (y * m.mw + x) * 3; return m.buf[k] * 256 + m.buf[k + 1] + m.buf[k + 2] / 256 - 32768 }
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy
}
const elev = new Float32Array(W * H)
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  // 2 x 2 supersample: the output is a little coarser than the source
  let s = 0
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    const lon = BOX.lon0 + ((i + 0.25 + 0.5 * a) / W) * (BOX.lon1 - BOX.lon0), lat = BOX.lat1 - ((j + 0.25 + 0.5 * b) / H) * (BOX.lat1 - BOX.lat0)
    s += sampleHeight(hm, wx(lon, Z_H) - hm.ox, wy(lat, Z_H) - hm.oy)
  }
  elev[j * W + i] = Math.round(s / 4)
}
let emin = 1e9, emax = -1e9
for (const v of elev) { if (v < emin) emin = v; if (v > emax) emax = v }

const heightRgb = Buffer.alloc(W * H * 3)
for (let k = 0; k < W * H; k++) { const v = elev[k] + 32768; heightRgb[k * 3] = Math.floor(v / 256); heightRgb[k * 3 + 1] = Math.floor(v) % 256; heightRgb[k * 3 + 2] = 0 }

const colorRgb = Buffer.alloc(COLOR_W * COLOR_H * 3)
for (let j = 0; j < COLOR_H; j++) for (let i = 0; i < COLOR_W; i++) {
  let r = 0, g = 0, b = 0
  for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
    const lon = BOX.lon0 + ((i + 0.25 + 0.5 * a) / COLOR_W) * (BOX.lon1 - BOX.lon0), lat = BOX.lat1 - ((j + 0.25 + 0.5 * c) / COLOR_H) * (BOX.lat1 - BOX.lat0)
    const px = Math.min(cm.mw - 2, Math.max(0, wx(lon, Z_C) - cm.ox - 0.5)), py = Math.min(cm.mh - 2, Math.max(0, wy(lat, Z_C) - cm.oy - 0.5))
    const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0
    for (let ch = 0; ch < 3; ch++) {
      const at = (x, y) => cm.buf[(y * cm.mw + x) * 3 + ch]
      const v = (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy
      if (ch === 0) r += v; else if (ch === 1) g += v; else b += v
    }
  }
  const k = (j * COLOR_W + i) * 3; colorRgb[k] = Math.round(r / 4); colorRgb[k + 1] = Math.round(g / 4); colorRgb[k + 2] = Math.round(b / 4)
}

// ---------------------------------------------------------------------------------------------------- shade: sun shadow x sky occlusion, ray-marched over the height field
const dx = widthM / W, dy = heightM / H                       // metres per output pixel (east, north)
const hAt = (x, y) => {                                        // bilinear height in pixel coordinates (outside the map: the nearest edge)
  x = Math.min(W - 1.001, Math.max(0, x)); y = Math.min(H - 1.001, Math.max(0, y))
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, k = y0 * W + x0
  return (elev[k] * (1 - fx) + elev[k + 1] * fx) * (1 - fy) + (elev[k + W] * (1 - fx) + elev[k + W + 1] * fx) * fy
}
const sunAz = rad(SUN.azimuthDeg), tanEl = Math.tan(rad(SUN.elevationDeg))
const sE = Math.sin(sunAz), sN = Math.cos(sunAz)               // unit vector toward the sun on the ground, east / north
const shade = Buffer.alloc(W * H * 3)
const NDIR = 16
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const h0 = elev[j * W + i]
  // sun: march toward the sun; the ray is blocked where the terrain rises above it. Soft edge: margin grows with distance (a 0.27 degree sun is tiny; this is penumbra plus the DEM's own roughness)
  let vis = 1
  for (let t = 24, n = 0; t < 14000 && n < 220; t *= 1.03, n++) {
    const px = i + 0.5 + (sE * t) / dx, py = j + 0.5 - (sN * t) / dy
    if (px < 0 || py < 0 || px >= W || py >= H) break
    const over = hAt(px - 0.5, py - 0.5) - (h0 + t * tanEl)
    const soft = 6 + t * 0.012
    vis = Math.min(vis, Math.min(1, Math.max(0, 0.5 - over / (2 * soft))))
    if (vis <= 0) break
  }
  // sky occlusion: the mean of (1 - sin of the horizon angle) over 16 directions, marched out to 3.5 km (a deep valley is dark, a summit is open)
  let occ = 0
  for (let d = 0; d < NDIR; d++) {
    const a = ((d + 0.37) / NDIR) * Math.PI * 2, cE = Math.cos(a), cN = Math.sin(a)
    let mx = 0
    for (let t = 30, n = 0; t < 3500 && n < 26; t *= 1.14, n++) {
      const px = i + 0.5 + (cE * t) / dx, py = j + 0.5 - (cN * t) / dy
      if (px < 0 || py < 0 || px >= W || py >= H) break
      const s = (hAt(px - 0.5, py - 0.5) - h0) / Math.hypot(t, 1e-6)
      if (s > mx) mx = s
    }
    const sinA = mx / Math.sqrt(1 + mx * mx)
    occ += 1 - sinA
  }
  const ao = occ / NDIR
  const k = (j * W + i) * 3
  shade[k] = Math.min(255, Math.round(vis * 63) * 4 + 3); shade[k + 1] = Math.min(255, Math.round(Math.min(1, Math.max(0, ao)) * 63) * 4 + 3); shade[k + 2] = 0      // 6 bits each: smooth fields, so the PNG stays small; the shader dithers
}

// ---------------------------------------------------------------------------------------------------- write
const sizeOf = f => fs.statSync(f).size
const fHeight = path.join(OUT, 'yosemite-height.png'), fColor = path.join(OUT, 'yosemite-color.jpg'), fShade = path.join(OUT, 'yosemite-shade.png'), fJson = path.join(OUT, 'yosemite.json')
encode(heightRgb, W, H, fHeight, ['-compression_level', '9'])
encode(shade, W, H, fShade, ['-compression_level', '9'])
let q = 4, jpegQ = 0
for (; q <= 14; q++) { encode(colorRgb, COLOR_W, COLOR_H, fColor, ['-q:v', String(q), '-huffman', 'optimal']); if (sizeOf(fColor) <= CAPS.color) break }   // ffmpeg qscale: lower is better; the first one that fits the cap
jpegQ = Math.round(100 - q * 3.6)                              // rough JPEG quality equivalent of the ffmpeg qscale (q 5 is about q 82, q 8 about q 71)

// ---------------------------------------------------------------------------------------------------- geography check from the SHIPPED height map (decoded back from the file)
const back = decode(fHeight)
const shipped = new Float32Array(W * H)
for (let k = 0; k < W * H; k++) shipped[k] = back[k * 3] * 256 + back[k * 3 + 1] + back[k * 3 + 2] / 256 - 32768
const peak = (lat, lon, rM) => {                               // value at the pixel, and the highest pixel within rM metres
  const cx = ((lon - BOX.lon0) / (BOX.lon1 - BOX.lon0)) * W - 0.5, cy = ((BOX.lat1 - lat) / (BOX.lat1 - BOX.lat0)) * H - 0.5
  const here = shipped[Math.round(cy) * W + Math.round(cx)]
  let mx = -1e9
  for (let y = Math.floor(cy - rM / dy); y <= Math.ceil(cy + rM / dy); y++) for (let x = Math.floor(cx - rM / dx); x <= Math.ceil(cx + rM / dx); x++) if (x >= 0 && y >= 0 && x < W && y < H) mx = Math.max(mx, shipped[y * W + x])
  return { here, mx }
}
let allOk = true
log('geography check (m):')
for (const c of CHECKS) {
  const p = peak(c.lat, c.lon, 150), ok = p.here >= c.lo && p.here <= c.hi
  if (!ok) allOk = false
  log(`  ${c.name.padEnd(18)} ${p.here.toFixed(0).padStart(5)} m (highest within 150 m: ${p.mx.toFixed(0)})  expect ${c.lo}-${c.hi}  ${ok ? 'OK' : 'OUT OF RANGE'}`)
}
const tv = peak(TUNNEL_VIEW.lat, TUNNEL_VIEW.lon, 0)
log(`  Tunnel View        ${tv.here.toFixed(0).padStart(5)} m (nominal ${TUNNEL_VIEW.elev_m})`)

const json = {
  name: 'Yosemite Valley from Tunnel View',
  retrieved: new Date().toISOString().slice(0, 10),
  bounds: { lon0: BOX.lon0, lon1: BOX.lon1, lat0: BOX.lat0, lat1: BOX.lat1 },
  size_m: { east: Math.round(widthM), north: Math.round(heightM) },
  grid: { height: [W, H], color: [COLOR_W, COLOR_H], shade: [W, H], projection: 'equirectangular, north up, one pixel square on the ground' },
  elevation_m: { min: emin, max: emax, encoding: 'terrarium: R*256 + G + B/256 - 32768 (B = 0, 1 m steps)' },
  shade: { R: 'sun visibility 0..1 (soft ray-marched shadow)', G: 'sky ambient occlusion 0..1 (16-direction horizon, 3.5 km)', B: 'unused' },
  tunnelView: TUNNEL_VIEW,
  view: { ...VIEW, note: 'Tunnel View moved about 2.2 km up-valley onto the valley floor; looking east-north-east up the valley: El Capitan left, Half Dome right of centre, the south wall (Cathedral Rocks, Sentinel Dome) on the right' },
  sun: { azimuthDeg: SUN.azimuthDeg, elevationDeg: SUN.elevationDeg, dirENU: [Math.sin(sunAz) * Math.cos(rad(SUN.elevationDeg)), Math.cos(sunAz) * Math.cos(rad(SUN.elevationDeg)), Math.sin(rad(SUN.elevationDeg))].map(v => +v.toFixed(5)) },
  tiles: {
    elevation: { service: 'AWS Terrain Tiles (Terrarium)', z: Z_H, x: [hm.tx0, hm.tx1], y: [hm.ty0, hm.ty1], count: hm.count, urlTemplate: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png' },
    imagery: { service: 'USGS The National Map, USGSImageryOnly', z: Z_C, x: [cm.tx0, cm.tx1], y: [cm.ty0, cm.ty1], count: cm.count, urlTemplate: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}' },
  },
  credits: CREDITS,
  geography: Object.fromEntries(CHECKS.map(c => [c.name, Math.round(peak(c.lat, c.lon, 0).here)])),
}
fs.writeFileSync(fJson, JSON.stringify(json, null, 1) + '\n')

log('outputs:')
const rows = [[fHeight, CAPS.height], [fColor, CAPS.color], [fShade, CAPS.shade]]
for (const [f, cap] of rows) log(`  ${path.relative(path.resolve(HERE, '..'), f).padEnd(34)} ${(sizeOf(f) / 1024).toFixed(0).padStart(5)} KB  (cap ${(cap / 1024).toFixed(0)} KB)  ${sizeOf(f) <= cap ? 'OK' : 'OVER'}`)
log(`  color jpeg: ${COLOR_W}x${COLOR_H}, ffmpeg -q:v ${q} (about quality ${jpegQ})   height/shade: ${W}x${H}   elevation ${emin}..${emax} m   ${widthM.toFixed(0)} x ${heightM.toFixed(0)} m`)
log(`  ${path.relative(path.resolve(HERE, '..'), fJson)}`)
if (!allOk || rows.some(([f, cap]) => sizeOf(f) > cap)) { console.error('build-terrain: a check failed'); process.exit(1) }
