// v4 "continuous world" integration.
//   scroll (ui.progress) -> follower (time floors) -> flightAt(p) -> field.setWorld (forms, placement, camera)
//                                                                  -> world.update (TVs)  -> ui.setFlight (copy)
//                                                                  -> sfx.setFlight / sfx.cue
// Every collaborator is optional (import.meta.glob guards): with only the engine present this still flies
// the camera through the world with a minimal built-in scroll track, so each piece can land on its own.
import '@fontsource-variable/bodoni-moda/opsz.css'
import '@fontsource-variable/bodoni-moda/opsz-italic.css'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { FORMS } from './forms'
import type { FormDef } from './forms/types'
import { WAYPOINTS } from './world/layout'
import { flightAt, FlightFollower, SCROLL_VH, nearestWaypoint, waypointP, type FlightState } from './world/flight'
import { initStepper } from './ui/stepper'
import projects from '../data/projects.json'
import { state } from '../state'
import { bus } from '../bus'

// w12 latency: the loader's gate is the first three waypoints' forms; the big .bin files (brain, turntable) wait for 'v3:ready' (see gl/brainShape.ts, forms/bust.ts).
// ?ready=all is the old behaviour (gate on every form, nothing waits): the "before" of the time-to-ready measurement.
const urlq = new URLSearchParams(location.search)
const gateAll = urlq.get('ready') === 'all'
const wv = window as unknown as { __v3Gate?: boolean; __v3Ready?: boolean }
wv.__v3Gate = !gateAll
const optional = import.meta.glob(['./engine/field.ts', './ui/ui.ts', './world/objects.ts', '../ui/case.ts', '../reels/index.ts', '../audio/sound.ts', '../audio/sfx.ts'])
/** hand the main thread back (scheduler.yield where it exists: it keeps the continuation's priority) */
const yieldMain = (): Promise<void> => {
  const sch = (globalThis as any).scheduler
  return typeof sch?.yield === 'function' ? sch.yield() : new Promise(r => setTimeout(r, 0))
}

// w14: the service worker (public/sw.js): hashed chunks cache-first, models and media stale-while-revalidate, the page network-first. Production only, after the world is
// ready and the browser is idle, so it never competes with the boot; once active it is told what this visit already loaded (those files sit in the HTTP cache).
function registerWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || location.protocol === 'file:' || new URLSearchParams(location.search).has('nosw')) return
  const go = () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).then(() => navigator.serviceWorker.ready).then(reg => {
    const urls = performance.getEntriesByType('resource').map(e => e.name).filter(u => u.startsWith(location.origin))
    reg.active?.postMessage({ type: 'seed', urls })
  }).catch(() => { /* private mode or blocked: the site works the same without it */ })
  const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  if (idle) idle(go, { timeout: 4000 }); else setTimeout(go, 2000)
}
/** w14: the stops ahead need terrain and the crag (2 MB); halfway through the tour they are fetched at low priority so the arrival finds them in the cache */
let lateWarmed = false, crateWarmed = false
/** w14: the record crate (stop 24) streams a preview from Apple's audio CDN and draws covers from its image CDN; opening both connections four stops ahead takes the DNS, TCP and TLS round trips out of the click */
function warmCrate() {
  if (crateWarmed) return; crateWarmed = true
  for (const href of ['https://audio-ssl.itunes.apple.com', 'https://is1-ssl.mzstatic.com']) { const l = document.createElement('link'); l.rel = 'preconnect'; l.href = href; l.crossOrigin = 'anonymous'; document.head.append(l) }
}
function warmLate() {
  if (lateWarmed) return; lateWarmed = true
  const b = import.meta.env.BASE_URL, list = ['terrain/yosemite.json', 'terrain/yosemite-height.png', 'terrain/yosemite-shade.png', 'terrain/yosemite-color.jpg', 'models/crag.glb']
  void (async () => { for (const f of list) { try { await (await fetch(b + f, { priority: 'low' } as RequestInit)).arrayBuffer() } catch { /* the stop fetches it itself */ } } })()
}
/** r7: the files a stop's stage fetches when it builds (the exact URLs in the stage sources). While the visitor dwells up to three stops before it they are fetched one at a time at low
 *  priority, only when the browser is idle, so the build finds them in the HTTP / service-worker cache instead of waiting on the network mid-flight. Skipped on Save-Data. */
