(function(global){
  "use strict";

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>global.performance&&performance.now?performance.now():Date.now();
  const GRID_COLUMNS=4,GRID_ROWS=2,CELL=512;

  const ANIMATIONS={
    IDLE:{frames:[0,1,2,1],speed:.075,loop:true},
    HOP:{frames:[0,3,1],speed:.13,loop:false},
    STARTLED:{frames:[4,5,4],speed:.16,loop:false},
    RUN:{frames:[6,7,6,7],speed:.16,loop:true},
    PANIC:{frames:[4,5,6,7,5,6],speed:.21,loop:true},
    CELEBRATE:{frames:[3,1,3,0],speed:.11,loop:false}
  };

  class SpritePetRuntime{
    constructor(app,options){
      const o=options||{};
      this.app=app;this.parent=o.parent||app.stage;
      this.safeBounds=typeof o.safeBounds==="function"?o.safeBounds:()=>({left:56,top:84,right:app.renderer.screen.width-56,bottom:app.renderer.screen.height-90});
      this.onReaction=typeof o.onReaction==="function"?o.onReaction:()=>{};
      this.onModeChange=typeof o.onModeChange==="function"?o.onModeChange:()=>{};
      this.root=new global.PIXI.Container();this.root.label="sprite-pet-runtime";this.parent.addChild(this.root);
      this.shadow=new global.PIXI.Graphics();this.root.addChild(this.shadow);
      this.sprite=null;this.frames=[];this.anim="IDLE";this.mode="IDLE";
      this.vx=0;this.vy=0;this.targetX=0;this.targetY=0;this.facing=1;this.baseScale=.33;
      this.lastTapAt=0;this.lastDirectHitAt=0;this.lastDecisionAt=0;this.nextDecisionAt=0;this.lastTrailAt=0;
      this.panic=0;this.directHits=0;this.nearMisses=0;this.totalTaps=0;this.chaseStreak=0;
      this.reactionUntil=0;this.oneShotReturn="IDLE";this.ready=false;
      this._tickBound=t=>this.tick(Number(t&&t.deltaMS)||16.67);app.ticker.add(this._tickBound);
    }

    async init(sheetUrl){
      // Android WebView can reject file:///android_asset URLs in Pixi's
      // fetch-based Assets loader. Let the WebView image decoder load it,
      // then wrap the decoded image in a Pixi texture.
      const image=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(new Error("cutie sprite sheet failed to load: "+sheetUrl));
        img.src=sheetUrl;
      });
      const base=global.PIXI.Texture.from(image);
      if(!base||!base.source)throw new Error("cutie sprite sheet texture failed");
      this.frames=[];
      for(let row=0;row<GRID_ROWS;row++){
        for(let col=0;col<GRID_COLUMNS;col++){
          this.frames.push(new global.PIXI.Texture({source:base.source,frame:new global.PIXI.Rectangle(col*CELL,row*CELL,CELL,CELL)}));
        }
      }
      this.sprite=new global.PIXI.AnimatedSprite(this._texturesFor("IDLE"));
      this.sprite.anchor.set(.5);this.sprite.animationSpeed=ANIMATIONS.IDLE.speed;this.sprite.loop=true;this.sprite.play();
      this.root.addChild(this.sprite);
      const s=this.app.renderer.screen;this.sprite.x=s.width*.5;this.sprite.y=s.height*.58;
      this.targetX=this.sprite.x;this.targetY=this.sprite.y;this._updateScale();this._drawShadow();
      this.ready=true;this._scheduleDecision(now(),250);
      return this;
    }

    destroy(){
      if(this.app&&this.app.ticker)this.app.ticker.remove(this._tickBound);
      if(this.root&&this.root.parent)this.root.parent.removeChild(this.root);
      try{this.root&&this.root.destroy({children:true});}catch(_){}
      this.sprite=null;this.frames=[];this.ready=false;
    }

    resize(){if(!this.sprite)return;this._updateScale();const b=this.safeBounds();this.sprite.x=clamp(this.sprite.x,b.left,b.right);this.sprite.y=clamp(this.sprite.y,b.top,b.bottom);this.targetX=clamp(this.targetX,b.left,b.right);this.targetY=clamp(this.targetY,b.top,b.bottom);}

    handleTap(x,y,meta){
      if(!this.sprite)return {reaction:"NONE",distance:9999};
      const m=meta||{},t=now(),gap=this.lastTapAt?t-this.lastTapAt:9999;this.lastTapAt=t;this.totalTaps++;
      const dx=this.sprite.x-x,dy=this.sprite.y-y,d=Math.hypot(dx,dy),size=150*this.baseScale/.33;
      const directRadius=Math.max(72,size*.55),nearRadius=Math.max(190,size*1.35);
      if(gap<420)this.chaseStreak=Math.min(20,this.chaseStreak+1);else this.chaseStreak=Math.max(0,this.chaseStreak-2);

      let reaction="FAR";
      if(d<=directRadius){
        reaction="HIT";this.directHits++;this.lastDirectHitAt=t;this.panic=clamp(this.panic+.24+(this.chaseStreak>=5?.08:0),0,1);
        const len=Math.max(1,d),ux=dx/len||((Math.random()<.5)?-1:1),uy=dy/len||-0.35;
        const impulse=320+this.panic*230+Math.min(150,this.chaseStreak*12);
        this.vx=ux*impulse;this.vy=uy*impulse-130;this.targetX=this.sprite.x+ux*260;this.targetY=this.sprite.y+uy*160;
        this._play("STARTLED",true,"RUN");this._setMode("STARTLED",t+300);
      }else if(d<=nearRadius){
        reaction="FLEE";this.nearMisses++;this.panic=clamp(this.panic+.11,0,1);
        const len=Math.max(1,d),ux=dx/len,uy=dy/len,speed=235+this.panic*220;
        this.vx=ux*speed;this.vy=uy*speed*.72;this.targetX=this.sprite.x+ux*320;this.targetY=this.sprite.y+uy*230;
        this._play(this.panic>.62?"PANIC":"RUN",true);this._setMode(this.panic>.62?"PANIC":"FLEE",t+650);
      }else{
        // A distant tap sometimes makes the creature curious rather than always fleeing.
        const curious=this.panic<.36&&(Math.random()<.55||m.streak<3);
        if(curious){reaction="CURIOUS";this.targetX=x+(Math.random()-.5)*90;this.targetY=y+(Math.random()-.5)*70;this._play("HOP",true,"RUN");this._setMode("CURIOUS",t+520);}
        else{reaction="IGNORE";if(this.chaseStreak>=7){this._play("PANIC",true);this._setMode("PANIC",t+700);}}
      }

      const b=this.safeBounds();this.targetX=clamp(this.targetX,b.left,b.right);this.targetY=clamp(this.targetY,b.top,b.bottom);
      const payload={reaction,distance:Math.round(d),panic:this.panic,chaseStreak:this.chaseStreak,directHits:this.directHits,x:this.sprite.x,y:this.sprite.y};
      try{this.onReaction(payload);}catch(_){}
      return payload;
    }

    celebrate(){if(!this.sprite)return;this._play("CELEBRATE",true,"IDLE");this._setMode("CELEBRATE",now()+700);}

    reset(){
      if(!this.sprite)return;const s=this.app.renderer.screen;
      this.sprite.x=s.width*.5;this.sprite.y=s.height*.58;this.targetX=this.sprite.x;this.targetY=this.sprite.y;
      this.vx=this.vy=0;this.panic=0;this.directHits=0;this.nearMisses=0;this.totalTaps=0;this.chaseStreak=0;this.lastTapAt=0;
      this._play("IDLE",true);this._setMode("IDLE",0);this._drawShadow();
    }

    tick(deltaMS){
      if(!this.sprite)return;
      const dt=Math.min(.05,Math.max(.001,deltaMS/1000)),t=now(),b=this.safeBounds();
      if(t-this.lastTapAt>700)this.panic=Math.max(0,this.panic-dt*.075);
      if(t-this.lastTapAt>900)this.chaseStreak=Math.max(0,this.chaseStreak-dt*1.5);

      if(t>=this.reactionUntil&&["STARTLED","FLEE","CURIOUS","PANIC","CELEBRATE"].includes(this.mode)){
        this._setMode(this.panic>.50?"RUN":"WANDER",0);this._play(this.panic>.66?"PANIC":"RUN",true);
      }

      if(t>=this.nextDecisionAt&&!["STARTLED","FLEE","PANIC"].includes(this.mode))this._makeDecision(t,b);

      const dx=this.targetX-this.sprite.x,dy=this.targetY-this.sprite.y,dist=Math.hypot(dx,dy);
      if(dist>12&&!["STARTLED"].includes(this.mode)){
        const desired=(this.mode==="PANIC"?310:(this.mode==="FLEE"?270:(this.mode==="CURIOUS"?155:105)))+this.panic*120;
        this.vx+=(dx/dist*desired-this.vx)*Math.min(1,dt*4.2);
        this.vy+=(dy/dist*desired-this.vy)*Math.min(1,dt*4.2);
        if(this.mode==="IDLE")this._setMode("WANDER",0);
        if(!["STARTLED","PANIC"].includes(this.mode))this._play(this.mode==="CURIOUS"?"HOP":"RUN");
      }else if(!["STARTLED","FLEE","PANIC"].includes(this.mode)){
        this.vx*=Math.pow(.08,dt);this.vy*=Math.pow(.08,dt);
        if(Math.hypot(this.vx,this.vy)<16){this.vx=this.vy=0;this._setMode("IDLE",0);this._play("IDLE");}
      }

      // STARTLED keeps its initial impulse, every other mode gets mild damping.
      const damping=this.mode==="STARTLED"?.985:.965;this.vx*=Math.pow(damping,dt*60);this.vy*=Math.pow(damping,dt*60);
      this.sprite.x+=this.vx*dt;this.sprite.y+=this.vy*dt;

      let bounced=false;
      if(this.sprite.x<b.left){this.sprite.x=b.left;this.vx=Math.abs(this.vx)*.78;bounced=true;}
      else if(this.sprite.x>b.right){this.sprite.x=b.right;this.vx=-Math.abs(this.vx)*.78;bounced=true;}
      if(this.sprite.y<b.top){this.sprite.y=b.top;this.vy=Math.abs(this.vy)*.72;bounced=true;}
      else if(this.sprite.y>b.bottom){this.sprite.y=b.bottom;this.vy=-Math.abs(this.vy)*.72;bounced=true;}
      if(bounced){this.targetX=clamp(this.sprite.x-this.vx*.7,b.left,b.right);this.targetY=clamp(this.sprite.y-this.vy*.55,b.top,b.bottom);}

      if(Math.abs(this.vx)>12)this.facing=this.vx<0?-1:1;
      const speed=Math.hypot(this.vx,this.vy),stretch=clamp(speed/520,0,.16),bob=(this.mode==="IDLE"?Math.sin(t/360)*.018:Math.sin(t/95)*.012);
      const sx=this.baseScale*(1+stretch),sy=this.baseScale*(1-stretch*.48+bob);
      this.sprite.scale.set(this.facing*sx,sy);
      this.sprite.rotation=clamp(this.vx/1000,-.12,.12);
      this._drawShadow(speed);
    }

    context(){return {mode:this.mode,animation:this.anim,panic:Math.round(this.panic*100)/100,directHits:this.directHits,nearMisses:this.nearMisses,totalTaps:this.totalTaps,chaseStreak:Math.round(this.chaseStreak*10)/10,x:this.sprite?Math.round(this.sprite.x):0,y:this.sprite?Math.round(this.sprite.y):0};}

    _makeDecision(t,b){
      this.lastDecisionAt=t;
      if(Math.random()<.15&&this.panic<.28){this._play("CELEBRATE",true,"IDLE");this._setMode("CELEBRATE",t+650);this._scheduleDecision(t,950);return;}
      const margin=24;this.targetX=b.left+margin+Math.random()*Math.max(1,b.right-b.left-margin*2);this.targetY=b.top+margin+Math.random()*Math.max(1,b.bottom-b.top-margin*2);
      this._setMode(this.panic>.58?"PANIC":"WANDER",0);this._play(this.panic>.58?"PANIC":"RUN");this._scheduleDecision(t,1150+Math.random()*1700);
    }

    _scheduleDecision(t,delay){this.nextDecisionAt=t+Math.max(120,Number(delay)||1200);}
    _setMode(mode,until){if(this.mode===mode&&(!until||this.reactionUntil===until))return;const prev=this.mode;this.mode=mode;this.reactionUntil=until||0;try{this.onModeChange({mode,previous:prev,context:this.context()});}catch(_){}}
    _texturesFor(name){const def=ANIMATIONS[name]||ANIMATIONS.IDLE;return def.frames.map(i=>this.frames[i]);}
    _play(name,force,returnTo){
      if(!this.sprite)return;const def=ANIMATIONS[name]||ANIMATIONS.IDLE;if(!force&&this.anim===name)return;
      this.anim=name;this.sprite.stop();this.sprite.textures=this._texturesFor(name);this.sprite.animationSpeed=def.speed;this.sprite.loop=def.loop;this.sprite.gotoAndPlay(0);
      this.sprite.onComplete=null;
      if(!def.loop&&returnTo){this.oneShotReturn=returnTo;this.sprite.onComplete=()=>{if(this.sprite&&this.anim===name)this._play(returnTo,true);};}
    }
    _updateScale(){if(!this.sprite)return;const s=this.app.renderer.screen;this.baseScale=clamp(Math.min(s.width/390,s.height/760)*.34,.25,.48);this.sprite.scale.set(this.facing*this.baseScale,this.baseScale);}
    _drawShadow(speed){if(!this.sprite||!this.shadow)return;const s=Number(speed)||0,w=72*this.baseScale/.33*(1+clamp(s/500,0,.35));this.shadow.clear();this.shadow.ellipse(this.sprite.x,this.sprite.y+79*this.baseScale/.33,w,14*this.baseScale/.33).fill({color:0x000000,alpha:.20});}
  }

  global.SpritePetRuntime=SpritePetRuntime;
  global.SpritePetAnimations=ANIMATIONS;
  global.SpritePetGrid={columns:GRID_COLUMNS,rows:GRID_ROWS,cell:CELL};
})(window);
