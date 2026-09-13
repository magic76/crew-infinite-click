(() => {
  "use strict";

  const A=window.AndroidGame;
  const DEBUG=!!window.__INFINITE_CLICK_DEBUG__;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>performance.now();
  const SLOT_SPECS=[
    {id:"hero-peach",type:"PEACH",temperament:"SHY",sheet:"sprites/cutie-sheet.png",scaleFactor:1.32,initial:{x:.50,y:.54},start:true},
    {id:"spark-one",type:"SPARK",temperament:"TRICKSTER",sheet:"sprites/spark-sheet.png",scaleFactor:.88,initial:{x:.62,y:.48}},
    {id:"mint-one",type:"MINT",temperament:"CURIOUS",sheet:"sprites/mint-sheet.png",scaleFactor:.92,initial:{x:.38,y:.60}},
    {id:"peach-two",type:"PEACH",temperament:"GOOFY",sheet:"sprites/cutie-sheet.png",scaleFactor:.88,initial:{x:.67,y:.66}},
    {id:"spark-two",type:"SPARK",temperament:"TRICKSTER",sheet:"sprites/spark-sheet.png",scaleFactor:.74,initial:{x:.30,y:.42}},
    {id:"mint-two",type:"MINT",temperament:"CURIOUS",sheet:"sprites/mint-sheet.png",scaleFactor:.78,initial:{x:.72,y:.42}}
  ];
  const FX_PALETTES={
    PEACH:[0xe99592,0xf6b7ae,0xe7bf63,0xffffff],
    SPARK:[0xe7bf63,0xd99a4c,0xffffff,0x79a8be],
    MINT:[0x7fc9b5,0xb9e1d6,0x79a8be,0xffffff],
    NEUTRAL:[0xffffff,0x9d90bd,0xd8b5bd,0x79a8be]
  };
  const state={
    app:null,stageRoot:null,world:null,bgSprite:null,bgTexture:null,bg:null,toys:null,objectLayer:null,objectRuntime:null,petLayer:null,fxLayer:null,flash:null,audio:null,pets:[],
    pools:null,particles:[],ripples:[],safe:{left:0,top:0,right:0,bottom:0},
    lastTapAt:0,lastDirectHitAt:0,lastNearAt:0,lastCollisionAt:0,streak:0,hitCombo:0,totalTaps:0,directHits:0,nearMisses:0,
    collisionChain:0,lastCollisionChainAt:0,lastComboBlastAt:0,lastFrenzyAt:0,frenzyUntil:0,frenzyPower:0,nextFrenzyKickAt:0,lastTauntAt:0,lastTrails:new Map(),
    toyEnergy:0,nextEventEnergy:.90,eventCount:0,lastEventAt:0,lastBumps:new Map(),pending:[],objectEvents:0,objectHits:0,
    cameraX:0,cameraY:0,cameraVx:0,cameraVy:0,cameraRot:0,cameraVr:0,flashAlpha:0,flashColor:0xffffff,
    frame:{fps:60,accMs:0,frames:0,lastLog:0}
  };
  const screen=()=>state.app.renderer.screen;
  const activePets=()=>state.pets.filter(p=>p.isActive&&p.isActive());

  async function boot(){
    const app=new PIXI.Application();
    await app.init({resizeTo:window,background:0x171522,antialias:true,resolution:Math.min(window.devicePixelRatio||1,1.5),autoDensity:true,powerPreference:"high-performance"});
    state.app=app;document.body.appendChild(app.canvas);buildScene();wireInput();state.audio=new AudioMoodPlayer();
    state.objectRuntime=new ToyObjectRuntime(app,{parent:state.objectLayer,safeBounds,onEvent:handleObjectEvent});

    for(const spec of SLOT_SPECS){
      const pet=new SpritePetRuntime(app,{
        id:spec.id,type:spec.type,temperament:spec.temperament,scaleFactor:spec.scaleFactor,initial:spec.initial,active:!!spec.start,
        parent:state.petLayer,safeBounds,onReaction:handlePetReaction,onModeChange:()=>{},onWallBounce:handleWallBounce
      });
      await pet.init(spec.sheet);state.pets.push(pet);
      if(!spec.start)pet.deactivate();
    }
    const hero=state.pets[0];if(hero){const s=screen(),b=safeBounds();hero.setActive(true,{x:(b.left+b.right)/2,y:b.top+(b.bottom-b.top)*.50});hero.setSizeMultiplier(1.08);}
    resizeScene();app.ticker.add(tick);
    if(DEBUG)window.PixiGameDebug={app,canvas:app.canvas,pets:()=>state.pets,diagnostics,triggerToyEvent};
    try{A&&A.onRendererReady("PREMIUM_TOY_ART_V16");}catch(_){}
  }

  function buildScene(){
    const app=state.app;
    state.stageRoot=new PIXI.Container();state.stageRoot.label="toy-box-root";app.stage.addChild(state.stageRoot);
    state.world=new PIXI.Container();state.world.label="premium-toy-world";state.stageRoot.addChild(state.world);
    state.bgSprite=new PIXI.Sprite();state.bgSprite.label="premium-scene-texture";state.world.addChild(state.bgSprite);
    state.bg=new PIXI.Graphics();state.world.addChild(state.bg);
    state.toys=new PIXI.Graphics();state.world.addChild(state.toys);
    state.objectLayer=new PIXI.Container();state.objectLayer.label="object-layer";state.world.addChild(state.objectLayer);
    state.petLayer=new PIXI.Container();state.petLayer.label="pet-layer";state.world.addChild(state.petLayer);
    state.fxLayer=new PIXI.Container();state.fxLayer.label="fx-layer";state.world.addChild(state.fxLayer);
    state.flash=new PIXI.Graphics();state.flash.eventMode="none";state.stageRoot.addChild(state.flash);
    state.pools={particles:new ParticlePool(320),ripples:new RipplePool(34)};
    renderBackground();window.addEventListener("resize",resizeScene);
  }

  function wireInput(){
    const stage=state.app.stage;stage.eventMode="static";stage.hitArea=screen();
    stage.on("pointerdown",e=>handlePointerDown(e.global.x,e.global.y));
  }

  function handlePointerDown(x,y){
    const t=now(),gap=state.lastTapAt?t-state.lastTapAt:9999;state.lastTapAt=t;state.totalTaps++;
    if(gap<420)state.streak=Math.min(40,state.streak+1);else state.streak=1;
    if(t-state.lastDirectHitAt>760)state.hitCombo=0;
    const objectTap=state.objectRuntime?state.objectRuntime.handleTap(x,y,{streak:state.streak}):null;

    const active=activePets();let closest=null,closestMeasure=null;
    for(const pet of active){const m=pet.measureTap(x,y);if(!closestMeasure||m.distance<closestMeasure.distance){closest=pet;closestMeasure=m;}}
    const results=[];
    for(const pet of active)results.push(pet.handleTap(x,y,{streak:state.streak,primary:pet===closest}));
    const primary=closest?results.find(r=>r.id===closest.id):null;
    const impact=primary?primary.impact:0;

    if(primary&&primary.reaction==="HIT"){
      state.directHits++;state.hitCombo=Math.min(9,state.hitCombo+1);state.lastDirectHitAt=t;if(state.objectRuntime)state.objectRuntime.unlockForHits(state.directHits);
      state.toyEnergy+=.29+.09*Math.min(3,state.hitCombo)+Math.min(.12,state.streak*.006);
      softBloom(primary.x,primary.y,FX_PALETTES[primary.type][0],1.0+.08*state.hitCombo);hitFx(primary,x,y);comboHalo(primary);spreadPanic(primary,.76);cameraKick(primary.x-x,primary.y-y,.72+state.hitCombo*.07);screenFlash(FX_PALETTES[primary.type][0],.10+.025*state.hitCombo);
      if(state.hitCombo>=3&&state.hitCombo%3===0&&t-state.lastComboBlastAt>260){state.lastComboBlastAt=t;comboBlast(primary);}
      if(state.hitCombo>=5&&activePets().length>=2&&t-state.lastFrenzyAt>5200)startPinballFrenzy(primary,"HIT_CHAIN");
      if(window.GameHaptics)window.GameHaptics.perform("IMPACT",clamp(.52+state.hitCombo*.055,.52,.88));
      if(state.audio)state.audio.playJackpot(primary.type==="SPARK"?"GLITCH":"ORGANIC",Math.min(4,1+Math.floor(state.hitCombo/2)));
    }else if(primary&&impact>=.55){
      state.nearMisses++;state.lastNearAt=t;state.toyEnergy+=.07+impact*.07;
      softBloom(x,y,FX_PALETTES[primary.type][1],.30+impact*.32);nearMissFx(x,y,primary);if(impact>=.76)grazeWhipFx(x,y,primary);spreadPanic(primary,.28+impact*.25);cameraKick(primary.x-x,primary.y-y,.16+impact*.12);
      if(impact>=.84)state.toyEnergy+=.035;
      if(window.GameHaptics)window.GameHaptics.perform("SOFT_TAP",.18+impact*.18);
      if(state.audio)state.audio.playClick(primary.type==="SPARK"?"GLITCH":"ORGANIC",.20+impact*.20,Math.max(state.streak,Math.round(impact*16)));
    }else{
      airTapFx(x,y,primary&&impact>.08?primary.type:"NEUTRAL",impact);maybeTauntOnMiss(x,y,primary,impact,t);
      if(window.GameHaptics&&!objectTap?.triggered)window.GameHaptics.perform("SOFT_TAP",.12);
      if(state.audio)state.audio.playClick("ORGANIC",.12,Math.min(8,state.streak));
    }

    maybeTriggerEnergyEvent(primary||closest,{x,y});
  }

  function handlePetReaction(){/* game.js owns escalation; pet runtime owns immediate local reaction */}

  function handleWallBounce(e){
    if(!e||e.speed<155)return;wallImpactFx(e.x,e.y,e.type,e.speed);cameraKick(0,0,clamp(e.speed/900,.10,.34));
    if(e.speed>360){state.toyEnergy+=.035;const source=state.pets.find(p=>p.id===e.id);if(source)spreadPanic({id:e.id,x:e.x,y:e.y,impact:.6,panic:e.panic||.4},.28);}
  }

  function handleObjectEvent(e){
    if(!e)return;state.objectEvents++;const p=clamp(Number(e.power)||.5,.15,1);
    if(e.type==="BUMPER_HIT"||e.type==="BUMPER_TAP"){
      if(e.type==="BUMPER_HIT")state.objectHits++;state.toyEnergy+=e.type==="BUMPER_HIT"?.055:.018;bumperObjectFx(e.x,e.y,p);if(e.type==="BUMPER_TAP")radialObjectPush(e.x,e.y,.18+p*.26);cameraKick(0,0,.16+p*.28);
      if(e.type==="BUMPER_HIT"&&window.GameHaptics)window.GameHaptics.perform("IMPACT",.36+p*.34);
    }else if(e.type==="GIFT_OPEN"){
      state.objectHits++;state.toyEnergy+=.15+p*.08;giftObjectFx(e.x,e.y,p);giftReward(e);cameraKick(0,0,.34+p*.28);screenFlash(0xffc8e8,.06+p*.05);
      if(e.source==="PET"&&window.GameHaptics)window.GameHaptics.perform("IMPACT",.44+p*.30);
    }else if(e.type==="BALLOON_POP"){
      state.objectHits++;state.toyEnergy+=.10+p*.06;balloonObjectFx(e.x,e.y,p);radialObjectPush(e.x,e.y,.40+p*.35);cameraKick(0,-1,.20+p*.24);
      if(e.source==="PET"&&window.GameHaptics)window.GameHaptics.perform("IMPACT",.34+p*.24);
    }else if(e.type==="SPRING_BOING"||e.type==="SPRING_TAP"){
      if(e.type==="SPRING_BOING")state.objectHits++;state.toyEnergy+=e.type==="SPRING_BOING"?.05:.012;springObjectFx(e.x,e.y,p);
      if(e.type==="SPRING_TAP")springTapAssist(e.x,e.y,p);
      if(e.type==="SPRING_BOING"&&window.GameHaptics)window.GameHaptics.perform("SOFT_TAP",.30+p*.20);
    }else if(e.type==="OBJECT_UNLOCK"||e.type==="OBJECT_RESPAWN"){
      objectUnlockFx(e.x,e.y,e.objectType,p);
    }
  }

  function giftReward(e){
    const inactive=state.pets.filter(p=>!p.isActive());
    if(inactive.length&&Math.random()<.62){
      const pet=inactive[0],a=-Math.PI*.5+(Math.random()-.5)*1.5,spd=330+Math.random()*150;pet.activateAt(e.x,e.y,{panic:.64,animation:"STARTLED",mode:"PANIC"});pet.launch(Math.cos(a)*spd,Math.sin(a)*spd-90,"PANIC");
      eventBurst(e.x,e.y,pet.type,"SPLIT",.82);
    }else if(state.objectRuntime&&state.objectRuntime.activateType("BALLOON",{x:e.x,y:e.y-120})){
      state.toyEnergy+=.035;
    }else{
      for(const pet of activePets()){const pos=pet.position();if(!pos)continue;const d=Math.hypot(pos.x-e.x,pos.y-e.y);if(d<290)pet.nudgeFrom(e.x,e.y,clamp((1-d/290)*.52,.08,.52));}
    }
  }

  function radialObjectPush(x,y,power){
    for(const pet of activePets()){const pos=pet.position();if(!pos)continue;const d=Math.hypot(pos.x-x,pos.y-y);if(d>330)continue;pet.nudgeFrom(x,y,clamp((1-d/330)*power,.06,.78));}
  }

  function springTapAssist(x,y,power){
    let pick=null,best=Infinity;for(const pet of activePets()){const pos=pet.position();if(!pos)continue;const d=Math.hypot(pos.x-x,pos.y-y);if(d<best){best=d;pick=pet;}}
    if(pick&&best<190){const v=pick.velocity();pick.launch((v.vx||0)*.35+(Math.random()-.5)*80,-(430+power*170),"PANIC");}
  }

  function spreadPanic(source,multiplier){
    if(!source)return;const strength=clamp((source.impact||.5)*(.38+(source.panic||0)*.42)*(Number(multiplier)||1),.05,.82);
    for(const pet of activePets()){
      if(pet.id===source.id)continue;const r=pet.receiveGroupPanic(source.x,source.y,strength);if(r&&r.impact>.035)tinyReactionSpark(r.x,r.y,r.type,r.impact);
    }
  }

  function maybeTriggerEnergyEvent(source,point){
    const t=now();if(state.toyEnergy<state.nextEventEnergy||t-state.lastEventAt<900)return;
    state.toyEnergy=Math.max(.12,state.toyEnergy-state.nextEventEnergy*.78);state.nextEventEnergy=.82+Math.random()*.38;state.lastEventAt=t;
    triggerToyEvent(source,point);
  }

  function triggerToyEvent(source,point){
    const active=activePets(),inactive=state.pets.filter(p=>!p.isActive());state.eventCount++;
    let kind;
    if(active.length===1)kind="SPLIT";
    else if(active.length===2)kind=Math.random()<.66?"SPLIT":"BOUNCE_PARTY";
    else if(active.length===3){const r=Math.random();kind=r<.48?"SPLIT":(r<.73?"PINBALL":"BOUNCE_PARTY");}
    else if(active.length>=4){const r=Math.random();kind=r<.36?"MERGE":(r<.62?"PINBALL":(inactive.length?"SWARM":"BOUNCE_PARTY"));}
    else kind="BOUNCE_PARTY";
    if(kind==="SPLIT"&&!inactive.length)kind="MERGE";
    const origin=source&&Number.isFinite(source.x)?{x:source.x,y:source.y}:{x:point.x,y:point.y};
    if(kind==="SPLIT")splitEvent(source,origin);
    else if(kind==="MERGE")mergeEvent(source,origin);
    else if(kind==="SWARM")swarmEvent(origin);
    else if(kind==="PINBALL")startPinballFrenzy(source||origin,"ENERGY_EVENT");
    else bounceParty(origin);
  }

  function splitEvent(source,origin){
    const pet=state.pets.find(p=>!p.isActive());if(!pet)return bounceParty(origin);
    const sourcePet=source&&source.id?state.pets.find(p=>p.id===source.id):activePets()[0];
    if(sourcePet){
      const firstSplit=activePets().length===1;
      sourcePet.setSizeMultiplier(firstSplit?.86:.94,firstSplit?0:850);
      sourcePet.forceAnimation("STARTLED",420);
    }
    pet.activateAt(origin.x+(Math.random()-.5)*20,origin.y+(Math.random()-.5)*15,{panic:.72,animation:"STARTLED",mode:"PANIC"});
    const a=Math.random()*Math.PI*2,spd=390+Math.random()*130;pet.launch(Math.cos(a)*spd,Math.sin(a)*spd-150,"PANIC");
    if(sourcePet)sourcePet.launch(-Math.cos(a)*spd*.72,-Math.sin(a)*spd*.50-100,"PANIC");
    eventBurst(origin.x,origin.y,pet.type,"SPLIT",1);screenFlash(FX_PALETTES[pet.type][1],.16);cameraKick(Math.cos(a),Math.sin(a),.78);
    if(window.GameHaptics)window.GameHaptics.perform("IMPACT",.76);
  }

  function bounceParty(origin){
    const pets=activePets();if(!pets.length)return;
    for(let i=0;i<pets.length;i++){const a=Math.PI*2*i/pets.length+(Math.random()-.5)*.55,spd=300+Math.random()*220;pets[i].launch(Math.cos(a)*spd,Math.sin(a)*spd-120,"PANIC");}
    eventBurst(origin.x,origin.y,pets[0].type,"BOUNCE",.88);screenFlash(0xffffff,.09);cameraKick(0,0,.58);
  }

  function swarmEvent(origin){
    const inactive=state.pets.filter(p=>!p.isActive());let index=0;
    for(const pet of inactive.slice(0,2)){
      const a=Math.PI*2*(index+++.3)/Math.max(2,inactive.length),spd=360+Math.random()*150;pet.activateAt(origin.x,origin.y,{panic:.82,animation:"PANIC",mode:"PANIC"});pet.launch(Math.cos(a)*spd,Math.sin(a)*spd-120,"PANIC");
    }
    for(const pet of activePets())pet.synchronize("SCATTER",origin);
    eventBurst(origin.x,origin.y,"NEUTRAL","SWARM",1);cameraKick(0,0,.72);screenFlash(0xffd6f2,.12);
  }

  function mergeEvent(source,origin){
    const active=activePets();if(active.length<3)return bounceParty(origin);
    const lead=source&&source.id?state.pets.find(p=>p.id===source.id&&p.isActive()):active[0];
    const hidden=active.filter(p=>p!==lead).slice(0,Math.min(2,active.length-2));if(!hidden.length)return bounceParty(origin);
    const leadPos=lead.position();for(const p of hidden){p.deactivate();}
    lead.setSizeMultiplier(1.58,1550);lead.launch((Math.random()-.5)*120,-180,"CELEBRATE");lead.forceAnimation("CELEBRATE",900);
    eventBurst(leadPos.x,leadPos.y,lead.type,"MERGE",1);screenFlash(FX_PALETTES[lead.type][0],.18);cameraKick(0,0,.90);
    state.pending.push({at:now()+1450,type:"SPLIT_BACK",leadId:lead.id,petIds:hidden.map(p=>p.id)});
  }

  function processPending(t){
    for(let i=state.pending.length-1;i>=0;i--){const e=state.pending[i];if(t<e.at)continue;state.pending.splice(i,1);
      if(e.type==="SPLIT_BACK"){
        const lead=state.pets.find(p=>p.id===e.leadId),pos=lead&&lead.position();if(!lead||!pos)continue;lead.setSizeMultiplier(.92,600);
        const ids=e.petIds||[];for(let j=0;j<ids.length;j++){const pet=state.pets.find(p=>p.id===ids[j]);if(!pet)continue;const a=Math.PI*2*(j+1)/(ids.length+1)+(Math.random()-.5)*.5,spd=390+Math.random()*110;pet.activateAt(pos.x,pos.y,{panic:.78,animation:"STARTLED",mode:"PANIC"});pet.launch(Math.cos(a)*spd,Math.sin(a)*spd-150,"PANIC");}
        eventBurst(pos.x,pos.y,lead.type,"SPLIT",1);screenFlash(0xffffff,.12);cameraKick(0,0,.74);
      }
    }
  }

  function resolveCollisions(){
    const pets=activePets(),t=now();
    for(let i=0;i<pets.length;i++)for(let j=i+1;j<pets.length;j++){
      const a=pets[i],b=pets[j],pa=a.position(),pb=b.position();if(!pa||!pb)continue;
      const dx=pb.x-pa.x,dy=pb.y-pa.y,d=Math.hypot(dx,dy),min=a.collisionRadius()+b.collisionRadius();if(d>=min||d<=0)continue;
      const key=a.id+"|"+b.id,last=state.lastBumps.get(key)||0;if(t-last<250)continue;state.lastBumps.set(key,t);
      const va=a.velocity(),vb=b.velocity(),relative=Math.hypot(va.vx-vb.vx,va.vy-vb.vy),force=clamp((min-d)/Math.max(1,min)+relative/850+.18,.22,.92);
      let chain=0;if(relative>210){chain=t-state.lastCollisionChainAt<900?Math.min(9,state.collisionChain+1):1;state.collisionChain=chain;state.lastCollisionChainAt=t;}
      a.nudgeFrom(pb.x,pb.y,clamp(force+chain*.035,.22,1));b.nudgeFrom(pa.x,pa.y,clamp(force+chain*.035,.22,1));const x=(pa.x+pb.x)/2,y=(pa.y+pb.y)/2;collisionFx(x,y,a.type,b.type,force,relative,chain);
      if(relative>230){state.toyEnergy+=.025+chain*.006;cameraKick(dx,dy,.10+force*.22+chain*.018);}
      if(relative>380&&t-state.lastCollisionAt>420){state.lastCollisionAt=t;spreadPanic({id:a.id,x,y,impact:.58+chain*.03,panic:.5},.35+chain*.025);}
      if(chain>=3&&relative>300&&t-state.lastFrenzyAt>5000)startPinballFrenzy({id:a.id,type:a.type,x,y},"COLLISION_CHAIN");
    }
  }

  function airTapFx(x,y,type,impact){
    const style=impact>.08?type:"NEUTRAL",colors=FX_PALETTES[style]||FX_PALETTES.NEUTRAL,count=3+Math.floor(Math.min(.3,impact)*9);
    for(let i=0;i<count;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/count+(Math.random()-.5),spd=35+Math.random()*55,c=colors[i%colors.length];drawFxShape(g,style,i,c,.62,.2);g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*spd,Math.sin(a)*spd-18,.20+Math.random()*.08,40,3,.95));}
    const r=state.pools.ripples.acquire(state.fxLayer);if(r){r.circle(0,0,6).stroke({color:colors[0],width:1.4,alpha:.28});r.x=x;r.y=y;state.ripples.push({g:r,life:.20,max:.20,growth:2.2,alpha:.28});}
  }

  function nearMissFx(x,y,primary){
    const p=clamp(primary.impact,0,1),colors=FX_PALETTES[primary.type]||FX_PALETTES.NEUTRAL;
    const dx=primary.x-x,dy=primary.y-y,g=state.pools.particles.acquire(state.fxLayer);if(g){g.moveTo(0,0).lineTo(dx,dy).stroke({color:colors[1],width:1.5+p*2.2,alpha:.18+p*.34});g.x=x;g.y=y;state.particles.push({g,vx:0,vy:0,life:.15,max:.15,gravity:0,spin:0,scaleDecay:0});}
    const count=7+Math.floor(p*9);for(let i=0;i<count;i++){const q=state.pools.particles.acquire(state.fxLayer);if(!q)break;const a=Math.atan2(dy,dx)+(Math.random()-.5)*1.6,spd=70+Math.random()*120;drawFxShape(q,primary.type,i,colors[i%colors.length],.72+p*.36,p);q.x=x;q.y=y;state.particles.push(particle(q,Math.cos(a)*spd,Math.sin(a)*spd-15,.24+Math.random()*.08,55,5,.78));}
  }

  function hitFx(primary,tapX,tapY){
    const combo=state.hitCombo,p=clamp(.78+combo*.055,0,1.25),colors=FX_PALETTES[primary.type]||FX_PALETTES.PEACH,count=Math.min(52,24+combo*4);
    for(let i=0;i<count;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/count+(Math.random()-.5)*.45,spd=160+Math.random()*260+combo*22,c=colors[i%colors.length];drawFxShape(g,primary.type,i,c,1.05+p*.70,p);g.x=primary.x;g.y=primary.y;state.particles.push(particle(g,Math.cos(a)*spd,Math.sin(a)*spd-65,.32+Math.random()*.22,115,8,.60));}
    rayBurst(primary.x,primary.y,primary.type,colors,combo);shockRing(primary.x,primary.y,colors[0],1+combo*.07);shockRing(tapX,tapY,colors[1],.55);
  }

  function rayBurst(x,y,type,colors,combo){
    const n=10+Math.min(6,combo);for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/n,s=13+Math.random()*15+combo*1.2,c=colors[(i+1)%colors.length];g.moveTo(-1.3,-s).lineTo(1.3,-s).lineTo(1.3,s).lineTo(-1.3,s).closePath().fill({color:c,alpha:.92});g.rotation=a+Math.PI/2;g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*(220+Math.random()*180),Math.sin(a)*(220+Math.random()*180),.28+combo*.01,0,0,.36));}
  }

  function shockRing(x,y,color,power){const r=state.pools.ripples.acquire(state.fxLayer);if(!r)return;r.circle(0,0,12+power*7).stroke({color,width:3+power*2.5,alpha:.78});r.x=x;r.y=y;state.ripples.push({g:r,life:.34,max:.34,growth:4.5+power*2.4,alpha:.78});}

  function wallImpactFx(x,y,type,speed){const colors=FX_PALETTES[type]||FX_PALETTES.NEUTRAL,n=5+Math.min(10,Math.floor(speed/80));for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.random()*Math.PI*2,spd=55+Math.random()*100;drawFxShape(g,type,i,colors[i%colors.length],.68+speed/900,.5);g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*spd,Math.sin(a)*spd-15,.20+Math.random()*.12,65,5,.85));}}

  function collisionFx(x,y,a,b,force,relative,chain){chain=Math.max(0,Number(chain)||0);const ca=FX_PALETTES[a]||FX_PALETTES.NEUTRAL,cb=FX_PALETTES[b]||FX_PALETTES.NEUTRAL,n=8+Math.floor(force*10)+Math.min(10,chain*2);for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const ang=Math.PI*2*i/n,style=i%2?a:b,c=(i%2?ca:cb)[i%4],spd=85+force*140+Math.min(100,relative*.18);drawFxShape(g,style,i,c,.72+force*.55,force);g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(ang)*spd,Math.sin(ang)*spd-30,.22+force*.12,80,6,.75));}if(force>.55)shockRing(x,y,0xffffff,.42+force*.35+chain*.05);if(chain>=2)collisionChainAccent(x,y,a,b,chain);}


  function comboHalo(primary){
    const combo=Math.max(1,state.hitCombo),colors=FX_PALETTES[primary.type]||FX_PALETTES.PEACH,n=Math.min(6,2+Math.floor(combo/2));
    for(let i=0;i<n;i++){
      const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=-Math.PI*.85+(i/Math.max(1,n-1))*Math.PI*.70,r=46+combo*2.2;
      drawFxShape(g,primary.type,i,colors[(i+1)%colors.length],.62+combo*.035,.6);g.x=primary.x+Math.cos(a)*r;g.y=primary.y+Math.sin(a)*r-24;
      state.particles.push(particle(g,Math.cos(a)*18,-26-Math.random()*12,.24+combo*.008,0,4,.82));
    }
  }

  function comboBlast(primary){
    const colors=FX_PALETTES[primary.type]||FX_PALETTES.PEACH,combo=Math.max(3,state.hitCombo);state.toyEnergy+=.08+.01*Math.min(combo,8);
    shockRing(primary.x,primary.y,colors[0],1.35+combo*.05);shockRing(primary.x,primary.y,0xffffff,.92+combo*.04);
    for(const pet of activePets()){
      if(pet.id===primary.id)continue;const pos=pet.position();if(!pos)continue;const d=Math.hypot(pos.x-primary.x,pos.y-primary.y);if(d>360)continue;
      const f=clamp((1-d/360)*(.46+combo*.035),.08,.72);pet.nudgeFrom(primary.x,primary.y,f);
    }
    cameraKick(0,0,.42+combo*.035);screenFlash(colors[1],.055+combo*.008);
    if(window.GameHaptics)window.GameHaptics.perform("IMPACT",clamp(.46+combo*.035,.46,.78));
  }

  function grazeWhipFx(x,y,primary){
    const colors=FX_PALETTES[primary.type]||FX_PALETTES.NEUTRAL,dx=primary.x-x,dy=primary.y-y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len;
    for(let i=-1;i<=1;i++){
      const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const off=i*7;
      g.moveTo(nx*off,ny*off).lineTo(dx*.78+nx*off,dy*.78+ny*off).stroke({color:colors[(i+2)%colors.length],width:1.2+primary.impact*1.8,alpha:.18+primary.impact*.30});g.x=x;g.y=y;
      state.particles.push({g,vx:dx*.10,vy:dy*.10,life:.12,max:.12,gravity:0,spin:0,scaleDecay:.12});
    }
    const pet=state.pets.find(p=>p.id===primary.id);if(pet)pet.nudgeFrom(x,y,.18+primary.impact*.20);
  }

  function maybeTauntOnMiss(x,y,primary,impact,t){
    if(impact>.10||t-state.lastTauntAt<2400||t-state.lastDirectHitAt<900||Math.random()>.18)return;
    const pets=activePets();if(!pets.length)return;let pick=null,best=Infinity;
    for(const pet of pets){const pos=pet.position();if(!pos)continue;const d=Math.hypot(pos.x-x,pos.y-y);if(d<best){best=d;pick=pet;}}
    if(!pick)return;state.lastTauntAt=t;
    if(Math.random()<.55)pick.celebrate();else pick.synchronize("HOP",{x,y});
    const pos=pick.position();if(pos)tinyReactionSpark(pos.x,pos.y,pick.type,.55);
  }

  function startPinballFrenzy(source,reason){
    const t=now();if(t-state.lastFrenzyAt<4200)return false;const pets=activePets();if(pets.length<2)return false;
    state.lastFrenzyAt=t;state.frenzyUntil=t+1850;state.frenzyPower=1;state.nextFrenzyKickAt=t+240;
    const origin=source&&Number.isFinite(source.x)?source:{x:screen().width*.5,y:screen().height*.5},base=Math.random()*Math.PI*2;
    for(let i=0;i<pets.length;i++){const a=base+Math.PI*2*i/pets.length+(Math.random()-.5)*.55,spd=410+Math.random()*180;pets[i].launch(Math.cos(a)*spd,Math.sin(a)*spd-90,"PANIC");}
    eventBurst(origin.x,origin.y,source&&source.type||"NEUTRAL","PINBALL",1);screenFlash(0xffffff,.10);cameraKick(0,0,.82);
    if(window.GameHaptics)window.GameHaptics.perform("IMPACT",.74);return true;
  }

  function updateFrenzy(t){
    if(!state.frenzyUntil||t>=state.frenzyUntil){if(state.frenzyPower>0){state.frenzyPower=0;const pets=activePets();if(pets.length){const pick=pets[Math.floor(Math.random()*pets.length)];pick&&pick.celebrate();}}return;}
    const remain=clamp((state.frenzyUntil-t)/1850,0,1);state.frenzyPower=remain;
    if(t>=state.nextFrenzyKickAt){state.nextFrenzyKickAt=t+240+Math.random()*100;const pets=activePets();if(pets.length){const pet=pets[Math.floor(Math.random()*pets.length)],v=pet.velocity();if(v.speed<360){const a=Math.random()*Math.PI*2,spd=350+Math.random()*170;pet.launch(Math.cos(a)*spd,Math.sin(a)*spd-70,"PANIC");}}}
    for(const pet of activePets()){const v=pet.velocity();if(v.speed>250)frenzyTrail(pet,clamp(v.speed/650,.35,1));}
  }

  function frenzyTrail(pet,intensity){
    const t=now(),last=state.lastTrails.get(pet.id)||0;if(t-last<72)return;state.lastTrails.set(pet.id,t);const pos=pet.position(),v=pet.velocity();if(!pos)return;
    const colors=FX_PALETTES[pet.type]||FX_PALETTES.NEUTRAL,len=Math.max(1,Math.hypot(v.vx,v.vy)),ux=-v.vx/len,uy=-v.vy/len;
    for(let i=0;i<2;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;drawFxShape(g,pet.type,i,colors[(i+1)%colors.length],.55+intensity*.38,intensity);g.x=pos.x+ux*(18+i*10)+(Math.random()-.5)*8;g.y=pos.y+uy*(18+i*10)+(Math.random()-.5)*8;state.particles.push(particle(g,ux*(45+intensity*55),uy*(45+intensity*55),.18,0,4,1.20));}
  }

  function collisionChainAccent(x,y,a,b,chain){
    const colors=[...(FX_PALETTES[a]||FX_PALETTES.NEUTRAL),...(FX_PALETTES[b]||FX_PALETTES.NEUTRAL)],n=Math.min(12,3+chain*2);
    for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const ang=Math.PI*2*i/n,c=colors[i%colors.length],s=8+chain*2;g.moveTo(0,-s).lineTo(s*.45,0).lineTo(0,s).lineTo(-s*.45,0).closePath().fill({color:c,alpha:.88});g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(ang)*(120+chain*25),Math.sin(ang)*(120+chain*25),.20+chain*.012,0,6,.72));}
  }

  function eventBurst(x,y,type,kind,power){
    const style=type==="NEUTRAL"?"PEACH":type,colors=FX_PALETTES[style]||FX_PALETTES.PEACH,n=kind==="SWARM"?52:(kind==="PINBALL"?58:40);
    for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/n+(Math.random()-.5)*.65,spd=150+Math.random()*280;drawFxShape(g,style,i,colors[i%colors.length],1.0+Math.random()*.8,power);g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*spd,Math.sin(a)*spd-65,.34+Math.random()*.22,100,8,.58));}
    shockRing(x,y,colors[0],1.2);shockRing(x,y,colors[1],.82);
  }

  function bumperObjectFx(x,y,power){
    const colors=[0xd98791,0xe7bf63,0xffffff],n=12+Math.floor(power*10);shockRing(x,y,colors[0],.75+power*.75);
    for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/n,s=5+power*5;g.moveTo(0,-s).lineTo(s*.55,-s*.25).lineTo(s,0).lineTo(s*.55,s*.25).lineTo(0,s).lineTo(-s*.55,s*.25).lineTo(-s,0).lineTo(-s*.55,-s*.25).closePath().fill({color:colors[i%3],alpha:.90});g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*(115+power*180),Math.sin(a)*(115+power*180),.24+power*.12,0,7,.72));}
  }

  function giftObjectFx(x,y,power){
    const colors=[0x9d90bd,0xe99592,0xe7bf63,0xffffff],n=26+Math.floor(power*16);shockRing(x,y,colors[1],1.0+power*.45);
    for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*Math.random(),spd=90+Math.random()*250+power*80,c=colors[i%colors.length],w=3+Math.random()*5,h=7+Math.random()*10;g.roundRect(-w*.5,-h*.5,w,h,1.5).fill({color:c,alpha:.92});g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*spd,Math.sin(a)*spd-120-Math.random()*100,.42+Math.random()*.24,180,10,.35));}
  }

  function balloonObjectFx(x,y,power){
    const colors=[0x79a8be,0xd8a0b4,0xffffff,0xe7bf63],n=18+Math.floor(power*14);shockRing(x,y,colors[0],.85+power*.55);
    for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/n+(Math.random()-.5)*.35,spd=85+Math.random()*170,c=colors[i%colors.length],r=2.5+Math.random()*5+power*2;g.circle(0,0,r).fill({color:c,alpha:.72}).stroke({color:0xffffff,width:1,alpha:.35});g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*spd,Math.sin(a)*spd-45,.34+Math.random()*.18,-25,4,.60));}
  }

  function springObjectFx(x,y,power){
    const colors=[0x7fc9b5,0x79a8be,0xffffff],n=10+Math.floor(power*8);for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const spread=(i-(n-1)/2)*7,c=colors[i%3],h=18+Math.random()*24+power*18;g.roundRect(-2,-h,4,h,2).fill({color:c,alpha:.78});g.x=x+spread;g.y=y;state.particles.push(particle(g,spread*.9,-(150+Math.random()*160+power*90),.26+Math.random()*.12,150,0,.72));}shockRing(x,y,colors[0],.55+power*.42);
  }

  function objectUnlockFx(x,y,type,power){
    const map={BUMPER:0xd98791,GIFT:0x9d90bd,BALLOON:0x79a8be,SPRING:0x7fc9b5},c=map[type]||0xffffff;shockRing(x,y,c,.72+power*.35);
    for(let i=0;i<8;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/8,s=7+power*4;g.moveTo(0,-s).lineTo(s*.36,-s*.36).lineTo(s,0).lineTo(s*.36,s*.36).lineTo(0,s).lineTo(-s*.36,s*.36).lineTo(-s,0).lineTo(-s*.36,-s*.36).closePath().fill({color:c,alpha:.82});g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*110,Math.sin(a)*110-35,.28,60,5,.76));}
  }

  function tinyReactionSpark(x,y,type,intensity){if(Math.random()>.55)return;const colors=FX_PALETTES[type]||FX_PALETTES.NEUTRAL,g=state.pools.particles.acquire(state.fxLayer);if(!g)return;drawFxShape(g,type,1,colors[1],.70+intensity*1.5,intensity);g.x=x;g.y=y;state.particles.push(particle(g,(Math.random()-.5)*45,-35,.20,0,3,1.1));}

  function particle(g,vx,vy,life,gravity,spin,scaleDecay){return {g,vx,vy,life,max:life,gravity:gravity||0,spin:spin||0,scaleDecay:scaleDecay||0};}

  function drawFxShape(g,style,index,color,size,power){
    const alpha=.72+Math.min(.22,(Number(power)||0)*.18);
    if(style==="PEACH"){
      const s=5.1*size;
      if(index%3===0){g.roundRect(-s*.72,-s*.34,s*1.44,s*.68,s*.32).fill({color,alpha});g.ellipse(-s*.20,-s*.16,s*.30,s*.10).fill({color:0xffffff,alpha:.28});}
      else if(index%3===1){g.moveTo(0,-s).lineTo(s*.58,0).lineTo(0,s).lineTo(-s*.58,0).closePath().fill({color,alpha:.90});g.moveTo(0,-s*.62).lineTo(s*.25,0).lineTo(0,s*.18).lineTo(-s*.25,0).closePath().fill({color:0xffffff,alpha:.18});}
      else{g.ellipse(0,0,s*.78,s*.44).fill({color,alpha:.74});g.ellipse(-s*.18,-s*.12,s*.30,s*.10).fill({color:0xffffff,alpha:.24});}
    }else if(style==="SPARK"){
      const s=5.8*size;
      if(index%2===0){g.moveTo(-s*.22,-s).lineTo(s*.50,-s*.16).lineTo(s*.08,-s*.10).lineTo(s*.34,s).lineTo(-s*.58,s*.10).lineTo(-s*.12,s*.03).closePath().fill({color,alpha:.92});}
      else{g.moveTo(0,-s).lineTo(s*.26,-s*.26).lineTo(s,0).lineTo(s*.26,s*.26).lineTo(0,s).lineTo(-s*.26,s*.26).lineTo(-s,0).lineTo(-s*.26,-s*.26).closePath().fill({color,alpha:.88});g.circle(-s*.10,-s*.16,s*.12).fill({color:0xffffff,alpha:.30});}
    }else if(style==="MINT"){
      const s=5.3*size;
      if(index%2===0){g.moveTo(0,-s).bezierCurveTo(s*.72,-s*.44,s*.72,s*.35,0,s).bezierCurveTo(-s*.72,s*.35,-s*.72,-s*.44,0,-s).fill({color,alpha:.82});g.ellipse(-s*.13,-s*.25,s*.20,s*.08).fill({color:0xffffff,alpha:.24});}
      else{g.roundRect(-s*.55,-s*.30,s*1.10,s*.60,s*.28).fill({color,alpha:.80});}
    }else{
      const s=4.8*size;g.moveTo(0,-s).lineTo(s*.62,0).lineTo(0,s).lineTo(-s*.62,0).closePath().fill({color,alpha:.76});
    }
  }

  function softBloom(x,y,color,power){
    const g=state.pools.particles.acquire(state.fxLayer);if(!g)return;const p=clamp(Number(power)||.5,.15,1.6),r=26+p*22;
    try{g.blendMode="add";}catch(_){}
    g.circle(0,0,r).fill({color,alpha:.045+.035*p});g.circle(0,0,r*.56).fill({color:0xffffff,alpha:.035+.020*p});g.x=x;g.y=y;
    state.particles.push(particle(g,0,0,.18+Math.min(.08,p*.03),0,0,-1.10));
  }

  function cameraKick(dx,dy,power){const p=clamp(Number(power)||.2,0,1);const len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len||((Math.random()<.5)?-1:1),uy=dy/len||0;state.cameraVx+=ux*(5+14*p)+(Math.random()-.5)*8*p;state.cameraVy+=uy*(4+11*p)+(Math.random()-.5)*7*p;state.cameraVr+=(Math.random()-.5)*.018*p;}
  function screenFlash(color,alpha){state.flashColor=color||0xffffff;state.flashAlpha=Math.max(state.flashAlpha,clamp(Number(alpha)||.08,0,.28));}

  function renderBackground(){
    if(!state.bg||!state.toys||!state.bgSprite)return;const s=screen(),g=state.bg,t=state.toys,b=safeBounds(),art=window.PremiumToyArt;
    if(state.bgTexture){try{state.bgTexture.destroy(true);}catch(_){}}
    state.bgTexture=art&&art.makeSceneTexture?art.makeSceneTexture(s.width,s.height):PIXI.Texture.WHITE;
    state.bgSprite.texture=state.bgTexture;state.bgSprite.position.set(0,0);state.bgSprite.width=s.width;state.bgSprite.height=s.height;
    g.clear();t.clear();

    // Collector-toy display frame: muted materials, soft bevels, no classroom-grid decoration.
    g.roundRect(b.left-30,b.top-30,(b.right-b.left)+60,(b.bottom-b.top)+60,52).fill({color:0x0d0b15,alpha:.34});
    g.roundRect(b.left-25,b.top-25,(b.right-b.left)+50,(b.bottom-b.top)+50,50).fill({color:0x2a2338,alpha:.54}).stroke({color:0xf4e8dd,width:1.2,alpha:.10});
    g.roundRect(b.left-12,b.top-12,(b.right-b.left)+24,(b.bottom-b.top)+24,42).fill({color:0x30283f,alpha:.34}).stroke({color:0xffffff,width:1,alpha:.055});

    const w=b.right-b.left,h=b.bottom-b.top;
    // Floor plinth and side cushions use desaturated collector-toy colors.
    t.roundRect(b.left-22,b.bottom-72,w+44,90,34).fill({color:0x211a2d,alpha:.94}).stroke({color:0xf4e8dd,width:1.1,alpha:.08});
    t.roundRect(b.left+14,b.bottom-62,w-28,58,24).fill({color:0x3a3048,alpha:.58});
    t.roundRect(b.left-26,b.top+h*.26,48,h*.34,24).fill({color:0x4a3544,alpha:.30}).stroke({color:0xe99592,width:1.1,alpha:.12});
    t.roundRect(b.right-22,b.top+h*.18,46,h*.36,23).fill({color:0x29413f,alpha:.26}).stroke({color:0x7fc9b5,width:1.1,alpha:.12});

    // Soft display ledges hint at space without becoming gameplay obstacles.
    t.roundRect(b.left+w*.12,b.top+h*.17,w*.28,12,6).fill({color:0xf4e8dd,alpha:.055});
    t.roundRect(b.left+w*.62,b.top+h*.72,w*.25,12,6).fill({color:0x79a8be,alpha:.055});
    t.ellipse(b.left+w*.50,b.top+h*.48,w*.32,h*.13).fill({color:0x9d90bd,alpha:.025});
  }

  function safeBounds(){const s=screen(),padX=Math.max(72,s.width*.11),padTop=Math.max(72,state.safe.top+54),padBottom=Math.max(92,state.safe.bottom+76);return {left:padX,top:padTop,right:Math.max(padX+1,s.width-padX),bottom:Math.max(padTop+1,s.height-padBottom)};}

  function resizeScene(){
    if(!state.app)return;const s=screen();state.app.stage.hitArea=s;
    if(state.world){state.world.pivot.set(s.width/2,s.height/2);state.world.position.set(s.width/2+state.cameraX,s.height/2+state.cameraY);}
    renderBackground();if(state.objectRuntime)state.objectRuntime.resize();for(const pet of state.pets)pet.resize();
  }

  function tick(ticker){
    const dt=Math.min(50,Number(ticker.deltaMS)||16.67),t=now();processPending(t);updateFrenzy(t);if(state.objectRuntime)state.objectRuntime.tick(dt,activePets());resolveCollisions();
    if(t-state.lastTapAt>900){state.streak=Math.max(0,state.streak-dt/500);state.toyEnergy=Math.max(0,state.toyEnergy-dt/18000);}
    updateCamera(dt);updateFx(dt);updateFlash(dt);
    const f=state.frame;f.accMs+=dt;f.frames++;if(f.accMs>=500){f.fps=Math.round(f.frames*1000/f.accMs);f.accMs=0;f.frames=0;}if(DEBUG&&t-f.lastLog>1200){f.lastLog=t;console.log("[PremiumToyArt v16]",diagnostics());}
  }

  function updateCamera(dt){
    state.cameraVx*=Math.pow(.46,dt/16.67);state.cameraVy*=Math.pow(.46,dt/16.67);state.cameraVr*=Math.pow(.34,dt/16.67);
    state.cameraX+=state.cameraVx;state.cameraY+=state.cameraVy;state.cameraX*=Math.pow(.50,dt/16.67);state.cameraY*=Math.pow(.50,dt/16.67);
    state.cameraRot+=state.cameraVr;state.cameraRot*=Math.pow(.42,dt/16.67);
    const s=screen();state.world.position.set(s.width/2+clamp(state.cameraX,-16,16),s.height/2+clamp(state.cameraY,-14,14));state.world.rotation=clamp(state.cameraRot,-.016,.016);
  }

  function updateFx(dt){
    for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.life-=dt/1000;p.vy+=(p.gravity||0)*dt/1000;p.g.x+=p.vx*dt/1000;p.g.y+=p.vy*dt/1000;p.g.rotation+=(p.spin||0)*dt/1000;p.g.alpha=clamp(p.life/p.max,0,1);const q=1-p.life/p.max,scale=Math.max(.05,1-q*(p.scaleDecay||0));p.g.scale.set(scale);if(p.life<=0){state.pools.particles.release(p.g);state.particles.splice(i,1);}}
    for(let i=state.ripples.length-1;i>=0;i--){const r=state.ripples[i];r.life-=dt/1000;const q=1-r.life/r.max;r.g.scale.set(1+q*r.growth);r.g.alpha=clamp(r.life/r.max,0,1)*r.alpha;if(r.life<=0){state.pools.ripples.release(r.g);state.ripples.splice(i,1);}}
  }

  function updateFlash(dt){if(!state.flash)return;state.flashAlpha=Math.max(0,state.flashAlpha-dt/650);const s=screen();state.flash.clear();if(state.flashAlpha>.002)state.flash.rect(0,0,s.width,s.height).fill({color:state.flashColor,alpha:state.flashAlpha});}

  function diagnostics(){return {version:"PREMIUM_TOY_ART_V16",fps:state.frame.fps,totalTaps:state.totalTaps,directHits:state.directHits,nearMisses:state.nearMisses,hitCombo:state.hitCombo,collisionChain:state.collisionChain,frenzy:state.frenzyUntil>now(),toyEnergy:Math.round(state.toyEnergy*100)/100,nextEventEnergy:Math.round(state.nextEventEnergy*100)/100,eventCount:state.eventCount,objectEvents:state.objectEvents,objectHits:state.objectHits,objects:state.objectRuntime?state.objectRuntime.context():[],activePets:activePets().length,pets:state.pets.map(p=>p.context()),particlePool:state.pools&&state.pools.particles.stats(),ripplePool:state.pools&&state.pools.ripples.stats(),aiVoice:false,geminiGameplay:false,immersive:true};}

  function resetGame(){
    for(const p of state.particles)state.pools.particles.release(p.g);state.particles.length=0;for(const r of state.ripples)state.pools.ripples.release(r.g);state.ripples.length=0;
    state.streak=0;state.hitCombo=0;state.totalTaps=0;state.directHits=0;state.nearMisses=0;state.toyEnergy=0;state.objectEvents=0;state.objectHits=0;if(state.objectRuntime)state.objectRuntime.reset();state.nextEventEnergy=.90;state.eventCount=0;state.pending.length=0;state.lastBumps.clear();state.collisionChain=0;state.lastCollisionChainAt=0;state.lastComboBlastAt=0;state.lastFrenzyAt=0;state.frenzyUntil=0;state.frenzyPower=0;state.nextFrenzyKickAt=0;state.lastTauntAt=0;state.lastTrails.clear();
    state.pets.forEach((pet,i)=>{pet.reset(i,state.pets.length);pet.setActive(i===0);});
    const hero=state.pets[0],b=safeBounds();if(hero){hero.setActive(true,{x:(b.left+b.right)/2,y:b.top+(b.bottom-b.top)*.50});hero.setSizeMultiplier(1.08);}
  }

  function receive(msg){try{if(!msg)return;if(msg.op==="safeArea"){state.safe.left=Math.max(0,Number(msg.left)||0);state.safe.top=Math.max(0,Number(msg.top)||0);state.safe.right=Math.max(0,Number(msg.right)||0);state.safe.bottom=Math.max(0,Number(msg.bottom)||0);resizeScene();}else if(msg.op==="reset")resetGame();}catch(e){reportError(e);}}
  function reportError(e){console.error(e);try{A&&A.onRendererError(String(e&&e.message||e));}catch(_){} }

  window.InfiniteClick={receive,diagnostics};window.ToyBoxSpecs=SLOT_SPECS;boot().catch(reportError);
})();
