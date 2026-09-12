const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const conv=fs.readFileSync(path.join(root,'app/src/main/assets/game/conversation-director.js'),'utf8');
const agg=fs.readFileSync(path.join(root,'app/src/main/assets/game/gemini-event-aggregator.js'),'utf8');
const live=fs.readFileSync(path.join(root,'app/src/main/java/com/magic76/aiclicker/GeminiLiveClient.java'),'utf8');
for(const required of ['minSpeechGapMs)||4800','burst<6','tap_is_gameplay','voiceWanted','Sound like a smart, dry friend','natural Taiwan Mandarin']){
  if(!conv.includes(required))throw new Error('missing sparse voice behavior: '+required);
}
if(!agg.includes('voiceWanted:directive.mode==="BANTER"?true:directive.voiceWanted===true'))throw new Error('aggregator drops voiceWanted');
for(const required of ['DO NOT SPEAK','Silence is better than a weak line','Never comment on ordinary taps','natural Taiwan Mandarin','generic filler or fake emotion']){
  if(!live.includes(required))throw new Error('Gemini sparse/persona prompt missing: '+required);
}
console.log('voice-sparse.test.js PASS');
