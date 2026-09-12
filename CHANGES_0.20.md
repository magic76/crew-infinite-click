# 0.20 Godot VFX Spike

## Goal

Replace the visually limited Filament prototype with an embedded Godot VFX surface without rewriting the Android game runtime or Gemini Live pipeline.

## What changed

- Embedded **Godot 4.7.2** through the official Android AAR + `GodotFragment` host pattern.
- Added `WorldSurface` so Android gameplay no longer depends on a particular renderer.
- Added `GodotWorldBridge` and runtime `VisualBridgePlugin` signal transport.
- Android remains authoritative for taps, score/state, Gemini Live, language and settings.
- Godot receives JSON-only visual commands. No arbitrary script/shader generation is exposed to Gemini.
- Removed the active Filament renderer and `living_world.glb` from this spike.
- Kept the existing Canvas `LivingWorldEngine` as startup/failure fallback until Godot reports ready.

## Godot visual stack

The first spike intentionally concentrates on one strong procedural world instead of porting every old biome:

- animated procedural nebula / domain-warp shader
- six composition modes: CENTER, EDGE, DIAGONAL, SPIRAL, CLUSTERED, HOLLOW_CENTER
- five spatial grammars: FIELD, TUNNEL, VORTEX, GATE, SHARD_STORM
- seven environment layers: FOG, STARDUST, SMOKE, BUBBLES, ASH, POLLEN, GLITCH
- six material identities: GLASS, METAL, BIO, ENERGY, CRYSTAL, INK
- GPU particle burst
- gravity / black-hole particle pull
- portal ring particles
- shader shockwave distortion
- persistent tap echoes / cracks
- additive flash and bounded world warp

## Curated Gemini VFX actions

Gemini can optionally request one of these visual punctuation actions:

- `spawn_portal`
- `black_hole`
- `gravity_pull`
- `shockwave`
- `particle_burst`
- `world_crack`
- `glitch_world`

Each action only accepts normalized `x`, `y` and bounded `strength`. The model cannot send GDScript, shader source or arbitrary renderer commands.

## Important files

- `app/src/main/java/com/magic76/aiclicker/WorldSurface.java`
- `app/src/main/java/com/magic76/aiclicker/GodotWorldBridge.java`
- `app/src/main/java/com/magic76/aiclicker/VisualBridgePlugin.java`
- `app/src/main/assets/project.godot`
- `app/src/main/assets/godot/main.gd`
- `app/src/main/assets/godot/nebula.gdshader`
- `app/src/main/assets/godot/effects_overlay.gd`

## Deliberately not done yet

This is a **VFX spike**, not the final art system. It does not yet include curated texture packs, 3D meshes, SDF fluid simulations, lightning ribbons, post-process chromatic aberration or multiple authored Godot scenes. Those should only be added if this spike already feels materially more alive on-device.
