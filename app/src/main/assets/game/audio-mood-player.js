(function (global) {
  "use strict";

  class AudioMoodPlayer {
    constructor() {
      this.ctx=null;this.enabled=true;this.lastAt=0;this.voiceActive=false;this.activeNodes=new Set();
      this.sensory={audio:1,density:1};
    }
    setSensoryState(state){this.sensory=state||this.sensory;}
    setVoiceActive(active){this.voiceActive=!!active;if(this.voiceActive)this.stopAll();}
    unlock(){
      if(!this.enabled)return;
      if(!this.ctx){const Ctx=global.AudioContext||global.webkitAudioContext;if(!Ctx)return;this.ctx=new Ctx();}
      if(this.ctx.state==="suspended")this.ctx.resume().catch(()=>{});
    }
    stopAll(){
      for(const osc of Array.from(this.activeNodes)){try{osc.stop();}catch(_){}this.activeNodes.delete(osc);}
    }
    play(mood,cue,intensity){
      if(this.voiceActive)return;
      const level=Number(this.sensory&&this.sensory.audio)||0;
      if(level<=0&&cue!=="worldChange")return;
      if(cue==="click"){
        const chance=[0,.42,.68,.8][Math.max(0,Math.min(3,level))]||.4;
        if(Math.random()>chance)return;
      }
      this.unlock();if(!this.ctx||!this.enabled)return;
      const nowMs=performance.now(),minGap=[280,160,100,75][Math.max(0,Math.min(3,level))]||120;
      if(nowMs-this.lastAt<minGap)return;this.lastAt=nowMs;
      const i=Math.max(.04,Math.min(1,Number(intensity)||.4)),spec=this._spec(mood,cue);
      const osc=this.ctx.createOscillator(),gain=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();
      osc.type=spec.type;osc.frequency.setValueAtTime(spec.f0,this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30,spec.f1),this.ctx.currentTime+spec.duration);
      filter.type=spec.filter;filter.frequency.value=spec.cutoff;
      const levelGain=[.4,.65,.85,1][Math.max(0,Math.min(3,level))];
      gain.gain.setValueAtTime(.0001,this.ctx.currentTime);gain.gain.exponentialRampToValueAtTime((.012+i*.03)*levelGain,this.ctx.currentTime+.012);
      gain.gain.exponentialRampToValueAtTime(.0001,this.ctx.currentTime+spec.duration);
      osc.connect(filter);filter.connect(gain);gain.connect(this.ctx.destination);
      this.activeNodes.add(osc);osc.onended=()=>this.activeNodes.delete(osc);
      osc.start();osc.stop(this.ctx.currentTime+spec.duration+.02);
    }
    _spec(mood,cue){
      const pack={
        ORGANIC:{type:"sine",f0:420,f1:620,duration:.17,filter:"lowpass",cutoff:1800},
        STORM:{type:"sawtooth",f0:150,f1:62,duration:.20,filter:"lowpass",cutoff:950},
        DRY:{type:"triangle",f0:310,f1:180,duration:.12,filter:"bandpass",cutoff:1100},
        GLASS:{type:"sine",f0:880,f1:1180,duration:.24,filter:"highpass",cutoff:650},
        COSMIC:{type:"sine",f0:115,f1:58,duration:.34,filter:"lowpass",cutoff:700},
        GLITCH:{type:"square",f0:520,f1:230,duration:.08,filter:"bandpass",cutoff:1600}
      };
      const base=Object.assign({},pack[mood]||pack.GLITCH);
      if(cue==="reveal"){base.f0*=1.1;base.f1*=1.3;base.duration*=1.35;}
      else if(cue==="trap"){base.f0*=.72;base.f1*=.58;}
      else if(cue==="worldChange"){base.duration*=2.1;base.f1*=1.18;}
      return base;
    }
  }
  global.AudioMoodPlayer=AudioMoodPlayer;
})(window);
