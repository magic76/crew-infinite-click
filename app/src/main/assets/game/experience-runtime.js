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
      this.mutationContext=typeof o.mutationContext==="function"?o.mutationContext:()=>null;
      this.promiseContext=typeof o.promiseContext==="function"?o.promiseContext:()=>null;
      this.sceneContext=typeof o.sceneContext==="function"?o.sceneContext:()=>null;
      this.primitives=o.primitives||new global.InteractionPrimitives({
        fx:this.fx,getPrimaryTarget:this.getPrimaryTarget,
        onInteraction:o.onPrimitiveInteraction,onSpatial:o.onPrimitiveSpatial,onCamera:o.onPrimitiveCamera,
        onSurface:o.onPrimitiveSurface,onTiming:o.onPrimitiveTiming
      });
      this.currentPlan=null;
      this.currentSensoryState=this.sensory.resolve({world:"NEON_RIFT",situation:"WAIT",intensity:.12,surpriseLevel:.06,sensoryDensity:0});
      this.currentSituationStartedAt=0;this.currentSituationMinMs=6500;this.currentSituationMaxMs=18000;
      this.lastBehaviorAt=0;this.behaviorEnergy=0;this.allowWorldShiftOnce=false;
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
      // Pointer-down owns TAP juice so sensory density can never make tapping feel dead.
      // Semantic events still get audio/fx here, but TAP/RELEASE do not double-fire.
      if(this.audio&&type!=="TAP"&&type!=="RELEASE"){
        const mood=this.currentPlan?this.currentPlan.audioMood:"GLITCH";
        this.audio.play(mood,"click",.12+feedback.intensity*.28);
      }
      if(this.fx&&type!=="TAP"&&type!=="RELEASE"){
        if(typeof this.fx.reactToPlayerEvent==="function"){
          this.fx.reactToPlayerEvent(e,this.getPrimaryTarget(),this.currentPlan,this.currentSensoryState);
        }else if(feedback.burstScale>0&&Number.isFinite(e.x)&&Number.isFinite(e.y)){
          const count=Math.max(0,Math.round(6*feedback.burstScale));
          if(count>0)this.fx.burst(e.x,e.y,count,.38+feedback.burstScale*.38);
        }
      }

      const shouldNew=this.shouldRequestNewSituation();
      const interaction=this.conversation.routePlayerEvent(e,{shouldRequestNewSituation:shouldNew,currentPlan:this.currentPlan,sensory:this.currentSensoryState});
      const context=this.aiContext(e,{});
      context.interaction=interaction;context.conversation=this.conversation.contextForAi(interaction,e);
      this.onInteractionDirective(interaction,context);
      return context;
    }

    pollIdle(gameSnapshot) {
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
      const previousWorld=this.currentPlan&&this.currentPlan.world;
      const safeRaw=Object.assign({},rawPlan||{});
      safeRaw.speech="";
      const scene=this.sceneContext()||null;
      if(scene&&scene.scene==="STORM_CONTROL_ROOM")safeRaw.world="SUMMER_STORM";
      // Signature moments are retired. Ignore stale/model-provided values unconditionally.
      safeRaw.signatureMoment="NONE";
      // Persistent local mutation owns world lifespan. AI/fallback may vary situations inside the
      // world, but only a completed mutation epoch is allowed to shift worlds.
      const mutation=this.mutationContext()||null;
      if(!this.allowWorldShiftOnce&&previousWorld&&mutation&&Number(mutation.rupturesUntilWorldShift)>0&&safeRaw.world&&safeRaw.world!==previousWorld){
        safeRaw.world=previousWorld;
        // fallbackPlan may already have advanced the director internally; restore the mutation-owned world
        // before sanitizing so internal director state cannot leak an early world switch.
        if(this.director&&typeof this.director.startSession==="function")this.director.startSession(previousWorld);
      }
      const allowShift=this.allowWorldShiftOnce;this.allowWorldShiftOnce=false;
      const plan=this.director.sanitizePlan(safeRaw);
      if(allowShift&&safeRaw.world)plan.world=safeRaw.world;
      const sensoryState=this.sensory.resolve(plan);
      const composition=this.composer.compose(plan.composition||{},{
        world:plan.world,density:sensoryState.density,experienceIntent:plan.experienceIntent
      });
      plan.composition=composition;
      this.currentPlan=plan;this.currentSensoryState=sensoryState;this.currentSituationStartedAt=performance.now();
      const target=this.getPrimaryTarget();

      const signatureStarted=false;

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
      plan.speech=""; // v10: AI voice is fully disabled; model is background director only.

      return {
        ok:true,world:plan.world,situation:plan.situation,density:sensoryState.densityName,
        visualEffect:sensoryState.visualEffect,experienceIntent:plan.experienceIntent,composition,
        signatureMoment:plan.signatureMoment||"NONE",signatureStarted,noveltyScore:composition.noveltyScore
      };
    }

    fallback(event) {
      const plan=this.director.fallbackPlan(event||{},this._surpriseLevelForEvent(event));
      // Local fallback owns gameplay only; speech is intentionally removed so offline mode never
      // pretends to have Gemini voice.
      plan.speech="";
      return this.applyAiPlan(plan);
    }

    /**
     * PromiseRuntime may finish a visual mystery locally, but gameplay consequences still flow
     * through ExperienceRuntime so there is never a second gameplay owner.
     */
    forceLocalPromiseConsequence(meta) {
      const m=meta||{},type=String(m.promiseType||m.type||"RIFT").toUpperCase();
      const previous=this.currentPlan&&this.currentPlan.world;
      const event=Object.assign({type:"PROMISE_REVEAL",special:true},m);
      const plan=this.director.fallbackPlan(event,.82);
      if(previous)plan.world=previous;
      const map={
        RIFT:{situation:"CHASE",targetBehavior:"ESCAPE",experienceIntent:"SURPRISE",ruleTwist:"NONE"},
        ASSEMBLY:{situation:"PREDICT",targetBehavior:"PULSE",experienceIntent:"PREDICT",ruleTwist:"NONE"},
        SHADOW:{situation:"MIRROR",targetBehavior:"HIDE",experienceIntent:"TRUST_TEST",ruleTwist:"LEFT_RIGHT_REVERSED"},
        TRANSFORM:{situation:"CHASE",targetBehavior:"PULSE",experienceIntent:"CHASE",ruleTwist:"NONE"},
        ECHO:{situation:"DECOY",targetBehavior:"SPLIT",experienceIntent:"MISDIRECT",ruleTwist:"NONE"},
        FALSE_CALM:{situation:"FAKE_ENDING",targetBehavior:"ESCAPE",experienceIntent:"SURPRISE",ruleTwist:"NONE"}
      };
      Object.assign(plan,map[type]||map.RIFT);
      plan.intensity=Math.max(.64,Number(plan.intensity)||0);
      plan.surpriseLevel=Math.max(.82,Number(plan.surpriseLevel)||0);
      plan.sensoryDensity=Math.max(2,Number(plan.sensoryDensity)||0);
      plan.speech="";plan.signatureMoment="NONE";
      return this.applyAiPlan(plan);
    }

    /** Scene reveal consequences remain inside the sole ExperienceRuntime owner. */
    forceLocalSceneConsequence(meta) {
      const m=meta||{},previous=this.currentPlan&&this.currentPlan.world;
      const event=Object.assign({type:"SCENE_REVEAL",special:true},m);
      const plan=this.director.fallbackPlan(event,.88);
      plan.world=previous||"SUMMER_STORM";plan.audioMood="STORM";plan.speech="";plan.signatureMoment="NONE";
      const cycle=Math.max(0,Number(m.cycle)||0);
      if(cycle%3===0)Object.assign(plan,{situation:"REVEAL",targetBehavior:"PULSE",experienceIntent:"SURPRISE",ruleTwist:"NONE"});
      else if(cycle%3===1)Object.assign(plan,{situation:"PREDICT",targetBehavior:"STILL",experienceIntent:"PREDICT",ruleTwist:"NONE"});
      else Object.assign(plan,{situation:"FAKE_ENDING",targetBehavior:"STILL",experienceIntent:"MISDIRECT",ruleTwist:"NONE"});
      plan.intensity=.72;plan.surpriseLevel=.9;plan.sensoryDensity=2;
      return this.applyAiPlan(plan);
    }

    /**
     * WorldMutationRuntime can request a rare local world rupture without creating a second
     * gameplay owner. ExperienceRuntime still validates/applies the resulting plan.
     */
    forceLocalWorldMutation(meta) {
      const scene=this.sceneContext()||null;if(scene&&scene.scene==="STORM_CONTROL_ROOM")return this.forceLocalSceneConsequence(meta);
      const ids=(global.GameWorldCatalog&&global.GameWorldCatalog.WORLD_IDS)||[];
      const previous=this.currentPlan&&this.currentPlan.world;
      const candidates=ids.filter(id=>id!==previous);
      const next=candidates.length?candidates[Math.floor(Math.random()*candidates.length)]:undefined;
      this.director.startSession(next);
      const event=Object.assign({type:"WORLD_RUPTURE",special:true},meta||{});
      const plan=this.director.fallbackPlan(event,.96);
      plan.world=next||plan.world;
      plan.intensity=Math.max(.72,Number(plan.intensity)||0);
      plan.surpriseLevel=.96;
      plan.sensoryDensity=3;
      plan.speech="";
      plan.signatureMoment="NONE";
      this.allowWorldShiftOnce=true;
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
      ctx.worldMutation=this.mutationContext()||null;
      ctx.visualPromise=this.promiseContext()||null;ctx.scene=this.sceneContext()||null;
      ctx.runtimeOwner="ExperienceRuntime";
      ctx.instruction=[
        "ExperienceRuntime is the only gameplay owner. Gemini is asynchronous creative direction, never the touch critical path.",
        "The active product experiment is STORM_CONTROL_ROOM. Keep world=SUMMER_STORM and treat the room as physical truth.",
        "Do not repeat either of the last two situations unless surpriseLevel >= 0.9.",
        "QUIET is almost empty, NORMAL is restrained, BUSY is clearly moving, CHAOS is a rare short punch followed by QUIET.",
        "AI VOICE IS DISABLED. Never speak, narrate, banter, or return speech. Use tool output only.",
        "Compose from existing interaction/spatial/reveal/camera/surface/timing primitives only.",
        "StormControlSceneRuntime owns charge, overload, reroute, breach, door and window progression. Never reset it or request a different world.",
        "Use ctx.scene only to bias the next anomaly focus or gameplay consequence. Never wait for model latency to advance the scene.",
        "Signature moments are retired. Always choose NONE.",
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

  }

  global.ExperienceRuntime=ExperienceRuntime;
})(window);
