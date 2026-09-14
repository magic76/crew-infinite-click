const fs=require('fs');
const assert=require('assert');
const layer=fs.readFileSync('app/src/main/assets/game/excitement-layer-v30-2.js','utf8');
const gradle=fs.readFileSync('app/build.gradle','utf8');

assert(layer.includes('EXCITEMENT_PET_V30_3'),'v30.3 marker missing');
assert(layer.includes('stage>=12?1:2'),'late-stage hard forwarding cap missing');
assert(layer.includes('state.quality==="LOW"?1'),'low-quality heavy cap missing');
assert(layer.includes('baseGap=state.quality==="LOW"?760'),'low-quality minimum gap missing');
assert(layer.includes('const cap=state.quality==="LOW"?7:10'),'lightweight active-shot cap missing');
assert(layer.includes('const cap=state.quality==="LOW"?20:32'),'particle cap missing');
assert(layer.includes('e.preventDefault()'),'blocked heavy tap should prevent default');
assert(layer.includes('window.ExcitementPetV303'),'v30.3 API missing');
assert(gradle.includes('versionCode 410'),'v30.3 versionCode missing');
assert(gradle.includes("versionName '0.60.1-core-throttle-v30-3'"),'v30.3 versionName missing');
console.log('core-throttle-v30-3.test.js PASS');
