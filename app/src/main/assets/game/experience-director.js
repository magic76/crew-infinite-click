(function (global) {
  "use strict";
  const catalog = global.GameWorldCatalog;
  if (!catalog) throw new Error("experience-director.js requires world-catalog.js");

  function weightedPick(weightMap, rng, excluded) {
    const block = new Set(excluded || []);
    let entries = Object.entries(weightMap).filter(([k,v]) => v > 0 && !block.has(k));
    if (!entries.length) entries = Object.entries(weightMap).filter(([,v]) => v > 0);
    if (!entries.length) return null;
    const total = entries.reduce((s,[,w]) => s+w, 0);
    let cursor = rng()*total;
    for (const [key,weight] of entries) {
      cursor -= weight;
      if (cursor <= 0) return key;
    }
    return entries[entries.length-1][0];
  }

  function clamp01(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0,Math.min(1,n)) : fallback;
  }

  class ExperienceDirector {
    constructor(options) {
      const o = options || {};
      this.rng = typeof o.rng === "function" ? o.rng : Math.random;
      this.profileAccessor = typeof o.profileAccessor === "function" ? o.profileAccessor : () => ({});
      this.currentWorld = null;
      this.situationsInWorld = 0;
      this.worldSpan = this._nextWorldSpan();
      this.recentSituations = [];
      this.recentWorlds = [];
      this.lastPlan = null;
    }

    startSession(preferredWorld) {
      this.currentWorld = catalog.WORLDS[preferredWorld] ? preferredWorld : this._chooseWorld();
      this.situationsInWorld = 0;
      this.worldSpan = this._nextWorldSpan();
      this._rememberWorld(this.currentWorld);
      return this.currentWorld;
    }

    getWorld() {
      if (!this.currentWorld) this.startSession();
      return this.currentWorld;
    }

    advanceSituation(options) {
      const o = options || {};
      if (!this.currentWorld) this.startSession();
      const rareWorldShift = o.allowWorldShift !== false
        && clamp01(o.surpriseLevel,0) >= 0.88
        && this.rng() < 0.28;

      if (this.situationsInWorld >= this.worldSpan || rareWorldShift) {
        this.currentWorld = this._chooseWorld();
        this.situationsInWorld = 0;
        this.worldSpan = this._nextWorldSpan();
        this._rememberWorld(this.currentWorld);
      }

      const situation = this._chooseSituation(this.currentWorld);
      this.situationsInWorld += 1;
      this._rememberSituation(situation);
      return { world:this.currentWorld, situation, worldIndex:this.situationsInWorld, worldSpan:this.worldSpan };
    }

    contextForAi(event, surpriseLevel) {
      if (!this.currentWorld) this.startSession();
      return {
        world:this.currentWorld,
        recentSituations:this.recentSituations.slice(-3),
        recentWorlds:this.recentWorlds.slice(-2),
        surpriseLevel:clamp01(surpriseLevel,0.25),
        playerTraits:this._safeProfile(),
        event:event || {}
      };
    }

    sanitizePlan(raw) {
      const input = raw || {};
      if (!this.currentWorld) this.startSession();

      let world = catalog.WORLDS[input.world] ? input.world : this.currentWorld;
      const surprise = clamp01(input.surpriseLevel,0.35);
      if (world !== this.currentWorld && surprise < 0.82 && this.situationsInWorld < this.worldSpan) {
        world = this.currentWorld;
      }
      if (world !== this.currentWorld) {
        this.currentWorld = world;
        this.situationsInWorld = 0;
        this.worldSpan = this._nextWorldSpan();
        this._rememberWorld(world);
      }

      let situation = catalog.SITUATIONS.includes(input.situation) ? input.situation : this._chooseSituation(world);
      const sameInLastTwo = this.recentSituations.slice(-2).filter(x => x === situation).length >= 2;
      if (sameInLastTwo && surprise < 0.9) situation = this._chooseSituation(world,new Set([situation]));

      const def = catalog.WORLDS[world];
      const plan = {
        world,
        mood:catalog.MOODS.includes(input.mood) ? input.mood : this._defaultMood(world),
        situation,
        audioMood:this._validAudio(input.audioMood) ? input.audioMood : def.audioMood,
        targetBehavior:catalog.TARGET_BEHAVIORS.includes(input.targetBehavior) ? input.targetBehavior : this._defaultBehavior(situation),
        ruleTwist:catalog.RULE_TWISTS.includes(input.ruleTwist) ? input.ruleTwist : "NONE",
        speech:String(input.speech || "").slice(0,140),
        intensity:clamp01(input.intensity,0.45),
        surpriseLevel:surprise,
        sensoryDensity:Number.isFinite(Number(input.sensoryDensity)) ? Math.max(0,Math.min(3,Math.round(Number(input.sensoryDensity)))) : undefined,
        visualEffect:typeof input.visualEffect === "string" ? input.visualEffect : "AUTO",
        hapticCue:typeof input.hapticCue === "string" ? input.hapticCue : "AUTO",
        experienceIntent:(catalog.INTENTS&&catalog.INTENTS.includes(input.experienceIntent)) ? input.experienceIntent : "TEASE",
        composition:(input.composition&&typeof input.composition==="object") ? Object.assign({},input.composition) : {},
        signatureMoment:["NONE","FLASHLIGHT_HUNT","SCREEN_SHATTER"].includes(input.signatureMoment)?input.signatureMoment:"NONE",
        actions:Array.isArray(input.actions) ? input.actions.slice(0,8) : []
      };

      this.situationsInWorld += 1;
      this._rememberSituation(situation);
      this.lastPlan = plan;
      return plan;
    }

    fallbackPlan(event, surpriseLevel) {
      if (!this.currentWorld) this.startSession();
      const surprise=clamp01(surpriseLevel,0.25);
      if (this.situationsInWorld >= this.worldSpan || (surprise >= 0.88 && this.rng() < 0.28)) {
        this.currentWorld=this._chooseWorld();
        this.situationsInWorld=0;
        this.worldSpan=this._nextWorldSpan();
        this._rememberWorld(this.currentWorld);
      }
      const situation=this._chooseSituation(this.currentWorld);
      const def=catalog.WORLDS[this.currentWorld];
      return this.sanitizePlan({
        world:this.currentWorld,
        situation,
        audioMood:def.audioMood,
        mood:this._defaultMood(this.currentWorld),
        targetBehavior:this._defaultBehavior(situation),
        ruleTwist:this._fallbackRule(situation),
        intensity:0.35 + this.rng()*0.35,
        surpriseLevel:surprise,
        speech:this._fallbackSpeech(situation),
        sensoryDensity:undefined,
        visualEffect:"AUTO",
        hapticCue:"AUTO",
        experienceIntent:"TEASE",
        composition:{},
        signatureMoment:"NONE",
        actions:[]
      });
    }

    _chooseWorld() {
      const weights = {};
      const p = this._safeProfile();
      for (const id of catalog.WORLD_IDS) weights[id] = 1;
      if (p.rageClickCount > 3) { weights.SUMMER_STORM += 0.55; weights.NEON_RIFT += 0.45; }
      if (p.patience > 0.62) { weights.WINTER_FROST += 0.48; weights.SPRING_BLOOM += 0.48; }
      if (p.curiosity > 0.64) { weights.VOID_CHAMBER += 0.5; weights.AUTUMN_DECAY += 0.28; }
      return weightedPick(weights,this.rng,this.recentWorlds.slice(-2));
    }

    _chooseSituation(world, extraExcluded) {
      const def = catalog.WORLDS[world] || catalog.WORLDS.NEON_RIFT;
      const weights = Object.assign({},def.situationWeights);
      const p = this._safeProfile();
      if (p.rageClickCount >= 3) { weights.CHASE *= 1.25; weights.DECOY *= 1.2; }
      if (p.patience >= 0.65) { weights.WAIT *= 1.35; weights.REVEAL *= 1.2; }
      if (p.curiosity >= 0.65) { weights.HIDE *= 1.2; weights.REVEAL *= 1.18; }
      if (p.trustsAI < 0.35) { weights.PREDICT *= 1.25; weights.MIRROR *= 1.15; }
      const excluded = new Set(this.recentSituations.slice(-2));
      if (extraExcluded) for (const item of extraExcluded) excluded.add(item);
      return weightedPick(weights,this.rng,excluded) || "REVEAL";
    }

    _safeProfile() {
      const p = this.profileAccessor() || {};
      return {
        rageClickCount:Math.max(0,Number(p.rageClickCount)||0),
        warningIgnoreCount:Math.max(0,Number(p.warningIgnoreCount)||0),
        curiosity:clamp01(p.curiosity,0.5), patience:clamp01(p.patience,0.5),
        trustsAI:clamp01(p.trustsAI,0.5), averageReactionTime:Math.max(0,Number(p.averageReactionTime)||0)
      };
    }

    _rememberSituation(s) { this.recentSituations.push(s); if (this.recentSituations.length > 5) this.recentSituations.shift(); }
    _rememberWorld(w) { if (this.recentWorlds[this.recentWorlds.length-1] !== w) this.recentWorlds.push(w); if (this.recentWorlds.length > 4) this.recentWorlds.shift(); }
    _nextWorldSpan() { return 3 + Math.floor(this.rng()*4); }
    _validAudio(v) { return ["ORGANIC","STORM","DRY","GLASS","COSMIC","GLITCH"].includes(v); }
    _defaultMood(w) { if (w==="WINTER_FROST") return "CALM"; if (w==="VOID_CHAMBER") return "EERIE"; if (w==="SUMMER_STORM") return "CHAOTIC"; return "PLAYFUL"; }
    _defaultBehavior(s) { if (s==="CHASE") return "ESCAPE"; if (s==="DECOY") return "SPLIT"; if (s==="HIDE") return "HIDE"; if (s==="WAIT") return "STILL"; return "PULSE"; }
    _fallbackRule(s) { if (s==="WAIT") return "WAIT_TO_WIN"; if (s==="MIRROR") return "LEFT_RIGHT_REVERSED"; return "NONE"; }
    _fallbackSpeech(s) {
      return ({CHASE:"Catch it first.",DECOY:"You sure that one is real?",WAIT:"Maybe doing nothing is smarter.",PREDICT:"I bet you pick wrong again.",MIRROR:"You trust left and right that much?",HIDE:"You missed something.",REVEAL:"Fine. One little hint.",FAKE_ENDING:"Congratulations. Probably."})[s] || "Again.";
    }
  }

  global.ExperienceDirector = ExperienceDirector;
})(window);
