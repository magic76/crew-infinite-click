# OVERDRIVE_SCENE_V25

## Goal
Make the bottom action button feel like the core toy of the game: something users can keep pressing, hold for rapid fire, charge up, and release for a large cinematic payoff.

## Button behavior

### Tap
A normal press still rotates through the v24 action modes:
- SHOOT
- QUAKE
- THUNDER
- CASCADE
- PULSE
- WORLD

The stronger modes now also affect the whole scene instead of only local particles.

### Hold
Holding the button now:
- starts charging immediately
- begins auto-fire after a short delay
- auto-fire accelerates as charge increases
- button glows/pulses harder while charging
- charge is visible as a bar inside the button

### Release
- low charge: small pulse payoff
- high charge: OVERDRIVE

## OVERDRIVE
OVERDRIVE is world-aware:
- Starlight Carnival -> lightning storm + quake
- Crystal Sky Garden -> crystal rain + impact burst
- Underwater Bubble Palace -> bubble wave / tsunami-style rising bubbles
- Candy Toy Room -> candy cascade + scene burst

All versions also add:
- stronger camera impact
- scene-wide flashes
- multiple shockwaves
- pet reactions / launches
- extra world charge
- cinematic edge lighting

## Scene effect system
New scene states:
- `sceneStormUntil`
- `sceneQuakeUntil`
- `sceneRainUntil`
- `sceneWaveUntil`
- `sceneIntensity`

New scene effect helpers:
- `sceneImpactBurst()`
- `startSceneStorm()`
- `startSceneRain()`
- `startSceneWave()`
- `updateCinematicSceneFx()`
- `spawnSceneRainPiece()`
- `spawnSceneBubbleWave()`
- `renderSceneOverlay()`

## Button diagnostics
Added:
- `buttonHolding`
- `buttonHoldCharge`
- `buttonOverdrives`
- existing `buttonPresses`
- existing `lastButtonAction`

## Version
- renderer id: `OVERDRIVE_SCENE_V25`
- versionCode: `403`
- versionName: `0.54.0-overdrive-scene-v25`

## Validation
- all game JS passed `node --check`
- test suite result: `ALL V25 OVERDRIVE-SCENE TESTS PASS`
