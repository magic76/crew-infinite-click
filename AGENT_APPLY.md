# 0.35 Apply Guide

Apply this on top of the user's latest working 0.34 branch. Do not rebuild the project from scratch.

## Script load order
Load these before `experience-runtime.js`:

1. `world-catalog.js`
2. `primitive-catalog.js`
3. `experience-composer.js`
4. `interaction-primitives.js`
5. `primitive-host-runtime.js`
6. existing `sensory-director.js` / `conversation-director.js` / FX/audio modules
7. `experience-director.js`
8. `experience-runtime.js`

## Required host wiring
Create one `PrimitiveHostRuntime` using the actual Pixi gameplay container and primary clickable target. Wire it to `InteractionPrimitives` callbacks:

```js
const primitiveHost = new PrimitiveHostRuntime({
  gameplayContainer: gameWorldContainer,
  getPrimaryTarget,
  getViewport: () => ({width: app.screen.width, height: app.screen.height}),
  onGameEvent: event => dispatchPlayerEvent(event),
  onSurfaceMode: mode => setSurfaceRenderer(mode),
});

const primitives = new InteractionPrimitives({
  fx: worldFx,
  getPrimaryTarget,
  onInteraction: mode => primitiveHost.setInteraction(mode),
  onSpatial: mode => primitiveHost.setSpatial(mode),
  onCamera: mode => primitiveHost.setCamera(mode),
  onSurface: mode => primitiveHost.setSurface(mode),
  onTiming: mode => primitiveHost.setTiming(mode),
});

const experience = new ExperienceRuntime({
  ...existingOptions,
  primitives,
  composer: new ExperienceComposer(),
});

app.ticker.add(ticker => primitiveHost.tick(ticker.deltaMS || 16));
```

Feed existing pointer events into `primitiveHost.pointerDown / pointerMove / pointerUp`. Do not keep the old handler firing a normal click after a successful HOLD/DRAG/SLICE; dedupe gesture completion.

## Surface primitives
`FRAGMENT` and `LIQUID` are intentionally renderer adapters because Pixi APIs differ by project version. Implement them against the actual renderer:

- `FRAGMENT`: snapshot the gameplay container to a RenderTexture, split it into 6–16 rectangular sprites, animate pieces apart/reassemble, then restore the live container. It must actually fragment the rendered scene; do not fake this with particles.
- `LIQUID`: use the project's supported displacement/filter path or mesh deformation. If no compatible filter exists, temporarily disable LIQUID in `primitive-catalog.js`; do not substitute generic particles.
- `TRAIL`: retain 4–8 fading snapshots/ghost positions of the primary target.

## Gemini Live
Keep the same Live session and existing synchronous `FunctionResponse` behavior. Extend `apply_world_experience` using `GeminiWorldToolSchema.java`; do not add another model/session/agent loop. Gemini proposes `experienceIntent` and `composition`; JS `ExperienceComposer` remains authoritative.

## Personality
Keep 0.34 BANTER turns. Speech-only banter must not call the tool. GAME_TURN may speak briefly, then call `apply_world_experience` once.

## Verification
Run:

```bash
node tests/experience-composer.test.js
node tests/primitive-host-runtime.test.js
node tests/conversation-director.test.js
node tests/experience-director.test.js
node tests/experience-runtime.test.js
node tests/sensory-director.test.js
./gradlew assembleDebug
```

Real-device checks:
1. HOLD requires holding; a quick tap must not count as HOLD.
2. DRAG sends changing x/y and visibly drags/affects the target.
3. SLICE requires a real fast swipe distance, not a tap.
4. GRAVITY changes the actual target position.
5. CAMERA changes the gameplay container, not only overlay particles.
6. FRAGMENT splits the rendered game scene into pieces.
7. Run 10+ GAME_TURNs and verify compositions do not repeatedly differ by only one cosmetic dimension.
8. Existing safe-area, haptic, banter, density and GameRuntime validation continue working.

## Deterministic device showcase
In a dev build, load `web/composition-debug.js` and call:

```js
runCompositionShowcase(experience, 5000);
```

This bypasses AI randomness and must visibly demonstrate four structurally different combinations. Remove/disable the debug entry point in release builds.
