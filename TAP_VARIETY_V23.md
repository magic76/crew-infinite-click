# TAP_VARIETY_V23

## Goal
Reduce monotony from repeated identical tap feedback. Keep the existing 10-character cast, 4 world maps, object system, and world rules, but make tapping feel less repetitive.

## What changed

### 1. Added a tap-variation system
Introduced `TAP_VARIANT_SETS` and `selectTapVariant()`.

Channels:
- `HIT`
- `NEAR`
- `AIR`

Variants:
- HIT: `NOVA`, `SPIRAL`, `PETALS`, `COMET`, `CROWN`, `PRISM`
- NEAR: `SWEEP`, `SPARKLE`, `ORBIT`, `BUBBLE`
- AIR: `POOF`, `TWINKLE`, `PINWHEEL`, `DRIFT`

The selector rotates variants using:
- total taps
- current world
- streak
- combo
- impact

and avoids repeating the same variant back-to-back for the same channel.

### 2. World-aware motifs
Added `WORLD_MOTIFS` and motif-aware drawing so extra feedback can visually lean toward the current world:
- Candy Toy Room -> candy-like pieces
- Crystal Sky Garden -> crystal/prism shards
- Underwater Bubble Palace -> bubbles
- Starlight Carnival -> starbursts

### 3. Direct-hit FX are now less repetitive
`hitFx()` still keeps the strong core burst/ring language, but now layers a second varied effect chosen from the hit variant set.

Result:
- repeated hits on the same pet no longer look identical
- combos feel more expressive
- different worlds feel more distinct even with the same cast

### 4. Near-miss FX now have their own identity
`nearMissFx()` now adds a secondary variant accent so close calls can look different from one another instead of being a single repeated graze burst.

### 5. Empty-tap FX are no longer always the same
`airTapFx()` now gets its own lightweight variant set so even taps that miss still feel alive, but remain cheaper/smaller than direct-hit FX.

## Files changed
- `app/src/main/assets/game/game.js`
- `app/build.gradle`
- `tests/run-all.js`
- `tests/impact-fx-v13.test.js`
- `tests/object-polish-v22.test.js`
- `tests/tap-variety-v23.test.js`

## Version
- renderer id: `TAP_VARIETY_V23`
- versionCode: `401`
- versionName: `0.52.0-tap-variety-v23`

## Test result
`ALL V23 TAP-VARIETY TESTS PASS`
