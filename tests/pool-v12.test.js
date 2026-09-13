const fs=require('fs'),assert=require('assert');
const game=fs.readFileSync('app/src/main/assets/game/game.js','utf8');
assert(game.includes('new ParticlePool(260)'),'particle pool must be bounded at 260');
assert(game.includes('new RipplePool(28)'),'ripple pool must be bounded at 28');
for(const fn of ['tapBurst','petHitBurst','chaseAccent','groupSpark','bumpBurst','groupBurst']){
  const at=game.indexOf('function '+fn);assert(at>=0,fn+' missing');
  const next=game.indexOf('\n  function ',at+12);const body=game.slice(at,next>at?next:game.length);
  assert(body.includes('state.pools.particles.acquire')||body.includes('state.pools.ripples.acquire'),fn+' must acquire from pools');
  assert(!body.includes('new PIXI.Graphics'),fn+' must not allocate Graphics');
}
console.log('pool-v12.test.js PASS');
