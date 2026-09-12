(function (global) {
  "use strict";

  class ExperienceRuntime {
    constructor(options) {
      const o=options||{};
      this.gameRuntime=o.gameRuntime||null;
      this.director=o.director||new global.ExperienceDirector({profileAccessor:o.profileAccessor});
      this.sensory=o.sensory||new global.SensoryDirector();
      this.conversation=o.conversation||new global.ConversationDirector({profileAccessor:o.profileAccessor});
      this.composer=o.composer||new global.ExperienceComposer();
      this.primitives=o.primitives||new global.InteractionPrimitives({
        fx:o.fx||null,
        getPrimaryTarget:typeof o.getPrimaryTarget==="function"?o.getPrimaryTarget:()=>null,
        onInteraction:o.onPrimitiveInteraction,
        onSpatial:o.onPrimitiveSpatial,
        onCamera:o.onPrimitiveCamera,
        onSurface:o.onPrimitiveSurface,
        onTiming:o.onPrimitiveTiming
      });
      this.fx=o.fx||null;
      this.audio=o.audio||null;
      this.haptics=o.haptics||global.GameHaptics||null;
      this.getPrimaryTarget=typeof o.getPrimaryTarget==="function"?o.getPrimaryTarget:()=>null;
      this.onRuleTwist=typeof o.onRuleTwist==="function"?o.onRuleTwist:()=>{};
      this.onSpeech=typeof o.onSpeech==="function"?o.onSpeech:()=>{};
      this.onInteractionDirective=typeof o.onInteractionDirective==="function"?o.onInteractionDirective:()=>{};
      this.signatureMoments=o.signatureMoments||null;
      this.signatureDirector=o.signatureDirector||((global.SignatureMomentDirector)?new global.SignatureMomentDirector({}):null);
      this.currentPlan=null;
      this.currentSensoryState=this.sensory.resolve({world:"NEON_RIFT",situation:"WAIT",intensity:0.12,surpriseLevel:0.06,sensoryDensity:0});
      this.currentSituationStartedAt=0;
      // 0.34 shortens the old 10-30s lock. Speech can happen between game turns.
      this.currentSituationMinMs=6500;
      this.currentSituationMaxMs=18000;
    }

    startSession(preferredWorld) {
      const world=this.director.startSession(preferredWorld);
      if (this.fx) {
        this.fx.setWorld(world,0.18);
        this.fx.setSensoryState(this.currentSensoryState);
      }
      if (this.audio&&typeof this.audio.setSensoryState==="function") this.audio.setSensoryState(this.currentSensoryState);
      return world;
    }

    /**
     * Immediate local feedback + routing decision.
     * Return value contains `interaction.mode`: SILENT | BANTER | GAME_TURN.
     * Caller should NOT contact Gemini for SILENT.
     */
    onPlayerEvent(event) {
      const e=event||{};

      // 0.37: signature moments cannot remain optional demo content. The local
      // cadence guarantees an early, visibly different scene and then spaces
      // later signatures far apart. This decision is local and deterministic;
      // it does not create another model loop.
      const alreadySignatureActive=!!(this.signatureMoments&&this.signatureMoments.isActive&&this.signatureMoments.isActive());
      if(!alreadySignatureActive&&this.signatureDirector&&this.signatureMoments&&typeof this.signatureDirector.onPlayerEvent==="function") {
        const forced=this.signatureDirector.onPlayerEvent(e,{signatureActive:false,currentPlan:this.currentPlan});
        if(forced&&forced.id&&this.signatureMoments.start(forced.id,{reason:forced.reason})) {
          if(typeof this.signatureDirector.recordStarted==="function") this.signatureDirector.recordStarted(forced.id);
          const interaction={mode:"SILENT",reason:"signature_started_locally",event:e,instruction:"Signature moment owns this turn.",delivery:"DRAMATIC"};
          const context=this.director.contextForAi(e,this._surpriseLevelForEvent(e));
          context.interaction=interaction;
          context.signature={id:forced.id,reason:forced.reason,started:true};
          context.conversation=this.conversation.contextForAi(interaction,e);
          context.sensory=this.sensory.contextForAi();
          context.composition=this.composer.contextForAi();
          this.onInteractionDirective(interaction,context);
          return context;
        }
      }

      const feedback=this.sensory.feedbackForPlayerEvent(e,this.currentPlan);
      if (this.haptics&&feedback.hapticCue!=="NONE") this.haptics.perform(feedback.hapticCue,feedback.intensity);

      if (this.audio) {
        const mood=this.currentPlan?this.currentPlan.audioMood:"GLITCH";
        this.audio.play(mood,"click",0.12+feedback.intensity*0.28);
      }

      if (this.fx&&feedback.burstScale>0&&Number.isFinite(e.x)&&Number.isFinite(e.y)) {
        const count=Math.max(1,Math.round(6*feedback.burstScale));
        this.fx.burst(e.x,e.y,count,0.38+feedback.burstScale*0.38);
      }

      const surprise=this._surpriseLevelForEvent(e);
      const signatureActive=!!(this.signatureMoments&&this.signatureMoments.isActive&&this.signatureMoments.isActive());
      const shouldNew=signatureActive?false:this.shouldRequestNewSituation();
      const interaction=this.conversation.routePlayerEvent(e,{shouldRequestNewSituation:shouldNew,currentPlan:this.currentPlan,sensory:this.currentSensoryState});
      const context=this.director.contextForAi(e,surprise);
      context.interaction=interaction;
      context.conversation=this.conversation.contextForAi(interaction,e);
      context.sensory=this.sensory.contextForAi();
      context.composition=this.composer.contextForAi();
      this.onInteractionDirective(interaction,context);
      return context;
    }

    /** Poll from a cheap local timer, e.g. every 500ms. Returns null or a BANTER context. */
    pollIdle(gameSnapshot) {
      // A signature moment owns its own idle beats; avoid duplicate global idle banter.
      if(this.signatureMoments&&this.signatureMoments.isActive&&this.signatureMoments.isActive()) return null;
      const interaction=this.conversation.pollIdle({currentPlan:this.currentPlan,sensory:this.currentSensoryState});
      if (!interaction) return null;
      const event=interaction.event||{type:"idle"};
      const context=this.aiContext(event,gameSnapshot||{});
      context.interaction=interaction;
      context.conversation=this.conversation.contextForAi(interaction,event);
      this.onInteractionDirective(interaction,context);
      return context;
    }

    recordSpokenLine(text) {
      this.conversation.recordSpeech(text);
    }

    applyAiPlan(rawPlan) {
      const previousWorld=this.currentPlan&&this.currentPlan.world;
      const plan=this.director.sanitizePlan(rawPlan);
      const sensoryState=this.sensory.resolve(plan);
      const composition=this.composer.compose(plan.composition||{}, {world:plan.world,density:sensoryState.density,experienceIntent:plan.experienceIntent});
      plan.composition=composition;
      this.currentPlan=plan;
      this.currentSensoryState=sensoryState;
      this.currentSituationStartedAt=performance.now();
      const target=this.getPrimaryTarget();

      let signatureStarted=false;
      if (this.signatureMoments&&plan.signatureMoment&&plan.signatureMoment!=="NONE") {
        signatureStarted=!!this.signatureMoments.start(plan.signatureMoment,{plan});
        if (signatureStarted) {
          if(this.signatureDirector&&typeof this.signatureDirector.recordStarted==="function") this.signatureDirector.recordStarted(plan.signatureMoment);
          // A signature moment is a finished micro-game. It temporarily owns input and staging.
          // Do not stack ordinary primitives, VFX, rule twists or UI actions on top of it.
          composition.interaction="WAIT";
          composition.spatial="NONE";
          composition.reveal="NONE";
          composition.camera="STATIC";
          composition.surface="NONE";
          composition.timing="TENSION";
        }
      }

      if (!signatureStarted && this.primitives&&typeof this.primitives.apply==="function") {
        this.primitives.apply(composition,plan);
      }

      if (this.fx) {
        this.fx.setSensoryState(sensoryState);
        if(!signatureStarted) this.fx.applyPlan(plan,target,sensoryState);
      }

      if (this.audio) {
        if (typeof this.audio.setSensoryState==="function") this.audio.setSensoryState(sensoryState);
        if(!signatureStarted){
          const cue=previousWorld&&previousWorld!==plan.world?"worldChange":(plan.situation==="REVEAL"?"reveal":((plan.situation==="DECOY"||plan.situation==="FAKE_ENDING")?"trap":"click"));
          this.audio.play(plan.audioMood,cue,Math.min(1,plan.intensity*(0.48+sensoryState.audio*0.19)));
        }
      }

      if (!signatureStarted && this.haptics&&sensoryState.hapticCue!=="NONE") {
        const hapticIntensity=sensoryState.density===3?0.82:(sensoryState.density===2?0.52:0.24);
        this.haptics.perform(sensoryState.hapticCue,hapticIntensity);
      }

      if(!signatureStarted) this.onRuleTwist(plan.ruleTwist,plan);
      if (!signatureStarted && plan.speech) {
        this.onSpeech(plan.speech,plan);
        this.conversation.recordSpeech(plan.speech);
      }

      let applied=[], rejected=[];
      const sensoryLimitedActions=signatureStarted?{allowed:[],rejected:Array.isArray(plan.actions)?plan.actions.slice():[]}:this._limitActionsForSensory(plan.actions,sensoryState);
      rejected=rejected.concat(sensoryLimitedActions.rejected);
      if (!signatureStarted && this.gameRuntime&&typeof this.gameRuntime.applyActions==="function") {
        const result=this.gameRuntime.applyActions(sensoryLimitedActions.allowed)||{};
        applied=result.applied||[];
        rejected=rejected.concat(result.rejected||[]);
      } else if (!signatureStarted && this.gameRuntime&&typeof this.gameRuntime.applyAction==="function") {
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
        creationActionBudget:sensoryState.creationActionBudget,
        experienceIntent:plan.experienceIntent,
        composition:composition,
        signatureMoment:plan.signatureMoment||"NONE",
        signatureStarted:signatureStarted,
        noveltyScore:composition.noveltyScore
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
      return Math.random()<0.06+t*0.18;
    }

    aiContext(event,gameSnapshot) {
      const ctx=this.director.contextForAi(event||{},this._surpriseLevelForEvent(event));
      ctx.game=gameSnapshot||{};
      ctx.sensory=this.sensory.contextForAi();
      ctx.composition=this.composer.contextForAi();
      ctx.instruction=[
        "Keep the current world coherent for several situations.",
        "Do not repeat either of the last two situations unless surpriseLevel >= 0.9.",
        "Make only small validated UI actions.",
        "Visual contrast must be obvious: QUIET is almost empty, NORMAL is restrained, BUSY is clearly crowded/moving, CHAOS is a rare short punch.",
        "After CHAOS, drop hard to QUIET instead of staying medium-busy.",
        "Speech is personality, not narration: tease, observe, predict, question, or fake-reassure. Never describe the visual effect literally.",
        "Choose an experienceIntent and composition. Build one coherent event by combining interaction + spatial + reveal + camera + surface + timing; do not turn every dimension on.",
        "Signature moments are finished scenes. The local runtime already guarantees occasional signatures, so Gemini should usually use NONE. If explicitly chosen: FLASHLIGHT_HUNT is search/hold; SCREEN_SHATTER is a dramatic stop-and-wait beat. Never repeat them back-to-back.",
        "Player input includes stopping, holding, releasing, dragging and slicing. Treat inactivity and release timing as meaningful behavior, not missing input.",
        "Novelty comes from changing meaningful dimensions, not renaming the same particle effect. Prefer at least two meaningful dimension changes from recent compositions.",
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
      const cycle=totalClicks%13;
      if (cycle===0&&totalClicks>0) return 0.86+Math.random()*0.12;
      if (cycle>=8) return 0.46+Math.random()*0.16;
      return 0.12+Math.random()*0.18;
    }
  }

  global.ExperienceRuntime=ExperienceRuntime;
})(window);
