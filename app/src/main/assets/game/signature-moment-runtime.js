(function(global){
  "use strict";
  // Signature moments are retired. No input interception, overlays, or micro-games remain.
  class SignatureMomentRuntime {
    constructor(){this.current=null;this.currentId="NONE";}
    isActive(){return false;}
    start(){return false;}
    stop(){this.current=null;this.currentId="NONE";}
  }
  global.SignatureMomentRuntime=SignatureMomentRuntime;
})(window);
