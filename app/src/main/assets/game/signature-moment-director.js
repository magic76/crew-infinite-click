(function(global){
  "use strict";
  function nowMs(){return global.performance&&performance.now?performance.now():Date.now();}
  class SignatureMomentDirector {
    constructor(options){
      const o=options||{};
      this.now=typeof o.now==="function"?o.now:nowMs;this.rng=typeof o.rng==="function"?o.rng:Math.random;
      this.firstEventMin=Math.max(2,Number(o.firstEventMin)||5);
      this.cooldownEvents=Math.max(5,Number(o.cooldownEvents)||11);
      this.cooldownMs=Math.max(10000,Number(o.cooldownMs)||26000);
      this.eventCount=0;this.lastSignatureAt=-Infinity;this.lastSignatureEvent=-Infinity;
      this.nextSignatureEvent=this.firstEventMin;this.history=[];
    }
    onPlayerEvent(event,context){
      const e=event||{};if(!this._counts(e))return null;this.eventCount++;
      if(context&&context.signatureActive)return null;
      const now=this.now();
      if(this.eventCount<this.nextSignatureEvent)return null;
      if(now-this.lastSignatureAt<this.cooldownMs&&this.lastSignatureEvent>-Infinity)return null;
      const id=this._pickNext();
      this.lastSignatureAt=now;this.lastSignatureEvent=this.eventCount;
      this.nextSignatureEvent=this.eventCount+this.cooldownEvents+Math.floor(this.rng()*4);
      this.history.push(id);if(this.history.length>4)this.history.shift();
      return{id,reason:this.lastSignatureEvent===this.firstEventMin?"first_signature_guarantee":"signature_cadence"};
    }
    recordStarted(id){if(id&&this.history[this.history.length-1]!==id){this.history.push(id);if(this.history.length>4)this.history.shift();}}
    _pickNext(){
      // SCREEN_SHATTER is intentionally retired: it interrupted flow and felt like a stall.
      return "FLASHLIGHT_HUNT";
    }
    _counts(e){const t=String(e.type||"").toUpperCase();return["TAP","DRAG_END","RELEASE_EARLY","HOLD_COMPLETE","WAIT_BROKEN","WAIT_SUCCESS","SLICE"].includes(t)||e.special===true;}
  }
  global.SignatureMomentDirector=SignatureMomentDirector;
})(window);
