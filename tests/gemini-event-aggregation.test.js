const fs=require('fs'),vm=require('vm'),assert=require('assert');
let now=0,flushed=[];
const w={performance:{now:()=>now},setTimeout,clearTimeout};w.window=w;
vm.runInNewContext(fs.readFileSync('app/src/main/assets/game/gemini-event-aggregator.js','utf8'),{window:w,performance:w.performance,console});
const a=new w.GeminiEventAggregator({now:()=>now,windowMs:500,onFlush:p=>flushed.push(p)});
for(let i=0;i<5;i++){now=i*90;a.push({type:'TAP',x:.8,y:.5},{mode:i===4?'GAME_TURN':'BANTER',reason:'tap'},{event:{type:'TAP'}});}
assert.strictEqual(flushed.length,0,'burst should aggregate before flush');
const p=a.flush();
assert.strictEqual(flushed.length,1);assert.strictEqual(p.behavior.tapCount,5);assert.strictEqual(p.behavior.behavior,'rapid_tapping');
assert.strictEqual(p.behavior.dominantArea,'RIGHT');assert.strictEqual(p.mode,'GAME_TURN','GAME_TURN must outrank BANTER in same burst');
console.log('gemini-event-aggregation.test.js PASS');
