# 0.8 Visual Worlds / Scene Fashion

- Added SceneDirector and five visual worlds: NEON, MINIMAL, COMIC, GLITCH, SPACE.
- Visual worlds affect ambient background, scene overlays, target treatment, speed/intensity and transition pulse.
- Added Gemini action `setVisualWorld(world, transition, intensity)`.
- Added `visualWorld` to Gemini context.
- Local Director now changes worlds at phase boundaries so visual transformation never waits on network:
  - INTRO NEON
  - RAMP MINIMAL
  - TRICK COMIC
  - CHAOS GLITCH
  - FINALE SPACE
- Combo milestones can trigger causal scene transformations at x5, x9 and x13.
- Existing Target System and Mechanic Engine remain compatible.
- Scene transitions are intentionally local/realtime; Gemini chooses meaningful overrides instead of micromanaging frames.

Build note: source was statically checked in this environment, but Android SDK/Gradle is unavailable here, so an actual APK compile still needs the local build agent.
