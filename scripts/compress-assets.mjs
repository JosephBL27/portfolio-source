// w14: write the lossless transport copies of the heavy binaries and prove each restores byte for byte.
//   node scripts/compress-assets.mjs
// public/models/brain.bin  ->  public/models/brain.bin.z   (src/gl/brainShape.ts packBrainZ, then gzip -9; the page gunzips with DecompressionStream)
// GitHub Pages compresses text types only, so a plain .bin goes over the wire at full size. The plain .bin stays beside the .z as the fallback
// for a browser without DecompressionStream. Run again whenever scripts/build-brain.mjs rewrites brain.bin.
import fs from 'node:fs'
import zlib from 'node:zlib'
import { packBrainZ, restoreBrainZ } from '../src/gl/brainShape.ts'

const root = new URL('../public/models/', import.meta.url)
const rows = []
const brain = fs.readFileSync(new URL('brain.bin', root))
const packed = packBrainZ(new Uint8Array(brain.buffer, brain.byteOffset, brain.byteLength))
const gz = zlib.gzipSync(packed, { level: 9 })
const back = Buffer.from(restoreBrainZ(new Uint8Array(zlib.gunzipSync(gz))))
if (!back.equals(brain)) throw new Error('brain.bin.z does not restore the original bytes')
fs.writeFileSync(new URL('brain.bin.z', root), gz)
rows.push(['brain.bin', brain.length, gz.length])
for (const [f, a, b] of rows) console.log(`${f}: ${a} -> ${b} bytes (${(100 * b / a).toFixed(1)}%), round trip exact`)
