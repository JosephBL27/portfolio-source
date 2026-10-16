// WWII lab: "Who got the money?". Guess first, then reveal. The paper (src/data/projects.json, id "wwii") finds that, per resident, war contract
// dollars correlate with a county's 1940 manufacturing share at 0.69 and with its fatal burden at -0.03; at 3,073 counties the data rule out any
// link to wartime loss above 0.09 in either direction. The three kinds of investment overlap with each other at only 0.22 to 0.59, against 0.87
// for deaths and population. The visitor drags a marker on each correlation scale; a cloud of dots reshapes as they drag so the number has a
// picture. The dots are an ILLUSTRATION: 3,073 stand-in points drawn to the correlation shown, never the real counties. The visitor's guess and
// the gap between it and the paper are "your setting" and sit inside data-proof="skip".
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. Cues: lab:drag while a marker moves, hub:detent on reveal.
import './lib/model-base.css'
import './wwii.css'
import { animate } from 'animejs'
import { clamp, fitCanvas, gate, mulberry, type LabHandle, type LabOpts } from './lib/kit'

const COUNTIES = 3073
const TRUTH = { mfg: 0.69, fatal: -0.03 }
const BOUND = 0.09                            // the paper rules out any link above this, in either direction
const OVERLAP = { lo: 0.22, hi: 0.59, deaths: 0.87 }
type Key = 'mfg' | 'fatal'
const PANELS: { k: Key; title: string; x: string; y: string; q: string }[] = [
  { k: 'mfg', title: '1940 manufacturing share', x: 'county 1940 manufacturing share', y: 'war contract dollars per resident', q: 'Did war contracts follow the factories that were already there?' },
  { k: 'fatal', title: 'Fatal burden', x: 'county fatal burden', y: 'war contract dollars per resident', q: 'Did war contracts follow the places that lost the most men?' },
]
const sgn = (v: number) => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(2)

