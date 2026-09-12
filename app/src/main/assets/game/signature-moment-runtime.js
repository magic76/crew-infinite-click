(function(global){
  "use strict";

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>global.performance&&performance.now?performance.now():Date.now();
  const easeOut=t=>1-Math.pow(1-clamp(t,0,1),3);
  const easeInOut=t=>{t=clamp(t,0,1);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};

  class FlashlightHuntMoment {
    constructor(options){
      const o=options||{};
      this.app=o.app;this.gameplay=o.gameplayContainer;this.onGameEvent=o.onGameEvent||(()=>{});
      this.onSpeechRequest=o.onSpeechRequest||(()=>{});this.haptics=o.haptics||null;
      this.root=null;this.dark=null;this.target=null;this.title=null;this.pointer={x:0,y:0};this.desired={x:0,y:0};
      this.startedAt=0;this.holdStart=0;this.holdMs=Number(o.holdMs)||1100;this.radius=Number(o.radius)||82;
      this.complete=false;this.lastRenderX=-9999;this.lastRenderY=-9999;this.tickBound=d=>this._tick(d);
      this.downBound=e=>this._down(e);this.moveBound=e=>this._move(e);this.upBound=e=>this._up(e);
    }
    start(){
      if(!this.app||!global.PIXI)return false;
      const s=this.app.renderer.screen,w=s.width,h=s.height;
      this.root=new global.PIXI.Container();this.root.eventMode="none";
      this.dark=new global.PIXI.Graphics();
      this.target=new global.PIXI.Graphics().circle(0,0,24).fill({color:0xffffff,alpha:.95});
      this.target.x=w*.72;this.target.y=h*.36;
      this.title=new global.PIXI.Text({text:"FIND IT.",style:{fill:0xffffff,fontFamily:"sans-serif",fontSize:26,fontWeight:"700"}});
      this.title.anchor.set(.5);this.title.x=w/2;this.title.y=h*.16;
      this.root.addChild(this.dark,this.target,this.title);this.app.stage.addChild(this.root);
      this.pointer.x=this.desired.x=w*.5;this.pointer.y=this.desired.y=h*.55;
      this._renderSpotlight(true);
      global.addEventListener("pointerdown",this.downBound,true);
      global.addEventListener("pointermove",this.moveBound,true);
      global.addEventListener("pointerup",this.upBound,true);
      global.addEventListener("pointercancel",this.upBound,true);
      this.app.ticker.add(this.tickBound);this.startedAt=now();
      this.onGameEvent({type:"SIGNATURE_START",signature:"FLASHLIGHT_HUNT",special:true});
      this.onSpeechRequest({mode:"BANTER",fallback:"Find it.",reason:"signature_start"});
      return true;
    }
    stop(reason){
      this.app&&this.app.ticker&&this.app.ticker.remove(this.tickBound);
      global.removeEventListener("pointerdown",this.downBound,true);global.removeEventListener("pointermove",this.moveBound,true);
      global.removeEventListener("pointerup",this.upBound,true);global.removeEventListener("pointercancel",this.upBound,true);
      if(this.root&&this.root.parent)this.root.parent.removeChild(this.root);
      if(this.root)try{this.root.destroy({children:true});}catch(_){}
      this.root=this.dark=this.target=this.title=null;
      if(reason!=="completed")this.onGameEvent({type:"SIGNATURE_ABORT",signature:"FLASHLIGHT_HUNT",reason:String(reason||"stopped"),special:true});
    }
    _move(e){this.desired.x=e.clientX;this.desired.y=e.clientY;e.stopImmediatePropagation();}
    _down(e){
      this.desired.x=e.clientX;this.desired.y=e.clientY;
      const d=Math.hypot(e.clientX-this.target.x,e.clientY-this.target.y);
      if(d<=this.radius*.85){this.holdStart=now();this.title.text="DON'T LET GO.";this.onGameEvent({type:"HOLD_START",x:e.clientX,y:e.clientY,special:true});this.onSpeechRequest({mode:"BANTER",fallback:"Don't let go.",reason:"flashlight_hold"});}
      else{this.onGameEvent({type:"TAP",x:e.clientX,y:e.clientY,signature:"FLASHLIGHT_HUNT"});}
      e.stopImmediatePropagation();e.preventDefault();
    }
    _up(e){
      if(this.holdStart&&!this.complete){
        const held=now()-this.holdStart;
        if(held<this.holdMs){this.onGameEvent({type:"RELEASE_EARLY",durationMs:held,correct:false,special:true});this.title.text="TOO SOON.";this.onSpeechRequest({mode:"BANTER",fallback:"Too soon.",reason:"flashlight_release_early"});}
      }
      this.holdStart=0;e.stopImmediatePropagation();e.preventDefault();
    }
    _tick(){
      if(!this.root)return;
      this.pointer.x+=(this.desired.x-this.pointer.x)*.28;this.pointer.y+=(this.desired.y-this.pointer.y)*.28;
      if(Math.abs(this.pointer.x-this.lastRenderX)>1||Math.abs(this.pointer.y-this.lastRenderY)>1)this._renderSpotlight(false);
      if(this.holdStart&&!this.complete){
        const held=now()-this.holdStart;
        if(held>=this.holdMs){
          this.complete=true;this.title.text="GOOD.";this.target.alpha=1;
          if(this.haptics)this.haptics.perform("CORRECT",.7);
          this.onGameEvent({type:"HOLD_COMPLETE",durationMs:held,correct:true,special:true});
          this.onSpeechRequest({mode:"BANTER",fallback:"Okay... that was good.",reason:"flashlight_complete"});
          global.setTimeout(()=>this.onGameEvent({type:"SIGNATURE_COMPLETE",signature:"FLASHLIGHT_HUNT",special:true}),420);
        }
      }
    }
    _renderSpotlight(force){
      if(!this.dark)return;this.lastRenderX=this.pointer.x;this.lastRenderY=this.pointer.y;
      const s=this.app.renderer.screen,g=this.dark;
      g.clear().rect(0,0,s.width,s.height).fill({color:0x000000,alpha:.965});
      if(typeof g.circle==="function"&&typeof g.cut==="function"){
        g.circle(this.pointer.x,this.pointer.y,this.radius).cut();
      }else{
        // Old Pixi fallback: still pure Pixi and updated at ticker rate, never CSS radial-gradient.
        g.circle(this.pointer.x,this.pointer.y,this.radius).fill({color:0x000000,alpha:0});
      }
    }
  }

  class ScreenShatterMoment {
    constructor(options){
      const o=options||{};
      this.app=o.app;this.gameplay=o.gameplayContainer;this.onGameEvent=o.onGameEvent||(()=>{});
      this.onSpeechRequest=o.onSpeechRequest||(()=>{});this.haptics=o.haptics||null;
      this.waitDurationMs=Math.max(1200,Number(o.waitDurationMs)||3200);
      this.snapshotResolution=clamp(Number(o.snapshotResolution)||1.1,1,1.25);
      this.root=null;this.black=null;this.shardContainer=null;this.label=null;this.sub=null;this.renderTexture=null;this.shards=[];
      this.phase="IDLE";this.phaseAt=0;this.waitUntil=0;this.returnFrom=[];this.tickBound=d=>this._tick(d);
      this.touchBound=e=>this._touch(e);
    }

    start(){
      if(!this.app||!global.PIXI||!this.gameplay)return false;
      try{
        this._captureToRenderTexture();
        this._buildScene();
        this.gameplay.visible=false;
        this.phase="FREEZE";this.phaseAt=now();
        this.app.ticker.add(this.tickBound);
        global.addEventListener("pointerdown",this.touchBound,true);
        this.onGameEvent({type:"SIGNATURE_START",signature:"SCREEN_SHATTER",special:true});
        return true;
      }catch(e){
        this._cleanup();
        return false;
      }
    }

    stop(reason){this._cleanup();if(reason!=="completed")this.onGameEvent({type:"SIGNATURE_ABORT",signature:"SCREEN_SHATTER",reason:String(reason||"stopped"),special:true});}

    _captureToRenderTexture(){
      const s=this.app.renderer.screen,w=Math.max(1,Math.round(s.width)),h=Math.max(1,Math.round(s.height));
      this.renderTexture=global.PIXI.RenderTexture.create({width:w,height:h,resolution:this.snapshotResolution});
      const r=this.app.renderer;
      try{r.render({container:this.gameplay,target:this.renderTexture,clear:true});}
      catch(_){r.render(this.gameplay,{renderTexture:this.renderTexture,clear:true});}
    }

    _buildScene(){
      const s=this.app.renderer.screen,w=s.width,h=s.height;
      this.root=new global.PIXI.Container();this.root.eventMode="none";
      this.black=new global.PIXI.Graphics().rect(0,0,w,h).fill({color:0x000000,alpha:1});
      this.shardContainer=new global.PIXI.Container();
      this.label=new global.PIXI.Text({text:"",style:{fill:0xffffff,fontFamily:"sans-serif",fontSize:30,fontWeight:"800",align:"center"}});
      this.sub=new global.PIXI.Text({text:"",style:{fill:0xb7bcc8,fontFamily:"sans-serif",fontSize:16,align:"center"}});
      this.label.anchor.set(.5);this.sub.anchor.set(.5);this.label.x=this.sub.x=w/2;this.label.y=h*.47;this.sub.y=h*.54;
      this.root.addChild(this.black,this.shardContainer,this.label,this.sub);this.app.stage.addChild(this.root);
      this._buildShards(w,h);
    }

    _buildShards(w,h){
      const cols=4,rows=4,cw=w/cols,ch=h/rows,cx=w/2,cy=h/2;
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const x=col*cw,y=row*ch,sw=col===cols-1?w-x:cw,sh=row===rows-1?h-y:ch;
        const frame=new global.PIXI.Rectangle(x,y,sw,sh);
        const tex=new global.PIXI.Texture({source:this.renderTexture.source,frame});
        const sp=new global.PIXI.Sprite(tex);sp.anchor.set(.5);sp.x=x+sw/2;sp.y=y+sh/2;
        const dx=sp.x-cx,dy=sp.y-cy,len=Math.max(1,Math.hypot(dx,dy)),speed=150+Math.random()*150;
        const shard={sprite:sp,ox:sp.x,oy:sp.y,vx:dx/len*speed+(Math.random()-.5)*90,vy:dy/len*speed-80-Math.random()*100,
          rot:(Math.random()-.5)*1.35,scale:.82+Math.random()*.18,alpha:.72+Math.random()*.28};
        this.shards.push(shard);this.shardContainer.addChild(sp);
      }
    }

    _touch(e){
      if(this.phase!=="WAIT")return;
      this.waitUntil=now()+this.waitDurationMs;
      if(this.haptics)this.haptics.perform("WARNING",.38);
      this.label.text="I SAID DON'T.";
      this.sub.text="Hands off.";
      this.onGameEvent({type:"WAIT_BROKEN",signature:"SCREEN_SHATTER",ignoredWarning:true,special:true});
      this.onSpeechRequest({mode:"BANTER",fallback:"I said don't touch it.",reason:"shatter_wait_broken",cancelPrevious:true});
      e.stopImmediatePropagation();e.preventDefault();
    }

    _tick(){
      const t=now();
      if(this.phase==="FREEZE"){
        if(t-this.phaseAt<55)return;
        this.phase="SHATTER";this.phaseAt=t;
        this.label.text="YOU BROKE IT.";this.sub.text="";
        if(this.haptics)this.haptics.perform("IMPACT",.86);
        this.onSpeechRequest({mode:"BANTER",fallback:"Don't touch anything.",reason:"shatter_start",cancelPrevious:true});
        return;
      }
      if(this.phase==="SHATTER"){
        const p=clamp((t-this.phaseAt)/720,0,1),e=easeOut(p),gravity=210;
        for(const sh of this.shards){
          const sp=sh.sprite,time=.72*e;
          sp.x=sh.ox+sh.vx*time;sp.y=sh.oy+sh.vy*time+.5*gravity*time*time;
          sp.rotation=sh.rot*e;sp.scale.set(1+(sh.scale-1)*e);sp.alpha=1-(1-sh.alpha)*e*.7;
        }
        if(p>=1){this.phase="WAIT";this.phaseAt=t;this.waitUntil=t+this.waitDurationMs;this.label.text="YOU BROKE IT.";this.sub.text="Don't touch anything.";}
        return;
      }
      if(this.phase==="WAIT"){
        if(t>=this.waitUntil){
          this.onGameEvent({type:"WAIT_SUCCESS",signature:"SCREEN_SHATTER",correct:true,special:true});
          this.onSpeechRequest({mode:"BANTER",fallback:"Good.",reason:"shatter_wait_success",cancelPrevious:true});
          this.label.text="GOOD.";this.sub.text="";
          this.returnFrom=this.shards.map(sh=>({x:sh.sprite.x,y:sh.sprite.y,r:sh.sprite.rotation,s:sh.sprite.scale.x,a:sh.sprite.alpha}));
          this.phase="RESTORE";this.phaseAt=t;
        }
        return;
      }
      if(this.phase==="RESTORE"){
        const p=clamp((t-this.phaseAt)/760,0,1),e=easeInOut(p);
        for(let i=0;i<this.shards.length;i++){
          const sh=this.shards[i],from=this.returnFrom[i],sp=sh.sprite;
          sp.x=from.x+(sh.ox-from.x)*e;sp.y=from.y+(sh.oy-from.y)*e;sp.rotation=from.r*(1-e);
          sp.scale.set(from.s+(1-from.s)*e);sp.alpha=from.a+(1-from.a)*e;
        }
        if(p>=1){
          this.gameplay.visible=true;
          this.onGameEvent({type:"SIGNATURE_COMPLETE",signature:"SCREEN_SHATTER",special:true});
        }
      }
    }

    _cleanup(){
      if(this.app&&this.app.ticker)this.app.ticker.remove(this.tickBound);
      global.removeEventListener("pointerdown",this.touchBound,true);
      if(this.gameplay)this.gameplay.visible=true;
      if(this.root&&this.root.parent)this.root.parent.removeChild(this.root);
      if(this.root)try{this.root.destroy({children:true,texture:false});}catch(_){}
      for(const sh of this.shards){try{sh.sprite.texture.destroy(false);}catch(_){}}
      this.shards.length=0;
      if(this.renderTexture)try{this.renderTexture.destroy(true);}catch(_){}
      this.root=this.black=this.shardContainer=this.label=this.sub=this.renderTexture=null;this.phase="DONE";
    }
  }

  class SignatureMomentRuntime {
    constructor(options){
      const o=options||{};this.app=o.app||null;this.gameplayContainer=o.gameplayContainer||null;
      this.onGameEvent=typeof o.onGameEvent==="function"?o.onGameEvent:()=>{};
      this.onSpeechRequest=typeof o.onSpeechRequest==="function"?o.onSpeechRequest:()=>{};
      this.haptics=o.haptics||global.GameHaptics||null;this.current=null;this.currentId="NONE";
    }
    isActive(){return !!this.current;}
    start(id,options){
      const key=String(id||"NONE").toUpperCase();if(key==="NONE"||this.current)return false;
      const base=Object.assign({},options||{},{
        app:this.app,gameplayContainer:this.gameplayContainer,haptics:this.haptics,
        onSpeechRequest:(req)=>this.onSpeechRequest(req),
        onGameEvent:(event)=>{this.onGameEvent(event);if(event&&event.type==="SIGNATURE_COMPLETE")this._finishCompleted();}
      });
      let moment=null;
      if(key==="SCREEN_SHATTER")moment=new ScreenShatterMoment(base);
      else if(key==="FLASHLIGHT_HUNT")moment=new FlashlightHuntMoment(base);
      else return false;
      this.current=moment;this.currentId=key;
      if(!moment.start()){this.current=null;this.currentId="NONE";return false;}
      return true;
    }
    stop(reason){const m=this.current;this.current=null;this.currentId="NONE";if(m)m.stop(reason||"stopped");}
    _finishCompleted(){const m=this.current;this.current=null;this.currentId="NONE";if(m&&m.phase!=="DONE")m.stop("completed");}
  }

  global.SignatureMomentRuntime=SignatureMomentRuntime;
  global.ScreenShatterMoment=ScreenShatterMoment;
  global.FlashlightHuntMoment=FlashlightHuntMoment;
})(window);
