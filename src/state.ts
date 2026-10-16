// Global UI state. Read anywhere; change via the setters so the bus fires.
import { bus } from './bus'
const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
export const state = {
  night: localStorage.getItem('pneuma-night') !== '0',
  paused: false,
  sound: false,
  reduced: mq.matches,
}
mq.addEventListener('change', () => { state.reduced = mq.matches })
export function setNight(night: boolean) {
  state.night = night; localStorage.setItem('pneuma-night', night ? '1' : '0')
  document.documentElement.dataset.theme = night ? 'night' : 'day'
  bus.emit('theme', { night })
}
export function setPaused(paused: boolean) { state.paused = paused; bus.emit('pause', { paused }) }
export function setSound(on: boolean) { state.sound = on; bus.emit('sound', { on }) }
