const fs=require('fs');
const assert=require('assert');
const game=fs.readFileSync('app/src/main/assets/game/game.js','utf8');
const promise=fs.readFileSync('app/src/main/assets/game/promise-runtime.js','utf8');
const mutation=fs.readFileSync('app/src/main/assets/game/world-mutation-runtime.js','utf8');

assert(game.includes('function drawTargetShape'), 'world-specific target silhouettes required');
for(const id of ['SPRING_BLOOM','SUMMER_STORM','AUTUMN_DECAY','WINTER_FROST','VOID_CHAMBER']){
  assert(game.includes(`id===\"${id}\"`), `target/background shape branch missing: ${id}`);
}
assert(!promise.includes('.circle('), 'promise clues must not fall back to circles/rings');
assert(promise.includes('zigzag(') && promise.includes('shard(') && promise.includes('diamond('), 'promise shape vocabulary should include jagged/shard/diamond forms');
const gameCircleCount=(game.match(/\.circle\(/g)||[]).length;
assert(gameCircleCount<=2, `large game composition regressed to circles (${gameCircleCount})`);
const mutationCircleCount=(mutation.match(/\.circle\(/g)||[]).length;
assert(mutationCircleCount<=1, `world mutation should reserve circles for intentional impact rings (${mutationCircleCount})`);
console.log('visual-language-v9.test.js PASS');
