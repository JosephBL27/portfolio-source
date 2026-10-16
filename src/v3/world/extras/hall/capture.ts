// Real photographic architecture: Poly Haven Old Hall, Sergej Majboroda (CC0).
// Panorama geometry and spherical look math adapted from three.js r186's
// webgl_panorama_equirectangular example (mrdoob and contributors, MIT).
// UI entrance: Magic UI BlurFade (Dillion Verma, MIT), offset 6 / 400 ms.
// Portal title reveal: VengeanceUI stagger-text (Ashutoshx7, MIT), 600 ms,
// cubicBezier(.22,1,.36,1). Anime.js owns motion on inner spans only.
import * as THREE from 'three'
import { animate, createScope, cubicBezier, stagger } from 'animejs'
import type { Extra, ExtraCtx } from '../../../main'
import { WAYPOINTS } from '../../layout'
import { waypointP, type FlightState } from '../../flight'
import { interestsFrom } from './glass'
import { ABOUT_LINES } from '../../../ui/copy'
import site from '../../../../data/site.json'
import './capture.css'

const INTERESTS = interestsFrom(site.bio.offBoard)
const RAD = Math.PI / 180
const clamp = THREE.MathUtils.clamp
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b)
const DEFAULT_YAW = 0
const DEFAULT_PITCH = 8
const between = (st: FlightState, i: number) => st.dwelling ? (st.wp === i ? 1 : 0) :
  st.next === i ? smooth(.48, .95, st.t) : st.wp === i ? 1 - smooth(.02, .5, st.t) : 0

