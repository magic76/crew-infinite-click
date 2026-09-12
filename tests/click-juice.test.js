const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'app/src/main/assets/game/game.js'),'utf8');
const fx=fs.readFileSync(path.join(root,'app/src/main/assets/game/world-fx-controller.js'),'utf8');
const exp=fs.readFileSync(path.join(root,'app/src/main/assets/game/experience-runtime.js'),'utf8');
for(const required of ['tapJuice:{lastAt:0,streak:0}','localReleaseFeedback','GameHaptics.perform("SOFT_TAP"','state.fx.tapAccent(px,py,streak)']){
  if(!game.includes(required))throw new Error('missing click juice invariant: '+required);
}
if(!fx.includes('tapAccent(x,y,streak)'))throw new Error('missing pooled tap accent');
if(!fx.includes('const n=Math.min(6,2+Math.floor((combo-1)/2))'))throw new Error('tap accent must stay capped');
if(!exp.includes('this.audio&&type!=="TAP"&&type!=="RELEASE"'))throw new Error('semantic TAP still duplicates pointer-down audio');
if(!exp.includes('this.fx&&type!=="TAP"&&type!=="RELEASE"'))throw new Error('semantic TAP still duplicates pointer-down fx');
console.log('click-juice.test.js PASS');
