(function (global) {
  "use strict";

  const MODE = { SILENT:"SILENT", BANTER:"BANTER", GAME_TURN:"GAME_TURN" };

  function clamp01(v,fallback) {
    const n=Number(v);
    return Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;
  }

  function nowMs() {
    return global.performance&&typeof global.performance.now==="function"?global.performance.now():Date.now();
  }

  class ConversationDirector {
    constructor(options) {
      const o=options||{};
      this.rng=typeof o.rng==="function"?o.rng:Math.random;
      this.now=typeof o.now==="function"?o.now:nowMs;
      this.profileAccessor=typeof o.profileAccessor==="function"?o.profileAccessor:()=>({});
      this.minSpeechGapMs=Number(o.minSpeechGapMs)||1500;
      this.minGameTurnGapMs=Number(o.minGameTurnGapMs)||6500;
      this.firstIdleMs=Number(o.firstIdleMs)||4300;
      this.secondIdleMs=Number(o.secondIdleMs)||9000;
      this.lastSpeechAt=-Infinity;
      this.lastGameTurnAt=-Infinity;
      this.lastActivityAt=this.now();
      this.lastClickAt=-Infinity;
      this.clickBurst=[];
      this.idleStage=0;
      this.recentModes=[];
      this.recentSpeech=[];
    }

    routePlayerEvent(event,options) {
      const e=event||{};
      const o=options||{};
      const now=this.now();
      this.lastActivityAt=now;
      this.idleStage=0;

      if (e.type==="click" || e.type==="drag") {
        this._rememberClick(now);
      }

      const gameTurnDue=!!o.forceGameTurn || (!!o.shouldRequestNewSituation && now-this.lastGameTurnAt>=this.minGameTurnGapMs);
      if (gameTurnDue) {
        this.lastGameTurnAt=now;
        return this._rememberMode(this._directive(MODE.GAME_TURN,"situation_due",e,o));
      }

      const speechGapOk=now-this.lastSpeechAt>=this.minSpeechGapMs;
      if (!speechGapOk) return this._rememberMode(this._directive(MODE.SILENT,"speech_cooldown",e,o));

      const notable=this._notableEvent(e);
      const burst=this._clicksInWindow(now,1600);
      let chance=0.48;
      if (notable) chance+=0.24;
      if (burst>=4) chance+=0.20;
      if (e.type==="timeout") chance+=0.12;
      if (e.type==="drag") chance-=0.12;
      if (this.recentModes.slice(-2).every(x=>x===MODE.BANTER)) chance-=0.34;
      chance=Math.max(0.10,Math.min(0.82,chance));

      if (this.rng()<chance) {
        this.lastSpeechAt=now;
        return this._rememberMode(this._directive(MODE.BANTER,notable?"react_to_behavior":"light_banter",e,o));
      }
      return this._rememberMode(this._directive(MODE.SILENT,"intentional_silence",e,o));
    }

    pollIdle(options) {
      const o=options||{};
      const now=this.now();
      const idleFor=now-this.lastActivityAt;
      if (now-this.lastSpeechAt<this.minSpeechGapMs) return null;

      if (this.idleStage===0 && idleFor>=this.firstIdleMs) {
        this.idleStage=1;
        this.lastSpeechAt=now;
        return this._rememberMode(this._directive(MODE.BANTER,"idle_first",{type:"idle",idleMs:Math.round(idleFor)},o));
      }
      if (this.idleStage===1 && idleFor>=this.secondIdleMs) {
        this.idleStage=2;
        this.lastSpeechAt=now;
        return this._rememberMode(this._directive(MODE.BANTER,"idle_second",{type:"idle",idleMs:Math.round(idleFor)},o));
      }
      return null;
    }

    recordSpeech(text) {
      const value=String(text||"").trim();
      if (!value) return;
      this.lastSpeechAt=this.now();
      this.recentSpeech.push(value.slice(0,100));
      if (this.recentSpeech.length>5) this.recentSpeech.shift();
    }

    contextForAi(directive,event) {
      const d=directive||this._directive(MODE.BANTER,"manual",event||{},{});
      const p=this._profile();
      return {
        interactionMode:d.mode,
        reason:d.reason,
        event:event||d.event||{},
        playerTraits:p,
        recentSpeech:this.recentSpeech.slice(-3),
        speechStyle:{
          short:true,
          natural:true,
          teasing:true,
          nonHostile:true,
          mayStaySilent:true
        },
        instruction:d.instruction
      };
    }

    _directive(mode,reason,event,options) {
      const p=this._profile();
      const now=this.now();
      const burst=this._clicksInWindow(now,1600);
      const observations=[];
      if (burst>=4) observations.push("player is rapid-clicking");
      if (p.warningIgnoreCount>=2) observations.push("player often ignores warnings");
      if (p.patience>=0.68) observations.push("player has shown patience");
      if (p.trustsAI<=0.35) observations.push("player is skeptical of the AI");
      if (p.curiosity>=0.68) observations.push("player explores unusual choices");

      let instruction;
      if (mode===MODE.BANTER) {
        instruction=[
          "SPEAK ONLY. Do not call any tool or function and do not change the UI.",
          "React to what the player just did like a mischievous game host, not an assistant.",
          "Use one natural short line, usually 2-14 words. It may be a tease, prediction, question, fake reassurance, or observation.",
          "Do not narrate the UI. Do not explain game mechanics. Do not insult the player.",
          "Avoid repeating recent wording. A tiny pause or dry reaction is better than constant excitement.",
          observations.length?"Useful observations: "+observations.join("; ")+".":""
        ].filter(Boolean).join(" ");
      } else if (mode===MODE.GAME_TURN) {
        instruction=[
          "This is a GAME TURN.",
          "React briefly in voice, then call apply_world_experience exactly once.",
          "The function changes the game; your spoken line should feel like a setup or punchline, not a description of the effect.",
          "Keep the same world unless the runtime context strongly supports a world shift.",
          observations.length?"Useful observations: "+observations.join("; ")+".":""
        ].filter(Boolean).join(" ");
      } else {
        instruction="SILENT TURN. Do not send this event to Gemini. Local feedback only.";
      }
      return {mode,reason,event:event||{},instruction,observations};
    }

    _notableEvent(e) {
      return e&&(
        e.correct===true || e.correct===false || e.type==="timeout" ||
        e.ignoredWarning===true || e.fakeEndingBelieved===true || e.special===true
      );
    }

    _rememberClick(now) {
      this.lastClickAt=now;
      this.clickBurst.push(now);
      const cutoff=now-2400;
      while (this.clickBurst.length&&this.clickBurst[0]<cutoff) this.clickBurst.shift();
    }

    _clicksInWindow(now,ms) {
      const cutoff=now-ms;
      let count=0;
      for (let i=this.clickBurst.length-1;i>=0;i--) {
        if (this.clickBurst[i]<cutoff) break;
        count++;
      }
      return count;
    }

    _profile() {
      const p=this.profileAccessor()||{};
      return {
        rageClickCount:Math.max(0,Number(p.rageClickCount)||0),
        warningIgnoreCount:Math.max(0,Number(p.warningIgnoreCount)||0),
        curiosity:clamp01(p.curiosity,0.5),
        patience:clamp01(p.patience,0.5),
        trustsAI:clamp01(p.trustsAI,0.5)
      };
    }

    _rememberMode(directive) {
      this.recentModes.push(directive.mode);
      if (this.recentModes.length>6) this.recentModes.shift();
      return directive;
    }
  }

  ConversationDirector.MODE=MODE;
  global.ConversationDirector=ConversationDirector;
})(window);
