// Hall-specific first-person adapter. Translation reuses three.js PointerLockControls (MIT)
// without requesting pointer lock: drag remains compatible with the stained-glass taps.
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import type { FlightState } from '../../flight'
type CamPose = FlightState['cam']
import type { HallRig } from './rig'
import { HW, L } from './shell'
import { occ, hitsAny } from '../../occlusion'

export function hallWalk(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera, rig: HallRig,
  available: () => boolean) {
  const eye = new THREE.PerspectiveCamera(), controls = new PointerLockControls(eye)
  const local = new THREE.Vector3(), direction = new THREE.Vector3(), target = new THREE.Vector3()
  const inverse = new THREE.Matrix4()
  const homePosition = new THREE.Vector3(), homeRotation = new THREE.Quaternion()
  const angles = new THREE.Euler(0, 0, 0, 'YXZ'), held = new Set<string>()
  const bounds = { x: HW - 1.25, near: 1.6, far: L - 2.6 }
  let live = false, engaged = false, yaw = 0, pitch = 0
  let grab: { id: number; x: number; y: number; moved: boolean } | null = null
  let hasHome = false
  const html = document.documentElement
  const panel = document.createElement('div'); panel.id = 'hall-walk'; panel.hidden = true
  panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Explore the hall')
  const hint = document.createElement('span'); hint.textContent = matchMedia('(pointer: coarse)').matches ? 'Drag to look · Hold arrows to walk' : 'Drag to look · WASD to walk'; panel.append(hint)
  const pad = document.createElement('div'); pad.className = 'hall-walk-pad'; panel.append(pad)
  for (const [key, rotation, label] of [['w', '0', 'Walk forward'], ['a', '-90', 'Walk left'], ['s', '180', 'Walk backward'], ['d', '90', 'Walk right']]) {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', label); pad.append(b)
    // Lucide ArrowUp (ISC), rotated for the four directions; same stroke as the existing navigation.
    b.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${rotation}deg)"><path d="m5 12 7-7 7 7M12 19V5"/></svg>`
    b.addEventListener('pointerdown', e => { if (!available()) return; e.preventDefault(); try { b.setPointerCapture(e.pointerId) } catch { /* synthetic input / pointer already gone */ } engage(); held.add(key) })
    const up = () => held.delete(key)
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up)
    // Keyboard activation takes a short, deliberate step; holding a pointer walks continuously.
    b.addEventListener('click', e => { if (e.detail !== 0 || !available()) return; engage(); move(key === 'w' ? 1 : key === 's' ? -1 : 0, key === 'd' ? 1 : key === 'a' ? -1 : 0, 0.65) })
  }
  const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Center view'; reset.addEventListener('click', resetView); panel.append(reset)
  document.body.append(panel)
  // ---- placement (wave 24): the panel is its own row, never on the copy. It hangs just under the hall card's text; where the HUD is in the way (the ring radar, bottom-left on a desktop) it slides
  // right of it, and where there is no room under the text (a phone: the HUD band owns the bottom 72 px) it sits just above the text. hall.css has a CSS default for the frames before the first measure.
  let placedAt = -1e9, placed = false, pk = ''
  const unplace = () => { if (!placed) return; placed = false; pk = ''; for (const k of ['left', 'top', 'right', 'bottom', 'width']) panel.style.removeProperty(k) }
  function place(now: number) {
    const info = document.querySelector<HTMLElement>('.ov.vis[data-id="hall"] .info')
    const w = panel.offsetWidth, h = panel.offsetHeight, vw = innerWidth, vh = innerHeight
    if (!info || !w || !h) { unplace(); return }
    const ib = info.getBoundingClientRect()
    const key = `${Math.round(ib.left)},${Math.round(ib.top)},${Math.round(ib.bottom)},${Math.round(ib.width)},${w},${h},${vw},${vh},${occ.hud.length}`
    if (key === pk && now - placedAt < 400) return
    placedAt = now; pk = key
    const phone = vw <= 760, gap = 10, edge = phone ? 8 : 12
    const pw = phone ? Math.round(ib.width) : w
    // a row at `top`, starting at the text's left edge and stepping right past each HUD box it would touch; null when it ends up off screen or on something
    const row = (top: number): { left: number; top: number } | null => {
      if (top < 70 || top + h > vh - edge) return null
      let left = ib.left
      for (let i = 0; i < 5; i++) {
        const box = { l: left, t: top, r: left + pw, b: top + h }
        const hit = occ.hud.find(b => hitsAny(box, [b], 6))
        if (!hit) return left + pw <= vw - edge ? { left, top } : null
        if (phone) return null    // no room to step aside on a phone: try the other side of the text
        left = Math.max(left, hit.r + 14)
      }
      return null
    }
    const at = row(Math.round(ib.bottom + gap)) ?? row(Math.round(ib.top - gap - h))
    if (!at) { unplace(); return }
    placed = true
    const st = panel.style
    st.left = `${at.left}px`; st.top = `${at.top}px`; st.right = 'auto'; st.bottom = 'auto'
    if (phone) st.width = `${pw}px`; else st.removeProperty('width')
  }
  function resetView() {
    held.clear(); grab = null
    if (!hasHome) return
    eye.position.copy(homePosition); eye.quaternion.copy(homeRotation)
    angles.setFromQuaternion(eye.quaternion, 'YXZ'); yaw = angles.y; pitch = angles.x
    constrain(eye.position); eye.updateMatrix(); engaged = true
  }
  function engage() {
    if (engaged) return
    // Start from the rendered eye, including portrait framing, rather than jumping to
    // the unframed flight pose when the visitor first touches a walking control.
    eye.position.copy(camera.position); angles.setFromQuaternion(camera.quaternion, 'YXZ')
    yaw = angles.y; pitch = angles.x; eye.quaternion.setFromEuler(angles.set(pitch, yaw, 0, 'YXZ'))
    constrain(eye.position); eye.updateMatrix(); engaged = true
    if (!hasHome) { homePosition.copy(eye.position); homeRotation.copy(eye.quaternion); hasHome = true }
  }
  function constrain(position: THREE.Vector3) {
    inverse.copy(rig.root.matrixWorld).invert(); local.copy(position).applyMatrix4(inverse)
    local.x = THREE.MathUtils.clamp(local.x, -bounds.x, bounds.x)
    local.z = THREE.MathUtils.clamp(local.z, bounds.near, bounds.far)
    local.y = 3.6 // walking stays on the nave floor; look-up never becomes flight
    rig.toWorld(local.x, local.y, local.z, position)
  }
  function move(forward: number, right: number, distance: number) {
    eye.updateMatrix(); const n = Math.hypot(forward, right) || 1
    controls.moveForward(distance * forward / n); controls.moveRight(distance * right / n); constrain(eye.position)
  }
  const editable = (e: KeyboardEvent) => (e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')
  addEventListener('keydown', e => {
    if (!live || !available() || e.altKey || e.ctrlKey || e.metaKey || editable(e)) return
    const k = e.key.toLowerCase(), key = ({ arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' } as Record<string, string>)[k] ?? k
    if ('wasd'.includes(key) && key.length === 1) { e.preventDefault(); e.stopImmediatePropagation(); engage(); held.add(key) }
    else if (k === 'home') { e.preventDefault(); e.stopImmediatePropagation(); resetView() }
  }, true)
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); held.delete(({ arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' } as Record<string, string>)[k] ?? k) }, true)
  addEventListener('blur', () => { held.clear(); grab = null })
  canvas.addEventListener('pointerdown', e => {
    if (!live || !available() || e.button !== 0 || !e.isPrimary) return
    grab = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId)
  })
  canvas.addEventListener('pointermove', e => {
    if (!grab || e.pointerId !== grab.id || !available()) return
    const dx = e.clientX - grab.x, dy = e.clientY - grab.y
    if (!grab.moved && Math.hypot(dx, dy) < 6) return
    engage(); grab.moved = true; yaw -= dx * 0.0034; pitch = THREE.MathUtils.clamp(pitch - dy * 0.0028, -1.25, 1.25)
    eye.quaternion.setFromEuler(angles.set(pitch, yaw, 0, 'YXZ')); grab.x = e.clientX; grab.y = e.clientY
  })
  const release = (e: PointerEvent) => { if (grab?.id === e.pointerId) { grab = null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId) } }
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release)
  // The canvas belongs to free look here. Keep a vertical look gesture from also
  // becoming the global tour's swipe-to-next; the surrounding UI still navigates.
  for (const name of ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const) {
    canvas.addEventListener(name, e => {
      if (!live || !available()) return
      e.stopPropagation()
      if (name === 'touchmove' && e.cancelable) e.preventDefault()
    }, { passive: false })
  }
  return {
    adjust(pose: CamPose, dt: number, st: FlightState, hallIndex: number): CamPose {
      const on = st.dwelling && st.wp === hallIndex && rig.built
      if (on !== live) {
        live = on; engaged = false; hasHome = false; held.clear(); grab = null; panel.hidden = !on
        canvas.style.touchAction = on ? 'none' : 'pan-y'
        html.classList.toggle('hall-exploring', on)
      }
      if (!live) { held.clear(); panel.hidden = true; unplace(); return pose }
      const interactive = available(); panel.hidden = !interactive
      if (!interactive) held.clear()
      else place(performance.now())
      if (!engaged) return pose
      if (interactive) move(Number(held.has('w')) - Number(held.has('s')), Number(held.has('d')) - Number(held.has('a')), Math.min(dt, 0.05) * 4.5)
      eye.getWorldDirection(direction); target.copy(eye.position).addScaledVector(direction, 18)
      return { ...pose, pos: eye.position.toArray(), target: target.toArray() }
    },
    // Runs after the shared camera spring, before picking/rendering. It also blocks narrow-screen
    // auto-dolly and pointer parallax from carrying the actual rendered eye through a wall.
    apply() {
      if (!live || !available()) return
      if (engaged) { camera.position.copy(eye.position); camera.quaternion.copy(eye.quaternion) }
      else constrain(camera.position)
      camera.updateMatrixWorld()
    },
    state: () => ({ live, engaged, yaw, pitch, held: [...held], local: rig.toLocal(camera.position, local).toArray(), bounds }),
  }
}
