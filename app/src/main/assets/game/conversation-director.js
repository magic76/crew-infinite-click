(function (global) {
  "use strict";

  const MODE={SILENT:"SILENT",BANTER:"BANTER",GAME_TURN:"GAME_TURN"};
  const DELIVERY=["DRY","TEASE","WHISPER","SNAP","CHALLENGE","FAKE_CALM","EXCITED","DEADPAN"];

  function clamp01(v,fallback){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;}
  function nowMs(){return global.performance&&typeof global.performance.now==="function"?global.performance.now():Date.now();}

  class ConversationDirector {
    constructor(options){
      const o=options||{};
      this.rng=typeof o.rng==="function"?o.rng:Math.random;this.now=typeof o.now==="function"?o.now:nowMs;
      this.profileAccessor=typeof o.profileAccessor==="function"?o.profileAccessor:()=>({});
      this.minSpeechGapMs=Number(o.minSpeechGapMs)||1250;this.minGameTurnGapMs=Number(o.minGameTurnGapMs)||6500;
      this.firstIdleMs=Number(o.firstIdleMs)||3800;this.secondIdleMs=Number(o.secondIdleMs)||8200;
      this.lastSpeechAt=-Infinity;this.lastGameTurnAt=-Infinity;this.lastActivityAt=this.now();this.lastClickAt=-Infinity;
      this.clickBurst=[];this.idleStage=0;this.recentModes=[];this.recentSpeech=[];this.recentDelivery=[];
    }

    routePlayerEvent(event,options){
      const e=event||{},o=options||{},now=this.now();this.lastActivityAt=now;this.idleStage=0;
      if(["click","tap","drag"].includes(e.type))this._rememberClick(now);
      const gameTurnDue=!!o.forceGameTurn||(!!o.shouldRequestNewSituation&&now-this.lastGameTurnAt>=this.minGameTurnGapMs);
      if(gameTurnDue){this.lastGameTurnAt=now;return this._rememberMode(this._directive(MODE.GAME_TURN,"situation_due",e,o));}
      if(now-this.lastSpeechAt<this.minSpeechGapMs)return this._rememberMode(this._directive(MODE.SILENT,"speech_cooldown",e,o));

      const notable=this._notableEvent(e),burst=this._clicksInWindow(now,1500);let chance=0.58;
      if(notable)chance+=0.20;if(burst>=4)chance+=0.16;if(["idle_wait","idle_hint","hold_start","release_early","hold_complete","wait_broken"].includes(e.type))chance+=0.14;
      if(e.type==="drag")chance-=0.08;if(this.recentModes.slice(-2).every(x=>x===MODE.BANTER))chance-=0.30;chance=Math.max(.12,Math.min(.86,chance));
      if(this.rng()<chance){this.lastSpeechAt=now;return this._rememberMode(this._directive(MODE.BANTER,notable?"react_to_behavior":"light_banter",e,o));}
      return this._rememberMode(this._directive(MODE.SILENT,"intentional_silence",e,o));
    }

    pollIdle(options){
      const o=options||{},now=this.now(),idleFor=now-this.lastActivityAt;if(now-this.lastSpeechAt<this.minSpeechGapMs)return null;
      if(this.idleStage===0&&idleFor>=this.firstIdleMs){this.idleStage=1;this.lastSpeechAt=now;return this._rememberMode(this._directive(MODE.BANTER,"idle_first",{type:"idle",idleMs:Math.round(idleFor)},o));}
      if(this.idleStage===1&&idleFor>=this.secondIdleMs){this.idleStage=2;this.lastSpeechAt=now;return this._rememberMode(this._directive(MODE.BANTER,"idle_second",{type:"idle",idleMs:Math.round(idleFor)},o));}
      return null;
    }

    recordSpeech(text){const value=String(text||"").trim();if(!value)return;this.lastSpeechAt=this.now();this.recentSpeech.push(value.slice(0,120));if(this.recentSpeech.length>5)this.recentSpeech.shift();}

    contextForAi(directive,event){
      const d=directive||this._directive(MODE.BANTER,"manual",event||{},{}),p=this._profile();
      return {interactionMode:d.mode,reason:d.reason,event:event||d.event||{},playerTraits:p,recentSpeech:this.recentSpeech.slice(-3),delivery:d.delivery,
        speechStyle:{language:"English",short:true,performed:true,teasing:true,nonHostile:true,highContrastDelivery:true,mayStaySilent:true},instruction:d.instruction};
    }

    _directive(mode,reason,event,options){
      const p=this._profile(),now=this.now(),burst=this._clicksInWindow(now,1500),observations=[];
      if(burst>=4)observations.push("the player is rapid-clicking");if(p.warningIgnoreCount>=2)observations.push("the player often ignores warnings");
      if(p.patience>=.68)observations.push("the player has shown patience");if(p.trustsAI<=.35)observations.push("the player is skeptical of you");if(p.curiosity>=.68)observations.push("the player explores unusual choices");
      if(event&&event.type==="hold_start")observations.push("the player is holding instead of tapping");if(event&&event.type==="release_early")observations.push("the player let go too early");
      if(event&&["idle_wait","idle_hint","idle"].includes(event.type))observations.push("the player stopped moving");if(event&&event.type==="wait_broken")observations.push("the player touched after being told not to");
      const delivery=this._deliveryFor(event,reason,burst);
      let instruction;
      if(mode===MODE.BANTER){
        instruction=[
          "SPEAK ONLY in English. Do not call any tool and do not change the UI.",
          "Perform the line like a mischievous game host, not an assistant. The delivery must have contrast: whisper, snap, challenge, fake calm, deadpan, or sudden excitement depending on DELIVERY.",
          "Use 2-10 words most of the time. Make it feel like a reaction or dare, not an explanation.",
          "Do not narrate what is visibly happening. Avoid bland phrases like 'good job', 'okay', or 'let's continue'.",
          "You may interrupt yourself, count down, whisper one word, laugh once, or leave a charged pause, but do not overdo any one gimmick.",
          "Never insult the player. Never sound like customer support.",
          "DELIVERY="+delivery+".",
          observations.length?"PLAYER READ: "+observations.join("; ")+".":""
        ].filter(Boolean).join(" ");
      }else if(mode===MODE.GAME_TURN){
        instruction=[
          "This is a GAME TURN. Speak one punchy English setup line, then call apply_world_experience exactly once.",
          "Do not describe the effect. Set tension, misdirect, dare, predict, or land a punchline.",
          "Act the line with clear contrast. DELIVERY="+delivery+".",
          observations.length?"PLAYER READ: "+observations.join("; ")+".":""
        ].filter(Boolean).join(" ");
      }else instruction="SILENT TURN. Do not send this event to Gemini. Local feedback only.";
      this._rememberDelivery(delivery);return{mode,reason,event:event||{},instruction,observations,delivery};
    }

    _deliveryFor(event,reason,burst){
      let preferred;
      const t=event&&event.type;
      if(t==="release_early"||t==="wait_broken")preferred="SNAP";
      else if(t==="hold_start")preferred="WHISPER";
      else if(t==="hold_complete"||event&&event.correct===true)preferred="EXCITED";
      else if(t==="idle"||t==="idle_wait"||t==="idle_hint")preferred="WHISPER";
      else if(burst>=4)preferred="CHALLENGE";
      else if(reason==="situation_due")preferred="FAKE_CALM";
      else preferred=DELIVERY[Math.floor(this.rng()*DELIVERY.length)];
      if(this.recentDelivery.slice(-2).includes(preferred)){
        const pool=DELIVERY.filter(x=>!this.recentDelivery.slice(-2).includes(x));if(pool.length)preferred=pool[Math.floor(this.rng()*pool.length)];
      }
      return preferred;
    }
    _rememberDelivery(v){if(!v)return;this.recentDelivery.push(v);if(this.recentDelivery.length>5)this.recentDelivery.shift();}
    _notableEvent(e){return e&&(e.correct===true||e.correct===false||e.type==="timeout"||["hold_start","release_early","hold_complete","idle_wait","idle_hint","wait_broken"].includes(e.type)||e.ignoredWarning===true||e.fakeEndingBelieved===true||e.special===true);}
    _rememberClick(now){this.lastClickAt=now;this.clickBurst.push(now);const cutoff=now-2400;while(this.clickBurst.length&&this.clickBurst[0]<cutoff)this.clickBurst.shift();}
    _clicksInWindow(now,ms){const cutoff=now-ms;let count=0;for(let i=this.clickBurst.length-1;i>=0;i--){if(this.clickBurst[i]<cutoff)break;count++;}return count;}
    _profile(){const p=this.profileAccessor()||{};return{rageClickCount:Math.max(0,Number(p.rageClickCount)||0),warningIgnoreCount:Math.max(0,Number(p.warningIgnoreCount)||0),curiosity:clamp01(p.curiosity,.5),patience:clamp01(p.patience,.5),trustsAI:clamp01(p.trustsAI,.5)};}
    _rememberMode(d){this.recentModes.push(d.mode);if(this.recentModes.length>6)this.recentModes.shift();return d;}
  }

  ConversationDirector.MODE=MODE;global.ConversationDirector=ConversationDirector;
})(window);
