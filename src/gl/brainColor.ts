// Colour modes of the glass brain and of its particle form. One shared state and one shared GLSL block, so the glass and the
// particles are always the same colour at the same moment.
//
//   0 folders   Obsidian's own folder colours (the default)
//   1 thermal   heat = how connected a note is (its degree in the vault graph): deep blue, violet, orange, white-gold
//   2 ivory     one warm monochrome, brightest where a note has the most links
//   3 spectral  a hue sweep along the length of the brain, drifting slowly
//
// A mode change does not cross-fade: the new mode arrives as a front that sweeps from the back of the brain to the front
// (about 1.8 s), and colour waves travel along every link in the current mode's accent.
import { Color } from 'three'

export const MODE_NAMES = ['folders', 'thermal', 'ivory', 'spectral'] as const
export type BrainModeName = (typeof MODE_NAMES)[number]
export const SWEEP_S = 1.8

type Listener = (mode: number, name: BrainModeName) => void
const listeners: Listener[] = []
export const brainMode = {
  cur: 0, prev: 0,
  /** performance.now() at the last change; -1e9 = long ago (settled) */
  at: -1e9,
  /** 0 .. 1.5: how far the front of the new mode has swept (>= 1.4 is settled) */
  sweep(): number { return Math.min(1.5, ((performance.now() - this.at) / 1000 / SWEEP_S) * 1.5) },
  get name(): BrainModeName { return MODE_NAMES[this.cur] },
  set(m: number, instant = false) {
    m = ((Math.round(m) % MODE_NAMES.length) + MODE_NAMES.length) % MODE_NAMES.length
    if (m === this.cur) return
    this.prev = this.cur; this.cur = m; this.at = instant ? -1e9 : performance.now()
    for (const l of listeners) l(m, MODE_NAMES[m])
  },
  next(instant = false) { this.set(this.cur + 1, instant) },
  onChange(l: Listener) { listeners.push(l); return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1) } },
}

/**
 * Obsidian graph-view folder colours for the vault's ten groups, re-tuned for additive light. Obsidian's own pastels (green projects, yellow areas,
 * teal resources, ...) sum to white wherever notes overlap, so the ten read as one pastel haze; here each keeps its hue family but with more chroma and a
 * mid lightness, which stays distinct after additive blending and bloom. Anything not listed is grey. The legend (brainmode.ts) draws these same values.
 */
export const OBSIDIAN_COLORS: Record<string, string> = {
  '00 Inbox': '#e9dbb0', '10 Projects': '#6bd447', '20 Areas': '#f2bf16', '30 Resources': '#12c2bd', '40 Archives': '#7f91ab',
  '50 Daily': '#3d8bff', '60 People': '#ff4a6b', '70 Meetings': '#ff8a2b', '90 Meta': '#b05cff', other: '#8fa1a8',
}
/** the legend: the ten groups, in vault order, by folder name only (no numeric prefix, never a note title) */
export const FOLDER_LEGEND: { key: string; name: string }[] = [
  { key: '00 Inbox', name: 'Inbox' }, { key: '10 Projects', name: 'Projects' }, { key: '20 Areas', name: 'Areas' }, { key: '30 Resources', name: 'Resources' },
  { key: '40 Archives', name: 'Archives' }, { key: '50 Daily', name: 'Daily' }, { key: '60 People', name: 'People' }, { key: '70 Meetings', name: 'Meetings' },
  { key: '90 Meta', name: 'Meta' }, { key: 'other', name: 'Other' },
]
export const folderColor = (name: string) => new Color(OBSIDIAN_COLORS[name] ?? OBSIDIAN_COLORS.other)

/**
 * GLSL: bc(mode, sweep, folder, heat, zn, ph, wave, t)
 *   mode  vec2(current, previous)      sweep  brainMode.sweep()      folder  the folder colour (linear rgb)
 *   heat  0..1 (degree)                zn     0 at the back .. 1 at the front of the brain
 *   ph    per-element random 0..1      wave   0..1, a colour wave passing through this element
 */
export const BRAIN_COLOR_GLSL = /* glsl */ `
vec3 bc_hsv(vec3 c) { vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }
vec3 bc_thermal(float h) {
  h = clamp(h, 0.0, 1.0);
  vec3 c0 = vec3(0.05, 0.09, 0.34), c1 = vec3(0.40, 0.11, 0.62), c2 = vec3(0.93, 0.27, 0.20), c3 = vec3(1.0, 0.72, 0.20), c4 = vec3(1.0, 0.96, 0.82);
  return h < 0.25 ? mix(c0, c1, h * 4.0) : h < 0.5 ? mix(c1, c2, (h - 0.25) * 4.0) : h < 0.75 ? mix(c2, c3, (h - 0.5) * 4.0) : mix(c3, c4, (h - 0.75) * 4.0);
}
vec3 bc_mode(float mode, vec3 folder, float heat, float zn, float ph, float wave, float t) {
  vec3 c, wc;
  if (mode < 0.5) { c = folder * 0.8; wc = mix(folder, vec3(1.0), 0.35) * 0.9; }
  else if (mode < 1.5) { c = bc_thermal(0.1 + 0.8 * heat); wc = bc_thermal(0.45 + 0.55 * heat + 0.2); }
  else if (mode < 2.5) {
    // ivory: a warm monochrome. Its per-note gain is capped (peak 0.50, wave 0.56, both under the ~0.85 where additive overlap plus bloom turns the whole brain into
    // a white blob), and each lobe's folder tint contributes its luminance so the lobes and the fissure between them keep an edge.
    float lum = dot(folder, vec3(0.3, 0.55, 0.15));
    c = mix(vec3(0.20, 0.175, 0.14), vec3(0.42, 0.385, 0.325), heat) * (0.5 + 1.6 * lum);
    c = min(c, vec3(0.50, 0.46, 0.39)) * 0.38;
    wc = vec3(0.56, 0.40, 0.21) * 0.38;
  }
  else { float hue = fract(zn * 0.9 - t * 0.045 + ph * 0.05); c = bc_hsv(vec3(hue, 0.62, 0.95)); wc = bc_hsv(vec3(fract(hue + 0.5), 0.3, 1.0)); }
  return mix(c, wc, clamp(wave, 0.0, 1.0));
}
vec3 bc(vec2 mode, float sweep, vec3 folder, float heat, float zn, float ph, float wave, float t) {
  float k = smoothstep(0.0, 0.35, sweep - zn);
  return mix(bc_mode(mode.y, folder, heat, zn, ph, wave, t), bc_mode(mode.x, folder, heat, zn, ph, wave, t), k);
}
/** a wave running along a link: s = 0..1 along it, ph = the link's own phase */
float bc_wave(float s, float ph, float t) {
  float c = fract(t * 0.2 + ph) * 1.6 - 0.3;
  float d = (s - c) * 5.5;
  return exp(-d * d);
}
`
