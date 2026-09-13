const {spawnSync}=require('child_process');
const files=['sprite-atlas-v12.test.js','multi-cutie-v12.test.js','distance-impact-v12.test.js','fx-variety-v12.test.js','ai-silent-v12.test.js','pool-v12.test.js'];
for(const f of files){const r=spawnSync(process.execPath,['tests/'+f],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
console.log('ALL V12 MULTI-CUTIE TESTS PASS');
