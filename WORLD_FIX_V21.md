# WORLD FIX V21

This patch focuses on the two issues seen in the review screenshot:

1. **The cast did not feel expanded**
   - All 10 cast members now start active from the beginning.
   - Their initial spawn positions are spread across the playfield.
   - Reset now restores the full cast instead of collapsing back to a smaller subset.

2. **The world maps were not visibly showing up**
   - Replaced the asset loader with a manual `Image()`-based loader.
   - Added load-status diagnostics through `ProductionAssetArt.status()`.
   - Increased world background visibility and reduced the dark overlay intensity.
   - Kept decorative overlays lighter so the map art is readable.

## Files changed
- `app/src/main/assets/game/game.js`
- `app/src/main/assets/game/production-asset-art.js`
- `app/build.gradle`
- `tests/world-visibility-v21.test.js`
- compatibility updates in existing tests

## Version
- `versionCode 399`
- `versionName 0.50.0-world-visibility-v21`

## Validation
- `node tests/run-all.js`
- `node -c app/src/main/assets/game/game.js`
- `node -c app/src/main/assets/game/production-asset-art.js`
