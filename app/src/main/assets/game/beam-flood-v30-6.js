(() => {
  "use strict";

  const VERSION="DENSE_BEAM_FLOOD_V30_6";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>performance.now();
  const PALETTE={
    FOCUS:{beam:"#8fe8ff",core:"#ffffff",outer:"rgba(118,222,255,.26)"},
    BURST:{beam:"#ffd08d",core:"#ffffff",outer:"rgba(255,190,112,.26)"}
  };

  const state={
    ready:false,canvas:null,ctx:null,lastFrame:now(),frameMs:16.7,quality:"FULL",
    groups:[],tapTimes:[],lastTapAt:0,lastMode:"FOCUS",surgeUntil:0,lastSurgeVisualAt:0,
    stats:{tapBursts:0,surgeBursts:0,drawnStreaks:0,objectRareSpawns:0}
  };

  function emit(type,payload){
    const detail={type,at:Date.now(),version:VERSION,...(payload||{})};
    try{window.dispatchEvent(new CustomEvent("crew:game-event",{detail}));}catch(_){}
    try{window.AndroidGame&&AndroidGame.onGameEvent&&AndroidGame.onGameEvent(JSON.stringify(detail));}catch(_){}
  }

  function modeAt(x){return x<innerWidth*.5?"FOCUS":"BURST";}
  function groupCap(){return state.quality==="LOW"?5:state.quality==="MEDIUM"?7:10;}
  function streakCap(){return state.quality==="LOW"?10:state.quality==="MEDIUM"?16:26;}
  function sourceX(mode){return innerWidth*(mode==="FOCUS"?.34:.66);}

  function effectiveTier(){
    try{const d=window.PureBeamV306&&window.PureBeamV306.diagnostics?window.PureBeamV306.diagnostics():null;if(d&&Number.isFinite(d.tier))return clamp(d.tier,0,4);}catch(_){}
    const r=state.tapTimes.length;return r>=11?4:r>=8?3:r>=5?2:r>=3?1:0;
  }

  function updateTapRate(t){
    state.tapTimes.push(t);while(state.tapTimes.length&&t-state.tapTimes[0]>1000)state.tapTimes.shift();
  }

  function createFlood(mode,tier,opts={}){
    const surge=!!opts.surge,rate=state.tapTimes.length,base=[3,6,10,15,22][clamp(tier,0,4)];
    let count=base+(rate>=7?3:0)+(rate>=11?4:0)+(surge?5:0);count=Math.min(streakCap(),count);
    const originSpread=tier>=4?innerWidth*.20:tier>=3?innerWidth*.14:tier>=2?innerWidth*.09:innerWidth*.045;
    const baseX=sourceX(mode),baseY=innerHeight-Math.max(18,innerHeight*.025),streaks=[];
    for(let i=0;i<count;i++){
      const sx=clamp(baseX+(Math.random()-.5)*originSpread,8,innerWidth-8),sy=baseY+Math.random()*10;
      const tx=clamp(innerWidth*(.08+Math.random()*.84)+(mode==="FOCUS"?-10:10),8,innerWidth-8),ty=innerHeight*(.07+Math.random()*.53);
      streaks.push({sx,sy,tx,ty,delay:Math.random()*.18,width:.75+Math.random()*.75+tier*.08,length:26+tier*8+Math.random()*26,bright:i%4===0});
    }
    const life=surge?.18:.13+tier*.008;
    state.groups.push({mode,tier,life,max:life,streaks});if(state.groups.length>groupCap())state.groups.splice(0,state.groups.length-groupCap());
    state.stats.drawnStreaks+=count;if(opts.auto)state.stats.surgeBursts++;else state.stats.tapBursts++;
  }

  function onPointerDown(e){
    if(!e.isTrusted)return;const t=now(),mode=modeAt(e.clientX);updateTapRate(t);state.lastTapAt=t;state.lastMode=mode;
    createFlood(mode,effectiveTier(),{surge:t<state.surgeUntil});
  }

  function onGameEvent(e){
    const d=e&&e.detail;if(!d||d.version===VERSION)return;
    if(d.type==="beam_surge")state.surgeUntil=now()+Math.max(800,Number(d.durationMs)||2600);
    if(d.type==="beam_overcharge")createFlood(state.lastMode,4,{surge:true,auto:true});
    if(d.type==="intensity_reset"){
      try{window.PureBeamV306&&window.PureBeamV306.setHype&&window.PureBeamV306.setHype(42);}catch(_){}
      state.tapTimes.length=0;emit("dense_reset_floor",{floor:42});
    }
  }

  function ensureCanvas(){
    if(state.canvas)return;const c=document.createElement("canvas");c.id="dense-beam-flood-v30-6-overlay";
    c.style.cssText="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:29;";document.body.appendChild(c);
    state.canvas=c;state.ctx=c.getContext("2d",{alpha:true});resize();addEventListener("resize",resize,{passive:true});
  }
  function resize(){if(!state.canvas)return;const dpr=Math.min(devicePixelRatio||1,1.15);state.canvas.width=Math.max(1,Math.floor(innerWidth*dpr));state.canvas.height=Math.max(1,Math.floor(innerHeight*dpr));state.ctx.setTransform(dpr,0,0,dpr,0,0);}

  function drawGroup(c,g){
    const q=1-g.life/g.max,col=PALETTE[g.mode];c.save();c.lineCap="round";c.globalCompositeOperation="lighter";
    for(let i=0;i<g.streaks.length;i++){
      const s=g.streaks[i],p=clamp((q-s.delay)/Math.max(.01,1-s.delay),0,1);if(p<=0)continue;
      const e=1-Math.pow(1-p,2.6),dx=s.tx-s.sx,dy=s.ty-s.sy,len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len,uy=dy/len;
      const hx=s.sx+dx*e,hy=s.sy+dy*e,tail=Math.min(s.length,len*e),tx=hx-ux*tail,ty=hy-uy*tail,fade=1-clamp((p-.72)/.28,0,1);
      c.globalAlpha=(s.bright?.30:.20)*fade;c.strokeStyle=s.bright?col.core:col.beam;c.lineWidth=s.width*(s.bright?1.25:1);c.beginPath();c.moveTo(tx,ty);c.lineTo(hx,hy);c.stroke();
      if(s.bright&&state.quality!=="LOW"){c.globalAlpha=.10*fade;c.strokeStyle=col.outer;c.lineWidth=s.width*3.4;c.beginPath();c.moveTo(tx,ty);c.lineTo(hx,hy);c.stroke();}
    }
    c.restore();
  }

  function update(dt,t){
    const sec=dt/1000;for(let i=state.groups.length-1;i>=0;i--){state.groups[i].life-=sec;if(state.groups[i].life<=0)state.groups.splice(i,1);}
    if(t<state.surgeUntil&&t-state.lastTapAt<220&&t-state.lastSurgeVisualAt>(state.quality==="LOW"?145:95)){
      state.lastSurgeVisualAt=t;createFlood(state.lastMode,4,{surge:true,auto:true});
    }
  }
  function render(){const c=state.ctx;if(!c)return;c.clearRect(0,0,innerWidth,innerHeight);for(const g of state.groups)drawGroup(c,g);}
  function loop(t){const dt=Math.min(50,t-state.lastFrame||16.7);state.lastFrame=t;state.frameMs=state.frameMs*.9+dt*.1;state.quality=state.frameMs>28?"LOW":state.frameMs>21?"MEDIUM":"FULL";update(dt,t);render();requestAnimationFrame(loop);}

  function patchToyObjects(){
    try{if(Array.isArray(window.ToyObjectSpecs))for(const s of window.ToyObjectSpecs)s.active=false;}catch(_){}
    const Klass=window.ToyObjectRuntime;if(!Klass||!Klass.prototype||Klass.prototype.__rareOnlyPatched)return;
    const p=Klass.prototype,originalTick=p.tick;
    const schedule=rt=>{rt.__rareNextAt=now()+8000+rt.rng()*12000;};
    const hide=rt=>{for(const o of rt.objects||[]){o.visibleActive=false;o.everUnlocked=false;o.transientUntil=0;o.respawnAt=0;o.popUntil=0;if(o.container)o.container.visible=false;}};
    const show=(rt,o,near,source)=>{
      if(!o)return false;for(const x of rt.objects||[]){if(x!==o){x.visibleActive=false;x.transientUntil=0;x.respawnAt=0;if(x.container)x.container.visible=false;}}
      o.visibleActive=true;o.everUnlocked=true;o.transientUntil=now()+3200+rt.rng()*2200;o.respawnAt=0;o.popUntil=0;o.pulse=1;if(o.container)o.container.visible=true;
      if(near&&Number.isFinite(near.x)&&Number.isFinite(near.y)){o.x=near.x+(rt.rng()-.5)*70;o.y=near.y+(rt.rng()-.5)*60;if(o.container&&o.container.position)o.container.position.set(o.x,o.y);}
      try{rt._emit({type:"OBJECT_RARE",objectType:o.type,id:o.id,x:o.x,y:o.y,power:.8,source});}catch(_){}state.stats.objectRareSpawns++;return true;
    };
    p.reset=function(){this.hitCount=0;hide(this);schedule(this);try{this.resize();}catch(_){}};
    p.unlockForHits=function(hits){this.hitCount=Math.max(this.hitCount,Number(hits)||0);};
    p.activateType=function(type,near){
      if((this.objects||[]).some(o=>o.visibleActive))return false;if(this.rng()>.28){schedule(this);return false;}
      const t=String(type||"").toUpperCase(),o=(this.objects||[]).find(x=>x.type===t)||null;const ok=show(this,o,near,"WORLD");if(ok)schedule(this);return ok;
    };
    p.tick=function(deltaMS,pets){
      const t=now();if(!this.__rareNextAt)schedule(this);
      for(const o of this.objects||[]){if(o.visibleActive&&o.transientUntil&&t>=o.transientUntil){o.visibleActive=false;o.transientUntil=0;o.respawnAt=0;if(o.container)o.container.visible=false;}if(!o.visibleActive)o.respawnAt=0;}
      const any=(this.objects||[]).some(o=>o.visibleActive);if(!any&&t>=this.__rareNextAt){schedule(this);if(this.rng()<.45){const list=this.objects||[],o=list.length?list[Math.floor(this.rng()*list.length)]:null;show(this,o,null,"RANDOM");}}
      const out=originalTick.call(this,deltaMS,pets);for(const o of this.objects||[]){if(!o.visibleActive)o.respawnAt=0;}return out;
    };
    p.__rareOnlyPatched=true;
  }

  function init(){
    if(state.ready)return;state.ready=true;patchToyObjects();ensureCanvas();
    document.addEventListener("pointerdown",onPointerDown,true);window.addEventListener("crew:game-event",onGameEvent);requestAnimationFrame(loop);
    emit("dense_beam_ready",{decorativeFlood:true,rareObjects:true,resetFloor:42});
  }

  const api={version:VERSION,diagnostics:()=>({version:VERSION,quality:state.quality,groups:state.groups.length,tapRate:state.tapTimes.length,surge:now()<state.surgeUntil,...state.stats}),forceFlood:(mode="FOCUS")=>createFlood(mode==="BURST"?"BURST":"FOCUS",4,{surge:true})};
  window.DenseBeamFloodV306=api;init();
})();