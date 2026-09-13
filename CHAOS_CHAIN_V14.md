# Chaos Chain v14

This pass keeps the v13 Toy Box Physics direction and deepens the chain reactions rather than adding more content.

## What changed

- Consecutive direct hits now build a visual combo halo.
- Every third hit creates a radial combo blast that pushes nearby cuties away.
- Five-hit chains can enter a short local Pinball Frenzy when multiple cuties are active.
- High-speed cutie-to-cutie collisions build a collision chain. Three fast collisions can also trigger Pinball Frenzy.
- Pinball Frenzy periodically re-kicks slowing cuties and adds motion trails so the chaos sustains itself for about 1.85 seconds.
- Strong near misses get a dedicated graze/whip effect and a little extra knockback.
- Empty taps can occasionally provoke a nearby cutie into a hop/celebrate taunt instead of producing only dead air.
- PINBALL joins SPLIT / MERGE / SWARM / BOUNCE_PARTY as a local surprise event.

## Still intentionally unchanged

- One large Peach starts alone.
- New cuties are introduced as consequences of play rather than pre-populated.
- Gemini/voice remains out of the gameplay path.
- Immersive UI stays hidden.
- Sprite loading still uses the Android native asset bridge/cache from v12/v13.
- Particle/ripple pools remain bounded.

## Product goal

The player should be able to create a visible chain:

`hit -> blast -> cutie launch -> wall/cutie collision -> collision chain -> pinball frenzy -> surprise event`

without text, meters, instructions, or model latency.
