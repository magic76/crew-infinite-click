# Toy Box Physics v13

v13 deliberately replaces the v12 "four moving stickers" opening with a chase-first toy loop.

## Player-facing changes
- Starts with one large Peach mascot, centered and easy to chase.
- Empty taps are tiny; near misses are visibly stronger; direct hits are dramatically stronger.
- Direct hits squash/stretch the sprite, kick the camera, flash locally, apply stronger haptics, and launch the mascot hard enough to bounce off the playfield walls.
- Wall bounces and pet-to-pet collisions create secondary effects and panic propagation.
- Hits build hidden toy energy toward a variable threshold. There is no visible meter and no text prompt.
- Toy events include SPLIT, BOUNCE_PARTY, SWARM and MERGE. New pets appear as consequences instead of all existing from frame one.
- MERGE temporarily hides pets and enlarges one mascot, then explodes the hidden pets back out.
- The background is now a clean soft toy box with large bumpers; grid/arrows/debug decoration are removed.

## Runtime / product changes
- Six sprite slots are preloaded but only one starts active, avoiding spawn-time image latency.
- Sprite loading keeps the Android native base64 asset bridge from v12.1.
- Gemini does not auto-connect in MainActivity.
- Native LIVE/language/settings bar and AI captions are hidden in v13.
- System bars use immersive sticky fullscreen.

## Performance
- 320 pooled particle graphics and 34 pooled ripple graphics.
- No per-tap `new PIXI.Graphics()` allocation.
- Sprite slots are preloaded and activated/deactivated instead of constructed during play.
