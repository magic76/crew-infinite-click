(function (global) {
  "use strict";

  function now(){return global.performance&&performance.now?performance.now():Date.now();}
  function dist(a,b){const dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);}

  /**
   * Host-side executable primitive adapter. This owns gesture/camera/spatial state.
   * Surface rendering (FRAGMENT/LIQUID) is delegated because it depends on the app's Pixi version/render pipeline.
   */
  class PrimitiveHostRuntime {
    constructor(options){
      const o=options||{};
      this.gameplayContainer=o.gameplayContainer||null;
      this.getPrimaryTarget=typeof o.getPrimaryTarget==="function"?o.getPrimaryTarget:()=>null;
      this.onGameEvent=typeof o.onGameEvent==="function"?o.onGameEvent:()=>{};
      this.onSurfaceMode=typeof o.onSurfaceMode==="function"?o.onSurfaceMode:()=>{};
      this.interaction="TAP"; this.spatial="NONE"; this.camera="STATIC"; this.surface="NONE"; this.timing="SNAP";
      this.pointer=null; this.velocity={x:0,y:0}; this.orbitPhase=0; this.holdTimer=null;
      this.viewport=typeof o.getViewport==="function"?o.getViewport:()=>({width:global.innerWidth||360,height:global.innerHeight||640});
    }

    setInteraction(mode){this.interaction=mode||"TAP"; this._clearHold();}
    setSpatial(mode){this.spatial=mode||"NONE"; this.velocity={x:0,y:0};}
    setCamera(mode){this.camera=mode||"STATIC"; this._applyCameraImmediate();}
    setSurface(mode){this.surface=mode||"NONE"; this.onSurfaceMode(this.surface);}
    setTiming(mode){this.timing=mode||"SNAP";}

    pointerDown(x,y,targetId){
      const t={x,y,targetId:targetId||null,downAt:now(),last:{x,y},moved:0}; this.pointer=t;
      if(this.interaction==="HOLD"){
        this._clearHold();
        this.holdTimer=setTimeout(()=>{
          if(this.pointer===t&&t.moved<18) this.onGameEvent({type:"hold",targetId:t.targetId,x:t.x,y:t.y,durationMs:now()-t.downAt,special:true});
        },480);
      }
      return this.interaction!=="WAIT";
    }

    pointerMove(x,y){
      const p=this.pointer;if(!p)return null;
      const cur={x,y}; p.moved+=dist(p.last,cur);p.last=cur;
      if(this.interaction==="DRAG"){
        const e={type:"drag",targetId:p.targetId,x,y,dx:x-p.x,dy:y-p.y,special:true};this.onGameEvent(e);return e;
      }
      return null;
    }

    pointerUp(x,y){
      const p=this.pointer;if(!p)return null;this._clearHold();this.pointer=null;
      const duration=now()-p.downAt, travel=dist({x:p.x,y:p.y},{x,y});
      if(this.interaction==="SLICE"&&travel>=72&&duration<=700){
        const e={type:"slice",targetId:p.targetId,x1:p.x,y1:p.y,x2:x,y2:y,distance:travel,durationMs:duration,special:true};this.onGameEvent(e);return e;
      }
      if(this.interaction==="TAP"&&travel<18){
        const e={type:"tap",targetId:p.targetId,x,y};this.onGameEvent(e);return e;
      }
      return null;
    }

    tick(deltaMs){
      const target=this.getPrimaryTarget(); if(!target)return;
      const dt=Math.min(0.05,Math.max(0.001,(Number(deltaMs)||16)/1000));
      const v=this.viewport();
      if(this.spatial==="GRAVITY_DOWN"){
        this.velocity.y+=720*dt; target.y+=this.velocity.y*dt;
        if(target.y>v.height-40){target.y=v.height-40;this.velocity.y*=-0.48;}
      } else if(this.spatial==="GRAVITY_SIDE"){
        this.velocity.x+=620*dt; target.x+=this.velocity.x*dt;
        if(target.x>v.width-40){target.x=v.width-40;this.velocity.x*=-0.52;}
      } else if(this.spatial==="ORBIT"){
        this.orbitPhase+=dt*1.6; const cx=v.width/2,cy=v.height/2;
        target.x=cx+Math.cos(this.orbitPhase)*Math.min(120,v.width*.28);
        target.y=cy+Math.sin(this.orbitPhase)*Math.min(150,v.height*.22);
      } else if(this.spatial==="PUSH_AWAY"&&this.pointer){
        const dx=target.x-this.pointer.last.x,dy=target.y-this.pointer.last.y,d=Math.max(20,Math.sqrt(dx*dx+dy*dy));
        if(d<150){target.x+=dx/d*180*dt;target.y+=dy/d*180*dt;}
      }
      this._tickCamera(target,v,dt);
    }

    _applyCameraImmediate(){
      const c=this.gameplayContainer;if(!c)return;
      if(this.camera==="STATIC"){if(c.scale&&c.scale.set)c.scale.set(1);c.x=0;c.y=0;}
      else if(this.camera==="ZOOM_IN"){if(c.scale&&c.scale.set)c.scale.set(1.35);}
      else if(this.camera==="ZOOM_OUT"){if(c.scale&&c.scale.set)c.scale.set(0.78);}
      else if(this.camera==="PAN"){c.x=26;c.y=-18;}
    }

    _tickCamera(target,v,dt){
      const c=this.gameplayContainer;if(!c||this.camera!=="FOLLOW")return;
      const desiredX=v.width/2-target.x, desiredY=v.height/2-target.y;
      c.x+=(desiredX-c.x)*Math.min(1,dt*4.5);c.y+=(desiredY-c.y)*Math.min(1,dt*4.5);
    }

    _clearHold(){if(this.holdTimer){clearTimeout(this.holdTimer);this.holdTimer=null;}}
  }

  global.PrimitiveHostRuntime=PrimitiveHostRuntime;
})(window);
