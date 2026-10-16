// Lab harness for the reading desk. ?open=<id> opens a project on load, ?night=1 starts at night.
import { initDesk } from '../src/ui/desk'
import { projects } from '../src/data'
import { state, setNight } from '../src/state'
import { bus } from '../src/bus'

const q = new URLSearchParams(location.search)
setNight(q.has('night') ? q.get('night') === '1' : state.night)

const log = document.querySelector<HTMLElement>('.lab-log')!
const desk = initDesk({
  onClose: id => { log.textContent = `onClose(${id})` },
  onStep: id => { log.textContent = `onStep(${id})` },
})
bus.on('station', ({ id }) => { log.textContent = `station(${id})` })

const list = document.querySelector<HTMLUListElement>('.lab-list')!
projects.forEach((p, i) => {
  const li = document.createElement('li')
  const b = document.createElement('button')
  b.type = 'button'
  b.dataset.id = p.id
  b.innerHTML = `<span class="n">No. ${String(i + 1).padStart(2, '0')}</span><span class="t"></span><span class="k">${p.kind}</span>`
  b.querySelector('.t')!.textContent = p.name
  b.addEventListener('click', () => desk.open(p.id))
  li.append(b)
  list.append(li)
})

const night = document.querySelector<HTMLButtonElement>('.lab-night')!
const syncNight = () => { night.setAttribute('aria-pressed', String(state.night)); night.textContent = state.night ? 'Day post' : 'Night shift' }
night.addEventListener('click', () => { setNight(!state.night); syncNight() })
syncNight()

const id = q.get('open')
if (id) {
  const btn = list.querySelector<HTMLButtonElement>(`[data-id="${id}"]`)
  btn?.focus()
  desk.open(id)
  const plate = Number(q.get('plate') || 0)
  for (let k = 0; k < plate; k++) document.querySelector('.desk')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
}
;(window as any).desk = desk
