// Lab: the boot over a fake hero, plus a sound board. Query params for screenshots:
//   ?hold=0.64  freeze progress at 64% and never exit     ?slow=1  slow simulated network
//   ?night=1|0  force the theme
import { runBoot } from '../src/ui/boot'
import { sound, setRattlePan, renderOffline, type SoundName } from '../src/audio/sound'
import { state, setNight } from '../src/state'
import { site } from '../src/data'

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T
const qs = new URLSearchParams(location.search)

// fake page underneath, copy straight from site.json
const [first, last] = site.bio.name.split(' ')
$('#h1').innerHTML = `${first} <i></i> ${last}.`
$('#claim').textContent = site.bio.claim
$('#kicker').textContent = site.bio.name
setNight(qs.has('night') ? qs.get('night') === '1' : state.night)

/** Simulated loader shaped like the real weights: fonts 20, data 10, 3D chunk 50, shader warm-up 20. */
function simulate(slow = false) {
  const k = slow ? 2.6 : 1
  const t0 = performance.now()
  const steps: [number, number][] = [[260 * k, 0.2], [380 * k, 0.3], [620 * k, 0.55], [880 * k, 0.8], [1180 * k, 1]]
  return () => {
    const t = performance.now() - t0
    let p = 0
    for (const [at, v] of steps) if (t >= at) p = v
    // the 3D chunk streams, so ramp inside its window instead of one jump
    if (t > 380 * k && t < 880 * k) p = Math.max(p, 0.3 + 0.5 * ((t - 380 * k) / (500 * k)) ** 1.4)
    return p
  }
}

let busy = false
async function boot(mode: 'fresh' | 'slow' | 'repeat') {
  if (busy) return
  busy = true
  try { if (mode !== 'repeat') sessionStorage.removeItem('pneuma-booted'); else sessionStorage.setItem('pneuma-booted', '1') } catch {}
  const hold = qs.get('hold')
  const progress = hold != null ? () => +hold : simulate(mode === 'slow' || qs.has('slow'))
  const t = performance.now()
  await runBoot({ progress, maxMs: hold != null ? 1e9 : undefined })
  console.log(`boot ${mode} finished in ${Math.round(performance.now() - t)} ms`)
  busy = false
}

$('#replay').onclick = () => boot('fresh')
$('#replay-slow').onclick = () => boot('slow')
$('#replay-repeat').onclick = () => boot('repeat')
$('#night').onclick = () => { setNight(!state.night); $('#night').setAttribute('aria-pressed', String(state.night)) }
$('#night').setAttribute('aria-pressed', String(state.night))

const pan = $<HTMLInputElement>('#pan')
pan.oninput = () => { $('#panv').textContent = (+pan.value).toFixed(2) }
const snd = $('#snd')
const pads = [...document.querySelectorAll<HTMLButtonElement>('[data-s]')]
const syncSound = () => {
  snd.setAttribute('aria-pressed', String(sound.on)); snd.textContent = sound.on ? 'Sound off' : 'Sound on'
  pads.forEach(b => { b.disabled = !sound.on })
}
snd.onclick = async () => { if (sound.on) sound.disable(); else await sound.enable(); syncSound() }

/** Full send: thwoop, a rattle that travels left to right, then the clunk and the brain pulse. */
function fullSend() {
  sound.thwoop(-0.7)
  setTimeout(() => {
    sound.rattle(-0.7, 520)
    const t0 = performance.now()
    const step = () => { const f = (performance.now() - t0) / 520; setRattlePan(-0.7 + 1.4 * Math.min(1, f)); if (f < 1) requestAnimationFrame(step) }
    requestAnimationFrame(step)
  }, 150)
  setTimeout(() => sound.clunk(), 690)
  setTimeout(() => sound.pulse(), 820)
}
let ratchetTimer = 0
pads.forEach(b => b.onclick = () => {
  const p = +pan.value
  switch (b.dataset.s) {
    case 'thwoop': return sound.thwoop(p)
    case 'rattle': return sound.rattle(p, 400)
    case 'clunk': return sound.clunk()
    case 'ratchet': { // a 90 degree twist: two detents, 45 degrees apart
      sound.ratchet(); clearTimeout(ratchetTimer); ratchetTimer = window.setTimeout(() => sound.ratchet(), 70); return
    }
    case 'pulse': return sound.pulse()
    case 'tick': return sound.tick()
    case 'send': return fullSend()
  }
})

// level check for the lead / tuning: renders each voice offline through the real master chain
;(window as any).__levels = async () => {
  const out: Record<string, { peakDb: number; rmsDb: number; ms: number }> = {}
  for (const n of ['thwoop', 'rattle', 'clunk', 'ratchet', 'pulse', 'tick'] as SoundName[]) {
    const b = await renderOffline(n)
    const d = b.getChannelData(0), e = b.getChannelData(1)
    let pk = 0, sum = 0, cnt = 0, lastLoud = 0
    for (let i = 0; i < d.length; i++) {
      const v = Math.max(Math.abs(d[i]), Math.abs(e[i])); if (v > pk) pk = v
      if (v > 0.001) { sum += d[i] * d[i] + e[i] * e[i]; cnt += 2; lastLoud = i }
    }
    out[n] = { peakDb: +(20 * Math.log10(pk || 1e-9)).toFixed(1), rmsDb: +(10 * Math.log10(sum / Math.max(1, cnt) || 1e-12)).toFixed(1), ms: Math.round(lastLoud / b.sampleRate * 1000) }
  }
  return out
}
;(window as any).__boot = boot

boot('fresh')
