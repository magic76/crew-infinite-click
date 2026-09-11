# Architecture 0.16 — Living Canvas

## Runtime loop

Player tap
→ immediate `LivingWorldEngine.onTap()`
→ local procedural ripple / node mutation
→ `world_tap` event
→ Gemini Live
→ high-level WorldPlan
→ Runtime validates/parses
→ LivingWorldEngine continuously animates that plan

Separately:

every ~6–9.5 seconds
→ `world_tick`
→ Gemini may evolve the persistent world
→ renderer keeps moving even while the model is thinking

## Responsibility split

### Gemini
Chooses:
- world theme
- visual motif
- mood
- tap reaction
- evolution behavior
- palette
- density / motion / scale
- occasional voice reaction

### Local Runtime
Owns:
- every frame
- immediate tap feedback
- persistent state
- tap behavior metrics
- AI request aggregation
- safe screen-level shake/flash

### Renderer
Owns:
- procedural gradients/textures
- animated motifs
- eyes tracking recent touch direction
- jellyfish / vines / portals / shards / glyphs / stars / orbs
- tap pulses / cracks / multiply / attract / repel / warp
- drift / grow / pulse / orbit / flow / breathe

## Product invariant
**The player never waits for AI to make the world feel alive.**
