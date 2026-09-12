(function (global) {
  "use strict";
  const C=global.ExperiencePrimitiveCatalog;
  if(!C) throw new Error("experience-composer.js requires primitive-catalog.js");

  const WEIGHT={interaction:3,spatial:2,reveal:2,camera:1,surface:2,timing:1};
  const DEFAULT={interaction:"TAP",spatial:"NONE",reveal:"NONE",camera:"STATIC",surface:"NONE",timing:"SNAP"};

  function pick(arr,rng,avoid){
    let p=(arr||[]).filter(x=>x!==avoid); if(!p.length)p=(arr||[]).slice();
    return p.length?p[Math.floor(rng()*p.length)]:null;
  }
  function copy(o){ return Object.assign({},DEFAULT,o||{}); }

  class ExperienceComposer {
    constructor(options){
      const o=options||{}; this.rng=typeof o.rng==="function"?o.rng:Math.random;
      this.history=[]; this.maxHistory=Number(o.maxHistory)||6; this.minNovelty=Number(o.minNovelty)||5;
    }

    compose(request,context){
      const ctx=context||{}, world=ctx.world||"NEON_RIFT";
      let c=this._sanitize(request,world);
      c=this._repairCompatibility(c,ctx);
      let novelty=this.noveltyScore(c);
      if(this.history.length&&novelty<this.minNovelty){
        c=this._diversify(c,world,ctx);
        c=this._repairCompatibility(c,ctx);
        novelty=this.noveltyScore(c);
      }
      const complexity=this._complexity(c);
      const result={...c,noveltyScore:novelty,complexity};
      this.history.push(result); if(this.history.length>this.maxHistory)this.history.shift();
      return result;
    }

    noveltyScore(candidate){
      if(!this.history.length)return 10;
      let best=Infinity;
      for(const prev of this.history.slice(-4)){
        let d=0; for(const k of Object.keys(WEIGHT)) if(candidate[k]!==prev[k]) d+=WEIGHT[k];
        best=Math.min(best,d);
      }
      return best===Infinity?10:best;
    }

    contextForAi(){
      return {recentCompositions:this.history.slice(-4).map(x=>({interaction:x.interaction,spatial:x.spatial,reveal:x.reveal,camera:x.camera,surface:x.surface,timing:x.timing})),minNoveltyScore:this.minNovelty,instruction:"Choose a coherent combination that differs in at least 2 meaningful dimensions from recent compositions. Do not maximize every dimension at once."};
    }

    _sanitize(req,world){
      const r=req||{}, out=copy();
      out.interaction=C.isAllowed("interaction",r.interaction)?r.interaction:"TAP";
      for(const dim of ["spatial","reveal","camera","surface","timing"]){
        const pool=C.worldPool(world,dim); out[dim]=pool.includes(r[dim])?r[dim]:(pool[0]||DEFAULT[dim]);
      }
      return out;
    }

    _repairCompatibility(c,ctx){
      const out=copy(c);
      // Precision interactions need a stable enough camera/surface.
      if(out.interaction==="SLICE" && out.camera==="FOLLOW") out.camera="STATIC";
      if(out.interaction==="HOLD" && out.surface==="FRAGMENT") out.surface="NONE";
      if(out.interaction==="DRAG" && out.spatial==="PUSH_AWAY") out.spatial="NONE";
      // Fog + blackout are redundant; reveal is a single dimension, so BLACKOUT with FRAGMENT gets simplified on low density.
      const density=Number(ctx&&ctx.density);
      if(density<=1 && out.reveal==="BLACKOUT" && out.surface==="FRAGMENT") out.surface="NONE";
      // Keep active complexity bounded. NONE/STATIC/SNAP are cheap.
      while(this._complexity(out)>4){
        if(out.surface!=="NONE") out.surface="NONE";
        else if(out.camera!=="STATIC") out.camera="STATIC";
        else if(out.spatial!=="NONE") out.spatial="NONE";
        else break;
      }
      return out;
    }

    _diversify(c,world,ctx){
      const out=copy(c);
      const last=this.history[this.history.length-1]||{};
      const dimensions=["interaction","spatial","reveal","camera","surface","timing"];
      // Change the highest-value dimensions first, then one secondary dimension.
      const ranked=dimensions.slice().sort((a,b)=>WEIGHT[b]-WEIGHT[a]);
      let changed=0;
      for(const dim of ranked){
        const pool=dim==="interaction"?C.DIMENSIONS.interaction:C.worldPool(world,dim);
        const avoid=last[dim]||out[dim]; const next=pick(pool,this.rng,avoid);
        if(next&&next!==out[dim]){out[dim]=next;changed++;}
        if(changed>=3 || this.noveltyScore(out)>=this.minNovelty)break;
      }
      return out;
    }

    _complexity(c){
      let n=0;
      if(c.interaction!=="TAP")n++;
      if(c.spatial!=="NONE")n++;
      if(c.reveal!=="NONE")n++;
      if(c.camera!=="STATIC")n++;
      if(c.surface!=="NONE")n++;
      if(c.timing!=="SNAP")n++;
      return n;
    }
  }

  global.ExperienceComposer=ExperienceComposer;
})(window);
