import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'node:path'

/** w14: head hints for the production build. The boot imports its modules dynamically (field, ui, the world, the reels, the sound engine and the 19 world extras), so the
 *  browser only learns about their chunks after main.js has downloaded and run: one more round trip, then each chunk's own imports another. Modulepreload tags
 *  put the whole boot set (the chunks and everything they import) in flight with the first request, and the fonts the loader and the first screen paint with are
 *  preloaded instead of discovered once the CSS has been parsed and the text is laid out. Nothing the site does changes; it just asks sooner. */
function bootHints(): Plugin {
  let base = '/'
  const BOOT = /\/src\/(v3\/engine\/field|v3\/ui\/ui|v3\/world\/objects|ui\/case|reels\/index|audio\/sound|audio\/sfx|v3\/world\/extras\/[^/]+)\.ts$/
  const FONTS = /\/(archivo-latin-wdth-normal|bodoni-moda-latin-opsz-normal|instrument-serif-latin-400-italic|ibm-plex-mono-latin-400-normal)-[^/]+\.woff2$/
  return {
    name: 'w14-boot-hints',
    apply: 'build',
    configResolved(c) { base = c.base.endsWith('/') ? c.base : c.base + '/' },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!/index\.html$/.test(ctx.path)) return
        const bundle = ctx.bundle
        if (!bundle) return
        type Chunk = { type: 'chunk'; fileName: string; facadeModuleId: string | null; imports: string[]; isEntry: boolean }
        const chunks = new Map<string, Chunk>()
        for (const [k, v] of Object.entries(bundle)) if (v.type === 'chunk') chunks.set(k, v as unknown as Chunk)
        const have = new Set(html.match(/(?<=href=")[^"]+\.js(?=")/g)?.map(h => h.replace(base, '')) ?? [])
        const want = new Set<string>()
        const walk = (name: string) => {
          if (want.has(name) || have.has(name)) return
          const c = chunks.get(name); if (!c) return
          want.add(name); for (const i of c.imports) walk(i)
        }
        for (const c of chunks.values()) if (c.facadeModuleId && BOOT.test(c.facadeModuleId.replace(/\\/g, '/'))) walk(c.fileName)
        const tags: { tag: string; attrs: Record<string, string | boolean>; injectTo: 'head' }[] = []
        for (const f of want) tags.push({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: base + f }, injectTo: 'head' })
        for (const [k, v] of Object.entries(bundle)) if (v.type === 'asset' && FONTS.test('/' + k)) tags.push({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: true, href: base + k }, injectTo: 'head' })
        return tags
      },
    },
  }
}

export default defineConfig({
  server: { port: 5199, strictPort: false, hmr: { overlay: false } },
  plugins: [bootHints()],
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), v2: resolve(__dirname, 'v2.html') } },
  },
  assetsInclude: ['**/*.glsl'],
})
