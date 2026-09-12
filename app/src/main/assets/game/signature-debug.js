(function(global){
  "use strict";
  global.runFlashlightHuntDemo=function(signatureRuntime){
    if(!signatureRuntime||typeof signatureRuntime.start!=="function")throw new Error("SignatureMomentRuntime instance required");
    return signatureRuntime.start("FLASHLIGHT_HUNT",{holdMs:1250,escapeCount:2,radius:74,darkness:.992});
  };
  global.runScreenShatterDemo=function(signatureRuntime){
    if(!signatureRuntime){
      if(!global.SignatureMomentRuntime)throw new Error("SignatureMomentRuntime unavailable");
      signatureRuntime=new global.SignatureMomentRuntime({getPixiApp:()=>global.PixiGameDebug&&global.PixiGameDebug.app,getGameCanvas:()=>global.PixiGameDebug&&global.PixiGameDebug.canvas});
    }
    if(typeof signatureRuntime.start!=="function")throw new Error("SignatureMomentRuntime instance required");
    return signatureRuntime.start("SCREEN_SHATTER",{waitDurationMs:10000});
  };
})(window);
