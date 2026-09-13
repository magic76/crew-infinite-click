const assert=require('assert'),path=require('path'),fs=require('fs');
global.window=global;let clock=0;Object.defineProperty(global,'performance',{value:{now:()=>clock},configurable:true});
class FakeContainer{constructor(){this.children=[];this.parent=null;this.eventMode='auto';this.label='';}addChild(...ns){for(const n of ns){if(n){n.parent=this;this.children.push(n);}}return ns[0];}destroy(){this.children=[];}}
class FakeGraphics extends FakeContainer{clear(){return this;}rect(){return this;}fill(){return this;}stroke(){return this;}moveTo(){return this;}lineTo(){return this;}closePath(){return this;}bezierCurveTo(){return this;}}
global.PIXI={Container:FakeContainer,Graphics:FakeGraphics};
const ticker={fn:null,add(fn){this.fn=fn;},remove(fn){if(this.fn===fn)this.fn=null;}};
const app={renderer:{screen:{width:360,height:720}},stage:new FakeContainer(),ticker};
require(path.resolve('app/src/main/assets/game/storm-control-scene-runtime.js'));
let phases=[],reveals=[];const scene=new global.StormControlSceneRuntime(app,{parent:app.stage,rng:()=>.2,onPhaseChange:e=>phases.push(e.phase),onReveal:e=>reveals.push(e)});
const L=scene._layout,core=[L.core.cx,L.core.cy];
// Charge and overload through the physical core.
for(let i=0;i<90 && scene.phase!=='FALSE_CALM';i++){clock+=105;scene.tap(core[0],core[1],{heat:.75});scene._tick({deltaMS:16});}
assert(phases.includes('CHARGING'),'first interaction should wake the room');
assert(phases.includes('INSTABILITY'),'core charging should escalate into instability');
assert.strictEqual(scene.phase,'FALSE_CALM','overload should create a visual false calm rather than an immediate payoff');
clock+=700;scene.tap(core[0],core[1],{heat:.8});scene._tick({deltaMS:16});
assert.strictEqual(scene.phase,'REROUTE','re-engaging after false calm should move gameplay to console nodes');
assert.strictEqual(scene.targetPresentation().visible,false,'core target must stop being the only thing to tap during reroute');
// Charge three distinct nodes to prove spatial interaction changes.
for(let round=0;round<9 && scene.phase==='REROUTE';round++)for(const n of L.nodes){clock+=120;scene.tap(n.cx,n.cy,{heat:.7});}
assert(phases.includes('BREACH_HINT'),'diverse console input should progress the physical door mystery');
while(scene.phase==='BREACH_HINT'){clock+=110;scene.tap(L.door.x+L.door.w*.5,L.door.y+L.door.h*.5,{heat:.8});if(clock>30000)break;}
assert.strictEqual(scene.phase,'PARTIAL_REVEAL','door interaction must culminate in a partial reveal, not a generic particle burst');
for(let i=0;i<10;i++){clock+=120;scene.tap(L.door.x+L.door.w*.5,L.door.y+L.door.h*.5,{heat:.8});}
assert(reveals.length>=1,'continuing after partial reveal must seed another cycle');
assert.strictEqual(scene.context().scene,'STORM_CONTROL_ROOM');
assert.strictEqual(scene.context().voiceEnabled,false);
scene.destroy();
const src=fs.readFileSync('app/src/main/assets/game/storm-control-scene-runtime.js','utf8');
for(const token of ['window:{','door:{','core:{','console:{','nodeCharge','FALSE_CALM','REROUTE','BREACH_HINT','PARTIAL_REVEAL'])assert(src.includes(token),'missing scene mechanic '+token);
assert(!src.includes('PIXI.Text'),'scene must communicate through environment, not instruction text');
console.log('storm-control-scene-runtime.test.js PASS');
