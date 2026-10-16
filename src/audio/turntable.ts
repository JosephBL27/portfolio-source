// The turntable's sound: a 30-second preview played through its own Web Audio graph with a gentle vinyl voicing, a looped crackle bed and a
// needle-drop thump. The site's engine (sfx.ts) keeps its AudioContext private, so this module owns a second, small one; it only ever makes
// sound while the visitor has the site's sound switched on (callers check sfx.enabled; stop() is idempotent and cheap).
//   preview -> <audio crossOrigin=anonymous> -> MediaElementSource -> highpass 38 Hz -> lowshelf +1.5 dB -> peaking dip -> lowpass 11 kHz -> gain
//   crackle  -> looped buffer of pops + hiss -> bandpass -> gain (stays under the music, rises in the run-out)
// If the preview host refused CORS the element is rebuilt without crossOrigin ("plain" mode): the preview plays straight through the element,
// the crackle bed still plays through the context.
export interface Track { title: string; artist: string; itunesId?: number; previewUrl?: string; artwork?: string; note?: string; vibe?: unknown }
/** live band levels 0..1 (smoothed) and onset impulses (1 on the hit, decaying); `real` is false when the preview plays without an analyser (CORS refused) */
export interface Bands { sub: number; bass: number; mid: number; high: number; level: number; beat: number; snare: number; real: boolean }
export type Mode = 'idle' | 'graph' | 'plain'

type Ctx = AudioContext
let ctx: Ctx | null = null
let master: GainNode | null = null
let crackle: { src: AudioBufferSourceNode; gain: GainNode } | null = null
let el: HTMLAudioElement | null = null
let elSrc: MediaElementAudioSourceNode | null = null
let chainIn: GainNode | null = null
let mode: Mode = 'idle'
let track: Track | null = null
let wantPlay = false
let endedCb: (() => void) | null = null
let errorCb: ((why: string) => void) | null = null
let ready = false
let gen = 0
let fadeIn = 0.4
let analyser: AnalyserNode | null = null
let fft: Uint8Array<ArrayBuffer> | null = null
// v19 (unit 15M): a second, finer read-only tap for the room's visuals: a 2048-point spectrum folded into SPEC_N log-spaced bins, and a true L / R level (VU)
export const SPEC_N = 48
let analyserS: AnalyserNode | null = null, fftS: Uint8Array<ArrayBuffer> | null = null
let anL: AnalyserNode | null = null, anR: AnalyserNode | null = null, tdL: Float32Array<ArrayBuffer> | null = null, tdR: Float32Array<ArrayBuffer> | null = null
const SPEC = new Float32Array(SPEC_N), VU = { l: 0, r: 0 }
const B: Bands = { sub: 0, bass: 0, mid: 0, high: 0, level: 0, beat: 0, snare: 0, real: false }
let bAvg = 0, hAvg = 0, lastBands = -1, lastBeatAt = 0, lastSnareAt = 0

function makeCrackle(c: Ctx): AudioBuffer {
  const sr = c.sampleRate, len = Math.floor(sr * 4), buf = c.createBuffer(2, len, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.08; d[i] = lp * 0.05 }       // soft hiss
    const pops = 18 + Math.floor(Math.random() * 10)
    for (let p = 0; p < pops; p++) {
      const at = Math.floor(Math.random() * (len - 400)), amp = (0.25 + Math.random() * 0.75) * (Math.random() < 0.12 ? 1 : 0.4), w = 3 + Math.floor(Math.random() * 40)
      for (let k = 0; k < w; k++) d[at + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k / (w * 0.35))
    }
  }
  return buf
}

