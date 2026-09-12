# Local agent handoff — 0.30 Pixi Reboot

Apply this source as a replacement for the current experimental renderer branch.

## Important

Do **not** merge Godot or Filament classes back in. 0.30 intentionally removes both.

## Recommended local steps

```bash
# optional but recommended so the APK works fully offline
./scripts/vendor-pixi.sh

# build
gradle :app:assembleDebug --stacktrace

# install
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## First smoke test

Run with no Gemini key first.

Expected:

1. Full-screen dark Pixi scene appears.
2. Top status changes from `PIXI DEMO`/boot state to `DEMO` after renderer ready.
3. Every tap instantly emits a ring + particles.
4. Roughly every four taps the behavior changes.
5. By ~30 taps you should have seen escape, swarm, glitch, portal, black-hole attraction, cracks and reveal/payoff.
6. Phone should stay materially cooler than the Godot branch because there is only one renderer and no heavy full-screen FBM shader.

Then add a Gemini key and confirm:

- status becomes `LIVE`
- voice still plays through native AudioTrack
- Gemini tool calls change ScenePlan/VFX
- visuals do not freeze while a Gemini turn is pending

## If renderer is blank

Check network first if `pixi.min.js` was not vendored. Prefer vendoring before debugging WebView rendering.

```bash
./scripts/vendor-pixi.sh
```

Then inspect WebView/Chromium errors:

```bash
adb logcat | grep -E "chromium|WebView|AndroidRuntime"
```

There is no renderer fallback in 0.30. A failure should be explicit (`RENDER ERROR`).

## Do not change on first pass

- Do not add Phaser.
- Do not add Three.js.
- Do not restore Godot.
- Do not let Gemini return arbitrary JS/shaders.
- Do not move Gemini into the WebView.

First verify that this interaction loop is actually fun.
