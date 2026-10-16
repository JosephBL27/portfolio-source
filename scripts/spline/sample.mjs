// Surface sampler: Spline mesh dump (world-space verts/indices/normals) -> public/models/<name>.bin
//   node sample.mjs <recvDir> <outFile> <partPrefix[,partPrefix...]> [--n 131072] [--rot rx,ry,rz] [--flipn] [--fit 2]
// Format "SPT1" (little endian):
//   0  char[4] "SPT1" | 4 u32 count | 8 f32 scale (pos = int16/32767*scale) | 12 f32 aspect (height/width of bbox, info)
//   16 Int16 xyz * count | Int8 nxyz * count | Uint8 ao * count
import fs from 'node:fs'
import path from 'node:path'

const [recv, out, partsArg, ...rest] = process.argv.slice(2)
const opt = (k, d) => { const i = rest.indexOf('--' + k); return i < 0 ? d : rest[i + 1] }
const M = +opt('n', 131072)
const rot = (opt('rot', '0,0,0')).split(',').map(Number).map(d => d * Math.PI / 180)
const fit = +opt('fit', 2)          // largest bbox dimension after normalising
const flipN = rest.includes('--flipn')
const welded = rest.includes('--weld')
const balance = +opt('balance', 0)       // >0 boosts sample density on small parts
const aoCull = +opt('aocull', 0.06)       // drop samples whose AO is below this (hidden/internal surfaces)

function rd(file, T) { const b = fs.readFileSync(path.join(recv, file)); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }

// ---- load + merge parts
let V = [], I = [], N = [], PART = []
let base = 0
const partList = []
for (const p of partsArg.split(',')) {
  if (p.endsWith('*')) {
    const pre = p.slice(0, -1)
    for (const f of fs.readdirSync(recv).sort()) { const m = f.match(new RegExp('^' + pre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)_v\\.bin$')); if (m) partList.push(pre + m[1]) }
  } else partList.push(p)
}
console.log('parts:', partList.length)
let partIdx = 0
for (const p of partList) {
  const v = rd(`${p}_v.bin`, Float32Array), idx = rd(`${p}_i.bin`, Uint32Array)
  const nf = fs.existsSync(path.join(recv, `${p}_n.bin`)) ? rd(`${p}_n.bin`, Float32Array) : null
  for (let i = 0; i < v.length; i++) V.push(v[i])
  for (let i = 0; i < idx.length; i++) I.push(idx[i] + base)
  if (nf) for (let i = 0; i < nf.length; i++) N.push(nf[i]); else for (let i = 0; i < v.length; i++) N.push(0)
  for (let i = 0; i < idx.length / 3; i++) PART.push(partIdx)
  partIdx++
  base += v.length / 3
}
V = Float64Array.from(V); I = Uint32Array.from(I); N = Float64Array.from(N)
const nv = V.length / 3, nt = I.length / 3
console.log('parts', partsArg, 'verts', nv, 'tris', nt)

// ---- rotate (applied about origin before centring), order Z*Y*X
function rotate(a, rx, ry, rz) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz)
  for (let i = 0; i < a.length; i += 3) {
    let x = a[i], y = a[i + 1], z = a[i + 2]
    let y1 = y * cx - z * sx, z1 = y * sx + z * cx; y = y1; z = z1
    let x2 = x * cy + z * sy, z2 = -x * sy + z * cy; x = x2; z = z2
    let x3 = x * cz - y * sz, y3 = x * sz + y * cz; x = x3; y = y3
    a[i] = x; a[i + 1] = y; a[i + 2] = z
  }
}
if (rot.some(r => r)) { rotate(V, ...rot); rotate(N, ...rot) }

// ---- recompute smooth normals if missing/zero (area weighted, welded by position)
function faceNormal(t) {
  const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3
  const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2]
  const vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2]
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
}
let zeroN = 0
for (let i = 0; i < nv; i++) if (Math.abs(N[i * 3]) + Math.abs(N[i * 3 + 1]) + Math.abs(N[i * 3 + 2]) < 1e-6) zeroN++
if (zeroN > nv * 0.5 || welded) {
  console.log('recomputing normals (welded)', zeroN)
  const key = new Map(), W = new Uint32Array(nv)
  for (let i = 0; i < nv; i++) {
    const k = Math.round(V[i * 3] * 200) + ',' + Math.round(V[i * 3 + 1] * 200) + ',' + Math.round(V[i * 3 + 2] * 200)
    let g = key.get(k); if (g === undefined) { g = key.size; key.set(k, g) } W[i] = g
  }
  const acc = new Float64Array(key.size * 3)
  for (let t = 0; t < nt; t++) { const f = faceNormal(t); for (let j = 0; j < 3; j++) { const g = W[I[t * 3 + j]]; acc[g * 3] += f[0]; acc[g * 3 + 1] += f[1]; acc[g * 3 + 2] += f[2] } }
  for (let i = 0; i < nv; i++) { const g = W[i]; N[i * 3] = acc[g * 3]; N[i * 3 + 1] = acc[g * 3 + 1]; N[i * 3 + 2] = acc[g * 3 + 2] }
}
for (let i = 0; i < nv; i++) {
  const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1
  const s = (flipN ? -1 : 1) / l
  N[i * 3] *= s; N[i * 3 + 1] *= s; N[i * 3 + 2] *= s
}

