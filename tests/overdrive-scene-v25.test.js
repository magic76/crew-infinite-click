const fs=require('fs'),assert=require('assert');
const game=fs.readFileSync('app/src/main/assets/game/game.js','utf8');
const gradle=fs.readFileSync('app/build.gradle','utf8');
assert(game.includes('OVERDRIVE_SCENE_V25')||game.includes('VISIBLE_SHOOTING_V26'),'v25+ renderer id missing');
for(const token of ['buttonHolding','buttonHoldCharge','triggerButtonOverdrive','updateCinematicSceneFx','startSceneStorm','startSceneRain','startSceneWave'])assert(game.includes(token),'missing '+token);
assert(/versionCode\s+(403|404)/.test(gradle),'v25+ versionCode missing');
assert(/0\.(54\.0-overdrive-scene-v25|55\.0-visible-shooting-v26)/.test(gradle),'v25+ versionName missing');
console.log('overdrive-scene-v25.test.js PASS');
