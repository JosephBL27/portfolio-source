// SET PIECE (unit 8M): the mosaic.  leg table > market  (systems -> research).
// ALCHE's dark tile mosaic, made physical: the frame breaks into a grid of large square tiles, and the tiles flip like split-flap cards in a diagonal wave from
// the top left. The face of each card is a slice of the live view; its back is the same slice of the NEXT scene, seen from where the camera will land (a second
// camera into a render target, with the particle morph forced to the destination). Tiles carry a stepped brightness and a cast of the destination area's accent
// while the wave runs; the gutters between them show the dark ground. A pure function of leg progress u, so scrolling back flips every card back, in reverse.
//   u 0.05-0.11  the live view hands over to the tile faces (a short crossfade; the faces are a render target of the same camera)
//   u 0.10-0.80  the wave: each card starts at 0.10 + 0.36 x its diagonal rank and takes 0.34 (a slow lift, a swing, a small settle past flat)
//   u 0.84-0.93  the backs hand over to the real frame (the camera has been at the destination since u 0.80)
// The camera arrives early (flight leg compressed to u 0.80) so the backs and the real frame are the same picture. The particle field is hidden while the tiles
// cover it (setFieldAlpha through out.field), so the gutters are dark grout. Reduced motion never flies (host), so none of this shows: the form crossfade stays.
// Cue: tr:mosaic at u 0.16, the first cards go over.
import * as THREE from 'three'
import { type CamPose, type Env, type FrameIn, type FrameOut, type Leg, type Piece, precompile, sstep } from './common'
import { area } from '../../layout'
import { Capture, SOFT_GLSL, arriveBy, overlayBlend } from './collage'
import { LANE_GLSL, LANE_ON } from '../lib/lane'

const ARRIVE = 0.8, WAVE0 = 0.1, WAVE1 = 0.46, DUR = 0.34
const FADE_IN: [number, number] = [0.05, 0.11], FADE_OUT: [number, number] = [0.84, 0.93]

