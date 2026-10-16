// Gate helper: static server that maps a sub-path (e.g. /portfolio/) onto a built folder, so smokeb2.mjs can test a GitHub-Pages-style build locally.
// Usage: node scripts/gates/serveb.mjs --root <build dir> [--base /portfolio/] [--port 5418]   (run in the background; kill it when the smoke is done)
// Source: copied 2026-10-11 from the wave-22 scratch copy of serveb.mjs; named flags, a path-traversal guard and a usage error replace the positional arguments.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { flag } from './common.mjs'

if (!flag('root')) { console.error('usage: node scripts/gates/serveb.mjs --root <build dir> [--base /portfolio/] [--port 5418]'); process.exit(2) }
const root = path.resolve(flag('root'))
let base = flag('base', '/')
if (!base.startsWith('/')) base = '/' + base
if (!base.endsWith('/')) base += '/'
const port = +flag('port', '5418')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.bin': 'application/octet-stream', '.mp4': 'video/mp4' }

http.createServer((q, r) => {
  let u
  try { u = decodeURIComponent(q.url.split('?')[0]) } catch { r.writeHead(400); return r.end() }
  if (!u.startsWith(base)) { r.writeHead(404); return r.end() }
  let rel = u.slice(base.length); if (rel === '' || rel.endsWith('/')) rel += 'index.html'
  const f = path.join(root, rel)
  if (!f.startsWith(root + path.sep)) { r.writeHead(403); return r.end() }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end() } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d) })
}).listen(port, () => console.log(`serving ${root} at http://localhost:${port}${base}`))
