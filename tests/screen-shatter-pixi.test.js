const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('app/src/main/assets/game/signature-moment-runtime.js','utf8');
assert(src.includes('PIXI.RenderTexture.create'),'shatter must snapshot into Pixi RenderTexture');
assert(src.includes('new global.PIXI.Sprite'),'shatter must use Pixi Sprite shards');
assert(src.includes('cols=4,rows=4'),'shatter must build 4x4 shards');
assert(src.includes('this.app.ticker.add(this.tickBound)'),'shatter animation must use Pixi ticker');
for(const forbidden of ['getContext("2d")','.drawImage(','shadowBlur','strokeRect','document.createElement("canvas")']){
  assert(!src.includes(forbidden),'forbidden Canvas2D shatter path: '+forbidden);
}
console.log('screen-shatter-pixi.test.js PASS');
