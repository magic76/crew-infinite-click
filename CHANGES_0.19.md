# 0.19 Visual Richness Pass

## Goal
Make the Living Canvas feel like a place instead of a small collection of floating primitives. Game rules and the tap-first product invariant are unchanged.

## Renderer
- Expanded `living_world.glb` from 18 to 48 render nodes while reusing the existing 18 meshes/materials.
- Split the 48 nodes into three visual layers:
  - 24 primary world-structure nodes
  - 16 atmosphere/environment nodes
  - 8 foreground silhouette nodes
- Kept the 0.18.1 front-node visibility guard and the existing Canvas fallback.
- Added a second directional fill light. Theme palette and `contrastLevel` now influence live lighting.
- Each spatial layout now has a stronger silhouette:
  - `TUNNEL`: repeated moving depth rings / corridor
  - `VORTEX`: tapered spiral funnel
  - `GATE`: layered portal architecture
  - `SHARD_STORM`: fast elongated directional shards
  - `FIELD`: broad layered volume
- Added composition transforms: `CENTER`, `EDGE`, `DIAGONAL`, `SPIRAL`, `CLUSTERED`, `HOLLOW_CENTER`.
- Added environment motion styles: `FOG`, `STARDUST`, `SMOKE`, `BUBBLES`, `ASH`, `POLLEN`, `GLITCH`.
- Added geometry/material identities: `GLASS`, `METAL`, `BIO`, `ENERGY`, `CRYSTAL`, `INK`.

## Tap payoff
Tap reaction is now deliberately three-stage:
1. immediate: two concentric GPU ripple rings
2. medium: geometry wave / attract / repel / warp around the touch
3. persistent: ~2.4 s authored afterglow that changes nearby scale / movement

## WorldPlan / Gemini
New persistent fields:
- `composition`
- `environment`
- `materialStyle`
- `particleLevel` (0..1)
- `pulseStrength` (0..1)
- `contrastLevel` (0.15..1)

The Live tool schema and system prompt now understand these fields and explicitly preserve visual continuity instead of randomly shuffling all layers each turn.

## Compatibility
Old/local WorldPlans remain valid: missing 0.19 fields receive deterministic defaults based on theme.
