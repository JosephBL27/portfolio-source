// Gooey line reveal for case-view body text. A port of VengeanceUI's gooey-text-reveal (github.com/Ashutoshx7/VengeanceUI,
// MIT, pinned 87f5a77) from React + GSAP to vanilla TS + anime.js 4.5. The pattern is the upstream one: each line of a
// paragraph starts blurred, an SVG alpha threshold turns the blur into gooey blobs, and the blur clears line by line
// (outQuart) once the paragraph reaches the scroller. The timings are shorter than upstream on purpose ("legible fast"):
// 1.0 s per line and a 70 ms stagger, so a nine-line summary is sharp within about 1.6 s (upstream 1.5 s and 0.1 s).
// Anime owns the split and the trigger. splitText waits for document.fonts.ready, re-splits when its width changes
// (its own ResizeObserver, 150 ms debounce) and reverts to the original HTML on every re-split, so no line wrapper survives.
// The threshold class is removed when the reveal ends, so settled text carries no filter and costs nothing over the WebGL reel.
import { animate, onScroll, splitText, stagger } from 'animejs'
import { isRm } from '../v3/ui/util'

const FILTER_ID = 'cv-gooey'                  // no digits: the id never reaches an interpolated value
const DURATION = 1000                         // ms per line (upstream 1.5 s; shortened so the paragraph reads fast)
const STAGGER = 70                            // ms between lines (upstream 0.1 s)
const BLUR_EM = 0.35                          // starting blur in em (upstream blurAmount)
const START = '80% top'                       // anime's string order is container then target: the target's top reaches 80% of the scroller (GSAP "top 80%")
// anime fires enter only while the scroll sits inside the window [enter, leave): a fast scroll that jumps past a short window never reveals.
// A numeric leave of -1e9 keeps the window open to the end of the document; repeat: false makes the reveal one-shot.
const LEAVE_NEVER = -1e9

export interface Gooey {
  /** Splits the paragraph and makes its scroll trigger. Call once the case is at rest (after the fly): anime measures the scroller and the target when a trigger is made. */
  arm(): void
  /** Reverts the split and drops the trigger. */
  dispose(): void
}

// the upstream feColorMatrix: alpha = 255a - 140, a hard threshold at about 55% coverage (colour channels untouched).
// The filter region is tighter than upstream's 200% x 200%: lines are never scaled, the blur's halo is under the threshold
// well before 2% of a line's width (about 18 px), so the region only costs raster area (1.04 x 2.0 of the box against 2.0 x 2.0: about 1.9x less).
function mountFilter() {
  if (document.getElementById(FILTER_ID)) return
  document.body.insertAdjacentHTML('beforeend',
    `<svg aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;pointer-events:none"><defs>` +
    `<filter id="${FILTER_ID}" x="-2%" y="-50%" width="104%" height="200%">` +
    `<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140"/>` +
    `</filter></defs></svg>`)
}

// each line gets one inner block that carries the blur, so the threshold on the line never composes with the tween's own filter.
// The space the split drops at a line break goes back as a trailing space: a line box holding only collapsible whitespace has no
// height and paints nothing, but textContent, copy and screen readers then see the paragraph as written.
function wrapLine(line: HTMLElement, last: boolean): HTMLElement {
  const inner = document.createElement('span')
  inner.className = 'cv-gl__i'
  while (line.firstChild) inner.append(line.firstChild)
  line.append(inner)
  if (!last) line.append(' ')
  return inner
}

// Reveal one paragraph line by line. Nothing is split or animated until arm(): the case's fly moves the scroller and the
// paragraph, and anime measures both when a trigger is made, so the split and the trigger wait for the case to be at rest.
export function gooeyLines(el: HTMLElement, scroller: HTMLElement | null): Gooey {
  if (isRm()) return { arm() {}, dispose() {} }   // reduced motion: the text stays as written, no split and no filter
  let split: ReturnType<typeof splitText> | null = null
  let disposed = false, played = false, settled = false
  return {
    arm() {
      if (split || disposed || isRm()) return   // isRm() again: "Still" or the OS setting may have changed since construction
      mountFilter()
      split = splitText(el, { lines: { class: 'cv-gl' }, accessible: false })   // anime splits once the fonts have settled
      const s = split
      // a face still loading at the split is re-split once it has settled, so the lines match the final faces
      if (document.fonts.status === 'loading') document.fonts.ready.then(() => { if (!disposed) s.refresh() })
      // the effect runs on every (re-)split. keepTime carries a running reveal's progress across a re-split; a finished one is not replayed.
      s.addEffect(self => {
        const lines = self.lines as HTMLElement[]
        const inners = lines.map((l, i) => wrapLine(l, i === lines.length - 1))
        if (settled || isRm()) return undefined
        lines.forEach(l => l.classList.add('is-gooey'))
        return animate(inners, {
          filter: [`blur(${BLUR_EM}em)`, 'blur(0em)'],
          duration: DURATION,
          ease: 'outQuart',
          delay: stagger(STAGGER),
          autoplay: played ? true : onScroll({ container: scroller ?? undefined, target: el, enter: START, leave: LEAVE_NEVER, repeat: false }),
          onBegin: () => { played = true },
          onComplete: () => {
            settled = true
            lines.forEach(l => l.classList.remove('is-gooey'))
            inners.forEach(i => { i.style.filter = '' })
          },
        })
      })
    },
    dispose() { disposed = true; split?.revert() },
  }
}