export function installCapture(ctx: ExtraCtx): Extra {
  const field = ctx.field, scene: THREE.Scene = field.scene, camera: THREE.PerspectiveCamera = field.camera
  const renderer: THREE.WebGLRenderer = field.renderer
  const canvas = ctx.canvas!, html = document.documentElement
  const iHall = WAYPOINTS.findIndex(w => w.id === 'hall')
  const iGate = WAYPOINTS.findIndex(w => w.id === 'gate')
  const abort = new AbortController(), signal = abort.signal
  const geo = new THREE.SphereGeometry(90, 64, 32); geo.scale(-1, 1, 1)
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false })
  const room = new THREE.Mesh(geo, mat); room.name = 'hall-photographic-capture'
  room.frustumCulled = false; room.visible = false; room.userData.noReflect = true
  room.renderOrder = 10000
  scene.add(room)
  let status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle', error = '', loaded = ''
  let yaw = DEFAULT_YAW, pitch = DEFAULT_PITCH, wantYaw = yaw, wantPitch = pitch
  let active = false, wasHere = false, disposed = false, navigating = false, owned = false
  let drag: { id: number; x: number; y: number; yaw: number; pitch: number; moved: boolean } | null = null
  let live = false, gain = 0
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  const WINDOW_YAWS = [-62, -32, 0, 32, 62]
  const windowAt = (x: number, y: number) => {
    if (!active || status !== 'ready' || navigating) return -1
    ndc.set(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2); ray.setFromCamera(ndc, camera)
    const d = ray.ray.direction, lat = Math.asin(d.y) / RAD, lon = Math.atan2(d.z, d.x) / RAD
    if (lat < -12 || lat > 31) return -1
    return WINDOW_YAWS.findIndex(a => Math.abs(((lon - a + 540) % 360) - 180) < 7)
  }
  const el = document.createElement('section'); el.id = 'hall-capture-ui'; el.hidden = true
  el.setAttribute('aria-label', 'Five windows — explore the hall')
  const title = document.createElement('h2'); title.className = 'hc-title'; title.textContent = 'Five windows'
  const hint = document.createElement('p'); hint.className = 'hc-hint'; hint.textContent = 'Drag to look around. Choose a window to step through.'
  const bar = document.createElement('nav'); bar.className = 'hc-portals'; bar.setAttribute('aria-label', 'Interests')
  const buttons = INTERESTS.map((it, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.portal = String(i)
    b.setAttribute('aria-label', `Step through to ${it.label}${it.fact ? ', ' + it.fact : ''}`)
    b.style.setProperty('--portal-color', `rgb(${it.light.map(c => Math.round(c * 255)).join(' ')})`)
    const inner = document.createElement('span'); inner.className = 'hc-portal-inner'
    const name = document.createElement('span'); name.className = 'hc-portal-name'; name.textContent = it.label
    const fact = document.createElement('small'); fact.textContent = it.short ?? ''
    inner.append(name, fact); b.append(inner); bar.append(b)
    b.addEventListener('click', () => visit(i), { signal })
    return b
  })
  const tools = document.createElement('div'); tools.className = 'hc-tools'
  const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Centre view'
  reset.addEventListener('click', () => { wantYaw = DEFAULT_YAW; wantPitch = DEFAULT_PITCH; ctx.emit('pov:return') }, { signal })
  const about = document.createElement('details'); about.className = 'hc-about'
  const summary = document.createElement('summary'); summary.textContent = 'About me'
  const bio = document.createElement('p'); bio.textContent = ABOUT_LINES.join(' ')
  about.append(summary, bio); tools.append(reset, about)
  const credit = document.createElement('a'); credit.className = 'hc-credit'; credit.href = 'https://polyhaven.com/a/old_hall'
  credit.target = '_blank'; credit.rel = 'noopener noreferrer'; credit.textContent = 'Powered by Poly Haven'
  const loading = document.createElement('p'); loading.className = 'hc-loading'; loading.setAttribute('role', 'status')
  const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Reload hall'; retry.hidden = true
  retry.addEventListener('click', () => { status = 'idle'; void load() }, { signal })
  loading.append(retry)
  el.append(title, hint, bar, tools, credit, loading); document.body.append(el)
  const shade = document.createElement('div'); shade.id = 'hall-capture-shade'; shade.setAttribute('aria-hidden', 'true'); document.body.append(shade)
  const scope = createScope({ root: el, mediaQueries: { reduce: '(prefers-reduced-motion: reduce)' } })
  const rm = () => html.classList.contains('rm') || matchMedia('(prefers-reduced-motion: reduce)').matches
  scope.add(self => {
    self!.add('enter', () => {
      if (self!.matches.reduce) return
      animate(title, { opacity: [0, 1], y: [6, 0], duration: 400, delay: 40, ease: 'out(3)' })
      animate('.hc-portal-inner', { y: ['110%', '0%'], duration: 600, delay: stagger(50), ease: cubicBezier(.22, 1, .36, 1) })
    })
  })
  const setLoading = (text: string, failed = false) => {
    loading.firstChild?.nodeType === Node.TEXT_NODE && loading.firstChild.remove()
    loading.prepend(document.createTextNode(text)); loading.hidden = !text; retry.hidden = !failed
    buttons.forEach(b => { b.disabled = status !== 'ready' || navigating })
  }
  const load = async () => {
    if (status === 'loading' || status === 'ready' || disposed) return
    status = 'loading'; setLoading('Opening the hall…')
    const base = import.meta.env.BASE_URL + 'media/hall/'
    // 4k is the fallback and phone ceiling; only desktops with an 8k-capable GPU upgrade.
    try {
      let texture: THREE.Texture
      try { texture = await new THREE.TextureLoader().loadAsync(base + 'old-hall-4k.webp'); loaded = '4k' }
      catch { texture = await new THREE.TextureLoader().loadAsync(base + 'old-hall-2k.webp'); loaded = '2k' }
      if (disposed) { texture.dispose(); return }
      texture.colorSpace = THREE.NoColorSpace // AgX output already display-referred; matches field.ts's output path.
      texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false
      mat.map = texture; mat.needsUpdate = true; status = 'ready'; setLoading('')
      if (innerWidth > 760 && renderer.capabilities.maxTextureSize >= 8192) {
        new THREE.TextureLoader().load(base + 'old-hall-8k.webp', high => {
          if (disposed) { high.dispose(); return }
          high.colorSpace = THREE.NoColorSpace; high.minFilter = THREE.LinearFilter; high.generateMipmaps = false
          mat.map?.dispose(); mat.map = high; mat.needsUpdate = true; loaded = '8k'
        }, undefined, () => { /* keep the decoded 4k photograph */ })
      }
    } catch (e) { status = 'failed'; error = String(e); setLoading('The hall could not load. ', true) }
  }
  let transition: ReturnType<typeof animate> | null = null
  function visit(i: number) {
    if (!active || status !== 'ready' || navigating) return
    navigating = true; buttons.forEach(b => { b.disabled = true })
    const it = INTERESTS[i]; ctx.emit('hall:dive', { i }); html.classList.add('hall-diving')
    const fade = { value: 1 }
    transition?.revert()
    transition = animate(fade, { value: 0, duration: rm() ? 120 : 420, ease: 'in(3)',
      onUpdate: () => { gain = fade.value },
      onComplete: () => {
        const index = WAYPOINTS.findIndex(w => w.id === it.id)
        ctx.ui?.nav?.go?.(it.id)
        ;(window as any).__v3?.follower?.snap?.(waypointP(index))
        navigating = false; html.classList.remove('hall-diving'); gain = 1
        buttons.forEach(b => { b.disabled = false })
      },
    })
  }
  canvas.addEventListener('pointerdown', e => {
    if (!active || e.button !== 0 || !e.isPrimary) return
    e.stopPropagation(); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: wantYaw, pitch: wantPitch, moved: false }
    canvas.setPointerCapture(e.pointerId)
  }, { capture: true, signal })
  canvas.addEventListener('pointermove', e => {
    if (!drag) {
      const hot = windowAt(e.clientX, e.clientY)
      html.classList.toggle('hall-hover', hot >= 0)
      buttons.forEach((b, i) => b.classList.toggle('is-window-hot', i === hot))
      return
    }
    if (drag.id !== e.pointerId) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (Math.hypot(dx, dy) > 6) { drag.moved = true; html.classList.add('pov-drag') }
    if (!drag.moved) return
    wantYaw = drag.yaw - dx * .12; wantPitch = clamp(drag.pitch + dy * .1, -65, 65)
  }, { signal })
  const up = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return
    const tapped = !drag.moved && e.type !== 'pointercancel'
    drag = null; html.classList.remove('pov-drag')
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    if (tapped) { const i = windowAt(e.clientX, e.clientY); if (i >= 0) visit(i) }
  }
  canvas.addEventListener('pointerup', up, { signal }); canvas.addEventListener('pointercancel', up, { signal })
  addEventListener('keydown', e => {
    if (!active || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || (e.target as Element)?.closest('input,textarea,select,[contenteditable]')) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); wantYaw += e.key === 'ArrowRight' ? 12 : -12 }
    if (e.key === 'Home' && !e.shiftKey) { e.preventDefault(); wantYaw = DEFAULT_YAW; wantPitch = DEFAULT_PITCH }
  }, { capture: true, signal })
  const deactivate = () => {
    active = false; drag = null; el.hidden = true; shade.style.opacity = '0'; html.classList.remove('hall-photo', 'pov-drag', 'hall-diving', 'hall-hover')
    about.open = false
  }
  const dispose = () => {
    if (disposed) return
    disposed = true; abort.abort(); transition?.revert(); scope.revert(); room.removeFromParent()
    mat.map?.dispose(); mat.dispose(); geo.dispose(); deactivate(); el.remove(); shade.remove()
  }
  addEventListener('pagehide', e => { if (!(e as PageTransitionEvent).persisted) dispose() }, { signal })
  ;(window as any).__hallCapture = { state: () => ({ status, loaded, yaw, pitch, active, navigating, error, drawCalls: 1, parallax: false }),
    look: (y: number, p = DEFAULT_PITCH) => { wantYaw = y; wantPitch = clamp(p, -65, 65) }, visit, dispose }
  return {
    adjustCam(cam, dt, st) {
      if (disposed) return
      const weight = between(st, iHall)
      if (weight < .001 || status !== 'ready') return
      const k = rm() ? 1 : 1 - Math.exp(-dt * 16)
      yaw += (wantYaw - yaw) * k; pitch += (wantPitch - pitch) * k
      // A photographed room has a fixed capture origin. Turn the lens; never orbit around a fake centre.
      const r = 10, x = Math.cos(pitch * RAD) * Math.cos(yaw * RAD) * r, y = Math.sin(pitch * RAD) * r, z = Math.cos(pitch * RAD) * Math.sin(yaw * RAD) * r
      const target: [number, number, number] = [cam.pos[0] + x, cam.pos[1] + y, cam.pos[2] + z]
      return { ...cam, target, fov: innerWidth <= 760 ? 78 : 68 }
    },
    update(_t, _dt, st) {
      if (disposed) return
      const weight = between(st, iHall), here = st.dwelling && st.wp === iHall
      if (st.wp >= iGate - 2 && st.wp <= iHall + 1 && status === 'idle') void load()
      const blocked = html.classList.contains('in-index') || html.classList.contains('in-overview') || !!document.querySelector('dialog[open]')
      live = weight > .01 && !blocked
      if (live && !active) { active = true; el.hidden = false; html.classList.add('hall-photo'); scope.methods.enter() }
      if (!live && active) deactivate()
      if (here && !wasHere) { yaw = wantYaw = DEFAULT_YAW; pitch = wantPitch = DEFAULT_PITCH; gain = 1 }
      wasHere = here
      mat.opacity = status === 'ready' ? weight * gain : 0; room.visible = mat.opacity > .001
      room.position.copy(camera.position)
      el.style.opacity = String(weight * gain); shade.style.opacity = String(live ? weight * gain : 0)
      if (weight > 0) { field.setFieldAlpha?.(1 - weight); owned = true }
      else if (owned) { field.setFieldAlpha?.(1); owned = false }
    },
  }
}