const VERT = /* glsl */ `
precision highp float;
attribute vec2 aCell; attribute vec2 aCorner;
uniform float uU; uniform vec2 uGrid;
varying vec2 vCenterUv; varying vec2 vLocal; varying float vAng; varying float vT; varying vec2 vCell;
const float PI = 3.14159265;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float outBack(float x) { x = clamp(x, 0.0, 1.0) - 1.0; return 1.0 + 2.0 * x * x * x + 1.0 * x * x; }
void main() {
  float cols = uGrid.x, rows = uGrid.y;
  float dx = aCell.x / max(1.0, cols - 1.0), dy = (rows - 1.0 - aCell.y) / max(1.0, rows - 1.0);   // row 0 is the bottom row: the top row ranks first
  float d = clamp(0.5 * dx + 0.5 * dy + (h21(aCell) - 0.5) * 0.07, 0.0, 1.0);
  float t = clamp((uU - mix(${WAVE0.toFixed(3)}, ${WAVE1.toFixed(3)}, d)) / ${DUR.toFixed(3)}, 0.0, 1.0);
  float s = t * t * (3.0 - 2.0 * t);
  float ang = PI * outBack(s);
  vec2 hf = 1.0 / uGrid;                                     // half a tile, in NDC
  vec2 c = (aCell + 0.5) / uGrid * 2.0 - 1.0;
  vec2 l = aCorner * hf * 0.985;                           // the grout
  float sn = sin(ang), cs = cos(ang);
  float z = l.y * sn;                                        // the top edge swings toward the viewer first
  float w = max(0.25, 1.0 - z * 1.25);
  vec2 ndc = c + vec2(l.x, l.y * cs) / w;
  gl_Position = vec4(vec3(ndc, -0.9 - z * 0.05) * w, w);
  vCenterUv = c * 0.5 + 0.5; vLocal = aCorner * 0.985; vAng = ang; vT = t; vCell = aCell;
}`

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTexA, uTexB;
uniform vec2 uGrid; uniform float uU, uFront, uBack, uCopy, uTint;
uniform vec3 uAccent;
varying vec2 vCenterUv; varying vec2 vLocal; varying float vAng; varying float vT; varying vec2 vCell;
${LANE_GLSL}
${SOFT_GLSL}
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec2 halfUv = 0.5 / uGrid;
  bool front = gl_FrontFacing;
  vec2 uv = vCenterUv + (front ? vLocal : vec2(vLocal.x, -vLocal.y)) * halfUv;   // the back is printed upright for the viewer: mirrored in the card's own y
  vec3 col = softClip(front ? texture2D(uTexA, uv).rgb : texture2D(uTexB, uv).rgb);
  float s = abs(sin(vAng));
  // stepped brightness per tile, a cast of the destination accent, a lit edge and a darkening as the card turns edge-on
  float step4 = floor(h21(vCell + 3.7) * 4.0) / 4.0;
  float flick = h21(vCell + floor(uU * 26.0));
  col *= 1.0 + (step4 - 0.4) * 0.34 * uTint;
  col = mix(col, col * (0.55 + 1.1 * uAccent), 0.22 * uTint * step4);
  // a key light high and in front: a card lifting its top edge turns away from it (dark), and flares as its back swings round into the light and lands
  float sa = sin(vAng), ca = cos(vAng);
  float lit = max(front ? (-0.55 * sa + 0.83 * ca) : (0.55 * sa - 0.83 * ca), 0.0);
  col *= mix(0.3, 1.0, min(lit / 0.83, 1.0));
  col += vec3(1.0, 0.93, 0.86) * 0.24 * pow(clamp(lit / 0.83, 0.0, 1.2), 9.0) * s;
  col += uAccent * 0.22 * pow(s, 3.0) * (0.5 + flick);
  float edge = smoothstep(0.86, 1.0, abs(vLocal.y) / 0.985) * (0.1 + 0.5 * s);
  col += vec3(1.0, 0.94, 0.88) * edge * 0.4;
  float a = front ? uFront : uBack;
  a *= 1.0 - uCopy * (1.0 - laneMask()) * 0.94;               // the copy lane stays the dark ground while copy is on screen
  gl_FragColor = vec4(col * a, a);
}`

export function createMosaic(leg: Leg): Piece {
  let ok = false
  const capA = new Capture(0.7), capB = new Capture(0.7)
  let mesh: THREE.Mesh | null = null
  let cols = 0, rows = 0
  const accent = new THREE.Color(area(leg.B.area)?.accent ?? '#FF6A8A')
  const U = {
    uTexA: { value: null as THREE.Texture | null }, uTexB: { value: null as THREE.Texture | null }, uGrid: { value: new THREE.Vector2(8, 5) },
    uU: { value: 0 }, uFront: { value: 0 }, uBack: { value: 1 }, uCopy: { value: 0 }, uTint: { value: 0 }, uAccent: { value: new THREE.Vector3(accent.r, accent.g, accent.b) },
    uLane: { value: null as THREE.Vector4 | null }, uRes: { value: null as THREE.Vector2 | null }, uLaneOn: LANE_ON,
  }
  const grid = (env: Env) => {
    const W = env.res.x, H = env.res.y, cell = Math.max(150, Math.min(W, H) / 5)
    return { c: Math.max(3, Math.min(14, Math.round(W / cell))), r: Math.max(3, Math.min(10, Math.round(H / cell))) }
  }
  const buildGeo = (c: number, r: number) => {
    const n = c * r, pos = new Float32Array(n * 12), cell = new Float32Array(n * 8), cor = new Float32Array(n * 8), idx: number[] = []
    const K: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) {
      const t = j * c + i
      for (let k = 0; k < 4; k++) { const v = t * 4 + k; cell[v * 2] = i; cell[v * 2 + 1] = j; cor[v * 2] = K[k][0]; cor[v * 2 + 1] = K[k][1]; pos[v * 3] = K[k][0]; pos[v * 3 + 1] = K[k][1] }
      idx.push(t * 4, t * 4 + 1, t * 4 + 2, t * 4, t * 4 + 2, t * 4 + 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCell', new THREE.BufferAttribute(cell, 2)); g.setAttribute('aCorner', new THREE.BufferAttribute(cor, 2))
    g.setIndex(idx)
    return g
  }

  const piece: Piece = {
    leg,
    cues: [{ at: 0.16, name: 'tr:mosaic' }],
    build(env) {
      if (ok) return
      U.uLane.value = env.lane.u; U.uRes.value = env.res
      const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U as unknown as Record<string, THREE.IUniform>, side: THREE.DoubleSide })
      overlayBlend(m, true); m.depthWrite = true
      const g = grid(env); cols = g.c; rows = g.r
      mesh = new THREE.Mesh(buildGeo(cols, rows), m)
      mesh.frustumCulled = false; mesh.renderOrder = 100; mesh.visible = false; mesh.name = 'tr-mosaic'; mesh.userData.noReflect = true
      U.uGrid.value.set(cols, rows)
      env.scene.add(mesh)
      capA.size(env); capB.size(env)
      precompile(env, mesh)
      ok = true
    },
    setVisible(v) { if (!v && mesh) mesh.visible = false },
    frame(inp: FrameIn, out: FrameOut, env: Env) {
      if (!ok || !mesh) return
      const { u } = inp
      env.renderer.getDrawingBufferSize(env.res)
      const g = grid(env)
      if (g.c !== cols || g.r !== rows) { cols = g.c; rows = g.r; mesh.geometry.dispose(); mesh.geometry = buildGeo(cols, rows); U.uGrid.value.set(cols, rows) }
      const fIn = sstep(FADE_IN[0], FADE_IN[1], u), fOut = 1 - sstep(FADE_OUT[0], FADE_OUT[1], u)
      U.uU.value = u; U.uFront.value = fIn; U.uBack.value = fOut; U.uCopy.value = inp.copy
      U.uTint.value = sstep(0.1, 0.26, u) * (1 - sstep(0.62, 0.84, u))
      mesh.visible = u > 0.045 && u < 0.935
      if (mesh.visible) {
        if (u < 0.83) capA.render(env, livePose(env), { hide: [mesh] })                                          // the faces: the live view, one frame behind (same camera)
        if (u > 0.09) capB.render(env, env.flightCam(1), { hide: [mesh], mix: 1 })                              // the backs: the destination, fully formed, from where we land
        U.uTexA.value = capA.texture; U.uTexB.value = capB.texture
      }
      // the field hides while the tiles cover it (the grout is the dark ground); it returns as the backs hand over to the real frame
      out.field = 1 - 1 * sstep(0.07, 0.14, u) * fOut
      out.flash = 0
    },
    camera(u, _base, env): CamPose | null { return arriveBy(env, u, ARRIVE) },
    dispose() { mesh?.removeFromParent(); mesh?.geometry.dispose(); capA.dispose(); capB.dispose() },
  }
  return piece
}

/** the pose of the camera that is drawing the frame now */
function livePose(env: Env): CamPose {
  const c = env.camera, f = new THREE.Vector3(0, 0, -10).applyQuaternion(c.quaternion).add(c.position)
  return { pos: [c.position.x, c.position.y, c.position.z], target: [f.x, f.y, f.z], fov: c.fov }
}
