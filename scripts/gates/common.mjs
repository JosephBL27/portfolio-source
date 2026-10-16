// Shared by the gate scripts: named flags, the default dev URL, and a dead Vite HMR socket so a stray edit cannot reload the page mid-gate.
// Usage: import { flag, devUrl, quietHmr } from './common.mjs' (used by stepall2.mjs and smokeb2.mjs; serveb.mjs uses flag only).
// Source: written 2026-10-11 for wave-22 task 5; the HMR stub follows the wave-22 brief (probes must not reload on other agents' edits).

/** value after --name, or fallback */
export function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

/** --url wins; otherwise http://localhost:<--port, default 5490>/ */
export function devUrl() {
  return flag('url', `http://localhost:${flag('port', '5490')}/`)
}

/** Vite's client opens WebSocket(url, 'vite-hmr'); give it a socket that never opens, so it never reconnects and reloads. */
export async function quietHmr(page) {
  await page.addInitScript(() => {
    const Native = window.WebSocket
    const dead = () => ({ readyState: 0, send() {}, close() {}, addEventListener() {}, removeEventListener() {} })
    window.WebSocket = new Proxy(Native, {
      construct(T, args) { return args[1] === 'vite-hmr' || /vite-hmr/.test(String(args[0])) ? dead() : Reflect.construct(T, args) },
    })
  })
}
