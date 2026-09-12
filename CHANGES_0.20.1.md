# 0.20.1 — Godot ready / black-fail fix

- Removed the 2D LivingWorld fallback while PLAYING. If Godot is not ready, the world is black.
- MainActivity now handles the official `GodotHost.onGodotSetupCompleted()` and `onGodotMainLoopStarted()` callbacks forwarded by `GodotFragment`.
- Readiness now requires a real GDScript scene handshake (`reportSceneReady()`), not a 260 ms timer.
- Added startup states: GODOT INIT / LOAD / LOOP / SCENE / GODOT.
- Added Logcat tag `InfiniteClickGodot` for startup diagnosis.
- Kept plugin `onGodotMainLoopStarted()` as a redundant signal, but it is no longer the only path.

Useful log command:

```bash
adb logcat -s InfiniteClickGodot Godot GodotFragment
```

Expected healthy sequence:

```text
Runtime plugin attached
Godot setup completed
Godot main loop started (GodotHost callback)
GDScript scene reported ready
Godot renderer READY
```
