(() => {
  "use strict";

  const VERSION="EXCITEMENT_PET_V30_3";
  const PREVIOUS_VERSION="EXCITEMENT_PET_V30_2";
  const MODES={
    FOCUS:{color:"#a9efff",accent:"#b8b7ff",core:"#f7ffff"},
    BURST:{color:"#ffd28f",accent:"#ff9fc8",core:"#fff8dc"}
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>performance.now();

  const state={
    hype:0,peak:0,lastTapAt:0,lastMode:null,tapTimes:[],forwarded:[],lastForward:{FOCUS:0,BURST:0},
    shots:[],particles:[],rings:[],assists:[],lastAssistAt:0,lastMilestone:0,surgeUntil:0,
    canvas:null,ctx:null,lastFrame:now(),ready:false,enabled:true,frameMs:16.7,quality:"FULL",
    stats:{physicalTaps:0,forwardedTaps:0,coalescedTaps:0,petAssists:0,visualShots:0}
  };

  function triggerLayout(){
    const total=Math.min(366,innerWidth-22),gap=12,h=Math.min(88,Math.max(72,innerHeight*.105)),half=(total-gap)/2;
    const left=(innerWidth-total)/2,top=innerHeight-h-Math.max(10,innerHeight*.018);
    return {FOCUS:{x:left,y:top,w:half,h},BURST:{x:left+half+gap,y:top,w:half,h}};
  }
  function modeAt(x,y){const l=triggerLayout();for(const mode of ["FOCUS","BURST"]){const r=l[mode];if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return mode;}return null;}
  function originFor(mode){const r=triggerLayout()[mode];return {x:r.x+r.w*.5,y:r.y+10};}
  function diagnostics(){try{return window.InfiniteClick&&window.InfiniteClick.diagnostics?window.InfiniteClick.diagnostics():null;}catch(_){return null;}}
  function evolution(){try{return window.DualTriggerV30&&window.DualTriggerV30.diagnostics?window.DualTriggerV30.diagnostics():null;}catch(_){return null;}}
  function activePets(){const d=diagnostics();return d&&Array.isArray(d.pets)?d.pets.filter(p=>p&&p.active&&Number.isFinite(p.x)&&Number.isFinite(p.y)):[];}
  function targetPoint(){const ps=activePets();if(ps.length){const p=ps[Math.floor(Math.random()*ps.length)];return {x:p.x,y:p.y,pet:p};}return {x:innerWidth*(.24+Math.random()*.52),y:innerHeight*(.24+Math.random()*.38),pet:null};}

  function createCanvas(){
    const c=document.createElement("canvas");c.id="excitement-pet-v30-2-overlay";c.style.cssText="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:26;";
    document.body.appendChild(c);state.canvas=c;state.ctx=c.getContext("2d",{alpha:true});resize();addEventListener("resize",resize,{passive:true});
  }
  function resize(){if(!state.canvas)return;const dpr=Math.min(devicePixelRatio||1,1.35);state.canvas.width=Math.max(1,Math.floor(innerWidth*dpr));state.canvas.height=Math.max(1,Math.floor(innerHeight*dpr));state.ctx.setTransform(dpr,0,0,dpr,0,0);}
  function emit(type,payload){const detail={type,at:Date.now(),version:VERSION,hype:Math.round(state.hype),peak:Math.round(state.peak),...(payload||{})};try{window.dispatchEvent(new CustomEvent("crew:game-event",{detail}));}catch(_){}try{window.AndroidGame&&AndroidGame.onGameEvent&&AndroidGame.onGameEvent(JSON.stringify(detail));}catch(_){}}

  function registerTap(mode,t){
    state.stats.physicalTaps++;state.tapTimes.push(t);while(state.tapTimes.length&&t-state.tapTimes[0]>1000)state.tapTimes.shift();
    const rate=state.tapTimes.length,alternating=state.lastMode&&state.lastMode!==mode&&t-state.lastTapAt<260;
    state.hype=clamp(state.hype+2.7+Math.min(3.2,rate*.2)+(alternating?1.5:0)+(t<state.surgeUntil?.5:0),0,100);state.peak=Math.max(state.peak,state.hype);state.lastTapAt=t;state.lastMode=mode;maybeMilestone();
  }
  function maybeMilestone(){
    const level=state.hype>=95?100:state.hype>=75?75:state.hype>=50?50:state.hype>=25?25:0;if(level<=state.lastMilestone)return;state.lastMilestone=level;
    if(level===50)emit("hype_level",{level});
    if(level===75){emit("hype_level",{level});assistBurst(1);}
    if(level===100){state.surgeUntil=now()+3800;emit("surge_start",{durationMs:3800});assistBurst(2);pulseScreen("#fff",.04);}
  }

  // v30.3: one forwarded tap can create MULTISHOT + RICOCHET + LIGHTNING + RAIN,
  // so the budget is intentionally very low. Every physical tap still gets the lightweight shot below.
  function shouldForward(mode,t){
    const d=evolution(),stage=d&&d.stage||1;while(state.forwarded.length&&t-state.forwarded[0]>1000)state.forwarded.shift();
    const maxPerSecond=state.quality==="LOW"?1:(stage>=12?1:2);
    const baseGap=state.quality==="LOW"?760:(stage>=12?620:430),modeGap=mode==="BURST"?baseGap+70:baseGap;
    if(t-state.lastForward[mode]<modeGap||state.forwarded.length>=maxPerSecond)return false;
    state.lastForward[mode]=t;state.forwarded.push(t);state.stats.forwardedTaps++;return true;
  }
  function onPointerDown(e){
    if(!state.enabled)return;const mode=modeAt(e.clientX,e.clientY);if(!mode)return;const t=now();registerTap(mode,t);spawnTapShot(mode);
    if(shouldForward(mode,t))return;
    state.stats.coalescedTaps++;try{if(window.GameHaptics)window.GameHaptics.perform("SOFT_TAP",.12+.12*state.hype/100);}catch(_){}
    if(e.cancelable)try{e.preventDefault();}catch(_){}e.stopImmediatePropagation();e.stopPropagation();
  }

  function shotVariant(mode){
    const n=state.stats.physicalTaps,rare=(n%9===0)||(state.hype>80&&n%6===0);
    if(mode==="FOCUS")return rare?"STAR_CUT":["NEEDLE","PRISM","COMET"][n%3];
    return rare?"NOVA":["ORB","RING","BUBBLE"][n%3];
  }
  function pushShot(s){const cap=state.quality==="LOW"?7:10;if(state.shots.length>=cap)state.shots.splice(0,state.shots.length-cap+1);state.shots.push(s);state.stats.visualShots++;}
  function spawnTapShot(mode){const a=originFor(mode),b=targetPoint(),variant=shotVariant(mode);pushShot({mode,variant,a,b:{x:b.x,y:b.y},t:0,d:mode==="FOCUS"?.17:.22,seed:Math.random()*10,scale:1+Math.random()*.24});}
  function assistShot(pet,mode,index){if(!pet)return;const b=targetPoint(),variant=mode==="FOCUS"?(index%2?"PRISM":"STAR_CUT"):(index%2?"RING":"NOVA");pushShot({mode,variant,a:{x:pet.x,y:pet.y-12},b:{x:b.x,y:b.y},t:0,d:.24,seed:Math.random()*10,scale:1.12,assist:true,pet});state.assists.push({pet,life:.58,max:.58,mode});if(state.assists.length>4)state.assists.shift();state.stats.petAssists++;emit("pet_assist",{petId:pet.id||null,petType:pet.type||null,mode});}
  function assistBurst(count){const ps=activePets();if(!ps.length)return;for(let i=0;i<Math.min(count||1,2);i++){const pet=ps[(state.stats.petAssists+i)%ps.length],mode=i?"BURST":(state.lastMode||"FOCUS");assistShot(pet,mode,i);}}
  function maybePetAssist(t){if(state.hype<42)return;const cadence=state.hype>=90?1050:state.hype>=70?1450:2100;if(t-state.lastAssistAt<cadence)return;state.lastAssistAt=t;assistBurst(state.hype>=92?2:1);}

  function particle(x,y,vx,vy,life,color,size,shape){const cap=state.quality==="LOW"?20:32;if(state.particles.length>=cap)state.particles.splice(0,state.particles.length-cap+1);state.particles.push({x,y,vx,vy,life,max:life,color,size,shape:shape||"dot",rot:Math.random()*Math.PI*2});}
  function impact(x,y,mode,variant){const m=MODES[mode],rare=variant==="STAR_CUT"||variant==="NOVA",n=state.quality==="LOW"?(rare?3:2):(rare?5:3);for(let i=0;i<n;i++){const a=Math.PI*2*i/n+Math.random()*.2,sp=32+Math.random()*(rare?85:55);particle(x,y,Math.cos(a)*sp,Math.sin(a)*sp-10,.18+Math.random()*.13,i%2?m.color:m.accent,(rare?4:3)+Math.random()*1.5,mode==="FOCUS"?"shard":"dot");}state.rings.push({x,y,r:mode==="BURST"?14:9,life:.20,max:.20,color:mode==="BURST"?m.accent:m.color,growth:mode==="BURST"?35:24});if(state.rings.length>8)state.rings.shift();}
  function pulseScreen(color,alpha){state.rings.push({screen:true,life:.10,max:.10,color,alpha});}
  function sample(s,q){const e=1-Math.pow(1-clamp(q,0,1),3),dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len,arc=Math.sin(Math.PI*e)*(s.mode==="FOCUS"?20:12)*Math.sin(s.seed);return {x:s.a.x+dx*e+nx*arc,y:s.a.y+dy*e+ny*arc,angle:Math.atan2(dy,dx)};}

  function update(dt,t){
    const sec=dt/1000;if(t-state.lastTapAt>420)state.hype=Math.max(0,state.hype-sec*(t<state.surgeUntil?2.2:6.5));
    if(state.hype<20)state.lastMilestone=0;else if(state.hype<45)state.lastMilestone=Math.min(state.lastMilestone,25);else if(state.hype<70)state.lastMilestone=Math.min(state.lastMilestone,50);else if(state.hype<92)state.lastMilestone=Math.min(state.lastMilestone,75);
    maybePetAssist(t);for(let i=state.shots.length-1;i>=0;i--){const s=state.shots[i];s.t+=sec;if(s.t>=s.d){impact(s.b.x,s.b.y,s.mode,s.variant);state.shots.splice(i,1);}}
    for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.life-=sec;p.x+=p.vx*sec;p.y+=p.vy*sec;p.vy+=36*sec;if(p.life<=0)state.particles.splice(i,1);}
    for(let i=state.rings.length-1;i>=0;i--){state.rings[i].life-=sec;if(state.rings[i].life<=0)state.rings.splice(i,1);}
    for(let i=state.assists.length-1;i>=0;i--){state.assists[i].life-=sec;if(state.assists[i].life<=0)state.assists.splice(i,1);}
  }

  function drawShot(c,s){
    const q=clamp(s.t/s.d,0,1),p=sample(s,q),z=s.scale||1,m=MODES[s.mode];c.save();c.translate(p.x,p.y);c.globalAlpha=.95;
    if(s.mode==="FOCUS"){
      c.rotate(p.angle);c.shadowBlur=10;c.shadowColor=m.color;
      if(s.variant==="NEEDLE"){c.fillStyle=m.core;c.beginPath();c.moveTo(15*z,0);c.lineTo(-9*z,-2.4*z);c.lineTo(-4*z,0);c.lineTo(-9*z,2.4*z);c.closePath();c.fill();}
      else if(s.variant==="COMET"){c.fillStyle=m.color;c.beginPath();c.moveTo(15*z,0);c.lineTo(-11*z,-5*z);c.lineTo(-5*z,0);c.lineTo(-11*z,5*z);c.closePath();c.fill();c.fillStyle=m.core;c.fillRect(-18*z,-1.2*z,16*z,2.4*z);}
      else if(s.variant==="PRISM"){c.rotate(Math.PI/4);for(let i=-1;i<=1;i++){c.save();c.translate(i*7*z,0);c.fillStyle=i?m.color:m.core;c.fillRect(-4*z,-4*z,8*z,8*z);c.restore();}}
      else{c.strokeStyle=m.core;c.lineWidth=2.6*z;c.beginPath();c.moveTo(-13*z,0);c.lineTo(13*z,0);c.moveTo(0,-13*z);c.lineTo(0,13*z);c.moveTo(-8*z,-8*z);c.lineTo(8*z,8*z);c.moveTo(8*z,-8*z);c.lineTo(-8*z,8*z);c.stroke();}
    }else{
      c.shadowBlur=11;c.shadowColor=m.accent;
      if(s.variant==="RING"){c.strokeStyle=m.color;c.lineWidth=3.8*z;c.beginPath();c.arc(0,0,12*z,0,Math.PI*2);c.stroke();}
      else if(s.variant==="BUBBLE"){c.fillStyle="rgba(255,210,143,.25)";c.strokeStyle=m.accent;c.lineWidth=2*z;c.beginPath();c.arc(0,0,12*z,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=m.core;c.beginPath();c.arc(-4*z,-4*z,3*z,0,Math.PI*2);c.fill();}
      else if(s.variant==="NOVA"){c.fillStyle=m.core;for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);c.beginPath();c.moveTo(0,-17*z);c.lineTo(3*z,-5*z);c.lineTo(-3*z,-5*z);c.closePath();c.fill();c.restore();}}
      else{const g=c.createRadialGradient(-3*z,-3*z,1,0,0,12*z);g.addColorStop(0,"#fff");g.addColorStop(.38,m.core);g.addColorStop(1,m.color);c.fillStyle=g;c.beginPath();c.arc(0,0,12*z,0,Math.PI*2);c.fill();}
    }
    c.restore();
  }
  function drawParticles(c){for(const p of state.particles){const a=clamp(p.life/p.max,0,1);c.save();c.globalAlpha=a;c.fillStyle=p.color;c.translate(p.x,p.y);c.rotate(p.rot);if(p.shape==="shard"){c.beginPath();c.moveTo(0,-p.size*1.6);c.lineTo(p.size*.65,0);c.lineTo(0,p.size*1.4);c.lineTo(-p.size*.55,0);c.closePath();c.fill();}else{c.beginPath();c.arc(0,0,p.size,0,Math.PI*2);c.fill();}c.restore();}}
  function drawRings(c){for(const r of state.rings){const a=clamp(r.life/r.max,0,1);if(r.screen){c.save();c.globalAlpha=(r.alpha||.04)*a;c.fillStyle=r.color;c.fillRect(0,0,innerWidth,innerHeight);c.restore();continue;}const q=1-a;c.save();c.globalAlpha=a*.5;c.strokeStyle=r.color;c.lineWidth=1.8;c.beginPath();c.arc(r.x,r.y,r.r+q*r.growth,0,Math.PI*2);c.stroke();c.restore();}}
  function drawAssists(c,t){for(const a of state.assists){const p=a.pet;if(!p)continue;const life=clamp(a.life/a.max,0,1),m=MODES[a.mode],pulse=.5+.5*Math.sin(t/95);c.save();c.globalAlpha=.34*life;c.strokeStyle=m.color;c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,30+pulse*8,0,Math.PI*2);c.stroke();c.globalAlpha=.8*life;c.fillStyle=m.core;const ang=t/320+(String(p.id||"").length*.8);c.beginPath();c.arc(p.x+Math.cos(ang)*36,p.y+Math.sin(ang)*24,4,0,Math.PI*2);c.fill();c.restore();}}
  function drawHype(c,t){if(state.hype<30)return;const l=triggerLayout(),left=l.FOCUS.x,right=l.BURST.x+l.BURST.w,y=l.FOCUS.y-7,p=state.hype/100;c.save();c.globalAlpha=.18+.25*p;c.lineCap="round";c.lineWidth=2.5;c.strokeStyle=state.hype>=90?"#fff":state.hype>=70?"#ffe59a":"#bcefff";c.beginPath();c.moveTo(left,y);c.lineTo(left+(right-left)*p,y);c.stroke();if(t<state.surgeUntil){c.globalAlpha=.10+.05*Math.sin(t/80);c.lineWidth=5;c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();}c.restore();}
  function render(t){const c=state.ctx;if(!c)return;c.clearRect(0,0,innerWidth,innerHeight);for(const s of state.shots)drawShot(c,s);drawParticles(c);drawRings(c);drawAssists(c,t);drawHype(c,t);}
  function loop(t){const dt=Math.min(50,t-state.lastFrame||16.7);state.lastFrame=t;state.frameMs=state.frameMs*.9+dt*.1;state.quality=state.frameMs>27?"LOW":state.frameMs>20.5?"MEDIUM":"FULL";if(state.quality==="LOW"&&state.shots.length>7)state.shots.splice(0,state.shots.length-7);if(state.quality==="LOW"&&state.particles.length>20)state.particles.splice(0,state.particles.length-20);update(dt,t);render(t);requestAnimationFrame(loop);}
  function init(){if(state.ready)return;state.ready=true;createCanvas();document.addEventListener("pointerdown",onPointerDown,true);requestAnimationFrame(loop);emit("excitement_ready",{performanceBudget:true,petAssist:true,shotVariation:true,hardThrottle:true});}

  const api={version:VERSION,previousVersion:PREVIOUS_VERSION,diagnostics:()=>({version:VERSION,hype:Math.round(state.hype),peak:Math.round(state.peak),surge:now()<state.surgeUntil,quality:state.quality,activeShots:state.shots.length,particles:state.particles.length,...state.stats}),setEnabled:v=>(state.enabled=!!v),forceAssist:()=>assistBurst(1),setHype:v=>(state.hype=clamp(Number(v)||0,0,100))};
  window.ExcitementPetV303=api;window.ExcitementPetV302=api;init();
})();
