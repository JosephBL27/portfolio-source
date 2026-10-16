// ===================================================================================
// FORM CONTRACT (v3 "Metamorphoses"). Every chapter of the site is one FORM: a cloud of
// N particles. The engine morphs particle i of form A into particle i of form B.
//
// A form is two things:
//  1. build(): fill one RGBA texel of position data and one RGBA texel of colour per
//     particle. Static data, computed once at load (may be async, e.g. to load an image).
//  2. glsl (optional): a GLSL function that animates the static position every frame:
//
//        vec3 anim_<ID>(vec3 p, vec4 d, vec4 r, float t)
//          p = d.xyz (rest position, world units)     d = the position texel (w = your data)
//          r = per-particle random in [0,1)^4          t = time in seconds (0 when paused)
//        returns the animated position.
//
//     Optionally also `float size_<ID>(vec4 d, vec4 r, float t)` (point size multiplier,
//     default 1.0) and `vec4 color_<ID>(vec4 c, vec4 d, vec4 r, float t)` (default c).
//     Declare any uniforms you need at the top of `glsl` with the prefix u_<ID>_ and give
//     their initial values in `uniforms`; update them in `update()` (CPU, every frame).
//     <ID> must be a valid GLSL identifier fragment: lowercase letters, digits, '_'.
//
// World scale: forms live roughly inside a box of ±4 x ±2.5 x ±2 units centred at the
// origin, viewed by a PerspectiveCamera (fov ~35) from z ≈ 9. Particles are drawn as
// round additive points; pos.w is free for the form (pass size or ids through it).
// Colour: linear-ish 0..1 rgb; alpha (col.a) scales brightness (0 hides a particle).
// Particles you do not need: put them somewhere sensible (a faint dust shell) with
// small alpha — never all at one point (it makes a hot spot).
// ===================================================================================
export interface BuildCtx {
  count: number                  // number of particles (e.g. 262144 desktop, 65536 phone)
  rand: () => number             // seeded PRNG, deterministic per form
  /** load an image (from /public) and return its pixels, downscaled to fit maxSide */
  image(url: string, maxSide?: number): Promise<ImageData>
  /** draw text with a canvas font and return its alpha mask (1 = ink) */
  textMask(text: string, opts: { font: string; width: number; height: number; align?: CanvasTextAlign }): Promise<ImageData>
}
/** v10: how this form's particles are DRAWN (optional; defaults come from FORM_STYLE in engine/compose.ts, so a form file never has to set it).
 *  Every field is blended A -> B during a morph, so a leg between two differently styled forms changes look smoothly. */
export interface FormStyle {
  /** point shape: 'disc' (default soft disc), 'pixel' (hard square), 'ring' (hollow dot), 'streak' (dash, brushed grain) */
  shape?: 'disc' | 'pixel' | 'ring' | 'streak'
  /** multiplier on pointSize (default 1). Brightness is NOT compensated: use `gain` */
  size?: number
  /** edge: -1 = gaussian glow, 0 = default soft, 1 = hard-edged (default 0) */
  sharp?: number
  /** 0..1 lit-surface look: every dot shades like a little sphere lit by the hub screen, plus a radial macro normal (default 0) */
  solid?: number
  /** 0..1 alpha-like blending: the dot darkens what is behind it instead of only adding (default 0 = pure additive glow) */
  opaque?: number
  /** brightness multiplier (default 1); use it to pay back a size change */
  gain?: number
  /** 0..0.9: fraction of the particles hidden (a fixed pseudo-random subset). Pair it with a bigger `size` and a lower `gain`: fewer, larger dots read as distinct pixels / rings instead of fusing into a fill */
  thin?: number
  /** shape 'streak': aspect ratio of the dash (default 4); its direction follows the form's own x axis */
  streak?: number
}
export interface FormDef {
  id: string                                       // e.g. 'name', 'brain', 'pushup'
  build(ctx: BuildCtx, pos: Float32Array, col: Float32Array): void | Promise<void> // pos/col length = count*4
  glsl?: string
  uniforms?: Record<string, { value: any }>
  update?(t: number, dt: number): void
  /** preferred camera for this form */
  camera?: { pos: [number, number, number]; target: [number, number, number]; fov?: number }
  /** base point size in px at DPR 1 for a particle at distance 9 (default 2.0) */
  pointSize?: number
  /** 0..1, how much curl-noise drift the form keeps at rest (default 0.04) */
  drift?: number
  /** v10: render style (shape / size / sharpness / lit-surface / alpha feel); see FormStyle. Falls back to FORM_STYLE[id] in engine/compose.ts */
  style?: FormStyle
  /** optional anchors projected to the screen for DOM labels (world positions) */
  anchors?: { id: string; label: string; pos: [number, number, number] }[]
}
