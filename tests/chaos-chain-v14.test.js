const fs=require('fs'),assert=require('assert');
const game=fs.readFileSync('app/src/main/assets/game/game.js','utf8');
assert(game.includes('TOY_BOX_CHAOS_V14'),'v14 renderer id missing');
for(const fn of ['comboHalo','comboBlast','grazeWhipFx','maybeTauntOnMiss','startPinballFrenzy','updateFrenzy','frenzyTrail','collisionChainAccent']){
  assert(game.includes('function '+fn),fn+' missing');
}
for(const token of ['collisionChain:0','frenzyUntil:0','lastTrails:new Map()','"PINBALL"'])assert(game.includes(token),'missing chaos state '+token);
assert(game.includes('state.hitCombo>=3&&state.hitCombo%3===0'),'every third hit should create a combo blast');
assert(game.includes('state.hitCombo>=5&&activePets().length>=2'),'long hit chains should be able to enter frenzy');
assert(game.includes('chain>=3&&relative>300'),'high-speed collision chain should be able to trigger frenzy');
assert(game.includes('if(impact>=.76)grazeWhipFx'),'strong near misses need a graze effect');
assert(game.includes('maybeTauntOnMiss(x,y,primary,impact,t)'),'empty taps should allow pet taunts');
assert(game.includes('n=kind==="SWARM"?52:(kind==="PINBALL"?58:40)'),'pinball payoff should be visually distinct');
console.log('chaos-chain-v14.test.js PASS');
