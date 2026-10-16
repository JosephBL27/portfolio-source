// Kinetic works index. One huge row per reel: the project name rolls on hover (Anime splitText),
// numbers scramble (Anime scrambleText), a hairline draws across and the other rows dim. A live
// preview "device" follows the cursor on a hand-integrated spring and tilts with its velocity; it
// runs the row's reel on ONE shared WebGL canvas (createReelCanvas + setReel behind a wipe).
// Keyboard focus docks the preview at the row's right. Phones get an inline live strip on tap/focus.
// Rows rise in through clip masks on scroll (Motion inView). Each row also keeps a tiny live "channel
// slot" in its left rail (one shared offscreen WebGL context, cached programs, ~15 fps, only while on
// screen); the big preview pops OUT of that slot and returns to it. Copy comes verbatim from projects.json.
import '../styles/works.css'
import { inView } from 'motion'
import { animate, scrambleText, splitText, stagger, utils, type JSAnimation, type TextSplitter } from 'animejs'
import type { ReelDef } from '../reels/types'
import { createReelCanvas, type ReelCanvas } from '../reels/mini'
import { projects, type Project } from '../data'
import { state } from '../state'
import { bus } from '../bus'

export interface WorksOptions { reels: ReelDef[]; onOpen(i: number, fromEl: HTMLElement): void }
export interface WorksHandle { dispose(): void }

