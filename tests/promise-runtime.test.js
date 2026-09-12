const assert=require('assert');
const path=require('path');
const fs=require('fs');

global.window=global;
let clock=0;
Object.defineProperty(global,'performance',{value:{now:()=>clock},configurable:true});
class FakeContainer{
  constructor(){this.children=[];this.parent=null;this.eventMode='auto';this.label='';}
  addChild(...nodes){for(const n of nodes){if(!n)continue;n.parent=this;this.children.push(n);}return nodes[0];}
  removeChild(node){const i=this.children.indexOf(node);if(i>=0)this.children.splice(i,1);if(node)node.parent=null;}
  destroy(){this.children.length=0;}
}
class FakeGraphics extends FakeContainer{
  constructor(){super();this.alpha=1;this.x=0;this.y=0;this.rotation=0;this.scale={x:1,y:1,set:(v)=>{this.scale.x=v;this.scale.y=v;}};}
  clear(){return this;} rect(){return this;} circle(){return this;} fill(){return this;} stroke(){return this;} moveTo(){return this;} lineTo(){return this;}
}
global.PIXI={Container:FakeContainer,Graphics:FakeGraphics};
global.GameWorldCatalog={WORLDS:{
  SPRING_BLOOM:{id:'SPRING_BLOOM',accent:0x9acd72,secondary:0xf1b8c4},
  SUMMER_STORM:{id:'SUMMER_STORM',accent:0xf7db61,secondary:0x69b9e8},
  AUTUMN_DECAY:{id:'AUTUMN_DECAY',accent:0xd8874f,secondary:0xa7a06a},
  WINTER_FROST:{id:'WINTER_FROST',accent:0x78bbd7,secondary:0xb6d7e7},
  VOID_CHAMBER:{id:'VOID_CHAMBER',accent:0x7a6cf6,secondary:0x39c6c8},
  NEON_RIFT:{id:'NEON_RIFT',accent:0xe83cf6,secondary:0x34f0c3}
}};
require(path.resolve('app/src/main/assets/game/promise-runtime.js'));
const ticker={fn:null,add(fn){this.fn=fn;},remove(fn){if(this.fn===fn)this.fn=null;}};
const app={renderer:{screen:{width:360,height:640}},stage:new FakeContainer(),ticker};
const target={x:180,y:330};
let phases=[],reveals=0;
const p=new global.PromiseRuntime(app,{parent:app.stage,getTarget:()=>target,rng:()=>0,onPhaseChange:e=>phases.push(e.phase),onReveal:()=>reveals++});
assert.strictEqual(p.context().unresolved,true,'session must begin with an unanswered visual promise');
const early=p.context().progress;
clock+=5000;p._tick();
assert.strictEqual(p.context().progress,early,'idle must not erase unfinished curiosity');
for(let i=0;i<16;i++){clock+=120;p.tap(180,320,{streak:10,heat:.75,mutationPressure:.45});if(p.context().nextTease)break;}
assert(p.context().nextTease,'next mystery must leak into frame before current payoff');
assert(p.context().progress>=.62,'next tease should only appear once current mystery has developed');
for(let i=0;i<30&&reveals===0;i++){clock+=120;p.tap(180,320,{streak:14,heat:.9,mutationPressure:.65});p._tick();}
assert(reveals>=1,'continued tapping must eventually reveal the current promise');
assert.strictEqual(p.context().phase,'REVEAL','reveal must be an explicit visual phase');
const revealType=p.context().type;
clock+=900;p._tick();
assert.strictEqual(p.context().unresolved,true,'reveal must hand off into another unanswered promise');
assert(p.context().chain>=1,'promise chain must continue rather than return to a flat idle state');
assert.notStrictEqual(p.context().phase,'REVEAL','handoff should produce a new unresolved state');
const beforeWorld=p.context().progress;
p.setWorld('WINTER_FROST');
assert.strictEqual(p.context().world,'WINTER_FROST');
assert(p.context().progress>0,'world shift must transform, not erase, the unresolved promise');
p.steer({situation:'DECOY',experienceIntent:'MISDIRECT'});
for(let i=0;i<20&&!p.context().nextTease;i++){clock+=100;p.tap(180,320,{streak:10,heat:.7,mutationPressure:.5});p._tick();}
if(p.context().nextTease)assert.strictEqual(p.context().nextType,'ECHO','AI direction may bias only the next promise');
assert(phases.includes('TENSION')||phases.includes('BETRAYAL'),'promise must visibly escalate through intermediate phases');
p.destroy();assert.strictEqual(ticker.fn,null,'destroy should detach ticker');
const src=fs.readFileSync('app/src/main/assets/game/promise-runtime.js','utf8');
assert(!src.includes('PIXI.Text'),'promise FOMO must be visual, not instruction text');
const tapBody=src.slice(src.indexOf('tap(x,y,meta)'),src.indexOf('reset(){'));
assert(!tapBody.includes('new global.PIXI'),'tap critical path must not allocate display objects');
for(const type of ['RIFT','ASSEMBLY','SHADOW','TRANSFORM','ECHO','FALSE_CALM'])assert(src.includes('"'+type+'"'),'missing promise recipe '+type);
assert(src.includes('this._ensureNextSeed()'),'current promise must pre-seed the next mystery');
assert(!src.includes('Math.floor((state.taps-1)/4)%8'),'old fixed phase loop must remain absent');
console.log('promise-runtime.test.js PASS');
