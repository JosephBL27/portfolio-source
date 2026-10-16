// Photographic hall regression checks. Run with the project's dev server on 5490.
// Uses one shared-lock browser; every browser closes in finally.
import {withBrowser} from '../lib/browser.mjs';
import fs from 'node:fs';
const out='out/hall-rebuild';fs.mkdirSync(out,{recursive:true}); const errs=[];const report={};
await withBrowser(async b=>{
 const p=await b.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto('http://localhost:5490/?gate=0&hall=capture',{waitUntil:'load'});await p.waitForFunction(()=>window.__v3?.goto,{timeout:60000});
 const hall=async()=>p.evaluate(async()=>{const f=await import('/src/v3/world/flight.ts'),l=await import('/src/v3/world/layout.ts');const at=f.waypointP(l.WAYPOINTS.findIndex(w=>w.id==='hall'));window.__v3.goto(null);window.__v3.ui.nav.go('hall');window.__v3.follower.snap(at);document.getElementById('loader')?.remove()});
 await hall();await p.waitForFunction(()=>window.__hallCapture?.state().loaded==='8k',{timeout:45000});await p.waitForTimeout(1200);
 await p.screenshot({path:out+'/after-desktop.png'});report.desktop=await p.evaluate(()=>window.__hallCapture.state());
 for (const [name,yaw] of [['right',90],['back',180],['left',270]]) {await p.evaluate(y=>window.__hallCapture.look(y),yaw);await p.waitForTimeout(700);await p.screenshot({path:out+'/after-'+name+'.png'});}
 await p.evaluate(()=>window.__hallCapture.look(0));await p.waitForTimeout(700);
 report.overflow=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,buttons:[...document.querySelectorAll('.hc-portals button')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})}));
 for(let i=0;i<5;i++){await hall();await p.waitForTimeout(2200);await p.locator(`[data-portal="${i}"]`).click();await p.waitForTimeout(2200);report['portal'+i]=await p.evaluate(()=>({wp:window.__v3.state().wp,capture:window.__hallCapture.state()}));}
 await p.close();
 for(const [name,opts] of [['mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],['reduced',{viewport:{width:1440,height:900},reducedMotion:'reduce'}]]){
  const q=await b.newPage(opts);q.on('pageerror',e=>errs.push(name+': '+e.message));
  await q.goto('http://localhost:5490/?gate=0&hall=capture',{waitUntil:'load'});await q.waitForFunction(()=>window.__v3?.goto,{timeout:60000});
  await q.evaluate(async()=>{const f=await import('/src/v3/world/flight.ts'),l=await import('/src/v3/world/layout.ts');window.__v3.goto(f.waypointP(l.WAYPOINTS.findIndex(w=>w.id==='hall')));document.getElementById('loader')?.remove()});
  await q.waitForFunction(()=>window.__hallCapture?.state().status==='ready',{timeout:45000});await q.waitForTimeout(1500);
  await q.screenshot({path:out+'/after-'+name+'.png'});report[name]=await q.evaluate(()=>({capture:window.__hallCapture.state(),scroll:document.documentElement.scrollWidth,width:innerWidth,buttons:[...document.querySelectorAll('.hc-portals button')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})}));
  await q.close();
 }
});report.errors=errs;fs.writeFileSync(out+'/inspection.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
