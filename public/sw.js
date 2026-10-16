// Service worker (w14 latency). GitHub Pages sends every file with max-age=600 and cannot send immutable, so after ten minutes a visit
// revalidates every hashed chunk (80 round trips of 150 ms on a phone) and the heavy models and images are re-checked too.
//   hashed build output (assets/<name>-<hash>.<ext>)  cache-first: the name is the content, it can never be stale
//   models, media, terrain, fonts, wasm, data          stale-while-revalidate: served from the cache at once, refreshed in the background, so a re-baked
//                                                      file shows up on the next visit
//   the page itself (navigations)                      network-first with the cache as the offline fallback: a deploy is seen at once
// Never touched: other origins (Apple previews and covers), Range requests (video, audio), anything that is not a GET, demos/ and docs/ (big, self-contained).
// Bump VERSION only when this file's own behaviour changes; stale caches of other versions are deleted on activate.
const VERSION = 'v1'
const CACHE = 'pf-' + VERSION
const SCOPE = new URL(self.registration.scope).pathname            // /portfolio/
const HASHED = /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.[a-z0-9]+$/
const STATIC = /\.(bin|z|glb|gltf|json|webp|jpg|jpeg|png|svg|woff2|wasm|ktx2|txt|js|mjs|css)$/i
const SKIP_DIR = new RegExp('^' + SCOPE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(demos|docs|lab)/')
const MAX_ENTRIES = 600

self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('pf-') && k !== CACHE) await caches.delete(k)
    await self.clients.claim()
  })())
})

const cacheable = res => res && res.ok && res.status === 200 && (res.type === 'basic' || res.type === 'default')
async function trim(cache) {
  const keys = await cache.keys()
  if (keys.length > MAX_ENTRIES) for (const k of keys.slice(0, keys.length - MAX_ENTRIES + 50)) await cache.delete(k)
}

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || req.headers.has('range')) return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE) || SKIP_DIR.test(url.pathname)) return
  if (url.pathname === SCOPE + 'sw.js') return

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE)
      try {
        const res = await fetch(req)
        if (cacheable(res)) cache.put(SCOPE, res.clone())
        return res
      } catch {
        return (await cache.match(SCOPE)) || (await cache.match(req, { ignoreSearch: true })) || Response.error()
      }
    })())
    return
  }

  if (HASHED.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const hit = await cache.match(req)
      if (hit) return hit
      const res = await fetch(req)
      if (cacheable(res)) { cache.put(req, res.clone()); trim(cache) }
      return res
    })())
    return
  }

  if (STATIC.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const hit = await cache.match(req)   // exact URL: a ?v= bump is a different file, never the old entry
      const refresh = fetch(req).then(res => { if (cacheable(res)) { cache.put(req, res.clone()); trim(cache) } return res }).catch(() => null)
      if (hit) { e.waitUntil(refresh); return hit }
      return (await refresh) || Response.error()
    })())
  }
})

// the page lists what it has already loaded this visit (they sit in the HTTP cache, so adding them costs no bandwidth), and anything it wants
// warmed for the stops ahead; both land in the cache so the next visit, even after the 10 minute window, needs no network for them.
self.addEventListener('message', e => {
  const d = e.data
  if (!d || (d.type !== 'seed' && d.type !== 'warm') || !Array.isArray(d.urls)) return
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    for (const u of d.urls) {
      try {
        const url = new URL(u, self.location.href)
        if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE) || SKIP_DIR.test(url.pathname) || url.pathname.endsWith('/sw.js')) continue
        if (!HASHED.test(url.pathname) && !STATIC.test(url.pathname)) continue
        if (await cache.match(url.href)) continue
        // 'seed' reads the HTTP cache (already loaded); 'warm' goes to the network at low priority
        const res = await fetch(url.href, d.type === 'seed' ? { cache: 'force-cache' } : { priority: 'low' })
        if (cacheable(res)) await cache.put(url.href, res)
      } catch { /* offline or gone: skip */ }
    }
    trim(cache)
  })())
})
