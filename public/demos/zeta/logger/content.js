
(() => {
  if (window.__zetaTrialLoggerLoaded) return;
  window.__zetaTrialLoggerLoaded = true;

  const state = {
    records: [],
    current: null,
    observing: false,
    trialStartedAt: null,
    lastProblemText: "",
    answerEl: null,
    problemEl: null,
    observer: null,
    poll: null,
    settingsSnapshot: null,
  };

  const now = () => performance.now();

  function median(xs) {
    if (!xs.length) return null;
    const a = [...xs].sort((x,y)=>x-y);
    const m = Math.floor(a.length/2);
    return a.length % 2 ? a[m] : (a[m-1]+a[m])/2;
  }
  function percentile(xs,p) {
    if (!xs.length) return null;
    const a=[...xs].sort((x,y)=>x-y);
    const i=Math.min(a.length-1, Math.max(0, Math.ceil(p*a.length)-1));
    return a[i];
  }
  function bucket(n) {
    n=Math.abs(Number(n));
    if (n <= 30) return "2-30";
    if (n <= 50) return "31-50";
    if (n <= 75) return "51-75";
    if (n <= 100) return "76-100";
    return "100+";
  }
  function parseProblem(text) {
    const t = String(text || "")
      .replace(/\u2212|\u2013|\u2014/g, "-")
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/\s+/g, " ")
      .trim();
    const m = t.match(/(-?\d+)\s*([+\-*/])\s*(-?\d+)/);
    if (!m) return {raw: String(text||"").trim(), parsed:false};
    const a=Number(m[1]), op=m[2], b=Number(m[3]);
    let answer=null;
    if(op==="+") answer=a+b;
    else if(op==="-") answer=a-b;
    else if(op==="*") answer=a*b;
    else if(op==="/") answer=b!==0 ? a/b : null;
    const symbol = op==="*" ? "×" : op==="/" ? "÷" : op;
    const out={raw:String(text||"").trim(),parsed:true,a,b,op:symbol,answer};
    if(symbol==="+"){
      out.family = ((Math.abs(a)%10)+(Math.abs(b)%10)>=10) ? "addition:carry-ones" : "addition:no-carry-ones";
      out.magnitude = bucket(Math.max(Math.abs(a),Math.abs(b)));
    } else if(symbol==="-"){
      out.family = ((Math.abs(a)%10)<(Math.abs(b)%10)) ? "subtraction:borrow-ones" : "subtraction:no-borrow-ones";
      out.magnitude = bucket(Math.max(Math.abs(a),Math.abs(b)));
      out.subtrahendOnes = Math.abs(b)%10;
    } else if(symbol==="×"){
      let small=null, large=null;
      if(Math.abs(a)<=12){small=Math.abs(a);large=Math.abs(b);}
      else if(Math.abs(b)<=12){small=Math.abs(b);large=Math.abs(a);}
      else {small=Math.min(Math.abs(a),Math.abs(b));large=Math.max(Math.abs(a),Math.abs(b));}
      out.smallFactor=small; out.largeOperand=large; out.magnitude=bucket(large);
      out.family=`multiplication:x${small}`;
    } else if(symbol==="÷"){
      out.divisor=Math.abs(b);
      out.quotient=answer;
      out.magnitude=bucket(Math.abs(answer));
      out.family=`division:by${Math.abs(b)}`;
    }
    return out;
  }


  function snapshotSettings() {
    const controls = [...document.querySelectorAll("input, select")].map((el, idx) => ({
      index: idx,
      tag: el.tagName.toLowerCase(),
      type: el.type || null,
      name: el.name || null,
      id: el.id || null,
      value: el.value,
      checked: typeof el.checked === "boolean" ? el.checked : null,
      ariaLabel: el.getAttribute("aria-label"),
      nearbyText: (el.parentElement ? el.parentElement.innerText : "").trim().replace(/\s+/g," ").slice(0,160)
    }));
    return {
      url: location.href,
      title: document.title,
      controls
    };
  }

  function observedRanges() {
    const by = {};
    for (const r of state.records) {
      if (!r.parsed) continue;
      const key = r.op;
      if (!by[key]) by[key] = {a:[], b:[], answers:[]};
      by[key].a.push(r.a); by[key].b.push(r.b);
      if (Number.isFinite(r.answer)) by[key].answers.push(r.answer);
    }
    const out = {};
    for (const [op,g] of Object.entries(by)) {
      const mm = xs => xs.length ? {min:Math.min(...xs), max:Math.max(...xs)} : null;
      out[op] = {leftObserved:mm(g.a), rightObserved:mm(g.b), answerObserved:mm(g.answers), n:g.a.length};
    }
    return out;
  }

  function finalizeCurrent(endTime) {
    if (!state.current) return;
    const r=state.current;
    const total=endTime-r.shownAt;
    if (total < 40) return; // discard impossible/duplicate mutation
    r.totalMs=Math.round(total);
    r.firstKeyMs=r.firstKeyAt == null ? null : Math.round(r.firstKeyAt-r.shownAt);
    r.typingMs=r.firstKeyAt == null ? null : Math.max(0, Math.round(endTime-r.firstKeyAt));
    delete r.shownAt; delete r.firstKeyAt;
    state.records.push(r);
    state.current=null;
    render();
  }

  function onNewProblem(text) {
    const clean=String(text||"").trim();
    if(!clean || clean===state.lastProblemText) return;
    const t=now();
    finalizeCurrent(t);
    if(!state.trialStartedAt) {
      state.trialStartedAt=t;
      state.settingsSnapshot=snapshotSettings();
    }
    state.lastProblemText=clean;
    state.current={
      i:state.records.length+1,
      ...parseProblem(clean),
      shownAt:t,
      firstKeyAt:null,
      backspaces:0,
      digitKeys:0
    };
    render();
  }

  function attachAnswer(el) {
    if(state.answerEl===el) return;
    state.answerEl=el;
    el.addEventListener("keydown",(e)=>{
      if(!state.current) return;
      if(/^[0-9-]$/.test(e.key)){
        if(state.current.firstKeyAt==null) state.current.firstKeyAt=now();
        state.current.digitKeys++;
      }
      if(e.key==="Backspace" || e.key==="Delete") state.current.backspaces++;
    }, true);
  }

  function watch() {
    const p=document.querySelector(".problem");
    const a=document.querySelector(".answer");
    if(a) attachAnswer(a);
    if(p && p!==state.problemEl){
      if(state.observer) state.observer.disconnect();
      state.problemEl=p;
      state.observer=new MutationObserver(()=>onNewProblem(p.innerText || p.textContent));
      state.observer.observe(p,{subtree:true,characterData:true,childList:true});
      state.observing=true;
      onNewProblem(p.innerText || p.textContent);
    } else if(p) {
      onNewProblem(p.innerText || p.textContent);
    }
  }

  function groupSummary(keyFn) {
    const groups={};
    for(const r of state.records){
      const k=keyFn(r);
      if(!k) continue;
      (groups[k] ||= []).push(r.totalMs);
    }
    return Object.entries(groups).map(([name,xs])=>({
      name,n:xs.length,medianMs:Math.round(median(xs)),p90Ms:Math.round(percentile(xs,.9))
    })).sort((a,b)=>b.medianMs-a.medianMs);
  }

  function exportData() {
    const ended=now();
    // Don't finalize a current question unless Zetamac has advanced; unfinished final problem is intentionally excluded.
    const totals=state.records.map(r=>r.totalMs);
    const thinking=state.records.filter(r=>r.firstKeyMs!=null).map(r=>r.firstKeyMs);
    return {
      format:"zetamac-trial-log-v1",
      capturedAt:new Date().toISOString(),
      source:location.href,
      settingsSnapshot:state.settingsSnapshot,
      observedRanges:observedRanges(),
      note:"Each completed record is finalized when original Zetamac advances to the next problem after a correct answer. Unfinished final question is excluded.",
      scoreObserved:state.records.length,
      elapsedObservedSec:state.trialStartedAt ? Math.round((ended-state.trialStartedAt)/100)/10 : null,
      overall:{
        medianTotalMs: totals.length?Math.round(median(totals)):null,
        p90TotalMs: totals.length?Math.round(percentile(totals,.9)):null,
        medianFirstKeyMs: thinking.length?Math.round(median(thinking)):null
      },
      byOperation:groupSummary(r=>r.op),
      byFamily:groupSummary(r=>r.family),
      byMagnitude:groupSummary(r=>r.op && r.magnitude ? `${r.op}:${r.magnitude}` : null),
      slowest:[...state.records].sort((a,b)=>b.totalMs-a.totalMs).slice(0,12).map(r=>({
        i:r.i,q:r.raw,op:r.op,totalMs:r.totalMs,firstKeyMs:r.firstKeyMs,typingMs:r.typingMs,
        family:r.family,magnitude:r.magnitude,backspaces:r.backspaces
      })),
      records:state.records
    };
  }

  function chatText() {
    const d=exportData();
    return [
      "ZETAMAC TRIAL LOG",
      JSON.stringify(d)
    ].join("\n");
  }

  async function copyText() {
    const text=chatText();
    try{
      await navigator.clipboard.writeText(text);
      status("Copied full trial log. Paste it into ChatGPT.");
    }catch(e){
      const ta=document.createElement("textarea");
      ta.value=text;
      ta.style.position="fixed"; ta.style.left="-9999px";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy");
      ta.remove();
      status("Copied full trial log. Paste it into ChatGPT.");
    }
  }

  function download() {
    const blob=new Blob([JSON.stringify(exportData(),null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`zetamac-trial-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    status("Downloaded JSON trial log.");
  }

  function reset() {
    state.records=[];
    state.current=null;
    state.trialStartedAt=null;
    state.settingsSnapshot=null;
    state.lastProblemText="";
    render();
    status("Logger reset. Start the next Zetamac trial.");
    watch();
  }

  let msgTimer=null;
  function status(s){
    const el=document.getElementById("__zeta_logger_msg");
    if(!el) return;
    el.textContent=s;
    clearTimeout(msgTimer);
    msgTimer=setTimeout(()=>{ if(el) el.textContent=""; },4500);
  }

  function createUI(){
    if(document.getElementById("__zeta_logger")) return;
    const box=document.createElement("div");
    box.id="__zeta_logger";
    Object.assign(box.style,{
      position:"fixed",right:"12px",bottom:"12px",zIndex:"2147483647",
      width:"310px",maxWidth:"calc(100vw - 24px)",background:"#111827",color:"#f9fafb",
      border:"1px solid #374151",borderRadius:"12px",padding:"12px",
      boxShadow:"0 12px 30px rgba(0,0,0,.28)",fontFamily:"system-ui,-apple-system,sans-serif",
      fontSize:"12px",lineHeight:"1.35"
    });
    box.innerHTML=`
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <strong style="font-size:13px">Zetamac Trial Logger</strong>
        <span id="__zeta_logger_live" style="color:#93c5fd">waiting</span>
      </div>
      <div id="__zeta_logger_stats" style="margin-top:8px;color:#d1d5db">Completed: 0</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:9px">
        <button id="__zeta_copy" type="button">Copy for ChatGPT</button>
        <button id="__zeta_download" type="button">Download JSON</button>
        <button id="__zeta_reset" type="button" style="grid-column:1/-1">Reset / New Trial</button>
      </div>
      <div id="__zeta_logger_msg" style="min-height:16px;margin-top:7px;color:#86efac"></div>
      <div style="color:#9ca3af">It never changes answers or Zetamac's question generator.</div>
    `;
    document.body.appendChild(box);
    for(const b of box.querySelectorAll("button")){
      Object.assign(b.style,{border:"1px solid #4b5563",background:"#1f2937",color:"#fff",
        padding:"7px",borderRadius:"7px",cursor:"pointer",fontWeight:"700"});
    }
    box.querySelector("#__zeta_copy").addEventListener("click",copyText);
    box.querySelector("#__zeta_download").addEventListener("click",download);
    box.querySelector("#__zeta_reset").addEventListener("click",reset);
  }

  function render(){
    createUI();
    const live=document.getElementById("__zeta_logger_live");
    const stats=document.getElementById("__zeta_logger_stats");
    if(!live || !stats) return;
    live.textContent=state.current ? "logging" : state.problemEl ? "ready" : "waiting";
    live.style.color=state.current ? "#86efac" : "#93c5fd";
    const xs=state.records.map(r=>r.totalMs);
    const med=xs.length ? Math.round(median(xs)) : null;
    const current=state.current ? ` · current: ${state.current.raw}` : "";
    stats.textContent=`Completed: ${state.records.length}${med?` · median: ${(med/1000).toFixed(2)}s`:""}${current}`;
  }

  createUI();
  state.poll=setInterval(watch,250);
  watch();
  render();
})();