const AHEAD: Record<string, string[]> = {
  surface: ['models/glb/qvr-instrument.glb'],
  mathecon: ['models/glb/chalkboard.glb', 'media/chalk/slate-wipes.webp'],
  hold: ['models/glb/crag-ring.glb', 'models/glb/hold-field.glb', 'models/glb/namaqualand-boulder-03.glb', 'media/crag/ground111-color.webp', 'media/crag/forest-ground-04.webp', 'media/crag/ground-light.webp', 'media/crag/field-shadow.webp'],
  meeple: ['models/glb/games-props.glb', 'models/glb/climber.glb'],
  records: ['models/glb/turntable.glb', 'models/glb/room-hifi.glb', 'models/glb/room-window.glb'],
  knight: ['models/glb/chess-board.glb'],
}
const aheadSeen = new Set<string>(), aheadQ: string[] = []
let aheadBusy = false, aheadAt = -1
function warmAhead(wp: number) {
  if (wp === aheadAt) return; aheadAt = wp
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
  for (let k = 1; k <= 3; k++) for (const f of AHEAD[WAYPOINTS[wp + k]?.id ?? ''] ?? []) if (!aheadSeen.has(f)) { aheadSeen.add(f); aheadQ.push(f) }
  if (aheadBusy || !aheadQ.length) return
  aheadBusy = true
  const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
  const idle = () => new Promise<void>(r => { if (ric) ric(() => r(), { timeout: 1500 }); else setTimeout(r, 250) })
  const b = import.meta.env.BASE_URL
  void (async () => {
    while (aheadQ.length) {
      await idle()
      try { await (await fetch(b + aheadQ.shift()!, { priority: 'low' } as RequestInit)).arrayBuffer() } catch { /* the stop fetches it itself */ }
    }
    aheadBusy = false
  })()
}
async function load<T = any>(p: string): Promise<T | null> {
  if (!optional[p]) return null
  try { return (await optional[p]()) as T } catch (e) { console.warn('[v4] module failed', p, e); return null }
}
document.documentElement.dataset.theme = 'night'
if (state.reduced) document.documentElement.classList.add('reduced')

// Forms in waypoint order (so the first screens build first). Forms another builder has not landed yet fall back to a sphere.
const warned = new Set<string>()
const resolveForm = (id: string) => {
  if (FORMS[id]) return id
  if (!warned.has(id)) { warned.add(id); console.warn(`[v4] form "${id}" is not built yet: using the sphere`) }
  return 'sphere'
}
const order: string[] = []
for (const w of WAYPOINTS) { const id = resolveForm(w.form); if (!order.includes(id)) order.push(id) }
const forms: FormDef[] = order.map(id => FORMS[id]).filter(Boolean)
type CamPose = FlightState['cam']
type EvListener = (name: string, data?: any) => void
/** contract for src/v3/world/extras/*.ts: export function install(ctx: ExtraCtx): Extra | void */
export interface ExtraCtx {
  field: any; world: any; ui: any; sfx: any; canvas: HTMLCanvasElement | null
  state(): FlightState
  openWork(projectId: string, fromEl?: HTMLElement | null, fromRect?: DOMRect | null): void
  /** fire a named event: world/extra listeners hear it and the sfx engine plays the cue of the same name, if it has one */
  emit(name: string, data?: any): void
  /** listen to every world + extra event (hub:detent, tv:spin, pov:grab, ...) */
  on(l: EvListener): () => void
}
export interface Extra { update?(t: number, dt: number, st: FlightState): void; adjustCam?(cam: CamPose, dt: number, st: FlightState): CamPose | void }
const evListeners: EvListener[] = []
const projName = (id: string) => (projects as { id: string; name: string }[]).find(p => p.id === id)?.name ?? id

