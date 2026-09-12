# AI Infinite Click — 0.30 Pixi Reboot

This branch deliberately abandons the Filament/Godot direction.

The product is now an **AI Reactive Canvas**:

- every tap is immediately fun without waiting for Gemini
- PixiJS owns rendering and VFX
- Android owns Gemini Live, audio, session state, haptics and validation
- Gemini chooses dramatic intent, not pixels, HTML, JS or shader code
- the whole screen is always tappable

## Runtime architecture

```text
Android / Java
├─ MainActivity
├─ GeminiLiveClient
├─ GameRuntime
├─ PlayerProfile
├─ MomentumEngine
├─ LocalDirector
└─ GameView (thin WebView shell)
      │
      └─ local HTML runtime
          ├─ PixiJS WebGL
          ├─ micro-situation director
          ├─ particles / trails / portals
          ├─ shockwaves / glitch / cracks
          └─ local 60 fps reaction loop
```

There is **no Godot dependency** and **no Filament dependency**.

## Why this version is different

Older versions tried to make one persistent 3D world visually richer. That made the renderer the product.

0.30 reverses the responsibility:

```text
player input
  -> immediate local Pixi reaction
  -> Android records behavior
  -> Gemini chooses next dramatic intent
  -> validated ScenePlan + 0..2 allowlisted VFX
  -> Pixi stages the result
```

A slow Gemini turn cannot make the screen feel dead because the WebView performs the tap reaction first.

## Built-in micro-situations

The first offline loop intentionally demonstrates ~30 taps of variation:

1. TEASE — target reacts and challenges the player
2. ESCAPE — target keeps relocating
3. SWARM — decoys multiply, then collapse
4. GLITCH — screen slices and signal noise
5. PORTAL — rings open and warp nearby motion
6. ABSORB — black-hole pull changes particle trajectories
7. FRACTURE — cracks propagate from the tap
8. REVEAL — the scene goes quiet, then pays off

Gemini can then reshape these beats instead of generating frames.

## Gemini action allowlist

Only these renderer actions are accepted:

- `particle_burst`
- `shockwave`
- `portal`
- `black_hole`
- `gravity_pull`
- `world_crack`
- `glitch`
- `swarm`
- `dissolve`
- `screen_shake`
- `flash`

No arbitrary JavaScript, HTML or shader code is accepted from the model.

## PixiJS loading

The runtime uses PixiJS 8.20.1.

For a small test APK, the HTML runtime first checks for a bundled `pixi.min.js`; if it is missing it loads the pinned CDN copy.

For a production/offline build, vendor it once:

```bash
./scripts/vendor-pixi.sh
```

This writes:

```text
app/src/main/assets/game/pixi.min.js
```

After that the game runs without downloading Pixi at runtime.

## Build

```bash
gradle :app:assembleDebug
```

APK:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Debugging

WebView renderer logs:

```bash
adb logcat | grep -E "chromium|AndroidRuntime|AI Infinite Click"
```

Desktop inspection while a debug APK is running can be enabled locally with `WebView.setWebContentsDebuggingEnabled(true)` if desired. It is intentionally not forced on in this source.

If Pixi cannot initialize, the app shows `RENDER ERROR` rather than silently switching to an unrelated renderer.

## Current scope

0.30 is a reboot spike. It validates the interaction model and rendering architecture. It intentionally does not try to preserve the 3D worlds from 0.18–0.20.
