(() => {
  "use strict";

  const VERSION="DUAL_TRIGGER_V30";
  const V29_VERSION="TENSION_RELEASE_V29";
  const V28_VERSION="RUN_EVOLUTION_V28";
  const LEGACY_VERSION="ENDLESS_CHAOS_V27";
  const WEAPONS=["MULTISHOT","RICOCHET","RAPID","LIGHTNING"];
  const WORLD_MODS=["LOW_GRAVITY","STORM","BUBBLE_RAIN","CARNIVAL_FRENZY"];
  const PET_MODS=["GIANT","MINI_SWARM","FAST","BOUNCY"];
  const OBJECT_MODS=["BUMPER_RUSH","BALLOON_STORM","SPRING_PARTY","GIFT_FEVER"];
  const CLIMAXES=["THUNDER_FINALE","PINBALL_BREAK","WORLD_BREAK","OVERDRIVE_RAIN","REALITY_BREAK"];
  const WORLD_COLORS=["#ffd474","#9fe6ff","#8bdcff","#d2a9ff"];
  const PRESSURE_NAMES=["OVERTHINKING CORE","TANGLED CORE","NOISE CORE","STORM CORE"];
  const LEGACY_BOSS_COPY=["BOSS STAGE","BOSS DESTROYED"];
  const TRIGGERS={
    FOCUS:{label:"FOCUS",sub:"CRYSTAL ARC",color:"#a9efff",core:"#f7ffff",accent:"#b8b7ff"},
    BURST:{label:"BURST",sub:"PULSE WAVE",color:"#ffd28f",core:"#fff8dc",accent:"#ff9fc8"}
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>performance.now();

  const state={
    ready:false,canvas:null,gameCanvas:null,ctx:null,hud:null,
    stage:1,phase:"BOOT",recipe:null,evolution:null,startedAt:0,minEndAt:0,endAt:0,climaxUntil:0,nextAt:0,quietUntil:0,
    baseline:null,progress:0,chaos:0,multiplier:1,peak:1,lastChaosAt:0,realityUsed:false,lastThreshold:1,
    tension:100,released:0,tensionMilestone:100,
    holding:false,lastWorldFxAt:0,lastObjectFxAt:0,lastPetFxAt:0,lastDiag:null,
    bossHp:1,bossFlashUntil:0,
    tapTimes:[],softUntil:0,softCooldownUntil:0,softCount:0,
    activePointers:new Map(),lastRapid:{FOCUS:0,BURST:0},triggerFlash:{FOCUS:0,BURST:0},triggerCounts:{FOCUS:0,BURST:0},
    shots:[],particles:[],rings:[],lightning:[],flashes:[],shakeUntil:0,shakePower:0,bannerUntil:0,lastFrame:now(),
    live:{lastPulseAt:0,lastCounts:{FOCUS:0,BURST:0},listener:null,directorMood:"NEUTRAL"}
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
      double:m>=10,big:m>=20,ricochet:m>=30,lightning:m>=50,barrage:m>=75,realityBreak:m>=100,
      label:m>=100?"REALITY BREAK":m>=75?"AUTO BARRAGE":m>=50?"CHAIN LIGHTNING":m>=30?"RICOCHET":m>=20?"BIG SHOTS":m>=10?"DOUBLE FIRE":"CHARGING"
    };
  }

  function recipeFor(stage){
    const n=Math.max(1,Math.floor(Number(stage)||1)),mega=n%5===0,boss=n%10===0,world=(n-1)%4;
    return {
      stage:n,mega,boss,world,weapon:"EVOLUTION_STACK",weapon2:mega?"OVERDRIVE":null,
      worldMod:WORLD_MODS[world],petMod:PET_MODS[Math.floor((n-1)/2)%4],objectMod:OBJECT_MODS[(n+1)%4],
      climax:boss?"BOSS_BREAK":mega?"REALITY_BREAK":CLIMAXES[(n-1)%4],
      target:boss?Math.min(78,42+Math.floor(n*.8)):mega?Math.min(48,27+Math.floor(n*.55)):Math.min(32,12+Math.floor(n*.68)),
      minMs:boss?15000:mega?12500:9000,maxMs:boss?26000:mega?20500:15500+(n%3)*1200
    };
  }

  function tensionStartFor(stage,recipe){
    const n=Math.max(1,stage||1);
    if(recipe&&recipe.boss)return 100;
    if(recipe&&recipe.mega)return Math.max(72,92-n*.55);
    return clamp(94-(n-1)*2.2,46,94);
  }

  function diag(){try{return window.InfiniteClick&&window.InfiniteClick.diagnostics?window.InfiniteClick.diagnostics():null;}catch(_){return null;}}
  function pets(){const d=diag();return d&&Array.isArray(d.pets)?d.pets.filter(p=>p&&p.active):[];}
  function bossPoint(){return {x:innerWidth*.5,y:innerHeight*.39};}
  function isSoftLanding(t=now()){return t<state.softUntil;}
  function isQuiet(){return state.phase==="QUIET";}

  function triggerLayout(){
    const total=Math.min(366,innerWidth-22),gap=12,h=Math.min(88,Math.max(72,innerHeight*.105)),half=(total-gap)/2;
    const left=(innerWidth-total)/2,top=innerHeight-h-Math.max(10,innerHeight*.018);
    return {
      FOCUS:{x:left,y:top,w:half,h},
      BURST:{x:left+half+gap,y:top,w:half,h}
    };
  }
  function triggerModeAt(x,y){
    const layout=triggerLayout();
    for(const mode of ["FOCUS","BURST"]){const r=layout[mode];if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return mode;}
    return null;
  }
  function actionButtonHit(x,y){return !!triggerModeAt(x,y);}
  function buttonOrigin(mode){const r=triggerLayout()[mode||"FOCUS"];return {x:r.x+r.w*.5,y:r.y+10};}

  function roundedRect(c,x,y,w,h,r){
    const rr=Math.min(r,w*.5,h*.5);c.beginPath();c.moveTo(x+rr,y);c.arcTo(x+w,y,x+w,y+h,rr);c.arcTo(x+w,y+h,x,y+h,rr);c.arcTo(x,y+h,x,y,rr);c.arcTo(x,y,x+w,y,rr);c.closePath();
  }

  function createOverlay(){
    const c=document.createElement("canvas");c.id="dual-trigger-v30-overlay";c.style.cssText="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:24;";document.body.appendChild(c);
    state.canvas=c;state.ctx=c.getContext("2d");resize();addEventListener("resize",resize,{passive:true});
    const h=document.createElement("div");h.id="dual-trigger-v30-hud";h.style.cssText="position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 9px);transform:translateX(-50%);width:min(90vw,440px);z-index:25;pointer-events:none;color:#fff;font-family:system-ui,-apple-system,sans-serif;text-shadow:0 2px 10px rgba(0,0,0,.8);";
    h.innerHTML=
      '<div data-stage style="font-size:13px;font-weight:950;letter-spacing:1.6px;text-align:center"></div>'+ 
      '<div data-weapon style="font-size:10px;font-weight:900;letter-spacing:.7px;text-align:center;margin-top:2px;color:#fff4b8"></div>'+ 
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:end;margin-top:2px"><div data-recipe style="font-size:9px;font-weight:750;opacity:.82;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div><div data-chaos style="font-size:18px;font-weight:1000;white-space:nowrap"></div></div>'+ 
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;font-size:10px;font-weight:900;letter-spacing:1px"><span>TENSION</span><span data-tension>100%</span></div>'+ 
      '<div style="height:8px;margin-top:3px;border-radius:999px;background:rgba(9,12,24,.58);box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)"><div data-tension-bar style="height:100%;width:100%;border-radius:999px;background:linear-gradient(90deg,#8feaff,#d6c0ff,#ffb2ca);box-shadow:0 0 12px rgba(170,220,255,.55);transition:width .18s ease"></div></div>'+ 
      '<div style="height:5px;margin-top:4px;border-radius:999px;background:rgba(9,12,24,.50)"><div data-progress style="height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#82e8ff,#ffe172,#ff87c9)"></div></div>'+ 
      '<div data-soft style="opacity:0;text-align:center;margin-top:5px;font-size:10px;font-weight:950;letter-spacing:1.8px;transition:opacity .2s ease">SOFT LANDING</div>'+ 
      '<div data-boss-wrap style="display:none;margin-top:7px"><div data-boss-name style="font-size:10px;font-weight:1000;letter-spacing:1.5px;text-align:center"></div><div style="height:10px;margin-top:3px;border-radius:999px;background:rgba(20,4,14,.72);box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)"><div data-boss-hp style="height:100%;width:100%;border-radius:999px;background:linear-gradient(90deg,#ff487d,#ffb35e,#fff27a);box-shadow:0 0 15px rgba(255,100,130,.72)"></div></div></div>'+ 
      '<div data-banner style="position:fixed;left:50%;top:23vh;transform:translate(-50%,-50%) scale(.90);opacity:0;transition:opacity .14s ease,transform .18s ease;white-space:nowrap;text-align:center;font-size:29px;font-weight:1000;letter-spacing:1px;text-shadow:0 4px 24px rgba(0,0,0,.86)"></div>';
    document.body.appendChild(h);
    state.hud={root:h,stage:h.querySelector("[data-stage]"),weapon:h.querySelector("[data-weapon]"),recipe:h.querySelector("[data-recipe]"),chaos:h.querySelector("[data-chaos]"),tension:h.querySelector("[data-tension]"),tensionBar:h.querySelector("[data-tension-bar]"),progress:h.querySelector("[data-progress]"),soft:h.querySelector("[data-soft]"),bossWrap:h.querySelector("[data-boss-wrap]"),bossName:h.querySelector("[data-boss-name]"),bossHp:h.querySelector("[data-boss-hp]"),banner:h.querySelector("[data-banner]")};
  }
  function resize(){if(!state.canvas)return;const dpr=Math.min(devicePixelRatio||1,2);state.canvas.width=Math.max(1,Math.floor(innerWidth*dpr));state.canvas.height=Math.max(1,Math.floor(innerHeight*dpr));state.ctx.setTransform(dpr,0,0,dpr,0,0);}
  function captureGameCanvas(){state.gameCanvas=[...document.querySelectorAll("canvas")].find(c=>c!==state.canvas)||null;}
  function baselineFrom(d){return {buttonPresses:d&&d.buttonPresses||0,directHits:d&&d.directHits||0,objectHits:d&&d.objectHits||0,buttonShots:d&&d.buttonShots||0};}

  function emitGameEvent(type,payload){
    const detail={type,at:Date.now(),version:VERSION,stage:state.stage,phase:state.phase,tension:Math.round(state.tension),chaos:Math.round(state.multiplier),...(payload||{})};
    try{window.dispatchEvent(new CustomEvent("crew:game-event",{detail}));}catch(_){}
    try{window.AndroidGame&&AndroidGame.onGameEvent&&AndroidGame.onGameEvent(JSON.stringify(detail));}catch(_){}
    try{if(typeof state.live.listener==="function")state.live.listener(detail);}catch(_){}
    return detail;
  }
  function liveSnapshot(){
    const total=state.triggerCounts.FOCUS+state.triggerCounts.BURST;
    return {stage:state.stage,phase:state.phase,tension:Math.round(state.tension),chaos:state.multiplier,tapRate:state.tapTimes.length,dominantTrigger:state.triggerCounts.FOCUS===state.triggerCounts.BURST?"MIXED":state.triggerCounts.FOCUS>state.triggerCounts.BURST?"FOCUS":"BURST",triggerCounts:{...state.triggerCounts},totalTriggers:total,softLanding:isSoftLanding(),mood:state.live.directorMood};
  }
  function maybeEmitLivePulse(t){
    if(t-state.live.lastPulseAt<1400)return;state.live.lastPulseAt=t;
    const df=state.triggerCounts.FOCUS-state.live.lastCounts.FOCUS,db=state.triggerCounts.BURST-state.live.lastCounts.BURST;
    state.live.lastCounts={...state.triggerCounts};
    if(df+db>0||state.phase==="QUIET")emitGameEvent("play_pulse",{focusTaps:df,burstTaps:db,...liveSnapshot()});
  }
  function setLiveDirector(listener){state.live.listener=typeof listener==="function"?listener:null;return !!state.live.listener;}
  function applyDirectorCommand(command){
    let cmd=command;try{if(typeof cmd==="string")cmd=JSON.parse(cmd);}catch(_){return false;}
    if(!cmd||typeof cmd!=="object")return false;
    if(cmd.type==="callout"){showBanner(String(cmd.title||"LIVE").slice(0,30),String(cmd.text||"").slice(0,80),clamp(Number(cmd.duration)||900,400,1800));return true;}
    if(cmd.type==="mood"){state.live.directorMood=String(cmd.value||"NEUTRAL").slice(0,24).toUpperCase();emitGameEvent("director_mood",{mood:state.live.directorMood});return true;}
    if(cmd.type==="soft_landing"){state.softUntil=Math.max(state.softUntil,now()+clamp(Number(cmd.duration)||2200,800,5000));state.shakeUntil=0;return true;}
    if(cmd.type==="accent"){const mode=cmd.mode==="BURST"?"BURST":"FOCUS",p=randomTarget();mode==="FOCUS"?focusImpact(p,1.1):burstImpact(p,1.1);return true;}
    return false;
  }

  function startStage(n){
    const t=now(),r=recipeFor(n),d=diag();state.stage=n;state.recipe=r;state.evolution=evolutionFor(n);state.phase="RUN";state.startedAt=t;state.minEndAt=t+r.minMs;state.endAt=t+r.maxMs;state.climaxUntil=0;state.nextAt=0;state.quietUntil=0;state.baseline=baselineFrom(d);state.progress=0;state.bossHp=1;state.realityUsed=false;state.lastWorldFxAt=0;state.lastObjectFxAt=0;state.lastPetFxAt=0;state.tension=tensionStartFor(n,r);state.tensionMilestone=100;
    if(r.boss){state.chaos=Math.max(state.chaos,50);registerChaos(0);showBanner(`PRESSURE STAGE ${n}`,`${PRESSURE_NAMES[r.world]} · CLEAR IT`,1500);bossEntryFx();}
    else if(r.mega){state.chaos=Math.max(state.chaos,35);registerChaos(0);showBanner(`MEGA STAGE ${n}`,`${state.evolution.unlocks.join(" → ")}`,1250);megaEntryFx();}
    else showBanner(`STAGE ${n}`,"FOCUS + BURST",850);
    emitGameEvent("stage_start",{mega:r.mega,pressure:r.boss,weapon:weaponSummary()});updateHud(t);
  }
  function showBanner(title,sub,duration){if(!state.hud)return;const b=state.hud.banner;b.innerHTML=sub?`${title}<div style="font-size:11px;letter-spacing:2px;margin-top:5px;opacity:.82">${sub}</div>`:title;b.style.opacity="1";b.style.transform="translate(-50%,-50%) scale(1)";state.bannerUntil=now()+(duration||850);}
  function thresholdFor(m){return m>=100?100:m>=75?75:m>=50?50:m>=30?30:m>=20?20:m>=10?10:1;}
  function registerChaos(amount){
    const damp=isSoftLanding()?.68:1;state.chaos=clamp(state.chaos+Math.max(0,Number(amount)||0)*damp,0,100);state.lastChaosAt=now();state.multiplier=Math.max(1,Math.round(1+state.chaos*.99));state.peak=Math.max(state.peak,state.multiplier);
    const after=thresholdFor(state.multiplier);if(after>state.lastThreshold){state.lastThreshold=after;const p=chaosPowerFor(state.multiplier);showBanner(`CHAOS ×${after}`,p.label,700);burst(innerWidth*.5,innerHeight*.53,18,"#fff");emitGameEvent("chaos_threshold",{threshold:after,power:p.label});}
    if(state.multiplier>=100&&!state.realityUsed){state.realityUsed=true;realityBreak(1.12);}
  }
  function releaseTension(amount){
    if(state.phase==="QUIET")return;const before=state.tension;state.tension=clamp(state.tension-Math.max(0,Number(amount)||0),0,100);state.released+=Math.max(0,before-state.tension);const crossed=v=>before>v&&state.tension<=v;
    if(crossed(75)&&state.tensionMilestone>75){state.tensionMilestone=75;showBanner("MAKING SPACE","KEEP GOING",520);emitGameEvent("tension_milestone",{tension:75});}
    else if(crossed(50)&&state.tensionMilestone>50){state.tensionMilestone=50;showBanner("SETTLING","THE WORLD IS SLOWING DOWN",560);emitGameEvent("tension_milestone",{tension:50});}
    else if(crossed(25)&&state.tensionMilestone>25){state.tensionMilestone=25;showBanner("ALMOST CLEAR","",520);emitGameEvent("tension_milestone",{tension:25});}
    if(state.tension<=0&&state.tensionMilestone>0){state.tensionMilestone=0;showBanner("CLEAR","",620);emitGameEvent("tension_clear",{});}
  }
  function registerTap(t){
    state.tapTimes.push(t);while(state.tapTimes.length&&t-state.tapTimes[0]>1000)state.tapTimes.shift();
    if(state.tapTimes.length>=7&&t>=state.softCooldownUntil&&!isSoftLanding(t)){state.softUntil=t+2800;state.softCooldownUntil=t+6500;state.softCount++;showBanner("SOFT LANDING","KEEP PRESSING — WE'LL SLOW IT DOWN",900);state.flashes.push({life:.45,max:.45,alpha:.08,color:"#dff8ff"});state.shakeUntil=0;state.shakePower=0;emitGameEvent("soft_landing",{tapRate:state.tapTimes.length});}
  }
  function readProgress(d){if(!d||!state.baseline)return 0;const b=state.baseline,score=Math.max(0,(d.buttonPresses||0)-b.buttonPresses)+Math.max(0,(d.directHits||0)-b.directHits)*1.6+Math.max(0,(d.objectHits||0)-b.objectHits)*1.25+Math.max(0,(d.buttonShots||0)-b.buttonShots)*.16;return clamp(score/Math.max(1,state.recipe.target),0,1);}
  function consumeDiagnostics(d){
    const prev=state.lastDiag;if(!d)return;if(prev){const bp=Math.max(0,(d.buttonPresses||0)-(prev.buttonPresses||0)),hits=Math.max(0,(d.directHits||0)-(prev.directHits||0)),objs=Math.max(0,(d.objectHits||0)-(prev.objectHits||0)),shots=Math.max(0,(d.buttonShots||0)-(prev.buttonShots||0));if(bp){registerChaos(bp*1.25);releaseTension(bp*3.1);}if(hits){registerChaos(hits*4.1);releaseTension(hits*7.5);}if(objs){registerChaos(objs*2.6);releaseTension(objs*5.2);}if(shots){registerChaos(Math.min(3,shots*.34));releaseTension(Math.min(5,shots*.22));}if(state.recipe&&state.recipe.boss&&(bp||hits||objs||shots))state.bossFlashUntil=now()+90;}state.lastDiag=d;
  }
  function enterQuietMoment(t){state.phase="QUIET";state.quietUntil=t+4600;state.nextAt=state.quietUntil;state.tension=0;state.shots.length=0;state.lightning.length=0;state.shakeUntil=0;state.shakePower=0;state.chaos=Math.max(0,state.chaos*.58);state.multiplier=Math.max(1,Math.round(1+state.chaos*.99));showBanner("YOU CLEARED SOME SPACE","",1400);for(let i=0;i<5;i++)setTimeout(()=>ring(innerWidth*.5,innerHeight*.46,42+i*18,"#e8fbff",.45),i*180);emitGameEvent("quiet_moment",{durationMs:4600});}
  function updateStage(dt,t,d){
    if(state.phase==="BOOT"){startStage(1);return;}if(state.phase==="QUIET"){state.chaos=Math.max(0,state.chaos-dt*.010);state.multiplier=Math.max(1,Math.round(1+state.chaos*.99));if(t>=state.quietUntil)startStage(state.stage+1);return;}
    if(t-state.lastChaosAt>650){const decay=state.recipe&&state.recipe.boss?.0022:state.recipe&&state.recipe.mega?.0028:.0048;state.chaos=Math.max(0,state.chaos-dt*(isSoftLanding(t)?decay*1.5:decay));state.multiplier=Math.max(1,Math.round(1+state.chaos*.99));}
    state.progress=readProgress(d);state.bossHp=state.recipe&&state.recipe.boss?1-state.progress:1;stageModifiers(t,d);const progressClear=state.progress>=1&&((state.recipe&&state.recipe.boss)||t>=state.minEndAt);
    if(state.phase==="RUN"&&(progressClear||t>=state.endAt))climax(t);else if(state.phase==="CLIMAX"&&t>=state.climaxUntil){registerChaos(state.recipe.boss?20:state.recipe.mega?14:7);if(state.recipe.mega||state.recipe.boss)enterQuietMoment(t);else{state.phase="CLEAR";state.nextAt=t+700;showBanner("STAGE CLEAR",`TENSION ${Math.round(state.tension)}%`,700);burst(innerWidth*.5,innerHeight*.40,24,WORLD_COLORS[state.recipe.world]);emitGameEvent("stage_clear",{});}}else if(state.phase==="CLEAR"&&t>=state.nextAt)startStage(state.stage+1);
  }
  function stageModifiers(t,d){
    const r=state.recipe;if(!r||state.phase==="CLEAR"||state.phase==="QUIET")return;const ps=d&&d.pets||[],calm=1-clamp(state.tension/100,0,1),soft=isSoftLanding(t),frequency=(soft?1.85:1)*(1+calm*.95),chance=(soft?.40:1)*(1-calm*.55);
    if(t-state.lastWorldFxAt>(r.boss?120*frequency:r.mega?150*frequency:260*frequency)){state.lastWorldFxAt=t;if(r.worldMod==="STORM"&&Math.random()<.75*chance)lightning(Math.random()*innerWidth,60+Math.random()*innerHeight*.58,1,"FOCUS");else if(r.worldMod==="BUBBLE_RAIN"&&Math.random()<chance)for(let i=0;i<(soft?1:2);i++)bubble(Math.random()*innerWidth,innerHeight+20,8+Math.random()*10);else if(r.worldMod==="LOW_GRAVITY"&&Math.random()<.65*chance)spark(Math.random()*innerWidth,innerHeight*.25+Math.random()*innerHeight*.55,"#b9efff",-25-Math.random()*30);else if(r.worldMod==="CARNIVAL_FRENZY"&&Math.random()<.72*chance)star(Math.random()*innerWidth,Math.random()*innerHeight*.68,WORLD_COLORS[r.world],1);}
    if(t-state.lastPetFxAt>((r.mega?230:430)*frequency)){state.lastPetFxAt=t;if(ps.length&&Math.random()<chance){const p=ps[Math.floor(Math.random()*ps.length)],x=p.x||innerWidth*.5,y=p.y||innerHeight*.45;if(r.petMod==="GIANT")ring(x,y,40,"#fff4b8",.55);else if(r.petMod==="MINI_SWARM"){for(let i=0;i<(soft?2:4);i++)spark(x+(Math.random()-.5)*70,y+(Math.random()-.5)*55,"#ffd0ec",-18);}else if(r.petMod==="FAST")speedLines(x,y);else if(r.petMod==="BOUNCY")ring(x,y,18,"#9ee9ff",.75);}}
    if(t-state.lastObjectFxAt>((r.mega?450:760)*frequency)){state.lastObjectFxAt=t;if(Math.random()<chance){if(r.objectMod==="BUMPER_RUSH")ring(Math.random()*innerWidth,innerHeight*.30+Math.random()*innerHeight*.42,28,"#ff9eb7",.8);else if(r.objectMod==="BALLOON_STORM")for(let i=0;i<(soft?1:3);i++)bubble(Math.random()*innerWidth,innerHeight+15,7+Math.random()*8);else if(r.objectMod==="SPRING_PARTY")springTrail(Math.random()*innerWidth,innerHeight*.72);else confetti(Math.random()*innerWidth,innerHeight*.28,soft?3:8);}}
  }
  function climax(t){
    const r=state.recipe;if(state.phase!=="RUN")return;state.phase="CLIMAX";state.climaxUntil=t+(r.boss?3300:r.mega?2800:2100);state.progress=1;state.bossHp=0;state.tension=0;registerChaos(r.boss?30:r.mega?24:12);
    if(r.boss){showBanner("PRESSURE CLEARED",`${PRESSURE_NAMES[r.world]} RELEASED`,1600);bossBreak();emitGameEvent("pressure_clear",{name:PRESSURE_NAMES[r.world]});}
    else{showBanner(r.mega?"RELEASE WAVE":r.climax,`STAGE ${r.stage} CLIMAX`,r.mega?1500:1000);if(r.climax==="THUNDER_FINALE")thunderFinale();else if(r.climax==="PINBALL_BREAK")pinballBreak();else if(r.climax==="WORLD_BREAK")worldBreak();else if(r.climax==="OVERDRIVE_RAIN")overdriveRain();else realityBreak(1);}
  }

  function onDown(e){
    const mode=triggerModeAt(e.clientX,e.clientY);if(!state.ready||!mode)return;const t=now();registerTap(t);state.triggerCounts[mode]++;state.triggerFlash[mode]=t+150;state.activePointers.set(e.pointerId,mode);state.holding=state.activePointers.size>0;
    if(isQuiet()){mode==="FOCUS"?focusImpact({x:e.clientX,y:e.clientY},.45):burstImpact({x:e.clientX,y:e.clientY},.45);return;}
    registerChaos(mode==="BURST"?2.7:2.2);releaseTension(mode==="BURST"?2.0:1.7);stageWeapon(e.clientX,e.clientY,false,mode);
  }
  function onUp(e){state.activePointers.delete(e.pointerId);state.holding=state.activePointers.size>0;}
  function heldModes(){return [...new Set(state.activePointers.values())];}

  function stageWeapon(x,y,auto,mode){
    const r=state.recipe,e=state.evolution;if(!r||!e||isQuiet())return;mode=mode==="BURST"?"BURST":"FOCUS";
    const origin=buttonOrigin(mode),cp=chaosPowerFor(state.multiplier),count=e.shotCount*(cp.double?2:1),scale=(cp.big?1.65:1)*(mode==="BURST"?1.12:.92);
    const ricochetCount=(e.ricochet?3:0)+(cp.ricochet?2:0)+(r.boss&&e.ricochet?2:0),lightningCount=(e.lightning?2:0)+(cp.lightning?2:0)+(r.boss&&(e.lightning||cp.lightning)?1:0);
    fireMulti(origin,count,scale,e.spread,mode);if(ricochetCount)fireRicochet(origin,ricochetCount,scale,mode);if(lightningCount)chainLightning(lightningCount,mode);if(e.missileRain&&!auto)missileRain(r.boss?6:4,scale,mode);if((r.mega||r.boss)&&!auto&&state.multiplier>=50)(mode==="FOCUS"?focusImpact:burstImpact)(r.boss?bossPoint():randomTarget(),r.boss?1.25:1);
  }
  function targetPoints(count){const r=state.recipe;if(r&&r.boss){const b=bossPoint();return Array.from({length:count},(_,i)=>({x:b.x+(i-(count-1)/2)*18,y:b.y+((i%2)*2-1)*10}));}const ps=pets();if(ps.length)return Array.from({length:count},(_,i)=>{const p=ps[(Math.floor(Math.random()*ps.length)+i)%ps.length];return {x:p.x||innerWidth*.5,y:p.y||innerHeight*.38};});return Array.from({length:count},()=>randomTarget());}
  function randomTarget(){return {x:innerWidth*(.22+Math.random()*.56),y:innerHeight*(.24+Math.random()*.40)};}
  function fireMulti(origin,count,scale,spread,mode){const pts=targetPoints(count);pts.forEach((p,i)=>shot(origin,p,mode,i*32,scale||1,spread));}
  function fireRicochet(origin,count,scale,mode){chainShot(origin,targetPoints(count),mode,scale||1);}
  function lightningToPet(){const p=targetPoints(1)[0];lightning(p.x,p.y,1.1,"FOCUS");}
  function chainLightning(count,mode){let start=buttonOrigin(mode);for(const p of targetPoints(count||2)){energyArc(start,p,mode,1);start=p;}}
  function missileRain(count,scale,mode){const pts=targetPoints(count);pts.forEach((p,i)=>shot({x:p.x+(Math.random()-.5)*90,y:-30-i*12},p,mode,i*45,(scale||1)*1.12,true));}
  function impactExplosion(p,color,power){burst(p.x,p.y,Math.round(16*(power||1)),color);ring(p.x,p.y,18,color,1);state.flashes.push({life:.10,max:.10,alpha:.05*(power||1),color});}

  function shot(a,b,mode,delay,scale,spread){
    mode=mode==="BURST"?"BURST":"FOCUS";const slow=isSoftLanding()?1.55:1,base=mode==="FOCUS"?.24:.31;
    state.shots.push({kind:mode,a:{...a},b:{...b},color:TRIGGERS[mode].color,delay:(delay||0)/1000,t:0,d:base*slow,arc:(Math.random()<.5?-1:1)*(spread?28+Math.random()*52:14+Math.random()*30),scale:scale||1,seed:Math.random()*10});
  }
  function chainShot(a,points,mode,scale){let start={...a};points.forEach((p,i)=>{state.shots.push({kind:mode,a:{...start},b:{...p},color:TRIGGERS[mode].color,delay:i*.065,t:0,d:(mode==="FOCUS"?.18:.24)*(isSoftLanding()?1.55:1),arc:(Math.random()<.5?-1:1)*(15+Math.random()*26),scale:scale||1,seed:Math.random()*10});start={...p};});}
  function sampleShot(s,q){const e=1-Math.pow(1-clamp(q,0,1),3),dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len,off=Math.sin(Math.PI*e)*s.arc*(1-e*.15);return {x:s.a.x+dx*e+nx*off,y:s.a.y+dy*e+ny*off,angle:Math.atan2(dy,dx)};}
  function focusImpact(p,power){const k=power||1;for(let i=0;i<10*k;i++){const a=Math.random()*Math.PI*2,sp=45+Math.random()*145*k;particle(p.x,p.y,Math.cos(a)*sp,Math.sin(a)*sp-20,.24+Math.random()*.24,i%3?"#b7efff":"#e8d8ff",3+Math.random()*5,"shard");}ring(p.x,p.y,12*k,"#d9fbff",.65);}
  function burstImpact(p,power){const k=power||1;ring(p.x,p.y,17*k,"#ffe0a8",1);ring(p.x,p.y,27*k,"#ffb4d3",.65);for(let i=0;i<8*k;i++){const a=Math.random()*Math.PI*2,sp=28+Math.random()*95*k;particle(p.x,p.y,Math.cos(a)*sp,Math.sin(a)*sp-10,.36+Math.random()*.24,i%2?"#ffd58f":"#ffabd2",3+Math.random()*5,i%3?"dot":"bubble");}state.flashes.push({life:.08,max:.08,alpha:.035*k,color:"#fff6de"});}
  function updateShots(dt){for(let i=state.shots.length-1;i>=0;i--){const s=state.shots[i];if(s.delay>0){s.delay-=dt/1000;continue;}s.t+=dt/1000;const q=clamp(s.t/s.d,0,1);if(q>=1){s.kind==="FOCUS"?focusImpact(s.b,s.scale):burstImpact(s.b,s.scale);if(s.scale>1.45)impactExplosion(s.b,s.color,.32);state.shots.splice(i,1);}}}
  function drawFocusShot(c,s){
    const q=clamp(s.t/s.d,0,1),p=sampleShot(s,q),z=s.scale||1;c.save();
    for(let i=4;i>=1;i--){const tq=clamp(q-i*.035,0,1),tp=sampleShot(s,tq);c.globalAlpha=.08+(4-i)*.04;c.strokeStyle=i%2?"#9feeff":"#c3b8ff";c.lineWidth=(1.2+i*.55)*z;c.beginPath();c.moveTo(tp.x,tp.y);c.lineTo(p.x,p.y);c.stroke();}
    c.translate(p.x,p.y);c.rotate(p.angle+Math.PI/4);c.shadowBlur=18*z;c.shadowColor="#9feeff";c.fillStyle="#eaffff";c.globalAlpha=.96;c.beginPath();c.moveTo(0,-7*z);c.lineTo(5*z,0);c.lineTo(0,9*z);c.lineTo(-5*z,0);c.closePath();c.fill();c.strokeStyle="#bfb8ff";c.lineWidth=1.1*z;c.stroke();c.restore();
  }
  function drawBurstShot(c,s){
    const q=clamp(s.t/s.d,0,1),p=sampleShot(s,q),z=s.scale||1;c.save();
    for(let i=4;i>=1;i--){const tp=sampleShot(s,clamp(q-i*.045,0,1));c.globalAlpha=.055+i*.028;c.fillStyle=i%2?"#ffb1ce":"#ffd28f";c.beginPath();c.arc(tp.x,tp.y,(4+i*1.6)*z,0,Math.PI*2);c.fill();}
    c.translate(p.x,p.y);const g=c.createRadialGradient(-3*z,-3*z,1,0,0,11*z);g.addColorStop(0,"#fff");g.addColorStop(.35,"#fff0c8");g.addColorStop(.72,"#ffc985");g.addColorStop(1,"rgba(255,150,200,.18)");c.fillStyle=g;c.shadowBlur=20*z;c.shadowColor="#ffb7cd";c.globalAlpha=.96;c.beginPath();c.arc(0,0,11*z,0,Math.PI*2);c.fill();c.globalAlpha=.65;c.strokeStyle="#fff4dc";c.lineWidth=1.4*z;c.beginPath();c.arc(0,0,14*z,0,Math.PI*2);c.stroke();c.restore();
  }
  function drawShots(c){for(const s of state.shots){if(s.delay>0)continue;s.kind==="BURST"?drawBurstShot(c,s):drawFocusShot(c,s);}}

  function energyArc(a,b,mode,power){
    mode=mode==="BURST"?"BURST":"FOCUS";const pts=[{...a}],steps=6,dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len;
    for(let i=1;i<steps;i++){const t=i/steps,curve=Math.sin(Math.PI*t)*(mode==="FOCUS"?16:10)*(Math.random()<.5?-1:1);pts.push({x:a.x+dx*t+nx*curve+(Math.random()-.5)*7,y:a.y+dy*t+ny*curve+(Math.random()-.5)*7});}pts.push({...b});state.lightning.push({pts,life:mode==="FOCUS"?.18:.22,max:mode==="FOCUS"?.18:.22,mode,power:power||1});
  }
  function lightning(x,y,p,mode){energyArc({x:x+(Math.random()-.5)*55,y:0},{x,y},mode||"FOCUS",p||1);if(!isSoftLanding()){state.shakeUntil=Math.max(state.shakeUntil,now()+100);state.shakePower=Math.max(state.shakePower,1.8+(p||1));}}
  function drawEnergyArcs(c){for(const l of state.lightning){const a=clamp(l.life/l.max,0,1),burstMode=l.mode==="BURST";c.save();c.globalAlpha=a*(burstMode?.48:.66);c.strokeStyle=burstMode?"#ffd4a4":"#b8f3ff";c.lineWidth=(burstMode?3.4:2.2)*(l.power||1);c.shadowBlur=burstMode?13:16;c.shadowColor=burstMode?"#ffb4cf":"#9fe9ff";c.lineCap="round";c.lineJoin="round";c.beginPath();l.pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();if(!burstMode){c.globalAlpha=a*.7;c.strokeStyle="#fff";c.lineWidth=.7*(l.power||1);c.stroke();}else{for(let i=1;i<l.pts.length;i+=2){const p=l.pts[i];c.globalAlpha=a*.25;c.fillStyle="#fff1cf";c.beginPath();c.arc(p.x,p.y,3.5*(l.power||1),0,Math.PI*2);c.fill();}}c.restore();}}

  function particle(x,y,vx,vy,life,color,size,shape){state.particles.push({x,y,vx,vy,life,max:life,color,size,shape:shape||"dot",rot:Math.random()*Math.PI*2});}
  function spark(x,y,color,vy){particle(x,y,(Math.random()-.5)*45,vy==null?-45:vy,.36+Math.random()*.2,color,2.5+Math.random()*3,"star");}
  function star(x,y,color,p){for(let i=0;i<6;i++){const a=Math.PI*2*i/6;particle(x,y,Math.cos(a)*(55+Math.random()*70)*p,Math.sin(a)*(55+Math.random()*70)*p,.28,color,3+Math.random()*3,"star");}}
  function bubble(x,y,r){particle(x,y,(Math.random()-.5)*20,-45-Math.random()*75,.9,"#bff4ff",r,"bubble");}
  function burst(x,y,n,color){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,sp=55+Math.random()*180;particle(x,y,Math.cos(a)*sp,Math.sin(a)*sp-40,.32+Math.random()*.25,i%3===0?"#fff":color,2+Math.random()*5,i%2?"star":"dot");}}
  function confetti(x,y,n){const cols=["#fff","#ffd36d","#ff8fc7","#8feaff","#caa8ff"];for(let i=0;i<n;i++)particle(x+(Math.random()-.5)*60,y+(Math.random()-.5)*30,(Math.random()-.5)*90,45+Math.random()*120,.7+Math.random()*.4,cols[i%cols.length],3+Math.random()*4,"rect");}
  function ring(x,y,r,color,p){state.rings.push({x,y,r,max:r*(2.2+(p||.5)),life:.34,maxLife:.34,color,alpha:.50});}
  function springTrail(x,y){for(let i=0;i<7;i++)particle(x+(i-3)*7,y,0,-120-Math.random()*120,.40,["#8feaff","#fff","#9affcb"][i%3],3,"rect");}
  function speedLines(x,y){for(let i=0;i<5;i++)particle(x-55-Math.random()*30,y+(Math.random()-.5)*42,170+Math.random()*90,0,.20,"#fff",2,"line");}
  function updateParticles(dt){
    for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.life-=dt/1000;p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vy+=32*dt/1000;p.rot+=2.4*dt/1000;if(p.life<=0)state.particles.splice(i,1);}
    for(let i=state.rings.length-1;i>=0;i--){const r=state.rings[i];r.life-=dt/1000;if(r.life<=0)state.rings.splice(i,1);}
    for(let i=state.lightning.length-1;i>=0;i--){state.lightning[i].life-=dt/1000;if(state.lightning[i].life<=0)state.lightning.splice(i,1);}
    for(let i=state.flashes.length-1;i>=0;i--){state.flashes[i].life-=dt/1000;if(state.flashes[i].life<=0)state.flashes.splice(i,1);}
  }
  function drawParticle(c,p){
    const a=clamp(p.life/p.max,0,1);c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.globalAlpha=a;c.strokeStyle=p.color;c.fillStyle=p.color;c.shadowBlur=10;c.shadowColor=p.color;
    if(p.shape==="bubble"){c.lineWidth=1.4;c.globalAlpha=a*.65;c.beginPath();c.arc(0,0,p.size,0,Math.PI*2);c.stroke();}
    else if(p.shape==="rect"){c.fillRect(-p.size*.6,-p.size*.25,p.size*1.2,p.size*.5);}
    else if(p.shape==="line"){c.lineWidth=p.size;c.beginPath();c.moveTo(-18,0);c.lineTo(18,0);c.stroke();}
    else if(p.shape==="shard"){c.beginPath();c.moveTo(0,-p.size);c.lineTo(p.size*.45,0);c.lineTo(0,p.size*.75);c.lineTo(-p.size*.35,0);c.closePath();c.fill();}
    else if(p.shape==="star"){c.beginPath();for(let i=0;i<8;i++){const r=i%2?p.size*.38:p.size,ang=-Math.PI/2+i*Math.PI/4;c.lineTo(Math.cos(ang)*r,Math.sin(ang)*r);}c.closePath();c.fill();}
    else{c.beginPath();c.arc(0,0,p.size,0,Math.PI*2);c.fill();}c.restore();
  }

  function megaEntryFx(){const col=WORLD_COLORS[state.recipe.world];burst(innerWidth*.5,innerHeight*.42,38,col);ring(innerWidth*.5,innerHeight*.42,42,col,1);state.shakeUntil=now()+520;state.shakePower=7;state.flashes.push({life:.22,max:.22,alpha:.16,color:col});}
  function bossEntryFx(){const p=bossPoint(),col=WORLD_COLORS[state.recipe.world];for(let i=0;i<4;i++)ring(p.x,p.y,44+i*16,col,1);burst(p.x,p.y,42,col);state.flashes.push({life:.28,max:.28,alpha:.18,color:col});state.shakeUntil=now()+800;state.shakePower=8;}
  function bossBreak(){const p=bossPoint(),col=WORLD_COLORS[state.recipe.world];for(let i=0;i<8;i++)setTimeout(()=>{const q={x:p.x+(Math.random()-.5)*170,y:p.y+(Math.random()-.5)*145};i%2?focusImpact(q,1.2):burstImpact(q,1.1);},i*110);for(let i=0;i<5;i++)setTimeout(()=>lightning(p.x+(Math.random()-.5)*170,p.y+(Math.random()-.5)*150,1.15,i%2?"BURST":"FOCUS"),i*130);state.flashes.push({life:.35,max:.35,alpha:.20,color:"#fff"});state.shakeUntil=now()+1600;state.shakePower=8;}
  function thunderFinale(){for(let i=0;i<7;i++)setTimeout(()=>lightning(innerWidth*(.12+Math.random()*.76),innerHeight*(.16+Math.random()*.55),1.05,i%2?"BURST":"FOCUS"),i*145);state.shakeUntil=now()+1200;state.shakePower=5;}
  function pinballBreak(){for(let i=0;i<7;i++)setTimeout(()=>ring(innerWidth*(.18+Math.random()*.64),innerHeight*(.20+Math.random()*.50),26+Math.random()*28,i%2?"#ffd5a1":"#b8efff",1),i*110);state.shakeUntil=now()+900;state.shakePower=5;}
  function worldBreak(){state.flashes.push({life:.28,max:.28,alpha:.13,color:WORLD_COLORS[state.recipe.world]});for(let i=0;i<5;i++)ring(innerWidth*.5,innerHeight*.42,35+i*18,WORLD_COLORS[(state.recipe.world+i)%4],1);burst(innerWidth*.5,innerHeight*.42,42,WORLD_COLORS[state.recipe.world]);state.shakeUntil=now()+700;state.shakePower=5;}
  function overdriveRain(){for(let i=0;i<55;i++)setTimeout(()=>confetti(Math.random()*innerWidth,-10,2),Math.random()*900);state.flashes.push({life:.16,max:.16,alpha:.08,color:"#fff"});}
  function realityBreak(power){const p=power||1,soft=isSoftLanding()?.35:1;state.shakeUntil=now()+1100;state.shakePower=6*p*soft;state.flashes.push({life:.24,max:.24,alpha:.13*soft,color:"#fff"});for(let i=0;i<(isSoftLanding()?2:5);i++)setTimeout(()=>lightning(innerWidth*(.08+Math.random()*.84),innerHeight*(.18+Math.random()*.56),1.05,i%2?"BURST":"FOCUS"),i*120);for(let i=0;i<4;i++)ring(innerWidth*.5,innerHeight*.42,28+i*24,WORLD_COLORS[(state.recipe.world+i)%4],1);showBanner("REALITY BREAK",`CHAOS ×${state.multiplier}`,900);}

  function drawBoss(c){
    if(!state.recipe||!state.recipe.boss||state.phase==="CLEAR"||state.phase==="QUIET")return;const p=bossPoint(),hp=clamp(state.bossHp,0,1),phase=hp>.75?0:hp>.5?1:hp>.25?2:3,col=WORLD_COLORS[state.recipe.world],r=Math.min(innerWidth,innerHeight)*(.105+phase*.006);
    c.save();c.translate(p.x,p.y);c.globalAlpha=state.phase==="CLIMAX"?.35:.92;c.shadowBlur=22;c.shadowColor=col;const g=c.createRadialGradient(-r*.25,-r*.3,r*.12,0,0,r);g.addColorStop(0,"#fff");g.addColorStop(.25,col);g.addColorStop(1,"rgba(20,15,38,.92)");c.fillStyle=g;c.strokeStyle="#fff";c.lineWidth=2.4;c.beginPath();if(state.recipe.world===1){for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3,rr=i%2?r*.78:r,x=Math.cos(a)*rr,y=Math.sin(a)*rr;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();}else c.arc(0,0,r,0,Math.PI*2);c.fill();c.stroke();c.globalAlpha=.75;c.strokeStyle="#fff";c.lineWidth=1.6;for(let i=0;i<phase+1;i++){c.beginPath();c.moveTo((i-1.5)*r*.14,-r*.15);c.lineTo((i-1.2)*r*.25,r*.10);c.lineTo((i-1.6)*r*.38,r*.40);c.stroke();}if(now()<state.bossFlashUntil){c.globalAlpha=.4;c.fillStyle="#fff";c.beginPath();c.arc(0,0,r*1.05,0,Math.PI*2);c.fill();}c.restore();
  }
  function drawCalmLayer(c,t){const calm=state.phase==="QUIET"?1:clamp(1-state.tension/100,0,1);if(calm<=.01)return;c.save();c.globalAlpha=.018+.07*calm;c.fillStyle="#dff8ff";c.fillRect(0,0,innerWidth,innerHeight);const breathe=.5+.5*Math.sin(t/1050),x=innerWidth*.5,y=innerHeight*.48,r=Math.min(innerWidth,innerHeight)*(state.phase==="QUIET"?.12+.025*breathe:.05+.015*breathe*calm);c.globalAlpha=state.phase==="QUIET"?.18:.045*calm;c.strokeStyle="#fff";c.lineWidth=1.4;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();if(state.phase==="QUIET"){c.globalAlpha=.32;c.font="700 11px system-ui,-apple-system,sans-serif";c.textAlign="center";c.fillStyle="#fff";c.fillText("NO RUSH",x,y+r+28);}c.restore();}
  function drawTriggerButton(c,mode,t){
    const r=triggerLayout()[mode],cfg=TRIGGERS[mode],hot=t<state.triggerFlash[mode],held=heldModes().includes(mode),press=hot||held,scale=press?.975:1,cx=r.x+r.w/2,cy=r.y+r.h/2;
    c.save();c.translate(cx,cy);c.scale(scale,scale);c.translate(-cx,-cy);const g=c.createLinearGradient(r.x,r.y,r.x+r.w,r.y+r.h);if(mode==="FOCUS"){g.addColorStop(0,"rgba(20,46,72,.93)");g.addColorStop(1,"rgba(63,42,91,.94)");}else{g.addColorStop(0,"rgba(82,49,25,.94)");g.addColorStop(1,"rgba(91,38,67,.94)");}c.fillStyle=g;c.shadowBlur=press?24:13;c.shadowColor=cfg.color;roundedRect(c,r.x,r.y,r.w,r.h,24);c.fill();c.globalAlpha=.88;c.strokeStyle=cfg.color;c.lineWidth=press?2.4:1.25;roundedRect(c,r.x+.7,r.y+.7,r.w-1.4,r.h-1.4,23);c.stroke();
    c.globalAlpha=.95;c.fillStyle=cfg.core;c.textAlign="center";c.font="900 15px system-ui,-apple-system,sans-serif";c.fillText(cfg.label,cx,r.y+r.h*.47);c.globalAlpha=.62;c.font="800 8px system-ui,-apple-system,sans-serif";c.fillText(cfg.sub,cx,r.y+r.h*.68);
    if(mode==="FOCUS"){c.translate(cx,r.y+18);c.rotate(Math.PI/4);c.globalAlpha=.9;c.fillStyle=cfg.core;c.fillRect(-5,-5,10,10);}else{c.globalAlpha=.84;c.strokeStyle=cfg.core;c.lineWidth=2;c.beginPath();c.arc(cx,r.y+18,7,0,Math.PI*2);c.stroke();c.globalAlpha=.32;c.beginPath();c.arc(cx,r.y+18,11,0,Math.PI*2);c.stroke();}c.restore();
  }
  function render(t){const c=state.ctx;if(!c)return;c.clearRect(0,0,innerWidth,innerHeight);drawBoss(c);for(const f of state.flashes){c.save();c.globalAlpha=f.alpha*clamp(f.life/f.max,0,1);c.fillStyle=f.color;c.fillRect(0,0,innerWidth,innerHeight);c.restore();}for(const r of state.rings){const q=1-r.life/r.max,rad=r.r+(r.max-r.r)*q;c.save();c.globalAlpha=r.alpha*(1-q);c.strokeStyle=r.color;c.lineWidth=2;c.shadowBlur=9;c.shadowColor=r.color;c.beginPath();c.arc(r.x,r.y,rad,0,Math.PI*2);c.stroke();c.restore();}drawEnergyArcs(c);drawShots(c);for(const p of state.particles)drawParticle(c,p);drawCalmLayer(c,t||now());drawTriggerButton(c,"FOCUS",t||now());drawTriggerButton(c,"BURST",t||now());}
  function shakeGame(t){if(!state.gameCanvas)captureGameCanvas();const c=state.gameCanvas;if(!c)return;if(t<state.shakeUntil&&!isQuiet()){const calmScale=isSoftLanding(t)?.20:(.26+.58*clamp(state.tension/100,0,1)),p=state.shakePower*calmScale*(state.shakeUntil-t)/Math.max(1,450),x=(Math.random()-.5)*p,y=(Math.random()-.5)*p,r=(Math.random()-.5)*p*.04;c.style.transform=`translate(${x}px,${y}px) rotate(${r}deg) scale(1.004)`;}else if(c.style.transform)c.style.transform="";}
  function weaponSummary(){const e=state.evolution||evolutionFor(state.stage);return e.unlocks.slice(-3).join(" + ");}
  function updateHud(t){
    const h=state.hud,r=state.recipe;if(!h||!r)return;const until=state.phase==="RUN"?state.endAt:state.phase==="CLIMAX"?state.climaxUntil:state.phase==="QUIET"?state.quietUntil:state.nextAt,sec=Math.max(0,Math.ceil((until-t)/1000)),cp=chaosPowerFor(state.multiplier);
    h.stage.textContent=state.phase==="QUIET"?`QUIET MOMENT · ${sec}s`:`${r.boss?"PRESSURE ":r.mega?"MEGA ":""}STAGE ${r.stage} · ${sec}s`;h.weapon.textContent=state.phase==="QUIET"?"LET THE SCREEN SETTLE":`FOCUS / BURST · ${weaponSummary()}`;h.recipe.textContent=state.phase==="QUIET"?"YOU CLEARED SOME SPACE":[r.worldMod,r.petMod,r.objectMod].join(" · ");h.chaos.textContent=`CHAOS ×${state.multiplier}`;h.chaos.style.color=state.multiplier>=75?"#fff":state.multiplier>=40?"#ffe177":"#c9f5ff";h.tension.textContent=`${Math.round(state.tension)}%`;h.tensionBar.style.width=`${Math.round(state.tension)}%`;h.tensionBar.style.opacity=state.phase==="QUIET"?.35:"1";h.progress.style.width=`${Math.round(state.progress*100)}%`;h.progress.style.filter=state.multiplier>=50?"brightness(1.3) drop-shadow(0 0 7px #fff)":"";h.weapon.style.textShadow=cp.barrage?"0 0 10px #fff":"";h.soft.style.opacity=isSoftLanding(t)&&!isQuiet()?"1":"0";h.bossWrap.style.display=r.boss&&!isQuiet()?"block":"none";if(r.boss){h.bossName.textContent=PRESSURE_NAMES[r.world];h.bossHp.style.width=`${Math.round(state.bossHp*100)}%`;}if(state.bannerUntil&&t>=state.bannerUntil){h.banner.style.opacity="0";h.banner.style.transform="translate(-50%,-50%) scale(.94)";state.bannerUntil=0;}
  }
  function loop(t){
    const dt=Math.min(50,t-state.lastFrame||16.7);state.lastFrame=t;const d=diag();consumeDiagnostics(d);updateStage(dt,t,d);const cp=chaosPowerFor(state.multiplier);
    if(!isQuiet()&&cp.barrage){for(const mode of heldModes()){const cadence=isSoftLanding(t)?155:mode==="BURST"?118:92;if(t-state.lastRapid[mode]>cadence){state.lastRapid[mode]=t;stageWeapon(innerWidth*.5,innerHeight-80,true,mode);}}}
    maybeEmitLivePulse(t);updateShots(dt);updateParticles(dt);updateHud(t);shakeGame(t);render(t);requestAnimationFrame(loop);
  }
  function init(){if(state.ready)return;const d=diag();if(!d){setTimeout(init,120);return;}state.ready=true;createOverlay();captureGameCanvas();state.lastDiag=d;document.addEventListener("pointerdown",onDown,true);document.addEventListener("pointerup",onUp,true);document.addEventListener("pointercancel",onUp,true);startStage(1);requestAnimationFrame(loop);try{window.AndroidGame&&AndroidGame.onRendererReady&&AndroidGame.onRendererReady(VERSION);}catch(_){} }

  const api={
    version:VERSION,v29Version:V29_VERSION,v28Version:V28_VERSION,legacyVersion:LEGACY_VERSION,recipeFor,evolutionFor,chaosPowerFor,tensionStartFor,triggerLayout,liveSnapshot,setLiveDirector,applyDirectorCommand,emitGameEvent,
    diagnostics:()=>({stage:state.stage,phase:state.phase,recipe:state.recipe,evolution:state.evolution,progress:state.progress,bossHp:state.bossHp,chaos:state.chaos,multiplier:state.multiplier,peak:state.peak,tension:state.tension,released:state.released,softLanding:isSoftLanding(),softCount:state.softCount,triggerCounts:{...state.triggerCounts},dominantTrigger:liveSnapshot().dominantTrigger}),
    forceStage:n=>startStage(n),fire:(mode)=>stageWeapon(innerWidth*.5,innerHeight-80,false,mode)
  };
  window.DualTriggerV30=api;window.TensionReleaseV29=api;window.RunEvolutionV28=api;window.EndlessChaosV27=api;init();
})();
