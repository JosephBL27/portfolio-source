// Tiny local receiver for Spline HTML-layer exports. Listens on 127.0.0.1:5291 only.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const OUT = process.argv[2]
const log = []
let cmd = { id: 0 }
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Max-Age': '600',
}
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  if (req.method === 'GET' && u.pathname === '/cmd') { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); return res.end(JSON.stringify(cmd)) }
  if (req.method === 'GET' && u.pathname === '/log') { res.writeHead(200, { ...cors, 'content-type': 'application/json' }); return res.end(JSON.stringify(log)) }
  if (req.method === 'GET') { log.push({ t: Date.now(), ping: u.pathname + u.search }); res.writeHead(200, cors); return res.end('ok') }
  if (u.pathname === '/setcmd') { const c = []; req.on('data', d => c.push(d)); req.on('end', () => { cmd = { ...JSON.parse(Buffer.concat(c).toString() || '{}'), id: Date.now() }; res.writeHead(200, cors); res.end(JSON.stringify(cmd)) }); return }
  const name = (u.searchParams.get('name') || 'x').replace(/[^a-zA-Z0-9_.-]/g, '_')
  const chunks = []
  req.on('data', c => chunks.push(c))
  req.on('end', () => {
    const buf = Buffer.concat(chunks)
    fs.writeFileSync(path.join(OUT, name), buf)
    log.push({ t: Date.now(), name, bytes: buf.length, ct: req.headers['content-type'] })
    res.writeHead(200, cors); res.end('saved ' + buf.length)
  })
}).listen(5291, '127.0.0.1', () => console.log('recv listening 5291 ->', OUT))
