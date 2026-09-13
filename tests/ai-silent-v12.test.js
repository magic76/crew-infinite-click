const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync('app/src/main/assets/game/index.html','utf8');
const game=fs.readFileSync('app/src/main/assets/game/game.js','utf8');
for(const retired of ['gemini-event-aggregator.js','conversation-director.js','experience-runtime.js','storm-control-scene-runtime.js','promise-runtime.js','world-mutation-runtime.js'])assert(!html.includes(retired),retired+' must remain inactive');
assert(game.includes('All Gemini/voice messages are intentionally ignored in v12'),'v12 must ignore model/voice messages');
assert(game.includes('aiVoice:false,geminiGameplay:false'),'diagnostics must keep AI silent');
const livePath='app/src/main/java/com/magic76/aiclicker/GeminiLiveClient.java';
if(fs.existsSync(livePath)){const live=fs.readFileSync(livePath,'utf8');assert(live.includes('VOICE_OUTPUT_ENABLED=false'),'native voice hard kill must remain');}
console.log('ai-silent-v12.test.js PASS');
