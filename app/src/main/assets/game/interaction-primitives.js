(function (global) {
  "use strict";

  function noop(){}
  class InteractionPrimitives {
    constructor(options){
      const o=options||{}; this.fx=o.fx||null;
      this.onInteraction=typeof o.onInteraction==="function"?o.onInteraction:noop;
      this.onSpatial=typeof o.onSpatial==="function"?o.onSpatial:noop;
      this.onCamera=typeof o.onCamera==="function"?o.onCamera:noop;
      this.onSurface=typeof o.onSurface==="function"?o.onSurface:noop;
      this.onTiming=typeof o.onTiming==="function"?o.onTiming:noop;
      this.getPrimaryTarget=typeof o.getPrimaryTarget==="function"?o.getPrimaryTarget:()=>null;
    }

    apply(composition,plan){
      const c=composition||{}, p=plan||{}, target=this.getPrimaryTarget();
      this.onInteraction(c.interaction,{target,plan:p});
      this.onSpatial(c.spatial,{target,plan:p});
      this.onCamera(c.camera,{target,plan:p});
      this.onSurface(c.surface,{target,plan:p});
      this.onTiming(c.timing,{target,plan:p});
      this._renderReveal(c.reveal,target,p);
      return {ok:true,composition:c};
    }

    _renderReveal(reveal,target,plan){
      if(!this.fx||reveal==="NONE")return;
      const x=target&&Number.isFinite(target.x)?target.x:((global.innerWidth||360)/2);
      const y=target&&Number.isFinite(target.y)?target.y:((global.innerHeight||640)/2);
      if(reveal==="SPOTLIGHT"&&typeof this.fx.spotlight==="function")this.fx.spotlight(x,y,1.15);
      else if(reveal==="BLACKOUT"&&typeof this.fx.blackoutReveal==="function")this.fx.blackoutReveal(x,y,1.2);
      else if(reveal==="FOG_REVEAL"){
        if(typeof this.fx.fogReveal==="function")this.fx.fogReveal(x,y,1.1);
        else if(typeof this.fx.softFade==="function")this.fx.softFade(1.25);
      }
    }
  }

  /*
   * Adapter contract for the host game:
   * onInteraction(HOLD|DRAG|SLICE|WAIT|TAP): install/remove pointer gesture handlers.
   * onSpatial(GRAVITY_*|ORBIT|PUSH_AWAY): change target physics, not just particles.
   * onCamera(ZOOM_IN|ZOOM_OUT|FOLLOW|PAN): transform the gameplay world container.
   * onSurface(FRAGMENT|TRAIL|LIQUID): switch rendering behavior/material.
   * onTiming(TENSION|DELAYED|REVERSAL|SNAP): choose sequencing, including delayed punchlines/reversal.
   */
  global.InteractionPrimitives=InteractionPrimitives;
})(window);
