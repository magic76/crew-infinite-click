const {spawnSync}=require('child_process');
const files=['sprite-atlas-v12.test.js','sprite-physics-v13.test.js','impact-fx-v13.test.js','distance-impact-v12.test.js','ai-silent-v10.test.js','signature-disabled.test.js','chaos-regression-v15.test.js','object-playground-v15.test.js','immersive-v15.test.js','art-direction-v16.test.js','asset-art-v17.test.js','world-cast-v19.test.js','world-rules-v20.test.js'];
for(const f of files){const r=spawnSync(process.execPath,['tests/'+f],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
console.log('ALL V20 WORLD-RULES TESTS PASS');
