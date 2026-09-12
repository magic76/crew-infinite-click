# Local agent handoff — 0.20.2

Build/install this version and capture the renderer boot status.

```bash
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb logcat -s InfiniteClickGodot Godot GodotFragment AndroidRuntime
```

Expected startup log sequence:

```text
Runtime plugin attached
Godot setup completed
Godot main loop started
Godot stage: SCRIPT
Godot stage: BACKGROUND
Godot stage: PARTICLES
Godot stage: OVERLAY
Godot stage: WORLD
GDScript scene reported ready
Godot renderer READY
```

If it stops at a stage, inspect the first Godot error immediately after that stage. Do not restore the 2D fallback.

Thermal acceptance test:
- Leave the world running for 3 minutes without tapping.
- Confirm the phone no longer becomes rapidly hot.
- Confirm `adb shell dumpsys gfxinfo com.magic76.aiclicker` is not showing a second Android full-frame animation loop.
