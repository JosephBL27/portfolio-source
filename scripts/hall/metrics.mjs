// the grade-check / colour-metrics numbers (meanSat over V>0.15, p5 luma of the top 20% rows, meanLuma, 12-bin hue histogram) from PNG files, no browser: ffmpeg decodes. usage: node scripts/hall/metrics.mjs a.png [b.png ...]
import { execFileSync } from 'node:child_process'
const W = 1440, H = 900
export function metrics(file, w = W, h = H) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h}:flags=bilinear`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 29 })
  const topRows = Math.floor(h * 0.2); let n = 0, sumL = 0, litN = 0, litS = 0, topN = 0
  const hue = new Float64Array(12), top = new Uint32Array(256)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3, r = raw[i] / 255, g = raw[i + 1] / 255, b = raw[i + 2] / 255, l = 0.2126 * r + 0.7152 * g + 0.0722 * b
    n++; sumL += l
    if (y < topRows) { top[Math.round(l * 255)]++; topN++ }
    const mx = Math.max(r, g, b)
    if (mx > 0.15) { const dd = mx - Math.min(r, g, b), s = dd / mx; litN++; litS += s; if (dd > 0) { const hh = (mx === r ? ((g - b) / dd + 6) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4) * 60; hue[Math.floor(hh / 30) % 12] += s } }
  }
  let a = 0, p5 = 1; for (let i = 0; i < 256; i++) { a += top[i]; if (a / topN >= 0.05) { p5 = i / 255; break } }
  const hs = hue.reduce((p, q) => p + q, 0) || 1
  return { meanSat: +(litS / Math.max(1, litN)).toFixed(4), litFrac: +(litN / n).toFixed(3), black: +p5.toFixed(4), meanLuma: +(sumL / n).toFixed(4), hue: [...hue].map(v => +(v / hs).toFixed(3)) }
}
if (process.argv[1].endsWith('metrics.mjs')) for (const f of process.argv.slice(2)) console.log(f.split('/').slice(-1)[0].padEnd(28), JSON.stringify(metrics(f)))
