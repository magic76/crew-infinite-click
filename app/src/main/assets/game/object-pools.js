(function (global) {
  "use strict";

  function resetGraphics(g) {
    if (!g) return;
    try { if (g.parent) g.parent.removeChild(g); } catch (_) {}
    try { if (typeof g.clear === "function") g.clear(); } catch (_) {}
    g.visible=false; g.alpha=1; g.x=0; g.y=0; g.rotation=0;
    if (g.scale && typeof g.scale.set === "function") g.scale.set(1);
    if ("tint" in g) g.tint=0xFFFFFF;
    try { g.blendMode="normal"; } catch (_) {}
  }

  class PixiGraphicsPool {
    constructor(size, label) {
      if (!global.PIXI || !global.PIXI.Graphics) throw new Error("PixiGraphicsPool requires PIXI.Graphics");
      this.label=label||"graphics";
      this.capacity=Math.max(1,Number(size)||1);
      this.free=[];
      this.inUse=new Set();
      for (let i=0;i<this.capacity;i++) {
        const g=new global.PIXI.Graphics();
        resetGraphics(g);
        this.free.push(g);
      }
      this.peak=0;
    }
    acquire(parent) {
      const g=this.free.pop();
      if (!g) return null;
      resetGraphics(g);
      g.visible=true;
      if (parent) parent.addChild(g);
      this.inUse.add(g);
      this.peak=Math.max(this.peak,this.inUse.size);
      return g;
    }
    release(g) {
      if (!g || !this.inUse.has(g)) return false;
      this.inUse.delete(g);
      resetGraphics(g);
      this.free.push(g);
      return true;
    }
    releaseAll() {
      for (const g of Array.from(this.inUse)) this.release(g);
    }
    stats() {
      return {label:this.label,capacity:this.capacity,active:this.inUse.size,free:this.free.length,peak:this.peak};
    }
  }

  class ParticlePool extends PixiGraphicsPool { constructor(size){super(size||120,"particles");} }
  class RipplePool extends PixiGraphicsPool { constructor(size){super(size||12,"ripples");} }
  class DecoyPool extends PixiGraphicsPool { constructor(size){super(size||30,"decoys");} }

  global.PixiGraphicsPool=PixiGraphicsPool;
  global.ParticlePool=ParticlePool;
  global.RipplePool=RipplePool;
  global.DecoyPool=DecoyPool;
})(window);
