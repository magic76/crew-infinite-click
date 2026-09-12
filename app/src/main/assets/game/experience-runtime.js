(function (global) {
  "use strict";

  class ExperienceRuntime {
    constructor(options) {
      const o=options||{};
      this.gameRuntime=o.gameRuntime||null;
      this.director=o.director||new global.ExperienceDirector({profileAccessor:o.profileAccessor});
      this.sensory=o.sensory||new global.SensoryDirector();
      this.fx=o.fx||null;
      this.audio=o.audio||null;
      this.haptics=o.haptics||global.GameHaptics||null;
      this.getPrimaryTarget=typeof o.getPrimaryTarget==="function"?o.getPrimaryTarget:()=>null;
      this.onRuleTwist=typeof o.onRuleTwist==="function"?o.onRuleTwist:()=>{};
      this.onSpeech=typeof o.onSpeech==="function"?o.onSpeech:()=>{};
      this.currentPlan=null;
      this.currentSensoryState=this.sensory.resolve({world:"NEON_RIFT",situation:"WAIT",intensity:0.18,surpriseLevel:0.08,sensoryDensity:0});
      this.currentSituationStartedAt=0;
      this.currentSituationMinMs=10000;
      this.currentSituationMaxMs=30000;
    }

    startSession(preferredWorld) {
      const world=this.director.startSession(preferredWorld);
      if (this.fx) {
        this.fx.setWorld(world,0.22);
        this.fx.setSensoryState(this.currentSensoryState);
      }
      if (this.audio&&typeof this.audio.setSensoryState==="function") this.audio.setSensoryState(this.currentSensoryState);
      return world;
    }

    onPlayerEvent(event) {
      const feedback=this.sensory.feedbackForPlayerEvent(event,this.currentPlan);
      if (this.haptics && feedback.hapticCue!=="NONE") this.haptics.perform(feedback.hapticCue,feedback.intensity);

      if (this.audio) {
        const mood=this.currentPlan?this.currentPlan.audioMood:"GLITCH";
        this.audio.play(mood,"click",0.18+feedback.intensity*0.3);
      }

      if (this.fx && event && Number.isFinite(event.x) && Number.isFinite(event.y)) {
        const count=Math.max(2,Math.round(5*feedback.burstScale));
        this.fx.burst(event.x,event.y,count,0.45+feedback.burstScale*0.35);
      }
      return this.director.contextForAi(event||{},this._surpriseLevelForEvent(event));
    }

    applyAiPlan(rawPlan) {
      const previousWorld=this.currentPlan&&this.currentPlan.world;
      const plan=this.director.sanitizePlan(rawPlan);
      const sensoryState=this.sensory.resolve(plan);
      this.currentPlan=plan;
      this.currentSensoryState=sensoryState;
      this.currentSituationStartedAt=performance.now();
      const target=this.getPrimaryTarget();

      if (this.fx) {
        this.fx.setSensoryState(sensoryState);
        this.fx.applyPlan(plan,target,sensoryState);
      }

      if (this.audio) {
        if (typeof this.audio.setSensoryState==="function") this.audio.setSensoryState(sensoryState);
        const cue=previousWorld&&previousWorld!==plan.world?"worldChange":(plan.situation==="REVEAL"?"reveal":((plan.situation==="DECOY"||plan.situation==="FAKE_ENDING")?"trap":"click"));
        this.audio.play(plan.audioMood,cue,Math.min(1,plan.intensity*(0.55+sensoryState.audio*0.18)));
      }

      if (this.haptics && sensoryState.hapticCue!=="NONE") {
        const hapticIntensity=sensoryState.density===3?0.78:(sensoryState.density===2?0.52:0.28);
        this.haptics.perform(sensoryState.hapticCue,hapticIntensity);
      }

      this.onRuleTwist(plan.ruleTwist,plan);
      if (plan.speech) this.onSpeech(plan.speech,plan);

      let applied=[], rejected=[];
      const sensoryLimitedActions=this._limitActionsForSensory(plan.actions,sensoryState);
      rejected=rejected.concat(sensoryLimitedActions.rejected);
      if (this.gameRuntime && typeof this.gameRuntime.applyActions==="function") {
        const result=this.gameRuntime.applyActions(sensoryLimitedActions.allowed)||{};
        applied=result.applied||[]; rejected=result.rejected||[];
      } else if (this.gameRuntime && typeof this.gameRuntime.applyAction==="function") {
        for (const action of sensoryLimitedActions.allowed) {
          try { const ok=this.gameRuntime.applyAction(action); (ok?applied:rejected).push(action); }
          catch (_) { rejected.push(action); }
        }
      }

      return {
        ok:true,
        world:plan.world,
        situation:plan.situation,
        density:sensoryState.densityName,
        visualEffect:sensoryState.visualEffect,
        appliedCount:applied.length,
        rejectedCount:rejected.length,
        creationActionBudget:sensoryState.creationActionBudget
      };
    }

    fallback(event) {
      const plan=this.director.fallbackPlan(event||{},this._surpriseLevelForEvent(event));
      return this.applyAiPlan(plan);
    }

    shouldRequestNewSituation() {
      if (!this.currentPlan) return true;
      const elapsed=performance.now()-this.currentSituationStartedAt;
      if (elapsed<this.currentSituationMinMs) return false;
      if (elapsed>=this.currentSituationMaxMs) return true;
      const t=(elapsed-this.currentSituationMinMs)/(this.currentSituationMaxMs-this.currentSituationMinMs);
      return Math.random()<t*0.08;
    }

    aiContext(event,gameSnapshot) {
      const ctx=this.director.contextForAi(event||{},this._surpriseLevelForEvent(event));
      ctx.game=gameSnapshot||{};
      ctx.sensory=this.sensory.contextForAi();
      ctx.instruction=[
        "Keep the current world coherent for several situations.",
        "Do not repeat either of the last two situations unless surpriseLevel >= 0.9.",
        "Make only small incremental UI actions.",
        "Contrast matters more than spectacle: use CALM/LIGHT often, ACTIVE sometimes, IMPACT rarely.",
        "After an IMPACT, deliberately reduce visual/audio/haptic density.",
        "Background visuals may be full screen, but clickable targets must stay inside safe interactive bounds."
      ].join(" ");
      return ctx;
    }


    _limitActionsForSensory(actions,state) {
      const list=Array.isArray(actions)?actions:[];
      const budget=Math.max(1,Number(state&&state.creationActionBudget)||1);
      const createTypes=new Set(["createButton","createText","createImage","createInput","createSlider","duplicateElement"]);
      let created=0;
      const allowed=[], rejected=[];
      for (const action of list) {
        const type=action&&action.type;
        if (createTypes.has(type)) {
          if (created>=budget) { rejected.push(action); continue; }
          created+=1;
        }
        allowed.push(action);
      }
      return {allowed,rejected};
    }

    _surpriseLevelForEvent(event) {
      const totalClicks=Number(event&&(event.totalClicks||event.clickCount))||0;
      const cycle=totalClicks%11;
      if (cycle===0&&totalClicks>0) return 0.82+Math.random()*0.15;
      if (cycle>=6) return 0.42+Math.random()*0.16;
      return 0.14+Math.random()*0.16;
    }
  }

  global.ExperienceRuntime=ExperienceRuntime;
})(window);
