(() => {
  "use strict";

  const A=window.AndroidGame;
  const DEBUG=!!window.__INFINITE_CLICK_DEBUG__;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const PET_SPECS=[
    {id:"peach-shy",type:"PEACH",temperament:"SHY",sheet:"sprites/cutie-sheet.png",scaleFactor:1.00,initial:{x:.26,y:.43}},
    {id:"spark-trickster",type:"SPARK",temperament:"TRICKSTER",sheet:"sprites/spark-sheet.png",scaleFactor:.90,initial:{x:.70,y:.40}},
    {id:"mint-curious",type:"MINT",temperament:"CURIOUS",sheet:"sprites/mint-sheet.png",scaleFactor:.94,initial:{x:.35,y:.69}},
    {id:"peach-goofy",type:"PEACH",temperament:"GOOFY",sheet:"sprites/cutie-sheet.png",scaleFactor:.86,initial:{x:.72,y:.68}}
  ];
  const FX_PALETTES={
    PEACH:[0xff8faf,0xffc8d8,0xffe07a,0xffffff],
    SPARK:[0xffe34f,0xffa800,0xffffff,0x8ce7ff],
    MINT:[0x76e6bf,0xb8f4dc,0x8ce7ff,0xffffff],
    NEUTRAL:[0xffffff,0xb8b7ff,0xffc8e3,0x8ce7ff]
  };
  const state={
    app:null,root:null,bg:null,fxLayer:null,petLayer:null,pets:[],audio:null,
    pools:null,ripples:[],particles:[],safe:{left:0,top:0,right:0,bottom:0},
    lastTapAt:0,lastTrailAt:0,lastGroupAt:0,lastBumps:new Map(),streak:0,heat:0,totalTaps:0,directHits:0,
    frame:{fps:60,accMs:0,frames:0,lastLog:0}
  };
  const screen=()=>state.app.renderer.screen;

  async function boot(){
    const app=new PIXI.Application();
    await app.init({resizeTo:window,background:0x171526,antialias:true,resolution:Math.min(window.devicePixelRatio||1,1.5),autoDensity:true,powerPreference:"high-performance"});
    state.app=app;document.body.appendChild(app.canvas);buildScene();wireInput();state.audio=new AudioMoodPlayer();
    state.pets=[];
    for(const spec of PET_SPECS){
      const pet=new SpritePetRuntime(app,{id:spec.id,type:spec.type,temperament:spec.temperament,scaleFactor:spec.scaleFactor,initial:spec.initial,parent:state.petLayer,safeBounds,onReaction:handlePetReaction,onModeChange:handlePetMode});
      await pet.init(spec.sheet);state.pets.push(pet);
    }
    resizeScene();app.ticker.add(tick);
    if(DEBUG)window.PixiGameDebug={app,canvas:app.canvas,pets:()=>state.pets,diagnostics};
    try{A&&A.onRendererReady("MULTI_CUTIE_V12");}catch(_){}
  }

  function buildScene(){
    const app=state.app;
    state.root=new PIXI.Container();state.root.label="multi-cutie-playground";app.stage.addChild(state.root);
    state.bg=new PIXI.Graphics();state.root.addChild(state.bg);
    state.petLayer=new PIXI.Container();state.petLayer.label="pet-layer";state.root.addChild(state.petLayer);
    state.fxLayer=new PIXI.Container();state.fxLayer.label="tap-fx";state.root.addChild(state.fxLayer);
    state.pools={particles:new ParticlePool(260),ripples:new RipplePool(28)};
    renderBackground();window.addEventListener("resize",resizeScene);
  }

  function wireInput(){
    const stage=state.app.stage;stage.eventMode="static";stage.hitArea=screen();
    stage.on("pointerdown",e=>{
      const p=e.global,t=performance.now(),gap=state.lastTapAt?t-state.lastTapAt:9999;
      state.lastTapAt=t;state.totalTaps++;
      if(gap<390){state.streak=Math.min(36,state.streak+1);state.heat=clamp(state.heat+.09,0,1);}else{state.streak=1;state.heat*=.50;}

      let closest=null,closestMeasure=null;
      for(const pet of state.pets){const m=pet.measureTap(p.x,p.y);if(!closestMeasure||m.distance<closestMeasure.distance){closest=pet;closestMeasure=m;}}
      const results=[];
      for(const pet of state.pets){
        const result=pet.handleTap(p.x,p.y,{streak:state.streak,heat:state.heat,primary:pet===closest});
        results.push(result);
      }
      const primary=results.find(r=>r.id===(closest&&closest.id))||null;
      const impact=primary?primary.impact:0,type=primary&&impact>.08?primary.type:"NEUTRAL";
      tapBurst(p.x,p.y,impact,type,primary&&primary.reaction);

      if(primary&&["HIT","FLEE","DODGE","FLINCH"].includes(primary.reaction))spreadPanic(primary);
      if(primary&&primary.reaction==="HIT"){state.directHits++;state.heat=clamp(state.heat+.14,0,1);petHitBurst(primary.x,primary.y,primary.type,primary.impact,primary.panic);}
      if(primary&&["FLEE","DODGE","FLINCH"].includes(primary.reaction))chaseAccent(primary.x,primary.y,primary.type,primary.panic);

      maybeGroupSurprise(p.x,p.y,primary);
      if(window.GameHaptics){const hit=primary&&primary.reaction==="HIT",amp=clamp(.12+impact*.52+(hit?.12:0),.12,.78);window.GameHaptics.perform(hit?"IMPACT":"SOFT_TAP",amp);}
      if(state.audio&&typeof state.audio.playClick==="function")state.audio.playClick(type==="SPARK"?"GLITCH":"ORGANIC",.18+impact*.42+Math.min(.16,state.streak*.006),Math.max(state.streak,Math.round(impact*20)));
    });
  }

  function handlePetReaction(e){
    if(!e)return;
    if(e.reaction==="HIT"&&e.directHits%6===0){const pet=state.pets.find(p=>p.id===e.id);pet&&pet.celebrate();}
  }
  function handlePetMode(){/* Local multi-cutie behavior owns itself. AI remains silent/off in v12. */}

  function spreadPanic(source){
    const strength=clamp((source.impact||0)*(.42+(source.panic||0)*.38),.08,.72);
    for(const pet of state.pets){if(pet.id===source.id)continue;const r=pet.receiveGroupPanic(source.x,source.y,strength);if(r&&r.impact>.035)groupSpark(r.x,r.y,r.type,r.impact);}
  }

  function maybeGroupSurprise(x,y,primary){
    const t=performance.now();if(t-state.lastGroupAt<3200)return;
    const should=(state.streak>=10&&Math.random()<.20)||(state.totalTaps%17===0&&Math.random()<.42)||(state.heat>.78&&Math.random()<.10);
    if(!should)return;state.lastGroupAt=t;
    const roll=Math.random(),kind=roll<.42?"HOP":(roll<.76?"SCATTER":"CELEBRATE");
    for(const pet of state.pets)pet.synchronize(kind,{x,y});
    groupBurst(x,y,kind,primary&&primary.type);
  }

  function resolveCollisions(){
    const t=performance.now();
    for(let i=0;i<state.pets.length;i++)for(let j=i+1;j<state.pets.length;j++){
      const a=state.pets[i],b=state.pets[j],pa=a.position(),pb=b.position();if(!pa||!pb)continue;
      const dx=pb.x-pa.x,dy=pb.y-pa.y,d=Math.hypot(dx,dy),min=a.collisionRadius()+b.collisionRadius();
      if(d>=min||d<=0)continue;
      const key=a.id+"|"+b.id,last=state.lastBumps.get(key)||0;if(t-last<360)continue;state.lastBumps.set(key,t);
      const force=clamp((min-d)/Math.max(1,min)+.24,.24,.68);a.nudgeFrom(pb.x,pb.y,force);b.nudgeFrom(pa.x,pa.y,force);bumpBurst((pa.x+pb.x)/2,(pa.y+pb.y)/2,a.type,b.type,force);
    }
  }

  function tapBurst(x,y,impact,type,reaction){
    const p=clamp(Number(impact)||0,0,1),style=String(type||"NEUTRAL"),colors=FX_PALETTES[style]||FX_PALETTES.NEUTRAL;
    const base=style==="NEUTRAL"?5:8,count=Math.min(38,base+Math.floor(p*24)+Math.floor(state.streak*.28));
    const size=.72+p*.95,spread=75+p*220;
    for(let i=0;i<count;i++){
      const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;
      const a=Math.PI*2*i/Math.max(1,count)+(Math.random()-.5)*.72,spd=(45+Math.random()*spread)*(.75+p*.55),c=colors[i%colors.length];
      drawFxShape(g,style,i,c,size,p);g.x=x;g.y=y;
      state.particles.push({g,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-(20+p*45),life:.24+Math.random()*(.18+p*.22),max:.64,gravity:80+p*85,spin:(Math.random()-.5)*(4+p*7),scaleDecay:.45+p*.35});
    }
    const r=state.pools.ripples.acquire(state.fxLayer);if(r){
      const ringColor=colors[0];r.circle(0,0,8+p*15).stroke({color:ringColor,width:1.6+p*3.2,alpha:.34+p*.54});r.x=x;r.y=y;
      state.ripples.push({g:r,life:.24+p*.20,max:.44,growth:2.4+p*3.7,alpha:.38+p*.50});
    }
    if(reaction==="HIT"&&p>.9)rayBurst(x,y,style,colors);
  }

  function drawFxShape(g,style,index,color,size,power){
    if(style==="PEACH"){
      if(index%3===0){const s=4.2*size;g.moveTo(0,s*.92).bezierCurveTo(-s*1.45,-s*.08,-s*.96,-s*1.18,0,-s*.52).bezierCurveTo(s*.96,-s*1.18,s*1.45,-s*.08,0,s*.92).fill({color,alpha:.84+.12*power});}
      else if(index%3===1)g.moveTo(0,-5*size).lineTo(4*size,0).lineTo(0,5*size).lineTo(-4*size,0).closePath().fill({color,alpha:.88});
      else g.roundRect(-3*size,-2*size,6*size,4*size,2*size).fill({color,alpha:.72});
    }else if(style==="SPARK"){
      if(index%2===0){const s=5.5*size;g.moveTo(-s*.25,-s).lineTo(s*.55,-s*.12).lineTo(s*.08,-s*.08).lineTo(s*.35,s).lineTo(-s*.62,s*.08).lineTo(-s*.14,s*.04).closePath().fill({color,alpha:.94});}
      else{const s=5*size;g.moveTo(0,-s).lineTo(s*.28,-s*.28).lineTo(s,0).lineTo(s*.28,s*.28).lineTo(0,s).lineTo(-s*.28,s*.28).lineTo(-s,0).lineTo(-s*.28,-s*.28).closePath().fill({color,alpha:.88});}
    }else if(style==="MINT"){
      const s=5.5*size;if(index%2===0){g.moveTo(0,-s).bezierCurveTo(s*.9,-s*.6,s*.85,s*.4,0,s).bezierCurveTo(-s*.85,s*.4,-s*.9,-s*.6,0,-s).fill({color,alpha:.86});}
      else g.moveTo(0,-s).lineTo(s*.65,0).lineTo(0,s).lineTo(-s*.65,0).closePath().fill({color,alpha:.82});
    }else{
      const s=4.2*size;g.moveTo(0,-s).lineTo(s,0).lineTo(0,s).lineTo(-s,0).closePath().fill({color,alpha:.76});
    }
  }

  function rayBurst(x,y,type,colors){
    for(let i=0;i<8;i++){
      const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/8,s=10+Math.random()*7,c=colors[(i+1)%colors.length];
      g.moveTo(-1,-s).lineTo(1,-s).lineTo(1,s).lineTo(-1,s).closePath().fill({color:c,alpha:.85});g.rotation=a+Math.PI/2;g.x=x;g.y=y;
      state.particles.push({g,vx:Math.cos(a)*(150+Math.random()*120),vy:Math.sin(a)*(150+Math.random()*120),life:.28,max:.28,gravity:0,spin:0,scaleDecay:.35});
    }
  }

  function petHitBurst(x,y,type,impact,panic){
    const p=clamp(Math.max(Number(impact)||0,Number(panic)||0),0,1),colors=FX_PALETTES[type]||FX_PALETTES.PEACH;
    for(let i=0;i<10+Math.floor(p*9);i++){
      const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/(10+Math.floor(p*9))+(Math.random()-.5)*.22,c=colors[i%colors.length];
      drawFxShape(g,type,i,c,1.05+p*.55,p);g.x=x;g.y=y;const spd=150+Math.random()*170+p*120;
      state.particles.push({g,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-55,life:.34+Math.random()*.18,max:.56,gravity:95,spin:(Math.random()-.5)*8,scaleDecay:.66});
    }
  }

  function chaseAccent(x,y,type,panic){
    if(performance.now()-state.lastTrailAt<60)return;state.lastTrailAt=performance.now();const colors=FX_PALETTES[type]||FX_PALETTES.NEUTRAL;
    for(let i=0;i<2+(panic>.6?2:0);i++){
      const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;drawFxShape(g,type,i,colors[i%colors.length],.72,.5);g.x=x+(Math.random()-.5)*24;g.y=y+(Math.random()-.5)*18;
      state.particles.push({g,vx:(Math.random()-.5)*35,vy:-20-Math.random()*25,life:.24,max:.24,gravity:0,spin:(Math.random()-.5)*3,scaleDecay:1.45});
    }
  }

  function groupSpark(x,y,type,intensity){if(Math.random()>.45)return;const colors=FX_PALETTES[type]||FX_PALETTES.NEUTRAL,g=state.pools.particles.acquire(state.fxLayer);if(!g)return;drawFxShape(g,type,1,colors[1],.72+intensity*1.6,intensity);g.x=x;g.y=y;state.particles.push({g,vx:(Math.random()-.5)*40,vy:-35,life:.22,max:.22,gravity:0,spin:2,scaleDecay:1.2});}

  function bumpBurst(x,y,a,b,force){const types=[a,b],colors=[...(FX_PALETTES[a]||[]),...(FX_PALETTES[b]||[])];for(let i=0;i<6;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const ang=Math.PI*2*i/6,c=colors[i%colors.length]||0xffffff;drawFxShape(g,types[i%2],i,c,.72+force,.5);g.x=x;g.y=y;state.particles.push({g,vx:Math.cos(ang)*(70+force*120),vy:Math.sin(ang)*(70+force*120)-25,life:.22,max:.22,gravity:70,spin:4,scaleDecay:.8});}}

  function groupBurst(x,y,kind,type){const style=type||"NEUTRAL",colors=FX_PALETTES[style]||FX_PALETTES.NEUTRAL,count=kind==="SCATTER"?26:18;for(let i=0;i<count;i++){const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;const a=Math.PI*2*i/count+(Math.random()-.5)*.5,c=colors[i%colors.length];drawFxShape(g,style,i,c,1.1,.85);g.x=x;g.y=y;const spd=100+Math.random()*190;state.particles.push({g,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-50,life:.34,max:.34,gravity:85,spin:5,scaleDecay:.62});}}

  function renderBackground(){
    if(!state.bg)return;const s=screen(),g=state.bg;g.clear();
    g.rect(0,0,s.width,s.height).fill({color:0x151224,alpha:1});
    g.roundRect(s.width*.035,s.height*.055,s.width*.93,s.height*.84,34).fill({color:0x221b35,alpha:.94});
    g.roundRect(s.width*.075,s.height*.095,s.width*.85,s.height*.75,28).fill({color:0x2d2543,alpha:.62});
    // A simple toy-room floor: keeps the characters readable while their sprites carry the visual identity.
    const floorY=s.height*.66;g.rect(s.width*.075,floorY,s.width*.85,s.height*.185).fill({color:0x241d38,alpha:.78});
    for(let i=0;i<6;i++){const x=s.width*(.12+i*.145);g.moveTo(x,floorY).lineTo(x-s.width*.055,s.height*.845).stroke({color:i%2?0xffb4c9:0x8ce7ff,width:1.3,alpha:.06});}
    for(let i=0;i<4;i++){const y=floorY+i*s.height*.046;g.moveTo(s.width*.08,y).lineTo(s.width*.92,y).stroke({color:0xffffff,width:1,alpha:.045});}
    // Side decorations leave the central play area clear.
    g.moveTo(s.width*.10,s.height*.22).lineTo(s.width*.15,s.height*.18).lineTo(s.width*.20,s.height*.225).stroke({color:0xffd76a,width:3,alpha:.12});
    g.moveTo(s.width*.79,s.height*.27).lineTo(s.width*.84,s.height*.23).lineTo(s.width*.89,s.height*.28).stroke({color:0x76e6bf,width:3,alpha:.11});
  }

  function safeBounds(){
    const s=screen(),padX=Math.max(58,s.width*.085),padTop=Math.max(90,state.safe.top+74),padBottom=Math.max(105,state.safe.bottom+92);
    return {left:padX,top:padTop,right:Math.max(padX+1,s.width-padX),bottom:Math.max(padTop+1,s.height-padBottom)};
  }

  function resizeScene(){if(!state.app)return;state.app.stage.hitArea=screen();renderBackground();for(const pet of state.pets)pet.resize();}

  function tick(t){
    const dt=Math.min(50,Number(t.deltaMS)||16.67);if(performance.now()-state.lastTapAt>620)state.heat=Math.max(0,state.heat-dt/2500);resolveCollisions();
    for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.life-=dt/1000;p.vy+=(p.gravity||0)*dt/1000;p.g.x+=p.vx*dt/1000;p.g.y+=p.vy*dt/1000;p.g.rotation+=(p.spin||0)*dt/1000;p.g.alpha=clamp(p.life/p.max,0,1);const scale=Math.max(.05,1-(1-p.life/p.max)*(p.scaleDecay||0));p.g.scale.set(scale);if(p.life<=0){state.pools.particles.release(p.g);state.particles.splice(i,1);}}
    for(let i=state.ripples.length-1;i>=0;i--){const r=state.ripples[i];r.life-=dt/1000;const q=1-r.life/r.max;r.g.scale.set(1+q*r.growth);r.g.alpha=clamp(r.life/r.max,0,1)*r.alpha;if(r.life<=0){state.pools.ripples.release(r.g);state.ripples.splice(i,1);}}
    const f=state.frame;f.accMs+=dt;f.frames++;if(f.accMs>=500){f.fps=Math.round(f.frames*1000/f.accMs);f.accMs=0;f.frames=0;}if(DEBUG&&performance.now()-f.lastLog>1200){f.lastLog=performance.now();console.log("[MultiCutie v12]",diagnostics());}
  }

  function diagnostics(){return {version:"MULTI_CUTIE_V12",fps:state.frame.fps,totalTaps:state.totalTaps,directHits:state.directHits,streak:state.streak,heat:Math.round(state.heat*100)/100,pets:state.pets.map(p=>p.context()),particlePool:state.pools&&state.pools.particles.stats(),ripplePool:state.pools&&state.pools.ripples.stats(),aiVoice:false,geminiGameplay:false};}

  function receive(msg){
    try{
      if(!msg)return;
      if(msg.op==="safeArea"){state.safe.left=Math.max(0,Number(msg.left)||0);state.safe.top=Math.max(0,Number(msg.top)||0);state.safe.right=Math.max(0,Number(msg.right)||0);state.safe.bottom=Math.max(0,Number(msg.bottom)||0);resizeScene();}
      else if(msg.op==="reset"){for(const p of state.particles)state.pools.particles.release(p.g);state.particles.length=0;for(const r of state.ripples)state.pools.ripples.release(r.g);state.ripples.length=0;state.streak=0;state.heat=0;state.totalTaps=0;state.directHits=0;state.lastBumps.clear();state.pets.forEach((pet,i)=>pet.reset(i,state.pets.length));}
      // All Gemini/voice messages are intentionally ignored in v12. AI remains silent and off the gameplay path.
    }catch(e){reportError(e);}
  }

  function reportError(e){console.error(e);try{A&&A.onRendererError(String(e&&e.message||e));}catch(_){} }
  window.InfiniteClick={receive,diagnostics};
  window.MultiCutieSpecs=PET_SPECS;
  boot().catch(reportError);
})();
