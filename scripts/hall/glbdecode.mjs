// decode every Draco primitive of a GLB in Node (no browser) and report UV1 / COLOR_0 ranges per material. usage: node scripts/hall/glbdecode.mjs public/models/glb/hall-photoreal.glb
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
import os from 'node:os'
const ROOT = decodeURIComponent(new URL('../../', import.meta.url).pathname)
const tmpDec = os.tmpdir() + '/hall-draco-decoder.cjs'   // three's decoder is a script, not a module: copy it as CommonJS
fs.copyFileSync(ROOT + 'node_modules/three/examples/jsm/libs/draco/draco_decoder.js', tmpDec)
const DracoDecoderModule = require(tmpDec)
const draco = await DracoDecoderModule()
const buf = fs.readFileSync(process.argv[2])
const jl = buf.readUInt32LE(12), js = JSON.parse(buf.slice(20, 20 + jl).toString()), bin0 = 20 + jl + 8
const dec = new draco.Decoder()
const rows = []
for (const m of js.meshes) for (const p of m.primitives) {
  const ext = p.extensions?.KHR_draco_mesh_compression
  if (!ext) continue
  const bv = js.bufferViews[ext.bufferView]
  const bytes = new Int8Array(buf.buffer, buf.byteOffset + bin0 + (bv.byteOffset || 0), bv.byteLength)
  const mesh = new draco.Mesh()
  const st = dec.DecodeArrayToMesh(bytes, bytes.length, mesh)
  if (!st.ok()) { rows.push({ err: st.error_msg() }); continue }
  const n = mesh.num_points(), r = { mat: js.materials[p.material].name, verts: n, faces: mesh.num_faces(), attrs: {} }
  for (const [name, id] of Object.entries(ext.attributes)) {
    const a = dec.GetAttributeByUniqueId(mesh, id), nc = a.num_components(), arr = new draco.DracoFloat32Array()
    dec.GetAttributeFloatForAllPoints(mesh, a, arr)
    const mn = Array(nc).fill(Infinity), mx = Array(nc).fill(-Infinity), sum = Array(nc).fill(0)
    for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { const v = arr.GetValue(i * nc + c); mn[c] = Math.min(mn[c], v); mx[c] = Math.max(mx[c], v); sum[c] += v }
    r.attrs[name] = { min: mn.map(x => +x.toFixed(3)), max: mx.map(x => +x.toFixed(3)), mean: sum.map(x => +(x / n).toFixed(3)) }
    draco.destroy(arr)
  }
  rows.push(r); draco.destroy(mesh)
}
for (const r of rows) console.log(r.mat?.padEnd(14), 'v', r.verts, 'f', r.faces, r.err ?? '', 'UV1', JSON.stringify(r.attrs?.TEXCOORD_1 ?? null), 'COL', JSON.stringify(r.attrs?.COLOR_0 ?? null))