function ensure(): Ctx | null {
  if (ctx) return ctx
  const AC: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC({ latencyHint: 'interactive' })
  master = ctx.createGain(); master.gain.value = 0.9
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.knee.value = 12
  master.connect(comp); comp.connect(ctx.destination)
  // the record's voicing: a touch of low warmth, a small dip in the upper mids, the top rolled off
  chainIn = ctx.createGain()
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = 0.6
  const ls = ctx.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = 180; ls.gain.value = 1.5
  const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 3200; pk.Q.value = 0.8; pk.gain.value = -1.5
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(11000, ctx.sampleRate * 0.4); lp.Q.value = 0.5
  chainIn.connect(hp); hp.connect(ls); ls.connect(pk); pk.connect(lp); lp.connect(master)
  // a read-only tap for the world's visuals (unconnected output: it never changes the sound)
  analyser = ctx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.55; fft = new Uint8Array(analyser.frequencyBinCount)
  lp.connect(analyser)
  analyserS = ctx.createAnalyser(); analyserS.fftSize = 2048; analyserS.smoothingTimeConstant = 0.35; analyserS.minDecibels = -88; analyserS.maxDecibels = -12; fftS = new Uint8Array(analyserS.frequencyBinCount); lp.connect(analyserS)
  const split = ctx.createChannelSplitter(2); anL = ctx.createAnalyser(); anR = ctx.createAnalyser(); anL.fftSize = anR.fftSize = 512
  tdL = new Float32Array(anL.fftSize); tdR = new Float32Array(anR.fftSize); lp.connect(split); split.connect(anL, 0); split.connect(anR, 1)
  return ctx
}

function crackleOn(level: number, fade = 0.4) {
  const c = ensure(); if (!c || !master) return
  if (!crackle) {
    const src = c.createBufferSource(); src.buffer = makeCrackle(c); src.loop = true
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.35
    const gain = c.createGain(); gain.gain.value = 0
    src.connect(bp); bp.connect(gain); gain.connect(master)
    src.start(); crackle = { src, gain }
  }
  const g = crackle.gain.gain; g.cancelScheduledValues(c.currentTime); g.setTargetAtTime(level, c.currentTime, fade / 3)
}
function crackleOff(fade = 0.25) {
  if (!ctx || !crackle) return
  const { src, gain } = crackle; crackle = null
  gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setTargetAtTime(0, ctx.currentTime, fade / 3)
  try { src.stop(ctx.currentTime + fade + 0.3) } catch { /* already stopped */ }
}

/** the stylus meeting the groove: a soft low thump and a short burst of surface noise */
function thump() {
  const c = ensure(); if (!c || !master) return
  const t = c.currentTime
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25)
  const n = c.createBufferSource(); n.buffer = makeCrackle(c)
  const ng = c.createGain(); ng.gain.setValueAtTime(0.9, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
  n.connect(ng); ng.connect(master); n.start(t, Math.random() * 3); n.stop(t + 0.4)
}

function buildElement(cors: boolean, url: string, myGen: number): HTMLAudioElement {
  const a = new Audio()
  a.preload = 'auto'
  if (cors) a.crossOrigin = 'anonymous'
  a.src = url
  a.addEventListener('ended', () => { if (myGen === gen) { wantPlay = false; crackleOn(0.5, 0.6); endedCb?.() } })
  a.addEventListener('canplay', () => { if (myGen === gen) ready = true; if (myGen === gen && wantPlay) void startElement() })
  a.addEventListener('error', () => {
    if (myGen !== gen) return
    if (cors && !ready) {                                   // the host refused CORS (or the network blipped): retry as plain media playback
      try { a.removeAttribute('src'); a.load() } catch { /* */ }
      el = buildElement(false, url, myGen); mode = 'plain'; elSrc = null
      return
    }
    wantPlay = false; errorCb?.('The preview would not load.')
  })
  if (cors) {
    const c = ensure()
    if (c && chainIn) { try { elSrc = c.createMediaElementSource(a); elSrc.connect(chainIn); mode = 'graph' } catch { mode = 'plain'; elSrc = null } }
  } else mode = 'plain'
  return a
}