interface Row {
  i: number; reel: ReelDef; p: Project | undefined; name: string
  li: HTMLLIElement; el: HTMLButtonElement; top: HTMLElement; nameEl: HTMLElement; num: HTMLElement
  fig: HTMLElement | null; screen: HTMLElement; split: TextSplitter | null; revealed: boolean; rollA: JSAnimation | null
  thumb: HTMLCanvasElement; slot: HTMLElement; cws: HTMLElement[]; cx: number[]; lift: number[]; fs: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const dash = (s: string) => s.replace(/\s-\s/g, ' – ')
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const SAFE = /^[\w\s$,.\-–/:'%+&]*$/ // only scramble plain strings (scrambleText writes innerHTML)

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}

// One character = clip wrapper > glyph (+ an identical clone parked below it). Rolling the glyph up
// by 100% swaps in the clone, which is tinted with the reel's accent.
const CHAR_TPL = '<span class="wx-cw"><span class="wx-c" data-char="{i}">{value}<span class="wx-cc" aria-hidden="true">{value}</span></span></span>'


// ---------- channel slots: every row keeps a tiny live screen -------------------------------------------
// One offscreen WebGL context holds every reel's program (compiled lazily, one per frame, so nothing hitches).
// Only slots that are on screen are drawn, ~15 fps, each copied into its row's 2D canvas. Reduced motion or
// "pause the system" freezes them on a poster frame. The big preview card keeps its own runner (mini.ts).
const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'
interface Slots { dispose(): void; poke(): void }
function createSlots(rows: Row[]): Slots | null {
  const gc = document.createElement('canvas')
  gc.width = 288; gc.height = 180
  const gl = gc.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false }) as WebGL2RenderingContext | null
  if (!gl) return null
  const buf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }
  const progs: (Prog | null | undefined)[] = rows.map(() => undefined)
  const ctxs = rows.map(r => r.thumb.getContext('2d'))
  const posterT = rows.map((_, i) => 3.2 + i * 1.3) // a rich-looking moment of each reel, not t = 0
  const drawn = new Set<number>()
  const vis = new Set<number>()
  const t0 = performance.now()
  let alive = true, raf = 0, lastDraw = 0

  const build = (src: string, type: number) => {
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src); gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn('[works] slot shader', gl.getShaderInfoLog(sh)); return null }
    return sh
  }
  function ensure(i: number) {
    if (progs[i] !== undefined) return progs[i]
    const vs = build(VERT, gl!.VERTEX_SHADER), fs = build(rows[i].reel.frag, gl!.FRAGMENT_SHADER)
    if (!vs || !fs) return (progs[i] = null)
    const p = gl!.createProgram()!
    gl!.attachShader(p, vs); gl!.attachShader(p, fs); gl!.bindAttribLocation(p, 0, 'p'); gl!.linkProgram(p)
    if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) { console.warn('[works] slot link', gl!.getProgramInfoLog(p)); return (progs[i] = null) }
    gl!.deleteShader(vs); gl!.deleteShader(fs)
    const u: Record<string, WebGLUniformLocation | null> = {}
    for (const n of ['uTime', 'uRes', 'uMouse', 'uNight', 'uSeed', 'uIntensity']) u[n] = gl!.getUniformLocation(p, n)
    return (progs[i] = { p, u })
  }
  function sizeOf(c: HTMLCanvasElement) {
    const d = Math.min(devicePixelRatio || 1, 2)
    const w = Math.max(2, Math.round(c.clientWidth * d)), h = Math.max(2, Math.round(c.clientHeight * d))
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
  }
  function drawOne(i: number, now: number) {
    const pr = progs[i], c2 = ctxs[i], c = rows[i].thumb
    if (!pr || !c2) return
    sizeOf(c)
    const moving = !state.reduced && !state.paused
    const t = posterT[i] + (moving ? (now - t0) / 1000 : 0)
    gl!.viewport(0, 0, gc.width, gc.height)
    gl!.useProgram(pr.p)
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buf)
    gl!.enableVertexAttribArray(0)
    gl!.vertexAttribPointer(0, 2, gl!.FLOAT, false, 0, 0)
    gl!.uniform1f(pr.u.uTime, t)
    gl!.uniform2f(pr.u.uRes, gc.width, gc.height)
    gl!.uniform2f(pr.u.uMouse, 0.5, 0.5)
    gl!.uniform1f(pr.u.uNight, state.night ? 1 : 0)
    gl!.uniform1f(pr.u.uSeed, 0.31 + i * 0.11)
    gl!.uniform1f(pr.u.uIntensity, 0.85)
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)
    // cover-fit the 8:5 frame into the slot
    const ar = c.width / c.height, sa = gc.width / gc.height
    let sw = gc.width, sh = gc.height
    if (ar > sa) sh = gc.width / ar; else sw = gc.height * ar
    c2.drawImage(gc, (gc.width - sw) / 2, (gc.height - sh) / 2, sw, sh, 0, 0, c.width, c.height)
    drawn.add(i)
  }
  function tick(now: number) {
    raf = 0
    if (!alive || document.hidden || !vis.size) return
    for (const i of vis) if (progs[i] === undefined) { ensure(i); break } // at most one compile per frame
    const live = !state.reduced && !state.paused
    const fresh = [...vis].some(i => !drawn.has(i))
    if (fresh || (live && now - lastDraw >= 64)) {
      lastDraw = now
      for (const i of vis) { if (progs[i] === undefined) continue; if (live || !drawn.has(i)) drawOne(i, now) }
    }
    if (live || [...vis].some(i => progs[i] === undefined || !drawn.has(i))) raf = requestAnimationFrame(tick)
  }
  const kick = () => { if (!raf && alive) raf = requestAnimationFrame(tick) }
  const idx = new Map<Element, number>(rows.map((r, i) => [r.thumb, i]))
  const io = new IntersectionObserver(es => {
    for (const e of es) { const i = idx.get(e.target)!; if (e.isIntersecting) vis.add(i); else vis.delete(i) }
    kick()
  }, { rootMargin: '120px 0px' })
  rows.forEach(r => io.observe(r.thumb))
  const onVis = () => kick()
  document.addEventListener('visibilitychange', onVis)
  return {
    poke: kick,
    dispose() {
      alive = false; cancelAnimationFrame(raf); io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

export function initWorks(root: HTMLElement, opts: WorksOptions): WorksHandle {
  const reels = opts.reels.slice()
  const total = reels.length
  const anim = !state.reduced
  const cleanups: (() => void)[] = []
  root.classList.add('wx')
  root.classList.toggle('wx-anim', anim)
  root.innerHTML = ''
  if (!root.getAttribute('aria-label') && !root.getAttribute('aria-labelledby')) root.setAttribute('aria-labelledby', 'wx-title')

  // ---------- header ----------
  const head = h('header', 'wx-head')
  const kicker = h('h2', 'wx-kicker'); kicker.id = 'wx-title'
  kicker.append(h('span', 'wx-kdot'), h('span', '', 'Index'))
  const hint = h('p', 'wx-hint')
  const count = h('p', 'wx-count'); count.setAttribute('aria-hidden', 'true')
  const cur = h('span', 'wx-count-cur', '—')
  const ticks = h('span', 'wx-ticks')
  for (let k = 0; k < total; k++) ticks.append(h('i'))
  count.append(ticks, cur, h('span', 'wx-count-sep', ' / '), h('span', 'wx-count-tot', pad(total)))
  head.append(kicker, hint, count)

  // ---------- rows ----------
  const list = h('ol', 'wx-list')
  const rows: Row[] = reels.map((reel, i) => {
    const p = projects.find(q => q.id === reel.projectId)
    const name = p?.name ?? reel.title
    const li = h('li', 'wx-item'); li.style.setProperty('--i', String(i))
    const el = h('button', 'wx-row'); el.type = 'button'; el.dataset.i = String(i)
    el.style.setProperty('--wx-accent', reel.colors.accent)
    const label = [name, p ? `${p.kind}, ${p.period}` : '', p ? `${p.keyFigure.value} ${p.keyFigure.label}` : '', `Reel: ${reel.title}`].filter(Boolean).join('. ')
    el.setAttribute('aria-label', label)

    const glow = h('span', 'wx-glow'); glow.setAttribute('aria-hidden', 'true')
    const rail = h('span', 'wx-rail'); rail.setAttribute('aria-hidden', 'true')
    const num = h('span', 'wx-num', pad(i + 1))
    const slot = h('span', 'wx-thumb')
    const thumb = h('canvas', 'wx-thumb-c')
    slot.append(thumb, h('span', 'wx-crt'))
    rail.append(num, slot)
    const body = h('span', 'wx-body'); body.setAttribute('aria-hidden', 'true')
    const top = h('span', 'wx-top')
    const nameEl = h('span', 'wx-name', name)
    const go = h('span', 'wx-go')
    go.innerHTML = '<span>Open</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9 9 3M4 3h5v5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>'
    top.append(nameEl, go)

    const meta = h('span', 'wx-meta')
    const mReel = h('span', 'wx-m wx-reel')
    mReel.append(h('span', 'wx-reel-t', reel.title), h('span', 'wx-reel-m', reel.medium))
    const mKind = h('span', 'wx-m wx-kind')
    if (p) {
      const lamp = h('i', 'wx-lamp'); lamp.dataset.s = p.status
      mKind.append(lamp, h('span', '', p.kind), h('span', 'wx-sep', '·'), h('span', '', dash(p.period)))
    }
    const mFig = h('span', 'wx-m wx-fig')
    let fig: HTMLElement | null = null
    if (p) {
      fig = h('span', 'wx-fig-v', p.keyFigure.value)
      mFig.append(fig, h('span', 'wx-fig-l', p.keyFigure.label))
    }
    meta.append(mReel, mKind, mFig)

    // phone: inline live strip (the shared canvas is moved in here while the row is active)
    const strip = h('span', 'wx-strip')
    const stripIn = h('span', 'wx-strip-in')
    const screen = h('span', 'wx-strip-screen')
    screen.append(h('span', 'wx-crt'))
    const stripCap = h('span', 'wx-strip-cap')
    stripCap.append(h('span', '', `CH ${pad(i + 1)} · ${reel.title}`), h('span', 'wx-strip-open', 'Tap again to open ↗'))
    stripIn.append(screen, stripCap)
    strip.append(stripIn)

    body.append(top, meta, strip)
    const rule = h('span', 'wx-rule'); rule.setAttribute('aria-hidden', 'true')
    el.append(glow, rail, body, rule)
    li.append(el)
    list.append(li)
    return { i, reel, p, name, li, el, top, nameEl, num, fig, screen, split: null, revealed: !anim, rollA: null, thumb, slot, cws: [], cx: [], lift: [], fs: 100 }
  })
  root.append(head, list)

  // ---------- the preview device (body-level so no ancestor transform or overflow can trap it) ----------
  const card = h('div', 'wx-card'); card.setAttribute('aria-hidden', 'true')
  const cardIn = h('div', 'wx-card-in')
  const cScreen = h('div', 'wx-screen')
  const canvas = h('canvas', 'wx-canvas')
  const osd = h('span', 'wx-osd', 'CH 01')
  const snap = h('canvas', 'wx-snap') // the outgoing frame, clipped away over the incoming reel
  const sctx = snap.getContext('2d')
  const edge = h('span', 'wx-edge')
  cScreen.append(canvas, snap, h('span', 'wx-crt'), h('span', 'wx-glare'), osd, edge)
  const cap = h('div', 'wx-cap')
  const capT = h('span', 'wx-cap-t', reels[0]?.title ?? '')
  const capR = h('span', 'wx-cap-r')
  capR.innerHTML = '<span class="wx-cap-live"></span><span>Real-time</span>'
  cap.append(capT, capR)
  cardIn.append(cScreen, cap)
  // the plate under the device: the project's one-line description + role, set word by word
  const plate = h('div', 'wx-plate')
  const plateL = h('p', 'wx-plate-l'), plateR = h('p', 'wx-plate-r')
  plate.append(plateL, plateR)
  card.append(cardIn, plate)
  document.body.append(card)
  const rc: ReelCanvas | null = reels.length ? createReelCanvas(canvas, reels[0], { dpr: 1.5, intensity: 0.8 }) : null
  let canvasHome: 'card' | number = 'card'

  let active = -1, lastRow = 0 // declared before the split: its effect reads `active` the moment it runs
  // ---------- split names (Anime splitText). Effects re-run on any re-split, so state survives. ----------
  for (const r of rows) {
    r.split = splitText(r.nameEl, { words: { class: 'wx-w' }, chars: CHAR_TPL, accessible: false })
    r.split.addEffect(({ chars }: { chars: HTMLElement[] }) => {
      r.cws = chars.map(c => c.parentElement as HTMLElement); r.cx = []; r.lift = chars.map(() => 0)
      if (!r.revealed) utils.set(chars, { y: '110%' })
      else if (r.i === active) utils.set(chars, { y: '-100%' })
    })
  }

  // ---------- channel slots ----------
  const slots = createSlots(rows)
  if (!slots) root.classList.add('wx-noslots')

  // ---------- fit: same size for every name; overlong names condense on the wdth axis, then wrap ----------
  const meas = h('span', 'wx-name wx-meas'); meas.setAttribute('aria-hidden', 'true')
  rows[0]?.top.append(meas)
  function fit() {
    for (const r of rows) {
      const avail = r.top.clientWidth
      if (!avail) continue
      const width = (s: number) => { meas.style.fontStretch = s + '%'; meas.textContent = r.name; return meas.getBoundingClientRect().width * 1.04 }
      // condense down to wdth 80 to stay on one line; past that, wrap instead (legibility wins)
      let s = 100, wraps = false
      if (width(100) > avail) {
        if (width(80) > avail) { s = 94; wraps = true }
        else {
          let lo = 80, hi = 100
          for (let k = 0; k < 7; k++) { const mid = (lo + hi) / 2; if (width(mid) > avail) hi = mid; else lo = mid }
          s = Math.floor(lo)
        }
      }
      r.nameEl.style.fontStretch = s + '%'
      r.nameEl.classList.toggle('is-wrap', wraps)
      r.cx = []
    }
  }
  fit()
  // the wdth axis only measures true once the variable font is in: refit on every font event
  document.fonts?.load('560 100px "Archivo Variable"').then(fit).catch(() => {})
  document.fonts?.ready.then(fit).catch(() => {})
  document.fonts?.addEventListener?.('loadingdone', fit)
  cleanups.push(() => document.fonts?.removeEventListener?.('loadingdone', fit))
  const ro = new ResizeObserver(() => { fit(); measureCard() })
  ro.observe(root)
  cleanups.push(() => ro.disconnect())

  // ---------- modes ----------
  const touchMQ = matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)')
  let touch = touchMQ.matches
  const setHint = () => { hint.textContent = touch ? 'Tap to preview, tap again to open' : 'Hover to preview, click to open' }
  setHint()
  const onMQ = () => { setActive(-1); touch = touchMQ.matches; setHint(); root.classList.toggle('wx-touch', touch) }
  root.classList.toggle('wx-touch', touch)
  touchMQ.addEventListener('change', onMQ)
  cleanups.push(() => touchMQ.removeEventListener('change', onMQ))

  // ---------- active row ----------
  let mode: 'cursor' | 'dock' = 'cursor'
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, seen: false }

  const running = new WeakMap<HTMLElement, JSAnimation>()
  function scramble(el: HTMLElement, text: string, chars: string, delay = 0) {
    running.get(el)?.cancel()
    if (!anim || !SAFE.test(text)) { el.textContent = text; return }
    running.set(el, animate(el, { innerHTML: scrambleText({ text, chars, settleDuration: 260, revealRate: 40, delay }) }))
  }
  // figures: only the digits tumble, settling left to right ("about $" stays put)
  function digits(el: HTMLElement, text: string, delay = 0) {
    running.get(el)?.cancel()
    if (!anim) { el.textContent = text; return }
    const glyphs = [...text]
    const slots = glyphs.map((c, k) => (/\d/.test(c) ? k : -1)).filter(k => k >= 0)
    const o = { p: 0 }
    running.set(el, animate(o, {
      p: 1, duration: 420 + slots.length * 40, delay, ease: 'linear',
      onUpdate: () => {
        const settled = Math.floor(o.p * (slots.length + 2)) - 2
        el.textContent = glyphs.map((c, k) => { const j = slots.indexOf(k); return j < 0 || j <= settled ? c : String((Math.random() * 10) | 0) }).join('')
      },
      onComplete: () => { el.textContent = text },
    }))
  }

  function roll(r: Row, on: boolean) {
    const chars = (r.split?.chars ?? []) as HTMLElement[]
    if (!chars.length || !r.revealed) return
    r.rollA?.cancel()
    if (!anim) { utils.set(chars, { y: on ? '-100%' : '0%' }); return }
    r.rollA = animate(chars, on
      ? { y: '-100%', duration: 760, delay: stagger(17), ease: 'out(4)' }
      : { y: '0%', duration: 560, delay: stagger(9, { from: 'last' }), ease: 'inOut(3)' })
  }

  function setActive(i: number, how: 'cursor' | 'dock' | 'tap' = 'cursor') {
    if (how !== 'tap') mode = how
    if (i === active) return
    const prev = rows[active]
    if (prev) { prev.el.classList.remove('is-active'); prev.li.classList.remove('is-active'); roll(prev, false) }
    active = i
    if (i >= 0) lastRow = i
    root.classList.toggle('has-active', i >= 0)
    ticks.querySelectorAll('i').forEach((t, k) => t.classList.toggle('on', k === i))
    const r = rows[i]
    if (!r) {
      cur.textContent = '—'
      if (touch) parkCanvasSoon()
      kick()
      return
    }
    r.el.classList.add('is-active'); r.li.classList.add('is-active')
    roll(r, true)
    scramble(r.num, pad(i + 1), '0-9')
    if (r.fig && r.p) digits(r.fig, r.p.keyFigure.value, 60)
    scramble(cur, pad(i + 1), '0-9')
    card.style.setProperty('--wx-accent', r.reel.colors.accent)
    if (!touch) setPlate(r)
    if (touch) {
      moveCanvas(i)
      rc?.setReel(r.reel)
    } else {
      changeReel(r)
    }
    kick()
  }

  // ---------- plate: the description sets itself word by word, each word rising out of a clip ----------
  let plateA: Animation[] = []
  function setPlate(r: Row) {
    plateA.forEach(a => a.cancel()); plateA = []
    plateL.textContent = ''; plateR.textContent = ''
    if (!r.p) return
    const words = r.p.line.split(/\s+/)
    const spans: HTMLElement[] = words.map(w => {
      const o = h('span', 'wx-pw'), n = h('span', '', w)
      o.append(n)
      plateL.append(o, document.createTextNode(' '))
      return n
    })
    plateR.textContent = r.p.role
    if (!anim) return
    spans.forEach((n, k) => plateA.push(n.animate([{ transform: 'translateY(110%)' }, { transform: 'none' }], { duration: 640, delay: 90 + k * 16, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' })))
    plateA.push(plateR.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 220 + words.length * 16, easing: 'ease-out', fill: 'backwards' }))
  }

  // ---------- reel swap: freeze the outgoing frame on a 2D canvas, swap the shader underneath, then
  // clip the frozen frame away (up when moving down the list, down when moving up) behind a lit edge ----------
  let lastReel = -1
  let wipeA: Animation[] = []
  function changeReel(r: Row) {
    if (canvasHome !== 'card') moveCanvas('card')
    const title = r.reel.title
    const visible = sp.s > 0.35 && card.style.display !== 'none'
    wipeA.forEach(a => a.cancel()); wipeA = []
    osd.textContent = `CH ${pad(r.i + 1)}`
    if (!visible || !anim || !sctx || canvas.width < 4) {
      snap.style.visibility = 'hidden'; edge.style.visibility = 'hidden'
      rc?.setReel(r.reel); capT.textContent = title; lastReel = r.i
      return
    }
    if (snap.width !== canvas.width || snap.height !== canvas.height) { snap.width = canvas.width; snap.height = canvas.height }
    rc?.draw() // fresh frame in the drawing buffer; still readable within this task
    sctx.drawImage(canvas, 0, 0)
    rc?.setReel(r.reel)
    const down = r.i > lastReel
    lastReel = r.i
    const H = cScreen.clientHeight
    const ease = 'cubic-bezier(.7, 0, .2, 1)', duration = 620
    snap.style.visibility = 'visible'; edge.style.visibility = 'visible'
    edge.style.background = r.reel.colors.accent
    wipeA = [
      snap.animate(down ? [{ clipPath: 'inset(0 0 0% 0)' }, { clipPath: 'inset(0 0 100% 0)' }] : [{ clipPath: 'inset(0% 0 0 0)' }, { clipPath: 'inset(100% 0 0 0)' }], { duration, easing: ease, fill: 'forwards' }),
      edge.animate(down ? [{ transform: `translateY(${H}px)` }, { transform: 'translateY(-2px)' }] : [{ transform: 'translateY(-2px)' }, { transform: `translateY(${H}px)` }], { duration, easing: ease, fill: 'forwards' }),
      edge.animate([{ opacity: 1 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration, fill: 'forwards' }),
    ]
    wipeA[0].onfinish = () => { snap.style.visibility = 'hidden' }
    scramble(capT, title, 'A-Z')
  }

  function moveCanvas(to: 'card' | number) {
    if (to === canvasHome) return
    canvasHome = to
    if (to === 'card') cScreen.prepend(canvas)
    else rows[to].screen.prepend(canvas)
  }
  let parkT = 0
  function parkCanvasSoon() {
    clearTimeout(parkT)
    parkT = window.setTimeout(() => { if (active < 0) moveCanvas('card') }, 650)
  }
  cleanups.push(() => clearTimeout(parkT))

  // ---------- spring follow + velocity tilt (one rAF loop, also drives the scroll skew) ----------
  let CW = 380, CH = 240
  function measureCard() {
    const d = card.style.display; card.style.display = 'block'
    CW = card.offsetWidth || 380; CH = card.offsetHeight || 240
    card.style.setProperty('--wx-ch', CH + 'px')
    card.style.display = d
  }
  card.style.display = 'none'
  measureCard()
  const sp = { x: 0, y: 0, vx: 0, vy: 0, s: 0, vs: 0, rz: 0 }
  let raf = 0, last = 0, lastScroll = scrollY, skew = 0, skewV = 0, alive = true, lastDx = 0

  const PLATE = 104, TOP = 66 // the description hangs under the device (above it when the device is low); keep it on screen
  let plateUp = false
  const slotAt = (r: Row | undefined): [number, number] | null => {
    if (!r) return null
    const b = r.slot.getBoundingClientRect()
    return b.width ? [b.left + b.width / 2, b.top + b.height / 2] : null
  }
  function target(): [number, number] {
    const r = rows[active]
    if (!r) return slotAt(rows[lastRow]) ?? [sp.x, sp.y] // letting go: the screen returns to its slot
    if (mode === 'dock') {
      const b = r.top.getBoundingClientRect()
      return [b.right - CW / 2 - 4, clamp(b.top + b.height / 2, CH / 2 + TOP, innerHeight - CH / 2 - (plateUp ? 14 : PLATE + 8))]
    }
    const side = mouse.x > innerWidth - (CW + 90) ? -1 : 1
    return [mouse.x + side * (CW / 2 + 34), clamp(mouse.y - CH * 0.1, CH / 2 + TOP, innerHeight - CH / 2 - (plateUp ? 14 : PLATE + 8))]
  }

  // the preview pops OUT of the hovered row's slot (and flies back into it on leave)
  function show() {
    if (card.style.display !== 'none') return
    const [tx, ty] = target()
    const o = anim ? slotAt(rows[active]) : null
    sp.x = o ? o[0] : tx; sp.y = o ? o[1] : ty; sp.vx = sp.vy = 0; sp.s = anim ? (o ? 0.18 : 0.55) : 1; sp.vs = 0
    card.style.display = 'block'
  }

  function frame(now: number) {
    raf = 0
    if (!alive) return
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60)
    last = now
    let busy = false
    const want = !touch && active >= 0
    if (want) show()

    if (card.style.display !== 'none') {
      const [tx, ty] = target()
      const ts = want ? 1 : 0
      if (!anim) {
        sp.x = tx; sp.y = ty; sp.s = ts; sp.vx = sp.vy = 0
      } else {
        // semi-implicit Euler in fixed substeps: position k=210 c=23 (ζ≈.8), scale k=330 c=21 (a small pop)
        const n = Math.max(1, Math.ceil(dt / (1 / 240))), h2 = dt / n
        for (let k = 0; k < n; k++) {
          sp.vx += (210 * (tx - sp.x) - 23 * sp.vx) * h2; sp.x += sp.vx * h2
          sp.vy += (210 * (ty - sp.y) - 23 * sp.vy) * h2; sp.y += sp.vy * h2
          sp.vs += (330 * (ts - sp.s) - 21 * sp.vs) * h2; sp.s += sp.vs * h2
        }
      }
      const base = active >= 0 ? [-2.2, 1.6, -1.1, 2.4, -1.8, 1.2][active % 6] : 0
      sp.rz += ((anim ? base : 0) - sp.rz) * (1 - Math.exp(-dt * 8))
      const rz = clamp(sp.vx * 0.006, -11, 11) + sp.rz
      const ry = clamp(sp.vx * 0.013, -24, 24)
      const rx = clamp(-sp.vy * 0.013, -18, 18)
      const s = Math.max(0, sp.s)
      card.style.transform = `translate3d(${(sp.x - CW / 2).toFixed(1)}px, ${(sp.y - CH / 2).toFixed(1)}px, 0) perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${s.toFixed(3)})`
      card.style.opacity = String(clamp(s * 1.6 - 0.2, 0, 1))
      const up = sp.y > innerHeight * (plateUp ? 0.5 : 0.6)
      if (up !== plateUp) { plateUp = up; card.classList.toggle('plate-up', up); plate.classList.remove('flip'); void plate.offsetWidth; plate.classList.add('flip') }
      card.style.setProperty('--glare', `${(50 - ry * 2.2).toFixed(1)}%`)
      canvas.style.setProperty('--px', `${(-ry * 0.5).toFixed(2)}px`); canvas.style.setProperty('--py', `${(rx * 0.5).toFixed(2)}px`)
      rc?.setMouse(clamp(sp.x / innerWidth, 0, 1), clamp(1 - sp.y / innerHeight, 0, 1))
      // the screen lights the row under it
      const r = rows[active]
      if (r) {
        const b = r.el.getBoundingClientRect()
        r.el.style.setProperty('--gx', `${(sp.x - b.left).toFixed(0)}px`)
        r.el.style.setProperty('--gy', `${(sp.y - b.top).toFixed(0)}px`)
      }
      const settled = Math.abs(sp.vx) + Math.abs(sp.vy) < 2 && Math.abs(sp.x - tx) + Math.abs(sp.y - ty) < 0.5 && Math.abs(sp.s - ts) < 0.002
      if (!want && (sp.s < 0.04 || !anim)) { card.style.display = 'none'; sp.s = 0 }
      else busy = !settled
    }

    // the active name ripples under the pointer: letters near it lift and stretch a little
    if (anim) {
      for (const r of rows) {
        const on = r.i === active && mode === 'cursor' && !touch
        if (!on && !r.lift.some(v => v > 0.002)) continue
        if (!r.cx.length && r.cws.length) {
          const l0 = r.li.getBoundingClientRect().left
          r.cx = r.cws.map(w => { const b = w.getBoundingClientRect(); return b.left + b.width / 2 - l0 })
          r.fs = parseFloat(getComputedStyle(r.nameEl).fontSize) || 100
        }
        const mx = mouse.x - r.li.getBoundingClientRect().left, sig = r.fs * 0.95, k = 1 - Math.exp(-dt * 16)
        let any = false
        for (let c = 0; c < r.cws.length; c++) {
          const goal = on ? Math.exp(-(((mx - r.cx[c]) / sig) ** 2)) : 0
          r.lift[c] += (goal - r.lift[c]) * k
          const v = r.lift[c] < 0.002 ? 0 : r.lift[c]
          if (v) any = true
          r.cws[c].style.transform = v ? `translateY(${(-v * 0.085).toFixed(4)}em) scaleY(${(1 + v * 0.06).toFixed(4)})` : ''
        }
        if (any || on) busy = true
      }
    }

    // scroll-velocity skew on the names (subtle, springs back)
    if (anim) {
      const y = scrollY, v = (y - lastScroll) / Math.max(dt, 1 / 240)
      lastScroll = y
      const goal = clamp(-v * 0.0011, -2.6, 2.6)
      skewV += (180 * (goal - skew) - 22 * skewV) * dt
      skew += skewV * dt
      if (Math.abs(skew) < 0.005 && Math.abs(goal) < 0.005) { skew = 0; skewV = 0 } else busy = true
      root.style.setProperty('--wx-skew', `${skew.toFixed(3)}deg`)
      // alternate rows slide opposite ways while the page moves, like a shuffled deck
      const dx = clamp(skew * 7, -18, 18)
      if (dx !== lastDx) { lastDx = dx; for (const r of rows) r.li.style.setProperty('--wx-dx', `${(r.i % 2 ? dx : -dx).toFixed(2)}px`) }
    }
    if (busy && !document.hidden) raf = requestAnimationFrame(frame)
    else last = 0
  }
  function kick() { if (!raf && alive) { raf = requestAnimationFrame(frame) } }

  // ---------- input ----------
  const rowAt = (x: number, y: number) => {
    const e = document.elementFromPoint(x, y)
    const b = e?.closest?.('.wx-row') as HTMLElement | null
    return b && list.contains(b) ? Number(b.dataset.i) : -1
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || touch) return
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.seen = true
    const b = (e.target as Element).closest?.('.wx-row') as HTMLElement | null
    setActive(b ? Number(b.dataset.i) : -1, 'cursor')
    kick()
  }
  const onLeave = (e: PointerEvent) => { if (e.pointerType === 'touch' || touch) return; mouse.seen = false; if (mode === 'cursor') setActive(-1) }
  list.addEventListener('pointermove', onMove)
  list.addEventListener('pointerleave', onLeave)
  const onScroll = () => {
    if (!touch && mouse.seen && mode === 'cursor') setActive(rowAt(mouse.x, mouse.y), 'cursor')
    kick()
  }
  addEventListener('scroll', onScroll, { passive: true })
  const onWinLeave = () => { mouse.seen = false; if (mode === 'cursor' && !touch) setActive(-1) }
  document.documentElement.addEventListener('pointerleave', onWinLeave)
  cleanups.push(() => {
    list.removeEventListener('pointermove', onMove); list.removeEventListener('pointerleave', onLeave)
    removeEventListener('scroll', onScroll); document.documentElement.removeEventListener('pointerleave', onWinLeave)
  })

  // the case view grows out of the screen the visitor was looking at: hand it a pinned rect of the preview
  function openFrom(r: Row): HTMLElement {
    const src = touch ? r.screen : cScreen
    const b = src.getBoundingClientRect()
    if (b.width < 8 || (!touch && (card.style.display === 'none' || sp.s < 0.5))) return r.el
    const g = h('div'); g.setAttribute('aria-hidden', 'true')
    g.style.cssText = `position:fixed;left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px;pointer-events:none;visibility:hidden`
    document.body.append(g)
    setTimeout(() => g.remove(), 1500)
    return g
  }
  for (const r of rows) {
    r.el.addEventListener('click', () => {
      if (touch && active !== r.i) { setActive(r.i, 'tap'); return }
      const from = openFrom(r)
      setActive(-1)
      opts.onOpen(r.i, from)
    })
    r.el.addEventListener('focus', () => {
      if (!r.el.matches(':focus-visible')) return
      setActive(r.i, touch ? 'tap' : 'dock')
    })
    r.el.addEventListener('blur', () => {
      setTimeout(() => {
        const a = document.activeElement as HTMLElement | null
        if (!a?.classList?.contains('wx-row') && (mode === 'dock' || touch) && active === r.i) setActive(-1)
      }, 0)
    })
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && active >= 0) setActive(-1) }
  root.addEventListener('keydown', onKey)
  cleanups.push(() => root.removeEventListener('keydown', onKey))

  // ---------- scroll-in: clip-mask rise, staggered across rows that enter together ----------
  let nextAt = 0
  const queue = (fn: () => void) => {
    const now = performance.now(), at = Math.max(now, nextAt)
    nextAt = at + 120
    setTimeout(() => alive && fn(), at - now)
  }
  function reveal(r: Row) {
    if (r.revealed) return
    r.revealed = true
    r.li.classList.add('is-in')
    r.slot.animate([
      { clipPath: 'inset(0 0 100% 0)', transform: 'translateY(16px) scale(.96)', opacity: 0 },
      { clipPath: 'inset(0 0 0% 0)', transform: 'none', opacity: 1 },
    ], { duration: 1150, delay: 320, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' })
    const chars = (r.split?.chars ?? []) as HTMLElement[]
    r.rollA = animate(chars, { y: ['110%', active === r.i ? '-100%' : '0%'], duration: 1100, delay: stagger(20), ease: 'out(4)' })
    const txt = pad(r.i + 1)
    r.num.textContent = ''
    scramble(r.num, txt, '0-9', 120)
    if (r.fig && r.p) digits(r.fig, r.p.keyFigure.value, 380)
  }
  if (anim) {
    const stopHead = inView(head, () => {
      queue(() => { head.classList.add('is-in'); scramble(count.lastElementChild as HTMLElement, pad(total), '0-9') })
    }, { amount: 0.6 })
    cleanups.push(stopHead)
    const queued = new Set<Row>()
    const want = (r: Row) => { if (r.revealed || queued.has(r)) return; queued.add(r); queue(() => reveal(r)) }
    for (const r of rows) {
      const stop = inView(r.li, () => want(r), { amount: 0.35, margin: '0px 0px -6% 0px' })
      cleanups.push(stop)
    }
    // belt and braces: jump-scrolls, anchors and restored scroll positions must never strand a row hidden
    const sweep = () => {
      for (const r of rows) {
        if (r.revealed) continue
        const b = r.li.getBoundingClientRect()
        if (b.bottom > 40 && b.top < innerHeight * 0.94) want(r)
      }
      if (!head.classList.contains('is-in')) { const b = head.getBoundingClientRect(); if (b.bottom > 0 && b.top < innerHeight * 0.9) queue(() => head.classList.add('is-in')) }
    }
    const sweepT = window.setInterval(() => { if (rows.every(r => r.revealed)) clearInterval(sweepT); else sweep() }, 700)
    addEventListener('scroll', sweep, { passive: true })
    cleanups.push(() => { clearInterval(sweepT); removeEventListener('scroll', sweep) })
  } else {
    head.classList.add('is-in')
    rows.forEach(r => r.li.classList.add('is-in'))
  }

  const offPause = bus.on('pause', () => { kick(); slots?.poke() })
  const offTheme = bus.on('theme', () => { rc?.draw() })
  cleanups.push(offPause, offTheme)

  return {
    dispose() {
      alive = false
      cancelAnimationFrame(raf)
      wipeA.forEach(a => a.cancel())
      cleanups.forEach(f => f())
      rows.forEach(r => r.split?.revert())
      rc?.dispose(); slots?.dispose()
      card.remove()
      root.classList.remove('wx', 'wx-anim', 'wx-touch', 'has-active')
      root.style.removeProperty('--wx-skew')
      root.innerHTML = ''
    },
  }
}
