(function (global) {
  "use strict";

  const DENSITY = { CALM:0, LIGHT:1, ACTIVE:2, IMPACT:3 };
  const DENSITY_NAME = ["CALM","LIGHT","ACTIVE","IMPACT"];
  const AMBIENT_TARGET = [2,8,18,34];
  const BURST_MULTIPLIER = [0.22,0.60,1.0,1.55];
  const CREATION_ACTION_BUDGET = [1,2,5,8];
  const RECOMMENDED_VISIBLE_INTERACTIVE = [2,6,14,26];

  const EFFECTS_BY_WORLD = {
    SPRING_BLOOM:["PETAL_BLOOM","ECHO_RINGS","SPOTLIGHT","SOFT_FADE"],
    SUMMER_STORM:["STORM_FLASH","SHOCKWAVE","RAIN_BURST","ECHO_RINGS"],
    AUTUMN_DECAY:["LEAF_FALL","DUST_DISSOLVE","SOFT_FADE","ECHO_RINGS"],
    WINTER_FROST:["FREEZE_CRACK","FROST_PULSE","SPOTLIGHT","SOFT_FADE"],
    VOID_CHAMBER:["VOID_SUCTION","BLACKOUT_REVEAL","GRAVITY_WELL","MIRROR_SPLIT"],
    NEON_RIFT:["GLITCH_BARS","NEON_SLICE","PIXEL_SCATTER","MIRROR_SPLIT"]
  };

  const HAPTIC_BY_WORLD = {
    SPRING_BLOOM:"SOFT_TAP",
    SUMMER_STORM:"THUNDER",
    AUTUMN_DECAY:"DRY_DOUBLE",
    WINTER_FROST:"ICE_TICK",
    VOID_CHAMBER:"VOID_PULL",
    NEON_RIFT:"DIGITAL_TRIPLE"
  };

  function clamp(v,min,max,fallback) {
    const n=Number(v);
    return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
  }

  function nowMs() {
    return global.performance && typeof global.performance.now === "function"
      ? global.performance.now() : Date.now();
  }

  class SensoryDirector {
    constructor(options) {
      const o=options||{};
      this.rng=typeof o.rng==="function"?o.rng:Math.random;
      this.now=typeof o.now==="function"?o.now:nowMs;
      this.impactCooldownMs=Number(o.impactCooldownMs)||9000;
      this.recoveryMs=Number(o.recoveryMs)||2600;
      this.lastImpactAt=-Infinity;
      this.recoveryUntil=0;
      this.recentDensity=[];
      this.recentEffects=[];
      this.lastState=this._state(0,"SOFT_FADE","NONE",0,0,0);
      this.lastTapHapticAt=-Infinity;
    }

    resolve(plan) {
      const p=plan||{};
      const now=this.now();
      let requested=this._requestedDensity(p);

      // Recovery after a climax is mandatory. The game must become sparse again.
      if (now < this.recoveryUntil) requested=Math.min(requested,DENSITY.LIGHT);

      // Never allow repeated climaxes. Downgrade to ACTIVE if impact is still cooling down.
      if (requested===DENSITY.IMPACT && now-this.lastImpactAt<this.impactCooldownMs) {
        requested=DENSITY.ACTIVE;
      }

      // If the last few situations were already dense, force breathing room.
      const denseCount=this.recentDensity.slice(-3).filter(v=>v>=DENSITY.ACTIVE).length;
      if (denseCount>=2 && requested>=DENSITY.ACTIVE) requested=DENSITY.LIGHT;

      // WAIT/HIDE should usually feel sparse even when the AI asks for intensity.
      if ((p.situation==="WAIT"||p.situation==="HIDE") && requested>DENSITY.LIGHT && clamp(p.surpriseLevel,0,1,0)<0.9) {
        requested=DENSITY.LIGHT;
      }

      if (requested===DENSITY.IMPACT) {
        this.lastImpactAt=now;
        this.recoveryUntil=now+this.recoveryMs;
      }

      const visualEffect=this._pickVisualEffect(p.world,p.visualEffect,p.situation,requested);
      const hapticCue=this._pickPlanHaptic(p,requested);

      let motion=requested;
      let audio=requested;
      let haptic=requested===0?0:Math.min(requested,2);
      let brightness=requested;

      if (p.situation==="WAIT") { motion=Math.min(motion,1); audio=Math.min(audio,1); }
      if (p.situation==="HIDE") { brightness=Math.max(0,brightness-1); }

      // Sensory budget: when visuals are maxed, audio/haptics cannot also stay maxed.
      if (requested===DENSITY.IMPACT) {
        audio=Math.min(audio,2);
        haptic=Math.min(haptic,2);
      }
      if (motion===3) audio=Math.min(audio,2);

      const state=this._state(requested,visualEffect,hapticCue,motion,audio,brightness);
      this._rememberDensity(requested);
      this._rememberEffect(visualEffect);
      this.lastState=state;
      return state;
    }

    feedbackForPlayerEvent(event,plan) {
      const state=this.lastState||this._state(0,"SOFT_FADE","NONE",0,0,0);
      const now=this.now();
      const e=event||{};
      const world=(plan&&plan.world)||"NEON_RIFT";

      // Haptics are intentionally absent on many taps so tactile contrast remains meaningful.
      const chance=[0.08,0.42,0.62,0.30][state.density]||0.2;
      const cooldown=state.density>=2?180:280;
      if (now-this.lastTapHapticAt<cooldown || this.rng()>chance) {
        return { hapticCue:"NONE", intensity:0, burstScale:state.burstMultiplier*0.75 };
      }
      this.lastTapHapticAt=now;

      let cue="SOFT_TAP";
      if (e.type==="timeout") cue="WARNING";
      else if (e.correct===true) cue="CORRECT";
      else if (e.correct===false) cue="WRONG";
      else if (state.density>=2) cue=HAPTIC_BY_WORLD[world]||"SOFT_TAP";

      return {
        hapticCue:cue,
        intensity:state.density===0?0.15:(state.density===1?0.28:0.45),
        burstScale:state.burstMultiplier
      };
    }

    contextForAi() {
      const now=this.now();
      return {
        currentDensity:this.lastState.density,
        currentDensityName:this.lastState.densityName,
        impactAvailable:now-this.lastImpactAt>=this.impactCooldownMs && now>=this.recoveryUntil,
        recoveryActive:now<this.recoveryUntil,
        recentDensity:this.recentDensity.slice(-4).map(v=>DENSITY_NAME[v]),
        recentVisualEffects:this.recentEffects.slice(-3),
        recommendedMaxVisibleInteractive:this.lastState.recommendedMaxVisibleInteractive,
        creationActionBudget:this.lastState.creationActionBudget,
        instruction:"Contrast matters more than constant spectacle. Prefer CALM/LIGHT after dense moments. IMPACT is rare."
      };
    }

    _requestedDensity(plan) {
      if (Number.isFinite(Number(plan.sensoryDensity))) {
        return Math.round(clamp(plan.sensoryDensity,0,3,1));
      }
      const surprise=clamp(plan.surpriseLevel,0,1,0.3);
      const intensity=clamp(plan.intensity,0,1,0.45);
      if (surprise>=0.88 && intensity>=0.65) return DENSITY.IMPACT;
      if (surprise>=0.55 || intensity>=0.64) return DENSITY.ACTIVE;
      if (surprise<=0.2 && intensity<=0.4) return DENSITY.CALM;
      return DENSITY.LIGHT;
    }

    _pickVisualEffect(world,requested,situation,density) {
      const pool=(EFFECTS_BY_WORLD[world]||EFFECTS_BY_WORLD.NEON_RIFT).slice();
      if (requested && requested!=="AUTO" && pool.includes(requested) && !this.recentEffects.slice(-2).includes(requested)) return requested;
      if (situation==="MIRROR" && !this.recentEffects.slice(-2).includes("MIRROR_SPLIT")) return "MIRROR_SPLIT";
      if (situation==="REVEAL" && density<=1 && !this.recentEffects.slice(-2).includes("SPOTLIGHT")) return "SPOTLIGHT";
      let candidates=pool.filter(x=>!this.recentEffects.slice(-2).includes(x));
      if (!candidates.length) candidates=pool;
      return candidates[Math.floor(this.rng()*candidates.length)]||"SOFT_FADE";
    }

    _pickPlanHaptic(plan,density) {
      if (density===0) return "NONE";
      if (plan.hapticCue && plan.hapticCue!=="AUTO" && plan.hapticCue!=="IMPACT") return plan.hapticCue;
      if (density===3) return "IMPACT";
      if (plan.situation==="PREDICT") return "HEARTBEAT";
      if (plan.situation==="FAKE_ENDING") return "WARNING";
      return density>=2?(HAPTIC_BY_WORLD[plan.world]||"SOFT_TAP"):"NONE";
    }

    _state(density,visualEffect,hapticCue,motion,audio,brightness) {
      return {
        density,
        densityName:DENSITY_NAME[density]||"CALM",
        ambientTarget:AMBIENT_TARGET[density],
        burstMultiplier:BURST_MULTIPLIER[density],
        motion:clamp(motion,0,3,0),
        audio:clamp(audio,0,3,0),
        haptic:Math.min(3,Math.max(0,density===0?0:(density>=3?2:density))),
        brightness:clamp(brightness,0,3,0),
        visualEffect,
        hapticCue,
        creationActionBudget:CREATION_ACTION_BUDGET[density],
        recommendedMaxVisibleInteractive:RECOMMENDED_VISIBLE_INTERACTIVE[density]
      };
    }

    _rememberDensity(v) { this.recentDensity.push(v); if (this.recentDensity.length>8) this.recentDensity.shift(); }
    _rememberEffect(v) { if (!v) return; this.recentEffects.push(v); if (this.recentEffects.length>6) this.recentEffects.shift(); }
  }

  SensoryDirector.DENSITY=DENSITY;
  global.SensoryDirector=SensoryDirector;
})(window);
