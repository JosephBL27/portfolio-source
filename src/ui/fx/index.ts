// 21st-style vector effects (unit 14V). Importing this module loads the stylesheet (the border beam on the "Open case study" button works from CSS alone).
import './fx.css'
export { buildDiagram, type Diagram } from './diagram'
export { attachSpotlight } from './spotlight'
export { attachBeams } from './beams'
/** a few meteors drifting across a faint grid, for behind a case-view header; returns the layer (decorative) */
export function buildHeaderFx(): HTMLElement {
  const fx = document.createElement('i'); fx.className = 'cv-fx'; fx.setAttribute('aria-hidden', 'true')
  const xs = [78, 52, 92, 64, 38]
  xs.forEach((x, k) => { const m = document.createElement('i'); m.className = 'cv-fx__m'; m.style.cssText = `--x:${x}%;--d:${(5.2 + (k % 3) * 1.1).toFixed(1)}s;--w:${(k * 2.3 + 0.8).toFixed(1)}s`; fx.append(m) })
  return fx
}
