// The record crate: a tray of sleeves (artwork from the iTunes Search API, resolved at build time into src/data/music.json) that the visitor
// flips through (drag, wheel, buttons, Tab) and drags UP onto the 3D platter. Physics: the strip is a native scroll-snap scroller (momentum and
// interruption come from the platform), each sleeve tilts with its distance from the centre (Cover Flow), and a lifted sleeve follows the finger
// 1:1, then either flies to the platter (a spring carrying the release velocity) or springs home. Nothing here touches audio or three.js:
// records.ts owns both and calls setCurrent / setProgress back.
import type { Track } from '../../audio/turntable'
import '../styles/crate.css'
/** w14: the strip and the flying cover show at 30-96 px, so they take the 300 px rendition (about 35 KB, not 170 KB); the 3D sleeve fetches the full artwork when a record is picked */
const thumb = (u: string) => u.replace('/600x600bb', '/300x300bb')

export type CrateState = 'none' | 'loading' | 'playing' | 'lifted' | 'ended'
export interface PlatterBox {
  x: number; y: number; rx: number; ry: number
  /** the drawn platter's outline on screen (a convex polygon, client px): the drop target is exactly this shape when it is given, the ellipse (x, y, rx, ry) otherwise */
  poly?: { x: number; y: number }[]
  /** the whole deck's footprint on screen (informational: it is no longer a drop target, the platter is) */
  deck?: { x0: number; x1: number; y0: number; y1: number }
}
export interface CrateOpts {
  picks: Track[]
  soundOn(): boolean
  turnSoundOn(): void
  /** true only when the visitor switched the site's sound off themselves this session (a page that never had sound on is not "off") */
  soundExplicitOff?(): boolean
  /** the platter's ellipse (and the deck's footprint) in screen px, or null when not on screen */
  platter(): PlatterBox | null
  onDrop(t: Track, i: number, from: DOMRect): void
  onToggleArm(): void
  reduced(): boolean
}
export interface Crate {
  el: HTMLElement
  setVisible(v: boolean): void
  setCurrent(i: number, st: CrateState): void
  setProgress(frac: number): void
  setMessage(s: string | null): void
  /** v19: the live spectrum (bins 0..1, any length) in the tray's head while a song plays, `k` = how much of the show is on (0 hides it), and the song's accent as [r, g, b] 0..1 (null = the crate's amber) */
  setSpectrum(bins: ArrayLike<number>, k: number, accent?: [number, number, number] | null): void
  dispose(): void
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n }
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))