// the stand-in points: x and z standard normals (Box-Muller on a seeded stream), y = r x + sqrt(1 - r^2) z, so the sample correlation tracks r
function cloud(seed: number) {
  const rnd = mulberry(seed), xs = new Float32Array(COUNTIES), zs = new Float32Array(COUNTIES)
  for (let i = 0; i < COUNTIES; i += 2) {
    const u = Math.max(1e-9, rnd()), v = rnd(), m = Math.sqrt(-2 * Math.log(u))
    xs[i] = m * Math.cos(6.2831853 * v); if (i + 1 < COUNTIES) xs[i + 1] = m * Math.sin(6.2831853 * v)
    const u2 = Math.max(1e-9, rnd()), v2 = rnd(), m2 = Math.sqrt(-2 * Math.log(u2))
    zs[i] = m2 * Math.cos(6.2831853 * v2); if (i + 1 < COUNTIES) zs[i + 1] = m2 * Math.sin(6.2831853 * v2)
  }
  return { xs, zs }
}

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  const reduced = opts.reduced, cue = gate(opts.emit, 80)
  host.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'ml ww' + (reduced ? ' is-reduced' : '')
  root.setAttribute('data-proof', 'skip')

  root.innerHTML = `
  <header class="ml-head">
    <div><span class="ml-kicker">Interactive model <span class="ml-sim" style="margin-left:8px">Guess, then reveal</span></span><h3 class="ml-title">Who got the money?</h3></div>
    <p class="ml-note" role="note">Drag each marker to say how strongly war money tracked the thing named, from &minus;1 to +1. The dots reshape as you drag. Then reveal what the paper found.</p>
  </header>
  <div class="ml-cols ww-cols">
    ${PANELS.map(p => `
    <section class="ml-p ww-p" data-k="${p.k}" aria-label="${p.title}">
      <span class="ml-lab">${p.q}</span>
      <div class="ww-cv"><canvas aria-hidden="true"></canvas><span class="ww-ax ww-ax--y">${p.y}</span><span class="ww-ax ww-ax--x">${p.x}</span><span class="ww-unp">Drag the marker below to shape the dots</span></div>
      <div class="ww-track" tabindex="0" role="slider" aria-label="Your guess: correlation of war contracts per resident with ${p.title.toLowerCase()}" aria-valuemin="-1" aria-valuemax="1" aria-valuetext="not placed yet">
        <i class="ww-rail"></i><i class="ww-zero"></i><i class="ww-band" hidden></i>
        <span class="ww-s ww-s--l">&minus;1</span><span class="ww-s ww-s--m">0</span><span class="ww-s ww-s--r">+1</span>
        <b class="ww-mk ww-mk--you" hidden><em>you</em></b><b class="ww-mk ww-mk--paper" hidden><em></em></b>
      </div>
      <p class="ww-out ml-small" aria-live="polite">Pick a spot on the line.</p>
    </section>`).join('')}
  </div>
  <div class="ml-row ww-act">
    <button class="ml-btn ml-btn--acc ww-reveal" type="button" disabled>Reveal the paper's numbers</button>
    <div class="ml-row ww-view" role="group" aria-label="Which dots to show" hidden><button class="ml-chip" type="button" data-v="paper" aria-pressed="true">The paper</button><button class="ml-chip" type="button" data-v="guess" aria-pressed="false">Your guess</button></div>
    <button class="ml-btn ww-reset" type="button" hidden>Guess again</button>
  </div>
  <section class="ml-p ww-ovl" aria-label="How much the allocations overlap">
    <span class="ml-lab">Three allocations, one county map</span>
    <div class="ww-scale"><i class="ww-rg" style="left:${OVERLAP.lo * 100}%;width:${(OVERLAP.hi - OVERLAP.lo) * 100}%"></i>
      <b class="ww-pin ww-pin--a" style="left:${((OVERLAP.lo + OVERLAP.hi) / 2) * 100}%"><em>Investment with investment <span>${OVERLAP.lo.toFixed(2)} to ${OVERLAP.hi.toFixed(2)}</span></em></b>
      <b class="ww-pin ww-pin--b" style="left:${OVERLAP.deaths * 100}%"><em>Deaths with population <span>${OVERLAP.deaths.toFixed(2)}</span></em></b>
      <span class="ww-t" style="left:0">0</span><span class="ww-t" style="left:100%">1</span></div>
    <p class="ml-small ww-ovn">Across 3,073 counties, the three kinds of investment overlap with each other at only ${OVERLAP.lo.toFixed(2)} to ${OVERLAP.hi.toFixed(2)}, against ${OVERLAP.deaths.toFixed(2)} for deaths and population. The money did not follow one map, and it did not follow the map of loss.</p>
  </section>
  <p class="ml-small ww-fn">The dots are an illustration: ${COUNTIES.toLocaleString('en-US')} stand-in points drawn to the correlation shown, not the real counties.</p>`
  host.appendChild(root)

  interface P { k: Key; el: HTMLElement; cv: HTMLCanvasElement; track: HTMLElement; you: HTMLElement; paper: HTMLElement; band: HTMLElement; out: HTMLElement; guess: number | null; shown: number; w: number; h: number; pts: ReturnType<typeof cloud>; raf: number; anim: { cancel(): unknown } | null }
  const ps: P[] = PANELS.map((pd, i) => {
    const el = root.querySelectorAll<HTMLElement>('.ww-p')[i]
    return { k: pd.k, el, cv: el.querySelector('canvas')!, track: el.querySelector('.ww-track')!, you: el.querySelector('.ww-mk--you')!, paper: el.querySelector('.ww-mk--paper')!, band: el.querySelector('.ww-band')!, out: el.querySelector('.ww-out')!, guess: null, shown: 0, w: 0, h: 0, pts: cloud(7 + i * 131), raf: 0, anim: null }
  })
  const reveal = root.querySelector<HTMLButtonElement>('.ww-reveal')!, viewEl = root.querySelector<HTMLElement>('.ww-view')!, reset = root.querySelector<HTMLButtonElement>('.ww-reset')!
  let revealed = false, view: 'paper' | 'guess' = 'paper', dead = false
  const accent = () => getComputedStyle(root).getPropertyValue('--ml-acc').trim() || '#c3d558'

  // ---- the dots
  function draw(p: P) {
    if (!p.w) return
    const c = p.cv.getContext('2d')!, dpr = p.cv.width / p.w
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, p.w, p.h)
    const r = p.shown, s = Math.sqrt(Math.max(0, 1 - r * r)), cx = p.w / 2, cyy = p.h / 2, sx = (p.w / 2 - 8) / 3.1, sy = (p.h / 2 - 8) / 3.1
    c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, p.h); c.moveTo(0, cyy); c.lineTo(p.w, cyy); c.stroke()
    const placed = p.guess !== null || revealed
    c.fillStyle = placed ? accent() : 'rgba(255,255,255,0.35)'; c.globalAlpha = placed ? 0.42 : 0.3
    const { xs, zs } = p.pts
    for (let i = 0; i < COUNTIES; i++) c.fillRect(cx + xs[i] * sx - 1.1, cyy - (r * xs[i] + s * zs[i]) * sy - 1.1, 2.2, 2.2)
    c.globalAlpha = 1
    // the fitted line
    if (placed) { c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 3 * sx, cyy + 3 * r * sy); c.lineTo(cx + 3 * sx, cyy - 3 * r * sy); c.stroke() }
  }
  const schedule = (p: P) => { if (!p.raf) p.raf = requestAnimationFrame(() => { p.raf = 0; if (!dead) draw(p) }) }
  const setShown = (p: P, r: number, tween: boolean) => {
    p.anim?.cancel()
    if (!tween || reduced) { p.shown = r; schedule(p); return }
    const o = { r: p.shown }
    p.anim = animate(o, { r, duration: 900, ease: 'inOut(3)', onUpdate: () => { p.shown = o.r; schedule(p) }, onComplete: () => { p.shown = r; schedule(p) } })
  }
  const offs: (() => void)[] = []
  for (const p of ps) { const f = fitCanvas(p.cv, (w, h) => { p.w = w; p.h = h; draw(p) }); offs.push(f.dispose) }

  // ---- the marker on a line from -1 to +1
  const posOf = (v: number) => `calc(14px + (100% - 28px) * ${((v + 1) / 2).toFixed(4)})`   // the rail is inset 14px each side
  function paintMarks(p: P) {
    if (p.guess !== null) { p.you.hidden = false; p.you.style.left = posOf(p.guess) }
    p.track.setAttribute('aria-valuenow', p.guess === null ? '0' : String(p.guess))
    p.track.setAttribute('aria-valuetext', p.guess === null ? 'not placed yet' : `${sgn(p.guess)}`)
    if (!revealed) p.out.textContent = p.guess === null ? 'Pick a spot on the line.' : `Your guess: ${sgn(p.guess)}`
    reveal.disabled = !ps.every(q => q.guess !== null) || revealed
    if (!reveal.disabled) reveal.textContent = revealed ? 'Revealed' : "Reveal the paper's numbers"
  }
  function place(p: P, v: number) {
    p.guess = Math.round(clamp(v, -1, 1) * 100) / 100
    root.classList.add('is-started'); p.el.classList.add('is-placed')
    paintMarks(p)
    if (!revealed || view === 'guess') setShown(p, p.guess, false)
    cue('lab:drag', { param: p.k, value: (p.guess + 1) / 2 })
  }
  const valueAt = (p: P, e: PointerEvent) => { const r = p.track.getBoundingClientRect(), x = (e.clientX - r.left - 14) / Math.max(1, r.width - 28); return clamp(x, 0, 1) * 2 - 1 }
  for (const p of ps) {
    let drag = false
    p.track.addEventListener('pointerdown', e => { if (e.button) return; drag = true; p.track.setPointerCapture?.(e.pointerId); p.track.focus({ preventScroll: true }); place(p, valueAt(p, e)); e.preventDefault() })
    p.track.addEventListener('pointermove', e => { if (drag) place(p, valueAt(p, e)) })
    const end = () => { drag = false }
    p.track.addEventListener('pointerup', end); p.track.addEventListener('pointercancel', end)
    p.track.addEventListener('keydown', e => {
      const big = e.shiftKey ? 0.25 : 0.05, d: Record<string, number> = { ArrowRight: big, ArrowUp: big, ArrowLeft: -big, ArrowDown: -big, PageUp: 0.25, PageDown: -0.25 }
      let v: number | null = null
      if (e.key in d) v = (p.guess ?? 0) + d[e.key]; else if (e.key === 'Home') v = -1; else if (e.key === 'End') v = 1
      if (v === null) return
      e.preventDefault(); e.stopPropagation(); place(p, v)
    })
  }

  // ---- reveal
  function doReveal() {
    if (revealed || !ps.every(p => p.guess !== null)) return
    revealed = true; view = 'paper'
    root.classList.add('is-revealed'); reveal.hidden = true; viewEl.hidden = false; reset.hidden = false
    cue('hub:detent', { ch: 2 })
    for (const p of ps) {
      const truth = TRUTH[p.k], gap = Math.abs((p.guess as number) - truth)
      p.paper.hidden = false; p.paper.style.left = posOf(truth); (p.paper.querySelector('em') as HTMLElement).textContent = `paper ${truth < 0 ? '−' : ''}${Math.abs(truth).toFixed(2)}`
      if (p.k === 'fatal') { p.band.hidden = false; p.band.style.left = posOf(-BOUND); p.band.style.width = `calc((100% - 28px) * ${BOUND.toFixed(4)})` }
      p.out.innerHTML = `You said <b>${sgn(p.guess as number)}</b>. The paper finds <b>${truth < 0 ? '−' : ''}${Math.abs(truth).toFixed(2)}</b>: ${gap.toFixed(2)} apart.${p.k === 'fatal' ? ` At ${COUNTIES.toLocaleString('en-US')} counties the data rule out a link above ${BOUND.toFixed(2)} either way, so the shaded zone is the whole answer.` : ' Contracts went where the factories already stood.'}`
      if (!reduced) animate(p.paper, { scale: [0.4, 1], duration: 520, ease: 'out(4)' })
      setShown(p, truth, true)
    }
  }
  reveal.addEventListener('click', doReveal)
  viewEl.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.ml-chip'); if (!b) return
    view = b.dataset.v as 'paper' | 'guess'
    viewEl.querySelectorAll('.ml-chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)))
    for (const p of ps) setShown(p, view === 'paper' ? TRUTH[p.k] : (p.guess as number), true)
    cue('lab:click')
  })
  reset.addEventListener('click', () => {
    revealed = false; view = 'paper'; root.classList.remove('is-revealed', 'is-started'); reveal.hidden = false; viewEl.hidden = true; reset.hidden = true
    viewEl.querySelectorAll('.ml-chip').forEach((x, i) => x.setAttribute('aria-pressed', String(i === 0)))
    for (const p of ps) { p.guess = null; p.you.hidden = true; p.paper.hidden = true; p.band.hidden = true; p.el.classList.remove('is-placed'); setShown(p, 0, false); paintMarks(p) }
    reveal.disabled = true; ps[0].track.focus({ preventScroll: true })
  })
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && !reveal.disabled && !reveal.hidden && (e.target as HTMLElement).closest('.ww-track')) { e.preventDefault(); doReveal() } })

  for (const p of ps) paintMarks(p)
  return { dispose() { dead = true; for (const p of ps) { p.anim?.cancel(); cancelAnimationFrame(p.raf) } offs.forEach(f => f()); host.innerHTML = '' } }
}
