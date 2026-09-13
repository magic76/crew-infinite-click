(function(global){
  "use strict";

  const PALETTE={
    ink:0x171522,
    plum:0x2a2338,
    plum2:0x342b48,
    cream:0xf4e8dd,
    peach:0xe99592,
    peachLight:0xf6b7ae,
    mint:0x7fc9b5,
    mintLight:0xb9e1d6,
    gold:0xe7bf63,
    amber:0xd99a4c,
    blue:0x79a8be,
    lavender:0x9d90bd,
    white:0xffffff
  };

  function hex(n){return "#"+(n>>>0).toString(16).padStart(6,"0");}

  function makeSceneTexture(width,height){
    const w=Math.max(2,Math.round(width)),h=Math.max(2,Math.round(height));
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d",{alpha:false});
    const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#171522");bg.addColorStop(.52,"#211b31");bg.addColorStop(1,"#2c2239");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);

    const spotlight=ctx.createRadialGradient(w*.50,h*.38,0,w*.50,h*.38,Math.max(w,h)*.62);
    spotlight.addColorStop(0,"rgba(244,232,221,.10)");spotlight.addColorStop(.38,"rgba(157,144,189,.06)");spotlight.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=spotlight;ctx.fillRect(0,0,w,h);

    const peachGlow=ctx.createRadialGradient(w*.12,h*.22,0,w*.12,h*.22,w*.44);peachGlow.addColorStop(0,"rgba(233,149,146,.13)");peachGlow.addColorStop(1,"rgba(233,149,146,0)");ctx.fillStyle=peachGlow;ctx.fillRect(0,0,w,h);
    const mintGlow=ctx.createRadialGradient(w*.86,h*.36,0,w*.86,h*.36,w*.42);mintGlow.addColorStop(0,"rgba(127,201,181,.10)");mintGlow.addColorStop(1,"rgba(127,201,181,0)");ctx.fillStyle=mintGlow;ctx.fillRect(0,0,w,h);

    const floorY=h*.67,floor=ctx.createLinearGradient(0,floorY,0,h);floor.addColorStop(0,"rgba(244,232,221,.035)");floor.addColorStop(.12,"rgba(255,255,255,.018)");floor.addColorStop(1,"rgba(0,0,0,.14)");ctx.fillStyle=floor;ctx.fillRect(0,floorY,w,h-floorY);
    ctx.strokeStyle="rgba(244,232,221,.055)";ctx.lineWidth=Math.max(1,w/620);ctx.beginPath();ctx.moveTo(0,floorY);ctx.lineTo(w,floorY);ctx.stroke();

    // Subtle collector-display texture: very low contrast, never reads like a grid.
    const seed=(w*31+h*17)>>>0;let r=seed||1;const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
    for(let i=0;i<Math.min(760,Math.round(w*h/3100));i++){
      const x=rnd()*w,y=rnd()*h,a=.008+rnd()*.018,s=.45+rnd()*1.15;
      ctx.fillStyle=`rgba(255,255,255,${a})`;ctx.fillRect(x,y,s,s);
    }
    const vignette=ctx.createRadialGradient(w*.5,h*.48,Math.min(w,h)*.18,w*.5,h*.48,Math.max(w,h)*.78);vignette.addColorStop(.56,"rgba(0,0,0,0)");vignette.addColorStop(1,"rgba(5,3,12,.30)");ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
    return global.PIXI.Texture.from(canvas);
  }

  function glossyHighlight(g,x,y,rx,ry,alpha){
    g.ellipse(x-rx*.18,y-ry*.28,rx*.44,ry*.20).fill({color:PALETTE.white,alpha:alpha==null?.28:alpha});
    g.ellipse(x-rx*.34,y-ry*.10,rx*.12,ry*.08).fill({color:PALETTE.white,alpha:(alpha==null?.28:alpha)*.75});
  }

  function softShadow(g,x,y,rx,ry,alpha){
    g.ellipse(x,y,rx,ry).fill({color:0x05040a,alpha:alpha==null?.25:alpha});
    g.ellipse(x,y-1,rx*.72,ry*.60).fill({color:0x000000,alpha:(alpha==null?.25:alpha)*.48});
  }

  global.PremiumToyArt={PALETTE,hex,makeSceneTexture,glossyHighlight,softShadow};
})(window);
