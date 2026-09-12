(function (global) {
  "use strict";

  class AudioMoodPlayer {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.lastAt = 0;
      this.sensory={audio:1,density:1};
    }

    setSensoryState(state) {
      this.sensory=state||this.sensory;
    }

    unlock() {
      if (!this.enabled) return;
      if (!this.ctx) {
        const Ctx = global.AudioContext || global.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
      }
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    }

    play(mood, cue, intensity) {
      const level=Number(this.sensory&&this.sensory.audio)||0;
      // Silence is a designed state. Ordinary clicks disappear entirely at audio level 0.
      if (level<=0 && cue!=="worldChange") return;
      if (cue==="click") {
        const chance=[0.0,0.48,0.74,0.82][Math.max(0,Math.min(3,level))]||0.4;
        if (Math.random()>chance) return;
      }

      this.unlock();
      if (!this.ctx || !this.enabled) return;
      const nowMs = performance.now();
      const minGap=[260,150,90,70][Math.max(0,Math.min(3,level))]||120;
      if (nowMs - this.lastAt < minGap) return;
      this.lastAt = nowMs;

      const i = Math.max(0.04,Math.min(1,Number(intensity)||0.4));
      const spec = this._spec(mood,cue);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = spec.type;
      osc.frequency.setValueAtTime(spec.f0,this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30,spec.f1),this.ctx.currentTime+spec.duration);
      filter.type = spec.filter;
      filter.frequency.value = spec.cutoff;
      const levelGain=[0.45,0.7,0.9,1][Math.max(0,Math.min(3,level))];
      gain.gain.setValueAtTime(0.0001,this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime((0.012+i*0.031)*levelGain,this.ctx.currentTime+0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001,this.ctx.currentTime+spec.duration);
      osc.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
      osc.start(); osc.stop(this.ctx.currentTime+spec.duration+0.02);
    }

    _spec(mood,cue) {
      const pack = {
        ORGANIC:{type:"sine",f0:420,f1:620,duration:0.17,filter:"lowpass",cutoff:1800},
        STORM:{type:"sawtooth",f0:150,f1:62,duration:0.20,filter:"lowpass",cutoff:950},
        DRY:{type:"triangle",f0:310,f1:180,duration:0.12,filter:"bandpass",cutoff:1100},
        GLASS:{type:"sine",f0:880,f1:1180,duration:0.24,filter:"highpass",cutoff:650},
        COSMIC:{type:"sine",f0:115,f1:58,duration:0.34,filter:"lowpass",cutoff:700},
        GLITCH:{type:"square",f0:520,f1:230,duration:0.08,filter:"bandpass",cutoff:1600}
      };
      const base = Object.assign({},pack[mood]||pack.GLITCH);
      if (cue==="reveal") { base.f0*=1.1; base.f1*=1.3; base.duration*=1.35; }
      else if (cue==="trap") { base.f0*=0.72; base.f1*=0.58; }
      else if (cue==="worldChange") { base.duration*=2.1; base.f1*=1.18; }
      return base;
    }
  }

  global.AudioMoodPlayer = AudioMoodPlayer;
})(window);
