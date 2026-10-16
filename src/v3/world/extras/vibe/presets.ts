// Per-song vibe presets (authored in src/data/music.json, `vibe` on each pick) and the artwork palette. The authored preset sets the mood; two of its
// colours are nudged toward the sleeve's own dominant colours (artwork is CORS-enabled; if the read is refused the preset stands alone).
import * as THREE from 'three'

export interface Vibe {
  mood: string
  palette: [string, string, string]       // sky high, dark base, centre glow
  grade: string; gradeAmt: number         // multiply tint on what is lit
  wash: number                            // strength of the palette wash in the dark
  sat: number                             // saturation the song settles at (1 = none)
  swell?: number                          // seconds for the saturation to climb from 1 to `sat` (a slow orchestral build)
  ripple: 'bass' | 'snare'; rippleAmp: number
  flare: 'beat' | 'snare' | 'none'; flareColor: string
  strobe: number                          // brightness hit on the snare (kept tiny; rate-limited to under 3 Hz)
  rain: number; spark: number
  bpm: number                             // only drives a gentle pulse when the preview plays without an analyser
}
export const DEFAULT_VIBE: Vibe = {
  mood: 'plain', palette: ['#c8884a', '#1a1008', '#ffd9a8'], grade: '#ffcf9a', gradeAmt: 0.25, wash: 0.08, sat: 1.1, ripple: 'bass', rippleAmp: 0.8,
  flare: 'beat', flareColor: '#ffd9a8', strobe: 0, rain: 0, spark: 0, bpm: 100,
}
export const vibeOf = (t: { vibe?: unknown } | null | undefined): Vibe => ({ ...DEFAULT_VIBE, ...((t?.vibe as Partial<Vibe>) ?? {}) })
export const toV3 = (hex: string, out = new THREE.Vector3()) => { const c = new THREE.Color(hex); return out.set(c.r, c.g, c.b) }

const cache = new Map<string, Promise<THREE.Vector3[]>>()
/** up to 3 dominant, reasonably saturated colours of the sleeve (rgb 0..1). Resolves [] when the image can't be read. */
export function artColors(url: string | undefined): Promise<THREE.Vector3[]> {
  if (!url) return Promise.resolve([])
  let p = cache.get(url)
  if (!p) {
    p = new Promise<THREE.Vector3[]>(res => {
      const img = new Image(); img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const N = 24, cv = document.createElement('canvas'); cv.width = cv.height = N
          const g = cv.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0, N, N)
          const d = g.getImageData(0, 0, N, N).data
          const bins = new Map<number, { w: number; r: number; g: number; b: number }>()
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), s = mx > 0 ? (mx - mn) / mx : 0
            if (mx < 0.18) continue
            const h = new THREE.Color(r, gg, b).getHSL({ h: 0, s: 0, l: 0 }).h
            const k = Math.floor(h * 12) % 12, w = 0.15 + s * s * (0.4 + mx)
            const e = bins.get(k) ?? { w: 0, r: 0, g: 0, b: 0 }; e.w += w; e.r += r * w; e.g += gg * w; e.b += b * w; bins.set(k, e)
          }
          res([...bins.values()].sort((a, b) => b.w - a.w).slice(0, 3).map(e => new THREE.Vector3(e.r / e.w, e.g / e.w, e.b / e.w)))
        } catch { res([]) }
      }
      img.onerror = () => res([])
      img.src = url
    })
    cache.set(url, p)
  }
  return p
}
