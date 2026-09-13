const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync('app/src/main/assets/game/index.html','utf8');
const live=fs.readFileSync('app/src/main/java/com/magic76/aiclicker/GeminiLiveClient.java','utf8');
const main=fs.readFileSync('app/src/main/java/com/magic76/aiclicker/MainActivity.java','utf8');
assert(!html.includes('gemini-event-aggregator.js'),'web gameplay must not call Gemini');
assert(!html.includes('conversation-director.js'),'web gameplay must not request banter');
assert(live.includes('VOICE_OUTPUT_ENABLED=false'),'native voice hard kill must remain');
assert(main.includes('v10: ignore model speech/transcript'),'native accidental speech must remain ignored');
console.log('ai-silent-v11.test.js PASS');
