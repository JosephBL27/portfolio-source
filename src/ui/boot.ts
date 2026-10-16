// PNEUMA boot: INCOMING resolves out of block glyphs, a capsule rides a glass tube at the real
// load fraction, then the capsule vents right, the sheet is sucked into the tube, and the band
// shoots off-screen to uncover the page. Once per session; repeat visits get a 300 ms fade.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '../styles/boot.css'
import { animate, scrambleText } from 'animejs'
import { state } from '../state'
import { palette } from '../theme'
import { sound } from '../audio/sound'
import siteRaw from '../data/site.json'

const WORD = 'INCOMING'
const KEY = 'pneuma-booted'
const VENT = 'cubic-bezier(0.55, 0, 1, 0.45)'
const TUBE_W = 280, CAP_W = 28, PAD = 2
const NAME = (siteRaw as { bio: { name: string } }).bio.name

export interface BootOptions {
  /** 0..1 real load fraction, polled every frame. */
  progress: () => number
  /** Shortest full boot, so the word and capsule read (default 1100 ms). */
  minMs?: number
  /** Exit anyway after this long (default 2500 ms). */
  maxMs?: number
}

const clamp01 = (v: number) => (v > 0 ? (v < 1 ? v : 1) : 0)
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const pad3 = (n: number) => String(n).padStart(3, '0')

function booted(): boolean { try { return sessionStorage.getItem(KEY) === '1' } catch { return false } }
function markBooted() { try { sessionStorage.setItem(KEY, '1') } catch { /* private mode */ } }

function applyPalette(el: HTMLElement) {
  const p = palette(state.night)
  el.style.setProperty('--b-paper', p.paper)
  el.style.setProperty('--b-ink', p.ink)
  el.style.setProperty('--b-graphite', p.graphite)
  el.style.setProperty('--b-rule', p.rule)
  el.style.setProperty('--b-brain', p.brain)
  el.style.setProperty('--b-glass', p.glassTint)
  if (state.night) el.dataset.night = '1'
}

function shell(): HTMLElement {
  const root = document.createElement('div')
  root.className = 'pn-boot'
  root.setAttribute('role', 'progressbar')
  root.setAttribute('aria-label', 'Loading')
  root.setAttribute('aria-valuemin', '0')
  root.setAttribute('aria-valuemax', '100')
  root.setAttribute('aria-valuenow', '0')
  applyPalette(root)
  return root
}

function build() {
  const root = shell()
  const letters = [...WORD].map(c => `<span class="pn-boot-ch"><span class="w">${c}</span><span class="s">${c}</span></span>`).join('')
  root.innerHTML = `
    <div class="pn-boot-sheet"></div>
    <i class="pn-boot-mark tl"></i><i class="pn-boot-mark tr"></i><i class="pn-boot-mark bl"></i><i class="pn-boot-mark br"></i>
    <div class="pn-boot-note l" aria-hidden="true"><b>PNEUMA</b></div>
    <div class="pn-boot-note r" aria-hidden="true">${NAME}</div>
    <div class="pn-boot-stage">
      <div class="pn-boot-word" aria-hidden="true">
        <canvas class="pn-boot-shadow"></canvas>
        <span class="pn-boot-ink">${letters}<i class="pn-boot-bl"></i></span>
      </div>
      <span class="pn-boot-sr">Incoming</span>
      <div class="pn-boot-gauge">
        <div class="pn-boot-tube">
          <svg width="${TUBE_W}" height="14" viewBox="0 0 ${TUBE_W} 14" aria-hidden="true">
            <rect class="glass" x="0.5" y="0.5" width="${TUBE_W - 1}" height="13" rx="6.5"/>
            <path class="rim" d="M7 0.5H${TUBE_W - 7}M7 13.5H${TUBE_W - 7}"/>
            <path class="rim cap-l" d="M7 0.5A6.5 6.5 0 0 0 7 13.5"/>
            <path class="rim cap-r" d="M${TUBE_W - 7} 0.5A6.5 6.5 0 0 1 ${TUBE_W - 7} 13.5"/>
            <path class="glint" d="M12 3.2H${TUBE_W - 40}"/>
          </svg>
          <div class="pn-boot-cap"><i class="pn-boot-wake"></i></div>
        </div>
        <div class="pn-boot-ticks"></div>
        <div class="pn-boot-read" aria-hidden="true">
          <i class="pn-boot-lamp blink"></i><span class="lbl">PRESSURE</span><span class="num">000%</span>
        </div>
      </div>
    </div>`
  document.body.appendChild(root)
  const q = <T extends Element>(s: string) => root.querySelector(s) as T
  return {
    root,
    chars: [...root.querySelectorAll<HTMLElement>('.pn-boot-ch')],
    tube: q<HTMLElement>('.pn-boot-tube'),
    cap: q<HTMLElement>('.pn-boot-cap'),
    wake: q<HTMLElement>('.pn-boot-wake'),
    capR: q<SVGPathElement>('.cap-r'),
    num: q<HTMLElement>('.num'),
    lamp: q<HTMLElement>('.pn-boot-lamp'),
    word: q<HTMLElement>('.pn-boot-word'),
    shadow: q<HTMLCanvasElement>('.pn-boot-shadow'),
    ticks: q<HTMLElement>('.pn-boot-ticks'),
    read: q<HTMLElement>('.pn-boot-read'),
    baseline: q<HTMLElement>('.pn-boot-bl'),
  } as const
}

