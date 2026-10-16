// One-pass "technical glass": an ink hairline rim, a faint body, a sharp key-light glint,
// and a travelling glow wherever a capsule is inside. By night the tubes become light guides.
import * as THREE from 'three'

export const MAX_CAPS = 48

const vert = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() {
    vec4 p = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      n = mat3(instanceMatrix) * n;
    #endif
    vec4 w = modelMatrix * p;
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * n);
    vV = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`

const frag = /* glsl */ `
  uniform vec3 uTint; uniform vec3 uRim; uniform vec3 uGlowCol; uniform vec3 uL;
  uniform float uRimPow; uniform float uBody; uniform float uRimA; uniform float uGlowGain; uniform float uDim;
  uniform vec4 uCaps[${MAX_CAPS}];
  varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() {
    vec3 N = normalize(vN); vec3 V = normalize(vV);
    if (!gl_FrontFacing) N = -N;
    float ndv = abs(dot(N, V));
    float rim = pow(1.0 - ndv, uRimPow);
    vec3 L = normalize(uL);
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 120.0);
    float spec2 = pow(max(dot(reflect(-normalize(vec3(0.6, -0.2, 1.0)), N), V), 0.0), 40.0) * 0.25;
    float glow = 0.0;
    for (int i = 0; i < ${MAX_CAPS}; i++) {
      if (uCaps[i].w <= 0.0) break;
      vec3 d = vW - uCaps[i].xyz;
      glow += uCaps[i].w * exp(-dot(d, d) / 0.012);
    }
    glow = min(glow, 1.4);
    vec3 col = mix(uTint, uRim, smoothstep(0.15, 0.9, rim)) + (spec + spec2) + glow * uGlowCol;
    float a = uBody + rim * uRimA + spec * 0.9 + spec2 + glow * uGlowGain;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uDim);
    #include <colorspace_fragment>
  }`

export interface TubeGlass extends THREE.ShaderMaterial {
  setNight(night: boolean): void
  caps: Float32Array
}

export function createTubeGlass(day: { tint: string; rim: string; glow: string }, night: { tint: string; rim: string; glow: string }, opts: { rimPow?: number; body?: number; rimA?: number } = {}): TubeGlass {
  const caps = new Float32Array(MAX_CAPS * 4)
  const capVecs = Array.from({ length: MAX_CAPS }, () => new THREE.Vector4(0, 0, -99, 0))
  const m = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTint: { value: new THREE.Color(day.tint) },
      uRim: { value: new THREE.Color(day.rim) },
      uGlowCol: { value: new THREE.Color(day.glow) },
      uL: { value: new THREE.Vector3(-3, 4, 5) },
      uRimPow: { value: opts.rimPow ?? 2.6 },
      uBody: { value: opts.body ?? 0.06 },
      uRimA: { value: opts.rimA ?? 0.85 },
      uGlowGain: { value: 0.55 },
      uDim: { value: 1 },
      uCaps: { value: capVecs },
    },
  }) as unknown as TubeGlass
  m.caps = caps
  m.setNight = (n: boolean) => {
    const p = n ? night : day
    ;(m.uniforms.uTint.value as THREE.Color).set(p.tint)
    ;(m.uniforms.uRim.value as THREE.Color).set(p.rim)
    ;(m.uniforms.uGlowCol.value as THREE.Color).set(p.glow)
    m.uniforms.uRimA.value = n ? 0.38 : opts.rimA ?? 0.85
    m.uniforms.uBody.value = n ? 0.04 : opts.body ?? 0.06
    m.uniforms.uGlowGain.value = n ? 1.1 : 0.55
    m.blending = n ? THREE.AdditiveBlending : THREE.NormalBlending
    m.needsUpdate = true
  }
  return m
}

/** Copy capsule positions/intensities into the uniform vectors. */
export function writeCaps(m: TubeGlass, list: { x: number; y: number; z: number; w: number }[]) {
  const arr = m.uniforms.uCaps.value as THREE.Vector4[]
  for (let i = 0; i < MAX_CAPS; i++) {
    const c = list[i]
    if (c) arr[i].set(c.x, c.y, c.z, c.w)
    else arr[i].set(0, 0, -99, 0)
  }
}
