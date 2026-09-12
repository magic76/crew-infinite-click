(function (global) {
  "use strict";

  function nowMs(){return global.performance&&performance.now?performance.now():Date.now();}
  function areaFor(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y))return "UNKNOWN";
    const horizontal=x<0.34?"LEFT":(x>0.66?"RIGHT":"CENTER");
    const vertical=y<0.34?"TOP":(y>0.66?"BOTTOM":"MIDDLE");
    if(horizontal==="CENTER")return vertical;
    if(vertical==="MIDDLE")return horizontal;
    return vertical+"_"+horizontal;
  }

  class GeminiEventAggregator {
    constructor(options){
      const o=options||{};
      this.windowMs=Math.max(200,Number(o.windowMs)||500);
      this.now=typeof o.now==="function"?o.now:nowMs;
      this.onFlush=typeof o.onFlush==="function"?o.onFlush:()=>{};
      this.timer=0;this.events=[];this.directive=null;this.context=null;this.firstAt=0;this.lastAt=0;
      this.flushCount=0;
    }
    push(event,directive,context,options){
      const e=event||{},d=directive||{},o=options||{},now=this.now();
      if(d.mode==="SILENT")return false;
      if(!this.events.length)this.firstAt=now;
      this.lastAt=now;this.events.push(Object.assign({},e,{_at:now}));
      // GAME_TURN outranks BANTER; the latest context wins within the same local burst.
      if(!this.directive||d.mode==="GAME_TURN"||this.directive.mode!=="GAME_TURN"){this.directive=d;this.context=context||{};}
      if(this.timer)global.clearTimeout(this.timer);
      if(o.immediate===true){this.flush();return true;}
      this.timer=global.setTimeout(()=>this.flush(),this.windowMs);
      return true;
    }
    flush(){
      if(this.timer){global.clearTimeout(this.timer);this.timer=0;}
      if(!this.events.length||!this.directive)return null;
      const events=this.events.splice(0),directive=this.directive,context=this.context||{};
      this.directive=null;this.context=null;
      const summary=this._summarize(events);
      this.flushCount++;
      const payload={mode:directive.mode,reason:directive.reason||"aggregated",delivery:directive.delivery||"TEASE",instruction:directive.instruction||"",context,behavior:summary};
      this.onFlush(payload);
      return payload;
    }
    cancel(){if(this.timer)global.clearTimeout(this.timer);this.timer=0;this.events.length=0;this.directive=null;this.context=null;}
    pendingCount(){return this.events.length;}
    _summarize(events){
      const taps=events.filter(e=>e.type==="TAP");
      const xs=taps.map(e=>Number(e.x)).filter(Number.isFinite),ys=taps.map(e=>Number(e.y)).filter(Number.isFinite);
      const avgX=xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:NaN,avgY=ys.length?ys.reduce((a,b)=>a+b,0)/ys.length:NaN;
      const types={};for(const e of events)types[e.type]=(types[e.type]||0)+1;
      const durationMs=Math.max(0,Math.round((events[events.length-1]._at||this.lastAt)-(events[0]._at||this.firstAt)));
      const rapid=taps.length>=4&&durationMs<=700;
      let behavior=rapid?"rapid_tapping":(events.length>1?"mixed_interaction":String(events[events.length-1].type||"interaction").toLowerCase());
      if(types.HOLD_COMPLETE)behavior="hold_success";
      else if(types.RELEASE_EARLY)behavior="hold_failed";
      else if(types.WAIT_BROKEN)behavior="warning_ignored";
      else if(types.WAIT_SUCCESS)behavior="wait_success";
      else if(types.IDLE_STAGE||types.IDLE_START)behavior="idle";
      return {
        behavior,
        eventCount:events.length,
        tapCount:taps.length,
        durationMs,
        dominantArea:areaFor(avgX,avgY),
        rageClick:rapid,
        eventTypes:types
      };
    }
  }

  global.GeminiEventAggregator=GeminiEventAggregator;
})(window);
