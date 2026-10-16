// Love Island lab: the standalone Love Island Dynamics demo (public/demos/love-island, built from ~/Projects/love-island-dynamics),
// embedded as a lazy iframe in embed mode. The demo is a self-contained build (relative base), so the same files run here and at
// demos/love-island/index.html. Everything it shows is a simulation of 25 invented islanders; no real contestant is depicted.
// LAB CONTRACT: mount(host, { emit, reduced }) -> { dispose }. The iframe loads when the case opens (loading="lazy": when it nears the
// viewport), carries a title, and never traps the keyboard: a skip link steps past its controls to the "Open the full demo" link.
// The site's Pause switch reaches the demo by postMessage { type: 'li:site', paused }; the demo posts { type: 'li:ready' } when it can hear.
import './love-island.css'
import type { LabHandle, LabOpts } from './lib/kit'
import { mount as mount2d } from './love-island-2d'

const SRC = `${import.meta.env.BASE_URL}demos/love-island/index.html`
const sitePaused = () => document.documentElement.classList.contains('paused')

export function mount(host: HTMLElement, opts: LabOpts): LabHandle {
  host.innerHTML = ''
  // first the original 2D lab (sliders on one couple's phase plane), then the full villa
  const flat = document.createElement('div'); flat.className = 'lid-2d'; host.appendChild(flat)
  const lab2d = mount2d(flat, opts)
  const root = document.createElement('div'); root.className = 'lid' + (opts.reduced ? ' is-reduced' : ''); root.setAttribute('data-proof', 'skip')
  root.innerHTML = `
  <p class="lid-head"><span class="lid-tag">The full villa</span><span class="lid-note">The same equations across 25 islanders, the public vote and 53 days.</span></p>
  <a class="lid-skip" href="#" data-skip>Skip the embedded demo</a>
  <div class="lid-frame"><iframe class="lid-if" title="Love Island Dynamics: an interactive simulation of a 53-day villa. Pick a scenario, turn the dials, scrub the days." loading="lazy" referrerpolicy="no-referrer" allow="fullscreen"></iframe><div class="lid-load" aria-hidden="true"><span>Loading the villa</span></div></div>
  <p class="lid-row"><span class="lid-tag">Simulation</span><span class="lid-note">Interactive model of the paper's equations, 25 invented islanders over 53 days. Not a prediction and not about any real couple.</span><a class="lid-open" href="${SRC}" target="_blank" rel="noopener">Open the full demo <span aria-hidden="true">&#8599;</span></a></p>`
  host.appendChild(root)
  const frame = root.querySelector('.lid-if') as HTMLIFrameElement
  const open = root.querySelector('.lid-open') as HTMLAnchorElement
  const skip = root.querySelector('[data-skip]') as HTMLAnchorElement
  skip.addEventListener('click', e => { e.preventDefault(); open.focus() })

  // the demo starts paused if the site is, and follows the switch afterwards
  const post = () => { try { frame.contentWindow?.postMessage({ type: 'li:site', paused: sitePaused() }, location.origin) } catch { /* cross-origin never matters here */ } }
  const onMsg = (e: MessageEvent) => {
    if (e.source !== frame.contentWindow || e.origin !== location.origin) return
    if (e.data && e.data.type === 'li:ready') { root.classList.add('is-ready'); post() }
  }
  window.addEventListener('message', onMsg)
  frame.addEventListener('load', () => { root.classList.add('is-ready'); post() })
  const mo = new MutationObserver(post); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  frame.src = `${SRC}?embed=1`
  return { dispose() { lab2d.dispose(); mo.disconnect(); window.removeEventListener('message', onMsg); frame.src = 'about:blank'; frame.remove(); host.innerHTML = '' } }
}