// ---- bbox, centre, normalise
let mn = [1e30, 1e30, 1e30], mx = [-1e30, -1e30, -1e30]
for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], V[i * 3 + k]); mx[k] = Math.max(mx[k], V[i * 3 + k]) }
const ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]]
const big = Math.max(...ext), cen = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2]
const S = fit / big
for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) V[i * 3 + k] = (V[i * 3 + k] - cen[k]) * S
console.log('extent before', ext.map(v => +v.toFixed(2)), 'scale', S.toFixed(5), 'extent after', ext.map(v => +(v * S).toFixed(3)))

// ---- area-weighted sampling
const prng = (() => { let a = 0x9e3779b9; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } })()
const cum = new Float64Array(nt)
let tot = 0
const triA = new Float64Array(nt), partA = new Float64Array(partIdx + 1)
for (let t = 0; t < nt; t++) { const f = faceNormal(t); triA[t] = 0.5 * Math.hypot(f[0], f[1], f[2]); partA[PART[t]] += triA[t] }
const refA = Math.max(...partA)
for (let t = 0; t < nt; t++) { tot += triA[t] * (balance > 0 ? Math.pow(refA / Math.max(partA[PART[t]], 1e-9), balance) : 1); cum[t] = tot }
function pick(r) { let lo = 0, hi = nt - 1; r *= tot; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m } return lo }
function sampleN(count, wantN, strat = false) {
  const P = new Float32Array(count * 3), Nn = new Float32Array(count * 3)
  // strat: systematic sampling along the cumulative-area axis (every triangle gets floor/ceil of its
  // expected count -> far less clumping than iid), then a random permutation so any prefix is uniform.
  const order = new Uint32Array(count); for (let i = 0; i < count; i++) order[i] = i
  if (strat) for (let i = count - 1; i > 0; i--) { const j = Math.floor(prng() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t }
  let tp = 0
  for (let k = 0; k < count; k++) {
    const s = strat ? order[k] : k
    let t
    if (strat) { const r = (k + prng()) / count * tot; while (tp < nt - 1 && cum[tp] < r) tp++; t = tp } else t = pick(prng())
    const r1 = Math.sqrt(prng()), r2 = prng()
    const u = 1 - r1, v = r1 * (1 - r2), w = r1 * r2
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3
    for (let q = 0; q < 3; q++) P[s * 3 + q] = V[a + q] * u + V[b + q] * v + V[c + q] * w
    if (wantN) {
      let nx = N[a] * u + N[b] * v + N[c] * w, ny = N[a + 1] * u + N[b + 1] * v + N[c + 1] * w, nz = N[a + 2] * u + N[b + 2] * v + N[c + 2] * w
      const l = Math.hypot(nx, ny, nz) || 1
      Nn[s * 3] = nx / l; Nn[s * 3 + 1] = ny / l; Nn[s * 3 + 2] = nz / l
    }
  }
  return [P, Nn]
}
const Mo = aoCull > 0 ? Math.ceil(M * +opt('over', 1.6)) : M
let [P, Nn] = sampleN(Mo, true, true)

// ---- visibility-based ambient occlusion: software z-buffers from many directions.
// ao = fraction of the (normal-facing) directions from which the sample is visible; 0 = hidden/internal.
const R = +opt('res', 768), half = fit / 2 * 1.06, NDIR = +opt('dirs', 72)
const [D] = sampleN(Math.min(3_000_000, Math.max(1_200_000, nt * 8)), false)
const nD = D.length / 3
const dirs = []
for (let k = 0; k < NDIR; k++) { const z = 1 - 2 * (k + 0.5) / NDIR, r = Math.sqrt(1 - z * z), ph = k * 2.399963229728653; dirs.push([r * Math.cos(ph), r * Math.sin(ph), z]) }
const visCount = new Uint16Array(Mo), facing = new Uint16Array(Mo)
const depth = new Float32Array(R * R), depth2 = new Float32Array(R * R)
const EPS = 4.5 * (2 * half / R) + 0.004
for (const d of dirs) {
  // basis
  let ux, uy, uz; if (Math.abs(d[2]) < 0.9) { ux = -d[1]; uy = d[0]; uz = 0 } else { ux = 0; uy = -d[2]; uz = d[1] }
  let l = Math.hypot(ux, uy, uz); ux /= l; uy /= l; uz /= l
  const vx = d[1] * uz - d[2] * uy, vy = d[2] * ux - d[0] * uz, vz = d[0] * uy - d[1] * ux
  depth.fill(-1e9)
  const sc = R / (2 * half)
  for (let s = 0; s < nD; s++) {
    const x = D[s * 3], y = D[s * 3 + 1], z = D[s * 3 + 2]
    const px = ((x * ux + y * uy + z * uz) + half) * sc | 0, py = ((x * vx + y * vy + z * vz) + half) * sc | 0
    if (px < 0 || py < 0 || px >= R || py >= R) continue
    const dp = x * d[0] + y * d[1] + z * d[2], k = py * R + px
    if (dp > depth[k]) depth[k] = dp
  }
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
    let m = -1e9
    for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= R) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= R) continue; const v = depth[yy * R + xx]; if (v > m) m = v } }
    depth2[y * R + x] = m
  }
  for (let s = 0; s < Mo; s++) {
    const nx = Nn[s * 3], ny = Nn[s * 3 + 1], nz = Nn[s * 3 + 2]
    if (nx * d[0] + ny * d[1] + nz * d[2] < 0.2) continue
    facing[s]++
    const x = P[s * 3], y = P[s * 3 + 1], z = P[s * 3 + 2]
    const px = ((x * ux + y * uy + z * uz) + half) * sc | 0, py = ((x * vx + y * vy + z * vz) + half) * sc | 0
    const dp = x * d[0] + y * d[1] + z * d[2]
    // visible if no (noticeably) nearer surface in this pixel's 3x3 neighbourhood (depth2 = dilated by max)
    const m = depth2[py * R + px]
    if (dp >= m - EPS) visCount[s]++
  }
}
let ao = new Uint8Array(Mo)
for (let s = 0; s < Mo; s++) ao[s] = facing[s] ? Math.round(255 * visCount[s] / facing[s]) : 255
// cull hidden / enclosed samples, keep the first M survivors (order is already a random permutation)
if (aoCull > 0) {
  const keep = []; for (let s = 0; s < Mo && keep.length < M; s++) if (ao[s] / 255 >= aoCull) keep.push(s)
  let alive = 0; for (let s = 0; s < Mo; s++) if (ao[s] / 255 >= aoCull) alive++
  console.log('ao cull: visible', alive, 'of', Mo, '(' + (100 * alive / Mo).toFixed(0) + '%); keeping', Math.min(M, alive))
  if (keep.length < M) { console.log('NOT ENOUGH VISIBLE SAMPLES: rerun with a larger --over (survival ' + (keep.length / Mo).toFixed(2) + ')'); process.exit(2) }
  const P2 = new Float32Array(M * 3), N2 = new Float32Array(M * 3), A2 = new Uint8Array(M)
  keep.forEach((s, k) => { for (let q = 0; q < 3; q++) { P2[k * 3 + q] = P[s * 3 + q]; N2[k * 3 + q] = Nn[s * 3 + q] } A2[k] = ao[s] })
  P = P2; Nn = N2; ao = A2
}
let aoMean = 0; for (let s = 0; s < M; s++) aoMean += ao[s]; console.log('ao mean', (aoMean / M / 255).toFixed(3))

// ---- encode
let peak = 0; for (let i = 0; i < P.length; i++) peak = Math.max(peak, Math.abs(P[i]))
const head = Buffer.alloc(16)
head.write('SPT1', 0, 'ascii'); head.writeUInt32LE(M, 4); head.writeFloatLE(peak, 8); head.writeFloatLE(ext[1] / ext[0], 12)
const pos16 = new Int16Array(M * 3), n8 = new Int8Array(M * 3)
for (let i = 0; i < M * 3; i++) { pos16[i] = Math.round(P[i] / peak * 32767); n8[i] = Math.round(Nn[i] * 127) }
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, Buffer.concat([head, Buffer.from(pos16.buffer), Buffer.from(n8.buffer), Buffer.from(ao.buffer)]))
console.log('wrote', out, fs.statSync(out).size, 'bytes; peak', peak.toFixed(3), 'aspect(h/w)', (ext[1] / ext[0]).toFixed(2))
