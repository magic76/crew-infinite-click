(() => {
  "use strict";

  const A=window.AndroidGame;
  const DEBUG=!!window.__INFINITE_CLICK_DEBUG__;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const state={
    app:null,root:null,bg:null,fxLayer:null,petLayer:null,pet:null,audio:null,
    pools:null,ripples:[],particles:[],safe:{left:0,top:0,right:0,bottom:0},
    lastTapAt:0,lastTrailAt:0,streak:0,heat:0,totalTaps:0,directHits:0,
    frame:{fps:60,accMs:0,frames:0,lastLog:0}
  };
  const screen=()=>state.app.renderer.screen;

  async function boot(){
    const app=new PIXI.Application();
    await app.init({resizeTo:window,background:0x171526,antialias:true,resolution:Math.min(window.devicePixelRatio||1,1.5),autoDensity:true,powerPreference:"high-performance"});
    state.app=app;document.body.appendChild(app.canvas);buildScene();wireInput();
    state.audio=new AudioMoodPlayer();
    state.pet=new SpritePetRuntime(app,{parent:state.petLayer,safeBounds,onReaction:handlePetReaction,onModeChange:handlePetMode});
    // Use the explicit Android asset URL; Pixi's relative resolver can produce
    // an invalid file URL inside WebView when the document base is file://.
    let sheetUrl="sprites/cutie-sheet.png";
    try{
      const encoded=A&&A.loadAssetData?A.loadAssetData("game/sprites/cutie-sheet.png"):"";
      if(encoded)sheetUrl="data:image/png;base64,"+encoded;
    }catch(_){/* browser preview keeps the relative URL */}
    await state.pet.init(sheetUrl);
    resizeScene();app.ticker.add(tick);
    if(DEBUG)window.PixiGameDebug={app,canvas:app.canvas,pet:()=>state.pet,diagnostics};
    try{A&&A.onRendererReady("SPRITE_PET_V11");}catch(_){}
  }

  function buildScene(){
    const app=state.app;
    state.root=new PIXI.Container();state.root.label="sprite-playground";app.stage.addChild(state.root);
    state.bg=new PIXI.Graphics();state.root.addChild(state.bg);
    state.petLayer=new PIXI.Container();state.petLayer.label="pet-layer";state.root.addChild(state.petLayer);
    state.fxLayer=new PIXI.Container();state.fxLayer.label="tap-fx";state.root.addChild(state.fxLayer);
    state.pools={particles:new ParticlePool(180),ripples:new RipplePool(18)};
    renderBackground();window.addEventListener("resize",resizeScene);
  }

  function wireInput(){
    const stage=state.app.stage;stage.eventMode="static";stage.hitArea=screen();
    stage.on("pointerdown",e=>{
      const p=e.global,t=performance.now(),gap=state.lastTapAt?t-state.lastTapAt:9999;
      state.lastTapAt=t;state.totalTaps++;
      if(gap<380){state.streak=Math.min(30,state.streak+1);state.heat=clamp(state.heat+.10,0,1);}else{state.streak=1;state.heat*=.52;}
      const result=state.pet?state.pet.handleTap(p.x,p.y,{streak:state.streak,heat:state.heat}):null;
      tapBurst(p.x,p.y,result&&result.reaction==="HIT"?1.35:(result&&result.reaction==="FLEE"?.95:.68));
      if(window.GameHaptics){const hit=result&&result.reaction==="HIT";window.GameHaptics.perform(hit?"IMPACT":"SOFT_TAP",hit?.48:(.16+Math.min(.18,state.streak*.008)));}
      if(state.audio&&typeof state.audio.playClick==="function")state.audio.playClick("ORGANIC",.24+Math.min(.34,state.streak*.012),state.streak);
    });
  }

  function handlePetReaction(e){
    if(!e)return;
    if(e.reaction==="HIT"){
      state.directHits++;state.heat=clamp(state.heat+.16,0,1);petHitBurst(e.x,e.y,Math.min(1,e.panic+.3));
      if(state.directHits%7===0&&state.pet)state.pet.celebrate();
    }else if(e.reaction==="FLEE"){
      chaseAccent(e.x,e.y,e.panic);
    }
  }

  function handlePetMode(){/* Local pet behavior intentionally owns itself; AI is silent/off in v11. */}

  function tapBurst(x,y,power){
    const p=clamp(Number(power)||.7,.3,1.5),colors=[0xff8faf,0xffd76a,0x8ce7ff,0xffffff,0xffb7d5];
    const count=Math.min(28,10+Math.floor(state.streak*.45)+Math.floor(p*4));
    for(let i=0;i<count;i++){
      const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;
      const a=Math.PI*2*i/count+(Math.random()-.5)*.55,spd=(95+Math.random()*190)*p,c=colors[i%colors.length],shape=i%3;
      if(shape===0){g.moveTo(0,-5).lineTo(4,0).lineTo(0,5).lineTo(-4,0).closePath().fill({color:c,alpha:.92});}
      else if(shape===1){g.roundRect(-3,-3,6,6,2).fill({color:c,alpha:.88});g.rotation=Math.random()*Math.PI;}
      else{g.moveTo(-1,-7).lineTo(1,-7).lineTo(1,7).lineTo(-1,7).closePath().fill({color:c,alpha:.82});g.rotation=a;}
      g.x=x;g.y=y;state.particles.push({g,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-30,life:.32+Math.random()*.25,max:.57,gravity:135,spin:(Math.random()-.5)*7,scaleDecay:.55});
    }
    const r=state.pools.ripples.acquire(state.fxLayer);if(r){r.circle(0,0,12).stroke({color:0xffffff,width:2.4,alpha:.82});r.x=x;r.y=y;state.ripples.push({g:r,life:.34,max:.34,growth:3.7+p,alpha:.82});}
  }

  function petHitBurst(x,y,panic){
    const p=clamp(Number(panic)||.5,0,1),colors=[0xff7ca8,0xffd55f,0xffffff];
    for(let i=0;i<12;i++){
      const g=state.pools.particles.acquire(state.fxLayer);if(!g)break;
      const a=Math.PI*2*i/12+(Math.random()-.5)*.18,c=colors[i%3];
      g.moveTo(0,-8).lineTo(3,-2).lineTo(9,0).lineTo(3,2).lineTo(0,8).lineTo(-3,2).lineTo(-9,0).lineTo(-3,-2).closePath().fill({color:c,alpha:.92});
      g.x=x;g.y=y;const spd=170+Math.random()*170+p*100;state.particles.push({g,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-45,life:.38+Math.random()*.18,max:.56,gravity:95,spin:(Math.random()-.5)*8,scaleDecay:.7});
    }
    const r=state.pools.ripples.acquire(state.fxLayer);if(r){r.circle(0,0,20).stroke({color:0xff9fbd,width:4,alpha:.9});r.x=x;r.y=y;state.ripples.push({g:r,life:.42,max:.42,growth:4.8,alpha:.9});}
  }

  function chaseAccent(x,y,panic){
    if(!state.pet||performance.now()-state.lastTrailAt<95)return;state.lastTrailAt=performance.now();
    const g=state.pools.particles.acquire(state.fxLayer);if(!g)return;
    g.moveTo(-10,0).lineTo(0,-5).lineTo(10,0).lineTo(0,5).closePath().fill({color:panic>.6?0xff8bb5:0x8ce7ff,alpha:.55});
    g.x=x;g.y=y;state.particles.push({g,vx:0,vy:-20,life:.28,max:.28,gravity:0,spin:2,scaleDecay:1.5});
  }

  function renderBackground(){
    if(!state.bg)return;const s=screen(),g=state.bg;g.clear();
    g.rect(0,0,s.width,s.height).fill({color:0x171526,alpha:1});
    g.roundRect(s.width*.05,s.height*.08,s.width*.9,s.height*.78,34).fill({color:0x241d38,alpha:.88});
    g.roundRect(s.width*.09,s.height*.12,s.width*.82,s.height*.68,28).fill({color:0x2d2543,alpha:.54});
    // Ground stripes create a simple playground rather than another abstract world renderer.
    for(let i=0;i<7;i++){
      const y=s.height*(.72+i*.035);g.roundRect(s.width*.11,y,s.width*.78,2,1).fill({color:i%2?0xffb4c9:0x8ce7ff,alpha:.055});
    }
    // Small non-interactive decorations keep the center visually clean for the pet.
    g.moveTo(s.width*.13,s.height*.23).lineTo(s.width*.18,s.height*.19).lineTo(s.width*.22,s.height*.24).stroke({color:0xffd76a,width:3,alpha:.12});
    g.moveTo(s.width*.78,s.height*.31).lineTo(s.width*.84,s.height*.27).lineTo(s.width*.88,s.height*.32).stroke({color:0x8ce7ff,width:3,alpha:.10});
  }

  function safeBounds(){
    const s=screen(),padX=Math.max(70,s.width*.12),padTop=Math.max(95,state.safe.top+82),padBottom=Math.max(118,state.safe.bottom+105);
    return {left:padX,top:padTop,right:Math.max(padX+1,s.width-padX),bottom:Math.max(padTop+1,s.height-padBottom)};
  }

  function resizeScene(){if(!state.app)return;state.app.stage.hitArea=screen();renderBackground();if(state.pet)state.pet.resize();}

  function tick(t){
    const dt=Math.min(50,Number(t.deltaMS)||16.67);
    if(performance.now()-state.lastTapAt>620)state.heat=Math.max(0,state.heat-dt/2600);
    for(let i=state.particles.length-1;i>=0;i--){
      const p=state.particles[i];p.life-=dt/1000;p.vy+=(p.gravity||0)*dt/1000;p.g.x+=p.vx*dt/1000;p.g.y+=p.vy*dt/1000;p.g.rotation+=(p.spin||0)*dt/1000;
      p.g.alpha=clamp(p.life/p.max,0,1);const scale=Math.max(.05,1-(1-p.life/p.max)*(p.scaleDecay||0));p.g.scale.set(scale);
      if(p.life<=0){state.pools.particles.release(p.g);state.particles.splice(i,1);}
    }
    for(let i=state.ripples.length-1;i>=0;i--){
      const r=state.ripples[i];r.life-=dt/1000;const q=1-r.life/r.max;r.g.scale.set(1+q*r.growth);r.g.alpha=clamp(r.life/r.max,0,1)*r.alpha;
      if(r.life<=0){state.pools.ripples.release(r.g);state.ripples.splice(i,1);}
    }
    const f=state.frame;f.accMs+=dt;f.frames++;if(f.accMs>=500){f.fps=Math.round(f.frames*1000/f.accMs);f.accMs=0;f.frames=0;}
    if(DEBUG&&performance.now()-f.lastLog>1200){f.lastLog=performance.now();console.log("[SpritePet v11]",diagnostics());}
  }

  function diagnostics(){return {version:"SPRITE_PET_V11",fps:state.frame.fps,totalTaps:state.totalTaps,directHits:state.directHits,streak:state.streak,heat:Math.round(state.heat*100)/100,pet:state.pet?state.pet.context():null,particlePool:state.pools&&state.pools.particles.stats(),ripplePool:state.pools&&state.pools.ripples.stats(),aiVoice:false,geminiGameplay:false};}

  function receive(msg){
    try{
      if(!msg)return;
      if(msg.op==="safeArea"){state.safe.left=Math.max(0,Number(msg.left)||0);state.safe.top=Math.max(0,Number(msg.top)||0);state.safe.right=Math.max(0,Number(msg.right)||0);state.safe.bottom=Math.max(0,Number(msg.bottom)||0);resizeScene();}
      else if(msg.op==="reset"){for(const p of state.particles)state.pools.particles.release(p.g);state.particles.length=0;for(const r of state.ripples)state.pools.ripples.release(r.g);state.ripples.length=0;state.streak=0;state.heat=0;state.totalTaps=0;state.directHits=0;state.pet&&state.pet.reset();}
      // All Gemini/voice messages are intentionally ignored in v11. AI remains silent and off the gameplay path.
    }catch(e){reportError(e);}
  }

  function reportError(e){console.error(e);try{A&&A.onRendererError(String(e&&e.message||e));}catch(_){}}
  window.InfiniteClick={receive,diagnostics};
  boot().catch(reportError);
})();
