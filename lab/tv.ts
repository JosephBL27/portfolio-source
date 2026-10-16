// Lab: the hero TV alone on a dark page with a halftone aura behind it.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import { createTV } from '../src/gl/tv'
import { REELS, type ReelDef } from '../src/reels'
import { state, setNight, setPaused } from '../src/state'
import { bus } from '../src/bus'

const qp = new URLSearchParams(location.search)
setNight(qp.has('day') ? false : true)

// Lab-only stand-ins so channel changes can be exercised before the real reels land.
const lab = (id: string, title: string, frag: string): ReelDef => ({ id, projectId: 'selforge', title, medium: 'Lab stand-in, not a project reel', colors: { bg: '#000', ink: '#fff', accent: '#f60' }, frag })
const HEAD = `precision highp float;\nuniform float uTime; uniform vec2 uRes; uniform vec2 uMouse;\n`
const LAB_REELS: ReelDef[] = [
  lab('lab-bars', 'Bars', HEAD + `void main(){ vec2 uv = gl_FragCoord.xy/uRes; vec3 c[7]; c[0]=vec3(.75); c[1]=vec3(.75,.75,0.); c[2]=vec3(0.,.75,.75); c[3]=vec3(0.,.75,0.); c[4]=vec3(.75,0.,.75); c[5]=vec3(.75,0.,0.); c[6]=vec3(0.,0.,.75);
    int i = int(floor(uv.x*7.)); vec3 col = vec3(0.); for(int k=0;k<7;k++){ if(k==i) col=c[k]; }
    if (uv.y < .25) col = vec3(step(.5, fract(uv.x*4.)) * .9); else if (uv.y < .33) col = c[6-i] * .8;
    col *= .92 + .08*sin(uTime*2.); gl_FragColor = vec4(col,1.); }`),
  lab('lab-sun', 'Sun', HEAD + `void main(){ vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y; vec3 top=vec3(.05,.02,.12), bot=vec3(.9,.25,.3);
    vec3 col=mix(bot,top,smoothstep(-.5,.5,p.y)); float r=length(p-vec2(0.,.05)); float s=smoothstep(.31,.3,r);
    float stripe=step(.5,fract((p.y+uTime*.05)*14.)) + step(.12,p.y); col=mix(col, mix(vec3(1.,.85,.3),vec3(1.,.3,.5),smoothstep(.3,-.3,p.y)), s*clamp(stripe,0.,1.));
    if(p.y<-.12){ vec2 g=vec2(p.x/(-p.y+.02), 1./(-p.y+.02)+uTime*2.); float l=max(smoothstep(.95,1.,abs(fract(g.x*1.5)*2.-1.)), smoothstep(.9,1.,abs(fract(g.y*.5)*2.-1.))); col=mix(vec3(.04,.01,.08), vec3(1.,.3,.8), l*smoothstep(-.12,-.5,p.y)); }
    gl_FragColor=vec4(col,1.); }`),
  lab('lab-rings', 'Rings', HEAD + `void main(){ vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y; p-= (uMouse-.5)*.3; float r=length(p); float a=atan(p.y,p.x);
    float w=sin(r*40.-uTime*3.+sin(a*3.+uTime)*1.5); vec3 col=mix(vec3(.02,.04,.12), vec3(.35,.55,1.), smoothstep(.0,.9,w)*smoothstep(.75,.05,r));
    col+=vec3(1.,.9,.7)*smoothstep(.06,.0,r); gl_FragColor=vec4(col,1.); }`),
  lab('lab-blob', 'Blob', HEAD + `void main(){ vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y; float f=0.; for(int i=0;i<5;i++){ float t=uTime*.6+float(i)*1.7; vec2 c=.28*vec2(sin(t*1.1),cos(t*.8+float(i))); f+=.018/dot(p-c,p-c); }
    vec3 col=mix(vec3(.08,.06,.02), vec3(1.,.78,.25), smoothstep(.9,1.1,f)); col=mix(col, vec3(1.,.97,.9), smoothstep(2.5,4.,f)); gl_FragColor=vec4(col,1.); }`),
  lab('lab-grid', 'Grid', HEAD + `void main(){ vec2 uv=gl_FragCoord.xy/uRes; vec2 g=fract(uv*vec2(16.,12.)+vec2(uTime*.2,0.)); float l=step(.92,max(g.x,g.y)); vec2 cell=floor(uv*vec2(16.,12.)+vec2(uTime*.2,0.));
    float on=step(.72,fract(sin(dot(cell,vec2(12.9,78.2))+floor(uTime*2.))*43758.5)); vec3 col=vec3(.06)+vec3(1.,.36,.24)*on*.9+l*.25; gl_FragColor=vec4(col,1.); }`),
]
const reels = REELS.length >= 2 ? REELS : [...REELS, ...LAB_REELS]

