const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'app/src/main/assets/game/game.js'),'utf8');
const fx=fs.readFileSync(path.join(root,'app/src/main/assets/game/world-fx-controller.js'),'utf8');
const exp=fs.readFileSync(path.join(root,'app/src/main/assets/game/experience-runtime.js'),'utf8');
const audio=fs.readFileSync(path.join(root,'app/src/main/assets/game/audio-mood-player.js'),'utf8');
for(const required of ['tapJuice:{lastAt:0,streak:0,lastFrenzyAt:0,heat:0}','localReleaseFeedback','state.fx.tapAccent(px,py,streak)','state.fx.tapFrenzyAccent(px,py,streak,heat)','playClick(mood,.28+power*.30,streak)']){
  if(!game.includes(required))throw new Error('missing click juice invariant: '+required);
}
if(!fx.includes('tapAccent(x,y,streak)'))throw new Error('missing pooled tap accent');
if(!fx.includes('const n=Math.min(18,8+Math.floor(combo*.5))'))throw new Error('tap accent must restore dense pooled response');
if(!fx.includes('tapFrenzyAccent(x,y,streak,heat)'))throw new Error('rapid taps need time-gated frenzy accent');
if(!audio.includes('playClick(mood,intensity,combo)'))throw new Error('dedicated density-independent click audio missing');
if(!exp.includes('this.audio&&type!=="TAP"&&type!=="RELEASE"'))throw new Error('semantic TAP still duplicates pointer-down audio');
if(!exp.includes('this.fx&&type!=="TAP"&&type!=="RELEASE"'))throw new Error('semantic TAP still duplicates pointer-down fx');
console.log('click-juice.test.js PASS');
