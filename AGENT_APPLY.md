# Local Agent Apply Guide — 0.36

Apply this on top of the current 0.35 source. Do not redesign unrelated code.

## Goal

Ship one production-feeling signature event, `FLASHLIGHT_HUNT`, and make non-click input real gameplay.

## Add

- `web/signature-moment-runtime.js`
- `web/signature-debug.js`

## Replace/update

- `web/primitive-host-runtime.js`
- `web/conversation-director.js`
- `web/experience-director.js`
- `web/experience-runtime.js`
- `android/GeminiWorldToolSchema.java`

Preserve all 0.35 code unless this package explicitly changes it.

## Integration

### 1. Create SignatureMomentRuntime

After Pixi/game runtime exists:

```js
const signatureMoments = new SignatureMomentRuntime({
  getPrimaryTarget: () => getPrimaryTarget(),
  haptics: GameHaptics,
  audio: audioMoodPlayer,
  onGameEvent: (event) => {
    // Route through the existing ExperienceRuntime / ConversationDirector.
    // Signature events must NOT create a second autonomous loop.
    const ctx = experience.onPlayerEvent(event);
    routeInteractionContextToExistingGeminiLive(ctx);
  },
  onSpeechRequest: ({ phase, fallback, event }) => {
    // Reuse the current Gemini Live session as a BANTER turn.
    // Ask for one short natural reaction based on phase/player history.
    // Do not call apply_world_experience from this callback.
    sendSignatureBanterToExistingLiveSession({ phase, fallback, event });
  }
});
```

Pass it into ExperienceRuntime:

```js
const experience = new ExperienceRuntime({
  ...existingOptions,
  signatureMoments
});
```

### 2. Script ordering

Load after `safe-area.js` and before the code that constructs `ExperienceRuntime`:

```html
<script src="safe-area.js"></script>
<script src="signature-moment-runtime.js"></script>
<script src="experience-runtime.js"></script>
<script src="signature-debug.js"></script>
```

### 3. Gemini schema

Merge the updated `GeminiWorldToolSchema.java`. `apply_world_experience` gains:

```text
signatureMoment: NONE | FLASHLIGHT_HUNT
```

Never start a second Gemini connection for signature moments.

### 4. Pointer ownership

While `signatureMoments.isActive()` is true, its capture-phase pointer handlers own the scene. Do not attach another full-screen gesture handler above it.

### 5. Voice routing

Signature speech events should be short BANTER requests. Examples are fallbacks only; Gemini should vary wording using recent behavior.

Important phases:

- `start`
- `escape`
- `idle`
- `idle_hint`
- `hold_start`
- `release_early`
- `complete`

Do not let Gemini narrate the visual effect. It should react to the player.

## Real-device acceptance test

Run in a dev build:

```js
runFlashlightHuntDemo(signatureMoments)
```

Pass only if all are true:

1. Screen is visibly almost black, not just dimmed by ~20%.
2. Finger motion moves a clear circular flashlight opening.
3. Target can only be visually found through the opening.
4. Target escapes at least twice.
5. Final catch requires holding, not tapping.
6. Releasing early produces `release_early` and a voice/haptic reaction.
7. Holding to completion removes the darkness.
8. Doing nothing for ~3.2s creates `idle_wait` and a voice reaction.
9. Doing nothing longer creates `idle_hint` and temporarily enlarges the flashlight.
10. No ordinary particle/VFX/action plan fires on top of the signature scene.

If any item fails, fix the integration before adding another signature moment.

## Tests

```bash
for f in tests/*.test.js; do node "$f"; done
./gradlew assembleDebug
```
