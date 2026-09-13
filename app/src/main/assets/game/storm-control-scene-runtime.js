(function(global){
  "use strict";
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const now=()=>global.performance&&performance.now?performance.now():Date.now();
  const PHASES=["DORMANT","CHARGING","INSTABILITY","FALSE_CALM","REROUTE","BREACH_HINT","PARTIAL_REVEAL"];

  function poly(g,pts,fill,alpha,stroke,width,strokeAlpha){
    if(!g||!pts||pts.length<3)return;
    g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);
    if(g.closePath)g.closePath();
    if(fill!=null)g.fill({color:fill,alpha:alpha==null?1:alpha});
    if(stroke!=null&&width>0)g.stroke({color:stroke,width,alpha:strokeAlpha==null?1:strokeAlpha});
  }
  function rect(g,x,y,w,h,color,alpha){g.rect(x,y,w,h).fill({color,alpha});}
  function line(g,x1,y1,x2,y2,color,width,alpha){g.moveTo(x1,y1).lineTo(x2,y2).stroke({color,width,alpha});}

  class StormControlSceneRuntime{
    constructor(app,options){
      const o=options||{};this.app=app;this.parent=o.parent||app.stage;
      this.onPhaseChange=typeof o.onPhaseChange==="function"?o.onPhaseChange:()=>{};
      this.onReveal=typeof o.onReveal==="function"?o.onReveal:()=>{};
      this.rng=typeof o.rng==="function"?o.rng:Math.random;

      this.root=new global.PIXI.Container();this.root.label="storm-control-room";this.root.eventMode="none";
      this.backdrop=new global.PIXI.Graphics();this.structure=new global.PIXI.Graphics();this.cables=new global.PIXI.Graphics();
      this.props=new global.PIXI.Graphics();this.nodes=new global.PIXI.Graphics();this.atmosphere=new global.PIXI.Graphics();this.flash=new global.PIXI.Graphics();
      this.root.addChild(this.backdrop,this.structure,this.cables,this.props,this.nodes,this.atmosphere,this.flash);
      this.parent.addChild(this.root);

      this.phase="DORMANT";this.phaseStartedAt=now();this.sessionStartedAt=now();this.lastTapAt=0;this.totalTaps=0;this.phaseTaps=0;
      this.charge=.06;this.overload=0;this.breach=.02;this.nodeCharge=[0,0,0];this.routeVariety=0;this.lastNode=-1;
      this.falseCalmUsed=false;this.falseCalmTap=false;this.reveals=0;this.cycle=0;this.aiFocus="DOOR";
      this.lightningAt=now()+900+this.rng()*1200;this.lightningUntil=0;this.silhouetteUntil=0;this.lastZone="NONE";
      this._layout=null;this._lastDraw=0;this._dirty=true;
      this._tickBound=d=>this._tick(d);app.ticker.add(this._tickBound);this.resize();
    }

    destroy(){if(this.app&&this.app.ticker)this.app.ticker.remove(this._tickBound);try{this.root.destroy({children:true});}catch(_){} }

    reset(){
      this.phase="DORMANT";this.phaseStartedAt=now();this.sessionStartedAt=now();this.lastTapAt=0;this.totalTaps=0;this.phaseTaps=0;
      this.charge=.06;this.overload=0;this.breach=.02;this.nodeCharge=[0,0,0];this.routeVariety=0;this.lastNode=-1;
      this.falseCalmUsed=false;this.falseCalmTap=false;this.reveals=0;this.cycle=0;this.aiFocus="DOOR";this.lastZone="NONE";
      this.lightningAt=now()+800+this.rng()*1100;this.lightningUntil=0;this.silhouetteUntil=0;this._dirty=true;this._draw(now());
    }

    resize(){const s=this.app.renderer.screen,w=s.width,h=s.height;
      this._layout={
        width:w,height:h,
        window:{x:w*.075,y:h*.075,w:w*.43,h:h*.205},
        door:{x:w*.605,y:h*.07,w:w*.315,h:h*.36},
        core:{x:w*.18,y:h*.37,w:w*.64,h:h*.245,cx:w*.5,cy:h*.492},
        console:{x:w*.075,y:h*.705,w:w*.85,h:h*.205},
        nodes:[
          {x:w*.10,y:h*.755,w:w*.235,h:h*.105,cx:w*.217,cy:h*.807},
          {x:w*.3825,y:h*.755,w:w*.235,h:h*.105,cx:w*.5,cy:h*.807},
          {x:w*.665,y:h*.755,w:w*.235,h:h*.105,cx:w*.782,cy:h*.807}
        ]
      };this._dirty=true;this._draw(now());
    }

    context(){
      return {scene:"STORM_CONTROL_ROOM",phase:this.phase,charge:+this.charge.toFixed(2),overload:+this.overload.toFixed(2),breach:+this.breach.toFixed(2),
        nodeCharge:this.nodeCharge.map(v=>+v.toFixed(2)),reveals:this.reveals,cycle:this.cycle,lastZone:this.lastZone,aiFocus:this.aiFocus,
        unresolved:this.phase!=="PARTIAL_REVEAL"||this.breach<.96,voiceEnabled:false};
    }

    steer(plan){
      const p=plan||{},s=String(p.situation||"").toUpperCase(),intent=String(p.experienceIntent||"").toUpperCase();
      if(s==="HIDE"||s==="MIRROR"||intent==="SEARCH")this.aiFocus="WINDOW";
      else if(s==="DECOY"||s==="PREDICT")this.aiFocus="NODES";
      else if(s==="CHASE"||s==="REVEAL"||intent==="SURPRISE")this.aiFocus="DOOR";
      else this.aiFocus="CABLES";
      this._dirty=true;
    }

    targetPresentation(){
      const l=this._layout;if(!l)return{visible:true,x:0,y:0,alpha:1,scale:1};
      if(this.phase==="FALSE_CALM")return{visible:true,x:l.core.cx,y:l.core.cy,alpha:.22,scale:.94};
      if(this.phase==="REROUTE"||this.phase==="BREACH_HINT"||this.phase==="PARTIAL_REVEAL")return{visible:false,x:l.core.cx,y:l.core.cy,alpha:0,scale:1};
      return{visible:true,x:l.core.cx,y:l.core.cy,alpha:1,scale:1+this.overload*.05};
    }

    tap(x,y,meta){
      const t=now(),gap=this.lastTapAt?t-this.lastTapAt:9999,rapid=gap<260?1:(gap<520?.45:0);this.lastTapAt=t;this.totalTaps++;this.phaseTaps++;
      const zone=this._zoneAt(x,y);this.lastZone=zone;const heat=clamp(Number(meta&&meta.heat)||0,0,1);
      if(this.phase==="DORMANT")this._setPhase("CHARGING","first_touch");

      if(this.phase==="CHARGING"){
        const core=zone==="CORE"?1:.38;this.charge=clamp(this.charge+.020*core+.010*rapid+.004*heat,0,1);
        this.overload=clamp(this.overload+.004+this.charge*.004,0,1);
        if(this.charge>=.62&&this.totalTaps>=8)this._setPhase("INSTABILITY","charged");
      }else if(this.phase==="INSTABILITY"){
        const core=zone==="CORE"?1:.55;this.charge=clamp(this.charge+.008*core,0,1);
        this.overload=clamp(this.overload+.018*core+.014*rapid+.006*heat,0,1);
        if(zone==="DOOR"||zone==="WINDOW")this.breach=clamp(this.breach+.012,0,1);
        if(this.overload>=.89&&!this.falseCalmUsed){this.falseCalmUsed=true;this._setPhase("FALSE_CALM","overload_peak");}
      }else if(this.phase==="FALSE_CALM"){
        this.falseCalmTap=true;this.overload=clamp(this.overload+.018,0,1);
        if(t-this.phaseStartedAt>520)this._setPhase("REROUTE","player_reengaged");
      }else if(this.phase==="REROUTE"){
        const idx=this._nodeIndex(zone);if(idx>=0){
          const variety=this.lastNode>=0&&this.lastNode!==idx?1:0;this.routeVariety+=variety;this.lastNode=idx;
          this.nodeCharge[idx]=clamp(this.nodeCharge[idx]+.115+.045*rapid+.025*variety,0,1);
          if(idx===0)this.charge=clamp(this.charge+.012,0,1);
          if(idx===1)this.overload=clamp(this.overload+.022,0,1);
          if(idx===2)this.breach=clamp(this.breach+.045,0,1);
        }else if(zone==="DOOR")this.breach=clamp(this.breach+.018,0,1);
        const route=(this.nodeCharge[0]+this.nodeCharge[1]+this.nodeCharge[2])/3;
        if(route>=.63&&this.routeVariety>=2)this._setPhase("BREACH_HINT","reroute_complete");
      }else if(this.phase==="BREACH_HINT"){
        const idx=this._nodeIndex(zone);if(idx>=0){
          this.nodeCharge[idx]=clamp(this.nodeCharge[idx]+.08+.03*rapid,0,1);
          this.breach=clamp(this.breach+(idx===2?.075:.032),0,1);
        }else if(zone==="DOOR")this.breach=clamp(this.breach+.065+.02*rapid,0,1);
        else if(zone==="WINDOW"){this.silhouetteUntil=t+520;this.breach=clamp(this.breach+.025,0,1);}
        if(this.breach>=.84)this._setPhase("PARTIAL_REVEAL","door_breach");
      }else if(this.phase==="PARTIAL_REVEAL"){
        if(zone==="DOOR"||zone==="WINDOW")this.breach=clamp(this.breach+.018,0,1);
        if(this.phaseTaps>=9){
          this.reveals++;this.cycle++;try{this.onReveal({scene:"STORM_CONTROL_ROOM",reveals:this.reveals,cycle:this.cycle,x,y,context:this.context()});}catch(_){}
          this.nodeCharge=this.nodeCharge.map(v=>Math.max(.08,v*.22));this.routeVariety=0;this.lastNode=-1;this.breach=clamp(.30+this.reveals*.07,.30,.62);
          this.overload=.52;this.charge=.78;this._setPhase("REROUTE","next_cycle");
        }
      }
      this._maybeLightning(t,rapid||this.overload>.7);this._dirty=true;return Object.assign({zone,rapid:!!rapid},this.context());
    }

    _setPhase(next,reason){
      if(!PHASES.includes(next)||next===this.phase)return;const previous=this.phase;this.phase=next;this.phaseStartedAt=now();this.phaseTaps=0;
      if(next==="PARTIAL_REVEAL")this.silhouetteUntil=this.phaseStartedAt+1400;
      try{this.onPhaseChange({scene:"STORM_CONTROL_ROOM",phase:next,previous,reason,context:this.context()});}catch(_){}this._dirty=true;
    }
    _nodeIndex(zone){return zone==="NODE_L"?0:(zone==="NODE_C"?1:(zone==="NODE_R"?2:-1));}
    _zoneAt(x,y){const l=this._layout;if(!l)return"NONE";const inside=r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
      for(let i=0;i<l.nodes.length;i++)if(inside(l.nodes[i]))return["NODE_L","NODE_C","NODE_R"][i];
      if(inside(l.core))return"CORE";if(inside(l.door))return"DOOR";if(inside(l.window))return"WINDOW";return"WALL";}

    _maybeLightning(t,force){if((force&&t>this.lightningAt-420)||t>=this.lightningAt){
      this.lightningUntil=t+80+this.rng()*100;this.lightningAt=t+900+this.rng()*2200;
      if(this.phase==="INSTABILITY"||this.phase==="BREACH_HINT"||this.phase==="PARTIAL_REVEAL")this.silhouetteUntil=t+240+this.rng()*260;
    }}

    _tick(delta){const t=now();if(this.phase==="FALSE_CALM"&&this.falseCalmTap&&t-this.phaseStartedAt>680)this._setPhase("REROUTE","false_calm_done");
      if(t>=this.lightningAt)this._maybeLightning(t,false);if(this._dirty||t-this._lastDraw>40){this._lastDraw=t;this._draw(t);this._dirty=false;}}

    _draw(t){if(!this._layout)return;const l=this._layout,w=l.width,h=l.height;
      const bg=this.backdrop,st=this.structure,cb=this.cables,pr=this.props,nd=this.nodes,at=this.atmosphere,fl=this.flash;
      bg.clear();st.clear();cb.clear();pr.clear();nd.clear();at.clear();fl.clear();
      const calm=this.phase==="FALSE_CALM",p=clamp(this.overload*.72+this.charge*.28,0,1),doorGlow=clamp(this.breach,0,1);
      rect(bg,0,0,w,h,0x06101b,1);rect(bg,0,0,w,h,0x0b1b2b,.35+p*.12);
      // wall paneling / industrial depth
      for(let i=0;i<6;i++){const y=h*(.05+i*.155);rect(bg,w*.025,y,w*.95,2,0x5d7991,.07);}
      for(let i=0;i<5;i++){const x=w*(.04+i*.235);rect(bg,x,h*.03,2,h*.64,0x4f667b,.045);}
      // observation window
      const vw=l.window;rect(st,vw.x-8,vw.y-8,vw.w+16,vw.h+16,0x182b39,.94);rect(st,vw.x,vw.y,vw.w,vw.h,0x061827,.98);
      for(let i=0;i<3;i++)rect(st,vw.x+vw.w*(i+1)/4,vw.y,2,vw.h,0x6d879a,.20);
      rect(st,vw.x,vw.y+vw.h*.76,vw.w,2,0x6d879a,.18);
      // rain behind glass
      for(let i=0;i<17;i++){const rx=vw.x+((i*37+t*.035)%vw.w),ry=vw.y+((i*71+t*.12)%vw.h);line(pr,rx,ry,rx-6,ry+18,0x69b9e8,1,.12+p*.12);}
      // outside silhouette, only glimpsed
      if(t<this.silhouetteUntil||this.phase==="PARTIAL_REVEAL"){
        const a=this.phase==="PARTIAL_REVEAL"?.22:.10;poly(pr,[[vw.x+vw.w*.53,vw.y+vw.h*.23],[vw.x+vw.w*.67,vw.y+vw.h*.33],[vw.x+vw.w*.71,vw.y+vw.h*.68],[vw.x+vw.w*.58,vw.y+vw.h*.83],[vw.x+vw.w*.45,vw.y+vw.h*.61]],0x0a0d12,a,0x8bd9ff,1,.12);
        line(pr,vw.x+vw.w*.56,vw.y+vw.h*.43,vw.x+vw.w*.63,vw.y+vw.h*.43,0x9fe8ff,2,.18);
      }
      // heavy breach door
      const d=l.door,gap=clamp(4+this.breach*26+(this.phase==="PARTIAL_REVEAL"?10:0),4,46),cx=d.x+d.w*.5;
      rect(st,d.x-7,d.y-7,d.w+14,d.h+14,0x172631,.98);rect(st,d.x,d.y,d.w*.5-gap*.5,d.h,0x253743,1);rect(st,cx+gap*.5,d.y,d.w*.5-gap*.5,d.h,0x253743,1);
      for(let i=0;i<5;i++){const yy=d.y+18+i*(d.h-36)/4;line(st,d.x+8,yy,cx-gap*.5-7,yy,0x6a7c87,1,.15);line(st,cx+gap*.5+7,yy,d.x+d.w-8,yy,0x6a7c87,1,.15);}
      rect(st,cx-gap*.5,d.y,gap,d.h,0x02070c,.94);if(gap>12)rect(st,cx-gap*.5,d.y,gap,6,0x69b9e8,.12+doorGlow*.12);
      // door locks / warning lamps
      for(const yy of [d.y+d.h*.24,d.y+d.h*.74]){rect(pr,d.x-13,yy-7,8,14,0x381315,1);rect(pr,d.x-12,yy-6,6,12,0xff3b3b,.18+.62*doorGlow);}
      if(this.phase==="PARTIAL_REVEAL"){poly(pr,[[cx-gap*.22,d.y+d.h*.26],[cx+gap*.18,d.y+d.h*.35],[cx+gap*.22,d.y+d.h*.74],[cx-gap*.18,d.y+d.h*.66]],0x0a0d10,.88,0x7ed7ff,1.4,.24);}
      // central core housing
      const c=l.core;rect(st,c.x,c.y,c.w,c.h,0x132331,.98);poly(st,[[c.x+12,c.y+12],[c.x+c.w-12,c.y+12],[c.x+c.w,c.y+30],[c.x+c.w,c.y+c.h-18],[c.x+c.w-20,c.y+c.h],[c.x+18,c.y+c.h],[c.x,c.y+c.h-22],[c.x,c.y+30]],0x182d3c,.74,0x557184,1.5,.22);
      // physical bus bars, becoming energized segment by segment
      const busY=c.y+c.h*.72;for(let i=0;i<7;i++){const x=c.x+18+i*(c.w-36)/7,lit=this.charge>(i+1)/8;rect(cb,x,busY,(c.w-42)/8,5,lit?0xf7db61:0x38505f,lit?.26+.30*p:.15);}
      // cable routes to door and console
      const cableColor=calm?0x48535c:0x69b9e8,cableAlpha=.12+.26*p;
      line(cb,c.cx,c.y+c.h,c.cx,h*.69,cableColor,4,cableAlpha);line(cb,c.x+c.w*.78,c.y+c.h*.25,d.x-7,d.y+d.h*.55,cableColor,3,cableAlpha);
      line(cb,c.x+c.w*.22,c.y+c.h*.25,vw.x+vw.w,vw.y+vw.h*.55,cableColor,2,cableAlpha*.8);
      // sparks / arcing around stressed routes
      if(this.phase==="INSTABILITY"||this.phase==="BREACH_HINT"||this.phase==="PARTIAL_REVEAL"){
        const sx=c.x+c.w*.77,sy=c.y+c.h*.23,j=Math.sin(t/73)*8;line(at,sx,sy,sx+12,sy-10+j,0xbcecff,1.5,.28+p*.35);line(at,sx+12,sy-10+j,sx+20,sy+4,0xf7db61,1,.20+p*.25);
      }
      // lower control console
      const co=l.console;poly(st,[[co.x,co.y+18],[co.x+18,co.y],[co.x+co.w-18,co.y],[co.x+co.w,co.y+18],[co.x+co.w-8,co.y+co.h],[co.x+8,co.y+co.h]],0x101e29,.98,0x527086,1.5,.24);
      for(let i=0;i<3;i++){const n=l.nodes[i],q=this.nodeCharge[i];
        const active=this.phase==="REROUTE"||this.phase==="BREACH_HINT"||this.phase==="PARTIAL_REVEAL";
        poly(nd,[[n.x,n.y+n.h*.18],[n.x+n.w*.12,n.y],[n.x+n.w*.88,n.y],[n.x+n.w,n.y+n.h*.18],[n.x+n.w*.92,n.y+n.h],[n.x+n.w*.08,n.y+n.h]],active?0x173140:0x101b23,.98,active?0x69b9e8:0x425a6a,1.4,active?.34:.16);
        const bars=4;for(let b=0;b<bars;b++){const lit=q>(b+.35)/bars;rect(nd,n.x+n.w*.15+b*n.w*.18,n.y+n.h*.36,n.w*.11,n.h*.27,lit?(i===1?0xf7db61:0x69b9e8):0x2d414e,lit?.48:.18);}
        if(active&&i===2&&this.breach>.45)rect(nd,n.x+n.w*.12,n.y+n.h*.76,n.w*.76,3,0xff5555,.18+.34*this.breach);
      }
      // warning stripes / scene props
      for(let i=0;i<7;i++){const x=w*.05+i*w*.13;poly(pr,[[x,h*.93],[x+w*.06,h*.93],[x+w*.035,h*.965],[x-w*.025,h*.965]],i%2?0x1a2228:0xd7b83d,i%2?.7:.38,null,0,0);}
      // false calm blacks out everything except door lock
      if(calm)rect(fl,0,0,w,h,0x000000,.72);
      if(t<this.lightningUntil&&!calm)rect(fl,0,0,w,h,0xe8f7ff,.055+.08*p);
      // steam foreground, not circular blobs
      const steam=(this.phase==="INSTABILITY"||this.phase==="BREACH_HINT"||this.phase==="PARTIAL_REVEAL")?5:2;
      for(let i=0;i<steam;i++){const x=w*(.12+i*.19),y=h*(.66+Math.sin(t/800+i)*.02);line(at,x,y,x+8+Math.sin(t/300+i)*7,y-34,0xa8c2cf,3,.025+.035*p);}
    }
  }
  StormControlSceneRuntime.PHASES=PHASES;
  global.StormControlSceneRuntime=StormControlSceneRuntime;
})(window);
