const fs=require('fs');const path=require('path');const assert=require('assert');
const root=path.resolve(__dirname,'..');
const game=fs.readFileSync(path.join(root,'app/src/main/assets/game/game.js'),'utf8');
const gradle=fs.readFileSync(path.join(root,'app/build.gradle'),'utf8');
assert(game.includes('TAP_VARIANT_SETS'),'tap variant registry missing');
for(const name of ['selectTapVariant','tapVariantFx','variantNovaFx','variantSpiralFx','variantPetalFx','variantCometFx','variantCrownFx','variantPrismFx','variantSweepFx','variantSparkleFx','variantOrbitFx','variantBubbleFx','variantPoofFx','variantTwinkleFx','variantPinwheelFx','variantDriftFx']){assert(game.includes('function '+name),'missing '+name);}
assert(game.includes('hitFx(primary,x,y,hitVariant)'),'hit variant integration missing');
assert(game.includes('nearMissFx(x,y,primary,nearVariant)'),'near variant integration missing');
assert(game.includes('airTapFx(x,y,airType,impact,airVariant)'),'air variant integration missing');
assert(/versionCode\s+(401|402|403)/.test(gradle),'v23+ versionCode missing');
assert(/0\.(52\.0-tap-variety-v23|53\.0-action-button-v24|54\.0-overdrive-scene-v25)/.test(gradle),'v23+ versionName missing');
console.log('tap-variety-v23.test.js PASS');
