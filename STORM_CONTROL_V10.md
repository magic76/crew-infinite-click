# Storm Control Room v10

Base: GitHub main commit `4dfa12525c6acaaaad6ce6b9398df213407cf1f8` (`Apply shape language overlay v9`).

## Goal
Replace the abstract multi-world visual pilot with one finished-looking physical scene that changes both composition and interaction focus. AI remains an asynchronous silent director only.

## Scene loop
- `DORMANT` -> first touch wakes the room.
- `CHARGING` -> the central power core energizes segmented bus bars and cable routes.
- `INSTABILITY` -> rain/lightning, electrical arcs and the breach door become visibly unstable.
- `FALSE_CALM` -> room blacks out instead of paying off immediately.
- `REROUTE` -> the central core becomes non-interactive/hidden; three physical lower-console nodes become the interaction surface.
- `BREACH_HINT` -> rerouting power makes the door/window mystery stronger.
- `PARTIAL_REVEAL` -> the door opens only a narrow gap and a silhouette is visible; continued interaction starts another reroute cycle without fully resolving the mystery.

Progress is state/energy based rather than a fixed old tap-count phase table. Fast tapping can accelerate electrical pressure, but spatial interaction with different room zones is required after reroute.

## Physical scene layers
- metal wall/panel depth
- rain-filled observation window
- heavy two-panel breach door + physical locks
- central power-core housing + segmented bus bars
- cable routes between subsystems
- lower three-node control console
- warning stripes / steam / electrical arcs / lightning

There is no instructional scene text and no PromiseRuntime overlay in the v10 pilot.

## AI voice disabled
AI is tool-only in v10:
- ConversationDirector never emits BANTER.
- every model directive forces `voiceWanted=false`.
- tool schema no longer has `speech`.
- tool schema is locked to `SUMMER_STORM`.
- GeminiLiveClient has `VOICE_OUTPUT_ENABLED=false` and every turn starts audio-suppressed.
- MainActivity ignores accidental model audio/transcript callbacks.
- ExperienceRuntime strips speech and pins the pilot scene to `SUMMER_STORM`.

AI receives `DIRECTIVE.context.scene` and may only bias the next background direction/anomaly. It cannot advance the local scene, change worlds, or enter the touch critical path.

## Validation
Run:

```bash
node tests/run-all.js
```

Expected: `ALL V10 JS TESTS PASS`.

All JS files under `app/src/main/assets/game` also pass `node --check` in the packaging environment.

Android APK was not built in the packaging environment because Android SDK/Gradle tooling is not available there.
