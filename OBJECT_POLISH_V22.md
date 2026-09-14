# Object Polish v22

Built directly on v21 World Visibility.

## Visual rebuild
- Replaced all 8 interaction-object state assets with polished gradient/vector art:
  - bumper idle / hit
  - gift closed / open
  - balloon idle / pop
  - spring idle / compressed
- Added richer highlights, material gradients, rim lighting, shadows, and state-specific silhouettes.

## Runtime polish
- Objects now have subtle breathing / hover motion instead of sitting like static icons.
- Added world-reactive glow and glint layers.
- Balloon keeps a visible pop frame for ~180 ms before disappearing.
- Gift opening, bumper hits, and spring compression now animate with stronger squash / lift feedback.
- Hit areas and visual sizes were tuned to feel more intentional.

## World integration
- Candy Toy Room: gift opens get a small bonus boost.
- Crystal Sky Garden: springs launch harder.
- Underwater Bubble Palace: balloon respawn is faster and spring launch is softer.
- Starlight Carnival: bumpers launch harder.
- World switches now sync their accent palette into interactive objects.

## Version
- versionCode 400
- versionName 0.51.0-object-polish-v22

## Validation
- `node tests/run-all.js`
- `node -c app/src/main/assets/game/game.js`
- `node -c app/src/main/assets/game/toy-object-runtime.js`

Expected test result:
`ALL V22 OBJECT-POLISH TESTS PASS`
