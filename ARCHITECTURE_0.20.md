# 0.20 Renderer boundary

```text
Touch
  |
  v
Android GameView
  |-- immediate local tap -> GameRuntime
  |                         |
  |                         +-> Gemini Live event
  |
  +-> GodotWorldBridge ---- JSON ----> VisualBridgePlugin
                                      |
                                      v
                               Godot singleton signal
                                      |
                                      v
                                  main.gd
                             /          |          \
                      nebula shader  GPU particles  overlay echoes
```

## Why this boundary exists

The game needs two very different update speeds:

- deterministic interaction must react in the same local frame;
- AI can evolve the world asynchronously and occasionally add visual punctuation.

Therefore every tap gets an immediate local VFX response before Gemini answers. Gemini changes the persistent `WorldPlan` and can request only a small curated VFX vocabulary.

## Renderer readiness

`GameView` continues drawing `LivingWorldEngine` while the embedded Godot main loop is not ready. `GodotWorldBridge` waits briefly after the runtime plugin reports main-loop startup, then sends `reset` + current `WorldPlan`. Once ready, the Canvas world stops drawing and only the native HUD/input layer remains above Godot.
