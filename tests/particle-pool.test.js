const fs=require('fs'),vm=require('vm'),assert=require('assert');
let created=0;
class Graphics{constructor(){created++;this.scale={set(){}};this.parent=null;}clear(){return this;}}
const sandbox={window:{PIXI:{Graphics}},console};sandbox.window.window=sandbox.window;
vm.runInNewContext(fs.readFileSync('app/src/main/assets/game/object-pools.js','utf8'),sandbox);
const pool=new sandbox.window.ParticlePool(120);
assert.strictEqual(created,120);
const list=[];for(let i=0;i<120;i++)list.push(pool.acquire());
assert.strictEqual(pool.acquire(),null,'pool must not allocate past capacity');
const before=created;pool.release(list[0]);assert(pool.acquire());assert.strictEqual(created,before,'re-acquire must reuse Graphics');
const fx=fs.readFileSync('app/src/main/assets/game/world-fx-controller.js','utf8');
assert(!fx.includes('new global.PIXI.Graphics'),'WorldFxController must use the pool rather than allocate Graphics during effects');
assert(fx.includes('caps=[0,4,10,24]'),'ordinary density caps must remain restrained: quiet 0, normal 4, busy 10, chaos 24');
const game=fs.readFileSync('app/src/main/assets/game/game.js','utf8');
assert(game.includes('new ParticlePool(120)')&&game.includes('new RipplePool(12)')&&game.includes('new DecoyPool(30)'),'requested pool capacities must be preallocated at boot');
console.log('particle-pool.test.js PASS');
