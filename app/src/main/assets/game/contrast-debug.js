(function (global) {
  "use strict";
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

  /**
   * Debug only. Do not load in release builds.
   * Lets QA verify that 0/1/2/3 are visibly different without waiting for AI pacing.
   */
  global.runSensoryContrastDemo=async function(experience) {
    if (!experience||!experience.fx) throw new Error("runSensoryContrastDemo requires ExperienceRuntime with fx");
    const fx=experience.fx;
    const world=(experience.currentPlan&&experience.currentPlan.world)||"NEON_RIFT";
    const center=experience.getPrimaryTarget?experience.getPrimaryTarget():null;
    const x=center&&Number.isFinite(center.x)?center.x:(global.innerWidth||360)/2;
    const y=center&&Number.isFinite(center.y)?center.y:(global.innerHeight||720)/2;
    const states=[
      {density:0,densityName:"QUIET",ambientTarget:0,burstMultiplier:0,motion:0,audio:0,haptic:0,brightness:0,visualEffect:"NONE"},
      {density:1,densityName:"NORMAL",ambientTarget:4,burstMultiplier:0.38,motion:1,audio:1,haptic:1,brightness:1,visualEffect:"ECHO_RINGS"},
      {density:2,densityName:"BUSY",ambientTarget:26,burstMultiplier:1.45,motion:2,audio:2,haptic:2,brightness:2,visualEffect:"GLITCH_BARS"},
      {density:3,densityName:"CHAOS",ambientTarget:42,burstMultiplier:2.35,motion:3,audio:2,haptic:2,brightness:3,visualEffect:"SHOCKWAVE"}
    ];
    for (const state of states) {
      console.info("[0.34 contrast demo]",state.densityName,state);
      fx.setWorld(world,0.5);
      fx.setSensoryState(state);
      if (state.density===1) fx.playEffect("ECHO_RINGS",x,y,0.5,state);
      if (state.density===2) { fx.playEffect("GLITCH_BARS",x,y,0.9,state); fx.burst(x,y,12,1.0); }
      if (state.density===3) { fx.playEffect("SHOCKWAVE",x,y,1.0,state); fx.crowdBurst(x,y,1.0); }
      await sleep(1800);
    }
    fx.setSensoryState(states[0]);
    console.info("[0.34 contrast demo] done -> QUIET");
  };
})(window);
