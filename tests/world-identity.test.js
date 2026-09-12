const fs=require('fs'),assert=require('assert');
const game=fs.readFileSync('app/src/main/assets/game/game.js','utf8');
const fx=fs.readFileSync('app/src/main/assets/game/world-fx-controller.js','utf8');
const runtime=fs.readFileSync('app/src/main/assets/game/experience-runtime.js','utf8');
assert(!game.includes('startSession("NEON_RIFT")'),'session should not be visually pinned to NEON_RIFT');
assert(game.includes('renderTargetPalette(plan)'),'world changes must recolor the primary target');
for(const id of ['SPRING_BLOOM','SUMMER_STORM','AUTUMN_DECAY','WINTER_FROST','VOID_CHAMBER']){
  assert(game.includes(id),`static world identity missing for ${id}`);
  assert(fx.includes(`case "${id}"`),`local world feedback missing for ${id}`);
}
assert(fx.includes('_clearAmbient();this._reconcileAmbient'),'world changes must recycle and redraw ambient particles');
assert(fx.includes('reactToPlayerEvent'),'world effects must participate in local player feedback');
assert(runtime.includes('this.fx.reactToPlayerEvent'),'ExperienceRuntime must drive world-specific local feedback');
assert(!game.includes('Math.floor((state.taps-1)/4)%8'),'world restoration must not reintroduce the old fixed phase loop');
console.log('world-identity.test.js PASS');
