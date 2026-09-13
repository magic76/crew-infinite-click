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
      if(art&&art.softShadow)art.softShadow(s,0,o.radius*.76,o.radius*.92,o.radius*.23,.26);else s.ellipse(0,o.radius*.76,o.radius*.9,o.radius*.26).fill({color:0x05040a,alpha:.24});

      if(o.type==="BUMPER"){
        const r=o.radius*(1+p*.07);
        // Premium arcade puck: dark rubber base, brushed-metal ring, translucent gel dome.
        b.circle(0,3,r*1.02).fill({color:0x171522,alpha:.96});
        b.circle(0,0,r*.94).fill({color:0x5a4554,alpha:1}).stroke({color:0xf4e8dd,width:2.2,alpha:.20});
        b.circle(0,-1,r*.78).fill({color:colors[0],alpha:.92}).stroke({color:colors[1],width:3.2+p*1.8,alpha:.72});
        b.circle(0,-3,r*.56).fill({color:0x3b2c3a,alpha:.78});
        b.circle(0,-5,r*.42).fill({color:colors[1],alpha:.24});
        a.ellipse(-r*.18,-r*.34,r*.32,r*.13).fill({color:0xffffff,alpha:.34});
        a.roundRect(-r*.34,-r*.09,r*.68,r*.18,r*.09).fill({color:0xf4e8dd,alpha:.74});
      }else if(o.type==="GIFT"){
        const r=o.radius,open=o.open,lift=open*9;
        // Collector capsule crate: cream vinyl shell + muted coral band + metal clasp.
        b.roundRect(-r*.72,-r*.45+lift,r*1.44,r*.94,12).fill({color:0xe9ddd2,alpha:.98}).stroke({color:0xffffff,width:1.8,alpha:.20});
        b.roundRect(-r*.60,-r*.34+lift,r*1.20,r*.70,9).fill({color:0xf4e8dd,alpha:.76});
        b.roundRect(-r*.13,-r*.45+lift,r*.26,r*.94,5).fill({color:colors[1],alpha:.92});
        b.roundRect(-r*.82,-r*.58-open*13,r*1.64,r*.30,9).fill({color:colors[0],alpha:.98}).stroke({color:0xf4e8dd,width:1.5,alpha:.16});
        a.roundRect(-r*.18,-r*.08+lift,r*.36,r*.24,5).fill({color:colors[2],alpha:.95}).stroke({color:0xffffff,width:1,alpha:.24});
        a.ellipse(-r*.28,-r*.50-open*13,r*.23,r*.12).stroke({color:colors[1],width:5,alpha:.86});
        a.ellipse(r*.28,-r*.50-open*13,r*.23,r*.12).stroke({color:colors[1],width:5,alpha:.86});
        a.ellipse(-r*.24,-r*.28+lift,r*.25,r*.10).fill({color:0xffffff,alpha:.20});
      }else if(o.type==="BALLOON"){
        const r=o.radius*(1+p*.09),yy=Math.sin(t/240+o.phase)*2;
        // Translucent resin bubble, intentionally not a party balloon.
        b.circle(0,-r*.04+yy,r*.92).fill({color:0x254553,alpha:.28}).stroke({color:colors[0],width:2.4,alpha:.68});
        b.circle(0,-r*.06+yy,r*.78).fill({color:colors[0],alpha:.16});
        b.circle(r*.08,r*.02+yy,r*.46).fill({color:colors[1],alpha:.10});
        a.ellipse(-r*.25,-r*.34+yy,r*.24,r*.12).fill({color:0xffffff,alpha:.52});
        a.circle(-r*.36,-r*.17+yy,r*.07).fill({color:0xffffff,alpha:.34});
        a.roundRect(-r*.10,r*.80+yy,r*.20,r*.16,r*.05).fill({color:0xe9ddd2,alpha:.88});
        a.moveTo(0,r*.95+yy).bezierCurveTo(-8,r*1.25,9,r*1.55,-4,r*1.82).stroke({color:0xbda9b0,width:1.4,alpha:.38});
      }else if(o.type==="SPRING"){
        const r=o.radius,c=o.compress;
        // Polished launch pad: smoked metal base, teal coil, warm metallic cap.
        b.roundRect(-r*.88,r*.12+c*7,r*1.76,r*.38,11).fill({color:0x182229,alpha:.98}).stroke({color:0xf4e8dd,width:1.6,alpha:.16});
        b.roundRect(-r*.76,-r*.58+c*20,r*1.52,r*.29,10).fill({color:0xd4b55d,alpha:.94}).stroke({color:0xffffff,width:1.6,alpha:.23});
        b.roundRect(-r*.60,-r*.50+c*20,r*1.20,r*.12,6).fill({color:0xf2d783,alpha:.36});
        const top=-r*.28+c*16,bottom=r*.12+c*6,steps=6;let px=-r*.48,py=bottom;a.moveTo(px,py);for(let i=1;i<=steps;i++){px=-r*.48+(r*.96)*(i/steps);py=i%2?top:bottom;a.lineTo(px,py);}a.stroke({color:colors[0],width:5,alpha:.88});
        a.moveTo(-r*.48,bottom+2);for(let i=1;i<=steps;i++){px=-r*.48+(r*.96)*(i/steps);py=i%2?top+4:bottom+2;a.lineTo(px,py);}a.stroke({color:colors[1],width:1.6,alpha:.48});
      }
      if(p>.02){a.circle(0,0,o.radius*(.76+p*.42)).stroke({color:colors[1],width:1.7+p*1.6,alpha:.08+p*.22});}
    }
  }

  global.ToyObjectRuntime=ToyObjectRuntime;
  global.ToyObjectSpecs=SPECS;
})(window);
