(function(global){
  "use strict";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>global.performance&&performance.now?performance.now():Date.now();

  class PrimitiveHostRuntime {
    constructor(options){
      const o=options||{};
      this.world=o.world||o.gameplayContainer||null;
      this.getPrimaryTarget=typeof o.getPrimaryTarget==="function"?o.getPrimaryTarget:()=>null;
      this.onGameEvent=typeof o.onGameEvent==="function"?o.onGameEvent:()=>{};
      this.onSurfaceMode=typeof o.onSurfaceMode==="function"?o.onSurfaceMode:()=>{};
      this.interaction="TAP";this.spatial="NONE";this.camera="STATIC";this.surface="NONE";this.timing="SNAP";
      this.pointer=null;this.holdThresholdMs=Math.max(280,Number(o.holdThresholdMs)||620);
      this.holdProgressEveryMs=Math.max(80,Number(o.holdProgressEveryMs)||120);
      this.waitSuccessMs=Math.max(650,Number(o.waitSuccessMs)||1350);
      this.lastMoveEmitAt=0;this.lastHoldProgressAt=0;this.waitArmedAt=0;this.waitResolved=false;
      this.orbitAngle=0;
    }

    setInteraction(mode){
      this.interaction=String(mode||"TAP").toUpperCase();
      this.pointer=null;this.lastMoveEmitAt=0;this.lastHoldProgressAt=0;
      this.waitResolved=false;this.waitArmedAt=this.interaction==="WAIT"?now():0;
    }
    setSpatial(mode){this.spatial=String(mode||"NONE").toUpperCase();}
    setCamera(mode){this.camera=String(mode||"STATIC").toUpperCase();}
    setSurface(mode){this.surface=String(mode||"NONE").toUpperCase();this.onSurfaceMode(this.surface);}
    setTiming(mode){this.timing=String(mode||"SNAP").toUpperCase();}

    pointerDown(x,y){
      const t=now();this.pointer={x0:x,y0:y,x,y,startedAt:t,moved:false,holdComplete:false};
      if(this.interaction==="WAIT"){
        this.waitArmedAt=t;this.waitResolved=false;
        this._emit("WAIT_BROKEN",{x,y,special:true,ignoredWarning:true});
        return;
      }
      if(this.interaction==="HOLD"){
        this.lastHoldProgressAt=t;
        this._emit("HOLD_START",{x,y,progress:0,special:true});
      } else if(this.interaction==="DRAG") {
        this._emit("DRAG_START",{x,y,special:true});
      }
    }

    pointerMove(x,y){
      const p=this.pointer;if(!p)return;
      const t=now(),dx=x-p.x0,dy=y-p.y0;
      p.x=x;p.y=y;if(Math.hypot(dx,dy)>8)p.moved=true;
      if(this.interaction==="DRAG"&&t-this.lastMoveEmitAt>=16){
        this.lastMoveEmitAt=t;
        this._emit("DRAG_MOVE",{x,y,dx,dy,durationMs:t-p.startedAt});
      }
    }

    pointerUp(x,y){
      const p=this.pointer;this.pointer=null;if(!p)return;
      const t=now(),duration=t-p.startedAt,dx=x-p.x0,dy=y-p.y0;
      if(this.interaction==="HOLD"){
        if(p.holdComplete)this._emit("RELEASE",{x,y,durationMs:duration,afterHold:true,special:true});
        else this._emit("RELEASE_EARLY",{x,y,durationMs:duration,progress:clamp(duration/this.holdThresholdMs,0,1),correct:false,special:true});
        return;
      }
      if(this.interaction==="DRAG"){
        this._emit("DRAG_END",{x,y,dx,dy,durationMs:duration,special:true});
        return;
      }
      if(this.interaction==="SLICE"){
        if(Math.hypot(dx,dy)>34)this._emit("SLICE",{x,y,dx,dy,durationMs:duration,special:true});
        else this._emit("RELEASE",{x,y,durationMs:duration});
        return;
      }
      if(this.interaction==="WAIT")return;
      this._emit("TAP",{x,y,durationMs:duration});
      this._emit("RELEASE",{x,y,durationMs:duration});
    }

    cancelPointer(){
      const p=this.pointer;this.pointer=null;
      if(!p)return;
      if(this.interaction==="HOLD"&&!p.holdComplete)this._emit("RELEASE_EARLY",{x:p.x,y:p.y,durationMs:now()-p.startedAt,cancelled:true,correct:false,special:true});
      else if(this.interaction==="DRAG")this._emit("DRAG_END",{x:p.x,y:p.y,cancelled:true,special:true});
    }

    tick(deltaMs){
      const dt=Math.max(0,Math.min(50,Number(deltaMs)||16));
      const t=now(),p=this.pointer;
      if(this.interaction==="HOLD"&&p&&!p.holdComplete){
        const elapsed=t-p.startedAt,progress=clamp(elapsed/this.holdThresholdMs,0,1);
        if(t-this.lastHoldProgressAt>=this.holdProgressEveryMs){
          this.lastHoldProgressAt=t;
          this._emit("HOLD_PROGRESS",{x:p.x,y:p.y,progress,durationMs:elapsed});
        }
        if(progress>=1){
          p.holdComplete=true;
          this._emit("HOLD_COMPLETE",{x:p.x,y:p.y,durationMs:elapsed,progress:1,correct:true,special:true});
        }
      }
      if(this.interaction==="WAIT"&&!this.waitResolved&&this.waitArmedAt&&t-this.waitArmedAt>=this.waitSuccessMs){
        this.waitResolved=true;
        this._emit("WAIT_SUCCESS",{durationMs:t-this.waitArmedAt,correct:true,special:true});
      }

      const target=this.getPrimaryTarget(),world=this.world;
      if(target){
        const scale=dt/16.6667;
        if(this.spatial==="GRAVITY_DOWN")target.y+=0.35*scale;
        else if(this.spatial==="GRAVITY_SIDE")target.x+=0.35*scale;
        else if(this.spatial==="ORBIT"){
          const w=global.innerWidth||360,h=global.innerHeight||640;this.orbitAngle+=0.018*scale;
          target.x=w/2+Math.cos(this.orbitAngle)*Math.min(90,w*.22);
          target.y=h/2+Math.sin(this.orbitAngle)*Math.min(130,h*.18);
        } else if(this.spatial==="PUSH_AWAY"&&p){
          const dx=target.x-p.x,dy=target.y-p.y,d=Math.max(1,Math.hypot(dx,dy));
          if(d<150){target.x+=dx/d*1.3*scale;target.y+=dy/d*1.3*scale;}
        }
      }
      if(world){
        if(this.camera==="FOLLOW"&&target){world.pivot.set(target.x,target.y);world.position.set((global.innerWidth||360)/2,(global.innerHeight||640)/2);}
        else if(this.camera==="ZOOM_IN"){world.scale.x+=(1.06-world.scale.x)*.08;world.scale.y=world.scale.x;}
        else if(this.camera==="ZOOM_OUT"){world.scale.x+=(.94-world.scale.x)*.08;world.scale.y=world.scale.x;}
        else {world.scale.x+=(1-world.scale.x)*.09;world.scale.y=world.scale.x;if(this.camera==="STATIC"){world.pivot.set(0,0);world.position.set(0,0);}}
      }
    }

    _emit(type,extra){try{this.onGameEvent(Object.assign({type},extra||{}));}catch(_){}}
  }

  global.PrimitiveHostRuntime=PrimitiveHostRuntime;
})(window);
