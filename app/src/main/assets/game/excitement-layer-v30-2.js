(() => {
  "use strict";

  const VERSION="EXCITEMENT_PET_V30_2";
  const MODES={
    FOCUS:{color:"#a9efff",accent:"#c7baff",core:"#f7ffff"},
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
  function modeAt(x,y){
    const layout=triggerLayout();
    for(const mode of ["FOCUS","BURST"]){const r=layout[mode];if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return mode;}
    return null;
  }
  function originFor(mode){const r=triggerLayout()[mode];return {x:r.x+r.w*.5,y:r.y+10};}
  function diagnostics(){try{return window.InfiniteClick&&window.InfiniteClick.diagnostics?window.InfiniteClick.diagnostics():null;}catch(_){return null;}}
  function evolution(){try{return window.DualTriggerV30&&window.DualTriggerV30.diagnostics?window.DualTriggerV30.diagnostics():null;}catch(_){return null;}}
  function activePets(){const d=diagnostics();return d&&Array.isArray(d.pets)?d.pets.filter(p=>p&&p.active&&Number.isFinite(p.x)&&Number.isFinite(p.y)):[];}
  function targetPoint(){const ps=activePets();if(ps.length){const p=ps[Math.floor(Math.random()*ps.length)];return {x:p.x,y:p.y,pet:p};}return {x:innerWidth*(.24+Math.random()*.52),y:innerHeight*(.24+Math.random()*.38),pet:null};}

  function createCanvas(){
    if(state.canvas)return;
    const c=document.createElement("canvas");c.id="excitement-pet-v30-2-overlay";c.style.cssText="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:26;";
    document.body.appendChild(c);state.canvas=c;state.ctx=c.getContext("2d",{alpha:true});resize();addEventListener("resize",resize,{passive:true});
  }
  function resize(){if(!state.canvas)return;const dpr=Math.min(devicePixelRatio||1,1.5);state.canvas.width=Math.max(1,Math.floor(innerWidth*dpr));state.canvas.height=Math.max(1,Math.floor(innerHeight*dpr));state.ctx.setTransform(dpr,0,0,dpr,0,0);}

  function emit(type,payload){
    const detail={type,at:Date.now(),version:VERSION,hype:Math.round(state.hype),peak:Math.round(state.peak),...(payload||{})};
    try{window.dispatchEvent(new CustomEvent("crew:game-event",{detail}));}catch(_){}
    try{window.AndroidGame&&AndroidGame.onGameEvent&&AndroidGame.onGameEvent(JSON.stringify(detail));}catch(_){}
  }

  function registerTap(mode,t){
    state.stats.physicalTaps++;state.tapTimes.push(t);while(state.tapTimes.length&&t-state.tapTimes[0]>1000)state.tapTimes.shift();
    const rate=state.tapTimes.length,alternating=state.lastMode&&state.lastMode!==mode&&t-state.lastTapAt<260;
    const gain=2.4+Math.min(2.8,rate*.18)+(alternating?1.25:0)+(t<state.surgeUntil?.45:0);
    state.hype=clamp(state.hype+gain,0,100);state.peak=Math.max(state.peak,state.hype);state.lastTapAt=t;state.lastMode=mode;
    maybeMilestone();
  }

  function maybeMilestone(){
    const level=state.hype>=95?100:state.hype>=75?75:state.hype>=50?50:state.hype>=25?25:0;
    if(level<=state.lastMilestone)return;
    state.lastMilestone=level;
    if(level===50)emit("hype_level",{level:50});
    if(level===75){emit("hype_level",{level:75});assistBurst(1);}
    if(level===100){state.surgeUntil=now()+4200;emit("surge_start",{durationMs:4200});assistBurst(2);pulseScreen("#ffffff",.045);}
  }

  function shouldForward(mode,t){
    const d=evolution(),stage=d&&d.stage||1;
    while(state.forwarded.length&&t-state.forwarded[0]>1000)state.forwarded.shift();
    const stageCap=stage>=15?8:stage>=8?10:12,maxPerSecond=Math.max(6,stageCap-(state.hype>=80?1:0));
    const minGap=(mode==="BURST"?72:58)+(state.hype>=80?24:state.hype>=55?12:0)+(stage>=15?12:stage>=8?6:0);
    if(t-state.lastForward[mode]<minGap||state.forwarded.length>=maxPerSecond)return false;
    state.lastForward[mode]=t;state.forwarded.push(t);state.stats.forwardedTaps++;return true;
  }

  function onPointerDown(e){
    if(!state.enabled)return;const mode=modeAt(e.clientX,e.clientY);if(!mode)return;const t=now();registerTap(mode,t);spawnTapShot(mode,e.clientX,e.clientY);
    if(shouldForward(mode,t))return;
    state.stats.coalescedTaps++;
    try{if(window.GameHaptics)window.GameHaptics.perform("SOFT_TAP",.12+.15*state.hype/100);}catch(_){}
    e.stopImmediatePropagation();
  }

  function shotVariant(mode){
    const n=state.stats.physicalTaps,rare=(n%11===0)||(state.hype>82&&n%7===0);
    if(mode==="FOCUS")return rare?"STAR_CUT":["NEEDLE","PRISM","COMET"][n%3];
    return rare?"NOVA":["ORB","RING","BUBBLE"][n%3];
  }
  function spawnTapShot(mode,x,y){
    if(state.shots.length>=18)state.shots.splice(0,state.shots.length-17);
    const a=originFor(mode),b=targetPoint(),variant=shotVariant(mode),duration=mode==="FOCUS"?.18:.23;
    state.shots.push({mode,variant,a,b:{x:b.x,y:b.y},t:0,d:duration,seed:Math.random()*10,scale:.86+Math.random()*.26});state.stats.visualShots++;
  }
  function assistShot(pet,mode,index){
    if(!pet)return;const b=targetPoint(),variant=mode==="FOCUS"?(index%2?"PRISM":"STAR_CUT"):(index%2?"RING":"NOVA");
    if(state.shots.length>=18)state.shots.shift();state.shots.push({mode,variant,a:{x:pet.x,y:pet.y-12},b:{x:b.x,y:b.y},t:0,d:.24,seed:Math.random()*10,scale:1.05,assist:true,pet});
    state.assists.push({pet,life:.7,max:.7,mode});if(state.assists.length>6)state.assists.shift();state.stats.petAssists++;emit("pet_assist",{petId:pet.id||null,petType:pet.type||null,mode});
  }
  function assistBurst(count){
    const ps=activePets();if(!ps.length)return;for(let i=0;i<Math.min(count||1,2);i++){const pet=ps[(state.stats.petAssists+i)%ps.length],mode=(state.lastMode==="BURST"&&i===0)?"BURST":((state.stats.petAssists+i)%2?"BURST":"FOCUS");assistShot(pet,mode,i);}
  }
  function maybePetAssist(t){
    if(state.hype<45)return;const cadence=state.hype>=90?1150:state.hype>=72?1550:2350;if(t-state.lastAssistAt<cadence)return;
    state.lastAssistAt=t;assistBurst(state.hype>=92?2:1);
  }

  function particle(x,y,vx,vy,life,color,size,shape){
    if(state.particles.length>=60)state.particles.splice(0,state.particles.length-59);
    state.particles.push({x,y,vx,vy,life,max:life,color,size,shape:shape||"dot",rot:Math.random()*Math.PI*2});
  }
  function impact(x,y,mode,variant,scale){
    const m=MODES[mode],rare=variant==="STAR_CUT"||variant==="NOVA",n=rare?7:4;
    for(let i=0;i<n;i++){const a=Math.PI*2*i/n+Math.random()*.2,sp=35+Math.random()*(rare?100:65);particle(x,y,Math.cos(a)*sp,Math.sin(a)*sp-12,.20+Math.random()*.15,i%2?m.color:m.accent,(rare?3.8:2.8)+Math.random()*2,mode==="FOCUS"?"shard":"dot");}
    state.rings.push({x,y,r:mode==="BURST"?12:8,life:.22,max:.22,color:mode==="BURST"?m.accent:m.color,growth:mode==="BURST"?32:22});if(state.rings.length>16)state.rings.shift();
  }
  function pulseScreen(color,alpha){state.rings.push({screen:true,life:.12,max:.12,color,alpha});}

  function sample(s,q){const e=1-Math.pow(1-clamp(q,0,1),3),dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len,arc=Math.sin(Math.PI*e)*(s.mode==="FOCUS"?18:10)*Math.sin(s.seed);return {x:s.a.x+dx*e+nx*arc,y:s.a.y+dy*e+ny*arc,angle:Math.atan2(dy,dx)};}
  function update(dt,t){
    const seconds=dt/1000;if(t-state.lastTapAt>420)state.hype=Math.max(0,state.hype-seconds*(t<state.surgeUntil?2.2:6.5));
    if(state.hype<20)state.lastMilestone=0;else if(state.hype<45)state.lastMilestone=Math.min(state.lastMilestone,25);else if(state.hype<70)state.lastMilestone=Math.min(state.lastMilestone,50);else if(state.hype<92)state.lastMilestone=Math.min(state.lastMilestone,75);
    maybePetAssist(t);
    for(let i=state.shots.length-1;i>=0;i--){const s=state.shots[i];s.t+=seconds;if(s.t>=s.d){impact(s.b.x,s.b.y,s.mode,s.variant,s.scale);state.shots.splice(i,1);}}
    for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.life-=seconds;p.x+=p.vx*seconds;p.y+=p.vy*seconds;p.vy+=42*seconds;if(p.life<=0)state.particles.splice(i,1);}
    for(let i=state.rings.length-1;i>=0;i--){const r=state.rings[i];r.life-=seconds;if(r.life<=0)state.rings.splice(i,1);}
    for(let i=state.assists.length-1;i>=0;i--){const a=state.assists[i];a.life-=seconds;if(a.life<=0)state.assists.splice(i,1);}
  }

  function drawShot(c,s){
    const q=clamp(s.t/s.d,0,1),p=sample(s,q),z=s.scale||1,m=MODES[s.mode];c.save();
    if(s.mode==="FOCUS"){
      c.translate(p.x,p.y);c.rotate(p.angle+Math.PI/4);c.shadowBlur=8;c.shadowColor=m.color;c.globalAlpha=.92;
      if(s.variant==="COMET"){c.fillStyle=m.core;c.beginPath();c.moveTo(-10*z,-2*z);c.lineTo(6*z,0);c.lineTo(-10*z,2*z);c.closePath();c.fill();}
      else if(s.variant==="PRISM"){for(let i=-1;i<=1;i++){c.save();c.rotate(i*.28);c.fillStyle=i?m.color:m.core;c.beginPath();c.moveTo(0,-6*z);c.lineTo(4*z,0);c.lineTo(0,8*z);c.lineTo(-4*z,0);c.closePath();c.fill();c.restore();}}
      else if(s.variant==="STAR_CUT"){c.strokeStyle=m.core;c.lineWidth=2.2;c.beginPath();c.moveTo(-8*z,0);c.lineTo(8*z,0);c.moveTo(0,-8*z);c.lineTo(0,8*z);c.stroke();}
      else{c.fillStyle=m.core;c.beginPath();c.moveTo(0,-7*z);c.lineTo(4*z,0);c.lineTo(0,9*z);c.lineTo(-4*z,0);c.closePath();c.fill();}
    }else{
      c.translate(p.x,p.y);c.shadowBlur=8;c.shadowColor=m.accent;c.globalAlpha=.90;
      if(s.variant==="RING"){c.strokeStyle=m.color;c.lineWidth=3*z;c.beginPath();c.arc(0,0,9*z,0,Math.PI*2);c.stroke();}
      else if(s.variant==="BUBBLE"){c.fillStyle="rgba(255,210,143,.34)";c.strokeStyle=m.accent;c.lineWidth=1.5;c.beginPath();c.arc(0,0,10*z,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=m.core;c.beginPath();c.arc(-3*z,-3*z,2.5*z,0,Math.PI*2);c.fill();}
      else if(s.variant==="NOVA"){c.fillStyle=m.core;for(let i=0;i<6;i++){c.save();c.rotate(i*Math.PI/3);c.beginPath();c.moveTo(0,-13*z);c.lineTo(3*z,-4*z);c.lineTo(-3*z,-4*z);c.closePath();c.fill();c.restore();}}
      else{c.fillStyle=m.color;c.beginPath();c.arc(0,0,9*z,0,Math.PI*2);c.fill();c.fillStyle=m.core;c.beginPath();c.arc(-2.5*z,-2.5*z,3*z,0,Math.PI*2);c.fill();}
    }
    c.restore();
  }
  function drawParticles(c){for(const p of state.particles){const a=clamp(p.life/p.max,0,1);c.save();c.globalAlpha=a;c.fillStyle=p.color;c.translate(p.x,p.y);c.rotate(p.rot);if(p.shape==="shard"){c.beginPath();c.moveTo(0,-p.size*1.5);c.lineTo(p.size*.7,0);c.lineTo(0,p.size*1.5);c.lineTo(-p.size*.7,0);c.closePath();c.fill();}else{c.beginPath();c.arc(0,0,p.size,0,Math.PI*2);c.fill();}c.restore();}}
  function drawRings(c){for(const r of state.rings){const a=clamp(r.life/r.max,0,1);if(r.screen){c.save();c.globalAlpha=(r.alpha||.04)*a;c.fillStyle=r.color;c.fillRect(0,0,innerWidth,innerHeight);c.restore();continue;}const q=1-a;c.save();c.globalAlpha=a*.48;c.strokeStyle=r.color;c.lineWidth=1.6;c.beginPath();c.arc(r.x,r.y,r.r+q*r.growth,0,Math.PI*2);c.stroke();c.restore();}}
  function drawAssists(c,t){for(const a of state.assists){const p=a.pet;if(!p)continue;const life=clamp(a.life/a.max,0,1),m=MODES[a.mode],pulse=.5+.5*Math.sin(t/95);c.save();c.globalAlpha=.28*life;c.strokeStyle=m.color;c.lineWidth=1.6;c.beginPath();c.arc(p.x,p.y,28+pulse*7,0,Math.PI*2);c.stroke();c.globalAlpha=.70*life;c.fillStyle=m.core;const ang=t/360+(String(p.id||"").length*.8);c.beginPath();c.arc(p.x+Math.cos(ang)*34,p.y+Math.sin(ang)*22,3.5,0,Math.PI*2);c.fill();c.restore();}}
  function drawHype(c,t){
    if(state.hype<35)return;const l=triggerLayout(),left=l.FOCUS.x,right=l.BURST.x+l.BURST.w,y=l.FOCUS.y-7,w=right-left,p=state.hype/100;c.save();c.globalAlpha=.16+.22*p;c.lineCap="round";c.lineWidth=2;c.strokeStyle=state.hype>=90?"#ffffff":state.hype>=70?"#ffe59a":"#bcefff";c.beginPath();c.moveTo(left,y);c.lineTo(left+w*p,y);c.stroke();if(t<state.surgeUntil){c.globalAlpha=.12+.05*Math.sin(t/90);c.strokeStyle="#ffffff";c.lineWidth=4;c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();}c.restore();
  }
  function render(t){const c=state.ctx;if(!c)return;c.clearRect(0,0,innerWidth,innerHeight);for(const s of state.shots)drawShot(c,s);drawParticles(c);drawRings(c);drawAssists(c,t);drawHype(c,t);}

  function loop(t){
    const dt=Math.min(50,t-state.lastFrame||16.7);state.lastFrame=t;state.frameMs=state.frameMs*.9+dt*.1;
    state.quality=state.frameMs>28?"LOW":state.frameMs>21?"MEDIUM":"FULL";
    if(state.quality==="LOW"&&state.particles.length>34)state.particles.splice(0,state.particles.length-34);
    update(dt,t);render(t);requestAnimationFrame(loop);
  }

  function init(){
    if(state.ready)return;state.ready=true;createCanvas();
    document.addEventListener("pointerdown",onPointerDown,true);
    requestAnimationFrame(loop);emit("excitement_ready",{performanceBudget:true,petAssist:true,shotVariation:true});
  }

  const api={
    version:VERSION,
    diagnostics:()=>({version:VERSION,hype:Math.round(state.hype),peak:Math.round(state.peak),surge:now()<state.surgeUntil,quality:state.quality,activeShots:state.shots.length,particles:state.particles.length,...state.stats}),
    setEnabled:v=>(state.enabled=!!v),
    forceAssist:()=>assistBurst(1),
    setHype:v=>(state.hype=clamp(Number(v)||0,0,100))
  };
  window.ExcitementPetV302=api;init();
})();
