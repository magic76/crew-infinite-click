# Deprecated renderer assets

The active Android game path is WebView + PixiJS under `app/src/main/assets/game/`.

The following assets are legacy experiments and are **not part of the active runtime flow**:

- `app/src/main/assets/godot/`
- `app/src/main/assets/project.godot`
- `app/src/main/assets/living_world.glb`

They are intentionally retained for migration/history in this cleanup pass, but new runtime code must not route input, rendering, or gameplay state through them.

Likewise, the older native planning classes such as `GameRuntime` / `LocalDirector` remain in the tree only as compatibility/history code. `MainActivity` no longer instantiates them; gameplay ownership is `ExperienceRuntime` in PixiJS, with native code acting only as the Gemini Live transport and Android shell.
