const fs=require('fs'),assert=require('assert');
const runtime=fs.readFileSync('app/src/main/assets/game/experience-runtime.js','utf8');
const game=fs.readFileSync('app/src/main/assets/game/game.js','utf8');
const sig=fs.readFileSync('app/src/main/assets/game/signature-moment-runtime.js','utf8');
assert(/applyAiPlan\(rawPlan\)[\s\S]{0,300}_signatureActive\(\)/.test(runtime),'ExperienceRuntime must reject plan application during signature');
assert(game.includes('state.signatureMoments.isActive())return'),'ordinary semantic input/effect path must stop while signature owns scene');
assert(game.includes('state.signatureMoments.isActive())return;')&&game.includes('turnId!==state.pendingGameTurnId'),'late plans cannot enter active signature');
assert(sig.includes('if(key==="NONE"||this.current)return false'),'only one signature may own the scene');
console.log('signature-exclusivity.test.js PASS');
