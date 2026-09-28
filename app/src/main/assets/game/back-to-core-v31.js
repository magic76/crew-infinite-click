(() => {
  "use strict";

  const VERSION="BACK_TO_CORE_V31";
  const TAU=Math.PI*2;
  const PHASES=["CALM","WARM","CHARGED","OVERDRIVE","BURST"];
  const PEAK_SIGNATURES=["FAN","CROSS","LANCE"];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>performance.now();

  const state={
    ready:false,canvas:null,ctx:null,dpr:1,w:0,h:0,
    safe:{left:0,top:0,right:0,bottom:0},
    language:"zh-TW",
    phase:"CALM",lastPhase:"CALM",
    cycle:0,cycleTaps:0,burstAt:46,burstUntil:0,resetAt:0,quietUntil:0,
    totalTaps:0,holdShots:0,visualShots:0,lastTapAt:0,tapTimes:[],lastPulseAt:0,pulseTaps:0,
    held:new Map(),
    beams:[],rings:[],ambient:[],
    corePress:0,coreGlow:0,coreSpin:0,coreLeanX:0,coreLeanY:0,
    sceneKick:0,sceneZoom:0,flash:0,
    lastFrame:now(),frameMs:16.7,quality:"FULL",
    peakIntensity:0
  };

  function phaseIndex(){
    if(state.phase==="BURST")return 4;
    if(state.cycleTaps>=30)return 3;
    if(state.cycleTaps>=15)return 2;
    if(state.cycleTaps>=5)return 1;
    return 0;
  }

  function intensity(){
    if(state.phase==="BURST")return 1;
    return clamp(state.cycleTaps/Math.max(1,state.burstAt),0,1);
  }

  function signature(){
    return PEAK_SIGNATURES[state.cycle%PEAK_SIGNATURES.length];
  }

  function corePoint(){
    const usableTop=state.safe.top||0;
    const usableBottom=state.safe.bottom||0;
    const usableH=Math.max(1,state.h-usableTop-usableBottom);
    return {x:state.w*.5,y:usableTop+usableH*.56};
  }

  function emit(type,payload){
    const detail={
      type,at:Date.now(),version:VERSION,phase:state.phase,cycle:state.cycle,
      intensity:Number(intensity().toFixed(3)),signature:signature(),...(payload||{})
    };
    try{window.dispatchEvent(new CustomEvent("crew:game-event",{detail}));}catch(_){}
    try{window.AndroidGame&&AndroidGame.onGameEvent&&AndroidGame.onGameEvent(JSON.stringify(detail));}catch(_){}
  }

  function haptic(kind,strength){
    try{if(window.GameHaptics&&GameHaptics.perform)GameHaptics.perform(kind,strength);}catch(_){}
  }

  function seedAmbient(){
    state.ambient.length=0;
    const count=28;
    for(let i=0;i<count;i++){
      state.ambient.push({
        nx:.04+Math.random()*.92,
        ny:.08+Math.random()*.86,
        r:.8+Math.random()*2.2,
        phase:Math.random()*TAU,
        drift:.35+Math.random()*.8,
        alpha:.08+Math.random()*.16
      });
    }
  }

  function resize(){
    if(!state.canvas)return;
    state.w=Math.max(1,innerWidth);
    state.h=Math.max(1,innerHeight);
    state.dpr=Math.min(devicePixelRatio||1,1.25);
    state.canvas.width=Math.floor(state.w*state.dpr);
    state.canvas.height=Math.floor(state.h*state.dpr);
    state.canvas.style.width=state.w+"px";
    state.canvas.style.height=state.h+"px";
    state.ctx.setTransform(state.dpr,0,0,state.dpr,0,0);
  }

  function ensureCanvas(){
    if(state.canvas)return;
    const c=document.createElement("canvas");
    c.id="back-to-core-v31";
    c.style.cssText="position:fixed;inset:0;width:100%;height:100%;touch-action:none;user-select:none;-webkit-user-select:none;background:#111208;";
    document.body.appendChild(c);
    state.canvas=c;
    state.ctx=c.getContext("2d",{alpha:false,desynchronized:true});
    resize();
    seedAmbient();
    addEventListener("resize",resize,{passive:true});
  }

  function stageName(idx){
    return PHASES[clamp(idx,0,4)];
  }

  function updatePhase(){
    if(state.phase==="BURST")return;
    const next=stageName(phaseIndex());
    if(next===state.phase)return;
    state.lastPhase=state.phase;
    state.phase=next;
    state.coreGlow=Math.max(state.coreGlow,.32+.12*phaseIndex());
    state.sceneKick=Math.max(state.sceneKick,.10+.035*phaseIndex());
    emit("core_stage",{level:phaseIndex(),from:state.lastPhase,to:state.phase});
    haptic(phaseIndex()>=3?"MEDIUM_TAP":"SOFT_TAP",.16+.05*phaseIndex());
  }

  function resetCycle(t,forced){
    state.cycle++;
    state.cycleTaps=0;
    state.burstAt=46+(state.cycle%3);
    state.phase="CALM";
    state.lastPhase="BURST";
    state.burstUntil=0;
    state.resetAt=0;
    state.quietUntil=t+(forced?120:420);
    state.tapTimes.length=0;
    state.beams.length=0;
    state.coreGlow=.18;
    state.corePress=0;
    state.sceneZoom=0;
    state.sceneKick=0;
    state.flash=Math.max(state.flash,.035);
    emit("core_reset",{forced:!!forced,nextBurstAt:state.burstAt});
  }

  function burstAngles(count){
    const kind=signature(),angles=[];
    if(kind==="CROSS"){
      const bases=[0,Math.PI*.5,Math.PI,Math.PI*1.5];
      for(let i=0;i<count;i++)angles.push(bases[i%bases.length]+(Math.random()-.5)*.12);
    }else if(kind==="LANCE"){
      const base=-Math.PI*.5;
      for(let i=0;i<count;i++)angles.push(base+(Math.random()-.5)*.28);
    }else{
      for(let i=0;i<count;i++)angles.push(-Math.PI*.92+(i/Math.max(1,count-1))*Math.PI*1.84+(Math.random()-.5)*.05);
    }
    return angles;
  }

  function triggerBurst(t){
    if(state.phase==="BURST")return;
    state.phase="BURST";
    state.lastPhase="OVERDRIVE";
    state.burstUntil=t+820;
    state.resetAt=t+1220;
    state.coreGlow=1;
    state.corePress=1;
    state.sceneKick=.48;
    state.sceneZoom=.04;
    state.flash=.22;
    const q=state.quality==="LOW"?24:state.quality==="MEDIUM"?32:42;
    const cp=corePoint();
    const angles=burstAngles(q);
    for(const a of angles)spawnBeamAtAngle(cp,a,1,true);
    for(let i=0;i<4;i++)state.rings.push({t:0,d:.58+i*.06,r:42+i*10,width:2.2-i*.25,alpha:.56-i*.08,burst:true});
    if(state.rings.length>12)state.rings.splice(0,state.rings.length-12);
    emit("core_burst",{signature:signature(),cycleTaps:Math.round(state.cycleTaps)});
    haptic("HARD_TAP",.58);
  }

  function tapRate(t){
    state.tapTimes.push(t);
    while(state.tapTimes.length&&t-state.tapTimes[0]>1000)state.tapTimes.shift();
    return state.tapTimes.length;
  }

  function baseAim(x,y){
    const cp=corePoint(),dx=x-cp.x,dy=y-cp.y,dist=Math.hypot(dx,dy);
    if(dist<Math.max(54,Math.min(state.w,state.h)*.12)){
      return -Math.PI*.5+(Math.random()-.5)*.9;
    }
    return Math.atan2(dy,dx);
  }

  function beamCountFor(idx,rate,hold){
    if(hold)return idx<=1?0:idx===2?1:2;
    if(idx===0)return 0;
    if(idx===1)return rate>=7?2:1;
    if(idx===2)return 3+(rate>=6?2:0)+(rate>=10?2:0);
    if(idx===3)return 7+(rate>=6?3:0)+(rate>=10?4:0);
    return 0;
  }

  function beamCap(){
    return state.quality==="LOW"?42:state.quality==="MEDIUM"?58:78;
  }

  function spawnBeamAtAngle(cp,angle,power,burst){
    const dist=Math.hypot(state.w,state.h)*(.62+Math.random()*.28);
    const tx=cp.x+Math.cos(angle)*dist,ty=cp.y+Math.sin(angle)*dist;
    const d=(burst?.18:.15+Math.random()*.09)*(1-.16*intensity());
    state.beams.push({
      x0:cp.x,y0:cp.y,x1:tx,y1:ty,t:0,d,
      width:(burst?2.0:1.05)+power*.75+Math.random()*.55,
      length:(burst?58:30)+power*34+Math.random()*30,
      alpha:burst?.95:.58+power*.22,
      burst:!!burst
    });
    const cap=beamCap();
    if(state.beams.length>cap)state.beams.splice(0,state.beams.length-cap);
    state.visualShots++;
  }

  function spawnVolley(x,y,rate,hold){
    const idx=phaseIndex(),count=beamCountFor(idx,rate,hold);
    if(count<=0)return;
    const cp=corePoint(),base=baseAim(x,y),power=clamp(.18+idx*.23+rate*.025,0,1);
    for(let i=0;i<count;i++){
      let a=base;
      if(idx===1)a+=(Math.random()-.5)*.10;
      else if(idx===2)a+=(i-(count-1)/2)*.055+(Math.random()-.5)*.035;
      else a+=(i-(count-1)/2)*.075+(Math.random()-.5)*.05;
      spawnBeamAtAngle(cp,a,power,false);
    }
    if(idx>=3&&!hold&&state.totalTaps%5===0){
      const extra=state.quality==="LOW"?4:7;
      for(let i=0;i<extra;i++)spawnBeamAtAngle(cp,-Math.PI*.5+(Math.random()-.5)*1.45,power*.9,false);
    }
  }

  function queueRing(power){
    state.rings.push({t:0,d:.34+.12*power,r:28+power*10,width:1.2+power*.9,alpha:.26+.2*power,burst:false});
    if(state.rings.length>10)state.rings.splice(0,state.rings.length-10);
  }

  function applyPress(x,y,opts){
    const o=opts||{},t=now();
    if(t<state.quietUntil)state.quietUntil=0;
    if(state.phase==="BURST"){
      state.corePress=Math.max(state.corePress,.45);
      state.sceneKick=Math.max(state.sceneKick,.15);
      return;
    }

    const rate=o.hold?state.tapTimes.length:tapRate(t);
    if(!o.hold){
      state.totalTaps++;
      state.pulseTaps++;
      state.cycleTaps+=1;
      state.lastTapAt=t;
    }else{
      state.holdShots++;
      state.cycleTaps+=.32;
    }

    state.peakIntensity=Math.max(state.peakIntensity,intensity());
    state.corePress=clamp(state.corePress+(o.hold?.38:.72),0,1);
    state.coreGlow=Math.max(state.coreGlow,.18+.54*intensity());
    const cp=corePoint(),dx=x-cp.x,dy=y-cp.y,dist=Math.max(1,Math.hypot(dx,dy));
    state.coreLeanX=clamp(dx/dist,-1,1)*Math.min(5,1.5+5*intensity());
    state.coreLeanY=clamp(dy/dist,-1,1)*Math.min(4,1+4*intensity());
    state.sceneKick=Math.max(state.sceneKick,(o.hold?.035:.055)+intensity()*.11);

    updatePhase();
    spawnVolley(x,y,rate,!!o.hold);
    queueRing(intensity());

    if(!o.hold){
      const idx=phaseIndex();
      haptic(idx>=3?"MEDIUM_TAP":"SOFT_TAP",.10+idx*.04);
    }

    if(state.cycleTaps>=state.burstAt)triggerBurst(t);
  }

  function onDown(e){
    if(!state.ready||!e.isTrusted)return;
    if(e.cancelable)e.preventDefault();
    applyPress(e.clientX,e.clientY,{hold:false});
    state.held.set(e.pointerId,{x:e.clientX,y:e.clientY,startedAt:now(),lastAt:now()});
  }

  function onMove(e){
    const h=state.held.get(e.pointerId);
    if(!h)return;
    h.x=e.clientX;h.y=e.clientY;
  }

  function onUp(e){
    state.held.delete(e.pointerId);
  }

  function updateHold(t){
    for(const h of state.held.values()){
      if(t-h.startedAt<360)continue;
      if(t-h.lastAt<430)continue;
      h.lastAt=t;
      applyPress(h.x,h.y,{hold:true});
    }
  }

  function update(dt,t){
    const sec=dt/1000;
    updateHold(t);

    if(state.phase==="BURST"&&state.resetAt&&t>=state.resetAt){
      resetCycle(t,false);
    }

    for(let i=state.beams.length-1;i>=0;i--){
      const b=state.beams[i];b.t+=sec;
      if(b.t>=b.d)state.beams.splice(i,1);
    }
    for(let i=state.rings.length-1;i>=0;i--){
      const r=state.rings[i];r.t+=sec;
      if(r.t>=r.d)state.rings.splice(i,1);
    }

    state.corePress=Math.max(0,state.corePress-sec*4.8);
    state.coreGlow=Math.max(.04,state.coreGlow-sec*.72);
    state.coreSpin+=sec*(.3+intensity()*2.8);
    state.coreLeanX*=Math.pow(.001,sec);
    state.coreLeanY*=Math.pow(.001,sec);
    state.sceneKick*=Math.pow(.0008,sec);
    const targetZoom=state.phase==="BURST"?.035:intensity()*.018;
    state.sceneZoom+= (targetZoom-state.sceneZoom)*Math.min(1,sec*5.8);
    state.flash=Math.max(0,state.flash-sec*.62);

    if(t-state.lastPulseAt>1200&&state.pulseTaps>0){
      emit("play_pulse",{taps:state.pulseTaps,tapRate:state.tapTimes.length});
      state.lastPulseAt=t;state.pulseTaps=0;
    }
  }

  function drawBackground(c,t){
    const I=intensity(),w=state.w,h=state.h,cp=corePoint();
    c.fillStyle="#111208";
    c.fillRect(0,0,w,h);

    c.save();
    c.globalAlpha=.055+.035*I;
    c.fillStyle="#737000";
    c.beginPath();c.arc(w*.12,h*.16,Math.max(w,h)*.23,0,TAU);c.fill();
    c.beginPath();c.arc(w*.78,h*.74,Math.max(w,h)*.31,0,TAU);c.fill();
    c.globalAlpha=.035+.03*I;
    c.fillStyle="#9b9200";
    c.beginPath();c.arc(w*.56,h*.46,Math.max(w,h)*.18,0,TAU);c.fill();
    c.restore();

    c.save();
    for(const d of state.ambient){
      const drift=(Math.sin(t*.00035*d.drift+d.phase))*3*(.35+I);
      const x=d.nx*w+(d.nx-.5)*I*9+drift;
      const y=d.ny*h+(d.ny-.5)*I*12;
      c.globalAlpha=d.alpha*(.55+.7*I);
      c.fillStyle=I>.72?"#8a9300":"#536100";
      c.beginPath();c.arc(x,y,d.r*(1+I*.45),0,TAU);c.fill();
    }
    c.restore();

    const vignette=c.createRadialGradient(cp.x,cp.y,Math.min(w,h)*.1,cp.x,cp.y,Math.max(w,h)*.72);
    vignette.addColorStop(0,"rgba(0,0,0,0)");
    vignette.addColorStop(1,"rgba(0,0,0,"+(.26-.08*I)+")");
    c.fillStyle=vignette;c.fillRect(0,0,w,h);
  }

  function drawBeam(c,b){
    const q=clamp(b.t/b.d,0,1),e=1-Math.pow(1-q,3.2);
    const dx=b.x1-b.x0,dy=b.y1-b.y0,len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len,uy=dy/len;
    const hx=b.x0+dx*e,hy=b.y0+dy*e;
    const tail=Math.min(b.length,len*e),tx=hx-ux*tail,ty=hy-uy*tail;
    const fade=1-clamp((q-.68)/.32,0,1);

    c.save();c.lineCap="round";c.globalCompositeOperation="lighter";
    c.globalAlpha=.18*b.alpha*fade;c.strokeStyle="#ffd400";c.lineWidth=b.width*4.4;c.beginPath();c.moveTo(tx,ty);c.lineTo(hx,hy);c.stroke();
    c.globalAlpha=.78*b.alpha*fade;c.strokeStyle="#ffd21a";c.lineWidth=b.width*1.8;c.beginPath();c.moveTo(tx,ty);c.lineTo(hx,hy);c.stroke();
    c.globalAlpha=b.alpha*fade;c.strokeStyle="#fffbd8";c.lineWidth=Math.max(.8,b.width*.52);c.beginPath();c.moveTo(tx+ux*6,ty+uy*6);c.lineTo(hx,hy);c.stroke();
    c.restore();
  }

  function drawRings(c){
    const cp=corePoint();
    for(const r of state.rings){
      const q=clamp(r.t/r.d,0,1),ease=1-Math.pow(1-q,2),a=(1-q)*r.alpha;
      c.save();c.globalCompositeOperation="lighter";c.globalAlpha=a;c.strokeStyle=r.burst?"#fff6a4":"#d6b700";
      c.lineWidth=r.width*(1-q*.45);c.beginPath();c.arc(cp.x,cp.y,r.r+ease*(r.burst?92:38),0,TAU);c.stroke();c.restore();
    }
  }

  function drawSpacedText(c,text,x,y,spacing){
    c.save();c.textAlign="left";c.textBaseline="middle";
    const widths=[...text].map(ch=>c.measureText(ch).width);
    const total=widths.reduce((a,b)=>a+b,0)+spacing*Math.max(0,text.length-1);
    let px=x-total*.5;
    for(let i=0;i<text.length;i++){c.fillText(text[i],px,y);px+=widths[i]+spacing;}
    c.restore();
  }

  function drawCore(c,t){
    const cp=corePoint(),I=intensity(),idx=phaseIndex();
    const base=clamp(Math.min(state.w,state.h)*.083,28,43);
    const pulse=Math.sin(t*.0042)*(1.2+I*2.2);
    const burstBoost=state.phase==="BURST"?10*Math.sin(clamp((state.burstUntil-t)/820,0,1)*Math.PI):0;
    const r=base*(1+I*.20)+pulse+burstBoost;
    const press=state.corePress;
    const sx=1+press*.13,sy=1-press*.17;
    const x=cp.x+state.coreLeanX,y=cp.y+state.coreLeanY;

    c.save();c.translate(x,y);c.scale(sx,sy);

    c.globalCompositeOperation="lighter";
    c.globalAlpha=.10+.20*I+.15*state.coreGlow;
    c.fillStyle="#ffd400";c.beginPath();c.arc(0,0,r*2.15,0,TAU);c.fill();

    c.globalAlpha=.25+.25*I;
    c.strokeStyle="#b99a00";c.lineWidth=1.5+I*1.8;
    c.beginPath();c.arc(0,0,r*1.72+Math.sin(t*.003)*3,0,TAU);c.stroke();

    if(idx>=2){
      c.save();c.rotate(state.coreSpin);
      c.globalAlpha=.18+.12*I;c.strokeStyle="#ffe45a";c.lineWidth=1.4;
      for(let i=0;i<3;i++){c.beginPath();c.arc(0,0,r*(1.95+i*.16),i*1.65,i*1.65+1.0+I*.35);c.stroke();}
      c.restore();
    }

    const g=c.createRadialGradient(-r*.30,-r*.34,r*.08,0,0,r);
    g.addColorStop(0,"#fff8b1");g.addColorStop(.26,"#ffe13a");g.addColorStop(1,"#ffc400");
    c.globalAlpha=1;c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();

    c.globalAlpha=.28+.20*I;c.fillStyle="#ffffff";c.beginPath();c.arc(-r*.30,-r*.32,r*.18,0,TAU);c.fill();

    if(idx>=2){
      c.globalAlpha=.25+.28*I;c.strokeStyle="#9f7600";c.lineWidth=1.05+I*.8;
      const crackCount=idx===2?2:4;
      for(let i=0;i<crackCount;i++){
        const a=-1.35+i*(TAU/crackCount)+Math.sin(i*13.7)*.18;
        c.beginPath();c.moveTo(Math.cos(a)*r*.22,Math.sin(a)*r*.22);
        c.lineTo(Math.cos(a+.10)*r*.52,Math.sin(a+.10)*r*.52);
        c.lineTo(Math.cos(a-.08)*r*.78,Math.sin(a-.08)*r*.78);c.stroke();
      }
    }
    c.restore();

    const labelAlpha=state.phase==="CALM"?clamp(1-state.cycleTaps*.18,0,1):0;
    if(labelAlpha>0){
      c.save();c.globalAlpha=.82*labelAlpha;c.fillStyle="#f4f1e8";c.font="600 13px system-ui,-apple-system,sans-serif";
      drawSpacedText(c,"TOUCH",cp.x,cp.y+r*2.35,5);c.restore();
    }
  }

  function render(t){
    const c=state.ctx;if(!c)return;
    c.setTransform(state.dpr,0,0,state.dpr,0,0);
    c.clearRect(0,0,state.w,state.h);

    const kick=state.sceneKick,zoom=1+state.sceneZoom;
    const kx=(Math.sin(t*.067)*kick*5),ky=(Math.cos(t*.083)*kick*3.8);
    c.save();c.translate(state.w*.5+kx,state.h*.5+ky);c.scale(zoom,zoom);c.translate(-state.w*.5,-state.h*.5);

    drawBackground(c,t);
    for(const b of state.beams)drawBeam(c,b);
    drawRings(c);
    drawCore(c,t);

    c.restore();

    if(state.flash>0){
      c.save();c.globalAlpha=state.flash;c.fillStyle="#fff7b0";c.fillRect(0,0,state.w,state.h);c.restore();
    }
  }

  function loop(t){
    const dt=Math.min(50,t-state.lastFrame||16.7);
    state.lastFrame=t;
    state.frameMs=state.frameMs*.91+dt*.09;
    state.quality=state.frameMs>28?"LOW":state.frameMs>21?"MEDIUM":"FULL";
    update(dt,t);
    render(t);
    requestAnimationFrame(loop);
  }

  function receive(payload){
    const p=payload||{},op=String(p.op||"");
    if(op==="safeArea"){
      state.safe.left=Math.max(0,Number(p.left)||0);
      state.safe.top=Math.max(0,Number(p.top)||0);
      state.safe.right=Math.max(0,Number(p.right)||0);
      state.safe.bottom=Math.max(0,Number(p.bottom)||0);
      return true;
    }
    if(op==="language"){state.language=String(p.value||"zh-TW");return true;}
    if(op==="reset"){resetCycle(now(),true);return true;}
    if(op==="screenShake"){state.sceneKick=Math.max(state.sceneKick,.24);return true;}
    if(op==="flash"){state.flash=Math.max(state.flash,.14);return true;}
    if(op==="experiencePlan"||op==="interaction"||op==="scenePlan"||op==="geminiFallback"||op==="geminiState"||op==="voiceState"||op==="spokenLine"||op==="geminiLiveReady")return true;
    return false;
  }

  function init(){
    if(state.ready)return;
    ensureCanvas();
    state.ready=true;
    document.addEventListener("pointerdown",onDown,{capture:true,passive:false});
    document.addEventListener("pointermove",onMove,{capture:true,passive:true});
    document.addEventListener("pointerup",onUp,{capture:true,passive:true});
    document.addEventListener("pointercancel",onUp,{capture:true,passive:true});
    requestAnimationFrame(loop);
    emit("back_to_core_ready",{singleCanvas:true,legacyRuntimeLoaded:false,burstAt:state.burstAt});
    try{window.AndroidGame&&AndroidGame.onRendererReady&&AndroidGame.onRendererReady(VERSION);}catch(_){}
  }

  const api={
    version:VERSION,
    receive,
    diagnostics:()=>({
      version:VERSION,phase:state.phase,cycle:state.cycle,cycleTaps:Number(state.cycleTaps.toFixed(2)),
      burstAt:state.burstAt,intensity:Number(intensity().toFixed(3)),quality:state.quality,
      buttonPresses:state.totalTaps+state.holdShots*.32,buttonShots:state.visualShots,
      directHits:0,objectHits:0,totalTaps:state.totalTaps,holdShots:state.holdShots,
      activeBeams:state.beams.length,peakIntensity:Number(state.peakIntensity.toFixed(3)),
      signature:signature(),pets:[]
    }),
    reset:()=>resetCycle(now(),true),
    forceBurst:()=>{state.cycleTaps=state.burstAt;triggerBurst(now());},
    setProgress:v=>{state.cycleTaps=clamp(Number(v)||0,0,1)*state.burstAt;updatePhase();}
  };

  window.InfiniteClick=api;
  window.BackToCoreV31=api;
  init();
})();