/** a critically-tuned 2D spring carrying an initial velocity; returns a cancel function (an interruption just starts another from where it is) */
function spring2(from: { x: number; y: number }, to: { x: number; y: number }, v: { x: number; y: number }, step: (x: number, y: number) => void, done: () => void, snap: boolean) {
  if (snap) { step(to.x, to.y); done(); return () => {} }
  let x = from.x, y = from.y, vx = v.x, vy = v.y, last = performance.now(), raf = 0
  const K = 260, C = 27
  const tick = (now: number) => {
    const dt = Math.min(0.032, (now - last) / 1000); last = now
    vx += (K * (to.x - x) - C * vx) * dt; vy += (K * (to.y - y) - C * vy) * dt
    x += vx * dt; y += vy * dt
    step(x, y)
    if (Math.hypot(to.x - x, to.y - y) < 0.6 && Math.hypot(vx, vy) < 8) { step(to.x, to.y); done(); return }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

export function mountCrate(o: CrateOpts): Crate {
  const root = el('section', 'crate'); root.setAttribute('aria-label', 'Record crate')
  const head = el('div', 'cr-head')
  const specEl = el('span', 'cr-spec'); specEl.setAttribute('aria-hidden', 'true')
  const SPEC_BARS = 28, specBars: HTMLElement[] = []
  for (let i = 0; i < SPEC_BARS; i++) { const b = el('i'); specEl.append(b); specBars.push(b) }
  head.append(el('span', 'cr-kick', 'Joseph’s crate'), specEl, el('span', 'cr-hint', o.picks.length ? 'Drag a sleeve up onto the platter' : ''))
  root.append(head)
  // keep the page's own gestures out of the tray (the wheel steps the camera, a vertical drag pans the view)
  for (const t of ['wheel', 'touchstart', 'touchmove', 'pointerdown']) root.addEventListener(t, e => e.stopPropagation(), { passive: t !== 'wheel' })

  const strip = el('div', 'cr-strip'); strip.setAttribute('role', 'listbox'); strip.setAttribute('aria-label', 'Records')
  const sleeves: HTMLButtonElement[] = []
  /** PUT IT ON, or a dropped sleeve, is the gesture that turns the site's sound on (unless the visitor switched it off themselves): one click, one record playing */
  const gate = () => { if (!o.soundOn() && !(o.soundExplicitOff?.() ?? false)) o.turnSoundOn() }
  let sel = 0, cur = -1, state: CrateState = 'none'
  let navPrev: HTMLButtonElement | null = null, navNext: HTMLButtonElement | null = null
  // a quick second press while the tray is still gliding to the first one's sleeve counts from where it is going, not from where it passes
  let goal = -1, goalT = 0
  const step = (dir: -1 | 1, smooth = true) => {
    const from = goal >= 0 && performance.now() - goalT < 700 ? goal : sel, to = clamp(from + dir, 0, sleeves.length - 1)
    goal = to; goalT = performance.now()
    if (to !== sel) { sel = to; render() }
    center(to, smooth)
  }
  const info = el('div', 'cr-info')
  const tEl = el('div', 'cr-t'), aEl = el('div', 'cr-a')
  const act = el('div', 'cr-act')
  const mainBtn = el('button', 'cr-btn'); mainBtn.type = 'button'
  const armBtn = el('button', 'cr-btn ghost'); armBtn.type = 'button'
  act.append(armBtn, mainBtn)
  const bar = el('div', 'cr-bar'), barI = el('i'); bar.append(barI)
  const msg = el('div', 'cr-msg'); msg.hidden = true; msg.setAttribute('role', 'status')
  const links = el('div', 'cr-links')
  const linkLead = el('span'); linkLead.textContent = 'Listen to the full song'
  const apple = el('a'), spot = el('a')
  for (const a of [apple, spot]) { a.target = '_blank'; a.rel = 'noopener noreferrer' }
  apple.textContent = 'Apple Music'; spot.textContent = 'Spotify'
  links.append(linkLead, apple, spot)
  info.append(tEl, aEl, act, bar, msg, links)

  if (!o.picks.length) {
    // nothing to pick yet: the deck keeps playing its house record; the tray says why it is empty
    const em = el('div', 'cr-empty'); for (let i = 0; i < 5; i++) em.append(el('i'))
    const soon = el('p', 'cr-soon', 'Joseph’s picks are on their way.'); soon.append(el('small', undefined, 'The deck is spinning its house record meanwhile'))
    root.append(em, soon)
    root.setAttribute('aria-live', 'polite')
  } else {
    o.picks.forEach((p, i) => {
      const b = el('button', 'cr-sl'); b.type = 'button'; b.setAttribute('role', 'option'); b.setAttribute('aria-label', `${p.title}, ${p.artist}`)
      // the cover is always there: a generated one from the title and artist in the crate's own type, with the iTunes artwork fading in over it once it has loaded
      // (a slow or failed image never leaves a plain dark square)
      const gen = el('span', 'cr-gen'); gen.setAttribute('aria-hidden', 'true'); gen.style.setProperty('--h', String((i * 67 + 14) % 360)); gen.append(el('b', undefined, p.title), el('i', undefined, p.artist))
      const art = el('span', 'cr-art'); art.setAttribute('aria-hidden', 'true')
      b.append(gen, art)
      if (p.artwork) { const u = thumb(p.artwork), im = new Image(); im.decoding = 'async'; im.onload = () => { art.style.backgroundImage = `url("${u}")`; b.classList.add('art') }; im.src = u }
      b.addEventListener('click', e => { if (dragMoved) { e.preventDefault(); return } if (i === sel) { gate(); o.onDrop(p, i, b.getBoundingClientRect()) } else center(i, true) })
      strip.append(b); sleeves.push(b)
    })
    // arrows: every sleeve is reachable without a drag (the tray shows the centre one and about three either side)
    const nav = (dir: -1 | 1) => { const b = el('button', 'cr-nav ' + (dir < 0 ? 'prev' : 'next')); b.type = 'button'; b.setAttribute('aria-label', dir < 0 ? 'Previous record' : 'Next record'); b.append(el('i')); b.addEventListener('click', () => step(dir)); return b }
    navPrev = nav(-1); navNext = nav(1)
    root.append(navPrev, navNext)
    // keyboard inside the tray: the arrows (and Home / End) move the selection, and keep the page's own arrow keys (they step the flight) out of it
    root.addEventListener('keydown', e => {
      const k = e.key
      if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return
      e.stopPropagation(); e.preventDefault()
      if (k === 'ArrowLeft' || k === 'ArrowRight') step(k === 'ArrowRight' ? 1 : -1, false)           // a key press never animates (it is repeated hundreds of times)
      else { goal = k === 'Home' ? 0 : sleeves.length - 1; goalT = performance.now(); sel = goal; render(); center(goal, false) }
      const to = goal
      if (root.contains(document.activeElement) && document.activeElement?.classList.contains('cr-sl')) sleeves[to].focus({ preventScroll: true })
    })
    root.append(strip, info)
  }

  // ---- Cover Flow: each sleeve turns away with its distance from the centre, and the sleeves beyond the centre one and its two neighbours close up (an overlapping
  // stack, the nearer one on top), so four sleeves each side fit the tray and the ones at the ends fade out under the edge masks. Layout positions, not rects: a
  // rect already contains the transform. Runs on scroll only.
  let flowRaf = 0
  const flow = () => {
    flowRaf = 0
    const cx = strip.scrollLeft + strip.clientWidth / 2
    const step = sleeves.length > 1 ? Math.max(1, sleeves[1].offsetLeft - sleeves[0].offsetLeft) : 88
    let best = 0, bd = 1e9
    sleeves.forEach((b, i) => {
      const w = b.offsetWidth, dx = b.offsetLeft + w / 2 - cx, adx = Math.abs(dx), u = adx / step
      if (adx < bd) { bd = adx; best = i }
      if (b.classList.contains('lifted') && ghost) return
      const near = w * 1.24 + 8, far = w * 0.68                                  // the centre sleeve (x1.45) beside its neighbour (x1.03), then a tighter pace
      const vis = u <= 1 ? u * near : near + (u - 1) * far
      const tx = Math.sign(dx) * (vis - adx)
      const sc = u <= 1 ? 1.45 - 0.42 * u : Math.max(0.86, 1.03 - 0.05 * (u - 1))   // 110 px at the centre, ~78 px for the sleeves beside it, a little less beyond
      b.style.transform = o.reduced() ? `translateX(${tx.toFixed(1)}px) scale(${sc.toFixed(3)})` : `translateX(${tx.toFixed(1)}px) rotateY(${clamp(-(dx / (w * 0.875)) * 24, -48, 48)}deg) translateZ(${-Math.min(u, 3) * 14}px) scale(${sc.toFixed(3)})`
      b.style.zIndex = String(100 - Math.round(u * 10))
    })
    if (best !== sel) { sel = best; render() }
  }
  const onScroll = () => { if (!flowRaf) flowRaf = requestAnimationFrame(flow) }
  strip.addEventListener('scroll', onScroll, { passive: true })
  const center = (i: number, smooth: boolean) => { const b = sleeves[i]; if (b) strip.scrollTo({ left: b.offsetLeft + b.offsetWidth / 2 - strip.clientWidth / 2 - 0, behavior: smooth && !o.reduced() ? 'smooth' : 'auto' }) }
  // wheel (and trackpad sideways) scrolls the tray
  strip.addEventListener('wheel', e => { e.preventDefault(); strip.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY }, { passive: false })

  // ---- drag: sideways on a mouse scrolls the tray; UP lifts the sleeve under the finger onto the platter
  let dragMoved = false, ghost: HTMLElement | null = null, gp = { x: 0, y: 0 }, gv = { x: 0, y: 0 }, cancelSpring: (() => void) | null = null
  let down: { id: number; x: number; y: number; sl: number; sx: number; mode: '' | 'scroll' | 'lift'; lx: number; ly: number; lt: number; touch: boolean } | null = null
  const GW = 96
  const place = (x: number, y: number, s = 1) => { if (ghost) ghost.style.transform = `translate3d(${x - GW / 2}px, ${y - GW / 2}px, 0) scale(${s})` }
  /** inside the drawn platter (its outline when the stage gives one, else its ellipse): that, and only that, is the drop target */
  const hotOf = (x: number, y: number) => {
    const p = o.platter(); if (!p) return false
    const q = p.poly
    if (q && q.length > 2) {
      let inside = false
      for (let i = 0, j = q.length - 1; i < q.length; j = i++) if ((q[i].y > y) !== (q[j].y > y) && x < ((q[j].x - q[i].x) * (y - q[i].y)) / (q[j].y - q[i].y) + q[i].x) inside = !inside
      return inside
    }
    return ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 <= 1
  }
  strip.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !e.isPrimary || down) return
    const sl = sleeves.findIndex(b => b === (e.target as Element).closest('.cr-sl'))
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, sl, sx: strip.scrollLeft, mode: '', lx: e.clientX, ly: e.clientY, lt: performance.now(), touch: e.pointerType === 'touch' }
    dragMoved = false; cancelSpring?.()
  })
  window.addEventListener('pointermove', e => {
    const d = down; if (!d || e.pointerId !== d.id) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    const now = performance.now(), dt = Math.max(1, now - d.lt) / 1000
    gv = { x: gv.x * 0.6 + ((e.clientX - d.lx) / dt) * 0.4, y: gv.y * 0.6 + ((e.clientY - d.ly) / dt) * 0.4 }; d.lx = e.clientX; d.ly = e.clientY; d.lt = now
    if (!d.mode) {
      if (d.sl >= 0 && dy < -9 && Math.abs(dy) > Math.abs(dx) * 1.1) { d.mode = 'lift'; startLift(d.sl, e.clientX, e.clientY) }
      else if (!d.touch && Math.abs(dx) > 5) { d.mode = 'scroll'; strip.classList.add('grab'); try { strip.setPointerCapture(e.pointerId) } catch { /* gone */ } }
      else return
      dragMoved = true
    }
    if (d.mode === 'scroll') strip.scrollLeft = d.sx - dx
    else if (ghost) { gp = { x: e.clientX, y: e.clientY }; place(gp.x, gp.y, 1.08); ghost.classList.toggle('hot', hotOf(gp.x, gp.y)) }
  }, { passive: true })
  const end = (e: PointerEvent) => {
    const d = down; if (!d || e.pointerId !== d.id) return
    down = null; strip.classList.remove('grab')
    if (d.mode === 'lift' && ghost) {
      const g = ghost, i = d.sl, hot = hotOf(e.clientX, e.clientY) && e.type !== 'pointercancel', v = { x: gv.x, y: gv.y }
      const p = o.platter()
      if (hot && p) {
        gate()
        spring2(gp, { x: p.x, y: p.y }, v, (x, y) => { g.style.transform = `translate3d(${x - GW / 2}px, ${y - GW / 2}px, 0) scale(${0.92})` }, () => {
          g.remove(); if (ghost === g) ghost = null
          o.onDrop(o.picks[i], i, g.getBoundingClientRect()); sleeves[i]?.classList.remove('lifted')
        }, o.reduced())
        g.classList.add('hot')
      } else {
        const home = sleeves[i].getBoundingClientRect(), hx = home.left + home.width / 2, hy = home.top + home.height / 2
        cancelSpring = spring2(gp, { x: hx, y: hy }, v, (x, y) => { g.style.transform = `translate3d(${x - GW / 2}px, ${y - GW / 2}px, 0) scale(${0.84 + 0.24 * clamp(Math.hypot(x - hx, y - hy) / 90, 0, 1)})` }, () => {
          g.remove(); if (ghost === g) ghost = null; sleeves[i]?.classList.remove('lifted'); cancelSpring = null
        }, o.reduced())
      }
    }
    gv = { x: 0, y: 0 }
    window.setTimeout(() => { dragMoved = false }, 0)
    if (d.mode === 'scroll') { // let the scroller snap to the nearest sleeve
      requestAnimationFrame(() => center(sel, true))
    }
  }
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end)
  function startLift(i: number, x: number, y: number) {
    ghost?.remove()
    const g = el('div', 'cr-ghost'); g.setAttribute('aria-hidden', 'true')
    for (const c of Array.from(sleeves[i].querySelectorAll('.cr-gen, .cr-art'))) g.append(c.cloneNode(true))
    g.classList.toggle('art', sleeves[i].classList.contains('art'))
    document.body.append(g); ghost = g; gp = { x, y }; place(x, y, 1.08)
    sleeves[i].classList.add('lifted')
    if (i !== sel) { sel = i; render() }
  }

  // ---- the info row, rebuilt from (selected, current, state)
  function render() {
    const p = o.picks[sel]; if (!p) return
    if (navPrev && navNext) { navPrev.disabled = sel <= 0; navNext.disabled = sel >= sleeves.length - 1 }
    sleeves.forEach((b, i) => { b.classList.toggle('sel', i === sel); b.classList.toggle('cur', i === cur && state !== 'none'); b.setAttribute('aria-selected', String(i === sel)) })
    tEl.textContent = p.title; aEl.textContent = p.artist + (p.note && !/fixture/i.test(p.note) ? ` · ${p.note}` : '')
    const isCur = sel === cur && state !== 'none'
    bar.hidden = !isCur
    mainBtn.textContent = !isCur ? 'Put it on' : state === 'playing' || state === 'loading' ? 'Eject' : state === 'ended' ? 'Play again' : 'Set the needle'
    armBtn.hidden = !isCur || state === 'loading'
    armBtn.textContent = state === 'playing' ? 'Lift arm' : 'Drop arm'
    mainBtn.dataset.act = !isCur ? 'drop' : state === 'playing' || state === 'loading' ? 'eject' : 'arm'
    apple.href = p.itunesId ? `https://music.apple.com/song/${p.itunesId}` : `https://music.apple.com/search?term=${encodeURIComponent(p.title + ' ' + p.artist)}`
    spot.href = `https://open.spotify.com/search/${encodeURIComponent(p.title + ' ' + p.artist)}`
    updateMsg()
  }
  let extra: string | null = null, specHad = false
  const soundBtn = el('button', 'cr-btn'); soundBtn.type = 'button'; soundBtn.textContent = 'Turn sound on'
  soundBtn.addEventListener('click', () => { o.turnSoundOn(); window.setTimeout(updateMsg, 80) })
  function updateMsg() {
    const needSound = state !== 'none' && !o.soundOn() && (o.soundExplicitOff ? o.soundExplicitOff() : true)
    msg.replaceChildren()
    if (needSound) { msg.append(document.createTextNode('Sound is off, so the record is silent.'), soundBtn) }
    else if (extra) msg.append(document.createTextNode(extra))
    msg.hidden = !msg.childNodes.length
  }
  mainBtn.addEventListener('click', () => {
    const a = mainBtn.dataset.act, p = o.picks[sel]
    if (a === 'drop') { gate(); o.onDrop(p, sel, sleeves[sel].getBoundingClientRect()) }
    else if (a === 'eject') o.onDrop(null as unknown as Track, -1, mainBtn.getBoundingClientRect())
    else o.onToggleArm()
  })
  armBtn.addEventListener('click', () => o.onToggleArm())

  const api: Crate = {
    el: root,
    setVisible(v) { if (root.classList.contains('on') === v) return; root.classList.toggle('on', v); if (v && sleeves.length) requestAnimationFrame(() => { center(sel, false); flow() }) },
    setCurrent(i, st) { cur = i; state = st; render(); if (i >= 0 && i !== sel) center(i, true) },
    setProgress(f) { barI.style.scale = `${clamp(f, 0, 1)} 1` },
    setMessage(s) { extra = s; updateMsg() },
    setSpectrum(bins, k, accent) {
      const on = k > 0.02; if (specEl.classList.contains('on') !== on) specEl.classList.toggle('on', on)
      if (!on) { if (specHad) { specHad = false; root.style.removeProperty('--cr-acc'); root.style.removeProperty('--cr-acc2') } return }
      specHad = true
      const n = bins.length
      for (let i = 0; i < SPEC_BARS; i++) { const a = Math.floor((i / SPEC_BARS) * n), b = Math.max(a + 1, Math.floor(((i + 1) / SPEC_BARS) * n)); let m = 0; for (let j = a; j < b && j < n; j++) m = Math.max(m, bins[j]); specBars[i].style.scale = `1 ${(0.06 + 0.94 * Math.min(1, m * 1.1)).toFixed(3)}` }
      if (accent) { const c = (v: number) => Math.round(Math.min(1, v) * 255); root.style.setProperty('--cr-acc', `rgb(${c(accent[0])} ${c(accent[1])} ${c(accent[2])})`); root.style.setProperty('--cr-acc2', `rgb(${c(accent[0] * 0.4 + 0.6)} ${c(accent[1] * 0.4 + 0.6)} ${c(accent[2] * 0.4 + 0.6)})`) }
    },
    dispose() { root.remove(); ghost?.remove(); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end) },
  }
  document.body.append(root)
  render()
  const poll = window.setInterval(() => { if (root.classList.contains('on')) updateMsg() }, 600)
  const orig = api.dispose; api.dispose = () => { clearInterval(poll); orig() }
  return api
}

