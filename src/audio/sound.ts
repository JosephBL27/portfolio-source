// PNEUMA sound: every event is synthesized with WebAudio, nothing is sampled, nothing autoplays.
// The AudioContext is created on the first enable() (call it from a user gesture).
// Chain: voices -> master gain (-12 dB) -> DynamicsCompressor (-18 dB, 4:1) -> destination,
// with a short synthetic "tube" convolution send so hits sound like they happen inside brass and glass.
import { state, setSound } from '../state'

type Ctx = BaseAudioContext
interface Graph { ctx: Ctx; out: AudioNode; space: AudioNode; noise: AudioBuffer }

const MASTER_DB = -12
const db = (d: number) => Math.pow(10, d / 20)
const PREF = 'pneuma-sound'

// ---------- shared building blocks (work on AudioContext and OfflineAudioContext) ----------

export function makeNoise(ctx: Ctx, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

/** Short, dark, slightly metallic impulse response: a hard tube, not a hall. */
export function makeTubeIR(ctx: Ctx): AudioBuffer {
  const sr = ctx.sampleRate, len = Math.floor(sr * 0.42)
  const ir = ctx.createBuffer(2, len, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / sr
      const env = Math.exp(-t / 0.075) * (i < 24 ? i / 24 : 1)
      lp += 0.32 * ((Math.random() * 2 - 1) - lp) // one-pole lowpass: darker tail
      // a faint comb at ~3.1 ms gives the "inside a pipe" colour
      const comb = 1 + 0.35 * Math.cos(2 * Math.PI * t * (322 + ch * 9))
      d[i] = lp * env * comb
    }
  }
  return ir
}

function buildGraph(ctx: Ctx, dest: AudioNode, masterGain: number): Graph & { master: GainNode } {
  const master = ctx.createGain()
  master.gain.value = masterGain
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18; comp.ratio.value = 4; comp.knee.value = 8
  comp.attack.value = 0.003; comp.release.value = 0.16
  // gentle top-end tame so noise never fizzes on laptop speakers
  const shelf = ctx.createBiquadFilter()
  shelf.type = 'highshelf'; shelf.frequency.value = 7000; shelf.gain.value = -4
  master.connect(comp); comp.connect(shelf); shelf.connect(dest)

  const conv = ctx.createConvolver()
  conv.buffer = makeTubeIR(ctx)
  const ret = ctx.createGain(); ret.gain.value = 0.55
  conv.connect(ret); ret.connect(master)
  return { ctx, out: master, space: conv, noise: makeNoise(ctx), master }
}

function noiseSrc(g: Graph, t: number, dur: number): AudioBufferSourceNode {
  const s = g.ctx.createBufferSource()
  s.buffer = g.noise
  s.loop = true
  // random start offset so consecutive hits never share a waveform
  s.start(t, Math.random() * (g.noise.duration - 0.6), dur + 0.05)
  return s
}

function env(g: Graph, t: number, peak: number, attack: number, decay: number): GainNode {
  const v = g.ctx.createGain()
  v.gain.setValueAtTime(0.0001, t)
  v.gain.exponentialRampToValueAtTime(peak, t + attack)
  v.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  return v
}

function panner(g: Graph, pan: number): AudioNode {
  const p = g.ctx.createStereoPanner()
  p.pan.value = Math.max(-1, Math.min(1, pan))
  return p
}

const jit = (amt: number) => 1 + (Math.random() * 2 - 1) * amt

// ---------- voices ----------

/** Send: air rushes in as a bandpass sweeps 300 -> 1800 Hz over 180 ms, under a 70 Hz thump. */
function vThwoop(g: Graph, t: number, pan = 0) {
  const { ctx } = g
  const p = panner(g, pan); p.connect(g.out)
  const send = ctx.createGain(); send.gain.value = 0.22; p.connect(send); send.connect(g.space)

  // air: two bandpassed noise layers, the upper one an octave above for breath
  const n = noiseSrc(g, t, 0.26)
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2
  bp.frequency.setValueAtTime(300 * jit(0.04), t)
  bp.frequency.exponentialRampToValueAtTime(1800 * jit(0.04), t + 0.18)
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200
  const e = env(g, t, 0.95, 0.005, 0.22)
  n.connect(bp); bp.connect(lp); lp.connect(e); e.connect(p)

  const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.Q.value = 2.2
  bp2.frequency.setValueAtTime(600, t)
  bp2.frequency.exponentialRampToValueAtTime(3400, t + 0.16)
  const e2 = env(g, t + 0.012, 0.22, 0.02, 0.15)
  n.connect(bp2); bp2.connect(e2); e2.connect(p)

  // thump: 70 Hz sine, 60 ms, pitch falls a little so it lands instead of hums
  const o = ctx.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(92, t)
  o.frequency.exponentialRampToValueAtTime(64, t + 0.06)
  const eo = env(g, t, 0.85, 0.003, 0.062)
  o.connect(eo); eo.connect(g.out)
  o.start(t); o.stop(t + 0.1)
}

