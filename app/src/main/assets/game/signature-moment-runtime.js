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
      this.rng=typeof o.rng==="function"?o.rng:Math.random;
      this.holdMs=Math.max(700,Number(o.holdMs)||1250);
      this.escapeCount=Number.isFinite(Number(o.escapeCount))?Math.max(0,Number(o.escapeCount)):2;
      this.radius=Math.max(50,Number(o.radius)||74);
      this.maxRadius=Math.max(this.radius,Number(o.maxRadius)||145);
      this.darkness=clamp(Number.isFinite(Number(o.darkness))?Number(o.darkness):0.992,0.80,0.998);
      this.active=false;
      this.overlay=null;this.ring=null;this.caption=null;this.vignette=null;
      this.pointer={x:(global.innerWidth||360)/2,y:(global.innerHeight||640)/2,down:false,id:null};
      this.lastMoveAt=nowMs();this.idleStage=0;this.foundCount=0;this.armed=false;
      this.lastEscapeAt=-Infinity;this.holdStartedAt=0;this.holdTargetId=null;this.holdRaf=0;this.idleTimer=0;
      this.originalTouchAction="";
      this._onDown=this._onDown.bind(this);this._onMove=this._onMove.bind(this);this._onUp=this._onUp.bind(this);
      this._tickHold=this._tickHold.bind(this);this._tickIdle=this._tickIdle.bind(this);
    }

    start(){
      if(this.active)return false;
      this.active=true;this.lastMoveAt=nowMs();this.idleStage=0;this.foundCount=0;this.armed=false;
      this._mountOverlay();this._relocateTarget(true);this._installInput();
      this._speech("start","I hid it. Find it. Then hold it.",true,"WHISPER_THEN_CHALLENGE");
      this._emit("signature_start",{moment:"FLASHLIGHT_HUNT"});
      this.idleTimer=global.setInterval(this._tickIdle,220);
      return true;
    }

    stop(reason){
      if(!this.active)return;
      this.active=false;this._removeInput();
      if(this.idleTimer){clearInterval(this.idleTimer);this.idleTimer=0;}
      if(this.holdRaf){cancelAnimationFrame(this.holdRaf);this.holdRaf=0;}
      this.holdStartedAt=0;this.holdTargetId=null;
      [this.overlay,this.ring,this.caption,this.vignette].forEach(n=>{if(n&&n.parentNode)n.parentNode.removeChild(n);});
      this.overlay=this.ring=this.caption=this.vignette=null;
      if(global.document&&global.document.documentElement)global.document.documentElement.style.touchAction=this.originalTouchAction||"";
      this._emit("signature_stop",{moment:"FLASHLIGHT_HUNT",reason:reason||"cancelled"});
    }

    _mountOverlay(){
      if(!global.document)return;
      const root=global.document.body||global.document.documentElement;
      const overlay=global.document.createElement("div");
      overlay.setAttribute("data-ai-clicker-signature","flashlight-hunt");
      Object.assign(overlay.style,{position:"fixed",inset:"0",zIndex:"2147483000",pointerEvents:"none",opacity:"1",background:"#000"});
      const vignette=global.document.createElement("div");
      Object.assign(vignette.style,{position:"fixed",inset:"0",zIndex:"2147483001",pointerEvents:"none",boxShadow:"inset 0 0 120px 42px rgba(0,0,0,.96)",mixBlendMode:"multiply"});
      const ring=global.document.createElement("div");
      Object.assign(ring.style,{position:"fixed",width:"86px",height:"86px",marginLeft:"-43px",marginTop:"-43px",border:"2px solid rgba(255,255,255,.95)",borderRadius:"50%",zIndex:"2147483002",pointerEvents:"none",opacity:"0",transform:"scale(.7)",transition:"opacity 100ms ease, transform 70ms linear",boxShadow:"0 0 38px rgba(255,255,255,.36), inset 0 0 16px rgba(255,255,255,.18)"});
      const caption=global.document.createElement("div");
      Object.assign(caption.style,{position:"fixed",left:"50%",bottom:"calc(var(--safe-bottom, 0px) + 34px)",transform:"translateX(-50%)",zIndex:"2147483003",pointerEvents:"none",padding:"9px 14px",borderRadius:"999px",font:"700 12px/1.2 system-ui,sans-serif",letterSpacing:".12em",textTransform:"uppercase",color:"rgba(255,255,255,.94)",background:"rgba(0,0,0,.64)",border:"1px solid rgba(255,255,255,.12)",backdropFilter:"blur(10px)",opacity:".96",whiteSpace:"nowrap"});
      caption.textContent="MOVE TO SEARCH · HOLD WHEN FOUND";
      root.appendChild(overlay);root.appendChild(vignette);root.appendChild(ring);root.appendChild(caption);
      this.overlay=overlay;this.vignette=vignette;this.ring=ring;this.caption=caption;
      this._renderSpotlight(this.radius);
    }

    _installInput(){
      if(!global.addEventListener)return;
      if(global.document&&global.document.documentElement){this.originalTouchAction=global.document.documentElement.style.touchAction||"";global.document.documentElement.style.touchAction="none";}
      global.addEventListener("pointerdown",this._onDown,true);global.addEventListener("pointermove",this._onMove,true);
      global.addEventListener("pointerup",this._onUp,true);global.addEventListener("pointercancel",this._onUp,true);
    }
    _removeInput(){
      if(!global.removeEventListener)return;
      global.removeEventListener("pointerdown",this._onDown,true);global.removeEventListener("pointermove",this._onMove,true);
      global.removeEventListener("pointerup",this._onUp,true);global.removeEventListener("pointercancel",this._onUp,true);
    }
    _consume(ev){try{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();}catch(_){}}

    _onDown(ev){
      if(!this.active)return;this._consume(ev);this.pointer.down=true;this.pointer.id=ev.pointerId;this._movePointer(ev.clientX,ev.clientY);
      const hit=this._hitTarget(ev.clientX,ev.clientY);
      if(this.armed&&hit){
        this.holdStartedAt=nowMs();this.holdTargetId=this._targetId();this._showHold(0);
        this._haptic("HEARTBEAT",0.5);this._speech("hold_start","Don't let go.",true,"LOW_URGENT");
        this._emit("hold_start",{moment:"FLASHLIGHT_HUNT",targetId:this.holdTargetId,x:ev.clientX,y:ev.clientY,special:true});
        this.holdRaf=requestAnimationFrame(this._tickHold);
      }else this._checkDiscovery();
    }
    _onMove(ev){if(!this.active)return;this._consume(ev);this._movePointer(ev.clientX,ev.clientY);if(!this.holdStartedAt)this._checkDiscovery();}
    _onUp(ev){
      if(!this.active)return;this._consume(ev);this._movePointer(ev.clientX,ev.clientY);this.pointer.down=false;this.pointer.id=null;
      if(this.holdStartedAt){
        const held=nowMs()-this.holdStartedAt;if(this.holdRaf){cancelAnimationFrame(this.holdRaf);this.holdRaf=0;}
        this._showHold(0,false);this.holdStartedAt=0;
        if(held<this.holdMs){
          this._haptic("WRONG",0.45);this._speech("release_early","Nope. Too soon.",true,"SNAP");
          this._emit("release_early",{moment:"FLASHLIGHT_HUNT",targetId:this.holdTargetId,durationMs:Math.round(held),special:true});
        }
        this.holdTargetId=null;
      }else this._emit("release",{moment:"FLASHLIGHT_HUNT",x:ev.clientX,y:ev.clientY});
    }
    _movePointer(x,y){
      const nx=clamp(Number(x)||0,0,global.innerWidth||360),ny=clamp(Number(y)||0,0,global.innerHeight||640);
      const moved=distance(this.pointer,{x:nx,y:ny});this.pointer.x=nx;this.pointer.y=ny;
      if(moved>2){this.lastMoveAt=nowMs();this.idleStage=0;}
      this._renderSpotlight(this.radius);if(this.ring){this.ring.style.left=nx+"px";this.ring.style.top=ny+"px";}
    }
    _renderSpotlight(radius){
      if(!this.overlay)return;const r=Math.max(34,Number(radius)||this.radius),feather=Math.round(r*.34),x=Math.round(this.pointer.x),y=Math.round(this.pointer.y);
      this.overlay.style.background=`radial-gradient(circle ${r+feather}px at ${x}px ${y}px, rgba(0,0,0,0) 0px, rgba(0,0,0,0) ${r}px, rgba(0,0,0,${Math.min(.82,this.darkness*.72)}) ${r+Math.round(feather*.55)}px, rgba(0,0,0,${this.darkness}) ${r+feather}px)`;
    }
    _checkDiscovery(){
      if(!this.active||this.holdStartedAt)return;const p=this._targetPoint();if(!p)return;const d=distance(this.pointer,p);if(d>this.radius*.7)return;
      const now=nowMs();if(now-this.lastEscapeAt<720)return;
      if(this.foundCount<this.escapeCount){
        this.foundCount++;this.lastEscapeAt=now;this._haptic("SOFT_TAP",0.34);
        this._emit("flashlight_found",{moment:"FLASHLIGHT_HUNT",escapeIndex:this.foundCount,special:true});
        this._speech("escape",this.foundCount===1?"Almost.":"Fine. One more chance.",true,this.foundCount===1?"TEASE":"FAKE_CALM");
        this._relocateTarget(false);
        if(this.foundCount>=this.escapeCount){this.armed=true;if(this.caption)this.caption.textContent="FOUND IT · HOLD";}
      }else if(!this.armed){this.armed=true;if(this.caption)this.caption.textContent="FOUND IT · HOLD";}
    }
    _tickHold(){
      if(!this.active||!this.holdStartedAt)return;const elapsed=nowMs()-this.holdStartedAt,progress=clamp(elapsed/this.holdMs,0,1);
      this._showHold(progress,true);if(progress>=1){this._complete();return;}
      if(progress>0.45&&progress<0.52)this._haptic("HEARTBEAT",0.34);
      this.holdRaf=requestAnimationFrame(this._tickHold);
    }
    _showHold(progress,visible){
      if(!this.ring)return;this.ring.style.opacity=visible===false?"0":"1";this.ring.style.transform=`scale(${0.70+clamp(progress,0,1)*0.5})`;
      this.ring.style.borderColor=`rgba(255,255,255,${0.42+clamp(progress,0,1)*0.58})`;this.ring.style.boxShadow=`0 0 ${20+Math.round(progress*60)}px rgba(255,255,255,${0.2+progress*.5})`;
    }
    _tickIdle(){
      if(!this.active||this.holdStartedAt)return;const idle=nowMs()-this.lastMoveAt;
      if(this.idleStage===0&&idle>=3000){this.idleStage=1;this._speech("idle","You stopped. Nervous?",false,"WHISPER");this._emit("idle_wait",{moment:"FLASHLIGHT_HUNT",idleMs:Math.round(idle),special:true});}
      else if(this.idleStage===1&&idle>=5600){this.idleStage=2;this._speech("idle_hint","Fine. Bigger light. Briefly.",false,"DRY");this._emit("idle_hint",{moment:"FLASHLIGHT_HUNT",idleMs:Math.round(idle),special:true});this._renderSpotlight(this.maxRadius);global.setTimeout(()=>{if(this.active)this._renderSpotlight(this.radius);},1700);}
    }
    _complete(){
      if(!this.active)return;this.holdStartedAt=0;if(this.holdRaf){cancelAnimationFrame(this.holdRaf);this.holdRaf=0;}
      this._showHold(1,true);this._haptic("CORRECT",0.82);this._emit("hold_complete",{moment:"FLASHLIGHT_HUNT",targetId:this.holdTargetId,durationMs:this.holdMs,special:true,correct:true});
      this._speech("complete","Okay. You got me.",true,"RELUCTANT_WIN");if(this.caption)this.caption.textContent="CAUGHT";if(this.overlay)this.overlay.style.opacity="0";
      global.setTimeout(()=>this.stop("complete"),540);
    }
    _targetPoint(){
      const t=this.getPrimaryTarget();if(!t)return null;try{if(typeof t.getGlobalPosition==="function"){const p=t.getGlobalPosition();if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))return{x:p.x,y:p.y};}if(typeof t.getBounds==="function"){const b=t.getBounds();if(b&&Number.isFinite(b.x))return{x:b.x+b.width/2,y:b.y+b.height/2};}}catch(_){}
      return Number.isFinite(t.x)&&Number.isFinite(t.y)?{x:t.x,y:t.y}:null;
    }
    _targetBounds(){const t=this.getPrimaryTarget();if(!t)return null;try{if(typeof t.getBounds==="function"){const b=t.getBounds();if(b)return{x:b.x,y:b.y,width:b.width,height:b.height};}}catch(_){}const p=this._targetPoint();if(!p)return null;return{x:p.x-34,y:p.y-34,width:68,height:68};}
    _hitTarget(x,y){const b=this._targetBounds();if(!b)return false;const pad=18;return x>=b.x-pad&&x<=b.x+b.width+pad&&y>=b.y-pad&&y<=b.y+b.height+pad;}
    _relocateTarget(initial){
      const t=this.getPrimaryTarget();if(!t)return;const w=global.innerWidth||360,h=global.innerHeight||640;let p;
      if(global.GameSafeArea&&typeof global.GameSafeArea.randomPoint==="function")p=global.GameSafeArea.randomPoint(w,h,42,this.rng);else p={x:70+this.rng()*Math.max(1,w-140),y:110+this.rng()*Math.max(1,h-220)};
      if(!initial){const old=this._targetPoint();if(old&&distance(old,p)<120){p.x=clamp(w-p.x,60,w-60);p.y=clamp(h-p.y,100,h-100);}}
      try{if(t.position&&typeof t.position.set==="function")t.position.set(p.x,p.y);else{t.x=p.x;t.y=p.y;}}catch(_){t.x=p.x;t.y=p.y;}
    }
    _targetId(){const t=this.getPrimaryTarget();return t&&(t.id||t.name||t.targetId)||"primary";}
    _emit(type,extra){try{this.onGameEvent(Object.assign({type},extra||{}));}catch(_){} }
    _speech(phase,fallback,immediate,delivery){try{this.onSpeechRequest({moment:"FLASHLIGHT_HUNT",phase,fallback,delivery:delivery||"TEASE",immediate:!!immediate,event:{type:"signature_speech",phase}});}catch(_){} }
    _haptic(cue,intensity){try{if(this.haptics&&typeof this.haptics.perform==="function")this.haptics.perform(cue,intensity);}catch(_){} }
  }

  class ScreenShatterMoment {
    constructor(options){
      const o=options||{};
      this.getGameCanvas=typeof o.getGameCanvas==="function"?o.getGameCanvas:()=>global.document&&global.document.querySelector("canvas");
      this.getPixiApp=typeof o.getPixiApp==="function"?o.getPixiApp:()=>global.PixiGameDebug&&global.PixiGameDebug.app;
      this.onGameEvent=typeof o.onGameEvent==="function"?o.onGameEvent:()=>{};
      this.onSpeechRequest=typeof o.onSpeechRequest==="function"?o.onSpeechRequest:()=>{};
      this.haptics=o.haptics||global.GameHaptics||null;
      this.active=false;this.root=null;this.canvas=null;this.ctx=null;this.snapshot=null;this.raf=0;this.startAt=0;this.phase="SHATTER";
      this.waitUntil=0;this.waitDurationMs=Math.max(900,Number(o.waitDurationMs)||1450);this.pieces=[];this.label=null;this.sub=null;
      this._onTouch=this._onTouch.bind(this);this._tick=this._tick.bind(this);
    }

    start(){
      if(this.active||!global.document)return false;console.log("runScreenShatterDemo called");const source=this.getGameCanvas();if(!source||typeof source.getBoundingClientRect!=="function")return this._fail("No game canvas");
      this.active=true;this.source=source;this._mount();if(!this._capture()){this.active=false;return false;}this._buildPieces();this._installInput();this.startAt=nowMs();
      this._haptic("IMPACT",0.92);this._speech("break","Oh. You broke it.",true,"SHOCKED_THEN_AMUSED");
      this._emit("signature_start",{moment:"SCREEN_SHATTER"});this.raf=requestAnimationFrame(this._tick);return true;
    }

    stop(reason){
      if(!this.active)return;this.active=false;if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this._removeInput();
      if(this.source)this.source.style.visibility="visible";
      if(this.root&&this.root.parentNode)this.root.parentNode.removeChild(this.root);this.root=this.canvas=this.ctx=this.snapshot=this.label=this.sub=null;
      this._emit("signature_stop",{moment:"SCREEN_SHATTER",reason:reason||"cancelled"});
    }

    _mount(){
      const root=global.document.createElement("div");Object.assign(root.style,{position:"fixed",inset:"0",zIndex:"2147483100",background:"#030303",overflow:"hidden",pointerEvents:"none"});
      const c=global.document.createElement("canvas");Object.assign(c.style,{position:"absolute",inset:"0",width:"100%",height:"100%"});
      const label=global.document.createElement("div");Object.assign(label.style,{position:"absolute",left:"50%",top:"47%",transform:"translate(-50%,-50%)",font:"900 clamp(34px,10vw,72px)/.92 system-ui,sans-serif",letterSpacing:"-.05em",textAlign:"center",color:"#fff",opacity:"0",textShadow:"0 4px 30px rgba(0,0,0,.8)",transition:"opacity 120ms linear",whiteSpace:"nowrap"});label.textContent="YOU BROKE IT.";
      const sub=global.document.createElement("div");Object.assign(sub.style,{position:"absolute",left:"50%",top:"58%",transform:"translateX(-50%)",font:"800 12px/1 system-ui,sans-serif",letterSpacing:".18em",color:"rgba(255,255,255,.76)",opacity:"0",transition:"opacity 120ms linear",whiteSpace:"nowrap"});sub.textContent="DON'T TOUCH ANYTHING";
      root.appendChild(c);root.appendChild(label);root.appendChild(sub);(global.document.body||global.document.documentElement).appendChild(root);
      this.root=root;this.canvas=c;this.label=label;this.sub=sub;this._resizeCanvas();this.ctx=c.getContext("2d");console.log("signature moment start");
    }
    _resizeCanvas(){const dpr=Math.max(1,Math.min(3,global.devicePixelRatio||1)),w=global.innerWidth||360,h=global.innerHeight||640;this.dpr=dpr;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}
    _capture(){
      console.log("capture canvas start");const dpr=this.dpr,w=global.innerWidth||360,h=global.innerHeight||640;try{const app=this.getPixiApp();if(!app||!app.renderer||!app.stage)throw new Error("Pixi app/stage unavailable");const extracted=app.renderer.extract&&app.renderer.extract.canvas(app.stage);if(!extracted||!extracted.width||!extracted.height)throw new Error("Pixi extract returned empty canvas");const snap=global.document.createElement("canvas");snap.width=Math.round(w*dpr);snap.height=Math.round(h*dpr);snap.getContext("2d").drawImage(extracted,0,0,extracted.width,extracted.height,0,0,snap.width,snap.height);console.log("captured texture width/height",extracted.width,extracted.height);this.snapshot=snap;if(this.source)this.source.style.visibility="hidden";return true;}catch(e){return this._fail(String(e&&e.stack||e));}
    }
    _buildPieces(){
      const cols=4,rows=4,w=(global.innerWidth||360)/cols,h=(global.innerHeight||640)/rows;this.pieces=[];
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const cx=x*w+w/2,cy=y*h+h/2,dx=(cx-(global.innerWidth||360)/2),dy=(cy-(global.innerHeight||640)/2),len=Math.max(1,Math.sqrt(dx*dx+dy*dy));
        this.pieces.push({sx:x*w,sy:y*h,w,h,cx,cy,vx:(dx/len)*(70+Math.random()*150)+(Math.random()-.5)*70,vy:(dy/len)*(55+Math.random()*120)-40-Math.random()*90,rot:(Math.random()-.5)*1.8});
      }
      console.log("16 shards created");
    }
    _installInput(){global.addEventListener("pointerdown",this._onTouch,true);console.log("shard container added to stage");console.log("animation started");}
    _removeInput(){global.removeEventListener("pointerdown",this._onTouch,true);}
    _onTouch(ev){
      if(!this.active||this.phase!=="WAIT")return;try{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();}catch(_){}
      this.waitUntil=nowMs()+this.waitDurationMs;this._haptic("WRONG",0.52);this._speech("touched","I said don't touch it.",true,"SHARP_PLAYFUL");this._emit("wait_broken",{moment:"SCREEN_SHATTER",special:true});
      if(this.sub){this.sub.textContent="SERIOUSLY. DON'T TOUCH.";this.sub.style.opacity="1";}
    }
    _tick(){
      if(!this.active)return;const now=nowMs(),elapsed=now-this.startAt;
      if(this.phase==="SHATTER"){
        this._drawShatter(clamp(elapsed/900,0,1));if(elapsed>170)this.label.style.opacity="1";
        if(elapsed>=950){this.phase="WAIT";this.waitUntil=now+this.waitDurationMs;this.label.style.opacity="0";this.sub.style.opacity="1";this._speech("wait","Don't touch anything.",true,"LOW_COMMAND");this._emit("wait_start",{moment:"SCREEN_SHATTER",special:true});}
      }else if(this.phase==="WAIT"){
        this._drawShatter(1);if(now>=this.waitUntil){this.phase="RESTORE";this.restoreAt=now;this.sub.textContent="GOOD.";this._haptic("SOFT_TAP",0.25);this._speech("wait_success","Good. Stay right there.",true,"CALM_APPROVAL");this._emit("wait_complete",{moment:"SCREEN_SHATTER",special:true,correct:true});}
      }else if(this.phase==="RESTORE"){
        const p=clamp((now-this.restoreAt)/780,0,1);this._drawShatter(1-p);if(p>=1){this.sub.style.opacity="0";this._speech("restore","We're pretending that never happened.",true,"DEADPAN");global.setTimeout(()=>this.stop("complete"),320);return;}
      }
      this.raf=requestAnimationFrame(this._tick);
    }
    _drawShatter(progress){
      if(!this.ctx||!this.snapshot)return;const ctx=this.ctx,dpr=this.dpr,w=global.innerWidth||360,h=global.innerHeight||640;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.canvas.width,this.canvas.height);ctx.fillStyle="#030303";ctx.fillRect(0,0,this.canvas.width,this.canvas.height);ctx.setTransform(dpr,0,0,dpr,0,0);
      for(const p of this.pieces){
        const t=progress,ease=1-Math.pow(1-t,2.6),tx=p.vx*ease,ty=p.vy*ease+190*ease*ease,rot=p.rot*ease,alpha=1-clamp((t-.72)/.28,0,.7);
        ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.cx+tx,p.cy+ty);ctx.rotate(rot);ctx.drawImage(this.snapshot,p.sx*dpr,p.sy*dpr,p.w*dpr,p.h*dpr,-p.w/2,-p.h/2,p.w,p.h);ctx.restore();
      }
    }
    _fail(message){console.error("SHATTER CAPTURE FAILED",message);if(this.root&&this.root.parentNode)this.root.parentNode.removeChild(this.root);const f=global.document&&global.document.getElementById("fatal");if(f){f.style.display="grid";f.style.color="#ff334f";f.textContent="SHATTER CAPTURE FAILED\n"+message;}try{this.onGameEvent({type:"shatter_capture_failed",error:String(message)});}catch(_){}return false;}
    _emit(type,extra){try{this.onGameEvent(Object.assign({type},extra||{}));}catch(_){} }
    _speech(phase,fallback,immediate,delivery){try{this.onSpeechRequest({moment:"SCREEN_SHATTER",phase,fallback,delivery:delivery||"DRAMATIC",immediate:!!immediate,event:{type:"signature_speech",phase}});}catch(_){} }
    _haptic(cue,intensity){try{if(this.haptics&&typeof this.haptics.perform==="function")this.haptics.perform(cue,intensity);}catch(_){} }
  }

  class SignatureMomentRuntime {
    constructor(options){this.options=options||{};this.current=null;this.currentId="NONE";}
    start(id,override){
      const moment=String(id||"NONE");if(moment==="NONE")return false;this.stop("replaced");const opts=Object.assign({},this.options,override||{});
      if(moment==="FLASHLIGHT_HUNT")this.current=new FlashlightHuntMoment(opts);
      else if(moment==="SCREEN_SHATTER")this.current=new ScreenShatterMoment(opts);
      else return false;
      this.currentId=moment;const ok=this.current.start();if(!ok){this.current=null;this.currentId="NONE";}return ok;
    }
    stop(reason){if(this.current&&typeof this.current.stop==="function")this.current.stop(reason||"cancelled");this.current=null;this.currentId="NONE";}
    isActive(){return !!(this.current&&this.current.active);}
  }

  global.FlashlightHuntMoment=FlashlightHuntMoment;
  global.ScreenShatterMoment=ScreenShatterMoment;
  global.SignatureMomentRuntime=SignatureMomentRuntime;
})(window);
