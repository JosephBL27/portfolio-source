// Prepare a Poly Haven HDRI (CC0) for the hold stop. Reads a Radiance .hdr, tonemaps it to a display-referred picture (the site writes material output straight to the
// canvas, so the backdrop must already be display values), and writes
//   - a cropped sector as WebP (the backdrop; only the part of the sky the camera can see)
//   node scripts/hdri-prep.mjs <in.hdr> <out.webp> <yawFromDeg> <yawToDeg> <elevFromDeg> <elevToDeg> [exposure=1] [maxW=4096]
// yaw 0 = the centre column of the equirect map, increasing to the right; elevation 0 = horizon.
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
const [inp, out, y0, y1, e0, e1, expo = '1', maxW = '4096'] = process.argv.slice(2)
const buf = fs.readFileSync(inp)
let p = 0, W = 0, H = 0
for (;;) { let q = buf.indexOf(10, p); const line = buf.toString('latin1', p, q); p = q + 1; const m = /-Y (\d+) \+X (\d+)/.exec(line); if (m) { H = +m[1]; W = +m[2]; break } }
const rgbe = new Uint8Array(W * H * 4)
for (let y = 0; y < H; y++) {
  if (buf[p] !== 2 || buf[p + 1] !== 2) throw new Error('flat rgbe unsupported')
  p += 4
  for (let c = 0; c < 4; c++) { let x = 0; while (x < W) { let n = buf[p++]; if (n > 128) { n -= 128; const v = buf[p++]; while (n--) rgbe[(y * W + x++) * 4 + c] = v } else { while (n--) rgbe[(y * W + x++) * 4 + c] = buf[p++] } } }
}
const px0 = Math.floor(((+y0 + 180) / 360) * W), px1 = Math.ceil(((+y1 + 180) / 360) * W)
const py0 = Math.floor((0.5 - +e1 / 180) * H), py1 = Math.ceil((0.5 - +e0 / 180) * H)
const cw = px1 - px0, ch = py1 - py0, ex = +expo
const rgb = Buffer.alloc(cw * ch * 3)
const srgb = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)
for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
  const i = ((py0 + y) * W + ((px0 + x + W) % W)) * 4, s = Math.pow(2, rgbe[i + 3] - 136)
  let r = rgbe[i] * s * ex, g = rgbe[i + 1] * s * ex, b = rgbe[i + 2] * s * ex
  // hue-preserving shoulder: compress the peak channel only, the ratios (so the colour) stay
  const m = Math.max(r, g, b, 1e-6)
  const t = m <= 0.8 ? 1 : (0.8 + (1 - 0.8) * (1 - Math.exp(-(m - 0.8) / 0.2))) / m
  const o = (y * cw + x) * 3
  rgb[o] = Math.round(255 * Math.min(1, srgb(r * t))); rgb[o + 1] = Math.round(255 * Math.min(1, srgb(g * t))); rgb[o + 2] = Math.round(255 * Math.min(1, srgb(b * t)))
}
const tmp = out + '.ppm'
fs.writeFileSync(tmp, Buffer.concat([Buffer.from(`P6\n${cw} ${ch}\n255\n`), rgb]))
const sc = cw > +maxW ? ['-vf', `scale=${maxW}:-2:flags=lanczos`] : []
const png = out + '.png'
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, ...sc, png], { stdio: 'inherit' })
spawnSync('cwebp', ['-quiet', '-q', '86', png, '-o', out], { stdio: 'inherit' })
fs.rmSync(tmp); fs.rmSync(png)
console.log(`${out}: crop ${cw}x${ch} of ${W}x${H}, ${fs.statSync(out).size} bytes`)
