const fs=require('fs'),assert=require('assert');
const runtime=fs.readFileSync('app/src/main/assets/game/back-to-core-v31.js','utf8');
const index=fs.readFileSync('app/src/main/assets/game/index.html','utf8');
const gradle=fs.readFileSync('app/build.gradle','utf8');

assert(runtime.includes('BACK_TO_CORE_V31'),'v31 marker missing');
assert.doesNotThrow(()=>new Function(runtime),'v31 runtime has invalid JS syntax');

const active=index.replace(/<!--[\s\S]*?-->/g,'');
assert(active.includes('<script src="back-to-core-v31.js"></script>'),'v31 runtime not loaded');
for(const legacy of [
  'pixi-loader.js','scene-motion-v30-7.js','beam-flood-v30-6.js',
  'pure-beam-v30-6.js','endless-chaos-runtime.js','toy-object-runtime.js','sprite-pet-runtime.js'
]){
  assert(!active.includes('<script src="'+legacy+'"></script>'),'legacy runtime still active: '+legacy);
}

assert(runtime.includes('function corePoint()'),'single central core missing');
assert(runtime.includes('document.addEventListener("pointerdown",onDown'),'whole-screen input missing');
assert(runtime.includes('if(state.cycleTaps>=30)return 3'),'OVERDRIVE threshold missing');
assert(runtime.includes('if(state.cycleTaps>=15)return 2'),'CHARGED threshold missing');
assert(runtime.includes('if(state.cycleTaps>=5)return 1'),'WARM threshold missing');
assert(runtime.includes('burstAt:46'),'46 tap burst baseline missing');
assert(runtime.includes('state.cycleTaps=0'),'true reset-to-zero missing');
assert(runtime.includes('state.quietUntil=t+(forced?120:420)'),'quiet reset window missing');
assert(runtime.includes('if(t-h.startedAt<360)continue'),'hold delay missing');
assert(runtime.includes('if(t-h.lastAt<430)continue'),'slow hold cadence missing');
assert(runtime.includes('if(idx===0)return 0'),'CALM should not spray beams');
assert(runtime.includes('if(idx===1)return rate>=7?2:1'),'WARM beam escalation missing');
assert(runtime.includes('if(idx===2)return 3+(rate>=6?2:0)+(rate>=10?2:0)'),'CHARGED beam escalation missing');
assert(runtime.includes('if(idx===3)return 7+(rate>=6?3:0)+(rate>=10?4:0)'),'OVERDRIVE beam escalation missing');
assert(runtime.includes('PEAK_SIGNATURES=["FAN","CROSS","LANCE"]'),'cycle peak variation missing');
assert(runtime.includes('window.InfiniteClick=api'),'native compatibility API missing');
assert(runtime.includes('AndroidGame.onRendererReady(VERSION)'),'renderer-ready bridge missing');
assert(runtime.includes('legacyRuntimeLoaded:false'),'runtime simplification marker missing');
assert(gradle.includes('versionCode 416'),'v31 versionCode missing');
assert(gradle.includes("versionName '0.65.0-back-to-core-v31'"),'v31 versionName missing');

console.log('back-to-core-v31.test.js PASS');
