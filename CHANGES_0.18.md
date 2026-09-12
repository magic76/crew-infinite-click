# 0.18 Filament 3D Living Canvas

## Renderer
- Added Google Filament as the native GPU renderer.
- Added `filament-android:1.76.1` and `gltfio-android:1.76.1`.
- Added a Filament `SurfaceView` below the existing native overlay.
- Canvas UI remains responsible only for settings, captions, HUD, shake/flash and a renderer fallback.
- No WebView and no Three.js bridge.

## 3D scene
- Added a compact `living_world.glb` with emissive spheres, rings and shard/cube geometry.
- Added `FilamentWorldView`:
  - Filament Engine / Renderer / Scene / Camera / SwapChain
  - glTF loading through gltfio
  - emissive PBR geometry
  - bloom/post-processing
  - directional light
  - persistent camera drift
  - tap-driven 3D energy/ripple rings
  - GPU-side transform animation driven locally each frame
- If Filament cannot initialize on a device, the existing Canvas procedural renderer remains as fallback.

## WorldPlan 3D vocabulary
Added:
- `layout`: FIELD / TUNNEL / VORTEX / GATE / SHARD_STORM
- `cameraMotion`: DRIFT / FORWARD / ORBIT / FLOAT
- `depth`: 0.15..1.0

Gemini receives and returns these fields as part of the persistent WorldPlan.

## AI responsibilities
Gemini still chooses WHAT:
- theme / motif / mood
- spatial layout
- camera behavior
- depth
- tap reaction
- palette / density / motion / scale

Filament decides HOW:
- camera interpolation
- geometry transforms
- actual depth placement
- local tap displacement
- 3D ripple transforms
- continuous frame rendering

## Interaction
- Full-screen taps remain immediate and never wait for Gemini.
- A tap bends/repels/attracts/warps nearby 3D geometry depending on WorldPlan.
- Tap creates 3D ring energy near the touched screen-space focus.
- AI continues evolving the world asynchronously through world_tick and player interaction.

## Existing product behavior retained
- App enters directly into the world.
- In-world settings control language and Gemini connection.
- Gemini Live remains the only audible voice.
- REQUIRED / ENCOURAGED / SILENT_OK voice cues remain.
- No timer, score objective, level or Game Over loop.

Build note: source and generated GLB were statically validated here. Final Gradle/Android device build should be run locally because this environment does not contain the Android SDK.
