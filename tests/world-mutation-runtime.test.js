const assert=require('assert');
const path=require('path');

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
require(path.resolve('app/src/main/assets/game/world-mutation-runtime.js'));

const ticker={fn:null,add(fn){this.fn=fn;},remove(fn){if(this.fn===fn)this.fn=null;}};
const app={renderer:{screen:{width:360,height:640}},stage:new FakeContainer(),ticker};
let stages=0,ruptures=0,epochs=0;
const m=new global.WorldMutationRuntime(app,{parent:app.stage,rng:()=>0,onStageChange:()=>stages++,onRupture:()=>ruptures++,onEpoch:()=>epochs++});
assert.strictEqual(m.setWorld('SUMMER_STORM'),true);
assert.strictEqual(m.context().world,'SUMMER_STORM');

for(let i=0;i<70;i++){
  clock+=110;
  m.tap(180+(i%3)*4,320,{streak:Math.min(20,i+1),heat:.8,fomoProgress:.8});
}
assert(ruptures>=2,'sustained tapping should rupture the world more than once');
assert(epochs>=1,'2-4 ruptures should advance a world epoch');
assert(m.context().scars>=2,'ruptures should leave persistent scars');
assert(stages>=4,'pressure should traverse multiple visual stages');
const scarsBefore=m.context().scars;
const floorBefore=m.floor;
clock+=5000;
for(let i=0;i<120;i++){clock+=50;m._tick({deltaMS:50});}
assert.strictEqual(m.context().scars,scarsBefore,'idle decay must not remove scars');
assert(m.pressure>=floorBefore-1e-6,'pressure decay must respect the mutation floor');
const priorWorld=m.context().world;
m.setWorld('WINTER_FROST');
assert.notStrictEqual(m.context().world,priorWorld,'world shift should be accepted');
assert.strictEqual(m.context().scars,scarsBefore,'world shift should preserve shared history scars');
assert(m.targetModulation(clock).scale>=1,'target modulation should reflect world pressure');
m.destroy();
assert.strictEqual(ticker.fn,null,'destroy should detach ticker callback');

const src=require('fs').readFileSync('app/src/main/assets/game/world-mutation-runtime.js','utf8');
for(const fn of ['_drawSpring','_drawStorm','_drawAutumn','_drawWinter','_drawVoid','_drawNeon'])assert(src.includes(fn+'('),'missing world visual evolution: '+fn);
assert(src.includes('this.scars.push(record)'),'rupture must leave persistent visual history');
assert(src.includes('2+Math.floor(this.rng()*3)'),'world shift cadence must vary between 2 and 4 ruptures');
assert(!src.includes('Math.floor((state.taps-1)/4)%8'),'must not restore the old fixed tap phase loop');
console.log('world-mutation-runtime.test.js PASS');
