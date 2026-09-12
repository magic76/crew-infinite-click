# 0.30 Pixi Reboot

## Removed

- Godot runtime and Android Godot bridge
- Filament renderer
- GLB world asset path
- 3D world/layout/material machinery
- Android Canvas frame renderer
- old SceneDirector / RuleEngine / element rendering stack

## Added

- WebView-based visual surface
- PixiJS 8.20.1 loader
- local Pixi micro-situation director
- `ScenePlan` high-level AI contract
- curated visual action allowlist
- portal, black hole, gravity, crack, glitch, swarm, dissolve, shockwave and particle effects
- immediate local tap reaction before the LLM event is sent
- pinned optional Pixi vendor script
- player profile in Gemini context

## Behavior

The first 32 taps cycle through eight 4-tap micro-situations so DEMO mode is useful without any API key.

Gemini no longer returns a detailed persistent `WorldPlan`; it returns a small dramatic `ScenePlan` plus at most a few curated VFX actions.
