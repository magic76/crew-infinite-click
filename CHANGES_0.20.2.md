# 0.20.2 — Godot thermal + visibility fix

## Why
0.20.1 could show a black screen while the phone became very hot. The symptoms came from multiple layers:

- Godot was allowed to render uncapped (`application/run/max_fps=0` by default).
- The fullscreen nebula shader evaluated roughly 35 value-noise layers per pixel.
- Android `GameView` also scheduled itself every display frame while Godot rendered underneath.
- Android painted an opaque black rectangle until the full GDScript scene handshake completed, so a working Godot surface could be hidden by the diagnostic overlay.

## Changes
- Cap Godot at 45 FPS (`project.godot` + `Engine.max_fps = 45`).
- Use `gl_compatibility` for this 2D VFX spike.
- Replace the heavy multi-FBM shader with a mobile-safe shader using ~3 animated value-noise samples plus analytic rings/spirals/stars.
- Reduce GPU particle counts: burst 96, gravity 72, portal 56.
- Remove unconditional `GameView.postInvalidateOnAnimation()` during PLAYING.
- Split renderer states:
  - Godot surface becomes visible once the engine main loop starts.
  - VFX commands remain blocked until GDScript reports scene ready.
- Add staged GDScript boot telemetry: SCRIPT → BACKGROUND → PARTICLES → OVERLAY → WORLD → READY.
- Android listens for Godot state changes and redraws the HUD only when state actually changes.

## Expected behavior
If Godot itself starts, Android no longer covers it with a black rectangle. If VFX boot fails, the underlying Godot clear color remains black and the HUD/logcat reports the last completed stage.
