(() => {
  "use strict";

  const VERSION="RUN_EVOLUTION_V28";
  const LEGACY_VERSION="ENDLESS_CHAOS_V27";
  const WEAPONS=["MULTISHOT","RICOCHET","RAPID","LIGHTNING"];
  const WORLD_MODS=["LOW_GRAVITY","STORM","BUBBLE_RAIN","CARNIVAL_FRENZY"];
  const PET_MODS=["GIANT","MINI_SWARM","FAST","BOUNCY"];
  const OBJECT_MODS=["BUMPER_RUSH","BALLOON_STORM","SPRING_PARTY","GIFT_FEVER"];
  const CLIMAXES=["THUNDER_FINALE","PINBALL_BREAK","WORLD_BREAK","OVERDRIVE_RAIN","REALITY_BREAK"];
  const WORLD_COLORS=["#ffd474","#9fe6ff","#8bdcff","#d2a9ff"];
  const BOSS_NAMES=["GIANT TOY","CRYSTAL CORE","SUPER BALLOON","WORLD CORE"];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>performance.now();

  const state={
    ready:false,canvas:null,gameCanvas:null,ctx:null,hud:null,
    stage:1,phase:"BOOT",recipe:null,evolution:null,startedAt:0,minEndAt:0,endAt:0,climaxUntil:0,nextAt:0,
    baseline:null,progress:0,chaos:0,multiplier:1,peak:1,lastChaosAt:0,realityUsed:false,lastThreshold:1,
    holding:false,lastRapidAt:0,lastWorldFxAt:0,lastObjectFxAt:0,lastPetFxAt:0,lastDiag:null,
    bossHp:1,bossFlashUntil:0,
    shots:[],particles:[],rings:[],lightning:[],flashes:[],shakeUntil:0,shakePower:0,bannerUntil:0,lastFrame:now()
  };

  function evolutionFor(stage){
    const n=Math.max(1,Math.floor(Number(stage)||1));
    return {
      stage:n,
      shotCount:n>=5?3:n>=3?2:1,
      spread:n>=5,
      ricochet:n>=8,
      lightning:n>=12,
      missileRain:n>=15,
      unlocks:["SINGLE",n>=3&&"DOUBLE",n>=5&&"SPREAD",n>=8&&"RICOCHET",n>=12&&"CHAIN LIGHTNING",n>=15&&"MISSILE RAIN"].filter(Boolean)
    };
  }

  function chaosPowerFor(multiplier){
    const m=Math.max(1,Math.floor(multiplier||1));
    return {
      double:m>=10,
      big:m>=20,
      ricochet:m>=30,
      lightning:m>=50,
      barrage:m>=75,
      realityBreak:m>=100,
      label:m>=100?"REALITY BREAK":m>=75?"AUTO BARRAGE":m>=50?"CHAIN LIGHTNING":m>=30?"RICOCHET":m>=20?"BIG SHOTS":m>=10?"DOUBLE FIRE":"CHARGING"
    };
  }

  function recipeFor(stage){
    const n=Math.max(1,Math.floor(Number(stage)||1)),mega=n%5===0,boss=n%10===0,world=(n-1)%4;
    return {
      stage:n,mega,boss,world,
      weapon:"EVOLUTION_STACK",weapon2:mega?"OVERDRIVE":null,
      worldMod:WORLD_MODS[world],petMod:PET_MODS[Math.floor((n-1)/2)%4],objectMod:OBJECT_MODS[(n+1)%4],
      climax:boss?"BOSS_BREAK":mega?"REALITY_BREAK":CLIMAXES[(n-1)%4],
      target:boss?Math.min(78,42+Math.floor(n*.8)):mega?Math.min(48,27+Math.floor(n*.55)):Math.min(32,12+Math.floor(n*.68)),
      minMs:boss?15000:mega?12500:9000,maxMs:boss?26000:mega?20500:15500+(n%3)*1200
    };
  }

  function diag(){try{return window.InfiniteClick&&window.InfiniteClick.diagnostics?window.InfiniteClick.diagnostics():null;}catch(_){return null;}}
  function actionButtonHit(x,y){const w=innerWidth,h=innerHeight;return y>h-Math.max(155,h*.18)&&Math.abs(x-w*.5)<Math.min(190,w*.40);}
  function pets(){const d=diag();return d&&Array.isArray(d.pets)?d.pets.filter(p=>p&&p.active):[];}
  function buttonOrigin(){return {x:innerWidth*.5,y:innerHeight-Math.max(72,innerHeight*.08)};}
  function bossPoint(){return {x:innerWidth*.5,y:innerHeight*.39};}

  function createOverlay(){
    const c=document.createElement("canvas");c.id="run-evolution-v28-overlay";c.style.cssText="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:24;";document.body.appendChild(c);state.canvas=c;state.ctx=c.getContext("2d");resize();addEventListener("resize",resize,{passive:true});
    const h=document.createElement("div");h.id="run-evolution-v28-hud";h.style.cssText="position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 9px);transform:translateX(-50%);width:min(90vw,440px);z-index:25;pointer-events:none;color:#fff;font-family:system-ui,-apple-system,sans-serif;text-shadow:0 2px 10px rgba(0,0,0,.8);";
    h.innerHTML='<div data-stage style="font-size:13px;font-weight:950;letter-spacing:1.6px;text-align:center"></div><div data-weapon style="font-size:10px;font-weight:900;letter-spacing:.7px;text-align:center;margin-top:2px;color:#fff4b8"></div><div style="display:flex;justify-content:space-between;gap:12px;align-items:end;margin-top:2px"><div data-recipe style="font-size:9px;font-weight:750;opacity:.82;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div><div data-chaos style="font-size:20px;font-weight:1000;white-space:nowrap"></div></div><div style="height:7px;margin-top:5px;border-radius:999px;background:rgba(9,12,24,.60);box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)"><div data-progress style="height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#82e8ff,#ffe172,#ff87c9);box-shadow:0 0 14px rgba(160,225,255,.65)"></div></div><div data-boss-wrap style="display:none;margin-top:7px"><div data-boss-name style="font-size:10px;font-weight:1000;letter-spacing:1.5px;text-align:center"></div><div style="height:10px;margin-top:3px;border-radius:999px;background:rgba(20,4,14,.72);box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)"><div data-boss-hp style="height:100%;width:100%;border-radius:999px;background:linear-gradient(90deg,#ff487d,#ffb35e,#fff27a);box-shadow:0 0 15px rgba(255,100,130,.72)"></div></div></div><div data-banner style="position:fixed;left:50%;top:23vh;transform:translate(-50%,-50%) scale(.90);opacity:0;transition:opacity .14s ease,transform .18s ease;white-space:nowrap;text-align:center;font-size:29px;font-weight:1000;letter-spacing:1px;text-shadow:0 4px 24px rgba(0,0,0,.86)"></div>';
    document.body.appendChild(h);
    state.hud={root:h,stage:h.querySelector("[data-stage]"),weapon:h.querySelector("[data-weapon]"),recipe:h.querySelector("[data-recipe]"),chaos:h.querySelector("[data-chaos]"),progress:h.querySelector("[data-progress]"),bossWrap:h.querySelector("[data-boss-wrap]"),bossName:h.querySelector("[data-boss-name]"),bossHp:h.querySelector("[data-boss-hp]"),banner:h.querySelector("[data-banner]")};
  }

  function resize(){if(!state.canvas)return;const dpr=Math.min(devicePixelRatio||1,2);state.canvas.width=Math.max(1,Math.floor(innerWidth*dpr));state.canvas.height=Math.max(1,Math.floor(innerHeight*dpr));state.ctx.setTransform(dpr,0,0,dpr,0,0);}
  function captureGameCanvas(){state.gameCanvas=[...document.querySelectorAll("canvas")].find(c=>c!==state.canvas)||null;}
  function baselineFrom(d){return {buttonPresses:d&&d.buttonPresses||0,directHits:d&&d.directHits||0,objectHits:d&&d.objectHits||0,buttonShots:d&&d.buttonShots||0};}

  function startStage(n){
    const t=now(),r=recipeFor(n),d=diag();state.stage=n;state.recipe=r;state.evolution=evolutionFor(n);state.phase="RUN";state.startedAt=t;state.minEndAt=t+r.minMs;state.endAt=t+r.maxMs;state.climaxUntil=0;state.nextAt=0;state.baseline=baselineFrom(d);state.progress=0;state.bossHp=1;state.realityUsed=false;state.lastWorldFxAt=0;state.lastObjectFxAt=0;state.lastPetFxAt=0;
    if(r.boss){state.chaos=Math.max(state.chaos,50);registerChaos(0);showBanner(`BOSS STAGE ${n}`,`${BOSS_NAMES[r.world]} · BREAK IT`,1500);bossEntryFx();}
    else if(r.mega){state.chaos=Math.max(state.chaos,35);registerChaos(0);showBanner(`MEGA STAGE ${n}`,`${state.evolution.unlocks.join(" → ")}`,1250);megaEntryFx();}
    else showBanner(`STAGE ${n}`,weaponSummary(),850);
    updateHud(t);
  }

  function showBanner(title,sub,duration){if(!state.hud)return;const b=state.hud.banner;b.innerHTML=sub?`${title}<div style="font-size:11px;letter-spacing:2px;margin-top:5px;opacity:.82">${sub}</div>`:title;b.style.opacity="1";b.style.transform="translate(-50%,-50%) scale(1)";state.bannerUntil=now()+(duration||850);}

  function thresholdFor(m){return m>=100?100:m>=75?75:m>=50?50:m>=30?30:m>=20?20:m>=10?10:1;}
  function registerChaos(amount){
    state.chaos=clamp(state.chaos+Math.max(0,Number(amount)||0),0,100);state.lastChaosAt=now();state.multiplier=Math.max(1,Math.round(1+state.chaos*.99));state.peak=Math.max(state.peak,state.multiplier);
    const after=thresholdFor(state.multiplier);if(after>state.lastThreshold){state.lastThreshold=after;const p=chaosPowerFor(state.multiplier);showBanner(`CHAOS ×${after}`,p.label,700);burst(innerWidth*.5,innerHeight*.53,18,"#fff");}
    if(state.multiplier>=100&&!state.realityUsed){state.realityUsed=true;realityBreak(1.12);}
  }

  function readProgress(d){if(!d||!state.baseline)return 0;const b=state.baseline,score=Math.max(0,(d.buttonPresses||0)-b.buttonPresses)+Math.max(0,(d.directHits||0)-b.directHits)*1.6+Math.max(0,(d.objectHits||0)-b.objectHits)*1.25+Math.max(0,(d.buttonShots||0)-b.buttonShots)*.16;return clamp(score/Math.max(1,state.recipe.target),0,1);}

  function consumeDiagnostics(d){
    const prev=state.lastDiag;if(!d)return;
    if(prev){const bp=Math.max(0,(d.buttonPresses||0)-(prev.buttonPresses||0)),hits=Math.max(0,(d.directHits||0)-(prev.directHits||0)),objs=Math.max(0,(d.objectHits||0)-(prev.objectHits||0)),shots=Math.max(0,(d.buttonShots||0)-(prev.buttonShots||0));if(bp)registerChaos(bp*1.25);if(hits)registerChaos(hits*4.1);if(objs)registerChaos(objs*2.6);if(shots)registerChaos(Math.min(3,shots*.34));if(state.recipe&&state.recipe.boss&&(bp||hits||objs||shots))state.bossFlashUntil=now()+90;}
    state.lastDiag=d;
  }

  function updateStage(dt,t,d){
    if(state.phase==="BOOT"){startStage(1);return;}
    if(t-state.lastChaosAt>650){state.chaos=Math.max(0,state.chaos-dt*(state.recipe&&state.recipe.boss?.0022:state.recipe&&state.recipe.mega?.0028:.0048));state.multiplier=Math.max(1,Math.round(1+state.chaos*.99));}
    state.progress=readProgress(d);state.bossHp=state.recipe&&state.recipe.boss?1-state.progress:1;stageModifiers(t,d);
    const progressClear=state.progress>=1&&((state.recipe&&state.recipe.boss)||t>=state.minEndAt);
    if(state.phase==="RUN"&&(progressClear||t>=state.endAt))climax(t);
    else if(state.phase==="CLIMAX"&&t>=state.climaxUntil){state.phase="CLEAR";state.nextAt=t+700;registerChaos(state.recipe.boss?20:state.recipe.mega?14:7);showBanner(state.recipe.boss?"BOSS DESTROYED":state.recipe.mega?"MEGA CLEAR":"STAGE CLEAR",`CHAOS ×${state.multiplier}`,700);burst(innerWidth*.5,innerHeight*.40,state.recipe.boss?60:state.recipe.mega?42:24,WORLD_COLORS[state.recipe.world]);}
    else if(state.phase==="CLEAR"&&t>=state.nextAt)startStage(state.stage+1);
  }

  function stageModifiers(t,d){
    const r=state.recipe;if(!r||state.phase==="CLEAR")return;const ps=d&&d.pets||[];
    if(t-state.lastWorldFxAt>(r.boss?120:r.mega?150:260)){state.lastWorldFxAt=t;if(r.worldMod==="STORM"&&Math.random()<.75)lightning(Math.random()*innerWidth,60+Math.random()*innerHeight*.58,1);else if(r.worldMod==="BUBBLE_RAIN")for(let i=0;i<2;i++)bubble(Math.random()*innerWidth,innerHeight+20,8+Math.random()*10);else if(r.worldMod==="LOW_GRAVITY"&&Math.random()<.65)spark(Math.random()*innerWidth,innerHeight*.25+Math.random()*innerHeight*.55,"#b9efff",-25-Math.random()*30);else if(r.worldMod==="CARNIVAL_FRENZY"&&Math.random()<.72)star(Math.random()*innerWidth,Math.random()*innerHeight*.68,WORLD_COLORS[r.world],1);}
    if(t-state.lastPetFxAt>(r.mega?230:430)){state.lastPetFxAt=t;if(ps.length){const p=ps[Math.floor(Math.random()*ps.length)],x=p.x||innerWidth*.5,y=p.y||innerHeight*.45;if(r.petMod==="GIANT")ring(x,y,40,"#fff4b8",.55);else if(r.petMod==="MINI_SWARM"){for(let i=0;i<4;i++)spark(x+(Math.random()-.5)*70,y+(Math.random()-.5)*55,"#ffd0ec",-18);}else if(r.petMod==="FAST")speedLines(x,y);else if(r.petMod==="BOUNCY")ring(x,y,18,"#9ee9ff",.75);}}
    if(t-state.lastObjectFxAt>(r.mega?450:760)){state.lastObjectFxAt=t;if(r.objectMod==="BUMPER_RUSH")ring(Math.random()*innerWidth,innerHeight*.30+Math.random()*innerHeight*.42,28,"#ff9eb7",.8);else if(r.objectMod==="BALLOON_STORM")for(let i=0;i<3;i++)bubble(Math.random()*innerWidth,innerHeight+15,7+Math.random()*8);else if(r.objectMod==="SPRING_PARTY")springTrail(Math.random()*innerWidth,innerHeight*.72);else confetti(Math.random()*innerWidth,innerHeight*.28,8);}
  }

  function climax(t){
    const r=state.recipe;if(state.phase!=="RUN")return;state.phase="CLIMAX";state.climaxUntil=t+(r.boss?3300:r.mega?2800:2100);state.progress=1;state.bossHp=0;registerChaos(r.boss?30:r.mega?24:12);
    if(r.boss){showBanner("BOSS BREAK",`${BOSS_NAMES[r.world]} SHATTERED`,1600);bossBreak();}
    else {showBanner(r.mega?"REALITY BREAK":r.climax,`STAGE ${r.stage} CLIMAX`,r.mega?1500:1000);if(r.climax==="THUNDER_FINALE")thunderFinale();else if(r.climax==="PINBALL_BREAK")pinballBreak();else if(r.climax==="WORLD_BREAK")worldBreak();else if(r.climax==="OVERDRIVE_RAIN")overdriveRain();else realityBreak(1);}
  }

  function onDown(e){if(!state.ready||!actionButtonHit(e.clientX,e.clientY))return;state.holding=true;registerChaos(2.4);stageWeapon(e.clientX,e.clientY,false);}
  function onUp(){state.holding=false;}

  function stageWeapon(x,y,auto){
    const r=state.recipe,e=state.evolution;if(!r||!e)return;
    const origin=buttonOrigin(),cp=chaosPowerFor(state.multiplier),count=e.shotCount*(cp.double?2:1),scale=cp.big?1.65:1;
    const ricochetCount=(e.ricochet?3:0)+(cp.ricochet?2:0)+(r.boss&&e.ricochet?2:0);
    const lightningCount=(e.lightning?2:0)+(cp.lightning?2:0)+(r.boss&&(e.lightning||cp.lightning)?1:0);
    fireMulti(origin,count,scale,e.spread);
    if(ricochetCount)fireRicochet(origin,ricochetCount,scale);
    if(lightningCount)chainLightning(lightningCount);
    if(e.missileRain&&!auto)missileRain(r.boss?6:4,scale);
    if((r.mega||r.boss)&&!auto&&state.multiplier>=50)impactExplosion(r.boss?bossPoint():randomTarget(),WORLD_COLORS[r.world],r.boss?1.3:1);
  }

  function targetPoints(count){
    const r=state.recipe;if(r&&r.boss){const b=bossPoint();return Array.from({length:count},(_,i)=>({x:b.x+(i-(count-1)/2)*18,y:b.y+((i%2)*2-1)*10}));}
    const ps=pets();if(ps.length)return Array.from({length:count},(_,i)=>{const p=ps[(Math.floor(Math.random()*ps.length)+i)%ps.length];return {x:p.x||innerWidth*.5,y:p.y||innerHeight*.38};});
    return Array.from({length:count},()=>randomTarget());
  }
  function randomTarget(){return {x:innerWidth*(.22+Math.random()*.56),y:innerHeight*(.24+Math.random()*.40)};}
  function fireMulti(origin,count,scale,spread){const pts=targetPoints(count);pts.forEach((p,i)=>shot(origin,p,WORLD_COLORS[state.recipe.world],i*35,scale||1,spread));}
  function fireRicochet(origin,count,scale){chainShot(origin,targetPoints(count),WORLD_COLORS[state.recipe.world],scale||1);}
  function lightningToPet(){const p=targetPoints(1)[0];lightning(p.x,p.y,1.1);}
  function chainLightning(count){for(const p of targetPoints(count||2))setTimeout(()=>lightning(p.x,p.y,1.05),Math.random()*85);}
  function missileRain(count,scale){const pts=targetPoints(count);pts.forEach((p,i)=>shot({x:p.x+(Math.random()-.5)*90,y:-30-i*12},p,"#fff4b8",i*45,(scale||1)*1.2,true));}
  function impactExplosion(p,color,power){burst(p.x,p.y,Math.round(16*(power||1)),color);ring(p.x,p.y,18,color,1);state.flashes.push({life:.10,max:.10,alpha:.05*(power||1),color});}

  function shot(a,b,color,delay,scale,spread){state.shots.push({kind:"shot",a:{...a},b:{...b},color,delay:(delay||0)/1000,t:0,d:.22,arc:(Math.random()<.5?-1:1)*(spread?28+Math.random()*48:16+Math.random()*26),scale:scale||1});}
  function chainShot(a,points,color,scale){let start={...a};points.forEach((p,i)=>{state.shots.push({kind:"shot",a:{...start},b:{...p},color,delay:i*.07,t:0,d:.17,arc:(Math.random()<.5?-1:1)*(14+Math.random()*22),scale:scale||1});start={...p};});}
  function updateShots(dt){for(let i=state.shots.length-1;i>=0;i--){const s=state.shots[i];if(s.delay>0){s.delay-=dt/1000;continue;}s.t+=dt/1000;const q=clamp(s.t/s.d,0,1);if(q>=1){burst(s.b.x,s.b.y,Math.round(8*s.scale),s.color);ring(s.b.x,s.b.y,12*s.scale,s.color,.65);if(s.scale>1.2)impactExplosion(s.b,s.color,.65);state.shots.splice(i,1);}}}

  function drawShots(c){for(const s of state.shots){if(s.delay>0)continue;const q=clamp(s.t/s.d,0,1),e=1-Math.pow(1-q,3),x=s.a.x+(s.b.x-s.a.x)*e,y=s.a.y+(s.b.y-s.a.y)*e+Math.sin(Math.PI*q)*s.arc*(1-q*.2),angle=Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x),z=s.scale||1;c.save();c.translate(x,y);c.rotate(angle);c.shadowBlur=22*z;c.shadowColor=s.color;c.globalAlpha=.9;c.strokeStyle=s.color;c.lineWidth=9*z;c.beginPath();c.moveTo(-42*z,0);c.lineTo(-5*z,0);c.stroke();c.strokeStyle="#fff";c.lineWidth=3*z;c.beginPath();c.moveTo(-26*z,0);c.lineTo(-2*z,0);c.stroke();c.fillStyle="#fff";c.beginPath();c.arc(0,0,7*z,0,Math.PI*2);c.fill();c.restore();}}

  function particle(x,y,vx,vy,life,color,size,shape){state.particles.push({x,y,vx,vy,life,max:life,color,size,shape:shape||"dot",rot:Math.random()*Math.PI*2});}
  function spark(x,y,color,vy){particle(x,y,(Math.random()-.5)*45,vy==null?-45:vy,.36+Math.random()*.2,color,2.5+Math.random()*3,"star");}
  function star(x,y,color,p){for(let i=0;i<6;i++){const a=Math.PI*2*i/6;particle(x,y,Math.cos(a)*(55+Math.random()*70)*p,Math.sin(a)*(55+Math.random()*70)*p,.28,color,3+Math.random()*3,"star");}}
  function bubble(x,y,r){particle(x,y,(Math.random()-.5)*20,-45-Math.random()*75,.9,"#bff4ff",r,"bubble");}
  function burst(x,y,n,color){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,sp=55+Math.random()*180;particle(x,y,Math.cos(a)*sp,Math.sin(a)*sp-40,.32+Math.random()*.25,i%3===0?"#fff":color,2+Math.random()*5,i%2?"star":"dot");}}
  function confetti(x,y,n){const cols=["#fff","#ffd36d","#ff8fc7","#8feaff","#caa8ff"];for(let i=0;i<n;i++)particle(x+(Math.random()-.5)*60,y+(Math.random()-.5)*30,(Math.random()-.5)*90,45+Math.random()*120,.7+Math.random()*.4,cols[i%cols.length],3+Math.random()*4,"rect");}
  function ring(x,y,r,color,p){state.rings.push({x,y,r,max:r*(2.2+(p||.5)),life:.34,maxLife:.34,color,alpha:.50});}
  function lightning(x,y,p){const pts=[{x,y:0}],steps=7;for(let i=1;i<steps;i++)pts.push({x:x+(Math.random()-.5)*(26+18*p),y:y*i/steps});pts.push({x,y});state.lightning.push({pts,life:.15,max:.15,color:Math.random()<.5?"#fff":"#b8eaff",w:2+1.5*p});state.flashes.push({life:.08,max:.08,alpha:.06+.05*p,color:"#eaf8ff"});state.shakeUntil=Math.max(state.shakeUntil,now()+160);state.shakePower=Math.max(state.shakePower,2.5+2*p);burst(x,y,7,"#d8f7ff");}
  function springTrail(x,y){for(let i=0;i<7;i++)particle(x+(i-3)*7,y,0,-120-Math.random()*120,.40,["#8feaff","#fff","#9affcb"][i%3],3,"rect");}
  function speedLines(x,y){for(let i=0;i<5;i++)particle(x-55-Math.random()*30,y+(Math.random()-.5)*42,170+Math.random()*90,0,.20,"#fff",2,"line");}

  function megaEntryFx(){const col=WORLD_COLORS[state.recipe.world];burst(innerWidth*.5,innerHeight*.42,38,col);ring(innerWidth*.5,innerHeight*.42,42,col,1);state.shakeUntil=now()+520;state.shakePower=7;state.flashes.push({life:.22,max:.22,alpha:.16,color:col});}
  function bossEntryFx(){const p=bossPoint(),col=WORLD_COLORS[state.recipe.world];for(let i=0;i<4;i++)ring(p.x,p.y,44+i*16,col,1);burst(p.x,p.y,42,col);state.flashes.push({life:.28,max:.28,alpha:.18,color:col});state.shakeUntil=now()+800;state.shakePower=8;}
  function bossBreak(){const p=bossPoint(),col=WORLD_COLORS[state.recipe.world];for(let i=0;i<10;i++)setTimeout(()=>{const q={x:p.x+(Math.random()-.5)*180,y:p.y+(Math.random()-.5)*150};impactExplosion(q,i%2?col:"#fff",1.3);},i*110);for(let i=0;i<7;i++)setTimeout(()=>lightning(p.x+(Math.random()-.5)*190,p.y+(Math.random()-.5)*160,1.35),i*120);state.flashes.push({life:.45,max:.45,alpha:.28,color:"#fff"});state.shakeUntil=now()+2200;state.shakePower=11;}
  function thunderFinale(){for(let i=0;i<10;i++)setTimeout(()=>lightning(innerWidth*(.12+Math.random()*.76),innerHeight*(.16+Math.random()*.55),1.2),i*130);state.shakeUntil=now()+1600;state.shakePower=7;}
  function pinballBreak(){for(let i=0;i<7;i++)setTimeout(()=>ring(innerWidth*(.18+Math.random()*.64),innerHeight*(.20+Math.random()*.50),26+Math.random()*28,"#fff",1),i*110);state.shakeUntil=now()+1200;state.shakePower=8;}
  function worldBreak(){state.flashes.push({life:.34,max:.34,alpha:.20,color:WORLD_COLORS[state.recipe.world]});for(let i=0;i<5;i++)ring(innerWidth*.5,innerHeight*.42,35+i*18,WORLD_COLORS[(state.recipe.world+i)%4],1);burst(innerWidth*.5,innerHeight*.42,55,WORLD_COLORS[state.recipe.world]);state.shakeUntil=now()+900;state.shakePower=8;}
  function overdriveRain(){for(let i=0;i<70;i++)setTimeout(()=>confetti(Math.random()*innerWidth,-10,2),Math.random()*900);state.flashes.push({life:.20,max:.20,alpha:.13,color:"#fff"});}
  function realityBreak(power){const p=power||1;state.shakeUntil=now()+1600;state.shakePower=9*p;state.flashes.push({life:.34,max:.34,alpha:.24,color:"#fff"});for(let i=0;i<8;i++)setTimeout(()=>lightning(innerWidth*(.08+Math.random()*.84),innerHeight*(.18+Math.random()*.56),1.25),i*95);for(let i=0;i<5;i++)ring(innerWidth*.5,innerHeight*.42,28+i*22,WORLD_COLORS[(state.recipe.world+i)%4],1);burst(innerWidth*.5,innerHeight*.42,70,"#fff");showBanner("REALITY BREAK",`CHAOS ×${state.multiplier}`,900);}

  function updateParticles(dt){for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.life-=dt/1000;p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vy+=32*dt/1000;p.rot+=2.4*dt/1000;if(p.life<=0)state.particles.splice(i,1);}for(let i=state.rings.length-1;i>=0;i--){const r=state.rings[i];r.life-=dt/1000;if(r.life<=0)state.rings.splice(i,1);}for(let i=state.lightning.length-1;i>=0;i--){state.lightning[i].life-=dt/1000;if(state.lightning[i].life<=0)state.lightning.splice(i,1);}for(let i=state.flashes.length-1;i>=0;i--){state.flashes[i].life-=dt/1000;if(state.flashes[i].life<=0)state.flashes.splice(i,1);}}
  function drawParticle(c,p){const a=clamp(p.life/p.max,0,1);c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.globalAlpha=a;c.strokeStyle=p.color;c.fillStyle=p.color;c.shadowBlur=10;c.shadowColor=p.color;if(p.shape==="bubble"){c.lineWidth=1.4;c.globalAlpha=a*.65;c.beginPath();c.arc(0,0,p.size,0,Math.PI*2);c.stroke();c.fillStyle="rgba(255,255,255,.18)";c.beginPath();c.arc(-p.size*.25,-p.size*.25,p.size*.20,0,Math.PI*2);c.fill();}else if(p.shape==="rect"){c.fillRect(-p.size*.6,-p.size*.25,p.size*1.2,p.size*.5);}else if(p.shape==="line"){c.lineWidth=p.size;c.beginPath();c.moveTo(-18,0);c.lineTo(18,0);c.stroke();}else if(p.shape==="star"){c.beginPath();for(let i=0;i<8;i++){const r=i%2?p.size*.38:p.size,ang=-Math.PI/2+i*Math.PI/4;c.lineTo(Math.cos(ang)*r,Math.sin(ang)*r);}c.closePath();c.fill();}else{c.beginPath();c.arc(0,0,p.size,0,Math.PI*2);c.fill();}c.restore();}

  function drawBoss(c){
    if(!state.recipe||!state.recipe.boss||state.phase==="CLEAR")return;const p=bossPoint(),hp=clamp(state.bossHp,0,1),phase=hp>.75?0:hp>.5?1:hp>.25?2:3,col=WORLD_COLORS[state.recipe.world],r=Math.min(innerWidth,innerHeight)*(.105+phase*.006);
    c.save();c.translate(p.x,p.y);c.globalAlpha=state.phase==="CLIMAX"?.35:.92;c.shadowBlur=28;c.shadowColor=col;const g=c.createRadialGradient(-r*.25,-r*.3,r*.12,0,0,r);g.addColorStop(0,"#fff");g.addColorStop(.25,col);g.addColorStop(1,"rgba(20,15,38,.92)");c.fillStyle=g;c.strokeStyle="#fff";c.lineWidth=3;c.beginPath();
    if(state.recipe.world===1){for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3,rr=i%2?r*.78:r,x=Math.cos(a)*rr,y=Math.sin(a)*rr;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();}
    else {c.arc(0,0,r,0,Math.PI*2);}
    c.fill();c.stroke();
    c.globalAlpha=.8;c.strokeStyle="#fff";c.lineWidth=2;for(let i=0;i<phase+1;i++){c.beginPath();c.moveTo((i-1.5)*r*.14,-r*.15);c.lineTo((i-1.2)*r*.25,r*.10);c.lineTo((i-1.6)*r*.38,r*.40);c.stroke();}
    if(now()<state.bossFlashUntil){c.globalAlpha=.55;c.fillStyle="#fff";c.beginPath();c.arc(0,0,r*1.05,0,Math.PI*2);c.fill();}
    c.restore();
  }

  function render(){const c=state.ctx;if(!c)return;c.clearRect(0,0,innerWidth,innerHeight);drawBoss(c);for(const f of state.flashes){c.save();c.globalAlpha=f.alpha*clamp(f.life/f.max,0,1);c.fillStyle=f.color;c.fillRect(0,0,innerWidth,innerHeight);c.restore();}for(const r of state.rings){const q=1-r.life/r.max,rad=r.r+(r.max-r.r)*q;c.save();c.globalAlpha=r.alpha*(1-q);c.strokeStyle=r.color;c.lineWidth=2.2;c.shadowBlur=12;c.shadowColor=r.color;c.beginPath();c.arc(r.x,r.y,rad,0,Math.PI*2);c.stroke();c.restore();}for(const l of state.lightning){c.save();c.globalAlpha=clamp(l.life/l.max,0,1);c.strokeStyle=l.color;c.lineWidth=l.w;c.shadowBlur=18;c.shadowColor=l.color;c.beginPath();l.pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.strokeStyle="#fff";c.lineWidth=Math.max(1,l.w*.35);c.stroke();c.restore();}drawShots(c);for(const p of state.particles)drawParticle(c,p);}
  function shakeGame(t){if(!state.gameCanvas)captureGameCanvas();const c=state.gameCanvas;if(!c)return;if(t<state.shakeUntil){const p=state.shakePower*(state.shakeUntil-t)/Math.max(1,450),x=(Math.random()-.5)*p,y=(Math.random()-.5)*p,r=(Math.random()-.5)*p*.05;c.style.transform=`translate(${x}px,${y}px) rotate(${r}deg) scale(1.006)`;}else if(c.style.transform)c.style.transform="";}

  function weaponSummary(){const e=state.evolution||evolutionFor(state.stage);return e.unlocks.slice(-3).join(" + ");}
  function updateHud(t){const h=state.hud,r=state.recipe;if(!h||!r)return;const until=state.phase==="RUN"?state.endAt:(state.phase==="CLIMAX"?state.climaxUntil:state.nextAt),sec=Math.max(0,Math.ceil((until-t)/1000)),cp=chaosPowerFor(state.multiplier);h.stage.textContent=`${r.boss?"BOSS ":r.mega?"MEGA ":""}STAGE ${r.stage} · ${sec}s`;h.weapon.textContent=`WEAPON: ${weaponSummary()}`;h.recipe.textContent=[r.worldMod,r.petMod,r.objectMod].join(" · ");h.chaos.textContent=`CHAOS ×${state.multiplier}`;h.chaos.style.color=state.multiplier>=75?"#fff":state.multiplier>=40?"#ffe177":"#c9f5ff";h.progress.style.width=`${Math.round(state.progress*100)}%`;h.progress.style.filter=state.multiplier>=50?"brightness(1.4) drop-shadow(0 0 8px #fff)":"";h.weapon.style.textShadow=cp.barrage?"0 0 12px #fff":"";h.bossWrap.style.display=r.boss?"block":"none";if(r.boss){h.bossName.textContent=BOSS_NAMES[r.world];h.bossHp.style.width=`${Math.round(state.bossHp*100)}%`;}
    if(state.bannerUntil&&t>=state.bannerUntil){h.banner.style.opacity="0";h.banner.style.transform="translate(-50%,-50%) scale(.94)";state.bannerUntil=0;}}

  function loop(t){const dt=Math.min(50,t-state.lastFrame||16.7);state.lastFrame=t;const d=diag();consumeDiagnostics(d);updateStage(dt,t,d);const cp=chaosPowerFor(state.multiplier);if(state.holding&&cp.barrage&&t-state.lastRapidAt>95){state.lastRapidAt=t;stageWeapon(innerWidth*.5,innerHeight-80,true);}updateShots(dt);updateParticles(dt);updateHud(t);shakeGame(t);render();requestAnimationFrame(loop);}

  function init(){if(state.ready)return;const d=diag();if(!d){setTimeout(init,120);return;}state.ready=true;createOverlay();captureGameCanvas();state.lastDiag=d;document.addEventListener("pointerdown",onDown,true);document.addEventListener("pointerup",onUp,true);document.addEventListener("pointercancel",onUp,true);startStage(1);requestAnimationFrame(loop);try{window.AndroidGame&&AndroidGame.onRendererReady&&AndroidGame.onRendererReady(VERSION);}catch(_){} }

  const api={version:VERSION,legacyVersion:LEGACY_VERSION,recipeFor,evolutionFor,chaosPowerFor,diagnostics:()=>({stage:state.stage,phase:state.phase,recipe:state.recipe,evolution:state.evolution,progress:state.progress,bossHp:state.bossHp,chaos:state.chaos,multiplier:state.multiplier,peak:state.peak}),forceStage:n=>startStage(n)};
  window.RunEvolutionV28=api;
  window.EndlessChaosV27=api;
  init();
})();