/** Travel: noise at 900 Hz, amplitude-modulated near 30 Hz, panned to the capsule. */
let lastRattlePan: StereoPannerNode | null = null
function vRattle(g: Graph, t: number, pan = 0, ms = 400) {
  const { ctx } = g
  const dur = Math.max(0.08, ms / 1000)
  const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(g.out)
  lastRattlePan = p

  const n = noiseSrc(g, t, dur)
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3.2
  bp.frequency.setValueAtTime(820, t)
  bp.frequency.linearRampToValueAtTime(980, t + dur) // the faintest doppler lift as it travels

  // AM: 30 Hz with a slow wobble on the rate so it reads as a capsule knocking, not a buzzer
  const am = ctx.createGain(); am.gain.value = 0.55
  const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 30
  const wob = ctx.createOscillator(); wob.frequency.value = 6.5
  const wobAmt = ctx.createGain(); wobAmt.gain.value = 3.5
  wob.connect(wobAmt); wobAmt.connect(lfo.frequency)
  const depth = ctx.createGain(); depth.gain.value = 0.45
  lfo.connect(depth); depth.connect(am.gain)

  const e = ctx.createGain()
  e.gain.setValueAtTime(0.0001, t)
  e.gain.exponentialRampToValueAtTime(1.15, t + 0.04)
  e.gain.setValueAtTime(1.15, t + Math.max(0.04, dur - 0.09))
  e.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  n.connect(bp); bp.connect(am); am.connect(e); e.connect(p)

  // a low body under the knock so it has weight in the tube
  const lb = ctx.createBiquadFilter(); lb.type = 'bandpass'; lb.frequency.value = 240; lb.Q.value = 1.4
  const le = ctx.createGain(); le.gain.value = 0.35
  n.connect(lb); lb.connect(le); le.connect(am)

  lfo.start(t); wob.start(t); lfo.stop(t + dur + 0.05); wob.stop(t + dur + 0.05)
}

/** Arrive: 180 + 260 Hz decaying sines (120 ms) with a 1 ms click as the capsule seats. */
function vClunk(g: Graph, t: number) {
  const { ctx } = g
  const send = ctx.createGain(); send.gain.value = 0.3; send.connect(g.space)
  for (const [f, a] of [[180, 0.7], [260, 0.45]] as const) {
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(f * 1.06, t)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.02)
    const e = env(g, t, a, 0.0015, 0.12)
    o.connect(e); e.connect(g.out); e.connect(send)
    o.start(t); o.stop(t + 0.16)
  }
  // click: 1 ms of bright noise
  const n = noiseSrc(g, t, 0.01)
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200
  const ec = ctx.createGain()
  ec.gain.setValueAtTime(0.0001, t)
  ec.gain.linearRampToValueAtTime(0.7, t + 0.0003)
  ec.gain.exponentialRampToValueAtTime(0.0001, t + 0.0012)
  n.connect(hp); hp.connect(ec); ec.connect(g.out); ec.connect(send)
  // felt thud: a breath of lowpassed noise behind the tone
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420
  const et = env(g, t, 0.5, 0.002, 0.045)
  n.connect(lp); lp.connect(et); et.connect(g.out)
}

/** Cap twist: 3 ms high-passed (3 kHz) tick with a little metal ring, pitch varied per detent. */
function vRatchet(g: Graph, t: number) {
  const { ctx } = g
  const n = noiseSrc(g, t, 0.02)
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000
  const ring = ctx.createBiquadFilter(); ring.type = 'peaking'
  ring.frequency.value = 4600 * jit(0.08); ring.Q.value = 9; ring.gain.value = 9
  const e = ctx.createGain()
  e.gain.setValueAtTime(0.0001, t)
  e.gain.linearRampToValueAtTime(0.5 * jit(0.15), t + 0.0004)
  e.gain.exponentialRampToValueAtTime(0.0001, t + 0.003)
  n.connect(hp); hp.connect(ring); ring.connect(e); e.connect(g.out)
}

/** Brain pulse: E5 + B5, soft sines, 600 ms release, -24 dB, a little glass in the tail. */
function vPulse(g: Graph, t: number) {
  const { ctx } = g
  const bus = ctx.createGain(); bus.gain.value = db(-24) * 2.5 // lands near -24 dBFS peak after the master chain
  bus.connect(g.out)
  const send = ctx.createGain(); send.gain.value = 0.5; bus.connect(send); send.connect(g.space)
  for (const [f, a, d] of [[659.25, 0.62, 0], [987.77, 0.38, 0.018], [1318.5, 0.07, 0.03]] as const) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
    const e = ctx.createGain()
    e.gain.setValueAtTime(0.0001, t + d)
    e.gain.exponentialRampToValueAtTime(a, t + d + 0.012)
    e.gain.setTargetAtTime(0.0001, t + d + 0.03, 0.6 / 4.6) // ~600 ms to silence
    o.connect(e); e.connect(bus)
    o.start(t + d); o.stop(t + d + 0.9)
  }
}

