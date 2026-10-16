// Binary STL (or ASCII-free netfabb STL) -> the recv dir layout sample.mjs reads (<name>_v.bin f32 xyz, <name>_i.bin u32).
//   node stl2recv.mjs <in.stl> <outDir> <name>
// Vertices are welded by exact position so sample.mjs can smooth normals; units are left as in the file.
import fs from 'node:fs'
import path from 'node:path'
const [inp, outDir, name] = process.argv.slice(2)
const b = fs.readFileSync(inp)
const nt = b.readUInt32LE(80)
if (84 + nt * 50 !== b.length) throw new Error(`not a binary STL: ${nt} tris vs ${b.length} bytes`)
const map = new Map(), V = [], I = new Uint32Array(nt * 3)
const key = (x, y, z) => `${x},${y},${z}`
for (let t = 0; t < nt; t++) {
  const o = 84 + t * 50 + 12
  for (let k = 0; k < 3; k++) {
    const x = b.readFloatLE(o + k * 12), y = b.readFloatLE(o + k * 12 + 4), z = b.readFloatLE(o + k * 12 + 8)
    const kk = key(x, y, z); let id = map.get(kk)
    if (id === undefined) { id = V.length / 3; map.set(kk, id); V.push(x, y, z) }
    I[t * 3 + k] = id
  }
}
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, `${name}_v.bin`), Buffer.from(new Float32Array(V).buffer))
fs.writeFileSync(path.join(outDir, `${name}_i.bin`), Buffer.from(I.buffer))
let mn = [1e30, 1e30, 1e30], mx = [-1e30, -1e30, -1e30]
for (let i = 0; i < V.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], V[i + k]); mx[k] = Math.max(mx[k], V[i + k]) }
console.log(`${nt} tris, ${V.length / 3} welded verts; bbox min`, mn.map(v => +v.toFixed(1)), 'max', mx.map(v => +v.toFixed(1)))
