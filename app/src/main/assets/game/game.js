(() => {
  "use strict";

  const A=window.AndroidGame;
  const DEBUG=!!window.__INFINITE_CLICK_DEBUG__;
  const state={
    app:null,gameplay:null,bg:null,world:null,target:null,targetCore:null,targetLabel:null,
    pools:null,ripples:[],decoys:[],fx:null,mutation:null,promise:null,scene:null,audio:null,primitiveHost:null,runtime:null,aggregator:null,
    safe:{left:0,top:0,right:0,bottom:0},language:"zh-TW",lastInputAt:performance.now(),idleStage:0,
    nextTurnId:1,stateVersion:1,pendingGameTurnId:0,pendingGameEvent:null,geminiPending:false,
    frame:{fps:60,lastMs:performance.now(),accMs:0,frames:0,lastLog:0},
    tapJuice:{lastAt:0,streak:0,lastFrenzyAt:0,heat:0,jackpots:0}
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hex=v=>typeof v==="number"?v:Number.parseInt(String(v||"#ffffff").replace("#",""),16)||0xffffff;
  const screen=()=>state.app.renderer.screen;
  const norm=(x,y)=>{const s=screen();return{x:clamp(x/Math.max(1,s.width),0,1),y:clamp(y/Math.max(1,s.height),0,1)};};

  function polygonPath(g,points,fillColor,fillAlpha,strokeColor,strokeWidth,strokeAlpha){
    if(!g||!points||points.length<3)return;
    g.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++)g.lineTo(points[i][0],points[i][1]);
    if(typeof g.closePath==="function")g.closePath();
    if(fillColor!=null)g.fill({color:fillColor,alpha:fillAlpha==null?1:fillAlpha});
    if(strokeColor!=null&&strokeWidth>0)g.stroke({color:strokeColor,width:strokeWidth,alpha:strokeAlpha==null?1:strokeAlpha});
  }

  function drawTargetShape(core,worldId,accent,secondary){
    core.clear();
    const id=String(worldId||"NEON_RIFT");
    if(id==="SPRING_BLOOM"){
      const petals=[
        [[0,-34],[10,-10],[0,-2],[-10,-10]],
        [[34,0],[10,10],[2,0],[10,-10]],
        [[0,34],[-10,10],[0,2],[10,10]],
        [[-34,0],[-10,-10],[-2,0],[-10,10]]
      ];
      for(let i=0;i<petals.length;i++)polygonPath(core,petals[i],i%2?secondary:accent,.92,secondary,1,.28);
      polygonPath(core,[[0,-11],[10,0],[0,13],[-10,0]],accent,1,secondary,1.5,.5);
      core.moveTo(-42,18).lineTo(-18,-5).lineTo(-34,-24).stroke({color:secondary,width:1.5,alpha:.22});
    }else if(id==="SUMMER_STORM"){
      polygonPath(core,[[-9,-36],[13,-36],[1,-8],[19,-8],[-14,38],[-4,8],[-20,8]],accent,.98,secondary,2,.42);
      core.moveTo(-31,-24).lineTo(-8,-24).stroke({color:secondary,width:3,alpha:.18});
      core.moveTo(10,24).lineTo(31,24).stroke({color:secondary,width:3,alpha:.18});
    }else if(id==="AUTUMN_DECAY"){
      polygonPath(core,[[0,-36],[18,-20],[29,-3],[18,13],[4,35],[-6,20],[-27,12],[-19,-8],[-30,-22],[-9,-19]],accent,.94,secondary,1.5,.32);
      core.moveTo(-16,18).lineTo(16,-22).stroke({color:secondary,width:2,alpha:.5});
      core.moveTo(-5,5).lineTo(-19,-1).moveTo(5,-8).lineTo(20,-4).stroke({color:secondary,width:1,alpha:.34});
    }else if(id==="WINTER_FROST"){
      polygonPath(core,[[0,-38],[15,-18],[34,-9],[19,8],[25,33],[0,21],[-25,33],[-19,8],[-34,-9],[-15,-18]],secondary,.9,accent,2,.55);
      core.moveTo(0,-30).lineTo(0,23).moveTo(-26,-7).lineTo(24,11).moveTo(24,-7).lineTo(-22,13).stroke({color:accent,width:1.4,alpha:.52});
    }else if(id==="VOID_CHAMBER"){
      polygonPath(core,[[-28,-32],[3,-18],[28,-32],[14,0],[28,31],[2,18],[-28,31],[-13,0]],accent,.38,secondary,1.5,.5);
      polygonPath(core,[[-7,-30],[6,-16],[3,15],[-8,31],[-3,8]],0x000000,.94,secondary,1,.38);
      core.moveTo(-37,-6).lineTo(-18,0).lineTo(-37,8).stroke({color:secondary,width:2,alpha:.28});
      core.moveTo(37,-6).lineTo(18,0).lineTo(37,8).stroke({color:accent,width:2,alpha:.28});
    }else{
      polygonPath(core,[[-30,-28],[7,-28],[7,-10],[29,-10],[29,19],[9,19],[9,33],[-23,33],[-23,12],[-34,12]],accent,.95,secondary,1.5,.42);
      polygonPath(core,[[-13,-13],[18,-13],[18,5],[-13,5]],secondary,.52,null,0,0);
      core.moveTo(-38,-18).lineTo(-24,-18).moveTo(24,27).lineTo(38,27).stroke({color:secondary,width:3,alpha:.32});
    }
  }

  async function boot(){
    const app=new PIXI.Application();
    await app.init({
      resizeTo:window,background:0x05070d,antialias:true,
      resolution:Math.min(window.devicePixelRatio||1,1.5),autoDensity:true,powerPreference:"high-performance"
    });
    state.app=app;document.body.appendChild(app.canvas);buildScene();wireRuntime();wireInput();
    app.ticker.add(tick);
    if(DEBUG)window.PixiGameDebug={app,canvas:app.canvas,runtime:()=>state.runtime,mutation:()=>state.mutation,promise:()=>state.promise,diagnostics};
    try{A&&A.onRendererReady("PIXI_RUNTIME_V2");}catch(_){}
  }

  function buildScene(){
    const app=state.app;
    state.gameplay=new PIXI.Container();state.gameplay.label="gameplay-root";app.stage.addChild(state.gameplay);
    state.bg=new PIXI.Graphics();state.gameplay.addChild(state.bg);
    state.pools={particles:new ParticlePool(120),ripples:new RipplePool(12),decoys:new DecoyPool(30)};
    state.scene=new StormControlSceneRuntime(app,{parent:state.gameplay,onPhaseChange:handleScenePhase,onReveal:handleSceneReveal});
    state.fx=new WorldFxController(app,{particlePool:state.pools.particles,parent:state.gameplay});
    state.world=new PIXI.Container();state.world.label="world";state.gameplay.addChild(state.world);
    createTarget();
    if(state.fx.foreground)state.gameplay.addChild(state.fx.foreground);
    resizeScene();window.addEventListener("resize",resizeScene);
  }

  function createTarget(){
    const s=screen(),c=new PIXI.Container(),core=new PIXI.Graphics();
    drawTargetShape(core,"NEON_RIFT",0xe83cf6,0x34f0c3);
    const label=new PIXI.Text({text:"",style:{fill:0xffffff,fontFamily:"sans-serif",fontSize:12,fontWeight:"700"}});
    label.visible=false;label.anchor.set(.5);label.y=58;c.addChild(core,label);c.x=s.width*.5;c.y=s.height*.492;
    state.world.addChild(c);state.target=c;state.targetCore=core;state.targetLabel=label;
  }

  function renderTargetPalette(plan){
    if(!state.targetCore)return;
    const world=GameWorldCatalog.WORLDS.SUMMER_STORM;
    drawTargetShape(state.targetCore,"SUMMER_STORM",world.accent,world.secondary);
  }

  function wireRuntime(){
    state.audio=new AudioMoodPlayer();
    state.primitiveHost=new PrimitiveHostRuntime({
      gameplayContainer:state.world,getPrimaryTarget:()=>state.target,onGameEvent:handleSemanticEvent,
      onSurfaceMode:mode=>{if(state.targetCore)state.targetCore.alpha=mode==="NONE"?.96:.82;}
    });
    state.runtime=new ExperienceRuntime({
      fx:state.fx,audio:state.audio,haptics:window.GameHaptics,getPrimaryTarget:()=>state.target,
      onPrimitiveInteraction:m=>state.primitiveHost.setInteraction(m),onPrimitiveSpatial:m=>state.primitiveHost.setSpatial(m),
      onPrimitiveCamera:m=>state.primitiveHost.setCamera(m),onPrimitiveSurface:m=>state.primitiveHost.setSurface(m),
      onPrimitiveTiming:m=>state.primitiveHost.setTiming(m),onRuleTwist:(rule,plan)=>applyValidatedPlanToTarget(plan,rule),
      onInteractionDirective:(directive,context)=>routeDirective(directive,context),sceneContext:()=>state.scene&&state.scene.context?state.scene.context():null
    });
    state.aggregator=new GeminiEventAggregator({windowMs:650,onFlush:sendDirectiveToNative});
    state.runtime.startSession("SUMMER_STORM");state.runtime.fallback({type:"SESSION_START"});renderTargetPalette();renderBackground();
    const event={type:"SESSION_START",special:true},context=state.runtime.aiContext(event,diagnostics());
    state.aggregator.push(event,{mode:"GAME_TURN",reason:"session_start",delivery:"DRY",voiceWanted:false,instruction:"Silently choose a background-director plan for the Storm Control Room. Never speak."},context,{immediate:true});
  }

  function wireInput(){
    const stage=state.app.stage;stage.eventMode="static";stage.hitArea=screen();
    stage.on("pointerdown",e=>{
      state.lastInputAt=performance.now();state.idleStage=0;const p=e.global,n=norm(p.x,p.y);
      const sceneState=state.scene&&state.scene.tap?state.scene.tap(p.x,p.y,{streak:state.tapJuice.streak,heat:state.tapJuice.heat}):null;
      localTouchFeedback(n.x,n.y,sceneState);state.primitiveHost.pointerDown(p.x,p.y);
    });
    stage.on("pointermove",e=>{const p=e.global;state.primitiveHost.pointerMove(p.x,p.y);});
    stage.on("pointerup",e=>{const p=e.global;localReleaseFeedback();state.primitiveHost.pointerUp(p.x,p.y);});
    stage.on("pointerupoutside",e=>{const p=e.global;localReleaseFeedback();state.primitiveHost.pointerUp(p.x,p.y);});
  }

  function handlePromisePhase(event){
    const e=event||{};
    if(e.phaseIndex<2||e.phaseIndex>=5)return;
    if(state.mutation&&typeof state.mutation.promise==="function")state.mutation.promise(Math.min(4,e.phaseIndex),e.x,e.y);
    if(state.fx&&typeof state.fx.tapPromiseAccent==="function")state.fx.tapPromiseAccent(e.x,e.y,e.progress,Math.min(4,e.phaseIndex));
    if(window.GameHaptics){
      const cue=e.phaseIndex>=4?"HEARTBEAT":"SOFT_TAP";
      window.GameHaptics.perform(cue,e.phaseIndex>=4?.31:.14);
    }
  }

  function handlePromiseReveal(event){
    const e=event||{},j=state.tapJuice;j.jackpots++;
    const level=Math.min(4,1+Math.floor(j.jackpots/2));
    if(state.mutation&&typeof state.mutation.jackpot==="function")state.mutation.jackpot(e.x,e.y,level);
    if(window.GameHaptics)window.GameHaptics.perform("IMPACT",Math.min(.80,.50+level*.07));
    if(state.fx&&typeof state.fx.tapJackpot==="function")state.fx.tapJackpot(e.x,e.y,level,j.heat);
    if(state.audio&&state.runtime&&state.runtime.currentPlan&&typeof state.audio.playJackpot==="function")
      state.audio.playJackpot(state.runtime.currentPlan.audioMood||"GLITCH",level);
    if(state.runtime&&typeof state.runtime.forceLocalPromiseConsequence==="function")
      state.runtime.forceLocalPromiseConsequence({promiseType:e.type||"RIFT",chain:e.chain||0,reveals:e.reveals||0});
    j.heat=clamp(j.heat+.16,0,1);state.stateVersion++;
    renderBackground();
    try{A&&A.onRuntimeSignal(JSON.stringify({type:"PROMISE_REVEAL",promiseType:e.type||"",chain:e.chain||0,reveals:e.reveals||0,stateVersion:state.stateVersion}));}catch(_){}
  }

  function localTouchFeedback(x,y,sceneState){
    const t=performance.now(),gap=state.tapJuice.lastAt?t-state.tapJuice.lastAt:9999;
    if(gap<340){state.tapJuice.streak=Math.min(24,state.tapJuice.streak+1);state.tapJuice.heat=clamp(state.tapJuice.heat+.10,0,1);}
    else{state.tapJuice.streak=1;state.tapJuice.heat=Math.max(.06,state.tapJuice.heat*.52);}state.tapJuice.lastAt=t;
    const s=screen(),px=x*s.width,py=y*s.height,ctx=sceneState||state.scene&&state.scene.context&&state.scene.context()||{};
    const scenePower=clamp((Number(ctx.charge)||0)*.34+(Number(ctx.overload)||0)*.42+(Number(ctx.breach)||0)*.34,0,1);
    const streak=state.tapJuice.streak,power=clamp(Math.max((streak-1)/14,scenePower),0,1),heat=state.tapJuice.heat;
    const accent=0xf7db61,secondary=0x69b9e8,pool=state.pools.ripples,g=pool.acquire(state.gameplay);
    if(g){g.circle(0,0,8+power*4).stroke({color:accent,width:2+power*1.2,alpha:.76});g.x=px;g.y=py;state.ripples.push({g,life:.22,max:.22,growth:2.4+power*.8,alpha:.76});}
    if(state.target&&state.target.visible&&ctx.lastZone==="CORE"){const squash=.86-power*.08;state.target.scale.set(squash);state.target.rotation=(Math.random()-.5)*(.04+power*.06);}
    if(window.GameHaptics)window.GameHaptics.perform(streak>=10?"DIGITAL_TRIPLE":"SOFT_TAP",.18+power*.18);
    if(state.audio){if(typeof state.audio.playClick==="function")state.audio.playClick("STORM",.24+power*.26,Math.max(streak,Math.round(scenePower*18)));else state.audio.play("STORM","click",.25+power*.2);}
    if(state.fx&&typeof state.fx.tapAccent==="function")state.fx.tapAccent(px,py,streak);
    if((streak>=5||scenePower>.58)&&state.fx&&typeof state.fx.tapFrenzyAccent==="function"&&t-state.tapJuice.lastFrenzyAt>=240){state.tapJuice.lastFrenzyAt=t;state.fx.tapFrenzyAccent(px,py,streak,heat);}
  }

  function localReleaseFeedback(){
    if(!state.target)return;
    const power=clamp((state.tapJuice.streak-1)/12,0,1);
    const rebound=1.075+power*.075;
    if(state.target.scale.x<rebound)state.target.scale.set(rebound);
  }

  function handleSemanticEvent(raw){
    const e=normalizeEvent(raw);
    state.lastInputAt=performance.now();state.idleStage=0;
    state.runtime.onPlayerEvent(e);
  }

  function handleScenePhase(event){
    const e=event||{},phase=String(e.phase||"");
    if(window.GameHaptics){const cue=phase==="FALSE_CALM"?"WARNING":(phase==="PARTIAL_REVEAL"?"IMPACT":"SOFT_TAP");window.GameHaptics.perform(cue,phase==="PARTIAL_REVEAL"?.68:(phase==="FALSE_CALM"?.28:.16));}
    if(state.audio){if(phase==="FALSE_CALM")state.audio.play("STORM","trap",.32);else if(phase==="PARTIAL_REVEAL"&&state.audio.playJackpot)state.audio.playJackpot("STORM",3);else state.audio.play("STORM","reveal",.22);}
    if(phase==="REROUTE"||phase==="BREACH_HINT"||phase==="PARTIAL_REVEAL")invalidatePendingTurn("scene_phase");
    state.stateVersion++;
    try{A&&A.onRuntimeSignal(JSON.stringify({type:"SCENE_PHASE",scene:"STORM_CONTROL_ROOM",phase,previous:e.previous||"",stateVersion:state.stateVersion}));}catch(_){}
  }

  function handleSceneReveal(event){
    const e=event||{};state.tapJuice.jackpots++;state.stateVersion++;
    if(state.runtime&&typeof state.runtime.forceLocalSceneConsequence==="function")state.runtime.forceLocalSceneConsequence(e);
    try{A&&A.onRuntimeSignal(JSON.stringify({type:"SCENE_REVEAL",scene:"STORM_CONTROL_ROOM",reveals:e.reveals||0,cycle:e.cycle||0,stateVersion:state.stateVersion}));}catch(_){}
  }

  function handleMutationStage(event){
    const e=event||{};
    if(e.stage<=e.previous||e.stage<2)return;
    const x=state.target&&Number.isFinite(state.target.x)?state.target.x:screen().width/2;
    const y=state.target&&Number.isFinite(state.target.y)?state.target.y:screen().height/2;
    if(state.fx&&typeof state.fx.mutationStageAccent==="function")state.fx.mutationStageAccent(e.stage,x,y,e.pressure);
    if(window.GameHaptics)window.GameHaptics.perform(e.stage>=4?"WARNING":"SOFT_TAP",e.stage>=4?.36:(e.stage===3?.25:.16));
    if(state.audio&&state.runtime&&state.runtime.currentPlan){
      const mood=state.runtime.currentPlan.audioMood||"GLITCH";
      if(typeof state.audio.playClick==="function")state.audio.playClick(mood,.20+e.stage*.08,e.stage*4);
      if(e.stage>=4)state.audio.play(mood,"trap",.38);
    }
  }

  function handleWorldRupture(event){
    const e=event||{};
    state.stateVersion++;
    if(window.GameHaptics)window.GameHaptics.perform("IMPACT",.72);
    if(e.reason!=="jackpot"&&state.fx&&typeof state.fx.tapJackpot==="function")state.fx.tapJackpot(e.x,e.y,3,1);
    if(e.reason!=="jackpot"&&state.audio&&state.runtime&&state.runtime.currentPlan&&typeof state.audio.playJackpot==="function")state.audio.playJackpot(state.runtime.currentPlan.audioMood||"GLITCH",3);
    try{A&&A.onRuntimeSignal(JSON.stringify({type:"WORLD_RUPTURE",world:e.world||"",ruptures:e.ruptures||0,epoch:e.epoch||0,stateVersion:state.stateVersion}));}catch(_){}
  }

  function handleWorldEpoch(event){
    const e=event||{};
    if(!state.runtime||typeof state.runtime.forceLocalWorldMutation!=="function")return;
    invalidatePendingTurn("world_mutation");
    const result=state.runtime.forceLocalWorldMutation({epoch:e.epoch||0,ruptures:e.ruptures||0,fromWorld:e.world||""});
    if(result&&result.ok){state.stateVersion++;renderBackground();}
    try{A&&A.onRuntimeSignal(JSON.stringify({type:"WORLD_MUTATION",fromWorld:e.world||"",epoch:e.epoch||0,stateVersion:state.stateVersion}));}catch(_){}
  }

  function normalizeEvent(raw){
    const e=Object.assign({},raw||{}),s=screen();e.type=String(e.type||"").toUpperCase();
    if(Number.isFinite(e.x)&&Math.abs(e.x)>1)e.x=clamp(e.x/Math.max(1,s.width),0,1);
    if(Number.isFinite(e.y)&&Math.abs(e.y)>1)e.y=clamp(e.y/Math.max(1,s.height),0,1);
    return e;
  }

  function routeDirective(directive,context){
    if(!directive||directive.mode!=="GAME_TURN")return;
    const event=directive.event||(context&&context.event)||{};
    state.aggregator.push(event,Object.assign({},directive,{mode:"GAME_TURN",voiceWanted:false}),context);
  }

  function sendDirectiveToNative(payload){
    if(!payload||payload.mode==="SILENT")return;
    const turnId=state.nextTurnId++;
    payload.mode="GAME_TURN";payload.voiceWanted=false;payload.turnId=turnId;payload.baseStateVersion=state.stateVersion;payload.context=payload.context||{};
    payload.context.turnId=turnId;payload.context.baseStateVersion=state.stateVersion;payload.context.behavior=payload.behavior;
    if(payload.mode==="GAME_TURN"){state.pendingGameTurnId=turnId;state.pendingGameEvent=(payload.context&&payload.context.event)||null;}
    state.geminiPending=true;
    try{
      if(A&&typeof A.onExperienceDirective==="function")A.onExperienceDirective(JSON.stringify(payload));
      else if(payload.mode==="GAME_TURN")applyLocalFallback(turnId);
    }catch(_){if(payload.mode==="GAME_TURN")applyLocalFallback(turnId);}
  }

  function invalidatePendingTurn(reason){
    state.pendingGameTurnId=0;state.pendingGameEvent=null;state.geminiPending=false;
    try{A&&A.onRuntimeSignal(JSON.stringify({type:"INVALIDATE_GEMINI",reason:String(reason||"state_changed"),stateVersion:++state.stateVersion}));}catch(_){}
  }

  function applyLocalFallback(turnId){
    if(turnId&&state.pendingGameTurnId&&turnId!==state.pendingGameTurnId)return;
    state.runtime.fallback(state.pendingGameEvent||{type:"MODEL_UNAVAILABLE"});
    state.pendingGameTurnId=0;state.pendingGameEvent=null;state.geminiPending=false;state.stateVersion++;renderBackground();
  }

  function applyValidatedPlanToTarget(plan,rule){
    if(!plan)return;clearDecoys();renderTargetPalette(plan);if(state.scene&&state.scene.steer)state.scene.steer(plan);
    // Scene composition owns spatial layout. AI may bias anomalies but cannot move the room's hardware.
    state.target.alpha=1;state.targetLabel.visible=false;renderBackground();
  }

  function spawnDecoys(count){
    const s=screen(),safe=safeBounds(),n=Math.min(30,Math.max(0,count|0));
    const plan=state.runtime&&state.runtime.currentPlan,world=plan&&GameWorldCatalog.WORLDS[plan.world],id=world&&world.id||"NEON_RIFT";
    const accent=world&&world.accent!=null?world.accent:0xffffff,secondary=world&&world.secondary!=null?world.secondary:0xffffff;
    for(let i=0;i<n;i++){
      const g=state.pools.decoys.acquire(state.world);if(!g)break;
      const sz=12+Math.random()*10;
      if(id==="SUMMER_STORM")polygonPath(g,[[-3,-sz],[5,-sz*.2],[-1,1],[7,1],[-6,sz],[-2,4],[-8,4]],accent,.28,secondary,1,.18);
      else if(id==="AUTUMN_DECAY")polygonPath(g,[[0,-sz],[sz*.7,-sz*.25],[sz*.45,sz*.55],[0,sz],[-sz*.7,sz*.25],[-sz*.4,-sz*.6]],accent,.22,secondary,1,.16);
      else if(id==="WINTER_FROST")polygonPath(g,[[0,-sz],[sz*.55,-sz*.25],[sz*.8,sz*.55],[0,sz*.72],[-sz*.8,sz*.55],[-sz*.55,-sz*.25]],secondary,.22,accent,1,.2);
      else if(id==="VOID_CHAMBER")polygonPath(g,[[-sz,0],[0,-sz*.5],[sz,0],[0,sz*.5]],0x000000,.34,accent,1,.24);
      else if(id==="SPRING_BLOOM")polygonPath(g,[[0,-sz],[sz*.6,0],[0,sz],[-sz*.6,0]],i%2?secondary:accent,.22,null,0,0);
      else polygonPath(g,[[-sz,-sz*.6],[sz*.35,-sz*.6],[sz*.35,0],[sz,0],[sz,sz*.55],[-sz*.2,sz*.55],[-sz*.2,sz],[-sz,sz]],accent,.22,secondary,1,.18);
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
    if(!state.bg)return;const s=screen(),g=state.bg;g.clear().rect(0,0,s.width,s.height).fill({color:0x06101b,alpha:1});
  }

  function resizeScene(){
    if(!state.app)return;state.app.stage.hitArea=screen();renderBackground();if(state.scene&&state.scene.resize)state.scene.resize();
    const p=state.scene&&state.scene.targetPresentation?state.scene.targetPresentation():null;if(state.target&&p){state.target.x=p.x;state.target.y=p.y;state.target.visible=p.visible;state.target.alpha=p.alpha;}
  }

  function tick(t){
    const dt=Math.min(50,Number(t.deltaMS)||16.67);state.primitiveHost&&state.primitiveHost.tick(dt);
    for(let i=state.ripples.length-1;i>=0;i--){
      const r=state.ripples[i];r.life-=dt/1000;const p=1-r.life/r.max;r.g.scale.set(1+p*(r.growth||2.4));r.g.alpha=clamp(r.life/r.max,0,1)*(r.alpha||.65);
      if(r.life<=0){state.pools.ripples.release(r.g);state.ripples.splice(i,1);}
    }
    if(state.target&&state.primitiveHost&&state.primitiveHost.interaction!=="HOLD"){
      const nowT=performance.now(),sinceTap=nowT-state.tapJuice.lastAt,pres=state.scene&&state.scene.targetPresentation?state.scene.targetPresentation():null;
      if(sinceTap>420)state.tapJuice.heat=Math.max(0,state.tapJuice.heat-dt/2200);
      if(pres){state.target.visible=!!pres.visible;state.target.alpha=pres.alpha==null?1:pres.alpha;state.target.x=pres.x;state.target.y=pres.y;
        const desired=(pres.scale||1)+Math.sin(nowT/520)*.018;state.target.scale.x+=(desired-state.target.scale.x)*.14;state.target.scale.y=state.target.scale.x;state.target.rotation+=(0-state.target.rotation)*.16;}
    }
    const idle=performance.now()-state.lastInputAt;
    if(idle>2800&&state.idleStage===0){state.idleStage=1;state.runtime.onPlayerEvent({type:"IDLE_START",idleMs:Math.round(idle),special:true});}
    else if(idle>6500&&state.idleStage===1){state.idleStage=2;state.runtime.onPlayerEvent({type:"IDLE_STAGE",stage:2,idleMs:Math.round(idle),special:true});}
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
      activeSignature:"NONE",
      geminiRequestPending:state.geminiPending,eventAggregationCount:state.aggregator?state.aggregator.pendingCount():0,
      fomo:{jackpots:state.tapJuice.jackpots,heat:Math.round(state.tapJuice.heat*100)/100},
      scene:state.scene&&state.scene.context?state.scene.context():null,
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
        if(!turnId||turnId!==state.pendingGameTurnId)return;
        const result=state.runtime.applyAiPlan(msg.plan||{});
        if(result&&result.ok){state.stateVersion++;renderBackground();}
        state.pendingGameTurnId=0;state.pendingGameEvent=null;state.geminiPending=false;
      }else if(msg.op==="geminiFallback")applyLocalFallback(Number(msg.turnId)||0);
      else if(msg.op==="geminiState")state.geminiPending=!!msg.pending;
      else if(msg.op==="voiceState"&&state.audio)state.audio.setVoiceActive(!!msg.active);
      else if(msg.op==="spokenLine"&&state.runtime)state.runtime.recordSpokenLine(String(msg.text||""));
      else if(msg.op==="geminiLiveReady"&&state.runtime){
        const event={type:"LIVE_READY",special:true};
        const context=state.runtime.aiContext(event,diagnostics());
        const directive={mode:"GAME_TURN",reason:"live_ready",delivery:"DRY",voiceWanted:false,instruction:"Silently choose the next Storm Control Room direction. Never speak."};
        state.aggregator.push(event,directive,context,{immediate:true});
      }
      else if(msg.op==="reset"){
        state.aggregator&&state.aggregator.cancel();
        clearDecoys();for(const r of state.ripples)state.pools.ripples.release(r.g);state.ripples.length=0;
        state.pendingGameTurnId=0;state.pendingGameEvent=null;state.geminiPending=false;state.stateVersion++;
        if(state.scene&&state.scene.reset)state.scene.reset();
        Object.assign(state.tapJuice,{lastAt:0,streak:0,lastFrenzyAt:0,heat:0,jackpots:0});
      }
    }catch(e){reportError(e);}
  }

  function reportError(e){console.error(e);try{A&&A.onRendererError(String(e&&e.message||e));}catch(_){}}
  window.InfiniteClick={receive,diagnostics};
  boot().catch(reportError);
})();
