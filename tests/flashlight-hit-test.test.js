const fs=require('fs'),assert=require('assert');
const p='app/src/main/assets/game/signature-moment-runtime.js',s=fs.readFileSync(p,'utf8');
assert(s.includes('this.target.eventMode="static"'),'flashlight target must be a real Pixi hit target');
assert(s.includes('this.target.hitArea=new global.PIXI.Circle'),'flashlight target needs generous Pixi hitArea');
assert(s.includes('const p=e&&e.global'),'flashlight input must prefer Pixi global coordinates');
assert(!s.includes('Math.hypot(e.clientX-this.target.x'),'must not compare DOM client coordinates to Pixi target coordinates');
assert(s.includes('this.title.text="HOLD IT."'),'hit must give immediate visible acknowledgement');
assert(s.includes('this.haptics.perform("SOFT_TAP",.48)'),'hit must give immediate haptic acknowledgement');
console.log('flashlight-hit-test.test.js PASS');
