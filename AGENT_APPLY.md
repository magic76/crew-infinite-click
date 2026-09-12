# Local Agent Apply Guide — 0.37

Apply this on top of the current 0.36 source. Do not redesign unrelated code.

## Goal

Make the user immediately feel a different game:
- English-only UI/speech;
- more dramatic Gemini Live vocal performance;
- a guaranteed early scene-level signature moment instead of optional demo content.

## Add

- `web/signature-moment-director.js`
- `tests/signature-moment-director.test.js`
- `tests/screen-shatter.test.js`
- `tests/english-only.test.js`

## Replace/update

- `web/signature-moment-runtime.js`
- `web/signature-debug.js`
- `web/conversation-director.js`
- `web/experience-runtime.js`
- `web/experience-director.js`
- `web/composition-debug.js`
- `web/gemini-plan-example.json`
- `android/GeminiConversationPolicy.java`
- `android/GeminiWorldToolSchema.java`

## Required script order

Load the signature cadence before `ExperienceRuntime` is constructed:

```html
<script src="safe-area.js"></script>
<script src="signature-moment-director.js"></script>
<script src="signature-moment-runtime.js"></script>
<script src="experience-runtime.js"></script>
<script src="signature-debug.js"></script>
```

## Construct SignatureMomentRuntime

Use the real gameplay target and the real Pixi canvas:

```js
const signatureMoments = new SignatureMomentRuntime({
  getPrimaryTarget: () => getPrimaryTarget(),
  getGameCanvas: () => app?.canvas || app?.view || document.querySelector("canvas"),
  haptics: GameHaptics,
  audio: audioMoodPlayer,
  onGameEvent: event => {
    const ctx = experience.onPlayerEvent(event);
    routeInteractionContextToExistingGeminiLive(ctx);
  },
  onSpeechRequest: ({ moment, phase, fallback, delivery, event }) => {
    // Reuse the existing Gemini Live connection.
    // BANTER only. Never call apply_world_experience from this callback.
    sendSignatureBanterToExistingLiveSession({
      moment,
      phase,
      fallback,
      delivery,
      event
    });
  }
});

const signatureDirector = new SignatureMomentDirector({
  firstEventMin: 4,
  cooldownEvents: 9,
  cooldownMs: 22000
});

const experience = new ExperienceRuntime({
  ...existingOptions,
  signatureMoments,
  signatureDirector
});
```

## Critical integration rule

Do not leave signature scenes as demo-only functions.

Normal gameplay must call `experience.onPlayerEvent(...)` for real player interactions. `SignatureMomentDirector` then guarantees the first `SCREEN_SHATTER` around the fourth meaningful interaction.

If the user can play for 10+ taps and never see SCREEN_SHATTER, integration is wrong.

## Voice

Append `GeminiConversationPolicy.systemPromptAppendix()` to the existing Gemini Live system instruction.

Pass `delivery` from ConversationDirector/signature speech into the BANTER context. Voice should be English only.

Do not change to a second Gemini socket/session.

## SCREEN_SHATTER acceptance

Run:

```js
runScreenShatterDemo(signatureMoments)
```

Pass only if:
1. The current actual game canvas is captured.
2. The whole game image splits into 16 visible tiles.
3. Pieces visibly fly/rotate away into black.
4. `YOU BROKE IT.` is large and impossible to miss.
5. The game then shows `DON'T TOUCH ANYTHING`.
6. Touching during the wait resets the timer and triggers speech/haptic feedback.
7. Staying still completes the wait and visibly reconstructs the scene.
8. No ordinary particle plan is drawn over the signature moment.

## FLASHLIGHT_HUNT acceptance

Run:

```js
runFlashlightHuntDemo(signatureMoments)
```

The screen must be almost black with a real finger-controlled circular opening. Final capture requires holding.

## Tests

```bash
for f in tests/*.test.js; do node "$f"; done
./gradlew assembleDebug
```

Do not add more VFX until both signature moments pass on a physical phone.
