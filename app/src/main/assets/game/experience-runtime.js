(function (global) {
  "use strict";

  class ExperienceRuntime {
    constructor(options) {
      const o=options||{};
      this.director=o.director||new global.ExperienceDirector({profileAccessor:o.profileAccessor});
      this.sensory=o.sensory||new global.SensoryDirector();
      this.conversation=o.conversation||new global.ConversationDirector({profileAccessor:o.profileAccessor});
      this.composer=o.composer||new global.ExperienceComposer();
      this.fx=o.fx||null;this.audio=o.audio||null;this.haptics=o.haptics||global.GameHaptics||null;
      this.getPrimaryTarget=typeof o.getPrimaryTarget==="function"?o.getPrimaryTarget:()=>null;
      this.onRuleTwist=typeof o.onRuleTwist==="function"?o.onRuleTwist:()=>{};
      this.onSpeech=typeof o.onSpeech==="function"?o.onSpeech:()=>{};
      this.onInteractionDirective=typeof o.onInteractionDirective==="function"?o.onInteractionDirective:()=>{};
      this.signatureMoments=o.signatureMoments||null;
      this.signatureDirector=o.signatureDirector||((global.SignatureMomentDirector)?new global.SignatureMomentDirector({}):null);
      this.primitives=o.primitives||new global.InteractionPrimitives({
        fx:this.fx,getPrimaryTarget:this.getPrimaryTarget,
        onInteraction:o.onPrimitiveInteraction,onSpatial:o.onPrimitiveSpatial,onCamera:o.onPrimitiveCamera,
        onSurface:o.onPrimitiveSurface,onTiming:o.onPrimitiveTiming
      });
      this.currentPlan=null;
      this.currentSensoryState=this.sensory.resolve({world:"NEON_RIFT",situation:"WAIT",intensity:.12,surpriseLevel:.06,sensoryDensity:0});
      this.currentSituationStartedAt=0;this.currentSituationMinMs=6500;this.currentSituationMaxMs=18000;
      this.lastBehaviorAt=0;this.behaviorEnergy=0;
    }

    startSession(preferredWorld) {
      const world=this.director.startSession(preferredWorld);
      if(this.fx){this.fx.setWorld(world,.18);this.fx.setSensoryState(this.currentSensoryState);}
      if(this.audio&&this.audio.setSensoryState)this.audio.setSensoryState(this.currentSensoryState);
      return world;
    }

    onPlayerEvent(event) {
      const e=event||{},type=String(e.type||"").toUpperCase();
      this._recordBehavior(e);

      const signatureActive=this._signatureActive();
      if(!signatureActive&&this.signatureDirector&&this.signatureMoments){
        const forced=this.signatureDirector.onPlayerEvent(e,{signatureActive:false,currentPlan:this.currentPlan});
        if(forced&&forced.id&&this.signatureMoments.start(forced.id,{reason:forced.reason})){
          if(this.signatureDirector.recordStarted)this.signatureDirector.recordStarted(forced.id);
          const interaction={mode:"SILENT",reason:"signature_started_locally",event:e,instruction:"Signature moment owns the scene.",delivery:"DRAMATIC"};
          const context=this.aiContext(e,{});
          context.interaction=interaction;context.signature={id:forced.id,reason:forced.reason,started:true};
          this.onInteractionDirective(interaction,context);
          return context;
        }
      }

      // Signature moments own input and sensory staging. Their own runtime emits semantic events.
      if(this._signatureActive()){
        const interaction={mode:"SILENT",reason:"signature_exclusive",event:e,instruction:"Signature moment owns the scene.",delivery:"DRAMATIC"};
        const context=this.aiContext(e,{signatureActive:true});context.interaction=interaction;
        return context;
      }

      // Continuous gesture samples are first-class local events, but never expensive sensory/model turns.
      // PrimitiveHostRuntime already updates the actual gesture/camera state at frame rate.
      if(type==="HOLD_PROGRESS"||type==="DRAG_MOVE"){
        const interaction={mode:"SILENT",reason:"continuous_local_input",event:e,instruction:"Local runtime only.",delivery:"DRY"};
        const context=this.aiContext(e,{});context.interaction=interaction;
        return context;
      }

      const feedback=this.sensory.feedbackForPlayerEvent(e,this.currentPlan);
      // Pointer-down already gives the immediate tactile tap. Avoid a second haptic on TAP/RELEASE.
      if(this.haptics&&feedback.hapticCue!=="NONE"&&type!=="TAP"&&type!=="RELEASE")this.haptics.perform(feedback.hapticCue,feedback.intensity);
      if(this.audio){
        const mood=this.currentPlan?this.currentPlan.audioMood:"GLITCH";
        this.audio.play(mood,"click",.12+feedback.intensity*.28);
      }
      if(this.fx&&feedback.burstScale>0&&Number.isFinite(e.x)&&Number.isFinite(e.y)){
        const count=Math.max(0,Math.round(6*feedback.burstScale));
        if(count>0)this.fx.burst(e.x,e.y,count,.38+feedback.burstScale*.38);
      }

      const shouldNew=this.shouldRequestNewSituation();
      const interaction=this.conversation.routePlayerEvent(e,{shouldRequestNewSituation:shouldNew,currentPlan:this.currentPlan,sensory:this.currentSensoryState});
      const context=this.aiContext(e,{});
      context.interaction=interaction;context.conversation=this.conversation.contextForAi(interaction,e);
      this.onInteractionDirective(interaction,context);
      return context;
    }

    pollIdle(gameSnapshot) {
      if(this._signatureActive())return null;
      const interaction=this.conversation.pollIdle({currentPlan:this.currentPlan,sensory:this.currentSensoryState});
      if(!interaction)return null;
      const event=interaction.event||{type:"IDLE_START"};
      const context=this.aiContext(event,gameSnapshot||{});
      context.interaction=interaction;context.conversation=this.conversation.contextForAi(interaction,event);
      this.onInteractionDirective(interaction,context);
      return context;
    }

    recordSpokenLine(text){this.conversation.recordSpeech(text);}

    applyAiPlan(rawPlan) {
      if(this._signatureActive())return {ok:false,reason:"signature_active",signatureMoment:this.signatureMoments.currentId||"UNKNOWN"};
      const previousWorld=this.currentPlan&&this.currentPlan.world;
      const plan=this.director.sanitizePlan(rawPlan||{});
      const sensoryState=this.sensory.resolve(plan);
      const composition=this.composer.compose(plan.composition||{},{
        world:plan.world,density:sensoryState.density,experienceIntent:plan.experienceIntent
      });
      plan.composition=composition;
      this.currentPlan=plan;this.currentSensoryState=sensoryState;this.currentSituationStartedAt=performance.now();
      const target=this.getPrimaryTarget();

      let signatureStarted=false;
      if(this.signatureMoments&&plan.signatureMoment&&plan.signatureMoment!=="NONE"){
        signatureStarted=!!this.signatureMoments.start(plan.signatureMoment,{plan});
        if(signatureStarted&&this.signatureDirector&&this.signatureDirector.recordStarted)this.signatureDirector.recordStarted(plan.signatureMoment);
      }

      if(!signatureStarted&&this.primitives&&this.primitives.apply)this.primitives.apply(composition,plan);

      if(this.fx){
        this.fx.setSensoryState(sensoryState);
        if(!signatureStarted)this.fx.applyPlan(plan,target,sensoryState);
      }
      if(this.audio){
        if(this.audio.setSensoryState)this.audio.setSensoryState(sensoryState);
        if(!signatureStarted){
          const cue=previousWorld&&previousWorld!==plan.world?"worldChange":(plan.situation==="REVEAL"?"reveal":((plan.situation==="DECOY"||plan.situation==="FAKE_ENDING")?"trap":"click"));
          this.audio.play(plan.audioMood,cue,Math.min(1,plan.intensity*(.48+sensoryState.audio*.19)));
        }
      }
      if(!signatureStarted&&this.haptics&&sensoryState.hapticCue!=="NONE"){
        this.haptics.perform(sensoryState.hapticCue,sensoryState.density===3?.82:(sensoryState.density===2?.52:.24));
      }
      if(!signatureStarted)this.onRuleTwist(plan.ruleTwist,plan);
      if(!signatureStarted&&plan.speech){this.onSpeech(plan.speech,plan);this.conversation.recordSpeech(plan.speech);}

      return {
        ok:true,world:plan.world,situation:plan.situation,density:sensoryState.densityName,
        visualEffect:sensoryState.visualEffect,experienceIntent:plan.experienceIntent,composition,
        signatureMoment:plan.signatureMoment||"NONE",signatureStarted,noveltyScore:composition.noveltyScore
      };
    }

    fallback(event) {
      if(this._signatureActive())return {ok:false,reason:"signature_active"};
      const plan=this.director.fallbackPlan(event||{},this._surpriseLevelForEvent(event));
      // Local fallback owns gameplay only; speech is intentionally removed so offline mode never
      // pretends to have Gemini voice.
      plan.speech="";
      return this.applyAiPlan(plan);
    }

    shouldRequestNewSituation() {
      if(!this.currentPlan)return true;
      const elapsed=performance.now()-this.currentSituationStartedAt;
      if(elapsed<this.currentSituationMinMs)return false;
      if(elapsed>=this.currentSituationMaxMs)return true;
      const t=(elapsed-this.currentSituationMinMs)/(this.currentSituationMaxMs-this.currentSituationMinMs);
      return Math.random()<.05+t*.16;
    }

    aiContext(event,gameSnapshot) {
      const ctx=this.director.contextForAi(event||{},this._surpriseLevelForEvent(event));
      ctx.game=gameSnapshot||{};ctx.sensory=this.sensory.contextForAi();ctx.composition=this.composer.contextForAi();
      ctx.runtimeOwner="ExperienceRuntime";
      ctx.instruction=[
        "ExperienceRuntime is the only gameplay owner. Gemini is asynchronous creative direction, never the touch critical path.",
        "Keep the current world coherent for several situations.",
        "Do not repeat either of the last two situations unless surpriseLevel >= 0.9.",
        "QUIET is almost empty, NORMAL is restrained, BUSY is clearly moving, CHAOS is a rare short punch followed by QUIET.",
        "Speech is personality, not narration. React, tease, predict, question, or fake-reassure.",
        "Compose from existing interaction/spatial/reveal/camera/surface/timing primitives only.",
        "Signature moments are exclusive finished micro-games. Usually choose NONE.",
        "Input includes tap, hold, release, drag, slice, idle and wait behavior. Never require model latency for immediate feedback."
      ].join(" ");
      return ctx;
    }

    _recordBehavior(event){
      const now=performance.now(),dt=this.lastBehaviorAt?now-this.lastBehaviorAt:9999;this.lastBehaviorAt=now;
      const type=String(event&&event.type||"").toUpperCase();
      if(type==="TAP"&&dt<220)this.behaviorEnergy=Math.min(1,this.behaviorEnergy+.22);
      else if(["HOLD_COMPLETE","SLICE","WAIT_SUCCESS"].includes(type))this.behaviorEnergy=Math.min(1,this.behaviorEnergy+.16);
      else if(type==="IDLE_START"||type==="IDLE_STAGE")this.behaviorEnergy*=.35;
      else this.behaviorEnergy*=.92;
    }

    _surpriseLevelForEvent(event) {
      const type=String(event&&event.type||"").toUpperCase();
      if(["WAIT_BROKEN","RELEASE_EARLY","SLICE"].includes(type))return .58+Math.random()*.18;
      if(["HOLD_COMPLETE","WAIT_SUCCESS"].includes(type))return .48+Math.random()*.18;
      if(type==="IDLE_STAGE")return .34+Math.random()*.16;
      return .12+this.behaviorEnergy*.44+Math.random()*.12;
    }

    _signatureActive(){return !!(this.signatureMoments&&this.signatureMoments.isActive&&this.signatureMoments.isActive());}
  }

  global.ExperienceRuntime=ExperienceRuntime;
})(window);