/** Ambient traffic: a very soft "pff" of air, at most 2 per second. */
function vTick(g: Graph, t: number) {
  const { ctx } = g
  const n = noiseSrc(g, t, 0.06)
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9
  bp.frequency.setValueAtTime(1500 * jit(0.2), t)
  bp.frequency.exponentialRampToValueAtTime(700, t + 0.045)
  const e = env(g, t, db(-32) * 12, 0.006, 0.05) // lands near -32 dBFS peak
  const p = panner(g, (Math.random() * 2 - 1) * 0.6)
  n.connect(bp); bp.connect(e); e.connect(p); p.connect(g.out)
}

// ---------- live engine ----------

let live: (Graph & { master: GainNode; ctx: AudioContext }) | null = null
let on = false
let lastTick = 0
let suspendTimer = 0

function now() { return live!.ctx.currentTime + 0.004 }

function setLevel(target: number, tc = 0.03) {
  if (!live) return
  const g = live.master.gain, t = live.ctx.currentTime
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(target, t, tc)
}

function onVisibility() {
  if (!live) return
  if (document.hidden) {
    setLevel(0, 0.015)
    clearTimeout(suspendTimer)
    suspendTimer = window.setTimeout(() => { if (document.hidden) live?.ctx.suspend() }, 120)
  } else if (on) {
    clearTimeout(suspendTimer)
    live.ctx.resume().then(() => setLevel(db(MASTER_DB)))
  }
}

function ready(): boolean { return on && !!live && live.ctx.state === 'running' && !document.hidden }

export const sound = {
  /** Create (first time) and start the audio engine. Call from a user gesture. */
  async enable(): Promise<void> {
    if (!live) {
      const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (!AC) return
      const ctx = new AC({ latencyHint: 'interactive' })
      const g = buildGraph(ctx, ctx.destination, 0)
      live = { ...g, ctx }
      document.addEventListener('visibilitychange', onVisibility)
    }
    on = true
    clearTimeout(suspendTimer)
    try { await live.ctx.resume() } catch { /* stays suspended until the next gesture */ }
    setLevel(document.hidden ? 0 : db(MASTER_DB), 0.04)
    try { localStorage.setItem(PREF, '1') } catch { /* private mode */ }
    if (!state.sound) setSound(true)
  },
  /** Fade out and suspend. Every method becomes a no-op. */
  disable(): void {
    on = false
    try { localStorage.setItem(PREF, '0') } catch { /* private mode */ }
    if (live) {
      setLevel(0, 0.03)
      clearTimeout(suspendTimer)
      suspendTimer = window.setTimeout(() => { if (!on) live?.ctx.suspend() }, 200)
    }
    if (state.sound) setSound(false)
  },
  get on(): boolean { return on },
  thwoop(pan = 0): void { if (ready()) vThwoop(live!, now(), pan) },
  rattle(pan = 0, ms = 400): void { if (ready()) vRattle(live!, now(), pan, ms) },
  clunk(): void { if (ready()) vClunk(live!, now()) },
  ratchet(): void { if (ready()) vRatchet(live!, now()) },
  pulse(): void { if (ready()) vPulse(live!, now()) },
  tick(): void {
    if (!ready()) return
    const t = performance.now()
    if (t - lastTick < 500) return
    lastTick = t
    vTick(live!, now())
  },
}

/** Move the most recent rattle with its capsule (screen x mapped to -1..1). Optional extra. */
export function setRattlePan(pan: number): void {
  if (!lastRattlePan || !live) return
  lastRattlePan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), live.ctx.currentTime, 0.03)
}

/** True if the visitor turned sound on in an earlier visit. */
export function soundWasOn(): boolean {
  try { return localStorage.getItem(PREF) === '1' } catch { return false }
}

/** If sound was on last visit, turn it back on at the first pointer or key press (browsers forbid earlier). */
export function restoreSoundOnGesture(): void {
  if (!soundWasOn()) return
  const go = () => {
    removeEventListener('pointerdown', go, true); removeEventListener('keydown', go, true)
    if (!sound.on) void sound.enable()
  }
  addEventListener('pointerdown', go, true); addEventListener('keydown', go, true)
}

// ---------- offline render (lab + level checks) ----------

export type SoundName = 'thwoop' | 'rattle' | 'clunk' | 'ratchet' | 'pulse' | 'tick'
/** Render one voice through the real master chain offline; returns the stereo buffer. */
export async function renderOffline(name: SoundName, seconds = 1.2, sampleRate = 48000): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.floor(seconds * sampleRate), sampleRate)
  const g = buildGraph(ctx, ctx.destination, db(MASTER_DB))
  const t = 0.02
  const fn = { thwoop: () => vThwoop(g, t, 0), rattle: () => vRattle(g, t, 0, 400), clunk: () => vClunk(g, t),
    ratchet: () => vRatchet(g, t), pulse: () => vPulse(g, t), tick: () => vTick(g, t) }[name]
  fn()
  return ctx.startRendering()
}
