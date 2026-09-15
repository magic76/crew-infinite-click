(() => {
  "use strict";

  const VERSION="IMPACT_PASS_V30_5";
  const PREVIOUS_VERSION="TAP_RUSH_V30_4";
  const V30_4_COMPAT="TAP_RUSH_V30_4";
  const MODES={
    FOCUS:{color:"#a9efff",accent:"#b8b7ff",core:"#f7ffff"},
    BURST:{color:"#ffd28f",accent:"#ff9fc8",core:"#fff8dc"}
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>performance.now();
  const rand=(a,b)=>a+Math.random()*(b-a);

  const state={
    ready:false,enabled:true,canvas:null,ctx:null,lastFrame:now(),frameMs:16.7,quality:"FULL",
    hype:0,peak:0,lastTapAt:0,lastMode:null,tapTimes:[],lastMilestone:0,surgeUntil:0,lastSurgeVolleyAt:0,
    held:new Map(),shots:[],particles:[],rings:[],assists:[],lastAssistAt:0,lastHeavyAccentAt:0,
    virtualPresses:0,virtualShots:0,diagHooked:false,originalDiagnostics:null,
    nextHeroAt:10,hitStopUntil:0,punch:0,punchLife:0,lastComboAt:0,
    stats:{physicalTaps:0,holdShots:0,visualShots:0,petAssists:0,heavyAccents:0,heroShots:0,petCombos:0}
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
    if(level===25){emit("hype_level",{level,label:"WARM"});pulseScreen(MODES[state.lastMode||"FOCUS"].color,.018);}
    if(level===50){emit("hype_level",{level,label:"RUSH"});assistBurst(1);pulseScreen(MODES[state.lastMode||"FOCUS"].color,.028);}
    if(level===75){emit("hype_level",{level,label:"FEVER"});assistBurst(1);pulseScreen(MODES[state.lastMode||"FOCUS"].color,.045);}
    if(level===100){state.surgeUntil=t+4200;state.lastSurgeVolleyAt=0;emit("surge_start",{durationMs:4200,label:"SURGE"});petCombo(true);pulseScreen("#fff",.09);heavyAccent(state.lastMode||"FOCUS",t,true);state.punch=Math.max(state.punch,8);state.punchLife=.28;}
  }

  function hypeTier(){return state.hype>=95?4:state.hype>=75?3:state.hype>=50?2:state.hype>=25?1:0;}
  function shotCap(){return state.quality==="LOW"?16:state.quality==="MEDIUM"?22:28;}
  function particleCap(){return state.quality==="LOW"?18:state.quality==="MEDIUM"?28:40;}
  function ringCap(){return state.quality==="LOW"?8:12;}
  function pushShot(s){const cap=shotCap();if(state.shots.length>=cap)state.shots.splice(0,state.shots.length-cap+1);state.shots.push(s);state.stats.visualShots++;}
  function particle(x,y,vx,vy,life,color,size,shape){const cap=particleCap();if(state.particles.length>=cap)state.particles.splice(0,state.particles.length-cap+1);state.particles.push({x,y,vx,vy,life,max:life,color,size,shape:shape||"dot",rot:Math.random()*Math.PI*2});}
  function ring(x,y,r,color,growth,life=.20,kind="ring",width=1.7){state.rings.push({x,y,r,growth,life,max:life,color,kind,width});if(state.rings.length>ringCap())state.rings.shift();}
  function pulseScreen(color,alpha){state.rings.push({screen:true,life:.10,max:.10,color,alpha});if(state.rings.length>ringCap())state.rings.shift();}

  function variantsFor(mode,tier){
    if(mode==="FOCUS")return tier>=4?["STAR_CUT","COMET","PRISM"]:tier>=3?["COMET","PRISM","STAR_CUT"]:tier>=2?["PRISM","COMET"]:tier>=1?["NEEDLE","PRISM"]:["NEEDLE"];
    return tier>=4?["NOVA","RING","BUBBLE"]:tier>=3?["RING","BUBBLE","NOVA"]:tier>=2?["BUBBLE","RING"]:tier>=1?["ORB","RING"]:["ORB"];
  }
  function variantFor(mode,index,tier){const v=variantsFor(mode,tier),rare=tier>=3&&((state.stats.physicalTaps+index)%7===0);return rare?(mode==="FOCUS"?"STAR_CUT":"NOVA"):v[(state.stats.physicalTaps+index)%v.length];}

  function muzzleFx(mode,tier,hero){
    const a=originFor(mode),m=MODES[mode],n=state.quality==="LOW"?1:hero?5:Math.min(3,1+Math.floor(tier/2));
    ring(a.x,a.y-10,hero?12:7,hero?m.core:m.color,hero?30:16,hero?.16:.11,mode==="FOCUS"?"focusMuzzle":"burstMuzzle",hero?3.2:2);
    for(let i=0;i<n;i++){const ang=(mode==="FOCUS"?-Math.PI/2:Math.PI*2*i/Math.max(1,n))+rand(-.28,.28),sp=hero?rand(70,130):rand(34,74);particle(a.x,a.y-10,Math.cos(ang)*sp,Math.sin(ang)*sp,.10+Math.random()*.09,i%2?m.accent:m.core,hero?3.4:2.3,mode==="FOCUS"?"shard":"dot");}
  }

  function spawnShot(mode,opts={}){
    const tier=opts.tier==null?hypeTier():opts.tier,a=opts.origin||originFor(mode),b=opts.target||targetPoint(opts.excludePetId),hero=!!opts.hero,variant=opts.variant||(hero?(mode==="FOCUS"?"STAR_CUT":"NOVA"):variantFor(mode,opts.index||0,tier));
    const spread=Number(opts.spread)||0,ang=(Math.random()-.5)*spread,dx=b.x-a.x,dy=b.y-a.y,ca=Math.cos(ang),sa=Math.sin(ang),target={x:a.x+dx*ca-dy*sa,y:a.y+dx*sa+dy*ca};
    const base=(mode==="FOCUS"?.155:.205),speed=Math.max(.72,1-tier*.045),duration=opts.duration||base*speed*(opts.hold?1.18:1)*(hero?.90:1);
    pushShot({mode,variant,a:{x:a.x,y:a.y},b:target,t:0,d:duration,seed:Math.random()*12,scale:(opts.scale||1)*(hero?1.65:1),assist:!!opts.assist,hold:!!opts.hold,hero,tier});
  }
  function shouldHero(){return state.stats.physicalTaps>=state.nextHeroAt&&phase()!=="QUIET";}
  function scheduleNextHero(){state.nextHeroAt=state.stats.physicalTaps+8+Math.floor(Math.random()*6);}
  function spawnHeroShot(mode,tier){
    state.stats.heroShots++;scheduleNextHero();spawnShot(mode,{tier:Math.max(1,tier),hero:true,scale:1.08});muzzleFx(mode,tier,true);
    emit("hero_shot",{mode,tier,count:state.stats.heroShots});try{if(window.GameHaptics)window.GameHaptics.perform("HARD_TAP",.48);}catch(_){}
  }
  function spawnTapVolley(mode){
    if(phase()==="QUIET"){const a=originFor(mode);ring(a.x,a.y-12,10,MODES[mode].color,22,.24);return;}
    const tier=hypeTier(),hero=shouldHero();muzzleFx(mode,tier,hero);
    const count=state.quality==="LOW"?Math.min(2,1+Math.floor(tier/2)):tier>=4?4:tier>=3?3:tier>=1?2:1;
    const spread=count>1?.12:0;if(hero)spawnHeroShot(mode,tier);for(let i=0;i<count;i++)spawnShot(mode,{tier,index:i,spread,scale:1+tier*.10+(i%2)*.05});
    if(tier>=2&&state.stats.physicalTaps%4===0){const other=mode==="FOCUS"?"BURST":"FOCUS";spawnShot(other,{tier:Math.max(1,tier-1),index:count,scale:.94});}
    if(tier>=3&&state.stats.physicalTaps%3===0)assistBurst(tier>=4?2:1);
    if(tier>=4&&state.stats.physicalTaps%6===0)petCombo(false);
    if(tier>=4&&state.stats.physicalTaps%5===0)pulseScreen("#fff",.030);
  }

  function heavyAccent(mode,t,force){
    if(state.quality==="LOW")return false;const gap=force?900:state.hype>=95?1700:2500;if(t-state.lastHeavyAccentAt<gap)return false;
    state.lastHeavyAccentAt=t;try{if(window.DualTriggerV30&&typeof window.DualTriggerV30.fire==="function"){window.DualTriggerV30.fire(mode);state.stats.heavyAccents++;return true;}}catch(_){}return false;
  }

  function onPointerDown(e){
    if(!state.enabled||!e.isTrusted)return;const mode=modeAt(e.clientX,e.clientY);if(!mode)return;const t=now();installDiagnosticsBridge();registerPhysicalTap(mode,t);spawnTapVolley(mode);
    state.held.set(e.pointerId,{mode,startedAt:t,lastFireAt:t,x:e.clientX,y:e.clientY});
    const tier=hypeTier();if(tier>=3&&state.stats.physicalTaps%10===0)heavyAccent(mode,t,false);
    try{if(window.GameHaptics)window.GameHaptics.perform(tier>=3?"MEDIUM_TAP":"SOFT_TAP",.15+.18*tier/4);}catch(_){}
    if(e.cancelable)try{e.preventDefault();}catch(_){}e.stopImmediatePropagation();e.stopPropagation();
  }
  function onPointerUp(e){state.held.delete(e.pointerId);}

  function updateHoldFire(t){
    for(const h of state.held.values()){
      if(t-h.startedAt<310)continue;const cadence=state.hype>=75?320:380;if(t-h.lastFireAt<cadence)continue;h.lastFireAt=t;state.stats.holdShots++;state.virtualPresses+=.55;state.virtualShots+=.55;
      spawnShot(h.mode,{hold:true,tier:Math.min(2,hypeTier()),scale:.94});if(state.stats.holdShots%2===0)muzzleFx(h.mode,Math.min(2,hypeTier()),false);
      if(state.stats.holdShots%5===0)try{if(window.GameHaptics)window.GameHaptics.perform("SOFT_TAP",.10);}catch(_){}
    }
  }

  function assistShot(pet,mode,index,target,combo){
    if(!pet)return;const tier=Math.max(2,hypeTier()),dest=target||targetPoint(pet.id);spawnShot(mode,{origin:{x:pet.x,y:pet.y-10},target:dest,tier,index,assist:true,excludePetId:pet.id,scale:combo?1.35:1.10,hero:!!combo});
    state.assists.push({pet,target:dest,life:combo?.72:.55,max:combo?.72:.55,mode,combo:!!combo});if(state.assists.length>6)state.assists.shift();state.stats.petAssists++;emit("pet_assist",{petId:pet.id||null,petType:pet.type||null,mode,tier,combo:!!combo});
  }
  function assistBurst(count){const ps=activePets();if(!ps.length)return;for(let i=0;i<Math.min(count||1,2);i++){const pet=ps[(state.stats.petAssists+i)%ps.length],mode=i%2?"BURST":(state.lastMode||"FOCUS");assistShot(pet,mode,i,null,false);}}
  function petCombo(force){
    const t=now(),ps=activePets();if(ps.length<2||(!force&&t-state.lastComboAt<1500))return false;state.lastComboAt=t;state.stats.petCombos++;
    const target=targetPoint(),a=ps[state.stats.petCombos%ps.length],b=ps[(state.stats.petCombos+1)%ps.length];assistShot(a,"FOCUS",0,target,true);assistShot(b,"BURST",1,target,true);
    ring(target.x,target.y,14,"#ffffff",54,.28,"combo",3.8);pulseScreen("#ffffff",.045);emit("pet_combo",{count:state.stats.petCombos,tier:hypeTier()});return true;
  }
  function maybePetAssist(t){
    const tier=hypeTier();if(tier<2)return;const cadence=tier>=4?620:tier>=3?900:1450;if(t-state.lastAssistAt<cadence)return;state.lastAssistAt=t;assistBurst(tier>=4?2:1);
  }
  function maybeSurgeVolley(t){
    if(t>=state.surgeUntil||phase()==="QUIET")return;if(t-state.lastSurgeVolleyAt<(state.quality==="LOW"?360:240))return;state.lastSurgeVolleyAt=t;
    const mode=state.lastMode||((Math.floor(t/500)%2)?"FOCUS":"BURST");spawnShot(mode,{tier:4,scale:1.22});if(state.quality!=="LOW")spawnShot(mode==="FOCUS"?"BURST":"FOCUS",{tier:3,scale:1.0});
  }

  function punch(power,freezeMs,color){state.punch=Math.max(state.punch,power);state.punchLife=Math.max(state.punchLife,.18+power*.008);state.hitStopUntil=Math.max(state.hitStopUntil,now()+freezeMs);if(color)pulseScreen(color,Math.min(.10,.02+power*.006));}
  function impact(s){
    const m=MODES[s.mode],rare=s.variant==="STAR_CUT"||s.variant==="NOVA",hero=!!s.hero,tier=s.tier==null?hypeTier():s.tier;
    if(s.mode==="FOCUS"){
      const n=state.quality==="LOW"?(hero?4:2):Math.min(9,(hero?6:3)+Math.floor(tier/2));
      for(let i=0;i<n;i++){const base=i%2?0:Math.PI/2,a=base+rand(-.35,.35),sp=rand(hero?90:52,hero?180:110);particle(s.b.x,s.b.y,Math.cos(a)*sp,Math.sin(a)*sp-10,.15+Math.random()*.13,i%2?m.color:m.core,(hero?4.8:3.0)+Math.random()*1.4,"shard");}
      ring(s.b.x,s.b.y,hero?14:7,m.core,hero?58:28,hero?.22:.14,"focusSlash",hero?4.4:2.6);if(hero)ring(s.b.x,s.b.y,8,m.accent,44,.18,"focusSlash2",3.2);
    }else{
      const n=state.quality==="LOW"?(hero?4:2):Math.min(8,(hero?6:3)+Math.floor(tier/2));
      for(let i=0;i<n;i++){const a=Math.PI*2*i/n+rand(-.18,.18),sp=rand(hero?60:30,hero?145:78);particle(s.b.x,s.b.y,Math.cos(a)*sp,Math.sin(a)*sp-5,.18+Math.random()*.15,i%2?m.color:m.accent,(hero?5.0:3.2)+Math.random()*1.4,"dot");}
      ring(s.b.x,s.b.y,hero?18:11,m.accent,hero?78:42,hero?.30:.20,"shock",hero?5.0:3.0);ring(s.b.x,s.b.y,hero?10:6,m.core,hero?48:26,hero?.20:.14,"shock",hero?3.4:2.2);
    }
    if(hero){punch(s.mode==="BURST"?11:9,state.quality==="LOW"?28:52,"#ffffff");emit("hero_impact",{mode:s.mode,variant:s.variant,tier});}
    else if(rare&&tier>=3)punch(s.mode==="BURST"?5:4,22,m.color);
  }
  function sample(s,q){const e=1-Math.pow(1-clamp(q,0,1),3),dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len,arc=Math.sin(Math.PI*e)*(s.mode==="FOCUS"?18:11)*Math.sin(s.seed);return {x:s.a.x+dx*e+nx*arc,y:s.a.y+dy*e+ny*arc,angle:Math.atan2(dy,dx)};}

  function update(dt,t){
    const sec=dt/1000;if(t-state.lastTapAt>430)state.hype=Math.max(0,state.hype-sec*(t<state.surgeUntil?1.4:7.4));
    if(state.hype<18)state.lastMilestone=0;else if(state.hype<45)state.lastMilestone=Math.min(state.lastMilestone,25);else if(state.hype<70)state.lastMilestone=Math.min(state.lastMilestone,50);else if(state.hype<92)state.lastMilestone=Math.min(state.lastMilestone,75);
    updateHoldFire(t);maybePetAssist(t);maybeSurgeVolley(t);state.punch=Math.max(0,state.punch-sec*28);state.punchLife=Math.max(0,state.punchLife-sec);
    for(let i=state.shots.length-1;i>=0;i--){const s=state.shots[i];s.t+=sec;if(s.t>=s.d){impact(s);state.shots.splice(i,1);}}
    for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.life-=sec;p.x+=p.vx*sec;p.y+=p.vy*sec;p.vy+=32*sec;p.rot+=2.2*sec;if(p.life<=0)state.particles.splice(i,1);}
    for(let i=state.rings.length-1;i>=0;i--){state.rings[i].life-=sec;if(state.rings[i].life<=0)state.rings.splice(i,1);}
    for(let i=state.assists.length-1;i>=0;i--){state.assists[i].life-=sec;if(state.assists[i].life<=0)state.assists.splice(i,1);}
  }

  function drawTrail(c,s,q,m){
    const p=sample(s,q),prev=sample(s,Math.max(0,q-(s.hero?.16:.09)));c.save();
    if(s.mode==="FOCUS"){c.globalAlpha=s.hero?.70:.34;c.strokeStyle=s.hero?m.core:m.color;c.lineWidth=(s.hero?6:2.5)*(s.scale||1);c.lineCap="round";c.beginPath();c.moveTo(prev.x,prev.y);c.lineTo(p.x,p.y);c.stroke();}
    else{const steps=s.hero?3:2;c.fillStyle=s.hero?m.core:m.accent;for(let i=1;i<=steps;i++){const pp=sample(s,Math.max(0,q-i*(s.hero?.055:.045)));c.globalAlpha=(s.hero?.24:.15)*(steps-i+1);c.beginPath();c.arc(pp.x,pp.y,(s.hero?11:6)*(s.scale||1)*(1-i*.12),0,Math.PI*2);c.fill();}}
    c.restore();
  }
  function drawShot(c,s){
    const q=clamp(s.t/s.d,0,1),p=sample(s,q),z=s.scale||1,m=MODES[s.mode];drawTrail(c,s,q,m);c.save();c.translate(p.x,p.y);c.globalAlpha=.98;
    if(s.mode==="FOCUS"){
      c.rotate(p.angle);if(s.variant==="NEEDLE"){c.fillStyle=m.core;c.beginPath();c.moveTo(15*z,0);c.lineTo(-9*z,-2.2*z);c.lineTo(-4*z,0);c.lineTo(-9*z,2.2*z);c.closePath();c.fill();}
      else if(s.variant==="PRISM"){c.rotate(Math.PI/4);for(let i=-1;i<=1;i++){c.fillStyle=i?m.color:m.core;c.fillRect((-4+i*7)*z,-4*z,8*z,8*z);}}
      else if(s.variant==="COMET"){c.strokeStyle=m.color;c.lineWidth=2.8*z;c.beginPath();c.moveTo(-18*z,0);c.lineTo(12*z,0);c.stroke();c.fillStyle=m.core;c.beginPath();c.moveTo(16*z,0);c.lineTo(2*z,-6*z);c.lineTo(4*z,0);c.lineTo(2*z,6*z);c.closePath();c.fill();}
      else{c.strokeStyle=m.core;c.lineWidth=(s.hero?4.2:2.5)*z;c.beginPath();for(let i=0;i<4;i++){const a=i*Math.PI/4;c.moveTo(Math.cos(a)*-13*z,Math.sin(a)*-13*z);c.lineTo(Math.cos(a)*13*z,Math.sin(a)*13*z);}c.stroke();}
    }else{
      if(s.variant==="RING"){c.strokeStyle=m.color;c.lineWidth=3.8*z;c.beginPath();c.arc(0,0,12*z,0,Math.PI*2);c.stroke();}
      else if(s.variant==="BUBBLE"){c.fillStyle="rgba(255,210,143,.26)";c.strokeStyle=m.accent;c.lineWidth=2*z;c.beginPath();c.arc(0,0,12*z,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=m.core;c.beginPath();c.arc(-4*z,-4*z,3*z,0,Math.PI*2);c.fill();}
      else if(s.variant==="NOVA"){c.fillStyle=m.core;for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);c.beginPath();c.moveTo(0,-17*z);c.lineTo(3*z,-5*z);c.lineTo(-3*z,-5*z);c.closePath();c.fill();c.restore();}if(s.hero){c.strokeStyle=m.accent;c.lineWidth=3*z;c.beginPath();c.arc(0,0,11*z,0,Math.PI*2);c.stroke();}}
      else{c.fillStyle=m.color;c.beginPath();c.arc(0,0,11*z,0,Math.PI*2);c.fill();c.fillStyle=m.core;c.beginPath();c.arc(-3*z,-3*z,3.2*z,0,Math.PI*2);c.fill();}
    }
    c.restore();
  }
  function drawParticles(c){for(const p of state.particles){const a=clamp(p.life/p.max,0,1);c.save();c.globalAlpha=a;c.fillStyle=p.color;c.translate(p.x,p.y);c.rotate(p.rot);if(p.shape==="shard"){c.beginPath();c.moveTo(0,-p.size*1.5);c.lineTo(p.size*.6,0);c.lineTo(0,p.size*1.25);c.lineTo(-p.size*.5,0);c.closePath();c.fill();}else{c.beginPath();c.arc(0,0,p.size,0,Math.PI*2);c.fill();}c.restore();}}
  function drawRings(c){for(const r of state.rings){const a=clamp(r.life/r.max,0,1);if(r.screen){c.save();c.globalAlpha=(r.alpha||.04)*a;c.fillStyle=r.color;c.fillRect(0,0,innerWidth,innerHeight);c.restore();continue;}const q=1-a,rr=r.r+q*r.growth;c.save();c.globalAlpha=a*(r.kind==="combo"?.72:.52);c.strokeStyle=r.color;c.lineWidth=(r.width||1.7)*(r.kind==="shock"?(1+.35*a):1);c.translate(r.x,r.y);
    if(r.kind==="focusSlash"||r.kind==="focusSlash2"){c.rotate(r.kind==="focusSlash2"?Math.PI/4:0);c.beginPath();c.moveTo(-rr,0);c.lineTo(rr,0);c.moveTo(0,-rr*.55);c.lineTo(0,rr*.55);c.stroke();}
    else{c.beginPath();c.arc(0,0,rr,0,Math.PI*2);c.stroke();if(r.kind==="combo"){c.beginPath();c.arc(0,0,rr*.55,0,Math.PI*2);c.stroke();}}
    c.restore();}}
  function drawAssists(c,t){for(const a of state.assists){const p=a.pet;if(!p)continue;const life=clamp(a.life/a.max,0,1),m=MODES[a.mode],pulse=.5+.5*Math.sin(t/80);c.save();c.globalAlpha=(a.combo?.72:.42)*life;c.strokeStyle=m.color;c.lineWidth=a.combo?3:2;c.beginPath();c.arc(p.x,p.y,(a.combo?34:28)+pulse*(a.combo?14:10),0,Math.PI*2);c.stroke();if(a.combo&&a.target){c.globalAlpha=.44*life;c.lineWidth=2.2;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(a.target.x,a.target.y);c.stroke();}c.globalAlpha=.9*life;c.fillStyle=m.core;const ang=t/260+(String(p.id||"").length*.8);c.beginPath();c.arc(p.x+Math.cos(ang)*(a.combo?44:38),p.y+Math.sin(ang)*(a.combo?30:25),a.combo?5:4,0,Math.PI*2);c.fill();c.restore();}}
  function drawSurgeField(c,t){if(t>=state.surgeUntil)return;const left=(state.surgeUntil-t)/4200,pulse=.5+.5*Math.sin(t/90);c.save();c.globalAlpha=.055+.035*pulse;c.strokeStyle="#ffffff";c.lineWidth=1.2;const cx=innerWidth*.5,cy=innerHeight*.44;for(let i=0;i<8;i++){const a=i*Math.PI/4+t*.00035,inner=90+20*pulse,outer=Math.max(innerWidth,innerHeight)*.78;c.beginPath();c.moveTo(cx+Math.cos(a)*inner,cy+Math.sin(a)*inner);c.lineTo(cx+Math.cos(a)*outer,cy+Math.sin(a)*outer);c.stroke();}c.globalAlpha=.08*left;c.strokeStyle=MODES[state.lastMode||"FOCUS"].color;c.lineWidth=3;c.beginPath();c.arc(cx,cy,80+(1-left)*160,0,Math.PI*2);c.stroke();c.restore();}
  function drawPunch(c){if(state.punchLife<=0)return;const p=clamp(state.punchLife/.30,0,1);c.save();c.globalAlpha=.06*p;c.strokeStyle="#ffffff";c.lineWidth=Math.max(2,state.punch*.45);c.strokeRect(4,4,innerWidth-8,innerHeight-8);c.restore();}
  function drawHype(c,t){
    const tier=hypeTier();if(tier===0)return;const l=triggerLayout(),left=l.FOCUS.x,right=l.BURST.x+l.BURST.w,y=l.FOCUS.y-8,p=state.hype/100;c.save();c.lineCap="round";c.globalAlpha=.36+.15*tier;c.strokeStyle=tier>=4?"#fff":tier>=3?"#ffe594":tier>=2?"#ffc4e5":"#bcefff";c.lineWidth=tier>=4?5:tier>=3?3.5:2.5;c.beginPath();c.moveTo(left,y);c.lineTo(left+(right-left)*p,y);c.stroke();
    const label=tier>=4?"SURGE":tier>=3?"FEVER":tier>=2?"RUSH":"WARM";c.globalAlpha=.82;c.fillStyle=c.strokeStyle;c.font=`${tier>=4?"900 13px":"800 9px"} system-ui,-apple-system,sans-serif`;c.textAlign="center";c.fillText(label,(left+right)/2,y-7);c.restore();
  }
  function render(t){const c=state.ctx;if(!c)return;c.clearRect(0,0,innerWidth,innerHeight);c.save();if(state.punch>0){const p=Math.max(0,state.punch),jx=(Math.random()-.5)*p,jy=(Math.random()-.5)*p;c.translate(jx,jy);}drawSurgeField(c,t);for(const s of state.shots)drawShot(c,s);drawParticles(c);drawRings(c);drawAssists(c,t);drawHype(c,t);drawPunch(c);c.restore();}

  function loop(t){
    installDiagnosticsBridge();const dt=Math.min(50,t-state.lastFrame||16.7);state.lastFrame=t;state.frameMs=state.frameMs*.9+dt*.1;state.quality=state.frameMs>28?"LOW":state.frameMs>21?"MEDIUM":"FULL";
    const cap=shotCap();if(state.shots.length>cap)state.shots.splice(0,state.shots.length-cap);const pcap=particleCap();if(state.particles.length>pcap)state.particles.splice(0,state.particles.length-pcap);
    if(t>=state.hitStopUntil)update(dt,t);render(t);requestAnimationFrame(loop);
  }

  function init(){
    if(state.ready)return;state.ready=true;state.nextHeroAt=9+Math.floor(Math.random()*5);createCanvas();installDiagnosticsBridge();
    document.addEventListener("pointerdown",onPointerDown,true);document.addEventListener("pointerup",onPointerUp,true);document.addEventListener("pointercancel",onPointerUp,true);
    requestAnimationFrame(loop);emit("impact_pass_ready",{tapRush:true,holdFire:true,hypeTiers:true,heroShots:true,impactPass:true,petCombo:true,virtualDiagnostics:true});
  }

  const api={
    version:VERSION,previousVersion:PREVIOUS_VERSION,compatVersion:V30_4_COMPAT,
    diagnostics:()=>({version:VERSION,hype:Math.round(state.hype),peak:Math.round(state.peak),tier:hypeTier(),surge:now()<state.surgeUntil,quality:state.quality,held:state.held.size,activeShots:state.shots.length,particles:state.particles.length,virtualPresses:Math.round(state.virtualPresses*100)/100,nextHeroAt:state.nextHeroAt,...state.stats}),
    setEnabled:v=>(state.enabled=!!v),setHype:v=>(state.hype=clamp(Number(v)||0,0,100)),forceAssist:()=>assistBurst(1),forceHero:(mode="FOCUS")=>spawnHeroShot(mode,hypeTier()),forceCombo:()=>petCombo(true),forceSurge:()=>{state.hype=100;state.surgeUntil=now()+4200;}
  };
  window.ImpactPassV305=api;window.TapRushV304=api;window.ExcitementPetV303=api;window.ExcitementPetV302=api;init();
})();
