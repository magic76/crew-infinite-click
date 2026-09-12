(function(global){
  "use strict";
  const catalog=global.GameWorldCatalog;
  if(!catalog)throw new Error("world-fx-controller.js requires world-catalog.js");

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function setBackground(app,color){try{if(app.renderer.background&&"color"in app.renderer.background)app.renderer.background.color=color;else app.renderer.backgroundColor=color;}catch(_){}}
  function circle(g,r,color,alpha){g.circle(0,0,r).fill({color,alpha});}
  function rect(g,x,y,w,h,color,alpha){g.rect(x,y,w,h).fill({color,alpha});}
  function ring(g,r,color,width,alpha){g.circle(0,0,r).stroke({color,width,alpha});}

  class WorldFxController {
    constructor(app,options){
      const o=options||{};
      this.app=app;this.world=null;this.worldDef=null;this.lastReactionAt=0;
      this.pool=o.particlePool||new global.ParticlePool(120);
      this.particles=[];
      this.sensory={density:0,densityName:"QUIET",ambientTarget:0,burstMultiplier:0,motion:.4,visualEffect:"NONE"};
      this.parent=o.parent||app.stage;this.ambient=new global.PIXI.Container();this.foreground=new global.PIXI.Container();
      try{this.ambient.eventMode="none";this.foreground.eventMode="none";this.ambient.interactiveChildren=false;this.foreground.interactiveChildren=false;}catch(_){}
      this.parent.addChild(this.ambient);this.parent.addChild(this.foreground);
      this._tick=this._tick.bind(this);app.ticker.add(this._tick);
    }
    destroy(){if(this.app&&this.app.ticker)this.app.ticker.remove(this._tick);this._clearAll();}

    setSensoryState(state){
      const before=Number(this.sensory.density)||0;
      this.sensory=Object.assign({},this.sensory,state||{});
      const density=clamp(Number(this.sensory.density)||0,0,3);
      if(density===0){this._clearTransient();this._reconcileAmbient(0);}
      else this._reconcileAmbient(clamp(Number(this.sensory.ambientTarget)||0,0,42));
      if(density===3&&before<3)this.chaosAccent();
    }

    setWorld(worldId,intensity){
      const next=catalog.WORLDS[worldId]||catalog.WORLDS.NEON_RIFT;
      const changed=!this.worldDef||this.worldDef.id!==next.id;
      this.world=next.id;this.worldDef=next;setBackground(this.app,next.bg);
      // World identity must not inherit ambient particles from the previous world.
      // Recycle them, then redraw the same pooled objects using the new world's palette/shape/motion.
      if(changed){this._clearAmbient();this._reconcileAmbient(Number(this.sensory.ambientTarget)||0);}
      return changed;
    }

    applyPlan(plan,target,sensoryState){
      if(!plan)return;if(sensoryState)this.setSensoryState(sensoryState);
      const changed=this.setWorld(plan.world,plan.intensity);
      const x=target&&Number.isFinite(target.x)?target.x:this._size().width/2;
      const y=target&&Number.isFinite(target.y)?target.y:this._size().height/2;
      if(changed)this._worldTransition(x,y,plan.intensity);
      if(this.sensory.density>0)this.playEffect(this.sensory.visualEffect,x,y,plan.intensity,this.sensory);
      if(this.sensory.density===3)this.crowdBurst(x,y,plan.intensity);
    }

    playEffect(effect,x,y,strength,state){
      const e=String(effect||"NONE"),s=state||this.sensory;
      if(e==="NONE")return;
      const k=clamp((Number(strength)||.45)*(.65+(Number(s.burstMultiplier)||.4)),.2,1.6);
      const map={
        PETAL_BLOOM:()=>this.petalBloom(x,y,k),STORM_FLASH:()=>this.stormFlash(k),RAIN_BURST:()=>this.rainBurst(x,y,k),
        LEAF_FALL:()=>this.leafFall(x,y,k),DUST_DISSOLVE:()=>this.dustDissolve(x,y,k),FREEZE_CRACK:()=>this.freezeCrack(x,y,k),
        FROST_PULSE:()=>this.frostPulse(x,y,k),VOID_SUCTION:()=>this.voidSuction(x,y,k),GRAVITY_WELL:()=>this.gravityWell(x,y,k),
        BLACKOUT_REVEAL:()=>this.blackoutReveal(x,y,k),GLITCH_BARS:()=>this.glitchBars(k),NEON_SLICE:()=>this.neonSlice(k),
        PIXEL_SCATTER:()=>this.pixelScatter(x,y,k),MIRROR_SPLIT:()=>this.mirrorSplit(x,y,k),SHOCKWAVE:()=>this.shockwave(x,y,k),
        ECHO_RINGS:()=>this.echoRings(x,y,k),SPOTLIGHT:()=>this.spotlight(x,y,k),SOFT_FADE:()=>this.softFade(k)
      };
      (map[e]||map.SOFT_FADE)();
    }

    /**
     * Density-independent micro feedback for a physical tap.
     * QUIET may suppress ambience, but it must never suppress click feel.
     * Uses only the preallocated particle pool and caps itself at 2..6 particles.
     */
    tapAccent(x,y,streak){
      if(!this.worldDef)this.setWorld("NEON_RIFT",.35);
      if(!this.worldDef)return 0;
      const size=this._size();
      const px=Math.abs(Number(x))<=1?Number(x)*size.width:Number(x);
      const py=Math.abs(Number(y))<=1?Number(y)*size.height:Number(y);
      const combo=clamp(Math.max(1,Number(streak)||1),1,8);
      const n=Math.min(6,2+Math.floor((combo-1)/2));
      let made=0;
      for(let i=0;i<n;i++){
        const a=(Math.PI*2*i/n)+(Math.random()-.5)*.55;
        const spd=(52+Math.random()*72)*(1+combo*.035);
        const color=i%3===0?this.worldDef.secondary:this.worldDef.accent;
        const world=this.worldDef.id;
        const p=this._spawn(g=>{
          if(world==="SUMMER_STORM") rect(g,-1,-5,2,10+Math.random()*7,color,.72);
          else if(world==="AUTUMN_DECAY") { rect(g,-3,-2,6+Math.random()*3,4,color,.68); g.rotation=(Math.random()-.5)*.8; }
          else if(world==="WINTER_FROST") ring(g,2+Math.random()*2,color,1.2,.78);
          else if(world==="NEON_RIFT") rect(g,-2,-2,4+Math.random()*2,4+Math.random()*2,color,.78);
          else circle(g,1.8+Math.random()*2.4,color,.72);
        },{
          x:px,y:py,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-(world==="SUMMER_STORM"?18:0),
          gravity:world==="SPRING_BLOOM"||world==="AUTUMN_DECAY"?34:10,
          life:.24+Math.random()*.18,decay:1,rotationSpeed:(Math.random()-.5)*2.4,
          scaleDecay:world==="VOID_CHAMBER"?.9:0
        });
        if(p)made++;
      }
      return made;
    }

    /**
     * Cheap local world feedback. This replaces the old generic tap burst so each world
     * keeps a recognizable feel without bringing back a tap-count phase loop.
     */
    reactToPlayerEvent(event,target,plan,sensoryState){
      if(plan&&plan.world&&(!this.worldDef||this.worldDef.id!==plan.world))this.setWorld(plan.world,plan.intensity);
      if(sensoryState)this.sensory=Object.assign({},this.sensory,sensoryState);
      const density=clamp(Number(this.sensory.density)||0,0,3);
      if(density===0||!this.worldDef)return 0;
      const type=String(event&&event.type||"").toUpperCase();
      if(type==="HOLD_PROGRESS"||type==="DRAG_MOVE"||type==="RELEASE")return 0;
      const now=(global.performance&&global.performance.now)?global.performance.now():Date.now();
      const gap=density===1?115:(density===2?85:60);
      if(now-this.lastReactionAt<gap)return 0;
      this.lastReactionAt=now;

      const size=this._size();
      let x=target&&Number.isFinite(target.x)?target.x:size.width/2;
      let y=target&&Number.isFinite(target.y)?target.y:size.height/2;
      if(event&&Number.isFinite(event.x))x=Math.abs(event.x)<=1?event.x*size.width:event.x;
      if(event&&Number.isFinite(event.y))y=Math.abs(event.y)<=1?event.y*size.height:event.y;
      const strength=density===1?.42:(density===2?.68:.92);
      const special=["HOLD_COMPLETE","WAIT_SUCCESS","WAIT_BROKEN","RELEASE_EARLY","SLICE"].includes(type);

      switch(this.worldDef.id){
        case "SPRING_BLOOM":
          this.petalBloom(x,y,special?strength*1.25:strength); if(special)this.ring(x,y,.45); break;
        case "SUMMER_STORM":
          this.rainBurst(x,y,strength); if(special)this.shockwave(x,y,.5+strength*.35); break;
        case "AUTUMN_DECAY":
          this.leafFall(x,y,strength); if(special)this.dustDissolve(x,y,.5+strength*.3); break;
        case "WINTER_FROST":
          this.frostPulse(x,y,strength); if(special)this.freezeCrack(x,y,.45+strength*.4); break;
        case "VOID_CHAMBER":
          this.voidSuction(x,y,strength); if(special&&density>=2)this.blackoutReveal(x,y,.22); break;
        case "NEON_RIFT":
        default:
          this.pixelScatter(x,y,strength); if(special||density>=2)this.glitchBars(.35+strength*.35); break;
      }
      return 1;
    }

    _worldTransition(x,y,strength){
      if(!this.worldDef)return;
      const k=clamp(Number(strength)||.5,.25,1);
      // World changes are meaningful beats, so even a QUIET world gets one cheap identity cue.
      switch(this.worldDef.id){
        case "SPRING_BLOOM": this.ring(x,y,.65); if(this.sensory.density>0)this.petalBloom(x,y,.55); break;
        case "SUMMER_STORM": this.stormFlash(.45+k*.25); break;
        case "AUTUMN_DECAY": this.ring(x,y,.5); if(this.sensory.density>0)this.leafFall(x,y,.5); break;
        case "WINTER_FROST": this.frostPulse(x,y,.65); break;
        case "VOID_CHAMBER": this.blackoutReveal(x,y,.18+k*.12); break;
        case "NEON_RIFT": default: this.neonSlice(.45+k*.2); break;
      }
    }

    // Retained legacy effect vocabulary as a pooled effect library. These are no longer
    // driven by tap-count phases; directors/compositions may reuse them deliberately.
    portal(x,y,strength){
      if(!this.worldDef)this.setWorld("NEON_RIFT",.4);
      const k=clamp(Number(strength)||.6,.2,1.4);
      return this._spawn(g=>{for(let i=0;i<4;i++)ring(g,28+i*14,i%2?this.worldDef.accent:0xffffff,2+i,.18+.12*i);},
        {x,y,life:1.15+k*.45,decay:1,rotationSpeed:(Math.random()-.5)*(1.2+k),scaleGrowth:.18});
    }
    glitch(strength){return this.glitchBars(strength);}
    fracture(x,y,strength){return this.freezeCrack(x,y,strength);}
    absorb(x,y,strength){this.voidSuction(x,y,strength);if(this.sensory.density>=2)this.ring(x,y,.65);}
    swarm(x,y,strength){return this.burst(x,y,this._count(0,6,16),strength||.65);}

    burst(x,y,count,strength){
      if(!this.worldDef)this.setWorld("NEON_RIFT",.4);
      const density=clamp(Number(this.sensory.density)||0,0,3);
      if(density===0)return 0;
      const caps=[0,4,10,24],requested=Math.max(0,Math.round(Number(count)||0));
      const n=Math.min(caps[density],requested||caps[density]);
      const size=this._size(),px=Number(x)<=1?Number(x)*size.width:Number(x),py=Number(y)<=1?Number(y)*size.height:Number(y);
      let made=0;
      for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2,spd=(45+Math.random()*150)*(Number(strength)||1);
        const p=this._spawn(g=>circle(g,1.6+Math.random()*3.1,i%5===0?0xffffff:this.worldDef.accent,.55+Math.random()*.35),
          {x:px,y:py,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:.35+Math.random()*.45,decay:1,gravity:22});
        if(p)made++;
      }
      return made;
    }

    ring(x,y,strength){
      if(!this.worldDef)this.setWorld("NEON_RIFT",.4);
      return this._spawn(g=>ring(g,22+(strength||1)*10,this.worldDef.accent,2,.66),
        {x,y,vx:0,vy:0,life:.55,decay:1,scaleGrowth:2.2});
    }
    pulse(x,y,strength){return this.ring(x,y,strength||.7);}
    shockwave(x,y,strength){const n=this.sensory.density>=3?3:1;for(let i=0;i<n;i++)this._spawn(g=>ring(g,24+i*16,this.worldDef.accent,2,.65-i*.1),{x,y,life:.7,decay:1,scaleGrowth:1.8+(strength||1)});}
    echoRings(x,y,strength){this.shockwave(x,y,strength);}
    petalBloom(x,y,strength){this.burst(x,y,this._count(3,8,18),.55*(strength||1));}
    rainBurst(x,y,strength){const size=this._size(),n=this._count(3,8,18);for(let i=0;i<n;i++)this._spawn(g=>rect(g,-1,0,2,10+Math.random()*16,this.worldDef.secondary,.42),{x:Math.random()*size.width,y:-15-Math.random()*60,vx:-10,vy:170+Math.random()*120,life:.8,decay:1});}
    leafFall(x,y,strength){const n=this._count(3,7,16);for(let i=0;i<n;i++)this._spawn(g=>circle(g,2.5+Math.random()*3.5,this.worldDef.accent,.55),{x:x+(Math.random()-.5)*130,y:y-30-Math.random()*70,vx:(Math.random()-.5)*35,vy:35+Math.random()*45,life:1,decay:1,rotationSpeed:(Math.random()-.5)*2});}
    dustDissolve(x,y,strength){this.burst(x,y,this._count(2,6,14),.4+(strength||1)*.3);}
    freezeCrack(x,y,strength){this._spawn(g=>{const b=this._count(2,5,8);for(let i=0;i<b;i++){const a=i/b*Math.PI*2+Math.random()*.3,l=25+Math.random()*40*(strength||1);g.moveTo(0,0).lineTo(Math.cos(a)*l,Math.sin(a)*l);}g.stroke({color:this.worldDef.accent,width:1.5,alpha:.7});},{x,y,life:.65,decay:1});}
    frostPulse(x,y,strength){this.ring(x,y,.5+(strength||1)*.4);}
    voidSuction(x,y,strength){const n=this._count(3,8,18),r=80;for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;this._spawn(g=>circle(g,2+Math.random()*2,this.worldDef.secondary,.62),{x:px,y:py,vx:(x-px)*.8,vy:(y-py)*.8,life:.8,decay:1,scaleDecay:.8});}}
    gravityWell(x,y,strength){this.voidSuction(x,y,strength);if(this.sensory.density>=2)this.blackoutReveal(x,y,.35);}
    blackoutReveal(x,y,strength){const s=this._size();this._spawn(g=>rect(g,0,0,s.width,s.height,0x000000,Math.min(.82,.38+(strength||1)*.16)),{x:0,y:0,life:.38,decay:1});}
    glitchBars(strength){const s=this._size(),n=this._count(2,4,8);for(let i=0;i<n;i++)this._spawn(g=>rect(g,0,0,s.width*(.2+Math.random()*.6),3+Math.random()*8,this.worldDef.accent,.2),{x:Math.random()*s.width,y:Math.random()*s.height,vx:(Math.random()-.5)*80,life:.18+Math.random()*.15,decay:1});}
    neonSlice(strength){const s=this._size(),vertical=Math.random()<.5;this._spawn(g=>vertical?rect(g,0,0,3,s.height,this.worldDef.accent,.5):rect(g,0,0,s.width,3,this.worldDef.accent,.5),{x:vertical?Math.random()*s.width:0,y:vertical?0:Math.random()*s.height,life:.22,decay:1});}
    pixelScatter(x,y,strength){this.burst(x,y,this._count(3,9,20),strength);}
    mirrorSplit(x,y,strength){const s=this._size();this._spawn(g=>{g.moveTo(s.width/2,0).lineTo(s.width/2,s.height).stroke({color:this.worldDef.accent,width:2,alpha:.38});},{x:0,y:0,life:.42,decay:1});this.ring(x,y,.6);this.ring(s.width-x,y,.6);}
    spotlight(x,y,strength){this.ring(x,y,.8);}
    softFade(strength){if(this.sensory.density===0)return;const s=this._size();this._spawn(g=>rect(g,0,0,s.width,s.height,this.worldDef.secondary,Math.min(.1,.025+(strength||1)*.025)),{x:0,y:0,life:.32,decay:1});}
    stormFlash(strength){const s=this._size();this._spawn(g=>rect(g,0,0,s.width,s.height,0xffffff,Math.min(.42,.1+(strength||1)*.18)),{x:0,y:0,life:.14,decay:1});}
    chaosAccent(){if(!this.worldDef)this.setWorld("NEON_RIFT",.6);const s=this._size();this._spawn(g=>rect(g,0,0,s.width,s.height,this.worldDef.accent,.1),{x:0,y:0,life:.16,decay:1});this.echoRings(s.width/2,s.height/2,1.2);}
    crowdBurst(x,y,strength){this.burst(x,y,24,.75+(Number(strength)||.5)*.3);}

    _spawn(draw,state,ambient){
      const parent=ambient?this.ambient:this.foreground,g=this.pool.acquire(parent);if(!g)return null;
      try{draw(g);}catch(e){this.pool.release(g);return null;}
      const p=Object.assign({view:g,vx:0,vy:0,life:1,decay:1,gravity:0,ambient:!!ambient,rotationSpeed:0,scaleGrowth:0,scaleDecay:0},state||{});
      g.x=Number(p.x)||0;g.y=Number(p.y)||0;
      this.particles.push(p);return p;
    }

    _reconcileAmbient(target){
      target=Math.round(clamp(target,0,42));
      const amb=this.particles.filter(p=>p.ambient);
      while(amb.length>target){const p=amb.pop();this._releaseParticle(p);}
      if(!this.worldDef||amb.length>=target)return;
      const s=this._size();
      for(let i=amb.length;i<target;i++){
        const state=this._ambientState(s);
        this._spawn(g=>this._drawAmbient(g),state,true);
      }
    }

    _drawAmbient(g){
      const d=this.worldDef||catalog.WORLDS.NEON_RIFT,c=Math.random()<.68?d.accent:d.secondary,a=.13+Math.random()*.19;
      switch(d.particle){
        case "petal":
          circle(g,2.6+Math.random()*1.8,c,a); circle(g,2+Math.random()*1.4,c,a*.7); g.scale.x=.65; g.scale.y=1.25; break;
        case "spark":
          rect(g,-1,-5,2,10+Math.random()*8,c,a+.08); break;
        case "leaf":
          rect(g,-3,-1.5,6+Math.random()*3,3,c,a+.04); g.rotation=(Math.random()-.5)*.8; break;
        case "snow":
          ring(g,2+Math.random()*2,c,1,a+.08); break;
        case "dust":
          circle(g,1+Math.random()*2,c,a); break;
        case "pixel":
        default:
          rect(g,-2,-2,3+Math.random()*3,3+Math.random()*3,c,a+.04); break;
      }
    }

    _ambientState(s){
      const motion=(this.worldDef&&this.worldDef.motion)||"float";
      const x=Math.random()*s.width,y=Math.random()*s.height,state={x,y,baseX:x,baseY:y,vx:0,vy:0,life:1,decay:0,motion,phase:Math.random()*Math.PI*2};
      if(motion==="fall"){state.vx=(Math.random()-.5)*8;state.vy=11+Math.random()*14;}
      else if(motion==="drift"){state.vx=(Math.random()-.5)*6;state.vy=3+Math.random()*7;}
      else if(motion==="burst"){state.vx=(Math.random()-.5)*10;state.vy=8+Math.random()*16;}
      else if(motion==="float"){state.vx=(Math.random()-.5)*7;state.vy=(Math.random()-.5)*5;}
      return state;
    }

    _clearAmbient(){
      for(let i=this.particles.length-1;i>=0;i--)if(this.particles[i].ambient){this.pool.release(this.particles[i].view);this.particles.splice(i,1);}
    }

    _tick(delta){
      const dt=Math.min(.05,(Number(delta&&delta.deltaMS)||16.67)/1000),s=this._size();
      for(let i=this.particles.length-1;i>=0;i--){
        const p=this.particles[i],g=p.view;if(!g){this.particles.splice(i,1);continue;}
        g.x+=p.vx*dt;g.y+=p.vy*dt;p.vy+=p.gravity*dt;
        if(p.rotationSpeed)g.rotation+=p.rotationSpeed*dt;
        if(p.ambient){
          if(p.motion==="orbit"){
            p.phase=(p.phase||0)+dt*.35;g.x=p.baseX+Math.cos(p.phase)*8;g.y=p.baseY+Math.sin(p.phase)*8;
          }else if(p.motion==="jitter"){
            p.phase=(p.phase||0)+dt*5;g.x=p.baseX+Math.sin(p.phase*1.7)*2.2;g.y=p.baseY+Math.cos(p.phase*2.1)*1.6;
          }else{
            if(g.x<0)g.x=s.width;if(g.x>s.width)g.x=0;if(g.y<0)g.y=s.height;if(g.y>s.height)g.y=0;
          }
          continue;
        }
        p.life-=dt*p.decay;g.alpha=clamp(p.life,0,1);
        if(p.scaleGrowth){const v=g.scale.x+p.scaleGrowth*dt;g.scale.set(v);}
        if(p.scaleDecay){const v=Math.max(0,g.scale.x-p.scaleDecay*dt);g.scale.set(v);}
        if(p.life<=0){this.pool.release(g);this.particles.splice(i,1);}
      }
    }

    _releaseParticle(p){if(!p)return;const i=this.particles.indexOf(p);if(i>=0)this.particles.splice(i,1);if(p.view)this.pool.release(p.view);}
    _clearTransient(){for(let i=this.particles.length-1;i>=0;i--){if(!this.particles[i].ambient){this.pool.release(this.particles[i].view);this.particles.splice(i,1);}}}
    _clearAll(){for(const p of this.particles)this.pool.release(p.view);this.particles.length=0;}
    _count(normal,busy,chaos){const d=clamp(Number(this.sensory.density)||0,0,3);return d===0?0:(d===1?normal:(d===2?busy:chaos));}
    _size(){const s=this.app&&this.app.renderer&&this.app.renderer.screen;return{width:s&&Number.isFinite(s.width)?s.width:(global.innerWidth||360),height:s&&Number.isFinite(s.height)?s.height:(global.innerHeight||640)};}
    diagnostics(){return{activeParticles:this.particles.filter(p=>!p.ambient).length,ambientParticles:this.particles.filter(p=>p.ambient).length,pool:this.pool.stats()};}
  }

  global.WorldFxController=WorldFxController;
})(window);
