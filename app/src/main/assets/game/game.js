(() => {
  "use strict";

  const A=window.AndroidGame;
  const DEBUG=!!window.__INFINITE_CLICK_DEBUG__;
  const state={
    app:null,gameplay:null,bg:null,world:null,target:null,targetCore:null,targetLabel:null,
    pools:null,ripples:[],decoys:[],fx:null,audio:null,primitiveHost:null,signatureMoments:null,runtime:null,aggregator:null,
    safe:{left:0,top:0,right:0,bottom:0},language:"zh-TW",lastInputAt:performance.now(),idleStage:0,
    nextTurnId:1,stateVersion:1,pendingGameTurnId:0,pendingGameEvent:null,geminiPending:false,
    frame:{fps:60,lastMs:performance.now(),accMs:0,frames:0,lastLog:0}
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hex=v=>typeof v==="number"?v:Number.parseInt(String(v||"#ffffff").replace("#",""),16)||0xffffff;
  const screen=()=>state.app.renderer.screen;
  const norm=(x,y)=>{const s=screen();return{x:clamp(x/Math.max(1,s.width),0,1),y:clamp(y/Math.max(1,s.height),0,1)};};

  async function boot(){
    const app=new PIXI.Application();
    await app.init({
      resizeTo:window,background:0x05070d,antialias:true,
      resolution:Math.min(window.devicePixelRatio||1,1.5),autoDensity:true,powerPreference:"high-performance"
    });
    state.app=app;document.body.appendChild(app.canvas);buildScene();wireRuntime();wireInput();
    app.ticker.add(tick);
    if(DEBUG)window.PixiGameDebug={app,canvas:app.canvas,runtime:()=>state.runtime,signature:()=>state.signatureMoments,diagnostics};
    try{A&&A.onRendererReady("PIXI_RUNTIME_V2");}catch(_){}
  }

  function buildScene(){
    const app=state.app,s=screen();
    state.gameplay=new PIXI.Container();state.gameplay.label="gameplay-root";app.stage.addChild(state.gameplay);
    state.bg=new PIXI.Graphics();state.gameplay.addChild(state.bg);
    state.pools={
      particles:new ParticlePool(120),
      ripples:new RipplePool(12),
      decoys:new DecoyPool(30)
    };
    state.fx=new WorldFxController(app,{particlePool:state.pools.particles,parent:state.gameplay});
    state.world=new PIXI.Container();state.world.label="world";state.gameplay.addChild(state.world);
    // Keep transient foreground over the main target.
    if(state.fx.foreground)state.gameplay.addChild(state.fx.foreground);
    createTarget();
    resizeScene();
    window.addEventListener("resize",resizeScene);
  }

  function createTarget(){
    const s=screen(),c=new PIXI.Container(),core=new PIXI.Graphics();
    core.circle(0,0,31).fill({color:0xff416c,alpha:.96});
    core.circle(0,0,42).stroke({color:0xffffff,width:2,alpha:.16});
    const label=new PIXI.Text({text:"TOUCH",style:{fill:0xffffff,fontFamily:"sans-serif",fontSize:15,fontWeight:"700",letterSpacing:2}});
    label.anchor.set(.5);label.y=58;c.addChild(core,label);c.x=s.width*.5;c.y=s.height*.52;
    state.world.addChild(c);state.target=c;state.targetCore=core;state.targetLabel=label;
  }

  function wireRuntime(){
    state.audio=new AudioMoodPlayer();
    state.primitiveHost=new PrimitiveHostRuntime({
      gameplayContainer:state.world,getPrimaryTarget:()=>state.target,onGameEvent:handleSemanticEvent,
      onSurfaceMode:mode=>{if(state.targetCore)state.targetCore.alpha=mode==="NONE"?.96:.82;}
    });
    state.signatureMoments=new SignatureMomentRuntime({
      app:state.app,gameplayContainer:state.gameplay,haptics:window.GameHaptics,
      onGameEvent:handleSignatureEvent,onSpeechRequest:sendSignatureSpeech
    });
    state.runtime=new ExperienceRuntime({
      fx:state.fx,audio:state.audio,haptics:window.GameHaptics,signatureMoments:state.signatureMoments,
      getPrimaryTarget:()=>state.target,
      onPrimitiveInteraction:m=>state.primitiveHost.setInteraction(m),
      onPrimitiveSpatial:m=>state.primitiveHost.setSpatial(m),
      onPrimitiveCamera:m=>state.primitiveHost.setCamera(m),
      onPrimitiveSurface:m=>state.primitiveHost.setSurface(m),
      onPrimitiveTiming:m=>state.primitiveHost.setTiming(m),
      onRuleTwist:(rule,plan)=>applyValidatedPlanToTarget(plan,rule),
      onInteractionDirective:(directive,context)=>routeDirective(directive,context)
    });
    state.aggregator=new GeminiEventAggregator({windowMs:500,onFlush:sendDirectiveToNative});
    state.runtime.startSession("NEON_RIFT");
    state.runtime.fallback({type:"SESSION_START"});
    renderBackground();
    const event={type:"SESSION_START",special:true};
    const context=state.runtime.aiContext(event,diagnostics());
    const directive={mode:"GAME_TURN",reason:"session_start",delivery:"TEASE",instruction:"Open with one short in-character line, then choose the first high-level experience intent."};
    state.aggregator.push(event,directive,context,{immediate:true});
  }

  function wireInput(){
    const stage=state.app.stage;stage.eventMode="static";stage.hitArea=screen();
    stage.on("pointerdown",e=>{
      if(state.signatureMoments.isActive())return;
      state.lastInputAt=performance.now();state.idleStage=0;
      const p=e.global,n=norm(p.x,p.y);localTouchFeedback(n.x,n.y);
      state.primitiveHost.pointerDown(p.x,p.y);
    });
    stage.on("pointermove",e=>{if(!state.signatureMoments.isActive()){const p=e.global;state.primitiveHost.pointerMove(p.x,p.y);}});
    stage.on("pointerup",e=>{if(!state.signatureMoments.isActive()){const p=e.global;state.primitiveHost.pointerUp(p.x,p.y);}});
    stage.on("pointerupoutside",e=>{if(!state.signatureMoments.isActive()){const p=e.global;state.primitiveHost.pointerUp(p.x,p.y);}});
  }

  function localTouchFeedback(x,y){
    const pool=state.pools.ripples,g=pool.acquire(state.gameplay);if(g){
      const s=screen();g.circle(0,0,11).stroke({color:state.runtime&&state.runtime.currentPlan?hex((GameWorldCatalog.WORLDS[state.runtime.currentPlan.world]||{}).accent):0xffffff,width:2,alpha:.55});
      g.x=x*s.width;g.y=y*s.height;state.ripples.push({g,life:.34,max:.34});
    }
    const density=state.runtime&&state.runtime.currentSensoryState?Number(state.runtime.currentSensoryState.density)||0:0;
    if(density>0&&window.GameHaptics)window.GameHaptics.perform("SOFT_TAP",density===1?.12:.2);
  }

  function handleSemanticEvent(raw){
    if(state.signatureMoments.isActive())return;
    const e=normalizeEvent(raw);
    state.lastInputAt=performance.now();state.idleStage=0;
    state.runtime.onPlayerEvent(e);
  }

  function handleSignatureEvent(raw){
    const e=normalizeEvent(raw);
    if(e.type==="SIGNATURE_START"){
      invalidatePendingTurn("signature_start");
    }
    // Signature runtime owns visuals; only semantic/conversation routing is allowed here.
    if(["WAIT_BROKEN","WAIT_SUCCESS","HOLD_START","HOLD_COMPLETE","RELEASE_EARLY","TAP"].includes(e.type)){
      const d=state.runtime.conversation.routePlayerEvent(e,{shouldRequestNewSituation:false,currentPlan:state.runtime.currentPlan,sensory:state.runtime.currentSensoryState});
      const c=state.runtime.aiContext(e,{signatureActive:true});c.interaction=d;c.conversation=state.runtime.conversation.contextForAi(d,e);
      routeDirective(d,c);
    }
    if(e.type==="SIGNATURE_COMPLETE"){
      state.stateVersion++;
      try{A&&A.onRuntimeSignal(JSON.stringify({type:"SIGNATURE_COMPLETE",signature:e.signature||"",stateVersion:state.stateVersion}));}catch(_){}
    }
  }

  function normalizeEvent(raw){
    const e=Object.assign({},raw||{}),s=screen();e.type=String(e.type||"").toUpperCase();
    if(Number.isFinite(e.x)&&Math.abs(e.x)>1)e.x=clamp(e.x/Math.max(1,s.width),0,1);
    if(Number.isFinite(e.y)&&Math.abs(e.y)>1)e.y=clamp(e.y/Math.max(1,s.height),0,1);
    return e;
  }

  function routeDirective(directive,context){
    if(!directive||directive.mode==="SILENT")return;
    const event=directive.event||(context&&context.event)||{};
    state.aggregator.push(event,directive,context);
  }

  function sendDirectiveToNative(payload){
    if(!payload||payload.mode==="SILENT")return;
    const turnId=state.nextTurnId++;
    payload.turnId=turnId;payload.baseStateVersion=state.stateVersion;payload.context=payload.context||{};
    payload.context.turnId=turnId;payload.context.baseStateVersion=state.stateVersion;payload.context.behavior=payload.behavior;
    if(payload.mode==="GAME_TURN"){state.pendingGameTurnId=turnId;state.pendingGameEvent=(payload.context&&payload.context.event)||null;}
    state.geminiPending=true;
    try{
      if(A&&typeof A.onExperienceDirective==="function")A.onExperienceDirective(JSON.stringify(payload));
      else if(payload.mode==="GAME_TURN")applyLocalFallback(turnId);
    }catch(_){if(payload.mode==="GAME_TURN")applyLocalFallback(turnId);}
  }

  function sendSignatureSpeech(req){
    const r=req||{};
    if(r.cancelPrevious)invalidatePendingTurn("signature_speech");
    const event={type:"SIGNATURE_BANTER",special:true,reason:r.reason||"signature"};
    const context=state.runtime.aiContext(event,{signatureActive:true});
    const payload={
      mode:"BANTER",reason:r.reason||"signature",delivery:"SNAP",
      instruction:"Speak one short in-character line for this signature beat. Suggested meaning: "+String(r.fallback||"").slice(0,80)+". Do not call a tool.",
      context,behavior:{behavior:"signature_moment",eventCount:1,tapCount:0,durationMs:0,dominantArea:"UNKNOWN",rageClick:false,eventTypes:{SIGNATURE_BANTER:1}},
      turnId:state.nextTurnId++,baseStateVersion:state.stateVersion
    };
    payload.context.turnId=payload.turnId;payload.context.baseStateVersion=payload.baseStateVersion;payload.context.behavior=payload.behavior;
    state.geminiPending=true;
    try{A&&A.onExperienceDirective(JSON.stringify(payload));}catch(_){}
  }

  function invalidatePendingTurn(reason){
    state.pendingGameTurnId=0;state.pendingGameEvent=null;state.geminiPending=false;
    try{A&&A.onRuntimeSignal(JSON.stringify({type:"INVALIDATE_GEMINI",reason:String(reason||"state_changed"),stateVersion:++state.stateVersion}));}catch(_){}
  }

  function applyLocalFallback(turnId){
    if(turnId&&state.pendingGameTurnId&&turnId!==state.pendingGameTurnId)return;
    if(state.signatureMoments.isActive())return;
    state.runtime.fallback(state.pendingGameEvent||{type:"MODEL_UNAVAILABLE"});
    state.pendingGameTurnId=0;state.pendingGameEvent=null;state.geminiPending=false;state.stateVersion++;renderBackground();
  }

  function applyValidatedPlanToTarget(plan,rule){
    if(!plan||state.signatureMoments.isActive())return;
    clearDecoys();
    const behavior=String(plan.targetBehavior||"STILL").toUpperCase(),s=screen(),safe=safeBounds();
    state.target.visible=true;state.target.alpha=behavior==="HIDE"?.18:1;
    state.targetLabel.text=behavior==="HIDE"?"?":"TOUCH";
    if(behavior==="ESCAPE"){
      state.target.x=safe.left+Math.random()*(safe.right-safe.left);state.target.y=safe.top+Math.random()*(safe.bottom-safe.top);
    }else if(behavior==="SPLIT"||plan.situation==="DECOY"){
      spawnDecoys(state.runtime.currentSensoryState.density>=2?8:4);
    }else if(behavior==="PULSE"){
      state.target.scale.set(1.12);
    }
    renderBackground();
  }

  function spawnDecoys(count){
    const s=screen(),safe=safeBounds(),n=Math.min(30,Math.max(0,count|0));
    for(let i=0;i<n;i++){
      const g=state.pools.decoys.acquire(state.world);if(!g)break;
      g.circle(0,0,14+Math.random()*10).fill({color:0xffffff,alpha:.15+Math.random()*.25});
      g.x=safe.left+Math.random()*(safe.right-safe.left);g.y=safe.top+Math.random()*(safe.bottom-safe.top);
      state.decoys.push(g);
    }
  }
  function clearDecoys(){for(const g of state.decoys)state.pools.decoys.release(g);state.decoys.length=0;}

  function safeBounds(){
    const s=screen(),pad=58;return{
      left:Math.min(s.width-pad,Math.max(pad,state.safe.left+pad)),
      top:Math.min(s.height-pad,Math.max(pad,state.safe.top+pad+24)),
      right:Math.max(pad,Math.min(s.width-pad,s.width-state.safe.right-pad)),
      bottom:Math.max(pad,Math.min(s.height-pad,s.height-state.safe.bottom-pad-72))
    };
  }

  function renderBackground(){
    if(!state.bg)return;const s=screen(),world=state.runtime&&state.runtime.currentPlan&&GameWorldCatalog.WORLDS[state.runtime.currentPlan.world];
    const color=world&&world.bg!=null?world.bg:0x05070d;state.bg.clear().rect(0,0,s.width,s.height).fill({color,alpha:1});
  }

  function resizeScene(){
    if(!state.app)return;state.app.stage.hitArea=screen();renderBackground();
    const s=screen(),b=safeBounds();
    if(state.target){state.target.x=clamp(state.target.x||s.width*.5,b.left,b.right);state.target.y=clamp(state.target.y||s.height*.52,b.top,b.bottom);}
  }

  function tick(t){
    const dt=Math.min(50,Number(t.deltaMS)||16.67);state.primitiveHost&&state.primitiveHost.tick(dt);
    for(let i=state.ripples.length-1;i>=0;i--){
      const r=state.ripples[i];r.life-=dt/1000;const p=1-r.life/r.max;r.g.scale.set(1+p*2.4);r.g.alpha=clamp(r.life/r.max,0,1)*.65;
      if(r.life<=0){state.pools.ripples.release(r.g);state.ripples.splice(i,1);}
    }
    if(state.target&&state.primitiveHost&&state.primitiveHost.interaction!=="HOLD"){
      const desired=1+Math.sin(performance.now()/450)*.025;state.target.scale.x+=(desired-state.target.scale.x)*.08;state.target.scale.y=state.target.scale.x;
    }
    const idle=performance.now()-state.lastInputAt;
    if(!state.signatureMoments.isActive()){
      if(idle>2800&&state.idleStage===0){state.idleStage=1;state.runtime.onPlayerEvent({type:"IDLE_START",idleMs:Math.round(idle),special:true});}
      else if(idle>6500&&state.idleStage===1){state.idleStage=2;state.runtime.onPlayerEvent({type:"IDLE_STAGE",stage:2,idleMs:Math.round(idle),special:true});}
    }
    updateFrameDiagnostics(dt);
  }

  function updateFrameDiagnostics(dt){
    const f=state.frame;f.accMs+=dt;f.frames++;
    if(f.accMs>=500){f.fps=Math.round(f.frames*1000/f.accMs);f.accMs=0;f.frames=0;}
    if(DEBUG&&performance.now()-f.lastLog>1000){f.lastLog=performance.now();console.log("[InfiniteClick diagnostics]",diagnostics());}
  }

  function diagnostics(){
    const fx=state.fx&&state.fx.diagnostics?state.fx.diagnostics():{};
    return{
      fps:state.frame.fps,lastFrameMs:Math.round((state.app&&state.app.ticker&&state.app.ticker.deltaMS||0)*10)/10,
      activeParticles:fx.activeParticles||0,ambientParticles:fx.ambientParticles||0,
      particlePool:fx.pool||null,ripplePool:state.pools&&state.pools.ripples.stats(),decoyPool:state.pools&&state.pools.decoys.stats(),
      activeSignature:state.signatureMoments&&state.signatureMoments.currentId||"NONE",
      geminiRequestPending:state.geminiPending,eventAggregationCount:state.aggregator?state.aggregator.pendingCount():0,
      stateVersion:state.stateVersion
    };
  }

  function receive(msg){
    try{
      if(!msg)return;
      if(msg.op==="safeArea"){state.safe.left=Math.max(0,Number(msg.left)||0);state.safe.top=Math.max(0,Number(msg.top)||0);state.safe.right=Math.max(0,Number(msg.right)||0);state.safe.bottom=Math.max(0,Number(msg.bottom)||0);resizeScene();}
      else if(msg.op==="language")state.language=String(msg.value||"zh-TW");
      else if(msg.op==="experiencePlan"){
        const turnId=Number(msg.turnId)||0;
        if(!turnId||turnId!==state.pendingGameTurnId||state.signatureMoments.isActive())return;
        const result=state.runtime.applyAiPlan(msg.plan||{});
        if(result&&result.ok){state.stateVersion++;renderBackground();}
        state.pendingGameTurnId=0;state.pendingGameEvent=null;state.geminiPending=false;
      }else if(msg.op==="geminiFallback")applyLocalFallback(Number(msg.turnId)||0);
      else if(msg.op==="geminiState")state.geminiPending=!!msg.pending;
      else if(msg.op==="voiceState"&&state.audio)state.audio.setVoiceActive(!!msg.active);
      else if(msg.op==="spokenLine"&&state.runtime)state.runtime.recordSpokenLine(String(msg.text||""));
      else if(msg.op==="geminiLiveReady"&&state.runtime&&!state.signatureMoments.isActive()){
        const event={type:"LIVE_READY",special:true};
        const context=state.runtime.aiContext(event,diagnostics());
        const directive={mode:"GAME_TURN",reason:"live_ready",delivery:"TEASE",instruction:"You are live now. Give one short in-character line and choose the next high-level experience."};
        state.aggregator.push(event,directive,context,{immediate:true});
      }
      else if(msg.op==="reset"){
        state.aggregator&&state.aggregator.cancel();state.signatureMoments&&state.signatureMoments.stop("reset");
        clearDecoys();for(const r of state.ripples)state.pools.ripples.release(r.g);state.ripples.length=0;
        state.pendingGameTurnId=0;state.pendingGameEvent=null;state.geminiPending=false;state.stateVersion++;
      }
    }catch(e){reportError(e);}
  }

  function reportError(e){console.error(e);try{A&&A.onRendererError(String(e&&e.message||e));}catch(_){}}
  window.InfiniteClick={receive,diagnostics};
  boot().catch(reportError);
})();
