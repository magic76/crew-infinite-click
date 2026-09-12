(function (global) {
  "use strict";

  function nowMs(){return global.performance&&performance.now?performance.now():Date.now();}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function distance(a,b){const dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);}

  class FlashlightHuntMoment {
    constructor(options){
      const o=options||{};
      this.getPrimaryTarget=typeof o.getPrimaryTarget==="function"?o.getPrimaryTarget:()=>null;
      this.onGameEvent=typeof o.onGameEvent==="function"?o.onGameEvent:()=>{};
      this.onSpeechRequest=typeof o.onSpeechRequest==="function"?o.onSpeechRequest:()=>{};
      this.haptics=o.haptics||global.GameHaptics||null;
      this.audio=o.audio||null;
      this.rng=typeof o.rng==="function"?o.rng:Math.random;
      this.holdMs=Math.max(700,Number(o.holdMs)||1250);
      this.escapeCount=Number.isFinite(Number(o.escapeCount))?Math.max(0,Number(o.escapeCount)):2;
      this.radius=Math.max(54,Number(o.radius)||82);
      this.maxRadius=Math.max(this.radius,Number(o.maxRadius)||132);
      this.darkness=clamp(Number.isFinite(Number(o.darkness))?Number(o.darkness):0.965,0.72,0.995);
      this.active=false;
      this.overlay=null; this.ring=null; this.caption=null;
      this.pointer={x:(global.innerWidth||360)/2,y:(global.innerHeight||640)/2,down:false,id:null};
      this.lastMoveAt=nowMs(); this.idleStage=0; this.foundCount=0; this.armed=false;
      this.lastEscapeAt=-Infinity; this.holdStartedAt=0; this.holdTargetId=null; this.holdRaf=0; this.idleTimer=0;
      this.originalTouchAction="";
      this._onDown=this._onDown.bind(this);this._onMove=this._onMove.bind(this);this._onUp=this._onUp.bind(this);
      this._tickHold=this._tickHold.bind(this);this._tickIdle=this._tickIdle.bind(this);
    }

    start(){
      if(this.active)return false;
      this.active=true; this.lastMoveAt=nowMs(); this.idleStage=0; this.foundCount=0; this.armed=false;
      this._mountOverlay();
      this._relocateTarget(true);
      this._installInput();
      this._speech("start","我把它藏起來了。找到後按住它。",true);
      this._emit("signature_start",{moment:"FLASHLIGHT_HUNT"});
      this.idleTimer=global.setInterval(this._tickIdle,220);
      return true;
    }

    stop(reason){
      if(!this.active)return;
      this.active=false;
      this._removeInput();
      if(this.idleTimer){clearInterval(this.idleTimer);this.idleTimer=0;}
      if(this.holdRaf){cancelAnimationFrame(this.holdRaf);this.holdRaf=0;}
      this.holdStartedAt=0; this.holdTargetId=null;
      if(this.overlay&&this.overlay.parentNode)this.overlay.parentNode.removeChild(this.overlay);
      if(this.ring&&this.ring.parentNode)this.ring.parentNode.removeChild(this.ring);
      if(this.caption&&this.caption.parentNode)this.caption.parentNode.removeChild(this.caption);
      this.overlay=this.ring=this.caption=null;
      if(global.document&&global.document.documentElement)global.document.documentElement.style.touchAction=this.originalTouchAction||"";
      this._emit("signature_stop",{moment:"FLASHLIGHT_HUNT",reason:reason||"cancelled"});
    }

    _mountOverlay(){
      if(!global.document)return;
      const root=global.document.body||global.document.documentElement;
      const overlay=global.document.createElement("div");
      overlay.setAttribute("data-ai-clicker-signature","flashlight-hunt");
      Object.assign(overlay.style,{position:"fixed",left:"0",top:"0",width:"100vw",height:"100vh",zIndex:"2147483000",pointerEvents:"none",transition:"opacity 380ms ease",opacity:"1"});
      const ring=global.document.createElement("div");
      Object.assign(ring.style,{position:"fixed",width:"92px",height:"92px",marginLeft:"-46px",marginTop:"-46px",border:"3px solid rgba(255,255,255,.92)",borderRadius:"50%",zIndex:"2147483001",pointerEvents:"none",opacity:"0",transform:"scale(.72)",transition:"opacity 120ms ease, transform 80ms linear",boxShadow:"0 0 28px rgba(255,255,255,.28)"});
      const caption=global.document.createElement("div");
      Object.assign(caption.style,{position:"fixed",left:"50%",bottom:"calc(var(--safe-bottom, 0px) + 34px)",transform:"translateX(-50%)",zIndex:"2147483002",pointerEvents:"none",padding:"8px 13px",borderRadius:"999px",font:"600 13px/1.2 system-ui,sans-serif",letterSpacing:".02em",color:"rgba(255,255,255,.88)",background:"rgba(0,0,0,.38)",backdropFilter:"blur(8px)",opacity:".92"});
      caption.textContent="滑動找它 · 找到後按住";
      root.appendChild(overlay);root.appendChild(ring);root.appendChild(caption);
      this.overlay=overlay;this.ring=ring;this.caption=caption;
      this._renderSpotlight(this.radius);
    }

    _installInput(){
      if(!global.addEventListener)return;
      if(global.document&&global.document.documentElement){this.originalTouchAction=global.document.documentElement.style.touchAction||"";global.document.documentElement.style.touchAction="none";}
      global.addEventListener("pointerdown",this._onDown,true);
      global.addEventListener("pointermove",this._onMove,true);
      global.addEventListener("pointerup",this._onUp,true);
      global.addEventListener("pointercancel",this._onUp,true);
    }

    _removeInput(){
      if(!global.removeEventListener)return;
      global.removeEventListener("pointerdown",this._onDown,true);
      global.removeEventListener("pointermove",this._onMove,true);
      global.removeEventListener("pointerup",this._onUp,true);
      global.removeEventListener("pointercancel",this._onUp,true);
    }

    _consume(ev){try{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();}catch(_){}}

    _onDown(ev){
      if(!this.active)return;
      this._consume(ev); this.pointer.down=true; this.pointer.id=ev.pointerId; this._movePointer(ev.clientX,ev.clientY);
      const hit=this._hitTarget(ev.clientX,ev.clientY);
      if(this.armed&&hit){
        this.holdStartedAt=nowMs(); this.holdTargetId=this._targetId(); this._showHold(0);
        this._haptic("HEARTBEAT",0.34);
        this._speech("hold_start","別放手。",true);
        this._emit("hold_start",{moment:"FLASHLIGHT_HUNT",targetId:this.holdTargetId,x:ev.clientX,y:ev.clientY,special:true});
        this.holdRaf=requestAnimationFrame(this._tickHold);
      } else {
        this._checkDiscovery();
      }
    }

    _onMove(ev){
      if(!this.active)return;
      this._consume(ev); this._movePointer(ev.clientX,ev.clientY);
      if(!this.holdStartedAt)this._checkDiscovery();
    }

    _onUp(ev){
      if(!this.active)return;
      this._consume(ev); this._movePointer(ev.clientX,ev.clientY); this.pointer.down=false; this.pointer.id=null;
      if(this.holdStartedAt){
        const held=nowMs()-this.holdStartedAt;
        if(this.holdRaf){cancelAnimationFrame(this.holdRaf);this.holdRaf=0;}
        this._showHold(0,false); this.holdStartedAt=0;
        if(held<this.holdMs){
          this._haptic("SOFT_TAP",0.18);
          this._speech("release_early","你還真的放了。",false);
          this._emit("release_early",{moment:"FLASHLIGHT_HUNT",targetId:this.holdTargetId,durationMs:Math.round(held),special:true});
        }
        this.holdTargetId=null;
      } else {
        this._emit("release",{moment:"FLASHLIGHT_HUNT",x:ev.clientX,y:ev.clientY});
      }
    }

    _movePointer(x,y){
      const nx=clamp(Number(x)||0,0,global.innerWidth||360), ny=clamp(Number(y)||0,0,global.innerHeight||640);
      const moved=distance(this.pointer,{x:nx,y:ny});
      this.pointer.x=nx;this.pointer.y=ny;
      if(moved>2){this.lastMoveAt=nowMs();this.idleStage=0;}
      this._renderSpotlight(this.radius);
      if(this.ring){this.ring.style.left=nx+"px";this.ring.style.top=ny+"px";}
    }

    _renderSpotlight(radius){
      if(!this.overlay)return;
      const r=Math.max(36,Number(radius)||this.radius), feather=Math.round(r*.42);
      const x=Math.round(this.pointer.x),y=Math.round(this.pointer.y);
      this.overlay.style.background=`radial-gradient(circle ${r+feather}px at ${x}px ${y}px, rgba(0,0,0,0) 0px, rgba(0,0,0,0) ${r}px, rgba(0,0,0,${Math.min(.6,this.darkness*.55)}) ${r+Math.round(feather*.45)}px, rgba(0,0,0,${this.darkness}) ${r+feather}px)`;
    }

    _checkDiscovery(){
      if(!this.active||this.holdStartedAt)return;
      const p=this._targetPoint(); if(!p)return;
      const d=distance(this.pointer,p);
      if(d>this.radius*.72)return;
      const now=nowMs(); if(now-this.lastEscapeAt<720)return;
      if(this.foundCount<this.escapeCount){
        this.foundCount++; this.lastEscapeAt=now;
        this._haptic("SOFT_TAP",0.22);
        this._emit("flashlight_found",{moment:"FLASHLIGHT_HUNT",escapeIndex:this.foundCount,special:true});
        this._speech("escape",this.foundCount===1?"差一點。":"好，這次不跑。大概。",false);
        this._relocateTarget(false);
        if(this.foundCount>=this.escapeCount){this.armed=true;if(this.caption)this.caption.textContent="找到了 · 現在按住它";}
      } else if(!this.armed){
        this.armed=true;if(this.caption)this.caption.textContent="找到了 · 現在按住它";
      }
    }

    _tickHold(){
      if(!this.active||!this.holdStartedAt)return;
      const elapsed=nowMs()-this.holdStartedAt, progress=clamp(elapsed/this.holdMs,0,1);
      this._showHold(progress,true);
      if(progress>=1){this._complete();return;}
      if(progress>0.45&&progress<0.52)this._haptic("HEARTBEAT",0.22);
      this.holdRaf=requestAnimationFrame(this._tickHold);
    }

    _showHold(progress,visible){
      if(!this.ring)return;
      this.ring.style.opacity=visible===false?"0":"1";
      this.ring.style.transform=`scale(${0.72+clamp(progress,0,1)*0.38})`;
      this.ring.style.borderColor=`rgba(255,255,255,${0.45+clamp(progress,0,1)*0.55})`;
      this.ring.style.boxShadow=`0 0 ${18+Math.round(progress*34)}px rgba(255,255,255,${0.18+progress*.38})`;
    }

    _tickIdle(){
      if(!this.active||this.holdStartedAt)return;
      const idle=nowMs()-this.lastMoveAt;
      if(this.idleStage===0&&idle>=3200){
        this.idleStage=1; this._speech("idle","怎麼不找了？",false);
        this._emit("idle_wait",{moment:"FLASHLIGHT_HUNT",idleMs:Math.round(idle),special:true});
      } else if(this.idleStage===1&&idle>=5700){
        this.idleStage=2; this._speech("idle_hint","好，給你一點光。",false);
        this._emit("idle_hint",{moment:"FLASHLIGHT_HUNT",idleMs:Math.round(idle),special:true});
        this._renderSpotlight(this.maxRadius);
        global.setTimeout(()=>{if(this.active)this._renderSpotlight(this.radius);},1700);
      }
    }

    _complete(){
      if(!this.active)return;
      this.holdStartedAt=0;
      if(this.holdRaf){cancelAnimationFrame(this.holdRaf);this.holdRaf=0;}
      this._showHold(1,true);
      this._haptic("CORRECT",0.72);
      this._emit("hold_complete",{moment:"FLASHLIGHT_HUNT",targetId:this.holdTargetId,durationMs:this.holdMs,special:true,correct:true});
      this._speech("complete","……你真的抓到了。",true);
      if(this.caption)this.caption.textContent="抓到了";
      if(this.overlay){this.overlay.style.opacity="0";}
      global.setTimeout(()=>this.stop("complete"),520);
    }

    _targetPoint(){
      const t=this.getPrimaryTarget(); if(!t)return null;
      try{
        if(typeof t.getGlobalPosition==="function"){const p=t.getGlobalPosition();if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))return{x:p.x,y:p.y};}
        if(typeof t.getBounds==="function"){const b=t.getBounds();if(b&&Number.isFinite(b.x))return{x:b.x+b.width/2,y:b.y+b.height/2};}
      }catch(_){ }
      return Number.isFinite(t.x)&&Number.isFinite(t.y)?{x:t.x,y:t.y}:null;
    }

    _targetBounds(){
      const t=this.getPrimaryTarget(); if(!t)return null;
      try{if(typeof t.getBounds==="function"){const b=t.getBounds();if(b)return{x:b.x,y:b.y,width:b.width,height:b.height};}}catch(_){ }
      const p=this._targetPoint(); if(!p)return null; return{x:p.x-34,y:p.y-34,width:68,height:68};
    }

    _hitTarget(x,y){
      const b=this._targetBounds(); if(!b)return false;
      const pad=16; return x>=b.x-pad&&x<=b.x+b.width+pad&&y>=b.y-pad&&y<=b.y+b.height+pad;
    }

    _relocateTarget(initial){
      const t=this.getPrimaryTarget(); if(!t)return;
      const w=global.innerWidth||360,h=global.innerHeight||640;
      let p;
      if(global.GameSafeArea&&typeof global.GameSafeArea.randomPoint==="function")p=global.GameSafeArea.randomPoint(w,h,42,this.rng);
      else p={x:70+this.rng()*Math.max(1,w-140),y:110+this.rng()*Math.max(1,h-220)};
      if(!initial){
        const old=this._targetPoint(); if(old&&distance(old,p)<120){p.x=clamp(w-p.x,60,w-60);p.y=clamp(h-p.y,100,h-100);}
      }
      try{if(t.position&&typeof t.position.set==="function")t.position.set(p.x,p.y);else{t.x=p.x;t.y=p.y;}}catch(_){t.x=p.x;t.y=p.y;}
    }

    _targetId(){const t=this.getPrimaryTarget();return t&&(t.id||t.name||t.targetId)||"primary";}
    _emit(type,extra){try{this.onGameEvent(Object.assign({type},extra||{}));}catch(_){}}
    _speech(phase,fallback,immediate){try{this.onSpeechRequest({moment:"FLASHLIGHT_HUNT",phase,fallback,immediate:!!immediate,event:{type:"signature_speech",phase}});}catch(_){}}
    _haptic(cue,intensity){try{if(this.haptics&&typeof this.haptics.perform==="function")this.haptics.perform(cue,intensity);}catch(_){}}
  }

  class SignatureMomentRuntime {
    constructor(options){this.options=options||{};this.current=null;this.currentId="NONE";}
    start(id,override){
      const moment=String(id||"NONE"); if(moment==="NONE")return false;
      this.stop("replaced");
      if(moment==="FLASHLIGHT_HUNT")this.current=new FlashlightHuntMoment(Object.assign({},this.options,override||{}));
      else return false;
      this.currentId=moment; return this.current.start();
    }
    stop(reason){if(this.current&&typeof this.current.stop==="function")this.current.stop(reason||"cancelled");this.current=null;this.currentId="NONE";}
    isActive(){return !!(this.current&&this.current.active);}
  }

  global.FlashlightHuntMoment=FlashlightHuntMoment;
  global.SignatureMomentRuntime=SignatureMomentRuntime;
})(window);
