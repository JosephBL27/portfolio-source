// Lab: a stand-in TV and index for the case view. Real reels are used where their files exist;
// lab-only stand-in shaders fill any channel whose reel is not built yet.
// URL: ?night=0|1  ?open=<0-5>  ?from=tv|row  ?scroll=<px>
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/500.css'
import { REELS, type ReelDef } from '../src/reels'
import { createReelCanvas } from '../src/reels/mini'
import { initCase } from '../src/ui/case'
import { projects } from '../src/data'
import { state, setNight, setPaused } from '../src/state'
import { bus } from '../src/bus'

const HEAD = `precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uSeed; uniform float uIntensity;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
`
const stand = (id: string, projectId: string, title: string, colors: ReelDef['colors'], body: string): ReelDef =>
  ({ id, projectId, title, medium: `Lab stand-in for the ${title} reel`, colors, frag: HEAD + body })

const STAND: Record<string, ReelDef> = {
  selforge: stand('ember', 'selforge', 'Ember', { bg: '#0b0605', ink: '#fff1e0', accent: '#FF6A3D' }, `
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y; uv.x-=(uMouse.x-.5)*.25;
  vec2 q=vec2(uv.x*1.5, uv.y+.42);
  float n=fbm(vec2(q.x*2.4, q.y*1.7-uTime*1.5));
  float shape=1.-length(vec2(q.x*(1.5+q.y*1.3),(q.y-.36)*.92));
  float f=smoothstep(0.,.5, shape+n*.8-.56);
  vec3 c=mix(vec3(.02,.01,.01), vec3(.9,.16,.05), f);
  c=mix(c, vec3(1.,.55,.12), smoothstep(.45,.85,f)); c=mix(c, vec3(1.,.93,.72), smoothstep(.82,1.,f));
  c+=vec3(.28,.05,.02)*exp(-3.*length(uv-vec2(0.,-.1)));
  gl_FragColor=vec4(c,1.);
}`),
  'love-island': stand('phase', 'love-island', 'Phase', { bg: '#07070d', ink: '#f5eef5', accent: '#FF5C8A' }, `
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y; uv-=(uMouse-.5)*.2;
  float r=length(uv), a=atan(uv.y,uv.x);
  float l1=smoothstep(.9,1.,sin(a+log(r+1e-3)*6.-uTime*.8)), l2=smoothstep(.93,1.,sin(a-log(r+1e-3)*6.+uTime*.6+1.5));
  vec3 c=vec3(.03,.03,.06)+vec3(1.,.36,.5)*l1*(1.2-r)+vec3(.42,.55,1.)*l2*(1.2-r);
  vec2 p1=.35*vec2(cos(uTime*.7),sin(uTime*.9)), p2=.35*vec2(cos(uTime*.7+3.),sin(uTime*.9+2.6));
  c+=vec3(1.,.4,.55)*.016/length(uv-p1)+vec3(.5,.6,1.)*.016/length(uv-p2);
  c*=smoothstep(1.4,.2,r); gl_FragColor=vec4(c,1.);
}`),
  odyssey: stand('rings', 'odyssey', 'Rings', { bg: '#0a0806', ink: '#f6ecd8', accent: '#E9B44C' }, `
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y; uv-=(uMouse-.5)*.15;
  float r=length(uv), a=atan(uv.y,uv.x); vec3 c=vec3(.04,.035,.03);
  for(int i=0;i<4;i++){ float fi=float(i), r0=.15+fi*.1, dir=mod(fi,2.)*2.-1.;
    float band=smoothstep(.004,0.,abs(r-r0)-.034), ang=a+dir*uTime*(.15+fi*.05);
    float ticks=step(.18,fract(ang/6.2831*(6.+fi*8.)));
    float edge=smoothstep(.003,0.,abs(abs(r-r0)-.034));
    c+=vec3(.95,.74,.34)*(band*ticks*.28+edge*.8); }
  c+=vec3(.9,.7,.3)*.006/abs(r-.58); gl_FragColor=vec4(c,1.);
}`),
  zeta: stand('digits', 'zeta', 'Digits', { bg: '#04080a', ink: '#e6fff1', accent: '#4CE08A' }, `
void main(){
  vec2 uv=gl_FragCoord.xy/uRes.y; vec2 g=uv*14.; g.y+=uTime*.6;
  vec2 id=floor(g), f=fract(g); float h=hash(id+floor(uTime*2.*hash(id+3.)));
  float bar=step(.2,f.x)*step(f.x,.8)*(step(abs(f.y-.15),.05)+step(abs(f.y-.5),.05)*step(.5,h)+step(abs(f.y-.85),.05)*step(.3,h));
  float vb=step(.15,f.y)*step(f.y,.85)*(step(abs(f.x-.2),.05)*step(.6,h)+step(abs(f.x-.8),.05)*step(.2,h));
  vec2 m=uMouse*vec2(uRes.x/uRes.y,1.); float glow=exp(-5.*length(uv-m));
  vec3 c=vec3(.02,.04,.03)+vec3(.3,1.,.55)*clamp(bar+vb,0.,1.)*(.18+.7*step(.82,h)+glow);
  gl_FragColor=vec4(c,1.);
}`),
  'second-brain': stand('synapse', 'second-brain', 'Synapse', { bg: '#080606', ink: '#fff0ea', accent: '#FF6A4D' }, `
vec2 h2(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5); }
float sg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y*5.; uv+=(uMouse-.5)*1.2;
  vec2 id=floor(uv), f=fract(uv); vec3 c=vec3(.03,.025,.03);
  vec2 pc=.5+.35*sin(uTime*.6+6.2831*h2(id));
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 n=vec2(float(x),float(y));
    vec2 pn=n+.5+.35*sin(uTime*.6+6.2831*h2(id+n)); float L=length(pc-pn);
    float pulse=.5+.5*sin(uTime*3.-L*4.+h2(id+n).x*6.);
    c+=vec3(1.,.42,.3)*smoothstep(.03,0.,sg(f,pc,pn))*(.2+.8*pulse)*smoothstep(1.6,.6,L);
    c+=vec3(1.,.6,.45)*.02/length(f-pn); }
  gl_FragColor=vec4(c,1.);
}`),
  'recruiting-os': stand('deadlines', 'recruiting-os', 'Deadlines', { bg: '#0a0905', ink: '#fff6dc', accent: '#F2C14E' }, `
float hs(float n){ return fract(sin(n)*43758.5); }
void main(){
  vec2 uv=gl_FragCoord.xy/uRes; float ly=floor(uv.y*12.), fy=fract(uv.y*12.);
  float x=uv.x*(uRes.x/uRes.y)*3.+uTime*(.4+.3*hs(ly)); float cell=floor(x), fx=fract(x);
  float bar=step(.45,hs(cell*7.+ly*13.))*step(.18,fy)*step(fy,.82)*step(.06,fx)*step(fx,.94*(.4+.6*hs(cell+ly)));
  float today=smoothstep(.003,0.,abs(uv.x-(.3+.4*uMouse.x)));
  vec3 c=vec3(.05,.045,.03)+vec3(.95,.76,.3)*bar*(.3+.7*step(.8,hs(cell*3.+ly)))+vec3(1.,.4,.3)*today;
  gl_FragColor=vec4(c,1.);
}`),
}
const ORDER = ['selforge', 'love-island', 'odyssey', 'zeta', 'second-brain', 'recruiting-os']
const reels: ReelDef[] = ORDER.map(id => REELS.find(r => r.projectId === id && r.id !== 'test') ?? STAND[id])
console.log('[lab] reels:', reels.map(r => `${r.id}${STAND[r.projectId] === r ? '(stand-in)' : ''}`).join(' '))

