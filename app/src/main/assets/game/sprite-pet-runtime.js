(function(global){
  "use strict";

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>global.performance&&performance.now?performance.now():Date.now();
  const GRID_COLUMNS=4,GRID_ROWS=2,CELL=512;
  const SOURCE_CACHE=new Map();

  const ANIMATIONS={
    IDLE:{frames:[0,1,2,1],speed:.075,loop:true},
    HOP:{frames:[0,3,1],speed:.13,loop:false},
    STARTLED:{frames:[4,5,4],speed:.16,loop:false},
    RUN:{frames:[6,7,6,7],speed:.16,loop:true},
    PANIC:{frames:[4,5,6,7,5,6],speed:.21,loop:true},
    CELEBRATE:{frames:[3,1,3,0],speed:.11,loop:false}
  };

  const TEMPERAMENTS={
    SHY:{hitPanic:.31,nearPanic:.16,awarePanic:.07,curious:.10,speed:1.08,calm:.060,group:1.22},
    CURIOUS:{hitPanic:.22,nearPanic:.08,awarePanic:.03,curious:.82,speed:.92,calm:.095,group:.82},
    TRICKSTER:{hitPanic:.25,nearPanic:.10,awarePanic:.04,curious:.38,speed:1.20,calm:.075,group:1.00},
    GOOFY:{hitPanic:.19,nearPanic:.07,awarePanic:.02,curious:.58,speed:.82,calm:.110,group:.72}
  };

  function impactForDistance(distance,directRadius,nearRadius,awareRadius){
    const d=Math.max(0,Number(distance)||0);
    if(d<=directRadius)return 1;
    if(d<=nearRadius){const q=(d-directRadius)/Math.max(1,nearRadius-directRadius);return .94-q*.34;}
    if(d<=awareRadius){const q=(d-nearRadius)/Math.max(1,awareRadius-nearRadius);return .52-q*.40;}
    return 0;
  }

  class SpritePetRuntime{
    constructor(app,options){
      const o=options||{};
      this.app=app;this.parent=o.parent||app.stage;
      this.id=String(o.id||"pet");this.type=String(o.type||"PEACH").toUpperCase();this.temperament=String(o.temperament||"SHY").toUpperCase();
      this.personality=TEMPERAMENTS[this.temperament]||TEMPERAMENTS.SHY;
      this.scaleFactor=clamp(Number(o.scaleFactor)||1,.55,1.55);this.sizeMultiplier=1;this.sizeTarget=1;this.sizeReturnAt=0;
      this.initial=o.initial||null;
      this.safeBounds=typeof o.safeBounds==="function"?o.safeBounds:()=>({left:56,top:84,right:app.renderer.screen.width-56,bottom:app.renderer.screen.height-90});
      this.onReaction=typeof o.onReaction==="function"?o.onReaction:()=>{};
      this.onModeChange=typeof o.onModeChange==="function"?o.onModeChange:()=>{};
      this.onWallBounce=typeof o.onWallBounce==="function"?o.onWallBounce:()=>{};
      this.root=new global.PIXI.Container();this.root.label="sprite-pet-"+this.id;this.parent.addChild(this.root);
      this.shadow=new global.PIXI.Graphics();this.root.addChild(this.shadow);
      this.sprite=null;this.frames=[];this.anim="IDLE";this.mode="IDLE";this.active=o.active!==false;this.root.visible=this.active;
      this.vx=0;this.vy=0;this.targetX=0;this.targetY=0;this.facing=Math.random()<.5?-1:1;this.baseScale=.31;
      this.lastTapAt=0;this.lastDirectHitAt=0;this.lastDecisionAt=0;this.nextDecisionAt=0;this.lastWallBounceAt=0;
      this.panic=0;this.directHits=0;this.nearMisses=0;this.totalTaps=0;this.chaseStreak=0;
      this.reactionUntil=0;this.oneShotReturn="IDLE";this.ready=false;
      this.deformUntil=0;this.deformPower=0;this.spinKick=0;
      this._tickBound=t=>this.tick(Number(t&&t.deltaMS)||16.67);app.ticker.add(this._tickBound);
    }

    async init(sheetUrl){
      const requested=String(sheetUrl||"");
      let source=SOURCE_CACHE.get(requested)||null;
      if(!source){
        let sourceUrl=requested;
        try{
          const rel=requested.replace(/^\/+/,"");
          const encoded=global.AndroidGame&&global.AndroidGame.loadAssetData?global.AndroidGame.loadAssetData("game/"+rel):"";
          if(encoded)sourceUrl="data:image/png;base64,"+encoded;
        }catch(_){/* browser preview keeps the relative URL */}
        const image=await new Promise((resolve,reject)=>{
          const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(this.id+" sprite sheet failed to load"));img.src=sourceUrl;
        });
        const base=global.PIXI.Texture.from(image);
        if(!base||!base.source)throw new Error(this.id+" sprite sheet texture failed");
        source=base.source;SOURCE_CACHE.set(requested,source);
      }
      this.frames=[];
      for(let row=0;row<GRID_ROWS;row++)for(let col=0;col<GRID_COLUMNS;col++){
        this.frames.push(new global.PIXI.Texture({source,frame:new global.PIXI.Rectangle(col*CELL,row*CELL,CELL,CELL)}));
      }
      this.sprite=new global.PIXI.AnimatedSprite(this._texturesFor("IDLE"));
      this.sprite.anchor.set(.5);this.sprite.animationSpeed=ANIMATIONS.IDLE.speed;this.sprite.loop=true;this.sprite.play();this.root.addChild(this.sprite);
      const s=this.app.renderer.screen,b=this.safeBounds(),ix=this.initial&&Number.isFinite(this.initial.x)?this.initial.x:.5,iy=this.initial&&Number.isFinite(this.initial.y)?this.initial.y:.56;
      this.sprite.x=clamp(s.width*ix,b.left,b.right);this.sprite.y=clamp(s.height*iy,b.top,b.bottom);
      this.targetX=this.sprite.x;this.targetY=this.sprite.y;this._updateScale();this._drawShadow();
      this.ready=true;this._scheduleDecision(now(),240+Math.random()*520);this.setActive(this.active);
      return this;
    }

    destroy(){
      if(this.app&&this.app.ticker)this.app.ticker.remove(this._tickBound);
      if(this.root&&this.root.parent)this.root.parent.removeChild(this.root);
      try{this.root&&this.root.destroy({children:true});}catch(_){}
      this.sprite=null;this.frames=[];this.ready=false;
    }

    setActive(active,options){
      this.active=!!active;if(this.root)this.root.visible=this.active;if(!this.sprite)return;
      if(!this.active){this.vx=this.vy=0;return;}
      const o=options||{},b=this.safeBounds();
      if(Number.isFinite(o.x))this.sprite.x=clamp(o.x,b.left,b.right);if(Number.isFinite(o.y))this.sprite.y=clamp(o.y,b.top,b.bottom);
      this.targetX=this.sprite.x;this.targetY=this.sprite.y;
      if(Number.isFinite(o.vx))this.vx=o.vx;if(Number.isFinite(o.vy))this.vy=o.vy;
      this.panic=clamp(Number(o.panic)||this.panic,0,1);this._play(o.animation||"IDLE",true);this._setMode(o.mode||"IDLE",0);this._drawShadow();
    }
    activateAt(x,y,options){const o=Object.assign({},options||{},{x,y});this.setActive(true,o);}
    deactivate(){this.setActive(false);}
    isActive(){return !!this.active;}

    setSizeMultiplier(multiplier,durationMs){
      const m=clamp(Number(multiplier)||1,.58,1.8);this.sizeTarget=m;
      if(!durationMs){this.sizeMultiplier=m;this.sizeReturnAt=0;}else this.sizeReturnAt=now()+Math.max(80,Number(durationMs)||0);
    }

    launch(vx,vy,mode){
      if(!this.active||!this.sprite)return;this.vx=Number(vx)||0;this.vy=Number(vy)||0;this.targetX=this.sprite.x+this.vx*.55;this.targetY=this.sprite.y+this.vy*.45;
      this.panic=clamp(this.panic+.22,0,1);this._play("PANIC",true);this._setMode(mode||"PANIC",now()+620);
    }

    forceAnimation(name,durationMs){if(!this.active)return;const n=String(name||"IDLE").toUpperCase();this._play(n,true,"IDLE");if(durationMs)this._setMode(n,now()+durationMs);}

    resize(){
      if(!this.sprite)return;this._updateScale();const b=this.safeBounds();
      this.sprite.x=clamp(this.sprite.x,b.left,b.right);this.sprite.y=clamp(this.sprite.y,b.top,b.bottom);this.targetX=clamp(this.targetX,b.left,b.right);this.targetY=clamp(this.targetY,b.top,b.bottom);
    }

    measureTap(x,y){
      if(!this.sprite||!this.active)return {distance:9999,directRadius:0,nearRadius:0,awareRadius:0,impact:0};
      const d=Math.hypot(this.sprite.x-x,this.sprite.y-y),unit=this.baseScale*this.sizeMultiplier/.31;
      const directRadius=Math.max(62,72*unit),nearRadius=Math.max(145,168*unit),awareRadius=Math.max(270,305*unit);
      return {distance:d,directRadius,nearRadius,awareRadius,impact:impactForDistance(d,directRadius,nearRadius,awareRadius)};
    }

    handleTap(x,y,meta){
      if(!this.sprite||!this.active)return {id:this.id,type:this.type,reaction:"NONE",distance:9999,impact:0};
      const m=meta||{},measure=this.measureTap(x,y),t=now(),gap=this.lastTapAt?t-this.lastTapAt:9999,p=this.personality;
      this.lastTapAt=t;this.totalTaps++;if(gap<430)this.chaseStreak=Math.min(24,this.chaseStreak+1);else this.chaseStreak=Math.max(0,this.chaseStreak-2);
      const dx=this.sprite.x-x,dy=this.sprite.y-y,d=measure.distance;let reaction="IGNORE";

      if(d<=measure.directRadius){
        reaction="HIT";this.directHits++;this.lastDirectHitAt=t;this.panic=clamp(this.panic+p.hitPanic+(this.chaseStreak>=4?.08:0),0,1);
        const len=Math.max(1,d),ux=dx/len||((Math.random()<.5)?-1:1),uy=dy/len||-.35;
        const impulse=(390+this.panic*300+Math.min(200,this.chaseStreak*14))*p.speed;
        this.vx=ux*impulse;this.vy=uy*impulse-170;this.targetX=this.sprite.x+ux*320;this.targetY=this.sprite.y+uy*190;
        this.deformUntil=t+220;this.deformPower=.95;this.spinKick=((Math.random()<.5)?-1:1)*(.20+this.panic*.18);
        this._play("STARTLED",true,"RUN");this._setMode("STARTLED",t+330);
      }else if(d<=measure.nearRadius){
        reaction="FLEE";this.nearMisses++;this.panic=clamp(this.panic+p.nearPanic,0,1);
        const len=Math.max(1,d),ux=dx/len,uy=dy/len,speed=(270+this.panic*250)*p.speed;
        this.vx=ux*speed;this.vy=uy*speed*.70;this.targetX=this.sprite.x+ux*350;this.targetY=this.sprite.y+uy*250;
        this.deformUntil=t+130;this.deformPower=.34;this._play(this.panic>.62?"PANIC":"RUN",true);this._setMode(this.panic>.62?"PANIC":"FLEE",t+640);
      }else if(d<=measure.awareRadius){
        this.panic=clamp(this.panic+p.awarePanic*measure.impact,0,1);
        if(this.temperament==="SHY"){
          reaction="FLINCH";const len=Math.max(1,d),ux=dx/len,uy=dy/len;this.targetX=this.sprite.x+ux*180;this.targetY=this.sprite.y+uy*130;this._play("HOP",true,"RUN");this._setMode("FLEE",t+380);
        }else if(this.temperament==="TRICKSTER"&&m.primary&&Math.random()<.62){
          reaction="DODGE";const len=Math.max(1,d),ux=dx/len,uy=dy/len,side=Math.random()<.5?-1:1;this.vx=(-uy*side+ux*.5)*390;this.vy=(ux*side+uy*.30)*285;this.targetX=this.sprite.x+this.vx*.58;this.targetY=this.sprite.y+this.vy*.58;this._play("RUN",true);this._setMode("FLEE",t+520);
        }else if((m.primary||this.temperament==="CURIOUS")&&Math.random()<p.curious){
          reaction="CURIOUS";this.targetX=x+(Math.random()-.5)*75;this.targetY=y+(Math.random()-.5)*60;this._play("HOP",true,"RUN");this._setMode("CURIOUS",t+520);
        }else if(this.temperament==="GOOFY"&&m.primary&&Math.random()<.58){
          reaction="HOP";this.targetX=this.sprite.x+(Math.random()-.5)*130;this.targetY=this.sprite.y-75-Math.random()*55;this._play("HOP",true,"IDLE");this._setMode("CURIOUS",t+430);
        }else reaction="AWARE";
      }else if(m.primary&&this.panic<.30&&Math.random()<p.curious*.52){
        reaction="CURIOUS";this.targetX=x+(Math.random()-.5)*95;this.targetY=y+(Math.random()-.5)*70;this._play("HOP",true,"RUN");this._setMode("CURIOUS",t+560);
      }

      const b=this.safeBounds();this.targetX=clamp(this.targetX,b.left,b.right);this.targetY=clamp(this.targetY,b.top,b.bottom);
      const payload=this._payload(reaction,measure);try{this.onReaction(payload);}catch(_){}return payload;
    }

    receiveGroupPanic(sourceX,sourceY,intensity){
      if(!this.sprite||!this.active)return null;const p=this.personality,d=Math.hypot(this.sprite.x-sourceX,this.sprite.y-sourceY),radius=350;
      if(d>=radius)return null;const falloff=1-d/radius,boost=clamp((Number(intensity)||0)*falloff*p.group,0,.28);if(boost<.015)return null;
      this.panic=clamp(this.panic+boost,0,1);const dx=this.sprite.x-sourceX,dy=this.sprite.y-sourceY,len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len||1,uy=dy/len;
      this.vx+=ux*(105+boost*600);this.vy+=uy*(75+boost*430);this.targetX=this.sprite.x+ux*(140+boost*430);this.targetY=this.sprite.y+uy*(100+boost*300);
      const t=now();this._play(this.panic>.62?"PANIC":"RUN",true);this._setMode(this.panic>.62?"PANIC":"FLEE",t+440+boost*520);
      return {id:this.id,type:this.type,reaction:"GROUP_PANIC",impact:boost,panic:this.panic,x:this.sprite.x,y:this.sprite.y};
    }

    nudgeFrom(x,y,force){
      if(!this.sprite||!this.active)return;const dx=this.sprite.x-x,dy=this.sprite.y-y,len=Math.max(1,Math.hypot(dx,dy)),f=clamp(Number(force)||.25,.05,1);
      this.vx+=dx/len*(110+f*245);this.vy+=dy/len*(80+f*175);this.panic=clamp(this.panic+f*.05,0,1);this.deformUntil=now()+120;this.deformPower=Math.max(this.deformPower,f*.38);
      if(f>.42){this._play("HOP",true,"RUN");this._setMode("FLEE",now()+320);}
    }

    synchronize(kind,center){
      if(!this.sprite||!this.active)return;const k=String(kind||"HOP").toUpperCase(),t=now(),b=this.safeBounds();
      if(k==="SCATTER"){
        const cx=center&&Number.isFinite(center.x)?center.x:(b.left+b.right)/2,cy=center&&Number.isFinite(center.y)?center.y:(b.top+b.bottom)/2;
        const dx=this.sprite.x-cx,dy=this.sprite.y-cy,len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len||((Math.random()<.5)?-1:1),uy=dy/len||-.2;
        this.vx=ux*(300+Math.random()*210);this.vy=uy*(210+Math.random()*150)-80;this.targetX=clamp(this.sprite.x+ux*340,b.left,b.right);this.targetY=clamp(this.sprite.y+uy*240,b.top,b.bottom);this._play("PANIC",true);this._setMode("PANIC",t+680);
      }else if(k==="CELEBRATE"){
        this._play("CELEBRATE",true,"IDLE");this._setMode("CELEBRATE",t+700);
      }else{
        this.vy-=170+Math.random()*90;this._play("HOP",true,"IDLE");this._setMode("CURIOUS",t+450);
      }
    }

    celebrate(){this.synchronize("CELEBRATE");}

    reset(index,total){
      if(!this.sprite)return;const s=this.app.renderer.screen,b=this.safeBounds(),i=Math.max(0,Number(index)||0),n=Math.max(1,Number(total)||1),spread=(i+1)/(n+1);
      this.sprite.x=clamp(b.left+(b.right-b.left)*spread,b.left,b.right);this.sprite.y=clamp(s.height*(.44+(i%2)*.18),b.top,b.bottom);
      this.targetX=this.sprite.x;this.targetY=this.sprite.y;this.vx=this.vy=0;this.panic=0;this.directHits=0;this.nearMisses=0;this.totalTaps=0;this.chaseStreak=0;this.lastTapAt=0;this.sizeMultiplier=this.sizeTarget=1;this.sizeReturnAt=0;
      this._play("IDLE",true);this._setMode("IDLE",0);this._drawShadow();this._scheduleDecision(now(),250+i*180);
    }

    tick(deltaMS){
      if(!this.sprite||!this.active)return;
      const dt=Math.min(.05,Math.max(.001,deltaMS/1000)),t=now(),b=this.safeBounds(),p=this.personality;
      if(this.sizeReturnAt&&t>=this.sizeReturnAt){this.sizeReturnAt=0;this.sizeTarget=1;}
      this.sizeMultiplier+=(this.sizeTarget-this.sizeMultiplier)*Math.min(1,dt*5.4);
      if(t-this.lastTapAt>700)this.panic=Math.max(0,this.panic-dt*p.calm);if(t-this.lastTapAt>900)this.chaseStreak=Math.max(0,this.chaseStreak-dt*1.5);

      if(t>=this.reactionUntil&&["STARTLED","FLEE","CURIOUS","PANIC","CELEBRATE"].includes(this.mode)){
        this._setMode(this.panic>.50?"RUN":"WANDER",0);this._play(this.panic>.66?"PANIC":"RUN",true);
      }
      if(t>=this.nextDecisionAt&&!["STARTLED","FLEE","PANIC"].includes(this.mode))this._makeDecision(t,b);

      const dx=this.targetX-this.sprite.x,dy=this.targetY-this.sprite.y,dist=Math.hypot(dx,dy);
      if(dist>12&&this.mode!=="STARTLED"){
        const desired=((this.mode==="PANIC"?330:(this.mode==="FLEE"?285:(this.mode==="CURIOUS"?160:108)))+this.panic*135)*p.speed;
        this.vx+=(dx/dist*desired-this.vx)*Math.min(1,dt*4.5);this.vy+=(dy/dist*desired-this.vy)*Math.min(1,dt*4.5);
        if(this.mode==="IDLE")this._setMode("WANDER",0);if(!["STARTLED","PANIC"].includes(this.mode))this._play(this.mode==="CURIOUS"?"HOP":"RUN");
      }else if(!["STARTLED","FLEE","PANIC"].includes(this.mode)){
        this.vx*=Math.pow(.08,dt);this.vy*=Math.pow(.08,dt);if(Math.hypot(this.vx,this.vy)<16){this.vx=this.vy=0;this._setMode("IDLE",0);this._play("IDLE");}
      }

      const damping=this.mode==="STARTLED"?.988:.967;this.vx*=Math.pow(damping,dt*60);this.vy*=Math.pow(damping,dt*60);this.sprite.x+=this.vx*dt;this.sprite.y+=this.vy*dt;
      let bounced=false,side="";const speedBefore=Math.hypot(this.vx,this.vy);
      if(this.sprite.x<b.left){this.sprite.x=b.left;this.vx=Math.abs(this.vx)*.82;bounced=true;side="LEFT";}else if(this.sprite.x>b.right){this.sprite.x=b.right;this.vx=-Math.abs(this.vx)*.82;bounced=true;side="RIGHT";}
      if(this.sprite.y<b.top){this.sprite.y=b.top;this.vy=Math.abs(this.vy)*.76;bounced=true;side="TOP";}else if(this.sprite.y>b.bottom){this.sprite.y=b.bottom;this.vy=-Math.abs(this.vy)*.76;bounced=true;side="BOTTOM";}
      if(bounced){
        this.targetX=clamp(this.sprite.x-this.vx*.72,b.left,b.right);this.targetY=clamp(this.sprite.y-this.vy*.58,b.top,b.bottom);this.deformUntil=t+150;this.deformPower=clamp(speedBefore/650,.20,.72);
        if(t-this.lastWallBounceAt>150){this.lastWallBounceAt=t;try{this.onWallBounce({id:this.id,type:this.type,x:this.sprite.x,y:this.sprite.y,side,speed:speedBefore,panic:this.panic});}catch(_){}}
      }

      if(Math.abs(this.vx)>12)this.facing=this.vx<0?-1:1;
      const speed=Math.hypot(this.vx,this.vy),stretch=clamp(speed/600,0,.18),bob=(this.mode==="IDLE"?Math.sin(t/360+this.id.length)*.018:Math.sin(t/95)*.012);
      let deform=0;if(t<this.deformUntil){const q=clamp((this.deformUntil-t)/220,0,1);deform=Math.sin((1-q)*Math.PI)*this.deformPower;}
      const visualScale=this.baseScale*this.sizeMultiplier,sx=visualScale*(1+stretch+deform*.28),sy=visualScale*(1-stretch*.48+bob-deform*.30);
      this.spinKick*=Math.pow(.86,dt*60);this.sprite.scale.set(this.facing*sx,Math.max(visualScale*.62,sy));this.sprite.rotation=clamp(this.vx/950,-.16,.16)+this.spinKick;this._drawShadow(speed);
    }

    position(){return this.sprite&&this.active?{x:this.sprite.x,y:this.sprite.y}:null;}
    velocity(){return this.active?{vx:this.vx,vy:this.vy,speed:Math.hypot(this.vx,this.vy)}:{vx:0,vy:0,speed:0};}
    collisionRadius(){return this.active?62*this.baseScale*this.sizeMultiplier/.31:0;}
    context(){return {id:this.id,type:this.type,temperament:this.temperament,active:this.active,mode:this.mode,animation:this.anim,panic:Math.round(this.panic*100)/100,directHits:this.directHits,nearMisses:this.nearMisses,totalTaps:this.totalTaps,chaseStreak:Math.round(this.chaseStreak*10)/10,size:Math.round(this.sizeMultiplier*100)/100,x:this.sprite?Math.round(this.sprite.x):0,y:this.sprite?Math.round(this.sprite.y):0};}

    _payload(reaction,measure){return {id:this.id,type:this.type,temperament:this.temperament,reaction,distance:Math.round(measure.distance),impact:Math.round(measure.impact*100)/100,panic:this.panic,chaseStreak:this.chaseStreak,directHits:this.directHits,x:this.sprite.x,y:this.sprite.y};}
    _makeDecision(t,b){
      this.lastDecisionAt=t;const celebrateChance=this.temperament==="GOOFY"?.24:(this.temperament==="CURIOUS"?.17:.10);
      if(Math.random()<celebrateChance&&this.panic<.28){this._play("CELEBRATE",true,"IDLE");this._setMode("CELEBRATE",t+650);this._scheduleDecision(t,900+Math.random()*500);return;}
      const margin=20;this.targetX=b.left+margin+Math.random()*Math.max(1,b.right-b.left-margin*2);this.targetY=b.top+margin+Math.random()*Math.max(1,b.bottom-b.top-margin*2);
      this._setMode(this.panic>.58?"PANIC":"WANDER",0);this._play(this.panic>.58?"PANIC":"RUN");this._scheduleDecision(t,900+Math.random()*1500);
    }
    _scheduleDecision(t,delay){this.nextDecisionAt=t+Math.max(120,Number(delay)||1200);}
    _setMode(mode,until){if(this.mode===mode&&(!until||this.reactionUntil===until))return;const prev=this.mode;this.mode=mode;this.reactionUntil=until||0;try{this.onModeChange({id:this.id,type:this.type,mode,previous:prev,context:this.context()});}catch(_){}}
    _texturesFor(name){const def=ANIMATIONS[name]||ANIMATIONS.IDLE;return def.frames.map(i=>this.frames[i]);}
    _play(name,force,returnTo){
      if(!this.sprite)return;const def=ANIMATIONS[name]||ANIMATIONS.IDLE;if(!force&&this.anim===name)return;this.anim=name;this.sprite.stop();this.sprite.textures=this._texturesFor(name);this.sprite.animationSpeed=def.speed;this.sprite.loop=def.loop;this.sprite.gotoAndPlay(0);this.sprite.onComplete=null;
      if(!def.loop&&returnTo){this.oneShotReturn=returnTo;this.sprite.onComplete=()=>{if(this.sprite&&this.anim===name)this._play(returnTo,true);};}
    }
    _updateScale(){if(!this.sprite)return;const s=this.app.renderer.screen;this.baseScale=clamp(Math.min(s.width/390,s.height/760)*.27*this.scaleFactor,.17,.43);this.sprite.scale.set(this.facing*this.baseScale*this.sizeMultiplier,this.baseScale*this.sizeMultiplier);}
    _drawShadow(speed){
      if(!this.sprite||!this.shadow||!this.active)return;const s=Number(speed)||0,scale=this.baseScale*this.sizeMultiplier/.31,w=70*scale*(1+clamp(s/520,0,.38));this.shadow.clear();this.shadow.ellipse(this.sprite.x,this.sprite.y+76*scale,w,13*scale).fill({color:0x000000,alpha:.20});
    }
  }

  global.SpritePetRuntime=SpritePetRuntime;
  global.SpritePetAnimations=ANIMATIONS;
  global.SpritePetGrid={columns:GRID_COLUMNS,rows:GRID_ROWS,cell:CELL};
  global.SpritePetTemperaments=TEMPERAMENTS;
  global.SpritePetImpactForDistance=impactForDistance;
})(window);
