// Gate: loads a dev or built site, opens the qvr and wwii case views, and checks that every /docs, /demos and /pdf link answers 200.
// Usage: node scripts/gates/smokeb2.mjs --url http://localhost:5418/portfolio/ [--shot out/smoke.png]   (exit 1 on any console error or missing/4xx asset)
// Source: copied 2026-10-11 from the wave-22 scratch copy of smokeb2.mjs (volatile /tmp path); flags, quiet HMR, a missing count and exit code added; browser via withBrowser().
import { withBrowser } from '../lib/browser.mjs'
import { devUrl, flag, quietHmr } from './common.mjs'

const site = devUrl()                 // full base URL ending in /, e.g. http://localhost:5418/portfolio/ (pass --url for a sub-path)
const origin = new URL(site).origin
const shot = flag('shot', '')
const result = await withBrowser(async (b) => {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = [], bad = []
  await quietHmr(p)
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)) })
  p.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0, 160)))
  p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace(origin, '')) })
  await p.goto(site + '?gate=0', { waitUntil: 'load', timeout: 90000 })
  await p.waitForFunction(() => window.__v3?.openWork, null, { timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__v3.openWork('qvr')); await p.waitForTimeout(2500)
  if (shot) await p.screenshot({ path: shot })
  await p.evaluate(() => window.__v3.caseView?.close?.()); await p.evaluate(() => window.__v3.openWork('wwii')); await p.waitForTimeout(2500)
  const links = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => /demos|docs|pdf/.test(h)))].slice(0, 10))
  const codes = []
  for (const h of links) { const u = new URL(h, site).href; const r = await p.request.get(u); codes.push(r.status() + ' ' + u.replace(origin, '')) }
  const uniqueBad = [...new Set(bad)]
  const missing = uniqueBad.length + codes.filter(c => !c.startsWith('200 ')).length
  return { errors: errs.length, errs: errs.slice(0, 6), bad: uniqueBad.slice(0, 10), links: codes, missing }
})
console.log(JSON.stringify(result, null, 1))
process.exitCode = result.errors || result.missing ? 1 : 0
