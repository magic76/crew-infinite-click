# Local agent — 0.20.1

Build/install normally:

```bash
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The 2D fallback was intentionally removed. Entering the world while Godot is unhealthy should show black behind the HUD.

Immediately capture startup logs:

```bash
adb logcat -c
adb logcat -s InfiniteClickGodot Godot GodotFragment AndroidRuntime
```

Healthy order:
1. Runtime plugin attached
2. Godot setup completed
3. Godot main loop started
4. GDScript scene reported ready
5. Godot renderer READY

If it stops at `GODOT SCENE`, inspect Godot/GDScript shader errors. If it stops before `GODOT LOOP`, inspect engine initialization / project asset loading.
