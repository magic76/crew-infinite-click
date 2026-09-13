const fs=require('fs'),vm=require('vm'),assert=require('assert');
let created=0;
class Graphics{constructor(){created++;this.scale={set(){}};this.parent=null;}clear(){return this;}}
const sandbox={window:{PIXI:{Graphics}},console};sandbox.window.window=sandbox.window;
vm.runInNewContext(fs.readFileSync('app/src/main/assets/game/object-pools.js','utf8'),sandbox);
const pool=new sandbox.window.ParticlePool(180);
assert.strictEqual(created,180,'v11 particle pool must preallocate');
const items=[];for(let i=0;i<180;i++)items.push(pool.acquire());
assert.strictEqual(pool.acquire(),null,'pool must stay bounded');
const before=created;pool.release(items[0]);assert(pool.acquire());assert.strictEqual(created,before,'pool must reuse graphics');
const game=fs.readFileSync('app/src/main/assets/game/game.js','utf8');
assert(game.includes('new ParticlePool(180)'),'game must preallocate 180 particles');
assert(game.includes('new RipplePool(18)'),'game must preallocate 18 ripples');
assert(!game.includes('new PIXI.Graphics()')||game.includes('state.bg=new PIXI.Graphics()'),'transient FX should come from pools');
console.log('particle-pool-v11.test.js PASS');
