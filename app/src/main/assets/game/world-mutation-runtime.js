(function(global){
  "use strict";

  const catalog=global.GameWorldCatalog;
  if(!catalog)throw new Error("world-mutation-runtime.js requires world-catalog.js");

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>global.performance&&performance.now?performance.now():Date.now();
  const STAGE_THRESHOLDS=[0,.18,.40,.66,.86];

  function worldDef(id){return catalog.WORLDS[id]||catalog.WORLDS.NEON_RIFT;}
  function ring(g,x,y,r,color,width,alpha){g.circle(x,y,r).stroke({color,width,alpha});}
  function line(g,x1,y1,x2,y2,color,width,alpha){g.moveTo(x1,y1).lineTo(x2,y2).stroke({color,width,alpha});}
  function rect(g,x,y,w,h,color,alpha){g.rect(x,y,w,h).fill({color,alpha});}
  function circle(g,x,y,r,color,alpha){g.circle(x,y,r).fill({color,alpha});}

  class WorldMutationRuntime{
    constructor(app,options){
      const o=options||{};
      this.app=app;
      this.parent=o.parent||app.stage;
      this.onStageChange=typeof o.onStageChange==="function"?o.onStageChange:()=>{};
      this.onRupture=typeof o.onRupture==="function"?o.onRupture:()=>{};
      this.onEpoch=typeof o.onEpoch==="function"?o.onEpoch:()=>{};
      this.rng=typeof o.rng==="function"?o.rng:Math.random;

      this.root=new global.PIXI.Container();this.root.label="world-mutation";this.root.eventMode="none";
      this.atmosphere=new global.PIXI.Graphics();
      this.structure=new global.PIXI.Graphics();
      this.scarsView=new global.PIXI.Graphics();
      this.impulseView=new global.PIXI.Graphics();
      this.root.addChild(this.atmosphere,this.structure,this.scarsView,this.impulseView);
      this.parent.addChild(this.root);

      this.world="NEON_RIFT";
      this.pressure=.08;this.floor=.04;this.stage=0;this.ruptures=0;this.epoch=0;this.totalTaps=0;
      this.rupturesThisEpoch=0;this.nextEpochAt=this._nextEpochTarget();
      this.lastTapAt=0;this.lastTickAt=now();this.lastDrawAt=0;this.lastStageAt=0;
      this.lastImpact={x:0,y:0,at:0,strength:0};
      this.scars=[];this.maxScars=18;
      this.dirtyScars=true;this.dirtyStructure=true;
      this._tickBound=d=>this._tick(d);app.ticker.add(this._tickBound);
      this._drawScars();this._drawDynamic(now());
    }

    destroy(){
      if(this.app&&this.app.ticker)this.app.ticker.remove(this._tickBound);
      if(this.root&&this.root.parent)this.root.parent.removeChild(this.root);
      try{this.root&&this.root.destroy({children:true});}catch(_){}
      this.root=this.atmosphere=this.structure=this.scarsView=this.impulseView=null;
    }

    setWorld(id){
      const next=worldDef(id).id;
      if(next===this.world)return false;
      this.world=next;
      // A world shift is a mutation, not a clean restart. Keep history and a small pressure carry-over.
      this.pressure=clamp(.10+this.pressure*.32+Math.min(.10,this.scars.length*.006),.08,.36);
      this.floor=clamp(.04+Math.min(.16,this.scars.length*.008),.04,.20);
      this.stage=this._stageForPressure(this.pressure);
      this.lastImpact.at=now();this.lastImpact.strength=.55;
      this.dirtyScars=true;this.dirtyStructure=true;
      return true;
    }

    tap(x,y,meta){
      const m=meta||{},t=now(),gap=this.lastTapAt?t-this.lastTapAt:9999;
      this.lastTapAt=t;this.totalTaps++;
      const rapid=gap<330?1:(gap<620?.45:0);
      const streak=clamp(Number(m.streak)||1,1,30),heat=clamp(Number(m.heat)||0,0,1),fomo=clamp(Number(m.fomoProgress)||0,0,1);
      const gain=.012+rapid*.006+Math.min(.006,(streak-1)*.0005)+heat*.004+fomo*.004;
      this.pressure=clamp(this.pressure+gain,0,1.04);
      this.lastImpact={x:Number(x)||0,y:Number(y)||0,at:t,strength:clamp(.28+gain*6+heat*.22,0,1)};
      this._updateStage(t);
      if(this.pressure>=1)this._rupture(this.lastImpact.x,this.lastImpact.y,"pressure");
      return this.context();
    }

    promise(stage,x,y){
      const st=Math.max(1,Number(stage)||1);
      this.lastImpact={x:Number(x)||0,y:Number(y)||0,at:now(),strength:clamp(.28+st*.12,0,1)};
      this.pressure=clamp(this.pressure+(st>=3?.009:.004),0,1.04);
      this._updateStage(now());
      if(this.pressure>=1)this._rupture(this.lastImpact.x,this.lastImpact.y,"promise");
    }

    jackpot(x,y,level){
      const lv=clamp(Number(level)||1,1,4);
      this.lastImpact={x:Number(x)||0,y:Number(y)||0,at:now(),strength:1};
      this.pressure=clamp(this.pressure+.045+lv*.012,0,1.06);
      this._updateStage(now());
      if(this.pressure>=.985)this._rupture(this.lastImpact.x,this.lastImpact.y,"jackpot");
    }

    reset(options){
      const o=options||{};
      this.pressure=.08;this.floor=.04;this.stage=0;this.ruptures=0;this.epoch=0;this.totalTaps=0;
      this.rupturesThisEpoch=0;this.nextEpochAt=this._nextEpochTarget();this.lastTapAt=0;
      this.lastImpact={x:0,y:0,at:0,strength:0};
      if(o.clearScars!==false)this.scars.length=0;
      this.dirtyScars=true;this.dirtyStructure=true;this._drawScars();this._drawDynamic(now());
    }

    targetModulation(timeMs){
      const t=Number(timeMs)||now(),p=this.pressure,stage=this.stage;
      const urgent=stage>=4?1:(stage===3?.55:0);
      return{
        pressure:p,stage,
        scale:1+p*.035+urgent*(.018+Math.sin(t/78)*.012),
        rotation:stage>=3?Math.sin(t/(stage>=4?62:110))*(.010+urgent*.018):0,
        jitter:stage>=4?1.6:(stage===3?.55:0),
        glow:.18+p*.62
      };
    }

    context(){
      return{
        world:this.world,pressure:Math.round(this.pressure*100)/100,stage:this.stage,
        ruptures:this.ruptures,epoch:this.epoch,scars:this.scars.length,
        rupturesUntilWorldShift:Math.max(0,this.nextEpochAt-this.rupturesThisEpoch),
        totalTaps:this.totalTaps
      };
    }

    _nextEpochTarget(){return 2+Math.floor(this.rng()*3);}
    _stageForPressure(p){
      let stage=0;for(let i=1;i<STAGE_THRESHOLDS.length;i++)if(p>=STAGE_THRESHOLDS[i])stage=i;return stage;
    }

    _updateStage(t){
      const next=this._stageForPressure(this.pressure);
      if(next===this.stage)return;
      const previous=this.stage;this.stage=next;this.lastStageAt=t;this.dirtyStructure=true;
      try{this.onStageChange({world:this.world,stage:next,previous,pressure:this.pressure,context:this.context()});}catch(_){}
    }

    _rupture(x,y,reason){
      const t=now(),def=worldDef(this.world);
      this.ruptures++;this.rupturesThisEpoch++;
      this._addScar(x,y,def);
      // Never return to zero: each rupture leaves the next cycle slightly more unstable.
      this.floor=clamp(.055+this.scars.length*.008+Math.min(.08,this.epoch*.018),.05,.23);
      this.pressure=clamp(.16+this.rupturesThisEpoch*.018+this.epoch*.015,.15,.32);
      const previous=this.stage;this.stage=this._stageForPressure(this.pressure);this.lastStageAt=t;
      this.lastImpact={x,y,at:t,strength:1};this.dirtyScars=true;this.dirtyStructure=true;
      const payload={world:this.world,x,y,reason,ruptures:this.ruptures,epoch:this.epoch,pressure:this.pressure,context:this.context()};
      try{this.onRupture(payload);}catch(_){}
      if(previous!==this.stage){try{this.onStageChange({world:this.world,stage:this.stage,previous,pressure:this.pressure,context:this.context()});}catch(_){}}

      if(this.rupturesThisEpoch>=this.nextEpochAt){
        this.epoch++;this.rupturesThisEpoch=0;this.nextEpochAt=this._nextEpochTarget();
        // The old world remains visibly scarred in the shared scar layer after the shift.
        try{this.onEpoch({world:this.world,epoch:this.epoch,x,y,ruptures:this.ruptures,context:this.context()});}catch(_){}
      }
    }

    _addScar(x,y,def){
      const s=this._size(),px=clamp(Number(x)||s.width*.5,18,s.width-18),py=clamp(Number(y)||s.height*.5,18,s.height-18);
      const record={
        world:this.world,x:px,y:py,size:34+this.rng()*58,angle:this.rng()*Math.PI*2,
        seed:this.rng(),accent:def.accent,secondary:def.secondary,age:this.ruptures
      };
      this.scars.push(record);if(this.scars.length>this.maxScars)this.scars.shift();
    }

    _tick(delta){
      const t=now(),dt=Math.min(.05,(Number(delta&&delta.deltaMS)||16.67)/1000),idle=t-this.lastTapAt;
      // Pressure cools after the hand stops, but permanent mutations set a rising floor.
      if(idle>1050&&this.pressure>this.floor){
        const rate=this.stage>=4?.030:(this.stage>=3?.022:.015);
        this.pressure=Math.max(this.floor,this.pressure-rate*dt);
        this._updateStage(t);
      }
      if(this.dirtyScars)this._drawScars();
      // 20fps background animation is enough and avoids redrawing complex geometry at 60fps.
      if(t-this.lastDrawAt>=48||this.dirtyStructure){this.lastDrawAt=t;this._drawDynamic(t);this.dirtyStructure=false;}
    }

    _drawDynamic(t){
      if(!this.atmosphere||!this.structure||!this.impulseView)return;
      const s=this._size(),def=worldDef(this.world),p=this.pressure,stage=this.stage,a=def.accent,b=def.secondary;
      const g=this.atmosphere,k=this.structure,imp=this.impulseView;g.clear();k.clear();imp.clear();
      const pulse=(Math.sin(t/260)+1)*.5,fast=(Math.sin(t/88)+1)*.5;

      if(this.world==="SPRING_BLOOM")this._drawSpring(g,k,s,a,b,p,stage,t,pulse);
      else if(this.world==="SUMMER_STORM")this._drawStorm(g,k,s,a,b,p,stage,t,fast);
      else if(this.world==="AUTUMN_DECAY")this._drawAutumn(g,k,s,a,b,p,stage,t,pulse);
      else if(this.world==="WINTER_FROST")this._drawWinter(g,k,s,a,b,p,stage,t,pulse);
      else if(this.world==="VOID_CHAMBER")this._drawVoid(g,k,s,a,b,p,stage,t,pulse);
      else this._drawNeon(g,k,s,a,b,p,stage,t,fast);

      const age=t-this.lastImpact.at;
      if(age<520&&this.lastImpact.strength>0){
        const q=1-clamp(age/520,0,1),r=18+(1-q)*(55+p*46);
        ring(imp,this.lastImpact.x,this.lastImpact.y,r,a,1.5+p*2,.08+q*.34);
        if(stage>=3)ring(imp,this.lastImpact.x,this.lastImpact.y,r*.58,b,1,.06+q*.20);
      }
    }

    _drawSpring(g,k,s,a,b,p,stage,t,pulse){
      rect(g,0,0,s.width,s.height,a,.018+p*.045);
      const growth=3+stage*2;
      for(let i=0;i<growth;i++){
        const x=s.width*((.11+i*.137+Math.sin(t/1700+i)*.015)%1),y=s.height*(.16+((i*29)%68)/100);
        const r=20+p*36+(i%3)*11;
        circle(k,x,y,r,i%2?a:b,.018+p*.030);
        if(stage>=2){line(k,x,y,x+Math.cos(i*1.7)*r*1.4,y+Math.sin(i*1.2)*r*1.2,a,1+p*1.4,.06+p*.13);}
      }
      if(stage>=3){
        const y=s.height*(.80-p*.10);for(let i=0;i<7;i++)circle(k,s.width*(.08+i*.145),y+Math.sin(t/420+i)*10,8+p*12,i%2?b:a,.10+p*.12);
      }
      if(stage>=4)circle(g,s.width*.5,s.height*.5,Math.max(s.width,s.height)*(.18+p*.18),b,.018+pulse*.028);
    }

    _drawStorm(g,k,s,a,b,p,stage,t,fast){
      rect(g,0,0,s.width,s.height,0x06111f,.08+p*.34);
      const bands=2+stage*2;for(let i=0;i<bands;i++){
        const y=(s.height*((i*.21+(t/9000)*(1+p))%1));rect(k,-s.width*.12,y,s.width*1.24,18+i*4,b,.018+p*.035);
      }
      if(stage>=2){
        const rain=8+stage*7;for(let i=0;i<rain;i++){
          const x=(i*73+t*(.025+p*.04))%Math.max(1,s.width),y=(i*113+t*(.09+p*.10))%Math.max(1,s.height);
          line(k,x,y,x-7-stage*2,y+20+stage*7,b,1,.10+p*.25);
        }
      }
      if(stage>=3&&fast>.78){
        const x=s.width*(.18+((Math.floor(t/600)%5)*.16));line(g,x,0,x-18,s.height*.28,0xffffff,2,.05+p*.18);
      }
      if(stage>=4)rect(g,0,0,s.width,s.height,0xffffff,.008+fast*.025);
    }

    _drawAutumn(g,k,s,a,b,p,stage,t,pulse){
      rect(g,0,0,s.width,s.height,0x120b07,.025+p*.17);
      const branches=3+stage*2;for(let i=0;i<branches;i++){
        const fromLeft=i%2===0,x=fromLeft?0:s.width,y=s.height*(.14+i*.11);
        const len=s.width*(.15+p*.18),dx=fromLeft?len:-len;
        line(k,x,y,x+dx,y-22-Math.sin(i+t/900)*16,a,1.2+p*1.8,.08+p*.18);
        if(stage>=2)line(k,x+dx*.55,y-12,x+dx*.78,y-48,b,1,.06+p*.12);
      }
      if(stage>=2){for(let i=0;i<5+stage*2;i++){
        const x=(i*89+t*.012)%Math.max(1,s.width),y=(i*127+t*.025)%Math.max(1,s.height);
        rect(k,x,y,5+stage,3+stage*.4,i%2?a:b,.07+p*.18);
      }}
      if(stage>=4)circle(g,s.width*.5,s.height*.92,s.width*(.20+p*.12),a,.025+pulse*.035);
    }

    _drawWinter(g,k,s,a,b,p,stage,t,pulse){
      rect(g,0,0,s.width,s.height,0xdff2fb,.025+p*.20);
      const depth=12+p*42;
      for(let i=0;i<5+stage*2;i++){
        const x=s.width*(i/(4+stage*2));
        line(k,x,0,x+Math.sin(i*2.2)*depth,depth+(i%3)*10,a,1,.08+p*.22);
        line(k,x,s.height,x+Math.cos(i*1.7)*depth,s.height-depth-(i%2)*12,b,1,.06+p*.18);
      }
      if(stage>=2){
        const cx=s.width*.5,cy=s.height*.48,r=28+p*56;ring(k,cx,cy,r,a,1,.05+p*.18);
        for(let i=0;i<6;i++){const ang=i/6*Math.PI*2;line(k,cx,cy,cx+Math.cos(ang)*r,cy+Math.sin(ang)*r,b,1,.04+p*.16);}
      }
      if(stage>=4)rect(g,0,0,s.width,s.height,0xffffff,.012+pulse*.022);
    }

    _drawVoid(g,k,s,a,b,p,stage,t,pulse){
      rect(g,0,0,s.width,s.height,0x000000,.12+p*.34);
      const cx=s.width*.5+(this.lastImpact.x-s.width*.5)*p*.12,cy=s.height*.5+(this.lastImpact.y-s.height*.5)*p*.10;
      for(let i=0;i<3+stage;i++)ring(k,cx,cy,32+i*(24+p*16),i%2?a:b,1+i*.15,.04+p*.12);
      const nodes=4+stage*2;for(let i=0;i<nodes;i++){
        const ang=t/1400*(.4+p*.8)+i/nodes*Math.PI*2,r=48+(i%3)*32+p*30;
        circle(k,cx+Math.cos(ang)*r,cy+Math.sin(ang)*r,2+(i%2)*1.5,i%2?a:b,.12+p*.28);
      }
      if(stage>=3)circle(g,cx,cy,18+p*34,0x000000,.35+p*.38);
      if(stage>=4)ring(g,cx,cy,24+pulse*18,0xffffff,1,.04+p*.12);
    }

    _drawNeon(g,k,s,a,b,p,stage,t,fast){
      rect(g,0,0,s.width,s.height,0x050008,.035+p*.22);
      const spacing=Math.max(28,62-stage*7);for(let x=((t*.018)%spacing)-spacing;x<s.width;x+=spacing)line(k,x,0,x,s.height,a,1,.025+p*.08);
      for(let y=((t*.011)%spacing)-spacing;y<s.height;y+=spacing)line(k,0,y,s.width,y,b,1,.018+p*.06);
      if(stage>=2){
        const bars=2+stage*2;for(let i=0;i<bars;i++){
          const y=(i*97+Math.floor(t/90)*23)%Math.max(1,s.height);rect(k,(i%2)*s.width*.18,y,s.width*(.35+p*.35),2+i%3,a,.07+p*.16);
        }
      }
      if(stage>=3&&fast>.68)rect(g,0,s.height*(.18+fast*.55),s.width,2+stage,b,.05+p*.16);
      if(stage>=4)rect(g,0,0,s.width,s.height,a,.006+fast*.015);
    }

    _drawScars(){
      if(!this.scarsView)return;const g=this.scarsView;g.clear();
      for(const s of this.scars){
        if(s.world==="SPRING_BLOOM")this._scarBloom(g,s);
        else if(s.world==="SUMMER_STORM")this._scarLightning(g,s);
        else if(s.world==="AUTUMN_DECAY")this._scarBranch(g,s);
        else if(s.world==="WINTER_FROST")this._scarIce(g,s);
        else if(s.world==="VOID_CHAMBER")this._scarVoid(g,s);
        else this._scarGlitch(g,s);
      }
      this.dirtyScars=false;
    }

    _scarBloom(g,s){
      for(let i=0;i<6;i++){const a=i/6*Math.PI*2+s.angle,r=s.size*.26;circle(g,s.x+Math.cos(a)*r,s.y+Math.sin(a)*r,s.size*.13,i%2?s.accent:s.secondary,.11);}
      circle(g,s.x,s.y,s.size*.10,s.accent,.14);
    }
    _scarLightning(g,s){
      let x=s.x,y=s.y;for(let i=0;i<5;i++){const nx=x+Math.cos(s.angle+i*.72)*s.size*.22,ny=y+Math.sin(s.angle+i*.94)*s.size*.22;line(g,x,y,nx,ny,i%2?s.secondary:s.accent,1.4,.22);x=nx;y=ny;}
    }
    _scarBranch(g,s){
      line(g,s.x-s.size*.45,s.y+s.size*.18,s.x+s.size*.45,s.y-s.size*.18,s.accent,1.6,.17);
      for(let i=0;i<4;i++){const x=s.x-s.size*.25+i*s.size*.18;line(g,x,s.y,x+(i%2?18:-14),s.y-s.size*.28,s.secondary,1,.13);}
    }
    _scarIce(g,s){
      ring(g,s.x,s.y,s.size*.30,s.accent,1.2,.16);for(let i=0;i<6;i++){const a=i/6*Math.PI*2+s.angle;line(g,s.x,s.y,s.x+Math.cos(a)*s.size*.45,s.y+Math.sin(a)*s.size*.45,s.secondary,1,.14);}
    }
    _scarVoid(g,s){
      circle(g,s.x,s.y,s.size*.22,0x000000,.42);ring(g,s.x,s.y,s.size*.34,s.accent,1.4,.16);ring(g,s.x,s.y,s.size*.48,s.secondary,1,.08);
    }
    _scarGlitch(g,s){
      for(let i=0;i<5;i++){const w=s.size*(.20+.12*(i%3)),h=2+(i%2)*3;rect(g,s.x-s.size*.35+(i%2)*s.size*.22,s.y-s.size*.25+i*s.size*.12,w,h,i%2?s.accent:s.secondary,.16);}
    }

    _size(){const s=this.app&&this.app.renderer&&this.app.renderer.screen;return{width:s&&s.width||global.innerWidth||360,height:s&&s.height||global.innerHeight||640};}
  }

  global.WorldMutationRuntime=WorldMutationRuntime;
})(window);
