// Photographic hall regression checks. Run with the project's dev server on 5490.
// Uses one shared-lock browser; every browser closes in finally.
import {withBrowser} from '../lib/browser.mjs';import fs from 'node:fs';
const out='out/hall-rebuild';fs.mkdirSync(out,{recursive:true});const report={};const errs=[];const ok=(name,v,info)=>{report[name]={pass:!!v,info};console.log(name,!!v,info)};
await withBrowser(async b=>{
const p=await b.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:5490/?gate=0&hall=capture');await p.waitForFunction(()=>window.__v3?.goto);
const hall=async()=>{await p.evaluate(async()=>{window.__v3.goto(null);window.__v3.ui.nav.go('hall');const f=await import('/src/v3/world/flight.ts');window.__v3.follower.snap(f.waypointP(f.waypointIndex('hall')))});await p.waitForFunction(()=>window.__hallCapture?.state().active&&window.__hallCapture.state().status==='ready');await p.waitForTimeout(700)};
await hall();await p.mouse.move(950,450);await p.mouse.down();await p.mouse.move(120,450,{steps:30});await p.mouse.up();await p.waitForTimeout(500);let a=await p.evaluate(()=>window.__hallCapture.state().yaw);await p.waitForTimeout(1800);let c=await p.evaluate(()=>window.__hallCapture.state().yaw);ok('drag persists',Math.abs(a)>60&&Math.abs(c-a)<2,{a,c});
await p.keyboard.press('ArrowRight');await p.waitForTimeout(500);let k=await p.evaluate(()=>window.__hallCapture.state().yaw);ok('keyboard look',k>c+10,k);await p.getByRole('button',{name:'Centre view',exact:true}).click();await p.waitForTimeout(700);ok('centre',Math.abs(await p.evaluate(()=>window.__hallCapture.state().yaw))<.1);
await p.evaluate(()=>window.__hallCapture.look(370));await p.waitForTimeout(700);ok('360 yaw',Math.abs((await p.evaluate(()=>window.__hallCapture.state().yaw))-370)<.1);
await p.evaluate(()=>window.__hallCapture.look(0));await p.waitForTimeout(700);await p.mouse.click(750,460);await p.waitForTimeout(2200);ok('photographed window click',await p.evaluate(()=>window.__v3.state().wp===24),await p.evaluate(()=>({wp:window.__v3.state().wp,hash:location.hash})));
await hall();await p.locator('[data-portal="3"]').focus();await p.keyboard.press('Enter');await p.waitForTimeout(2200);ok('keyboard portal',await p.evaluate(()=>window.__v3.state().wp===25),await p.evaluate(()=>window.__v3.state().wp));
await p.close();
for(const [name,pattern] of [['fallback','**/*-4k.webp'],['failure','**/media/hall/*.webp']]){
 const q=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await q.route(pattern,r=>r.abort());await q.goto('http://localhost:5490/?gate=0&hall=capture');await q.waitForFunction(()=>window.__v3?.goto);await q.evaluate(()=>window.__v3.ui.nav.go('hall'));await q.waitForFunction(()=>['ready','failed'].includes(window.__hallCapture?.state().status));await q.waitForTimeout(1200);
 const s=await q.evaluate(()=>window.__hallCapture.state());ok(name,name==='fallback'?s.loaded==='2k':s.status==='failed',s);
 if(name==='failure'){await q.screenshot({path:out+'/failure.png'});ok('retry visible',await q.getByRole('button',{name:'Reload hall'}).isVisible());await q.unroute(pattern);await q.getByRole('button',{name:'Reload hall'}).click();await q.waitForFunction(()=>window.__hallCapture.state().status==='ready');ok('retry recovered',true,await q.evaluate(()=>window.__hallCapture.state().loaded));}
 await q.close();
}
const q=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await q.goto('http://localhost:5490/?gate=0&hall=capture');await q.waitForFunction(()=>window.__v3?.goto);await q.evaluate(()=>window.__v3.ui.nav.go('hall'));await q.waitForFunction(()=>window.__hallCapture?.state().active&&window.__hallCapture.state().status==='ready');await q.waitForTimeout(1000);
const t1=await q.locator('.hc-portal-inner').first().evaluate(e=>getComputedStyle(e).transform);await q.waitForTimeout(700);const t2=await q.locator('.hc-portal-inner').first().evaluate(e=>getComputedStyle(e).transform);ok('reduced motion static',t1===t2,{t1,t2});await q.touchscreen.tap(180,450);await q.waitForTimeout(900);ok('touch window',await q.evaluate(()=>window.__v3.state().wp===24),await q.evaluate(()=>window.__v3.state().wp));await q.close();
});report.errors=errs;fs.writeFileSync(out+'/behavior.json',JSON.stringify(report,null,2));if(Object.values(report).some(x=>x?.pass===false)||errs.length)process.exitCode=1;
