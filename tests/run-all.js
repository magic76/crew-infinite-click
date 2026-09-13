const {spawnSync}=require('child_process');
const files=['runtime-single-owner.test.js','particle-pool.test.js','gemini-event-aggregation.test.js','signature-disabled.test.js','screen-shatter-disabled.test.js','storm-control-scene-runtime.test.js','storm-v10-integration.test.js','ai-silent-v10.test.js'];
for(const f of files){const r=spawnSync(process.execPath,['tests/'+f],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
console.log('ALL V10 JS TESTS PASS');
