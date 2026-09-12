# Architecture 0.18 — Filament 3D Living Canvas

```text
Gemini Live
   |
   | WorldPlan
   v
GameRuntime
   |
   +---- behavior metrics / tapPattern / world_tick
   |
   v
GameView bridge
   |
   +--------------------+
   |                    |
   v                    v
FilamentWorldView      Canvas overlay
GPU 3D world           settings / captions / HUD
   |
   v
living_world.glb
```

## Rendering ownership

### FilamentWorldView
Runs every frame without Gemini:
- camera
- spatial layout
- mesh transforms
- post processing / bloom
- PBR/glTF rendering
- tap energy and 3D ring response

### Gemini
Runs asynchronously:
- chooses coherent WorldPlan changes
- observes clickSpeed, tapPattern, current WorldPlan and worldRevision
- chooses larger spatial transformations only when behavior warrants them

### Canvas fallback
`LivingWorldEngine` remains available if Filament fails to initialize.

## Product invariant
The player never waits for the model to see a visual response.