;(async () => {
  const [fieldMod, uiMod, worldMod, caseMod, reelsMod, soundMod, sfxMod] = await Promise.all([
    load<any>('./engine/field.ts'), load<any>('./ui/ui.ts'), load<any>('./world/objects.ts'), load<any>('../ui/case.ts'),
    load<any>('../reels/index.ts'), load<any>('../audio/sound.ts'), load<any>('../audio/sfx.ts'),
  ])
  const canvas = document.getElementById('field') as HTMLCanvasElement | null
  const sfx = sfxMod?.sfx ?? null
  let lastCueWp = -1, lastCueAt = 0, offCued = false

  // The HUD's sound button talks to the old sound module; in v4 the SFX engine owns the sound, so that button drives it (one click on, one click off).
  if (sfx && soundMod?.sound) {
    const legacy = soundMod.sound
    legacy.enable = () => sfx.init()
    legacy.disable = () => sfx.setEnabled(false)
    Object.defineProperty(legacy, 'on', { get: () => sfx.enabled, configurable: true })
  }
  // sound just came on (Enter with sound, or the HUD toggle): play the arrival cue of the waypoint we are standing at (the first wind)
  const soundOn = () => { lastCueWp = -1 }

  // ---- case view (opening a work). The case grows out of the TV's screen rect.
  const reels = reelsMod?.REELS ?? []                          // the hub TV's channels: real reels only
  // v11 (7C): the case view has a channel for EVERY project (a poster in its own colour when it has no reel), so no button is a silent no-op
  const caseReels = reelsMod?.CASE_REELS ?? reels
  const caseIndexFor: (id: string) => number = reelsMod?.caseIndexFor ?? ((id: string) => caseReels.findIndex((r: any) => r.projectId === id))
  // deep links: the address bar follows the case on screen (nav.caseShown), so it always holds the link to it; the case's Copy link control copies the same URL
  const caseViewOpts = {
    reels: caseReels,
    onStep: (i: number) => { const id = caseReels[i]?.projectId; if (id) ui?.nav?.caseShown?.(id) },
    onClose: () => { sfx?.cue?.('close'); field?.setPaused?.(state.paused); ui?.nav?.caseShown?.(null) },
  }
  const caseView = caseMod?.initCase ? caseMod.initCase(caseViewOpts) : null
  let world: any = null
  const openWork = (projectId: string, fromEl?: HTMLElement | null, fromRect?: DOMRect | null) => {
    const i = caseIndexFor(projectId)
    if (i < 0 || !caseView) {
      // the case view itself is unavailable (module failed) or the id is unknown: still do something useful, never nothing
      console.warn('[v4] no case view for', projectId)
      const p = (projects as { id: string; demo?: { url: string }; links?: { url: string }[] }[]).find(x => x.id === projectId)
      const u = p?.demo?.url ?? p?.links?.[0]?.url
      if (u && /^https?:/.test(u)) window.open(u, '_blank', 'noopener,noreferrer')
      else document.getElementById('index')?.scrollIntoView({ behavior: state.reduced ? 'auto' : 'smooth' })
      return
    }
    const rect: DOMRect | undefined = fromRect ?? world?.screenRect?.(projectId) ?? fromEl?.getBoundingClientRect()
    if (sfx) sfx.cue('open'); else soundMod?.sound?.thwoop?.()
    caseView.open(i, rect ?? undefined)
    ui?.nav?.caseShown?.(projectId)
    field?.setPaused?.(true) // the case covers the screen: stop drawing the world behind it
  }

  // ---- UI. v4 UI if it exists; otherwise a minimal scroll track so the flight still works.
  const html = document.documentElement
  let ui: any = null
  if (uiMod?.initV4UI) {
    try {
      ui = uiMod.initV4UI({
        waypoints: WAYPOINTS, onOpen: (id: string, el: HTMLElement | null) => openWork(id, el),
        // the loader's "Enter" is the first gesture: it unlocks audio, and the hub TV powers on
        onEnter: (withSound: boolean) => { if (withSound) void sfx?.init?.().then(soundOn) },
      })
    } catch (e) { console.warn('[v4] initV4UI failed', e) }
  }
  let fallbackP = () => 0
  const loaderEl = document.getElementById('loader')
  if (!ui) {
    const track = document.getElementById('track')
    if (track) { track.style.height = `${SCROLL_VH * 100}vh`; track.setAttribute('aria-label', 'Joseph Blumberg') }
    try { history.scrollRestoration = 'manual' } catch { /* ignore */ }
    window.scrollTo(0, 0)
    fallbackP = () => { const max = document.documentElement.scrollHeight - innerHeight; return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0 }
  }

  // ---- field
  let field: any = null
  const extraLoads: Record<string, Promise<any>> = {}
  // w14: start fetching every extra's chunk now, in parallel with the form builds and with each other (they were awaited one by one after the world: 15 round trips in a row).
  // Requested before createField so a field that fails (or no canvas) still leaves the extras loadable.
  for (const [path, imp] of Object.entries(import.meta.glob('./world/extras/*.ts'))) extraLoads[path] = Promise.resolve().then(imp).catch(e => { console.warn('[v4] extra failed to load', path, e); return null })
  if (fieldMod?.createField && canvas) {
    try {
      field = fieldMod.createField(canvas, {
        forms, onProgress: (p: number) => ui?.setLoading?.(p),
        firstIds: WAYPOINTS.slice(0, 3).map(w => resolveForm(w.form)),
        adaptive: urlq.get('adaptive') !== '0', tier: urlq.has('tier') ? +urlq.get('tier')! : undefined, // measurement switches
      })
      await (gateAll ? field.ready : field.readyFirst)
    } catch (e) { console.warn('[v4] field failed', e) }
  }

  // ---- world (TVs). Optional; it needs the field's scene.
  if (field && worldMod?.createWorld) {
    let wakeAt = -1e9
    const EV: Record<string, string> = { 'hub:poweron': 'poweron', 'hub:poweroff': 'poweroff', 'hub:channel': 'channel', 'tv:on': 'wake', 'tv:hover': 'hover' }
    try {
      world = worldMod.createWorld(field, {
        // the world owns the pointer: dial, buttons, spin, click-to-open (window listeners, acting on presses that land on the canvas); the POV extra owns empty space
        reels, interactive: true, blocked: () => !!caseView?.isOpen?.(),
        onOpen: (id: string, rect: DOMRect | null) => openWork(id, null, rect),
        onEvent: (name: string, data?: any) => {
          for (const l of evListeners) l(name, data)
          if (!sfx) return
          // events with no legacy mapping go straight to the sfx engine under their own name (it ignores ids it does not know)
          const cue = EV[name]; if (!cue) { sfx.cue(name, data); return }
          // the small TVs wake one after another over ~2.5 s: ONE cue (a rising cascade scheduled on the audio clock), not a tick per TV
          if (name === 'tv:on') { const n = performance.now(); if (n - wakeAt < 3500) return; wakeAt = n }
          sfx.cue(cue)
        },
      })
    } catch (e) { console.warn('[v4] world failed', e) }
  }
  // ---- extras: every module in ./world/extras/ that exports install(ctx) joins the frame (POV drag, background type,
  // reflections, ...). adjustCam bends the flight's camera pose before the engine sees it; emit() reaches the sfx engine.
  const extras: Extra[] = []
  // particle-alpha arbiter: several pieces (set-piece transitions, the 3D name, waypoint stages) fade the particle field.
  // Every call to field.setFieldAlpha within a frame is collected and the LOWEST wins, applied once after the extras
  // update. Owners re-assert their value every frame while they hold the frame and call setFieldAlpha(1) once on release.
  let alphaMin = Infinity
  const rawAlpha: ((a: number) => void) | null = field?.setFieldAlpha ? field.setFieldAlpha.bind(field) : null
  if (field && rawAlpha) field.setFieldAlpha = (a: number) => { if (isFinite(a)) alphaMin = Math.min(alphaMin, a) }
  const applyAlpha = () => { if (rawAlpha && alphaMin !== Infinity) { rawAlpha(alphaMin); alphaMin = Infinity } }
  {
    // runs even when the field failed (field null): each install is try/caught, so an extra that needs the field just logs and is skipped
    const ctx: ExtraCtx = {
      field, world, ui, sfx, canvas, state: () => cur, openWork,
      emit: (name, data) => { for (const l of evListeners) l(name, data); sfx?.cue?.(name, data) },
      on: (l) => { evListeners.push(l); return () => { const i = evListeners.indexOf(l); if (i >= 0) evListeners.splice(i, 1) } },
    }
    // w14: the chunks were requested while the field built (see extraLoads), so by now they are in flight or done: await them together, then install in
    // glob order (adjustCam chains in that order), yielding to the browser between installs so no single task holds the loader's frames.
    const mods = Object.entries(extraLoads)
    const ms: Record<string, number> = ((window as any).__extraMs = {})
    for (const [path, load] of mods) {
      try {
        const m: any = await load
        const t0 = performance.now(); const x = m?.install?.(ctx); if (x) extras.push(x)
        ms[path.slice(path.lastIndexOf('/') + 1)] = +(performance.now() - t0).toFixed(1)
      } catch (e) { console.warn('[v4] extra failed', path, e) }
      await yieldMain()
    }
    // r7: every extra has added its objects and lights now. Warm every program once more against the final scene (a program is keyed by the scene's light count and by the target it
    // draws into, so the warm-ups that ran before the extras existed built variants nothing draws), then again when the Blender hub model has swapped in (it arrives ~1.2 s after the
    // world is built, after the first pass) and the browser is idle. compileAsync is KHR_parallel_shader_compile: nothing here blocks a frame.
    void field?.compileAhead?.()
    const idleWarm = () => void field?.compileAhead?.()
    const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    setTimeout(() => { if (ric) ric(idleWarm, { timeout: 3000 }); else idleWarm() }, 2500)
  }
  ui?.ready?.()
  wv.__v3Ready = true; window.dispatchEvent(new Event('v3:ready'))
  registerWorker()
  if (!ui && loaderEl) { loaderEl.style.transition = 'opacity .6s'; loaderEl.style.opacity = '0'; setTimeout(() => loaderEl.remove(), 700) }
  bus.on('pause', ({ paused }: { paused: boolean }) => field?.setPaused?.(paused))
  // the HUD's sound toggle drives the SFX engine (guarded: sfx.init() itself emits 'sound')
  if (sfx) bus.on('sound', ({ on }: { on: boolean }) => { if (on !== sfx.enabled) sfx.setEnabled(on); else if (on) soundOn() })

  // ---- picking, the dial and buttons, drag-to-spin and click-to-open live in the world (world/objects.ts); POV drag in world/extras/pov.ts.
  // main only dresses the cursor: the world toggles html.tv-hover (pointer) / tv-grab (hand) / tv-drag (closed hand), pov.ts html.pov-drag.
  // The native cursor is never hidden; empty canvas shows a hand because dragging it swings the point of view.
  const style = document.createElement('style')
  style.textContent = [
    '#field { cursor: grab }',
    'html.tv-hover, html.tv-hover body, html.tv-hover main, html.tv-hover #field { cursor: pointer }',
    'html.tv-grab #field { cursor: grab }',
    'html.tv-drag, html.tv-drag body, html.tv-drag #field, html.pov-drag, html.pov-drag body, html.pov-drag #field { cursor: grabbing }',
    'html.in-index #field, html.is-loading #field { cursor: default }',
    'html.tv-drag, html.pov-drag { user-select: none; -webkit-user-select: none }',
  ].join('\n')
  document.head.append(style)

  // ---- per-frame flight
  const follower = new FlightFollower()
  let forced: number | null = null     // test hook: pin p
  let forcedPrev = -1
  let cur: FlightState = flightAt(0)
  let lastT = performance.now()
  let spdM = 0, prevCam = [0, 0, 0], haveCam = false, dir = 1, lastP = 0, firstFrame = true
  const rm = () => state.reduced || html.classList.contains('rm')
  // stepped navigation (src/v3/ui/stepper.ts): a wheel gesture, a key press or a swipe is ONE waypoint, flown as a timed hop with the leg's authored duration
  // (flight.ts LEG_SECS); scrubbing (Option + wheel) settles to the nearer dwell when it stops. The scroll stays the goal, so every other way in keeps working.
  const trackEl = document.getElementById('track')
  const trackRange = () => Math.max(1, (trackEl?.offsetHeight ?? 0) - (parseFloat(html.style.getPropertyValue('--vh')) || innerHeight))
  const stepper = ui?.progress && trackEl ? initStepper({
    follower, count: WAYPOINTS.length,
    progress: () => ui.progress(),
    range: trackRange,
    setProgress: (p: number) => { scrollTo({ top: p * trackRange(), behavior: 'instant' }); return ui.progress() },
    reduced: rm, forced: () => forced != null, blocked: () => !!caseView?.isOpen?.(),
  }) : null
  const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
  const wpF = (st: FlightState) => (st.dwelling ? st.wp : st.wp + st.t)
  /** the engine's camera rig is a 0.11 s smooth-damp: feeding it the pose it will have reached by then keeps the camera on the path, never behind the morph */
  const CAM_LEAD = 0.115
  const MORPH_LEAD = 0.3
  type Shown = { id: string; pl: FlightState['placeA'] }
  const dominant = (st: FlightState): Shown => (st.mix > 0.5 ? { id: resolveForm(st.b), pl: st.placeB } : { id: resolveForm(st.a), pl: st.placeA })
  // a rail jump shows ONE morph (where we were -> where we land), however many forms lie on the way
  let jRef: object | null = null, jSrc: Shown | null = null, jDst: Shown | null = null, jDstArea = 'hub', jBack = false, jMorphCued = false, jMix = 0

  const tick = (now: number) => {
    requestAnimationFrame(tick)
    if (!field) return
    const rawDt = Math.max(0.001, (now - lastT) / 1000), dt = Math.min(0.1, rawDt); lastT = now
    stepper?.frame(now)
    let goal = forced ?? (ui?.progress ? ui.progress() : fallbackP())
    if (rm()) goal = waypointP(nearestWaypoint(goal)) // no flight in reduced motion: fixed poses, quick crossfades
    if (firstFrame) { follower.snap(goal); firstFrame = false }
    const p = forced != null || rm() ? (follower.snap(goal), goal) : follower.update(goal, dt, rawDt)
    if (Math.abs(p - lastP) > 1e-7) dir = p > lastP ? 1 : -1
    lastP = p
    const s = flightAt(p); cur = s
    if (!lateWarmed && s.wp >= 12) warmLate()
    if (s.dwelling) warmAhead(s.wp)
    if (!crateWarmed && s.wp >= 20) warmCrate()
    const jmp = follower.jump
    // a scripted flight (goto() every frame, as the video recorders do) has no follower: lead the camera and the morph along its own velocity,
    // exactly as they lead the follower's prediction under scroll. Teleports (screenshots, tests) are far above the cap and get no lead.
    const fv = forced != null && forcedPrev >= 0 ? (forced - forcedPrev) / rawDt : 0
    forcedPrev = forced ?? -1
    const lead = (T: number) => (Math.abs(fv) > 1e-6 && Math.abs(fv) < 0.3 ? flightAt(Math.min(1, Math.max(0, p + fv * T))) : s)

    // camera: the pose the follower will have in CAM_LEAD seconds (the engine's rig trails its input by about that much)
    let camS = forced != null && !rm() ? lead(CAM_LEAD) : s
    if (forced == null && !rm() && Math.abs(follower.v) > 1e-6) {
      const pc = follower.predict(goal, CAM_LEAD)
      if (Math.abs(pc - p) > 1e-7) camS = flightAt(pc)
    }

    // forms: the flight's own pair, or the single jump morph. The field's displayed morph follows its goal with a 0.9 s floor, so it
    // finishes ~0.4 s after the flight's own mix does (measured: the copy arrived over a 50-60% formed form). Feed it the state the
    // follower reaches MORPH_LEAD s from now, as the camera is fed CAM_LEAD (the UI and the sound keep the true state).
    let fS = forced != null && !rm() ? lead(MORPH_LEAD) : s
    if (forced == null && !rm() && !jmp && Math.abs(follower.v) > 1e-6) {
      const pm = follower.predict(goal, MORPH_LEAD)
      if (Math.abs(pm - p) > 1e-7) fS = flightAt(pm)
    }
    let fa = resolveForm(fS.a), fb = resolveForm(fS.b), fmix = fS.mix, pa = fS.placeA, pb = fS.placeB
    if (jmp) {
      if (jRef !== jmp) {
        const src = jRef && jSrc && jDst ? (jMix > 0.5 ? jDst : jSrc) : dominant(flightAt(jmp.p0))
        jRef = jmp; jSrc = src; jDst = dominant(flightAt(jmp.g)); jDstArea = flightAt(jmp.g).area; jBack = jmp.g < jmp.p0; jMorphCued = false
        lastCueWp = -1
        if (sfx) { const st = Math.abs(flightAt(jmp.g).wp - flightAt(jmp.p0).wp); sfx.cue(jBack ? 'whoosh.rev' : 'whoosh', { intensity: Math.min(1, 0.45 + 0.06 * st) }) }
      }
      const jp = follower.jumpProgress
      fa = jSrc!.id; pa = jSrc!.pl; fb = jDst!.id; pb = jDst!.pl; fmix = jMix = sm(0.28, 0.92, jp)
      if (!jMorphCued && jp >= 0.6) { jMorphCued = true; sfx?.cue(`morph.${jDstArea}${jBack ? '.rev' : ''}`) }
    } else if (jRef) { jRef = jSrc = jDst = null }
    let cam = camS.cam
    for (const x of extras) if (x.adjustCam) cam = x.adjustCam(cam, dt, s) ?? cam
    field.setWorld({ a: fa, b: fb, mix: fmix, placeA: pa, placeB: pb, cam })
    field.setTurbulence?.(0.9 + 0.7 * s.speed)

    // real camera speed (units/s), for the sound and the HUD
    const c = field.camera.position
    if (haveCam) spdM += (Math.min(1, Math.hypot(c.x - prevCam[0], c.y - prevCam[1], c.z - prevCam[2]) / dt / 30) - spdM) * (1 - Math.exp(-dt / 0.12))
    prevCam = [c.x, c.y, c.z]; haveCam = true

    // w12: the per-area grade (origin area, destination area, leg progress) and the mesh rack focus (subject = camera-to-target distance of the stop)
    const post = field.post
    if (post?.setGrade) {
      if (jmp) post.setGrade(flightAt(jmp.p0).area, jDstArea, follower.jumpProgress)
      else post.setGrade(WAYPOINTS[s.wp].area, WAYPOINTS[s.next]?.area ?? WAYPOINTS[s.wp].area, s.dwelling ? 0 : s.t)
      // Architectural/landscape views keep the room and surrounding scans in focus, like a
      // stopped-down photographic lens. The close-object rack remains at the other stops.
      const deepFocus = s.dwelling && (WAYPOINTS[s.wp].id === 'hall' || WAYPOINTS[s.wp].id === 'hold')
      post.setSubject(Math.hypot(s.cam.pos[0] - s.cam.target[0], s.cam.pos[1] - s.cam.target[1], s.cam.pos[2] - s.cam.target[2]) * (deepFocus ? 2.2 : 1), s.dwelling && !jmp, Math.min(0.5, rawDt), s.wp)
    }
    ui?.setCamera?.([c.x, c.y, c.z], s.cam.target)
    ui?.setFlight?.({ ...s, form: s.t < 0.5 ? s.a : s.b, speed: spdM })

    // sound: the flight bed every frame; one arrival cue per waypoint (never while a jump flies past them)
    if (sfx) {
      if (jmp) {
        const jp = follower.jumpProgress, w0 = wpF(flightAt(jmp.p0)), w1 = wpF(flightAt(jmp.g))
        sfx.setFlight({ speed: dir * spdM, area: jDstArea, mix: Math.abs(2 * jp - 1), wp: w0 + (w1 - w0) * jp, t: now / 1000, quiet: true })
      } else {
        sfx.setFlight({ speed: dir * spdM, area: s.area, mix: s.dwelling ? 1 : Math.abs(2 * s.t - 1), wp: wpF(s), t: now / 1000 })
        if (s.dwelling && s.wp !== lastCueWp) {
          lastCueWp = s.wp
          const cue = WAYPOINTS[s.wp].sound ?? `sig.${WAYPOINTS[s.wp].id}` // every waypoint has an arrival signature (src/audio/voices-sig.ts)
          // power on/off belong to the TV itself (its events fire them) when the world exists
          if (cue && !(world && (cue === 'poweroff' || cue === 'poweron')) && now - lastCueAt > 600) { sfx.cue(cue); lastCueAt = now }
        } else if (!s.dwelling) lastCueWp = -1
      }
    }

    // labels for the lit TVs of the waypoint we are standing at
    if (ui?.setAnchors) {
      const list: { id: string; label: string; x: number; y: number; visible: boolean }[] = []
      if (s.dwelling && !jmp && world?.screenRect) for (const id of s.tvsA) {
        const r: DOMRect | null = world.screenRect(id)
        if (r && r.width > 4 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight) list.push({ id, label: projName(id), x: r.left + r.width / 2, y: r.bottom + 14, visible: true })
      }
      ui.setAnchors(list)
    }
  }
  requestAnimationFrame(tick)
  // the world updates inside the field's frame, right before it renders (and pauses with it)
  field?.onBeforeRender?.((t: number, dt: number) => {
    if (world) world.update({ ...cur, wp: cur.dwelling ? cur.wp : cur.wp + cur.t, speed: spdM * 30 }, t, dt)
    for (const x of extras) x.update?.(t, dt, cur)
    applyAlpha()
  })

  ;(window as any).__v3 = {
    field, ui, world, sfx, flightAt, openWork, caseView, follower, stepper, forms: order,
    state: () => cur,
    /** pin the flight at p (screenshots / tests); goto(null) hands control back to scroll */
    goto: (p: number | null) => { forced = p; if (p != null) follower.snap(p) },
  }
})()
