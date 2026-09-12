# 0.18.1 Filament Visibility Fix

This patch targets the black-screen symptom seen on device after 0.18.

## Fixes
- Replaced Filament `SurfaceView` with `TextureView`.
  - Keeps Filament in the normal Android View hierarchy.
  - Avoids SurfaceView composition / hole-punch behavior interfering with the Canvas fallback.
- Filament is no longer considered ready in the constructor.
- 2D Canvas fallback remains visible until ALL of these are true:
  - GLB loaded
  - at least one renderable exists
  - native render surface exists
  - viewport has a real size
  - at least one Filament frame successfully completed
- Explicitly initializes both Filament core and gltfio JNI layers.
- Added a dark-blue renderer clear color / brighter skybox, so a running renderer cannot look identical to an uninitialized black surface.
- Added one guaranteed center 3D beacon in front of the camera.
- HUD temporarily displays renderer health:
  - `3D`
  - `3D SURFACE`
  - `3D VIEWPORT`
  - `3D WARMUP`
  - `2D FALLBACK`

## Fallback behavior
If Filament fails at initialization, loading, swap-chain setup or first-frame rendering, the existing procedural 2D Living Canvas remains visible instead of exposing a black surface.
