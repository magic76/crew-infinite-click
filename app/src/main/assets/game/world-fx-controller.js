(function (global) {
  "use strict";
  const catalog = global.GameWorldCatalog;
  if (!catalog) throw new Error("world-fx-controller.js requires world-catalog.js");

  function setBackground(app,color) {
    if (!app || !app.renderer) return;
    try {
      if (app.renderer.background && "color" in app.renderer.background) app.renderer.background.color=color;
      else app.renderer.backgroundColor=color;
    } catch (_) {}
  }

  function fillCircle(g,x,y,r,color,alpha) {
    if (typeof g.circle === "function" && typeof g.fill === "function") g.circle(x,y,r).fill({color,alpha});
    else { g.beginFill(color,alpha); g.drawCircle(x,y,r); g.endFill(); }
  }

  function fillRect(g,x,y,w,h,color,alpha) {
    if (typeof g.rect === "function" && typeof g.fill === "function") g.rect(x,y,w,h).fill({color,alpha});
    else { g.beginFill(color,alpha); g.drawRect(x,y,w,h); g.endFill(); }
  }

  function strokeCircle(g,x,y,r,color,width,alpha) {
    if (typeof g.circle === "function" && typeof g.stroke === "function") g.circle(x,y,r).stroke({color,width,alpha});
    else { g.lineStyle(width,color,alpha); g.drawCircle(x,y,r); }
  }

  function strokeLine(g,x1,y1,x2,y2,color,width,alpha) {
    if (typeof g.moveTo === "function" && typeof g.lineTo === "function" && typeof g.stroke === "function") {
      g.moveTo(x1,y1).lineTo(x2,y2).stroke({color,width,alpha});
    } else {
      g.lineStyle(width,color,alpha); g.moveTo(x1,y1); g.lineTo(x2,y2);
    }
  }

  class WorldFxController {
    constructor(app) {
      if (!global.PIXI) throw new Error("WorldFxController requires PIXI");
      this.app=app;
      this.world=null;
      this.worldDef=null;
      this.particles=[];
      this.maxAmbient=42;
      this.sensory={density:1,ambientTarget:4,burstMultiplier:0.38,motion:1,brightness:1,visualEffect:"SOFT_FADE"};
      this.previousDensity=1;
      this.ambient=new global.PIXI.Container();
      this.foreground=new global.PIXI.Container();
      // Decorative effects must never steal clicks from gameplay targets.
      try { this.ambient.eventMode="none"; this.foreground.eventMode="none"; } catch (_) {}
      try { this.ambient.interactiveChildren=false; this.foreground.interactiveChildren=false; } catch (_) {}
      if (app && app.stage) { app.stage.addChildAt(this.ambient,0); app.stage.addChild(this.foreground); }
      this._tick=this._tick.bind(this);
      if (app && app.ticker) app.ticker.add(this._tick);
    }

    destroy() {
      if (this.app && this.app.ticker) this.app.ticker.remove(this._tick);
      this._clearContainer(this.ambient); this._clearContainer(this.foreground); this.particles.length=0;
    }

    setSensoryState(state) {
      const before=Number(this.sensory&&this.sensory.density)||0;
      this.sensory=Object.assign({},this.sensory,state||{});
      const after=Number(this.sensory&&this.sensory.density)||0;
      const ambientTarget=Number.isFinite(Number(this.sensory.ambientTarget))?Number(this.sensory.ambientTarget):0;

      // The contrast itself is an effect. QUIET must actually become visually empty.
      if (after===0) {
        this._clearTransient();
        this._reconcileAmbient(0);
      } else {
        this._reconcileAmbient(Math.max(0,Math.min(this.maxAmbient,ambientTarget)));
      }

      // Entering CHAOS gets a short unmistakable screen-wide accent.
      if (after===3 && before<3) this.chaosAccent();
      this.previousDensity=after;
    }

    setWorld(worldId,intensity) {
      const next=catalog.WORLDS[worldId]||catalog.WORLDS.NEON_RIFT;
      const changed=!this.worldDef||this.worldDef.id!==next.id;
      this.world=next.id; this.worldDef=next; setBackground(this.app,next.bg);
      if (changed) {
        this._clearContainer(this.ambient);
        this.particles=this.particles.filter(p=>!p.ambient);
        const target=Number.isFinite(Number(this.sensory.ambientTarget))?this.sensory.ambientTarget:Math.round(6+Math.max(0,Math.min(1,Number(intensity)||0.3))*12);
        this._reconcileAmbient(target);
      }
      return changed;
    }

    applyPlan(plan,target,sensoryState) {
      if (!plan) return;
      if (sensoryState) this.setSensoryState(sensoryState);
      const changed=this.setWorld(plan.world,plan.intensity);
      const x=target&&Number.isFinite(target.x)?target.x:this._centerX();
      const y=target&&Number.isFinite(target.y)?target.y:this._centerY();

      if (changed && this.sensory.density>=2) this.echoRings(this._centerX(),this._centerY(),2);
      if (this.sensory.density===0) {
        // Do not decorate QUIET. The empty frame is intentional.
      } else {
        this.playEffect(this.sensory.visualEffect,x,y,plan.intensity,this.sensory);
        if (this.sensory.density===3) this.crowdBurst(x,y,plan.intensity);
      }

      // Situation cue remains small; the sensory effect above is the main visual language.
      if (this.sensory.density<=1) {
        if (plan.situation==="PREDICT") this.ring(x,y,0.65);
        else if (plan.situation==="WAIT") this.pulse(x,y,0.45);
      }
    }

    playEffect(effect,x,y,strength,state) {
      const e=effect||"SOFT_FADE";
      if (e==="NONE") return;
      const s=state||this.sensory;
      const k=Math.max(0.2,Math.min(1.6,(Number(strength)||0.45)*(0.65+(Number(s.burstMultiplier)||0.6))));
      switch (e) {
        case "PETAL_BLOOM": return this.petalBloom(x,y,k);
        case "STORM_FLASH": return this.stormFlash(k);
        case "RAIN_BURST": return this.rainBurst(x,y,k);
        case "LEAF_FALL": return this.leafFall(x,y,k);
        case "DUST_DISSOLVE": return this.dustDissolve(x,y,k);
        case "FREEZE_CRACK": return this.freezeCrack(x,y,k);
        case "FROST_PULSE": return this.frostPulse(x,y,k);
        case "VOID_SUCTION": return this.voidSuction(x,y,k);
        case "GRAVITY_WELL": return this.gravityWell(x,y,k);
        case "BLACKOUT_REVEAL": return this.blackoutReveal(x,y,k);
        case "GLITCH_BARS": return this.glitchBars(k);
        case "NEON_SLICE": return this.neonSlice(k);
        case "PIXEL_SCATTER": return this.pixelScatter(x,y,k);
        case "MIRROR_SPLIT": return this.mirrorSplit(x,y,k);
        case "SHOCKWAVE": return this.shockwave(x,y,k);
        case "ECHO_RINGS": return this.echoRings(x,y,k);
        case "SPOTLIGHT": return this.spotlight(x,y,k);
        default: return this.softFade(k);
      }
    }

    burst(x,y,count,strength) {
      if (!this.worldDef) this.setWorld("NEON_RIFT",0.4);
      const size=this._viewSize();
      const point=global.GameSafeArea?global.GameSafeArea.clampPoint(x,y,size.width,size.height,{padding:24}):{x,y};
      const rawMultiplier=Number(this.sensory.burstMultiplier);
      const multiplier=Number.isFinite(rawMultiplier)?Math.max(0,rawMultiplier):0.6;
      if (multiplier<=0 || Number(this.sensory.density)===0) return;
      const n=Math.min(40,Math.max(1,Math.round((count||7)*multiplier)));
      for (let i=0;i<n;i++) {
        const g=new global.PIXI.Graphics();
        fillCircle(g,0,0,2.2+Math.random()*4.2,this.worldDef.accent,0.68);
        g.x=point.x; g.y=point.y; this.foreground.addChild(g);
        const angle=Math.random()*Math.PI*2, speed=(0.7+Math.random()*2.0)*(strength||1)*(0.7+this.sensory.motion*0.15);
        this.particles.push({view:g,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:1,decay:0.025+Math.random()*0.025,ambient:false});
      }
    }

    ring(x,y,strength) {
      if (!this.worldDef) this.setWorld("NEON_RIFT",0.4);
      const g=new global.PIXI.Graphics(), radius=22+(strength||1)*10;
      strokeCircle(g,0,0,radius,this.worldDef.accent,2,0.7);
      g.x=x; g.y=y; this.foreground.addChild(g);
      this.particles.push({view:g,vx:0,vy:0,life:1,decay:0.035,ambient:false,scaleGrowth:0.035});
    }

    pulse(x,y,strength) { this.ring(x,y,strength||0.7); }

    shockwave(x,y,strength) {
      const n=this.sensory.density>=3?4:2;
      for (let i=0;i<n;i++) {
        const g=new global.PIXI.Graphics();
        strokeCircle(g,0,0,24+i*18,this.worldDef.accent,2.2,0.72-i*0.1);
        g.x=x; g.y=y; this.foreground.addChild(g);
        this.particles.push({view:g,vx:0,vy:0,life:1,decay:0.025+i*0.006,ambient:false,scaleGrowth:0.025+(strength||1)*0.018});
      }
    }

    echoRings(x,y,strength) { this.shockwave(x,y,Math.max(0.5,(strength||1)*0.8)); }

    petalBloom(x,y,strength) {
      const n=this._count(4,11,22);
      for (let i=0;i<n;i++) {
        const angle=(i/Math.max(1,n))*Math.PI*2+Math.random()*0.35;
        const g=new global.PIXI.Graphics();
        fillCircle(g,0,0,3+Math.random()*4,Math.random()<0.55?this.worldDef.accent:this.worldDef.secondary,0.62);
        g.x=x; g.y=y; this.foreground.addChild(g);
        const speed=(0.35+Math.random()*1.4)*(strength||1);
        this.particles.push({view:g,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-0.25,life:1,decay:0.012+Math.random()*0.018,ambient:false,rotationSpeed:(Math.random()-0.5)*0.06});
      }
      if (this.sensory.density>=2) this.ring(x,y,0.8);
    }

    stormFlash(strength) {
      const size=this._viewSize(), g=new global.PIXI.Graphics();
      fillRect(g,0,0,size.width,size.height,0xFFFFFF,Math.min(0.52,0.14+(strength||1)*0.22));
      this.foreground.addChild(g);
      this.particles.push({view:g,vx:0,vy:0,life:1,decay:this.sensory.density>=3?0.16:0.24,ambient:false});
      if (this.sensory.density>=2) this.neonSlice(0.55);
    }

    rainBurst(x,y,strength) {
      const size=this._viewSize(), n=this._count(5,13,24);
      for (let i=0;i<n;i++) {
        const g=new global.PIXI.Graphics();
        const px=Math.random()*size.width, py=Math.max(-20,y-80-Math.random()*size.height*0.35);
        fillRect(g,0,0,1.5+Math.random()*2,10+Math.random()*22,this.worldDef.secondary,0.42);
        g.x=px; g.y=py; this.foreground.addChild(g);
        this.particles.push({view:g,vx:-0.25,vy:4.0+Math.random()*3.2*(strength||1),life:1,decay:0.008,ambient:false});
      }
    }

    leafFall(x,y,strength) {
      const n=this._count(4,10,18);
      for (let i=0;i<n;i++) {
        const g=new global.PIXI.Graphics();
        fillCircle(g,0,0,3+Math.random()*4,Math.random()<0.5?this.worldDef.accent:this.worldDef.secondary,0.55);
        g.x=x+(Math.random()-0.5)*150; g.y=y-40-Math.random()*90; this.foreground.addChild(g);
        this.particles.push({view:g,vx:(Math.random()-0.5)*0.8,vy:0.7+Math.random()*1.1*(strength||1),life:1,decay:0.008+Math.random()*0.008,ambient:false,rotationSpeed:(Math.random()-0.5)*0.08});
      }
    }

    dustDissolve(x,y,strength) { this.burst(x,y,this._count(3,8,15),0.45+(strength||1)*0.4); }

    freezeCrack(x,y,strength) {
      const g=new global.PIXI.Graphics();
      const branches=this._count(3,6,10);
      for (let i=0;i<branches;i++) {
        const a=(i/branches)*Math.PI*2+Math.random()*0.32;
        const len=28+Math.random()*45*(strength||1);
        strokeLine(g,0,0,Math.cos(a)*len,Math.sin(a)*len,this.worldDef.accent,1.2+Math.random()*1.4,0.7);
      }
      g.x=x; g.y=y; this.foreground.addChild(g);
      this.particles.push({view:g,vx:0,vy:0,life:1,decay:0.022,ambient:false});
      if (this.sensory.density>=2) this.ring(x,y,0.9);
    }

    frostPulse(x,y,strength) {
      this.ring(x,y,0.5+(strength||1)*0.45);
      if (this.sensory.density>=2) this.freezeCrack(x,y,0.5);
    }

    voidSuction(x,y,strength) {
      const n=this._count(5,12,22), radius=70+40*(strength||1);
      for (let i=0;i<n;i++) {
        const a=Math.random()*Math.PI*2, r=radius*(0.55+Math.random()*0.8);
        const px=x+Math.cos(a)*r, py=y+Math.sin(a)*r;
        const g=new global.PIXI.Graphics(); fillCircle(g,0,0,2+Math.random()*3,this.worldDef.secondary,0.62);
        g.x=px; g.y=py; this.foreground.addChild(g);
        const speed=1.0+Math.random()*1.8;
        this.particles.push({view:g,vx:(x-px)/r*speed,vy:(y-py)/r*speed,life:1,decay:0.015+Math.random()*0.016,ambient:false,scaleDecay:0.008});
      }
      this.ring(x,y,0.75);
    }

    gravityWell(x,y,strength) { this.voidSuction(x,y,0.8+(strength||1)*0.4); if (this.sensory.density>=2) this.blackoutReveal(x,y,0.45); }

    blackoutReveal(x,y,strength) {
      const size=this._viewSize(), g=new global.PIXI.Graphics();
      fillRect(g,0,0,size.width,size.height,0x000000,Math.min(0.88,0.42+(strength||1)*0.18));
      this.foreground.addChild(g);
      this.particles.push({view:g,vx:0,vy:0,life:1,decay:this.sensory.density>=3?0.055:0.085,ambient:false});
      this.ring(x,y,0.65);
    }

    glitchBars(strength) {
      const size=this._viewSize(), n=this._count(2,5,10);
      for (let i=0;i<n;i++) {
        const g=new global.PIXI.Graphics();
        const h=3+Math.random()*13, y=Math.random()*size.height;
        const color=Math.random()<0.5?this.worldDef.accent:this.worldDef.secondary;
        fillRect(g,-20,y,size.width+40,h,color,0.16+Math.random()*0.28);
        this.foreground.addChild(g);
        this.particles.push({view:g,vx:(Math.random()-0.5)*4*(strength||1),vy:0,life:1,decay:0.06+Math.random()*0.06,ambient:false});
      }
    }

    neonSlice(strength) {
      const size=this._viewSize(), vertical=Math.random()<0.5, g=new global.PIXI.Graphics();
      if (vertical) fillRect(g,Math.random()*size.width,0,2+Math.random()*4,size.height,this.worldDef.accent,0.55);
      else fillRect(g,0,Math.random()*size.height,size.width,2+Math.random()*4,this.worldDef.accent,0.55);
      this.foreground.addChild(g);
      this.particles.push({view:g,vx:0,vy:0,life:1,decay:0.10+(strength||1)*0.03,ambient:false});
      if (this.sensory.density>=3) this.glitchBars(0.8);
    }

    pixelScatter(x,y,strength) {
      const n=this._count(4,12,22);
      for (let i=0;i<n;i++) {
        const g=new global.PIXI.Graphics(), s=2+Math.random()*5;
        fillRect(g,-s/2,-s/2,s,s,Math.random()<0.5?this.worldDef.accent:this.worldDef.secondary,0.7);
        g.x=x; g.y=y; this.foreground.addChild(g);
        const a=Math.random()*Math.PI*2, speed=(0.8+Math.random()*2.6)*(strength||1);
        this.particles.push({view:g,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:1,decay:0.03+Math.random()*0.025,ambient:false});
      }
    }

    mirrorSplit(x,y,strength) {
      const size=this._viewSize(), g=new global.PIXI.Graphics();
      strokeLine(g,size.width/2,0,size.width/2,size.height,this.worldDef.accent,2,0.42);
      this.foreground.addChild(g); this.particles.push({view:g,vx:0,vy:0,life:1,decay:0.05,ambient:false});
      const mirroredX=size.width-x;
      this.ring(x,y,0.7); this.ring(mirroredX,y,0.7);
      if (this.sensory.density>=2) this.burst(mirroredX,y,7,strength||0.8);
    }

    spotlight(x,y,strength) {
      const size=this._viewSize(), g=new global.PIXI.Graphics();
      fillRect(g,0,0,size.width,size.height,0x000000,Math.min(0.52,0.18+(strength||1)*0.14));
      this.foreground.addChild(g); this.particles.push({view:g,vx:0,vy:0,life:1,decay:0.08,ambient:false});
      this.ring(x,y,0.85);
    }

    softFade(strength) {
      if (this.sensory.density===0) return;
      const size=this._viewSize(), g=new global.PIXI.Graphics();
      fillRect(g,0,0,size.width,size.height,this.worldDef.secondary,Math.min(0.12,0.035+(strength||1)*0.03));
      this.foreground.addChild(g); this.particles.push({view:g,vx:0,vy:0,life:1,decay:0.08,ambient:false});
    }


    chaosAccent() {
      if (!this.worldDef) this.setWorld("NEON_RIFT",0.6);
      const size=this._viewSize();
      const g=new global.PIXI.Graphics();
      fillRect(g,0,0,size.width,size.height,this.worldDef.accent,0.12);
      this.foreground.addChild(g);
      this.particles.push({view:g,vx:0,vy:0,life:1,decay:0.14,ambient:false});
      this.echoRings(size.width/2,size.height/2,1.4);
    }

    crowdBurst(x,y,strength) {
      if (!this.worldDef) this.setWorld("NEON_RIFT",0.7);
      const size=this._viewSize();
      const count=30+Math.floor(Math.random()*12);
      for (let i=0;i<count;i++) {
        const g=new global.PIXI.Graphics();
        const w=10+Math.random()*24, h=6+Math.random()*14;
        const color=Math.random()<0.5?this.worldDef.accent:this.worldDef.secondary;
        fillRect(g,-w/2,-h/2,w,h,color,0.18+Math.random()*0.24);
        g.x=Math.random()*size.width; g.y=Math.random()*size.height;
        g.rotation=(Math.random()-0.5)*0.5;
        this.foreground.addChild(g);
        const dx=(g.x-x), dy=(g.y-y), len=Math.max(1,Math.hypot(dx,dy));
        const push=(0.25+Math.random()*0.9)*(0.8+(Number(strength)||0.5));
        this.particles.push({view:g,vx:(dx/len)*push,vy:(dy/len)*push,life:1,decay:0.035+Math.random()*0.025,ambient:false,rotationSpeed:(Math.random()-0.5)*0.05});
      }
    }

    _clearTransient() {
      for (let i=this.particles.length-1;i>=0;i--) {
        const p=this.particles[i];
        if (p.ambient) continue;
        const v=p.view;
        if (v&&v.parent) v.parent.removeChild(v);
        if (v&&typeof v.destroy==="function") v.destroy();
        this.particles.splice(i,1);
      }
      this._clearContainer(this.foreground);
    }
    _reconcileAmbient(target) {
      if (!this.worldDef) return;
      target=Math.round(Math.max(0,Math.min(this.maxAmbient,target)));
      let ambient=this.particles.filter(p=>p.ambient);
      while (ambient.length>target) {
        const p=ambient.pop();
        if (p&&p.view) { if (p.view.parent) p.view.parent.removeChild(p.view); if (typeof p.view.destroy==="function") p.view.destroy(); }
        const idx=this.particles.indexOf(p); if (idx>=0) this.particles.splice(idx,1);
      }
      if (ambient.length<target) this._seedAmbient(target-ambient.length);
    }

    _seedAmbient(amount) {
      const size=this._viewSize();
      for (let i=0;i<Math.min(this.maxAmbient,Math.max(0,amount));i++) {
        // Ambient/background decoration may fill the full screen; only interactive targets use safe bounds.
        const p={x:Math.random()*size.width,y:Math.random()*size.height};
        const g=new global.PIXI.Graphics(), r=1.2+Math.random()*3.0;
        const color=Math.random()<0.7?this.worldDef.accent:this.worldDef.secondary;
        fillCircle(g,0,0,r,color,0.14+Math.random()*0.24); g.x=p.x; g.y=p.y; this.ambient.addChild(g);
        this.particles.push({view:g,vx:(Math.random()-0.5)*0.35,vy:this._ambientVy(),life:1,decay:0,ambient:true});
      }
    }

    _ambientVy() {
      if (!this.worldDef) return 0.1;
      const scale=0.5+Math.max(0,Math.min(3,Number(this.sensory.motion)||0))*0.22;
      let v;
      switch(this.worldDef.motion) {
        case "fall": v=0.28+Math.random()*0.32; break;
        case "drift": v=0.12+Math.random()*0.18; break;
        case "burst": v=(Math.random()-0.5)*0.45; break;
        default: v=(Math.random()-0.5)*0.18;
      }
      return v*scale;
    }

    _tick(delta) {
      const d=Number(delta&&delta.deltaTime)||Number(delta)||1;
      const size=this._viewSize();
      for (let i=this.particles.length-1;i>=0;i--) {
        const p=this.particles[i], v=p.view;
        if (!v || v.destroyed) { this.particles.splice(i,1); continue; }
        v.x+=p.vx*d; v.y+=p.vy*d;
        if (p.rotationSpeed) v.rotation+=p.rotationSpeed*d;
        if (p.scaleDecay) { v.scale.x=Math.max(0,v.scale.x-p.scaleDecay*d); v.scale.y=Math.max(0,v.scale.y-p.scaleDecay*d); }
        if (p.ambient) {
          if (v.x<0) v.x=size.width; if (v.x>size.width) v.x=0;
          if (v.y<0) v.y=size.height; if (v.y>size.height) v.y=0;
          continue;
        }
        p.life-=p.decay*d; v.alpha=Math.max(0,p.life);
        if (p.scaleGrowth) { v.scale.x+=p.scaleGrowth*d; v.scale.y+=p.scaleGrowth*d; }
        if (p.life<=0) { if (v.parent) v.parent.removeChild(v); if (typeof v.destroy==="function") v.destroy(); this.particles.splice(i,1); }
      }
    }

    _count(calm,active,impact) {
      const d=Math.max(0,Math.min(3,Number(this.sensory.density)||0));
      if (d===0) return 0;
      if (d===1) return calm;
      if (d===2) return active;
      return impact;
    }

    _centerX(){ return this._viewSize().width/2; }
    _centerY(){ return this._viewSize().height/2; }
    _viewSize(){ const s=this.app&&this.app.renderer&&this.app.renderer.screen; return {width:s&&Number.isFinite(s.width)?s.width:global.innerWidth,height:s&&Number.isFinite(s.height)?s.height:global.innerHeight}; }
    _clearContainer(c){ if (!c) return; const children=c.removeChildren(); for (const child of children) if (child&&typeof child.destroy==="function") child.destroy({children:true}); }
  }

  global.WorldFxController=WorldFxController;
})(window);
