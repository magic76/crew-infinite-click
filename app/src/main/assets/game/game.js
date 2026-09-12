(() => {
'use strict';
const A = window.AndroidGame;
const state = {
  app:null, taps:0, time:0, plan:{intent:'TEASE',mood:'CURIOUS',primary:'#070A14',secondary:'#111A33',accent:'#65F6FF',energy:.52,tempo:.48,focusX:.5,focusY:.52},
  layers:{}, particles:[], ambient:[], rings:[], portals:[], glitches:[], cracks:[], target:null, targetLabel:null,
  shake:0, shakeUntil:0, blackHole:null, sceneId:0
};
const hex = s => parseInt(String(s||'#ffffff').replace('#',''),16) || 0xffffff;
const rand=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const viewport=()=>{const r=state.app&&state.app.renderer;return r&&r.screen?r.screen:{width:innerWidth,height:innerHeight};};
function reportError(e){ const m=String(e&&e.stack||e); const f=document.getElementById('fatal'); f.style.display='grid'; f.textContent='PIXI ERROR\n'+m; try{A&&A.onRendererError(m)}catch(_){} }
async function boot(){
  try{
    if(!window.PIXI) throw new Error('PixiJS 8.20.1 failed to load');
    const app = state.app = new PIXI.Application();
    await app.init({resizeTo:window, background:'#03050b', antialias:true, autoDensity:true, resolution:Math.min(devicePixelRatio||1,1.5), preference:'webgl'});
    document.getElementById('stage').appendChild(app.canvas);
    buildScene();
    app.stage.eventMode='static'; app.stage.hitArea=viewport();
    app.stage.on('pointerdown', ev=>{
      const view=viewport(), p=ev.global, x=clamp(p.x/view.width,0,1), y=clamp(p.y/view.height,0,1);
      localTap(x,y); try{A&&A.onTap(x,y)}catch(_){}
    });
    app.ticker.maxFPS=60;
    app.ticker.add(tick);
    document.addEventListener('visibilitychange',()=>{ if(document.hidden) app.ticker.stop(); else app.ticker.start(); });
    try{A&&A.onRendererReady(String(app.renderer.type||'webgl'))}catch(_){}
  }catch(e){reportError(e)}
}
function buildScene(){
  const a=state.app, L=state.layers;
  L.bg=new PIXI.Graphics(); L.ambient=new PIXI.Container(); L.world=new PIXI.Container(); L.fx=new PIXI.Container(); L.ui=new PIXI.Container(); L.flash=new PIXI.Graphics();
  a.stage.addChild(L.bg,L.ambient,L.world,L.fx,L.ui,L.flash);
  rebuildBackdrop();
  for(let i=0;i<42;i++) makeAmbient();
  createTarget(.5,.52);
}
function rebuildBackdrop(){
  const {width:w,height:h}=viewport(),p=state.plan,g=state.layers.bg; g.clear();
  g.rect(0,0,w,h).fill(hex(p.primary));
  for(let i=0;i<8;i++){
    const r=Math.max(w,h)*(0.14+i*.09), x=w*(.12+((i*37)%83)/100), y=h*(.08+((i*29)%78)/100);
    g.circle(x,y,r).fill({color:hex(i%2?p.secondary:p.accent),alpha:.018+.012*p.energy});
  }
}
function createTarget(nx,ny){
  const L=state.layers, view=viewport(), w=view.width,h=view.height;
  if(state.target){L.world.removeChild(state.target); state.target.destroy({children:true});}
  const c=new PIXI.Container(), halo=new PIXI.Graphics(), core=new PIXI.Graphics();
  halo.circle(0,0,48).stroke({color:hex(state.plan.accent),width:2,alpha:.35});
  core.circle(0,0,25).fill({color:hex(state.plan.accent),alpha:.96});
  core.circle(-7,-8,7).fill({color:0xffffff,alpha:.5});
  c.addChild(halo,core); c.x=nx*w;c.y=ny*h;c.eventMode='none';
  L.world.addChild(c); state.target=c;
  if(!state.targetLabel){ state.targetLabel=new PIXI.Text({text:'TOUCH',style:{fontFamily:'sans-serif',fontSize:13,fontWeight:'700',fill:0xffffff,letterSpacing:4}}); state.targetLabel.anchor.set(.5); L.ui.addChild(state.targetLabel); }
  state.targetLabel.x=c.x; state.targetLabel.y=c.y+60;
}
function makeAmbient(){
  const g=new PIXI.Graphics(),r=rand(1,4); g.circle(0,0,r).fill({color:hex(state.plan.accent),alpha:rand(.12,.65)}); g.blendMode='add';
  const o={g,x:Math.random(),y:Math.random(),vx:rand(-.012,.012),vy:rand(-.012,.012),phase:rand(0,6.28)}; state.layers.ambient.addChild(g);state.ambient.push(o);
}
function localTap(x,y){
  state.taps++; ripple(x,y); burst(x,y,18+Math.floor(state.plan.energy*18));
  const phase=Math.floor((state.taps-1)/4)%8, step=(state.taps-1)%4;
  if(phase===0) tease(step,x,y);
  else if(phase===1) escape(step,x,y);
  else if(phase===2) swarm(step,x,y);
  else if(phase===3) glitchBeat(step,x,y);
  else if(phase===4) portalBeat(step,x,y);
  else if(phase===5) absorbBeat(step,x,y);
  else if(phase===6) fractureBeat(step,x,y);
  else revealBeat(step,x,y);
}
function tease(step,x,y){ state.targetLabel.text=['TOUCH','AGAIN?','YOU DID IT','ONE MORE'][step]; pulseTarget(1.12+.08*step); if(step===3) flash('#ffffff',80,.16); }
function escape(step,x,y){
  const nx=clamp(.12+Math.random()*.76,.12,.88), ny=clamp(.18+Math.random()*.64,.18,.82); moveTarget(nx,ny,.22);
  state.targetLabel.text=['CATCH','NOPE','ALMOST','...'][step]; if(step===3) screenShake(.12,180);
}
function swarm(step,x,y){ state.targetLabel.text=['WHICH ONE?','SURE?','STILL SURE?','OK.'][step]; spawnDecoys(3+step*2); if(step===3) collapseTo(x,y); }
function glitchBeat(step,x,y){ glitch(.35+.12*step); state.targetLabel.text=['SIGNAL?','WRONG PIXEL','AGAIN','FIXED'][step]; if(step===2) flash(state.plan.accent,100,.22); }
function portalBeat(step,x,y){ spawnPortal(x,y,.45+.12*step); state.targetLabel.text=['OPEN','WIDER','DON\'T BLINK','THROUGH'][step]; if(step===3) warpAll(x,y); }
function absorbBeat(step,x,y){ blackHole(x,y,.55+.1*step); state.targetLabel.text=['PULL','STRONGER','UH OH','GONE'][step]; }
function fractureBeat(step,x,y){ crack(x,y,4+step*2); state.targetLabel.text=['CRACK','MORE','STOP?','TOO LATE'][step]; if(step===3) screenShake(.2,260); }
function revealBeat(step,x,y){
  state.targetLabel.text=['QUIET','...','LOOK','FOUND IT'][step];
  if(step===0){state.layers.ambient.alpha=.18; state.target.scale.set(.45);} if(step===2) spawnPortal(.5,.5,.35); if(step===3){state.layers.ambient.alpha=1;state.target.scale.set(1);burst(.5,.5,70);flash('#ffffff',120,.25);}
}
function ripple(x,y){ const g=new PIXI.Graphics(),view=viewport(); g.circle(0,0,12).stroke({color:hex(state.plan.accent),width:3,alpha:.85});g.x=x*view.width;g.y=y*view.height;state.layers.fx.addChild(g);state.rings.push({g,life:1}); }
function burst(x,y,n){
  const view=viewport(),W=view.width,H=view.height;
  for(let i=0;i<n;i++){const g=new PIXI.Graphics(),r=rand(1.3,4.2);g.circle(0,0,r).fill({color: i%5===0?0xffffff:hex(state.plan.accent),alpha:rand(.55,1)});g.blendMode='add';g.x=x*W;g.y=y*H;state.layers.fx.addChild(g);const a=rand(0,Math.PI*2),s=rand(80,330);state.particles.push({g,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.35,.9),max:1});}
}
function spawnDecoys(n){ const view=viewport(),W=view.width,H=view.height; for(let i=0;i<n;i++){const g=new PIXI.Graphics();g.circle(0,0,rand(8,19)).fill({color:hex(state.plan.accent),alpha:rand(.18,.7)});g.x=rand(.08,.92)*W;g.y=rand(.16,.86)*H;state.layers.fx.addChild(g);state.particles.push({g,vx:rand(-35,35),vy:rand(-35,35),life:rand(.7,1.5),max:1.5});} }
function spawnPortal(x,y,strength){ const c=new PIXI.Container(),view=viewport(),W=view.width,H=view.height; for(let i=0;i<4;i++){const g=new PIXI.Graphics();g.circle(0,0,28+i*14).stroke({color:i%2?hex(state.plan.accent):0xffffff,width:2+i,alpha:.18+.12*i});c.addChild(g);}c.x=x*W;c.y=y*H;c.blendMode='add';state.layers.fx.addChild(c);state.portals.push({c,life:1.2+strength,spin:(.8+strength)*(.5-Math.random())});}
function blackHole(x,y,strength){state.blackHole={x,y,strength,until:state.time+.55+strength*.7}; spawnPortal(x,y,strength);screenShake(.05+strength*.08,160);}
function crack(x,y,n){ const view=viewport(),W=view.width,H=view.height,g=new PIXI.Graphics();for(let i=0;i<n;i++){let px=x*W,py=y*H,a=rand(0,6.28);g.moveTo(px,py);for(let k=0;k<5;k++){px+=Math.cos(a+rand(-.5,.5))*rand(18,62);py+=Math.sin(a+rand(-.5,.5))*rand(18,62);g.lineTo(px,py);} }g.stroke({color:hex(state.plan.accent),width:rand(1,3),alpha:.72});state.layers.fx.addChild(g);state.cracks.push({g,life:1.1});}
function glitch(strength){ const view=viewport(),W=view.width,H=view.height;for(let i=0;i<8;i++){const g=new PIXI.Graphics();g.rect(0,0,rand(W*.1,W*.7),rand(2,12)).fill({color:i%2?hex(state.plan.accent):0xffffff,alpha:rand(.08,.28)});g.x=rand(0,W);g.y=rand(0,H);state.layers.fx.addChild(g);state.glitches.push({g,life:rand(.08,.24)});}screenShake(.05+strength*.08,100);}
function collapseTo(x,y){ state.blackHole={x,y,strength:.8,until:state.time+.55}; }
function warpAll(x,y){state.blackHole={x,y,strength:1,until:state.time+.8};screenShake(.14,300);}
function moveTarget(nx,ny,s){ const view=viewport(),W=view.width,H=view.height;state.target.x=nx*W;state.target.y=ny*H;state.targetLabel.x=state.target.x;state.targetLabel.y=state.target.y+60;burst(nx,ny,10);}
function pulseTarget(v){if(!state.target)return;state.target.scale.set(v);setTimeout(()=>{if(state.target)state.target.scale.set(1)},110);}
function screenShake(strength,ms){state.shake=Math.max(state.shake,strength);state.shakeUntil=performance.now()+ms;}
function flash(color,ms,alpha=.2){const g=state.layers.flash,view=viewport(),W=view.width,H=view.height;g.clear().rect(0,0,W,H).fill({color:hex(color),alpha});setTimeout(()=>g.clear(),ms);}
function applyPlan(p){ if(!p)return;state.plan={...state.plan,...p};rebuildBackdrop();for(const a of state.ambient){a.g.tint=hex(state.plan.accent);} if(state.target){createTarget(state.plan.focusX||.5,state.plan.focusY||.52);} }
function applyAction(a){ if(!a||!a.type)return;const x=clamp(Number(a.x??.5),0,1),y=clamp(Number(a.y??.5),0,1),s=clamp(Number(a.strength??.65),.1,1);switch(a.type){case'particle_burst':burst(x,y,20+Math.floor(50*s));break;case'shockwave':ripple(x,y);ripple(x,y);break;case'portal':spawnPortal(x,y,s);break;case'black_hole':case'gravity_pull':blackHole(x,y,s);break;case'world_crack':crack(x,y,5+Math.floor(s*8));break;case'glitch':glitch(s);break;case'screen_shake':screenShake(s,Number(a.durationMs||180));break;case'flash':flash(a.color||'#ffffff',Number(a.durationMs||90),.22);break;case'swarm':spawnDecoys(4+Math.floor(s*10));break;case'dissolve':burst(x,y,45);if(state.target)state.target.alpha=.15;setTimeout(()=>{if(state.target)state.target.alpha=1},420);break;}}
function tick(t){ const dt=Math.min(.034,t.deltaMS/1000);state.time+=dt; const view=viewport(),W=view.width,H=view.height;
  for(const a of state.ambient){a.x+=a.vx*dt*(.6+state.plan.tempo);a.y+=a.vy*dt*(.6+state.plan.tempo);if(a.x<0)a.x=1;if(a.x>1)a.x=0;if(a.y<0)a.y=1;if(a.y>1)a.y=0;a.g.x=a.x*W;a.g.y=a.y*H;a.g.alpha=.28+.22*Math.sin(state.time*1.4+a.phase);}
  const bh=state.blackHole&&state.time<state.blackHole.until?state.blackHole:null; if(!bh)state.blackHole=null;
  for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];if(bh){const dx=bh.x*W-p.g.x,dy=bh.y*H-p.g.y,d=Math.max(40,Math.hypot(dx,dy));p.vx+=dx/d*700*bh.strength*dt;p.vy+=dy/d*700*bh.strength*dt;}p.vy+=28*dt;p.g.x+=p.vx*dt;p.g.y+=p.vy*dt;p.life-=dt;p.g.alpha=clamp(p.life/p.max,0,1);if(p.life<=0){p.g.destroy();state.particles.splice(i,1);}}
  for(let i=state.rings.length-1;i>=0;i--){const r=state.rings[i];r.life-=dt;r.g.scale.x=r.g.scale.y+=dt*3.3;r.g.alpha=clamp(r.life,0,1);if(r.life<=0){r.g.destroy();state.rings.splice(i,1);}}
  for(let i=state.portals.length-1;i>=0;i--){const p=state.portals[i];p.life-=dt;p.c.rotation+=p.spin*dt;p.c.scale.set(1+(1.5-p.life)*.09);p.c.alpha=clamp(p.life,0,1);if(p.life<=0){p.c.destroy({children:true});state.portals.splice(i,1);}}
  for(const arrName of ['glitches','cracks']){const arr=state[arrName];for(let i=arr.length-1;i>=0;i--){arr[i].life-=dt;arr[i].g.alpha=clamp(arr[i].life,0,1);if(arr[i].life<=0){arr[i].g.destroy();arr.splice(i,1);}}}
  if(state.target){const breathe=1+Math.sin(state.time*(2+state.plan.tempo*2))*.035;state.target.scale.set(state.target.scale.x*.86+breathe*.14);}
  if(performance.now()<state.shakeUntil){state.app.stage.x=rand(-1,1)*state.shake*30;state.app.stage.y=rand(-1,1)*state.shake*30;}else{state.app.stage.x=state.app.stage.y=0;state.shake*=.8;}
}
window.InfiniteClick={receive(msg){try{if(!msg)return;if(msg.op==='scenePlan')applyPlan(msg.plan);else if(msg.op==='action')applyAction(msg.action);else if(msg.op==='reset'){state.taps=0;state.layers.fx.removeChildren().forEach(x=>x.destroy({children:true}));createTarget(.5,.52);}else if(msg.op==='language'){/* visual copy intentionally minimal */}}catch(e){reportError(e)}}};
boot();
})();
