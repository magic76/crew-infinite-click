(function(global){
  "use strict";
  global.runFlashlightHuntDemo=function(signatureRuntime){
    if(!signatureRuntime||typeof signatureRuntime.start!=="function")throw new Error("SignatureMomentRuntime instance required");
    return signatureRuntime.start("FLASHLIGHT_HUNT",{holdMs:1250,escapeCount:2,radius:74,darkness:.992});
  };
  global.runScreenShatterDemo=function(signatureRuntime){
    if(!signatureRuntime||typeof signatureRuntime.start!=="function")throw new Error("SignatureMomentRuntime instance required");
    return signatureRuntime.start("SCREEN_SHATTER",{waitDurationMs:1450});
  };
})(window);
