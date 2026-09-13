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

    const bg=ctx.createLinearGradient(0,0,0,h);
    bg.addColorStop(0,"#120f1d");
    bg.addColorStop(.38,"#1a1427");
    bg.addColorStop(.72,"#231a31");
    bg.addColorStop(1,"#2c2138");
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);

    const roomGlow=ctx.createRadialGradient(w*.50,h*.35,0,w*.50,h*.35,Math.max(w,h)*.70);
    roomGlow.addColorStop(0,"rgba(255,248,240,.12)");
    roomGlow.addColorStop(.28,"rgba(212,198,230,.08)");
    roomGlow.addColorStop(.62,"rgba(126,168,191,.05)");
    roomGlow.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=roomGlow;ctx.fillRect(0,0,w,h);

    const floorY=h*.69;
    const floor=ctx.createLinearGradient(0,floorY,0,h);
    floor.addColorStop(0,"rgba(245,238,232,.03)");
    floor.addColorStop(.24,"rgba(255,255,255,.02)");
    floor.addColorStop(1,"rgba(0,0,0,.24)");
    ctx.fillStyle=floor;ctx.fillRect(0,floorY,w,h-floorY);

    const plinth=ctx.createLinearGradient(0,h*.76,0,h*.94);
    plinth.addColorStop(0,"rgba(66,53,86,.70)");
    plinth.addColorStop(.58,"rgba(42,34,57,.92)");
    plinth.addColorStop(1,"rgba(20,15,28,1)");
    const px=w*.10,py=h*.77,pw=w*.80,ph=h*.17,pr=Math.max(18,w*.035);
    roundedRect(ctx,px,py,pw,ph,pr);ctx.fillStyle=plinth;ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,.08)";ctx.lineWidth=Math.max(1,w/900);ctx.stroke();

    const stageGlow=ctx.createRadialGradient(w*.5,h*.80,0,w*.5,h*.80,w*.28);
    stageGlow.addColorStop(0,"rgba(255,214,242,.10)");
    stageGlow.addColorStop(.54,"rgba(121,168,190,.06)");
    stageGlow.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=stageGlow;ctx.fillRect(0,h*.62,w,h*.38);

    // Soft vertical toy-box pillars.
    for(const [nx,color,alpha] of [[.14,'255,206,197',.05],[.84,'176,238,222',.045]]){
      const x=w*nx;
      const pillar=ctx.createLinearGradient(x,0,x+w*.08,0);
      pillar.addColorStop(0,`rgba(${color},0)`);
      pillar.addColorStop(.5,`rgba(${color},${alpha})`);
      pillar.addColorStop(1,`rgba(${color},0)`);
      ctx.fillStyle=pillar;
      roundedRect(ctx,x,h*.22,w*.08,h*.48,w*.03);ctx.fill();
    }

    // Faint sparkles, not a noisy dust field.
    let r=((w*131+h*17)>>>0)||1; const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;};
    const sparkleCount=Math.min(90,Math.round(w*h/12000));
    for(let i=0;i<sparkleCount;i++){
      const x=rnd()*w,y=rnd()*h*.80,rr=.6+rnd()*1.8,a=.04+rnd()*.07;
      ctx.fillStyle=`rgba(255,255,255,${a})`;ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.fill();
    }

    const vignette=ctx.createRadialGradient(w*.5,h*.46,Math.min(w,h)*.22,w*.5,h*.46,Math.max(w,h)*.84);
    vignette.addColorStop(.54,"rgba(0,0,0,0)");
    vignette.addColorStop(1,"rgba(6,4,12,.34)");
    ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
    return global.PIXI.Texture.from(canvas);
  }

  function roundedRect(ctx,x,y,w,h,r){
    const rr=Math.min(r,w*.5,h*.5);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
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
