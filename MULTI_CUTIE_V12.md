# Multi-Cutie Playground v12

This release replaces the single-pet loop with four simultaneous cuties and keeps AI/voice off the active gameplay path.

## Active cast
- Peach / SHY
- Spark / TRICKSTER
- Mint / CURIOUS
- Peach / GOOFY

All sprite atlases use one format: 2048x1024, 4x2 grid, 512x512 per frame.

## Interaction
Tap proximity is continuous rather than binary. Direct hits are impact 1.0, near misses decay through roughly 0.55-0.9, awareness range is roughly 0.12-0.48, and far taps have no character impact. The same impact value drives FX density/size, haptic strength, panic, and knockback.

## Group behavior
A hit or close flee can spread panic to nearby cuties. Cuties bump into each other and rebound. Rapid play can trigger rare synchronized hop, scatter, or celebrate actions.

## FX vocabularies
Peach uses hearts/soft diamonds, Spark uses lightning/star shapes, Mint uses leaves/diamonds. Direct hits add a stronger ray burst. All transient Graphics are drawn from bounded pools.

## AI
No Gemini gameplay scripts are loaded and all model/voice messages are ignored by the web runtime. Native voice kill remains in place from v10/v11.