const qp = new URLSearchParams(location.search)
setNight(qp.get('night') !== '0')

let ch = 0
const tvBtn = document.getElementById('tv') as HTMLButtonElement
const tvReel = createReelCanvas(tvBtn.querySelector('canvas')!, reels[0], { intensity: 0.7 })
const setCh = (i: number) => {
  ch = ((i % reels.length) + reels.length) % reels.length
  tvReel.setReel(reels[ch])
  document.getElementById('tv-n')!.textContent = String(ch + 1).padStart(2, '0')
  document.getElementById('tv-t')!.textContent = reels[ch].title
}
setCh(0)
const view = initCase({ reels, onStep: i => setCh(i), onClose: i => setCh(i) })
const rows = document.getElementById('rows')!
reels.forEach((r, i) => {
  const p = projects.find(x => x.id === r.projectId)!
  const li = document.createElement('li')
  li.innerHTML = `<button><span class="mono">${String(i + 1).padStart(2, '0')}</span><span><span class="nm"></span><span class="ln"></span></span><span class="mono">${r.title}</span></button>`
  li.querySelector('.nm')!.textContent = p.name; li.querySelector('.ln')!.textContent = p.line
  const b = li.querySelector('button')!
  b.addEventListener('click', () => view.open(i, b.getBoundingClientRect()))
  rows.append(li)
})
tvBtn.addEventListener('click', () => view.open(ch, tvBtn.getBoundingClientRect()))

const nightBtn = document.getElementById('night')!, pauseBtn = document.getElementById('pause')!
nightBtn.addEventListener('click', () => setNight(!state.night))
pauseBtn.addEventListener('click', () => setPaused(!state.paused))
bus.on('theme', ({ night }) => nightBtn.setAttribute('aria-pressed', String(night)))
bus.on('pause', ({ paused }) => pauseBtn.setAttribute('aria-pressed', String(paused)))
nightBtn.setAttribute('aria-pressed', String(state.night))

const scroller = () => document.querySelector<HTMLElement>('.case__scroll')!
const lab = {
  view, reels, state, setNight, setPaused,
  open(i = ch, from: 'tv' | 'row' | 'none' = 'tv') {
    setCh(i)
    const el = from === 'tv' ? tvBtn : from === 'row' ? rows.querySelectorAll('button')[i] : null
    view.open(i, el?.getBoundingClientRect())
  },
  scroll(y: number) { const s = scroller(); s.scrollTop = y; s.dispatchEvent(new Event('scroll')) },
  scrollTo(sel: string, off = 80) { const s = scroller(); const e = s.querySelector<HTMLElement>(sel); if (e) { s.scrollTop = e.getBoundingClientRect().top + s.scrollTop - off; s.dispatchEvent(new Event('scroll')) } },
  key(k: string) { document.querySelector('dialog.case')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })) },
}
;(window as any).__lab = lab
if (qp.has('open')) setTimeout(() => {
  lab.open(+qp.get('open')!, (qp.get('from') as 'tv' | 'row') ?? 'tv')
  if (qp.has('scroll')) setTimeout(() => lab.scroll(+qp.get('scroll')!), 1600)
}, 300)
