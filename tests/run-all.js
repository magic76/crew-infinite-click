const {spawnSync}=require('child_process');
const files=['sprite-sheet-v11.test.js','pet-behavior-v11.test.js','sprite-game-integration-v11.test.js','ai-silent-v11.test.js','particle-pool-v11.test.js'];
for(const f of files){const r=spawnSync(process.execPath,['tests/'+f],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
console.log('ALL V11 SPRITE PET TESTS PASS');
