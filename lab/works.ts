// Lab for the kinetic works index. ?night=0 for the day palette, ?gap=1 puts a screen of space above
// (to watch the scroll-in), ?stand=1 forces the lab stand-in reels even when the real ones exist.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '../src/styles/base.css'
import { initWorks } from '../src/ui/works'
import { REELS } from '../src/reels'
import type { ReelDef } from '../src/reels/types'
import { state, setNight, setPaused } from '../src/state'

const q = new URLSearchParams(location.search)
setNight(q.get('night') !== '0')
if (q.get('gap') === '1') document.getElementById('gap')!.hidden = false

// ---- lab-only stand-in reels (used for any featured reel that has not landed yet) ----
const HEAD = `precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uSeed; uniform float uIntensity;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
`
const stand = (id: string, projectId: string, title: string, medium: string, colors: ReelDef['colors'], body: string): ReelDef =>
  ({ id, projectId, title, medium, colors, frag: HEAD + body })

const STAND: ReelDef[] = [
  stand('ember', 'selforge', 'Ember', 'Lab stand-in: a rising flame', { bg: '#0A0605', ink: '#FFE9C8', accent: '#FF6A2B' }, `
void main(){
  vec2 uv = gl_FragCoord.xy/uRes; vec2 p = (gl_FragCoord.xy-.5*uRes)/uRes.y; float t = uTime;
  float n = fbm(vec2(p.x*3.2, p.y*2.6 - t*1.9));
  float n2 = fbm(vec2(p.x*7.0+3., p.y*5.0 - t*3.1));
  float w = abs(p.x + (n-.5)*.35*(uv.y+.2)) * (1.7 + uv.y*2.6);
  float f = (1.05 - uv.y*1.2) - w + (n2-.5)*.55;
  f = smoothstep(0., .85, f);
  vec3 c = vec3(1.5,.42,.10)*f + vec3(1.,.82,.35)*pow(f,3.)*1.3 + vec3(1.)*pow(f,7.)*.6;
  c += vec3(.35,.06,.0)*smoothstep(.9,0.,length(p-vec2(0.,-.55)));
  float sp = step(.985, hash(floor(vec2(p.x*40., p.y*40.-t*14.))))*smoothstep(.4,-.3,p.y)*.8;
  c += vec3(1.,.6,.2)*sp;
  gl_FragColor = vec4(c, 1.);
}`),
  stand('phase', 'love-island', 'Phase', 'Lab stand-in: a phase portrait', { bg: '#0D0612', ink: '#FFE3F1', accent: '#FF4F9A' }, `
void main(){
  vec2 p = (gl_FragCoord.xy-.5*uRes)/uRes.y*1.25; float t = uTime;
  float r = length(p), a = atan(p.y,p.x);
  float s1 = sin(a*2. + log(r+.002)*9. - t*1.4);
  float s2 = sin(-a*2. + log(r+.002)*9. - t*1.1 + 1.7);
  float l1 = smoothstep(.93,1.,s1), l2 = smoothstep(.95,1.,s2);
  vec3 c = vec3(.05,.02,.08);
  c += vec3(1.,.31,.62)*l1*1.2 + vec3(.55,.48,1.)*l2;
  c *= smoothstep(1.3,.05,r);
  vec2 d1 = .45*vec2(cos(t*.9), sin(t*1.3)), d2 = .45*vec2(cos(t*1.3+2.), sin(t*.9+1.));
  c += vec3(1.,.5,.75)*.012/max(.0004, dot(p-d1,p-d1)) + vec3(.6,.6,1.)*.012/max(.0004, dot(p-d2,p-d2));
  gl_FragColor = vec4(c, 1.);
}`),
  stand('rings', 'odyssey', 'Rings', 'Lab stand-in: a turning wheel', { bg: '#060914', ink: '#F7EBCB', accent: '#F2C14E' }, `
void main(){
  vec2 p = (gl_FragCoord.xy-.5*uRes)/uRes.y*1.15; float t = uTime;
  float r = length(p), a = atan(p.y,p.x);
  float ring = floor(r*12.); float fr = fract(r*12.);
  float spd = (mod(ring,2.)*2.-1.)*(.15+hash(vec2(ring,3.))*.4);
  float seg = fract((a/6.2831)*(6.+ring*3.) + t*spd);
  float on = step(.3, seg)*smoothstep(.0,.08,fr)*smoothstep(.75,.6,fr);
  float lit = step(.82, hash(vec2(ring, floor((a/6.2831)*(6.+ring*3.) + t*spd))));
  vec3 c = vec3(.03,.04,.10);
  c += mix(vec3(.55,.42,.2), vec3(1.,.85,.45), lit) * on * smoothstep(1.05,.12,r) * (.5+lit);
  c += vec3(1.,.8,.4)*.004/max(.0004, r*r);
  gl_FragColor = vec4(c, 1.);
}`),
  stand('digits', 'zeta', 'Digits', 'Lab stand-in: question timings', { bg: '#04100A', ink: '#D9FFE9', accent: '#4CC38A' }, `
void main(){
  vec2 uv = gl_FragCoord.xy/uRes; float t = uTime;
  float cols = 46.; float x = uv.x*cols + t*3.; float id = floor(x); float fx = fract(x);
  float hgt = .12 + .7*pow(hash(vec2(id, 7.)), 1.6);
  float bar = step(.18, fx)*step(fx,.82)*step(uv.y-.08, hgt*.85);
  float slow = step(.86, hash(vec2(id, 2.)));
  vec3 c = vec3(.01,.04,.025);
  c += mix(vec3(.18,.75,.48), vec3(1.,.42,.3), slow) * bar * (.55 + .45*uv.y/hgt);
  c += vec3(.3,1.,.6)*.15*step(abs(uv.y-.08), .002);
  float g = step(.97, fract(uv.y*12.))*.05; c += g;
  gl_FragColor = vec4(c, 1.);
}`),
  stand('synapse', 'second-brain', 'Synapse', 'Lab stand-in: notes linking', { bg: '#0B0706', ink: '#FFE6DF', accent: '#FF6A4D' }, `
vec2 pt(vec2 id){ float t = uTime*.5; return vec2(.5)+.38*vec2(sin(t+hash(id)*6.28), cos(t*1.3+hash(id+3.)*6.28)); }
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
void main(){
  vec2 p = gl_FragCoord.xy/uRes.y*5.; vec2 id = floor(p), f = fract(p);
  vec3 c = vec3(.03,.015,.012); float glow = 0., lines = 0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 o = vec2(x,y); vec2 a = o + pt(id+o);
    glow += .0025/max(.00015, dot(f-a,f-a));
    vec2 o2 = o + vec2(1.,0.); vec2 b = o2 + pt(id+o2);
    vec2 o3 = o + vec2(0.,1.); vec2 d = o3 + pt(id+o3);
    lines += smoothstep(.025,.0,seg(f,a,b))*.5 + smoothstep(.025,.0,seg(f,a,d))*.5;
  }
  float pulse = .5+.5*sin(uTime*2. - p.x*1.3);
  c += vec3(1.,.42,.3)*glow + vec3(1.,.55,.4)*lines*(.25+.5*pulse);
  gl_FragColor = vec4(c, 1.);
}`),
  stand('deadlines', 'recruiting-os', 'Deadlines', 'Lab stand-in: dates closing in', { bg: '#05070F', ink: '#E2E8FF', accent: '#6F8CFF' }, `
void main(){
  vec2 uv = gl_FragCoord.xy/uRes; float t = uTime;
  float rows = 18.; float ry = uv.y*rows; float id = floor(ry); float fy = fract(ry);
  float sp = .05 + .12*hash(vec2(id, 1.));
  float x = fract(uv.x*1.4 - t*sp + hash(vec2(id,9.)));
  float tick = smoothstep(.012,.0,abs(x-.5))*step(.3,fy)*step(fy,.7);
  float lane = step(.48,fy)*step(fy,.52)*.12;
  float nowx = .72; float near = smoothstep(.08,.0,abs(uv.x-nowx));
  vec3 c = vec3(.012,.018,.04) + vec3(.35,.45,1.)*lane;
  c += vec3(.45,.58,1.)*tick*1.4;
  c += vec3(1.,.78,.3)*tick*near*1.4;
  c += vec3(.6,.7,1.)*.6*smoothstep(.003,.0,abs(uv.x-nowx));
  gl_FragColor = vec4(c, 1.);
}`),
]

const real = q.get('stand') === '1' ? [] : REELS.filter(r => r.id !== 'test')
const reels = STAND.map(s => real.find(r => r.projectId === s.projectId) ?? s)
console.log('[works lab] reels:', reels.map(r => `${r.id}${real.includes(r) ? '' : '(stand-in)'}`).join(', '))

const log = document.getElementById('log')!
let logT = 0
const works = initWorks(document.getElementById('index')!, {
  reels,
  onOpen(i, fromEl) {
    log.textContent = `onOpen(${i}, ${fromEl.tagName.toLowerCase()}.${fromEl.className.split(' ').join('.')}) · ${reels[i].projectId}`
    log.classList.add('on'); clearTimeout(logT); logT = window.setTimeout(() => log.classList.remove('on'), 2200)
  },
})
;(window as any).works = works

const night = document.getElementById('night')!, pause = document.getElementById('pause')!
const sync = () => { night.setAttribute('aria-pressed', String(state.night)); night.textContent = state.night ? 'Night' : 'Day'; pause.setAttribute('aria-pressed', String(state.paused)) }
night.addEventListener('click', () => { setNight(!state.night); sync() })
pause.addEventListener('click', () => { setPaused(!state.paused); sync() })
sync()
