# Local agent instructions — 0.20 Godot VFX Spike

Apply the contents of this package over the current `crew-infinite-click` Android project, preserving any newer local-only API key/build signing configuration.

## Build

Godot is now an Android Maven dependency; do **not** install a separate Godot editor/export template just to compile the app.

Preferred:

```bash
./gradlew :app:assembleDebug
```

If the repo does not contain a wrapper but Gradle is installed:

```bash
gradle :app:assembleDebug
```

Expected Maven artifact:

```text
org.godotengine:godot:4.7.2.stable
```

## If dependency resolution fails

1. Confirm `mavenCentral()` exists in `settings.gradle`.
2. Confirm Java 17 is being used.
3. Do not downgrade/remove the Godot dependency and silently fall back to Filament.
4. Report the exact Gradle error before changing architecture.

## Device smoke test

Run on a physical Android device and verify all of these:

1. App launches directly into Living Canvas; no permanent black screen.
2. Small renderer status changes from `GODOT INIT/LOAD/SYNC` to `GODOT`.
3. Even without a Gemini API key, tapping anywhere immediately produces:
   - field distortion / shockwave,
   - additive GPU particle burst,
   - tap echo ring.
4. Repeated taps do not recreate Godot nodes or leak obvious memory.
5. ATTRACT/WARP reactions produce gravity pull / portal behavior when generated locally or by Gemini.
6. Settings/language overlay remains tappable because `GameView` is still the Android input/HUD layer above Godot.
7. Gemini Live audio and reconnection behavior are unchanged.
8. Background changes visibly when WorldPlan layout/environment/material/composition changes.

## Logcat checks

Look specifically for:

```text
Godot
shader
SCRIPT ERROR
Parser Error
Vulkan
OpenGL
```

Any Godot parser/shader error is a blocker. Do not hide it by forcing the Canvas fallback.

## Architecture rule

Keep this ownership boundary:

```text
Android GameRuntime + Gemini Live
        |
        | compact validated JSON visual commands
        v
GodotWorldBridge -> VisualBridgePlugin -> Godot VFX scene
```

Godot is a renderer/VFX runtime only. Do not move score, event ordering, Gemini sockets, API-key storage, or gameplay authority into GDScript during this spike.
