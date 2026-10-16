// Bakes the procedural brain (src/gl/brainShape.ts) into public/models/brain.bin.
//   node scripts/build-brain.mjs [cellSize=0.0155] [out=public/models/brain.bin]
// Needs Node >= 22.18 (runs the .ts file directly; brainShape.ts has no imports and only erasable types).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { meshBrain, packBrain } from '../src/gl/brainShape.ts'
const h = +(process.argv[2] ?? 0.0155)
const out = process.argv[3] ?? fileURLToPath(new URL('../public/models/brain.bin', import.meta.url))
const t0 = performance.now()
const m = meshBrain(h, true)
const buf = packBrain(m)
writeFileSync(out, Buffer.from(buf))
let ymin = 9, ymax = -9, xmin = 9, xmax = -9, zmin = 9, zmax = -9
for (let i = 0; i < m.pos.length; i += 3) { xmin = Math.min(xmin, m.pos[i]); xmax = Math.max(xmax, m.pos[i]); ymin = Math.min(ymin, m.pos[i + 1]); ymax = Math.max(ymax, m.pos[i + 1]); zmin = Math.min(zmin, m.pos[i + 2]); zmax = Math.max(zmax, m.pos[i + 2]) }
console.log(`brain.bin: h=${h} verts=${m.pos.length / 3} tris=${m.idx.length / 3} bytes=${buf.byteLength} in ${((performance.now() - t0) / 1000).toFixed(1)} s`)
console.log(`bounds x[${xmin.toFixed(2)},${xmax.toFixed(2)}] y[${ymin.toFixed(2)},${ymax.toFixed(2)}] z[${zmin.toFixed(2)},${zmax.toFixed(2)}]`)
