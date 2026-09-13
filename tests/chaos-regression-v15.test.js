const fs=require('fs'),assert=require('assert');
const game=fs.readFileSync('app/src/main/assets/game/game.js','utf8');
for(const fn of ['comboHalo','comboBlast','grazeWhipFx','maybeTauntOnMiss','startPinballFrenzy','updateFrenzy','frenzyTrail','collisionChainAccent'])assert(game.includes('function '+fn),fn+' regression');
for(const token of ['collisionChain:0','frenzyUntil:0','lastTrails:new Map()','"PINBALL"'])assert(game.includes(token),'missing v14 chaos state '+token);
assert(game.includes('state.hitCombo>=3&&state.hitCombo%3===0'),'third-hit blast regressed');
assert(game.includes('chain>=3&&relative>300'),'collision frenzy regressed');
assert(game.includes('if(impact>=.76)grazeWhipFx'),'graze feedback regressed');
console.log('chaos-regression-v15.test.js PASS');
