const fs=require('fs');
const assert=require('assert');
const layer=fs.readFileSync('app/src/main/assets/game/excitement-layer-v30-2.js','utf8');
const index=fs.readFileSync('app/src/main/assets/game/index.html','utf8');
const gradle=fs.readFileSync('app/build.gradle','utf8');

assert(layer.includes('EXCITEMENT_PET_V30_2'),'v30.2 version marker missing');
assert.doesNotThrow(()=>new Function(layer),'v30.2 excitement layer has invalid JS syntax');
assert(index.includes('excitement-layer-v30-2.js'),'v30.2 layer not loaded');
assert(index.indexOf('excitement-layer-v30-2.js')<index.indexOf('endless-chaos-runtime.js'),'performance guard must load before heavy dual-trigger runtime');

assert(layer.includes('state.shots.length>=18'),'lightweight shot budget missing');
assert(layer.includes('state.particles.length>=60'),'particle budget missing');
assert(layer.includes('maxPerSecond'),'heavy shot forwarding budget missing');
assert(layer.includes('e.stopImmediatePropagation()'),'tap coalescing guard missing');
assert(layer.includes('quality==="LOW"'),'adaptive quality fallback missing');

for(const name of ['NEEDLE','PRISM','COMET','STAR_CUT','ORB','RING','BUBBLE','NOVA'])assert(layer.includes(name),`shot variant ${name} missing`);
assert(layer.includes('hype_level'),'HYPE milestone event missing');
assert(layer.includes('surge_start'),'SURGE event missing');
assert(layer.includes('pet_assist'),'pet assist event missing');
assert(layer.includes('InfiniteClick.diagnostics'),'pet positions should reuse existing diagnostics');
assert(layer.includes('window.ExcitementPetV302'),'public v30.2 API missing');

assert(gradle.includes('versionCode 409'),'v30.2 versionCode missing');
assert(gradle.includes("versionName '0.60.0-excitement-pet-v30-2'"),'v30.2 versionName missing');

console.log('excitement-pet-v30-2.test.js PASS');
