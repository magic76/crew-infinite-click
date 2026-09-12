const {spawnSync}=require('child_process');
const files=['runtime-single-owner.test.js','particle-pool.test.js','gemini-event-aggregation.test.js','signature-exclusivity.test.js','screen-shatter-pixi.test.js'];
for(const f of files){
  const r=spawnSync(process.execPath,['tests/'+f],{stdio:'inherit'});
  if(r.status!==0)process.exit(r.status||1);
}
console.log('ALL JS TESTS PASS');
