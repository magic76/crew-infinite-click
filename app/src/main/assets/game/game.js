(() => {
  "use strict";

  const A=window.AndroidGame;
  const DEBUG=!!window.__INFINITE_CLICK_DEBUG__;
  const VERSION="WORLD_MAP_VISIBILITY_V21";
  const PREVIOUS_WORLD_RENDERER="WORLD_RULES_CAST_V20";
  const LEGACY_RENDERER_MARKER="PRODUCTION_ART_WORLD_V19";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>performance.now();
  const CAST_SHEET="sprites/cast-sheet-10.png";
  const CAST_GRID={columns:5,rows:2};
  const SLOT_SPECS=[
    {id:"hero-peach",type:"PEACH",temperament:"SHY",sheet:CAST_SHEET,atlasIndex:0,glowColor:0xf7a0a7,scaleFactor:1.08,initial:{x:.50,y:.56},start:true},
    {id:"sprout-bunny",type:"BUNNY",temperament:"CURIOUS",sheet:CAST_SHEET,atlasIndex:1,glowColor:0xeccfe1,scaleFactor:.92,initial:{x:.26,y:.36},start:true},
    {id:"gold-flame",type:"FLAME",temperament:"TRICKSTER",sheet:CAST_SHEET,atlasIndex:2,glowColor:0xffd768,scaleFactor:.86,initial:{x:.72,y:.32},start:true},
    {id:"cloudy-boo",type:"CLOUD",temperament:"GOOFY",sheet:CAST_SHEET,atlasIndex:3,glowColor:0xc9e4ff,scaleFactor:.92,initial:{x:.17,y:.56},start:true},
    {id:"star-hop",type:"STAR",temperament:"TRICKSTER",sheet:CAST_SHEET,atlasIndex:4,glowColor:0xffea83,scaleFactor:.84,initial:{x:.82,y:.48},start:true},
    {id:"jelly-pop",type:"JELLY",temperament:"GOOFY",sheet:CAST_SHEET,atlasIndex:5,glowColor:0x80ddff,scaleFactor:.88,initial:{x:.32,y:.74},start:true},
    {id:"radish-bop",type:"RADISH",temperament:"CURIOUS",sheet:CAST_SHEET,atlasIndex:6,glowColor:0x99e874,scaleFactor:.84,initial:{x:.56,y:.78},start:true},
    {id:"bubble-bebe",type:"BUBBLE",temperament:"SHY",sheet:CAST_SHEET,atlasIndex:7,glowColor:0x9fd0ff,scaleFactor:.84,initial:{x:.76,y:.70},start:true},
    {id:"plum-plop",type:"PLUM",temperament:"GOOFY",sheet:CAST_SHEET,atlasIndex:8,glowColor:0xb88bff,scaleFactor:.84,initial:{x:.16,y:.80},start:true},
    {id:"candy-roll",type:"CANDY",temperament:"TRICKSTER",sheet:CAST_SHEET,atlasIndex:9,glowColor:0xffacd7,scaleFactor:.86,initial:{x:.84,y:.22},start:true}
  ];
  const FX_PALETTES={
    PEACH:[0xf7a0a7,0xffcad2,0xffe48e,0xffffff],
    BUNNY:[0xeecfe0,0xffecf6,0xb7e57a,0xffffff],
    FLAME:[0xffd768,0xfff0a6,0xff9b4a,0xffffff],
    CLOUD:[0xcbe4ff,0xedf7ff,0xaed6ff,0xffffff],
    STAR:[0xffe97a,0xfff5bb,0xf4be56,0xffffff],
    JELLY:[0x7ddcff,0xd8f4ff,0xff9be0,0xffffff],
    RADISH:[0x9de16d,0xdff7c6,0xff93b3,0xffffff],
    BUBBLE:[0x9fd2ff,0xe7f5ff,0xdabfff,0xffffff],
    PLUM:[0xb083f5,0xd8c3ff,0xffa3df,0xffffff],
    CANDY:[0xff9fce,0xffddf0,0xf0bcff,0xffffff],
    SPARK:[0xffd768,0xfff0a6,0xff9b4a,0xffffff],
    MINT:[0x8bd5c1,0xdaf6ef,0x97cfff,0xffffff],
    NEUTRAL:[0xffffff,0xd9cbee,0xb8ccff,0xfff4d0]
  };
  const WORLD_ROTATION=[
    {id:"CANDY_TOY_ROOM",asset:"CANDY_TOY_ROOM",panelTint:0xffd8ea,hazeTint:0xfac6df,foregroundTint:0xffffff,accentA:0xffe987,accentB:0x95d7ff,flash:0xffb4da,panelAlpha:.26,hazeAlpha:.20,foregroundAlpha:.82},
    {id:"CRYSTAL_SKY_GARDEN",asset:"CRYSTAL_SKY_GARDEN",panelTint:0xdce7ff,hazeTint:0xc5d9ff,foregroundTint:0xf6fbff,accentA:0xbdeaff,accentB:0xd7b6ff,flash:0xc5d7ff,panelAlpha:.25,hazeAlpha:.18,foregroundAlpha:.82},
    {id:"UNDERWATER_BUBBLE_PALACE",asset:"UNDERWATER_BUBBLE_PALACE",panelTint:0xc8f0ff,hazeTint:0x79c9ff,foregroundTint:0xefffff,accentA:0x9be7ff,accentB:0xffc7e8,flash:0x87d8ff,panelAlpha:.23,hazeAlpha:.22,foregroundAlpha:.80},
    {id:"STARLIGHT_CARNIVAL",asset:"STARLIGHT_CARNIVAL",panelTint:0xd0c7ff,hazeTint:0xa088ff,foregroundTint:0xfef9ff,accentA:0xffe17c,accentB:0xc6b1ff,flash:0xf4d17c,panelAlpha:.24,hazeAlpha:.20,foregroundAlpha:.84}
  ];
  const CHARACTER_SPECIALS={
    PEACH:{cooldown:2600,power:.76},BUNNY:{cooldown:2100,power:.72},FLAME:{cooldown:1900,power:.88},CLOUD:{cooldown:2500,power:.74},STAR:{cooldown:2300,power:.82},
    JELLY:{cooldown:2100,power:.78},RADISH:{cooldown:2600,power:.72},BUBBLE:{cooldown:2200,power:.70},PLUM:{cooldown:2800,power:.92},CANDY:{cooldown:2400,power:.80}
  };
  const state={
    app:null,stageRoot:null,world:null,bgWorldCurrent:null,bgWorldNext:null,bgBackdrop:null,bgPlayfield:null,bgForeground:null,bgSprite:null,bgTexture:null,bg:null,toys:null,ambientLayer:null,objectLayer:null,objectRuntime:null,petLayer:null,fxLayer:null,flash:null,audio:null,pets:[],
    pools:null,particles:[],ripples:[],assetFx:[],safe:{left:0,top:0,right:0,bottom:0},
    lastTapAt:0,lastDirectHitAt:0,lastNearAt:0,lastCollisionAt:0,streak:0,hitCombo:0,totalTaps:0,directHits:0,nearMisses:0,
    collisionChain:0,lastCollisionChainAt:0,lastComboBlastAt:0,lastFrenzyAt:0,frenzyUntil:0,frenzyPower:0,nextFrenzyKickAt:0,lastTauntAt:0,lastTrails:new Map(),
    toyEnergy:0,nextEventEnergy:.90,eventCount:0,lastEventAt:0,lastBumps:new Map(),pending:[],objectEvents:0,objectHits:0,
    cameraX:0,cameraY:0,cameraVx:0,cameraVy:0,cameraRot:0,cameraVr:0,flashAlpha:0,flashColor:0xffffff,
    worldIndex:0,worldCharge:0,nextWorldCharge:.96,lastWorldShiftAt:0,worldShiftCount:0,worldPulse:0,worldTransition:null,
    specialCooldowns:new Map(),lastAmbientAt:0,lastWorldRuleAt:0,lastWorldKickAt:0,ambientCounter:0,
    frame:{fps:60,accMs:0,frames:0,lastLog:0}
  };
  const screen=()=>state.app.renderer.screen;
  const activePets=()=>state.pets.filter(p=>p.isActive&&p.isActive());

  async function boot(){
    const app=new PIXI.Application();
    await app.init({resizeTo:window,background:0x171522,antialias:true,resolution:Math.min(window.devicePixelRatio||1,1.5),autoDensity:true,powerPreference:"high-performance"});
    state.app=app;
    if(window.ProductionAssetArt&&window.ProductionAssetArt.loadAll)await window.ProductionAssetArt.loadAll();
    document.body.appendChild(app.canvas);buildScene();wireInput();state.audio=new AudioMoodPlayer();
    state.objectRuntime=new ToyObjectRuntime(app,{parent:state.objectLayer,safeBounds,onEvent:handleObjectEvent});

    for(const spec of SLOT_SPECS){
      const pet=new SpritePetRuntime(app,{
        id:spec.id,type:spec.type,temperament:spec.temperament,scaleFactor:spec.scaleFactor,initial:spec.initial,active:!!spec.start,
        atlas:{columns:CAST_GRID.columns,rows:CAST_GRID.rows,index:spec.atlasIndex},glowColor:spec.glowColor,
        parent:state.petLayer,safeBounds,onReaction:handlePetReaction,onModeChange:()=>{},onWallBounce:handleWallBounce
      });
      await pet.init(spec.sheet);state.pets.push(pet);
    }
    state.pets.forEach((pet,i)=>{const spec=SLOT_SPECS[i];pet.setActive(true,{x:screen().width*spec.initial.x,y:screen().height*spec.initial.y,panic:i===0?0:.12});});
    const hero=state.pets[0];if(hero)hero.setSizeMultiplier(1.02);
    resizeScene();app.ticker.add(tick);
    if(DEBUG)window.PixiGameDebug={app,canvas:app.canvas,pets:()=>state.pets,diagnostics,triggerToyEvent};
    try{A&&A.onRendererReady(VERSION);}catch(_){}
  }

  function buildScene(){
    const app=state.app;
    state.stageRoot=new PIXI.Container();state.stageRoot.label="toy-box-root";app.stage.addChild(state.stageRoot);
    state.world=new PIXI.Container();state.world.label="production-asset-world";state.stageRoot.addChild(state.world);

    state.bgWorldCurrent=new PIXI.Sprite();state.bgWorldCurrent.label="bg-world-current";state.world.addChild(state.bgWorldCurrent);
    state.bgWorldNext=new PIXI.Sprite();state.bgWorldNext.label="bg-world-next";state.bgWorldNext.alpha=0;state.bgWorldNext.visible=false;state.world.addChild(state.bgWorldNext);
    state.bgBackdrop=new PIXI.Sprite();state.bgBackdrop.label="bg-backdrop";state.world.addChild(state.bgBackdrop);
    state.bgPlayfield=new PIXI.Sprite();state.bgPlayfield.label="bg-playfield";state.world.addChild(state.bgPlayfield);
    state.bgSprite=state.bgPlayfield;
    state.bg=new PIXI.Graphics();state.bg.label="bg-atmosphere";state.world.addChild(state.bg);
    state.toys=new PIXI.Graphics();state.toys.label="bg-accents";state.world.addChild(state.toys);
    state.ambientLayer=new PIXI.Container();state.ambientLayer.label="ambient-world-fx";state.world.addChild(state.ambientLayer);
    state.objectLayer=new PIXI.Container();state.objectLayer.label="object-layer";state.world.addChild(state.objectLayer);
    state.petLayer=new PIXI.Container();state.petLayer.label="pet-layer";state.world.addChild(state.petLayer);
    state.bgForeground=new PIXI.Sprite();state.bgForeground.label="bg-foreground";state.world.addChild(state.bgForeground);
    state.fxLayer=new PIXI.Container();state.fxLayer.label="fx-layer";state.world.addChild(state.fxLayer);
    state.flash=new PIXI.Graphics();state.flash.eventMode="none";state.stageRoot.addChild(state.flash);
    state.pools={particles:new ParticlePool(320),ripples:new RipplePool(18)};
    setWorld(0,{immediate:true});renderBackground();window.addEventListener("resize",resizeScene);
  }


  function worldDef(index){
    const len=WORLD_ROTATION.length||1;
    const safe=((Number(index)||0)%len+len)%len;
    return WORLD_ROTATION[safe];
  }

  function currentWorld(){return worldDef(state.worldIndex);}

  function worldTexture(def){
    const assets=window.ProductionAssetArt;
    return assets?assets.texture(`world.${def.asset}`):PIXI.Texture.WHITE;
  }

  function setWorld(index,options){
    const o=options||{},nextIndex=((Number(index)||0)%WORLD_ROTATION.length+WORLD_ROTATION.length)%WORLD_ROTATION.length,next=worldDef(nextIndex);
    state.worldIndex=nextIndex;
    if(!state.bgWorldCurrent)return false;
    const immediate=!!o.immediate||!state.bgWorldCurrent.texture||state.bgWorldCurrent.texture===PIXI.Texture.WHITE||!state.bgWorldCurrent.width;
    if(immediate){
      state.bgWorldCurrent.texture=worldTexture(next);state.bgWorldCurrent.alpha=1;
      if(state.bgWorldNext){state.bgWorldNext.alpha=0;state.bgWorldNext.visible=false;state.bgWorldNext.texture=PIXI.Texture.EMPTY||PIXI.Texture.WHITE;}
      state.worldTransition=null;renderBackground();
    }else if(!state.worldTransition&&state.bgWorldNext){
      state.bgWorldNext.texture=worldTexture(next);state.bgWorldNext.alpha=0;state.bgWorldNext.visible=true;state.worldTransition={startedAt:now(),duration:720};renderBackground();
    }
    state.lastWorldShiftAt=now();
    state.worldCharge=.06;state.worldPulse=.95;
    state.nextWorldCharge=.88+Math.random()*.30+Math.min(.24,state.worldShiftCount*.04);
    state.worldShiftCount++;
    if(o.fx!==false&&o.origin){
      const theme=currentWorld();
      worldTransitionBurst(theme);softBloom(o.origin.x,o.origin.y,theme.flash,.86);shockRing(o.origin.x,o.origin.y,0xffffff,.92);screenFlash(theme.flash,.08);cameraKick(0,-1,.42);
      if(window.GameHaptics)window.GameHaptics.perform("IMPACT",.56);
    }
    return true;
  }

  function chargeWorld(amount,origin){
    const gain=Math.max(0,Number(amount)||0);if(!gain)return;
    state.worldCharge=clamp(state.worldCharge+gain,0,2.4);state.worldPulse=Math.max(state.worldPulse,Math.min(1,gain*1.8));
    if(state.worldCharge>=state.nextWorldCharge&&now()-state.lastWorldShiftAt>2200)cycleWorld(origin,"CHARGE");
  }

  function cycleWorld(origin,reason){
    const next=(state.worldIndex+1)%WORLD_ROTATION.length;return setWorld(next,{origin,reason});
  }

  function petById(id){return state.pets.find(p=>p.id===id);}

  function triggerCharacterSpecial(primary){
    if(!primary||!primary.id)return false;const pet=petById(primary.id);if(!pet)return false;
    const cfg=CHARACTER_SPECIALS[primary.type]||{cooldown:2600,power:.72},t=now(),last=state.specialCooldowns.get(primary.id)||0;
    if(t-last<cfg.cooldown)return false;state.specialCooldowns.set(primary.id,t);
    const pos=pet.position&&pet.position();if(!pos)return false;const v=pet.velocity?pet.velocity():{vx:0,vy:0,speed:0},colors=FX_PALETTES[primary.type]||FX_PALETTES.NEUTRAL;
    softBloom(pos.x,pos.y,colors[0],.72);shockRing(pos.x,pos.y,colors[1],.62);
    if(primary.type==="PEACH"){
      for(const other of activePets()){if(other.id!==pet.id&&Math.random()<.72)other.synchronize("CELEBRATE",pos);}chargeWorld(.10,pos);
    }else if(primary.type==="BUNNY"){
      pet.applyWorldForce((Math.random()-.5)*80,-260,1);pet.forceAnimation("HOP",460);
    }else if(primary.type==="FLAME"){
      const a=v.speed>90?Math.atan2(v.vy,v.vx):(-Math.PI*.5+(Math.random()-.5)*1.5),spd=520+Math.random()*120;pet.launch(Math.cos(a)*spd,Math.sin(a)*spd-55,"PANIC");
    }else if(primary.type==="CLOUD"){
      radialObjectPush(pos.x,pos.y,.48);pet.applyWorldForce(0,-120,.7);
    }else if(primary.type==="STAR"){
      radialObjectPush(pos.x,pos.y,.38);chargeWorld(.18,pos);screenFlash(colors[0],.055);
    }else if(primary.type==="JELLY"){
      pet.setSizeMultiplier(.72,300);pet.applyWorldForce((Math.random()-.5)*150,-220,1.05);
    }else if(primary.type==="RADISH"){
      const others=activePets().filter(x=>x.id!==pet.id).sort(()=>Math.random()-.5).slice(0,2);for(const other of others)other.nudgeFrom(pos.x,pos.y,.36+Math.random()*.18);
    }else if(primary.type==="BUBBLE"){
      pet.setSizeMultiplier(1.12,620);pet.applyWorldForce((Math.random()-.5)*45,-180,.75);spawnAssetFx("collision",pos.x,pos.y,{scale:.26,scaleTo:.72,alpha:.32,duration:.28});
    }else if(primary.type==="PLUM"){
      radialObjectPush(pos.x,pos.y,.62);cameraKick(0,0,.62);screenFlash(colors[0],.045);
    }else if(primary.type==="CANDY"){
      const b=safeBounds(),nx=b.left+Math.random()*(b.right-b.left),ny=b.top+Math.random()*(b.bottom-b.top);spawnAssetFx("hit",pos.x,pos.y,{scale:.34,scaleTo:.72,alpha:.42,duration:.18});pet.warpTo(nx,ny,{vx:(Math.random()-.5)*160,vy:-80-Math.random()*100,animation:"STARTLED",mode:"CURIOUS"});spawnAssetFx("hit",nx,ny,{scale:.28,scaleTo:.66,alpha:.40,duration:.18});
    }
    characterSpecialAccent(primary.type,pos.x,pos.y,cfg.power);return true;
  }

  function characterSpecialAccent(type,x,y,power){
    const colors=FX_PALETTES[type]||FX_PALETTES.NEUTRAL,n=6+Math.floor(power*4);
    for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/n+(Math.random()-.5)*.28,spd=85+Math.random()*120;drawFxShape(g,type,i,colors[i%colors.length],.56+power*.22,power);g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*spd,Math.sin(a)*spd-28,.22+Math.random()*.10,45,6,.82));}
  }

  function applyWorldRules(dt,t){
    if(t-state.lastWorldRuleAt<170)return;state.lastWorldRuleAt=t;const pets=activePets();if(!pets.length)return;const id=currentWorld().id;
    if(id==="CANDY_TOY_ROOM"){
      const pet=pets[Math.floor(Math.random()*pets.length)];if(pet)pet.applyWorldForce((Math.random()-.5)*24,-7,1);
    }else if(id==="CRYSTAL_SKY_GARDEN"){
      for(const pet of pets)pet.applyWorldForce(Math.sin(t/700+pet.id.length)*2.8,-6.5,.8);
    }else if(id==="UNDERWATER_BUBBLE_PALACE"){
      for(const pet of pets)pet.applyWorldForce(Math.sin(t/530+pet.id.length)*4.2,-5.2,.95);
    }else if(id==="STARLIGHT_CARNIVAL"){
      if((state.hitCombo>=2||state.frenzyUntil>t)&&t-state.lastWorldKickAt>980){state.lastWorldKickAt=t;const pet=pets[Math.floor(Math.random()*pets.length)];if(pet)pet.applyWorldForce((Math.random()<.5?-1:1)*(58+Math.random()*34),-18-Math.random()*28,1);}
    }
  }

  function spawnWorldAmbient(t){
    const id=currentWorld().id,interval=id==="UNDERWATER_BUBBLE_PALACE"?115:145;if(t-state.lastAmbientAt<interval)return;state.lastAmbientAt=t;state.ambientCounter++;
    const parent=state.ambientLayer||state.fxLayer,g=state.pools.particles.acquire(parent);if(!g)return;const s=screen(),theme=currentWorld(),left=18,right=s.width-18,top=18,bottom=s.height-18;let vx=0,vy=0,life=1.2,gravity=0,spin=0,scaleDecay=.10;
    if(id==="CANDY_TOY_ROOM"){
      const c=state.ambientCounter%2?theme.accentA:theme.accentB,w=3+Math.random()*4,h=7+Math.random()*8;g.roundRect(-w*.5,-h*.5,w,h,2).fill({color:c,alpha:.24});g.x=left+Math.random()*(right-left);g.y=top-10;vx=(Math.random()-.5)*16;vy=28+Math.random()*20;life=1.55;spin=(Math.random()-.5)*3;
    }else if(id==="CRYSTAL_SKY_GARDEN"){
      const c=Math.random()<.55?theme.accentA:theme.accentB,r=3+Math.random()*4;g.moveTo(0,-r).lineTo(r*.55,0).lineTo(0,r).lineTo(-r*.55,0).closePath().fill({color:c,alpha:.26});g.x=left+Math.random()*(right-left);g.y=top+Math.random()*(bottom-top)*.70;vx=(Math.random()-.5)*8;vy=8+Math.random()*12;life=1.8;spin=.8;
    }else if(id==="UNDERWATER_BUBBLE_PALACE"){
      const r=2+Math.random()*7;g.circle(0,0,r).fill({color:0xffffff,alpha:.045}).stroke({color:theme.accentA,width:1,alpha:.20});g.x=left+Math.random()*(right-left);g.y=bottom+8;vx=(Math.random()-.5)*12;vy=-(30+Math.random()*34);life=2.0;gravity=-2;scaleDecay=-.12;
    }else{
      const c=Math.random()<.6?theme.accentA:theme.accentB,r=3+Math.random()*5;g.moveTo(0,-r).lineTo(r*.28,-r*.28).lineTo(r,0).lineTo(r*.28,r*.28).lineTo(0,r).lineTo(-r*.28,r*.28).lineTo(-r,0).lineTo(-r*.28,-r*.28).closePath().fill({color:c,alpha:.24});g.x=left+Math.random()*(right-left);g.y=top+Math.random()*(bottom-top);vx=(Math.random()-.5)*8;vy=-(5+Math.random()*10);life=1.45;spin=(Math.random()-.5)*1.8;
    }
    state.particles.push(particle(g,vx,vy,life,gravity,spin,scaleDecay));
  }

  function worldTransitionBurst(theme){
    const s=screen(),cx=s.width*.5,cy=s.height*.46,n=24;for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/n+(Math.random()-.5)*.16,rad=40+Math.random()*90,spd=120+Math.random()*170,c=i%2?theme.accentA:theme.accentB;g.circle(0,0,2+Math.random()*4).fill({color:c,alpha:.42});g.x=cx+Math.cos(a)*rad*.35;g.y=cy+Math.sin(a)*rad*.25;state.particles.push(particle(g,Math.cos(a)*spd,Math.sin(a)*spd,.44+Math.random()*.18,0,4,.72));}
    shockRing(cx,cy,theme.accentA,1.12);shockRing(cx,cy,theme.accentB,.82);
  }

  function updateWorldTransition(t){
    if(state.worldPulse>0)state.worldPulse=Math.max(0,state.worldPulse-.028);
    if(!state.bgWorldCurrent)return;const s=screen(),driftX=Math.sin(t/4200)*5,driftY=Math.cos(t/5100)*3;
    if(state.worldTransition&&state.bgWorldNext){
      const q=clamp((t-state.worldTransition.startedAt)/state.worldTransition.duration,0,1),ease=1-Math.pow(1-q,3),outZ=1+.018*ease,inZ=1.055-.055*ease;
      state.bgWorldCurrent.alpha=1-ease*.22;state.bgWorldCurrent.width=s.width*outZ;state.bgWorldCurrent.height=s.height*outZ;state.bgWorldCurrent.position.set(-(state.bgWorldCurrent.width-s.width)/2+driftX,-(state.bgWorldCurrent.height-s.height)/2+driftY);
      state.bgWorldNext.alpha=ease;state.bgWorldNext.width=s.width*inZ;state.bgWorldNext.height=s.height*inZ;state.bgWorldNext.position.set(-(state.bgWorldNext.width-s.width)/2-driftX*.4,-(state.bgWorldNext.height-s.height)/2-driftY*.4);
      if(q>=1){state.bgWorldCurrent.texture=state.bgWorldNext.texture;state.bgWorldNext.alpha=0;state.bgWorldNext.visible=false;state.worldTransition=null;renderBackground();}
    }else{
      const z=1.014+Math.sin(t/5200)*.004;state.bgWorldCurrent.alpha=.95+Math.sin(t/1200)*.01+state.worldPulse*.03;state.bgWorldCurrent.width=s.width*z;state.bgWorldCurrent.height=s.height*z;state.bgWorldCurrent.position.set(-(state.bgWorldCurrent.width-s.width)/2+driftX,-(state.bgWorldCurrent.height-s.height)/2+driftY);
    }
    if(state.bgBackdrop)state.bgBackdrop.alpha=clamp((currentWorld().hazeAlpha||.18)+state.worldPulse*.05,0,.42);
    if(state.bgForeground)state.bgForeground.alpha=clamp((currentWorld().foregroundAlpha||.82)+state.worldPulse*.04,0,.96);
    if(state.bgPlayfield)state.bgPlayfield.alpha=clamp((currentWorld().panelAlpha||.24)+state.worldPulse*.03,0,.65);
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
      chargeWorld(.28+.06*Math.min(5,state.hitCombo),{x:primary.x,y:primary.y});
      triggerCharacterSpecial(primary);
    }else if(primary&&impact>=.55){
      state.nearMisses++;state.lastNearAt=t;state.toyEnergy+=.07+impact*.07;
      softBloom(x,y,FX_PALETTES[primary.type][1],.30+impact*.32);nearMissFx(x,y,primary);if(impact>=.76)grazeWhipFx(x,y,primary);spreadPanic(primary,.28+impact*.25);cameraKick(primary.x-x,primary.y-y,.16+impact*.12);
      if(impact>=.84)state.toyEnergy+=.035;
      if(window.GameHaptics)window.GameHaptics.perform("SOFT_TAP",.18+impact*.18);
      if(state.audio)state.audio.playClick(primary.type==="SPARK"?"GLITCH":"ORGANIC",.20+impact*.20,Math.max(state.streak,Math.round(impact*16)));
      chargeWorld(.08+impact*.12,{x,y});
    }else{
      airTapFx(x,y,primary&&impact>.08?primary.type:"NEUTRAL",impact);maybeTauntOnMiss(x,y,primary,impact,t);
      if(window.GameHaptics&&!objectTap?.triggered)window.GameHaptics.perform("SOFT_TAP",.12);
      if(state.audio)state.audio.playClick("ORGANIC",.12,Math.min(8,state.streak));
      chargeWorld(.025+impact*.03,{x,y});
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
      if(e.type==="BUMPER_HIT")state.objectHits++;state.toyEnergy+=e.type==="BUMPER_HIT"?.055:.018;bumperObjectFx(e.x,e.y,p);if(e.type==="BUMPER_TAP")radialObjectPush(e.x,e.y,.18+p*.26);cameraKick(0,0,.16+p*.28);chargeWorld(e.type==="BUMPER_HIT"?.12:.06,{x:e.x,y:e.y});
      if(e.type==="BUMPER_HIT"&&window.GameHaptics)window.GameHaptics.perform("IMPACT",.36+p*.34);
    }else if(e.type==="GIFT_OPEN"){
      state.objectHits++;state.toyEnergy+=.15+p*.08;giftObjectFx(e.x,e.y,p);giftReward(e);cameraKick(0,0,.34+p*.28);screenFlash(0xffc8e8,.06+p*.05);chargeWorld(.24+p*.08,{x:e.x,y:e.y});
      if(e.source==="PET"&&window.GameHaptics)window.GameHaptics.perform("IMPACT",.44+p*.30);
    }else if(e.type==="BALLOON_POP"){
      state.objectHits++;state.toyEnergy+=.10+p*.06;balloonObjectFx(e.x,e.y,p);radialObjectPush(e.x,e.y,.40+p*.35);cameraKick(0,-1,.20+p*.24);chargeWorld(.18+p*.06,{x:e.x,y:e.y});
      if(e.source==="PET"&&window.GameHaptics)window.GameHaptics.perform("IMPACT",.34+p*.24);
    }else if(e.type==="SPRING_BOING"||e.type==="SPRING_TAP"){
      if(e.type==="SPRING_BOING")state.objectHits++;state.toyEnergy+=e.type==="SPRING_BOING"?.05:.012;springObjectFx(e.x,e.y,p);chargeWorld(e.type==="SPRING_BOING"?.10:.05,{x:e.x,y:e.y});
      if(e.type==="SPRING_TAP")springTapAssist(e.x,e.y,p);
      if(e.type==="SPRING_BOING"&&window.GameHaptics)window.GameHaptics.perform("SOFT_TAP",.30+p*.20);
    }else if(e.type==="OBJECT_UNLOCK"||e.type==="OBJECT_RESPAWN"){
      objectUnlockFx(e.x,e.y,e.objectType,p);chargeWorld(.08,{x:e.x,y:e.y});
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
    const origin=source&&Number.isFinite(source.x)?{x:source.x,y:source.y}:{x:point.x,y:point.y};chargeWorld(.18+Math.min(.12,active.length*.02),origin);
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
    const r=state.pools.ripples.acquire(state.fxLayer);if(r){r.circle(0,0,6).stroke({color:colors[0],width:1.4,alpha:.28});r.x=x;r.y=y;state.ripples.push({g:r,life:.16,max:.16,growth:1.0,alpha:.14});}
  }

  function nearMissFx(x,y,primary){
    const p=clamp(primary.impact,0,1),colors=FX_PALETTES[primary.type]||FX_PALETTES.NEUTRAL;
    const dx=primary.x-x,dy=primary.y-y,g=state.pools.particles.acquire(state.fxLayer);if(g){g.moveTo(0,0).lineTo(dx,dy).stroke({color:colors[1],width:1.4+p*1.8,alpha:.16+p*.28});g.x=x;g.y=y;state.particles.push({g,vx:0,vy:0,life:.14,max:.14,gravity:0,spin:0,scaleDecay:0});}
    spawnAssetFx("graze",x+dx*.24,y+dy*.24,{rotation:Math.atan2(dy,dx),scale:.40+p*.24,scaleTo:.82+p*.20,alpha:.56+p*.20,duration:.18});
    const count=5+Math.floor(p*6);for(let i=0;i<count;i++){const q=state.pools.particles.acquire(state.fxLayer);if(!q)break;const a=Math.atan2(dy,dx)+(Math.random()-.5)*1.4,spd=60+Math.random()*95;drawFxShape(q,primary.type,i,colors[i%colors.length],.66+p*.28,p);q.x=x;q.y=y;state.particles.push(particle(q,Math.cos(a)*spd,Math.sin(a)*spd-12,.22+Math.random()*.07,45,5,.78));}
  }

  function hitFx(primary,tapX,tapY){
    const combo=state.hitCombo,p=clamp(.78+combo*.055,0,1.25),colors=FX_PALETTES[primary.type]||FX_PALETTES.PEACH,count=Math.min(40,18+combo*3);
    spawnAssetFx("hit",primary.x,primary.y,{scale:.54+p*.26,scaleTo:1.06+p*.36,alpha:.72,duration:.22});
    for(let i=0;i<count;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/count+(Math.random()-.5)*.45,spd=145+Math.random()*210+combo*18,c=colors[i%colors.length];drawFxShape(g,primary.type,i,c,.94+p*.48,p);g.x=primary.x;g.y=primary.y;state.particles.push(particle(g,Math.cos(a)*spd,Math.sin(a)*spd-56,.28+Math.random()*.18,95,8,.60));}
    rayBurst(primary.x,primary.y,primary.type,colors,combo);shockRing(primary.x,primary.y,colors[0],.82+combo*.05);shockRing(tapX,tapY,colors[1],.42);
  }

  function rayBurst(x,y,type,colors,combo){
    const n=10+Math.min(6,combo);for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/n,s=13+Math.random()*15+combo*1.2,c=colors[(i+1)%colors.length];g.moveTo(-1.3,-s).lineTo(1.3,-s).lineTo(1.3,s).lineTo(-1.3,s).closePath().fill({color:c,alpha:.92});g.rotation=a+Math.PI/2;g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*(220+Math.random()*180),Math.sin(a)*(220+Math.random()*180),.28+combo*.01,0,0,.36));}
  }

  function shockRing(x,y,color,power){const r=state.pools.ripples.acquire(state.fxLayer);if(!r)return;const p=clamp(Number(power)||.5,.2,1.6);r.circle(0,0,8+p*3).stroke({color,width:1.4+p*1.2,alpha:.20+p*.08});r.x=x;r.y=y;state.ripples.push({g:r,life:.18,max:.18,growth:1.25+p*.70,alpha:.20+p*.08});}

  function wallImpactFx(x,y,type,speed){const colors=FX_PALETTES[type]||FX_PALETTES.NEUTRAL,n=4+Math.min(8,Math.floor(speed/95));if(speed>260)spawnAssetFx("collision",x,y,{scale:.34+Math.min(.42,speed/900),scaleTo:1.0,alpha:.42,duration:.18});for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.random()*Math.PI*2,spd=55+Math.random()*100;drawFxShape(g,type,i,colors[i%colors.length],.64+speed/1100,.5);g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*spd,Math.sin(a)*spd-15,.20+Math.random()*.12,65,5,.85));}}

  function collisionFx(x,y,a,b,force,relative,chain){chain=Math.max(0,Number(chain)||0);const ca=FX_PALETTES[a]||FX_PALETTES.NEUTRAL,cb=FX_PALETTES[b]||FX_PALETTES.NEUTRAL,n=7+Math.floor(force*8)+Math.min(8,chain*2);if(force>.34)spawnAssetFx("collision",x,y,{scale:.40+force*.42+chain*.04,scaleTo:1.14+chain*.05,alpha:.36+force*.18,duration:.20});for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const ang=Math.PI*2*i/n,style=i%2?a:b,c=(i%2?ca:cb)[i%4],spd=80+force*120+Math.min(100,relative*.18);drawFxShape(g,style,i,c,.66+force*.42,force);g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(ang)*spd,Math.sin(ang)*spd-24,.20+force*.10,70,6,.75));}if(force>.55)shockRing(x,y,0xffffff,.34+force*.26+chain*.04);if(chain>=2)collisionChainAccent(x,y,a,b,chain);}


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
    shockRing(x,y,colors[0],.85+.25*power);
  }

  function bumperObjectFx(x,y,power){
    const colors=[0xd98791,0xe7bf63,0xffffff],n=8+Math.floor(power*6);spawnAssetFx("hit",x,y,{scale:.36+power*.18,scaleTo:.86+power*.18,alpha:.52,duration:.18});shockRing(x,y,colors[0],.40+power*.22);
    for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/n,s=4.5+power*4;g.moveTo(0,-s).lineTo(s*.55,-s*.25).lineTo(s,0).lineTo(s*.55,s*.25).lineTo(0,s).lineTo(-s*.55,s*.25).lineTo(-s,0).lineTo(-s*.55,-s*.25).closePath().fill({color:colors[i%3],alpha:.88});g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*(100+power*150),Math.sin(a)*(100+power*150),.22+power*.10,0,7,.72));}
  }

  function giftObjectFx(x,y,power){
    const colors=[0x9d90bd,0xe99592,0xe7bf63,0xffffff],n=14+Math.floor(power*8);spawnAssetFx("hit",x,y,{scale:.40+power*.15,scaleTo:.94+power*.24,alpha:.48,duration:.20});shockRing(x,y,colors[1],.48+power*.20);
    for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*Math.random(),spd=80+Math.random()*210+power*70,c=colors[i%colors.length],w=3+Math.random()*4,h=7+Math.random()*8;g.roundRect(-w*.5,-h*.5,w,h,1.5).fill({color:c,alpha:.88});g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*spd,Math.sin(a)*spd-105-Math.random()*80,.36+Math.random()*.20,160,10,.35));}
  }

  function balloonObjectFx(x,y,power){
    const colors=[0x79a8be,0xd8a0b4,0xffffff,0xe7bf63],n=10+Math.floor(power*8);spawnAssetFx("collision",x,y,{scale:.30+power*.12,scaleTo:.78+power*.20,alpha:.44,duration:.18});shockRing(x,y,colors[0],.44+power*.18);
    for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/n+(Math.random()-.5)*.35,spd=80+Math.random()*150,c=colors[i%colors.length],r=2.5+Math.random()*4+power*1.6;g.circle(0,0,r).fill({color:c,alpha:.72}).stroke({color:0xffffff,width:1,alpha:.30});g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*spd,Math.sin(a)*spd-45,.30+Math.random()*.16,-25,4,.60));}
  }

  function springObjectFx(x,y,power){
    const colors=[0x7fc9b5,0x79a8be,0xffffff],n=6+Math.floor(power*5);spawnAssetFx("graze",x,y-10,{rotation:-Math.PI/2,scale:.34+power*.12,scaleTo:.76+power*.14,alpha:.38,duration:.17});for(let i=0;i<n;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const spread=(i-(n-1)/2)*7,c=colors[i%3],h=16+Math.random()*20+power*14;g.roundRect(-2,-h,4,h,2).fill({color:c,alpha:.76});g.x=x+spread;g.y=y;state.particles.push(particle(g,spread*.9,-(140+Math.random()*140+power*80),.24+Math.random()*.10,140,0,.72));}shockRing(x,y,colors[0],.34+power*.14);
  }

  function objectUnlockFx(x,y,type,power){
    const map={BUMPER:0xd98791,GIFT:0x9d90bd,BALLOON:0x79a8be,SPRING:0x7fc9b5},c=map[type]||0xffffff;shockRing(x,y,c,.46+power*.20);
    for(let i=0;i<8;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/8,s=7+power*4;g.moveTo(0,-s).lineTo(s*.36,-s*.36).lineTo(s,0).lineTo(s*.36,s*.36).lineTo(0,s).lineTo(-s*.36,s*.36).lineTo(-s,0).lineTo(-s*.36,-s*.36).closePath().fill({color:c,alpha:.82});g.x=x;g.y=y;state.particles.push(particle(g,Math.cos(a)*110,Math.sin(a)*110-35,.28,60,5,.76));}
  }

  function spawnAssetFx(kind,x,y,options){
    const assets=window.ProductionAssetArt;if(!assets||!state.fxLayer)return null;const texture=assets.texture("fx."+kind);if(!texture)return null;
    const o=options||{},s=new PIXI.Sprite(texture);s.anchor.set(.5);s.blendMode="add";s.x=x;s.y=y;s.rotation=Number(o.rotation)||0;
    const scale=Math.max(.08,Number(o.scale)||.4);s.scale.set(scale);s.alpha=clamp(Number(o.alpha)||.6,0,1);state.fxLayer.addChild(s);
    state.assetFx.push({s,life:Math.max(.05,Number(o.duration)||.18),max:Math.max(.05,Number(o.duration)||.18),vx:Number(o.vx)||0,vy:Number(o.vy)||0,spin:Number(o.spin)||0,scaleFrom:scale,scaleTo:Math.max(scale,Number(o.scaleTo)||scale*1.35),alpha:s.alpha});
    return s;
  }

  function tinyReactionSpark(x,y,type,intensity){if(Math.random()>.55)return;const colors=FX_PALETTES[type]||FX_PALETTES.NEUTRAL,g=state.pools.particles.acquire(state.fxLayer);if(!g)return;drawFxShape(g,type,1,colors[1],.70+intensity*1.5,intensity);g.x=x;g.y=y;state.particles.push(particle(g,(Math.random()-.5)*45,-35,.20,0,3,1.1));}

  function particle(g,vx,vy,life,gravity,spin,scaleDecay){return {g,vx,vy,life,max:life,gravity:gravity||0,spin:spin||0,scaleDecay:scaleDecay||0};}

  function drawFxShape(g,style,index,color,size,power){
    const alpha=.72+Math.min(.22,(Number(power)||0)*.18),kind=(style==="FLAME"||style==="STAR")?"SPARK":((style==="RADISH")?"MINT":style);
    if(kind==="PEACH"||kind==="BUNNY"||kind==="PLUM"||kind==="CANDY"){
      const s=5.1*size;
      if(index%3===0){g.roundRect(-s*.72,-s*.34,s*1.44,s*.68,s*.32).fill({color,alpha});g.ellipse(-s*.20,-s*.16,s*.30,s*.10).fill({color:0xffffff,alpha:.28});}
      else if(index%3===1){g.moveTo(0,-s).lineTo(s*.58,0).lineTo(0,s).lineTo(-s*.58,0).closePath().fill({color,alpha:.90});g.moveTo(0,-s*.62).lineTo(s*.25,0).lineTo(0,s*.18).lineTo(-s*.25,0).closePath().fill({color:0xffffff,alpha:.18});}
      else{g.ellipse(0,0,s*.78,s*.44).fill({color,alpha:.74});g.ellipse(-s*.18,-s*.12,s*.30,s*.10).fill({color:0xffffff,alpha:.24});}
    }else if(kind==="SPARK"){
      const s=5.8*size;
      if(index%2===0){g.moveTo(-s*.22,-s).lineTo(s*.50,-s*.16).lineTo(s*.08,-s*.10).lineTo(s*.34,s).lineTo(-s*.58,s*.10).lineTo(-s*.12,s*.03).closePath().fill({color,alpha:.92});}
      else{g.moveTo(0,-s).lineTo(s*.26,-s*.26).lineTo(s,0).lineTo(s*.26,s*.26).lineTo(0,s).lineTo(-s*.26,s*.26).lineTo(-s,0).lineTo(-s*.26,-s*.26).closePath().fill({color,alpha:.88});g.circle(-s*.10,-s*.16,s*.12).fill({color:0xffffff,alpha:.30});}
    }else if(kind==="MINT"){
      const s=5.3*size;
      if(index%2===0){g.moveTo(0,-s).bezierCurveTo(s*.72,-s*.44,s*.72,s*.35,0,s).bezierCurveTo(-s*.72,s*.35,-s*.72,-s*.44,0,-s).fill({color,alpha:.82});g.ellipse(-s*.13,-s*.25,s*.20,s*.08).fill({color:0xffffff,alpha:.24});}
      else{g.roundRect(-s*.55,-s*.30,s*1.10,s*.60,s*.28).fill({color,alpha:.80});}
    }else if(kind==="JELLY"||kind==="BUBBLE"||kind==="CLOUD"){
      const s=5.0*size;g.circle(0,0,s*.55).fill({color,alpha:.76});g.circle(-s*.16,-s*.18,s*.16).fill({color:0xffffff,alpha:.22});if(index%2===0)g.circle(s*.54,-s*.12,s*.20).fill({color,alpha:.52});
    }else{
      const s=4.8*size;g.moveTo(0,-s).lineTo(s*.62,0).lineTo(0,s).lineTo(-s*.62,0).closePath().fill({color,alpha:.76});
    }
  }

  function softBloom(x,y,color,power){
    const g=state.pools.particles.acquire(state.fxLayer);if(!g)return;const p=clamp(Number(power)||.5,.15,1.4),r=16+p*12;
    try{g.blendMode="add";}catch(_){}
    g.circle(0,0,r).fill({color,alpha:.026+.018*p});g.circle(0,0,r*.56).fill({color:0xffffff,alpha:.020+.010*p});g.x=x;g.y=y;
    state.particles.push(particle(g,0,0,.14+Math.min(.05,p*.02),0,0,-1.15));
  }

  function cameraKick(dx,dy,power){const p=clamp(Number(power)||.2,0,1);const len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len||((Math.random()<.5)?-1:1),uy=dy/len||0;state.cameraVx+=ux*(5+14*p)+(Math.random()-.5)*8*p;state.cameraVy+=uy*(4+11*p)+(Math.random()-.5)*7*p;state.cameraVr+=(Math.random()-.5)*.008*p;}
  function screenFlash(color,alpha){state.flashColor=color||0xffffff;state.flashAlpha=Math.max(state.flashAlpha,clamp(Number(alpha)||.08,0,.20));}

  function renderBackground(){
    if(!state.bg||!state.toys||!state.bgBackdrop||!state.bgPlayfield||!state.bgForeground)return;
    const s=screen(),g=state.bg,t=state.toys,b=safeBounds(),assets=window.ProductionAssetArt,theme=currentWorld();
    const w=b.right-b.left,h=b.bottom-b.top;

    if(state.bgWorldCurrent){
      state.bgWorldCurrent.texture=state.bgWorldCurrent.texture&&state.bgWorldCurrent.texture!==PIXI.Texture.WHITE?state.bgWorldCurrent.texture:worldTexture(theme);
      state.bgWorldCurrent.position.set(0,0);state.bgWorldCurrent.width=s.width;state.bgWorldCurrent.height=s.height;state.bgWorldCurrent.alpha=1;state.bgWorldCurrent.tint=0xffffff;
    }
    if(state.bgWorldNext&&state.bgWorldNext.visible){state.bgWorldNext.position.set(0,0);state.bgWorldNext.width=s.width;state.bgWorldNext.height=s.height;state.bgWorldNext.alpha=.96;state.bgWorldNext.tint=0xffffff;}

    state.bgBackdrop.texture=assets?assets.texture("bg.backdrop"):PIXI.Texture.WHITE;
    state.bgBackdrop.position.set(0,0);state.bgBackdrop.width=s.width;state.bgBackdrop.height=s.height;state.bgBackdrop.tint=theme.hazeTint||0xffffff;state.bgBackdrop.alpha=.08+(theme.hazeAlpha||.18)*.45;

    state.bgPlayfield.texture=assets?assets.texture("bg.playfield"):PIXI.Texture.WHITE;
    state.bgPlayfield.position.set(b.left-20,b.top-18);state.bgPlayfield.width=w+40;state.bgPlayfield.height=h+72;state.bgPlayfield.tint=theme.panelTint||0xffffff;state.bgPlayfield.alpha=.10+(theme.panelAlpha||.24)*.30;

    state.bgForeground.texture=assets?assets.texture("bg.foreground"):PIXI.Texture.WHITE;
    state.bgForeground.position.set(b.left-18,b.bottom-116);state.bgForeground.width=w+36;state.bgForeground.height=174;state.bgForeground.tint=theme.foregroundTint||0xffffff;state.bgForeground.alpha=.12+(theme.foregroundAlpha||.82)*.18;

    g.clear();t.clear();
    g.roundRect(b.left-6,b.top-6,w+12,h+16,28).fill({color:0x111224,alpha:.06});
    g.roundRect(b.left,b.top,w,h+10,26).stroke({color:theme.accentA,width:2,alpha:.08});
    g.ellipse(s.width*.50,b.top+h*.18,w*.33,h*.12).fill({color:theme.accentA,alpha:.020+state.worldPulse*.020});
    g.ellipse(s.width*.52,b.top+h*.82,w*.28,h*.09).fill({color:theme.accentB,alpha:.016+state.worldPulse*.016});

    for(let i=0;i<6;i++){
      const px=b.left+w*(.08+i*.17),py=b.top+h*(i%2===0?.14:.86),size=8+i*3;
      t.circle(px,py,size*.16).fill({color:theme.accentA,alpha:.16});
      t.circle(px+size*1.2,py-size*.34,size*.10).fill({color:theme.accentB,alpha:.14});
    }
  }

  function safeBounds(){const s=screen(),padX=Math.max(56,s.width*.085),padTop=Math.max(66,state.safe.top+44),padBottom=Math.max(84,state.safe.bottom+58);return {left:padX,top:padTop,right:Math.max(padX+1,s.width-padX),bottom:Math.max(padTop+1,s.height-padBottom)};}

  function resizeScene(){
    if(!state.app)return;const s=screen();state.app.stage.hitArea=s;
    if(state.world){state.world.pivot.set(s.width/2,s.height/2);state.world.position.set(s.width/2+state.cameraX,s.height/2+state.cameraY);}
    renderBackground();if(state.objectRuntime)state.objectRuntime.resize();for(const pet of state.pets)pet.resize();
  }

  function tick(ticker){
    const dt=Math.min(50,Number(ticker.deltaMS)||16.67),t=now();processPending(t);updateFrenzy(t);applyWorldRules(dt,t);spawnWorldAmbient(t);if(state.objectRuntime)state.objectRuntime.tick(dt,activePets());resolveCollisions();
    if(t-state.lastTapAt>900){state.streak=Math.max(0,state.streak-dt/500);state.toyEnergy=Math.max(0,state.toyEnergy-dt/18000);state.worldCharge=Math.max(0,state.worldCharge-dt/7000);}
    updateWorldTransition(t);updateCamera(dt);updateFx(dt);updateFlash(dt);
    const f=state.frame;f.accMs+=dt;f.frames++;if(f.accMs>=500){f.fps=Math.round(f.frames*1000/f.accMs);f.accMs=0;f.frames=0;}if(DEBUG&&t-f.lastLog>1200){f.lastLog=t;console.log("[World Visibility v21]",JSON.stringify(diagnostics()));}
  }

  function updateCamera(dt){
    state.cameraVx*=Math.pow(.46,dt/16.67);state.cameraVy*=Math.pow(.46,dt/16.67);state.cameraVr*=Math.pow(.34,dt/16.67);
    state.cameraX+=state.cameraVx;state.cameraY+=state.cameraVy;state.cameraX*=Math.pow(.50,dt/16.67);state.cameraY*=Math.pow(.50,dt/16.67);
    state.cameraRot+=state.cameraVr;state.cameraRot*=Math.pow(.42,dt/16.67);
    const s=screen();state.world.position.set(s.width/2+clamp(state.cameraX,-12,12),s.height/2+clamp(state.cameraY,-10,10));state.world.rotation=clamp(state.cameraRot,-.008,.008);
  }

  function updateFx(dt){
    for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.life-=dt/1000;p.vy+=(p.gravity||0)*dt/1000;p.g.x+=p.vx*dt/1000;p.g.y+=p.vy*dt/1000;p.g.rotation+=(p.spin||0)*dt/1000;p.g.alpha=clamp(p.life/p.max,0,1);const q=1-p.life/p.max,scale=Math.max(.05,1-q*(p.scaleDecay||0));p.g.scale.set(scale);if(p.life<=0){state.pools.particles.release(p.g);state.particles.splice(i,1);}}
    for(let i=state.ripples.length-1;i>=0;i--){const r=state.ripples[i];r.life-=dt/1000;const q=1-r.life/r.max;r.g.scale.set(1+q*r.growth);r.g.alpha=clamp(r.life/r.max,0,1)*r.alpha;if(r.life<=0){state.pools.ripples.release(r.g);state.ripples.splice(i,1);}}
    for(let i=state.assetFx.length-1;i>=0;i--){const f=state.assetFx[i];f.life-=dt/1000;const q=1-clamp(f.life/f.max,0,1);f.s.x+=f.vx*dt/1000;f.s.y+=f.vy*dt/1000;f.s.rotation+=(f.spin||0)*dt/1000;const scale=f.scaleFrom+(f.scaleTo-f.scaleFrom)*q;f.s.scale.set(scale);f.s.alpha=Math.max(0,(1-q)*f.alpha);if(f.life<=0){try{f.s.parent&&f.s.parent.removeChild(f.s);f.s.destroy();}catch(_){}state.assetFx.splice(i,1);}}
  }

  function updateFlash(dt){if(!state.flash)return;state.flashAlpha=Math.max(0,state.flashAlpha-dt/650);const s=screen();state.flash.clear();if(state.flashAlpha>.002)state.flash.rect(0,0,s.width,s.height).fill({color:state.flashColor,alpha:state.flashAlpha});}

  function diagnostics(){const art=window.ProductionAssetArt&&window.ProductionAssetArt.status?window.ProductionAssetArt.status():null;return {version:VERSION,fps:state.frame.fps,totalTaps:state.totalTaps,directHits:state.directHits,nearMisses:state.nearMisses,hitCombo:state.hitCombo,collisionChain:state.collisionChain,frenzy:state.frenzyUntil>now(),toyEnergy:Math.round(state.toyEnergy*100)/100,nextEventEnergy:Math.round(state.nextEventEnergy*100)/100,eventCount:state.eventCount,objectEvents:state.objectEvents,objectHits:state.objectHits,world:currentWorld().id,worldCharge:Math.round(state.worldCharge*100)/100,nextWorldCharge:Math.round(state.nextWorldCharge*100)/100,worldShiftCount:state.worldShiftCount,objects:state.objectRuntime?state.objectRuntime.context():[],activePets:activePets().length,pets:state.pets.map(p=>p.context()),particlePool:state.pools&&state.pools.particles.stats(),ripplePool:state.pools&&state.pools.ripples.stats(),assetStatus:art,aiVoice:false,geminiGameplay:false,immersive:true};}

  function resetGame(){
    for(const p of state.particles)state.pools.particles.release(p.g);state.particles.length=0;for(const r of state.ripples)state.pools.ripples.release(r.g);state.ripples.length=0;for(const f of state.assetFx){try{f.s.parent&&f.s.parent.removeChild(f.s);f.s.destroy();}catch(_){}}state.assetFx.length=0;
    state.streak=0;state.hitCombo=0;state.totalTaps=0;state.directHits=0;state.nearMisses=0;state.toyEnergy=0;state.objectEvents=0;state.objectHits=0;if(state.objectRuntime)state.objectRuntime.reset();state.nextEventEnergy=.90;state.eventCount=0;state.pending.length=0;state.lastBumps.clear();state.collisionChain=0;state.lastCollisionChainAt=0;state.lastComboBlastAt=0;state.lastFrenzyAt=0;state.frenzyUntil=0;state.frenzyPower=0;state.nextFrenzyKickAt=0;state.lastTauntAt=0;state.lastTrails.clear();
    state.worldCharge=0;state.nextWorldCharge=.96;state.lastWorldShiftAt=0;state.worldShiftCount=0;state.worldPulse=0;state.worldTransition=null;state.specialCooldowns.clear();state.lastAmbientAt=0;state.lastWorldRuleAt=0;state.lastWorldKickAt=0;state.ambientCounter=0;setWorld(0,{immediate:true,fx:false});
    state.pets.forEach((pet,i)=>{const spec=SLOT_SPECS[i];pet.reset(i,state.pets.length);pet.setActive(true,{x:screen().width*(spec.initial?.x||.55),y:screen().height*(spec.initial?.y||.55),panic:i===0?0:.10});});
    const hero=state.pets[0];if(hero)hero.setSizeMultiplier(1.02);
  }

  function receive(msg){try{if(!msg)return;if(msg.op==="safeArea"){state.safe.left=Math.max(0,Number(msg.left)||0);state.safe.top=Math.max(0,Number(msg.top)||0);state.safe.right=Math.max(0,Number(msg.right)||0);state.safe.bottom=Math.max(0,Number(msg.bottom)||0);resizeScene();}else if(msg.op==="reset")resetGame();}catch(e){reportError(e);}}
  function reportError(e){console.error(e);try{A&&A.onRendererError(String(e&&e.message||e));}catch(_){} }

  window.InfiniteClick={receive,diagnostics};window.ToyBoxSpecs=SLOT_SPECS;boot().catch(reportError);
})();
