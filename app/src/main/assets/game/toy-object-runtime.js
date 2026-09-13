(function(global){
  "use strict";

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>global.performance&&performance.now?performance.now():Date.now();

  const SPECS=[
    {id:"bumper-a",type:"BUMPER",nx:.79,ny:.54,radius:43,active:true},
    {id:"spring-a",type:"SPRING",nx:.51,ny:.86,radius:48,active:true},
    {id:"gift-a",type:"GIFT",nx:.23,ny:.68,radius:44,active:false,unlockHits:2},
    {id:"balloon-a",type:"BALLOON",nx:.20,ny:.31,radius:38,active:false,unlockHits:4},
    {id:"bumper-b",type:"BUMPER",nx:.52,ny:.25,radius:38,active:false,unlockHits:7}
  ];

  const TYPE_BASE={BUMPER:0xd98791,GIFT:0xe99592,BALLOON:0x79a8be,SPRING:0x7fc9b5};
  // Premium arcade puck / Designer capsule gift / Glassy resin bubble / Polished launch pad
  const ASSET_SCALE={BUMPER:2.18,GIFT:2.18,BALLOON:2.26,SPRING:2.34};

  class ToyObjectRuntime{
    constructor(app,options){
      const o=options||{};
      this.app=app;
      this.parent=o.parent||app.stage;
      this.safeBounds=typeof o.safeBounds==="function"?o.safeBounds:()=>({left:40,top:40,right:app.renderer.screen.width-40,bottom:app.renderer.screen.height-40});
      this.onEvent=typeof o.onEvent==="function"?o.onEvent:()=>{};
      this.rng=typeof o.rng==="function"?o.rng:Math.random;
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

    reset(){
      this.hitCount=0;
      for(const o of this.objects){
        o.visibleActive=!!o.active;o.everUnlocked=!!o.active;o.cooldownUntil=0;o.respawnAt=0;o.pulse=0;o.compress=0;o.open=0;o.phase=this.rng()*Math.PI*2;o.bob=0;
        o.container.visible=o.visibleActive;this._applyVisual(o,now());
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
      candidate.visibleActive=true;candidate.everUnlocked=true;candidate.container.visible=true;candidate.respawnAt=0;candidate.pulse=1;
      if(near&&Number.isFinite(near.x)&&Number.isFinite(near.y)){
        candidate.x=near.x+(this.rng()-.5)*80;candidate.y=near.y+(this.rng()-.5)*70;candidate.container.position.set(candidate.x,candidate.y);
      }
      this._emit({type:"OBJECT_UNLOCK",objectType:candidate.type,id:candidate.id,x:candidate.x,y:candidate.y,power:.9});
      return true;
    }

    handleTap(x,y){
      const t=now();let best=null,bestScore=Infinity;
      for(const o of this.objects){
        if(!o.visibleActive||t<o.cooldownUntil)continue;
        const dx=x-o.x,dy=y-o.y,d=Math.hypot(dx,dy),limit=o.radius*1.28,score=d/Math.max(1,limit);
        if(score<=1&&score<bestScore){bestScore=score;best={o,d,power:clamp(1-score*.72,.28,1)};}
      }
      if(!best)return {triggered:false};
      const o=best.o,p=best.power;o.pulse=Math.max(o.pulse,p);
      if(o.type==="BUMPER")this._tapBumper(o,x,y,p);
      else if(o.type==="GIFT")this._openGift(o,"TAP",p,null);
      else if(o.type==="BALLOON")this._popBalloon(o,"TAP",p,null);
      else if(o.type==="SPRING")this._tapSpring(o,p);
      return {triggered:true,id:o.id,objectType:o.type,power:p,x:o.x,y:o.y};
    }

    tick(deltaMS,pets){
      const t=now(),dt=Math.min(50,Number(deltaMS)||16.67)/1000;
      for(const o of this.objects){
        if(!o.visibleActive&&o.respawnAt&&t>=o.respawnAt){o.visibleActive=true;o.container.visible=true;o.respawnAt=0;o.pulse=.85;this._emit({type:"OBJECT_RESPAWN",objectType:o.type,id:o.id,x:o.x,y:o.y,power:.6});}
        if(!o.visibleActive)continue;
        o.phase+=dt*(o.type==="BALLOON"?1.55:.95);o.pulse=Math.max(0,o.pulse-dt*2.8);o.compress=Math.max(0,o.compress-dt*3.5);o.open=Math.max(0,o.open-dt*1.8);
        o.bob=o.type==="BALLOON"?Math.sin(o.phase)*8:0;
        this._applyVisual(o,t);
      }
      this._collidePets(Array.isArray(pets)?pets:[],t);
    }

    resize(){
      const b=this.safeBounds(),w=Math.max(1,b.right-b.left),h=Math.max(1,b.bottom-b.top);
      for(const o of this.objects){o.x=b.left+w*o.nx;o.y=b.top+h*o.ny;o.container.position.set(o.x,o.y);o.container.visible=!!o.visibleActive;this._applyVisual(o,now());}
    }

    context(){return this.objects.map(o=>({id:o.id,type:o.type,active:!!o.visibleActive,unlocked:!!o.everUnlocked,x:Math.round(o.x),y:Math.round(o.y)}));}

    _createObject(spec){
      const c=new global.PIXI.Container();c.label="toy-object:"+spec.id;c.eventMode="none";
      const shadow=new global.PIXI.Graphics();
      const aura=new global.PIXI.Graphics();
      const sprite=new global.PIXI.Sprite();sprite.anchor.set(.5,.72);
      c.addChild(shadow,aura,sprite);this.root.addChild(c);
      return Object.assign({},spec,{container:c,shadow,aura,sprite,x:0,y:0,phase:this.rng()*Math.PI*2,pulse:0,compress:0,open:0,cooldownUntil:0,respawnAt:0,bob:0,visibleActive:!!spec.active,everUnlocked:!!spec.active});
    }

    _collidePets(pets,t){
      for(const o of this.objects){
        if(!o.visibleActive||t<o.cooldownUntil)continue;
        for(const pet of pets){
          if(!pet||!pet.isActive||!pet.isActive())continue;
          const pos=pet.position&&pet.position();if(!pos)continue;
          const dx=pos.x-o.x,dy=pos.y-(o.type==="BALLOON"?o.y+o.bob:o.y),d=Math.hypot(dx,dy),pr=Math.max(20,pet.collisionRadius?pet.collisionRadius()*.72:35),limit=o.radius+pr;
          if(d>limit||d<=.01)continue;
          const key=o.id+"|"+pet.id,last=o["last_"+pet.id]||0;if(t-last<(o.type==="SPRING"?320:220))continue;o["last_"+pet.id]=t;
          const v=pet.velocity?pet.velocity():{vx:0,vy:0,speed:0};
          if(o.type==="BUMPER")this._bouncePet(o,pet,v,dx,dy,d);
          else if(o.type==="GIFT"&&v.speed>115)this._openGift(o,"PET",clamp(.48+v.speed/850,.48,1),pet);
          else if(o.type==="BALLOON"&&v.speed>105)this._popBalloon(o,"PET",clamp(.45+v.speed/820,.45,1),pet);
          else if(o.type==="SPRING"&&pos.y<=o.y+o.radius*.9&&v.vy>40)this._springPet(o,pet,v);
        }
      }
    }

    _bouncePet(o,pet,v,dx,dy,d){
      const nx=dx/Math.max(1,d),ny=dy/Math.max(1,d),speed=Math.max(420,v.speed*1.22+90),vx=nx*speed,vy=ny*speed-(ny>.2?55:20);
      pet.launch(vx,vy,"PANIC");o.pulse=1;o.cooldownUntil=now()+120;
      this._emit({type:"BUMPER_HIT",objectType:o.type,id:o.id,x:o.x,y:o.y,power:clamp(speed/720,.55,1),petId:pet.id,petType:pet.type,speed});
    }

    _tapBumper(o,x,y,power){o.cooldownUntil=now()+95;o.pulse=1;this._emit({type:"BUMPER_TAP",objectType:o.type,id:o.id,x:o.x,y:o.y,tapX:x,tapY:y,power});}
    _openGift(o,source,power,pet){if(now()<o.cooldownUntil)return;o.cooldownUntil=now()+700;o.open=1;o.pulse=1;this._emit({type:"GIFT_OPEN",objectType:o.type,id:o.id,x:o.x,y:o.y,power,source,petId:pet&&pet.id,petType:pet&&pet.type});}
    _popBalloon(o,source,power,pet){if(now()<o.cooldownUntil)return;o.cooldownUntil=now()+500;o.pulse=1;this._emit({type:"BALLOON_POP",objectType:o.type,id:o.id,x:o.x,y:o.y+o.bob,power,source,petId:pet&&pet.id,petType:pet&&pet.type});o.visibleActive=false;o.container.visible=false;o.respawnAt=now()+3600+this.rng()*2200;}
    _tapSpring(o,power){o.compress=1;o.pulse=1;o.cooldownUntil=now()+110;this._emit({type:"SPRING_TAP",objectType:o.type,id:o.id,x:o.x,y:o.y,power});}
    _springPet(o,pet,v){const vx=(v.vx||0)*.55+(this.rng()-.5)*95,vy=-(520+Math.min(250,Math.abs(v.vy||0)*.32)+this.rng()*90);pet.launch(vx,vy,"PANIC");o.compress=1;o.pulse=1;o.cooldownUntil=now()+135;this._emit({type:"SPRING_BOING",objectType:o.type,id:o.id,x:o.x,y:o.y,power:clamp(Math.abs(vy)/700,.65,1),petId:pet.id,petType:pet.type,speed:Math.abs(vy)});}
    _emit(payload){try{this.onEvent(payload);}catch(_){}}

    _textureFor(o){
      const art=global.ProductionAssetArt;
      if(!art||!art.texture)return global.PIXI.Texture.WHITE;
      const state=(o.type==="GIFT"&&o.open>.08)||(o.type==="SPRING"&&o.compress>.08)||(o.type==="BUMPER"&&o.pulse>.14)?"active":"idle";
      return art.texture(`object.${o.type}.${state}`);
    }

    _applyVisual(o,t){
      const pulseScale=1+o.pulse*.055-o.compress*.055;
      o.container.x=o.x;o.container.y=o.y+o.bob;
      o.container.scale.set(pulseScale,o.type==="SPRING"?1-o.compress*.06:pulseScale);
      o.container.rotation=o.type==="BALLOON"?Math.sin(o.phase*.72)*.018:0;

      const shadowAlpha=o.type==="BALLOON"?.09:.17;
      o.shadow.clear();
      o.shadow.ellipse(0,o.radius*.78,o.radius*(o.type==="BALLOON"?.78:.90),o.radius*(o.type==="BALLOON"?.18:.22)).fill({color:0x05040a,alpha:shadowAlpha});

      const accentColor=TYPE_BASE[o.type]||0xffffff;
      o.aura.clear();
      if(o.pulse>.02)o.aura.circle(0,0,o.radius*.88+o.pulse*9).stroke({color:accentColor,width:2.2,alpha:.14+o.pulse*.18});
      if(o.type==="GIFT"&&o.open>.08)o.aura.circle(0,-o.radius*.36,10+o.open*10).fill({color:0xfff4c4,alpha:.14+o.open*.12});

      const tex=this._textureFor(o);
      if(tex)o.sprite.texture=tex;
      const scale=ASSET_SCALE[o.type]||2.2;
      o.sprite.width=o.radius*scale;o.sprite.height=o.radius*scale*(o.type==="SPRING"?.78:(o.type==="BALLOON"?1.16:1));
      o.sprite.y=o.type==="BALLLOON"?-6:0;
      if(o.type==="BALLOON")o.sprite.y=-6;
      else if(o.type==="SPRING")o.sprite.y=2;
      else o.sprite.y=0;
      o.sprite.alpha=o.visibleActive?1:0;
    }
  }

  global.ToyObjectSpecs=SPECS;
  global.ToyObjectRuntime=ToyObjectRuntime;
})(window);
