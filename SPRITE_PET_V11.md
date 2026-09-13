# Sprite Pet v11

The active game is now a local Pixi sprite-pet playground rather than Storm Control Room / Promise / World Mutation.

## Asset
- `app/src/main/assets/game/sprites/cutie-sheet.png`
- exact atlas size: 2048x1024
- 4 columns x 2 rows
- each frame: 512x512
- original generated eight-pose art was normalized to integer cells to avoid half-pixel frame jitter.

## Animation sets
- IDLE: 0,1,2,1
- HOP: 0,3,1
- STARTLED: 4,5,4
- RUN: 6,7,6,7
- PANIC: 4,5,6,7,5,6
- CELEBRATE: 3,1,3,0

Horizontal movement flips the same AnimatedSprite via negative `scale.x`.

## Interaction
- direct tap on pet: STARTLED + impulse away + stronger FX
- near tap: flee away from the finger
- distant tap: low-panic pet may hop toward it out of curiosity
- repeated chasing builds panic and faster movement
- inactivity lets panic decay and autonomous wandering resumes
- every screen tap produces pooled local burst/ripple FX at the exact tap location

## AI
Gemini and AI speech are not on the active v11 gameplay path. `index.html` does not load ExperienceRuntime, ConversationDirector, GeminiEventAggregator, PromiseRuntime, WorldMutationRuntime, or StormControlSceneRuntime. Native v10 speech hard-disable remains in place.
