(function (global) {
  "use strict";

  const MODE={SILENT:"SILENT",BANTER:"BANTER",GAME_TURN:"GAME_TURN"};
  const DELIVERY=["DRY","TEASE","WHISPER","SNAP","CHALLENGE","FAKE_CALM","EXCITED","DEADPAN"];
  const nowMs=()=>global.performance&&performance.now?performance.now():Date.now();
  const clamp01=(v,f)=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):f;};
  const typeOf=e=>String(e&&e.type||"").toUpperCase();

  class ConversationDirector {
    constructor(options){
      const o=options||{};
      this.rng=typeof o.rng==="function"?o.rng:Math.random;this.now=typeof o.now==="function"?o.now:nowMs;
      this.profileAccessor=typeof o.profileAccessor==="function"?o.profileAccessor:()=>({});
      this.minSpeechGapMs=Number(o.minSpeechGapMs)||4800;
      this.minGameTurnGapMs=Number(o.minGameTurnGapMs)||7200;
      this.firstIdleMs=Number(o.firstIdleMs)||3500;this.secondIdleMs=Number(o.secondIdleMs)||7600;
      this.lastSpeechAt=-Infinity;this.lastGameTurnAt=-Infinity;this.lastActivityAt=this.now();
      this.tapBurst=[];this.idleStage=0;this.recentModes=[];this.recentSpeech=[];this.recentDelivery=[];
    }

    routePlayerEvent(event,options){
      const e=event||{},o=options||{},t=typeOf(e),now=this.now();
      if(t!=="HOLD_PROGRESS"&&t!=="DRAG_MOVE")this.lastActivityAt=now;
      if(t==="TAP")this._rememberTap(now);
      const due=!!o.forceGameTurn||(!!o.shouldRequestNewSituation&&now-this.lastGameTurnAt>=this.minGameTurnGapMs);
      if(due){this.lastGameTurnAt=now;return this._rememberMode(this._directive(MODE.GAME_TURN,"situation_due",e,Object.assign({},o,{voiceWanted:false})));}
      return this._rememberMode(this._directive(MODE.SILENT,"v10_ai_voice_disabled",e,o));
    }

    pollIdle(options){return null;}

    recordSpeech(text){const v=String(text||"").trim();if(!v)return;this.lastSpeechAt=this.now();this.recentSpeech.push(v.slice(0,120));if(this.recentSpeech.length>5)this.recentSpeech.shift();}

    contextForAi(directive,event){
      const d=directive||this._directive(MODE.BANTER,"manual",event||{},{}),p=this._profile();
      return {interactionMode:d.mode,reason:d.reason,event:event||d.event||{},playerTraits:p,recentSpeech:this.recentSpeech.slice(-3),delivery:d.delivery,
        speechStyle:{enabled:false,mayStaySilent:true},instruction:d.instruction};
    }

    _directive(mode,reason,event,options){
      const p=this._profile(),now=this.now(),burst=this._tapsInWindow(now,1500),t=typeOf(event),observations=[];
      if(burst>=4)observations.push("rapid tapping");
      if(p.warningIgnoreCount>=2)observations.push("repeatedly ignores warnings");
      if(p.patience>=.68)observations.push("has shown patience");
      if(t==="HOLD_START")observations.push("started holding");
      if(t==="RELEASE_EARLY")observations.push("let go too early");
      if(t==="HOLD_COMPLETE")observations.push("completed the hold");
      if(t==="WAIT_BROKEN")observations.push("touched after being told not to");
      if(t==="WAIT_SUCCESS")observations.push("actually waited");
      if(t==="IDLE_START"||t==="IDLE_STAGE")observations.push("stopped interacting");
      const delivery=this._deliveryFor(event,reason,burst);
      let instruction="";
      if(mode===MODE.BANTER){
        instruction=[
          "BANTER ONLY. Speak one line only when there is an actual observation worth saying. Do not call a tool and do not change gameplay.",
          "Sound like a smart, dry friend watching over the player's shoulder -- not a game mascot, host, narrator, or children's character.",
          "Underreact. No fake excitement, no generic praise, no filler such as wow/haha/hehe/awesome. Prefer a specific dry observation about what the person just did.",
          "For zh-TW, use natural Taiwan Mandarin, not translated English meme phrasing. Keep it conversational and adult.",
          "Never state obvious visuals such as 'the button moved' or 'there are three buttons'.",
          "DELIVERY="+delivery+".",
          observations.length?"PLAYER READ: "+observations.join("; ")+".":""
        ].filter(Boolean).join(" ");
      } else if(mode===MODE.GAME_TURN){
        instruction=[
          "GAME TURN. AI voice is disabled. NEVER SPEAK. Silently call apply_world_experience exactly once.",
          "Choose intent/composition only. Never generate code, frame data or particle coordinates.",
          "Do not narrate obvious visuals. No generic praise or fake excitement. DELIVERY="+delivery+".",
          observations.length?"PLAYER READ: "+observations.join("; ")+".":""
        ].filter(Boolean).join(" ");
      } else instruction="SILENT TURN. Local runtime only; do not send to Gemini.";
      this._rememberDelivery(delivery);
      return {mode,reason,event:event||{},instruction,observations,delivery,voiceWanted:false};
    }

    _deliveryFor(event,reason,burst){
      const t=typeOf(event);let preferred;
      if(t==="RELEASE_EARLY"||t==="WAIT_BROKEN")preferred="SNAP";
      else if(t==="HOLD_START")preferred="WHISPER";
      else if(t==="HOLD_COMPLETE"||t==="WAIT_SUCCESS"||event&&event.correct===true)preferred="EXCITED";
      else if(t==="IDLE_START"||t==="IDLE_STAGE")preferred="WHISPER";
      else if(burst>=4)preferred="CHALLENGE";
      else if(reason==="situation_due")preferred="FAKE_CALM";
      else preferred=DELIVERY[Math.floor(this.rng()*DELIVERY.length)];
      if(this.recentDelivery.slice(-2).includes(preferred)){
        const pool=DELIVERY.filter(x=>!this.recentDelivery.slice(-2).includes(x));
        if(pool.length)preferred=pool[Math.floor(this.rng()*pool.length)];
      }
      return preferred;
    }
    _notableEvent(e){const t=typeOf(e);return !!(e&&(e.correct===true||e.correct===false||["HOLD_START","RELEASE_EARLY","HOLD_COMPLETE","WAIT_BROKEN","WAIT_SUCCESS","SLICE","IDLE_START","IDLE_STAGE"].includes(t)||e.ignoredWarning===true||e.special===true));}
    _rememberTap(now){this.tapBurst.push(now);const cutoff=now-2400;while(this.tapBurst.length&&this.tapBurst[0]<cutoff)this.tapBurst.shift();}
    _tapsInWindow(now,ms){const cutoff=now-ms;let n=0;for(let i=this.tapBurst.length-1;i>=0;i--){if(this.tapBurst[i]<cutoff)break;n++;}return n;}
    _profile(){const p=this.profileAccessor()||{};return{rageClickCount:Math.max(0,Number(p.rageClickCount)||0),warningIgnoreCount:Math.max(0,Number(p.warningIgnoreCount)||0),curiosity:clamp01(p.curiosity,.5),patience:clamp01(p.patience,.5),trustsAI:clamp01(p.trustsAI,.5)};}
    _rememberDelivery(v){this.recentDelivery.push(v);if(this.recentDelivery.length>5)this.recentDelivery.shift();}
    _rememberMode(d){this.recentModes.push(d.mode);if(this.recentModes.length>6)this.recentModes.shift();return d;}
  }

  ConversationDirector.MODE=MODE;
  global.ConversationDirector=ConversationDirector;
})(window);
