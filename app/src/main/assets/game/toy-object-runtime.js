(function(global){
  "use strict";

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>global.performance&&performance.now?performance.now():Date.now();

  const SPECS=[
    {id:"bumper-a",type:"BUMPER",nx:.79,ny:.54,radius:46,active:true},
    {id:"spring-a",type:"SPRING",nx:.51,ny:.86,radius:52,active:true},
    {id:"gift-a",type:"GIFT",nx:.23,ny:.68,radius:48,active:false,unlockHits:2},
    {id:"balloon-a",type:"BALLOON",nx:.20,ny:.31,radius:42,active:false,unlockHits:4},
    {id:"bumper-b",type:"BUMPER",nx:.52,ny:.25,radius:41,active:false,unlockHits:7}
  ];

  const TYPE_BASE={BUMPER:0xf3a0b5,GIFT:0xff9fc4,BALLOON:0x9bdfff,SPRING:0x8ce2c8};
  // Premium arcade puck / Designer capsule gift / Glassy resin bubble / Polished launch pad
  const ASSET_SCALE={BUMPER:2.34,GIFT:2.34,BALLOON:2.46,SPRING:2.50};

  class ToyObjectRuntime{
    constructor(app,options){
      const o=options||{};
      this.app=app;
      this.parent=o.parent||app.stage;
      this.safeBounds=typeof o.safeBounds==="function"?o.safeBounds:()=>({left:40,top:40,right:app.renderer.screen.width-40,bottom:app.renderer.screen.height-40});
      this.onEvent=typeof o.onEvent==="function"?o.onEvent:()=>{};
      this.rng=typeof o.rng==="function"?o.rng:Math.random;
      this.worldTheme={id:"CANDY_TOY_ROOM",accentA:0xffe987,accentB:0x95d7ff};
      this.root=new global.PIXI.Container();this.root.label="toy-object-runtime";this.root.eventMode="none";this.parent.addChild(this.root);
      this.objects=SPECS.map(s=>this._createObject(s));
      this.hitCount=0;
      this.resize();
    }

    destroy(){
      if(this.root&&this.root.parent)this.root.parent.removeChild(this.root);
      try{this.root&&this.root.destroy({children:true});}catch(_){ }
      this.root=null;this.objects.length=0;
    }

    setWorldTheme(theme){
      if(theme&&theme.id)this.worldTheme={id:String(theme.id),accentA:Number(theme.accentA)||0xffffff,accentB:Number(theme.accentB)||0xffffff};
      for(const o of this.objects){if(o.visibleActive)o.pulse=Math.max(o.pulse,.56);}
    }

    reset(){
      this.hitCount=0;
      for(const o of this.objects){
        o.visibleActive=!!o.active;o.everUnlocked=!!o.active;o.cooldownUntil=0;o.respawnAt=0;o.popUntil=0;o.pulse=0;o.compress=0;o.open=0;o.phase=this.rng()*Math.PI*2;o.bob=0;o.container.visible=o.visibleActive;this._applyVisual(o,now());
      }
      this.resize();
    }

    unlockForHits(hits){
      this.hitCount=Math.max(this.hitCount,Number(hits)||0);
      for(const o of this.objects){
        if(o.visibleActive||o.everUnlocked||!o.unlockHits||this.hitCount<o.unlockHits)continue;
        o.visibleActive=true;o.everUnlocked=true;o.container.visible=true;o.pulse=1;
        this._emit({type:"OBJECT_UNLOCK",objectType:o.type,id:o.id,x:o.x,y:o.y,power:1});
      }
    }

    activateType(type,near){
      const t=String(type||"").toUpperCase(),candidate=this.objects.find(o=>o.type===t&&!o.visibleActive);
      if(!candidate)return false;
      candidate.visibleActive=true;candidate.everUnlocked=true;candidate.container.visible=true;candidate.respawnAt=0;candidate.popUntil=0;candidate.pulse=1;
      if(near&&Number.isFinite(near.x)&&Number.isFinite(near.y)){
        candidate.x=near.x+(this.rng()-.5)*80;candidate.y=near.y+(this.rng()-.5)*70;candidate.container.position.set(candidate.x,candidate.y);
      }
      this._emit({type:"OBJECT_UNLOCK",objectType:candidate.type,id:candidate.id,x:candidate.x,y:candidate.y,power:.9});
      return true;
    }

    handleTap(x,y){
      const t=now();let best=null,bestScore=Infinity;
      for(const o of this.objects){
        if(!o.visibleActive||o.popUntil||t<o.cooldownUntil)continue;
        const dx=x-o.x,dy=y-(o.y+o.bob),d=Math.hypot(dx,dy),limit=o.radius*1.34,score=d/Math.max(1,limit);
        if(score<=1&&score<bestScore){bestScore=score;best={o,d,power:clamp(1-score*.68,.30,1)};}
      }
      if(!best)return {triggered:false};
      const o=best.o,p=best.power;o.pulse=Math.max(o.pulse,p);
      if(o.type==="BUMPER")this._tapBumper(o,x,y,p);
      else if(o.type==="GIFT")this._openGift(o,"TAP",p,null);
      else if(o.type==="BALLOON")this._popBalloon(o,"TAP",p,null);
      else if(o.type==="SPRING")this._tapSpring(o,p);
      return {triggered:true,id:o.id,objectType:o.type,power:p,x:o.x,y:o.y+o.bob};
    }

    tick(deltaMS,pets){
      const t=now(),dt=Math.min(50,Number(deltaMS)||16.67)/1000;
      for(const o of this.objects){
        if(o.popUntil&&t>=o.popUntil){o.popUntil=0;o.visibleActive=false;o.container.visible=false;o.respawnAt=now()+3600+(this._balloonRespawnMs()-3600);continue;}
        if(!o.visibleActive&&o.respawnAt&&t>=o.respawnAt){o.visibleActive=true;o.container.visible=true;o.respawnAt=0;o.pulse=.92;this._emit({type:"OBJECT_RESPAWN",objectType:o.type,id:o.id,x:o.x,y:o.y,power:.7});}
        if(!o.visibleActive)continue;
        o.phase+=dt*(o.type==="BALLOON"?1.55:.95);o.pulse=Math.max(0,o.pulse-dt*2.45);o.compress=Math.max(0,o.compress-dt*3.25);o.open=Math.max(0,o.open-dt*1.65);
        const idleFloat=o.type==="GIFT"?Math.sin(o.phase*.62)*1.8:(o.type==="SPRING"?Math.sin(o.phase*.75)*.7:0);
        o.bob=o.type==="BALLOON"?Math.sin(o.phase)*9:idleFloat;
        this._applyVisual(o,t);
      }
      this._collidePets(Array.isArray(pets)?pets:[],t);
    }

    resize(){
      const b=this.safeBounds(),w=Math.max(1,b.right-b.left),h=Math.max(1,b.bottom-b.top);
      for(const o of this.objects){o.x=b.left+w*o.nx;o.y=b.top+h*o.ny;o.container.position.set(o.x,o.y);o.container.visible=!!o.visibleActive;this._applyVisual(o,now());}
    }

    context(){return this.objects.map(o=>({id:o.id,type:o.type,active:!!o.visibleActive,unlocked:!!o.everUnlocked,x:Math.round(o.x),y:Math.round(o.y),world:this.worldTheme.id}));}

    _createObject(spec){
      const c=new global.PIXI.Container();c.label="toy-object:"+spec.id;c.eventMode="none";
      const worldGlow=new global.PIXI.Graphics();
      const shadow=new global.PIXI.Graphics();
      const aura=new global.PIXI.Graphics();
      const sprite=new global.PIXI.Sprite();sprite.anchor.set(.5,.70);
      const glint=new global.PIXI.Graphics();
      c.addChild(worldGlow,shadow,aura,sprite,glint);this.root.addChild(c);
      return Object.assign({},spec,{container:c,worldGlow,shadow,aura,sprite,glint,x:0,y:0,phase:this.rng()*Math.PI*2,pulse:0,compress:0,open:0,cooldownUntil:0,respawnAt:0,popUntil:0,bob:0,visibleActive:!!spec.active,everUnlocked:!!spec.active});
    }

    _collidePets(pets,t){
      for(const o of this.objects){
        if(!o.visibleActive||o.popUntil||t<o.cooldownUntil)continue;
        for(const pet of pets){
          if(!pet||!pet.isActive||!pet.isActive())continue;
          const pos=pet.position&&pet.position();if(!pos)continue;
          const dx=pos.x-o.x,dy=pos.y-(o.y+o.bob),d=Math.hypot(dx,dy),pr=Math.max(20,pet.collisionRadius?pet.collisionRadius()*.72:35),limit=o.radius+pr;
          if(d>limit||d<=.01)continue;
          const last=o["last_"+pet.id]||0;if(t-last<(o.type==="SPRING"?320:220))continue;o["last_"+pet.id]=t;
          const v=pet.velocity?pet.velocity():{vx:0,vy:0,speed:0};
          if(o.type==="BUMPER")this._bouncePet(o,pet,v,dx,dy,d);
          else if(o.type==="GIFT"&&v.speed>115)this._openGift(o,"PET",clamp(.48+v.speed/850,.48,1),pet);
          else if(o.type==="BALLOON"&&v.speed>105)this._popBalloon(o,"PET",clamp(.45+v.speed/820,.45,1),pet);
          else if(o.type==="SPRING"&&pos.y<=o.y+o.radius*.9&&v.vy>40)this._springPet(o,pet,v);
        }
      }
    }

    _bouncePet(o,pet,v,dx,dy,d){
      const nx=dx/Math.max(1,d),ny=dy/Math.max(1,d),carnival=this.worldTheme.id==="STARLIGHT_CARNIVAL"?1.14:1,speed=Math.max(440,v.speed*1.22+100)*carnival,vx=nx*speed,vy=ny*speed-(ny>.2?60:24);
      pet.launch(vx,vy,"PANIC");o.pulse=1;o.cooldownUntil=now()+115;
      this._emit({type:"BUMPER_HIT",objectType:o.type,id:o.id,x:o.x,y:o.y,power:clamp(speed/760,.58,1),petId:pet.id,petType:pet.type,speed});
    }

    _tapBumper(o,x,y,power){o.cooldownUntil=now()+90;o.pulse=1;this._emit({type:"BUMPER_TAP",objectType:o.type,id:o.id,x:o.x,y:o.y,tapX:x,tapY:y,power});}
    _openGift(o,source,power,pet){if(now()<o.cooldownUntil)return;o.cooldownUntil=now()+720;o.open=1;o.pulse=1;const bonus=this.worldTheme.id==="CANDY_TOY_ROOM"?.12:0;this._emit({type:"GIFT_OPEN",objectType:o.type,id:o.id,x:o.x,y:o.y,power:clamp(power+bonus,.2,1),source,petId:pet&&pet.id,petType:pet&&pet.type});}
    _popBalloon(o,source,power,pet){if(now()<o.cooldownUntil||o.popUntil)return;o.cooldownUntil=now()+520;o.popUntil=now()+180;o.pulse=1;this._emit({type:"BALLOON_POP",objectType:o.type,id:o.id,x:o.x,y:o.y+o.bob,power,source,petId:pet&&pet.id,petType:pet&&pet.type});}
    _tapSpring(o,power){o.compress=1;o.pulse=1;o.cooldownUntil=now()+105;this._emit({type:"SPRING_TAP",objectType:o.type,id:o.id,x:o.x,y:o.y,power});}
    _springPet(o,pet,v){const sky=this.worldTheme.id==="CRYSTAL_SKY_GARDEN"?1.16:(this.worldTheme.id==="UNDERWATER_BUBBLE_PALACE"?.88:1),vx=(v.vx||0)*.55+(this.rng()-.5)*95,vy=-(520+Math.min(250,Math.abs(v.vy||0)*.32)+this.rng()*90)*sky;pet.launch(vx,vy,"PANIC");o.compress=1;o.pulse=1;o.cooldownUntil=now()+130;this._emit({type:"SPRING_BOING",objectType:o.type,id:o.id,x:o.x,y:o.y,power:clamp(Math.abs(vy)/720,.65,1),petId:pet.id,petType:pet.type,speed:Math.abs(vy)});}
    _emit(payload){try{this.onEvent(payload);}catch(_){}}
    _balloonRespawnMs(){return this.worldTheme.id==="UNDERWATER_BUBBLE_PALACE"?2600+this.rng()*1400:3600+this.rng()*2200;}

    _textureFor(o){
      const art=global.ProductionAssetArt;
      if(!art||!art.texture)return global.PIXI.Texture.WHITE;
      const active=(o.type==="GIFT"&&o.open>.08)||(o.type==="SPRING"&&o.compress>.08)||(o.type==="BUMPER"&&o.pulse>.14)||(o.type==="BALLOON"&&!!o.popUntil);
      return art.texture(`object.${o.type}.${active?"active":"idle"}`);
    }

    _applyVisual(o,t){
      if(!o.container)return;
      const pulseEase=Math.sin(clamp(o.pulse,0,1)*Math.PI),openEase=Math.sin(clamp(o.open,0,1)*Math.PI*.72),compress=clamp(o.compress,0,1);
      const idleBreath=1+Math.sin(o.phase*.58)*.008;
      const sx=idleBreath*(1+pulseEase*.075+openEase*.035-compress*.04);
      const sy=idleBreath*(1+pulseEase*.045+openEase*.060-compress*.10);
      o.container.x=o.x;o.container.y=o.y+o.bob;
      o.container.scale.set(sx,sy);
      if(o.type==="BALLOON")o.container.rotation=Math.sin(o.phase*.72)*.022+(o.popUntil?.05:0);
      else if(o.type==="GIFT")o.container.rotation=Math.sin(o.phase*.42)*.006-openEase*.045;
      else o.container.rotation=0;

      const accentA=this.worldTheme.accentA||TYPE_BASE[o.type]||0xffffff,accentB=this.worldTheme.accentB||0xffffff;
      o.worldGlow.clear();
      o.worldGlow.ellipse(0,o.radius*.70,o.radius*1.08,o.radius*.30).fill({color:accentA,alpha:.018+.014*(Math.sin(o.phase)+1)});
      if(o.pulse>.05)o.worldGlow.circle(0,-o.radius*.04,o.radius*(.76+pulseEase*.18)).fill({color:accentB,alpha:.018+pulseEase*.030});

      const shadowAlpha=o.type==="BALLOON"?.07:.18;
      o.shadow.clear();
      o.shadow.ellipse(0,o.radius*.82,o.radius*(o.type==="BALLOON"?.72:.96),o.radius*(o.type==="BALLOON"?.16:.23)).fill({color:0x05040a,alpha:shadowAlpha});
      o.shadow.ellipse(0,o.radius*.80,o.radius*.58,o.radius*.11).fill({color:0x000000,alpha:shadowAlpha*.55});

      const accentColor=TYPE_BASE[o.type]||0xffffff;
      o.aura.clear();
      if(o.pulse>.025)o.aura.circle(0,-o.radius*.05,o.radius*(.86+pulseEase*.11)).stroke({color:accentColor,width:1.4+pulseEase*1.8,alpha:.10+pulseEase*.20});
      if(o.open>.05)o.aura.circle(0,-o.radius*.36,12+openEase*13).fill({color:0xfff4c4,alpha:.08+openEase*.18});

      const tex=this._textureFor(o);if(tex)o.sprite.texture=tex;
      const scale=ASSET_SCALE[o.type]||2.2;
      o.sprite.width=o.radius*scale;o.sprite.height=o.radius*scale*(o.type==="SPRING"?.80:(o.type==="BALLOON"?1.20:1));
      o.sprite.y=o.type==="BALLOON"?-8:(o.type==="SPRING"?4:0);
      if(o.type==="GIFT"&&o.open>.04)o.sprite.y=-4*openEase;
      if(o.type==="BUMPER"&&o.pulse>.05)o.sprite.y=-3*pulseEase;
      o.sprite.alpha=o.visibleActive?1:0;

      o.glint.clear();
      const glintQ=(Math.sin(o.phase*1.4)+1)*.5;
      if(o.type!=="SPRING"&&glintQ>.82&&!o.popUntil){
        const gx=-o.radius*.28,gy=-o.radius*.48,rr=2.3+glintQ*1.5;
        o.glint.circle(gx,gy,rr).fill({color:0xffffff,alpha:.16+(glintQ-.82)*1.1});
        o.glint.moveTo(gx-rr*2,gy).lineTo(gx+rr*2,gy).stroke({color:0xffffff,width:1,alpha:.14});
        o.glint.moveTo(gx,gy-rr*2).lineTo(gx,gy+rr*2).stroke({color:0xffffff,width:1,alpha:.14});
      }
    }
  }

  global.ToyObjectSpecs=SPECS;
  global.ToyObjectRuntime=ToyObjectRuntime;
})(window);
