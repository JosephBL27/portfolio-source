// Depth 2/2: a low ground haze that catches coloured light. v20: the horizon / sky wash is gone (it lifted the black of the whole sky) and the haze carries no
// ambient floor of its own: it only shows where an area pad or the hub is lit. The haze is two drifting layers on the floor (additive): pools of each area's accent where its pad is lit, the warm
// pool under the hub, and slow fbm banks that thin out with distance and toward the camera.
import * as THREE from 'three'
import { AREAS } from '../../layout'
import { NOISE } from './noise'
import { U as SIGU } from '../../signals'

const FLOOR_Y = -6.6
export function createGround() {
  const group = new THREE.Group(); group.userData.noReflect = true
  const padP = Array.from({ length: 6 }, (_, i) => new THREE.Vector2(AREAS[i].center[0], AREAS[i].center[2]))
  const padC = Array.from({ length: 6 }, (_, i) => new THREE.Color(AREAS[i].accent))
  const mk = (y: number, scale: number, gain: number, seed: number) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uT: { value: 0 }, uPad: { value: padP }, uCol: { value: padC }, uOn: { value: new Float32Array(6) }, uHub: { value: 0 }, uGain: { value: 0 }, uScale: { value: scale }, uSeed: { value: seed }, uGain0: { value: gain }, uSgTv: SIGU.uSgTv, uSgMus: SIGU.uSgMus, uSgMc: SIGU.uSgMc, uSgRip: SIGU.uSgRip },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `${NOISE} uniform float uT, uHub, uGain, uScale, uSeed, uGain0; uniform vec2 uPad[6]; uniform vec3 uCol[6]; uniform float uOn[6]; uniform vec4 uSgTv, uSgMus, uSgRip; uniform vec3 uSgMc; varying vec3 vW;
      void main(){
        vec2 p = vW.xz * uScale + uSeed; vec2 w = vec2(uT * 0.012, uT * 0.007);
        float n = fbm3(p + w + 1.7 * vec2(fbm3(p * 0.7 - w), fbm3(p * 0.7 + 9.0)));
        float bank = smoothstep(0.32, 0.78, n);
        float rad = length(vW.xz), dist = length(vW - cameraPosition);
        float far = 1.0 - smoothstep(34.0, 95.0, rad), nearK = smoothstep(2.0, 12.0, dist), farCam = 1.0 - smoothstep(60.0, 120.0, dist);
        vec3 hubCol = mix(vec3(1.0, 0.64, 0.4), 0.25 + 0.75 * uSgTv.rgb, uSgTv.w * 0.8);   // v19: the pool under the hub takes the TV channel's colour
        vec3 c = hubCol * exp(-rad * rad / 70.0) * uHub * 1.3;
        float rf = (rad - uSgRip.x * 60.0) / 5.0; c += uSgMc * exp(-rf * rf) * uSgRip.y * 0.5;   // and each beat sends a ring of the song's colour across the floor
        for (int i = 0; i < 6; i++) { vec2 d = vW.xz - uPad[i]; c += uCol[i] * exp(-dot(d, d) / 160.0) * (0.04 + 0.9 * uOn[i]); }
        gl_FragColor = vec4(c * (bank + 0.3 * uSgRip.y * far) * far * nearK * farCam * uGain * uGain0 * (1.0 + 0.4 * uSgMus.x), 1.0); }` })
  const g = new THREE.CircleGeometry(100, 48); g.rotateX(-Math.PI / 2)
  const m1 = mk(FLOOR_Y, 0.045, 0.16, 3.0), m2 = mk(FLOOR_Y, 0.03, 0.1, 40.0)
  const l1 = new THREE.Mesh(g, m1), l2 = new THREE.Mesh(g, m2)
  l1.position.y = FLOOR_Y + 0.25; l2.position.y = FLOOR_Y + 2.2
  for (const l of [l1, l2]) { l.frustumCulled = false; l.renderOrder = -1; group.add(l) }
  return {
    group, mats: [m1, m2],
    dispose() { g.dispose(); m1.dispose(); m2.dispose(); group.removeFromParent() },
  }
}
