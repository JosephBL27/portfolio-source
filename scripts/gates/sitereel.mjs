// Gate client: calls one sitereel MCP tool through the vendored stdio server and prints its text result (sitereel is the template source for build briefs, HANDOFF §10).
// Usage: node scripts/gates/sitereel.mjs <tool> '<json args>'   e.g. node scripts/gates/sitereel.mjs sitereel_get '{"slug":"serra-sanctuary","section":"glass cards"}'
// Source: copied 2026-10-11 from /private/tmp/claude-501/sitereel/sr.mjs (renamed sitereel.mjs); vendor path from $HOME (override with SITEREEL_MCP_DIR), not a fixed /Users path.
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const VENDOR = process.env.SITEREEL_MCP_DIR || path.join(os.homedir(), '.agents/vendor/sitereel-mcp')
const sdk = f => import(pathToFileURL(path.join(VENDOR, 'node_modules/@modelcontextprotocol/sdk/dist/esm', f)).href)
const [tool, args = '{}'] = process.argv.slice(2)
if (!tool) { console.error("usage: node scripts/gates/sitereel.mjs <tool> '<json args>'"); process.exit(2) }

const { Client } = await sdk('client/index.js')
const { StdioClientTransport } = await sdk('client/stdio.js')
const c = new Client({ name: 'sitereel-gate', version: '1' })
await c.connect(new StdioClientTransport({ command: 'node', args: [path.join(VENDOR, 'server.mjs')] }))
try {
  const r = await c.callTool({ name: tool, arguments: JSON.parse(args) })
  console.log(r.content?.[0]?.text ?? JSON.stringify(r))
} finally {
  await c.close()
}
