(() => {
  "use strict";

  const VERSION="PURE_BEAM_V30_6";
  const PREVIOUS_VERSION="IMPACT_PASS_V30_5";
  const PATTERNS=["STRAIGHT","TWIN","SWEEP","HEAVY"];
  const COLORS={
    FOCUS:{outer:"rgba(120,220,255,.28)",beam:"#8fe8ff",core:"#ffffff"},
    BURST:{outer:"rgba(255,201,128,.30)",beam:"#ffd08d",core:"#ffffff"}
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>performance.now();

  const state={
    ready:false,enabled:true,canvas:null,ctx:null,lastFrame:now(),frameMs:16.7,quality:"FULL",
    hype:0,peak:0,lastTapAt:0,lastMode:null,tapTimes:[],tierSeen:0,
    cycle:0,resets:0,surgeUntil:0,resetPending:false,nextOverchargeAt:10,
    held:new Map(),beams:[],impacts:[],flash:0,
    virtualPresses:0,virtualShots:0,diagHooked:false,originalDiagnostics:null,
    stats:{physicalTaps:0,holdShots:0,visualBeams:0,overcharges:0}
  };

  function emit(type,payload){
    const detail={type,at:Date.now(),version:VERSION,hype:Math.round(state.hype),tier:hypeTier(),cycle:state.cycle,pattern:PATTERNS[state.cycle%PATTERNS.length],...(payload||{})};
    try{window.dispatchEvent(new CustomEvent("crew:game-event",{detail}));}catch(_){}
    try{window.AndroidGame&&AndroidGame.onGameEvent&&AndroidGame.onGameEvent(JSON.stringify(detail));}catch(_){}
  }

  function installDiagnosticsBridge(){
    if(state.diagHooked)return true;
    const api=window.InfiniteClick;if(!api||typeof api.diagnostics!=="function")return false;
    const original=api.diagnostics.bind(api);state.originalDiagnostics=original;
    api.diagnostics=function(){const d=original()||{};return {...d,buttonPresses:(Number(d.buttonPresses)||0)+state.virtualPresses,buttonShots:(Number(d.buttonShots)||0)+state.virtualShots};};
    state.diagHooked=true;return true;
  }

  function hideLegacyUi(){
    const ids=["dual-trigger-v30-hud","dual-trigger-v30-overlay","tap-rush-v30-4-overlay"];
    for(const id of ids){const el=document.getElementById(id);if(el)el.style.display="none";}
    const old=document.querySelector(".action-button");if(old)old.style.display="none";
  }

  function ensureCanvas(){
    if(state.canvas)return;
    const c=document.createElement("canvas");c.id="pure-beam-v30-6-overlay";
    c.style.cssText="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:30;";
    document.body.appendChild(c);state.canvas=c;state.ctx=c.getContext("2d",{alpha:true});resize();
    addEventListener("resize",resize,{passive:true});
  }
  function resize(){
    if(!state.canvas)return;const dpr=Math.min(devicePixelRatio||1,1.25);
    state.canvas.width=Math.max(1,Math.floor(innerWidth*dpr));state.canvas.height=Math.max(1,Math.floor(innerHeight*dpr));
    state.ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function originFor(mode){return {x:innerWidth*(mode==="FOCUS"?.34:.66),y:innerHeight-Math.max(18,innerHeight*.028)};}
  function modeAt(x){return x<innerWidth*.5?"FOCUS":"BURST";}
  function targetFor(mode,angleOffset=0){
    const o=originFor(mode),baseX=innerWidth*(mode==="FOCUS"?.40:.60),x=clamp(baseX+(Math.random()-.5)*innerWidth*.56,18,innerWidth-18),y=innerHeight*(.14+Math.random()*.48),dx=x-o.x,dy=y-o.y,ca=Math.cos(angleOffset),sa=Math.sin(angleOffset);
    return {x:o.x+dx*ca-dy*sa,y:o.y+dx*sa+dy*ca};
  }

  function hypeTier(){return state.hype>=95?4:state.hype>=75?3:state.hype>=50?2:state.hype>=25?1:0;}
  function beamCap(){return state.quality==="LOW"?22:state.quality==="MEDIUM"?28:36;}
  function impactCap(){return state.quality==="LOW"?10:state.quality==="MEDIUM"?14:20;}

  function pushBeam(b){
    const cap=beamCap();if(state.beams.length>=cap)state.beams.splice(0,state.beams.length-cap+1);state.beams.push(b);state.stats.visualBeams++;
  }
  function pushImpact(i){
    const cap=impactCap();if(state.impacts.length>=cap)state.impacts.splice(0,state.impacts.length-cap+1);state.impacts.push(i);
  }

  function scheduleOvercharge(){state.nextOverchargeAt=state.stats.physicalTaps+9+Math.floor(Math.random()*5);}
  function beamProfile(mode,tier,overcharge,hold){
    const pattern=PATTERNS[state.cycle%PATTERNS.length];
    const baseWidth=mode==="FOCUS"?1.8:2.25;
    const width=(baseWidth+tier*.48+(overcharge?2.4:0))*(hold?.86:1);
    const length=(30+tier*10+(overcharge?26:0))*(mode==="FOCUS"?1.05:1);
    const duration=(mode==="FOCUS"?.115:.145)*Math.max(.68,1-tier*.055)*(hold?1.24:1)*(overcharge?.82:1);
    return {pattern,width,length,duration,glow:overcharge?1.8:1+tier*.11};
  }

  function spawnBeam(mode,opts={}){
    const tier=opts.tier==null?hypeTier():opts.tier,overcharge=!!opts.overcharge,profile=beamProfile(mode,tier,overcharge,!!opts.hold),a=opts.origin||originFor(mode);
    let angle=Number(opts.angle)||0;
    if(profile.pattern==="SWEEP"&&tier>=2)angle+=((state.stats.physicalTaps%5)-2)*.018;
    const b=opts.target||targetFor(mode,angle);
    pushBeam({mode,a:{x:a.x,y:a.y},b,t:0,d:profile.duration,width:profile.width,length:profile.length,glow:profile.glow,tier,overcharge,hold:!!opts.hold,echo:!!opts.echo});
  }

  function startSurge(t){
    if(state.resetPending)return;state.surgeUntil=t+2600;state.resetPending=true;state.flash=Math.max(state.flash,.07);emit("beam_surge",{durationMs:2600});
    try{if(window.GameHaptics)window.GameHaptics.perform("HARD_TAP",.42);}catch(_){}
  }
  function partialReset(t){
    state.resetPending=false;state.hype=28;state.cycle=(state.cycle+1)%PATTERNS.length;state.resets++;state.tierSeen=1;state.tapTimes.length=0;state.flash=Math.max(state.flash,.035);scheduleOvercharge();
    emit("intensity_reset",{floor:28,resets:state.resets,nextPattern:PATTERNS[state.cycle]});
  }

  function registerTap(mode,t){
    state.stats.physicalTaps++;state.virtualPresses+=1;state.virtualShots+=1;state.tapTimes.push(t);while(state.tapTimes.length&&t-state.tapTimes[0]>1000)state.tapTimes.shift();
    const rate=state.tapTimes.length,alternating=state.lastMode&&state.lastMode!==mode&&t-state.lastTapAt<210;
    const gain=3.0+Math.min(4.8,rate*.34)+(alternating?.8:0);
    state.hype=clamp(state.hype+gain,0,100);state.peak=Math.max(state.peak,state.hype);state.lastTapAt=t;state.lastMode=mode;
    const tier=hypeTier();if(tier>state.tierSeen){state.tierSeen=tier;emit("beam_tier",{level:tier});if(tier>=3)state.flash=Math.max(state.flash,.025);}
    if(tier>=4&&!state.resetPending)startSurge(t);
  }

  function spawnTapVolley(mode){
    const tier=hypeTier(),pattern=PATTERNS[state.cycle%PATTERNS.length],overcharge=state.stats.physicalTaps>=state.nextOverchargeAt;
    if(overcharge){state.stats.overcharges++;scheduleOvercharge();}
    let count=tier>=4?3:tier>=3?2:1;
    if(state.quality==="LOW")count=Math.min(count,2);
    if(pattern==="TWIN"&&tier>=2&&state.stats.physicalTaps%3===0)count=Math.min(count+1,state.quality==="LOW"?2:3);
    for(let i=0;i<count;i++){
      const spread=count>1?(i-(count-1)/2)*.024:0;
      spawnBeam(mode,{tier,overcharge:overcharge&&i===0,angle:spread,echo:i>0});
    }
    if(pattern==="HEAVY"&&tier>=2&&state.stats.physicalTaps%6===0)spawnBeam(mode,{tier,overcharge:true,angle:(Math.random()-.5)*.025});
    if(overcharge){state.flash=Math.max(state.flash,.045);emit("beam_overcharge",{mode,count:state.stats.overcharges});try{if(window.GameHaptics)window.GameHaptics.perform("MEDIUM_TAP",.32);}catch(_){}}
  }

  function onPointerDown(e){
    if(!state.enabled||!e.isTrusted)return;installDiagnosticsBridge();const mode=modeAt(e.clientX),t=now();registerTap(mode,t);spawnTapVolley(mode);
    state.held.set(e.pointerId,{mode,startedAt:t,lastFireAt:t});
    const tier=hypeTier();try{if(window.GameHaptics)window.GameHaptics.perform(tier>=3?"MEDIUM_TAP":"SOFT_TAP",.12+.12*tier/4);}catch(_){}
    if(e.cancelable)try{e.preventDefault();}catch(_){}e.stopImmediatePropagation();e.stopPropagation();
  }
  function onPointerUp(e){state.held.delete(e.pointerId);}

  function updateHold(t){
    for(const h of state.held.values()){
      if(t-h.startedAt<300)continue;const cadence=360;if(t-h.lastFireAt<cadence)continue;h.lastFireAt=t;state.stats.holdShots++;state.virtualPresses+=.45;state.virtualShots+=.45;
      spawnBeam(h.mode,{hold:true,tier:Math.min(2,hypeTier())});
      if(state.stats.holdShots%5===0)try{if(window.GameHaptics)window.GameHaptics.perform("SOFT_TAP",.08);}catch(_){}
    }
  }

  function impactFor(b){
    const c=COLORS[b.mode];pushImpact({x:b.b.x,y:b.b.y,life:b.overcharge?.20:.11,max:b.overcharge?.20:.11,r:b.overcharge?12:5,color:c.beam,overcharge:b.overcharge});
  }

  function update(dt,t){
    const sec=dt/1000;
    if(t-state.lastTapAt>520&&!state.resetPending)state.hype=Math.max(0,state.hype-sec*8.2);
    if(state.resetPending&&t>=state.surgeUntil)partialReset(t);
    updateHold(t);
    for(let i=state.beams.length-1;i>=0;i--){const b=state.beams[i];b.t+=sec;if(b.t>=b.d){impactFor(b);state.beams.splice(i,1);}}
    for(let i=state.impacts.length-1;i>=0;i--){const p=state.impacts[i];p.life-=sec;if(p.life<=0)state.impacts.splice(i,1);}
    state.flash=Math.max(0,state.flash-sec*.45);
  }

  function sample(b){
    const q=clamp(b.t/b.d,0,1),e=1-Math.pow(1-q,2.7),x=b.a.x+(b.b.x-b.a.x)*e,y=b.a.y+(b.b.y-b.a.y)*e,dx=b.b.x-b.a.x,dy=b.b.y-b.a.y,len=Math.max(1,Math.hypot(dx,dy));
    return {x,y,ux:dx/len,uy:dy/len};
  }

  function drawBeam(c,b){
    const p=sample(b),col=COLORS[b.mode],fade=1-clamp((b.t/b.d-.78)/.22,0,1),tailX=p.x-p.ux*b.length,tailY=p.y-p.uy*b.length,headX=p.x+p.ux*3,headY=p.y+p.uy*3;
    c.save();c.lineCap="round";c.globalCompositeOperation="lighter";
    c.globalAlpha=.34*fade;c.strokeStyle=col.outer;c.lineWidth=b.width*4.2*b.glow;c.beginPath();c.moveTo(tailX,tailY);c.lineTo(headX,headY);c.stroke();
    c.globalAlpha=.88*fade;c.strokeStyle=col.beam;c.lineWidth=b.width*1.7;c.beginPath();c.moveTo(tailX,tailY);c.lineTo(headX,headY);c.stroke();
    c.globalAlpha=fade;c.strokeStyle=col.core;c.lineWidth=Math.max(1,b.width*.58);c.beginPath();c.moveTo(tailX+b.ux*7,tailY+b.uy*7);c.lineTo(headX,headY);c.stroke();
    if(b.overcharge&&state.quality!=="LOW"){c.globalAlpha=.30*fade;c.strokeStyle="#fff";c.lineWidth=b.width*5.8;c.beginPath();c.moveTo(tailX,tailY);c.lineTo(headX,headY);c.stroke();}
    c.restore();
  }

  function drawImpacts(c){
    for(const p of state.impacts){const a=clamp(p.life/p.max,0,1),q=1-a;c.save();c.globalCompositeOperation="lighter";c.globalAlpha=a*(p.overcharge?.72:.45);c.strokeStyle=p.color;c.lineWidth=p.overcharge?2.4:1.2;c.beginPath();c.arc(p.x,p.y,p.r+q*(p.overcharge?26:10),0,Math.PI*2);c.stroke();c.globalAlpha=a;c.fillStyle="#fff";c.beginPath();c.arc(p.x,p.y,p.overcharge?3.5:1.8,0,Math.PI*2);c.fill();c.restore();}
  }

  function render(){
    const c=state.ctx;if(!c)return;c.clearRect(0,0,innerWidth,innerHeight);for(const b of state.beams)drawBeam(c,b);drawImpacts(c);
    if(state.flash>0){c.save();c.globalAlpha=state.flash;c.fillStyle="#fff";c.fillRect(0,0,innerWidth,innerHeight);c.restore();}
  }

  function loop(t){
    hideLegacyUi();installDiagnosticsBridge();const dt=Math.min(50,t-state.lastFrame||16.7);state.lastFrame=t;state.frameMs=state.frameMs*.90+dt*.10;state.quality=state.frameMs>28?"LOW":state.frameMs>21?"MEDIUM":"FULL";
    const cap=beamCap();if(state.beams.length>cap)state.beams.splice(0,state.beams.length-cap);update(dt,t);render();requestAnimationFrame(loop);
  }

  function init(){
    if(state.ready)return;state.ready=true;installDiagnosticsBridge();
    document.addEventListener("pointerdown",onPointerDown,true);document.addEventListener("pointerup",onPointerUp,true);document.addEventListener("pointercancel",onPointerUp,true);
    const observer=new MutationObserver(()=>{hideLegacyUi();if(document.getElementById("dual-trigger-v30-overlay")&&!state.canvas)requestAnimationFrame(ensureCanvas);});observer.observe(document.documentElement,{childList:true,subtree:true});
    hideLegacyUi();setTimeout(ensureCanvas,900);requestAnimationFrame(loop);emit("pure_beam_ready",{hiddenUi:true,partialReset:true,patterns:PATTERNS.slice()});
  }

  const api={
    version:VERSION,previousVersion:PREVIOUS_VERSION,
    diagnostics:()=>({version:VERSION,hype:Math.round(state.hype),peak:Math.round(state.peak),tier:hypeTier(),cycle:state.cycle,pattern:PATTERNS[state.cycle%PATTERNS.length],resets:state.resets,quality:state.quality,held:state.held.size,activeBeams:state.beams.length,...state.stats}),
    setEnabled:v=>(state.enabled=!!v),setHype:v=>(state.hype=clamp(Number(v)||0,0,100)),
    forceSurge:()=>{state.hype=100;startSurge(now());},forceReset:()=>partialReset(now()),
    forceHero:(mode="FOCUS")=>spawnBeam(mode==="BURST"?"BURST":"FOCUS",{tier:4,overcharge:true}),
    forceCombo:()=>{spawnBeam("FOCUS",{tier:4,overcharge:true,angle:-.02});spawnBeam("BURST",{tier:4,overcharge:true,angle:.02});}
  };
  window.PureBeamV306=api;window.ImpactPassV305=api;window.TapRushV304=api;window.ExcitementPetV303=api;window.ExcitementPetV302=api;init();
})();