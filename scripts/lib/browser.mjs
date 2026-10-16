// Shared headless-browser helper for agent test scripts. RAM safety (orphaned test browsers froze this Mac):
//   - at most SLOTS browsers across ALL agents at once (an atomic mkdir lock per slot; stale locks expire)
//   - the browser is ALWAYS closed and the slot released, even when the test throws or times out
// usage:
//   import { withBrowser } from './scripts/lib/browser.mjs'
//   await withBrowser(async (browser) => { const p = await browser.newPage({ viewport: { width: 1440, height: 900 } }); ... })
import { chromium } from '../../node_modules/playwright-core/index.mjs'
import fs from 'node:fs'
const DIR = '/private/tmp/claude-501/browser-slots', SLOTS = 2, STALE_MS = 12 * 60 * 1000, MAX_WAIT_MS = 20 * 60 * 1000
fs.mkdirSync(DIR, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function acquire() {
  const t0 = Date.now()
  for (;;) {
    for (let i = 0; i < SLOTS; i++) {
      const d = `${DIR}/slot${i}`
      try { fs.mkdirSync(d); fs.writeFileSync(`${d}/owner`, `${process.pid} ${new Date().toISOString()}`); return d } catch {
        try { if (Date.now() - fs.statSync(d).mtimeMs > STALE_MS) fs.rmSync(d, { recursive: true, force: true }) } catch {}
      }
    }
    if (Date.now() - t0 > MAX_WAIT_MS) throw new Error('browser slot wait exceeded 20 min')
    await sleep(3000)
  }
}
export async function withBrowser(fn, opts = {}) {
  const slot = await acquire()
  const release = () => { try { fs.rmSync(slot, { recursive: true, force: true }) } catch {} }
  process.once('exit', release)
  let browser
  try {
    browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', ...(opts.args || [])] })
    return await fn(browser)
  } finally {
    try { await browser?.close() } catch {}
    release()
  }
}