/**
 * Halftone shadow, the PNEUMA way: blur the letters into a tone map, then screen it with ink dots on
 * a 45 degree lattice (7 px cell) fixed to the screen, dot area following the tone. Drawn once.
 */
function drawHalftone(canvas: HTMLCanvasElement, word: HTMLElement, chars: readonly HTMLElement[], baseline: HTMLElement, ink: string) {
  const box = word.getBoundingClientRect()
  const fs = parseFloat(getComputedStyle(word).fontSize)
  if (!box.width || !fs) return
  const M = Math.ceil(fs * 0.3)
  const W = Math.ceil(box.width + M * 2), H = Math.ceil(box.height + M * 2)
  const ox = box.left - M, oy = box.top - M // canvas origin in screen space
  const dpr = Math.min(2, devicePixelRatio || 1)
  canvas.width = Math.ceil(W * dpr); canvas.height = Math.ceil(H * dpr)
  canvas.style.cssText = `left:${-M}px;top:${-M}px;width:${W}px;height:${H}px`

  // 1. tone map: the word, offset down-right and blurred, at 1x
  const tone = document.createElement('canvas')
  tone.width = W; tone.height = H
  const t = tone.getContext('2d', { willReadFrequently: true })
  if (!t) return
  const dx = Math.max(4, fs * 0.05), dy = Math.max(5, fs * 0.065)
  const by = baseline.getBoundingClientRect().top - oy
  t.font = `900 ${fs}px "Archivo Variable"`
  ;(t as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = 'extra-condensed'
  t.textAlign = 'center'; t.textBaseline = 'alphabetic'; t.fillStyle = '#000'
  t.filter = `blur(${Math.max(2.5, fs * 0.028).toFixed(1)}px)`
  for (let i = 0; i < chars.length; i++) {
    const r = chars[i].getBoundingClientRect()
    t.fillText(WORD[i], r.left - ox + r.width / 2 + dx, by + dy)
  }
  const a = t.getImageData(0, 0, W, H).data

  // 2. screen it: 45 degree lattice, nearest-neighbour spacing 7 px, anchored to the viewport
  const c = canvas.getContext('2d')
  if (!c) return
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.clearRect(0, 0, W, H)
  c.fillStyle = ink
  // 7 px cell at display sizes; finer on phones so a 74 px word still gets a real tonal ramp
  const cell = Math.max(3.6, Math.min(7, fs * 0.026)), s = cell * Math.SQRT2, half = s / 2, rMax = cell * 0.43
  c.beginPath()
  const j0 = Math.floor(oy / half), j1 = Math.ceil((oy + H) / half)
  for (let j = j0; j <= j1; j++) {
    const sy = j * half, y = sy - oy
    if (y < 0 || y >= H) continue
    const shift = (j & 1) ? half : 0
    const i0 = Math.floor((ox - shift) / s), i1 = Math.ceil((ox + W - shift) / s)
    for (let i = i0; i <= i1; i++) {
      const x = i * s + shift - ox
      if (x < 0 || x >= W) continue
      const v = a[((y | 0) * W + (x | 0)) * 4 + 3] / 255
      const r = rMax * Math.sqrt(v * 0.84)
      if (r < 0.45) continue
      c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2)
    }
  }
  c.fill()
}

