(function(global){
  "use strict";

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>global.performance&&performance.now?performance.now():Date.now();
  const TYPE_COLORS={
    BUMPER:[0xd98791,0xe7bf63,0xf4e8dd],
    GIFT:[0x9d90bd,0xe99592,0xe7bf63],
    BALLOON:[0x79a8be,0xd8a0b4,0xf4e8dd],
    SPRING:[0x7fc9b5,0x79a8be,0xf4e8dd]
  };

  const SPECS=[
    {id:"bumper-a",type:"BUMPER",nx:.79,ny:.54,radius:43,active:true},
    {id:"spring-a",type:"SPRING",nx:.51,ny:.86,radius:48,active:true},
    {id:"gift-a",type:"GIFT",nx:.23,ny:.68,radius:44,active:false,unlockHits:2},
    {id:"balloon-a",type:"BALLOON",nx:.20,ny:.31,radius:38,active:false,unlockHits:4},
    {id:"bumper-b",type:"BUMPER",nx:.52,ny:.25,radius:38,active:false,unlockHits:7}
  ];

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
      this.hitCount=0;this.lastTick=now();
      this.resize();
    }

    destroy(){
      if(this.root&&this.root.parent)this.root.parent.removeChild(this.root);
      try{this.root&&this.root.destroy({children:true});}catch(_){}
      this.root=null;this.objects.length=0;
    }

    _createObject(spec){
      const c=new global.PIXI.Container();c.label="toy-object:"+spec.id;c.eventMode="none";
      const shadow=new global.PIXI.Graphics(),body=new global.PIXI.Graphics(),accent=new global.PIXI.Graphics();
      c.addChild(shadow,body,accent);this.root.addChild(c);
      return Object.assign({},spec,{container:c,shadow,body,accent,x:0,y:0,phase:this.rng()*Math.PI*2,pulse:0,compress:0,open:0,cooldownUntil:0,respawnAt:0,bob:0,visibleActive:!!spec.active,everUnlocked:!!spec.active});
    }

    reset(){
      this.hitCount=0;
      for(const o of this.objects){
        o.visibleActive=!!o.active;o.everUnlocked=!!o.active;o.cooldownUntil=0;o.respawnAt=0;o.pulse=0;o.compress=0;o.open=0;o.phase=this.rng()*Math.PI*2;
        o.container.visible=o.visibleActive;
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
      if(near&&Number.isFinite(near.x)&&Number.isFinite(near.y)){candidate.x=near.x+(this.rng()-.5)*80;candidate.y=near.y+(this.rng()-.5)*70;candidate.container.position.set(candidate.x,candidate.y);}
      this._emit({type:"OBJECT_UNLOCK",objectType:candidate.type,id:candidate.id,x:candidate.x,y:candidate.y,power:.9});
      return true;
    }

    handleTap(x,y,meta){
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
      const t=now(),dt=Math.min(50,Number(deltaMS)||16.67)/1000;this.lastTick=t;
      for(const o of this.objects){
        if(!o.visibleActive&&o.respawnAt&&t>=o.respawnAt){o.visibleActive=true;o.container.visible=true;o.respawnAt=0;o.pulse=.85;this._emit({type:"OBJECT_RESPAWN",objectType:o.type,id:o.id,x:o.x,y:o.y,power:.6});}
        if(!o.visibleActive)continue;
        o.phase+=dt*(o.type==="BALLOON"?1.55:.95);o.pulse=Math.max(0,o.pulse-dt*2.8);o.compress=Math.max(0,o.compress-dt*3.5);o.open=Math.max(0,o.open-dt*1.8);
        if(o.type==="BALLOON"){o.bob=Math.sin(o.phase)*8;o.container.y=o.y+o.bob;}else o.container.y=o.y;
        o.container.x=o.x;
        const pulseScale=1+o.pulse*.055-o.compress*.055;o.container.scale.set(pulseScale,o.type==="SPRING"?1-o.compress*.06:pulseScale);
        o.container.rotation=o.type==="BALLOON"?Math.sin(o.phase*.72)*.018:0;
        this._draw(o,t);
      }
      this._collidePets(Array.isArray(pets)?pets:[],t);
    }

    resize(){
      const b=this.safeBounds(),w=Math.max(1,b.right-b.left),h=Math.max(1,b.bottom-b.top);
      for(const o of this.objects){o.x=b.left+w*o.nx;o.y=b.top+h*o.ny;o.container.position.set(o.x,o.y);o.container.visible=!!o.visibleActive;this._draw(o,now());}
    }

    context(){return this.objects.map(o=>({id:o.id,type:o.type,active:!!o.visibleActive,unlocked:!!o.everUnlocked,x:Math.round(o.x),y:Math.round(o.y)}));}

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
          if(o.type==="BUMPER")this._bouncePet(o,pet,pos,v,dx,dy,d);
          else if(o.type==="GIFT"&&v.speed>115)this._openGift(o,"PET",clamp(.48+v.speed/850,.48,1),pet);
          else if(o.type==="BALLOON"&&v.speed>105)this._popBalloon(o,"PET",clamp(.45+v.speed/820,.45,1),pet);
          else if(o.type==="SPRING"&&pos.y<=o.y+o.radius*.9&&v.vy>40)this._springPet(o,pet,v);
        }
      }
    }

    _bouncePet(o,pet,pos,v,dx,dy,d){
      const nx=dx/Math.max(1,d),ny=dy/Math.max(1,d),speed=Math.max(420,v.speed*1.22+90),vx=nx*speed,vy=ny*speed-(ny>.2?55:20);
      pet.launch(vx,vy,"PANIC");o.pulse=1;o.cooldownUntil=now()+120;
      this._emit({type:"BUMPER_HIT",objectType:o.type,id:o.id,x:o.x,y:o.y,power:clamp(speed/720,.55,1),petId:pet.id,petType:pet.type,speed});
    }

    _tapBumper(o,x,y,power){
      o.cooldownUntil=now()+95;o.pulse=1;
      this._emit({type:"BUMPER_TAP",objectType:o.type,id:o.id,x:o.x,y:o.y,tapX:x,tapY:y,power});
    }

    _openGift(o,source,power,pet){
      if(now()<o.cooldownUntil)return;o.cooldownUntil=now()+700;o.open=1;o.pulse=1;
      this._emit({type:"GIFT_OPEN",objectType:o.type,id:o.id,x:o.x,y:o.y,power,source,petId:pet&&pet.id,petType:pet&&pet.type});
    }

    _popBalloon(o,source,power,pet){
      if(now()<o.cooldownUntil)return;o.cooldownUntil=now()+500;o.pulse=1;
      this._emit({type:"BALLOON_POP",objectType:o.type,id:o.id,x:o.x,y:o.y+o.bob,power,source,petId:pet&&pet.id,petType:pet&&pet.type});
      o.visibleActive=false;o.container.visible=false;o.respawnAt=now()+3600+this.rng()*2200;
    }

    _tapSpring(o,power){
      o.compress=1;o.pulse=1;o.cooldownUntil=now()+110;
      this._emit({type:"SPRING_TAP",objectType:o.type,id:o.id,x:o.x,y:o.y,power});
    }

    _springPet(o,pet,v){
      const vx=(v.vx||0)*.55+(this.rng()-.5)*95,vy=-(520+Math.min(250,Math.abs(v.vy||0)*.32)+this.rng()*90);
      pet.launch(vx,vy,"PANIC");o.compress=1;o.pulse=1;o.cooldownUntil=now()+135;
      this._emit({type:"SPRING_BOING",objectType:o.type,id:o.id,x:o.x,y:o.y,power:clamp(Math.abs(vy)/700,.65,1),petId:pet.id,petType:pet.type,speed:Math.abs(vy)});
    }

    _emit(payload){try{this.onEvent(payload);}catch(_){} }

    _draw(o,t){
      const b=o.body,a=o.accent,s=o.shadow,p=o.pulse;const colors=TYPE_COLORS[o.type]||TYPE_COLORS.BUMPER,art=global.PremiumToyArt;
      b.clear();a.clear();s.clear();
      if(art&&art.softShadow)art.softShadow(s,0,o.radius*.76,o.radius*.88,o.radius*.21,.20);else s.ellipse(0,o.radius*.76,o.radius*.88,o.radius*.22).fill({color:0x05040a,alpha:.18});

      if(o.type==="BUMPER"){
        const r=o.radius*(1+p*.045);
        // Premium arcade puck: rubber base, warm metal ring, gel center.
        b.circle(0,3,r*.98).fill({color:0x11121a,alpha:.98});
        b.circle(0,1,r*.90).fill({color:0x3d313d,alpha:1}).stroke({color:0xf4e8dd,width:1.4,alpha:.18});
        b.circle(0,-1,r*.74).fill({color:0xe1ae8b,alpha:.82}).stroke({color:0xf5d47b,width:2.2,alpha:.58});
        b.circle(0,-3,r*.52).fill({color:0xd98791,alpha:.92});
        a.ellipse(-r*.20,-r*.30,r*.26,r*.10).fill({color:0xffffff,alpha:.26});
        a.roundRect(-r*.28,-r*.05,r*.56,r*.14,r*.08).fill({color:0xf4e8dd,alpha:.58});
      }else if(o.type==="GIFT"){
        const r=o.radius,open=o.open,lift=open*8;
        // Designer capsule gift: vinyl shell + coral band + soft bow cap.
        b.roundRect(-r*.70,-r*.44+lift,r*1.40,r*.92,13).fill({color:0xf0e4d9,alpha:.98}).stroke({color:0xffffff,width:1.5,alpha:.18});
        b.roundRect(-r*.58,-r*.31+lift,r*1.16,r*.64,9).fill({color:0xffffff,alpha:.22});
        b.roundRect(-r*.12,-r*.44+lift,r*.24,r*.92,5).fill({color:0xe7a2a3,alpha:.96});
        b.roundRect(-r*.84,-r*.58-open*11,r*1.68,r*.28,10).fill({color:0xb3a4d0,alpha:.96}).stroke({color:0xf4e8dd,width:1.3,alpha:.14});
        a.roundRect(-r*.16,-r*.06+lift,r*.32,r*.20,5).fill({color:0xf1d475,alpha:.92}).stroke({color:0xffffff,width:.9,alpha:.22});
        a.ellipse(-r*.22,-r*.47-open*10,r*.20,r*.10).stroke({color:0xe99592,width:4.2,alpha:.82});
        a.ellipse(r*.22,-r*.47-open*10,r*.20,r*.10).stroke({color:0xe99592,width:4.2,alpha:.82});
        a.ellipse(-r*.26,-r*.25+lift,r*.20,r*.08).fill({color:0xffffff,alpha:.16});
      }else if(o.type==="BALLOON"){
        const r=o.radius*(1+p*.055),yy=Math.sin(t/260+o.phase)*2;
        // Glassy resin bubble.
        b.circle(0,-r*.02+yy,r*.84).fill({color:0x2a4758,alpha:.18}).stroke({color:0x9ecde3,width:1.8,alpha:.44});
        b.circle(0,-r*.02+yy,r*.70).fill({color:0x91bad2,alpha:.10});
        b.circle(r*.14,r*.08+yy,r*.36).fill({color:0xf5bfd1,alpha:.10});
        a.ellipse(-r*.22,-r*.30+yy,r*.22,r*.10).fill({color:0xffffff,alpha:.40});
        a.circle(-r*.34,-r*.15+yy,r*.06).fill({color:0xffffff,alpha:.24});
        a.roundRect(-r*.10,r*.74+yy,r*.20,r*.14,r*.05).fill({color:0xe9ddd2,alpha:.80});
        a.moveTo(0,r*.86+yy).bezierCurveTo(-7,r*1.16,8,r*1.42,-3,r*1.68).stroke({color:0xc8b7be,width:1.2,alpha:.26});
      }else if(o.type==="SPRING"){
        const r=o.radius,c=o.compress;
        // Polished launch pad with neat platform silhouette.
        b.roundRect(-r*.92,r*.18+c*7,r*1.84,r*.34,12).fill({color:0x141a21,alpha:.98}).stroke({color:0xffffff,width:1.2,alpha:.12});
        b.roundRect(-r*.76,-r*.48+c*18,r*1.52,r*.24,10).fill({color:0xe8c967,alpha:.92}).stroke({color:0xffffff,width:1.4,alpha:.18});
        b.roundRect(-r*.60,-r*.42+c*18,r*1.20,r*.10,6).fill({color:0xffffff,alpha:.18});
        const top=-r*.22+c*14,bottom=r*.12+c*6,steps=6;let px=-r*.46,py=bottom;a.moveTo(px,py);for(let i=1;i<=steps;i++){px=-r*.46+(r*.92)*(i/steps);py=i%2?top:bottom;a.lineTo(px,py);}a.stroke({color:0x88dbc3,width:4.2,alpha:.90});
        a.moveTo(-r*.46,bottom+2);for(let i=1;i<=steps;i++){px=-r*.46+(r*.92)*(i/steps);py=i%2?top+4:bottom+2;a.lineTo(px,py);}a.stroke({color:0x6ca5c0,width:1.3,alpha:.46});
      }
      if(p>.03){a.ellipse(0,0,o.radius*(.58+p*.08),o.radius*(.28+p*.05)).stroke({color:colors[1],width:1.2,alpha:.05+p*.10});}
    }
  }

  global.ToyObjectRuntime=ToyObjectRuntime;
  global.ToyObjectSpecs=SPECS;
})(window);
