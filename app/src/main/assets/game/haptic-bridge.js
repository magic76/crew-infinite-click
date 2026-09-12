(function (global) {
  "use strict";

  const fallbackPatterns={
    SOFT_TAP:[10], CORRECT:[18,45,32], WRONG:[42], WARNING:[16,38,16,38,16],
    ICE_TICK:[12], DRY_DOUBLE:[16,28,22], DIGITAL_TRIPLE:[11,18,11,18,20],
    THUNDER:[22,55,72], VOID_PULL:[38,28,68], HEARTBEAT:[28,85,34], IMPACT:[90]
  };

  class HapticBridge {
    constructor() { this.enabled=true; this.lastAt=0; }
    perform(cue,intensity) {
      if (!this.enabled || !cue || cue==="NONE") return false;
      const now=Date.now();
      if (now-this.lastAt<90) return false;
      this.lastAt=now;
      const i=Math.max(0.05,Math.min(1,Number(intensity)||0.35));
      try {
        if (global.AndroidHaptics && typeof global.AndroidHaptics.perform==="function") {
          global.AndroidHaptics.perform(String(cue),i);
          return true;
        }
      } catch (_) {}
      try {
        if (global.navigator && typeof global.navigator.vibrate==="function") {
          const pattern=(fallbackPatterns[cue]||fallbackPatterns.SOFT_TAP).map((v,idx)=>idx%2===0?Math.max(1,Math.round(v*(0.65+i*0.7))):v);
          return !!global.navigator.vibrate(pattern);
        }
      } catch (_) {}
      return false;
    }
  }

  global.GameHaptics=new HapticBridge();
  global.HapticBridge=HapticBridge;
})(window);
