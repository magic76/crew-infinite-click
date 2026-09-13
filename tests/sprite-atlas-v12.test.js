const fs=require('fs'),path=require('path'),assert=require('assert');
function pngSize(file){const b=fs.readFileSync(file);assert.equal(b.toString('ascii',1,4),'PNG');return {w:b.readUInt32BE(16),h:b.readUInt32BE(20)};}
for(const name of ['cutie-sheet.png','spark-sheet.png','mint-sheet.png']){
  const f=path.join('app/src/main/assets/game/sprites',name),s=pngSize(f);
  assert.deepStrictEqual(s,{w:2048,h:1024},name+' must be 2048x1024');
}
const runtime=fs.readFileSync('app/src/main/assets/game/sprite-pet-runtime.js','utf8');
assert(runtime.includes('GRID_COLUMNS=4,GRID_ROWS=2,CELL=512'),'runtime must slice 4x2 512px atlas');
console.log('sprite-atlas-v12.test.js PASS');
