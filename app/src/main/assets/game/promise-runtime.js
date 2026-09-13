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
  function line(g,x1,y1,x2,y2,color,width,alpha){g.moveTo(x1,y1).lineTo(x2,y2).stroke({color,width,alpha});}
  function rect(g,x,y,w,h,color,alpha){g.rect(x,y,w,h).fill({color,alpha});}
  function poly(g,pts,color,alpha,strokeColor,strokeWidth,strokeAlpha){
    if(!pts||pts.length<3)return;
    g.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);
    if(typeof g.closePath==="function")g.closePath();
    if(color!=null)g.fill({color,alpha:alpha==null?1:alpha});
    if(strokeColor!=null&&strokeWidth>0)g.stroke({color:strokeColor,width:strokeWidth,alpha:strokeAlpha==null?1:strokeAlpha});
  }
  function diamond(g,x,y,w,h,color,alpha,strokeColor,strokeWidth,strokeAlpha){
    poly(g,[[x,y-h],[x+w,y],[x,y+h],[x-w,y]],color,alpha,strokeColor,strokeWidth,strokeAlpha);
  }
  function shard(g,x,y,size,angle,color,alpha){
    const ca=Math.cos(angle),sa=Math.sin(angle),p=[[0,-size],[size*.48,-size*.18],[size*.18,size],[-size*.38,size*.35]];
    const pts=p.map(([px,py])=>[x+px*ca-py*sa,y+px*sa+py*ca]);poly(g,pts,color,alpha);
  }
  function zigzag(g,x,y,len,amp,angle,segments,color,width,alpha){
    const ca=Math.cos(angle),sa=Math.sin(angle);let px=x-ca*len*.5,py=y-sa*len*.5;g.moveTo(px,py);
    for(let i=1;i<=segments;i++){const q=i/segments,side=i%2?1:-1,along=(q-.5)*len,off=side*amp*(.45+.55*Math.sin(q*Math.PI));const nx=x+ca*along-sa*off,ny=y+sa*along+ca*off;g.lineTo(nx,ny);}
    g.stroke({color,width,alpha});
  }

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
      const x=c.x,y=c.y,ang=c.angle,len=26+p*132,amp=5+p*17,w=1.1+p*3.4;
      // Tear in the surface: layered jagged seams and wedge-shaped depth, no halo.
      zigzag(g,x,y,len,amp,ang,9,d.accent,w,.16+p*.62*a);
      zigzag(g,x+Math.cos(ang+Math.PI/2)*5,y+Math.sin(ang+Math.PI/2)*5,len*.86,amp*.65,ang,8,d.secondary,1+p*1.8,.08+p*.38*a);
      const ca=Math.cos(ang),sa=Math.sin(ang),na=-sa,nb=ca,half=len*.42,open=3+p*14;
      poly(under,[
        [x-ca*half+na*open,y-sa*half+nb*open],
        [x+ca*half+na*open*.55,y+sa*half+nb*open*.55],
        [x+ca*half-na*open*.55,y+sa*half-nb*open*.55],
        [x-ca*half-na*open,y-sa*half-nb*open]
      ],0x000000,.08+p*.34*a);
      if(p>.48){
        for(let i=0;i<3+Math.floor(p*4);i++){
          const q=(i+1)/(4+Math.floor(p*4)),sx=x+ca*(q-.5)*len*.9+na*(i%2?open:-open);
          const sy=y+sa*(q-.5)*len*.9+nb*(i%2?open:-open);
          shard(g,sx,sy,4+p*7,ang+(i%2?1.2:-1.0),i%2?d.secondary:d.accent,.10+p*.34*a);
        }
      }
      if(isReveal){
        poly(reveal,[[x-36,y-8],[x-8,y-28],[x+4,y-12],[x+38,y-34],[x+14,y],[x+42,y+27],[x+5,y+13],[x-20,y+34],[x-10,y+8]],d.accent,.18,d.secondary,2.2,.72);
        for(let i=0;i<7;i++){const aa=ang+(i-3)*.34,l=38+(i%3)*12;line(reveal,x,y,x+Math.cos(aa)*l,y+Math.sin(aa)*l,i%2?d.secondary:d.accent,1.5,.38);}
      }
    }
    _drawAssembly(under,g,reveal,c,d,p,t,a,isReveal){
      const x=c.x,y=c.y,count=4+Math.floor(p*7),reach=54-p*22,rot=t*.0005+c.angle;
      // Mechanical fragments physically closing toward an unfinished symbol.
      for(let i=0;i<count;i++){
        const aa=rot+i/count*Math.PI*2,dist=reach+(i%3)*11,px=x+Math.cos(aa)*dist,py=y+Math.sin(aa)*dist;
        const w=7+p*9,h=3+(i%3)*2;
        const ca=Math.cos(aa),sa=Math.sin(aa);
        poly(g,[[px-ca*w-sa*h,py-sa*w+ca*h],[px+ca*w-sa*h,py+sa*w+ca*h],[px+ca*w+sa*h,py+sa*w-ca*h],[px-ca*w+sa*h,py-sa*w-ca*h]],i%2?d.accent:d.secondary,.10+p*.42*a);
      }
      const size=14+p*28;
      g.moveTo(x-size,y-size*.45).lineTo(x-size,y-size).lineTo(x-size*.45,y-size)
       .moveTo(x+size*.45,y-size).lineTo(x+size,y-size).lineTo(x+size,y-size*.45)
       .moveTo(x+size,y+size*.45).lineTo(x+size,y+size).lineTo(x+size*.45,y+size)
       .moveTo(x-size*.45,y+size).lineTo(x-size,y+size).lineTo(x-size,y+size*.45)
       .stroke({color:d.accent,width:1.4+p*1.5,alpha:.12+p*.5*a});
      if(p>.68)diamond(g,x,y,5+(p-.68)*22,8+(p-.68)*27,d.secondary,.10+p*.4*a,d.accent,1,.3);
      if(isReveal){
        poly(reveal,[[x-34,y-20],[x-8,y-20],[x,y-35],[x+9,y-20],[x+34,y-20],[x+18,y],[x+34,y+20],[x+8,y+20],[x,y+34],[x-9,y+20],[x-34,y+20],[x-18,y]],d.secondary,.22,d.accent,2,.68);
        diamond(reveal,x,y,8,12,d.accent,.88,null,0,0);
      }
    }
    _drawShadow(under,g,reveal,c,d,p,t,a,isReveal){
      const x=c.x,y=c.y,drift=12+30*p,ox=Math.sin(t/340+c.seed*5)*drift,oy=Math.cos(t/410+c.seed*3)*drift*.65;
      const sx=x+ox,sy=y+oy,scale=.55+p*.75;
      // An asymmetric creature-like silhouette, not a soft blob.
      poly(under,[
        [sx,sy-34*scale],[sx+16*scale,sy-20*scale],[sx+11*scale,sy-5*scale],[sx+27*scale,sy+18*scale],
        [sx+8*scale,sy+13*scale],[sx,sy+34*scale],[sx-9*scale,sy+13*scale],[sx-25*scale,sy+20*scale],[sx-12*scale,sy-4*scale],[sx-17*scale,sy-21*scale]
      ],0x000000,.08+p*.26*a,d.accent,1.2,.10+p*.34*a);
      if(p>.38){
        rect(g,sx-11*scale,sy-9*scale,7*scale,2.2*scale,d.secondary,.18+p*.48*a);
        rect(g,sx+5*scale,sy-8*scale,7*scale,2.2*scale,d.secondary,.18+p*.48*a);
      }
      if(p>.70){
        const tx=x-ox*.4,ty=y-oy*.35;
        poly(g,[[tx,ty-11],[tx+8,ty],[tx,ty+13],[tx-7,ty]],null,0,d.secondary,1,.10+p*.24*a);
      }
      if(isReveal){
        poly(reveal,[[sx,sy-42],[sx+28,sy-18],[sx+18,sy+10],[sx+36,sy+32],[sx,sy+24],[sx-35,sy+33],[sx-17,sy+8],[sx-27,sy-18]],d.accent,.20,d.secondary,2.4,.7);
        rect(reveal,sx-16,sy-8,11,3,d.secondary,.75);rect(reveal,sx+5,sy-8,11,3,d.secondary,.75);
      }
    }
    _drawTransform(under,g,reveal,c,d,p,t,a,isReveal){
      const target=this.getTarget&&this.getTarget(),x=target&&Number.isFinite(target.x)?target.x:c.x,y=target&&Number.isFinite(target.y)?target.y:c.y;
      const spikes=4+Math.floor(p*7),inner=22+p*8,outer=34+p*42,rot=c.angle+Math.sin(t/180)*.08*p,pts=[];
      for(let i=0;i<spikes*2;i++){const rr=i%2?inner:outer,aa=rot+i/(spikes*2)*Math.PI*2;pts.push([x+Math.cos(aa)*rr,y+Math.sin(aa)*rr]);}
      poly(under,pts,d.secondary,.014+p*.05*a);
      const outline=pts.slice();poly(g,outline,null,0,d.accent,1.2+p*2.2,.12+p*.48*a);
      if(p>.52){
        for(let i=0;i<Math.min(5,spikes);i++){const aa=rot+i/spikes*Math.PI*2;const sx=x+Math.cos(aa)*outer*.72,sy=y+Math.sin(aa)*outer*.72;shard(g,sx,sy,4+p*5,aa,d.secondary,.12+p*.32*a);}
      }
      if(isReveal){
        const pts2=[];for(let i=0;i<12;i++){const rr=i%2?24:72,aa=rot+i/12*Math.PI*2;pts2.push([x+Math.cos(aa)*rr,y+Math.sin(aa)*rr]);}
        poly(reveal,pts2,d.accent,.12,d.secondary,2,.58);
      }
    }
    _drawEcho(under,g,reveal,c,d,p,t,a,isReveal){
      const x=c.x,y=c.y,count=2+Math.floor(p*5),span=18+p*42;
      for(let i=0;i<count;i++){
        const q=i/Math.max(1,count-1),offset=(q-.5)*span*2,jitter=Math.sin(t/230+i*2.4)*5*p;
        const ex=x+offset,ey=y+jitter+(i%2?8:-7);
        const w=11+p*15,h=7+p*9;
        poly(g,[[ex-w,ey-h],[ex+w*.7,ey-h],[ex+w,ey+h*.25],[ex+w*.2,ey+h],[ex-w,ey+h*.55]],i%2?d.accent:d.secondary,.05+p*.28*a,d.accent,1,.08+p*.26*a);
        if(p>.55)rect(g,ex-w*.55,ey-1,w*.75,2,d.secondary,.12+p*.3*a);
      }
      rect(under,x-span*1.2,y-2,span*2.4,4,d.accent,.012+p*.025*a);
      if(p>.74){
        for(let i=0;i<4;i++){const dx=((i*31+c.seed*43)%68)-34;rect(g,x+dx,y-27+i*15,16+p*34,2+(i%2)*2,i%2?d.accent:d.secondary,.08+p*.24*a);}
      }
      if(isReveal){
        const blocks=[[-44,-22,26,8],[-9,-31,34,11],[19,-8,38,9],[-31,17,31,10],[8,22,27,8]];
        for(let i=0;i<blocks.length;i++){const b=blocks[i];rect(reveal,x+b[0],y+b[1],b[2],b[3],i%2?d.accent:d.secondary,.25+i*.06);}
      }
    }
    _drawFalseCalm(under,g,reveal,c,d,p,t,a,isReveal){
      const x=c.x,y=c.y,blink=.55+.45*Math.sin(t/(120-p*35)),len=22+p*72,gap=2+p*10;
      // A calm seam that looks almost like a rendering defect, then opens.
      line(under,x-len*.62,y+6,x+len*.62,y+6,d.accent,6,.012+p*.025*a);
      line(g,x-len,y,x-gap,y,d.secondary,1+p*1.3,(.06+p*.34*a)*blink);
      line(g,x+gap,y,x+len,y,d.secondary,1+p*1.3,(.06+p*.34*a)*blink);
      if(p>.56){rect(g,x-gap,y-4,gap*2,8,d.accent,.10+p*.38*a);}
      if(p>.78){
        poly(g,[[x-gap*1.4,y-4],[x,y-15-p*9],[x+gap*1.4,y-4],[x+gap*.8,y+8],[x-gap*.8,y+8]],0x000000,.2+p*.35*a,d.accent,1,.24);
      }
      if(isReveal){
        poly(reveal,[[x-58,y-5],[x-18,y-5],[x-4,y-28],[x+7,y-8],[x+58,y-8],[x+22,y+5],[x+5,y+31],[x-9,y+8]],d.secondary,.18,d.accent,2.4,.7);
        rect(reveal,x-7,y-22,14,44,d.accent,.36);
      }
    }
    _drawWorldFlavor(g,c,d,p,t,a,isReveal){
      const x=c.x,y=c.y,world=this.world;
      if(world==="SPRING_BLOOM"){
        const n=2+Math.floor(p*5);
        for(let i=0;i<n;i++){const ang=i/n*Math.PI*2+t*.00025,r=24+p*42,px=x+Math.cos(ang)*r,py=y+Math.sin(ang)*r;diamond(g,px,py,2+p*2,5+p*4,i%2?d.secondary:d.accent,.08+p*.26*a,null,0,0);}
        if(p>.55)g.moveTo(x-35,y+22).bezierCurveTo(x-10,y-8,x+18,y+38,x+42,y-20).stroke({color:d.accent,width:1,alpha:.08+p*.2*a});
      }else if(world==="SUMMER_STORM"){
        if(p>.28){const z=20+p*58;zigzag(g,x,y,z*1.5,8+p*7,-1.0,5,0xffffff,1+p*1.4,.06+p*.28*a);}
      }else if(world==="AUTUMN_DECAY"){
        const n=2+Math.floor(p*4);for(let i=0;i<n;i++){const ang=c.angle+i*.8,l=18+p*44;line(g,x,y,x+Math.cos(ang)*l,y+Math.sin(ang)*l,i%2?d.accent:d.secondary,1,.05+p*.26*a);if(p>.5)shard(g,x+Math.cos(ang)*l,y+Math.sin(ang)*l,4+p*3,ang,i%2?d.secondary:d.accent,.08+p*.2*a);}
      }else if(world==="WINTER_FROST"){
        const n=3+Math.floor(p*4);for(let i=0;i<n;i++){const ang=i/n*Math.PI*2,l=16+p*38;line(g,x+Math.cos(ang)*7,y+Math.sin(ang)*7,x+Math.cos(ang)*l,y+Math.sin(ang)*l,d.secondary,1,.08+p*.28*a);const px=x+Math.cos(ang)*l,py=y+Math.sin(ang)*l;diamond(g,px,py,3+p*2,7+p*3,d.accent,.06+p*.18*a,null,0,0);}
      }else if(world==="VOID_CHAMBER"){
        const w=30+p*46,h=18+p*28;
        poly(g,[[x-w,y],[x-w*.25,y-h],[x+w*.55,y-h*.5],[x+w,y],[x+w*.25,y+h],[x-w*.55,y+h*.5]],null,0,d.secondary,1,.05+p*.22*a);
        if(p>.58)poly(g,[[x-w*.6,y],[x,y-h*.75],[x+w*.6,y],[x,y+h*.75]],0x000000,.08+p*.22*a,d.accent,1,.12);
      }else{
        const n=2+Math.floor(p*5);for(let i=0;i<n;i++){const dx=(i%2?1:-1)*(18+i*7),dy=-28+i*11;rect(g,x+dx,y+dy,8+p*12,2+(i%3),i%2?d.accent:d.secondary,.07+p*.24*a);}
      }
      if(isReveal)rect(g,x-2,y-2,4,4,d.secondary,.8);
    }
    _drawSeedTease(g,seed,d,amount,t){
      const x=seed.x,y=seed.y,a=clamp(amount,0,1),pulse=.65+.35*Math.sin(t/180+seed.seed*4),r=5+a*16;
      if(seed.type==="RIFT")zigzag(g,x,y,r*2.2,3+a*5,seed.angle,5,d.accent,1,.06+a*.28*pulse);
      else if(seed.type==="ECHO"){rect(g,x-r,y-r*.35,r*1.15,r*.7,d.secondary,.06+a*.20);rect(g,x+r*.15,y-r*.2,r*.9,r*.7,d.accent,.05+a*.18);}
      else if(seed.type==="ASSEMBLY"){diamond(g,x-r*.8,y,2+a*2,4+a*3,d.secondary,.05+a*.22,null,0,0);diamond(g,x+r*.7,y+r*.5,2+a*2,4+a*3,d.accent,.05+a*.22,null,0,0);}
      else if(seed.type==="SHADOW"){const dx=Math.sin(t/260)*r*.6;poly(g,[[x+dx,y-r],[x+dx+r*.55,y],[x+dx,y+r],[x+dx-r*.55,y]],0x000000,.04+a*.18,d.secondary,1,.08+a*.18);}
      else if(seed.type==="TRANSFORM"){const pts=[];for(let i=0;i<8;i++){const rr=i%2?r:r*.42,aa=seed.angle+i/8*Math.PI*2;pts.push([x+Math.cos(aa)*rr,y+Math.sin(aa)*rr]);}poly(g,pts,null,0,d.accent,1,.06+a*.22);}
      else{line(g,x-r,y,x-r*.2,y,d.secondary,1,.05+a*.18);line(g,x+r*.2,y,x+r,y,d.secondary,1,.05+a*.18);}
    }
    _rays(g,x,y,count,length,color,alpha){for(let i=0;i<count;i++){const a=i/count*Math.PI*2,l=length*(.65+(i%3)*.12);line(g,x+Math.cos(a)*14,y+Math.sin(a)*14,x+Math.cos(a)*l,y+Math.sin(a)*l,color,1.3,alpha);}}
    _size(){return this.app&&this.app.renderer&&this.app.renderer.screen?this.app.renderer.screen:{width:360,height:640};}
  }

  global.PromiseRuntime=PromiseRuntime;
})(window);