async function startElement() {
  if (!el) return
  const a = el
  try { await ctx?.resume() } catch { /* */ }
  try {
    a.volume = fadeIn > 0 ? 0 : 1
    await a.play()
    if (fadeIn > 0) { const t0 = performance.now(), d = fadeIn * 1000; const tick = () => { if (a !== el || !wantPlay) return; const k = Math.min(1, (performance.now() - t0) / d); a.volume = k; if (k < 1) requestAnimationFrame(tick) }; tick() }
  } catch (e) { if (wantPlay && (e as Error).name === 'NotAllowedError') errorCb?.('Tap the record to let the browser play it.') }
}

export const turntable = {
  /** call from the drop gesture: prepares the audio context and starts fetching the preview */
  load(t: Track): void {
    turntable.unload()
    track = t; gen++
    const c = ensure(); try { void c?.resume() } catch { /* */ }
    if (t.previewUrl) { ready = false; el = buildElement(true, t.previewUrl, gen) }
  },
  /** the music begins NOW (the click that put the record on is the gesture): a short fade-in, starting the moment it is buffered. Call needle() when the stylus lands. */
  start(fade = 0.4): void {
    if (!track || wantPlay) return
    wantPlay = true; fadeIn = fade
    if (el && (ready || el.readyState >= 3)) void startElement()
  },
  /** the stylus meets the groove: a low thump, surface noise that settles under the music */
  needle(): void {
    thump(); crackleOn(0.5, 0.25)
    window.setTimeout(() => { if (wantPlay) crackleOn(0.17, 0.8) }, 700)
  },
  /** both at once (the old behaviour: the needle has touched down, so the music starts with the thump) */
  play(): void {
    if (!track || wantPlay) return
    turntable.start(0); turntable.needle()
  },
  /** lift the arm: the music and the surface noise fall away (the position is kept, so setting the needle down again resumes) */
  pause(fade = 0.25): void {
    wantPlay = false
    crackleOff(fade)
    if (el) { const a = el, t0 = performance.now(); const v0 = a.volume; const tick = () => { const k = (performance.now() - t0) / (fade * 1000); if (k >= 1 || wantPlay) { if (!wantPlay) a.pause(); a.volume = 1; return } a.volume = v0 * (1 - k); requestAnimationFrame(tick) }; tick() }
  },
  rewind(): void { if (el) el.currentTime = 0 },
  unload(): void {
    gen++; wantPlay = false; ready = false
    crackleOff(0.1)
    if (el) { try { el.pause(); el.removeAttribute('src'); el.load() } catch { /* */ } }
    try { elSrc?.disconnect() } catch { /* */ }
    el = null; elSrc = null; track = null; mode = 'idle'
  },
  /** band levels + beat / snare impulses, sampled once per call (cheap: 512 bins). Zeros when nothing plays through the analyser. */
  bands(now = performance.now()): Bands {
    if (now === lastBands) return B
    const dt = lastBands < 0 ? 0.016 : Math.min(0.1, (now - lastBands) / 1000); lastBands = now
    B.beat *= Math.exp(-dt / 0.16); B.snare *= Math.exp(-dt / 0.12)
    if (!analyser || !fft || mode !== 'graph' || !turntable.playing) {
      B.real = false; for (const k of ['sub', 'bass', 'mid', 'high', 'level'] as const) B[k] *= Math.exp(-dt / 0.2)
      return B
    }
    analyser.getByteFrequencyData(fft)
    const bw = (ctx?.sampleRate ?? 44100) / 1024
    const avg = (f0: number, f1: number) => { const a = Math.max(1, Math.round(f0 / bw)), b = Math.min(fft!.length - 1, Math.round(f1 / bw)); let s = 0; for (let i = a; i <= b; i++) s += fft![i]; return s / ((b - a + 1) * 255) }
    const sub = avg(30, 70), bass = avg(70, 220), mid = avg(250, 2000), high = avg(2500, 9000)
    const k = 1 - Math.exp(-dt / 0.05)
    B.sub += (sub - B.sub) * k; B.bass += (bass - B.bass) * k; B.mid += (mid - B.mid) * k; B.high += (high - B.high) * k
    B.level = Math.min(1, (B.bass + B.mid + B.high) / 1.2); B.real = true
    // onsets: the low band jumping above its own running average (a kick / bass note), and the same for the highs (snare, hats)
    const bl = (sub + bass) / 2
    if (bl > bAvg * 1.28 + 0.04 && bl > 0.25 && now - lastBeatAt > 210) { B.beat = Math.min(1, 0.45 + (bl - bAvg) * 2.2); lastBeatAt = now }
    if (high > hAvg * 1.3 + 0.03 && high > 0.1 && now - lastSnareAt > 240) { B.snare = Math.min(1, 0.45 + (high - hAvg) * 3); lastSnareAt = now }
    const ka = 1 - Math.exp(-dt / 0.6); bAvg += (bl - bAvg) * ka; hAvg += (high - hAvg) * ka
    return B
  },
  /** v19: SPEC_N log-spaced band levels 0..1 (about 40 Hz to 12 kHz, high bands tilted up so the picture is not all bass) and the true left / right level 0..1.
   *  Read-only; zeros unless the preview plays through the analyser (`real` in bands()). Call once per frame (cheap: 1024 bins and two 512-sample reads). */
  spectrum(): { spec: Float32Array; l: number; r: number; real: boolean } {
    if (!analyserS || !fftS || mode !== 'graph' || !turntable.playing) { for (let i = 0; i < SPEC_N; i++) SPEC[i] *= 0.9; VU.l *= 0.9; VU.r *= 0.9; return { spec: SPEC, l: VU.l, r: VU.r, real: false } }
    analyserS.getByteFrequencyData(fftS)
    const bw = (ctx?.sampleRate ?? 44100) / 2048, f0 = 40, f1 = Math.min(12000, (ctx?.sampleRate ?? 44100) * 0.45)
    for (let i = 0; i < SPEC_N; i++) {
      const lo = f0 * Math.pow(f1 / f0, i / SPEC_N), hi = f0 * Math.pow(f1 / f0, (i + 1) / SPEC_N)
      const a = lo / bw, b = Math.max(a + 1, hi / bw)               // fractional bins: a band narrower than one bin still reads (linear interpolation)
      let s = 0, w = 0
      for (let k = Math.floor(a); k < Math.ceil(b) && k < fftS.length; k++) { const wk = Math.min(k + 1, b) - Math.max(k, a); if (wk > 0) { s += fftS[k] * wk; w += wk } }
      const v = w > 0 ? s / w / 255 : 0
      SPEC[i] = Math.min(1, v * (0.85 + 0.9 * i / SPEC_N))
    }
    if (anL && anR && tdL && tdR) {
      anL.getFloatTimeDomainData(tdL); anR.getFloatTimeDomainData(tdR)
      let a = 0, b = 0; for (let i = 0; i < tdL.length; i++) { a += tdL[i] * tdL[i]; b += tdR[i] * tdR[i] }
      const db = (x: number) => Math.max(0, Math.min(1, (20 * Math.log10(Math.sqrt(x / tdL!.length) + 1e-5) + 36) / 36))   // -36 dBFS .. 0 dBFS -> 0..1
      VU.l = db(a); VU.r = db(b)
    }
    return { spec: SPEC, l: VU.l, r: VU.r, real: true }
  },
  /** master level 0..1 (sound toggle, ducking) */
  setLevel(v: number): void { if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05) },
  onEnded(cb: (() => void) | null): void { endedCb = cb },
  onError(cb: ((why: string) => void) | null): void { errorCb = cb },
  get track(): Track | null { return track },
  get playing(): boolean { return !!el && !el.paused && !el.ended && wantPlay },
  get mode(): Mode { return mode },
  get currentTime(): number { return el?.currentTime ?? 0 },
  get duration(): number { return el && isFinite(el.duration) ? el.duration : 30 },
  /** QA hook */
  status(): { ctx: string; mode: Mode; t: number; paused: boolean; ready: boolean; crackle: boolean } {
    return { ctx: ctx?.state ?? 'none', mode, t: el?.currentTime ?? 0, paused: el?.paused ?? true, ready, crackle: !!crackle }
  },
}
