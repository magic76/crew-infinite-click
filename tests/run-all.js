const {spawnSync}=require('child_process');
const files=['sprite-atlas-v12.test.js','toy-box-v13.test.js','sprite-physics-v13.test.js','impact-fx-v13.test.js','immersive-v13.test.js'];
for(const f of files){const r=spawnSync(process.execPath,['tests/'+f],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
console.log('ALL V13 TOY-BOX TESTS PASS');
