// Contract for generative reels. A reel is ONE fragment shader (GLSL ES 1.00 style:
// gl_FragColor, texture2D) that runs full-screen. It must work in both:
//   - three.js ShaderMaterial (the TV screen, rendered into a WebGLRenderTarget), and
//   - the raw WebGL2 runner in ./mini.ts (index previews, the case view background).
// Uniforms every reel may use (all are always provided):
//   uniform float uTime;   // seconds
//   uniform vec2  uRes;    // render target size in px
//   uniform vec2  uMouse;  // 0..1, (0.5,0.5) when idle
//   uniform float uNight;  // 1 = dark page, 0 = light page (reels are always self-lit; use for accent only)
//   uniform float uSeed;   // 0..1 per mount
//   uniform float uIntensity; // 0..1, 1 = hero/fullscreen, lower = calmer preview
// The shader must start with `precision highp float;` and declare the uniforms it uses.
export interface ReelDef {
  id: string            // stable id, e.g. 'ember'
  projectId: string     // id in src/data/projects.json
  title: string         // short reel title shown on the device ("Ember")
  medium: string        // one-line description of what the visual is, honest, e.g. "Generative flame, after the app's mascot"
  colors: { bg: string; ink: string; accent: string } // dominant colours, for UI tinting and screen-as-light
  frag: string
}