/** the now-playing pill: follows the visitor through the flight while a record plays (the crate hides it while the tray itself is open) */
export interface NowPlaying { el: HTMLElement; sync(t: Track | null): void; /** v19: drive the three bars from the low / mid / high bands (0..1); k = how much of the show is on */ level(low: number, mid: number, high: number, k: number): void; dispose(): void }
export function mountNowPlaying(o: { stop(): void }): NowPlaying {
  const root = el('div', 'np'); root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Now playing')
  const art = el('span', 'np-art'), eq = el('span', 'np-eq'); for (let i = 0; i < 3; i++) eq.append(el('i'))
  const txt = el('span', 'np-txt'), t = el('b'), a = el('small'); txt.append(t, a)
  const stop = el('button', 'np-stop'); stop.type = 'button'; stop.setAttribute('aria-label', 'Stop the record'); stop.append(el('i'))
  stop.addEventListener('click', () => o.stop())
  for (const ev of ['wheel', 'touchstart', 'touchmove', 'pointerdown']) root.addEventListener(ev, e => e.stopPropagation(), { passive: ev !== 'wheel' })
  root.append(art, eq, txt, stop); document.body.append(root)
  let key = ''
  return {
    el: root,
    sync(tr) {
      const crateOn = !!document.querySelector('.crate.on')
      const show = !!tr && !crateOn && !document.documentElement.classList.contains('in-index')
      if (root.classList.contains('on') !== show) root.classList.toggle('on', show)
      const k = tr ? tr.title + tr.artist : ''
      if (k !== key) { key = k; if (tr) { t.textContent = tr.title; a.textContent = tr.artist; art.style.backgroundImage = tr.artwork ? `url("${thumb(tr.artwork)}")` : '' } }
    },
    level(low, mid, high, k) {
      const live = k > 0.05; if (root.classList.contains('live') !== live) root.classList.toggle('live', live)
      if (!live) return
      const v = [low, mid, high]
      for (let i = 0; i < 3; i++) (eq.children[i] as HTMLElement).style.scale = `1 ${(0.18 + 0.82 * Math.min(1, v[i] * 1.2)).toFixed(3)}`
    },
    dispose() { root.remove() },
  }
}
