(function(global){
  "use strict";
  if(!global.__INFINITE_CLICK_DEBUG__)return;
  global.runFlashlightHuntDemo=function(signatureRuntime){
    if(!signatureRuntime||typeof signatureRuntime.start!=="function")throw new Error("SignatureMomentRuntime instance required");
    return signatureRuntime.start("FLASHLIGHT_HUNT",{holdMs:1250,radius:74});
  };
  global.runScreenShatterDemo=function(signatureRuntime){
    if(!signatureRuntime&&global.PixiGameDebug&&global.PixiGameDebug.signature)signatureRuntime=global.PixiGameDebug.signature();
    if(!signatureRuntime||typeof signatureRuntime.start!=="function")throw new Error("SignatureMomentRuntime instance required");
    return false; // SCREEN_SHATTER retired: intentionally unavailable even in debug.
  };
})(window);
