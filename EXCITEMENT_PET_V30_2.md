# v30.2 Excitement + Pet Assist

Goal: keep the mindless tapping loop increasingly exciting without letting expensive projectile/particle work scale linearly with physical tap rate.

## Performance budget

`excitement-layer-v30-2.js` is loaded before `endless-chaos-runtime.js` and observes the dual-trigger pointer stream first.

Every physical tap:
- counts toward HYPE
- gets a lightweight local projectile
- gets a distinct shot variant

Only a stage-aware subset is forwarded to the heavier v30 runtime. The forwarding budget becomes stricter at later stages while visual response remains immediate.

Budgets in the lightweight layer:
- max 18 active lightweight shots
- max 60 particles (drops to 34 when frame time enters LOW quality)
- max 16 impact rings
- forwarded heavy taps are capped per second and by per-trigger minimum gaps

This separates perceived fire density from expensive gameplay FX density.

## Shot variation

FOCUS rotates through:
- NEEDLE
- PRISM
- COMET
- rare STAR_CUT

BURST rotates through:
- ORB
- RING
- BUBBLE
- rare NOVA

Rare variants become more frequent at high HYPE.

## HYPE loop

HYPE rises from:
- physical tap rate
- alternating FOCUS / BURST quickly
- sustained play

It decays when the player slows down. Milestones at 50 / 75 / 100 emit semantic game events for future Gemini Live integration.

At 100, a short SURGE window begins instead of simply spawning more heavy projectiles.

## Pet Assist

Pet positions come from the existing `InfiniteClick.diagnostics().pets` context.

At higher HYPE:
- pets receive a lightweight assist halo
- a pet fires a distinct assist shot from its actual screen position
- assist cadence increases with HYPE
- very high HYPE can trigger two pets in one assist beat

This makes the cast feel like it is joining the player's momentum rather than merely reacting to being hit.

Events emitted:
- `excitement_ready`
- `hype_level`
- `surge_start`
- `pet_assist`

These are designed to feed a future Gemini Live Director without putting the network/model in the local input loop.

## Runtime API

`window.ExcitementPetV302`

- `diagnostics()`
- `setEnabled(boolean)`
- `forceAssist()`
- `setHype(number)`

Version: `0.60.0-excitement-pet-v30-2` / versionCode `409`.