const pad = (n: number) => String(n).padStart(2, '0')
const nEl = document.getElementById('n')!, tEl = document.getElementById('title')!, mEl = document.getElementById('medium')!
function label(i: number) {
  nEl.innerHTML = `${pad(i + 1)}<small> / ${pad(reels.length)}</small>`
  tEl.textContent = reels[i].title; mEl.textContent = reels[i].medium
}
label(0)
const openEl = document.getElementById('open')!
let openT = 0
const tv = createTV(document.getElementById('tv') as HTMLCanvasElement, {
  reels,
  onChannel: label,
  onOpen: () => { openEl.classList.add('on'); clearTimeout(openT); openT = window.setTimeout(() => openEl.classList.remove('on'), 1200) },
})
document.getElementById('prev')!.addEventListener('click', () => tv.prev())
document.getElementById('next')!.addEventListener('click', () => tv.next())
addEventListener('keydown', e => { if (e.key === 'ArrowRight') tv.next(); if (e.key === 'ArrowLeft') tv.prev() })

// halftone aura: a four-petal flower in dots that shrink toward its edge
const aura = document.getElementById('aura') as HTMLCanvasElement
function drawAura() {
  const css = aura.getBoundingClientRect().width || 1100
  const dpr = Math.min(devicePixelRatio, 2), S = Math.round(css * dpr)
  aura.width = aura.height = S
  const g = aura.getContext('2d')!
  g.clearRect(0, 0, S, S)
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#ECEAE3'
  const step = 14 * dpr, c = S / 2, R = S * 0.47
  for (let y = step / 2; y < S; y += step) for (let x = step / 2; x < S; x += step) {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx) + Math.PI / 4
    const petal = 0.5 + 0.5 * Math.pow(Math.abs(Math.cos(2 * a)), 0.7)
    const rf = R * petal
    const v = 1 - r / rf
    if (v <= 0) continue
    const ring = 0.7 + 0.3 * Math.cos(r / (R * 0.11))
    const tone = Math.min(1, v * 2.2) * ring * (0.35 + 0.65 * Math.min(1, r / (R * 0.18)))
    const rad = step * 0.48 * Math.sqrt(Math.max(0, tone))
    if (rad < 0.5 * dpr) continue
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill()
  }
}
drawAura()
addEventListener('resize', () => drawAura())

const nightBtn = document.getElementById('night')!, pauseBtn = document.getElementById('pause')!
nightBtn.addEventListener('click', () => setNight(!state.night))
pauseBtn.addEventListener('click', () => setPaused(!state.paused))
bus.on('theme', ({ night }) => { nightBtn.setAttribute('aria-pressed', String(night)); nightBtn.textContent = night ? 'Night' : 'Day'; drawAura() })
bus.on('pause', ({ paused }) => pauseBtn.setAttribute('aria-pressed', String(paused)))
nightBtn.setAttribute('aria-pressed', String(state.night)); nightBtn.textContent = state.night ? 'Night' : 'Day'
;(window as any).__tv = tv
;(window as any).__lab = { setNight, setPaused, state }
