const fs=require('fs');
const assert=require('assert');
const legacy=fs.readFileSync('app/src/main/assets/game/excitement-layer-v30-2.js','utf8');
const tapRush=fs.readFileSync('app/src/main/assets/game/tap-rush-v30-4.js','utf8');
const index=fs.readFileSync('app/src/main/assets/game/index.html','utf8');
const gradle=fs.readFileSync('app/build.gradle','utf8');

assert(legacy.includes('EXCITEMENT_PET_V30_2'),'v30.2 compatibility marker missing');
assert.doesNotThrow(()=>new Function(legacy),'legacy excitement layer has invalid JS syntax');
assert.doesNotThrow(()=>new Function(tapRush),'tap rush controller has invalid JS syntax');
assert(index.includes('tap-rush-v30-4.js'),'replacement excitement controller not loaded');
assert(index.indexOf('tap-rush-v30-4.js')<index.indexOf('endless-chaos-runtime.js'),'tap rush must load before heavy dual-trigger runtime');
for(const name of ['NEEDLE','PRISM','COMET','STAR_CUT','ORB','RING','BUBBLE','NOVA'])assert(tapRush.includes(name),`shot variant ${name} missing`);
assert(tapRush.includes('hype_level'),'HYPE milestone event missing');
assert(tapRush.includes('surge_start'),'SURGE event missing');
assert(tapRush.includes('pet_assist'),'pet assist event missing');
assert(tapRush.includes('window.ExcitementPetV302'),'public v30.2 compatibility API missing');
assert(gradle.includes('// v30.2 marker versionCode 409'),'v30.2 version marker missing');
console.log('excitement-pet-v30-2.test.js PASS');
