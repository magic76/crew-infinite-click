const {spawnSync}=require('child_process');
const files=['sprite-atlas-v12.test.js','sprite-physics-v13.test.js','impact-fx-v13.test.js','ai-silent-v10.test.js','signature-disabled.test.js','chaos-chain-v14.test.js','immersive-v14.test.js'];
for(const f of files){const r=spawnSync(process.execPath,['tests/'+f],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
console.log('ALL V14 CHAOS-CHAIN TESTS PASS');
