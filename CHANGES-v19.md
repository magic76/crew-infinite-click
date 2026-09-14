# Infinite Click v19 — 10 Cast + Rotating Worlds

## What changed

- Replaced the small pet lineup with a single **10-character atlas**:
  - hero-peach
  - sprout-bunny
  - gold-flame
  - cloudy-boo
  - star-hop
  - jelly-pop
  - radish-bop
  - bubble-bebe
  - plum-plop
  - candy-roll
- Added four **premium world backgrounds** that rotate during play:
  - candy toy room
  - crystal sky garden
  - underwater bubble palace
  - starlight carnival
- Added **world charge** logic so good interaction momentum can trigger world transitions.
- Kept the existing chaos / combo / object systems, but wired them into the world-shift loop.
- Extended the sprite runtime so it can use a **single large character atlas** instead of only fixed 4x2 sprite sheets.

## Main files touched

- `app/src/main/assets/game/game.js`
- `app/src/main/assets/game/sprite-pet-runtime.js`
- `app/src/main/assets/game/production-asset-art.js`
- `app/build.gradle`
- `tests/world-cast-v19.test.js`

## New art assets

- `app/src/main/assets/game/sprites/cast-sheet-10.png`
- `app/src/main/assets/game/art/worlds/candy-toy-room.png`
- `app/src/main/assets/game/art/worlds/crystal-sky-garden.png`
- `app/src/main/assets/game/art/worlds/underwater-bubble-palace.png`
- `app/src/main/assets/game/art/worlds/starlight-carnival.png`

## Quick verification

Run:

```bash
node tests/run-all.js
```

Expected:

```text
world-cast-v19.test.js PASS
ALL V17 ASSET-ART TESTS PASS
```
