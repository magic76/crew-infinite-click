(function(global){
  "use strict";

  const catalog=global.GameWorldCatalog;
  if(!catalog)throw new Error("promise-runtime.js requires world-catalog.js");

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>global.performance&&performance.now?performance.now():Date.now();
  const PHASES=["SEED","FORMING","TENSION","BETRAYAL","EDGE","REVEAL"];
  const TYPES=["RIFT","ASSEMBLY","SHADOW","TRANSFORM","ECHO","FALSE_CALM"];
  const WORLD_TYPES={
    SPRING_BLOOM:["TRANSFORM","ASSEMBLY","RIFT"],
    SUMMER_STORM:["RIFT","SHADOW","FALSE_CALM"],
    AUTUMN_DECAY:["SHADOW","RIFT","ASSEMBLY"],
    WINTER_FROST:["ASSEMBLY","RIFT","TRANSFORM"],
    VOID_CHAMBER:["RIFT","SHADOW","ECHO"],
    NEON_RIFT:["ECHO","ASSEMBLY","FALSE_CALM"]
  };

  function def(id){return catalog.WORLDS[id]||catalog.WORLDS.NEON_RIFT;}
  function ring(g,x,y,r,color,width,alpha){g.circle(x,y,r).stroke({color,width,alpha});}
  function dot(g,x,y,r,color,alpha){g.circle(x,y,r).fill({color,alpha});}
  function line(g,x1,y1,x2,y2,color,width,alpha){g.moveTo(x1,y1).lineTo(x2,y2).stroke({color,width,alpha});}
  function rect(g,x,y,w,h,color,alpha){g.rect(x,y,w,h).fill({color,alpha});}

  class PromiseRuntime{
    constructor(app,options){
      const o=options||{};
      this.app=app;this.parent=o.parent||app.stage;
      this.getTarget=typeof o.getTarget==="function"?o.getTarget:()=>null;
      this.onPhaseChange=typeof o.onPhaseChange==="function"?o.onPhaseChange:()=>{};
      this.onReveal=typeof o.onReveal==="function"?o.onReveal:()=>{};
      this.onSeed=typeof o.onSeed==="function"?o.onSeed:()=>{};
      this.rng=typeof o.rng==="function"?o.rng:Math.random;

      this.root=new global.PIXI.Container();this.root.label="promise-runtime";this.root.eventMode="none";
      this.under=new global.PIXI.Graphics();
      this.clue=new global.PIXI.Graphics();
      this.revealView=new global.PIXI.Graphics();
      this.nextView=new global.PIXI.Graphics();
      this.root.addChild(this.under,this.clue,this.revealView,this.nextView);this.parent.addChild(this.root);

      this.world="NEON_RIFT";this.current=null;this.next=null;this.preferredNext=null;
      this.chain=0;this.reveals=0;this.totalTaps=0;this.lastTapAt=0;this.lastDrawAt=0;this.betrayalUntil=0;this.revealUntil=0;
      this._tickBound=d=>this._tick(d);app.ticker.add(this._tickBound);
      this._handoff(true);
      this._draw(now());
    }

    destroy(){
      if(this.app&&this.app.ticker)this.app.ticker.remove(this._tickBound);
      if(this.root&&this.root.parent)this.root.parent.removeChild(this.root);
      try{this.root&&this.root.destroy({children:true});}catch(_){}
      this.root=this.under=this.clue=this.revealView=this.nextView=null;
    }

    setWorld(id){
      const nextWorld=def(id).id;if(nextWorld===this.world)return false;
      this.world=nextWorld;
      if(this.current){
        this.current.world=nextWorld;
        // A world mutation transforms the unresolved question instead of erasing it.
        this.current.progress=clamp(Math.max(.14,this.current.progress*.76),.08,.84);
        this.current.phase=Math.min(3,this._phaseFor(this.current.progress));
      }
      if(this.next)this.next.world=nextWorld;
      this.betrayalUntil=0;this.revealUntil=0;
      return true;
    }

    /** AI does not own the promise timeline. It may only bias the NEXT unresolved visual. */
    steer(plan){
      const p=plan||{};let type=null;
      const situation=String(p.situation||"").toUpperCase(),intent=String(p.experienceIntent||"").toUpperCase(),behavior=String(p.targetBehavior||"").toUpperCase();
      if(situation==="REVEAL"||situation==="HIDE"||intent==="SEARCH")type="RIFT";
      else if(situation==="PREDICT")type="ASSEMBLY";
      else if(situation==="MIRROR"||intent==="TRUST_TEST")type="SHADOW";
      else if(situation==="DECOY"||intent==="MISDIRECT")type="ECHO";
      else if(situation==="FAKE_ENDING")type="FALSE_CALM";
      else if(behavior==="PULSE"||intent==="SURPRISE")type="TRANSFORM";
      if(type){this.preferredNext=type;if(this.next&&this.next.progress<.12)this.next.type=type;}
      return type;
    }

    tap(x,y,meta){
      const t=now(),m=meta||{};this.totalTaps++;
      if(!this.current)this._handoff(true);

      // A reveal is allowed to breathe, but the very next committed tap can pull the queued mystery forward.
      if(this.current.phase===5){
        this.current.revealTaps=(this.current.revealTaps||0)+1;
        if(t>=this.revealUntil-170||this.current.revealTaps>=2)this._handoff(false);
        this.lastTapAt=t;return this.context();
      }

      const gap=this.lastTapAt?t-this.lastTapAt:9999;this.lastTapAt=t;
      const rapid=gap<330?1:(gap<650?.38:0),streak=clamp(Number(m.streak)||1,1,30),heat=clamp(Number(m.heat)||0,0,1),pressure=clamp(Number(m.mutationPressure)||0,0,1);
      const difficulty=this.current.difficulty||1;

      if(this.betrayalUntil>t){
        // Pressing into the false calm shortens it. The player learns that continuing matters.
        this.current.betrayTaps=(this.current.betrayTaps||0)+1;
        this.current.progress=clamp(this.current.progress+.018+heat*.008,0,.965);
        this.betrayalUntil-=70+rapid*35;
        if(this.current.betrayTaps>=2)this.betrayalUntil=Math.min(this.betrayalUntil,t+55);
      }else{
        const wobble=.92+this.rng()*.18;
        const gain=(.052+rapid*.016+Math.min(.014,(streak-1)*.001)+heat*.013+pressure*.010)*wobble/difficulty;
        this.current.progress=clamp(this.current.progress+gain,0,1);
      }

      if(this.current.progress>=.62)this._ensureNextSeed();
      this._advancePhase(t,x,y);
      if(this.current.progress>=.995&&this.current.phase!==5)this._reveal(t,x,y);
      return this.context();
    }

    reset(){
      this.current=null;this.next=null;this.preferredNext=null;this.chain=0;this.reveals=0;this.totalTaps=0;this.lastTapAt=0;this.betrayalUntil=0;this.revealUntil=0;
      this._handoff(true);this._draw(now());
    }

    targetModulation(timeMs){
      if(!this.current)return{scale:1,rotation:0,alpha:1,urgency:0};
      const t=Number(timeMs)||now(),p=this.current.progress,phase=this.current.phase,type=this.current.type;
      const urgency=clamp((p-.42)/.58,0,1),beat=Math.sin(t/(phase>=4?70:130));
      let scale=1+urgency*.025,rotation=phase>=3?beat*.008*urgency:0,alpha=1;
      if(type==="TRANSFORM")scale+=p*.045;
      if(type==="ECHO")rotation+=beat*.012*urgency;
      if(this.betrayalUntil>t)alpha=.82+Math.abs(beat)*.06;
      if(phase===5)scale+=.05;
      return{scale,rotation,alpha,urgency};
    }

    context(){
      const c=this.current;
      return{
        world:this.world,type:c?c.type:"NONE",phase:c?PHASES[c.phase]:"NONE",phaseIndex:c?c.phase:0,
        progress:c?Math.round(c.progress*100)/100:0,unresolved:!!c&&c.phase!==5,
        betrayal:!!c&&this.betrayalUntil>now(),nextTease:!!this.next,
        nextType:this.next?this.next.type:"NONE",chain:this.chain,reveals:this.reveals,totalTaps:this.totalTaps
      };
    }

    _phaseFor(p){if(p>=.90)return 4;if(p>=.70)return 3;if(p>=.44)return 2;if(p>=.18)return 1;return 0;}

    _advancePhase(t,x,y){
      if(!this.current)return;
      let next=this._phaseFor(this.current.progress);
      if(next<=this.current.phase)return;
      while(this.current.phase<next){
        const previous=this.current.phase;this.current.phase++;
        if(this.current.phase===3&&this.current.canBetray&&!this.current.betrayed){
          this.current.betrayed=true;this.current.betrayTaps=0;
          this.betrayalUntil=t+250+Math.floor(this.rng()*260);
        }
        const payload=this._payload(x,y,previous);
        try{this.onPhaseChange(payload);}catch(_){}
      }
    }

    _reveal(t,x,y){
      if(!this.current)return;
      const previous=this.current.phase;this.current.phase=5;this.current.progress=1;this.current.revealTaps=0;
      this.betrayalUntil=0;this.revealUntil=t+520+Math.floor(this.rng()*240);this.reveals++;
      this._ensureNextSeed();
      try{this.onPhaseChange(this._payload(x,y,previous));}catch(_){}
      try{this.onReveal(this._payload(x,y,previous));}catch(_){}
    }

    _payload(x,y,previous){
      const c=this.current||{};return{
        world:this.world,type:c.type||"NONE",phase:PHASES[c.phase||0],phaseIndex:c.phase||0,previousPhase:previous,
        progress:c.progress||0,x:Number.isFinite(Number(x))?Number(x):c.x,y:Number.isFinite(Number(y))?Number(y):c.y,
        chain:this.chain,reveals:this.reveals,nextType:this.next?this.next.type:"NONE",context:this.context()
      };
    }

    _handoff(initial){
      const seed=this.next||this._makeSeed();this.next=null;this.current=seed;this.chain+=initial?0:1;
      this.current.progress=initial?.08:Math.max(.055,this.current.progress||.055);this.current.phase=this._phaseFor(this.current.progress);
      this.current.revealTaps=0;this.current.betrayTaps=0;this.betrayalUntil=0;this.revealUntil=0;
      try{this.onSeed(this._payload(this.current.x,this.current.y,0));}catch(_){}
    }

    _ensureNextSeed(){
      if(this.next)return this.next;
      this.next=this._makeSeed(this.current&&this.current.type);
      this.next.progress=.035;
      return this.next;
    }

    _makeSeed(exclude){
      const size=this._size(),choices=(WORLD_TYPES[this.world]||TYPES).filter(x=>x!==exclude),preferred=this.preferredNext;
      let type=preferred&&TYPES.includes(preferred)?preferred:choices[Math.floor(this.rng()*Math.max(1,choices.length))];
      if(!type)type="RIFT";this.preferredNext=null;
      const target=this.getTarget&&this.getTarget();
      const tx=target&&Number.isFinite(target.x)?target.x:size.width*.5,ty=target&&Number.isFinite(target.y)?target.y:size.height*.52;
      let x,y,tries=0;
      do{
        x=size.width*(.16+this.rng()*.68);y=size.height*(.18+this.rng()*.62);tries++;
      }while(tries<5&&Math.hypot(x-tx,y-ty)<Math.min(size.width,size.height)*.18);
      return{
        type,world:this.world,x,y,progress:.04,phase:0,difficulty:.83+this.rng()*.40,seed:this.rng(),angle:this.rng()*Math.PI*2,
        canBetray:type==="FALSE_CALM"||this.rng()<.46,betrayed:false,revealTaps:0,betrayTaps:0
      };
    }

    _tick(){
      const t=now();
      if(this.current&&this.current.phase===5&&t>=this.revealUntil)this._handoff(false);
      if(this.current&&this.betrayalUntil&&t>=this.betrayalUntil){
        this.betrayalUntil=0;this.current.progress=Math.max(.90,this.current.progress);const previous=this.current.phase;this.current.phase=Math.max(4,this.current.phase);
        if(previous!==this.current.phase){try{this.onPhaseChange(this._payload(this.current.x,this.current.y,previous));}catch(_){}}
      }
      // 30fps is enough for the unresolved visual; the tap path never allocates Pixi objects.
      if(t-this.lastDrawAt>=32){this.lastDrawAt=t;this._draw(t);}
    }

    _draw(t){
      if(!this.clue)return;this.under.clear();this.clue.clear();this.revealView.clear();this.nextView.clear();
      const c=this.current;if(!c)return;
      const d=def(this.world),p=c.progress,quiet=this.betrayalUntil>t,alpha=quiet?.13:1;
      this._drawType(this.under,this.clue,this.revealView,c,d,p,t,alpha,c.phase===5);

      // The next unanswered question leaks into the frame BEFORE the current reveal finishes.
      if(this.next&&p>=.62){
        const tease=clamp((p-.62)/.38,0,1)*(c.phase===5?1:.58);
        this._drawSeedTease(this.nextView,this.next,d,tease,t);
      }
    }

    _drawType(under,g,reveal,c,d,p,t,alpha,isReveal){
      if(c.type==="RIFT")this._drawRift(under,g,reveal,c,d,p,t,alpha,isReveal);
      else if(c.type==="ASSEMBLY")this._drawAssembly(under,g,reveal,c,d,p,t,alpha,isReveal);
      else if(c.type==="SHADOW")this._drawShadow(under,g,reveal,c,d,p,t,alpha,isReveal);
      else if(c.type==="TRANSFORM")this._drawTransform(under,g,reveal,c,d,p,t,alpha,isReveal);
      else if(c.type==="ECHO")this._drawEcho(under,g,reveal,c,d,p,t,alpha,isReveal);
      else this._drawFalseCalm(under,g,reveal,c,d,p,t,alpha,isReveal);
      this._drawWorldFlavor(g,c,d,p,t,alpha,isReveal);
    }

    _drawRift(under,g,reveal,c,d,p,t,a,isReveal){
      const len=18+p*112,w=1.2+p*3.2,wiggle=6+p*15,x=c.x,y=c.y,ang=c.angle;
      ring(under,x,y,12+p*58,d.accent,5+p*8,.018+p*.045*a);
      let px=x-Math.cos(ang)*len*.5,py=y-Math.sin(ang)*len*.5;
      for(let i=1;i<=7;i++){
        const q=i/7,nx=x+Math.cos(ang)*(q-.5)*len+Math.cos(ang+Math.PI/2)*Math.sin(i*2.1+c.seed*5)*wiggle,
          ny=y+Math.sin(ang)*(q-.5)*len+Math.sin(ang+Math.PI/2)*Math.sin(i*2.1+c.seed*5)*wiggle;
        line(g,px,py,nx,ny,i%2?d.accent:d.secondary,w,.10+p*.55*a);px=nx;py=ny;
      }
      if(p>.48){ring(g,x,y,7+(p-.48)*24,d.secondary,1.5,.10+(p-.48)*.8*a);dot(g,x,y,2+p*4,d.accent,.16+p*.55*a);}
      if(isReveal){ring(reveal,x,y,26+Math.sin(t/85)*5,d.secondary,3,.72);dot(reveal,x,y,9,d.accent,.85);this._rays(reveal,x,y,8,42,d.accent,.34);}
    }

    _drawAssembly(under,g,reveal,c,d,p,t,a,isReveal){
      const x=c.x,y=c.y,r=25+p*34,count=3+Math.floor(p*9),rot=t*.00045+c.angle;
      ring(under,x,y,r+15,d.accent,7,.018+p*.035*a);
      for(let i=0;i<count;i++){
        const a0=rot+i/12*Math.PI*2,span=.22+.10*p;
        line(g,x+Math.cos(a0-span)*r,y+Math.sin(a0-span)*r,x+Math.cos(a0+span)*r,y+Math.sin(a0+span)*r,i%2?d.accent:d.secondary,1.4+p*1.8,.12+p*.50*a);
        dot(g,x+Math.cos(a0)*r,y+Math.sin(a0)*r,1.8+p*1.8,i%2?d.secondary:d.accent,.18+p*.52*a);
      }
      if(p>.68)ring(g,x,y,8+(p-.68)*35,d.secondary,1.4,.14+p*.34*a);
      if(isReveal){ring(reveal,x,y,r,0xffffff,2,.62);ring(reveal,x,y,r*.48,d.accent,4,.56);dot(reveal,x,y,6,d.secondary,.88);}
    }

    _drawShadow(under,g,reveal,c,d,p,t,a,isReveal){
      const x=c.x,y=c.y,drift=14+28*p,ox=Math.sin(t/340+c.seed*5)*drift,oy=Math.cos(t/410+c.seed*3)*drift*.7;
      dot(under,x+ox,y+oy,18+p*25,d.secondary,.018+p*.040*a);
      ring(g,x+ox,y+oy,13+p*18,d.accent,1.6+p*2,.08+p*.46*a);
      if(p>.42){dot(g,x+ox-7-p*3,y+oy-2,2+p*2,d.secondary,.18+p*.52*a);dot(g,x+ox+7+p*3,y+oy-2,2+p*2,d.secondary,.18+p*.52*a);}
      if(p>.72)ring(g,x-ox*.35,y-oy*.35,8+p*12,d.secondary,1,.08+p*.24*a);
      if(isReveal){ring(reveal,x+ox,y+oy,34,d.secondary,3,.65);dot(reveal,x+ox,y+oy,10,d.accent,.76);}
    }

    _drawTransform(under,g,reveal,c,d,p,t,a,isReveal){
      const target=this.getTarget&&this.getTarget(),x=target&&Number.isFinite(target.x)?target.x:c.x,y=target&&Number.isFinite(target.y)?target.y:c.y;
      const r=32+p*28,pulse=1+Math.sin(t/100)*(.02+p*.08);
      ring(under,x,y,r+14,d.secondary,8,.016+p*.038*a);ring(g,x,y,r*pulse,d.accent,1.4+p*2.6,.10+p*.50*a);
      const spikes=3+Math.floor(p*8);for(let i=0;i<spikes;i++){const ang=i/spikes*Math.PI*2+c.angle,l=8+p*25;line(g,x+Math.cos(ang)*r,y+Math.sin(ang)*r,x+Math.cos(ang)*(r+l),y+Math.sin(ang)*(r+l),i%2?d.secondary:d.accent,1+p*1.4,.08+p*.44*a);}
      if(isReveal){ring(reveal,x,y,r+24,d.secondary,3,.58);this._rays(reveal,x,y,spikes,68,d.accent,.30);}
    }

    _drawEcho(under,g,reveal,c,d,p,t,a,isReveal){
      const x=c.x,y=c.y,count=2+Math.floor(p*5),span=18+p*36;
      for(let i=0;i<count;i++){
        const q=i/Math.max(1,count-1),ang=c.angle+Math.sin(t/520+i)*.35,ex=x+Math.cos(ang)*(q-.5)*span*2,ey=y+Math.sin(ang)*(q-.5)*span*1.2;
        ring(g,ex,ey,10+p*15,i%2?d.accent:d.secondary,1.2+p*1.2,(.05+p*.34*a)*(1-q*.35));
      }
      rect(under,x-span,y-2,span*2,4,d.accent,.012+p*.025*a);
      if(p>.74){for(let i=0;i<3;i++){const jitter=((Math.sin(c.seed*17+i*3.1)+1)*.5)*68;rect(g,x-34+jitter,y-22+i*14,18+p*30,2+i,d.secondary,.08+p*.24*a);}}
      if(isReveal){ring(reveal,x,y,40,d.accent,3,.58);ring(reveal,x,y,20,d.secondary,2,.68);}
    }

    _drawFalseCalm(under,g,reveal,c,d,p,t,a,isReveal){
      const x=c.x,y=c.y,blink=.55+.45*Math.sin(t/(110-p*35));
      ring(under,x,y,18+p*35,d.accent,7,.012+p*.026*a);ring(g,x,y,7+p*19,d.secondary,1+p*1.6,(.06+p*.35*a)*blink);
      if(p>.56)dot(g,x,y,2+p*4,d.accent,.12+p*.44*a);
      if(isReveal){ring(reveal,x,y,54,d.secondary,4,.62);dot(reveal,x,y,13,d.accent,.78);this._rays(reveal,x,y,6,70,d.secondary,.24);}
    }

    _drawWorldFlavor(g,c,d,p,t,a,isReveal){
      const x=c.x,y=c.y,world=this.world;
      if(world==="SPRING_BLOOM"){
        const n=2+Math.floor(p*5);for(let i=0;i<n;i++){const ang=i/n*Math.PI*2+t*.0003,r=24+p*38;dot(g,x+Math.cos(ang)*r,y+Math.sin(ang)*r,2+p*2,i%2?d.secondary:d.accent,.08+p*.28*a);}
      }else if(world==="SUMMER_STORM"){
        if(p>.35){const z=22+p*55;line(g,x-z,y-24,x+z*.2,y+6,0xffffff,1+p*1.2,.05+p*.25*a);line(g,x+z*.2,y+6,x-z*.1,y+34,d.accent,1+p*1.4,.06+p*.30*a);}
      }else if(world==="AUTUMN_DECAY"){
        const n=2+Math.floor(p*4);for(let i=0;i<n;i++){const ang=c.angle+i*.8;line(g,x,y,x+Math.cos(ang)*(16+p*40),y+Math.sin(ang)*(12+p*32),i%2?d.accent:d.secondary,1,.05+p*.26*a);}
      }else if(world==="WINTER_FROST"){
        const n=3+Math.floor(p*5);for(let i=0;i<n;i++){const ang=i/n*Math.PI*2,l=14+p*35;line(g,x+Math.cos(ang)*8,y+Math.sin(ang)*8,x+Math.cos(ang)*l,y+Math.sin(ang)*l,d.secondary,1,.08+p*.28*a);}
      }else if(world==="VOID_CHAMBER"){
        ring(g,x,y,38+p*32,d.secondary,1,.05+p*.20*a);if(p>.58)ring(g,x,y,58+p*22,d.accent,1,.04+p*.16*a);
      }else{
        const n=2+Math.floor(p*5);for(let i=0;i<n;i++){const dx=(i%2?1:-1)*(18+i*7),dy=-28+i*11;rect(g,x+dx,y+dy,8+p*12,2+(i%3),i%2?d.accent:d.secondary,.07+p*.24*a);}
      }
      if(isReveal)dot(g,x,y,2,d.secondary,.8);
    }

    _drawSeedTease(g,seed,d,amount,t){
      const x=seed.x,y=seed.y,a=clamp(amount,0,1),pulse=.65+.35*Math.sin(t/180+seed.seed*4),r=5+a*13;
      ring(g,x,y,r,d.secondary,1,.05+a*.24*pulse);dot(g,x,y,1.5+a*1.5,d.accent,.08+a*.30);
      if(seed.type==="RIFT")line(g,x-r*.6,y-r*.35,x+r*.55,y+r*.4,d.accent,1,.05+a*.22);
      else if(seed.type==="ECHO")ring(g,x+r*.9,y-r*.4,r*.55,d.accent,1,.04+a*.16);
      else if(seed.type==="ASSEMBLY"){dot(g,x+r,y,2,d.secondary,.05+a*.20);dot(g,x-r*.6,y+r*.7,2,d.accent,.05+a*.20);}
      else if(seed.type==="SHADOW")dot(g,x+Math.sin(t/260)*r*.6,y,3,d.secondary,.04+a*.18);
    }

    _rays(g,x,y,count,length,color,alpha){for(let i=0;i<count;i++){const a=i/count*Math.PI*2,l=length*(.65+(i%3)*.12);line(g,x+Math.cos(a)*14,y+Math.sin(a)*14,x+Math.cos(a)*l,y+Math.sin(a)*l,color,1.3,alpha);}}
    _size(){return this.app&&this.app.renderer&&this.app.renderer.screen?this.app.renderer.screen:{width:360,height:640};}
  }

  global.PromiseRuntime=PromiseRuntime;
})(window);
