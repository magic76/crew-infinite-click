(() => {
  "use strict";

  const A=window.AndroidGame;
  const DEBUG=!!window.__INFINITE_CLICK_DEBUG__;
  const state={
    app:null,gameplay:null,bg:null,world:null,target:null,targetCore:null,targetLabel:null,
    pools:null,ripples:[],decoys:[],fx:null,audio:null,primitiveHost:null,signatureMoments:null,runtime:null,aggregator:null,
    safe:{left:0,top:0,right:0,bottom:0},language:"zh-TW",lastInputAt:performance.now(),idleStage:0,
    nextTurnId:1,stateVersion:1,pendingGameTurnId:0,pendingGameEvent:null,geminiPending:false,
    frame:{fps:60,lastMs:performance.now(),accMs:0,frames:0,lastLog:0},
    tapJuice:{lastAt:0,streak:0,lastFrenzyAt:0,heat:0,cycleTaps:0,goal:8,promiseStage:0,jackpots:0,nearMissUsed:false,labelUntil:0,lastPromiseAt:0}
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

  function renderTargetPalette(plan){
    if(!state.targetCore)return;
    const world=plan&&GameWorldCatalog.WORLDS[plan.world];
    const accent=world&&world.accent!=null?world.accent:0xff416c;
    const secondary=world&&world.secondary!=null?world.secondary:0xffffff;
    state.targetCore.clear();
    state.targetCore.circle(0,0,31).fill({color:accent,alpha:.96});
    state.targetCore.circle(-8,-9,7).fill({color:secondary,alpha:.22});
    state.targetCore.circle(0,0,42).stroke({color:secondary,width:2,alpha:.34});
    if(state.targetLabel&&world&&world.accent!=null)state.targetLabel.style.fill=0xffffff;
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
    state.runtime.startSession();
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
    stage.on("pointerup",e=>{if(!state.signatureMoments.isActive()){const p=e.global;localReleaseFeedback();state.primitiveHost.pointerUp(p.x,p.y);}});
    stage.on("pointerupoutside",e=>{if(!state.signatureMoments.isActive()){const p=e.global;localReleaseFeedback();state.primitiveHost.pointerUp(p.x,p.y);}});
  }

  function nextFomoGoal(){
    const j=state.tapJuice.jackpots;
    return 6+Math.floor(Math.random()*5)+Math.min(2,Math.floor(j/3));
  }

  function setFomoLabel(text,ms){
    if(!state.targetLabel)return;
    state.targetLabel.text=text;state.tapJuice.labelUntil=performance.now()+Math.max(120,Number(ms)||500);
  }

  function triggerPromiseStage(stage,px,py,progress){
    const j=state.tapJuice;if(stage<=j.promiseStage)return;
    j.promiseStage=stage;j.lastPromiseAt=performance.now();
    if(stage===1)setFomoLabel("...",520);
    else if(stage===2)setFomoLabel("KEEP GOING",760);
    else setFomoLabel("ONE MORE?",920);
    if(window.GameHaptics)window.GameHaptics.perform(stage>=3?"HEARTBEAT":"SOFT_TAP",stage>=3?.34:.20);
    if(state.fx&&typeof state.fx.tapPromiseAccent==="function")state.fx.tapPromiseAccent(px,py,progress,stage);
  }

  function triggerFomoJackpot(px,py){
    const j=state.tapJuice;j.jackpots++;
    const level=Math.min(4,1+Math.floor(j.jackpots/2));
    setFomoLabel(["AGAIN.","MORE?","KEEP GOING.","WHAT ELSE?"][j.jackpots%4],900);
    if(window.GameHaptics)window.GameHaptics.perform("IMPACT",Math.min(.78,.48+level*.07));
    if(state.fx&&typeof state.fx.tapJackpot==="function")state.fx.tapJackpot(px,py,level,j.heat);
    else if(state.fx&&typeof state.fx.tapFrenzyAccent==="function")state.fx.tapFrenzyAccent(px,py,20,1);
    if(state.audio&&state.runtime&&state.runtime.currentPlan&&typeof state.audio.playJackpot==="function"){
      state.audio.playJackpot(state.runtime.currentPlan.audioMood||"GLITCH",level);
    }
    j.cycleTaps=0;j.goal=nextFomoGoal();j.promiseStage=0;j.nearMissUsed=false;
    j.heat=clamp(j.heat+.18,0,1);
  }

  function updateFomoCycle(px,py,gap){
    const j=state.tapJuice;
    if(gap<900)j.cycleTaps=Math.min(30,j.cycleTaps+1);
    else{j.cycleTaps=1;j.goal=nextFomoGoal();j.promiseStage=0;j.nearMissUsed=false;}
    let progress=clamp(j.cycleTaps/Math.max(1,j.goal),0,1);
    if(progress>=.46)triggerPromiseStage(1,px,py,progress);
    if(progress>=.70)triggerPromiseStage(2,px,py,progress);
    if(progress>=.88)triggerPromiseStage(3,px,py,progress);
    if(j.cycleTaps>=j.goal){
      // Occasional near-miss: the world visibly hesitates for one or two extra taps.
      if(!j.nearMissUsed&&j.jackpots>0&&Math.random()<.28){
        j.nearMissUsed=true;j.goal+=1+Math.floor(Math.random()*2);
        setFomoLabel("SO CLOSE.",720);
        if(window.GameHaptics)window.GameHaptics.perform("HEARTBEAT",.42);
        if(state.fx&&typeof state.fx.tapPromiseAccent==="function")state.fx.tapPromiseAccent(px,py,.96,4);
      }else triggerFomoJackpot(px,py);
    }
    return progress;
  }

  function localTouchFeedback(x,y){
    const t=performance.now(),gap=state.tapJuice.lastAt?t-state.tapJuice.lastAt:9999;
    if(gap<340){
      state.tapJuice.streak=Math.min(24,state.tapJuice.streak+1);
      state.tapJuice.heat=clamp(state.tapJuice.heat+.12,0,1);
    }else{
      state.tapJuice.streak=1;
      state.tapJuice.heat=Math.max(.08,state.tapJuice.heat*.48);
    }
    state.tapJuice.lastAt=t;
    const s=screen(),px=x*s.width,py=y*s.height;
    const fomoProgress=updateFomoCycle(px,py,gap);
    const streak=state.tapJuice.streak,power=clamp(Math.max((streak-1)/12,fomoProgress*.82),0,1),heat=state.tapJuice.heat;
    const world=state.runtime&&state.runtime.currentPlan&&GameWorldCatalog.WORLDS[state.runtime.currentPlan.world];
    const accent=world&&world.accent!=null?world.accent:0xffffff;
    const secondary=world&&world.secondary!=null?world.secondary:0xffffff;

    // Tap feel is never gated by sensoryDensity. The old pre-cleanup build felt good because
    // every physical tap produced a dense local response; v4 restores that density with pools.
    const pool=state.pools.ripples,g=pool.acquire(state.gameplay);if(g){
      g.circle(0,0,10+power*5).stroke({color:accent,width:2.5+power*1.5,alpha:.90});
      g.x=px;g.y=py;state.ripples.push({g,life:.30,max:.30,growth:3.0+power*1.0,alpha:.90});
    }
    if(streak>=3){
      const g2=pool.acquire(state.gameplay);if(g2){
        g2.circle(0,0,5+power*4).stroke({color:secondary,width:1.5+power*.7,alpha:.54});
        g2.x=px;g2.y=py;state.ripples.push({g:g2,life:.24,max:.24,growth:4.0+power*.8,alpha:.54});
      }
    }

    if(state.target){
      const squash=.84-power*.10;state.target.scale.set(squash);
      state.target.rotation=(Math.random()-.5)*(.06+power*.10);
      if(state.targetCore)state.targetCore.alpha=1;
    }
    if(window.GameHaptics)window.GameHaptics.perform(streak>=8?"DIGITAL_TRIPLE":"SOFT_TAP",.20+power*.22);
    if(state.audio&&state.runtime&&state.runtime.currentPlan){
      const mood=state.runtime.currentPlan.audioMood||"GLITCH";
      if(typeof state.audio.playClick==="function")state.audio.playClick(mood,.28+power*.30,Math.max(streak,Math.round(fomoProgress*20)));
      else state.audio.play(mood,"click",.28+power*.30);
    }
    if(state.fx&&typeof state.fx.tapAccent==="function")state.fx.tapAccent(px,py,streak);

    // Rapid tapping creates escalating effects without restoring the old fixed tap-count phase loop.
    // Cooldown is time-based, so the player can hammer the screen without allocating unbounded work.
    if((streak>=4||fomoProgress>=.70)&&state.fx&&typeof state.fx.tapFrenzyAccent==="function"&&t-state.tapJuice.lastFrenzyAt>=210){
      state.tapJuice.lastFrenzyAt=t;
      state.fx.tapFrenzyAccent(px,py,streak,heat);
    }
  }

  function localReleaseFeedback(){
    if(!state.target)return;
    const power=clamp((state.tapJuice.streak-1)/12,0,1);
    const rebound=1.075+power*.075;
    if(state.target.scale.x<rebound)state.target.scale.set(rebound);
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
    clearDecoys();renderTargetPalette(plan);
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
    if(!state.bg)return;
    const s=screen(),plan=state.runtime&&state.runtime.currentPlan,world=plan&&GameWorldCatalog.WORLDS[plan.world];
    const color=world&&world.bg!=null?world.bg:0x05070d,g=state.bg;g.clear().rect(0,0,s.width,s.height).fill({color,alpha:1});
    if(!world)return;
    // Static, zero-allocation world identity. These shapes are redrawn only on resize/plan change.
    const a=world.accent,secondary=world.secondary,id=world.id;
    if(id==="SPRING_BLOOM"){
      g.circle(s.width*.18,s.height*.22,Math.max(s.width,s.height)*.24).fill({color:a,alpha:.035});
      g.circle(s.width*.78,s.height*.72,Math.max(s.width,s.height)*.2).fill({color:secondary,alpha:.035});
    }else if(id==="SUMMER_STORM"){
      for(let i=0;i<4;i++)g.rect(-s.width*.1,s.height*(.12+i*.23),s.width*1.2,24+i*8).fill({color:i%2?a:secondary,alpha:.025+i*.008});
    }else if(id==="AUTUMN_DECAY"){
      g.circle(s.width*.15,s.height*.78,s.width*.34).fill({color:a,alpha:.04});
      g.circle(s.width*.9,s.height*.18,s.width*.28).fill({color:secondary,alpha:.028});
    }else if(id==="WINTER_FROST"){
      for(let i=0;i<5;i++)g.circle(s.width*(.14+i*.2),s.height*(.18+(i%2)*.5),26+i*8).stroke({color:i%2?a:secondary,width:1,alpha:.08});
    }else if(id==="VOID_CHAMBER"){
      g.circle(s.width*.5,s.height*.5,Math.min(s.width,s.height)*.34).stroke({color:a,width:2,alpha:.05});
      g.circle(s.width*.5,s.height*.5,Math.min(s.width,s.height)*.18).fill({color:secondary,alpha:.025});
    }else{
      for(let i=0;i<5;i++)g.rect(s.width*(.08+i*.19),0,1+(i%2),s.height).fill({color:i%2?a:secondary,alpha:.025});
    }
  }

  function resizeScene(){
    if(!state.app)return;state.app.stage.hitArea=screen();renderBackground();
    const s=screen(),b=safeBounds();
    if(state.target){state.target.x=clamp(state.target.x||s.width*.5,b.left,b.right);state.target.y=clamp(state.target.y||s.height*.52,b.top,b.bottom);}
  }

  function tick(t){
    const dt=Math.min(50,Number(t.deltaMS)||16.67);state.primitiveHost&&state.primitiveHost.tick(dt);
    for(let i=state.ripples.length-1;i>=0;i--){
      const r=state.ripples[i];r.life-=dt/1000;const p=1-r.life/r.max;r.g.scale.set(1+p*(r.growth||2.4));r.g.alpha=clamp(r.life/r.max,0,1)*(r.alpha||.65);
      if(r.life<=0){state.pools.ripples.release(r.g);state.ripples.splice(i,1);}
    }
    if(state.target&&state.primitiveHost&&state.primitiveHost.interaction!=="HOLD"){
      const nowT=performance.now(),sinceTap=nowT-state.tapJuice.lastAt;
      const stage=state.tapJuice.promiseStage;
      const promisePulse=stage>=3?.055+Math.sin(nowT/72)*.028:(stage===2?.026+Math.sin(nowT/105)*.014:0);
      const desired=1+Math.sin(nowT/450)*.025+promisePulse;
      if(sinceTap>420)state.tapJuice.heat=Math.max(0,state.tapJuice.heat-dt/2100);
      // Preserve a nearly-complete cycle briefly. The player can see/feel that one more tap is still "alive".
      if(state.tapJuice.cycleTaps>0&&sinceTap>1500){
        state.tapJuice.cycleTaps=0;state.tapJuice.goal=nextFomoGoal();state.tapJuice.promiseStage=0;state.tapJuice.nearMissUsed=false;
      }
      state.target.scale.x+=(desired-state.target.scale.x)*.16;state.target.scale.y=state.target.scale.x;
      state.target.rotation+=(0-state.target.rotation)*.18;
      if(state.targetCore)state.targetCore.alpha+=(.96-state.targetCore.alpha)*.14;
      if(state.targetLabel&&state.tapJuice.labelUntil&&nowT>state.tapJuice.labelUntil){
        state.tapJuice.labelUntil=0;
        if(["...","KEEP GOING","ONE MORE?","SO CLOSE.","AGAIN.","MORE?","WHAT ELSE?"].includes(String(state.targetLabel.text)))state.targetLabel.text="TOUCH";
      }
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
      fomo:{cycleTaps:state.tapJuice.cycleTaps,goal:state.tapJuice.goal,promiseStage:state.tapJuice.promiseStage,jackpots:state.tapJuice.jackpots,heat:Math.round(state.tapJuice.heat*100)/100},
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
        const directive={mode:"GAME_TURN",reason:"live_ready",delivery:"DRY",voiceWanted:false,instruction:"You are live now. Quietly choose the next high-level experience; do not speak unless explicitly requested."};
        state.aggregator.push(event,directive,context,{immediate:true});
      }
      else if(msg.op==="reset"){
        state.aggregator&&state.aggregator.cancel();state.signatureMoments&&state.signatureMoments.stop("reset");
        clearDecoys();for(const r of state.ripples)state.pools.ripples.release(r.g);state.ripples.length=0;
        state.pendingGameTurnId=0;state.pendingGameEvent=null;state.geminiPending=false;state.stateVersion++;
        Object.assign(state.tapJuice,{lastAt:0,streak:0,lastFrenzyAt:0,heat:0,cycleTaps:0,goal:nextFomoGoal(),promiseStage:0,jackpots:0,nearMissUsed:false,labelUntil:0,lastPromiseAt:0});
      }
    }catch(e){reportError(e);}
  }

  function reportError(e){console.error(e);try{A&&A.onRendererError(String(e&&e.message||e));}catch(_){}}
  window.InfiniteClick={receive,diagnostics};
  boot().catch(reportError);
})();
