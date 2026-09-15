(() => {
  "use strict";

  const VERSION="TAP_RUSH_V30_4";
  const PREVIOUS_VERSION="EXCITEMENT_PET_V30_3";
  const MODES={
    FOCUS:{color:"#a9efff",accent:"#b8b7ff",core:"#f7ffff"},
    BURST:{color:"#ffd28f",accent:"#ff9fc8",core:"#fff8dc"}
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>performance.now();

  const state={
    ready:false,enabled:true,canvas:null,ctx:null,lastFrame:now(),frameMs:16.7,quality:"FULL",
    hype:0,peak:0,lastTapAt:0,lastMode:null,tapTimes:[],lastMilestone:0,surgeUntil:0,lastSurgeVolleyAt:0,
    held:new Map(),shots:[],particles:[],rings:[],assists:[],lastAssistAt:0,lastHeavyAccentAt:0,
    virtualPresses:0,virtualShots:0,diagHooked:false,originalDiagnostics:null,
    stats:{physicalTaps:0,holdShots:0,visualShots:0,petAssists:0,heavyAccents:0}
  };

  function triggerLayout(){
    const total=Math.min(366,innerWidth-22),gap=12,h=Math.min(88,Math.max(72,innerHeight*.105)),half=(total-gap)/2;
    const left=(innerWidth-total)/2,top=innerHeight-h-Math.max(10,innerHeight*.018);
    return {FOCUS:{x:left,y:top,w:half,h},BURST:{x:left+half+gap,y:top,w:half,h}};
  }
  function modeAt(x,y){const l=triggerLayout();for(const mode of ["FOCUS","BURST"]){const r=l[mode];if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return mode;}return null;}
  function originFor(mode){const r=triggerLayout()[mode];return {x:r.x+r.w*.5,y:r.y+10};}
  function v30Diag(){try{return window.DualTriggerV30&&window.DualTriggerV30.diagnostics?window.DualTriggerV30.diagnostics():null;}catch(_){return null;}}
  function phase(){const d=v30Diag();return d&&d.phase||"RUN";}
  function activePets(){try{const d=state.originalDiagnostics?state.originalDiagnostics():window.InfiniteClick&&window.InfiniteClick.diagnostics?window.InfiniteClick.diagnostics():null;return d&&Array.isArray(d.pets)?d.pets.filter(p=>p&&p.active&&Number.isFinite(p.x)&&Number.isFinite(p.y)):[];}catch(_){return [];}}
  function targetPoint(excludePetId){
    const d=v30Diag();if(d&&d.recipe&&d.recipe.boss)return {x:innerWidth*.5,y:innerHeight*.39};
    const ps=activePets().filter(p=>!excludePetId||p.id!==excludePetId);if(ps.length&&Math.random()<.72){const p=ps[Math.floor(Math.random()*ps.length)];return {x:p.x,y:p.y,pet:p};}
    return {x:innerWidth*(.18+Math.random()*.64),y:innerHeight*(.20+Math.random()*.44)};
  }

  function emit(type,payload){const detail={type,at:Date.now(),version:VERSION,hype:Math.round(state.hype),peak:Math.round(state.peak),...(payload||{})};try{window.dispatchEvent(new CustomEvent("crew:game-event",{detail}));}catch(_){}try{window.AndroidGame&&AndroidGame.onGameEvent&&AndroidGame.onGameEvent(JSON.stringify(detail));}catch(_){}}

  function installDiagnosticsBridge(){
    if(state.diagHooked)return true;
    const api=window.InfiniteClick;if(!api||typeof api.diagnostics!=="function")return false;
    const original=api.diagnostics.bind(api);state.originalDiagnostics=original;
    api.diagnostics=function(){const d=original()||{};return {...d,buttonPresses:(Number(d.buttonPresses)||0)+state.virtualPresses,buttonShots:(Number(d.buttonShots)||0)+state.virtualShots};};
    state.diagHooked=true;return true;
  }

  function createCanvas(){
    const c=document.createElement("canvas");c.id="tap-rush-v30-4-overlay";c.style.cssText="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:26;";
    document.body.appendChild(c);state.canvas=c;state.ctx=c.getContext("2d",{alpha:true});resize();addEventListener("resize",resize,{passive:true});
  }
  function resize(){if(!state.canvas)return;const dpr=Math.min(devicePixelRatio||1,1.25);state.canvas.width=Math.max(1,Math.floor(innerWidth*dpr));state.canvas.height=Math.max(1,Math.floor(innerHeight*dpr));state.ctx.setTransform(dpr,0,0,dpr,0,0);}

  function registerPhysicalTap(mode,t){
    state.stats.physicalTaps++;state.virtualPresses+=1;state.virtualShots+=1;state.tapTimes.push(t);while(state.tapTimes.length&&t-state.tapTimes[0]>1000)state.tapTimes.shift();
    const rate=state.tapTimes.length,alternating=state.lastMode&&state.lastMode!==mode&&t-state.lastTapAt<240;
    const gain=2.4+Math.min(4.6,rate*.30)+(alternating?1.4:0)+(t<state.surgeUntil?.8:0);
    state.hype=clamp(state.hype+gain,0,100);state.peak=Math.max(state.peak,state.hype);state.lastTapAt=t;state.lastMode=mode;maybeMilestone(t);
  }
  function maybeMilestone(t){
    const level=state.hype>=95?100:state.hype>=75?75:state.hype>=50?50:state.hype>=25?25:0;if(level<=state.lastMilestone)return;state.lastMilestone=level;
    if(level===25)emit("hype_level",{level,label:"WARM"});
    if(level===50){emit("hype_level",{level,label:"RUSH"});assistBurst(1);}
    if(level===75){emit("hype_level",{level,label:"FEVER"});assistBurst(1);pulseScreen(MODES[state.lastMode||"FOCUS"].color,.025);}
    if(level===100){state.surgeUntil=t+4200;state.lastSurgeVolleyAt=0;emit("surge_start",{durationMs:4200,label:"SURGE"});assistBurst(2);pulseScreen("#fff",.06);heavyAccent(state.lastMode||"FOCUS",t,true);}
  }

  function hypeTier(){return state.hype>=95?4:state.hype>=75?3:state.hype>=50?2:state.hype>=25?1:0;}
  function shotCap(){return state.quality==="LOW"?16:state.quality==="MEDIUM"?22:28;}
  function particleCap(){return state.quality==="LOW"?18:state.quality==="MEDIUM"?28:40;}
  function pushShot(s){const cap=shotCap();if(state.shots.length>=cap)state.shots.splice(0,state.shots.length-cap+1);state.shots.push(s);state.stats.visualShots++;}
  function particle(x,y,vx,vy,life,color,size,shape){const cap=particleCap();if(state.particles.length>=cap)state.particles.splice(0,state.particles.length-cap+1);state.particles.push({x,y,vx,vy,life,max:life,color,size,shape:shape||"dot",rot:Math.random()*Math.PI*2});}
  function ring(x,y,r,color,growth,life=.20){state.rings.push({x,y,r,growth,life,max:life,color});if(state.rings.length>10)state.rings.shift();}
  function pulseScreen(color,alpha){state.rings.push({screen:true,life:.10,max:.10,color,alpha});if(state.rings.length>10)state.rings.shift();}

  function variantsFor(mode,tier){
    if(mode==="FOCUS")return tier>=4?["STAR_CUT","COMET","PRISM"]:tier>=3?["COMET","PRISM","STAR_CUT"]:tier>=2?["PRISM","COMET"]:tier>=1?["NEEDLE","PRISM"]:["NEEDLE"];
    return tier>=4?["NOVA","RING","BUBBLE"]:tier>=3?["RING","BUBBLE","NOVA"]:tier>=2?["BUBBLE","RING"]:tier>=1?["ORB","RING"]:["ORB"];
  }
  function variantFor(mode,index,tier){const v=variantsFor(mode,tier),rare=tier>=3&&((state.stats.physicalTaps+index)%7===0);return rare?(mode==="FOCUS"?"STAR_CUT":"NOVA"):v[(state.stats.physicalTaps+index)%v.length];}

  function spawnShot(mode,opts={}){
    const tier=opts.tier==null?hypeTier():opts.tier,a=opts.origin||originFor(mode),b=opts.target||targetPoint(opts.excludePetId),variant=opts.variant||variantFor(mode,opts.index||0,tier);
    const spread=Number(opts.spread)||0,ang=(Math.random()-.5)*spread,dx=b.x-a.x,dy=b.y-a.y,ca=Math.cos(ang),sa=Math.sin(ang),target={x:a.x+dx*ca-dy*sa,y:a.y+dx*sa+dy*ca};
    pushShot({mode,variant,a:{x:a.x,y:a.y},b:target,t:0,d:opts.duration||((mode==="FOCUS"?.155:.205)*(opts.hold?1.18:1)),seed:Math.random()*12,scale:opts.scale||1,assist:!!opts.assist,hold:!!opts.hold});
  }
  function spawnTapVolley(mode){
    if(phase()==="QUIET"){const a=originFor(mode);ring(a.x,a.y-12,10,MODES[mode].color,22,.24);return;}
    const tier=hypeTier(),count=state.quality==="LOW"?Math.min(2,1+Math.floor(tier/2)):tier>=4?4:tier>=3?3:tier>=1?2:1;
    const spread=count>1?.12:0;for(let i=0;i<count;i++)spawnShot(mode,{tier,index:i,spread,scale:1+tier*.06+(i%2)*.04});
    if(tier>=2&&state.stats.physicalTaps%4===0){const other=mode==="FOCUS"?"BURST":"FOCUS";spawnShot(other,{tier:Math.max(1,tier-1),index:count,scale:.86});}
    if(tier>=3&&state.stats.physicalTaps%3===0)assistBurst(tier>=4?2:1);
    if(tier>=4&&state.stats.physicalTaps%5===0)pulseScreen("#fff",.022);
  }

  function heavyAccent(mode,t,force){
    if(state.quality==="LOW")return false;const gap=force?900:state.hype>=95?1500:2200;if(t-state.lastHeavyAccentAt<gap)return false;
    state.lastHeavyAccentAt=t;try{if(window.DualTriggerV30&&typeof window.DualTriggerV30.fire==="function"){window.DualTriggerV30.fire(mode);state.stats.heavyAccents++;return true;}}catch(_){}return false;
  }

  function onPointerDown(e){
    if(!state.enabled||!e.isTrusted)return;const mode=modeAt(e.clientX,e.clientY);if(!mode)return;const t=now();installDiagnosticsBridge();registerPhysicalTap(mode,t);spawnTapVolley(mode);
    state.held.set(e.pointerId,{mode,startedAt:t,lastFireAt:t,x:e.clientX,y:e.clientY});
    const tier=hypeTier();if(tier>=2&&state.stats.physicalTaps%6===0)heavyAccent(mode,t,false);
    try{if(window.GameHaptics)window.GameHaptics.perform(tier>=3?"MEDIUM_TAP":"SOFT_TAP",.14+.16*tier/4);}catch(_){}
    if(e.cancelable)try{e.preventDefault();}catch(_){}e.stopImmediatePropagation();e.stopPropagation();
  }
  function onPointerUp(e){state.held.delete(e.pointerId);}

  function updateHoldFire(t){
    for(const h of state.held.values()){
      if(t-h.startedAt<310)continue;const cadence=state.hype>=75?320:380;if(t-h.lastFireAt<cadence)continue;h.lastFireAt=t;state.stats.holdShots++;state.virtualPresses+=.55;state.virtualShots+=.55;
      spawnShot(h.mode,{hold:true,tier:Math.min(2,hypeTier()),scale:.90});
      if(state.stats.holdShots%5===0)try{if(window.GameHaptics)window.GameHaptics.perform("SOFT_TAP",.10);}catch(_){}
    }
  }

  function assistShot(pet,mode,index){
    if(!pet)return;const tier=Math.max(2,hypeTier()),target=targetPoint(pet.id);spawnShot(mode,{origin:{x:pet.x,y:pet.y-10},target,tier,index,assist:true,excludePetId:pet.id,scale:1.08});
    state.assists.push({pet,life:.55,max:.55,mode});if(state.assists.length>5)state.assists.shift();state.stats.petAssists++;emit("pet_assist",{petId:pet.id||null,petType:pet.type||null,mode,tier});
  }
  function assistBurst(count){const ps=activePets();if(!ps.length)return;for(let i=0;i<Math.min(count||1,2);i++){const pet=ps[(state.stats.petAssists+i)%ps.length],mode=i%2?"BURST":(state.lastMode||"FOCUS");assistShot(pet,mode,i);}}
  function maybePetAssist(t){
    const tier=hypeTier();if(tier<2)return;const cadence=tier>=4?520:tier>=3?850:1400;if(t-state.lastAssistAt<cadence)return;state.lastAssistAt=t;assistBurst(tier>=4?2:1);
  }
  function maybeSurgeVolley(t){
    if(t>=state.surgeUntil||phase()==="QUIET")return;if(t-state.lastSurgeVolleyAt<(state.quality==="LOW"?360:240))return;state.lastSurgeVolleyAt=t;
    const mode=state.lastMode||((Math.floor(t/500)%2)?"FOCUS":"BURST");spawnShot(mode,{tier:4,scale:1.12});if(state.quality!=="LOW")spawnShot(mode==="FOCUS"?"BURST":"FOCUS",{tier:3,scale:.9});
  }

  function impact(s){
    const m=MODES[s.mode],rare=s.variant==="STAR_CUT"||s.variant==="NOVA",tier=hypeTier(),n=state.quality==="LOW"?(rare?3:1):Math.min(6,(rare?4:2)+Math.floor(tier/2));
    for(let i=0;i<n;i++){const a=Math.PI*2*i/n+Math.random()*.25,sp=26+Math.random()*(rare?82:48);particle(s.b.x,s.b.y,Math.cos(a)*sp,Math.sin(a)*sp-8,.16+Math.random()*.12,i%2?m.color:m.accent,(rare?3.8:2.7)+Math.random()*1.2,s.mode==="FOCUS"?"shard":"dot");}
    ring(s.b.x,s.b.y,s.mode==="BURST"?13:8,s.mode==="BURST"?m.accent:m.color,s.mode==="BURST"?34:22,.18);
  }
  function sample(s,q){const e=1-Math.pow(1-clamp(q,0,1),3),dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len,arc=Math.sin(Math.PI*e)*(s.mode==="FOCUS"?18:11)*Math.sin(s.seed);return {x:s.a.x+dx*e+nx*arc,y:s.a.y+dy*e+ny*arc,angle:Math.atan2(dy,dx)};}

  function update(dt,t){
    const sec=dt/1000;if(t-state.lastTapAt>430)state.hype=Math.max(0,state.hype-sec*(t<state.surgeUntil?1.4:7.4));
    if(state.hype<18)state.lastMilestone=0;else if(state.hype<45)state.lastMilestone=Math.min(state.lastMilestone,25);else if(state.hype<70)state.lastMilestone=Math.min(state.lastMilestone,50);else if(state.hype<92)state.lastMilestone=Math.min(state.lastMilestone,75);
    updateHoldFire(t);maybePetAssist(t);maybeSurgeVolley(t);
    for(let i=state.shots.length-1;i>=0;i--){const s=state.shots[i];s.t+=sec;if(s.t>=s.d){impact(s);state.shots.splice(i,1);}}
    for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.life-=sec;p.x+=p.vx*sec;p.y+=p.vy*sec;p.vy+=32*sec;p.rot+=2.2*sec;if(p.life<=0)state.particles.splice(i,1);}
    for(let i=state.rings.length-1;i>=0;i--){state.rings[i].life-=sec;if(state.rings[i].life<=0)state.rings.splice(i,1);}
    for(let i=state.assists.length-1;i>=0;i--){state.assists[i].life-=sec;if(state.assists[i].life<=0)state.assists.splice(i,1);}
  }

  function drawShot(c,s){
    const q=clamp(s.t/s.d,0,1),p=sample(s,q),z=s.scale||1,m=MODES[s.mode];c.save();c.translate(p.x,p.y);c.globalAlpha=.96;
    if(s.mode==="FOCUS"){
      c.rotate(p.angle);if(s.variant==="NEEDLE"){c.fillStyle=m.core;c.beginPath();c.moveTo(15*z,0);c.lineTo(-9*z,-2.2*z);c.lineTo(-4*z,0);c.lineTo(-9*z,2.2*z);c.closePath();c.fill();}
      else if(s.variant==="PRISM"){c.rotate(Math.PI/4);for(let i=-1;i<=1;i++){c.fillStyle=i?m.color:m.core;c.fillRect((-4+i*7)*z,-4*z,8*z,8*z);}}
      else if(s.variant==="COMET"){c.strokeStyle=m.color;c.lineWidth=2.8*z;c.beginPath();c.moveTo(-18*z,0);c.lineTo(12*z,0);c.stroke();c.fillStyle=m.core;c.beginPath();c.moveTo(16*z,0);c.lineTo(2*z,-6*z);c.lineTo(4*z,0);c.lineTo(2*z,6*z);c.closePath();c.fill();}
      else{c.strokeStyle=m.core;c.lineWidth=2.5*z;c.beginPath();for(let i=0;i<4;i++){const a=i*Math.PI/4;c.moveTo(Math.cos(a)*-13*z,Math.sin(a)*-13*z);c.lineTo(Math.cos(a)*13*z,Math.sin(a)*13*z);}c.stroke();}
    }else{
      if(s.variant==="RING"){c.strokeStyle=m.color;c.lineWidth=3.8*z;c.beginPath();c.arc(0,0,12*z,0,Math.PI*2);c.stroke();}
      else if(s.variant==="BUBBLE"){c.fillStyle="rgba(255,210,143,.26)";c.strokeStyle=m.accent;c.lineWidth=2*z;c.beginPath();c.arc(0,0,12*z,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=m.core;c.beginPath();c.arc(-4*z,-4*z,3*z,0,Math.PI*2);c.fill();}
      else if(s.variant==="NOVA"){c.fillStyle=m.core;for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);c.beginPath();c.moveTo(0,-17*z);c.lineTo(3*z,-5*z);c.lineTo(-3*z,-5*z);c.closePath();c.fill();c.restore();}}
      else{c.fillStyle=m.color;c.beginPath();c.arc(0,0,11*z,0,Math.PI*2);c.fill();c.fillStyle=m.core;c.beginPath();c.arc(-3*z,-3*z,3.2*z,0,Math.PI*2);c.fill();}
    }
    c.restore();
  }
  function drawParticles(c){for(const p of state.particles){const a=clamp(p.life/p.max,0,1);c.save();c.globalAlpha=a;c.fillStyle=p.color;c.translate(p.x,p.y);c.rotate(p.rot);if(p.shape==="shard"){c.beginPath();c.moveTo(0,-p.size*1.5);c.lineTo(p.size*.6,0);c.lineTo(0,p.size*1.25);c.lineTo(-p.size*.5,0);c.closePath();c.fill();}else{c.beginPath();c.arc(0,0,p.size,0,Math.PI*2);c.fill();}c.restore();}}
  function drawRings(c){for(const r of state.rings){const a=clamp(r.life/r.max,0,1);if(r.screen){c.save();c.globalAlpha=(r.alpha||.04)*a;c.fillStyle=r.color;c.fillRect(0,0,innerWidth,innerHeight);c.restore();continue;}const q=1-a;c.save();c.globalAlpha=a*.48;c.strokeStyle=r.color;c.lineWidth=1.7;c.beginPath();c.arc(r.x,r.y,r.r+q*r.growth,0,Math.PI*2);c.stroke();c.restore();}}
  function drawAssists(c,t){for(const a of state.assists){const p=a.pet;if(!p)continue;const life=clamp(a.life/a.max,0,1),m=MODES[a.mode],pulse=.5+.5*Math.sin(t/80);c.save();c.globalAlpha=.42*life;c.strokeStyle=m.color;c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,28+pulse*10,0,Math.PI*2);c.stroke();c.globalAlpha=.9*life;c.fillStyle=m.core;const ang=t/260+(String(p.id||"").length*.8);c.beginPath();c.arc(p.x+Math.cos(ang)*38,p.y+Math.sin(ang)*25,4,0,Math.PI*2);c.fill();c.restore();}}
  function drawHype(c,t){
    const tier=hypeTier();if(tier===0)return;const l=triggerLayout(),left=l.FOCUS.x,right=l.BURST.x+l.BURST.w,y=l.FOCUS.y-8,p=state.hype/100;c.save();c.lineCap="round";c.globalAlpha=.30+.14*tier;c.strokeStyle=tier>=4?"#fff":tier>=3?"#ffe594":tier>=2?"#ffc4e5":"#bcefff";c.lineWidth=tier>=4?4:2.5;c.beginPath();c.moveTo(left,y);c.lineTo(left+(right-left)*p,y);c.stroke();
    const label=tier>=4?"SURGE":tier>=3?"FEVER":tier>=2?"RUSH":"WARM";c.globalAlpha=.72;c.fillStyle=c.strokeStyle;c.font=`${tier>=4?"900 12px":"800 9px"} system-ui,-apple-system,sans-serif`;c.textAlign="center";c.fillText(label,(left+right)/2,y-7);c.restore();
  }
  function render(t){const c=state.ctx;if(!c)return;c.clearRect(0,0,innerWidth,innerHeight);for(const s of state.shots)drawShot(c,s);drawParticles(c);drawRings(c);drawAssists(c,t);drawHype(c,t);}

  function loop(t){
    installDiagnosticsBridge();const dt=Math.min(50,t-state.lastFrame||16.7);state.lastFrame=t;state.frameMs=state.frameMs*.9+dt*.1;state.quality=state.frameMs>28?"LOW":state.frameMs>21?"MEDIUM":"FULL";
    const cap=shotCap();if(state.shots.length>cap)state.shots.splice(0,state.shots.length-cap);const pcap=particleCap();if(state.particles.length>pcap)state.particles.splice(0,state.particles.length-pcap);
    update(dt,t);render(t);requestAnimationFrame(loop);
  }

  function init(){
    if(state.ready)return;state.ready=true;createCanvas();installDiagnosticsBridge();
    document.addEventListener("pointerdown",onPointerDown,true);document.addEventListener("pointerup",onPointerUp,true);document.addEventListener("pointercancel",onPointerUp,true);
    requestAnimationFrame(loop);emit("tap_rush_ready",{tapRush:true,holdFire:true,hypeTiers:true,petAssist:true,virtualDiagnostics:true});
  }

  const api={
    version:VERSION,previousVersion:PREVIOUS_VERSION,
    diagnostics:()=>({version:VERSION,hype:Math.round(state.hype),peak:Math.round(state.peak),tier:hypeTier(),surge:now()<state.surgeUntil,quality:state.quality,held:state.held.size,activeShots:state.shots.length,particles:state.particles.length,virtualPresses:Math.round(state.virtualPresses*100)/100,...state.stats}),
    setEnabled:v=>(state.enabled=!!v),setHype:v=>(state.hype=clamp(Number(v)||0,0,100)),forceAssist:()=>assistBurst(1),forceSurge:()=>{state.hype=100;state.surgeUntil=now()+4200;}
  };
  window.TapRushV304=api;window.ExcitementPetV303=api;window.ExcitementPetV302=api;init();
})();
