(() => {
  "use strict";

  const VERSION="SCENE_MOTION_V30_7";
  const CHOREOS=["FAN","CROSS","CONVERGE","SWEEP"];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>performance.now();

  const state={
    ready:false,canvas:null,ctx:null,lastFrame:now(),frameMs:16.7,quality:"FULL",
    tapTimes:[],lastTapAt:0,lastMode:"FOCUS",tier:0,cycle:0,surgeUntil:0,
    kickX:0,kickY:0,kickRot:0,kickScale:0,recoil:0,energy:0,
    pendingHits:[],choreos:[],rareNextAt:0,rare:null,sceneFlash:0,
    stats:{cameraKicks:0,hitReactions:0,choreos:0,rareEvents:0}
  };

  function emit(type,payload){
    const detail={type,at:Date.now(),version:VERSION,tier:state.tier,cycle:state.cycle,...(payload||{})};
    try{window.dispatchEvent(new CustomEvent("crew:game-event",{detail}));}catch(_){}
    try{window.AndroidGame&&AndroidGame.onGameEvent&&AndroidGame.onGameEvent(JSON.stringify(detail));}catch(_){}
  }

  function modeAt(x){return x<innerWidth*.5?"FOCUS":"BURST";}
  function updateTapRate(t){state.tapTimes.push(t);while(state.tapTimes.length&&t-state.tapTimes[0]>1000)state.tapTimes.shift();}
  function diag(){try{return window.PureBeamV306&&window.PureBeamV306.diagnostics?window.PureBeamV306.diagnostics():null;}catch(_){return null;}}
  function syncDiag(){const d=diag();if(!d)return;state.tier=clamp(Number(d.tier)||0,0,4);state.cycle=Number(d.cycle)||0;}

  function ensureCanvas(){
    if(state.canvas)return;const c=document.createElement("canvas");c.id="scene-motion-v30-7-overlay";
    c.style.cssText="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:27;";document.body.appendChild(c);
    state.canvas=c;state.ctx=c.getContext("2d",{alpha:true});resize();addEventListener("resize",resize,{passive:true});
  }
  function resize(){if(!state.canvas)return;const dpr=Math.min(devicePixelRatio||1,1.12);state.canvas.width=Math.max(1,Math.floor(innerWidth*dpr));state.canvas.height=Math.max(1,Math.floor(innerHeight*dpr));state.ctx.setTransform(dpr,0,0,dpr,0,0);}

  function sceneCanvases(){return [...document.querySelectorAll("canvas")].filter(c=>c!==state.canvas);}
  function applyCamera(t){
    const recent=t-state.lastTapAt<260,rate=state.tapTimes.length,surge=t<state.surgeUntil;
    const targetEnergy=(state.tier*.18)+(Math.min(12,rate)/12)*.42+(surge?.36:0);
    state.energy+=(targetEnergy-state.energy)*.085;
    state.kickX*=.78;state.kickY*=.78;state.kickRot*=.76;state.kickScale*=.80;state.recoil*=.74;
    const breathe=Math.sin(t*.008)*.18*state.energy;
    const tx=state.kickX+(recent?(Math.sin(t*.021)*.7*state.energy):0),ty=state.kickY-state.recoil*.34;
    const scale=1+state.energy*.018+state.kickScale+state.recoil*.0018;
    const rot=state.kickRot+breathe*.18;
    for(const c of sceneCanvases()){
      try{c.style.transformOrigin="50% 55%";c.style.translate=`${tx.toFixed(2)}px ${ty.toFixed(2)}px`;c.style.scale=scale.toFixed(4);c.style.rotate=`${rot.toFixed(3)}deg`;}catch(_){}
    }
  }

  function cameraKick(mode,power){
    const side=mode==="FOCUS"?-1:1,p=clamp(power,0,2);state.kickX+=side*(1.2+1.6*p);state.kickY-=.6+1.1*p;state.kickRot+=side*.10*p;state.kickScale+=.002+.0028*p;state.stats.cameraKicks++;
  }
  function queueHit(t,mode){
    state.pendingHits.push({at:t+92+Math.random()*58,mode,tier:state.tier});if(state.pendingHits.length>14)state.pendingHits.shift();
  }
  function hitReaction(h){
    const p=.6+h.tier*.28;state.recoil=Math.max(state.recoil,1.8+h.tier*1.1);state.kickY+=.6+h.tier*.35;state.kickScale+=.0015+h.tier*.0011;state.sceneFlash=Math.max(state.sceneFlash,h.tier>=3?.028:.012);state.stats.hitReactions++;cameraKick(h.mode,p*.35);
  }

  function choreoName(){
    const d=diag(),pattern=d&&d.pattern;if(pattern==="TWIN")return "CROSS";if(pattern==="SWEEP")return "SWEEP";if(pattern==="HEAVY")return "CONVERGE";return CHOREOS[state.cycle%CHOREOS.length];
  }
  function spawnChoreo(mode,force){
    if(state.quality==="LOW"&&!force)return;const name=choreoName(),tier=state.tier,n=force?8:Math.min(6,2+tier),lines=[];
    const bottom=innerHeight+12,cx=innerWidth*.5,cy=innerHeight*(.28+Math.random()*.16),left=mode==="FOCUS";
    for(let i=0;i<n;i++){
      let sx,sy=bottom,tx,ty,delay=i*.035;
      if(name==="CROSS"){sx=left?innerWidth*(.12+i*.035):innerWidth*(.88-i*.035);tx=left?innerWidth*(.78-i*.04):innerWidth*(.22+i*.04);ty=innerHeight*(.16+i*.045);}
      else if(name==="CONVERGE"){sx=innerWidth*(.08+(i/Math.max(1,n-1))*.84);tx=cx+(Math.random()-.5)*34;ty=cy+(Math.random()-.5)*26;}
      else if(name==="SWEEP"){sx=innerWidth*(left?.18:.82);tx=innerWidth*(.08+(i/Math.max(1,n-1))*.84);ty=innerHeight*(.16+.055*i);delay=i*.055;}
      else{sx=innerWidth*(left?.34:.66)+(i-(n-1)/2)*8;tx=clamp(cx+(i-(n-1)/2)*innerWidth*.10,10,innerWidth-10);ty=innerHeight*(.12+.045*i);}
      lines.push({sx,sy,tx,ty,delay,width:.8+tier*.15+(i%3===0?.45:0)});
    }
    state.choreos.push({name,mode,life:force?.42:.28,max:force?.42:.28,lines});if(state.choreos.length>6)state.choreos.shift();state.stats.choreos++;
  }

  function scheduleRare(){state.rareNextAt=now()+20000+Math.random()*20000;}
  function startRare(t){
    const types=["BLACKOUT_BARRAGE","CROSS_STORM","FOCUS_LOCK"],type=types[state.stats.rareEvents%types.length];state.rare={type,startedAt:t,until:t+(type==="BLACKOUT_BARRAGE"?1250:1500)};state.stats.rareEvents++;state.sceneFlash=.04;cameraKick(state.lastMode,1.5);spawnChoreo(state.lastMode,true);emit("scene_event",{event:type,durationMs:state.rare.until-t});scheduleRare();
  }

  function onPointerDown(e){
    if(!e.isTrusted)return;const t=now(),mode=modeAt(e.clientX);state.lastTapAt=t;state.lastMode=mode;updateTapRate(t);syncDiag();
    cameraKick(mode,.35+state.tier*.18);queueHit(t,mode);
    const rate=state.tapTimes.length;if(state.tier>=2&&((rate>=8&&Math.random()<.38)||(state.tier>=3&&Math.random()<.24)))spawnChoreo(mode,false);
  }
  function onGameEvent(e){
    const d=e&&e.detail;if(!d||d.version===VERSION)return;
    if(d.type==="beam_tier")state.tier=clamp(Number(d.level)||0,0,4);
    if(d.type==="beam_surge"){state.surgeUntil=now()+Math.max(900,Number(d.durationMs)||2600);state.sceneFlash=.055;spawnChoreo(state.lastMode,true);cameraKick(state.lastMode,1.6);}
    if(d.type==="beam_overcharge"){state.sceneFlash=.045;cameraKick(state.lastMode,1.15);spawnChoreo(state.lastMode,true);}
    if(d.type==="intensity_reset"){state.cycle=(state.cycle+1)%CHOREOS.length;state.energy*=.62;state.kickScale-=.006;}
  }

  function drawBackgroundMotion(c,t){
    if(state.tier<=0&&state.energy<.08)return;const surge=t<state.surgeUntil,rate=state.tapTimes.length,count=state.quality==="LOW"?6:state.quality==="MEDIUM"?10:14+state.tier*2,cx=innerWidth*.5,cy=innerHeight*.43;
    c.save();c.globalCompositeOperation="lighter";c.lineCap="round";
    for(let i=0;i<count;i++){
      const phase=(t*.00045*(1+state.tier*.18)+i/count)%1,ang=i/count*Math.PI*2+Math.sin(t*.0007+i)*.08,r0=20+phase*Math.min(innerWidth,innerHeight)*.24,r1=r0+18+state.tier*7+(surge?16:0),x0=cx+Math.cos(ang)*r0,y0=cy+Math.sin(ang)*r0,x1=cx+Math.cos(ang)*r1,y1=cy+Math.sin(ang)*r1;
      c.globalAlpha=(.025+state.tier*.009+(rate>=8?.018:0))*(1-phase);c.strokeStyle=i%3===0?"#ffffff":state.lastMode==="FOCUS"?"#8fe8ff":"#ffd08d";c.lineWidth=i%4===0?1.2:.7;c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();
    }
    c.restore();
  }
  function drawChoreos(c){
    for(const g of state.choreos){const q=1-g.life/g.max,col=g.mode==="FOCUS"?"#9beaff":"#ffd28f";c.save();c.globalCompositeOperation="lighter";c.lineCap="round";
      for(const l of g.lines){const p=clamp((q-l.delay)/Math.max(.01,1-l.delay),0,1);if(p<=0)continue;const e=1-Math.pow(1-p,2.4),hx=l.sx+(l.tx-l.sx)*e,hy=l.sy+(l.ty-l.sy)*e,dx=l.tx-l.sx,dy=l.ty-l.sy,len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len,uy=dy/len,tail=28+state.tier*9,tx=hx-ux*tail,ty=hy-uy*tail,fade=1-clamp((p-.70)/.30,0,1);c.globalAlpha=.13*fade;c.strokeStyle=col;c.lineWidth=l.width;c.beginPath();c.moveTo(tx,ty);c.lineTo(hx,hy);c.stroke();}
      c.restore();}
  }
  function drawRare(c,t){
    if(!state.rare)return;const r=state.rare,dur=Math.max(1,r.until-r.startedAt),q=clamp((t-r.startedAt)/dur,0,1);c.save();
    if(r.type==="BLACKOUT_BARRAGE"){c.globalAlpha=q<.10?.24:(1-q)*.11;c.fillStyle="#02030a";c.fillRect(0,0,innerWidth,innerHeight);}
    else if(r.type==="FOCUS_LOCK"){const g=c.createRadialGradient(innerWidth*.5,innerHeight*.38,20,innerWidth*.5,innerHeight*.38,Math.max(innerWidth,innerHeight)*.55);g.addColorStop(0,"rgba(255,255,255,0)");g.addColorStop(1,`rgba(0,0,0,${.16*(1-q)})`);c.fillStyle=g;c.fillRect(0,0,innerWidth,innerHeight);}
    else{c.globalAlpha=.045*(1-q);c.fillStyle="#fff";c.fillRect(0,0,innerWidth,innerHeight);}
    c.restore();
  }
  function drawVignette(c){
    if(state.energy<.12)return;const a=.025+state.energy*.045,g=c.createRadialGradient(innerWidth*.5,innerHeight*.45,Math.min(innerWidth,innerHeight)*.22,innerWidth*.5,innerHeight*.45,Math.max(innerWidth,innerHeight)*.72);g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,`rgba(0,0,0,${a})`);c.save();c.fillStyle=g;c.fillRect(0,0,innerWidth,innerHeight);c.restore();
  }

  function update(dt,t){
    const sec=dt/1000;syncDiag();while(state.pendingHits.length&&state.pendingHits[0].at<=t)hitReaction(state.pendingHits.shift());
    for(let i=state.choreos.length-1;i>=0;i--){state.choreos[i].life-=sec;if(state.choreos[i].life<=0)state.choreos.splice(i,1);}
    if(state.rare&&t>=state.rare.until)state.rare=null;
    if(!state.rare&&t>=state.rareNextAt){if(state.tier>=2&&t-state.lastTapAt<320&&state.quality!=="LOW")startRare(t);else state.rareNextAt=t+3000;}
    state.sceneFlash=Math.max(0,state.sceneFlash-sec*.32);applyCamera(t);
  }
  function render(t){
    const c=state.ctx;if(!c)return;c.clearRect(0,0,innerWidth,innerHeight);drawBackgroundMotion(c,t);drawChoreos(c);drawRare(c,t);drawVignette(c);if(state.sceneFlash>0){c.save();c.globalAlpha=state.sceneFlash;c.fillStyle="#fff";c.fillRect(0,0,innerWidth,innerHeight);c.restore();}
  }
  function loop(t){const dt=Math.min(50,t-state.lastFrame||16.7);state.lastFrame=t;state.frameMs=state.frameMs*.90+dt*.10;state.quality=state.frameMs>29?"LOW":state.frameMs>22?"MEDIUM":"FULL";update(dt,t);render(t);requestAnimationFrame(loop);}

  function init(){
    if(state.ready)return;state.ready=true;ensureCanvas();scheduleRare();document.addEventListener("pointerdown",onPointerDown,true);window.addEventListener("crew:game-event",onGameEvent);requestAnimationFrame(loop);emit("scene_motion_ready",{camera:true,choreography:true,hitReaction:true,rareScene:true});
  }

  const api={version:VERSION,diagnostics:()=>({version:VERSION,quality:state.quality,tier:state.tier,cycle:state.cycle,tapRate:state.tapTimes.length,energy:Number(state.energy.toFixed(2)),surge:now()<state.surgeUntil,rare:state.rare&&state.rare.type,...state.stats}),forceScene:()=>{syncDiag();startRare(now());},forceChoreo:(mode="FOCUS")=>spawnChoreo(mode==="BURST"?"BURST":"FOCUS",true)};
  window.SceneMotionV307=api;init();
})();