/** Resolve INCOMING out of block glyphs, letter by letter from the left, in about 480 ms. */
async function scrambleWord(chars: readonly HTMLElement[]) {
  // let Archivo arrive first so the settled letters don't swap fonts mid-reveal (capped)
  await Promise.race([document.fonts?.load(`900 100px "Archivo Variable"`).catch(() => {}), wait(260)])
  const targets = chars.map(c => c.querySelector('.s') as HTMLElement)
  chars.forEach(c => c.classList.add('scr'))
  const anims = targets.map((t, i) => {
    const d = 170 + i * 44 // last letter settles at ~480 ms
    return animate(t, {
      innerHTML: scrambleText({ text: WORD[i], chars: 'blocks', settleDuration: d, settleRate: 38, seed: 7 + i * 13 }),
      duration: d,
      onComplete: () => { chars[i].classList.remove('scr'); chars[i].classList.add('done') },
    })
  })
  await Promise.all(anims.map(a => a.then(() => {})))
}

function finishInstant(chars: readonly HTMLElement[]) { chars.forEach(c => c.classList.add('done')) }

export function runBoot(opts: BootOptions): Promise<void> {
  const minMs = opts.minMs ?? 1100
  const maxMs = opts.maxMs ?? 2500
  const reduced = state.reduced
  const read = () => { try { return clamp01(opts.progress()) } catch { return 0 } }

  // ---- repeat visit in this session: paper, then a 300 ms fade ----
  if (booted()) {
    const root = shell(); document.body.appendChild(root)
    return new Promise(async resolve => {
      const t0 = performance.now()
      while (read() < 1 && performance.now() - t0 < Math.min(maxMs, 300)) await new Promise(requestAnimationFrame)
      const a = root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 200 : 300, easing: 'linear', fill: 'forwards' })
      a.finished.catch(() => {}).then(() => { root.remove(); resolve() })
    })
  }

  const ui = build()
  const { root, chars, cap, wake, capR, num, lamp } = ui
  const travel = TUBE_W - PAD * 2 - CAP_W
  let shown = 0, target = 0, lastX = 0, skip = false
  const t0 = performance.now()

  const paint = (f: number, speed: number) => {
    const x = f * travel
    cap.style.transform = `translateX(${x.toFixed(2)}px)`
    wake.style.opacity = String(Math.min(1, speed * 0.9).toFixed(3))
    const pct = Math.round(f * 100)
    num.textContent = `${pad3(pct)}%`
    root.setAttribute('aria-valuenow', String(pct))
  }

  // any press or key skips straight to the exit (content never waits on choreography)
  const onSkip = () => { skip = true }
  root.addEventListener('pointerdown', onSkip)
  addEventListener('keydown', onSkip)

  if (reduced) finishInstant(chars)
  const shade = () => drawHalftone(ui.shadow, ui.word, chars, ui.baseline, palette(state.night).ink)
  const fontsReady = Promise.race([document.fonts?.load(`900 100px "Archivo Variable"`).catch(() => {}), wait(260)])
  fontsReady.then(() => requestAnimationFrame(shade))
  let resizeT = 0
  const onResize = () => { clearTimeout(resizeT); resizeT = window.setTimeout(shade, 80) }
  addEventListener('resize', onResize)
  const wordDone = reduced ? Promise.resolve() : scrambleWord(chars).then(() => root.classList.add('landed'))
  if (reduced) root.classList.add('landed')

  return new Promise<void>(resolve => {
    let last = -1
    let exiting = false
    const loop = async (now: number) => {
      if (exiting) return
      const dt = last < 0 ? 16 : Math.max(0, Math.min(64, now - last)); last = now
      target = Math.max(target, read()) // monotone: pressure never drops
      if (reduced) shown = target
      else {
        // exponential chase with a floor speed so the last few percent never crawl
        const k = 1 - Math.exp(-dt / 110)
        shown = Math.min(target, shown + Math.max((target - shown) * k, 0.0007 * dt))
      }
      const x = shown * travel
      const speed = Math.abs(x - lastX) / Math.max(1, dt) // px per ms
      lastX = x
      paint(shown, speed)

      const elapsed = now - t0
      const full = shown >= 1 && elapsed >= minMs
      if (skip || full || elapsed >= maxMs) {
        exiting = true
        await (skip || reduced ? Promise.resolve() : Promise.race([wordDone, wait(200)]))
        finishInstant(chars)
        await exit(ui, shown, reduced, skip)
        root.removeEventListener('pointerdown', onSkip)
        removeEventListener('keydown', onSkip)
        removeEventListener('resize', onResize)
        markBooted()
        resolve()
        return
      }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })

  async function exit(u: typeof ui, f: number, reducedMotion: boolean, skipped: boolean) {
    const r = u.root
    if (reducedMotion) {
      await r.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'linear', fill: 'forwards' }).finished.catch(() => {})
      r.remove(); return
    }
    // 1. arrival: lamp lights vermilion for a beat
    r.classList.add('arrived')
    lamp.classList.remove('blink')
    if (!skipped) await wait(70)
    sound.thwoop(0.55)

    // 2. capsule vents out of the right end (380 ms), the end cap opens as it passes
    const rect = u.tube.getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    const x0 = f * travel
    const far = innerWidth - rect.left + 60
    capR.style.opacity = '0'
    const capAnim = cap.animate(
      [{ transform: `translateX(${x0}px)` }, { transform: `translateX(${far}px)` }],
      { duration: 380, easing: VENT, fill: 'forwards' })
    wake.animate([{ opacity: 0.4, width: '56px', left: '-54px' }, { opacity: 1, width: '240px', left: '-238px' }],
      { duration: 380, easing: VENT, fill: 'forwards' })

    // 3. the sheet is sucked into the tube: clip-path collapses to the 14 px band (420 ms ease-in)
    //    while the word and the readout are drawn toward the tube line and flattened into it
    const SUCK = 'cubic-bezier(0.6, 0, 0.85, 0.4)'
    const top = rect.top, bottom = innerHeight - rect.bottom
    const pull = (el: HTMLElement, squash: number) => {
      const b = el.getBoundingClientRect()
      const dy = mid - (b.top + b.height / 2)
      el.style.transformOrigin = '50% 50%'
      el.animate([{ transform: 'none' }, { transform: `translateY(${dy.toFixed(1)}px) scaleY(${squash})` }],
        { duration: 420, easing: SUCK, fill: 'forwards' })
    }
    pull(u.word, 0.05)
    pull(u.ticks, 0.3)
    pull(u.read, 0.3)
    const collapse = r.animate(
      [{ clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: `inset(${top}px 0px ${bottom}px 0px)` }],
      { duration: 420, easing: SUCK, fill: 'forwards' })
    await collapse.finished.catch(() => {})

    // 4. the band shoots right (240 ms), uncovering the page
    void capAnim
    await r.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(100vw)' }],
      { duration: 240, easing: VENT, fill: 'forwards' }).finished.catch(() => {})
    r.remove()
  }
}
