const fs=require('fs'),assert=require('assert');
const runtime=fs.readFileSync('app/src/main/assets/game/toy-object-runtime.js','utf8');
const game=fs.readFileSync('app/src/main/assets/game/game.js','utf8');
const artDir='app/src/main/assets/game/art/objects/';
const gradle=fs.readFileSync('app/build.gradle','utf8');
assert(game.includes('OBJECT_POLISH_WORLD_V22')||game.includes('TAP_VARIETY_V23')||game.includes('ACTION_BUTTON_V24')||game.includes('OVERDRIVE_SCENE_V25')||game.includes('VISIBLE_SHOOTING_V26'),'v22+ renderer id missing');
for(const f of ['bumper-idle.svg','bumper-hit.svg','gift-closed.svg','gift-open.svg','balloon-idle.svg','balloon-pop.svg','spring-idle.svg','spring-hit.svg']){
  const s=fs.readFileSync(artDir+f,'utf8');
  assert(s.includes('<defs>')&&/Gradient|gradient/.test(s),'polished gradients missing '+f);
}
assert(runtime.includes('setWorldTheme(theme)'),'world/object theme integration missing');
assert(runtime.includes('popUntil'),'balloon pop state missing');
assert(runtime.includes('worldGlow'),'world-reactive object glow missing');
assert(runtime.includes('glint'),'object glint layer missing');
assert(game.includes('state.objectRuntime.setWorldTheme(currentWorld())'),'initial object theme sync missing');
assert(game.includes('state.objectRuntime&&state.objectRuntime.setWorldTheme'),'world switch object theme sync missing');
assert(/versionCode\s+(400|401|402|403|404)/.test(gradle)&&(/0\.51\.0-object-polish-v22/.test(gradle)||/0\.52\.0-tap-variety-v23|0\.53\.0-action-button-v24|0\.54\.0-overdrive-scene-v25|0\.55\.0-visible-shooting-v26/.test(gradle)),'v22+ version missing');
console.log('object-polish-v22.test.js PASS');
