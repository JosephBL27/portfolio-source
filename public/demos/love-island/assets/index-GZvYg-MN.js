(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=typeof window<`u`,t=e?window:null,n=e?document:null,r={OBJECT:0,ATTRIBUTE:1,CSS:2,TRANSFORM:3,CSS_VAR:4},i={NUMBER:0,UNIT:1,COLOR:2,COMPLEX:3},a={NONE:0,AUTO:1,FORCE:2},o={replace:0,none:1,blend:2},s=Symbol(),c=Symbol(),l=Symbol(),u=Symbol(),d=Symbol(),f=1e-11,p=0xe8d4a51000,m=1e3,h=[],g=(()=>{let e=new Map;return e.set(`x`,`translateX`),e.set(`y`,`translateY`),e.set(`z`,`translateZ`),e})(),_=[`perspective`,`translateX`,`translateY`,`translateZ`,`rotate`,`rotateX`,`rotateY`,`rotateZ`,`scale`,`scaleX`,`scaleY`,`scaleZ`,`skew`,`skewX`,`skewY`],v=_.reduce((e,t)=>({...e,[t]:t+`(`}),{}),y=()=>{},b=e=>e,x=/\)\s*[-.\d]/,S=/(^#([\da-f]{3}){1,2}$)|(^#([\da-f]{4}){1,2}$)/i,C=/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i,w=/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(-?\d+|-?\d*.\d+)\s*\)/i,T=/hsl\(\s*(-?\d+|-?\d*.\d+)\s*,\s*(-?\d+|-?\d*.\d+)%\s*,\s*(-?\d+|-?\d*.\d+)%\s*\)/i,E=/hsla\(\s*(-?\d+|-?\d*.\d+)\s*,\s*(-?\d+|-?\d*.\d+)%\s*,\s*(-?\d+|-?\d*.\d+)%\s*,\s*(-?\d+|-?\d*.\d+)\s*\)/i,D=/[-+]?\d*\.?\d+(?:e[-+]?\d)?/gi,O=/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)([a-z]+|%)$/i,k=/([a-z])([A-Z])/g,A=/(\*=|\+=|-=)/,j=/var\(\s*(--[\w-]+)(?:\s*,\s*([^)]+))?\s*\)/,M={id:null,keyframes:null,playbackEase:null,playbackRate:1,frameRate:240,loop:0,reversed:!1,alternate:!1,autoplay:!0,persist:!1,duration:m,delay:0,loopDelay:0,ease:`out(2)`,composition:o.replace,modifier:b,onBegin:y,onBeforeUpdate:y,onUpdate:y,onLoop:y,onPause:y,onComplete:y,onRender:y},N={current:null,root:n},P={defaults:M,precision:4,timeScale:1,tickThreshold:200,editor:null},F={version:`4.5.0`,engine:null};e&&(t.AnimeJS||=[],t.AnimeJS.push(F));var I=e=>e.replace(k,`$1-$2`).toLowerCase(),L=(e,t)=>e.indexOf(t)===0,R=Date.now,z=Array.isArray,ee=e=>e&&e.constructor===Object,B=e=>typeof e==`number`&&!isNaN(e),te=e=>typeof e==`string`,ne=e=>typeof e==`function`,V=e=>e===void 0,H=e=>V(e)||e===null,re=t=>e&&t instanceof SVGElement,ie=e=>S.test(e),ae=e=>L(e,`rgb`),oe=e=>L(e,`hsl`),se=e=>ie(e)||(ae(e)||oe(e))&&(e[e.length-1]===`)`||!x.test(e)),ce=e=>!P.defaults.hasOwnProperty(e),le=[`opacity`,`rotate`,`overflow`,`color`],ue=(e,t)=>{if(le.includes(t))return!1;if(e.getAttribute(t)||t in e){if(t===`scale`){let t=e.parentNode;return t&&t.tagName===`filter`}return!0}},de=e=>te(e)?parseFloat(e):e,fe=Math.pow,pe=Math.sqrt,me=Math.sin,U=Math.cos,he=Math.abs,ge=Math.exp,_e=Math.floor,W=Math.asin,ve=Math.max,G=Math.atan2,K=Math.PI,ye=Math.round,q=(e,t,n)=>e<t?t:e>n?n:e,J=(e,t)=>{if(t<0)return e;if(!t)return ye(e);let n=10**t;return ye(e*n)/n},be=(e,t)=>z(t)?t.reduce((t,n)=>he(n-e)<he(t-e)?n:t):t?ye(e/t)*t:e,xe=(e,t,n)=>n===1?t:n===0?e:e+(t-e)*n,Se=e=>e===1/0?p:e===-1/0?-p:e,Ce=e=>e<=1e-11?f:Se(J(e,11)),we=e=>z(e)?[...e]:e,Te=(e,t)=>{let n={...e};for(let r in t){let i=e[r];n[r]=V(i)?t[r]:i}return n},Ee=(e,t,n,r=`_prev`,i=`_next`)=>{let a=e._head,o=i;for(n&&(a=e._tail,o=r);a;){let e=a[o];t(a),a=e}},De=(e,t,n=`_prev`,r=`_next`)=>{let i=t[n],a=t[r];i?i[r]=a:e._head=a,a?a[n]=i:e._tail=i,t[n]=null,t[r]=null},Oe=(e,t,n,r=`_prev`,i=`_next`)=>{let a=e._tail;for(;a&&n&&n(a,t);)a=a[r];let o=a?a[i]:e._head;a?a[i]=t:e._head=t,o?o[r]=t:e._tail=t,t[r]=a,t[i]=o},ke=(e,t,n)=>{let r=e.style.transform;if(r){let i=e[u],a=0,o=r.length,s;for(;a<o;){for(;a<o&&r.charCodeAt(a)===32;)a++;if(a>=o)break;let e=a;for(;a<o&&r.charCodeAt(a)!==40;)a++;if(a>=o)break;let t=r.substring(e,a),n=1,c=a+1,l=-1,u=-1;for(a++;a<o&&n>0;){let e=r.charCodeAt(a);e===40?n++:e===41?n--:e===44&&n===1&&(l===-1?l=a:u===-1&&(u=a)),a++}let d=a-1;t===`translate`||t===`translate3d`?(l===-1?i.translateX=r.substring(c,d).trim():(i.translateX=r.substring(c,l).trim(),u===-1?i.translateY=r.substring(l+1,d).trim():(i.translateY=r.substring(l+1,u).trim(),i.translateZ=r.substring(u+1,d).trim())),s=r.substring(c,d)):t===`scale`||t===`scale3d`?l===-1?i.scale=r.substring(c,d).trim():(i.scaleX=r.substring(c,l).trim(),u===-1?i.scaleY=r.substring(l+1,d).trim():(i.scaleY=r.substring(l+1,u).trim(),i.scaleZ=r.substring(u+1,d).trim())):i[t]=r.substring(c,d)}if(t===`translate3d`&&s)return n&&(n[t]=s),s;let c=i[t];if(!V(c))return n&&(n[t]=c),c}return t===`translate3d`?`0px, 0px, 0px`:t===`rotate3d`?`0, 0, 0, 0deg`:L(t,`scale`)?`1`:L(t,`rotate`)||L(t,`skew`)?`0deg`:`0px`},Ae=e=>{let t=``;for(let n=0,r=_.length;n<r;n++){let r=_[n],i=e[r];if(i!==void 0){if(r===`translateX`){let r=e.translateY;if(r!==void 0){let a=e.translateZ;a===void 0?(t+=`translate(${i},${r}) `,n+=1):(t+=`translate3d(${i},${r},${a}) `,n+=2);continue}}if(r===`scaleX`&&e.scale===void 0){let r=e.scaleY;if(r!==void 0){let a=e.scaleZ;a===void 0?(t+=`scale(${i},${r}) `,n+=1):(t+=`scale3d(${i},${r},${a}) `,n+=2);continue}}t+=`${v[r]}${i}) `}r===`rotateZ`&&e.rotate3d!==void 0&&(t+=`rotate3d(${e.rotate3d}) `)}return e.matrix!==void 0&&(t+=`matrix(${e.matrix}) `),e.matrix3d!==void 0&&(t+=`matrix3d(${e.matrix3d}) `),t},je=[];function Me(e,t){if(!e)return null;let n=je.length;outer:for(let r=0;r<n;r++){let n=je[r];if(n.detect&&!n.detect(e))continue;let i=n.targetAdapters;for(let n=0,r=i.length;n<r;n++){let r=i[n];if(r.detect(e)){let n=r.props[t];if(n&&(!n.gate||n.gate(e)))return n;break outer}}}for(let r=0;r<n;r++){let n=je[r];if(n.detect&&!n.detect(e))continue;let i=n.propertyResolvers;for(let n=0,r=i.length;n<r;n++){let r=i[n](e,t);if(r)return r}}return null}var Ne=e=>{let t=C.exec(e)||w.exec(e),n=V(t[4])?1:+t[4];return[+t[1],+t[2],+t[3],n]},Pe=e=>{let t=e.length,n=t===4||t===5;return[+(`0x`+e[1]+e[n?1:2]),+(`0x`+e[n?2:3]+e[n?2:4]),+(`0x`+e[n?3:5]+e[n?3:6]),t===5||t===9?+((`0x`+e[n?4:7]+e[n?4:8])/255).toFixed(3):1]},Fe=(e,t,n)=>(n<0&&(n+=1),n>1&&--n,n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*(2/3-n)*6:e),Ie=e=>{let t=T.exec(e)||E.exec(e),n=t[1]/360,r=t[2]/100,i=t[3]/100,a=V(t[4])?1:+t[4],o,s,c;if(r===0)o=s=c=i;else{let e=i<.5?i*(1+r):i+r-i*r,t=2*i-e;o=J(Fe(t,e,n+1/3)*255,0),s=J(Fe(t,e,n)*255,0),c=J(Fe(t,e,n-1/3)*255,0)}return[o,s,c,a]},Le=e=>ae(e)?Ne(e):ie(e)?Pe(e):oe(e)?Ie(e):[0,0,0,1],Re=(e,t)=>V(e)?t:e,ze=(e,t)=>{let n=e.match(j),r=t[c]?t:document.documentElement,i=getComputedStyle(r)?.getPropertyValue(n[1]);return(!i||i.trim()===``)&&n[2]&&(i=n[2].trim()),i||0},Be=(e,t,n,r,i,a)=>{if(ne(e)){if(!i){let i=e(t,n,r,a);return isNaN(+i)?i||0:+i}let o=()=>{let i=e(t,n,r,a);return isNaN(+i)?i||0:+i};return i.func=o,o()}if(te(e)&&L(e,`var(`)){if(!i)return ze(e,t);let n=()=>ze(e,t);return i.func=n,n()}return e},Ve=(e,t)=>e[c]?e[l]&&ue(e,t)?r.ATTRIBUTE:_.includes(t)||g.get(t)?r.TRANSFORM:L(t,`--`)?r.CSS_VAR:t in e.style?r.CSS:t in e?r.OBJECT:r.ATTRIBUTE:r.OBJECT,He=(e,t,n)=>{let r=e.style[t];r&&n&&(n[t]=r);let i=r||getComputedStyle(e[d]||e).getPropertyValue(t);return i===`auto`?`0`:i},Ue=(e,t,n,i)=>{let a=V(n)?Ve(e,t):n,o=Me(e,t);if(o){let n=o.get(e);return n&&i&&(i[t]=n),n??0}if(a===r.OBJECT){let n=e[t];return n&&i&&(i[t]=n),n||0}if(a===r.ATTRIBUTE){let n=e.getAttribute(t);return n&&i&&(i[t]=n),n}return a===r.TRANSFORM?ke(e,t,i):a===r.CSS_VAR?He(e,t,i).trimStart():He(e,t,i)},We=(e,t,n)=>n===`-`?e-t:n===`+`?e+t:e*t,Ge=()=>({t:i.NUMBER,n:0,u:null,o:null,d:null,s:null}),Ke=(e,t)=>{if(t.t=i.NUMBER,t.n=0,t.u=null,t.o=null,t.d=null,t.s=null,!e)return t;let n=+e;if(!isNaN(n))return t.n=n,t;let r=e;r[1]===`=`&&(t.o=r[0],r=r.slice(2));let a=!r.includes(` `)&&O.exec(r);if(a)return t.t=i.UNIT,t.n=+a[1],t.u=a[2],t;if(t.o)return t.n=+r,t;if(se(r))return t.t=i.COLOR,t.d=Le(r),t;{let e=r.match(D);return t.t=i.COMPLEX,t.d=e?e.map(Number):[],t.s=r.split(D)||[],t}},qe=(e,t)=>(t.t=e._valueType,t.n=e._toNumber,t.u=e._unit,t.o=null,t.d=we(e._toNumbers),t.s=we(e._strings),t),Je=Ge(),Ye=(e,t,n)=>{let r=e._modifier,i=e._fromNumbers,a=e._toNumbers,o=e._strings,s=o[0];for(let c=0,l=a.length;c<l;c++){let l=r(J(xe(i[c],a[c],t),n)),u=o[c+1];s+=`${u?l+u:l}`,e._numbers[c]=l}return s},Xe=(e,t,n,s,c)=>{let l=e.parent,d=e.duration,p=e.completed,m=e.iterationDuration,h=e.iterationCount,g=e._currentIteration,_=e._loopDelay,v=e._reversed,y=e._alternate,b=e._hasChildren,x=e._delay,S=e._currentTime,C=x+m,w=t-x,T=q(S,-x,d),E=q(w,-x,d),D=w-S,O=E>0,k=E>=d,A=d<=f,j=c===a.FORCE,M=0,N=w,F=0;if(h>1){let t=m+(k?0:_),n=~~(E/t);e._currentIteration=q(n,0,h),k&&e._currentIteration--,M=e._currentIteration%2,N=E-n*t||0}let I=v^(y&&M),L=e._ease,R=k?I?0:d:I?m-N:N;L&&(R=m*L(R/m)||0);let z=(l?l.backwards:w<S)?!I:!!I;if(e._currentTime=w,e._iterationTime=R,e.backwards=z,O&&!e.began?(e.began=!0,!n&&(!l||!z&&l.began)&&e.onBegin(e)):w<=0&&(e.began=!1),!n&&!b&&O&&e._currentIteration!==g&&e.onLoop(e),j||c===a.AUTO&&(t>=(l&&x>0?0:x)&&t<=C||t<=x&&T>x||t>=C&&T!==d)||R>=C&&T!==d||R<=x&&T>0&&!k||t<=T&&T===d&&p||k&&!p&&A){if(O&&(e.computeDeltaTime(T),n||e.onBeforeUpdate(e)),!b){let t=j||(z?D*-1:D)>=P.tickThreshold,a=J(e._offset+(l?l._offset:0)+x+R,12),c=e._head,d,f,p,m,h=0;for(;c;){let e=c._composition,n=c._currentTime,l=c._changeDuration,g=c._absoluteStartTime+c._changeDuration,_=c._nextRep,v=c._prevRep,y=e!==o.none,b=v?v._absoluteStartTime+v._changeDuration:0,x=v&&v.parent!==c.parent,S=!_||_._isOverridden?g:_.parent===c.parent?g+_._delay:_._absoluteStartTime<_._absoluteUpdateStartTime?_._absoluteStartTime:_._absoluteUpdateStartTime;if((t||(n!==l||a<=S||v&&!x&&(!_||_.parent!==c.parent))&&(n!==0||a>=c._absoluteStartTime||x&&!c._hasFromValue&&!v._isOverridden&&a>=b||_&&!_._isOverridden&&_.parent===c.parent&&_._currentTime!==0&&R<_._startTime))&&(!v||x||R>=c._startTime)&&(!y||!c._isOverridden&&(!c._isOverlapped||a<=g)&&(!_||_._isOverridden||a<=S)&&(!v||v._isOverridden||(x?a>=c._absoluteStartTime||!c._hasFromValue&&a>=b:a>=b+c._delay)))){let t=c._currentTime=q(R-c._startTime,0,l),n=c._ease(t/c._updateDuration),a=c._modifier,g=c._valueType,_=c._tweenType,v=_===r.OBJECT,b=g===i.NUMBER,x=b&&v||n===0||n===1?-1:P.precision,S,C;if(b)S=C=a(J(xe(c._fromNumber,c._toNumber,n),x));else if(g===i.UNIT)C=a(J(xe(c._fromNumber,c._toNumber,n),x)),S=`${C}${c._unit}`;else if(g===i.COLOR){let e=c._numbers,t=c._fromNumbers,r=c._toNumbers,i=1-n,o=t[0],l=t[1],u=t[2],d=r[0],f=r[1],p=r[2];e[0]=a(Math.sqrt(o*o*i+d*d*n)),e[1]=a(Math.sqrt(l*l*i+f*f*n)),e[2]=a(Math.sqrt(u*u*i+p*p*n)),e[3]=a(xe(t[3],r[3],n)),(!c._setter||s)&&(S=`rgba(${J(e[0],0)},${J(e[1],0)},${J(e[2],0)},${e[3]})`)}else g===i.COMPLEX&&(S=Ye(c,n,x));if(y&&(c._number=C),!s&&e!==o.blend){let e=c.property;d=c.target,c._setter?c._setter(d,C,c):v?d[e]=S:_===r.ATTRIBUTE?d.setAttribute(e,S):(f=d.style,_===r.TRANSFORM?(d!==p&&(p=d,m=d[u]),m[e]=S,h=1):_===r.CSS?f[e]=S:_===r.CSS_VAR&&f.setProperty(e,S)),O&&(F=1)}else c._value=S}else n&&v&&!x&&R<c._startTime&&(c._currentTime=0);h&&c._renderTransforms&&(f.transform=Ae(m),h=0),c=c._next}!n&&F&&e.onRender(e)}!n&&O&&e.onUpdate(e)}return l&&A?!n&&(l.began&&!z&&w>0&&!p||z&&w<=1e-11&&p)&&(e.onComplete(e),e.completed=!z):O&&k?h===1/0?e._startTime+=e.duration:e._currentIteration>=h-1&&(e.paused=!0,!p&&!b&&(e.completed=!0,!n&&(!l||!z&&l.began)&&(e.onComplete(e),e._resolve(e)))):e.completed=!1,F},Ze=(e,t,n,r,i)=>{let o=e._currentIteration;if(Xe(e,t,n,r,i),e._hasChildren){let s=e,c=s.backwards,l=r?t:s._iterationTime,u=R(),d=0,f=!0;if(!r&&s._currentIteration!==o){let e=s.iterationDuration;Ee(s,t=>{if(!c)!t.completed&&!t.backwards&&t._currentTime<t.iterationDuration&&Xe(t,e,n,1,a.FORCE),t.began=!1,t.completed=!1;else{let r=t.duration,i=t._offset+t._delay,a=i+r;!n&&r<=1e-11&&(!i||a===e)&&t.onComplete(t)}}),n||s.onLoop(s)}Ee(s,e=>{let t=J((l-e._offset)*e._speed,12);if(c&&t>e._delay+e.duration)return;let a=e._fps<s._fps?e.requestTick(u):i;d+=Xe(e,t,n,r,a),!e.completed&&f&&(f=!1)},c),!n&&d&&s.onRender(s),(f||c)&&s._currentTime>=s.duration&&(s.paused=!0,s.completed||(s.completed=!0,n||(s.onComplete(s),s._resolve(s))))}},Qe={},$e=(e,t,n)=>{if(n===r.TRANSFORM)return g.get(e)||e;if(n===r.CSS||n===r.ATTRIBUTE&&re(t)&&e in t.style){let t=Qe[e];if(t)return t;{let t=e&&I(e);return Qe[e]=t,t}}return e},et=(e,t=!1)=>{if(e._hasChildren)Ee(e,e=>et(e,t),!0);else{let n=e;n.pause(),Ee(n,e=>{let i=e.property,a=e.target,o=e._tweenType,s=e._inlineValue,l=H(s)||s===``;if(e._setter){if(!t&&!l){if(Ke(s,Je),Je.d){let t=Je.d,n=e._numbers;for(let e=0,r=t.length;e<r;e++)n[e]=t[e]}else e._number=Je.n;e._setter(e.target,e._number,e)}}else if(o===r.OBJECT)!t&&!l&&(a[i]=s);else if(a[c]){if(o===r.ATTRIBUTE)t||(l?a.removeAttribute(i):a.setAttribute(i,s));else{let t=a.style;if(o===r.TRANSFORM){let n=a[u];l?delete n[i]:n[i]=s,e._renderTransforms&&(Object.keys(n).length?t.transform=Ae(n):t.removeProperty(`transform`))}else l?t.removeProperty(I(i)):t[i]=s}}a[c]&&n._tail===e&&n.targets.forEach(e=>{e.getAttribute&&e.getAttribute(`style`)===``&&e.removeAttribute(`style`)})})}return e},tt=class{constructor(e=0){this.deltaTime=0,this._currentTime=e,this._lastTickTime=e,this._startTime=e,this._lastTime=e,this._frameDuration=m/240,this._fps=240,this._speed=1,this._hasChildren=!1,this._head=null,this._tail=null}get fps(){return this._fps}set fps(e){let t=+e,n=t<1e-11?f:t,r=m/n;n>M.frameRate&&(M.frameRate=n),this._fps=n,this._frameDuration=r}get speed(){return this._speed}set speed(e){let t=+e;this._speed=t<1e-11?f:t}requestTick(e){let t=this._frameDuration,n=e-this._lastTickTime,r=t*.25;return n+(r<4?r:4)<t?a.NONE:(this._lastTickTime=n>=t?e-n%t:e,a.AUTO)}computeDeltaTime(e){let t=e-this._lastTime;return this.deltaTime=t,this._lastTime=e,t}},nt={animation:null,update:y},rt=e=>{let t=nt.animation;return t||(t={duration:f,computeDeltaTime:y,_offset:0,_delay:0,_head:null,_tail:null},nt.animation=t,nt.update=()=>{e.forEach(e=>{for(let t in e){let n=e[t],r=n._head;if(r){let e=r._valueType,t=e===i.COMPLEX||e===i.COLOR?we(r._fromNumbers):null,a=r._fromNumber,o=n._tail;for(;o&&o!==r;){if(t)for(let e=0,n=o._numbers.length;e<n;e++)t[e]+=o._numbers[e];else a+=o._number;o=o._prevAdd}r._toNumber=a,r._toNumbers=t}}}),Xe(t,1,1,0,a.FORCE)}),t},it=e?requestAnimationFrame:setImmediate,at=e?cancelAnimationFrame:clearImmediate,ot=class extends tt{constructor(e){super(e),this.useDefaultMainLoop=!0,this.pauseOnDocumentHidden=!0,this.defaults=M,this.paused=!0,this.reqId=0}update(){let e=this._currentTime=R();if(this.requestTick(e)){this.computeDeltaTime(e);let t=this._speed,n=this._fps,r=this._head;for(;r;){let i=r._next;r.paused?(De(this,r),this._hasChildren=!!this._tail,r._running=!1,r.completed&&!r._cancelled&&r.cancel()):Ze(r,(e-r._startTime)*r._speed*t,0,0,r._fps<n?r.requestTick(e):a.AUTO),r=i}nt.update()}}wake(){return this.useDefaultMainLoop&&!this.reqId&&(this.requestTick(R()),this.reqId=it(ct)),this}pause(){if(this.reqId)return this.paused=!0,lt()}resume(){if(this.paused)return this.paused=!1,Ee(this,e=>e.resetTime()),this.wake()}get speed(){return this._speed*(P.timeScale===1?1:m)}set speed(e){let t=e*P.timeScale;this._speed!==t&&(this._speed=t,Ee(this,e=>e.speed=e._speed))}get timeUnit(){return P.timeScale===1?`ms`:`s`}set timeUnit(e){let t=.001,n=e===`s`,r=n?t:1;if(P.timeScale!==r){P.timeScale=r,P.tickThreshold=200*r;let e=n?t:m;this.defaults.duration*=e,this._speed*=e}}get precision(){return P.precision}set precision(e){P.precision=e}},st=(()=>{let t=new ot(R());return e&&(F.engine=t,n.addEventListener(`visibilitychange`,()=>{t.pauseOnDocumentHidden&&(n.hidden?t.pause():t.resume())})),t})(),ct=()=>{st._head?(st.reqId=it(ct),st.update()):st.reqId=0},lt=()=>(at(st.reqId),st.reqId=0,st),ut={_rep:new WeakMap,_add:new Map},dt=(e,t,n=`_rep`)=>{let r=ut[n],i=r.get(e);return i||(i={},r.set(e,i)),i[t]?i[t]:i[t]={_head:null,_tail:null}},ft=(e,t)=>e._isOverridden||e._absoluteStartTime>t._absoluteStartTime,pt=e=>{e._isOverlapped=1,e._isOverridden=1,e._changeDuration=f,e._currentTime=f},mt=(e,t)=>{let n=e._composition;if(n===o.replace){let n=e._absoluteStartTime;Oe(t,e,ft,`_prevRep`,`_nextRep`);let r=e._prevRep;if(r){let t=r.parent,i=r._absoluteEndTime;if(e.parent.id!==t.id&&t.iterationCount>1&&i+(t.duration-t.iterationDuration)>n){pt(r);let e=r._prevRep;for(;e&&e.parent.id===t.id;)pt(e),e=e._prevRep}let a=e._absoluteUpdateStartTime;if(i>a){let e=r._startTime,t=J(a-(i-(e+r._updateDuration))-e,12);r._changeDuration=t,r._currentTime=t,r._isOverlapped=1,t<1e-11&&pt(r)}let o=e.parent.parent;if(!o||o!==t.parent){let e=!0;if(Ee(t,t=>{t._isOverlapped||(e=!1)}),e){let e=t.parent;if(e){let n=!0;Ee(e,e=>{e!==t&&Ee(e,e=>{e._isOverlapped||(n=!1)})}),n&&e.cancel()}else t.cancel()}}}}else if(n===o.blend){let t=dt(e.target,e.property,`_add`),n=rt(ut._add),r=t._head;r||(r={...e},r._composition=o.replace,r._updateDuration=f,r._startTime=0,r._numbers=we(e._fromNumbers),r._number=0,r._next=null,r._prev=null,Oe(t,r),Oe(n,r));let i=e._toNumber;if(e._fromNumber=r._fromNumber-i,e._toNumber=0,e._numbers=we(e._fromNumbers),e._number=0,r._fromNumber=i,e._toNumbers.length){let t=we(e._toNumbers);t.forEach((t,n)=>{e._fromNumbers[n]=r._fromNumbers[n]-t,e._toNumbers[n]=0}),r._fromNumbers=t}Oe(t,e,null,`_prevAdd`,`_nextAdd`)}return e},ht=e=>{let t=e._composition;if(t!==o.none){let n=e.target,r=e.property,i=ut._rep.get(n)[r];if(De(i,e,`_prevRep`,`_nextRep`),t===o.blend){let t=ut._add,i=t.get(n);if(!i)return;let a=i[r],o=nt.animation;De(a,e,`_prevAdd`,`_nextAdd`);let s=a._head;if(s&&s===a._tail){De(a,s,`_prevAdd`,`_nextAdd`),De(o,s);let e=!0;for(let t in i)if(i[t]._head){e=!1;break}e&&t.delete(n)}}}return e},gt=(e,t,n)=>{let i=!1;return Ee(t,a=>{let o=a.target;if(e.includes(o)){let e=a.property,s=a._tweenType,c=$e(n,o,s);(!c||c&&c===e)&&(a.parent._tail===a&&a._tweenType===r.TRANSFORM&&a._prev&&a._prev._tweenType===r.TRANSFORM&&(a._prev._renderTransforms=1),De(t,a),ht(a),i=!0)}},!0),i},_t=(e,t,n)=>{let r=t||st,i;if(r._hasChildren){let t=0;Ee(r,a=>{if(!a._hasChildren){if(i=gt(e,a,n),i&&!a._head)a.cancel(),De(r,a);else{let e=a._offset+a._delay+a.duration;e>t&&(t=e)}}a._head?_t(e,a,n):a._hasChildren=!1},!0),V(r.iterationDuration)||(r.iterationDuration=t)}else i=gt(e,r,n);i&&!r._head&&(r._hasChildren=!1,r.cancel&&r.cancel())},vt=e=>(e.paused=!0,e.began=!1,e.completed=!1,e),yt=e=>(e._cancelled&&=(e._hasChildren?Ee(e,yt):Ee(e,e=>{e._composition!==o.none&&mt(e,dt(e.target,e.property))}),0),e),bt=0,xt=(e,t)=>e._priority>t._priority,St=class extends tt{constructor(e={},t=null,n=0){super(0),++bt;let{id:r,delay:i,duration:a,reversed:o,alternate:s,loop:c,loopDelay:l,autoplay:u,frameRate:d,playbackRate:f,priority:p,onComplete:m,onLoop:h,onPause:g,onBegin:_,onBeforeUpdate:v,onUpdate:b}=e;N.current&&N.current.register(this);let x=t?0:st._lastTickTime,S=t?t.defaults:P.defaults,C=ne(i)||V(i)?S.delay:+i,w=ne(a)||V(a)?1/0:+a,T=Re(c,S.loop),E=Re(l,S.loopDelay),D=T===!0||T===1/0||T<0?1/0:T+1,O=0;t?O=n:(st.reqId||st.requestTick(R()),O=(st._lastTickTime-st._startTime)*P.timeScale),this.id=V(r)?bt:r,this.parent=t,this.duration=Se((w+E)*D-E)||1e-11,this.backwards=!1,this.paused=!0,this.began=!1,this.completed=!1,this.onBegin=_||S.onBegin,this.onBeforeUpdate=v||S.onBeforeUpdate,this.onUpdate=b||S.onUpdate,this.onLoop=h||S.onLoop,this.onPause=g||S.onPause,this.onComplete=m||S.onComplete,this.iterationDuration=w,this.iterationCount=D,this._autoplay=!t&&Re(u,S.autoplay),this._offset=O,this._delay=C,this._loopDelay=E,this._iterationTime=0,this._currentIteration=0,this._resolve=y,this._running=!1,this._reversed=+Re(o,S.reversed),this._reverse=this._reversed,this._cancelled=0,this._alternate=Re(s,S.alternate),this._prev=null,this._next=null,this._lastTickTime=x,this._startTime=x,this._lastTime=x,this._fps=Re(d,S.frameRate),this._speed=Re(f,S.playbackRate),this._priority=+Re(p,1)}get cancelled(){return!!this._cancelled}set cancelled(e){e?this.cancel():this.reset(!0).play()}get currentTime(){return q(J(this._currentTime,P.precision),-this._delay,this.duration)}set currentTime(e){let t=this.paused;this.pause().seek(+e),t||this.resume()}get iterationCurrentTime(){return q(J(this._iterationTime,P.precision),0,this.iterationDuration)}set iterationCurrentTime(e){this.currentTime=this.iterationDuration*this._currentIteration+e}get progress(){return q(J(this._currentTime/this.duration,10),0,1)}set progress(e){this.currentTime=this.duration*e}get iterationProgress(){return q(J(this._iterationTime/this.iterationDuration,10),0,1)}set iterationProgress(e){let t=this.iterationDuration;this.currentTime=t*this._currentIteration+t*e}get currentIteration(){return this._currentIteration}set currentIteration(e){this.currentTime=this.iterationDuration*q(+e,0,this.iterationCount-1)}get reversed(){return!!this._reversed}set reversed(e){e?this.reverse():this.play()}get speed(){return super.speed}set speed(e){super.speed=e,this.resetTime()}reset(e=!1){return yt(this),this._reversed&&!this._reverse&&(this.reversed=!1),this._iterationTime=this.iterationDuration,Ze(this,0,1,~~e,a.FORCE),vt(this),this._hasChildren&&Ee(this,vt),this}init(e=!1){this.fps=this._fps,this.speed=this._speed,!e&&this._hasChildren&&Ze(this,this.duration,1,~~e,a.FORCE),this.reset(e);let t=this._autoplay;return t===!0?this.resume():t&&!V(t.linked)&&t.link(this),this}resetTime(){let e=1/(this._speed*st._speed);return this._startTime=R()-(this._currentTime+this._delay)*e,this}pause(){return this.paused||(this.paused=!0,this.onPause(this)),this}resume(){return this.paused&&(this.paused=!1,this.duration<=1e-11&&!this._hasChildren?Ze(this,f,0,0,a.FORCE):(this._running||=(Oe(st,this,xt),st._hasChildren=!0,!0),this.resetTime(),this._startTime-=12,st.wake())),this}restart(){return this.reset().resume()}seek(e,t=0,n=0){yt(this),this.completed=!1;let r=this.paused;return this.paused=!0,Ze(this,e+this._delay,~~t,~~n,a.AUTO),r?this:this.resume()}alternate(){let e=this._reversed,t=this.iterationCount,n=this.iterationDuration,r=t===1/0?_e(p/n):t;return this._reversed=+(this._alternate&&!(r%2)?e:!e),t===1/0?this.iterationProgress=this._reversed?1-this.iterationProgress:this.iterationProgress:this.seek(n*r-this._currentTime),this.resetTime(),this}play(){return this._reversed&&this.alternate(),this.resume()}reverse(){return this._reversed||this.alternate(),this.resume()}cancel(){return this._hasChildren?Ee(this,e=>e.cancel(),!0):Ee(this,ht),this._cancelled=1,this.pause()}stretch(e){let t=this.duration,n=Ce(e);if(t===n)return this;let r=e/t,i=e<=f;return this.duration=i?f:n,this.iterationDuration=i?f:Ce(this.iterationDuration*r),this._offset*=r,this._delay*=r,this._loopDelay*=r,this}revert(){Ze(this,0,1,0,a.AUTO);let e=this._autoplay;return e&&e.linked&&e.linked===this&&e.revert(),this.cancel()}complete(e=0){return this.seek(this.duration,e).cancel()}then(e=y){let t=this.then,n=()=>{this.then=null,e(this),this.then=t,this._resolve=y};return new Promise(e=>(this._resolve=()=>e(n()),this.completed&&this._resolve(),this))}};function Ct(e){let t=te(e)?N.root.querySelectorAll(e):e;if(t instanceof NodeList||t instanceof HTMLCollection)return t}function wt(t){if(H(t))return[];if(!e)return z(t)&&t.flat(1/0)||[t];if(z(t)){let e=t.flat(1/0),n=[];for(let t=0,r=e.length;t<r;t++){let r=e[t];if(!H(r)){let e=Ct(r);if(e)for(let t=0,r=e.length;t<r;t++){let r=e[t];if(!H(r)){let e=!1;for(let t=0,i=n.length;t<i;t++)if(n[t]===r){e=!0;break}e||n.push(r)}}else{let e=!1;for(let t=0,i=n.length;t<i;t++)if(n[t]===r){e=!0;break}e||n.push(r)}}}return n}let n=Ct(t);return n?Array.from(n):[t]}function Tt(e){let t=wt(e),n=t.length;for(let e=0;e<n;e++){let n=t[e];if(!n[s]){n[s]=!0;let e=re(n);(n.nodeType||e)&&(n[c]=!0,n[l]=e,n[u]={})}}return t}var Et={deg:1,rad:180/K,turn:360},Dt={},Ot=(e,t,r,a=!1)=>{let o=t.u,s=t.n;if(t.t===i.UNIT&&o===r)return t;let c=s+o+r,l=Dt[c];if(!V(l)&&!a)t.n=l;else{let i;if(o in Et)i=s*Et[o]/Et[r];else{let t=e.cloneNode(),a=e.parentNode,c=a&&a!==n?a:n.body;c.appendChild(t);let l=t.style;l.width=100+o;let u=t.offsetWidth||100;l.width=100+r;let d=u/(t.offsetWidth||100);c.removeChild(t),i=d*s}t.n=i,Dt[c]=i}return t.t,i.UNIT,t.u=r,t},kt=e=>e,At=(e=1.68)=>t=>fe(t,+e),jt={in:e=>t=>e(t),out:e=>t=>1-e(1-t),inOut:e=>t=>t<.5?e(t*2)/2:1-e(t*-2+2)/2,outIn:e=>t=>t<.5?(1-e(1-t*2))/2:(e(t*2-1)+1)/2},Mt=K/2,Nt=K*2,Pt={"":At,Quad:At(2),Cubic:At(3),Quart:At(4),Quint:At(5),Sine:e=>1-U(e*Mt),Circ:e=>1-pe(1-e*e),Expo:e=>e?fe(2,10*e-10):0,Bounce:e=>{let t,n=4;for(;e<((t=fe(2,--n))-1)/11;);return 1/fe(4,3-n)-7.5625*fe((t*3-2)/22-e,2)},Back:(e=1.7)=>t=>(+e+1)*t*t*t-+e*t*t,Elastic:(e=1,t=.3)=>{let n=q(+e,1,10),r=q(+t,f,2),i=r/Nt*W(1/n),a=Nt/r;return e=>e===0||e===1?e:-n*fe(2,-10*(1-e))*me((1-e-i)*a)}},Ft=(()=>{let e={linear:kt,none:kt};for(let t in jt)for(let n in Pt){let r=Pt[n],i=jt[t];e[t+n]=n===``||n===`Back`||n===`Elastic`?(e,t)=>i(r(e,t)):i(r)}return e})(),It={linear:kt,none:kt},Lt=e=>{if(It[e])return It[e];if(e.indexOf(`(`)<=-1){let t=jt[e]||e.includes(`Back`)||e.includes(`Elastic`)?Ft[e]():Ft[e];return t?It[e]=t:kt}{let t=e.slice(0,-1).split(`(`),n=Ft[t[0]];return n?It[e]=n(...t[1].split(`,`)):kt}},Rt=[`steps(`,`irregular(`,`linear(`,`cubicBezier(`],zt=e=>{if(te(e)){for(let t=0,n=Rt.length;t<n;t++)if(L(e,Rt[t]))return console.warn(`String syntax for \`ease: "${e}"\` has been removed from the core and replaced by importing and passing the easing function directly: \`ease: ${e}\``),kt}return ne(e)?e:te(e)?Lt(e):kt},Bt=Ge(),Vt=Ge(),Ht={},Ut={func:null},Wt={func:null},Gt=[null],Kt=[null,null],qt={to:null},Jt=0,Yt=0,Xt,Zt,Qt=(e,t)=>{let n={};if(z(e)){let t=[].concat(...e.map(e=>Object.keys(e))).filter(ce);for(let r=0,i=t.length;r<i;r++){let i=t[r];n[i]=e.map(e=>{let t={};for(let n in e){let r=e[n];ce(n)?n===i&&(t.to=r):t[n]=r}return t})}}else{let r=Re(t.duration,P.defaults.duration);Object.keys(e).map(t=>({o:parseFloat(t)/100,p:e[t]})).sort((e,t)=>e.o-t.o).forEach(e=>{let t=e.o,i=e.p;for(let e in i)if(ce(e)){let a=n[e];a||=n[e]=[];let o=t*r,s=a.length,c=a[s-1],l={to:i[e]},u=0;for(let e=0;e<s;e++)u+=a[e].duration;s===1&&(l.from=c.to),i.ease&&(l.ease=i.ease),l.duration=o-(s?u:0),a.push(l)}return e});for(let e in n){let t=n[e],r;for(let e=0,n=t.length;e<n;e++){let n=t[e],i=n.ease;n.ease=r||void 0,r=i}t[0].duration||t.shift()}}return n},$t=class extends St{constructor(e,t,n,a,s=!1,c=0,l){super(t,n,a),this._head,this._tail,++Yt;let u=Tt(e),d=u.length,p=t.keyframes,m=p?Te(Qt(p,t),t):t,{id:g,delay:_,duration:v,ease:y,playbackEase:b,modifier:x,composition:S,onRender:C}=m,w=n?n.defaults:P.defaults,T=Re(y,w.ease),E=Re(b,w.playbackEase),D=E?zt(E):null,O=!V(T.ease),k=O?T.ease:Re(y,D?`linear`:w.ease),A=O?T.settlingDuration:Re(v,w.duration),j=Re(_,w.delay),M=x||w.modifier,N=V(S)&&d>=1e3?o.none:V(S)?w.composition:S,F=this._offset+(n?n._offset:0);O&&(T.parent=this);let I=NaN,L=NaN,R=0,re=0;for(let e=0;e<d;e++){let t=u[e],a=c||e,d=l||u,f=NaN,p=NaN;for(let e in m)if(ce(e)){let c=Ve(t,e),l=Me(t,e),u=$e(e,t,c),g=m[e],_=z(g);if(s&&!_&&(Kt[0]=g,Kt[1]=g,g=Kt),_){let e=g.length,t=!ee(g[0]);e===2&&t?(qt.to=g,Gt[0]=qt,Xt=Gt):e>2&&t?(Xt=[],g.forEach((e,t)=>{t?t===1?(Kt[1]=e,Xt.push(Kt)):Xt.push(e):Kt[0]=e})):Xt=g}else Gt[0]=g,Xt=Gt;let v=null,y=null,b=NaN,x=0,S=0;for(let e=Xt.length;S<e;S++){let r=Xt[S];ee(r)?Zt=r:(qt.to=r,Zt=qt),Ut.func=null,Wt.func=null;let s=Be(Re(Zt.composition,N),t,a,d,null,null),f=B(s)?s:o[s];!v&&f!==o.none&&(v=dt(t,u));let p=v?v._tail:null,m=n&&p&&p.parent.parent===n?p:y,g=Be(Zt.to,t,a,d,Ut,m),_;ee(g)&&!V(g.to)?(Zt=g,_=g.to):_=g;let C=Be(Zt.from,t,a,d,Wt,m),w=Zt.ease||k,T=Be(w,t,a,d,null,m),E=ne(T)||te(T)?T:w,D=!V(E)&&!V(E.ease),O=D?E.ease:E,P=D?E.settlingDuration:Be(Re(Zt.duration,e>1?Be(A,t,a,d,null,m)/e:A),t,a,d,null,m),I=Be(Re(Zt.delay,S?0:j),t,a,d,null,m),L=Zt.modifier||M,ie=!V(C),ae=!V(_),oe=z(_),se=oe||ie&&ae,ce=y?x:0,le=y?x+I:I,ue=J(F+le,12),de=J(F+ce,12);!re&&(ie||oe)&&(re=1);let fe=y;if(f!==o.none){let e=v._head;for(;e&&e._absoluteStartTime<=ue;)if(e._isOverridden||(fe=e),e=e._nextRep,e&&e._absoluteStartTime>=ue)for(;e;)pt(e),e=e._nextRep}if(se){Ke(oe?Be(_[0],t,a,d,Wt,m):C,Bt),Ke(oe?Be(_[1],t,a,d,Ut,m):_,Vt);let e=Ue(t,u,c,Ht);Bt.t===i.NUMBER&&(fe?fe._valueType===i.UNIT&&(Bt.t=i.UNIT,Bt.u=fe._unit):(Ke(e,Je),Je.t===i.UNIT&&(Bt.t=i.UNIT,Bt.u=Je.u)))}else ae?Ke(_,Vt):y?qe(y,Vt):Ke(n&&fe&&fe.parent.parent===n?fe._value:Ue(t,u,c,Ht),Vt),ie?Ke(C,Bt):y?qe(y,Bt):Ke(n&&fe&&fe.parent.parent===n?fe._value:Ue(t,u,c,Ht),Bt);if(Bt.o&&(Bt.n=We(fe?fe._toNumber:Ke(Ue(t,u,c,Ht),Je).n,Bt.n,Bt.o)),Vt.o&&(Vt.n=We(Bt.n,Vt.n,Vt.o)),Bt.t!==Vt.t){if(Bt.t===i.COMPLEX||Vt.t===i.COMPLEX){let e=Bt.t===i.COMPLEX?Bt:Vt,t=Bt.t===i.COMPLEX?Vt:Bt;t.t=i.COMPLEX,t.s=we(e.s),t.d=e.d.map(()=>t.n)}else if(Bt.t===i.UNIT||Vt.t===i.UNIT){let e=Bt.t===i.UNIT?Bt:Vt,t=Bt.t===i.UNIT?Vt:Bt;t.t=i.UNIT,t.u=e.u}else if(Bt.t===i.COLOR||Vt.t===i.COLOR){let e=Bt.t===i.COLOR?Bt:Vt,t=Bt.t===i.COLOR?Vt:Bt;t.t=i.COLOR,t.d=e.d.map(()=>0)}}if(Bt.u!==Vt.u){let e=Vt.u?Bt:Vt;e=Ot(t,e,Vt.u?Vt.u:Bt.u,!1)}if(Vt.d&&Bt.d&&Vt.d.length!==Bt.d.length){let e=Bt.d.length>Vt.d.length?Bt:Vt,t=e===Bt?Vt:Bt;t.d=e.d.map((e,n)=>V(t.d[n])?0:t.d[n]),t.s=we(e.s)}let pe=J(+P||1e-11,12),me=Ht[u];H(me)||(Ht[u]=null);let U=l?l.set:null;x=J(le+pe,12);let he=Bt.d,ge=Vt.d,_e=Vt.s,W={parent:this,id:Jt++,property:u,target:t,_value:null,_toFunc:Ut.func,_fromFunc:Wt.func,_ease:zt(O),_fromNumbers:he?we(he):h,_toNumbers:ge?we(ge):h,_strings:_e?we(_e):h,_fromNumber:Bt.n,_toNumber:Vt.n,_numbers:he?we(he):h,_number:Bt.n,_unit:Vt.u,_modifier:L,_currentTime:0,_startTime:le,_delay:+I,_updateDuration:pe,_changeDuration:pe,_absoluteStartTime:ue,_absoluteUpdateStartTime:de,_absoluteEndTime:J(F+x,12),_hasFromValue:ie||oe?1:0,_tweenType:c,_setter:U,_valueType:Vt.t,_composition:f,_isOverlapped:0,_isOverridden:0,_renderTransforms:0,_inlineValue:me,_prevRep:null,_nextRep:null,_prevAdd:null,_nextAdd:null,_prev:null,_next:null};f!==o.none&&mt(W,v);let ve=W._valueType;if(ve===i.COMPLEX)W._value=Ye(W,1,-1);else if(ve===i.UNIT)W._value=`${L(W._toNumber)}${W._unit}`;else if(ve===i.COLOR){let e=Vt.d;W._value=`rgba(${J(e[0],0)},${J(e[1],0)},${J(e[2],0)},${e[3]})`}else W._value=L(W._toNumber);isNaN(b)&&(b=W._startTime),y=W,R++,Oe(this,W)}(isNaN(L)||b<L)&&(L=b),(isNaN(I)||x>I)&&(I=x),c===r.TRANSFORM&&(f=R-S,p=R)}if(!isNaN(f)){let e=0;Ee(this,t=>{e>=f&&e<p&&(t._renderTransforms=1,t._composition===o.blend&&Ee(nt.animation,e=>{e.id===t.id&&(e._renderTransforms=1)})),e++})}}d||console.warn(`No target found. Make sure the element you're trying to animate is accessible before creating your animation.`),L?(Ee(this,e=>{e._startTime-e._delay||(e._delay-=L),e._startTime-=L}),I-=L):L=0,I||(I=f,this.iterationCount=0),this.targets=u,this.id=V(g)?Yt:g,this.duration=I===1e-11?f:Se((I+this._loopDelay)*this.iterationCount-this._loopDelay)||1e-11,this.onRender=C||w.onRender,this._ease=D,this._delay=L,this.iterationDuration=I,!this._autoplay&&re&&this.onRender(this)}stretch(e){let t=this.duration;if(t===Ce(e))return this;let n=e/t;return Ee(this,e=>{e._updateDuration=Ce(e._updateDuration*n),e._changeDuration=Ce(e._changeDuration*n),e._currentTime*=n,e._delay*=n,e._startTime*=n,e._absoluteStartTime*=n,e._absoluteUpdateStartTime*=n,e._absoluteEndTime*=n}),super.stretch(e)}refresh(){return Ee(this,e=>{let t=e._toFunc,n=e._fromFunc;(t||n)&&(n?(Ke(n(),Bt),Bt.u!==e._unit&&e.target[c]&&Ot(e.target,Bt,e._unit,!0),e._fromNumbers=we(Bt.d),e._fromNumber=Bt.n):t&&(Ke(Ue(e.target,e.property,e._tweenType),Je),e._fromNumbers=we(Je.d),e._fromNumber=Je.n),t&&(Ke(t(),Vt),e._toNumbers=we(Vt.d),e._strings=we(Vt.s),e._toNumber=Vt.o?We(e._fromNumber,Vt.n,Vt.o):Vt.n))}),this.duration===1e-11&&this.restart(),this}revert(){return super.revert(),et(this)}then(e){return super.then(e)}},en=(e,t)=>P.editor?P.editor.addAnimation(e,t):new $t(e,t,null,0,!1).init(),tn=(e,t)=>{if(L(t,`<`)){let n=t[1]===`<`,r=e._tail,i=r?r._offset+r._delay:0;return n?i:i+r.duration}},nn=(e,t)=>{let n=e.iterationDuration;if(n===1e-11&&(n=0),V(t))return n;if(B(+t))return+t;let r=t,i=e?e.labels:null,a=!H(i),o=tn(e,r),s=!V(o),c=A.exec(r);if(c){let e=c[0],t=r.split(e),l=a&&t[0]?i[t[0]]:n;return We(s?o:a?l:n,+t[1],e[0])}return s?o:a?V(i[r])?n:i[r]:n},rn=class{constructor(e,t){N.current&&N.current.register(this);let n=()=>{this.callbacks.completed&&this.callbacks.reset(),this.callbacks.play()},r=()=>{if(this.callbacks.completed)return;let e=!0;for(let t in this.animations)if(!this.animations[t].paused&&e){e=!1;break}e&&this.callbacks.complete()},i={onBegin:n,onComplete:r,onPause:r},a={v:1,autoplay:!1},s={};if(this.targets=[],this.animations={},this.callbacks=null,!(V(e)||V(t))){for(let e in t){let n=t[e];ce(e)?s[e]=n:L(e,`on`)?a[e]=n:i[e]=n}this.callbacks=new $t({v:0},a);for(let t in s){let n=s[t],r=ee(n),a={},c=`+=0`;if(r){let e=n.unit;te(e)&&(c+=e)}else a.duration=n;a[t]=r?Te({to:c},n):c;let l=Te(i,a);l.composition=o.replace,l.autoplay=!1;let u=this.animations[t]=new $t(e,l,null,0,!1).init();this.targets.length||this.targets.push(...u.targets),this[t]=(e,t,n)=>{let r=u._head;if(V(e)&&r){let e=r._numbers;return e&&e.length?e:r._modifier(r._number)}return Ee(u,t=>{if(z(e))for(let n=0,r=e.length;n<r;n++)V(t._numbers[n])||(t._fromNumbers[n]=t._modifier(t._numbers[n]),t._toNumbers[n]=e[n]);else t._fromNumber=t._modifier(t._number),t._toNumber=e;V(n)||(t._ease=zt(n)),t._currentTime=0}),V(t)||u.stretch(t),u.reset(!0).resume(),this}}}}revert(){for(let e in this.animations)this[e]=y,this.animations[e].revert();return this.animations={},this.targets.length=0,this.callbacks&&this.callbacks.revert(),this}},an=(e,t,n,r,i)=>r+(e-t)/(n-t)*(i-r),on=m*10,sn=class{constructor(e={}){let t=!V(e.bounce)||!V(e.duration);this.timeStep=.02,this.restThreshold=5e-4,this.restDuration=200,this.maxDuration=6e4,this.maxRestSteps=this.restDuration/this.timeStep/m,this.maxIterations=this.maxDuration/this.timeStep/m,this.bn=q(Re(e.bounce,.5),-1,1),this.pd=q(Re(e.duration,628),10*P.timeScale,on*P.timeScale),this.m=q(Re(e.mass,1),1,on),this.s=q(Re(e.stiffness,100),f,on),this.d=q(Re(e.damping,10),f,on),this.v=q(Re(e.velocity,0),-on,on),this.w0=0,this.zeta=0,this.wd=0,this.b=0,this.completed=!1,this.solverDuration=0,this.settlingDuration=0,this.parent=null,this.onComplete=e.onComplete||y,t&&this.calculateSDFromBD(),this.compute(),this.ease=e=>{let t=e*this.settlingDuration,n=this.completed,r=this.pd;return t>=r&&!n&&(this.completed=!0,this.onComplete(this.parent)),t<r&&n&&(this.completed=!1),e===0||e===1?e:this.solve(e*this.solverDuration)}}solve(e){let{zeta:t,w0:n,wd:r,b:i}=this,a=e;return a=t<1?ge(-a*t*n)*(1*U(r*a)+i*me(r*a)):t===1?(1+i*a)*ge(-a*n):((1+i)*ge((-t*n+r)*a)+(1-i)*ge((-t*n-r)*a))/2,1-a}calculateSDFromBD(){let e=P.timeScale===1?this.pd/m:this.pd;this.m=1,this.v=0,this.s=fe(2*K/e,2),this.d=this.bn>=0?(1-this.bn)*4*K/e:4*K/(e*(1+this.bn)),this.s=J(q(this.s,f,on),3),this.d=J(q(this.d,f,300),3)}calculateBDFromSD(){let e=2*K/pe(this.s);this.pd=e*(P.timeScale===1?m:1),this.bn=this.d/(2*pe(this.s))<=1?1-this.d*e/(4*K):4*K/(this.d*e)-1,this.bn=J(q(this.bn,-1,1),3),this.pd=J(q(this.pd,10*P.timeScale,on*P.timeScale),3)}compute(){let{maxRestSteps:e,maxIterations:t,restThreshold:n,timeStep:r,m:i,d:a,s:o,v:s}=this,c=this.w0=q(pe(o/i),f,m),l=this.zeta=a/(2*pe(o*i));l<1?(this.wd=c*pe(1-l*l),this.b=(l*c+-s)/this.wd):l===1?(this.wd=0,this.b=-s+c):(this.wd=c*pe(l*l-1),this.b=(l*c+-s)/this.wd);let u=0,d=0,p=0;for(;d<=e&&p<=t;)he(1-this.solve(u))<n?d++:d=0,this.solverDuration=u,u+=r,p++;this.settlingDuration=J(this.solverDuration*m,0)*P.timeScale}get bounce(){return this.bn}set bounce(e){this.bn=q(Re(e,1),-1,1),this.calculateSDFromBD(),this.compute()}get duration(){return this.pd}set duration(e){this.pd=q(Re(e,1),10*P.timeScale,on*P.timeScale),this.calculateSDFromBD(),this.compute()}get stiffness(){return this.s}set stiffness(e){this.s=q(Re(e,100),f,on),this.calculateBDFromSD(),this.compute()}get damping(){return this.d}set damping(e){this.d=q(Re(e,10),f,on),this.calculateBDFromSD(),this.compute()}get mass(){return this.m}set mass(e){this.m=q(Re(e,1),1,on),this.compute()}get velocity(){return this.v}set velocity(e){this.v=q(Re(e,0),-on,on),this.compute()}},cn=e=>new sn(e);function ln(e,t,n){let r=Tt(e);if(!r.length)return;let[a]=r,o=Ue(a,$e(t,a,Ve(a,t)));if(V(n))return o;if(Ke(o,Je),Je.t===i.NUMBER||Je.t===i.UNIT){if(n===!1)return Je.n;{let e=Ot(a,Je,n,!1);return`${J(e.n,P.precision)}${e.u}`}}}var un=(e,t)=>{if(!V(t))return P.editor&&P.editor.addSet?P.editor.addSet(e,t):(t.duration=f,t.composition=Re(t.composition,o.none),new $t(e,t,null,0,!0).resume())},dn=e=>{e.cancelable&&e.preventDefault()},fn=class{constructor(e){this.el=e,this.zIndex=0,this.parentElement=null,this.classList={add:y,remove:y}}get x(){return this.el.x||0}set x(e){this.el.x=e}get y(){return this.el.y||0}set y(e){this.el.y=e}get width(){return this.el.width||0}set width(e){this.el.width=e}get height(){return this.el.height||0}set height(e){this.el.height=e}getBoundingClientRect(){return{top:this.y,right:this.x,bottom:this.y+this.height,left:this.x+this.width}}},pn=class{constructor(e){this.$el=e,this.inlineTransforms=[],this.point=new DOMPoint,this.inversedMatrix=this.getMatrix().inverse()}normalizePoint(e,t){return this.point.x=e,this.point.y=t,this.point.matrixTransform(this.inversedMatrix)}traverseUp(e){let t=this.$el.parentElement,r=0;for(;t&&t!==n;)e(t,r),t=t.parentElement,r++}getMatrix(){let e=new DOMMatrix;return this.traverseUp(t=>{let n=getComputedStyle(t).transform;if(n){let t=new DOMMatrix(n);e.preMultiplySelf(t)}}),e}remove(){this.traverseUp((e,t)=>{this.inlineTransforms[t]=e.style.transform,e.style.transform=`none`})}revert(){this.traverseUp((e,t)=>{let n=this.inlineTransforms[t];n===``?e.style.removeProperty(`transform`):e.style.transform=n})}},mn=(e,t)=>e&&ne(e)?e(t):e,hn=0,gn=class{constructor(e,r={}){if(!e)return;N.current&&N.current.register(this);let i=r.x,a=r.y,o=r.trigger,s=r.modifier,c=r.releaseEase,l=c&&zt(c),u=!V(c)&&!V(c.ease),d=ee(i)&&!V(i.mapTo)?i.mapTo:`translateX`,f=ee(a)&&!V(a.mapTo)?a.mapTo:`translateY`,m=mn(r.container,this);this.containerArray=z(m)?m:null,this.$container=m&&!this.containerArray?wt(m)[0]:n.body,this.useWin=this.$container===n.body,this.$scrollContainer=this.useWin?t:this.$container,this.$target=ee(e)?new fn(e):wt(e)[0],this.$trigger=wt(o||e)[0],this.fixed=ln(this.$target,`position`)===`fixed`,this.isFinePointer=!0,this.containerPadding=[0,0,0,0],this.containerFriction=0,this.releaseContainerFriction=0,this.snapX=0,this.snapY=0,this.scrollSpeed=0,this.scrollThreshold=0,this.dragSpeed=0,this.dragThreshold=3,this.maxVelocity=0,this.minVelocity=0,this.velocityMultiplier=0,this.cursor=!1,this.releaseXSpring=u?c:cn({mass:Re(r.releaseMass,1),stiffness:Re(r.releaseStiffness,80),damping:Re(r.releaseDamping,20)}),this.releaseYSpring=u?c:cn({mass:Re(r.releaseMass,1),stiffness:Re(r.releaseStiffness,80),damping:Re(r.releaseDamping,20)}),this.releaseEase=l||Ft.outQuint,this.hasReleaseSpring=u,this.onGrab=r.onGrab||y,this.onDrag=r.onDrag||y,this.onRelease=r.onRelease||y,this.onUpdate=r.onUpdate||y,this.onSettle=r.onSettle||y,this.onSnap=r.onSnap||y,this.onResize=r.onResize||y,this.onAfterResize=r.onAfterResize||y,this.disabled=[0,0];let h={};if(s&&(h.modifier=s),V(i)||i===!0)h[d]=0;else if(ee(i)){let e=i,t={};e.modifier&&(t.modifier=e.modifier),e.composition&&(t.composition=e.composition),h[d]=t}else i===!1&&(h[d]=0,this.disabled[0]=1);if(V(a)||a===!0)h[f]=0;else if(ee(a)){let e=a,t={};e.modifier&&(t.modifier=e.modifier),e.composition&&(t.composition=e.composition),h[f]=t}else a===!1&&(h[f]=0,this.disabled[1]=1);this.animate=new rn(this.$target,h),this.xProp=d,this.yProp=f,this.destX=0,this.destY=0,this.deltaX=0,this.deltaY=0,this.scroll={x:0,y:0},this.coords=[this.x,this.y,0,0],this.snapped=[0,0],this.pointer=[0,0,0,0,0,0,0,0],this.scrollView=[0,0],this.dragArea=[0,0,0,0],this.containerBounds=[-p,p,p,-p],this.scrollBounds=[0,0,0,0],this.targetBounds=[0,0,0,0],this.window=[0,0],this.velocityStack=[0,0,0],this.velocityStackIndex=0,this.velocityTime=R(),this.velocity=0,this.angle=0,this.cursorStyles=null,this.triggerStyles=null,this.bodyStyles=null,this.targetStyles=null,this.touchActionStyles=null,this.transforms=new pn(this.$target),this.overshootCoords={x:0,y:0},this.overshootTicker=new St({autoplay:!1,onUpdate:()=>{this.updated=!0,this.manual=!0,this.disabled[0]||this.animate[this.xProp](this.overshootCoords.x,1),this.disabled[1]||this.animate[this.yProp](this.overshootCoords.y,1)},onComplete:()=>{this.manual=!1,this.disabled[0]||this.animate[this.xProp](this.overshootCoords.x,0),this.disabled[1]||this.animate[this.yProp](this.overshootCoords.y,0)}},null,0).init(),this.updateTicker=new St({autoplay:!1,onUpdate:()=>this.update()},null,0).init(),this.contained=!V(m),this.manual=!1,this.grabbed=!1,this.dragged=!1,this.updated=!1,this.released=!1,this.canScroll=!1,this.enabled=!1,this.initialized=!1,this.activeProp=this.disabled[1]?d:f,this.animate.callbacks.onRender=()=>{let e=this.updated,t=!(this.grabbed&&e)&&this.released,n=this.x,r=this.y,i=n-this.coords[2],a=r-this.coords[3];this.deltaX=i,this.deltaY=a,this.coords[2]=n,this.coords[3]=r,e&&(i||a)&&this.onUpdate(this),t?(this.computeVelocity(i,a),this.angle=G(a,i)):this.updated=!1},this.animate.callbacks.onComplete=()=>{!this.grabbed&&this.released&&(this.released=!1),this.manual||(this.deltaX=0,this.deltaY=0,this.velocity=0,this.velocityStack[0]=0,this.velocityStack[1]=0,this.velocityStack[2]=0,this.velocityStackIndex=0,this.onSettle(this))},this.resizeTicker=new St({autoplay:!1,duration:150*P.timeScale,onComplete:()=>{this.onResize(this),this.refresh(),this.onAfterResize(this)}}).init(),this.parameters=r,this.resizeObserver=new ResizeObserver(()=>{this.initialized?this.resizeTicker.restart():this.initialized=!0}),this.enable(),this.refresh(),this.resizeObserver.observe(this.$container),ee(e)||this.resizeObserver.observe(this.$target)}computeVelocity(e,t){let n=this.velocityTime,r=R(),i=r-n;if(i<17)return this.velocity;this.velocityTime=r;let a=this.velocityStack,o=this.velocityMultiplier,s=this.minVelocity,c=this.maxVelocity,l=this.velocityStackIndex;a[l]=J(q(pe(e*e+t*t)/i*o,s,c),5);let u=ve(a[0],a[1],a[2]);return this.velocity=u,this.velocityStackIndex=(l+1)%3,u}setX(e,t=!1){if(this.disabled[0])return;let n=J(e,5);return this.overshootTicker.pause(),this.manual=!0,this.updated=!t,this.destX=n,this.snapped[0]=be(n,this.snapX),this.animate[this.xProp](n,0),this.manual=!1,this}setY(e,t=!1){if(this.disabled[1])return;let n=J(e,5);return this.overshootTicker.pause(),this.manual=!0,this.updated=!t,this.destY=n,this.snapped[1]=be(n,this.snapY),this.animate[this.yProp](n,0),this.manual=!1,this}get x(){return J(this.animate[this.xProp](),P.precision)}set x(e){this.setX(e,!1)}get y(){return J(this.animate[this.yProp](),P.precision)}set y(e){this.setY(e,!1)}get progressX(){return an(this.x,this.containerBounds[3],this.containerBounds[1],0,1)}set progressX(e){this.setX(an(e,0,1,this.containerBounds[3],this.containerBounds[1]),!1)}get progressY(){return an(this.y,this.containerBounds[0],this.containerBounds[2],0,1)}set progressY(e){this.setY(an(e,0,1,this.containerBounds[0],this.containerBounds[2]),!1)}updateScrollCoords(){let e=J(this.useWin?t.scrollX:this.$container.scrollLeft,0),n=J(this.useWin?t.scrollY:this.$container.scrollTop,0),[r,i,a,o]=this.containerPadding,s=this.scrollThreshold;this.scroll.x=e,this.scroll.y=n,this.scrollBounds[0]=n-this.targetBounds[0]+r-s,this.scrollBounds[1]=e-this.targetBounds[1]-i+s,this.scrollBounds[2]=n-this.targetBounds[2]-a+s,this.scrollBounds[3]=e-this.targetBounds[3]+o-s}updateBoundingValues(){let e=this.$container;if(!e)return;let r=this.x,i=this.y,a=this.coords[2],o=this.coords[3];this.coords[2]=0,this.coords[3]=0,this.setX(0,!0),this.setY(0,!0),this.transforms.remove();let s=this.window[0]=t.innerWidth,c=this.window[1]=t.innerHeight,l=this.useWin,u=e.scrollWidth,d=e.scrollHeight,f=this.fixed,p=e.getBoundingClientRect(),[m,h,g,_]=this.containerPadding;this.dragArea[0]=l?0:p.left,this.dragArea[1]=l?0:p.top,this.scrollView[0]=l?q(u,s,u):u,this.scrollView[1]=l?q(d,c,d):d,this.updateScrollCoords();let{width:v,height:y,left:b,top:x,right:S,bottom:C}=e.getBoundingClientRect();this.dragArea[2]=J(l?q(v,s,s):v,0),this.dragArea[3]=J(l?q(y,c,c):y,0);let w=ln(e,`overflow`),T=w===`visible`,E=w===`hidden`;if(this.canScroll=!f&&this.contained&&(e===n.body&&T||!E&&!T)&&(u>this.dragArea[2]+_-h||d>this.dragArea[3]+m-g)&&(!this.containerArray||this.containerArray&&!z(this.containerArray)),this.contained){let t=this.scroll.x,n=this.scroll.y,r=this.canScroll,i=this.$target.getBoundingClientRect(),a=r?l?0:e.scrollLeft:0,o=r?l?0:e.scrollTop:0,u=r?this.scrollView[0]-a-v:0,d=r?this.scrollView[1]-o-y:0;this.targetBounds[0]=J(i.top+n-(l?0:x),0),this.targetBounds[1]=J(i.right+t-(l?s:S),0),this.targetBounds[2]=J(i.bottom+n-(l?c:C),0),this.targetBounds[3]=J(i.left+t-(l?0:b),0),this.containerArray?(this.containerBounds[0]=this.containerArray[0]+m,this.containerBounds[1]=this.containerArray[1]-h,this.containerBounds[2]=this.containerArray[2]-g,this.containerBounds[3]=this.containerArray[3]+_):(this.containerBounds[0]=-J(i.top-(f?q(x,0,c):x)+o-m,0),this.containerBounds[1]=-J(i.right-(f?q(S,0,s):S)-u+h,0),this.containerBounds[2]=-J(i.bottom-(f?q(C,0,c):C)-d+g,0),this.containerBounds[3]=-J(i.left-(f?q(b,0,s):b)+a-_,0))}this.transforms.revert(),this.coords[2]=a,this.coords[3]=o,this.setX(r,!0),this.setY(i,!0)}isOutOfBounds(e,t,n){if(!this.contained)return 0;let[r,i,a,o]=e,[s,c]=this.disabled,l=!s&&t<o||!s&&t>i,u=!c&&n<r||!c&&n>a;return l&&!u?1:!l&&u?2:l&&u?3:0}refresh(){let e=this.parameters,r=e.x,i=e.y,a=mn(e.container,this),o=mn(e.containerPadding,this)||0,s=z(o)?o:[o,o,o,o],c=this.x,l=this.y,u=mn(e.cursor,this),d={onHover:`grab`,onGrab:`grabbing`};if(u){let{onHover:e,onGrab:t}=u;e&&(d.onHover=e),t&&(d.onGrab=t)}let f=mn(e.dragThreshold,this),p={mouse:3,touch:7};if(B(f))p.mouse=f,p.touch=f;else if(f){let{mouse:e,touch:t}=f;V(e)||(p.mouse=e),V(t)||(p.touch=t)}this.containerArray=z(a)?a:null,this.$container=a&&!this.containerArray?wt(a)[0]:n.body,this.useWin=this.$container===n.body,this.$scrollContainer=this.useWin?t:this.$container,this.isFinePointer=matchMedia(`(pointer:fine)`).matches,this.containerPadding=Re(s,[0,0,0,0]),this.containerFriction=q(Re(mn(e.containerFriction,this),.8),0,1),this.releaseContainerFriction=q(Re(mn(e.releaseContainerFriction,this),this.containerFriction),0,1),this.snapX=mn(ee(r)&&!V(r.snap)?r.snap:e.snap,this),this.snapY=mn(ee(i)&&!V(i.snap)?i.snap:e.snap,this),this.scrollSpeed=Re(mn(e.scrollSpeed,this),1.5),this.scrollThreshold=Re(mn(e.scrollThreshold,this),20),this.dragSpeed=Re(mn(e.dragSpeed,this),1),this.dragThreshold=this.isFinePointer?p.mouse:p.touch,this.minVelocity=Re(mn(e.minVelocity,this),0),this.maxVelocity=Re(mn(e.maxVelocity,this),50),this.velocityMultiplier=Re(mn(e.velocityMultiplier,this),1),this.cursor=u!==!1&&d,this.updateBoundingValues();let[m,h,g,_]=this.containerBounds;this.setX(q(c,_,h),!0),this.setY(q(l,m,g),!0)}update(){if(this.updateScrollCoords(),this.canScroll){let[e,t,n,r]=this.containerPadding,[i,a]=this.scrollView,o=this.dragArea[2],s=this.dragArea[3],c=this.scroll.x,l=this.scroll.y,u=this.$container.scrollWidth,d=this.$container.scrollHeight,f=this.useWin?q(u,this.window[0],u):u,p=this.useWin?q(d,this.window[1],d):d,m=i-f,h=a-p;this.dragged&&m>0&&(this.coords[0]-=m,this.scrollView[0]=f),this.dragged&&h>0&&(this.coords[1]-=h,this.scrollView[1]=p);let g=this.scrollSpeed*10,_=this.scrollThreshold,[v,y]=this.coords,[b,x,S,C]=this.scrollBounds,w=J(q((y-b+e)/_,-1,0)*g,0),T=J(q((v-x-t)/_,0,1)*g,0),E=J(q((y-S-n)/_,0,1)*g,0),D=J(q((v-C+r)/_,-1,0)*g,0);if(w||E||D||T){let[e,t]=this.disabled,n=c,r=l;e||(n=J(q(c+(D||T),0,i-o),0),this.coords[0]-=c-n),t||(r=J(q(l+(w||E),0,a-s),0),this.coords[1]-=l-r),this.useWin?this.$scrollContainer.scrollBy(-(c-n),-(l-r)):this.$scrollContainer.scrollTo(n,r)}}let[e,t,n,r]=this.containerBounds,[i,a,o,s,c,l]=this.pointer;this.coords[0]+=(i-c)*this.dragSpeed,this.coords[1]+=(a-l)*this.dragSpeed,this.pointer[4]=i,this.pointer[5]=a;let[u,d]=this.coords,[f,p]=this.snapped,m=(1-this.containerFriction)*this.dragSpeed;this.setX(u>t?t+(u-t)*m:u<r?r+(u-r)*m:u,!1),this.setY(d>n?n+(d-n)*m:d<e?e+(d-e)*m:d,!1),this.computeVelocity(i-c,a-l),this.angle=G(a-s,i-o);let[h,g]=this.snapped;(h!==f&&this.snapX||g!==p&&this.snapY)&&this.onSnap(this)}stop(){this.updateTicker.pause(),this.overshootTicker.pause();for(let e in this.animate.animations)this.animate.animations[e].pause();return _t([this],null,`x`),_t([this],null,`y`),_t([this],null,`progressX`),_t([this],null,`progressY`),_t([this.scroll]),_t([this.overshootCoords]),this}scrollInView(e,t=0,n=Ft.inOutQuad){this.updateScrollCoords();let r=this.destX,i=this.destY,a=this.scroll,o=this.scrollBounds,s=this.canScroll;if(!this.containerArray&&this.isOutOfBounds(o,r,i)){let[c,l,u,d]=o,f=J(q(i-c,-p,0),0),m=J(q(r-l,0,p),0),h=J(q(i-u,0,p),0),g=J(q(r-d,-p,0),0);new $t(a,{x:J(a.x+(g?g-t:m?m+t:0),0),y:J(a.y+(f?f-t:h?h+t:0),0),duration:V(e)?350*P.timeScale:e,ease:n,onUpdate:()=>{this.canScroll=!1,this.$scrollContainer.scrollTo(a.x,a.y)}}).init().then(()=>{this.canScroll=s})}return this}handleHover(){this.isFinePointer&&this.cursor&&!this.cursorStyles&&(this.cursorStyles=un(this.$trigger,{cursor:this.cursor.onHover}))}animateInView(e,t=0,n=Ft.inOutQuad){this.stop(),this.updateBoundingValues();let r=this.x,i=this.y,[a,o,s,c]=this.containerPadding,l=this.scroll.y-this.targetBounds[0]+a+t,u=this.scroll.x-this.targetBounds[1]-o-t,d=this.scroll.y-this.targetBounds[2]-s-t,f=this.scroll.x-this.targetBounds[3]+c+t,p=this.isOutOfBounds([l,u,d,f],r,i);if(p){let[t,a]=this.disabled,o=q(be(r,this.snapX),f,u),s=q(be(i,this.snapY),l,d),c=V(e)?350*P.timeScale:e;!t&&(p===1||p===3)&&this.animate[this.xProp](o,c,n),!a&&(p===2||p===3)&&this.animate[this.yProp](s,c,n)}return this}handleDown(e){let t=e.target;if(this.grabbed||t.type===`range`)return;e.stopPropagation(),this.grabbed=!0,this.released=!1,this.stop(),this.updateBoundingValues();let r=e.changedTouches,i=r?r[0].clientX:e.clientX,a=r?r[0].clientY:e.clientY,{x:o,y:s}=this.transforms.normalizePoint(i,a),[c,l,u,d]=this.containerBounds,f=(1-this.containerFriction)*this.dragSpeed,p=this.x,m=this.y;this.coords[0]=this.coords[2]=f?p>l?l+(p-l)/f:p<d?d+(p-d)/f:p:p,this.coords[1]=this.coords[3]=f?m>u?u+(m-u)/f:m<c?c+(m-c)/f:m:m,this.pointer[0]=o,this.pointer[1]=s,this.pointer[2]=o,this.pointer[3]=s,this.pointer[4]=o,this.pointer[5]=s,this.pointer[6]=o,this.pointer[7]=s,this.deltaX=0,this.deltaY=0,this.velocity=0,this.velocityStack[0]=0,this.velocityStack[1]=0,this.velocityStack[2]=0,this.velocityStackIndex=0,this.angle=0,this.targetStyles&&=(this.targetStyles.revert(),null);let h=ln(this.$target,`zIndex`,!1);hn=(h>hn?h:hn)+1,this.targetStyles=un(this.$target,{zIndex:hn}),this.triggerStyles&&=(this.triggerStyles.revert(),null),this.cursorStyles&&=(this.cursorStyles.revert(),null),this.isFinePointer&&this.cursor&&(this.bodyStyles=un(n.body,{cursor:this.cursor.onGrab})),this.scrollInView(100,0,Ft.out(3)),this.onGrab(this),n.addEventListener(`touchmove`,this),n.addEventListener(`touchend`,this),n.addEventListener(`touchcancel`,this),n.addEventListener(`mousemove`,this),n.addEventListener(`mouseup`,this),n.addEventListener(`selectstart`,this)}handleMove(e){if(!this.grabbed)return;let t=e.changedTouches,n=t?t[0].clientX:e.clientX,r=t?t[0].clientY:e.clientY,{x:i,y:a}=this.transforms.normalizePoint(n,r),o=i-this.pointer[6],s=a-this.pointer[7],c=e.target,l=!1,u=!1,d=!1;for(;t&&c&&c!==this.$trigger;){let e=ln(c,`overflow-y`);if(e!==`hidden`&&e!==`visible`){let{scrollTop:e,scrollHeight:t,clientHeight:n}=c;if(t>n){d=!0,l=e<=3,u=e>=t-n-3;break}}c=c.parentElement}d&&(!l&&!u||l&&s<0||u&&s>0)?(this.pointer[0]=i,this.pointer[1]=a,this.pointer[2]=i,this.pointer[3]=a,this.pointer[4]=i,this.pointer[5]=a,this.pointer[6]=i,this.pointer[7]=a):(dn(e),this.triggerStyles||=un(this.$trigger,{pointerEvents:`none`}),this.$trigger.addEventListener(`touchstart`,dn,{passive:!1}),this.$trigger.addEventListener(`touchmove`,dn,{passive:!1}),this.$trigger.addEventListener(`touchend`,dn),(this.dragged||!this.disabled[0]&&he(o)>this.dragThreshold||!this.disabled[1]&&he(s)>this.dragThreshold)&&(this.updateTicker.resume(),this.pointer[2]=this.pointer[0],this.pointer[3]=this.pointer[1],this.pointer[0]=i,this.pointer[1]=a,this.dragged=!0,this.released=!1,this.onDrag(this)))}handleUp(){if(!this.grabbed)return;this.updateTicker.pause(),this.triggerStyles&&=(this.triggerStyles.revert(),null),this.bodyStyles&&=(this.bodyStyles.revert(),null);let[e,t]=this.disabled,[r,i,a,s,c,l]=this.pointer,[u,d,f,p]=this.containerBounds,[m,h]=this.snapped,g=this.releaseXSpring,_=this.releaseYSpring,v=this.releaseEase,y=this.hasReleaseSpring,b=this.overshootCoords,x=this.x,S=this.y,C=this.computeVelocity(r-c,i-l),w=this.angle=G(i-s,r-a),T=C*150,E=(1-this.releaseContainerFriction)*this.dragSpeed,D=x+U(w)*T,O=S+me(w)*T,k=D>d?d+(D-d)*E:D<p?p+(D-p)*E:D,A=O>f?f+(O-f)*E:O<u?u+(O-u)*E:O,j=this.destX=q(J(be(k,this.snapX),5),p,d),M=this.destY=q(J(be(A,this.snapY),5),u,f),N=this.isOutOfBounds(this.containerBounds,D,O),F=0,I=0,L=v,R=v,z=0;if(b.x=x,b.y=S,!e){let e=j===d?x>d?-1:1:x<p?-1:1,n=J(x-j,0);g.velocity=t&&y?n?T*e/he(n):0:C;let{ease:r,settlingDuration:i,restDuration:a}=g;F=x===j?0:y?i:i-a*P.timeScale,y&&(L=r),F>z&&(z=F)}if(!t){let t=M===f?S>f?-1:1:S<u?-1:1,n=J(S-M,0);_.velocity=e&&y?n?T*t/he(n):0:C;let{ease:r,settlingDuration:i,restDuration:a}=_;I=S===M?0:y?i:i-a*P.timeScale,y&&(R=r),I>z&&(z=I)}if(!y&&N&&E&&(F||I)){let e=o.blend;new $t(b,{x:{to:k,duration:F*.65},y:{to:A,duration:I*.65},ease:v,composition:e}).init(),new $t(b,{x:{to:j,duration:F},y:{to:M,duration:I},ease:v,composition:e}).init(),this.overshootTicker.stretch(ve(F,I)).restart()}else e||this.animate[this.xProp](j,F,L),t||this.animate[this.yProp](M,I,R);this.scrollInView(z,this.scrollThreshold,v);let ee=!1;j!==m&&(this.snapped[0]=j,this.snapX&&(ee=!0)),M!==h&&this.snapY&&(this.snapped[1]=M,this.snapY&&(ee=!0)),ee&&this.onSnap(this),this.grabbed=!1,this.dragged=!1,this.updated=!0,this.released=!0,this.onRelease(this),this.$trigger.removeEventListener(`touchstart`,dn),this.$trigger.removeEventListener(`touchmove`,dn),this.$trigger.removeEventListener(`touchend`,dn),n.removeEventListener(`touchmove`,this),n.removeEventListener(`touchend`,this),n.removeEventListener(`touchcancel`,this),n.removeEventListener(`mousemove`,this),n.removeEventListener(`mouseup`,this),n.removeEventListener(`selectstart`,this)}reset(){return this.stop(),this.resizeTicker.pause(),this.grabbed=!1,this.dragged=!1,this.updated=!1,this.released=!1,this.canScroll=!1,this.setX(0,!0),this.setY(0,!0),this.coords[0]=0,this.coords[1]=0,this.pointer[0]=0,this.pointer[1]=0,this.pointer[2]=0,this.pointer[3]=0,this.pointer[4]=0,this.pointer[5]=0,this.pointer[6]=0,this.pointer[7]=0,this.velocity=0,this.velocityStack[0]=0,this.velocityStack[1]=0,this.velocityStack[2]=0,this.velocityStackIndex=0,this.angle=0,this}enable(){return this.enabled||(this.enabled=!0,this.$target.classList.remove(`is-disabled`),this.touchActionStyles=un(this.$trigger,{touchAction:this.disabled[0]?`pan-x`:this.disabled[1]?`pan-y`:`none`}),this.$trigger.addEventListener(`touchstart`,this,{passive:!0}),this.$trigger.addEventListener(`mousedown`,this,{passive:!0}),this.$trigger.addEventListener(`mouseenter`,this)),this}disable(){return this.enabled=!1,this.grabbed=!1,this.dragged=!1,this.updated=!1,this.released=!1,this.canScroll=!1,this.touchActionStyles.revert(),this.cursorStyles&&=(this.cursorStyles.revert(),null),this.triggerStyles&&=(this.triggerStyles.revert(),null),this.bodyStyles&&=(this.bodyStyles.revert(),null),this.targetStyles&&=(this.targetStyles.revert(),null),this.$target.classList.add(`is-disabled`),this.$trigger.removeEventListener(`touchstart`,this),this.$trigger.removeEventListener(`mousedown`,this),this.$trigger.removeEventListener(`mouseenter`,this),n.removeEventListener(`touchmove`,this),n.removeEventListener(`touchend`,this),n.removeEventListener(`touchcancel`,this),n.removeEventListener(`mousemove`,this),n.removeEventListener(`mouseup`,this),n.removeEventListener(`selectstart`,this),this}revert(){return this.reset(),this.disable(),this.$target.classList.remove(`is-disabled`),this.updateTicker.revert(),this.overshootTicker.revert(),this.resizeTicker.revert(),this.animate.revert(),this.resizeObserver.disconnect(),this}handleEvent(e){switch(e.type){case`mousedown`:this.handleDown(e);break;case`touchstart`:this.handleDown(e);break;case`mousemove`:this.handleMove(e);break;case`touchmove`:this.handleMove(e);break;case`mouseup`:this.handleUp();break;case`touchend`:this.handleUp();break;case`touchcancel`:this.handleUp();break;case`mouseenter`:this.handleHover();break;case`selectstart`:dn(e)}}},_n=(e,t)=>new gn(e,t),vn=(e=0,t=1,n=0)=>{let r=10**n;return Math.floor((Math.random()*(t-e+1/r)+e)*r)/r},yn=0,bn=(e,t=0,n=1,r=0)=>{let i=e===void 0?yn++:e;return(e=t,a=n,o=r)=>{i+=1831565813,i=Math.imul(i^i>>>15,i|1),i^=i+Math.imul(i^i>>>7,i|61);let s=10**o;return Math.floor((((i^i>>>14)>>>0)/4294967296*(a-e+1/s)+e)*s)/s}},xn=(e,t=vn)=>{let n=e.length,r,i;for(;n;)i=t(0,--n),r=e[n],e[n]=e[i],e[i]=r;return e},Sn=(e,t={})=>{let n=[],r=0,i,a=null,o=t.from,s=t.reversed,c=t.ease,l=!V(c),u=l&&!V(c.ease)?c.ease:l?zt(c):null,d=t.grid,f=d===!0,p=t.axis,m=t.total,h=V(o)||o===0||o===`first`,g=o===`center`,_=o===`last`,v=o===`random`,y=z(o),b=z(e),x=t.use,S=de(b?e[0]:e),C=b?de(e[1]):0,w=O.exec((b?e[1]:e)+``),T=t.start||0+(b?S:0),E=t.seed,D=!V(E)&&E!==!1?bn(E===!0?0:E):vn,k=t.jitter,A=!V(k),j=z(k),M=j?k[0]:k||0,N=j?k[1]:k||0,P=h?0:B(o)?o:0;return(e,c,l,h,E)=>{let[O]=Tt(e),k=V(m)?l.length:m,j=V(x)?!1:ne(x)?x(O,c,k):Ue(O,x),F=B(j)||te(j)&&B(+j)?+j:c,I=F>=0&&F<k?F:c;if(g&&(P=(k-1)/2),_&&(P=k-1),!n.length){if(f){let e=!0,t=!1,r=1/0,i=1/0,a=1/0,s=-1/0,c=-1/0,u=-1/0,d=[],f=[],m=[];for(let n=0;n<k;n++){let o=l[n],p=0,h=0,g=0,_=!1;if(o&&ne(o.getBoundingClientRect)){let e=o.getBoundingClientRect();p=e.left+e.width/2,h=e.top+e.height/2,_=!0}else{let e=o;e&&B(e.x)&&B(e.y)&&(p=e.x,h=e.y,B(e.z)&&(g=e.z,t=!0),_=!0)}if(!_){e=!1;break}d.push(p),f.push(h),m.push(g),p<r&&(r=p),h<i&&(i=h),g<a&&(a=g),p>s&&(s=p),h>c&&(c=h),g>u&&(u=g)}if(e){let e=d[0],l=f[0],h=m[0];y?(e=r+o[0]*(s-r),l=i+o[1]*(c-i),h=t?a+(o.length>=3?o[2]:.5)*(u-a):0):g?(e=(r+s)/2,l=(i+c)/2,h=(a+u)/2):_?(e=d[k-1],l=f[k-1],h=m[k-1]):B(o)&&(e=d[o],l=f[o],h=m[o]);for(let r=0;r<k;r++){let i=e-d[r],a=l-f[r],o=h-m[r],s=pe(i*i+a*a+(t?o*o:0));p===`x`&&(s=-i),p===`y`&&(s=-a),p===`z`&&(s=-o),n.push(s)}let v=1/0;for(let e=0;e<k;e++){let t=he(n[e]);t>0&&t<v&&(v=t)}if(v>0&&v<1/0)for(let e=0;e<k;e++)n[e]=n[e]/v}else for(let e=0;e<k;e++)n.push(he(P-e))}else for(let e=0;e<k;e++)if(!d)n.push(he(P-e));else{let t=d.length,r=d[0]*d[1],i,a,s;y?(i=o[0]*(d[0]-1),a=o[1]*(d[1]-1),s=t===3?(o.length>=3?o[2]:.5)*(d[2]-1):0):g?(i=(d[0]-1)/2,a=(d[1]-1)/2,s=t===3?(d[2]-1)/2:0):(i=P%d[0],a=_e(P/d[0])%d[1],s=t===3?_e(P/r):0);let c=e%d[0],l=_e(e/d[0])%d[1],u=t===3?_e(e/r):0,f=i-c,m=a-l,h=s-u,_=pe(f*f+m*m+(t===3?h*h:0));p===`x`&&(_=-f),p===`y`&&(_=-m),p===`z`&&(_=-h),n.push(_)}r=n[0];for(let e=1;e<k;e++)n[e]>r&&(r=n[e]);if(u||s)for(let e=0;e<k;e++){let t=n[e];u&&(t=u(t/r)*r),s&&(t=p?-t:he(r-t)),n[e]=t}if(A){a=Array(k);for(let e=0;e<k;e++)a[e]=D(-1,1,4)}v&&(n=xn(n,D))}let L=b?(C-S)/r:S;V(i)&&(i=E?nn(E,V(t.start)?E.iterationDuration:T):T);let R=i+(L*J(n[I],2)||0);if(A){let e=r?n[I]/r:0,t=M+(N-M)*e;R+=a[I]*t}return t.modifier&&(R=t.modifier(R)),w&&(R=`${R}${w[2]}`),R}},Cn={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},wn={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},Tn=1e3,En=1001,Dn=1002,On=1003,kn=1004,An=1005,jn=1006,Mn=1007,Nn=1008,Pn=1009,Fn=1010,In=1011,Ln=1012,Rn=1013,zn=1014,Bn=1015,Vn=1016,Hn=1017,Un=1018,Wn=1020,Gn=35902,Kn=35899,qn=1021,Jn=1022,Yn=1023,Xn=1026,Zn=1027,Qn=1028,$n=1029,er=1030,tr=1031,nr=1033,rr=33776,ir=33777,ar=33778,or=33779,sr=35840,cr=35841,lr=35842,ur=35843,dr=36196,fr=37492,pr=37496,mr=37488,hr=37489,gr=37490,_r=37491,vr=37808,yr=37809,br=37810,xr=37811,Sr=37812,Cr=37813,wr=37814,Tr=37815,Er=37816,Dr=37817,Or=37818,kr=37819,Ar=37820,jr=37821,Mr=36492,Nr=36494,Pr=36495,Fr=36283,Ir=36284,Lr=36285,Rr=36286,zr=2300,Br=2301,Vr=2302,Hr=2303,Ur=2400,Wr=2401,Gr=2402,Kr=3200,qr=`srgb`,Jr=`srgb-linear`,Yr=`linear`,Xr=`srgb`,Zr=7680,Qr=35044,$r=35048,ei=2e3;function ti(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function ni(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function ri(e){return document.createElementNS(`http://www.w3.org/1999/xhtml`,e)}function ii(){let e=ri(`canvas`);return e.style.display=`block`,e}var ai={};function oi(...e){let t=`THREE.`+e.shift();console.log(t,...e)}function si(e){let t=e[0];if(typeof t==`string`&&t.startsWith(`TSL:`)){let t=e[1];t&&t.isStackTrace?e[0]+=` `+t.getLocation():e[1]=`Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.`}return e}function Y(...e){e=si(e);let t=`THREE.`+e.shift();{let n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function ci(...e){e=si(e);let t=`THREE.`+e.shift();{let n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function li(...e){let t=e.join(` `);t in ai||(ai[t]=!0,Y(...e))}function ui(e,t,n){return new Promise(function(r,i){function a(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:i();break;case e.TIMEOUT_EXPIRED:setTimeout(a,n);break;default:r()}}setTimeout(a,n)})}var di={0:1,2:6,4:7,3:5,1:0,6:2,7:4,5:3},fi=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n!==void 0&&n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let r=n[e];if(r!==void 0){let e=r.indexOf(t);e!==-1&&r.splice(e,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let t=n.slice(0);for(let n=0,r=t.length;n<r;n++)t[n].call(this,e);e.target=null}}},pi=`00.01.02.03.04.05.06.07.08.09.0a.0b.0c.0d.0e.0f.10.11.12.13.14.15.16.17.18.19.1a.1b.1c.1d.1e.1f.20.21.22.23.24.25.26.27.28.29.2a.2b.2c.2d.2e.2f.30.31.32.33.34.35.36.37.38.39.3a.3b.3c.3d.3e.3f.40.41.42.43.44.45.46.47.48.49.4a.4b.4c.4d.4e.4f.50.51.52.53.54.55.56.57.58.59.5a.5b.5c.5d.5e.5f.60.61.62.63.64.65.66.67.68.69.6a.6b.6c.6d.6e.6f.70.71.72.73.74.75.76.77.78.79.7a.7b.7c.7d.7e.7f.80.81.82.83.84.85.86.87.88.89.8a.8b.8c.8d.8e.8f.90.91.92.93.94.95.96.97.98.99.9a.9b.9c.9d.9e.9f.a0.a1.a2.a3.a4.a5.a6.a7.a8.a9.aa.ab.ac.ad.ae.af.b0.b1.b2.b3.b4.b5.b6.b7.b8.b9.ba.bb.bc.bd.be.bf.c0.c1.c2.c3.c4.c5.c6.c7.c8.c9.ca.cb.cc.cd.ce.cf.d0.d1.d2.d3.d4.d5.d6.d7.d8.d9.da.db.dc.dd.de.df.e0.e1.e2.e3.e4.e5.e6.e7.e8.e9.ea.eb.ec.ed.ee.ef.f0.f1.f2.f3.f4.f5.f6.f7.f8.f9.fa.fb.fc.fd.fe.ff`.split(`.`),mi=1234567,hi=Math.PI/180,gi=180/Math.PI;function _i(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,r=Math.random()*4294967295|0;return(pi[e&255]+pi[e>>8&255]+pi[e>>16&255]+pi[e>>24&255]+`-`+pi[t&255]+pi[t>>8&255]+`-`+pi[t>>16&15|64]+pi[t>>24&255]+`-`+pi[n&63|128]+pi[n>>8&255]+`-`+pi[n>>16&255]+pi[n>>24&255]+pi[r&255]+pi[r>>8&255]+pi[r>>16&255]+pi[r>>24&255]).toLowerCase()}function vi(e,t,n){return Math.max(t,Math.min(n,e))}function yi(e,t){return(e%t+t)%t}function bi(e,t,n,r,i){return r+(e-t)*(i-r)/(n-t)}function xi(e,t,n){return e===t?0:(n-e)/(t-e)}function Si(e,t,n){return(1-n)*e+n*t}function Ci(e,t,n,r){return Si(e,t,1-Math.exp(-n*r))}function wi(e,t=1){return t-Math.abs(yi(e,t*2)-t)}function Ti(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*(3-2*e))}function Ei(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*e*(e*(e*6-15)+10))}function Di(e,t){return e+Math.floor(Math.random()*(t-e+1))}function Oi(e,t){return e+Math.random()*(t-e)}function ki(e){return e*(.5-Math.random())}function Ai(e){e!==void 0&&(mi=e);let t=mi+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function ji(e){return e*hi}function Mi(e){return e*gi}function Ni(e){return e>0&&Number.isInteger(e)&&2**Math.round(Math.log2(e))===e}function Pi(e){return 2**Math.ceil(Math.log(e)/Math.LN2)}function Fi(e){return 2**Math.floor(Math.log(e)/Math.LN2)}function Ii(e,t,n,r,i){let a=Math.cos,o=Math.sin,s=a(n/2),c=o(n/2),l=a((t+r)/2),u=o((t+r)/2),d=a((t-r)/2),f=o((t-r)/2),p=a((r-t)/2),m=o((r-t)/2);switch(i){case`XYX`:e.set(s*u,c*d,c*f,s*l);break;case`YZY`:e.set(c*f,s*u,c*d,s*l);break;case`ZXZ`:e.set(c*d,c*f,s*u,s*l);break;case`XZX`:e.set(s*u,c*m,c*p,s*l);break;case`YXY`:e.set(c*p,s*u,c*m,s*l);break;case`ZYZ`:e.set(c*m,c*p,s*u,s*l);break;default:Y(`MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: `+i)}}function Li(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:case Uint8ClampedArray:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw Error(`THREE.MathUtils: Invalid component type.`)}}function Ri(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw Error(`THREE.MathUtils: Invalid component type.`)}}var zi={DEG2RAD:hi,RAD2DEG:gi,generateUUID:_i,clamp:vi,euclideanModulo:yi,mapLinear:bi,inverseLerp:xi,lerp:Si,damp:Ci,pingpong:wi,smoothstep:Ti,smootherstep:Ei,randInt:Di,randFloat:Oi,randFloatSpread:ki,seededRandom:Ai,degToRad:ji,radToDeg:Mi,isPowerOfTwo:Ni,ceilPowerOfTwo:Pi,floorPowerOfTwo:Fi,setQuaternionFromProperEuler:Ii,normalize:Ri,denormalize:Li},Bi=class e{static{e.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw Error(`THREE.Vector2: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw Error(`THREE.Vector2: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=vi(this.x,e.x,t.x),this.y=vi(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=vi(this.x,e,t),this.y=vi(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(vi(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(vi(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),i=this.x-e.x,a=this.y-e.y;return this.x=i*n-a*r+e.x,this.y=i*r+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Vi=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,i,a,o){let s=n[r+0],c=n[r+1],l=n[r+2],u=n[r+3],d=i[a+0],f=i[a+1],p=i[a+2],m=i[a+3];if(u!==m||s!==d||c!==f||l!==p){let e=s*d+c*f+l*p+u*m;e<0&&(d=-d,f=-f,p=-p,m=-m,e=-e);let t=1-o;if(e<.9995){let n=Math.acos(e),r=Math.sin(n);t=Math.sin(t*n)/r,o=Math.sin(o*n)/r,s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o}else{s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o;let e=1/Math.sqrt(s*s+c*c+l*l+u*u);s*=e,c*=e,l*=e,u*=e}}e[t]=s,e[t+1]=c,e[t+2]=l,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,r,i,a){let o=n[r],s=n[r+1],c=n[r+2],l=n[r+3],u=i[a],d=i[a+1],f=i[a+2],p=i[a+3];return e[t]=o*p+l*u+s*f-c*d,e[t+1]=s*p+l*d+c*u-o*f,e[t+2]=c*p+l*f+o*d-s*u,e[t+3]=l*p-o*u-s*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,i=e._z,a=e._order,o=Math.cos,s=Math.sin,c=o(n/2),l=o(r/2),u=o(i/2),d=s(n/2),f=s(r/2),p=s(i/2);switch(a){case`XYZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`YXZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`ZXY`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`ZYX`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`YZX`:this._x=d*l*u+c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u-d*f*p;break;case`XZY`:this._x=d*l*u-c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u+d*f*p;break;default:Y(`Quaternion: .setFromEuler() encountered an unknown order: `+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],i=t[8],a=t[1],o=t[5],s=t[9],c=t[2],l=t[6],u=t[10],d=n+o+u;if(d>0){let e=.5/Math.sqrt(d+1);this._w=.25/e,this._x=(l-s)*e,this._y=(i-c)*e,this._z=(a-r)*e}else if(n>o&&n>u){let e=2*Math.sqrt(1+n-o-u);this._w=(l-s)/e,this._x=.25*e,this._y=(r+a)/e,this._z=(i+c)/e}else if(o>u){let e=2*Math.sqrt(1+o-n-u);this._w=(i-c)/e,this._x=(r+a)/e,this._y=.25*e,this._z=(s+l)/e}else{let e=2*Math.sqrt(1+u-n-o);this._w=(a-r)/e,this._x=(i+c)/e,this._y=(s+l)/e,this._z=.25*e}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(vi(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x*=e,this._y*=e,this._z*=e,this._w*=e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=t._x,s=t._y,c=t._z,l=t._w;return this._x=n*l+a*o+r*c-i*s,this._y=r*l+a*s+i*o-n*c,this._z=i*l+a*c+n*s-r*o,this._w=a*l-n*o-r*s-i*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,r=-r,i=-i,a=-a,o=-o);let s=1-t;if(o<.9995){let e=Math.acos(o),c=Math.sin(e);s=Math.sin(s*e)/c,t=Math.sin(t*e)/c,this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this._onChangeCallback()}else this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),r=Math.sqrt(1-n),i=Math.sqrt(n);return this.set(r*Math.sin(e),r*Math.cos(e),i*Math.sin(t),i*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},X=class e{static{e.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw Error(`THREE.Vector3: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error(`THREE.Vector3: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Ui.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Ui.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6]*r,this.y=i[1]*t+i[4]*n+i[7]*r,this.z=i[2]*t+i[5]*n+i[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=e.elements,a=1/(i[3]*t+i[7]*n+i[11]*r+i[15]);return this.x=(i[0]*t+i[4]*n+i[8]*r+i[12])*a,this.y=(i[1]*t+i[5]*n+i[9]*r+i[13])*a,this.z=(i[2]*t+i[6]*n+i[10]*r+i[14])*a,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,i=e.x,a=e.y,o=e.z,s=e.w,c=2*(a*r-o*n),l=2*(o*t-i*r),u=2*(i*n-a*t);return this.x=t+s*c+a*u-o*l,this.y=n+s*l+o*c-i*u,this.z=r+s*u+i*l-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[4]*n+i[8]*r,this.y=i[1]*t+i[5]*n+i[9]*r,this.z=i[2]*t+i[6]*n+i[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=vi(this.x,e.x,t.x),this.y=vi(this.y,e.y,t.y),this.z=vi(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=vi(this.x,e,t),this.y=vi(this.y,e,t),this.z=vi(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(vi(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,i=e.z,a=t.x,o=t.y,s=t.z;return this.x=r*s-i*o,this.y=i*a-n*s,this.z=n*o-r*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Hi.copy(this).projectOnVector(e),this.sub(Hi)}reflect(e){return this.sub(Hi.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(vi(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Hi=new X,Ui=new Vi,Wi=class e{static{e.prototype.isMatrix3=!0}constructor(e,t,n,r,i,a,o,s,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c)}set(e,t,n,r,i,a,o,s,c){let l=this.elements;return l[0]=e,l[1]=r,l[2]=o,l[3]=t,l[4]=i,l[5]=s,l[6]=n,l[7]=a,l[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[3],s=n[6],c=n[1],l=n[4],u=n[7],d=n[2],f=n[5],p=n[8],m=r[0],h=r[3],g=r[6],_=r[1],v=r[4],y=r[7],b=r[2],x=r[5],S=r[8];return i[0]=a*m+o*_+s*b,i[3]=a*h+o*v+s*x,i[6]=a*g+o*y+s*S,i[1]=c*m+l*_+u*b,i[4]=c*h+l*v+u*x,i[7]=c*g+l*y+u*S,i[2]=d*m+f*_+p*b,i[5]=d*h+f*v+p*x,i[8]=d*g+f*y+p*S,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8];return t*a*l-t*o*c-n*i*l+n*o*s+r*i*c-r*a*s}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=l*a-o*c,d=o*s-l*i,f=c*i-a*s,p=t*u+n*d+r*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let m=1/p;return e[0]=u*m,e[1]=(r*c-l*n)*m,e[2]=(o*n-r*a)*m,e[3]=d*m,e[4]=(l*t-r*s)*m,e[5]=(r*i-o*t)*m,e[6]=f*m,e[7]=(n*s-c*t)*m,e[8]=(a*t-n*i)*m,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,i,a,o){let s=Math.cos(i),c=Math.sin(i);return this.set(n*s,n*c,-n*(s*a+c*o)+a+e,-r*c,r*s,-r*(-c*a+s*o)+o+t,0,0,1),this}scale(e,t){return li(`Matrix3: .scale() is deprecated. Use .makeScale() instead.`),this.premultiply(Gi.makeScale(e,t)),this}rotate(e){return li(`Matrix3: .rotate() is deprecated. Use .makeRotation() instead.`),this.premultiply(Gi.makeRotation(-e)),this}translate(e,t){return li(`Matrix3: .translate() is deprecated. Use .makeTranslation() instead.`),this.premultiply(Gi.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<9;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},Gi=new Wi,Ki=new Wi().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),qi=new Wi().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Ji(){let e={enabled:!0,workingColorSpace:Jr,spaces:{},convert:function(e,t,n){return this.enabled===!1||t===n||!t||!n||(this.spaces[t].transfer===`srgb`&&(e.r=Xi(e.r),e.g=Xi(e.g),e.b=Xi(e.b)),this.spaces[t].primaries!==this.spaces[n].primaries&&(e.applyMatrix3(this.spaces[t].toXYZ),e.applyMatrix3(this.spaces[n].fromXYZ)),this.spaces[n].transfer===`srgb`&&(e.r=Zi(e.r),e.g=Zi(e.g),e.b=Zi(e.b))),e},workingToColorSpace:function(e,t){return this.convert(e,this.workingColorSpace,t)},colorSpaceToWorking:function(e,t){return this.convert(e,t,this.workingColorSpace)},getPrimaries:function(e){return this.spaces[e].primaries},getTransfer:function(e){return e===``?Yr:this.spaces[e].transfer},getToneMappingMode:function(e){return this.spaces[e].outputColorSpaceConfig.toneMappingMode||`standard`},getLuminanceCoefficients:function(e,t=this.workingColorSpace){return e.fromArray(this.spaces[t].luminanceCoefficients)},define:function(e){Object.assign(this.spaces,e)},_getMatrix:function(e,t,n){return e.copy(this.spaces[t].toXYZ).multiply(this.spaces[n].fromXYZ)},_getDrawingBufferColorSpace:function(e){return this.spaces[e].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(e=this.workingColorSpace){return this.spaces[e].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(t,n){return li(`ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace().`),e.workingToColorSpace(t,n)},toWorkingColorSpace:function(t,n){return li(`ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking().`),e.colorSpaceToWorking(t,n)}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],r=[.3127,.329];return e.define({[Jr]:{primaries:t,whitePoint:r,transfer:Yr,toXYZ:Ki,fromXYZ:qi,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:qr},outputColorSpaceConfig:{drawingBufferColorSpace:qr}},[qr]:{primaries:t,whitePoint:r,transfer:Xr,toXYZ:Ki,fromXYZ:qi,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:qr}}}),e}var Yi=Ji();function Xi(e){return e<.04045?e*.0773993808:(e*.9478672986+.0521327014)**2.4}function Zi(e){return e<.0031308?e*12.92:1.055*e**.41666-.055}var Qi,$i=class{static getDataURL(e,t=`image/png`){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>`u`)return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{Qi===void 0&&(Qi=ri(`canvas`)),Qi.width=e.width,Qi.height=e.height;let t=Qi.getContext(`2d`);e instanceof ImageData?t.putImageData(e,0,0):t.drawImage(e,0,0,e.width,e.height),n=Qi}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap){let t=ri(`canvas`);t.width=e.width,t.height=e.height;let n=t.getContext(`2d`);n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),i=r.data;for(let e=0;e<i.length;e++)i[e]=Xi(i[e]/255)*255;return n.putImageData(r,0,0),t}if(e.data){let t=e.data.slice(0);for(let e=0;e<t.length;e++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[e]=Math.floor(Xi(t[e]/255)*255):t[e]=Xi(t[e]);return{data:t,width:e.width,height:e.height}}return Y(`ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied.`),e}},ea=0,ta=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:ea++}),this.uuid=_i(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<`u`&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<`u`&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t===null?e.set(0,0,0):e.set(t.width,t.height,t.depth||0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:``},r=this.data;if(r!==null){let e;if(Array.isArray(r)){e=[];for(let t=0,n=r.length;t<n;t++)r[t].isDataTexture?e.push(na(r[t].image)):e.push(na(r[t]))}else e=na(r);n.url=e}return t||(e.images[this.uuid]=n),n}};function na(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap?$i.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(Y(`Texture: Unable to serialize Texture.`),{})}var ra=0,ia=new X,aa=class e extends fi{constructor(t=e.DEFAULT_IMAGE,n=e.DEFAULT_MAPPING,r=En,i=En,a=jn,o=Nn,s=Yn,c=Pn,l=e.DEFAULT_ANISOTROPY,u=``){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:ra++}),this.uuid=_i(),this.name=``,this.source=new ta(t),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=r,this.wrapT=i,this.magFilter=a,this.minFilter=o,this.anisotropy=l,this.format=s,this.internalFormat=null,this.type=c,this.offset=new Bi(0,0),this.repeat=new Bi(1,1),this.center=new Bi(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Wi,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(ia).x}get height(){return this.source.getSize(ia).y}get depth(){return this.source.getSize(ia).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){Y(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];r===void 0?Y(`Texture.setValues(): property '${t}' does not exist.`):r&&n&&r.isVector2&&n.isVector2||r&&n&&r.isVector3&&n.isVector3||r&&n&&r.isMatrix3&&n.isMatrix3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:`Texture`,generator:`Texture.toJSON`},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:`dispose`})}transformUv(e){if(this.mapping!==300)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Tn:e.x-=Math.floor(e.x);break;case En:e.x=e.x<0?0:1;break;case Dn:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x-=Math.floor(e.x)}if(e.y<0||e.y>1)switch(this.wrapT){case Tn:e.y-=Math.floor(e.y);break;case En:e.y=e.y<0?0:1;break;case Dn:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y-=Math.floor(e.y)}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};aa.DEFAULT_IMAGE=null,aa.DEFAULT_MAPPING=300,aa.DEFAULT_ANISOTROPY=1;var oa=class e{static{e.prototype.isVector4=!0}constructor(e=0,t=0,n=0,r=1){this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw Error(`THREE.Vector4: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error(`THREE.Vector4: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w===void 0?1:e.w,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*r+a[12]*i,this.y=a[1]*t+a[5]*n+a[9]*r+a[13]*i,this.z=a[2]*t+a[6]*n+a[10]*r+a[14]*i,this.w=a[3]*t+a[7]*n+a[11]*r+a[15]*i,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,i,a=.01,o=.1,s=e.elements,c=s[0],l=s[4],u=s[8],d=s[1],f=s[5],p=s[9],m=s[2],h=s[6],g=s[10];if(Math.abs(l-d)<a&&Math.abs(u-m)<a&&Math.abs(p-h)<a){if(Math.abs(l+d)<o&&Math.abs(u+m)<o&&Math.abs(p+h)<o&&Math.abs(c+f+g-3)<o)return this.set(1,0,0,0),this;t=Math.PI;let e=(c+1)/2,s=(f+1)/2,_=(g+1)/2,v=(l+d)/4,y=(u+m)/4,b=(p+h)/4;return e>s&&e>_?e<a?(n=0,r=.707106781,i=.707106781):(n=Math.sqrt(e),r=v/n,i=y/n):s>_?s<a?(n=.707106781,r=0,i=.707106781):(r=Math.sqrt(s),n=v/r,i=b/r):_<a?(n=.707106781,r=.707106781,i=0):(i=Math.sqrt(_),n=y/i,r=b/i),this.set(n,r,i,t),this}let _=Math.sqrt((h-p)*(h-p)+(u-m)*(u-m)+(d-l)*(d-l));return Math.abs(_)<.001&&(_=1),this.x=(h-p)/_,this.y=(u-m)/_,this.z=(d-l)/_,this.w=Math.acos((c+f+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=vi(this.x,e.x,t.x),this.y=vi(this.y,e.y,t.y),this.z=vi(this.z,e.z,t.z),this.w=vi(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=vi(this.x,e,t),this.y=vi(this.y,e,t),this.z=vi(this.z,e,t),this.w=vi(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(vi(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},sa=class extends fi{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:jn,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new oa(0,0,e,t),this.scissorTest=!1,this.viewport=new oa(0,0,e,t),this.textures=[];let r=new aa({width:e,height:t,depth:n.depth}),i=n.count;for(let e=0;e<i;e++)this.textures[e]=r.clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:jn,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let e=0;e<this.textures.length;e++)this.textures[e].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let r=0,i=this.textures.length;r<i;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=n,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let n=Object.assign({},e.textures[t].image);this.textures[t].source=new ta(n)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null){if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture}return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:`dispose`})}},ca=class extends sa{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},la=class extends aa{constructor(e=null,t=1,n=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=On,this.minFilter=On,this.wrapR=En,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}},ua=class extends aa{constructor(e=null,t=1,n=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=On,this.minFilter=On,this.wrapR=En,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}},da=class e{static{e.prototype.isMatrix4=!0}constructor(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h)}set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){let g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=r,g[1]=i,g[5]=a,g[9]=o,g[13]=s,g[2]=c,g[6]=l,g[10]=u,g[14]=d,g[3]=f,g[7]=p,g[11]=m,g[15]=h,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new e().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,r=1/fa.setFromMatrixColumn(e,0).length(),i=1/fa.setFromMatrixColumn(e,1).length(),a=1/fa.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*i,t[5]=n[5]*i,t[6]=n[6]*i,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,i=e.z,a=Math.cos(n),o=Math.sin(n),s=Math.cos(r),c=Math.sin(r),l=Math.cos(i),u=Math.sin(i);if(e.order===`XYZ`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=-s*u,t[8]=c,t[1]=n+r*c,t[5]=e-i*c,t[9]=-o*s,t[2]=i-e*c,t[6]=r+n*c,t[10]=a*s}else if(e.order===`YXZ`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e+i*o,t[4]=r*o-n,t[8]=a*c,t[1]=a*u,t[5]=a*l,t[9]=-o,t[2]=n*o-r,t[6]=i+e*o,t[10]=a*s}else if(e.order===`ZXY`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e-i*o,t[4]=-a*u,t[8]=r+n*o,t[1]=n+r*o,t[5]=a*l,t[9]=i-e*o,t[2]=-a*c,t[6]=o,t[10]=a*s}else if(e.order===`ZYX`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=r*c-n,t[8]=e*c+i,t[1]=s*u,t[5]=i*c+e,t[9]=n*c-r,t[2]=-c,t[6]=o*s,t[10]=a*s}else if(e.order===`YZX`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=i-e*u,t[8]=r*u+n,t[1]=u,t[5]=a*l,t[9]=-o*l,t[2]=-c*l,t[6]=n*u+r,t[10]=e-i*u}else if(e.order===`XZY`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=-u,t[8]=c*l,t[1]=e*u+i,t[5]=a*l,t[9]=n*u-r,t[2]=r*u-n,t[6]=o*l,t[10]=i*u+e}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(ma,e,ha)}lookAt(e,t,n){let r=this.elements;return va.subVectors(e,t),va.lengthSq()===0&&(va.z=1),va.normalize(),ga.crossVectors(n,va),ga.lengthSq()===0&&(Math.abs(n.z)===1?va.x+=1e-4:va.z+=1e-4,va.normalize(),ga.crossVectors(n,va)),ga.normalize(),_a.crossVectors(va,ga),r[0]=ga.x,r[4]=_a.x,r[8]=va.x,r[1]=ga.y,r[5]=_a.y,r[9]=va.y,r[2]=ga.z,r[6]=_a.z,r[10]=va.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[4],s=n[8],c=n[12],l=n[1],u=n[5],d=n[9],f=n[13],p=n[2],m=n[6],h=n[10],g=n[14],_=n[3],v=n[7],y=n[11],b=n[15],x=r[0],S=r[4],C=r[8],w=r[12],T=r[1],E=r[5],D=r[9],O=r[13],k=r[2],A=r[6],j=r[10],M=r[14],N=r[3],P=r[7],F=r[11],I=r[15];return i[0]=a*x+o*T+s*k+c*N,i[4]=a*S+o*E+s*A+c*P,i[8]=a*C+o*D+s*j+c*F,i[12]=a*w+o*O+s*M+c*I,i[1]=l*x+u*T+d*k+f*N,i[5]=l*S+u*E+d*A+f*P,i[9]=l*C+u*D+d*j+f*F,i[13]=l*w+u*O+d*M+f*I,i[2]=p*x+m*T+h*k+g*N,i[6]=p*S+m*E+h*A+g*P,i[10]=p*C+m*D+h*j+g*F,i[14]=p*w+m*O+h*M+g*I,i[3]=_*x+v*T+y*k+b*N,i[7]=_*S+v*E+y*A+b*P,i[11]=_*C+v*D+y*j+b*F,i[15]=_*w+v*O+y*M+b*I,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[12],a=e[1],o=e[5],s=e[9],c=e[13],l=e[2],u=e[6],d=e[10],f=e[14],p=e[3],m=e[7],h=e[11],g=e[15],_=s*f-c*d,v=o*f-c*u,y=o*d-s*u,b=a*f-c*l,x=a*d-s*l,S=a*u-o*l;return t*(m*_-h*v+g*y)-n*(p*_-h*b+g*x)+r*(p*v-m*b+g*S)-i*(p*y-m*x+h*S)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[1],a=e[5],o=e[9],s=e[2],c=e[6],l=e[10];return t*(a*l-o*c)-n*(i*l-o*s)+r*(i*c-a*s)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=e[9],d=e[10],f=e[11],p=e[12],m=e[13],h=e[14],g=e[15],_=t*o-n*a,v=t*s-r*a,y=t*c-i*a,b=n*s-r*o,x=n*c-i*o,S=r*c-i*s,C=l*m-u*p,w=l*h-d*p,T=l*g-f*p,E=u*h-d*m,D=u*g-f*m,O=d*g-f*h,k=_*O-v*D+y*E+b*T-x*w+S*C;if(k===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let A=1/k;return e[0]=(o*O-s*D+c*E)*A,e[1]=(r*D-n*O-i*E)*A,e[2]=(m*S-h*x+g*b)*A,e[3]=(d*x-u*S-f*b)*A,e[4]=(s*T-a*O-c*w)*A,e[5]=(t*O-r*T+i*w)*A,e[6]=(h*y-p*S-g*v)*A,e[7]=(l*S-d*y+f*v)*A,e[8]=(a*D-o*T+c*C)*A,e[9]=(n*T-t*D-i*C)*A,e[10]=(p*x-m*y+g*_)*A,e[11]=(u*y-l*x-f*_)*A,e[12]=(o*w-a*E-s*C)*A,e[13]=(t*E-n*w+r*C)*A,e[14]=(m*v-p*b-h*_)*A,e[15]=(l*b-u*v+d*_)*A,this}scale(e){let t=this.elements,n=e.x,r=e.y,i=e.z;return t[0]*=n,t[4]*=r,t[8]*=i,t[1]*=n,t[5]*=r,t[9]*=i,t[2]*=n,t[6]*=r,t[10]*=i,t[3]*=n,t[7]*=r,t[11]*=i,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),i=1-n,a=e.x,o=e.y,s=e.z,c=i*a,l=i*o;return this.set(c*a+n,c*o-r*s,c*s+r*o,0,c*o+r*s,l*o+n,l*s-r*a,0,c*s-r*o,l*s+r*a,i*s*s+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,i,a){return this.set(1,n,i,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,i=t._x,a=t._y,o=t._z,s=t._w,c=i+i,l=a+a,u=o+o,d=i*c,f=i*l,p=i*u,m=a*l,h=a*u,g=o*u,_=s*c,v=s*l,y=s*u,b=n.x,x=n.y,S=n.z;return r[0]=(1-(m+g))*b,r[1]=(f+y)*b,r[2]=(p-v)*b,r[3]=0,r[4]=(f-y)*x,r[5]=(1-(d+g))*x,r[6]=(h+_)*x,r[7]=0,r[8]=(p+v)*S,r[9]=(h-_)*S,r[10]=(1-(d+m))*S,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let i=this.determinantAffine();if(i===0)return n.set(1,1,1),t.identity(),this;let a=fa.set(r[0],r[1],r[2]).length(),o=fa.set(r[4],r[5],r[6]).length(),s=fa.set(r[8],r[9],r[10]).length();i<0&&(a=-a),pa.copy(this);let c=1/a,l=1/o,u=1/s;return pa.elements[0]*=c,pa.elements[1]*=c,pa.elements[2]*=c,pa.elements[4]*=l,pa.elements[5]*=l,pa.elements[6]*=l,pa.elements[8]*=u,pa.elements[9]*=u,pa.elements[10]*=u,t.setFromRotationMatrix(pa),n.x=a,n.y=o,n.z=s,this}makePerspective(e,t,n,r,i,a,o=ei,s=!1){let c=this.elements,l=2*i/(t-e),u=2*i/(n-r),d=(t+e)/(t-e),f=(n+r)/(n-r),p,m;if(s)p=i/(a-i),m=a*i/(a-i);else if(o===2e3)p=-(a+i)/(a-i),m=-2*a*i/(a-i);else if(o===2001)p=-a/(a-i),m=-a*i/(a-i);else throw Error(`THREE.Matrix4.makePerspective(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,r,i,a,o=ei,s=!1){let c=this.elements,l=2/(t-e),u=2/(n-r),d=-(t+e)/(t-e),f=-(n+r)/(n-r),p,m;if(s)p=1/(a-i),m=a/(a-i);else if(o===2e3)p=-2/(a-i),m=-(a+i)/(a-i);else if(o===2001)p=-1/(a-i),m=-i/(a-i);else throw Error(`THREE.Matrix4.makeOrthographic(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=u,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<16;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},fa=new X,pa=new da,ma=new X(0,0,0),ha=new X(1,1,1),ga=new X,_a=new X,va=new X,ya=new da,ba=new Vi,xa=class e{constructor(t=0,n=0,r=0,i=e.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=r,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,i=r[0],a=r[4],o=r[8],s=r[1],c=r[5],l=r[9],u=r[2],d=r[6],f=r[10];switch(t){case`XYZ`:this._y=Math.asin(vi(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-l,f),this._z=Math.atan2(-a,i)):(this._x=Math.atan2(d,c),this._z=0);break;case`YXZ`:this._x=Math.asin(-vi(l,-1,1)),Math.abs(l)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(s,c)):(this._y=Math.atan2(-u,i),this._z=0);break;case`ZXY`:this._x=Math.asin(vi(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(s,i));break;case`ZYX`:this._y=Math.asin(-vi(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(s,i)):(this._x=0,this._z=Math.atan2(-a,c));break;case`YZX`:this._z=Math.asin(vi(s,-1,1)),Math.abs(s)<.9999999?(this._x=Math.atan2(-l,c),this._y=Math.atan2(-u,i)):(this._x=0,this._y=Math.atan2(o,f));break;case`XZY`:this._z=Math.asin(-vi(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,i)):(this._x=Math.atan2(-l,f),this._y=0);break;default:Y(`Euler: .setFromRotationMatrix() encountered an unknown order: `+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return ya.makeRotationFromQuaternion(e),this.setFromRotationMatrix(ya,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return ba.setFromEuler(this),this.setFromQuaternion(ba,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};xa.DEFAULT_ORDER=`XYZ`;var Sa=class{constructor(){this.mask=1}set(e){this.mask=1<<e>>>0}enable(e){this.mask|=1<<e}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e}disable(e){this.mask&=~(1<<e)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return!!(this.mask&1<<e)}},Ca=0,wa=new X,Ta=new Vi,Ea=new da,Da=new X,Oa=new X,ka=new X,Aa=new Vi,ja=new X(1,0,0),Ma=new X(0,1,0),Na=new X(0,0,1),Pa={type:`added`},Fa={type:`removed`},Ia={type:`childadded`,child:null},La={type:`childremoved`,child:null},Ra=class e extends fi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Ca++}),this.uuid=_i(),this.name=``,this.type=`Object3D`,this.parent=null,this.children=[],this.up=e.DEFAULT_UP.clone();let t=new X,n=new xa,r=new Vi,i=new X(1,1,1);function a(){r.setFromEuler(n,!1)}function o(){n.setFromQuaternion(r,void 0,!1)}n._onChange(a),r._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:r},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new da},normalMatrix:{value:new Wi}}),this.matrix=new da,this.matrixWorld=new da,this.matrixAutoUpdate=e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Sa,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Ta.setFromAxisAngle(e,t),this.quaternion.multiply(Ta),this}rotateOnWorldAxis(e,t){return Ta.setFromAxisAngle(e,t),this.quaternion.premultiply(Ta),this}rotateX(e){return this.rotateOnAxis(ja,e)}rotateY(e){return this.rotateOnAxis(Ma,e)}rotateZ(e){return this.rotateOnAxis(Na,e)}translateOnAxis(e,t){return wa.copy(e).applyQuaternion(this.quaternion),this.position.add(wa.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(ja,e)}translateY(e){return this.translateOnAxis(Ma,e)}translateZ(e){return this.translateOnAxis(Na,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Ea.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Da.copy(e):Da.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),Oa.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Ea.lookAt(Oa,Da,this.up):Ea.lookAt(Da,Oa,this.up),this.quaternion.setFromRotationMatrix(Ea),r&&(Ea.extractRotation(r.matrixWorld),Ta.setFromRotationMatrix(Ea),this.quaternion.premultiply(Ta.invert()))}add(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return e===this?(ci(`Object3D.add: object can't be added as a child of itself.`,e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Pa),Ia.child=e,this.dispatchEvent(Ia),Ia.child=null):ci(`Object3D.add: object not an instance of THREE.Object3D.`,e),this)}remove(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.remove(arguments[e]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Fa),La.child=e,this.dispatchEvent(La),La.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Ea.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Ea.multiply(e.parent.matrixWorld)),e.applyMatrix4(Ea),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Pa),Ia.child=e,this.dispatchEvent(Ia),Ia.child=null,this}getObjectById(e){return this.getObjectByProperty(`id`,e)}getObjectByName(e){return this.getObjectByProperty(`name`,e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let r=this.children[n].getObjectByProperty(e,t);if(r!==void 0)return r}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let i=0,a=r.length;i<a;i++)r[i].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Oa,e,ka),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Oa,Aa,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,r=e.z,i=this.matrix.elements;i[12]+=t-i[0]*t-i[4]*n-i[8]*r,i[13]+=n-i[1]*t-i[5]*n-i[9]*r,i[14]+=r-i[2]*t-i[6]*n-i[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let e=this.children;for(let t=0,r=e.length;t<r;t++)e[t].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e==`string`,n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:`Object`,generator:`Object3D.toJSON`});let r={};r.uuid=this.uuid,r.type=this.type,r.name=this.name,r.castShadow=this.castShadow,r.receiveShadow=this.receiveShadow,r.visible=this.visible,r.frustumCulled=this.frustumCulled,r.renderOrder=this.renderOrder,r.static=this.static,r.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type=`InstancedMesh`,r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type=`BatchedMesh`,r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(e=>({...e,boundingBox:e.boundingBox?e.boundingBox.toJSON():void 0,boundingSphere:e.boundingSphere?e.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(e=>({...e})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function i(t,n){return t[n.uuid]===void 0&&(t[n.uuid]=n.toJSON(e)),n.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=i(e.geometries,this.geometry);let t=this.geometry.parameters;if(t!==void 0&&t.shapes!==void 0){let n=t.shapes;if(Array.isArray(n))for(let t=0,r=n.length;t<r;t++){let r=n[t];i(e.shapes,r)}else i(e.shapes,n)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(i(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0){if(Array.isArray(this.material)){let t=[];for(let n=0,r=this.material.length;n<r;n++)t.push(i(e.materials,this.material[n]));r.material=t}else r.material=i(e.materials,this.material)}if(this.children.length>0){r.children=[];for(let t=0;t<this.children.length;t++)r.children.push(this.children[t].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let t=0;t<this.animations.length;t++){let n=this.animations[t];r.animations.push(i(e.animations,n))}}if(t){let t=a(e.geometries),r=a(e.materials),i=a(e.textures),o=a(e.images),s=a(e.shapes),c=a(e.skeletons),l=a(e.animations),u=a(e.nodes);t.length>0&&(n.geometries=t),r.length>0&&(n.materials=r),i.length>0&&(n.textures=i),o.length>0&&(n.images=o),s.length>0&&(n.shapes=s),c.length>0&&(n.skeletons=c),l.length>0&&(n.animations=l),u.length>0&&(n.nodes=u)}return n.object=r,n;function a(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot===null?null:e.pivot.clone(),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let t=0;t<e.children.length;t++){let n=e.children[t];this.add(n.clone())}return this}dispose(){this.dispatchEvent({type:`dispose`})}};Ra.DEFAULT_UP=new X(0,1,0),Ra.DEFAULT_MATRIX_AUTO_UPDATE=!0,Ra.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var za=class extends Ra{constructor(){super(),this.isGroup=!0,this.type=`Group`}},Ba={type:`move`},Va=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new za,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new za,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new X,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new X),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new za,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new X,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new X,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:`connected`,data:e}),this}disconnect(e){return this.dispatchEvent({type:`disconnected`,data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,i=null,a=null,o=this._targetRay,s=this._grip,c=this._hand;if(e&&t.session.visibilityState!==`visible-blurred`){if(c&&e.hand){a=!0;for(let r of e.hand.values()){let e=t.getJointPose(r,n),i=this._getHandJoint(c,r);e!==null&&(i.matrix.fromArray(e.transform.matrix),i.matrix.decompose(i.position,i.rotation,i.scale),i.matrixWorldNeedsUpdate=!0,i.jointRadius=e.radius),i.visible=e!==null}let r=c.joints[`index-finger-tip`],i=c.joints[`thumb-tip`],o=r.position.distanceTo(i.position);c.inputState.pinching&&o>.025?(c.inputState.pinching=!1,this.dispatchEvent({type:`pinchend`,handedness:e.handedness,target:this})):!c.inputState.pinching&&o<=.015&&(c.inputState.pinching=!0,this.dispatchEvent({type:`pinchstart`,handedness:e.handedness,target:this}))}else s!==null&&e.gripSpace&&(i=t.getPose(e.gripSpace,n),i!==null&&(s.matrix.fromArray(i.transform.matrix),s.matrix.decompose(s.position,s.rotation,s.scale),s.matrixWorldNeedsUpdate=!0,i.linearVelocity?(s.hasLinearVelocity=!0,s.linearVelocity.copy(i.linearVelocity)):s.hasLinearVelocity=!1,i.angularVelocity?(s.hasAngularVelocity=!0,s.angularVelocity.copy(i.angularVelocity)):s.hasAngularVelocity=!1,s.eventsEnabled&&s.dispatchEvent({type:`gripUpdated`,data:e,target:this})));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&i!==null&&(r=i),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Ba)))}return o!==null&&(o.visible=r!==null),s!==null&&(s.visible=i!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new za;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},Ha={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Ua={h:0,s:0,l:0},Wa={h:0,s:0,l:0};function Ga(e,t,n){return n<0&&(n+=1),n>1&&--n,n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var Ka=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let t=e;t&&t.isColor?this.copy(t):typeof t==`number`?this.setHex(t):typeof t==`string`&&this.setStyle(t)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=qr){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Yi.colorSpaceToWorking(this,t),this}setRGB(e,t,n,r=Yi.workingColorSpace){return this.r=e,this.g=t,this.b=n,Yi.colorSpaceToWorking(this,r),this}setHSL(e,t,n,r=Yi.workingColorSpace){if(e=yi(e,1),t=vi(t,0,1),n=vi(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,i=2*n-r;this.r=Ga(i,r,e+1/3),this.g=Ga(i,r,e),this.b=Ga(i,r,e-1/3)}return Yi.colorSpaceToWorking(this,r),this}setStyle(e,t=qr){function n(t){t!==void 0&&parseFloat(t)<1&&Y(`Color: Alpha component of `+e+` will be ignored.`)}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let i,a=r[1],o=r[2];switch(a){case`rgb`:case`rgba`:if(i=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(255,parseInt(i[1],10))/255,Math.min(255,parseInt(i[2],10))/255,Math.min(255,parseInt(i[3],10))/255,t);if(i=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(100,parseInt(i[1],10))/100,Math.min(100,parseInt(i[2],10))/100,Math.min(100,parseInt(i[3],10))/100,t);break;case`hsl`:case`hsla`:if(i=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setHSL(parseFloat(i[1])/360,parseFloat(i[2])/100,parseFloat(i[3])/100,t);break;default:Y(`Color: Unknown color model `+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let n=r[1],i=n.length;if(i===3)return this.setRGB(parseInt(n.charAt(0),16)/15,parseInt(n.charAt(1),16)/15,parseInt(n.charAt(2),16)/15,t);if(i===6)return this.setHex(parseInt(n,16),t);Y(`Color: Invalid hex color `+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=qr){let n=Ha[e.toLowerCase()];return n===void 0?Y(`Color: Unknown color `+e):this.setHex(n,t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Xi(e.r),this.g=Xi(e.g),this.b=Xi(e.b),this}copyLinearToSRGB(e){return this.r=Zi(e.r),this.g=Zi(e.g),this.b=Zi(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=qr){return Yi.workingToColorSpace(qa.copy(this),e),Math.round(vi(qa.r*255,0,255))*65536+Math.round(vi(qa.g*255,0,255))*256+Math.round(vi(qa.b*255,0,255))}getHexString(e=qr){return(`000000`+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Yi.workingColorSpace){Yi.workingToColorSpace(qa.copy(this),t);let n=qa.r,r=qa.g,i=qa.b,a=Math.max(n,r,i),o=Math.min(n,r,i),s,c,l=(o+a)/2;if(o===a)s=0,c=0;else{let e=a-o;switch(c=l<=.5?e/(a+o):e/(2-a-o),a){case n:s=(r-i)/e+(r<i?6:0);break;case r:s=(i-n)/e+2;break;case i:s=(n-r)/e+4}s/=6}return e.h=s,e.s=c,e.l=l,e}getRGB(e,t=Yi.workingColorSpace){return Yi.workingToColorSpace(qa.copy(this),t),e.r=qa.r,e.g=qa.g,e.b=qa.b,e}getStyle(e=qr){Yi.workingToColorSpace(qa.copy(this),e);let t=qa.r,n=qa.g,r=qa.b;return e===`srgb`?`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(r*255)})`:`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`}offsetHSL(e,t,n){return this.getHSL(Ua),this.setHSL(Ua.h+e,Ua.s+t,Ua.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Ua),e.getHSL(Wa);let n=Si(Ua.h,Wa.h,t),r=Si(Ua.s,Wa.s,t),i=Si(Ua.l,Wa.l,t);return this.setHSL(n,r,i),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,i=e.elements;return this.r=i[0]*t+i[3]*n+i[6]*r,this.g=i[1]*t+i[4]*n+i[7]*r,this.b=i[2]*t+i[5]*n+i[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},qa=new Ka;Ka.NAMES=Ha;var Ja=class extends Ra{constructor(){super(),this.isScene=!0,this.type=`Scene`,this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new xa,this.environmentIntensity=1,this.environmentRotation=new xa,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},Ya=new X,Xa=new X,Za=new X,Qa=new X,$a=new X,eo=new X,to=new X,no=new X,ro=new X,io=new X,ao=new oa,oo=new oa,so=new oa,co=class e{constructor(e=new X,t=new X,n=new X){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),Ya.subVectors(e,t),r.cross(Ya);let i=r.lengthSq();return i>0?r.multiplyScalar(1/Math.sqrt(i)):r.set(0,0,0)}static getBarycoord(e,t,n,r,i){Ya.subVectors(r,t),Xa.subVectors(n,t),Za.subVectors(e,t);let a=Ya.dot(Ya),o=Ya.dot(Xa),s=Ya.dot(Za),c=Xa.dot(Xa),l=Xa.dot(Za),u=a*c-o*o;if(u===0)return i.set(0,0,0),null;let d=1/u,f=(c*s-o*l)*d,p=(a*l-o*s)*d;return i.set(1-f-p,p,f)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,Qa)!==null&&Qa.x>=0&&Qa.y>=0&&Qa.x+Qa.y<=1}static getInterpolation(e,t,n,r,i,a,o,s){return this.getBarycoord(e,t,n,r,Qa)===null?(s.x=0,s.y=0,`z`in s&&(s.z=0),`w`in s&&(s.w=0),null):(s.setScalar(0),s.addScaledVector(i,Qa.x),s.addScaledVector(a,Qa.y),s.addScaledVector(o,Qa.z),s)}static getInterpolatedAttribute(e,t,n,r,i,a){return ao.setScalar(0),oo.setScalar(0),so.setScalar(0),ao.fromBufferAttribute(e,t),oo.fromBufferAttribute(e,n),so.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(ao,i.x),a.addScaledVector(oo,i.y),a.addScaledVector(so,i.z),a}static isFrontFacing(e,t,n,r){return Ya.subVectors(n,t),Xa.subVectors(e,t),Ya.cross(Xa).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Ya.subVectors(this.c,this.b),Xa.subVectors(this.a,this.b),Ya.cross(Xa).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return e.getNormal(this.a,this.b,this.c,t)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return e.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,r,i,a){return e.getInterpolation(t,this.a,this.b,this.c,n,r,i,a)}containsPoint(t){return e.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return e.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,i=this.c,a,o;$a.subVectors(r,n),eo.subVectors(i,n),no.subVectors(e,n);let s=$a.dot(no),c=eo.dot(no);if(s<=0&&c<=0)return t.copy(n);ro.subVectors(e,r);let l=$a.dot(ro),u=eo.dot(ro);if(l>=0&&u<=l)return t.copy(r);let d=s*u-l*c;if(d<=0&&s>=0&&l<=0)return a=s/(s-l),t.copy(n).addScaledVector($a,a);io.subVectors(e,i);let f=$a.dot(io),p=eo.dot(io);if(p>=0&&f<=p)return t.copy(i);let m=f*c-s*p;if(m<=0&&c>=0&&p<=0)return o=c/(c-p),t.copy(n).addScaledVector(eo,o);let h=l*p-f*u;if(h<=0&&u-l>=0&&f-p>=0)return to.subVectors(i,r),o=(u-l)/(u-l+(f-p)),t.copy(r).addScaledVector(to,o);let g=1/(h+m+d);return a=m*g,o=d*g,t.copy(n).addScaledVector($a,a).addScaledVector(eo,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},lo=class{constructor(e=new X(1/0,1/0,1/0),t=new X(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(fo.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(fo.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=fo.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute(`position`);if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let t=0,n=r.count;t<n;t++)e.isMesh===!0?e.getVertexPosition(t,fo):fo.fromBufferAttribute(r,t),fo.applyMatrix4(e.matrixWorld),this.expandByPoint(fo);else e.boundingBox===void 0?(n.boundingBox===null&&n.computeBoundingBox(),po.copy(n.boundingBox)):(e.boundingBox===null&&e.computeBoundingBox(),po.copy(e.boundingBox)),po.applyMatrix4(e.matrixWorld),this.union(po)}let r=e.children;for(let e=0,n=r.length;e<n;e++)this.expandByObject(r[e],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,fo),fo.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(bo),xo.subVectors(this.max,bo),mo.subVectors(e.a,bo),ho.subVectors(e.b,bo),go.subVectors(e.c,bo),_o.subVectors(ho,mo),vo.subVectors(go,ho),yo.subVectors(mo,go);let t=[0,-_o.z,_o.y,0,-vo.z,vo.y,0,-yo.z,yo.y,_o.z,0,-_o.x,vo.z,0,-vo.x,yo.z,0,-yo.x,-_o.y,_o.x,0,-vo.y,vo.x,0,-yo.y,yo.x,0];return!wo(t,mo,ho,go,xo)||(t=[1,0,0,0,1,0,0,0,1],!wo(t,mo,ho,go,xo))?!1:(So.crossVectors(_o,vo),t=[So.x,So.y,So.z],wo(t,mo,ho,go,xo))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,fo).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(fo).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()||(uo[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),uo[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),uo[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),uo[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),uo[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),uo[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),uo[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),uo[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(uo)),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},uo=[new X,new X,new X,new X,new X,new X,new X,new X],fo=new X,po=new lo,mo=new X,ho=new X,go=new X,_o=new X,vo=new X,yo=new X,bo=new X,xo=new X,So=new X,Co=new X;function wo(e,t,n,r,i){for(let a=0,o=e.length-3;a<=o;a+=3){Co.fromArray(e,a);let o=i.x*Math.abs(Co.x)+i.y*Math.abs(Co.y)+i.z*Math.abs(Co.z),s=t.dot(Co),c=n.dot(Co),l=r.dot(Co);if(Math.max(-Math.max(s,c,l),Math.min(s,c,l))>o)return!1}return!0}var To=new X,Eo=new Bi,Do=0,Oo=class extends fi{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw TypeError(`THREE.BufferAttribute: array should be a Typed Array.`);this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Do++}),this.name=``,this.array=e,this.itemSize=t,this.count=e===void 0?0:e.length/t,this.normalized=n,this.usage=Qr,this.updateRanges=[],this.gpuType=Bn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,i=this.itemSize;r<i;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Eo.fromBufferAttribute(this,t),Eo.applyMatrix3(e),this.setXY(t,Eo.x,Eo.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)To.fromBufferAttribute(this,t),To.applyMatrix3(e),this.setXYZ(t,To.x,To.y,To.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)To.fromBufferAttribute(this,t),To.applyMatrix4(e),this.setXYZ(t,To.x,To.y,To.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)To.fromBufferAttribute(this,t),To.applyNormalMatrix(e),this.setXYZ(t,To.x,To.y,To.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)To.fromBufferAttribute(this,t),To.transformDirection(e),this.setXYZ(t,To.x,To.y,To.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Li(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Ri(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Li(t,this.array)),t}setX(e,t){return this.normalized&&(t=Ri(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Li(t,this.array)),t}setY(e,t){return this.normalized&&(t=Ri(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Li(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Ri(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Li(t,this.array)),t}setW(e,t){return this.normalized&&(t=Ri(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Ri(t,this.array),n=Ri(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=Ri(t,this.array),n=Ri(n,this.array),r=Ri(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,i){return e*=this.itemSize,this.normalized&&(t=Ri(t,this.array),n=Ri(n,this.array),r=Ri(r,this.array),i=Ri(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=i,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:`dispose`})}},ko=class extends Oo{constructor(e,t,n){super(new Uint16Array(e),t,n)}},Ao=class extends Oo{constructor(e,t,n){super(new Uint32Array(e),t,n)}},jo=class extends Oo{constructor(e,t,n){super(new Float32Array(e),t,n)}},Mo=new lo,No=new X,Po=new X,Fo=class{constructor(e=new X,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t===void 0?Mo.setFromPoints(e).getCenter(n):n.copy(t);let r=0;for(let t=0,i=e.length;t<i;t++)r=Math.max(r,n.distanceToSquared(e[t]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius*=e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;No.subVectors(e,this.center);let t=No.lengthSq();if(t>this.radius*this.radius){let e=Math.sqrt(t),n=(e-this.radius)*.5;this.center.addScaledVector(No,n/e),this.radius+=n}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Po.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(No.copy(e.center).add(Po)),this.expandByPoint(No.copy(e.center).sub(Po))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},Io=0,Lo=new da,Ro=new Ra,zo=new X,Bo=new lo,Vo=new lo,Ho=new X,Uo=class e extends fi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Io++}),this.uuid=_i(),this.name=``,this.type=`BufferGeometry`,this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return this.index=Array.isArray(e)?new(ti(e)?Ao:ko)(e,1):e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let t=new Wi().getNormalMatrix(e);n.applyNormalMatrix(t),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return Lo.makeRotationFromQuaternion(e),this.applyMatrix4(Lo),this}rotateX(e){return Lo.makeRotationX(e),this.applyMatrix4(Lo),this}rotateY(e){return Lo.makeRotationY(e),this.applyMatrix4(Lo),this}rotateZ(e){return Lo.makeRotationZ(e),this.applyMatrix4(Lo),this}translate(e,t,n){return Lo.makeTranslation(e,t,n),this.applyMatrix4(Lo),this}scale(e,t,n){return Lo.makeScale(e,t,n),this.applyMatrix4(Lo),this}lookAt(e){return Ro.lookAt(e),Ro.updateMatrix(),this.applyMatrix4(Ro.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(zo).negate(),this.translate(zo.x,zo.y,zo.z),this}setFromPoints(e){let t=this.getAttribute(`position`);if(t===void 0){let t=[];for(let n=0,r=e.length;n<r;n++){let r=e[n];t.push(r.x,r.y,r.z||0)}this.setAttribute(`position`,new jo(t,3))}else{let n=Math.min(e.length,t.count);for(let r=0;r<n;r++){let n=e[r];t.setXYZ(r,n.x,n.y,n.z||0)}e.length>t.count&&Y(`BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.`),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new lo);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute)ci(`BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.`,this),this.boundingBox.set(new X(-1/0,-1/0,-1/0),new X(1/0,1/0,1/0));else{if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];Bo.setFromBufferAttribute(n),this.morphTargetsRelative?(Ho.addVectors(this.boundingBox.min,Bo.min),this.boundingBox.expandByPoint(Ho),Ho.addVectors(this.boundingBox.max,Bo.max),this.boundingBox.expandByPoint(Ho)):(this.boundingBox.expandByPoint(Bo.min),this.boundingBox.expandByPoint(Bo.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&ci(`BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.`,this)}}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Fo);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute)ci(`BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.`,this),this.boundingSphere.set(new X,1/0);else if(e){let n=this.boundingSphere.center;if(Bo.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];Vo.setFromBufferAttribute(n),this.morphTargetsRelative?(Ho.addVectors(Bo.min,Vo.min),Bo.expandByPoint(Ho),Ho.addVectors(Bo.max,Vo.max),Bo.expandByPoint(Ho)):(Bo.expandByPoint(Vo.min),Bo.expandByPoint(Vo.max))}Bo.getCenter(n);let r=0;for(let t=0,i=e.count;t<i;t++)Ho.fromBufferAttribute(e,t),r=Math.max(r,n.distanceToSquared(Ho));if(t)for(let i=0,a=t.length;i<a;i++){let a=t[i],o=this.morphTargetsRelative;for(let t=0,i=a.count;t<i;t++)Ho.fromBufferAttribute(a,t),o&&(zo.fromBufferAttribute(e,t),Ho.add(zo)),r=Math.max(r,n.distanceToSquared(Ho))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&ci(`BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.`,this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){ci(`BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)`);return}let n=t.position,r=t.normal,i=t.uv,a=this.getAttribute(`tangent`);(a===void 0||a.count!==n.count)&&(a=new Oo(new Float32Array(4*n.count),4),this.setAttribute(`tangent`,a));let o=[],s=[];for(let e=0;e<n.count;e++)o[e]=new X,s[e]=new X;let c=new X,l=new X,u=new X,d=new Bi,f=new Bi,p=new Bi,m=new X,h=new X;function g(e,t,r){c.fromBufferAttribute(n,e),l.fromBufferAttribute(n,t),u.fromBufferAttribute(n,r),d.fromBufferAttribute(i,e),f.fromBufferAttribute(i,t),p.fromBufferAttribute(i,r),l.sub(c),u.sub(c),f.sub(d),p.sub(d);let a=1/(f.x*p.y-p.x*f.y);isFinite(a)&&(m.copy(l).multiplyScalar(p.y).addScaledVector(u,-f.y).multiplyScalar(a),h.copy(u).multiplyScalar(f.x).addScaledVector(l,-p.x).multiplyScalar(a),o[e].add(m),o[t].add(m),o[r].add(m),s[e].add(h),s[t].add(h),s[r].add(h))}let _=this.groups;_.length===0&&(_=[{start:0,count:e.count}]);for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)g(e.getX(t+0),e.getX(t+1),e.getX(t+2))}let v=new X,y=new X,b=new X,x=new X;function S(e){b.fromBufferAttribute(r,e),x.copy(b);let t=o[e];v.copy(t),v.sub(b.multiplyScalar(b.dot(t))).normalize(),y.crossVectors(x,t);let n=y.dot(s[e])<0?-1:1;a.setXYZW(e,v.x,v.y,v.z,n)}for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)S(e.getX(t+0)),S(e.getX(t+1)),S(e.getX(t+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute(`position`);if(t!==void 0){let n=this.getAttribute(`normal`);if(n===void 0||n.count!==t.count)n=new Oo(new Float32Array(t.count*3),3),this.setAttribute(`normal`,n);else for(let e=0,t=n.count;e<t;e++)n.setXYZ(e,0,0,0);let r=new X,i=new X,a=new X,o=new X,s=new X,c=new X,l=new X,u=new X;if(e)for(let d=0,f=e.count;d<f;d+=3){let f=e.getX(d+0),p=e.getX(d+1),m=e.getX(d+2);r.fromBufferAttribute(t,f),i.fromBufferAttribute(t,p),a.fromBufferAttribute(t,m),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),o.fromBufferAttribute(n,f),s.fromBufferAttribute(n,p),c.fromBufferAttribute(n,m),o.add(l),s.add(l),c.add(l),n.setXYZ(f,o.x,o.y,o.z),n.setXYZ(p,s.x,s.y,s.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let e=0,o=t.count;e<o;e+=3)r.fromBufferAttribute(t,e+0),i.fromBufferAttribute(t,e+1),a.fromBufferAttribute(t,e+2),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),n.setXYZ(e+0,l.x,l.y,l.z),n.setXYZ(e+1,l.x,l.y,l.z),n.setXYZ(e+2,l.x,l.y,l.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Ho.fromBufferAttribute(e,t),Ho.normalize(),e.setXYZ(t,Ho.x,Ho.y,Ho.z)}toNonIndexed(){function t(e,t){let n=e.array,r=e.itemSize,i=e.normalized,a=new n.constructor(t.length*r),o=0,s=0;for(let i=0,c=t.length;i<c;i++){o=e.isInterleavedBufferAttribute?t[i]*e.data.stride+e.offset:t[i]*r;for(let e=0;e<r;e++)a[s++]=n[o++]}return new Oo(a,r,i)}if(this.index===null)return Y(`BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.`),this;let n=new e,r=this.index.array,i=this.attributes;for(let e in i){let a=i[e],o=t(a,r);n.setAttribute(e,o)}let a=this.morphAttributes;for(let e in a){let i=[],o=a[e];for(let e=0,n=o.length;e<n;e++){let n=o[e],a=t(n,r);i.push(a)}n.morphAttributes[e]=i}n.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let e=0,t=o.length;e<t;e++){let t=o[e];n.addGroup(t.start,t.count,t.materialIndex)}return n}toJSON(){let e={metadata:{version:4.7,type:`BufferGeometry`,generator:`BufferGeometry.toJSON`}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?`BufferGeometry`:this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let t=this.parameters;for(let n in t)t[n]!==void 0&&(e[n]=t[n]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let t in n){let r=n[t];e.data.attributes[t]=r.toJSON(e.data)}let r={},i=!1;for(let t in this.morphAttributes){let n=this.morphAttributes[t],a=[];for(let t=0,r=n.length;t<r;t++){let r=n[t];a.push(r.toJSON(e.data))}a.length>0&&(r[t]=a,i=!0)}i&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let r=e.attributes;for(let e in r){let n=r[e];this.setAttribute(e,n.clone(t))}let i=e.morphAttributes;for(let e in i){let n=[],r=i[e];for(let e=0,i=r.length;e<i;e++)n.push(r[e].clone(t));this.morphAttributes[e]=n}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let e=0,t=a.length;e<t;e++){let t=a[e];this.addGroup(t.start,t.count,t.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let s=e.boundingSphere;return s!==null&&(this.boundingSphere=s.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:`dispose`})}},Wo=new X,Go=new X,Ko=new Wi,qo=class{constructor(e=new X(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=Wo.subVectors(n,t).cross(Go.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let r=e.delta(Wo),i=this.normal.dot(r);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/i;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(r,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Ko.getNormalMatrix(e),r=this.coplanarPoint(Wo).applyMatrix4(e),i=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(i),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},Jo=0,Yo=class extends fi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Jo++}),this.uuid=_i(),this.name=``,this.type=`Material`,this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ka(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Zr,this.stencilZFail=Zr,this.stencilZPass=Zr,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){Y(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];r===void 0?Y(`Material: '${t}' is not a property of THREE.${this.type}.`):r&&r.isColor?r.set(n):r&&r.isVector2&&n&&n.isVector2||r&&r.isEuler&&n&&n.isEuler||r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:`Material`,generator:`Material.toJSON`}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(e=>e.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function r(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}if(t){let t=r(e.textures),i=r(e.images);t.length>0&&(n.textures=t),i.length>0&&(n.images=i)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Ka().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(e=>new qo().fromJSON(e))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(this.vertexColors=typeof e.vertexColors==`number`?e.vertexColors>0:e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let t=e.normalScale;Array.isArray(t)===!1&&(t=[t,t]),this.normalScale=new Bi().fromArray(t)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Bi().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let e=t.length;n=Array(e);for(let r=0;r!==e;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:`dispose`})}set needsUpdate(e){e===!0&&this.version++}},Xo=new X,Zo=new X,Qo=new X,$o=new X,es=class{constructor(e=new X,t=new X(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Xo)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Xo.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Xo.copy(this.origin).addScaledVector(this.direction,t),Xo.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){Zo.copy(e).add(t).multiplyScalar(.5),Qo.copy(t).sub(e).normalize(),$o.copy(this.origin).sub(Zo);let i=e.distanceTo(t)*.5,a=-this.direction.dot(Qo),o=$o.dot(this.direction),s=-$o.dot(Qo),c=$o.lengthSq(),l=Math.abs(1-a*a),u,d,f,p;if(l>0){if(u=a*s-o,d=a*o-s,p=i*l,u>=0){if(d>=-p){if(d<=p){let e=1/l;u*=e,d*=e,f=u*(u+a*d+2*o)+d*(a*u+d+2*s)+c}else d=i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c}else d=-i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c}else d<=-p?(u=Math.max(0,-(-a*i+o)),d=u>0?-i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c):d<=p?(u=0,d=Math.min(Math.max(-i,-s),i),f=d*(d+2*s)+c):(u=Math.max(0,-(a*i+o)),d=u>0?i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c)}else d=a>0?-i:i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),r&&r.copy(Zo).addScaledVector(Qo,d),f}intersectSphere(e,t){if(e.radius<0)return null;Xo.subVectors(e.center,this.origin);let n=Xo.dot(this.direction),r=Xo.dot(Xo)-n*n,i=e.radius*e.radius;if(r>i)return null;let a=Math.sqrt(i-r),o=n-a,s=n+a;return s<0?null:o<0?this.at(s,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,i,a,o,s,c=1/this.direction.x,l=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,r=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,r=(e.min.x-d.x)*c),l>=0?(i=(e.min.y-d.y)*l,a=(e.max.y-d.y)*l):(i=(e.max.y-d.y)*l,a=(e.min.y-d.y)*l),n>a||i>r||((i>n||isNaN(n))&&(n=i),(a<r||isNaN(r))&&(r=a),u>=0?(o=(e.min.z-d.z)*u,s=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,s=(e.min.z-d.z)*u),n>s||o>r)||((o>n||n!==n)&&(n=o),(s<r||r!==r)&&(r=s),r<0)?null:this.at(n>=0?n:r,t)}intersectsBox(e){return this.intersectBox(e,Xo)!==null}intersectTriangle(e,t,n,r,i){let a=this.origin,o=this.direction,s=o.x,c=o.y,l=o.z,u=e.x-a.x,d=e.y-a.y,f=e.z-a.z,p=t.x-a.x,m=t.y-a.y,h=t.z-a.z,g=n.x-a.x,_=n.y-a.y,v=n.z-a.z,y=Math.abs(s),b=Math.abs(c),x=Math.abs(l),S,C,w,T,E,D,O,k,A,j,M,N;if(y>=b&&y>=x?(w=s,D=u,A=p,N=g,s>=0?(S=c,C=l,T=d,E=f,O=m,k=h,j=_,M=v):(S=l,C=c,T=f,E=d,O=h,k=m,j=v,M=_)):b>=x?(w=c,D=d,A=m,N=_,c>=0?(S=l,C=s,T=f,E=u,O=h,k=p,j=v,M=g):(S=s,C=l,T=u,E=f,O=p,k=h,j=g,M=v)):(w=l,D=f,A=h,N=v,l>=0?(S=s,C=c,T=u,E=d,O=p,k=m,j=g,M=_):(S=c,C=s,T=d,E=u,O=m,k=p,j=_,M=g)),w===0)return null;let P=S/w,F=C/w,I=1/w,L=T-P*D,R=E-F*D,z=O-P*A,ee=k-F*A,B=j-P*N,te=M-F*N,ne=B*ee-te*z,V=L*te-R*B,H=z*R-ee*L;if(r){if(ne<0||V<0||H<0)return null}else if((ne<0||V<0||H<0)&&(ne>0||V>0||H>0))return null;let re=ne+V+H;if(re===0)return null;let ie=I*(ne*D+V*A+H*N);return(re>0?ie<0:ie>0)?null:this.at(ie/re,i)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},ts=class extends Yo{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type=`MeshBasicMaterial`,this.color=new Ka(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new xa,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},ns=new da,rs=new es,is=new Fo,as=new X,os=new X,ss=new X,cs=new X,ls=new X,us=new X,ds=new X,fs=new X,ps=class extends Ra{constructor(e=new Uo,t=new ts){super(),this.isMesh=!0,this.type=`Mesh`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,i=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(i&&o){us.set(0,0,0);for(let n=0,r=i.length;n<r;n++){let r=o[n],s=i[n];r!==0&&(ls.fromBufferAttribute(s,e),a?us.addScaledVector(ls,r):us.addScaledVector(ls.sub(t),r))}t.add(us)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.material,i=this.matrixWorld;r!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),is.copy(n.boundingSphere),is.applyMatrix4(i),rs.copy(e.ray).recast(e.near),!(is.containsPoint(rs.origin)===!1&&(rs.intersectSphere(is,as)===null||rs.origin.distanceToSquared(as)>(e.far-e.near)**2))&&(ns.copy(i).invert(),rs.copy(e.ray).applyMatrix4(ns),(n.boundingBox===null||rs.intersectsBox(n.boundingBox)!==!1)&&this._computeIntersections(e,t,rs)))}_computeIntersections(e,t,n){let r,i=this.geometry,a=this.material,o=i.index,s=i.attributes.position,c=i.attributes.uv,l=i.attributes.uv1,u=i.attributes.normal,d=i.groups,f=i.drawRange;if(o!==null){if(Array.isArray(a))for(let i=0,s=d.length;i<s;i++){let s=d[i],p=a[s.materialIndex],m=Math.max(s.start,f.start),h=Math.min(o.count,Math.min(s.start+s.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=o.getX(i),d=o.getX(i+1),f=o.getX(i+2);r=hs(this,p,e,n,c,l,u,a,d,f),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=s.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),s=Math.min(o.count,f.start+f.count);for(let d=i,f=s;d<f;d+=3){let i=o.getX(d),s=o.getX(d+1),f=o.getX(d+2);r=hs(this,a,e,n,c,l,u,i,s,f),r&&(r.faceIndex=Math.floor(d/3),t.push(r))}}}else if(s!==void 0){if(Array.isArray(a))for(let i=0,o=d.length;i<o;i++){let o=d[i],p=a[o.materialIndex],m=Math.max(o.start,f.start),h=Math.min(s.count,Math.min(o.start+o.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=i,s=i+1,d=i+2;r=hs(this,p,e,n,c,l,u,a,s,d),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=o.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),o=Math.min(s.count,f.start+f.count);for(let s=i,d=o;s<d;s+=3){let i=s,o=s+1,d=s+2;r=hs(this,a,e,n,c,l,u,i,o,d),r&&(r.faceIndex=Math.floor(s/3),t.push(r))}}}}};function ms(e,t,n,r,i,a,o,s){let c;if(c=t.side===1?r.intersectTriangle(o,a,i,!0,s):r.intersectTriangle(i,a,o,t.side===0,s),c===null)return null;fs.copy(s),fs.applyMatrix4(e.matrixWorld);let l=n.ray.origin.distanceTo(fs);return l<n.near||l>n.far?null:{distance:l,point:fs.clone(),object:e}}function hs(e,t,n,r,i,a,o,s,c,l){e.getVertexPosition(s,os),e.getVertexPosition(c,ss),e.getVertexPosition(l,cs);let u=ms(e,t,n,r,os,ss,cs,ds);if(u){let e=new X;co.getBarycoord(ds,os,ss,cs,e),i&&(u.uv=co.getInterpolatedAttribute(i,s,c,l,e,new Bi)),a&&(u.uv1=co.getInterpolatedAttribute(a,s,c,l,e,new Bi)),o&&(u.normal=co.getInterpolatedAttribute(o,s,c,l,e,new X),u.normal.dot(r.direction)>0&&u.normal.multiplyScalar(-1));let t={a:s,b:c,c:l,normal:new X,materialIndex:0};co.getNormal(os,ss,cs,t.normal),u.face=t,u.barycoord=e}return u}var gs=class extends aa{constructor(e=null,t=1,n=1,r,i,a,o,s,c=On,l=On,u,d){super(null,a,o,s,c,l,r,i,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},_s=class extends Oo{constructor(e,t,n,r=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},vs=new Fo,ys=new Bi(.5,.5),bs=new X,xs=class{constructor(e=new qo,t=new qo,n=new qo,r=new qo,i=new qo,a=new qo){this.planes=[e,t,n,r,i,a]}set(e,t,n,r,i,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(i),o[5].copy(a),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=ei,n=!1){let r=this.planes,i=e.elements,a=i[0],o=i[1],s=i[2],c=i[3],l=i[4],u=i[5],d=i[6],f=i[7],p=i[8],m=i[9],h=i[10],g=i[11],_=i[12],v=i[13],y=i[14],b=i[15];if(r[0].setComponents(c-a,f-l,g-p,b-_).normalize(),r[1].setComponents(c+a,f+l,g+p,b+_).normalize(),r[2].setComponents(c+o,f+u,g+m,b+v).normalize(),r[3].setComponents(c-o,f-u,g-m,b-v).normalize(),n)r[4].setComponents(s,d,h,y).normalize(),r[5].setComponents(c-s,f-d,g-h,b-y).normalize();else if(r[4].setComponents(c-s,f-d,g-h,b-y).normalize(),t===2e3)r[5].setComponents(c+s,f+d,g+h,b+y).normalize();else if(t===2001)r[5].setComponents(s,d,h,y).normalize();else throw Error(`THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: `+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),vs.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),vs.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(vs)}intersectsSprite(e){return vs.center.set(0,0,0),vs.radius=.7071067811865476+ys.distanceTo(e.center),vs.applyMatrix4(e.matrixWorld),this.intersectsSphere(vs)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let e=0;e<6;e++)if(t[e].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(bs.x=r.normal.x>0?e.max.x:e.min.x,bs.y=r.normal.y>0?e.max.y:e.min.y,bs.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(bs)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},Ss=class extends Yo{constructor(e){super(),this.isLineBasicMaterial=!0,this.type=`LineBasicMaterial`,this.color=new Ka(16777215),this.map=null,this.linewidth=1,this.linecap=`round`,this.linejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},Cs=new X,ws=new X,Ts=new da,Es=new es,Ds=new Fo,Os=new X,ks=new X,As=class extends Ra{constructor(e=new Uo,t=new Ss){super(),this.isLine=!0,this.type=`Line`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let e=1,r=t.count;e<r;e++)Cs.fromBufferAttribute(t,e-1),ws.fromBufferAttribute(t,e),n[e]=n[e-1],n[e]+=Cs.distanceTo(ws);e.setAttribute(`lineDistance`,new jo(n,1))}else Y(`Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.`);return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.matrixWorld,i=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Ds.copy(n.boundingSphere),Ds.applyMatrix4(r),Ds.radius+=i,e.ray.intersectsSphere(Ds)===!1)return;Ts.copy(r).invert(),Es.copy(e.ray).applyMatrix4(Ts);let o=i/((this.scale.x+this.scale.y+this.scale.z)/3),s=o*o,c=this.isLineSegments?2:1,l=n.index,u=n.attributes.position;if(l!==null){let n=Math.max(0,a.start),r=Math.min(l.count,a.start+a.count);for(let i=n,a=r-1;i<a;i+=c){let n=l.getX(i),r=l.getX(i+1),a=js(this,e,Es,s,n,r,i);a&&t.push(a)}if(this.isLineLoop){let i=l.getX(r-1),a=l.getX(n),o=js(this,e,Es,s,i,a,r-1);o&&t.push(o)}}else{let n=Math.max(0,a.start),r=Math.min(u.count,a.start+a.count);for(let i=n,a=r-1;i<a;i+=c){let n=js(this,e,Es,s,i,i+1,i);n&&t.push(n)}if(this.isLineLoop){let i=js(this,e,Es,s,r-1,n,r-1);i&&t.push(i)}}}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}};function js(e,t,n,r,i,a,o){let s=e.geometry.attributes.position;if(Cs.fromBufferAttribute(s,i),ws.fromBufferAttribute(s,a),n.distanceSqToSegment(Cs,ws,Os,ks)>r)return;Os.applyMatrix4(e.matrixWorld);let c=t.ray.origin.distanceTo(Os);if(!(c<t.near||c>t.far))return{distance:c,point:ks.clone().applyMatrix4(e.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:e}}var Ms=new X,Ns=new X,Ps=class extends As{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type=`LineSegments`}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let e=0,r=t.count;e<r;e+=2)Ms.fromBufferAttribute(t,e),Ns.fromBufferAttribute(t,e+1),n[e]=e===0?0:n[e-1],n[e+1]=n[e]+Ms.distanceTo(Ns);e.setAttribute(`lineDistance`,new jo(n,1))}else Y(`LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.`);return this}},Fs=class extends Yo{constructor(e){super(),this.isPointsMaterial=!0,this.type=`PointsMaterial`,this.color=new Ka(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},Is=new da,Ls=new es,Rs=new Fo,zs=new X,Bs=class extends Ra{constructor(e=new Uo,t=new Fs){super(),this.isPoints=!0,this.type=`Points`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.matrixWorld,i=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Rs.copy(n.boundingSphere),Rs.applyMatrix4(r),Rs.radius+=i,e.ray.intersectsSphere(Rs)===!1)return;Is.copy(r).invert(),Ls.copy(e.ray).applyMatrix4(Is);let o=i/((this.scale.x+this.scale.y+this.scale.z)/3),s=o*o,c=n.index,l=n.attributes.position;if(c!==null){let n=Math.max(0,a.start),i=Math.min(c.count,a.start+a.count);for(let a=n,o=i;a<o;a++){let n=c.getX(a);zs.fromBufferAttribute(l,n),Vs(zs,n,s,r,e,t,this)}}else{let n=Math.max(0,a.start),i=Math.min(l.count,a.start+a.count);for(let a=n,o=i;a<o;a++)zs.fromBufferAttribute(l,a),Vs(zs,a,s,r,e,t,this)}}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}};function Vs(e,t,n,r,i,a,o){let s=Ls.distanceSqToPoint(e);if(s<n){let n=new X;Ls.closestPointToPoint(e,n),n.applyMatrix4(r);let c=i.ray.origin.distanceTo(n);if(c<i.near||c>i.far)return;a.push({distance:c,distanceToRay:Math.sqrt(s),point:n,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}var Hs=class extends aa{constructor(e=[],t=301,n,r,i,a,o,s,c,l){super(e,t,n,r,i,a,o,s,c,l),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},Us=class extends aa{constructor(e,t,n=zn,r,i,a,o=On,s=On,c,l=Xn,u=1){if(l!==1026&&l!==1027)throw Error(`THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat`);super({width:e,height:t,depth:u},r,i,a,o,s,l,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new ta(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},Ws=class extends Us{constructor(e,t=zn,n=301,r,i,a=On,o=On,s,c=Xn){let l={width:e,height:e,depth:1},u=[l,l,l,l,l,l];super(e,e,t,n,r,i,a,o,s,c),this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Gs=class extends aa{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},Ks=class e extends Uo{constructor(e=1,t=1,n=1,r=1,i=1,a=1){super(),this.type=`BoxGeometry`,this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:i,depthSegments:a};let o=this;r=Math.floor(r),i=Math.floor(i),a=Math.floor(a);let s=[],c=[],l=[],u=[],d=0,f=0;p(`z`,`y`,`x`,-1,-1,n,t,e,a,i,0),p(`z`,`y`,`x`,1,-1,n,t,-e,a,i,1),p(`x`,`z`,`y`,1,1,e,n,t,r,a,2),p(`x`,`z`,`y`,1,-1,e,n,-t,r,a,3),p(`x`,`y`,`z`,1,-1,e,t,n,r,i,4),p(`x`,`y`,`z`,-1,-1,e,t,-n,r,i,5),this.setIndex(s),this.setAttribute(`position`,new jo(c,3)),this.setAttribute(`normal`,new jo(l,3)),this.setAttribute(`uv`,new jo(u,2));function p(e,t,n,r,i,a,p,m,h,g,_){let v=a/h,y=p/g,b=a/2,x=p/2,S=m/2,C=h+1,w=g+1,T=0,E=0,D=new X;for(let a=0;a<w;a++){let o=a*y-x;for(let s=0;s<C;s++)D[e]=(s*v-b)*r,D[t]=o*i,D[n]=S,c.push(D.x,D.y,D.z),D[e]=0,D[t]=0,D[n]=m>0?1:-1,l.push(D.x,D.y,D.z),u.push(s/h),u.push(1-a/g),T+=1}for(let e=0;e<g;e++)for(let t=0;t<h;t++){let n=d+t+C*e,r=d+t+C*(e+1),i=d+(t+1)+C*(e+1),a=d+(t+1)+C*e;s.push(n,r,a),s.push(r,i,a),E+=6}o.addGroup(f,E,_),f+=E,d+=T}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}},qs=class e extends Uo{constructor(e=1,t=32,n=0,r=Math.PI*2){super(),this.type=`CircleGeometry`,this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:r},t=Math.max(3,t);let i=[],a=[],o=[],s=[],c=new X,l=new Bi;a.push(0,0,0),o.push(0,0,1),s.push(.5,.5);for(let i=0,u=3;i<=t;i++,u+=3){let d=n+i/t*r;c.x=e*Math.cos(d),c.y=e*Math.sin(d),a.push(c.x,c.y,c.z),o.push(0,0,1),l.x=(a[u]/e+1)/2,l.y=(a[u+1]/e+1)/2,s.push(l.x,l.y)}for(let e=1;e<=t;e++)i.push(e,e+1,0);this.setIndex(i),this.setAttribute(`position`,new jo(a,3)),this.setAttribute(`normal`,new jo(o,3)),this.setAttribute(`uv`,new jo(s,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radius,t.segments,t.thetaStart,t.thetaLength)}},Js=class e extends Uo{constructor(e=1,t=1,n=1,r=1){super(),this.type=`PlaneGeometry`,this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let i=e/2,a=t/2,o=Math.floor(n),s=Math.floor(r),c=o+1,l=s+1,u=e/o,d=t/s,f=[],p=[],m=[],h=[];for(let e=0;e<l;e++){let t=e*d-a;for(let n=0;n<c;n++){let r=n*u-i;p.push(r,-t,0),m.push(0,0,1),h.push(n/o),h.push(1-e/s)}}for(let e=0;e<s;e++)for(let t=0;t<o;t++){let n=t+c*e,r=t+c*(e+1),i=t+1+c*(e+1),a=t+1+c*e;f.push(n,r,a),f.push(r,i,a)}this.setIndex(f),this.setAttribute(`position`,new jo(p,3)),this.setAttribute(`normal`,new jo(m,3)),this.setAttribute(`uv`,new jo(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.widthSegments,t.heightSegments)}};function Ys(e){let t={};for(let n in e){t[n]={};for(let r in e[n]){let i=e[n][r];if(Zs(i))i.isRenderTargetTexture?(Y(`UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().`),t[n][r]=null):t[n][r]=i.clone();else if(Array.isArray(i)){if(Zs(i[0])){let e=[];for(let t=0,n=i.length;t<n;t++)e[t]=i[t].clone();t[n][r]=e}else t[n][r]=i.slice()}else t[n][r]=i}}return t}function Xs(e){let t={};for(let n=0;n<e.length;n++){let r=Ys(e[n]);for(let e in r)t[e]=r[e]}return t}function Zs(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function Qs(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function $s(e){let t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Yi.workingColorSpace}var ec={clone:Ys,merge:Xs},tc=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,nc=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,rc=class extends Yo{constructor(e){super(),this.isShaderMaterial=!0,this.type=`ShaderMaterial`,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=tc,this.fragmentShader=nc,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Ys(e.uniforms),this.uniformsGroups=Qs(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let n in this.uniforms){let r=this.uniforms[n].value;r&&r.isTexture?t.uniforms[n]={type:`t`,value:r.toJSON(e).uuid}:r&&r.isColor?t.uniforms[n]={type:`c`,value:r.getHex()}:r&&r.isVector2?t.uniforms[n]={type:`v2`,value:r.toArray()}:r&&r.isVector3?t.uniforms[n]={type:`v3`,value:r.toArray()}:r&&r.isVector4?t.uniforms[n]={type:`v4`,value:r.toArray()}:r&&r.isMatrix3?t.uniforms[n]={type:`m3`,value:r.toArray()}:r&&r.isMatrix4?t.uniforms[n]={type:`m4`,value:r.toArray()}:t.uniforms[n]={value:r}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let e in this.extensions)this.extensions[e]===!0&&(n[e]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let r=e.uniforms[n];switch(this.uniforms[n]={},r.type){case`t`:this.uniforms[n].value=t[r.value]||null;break;case`c`:this.uniforms[n].value=new Ka().setHex(r.value);break;case`v2`:this.uniforms[n].value=new Bi().fromArray(r.value);break;case`v3`:this.uniforms[n].value=new X().fromArray(r.value);break;case`v4`:this.uniforms[n].value=new oa().fromArray(r.value);break;case`m3`:this.uniforms[n].value=new Wi().fromArray(r.value);break;case`m4`:this.uniforms[n].value=new da().fromArray(r.value);break;default:this.uniforms[n].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let t in e.extensions)this.extensions[t]=e.extensions[t];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},ic=class extends rc{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type=`RawShaderMaterial`}},ac=class extends Yo{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type=`MeshDepthMaterial`,this.depthPacking=Kr,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},oc=class extends Yo{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type=`MeshDistanceMaterial`,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function sc(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT==`number`?new t(e):Array.prototype.slice.call(e)}function cc(e){return e!==void 0&&e.inTangents!==void 0&&e.outTangents!==void 0}var lc=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r===void 0?new t.constructor(n):r,this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],i=t[n-1];validate_interval:{seek:{let a;linear_scan:{forward_scan:if(!(e<r)){for(let a=n+2;;){if(r===void 0){if(e<i)break forward_scan;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(i=r,r=t[++n],e<r)break seek}a=t.length;break linear_scan}if(!(e>=i)){let o=t[1];e<o&&(n=2,i=o);for(let a=n-2;;){if(i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(r=i,i=t[--n-1],e>=i)break seek}a=n,n=0;break linear_scan}break validate_interval}for(;n<a;){let r=n+a>>>1;e<t[r]?a=r:n=r+1}if(r=t[n],i=t[n-1],i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,i,r)}return this.interpolate_(n,i,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,i=e*r;for(let e=0;e!==r;++e)t[e]=n[i+e];return t}interpolate_(){throw Error(`THREE.Interpolant: Call to abstract method.`)}intervalChanged_(){}},uc=class extends lc{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Ur,endingEnd:Ur}}intervalChanged_(e,t,n){let r=this.parameterPositions,i=e-2,a=e+1,o=r[i],s=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case Wr:i=e,o=2*t-n;break;case Gr:i=r.length-2,o=t+r[i]-r[i+1];break;default:i=e,o=n}if(s===void 0)switch(this.getSettings_().endingEnd){case Wr:a=e,s=2*n-t;break;case Gr:a=1,s=n+r[1]-r[0];break;default:a=e-1,s=t}let c=(n-t)*.5,l=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(s-n),this._offsetPrev=i*l,this._offsetNext=a*l}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,p=(n-t)/(r-t),m=p*p,h=m*p,g=-d*h+2*d*m-d*p,_=(1+d)*h+(-1.5-2*d)*m+(-.5+d)*p+1,v=(-1-f)*h+(1.5+f)*m+.5*p,y=f*h-f*m;for(let e=0;e!==o;++e)i[e]=g*a[l+e]+_*a[c+e]+v*a[s+e]+y*a[u+e];return i}},dc=class extends lc{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=(n-t)/(r-t),u=1-l;for(let e=0;e!==o;++e)i[e]=a[c+e]*u+a[s+e]*l;return i}},fc=class extends lc{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},pc=class extends lc{interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this.inTangents,u=this.outTangents;if(!l||!u){let e=(n-t)/(r-t),l=1-e;for(let t=0;t!==o;++t)i[t]=a[c+t]*l+a[s+t]*e;return i}let d=o*2,f=e-1;for(let p=0;p!==o;++p){let o=a[c+p],m=a[s+p],h=f*d+p*2,g=u[h],_=u[h+1],v=e*d+p*2,y=l[v],b=l[v+1],x=gc(n,t,g,y,r);i[p]=mc(x,o,_,b,m)}return i}};function mc(e,t,n,r,i){let a=1-e;return a*a*a*t+3*a*a*e*n+3*a*e*e*r+e*e*e*i}function hc(e,t,n,r,i){let a=1-e;return 3*a*a*(n-t)+6*a*e*(r-n)+3*e*e*(i-r)}function gc(e,t,n,r,i){let a=(e-t)/(i-t);for(let o=0;o<8;o++){let o=mc(a,t,n,r,i)-e;if(Math.abs(o)<1e-10)break;let s=hc(a,t,n,r,i);if(Math.abs(s)<1e-10)break;a=Math.max(0,Math.min(1,a-o/s))}return a}var _c=class{constructor(e,t,n,r){if(e===void 0)throw Error(`THREE.KeyframeTrack: track name is undefined`);if(t===void 0||t.length===0)throw Error(`THREE.KeyframeTrack: no keyframes in track named `+e);this.name=e,this.times=sc(t,this.TimeBufferType),this.values=sc(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:sc(e.times,Array),values:sc(e.values,Array)};let t=e.getInterpolation();t!==e.DefaultInterpolation&&(n.interpolation=t),cc(e.settings)&&(n.settings={inTangents:sc(e.settings.inTangents,Array),outTangents:sc(e.settings.outTangents,Array)})}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new fc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new dc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new uc(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new pc(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case zr:t=this.InterpolantFactoryMethodDiscrete;break;case Br:t=this.InterpolantFactoryMethodLinear;break;case Vr:t=this.InterpolantFactoryMethodSmooth;break;case Hr:t=this.InterpolantFactoryMethodBezier}if(t===void 0){let t=`unsupported interpolation for `+this.ValueTypeName+` keyframe track named `+this.name;if(this.createInterpolant===void 0){if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(t)}return Y(`KeyframeTrack:`,t),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return zr;case this.InterpolantFactoryMethodLinear:return Br;case this.InterpolantFactoryMethodSmooth:return Vr;case this.InterpolantFactoryMethodBezier:return Hr}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e;cc(this.settings)&&(vc(this.settings.inTangents,e),vc(this.settings.outTangents,e))}return this}trim(e,t){let n=this.times,r=n.length,i=0,a=r-1;for(;i!==r&&n[i]<e;)++i;for(;a!==-1&&n[a]>t;)--a;if(++a,i!==0||a!==r){i>=a&&(a=Math.max(a,1),i=a-1);let e=this.getValueSize();this.times=n.slice(i,a),this.values=this.values.slice(i*e,a*e)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(ci(`KeyframeTrack: Invalid value size in track.`,this),e=!1);let n=this.times,r=this.values,i=n.length;i===0&&(ci(`KeyframeTrack: Track is empty.`,this),e=!1);let a=null;for(let t=0;t!==i;t++){let r=n[t];if(typeof r==`number`&&isNaN(r)){ci(`KeyframeTrack: Time is not a valid number.`,this,t,r),e=!1;break}if(a!==null&&a>r){ci(`KeyframeTrack: Out of order keys.`,this,t,r,a),e=!1;break}a=r}if(r!==void 0&&ni(r))for(let t=0,n=r.length;t!==n;++t){let n=r[t];if(isNaN(n)){ci(`KeyframeTrack: Value is not a valid number.`,this,t,n),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===Vr,i=e.length-1,a=1;for(let o=1;o<i;++o){let i=!1,s=e[o];if(s!==e[o+1]&&(o!==1||s!==e[0])){if(r)i=!0;else{let e=o*n,r=e-n,a=e+n;for(let o=0;o!==n;++o){let n=t[e+o];if(n!==t[r+o]||n!==t[a+o]){i=!0;break}}}}if(i){if(o!==a){e[a]=e[o];let r=o*n,i=a*n;for(let e=0;e!==n;++e)t[i+e]=t[r+e]}++a}}if(i>0){e[a]=e[i];for(let e=i*n,r=a*n,o=0;o!==n;++o)t[r+o]=t[e+o];++a}return a===e.length?(this.times=e,this.values=t):(this.times=e.slice(0,a),this.values=t.slice(0,a*n)),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,r=new n(this.name,e,t);return r.createInterpolant=this.createInterpolant,cc(this.settings)&&(r.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),r}};function vc(e,t){for(let n=0,r=e.length;n!==r;n+=2)e[n]*=t}_c.prototype.ValueTypeName=``,_c.prototype.TimeBufferType=Float32Array,_c.prototype.ValueBufferType=Float32Array,_c.prototype.DefaultInterpolation=Br;var yc=class extends _c{constructor(e,t,n){super(e,t,n)}};yc.prototype.ValueTypeName=`bool`,yc.prototype.ValueBufferType=Array,yc.prototype.DefaultInterpolation=zr,yc.prototype.InterpolantFactoryMethodLinear=void 0,yc.prototype.InterpolantFactoryMethodSmooth=void 0;var bc=class extends _c{constructor(e,t,n,r){super(e,t,n,r)}};bc.prototype.ValueTypeName=`color`;var xc=class extends _c{constructor(e,t,n,r){super(e,t,n,r)}};xc.prototype.ValueTypeName=`number`;var Sc=class extends lc{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=(n-t)/(r-t),c=e*o;for(let e=c+o;c!==e;c+=4)Vi.slerpFlat(i,0,a,c-o,a,c,s);return i}},Cc=class extends _c{constructor(e,t,n,r){super(e,t,n,r)}InterpolantFactoryMethodLinear(e){return new Sc(this.times,this.values,this.getValueSize(),e)}};Cc.prototype.ValueTypeName=`quaternion`,Cc.prototype.InterpolantFactoryMethodSmooth=void 0;var wc=class extends _c{constructor(e,t,n){super(e,t,n)}};wc.prototype.ValueTypeName=`string`,wc.prototype.ValueBufferType=Array,wc.prototype.DefaultInterpolation=zr,wc.prototype.InterpolantFactoryMethodLinear=void 0,wc.prototype.InterpolantFactoryMethodSmooth=void 0;var Tc=class extends _c{constructor(e,t,n,r){super(e,t,n,r)}};Tc.prototype.ValueTypeName=`vector`;var Ec=new X,Dc=new Vi,Oc=new X,kc=class extends Ra{constructor(){super(),this.isCamera=!0,this.type=`Camera`,this.matrixWorldInverse=new da,this.projectionMatrix=new da,this.projectionMatrixInverse=new da,this.coordinateSystem=ei,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Ec,Dc,Oc),Oc.x===1&&Oc.y===1&&Oc.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ec,Dc,Oc.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(Ec,Dc,Oc),Oc.x===1&&Oc.y===1&&Oc.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ec,Dc,Oc.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Ac=new X,jc=new Bi,Mc=new Bi,Nc=class extends kc{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type=`PerspectiveCamera`,this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=gi*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(hi*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return gi*2*Math.atan(Math.tan(hi*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Ac.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Ac.x,Ac.y).multiplyScalar(-e/Ac.z),Ac.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Ac.x,Ac.y).multiplyScalar(-e/Ac.z)}getViewSize(e,t){return this.getViewBounds(e,jc,Mc),t.subVectors(Mc,jc)}setViewOffset(e,t,n,r,i,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(hi*.5*this.fov)/this.zoom,n=2*t,r=this.aspect*n,i=-.5*r,a=this.view;if(this.view!==null&&this.view.enabled){let e=a.fullWidth,o=a.fullHeight;i+=a.offsetX*r/e,t-=a.offsetY*n/o,r*=a.width/e,n*=a.height/o}let o=this.filmOffset;o!==0&&(i+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(i,i+r,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},Pc=class extends kc{constructor(e=-1,t=1,n=1,r=-1,i=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type=`OrthographicCamera`,this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=i,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,i,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,i=n-e,a=n+e,o=r+t,s=r-t;if(this.view!==null&&this.view.enabled){let e=(this.right-this.left)/this.view.fullWidth/this.zoom,t=(this.top-this.bottom)/this.view.fullHeight/this.zoom;i+=e*this.view.offsetX,a=i+e*this.view.width,o-=t*this.view.offsetY,s=o-t*this.view.height}this.projectionMatrix.makeOrthographic(i,a,o,s,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},Fc=class extends Uo{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type=`InstancedBufferGeometry`,this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}toJSON(){let e=super.toJSON();return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}},Ic=-90,Lc=1,Rc=class extends Ra{constructor(e,t,n){super(),this.type=`CubeCamera`,this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Nc(Ic,Lc,e,t);r.layers=this.layers,this.add(r);let i=new Nc(Ic,Lc,e,t);i.layers=this.layers,this.add(i);let a=new Nc(Ic,Lc,e,t);a.layers=this.layers,this.add(a);let o=new Nc(Ic,Lc,e,t);o.layers=this.layers,this.add(o);let s=new Nc(Ic,Lc,e,t);s.layers=this.layers,this.add(s);let c=new Nc(Ic,Lc,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,i,a,o,s]=t;for(let e of t)this.remove(e);if(e===2e3)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),i.up.set(0,0,-1),i.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),s.up.set(0,1,0),s.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),i.up.set(0,0,1),i.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),s.up.set(0,-1,0),s.lookAt(0,0,-1);else throw Error(`THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: `+e);for(let e of t)this.add(e),e.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[i,a,o,s,c,l]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let m=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let h=!1;h=e.isWebGLRenderer===!0?e.state.buffers.depth.getReversed():e.reversedDepthBuffer,e.setRenderTarget(n,0,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,i),e.setRenderTarget(n,1,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,4,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=m,e.setRenderTarget(n,5,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(u,d,f),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}},zc=class extends Nc{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},Bc=`\\[\\]\\.:\\/`,Vc=RegExp(`[\\[\\]\\.:\\/]`,`g`),Hc=`[^\\[\\]\\.:\\/]`,Uc=`[^`+Bc.replace(`\\.`,``)+`]`,Wc=`((?:WC+[\\/:])*)`.replace(`WC`,Hc),Gc=`(WCOD+)?`.replace(`WCOD`,Uc),Kc=`(?:\\.(WC+)(?:\\[(.+)\\])?)?`.replace(`WC`,Hc),qc=`\\.(WC+)(?:\\[(.+)\\])?`.replace(`WC`,Hc),Jc=RegExp(`^`+Wc+Gc+Kc+qc+`$`),Yc=[`material`,`materials`,`bones`,`map`],Xc=class{constructor(e,t,n){let r=n||Zc.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,r=this._bindings[n];r!==void 0&&r.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let r=this._targetGroup.nCachedObjects_,i=n.length;r!==i;++r)n[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},Zc=class e{constructor(t,n,r){this.path=n,this.parsedPath=r||e.parseTrackName(n),this.node=e.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,r){return t&&t.isAnimationObjectGroup?new e.Composite(t,n,r):new e(t,n,r)}static sanitizeNodeName(e){return e.replace(/\s/g,`_`).replace(Vc,``)}static parseTrackName(e){let t=Jc.exec(e);if(t===null)throw Error(`THREE.PropertyBinding: Cannot parse trackName: `+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(`.`);if(r!==void 0&&r!==-1){let e=n.nodeName.substring(r+1);Yc.indexOf(e)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=e)}if(n.propertyName===null||n.propertyName.length===0)throw Error(`THREE.PropertyBinding: can not parse propertyName from trackName: `+e);return n}static findNode(e,t){if(t===void 0||t===``||t===`.`||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(e){for(let r=0;r<e.length;r++){let i=e[r];if(i.name===t||i.uuid===t)return i;let a=n(i.children);if(a)return a}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let t=this.node,n=this.parsedPath,r=n.objectName,i=n.propertyName,a=n.propertyIndex;if(t||(t=e.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Y(`PropertyBinding: No target node found for track: `+this.path+`.`);return}if(r){let e=n.objectIndex;switch(r){case`materials`:if(!t.material){ci(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.materials){ci(`PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.`,this);return}t=t.material.materials;break;case`bones`:if(!t.skeleton){ci(`PropertyBinding: Can not bind to bones as node does not have a skeleton.`,this);return}t=t.skeleton.bones;for(let n=0;n<t.length;n++)if(t[n].name===e){e=n;break}break;case`map`:if(`map`in t){t=t.map;break}if(!t.material){ci(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.map){ci(`PropertyBinding: Can not bind to material.map as node.material does not have a map.`,this);return}t=t.material.map;break;default:if(t[r]===void 0){ci(`PropertyBinding: Can not bind to objectName of node undefined.`,this);return}t=t[r]}if(e!==void 0){if(t[e]===void 0){ci(`PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.`,this,t);return}t=t[e]}}let o=t[i];if(o===void 0){let e=n.nodeName;ci(`PropertyBinding: Trying to update property for track: `+e+`.`+i+` but it wasn't found.`,t);return}let s=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?s=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(s=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(a!==void 0){if(i===`morphTargetInfluences`){if(!t.geometry){ci(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.`,this);return}if(!t.geometry.morphAttributes){ci(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.`,this);return}t.morphTargetDictionary[a]!==void 0&&(a=t.morphTargetDictionary[a])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=a}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][s]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};Zc.Composite=Xc,Zc.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},Zc.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},Zc.prototype.GetterByBindingType=[Zc.prototype._getValue_direct,Zc.prototype._getValue_array,Zc.prototype._getValue_arrayElement,Zc.prototype._getValue_toArray],Zc.prototype.SetterByBindingTypeAndVersioning=[[Zc.prototype._setValue_direct,Zc.prototype._setValue_direct_setNeedsUpdate,Zc.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[Zc.prototype._setValue_array,Zc.prototype._setValue_array_setNeedsUpdate,Zc.prototype._setValue_array_setMatrixWorldNeedsUpdate],[Zc.prototype._setValue_arrayElement,Zc.prototype._setValue_arrayElement_setNeedsUpdate,Zc.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[Zc.prototype._setValue_fromArray,Zc.prototype._setValue_fromArray_setNeedsUpdate,Zc.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Qc=new da,$c=class{constructor(e,t,n=0,r=1/0){this.ray=new es(e,t),this.near=n,this.far=r,this.camera=null,this.layers=new Sa,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):ci(`Raycaster: Unsupported camera type: `+t.type)}setFromXRController(e){return Qc.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Qc),this}intersectObject(e,t=!0,n=[]){return tl(e,this,n,t),n.sort(el),n}intersectObjects(e,t=!0,n=[]){for(let r=0,i=e.length;r<i;r++)tl(e[r],this,n,t);return n.sort(el),n}};function el(e,t){return e.distance-t.distance}function tl(e,t,n,r){let i=!0;if(e.layers.test(t.layers)&&e.raycast(t,n)===!1&&(i=!1),i===!0&&r===!0){let r=e.children;for(let e=0,i=r.length;e<i;e++)tl(r[e],t,n,!0)}}var nl=class{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){let e=1e-6;return this.phi=vi(this.phi,e,Math.PI-e),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(vi(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};(class e{static{e.prototype.isMatrix2=!0}constructor(e,t,n,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,r){let i=this.elements;return i[0]=e,i[2]=t,i[1]=n,i[3]=r,this}});var rl=class extends fi{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function il(e,t,n,r){let i=al(r);switch(n){case qn:return e*t;case Qn:return e*t/i.components*i.byteLength;case $n:return e*t/i.components*i.byteLength;case er:return e*t*2/i.components*i.byteLength;case tr:return e*t*2/i.components*i.byteLength;case Jn:return e*t*3/i.components*i.byteLength;case Yn:return e*t*4/i.components*i.byteLength;case nr:return e*t*4/i.components*i.byteLength;case rr:case ir:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case ar:case or:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case cr:case ur:return Math.max(e,16)*Math.max(t,8)/4;case sr:case lr:return Math.max(e,8)*Math.max(t,8)/2;case dr:case fr:case mr:case hr:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case pr:case gr:case _r:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case vr:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case yr:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case br:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case xr:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case Sr:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case Cr:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case wr:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case Tr:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case Er:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case Dr:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case Or:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case kr:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case Ar:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case jr:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case Mr:case Nr:case Pr:return Math.ceil(e/4)*Math.ceil(t/4)*16;case Fr:case Ir:return Math.ceil(e/4)*Math.ceil(t/4)*8;case Lr:case Rr:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw Error(`Unable to determine texture byte length for ${n} format.`)}function al(e){switch(e){case Pn:case Fn:return{byteLength:1,components:1};case Ln:case In:case Vn:return{byteLength:2,components:1};case Hn:case Un:return{byteLength:2,components:4};case zn:case Rn:case Bn:return{byteLength:4,components:1};case Gn:case Kn:return{byteLength:4,components:3}}throw Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`register`,{detail:{revision:`186`}})),typeof window<`u`&&(window.__THREE__?Y(`WARNING: Multiple instances of Three.js being imported.`):window.__THREE__=`186`);function ol(){let e=null,t=!1,n=null,r=null;function i(t,a){r=e.requestAnimationFrame(i),n(t,a)}return{start:function(){t!==!0&&n!==null&&e!==null&&(r=e.requestAnimationFrame(i),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(r),t=!1},setAnimationLoop:function(e){n=e},setContext:function(t){e=t}}}function sl(e){let t=new WeakMap;function n(t,n){let r=t.array,i=t.usage,a=r.byteLength,o=e.createBuffer();e.bindBuffer(n,o),e.bufferData(n,r,i),t.onUploadCallback();let s;if(r instanceof Float32Array)s=e.FLOAT;else if(typeof Float16Array<`u`&&r instanceof Float16Array)s=e.HALF_FLOAT;else if(r instanceof Uint16Array)s=t.isFloat16BufferAttribute?e.HALF_FLOAT:e.UNSIGNED_SHORT;else if(r instanceof Int16Array)s=e.SHORT;else if(r instanceof Uint32Array)s=e.UNSIGNED_INT;else if(r instanceof Int32Array)s=e.INT;else if(r instanceof Int8Array)s=e.BYTE;else if(r instanceof Uint8Array)s=e.UNSIGNED_BYTE;else if(r instanceof Uint8ClampedArray)s=e.UNSIGNED_BYTE;else throw Error(`THREE.WebGLAttributes: Unsupported buffer data format: `+r);return{buffer:o,type:s,bytesPerElement:r.BYTES_PER_ELEMENT,version:t.version,size:a}}function r(t,n,r){let i=n.array,a=n.updateRanges;if(e.bindBuffer(r,t),a.length===0)e.bufferSubData(r,0,i);else{a.sort((e,t)=>e.start-t.start);let t=0;for(let e=1;e<a.length;e++){let n=a[t],r=a[e];r.start<=n.start+n.count+1?n.count=Math.max(n.count,r.start+r.count-n.start):(++t,a[t]=r)}a.length=t+1;for(let t=0,n=a.length;t<n;t++){let n=a[t];e.bufferSubData(r,n.start*i.BYTES_PER_ELEMENT,i,n.start,n.count)}n.clearUpdateRanges()}n.onUploadCallback()}function i(e){return e.isInterleavedBufferAttribute&&(e=e.data),t.get(e)}function a(n){n.isInterleavedBufferAttribute&&(n=n.data);let r=t.get(n);r&&(e.deleteBuffer(r.buffer),t.delete(n))}function o(e,i){if(e.isInterleavedBufferAttribute&&(e=e.data),e.isGLBufferAttribute){let n=t.get(e);(!n||n.version<e.version)&&t.set(e,{buffer:e.buffer,type:e.type,bytesPerElement:e.elementSize,version:e.version});return}let a=t.get(e);if(a===void 0)t.set(e,n(e,i));else if(a.version<e.version){if(a.size!==e.array.byteLength)throw Error(`THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.`);r(a.buffer,e,i),a.version=e.version}}return{get:i,remove:a,update:o}}var cl={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:`gl_FragColor = linearToOutputTexel( gl_FragColor );`,colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,lightprobes_pars_fragment:`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},Z={common:{diffuse:{value:new Ka(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Wi},alphaMap:{value:null},alphaMapTransform:{value:new Wi},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Wi}},envmap:{envMap:{value:null},envMapRotation:{value:new Wi},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Wi}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Wi}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Wi},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Wi},normalScale:{value:new Bi(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Wi},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Wi}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Wi}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Wi}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ka(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new X},probesMax:{value:new X},probesResolution:{value:new X}},points:{diffuse:{value:new Ka(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Wi},alphaTest:{value:0},uvTransform:{value:new Wi}},sprite:{diffuse:{value:new Ka(16777215)},opacity:{value:1},center:{value:new Bi(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Wi},alphaMap:{value:null},alphaMapTransform:{value:new Wi},alphaTest:{value:0}}},ll={basic:{uniforms:Xs([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.fog]),vertexShader:cl.meshbasic_vert,fragmentShader:cl.meshbasic_frag},lambert:{uniforms:Xs([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,Z.lights,{emissive:{value:new Ka(0)},envMapIntensity:{value:1}}]),vertexShader:cl.meshlambert_vert,fragmentShader:cl.meshlambert_frag},phong:{uniforms:Xs([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,Z.lights,{emissive:{value:new Ka(0)},specular:{value:new Ka(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:cl.meshphong_vert,fragmentShader:cl.meshphong_frag},standard:{uniforms:Xs([Z.common,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.roughnessmap,Z.metalnessmap,Z.fog,Z.lights,{emissive:{value:new Ka(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:cl.meshphysical_vert,fragmentShader:cl.meshphysical_frag},toon:{uniforms:Xs([Z.common,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.gradientmap,Z.fog,Z.lights,{emissive:{value:new Ka(0)}}]),vertexShader:cl.meshtoon_vert,fragmentShader:cl.meshtoon_frag},matcap:{uniforms:Xs([Z.common,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,{matcap:{value:null}}]),vertexShader:cl.meshmatcap_vert,fragmentShader:cl.meshmatcap_frag},points:{uniforms:Xs([Z.points,Z.fog]),vertexShader:cl.points_vert,fragmentShader:cl.points_frag},dashed:{uniforms:Xs([Z.common,Z.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:cl.linedashed_vert,fragmentShader:cl.linedashed_frag},depth:{uniforms:Xs([Z.common,Z.displacementmap]),vertexShader:cl.depth_vert,fragmentShader:cl.depth_frag},normal:{uniforms:Xs([Z.common,Z.bumpmap,Z.normalmap,Z.displacementmap,{opacity:{value:1}}]),vertexShader:cl.meshnormal_vert,fragmentShader:cl.meshnormal_frag},sprite:{uniforms:Xs([Z.sprite,Z.fog]),vertexShader:cl.sprite_vert,fragmentShader:cl.sprite_frag},background:{uniforms:{uvTransform:{value:new Wi},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:cl.background_vert,fragmentShader:cl.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Wi}},vertexShader:cl.backgroundCube_vert,fragmentShader:cl.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:cl.cube_vert,fragmentShader:cl.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:cl.equirect_vert,fragmentShader:cl.equirect_frag},distance:{uniforms:Xs([Z.common,Z.displacementmap,{referencePosition:{value:new X},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:cl.distance_vert,fragmentShader:cl.distance_frag},shadow:{uniforms:Xs([Z.lights,Z.fog,{color:{value:new Ka(0)},opacity:{value:1}}]),vertexShader:cl.shadow_vert,fragmentShader:cl.shadow_frag}};ll.physical={uniforms:Xs([ll.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Wi},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Wi},clearcoatNormalScale:{value:new Bi(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Wi},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Wi},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Wi},sheen:{value:0},sheenColor:{value:new Ka(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Wi},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Wi},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Wi},transmissionSamplerSize:{value:new Bi},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Wi},attenuationDistance:{value:0},attenuationColor:{value:new Ka(0)},specularColor:{value:new Ka(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Wi},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Wi},anisotropyVector:{value:new Bi},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Wi}}]),vertexShader:cl.meshphysical_vert,fragmentShader:cl.meshphysical_frag};var ul={r:0,b:0,g:0},dl=new da,fl=new Wi;fl.set(-1,0,0,0,1,0,0,0,1);function pl(e,t,n,r,i,a){let o=new Ka(0),s=i===!0?0:1,c,l,u=null,d=0,f=null;function p(e){let n=e.isScene===!0?e.background:null;if(n&&n.isTexture){let r=e.backgroundBlurriness>0;n=t.get(n,r)}return n}function m(t){let r=!1,i=p(t);i===null?g(o,s):i&&i.isColor&&(g(i,1),r=!0);let c=e.xr.getEnvironmentBlendMode();c===`additive`?n.buffers.color.setClear(0,0,0,1,a):c===`alpha-blend`&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||r)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function h(t,n){let i=p(n);i&&(i.isCubeTexture||i.mapping===306)?(l===void 0&&(l=new ps(new Ks(1,1,1),new rc({name:`BackgroundCubeMaterial`,uniforms:Ys(ll.backgroundCube.uniforms),vertexShader:ll.backgroundCube.vertexShader,fragmentShader:ll.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute(`normal`),l.geometry.deleteAttribute(`uv`),l.onBeforeRender=function(e,t,n){this.matrixWorld.copyPosition(n.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(l)),l.material.uniforms.envMap.value=i,l.material.uniforms.backgroundBlurriness.value=n.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(dl.makeRotationFromEuler(n.backgroundRotation)).transpose(),i.isCubeTexture&&i.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(fl),l.material.toneMapped=Yi.getTransfer(i.colorSpace)!==Xr,(u!==i||d!==i.version||f!==e.toneMapping)&&(l.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),l.layers.enableAll(),t.unshift(l,l.geometry,l.material,0,0,null)):i&&i.isTexture&&(c===void 0&&(c=new ps(new Js(2,2),new rc({name:`BackgroundMaterial`,uniforms:Ys(ll.background.uniforms),vertexShader:ll.background.vertexShader,fragmentShader:ll.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute(`normal`),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=i,c.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,c.material.toneMapped=Yi.getTransfer(i.colorSpace)!==Xr,i.matrixAutoUpdate===!0&&i.updateMatrix(),c.material.uniforms.uvTransform.value.copy(i.matrix),(u!==i||d!==i.version||f!==e.toneMapping)&&(c.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),c.layers.enableAll(),t.unshift(c,c.geometry,c.material,0,0,null))}function g(t,r){t.getRGB(ul,$s(e)),n.buffers.color.setClear(ul.r,ul.g,ul.b,r,a)}function _(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(e,t=1){o.set(e),s=t,g(o,s)},getClearAlpha:function(){return s},setClearAlpha:function(e){s=e,g(o,s)},render:m,addToRenderList:h,dispose:_}}function ml(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),r={},i=f(null),a=i,o=!1;function s(n,r,i,s,c){let u=!1,f=d(n,s,i,r);a!==f&&(a=f,l(a.object)),u=p(n,s,i,c),u&&m(n,s,i,c),c!==null&&t.update(c,e.ELEMENT_ARRAY_BUFFER),(u||o)&&(o=!1,b(n,r,i,s),c!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(c).buffer))}function c(){return e.createVertexArray()}function l(t){return e.bindVertexArray(t)}function u(t){return e.deleteVertexArray(t)}function d(e,t,n,i){let a=i.wireframe===!0,o=r[t.id];o===void 0&&(o={},r[t.id]=o);let s=e.isInstancedMesh===!0?e.id:0,l=o[s];l===void 0&&(l={},o[s]=l);let u=l[n.id];u===void 0&&(u={},l[n.id]=u);let d=u[a];return d===void 0&&(d=f(c()),u[a]=d),d}function f(e){let t=[],r=[],i=[];for(let e=0;e<n;e++)t[e]=0,r[e]=0,i[e]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:t,enabledAttributes:r,attributeDivisors:i,object:e,attributes:{},index:null}}function p(e,t,n,r){let i=a.attributes,o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=i[t],r=o[t];if(r===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(r=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(r=e.instanceColor)),n===void 0||n.attribute!==r||r&&n.data!==r.data)return!0;s++}return a.attributesNum!==s||a.index!==r}function m(e,t,n,r){let i={},o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=o[t];n===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(n=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(n=e.instanceColor));let r={};r.attribute=n,n&&n.data&&(r.data=n.data),i[t]=r,s++}a.attributes=i,a.attributesNum=s,a.index=r}function h(){let e=a.newAttributes;for(let t=0,n=e.length;t<n;t++)e[t]=0}function g(e){_(e,0)}function _(t,n){let r=a.newAttributes,i=a.enabledAttributes,o=a.attributeDivisors;r[t]=1,i[t]===0&&(e.enableVertexAttribArray(t),i[t]=1),o[t]!==n&&(e.vertexAttribDivisor(t,n),o[t]=n)}function v(){let t=a.newAttributes,n=a.enabledAttributes;for(let r=0,i=n.length;r<i;r++)n[r]!==t[r]&&(e.disableVertexAttribArray(r),n[r]=0)}function y(t,n,r,i,a,o,s){s===!0?e.vertexAttribIPointer(t,n,r,a,o):e.vertexAttribPointer(t,n,r,i,a,o)}function b(n,r,i,a){h();let o=a.attributes,s=i.getAttributes(),c=r.defaultAttributeValues;for(let r in s){let i=s[r];if(i.location>=0){let s=o[r];if(s===void 0&&(r===`instanceMatrix`&&n.instanceMatrix&&(s=n.instanceMatrix),r===`instanceColor`&&n.instanceColor&&(s=n.instanceColor)),s!==void 0){let r=s.normalized,o=s.itemSize,c=t.get(s);if(c===void 0)continue;let l=c.buffer,u=c.type,d=c.bytesPerElement,f=u===e.INT||u===e.UNSIGNED_INT||s.gpuType===1013;if(s.isInterleavedBufferAttribute){let t=s.data,c=t.stride,p=s.offset;if(t.isInstancedInterleavedBuffer){for(let e=0;e<i.locationSize;e++)_(i.location+e,t.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=t.meshPerAttribute*t.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,c*d,(p+o/i.locationSize*e)*d,f)}else{if(s.isInstancedBufferAttribute){for(let e=0;e<i.locationSize;e++)_(i.location+e,s.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=s.meshPerAttribute*s.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,o*d,o/i.locationSize*e*d,f)}}else if(c!==void 0){let t=c[r];if(t!==void 0)switch(t.length){case 2:e.vertexAttrib2fv(i.location,t);break;case 3:e.vertexAttrib3fv(i.location,t);break;case 4:e.vertexAttrib4fv(i.location,t);break;default:e.vertexAttrib1fv(i.location,t)}}}}v()}function x(){T();for(let e in r){let t=r[e];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e]}}function S(e){if(r[e.id]===void 0)return;let t=r[e.id];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e.id]}function C(e){for(let t in r){let n=r[t];for(let t in n){let r=n[t];if(r[e.id]===void 0)continue;let i=r[e.id];for(let e in i)u(i[e].object),delete i[e];delete r[e.id]}}}function w(e){for(let t in r){let n=r[t],i=e.isInstancedMesh===!0?e.id:0,a=n[i];if(a!==void 0){for(let e in a){let t=a[e];for(let e in t)u(t[e].object),delete t[e];delete a[e]}delete n[i],Object.keys(n).length===0&&delete r[t]}}}function T(){E(),o=!0,a!==i&&(a=i,l(a.object))}function E(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:s,reset:T,resetDefaultState:E,dispose:x,releaseStatesOfGeometry:S,releaseStatesOfObject:w,releaseStatesOfProgram:C,initAttributes:h,enableAttribute:g,disableUnusedAttributes:v}}function hl(e,t,n){let r;function i(e){r=e}function a(t,i){e.drawArrays(r,t,i),n.update(i,r,1)}function o(t,i,a){a!==0&&(e.drawArraysInstanced(r,t,i,a),n.update(i,r,a))}function s(e,i,a){if(a===0)return;t.get(`WEBGL_multi_draw`).multiDrawArraysWEBGL(r,e,0,i,0,a);let o=0;for(let e=0;e<a;e++)o+=i[e];n.update(o,r,1)}this.setMode=i,this.render=a,this.renderInstances=o,this.renderMultiDraw=s}function gl(e,t,n,r){let i;function a(){if(i!==void 0)return i;if(t.has(`EXT_texture_filter_anisotropic`)===!0){let n=t.get(`EXT_texture_filter_anisotropic`);i=e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(t){return t===1023||r.convert(t)===e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT)}function s(n){let i=n===1016&&(t.has(`EXT_color_buffer_half_float`)||t.has(`EXT_color_buffer_float`));return!(n!==1009&&n!==1015&&!i&&r.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))}function c(t){if(t===`highp`){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return`highp`;t=`mediump`}return t===`mediump`&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?`mediump`:`lowp`}let l=n.precision===void 0?`highp`:n.precision,u=c(l);u!==l&&(Y(`WebGLRenderer:`,l,`not supported, using`,u,`instead.`),l=u);let d=n.logarithmicDepthBuffer===!0,f=n.reversedDepthBuffer===!0&&t.has(`EXT_clip_control`);n.reversedDepthBuffer===!0&&f===!1&&Y(`WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.`);let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),h=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),_=e.getParameter(e.MAX_VERTEX_ATTRIBS),v=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),y=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),S=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:s,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:f,maxTextures:p,maxVertexTextures:m,maxTextureSize:h,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:v,maxVaryings:y,maxFragmentUniforms:b,maxSamples:x,samples:S}}function _l(e){let t=this,n=null,r=0,i=!1,a=!1,o=new qo,s=new Wi,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(e,t){let n=e.length!==0||t||r!==0||i;return i=t,r=e.length,n},this.beginShadows=function(){a=!0,u(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(e,t){n=u(e,t,0)},this.setState=function(t,o,s){let d=t.clippingPlanes,f=t.clipIntersection,p=t.clipShadows,m=e.get(t);if(!i||d===null||d.length===0||a&&!p)a?u(null):l();else{let e=a?0:r,t=e*4,i=m.clippingState||null;c.value=i,i=u(d,o,t,s);for(let e=0;e!==t;++e)i[e]=n[e];m.clippingState=i,this.numIntersection=f?this.numPlanes:0,this.numPlanes+=e}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=r>0),t.numPlanes=r,t.numIntersection=0}function u(e,n,r,i){let a=e===null?0:e.length,l=null;if(a!==0){if(l=c.value,i!==!0||l===null){let t=r+a*4,i=n.matrixWorldInverse;s.getNormalMatrix(i),(l===null||l.length<t)&&(l=new Float32Array(t));for(let t=0,n=r;t!==a;++t,n+=4)o.copy(e[t]).applyMatrix4(i,s),o.normal.toArray(l,n),l[n+3]=o.constant}c.value=l,c.needsUpdate=!0}return t.numPlanes=a,t.numIntersection=0,l}}var vl=4,yl=6,bl=20,xl=256,Sl=new Pc,Cl=new Ka,wl=null,Tl=0,El=0,Dl=!1,Ol=new X,kl=new X,Al=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,r=100,i={}){let{size:a=256,position:o=Ol}=i;wl=this._renderer.getRenderTarget(),Tl=this._renderer.getActiveCubeFace(),El=this._renderer.getActiveMipmapLevel(),Dl=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,n,r,s,o),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Ll(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Il(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=2**this._lodMax}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(wl,Tl,El),this._renderer.xr.enabled=Dl,e.scissorTest=!1,Nl(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),wl=this._renderer.getRenderTarget(),Tl=this._renderer.getActiveCubeFace(),El=this._renderer.getActiveMipmapLevel(),Dl=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:jn,minFilter:jn,generateMipmaps:!1,type:Vn,format:Yn,colorSpace:Jr,depthBuffer:!1},r=Ml(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Ml(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=jl(r)),this._blurMaterial=Fl(r,e,t),this._ggxMaterial=Pl(r,e,t)}return r}_compileMaterial(e){let t=new ps(new Uo,e);this._renderer.compile(t,Sl)}_sceneToCubeUV(e,t,n,r,i){let a=new Nc(90,1,t,n),o=[1,-1,1,1,1,1],s=[1,1,1,-1,-1,-1],c=this._renderer,l=c.autoClear,u=c.toneMapping;c.getClearColor(Cl),c.toneMapping=0,c.autoClear=!1,c.state.buffers.depth.getReversed()&&(c.setRenderTarget(r),c.clearDepth(),c.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new ps(new Ks,new ts({name:`PMREM.Background`,side:1,depthWrite:!1,depthTest:!1})));let d=this._backgroundBox,f=d.material,p=!1,m=e.background;m?m.isColor&&(f.color.copy(m),e.background=null,p=!0):(f.color.copy(Cl),p=!0);for(let t=0;t<6;t++){let n=t%3;n===0?(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x+s[t],i.y,i.z)):n===1?(a.up.set(0,0,o[t]),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y+s[t],i.z)):(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y,i.z+s[t]));let l=this._cubeSize;Nl(r,n*l,t>2?l:0,l,l),c.setRenderTarget(r),p&&c.render(d,a),c.render(e,a)}c.toneMapping=u,c.autoClear=l,e.background=m}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===301||e.mapping===302;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Ll()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Il());let i=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=i;let o=i.uniforms;o.envMap.value=e;let s=this._cubeSize;Nl(t,0,0,3*s,2*s),n.setRenderTarget(t),n.render(a,Sl)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let t=1;t<r;t++)this._applyGGXFilter(e,t-1,t);t.autoClear=n}_applyGGXFilter(e,t,n){let r=this._renderer,i=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let s=a.uniforms,c=n/(this._lodMeshes.length-1),l=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-l*l)*(c*1.25),{_lodMax:d}=this,f=this._sizeLods[n],p=3*f*(n>d-vl?n-d+vl:0),m=4*(this._cubeSize-f);s.envMap.value=e.texture,s.roughness.value=u,s.mipInt.value=d-t,Nl(i,p,m,3*f,2*f),r.setRenderTarget(i),r.render(o,Sl),s.envMap.value=i.texture,s.roughness.value=0,s.mipInt.value=d-n,Nl(e,p,m,3*f,2*f),r.setRenderTarget(e),r.render(o,Sl)}_blur(e,t,n,r){let i=this._pingPongRenderTarget,a=Math.min(r,Math.PI)/Math.SQRT2;this._blurPass(e,i,t,n,a),this._blurPass(i,e,n,n,a)}_blurPass(e,t,n,r,i){let a=this._renderer,o=this._blurMaterial,s=this._lodMeshes[r];s.material=o;let c=o.uniforms;c.envMap.value=e.texture,c.sigma.value=i,c.mipInt.value=this._lodMax-n;let l=this._sizeLods[r];Nl(t,3*l*(r>this._lodMax-vl?r-this._lodMax+vl:0),4*(this._cubeSize-l),3*l,2*l),a.setRenderTarget(t),a.render(s,Sl)}};function jl(e){let t=[],n=[],r=e,i=e-vl+1+yl;for(let e=0;e<i;e++){let e=2**r;t.push(e);let i=1/(e-2),a=-i,o=1+i,s=[a,a,o,a,o,o,a,a,o,o,a,o],c=new Float32Array(108),l=new Float32Array(108);for(let e=0;e<6;e++){let t=e%3*2/3-1,n=e>2?0:-1,r=[t,n,0,t+2/3,n,0,t+2/3,n+1,0,t,n,0,t+2/3,n+1,0,t,n+1,0];c.set(r,18*e);for(let t=0;t<6;t++){let n=s[t*2]*2-1,r=s[t*2+1]*2-1;e===0?kl.set(1,r,n):e===1?kl.set(-n,1,-r):e===2?kl.set(-n,r,1):e===3?kl.set(-1,r,-n):e===4?kl.set(-n,-1,r):kl.set(n,r,-1),kl.toArray(l,(e*6+t)*3)}}let u=new Uo;u.setAttribute(`position`,new Oo(c,3)),u.setAttribute(`outputDirection`,new Oo(l,3)),n.push(new ps(u,null)),r>vl&&r--}return{lodMeshes:n,sizeLods:t}}function Ml(e,t,n){let r=new ca(e,t,n);return r.texture.mapping=306,r.texture.name=`PMREM.cubeUv`,r.scissorTest=!0,r}function Nl(e,t,n,r,i){e.viewport.set(t,n,r,i),e.scissor.set(t,n,r,i)}function Pl(e,t,n){return new rc({name:`PMREMGGXConvolution`,defines:{GGX_SAMPLES:xl,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Rl(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Fl(e,t,n){return new rc({name:`SphericalGaussianBlur`,defines:{SAMPLES:bl,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Rl(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Il(){return new rc({name:`EquirectangularToCubeUV`,uniforms:{envMap:{value:null}},vertexShader:Rl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Ll(){return new rc({name:`CubemapToCubeUV`,uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Rl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Rl(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var zl=class extends ca{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new Hs(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new Ks(5,5,5),i=new rc({name:`CubemapFromEquirect`,uniforms:Ys(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});i.uniforms.tEquirect.value=t;let a=new ps(r,i),o=t.minFilter;return t.minFilter===1008&&(t.minFilter=jn),new Rc(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let i=e.getRenderTarget();for(let i=0;i<6;i++)e.setRenderTarget(this,i),e.clear(t,n,r);e.setRenderTarget(i)}};function Bl(e){let t=new WeakMap,n=new WeakMap,r=null;function i(e,t=!1){return e==null?null:t?o(e):a(e)}function a(n){if(n&&n.isTexture){let r=n.mapping;if(r===303||r===304){if(t.has(n)){let e=t.get(n).texture;return s(e,n.mapping)}{let r=n.image;if(r&&r.height>0){let i=new zl(r.height);return i.fromEquirectangularTexture(e,n),t.set(n,i),n.addEventListener(`dispose`,l),s(i.texture,n.mapping)}return null}}}return n}function o(t){if(t&&t.isTexture){let i=t.mapping,a=i===303||i===304,o=i===301||i===302;if(a||o){let i=n.get(t),s=i===void 0?0:i.texture.pmremVersion;if(t.isRenderTargetTexture&&t.pmremVersion!==s)return r===null&&(r=new Al(e)),i=a?r.fromEquirectangular(t,i):r.fromCubemap(t,i),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),i.texture;if(i!==void 0)return i.texture;{let s=t.image;return a&&s&&s.height>0||o&&s&&c(s)?(r===null&&(r=new Al(e)),i=a?r.fromEquirectangular(t):r.fromCubemap(t),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),t.addEventListener(`dispose`,u),i.texture):null}}}return t}function s(e,t){return t===303?e.mapping=301:t===304&&(e.mapping=302),e}function c(e){let t=0;for(let n=0;n<6;n++)e[n]!==void 0&&t++;return t===6}function l(e){let n=e.target;n.removeEventListener(`dispose`,l);let r=t.get(n);r!==void 0&&(t.delete(n),r.dispose())}function u(e){let t=e.target;t.removeEventListener(`dispose`,u);let r=n.get(t);r!==void 0&&(n.delete(t),r.dispose())}function d(){t=new WeakMap,n=new WeakMap,r!==null&&(r.dispose(),r=null)}return{get:i,dispose:d}}function Vl(e){let t={};function n(n){if(t[n]!==void 0)return t[n];let r=e.getExtension(n);return t[n]=r,r}return{has:function(e){return n(e)!==null},init:function(){n(`EXT_color_buffer_float`),n(`WEBGL_clip_cull_distance`),n(`OES_texture_float_linear`),n(`EXT_color_buffer_half_float`),n(`WEBGL_multisampled_render_to_texture`),n(`WEBGL_render_shared_exponent`)},get:function(e){let t=n(e);return t===null&&li(`WebGLRenderer: `+e+` extension not supported.`),t}}}function Hl(e,t,n,r){let i={},a=new WeakMap;function o(e){let s=e.target;s.index!==null&&t.remove(s.index);for(let e in s.attributes)t.remove(s.attributes[e]);s.removeEventListener(`dispose`,o),delete i[s.id];let c=a.get(s);c&&(t.remove(c),a.delete(s)),r.releaseStatesOfGeometry(s),s.isInstancedBufferGeometry===!0&&delete s._maxInstanceCount,n.memory.geometries--}function s(e,t){return i[t.id]===!0||(t.addEventListener(`dispose`,o),i[t.id]=!0,n.memory.geometries++),t}function c(n){let r=n.attributes;for(let n in r)t.update(r[n],e.ARRAY_BUFFER)}function l(e){let n=[],r=e.index,i=e.attributes.position,o=0;if(i===void 0)return;if(r!==null){let e=r.array;o=r.version;for(let t=0,r=e.length;t<r;t+=3){let r=e[t+0],i=e[t+1],a=e[t+2];n.push(r,i,i,a,a,r)}}else{let e=i.array;o=i.version;for(let t=0,r=e.length/3-1;t<r;t+=3){let e=t+0,r=t+1,i=t+2;n.push(e,r,r,i,i,e)}}let s=new(i.count>=65535?Ao:ko)(n,1);s.version=o;let c=a.get(e);c&&t.remove(c),a.set(e,s)}function u(e){let t=a.get(e);if(t){let n=e.index;n!==null&&t.version<n.version&&l(e)}else l(e);return a.get(e)}return{get:s,update:c,getWireframeAttribute:u}}function Ul(e,t,n){let r;function i(e){r=e}let a,o;function s(e){a=e.type,o=e.bytesPerElement}function c(t,i){e.drawElements(r,i,a,t*o),n.update(i,r,1)}function l(t,i,s){s!==0&&(e.drawElementsInstanced(r,i,a,t*o,s),n.update(i,r,s))}function u(e,i,o){if(o===0)return;t.get(`WEBGL_multi_draw`).multiDrawElementsWEBGL(r,i,0,a,e,0,o);let s=0;for(let e=0;e<o;e++)s+=i[e];n.update(s,r,1)}this.setMode=i,this.setIndex=s,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function Wl(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function r(t,r,i){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=t/3*i;break;case e.LINES:n.lines+=t/2*i;break;case e.LINE_STRIP:n.lines+=i*(t-1);break;case e.LINE_LOOP:n.lines+=i*t;break;case e.POINTS:n.points+=i*t;break;default:ci(`WebGLInfo: Unknown draw mode:`,r)}}function i(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:i,update:r}}function Gl(e,t,n){let r=new WeakMap,i=new oa;function a(a,o,s){let c=a.morphTargetInfluences,l=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=l===void 0?0:l.length,d=r.get(o);if(d===void 0||d.count!==u){d!==void 0&&d.texture.dispose();let e=o.morphAttributes.position!==void 0,n=o.morphAttributes.normal!==void 0,a=o.morphAttributes.color!==void 0,s=o.morphAttributes.position||[],c=o.morphAttributes.normal||[],l=o.morphAttributes.color||[],f=0;e===!0&&(f=1),n===!0&&(f=2),a===!0&&(f=3);let p=o.attributes.position.count*f,m=1;p>t.maxTextureSize&&(m=Math.ceil(p/t.maxTextureSize),p=t.maxTextureSize);let h=new Float32Array(p*m*4*u),g=new la(h,p,m,u);g.type=Bn,g.needsUpdate=!0;let _=f*4;for(let t=0;t<u;t++){let r=s[t],o=c[t],u=l[t],d=p*m*4*t;for(let t=0;t<r.count;t++){let s=t*_;e===!0&&(i.fromBufferAttribute(r,t),h[d+s+0]=i.x,h[d+s+1]=i.y,h[d+s+2]=i.z,h[d+s+3]=0),n===!0&&(i.fromBufferAttribute(o,t),h[d+s+4]=i.x,h[d+s+5]=i.y,h[d+s+6]=i.z,h[d+s+7]=0),a===!0&&(i.fromBufferAttribute(u,t),h[d+s+8]=i.x,h[d+s+9]=i.y,h[d+s+10]=i.z,h[d+s+11]=u.itemSize===4?i.w:1)}}d={count:u,texture:g,size:new Bi(p,m)},r.set(o,d);function v(){g.dispose(),r.delete(o),o.removeEventListener(`dispose`,v)}o.addEventListener(`dispose`,v)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)s.getUniforms().setValue(e,`morphTexture`,a.morphTexture,n);else{let t=0;for(let e=0;e<c.length;e++)t+=c[e];let n=o.morphTargetsRelative?1:1-t;s.getUniforms().setValue(e,`morphTargetBaseInfluence`,n),s.getUniforms().setValue(e,`morphTargetInfluences`,c)}s.getUniforms().setValue(e,`morphTargetsTexture`,d.texture,n),s.getUniforms().setValue(e,`morphTargetsTextureSize`,d.size)}return{update:a}}function Kl(e,t,n,r,i){let a=new WeakMap;function o(r){let o=i.render.frame,s=r.geometry,l=t.get(r,s);if(a.get(l)!==o&&(t.update(l),a.set(l,o)),r.isInstancedMesh&&(r.hasEventListener(`dispose`,c)===!1&&r.addEventListener(`dispose`,c),a.get(r)!==o&&(n.update(r.instanceMatrix,e.ARRAY_BUFFER),r.instanceColor!==null&&n.update(r.instanceColor,e.ARRAY_BUFFER),a.set(r,o))),r.isSkinnedMesh){let e=r.skeleton;a.get(e)!==o&&(e.update(),a.set(e,o))}return l}function s(){a=new WeakMap}function c(e){let t=e.target;t.removeEventListener(`dispose`,c),r.releaseStatesOfObject(t),n.remove(t.instanceMatrix),t.instanceColor!==null&&n.remove(t.instanceColor)}return{update:o,dispose:s}}var ql={1:`LINEAR_TONE_MAPPING`,2:`REINHARD_TONE_MAPPING`,3:`CINEON_TONE_MAPPING`,4:`ACES_FILMIC_TONE_MAPPING`,6:`AGX_TONE_MAPPING`,7:`NEUTRAL_TONE_MAPPING`,5:`CUSTOM_TONE_MAPPING`};function Jl(e,t,n,r,i,a){let o=new ca(t,n,{type:e,depthBuffer:i,stencilBuffer:a,samples:r?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),s=null,c=null,l=new Uo;l.setAttribute(`position`,new jo([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute(`uv`,new jo([0,2,0,0,2,0],2));let u=new ic({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new ps(l,u),f=new Pc(-1,1,1,-1,0,1),p=null,m=null,h=!1,g,_=null,v=[],y=!1;this.setSize=function(e,t){o.setSize(e,t),s!==null&&s.setSize(e,t),c!==null&&c.setSize(e,t);for(let n=0;n<v.length;n++){let r=v[n];r.setSize&&r.setSize(e,t)}},this.setEffects=function(e){v=e,y=v.length>0&&v[0].isRenderPass===!0;let t=o.width,n=o.height;v.length>0&&s===null&&(s=new ca(t,n,{type:Vn,depthBuffer:!1,stencilBuffer:!1}),c=new ca(t,n,{type:Vn,depthBuffer:!1,stencilBuffer:!1}));for(let e=0;e<v.length;e++){let r=v[e];r.setSize&&r.setSize(t,n)}},this.begin=function(e,t){if(h||e.toneMapping===0&&v.length===0)return!1;if(_=t,t!==null){let e=t.width,n=t.height;(o.width!==e||o.height!==n)&&this.setSize(e,n)}return y===!1&&e.setRenderTarget(o),g=e.toneMapping,e.toneMapping=0,!0},this.hasRenderPass=function(){return y},this.end=function(e,t){e.toneMapping=g,h=!0;let n=o,r=s;for(let i=0;i<v.length;i++){let a=v[i];a.enabled!==!1&&(a.render(e,r,n,t),a.needsSwap!==!1&&(n=r,r=r===s?c:s))}if(p!==e.outputColorSpace||m!==e.toneMapping){p=e.outputColorSpace,m=e.toneMapping,u.defines={},Yi.getTransfer(p)===`srgb`&&(u.defines.SRGB_TRANSFER=``);let t=ql[m];t&&(u.defines[t]=``),u.needsUpdate=!0}u.uniforms.tDiffuse.value=n.texture,e.setRenderTarget(_),e.render(d,f),_=null,h=!1},this.isCompositing=function(){return h},this.dispose=function(){o.dispose(),s!==null&&s.dispose(),c!==null&&c.dispose(),l.dispose(),u.dispose()}}var Yl=new aa,Xl=new Us(1,1),Zl=new la,Ql=new ua,$l=new Hs,eu=[],tu=[],nu=new Float32Array(16),ru=new Float32Array(9),iu=new Float32Array(4);function au(e,t,n){let r=e[0];if(r<=0||r>0)return e;let i=t*n,a=eu[i];if(a===void 0&&(a=new Float32Array(i),eu[i]=a),t!==0){r.toArray(a,0);for(let r=1,i=0;r!==t;++r)i+=n,e[r].toArray(a,i)}return a}function ou(e,t){if(e.length!==t.length)return!1;for(let n=0,r=e.length;n<r;n++)if(e[n]!==t[n])return!1;return!0}function su(e,t){for(let n=0,r=t.length;n<r;n++)e[n]=t[n]}function cu(e,t){let n=tu[t];n===void 0&&(n=new Int32Array(t),tu[t]=n);for(let r=0;r!==t;++r)n[r]=e.allocateTextureUnit();return n}function lu(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function uu(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(ou(n,t))return;e.uniform2fv(this.addr,t),su(n,t)}}function du(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(ou(n,t))return;e.uniform3fv(this.addr,t),su(n,t)}}function fu(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(ou(n,t))return;e.uniform4fv(this.addr,t),su(n,t)}}function pu(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(ou(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),su(n,t)}else{if(ou(n,r))return;iu.set(r),e.uniformMatrix2fv(this.addr,!1,iu),su(n,r)}}function mu(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(ou(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),su(n,t)}else{if(ou(n,r))return;ru.set(r),e.uniformMatrix3fv(this.addr,!1,ru),su(n,r)}}function hu(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(ou(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),su(n,t)}else{if(ou(n,r))return;nu.set(r),e.uniformMatrix4fv(this.addr,!1,nu),su(n,r)}}function gu(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function _u(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(ou(n,t))return;e.uniform2iv(this.addr,t),su(n,t)}}function vu(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(ou(n,t))return;e.uniform3iv(this.addr,t),su(n,t)}}function yu(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(ou(n,t))return;e.uniform4iv(this.addr,t),su(n,t)}}function bu(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function xu(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(ou(n,t))return;e.uniform2uiv(this.addr,t),su(n,t)}}function Su(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(ou(n,t))return;e.uniform3uiv(this.addr,t),su(n,t)}}function Cu(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(ou(n,t))return;e.uniform4uiv(this.addr,t),su(n,t)}}function wu(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i);let a;this.type===e.SAMPLER_2D_SHADOW?(Xl.compareFunction=n.isReversedDepthBuffer()?518:515,a=Xl):a=Yl,n.setTexture2D(t||a,i)}function Tu(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture3D(t||Ql,i)}function Eu(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTextureCube(t||$l,i)}function Du(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture2DArray(t||Zl,i)}function Ou(e){switch(e){case 5126:return lu;case 35664:return uu;case 35665:return du;case 35666:return fu;case 35674:return pu;case 35675:return mu;case 35676:return hu;case 5124:case 35670:return gu;case 35667:case 35671:return _u;case 35668:case 35672:return vu;case 35669:case 35673:return yu;case 5125:return bu;case 36294:return xu;case 36295:return Su;case 36296:return Cu;case 35678:case 36198:case 36298:case 36306:case 35682:return wu;case 35679:case 36299:case 36307:return Tu;case 35680:case 36300:case 36308:case 36293:return Eu;case 36289:case 36303:case 36311:case 36292:return Du}}function ku(e,t){e.uniform1fv(this.addr,t)}function Au(e,t){let n=au(t,this.size,2);e.uniform2fv(this.addr,n)}function ju(e,t){let n=au(t,this.size,3);e.uniform3fv(this.addr,n)}function Mu(e,t){let n=au(t,this.size,4);e.uniform4fv(this.addr,n)}function Nu(e,t){let n=au(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function Pu(e,t){let n=au(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function Fu(e,t){let n=au(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function Iu(e,t){e.uniform1iv(this.addr,t)}function Lu(e,t){e.uniform2iv(this.addr,t)}function Ru(e,t){e.uniform3iv(this.addr,t)}function zu(e,t){e.uniform4iv(this.addr,t)}function Bu(e,t){e.uniform1uiv(this.addr,t)}function Vu(e,t){e.uniform2uiv(this.addr,t)}function Hu(e,t){e.uniform3uiv(this.addr,t)}function Uu(e,t){e.uniform4uiv(this.addr,t)}function Wu(e,t,n){let r=this.cache,i=t.length,a=cu(n,i);ou(r,a)||(e.uniform1iv(this.addr,a),su(r,a));let o;o=this.type===e.SAMPLER_2D_SHADOW?Xl:Yl;for(let e=0;e!==i;++e)n.setTexture2D(t[e]||o,a[e])}function Gu(e,t,n){let r=this.cache,i=t.length,a=cu(n,i);ou(r,a)||(e.uniform1iv(this.addr,a),su(r,a));for(let e=0;e!==i;++e)n.setTexture3D(t[e]||Ql,a[e])}function Ku(e,t,n){let r=this.cache,i=t.length,a=cu(n,i);ou(r,a)||(e.uniform1iv(this.addr,a),su(r,a));for(let e=0;e!==i;++e)n.setTextureCube(t[e]||$l,a[e])}function qu(e,t,n){let r=this.cache,i=t.length,a=cu(n,i);ou(r,a)||(e.uniform1iv(this.addr,a),su(r,a));for(let e=0;e!==i;++e)n.setTexture2DArray(t[e]||Zl,a[e])}function Ju(e){switch(e){case 5126:return ku;case 35664:return Au;case 35665:return ju;case 35666:return Mu;case 35674:return Nu;case 35675:return Pu;case 35676:return Fu;case 5124:case 35670:return Iu;case 35667:case 35671:return Lu;case 35668:case 35672:return Ru;case 35669:case 35673:return zu;case 5125:return Bu;case 36294:return Vu;case 36295:return Hu;case 36296:return Uu;case 35678:case 36198:case 36298:case 36306:case 35682:return Wu;case 35679:case 36299:case 36307:return Gu;case 35680:case 36300:case 36308:case 36293:return Ku;case 36289:case 36303:case 36311:case 36292:return qu}}var Yu=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=Ou(t.type)}},Xu=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Ju(t.type)}},Zu=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let i=0,a=r.length;i!==a;++i){let a=r[i];a.setValue(e,t[a.id],n)}}},Qu=/(\w+)(\])?(\[|\.)?/g;function $u(e,t){e.seq.push(t),e.map[t.id]=t}function ed(e,t,n){let r=e.name,i=r.length;for(Qu.lastIndex=0;;){let a=Qu.exec(r),o=Qu.lastIndex,s=a[1],c=a[2]===`]`,l=a[3];if(c&&(s|=0),l===void 0||l===`[`&&o+2===i){$u(n,l===void 0?new Yu(s,e,t):new Xu(s,e,t));break}{let e=n.map[s];e===void 0&&(e=new Zu(s),$u(n,e)),n=e}}}var td=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let n=e.getActiveUniform(t,r);ed(n,e.getUniformLocation(t,n.name),this)}let r=[],i=[];for(let t of this.seq)t.type===e.SAMPLER_2D_SHADOW||t.type===e.SAMPLER_CUBE_SHADOW||t.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(t):i.push(t);r.length>0&&(this.seq=r.concat(i))}setValue(e,t,n,r){let i=this.map[t];i!==void 0&&i.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let i=0,a=t.length;i!==a;++i){let a=t[i],o=n[a.id];o.needsUpdate!==!1&&a.setValue(e,o.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,i=e.length;r!==i;++r){let i=e[r];i.id in t&&n.push(i)}return n}};function nd(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}var rd=37297,id=0;function ad(e,t){let n=e.split(`
`),r=[],i=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let e=i;e<a;e++){let i=e+1;r.push(`${i===t?`>`:` `} ${i}: ${n[e]}`)}return r.join(`
`)}var od=new Wi;function sd(e){Yi._getMatrix(od,Yi.workingColorSpace,e);let t=`mat3( ${od.elements.map(e=>e.toFixed(4))} )`;switch(Yi.getTransfer(e)){case Yr:return[t,`LinearTransferOETF`];case Xr:return[t,`sRGBTransferOETF`];default:return Y(`WebGLProgram: Unsupported color space: `,e),[t,`LinearTransferOETF`]}}function cd(e,t,n){let r=e.getShaderParameter(t,e.COMPILE_STATUS),i=(e.getShaderInfoLog(t)||``).trim();if(r&&i===``)return``;let a=/ERROR: 0:(\d+)/.exec(i);if(a){let r=parseInt(a[1]);return n.toUpperCase()+`

`+i+`

`+ad(e.getShaderSource(t),r)}return i}function ld(e,t){let n=sd(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,`}`].join(`
`)}var ud={1:`Linear`,2:`Reinhard`,3:`Cineon`,4:`ACESFilmic`,6:`AgX`,7:`Neutral`,5:`Custom`};function dd(e,t){let n=ud[t];return n===void 0?(Y(`WebGLProgram: Unsupported toneMapping:`,t),`vec3 `+e+`( vec3 color ) { return LinearToneMapping( color ); }`):`vec3 `+e+`( vec3 color ) { return `+n+`ToneMapping( color ); }`}var fd=new X;function pd(){return Yi.getLuminanceCoefficients(fd),[`float luminance( const in vec3 rgb ) {`,`	const vec3 weights = vec3( ${fd.x.toFixed(4)}, ${fd.y.toFixed(4)}, ${fd.z.toFixed(4)} );`,`	return dot( weights, rgb );`,`}`].join(`
`)}function md(e){return[e.extensionClipCullDistance?`#extension GL_ANGLE_clip_cull_distance : require`:``,e.extensionMultiDraw?`#extension GL_ANGLE_multi_draw : require`:``].filter(_d).join(`
`)}function hd(e){let t=[];for(let n in e){let r=e[n];r!==!1&&t.push(`#define `+n+` `+r)}return t.join(`
`)}function gd(e,t){let n={},r=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let i=0;i<r;i++){let r=e.getActiveAttrib(t,i),a=r.name,o=1;r.type===e.FLOAT_MAT2&&(o=2),r.type===e.FLOAT_MAT3&&(o=3),r.type===e.FLOAT_MAT4&&(o=4),n[a]={type:r.type,location:e.getAttribLocation(t,a),locationSize:o}}return n}function _d(e){return e!==``}function vd(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function yd(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var bd=/^[ \t]*#include +<([\w\d./]+)>/gm;function xd(e){return e.replace(bd,Cd)}var Sd=new Map;function Cd(e,t){let n=cl[t];if(n===void 0){let e=Sd.get(t);if(e!==void 0)n=cl[e],Y(`WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.`,t,e);else throw Error(`THREE.WebGLProgram: Can not resolve #include <`+t+`>`)}return xd(n)}var wd=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Td(e){return e.replace(wd,Ed)}function Ed(e,t,n,r){let i=``;for(let e=parseInt(t);e<parseInt(n);e++)i+=r.replace(/\[\s*i\s*\]/g,`[ `+e+` ]`).replace(/UNROLLED_LOOP_INDEX/g,e);return i}function Dd(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision===`highp`?t+=`
#define HIGH_PRECISION`:e.precision===`mediump`?t+=`
#define MEDIUM_PRECISION`:e.precision===`lowp`&&(t+=`
#define LOW_PRECISION`),t}var Od={1:`SHADOWMAP_TYPE_PCF`,3:`SHADOWMAP_TYPE_VSM`};function kd(e){return Od[e.shadowMapType]||`SHADOWMAP_TYPE_BASIC`}var Ad={301:`ENVMAP_TYPE_CUBE`,302:`ENVMAP_TYPE_CUBE`,306:`ENVMAP_TYPE_CUBE_UV`};function jd(e){return e.envMap===!1?`ENVMAP_TYPE_CUBE`:Ad[e.envMapMode]||`ENVMAP_TYPE_CUBE`}var Md={302:`ENVMAP_MODE_REFRACTION`};function Nd(e){return e.envMap===!1?`ENVMAP_MODE_REFLECTION`:Md[e.envMapMode]||`ENVMAP_MODE_REFLECTION`}var Pd={0:`ENVMAP_BLENDING_MULTIPLY`,1:`ENVMAP_BLENDING_MIX`,2:`ENVMAP_BLENDING_ADD`};function Fd(e){return e.envMap===!1?`ENVMAP_BLENDING_NONE`:Pd[e.combine]||`ENVMAP_BLENDING_NONE`}function Id(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,r=1/t;return{texelWidth:1/(3*Math.max(2**n,112)),texelHeight:r,maxMip:n}}function Ld(e,t,n,r){let i=e.getContext(),a=n.defines,o=n.vertexShader,s=n.fragmentShader,c=kd(n),l=jd(n),u=Nd(n),d=Fd(n),f=Id(n),p=md(n),m=hd(a),h=i.createProgram(),g,_,v=n.glslVersion?`#version `+n.glslVersion+`
`:``;n.isRawShaderMaterial?(g=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(_d).join(`
`),g.length>0&&(g+=`
`),_=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(_d).join(`
`),_.length>0&&(_+=`
`)):(g=[Dd(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.extensionClipCullDistance?`#define USE_CLIP_DISTANCE`:``,n.batching?`#define USE_BATCHING`:``,n.batchingColor?`#define USE_BATCHING_COLOR`:``,n.instancing?`#define USE_INSTANCING`:``,n.instancingColor?`#define USE_INSTANCING_COLOR`:``,n.instancingMorph?`#define USE_INSTANCING_MORPH`:``,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.map?`#define USE_MAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+u:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.displacementMap?`#define USE_DISPLACEMENTMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.mapUv?`#define MAP_UV `+n.mapUv:``,n.alphaMapUv?`#define ALPHAMAP_UV `+n.alphaMapUv:``,n.lightMapUv?`#define LIGHTMAP_UV `+n.lightMapUv:``,n.aoMapUv?`#define AOMAP_UV `+n.aoMapUv:``,n.emissiveMapUv?`#define EMISSIVEMAP_UV `+n.emissiveMapUv:``,n.bumpMapUv?`#define BUMPMAP_UV `+n.bumpMapUv:``,n.normalMapUv?`#define NORMALMAP_UV `+n.normalMapUv:``,n.displacementMapUv?`#define DISPLACEMENTMAP_UV `+n.displacementMapUv:``,n.metalnessMapUv?`#define METALNESSMAP_UV `+n.metalnessMapUv:``,n.roughnessMapUv?`#define ROUGHNESSMAP_UV `+n.roughnessMapUv:``,n.anisotropyMapUv?`#define ANISOTROPYMAP_UV `+n.anisotropyMapUv:``,n.clearcoatMapUv?`#define CLEARCOATMAP_UV `+n.clearcoatMapUv:``,n.clearcoatNormalMapUv?`#define CLEARCOAT_NORMALMAP_UV `+n.clearcoatNormalMapUv:``,n.clearcoatRoughnessMapUv?`#define CLEARCOAT_ROUGHNESSMAP_UV `+n.clearcoatRoughnessMapUv:``,n.iridescenceMapUv?`#define IRIDESCENCEMAP_UV `+n.iridescenceMapUv:``,n.iridescenceThicknessMapUv?`#define IRIDESCENCE_THICKNESSMAP_UV `+n.iridescenceThicknessMapUv:``,n.sheenColorMapUv?`#define SHEEN_COLORMAP_UV `+n.sheenColorMapUv:``,n.sheenRoughnessMapUv?`#define SHEEN_ROUGHNESSMAP_UV `+n.sheenRoughnessMapUv:``,n.specularMapUv?`#define SPECULARMAP_UV `+n.specularMapUv:``,n.specularColorMapUv?`#define SPECULAR_COLORMAP_UV `+n.specularColorMapUv:``,n.specularIntensityMapUv?`#define SPECULAR_INTENSITYMAP_UV `+n.specularIntensityMapUv:``,n.transmissionMapUv?`#define TRANSMISSIONMAP_UV `+n.transmissionMapUv:``,n.thicknessMapUv?`#define THICKNESSMAP_UV `+n.thicknessMapUv:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexNormals?`#define HAS_NORMAL`:``,n.vertexColors?`#define USE_COLOR`:``,n.vertexAlphas?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.flatShading?`#define FLAT_SHADED`:``,n.skinning?`#define USE_SKINNING`:``,n.morphTargets?`#define USE_MORPHTARGETS`:``,n.morphNormals&&n.flatShading===!1?`#define USE_MORPHNORMALS`:``,n.morphColors?`#define USE_MORPHCOLORS`:``,n.morphTargetsCount>0?`#define MORPHTARGETS_TEXTURE_STRIDE `+n.morphTextureStride:``,n.morphTargetsCount>0?`#define MORPHTARGETS_COUNT `+n.morphTargetsCount:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.sizeAttenuation?`#define USE_SIZEATTENUATION`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 modelMatrix;`,`uniform mat4 modelViewMatrix;`,`uniform mat4 projectionMatrix;`,`uniform mat4 viewMatrix;`,`uniform mat3 normalMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,`#ifdef USE_INSTANCING`,`	attribute mat4 instanceMatrix;`,`#endif`,`#ifdef USE_INSTANCING_COLOR`,`	attribute vec3 instanceColor;`,`#endif`,`#ifdef USE_INSTANCING_MORPH`,`	uniform sampler2D morphTexture;`,`#endif`,`attribute vec3 position;`,`attribute vec3 normal;`,`attribute vec2 uv;`,`#ifdef USE_UV1`,`	attribute vec2 uv1;`,`#endif`,`#ifdef USE_UV2`,`	attribute vec2 uv2;`,`#endif`,`#ifdef USE_UV3`,`	attribute vec2 uv3;`,`#endif`,`#ifdef USE_TANGENT`,`	attribute vec4 tangent;`,`#endif`,`#if defined( USE_COLOR_ALPHA )`,`	attribute vec4 color;`,`#elif defined( USE_COLOR )`,`	attribute vec3 color;`,`#endif`,`#ifdef USE_SKINNING`,`	attribute vec4 skinIndex;`,`	attribute vec4 skinWeight;`,`#endif`,`
`].filter(_d).join(`
`),_=[Dd(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.alphaToCoverage?`#define ALPHA_TO_COVERAGE`:``,n.map?`#define USE_MAP`:``,n.matcap?`#define USE_MATCAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+l:``,n.envMap?`#define `+u:``,n.envMap?`#define `+d:``,f?`#define CUBEUV_TEXEL_WIDTH `+f.texelWidth:``,f?`#define CUBEUV_TEXEL_HEIGHT `+f.texelHeight:``,f?`#define CUBEUV_MAX_MIP `+f.maxMip+`.0`:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.packedNormalMap?`#define USE_PACKED_NORMALMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoat?`#define USE_CLEARCOAT`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.dispersion?`#define USE_DISPERSION`:``,n.retroreflection?`#define USE_RETROREFLECTION`:``,n.iridescence?`#define USE_IRIDESCENCE`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaTest?`#define USE_ALPHATEST`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.sheen?`#define USE_SHEEN`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexColors||n.instancingColor?`#define USE_COLOR`:``,n.vertexAlphas||n.batchingColor?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.gradientMap?`#define USE_GRADIENTMAP`:``,n.flatShading?`#define FLAT_SHADED`:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.premultipliedAlpha?`#define PREMULTIPLIED_ALPHA`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.numLightProbeGrids>0?`#define USE_LIGHT_PROBES_GRID`:``,n.decodeVideoTexture?`#define DECODE_VIDEO_TEXTURE`:``,n.decodeVideoTextureEmissive?`#define DECODE_VIDEO_TEXTURE_EMISSIVE`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 viewMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,n.toneMapping===0?``:`#define TONE_MAPPING`,n.toneMapping===0?``:cl.tonemapping_pars_fragment,n.toneMapping===0?``:dd(`toneMapping`,n.toneMapping),n.dithering?`#define DITHERING`:``,n.opaque?`#define OPAQUE`:``,cl.colorspace_pars_fragment,ld(`linearToOutputTexel`,n.outputColorSpace),pd(),n.useDepthPacking?`#define DEPTH_PACKING `+n.depthPacking:``,`
`].filter(_d).join(`
`)),o=xd(o),o=vd(o,n),o=yd(o,n),s=xd(s),s=vd(s,n),s=yd(s,n),o=Td(o),s=Td(s),n.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,g=[p,`#define attribute in`,`#define varying out`,`#define texture2D texture`].join(`
`)+`
`+g,_=[`#define varying in`,n.glslVersion===`300 es`?``:`layout(location = 0) out highp vec4 pc_fragColor;`,n.glslVersion===`300 es`?``:`#define gl_FragColor pc_fragColor`,`#define gl_FragDepthEXT gl_FragDepth`,`#define texture2D texture`,`#define textureCube texture`,`#define texture2DProj textureProj`,`#define texture2DLodEXT textureLod`,`#define texture2DProjLodEXT textureProjLod`,`#define textureCubeLodEXT textureLod`,`#define texture2DGradEXT textureGrad`,`#define texture2DProjGradEXT textureProjGrad`,`#define textureCubeGradEXT textureGrad`].join(`
`)+`
`+_);let y=v+g+o,b=v+_+s,x=nd(i,i.VERTEX_SHADER,y),S=nd(i,i.FRAGMENT_SHADER,b);i.attachShader(h,x),i.attachShader(h,S),n.index0AttributeName===void 0?n.hasPositionAttribute===!0&&i.bindAttribLocation(h,0,`position`):i.bindAttribLocation(h,0,n.index0AttributeName),i.linkProgram(h);function C(t){if(e.debug.checkShaderErrors){let n=i.getProgramInfoLog(h)||``,r=i.getShaderInfoLog(x)||``,a=i.getShaderInfoLog(S)||``,o=n.trim(),s=r.trim(),c=a.trim(),l=!0,u=!0;if(i.getProgramParameter(h,i.LINK_STATUS)===!1){if(l=!1,typeof e.debug.onShaderError==`function`)e.debug.onShaderError(i,h,x,S);else{let e=cd(i,x,`vertex`),n=cd(i,S,`fragment`);ci(`WebGLProgram: Shader Error `+i.getError()+` - VALIDATE_STATUS `+i.getProgramParameter(h,i.VALIDATE_STATUS)+`

Material Name: `+t.name+`
Material Type: `+t.type+`

Program Info Log: `+o+`
`+e+`
`+n)}}else o===``?(s===``||c===``)&&(u=!1):Y(`WebGLProgram: Program Info Log:`,o);u&&(t.diagnostics={runnable:l,programLog:o,vertexShader:{log:s,prefix:g},fragmentShader:{log:c,prefix:_}})}i.deleteShader(x),i.deleteShader(S),w=new td(i,h),T=gd(i,h)}let w;this.getUniforms=function(){return w===void 0&&C(this),w};let T;this.getAttributes=function(){return T===void 0&&C(this),T};let E=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return E===!1&&(E=i.getProgramParameter(h,rd)),E},this.destroy=function(){r.releaseStatesOfProgram(this),i.deleteProgram(h),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=id++,this.cacheKey=t,this.usedTimes=1,this.program=h,this.vertexShader=x,this.fragmentShader=S,this}var Rd=0,zd=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(n)===!1&&(r.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let e of t)e.usedTimes--,e.usedTimes===0&&this.shaderCache.delete(e.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new Bd(e),t.set(e,n)),n}},Bd=class{constructor(e){this.id=Rd++,this.code=e,this.usedTimes=0}};function Vd(e){return e===1030||e===37490||e===36285}function Hd(e,t,n,r,i,a){let o=new Sa,s=new zd,c=new Set,l=[],u=new Map,d=r.logarithmicDepthBuffer,f=r.precision,p={MeshDepthMaterial:`depth`,MeshDistanceMaterial:`distance`,MeshNormalMaterial:`normal`,MeshBasicMaterial:`basic`,MeshLambertMaterial:`lambert`,MeshPhongMaterial:`phong`,MeshToonMaterial:`toon`,MeshStandardMaterial:`physical`,MeshPhysicalMaterial:`physical`,MeshMatcapMaterial:`matcap`,LineBasicMaterial:`basic`,LineDashedMaterial:`dashed`,PointsMaterial:`points`,ShadowMaterial:`shadow`,SpriteMaterial:`sprite`};function m(e){return c.add(e),e===0?`uv`:`uv${e}`}function h(i,o,l,u,h,g){let _=u.fog,v=h.geometry,y=i.isMeshStandardMaterial||i.isMeshLambertMaterial||i.isMeshPhongMaterial?u.environment:null,b=i.isMeshStandardMaterial||i.isMeshLambertMaterial&&!i.envMap||i.isMeshPhongMaterial&&!i.envMap,x=t.get(i.envMap||y,b),S=x&&x.mapping===306?x.image.height:null,C=p[i.type];i.precision!==null&&(f=r.getMaxPrecision(i.precision),f!==i.precision&&Y(`WebGLProgram.getParameters:`,i.precision,`not supported, using`,f,`instead.`));let w=v.morphAttributes.position||v.morphAttributes.normal||v.morphAttributes.color,T=w===void 0?0:w.length,E=0;v.morphAttributes.position!==void 0&&(E=1),v.morphAttributes.normal!==void 0&&(E=2),v.morphAttributes.color!==void 0&&(E=3);let D,O,k,A;if(C){let e=ll[C];D=e.vertexShader,O=e.fragmentShader}else{D=i.vertexShader,O=i.fragmentShader;let e=s.getVertexShaderStage(i),t=s.getFragmentShaderStage(i);s.update(i,e,t),k=e.id,A=t.id}let j=e.getRenderTarget(),M=e.state.buffers.depth.getReversed(),N=h.isInstancedMesh===!0,P=h.isBatchedMesh===!0,F=!!i.map,I=!!i.matcap,L=!!x,R=!!i.aoMap,z=!!i.lightMap,ee=!!i.bumpMap&&i.wireframe===!1,B=!!i.normalMap,te=!!i.displacementMap,ne=!!i.emissiveMap,V=!!i.metalnessMap,H=!!i.roughnessMap,re=i.anisotropy>0,ie=i.clearcoat>0,ae=i.dispersion>0,oe=i.retroreflectivity>0,se=i.iridescence>0,ce=i.sheen>0,le=i.transmission>0,ue=re&&!!i.anisotropyMap,de=ie&&!!i.clearcoatMap,fe=ie&&!!i.clearcoatNormalMap,pe=ie&&!!i.clearcoatRoughnessMap,me=se&&!!i.iridescenceMap,U=se&&!!i.iridescenceThicknessMap,he=ce&&!!i.sheenColorMap,ge=ce&&!!i.sheenRoughnessMap,_e=!!i.specularMap,W=!!i.specularColorMap,ve=!!i.specularIntensityMap,G=le&&!!i.transmissionMap,K=le&&!!i.thicknessMap,ye=!!i.gradientMap,q=!!i.alphaMap,J=i.alphaTest>0,be=!!i.alphaHash,xe=!!i.extensions,Se=0;i.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(Se=e.toneMapping);let Ce={shaderID:C,shaderType:i.type,shaderName:i.name,vertexShader:D,fragmentShader:O,defines:i.defines,customVertexShaderID:k,customFragmentShaderID:A,isRawShaderMaterial:i.isRawShaderMaterial===!0,glslVersion:i.glslVersion,precision:f,batching:P,batchingColor:P&&h._colorsTexture!==null,instancing:N,instancingColor:N&&h.instanceColor!==null,instancingMorph:N&&h.morphTexture!==null,outputColorSpace:j===null?e.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:Yi.workingColorSpace,alphaToCoverage:!!i.alphaToCoverage,map:F,matcap:I,envMap:L,envMapMode:L&&x.mapping,envMapCubeUVHeight:S,aoMap:R,lightMap:z,bumpMap:ee,normalMap:B,displacementMap:te,emissiveMap:ne,normalMapObjectSpace:B&&i.normalMapType===1,normalMapTangentSpace:B&&i.normalMapType===0,packedNormalMap:B&&i.normalMapType===0&&Vd(i.normalMap.format),metalnessMap:V,roughnessMap:H,anisotropy:re,anisotropyMap:ue,clearcoat:ie,clearcoatMap:de,clearcoatNormalMap:fe,clearcoatRoughnessMap:pe,dispersion:ae,retroreflection:oe,iridescence:se,iridescenceMap:me,iridescenceThicknessMap:U,sheen:ce,sheenColorMap:he,sheenRoughnessMap:ge,specularMap:_e,specularColorMap:W,specularIntensityMap:ve,transmission:le,transmissionMap:G,thicknessMap:K,gradientMap:ye,opaque:i.transparent===!1&&i.blending===1&&i.alphaToCoverage===!1,alphaMap:q,alphaTest:J,alphaHash:be,combine:i.combine,mapUv:F&&m(i.map.channel),aoMapUv:R&&m(i.aoMap.channel),lightMapUv:z&&m(i.lightMap.channel),bumpMapUv:ee&&m(i.bumpMap.channel),normalMapUv:B&&m(i.normalMap.channel),displacementMapUv:te&&m(i.displacementMap.channel),emissiveMapUv:ne&&m(i.emissiveMap.channel),metalnessMapUv:V&&m(i.metalnessMap.channel),roughnessMapUv:H&&m(i.roughnessMap.channel),anisotropyMapUv:ue&&m(i.anisotropyMap.channel),clearcoatMapUv:de&&m(i.clearcoatMap.channel),clearcoatNormalMapUv:fe&&m(i.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:pe&&m(i.clearcoatRoughnessMap.channel),iridescenceMapUv:me&&m(i.iridescenceMap.channel),iridescenceThicknessMapUv:U&&m(i.iridescenceThicknessMap.channel),sheenColorMapUv:he&&m(i.sheenColorMap.channel),sheenRoughnessMapUv:ge&&m(i.sheenRoughnessMap.channel),specularMapUv:_e&&m(i.specularMap.channel),specularColorMapUv:W&&m(i.specularColorMap.channel),specularIntensityMapUv:ve&&m(i.specularIntensityMap.channel),transmissionMapUv:G&&m(i.transmissionMap.channel),thicknessMapUv:K&&m(i.thicknessMap.channel),alphaMapUv:q&&m(i.alphaMap.channel),vertexTangents:!!v.attributes.tangent&&(B||re),vertexNormals:!!v.attributes.normal,vertexColors:i.vertexColors,vertexAlphas:i.vertexColors===!0&&!!v.attributes.color&&v.attributes.color.itemSize===4,pointsUvs:h.isPoints===!0&&!!v.attributes.uv&&(F||q),fog:!!_,useFog:i.fog===!0,fogExp2:!!_&&_.isFogExp2,flatShading:i.wireframe===!1&&(i.flatShading===!0||v.attributes.normal===void 0&&B===!1&&(i.isMeshLambertMaterial||i.isMeshPhongMaterial||i.isMeshStandardMaterial||i.isMeshPhysicalMaterial)),sizeAttenuation:i.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:M,skinning:h.isSkinnedMesh===!0,hasPositionAttribute:v.attributes.position!==void 0,morphTargets:v.morphAttributes.position!==void 0,morphNormals:v.morphAttributes.normal!==void 0,morphColors:v.morphAttributes.color!==void 0,morphTargetsCount:T,morphTextureStride:E,numSunLights:o.sun.length,numDirLights:o.directional.length,numPointLights:o.point.length,numSpotLights:o.spot.length,numSpotLightMaps:o.spotLightMap.length,numRectAreaLights:o.rectArea.length,numHemiLights:o.hemi.length,numSunLightShadows:o.sunShadowMap.length,numDirLightShadows:o.directionalShadowMap.length,numPointLightShadows:o.pointShadowMap.length,numSpotLightShadows:o.spotShadowMap.length,numSpotLightShadowsWithMaps:o.numSpotLightShadowsWithMaps,numLightProbes:o.numLightProbes,numLightProbeGrids:g.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:i.dithering,shadowMapEnabled:e.shadowMap.enabled&&l.length>0,shadowMapType:e.shadowMap.type,toneMapping:Se,decodeVideoTexture:F&&i.map.isVideoTexture===!0&&Yi.getTransfer(i.map.colorSpace)===`srgb`,decodeVideoTextureEmissive:ne&&i.emissiveMap.isVideoTexture===!0&&Yi.getTransfer(i.emissiveMap.colorSpace)===`srgb`,premultipliedAlpha:i.premultipliedAlpha,doubleSided:i.side===2,flipSided:i.side===1,useDepthPacking:i.depthPacking>=0,depthPacking:i.depthPacking||0,index0AttributeName:i.index0AttributeName,extensionClipCullDistance:xe&&i.extensions.clipCullDistance===!0&&n.has(`WEBGL_clip_cull_distance`),extensionMultiDraw:(xe&&i.extensions.multiDraw===!0||P)&&n.has(`WEBGL_multi_draw`),rendererExtensionParallelShaderCompile:n.has(`KHR_parallel_shader_compile`),customProgramCacheKey:i.customProgramCacheKey()};return Ce.vertexUv1s=c.has(1),Ce.vertexUv2s=c.has(2),Ce.vertexUv3s=c.has(3),c.clear(),Ce}function g(t){let n=[];if(t.shaderID?n.push(t.shaderID):(n.push(t.customVertexShaderID),n.push(t.customFragmentShaderID)),t.defines!==void 0)for(let e in t.defines)n.push(e),n.push(t.defines[e]);return t.isRawShaderMaterial===!1&&(_(n,t),v(n,t),n.push(e.outputColorSpace)),n.push(t.customProgramCacheKey),n.join()}function _(e,t){e.push(t.precision),e.push(t.outputColorSpace),e.push(t.envMapMode),e.push(t.envMapCubeUVHeight),e.push(t.mapUv),e.push(t.alphaMapUv),e.push(t.lightMapUv),e.push(t.aoMapUv),e.push(t.bumpMapUv),e.push(t.normalMapUv),e.push(t.displacementMapUv),e.push(t.emissiveMapUv),e.push(t.metalnessMapUv),e.push(t.roughnessMapUv),e.push(t.anisotropyMapUv),e.push(t.clearcoatMapUv),e.push(t.clearcoatNormalMapUv),e.push(t.clearcoatRoughnessMapUv),e.push(t.iridescenceMapUv),e.push(t.iridescenceThicknessMapUv),e.push(t.sheenColorMapUv),e.push(t.sheenRoughnessMapUv),e.push(t.specularMapUv),e.push(t.specularColorMapUv),e.push(t.specularIntensityMapUv),e.push(t.transmissionMapUv),e.push(t.thicknessMapUv),e.push(t.combine),e.push(t.fogExp2),e.push(t.sizeAttenuation),e.push(t.morphTargetsCount),e.push(t.morphAttributeCount),e.push(t.numSunLights),e.push(t.numDirLights),e.push(t.numPointLights),e.push(t.numSpotLights),e.push(t.numSpotLightMaps),e.push(t.numHemiLights),e.push(t.numRectAreaLights),e.push(t.numSunLightShadows),e.push(t.numDirLightShadows),e.push(t.numPointLightShadows),e.push(t.numSpotLightShadows),e.push(t.numSpotLightShadowsWithMaps),e.push(t.numLightProbes),e.push(t.shadowMapType),e.push(t.toneMapping),e.push(t.numClippingPlanes),e.push(t.numClipIntersection),e.push(t.depthPacking)}function v(e,t){o.disableAll(),t.instancing&&o.enable(0),t.instancingColor&&o.enable(1),t.instancingMorph&&o.enable(2),t.matcap&&o.enable(3),t.envMap&&o.enable(4),t.normalMapObjectSpace&&o.enable(5),t.normalMapTangentSpace&&o.enable(6),t.clearcoat&&o.enable(7),t.iridescence&&o.enable(8),t.alphaTest&&o.enable(9),t.vertexColors&&o.enable(10),t.vertexAlphas&&o.enable(11),t.vertexUv1s&&o.enable(12),t.vertexUv2s&&o.enable(13),t.vertexUv3s&&o.enable(14),t.vertexTangents&&o.enable(15),t.anisotropy&&o.enable(16),t.alphaHash&&o.enable(17),t.batching&&o.enable(18),t.dispersion&&o.enable(19),t.retroreflection&&o.enable(24),t.batchingColor&&o.enable(20),t.gradientMap&&o.enable(21),t.packedNormalMap&&o.enable(22),t.vertexNormals&&o.enable(23),e.push(o.mask),o.disableAll(),t.fog&&o.enable(0),t.useFog&&o.enable(1),t.flatShading&&o.enable(2),t.logarithmicDepthBuffer&&o.enable(3),t.reversedDepthBuffer&&o.enable(4),t.skinning&&o.enable(5),t.morphTargets&&o.enable(6),t.morphNormals&&o.enable(7),t.morphColors&&o.enable(8),t.premultipliedAlpha&&o.enable(9),t.shadowMapEnabled&&o.enable(10),t.doubleSided&&o.enable(11),t.flipSided&&o.enable(12),t.useDepthPacking&&o.enable(13),t.dithering&&o.enable(14),t.transmission&&o.enable(15),t.sheen&&o.enable(16),t.opaque&&o.enable(17),t.pointsUvs&&o.enable(18),t.decodeVideoTexture&&o.enable(19),t.decodeVideoTextureEmissive&&o.enable(20),t.alphaToCoverage&&o.enable(21),t.numLightProbeGrids>0&&o.enable(22),t.hasPositionAttribute&&o.enable(23),e.push(o.mask)}function y(e){let t=p[e.type],n;if(t){let e=ll[t];n=ec.clone(e.uniforms)}else n=e.uniforms;return n}function b(t,n){let r=u.get(n);return r===void 0?(r=new Ld(e,n,t,i),l.push(r),u.set(n,r)):++r.usedTimes,r}function x(e){if(--e.usedTimes===0){let t=l.indexOf(e);l[t]=l[l.length-1],l.pop(),u.delete(e.cacheKey),e.destroy()}}function S(e){s.remove(e)}function C(){s.dispose()}return{getParameters:h,getProgramCacheKey:g,getUniforms:y,acquireProgram:b,releaseProgram:x,releaseShaderCache:S,programs:l,dispose:C}}function Ud(){let e=new WeakMap;function t(t){return e.has(t)}function n(t){let n=e.get(t);return n===void 0&&(n={},e.set(t,n)),n}function r(t){e.delete(t)}function i(t,n,r){e.get(t)[n]=r}function a(){e=new WeakMap}return{has:t,get:n,remove:r,update:i,dispose:a}}function Wd(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.material.id===t.material.id?e.materialVariant===t.materialVariant?e.z===t.z?e.id-t.id:e.z-t.z:e.materialVariant-t.materialVariant:e.material.id-t.material.id:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Gd(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.z===t.z?e.id-t.id:t.z-e.z:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Kd(){let e=[],t=0,n=[],r=[],i=[];function a(){t=0,n.length=0,r.length=0,i.length=0}function o(e){let t=0;return e.isInstancedMesh&&(t+=2),e.isSkinnedMesh&&(t+=1),t}function s(n,r,i,a,s,c){let l=e[t];return l===void 0?(l={id:n.id,object:n,geometry:r,material:i,materialVariant:o(n),groupOrder:a,renderOrder:n.renderOrder,z:s,group:c},e[t]=l):(l.id=n.id,l.object=n,l.geometry=r,l.material=i,l.materialVariant=o(n),l.groupOrder=a,l.renderOrder=n.renderOrder,l.z=s,l.group=c),t++,l}function c(e,t,a,o,c,l,u){u.reversedDepth===!0&&(c=-c);let d=s(e,t,a,o,c,l);a.transmission>0?r.push(d):a.transparent===!0?i.push(d):n.push(d)}function l(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.unshift(u):a.transparent===!0?i.unshift(u):n.unshift(u)}function u(e,t){n.length>1&&n.sort(e||Wd),r.length>1&&r.sort(t||Gd),i.length>1&&i.sort(t||Gd)}function d(){for(let n=t,r=e.length;n<r;n++){let t=e[n];if(t.id===null)break;t.id=null,t.object=null,t.geometry=null,t.material=null,t.group=null}}return{opaque:n,transmissive:r,transparent:i,init:a,push:c,unshift:l,finish:d,sort:u}}function qd(){let e=new WeakMap;function t(t,n){let r=e.get(t),i;return r===void 0?(i=new Kd,e.set(t,[i])):n>=r.length?(i=new Kd,r.push(i)):i=r[n],i}function n(){e=new WeakMap}return{get:t,dispose:n}}function Jd(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={direction:new X,color:new Ka};break;case`SpotLight`:n={position:new X,direction:new X,color:new Ka,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case`PointLight`:n={position:new X,color:new Ka,distance:0,decay:0};break;case`HemisphereLight`:n={direction:new X,skyColor:new Ka,groundColor:new Ka};break;case`RectAreaLight`:n={color:new Ka,position:new X,halfWidth:new X,halfHeight:new X}}return e[t.id]=n,n}}}function Yd(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Bi};break;case`SpotLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Bi};break;case`PointLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Bi,shadowCameraNear:1,shadowCameraFar:1e3}}return e[t.id]=n,n}}}var Xd=0;function Zd(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+ +!!t.map-!!e.map}function Qd(e){let t=new Jd,n=Yd(),r={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let e=0;e<9;e++)r.probe.push(new X);let i=new X,a=new da,o=new da;function s(i){let a=0,o=0,s=0;for(let e=0;e<9;e++)r.probe[e].set(0,0,0);let c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=0,v=0,y=0,b=0,x=0;i.sort(Zd);for(let e=0,S=i.length;e<S;e++){let S=i[e],C=S.color,w=S.intensity,T=S.distance,E=null;if(S.shadow&&S.shadow.map&&(E=S.shadow.map.texture.format===1030?S.shadow.map.texture:S.shadow.map.depthTexture||S.shadow.map.texture),S.isAmbientLight)a+=C.r*w,o+=C.g*w,s+=C.b*w;else if(S.isLightProbe){for(let e=0;e<9;e++)r.probe[e].addScaledVector(S.sh.coefficients[e],w);x++}else if(S.isSunLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize.copy(e.mapSize).multiply(e.getFrameExtents()),r.sunShadow[l]=t,r.sunShadowMap[l]=E;let i=e.getViewportCount();for(let t=0;t<i;t++)r.sunShadowMatrix[u+t]=e.getMatrix(t),r.sunShadowCascade[u+t]=e._cascadeData[t];u+=i,l++}r.sun[c]=e,c++}else if(S.isDirectionalLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,r.directionalShadow[d]=t,r.directionalShadowMap[d]=E,r.directionalShadowMatrix[d]=S.shadow.matrix,g++}r.directional[d]=e,d++}else if(S.isSpotLight){let e=t.get(S);e.position.setFromMatrixPosition(S.matrixWorld),e.color.copy(C).multiplyScalar(w),e.distance=T,e.coneCos=Math.cos(S.angle),e.penumbraCos=Math.cos(S.angle*(1-S.penumbra)),e.decay=S.decay,r.spot[p]=e;let i=S.shadow;if(S.map&&(r.spotLightMap[y]=S.map,y++,i.updateMatrices(S),S.castShadow&&b++),r.spotLightMatrix[p]=i.matrix,S.castShadow){let e=n.get(S);e.shadowIntensity=i.intensity,e.shadowBias=i.bias,e.shadowNormalBias=i.normalBias,e.shadowRadius=i.radius,e.shadowMapSize=i.mapSize,r.spotShadow[p]=e,r.spotShadowMap[p]=E,v++}p++}else if(S.isRectAreaLight){let e=t.get(S);e.color.copy(C).multiplyScalar(w),e.halfWidth.set(S.width*.5,0,0),e.halfHeight.set(0,S.height*.5,0),r.rectArea[m]=e,m++}else if(S.isPointLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),e.distance=S.distance,e.decay=S.decay,S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,t.shadowCameraNear=e.camera.near,t.shadowCameraFar=e.camera.far,r.pointShadow[f]=t,r.pointShadowMap[f]=E,r.pointShadowMatrix[f]=S.shadow.matrix,_++}r.point[f]=e,f++}else if(S.isHemisphereLight){let e=t.get(S);e.skyColor.copy(S.color).multiplyScalar(w),e.groundColor.copy(S.groundColor).multiplyScalar(w),r.hemi[h]=e,h++}}m>0&&(e.has(`OES_texture_float_linear`)===!0?(r.rectAreaLTC1=Z.LTC_FLOAT_1,r.rectAreaLTC2=Z.LTC_FLOAT_2):(r.rectAreaLTC1=Z.LTC_HALF_1,r.rectAreaLTC2=Z.LTC_HALF_2)),r.ambient[0]=a,r.ambient[1]=o,r.ambient[2]=s;let S=r.hash;(S.sunLength!==c||S.directionalLength!==d||S.pointLength!==f||S.spotLength!==p||S.rectAreaLength!==m||S.hemiLength!==h||S.numSunShadows!==l||S.numDirectionalShadows!==g||S.numPointShadows!==_||S.numSpotShadows!==v||S.numSpotMaps!==y||S.numLightProbes!==x)&&(r.sun.length=c,r.directional.length=d,r.spot.length=p,r.rectArea.length=m,r.point.length=f,r.hemi.length=h,r.sunShadow.length=l,r.sunShadowMap.length=l,r.sunShadowMatrix.length=u,r.sunShadowCascade.length=u,r.directionalShadow.length=g,r.directionalShadowMap.length=g,r.directionalShadowMatrix.length=g,r.pointShadow.length=_,r.pointShadowMap.length=_,r.pointShadowMatrix.length=_,r.spotShadow.length=v,r.spotShadowMap.length=v,r.spotLightMatrix.length=v+y-b,r.spotLightMap.length=y,r.numSpotLightShadowsWithMaps=b,r.numLightProbes=x,S.sunLength=c,S.directionalLength=d,S.pointLength=f,S.spotLength=p,S.rectAreaLength=m,S.hemiLength=h,S.numSunShadows=l,S.numDirectionalShadows=g,S.numPointShadows=_,S.numSpotShadows=v,S.numSpotMaps=y,S.numLightProbes=x,r.version=Xd++)}function c(e,t){let n=0,s=0,c=0,l=0,u=0,d=0,f=t.matrixWorldInverse;for(let t=0,p=e.length;t<p;t++){let p=e[t];if(p.isSunLight){let e=r.sun[n];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),n++}else if(p.isDirectionalLight){let e=r.directional[s];e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),s++}else if(p.isSpotLight){let e=r.spot[l];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),l++}else if(p.isRectAreaLight){let e=r.rectArea[u];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),o.identity(),a.copy(p.matrixWorld),a.premultiply(f),o.extractRotation(a),e.halfWidth.set(p.width*.5,0,0),e.halfHeight.set(0,p.height*.5,0),e.halfWidth.applyMatrix4(o),e.halfHeight.applyMatrix4(o),u++}else if(p.isPointLight){let e=r.point[c];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),c++}else if(p.isHemisphereLight){let e=r.hemi[d];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),d++}}}return{setup:s,setupView:c,state:r}}function $d(e){let t=new Qd(e),n=[],r=[],i=[];function a(e){d.camera=e,n.length=0,r.length=0,i.length=0}function o(e){n.push(e)}function s(e){r.push(e)}function c(e){i.push(e)}function l(){t.setup(n)}function u(e){t.setupView(n,e)}let d={lightsArray:n,shadowsArray:r,lightProbeGridArray:i,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:d,setupLights:l,setupLightsView:u,pushLight:o,pushShadow:s,pushLightProbeGrid:c}}function ef(e){let t=new WeakMap;function n(n,r=0){let i=t.get(n),a;return i===void 0?(a=new $d(e),t.set(n,[a])):r>=i.length?(a=new $d(e),i.push(a)):a=i[r],a}function r(){t=new WeakMap}return{get:n,dispose:r}}var tf=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,nf=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,rf=[new X(1,0,0),new X(-1,0,0),new X(0,1,0),new X(0,-1,0),new X(0,0,1),new X(0,0,-1)],af=[new X(0,-1,0),new X(0,-1,0),new X(0,0,1),new X(0,0,-1),new X(0,-1,0),new X(0,-1,0)],of=new da,sf=new X,cf=new X;function lf(e,t,n){let r=new xs,i=new Bi,a=new Bi,o=new oa,s=new ac,c=new oc,l={},u=n.maxTextureSize,d={0:1,1:0,2:2},f=new rc({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Bi},radius:{value:4}},vertexShader:tf,fragmentShader:nf}),p=f.clone();p.defines.HORIZONTAL_PASS=1;let m=new Uo;m.setAttribute(`position`,new Oo(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let h=new ps(m,f),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let _=this.type;this.render=function(t,n,s){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||t.length===0)return;this.type===2&&(Y(`WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`),this.type=1);let c=e.getRenderTarget(),l=e.getActiveCubeFace(),d=e.getActiveMipmapLevel(),f=e.state;f.setBlending(0),f.buffers.depth.getReversed()===!0?f.buffers.color.setClear(0,0,0,0):f.buffers.color.setClear(1,1,1,1),f.buffers.depth.setTest(!0),f.setScissorTest(!1);let p=_!==this.type;p&&n.traverse(function(e){e.material&&(Array.isArray(e.material)?e.material.forEach(e=>e.needsUpdate=!0):e.material.needsUpdate=!0)});for(let c=0,l=t.length;c<l;c++){let l=t[c],d=l.shadow;if(d===void 0){Y(`WebGLShadowMap:`,l,`has no shadow.`);continue}if(d.autoUpdate===!1&&d.needsUpdate===!1)continue;i.copy(d.mapSize);let m=d.getFrameExtents();i.multiply(m),a.copy(d.mapSize),(i.x>u||i.y>u)&&(i.x>u&&(a.x=Math.floor(u/m.x),i.x=a.x*m.x,d.mapSize.x=a.x),i.y>u&&(a.y=Math.floor(u/m.y),i.y=a.y*m.y,d.mapSize.y=a.y));let h=e.state.buffers.depth.getReversed();if(d.camera._reversedDepth=h,d.map===null||p===!0){if(d.map!==null&&(d.map.depthTexture!==null&&(d.map.depthTexture.dispose(),d.map.depthTexture=null),d.map.dispose()),this.type===3){if(l.isPointLight){Y(`WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.`);continue}d.map=new ca(i.x,i.y,{format:er,type:Vn,minFilter:jn,magFilter:jn,generateMipmaps:!1}),d.map.texture.name=l.name+`.shadowMap`,d.map.depthTexture=new Us(i.x,i.y,Bn),d.map.depthTexture.name=l.name+`.shadowMapDepth`,d.map.depthTexture.format=Xn,d.map.depthTexture.compareFunction=null,d.map.depthTexture.minFilter=On,d.map.depthTexture.magFilter=On}else l.isPointLight?(d.map=new zl(i.x),d.map.depthTexture=new Ws(i.x,zn)):(d.map=new ca(i.x,i.y),d.map.depthTexture=new Us(i.x,i.y,zn)),d.map.depthTexture.name=l.name+`.shadowMap`,d.map.depthTexture.format=Xn,this.type===1?(d.map.depthTexture.compareFunction=h?518:515,d.map.depthTexture.minFilter=jn,d.map.depthTexture.magFilter=jn):(d.map.depthTexture.compareFunction=null,d.map.depthTexture.minFilter=On,d.map.depthTexture.magFilter=On);d.camera.updateProjectionMatrix()}d.map.isWebGLCubeRenderTarget!==!0&&(d.map.width!==i.x||d.map.height!==i.y)&&d.map.setSize(i.x,i.y);let g=d.map.isWebGLCubeRenderTarget?6:d.getViewportCount();l.isPointLight!==!0&&d.updateMatrices(l,s);for(let t=0;t<g;t++){let i=d.getCamera(t);if(l.isPointLight){let e=d.camera,n=d.matrix,r=l.distance||e.far;r!==e.far&&(e.far=r,e.updateProjectionMatrix()),sf.setFromMatrixPosition(l.matrixWorld),e.position.copy(sf),cf.copy(e.position),cf.add(rf[t]),e.up.copy(af[t]),e.lookAt(cf),e.updateMatrixWorld(),n.makeTranslation(-sf.x,-sf.y,-sf.z),of.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),d._frustum.setFromProjectionMatrix(of,e.coordinateSystem,e.reversedDepth)}if(d.map.isWebGLCubeRenderTarget)e.setRenderTarget(d.map,t),e.clear();else{t===0&&(e.setRenderTarget(d.map),e.clear());let n=d.getViewport(t);o.set(a.x*n.x,a.y*n.y,a.x*n.z,a.y*n.w),f.viewport(o)}r=d.getFrustum(t),b(n,s,i,l,this.type)}d.isPointLightShadow!==!0&&this.type===3&&v(d,s),d.needsUpdate=!1}_=this.type,g.needsUpdate=!1,e.setRenderTarget(c,l,d)};function v(n,r){let a=t.update(h);f.defines.VSM_SAMPLES!==n.blurSamples&&(f.defines.VSM_SAMPLES=n.blurSamples,p.defines.VSM_SAMPLES=n.blurSamples,f.needsUpdate=!0,p.needsUpdate=!0),n.mapPass===null?n.mapPass=new ca(i.x,i.y,{format:er,type:Vn}):(n.mapPass.width!==n.map.width||n.mapPass.height!==n.map.height)&&n.mapPass.setSize(n.map.width,n.map.height),f.uniforms.shadow_pass.value=n.map.depthTexture,f.uniforms.resolution.value.set(n.map.width,n.map.height),f.uniforms.radius.value=n.radius,e.setRenderTarget(n.mapPass),e.clear(),e.renderBufferDirect(r,null,a,f,h,null),p.uniforms.shadow_pass.value=n.mapPass.texture,p.uniforms.resolution.value.set(n.map.width,n.map.height),p.uniforms.radius.value=n.radius,e.setRenderTarget(n.map),e.clear(),e.renderBufferDirect(r,null,a,p,h,null)}function y(t,n,r,i){let a=null,o=r.isPointLight===!0?t.customDistanceMaterial:t.customDepthMaterial;if(o!==void 0)a=o;else if(a=r.isPointLight===!0?c:s,e.localClippingEnabled&&n.clipShadows===!0&&Array.isArray(n.clippingPlanes)&&n.clippingPlanes.length!==0||n.displacementMap&&n.displacementScale!==0||n.alphaMap&&n.alphaTest>0||n.map&&n.alphaTest>0||n.alphaToCoverage===!0){let e=a.uuid,t=n.uuid,r=l[e];r===void 0&&(r={},l[e]=r);let i=r[t];i===void 0&&(i=a.clone(),r[t]=i,n.addEventListener(`dispose`,x)),a=i}if(a.visible=n.visible,a.wireframe=n.wireframe,i===3?a.side=n.shadowSide===null?n.side:n.shadowSide:a.side=n.shadowSide===null?d[n.side]:n.shadowSide,a.alphaMap=n.alphaMap,a.alphaTest=n.alphaToCoverage===!0?.5:n.alphaTest,a.map=n.map,a.clipShadows=n.clipShadows,a.clippingPlanes=n.clippingPlanes,a.clipIntersection=n.clipIntersection,a.displacementMap=n.displacementMap,a.displacementScale=n.displacementScale,a.displacementBias=n.displacementBias,a.wireframeLinewidth=n.wireframeLinewidth,a.linewidth=n.linewidth,r.isPointLight===!0&&a.isMeshDistanceMaterial===!0){let t=e.properties.get(a);t.light=r}return a}function b(n,i,a,o,s){if(n.visible===!1)return;if(n.layers.test(i.layers)&&(n.isMesh||n.isLine||n.isPoints)&&(n.castShadow||n.receiveShadow&&s===3)&&(!n.frustumCulled||n.intersectsFrustum(r))){n.modelViewMatrix.multiplyMatrices(a.matrixWorldInverse,n.matrixWorld);let r=t.update(n),c=n.material;if(Array.isArray(c)){let t=r.groups;for(let l=0,u=t.length;l<u;l++){let u=t[l],d=c[u.materialIndex];if(d&&d.visible){let t=y(n,d,o,s);n.onBeforeShadow(e,n,i,a,r,t,u),e.renderBufferDirect(a,null,r,t,n,u),n.onAfterShadow(e,n,i,a,r,t,u)}}}else if(c.visible){let t=y(n,c,o,s);n.onBeforeShadow(e,n,i,a,r,t,null),e.renderBufferDirect(a,null,r,t,n,null),n.onAfterShadow(e,n,i,a,r,t,null)}}let c=n.children;for(let e=0,t=c.length;e<t;e++)b(c[e],i,a,o,s)}function x(e){e.target.removeEventListener(`dispose`,x);for(let t in l){let n=l[t],r=e.target.uuid;r in n&&(n[r].dispose(),delete n[r])}}}function uf(e,t){function n(){let t=!1,n=new oa,r=null,i=new oa(0,0,0,0);return{setMask:function(n){r!==n&&!t&&(e.colorMask(n,n,n,n),r=n)},setLocked:function(e){t=e},setClear:function(t,r,a,o,s){s===!0&&(t*=o,r*=o,a*=o),n.set(t,r,a,o),i.equals(n)===!1&&(e.clearColor(t,r,a,o),i.copy(n))},reset:function(){t=!1,r=null,i.set(-1,0,0,0)}}}function r(){let n=!1,r=!1,i=null,a=null,o=null;return{setReversed:function(e){if(r!==e){let n=t.get(`EXT_clip_control`);e?n.clipControlEXT(n.LOWER_LEFT_EXT,n.ZERO_TO_ONE_EXT):n.clipControlEXT(n.LOWER_LEFT_EXT,n.NEGATIVE_ONE_TO_ONE_EXT),r=e;let i=o;o=null,this.setClear(i)}},getReversed:function(){return r},setTest:function(t){t?V(e.DEPTH_TEST):H(e.DEPTH_TEST)},setMask:function(t){i!==t&&!n&&(e.depthMask(t),i=t)},setFunc:function(t){if(r&&(t=di[t]),a!==t){switch(t){case 0:e.depthFunc(e.NEVER);break;case 1:e.depthFunc(e.ALWAYS);break;case 2:e.depthFunc(e.LESS);break;case 3:e.depthFunc(e.LEQUAL);break;case 4:e.depthFunc(e.EQUAL);break;case 5:e.depthFunc(e.GEQUAL);break;case 6:e.depthFunc(e.GREATER);break;case 7:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}a=t}},setLocked:function(e){n=e},setClear:function(t){o!==t&&(o=t,r&&(t=1-t),e.clearDepth(t))},reset:function(){n=!1,i=null,a=null,o=null,r=!1}}}function i(){let t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null;return{setTest:function(n){t||(n?V(e.STENCIL_TEST):H(e.STENCIL_TEST))},setMask:function(r){n!==r&&!t&&(e.stencilMask(r),n=r)},setFunc:function(t,n,o){(r!==t||i!==n||a!==o)&&(e.stencilFunc(t,n,o),r=t,i=n,a=o)},setOp:function(t,n,r){(o!==t||s!==n||c!==r)&&(e.stencilOp(t,n,r),o=t,s=n,c=r)},setLocked:function(e){t=e},setClear:function(t){l!==t&&(e.clearStencil(t),l=t)},reset:function(){t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null}}}let a=new n,o=new r,s=new i,c=new WeakMap,l=new WeakMap,u={},d={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new Ka(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,j=null,M=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),N=!1,P=0,F=e.getParameter(e.VERSION);F.indexOf(`WebGL`)===-1?F.indexOf(`OpenGL ES`)!==-1&&(P=parseFloat(/^OpenGL ES (\d)/.exec(F)[1]),N=P>=2):(P=parseFloat(/^WebGL (\d)/.exec(F)[1]),N=P>=1);let I=null,L={},R=e.getParameter(e.SCISSOR_BOX),z=e.getParameter(e.VIEWPORT),ee=new oa().fromArray(R),B=new oa().fromArray(z);function te(t,n,r,i){let a=new Uint8Array(4),o=e.createTexture();e.bindTexture(t,o),e.texParameteri(t,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(t,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let o=0;o<r;o++)t===e.TEXTURE_3D||t===e.TEXTURE_2D_ARRAY?e.texImage3D(n,0,e.RGBA,1,1,i,0,e.RGBA,e.UNSIGNED_BYTE,a):e.texImage2D(n+o,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,a);return o}let ne={};ne[e.TEXTURE_2D]=te(e.TEXTURE_2D,e.TEXTURE_2D,1),ne[e.TEXTURE_CUBE_MAP]=te(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),ne[e.TEXTURE_2D_ARRAY]=te(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),ne[e.TEXTURE_3D]=te(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),s.setClear(0),V(e.DEPTH_TEST),o.setFunc(3),ue(!1),de(1),V(e.CULL_FACE),ce(0);function V(t){u[t]!==!0&&(e.enable(t),u[t]=!0)}function H(t){u[t]!==!1&&(e.disable(t),u[t]=!1)}function re(t,n){return f[t]!==n&&(e.bindFramebuffer(t,n),f[t]=n,t===e.DRAW_FRAMEBUFFER&&(f[e.FRAMEBUFFER]=n),t===e.FRAMEBUFFER&&(f[e.DRAW_FRAMEBUFFER]=n),!0)}function ie(t,n){let r=m,i=!1;if(t){r=p.get(n),r===void 0&&(r=[],p.set(n,r));let a=t.textures;if(r.length!==a.length||r[0]!==e.COLOR_ATTACHMENT0){for(let t=0,n=a.length;t<n;t++)r[t]=e.COLOR_ATTACHMENT0+t;r.length=a.length,i=!0}}else r[0]!==e.BACK&&(r[0]=e.BACK,i=!0);i&&e.drawBuffers(r)}function ae(t){return h!==t&&(e.useProgram(t),h=t,!0)}let oe={100:e.FUNC_ADD,101:e.FUNC_SUBTRACT,102:e.FUNC_REVERSE_SUBTRACT};oe[103]=e.MIN,oe[104]=e.MAX;let se={200:e.ZERO,201:e.ONE,202:e.SRC_COLOR,204:e.SRC_ALPHA,210:e.SRC_ALPHA_SATURATE,208:e.DST_COLOR,206:e.DST_ALPHA,203:e.ONE_MINUS_SRC_COLOR,205:e.ONE_MINUS_SRC_ALPHA,209:e.ONE_MINUS_DST_COLOR,207:e.ONE_MINUS_DST_ALPHA,211:e.CONSTANT_COLOR,212:e.ONE_MINUS_CONSTANT_COLOR,213:e.CONSTANT_ALPHA,214:e.ONE_MINUS_CONSTANT_ALPHA};function ce(t,n,r,i,a,o,s,c,l,u){if(t===0)g===!0&&(H(e.BLEND),g=!1);else if(g===!1&&(V(e.BLEND),g=!0),t!==5){if(t!==_||u!==E){if((v!==100||x!==100)&&(e.blendEquation(e.FUNC_ADD),v=100,x=100),u)switch(t){case 1:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFunc(e.ONE,e.ONE);break;case 3:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case 4:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:ci(`WebGLState: Invalid blending: `,t)}else switch(t){case 1:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case 3:ci(`WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true`);break;case 4:ci(`WebGLState: MultiplyBlending requires material.premultipliedAlpha = true`);break;default:ci(`WebGLState: Invalid blending: `,t)}y=null,b=null,S=null,C=null,w.set(0,0,0),T=0,_=t,E=u}}else a||=n,o||=r,s||=i,(n!==v||a!==x)&&(e.blendEquationSeparate(oe[n],oe[a]),v=n,x=a),(r!==y||i!==b||o!==S||s!==C)&&(e.blendFuncSeparate(se[r],se[i],se[o],se[s]),y=r,b=i,S=o,C=s),(c.equals(w)===!1||l!==T)&&(e.blendColor(c.r,c.g,c.b,l),w.copy(c),T=l),_=t,E=!1}function le(t,n){t.side===2?H(e.CULL_FACE):V(e.CULL_FACE);let r=t.side===1;n&&(r=!r),ue(r),t.blending===1&&t.transparent===!1?ce(0):ce(t.blending,t.blendEquation,t.blendSrc,t.blendDst,t.blendEquationAlpha,t.blendSrcAlpha,t.blendDstAlpha,t.blendColor,t.blendAlpha,t.premultipliedAlpha),o.setFunc(t.depthFunc),o.setTest(t.depthTest),o.setMask(t.depthWrite),a.setMask(t.colorWrite);let i=t.stencilWrite;s.setTest(i),i&&(s.setMask(t.stencilWriteMask),s.setFunc(t.stencilFunc,t.stencilRef,t.stencilFuncMask),s.setOp(t.stencilFail,t.stencilZFail,t.stencilZPass)),pe(t.polygonOffset,t.polygonOffsetFactor,t.polygonOffsetUnits),t.alphaToCoverage===!0?V(e.SAMPLE_ALPHA_TO_COVERAGE):H(e.SAMPLE_ALPHA_TO_COVERAGE)}function ue(t){D!==t&&(t?e.frontFace(e.CW):e.frontFace(e.CCW),D=t)}function de(t){t===0?H(e.CULL_FACE):(V(e.CULL_FACE),t!==O&&(t===1?e.cullFace(e.BACK):t===2?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))),O=t}function fe(t){t!==k&&(N&&e.lineWidth(t),k=t)}function pe(t,n,r){t?(V(e.POLYGON_OFFSET_FILL),(A!==n||j!==r)&&(A=n,j=r,o.getReversed()&&(n=-n),e.polygonOffset(n,r))):H(e.POLYGON_OFFSET_FILL)}function me(t){t?V(e.SCISSOR_TEST):H(e.SCISSOR_TEST)}function U(t){t===void 0&&(t=e.TEXTURE0+M-1),I!==t&&(e.activeTexture(t),I=t)}function he(t,n,r){r===void 0&&(r=I===null?e.TEXTURE0+M-1:I);let i=L[r];i===void 0&&(i={type:void 0,texture:void 0},L[r]=i),(i.type!==t||i.texture!==n)&&(I!==r&&(e.activeTexture(r),I=r),e.bindTexture(t,n||ne[t]),i.type=t,i.texture=n)}function ge(){let t=L[I];t!==void 0&&t.type!==void 0&&(e.bindTexture(t.type,null),t.type=void 0,t.texture=void 0)}function _e(){try{e.compressedTexImage2D(...arguments)}catch(e){ci(`WebGLState:`,e)}}function W(){try{e.compressedTexImage3D(...arguments)}catch(e){ci(`WebGLState:`,e)}}function ve(){try{e.texSubImage2D(...arguments)}catch(e){ci(`WebGLState:`,e)}}function G(){try{e.texSubImage3D(...arguments)}catch(e){ci(`WebGLState:`,e)}}function K(){try{e.compressedTexSubImage2D(...arguments)}catch(e){ci(`WebGLState:`,e)}}function ye(){try{e.compressedTexSubImage3D(...arguments)}catch(e){ci(`WebGLState:`,e)}}function q(){try{e.texStorage2D(...arguments)}catch(e){ci(`WebGLState:`,e)}}function J(){try{e.texStorage3D(...arguments)}catch(e){ci(`WebGLState:`,e)}}function be(){try{e.texImage2D(...arguments)}catch(e){ci(`WebGLState:`,e)}}function xe(){try{e.texImage3D(...arguments)}catch(e){ci(`WebGLState:`,e)}}function Se(t){return d[t]===void 0?e.getParameter(t):d[t]}function Ce(t,n){d[t]!==n&&(e.pixelStorei(t,n),d[t]=n)}function we(t){ee.equals(t)===!1&&(e.scissor(t.x,t.y,t.z,t.w),ee.copy(t))}function Te(t){B.equals(t)===!1&&(e.viewport(t.x,t.y,t.z,t.w),B.copy(t))}function Ee(t,n){let r=l.get(n);r===void 0&&(r=new WeakMap,l.set(n,r));let i=r.get(t);i===void 0&&(i=e.getUniformBlockIndex(n,t.name),r.set(t,i))}function De(t,n){let r=l.get(n).get(t);c.get(n)!==r&&(e.uniformBlockBinding(n,r,t.__bindingPointIndex),c.set(n,r))}function Oe(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),u={},d={},I=null,L={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new Ka(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,j=null,ee.set(0,0,e.canvas.width,e.canvas.height),B.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),s.reset()}return{buffers:{color:a,depth:o,stencil:s},enable:V,disable:H,bindFramebuffer:re,drawBuffers:ie,useProgram:ae,setBlending:ce,setMaterial:le,setFlipSided:ue,setCullFace:de,setLineWidth:fe,setPolygonOffset:pe,setScissorTest:me,activeTexture:U,bindTexture:he,unbindTexture:ge,compressedTexImage2D:_e,compressedTexImage3D:W,texImage2D:be,texImage3D:xe,pixelStorei:Ce,getParameter:Se,updateUBOMapping:Ee,uniformBlockBinding:De,texStorage2D:q,texStorage3D:J,texSubImage2D:ve,texSubImage3D:G,compressedTexSubImage2D:K,compressedTexSubImage3D:ye,scissor:we,viewport:Te,reset:Oe}}function df(e,t,n,r,i,a,o){let s=t.has(`WEBGL_multisampled_render_to_texture`)?t.get(`WEBGL_multisampled_render_to_texture`):null,c=typeof navigator>`u`?!1:/OculusBrowser/g.test(navigator.userAgent),l=new Bi,u=new WeakMap,d=new Set,f,p=new WeakMap,m=!1;try{m=typeof OffscreenCanvas<`u`&&new OffscreenCanvas(1,1).getContext(`2d`)!==null}catch{}function h(e,t){return m?new OffscreenCanvas(e,t):ri(`canvas`)}function g(e,t,n){let r=1,i=_e(e);if((i.width>n||i.height>n)&&(r=n/Math.max(i.width,i.height)),r<1){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof VideoFrame<`u`&&e instanceof VideoFrame){let n=Math.floor(r*i.width),a=Math.floor(r*i.height);f===void 0&&(f=h(n,a));let o=t?h(n,a):f;return o.width=n,o.height=a,o.getContext(`2d`).drawImage(e,0,0,n,a),Y(`WebGLRenderer: Texture has been resized from (`+i.width+`x`+i.height+`) to (`+n+`x`+a+`).`),o}return`data`in e&&Y(`WebGLRenderer: Image in DataTexture is too big (`+i.width+`x`+i.height+`).`),e}return e}function _(e){return e.generateMipmaps}function v(t){e.generateMipmap(t)}function y(t){return t.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:t.isWebGL3DRenderTarget?e.TEXTURE_3D:t.isWebGLArrayRenderTarget||t.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function b(n,r,i,a,o,s=!1){if(n!==null){if(e[n]!==void 0)return e[n];Y(`WebGLRenderer: Attempt to use non-existing WebGL internal format '`+n+`'`)}let c;a&&(c=t.get(`EXT_texture_norm16`),c||Y(`WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension`));let l=r;if(r===e.RED&&(i===e.FLOAT&&(l=e.R32F),i===e.HALF_FLOAT&&(l=e.R16F),i===e.UNSIGNED_BYTE&&(l=e.R8),i===e.UNSIGNED_SHORT&&c&&(l=c.R16_EXT),i===e.SHORT&&c&&(l=c.R16_SNORM_EXT)),r===e.RED_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.R8UI),i===e.UNSIGNED_SHORT&&(l=e.R16UI),i===e.UNSIGNED_INT&&(l=e.R32UI),i===e.BYTE&&(l=e.R8I),i===e.SHORT&&(l=e.R16I),i===e.INT&&(l=e.R32I)),r===e.RG&&(i===e.FLOAT&&(l=e.RG32F),i===e.HALF_FLOAT&&(l=e.RG16F),i===e.UNSIGNED_BYTE&&(l=e.RG8),i===e.UNSIGNED_SHORT&&c&&(l=c.RG16_EXT),i===e.SHORT&&c&&(l=c.RG16_SNORM_EXT)),r===e.RG_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RG8UI),i===e.UNSIGNED_SHORT&&(l=e.RG16UI),i===e.UNSIGNED_INT&&(l=e.RG32UI),i===e.BYTE&&(l=e.RG8I),i===e.SHORT&&(l=e.RG16I),i===e.INT&&(l=e.RG32I)),r===e.RGB_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGB8UI),i===e.UNSIGNED_SHORT&&(l=e.RGB16UI),i===e.UNSIGNED_INT&&(l=e.RGB32UI),i===e.BYTE&&(l=e.RGB8I),i===e.SHORT&&(l=e.RGB16I),i===e.INT&&(l=e.RGB32I)),r===e.RGBA_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGBA8UI),i===e.UNSIGNED_SHORT&&(l=e.RGBA16UI),i===e.UNSIGNED_INT&&(l=e.RGBA32UI),i===e.BYTE&&(l=e.RGBA8I),i===e.SHORT&&(l=e.RGBA16I),i===e.INT&&(l=e.RGBA32I)),r===e.RGB&&(i===e.UNSIGNED_SHORT&&c&&(l=c.RGB16_EXT),i===e.SHORT&&c&&(l=c.RGB16_SNORM_EXT),i===e.UNSIGNED_INT_5_9_9_9_REV&&(l=e.RGB9_E5),i===e.UNSIGNED_INT_10F_11F_11F_REV&&(l=e.R11F_G11F_B10F)),r===e.RGBA){let t=s?Yr:Yi.getTransfer(o);i===e.FLOAT&&(l=e.RGBA32F),i===e.HALF_FLOAT&&(l=e.RGBA16F),i===e.UNSIGNED_BYTE&&(l=t===`srgb`?e.SRGB8_ALPHA8:e.RGBA8),i===e.UNSIGNED_SHORT&&c&&(l=c.RGBA16_EXT),i===e.SHORT&&c&&(l=c.RGBA16_SNORM_EXT),i===e.UNSIGNED_SHORT_4_4_4_4&&(l=e.RGBA4),i===e.UNSIGNED_SHORT_5_5_5_1&&(l=e.RGB5_A1)}return(l===e.R16F||l===e.R32F||l===e.RG16F||l===e.RG32F||l===e.RGBA16F||l===e.RGBA32F)&&t.get(`EXT_color_buffer_float`),l}function x(t,n){let r;return t?n===null||n===1014||n===1020?r=e.DEPTH24_STENCIL8:n===1015?r=e.DEPTH32F_STENCIL8:n===1012&&(r=e.DEPTH24_STENCIL8,Y(`DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.`)):n===null||n===1014||n===1020?r=e.DEPTH_COMPONENT24:n===1015?r=e.DEPTH_COMPONENT32F:n===1012&&(r=e.DEPTH_COMPONENT16),r}function S(e,t){return _(e)===!0||e.isFramebufferTexture&&e.minFilter!==1003&&e.minFilter!==1006?Math.log2(Math.max(t.width,t.height))+1:e.mipmaps!==void 0&&e.mipmaps.length>0?e.mipmaps.length:e.isCompressedTexture&&Array.isArray(e.image)?t.mipmaps.length:1}function C(e){let t=e.target;t.removeEventListener(`dispose`,C),T(t),t.isVideoTexture&&u.delete(t),t.isHTMLTexture&&d.delete(t)}function w(e){let t=e.target;t.removeEventListener(`dispose`,w),D(t)}function T(e){let t=r.get(e);if(t.__webglInit===void 0)return;let n=e.source,i=p.get(n);if(i){let r=i[t.__cacheKey];r.usedTimes--,r.usedTimes===0&&E(e),Object.keys(i).length===0&&p.delete(n)}r.remove(e)}function E(t){let n=r.get(t);e.deleteTexture(n.__webglTexture);let i=t.source,a=p.get(i);delete a[n.__cacheKey],o.memory.textures--}function D(t){let n=r.get(t);if(t.depthTexture&&(t.depthTexture.dispose(),r.remove(t.depthTexture)),t.isWebGLCubeRenderTarget)for(let t=0;t<6;t++){if(Array.isArray(n.__webglFramebuffer[t]))for(let r=0;r<n.__webglFramebuffer[t].length;r++)e.deleteFramebuffer(n.__webglFramebuffer[t][r]);else e.deleteFramebuffer(n.__webglFramebuffer[t]);n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer[t])}else{if(Array.isArray(n.__webglFramebuffer))for(let t=0;t<n.__webglFramebuffer.length;t++)e.deleteFramebuffer(n.__webglFramebuffer[t]);else e.deleteFramebuffer(n.__webglFramebuffer);if(n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer),n.__webglMultisampledFramebuffer&&e.deleteFramebuffer(n.__webglMultisampledFramebuffer),n.__webglColorRenderbuffer)for(let t=0;t<n.__webglColorRenderbuffer.length;t++)n.__webglColorRenderbuffer[t]&&e.deleteRenderbuffer(n.__webglColorRenderbuffer[t]);n.__webglDepthRenderbuffer&&e.deleteRenderbuffer(n.__webglDepthRenderbuffer)}let i=t.textures;for(let t=0,n=i.length;t<n;t++){let n=r.get(i[t]);n.__webglTexture&&(e.deleteTexture(n.__webglTexture),o.memory.textures--),r.remove(i[t])}r.remove(t)}let O=0;function k(){O=0}function A(){return O}function j(e){O=e}function M(){let e=O;return e>=i.maxTextures&&Y(`WebGLTextures: Trying to use `+(e+1)+` texture units while this GPU supports only `+i.maxTextures),O+=1,e}function N(e){let t=[];return t.push(e.wrapS),t.push(e.wrapT),t.push(e.wrapR||0),t.push(e.magFilter),t.push(e.minFilter),t.push(e.anisotropy),t.push(e.internalFormat),t.push(e.format),t.push(e.type),t.push(e.generateMipmaps),t.push(e.premultiplyAlpha),t.push(e.flipY),t.push(e.unpackAlignment),t.push(e.colorSpace),t.join()}function P(t,i){let a=r.get(t);if(t.isVideoTexture&&he(t),t.isRenderTargetTexture===!1&&t.isExternalTexture!==!0&&t.version>0&&a.__version!==t.version){let e=t.image;if(e===null)Y(`WebGLRenderer: Texture marked for update but no image data found.`);else if(e.complete===!1)Y(`WebGLRenderer: Texture marked for update but image is incomplete`);else{H(a,t,i);return}}else t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,a.__webglTexture,e.TEXTURE0+i)}function F(t,i){let a=r.get(t);t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version?H(a,t,i):(t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null),n.bindTexture(e.TEXTURE_2D_ARRAY,a.__webglTexture,e.TEXTURE0+i))}function I(t,i){let a=r.get(t);t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version?H(a,t,i):n.bindTexture(e.TEXTURE_3D,a.__webglTexture,e.TEXTURE0+i)}function L(t,i){let a=r.get(t);t.isCubeDepthTexture!==!0&&t.version>0&&a.__version!==t.version?re(a,t,i):n.bindTexture(e.TEXTURE_CUBE_MAP,a.__webglTexture,e.TEXTURE0+i)}let R={[Tn]:e.REPEAT,[En]:e.CLAMP_TO_EDGE,[Dn]:e.MIRRORED_REPEAT},z={[On]:e.NEAREST,[kn]:e.NEAREST_MIPMAP_NEAREST,[An]:e.NEAREST_MIPMAP_LINEAR,[jn]:e.LINEAR,[Mn]:e.LINEAR_MIPMAP_NEAREST,[Nn]:e.LINEAR_MIPMAP_LINEAR},ee={512:e.NEVER,519:e.ALWAYS,513:e.LESS,515:e.LEQUAL,514:e.EQUAL,518:e.GEQUAL,516:e.GREATER,517:e.NOTEQUAL};function B(n,a){if(a.type===1015&&t.has(`OES_texture_float_linear`)===!1&&(a.magFilter===1006||a.magFilter===1007||a.magFilter===1005||a.magFilter===1008||a.minFilter===1006||a.minFilter===1007||a.minFilter===1005||a.minFilter===1008)&&Y(`WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.`),e.texParameteri(n,e.TEXTURE_WRAP_S,R[a.wrapS]),e.texParameteri(n,e.TEXTURE_WRAP_T,R[a.wrapT]),(n===e.TEXTURE_3D||n===e.TEXTURE_2D_ARRAY)&&e.texParameteri(n,e.TEXTURE_WRAP_R,R[a.wrapR]),e.texParameteri(n,e.TEXTURE_MAG_FILTER,z[a.magFilter]),e.texParameteri(n,e.TEXTURE_MIN_FILTER,z[a.minFilter]),a.compareFunction&&(e.texParameteri(n,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(n,e.TEXTURE_COMPARE_FUNC,ee[a.compareFunction])),t.has(`EXT_texture_filter_anisotropic`)===!0){if(a.magFilter===1003||a.minFilter!==1005&&a.minFilter!==1008||a.type===1015&&t.has(`OES_texture_float_linear`)===!1)return;if(a.anisotropy>1||r.get(a).__currentAnisotropy){let o=t.get(`EXT_texture_filter_anisotropic`);e.texParameterf(n,o.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(a.anisotropy,i.getMaxAnisotropy())),r.get(a).__currentAnisotropy=a.anisotropy}}}function te(t,n){let r=!1;t.__webglInit===void 0&&(t.__webglInit=!0,n.addEventListener(`dispose`,C));let i=n.source,a=p.get(i);a===void 0&&(a={},p.set(i,a));let s=N(n);if(s!==t.__cacheKey){a[s]===void 0&&(a[s]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,r=!0),a[s].usedTimes++;let i=a[t.__cacheKey];i!==void 0&&(a[t.__cacheKey].usedTimes--,i.usedTimes===0&&E(n)),t.__cacheKey=s,t.__webglTexture=a[s].texture}return r}function ne(e,t,n){return Math.floor(Math.floor(e/n)/t)}function V(t,r,i,a){let o=t.updateRanges;if(o.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,r.width,r.height,i,a,r.data);else{o.sort((e,t)=>e.start-t.start);let s=0;for(let e=1;e<o.length;e++){let t=o[s],n=o[e],i=t.start+t.count,a=ne(n.start,r.width,4),c=ne(t.start,r.width,4);n.start<=i+1&&a===c&&ne(n.start+n.count-1,r.width,4)===a?t.count=Math.max(t.count,n.start+n.count-t.start):(++s,o[s]=n)}o.length=s+1;let c=n.getParameter(e.UNPACK_ROW_LENGTH),l=n.getParameter(e.UNPACK_SKIP_PIXELS),u=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,r.width);for(let t=0,s=o.length;t<s;t++){let s=o[t],c=Math.floor(s.start/4),l=Math.ceil(s.count/4),u=c%r.width,d=Math.floor(c/r.width),f=l;n.pixelStorei(e.UNPACK_SKIP_PIXELS,u),n.pixelStorei(e.UNPACK_SKIP_ROWS,d),n.texSubImage2D(e.TEXTURE_2D,0,u,d,f,1,i,a,r.data)}t.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,c),n.pixelStorei(e.UNPACK_SKIP_PIXELS,l),n.pixelStorei(e.UNPACK_SKIP_ROWS,u)}}function H(t,o,s){let c=e.TEXTURE_2D;(o.isDataArrayTexture||o.isCompressedArrayTexture)&&(c=e.TEXTURE_2D_ARRAY),o.isData3DTexture&&(c=e.TEXTURE_3D);let l=te(t,o),u=o.source;n.bindTexture(c,t.__webglTexture,e.TEXTURE0+s);let f=r.get(u);if(u.version!==f.__version||l===!0){if(n.activeTexture(e.TEXTURE0+s),!(typeof ImageBitmap<`u`&&o.image instanceof ImageBitmap)){let t=Yi.getPrimaries(Yi.workingColorSpace),r=o.colorSpace===``?null:Yi.getPrimaries(o.colorSpace),i=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,i)}n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment);let t=g(o.image,!1,i.maxTextureSize);t=ge(o,t);let r=a.convert(o.format,o.colorSpace),p=a.convert(o.type),m=b(o.internalFormat,r,p,o.normalized,o.colorSpace,o.isVideoTexture);B(c,o);let h,y=o.mipmaps,C=o.isVideoTexture!==!0,w=f.__version===void 0||l===!0,T=u.dataReady,E=S(o,t);if(o.isDepthTexture)m=x(o.format===Zn,o.type),w&&(C?n.texStorage2D(e.TEXTURE_2D,1,m,t.width,t.height):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,null));else if(o.isDataTexture){if(y.length>0){C&&w&&n.texStorage2D(e.TEXTURE_2D,E,m,y[0].width,y[0].height);for(let t=0,i=y.length;t<i;t++)h=y[t],C?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data);o.generateMipmaps=!1}else C?(w&&n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height),T&&V(o,t,r,p)):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,t.data)}else if(o.isCompressedTexture){if(o.isCompressedArrayTexture){C&&w&&n.texStorage3D(e.TEXTURE_2D_ARRAY,E,m,y[0].width,y[0].height,t.depth);for(let i=0,a=y.length;i<a;i++)if(h=y[i],o.format!==1023){if(r!==null){if(C){if(T){if(o.layerUpdates.size>0){let t=il(h.width,h.height,o.format,o.type);for(let a of o.layerUpdates){let o=h.data.subarray(a*t/h.data.BYTES_PER_ELEMENT,(a+1)*t/h.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,a,h.width,h.height,1,r,o)}}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,h.data)}}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,h.data,0,0)}else Y(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`)}else C?T&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,p,h.data):n.texImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,r,p,h.data);o.layerUpdates.size>0&&o.clearLayerUpdates()}else{C&&w&&n.texStorage2D(e.TEXTURE_2D,E,m,y[0].width,y[0].height);for(let t=0,i=y.length;t<i;t++)h=y[t],o.format===1023?C?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data):r===null?Y(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`):C?T&&n.compressedTexSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,h.data):n.compressedTexImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,h.data)}}else if(o.isDataArrayTexture){if(C){if(w&&n.texStorage3D(e.TEXTURE_2D_ARRAY,E,m,t.width,t.height,t.depth),T){if(o.layerUpdates.size>0){let i=il(t.width,t.height,o.format,o.type);for(let a of o.layerUpdates){let o=t.data.subarray(a*i/t.data.BYTES_PER_ELEMENT,(a+1)*i/t.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,a,t.width,t.height,1,r,p,o)}o.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)}}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,m,t.width,t.height,t.depth,0,r,p,t.data)}else if(o.isData3DTexture)C?(w&&n.texStorage3D(e.TEXTURE_3D,E,m,t.width,t.height,t.depth),T&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)):n.texImage3D(e.TEXTURE_3D,0,m,t.width,t.height,t.depth,0,r,p,t.data);else if(o.isFramebufferTexture){if(w){if(C)n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height);else{let i=t.width,a=t.height;for(let t=0;t<E;t++)n.texImage2D(e.TEXTURE_2D,t,m,i,a,0,r,p,null),i>>=1,a>>=1}}}else if(o.isHTMLTexture){if(`texElementImage2D`in e){let n=e.canvas;if(n.hasAttribute(`layoutsubtree`)||n.setAttribute(`layoutsubtree`,`true`),t.parentNode!==n){n.appendChild(t),d.add(o),n.onpaint=e=>{let t=e.changedElements;for(let e of d)t.includes(e.image)&&(e.needsUpdate=!0)},n.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,t);else{let n=e.RGBA,r=e.RGBA,i=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,n,r,i,t)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(y.length>0){if(C&&w){let t=_e(y[0]);n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height)}for(let t=0,i=y.length;t<i;t++)h=y[t],C?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,r,p,h):n.texImage2D(e.TEXTURE_2D,t,m,r,p,h);o.generateMipmaps=!1}else if(C){if(w){let r=_e(t);n.texStorage2D(e.TEXTURE_2D,E,m,r.width,r.height)}T&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,r,p,t)}else n.texImage2D(e.TEXTURE_2D,0,m,r,p,t);_(o)&&v(c),f.__version=u.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function re(t,o,s){if(o.image.length!==6)return;let c=te(t,o),l=o.source;n.bindTexture(e.TEXTURE_CUBE_MAP,t.__webglTexture,e.TEXTURE0+s);let u=r.get(l);if(l.version!==u.__version||c===!0){n.activeTexture(e.TEXTURE0+s);let t=Yi.getPrimaries(Yi.workingColorSpace),r=o.colorSpace===``?null:Yi.getPrimaries(o.colorSpace),d=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,d);let f=o.isCompressedTexture||o.image[0].isCompressedTexture,p=o.image[0]&&o.image[0].isDataTexture,m=[];for(let e=0;e<6;e++)!f&&!p?m[e]=g(o.image[e],!0,i.maxCubemapSize):m[e]=p?o.image[e].image:o.image[e],m[e]=ge(o,m[e]);let h=m[0],y=a.convert(o.format,o.colorSpace),x=a.convert(o.type),C=b(o.internalFormat,y,x,o.normalized,o.colorSpace),w=o.isVideoTexture!==!0,T=u.__version===void 0||c===!0,E=l.dataReady,D=S(o,h);B(e.TEXTURE_CUBE_MAP,o);let O;if(f){w&&T&&n.texStorage2D(e.TEXTURE_CUBE_MAP,D,C,h.width,h.height);for(let t=0;t<6;t++){O=m[t].mipmaps;for(let r=0;r<O.length;r++){let i=O[r];o.format===1023?w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,y,x,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,C,i.width,i.height,0,y,x,i.data):y===null?Y(`WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()`):w?E&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,y,i.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,C,i.width,i.height,0,i.data)}}}else{if(O=o.mipmaps,w&&T){O.length>0&&D++;let t=_e(m[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,D,C,t.width,t.height)}for(let t=0;t<6;t++)if(p){w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,m[t].width,m[t].height,y,x,m[t].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,C,m[t].width,m[t].height,0,y,x,m[t].data);for(let r=0;r<O.length;r++){let i=O[r].image[t].image;w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,i.width,i.height,y,x,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,C,i.width,i.height,0,y,x,i.data)}}else{w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,y,x,m[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,C,y,x,m[t]);for(let r=0;r<O.length;r++){let i=O[r];w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,y,x,i.image[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,C,y,x,i.image[t])}}}_(o)&&v(e.TEXTURE_CUBE_MAP),u.__version=l.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function ie(t,i,o,c,l,u){let d=a.convert(o.format,o.colorSpace),f=a.convert(o.type),p=b(o.internalFormat,d,f,o.normalized,o.colorSpace),m=r.get(i),h=r.get(o);if(h.__renderTarget=i,!m.__hasExternalTextures){let t=Math.max(1,i.width>>u),r=Math.max(1,i.height>>u);l===e.TEXTURE_3D||l===e.TEXTURE_2D_ARRAY?n.texImage3D(l,u,p,t,r,i.depth,0,d,f,null):n.texImage2D(l,u,p,t,r,0,d,f,null)}n.bindFramebuffer(e.FRAMEBUFFER,t),U(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,c,l,h.__webglTexture,0,me(i)):(l===e.TEXTURE_2D||l>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&l<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,c,l,h.__webglTexture,u),n.bindFramebuffer(e.FRAMEBUFFER,null)}function ae(t,n,r){if(e.bindRenderbuffer(e.RENDERBUFFER,t),n.depthBuffer){let i=n.depthTexture,a=i&&i.isDepthTexture?i.type:null,o=x(n.stencilBuffer,a),c=n.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;U(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,me(n),o,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,me(n),o,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,o,n.width,n.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,c,e.RENDERBUFFER,t)}else{let t=n.textures;for(let i=0;i<t.length;i++){let o=t[i],c=a.convert(o.format,o.colorSpace),l=a.convert(o.type),u=b(o.internalFormat,c,l,o.normalized,o.colorSpace);U(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,me(n),u,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,me(n),u,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,u,n.width,n.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function oe(t,i,o){let c=i.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,t),!(i.depthTexture&&i.depthTexture.isDepthTexture))throw Error(`THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.`);let l=r.get(i.depthTexture);if(l.__renderTarget=i,(!l.__webglTexture||i.depthTexture.image.width!==i.width||i.depthTexture.image.height!==i.height)&&(i.depthTexture.image.width=i.width,i.depthTexture.image.height=i.height,i.depthTexture.needsUpdate=!0),c){if(l.__webglInit===void 0&&(l.__webglInit=!0,i.depthTexture.addEventListener(`dispose`,C)),l.__webglTexture===void 0){l.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,l.__webglTexture),B(e.TEXTURE_CUBE_MAP,i.depthTexture);let t=a.convert(i.depthTexture.format),r=a.convert(i.depthTexture.type),o;i.depthTexture.format===1026?o=e.DEPTH_COMPONENT24:i.depthTexture.format===1027&&(o=e.DEPTH24_STENCIL8);for(let n=0;n<6;n++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0,o,i.width,i.height,0,t,r,null)}}else P(i.depthTexture,0);let u=l.__webglTexture,d=me(i),f=c?e.TEXTURE_CUBE_MAP_POSITIVE_X+o:e.TEXTURE_2D,p=i.depthTexture.format===1027?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(i.depthTexture.format===1026)U(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else if(i.depthTexture.format===1027)U(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else throw Error(`THREE.WebGLTextures: Unknown depthTexture format.`)}function se(t){let i=r.get(t),a=t.isWebGLCubeRenderTarget===!0;if(i.__boundDepthTexture!==t.depthTexture){let e=t.depthTexture;if(i.__depthDisposeCallback&&i.__depthDisposeCallback(),e){let t=()=>{delete i.__boundDepthTexture,delete i.__depthDisposeCallback,e.removeEventListener(`dispose`,t)};e.addEventListener(`dispose`,t),i.__depthDisposeCallback=t}i.__boundDepthTexture=e}if(t.depthTexture&&!i.__autoAllocateDepthBuffer){if(a)for(let e=0;e<6;e++)oe(i.__webglFramebuffer[e],t,e);else{let e=t.texture.mipmaps;e&&e.length>0?oe(i.__webglFramebuffer[0],t,0):oe(i.__webglFramebuffer,t,0)}}else if(a){i.__webglDepthbuffer=[];for(let r=0;r<6;r++)if(n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[r]),i.__webglDepthbuffer[r]===void 0)i.__webglDepthbuffer[r]=e.createRenderbuffer(),ae(i.__webglDepthbuffer[r],t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,a=i.__webglDepthbuffer[r];e.bindRenderbuffer(e.RENDERBUFFER,a),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,a)}}else{let r=t.texture.mipmaps;if(r&&r.length>0?n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer),i.__webglDepthbuffer===void 0)i.__webglDepthbuffer=e.createRenderbuffer(),ae(i.__webglDepthbuffer,t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,r=i.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,r),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,r)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function ce(t,n,i){let a=r.get(t);n!==void 0&&ie(a.__webglFramebuffer,t,t.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),i!==void 0&&se(t)}function le(t){let i=t.texture,s=r.get(t),c=r.get(i);t.addEventListener(`dispose`,w);let l=t.textures,u=t.isWebGLCubeRenderTarget===!0,d=l.length>1;if(d||(c.__webglTexture===void 0&&(c.__webglTexture=e.createTexture()),c.__version=i.version,o.memory.textures++),u){s.__webglFramebuffer=[];for(let t=0;t<6;t++)if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer[t]=[];for(let n=0;n<i.mipmaps.length;n++)s.__webglFramebuffer[t][n]=e.createFramebuffer()}else s.__webglFramebuffer[t]=e.createFramebuffer()}else{if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer=[];for(let t=0;t<i.mipmaps.length;t++)s.__webglFramebuffer[t]=e.createFramebuffer()}else s.__webglFramebuffer=e.createFramebuffer();if(d)for(let t=0,n=l.length;t<n;t++){let n=r.get(l[t]);n.__webglTexture===void 0&&(n.__webglTexture=e.createTexture(),o.memory.textures++)}if(t.samples>0&&U(t)===!1){s.__webglMultisampledFramebuffer=e.createFramebuffer(),s.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,s.__webglMultisampledFramebuffer);for(let n=0;n<l.length;n++){let r=l[n];s.__webglColorRenderbuffer[n]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,s.__webglColorRenderbuffer[n]);let i=a.convert(r.format,r.colorSpace),o=a.convert(r.type),c=b(r.internalFormat,i,o,r.normalized,r.colorSpace,t.isXRRenderTarget===!0),u=me(t);e.renderbufferStorageMultisample(e.RENDERBUFFER,u,c,t.width,t.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+n,e.RENDERBUFFER,s.__webglColorRenderbuffer[n])}e.bindRenderbuffer(e.RENDERBUFFER,null),t.depthBuffer&&(s.__webglDepthRenderbuffer=e.createRenderbuffer(),ae(s.__webglDepthRenderbuffer,t,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(u){n.bindTexture(e.TEXTURE_CUBE_MAP,c.__webglTexture),B(e.TEXTURE_CUBE_MAP,i);for(let n=0;n<6;n++)if(i.mipmaps&&i.mipmaps.length>0)for(let r=0;r<i.mipmaps.length;r++)ie(s.__webglFramebuffer[n][r],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,r);else ie(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0);_(i)&&v(e.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(d){for(let i=0,a=l.length;i<a;i++){let a=l[i],o=r.get(a),c=e.TEXTURE_2D;(t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(c=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(c,o.__webglTexture),B(c,a),ie(s.__webglFramebuffer,t,a,e.COLOR_ATTACHMENT0+i,c,0),_(a)&&v(c)}n.unbindTexture()}else{let r=e.TEXTURE_2D;if((t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(r=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(r,c.__webglTexture),B(r,i),i.mipmaps&&i.mipmaps.length>0)for(let n=0;n<i.mipmaps.length;n++)ie(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,r,n);else ie(s.__webglFramebuffer,t,i,e.COLOR_ATTACHMENT0,r,0);_(i)&&v(r),n.unbindTexture()}t.depthBuffer&&se(t)}function ue(e){let t=e.textures;for(let i=0,a=t.length;i<a;i++){let a=t[i];if(_(a)){let t=y(e),i=r.get(a).__webglTexture;n.bindTexture(t,i),v(t),n.unbindTexture()}}}let de=[],fe=[];function pe(t){if(t.samples>0){if(U(t)===!1){let i=t.textures,a=t.width,o=t.height,s=e.COLOR_BUFFER_BIT,l=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,u=r.get(t),d=i.length>1;if(d)for(let t=0;t<i.length;t++)n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,u.__webglMultisampledFramebuffer);let f=t.texture.mipmaps;f&&f.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer);for(let n=0;n<i.length;n++){if(t.resolveDepthBuffer&&(t.depthBuffer&&(s|=e.DEPTH_BUFFER_BIT),t.stencilBuffer&&t.resolveStencilBuffer&&(s|=e.STENCIL_BUFFER_BIT)),d){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,u.__webglColorRenderbuffer[n]);let t=r.get(i[n]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0)}e.blitFramebuffer(0,0,a,o,0,0,a,o,s,e.NEAREST),c===!0&&(de.length=0,fe.length=0,de.push(e.COLOR_ATTACHMENT0+n),t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&(de.push(l),fe.push(l),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,fe)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,de))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),d)for(let t=0;t<i.length;t++){n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,u.__webglColorRenderbuffer[t]);let a=r.get(i[t]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,a,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglMultisampledFramebuffer)}else if(t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&c){let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[n])}}}function me(e){return Math.min(i.maxSamples,e.samples)}function U(e){let n=r.get(e);return e.samples>0&&t.has(`WEBGL_multisampled_render_to_texture`)===!0&&n.__useRenderToTexture!==!1}function he(e){let t=o.render.frame;u.get(e)!==t&&(u.set(e,t),e.update())}function ge(e,t){let n=e.colorSpace,r=e.format,i=e.type;return e.isCompressedTexture===!0||e.isVideoTexture===!0||n!==`srgb-linear`&&n!==``&&(Yi.getTransfer(n)===`srgb`?(r!==1023||i!==1009)&&Y(`WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.`):ci(`WebGLTextures: Unsupported texture color space:`,n)),t}function _e(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement?(l.width=e.naturalWidth||e.width,l.height=e.naturalHeight||e.height):typeof VideoFrame<`u`&&e instanceof VideoFrame?(l.width=e.displayWidth,l.height=e.displayHeight):(l.width=e.width,l.height=e.height),l}this.allocateTextureUnit=M,this.resetTextureUnits=k,this.getTextureUnits=A,this.setTextureUnits=j,this.setTexture2D=P,this.setTexture2DArray=F,this.setTexture3D=I,this.setTextureCube=L,this.rebindTextures=ce,this.setupRenderTarget=le,this.updateRenderTargetMipmap=ue,this.updateMultisampleRenderTarget=pe,this.setupDepthRenderbuffer=se,this.setupFrameBufferTexture=ie,this.useMultisampledRTT=U,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function ff(e,t){function n(n,r=``){let i,a=Yi.getTransfer(r);if(n===1009)return e.UNSIGNED_BYTE;if(n===1017)return e.UNSIGNED_SHORT_4_4_4_4;if(n===1018)return e.UNSIGNED_SHORT_5_5_5_1;if(n===35902)return e.UNSIGNED_INT_5_9_9_9_REV;if(n===35899)return e.UNSIGNED_INT_10F_11F_11F_REV;if(n===1010)return e.BYTE;if(n===1011)return e.SHORT;if(n===1012)return e.UNSIGNED_SHORT;if(n===1013)return e.INT;if(n===1014)return e.UNSIGNED_INT;if(n===1015)return e.FLOAT;if(n===1016)return e.HALF_FLOAT;if(n===1021)return e.ALPHA;if(n===1022)return e.RGB;if(n===1023)return e.RGBA;if(n===1026)return e.DEPTH_COMPONENT;if(n===1027)return e.DEPTH_STENCIL;if(n===1028)return e.RED;if(n===1029)return e.RED_INTEGER;if(n===1030)return e.RG;if(n===1031)return e.RG_INTEGER;if(n===1033)return e.RGBA_INTEGER;if(n===33776||n===33777||n===33778||n===33779){if(a===`srgb`){if(i=t.get(`WEBGL_compressed_texture_s3tc_srgb`),i!==null){if(n===33776)return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null}else if(i=t.get(`WEBGL_compressed_texture_s3tc`),i!==null){if(n===33776)return i.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null}if(n===35840||n===35841||n===35842||n===35843){if(i=t.get(`WEBGL_compressed_texture_pvrtc`),i!==null){if(n===35840)return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===35841)return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===35842)return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===35843)return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null}if(n===36196||n===37492||n===37496||n===37488||n===37489||n===37490||n===37491){if(i=t.get(`WEBGL_compressed_texture_etc`),i!==null){if(n===36196||n===37492)return a===`srgb`?i.COMPRESSED_SRGB8_ETC2:i.COMPRESSED_RGB8_ETC2;if(n===37496)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:i.COMPRESSED_RGBA8_ETC2_EAC;if(n===37488)return i.COMPRESSED_R11_EAC;if(n===37489)return i.COMPRESSED_SIGNED_R11_EAC;if(n===37490)return i.COMPRESSED_RG11_EAC;if(n===37491)return i.COMPRESSED_SIGNED_RG11_EAC}else return null}if(n===37808||n===37809||n===37810||n===37811||n===37812||n===37813||n===37814||n===37815||n===37816||n===37817||n===37818||n===37819||n===37820||n===37821){if(i=t.get(`WEBGL_compressed_texture_astc`),i!==null){if(n===37808)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:i.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===37809)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:i.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===37810)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:i.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===37811)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:i.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===37812)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:i.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===37813)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:i.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===37814)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:i.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===37815)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:i.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===37816)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:i.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===37817)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:i.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===37818)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:i.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===37819)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:i.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===37820)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:i.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===37821)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:i.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null}if(n===36492||n===36494||n===36495){if(i=t.get(`EXT_texture_compression_bptc`),i!==null){if(n===36492)return a===`srgb`?i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:i.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===36494)return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===36495)return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null}if(n===36283||n===36284||n===36285||n===36286){if(i=t.get(`EXT_texture_compression_rgtc`),i!==null){if(n===36283)return i.COMPRESSED_RED_RGTC1_EXT;if(n===36284)return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===36285)return i.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===36286)return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null}return n===1020?e.UNSIGNED_INT_24_8:e[n]===void 0?null:e[n]}return{convert:n}}var pf=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,mf=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,hf=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new Gs(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new rc({vertexShader:pf,fragmentShader:mf,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new ps(new Js(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},gf=class extends fi{constructor(e,t){super();let n=this,r=null,i=1,a=null,o=`local-floor`,s=1,c=null,l=null,u=null,d=null,f=null,p=null,m=typeof XRWebGLBinding<`u`,h=new hf,g={},_=t.getContextAttributes(),v=null,y=null,b=[],x=[],S=new Bi,C=null,w=null,T=new Nc;T.viewport=new oa;let E=new Nc;E.viewport=new oa;let D=[T,E],O=new zc,k=null,A=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(e){let t=b[e];return t===void 0&&(t=new Va,b[e]=t),t.getTargetRaySpace()},this.getControllerGrip=function(e){let t=b[e];return t===void 0&&(t=new Va,b[e]=t),t.getGripSpace()},this.getHand=function(e){let t=b[e];return t===void 0&&(t=new Va,b[e]=t),t.getHandSpace()};function j(e){let t=x.indexOf(e.inputSource);if(t===-1)return;let n=b[t];n!==void 0&&(n.update(e.inputSource,e.frame,c||a),n.dispatchEvent({type:e.type,data:e.inputSource}))}function M(){r.removeEventListener(`select`,j),r.removeEventListener(`selectstart`,j),r.removeEventListener(`selectend`,j),r.removeEventListener(`squeeze`,j),r.removeEventListener(`squeezestart`,j),r.removeEventListener(`squeezeend`,j),r.removeEventListener(`end`,M),r.removeEventListener(`inputsourceschange`,N);for(let e=0;e<b.length;e++){let t=x[e];t!==null&&(x[e]=null,b[e].disconnect(t))}k=null,A=null,h.reset();for(let e in g)delete g[e];if(e.setRenderTarget(v),f=null,d=null,u=null,r=null,y=null,B.stop(),n.isPresenting=!1,e.setPixelRatio(C),e.setSize(S.width,S.height,!1),w!==null){let e=w.camera;e.fov=w.fov,e.zoom=w.zoom,e.updateProjectionMatrix(),w=null}n.dispatchEvent({type:`sessionend`})}this.setFramebufferScaleFactor=function(e){i=e,n.isPresenting===!0&&Y(`WebXRManager: Cannot change framebuffer scale while presenting.`)},this.setReferenceSpaceType=function(e){o=e,n.isPresenting===!0&&Y(`WebXRManager: Cannot change reference space type while presenting.`)},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(e){c=e},this.getBaseLayer=function(){return d===null?f:d},this.getBinding=function(){return u===null&&m&&(u=new XRWebGLBinding(r,t)),u},this.getFrame=function(){return p},this.getSession=function(){return r},this.setSession=async function(l){if(r=l,r!==null){if(v=e.getRenderTarget(),r.addEventListener(`select`,j),r.addEventListener(`selectstart`,j),r.addEventListener(`selectend`,j),r.addEventListener(`squeeze`,j),r.addEventListener(`squeezestart`,j),r.addEventListener(`squeezeend`,j),r.addEventListener(`end`,M),r.addEventListener(`inputsourceschange`,N),_.xrCompatible!==!0&&await t.makeXRCompatible(),C=e.getPixelRatio(),e.getSize(S),m&&`createProjectionLayer`in XRWebGLBinding.prototype){let n=null,a=null,o=null;_.depth&&(o=_.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,n=_.stencil?Zn:Xn,a=_.stencil?Wn:zn);let s={colorFormat:t.RGBA8,depthFormat:o,scaleFactor:i};u=this.getBinding(),d=u.createProjectionLayer(s),r.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),y=new ca(d.textureWidth,d.textureHeight,{format:Yn,type:Pn,depthTexture:new Us(d.textureWidth,d.textureHeight,a,void 0,void 0,void 0,void 0,void 0,void 0,n),stencilBuffer:_.stencil,colorSpace:e.outputColorSpace,samples:_.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{let n={antialias:_.antialias,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:i};f=new XRWebGLLayer(r,t,n),r.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),y=new ca(f.framebufferWidth,f.framebufferHeight,{format:Yn,type:Pn,colorSpace:e.outputColorSpace,stencilBuffer:_.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(s),c=null,a=await r.requestReferenceSpace(o),B.setContext(r),B.start(),n.isPresenting=!0,n.dispatchEvent({type:`sessionstart`})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return h.getDepthTexture()};function N(e){for(let t=0;t<e.removed.length;t++){let n=e.removed[t],r=x.indexOf(n);r>=0&&(x[r]=null,b[r].disconnect(n))}for(let t=0;t<e.added.length;t++){let n=e.added[t],r=x.indexOf(n);if(r===-1){for(let e=0;e<b.length;e++)if(e>=x.length){x.push(n),r=e;break}else if(x[e]===null){x[e]=n,r=e;break}if(r===-1)break}let i=b[r];i&&i.connect(n)}}let P=new X,F=new X;function I(e,t,n){P.setFromMatrixPosition(t.matrixWorld),F.setFromMatrixPosition(n.matrixWorld);let r=P.distanceTo(F),i=t.projectionMatrix.elements,a=n.projectionMatrix.elements,o=i[14]/(i[10]-1),s=i[14]/(i[10]+1),c=(i[9]+1)/i[5],l=(i[9]-1)/i[5],u=(i[8]-1)/i[0],d=(a[8]+1)/a[0],f=o*u,p=o*d,m=r/(-u+d),h=m*-u;if(t.matrixWorld.decompose(e.position,e.quaternion,e.scale),e.translateX(h),e.translateZ(m),e.matrixWorld.compose(e.position,e.quaternion,e.scale),e.matrixWorldInverse.copy(e.matrixWorld).invert(),i[10]===-1)e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse);else{let t=o+m,n=s+m,i=f-h,a=p+(r-h),u=c*s/n*t,d=l*s/n*t;e.projectionMatrix.makePerspective(i,a,u,d,t,n),e.projectionMatrixInverse.copy(e.projectionMatrix).invert()}}function L(e,t){t===null?e.matrixWorld.copy(e.matrix):e.matrixWorld.multiplyMatrices(t.matrixWorld,e.matrix),e.matrixWorldInverse.copy(e.matrixWorld).invert()}this.updateCamera=function(e){if(r===null)return;let t=e.near,n=e.far;h.texture!==null&&(h.depthNear>0&&(t=h.depthNear),h.depthFar>0&&(n=h.depthFar)),O.near=E.near=T.near=t,O.far=E.far=T.far=n,(k!==O.near||A!==O.far)&&(r.updateRenderState({depthNear:O.near,depthFar:O.far}),k=O.near,A=O.far),O.layers.mask=e.layers.mask|6,T.layers.mask=O.layers.mask&-5,E.layers.mask=O.layers.mask&-3;let i=e.parent,a=O.cameras;L(O,i);for(let e=0;e<a.length;e++)L(a[e],i);a.length===2?I(O,T,E):O.projectionMatrix.copy(T.projectionMatrix),w===null&&e.isPerspectiveCamera&&(w={camera:e,fov:e.fov,zoom:e.zoom}),R(e,O,i)};function R(e,t,n){n===null?e.matrix.copy(t.matrixWorld):(e.matrix.copy(n.matrixWorld),e.matrix.invert(),e.matrix.multiply(t.matrixWorld)),e.matrix.decompose(e.position,e.quaternion,e.scale),e.updateMatrixWorld(!0),e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse),e.isPerspectiveCamera&&(e.fov=gi*2*Math.atan(1/e.projectionMatrix.elements[5]),e.zoom=1)}this.getCamera=function(){return O},this.getFoveation=function(){if(d!==null||f!==null)return s},this.setFoveation=function(e){s=e,d!==null&&(d.fixedFoveation=e),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=e)},this.hasDepthSensing=function(){return h.texture!==null},this.getDepthSensingMesh=function(){return h.getMesh(O)},this.getCameraTexture=function(e){return g[e]};let z=null;function ee(t,i){if(l=i.getViewerPose(c||a),p=i,l!==null){let t=l.views;f!==null&&(e.setRenderTargetFramebuffer(y,f.framebuffer),e.setRenderTarget(y));let i=!1;t.length!==O.cameras.length&&(O.cameras.length=0,i=!0);for(let n=0;n<t.length;n++){let r=t[n],a=null;if(f!==null)a=f.getViewport(r);else{let t=u.getViewSubImage(d,r);a=t.viewport,n===0&&(e.setRenderTargetTextures(y,t.colorTexture,t.depthStencilTexture),e.setRenderTarget(y))}let o=D[n];o===void 0&&(o=new Nc,o.layers.enable(n),o.viewport=new oa,D[n]=o),o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.projectionMatrix.fromArray(r.projectionMatrix),o.projectionMatrixInverse.copy(o.projectionMatrix).invert(),o.viewport.set(a.x,a.y,a.width,a.height),n===0&&(O.matrix.copy(o.matrix),O.matrix.decompose(O.position,O.quaternion,O.scale)),i===!0&&O.cameras.push(o)}let a=r.enabledFeatures;if(a&&a.includes(`depth-sensing`)&&r.depthUsage==`gpu-optimized`&&m){u=n.getBinding();let e=u.getDepthInformation(t[0]);e&&e.isValid&&e.texture&&h.init(e,r.renderState)}if(a&&a.includes(`camera-access`)&&m){e.state.unbindTexture(),u=n.getBinding();for(let e=0;e<t.length;e++){let n=t[e].camera;if(n){let e=g[n];e||(e=new Gs,g[n]=e);let t=u.getCameraImage(n);e.sourceTexture=t}}}}for(let e=0;e<b.length;e++){let t=x[e],n=b[e];t!==null&&n!==void 0&&n.update(t,i,c||a)}z&&z(t,i),i.detectedPlanes&&n.dispatchEvent({type:`planesdetected`,data:i}),p=null}let B=new ol;B.setAnimationLoop(ee),this.setAnimationLoop=function(e){z=e},this.dispose=function(){}}},_f=new da,vf=new Wi;vf.set(-1,0,0,0,1,0,0,0,1);function yf(e,t){function n(e,t){e.matrixAutoUpdate===!0&&e.updateMatrix(),t.value.copy(e.matrix)}function r(t,n){n.color.getRGB(t.fogColor.value,$s(e)),n.isFog?(t.fogNear.value=n.near,t.fogFar.value=n.far):n.isFogExp2&&(t.fogDensity.value=n.density)}function i(e,t,n,r,i){t.isNodeMaterial?t.uniformsNeedUpdate=!1:t.isMeshBasicMaterial?a(e,t):t.isMeshLambertMaterial?(a(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshToonMaterial?(a(e,t),d(e,t)):t.isMeshPhongMaterial?(a(e,t),u(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshStandardMaterial?(a(e,t),f(e,t),t.isMeshPhysicalMaterial&&p(e,t,i)):t.isMeshMatcapMaterial?(a(e,t),m(e,t)):t.isMeshDepthMaterial?a(e,t):t.isMeshDistanceMaterial?(a(e,t),h(e,t)):t.isMeshNormalMaterial?a(e,t):t.isLineBasicMaterial?(o(e,t),t.isLineDashedMaterial&&s(e,t)):t.isPointsMaterial?c(e,t,n,r):t.isSpriteMaterial?l(e,t):t.isShadowMaterial?(e.color.value.copy(t.color),e.opacity.value=t.opacity):t.isShaderMaterial&&(t.uniformsNeedUpdate=!1)}function a(e,r){e.opacity.value=r.opacity,r.color&&e.diffuse.value.copy(r.color),r.emissive&&e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity),r.map&&(e.map.value=r.map,n(r.map,e.mapTransform)),r.alphaMap&&(e.alphaMap.value=r.alphaMap,n(r.alphaMap,e.alphaMapTransform)),r.bumpMap&&(e.bumpMap.value=r.bumpMap,n(r.bumpMap,e.bumpMapTransform),e.bumpScale.value=r.bumpScale,r.side===1&&(e.bumpScale.value*=-1)),r.normalMap&&(e.normalMap.value=r.normalMap,n(r.normalMap,e.normalMapTransform),e.normalScale.value.copy(r.normalScale),r.side===1&&e.normalScale.value.negate()),r.displacementMap&&(e.displacementMap.value=r.displacementMap,n(r.displacementMap,e.displacementMapTransform),e.displacementScale.value=r.displacementScale,e.displacementBias.value=r.displacementBias),r.emissiveMap&&(e.emissiveMap.value=r.emissiveMap,n(r.emissiveMap,e.emissiveMapTransform)),r.specularMap&&(e.specularMap.value=r.specularMap,n(r.specularMap,e.specularMapTransform)),r.alphaTest>0&&(e.alphaTest.value=r.alphaTest);let i=t.get(r),a=i.envMap,o=i.envMapRotation;a&&(e.envMap.value=a,e.envMapRotation.value.setFromMatrix4(_f.makeRotationFromEuler(o)).transpose(),a.isCubeTexture&&a.isRenderTargetTexture===!1&&e.envMapRotation.value.premultiply(vf),e.reflectivity.value=r.reflectivity,e.ior.value=r.ior,e.refractionRatio.value=r.refractionRatio),r.lightMap&&(e.lightMap.value=r.lightMap,e.lightMapIntensity.value=r.lightMapIntensity,n(r.lightMap,e.lightMapTransform)),r.aoMap&&(e.aoMap.value=r.aoMap,e.aoMapIntensity.value=r.aoMapIntensity,n(r.aoMap,e.aoMapTransform))}function o(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform))}function s(e,t){e.dashSize.value=t.dashSize,e.totalSize.value=t.dashSize+t.gapSize,e.scale.value=t.scale}function c(e,t,r,i){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.size.value=t.size*r,e.scale.value=i*.5,t.map&&(e.map.value=t.map,n(t.map,e.uvTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function l(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.rotation.value=t.rotation,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function u(e,t){e.specular.value.copy(t.specular),e.shininess.value=Math.max(t.shininess,1e-4)}function d(e,t){t.gradientMap&&(e.gradientMap.value=t.gradientMap)}function f(e,t){e.metalness.value=t.metalness,t.metalnessMap&&(e.metalnessMap.value=t.metalnessMap,n(t.metalnessMap,e.metalnessMapTransform)),e.roughness.value=t.roughness,t.roughnessMap&&(e.roughnessMap.value=t.roughnessMap,n(t.roughnessMap,e.roughnessMapTransform)),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)}function p(e,t,r){e.ior.value=t.ior,t.sheen>0&&(e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen),e.sheenRoughness.value=t.sheenRoughness,t.sheenColorMap&&(e.sheenColorMap.value=t.sheenColorMap,n(t.sheenColorMap,e.sheenColorMapTransform)),t.sheenRoughnessMap&&(e.sheenRoughnessMap.value=t.sheenRoughnessMap,n(t.sheenRoughnessMap,e.sheenRoughnessMapTransform))),t.clearcoat>0&&(e.clearcoat.value=t.clearcoat,e.clearcoatRoughness.value=t.clearcoatRoughness,t.clearcoatMap&&(e.clearcoatMap.value=t.clearcoatMap,n(t.clearcoatMap,e.clearcoatMapTransform)),t.clearcoatRoughnessMap&&(e.clearcoatRoughnessMap.value=t.clearcoatRoughnessMap,n(t.clearcoatRoughnessMap,e.clearcoatRoughnessMapTransform)),t.clearcoatNormalMap&&(e.clearcoatNormalMap.value=t.clearcoatNormalMap,n(t.clearcoatNormalMap,e.clearcoatNormalMapTransform),e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale),t.side===1&&e.clearcoatNormalScale.value.negate())),t.dispersion>0&&(e.dispersion.value=t.dispersion),t.retroreflectivity>0&&(e.retroreflectivity.value=t.retroreflectivity),t.iridescence>0&&(e.iridescence.value=t.iridescence,e.iridescenceIOR.value=t.iridescenceIOR,e.iridescenceThicknessMinimum.value=t.iridescenceThicknessRange[0],e.iridescenceThicknessMaximum.value=t.iridescenceThicknessRange[1],t.iridescenceMap&&(e.iridescenceMap.value=t.iridescenceMap,n(t.iridescenceMap,e.iridescenceMapTransform)),t.iridescenceThicknessMap&&(e.iridescenceThicknessMap.value=t.iridescenceThicknessMap,n(t.iridescenceThicknessMap,e.iridescenceThicknessMapTransform))),t.transmission>0&&(e.transmission.value=t.transmission,e.transmissionSamplerMap.value=r.texture,e.transmissionSamplerSize.value.set(r.width,r.height),t.transmissionMap&&(e.transmissionMap.value=t.transmissionMap,n(t.transmissionMap,e.transmissionMapTransform)),e.thickness.value=t.thickness,t.thicknessMap&&(e.thicknessMap.value=t.thicknessMap,n(t.thicknessMap,e.thicknessMapTransform)),e.attenuationDistance.value=t.attenuationDistance,e.attenuationColor.value.copy(t.attenuationColor)),t.anisotropy>0&&(e.anisotropyVector.value.set(t.anisotropy*Math.cos(t.anisotropyRotation),t.anisotropy*Math.sin(t.anisotropyRotation)),t.anisotropyMap&&(e.anisotropyMap.value=t.anisotropyMap,n(t.anisotropyMap,e.anisotropyMapTransform))),e.specularIntensity.value=t.specularIntensity,e.specularColor.value.copy(t.specularColor),t.specularColorMap&&(e.specularColorMap.value=t.specularColorMap,n(t.specularColorMap,e.specularColorMapTransform)),t.specularIntensityMap&&(e.specularIntensityMap.value=t.specularIntensityMap,n(t.specularIntensityMap,e.specularIntensityMapTransform))}function m(e,t){t.matcap&&(e.matcap.value=t.matcap)}function h(e,n){let r=t.get(n).light;e.referencePosition.value.setFromMatrixPosition(r.matrixWorld),e.nearDistance.value=r.shadow.camera.near,e.farDistance.value=r.shadow.camera.far}return{refreshFogUniforms:r,refreshMaterialUniforms:i}}function bf(e,t,n,r){let i={},a={},o=[],s=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(e,t){let n=t.program;r.uniformBlockBinding(e,n)}function l(e,n){let o=i[e.id];o===void 0&&(g(e),o=u(e),i[e.id]=o,e.addEventListener(`dispose`,v));let s=n.program;r.updateUBOMapping(e,s);let c=t.render.frame;a[e.id]!==c&&(f(e),a[e.id]=c)}function u(t){let n=d();t.__bindingPointIndex=n;let r=e.createBuffer(),i=t.__size,a=t.usage;return e.bindBuffer(e.UNIFORM_BUFFER,r),e.bufferData(e.UNIFORM_BUFFER,i,a),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,n,r),r}function d(){for(let e=0;e<s;e++)if(o.indexOf(e)===-1)return o.push(e),e;return ci(`WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached.`),0}function f(t){let n=i[t.id],r=t.uniforms,a=t.__cache;e.bindBuffer(e.UNIFORM_BUFFER,n);for(let e=0,t=r.length;e<t;e++){let t=r[e];if(Array.isArray(t))for(let n=0,r=t.length;n<r;n++)p(t[n],e,n,a);else p(t,e,0,a)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(t,n,r,i){if(h(t,n,r,i)===!0){let n=t.__offset,r=t.value;if(Array.isArray(r)){let e=0;for(let n=0;n<r.length;n++){let i=r[n],a=_(i);m(i,t.__data,e),typeof i!=`number`&&typeof i!=`boolean`&&!i.isMatrix3&&!ArrayBuffer.isView(i)&&(e+=a.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(r,t.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,n,t.__data)}}function m(e,t,n){typeof e==`number`||typeof e==`boolean`?t[0]=e:e.isMatrix3?(t[0]=e.elements[0],t[1]=e.elements[1],t[2]=e.elements[2],t[3]=0,t[4]=e.elements[3],t[5]=e.elements[4],t[6]=e.elements[5],t[7]=0,t[8]=e.elements[6],t[9]=e.elements[7],t[10]=e.elements[8],t[11]=0):ArrayBuffer.isView(e)?t.set(new e.constructor(e.buffer,e.byteOffset,t.length)):e.toArray(t,n)}function h(e,t,n,r){let i=e.value,a=t+`_`+n;if(r[a]===void 0)return r[a]=typeof i==`number`||typeof i==`boolean`?i:ArrayBuffer.isView(i)?i.slice():i.clone(),!0;{let e=r[a];if(typeof i==`number`||typeof i==`boolean`){if(e!==i)return r[a]=i,!0}else if(ArrayBuffer.isView(i))return!0;else if(e.equals(i)===!1)return e.copy(i),!0}return!1}function g(e){let t=e.uniforms,n=0;for(let e=0,r=t.length;e<r;e++){let r=Array.isArray(t[e])?t[e]:[t[e]];for(let e=0,t=r.length;e<t;e++){let t=r[e],i=Array.isArray(t.value)?t.value:[t.value];for(let e=0,r=i.length;e<r;e++){let r=i[e],a=_(r),o=n%16,s=o%a.boundary,c=o+s;n+=s,c!==0&&16-c<a.storage&&(n+=16-c),t.__data=new Float32Array(a.storage/Float32Array.BYTES_PER_ELEMENT),t.__offset=n,n+=a.storage}}}let r=n%16;return r>0&&(n+=16-r),e.__size=n,e.__cache={},this}function _(e){let t={boundary:0,storage:0};return typeof e==`number`||typeof e==`boolean`?(t.boundary=4,t.storage=4):e.isVector2?(t.boundary=8,t.storage=8):e.isVector3||e.isColor?(t.boundary=16,t.storage=12):e.isVector4?(t.boundary=16,t.storage=16):e.isMatrix3?(t.boundary=48,t.storage=48):e.isMatrix4?(t.boundary=64,t.storage=64):e.isTexture?Y(`WebGLRenderer: Texture samplers can not be part of an uniforms group.`):ArrayBuffer.isView(e)?(t.boundary=16,t.storage=e.byteLength):Y(`WebGLRenderer: Unsupported uniform value type.`,e),t}function v(t){let n=t.target;n.removeEventListener(`dispose`,v);let r=o.indexOf(n.__bindingPointIndex);o.splice(r,1),e.deleteBuffer(i[n.id]),delete i[n.id],delete a[n.id]}function y(){for(let t in i)e.deleteBuffer(i[t]);o=[],i={},a={}}return{bind:c,update:l,dispose:y}}var xf=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Sf=null;function Cf(){return Sf===null&&(Sf=new gs(xf,16,16,er,Vn),Sf.name=`DFG_LUT`,Sf.minFilter=jn,Sf.magFilter=jn,Sf.wrapS=En,Sf.wrapT=En,Sf.generateMipmaps=!1,Sf.needsUpdate=!0),Sf}var wf=class{constructor(e={}){let{canvas:t=ii(),context:n=null,depth:r=!0,stencil:i=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:s=!0,preserveDrawingBuffer:c=!1,powerPreference:l=`default`,failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1,outputBufferType:f=Pn}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<`u`&&n instanceof WebGLRenderingContext)throw Error(`THREE.WebGLRenderer: WebGL 1 is not supported since r163.`);p=n.getContextAttributes().alpha}else p=a;let m=f,h=new Set([nr,tr,$n]),g=new Set([Pn,zn,Ln,Wn,Hn,Un]),_=new Uint32Array(4),v=new Int32Array(4),y=new X,b=null,x=null,S=[],C=[],w=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let T=this,E=!1,D=null,O=null,k=null,A=null;this._outputColorSpace=qr;let j=0,M=0,N=null,P=-1,F=null,I=new oa,L=new oa,R=null,z=new Ka(0),ee=0,B=t.width,te=t.height,ne=1,V=null,H=null,re=new oa(0,0,B,te),ie=new oa(0,0,B,te),ae=!1,oe=new xs,se=!1,ce=!1,le=new da,ue=new X,de=new oa,fe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},pe=!1;function me(){return N===null?ne:1}let U=n;function he(e,n){return t.getContext(e,n)}let ge,_e,W,ve,G,K,ye,q,J,be,xe,Se,Ce,we,Te,Ee,De,Oe,ke,Ae,je,Me,Ne;try{let e={alpha:!0,depth:r,stencil:i,antialias:o,premultipliedAlpha:s,preserveDrawingBuffer:c,powerPreference:l,failIfMajorPerformanceCaveat:u};if(`setAttribute`in t&&t.setAttribute(`data-engine`,`three.js r186`),t.addEventListener(`webglcontextlost`,Ie,!1),t.addEventListener(`webglcontextrestored`,Le,!1),t.addEventListener(`webglcontextcreationerror`,Re,!1),U===null){let t=`webgl2`;if(U=he(t,e),U===null)throw he(t)?Error(`THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.`):Error(`THREE.WebGLRenderer: Error creating WebGL context.`)}Pe()}catch(e){throw t.removeEventListener(`webglcontextlost`,Ie,!1),t.removeEventListener(`webglcontextrestored`,Le,!1),t.removeEventListener(`webglcontextcreationerror`,Re,!1),ci(`WebGLRenderer: `+e.message),e}function Pe(){ge=new Vl(U),ge.init(),je=new ff(U,ge),_e=new gl(U,ge,e,je),W=new uf(U,ge),_e.reversedDepthBuffer&&d&&W.buffers.depth.setReversed(!0),O=U.createFramebuffer(),k=U.createFramebuffer(),A=U.createFramebuffer(),ve=new Wl(U),G=new Ud,K=new df(U,ge,W,G,_e,je,ve),ye=new Bl(T),q=new sl(U),Me=new ml(U,q),J=new Hl(U,q,ve,Me),be=new Kl(U,J,q,Me,ve),Oe=new Gl(U,_e,K),Te=new _l(G),xe=new Hd(T,ye,ge,_e,Me,Te),Se=new yf(T,G),Ce=new qd,we=new ef(ge),De=new pl(T,ye,W,be,p,s),Ee=new lf(T,be,_e),Ne=new bf(U,ve,_e,W),ke=new hl(U,ge,ve),Ae=new Ul(U,ge,ve),ve.programs=xe.programs,T.capabilities=_e,T.extensions=ge,T.properties=G,T.renderLists=Ce,T.shadowMap=Ee,T.state=W,T.info=ve}m!==1009&&(w=new Jl(m,t.width,t.height,o,r,i));let Fe=new gf(T,U);this.xr=Fe,this.getContext=function(){return U},this.getContextAttributes=function(){return U.getContextAttributes()},this.forceContextLoss=function(){let e=ge.get(`WEBGL_lose_context`);e&&e.loseContext()},this.forceContextRestore=function(){let e=ge.get(`WEBGL_lose_context`);e&&e.restoreContext()},this.getPixelRatio=function(){return ne},this.setPixelRatio=function(e){e!==void 0&&(ne=e,this.setSize(B,te,!1))},this.getSize=function(e){return e.set(B,te)},this.setSize=function(e,n,r=!0){Fe.isPresenting?Y(`WebGLRenderer: Can't change size while VR device is presenting.`):(B=e,te=n,t.width=Math.floor(e*ne),t.height=Math.floor(n*ne),r===!0&&(t.style.width=e+`px`,t.style.height=n+`px`),w!==null&&w.setSize(t.width,t.height),this.setViewport(0,0,e,n))},this.getDrawingBufferSize=function(e){return e.set(B*ne,te*ne).floor()},this.setDrawingBufferSize=function(e,n,r){B=e,te=n,ne=r,t.width=Math.floor(e*r),t.height=Math.floor(n*r),this.setViewport(0,0,e,n)},this.setEffects=function(e){if(m===1009)ci(`WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.`);else{if(e){for(let t=0;t<e.length;t++)if(e[t].isOutputPass===!0){Y(`WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.`);break}}w.setEffects(e||[])}},this.getCurrentViewport=function(e){return e.copy(I)},this.getViewport=function(e){return e.copy(re)},this.setViewport=function(e,t,n,r){e.isVector4?re.set(e.x,e.y,e.z,e.w):re.set(e,t,n,r),W.viewport(I.copy(re).multiplyScalar(ne).round())},this.getScissor=function(e){return e.copy(ie)},this.setScissor=function(e,t,n,r){e.isVector4?ie.set(e.x,e.y,e.z,e.w):ie.set(e,t,n,r),W.scissor(L.copy(ie).multiplyScalar(ne).round())},this.getScissorTest=function(){return ae},this.setScissorTest=function(e){W.setScissorTest(ae=e)},this.setOpaqueSort=function(e){V=e},this.setTransparentSort=function(e){H=e},this.getClearColor=function(e){return e.copy(De.getClearColor())},this.setClearColor=function(){De.setClearColor(...arguments)},this.getClearAlpha=function(){return De.getClearAlpha()},this.setClearAlpha=function(){De.setClearAlpha(...arguments)},this.clear=function(e=!0,t=!0,n=!0){let r=0;if(e){let e=!1;if(N!==null){let t=N.texture.format;e=h.has(t)}if(e){let e=N.texture.type,t=g.has(e),n=De.getClearColor(),r=De.getClearAlpha(),i=n.r,a=n.g,o=n.b;t?(_[0]=i,_[1]=a,_[2]=o,_[3]=r,U.clearBufferuiv(U.COLOR,0,_)):(v[0]=i,v[1]=a,v[2]=o,v[3]=r,U.clearBufferiv(U.COLOR,0,v))}else r|=U.COLOR_BUFFER_BIT}t&&(r|=U.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),n&&(r|=U.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),r!==0&&U.clear(r)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(e){e.setRenderer(this),D=e},this.dispose=function(){t.removeEventListener(`webglcontextlost`,Ie,!1),t.removeEventListener(`webglcontextrestored`,Le,!1),t.removeEventListener(`webglcontextcreationerror`,Re,!1),De.dispose(),Ce.dispose(),we.dispose(),G.dispose(),ye.dispose(),be.dispose(),Me.dispose(),Ne.dispose(),xe.dispose(),Fe.dispose(),Fe.removeEventListener(`sessionstart`,Ge),Fe.removeEventListener(`sessionend`,Ke),qe.stop()};function Ie(e){e.preventDefault(),oi(`WebGLRenderer: Context Lost.`),E=!0}function Le(){oi(`WebGLRenderer: Context Restored.`),E=!1;let e=ve.autoReset,t=Ee.enabled,n=Ee.autoUpdate,r=Ee.needsUpdate,i=Ee.type;Pe(),ve.autoReset=e,Ee.enabled=t,Ee.autoUpdate=n,Ee.needsUpdate=r,Ee.type=i}function Re(e){ci(`WebGLRenderer: A WebGL context could not be created. Reason: `,e.statusMessage)}function ze(e){let t=e.target;t.removeEventListener(`dispose`,ze),Be(t)}function Be(e){Ve(e),G.remove(e)}function Ve(e){let t=G.get(e).programs;t!==void 0&&(t.forEach(function(e){xe.releaseProgram(e)}),e.isShaderMaterial&&xe.releaseShaderCache(e))}this.renderBufferDirect=function(e,t,n,r,i,a){t===null&&(t=fe);let o=i.isMesh&&i.matrixWorld.determinantAffine()<0,s=rt(e,t,n,r,i);W.setMaterial(r,o);let c=n.index,l=1;if(r.wireframe===!0){if(c=J.getWireframeAttribute(n),c===void 0)return;l=2}let u=n.drawRange,d=n.attributes.position,f=u.start*l,p=(u.start+u.count)*l;a!==null&&(f=Math.max(f,a.start*l),p=Math.min(p,(a.start+a.count)*l)),c===null?d!=null&&(f=Math.max(f,0),p=Math.min(p,d.count)):(f=Math.max(f,0),p=Math.min(p,c.count));let m=p-f;if(m<0||m===1/0)return;Me.setup(i,r,s,n,c);let h,g=ke;if(c!==null&&(h=q.get(c),g=Ae,g.setIndex(h)),i.isMesh)r.wireframe===!0?(W.setLineWidth(r.wireframeLinewidth*me()),g.setMode(U.LINES)):g.setMode(U.TRIANGLES);else if(i.isLine){let e=r.linewidth;e===void 0&&(e=1),W.setLineWidth(e*me()),i.isLineSegments?g.setMode(U.LINES):i.isLineLoop?g.setMode(U.LINE_LOOP):g.setMode(U.LINE_STRIP)}else i.isPoints?g.setMode(U.POINTS):i.isSprite&&g.setMode(U.TRIANGLES);if(i.isBatchedMesh){if(ge.get(`WEBGL_multi_draw`))g.renderMultiDraw(i._multiDrawStarts,i._multiDrawCounts,i._multiDrawCount);else{let e=i._multiDrawStarts,t=i._multiDrawCounts,n=i._multiDrawCount,a=c?q.get(c).bytesPerElement:1,o=G.get(r).currentProgram.getUniforms();for(let r=0;r<n;r++)o.setValue(U,`_gl_DrawID`,r),g.render(e[r]/a,t[r])}}else if(i.isInstancedMesh)g.renderInstances(f,m,i.count);else if(n.isInstancedBufferGeometry){let e=n._maxInstanceCount===void 0?1/0:n._maxInstanceCount,t=Math.min(n.instanceCount,e);g.renderInstances(f,m,t)}else g.render(f,m)};function He(e,t,n,r){D!==null&&e.isNodeMaterial&&D.setObject(r,e),se===!0&&Te.setState(e,n,!1),e.transparent===!0&&e.side===2&&e.forceSinglePass===!1?(e.side=1,e.needsUpdate=!0,$e(e,t,r),e.side=0,e.needsUpdate=!0,$e(e,t,r),e.side=2):$e(e,t,r)}this.compile=function(e,t,n=null){n===null&&(n=e),D!==null&&D.renderStart(e,t,n),x=we.get(n),x.init(t),C.push(x),n.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(x.pushLight(e),e.castShadow&&x.pushShadow(e))}),e!==n&&e.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(x.pushLight(e),e.castShadow&&x.pushShadow(e))}),x.setupLights(),D!==null&&D.updateLights(x.state.lightsArray),ce=this.localClippingEnabled,se=Te.init(this.clippingPlanes,ce),se===!0&&Te.setGlobalState(this.clippingPlanes,t),D!==null&&Ee.render(x.state.shadowsArray,n,t);let r=new Set;return e.traverse(function(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;let i=e.material;if(i){if(Array.isArray(i))for(let a=0;a<i.length;a++){let o=i[a];He(o,n,t,e),r.add(o)}else He(i,n,t,e),r.add(i)}}),x=C.pop(),D!==null&&D.renderEnd(),r},this.compileAsync=function(e,t,n=null){let r=this.compile(e,t,n);return new Promise(t=>{function n(){r.forEach(function(e){let t=G.get(e).currentProgram;(t===void 0||t.isReady())&&r.delete(e)}),r.size===0?t(e):setTimeout(n,10)}ge.get(`KHR_parallel_shader_compile`)===null?setTimeout(n,10):n()})};let Ue=null;function We(e){Ue&&Ue(e)}function Ge(){qe.stop()}function Ke(){qe.start()}let qe=new ol;qe.setAnimationLoop(We),typeof self<`u`&&qe.setContext(self),this.setAnimationLoop=function(e){Ue=e,Fe.setAnimationLoop(e),e===null?qe.stop():qe.start()},Fe.addEventListener(`sessionstart`,Ge),Fe.addEventListener(`sessionend`,Ke),this.render=function(e,t){if(t!==void 0&&t.isCamera!==!0){ci(`WebGLRenderer.render: camera is not an instance of THREE.Camera.`);return}if(E===!0)return;D!==null&&D.renderStart(e,t);let n=Fe.enabled===!0&&Fe.isPresenting===!0,r=w!==null&&(N===null||n)&&w.begin(T,N);if(e.matrixWorldAutoUpdate===!0&&e.updateMatrixWorld(),t.parent===null&&t.matrixWorldAutoUpdate===!0&&t.updateMatrixWorld(),Fe.enabled===!0&&Fe.isPresenting===!0&&(w===null||w.isCompositing()===!1)&&(Fe.cameraAutoUpdate===!0&&Fe.updateCamera(t),t=Fe.getCamera()),e.isScene===!0&&e.onBeforeRender(T,e,t,N),x=we.get(e,C.length),x.init(t),x.state.textureUnits=K.getTextureUnits(),C.push(x),le.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),oe.setFromProjectionMatrix(le,ei,t.reversedDepth),ce=this.localClippingEnabled,se=Te.init(this.clippingPlanes,ce),b=Ce.get(e,S.length),b.init(),S.push(b),Fe.enabled===!0&&Fe.isPresenting===!0){let e=T.xr.getDepthSensingMesh();e!==null&&Je(e,t,-1/0,T.sortObjects)}Je(e,t,0,T.sortObjects),b.finish(),D!==null&&D.updateLights(x.state.lightsArray),T.sortObjects===!0&&b.sort(V,H),pe=Fe.enabled===!1||Fe.isPresenting===!1||Fe.hasDepthSensing()===!1,pe&&De.addToRenderList(b,e),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),se===!0&&Te.beginShadows();let i=x.state.shadowsArray;if(Ee.render(i,e,t),se===!0&&Te.endShadows(),(r&&w.hasRenderPass())===!1){let n=b.opaque,r=b.transmissive;if(x.setupLights(),t.isArrayCamera){let i=t.cameras;if(r.length>0)for(let t=0,a=i.length;t<a;t++){let a=i[t];Xe(n,r,e,a)}pe&&De.render(e);for(let t=0,n=i.length;t<n;t++){let n=i[t];Ye(b,e,n,n.viewport)}}else r.length>0&&Xe(n,r,e,t),pe&&De.render(e),Ye(b,e,t)}N!==null&&M===0&&(K.updateMultisampleRenderTarget(N),K.updateRenderTargetMipmap(N)),r&&w.end(T),e.isScene===!0&&e.onAfterRender(T,e,t),Me.resetDefaultState(),P=-1,F=null,C.pop(),C.length>0?(x=C[C.length-1],K.setTextureUnits(x.state.textureUnits),se===!0&&Te.setGlobalState(T.clippingPlanes,x.state.camera)):x=null,S.pop(),b=S.length>0?S[S.length-1]:null,D!==null&&D.renderEnd()};function Je(e,t,n,r){if(e.visible===!1)return;if(e.layers.test(t.layers)){if(e.isGroup)n=e.renderOrder;else if(e.isLOD)e.autoUpdate===!0&&e.update(t);else if(e.isLightProbeGrid)x.pushLightProbeGrid(e);else if(e.isLight)x.pushLight(e),e.castShadow&&x.pushShadow(e);else if(e.isSprite){if(!e.frustumCulled||e.intersectsFrustum(oe)){r&&de.setFromMatrixPosition(e.matrixWorld).applyMatrix4(le);let i=be.update(e),a=e.material;a.visible&&b.push(e,i,a,n,de.z,null,t)}}else if((e.isMesh||e.isLine||e.isPoints)&&(!e.frustumCulled||e.intersectsFrustum(oe))){let i=be.update(e),a=e.material;if(r&&(e.boundingSphere===void 0?(i.boundingSphere===null&&i.computeBoundingSphere(),de.copy(i.boundingSphere.center)):(e.boundingSphere===null&&e.computeBoundingSphere(),de.copy(e.boundingSphere.center)),de.applyMatrix4(e.matrixWorld).applyMatrix4(le)),Array.isArray(a)){let r=i.groups;for(let o=0,s=r.length;o<s;o++){let s=r[o],c=a[s.materialIndex];c&&c.visible&&b.push(e,i,c,n,de.z,s,t)}}else a.visible&&b.push(e,i,a,n,de.z,null,t)}}let i=e.children;for(let e=0,a=i.length;e<a;e++)Je(i[e],t,n,r)}function Ye(e,t,n,r){let{opaque:i,transmissive:a,transparent:o}=e;x.setupLightsView(n),se===!0&&Te.setGlobalState(T.clippingPlanes,n),r&&W.viewport(I.copy(r)),i.length>0&&Ze(i,t,n),a.length>0&&Ze(a,t,n),o.length>0&&Ze(o,t,n),W.buffers.depth.setTest(!0),W.buffers.depth.setMask(!0),W.buffers.color.setMask(!0),W.setPolygonOffset(!1)}function Xe(e,t,n,r){if((n.isScene===!0?n.overrideMaterial:null)!==null)return;if(x.state.transmissionRenderTarget[r.id]===void 0){let e=ge.has(`EXT_color_buffer_half_float`)||ge.has(`EXT_color_buffer_float`);x.state.transmissionRenderTarget[r.id]=new ca(1,1,{generateMipmaps:!0,type:e?Vn:Pn,minFilter:Nn,samples:Math.max(4,_e.samples),stencilBuffer:i,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Yi.workingColorSpace})}let a=x.state.transmissionRenderTarget[r.id],o=r.viewport||I;a.setSize(o.z*T.transmissionResolutionScale,o.w*T.transmissionResolutionScale);let s=T.getRenderTarget(),c=T.getActiveCubeFace(),l=T.getActiveMipmapLevel();T.setRenderTarget(a),T.getClearColor(z),ee=T.getClearAlpha(),ee<1&&T.setClearColor(16777215,.5),T.clear(),pe&&De.render(n);let u=T.toneMapping;T.toneMapping=0;let d=r.viewport;if(r.viewport!==void 0&&(r.viewport=void 0),x.setupLightsView(r),se===!0&&Te.setGlobalState(T.clippingPlanes,r),Ze(e,n,r),K.updateMultisampleRenderTarget(a),K.updateRenderTargetMipmap(a),ge.has(`WEBGL_multisampled_render_to_texture`)===!1){let e=!1;for(let i=0,a=t.length;i<a;i++){let{object:a,geometry:o,material:s,group:c}=t[i];if(s.side===2&&a.layers.test(r.layers)){let t=s.side;s.side=1,s.needsUpdate=!0,Qe(a,n,r,o,s,c),s.side=t,s.needsUpdate=!0,e=!0}}e===!0&&(K.updateMultisampleRenderTarget(a),K.updateRenderTargetMipmap(a))}T.setRenderTarget(s,c,l),T.setClearColor(z,ee),d!==void 0&&(r.viewport=d),T.toneMapping=u}function Ze(e,t,n){let r=t.isScene===!0?t.overrideMaterial:null;for(let i=0,a=e.length;i<a;i++){let a=e[i],{object:o,geometry:s,group:c}=a,l=a.material;l.allowOverride===!0&&r!==null&&(l=r),o.layers.test(n.layers)&&Qe(o,t,n,s,l,c)}}function Qe(e,t,n,r,i,a){D!==null&&i.isNodeMaterial&&D.setObject(e,i),e.onBeforeRender(T,t,n,r,i,a),e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse,e.matrixWorld),e.normalMatrix.getNormalMatrix(e.modelViewMatrix),i.onBeforeRender(T,t,n,r,e,a),i.transparent===!0&&i.side===2&&i.forceSinglePass===!1?(i.side=1,i.needsUpdate=!0,T.renderBufferDirect(n,t,r,i,e,a),i.side=0,i.needsUpdate=!0,T.renderBufferDirect(n,t,r,i,e,a),i.side=2):T.renderBufferDirect(n,t,r,i,e,a),e.onAfterRender(T,t,n,r,i,a)}function $e(e,t,n){t.isScene!==!0&&(t=fe);let r=G.get(e),i=x.state.lights,a=x.state.shadowsArray,o=i.state.version,s=xe.getParameters(e,i.state,a,t,n,x.state.lightProbeGridArray),c=xe.getProgramCacheKey(s),l=r.programs;r.environment=e.isMeshStandardMaterial||e.isMeshLambertMaterial||e.isMeshPhongMaterial?t.environment:null,r.fog=t.fog;let u=e.isMeshStandardMaterial||e.isMeshLambertMaterial&&!e.envMap||e.isMeshPhongMaterial&&!e.envMap;r.envMap=ye.get(e.envMap||r.environment,u),r.envMapRotation=r.environment!==null&&e.envMap===null?t.environmentRotation:e.envMapRotation,l===void 0&&(e.addEventListener(`dispose`,ze),l=new Map,r.programs=l);let d=l.get(c);if(d!==void 0){if(r.currentProgram===d&&r.lightsStateVersion===o)return tt(e,s),d}else s.uniforms=xe.getUniforms(e),D!==null&&e.isNodeMaterial&&D.build(e,n,s),e.onBeforeCompile(s,T),d=xe.acquireProgram(s,c),l.set(c,d),r.uniforms=s.uniforms;let f=r.uniforms;return(!e.isShaderMaterial&&!e.isRawShaderMaterial||e.clipping===!0)&&(f.clippingPlanes=Te.uniform),tt(e,s),r.needsLights=at(e),r.lightsStateVersion=o,r.needsLights&&(f.ambientLightColor.value=i.state.ambient,f.lightProbe.value=i.state.probe,f.sunLights.value=i.state.sun,f.sunLightShadows.value=i.state.sunShadow,f.directionalLights.value=i.state.directional,f.directionalLightShadows.value=i.state.directionalShadow,f.spotLights.value=i.state.spot,f.spotLightShadows.value=i.state.spotShadow,f.rectAreaLights.value=i.state.rectArea,f.ltc_1.value=i.state.rectAreaLTC1,f.ltc_2.value=i.state.rectAreaLTC2,f.pointLights.value=i.state.point,f.pointLightShadows.value=i.state.pointShadow,f.hemisphereLights.value=i.state.hemi,f.sunShadowMatrix.value=i.state.sunShadowMatrix,f.sunShadowCascade.value=i.state.sunShadowCascade,f.directionalShadowMatrix.value=i.state.directionalShadowMatrix,f.spotLightMatrix.value=i.state.spotLightMatrix,f.spotLightMap.value=i.state.spotLightMap,f.pointShadowMatrix.value=i.state.pointShadowMatrix),r.lightProbeGrid=x.state.lightProbeGridArray.length>0,r.currentProgram=d,r.uniformsList=null,d}function et(e){if(e.uniformsList===null){let t=e.currentProgram.getUniforms();e.uniformsList=td.seqWithValue(t.seq,e.uniforms)}return e.uniformsList}function tt(e,t){let n=G.get(e);n.outputColorSpace=t.outputColorSpace,n.batching=t.batching,n.batchingColor=t.batchingColor,n.instancing=t.instancing,n.instancingColor=t.instancingColor,n.instancingMorph=t.instancingMorph,n.skinning=t.skinning,n.morphTargets=t.morphTargets,n.morphNormals=t.morphNormals,n.morphColors=t.morphColors,n.morphTargetsCount=t.morphTargetsCount,n.numClippingPlanes=t.numClippingPlanes,n.numIntersection=t.numClipIntersection,n.vertexAlphas=t.vertexAlphas,n.vertexTangents=t.vertexTangents,n.toneMapping=t.toneMapping}function nt(e,t){if(e.length===0)return null;if(e.length===1)return e[0].texture===null?null:e[0];y.setFromMatrixPosition(t.matrixWorld);for(let t=0,n=e.length;t<n;t++){let n=e[t];if(n.texture!==null&&n.boundingBox.containsPoint(y))return n}return null}function rt(e,t,n,r,i){t.isScene!==!0&&(t=fe),K.resetTextureUnits();let a=t.fog,o=r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial?t.environment:null,s=N===null?T.outputColorSpace:N.isXRRenderTarget===!0?N.texture.colorSpace:Yi.workingColorSpace,c=r.isMeshStandardMaterial||r.isMeshLambertMaterial&&!r.envMap||r.isMeshPhongMaterial&&!r.envMap,l=ye.get(r.envMap||o,c),u=r.vertexColors===!0&&!!n.attributes.color&&n.attributes.color.itemSize===4,d=!!n.attributes.tangent&&(!!r.normalMap||r.anisotropy>0),f=!!n.morphAttributes.position,p=!!n.morphAttributes.normal,m=!!n.morphAttributes.color,h=0;r.toneMapped&&(N===null||N.isXRRenderTarget===!0)&&(h=T.toneMapping);let g=n.morphAttributes.position||n.morphAttributes.normal||n.morphAttributes.color,_=g===void 0?0:g.length,v=G.get(r),y=x.state.lights;if(se===!0&&(ce===!0||e!==F)){let t=e===F&&r.id===P;Te.setState(r,e,t)}let b=!1;r.version===v.__version?v.needsLights&&v.lightsStateVersion!==y.state.version?b=!0:v.outputColorSpace===s?i.isBatchedMesh&&v.batching===!1||!i.isBatchedMesh&&v.batching===!0||i.isBatchedMesh&&v.batchingColor===!0&&i._colorsTexture===null||i.isBatchedMesh&&v.batchingColor===!1&&i._colorsTexture!==null||i.isInstancedMesh&&v.instancing===!1||!i.isInstancedMesh&&v.instancing===!0||i.isSkinnedMesh&&v.skinning===!1||!i.isSkinnedMesh&&v.skinning===!0||i.isInstancedMesh&&v.instancingColor===!0&&i.instanceColor===null||i.isInstancedMesh&&v.instancingColor===!1&&i.instanceColor!==null||i.isInstancedMesh&&v.instancingMorph===!0&&i.morphTexture===null||i.isInstancedMesh&&v.instancingMorph===!1&&i.morphTexture!==null?b=!0:v.envMap===l?r.fog===!0&&v.fog!==a||v.numClippingPlanes!==void 0&&(v.numClippingPlanes!==Te.numPlanes||v.numIntersection!==Te.numIntersection)?b=!0:v.vertexAlphas===u&&v.vertexTangents===d&&v.morphTargets===f&&v.morphNormals===p&&v.morphColors===m&&v.toneMapping===h&&v.morphTargetsCount===_?!!v.lightProbeGrid!=x.state.lightProbeGridArray.length>0&&(b=!0):b=!0:b=!0:b=!0:(b=!0,v.__version=r.version);let S=v.currentProgram;b===!0&&(S=$e(r,t,i),D&&r.isNodeMaterial&&D.onUpdateProgram(r,S,v));let C=!1,w=!1,E=!1,O=S.getUniforms(),k=v.uniforms;if(W.useProgram(S.program)&&(C=!0,w=!0,E=!0),r.id!==P&&(P=r.id,w=!0),v.needsLights){let e=nt(x.state.lightProbeGridArray,i);v.lightProbeGrid!==e&&(v.lightProbeGrid=e,w=!0)}if(C||F!==e){W.buffers.depth.getReversed()&&e.reversedDepth!==!0&&(e._reversedDepth=!0,e.updateProjectionMatrix()),O.setValue(U,`projectionMatrix`,e.projectionMatrix),O.setValue(U,`viewMatrix`,e.matrixWorldInverse);let t=O.map.cameraPosition;t!==void 0&&t.setValue(U,ue.setFromMatrixPosition(e.matrixWorld)),_e.logarithmicDepthBuffer&&O.setValue(U,`logDepthBufFC`,2/(Math.log(e.far+1)/Math.LN2)),(r.isMeshPhongMaterial||r.isMeshToonMaterial||r.isMeshLambertMaterial||r.isMeshBasicMaterial||r.isMeshStandardMaterial||r.isShaderMaterial)&&O.setValue(U,`isOrthographic`,e.isOrthographicCamera===!0),F!==e&&(F=e,w=!0,E=!0)}if(v.needsLights&&(y.state.sunShadowMap.length>0&&O.setValue(U,`sunShadowMap`,y.state.sunShadowMap,K),y.state.directionalShadowMap.length>0&&O.setValue(U,`directionalShadowMap`,y.state.directionalShadowMap,K),y.state.spotShadowMap.length>0&&O.setValue(U,`spotShadowMap`,y.state.spotShadowMap,K),y.state.pointShadowMap.length>0&&O.setValue(U,`pointShadowMap`,y.state.pointShadowMap,K)),i.isSkinnedMesh){O.setOptional(U,i,`bindMatrix`),O.setOptional(U,i,`bindMatrixInverse`);let e=i.skeleton;e&&(e.boneTexture===null&&e.computeBoneTexture(),O.setValue(U,`boneTexture`,e.boneTexture,K))}i.isBatchedMesh&&(O.setOptional(U,i,`batchingTexture`),O.setValue(U,`batchingTexture`,i._matricesTexture,K),O.setOptional(U,i,`batchingIdTexture`),O.setValue(U,`batchingIdTexture`,i._indirectTexture,K),O.setOptional(U,i,`batchingColorTexture`),i._colorsTexture!==null&&O.setValue(U,`batchingColorTexture`,i._colorsTexture,K));let A=n.morphAttributes;if((A.position!==void 0||A.normal!==void 0||A.color!==void 0)&&Oe.update(i,n,S),(w||v.receiveShadow!==i.receiveShadow)&&(v.receiveShadow=i.receiveShadow,O.setValue(U,`receiveShadow`,i.receiveShadow)),(r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial)&&r.envMap===null&&t.environment!==null&&(k.envMapIntensity.value=t.environmentIntensity),k.dfgLUT!==void 0&&(k.dfgLUT.value=Cf()),w){if(O.setValue(U,`toneMappingExposure`,T.toneMappingExposure),v.needsLights&&it(k,E),a&&r.fog===!0&&Se.refreshFogUniforms(k,a),Se.refreshMaterialUniforms(k,r,ne,te,x.state.transmissionRenderTarget[e.id]),v.needsLights&&v.lightProbeGrid){let e=v.lightProbeGrid;k.probesSH.value=e.texture,k.probesMin.value.copy(e.boundingBox.min),k.probesMax.value.copy(e.boundingBox.max),k.probesResolution.value.copy(e.resolution)}td.upload(U,et(v),k,K)}if(r.isShaderMaterial&&r.uniformsNeedUpdate===!0&&(td.upload(U,et(v),k,K),r.uniformsNeedUpdate=!1),r.isSpriteMaterial&&O.setValue(U,`center`,i.center),O.setValue(U,`modelViewMatrix`,i.modelViewMatrix),O.setValue(U,`normalMatrix`,i.normalMatrix),O.setValue(U,`modelMatrix`,i.matrixWorld),r.uniformsGroups!==void 0){let e=r.uniformsGroups;for(let t=0,n=e.length;t<n;t++){let n=e[t];Ne.update(n,S),Ne.bind(n,S)}}return S}function it(e,t){e.ambientLightColor.needsUpdate=t,e.lightProbe.needsUpdate=t,e.sunLights.needsUpdate=t,e.sunLightShadows.needsUpdate=t,e.directionalLights.needsUpdate=t,e.directionalLightShadows.needsUpdate=t,e.pointLights.needsUpdate=t,e.pointLightShadows.needsUpdate=t,e.spotLights.needsUpdate=t,e.spotLightShadows.needsUpdate=t,e.rectAreaLights.needsUpdate=t,e.hemisphereLights.needsUpdate=t}function at(e){return e.isMeshLambertMaterial||e.isMeshToonMaterial||e.isMeshPhongMaterial||e.isMeshStandardMaterial||e.isShadowMaterial||e.isShaderMaterial&&e.lights===!0}this.getActiveCubeFace=function(){return j},this.getActiveMipmapLevel=function(){return M},this.getRenderTarget=function(){return N},this.setRenderTargetTextures=function(e,t,n){let r=G.get(e);r.__autoAllocateDepthBuffer=e.resolveDepthBuffer===!1,r.__autoAllocateDepthBuffer===!1&&(r.__useRenderToTexture=!1),G.get(e.texture).__webglTexture=t,G.get(e.depthTexture).__webglTexture=r.__autoAllocateDepthBuffer?void 0:n,r.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(e,t){let n=G.get(e);n.__webglFramebuffer=t,n.__useDefaultFramebuffer=t===void 0},this.setRenderTarget=function(e,t=0,n=0){N=e,j=t,M=n;let r=null,i=!1,a=!1;if(e){let o=G.get(e);if(o.__useDefaultFramebuffer!==void 0){W.bindFramebuffer(U.FRAMEBUFFER,o.__webglFramebuffer),I.copy(e.viewport),L.copy(e.scissor),R=e.scissorTest,W.viewport(I),W.scissor(L),W.setScissorTest(R),P=-1;return}if(o.__webglFramebuffer===void 0)K.setupRenderTarget(e);else if(o.__hasExternalTextures)K.rebindTextures(e,G.get(e.texture).__webglTexture,G.get(e.depthTexture).__webglTexture);else if(e.depthBuffer){let t=e.depthTexture;if(o.__boundDepthTexture!==t){if(t!==null&&G.has(t)&&(e.width!==t.image.width||e.height!==t.image.height))throw Error(`THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.`);K.setupDepthRenderbuffer(e)}}let s=e.texture;(s.isData3DTexture||s.isDataArrayTexture||s.isCompressedArrayTexture)&&(a=!0);let c=G.get(e).__webglFramebuffer;e.isWebGLCubeRenderTarget?(r=Array.isArray(c[t])?c[t][n]:c[t],i=!0):r=e.samples>0&&K.useMultisampledRTT(e)===!1?G.get(e).__webglMultisampledFramebuffer:Array.isArray(c)?c[n]:c,I.copy(e.viewport),L.copy(e.scissor),R=e.scissorTest}else I.copy(re).multiplyScalar(ne).floor(),L.copy(ie).multiplyScalar(ne).floor(),R=ae;if(n!==0&&(r=O),W.bindFramebuffer(U.FRAMEBUFFER,r)&&W.drawBuffers(e,r),W.viewport(I),W.scissor(L),W.setScissorTest(R),i){let r=G.get(e.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_CUBE_MAP_POSITIVE_X+t,r.__webglTexture,n)}else if(a){let r=t;for(let t=0;t<e.textures.length;t++){let i=G.get(e.textures[t]);U.framebufferTextureLayer(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0+t,i.__webglTexture,n,r)}}else if(e!==null&&n!==0){let t=G.get(e.texture);U.framebufferTexture2D(U.FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,t.__webglTexture,n)}P=-1};function ot(e){let t=G.get(e);return(t.__readFormat!==e.format||t.__readType!==e.type)&&(t.__readFormat=e.format,t.__readType=e.type,t.__formatReadable=_e.textureFormatReadable(e.format),t.__typeReadable=_e.textureTypeReadable(e.type)),t}this.readRenderTargetPixels=function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget)){ci(`WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);return}let c=G.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){W.bindFramebuffer(U.FRAMEBUFFER,c);try{let o=e.textures[s],c=o.format,l=o.type;e.textures.length>1&&U.readBuffer(U.COLOR_ATTACHMENT0+s);let u=ot(o);if(u.__formatReadable===!1){ci(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.`);return}if(u.__typeReadable===!1){ci(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.`);return}t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i&&U.readPixels(t,n,r,i,je.convert(c),je.convert(l),a)}finally{let e=N===null?null:G.get(N).__webglFramebuffer;W.bindFramebuffer(U.FRAMEBUFFER,e)}}},this.readRenderTargetPixelsAsync=async function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget))throw Error(`THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);let c=G.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){if(t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i){W.bindFramebuffer(U.FRAMEBUFFER,c);let o=e.textures[s],l=o.format,u=o.type;e.textures.length>1&&U.readBuffer(U.COLOR_ATTACHMENT0+s);let d=ot(o);if(d.__formatReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.`);if(d.__typeReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.`);let f=U.createBuffer();U.bindBuffer(U.PIXEL_PACK_BUFFER,f),U.bufferData(U.PIXEL_PACK_BUFFER,a.byteLength,U.STREAM_READ),U.readPixels(t,n,r,i,je.convert(l),je.convert(u),0),U.bindBuffer(U.PIXEL_PACK_BUFFER,null);let p=N===null?null:G.get(N).__webglFramebuffer;W.bindFramebuffer(U.FRAMEBUFFER,p);let m=U.fenceSync(U.SYNC_GPU_COMMANDS_COMPLETE,0);return U.flush(),await ui(U,m,4),U.bindBuffer(U.PIXEL_PACK_BUFFER,f),U.getBufferSubData(U.PIXEL_PACK_BUFFER,0,a),U.bindBuffer(U.PIXEL_PACK_BUFFER,null),U.deleteBuffer(f),U.deleteSync(m),a}throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.`)}},this.copyFramebufferToTexture=function(e,t=null,n=0){let r=2**-n,i=Math.floor(e.image.width*r),a=Math.floor(e.image.height*r),o=t===null?0:t.x,s=t===null?0:t.y;K.setTexture2D(e,0),U.copyTexSubImage2D(U.TEXTURE_2D,n,0,0,o,s,i,a),W.unbindTexture()},this.copyTextureToTexture=function(e,t,n=null,r=null,i=0,a=0){let o,s,c,l,u,d,f,p,m,h=e.isCompressedTexture?e.mipmaps[a]:e.image;if(n!==null)o=n.max.x-n.min.x,s=n.max.y-n.min.y,c=n.isBox3?n.max.z-n.min.z:1,l=n.min.x,u=n.min.y,d=n.isBox3?n.min.z:0;else{let t=2**-i;o=Math.floor(h.width*t),s=Math.floor(h.height*t),c=e.isDataArrayTexture?h.depth:e.isData3DTexture?Math.floor(h.depth*t):1,l=0,u=0,d=0}r===null?(f=0,p=0,m=0):(f=r.x,p=r.y,m=r.z);let g=je.convert(t.format),_=je.convert(t.type),v;t.isData3DTexture?(K.setTexture3D(t,0),v=U.TEXTURE_3D):t.isDataArrayTexture||t.isCompressedArrayTexture?(K.setTexture2DArray(t,0),v=U.TEXTURE_2D_ARRAY):(K.setTexture2D(t,0),v=U.TEXTURE_2D),W.activeTexture(U.TEXTURE0),W.pixelStorei(U.UNPACK_FLIP_Y_WEBGL,t.flipY),W.pixelStorei(U.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),W.pixelStorei(U.UNPACK_ALIGNMENT,t.unpackAlignment);let y=W.getParameter(U.UNPACK_ROW_LENGTH),b=W.getParameter(U.UNPACK_IMAGE_HEIGHT),x=W.getParameter(U.UNPACK_SKIP_PIXELS),S=W.getParameter(U.UNPACK_SKIP_ROWS),C=W.getParameter(U.UNPACK_SKIP_IMAGES);W.pixelStorei(U.UNPACK_ROW_LENGTH,h.width),W.pixelStorei(U.UNPACK_IMAGE_HEIGHT,h.height),W.pixelStorei(U.UNPACK_SKIP_PIXELS,l),W.pixelStorei(U.UNPACK_SKIP_ROWS,u),W.pixelStorei(U.UNPACK_SKIP_IMAGES,d);let w=e.isDataArrayTexture||e.isData3DTexture,T=t.isDataArrayTexture||t.isData3DTexture;if(e.isDepthTexture){let n=G.get(e),r=G.get(t),h=G.get(n.__renderTarget),g=G.get(r.__renderTarget);W.bindFramebuffer(U.READ_FRAMEBUFFER,h.__webglFramebuffer),W.bindFramebuffer(U.DRAW_FRAMEBUFFER,g.__webglFramebuffer);for(let n=0;n<c;n++)w&&(U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,G.get(e).__webglTexture,i,d+n),U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,G.get(t).__webglTexture,a,m+n)),U.blitFramebuffer(l,u,o,s,f,p,o,s,U.DEPTH_BUFFER_BIT,U.NEAREST);W.bindFramebuffer(U.READ_FRAMEBUFFER,null),W.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else if(i!==0||e.isRenderTargetTexture||G.has(e)){let n=G.get(e),r=G.get(t);W.bindFramebuffer(U.READ_FRAMEBUFFER,k),W.bindFramebuffer(U.DRAW_FRAMEBUFFER,A);for(let e=0;e<c;e++)w?U.framebufferTextureLayer(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,n.__webglTexture,i,d+e):U.framebufferTexture2D(U.READ_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,n.__webglTexture,i),T?U.framebufferTextureLayer(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,r.__webglTexture,a,m+e):U.framebufferTexture2D(U.DRAW_FRAMEBUFFER,U.COLOR_ATTACHMENT0,U.TEXTURE_2D,r.__webglTexture,a),i===0?T?U.copyTexSubImage3D(v,a,f,p,m+e,l,u,o,s):U.copyTexSubImage2D(v,a,f,p,l,u,o,s):U.blitFramebuffer(l,u,o,s,f,p,o,s,U.COLOR_BUFFER_BIT,U.NEAREST);W.bindFramebuffer(U.READ_FRAMEBUFFER,null),W.bindFramebuffer(U.DRAW_FRAMEBUFFER,null)}else T?e.isDataTexture||e.isData3DTexture?U.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h.data):t.isCompressedArrayTexture?U.compressedTexSubImage3D(v,a,f,p,m,o,s,c,g,h.data):U.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h):e.isDataTexture?U.texSubImage2D(U.TEXTURE_2D,a,f,p,o,s,g,_,h.data):e.isCompressedTexture?U.compressedTexSubImage2D(U.TEXTURE_2D,a,f,p,h.width,h.height,g,h.data):U.texSubImage2D(U.TEXTURE_2D,a,f,p,o,s,g,_,h);W.pixelStorei(U.UNPACK_ROW_LENGTH,y),W.pixelStorei(U.UNPACK_IMAGE_HEIGHT,b),W.pixelStorei(U.UNPACK_SKIP_PIXELS,x),W.pixelStorei(U.UNPACK_SKIP_ROWS,S),W.pixelStorei(U.UNPACK_SKIP_IMAGES,C),a===0&&t.generateMipmaps&&U.generateMipmap(v),W.unbindTexture()},this.initRenderTarget=function(e){G.get(e).__webglFramebuffer===void 0&&K.setupRenderTarget(e)},this.initTexture=function(e){e.isCubeTexture?K.setTextureCube(e,0):e.isData3DTexture?K.setTexture3D(e,0):e.isDataArrayTexture||e.isCompressedArrayTexture?K.setTexture2DArray(e,0):K.setTexture2D(e,0),W.unbindTexture()},this.resetState=function(){j=0,M=0,N=null,W.reset(),Me.reset()},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}get coordinateSystem(){return ei}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Yi._getDrawingBufferColorSpace(e),t.unpackColorSpace=Yi._getUnpackColorSpace()}},Tf={type:`change`},Ef={type:`start`},Df={type:`end`},Of=new es,kf=new qo,Af=Math.cos(70*zi.DEG2RAD),jf=new X,Mf=2*Math.PI,Nf={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Pf=1e-6,Ff=class extends rl{constructor(e,t=null){super(e,t),this.state=Nf.NONE,this.target=new X,this.cursor=new X,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:`ArrowLeft`,UP:`ArrowUp`,RIGHT:`ArrowRight`,BOTTOM:`ArrowDown`},this.mouseButtons={LEFT:Cn.ROTATE,MIDDLE:Cn.DOLLY,RIGHT:Cn.PAN},this.touches={ONE:wn.ROTATE,TWO:wn.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle=`auto`,this._domElementKeyEvents=null,this._lastPosition=new X,this._lastQuaternion=new Vi,this._lastTargetPosition=new X,this._quat=new Vi().setFromUnitVectors(e.up,new X(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new nl,this._sphericalDelta=new nl,this._scale=1,this._panOffset=new X,this._rotateStart=new Bi,this._rotateEnd=new Bi,this._rotateDelta=new Bi,this._panStart=new Bi,this._panEnd=new Bi,this._panDelta=new Bi,this._dollyStart=new Bi,this._dollyEnd=new Bi,this._dollyDelta=new Bi,this._dollyDirection=new X,this._mouse=new Bi,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Lf.bind(this),this._onPointerDown=If.bind(this),this._onPointerUp=Rf.bind(this),this._onContextMenu=Gf.bind(this),this._onMouseWheel=Vf.bind(this),this._onKeyDown=Hf.bind(this),this._onTouchStart=Uf.bind(this),this._onTouchMove=Wf.bind(this),this._onMouseDown=zf.bind(this),this._onMouseMove=Bf.bind(this),this._interceptControlDown=Kf.bind(this),this._interceptControlUp=qf.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e===`grab`?this.domElement.style.cursor=`grab`:this.domElement.style.cursor=`auto`}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener(`pointerdown`,this._onPointerDown),this.domElement.addEventListener(`pointercancel`,this._onPointerUp),this.domElement.addEventListener(`contextmenu`,this._onContextMenu),this.domElement.addEventListener(`wheel`,this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener(`keydown`,this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction=`none`}disconnect(){this.state=Nf.NONE,this.domElement.removeEventListener(`pointerdown`,this._onPointerDown),this.domElement.ownerDocument.removeEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.removeEventListener(`pointerup`,this._onPointerUp),this.domElement.removeEventListener(`pointercancel`,this._onPointerUp),this.domElement.removeEventListener(`wheel`,this._onMouseWheel),this.domElement.removeEventListener(`contextmenu`,this._onContextMenu),this.stopListenToKeyEvents();let e=this.domElement.getRootNode();e.removeEventListener(`keydown`,this._interceptControlDown,{capture:!0}),e.removeEventListener(`keyup`,this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction=``,this.domElement.style.cursor=`auto`}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener(`keydown`,this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener(`keydown`,this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(Tf),this.update(),this.state=Nf.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;jf.copy(t).sub(this.target),jf.applyQuaternion(this._quat),this._spherical.setFromVector3(jf),this.autoRotate&&this.state===Nf.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,r=this.maxAzimuthAngle;isFinite(n)&&isFinite(r)&&(n<-Math.PI?n+=Mf:n>Math.PI&&(n-=Mf),r<-Math.PI?r+=Mf:r>Math.PI&&(r-=Mf),n<=r?this._spherical.theta=Math.max(n,Math.min(r,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+r)/2?Math.max(n,this._spherical.theta):Math.min(r,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let i=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let e=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),i=e!=this._spherical.radius}if(jf.setFromSpherical(this._spherical),jf.applyQuaternion(this._quatInverse),t.copy(this.target).add(jf),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let e=null;if(this.object.isPerspectiveCamera){let t=jf.length();e=this._clampDistance(t*this._scale);let n=t-e;this.object.position.addScaledVector(this._dollyDirection,n),this.object.updateMatrixWorld(),i=!!n}else if(this.object.isOrthographicCamera){let t=new X(this._mouse.x,this._mouse.y,0);t.unproject(this.object);let n=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),i=n!==this.object.zoom;let r=new X(this._mouse.x,this._mouse.y,0);r.unproject(this.object),this.object.position.sub(r).add(t),this.object.updateMatrixWorld(),e=jf.length()}else console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.`),this.zoomToCursor=!1;e!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(e).add(this.object.position):(Of.origin.copy(this.object.position),Of.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Of.direction))<Af?this.object.lookAt(this.target):(kf.setFromNormalAndCoplanarPoint(this.object.up,this.target),Of.intersectPlane(kf,this.target))))}else if(this.object.isOrthographicCamera){let e=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),e!==this.object.zoom&&(this.object.updateProjectionMatrix(),i=!0)}return this._scale=1,this._performCursorZoom=!1,i||this._lastPosition.distanceToSquared(this.object.position)>Pf||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Pf||this._lastTargetPosition.distanceToSquared(this.target)>Pf?(this.dispatchEvent(Tf),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e===null?Mf/60/60*this.autoRotateSpeed:Mf/60*this.autoRotateSpeed*e}_getZoomScale(e){let t=Math.abs(e*.01);return .95**(this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){jf.setFromMatrixColumn(t,0),jf.multiplyScalar(-e),this._panOffset.add(jf)}_panUp(e,t){this.screenSpacePanning===!0?jf.setFromMatrixColumn(t,1):(jf.setFromMatrixColumn(t,0),jf.crossVectors(this.object.up,jf)),jf.multiplyScalar(e),this._panOffset.add(jf)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let r=this.object.position;jf.copy(r).sub(this.target);let i=jf.length();i*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*i/n.clientHeight,this.object.matrix),this._panUp(2*t*i/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.`),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.`),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.`),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),r=e-n.left,i=t-n.top,a=n.width,o=n.height;this._mouse.x=r/a*2-1,this._mouse.y=-(i/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(Mf*this._rotateDelta.x/t.clientHeight),this._rotateUp(Mf*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(Mf*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-Mf*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(Mf*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-Mf*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateStart.set(n,r)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panStart.set(n,r)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,r=e.pageY-t.y,i=Math.sqrt(n*n+r*r);this._dollyStart.set(0,i)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateEnd.set(n,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(Mf*this._rotateDelta.x/t.clientHeight),this._rotateUp(Mf*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panEnd.set(n,r)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,r=e.pageY-t.y,i=Math.sqrt(n*n+r*r);this._dollyEnd.set(0,i),this._dollyDelta.set(0,(this._dollyEnd.y/this._dollyStart.y)**+this.zoomSpeed),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new Bi,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}};function If(e){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(e.pointerId),this.domElement.ownerDocument.addEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.addEventListener(`pointerup`,this._onPointerUp)),!this._isTrackingPointer(e)&&(this._addPointer(e),e.pointerType===`touch`?this._onTouchStart(e):this._onMouseDown(e),this._cursorStyle===`grab`&&(this.domElement.style.cursor=`grabbing`)))}function Lf(e){this.enabled!==!1&&(e.pointerType===`touch`?this._onTouchMove(e):this._onMouseMove(e))}function Rf(e){switch(this._removePointer(e),this._pointers.length){case 0:this.domElement.releasePointerCapture(e.pointerId),this.domElement.ownerDocument.removeEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.removeEventListener(`pointerup`,this._onPointerUp),this.dispatchEvent(Df),this.state=Nf.NONE,this._cursorStyle===`grab`&&(this.domElement.style.cursor=`grab`);break;case 1:let t=this._pointers[0],n=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:n.x,pageY:n.y})}}function zf(e){let t;switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case Cn.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(e),this.state=Nf.DOLLY;break;case Cn.ROTATE:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=Nf.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=Nf.ROTATE}break;case Cn.PAN:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=Nf.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=Nf.PAN}break;default:this.state=Nf.NONE}this.state!==Nf.NONE&&this.dispatchEvent(Ef)}function Bf(e){switch(this.state){case Nf.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(e);break;case Nf.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(e);break;case Nf.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(e)}}function Vf(e){this.enabled!==!1&&this.enableZoom!==!1&&this.state===Nf.NONE&&(e.preventDefault(),this.dispatchEvent(Ef),this._handleMouseWheel(this._customWheelEvent(e)),this.dispatchEvent(Df))}function Hf(e){this.enabled!==!1&&this._handleKeyDown(e)}function Uf(e){switch(this._trackPointer(e),this._pointers.length){case 1:switch(this.touches.ONE){case wn.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(e),this.state=Nf.TOUCH_ROTATE;break;case wn.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(e),this.state=Nf.TOUCH_PAN;break;default:this.state=Nf.NONE}break;case 2:switch(this.touches.TWO){case wn.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(e),this.state=Nf.TOUCH_DOLLY_PAN;break;case wn.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(e),this.state=Nf.TOUCH_DOLLY_ROTATE;break;default:this.state=Nf.NONE}break;default:this.state=Nf.NONE}this.state!==Nf.NONE&&this.dispatchEvent(Ef)}function Wf(e){switch(this._trackPointer(e),this.state){case Nf.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(e),this.update();break;case Nf.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(e),this.update();break;case Nf.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(e),this.update();break;case Nf.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(e),this.update();break;default:this.state=Nf.NONE}}function Gf(e){this.enabled!==!1&&e.preventDefault()}function Kf(e){e.key===`Control`&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener(`keyup`,this._interceptControlUp,{passive:!0,capture:!0}))}function qf(e){e.key===`Control`&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener(`keyup`,this._interceptControlUp,{passive:!0,capture:!0}))}var Jf=`
  attribute vec3 aColor; attribute float aSize; attribute float aAlpha; attribute float aSel;
  uniform float uPx;
  varying vec3 vC; varying float vA; varying float vS;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, aSize * uPx * (320.0 / -mv.z));
    vC = aColor; vA = aAlpha; vS = aSel;
  }`,Yf=`
  precision mediump float;
  varying vec3 vC; varying float vA; varying float vS;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0 || vA < 0.003) discard;
    float core = smoothstep(0.34, 0.0, d);
    float halo = pow(1.0 - d, 2.6) * 0.62;
    float ring = vS * smoothstep(0.07, 0.0, abs(d - 0.8));
    vec3 col = vC * (halo + core * 1.15) + vec3(1.0, 0.97, 0.9) * core * 0.55 + vC * ring * 1.4;
    float a = clamp(halo + core + ring, 0.0, 1.0) * vA;
    gl_FragColor = vec4(min(col, vec3(1.0)), a);
  }`;function Xf(){return new rc({uniforms:{uPx:{value:1}},vertexShader:Jf,fragmentShader:Yf,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,toneMapped:!1})}var Zf=`
  attribute vec3 aColor; attribute float aAlpha;
  varying vec3 vC; varying float vA;
  void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vC = aColor; vA = aAlpha; }`,Qf=`
  precision mediump float;
  varying vec3 vC; varying float vA;
  void main() { if (vA < 0.003) discard; gl_FragColor = vec4(vC, vA); }`;function $f(){return new rc({vertexShader:Zf,fragmentShader:Qf,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,toneMapped:!1})}function ep(e,t=!0){let n=new Uo,r=new Float32Array(e*3),i=new Float32Array(e*3),a=new Float32Array(e),o=new Float32Array(e),s=new Float32Array(e);n.setAttribute(`position`,new Oo(r,3).setUsage($r)),n.setAttribute(`aColor`,new Oo(i,3).setUsage($r)),n.setAttribute(`aSize`,new Oo(a,1).setUsage($r)),n.setAttribute(`aAlpha`,new Oo(o,1).setUsage($r)),t&&n.setAttribute(`aSel`,new Oo(s,1).setUsage($r)),n.setDrawRange(0,0);let c=new Bs(n,Xf());return c.frustumCulled=!1,{pts:c,pos:r,col:i,size:a,alpha:o,sel:s,touch:e=>{n.setDrawRange(0,e);for(let e of[`position`,`aColor`,`aSize`,`aAlpha`,`aSel`]){let t=n.getAttribute(e);t&&(t.needsUpdate=!0)}}}}function tp(e){let t=new Uo,n=new Float32Array(e*3),r=new Float32Array(e*3),i=new Float32Array(e);t.setAttribute(`position`,new Oo(n,3).setUsage($r)),t.setAttribute(`aColor`,new Oo(r,3).setUsage($r)),t.setAttribute(`aAlpha`,new Oo(i,1).setUsage($r)),t.setDrawRange(0,0);let a=new Ps(t,$f());return a.frustumCulled=!1,{lines:a,pos:n,col:r,alpha:i,touch:e=>{t.setDrawRange(0,e);for(let e of[`position`,`aColor`,`aAlpha`])t.getAttribute(e).needsUpdate=!0}}}var np=e=>{let t=parseInt(e.replace(`#`,``),16);return[(t>>16)/255,(t>>8&255)/255,(t&255)/255]},rp=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n],ip=[`#FF6A8A`,`#8FB8FF`,`#B48CFF`,`#D9A441`,`#7FE0C0`,`#FF8C5A`,`#7FD0E8`,`#E58FD0`,`#C8D96A`,`#FF4A2B`,`#A9A2FF`,`#F2C879`,`#6AD7A0`],ap=np(`#EDE6D6`),op=np(`#FF6A8A`),sp=np(`#8FB8FF`),cp=np(`#D9A441`),lp=np(`#B48CFF`);function up(){return{uTime:{value:0},uWave:{value:Array.from({length:6},()=>new oa(0,0,-99,0))},uWaveCol:{value:Array.from({length:6},()=>new X(1,1,1))},uPit:{value:.5}}}var dp=`
  uniform vec4 uWave[6]; uniform vec3 uWaveCol[6];
  // strength and colour of every pulse at a floor point p
  float waveAt(vec2 p, out vec3 col) {
    float s = 0.0; col = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      float x = (length(p - uWave[i].xy) - uWave[i].z) / 0.95;
      float g = exp(-x * x) * uWave[i].w;
      s += g; col += uWaveCol[i] * g;
    }
    col = s > 0.0001 ? col / s : vec3(1.0);
    return s;
  }
  // how far a standing figure is lifted by the pulses passing under it
  float waveBob(vec2 p) {
    float b = 0.0;
    for (int i = 0; i < 6; i++) { float x = (length(p - uWave[i].xy) - uWave[i].z) / 1.15; b += exp(-x * x) * uWave[i].w; }
    return b * 0.2;
  }`,fp=[[0,.07,.2],[.04,.1,.21],[.12,.12,.2],[.25,.12,.17],[.4,.12,.13],[.52,.115,.09],[.6,.14,.11],[.68,.18,.14],[.74,.215,.16],[.79,.17,.12],[.83,.08,.07],[.855,.055,.05],[.87,.055,.05],[.885,.07,.07],[.91,.092,.092],[.935,.1,.1],[.96,.092,.092],[.985,.06,.06],[1,0,0]],pp=1.15,mp=`
  attribute vec2 aProf; attribute vec3 aNrm;
  attribute vec3 iPos; attribute vec3 iCol; attribute vec4 iA;      // feet, colour, (alpha, scale, shape 0 man 1 woman, selected)
  uniform float uTime; uniform float uMirror;
  ${dp}
  varying vec3 vC; varying vec4 vA; varying float vY; varying vec3 vN; varying vec3 vV; varying float vSeed;
  void main() {
    float s = iA.y, y01 = position.y;
    float r = mix(aProf.x, aProf.y, iA.z) * s;
    vec3 local = vec3(position.x * r, y01 * ${pp.toFixed(2)} * s, position.z * r);
    float seed = fract(sin(iPos.x * 12.9898 + iPos.z * 78.233) * 43758.5453);
    local.x += sin(uTime * 1.3 + seed * 6.28) * 0.014 * y01 * y01 * s;
    local.z += cos(uTime * 1.1 + seed * 6.28) * 0.010 * y01 * y01 * s;
    vec3 wp = iPos + local; wp.y += waveBob(iPos.xz);
    vec3 nrm = aNrm;
    if (uMirror > 0.5) { wp.y = -wp.y; nrm.y = -nrm.y; }
    vec4 mv = modelViewMatrix * vec4(wp, 1.0);
    gl_Position = projectionMatrix * mv;
    vN = normalize(normalMatrix * nrm); vV = -mv.xyz;
    vC = iCol; vA = iA; vY = y01; vSeed = seed;
  }`,hp=`
  precision highp float;
  uniform float uTime; uniform float uMirror;
  varying vec3 vC; varying vec4 vA; varying float vY; varying vec3 vN; varying vec3 vV; varying float vSeed;
  void main() {
    vec3 N = normalize(vN), V = normalize(vV);
    float f = 1.0 - abs(dot(N, V));
    float rim = pow(f, 2.1);
    float feet = pow(1.0 - vY, 1.4);
    float head = smoothstep(0.86, 0.94, vY);
    float scan = 0.93 + 0.07 * sin(vY * 64.0 - uTime * 1.5 + vSeed * 6.28);
    float breath = 0.92 + 0.08 * sin(uTime * 2.0 + vSeed * 6.28);
    float a = ((0.22 + 0.62 * rim) * (0.55 + 0.45 * feet) + head * 0.4 + vA.w * (0.22 + 0.4 * rim)) * scan * breath * vA.x;
    vec3 col = vC * (1.0 + 0.5 * rim + vA.w * 0.4) + vec3(1.0, 0.96, 0.88) * (head * 0.5 + rim * 0.12 + vA.w * 0.18);
    if (uMirror > 0.5) a *= 0.3 * smoothstep(1.0, 0.0, vY);
    if (a < 0.004) discard;
    gl_FragColor = vec4(min(col, vec3(1.0)), clamp(a, 0.0, 1.0));
  }`;function gp(e,t){let n=fp.length,r=n*21,i=new Float32Array(r*3),a=new Float32Array(r*2),o=new Float32Array(r*3);for(let e=0;e<n;e++){let[t,r,s]=fp[e],c=fp[Math.max(0,e-1)],l=fp[Math.min(n-1,e+1)],u=(r+s)/2,d=((l[1]+l[2])/2-(c[1]+c[2])/2)/Math.max(1e-4,(l[0]-c[0])*pp);for(let n=0;n<=20;n++){let c=n/20*Math.PI*2,l=Math.cos(c),f=Math.sin(c),p=e*21+n;i.set([l,t,f],p*3),a.set([r,s],p*2);let m=new X(l,-d*+(u>.001),f).normalize();o.set([m.x,m.y,m.z],p*3)}}let s=[];for(let e=0;e<n-1;e++)for(let t=0;t<20;t++){let n=e*21+t,r=n+20+1;s.push(n,n+1,r,n+1,r+1,r)}let c=new Fc;c.setAttribute(`position`,new Oo(i,3)),c.setAttribute(`aProf`,new Oo(a,2)),c.setAttribute(`aNrm`,new Oo(o,3)),c.setIndex(s);let l=new Float32Array(e*3),u=new Float32Array(e*3),d=new Float32Array(e*4);c.setAttribute(`iPos`,new _s(l,3).setUsage($r)),c.setAttribute(`iCol`,new _s(u,3).setUsage($r)),c.setAttribute(`iA`,new _s(d,4).setUsage($r)),c.instanceCount=0;let f=e=>new rc({uniforms:{uTime:t.uTime,uWave:t.uWave,uWaveCol:t.uWaveCol,uMirror:{value:+!!e}},vertexShader:mp,fragmentShader:hp,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,side:+!!e,toneMapped:!1}),p=new ps(c,f(!1)),m=new ps(c,f(!0));return p.frustumCulled=!1,m.frustumCulled=!1,{body:p,mirror:m,geo:c,iPos:l,iCol:u,iA:d,touch:e=>{c.instanceCount=e;for(let e of[`iPos`,`iCol`,`iA`])c.getAttribute(e).needsUpdate=!0}}}var _p=`
  attribute vec3 iPos; attribute vec3 iCol; attribute vec4 iA;       // foot, colour, (alpha, radius, arrival ring 0..1 or -1, selected)
  varying vec2 vP; varying vec3 vC; varying vec4 vA;
  void main() { vP = position.xy; vC = iCol; vA = iA; gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos.x + position.x * iA.y, 0.02, iPos.z + position.y * iA.y, 1.0); }`,vp=`
  precision highp float;
  uniform float uTime;
  varying vec2 vP; varying vec3 vC; varying vec4 vA;
  void main() {
    float d = length(vP); if (d > 1.0) discard;
    float fill = exp(-d * d * 5.0) * 0.34;
    float ring = smoothstep(0.045, 0.0, abs(d - (0.58 + 0.05 * sin(uTime * 1.8 + vA.y * 7.0)))) * 0.42;
    float arr = vA.z >= 0.0 ? smoothstep(0.05, 0.0, abs(d - vA.z)) * (1.0 - vA.z) * 1.4 : 0.0;
    float ang = atan(vP.y, vP.x) / 6.2831853;
    float sel = vA.w * smoothstep(0.035, 0.0, abs(d - 0.9)) * step(0.35, fract(ang * 16.0 + uTime * 0.12)) * 1.2;
    float a = (fill + ring + arr + sel) * vA.x * (1.0 - smoothstep(0.8, 1.0, d));
    if (a < 0.004) discard;
    gl_FragColor = vec4(min(vC * 1.1 + 0.08, vec3(1.0)), clamp(a, 0.0, 1.0));
  }`;function yp(e,t){let n=new Fc;n.setAttribute(`position`,new Oo(new Float32Array([-1,-1,0,1,-1,0,1,1,0,-1,1,0]),3)),n.setIndex([0,1,2,0,2,3]);let r=new Float32Array(e*3),i=new Float32Array(e*3),a=new Float32Array(e*4);n.setAttribute(`iPos`,new _s(r,3).setUsage($r)),n.setAttribute(`iCol`,new _s(i,3).setUsage($r)),n.setAttribute(`iA`,new _s(a,4).setUsage($r)),n.instanceCount=0;let o=new ps(n,new rc({uniforms:{uTime:t.uTime},vertexShader:_p,fragmentShader:vp,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,toneMapped:!1}));return o.frustumCulled=!1,{mesh:o,iPos:r,iCol:i,iA:a,touch:e=>{n.instanceCount=e;for(let e of[`iPos`,`iCol`,`iA`])n.getAttribute(e).needsUpdate=!0}}}var bp=`varying vec2 vW; void main() { vW = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, 0.0, position.y, 1.0); }`,xp=`
  precision highp float;
  uniform float uTime; uniform float uPit;
  ${dp}
  varying vec2 vW;
  float gridLine(float x) { float aa = fwidth(x); float d = abs(fract(x + 0.5) - 0.5); return 1.0 - smoothstep(0.0, aa * 1.4, d); }
  void main() {
    float r = length(vW); if (r > 15.5) discard;
    float inner = smoothstep(2.3, 2.6, r) * (1.0 - smoothstep(12.5, 12.8, r));
    float rings = gridLine(r) * inner, major = gridLine(r / 5.0) * smoothstep(1.0, 1.3, r);
    float spokes = gridLine(atan(vW.y, vW.x) * (12.0 / 6.2831853)) * inner;
    vec3 wc; float w = waveAt(vW, wc);
    float fade = 1.0 - smoothstep(9.0, 15.5, r);
    float edge = smoothstep(0.09, 0.0, abs(r - 12.55)) * 0.16;
    float base = (rings * 0.05 + major * 0.07 + spokes * 0.03) * fade + edge;
    float pit = exp(-r * 0.4) * uPit * 0.42;
    vec3 col = mix(vec3(0.93, 0.9, 0.84), wc, clamp(w * 1.6, 0.0, 1.0));
    col = mix(col, vec3(0.85, 0.64, 0.25), clamp(pit * 2.4, 0.0, 1.0));
    float a = base * (1.0 + w * 7.0) + w * 0.14 * fade + pit;
    if (a < 0.003) discard;
    gl_FragColor = vec4(min(col, vec3(1.0)), clamp(a, 0.0, 1.0));
  }`;function Sp(e){let t=new ps(new qs(15.6,160),new rc({uniforms:{uTime:e.uTime,uPit:e.uPit,uWave:e.uWave,uWaveCol:e.uWaveCol},vertexShader:bp,fragmentShader:xp,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,side:2,toneMapped:!1}));return t.frustumCulled=!1,t}var Cp=`
  precision highp float;
  uniform float uTime; uniform vec3 uColor; uniform float uGlow;
  varying vec2 vW;
  void main() {
    float d = length(vW); if (d > 1.0) discard;
    float fill = pow(1.0 - d, 1.6) * 0.3 * uGlow;
    float rim = smoothstep(0.03, 0.0, abs(d - 0.97)) * (0.25 + 0.5 * uGlow);
    float inn = smoothstep(0.025, 0.0, abs(d - 0.62)) * (0.12 + 0.3 * uGlow);
    float dash = smoothstep(0.03, 0.0, abs(d - 0.8)) * step(0.5, fract(atan(vW.y, vW.x) * 1.5915 + uTime * 0.04)) * (0.1 + 0.3 * uGlow);
    float a = fill + rim + inn + dash;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
  }`;function wp(e,t){let n=new qs(1,64),r={value:new X(t[0],t[1],t[2])},i={value:.2},a=new ps(n,new rc({uniforms:{uTime:e.uTime,uColor:r,uGlow:i},vertexShader:`varying vec2 vW; void main(){ vW = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, 0.015, position.y, 1.0); }`,fragmentShader:Cp,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,side:2,toneMapped:!1}));return a.frustumCulled=!1,{mesh:a,glow:i,color:r}}var Tp=`
  attribute vec3 aTan; attribute float aSide; attribute float aWid; attribute vec3 aCol; attribute float aAl; attribute vec3 aMisc;
  varying vec3 vC; varying float vA; varying float vSide; varying vec3 vM;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec2 dir = (modelViewMatrix * vec4(aTan, 0.0)).xy; float l = length(dir); dir = l > 1e-5 ? dir / l : vec2(1.0, 0.0);
    mv.xy += vec2(-dir.y, dir.x) * aSide * aWid;
    gl_Position = projectionMatrix * mv;
    vC = aCol; vA = aAl; vSide = aSide; vM = aMisc;
  }`,Ep=`
  precision highp float;
  uniform float uTime;
  varying vec3 vC; varying float vA; varying float vSide; varying vec3 vM;
  void main() {
    float e = 1.0 - abs(vSide);
    float core = pow(e, 1.8), soft = pow(e, 0.7);
    float pulse = vM.y > 0.0 ? pow(1.0 - fract(vM.x * 5.0 - uTime * vM.y), 5.0) : 0.0;
    float dash = vM.z > 0.5 ? step(0.5, fract(vM.x * 16.0 - uTime * 0.3)) : 1.0;
    float a = vA * (soft * 0.35 + core * 0.75 + pulse * core * 0.9) * dash;
    if (a < 0.004) discard;
    vec3 col = vC * (0.8 + pulse) + vec3(1.0, 0.96, 0.9) * core * (0.22 + pulse * 0.5);
    gl_FragColor = vec4(min(col, vec3(1.0)), clamp(a, 0.0, 1.0));
  }`;function Dp(e,t,n){let r=(t+1)*2,i=e*r,a=new Float32Array(i*3),o=new Float32Array(i*3),s=new Float32Array(i),c=new Float32Array(i),l=new Float32Array(i*3),u=new Float32Array(i),d=new Float32Array(i*3);for(let e=0;e<i;e++)s[e]=e%2==0?-1:1;let f=[];for(let n=0;n<e;n++)for(let e=0;e<t;e++){let t=n*r+e*2;f.push(t,t+1,t+2,t+1,t+3,t+2)}let p=new Uo,m=(e,t,n,r=!0)=>{let i=new Oo(t,n);r&&i.setUsage($r),p.setAttribute(e,i)};m(`position`,a,3),m(`aTan`,o,3),m(`aSide`,s,1,!1),m(`aWid`,c,1),m(`aCol`,l,3),m(`aAl`,u,1),m(`aMisc`,d,3),p.setIndex(f),p.setDrawRange(0,0);let h=new ps(p,new rc({uniforms:{uTime:n.uTime},vertexShader:Tp,fragmentShader:Ep,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,side:2,toneMapped:!1}));h.frustumCulled=!1;let g=0;return{mesh:h,begin:()=>{g=0},add:(n,i,s,f,p,m,h,_,v,y,b,x,S,C)=>{if(g>=e||v<=_||x<=.002)return;let w=(n+f)/2,T=(i+p)/2+h,E=(s+m)/2;for(let e=0;e<=t;e++){let h=_+(v-_)*e/t,D=1-h,O=D*D*n+2*D*h*w+h*h*f,k=D*D*i+2*D*h*T+h*h*p,A=D*D*s+2*D*h*E+h*h*m,j=2*D*(w-n)+2*h*(f-w),M=2*D*(T-i)+2*h*(p-T),N=2*D*(E-s)+2*h*(m-E),P=y*(.3+.7*Math.sin(Math.PI*Math.min(1,Math.max(0,h))));for(let t=0;t<2;t++){let n=g*r+e*2+t;a[n*3]=O,a[n*3+1]=k,a[n*3+2]=A,o[n*3]=j,o[n*3+1]=M,o[n*3+2]=N,c[n]=P,l[n*3]=b[0],l[n*3+1]=b[1],l[n*3+2]=b[2],u[n]=x,d[n*3]=h,d[n*3+1]=S,d[n*3+2]=C}}g++},end:()=>{p.setDrawRange(0,g*t*6);for(let e of[`position`,`aTan`,`aWid`,`aCol`,`aAl`,`aMisc`])p.getAttribute(e).needsUpdate=!0},count:()=>g}}var Op=[`am`,`af`,`bm`,`bf`,`gm`,`gf`,`dm`,`df`,`Am`,`Af`],kp=(e,t)=>t===1?e:{...e,bm:e.bm*t,bf:e.bf*t,gm:e.gm*t,gf:e.gf*t};function Ap(e,t,n,r){return[-e.am*n+e.bm*r+e.gm*e.Af*t+e.dm*n*r,-e.af*r+e.bf*n+e.gf*e.Am*t+e.df*n*r]}function jp(e,t,n,r,i,a){let o=t(n),s=t(n+a/2),c=t(n+a),l=Ap(e,o,r,i),u=Ap(e,s,r+a/2*l[0],i+a/2*l[1]),d=Ap(e,s,r+a/2*u[0],i+a/2*u[1]),f=Ap(e,c,r+a*d[0],i+a*d[1]);return[r+a/6*(l[0]+2*u[0]+2*d[0]+f[0]),i+a/6*(l[1]+2*u[1]+2*d[1]+f[1])]}var Mp=(e,t,n)=>Ap(e,1,t,n);function Np(e){let t=e.am*e.af-e.bm*e.bf;return Math.abs(t)<1e-9?null:{xm:(e.af*e.gm*e.Af+e.bm*e.gf*e.Am)/t,xf:(e.am*e.gf*e.Am+e.bf*e.gm*e.Af)/t}}var Pp=(e,t,n)=>[[-e.am+e.dm*n,e.bm+e.dm*t],[e.bf+e.df*n,-e.af+e.df*t]];function Fp(e,t,n){let r=Pp(e,t,n),i=r[0][0]+r[1][1],a=r[0][0]*r[1][1]-r[0][1]*r[1][0],o=i*i-4*a,s=i<0&&a>0,c;return c=Math.abs(a)<1e-9||Math.abs(i)<1e-9?`degenerate`:a<0?`saddle`:i<0?o<0?`stable spiral`:`stable node`:o<0?`unstable spiral`:`unstable node`,{xm:t,xf:n,tr:i,det:a,disc:o,stable:s,kind:c}}function Ip(e){let t=e.gm*e.Af,n=e.gf*e.Am,r=[];if(Math.abs(e.dm)<1e-9&&Math.abs(e.df)<1e-9){let t=Np(e);t&&r.push([t.xm,t.xf])}else{let i=e.df*e.am+e.dm*e.bf,a=e.df*e.bm+e.dm*e.af,o=e.df*t-e.dm*n;if(Math.abs(a)>1e-9){let n=e.dm*i,s=-e.am*a+e.bm*i-e.dm*o,c=t*a-e.bm*o,l=[];if(Math.abs(n)<1e-12)Math.abs(s)>1e-12&&l.push(-c/s);else{let e=s*s-4*n*c;if(e>=0){let t=Math.sqrt(e);l.push((-s-t)/(2*n),(-s+t)/(2*n))}}for(let e of l)r.push([e,(i*e-o)/a])}r.length||Lp(e,r)}return r.filter(([e,t])=>Number.isFinite(e)&&Number.isFinite(t)).map(([t,n])=>Fp(e,t,n)).sort((e,t)=>e.xm-t.xm)}function Lp(e,t){for(let n=0;n<7;n++)for(let r=0;r<7;r++){let i=-1+n,a=-1+r;for(let t=0;t<40;t++){let[t,n]=Mp(e,i,a),r=Pp(e,i,a),o=r[0][0]*r[1][1]-r[0][1]*r[1][0];if(Math.abs(o)<1e-12||(i-=(t*r[1][1]-n*r[0][1])/o,a-=(n*r[0][0]-t*r[1][0])/o,Math.abs(i)>50||Math.abs(a)>50))break}let[o,s]=Mp(e,i,a);Math.hypot(o,s)<1e-7&&!t.some(([e,t])=>Math.hypot(e-i,t-a)<1e-5)&&t.push([i,a])}}function Rp(e,t,n,r=30,i=.1){let a=[[t,n]],o=t,s=n,c=()=>1;for(let t=0;t<r&&([o,s]=jp(e,c,t,o,s,i),Math.abs(o)<6&&Math.abs(s)<6);t+=i)a.push([o,s]);return a}var zp=(e,t,n=3)=>{let r=0;for(let i of t)e>=i.t0&&(r+=i.s*Math.exp(-(e-i.t0)/n));return r},Bp=[[`Rowan`,`M`,1.05,1,`start`],[`Dario`,`M`,1.25,1,`start`],[`Kofi`,`M`,.8,1,`start`],[`Mateo`,`M`,1.45,1,`start`],[`Jonah`,`M`,.55,1,`start`],[`Elliot`,`M`,1.55,8,`bombshell`],[`Silas`,`M`,1.2,21,`bombshell`],[`Hugo`,`M`,1,21,`bombshell`],[`Idris`,`M`,1.5,29,`casa`],[`Callum`,`M`,1.3,29,`casa`],[`Tomás`,`M`,1.6,29,`casa`],[`Bastien`,`M`,1.1,29,`casa`],[`Imani`,`W`,1.1,1,`start`],[`Priya`,`W`,.9,1,`start`],[`Lucía`,`W`,1.35,1,`start`],[`Sloane`,`W`,.7,1,`start`],[`Noor`,`W`,1,1,`start`],[`Zara`,`W`,1.6,8,`bombshell`],[`Maren`,`W`,1.15,8,`bombshell`],[`Wren`,`W`,1,21,`bombshell`],[`Anya`,`W`,1.45,29,`casa`],[`Mei`,`W`,1.25,29,`casa`],[`Delphine`,`W`,1.55,29,`casa`],[`Ines`,`W`,1.35,29,`casa`],[`Tamsin`,`W`,.95,29,`casa`]],Vp=[[1,1,1],[.92,1.1,1.05],[1.12,.9,.95],[.88,1.08,1.1],[1.1,.95,.9],[1,1,1],[1.05,1.12,1],[.95,.92,1.08],[1.08,1.05,.92],[.9,1,1],[1,1.1,1.1],[1.1,.9,1],[1.05,.95,1],[.95,1.1,.95],[.9,1.05,1.1],[1.1,1,.92],[1,.92,1.05],[.92,1.12,1],[1.08,.9,1.08],[1,1.05,.95],[.95,1,1.1],[1.1,1.08,.9],[.9,.95,1],[1.05,1,1.05],[1,1.1,.92]];function Hp(e){let t=Bp.map(e=>[...e]);return e===`triangle`&&(t[17][2]=1.95,t[0][2]=1.7,t[5][2]=1),e===`recouple`&&(t[6][2]=1.8,t[7][2]=1.55,t[19][2]=1.75),t.map((e,t)=>({id:t,name:e[0],sex:e[1],A:e[2],arrive:e[3],group:e[4],fo:Vp[t][0],re:Vp[t][1],sy:Vp[t][2]}))}var Up=(e,t)=>`${e}-${t}`,Wp=.1,Gp=Math.round(52/Wp)+1,Kp=[1,5,12,22,32,36,45],qp=[18,24,28,34,38,41,44,47,50],Jp=[{n:1,name:`Pre-Voting`,a:1,b:15},{n:2,name:`Post-Voting`,a:16,b:35},{n:3,name:`Endgame`,a:36,b:53}],Yp=e=>e<16?1:e<36?2:3,Xp={w1:1,w2:.8,w3:.6,w4:.4,w5:.2,w6:.5},Zp=[0,.15,.3],Qp=e=>1/(1+Math.exp(2.2*(e-1))),$p=1.6,em=.04,tm=3,nm=9001;function rm(e,t,n,r){let i=2166136261;return i^=(e|0)+2654435769+(i<<6)+(i>>>2),i=Math.imul(i,16777619),i^=(t|0)+2654435769+(i<<6)+(i>>>2),i=Math.imul(i,16777619),i^=(n|0)+2654435769+(i<<6)+(i>>>2),i=Math.imul(i,16777619),i^=(r|0)+2654435769+(i<<6)+(i>>>2),i=Math.imul(i,16777619),i^=i>>>16,i=Math.imul(i,2246822507),i^=i>>>13,i=Math.imul(i,3266489909),i^=i>>>16,i>>>0}function im(e,t,n,r){let i=(rm(e,t,n,r*2)+1)/4294967297,a=(rm(e,t,n,r*2+1)+1)/4294967297;return Math.sqrt(-2*Math.log(i))*Math.cos(2*Math.PI*a)}function am(e,t,n){let r={am:e.alpha*t.fo,af:e.alpha*n.fo,bm:e.beta*t.re,bf:e.beta*n.re,gm:e.gamma,gf:e.gamma,dm:e.syn*t.sy,df:e.syn*n.sy,Am:t.A,Af:n.A},i=e.over[Up(t.id,n.id)];return i?{...r,...i}:r}function om(e,t,n,r,i,a){let o=e=>Math.min(53,Math.max(0,e))/53,s=o(r-n.arrive),c=o(r-t.arrive),l=o(r-i),u=Qp(n.A),d=Math.max(0,t.A-n.A),f=Xp.w1*s+Xp.w2*u+Xp.w3*d+Xp.w4*l+Xp.w5*c+Xp.w6*u*d;return e.vw*f+Zp[Yp(r)-1]+a}var sm={1:`the first coupling`,5:`the day 5 recoupling`,12:`the bombshell recoupling`,22:`the day 22 recoupling`,32:`the Casa Amor recoupling`,36:`the Endgame recoupling`,45:`the final recoupling`},cm=e=>`${e}${e%100>=11&&e%100<=13?`th`:[`th`,`st`,`nd`,`rd`][e%10]??`th`}`,lm=new Float64Array(2);function um(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){let g=h/2,_=-e*p+n*m+i*l*u+o*p*m,v=-t*m+r*p+a*c*u+s*p*m,y=p+g*_,b=m+g*v,x=-e*y+n*b+i*l*d+o*y*b,S=-t*b+r*y+a*c*d+s*y*b;y=p+g*x,b=m+g*S;let C=-e*y+n*b+i*l*d+o*y*b,w=-t*b+r*y+a*c*d+s*y*b;y=p+h*C,b=m+h*w;let T=-e*y+n*b+i*l*f+o*y*b,E=-t*b+r*y+a*c*f+s*y*b;lm[0]=p+h/6*(_+2*x+2*C+T),lm[1]=m+h/6*(v+2*S+2*w+E)}var dm=e=>e.length<2?e.join(``):`${e.slice(0,-1).join(`, `)} and ${e[e.length-1]}`;function fm(e){let t=Hp(e.cast),n=t.length,r=t.filter(e=>e.sex===`M`).map(e=>e.id),i=t.filter(e=>e.sex===`W`).map(e=>e.id),a=r.length,o=i.length,s=a*o,c=new Map(r.map((e,t)=>[e,t])),l=new Map(i.map((e,t)=>[e,t])),u=(e,t)=>c.get(e)*o+l.get(t),d=Gp,f=new Float32Array(s*d*2).fill(NaN),p=new Float32Array(s*d*2).fill(NaN),m=new Float32Array(s*d).fill(NaN),h=new Float32Array(s*d).fill(NaN),g=new Int16Array(d*n).fill(-1),_=new Uint8Array(d*n),v=new Float32Array(d*n),y=new Float64Array(s*2),b=new Float64Array(s*2),x=new Float64Array(s*2),S=new Uint8Array(s),C=new Uint8Array(n),w=new Int16Array(n).fill(-1),T=new Float64Array(n),E=Array(n).fill(1/0),D=Array(n).fill(null),O=new Float64Array(s).fill(1/0),k=[],A=new Map;for(let t of e.shocks){if(!c.has(t.m)||!l.has(t.f))continue;let e=u(t.m,t.f),n=A.get(e)??[];n.push({t0:t.t,s:t.s}),A.set(e,n)}let j=new Float64Array(s);for(let t=0;t<s;t++)j[t]=e.eps*im(e.seed,nm,t,0);let M=e=>t[e].name,N=(e,t,n,r,i,a,o)=>{let s={t:e,kind:t,text:n,a:r,b:i};a&&(s.detail=a),o&&(s.short=o),k.push(s)},P=(n,r,i)=>w[n]===r?1:i>=29&&i<33&&t[n].group===`casa`!=(t[r].group===`casa`)?e.ca:e.mix,F=(e,t)=>{let n=A.get(e);return n?zp(t,n,3):0},I=(n,r,i)=>om(e,t[n],t[r],i,T[n],.5*F(u(n,r),i));function L(e,n){C[n]=1;let a=t[n].sex===`M`?i:r;for(let e of a){if(!C[e])continue;let[r,i]=t[n].sex===`M`?[n,e]:[e,n],a=u(r,i);S[a]=1,y[a*2]=.3*t[i].A,y[a*2+1]=.3*t[r].A,b[a*2]=b[a*2+1]=x[a*2]=x[a*2+1]=0}}function R(e,n,a){C[n]=0,E[n]=e,D[n]=a;let o=w[n];o>=0&&(w[o]=-1),w[n]=-1;let s=t[n].sex===`M`?i:r;for(let e of s){let[r,i]=t[n].sex===`M`?[n,e]:[e,n];S[u(r,i)]=0}}function z(n){let a=Math.round(n),o=sm[a]??`the recoupling`,s=[];for(let t of r)if(C[t])for(let n of i){if(!C[n])continue;let r=u(t,n);s.push([y[r*2]+b[r*2]+y[r*2+1]+b[r*2+1]+(w[t]===n?e.loyalty:0),t,n])}s.sort((e,t)=>t[0]-e[0]||e[1]-t[1]||e[2]-t[2]);let c=new Map,l=new Map,d=new Map;for(let[e,t,n]of s)!c.has(t)&&!l.has(n)&&(c.set(t,n),l.set(n,t),d.set(t,e));let f=new Map,p=new Map;for(let e of r)C[e]&&w[e]>=0&&(f.set(e,w[e]),p.set(w[e],e));let m=e=>n-t[e].arrive<3.5&&t[e].arrive>1,h=-1,g=-1/0;for(let[e,t]of d)t>g&&(g=t,h=e);for(let[e,t]of f)if(c.get(e)!==t){let r=Math.max(1,Math.round(n-T[e])),i=c.get(e),a=l.get(t);N(n,`split`,`${M(e)} and ${M(t)}, together ${r} ${r===1?`day`:`days`}, part ways at ${o}.`,e,t,`${M(e)} ${i==null?`is left without a partner`:`goes on with ${M(i)}`}; ${M(t)} ${a==null?`is left without a partner`:`goes on with ${M(a)}`}.`)}for(let[e,t]of c)if(f.get(e)!==t){let r=f.get(e),i=p.get(t),o=M(e),s=M(t),c=d.get(e)??0,l;l=n<=1?`${o} and ${s} couple up on first impressions${e===h?`, the strongest pull in the villa`:``}.`:r!=null&&i!=null?`${o} and ${s} choose each other and leave ${M(r)} and ${M(i)} behind.`:r==null?i==null?m(e)&&m(t)?`${o} and ${s}, both new to the villa, pick each other.`:`${o} and ${s} couple up.`:`${s} turns from ${M(i)} to ${o}.`:`${o} turns from ${M(r)} to ${s}.`,N(n,`couple`,a===32&&n>1?`Casa Amor recoupling: ${l}`:l,e,t,`Their love for each other adds up to ${c.toFixed(2)} on the day.`)}for(let e of r)C[e]&&(w[e]=c.get(e)??-1);for(let e of i)C[e]&&(w[e]=l.get(e)??-1);for(let[e,t]of c)f.get(e)!==t&&(T[e]=T[t]=n);if(n>1)for(let e of[...r,...i])C[e]&&w[e]<0&&(N(n,`single`,`${M(e)} is left without a partner at ${o} and goes home.`,e),R(n,e,`single`))}function ee(e){let t=[];for(let n of r)C[n]&&w[n]>=0&&t.push([I(n,w[n],e),n,w[n]]);if(t.length<=4)return;let n=(e,t)=>{let n=u(e,t);return y[n*2]+b[n*2]+y[n*2+1]+b[n*2+1]},i=t.map(e=>n(e[1],e[2]));t.sort((e,t)=>e[0]-t[0]);let[a,o,s]=t[0],c=n(o,s),l=1+i.filter(e=>e>c).length,d=t.length,f=l<=Math.ceil(d/2)?`Their love ranks ${cm(l)} of ${d}, but the audience votes on support, not love.`:`Their love ranks ${cm(l)} of ${d} too.`;N(e,`vote`,`Public vote: ${M(o)} and ${M(s)} have the least support of ${d} couples (${a.toFixed(2)}) and are sent home. ${f}`,o,s,`Support ${a.toFixed(2)} against ${t[1][0].toFixed(2)} for the next lowest. Love ${c.toFixed(2)}.`,`Public vote: ${M(o)} and ${M(s)} are sent home (support ${a.toFixed(2)}).`),R(e,o,`vote`),R(e,s,`vote`)}let B=new Float64Array(s*10);for(let n=0;n<a;n++)for(let a=0;a<o;a++){let s=am(e,t[r[n]],t[i[a]]),c=(n*o+a)*10;B[c]=s.am,B[c+1]=s.af,B[c+2]=s.bm,B[c+3]=s.bf,B[c+4]=s.gm,B[c+5]=s.gf,B[c+6]=s.dm,B[c+7]=s.df,B[c+8]=s.Am,B[c+9]=s.Af}let te=new Int32Array(s*2).fill(-1),ne=new Float64Array(s*2);for(let c=0;c<d;c++){let l=1+c*Wp;if(c%10==0){let n=Math.round(l),r=t.filter(e=>e.arrive===n);if(r.length){for(let e of r)L(l,e.id);let t=r[0].group,n=r.reduce((e,t)=>t.A>e.A?t:e),i=r.map(e=>`${e.name} ${e.A.toFixed(2)}`).join(`, `);t===`casa`?N(l,`casa`,`Casa Amor opens: ${r.length} new islanders arrive and spend days 29 to 32 with the old villa. Contact between old and new is ${e.ca.toFixed(2)}, and the emotional swings grow louder.`,void 0,void 0,`Appeal: ${i}.`,`Casa Amor opens: ${r.length} new islanders, days 29 to 32.`):t===`bombshell`&&N(l,`arrive`,`${dm(r.map(e=>e.name))} ${r.length>1?`walk in as bombshells`:`walks in as a bombshell`}${r.length>1?`. ${n.name} has the highest appeal of them`:``}, and every couple's attractions start to shift.`,r[0].id,void 0,`Appeal: ${i}.`,`${dm(r.map(e=>e.name))} ${r.length>1?`arrive as bombshells`:`arrives as a bombshell`}.`)}Kp.includes(n)&&z(l),qp.includes(n)&&Yp(l)>=2&&ee(l),n===16&&N(l,`stage`,`Post-Voting begins: from here the audience votes, so a couple needs support as well as love.`),n===36&&N(l,`stage`,`Endgame begins: couples settle toward their resting levels and the last votes decide who reaches the finale.`),n===53&&N(l,`final`,`The season ends. The highest Winner Index wins.`)}for(let e=0;e<n;e++)g[c*n+e]=w[e],_[c*n+e]=C[e],v[c*n+e]=T[e];let E=0,D=0,k=new Map;for(let e of r){let t=w[e];if(t>=0&&C[e]){let n=I(e,t,l);k.set(u(e,t),n),E+=n,D++}}let j=D?E/D:0;for(let e=0;e<s;e++){if(!S[e])continue;let t=(e*d+c)*2;f[t]=y[e*2],f[t+1]=y[e*2+1],p[t]=b[e*2],p[t+1]=b[e*2+1]}for(let[e,t]of k)m[e*d+c]=t;if(c===520){for(let e=0;e<s;e++)S[e]&&(h[e*d+c]=h[e*d+c-1]);break}let M=Yp(l),F=M===1?1:M===2?.6:.3,R=l>=29&&l<33?2.4:1,V=e.kappa+em*(l-1),H=Math.floor(l+1e-6);for(let n=0;n<a;n++)for(let a=0;a<o;a++){let s=r[n],u=i[a];if(!C[s]||!C[u])continue;let f=n*o+a,p=P(s,u,l),m=f*10;h[f*d+c]=p;let g=w[s]===u,_=g&&e.lam?e.lam*((k.get(f)??j)-j):0,v=A.get(f),S=Math.max(.05,1+_+(v?zp(l,v,3):0)),T=v?Math.max(.05,1+_+zp(l+Wp/2,v,3)):S,E=v?Math.max(.05,1+_+zp(l+Wp,v,3)):S;um(B[m],B[m+1],B[m+2]*p,B[m+3]*p,B[m+4]*p,B[m+5]*p,B[m+6],B[m+7],B[m+8],B[m+9],S,T,E,y[f*2],y[f*2+1],Wp);let D=lm[0],M=lm[1];y[f*2]=D,y[f*2+1]=M,Math.abs(D)<6&&Math.abs(M)<6||(O[f]===1/0&&(O[f]=l),y[f*2]=Math.max(-6,Math.min(6,D)),y[f*2+1]=Math.max(-6,Math.min(6,M)));let N=l-Math.max(t[s].arrive,t[u].arrive)<2?2:1,I=e.sigma*F*R*N*(g?1:.5);for(let t=0;t<2;t++){let n=f*2+t;te[n]!==H&&(te[n]=H,ne[n]=im(e.seed,f,t,H));let r=I*ne[n];for(let e=0;e<2;e++){let e=Wp/2;x[n]+=(r-V*x[n]-$p*$p*b[n])*e,b[n]+=x[n]*e}}}}let V={cfg:e,isl:t,N:n,nM:a,nW:o,men:r,women:i,steps:d,X:f,U:p,PHI:m,CONTACT:h,partner:g,here:_,since:v,exit:E,exitKind:D,firstAway:O,eps:j,events:k,pidx:u},H=k.find(e=>e.kind===`final`),re=H?gm(V,520):[];if(H&&re.length){let e=re[0],t=re[1];H.text=`The season ends. ${M(e.m)} and ${M(e.f)} have the highest Winner Index (${e.total.toFixed(2)})${t?`, ahead of ${M(t.m)} and ${M(t.f)} (${t.total.toFixed(2)})`:``}.`,H.a=e.m,H.b=e.f,H.short=`Finale: ${M(e.m)} and ${M(e.f)} take the Winner Index.`,H.detail=`Winner Index = support ${e.phi.toFixed(2)} + chi x love ${e.love.toFixed(2)} + luck ${e.eps.toFixed(2)}.`}return V}var pm=(e,t)=>Math.max(0,Math.min(e.steps-1,Math.round((t-1)/Wp))),mm=e=>1+e*Wp;function hm(e,t){let n=[];for(let r of e.men){let i=e.partner[t*e.N+r];if(i<0||!e.here[t*e.N+r])continue;let a=e.pidx(r,i),o=(a*e.steps+t)*2;n.push({m:r,f:i,p:a,phi:e.PHI[a*e.steps+t],xm:e.X[o],xf:e.X[o+1],Xm:e.X[o]+e.U[o],Xf:e.X[o+1]+e.U[o+1],since:e.since[t*e.N+r]})}return n.sort((e,t)=>t.phi-e.phi||e.m-t.m)}function gm(e,t){let n=[],r=Math.max(0,t-Math.round(tm/Wp));for(let i of hm(e,t)){let a=0,o=0;for(let n=r;n<=t;n++){let t=(i.p*e.steps+n)*2,r=e.X[t]+e.U[t],s=e.X[t+1]+e.U[t+1];Number.isFinite(r)&&Number.isFinite(s)&&(a+=r+s,o++)}let s=e.cfg.chi*(o?a/o:0);n.push({m:i.m,f:i.f,p:i.p,phi:i.phi,love:s,eps:e.eps[i.p],total:i.phi+s+e.eps[i.p]})}return n.sort((e,t)=>t.total-e.total)}var _m=2.399963,vm=40,ym=40,bm=26,xm=260,Sm=110,Cm=ip.map(np),wm=np(`#FFF1C9`),Tm=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},Em=e=>1-(1-Math.min(1,Math.max(0,e)))**3,Dm=(e,t,n)=>Math.min(n,Math.max(t,e)),Om=e=>{let t=Math.sin(e*127.1+311.7)*43758.5453;return t-Math.floor(t)},km={pit:{x:0,z:0,r:1.5},hideaway:{x:8.4,z:-6.8,r:1.6},annex:{x:-12.6,z:-5.6,r:3.1},rim:12.55,beds:{r:7.3,angles:[.4,1.45,2.5,3.55,4.6,5.65]}},Am=class{group=new za;onSelect=null;onHover=null;alive=[];hoverId=-1;run;k=0;t=1;U=up();cur=new Float32Array(120);tgt=new Float32Array(120);al=new Float32Array(vm);selw=new Float32Array(vm);scl=new Float32Array(vm).fill(1.25);tempt=new Float32Array(vm);pullw=new Float32Array(vm);mate=new Int16Array(vm);rank=new Int16Array(vm);temp=new Float32Array(vm);hides=[];seeded=!1;reduced=!1;hoverStage=-1;floor=Sp(this.U);halos=yp(vm,this.U);figs=gp(vm,this.U);ribbons=Dp(ym,bm,this.U);heads=ep(vm);sparks=ep(xm,!1);audience=ep(260,!1);embers=ep(48,!1);dust=ep(Sm,!1);pit=ep(3,!1);beams=tp(80);arch=tp(2600);archBase=new Float32Array(2600);archGroup=new Uint8Array(2600);archN=0;beds=tp(336);padHide=wp(this.U,op);padAnnex=wp(this.U,cp);padPit=wp(this.U,cp);labelPos=[];avoid=[];shown=new Map;camera=null;size=new Bi(800,600);canvas=null;ptr={x:0,y:0,tx:0,ty:0};ray=new $c;v0=new X;v1=new X;inv=new da;focus={x:0,z:0};lastHideW=0;lastAnnexW=0;constructor(){this.reduced=typeof matchMedia==`function`&&matchMedia(`(prefers-reduced-motion: reduce)`).matches;let e=(e,t)=>{e.renderOrder=t,this.group.add(e)};e(this.floor,1),this.padPit.mesh.scale.setScalar(km.pit.r*1.7),e(this.padPit.mesh,2),this.padHide.mesh.position.set(km.hideaway.x,0,km.hideaway.z),this.padHide.mesh.scale.setScalar(km.hideaway.r*1.5),e(this.padHide.mesh,2),this.padAnnex.mesh.position.set(km.annex.x,0,km.annex.z),this.padAnnex.mesh.scale.setScalar(km.annex.r*1.45),e(this.padAnnex.mesh,2),e(this.arch.lines,3),e(this.beds.lines,3),e(this.audience.pts,3),e(this.dust.pts,3),e(this.halos.mesh,4),e(this.figs.mirror,5),e(this.beams.lines,6),e(this.ribbons.mesh,7),e(this.figs.body,8),e(this.heads.pts,9),e(this.sparks.pts,10),e(this.embers.pts,10),e(this.pit.pts,10),this.buildArch();let t=this.audience,n=np(`#EDE6D6`);for(let e=0;e<260;e++){let r=e/260*Math.PI*2+Math.sin(e*12.9898)*.01,i=14.4+Math.sin(e*78.233)*.5;t.pos.set([Math.cos(r)*i,.05,Math.sin(r)*i],e*3),t.col.set(n,e*3),t.size[e]=.42,t.alpha[e]=.2}t.touch(260),this.floor.onBeforeRender=(e,t,n)=>{this.camera=n,e.getSize(this.size),this.canvas!==e.domElement&&this.attach(e.domElement)}}buildArch(){let e=this.arch,t=0,n=(n,r,i,a,o,s,c,l,u=0)=>{t+2>2600||(e.pos.set([n,r,i,a,o,s],t*3),e.col.set(l,t*3),e.col.set(l,t*3+3),this.archBase[t]=this.archBase[t+1]=c,this.archGroup[t]=this.archGroup[t+1]=u,t+=2)},r=(e,t,r,i,a,o,s,c=0,l=0)=>{for(let u=0;u<a;u++){if(l&&u%l===0)continue;let d=u/a*Math.PI*2,f=(u+1)/a*Math.PI*2;n(e+Math.cos(d)*r,i,t+Math.sin(d)*r,e+Math.cos(f)*r,i,t+Math.sin(f)*r,o,s,c)}};r(0,0,1.55,.02,48,.2,cp),r(0,0,1,.02,40,.1,cp);for(let e=0;e<12;e++){let t=e/12*Math.PI*2;n(Math.cos(t)*1.55,.02,Math.sin(t)*1.55,Math.cos(t)*1.55,.22,Math.sin(t)*1.55,.2,cp)}r(0,0,1.55,.22,48,.12,cp);for(let e=0;e<24;e++){let t=e/24*Math.PI*2,r=Math.cos(t)*km.rim,i=Math.sin(t)*km.rim;n(r,0,i,r,1.5,i,.12,ap)}r(0,0,km.rim,1.5,96,.05,ap);let i=km.hideaway,a=rp(op,ap,.25);r(i.x,i.z,i.r,0,6,.4,a,1),r(i.x,i.z,i.r,1.9,6,.3,a,1);for(let e=0;e<6;e++){let t=e/6*Math.PI*2,r=i.x+Math.cos(t)*i.r,o=i.z+Math.sin(t)*i.r;n(r,0,o,r,1.9,o,.4,a,1),n(r,1.9,o,i.x,3,i.z,.3,a,1)}let o=km.annex,s=rp(cp,ap,.2);r(o.x,o.z,o.r,0,64,.3,s,2),r(o.x,o.z,o.r,2.3,64,.26,s,2),r(o.x,o.z,o.r*1.35,0,80,.1,s,2);for(let e=0;e<8;e++){let t=e/8*Math.PI*2,r=o.x+Math.cos(t)*o.r,i=o.z+Math.sin(t)*o.r;n(r,0,i,r,2.3,i,.42,s,2);let a=r,c=2.3,l=i;for(let e=1;e<=6;e++){let r=e/6,i=o.r*Math.cos(r*1.25),u=2.3+1.5*Math.sin(r*1.25),d=o.x+Math.cos(t)*i,f=o.z+Math.sin(t)*i;n(a,c,l,d,u,f,.26-.2*r,s,2),a=d,c=u,l=f}}for(let e=1;e<=3;e++){let t=e/4,n=o.r*Math.cos(t*1.25),i=2.3+1.5*Math.sin(t*1.25);r(o.x,o.z,n,i,40,.14,s,2)}let c=o.x,l=o.z,u=Math.hypot(c,l),d=c/u,f=l/u,p=km.rim+.2,m=u-o.r*1.35;for(let e=0;p+e*.6<m;e++){let t=p+e*.6,r=Math.min(m,t+.32);n(d*t,.02,f*t,d*r,.02,f*r,.24,s,2)}this.archN=t,e.touch(t)}attach(e){this.detach(),this.canvas=e,e.addEventListener(`pointermove`,this.onMove),e.addEventListener(`pointerleave`,this.onLeave),e.addEventListener(`click`,this.onClick)}detach(){let e=this.canvas;e&&(e.removeEventListener(`pointermove`,this.onMove),e.removeEventListener(`pointerleave`,this.onLeave),e.removeEventListener(`click`,this.onClick),this.canvas=null)}onMove=e=>{let t=this.canvas.getBoundingClientRect();this.ptr.tx=Dm(((e.clientX-t.left)/t.width-.5)*2,-1,1),this.ptr.ty=Dm(((e.clientY-t.top)/t.height-.5)*2,-1,1);let n=e.pointerType===`mouse`?this.rayPick(e.clientX-t.left,e.clientY-t.top,t.width,t.height):-1;n!==this.hoverId&&(this.hoverId=n,this.canvas.style.cursor=n>=0?`pointer`:``),this.onHover?.(n,e.clientX,e.clientY)};onLeave=()=>{this.ptr.tx=0,this.ptr.ty=0,this.hoverId=-1};onClick=e=>{let t=this.canvas.getBoundingClientRect(),n=this.rayPick(e.clientX-t.left,e.clientY-t.top,t.width,t.height);if(n<0)return;let r=this.pairOf(n);r&&(this.onSelect?.(r,n),this.canvas.dispatchEvent(new CustomEvent(`villa-select`,{detail:{m:r[0],f:r[1],id:n}})))};rayPick(e,t,n,r){if(!this.camera||!this.run)return-1;this.ray.setFromCamera(new Bi(e/n*2-1,-(t/r)*2+1),this.camera),this.group.updateMatrixWorld(),this.inv.copy(this.group.matrixWorld).invert();let i=this.ray.ray.clone().applyMatrix4(this.inv),a=-1,o=1/0;for(let e=0;e<this.alive.length;e++){if(!this.alive[e])continue;this.v0.set(this.cur[e*3],this.cur[e*3+1],this.cur[e*3+2]),this.v1.copy(this.v0),this.v1.y+=pp*this.scl[e];let t=i.distanceSqToSegment(this.v0,this.v1),n=.3+.02*i.origin.distanceTo(this.v0);t<n*n&&t<o&&(o=t,a=e)}return a}pairOf(e){let t=this.run,n=t.N,r=this.k,i=t.isl,a=t.partner[r*n+e];if(a>=0)return i[e].sex===`M`?[e,a]:[a,e];let o=-1,s=-1/0;for(let a of i[e].sex===`M`?t.women:t.men){if(!t.here[r*n+a])continue;let[c,l]=i[e].sex===`M`?[e,a]:[a,e],u=(t.pidx(c,l)*t.steps+r)*2,d=t.X[u]+t.U[u]+t.X[u+1]+t.U[u+1];Number.isFinite(d)&&d>s&&(s=d,o=a)}return o<0?null:i[e].sex===`M`?[e,o]:[o,e]}setRun(e){this.run=e,this.seeded=!1,this.cur.fill(0),this.shown.clear(),this.alive=Array(e.N).fill(!1),this.labelPos=e.isl.map(()=>new X),this.hides=[];let t=new Set;for(let n of e.events)n.kind===`couple`&&!t.has(n.t)&&n.a!==void 0&&n.b!==void 0&&(t.add(n.t),this.hides.push({t0:n.t,m:n.a,f:n.b}))}annexSlot(e,t,n){let r=e*_m,i=t?km.annex.r*.78:km.annex.r*.34+e%2*.35;return n.set(km.annex.x+Math.cos(r)*i,0,km.annex.z+Math.sin(r)*i)}angle(e){return e*_m+.6}update(e){let{run:t,k:n,t:r,dt:i,time:a}=e,o=Math.min(t.N,vm),s=t.isl,c=this.U;this.k=n,this.t=r,c.uTime.value=a;let l=hm(t,n),u=this.cur,d=this.tgt,f=this.al,p=this.selw,m=this.mate;m.fill(-1),p.fill(0);let h=this.v0,g=Tm(29,29.9,r)*(1-Tm(32.5,33.9,r)),_=null,v=0;for(let e of this.hides){let i=r-e.t0;i>=0&&i<1.5&&t.partner[n*t.N+e.m]===e.f&&(_=e,v=Tm(0,.3,i)*(1-Tm(.9,1.4,i)))}l.forEach((e,t)=>{let n=3.5+t*.62,r=this.angle(e.p),i=-Math.sin(r),a=Math.cos(r),o=e.Xm+e.Xf,s=Math.min(1.8,Math.max(.95,1.75-.5*Math.tanh(o/2.5))),c=Math.cos(r)*n,l=Math.sin(r)*n;_&&_.m===e.m&&(c+=(km.hideaway.x-c)*v,l+=(km.hideaway.z-l)*v,s+=(.8-s)*v);let u=.04+.075*Dm(e.Xm,0,5),f=.04+.075*Dm(e.Xf,0,5);d[e.m*3]=c-i*s/2,d[e.m*3+1]=u,d[e.m*3+2]=l-a*s/2,d[e.f*3]=c+i*s/2,d[e.f*3+1]=f,d[e.f*3+2]=l+a*s/2,m[e.m]=e.f,m[e.f]=e.m,this.rank[e.m]=this.rank[e.f]=t});for(let e=0;e<o;e++){let i=s[e];if(t.here[n*t.N+e]!==1&&r>=i.arrive){let n=r-(t.exit[e]===1/0?r:t.exit[e]),a=u[e*3],o=u[e*3+2],s=Math.hypot(a,o);if(s<2.5){let t=e*_m;a=Math.cos(t)*10.4,o=Math.sin(t)*10.4,s=10.4,u[e*3]=a,u[e*3+2]=o}d[e*3]=a/s*(s+5),d[e*3+1]=.1,d[e*3+2]=o/s*(s+5),f[e]=Dm(1-n/1.4,0,1)*Tm(0,.35,r-i.arrive)}else{if(m[e]<0){let t=e*_m,n=10.4+e%3*.55;d[e*3]=Math.cos(t)*n,d[e*3+1]=.05+.03*Math.sin(a*1.3+e),d[e*3+2]=Math.sin(t)*n}f[e]=r<i.arrive?0:i.arrive<=1?1:Tm(0,.35,r-i.arrive)}}if(g>.001){this.tempt.fill(0);for(let e of t.men)for(let r of t.women){if(t.here[n*t.N+e]!==1||t.here[n*t.N+r]!==1)continue;let i=s[e].group===`casa`;if(i===(s[r].group===`casa`))continue;let a=(t.pidx(e,r)*t.steps+n)*2,o=t.X[a]+t.U[a]+t.X[a+1]+t.U[a+1];if(!Number.isFinite(o))continue;let c=i?r:e;o>this.tempt[c]&&(this.tempt[c]=o)}let e=0;for(let r=0;r<o;r++)s[r].group!==`casa`&&t.here[n*t.N+r]===1&&(this.temp[e++]=this.tempt[r]);let r=this.temp.subarray(0,e).sort(),i=e?r[Math.floor(e/2)]:0,a=Dm(.45+.55*t.cfg.ca,0,1);for(let e=0;e<o;e++){let r=s[e].group===`casa`,o=r?1:t.here[n*t.N+e]===1?Dm((this.tempt[e]-i)/.5+.5,0,1):0;if(this.pullw[e]=o*g*(r?1:a),o*g>.001){this.annexSlot(e,!r,h);let t=this.pullw[e];d[e*3]+=(h.x-d[e*3])*t,d[e*3+2]+=(h.z-d[e*3+2])*t,d[e*3+1]+=(.08-d[e*3+1])*t}}}else this.pullw.fill(0);let y=this.seeded?1-Math.exp(-7*i):1;for(let e=0;e<o*3;e++)u[e]+=(d[e]-u[e])*y;this.seeded=!0;let[b,x]=e.sel;p[b]=1,p[x]=1;let S=this.hoverId>=0?this.hoverId:this.hoverStage;if(S>=0&&S<o){p[S]=Math.max(p[S],.85);let e=m[S];e>=0&&(p[e]=Math.max(p[e],.5))}let C=this.figs,w=this.halos,T=this.heads;for(let e=0;e<o;e++){let i=s[e],o=m[e]>=0,c=ap,d=.55;if(o){let t=Cm[l.find(t=>t.m===e||t.f===e).p%Cm.length];c=i.sex===`M`?t:rp(t,ap,.5),d=1}let h=r-i.arrive,g=i.arrive>1&&h>=0&&h<1.4,_=g?8*(1-Em(h/1.4))**1.5:0,v=u[e*3],y=u[e*3+1]+_,b=u[e*3+2],x=f[e],S=this.loveOf(t,n,e,l);this.alive[e]=x>.35,C.iPos.set([v,y,b],e*3),C.iCol.set([c[0]*d,c[1]*d,c[2]*d],e*3);let E=this.scl[e]=1.22+.14*(i.A-.5);C.iA.set([x*(o?1:.62),E,i.sex===`M`?0:1,p[e]],e*4);let D=g&&h>1?(h-1)/.4:-1;w.iPos.set([v,0,b],e*3),w.iCol.set(c,e*3),w.iA.set([x*(o?1:.55)*(g&&h<1?.3:1),.8+.45*S,D>=0?.15+.85*D:-1,p[e]],e*4);let O=Math.sin(a*1.3+e)*.012;T.pos.set([v+O,y+pp*.935*E,b],e*3),T.col.set([c[0]*d,c[1]*d,c[2]*d],e*3),T.size[e]=.62+.5*S+.3*p[e],T.alpha[e]=x*(o?.9:.5),T.sel[e]=p[e]*x,this.labelPos[e].set(v,y+pp*1.1*E,b)}C.touch(o),w.touch(o),T.touch(o);let E=this.beams,D=0;for(let e=0;e<o;e++){let t=s[e],n=r-t.arrive;if(t.arrive<=1||n<0||n>1.6)continue;let i=u[e*3],a=u[e*3+2],o=u[e*3+1]+8*(1-Em(n/1.4))**1.5+pp*this.scl[e],c=1-Tm(.6,1.6,n),d=m[e]>=0?Cm[l.find(t=>t.m===e||t.f===e).p%Cm.length]:ap;E.pos.set([i,o,a,i,o+6,a],D*3),E.col.set(d,D*3),E.col.set(d,D*3+3),E.alpha[D]=.42*c,E.alpha[D+1]=0,D+=2}E.touch(D);let O=this.ribbons,k=this.sparks,A=0,j=(e,t,n,r,i,a)=>{A>=xm||a<.01||(k.pos.set([e,t,n],A*3),k.col.set(r,A*3),k.size[A]=i,k.alpha[A]=a,A++)},M=e=>pp*.66*this.scl[e];O.begin();for(let e of l.slice(0,14)){let t=Dm((e.Xm+e.Xf)/6,0,1),n=Cm[e.p%Cm.length],i=Math.min(f[e.m],f[e.f]);if(i<.05)continue;let o=u[e.m*3],s=u[e.m*3+1]+M(e.m),c=u[e.m*3+2],l=u[e.f*3],d=u[e.f*3+1]+M(e.f),p=u[e.f*3+2],m=Math.hypot(o-l,c-p),h=Dm(1.8/Math.max(1.8,m),.25,1),g=(.45+.8*t)*(.6+.4*h)+(m>3?.15*m:0),_=.86+.14*Math.sin(a*2.2+e.p),v=(.04+.12*t)*_*(.5+.5*h),y=r-e.since,b=y>=0&&y<.7?Em(y/.6):1;if(O.add(o,s,c,l,d,p,g,0,b,v,n,(.35+.65*(.4+.6*t))*i*h,.14+.3*t,0),b<1){let e=b,t=1-e,n=(o+l)/2,r=(s+d)/2+g,i=(c+p)/2;j(t*t*o+2*t*e*n+e*e*l,t*t*s+2*t*e*r+e*e*d,t*t*c+2*t*e*i+e*e*p,wm,1.4*(1-y),.9)}}{let e=[],r=[];for(let i of t.men)for(let a of t.women){if(f[i]<.4||f[a]<.4||m[i]===a||!t.here[n*t.N+i]||!t.here[n*t.N+a])continue;let o=(t.pidx(i,a)*t.steps+n)*2,s=t.X[o]+t.U[o]+t.X[o+1]+t.U[o+1];if(!Number.isFinite(s)||s<=.9)continue;let c=i===b&&a===x,l=r.length;for(;l>0&&r[l-1]<(c?99:s);)l--;e.splice(l,0,i*64+a),r.splice(l,0,c?99:s),e.length>8&&(e.pop(),r.pop())}e.forEach((e,t)=>{let n=Math.floor(e/64),i=e%64,a=Dm((r[t]===99?3:r[t])/3.2,0,1),o=n===b&&i===x;O.add(u[n*3],u[n*3+1]+M(n),u[n*3+2],u[i*3],u[i*3+1]+M(i),u[i*3+2],.4+.6*a,0,1,.02+.035*a,lp,(.2+.5*a)*(o?1.5:1)*Math.min(f[n],f[i]),0,1)})}for(let e of t.events){if(e.kind!==`split`&&e.kind!==`vote`||e.a===void 0||e.b===void 0)continue;let n=(r-e.t)/1.1;if(n<0||n>1)continue;let i=e.a,a=e.b,o=Tm(0,.85,n),s=(1-n)**.8,c=Cm[t.pidx(i,a)%Cm.length],l=u[i*3],d=u[i*3+1]+M(i),f=u[i*3+2],p=u[a*3],m=u[a*3+1]+M(a),h=u[a*3+2],g=.9,_=.09*(1-.6*o),v=e.kind===`vote`?rp(c,sp,.35):c;O.add(l,d,f,p,m,h,g,0,.5-.5*o,_,v,.8*s,.2,0),O.add(l,d,f,p,m,h,g,.5+.5*o,1,_,v,.8*s,.2,0);let y=(l+p)/2,b=(d+m)/2+g*.5,x=(f+h)/2;j(y,b,x,wm,3.4*(1-n)**2,.95*(1-Dm(n*2.2,0,1))**1.5);for(let t=0;t<10;t++){let r=e.t*7+t*3.1,i=(Om(r)-.5)*3,a=.8+Om(r+1)*1.8,o=(Om(r+2)-.5)*3,c=n*1.1;j(y+i*c,b+a*c-3.2*c*c,x+o*c,v,.5*(1-n),.9*s)}}O.end();for(let e=0;e<o;e++){let t=s[e],n=r-t.arrive;if(t.arrive<=1||n<0||n>1.5)continue;let i=8*(1-Em(n/1.4))**1.5,o=m[e]>=0?Cm[l.find(t=>t.m===e||t.f===e).p%Cm.length]:ap;for(let t=0;t<5;t++)j(u[e*3]+Math.sin(a*3+t+e)*.12,u[e*3+1]+i+pp*.5+t*.55,u[e*3+2],o,.4*(1-t/6),(1-n/1.5)*(1-t/6)*.8)}k.touch(A);let N=0,P=(e,t,n,r,i)=>{N>=6||r<.01||(c.uWave.value[N].set(e,t,n,r),c.uWaveCol.value[N].set(i[0],i[1],i[2]),N++)};for(let e of t.events){let n=r-e.t;if(!(n<0||n>3)){if(e.kind===`vote`){if(n<1.5){let e=n/1.5;P(0,0,.6+13.8*(1-Em(e)),.95*(1-.35*e),sp)}else if(n<2.9){let e=(n-1.5)/1.4;P(0,0,.6+12.5*Em(e),.6*(1-e),cp)}}else if(e.kind===`casa`&&n<2.6){let e=n/2.6;P(km.annex.x,km.annex.z,27*Em(e),.95*(1-e),cp)}else if(e.kind===`couple`&&n<1&&e.a!==void 0&&e.b!==void 0){let r=n,i=Cm[t.pidx(e.a,e.b)%Cm.length];P((u[e.a*3]+u[e.b*3])/2,(u[e.a*3+2]+u[e.b*3+2])/2,.3+3.6*Em(r),.8*(1-r),i)}}}for(let e of t.cfg.shocks){let t=r-e.t;if(t>=0&&t<1.6){let n=t/1.6;P(0,0,14.4-10.2*Em(n),(1-n)*.9,e.s>=0?op:ap)}}for(let e=N;e<6;e++)c.uWave.value[e].set(0,0,-99,0);let F=t.events.some(e=>(e.kind===`vote`||e.kind===`casa`)&&r>=e.t&&r-e.t<1.4)?.5:.2;for(let e=0;e<260;e++)this.audience.alpha[e]=F*(.7+.3*Math.sin(a*1.6+e));this.audience.touch(260);let I=l.length?l.reduce((e,t)=>e+t.phi,0)/l.length:.5;c.uPit.value=.5+.12*Math.sin(a*2.1)+.2*Dm(I,0,2),this.padPit.glow.value=.55+.25*Math.sin(a*2.1);let L=this.pit;L.pos.set([0,.3,0],0),L.col.set(cp,0),L.size[0]=3.6+.5*Math.sin(a*2.1)+Math.min(1.8,I),L.alpha[0]=.5,L.pos.set([0,.34,0],3),L.col.set(wm,3),L.size[1]=1.3,L.alpha[1]=.8,L.touch(2);let R=this.embers;for(let e=0;e<48;e++){let t=(a*(.16+e%5*.03)+e*.173)%1,n=e*2.17,r=.15+.3*(e*7%5)/5;R.pos.set([Math.cos(n+t*2)*r,.25+t*2.4,Math.sin(n+t*2)*r],e*3),R.col.set(e%3?cp:wm,e*3),R.size[e]=.3*(1-t),R.alpha[e]=(1-t)*.85}R.touch(48);let z=this.dust;for(let e=0;e<Sm;e++){let t=Om(e)*Math.PI*2,n=2+Om(e+40)*11.5,r=(a*(.012+Om(e+9)*.02)+Om(e+77))%1;z.pos.set([Math.cos(t+a*.01)*n,.2+r*6,Math.sin(t+a*.01)*n],e*3),z.col.set(ap,e*3),z.size[e]=.2+Om(e+3)*.2,z.alpha[e]=.16*Math.sin(r*Math.PI)}z.touch(Sm);let ee=Dm(v,0,1),B=Dm(g,0,1);this.padHide.glow.value=.18+.95*ee,this.padAnnex.glow.value=.18+1*B,this.padHide.color.value.set(..._?Cm[t.pidx(_.m,_.f)%Cm.length]:op);let te=this.arch,ne=[1,.55+1.2*ee,.5+.9*B];for(let e=0;e<this.archN;e++)te.alpha[e]=this.archBase[e]*ne[this.archGroup[e]];te.touch(this.archN);let V=this.beds,H=0;km.beds.angles.forEach((e,t)=>{let n=Math.cos(e)*km.beds.r,r=Math.sin(e)*km.beds.r,i=0,a=ap;for(let e of l){let t=(u[e.m*3]+u[e.f*3])/2,o=(u[e.m*3+2]+u[e.f*3+2])/2,s=Math.hypot(t-n,o-r);s<1.8&&1-s/1.8>i&&(i=1-s/1.8,a=Cm[e.p%Cm.length])}let o=e+Math.PI/2,s=Math.cos(o),c=Math.sin(o),d=0,f=0;for(let e=0;e<=28;e++){let t=e/28*Math.PI*2,o=Math.sign(Math.cos(t))*Math.abs(Math.cos(t))**.5*1.05,l=Math.sign(Math.sin(t))*Math.abs(Math.sin(t))**.5*.5,u=n+o*s-l*c,p=r+o*c+l*s;e>0&&(V.pos.set([d,.03,f,u,.03,p],H*3),V.col.set(a,H*3),V.col.set(a,H*3+3),V.alpha[H]=V.alpha[H+1]=.11+.5*i,H+=2),d=u,f=p}}),V.touch(H);let re=this.ptr,ie=this.group,ae=this.size.x/this.size.y<.9?.55:.4,oe=km.annex.x*ae*g+km.hideaway.x*.14*ee,se=km.annex.z*ae*g+km.hideaway.z*.14*ee;if(this.reduced)re.x=re.y=0,this.focus.x=this.focus.z=0,ie.rotation.set(0,0,0),ie.position.set(0,0,0);else{let e=1-Math.exp(-3*i);re.x+=(re.tx-re.x)*e,re.y+=(re.ty-re.y)*e,this.focus.x+=(oe-this.focus.x)*e,this.focus.z+=(se-this.focus.z)*e,ie.rotation.y=.1*Math.sin(a*.11)+re.x*.09,ie.rotation.x=re.y*.045,ie.position.set(-this.focus.x,0,-this.focus.z*.4)}this.lastHideW=ee,this.lastAnnexW=B}loveOf(e,t,n,r){for(let e of r){if(e.m===n)return Dm(e.Xm/4,0,1);if(e.f===n)return Dm(e.Xf/4,0,1)}return .15}setPixelRatio(e){for(let t of[this.heads,this.sparks,this.audience,this.embers,this.dust,this.pit])t.pts.material.uniforms.uPx.value=e}pickables(){let e=[];this.group.updateMatrixWorld();for(let t=0;t<this.alive.length;t++)this.alive[t]&&e.push({id:t,pos:this.group.localToWorld(new X(this.cur[t*3],this.cur[t*3+1]+pp*.55*this.scl[t],this.cur[t*3+2]))});return e}labels(e,t){this.hoverStage=t;let n=e.run,r=n.isl,i=hm(n,e.k),a=e.t,o=this.camera;if(!o)return[];let s=this.size.x,c=this.size.y,l=[],u=(e,t,n,r,i)=>l.push({key:e,text:t,pos:n,cls:r,pri:i+(this.shown.has(e)?4:0)}),d=(e,n)=>{this.alive[e]&&u(`i`+e,r[e].name,this.labelPos[e],e===t||e===this.hoverId?`is-hover`:r[e].sex===`M`?`is-man`:`is-woman`,n)},f=this.hoverId>=0?this.hoverId:t;if(f>=0){d(f,200);let e=this.mate[f];e>=0&&d(e,120)}d(e.sel[0],100),d(e.sel[1],99),i.slice(0,3).forEach((e,t)=>{d(e.m,60-t),d(e.f,59-t)});for(let e=0;e<n.N;e++){let t=a-r[e].arrive;r[e].arrive>1&&t>=0&&t<1.6&&d(e,50)}for(let e of i)a-e.since>=0&&a-e.since<1.2&&e.since>1&&(d(e.m,40),d(e.f,39));for(let e=0;e<n.N;e++)this.pullw[e]>.5&&r[e].group!==`casa`&&d(e,30);let p=new X,m=(e,t,n,r,i,a,o)=>u(e,i,p.set(t,n,r).clone(),a,o);m(`p-annex`,km.annex.x,3.9,km.annex.z,`Casa Amor`,`is-tip`,this.lastAnnexW>.2?70:12),m(`p-hide`,km.hideaway.x,3.2,km.hideaway.z,`Hideaway`,`is-fixed`,this.lastHideW>.2?45:11),m(`p-pit`,0,.9,0,`Fire pit`,`is-fixed`,13),l.sort((e,t)=>t.pri-e.pri);let h=this.avoid.slice(),g=[],_=new Map,v=new X,y=new X;this.group.updateMatrixWorld();let b=new Set;for(let e of l){if(b.has(e.key))continue;b.add(e.key);let t=e.text.length*(e.cls.startsWith(`is-fixed`)||e.cls===`is-tip`?7.6:8.2)+20,n=[this.shown.get(e.key)??0,0,1,2].filter((e,t,n)=>n.indexOf(e)===t);for(let r of n){if(y.copy(e.pos),y.y+=r*.42,this.group.localToWorld(y),v.copy(y).project(o),v.z>=1)break;let n=(v.x*.5+.5)*s,i=(-v.y*.5+.5)*c,a=[n-t/2,i-24,n+t/2,i];if(!(a[0]<6||a[2]>s-6||a[1]<4||a[3]>c-4)&&!h.some(e=>a[0]<e[2]&&a[2]>e[0]&&a[1]<e[3]&&a[3]>e[1])){h.push(a),_.set(e.key,r),g.push({key:e.key,text:e.text,pos:y.clone(),cls:e.cls});break}}}return this.shown=_,g}dispose(){this.detach(),this.group.traverse(e=>{let t=e;t.geometry?.dispose(),t.material?.dispose()})}},jm=ip.map(np),Mm=[1,.95,.9],Nm=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n],Pm=(e,t,n)=>Math.min(n,Math.max(t,e)),Fm=`(prefers-reduced-motion: reduce)`,Im=()=>performance.now()*.001,Lm=`
  attribute vec3 aOther; attribute vec3 aColor; attribute float aAlpha; attribute float aWidth; attribute vec2 aSS; attribute float aS;
  uniform vec2 uRes; uniform float uScale;
  varying vec3 vC; varying float vA; varying float vS; varying float vSide;
  void main() {
    mat4 mvp = projectionMatrix * modelViewMatrix;
    vec4 p = mvp * vec4(position, 1.0);
    vec4 q = mvp * vec4(aOther, 1.0);
    vec2 ps = p.xy / p.w * uRes * 0.5;
    vec2 qs = q.xy / q.w * uRes * 0.5;
    vec2 d = (qs - ps) * aSS.y;
    float L = length(d);
    d = L > 1e-3 ? d / L : vec2(1.0, 0.0);
    float w = aWidth * uScale;
    vec2 off = vec2(-d.y, d.x) * aSS.x * w * 0.5 - d * aSS.y * w * 0.5;
    gl_Position = vec4(p.xy + off / uRes * 2.0 * p.w, p.z, p.w);
    vC = aColor; vA = aAlpha; vS = aS; vSide = aSS.x;
  }`,Rm=`
  precision highp float;
  uniform float uTime, uFade, uIn, uSoft, uMode, uRepeat, uSpeed, uAnim;
  varying vec3 vC; varying float vA; varying float vS; varying float vSide;
  void main() {
    float prof = pow(max(1.0 - abs(vSide), 0.0), uSoft);
    float a = vA * prof * uFade * uIn;
    vec3 col = vC;
    if (uMode > 0.5 && uMode < 1.5) {
      float comet = pow(fract(vS * uRepeat - uTime * uSpeed), 5.0);
      a *= mix(0.9, 0.4 + 1.7 * comet, uAnim);
      col = mix(col, vec3(1.0, 0.96, 0.9), comet * 0.55 * uAnim);
    } else if (uMode > 1.5) {
      float d = uTime - vS;
      if (d < 0.0) discard;
      a *= smoothstep(0.0, 0.06, d);
      col = mix(col, vec3(1.0, 0.96, 0.9), exp(-d * 4.0) * 0.7);
    }
    if (a < 0.003) discard;
    gl_FragColor = vec4(min(col, vec3(1.0)), clamp(a, 0.0, 1.0));
  }`,zm=class{max;mesh;mat;geo=new Uo;P;O;C;A;Wd;SS;S;attrs=[];n=0;constructor(e,t={}){this.max=e;let n=e*4;this.P=new Float32Array(n*3),this.O=new Float32Array(n*3),this.C=new Float32Array(n*3),this.A=new Float32Array(n),this.Wd=new Float32Array(n),this.SS=new Float32Array(n*2),this.S=new Float32Array(n);let r=(e,t,n)=>{let r=new Oo(t,n).setUsage($r);this.geo.setAttribute(e,r),this.attrs.push(r)};r(`position`,this.P,3),r(`aOther`,this.O,3),r(`aColor`,this.C,3),r(`aAlpha`,this.A,1),r(`aWidth`,this.Wd,1),r(`aSS`,this.SS,2),r(`aS`,this.S,1);let i=new Uint32Array(e*6);for(let t=0;t<e;t++){let e=t*4;i.set([e,e+1,e+2,e+2,e+1,e+3],t*6)}this.geo.setIndex(new Oo(i,1)),this.geo.setDrawRange(0,0),this.mat=new rc({uniforms:{uRes:{value:new Bi(1,1)},uScale:{value:1},uTime:{value:0},uFade:{value:1},uIn:{value:1},uSoft:{value:t.soft??.9},uMode:{value:t.mode??0},uRepeat:{value:t.repeat??1},uSpeed:{value:t.speed??0},uAnim:{value:1}},vertexShader:Lm,fragmentShader:Rm,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,side:2,toneMapped:!1}),this.mesh=new ps(this.geo,this.mat),this.mesh.frustumCulled=!1;let a=new Bi;this.mesh.onBeforeRender=e=>{e.getDrawingBufferSize(a),this.mat.uniforms.uRes.value.copy(a)}}begin(){this.n=0}seg(e,t,n,r,i,a,o,s,c,l,u,d,f=0,p=0){if(this.n>=this.max)return;let m=this.n*4;this.n++;for(let h=0;h<4;h++){let g=m+h,_=h<2,v=_?o:s;this.P.set(_?[e,t,n]:[r,i,a],g*3),this.O.set(_?[r,i,a]:[e,t,n],g*3),this.C[g*3]=v[0],this.C[g*3+1]=v[1],this.C[g*3+2]=v[2],this.A[g]=_?c:l,this.Wd[g]=_?u:d,this.SS[g*2]=h&1?1:-1,this.SS[g*2+1]=_?1:-1,this.S[g]=_?f:p}}end(){this.geo.setDrawRange(0,this.n*6);for(let e of this.attrs)e.needsUpdate=!0}u(e,t){this.mat.uniforms[e].value=t}dispose(){this.geo.dispose(),this.mat.dispose()}},Bm=`
  uniform float uHi; varying vec2 vL;
  void main() { vL = (position.xz + 4.0) / 8.0 * uHi; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,Vm=`
  precision highp float;
  uniform float uHi, uTime, uAnim, uCap, uFade;
  uniform vec4 uA, uB;           // am af bm bf | cm cf dm df
  uniform vec3 uHead;            // xm xf on
  uniform vec3 uHover;           // xm xf on
  varying vec2 vL;
  float lineAt(float v, float w) { return 1.0 - smoothstep(0.0, w, abs(v) / max(fwidth(v), 1e-6)); }
  void main() {
    float xm = vL.x, xf = vL.y;
    if (xm < 0.0 || xf < 0.0 || xm > uHi || xf > uHi) discard;
    float fm = -uA.x * xm + uA.z * xf + uB.x + uB.z * xm * xf;
    float ff = -uA.y * xf + uA.w * xm + uB.y + uB.w * xm * xf;
    float speed = length(vec2(fm, ff));
    // grid: every half unit faint, every unit stronger
    vec2 g1 = abs(fract(vL - 0.5) - 0.5) / fwidth(vL);
    vec2 g2 = abs(fract(vL * 2.0 - 0.5) - 0.5) / fwidth(vL * 2.0);
    float major = 1.0 - min(min(g1.x, g1.y), 1.0), minor = 1.0 - min(min(g2.x, g2.y), 1.0);
    vec3 col = vec3(0.93, 0.90, 0.84) * (minor * 0.05 + major * 0.11);
    // where both partners' love is rising (rose haze) or both falling (blue haze)
    float sm = smoothstep(-0.12, 0.12, fm), sf = smoothstep(-0.12, 0.12, ff);
    col += vec3(1.0, 0.42, 0.54) * sm * sf * 0.07 + vec3(0.56, 0.72, 1.0) * (1.0 - sm) * (1.0 - sf) * 0.06;
    // calm pools: love hardly changes here
    col += vec3(0.93, 0.90, 0.84) * exp(-speed * 3.0) * 0.1;
    // the two nullclines: rose, dxm/dt = 0; ivory, dxf/dt = 0
    col += vec3(1.0, 0.42, 0.54) * lineAt(fm, 1.7) * 0.62 + vec3(0.93, 0.90, 0.84) * lineAt(ff, 1.7) * 0.55;
    // beyond the run-away line
    float away = max(step(uCap, xm), step(uCap, xf));
    float hatch = 0.5 + 0.5 * sin((vL.x + vL.y) * 46.0 - uTime * uAnim * 1.2);
    col += vec3(0.85, 0.64, 0.25) * away * (0.045 + 0.04 * hatch);
    // where the couple is now: a ring that leaves it
    if (uHead.z > 0.5) {
      float d = length(vL - uHead.xy), r = mix(0.22, 0.2 + 0.7 * fract(uTime * 0.42), uAnim);
      float ring = 1.0 - smoothstep(0.0, 1.8, abs(d - r) / max(fwidth(d), 1e-6));
      col += vec3(1.0, 0.42, 0.54) * ring * mix(0.55, 0.7 * (1.0 - mix(0.0, fract(uTime * 0.42), uAnim)), uAnim);
      col += vec3(1.0, 0.42, 0.54) * exp(-d * 6.0) * 0.12;
    }
    if (uHover.z > 0.5) {
      float d = length(vL - uHover.xy);
      float ring = 1.0 - smoothstep(0.0, 1.6, abs(d - 0.07) / max(fwidth(d), 1e-6));
      col += vec3(0.93, 0.90, 0.84) * (ring * 0.9 + exp(-d * 14.0) * 0.18);
    }
    gl_FragColor = vec4(col * uFade, 1.0);
  }`,Hm=`
  uniform vec2 uSize; varying vec2 vU;
  void main() { vU = position.xy * uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,Um=`
  precision highp float;
  uniform float uStrength; varying vec2 vU;
  void main() {
    vec2 g1 = abs(fract(vU - 0.5) - 0.5) / fwidth(vU);
    float l = 1.0 - min(min(g1.x, g1.y), 1.0);
    float fade = 1.0 - 0.55 * clamp(vU.y / 4.0, 0.0, 1.0);
    gl_FragColor = vec4(vec3(0.93, 0.90, 0.84) * l * 0.07 * fade * uStrength, 1.0);
  }`,Wm=`
  precision highp float;
  uniform float uTime, uAnim, uStrength; uniform vec3 uCol; varying vec2 vU;
  void main() {
    float v = clamp(vU.y / 4.0, 0.0, 1.0);
    float stripes = 0.5 + 0.5 * sin((vU.x * 5.0 + vU.y * 7.0) * 3.0 - uTime * uAnim * 1.6);
    float base = pow(1.0 - v, 2.2);
    float foot = 1.0 - smoothstep(0.0, 0.06, vU.y);
    float a = uStrength * (0.035 + 0.075 * base + 0.05 * stripes * base + 0.5 * foot);
    gl_FragColor = vec4(uCol * a, 1.0);
  }`,Gm=e=>e.charAt(0).toUpperCase()+e.slice(1);function Km(e,t){let n=Pp(e,t.xm,t.xf),r=t.disc;if(r<0)return null;let i=Math.sqrt(r),a=(t.tr+i)/2,o=(t.tr-i)/2,s=e=>{let t;t=Math.abs(n[0][1])>1e-9?[n[0][1],e-n[0][0]]:Math.abs(n[1][0])>1e-9?[e-n[1][1],n[1][0]]:Math.abs(e-n[0][0])<1e-9?[1,0]:[0,1];let r=Math.hypot(t[0],t[1])||1;return[t[0]/r,t[1]/r]};return{l1:a,l2:o,v1:s(a),v2:s(o)}}var qm=class{group=new za;requestRender=null;run;hi=3;sc=8/3;ys=.85;phiTop=3;reduced=typeof matchMedia==`function`&&matchMedia(Fm).matches;mq=typeof matchMedia==`function`?matchMedia(Fm):null;pixel=1;floor;floorMat;wallGrids=[];capWalls=[];capMat;axes=new zm(260,{soft:.7});streams=new zm(14e3,{soft:.8,mode:1,repeat:.34,speed:.42});glyph=new zm(900,{soft:.7});haloR=new zm(1200,{soft:1.8});coreR=new zm(1200,{soft:.75});shadowR=new zm(1200,{soft:1.2});dropR=new zm(60,{soft:1});ghostR=new zm(520,{soft:1});probeR=new zm(3600,{soft:.9,mode:2});fps=ep(8,!0);head=ep(4,!0);beads=ep(120,!0);oheads=ep(90,!1);others;othersGeo=new Uo;curtain;curtainGeo=new Uo;cPos;cCol;cAl;seen=[];fixed=[];par=null;parKey=``;streamKey=``;streamFade=0;trailKey=``;lastT=Im();tx;ty;tz;tk;tc;headW={x:0,y:0,z:0,xm:0,xf:0,phi:0,ok:!1};dayTags=[];nullTags=[];statics=[];probes=[];hover=null;ghostKey=``;el=null;cam=null;ray=new $c;plane=new qo(new X(0,1,0),0);hit=new X;down=null;inv=new da;local=new es;onMq=()=>{this.reduced=!!this.mq?.matches,this.trailKey=``,this.streamKey=``};constructor(){this.floorMat=new rc({uniforms:{uHi:{value:3},uTime:{value:0},uAnim:{value:1},uCap:{value:1e3},uFade:{value:1},uA:{value:new oa},uB:{value:new oa},uHead:{value:new X},uHover:{value:new X}},vertexShader:Bm,fragmentShader:Vm,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,side:2,toneMapped:!1});let e=new Js(8,8);e.rotateX(-Math.PI/2),this.floor=new ps(e,this.floorMat),this.floor.frustumCulled=!1,this.floor.onBeforeRender=(e,t,n)=>this.attach(e.domElement,n),this.group.add(this.floor);let t=(e,t)=>new rc({uniforms:t,vertexShader:Hm,fragmentShader:e,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,side:2,toneMapped:!1});for(let e=0;e<2;e++){let e=new ps(new Js(1,1).translate(.5,.5,0),t(Um,{uSize:{value:new Bi(3,3)},uStrength:{value:1}}));e.frustumCulled=!1,this.wallGrids.push(e),this.group.add(e)}this.capMat=t(Wm,{uSize:{value:new Bi(3,3)},uTime:{value:0},uAnim:{value:1},uStrength:{value:1},uCol:{value:new X(.85,.64,.25)}});for(let e=0;e<2;e++){let e=new ps(new Js(1,1).translate(.5,.5,0),this.capMat);e.frustumCulled=!1,this.capWalls.push(e),this.group.add(e)}this.others=new Ps(this.othersGeo,new rc({uniforms:{uNow:{value:0}},vertexShader:`attribute vec3 aColor; attribute float aT; uniform float uNow; varying vec3 vC; varying float vA; void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); vC=aColor; float past = step(aT, uNow); vA = past * (0.07 + 0.36 * pow(clamp(aT / max(uNow, 0.001), 0.0, 1.0), 2.0)); }`,fragmentShader:`precision mediump float; varying vec3 vC; varying float vA; void main(){ if (vA < 0.004) discard; gl_FragColor = vec4(vC, vA); }`,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,toneMapped:!1})),this.others.frustumCulled=!1,this.curtain=new ps(this.curtainGeo,new rc({vertexShader:`attribute vec3 aColor; attribute float aAlpha; varying vec3 vC; varying float vA; void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); vC=aColor; vA=aAlpha; }`,fragmentShader:`precision mediump float; varying vec3 vC; varying float vA; void main(){ gl_FragColor = vec4(vC, vA); }`,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,side:2,toneMapped:!1})),this.curtain.frustumCulled=!1;for(let e of[this.others,this.curtain,this.shadowR.mesh,this.axes.mesh,this.streams.mesh,this.glyph.mesh,this.fps.pts,this.oheads.pts,this.haloR.mesh,this.coreR.mesh,this.dropR.mesh,this.probeR.mesh,this.ghostR.mesh,this.beads.pts,this.head.pts])this.group.add(e);this.group.scale.setScalar(.9),this.group.position.y=.15,this.mq?.addEventListener?.(`change`,this.onMq)}setRun(e){this.run=e;let t=e.steps,n=e.nM*e.nW,r=2.4;for(let t=0;t<e.X.length;t+=2){let n=Math.max(e.X[t],e.X[t+1]);Number.isFinite(n)&&n>r&&(r=n)}this.hi=Math.min(6.5,Math.max(3,r*1.12)),this.sc=8/this.hi;let i=0;for(let t=0;t<e.PHI.length;t++){let n=e.PHI[t];Number.isFinite(n)&&n>i&&(i=n)}this.phiTop=Math.max(3,Math.ceil(i+.15)),this.ys=Math.min(1.1,3.9/this.phiTop);let a=t+3;this.tx=new Float32Array(a),this.ty=new Float32Array(a),this.tz=new Float32Array(a),this.tk=new Float32Array(a),this.tc=new Uint8Array(a),this.cPos=new Float32Array(a*2*3),this.cCol=new Float32Array(a*2*3),this.cAl=new Float32Array(a*2),this.curtainGeo.setAttribute(`position`,new Oo(this.cPos,3).setUsage($r)),this.curtainGeo.setAttribute(`aColor`,new Oo(this.cCol,3).setUsage($r)),this.curtainGeo.setAttribute(`aAlpha`,new Oo(this.cAl,1).setUsage($r));let o=new Uint32Array(a*6);for(let e=0;e<a-1;e++)o.set([e*2,e*2+1,e*2+2,e*2+2,e*2+1,e*2+3],e*6);this.curtainGeo.setIndex(new Oo(o,1)),this.curtainGeo.setDrawRange(0,0);let s=new Set;for(let n=0;n<t;n++)for(let t of e.men){let r=e.partner[n*e.N+t];r>=0&&s.add(e.pidx(t,r))}this.seen=[...s].filter(e=>e<n),this.buildOthers(),this.buildStatic(),this.probes=[],this.hover=null,this.parKey=``,this.streamKey=``,this.trailKey=``,this.ghostKey=``,this.floorMat.uniforms.uHi.value=this.hi;let c=6<=this.hi+1e-6;this.floorMat.uniforms.uCap.value=c?6:1e3}buildOthers(){let e=this.run,t=e.steps,n=this.sc,r=this.ys,i=[],a=[],o=[];for(let s of this.seen){let c=jm[s%jm.length];for(let l=0;l<t-1;l++){let u=s*t+l,d=u+1,f=e.PHI[u],p=e.PHI[d];Number.isFinite(f)&&Number.isFinite(p)&&(i.push(e.X[u*2]*n-4,f*r,e.X[u*2+1]*n-4,e.X[d*2]*n-4,p*r,e.X[d*2+1]*n-4),a.push(...c,...c),o.push(l/(t-1),(l+1)/(t-1)))}}this.othersGeo.setAttribute(`position`,new jo(i,3)),this.othersGeo.setAttribute(`aColor`,new jo(a,3)),this.othersGeo.setAttribute(`aT`,new jo(o,1)),this.othersGeo.computeBoundingSphere()}buildStatic(){let e=this.hi,t=this.sc,n=this.ys,r=this.phiTop,i=r*n,a=e*t-4,o=this.axes;o.begin();let s=[],c=(e,t,n)=>new X(e,t,n);for(let[e,t,n,r]of[[-4,-4,a,-4],[a,-4,a,a],[a,a,-4,a],[-4,a,-4,-4]])o.seg(e,0,t,n,0,r,ap,ap,.2,.2,1,1);o.seg(-4,0,-4,a+.35,0,-4,op,op,.9,.9,1.7,1.7),o.seg(-4,0,-4,-4,0,a+.35,ap,ap,.8,.8,1.7,1.7),o.seg(-4,0,-4,-4,i+.3,-4,sp,sp,.9,.9,1.7,1.7),o.seg(a+.35,0,-4,a+.12,0,-4.14,op,op,.9,.9,1.4,1.4),o.seg(a+.35,0,-4,a+.12,0,-3.86,op,op,.9,.9,1.4,1.4),o.seg(-4,0,a+.35,-4.14,0,a+.12,ap,ap,.8,.8,1.4,1.4),o.seg(-4,0,a+.35,-3.86,0,a+.12,ap,ap,.8,.8,1.4,1.4),o.seg(-4,i+.3,-4,-4.12,i+.1,-4,sp,sp,.9,.9,1.4,1.4),o.seg(-4,i+.3,-4,-3.88,i+.1,-4,sp,sp,.9,.9,1.4,1.4);let l=e<=3.6;for(let n=l?.5:1;n<=e+1e-6;n+=l?.5:1){let e=Math.abs(n-Math.round(n))<1e-6,r=e?.22:.12,i=n*t-4;o.seg(i,0,-4,i,0,-4-r,op,op,.85,.85,1,1),o.seg(-4,0,i,-4-r,0,i,ap,ap,.8,.8,1,1),e&&(s.push({key:`tm`+n,text:String(n),pos:c(i,0,-4.4),cls:`p3-tick`}),s.push({key:`tf`+n,text:String(n),pos:c(-4.45,0,i),cls:`p3-tick`}))}for(let e=1;e<=r;e++){let t=e*n;o.seg(-4,t,-4,-3.78,t,-4,sp,sp,.85,.85,1,1),s.push({key:`tp`+e,text:String(e),pos:c(-4.28,t+.12,-4),cls:`p3-tick`})}o.end(),s.push({key:`ax-m`,text:`Love of him`,pos:c((a-4)*.5+.5,0,-4.95),cls:`p3-axis is-man`}),s.push({key:`ax-f`,text:`Love of her`,pos:c(-5.05,0,(a-4)*.5+.5),cls:`p3-axis is-woman`}),s.push({key:`ax-p`,text:`Public support`,pos:c(-4,i+.7,-4),cls:`p3-axis is-vote`});let u=this.wallGrids[0],d=this.wallGrids[1];u.position.set(-4,0,-4),u.scale.set(8,i,1),u.material.uniforms.uSize.value.set(e,r),d.position.set(-4,0,-4),d.scale.set(8,i,1),d.rotation.y=-Math.PI/2,d.material.uniforms.uSize.value.set(e,r);let f=6<=e+1e-6,p=(f?6:e)*t-4,m=this.capWalls[0],h=this.capWalls[1];m.position.set(-4,0,p),m.scale.set(8,i*.95,1),m.rotation.y=0,h.position.set(p,0,-4),h.scale.set(8,i*.95,1),h.rotation.y=-Math.PI/2,this.capMat.uniforms.uSize.value.set(e,r*.95),this.capMat.uniforms.uStrength.value=f?1:.45,s.push({key:`cap`,text:f?`Run-away line, 6`:`Run-away at 6, off plane`,pos:c(p,i*.72,(a-4)/2),cls:`p3-wall`}),this.statics=s}update(e){let{run:t,k:n,sel:r}=e;if(t!==this.run)return;let[i,a]=r,o=t.steps,s=t.pidx(i,a),c=Im(),l=+!this.reduced,u=Math.min(.1,c-this.lastT);this.lastT=c;let d=(e.t-1)/Wp,f=Pm(Math.abs(d-n)<=1.5?d:n,0,o-1),p=this.reduced?0:c,m=Math.min(o-1,Math.round(f)),h=Number.isFinite(t.CONTACT[s*o+m])?t.CONTACT[s*o+m]:1,g=kp(am(t.cfg,t.isl[i],t.isl[a]),h),_=`${s}|${g.am.toFixed(4)}|${g.af.toFixed(4)}|${g.bm.toFixed(4)}|${g.bf.toFixed(4)}|${g.gm.toFixed(4)}|${g.dm.toFixed(4)}|${g.df.toFixed(4)}|${g.Am}|${g.Af}|${this.hi}`;_!==this.parKey&&(this.parKey=_,this.onField(g,s)),this.others.material.uniforms.uNow.value=f/(o-1);let v=`${s}|${Math.floor(f*4)}|${+!!this.reduced}`;v!==this.trailKey&&(this.trailKey=v,this.buildTrail(t,s,f)),this.beadsAndOthers(t,s,f,m,p);let y=this.floorMat.uniforms;y.uTime.value=p,y.uAnim.value=l,y.uHead.value.set(this.headW.xm,this.headW.xf,+!!this.headW.ok),y.uHover.value.set(this.hover?this.hover[0]:0,this.hover?this.hover[1]:0,+!!this.hover),this.capMat.uniforms.uTime.value=p,this.capMat.uniforms.uAnim.value=l,this.streamFade=this.reduced?1:Math.min(1,this.streamFade+u*1.8),this.streams.u(`uTime`,p),this.streams.u(`uAnim`,l),this.streams.u(`uIn`,this.streamFade*this.streamFade*(3-2*this.streamFade)),this.probeR.u(`uTime`,this.reduced?1e6:c),this.glyphs(p),this.ghost()}onField(e,t){this.par=e;let n=e.gm*e.Af,r=e.gf*e.Am,i=this.floorMat.uniforms;i.uA.value.set(e.am,e.af,e.bm,e.bf),i.uB.value.set(n,r,e.dm,e.df),this.fixed=Ip(e).filter(e=>e.xm>=-.05&&e.xf>=-.05&&e.xm<=this.hi*1.02&&e.xf<=this.hi*1.02).slice(0,6),this.buildStreams(e);let a=this.hi,o=this.sc,s=[];for(let t of[.82,.7,.58,.46,.94]){let r=t*a,i=e.bm+e.dm*r,c=Math.abs(i)>1e-6?(e.am*r-n)/i:NaN;if(Number.isFinite(c)&&c>.06*a&&c<.94*a){s.push({key:`nl-m`,text:`His love steady`,pos:new X(r*o-4,.05,c*o-4),cls:`p3-null is-man`});break}}for(let t of[.82,.7,.58,.46,.94]){let n=t*a,i=e.bf+e.df*n,c=Math.abs(i)>1e-6?(e.af*n-r)/i:NaN;if(Number.isFinite(c)&&c>.06*a&&c<.94*a){s.push({key:`nl-f`,text:`Her love steady`,pos:new X(c*o-4,.05,n*o-4),cls:`p3-null`});break}}this.nullTags=s,this.streamFade=+!!this.reduced,this.probes.length&&(this.probes=[],this.flushProbes())}buildStreams(e){let t=this.streams,n=this.hi,r=this.sc,i=n/120,a=n*1;t.begin();let o=(t,n,r)=>{let[i,a]=Mp(e,t,n),o=Math.hypot(i,a);return o<1e-9?[0,0,0]:[r*i/o,r*a/o,o]},s=(e,t,n)=>{let r=[],s=e,c=t;for(let e=0;e<150;e++){let[e,t,l]=o(s,c,n);if(l<.012)break;let[u,d]=o(s+e*i/2,c+t*i/2,n),[f,p]=o(s+u*i/2,c+d*i/2,n),[m,h]=o(s+f*i,c+p*i,n);if(s+=i/6*(e+2*u+2*f+m),c+=i/6*(t+2*d+2*p+h),s<0||c<0||s>a||c>a||!Number.isFinite(s)||!Number.isFinite(c))break;r.push([s,c,l])}return r},c=ap,l=Nm(ap,op,.35);for(let a=0;a<8;a++)for(let o=0;o<8;o++){let u=(a*7+o*13)%5/5-.4,d=(a*11+o*3)%5/5-.4,f=(a+.5+u*.3)/8*n,p=(o+.5+d*.3)/8*n,m=s(f,p,-1).reverse(),h=s(f,p,1),g=[...m,[f,p,Math.hypot(...Mp(e,f,p))],...h];if(g.length<6)continue;let _=[(a*31+o*17)%11*.37];for(let e=1;e<g.length;e++)_.push(_[e-1]+i/Math.max(.12,(g[e][2]+g[e-1][2])/2));let v=g.length;for(let e=1;e<v;e++){let n=(e-1)/(v-1),i=e/(v-1),a=Math.min(1,n*7,(1-n)*7),o=Math.min(1,i*7,(1-i)*7),s=Math.min(1,g[e-1][2]*.8),u=Math.min(1,g[e][2]*.8);t.seg(g[e-1][0]*r-4,.012,g[e-1][1]*r-4,g[e][0]*r-4,.012,g[e][1]*r-4,c,l,a*(.08+.17*s),o*(.08+.17*u),1.15,1.15,_[e-1],_[e])}let y=Math.floor(v*.62);if(y>1&&y<v-1){let e=g[y-1][0]*r-4,n=g[y-1][1]*r-4,i=g[y][0]*r-4,a=g[y][1]*r-4,o=i-e,s=a-n,c=Math.hypot(o,s)||1,u=o/c,d=s/c,f=.13;t.seg(i,.012,a,i-(u-d*.6)*f,.012,a-(d+u*.6)*f,l,l,.34,.1,1,1,_[y],_[y]),t.seg(i,.012,a,i-(u+d*.6)*f,.012,a-(d-u*.6)*f,l,l,.34,.1,1,1,_[y],_[y])}}t.end()}buildTrail(e,t,n){let r=e.steps,i=this.sc,a=this.ys,o=Math.min(r-1,Math.floor(n)),s=n-o,c=0,l=0,u=-1;for(let n=0;n<=o;n++){let o=t*r+n,s=e.X[o*2],d=e.X[o*2+1];if(!Number.isFinite(s)||!Number.isFinite(d))continue;let f=e.PHI[o],p=Number.isFinite(f);p&&(l=f),this.tx[c]=s*i-4,this.ty[c]=l*a,this.tz[c]=d*i-4,this.tk[c]=n,this.tc[c]=+!!p,u=n,c++}if(c>0&&s>.02&&u===o&&o+1<r){let l=t*r+o+1,u=e.X[l*2],d=e.X[l*2+1],f=e.PHI[l];if(Number.isFinite(u)&&Number.isFinite(d)){let e=c-1,t=Number.isFinite(f)?f:this.ty[e]/a;this.tx[c]=this.tx[e]+(u*i-4-this.tx[e])*s,this.ty[c]=this.ty[e]+(t*a-this.ty[e])*s,this.tz[c]=this.tz[e]+(d*i-4-this.tz[e])*s,this.tk[c]=n,this.tc[c]=this.tc[e],c++}}let d=this.haloR,f=this.coreR,p=this.shadowR,m=this.dropR;d.begin(),f.begin(),p.begin(),m.begin();let h=[];if(c===0)this.headW.ok=!1,this.curtainGeo.setDrawRange(0,0);else{let e=this.tk[0],t=Math.max(1,this.tk[c-1]-e),n=n=>{let r=(this.tk[n]-e)/t;return Nm(this.tc[n]?op:lp,Mm,r**14*.6)};for(let r=1;r<c;r++){let i=(this.tk[r-1]-e)/t,a=(this.tk[r]-e)/t,o=n(r-1),s=n(r),c=.1+.8*i**1.6,l=.1+.8*a**1.6,u=1+1.9*i,m=1+1.9*a;f.seg(this.tx[r-1],this.ty[r-1],this.tz[r-1],this.tx[r],this.ty[r],this.tz[r],o,s,c,l,u,m),d.seg(this.tx[r-1],this.ty[r-1],this.tz[r-1],this.tx[r],this.ty[r],this.tz[r],o,s,c*.1,l*.1,u*3.4,m*3.4),p.seg(this.tx[r-1],.006,this.tz[r-1],this.tx[r],.006,this.tz[r],o,s,.34*i*i,.34*a*a,1.4,1.4)}for(let r=0;r<c;r++){let i=(this.tk[r]-e)/t,a=n(r);this.cPos.set([this.tx[r],0,this.tz[r],this.tx[r],this.ty[r],this.tz[r]],r*6),this.cCol.set([a[0],a[1],a[2],a[0],a[1],a[2]],r*6),this.cAl[r*2]=0,this.cAl[r*2+1]=.04+.12*i*i}for(let e of[`position`,`aColor`,`aAlpha`])this.curtainGeo.getAttribute(e).needsUpdate=!0;this.curtainGeo.setDrawRange(0,Math.max(0,c-1)*6);let r=c-1,o=this.tx[r],s=this.ty[r],l=this.tz[r];if(this.headW={x:o,y:s,z:l,xm:(o+4)/i,xf:(l+4)/i,phi:s/a,ok:!0},m.seg(o,0,l,o,s,l,op,Mm,.12,.7,1.2,1.5),c>2){let e=c-2,t=o-this.tx[e],n=s-this.ty[e],r=l-this.tz[e],i=Math.hypot(t,n,r);if(i>1e-4){let e=.75,a=t/i,c=n/i,u=r/i,d=o+a*e,f=s+c*e,p=l+u*e;m.seg(o,s,l,d,f,p,Mm,op,.7,.25,1.4,1.1);let h=-u,g=a,_=Math.hypot(h,g)||1,v=h/_*.09,y=g/_*.09;m.seg(d,f,p,d-a*.16+v,f-c*.16,p-u*.16+y,op,op,.5,.2,1,1),m.seg(d,f,p,d-a*.16-v,f-c*.16,p-u*.16-y,op,op,.5,.2,1,1)}}m.seg(o,0,l,o,0,-4,op,op,.3,.02,1,1),m.seg(o,0,l,-4,0,l,ap,ap,.26,.02,1,1),m.seg(o,s,l,-4,s,-4,sp,sp,.2,.02,1,1);for(let e=0;e<c;e++){let t=Math.round(1+this.tk[e]*Wp);t%10==0&&Math.abs(1+this.tk[e]*.1-t)<.1*.51&&!h.some(e=>e.day===t)&&h.push({day:t,pos:new X(this.tx[e]+.42,this.ty[e]+.02,this.tz[e]-.42)})}}d.end(),f.end(),p.end(),m.end(),this.dayTags=h,this.trailBeads=c}trailBeads=0;beadsAndOthers(e,t,n,r,i){let[a,o]=[e.men[Math.floor(t/e.nW)],e.women[t%e.nW]],s=this.head,c=this.headW,l=this.reduced?1:1+.12*Math.sin(i*3.1);c.ok?(s.pos.set([c.x,c.y,c.z],0),s.col.set(op,0),s.size[0]=2.3*l,s.alpha[0]=1,s.sel[0]=1,s.pos.set([c.x,.01,c.z],3),s.col.set(ap,3),s.size[1]=.95,s.alpha[1]=.6,s.sel[1]=0,s.touch(2)):s.touch(0);let u=this.beads,d=0,f=(e,t,n,r,i,a,o)=>{d>=118||(u.pos.set([e,t,n],d*3),u.col.set(r,d*3),u.size[d]=i,u.alpha[d]=a,u.sel[d]=o,d++)};if(c.ok){for(let e=0;e<this.trailBeads;e++){let t=1+this.tk[e]*Wp,n=Math.round(t);n%5==0&&Math.abs(t-n)<.1*.51&&n!==1&&f(this.tx[e],this.ty[e],this.tz[e],ap,n%10==0?.62:.4,.8,0)}let t=1+n*Wp;for(let n of e.events){if(n.t>t||n.a!==a||n.b!==o||n.kind!==`couple`&&n.kind!==`split`&&n.kind!==`vote`)continue;let r=Math.min(Jm(e)-1,Math.round((n.t-1)/Wp)),i=this.indexAt(r);i>=0&&f(this.tx[i],this.ty[i],this.tz[i],n.kind===`couple`?op:n.kind===`split`?lp:cp,1.25,.95,1)}f(c.x,.01,-4,op,1,.95,1),f(-4,.01,c.z,ap,1,.95,1),f(-4,c.y,-4,sp,1,.95,1)}u.touch(d);let p=this.oheads,m=0,h=e.steps;for(let n of this.seen){if(n===t||m>=88)continue;let i=n*h+r,a=e.PHI[i];Number.isFinite(a)&&(p.pos.set([e.X[i*2]*this.sc-4,a*this.ys,e.X[i*2+1]*this.sc-4],m*3),p.col.set(jm[n%jm.length],m*3),p.size[m]=.78,p.alpha[m]=.85,m++)}p.touch(m)}indexAt(e){let t=0,n=this.trailBeads-1,r=-1;for(;t<=n;){let i=t+n>>1;this.tk[i]<=e+.001?(r=i,t=i+1):n=i-1}return r}glyphs(e){let t=this.glyph,n=this.sc,r=this.par;t.begin();let i=this.fps,a=0;if(r)for(let o of this.fixed){let s=o.xm*n-4,c=o.xf*n-4,l=.026,u=.42,d=o.stable,f=d?ap:cp,p=(e,n,r,i,a,o=1.15,s=f)=>t.seg(e,l,n,r,l,i,s,s,a,a,o,o),m=(e,t,n,r,i,a=f)=>{let o=.1,s=Math.hypot(n,r)||1,c=n/s,l=r/s;p(e,t,e-(c-l*.7)*o,t-(l+c*.7)*o,i,1.1,a),p(e,t,e-(c+l*.7)*o,t-(l-c*.7)*o,i,1.1,a)},h=(e,t,n,r)=>{let i=u*1.15,a=u*2.7,o=s+e*a,l=c+t*a,d=s+e*i,f=c+t*i;p(o,l,d,f,.7,1.15,r),n?m(d,f,-e,-t,.85,r):m(o,l,e,t,.85,r)};for(let e=0;e<40;e++){if(!d&&e%3==2)continue;let t=e/40*Math.PI*2,n=(e+1)/40*Math.PI*2;p(s+Math.cos(t)*u,c+Math.sin(t)*u,s+Math.cos(n)*u,c+Math.sin(n)*u,.9,1.3)}let g=Km(r,o),_=g?[g.v1,g.v2]:[[1,0],[0,1]];if(o.kind===`stable node`||o.kind===`unstable node`){let e=o.kind===`stable node`;for(let[t,n]of _)h(t,n,e,f),h(-t,-n,e,f)}else if(o.kind===`saddle`&&g){let e=g.l1<0?g.v1:g.v2,t=g.l1<0?g.v2:g.v1;for(let n of[1,-1])h(e[0]*n,e[1]*n,!0,ap),h(t[0]*n,t[1]*n,!1,cp)}else if(o.kind===`stable spiral`||o.kind===`unstable spiral`){let t=Pp(r,o.xm,o.xf),n=t[1][0]-t[0][1]>=0?1:-1,i=o.kind===`stable spiral`,a=Math.PI*2*1.5,l=this.reduced?0:e*.55*n,d=[];for(let e=0;e<=30;e++){let t=e/30,r=u*(i?2.7-2.3*t:.4+2.3*t),o=n*t*a+l;d.push([s+Math.cos(o)*r,c+Math.sin(o)*r])}for(let e=1;e<=30;e++){let t=e/30,n=.25+.6*(i?1-Math.abs(t-.5)*.4:t);p(d[e-1][0],d[e-1][1],d[e][0],d[e][1],n,1.15)}m(d[10][0],d[10][1],d[10][0]-d[9][0],d[10][1]-d[9][1],.85)}else for(let e=0;e<4;e++){let t=e*Math.PI/2,n=(e+1)*Math.PI/2;p(s+Math.cos(t)*u*1.5,c+Math.sin(t)*u*1.5,s+Math.cos(n)*u*1.5,c+Math.sin(n)*u*1.5,.7)}t.seg(s,l,c,s,1.25,c,f,f,.5,0,1.5,.6),i.pos.set([s,.03,c],a*3),i.col.set(f,a*3),i.size[a]=d?1.5:1.2,i.alpha[a]=1,i.sel[a]=+!d,a++}t.end(),i.touch(a)}attach(e,t){this.cam=t,this.el!==e&&(this.detach(),this.el=e,e.addEventListener(`pointermove`,this.onMove),e.addEventListener(`pointerleave`,this.onLeave),e.addEventListener(`pointerdown`,this.onDown),e.addEventListener(`pointerup`,this.onUp))}detach(){let e=this.el;e&&(e.removeEventListener(`pointermove`,this.onMove),e.removeEventListener(`pointerleave`,this.onLeave),e.removeEventListener(`pointerdown`,this.onDown),e.removeEventListener(`pointerup`,this.onUp),this.el=null)}floorAt(e){if(!this.el||!this.cam||!this.group.visible)return null;let t=this.el.getBoundingClientRect();if(!t.width||!t.height||(this.ray.setFromCamera(new Bi((e.clientX-t.left)/t.width*2-1,-((e.clientY-t.top)/t.height*2-1)),this.cam),this.group.updateMatrixWorld(),this.inv.copy(this.group.matrixWorld).invert(),this.local.copy(this.ray.ray).applyMatrix4(this.inv),!this.local.intersectPlane(this.plane,this.hit)))return null;let n=(this.hit.x+4)/this.sc,r=(this.hit.z+4)/this.sc;return n>=0&&r>=0&&n<=this.hi&&r<=this.hi?[n,r]:null}onMove=e=>{if(e.pointerType!==`mouse`||e.buttons){this.hover&&(this.hover=null,this.requestRender?.());return}let t=this.floorAt(e);(t?.[0]!==this.hover?.[0]||t?.[1]!==this.hover?.[1])&&(this.hover=t,this.requestRender?.())};onLeave=()=>{this.hover&&(this.hover=null,this.requestRender?.())};onDown=e=>{this.down=[e.clientX,e.clientY,performance.now()]};onUp=e=>{let t=this.down;if(this.down=null,!t||Math.hypot(e.clientX-t[0],e.clientY-t[1])>5||performance.now()-t[2]>500)return;let n=this.floorAt(e);n&&this.probe(n[0],n[1])};probe(e,t){if(!this.par)return;let n=Rp(this.par,e,t,40,.1);this.probes.push({pts:n,born:this.reduced?-1e5:Im()}),this.probes.length>8&&this.probes.shift(),this.flushProbes(),this.requestRender?.()}clearProbes(){this.probes=[],this.flushProbes(),this.requestRender?.()}get probeCount(){return this.probes.length}flushProbes(){let e=this.probeR,t=this.sc;e.begin();for(let n=0;n<this.probes.length;n++){let{pts:r,born:i}=this.probes[n],a=jm[(n*3+1)%jm.length],o=r.length,s=.9+o*.012;for(let n=1;n<o;n++){let c=(n-1)/(o-1),l=n/(o-1),u=Nm(a,Mm,.2*c),d=Nm(a,Mm,.2*l);e.seg(r[n-1][0]*t-4,.02,r[n-1][1]*t-4,r[n][0]*t-4,.02,r[n][1]*t-4,u,d,.85,.85,2,2,i+c*s,i+l*s)}}e.end()}ghost(){let e=this.ghostR,t=this.par,n=this.hover&&t?`${this.hover[0].toFixed(3)}|${this.hover[1].toFixed(3)}|${this.parKey}`:``;if(n!==this.ghostKey){if(this.ghostKey=n,e.begin(),n&&this.hover&&t){let n=Rp(t,this.hover[0],this.hover[1],30,.1),r=n.length,i=this.sc;for(let t=1;t<r;t++){let a=t/(r-1);e.seg(n[t-1][0]*i-4,.018,n[t-1][1]*i-4,n[t][0]*i-4,.018,n[t][1]*i-4,ap,op,.55*(1-a*.7),.55*(1-a*.7-.02),1.5,1.5)}}e.end()}}setPixelRatio(e){this.pixel=e;for(let t of[this.fps,this.head,this.beads,this.oheads])t.pts.material.uniforms.uPx.value=e;for(let t of[this.axes,this.streams,this.glyph,this.haloR,this.coreR,this.shadowR,this.dropR,this.ghostR,this.probeR])t.u(`uScale`,e)}labels(e){let t=[...this.statics],n=this.headW,r=(e,t,n)=>new X(e,t,n);if(n.ok){t.push({key:`rd-m`,text:n.xm.toFixed(2),pos:r(n.x,0,-4.4),cls:`p3-read is-man`}),t.push({key:`rd-f`,text:n.xf.toFixed(2),pos:r(-5,0,n.z),cls:`p3-read`}),t.push({key:`rd-p`,text:`Phi ${n.phi.toFixed(2)}`,pos:r(-4,n.y+.18,-4.6),cls:`p3-read is-vote`});for(let e of this.dayTags.slice(-5))t.push({key:`day`+e.day,text:`Day ${e.day}`,pos:e.pos,cls:`p3-day`})}return t.push(...this.nullTags),this.fixed.slice(0,3).forEach((e,n)=>t.push({key:`fx`+n,text:Gm(e.kind),pos:r(e.xm*this.sc-4-.8,.3,e.xf*this.sc-4+.8),cls:e.stable?`p3-fixed`:`p3-fixed is-tip`})),this.hover&&t.push({key:`hover`,text:`Start ${this.hover[0].toFixed(2)}, ${this.hover[1].toFixed(2)}`,pos:r(this.hover[0]*this.sc-4,.28,this.hover[1]*this.sc-4),cls:`p3-hover`}),t}summary(e){let t=this.headW,[n,r]=e.sel,i=e.run;if(!t.ok)return`${i.isl[n].name} and ${i.isl[r].name} are not both in the villa on this day. Simulation.`;let a=this.fixed.map(e=>`${e.kind} at ${e.xm.toFixed(2)}, ${e.xf.toFixed(2)}`).join(`; `);return`Phase space for ${i.isl[n].name} and ${i.isl[r].name}: his love ${t.xm.toFixed(2)}, her love ${t.xf.toFixed(2)}, public support ${t.phi.toFixed(2)}. ${a?`Resting states: `+a+`.`:`No resting state in view.`} Simulation.`}dispose(){this.detach(),this.mq?.removeEventListener?.(`change`,this.onMq);for(let e of[this.axes,this.streams,this.glyph,this.haloR,this.coreR,this.shadowR,this.dropR,this.ghostR,this.probeR])e.dispose();this.group.traverse(e=>{let t=e;t.geometry?.dispose();let n=t.material;Array.isArray(n)?n.forEach(e=>e.dispose()):n?.dispose()}),this.othersGeo.dispose(),this.curtainGeo.dispose()}},Jm=e=>e.steps,Ym={villa:{pos:[0,9.2,15.4],target:[0,.9,0],fov:38},phase:{pos:[9.6,6.6,10.6],target:[0,1.7,0],fov:36}},Xm=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},Zm=Math.PI*2,Qm=e=>e-Zm*Math.round(e/Zm),$m=.002;function eh(e,t){let n=e.fragmentShader;if(n.includes(`uFade`))return e.uniforms.uFade=t,!0;let r=n.lastIndexOf(`}`);if(r<0||!/gl_FragColor\s*=/.test(n))return!1;let i=n.slice(0,r)+`  gl_FragColor.a *= uFade;
`+n.slice(r);return i=/precision\s+\w+\s+float\s*;/.test(i)?i.replace(/(precision\s+\w+\s+float\s*;)/,`$1
uniform float uFade;`):`uniform float uFade;
`+i,e.fragmentShader=i,e.uniforms.uFade=t,e.needsUpdate=!0,!0}var th=class{canvas;tagHost;opts;renderer;scene=new Ja;camera=new Nc(38,1,.1,120);controls;villa=new Am;phase=new qm;view=`villa`;ro;io=null;mq=null;tags=new Map;avoid=[];tagSize=new WeakMap;hover=-1;last=null;drawn=null;idleAt=0;tween=null;down=null;uFade={villa:{value:1},phase:{value:0}};patched=new WeakSet;onScreen=!0;tabOn=typeof document>`u`||!document.hidden;cssW=0;cssH=0;cssDpr=0;nRenders=0;_v=new X;_s=new nl;dirty=!0;disposed=!1;lost=!1;constructor(e,t,n){this.canvas=e,this.tagHost=t,this.opts=n,Yi.enabled=!1,this.renderer=new wf({canvas:e,antialias:!0,alpha:!1,powerPreference:`high-performance`}),this.renderer.outputColorSpace=Jr,this.renderer.toneMapping=0,this.renderer.setClearColor(328966,1),this.scene.add(this.villa.group,this.phase.group),this.patchFades(),this.phase.group.visible=!1,this.camera.position.set(...Ym.villa.pos),this.camera.fov=Ym.villa.fov,this.controls=new Ff(this.camera,e),this.controls.target.set(...Ym.villa.target),this.controls.enableDamping=!n.reduced,this.controls.dampingFactor=.07,this.controls.enablePan=!1,this.controls.minDistance=6,this.controls.maxDistance=30,this.controls.maxPolarAngle=Math.PI*.49,this.controls.autoRotate=!n.reduced,this.controls.autoRotateSpeed=.5,this.controls.addEventListener(`start`,()=>{this.idleAt=performance.now()+7e3,this.dirty=!0}),this.controls.addEventListener(`change`,()=>{this.dirty=!0}),this.controls.update(),this.ro=new ResizeObserver(()=>{this.resize(),this.redraw()}),this.ro.observe(e),this.resize(),this.watchDpr(),typeof IntersectionObserver<`u`&&(this.io=new IntersectionObserver(e=>{let t=e[e.length-1].isIntersecting;t!==this.onScreen&&(this.onScreen=t,t&&this.wake())}),this.io.observe(e)),document.addEventListener(`visibilitychange`,this.onVis),e.addEventListener(`pointermove`,this.onMove),e.addEventListener(`pointerdown`,this.onDown),e.addEventListener(`pointerup`,this.onUp),e.addEventListener(`pointerleave`,this.onLeave),e.addEventListener(`webglcontextlost`,this.onLost),e.addEventListener(`webglcontextrestored`,this.onRestored)}get viewId(){return this.view}get active(){return this.onScreen&&this.tabOn&&!this.disposed&&!this.lost}get transitioning(){return this.tween!==null}get renders(){return this.nRenders}requestRender(){this.dirty=!0}setRun(e){this.villa.setRun(e),this.phase.setRun(e),this.patchFades(),this.dirty=!0}patchFades(){let e=(e,t)=>e.traverse(e=>{let n=e.material;n&&n.isShaderMaterial&&!this.patched.has(n)&&eh(n,t)&&this.patched.add(n)});e(this.villa.group,this.uFade.villa),e(this.phase.group,this.uFade.phase)}applyFade(){this.villa.group.visible=this.uFade.villa.value>$m,this.phase.group.visible=this.uFade.phase.value>$m}setView(e,t=!1){if(e===this.view)return;let n=this.view;this.view=e,this.tween?.cancel(),this.tween=null;let r=Ym[e],i=new X(...r.target),a=new X(...r.pos),o=new nl().setFromVector3(a.clone().sub(i));if(t||this.opts.reduced){this.uFade.villa.value=+(e===`villa`),this.uFade.phase.value=+(e===`phase`),this.applyFade(),this.controls.enabled=!0,this.camera.position.copy(a),this.controls.target.copy(i),this.camera.fov=r.fov,this.camera.updateProjectionMatrix(),this.controls.update(),this.dirty=!0;return}let s={villa:this.uFade.villa.value,phase:this.uFade.phase.value},c=this.controls.target.clone(),l=new nl().setFromVector3(this.camera.position.clone().sub(c)),u=this.camera.fov,d=Qm(o.theta-l.theta),f=e,p=n;this.controls.enabled=!1,this.controls.autoRotate=!1,this.applyFade(),this.villa.group.visible=this.phase.group.visible=!0;let m={p:0},h=()=>{let e=m.p;this.uFade[f].value=s[f]+(1-s[f])*Xm(.18,.85,e),this.uFade[p].value=s[p]*(1-Xm(.05,.72,e)),this.controls.target.lerpVectors(c,i,e);let t=this._s;t.radius=(l.radius+(o.radius-l.radius)*e)*(1+.1*Math.sin(Math.PI*e)),t.phi=l.phi+(o.phi-l.phi)*e,t.theta=l.theta+d*e,this.camera.position.copy(this._v.setFromSpherical(t).add(this.controls.target)),this.camera.fov=u+(r.fov-u)*e,this.camera.updateProjectionMatrix(),this.controls.update(),this.dirty=!0};this.tween=en(m,{p:1,duration:1250,ease:`inOut(3)`,onUpdate:h,onComplete:()=>{this.uFade[f].value=1,this.uFade[p].value=0,this.applyFade(),this.controls.enabled=!0,this.tween=null,this.idleAt=performance.now()+1500,this.dirty=!0}})}resize(){let e=Math.max(1,this.canvas.clientWidth),t=Math.max(1,this.canvas.clientHeight),n=Math.min(window.devicePixelRatio||1,e<520?1.25:1.5);if(e===this.cssW&&t===this.cssH&&n===this.cssDpr)return;this.cssW=e,this.cssH=t,this.cssDpr=n,this.renderer.setPixelRatio(n),this.renderer.setSize(e,t,!1),this.camera.aspect=e/t,this.camera.zoom=e/t<.9?Math.max(.62,e/t/.9):1,this.camera.updateProjectionMatrix();let r=t/760*n;this.villa.setPixelRatio(r),this.phase.setPixelRatio(r),this.dirty=!0}watchDpr(){this.mq?.removeEventListener(`change`,this.onDpr),this.mq=window.matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`),this.mq.addEventListener(`change`,this.onDpr)}onDpr=()=>{this.resize(),this.redraw(),this.watchDpr()};onVis=()=>{this.tabOn=!document.hidden,this.tabOn&&this.wake()};wake(){this.dirty=!0,this.opts.onWake?.()}redraw(){this.last&&this.active&&(this.renderer.render(this.scene,this.camera),this.nRenders++,this.placeTags(this.last))}frame(e,t){if(this.disposed||this.lost||(this.last=e,!this.active))return!1;let n=this.opts.reduced,r=n||document.documentElement.classList.contains(`paused`),i=performance.now()>this.idleAt;this.controls.autoRotate=!n&&i&&!this.tween&&!r;let a=this.controls.update()||this.controls.autoRotate,o=!n&&!r,s=t||a||this.tween!==null||o,c=this.drawn,l=!c||c.run!==e.run||c.k!==e.k||c.t!==e.t||c.s0!==e.sel[0]||c.s1!==e.sel[1];if(!this.dirty&&!l&&!s)return!1;this.dirty=!1;let u=e.dt>.1?{...e,dt:.1}:e;return this.uFade.villa.value>$m&&this.villa.update(u),this.uFade.phase.value>$m&&this.phase.update(u),this.renderer.render(this.scene,this.camera),this.nRenders++,this.placeTags(e),this.drawn={run:e.run,k:e.k,t:e.t,s0:e.sel[0],s1:e.sel[1]},s}placeTags(e){this.villa.avoid=this.avoid;let t=this.view===`villa`?this.villa.labels(e,this.hover):this.phase.labels(e),n=this.canvas.clientWidth,r=this.canvas.clientHeight,i=this._v,a=new Set,o=this.uFade[this.view].value,s=o<.98?Math.max(0,(o-.45)/.55):1,c=[];for(let e of t){a.add(e.key);let t=this.tags.get(e.key);t||(t=document.createElement(`span`),t.className=`tag`,t.style.position=`absolute`,t.style.left=`0`,t.style.top=`0`,t.style.pointerEvents=`none`,t.style.willChange=`transform`,this.tagHost.appendChild(t),this.tags.set(e.key,t)),t.textContent!==e.text&&(t.textContent=e.text);let o=`tag `+(e.cls??``);t.className!==o&&(t.className=o),i.copy(e.pos).project(this.camera);let l=(i.x*.5+.5)*n,u=(-i.y*.5+.5)*r,d=this.avoid.some(e=>l>e[0]&&l<e[2]&&u-10>e[1]&&u-10<e[3]);if(!d&&this.view===`phase`&&i.z<1&&Math.abs(i.x)<1.05&&Math.abs(i.y)<1.05&&!/^\d$/.test(e.text)){let n=t.className+`|`+e.text,r=this.tagSize.get(t);(!r||r.k!==n)&&(r={k:n,w:t.offsetWidth,h:t.offsetHeight},this.tagSize.set(t,r));let i=[l-r.w/2+2,u-r.h+1,l+r.w/2-2,u-1];d=c.some(e=>i[0]<e[2]&&i[2]>e[0]&&i[1]<e[3]&&i[3]>e[1]),d||c.push(i)}let f=i.z<1&&Math.abs(i.x)<1.05&&Math.abs(i.y)<1.05&&!d;t.style.opacity=!f||s<=0?`0`:s<1?s.toFixed(2):``,t.style.transform=`translate(${l.toFixed(1)}px, ${u.toFixed(1)}px) translate(-50%, -100%)`}for(let[e,t]of this.tags)a.has(e)||(t.remove(),this.tags.delete(e))}nearest(e){if(this.view!==`villa`||this.uFade.villa.value<.9)return null;let t=this.canvas.getBoundingClientRect(),n=e.clientX-t.left,r=e.clientY-t.top,i=new X,a=null;for(let e of this.villa.pickables()){if(i.copy(e.pos).project(this.camera),i.z>1)continue;let o=(i.x*.5+.5)*t.width,s=(-i.y*.5+.5)*t.height,c=Math.hypot(o-n,s-r);c<26&&(!a||c<a.d)&&(a={id:e.id,d:c})}return a}onMove=e=>{let t=e.pointerType===`mouse`?this.nearest(e):null,n=t?t.id:-1;n!==this.hover&&(this.hover=n,this.canvas.style.cursor=n>=0?`pointer`:``,this.dirty=!0),this.opts.onHover(n,e.clientX,e.clientY)};onLeave=()=>{this.hover!==-1&&(this.hover=-1,this.dirty=!0),this.opts.onHover(-1,0,0)};onDown=e=>{this.down=[e.clientX,e.clientY]};onUp=e=>{if(!this.down)return;let t=Math.hypot(e.clientX-this.down[0],e.clientY-this.down[1]);if(this.down=null,t>5)return;let n=this.nearest(e);n&&this.opts.onPick(n.id)};onLost=e=>{e.preventDefault(),this.lost=!0};onRestored=()=>{this.lost=!1,this.drawn=null,this.wake()};dispose(){this.disposed=!0,this.tween?.cancel(),this.tween=null,this.ro.disconnect(),this.io?.disconnect(),this.mq?.removeEventListener(`change`,this.onDpr),document.removeEventListener(`visibilitychange`,this.onVis),this.canvas.removeEventListener(`pointermove`,this.onMove),this.canvas.removeEventListener(`pointerdown`,this.onDown),this.canvas.removeEventListener(`pointerup`,this.onUp),this.canvas.removeEventListener(`pointerleave`,this.onLeave),this.canvas.removeEventListener(`webglcontextlost`,this.onLost),this.canvas.removeEventListener(`webglcontextrestored`,this.onRestored),this.controls.dispose(),this.villa.dispose(),this.phase.dispose();for(let e of this.tags.values())e.remove();this.tags.clear(),this.renderer.dispose(),this.renderer.forceContextLoss()}info(){return{geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,calls:this.renderer.info.render.calls,dpr:this.renderer.getPixelRatio(),view:this.view,fade:{villa:+this.uFade.villa.value.toFixed(3),phase:+this.uFade.phase.value.toFixed(3)},transitioning:this.tween!==null,active:this.active,renders:this.nRenders}}},nh=()=>typeof matchMedia==`function`&&matchMedia(`(pointer: coarse)`).matches?1.25:1.5;function rh(e,t){let n=()=>{let n=Math.max(1,e.clientWidth),r=Math.max(1,e.clientHeight),i=Math.min(window.devicePixelRatio||1,nh());(e.width!==Math.round(n*i)||e.height!==Math.round(r*i))&&(e.width=Math.round(n*i),e.height=Math.round(r*i)),t(n,r,i)},r=new ResizeObserver(n);return r.observe(e),n(),{refit:n,dispose:()=>r.disconnect()}}var ih=(e,t,n)=>e<t?t:e>n?n:e,ah=()=>typeof matchMedia==`function`&&matchMedia(`(prefers-reduced-motion: reduce)`).matches,oh=(e,t=500)=>`${t} ${e}px "IBM Plex Mono", ui-monospace, Menlo, monospace`,sh=e=>`italic 400 ${e}px "Instrument Serif", "Times New Roman", serif`;function ch(e,t,n,r,i,a){e.beginPath(),typeof e.roundRect==`function`?e.roundRect(t,n,r,i,a):(e.moveTo(t+a,n),e.arcTo(t+r,n,t+r,n+i,a),e.arcTo(t+r,n+i,t,n+i,a),e.arcTo(t,n+i,t,n,a),e.arcTo(t,n,t+r,n,a),e.closePath())}function lh(e,t,n,r,i,a){let o=Math.atan2(i-n,r-t);e.beginPath(),e.moveTo(r,i),e.lineTo(r-a*Math.cos(o-.45),i-a*Math.sin(o-.45)),e.moveTo(r,i),e.lineTo(r-a*Math.cos(o+.45),i-a*Math.sin(o+.45)),e.stroke()}function uh(e,t){let n=0,r=!0,i=!1,a=e=>{n=0,!i&&t(e)&&r&&!document.hidden&&(n=requestAnimationFrame(a))},o=()=>{!n&&!i&&r&&!document.hidden&&(n=requestAnimationFrame(a))},s=typeof IntersectionObserver==`function`?new IntersectionObserver(e=>{r=e[e.length-1].isIntersecting,r&&o()}):null;s?.observe(e);let c=()=>{document.hidden||o()};return document.addEventListener(`visibilitychange`,c),{wake:o,dispose(){i=!0,n&&cancelAnimationFrame(n),s?.disconnect(),document.removeEventListener(`visibilitychange`,c)}}}var dh=`#FF6A8A`,fh=`#EDE6D6`,ph=`#D9A441`,mh=`#8FB8FF`,hh=`#B48CFF`,gh=()=>1,_h=Math.PI*2,vh=320,yh=1.7,bh=1700,xh={"stable node":[`Settles down`,`stable node`],"stable spiral":[`Settles, with swings`,`stable spiral`],saddle:[`Tipping point`,`saddle`],"unstable node":[`Pushes away`,`unstable node`],"unstable spiral":[`Spirals away`,`unstable spiral`],degenerate:[`Edge case`,`degenerate`]};function Sh(e,t){if(t.disc<0||t.kind===`degenerate`)return[];let n=Math.sqrt(t.disc),r=[];for(let i of[-1,1]){let a=(t.tr+i*n)/2,o=[e[0][1],a-e[0][0]];Math.hypot(o[0],o[1])<1e-9&&(o=[a-e[1][1],e[1][0]]),Math.hypot(o[0],o[1])<1e-9&&(o=i<0?[1,0]:[0,1]);let s=Math.hypot(o[0],o[1]);r.push({dx:o[0]/s,dy:o[1]/s,lam:a})}return r}function Ch(e,t){let n=.015;return e>n&&t>n?`both loves grow`:e<-.015&&t<-.015?`both loves fade`:`${e>n?`his love grows`:e<-.015?`his love fades`:`his love holds`}, ${t>n?`hers grows`:t<-.015?`hers fades`:`hers holds`}`}function wh(e,t,n,r,i){e.lineJoin=`round`,e.lineWidth=3.5,e.strokeStyle=`rgba(5,5,6,0.88)`,e.strokeText(t,n,r),e.fillStyle=i,e.fillText(t,n,r)}var Th=class{cv;opts;ctx;tcv=document.createElement(`canvas`);tc;W=0;H=0;dpr=1;data=null;ghosts=[];ghostCls=[];ghostKey=``;fixed=[];parKey=``;forecast=[];fcKey=``;probes=[];ripples=[];pointer=null;keyPos=[1,1];fit;loop=null;lo=0;hi=3;np=0;px=new Float32Array(vh);py=new Float32Array(vh);age=new Float32Array(vh);life=new Float32Array(vh);cls=new Uint8Array(vh);reclassIdx=0;reclassLeft=0;fadeAcc=0;lastAdv=0;lastHi=0;lastRender=0;dirty=!0;born=performance.now();ownLabel;touchTimer=0;coarse=typeof matchMedia==`function`&&matchMedia(`(pointer: coarse)`).matches;constructor(e,t){this.cv=e,this.opts=t,this.ctx=e.getContext(`2d`),this.tc=this.tcv.getContext(`2d`),e.hasAttribute(`tabindex`)||(e.tabIndex=0),e.hasAttribute(`role`)||e.setAttribute(`role`,`application`),this.ownLabel=!e.hasAttribute(`aria-label`),this.ownLabel&&e.setAttribute(`aria-label`,`Phase portrait of the selected couple. Arrow keys move a cross, Enter drops a path, Backspace clears the paths.`),this.fit=rh(e,(t,n,r)=>{this.W=t,this.H=n,this.dpr=r,(this.tcv.width!==e.width||this.tcv.height!==e.height)&&(this.tcv.width=e.width,this.tcv.height=e.height);let i=Math.round(ih(t*n/1500,80,vh));i!==this.np&&(this.np=i,this.data&&this.seedAll()),this.dirty=!0,this.render(),this.loop?.wake()}),this.loop=uh(e,()=>{let e=performance.now(),t=!this.reduced(),n=this.busy(e);return t&&this.advance(e),(t||n||this.dirty)&&(this.dirty||e-this.lastRender>5)&&this.render(),t||n}),e.addEventListener(`pointerdown`,this.down),e.addEventListener(`pointermove`,this.move),e.addEventListener(`pointerleave`,this.leave),e.addEventListener(`pointerup`,this.up),e.addEventListener(`pointercancel`,this.up),e.addEventListener(`keydown`,this.key),document.fonts?.ready.then(()=>{this.dirty=!0,this.loop?.wake()}),this.loop.wake()}sx=e=>(e-this.lo)/(this.hi-this.lo)*this.W;sy=e=>this.H-(e-this.lo)/(this.hi-this.lo)*this.H;ux=e=>this.lo+e/this.W*(this.hi-this.lo);uy=e=>this.lo+(this.H-e)/this.H*(this.hi-this.lo);at(e){let t=this.cv.getBoundingClientRect();return[this.ux((e.clientX-t.left)*(this.W/t.width)),this.uy((e.clientY-t.top)*(this.H/t.height))]}reduced(){return this.opts.reduced||ah()}busy(e){return!this.reduced()&&this.probes.some(t=>e-t.born<1760)||this.ripples.some(t=>e-t.born<800)}kick(){this.dirty=!0,this.loop?.wake()}down=e=>{let[t,n]=this.at(e);this.pointer=[t,n],this.opts.onProbe(t,n),this.cv.focus({preventScroll:!0}),e.preventDefault(),this.kick()};move=e=>{this.pointer=this.at(e),window.clearTimeout(this.touchTimer),this.kick()};leave=()=>{this.pointer=null,this.kick()};up=e=>{e.pointerType!==`mouse`&&(window.clearTimeout(this.touchTimer),this.touchTimer=window.setTimeout(()=>{this.pointer=null,this.kick()},900))};key=e=>{let t=(e.shiftKey?.4:.12)*(this.hi/3),n={ArrowLeft:[-t,0],ArrowRight:[t,0],ArrowUp:[0,t],ArrowDown:[0,-t]};if(e.key===`Enter`||e.key===` `){e.preventDefault(),this.opts.onProbe(this.keyPos[0],this.keyPos[1]),this.kick();return}if(e.key===`Backspace`||e.key===`Delete`||e.key===`Escape`){e.preventDefault(),this.clear();return}let r=n[e.key];r&&(e.preventDefault(),this.keyPos=[ih(this.keyPos[0]+r[0],this.lo,this.hi),ih(this.keyPos[1]+r[1],this.lo,this.hi)],this.pointer=[...this.keyPos],this.kick())};set(e,t){this.data=e,this.hi=t,this.lo=-.1*t;let n=JSON.stringify(e.par);if(n!==this.parKey){let t=this.parKey===``;this.parKey=n,this.ghostKey=``,this.fcKey=``,this.fixed=Ip(e.par).map(t=>({...t,axes:Sh(Pp(e.par,t.xm,t.xf),t)})),t?this.seedAll():(this.reclassIdx=0,this.reclassLeft=this.np),this.describe()}let r=n+`|`+Math.round(t*4)/4;if(r!==this.ghostKey){this.ghostKey=r,this.ghosts=[];let n=t,i=[];for(let e of[.05,.3,.6,.95])for(let t of[.05,.95])i.push([e*n,t*n]);for(let e of[.3,.6])i.push([.05*n,e*n],[.95*n,e*n]);for(let[t,n]of i)this.ghosts.push(Rp(e.par,t,n,30,.1));let a=.2*(this.hi-this.lo);this.ghostCls=this.ghosts.map(e=>{let t=e[e.length-1];return e.length<300?1:this.fixed.some(e=>e.stable&&Math.hypot(e.xm-t[0],e.xf-t[1])<a)?0:2})}if(e.head){let t=n+`|`+e.head[0].toFixed(2)+`,`+e.head[1].toFixed(2);t!==this.fcKey&&(this.fcKey=t,this.forecast=Rp(e.par,e.head[0],e.head[1],40,.1))}else this.forecast=[],this.fcKey=``;this.kick()}dropProbe(e,t,n){let r=Rp(n,e,t,40,.1),i=performance.now();this.probes.push({pts:r,born:i,end:r.length<401?`runs away`:`settles`}),this.probes.length>10&&this.probes.shift(),this.ripples.push({x:e,y:t,born:i}),this.ripples.length>8&&this.ripples.shift(),this.kick()}clear(){this.probes=[],this.ripples=[],this.kick(),this.render()}get animating(){return!this.reduced()||this.busy(performance.now())}describe(){if(!this.ownLabel)return;let e=this.fixed.length?this.fixed.map(e=>`${xh[e.kind][0].toLowerCase()} (${e.kind}) at his love ${e.xm.toFixed(2)}, her love ${e.xf.toFixed(2)}`).join(`; `):`none`;this.cv.setAttribute(`aria-label`,`Phase portrait of the selected couple, his love across and her love up. Resting states: ${e}. Arrow keys move a cross, Enter drops a path, Backspace clears the paths.`)}classify(e,t){let n=this.data.par,r=e,i=t;for(let e=0;e<90;e++){let e=jp(n,gh,0,r,i,.25);if(r=e[0],i=e[1],!(Math.abs(r)<6&&Math.abs(i)<6))return 1}let a=.2*(this.hi-this.lo);for(let e of this.fixed)if(e.stable&&Math.hypot(e.xm-r,e.xf-i)<a)return 0;return Math.hypot(r,i)>this.hi*1.4?1:2}spawn(e,t){let n=this.hi-this.lo;this.px[e]=this.lo+Math.random()*n,this.py[e]=this.lo+Math.random()*n,this.life[e]=2.6+Math.random()*3,this.age[e]=t?Math.random()*this.life[e]:0,this.cls[e]=this.data?this.classify(this.px[e],this.py[e]):2}seedAll(){for(let e=0;e<this.np;e++)this.spawn(e,!0);this.tc.clearRect(0,0,this.tcv.width,this.tcv.height)}advance(e){let t=this.data;if(!t||!this.W||!this.np){this.lastAdv=e;return}let n=Math.min(.05,(e-this.lastAdv)/1e3);if(n<.004)return;this.lastAdv=e;let{tc:r,dpr:i,W:a,H:o}=this,s=t.par,c=this.hi-this.lo,l=yh*n,u=.035*c;r.setTransform(i,0,0,i,0,0);let d=Math.abs(this.hi-this.lastHi)>.003;this.lastHi=this.hi,this.fadeAcc+=n/.9,d&&(this.fadeAcc=Math.max(this.fadeAcc,.4)),this.fadeAcc>=.06&&(r.globalCompositeOperation=`destination-out`,r.fillStyle=`rgba(0,0,0,${Math.min(.6,this.fadeAcc).toFixed(3)})`,r.fillRect(0,0,a,o),r.globalCompositeOperation=`source-over`,this.fadeAcc=0);for(let e=0;e<24&&this.reclassLeft>0;e++,this.reclassLeft--){let e=this.reclassIdx++%this.np;this.cls[e]=this.classify(this.px[e],this.py[e])}let f=[new Path2D,new Path2D,new Path2D],p=this.lo-.04*c,m=this.hi+.04*c;for(let e=0;e<this.np;e++){this.age[e]+=n;let t=this.px[e],r=this.py[e];if(this.age[e]>this.life[e]||t<p||t>m||r<p||r>m){this.spawn(e,!1);continue}let i=-s.am*t+s.bm*r+s.gm*s.Af+s.dm*t*r,a=-s.af*r+s.bf*t+s.gf*s.Am+s.df*t*r,o=i*l,c=a*l,d=Math.hypot(o,c);d>u&&(o*=u/d,c*=u/d);let h=t+o,g=r+c,_=f[this.cls[e]];_.moveTo(this.sx(t),this.sy(r)),_.lineTo(this.sx(h),this.sy(g)),this.px[e]=h,this.py[e]=g}r.lineCap=`round`,r.lineWidth=1.3,r.strokeStyle=`rgba(143,184,255,0.62)`,r.stroke(f[0]),r.strokeStyle=`rgba(255,106,138,0.66)`,r.stroke(f[1]),r.strokeStyle=`rgba(237,230,214,0.5)`,r.stroke(f[2])}draw(){this.render()}render(){let e=performance.now();this.lastRender=e,this.dirty=!1;let{ctx:t,W:n,H:r,data:i}=this;if(!n||!i)return;let a=this.dpr,o=this.reduced();t.setTransform(a,0,0,a,0,0),t.clearRect(0,0,n,r),t.textBaseline=`alphabetic`,this.drawGrid(t),this.drawGhosts(t,o),o||(t.save(),t.setTransform(1,0,0,1,0,0),t.globalCompositeOperation=`lighter`,t.globalAlpha=.78,t.drawImage(this.tcv,0,0),t.restore()),this.drawLegend(t,o),this.drawNullclines(t,i),this.drawFixed(t,e,o),this.drawProbes(t,e,o),this.drawLive(t,i,e,o),this.drawCursor(t,i),this.drawHint(t,e)}drawGrid(e){let{hi:t,lo:n,W:r,H:i}=this;e.lineWidth=1,e.font=oh(10),e.fillStyle=`rgba(237,230,214,0.46)`,e.setLineDash([]);let a=t>4.6?1:.5;for(let n=0;n<=t+1e-6;n+=a){let t=Math.abs(n-Math.round(n))<1e-6;e.strokeStyle=t?`rgba(237,230,214,0.12)`:`rgba(237,230,214,0.05)`,e.beginPath(),e.moveTo(this.sx(n),0),e.lineTo(this.sx(n),i),e.moveTo(0,this.sy(n)),e.lineTo(r,this.sy(n)),e.stroke(),t&&n>0&&(e.textAlign=`center`,e.fillText(String(n),this.sx(n),i-5),e.textAlign=`left`,e.fillText(String(n),5,this.sy(n)-4))}e.strokeStyle=`rgba(237,230,214,0.34)`,e.beginPath(),e.moveTo(this.sx(0),0),e.lineTo(this.sx(0),i),e.moveTo(0,this.sy(0)),e.lineTo(r,this.sy(0)),e.stroke();let o=this.sx(0),s=this.sy(0);e.font=oh(10.5,600),e.letterSpacing=`1.4px`,e.textAlign=`right`,wh(e,`HIS LOVE`,r-36,s-9,`rgba(237,230,214,0.86)`),e.textAlign=`left`,wh(e,`HER LOVE`,o+24,18,`rgba(237,230,214,0.86)`),e.letterSpacing=`0px`,e.strokeStyle=`rgba(237,230,214,0.7)`,e.lineWidth=1.4,e.beginPath(),e.moveTo(r-30,s-12),e.lineTo(r-12,s-12),e.stroke(),lh(e,r-30,s-12,r-12,s-12,5),e.beginPath(),e.moveTo(o+12,28),e.lineTo(o+12,11),e.stroke(),lh(e,o+12,28,o+12,11,5),r>340&&(e.font=sh(15),e.fillStyle=`rgba(237,230,214,0.22)`,e.textAlign=`right`,e.fillText(`both in love`,r-14,26),e.fillText(`he is keener`,r-14,s-34),e.textAlign=`left`,e.fillText(`she is keener`,o+14,58),e.fillText(`both cold`,o+14,s-34))}drawGhosts(e,t){e.lineWidth=t?1.3:1,e.lineCap=`round`;let n=t?[`rgba(143,184,255,0.5)`,`rgba(255,106,138,0.55)`,`rgba(237,230,214,0.4)`]:[`rgba(237,230,214,0.055)`,`rgba(237,230,214,0.055)`,`rgba(237,230,214,0.055)`];this.ghosts.forEach((r,i)=>{if(!(r.length<2)&&(e.strokeStyle=n[this.ghostCls[i]??2],e.beginPath(),r.forEach(([t,n],r)=>r?e.lineTo(this.sx(t),this.sy(n)):e.moveTo(this.sx(t),this.sy(n))),e.stroke(),t&&r.length>12)){let t=Math.floor(r.length*.4),n=t+2;lh(e,this.sx(r[t][0]),this.sy(r[t][1]),this.sx(r[n][0]),this.sy(r[n][1]),5)}})}drawLegend(e,t){if(this.W<300)return;let n=[0,0,0];if(t)for(let e of this.ghostCls)n[e]++;else for(let e=0;e<this.np;e++)n[this.cls[e]]++;let r=n[0]+n[1]+n[2]||1,i=[];n[0]/r>.06&&i.push([`paths that settle`,mh,`rgba(143,184,255,0.95)`]),n[1]/r>.06&&i.push([`paths that run away`,dh,`rgba(255,128,154,0.95)`]),n[2]/r>.06&&i.push([`still drifting`,fh,`rgba(237,230,214,0.85)`]),e.font=sh(13.5),e.textAlign=`right`;let a=this.W>340?46:40;for(let[t,n,r]of i){let i=this.W-12;wh(e,t,i,a+4,r);let o=e.measureText(t).width;e.strokeStyle=n,e.lineWidth=2,e.lineCap=`round`,e.beginPath(),e.moveTo(i-o-20,a),e.lineTo(i-o-6,a),e.stroke(),a+=17}e.textAlign=`left`}drawNullclines(e,t){let{hi:n,lo:r,W:i,H:a}=this,o=t.par,s=o.gm*o.Af,c=o.gf*o.Am,l=e=>{let t=o.bm+o.dm*e;return Math.abs(t)>1e-6?(o.am*e-s)/t:NaN},u=e=>{let t=o.bf+o.df*e;return Math.abs(t)>1e-6?(o.af*e-c)/t:NaN},d=e=>Number.isFinite(e)&&e>r-.5&&e<n*1.2;e.setLineDash([5,4]),e.lineWidth=1.5,e.strokeStyle=`rgba(255,106,138,0.78)`,e.beginPath();let f=!1;for(let t=0;t<=120;t++){let i=r+t/120*(n-r),a=l(i);d(a)?f?e.lineTo(this.sx(i),this.sy(a)):(e.moveTo(this.sx(i),this.sy(a)),f=!0):f=!1}e.stroke(),e.strokeStyle=`rgba(237,230,214,0.66)`,e.beginPath(),f=!1;for(let t=0;t<=120;t++){let i=r+t/120*(n-r),a=u(i);d(a)?f?e.lineTo(this.sx(a),this.sy(i)):(e.moveTo(this.sx(a),this.sy(i)),f=!0):f=!1}if(e.stroke(),e.setLineDash([]),i<300)return;e.font=sh(13.5);let p=(t,n,r)=>{for(let[o,s]of r)if(o>12&&o<i-150&&s>40&&s<a-26){e.textAlign=`left`,wh(e,t,o+8,s-8,n);return}};p(`his love holds steady`,`rgba(255,128,154,0.95)`,[.74,.58,.9,.42].map(e=>{let t=r+e*(n-r),i=l(t);return d(i)?[this.sx(t),this.sy(i)]:[-99,-99]})),p(`her love holds steady`,`rgba(237,230,214,0.9)`,[.74,.58,.9,.42].map(e=>{let t=r+e*(n-r),i=u(t);return d(i)?[this.sx(i),this.sy(t)]:[-99,-99]}))}drawFixed(e,t,n){let{W:r,H:i}=this,a=this.hi-this.lo,o=[];for(let s of this.fixed){let c=this.sx(s.xm),l=this.sy(s.xf);if(c<-8||c>r+8||l<-8||l>i+8)continue;let u=s.kind===`saddle`?ph:fh;for(let t of s.axes){let n=t.dx*r/a,o=-t.dy*i/a,u=Math.hypot(n,o)||1,d=n/u,f=o/u;e.strokeStyle=s.kind===`saddle`?`rgba(217,164,65,0.6)`:`rgba(237,230,214,0.3)`,e.lineWidth=1.2,e.beginPath(),e.moveTo(c-d*54,l-f*54),e.lineTo(c+d*54,l+f*54),e.stroke();for(let n of[-1,1]){let r=c+n*d*54,i=l+n*f*54,a=c+n*d*54*.45,o=l+n*f*54*.45;t.lam<0?lh(e,r,i,a,o,6):lh(e,a,o,r,i,6)}}if(s.kind!==`saddle`&&s.kind!==`degenerate`){if(e.strokeStyle=u,e.lineWidth=1.3,n)e.globalAlpha=.28,e.beginPath(),e.arc(c,l,15,0,_h),e.stroke();else for(let n=0;n<2;n++){let r=(t/1700+n*.5)%1,i=s.stable?24-18*r:7+17*r;e.globalAlpha=.45*Math.sin(Math.PI*r),e.beginPath(),e.arc(c,l,i,0,_h),e.stroke()}e.globalAlpha=1}e.lineWidth=2,e.strokeStyle=u,e.fillStyle=u,s.kind===`saddle`?(e.beginPath(),e.moveTo(c,l-7),e.lineTo(c+7,l),e.lineTo(c,l+7),e.lineTo(c-7,l),e.closePath(),e.fillStyle=`rgba(5,5,6,0.7)`,e.fill(),e.stroke()):s.stable?(e.beginPath(),e.arc(c,l,5.5,0,_h),e.fill(),e.strokeStyle=`#050506`,e.lineWidth=1.5,e.stroke()):(e.beginPath(),e.arc(c,l,6,0,_h),e.fillStyle=`rgba(5,5,6,0.7)`,e.fill(),e.stroke());let[d,f]=xh[s.kind],p=`${f.toUpperCase()}  his ${s.xm.toFixed(2)}  her ${s.xf.toFixed(2)}`;e.font=sh(15);let m=e.measureText(d).width;e.font=oh(9,500),e.letterSpacing=`0.6px`;let h=e.measureText(p).width;e.letterSpacing=`0px`;let g=Math.max(m,h),_=c+14,v=l-24;_+g>r-6&&(_=c-14-g),_<6&&(_=6),v<6&&(v=l+12);for(let e=0;e<5&&o.some(e=>_<e.x+e.w+4&&_+g+4>e.x&&v<e.y+e.h+2&&v+31+2>e.y);e++)v+=35;v=Math.min(v,i-31-16),o.push({x:_,y:v,w:g,h:31}),e.textAlign=`left`,e.font=sh(15),wh(e,d,_,v+13,u===ph?`rgba(236,190,95,0.98)`:`rgba(237,230,214,0.96)`),e.font=oh(9,500),e.letterSpacing=`0.6px`,wh(e,p,_,v+27,`rgba(237,230,214,0.6)`),e.letterSpacing=`0px`}}drawProbes(e,t,n){let{probes:r}=this;if(e.lineCap=`round`,e.lineJoin=`round`,e.textAlign=`left`,r.forEach((i,a)=>{let o=n?1:ih((t-i.born)/bh,0,1),s=n?1:1-(1-o)**2.4,c=i.pts.length-1,l=Math.max(1,Math.round(s*c)),u=1-Math.min(.5,(r.length-1-a)*.06),d=o<1?10:5,f=Math.max(1,Math.ceil(l/d));for(let t=0;t<d;t++){let n=t*f;if(n>=l)break;let r=Math.min(l,n+f),a=(t+1)/d;e.beginPath();for(let t=n;t<=r&&t<=c;t++){let[r,a]=i.pts[t];t===n?e.moveTo(this.sx(r),this.sy(a)):e.lineTo(this.sx(r),this.sy(a))}e.strokeStyle=`rgba(5,5,6,${(.6*u).toFixed(3)})`,e.lineWidth=4.2+1.2*a,e.stroke(),e.strokeStyle=`rgba(255,246,222,${(u*(.46+.54*a)).toFixed(3)})`,e.lineWidth=1.8+1.2*a,e.stroke()}e.fillStyle=`rgba(237,230,214,${(.55*u).toFixed(3)})`;for(let t=50;t<l;t+=50){let[n,r]=i.pts[t];e.beginPath(),e.arc(this.sx(n),this.sy(r),1.8,0,_h),e.fill()}let[p,m]=i.pts[0],[h,g]=i.pts[l];e.strokeStyle=`rgba(237,230,214,${(.8*u).toFixed(3)})`,e.lineWidth=1.4,e.beginPath(),e.arc(this.sx(p),this.sy(m),4,0,_h),e.stroke();let _=this.sx(h),v=this.sy(g);if(o<1){let t=e.createRadialGradient(_,v,0,_,v,16);t.addColorStop(0,`rgba(237,230,214,0.5)`),t.addColorStop(1,`rgba(237,230,214,0)`),e.fillStyle=t,e.beginPath(),e.arc(_,v,16,0,_h),e.fill()}if(e.fillStyle=`#FFF6DE`,e.beginPath(),e.arc(_,v,4,0,_h),e.fill(),o>=1){e.font=oh(10,600),wh(e,String(a+1),this.sx(p)+8,this.sy(m)-6,`rgba(237,230,214,0.9)`);let t=this.fixed.some(e=>Math.hypot(this.sx(e.xm)-_,this.sy(e.xf)-v)<70);e.font=sh(13.5),e.textAlign=_>this.W-120?`right`:`left`,i.end&&!t?wh(e,`${a+1}  ${i.end}`,_+(_>this.W-120?-8:8),v-8,`rgba(237,230,214,${(.9*u).toFixed(3)})`):(e.font=oh(10,600),wh(e,String(a+1),_+7,v+14,`rgba(255,246,222,0.9)`)),e.textAlign=`left`}}),!n)for(let n of this.ripples){let r=(t-n.born)/800;if(r>=1)continue;let i=this.sx(n.x),a=this.sy(n.y);for(let t=0;t<2;t++){let n=ih(r-t*.18,0,1);n<=0||(e.strokeStyle=`rgba(237,230,214,${(.5*(1-n)).toFixed(3)})`,e.lineWidth=1.4,e.beginPath(),e.arc(i,a,4+30*(1-(1-n)**2),0,_h),e.stroke())}}}drawLive(e,t,n,r){t.head&&this.forecast.length>2&&(e.setLineDash([1,6]),e.lineCap=`round`,e.lineWidth=2,e.strokeStyle=`rgba(255,106,138,0.55)`,e.beginPath(),this.forecast.forEach(([t,n],r)=>r?e.lineTo(this.sx(t),this.sy(n)):e.moveTo(this.sx(t),this.sy(n))),e.stroke(),e.setLineDash([]));let i=t.trail,a=i.length;if(a>1){let t=Math.min(16,a-1),n=(a-1)/t;e.lineJoin=`round`,e.lineCap=`round`,e.strokeStyle=dh;for(let r=0;r<t;r++){let o=Math.floor(r*n),s=Math.min(a-1,Math.ceil((r+1)*n)),c=(r+1)/t;e.globalAlpha=.14+.86*c*c,e.lineWidth=1.4+2.4*c,r>=t-3?(e.shadowColor=dh,e.shadowBlur=9):e.shadowBlur=0,e.beginPath();for(let t=o;t<=s;t++)t===o?e.moveTo(this.sx(i[t][0]),this.sy(i[t][1])):e.lineTo(this.sx(i[t][0]),this.sy(i[t][1]));e.stroke()}e.globalAlpha=1,e.shadowBlur=0}if(!t.head)return;let o=this.sx(t.head[0]),s=this.sy(t.head[1]),c=t.coupled?dh:hh;if(t.obs){let n=this.sx(t.obs[0]),r=this.sy(t.obs[1]);e.strokeStyle=`rgba(255,106,138,0.5)`,e.lineWidth=1,e.beginPath(),e.moveTo(o,s),e.lineTo(n,r),e.stroke(),e.beginPath(),e.arc(n,r,4,0,_h),e.stroke()}let l=15+7*(r?.5:.5+.5*Math.sin(n/420)),u=e.createRadialGradient(o,s,0,o,s,l);u.addColorStop(0,t.coupled?`rgba(255,106,138,0.5)`:`rgba(180,140,255,0.5)`),u.addColorStop(1,`rgba(255,106,138,0)`),e.fillStyle=u,e.beginPath(),e.arc(o,s,l,0,_h),e.fill(),e.fillStyle=c,e.beginPath(),e.arc(o,s,6.5,0,_h),e.fill(),e.lineWidth=2,e.strokeStyle=`#050506`,e.stroke();let d=[t.label,t.away?`running away`:``].filter(Boolean).join(`, `);if(d){e.font=sh(15);let t=e.measureText(d).width,n=o+14+t>this.W-6;e.textAlign=n?`right`:`left`,wh(e,d,n?o-14:o+14,s+26,`rgba(255,170,188,0.95)`),e.textAlign=`left`}}drawCursor(e,t){if(!this.pointer)return;let{W:n,H:r}=this,[i,a]=this.pointer,o=this.sx(i),s=this.sy(a),c=t.par,l=-c.am*i+c.bm*a+c.gm*c.Af+c.dm*i*a,u=-c.af*a+c.bf*i+c.gf*c.Am+c.df*i*a,d=Math.hypot(l,u)||1,f=l/d*n/(this.hi-this.lo),p=u/d*r/(this.hi-this.lo),m=Math.hypot(f,p)||1;e.strokeStyle=`rgba(237,230,214,0.3)`,e.lineWidth=1,e.beginPath(),e.moveTo(o,0),e.lineTo(o,r),e.moveTo(0,s),e.lineTo(n,s),e.stroke(),e.strokeStyle=fh,e.lineWidth=2,e.lineCap=`round`,e.beginPath(),e.moveTo(o,s),e.lineTo(o+f/m*28,s-p/m*28),e.stroke(),lh(e,o,s,o+f/m*28,s-p/m*28,6),e.beginPath(),e.arc(o,s,3,0,_h),e.fillStyle=fh,e.fill();let h=`his love ${i.toFixed(2)}   her love ${a.toFixed(2)}`,g=Ch(l,u);e.font=oh(10.5);let _=e.measureText(h).width;e.font=sh(14);let v=e.measureText(g).width,y=Math.max(_,v)+16,b=ih(o+12,4,n-y-4),x=ih(s+12,4,r-44);e.fillStyle=`rgba(5,5,6,0.84)`,e.strokeStyle=`rgba(237,230,214,0.2)`,e.lineWidth=1,e.beginPath(),typeof e.roundRect==`function`?e.roundRect(b,x,y,38,5):e.rect(b,x,y,38),e.fill(),e.stroke(),e.textAlign=`left`,e.fillStyle=fh,e.font=oh(10.5),e.fillText(h,b+8,x+15),e.fillStyle=`rgba(237,230,214,0.72)`,e.font=sh(14),e.fillText(g,b+8,x+31)}drawHint(e,t){if(this.probes.length||this.pointer||this.W<260)return;let n=ih((t-this.born-700)/600,0,1);n<=0||(e.font=sh(15),e.textAlign=`center`,e.globalAlpha=.72*n,wh(e,`${this.coarse?`Tap`:`Click`} anywhere to drop a path`,this.W/2,this.H-24,fh),e.globalAlpha=1,e.textAlign=`left`)}dispose(){this.loop?.dispose(),this.fit.dispose(),window.clearTimeout(this.touchTimer);let e=this.cv;e.removeEventListener(`pointerdown`,this.down),e.removeEventListener(`pointermove`,this.move),e.removeEventListener(`pointerleave`,this.leave),e.removeEventListener(`pointerup`,this.up),e.removeEventListener(`pointercancel`,this.up),e.removeEventListener(`keydown`,this.key),this.tcv.width=this.tcv.height=0}},Eh=`#FF6A8A`,Dh=`#EDE6D6`,Oh=`#8FB8FF`,kh=`#D9A441`,Ah=30,jh=10,Mh=22,Nh=900,Ph={couple:`Couple up`,split:`Split`,vote:`Dumped by the public vote`};function Fh(e,t,n,r,i){e.lineJoin=`round`,e.lineWidth=3.2,e.strokeStyle=`rgba(5,5,6,0.85)`,e.strokeText(t,n,r),e.fillStyle=i,e.fillText(t,n,r)}var Ih=class{cv;onSeek;ctx;W=0;H=0;dpr=1;fit;loop=null;run=null;p=-1;t=1;m=0;f=0;mx=2;shocks=[];pairEv=[];hover=null;dragging=!1;revealU=1;revealT0=0;touchTimer=0;constructor(e,t){this.cv=e,this.onSeek=t,this.ctx=e.getContext(`2d`),e.hasAttribute(`tabindex`)||(e.tabIndex=0),e.hasAttribute(`role`)||e.setAttribute(`role`,`slider`),e.hasAttribute(`aria-label`)||e.setAttribute(`aria-label`,`Season timeline for the selected couple. Drag, or use the arrow keys, to change the day.`),e.setAttribute(`aria-valuemin`,`1`),e.setAttribute(`aria-valuemax`,`53`),this.fit=rh(e,(e,t,n)=>{this.W=e,this.H=t,this.dpr=n,this.draw()}),this.loop=uh(e,()=>(this.revealU<1&&this.draw(),this.revealU<1)),e.addEventListener(`pointerdown`,this.down),e.addEventListener(`pointermove`,this.move),e.addEventListener(`pointerleave`,this.leave),e.addEventListener(`pointerup`,this.up),e.addEventListener(`pointercancel`,this.up),e.addEventListener(`keydown`,this.key),document.fonts?.ready.then(()=>this.draw())}timeAt(e){let t=this.cv.getBoundingClientRect();return ih(1+((e.clientX-t.left)*(this.W/t.width)-Ah)/Math.max(1,this.W-Ah-jh)*52,1,53)}down=e=>{this.dragging=!0,this.cv.setPointerCapture?.(e.pointerId),window.clearTimeout(this.touchTimer);let t=this.timeAt(e);this.hover=t,this.onSeek(t),this.draw()};move=e=>{let t=this.timeAt(e);this.hover=t,this.dragging&&this.onSeek(t),this.draw()};leave=()=>{this.dragging||(this.hover=null,this.draw())};up=e=>{this.dragging=!1,e.pointerType!==`mouse`&&(window.clearTimeout(this.touchTimer),this.touchTimer=window.setTimeout(()=>{this.hover=null,this.draw()},1300))};key=e=>{let t=e.shiftKey||e.key===`PageUp`||e.key===`PageDown`,n=null;e.key===`ArrowLeft`||e.key===`PageDown`?n=this.t-(t?5:1):e.key===`ArrowRight`||e.key===`PageUp`?n=this.t+(t?5:1):e.key===`Home`?n=1:e.key===`End`&&(n=53),n!=null&&(e.preventDefault(),this.onSeek(ih(n,1,53)))};set(e,t,n){let r=!this.run||t!==this.p;this.run=e,this.p=t,this.t=n,this.derive(),r&&(this.revealU=+!!ah(),this.revealT0=performance.now(),this.loop?.wake());let i=Math.round(n);this.cv.setAttribute(`aria-valuenow`,String(i)),this.cv.setAttribute(`aria-valuetext`,`Day ${i}, ${Jp[Yp(n)-1].name}, ${e.isl[this.m].name} and ${e.isl[this.f].name}`),this.draw()}derive(){let e=this.run,t=this.p,n=e.steps;this.m=e.men[Math.floor(t/e.nW)],this.f=e.women[t%e.nW];let r=2;for(let i=0;i<n;i++){let a=(t*n+i)*2;for(let t of[e.X[a]+e.U[a],e.X[a+1]+e.U[a+1]])Number.isFinite(t)&&t>r&&(r=t)}this.mx=Math.min(7,r*1.08),this.shocks=e.cfg.shocks.filter(e=>e.m===this.m&&e.f===this.f).map(e=>({t0:e.t,s:e.s})),this.pairEv=e.events.filter(e=>e.a===this.m&&e.b===this.f&&Ph[e.kind])}draw(){let{ctx:e,W:t,H:n,run:r}=this;if(!t||!r)return;let i=performance.now();this.revealU<1&&(this.revealU=ih((i-this.revealT0)/Nh,0,1));let a=1-(1-this.revealU)**3;e.setTransform(this.dpr,0,0,this.dpr,0,0),e.clearRect(0,0,t,n),e.lineCap=`round`,e.lineJoin=`round`,e.textBaseline=`alphabetic`,e.setLineDash([]);let o=r.steps,s=this.p,c=this.m,l=this.f,u=e=>(s*o+e)*2,d=e=>r.X[u(e)]+r.U[u(e)],f=e=>r.X[u(e)+1]+r.U[u(e)+1],p=e=>r.X[u(e)],m=e=>r.X[u(e)+1],h=e=>r.PHI[s*o+e],g=t-Ah-jh,_=e=>Ah+(e-1)/52*g,v=n-Mh-2,y=Math.round((n-Mh)*.64),b=y-8,x=y+4,S=Math.max(18,v-x-2),C=this.mx,w=e=>b-ih(e,-.4,C)/C*(b-26),T=(t,n)=>{e.beginPath();let r=!1;for(let i=0;i<o;i++){let a=t(i);if(!Number.isFinite(a)){r=!1;continue}let o=_(mm(i)),s=n(a);r?e.lineTo(o,s):(e.moveTo(o,s),r=!0)}e.stroke()},E=(e,t)=>{let n=-1;for(let r=0;r<=o;r++){let i=r<o&&e(r);i&&n<0?n=r:!i&&n>=0&&(t(n,r-1),n=-1)}};e.font=oh(9.5),e.textAlign=`left`,Jp.forEach((t,r)=>{let i=_(t.a),a=_(Math.min(53,t.b+1));e.fillStyle=r%2?`rgba(237,230,214,0.035)`:`rgba(237,230,214,0.014)`,e.fillRect(i,0,a-i,n-Mh),e.fillStyle=`rgba(237,230,214,0.46)`,e.letterSpacing=`1px`,e.fillText(t.name.toUpperCase(),i+5,12),e.letterSpacing=`0px`});let D=_(29),O=_(33);e.fillStyle=`rgba(217,164,65,0.11)`,e.fillRect(D,18,O-D,n-Mh-18),e.strokeStyle=`rgba(217,164,65,0.35)`,e.lineWidth=1,e.beginPath(),e.moveTo(D,18),e.lineTo(D,n-Mh),e.moveTo(O,18),e.lineTo(O,n-Mh),e.stroke(),O-D>46&&(e.font=oh(8.5,600),e.letterSpacing=`0.8px`,e.fillStyle=`rgba(217,164,65,0.85)`,e.textAlign=`center`,e.fillText(`CASA AMOR`,(D+O)/2,24),e.textAlign=`left`,e.letterSpacing=`0px`),e.font=oh(9.5),e.textAlign=`right`;for(let n=0;n<=C;n+=C>4?2:1)e.strokeStyle=n===0?`rgba(237,230,214,0.22)`:`rgba(237,230,214,0.075)`,e.lineWidth=1,e.beginPath(),e.moveTo(Ah,w(n)),e.lineTo(t-jh,w(n)),e.stroke(),e.fillStyle=`rgba(237,230,214,0.46)`,e.fillText(String(n),24,w(n)+3);e.strokeStyle=`rgba(237,230,214,0.06)`;for(let t of Kp)e.beginPath(),e.moveTo(_(t),18),e.lineTo(_(t),n-Mh),e.stroke();e.strokeStyle=`rgba(143,184,255,0.34)`,e.setLineDash([2,3]);for(let t of qp)e.beginPath(),e.moveTo(_(t),18),e.lineTo(_(t),n-Mh),e.stroke();e.setLineDash([]),e.save(),e.beginPath(),e.rect(0,0,Ah+g*a+2,n),e.clip(),E(e=>Number.isFinite(h(e)),(t,r)=>{e.fillStyle=`rgba(255,106,138,0.07)`,e.fillRect(_(mm(t)),22,Math.max(2,_(mm(r))-_(mm(t))),n-Mh-26+4),e.fillStyle=`rgba(255,106,138,0.22)`,e.fillRect(_(mm(t)),n-Mh-2,Math.max(2,_(mm(r))-_(mm(t))),2)}),E(e=>Number.isFinite(d(e))&&Number.isFinite(f(e)),(t,n)=>{e.beginPath();for(let r=t;r<=n;r++){let n=_(mm(r)),i=w(d(r));r===t?e.moveTo(n,i):e.lineTo(n,i)}for(let r=n;r>=t;r--)e.lineTo(_(mm(r)),w(f(r)));e.closePath(),e.fillStyle=`rgba(255,106,138,0.075)`,e.fill()}),e.setLineDash([3,3]),e.lineWidth=1,e.strokeStyle=`rgba(255,106,138,0.42)`,T(p,w),e.strokeStyle=`rgba(237,230,214,0.42)`,T(m,w),e.setLineDash([]),e.lineWidth=2.1,e.strokeStyle=Eh,T(d,w),e.strokeStyle=Dh,T(f,w);let k=e=>this.shocks.length?.5*zp(e,this.shocks):0,A=1,j=0,M=!1;for(let e=0;e<o;e++){let t=h(e);if(!Number.isFinite(t))continue;M=!0;let n=t-k(mm(e));A=Math.max(A,t,n),j=Math.min(j,t,n)}let N=(A-j)*1.1||1,P=e=>v-(e-j)/N*S;if(e.strokeStyle=`rgba(237,230,214,0.12)`,e.lineWidth=1,e.beginPath(),e.moveTo(Ah,y),e.lineTo(t-jh,y),e.stroke(),M){let t=e.createLinearGradient(0,x,0,v);t.addColorStop(0,`rgba(143,184,255,0.26)`),t.addColorStop(1,`rgba(143,184,255,0)`),E(e=>Number.isFinite(h(e)),(n,r)=>{e.beginPath();for(let t=n;t<=r;t++){let r=_(mm(t)),i=P(h(t));t===n?e.moveTo(r,i):e.lineTo(r,i)}if(e.lineTo(_(mm(r)),v),e.lineTo(_(mm(n)),v),e.closePath(),e.fillStyle=t,e.fill(),this.shocks.length){e.beginPath();for(let t=n;t<=r;t++){let r=_(mm(t)),i=P(h(t));t===n?e.moveTo(r,i):e.lineTo(r,i)}for(let t=r;t>=n;t--)e.lineTo(_(mm(t)),P(h(t)-k(mm(t))));e.closePath(),e.fillStyle=`rgba(217,164,65,0.34)`,e.fill()}}),this.shocks.length&&(e.setLineDash([2,3]),e.lineWidth=1,e.strokeStyle=`rgba(143,184,255,0.55)`,T(e=>{let t=h(e);return Number.isFinite(t)?t-k(mm(e)):NaN},P),e.setLineDash([])),e.lineWidth=1.9,e.strokeStyle=Oh,T(h,P)}e.restore(),e.textAlign=`left`,e.font=oh(9,600),e.letterSpacing=`0.8px`,Fh(e,`PUBLIC SUPPORT`,36,x+10,`rgba(143,184,255,0.82)`),e.letterSpacing=`0px`,M||(e.font=sh(14),e.textAlign=`center`,Fh(e,`Not a couple, so the public does not vote on them.`,Ah+g/2,x+S/2+6,`rgba(237,230,214,0.6)`),e.textAlign=`left`);let F=r.isl[c].name,I=r.isl[l].name;e.font=sh(14.5);let L=e.measureText(F).width;e.lineWidth=2.1,e.strokeStyle=Eh,e.beginPath(),e.moveTo(38,38),e.lineTo(52,38),e.stroke(),Fh(e,F,58,42.5,`rgba(255,150,172,0.98)`),e.strokeStyle=Dh,e.beginPath(),e.moveTo(68+L,38),e.lineTo(82+L,38),e.stroke(),Fh(e,I,88+L,42.5,`rgba(237,230,214,0.96)`);for(let n of this.pairEv){let r=_(n.t),i=Ph[n.kind];this.revealU<1&&r>Ah+g*a||(e.strokeStyle=n.kind===`vote`?Oh:n.kind===`split`?`rgba(237,230,214,0.6)`:Eh,e.lineWidth=1,e.beginPath(),e.moveTo(r,48),e.lineTo(r,b),e.stroke(),e.fillStyle=e.strokeStyle,e.beginPath(),e.arc(r,48,2.6,0,6.2832),e.fill(),g>420&&(e.font=oh(8.5,600),e.letterSpacing=`0.6px`,e.textAlign=r>t-150?`right`:`left`,Fh(e,i.toUpperCase(),r+(r>t-150?-5:5),64,n.kind===`vote`?`rgba(143,184,255,0.9)`:`rgba(237,230,214,0.78)`),e.letterSpacing=`0px`,e.textAlign=`left`))}for(let n of this.shocks){let r=_(n.t0);e.fillStyle=kh,e.beginPath(),e.moveTo(r,x+3),e.lineTo(r-4,x-4),e.lineTo(r+4,x-4),e.closePath(),e.fill(),g>360&&(e.font=sh(13.5),e.textAlign=r>t-130?`right`:`left`,Fh(e,`your vote ${n.s>0?`+`:``}${n.s}`,r+(r>t-130?-7:7),x+8,`rgba(236,190,95,0.98)`),e.textAlign=`left`)}let R=n-Mh+6;for(let t of Kp)e.strokeStyle=`rgba(237,230,214,0.82)`,e.lineWidth=1.3,e.beginPath(),e.moveTo(_(t),R-4.5),e.lineTo(_(t)+4,R+3),e.lineTo(_(t)-4,R+3),e.closePath(),e.stroke();e.fillStyle=Oh;for(let t of qp)e.beginPath(),e.moveTo(_(t),R-4.5),e.lineTo(_(t)+4,R),e.lineTo(_(t),R+4.5),e.lineTo(_(t)-4,R),e.closePath(),e.fill();e.font=oh(9),e.textAlign=`center`,e.fillStyle=`rgba(237,230,214,0.46)`;for(let t of[1,5,10,15,20,25,30,35,40,45,50,53])e.fillText(String(t),_(t),n-3);if(e.textAlign=`left`,e.fillText(`DAY`,3,n-3),g>430){e.font=oh(8.5,500),e.letterSpacing=`0.6px`,e.textAlign=`right`;let n=t-jh-4,r=x+10;Fh(e,`RECOUPLING`,n,r,`rgba(237,230,214,0.72)`);let i=e.measureText(`RECOUPLING`).width+15;e.strokeStyle=`rgba(237,230,214,0.82)`,e.lineWidth=1.2,e.beginPath(),e.moveTo(n-i,r-8),e.lineTo(n-i+3.5,r-1.5),e.lineTo(n-i-3.5,r-1.5),e.closePath(),e.stroke();let a=n-i-18;Fh(e,`VOTE`,a,r,`rgba(143,184,255,0.9)`);let o=e.measureText(`VOTE`).width+14;e.fillStyle=Oh,e.beginPath(),e.moveTo(a-o,r-9),e.lineTo(a-o+4,r-4.5),e.lineTo(a-o,r),e.lineTo(a-o-4,r-4.5),e.closePath(),e.fill(),e.letterSpacing=`0px`,e.textAlign=`left`}this.hover!=null&&this.drawHover(e,this.hover,_,w,P,h,d,f,k,26,x,S,F,I);let z=_(this.t),ee=ih(Math.round((this.t-1)/Wp),0,o-1),B=e.createLinearGradient(0,18,0,n-Mh);B.addColorStop(0,`rgba(237,230,214,0.95)`),B.addColorStop(1,`rgba(237,230,214,0.5)`),e.strokeStyle=B,e.lineWidth=1.4,e.beginPath(),e.moveTo(z,18),e.lineTo(z,n-Mh),e.stroke();for(let[t,n]of[[d(ee),Eh],[f(ee),Dh]])Number.isFinite(t)&&(e.fillStyle=n,e.beginPath(),e.arc(z,w(t),4,0,6.2832),e.fill(),e.strokeStyle=`#050506`,e.lineWidth=1.5,e.stroke());let te=h(ee);Number.isFinite(te)&&(e.fillStyle=Oh,e.beginPath(),e.arc(z,P(te),3.6,0,6.2832),e.fill(),e.strokeStyle=`#050506`,e.lineWidth=1.5,e.stroke());let ne=`DAY ${Math.round(this.t)}`;e.font=oh(9.5,600),e.letterSpacing=`0.8px`;let V=e.measureText(ne).width+12,H=ih(z-V/2,1,t-V-1);e.fillStyle=Dh,ch(e,H,n-Mh+10,V,13,6.5),e.fill(),e.fillStyle=`#050506`,e.textAlign=`center`,e.fillText(ne,H+V/2+.4,n-Mh+19.8),e.letterSpacing=`0px`,e.textAlign=`left`}drawHover(e,t,n,r,i,a,o,s,c,l,u,d,f,p){let m=this.run,h=this.W,g=this.H,_=ih(Math.round((t-1)/Wp),0,m.steps-1),v=n(mm(_)),y=Math.round(t);e.strokeStyle=`rgba(237,230,214,0.4)`,e.lineWidth=1,e.setLineDash([3,3]),e.beginPath(),e.moveTo(v,18),e.lineTo(v,g-Mh),e.stroke(),e.setLineDash([]);let b=o(_),x=s(_),S=a(_);Number.isFinite(b)&&(e.fillStyle=Eh,e.beginPath(),e.arc(v,r(b),3,0,6.2832),e.fill()),Number.isFinite(x)&&(e.fillStyle=Dh,e.beginPath(),e.arc(v,r(x),3,0,6.2832),e.fill()),Number.isFinite(S)&&(e.fillStyle=Oh,e.beginPath(),e.arc(v,i(S),3,0,6.2832),e.fill());let C=[{t:`DAY ${y}  ${Jp[Yp(t)-1].name.toUpperCase()}`,font:oh(9.5,600),col:Dh}];Number.isFinite(b)&&Number.isFinite(x)?(C.push({t:`${f}  ${b.toFixed(2)}`,font:oh(10.5),col:Dh,sw:Eh},{t:`${p}  ${x.toFixed(2)}`,font:oh(10.5),col:Dh,sw:Dh}),C.push(Number.isFinite(S)?{t:`Public support  ${S.toFixed(2)}`,font:oh(10.5),col:Dh,sw:Oh}:{t:`Not a couple on this day`,font:sh(14),col:`rgba(237,230,214,0.7)`})):C.push({t:`Not in the villa together`,font:sh(14),col:`rgba(237,230,214,0.7)`});let w=[];t>=29&&t<33&&w.push(`Casa Amor window`),Kp.includes(y)&&w.push(`Recoupling ceremony`),qp.includes(y)&&w.push(`Public vote`);for(let e of this.pairEv)Math.abs(e.t-y)<.06&&w.push(Ph[e.kind]);for(let e of this.shocks)Math.abs(e.t0-t)<.6?w.push(`Your vote ${e.s>0?`+`:``}${e.s}`):t>e.t0&&Number.isFinite(S)&&Math.abs(c(t))>.04&&w.push(`Your vote is fading, ${c(t)>0?`+`:``}${c(t).toFixed(2)} of support now`);for(let e of w)C.push({t:e,font:sh(13.5),col:`rgba(236,190,95,0.98)`});let T=0;for(let t of C)e.font=t.font,T=Math.max(T,e.measureText(t.t).width+(t.sw?14:0));T+=18;let E=C.length*16+10,D=v+14+T>h-4?v-14-T:v+14,O=ih(l+26,4,g-Mh-E-4);e.fillStyle=`rgba(5,5,6,0.9)`,e.strokeStyle=`rgba(237,230,214,0.22)`,e.lineWidth=1,ch(e,D,O,T,E,6),e.fill(),e.stroke(),e.textAlign=`left`,C.forEach((t,n)=>{let r=O+8+(n+1)*16-4,i=t.sw?14:0;t.sw&&(e.fillStyle=t.sw,e.beginPath(),e.arc(D+14,r-3.5,3.2,0,6.2832),e.fill()),e.font=t.font,e.fillStyle=t.col,e.fillText(t.t,D+9+i,r)})}dispose(){this.loop?.dispose(),this.fit.dispose(),window.clearTimeout(this.touchTimer);let e=this.cv;e.removeEventListener(`pointerdown`,this.down),e.removeEventListener(`pointermove`,this.move),e.removeEventListener(`pointerleave`,this.leave),e.removeEventListener(`pointerup`,this.up),e.removeEventListener(`pointercancel`,this.up),e.removeEventListener(`keydown`,this.key)}},Lh={preset:`season`,seed:7,alpha:.6,beta:.2,gamma:.3,syn:0,mix:.3,ca:.75,loyalty:.45,kappa:.22,sigma:.12,vw:1,chi:.5,eps:.12,lam:0,cast:`base`,shocks:[],over:{}},Rh=[{k:`alpha`,label:`Forgetting`,short:`α`,min:.3,max:1.2,step:.01,hint:`How fast affection fades on its own. Higher pulls every couple toward less love.`,src:`paper 2.2, am af`},{k:`beta`,label:`Reactiveness`,short:`β`,min:0,max:.6,step:.01,hint:`How strongly each partner answers being loved. When it beats forgetting the couple has no resting state.`,src:`paper 2.2, bm bf`},{k:`gamma`,label:`Appeal weight`,short:`γ`,min:.1,max:.8,step:.01,hint:`How much each partner responds to the other’s appeal.`,src:`paper 2.2, gm gf`},{k:`syn`,label:`Synergy`,short:`d`,min:0,max:.12,step:.002,hint:`Affection that feeds on itself. Strong enough, it turns a resting state unstable (Proposition 2).`,src:`paper 2.3, Prop. 2`},{k:`mix`,label:`Mixing`,short:`c`,min:0,max:.8,step:.01,hint:`How much two islanders who are not a couple still see of each other. It sets how strong a rival attraction can grow.`,src:`demo extension of the multi-agent setting`},{k:`loyalty`,label:`Loyalty`,short:`L`,min:0,max:1.5,step:.01,hint:`The head start a current couple has at a recoupling over a rival pair.`,src:`demo recoupling rule`}],zh=[{k:`vw`,label:`Public vote weight`,short:`w`,min:0,max:2,step:.01,hint:`Scales all six weights of the support function.`,src:`paper 3.2, w1 to w6`},{k:`chi`,label:`Love in the Winner Index`,short:`χ`,min:0,max:1.5,step:.01,hint:`Weight on the couple’s average love near the finale.`,src:`paper 6, chi`},{k:`kappa`,label:`Early damping`,short:`κ`,min:.05,max:1.2,step:.01,hint:`Low damping leaves large early swings; the paper has damping grow with time.`,src:`paper 4, kappa`},{k:`sigma`,label:`Emotional shocks`,short:`η`,min:0,max:.4,step:.005,hint:`Size of the daily random push on every love level.`,src:`paper 4, eta`},{k:`ca`,label:`Casa Amor pull`,short:`c`,min:0,max:1,step:.01,hint:`Contact between the old villa and the Casa Amor arrivals on days 29 to 32.`,src:`paper 5.2, demo contact factor`},{k:`lam`,label:`Vote feedback`,short:`λ`,min:0,max:1.5,step:.01,hint:`Off in the paper. On, support above the villa average lifts a couple’s appeal term.`,src:`demo extension (off by default)`},{k:`eps`,label:`Finale luck`,short:`ε`,min:0,max:.5,step:.005,hint:`Size of the random residual in the Winner Index.`,src:`paper 6, epsilon`}],Bh=[{id:`season`,label:`Full season`,accent:`rose`,tag:`Days 1 to 53`,line:`Twenty-five islanders, three stages, the public vote and Casa Amor, from day 1 to day 53.`,watch:`Press play. Couples form on day 1, bombshells arrive, the audience votes couples out, and four reach the finale.`,cfg:{},focus:[1,12],t:1,view:`villa`},{id:`stable`,label:`A couple that settles`,accent:`rose`,tag:`Proposition 1`,line:`Forgetting beats responding and there is no synergy, so each couple climbs to one resting level and stays there.`,watch:`In the phase view the path spirals into the dot where the two dashed curves cross and stays. Nothing grows, nothing is dumped for love.`,cfg:{alpha:.65,beta:.15,syn:0,sigma:.04,mix:.12,loyalty:.9,ca:.2},focus:[1,12],t:30,view:`phase`},{id:`swings`,label:`Oscillating couple`,accent:`swing`,tag:`Section 4`,line:`Low damping and loud daily shocks: love swings up and down for weeks before the growing damping calms it.`,watch:`Open the love-over-time chart. The wiggle is the damped oscillator of Section 4; it is large early and shrinks as kappa grows with the days.`,cfg:{kappa:.05,sigma:.38,beta:.32,alpha:.6},focus:[1,12],t:9,view:`phase`},{id:`triangle`,label:`Love triangle`,accent:`rose`,tag:`Multi-agent`,line:`Zara arrives on day 8 with the highest appeal in the villa and sees a lot of Rowan, whose couple with Lucía is already drifting.`,watch:`Select Rowan and Lucía and watch Zara’s bar climb in the rivals list. At the day 12 recoupling Rowan chooses her and Lucía couples with Elliot.`,cfg:{cast:`triangle`,mix:.65,loyalty:.15,sigma:.05,over:{"0-14":{am:1,af:1,bm:.05,bf:.05}}},focus:[0,14],t:10,view:`villa`},{id:`recouple`,label:`Recoupling after a dumping`,accent:`rose`,tag:`Days 18 to 22`,line:`The public dumps a couple on day 18, three strong bombshells arrive on day 21, and the day 22 recoupling splits a couple that had quietly drifted apart.`,watch:`Play from day 20. Kofi and Priya have little holding them together; Hugo takes Priya and Kofi is left single and leaves.`,cfg:{cast:`recouple`,mix:.5,loyalty:.1,over:{"2-13":{am:1.1,af:1.1,bm:.02,bf:.02,gm:.15,gf:.15}}},focus:[2,13],t:20,view:`villa`},{id:`vote`,label:`Vote shock`,accent:`vote`,tag:`Sections 3 and 6`,line:`The audience swings behind Mateo and Lucía on day 23 and against Dario and Imani on day 27, and the vote feeds back into appeal.`,watch:`Dario and Imani are loving and steady, yet the day 28 vote sends them home. Support and love are different numbers, and the Winner Index counts both.`,cfg:{lam:.8,vw:1.3,shocks:[{m:3,f:14,t:23,s:1.6},{m:1,f:12,t:27,s:-2.4}]},focus:[1,12],t:25,view:`phase`},{id:`casa`,label:`Casa Amor`,accent:`casa`,tag:`Days 29 to 32`,line:`The new arrivals see the old villa for four days, loyalty is loose, and at the day 32 recoupling three couples break up.`,watch:`Play from day 30. Contact between old and new rises to 0.95, the swings get louder, and Rowan and Noor, Kofi and Priya and Jonah and Sloane all end.`,cfg:{ca:.95,loyalty:.1,mix:.35},focus:[0,16],t:30,view:`villa`},{id:`runaway`,label:`Runaway synergy`,accent:`swing`,tag:`Proposition 2`,line:`Synergy strong enough to destabilize a couple that would otherwise settle: no resting state is left and affection grows without limit.`,watch:`In the phase view the path leaves the picture instead of settling. With synergy off the same couple settles; the paper’s second proposition is about this.`,cfg:{syn:.09,sigma:.03},focus:[3,14],t:8,view:`phase`}],Vh=e=>Bh.find(t=>t.id===e)??Bh[0];function Hh(e){let t=Vh(e);return{...Lh,...structuredClone(t.cfg),preset:t.id,shocks:structuredClone(t.cfg.shocks??[]),over:structuredClone(t.cfg.over??{})}}var Uh=(e,t,n)=>e<t?t:e>n?n:e,Wh=135,Gh=24,Kh=320,qh=(e,t)=>Uh(Math.round((e-t.min)/t.step)*t.step+t.min,t.min,t.max),Jh=e=>{let t=String(e.step).split(`.`)[1];return t?t.length:0},Yh=`
.knob-dial { --kn-ink: color-mix(in srgb, var(--ink, #EDE6D6) 62%, transparent); }
.knob-dial .kn-scale { position: absolute; inset: -16px; width: calc(100% + 32px); height: calc(100% + 32px); overflow: visible; pointer-events: none; }
.kn-scale line { stroke-linecap: round; }
.kn-scale .base line { stroke: var(--hair-soft, rgba(237,230,214,.16)); stroke-width: .9; }
.kn-scale .base line.M { stroke: var(--hair, rgba(237,230,214,.34)); stroke-width: 1.1; }
.kn-scale.lit { -webkit-mask: conic-gradient(from -135deg, #000 calc(var(--p, 0) * 270deg), transparent 0); mask: conic-gradient(from -135deg, #000 calc(var(--p, 0) * 270deg), transparent 0); }
.kn-scale.lit line { stroke: var(--kn-ink); stroke-width: 1.1; }
.kn-scale.lit line.M { stroke: var(--ink, #EDE6D6); stroke-width: 1.3; }
.kn-scale .pm { stroke: var(--a, #FF6A8A); stroke-width: 1.7; }
.knob-gloss { position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle at 34% 24%, rgba(237,230,214,.17), transparent 42%), radial-gradient(circle at 50% 118%, rgba(0,0,0,.55), transparent 62%);
  box-shadow: inset 0 1px 0 rgba(237,230,214,.13), inset 0 -7px 12px rgba(0,0,0,.5); }
.knob-cap::before { content: ''; position: absolute; inset: 2px; border-radius: 50%; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, rgba(237,230,214,.12) 0 1.4deg, transparent 1.4deg 6deg);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px)); mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px)); }
.knob-dial:focus-visible { outline: 2px solid color-mix(in srgb, var(--ink, #EDE6D6) 55%, transparent); outline-offset: 14px; border-radius: 50%; }
.knob-cap:active { transform-origin: 50% 50%; }
.knob-out, .sl-out { transition: color .18s; }
.knob.is-moved .knob-out, .is-moved > .sl-out, .is-moved .sl-out { color: var(--a, #FF6A8A); }
.knob.is-turn .knob-out, .is-drag .sl-out { color: var(--ink, #EDE6D6); }
.kn-pulse, .sl-pulse { position: absolute; pointer-events: none; border-radius: 50%; border: 1px solid var(--a, #FF6A8A); opacity: 0; }
.kn-pulse { inset: -8px; }
.sl-pulse { inset: 13px; }

.sl-ticks { position: absolute; left: 22px; right: 22px; top: 50%; height: 0; pointer-events: none; }
.sl-ticks > div { position: absolute; inset: 0; }
.sl-ticks i { position: absolute; top: 9px; width: 1px; height: 4px; margin-left: -.5px; background: var(--hair-soft, rgba(237,230,214,.16)); }
.sl-ticks i.M { height: 7px; background: var(--hair, rgba(237,230,214,.34)); }
.sl-ticks .lit { clip-path: inset(-2px calc((1 - var(--p, 0)) * 100%) -2px -2px); }
.sl-ticks .lit i { background: var(--ink-dim, rgba(237,230,214,.74)); }
.sl-ticks b { position: absolute; top: 16px; width: 0; height: 0; margin-left: -3.5px; border-left: 3.5px solid transparent; border-right: 3.5px solid transparent; border-bottom: 5px solid var(--a, #FF6A8A); }
.sl-thumb:focus-visible::after { background: var(--ink, #EDE6D6); }
@media (prefers-reduced-motion: reduce) { .knob-out, .sl-out { transition: none; } }
`,Xh=!1;function Zh(){if(Xh||typeof document>`u`)return;Xh=!0;let e=document.createElement(`style`);e.setAttribute(`data-li-controls`,``),e.textContent=Yh,document.head.appendChild(e)}var Qh=`http://www.w3.org/2000/svg`;function $h(e,t){let n=document.createElementNS(Qh,e);for(let e in t)n.setAttribute(e,String(t[e]));return n}function eg(e,t,n){e.setAttribute(`aria-valuenow`,String(+n.toFixed(Jh(t.spec)+1))),e.setAttribute(`aria-valuetext`,t.describe?t.describe(n):t.fmt(n))}function tg(e,t,n){let r=e.dataset.k,i=t.value,a=t.preset,o=``,s=i,c=()=>/[#&]s=([A-Za-z0-9_-]+)/.exec(location.hash)?.[1]??Lh.preset,l=()=>{if(a!==void 0)return Uh(a,t.spec.min,t.spec.max);if(r&&typeof Lh[r]==`number`){let e=c();return e!==o&&(o=e,s=Hh(e)[r]),Uh(s,t.spec.min,t.spec.max)}return Uh(i,t.spec.min,t.spec.max)},u=()=>n();return window.addEventListener(`hashchange`,u),e.addEventListener(`pointerenter`,u),e.addEventListener(`focusin`,u),{get:l,set(e){a=e},dispose(){window.removeEventListener(`hashchange`,u),e.removeEventListener(`pointerenter`,u),e.removeEventListener(`focusin`,u)}}}function ng(e,t,n,r=1.45){if(n)return;let i=document.createElement(`span`);i.className=t,i.setAttribute(`aria-hidden`,`true`),e.appendChild(i),en(i,{scale:[.86,r],opacity:[.7,0],duration:620,ease:`out(3)`,onComplete:()=>i.remove()})}function rg(e,t){let n=0,r=0,i=0,a=!1,o=e=>{r=e.clientX,i=e.clientY,a=!1},s=e=>{!a&&Math.hypot(e.clientX-r,e.clientY-i)>5&&(a=!0)},c=e=>{a?n=0:e.timeStamp-n<Kh?(n=0,setTimeout(t,0)):n=e.timeStamp};return e.addEventListener(`pointerdown`,o),e.addEventListener(`pointermove`,s),e.addEventListener(`pointerup`,c),()=>{e.removeEventListener(`pointerdown`,o),e.removeEventListener(`pointermove`,s),e.removeEventListener(`pointerup`,c)}}function ig(e,t,n,r,i,a,o){if(e.key===`Backspace`||e.key===`Delete`)return e.preventDefault(),o(),null;let s={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1,PageUp:10,PageDown:-10},c=t;if(e.key===`Home`)c=r.spec.min;else if(e.key===`End`)c=r.spec.max;else if(s[e.key]){a.rep=e.repeat?a.rep+1:0;let r=1+Math.min(4,Math.floor(a.rep/7));c=t+s[e.key]*(e.shiftKey?10:1)*n*i*r}else return null;return e.preventDefault(),qh(c,r.spec)}function ag(e,t){Zh();let n=e.querySelector(`.knob-cap`),r=e.querySelector(`.knob-out`),i=e.querySelector(`.knob-dial`),a=t.spec.max-t.spec.min,o=Math.max(.5,t.spec.step/a*2*Wh),s=Uh(t.value,t.spec.min,t.spec.max),c=Uh(t.preset??t.value,t.spec.min,t.spec.max),l=null,u={rep:0},d=e=>(e-t.spec.min)/a,f=tg(e,t,()=>C()),p=e=>-135+d(e)*2*Wh,m=e=>t.spec.min+(e+Wh)/270*a,h=$h(`svg`,{class:`kn-scale`,viewBox:`0 0 100 100`,"aria-hidden":`true`,focusable:`false`}),g=$h(`g`,{class:`base`}),_=(e,t)=>[50+t*Math.sin(e*Math.PI/180),50-t*Math.cos(e*Math.PI/180)],v=e=>{for(let t=0;t<=Gh;t++){let n=-135+t/Gh*2*Wh,r=t%6==0,[i,a]=_(n,44.5),[o,s]=_(n,r?49.2:47.1);e.appendChild($h(`line`,{x1:i,y1:a,x2:o,y2:s,class:r?`M`:``}))}};v(g),h.appendChild(g);let y=$h(`svg`,{class:`kn-scale lit`,viewBox:`0 0 100 100`,"aria-hidden":`true`,focusable:`false`}),b=$h(`g`,{});v(b),y.appendChild(b);let x=$h(`line`,{class:`pm`,x1:50,y1:6.6,x2:50,y2:.6}),S=()=>{x.setAttribute(`transform`,`rotate(${p(c)} 50 50)`),i.title=`${t.label}: double-click to return to ${t.fmt(c)}`},C=()=>{let e=f.get();e!==c&&(c=e,S(),T(s))};c=f.get(),S(),h.appendChild(x);let w=document.createElement(`span`);if(w.className=`knob-gloss`,w.setAttribute(`aria-hidden`,`true`),!n.querySelector(`.notch`)){let e=document.createElement(`span`);e.className=`notch`,n.appendChild(e)}i.append(h,y,w);let T=n=>{e.style.setProperty(`--p`,String(d(n))),r.textContent=t.fmt(n),eg(i,t,n),e.classList.toggle(`is-moved`,Math.abs(n-c)>t.spec.step*.5)},E=0,D=()=>{clearTimeout(E),E=window.setTimeout(()=>t.onSettle?.(s),0)},O=_n(n,{x:{mapTo:`rotate`,snap:o},y:!1,container:[0,Wh,0,-135],dragSpeed:1.5,velocityMultiplier:t.reduced?0:.25,releaseEase:t.reduced?`out(3)`:cn({duration:420,bounce:.18}),releaseStiffness:300,releaseDamping:30,cursor:{onHover:`grab`,onGrab:`grabbing`},onGrab:()=>{l?.cancel(),l=null,e.classList.add(`is-turn`)},onRelease:()=>{e.classList.remove(`is-turn`)},onSettle:()=>{D()},onUpdate:e=>{let n=m(e.x),r=qh(n,t.spec);r!==s&&(s=r,t.onInput(r)),T(Uh(n,t.spec.min,t.spec.max))}});O.setX(p(s),!0),T(s);let k=e=>{O.dragSpeed=e.shiftKey?.375:1.5};n.addEventListener(`pointerdown`,k);let A=(e,n=!0)=>{if(e=Uh(e,t.spec.min,t.spec.max),s=e,l?.cancel(),O.released&&O.stop(),!n||t.reduced){O.setX(p(e),!0),T(e);return}let r={deg:O.x,v:m(O.x)};l=en(r,{deg:p(e),v:e,duration:700,ease:cn({duration:600,bounce:.22}),onUpdate:()=>{O.setX(r.deg,!0),T(Uh(r.v,t.spec.min,t.spec.max))},onComplete:()=>D()})},j=()=>{O.grabbed||(C(),A(c,!0),t.onInput(c),t.onReset?.(c),ng(i,`kn-pulse`,t.reduced),t.reduced&&D())},M=e=>{let n=ig(e,s,t.spec.step,t,1,u,j);n!=null&&(A(n,!0),t.onInput(n))};i.addEventListener(`keydown`,M);let N=rg(i,j);return i.setAttribute(`role`,`slider`),i.setAttribute(`aria-label`,t.label),i.setAttribute(`aria-valuemin`,String(t.spec.min)),i.setAttribute(`aria-valuemax`,String(t.spec.max)),i.tabIndex=0,i.setAttribute(`aria-keyshortcuts`,`ArrowUp ArrowDown PageUp PageDown Home End Backspace`),i.setAttribute(`aria-description`,`Drag or use the arrow keys. Double-click or press Backspace to return to the scenario value.`),eg(i,t,s),{get value(){return s},get preset(){return c},show:A,reset:j,focus:()=>i.focus(),setPreset(e){f.set(e),C()},dispose(){f.dispose(),l?.cancel(),clearTimeout(E),i.removeEventListener(`keydown`,M),n.removeEventListener(`pointerdown`,k),N(),O.revert(),h.remove(),y.remove(),w.remove()}}}function og(e,t){Zh();let n=e.querySelector(`.sl-rail`),r=e.querySelector(`.sl-thumb`),i=e.querySelector(`.sl-out`),a=t.spec.max-t.spec.min,o=Uh(t.value,t.spec.min,t.spec.max),s=Uh(t.preset??t.value,t.spec.min,t.spec.max),c=null,l=!0,u={rep:0},d=e=>(e-t.spec.min)/a,f=e.classList.contains(`scrub`)||n.closest(`.scrub`)!=null,p=f?0:t.ticks??20,m=tg(e,t,()=>v());f||(s=m.get());let h=null,g=null;if(p>0){h=document.createElement(`div`),h.className=`sl-ticks`,h.setAttribute(`aria-hidden`,`true`);let e=Array.from({length:p+1},(e,t)=>`<i${t%5==0?` class="M"`:``} style="left:${(t/p*100).toFixed(3)}%"></i>`).join(``),i=document.createElement(`div`);i.innerHTML=e;let a=document.createElement(`div`);a.className=`lit`,a.innerHTML=e,g=document.createElement(`b`),g.title=`scenario value ${t.fmt(s)}`,h.append(i,a,g),n.insertBefore(h,r)}let _=()=>{g&&(g.style.left=(d(s)*100).toFixed(3)+`%`,g.title=`scenario value ${t.fmt(s)}`)};_();let v=()=>{if(f)return;let e=m.get();e!==s&&(s=e,_(),y(d(o)))},y=n=>{let o=Uh(n,0,1),c=t.spec.min+o*a;(t.track??e).style.setProperty(`--p`,String(o)),h?.style.setProperty(`--p`,String(o)),i&&(i.textContent=t.fmt(c)),e.classList.toggle(`is-moved`,!f&&Math.abs(c-s)>t.spec.step*.5),eg(r,t,c)},b=()=>w.containerBounds,x=e=>{let t=b();w.setX(t[3]+Uh(e,0,1)*(t[1]-t[3]),!0)},S=0,C=()=>{clearTimeout(S),S=window.setTimeout(()=>t.onSettle?.(o),0)},w=_n(r,{x:!0,y:!1,container:n,velocityMultiplier:t.reduced?0:.15,releaseEase:t.reduced?`out(3)`:cn({duration:380,bounce:.12}),releaseStiffness:300,releaseDamping:30,cursor:{onHover:`grab`,onGrab:`grabbing`},onGrab:()=>{c?.cancel(),c=null,l=!1,e.classList.add(`is-drag`)},onRelease:()=>{e.classList.remove(`is-drag`)},onSettle:()=>{l||C()},onUpdate:e=>{if(l)return;let n=qh(t.spec.min+Uh(e.progressX,0,1)*a,t.spec);n!==o&&(o=n,t.onInput(n)),y(e.progressX)}});requestAnimationFrame(()=>{x(d(o)),y(d(o))});let T=new ResizeObserver(()=>{w.refresh(),x(d(o))});T.observe(n);let E=(e,n=!0)=>{if(e=Uh(e,t.spec.min,t.spec.max),o=e,c?.cancel(),w.released&&w.stop(),!n||t.reduced){x(d(e)),y(d(e));return}let r=b(),i={p:r[1]===r[3]?d(e):(w.x-r[3])/(r[1]-r[3])};c=en(i,{p:d(e),duration:600,ease:cn({duration:520,bounce:.16}),onUpdate:()=>{x(i.p),y(i.p)},onComplete:()=>C()})},D=()=>{w.grabbed||f||(v(),l=!0,E(s,!0),t.onInput(s),t.onReset?.(s),ng(r,`sl-pulse`,t.reduced,2.4),t.reduced&&C())},O=e=>{if(f&&(e.key===`Backspace`||e.key===`Delete`))return;let n=ig(e,o,t.spec.step,t,t.keyMul??1,u,D);n!=null&&(l=!0,E(n,!0),t.onInput(n))};r.addEventListener(`keydown`,O);let k=f?()=>{}:rg(r,D);return r.setAttribute(`role`,`slider`),r.setAttribute(`aria-label`,t.label),r.setAttribute(`aria-orientation`,`horizontal`),r.setAttribute(`aria-valuemin`,String(t.spec.min)),r.setAttribute(`aria-valuemax`,String(t.spec.max)),r.tabIndex=0,f||(r.setAttribute(`aria-keyshortcuts`,`ArrowLeft ArrowRight PageUp PageDown Home End Backspace`),r.setAttribute(`aria-description`,`Drag or use the arrow keys. Double-click or press Backspace to return to the scenario value.`)),eg(r,t,o),{get value(){return o},get preset(){return s},show:E,reset:D,focus:()=>r.focus(),setPreset(e){m.set(e),v()},dispose(){m.dispose(),c?.cancel(),clearTimeout(S),T.disconnect(),r.removeEventListener(`keydown`,O),k(),w.revert(),h?.remove()}}}function sg(e,t,n,r=600,i=.1,a){return n?(e.v=t,a?.(),{cancel(){}}):en(e,{v:t,duration:r,ease:cn({duration:r*.85,bounce:i}),onUpdate:()=>{a?.()}})}var cg=e=>`<mi>${e}</mi>`,Q=e=>`<mo>${e}</mo>`,lg=e=>`<mn>${e}</mn>`,$=(e,t)=>`<msub>${cg(e)}${cg(t)}</msub>`,ug=e=>`<msup>${e}${lg(`2`)}</msup>`,dg=(...e)=>`<mrow>${e.join(``)}</mrow>`,fg=(e,t)=>`<mfrac>${dg(e)}${dg(t)}</mfrac>`,pg=(e,...t)=>`<mrow class="${e}">${t.join(``)}</mrow>`,mg=Q(`−`),hg=e=>`<mtext>${e}</mtext>`,gg=$(`x`,`m`),_g=$(`x`,`f`),vg=e=>fg(`${cg(`d`)}${e}`,`${cg(`d`)}${cg(`t`)}`);function yg(){let e=(e,t)=>`<mtr><mtd>${vg($(`x`,e))}</mtd><mtd>${Q(`=`)}${pg(`t-forget`,mg,$(`α`,e),$(`x`,e))}${Q(`+`)}${pg(`t-react`,$(`β`,e),$(`x`,t))}${Q(`+`)}${pg(`t-appeal`,$(`γ`,e),$(`A`,t))}${Q(`+`)}${pg(`t-syn`,$(`d`,e),gg,_g)}</mtd></mtr>`;return`<math display="block" aria-label="Equations 1 and 2: the rate of change of each partner's love is minus forgetting, plus reactiveness to the partner, plus response to the partner's appeal, plus synergy."><mtable columnalign="right left" columnspacing="0.5em" rowspacing="0.7em">${e(`m`,`f`)}${e(`f`,`m`)}</mtable></math>`}function bg(){let e=dg($(`α`,`m`),$(`α`,`f`),mg,$(`β`,`m`),$(`β`,`f`));return`<math display="block" aria-label="Equations 3 and 4: with no synergy the resting love levels are given by these two fractions."><mtable columnalign="right" rowspacing="0.9em"><mtr><mtd>${dg(`<msubsup>${cg(`x`)}${cg(`m`)}${Q(`*`)}</msubsup>`,Q(`=`),fg(dg($(`α`,`f`),$(`γ`,`m`),$(`A`,`f`),Q(`+`),$(`β`,`m`),$(`γ`,`f`),$(`A`,`m`)),e))}</mtd></mtr><mtr><mtd>${dg(`<msubsup>${cg(`x`)}${cg(`f`)}${Q(`*`)}</msubsup>`,Q(`=`),fg(dg($(`α`,`m`),$(`γ`,`f`),$(`A`,`m`),Q(`+`),$(`β`,`f`),$(`γ`,`m`),$(`A`,`f`)),e))}</mtd></mtr></mtable></math>`}function xg(){let e=e=>`<mtd>${e}</mtd>`;return`<math display="block" aria-label="The Jacobian matrix of the system."><mrow>${cg(`J`)}${Q(`=`)}<mrow>${Q(`(`)}<mtable columnspacing="1.2em" rowspacing="0.5em">
    <mtr>${e(dg(mg,$(`α`,`m`),Q(`+`),$(`d`,`m`),_g))}${e(dg($(`β`,`m`),Q(`+`),$(`d`,`m`),gg))}</mtr>
    <mtr>${e(dg($(`β`,`f`),Q(`+`),$(`d`,`f`),_g))}${e(dg(mg,$(`α`,`f`),Q(`+`),$(`d`,`f`),gg))}</mtr>
  </mtable>${Q(`)`)}</mrow></mrow></math>`}function Sg(){return`<math display="block" aria-label="A damped oscillator: x double prime plus kappa x prime plus omega squared x equals eta of t."><mrow>${fg(`${ug(cg(`d`))}${gg}`,`${cg(`d`)}${ug(cg(`t`))}`)}${Q(`+`)}${cg(`κ`)}${fg(`${cg(`d`)}${gg}`,`${cg(`d`)}${cg(`t`)}`)}${Q(`+`)}${ug(cg(`ω`))}${gg}${Q(`=`)}${cg(`η`)}${Q(`(`)}${cg(`t`)}${Q(`)`)}</mrow></math>`}function Cg(){let e=e=>$(`w`,e);return`<math display="block" aria-label="The public support function: a weighted sum of time in the villa, relatability, the positive attractiveness gap, couple duration, the man's time in the villa, an interaction term, and a stage intercept."><mrow>${$(`Φ`,`p`)}${Q(`(`)}${cg(`t`)}${Q(`)`)}${Q(`=`)}
    ${e(`1`)}${$(`T`,`f`)}${Q(`+`)}${e(`2`)}${$(`R`,`f`)}${Q(`+`)}${e(`3`)}${Q(`max`)}${Q(`{`)}${lg(`0`)}${Q(`,`)}${$(`D`,`p`)}${Q(`}`)}${Q(`+`)}${e(`4`)}${$(`T`,`couple`)}${Q(`+`)}${e(`5`)}${$(`T`,`m`)}${Q(`+`)}${e(`6`)}${$(`R`,`f`)}${Q(`max`)}${Q(`{`)}${lg(`0`)}${Q(`,`)}${$(`D`,`p`)}${Q(`}`)}${Q(`+`)}${$(`μ`,`stage`)}${Q(`(`)}${cg(`t`)}${Q(`)`)}</mrow></math>`}function wg(){return`<math display="block" aria-label="The Winner Index: public support on day 53 plus chi times the average love of both partners near the finale plus a small random term."><mrow>${$(`Ω`,`p`)}${Q(`=`)}${$(`Φ`,`p`)}${Q(`(`)}<mover>${cg(`t`)}${Q(`¯`)}</mover>${Q(`)`)}${Q(`+`)}${cg(`χ`)}${Q(`(`)}<mover>${gg}${Q(`¯`)}</mover>${Q(`+`)}<mover>${_g}${Q(`¯`)}</mover>${Q(`)`)}${Q(`+`)}${$(`ε`,`p`)}</mrow></math>`}var Tg=e=>`<mrow class="t-demo">${e}</mrow>`;function Eg(){let e=(e,t)=>`<mtr><mtd>${vg($(`x`,e))}</mtd><mtd>${Q(`=`)}${pg(`t-forget`,mg,$(`α`,e),$(`x`,e))}${Q(`+`)}${pg(`t-react`,Tg(cg(`c`)),$(`β`,e),$(`x`,t))}${Q(`+`)}${pg(`t-appeal`,Tg(cg(`c`)),$(`γ`,e),$(`A`,t),Tg(`${cg(`S`)}${Q(`(`)}${cg(`t`)}${Q(`)`)}`))}${Q(`+`)}${pg(`t-syn`,$(`d`,e),gg,_g)}</mtd></mtr>`;return`<math display="block" aria-label="The villa version of equations 1 and 2: the same four terms, with a contact factor c on reactiveness and appeal and an appeal multiplier S of t."><mtable columnalign="right left" columnspacing="0.5em" rowspacing="0.7em">${e(`m`,`f`)}${e(`f`,`m`)}</mtable></math>`}function Dg(){let e=`<msup>${cg(`e`)}${dg(mg,fg(dg(cg(`t`),mg,$(`t`,`k`)),cg(`τ`)))}</msup>`;return`<math display="block" aria-label="The appeal multiplier: S of t equals one, plus lambda times the couple's support above the villa average, plus the sum over vote pulses of s sub k times e to the minus t minus t sub k over tau."><mrow>${cg(`S`)}${Q(`(`)}${cg(`t`)}${Q(`)`)}${Q(`=`)}${lg(`1`)}${Q(`+`)}${cg(`λ`)}${Q(`(`)}${$(`Φ`,`p`)}${Q(`−`)}<mover>${cg(`Φ`)}${Q(`¯`)}</mover>${Q(`)`)}${Q(`+`)}<munder>${Q(`∑`)}${cg(`k`)}</munder>${$(`s`,`k`)}${e}</mrow></math>`}function Og(){return`<math display="block" aria-label="A pair's score at a recoupling: the man's love plus the woman's love, plus L if they are a couple now."><mrow>${hg(`score`)}${Q(`(`)}${cg(`m`)}${Q(`,`)}${cg(`f`)}${Q(`)`)}${Q(`=`)}${gg}${Q(`+`)}${_g}${Q(`+`)}${cg(`L`)}${Q(`·`)}${hg(`[couple now]`)}</mrow></math>`}var kg=[[`14`,`pages, revised August 25, 2026`],[`2`,`formal stability propositions`],[`53 days, 3 stages`,`the season the model covers`],[`5`,`observable covariates in the vote model`],[`3`,`psychology theories behind the vote function`]],Ag=[[`Couple dynamics`,`Two coupled equations per couple: forgetting, reactiveness, appeal, synergy.`],[`Stability`,`The Jacobian’s trace and determinant say when a couple settles.`],[`Early volatility`,`A damped oscillator adds early swings that fade over the season.`],[`Public vote`,`A support function over five visible covariates, in three stages.`],[`Winner index`,`Day 53 support plus late mutual affection and a random term; the top index wins.`]],jg=`<style>
.ex-terms dt i, .ex-sec h3 i { text-transform: none; }   /* the dt is set in uppercase mono, which turns alpha and beta into Latin A and B */
.explain .ex-body { overflow: visible; }   /* inline in the page, not in a dialog: let the contents row stick to the viewport */
#ex-glance, #ex10 { max-width: none; }
.ex-toc { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; overflow-x: auto; padding: 12px 0 12px; margin: 0 0 4px; background: var(--ground); border-bottom: 1px solid var(--hair-soft); scrollbar-width: none; scroll-snap-type: x proximity; }
.ex-toc::-webkit-scrollbar { display: none; }
.ex-toc .chip { flex: 0 0 auto; scroll-snap-align: start; }
.ex-sec { scroll-margin-top: 58px; }
.ex-sec .t-demo { color: var(--swing); }
.ex-sec .t-demo, .ex-key-demo { text-decoration: none; }
.ex-flow { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; margin: 14px 0 6px; padding: 0; list-style: none; counter-reset: none; }
.ex-flow li { position: relative; padding: 12px 14px 12px 0; border-top: 2px solid var(--a); }
.ex-flow li + li { padding-left: 14px; border-top-color: color-mix(in srgb, var(--a) 62%, transparent); }
.ex-flow li:nth-child(3) { border-top-color: var(--swing); } .ex-flow li:nth-child(4) { border-top-color: var(--vote); } .ex-flow li:nth-child(5) { border-top-color: var(--casa); }
.ex-flow li + li::before { content: ''; position: absolute; left: -1px; top: -6px; width: 9px; height: 9px; border-radius: 50%; background: var(--ground); border: 2px solid currentColor; color: var(--ink-faint); }
.ex-flow b { display: block; font: italic 400 22px/1.1 var(--voice); color: var(--ink); }
.ex-flow span { display: block; margin-top: 6px; font: 400 13.5px/1.4 var(--body); color: var(--ink-dim); }
.ex-legend { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 4px 0 10px; padding: 0; list-style: none; font: 500 10.5px/1.3 var(--mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); }
.ex-legend li { font: inherit; color: inherit; display: inline-flex; gap: 7px; align-items: center; }
.ex-legend i { display: inline-block; width: 14px; height: 0; border-top: 3px solid var(--ink); }
.ex-legend .l-react i { border-color: var(--vote); } .ex-legend .l-appeal i { border-color: var(--casa); } .ex-legend .l-syn i { border-color: var(--a); } .ex-legend .l-demo i { border-color: var(--swing); }
.ex-find { display: grid; gap: 0; margin: 10px 0 4px; padding: 0; list-style: none; }
.ex-find li { padding: 12px 0 12px 16px; border-left: 2px solid var(--hair); }
.ex-find li + li { margin-top: 6px; }
.ex-find li b { display: block; font: 600 17px/1.3 var(--body); color: var(--ink); margin-bottom: 2px; }
.ex-scen { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 22px; margin: 12px 0 6px; padding: 0; list-style: none; }
.ex-scen li { padding: 10px 0 4px; border-top: 2px solid var(--a); display: grid; gap: 3px; align-content: start; }
.ex-scen li[data-accent='vote'] { border-color: var(--vote); } .ex-scen li[data-accent='casa'] { border-color: var(--casa); } .ex-scen li[data-accent='swing'] { border-color: var(--swing); }
.ex-scen b { font: italic 400 22px/1.1 var(--voice); color: var(--ink); display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.ex-scen b kbd { font-style: normal; }
.ex-scen .tg { font: 500 10.5px/1.2 var(--mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); }
.ex-scen p { margin: 0; font-size: 14.5px; line-height: 1.5; }
.ex-scen .wt { color: var(--ink-faint); font-size: 13.5px; }
@media (max-width: 760px) { .ex-flow, .ex-scen { grid-template-columns: minmax(0, 1fr); } .ex-flow li, .ex-flow li + li { padding: 10px 0 10px 14px; border-top: 0; border-left: 2px solid var(--a); } .ex-flow li + li::before { display: none; } }
</style>`,Mg=e=>`onclick="document.getElementById('${e}')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})"`;function Ng(){let e=Bh.length;return[{id:`ex-glance`,nav:`At a glance`,title:`Five pieces, one season`,src:`paper 7`,html:`
    <p>The paper builds a season in layers. Each layer feeds the next, and the last one names a winner. This page has the same order.</p>
    <ol class="ex-flow">${Ag.map(([e,t])=>`<li><b>${e}</b><span>${t}</span></li>`).join(``)}</ol>`},{id:`ex1`,nav:`One couple`,title:`One couple, two equations`,src:`paper 2.2`,html:`
    <p>Each couple is one man and one woman. <i>x<sub>m</sub></i> is the love he feels for her and <i>x<sub>f</sub></i> the love she feels for him. The paper adapts the Rinaldi and Strogatz family of love-dynamics equations.</p>
    ${yg()}
    <dl class="ex-terms">
      <div class="t-forget"><dt>Forgetting <i>α</i></dt><dd>Affection fades on its own. A bigger <i>α</i> pulls love down.</dd></div>
      <div class="t-react"><dt>Reactiveness <i>β</i></dt><dd>Each partner responds to being loved by the other.</dd></div>
      <div class="t-appeal"><dt>Appeal <i>γ A</i></dt><dd><i>A</i> is the partner’s inherent appeal, and <i>γ</i> is how strongly the other responds to it.</dd></div>
      <div class="t-syn"><dt>Synergy <i>d</i></dt><dd>A nonlinear term: affection feeds on itself.</dd></div>
    </dl>
    <p class="ex-note"><b>In words.</b> Love falls by itself, rises when the other person loves back, rises when the other person is appealing, and speeds up when both are already in love. The phase portrait draws exactly this: two dashed curves where each love stops changing, and the resting state where they cross.</p>`},{id:`ex2`,nav:`Settling`,title:`When a couple settles`,src:`paper 2.3, Propositions 1 and 2`,html:`
    <p>With no synergy the system is linear and has one resting state, given in closed form.</p>
    ${bg()}
    <p>Whether a resting state holds is read from the Jacobian at that point. It is locally stable when the trace is negative and the determinant is positive.</p>
    ${xg()}
    <ul class="ex-list">
      <li><b>Proposition 1.</b> With no synergy and <i>α<sub>m</sub>α<sub>f</sub> &gt; β<sub>m</sub>β<sub>f</sub></i>, the resting state is locally asymptotically stable. Forgetting beats responding.</li>
      <li><b>Proposition 2.</b> With synergy and nonnegative resting levels, if <i>d<sub>m</sub>x<sub>f</sub>* + d<sub>f</sub>x<sub>m</sub>* &gt; α<sub>m</sub> + α<sub>f</sub></i> the trace is positive and that resting state cannot be stable. Strong enough synergy destabilizes an otherwise convergent relationship.</li>
    </ul>
    <p>In Love Island terms, the model allows both “settling down” and “runaway dynamics”. Try the <b>A couple that settles</b> and <b>Runaway synergy</b> scenarios side by side.</p>`},{id:`ex3`,nav:`Early swings`,title:`Early swings`,src:`paper 4`,html:`
    <p>Early episodes are volatile. The paper adds a damped oscillator to each love level, with damping that grows over time, so the swings are large at first and fade as a couple either stabilizes or dissolves.</p>
    ${Sg()}
    <p>Here <i>κ</i> grows with <i>t</i>, <i>ω</i> is a natural frequency of emotional swing, and <i>η(t)</i> is noise or a twist such as a bombshell. The paper has the swings rise again for three to four days around Casa Amor, near day 29. If <i>κ</i> stays too small, the couple may never reach a stable love equilibrium and will recouple or be voted off.</p>`},{id:`ex4`,nav:`The vote`,title:`The public vote`,src:`paper 3.1 and 3.2`,html:`
    <p>The audience is part of the system. A support function <i>Φ<sub>p</sub>(t)</i> adds five observable covariates, one interaction term and a stage intercept. When an elimination happens, the couples with the lowest support are dumped.</p>
    ${Cg()}
    <ul class="ex-list">
      <li><b>Time in the villa</b> for the woman <i>T<sub>f</sub></i> and the man <i>T<sub>m</sub></i>, and <b>couple duration</b> <i>T<sub>couple</sub></i>.</li>
      <li><b>Relatability</b> <i>R<sub>f</sub> = g(A<sub>f</sub>)</i>, nonnegative, bounded and decreasing in her appeal.</li>
      <li><b>Attractiveness gap</b> <i>D<sub>p</sub> = A<sub>m</sub> − A<sub>f</sub></i>, counted when positive, plus its interaction with relatability.</li>
    </ul>
    <p>The form rests on three established theories: Social Comparison Theory (Festinger, 1954), Self-Discrepancy Theory (Higgins, 1987) and Parasocial Relationships Theory (Horton and Wohl, 1956). The weights are ordered <i>w<sub>1</sub> &gt; w<sub>2</sub> &gt; w<sub>3</sub> &gt; w<sub>4</sub> &gt; w<sub>5</sub></i>. In the paper the vote is exogenous: it ranks couples and does not change how much they love each other.</p>`},{id:`ex5`,nav:`The winner`,title:`Three stages and a winner`,src:`paper 5 and 6`,html:`
    <div class="ex-stages">
      <div><b>Pre-Voting</b><span class="mono">Days 1 to 15</span><p>No public vote. Attraction drives first coupling, and the early swings are largest.</p></div>
      <div><b>Post-Voting</b><span class="mono">Days 16 to 35</span><p>Public votes begin. Casa Amor around day 29 brings new islanders and recoupling.</p></div>
      <div><b>Endgame</b><span class="mono">Days 36 to 53</span><p>Relationships approach equilibrium and the final eliminations decide the winner.</p></div>
    </div>
    <p>The stages meet in one number. The Winner Index adds public support on day 53, the average love of both partners over a short window near the finale, and a small random term. The couple with the highest index is predicted to win.</p>
    ${wg()}`},{id:`ex6`,nav:`A villa`,title:`From one couple to a villa`,src:`demo extension`,html:`
    <p>The paper models couples. A villa has many people who could be one, so this demo runs equations 1 and 2 for <b>every man and woman who are in the villa together</b> and adds two factors, shown in purple.</p>
    ${Eg()}
    <ul class="ex-legend" aria-hidden="true"><li class="l-forget"><i></i>forgetting</li><li class="l-react"><i></i>reactiveness</li><li class="l-appeal"><i></i>appeal</li><li class="l-syn"><i></i>synergy</li><li class="l-demo"><i></i>demo only</li></ul>
    <ul class="ex-list">
      <li><b>Contact <i>c</i>.</b> It is 1 for a couple, so a couple follows the paper’s system exactly. For two islanders who are not together it is the <b>Mixing</b> knob, below 1, so a rival attraction grows more slowly than a real couple’s love. Between the old villa and the Casa Amor arrivals, on days 29 to 32, it is the <b>Casa Amor pull</b>.</li>
      <li><b>Appeal multiplier <i>S(t)</i>.</b> 1 in the paper. Here it carries the vote’s reach into love, described next.</li>
      <li><b>First impressions.</b> A pair starts at 0.3 times the other’s appeal, because early coupling is driven by attractiveness (paper 5.1).</li>
    </ul>
    <p>At each recoupling (days ${Kp.join(`, `)}) every pair gets a score, the best mutual matches pair off, and anyone left without a partner leaves.</p>
    ${Og()}
    <p><i>L</i> is the <b>Loyalty</b> knob: the head start a current couple has over a rival pair. Low loyalty and strong contact is how a love triangle or a Casa Amor shake-up can break up couples; high loyalty keeps them together.</p>`},{id:`ex7`,nav:`Vote reach`,title:`How the vote reaches the couples`,src:`demo extension`,html:`
    <p>The vote enters in three ways. The first is the paper’s. The other two are this demo’s, and each has a knob.</p>
    <ul class="ex-list">
      <li><b>It ranks couples (paper).</b> On vote days, from day 18, the couple with the lowest support <i>Φ<sub>p</sub></i> is dumped, until 4 couples remain. Vote days: ${qp.join(`, `)}. The <b>Public vote weight</b> scales the six weights.</li>
      <li><b>Vote pulses (demo).</b> A vote you add, for or against a couple, adds a pulse <i>s<sub>k</sub></i> that fades with a time constant <i>τ</i> of 3 days, as in the earlier Love Island lab. Half the pulse also lands in that couple’s support.</li>
      <li><b>Vote feedback (demo, off by default).</b> With <i>λ</i> above zero, a couple whose support is above the villa average gets a bigger appeal term, so being loved by the audience makes them love each other more.</li>
    </ul>
    ${Dg()}
    <p>The multiplier is floored at 0.05 so a hostile vote cannot flip the sign of the appeal term. With <i>λ</i> = 0 and no pulses, <i>S</i> is 1 and the equations are the paper’s.</p>`},{id:`ex8`,nav:`Findings`,title:`What the paper finds`,src:`paper abstract and 2.3 to 6`,html:`
    <ul class="ex-find">
      <li><b>Couples can settle or run away.</b>With no synergy and forgetting stronger than responding, the resting state is stable. Strong enough synergy can destabilize an otherwise convergent relationship.</li>
      <li><b>Early volatility fades.</b>A damped oscillator with growing damping reproduces the pattern of large first-week swings that attenuate as couples stabilize or dissolve.</li>
      <li><b>Support follows time and the gap.</b>Public support strictly increases with time in the villa and couple duration, and with the attractiveness gap when that gap is positive, consistent with the hypothesis that the predominantly young, single, female audience favors aspirational pairings.</li>
      <li><b>One number ties the stages together.</b>The Winner Index adds day 53 support, average love near the finale and a random residual. The couple that maximizes it is predicted as the winner.</li>
    </ul>`},{id:`ex9`,nav:`Limits`,title:`What the paper does not claim`,src:`paper 8`,html:`
    <blockquote>This paper is theoretical: parameters are not estimated from data, weights are chosen for interpretability rather than calibration, and the model is meant for qualitative predictions (equilibria, stability regimes, and comparative statics) rather than point forecasts for specific seasons.</blockquote>
    <p>The same holds here. The weights, the stage intercepts, the relatability curve, the arrival days and the 25 islanders are illustrative; the paper’s season has about 33 contestants. Every number on this page is a <span class="sim">Simulation</span>. All names are invented, and no real contestant, couple or season is depicted.</p>`},{id:`ex10`,nav:`Try it`,title:`Scenarios and keys`,src:`${e} scenarios`,html:`
    <ul class="ex-scen">${Bh.map((e,t)=>`<li data-accent="${e.accent??`rose`}"><b>${e.label}${t<9?` <kbd>${t+1}</kbd>`:``}</b><span class="tg">${e.tag??``}</span><p>${e.line}</p>${e.watch?`<p class="wt">${e.watch}</p>`:``}</li>`).join(``)}</ul>
    <ul class="ex-keys">
      <li><kbd>Space</kbd> play or pause</li><li><kbd>←</kbd> <kbd>→</kbd> one day, with <kbd>Shift</kbd> five</li><li><kbd>[</kbd> <kbd>]</kbd> previous or next couple</li><li><kbd>1</kbd> to <kbd>${Math.min(9,e)}</kbd> scenarios</li>
      <li><kbd>V</kbd> villa or phase space</li><li><kbd>M</kbd> this guide</li><li>Click an islander in 3D to select their couple</li><li>Click or drag the timeline to jump to a day</li><li>Click the phase portrait to drop a path</li>
    </ul>`}]}function Pg(e){return Fg(e).replace(/<math /g,`<div class="ex-m"><math `).replace(/<\/math>/g,`</math></div>`)}function Fg(e){let t=Ng();return`
  ${jg}
  <div class="ex-head">
    <p class="mono ex-kicker">Reading guide <span class="sim">Simulation</span></p>
    <h2 id="exTitle" class="ex-title">The model</h2>
    <p class="ex-lede">Romantic Dynamics Under Public Selection, by Joseph Blumberg, revised August 25, 2026. A dynamical-systems model of Love Island with the public vote built in.</p>
    <ul class="ex-facts">${kg.map(([e,t])=>`<li><b>${e}</b><span>${t}</span></li>`).join(``)}</ul>
  </div>
  <div class="ex-body">
  <nav class="ex-toc" aria-label="Sections of this guide">${t.map(e=>`<button class="chip" type="button" ${Mg(e.id)}>${e.nav}</button>`).join(``)}</nav>
  ${t.map(e=>`<section class="ex-sec" id="${e.id}" aria-labelledby="${e.id}-h"><h3 id="${e.id}-h">${e.title} <small class="src">${e.src}</small></h3>${e.html}</section>`).join(`
  `)}
  </div>
  <div class="ex-foot">
    <a class="pill" href="${e}" target="_blank" rel="noopener">Read the full paper (PDF)</a>
    <p class="ex-credit">Builds on the Rinaldi and Strogatz family of love-dynamics models; the equations follow Satsangi and Sinha, Dynamics of Love and Happiness: A Mathematical Analysis (2012). Built with three.js and Anime.js (MIT). Fonts: Bodoni Moda, Instrument Serif, Archivo and IBM Plex Mono (SIL Open Font License).</p>
  </div>`}var Ig=[`alpha`,`beta`,`gamma`,`syn`,`mix`,`ca`,`loyalty`,`kappa`,`sigma`,`vw`,`chi`,`eps`,`lam`],Lg=e=>String(Math.round(e*1e4)/1e4);function Rg(e){let t=Vh(e);return{cfg:Hh(t.id),sel:t.focus??[3,14],t:t.t,view:t.view,fromUrl:!1}}function zg(e,t=!0){let n=Hh(e.cfg.preset),r=Vh(e.cfg.preset),i=new URLSearchParams;i.set(`s`,e.cfg.preset);for(let t of Ig)Math.abs(e.cfg[t]-n[t])>1e-6&&i.set(t,Lg(e.cfg[t]));e.cfg.seed!==n.seed&&i.set(`seed`,String(e.cfg.seed)),JSON.stringify(e.cfg.shocks)!==JSON.stringify(n.shocks)&&i.set(`sh`,e.cfg.shocks.map(e=>`${e.m}.${e.f}@${Lg(e.t)}:${Lg(e.s)}`).join(`;`)||`-`),JSON.stringify(e.cfg.over)!==JSON.stringify(n.over)&&i.set(`ov`,Object.entries(e.cfg.over).map(([e,t])=>`${e.replace(`-`,`.`)}:${Object.entries(t).map(([e,t])=>`${e}=${Lg(t)}`).join(`,`)}`).join(`;`)||`-`);let a=r.focus??[3,14];return(e.sel[0]!==a[0]||e.sel[1]!==a[1])&&i.set(`sel`,`${e.sel[0]}.${e.sel[1]}`),e.view!==r.view&&i.set(`v`,e.view),t&&i.set(`t`,Lg(e.t)),i.toString()}function Bg(e){let t=new URLSearchParams(e.replace(/^#/,``)),n=Rg(t.get(`s`)??Lh.preset),r=n.cfg;for(let e of Ig){let n=t.get(e);n!=null&&Number.isFinite(+n)&&(r[e]=+n)}let i=t.get(`seed`);i!=null&&Number.isFinite(+i)&&(r.seed=Math.floor(+i));let a=t.get(`sh`);a!=null&&(r.shocks=a===`-`?[]:a.split(`;`).map(e=>{let t=/^(\d+)\.(\d+)@([-\d.]+):([-\d.]+)$/.exec(e);return t?{m:+t[1],f:+t[2],t:+t[3],s:+t[4]}:null}).filter(e=>!!e));let o=t.get(`ov`);if(o!=null&&(r.over={},o!==`-`))for(let e of o.split(`;`)){let t=/^(\d+)\.(\d+):(.+)$/.exec(e);if(!t)continue;let n={};for(let e of t[3].split(`,`)){let[t,r]=e.split(`=`);Op.includes(t)&&Number.isFinite(+r)&&(n[t]=+r)}r.over[`${t[1]}-${t[2]}`]=n}let s=t.get(`sel`);if(s){let e=/^(\d+)\.(\d+)$/.exec(s);e&&(n.sel=[+e[1],+e[2]])}let c=t.get(`v`);(c===`villa`||c===`phase`)&&(n.view=c);let l=t.get(`t`);return l!=null&&Number.isFinite(+l)&&(n.t=Math.min(53,Math.max(1,+l)),n.fromUrl=!0),n}var Vg=e=>(String(e).split(`.`)[1]??``).length,Hg=e=>t=>t.toFixed(Vg(e.step)),Ug=e=>`
  <div class="knob" data-k="${e.k}">
    <div class="knob-dial"><div class="knob-cap"><i class="notch"></i></div></div>
    <div class="knob-out"></div>
    <div class="knob-name"><b>${e.short}</b>${e.label}</div>
  </div>`,Wg=e=>`
  <div class="dial-sl" data-k="${e.k}">
    <span class="sl-name"><b>${e.short}</b>${e.label}</span><span class="sl-out"></span>
    <div class="sl-rail"><div class="sl-line"></div><div class="sl-thumb"></div></div>
  </div>`;function Gg(){return`
<div class="app">
  <section class="hero" id="top" aria-label="Interactive villa">
    <div class="stage" id="stage">
      <canvas id="gl" role="img" aria-label="A 3D villa of 25 simulated islanders. Orbs are islanders, bright links are couples, and distance from the fire pit is public support."></canvas>
      <div class="tags" id="tags" aria-hidden="true"></div>
      <div class="shade" aria-hidden="true"></div>
    </div>

    <header class="ov ov-title" id="titleBlock">
      <p class="lab kick"><span class="sim">Simulation</span><span>Research demo</span></p>
      <h1 class="title">Love Island <em>Dynamics</em></h1>
      <p class="lede">Couples as coupled differential equations, with the public vote built in. Rinaldi and Strogatz love dynamics, extended to a whole villa.</p>
    </header>

    <div class="ov ov-tools">
      <a class="pill ghost embed-open" id="openFull" href="./" target="_blank" rel="noopener">Open the full demo</a>
      <div class="seg" id="viewSeg" role="group" aria-label="View">
        <i class="seg-ind" aria-hidden="true"></i>
        <button type="button" data-view="villa" aria-pressed="true">Villa</button>
        <button type="button" data-view="phase" aria-pressed="false">Phase space</button>
      </div>
      <button class="pill" id="btnShare" type="button">Share</button>
      <button class="pill ghost" id="btnModel" type="button">The model</button>
      <p class="viewcap" id="viewCap" aria-live="polite"></p>
    </div>

    <nav class="ov ov-presets" aria-label="Scenarios">
      <p class="lab">Scenario</p>
      <ol class="pre-list" id="presets">
        ${Bh.map((e,t)=>`<li><button class="pre" type="button" data-id="${e.id}" title="${e.line}" aria-pressed="false"><kbd>${t+1}</kbd><span>${e.label}</span></button></li>`).join(``)}
      </ol>
      <p class="pre-line" id="preLine" aria-live="polite"></p>
    </nav>

    <div class="ov ov-day" aria-label="Season clock">
      <div class="day">
        <p class="lab">Day <span class="sim">Simulation</span></p>
        <b id="dayNum">1</b><span class="lab of">of 53</span>
      </div>
      <p class="stagechip" id="stageChip"></p>
    </div>
    <div class="ov ov-tick"><p class="ticker" id="ticker" aria-live="off"></p></div>

    <div class="ov ov-right">
      <aside class="panel couple" id="couple" aria-label="Selected couple">
        <div class="ph">
          <p class="lab">Selected couple</p>
          <div class="row"><button class="icon sm" id="prevC" type="button" aria-label="Previous couple (key [)">&lsaquo;</button><button class="icon sm" id="nextC" type="button" aria-label="Next couple (key ])">&rsaquo;</button></div>
        </div>
        <p class="cp-n" id="cpNames" aria-live="polite"></p>
        <p class="cp-status lab" id="cpStatus"></p>
        <div class="gauges">
          <div class="g"><span class="lab" id="gmL">His love</span><b id="gmV">0.00</b><span class="gbar"><i id="gmB"></i></span></div>
          <div class="g"><span class="lab" id="gfL">Her love</span><b id="gfV">0.00</b><span class="gbar"><i id="gfB" class="w"></i></span></div>
          <div class="g"><span class="lab">Support</span><b id="gpV">n/a</b><span class="gbar"><i id="gpB" class="p"></i></span></div>
        </div>
        <div class="spark"><canvas id="spark" aria-hidden="true"></canvas></div>
        <div class="acts">
          <button class="chip" id="voteUp" type="button">Back them</button>
          <button class="chip" id="voteDn" type="button">Vote against</button>
          <button class="chip" id="voteClr" type="button" hidden>Clear votes</button>
        </div>
      </aside>
      <aside class="panel feed" aria-label="Live events">
        <div class="ph"><p class="lab">Live events</p><span class="lab dim" id="feedN"></span></div>
        <ol class="log" id="feed"></ol>
      </aside>
    </div>

    <div class="ov ov-bottom">
      <div class="transport" role="group" aria-label="Timeline">
        <button class="pill pri" id="play" type="button" aria-label="Play">Play</button>
        <div class="seg" id="speedSeg" role="group" aria-label="Speed">
          <button type="button" data-s="0" aria-pressed="false">1&times;</button><button type="button" data-s="1" aria-pressed="true">2&times;</button><button type="button" data-s="2" aria-pressed="false">4&times;</button>
        </div>
        <div class="scrub" id="scrub">
          <div class="sl-rail"><div class="sl-line"><div class="bands" id="bands"></div><div class="fill"></div><div class="marks" id="marks"></div></div><div class="sl-thumb"></div></div>
        </div>
        <p class="clock"><span class="lab">Day</span><b id="clock">1.0</b></p>
        <ul class="scrub-key" aria-label="Timeline key">
          <li><i class="key-cer"></i>Recoupling</li><li><i class="key-vote"></i>Public vote</li><li><i class="key-casa"></i>Casa Amor</li><li><i class="key-arr"></i>Arrival</li><li id="keyShock" hidden><i class="key-shock"></i>Your vote</li>
        </ul>
      </div>
      <div class="dock" id="dock">
        <div class="dock-head">
          <p class="lab">Villa dials</p>
          <p class="dock-hint" id="hint" aria-live="polite">Turn a dial or drag a handle. The whole villa runs again.</p>
          <button class="chip" id="reset" type="button" hidden>Reset scenario</button>
          <button class="chip" id="more" type="button" aria-expanded="false" aria-controls="moreDials">More dials</button>
        </div>
        <div class="bank" id="bank">${Rh.map(Ug).join(``)}</div>
        <div class="more" id="moreDials" hidden>${zh.map(Wg).join(``)}</div>
      </div>
    </div>
  </section>

  <section class="lower" id="lab" aria-label="Charts for the selected couple">
    <div class="lower-head">
      <h2 class="h2">The selected couple, in two dimensions</h2>
      <p class="lede">Every arrow is where the equations push this couple next. Click the portrait to drop a path and watch it settle, or run away.</p>
    </div>
    <div class="lower-grid">
      <section class="panel p-phase" aria-label="Phase portrait">
        <div class="ph"><p class="lab" id="phTitle">Phase portrait</p><div class="row"><button class="chip" id="clearProbes" type="button">Clear paths</button></div></div>
        <div class="cv"><canvas id="phase" tabindex="0" role="img" aria-label="Phase portrait of the selected couple. Arrow keys move a cross, Enter drops a path."></canvas></div>
        <ul class="legend"><li><i></i>His love, horizontal</li><li><i class="d"></i>Her love, vertical</li><li><i class="dot"></i>Resting state</li><li><i class="ring"></i>Unstable</li></ul>
        <div class="verdict" id="verdict" data-tone="good" aria-live="polite"><span class="v-word"></span><span class="v-kind lab"></span></div>
        <p class="detail" id="verdictDetail"></p>
      </section>
      <div class="col2">
        <section class="panel p-series" aria-label="Love over the season">
          <div class="ph"><p class="lab">Love over the season</p><span class="lab dim">Click to move the day</span></div>
          <div class="cv ts"><canvas id="series" aria-hidden="true"></canvas></div>
          <ul class="legend"><li><i class="r"></i>His love</li><li><i></i>Her love</li><li><i class="d"></i>Smooth path</li><li><i class="b"></i>Public support</li></ul>
        </section>
        <section class="panel p-stand" aria-label="Winner Index standings">
          <div class="ph"><p class="lab">Winner Index so far</p><span class="lab dim" id="standN"></span></div>
          <ol class="rows" id="stand"></ol>
          <ul class="legend"><li><i class="b"></i>Public support</li><li><i class="r"></i>Love near the finale</li><li><i class="v"></i>Luck</li></ul>
          <p class="note">The paper's Winner Index adds public support, recent love and a small random term. Click a row to select that couple.</p>
        </section>
      </div>
    </div>
  </section>

  <section class="explain" id="model" aria-labelledby="exTitle"></section>

  <footer class="foot">
    <p>Every figure on this page is a simulation. The 25 islanders are invented and no real contestant, couple or season is depicted. Parameters are illustrative, as the paper's own limitations say.</p>
    <p><a href="./paper.pdf" target="_blank" rel="noopener">Read the paper (PDF)</a></p>
  </footer>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <div class="tip" id="tip" aria-hidden="true"></div>
</div>`}var Kg=`#FF6A8A`,qg=`#EDE6D6`,Jg=class{cv;ctx;W=0;H=0;dpr=1;fit;run=null;p=0;t=1;mx=2;key=``;constructor(e){this.cv=e,this.ctx=e.getContext(`2d`),this.fit=rh(e,(e,t,n)=>{this.W=e,this.H=t,this.dpr=n,this.draw()})}set(e,t,n){let r=`${e.cfg.preset}|${t}|${e.cfg.seed}|${e.X.length}`;if(this.run=e,this.p=t,this.t=n,r!==this.key||this.measured!==e){this.key=r,this.measured=e;let n=2;for(let r=0;r<e.steps;r++){let i=(t*e.steps+r)*2;for(let t of[e.X[i]+e.U[i],e.X[i+1]+e.U[i+1]])Number.isFinite(t)&&t>n&&(n=t)}this.mx=Math.min(7,n*1.08)}this.draw()}measured=null;draw(){let{ctx:e,W:t,H:n,run:r}=this;if(!t||!r)return;e.setTransform(this.dpr,0,0,this.dpr,0,0),e.clearRect(0,0,t,n);let i=r.steps,a=this.p,o=this.mx,s=e=>(e-1)/52*(t-2)+1,c=e=>n-3-Math.min(o,Math.max(-.2,e))/o*(n-8),l=Math.max(0,Math.min(i-1,Math.round((this.t-1)/.1)));e.lineJoin=`round`,e.lineWidth=1.6;let u=(t,n)=>{for(let[o,u,d]of[[0,l,1],[l,i-1,.28]]){e.globalAlpha=d,e.strokeStyle=n,e.beginPath();let l=!1;for(let n=o;n<=u;n++){let o=(a*i+n)*2,u=r.X[o+t]+r.U[o+t];if(!Number.isFinite(u)){l=!1;continue}let d=s(mm(n)),f=c(u);l?e.lineTo(d,f):(e.moveTo(d,f),l=!0)}e.stroke()}e.globalAlpha=1};u(0,Kg),u(1,qg);let d=s(this.t);e.strokeStyle=`rgba(237,230,214,0.5)`,e.lineWidth=1,e.beginPath(),e.moveTo(d,0),e.lineTo(d,n),e.stroke();let f=(a*i+l)*2;for(let[t,n]of[[r.X[f]+r.U[f],Kg],[r.X[f+1]+r.U[f+1],qg]])Number.isFinite(t)&&(e.fillStyle=n,e.beginPath(),e.arc(d,c(t),3.2,0,6.2832),e.fill())}dispose(){this.fit.dispose()}},Yg={arrive:`Arrival`,couple:`Couple`,split:`Split`,vote:`Vote`,single:`Exit`,casa:`Casa Amor`,stage:`Stage`,final:`Finale`},Xg=class{host;count;onSeek;n=-1;evsRef=null;constructor(e,t,n){this.host=e,this.count=t,this.onSeek=n,e.addEventListener(`click`,e=>{let t=e.target.closest(`[data-t]`);t&&this.onSeek(+t.dataset.t)})}update(e,t){let n=0;for(;n<e.length&&e[n].t<=t+1e-6;)n++;if(n===this.n&&e===this.evsRef)return!1;let r=n>this.n&&e===this.evsRef;this.n=n,this.evsRef=e;let i=e.slice(Math.max(0,n-12),n).reverse();return this.host.innerHTML=i.length?i.map(e=>`<li><button type="button" class="ev k-${e.kind}" data-t="${e.t}"><b>Day ${Math.round(e.t)}</b><span>${e.text}</span><em class="lab">${Yg[e.kind]??``}</em></button></li>`).join(``):`<li class="empty">Nothing has happened yet. Press play.</li>`,this.count.textContent=`${n} of ${e.length}`,r}reset(){this.n=-1,this.evsRef=null}},Zg=class{host;count;onPick;rows=new Map;order=``;constructor(e,t,n){this.host=e,this.count=t,this.onPick=n,e.addEventListener(`click`,e=>{let t=e.target.closest(`[data-m]`);t&&this.onPick(+t.dataset.m,+t.dataset.f)})}reset(){this.host.innerHTML=``,this.rows.clear(),this.order=``}update(e,t,n){let r=gm(e,t);this.count.textContent=r.length?`${r.length} couples`:`no couples yet`;let i=new Set,a=Math.max(1.2,...r.map(e=>Math.max(0,e.phi)+Math.max(0,e.love)+Math.abs(e.eps)));r.forEach((t,r)=>{let o=`${t.m}.${t.f}`;i.add(o);let s=this.rows.get(o);if(!s){s=document.createElement(`li`),s.innerHTML=`<button class="rw" type="button" data-m="${t.m}" data-f="${t.f}"><span class="nm"><span class="a"></span><i>&amp;</i><span class="b"></span></span><span class="val"></span><span class="bar"><i class="p"></i><i class="l"></i><i class="e"></i></span></button>`;let n=s.querySelectorAll(`.nm span`);n[0].textContent=e.isl[t.m].name,n[1].textContent=e.isl[t.f].name,this.rows.set(o,s)}let c=s.firstElementChild,l=t.m===n[0]&&t.f===n[1];c.getAttribute(`aria-current`)===`true`!==l&&c.setAttribute(`aria-current`,String(l)),c.classList.toggle(`lead`,r===0);let u=c.querySelector(`.val`),d=t.total.toFixed(2);u.textContent!==d&&(u.textContent=d);let f=c.querySelectorAll(`.bar i`);f[0].style.width=`${Math.max(0,t.phi)/a*100}%`,f[1].style.width=`${Math.max(0,t.love)/a*100}%`,f[2].style.width=`${Math.abs(t.eps)/a*100}%`,f[2].classList.toggle(`neg`,t.eps<0)});for(let[e,t]of this.rows)i.has(e)||(t.remove(),this.rows.delete(e));let o=r.map(e=>`${e.m}.${e.f}`).join(`,`);if(o!==this.order){this.order=o;for(let e of r)this.host.appendChild(this.rows.get(`${e.m}.${e.f}`))}}},Qg=[1.5,3,6],$g=e=>(e-1)/52*100,e_={villa:`Distance from the fire pit is public support. Height is love. Bright links are couples.`,phase:`Floor: his love by her love. Height: public support. The bright path is the couple so far.`};function t_(e){let t=matchMedia(`(prefers-reduced-motion: reduce)`).matches,n=document.documentElement.classList.contains(`embed`);e.innerHTML=Gg();let r=t=>e.querySelector(t);n?(r(`#model`).remove(),e.querySelector(`.foot`)?.remove()):r(`#model`).innerHTML=Pg(`./paper.pdf`);let i=Bg(location.hash),a=fm(i.cfg),o=[],s=!t&&!i.fromUrl,c=1,l=-1,u=-1,d=-1,f=``,p=``,m=``,h=0,g=!1,_=-99,v=null,y=null,b=0,x=null,S={v:3},C=()=>{(!a.men.includes(i.sel[0])||!a.women.includes(i.sel[1]))&&(i.sel=Vh(i.cfg.preset).focus??[3,14])};C();let w=e=>a.isl[e].name,T=r(`#tip`),E=null;try{E=new th(r(`#gl`),r(`#tags`),{reduced:t,onWake:()=>z(),onPick:e=>V(e),onHover:(e,t,n)=>{if(e<0){T.classList.remove(`on`);return}let r=pm(a,i.t),o=a.N,s=a.isl[e],c=a.partner[r*o+e];T.innerHTML=`<b>${s.name}</b><span class="mono">Arrived day ${s.arrive}${c>=0?`, with ${w(c)}`:`, single now`}</span>`,T.style.transform=`translate(${Math.min(window.innerWidth-250,t+14)}px, ${n+14}px)`,T.classList.add(`on`)}}),E.setRun(a),i.view!==`villa`&&E.setView(i.view,!0)}catch{r(`#stage`).insertAdjacentHTML(`beforeend`,`<p class="gl-fallback">WebGL is not available here, so the 3D villa cannot draw. Every chart and control below still works.</p>`)}let D=new Jg(r(`#spark`)),O=new Ih(r(`#series`),e=>ee(e)),k=new Th(r(`#phase`),{reduced:t,onProbe:(e,t)=>{v&&(k.dropProbe(e,t,v),k.draw())}}),A=new Xg(r(`#feed`),r(`#feedN`),e=>ee(e)),j=new Zg(r(`#stand`),r(`#standN`),(e,t)=>ne([e,t])),M=r(`#toast`),N=0,P=e=>{M.textContent=e,M.classList.add(`on`),clearTimeout(N),N=window.setTimeout(()=>M.classList.remove(`on`),1900)},F=(e,t)=>{e.textContent!==t&&(e.textContent=t)},I=e=>`${location.origin}${location.pathname}#${zg(i,e)}`;function L(){m=`#`+zg(i,!s),history.replaceState(null,``,m),r(`#openFull`).href=I(!s)}function R(){clearTimeout(h),h=window.setTimeout(L,350)}let z=()=>{l=-1,E&&(E.dirty=!0)};function ee(e){i.t=Math.min(53,Math.max(1,e)),z(),R()}function B(e){e&&i.t>=52.99&&ee(1),s=e;let t=r(`#play`);t.textContent=e?`Pause`:i.t>=52.99?`Replay`:`Play`,t.setAttribute(`aria-label`,t.textContent),R()}let te=()=>B(!s);function ne(e){i.sel=e,k.clear(),z(),R()}function V(e){let t=pm(a,i.t),n=a.N,r=a.isl[e],o=a.partner[t*n+e];if(o<0){let i=-1/0;for(let s of r.sex===`M`?a.women:a.men){if(!a.here[t*n+s])continue;let[c,l]=r.sex===`M`?[e,s]:[s,e],u=(a.pidx(c,l)*a.steps+t)*2,d=a.X[u]+a.X[u+1];Number.isFinite(d)&&d>i&&(i=d,o=s)}}o>=0&&ne(r.sex===`M`?[e,o]:[o,e])}function H(e){let t=hm(a,pm(a,i.t));if(!t.length)return;let n=t[(t.findIndex(e=>e.m===i.sel[0]&&e.f===i.sel[1])+e+t.length*2)%t.length];ne([n.m,n.f])}let re=e=>`${e.m}.${e.f}@${e.t}:${e.s}`,ie=()=>{let e=new Set(Hh(i.cfg.preset).shocks.map(re));return i.cfg.shocks.filter(t=>!e.has(re(t)))};function ae(){let e=new Set(ie().map(re)),t=i.cfg.shocks.filter(e=>a.men.includes(e.m)&&a.women.includes(e.f)).map(t=>({t:t.t,kind:`vote`,a:t.m,b:t.f,text:`${e.has(re(t))?`You`:`The audience`} ${t.s>0?`back`:`vote against`} ${w(t.m)} and ${w(t.f)}.`}));o=[...a.events,...t].sort((e,t)=>e.t-t.t),A.reset()}function oe(){let e=(e,t,n)=>`<i class="mk ${e}" style="left:${$g(t)}%${n?`;width:${n}%`:``}"></i>`,t=[...new Set(a.isl.filter(e=>e.arrive>1).map(e=>e.arrive))];r(`#marks`).innerHTML=e(`casa`,29,$g(33)-$g(29))+Kp.map(t=>e(`cer`,t)).join(``)+qp.map(t=>e(`vote`,t)).join(``)+t.map(t=>e(`arr`,t)).join(``)+i.cfg.shocks.map(t=>e(`shock`,t.t)).join(``),r(`#keyShock`).hidden=!ie().length}r(`#bands`).innerHTML=Jp.map(e=>`<span class="band" style="left:${$g(e.a)}%;width:${$g(Math.min(53,e.b+1))-$g(e.a)}%">${e.name}</span>`).join(``);function se(){a=fm(i.cfg),C(),E?.setRun(a),ae(),oe(),j.reset(),_=-99,p=``,pe(),z(),R()}function ce(){g||(g=!0,requestAnimationFrame(()=>{g=!1,se()}))}let le=new Map,ue=r(`#hint`),de=(e,t)=>{i.cfg[e.k]=t,ce()},fe=(e,t)=>{let n=()=>{ue.textContent=`${e.label}: ${e.hint}`};t.addEventListener(`pointerenter`,n),t.addEventListener(`focusin`,n),t.addEventListener(`pointerdown`,n)};for(let e of Rh){let n=r(`.knob[data-k="${e.k}"]`);le.set(e.k,ag(n,{spec:e,value:i.cfg[e.k],label:e.label,fmt:Hg(e),reduced:t,onInput:t=>de(e,t)})),fe(e,n)}for(let e of zh){let n=r(`.dial-sl[data-k="${e.k}"]`);le.set(e.k,og(n,{spec:e,value:i.cfg[e.k],label:e.label,fmt:Hg(e),reduced:t,onInput:t=>de(e,t)})),fe(e,n)}r(`#more`).addEventListener(`click`,()=>{let e=r(`#moreDials`).hidden;r(`#moreDials`).hidden=!e,r(`#more`).setAttribute(`aria-expanded`,String(e)),r(`#more`).textContent=e?`Fewer dials`:`More dials`,requestAnimationFrame(()=>{for(let e of zh)le.get(e.k)?.show(i.cfg[e.k],!1)})});function pe(){let e=Vh(i.cfg.preset),t={...i,view:e.view,sel:e.focus??[3,14]};r(`#reset`).hidden=zg(t,!1)===`s=`+i.cfg.preset,r(`#voteClr`).hidden=!ie().length}r(`#reset`).addEventListener(`click`,()=>{W(Rg(i.cfg.preset)),P(`Scenario reset`)});let me=r(`#scrub`),U=!1,he=og(me,{spec:{min:1,max:53,step:.1},value:i.t,label:`Day`,fmt:e=>e.toFixed(1),reduced:t,keyMul:10,describe:e=>`Day ${e.toFixed(1)}, ${Jp[Yp(e)-1].name}`,onInput:e=>{U||ee(e)}});me.querySelector(`.sl-rail`).addEventListener(`pointerdown`,e=>{let t=e;if(t.target.closest(`.sl-thumb`))return;let n=t.currentTarget.getBoundingClientRect();ee(1+Math.min(1,Math.max(0,(t.clientX-n.left-22)/Math.max(1,n.width-44)))*52)}),r(`#play`).addEventListener(`click`,te),r(`#speedSeg`).addEventListener(`click`,t=>{let n=t.target.closest(`[data-s]`);n&&(c=+n.dataset.s,e.querySelectorAll(`#speedSeg button`).forEach(e=>e.setAttribute(`aria-pressed`,String(e===n))))});function ge(n,a=!1){i.view=n,E?.setView(n,a),e.querySelectorAll(`#viewSeg button`).forEach(e=>e.setAttribute(`aria-pressed`,String(e.dataset.view===n))),r(`#viewSeg`).style.setProperty(`--i`,n===`villa`?`0`:`1`);let o=r(`#viewCap`);F(o,e_[n]),!t&&!a&&en(o,{opacity:[0,1],translateY:[6,0],duration:500,ease:`out(3)`}),R()}r(`#viewSeg`).addEventListener(`click`,e=>{let t=e.target.closest(`[data-view]`);t&&ge(t.dataset.view)});let _e=()=>ge(i.view===`villa`?`phase`:`villa`);function W(e){i=e,i.fromUrl&&(s=!1),a=fm(i.cfg),C(),E?.setRun(a);for(let e of[...Rh,...zh])le.get(e.k)?.show(i.cfg[e.k],!t);ae(),oe(),j.reset(),_=-99,p=``,k.clear(),b=0,ge(i.view),ve(),pe(),B(s),z(),L()}function ve(){e.querySelectorAll(`#presets .pre`).forEach(e=>e.setAttribute(`aria-pressed`,String(e.dataset.id===i.cfg.preset))),F(r(`#preLine`),Vh(i.cfg.preset).line)}let G=e=>{W(Rg(e));let t=Vh(e);P(`${t.label}`)};r(`#presets`).addEventListener(`click`,e=>{let t=e.target.closest(`[data-id]`);t&&G(t.dataset.id)});let K=e=>{let[t,n]=i.sel;i.cfg.shocks=[...i.cfg.shocks,{m:t,f:n,t:Math.round(i.t*10)/10,s:e*1.6}].slice(-8),se(),P(`${e>0?`Backed`:`Voted against`} ${w(t)} and ${w(n)}`)};r(`#voteUp`).addEventListener(`click`,()=>K(1)),r(`#voteDn`).addEventListener(`click`,()=>K(-1)),r(`#voteClr`).addEventListener(`click`,()=>{i.cfg.shocks=structuredClone(Hh(i.cfg.preset).shocks),se(),P(`Your votes are cleared`)}),r(`#prevC`).addEventListener(`click`,()=>H(-1)),r(`#nextC`).addEventListener(`click`,()=>H(1)),r(`#clearProbes`).addEventListener(`click`,()=>k.clear()),r(`#btnShare`).addEventListener(`click`,async()=>{let e=I(!0);try{await navigator.clipboard.writeText(e),P(`Link copied`)}catch{let t=document.createElement(`textarea`);t.value=e,t.style.position=`fixed`,t.style.opacity=`0`,document.body.appendChild(t),t.select();try{document.execCommand(`copy`),P(`Link copied`)}catch{P(`Copy the address bar to share`)}t.remove()}});let ye=()=>{let n=e.querySelector(`#model`);n&&n.scrollIntoView({behavior:t?`auto`:`smooth`})};r(`#btnModel`).addEventListener(`click`,ye),document.addEventListener(`keydown`,e=>{if(e.metaKey||e.ctrlKey||e.altKey)return;let t=e.target;if(t.closest(`input,textarea,select,[contenteditable="true"]`))return;let n=t.getAttribute(`role`)===`slider`||t.id===`phase`;if(e.key===` `){if(t.closest(`button,a`)||t.id===`phase`)return;e.preventDefault(),te()}else if(e.key===`ArrowLeft`||e.key===`ArrowRight`){if(n)return;e.preventDefault(),ee(i.t+(e.key===`ArrowRight`?1:-1)*(e.shiftKey?5:1))}else e.key===`v`||e.key===`V`?_e():e.key===`m`||e.key===`M`?ye():e.key===`[`?H(-1):e.key===`]`?H(1):/^[1-9]$/.test(e.key)&&Bh[e.key-1]&&G(Bh[e.key-1].id)}),window.addEventListener(`hashchange`,()=>{location.hash!==m&&W(Bg(location.hash))});let q=r(`#dayNum`),J=r(`#ticker`);function be(e){let[t,n]=i.sel,r=a.pidx(t,n),o=a.steps,s=a.N,c=[];for(let t=0;t<=e;t++){let e=(r*o+t)*2,n=a.X[e],i=a.X[e+1];Number.isFinite(n)&&Number.isFinite(i)&&c.push([n,i])}let l=c.length?c[c.length-1]:null,u=null;if(l){let t=e;for(;t>0&&!Number.isFinite(a.X[(r*o+t)*2]);)t--;let n=(r*o+t)*2;u=[a.X[n]+a.U[n],a.X[n+1]+a.U[n+1]]}let d=a.CONTACT[r*o+e],f=kp(am(i.cfg,a.isl[t],a.isl[n]),Number.isFinite(d)?d:1),p=0;for(let[e,t]of c)p=Math.max(p,e,t);let m=Math.max(3,Math.ceil(p*1.15*2)/2);return{par:f,trail:c,head:l,obs:u,hi:m,coupled:a.partner[e*s+t]===n,away:a.firstAway[r]<=i.t}}function xe(e,t){let[n,o]=i.sel,s=a.isl[n],c=a.isl[o],l=a.pidx(n,o),u=a.steps,d=a.N,f=`${n}.${o}.${a.isl.length}`;f!==p&&(p=f,r(`#cpNames`).innerHTML=`<span class="m">${s.name}</span><i>&amp;</i><span class="f">${c.name}</span>`,F(r(`#gmL`),`${s.name}'s love`),F(r(`#gfL`),`${c.name}'s love`),F(r(`#phTitle`),`Phase portrait: ${s.name} and ${c.name}`));let m=e;for(;m>0&&!Number.isFinite(a.X[(l*u+m)*2]);)m--;let h=(l*u+m)*2,g=Number.isFinite(a.X[h]),_=g?a.X[h]+a.U[h]:NaN,v=g?a.X[h+1]+a.U[h+1]:NaN,y=a.PHI[l*u+e],b;if(!g)b=`Arrives on day ${Math.max(s.arrive,c.arrive)}`;else if(m<e){let e=a.exit[n]<a.exit[o]?n:o;b=`${w(e)} left on day ${Math.round(a.exit[e])}${a.exitKind[e]===`vote`?` by public vote`:` at a recoupling`}`}else b=a.partner[e*d+n]===o?`Couple since day ${Math.round(a.since[e*d+n])}`:`In the villa, not a couple now`;F(r(`#cpStatus`),b);let x=e=>Number.isFinite(e)?e.toFixed(2):`n/a`;F(r(`#gmV`),x(_)),F(r(`#gfV`),x(v)),F(r(`#gpV`),x(y));let S=(e,t)=>Math.min(1,Math.max(0,(Number.isFinite(e)?e:0)/t)).toFixed(3);r(`#gmB`).style.setProperty(`--v`,S(_,4)),r(`#gfB`).style.setProperty(`--v`,S(v,4)),r(`#gpB`).style.setProperty(`--v`,S(y,3)),D.set(a,l,i.t);let C=Ip(t),T=C.filter(e=>e.stable),E=a.firstAway[l]<=i.t,O=E?`bad`:T.length?`good`:`warn`,k=E?`Runs away`:T.length?`Settles`:`No resting state`,A=r(`#verdict`);A.dataset.tone!==O&&(A.dataset.tone=O),F(A.querySelector(`.v-word`),k);let j=T[0];F(A.querySelector(`.v-kind`),j?j.kind:E?`left the plane`:C[0]?C[0].kind:`none in range`),F(r(`#verdictDetail`),E?`Synergy is strong enough that the path left the plane. Affection grows without limit (Proposition 2).`:j?`It heads for a resting state near (${j.xm.toFixed(2)}, ${j.xf.toFixed(2)}). The trace is ${j.tr.toFixed(2)} and the determinant ${j.det.toFixed(2)}, so small swings die out.`:`Responding to each other outweighs forgetting, so affection keeps growing instead of settling.`)}function Se(e){let n=i.t,c=Math.floor(n+1e-6);c!==u&&(u=c,F(q,String(c)),!t&&s&&en(q,{translateY:[-10,0],opacity:[.45,1],duration:360,ease:`out(3)`}));let d=hm(a,e),p=0;for(let t=0;t<a.N;t++)p+=a.here[e*a.N+t];let m=r(`#stageChip`),h=n>=29&&n<33;F(m,`${Jp[Yp(n)-1].name}${h?`, Casa Amor`:``}: ${d.length} couples, ${p} islanders`),m.dataset.casa=h?`1`:`0`,F(r(`#clock`),n.toFixed(1));let g=0;for(;g<o.length&&o[g].t<=n+1e-6;)g++;let C=g?o[g-1].text:`Ten islanders walk into the villa.`;if(C!==f&&(f=C,J.textContent=C,t||en(J,{opacity:[0,1],translateX:[-10,0],duration:520,ease:`out(3)`})),A.update(o,n)&&!t){let e=r(`#feed`).firstElementChild;e&&en(e,{opacity:[0,1],translateY:[-12,0],duration:420,ease:`out(3)`})}let w=be(e);y=w,v=w.par,w.hi!==b&&(b||(S.v=w.hi),b=w.hi,x?.cancel(),x=sg(S,w.hi,t,600,.1,()=>{y&&(k.set(y,S.v),k.draw())})),k.set(w,S.v),k.draw(),O.set(a,a.pidx(i.sel[0],i.sel[1]),n),xe(e,w.par),(Math.abs(e-_)>=2||l===-1)&&(_=e,j.update(a,e,i.sel)),l=e}let Ce=r(`#gl`),we=-99;function Te(){if(!E)return;let t=Ce.getBoundingClientRect(),n=[];e.querySelectorAll(`.ov-title, .ov-tools, .ov-presets, .ov-day, .ov-tick, .couple, .feed, .ov-bottom`).forEach(e=>{let r=e.getBoundingClientRect();r.width<8||r.height<8||getComputedStyle(e).display===`none`||n.push([r.left-t.left-6,r.top-t.top-6,r.right-t.left+6,r.bottom-t.top+6])}),E.avoid=n}window.addEventListener(`resize`,()=>{we=-99});let Ee=performance.now(),De=!0,Oe=0;new IntersectionObserver(e=>{De=e[0].isIntersecting},{threshold:0}).observe(r(`#top`));function ke(e){Oe=requestAnimationFrame(ke);let t=Math.min(.1,(e-Ee)/1e3);if(Ee=e,document.hidden)return;s&&(i.t+=t*Qg[c],i.t>=53&&(i.t=53,B(!1))),e-we>400&&(we=e,Te());let n=pm(a,i.t);if(n!==l&&Se(n),i.t!==d&&!me.classList.contains(`is-drag`)&&(d=i.t,U=!0,he.show(i.t,!1),U=!1),De&&E){let r={run:a,k:n,t:i.t,time:e/1e3,dt:t,sel:i.sel};E.frame(r,s)}k.animating&&k.draw()}ae(),oe(),ve(),pe(),ge(i.view,!0),B(s),L(),t||en(e.querySelectorAll(`.hero .ov`),{opacity:[0,1],translateY:[16,0],duration:700,delay:Sn(90,{start:120}),ease:`out(3)`}),Oe=requestAnimationFrame(ke),window.addEventListener(`pagehide`,()=>{cancelAnimationFrame(Oe),E?.dispose()}),n&&window.parent!==window&&(window.addEventListener(`message`,e=>{if(e.source!==window.parent||e.origin!==location.origin)return;let t=e.data;t&&t.type===`li:site`&&t.paused===!0&&s&&B(!1)}),window.parent.postMessage({type:`li:ready`},location.origin)),window.__li={get st(){return i},get run(){return a},stage:E,seek:ee,setPlaying:B,applyPreset:G}}t_(document.getElementById(`app`));