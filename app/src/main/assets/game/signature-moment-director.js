(function(global){
  "use strict";

  function nowMs(){return global.performance&&performance.now?performance.now():Date.now();}

  class SignatureMomentDirector {
    constructor(options){
      const o=options||{};
      this.now=typeof o.now==="function"?o.now:nowMs;
      this.rng=typeof o.rng==="function"?o.rng:Math.random;
      this.firstEventMin=Math.max(2,Number(o.firstEventMin)||4);
      this.cooldownEvents=Math.max(4,Number(o.cooldownEvents)||9);
      this.cooldownMs=Math.max(8000,Number(o.cooldownMs)||22000);
      this.eventCount=0;
      this.lastSignatureAt=-Infinity;
      this.lastSignatureEvent=-Infinity;
      this.nextSignatureEvent=this.firstEventMin;
      this.history=[];
    }

    onPlayerEvent(event,context){
      const e=event||{};
      if(!this._counts(e)) return null;
      this.eventCount++;
      if(context&&context.signatureActive) return null;
      const now=this.now();
      if(this.eventCount<this.nextSignatureEvent) return null;
      if(now-this.lastSignatureAt<this.cooldownMs && this.lastSignatureEvent>-Infinity) return null;
      const id=this._pickNext();
      this.lastSignatureAt=now;
      this.lastSignatureEvent=this.eventCount;
      this.nextSignatureEvent=this.eventCount+this.cooldownEvents+Math.floor(this.rng()*3);
      this.history.push(id);
      if(this.history.length>4)this.history.shift();
      return {id,reason:this.lastSignatureEvent===this.firstEventMin?"first_signature_guarantee":"signature_cadence"};
    }

    recordStarted(id){
      if(!id)return;
      if(this.history[this.history.length-1]!==id){
        this.history.push(id);
        if(this.history.length>4)this.history.shift();
      }
    }

    _pickNext(){
      const last=this.history[this.history.length-1];
      if(!last) return "SCREEN_SHATTER"; // first encounter must look dramatically different.
      return last==="SCREEN_SHATTER"?"FLASHLIGHT_HUNT":"SCREEN_SHATTER";
    }

    _counts(e){
      return ["click","tap","drag","release","release_early","hold_complete","wait_broken"].includes(e.type) || e.special===true;
    }
  }

  global.SignatureMomentDirector=SignatureMomentDirector;
})(window);
