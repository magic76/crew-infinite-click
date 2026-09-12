# AI Infinite Click 0.34 — Local Agent Apply Guide

Apply this on top of the user's latest working 0.33 tree. Do not rebuild the project or replace working Gemini/Pixi/GameRuntime infrastructure.

## 1. Preserve existing architecture

Keep:

- one Gemini Live WebSocket/session;
- existing PCM audio playback;
- existing `apply_world_experience` synchronous function response path;
- GameRuntime as authoritative state/action validator;
- 0.32 Android safe-area integration;
- 0.33 native HapticEngine;
- current score/profile/state persistence.

Do **not** create a second agent loop.

## 2. Copy/merge files

Web:

```text
web/conversation-director.js          NEW
web/experience-runtime.js             UPDATED
web/sensory-director.js               UPDATED
web/world-fx-controller.js             UPDATED
web/contrast-debug.js                 NEW (debug only)
```

Android:

```text
android/GeminiConversationPolicy.java NEW
android/GeminiWorldToolSchema.java    UPDATED
```

The other Java files are cumulative copies from 0.33. Change the placeholder package:

```java
package com.crewpocket.aiclicker.v034;
```

to the app's real package.

## 3. JS load order

Production:

```html
<link rel="stylesheet" href="safe-area.css">
<script src="safe-area.js"></script>
<script src="world-catalog.js"></script>
<script src="experience-director.js"></script>
<script src="sensory-director.js"></script>
<script src="conversation-director.js"></script>
<script src="haptic-bridge.js"></script>
<script src="audio-mood-player.js"></script>
<script src="world-fx-controller.js"></script>
<script src="experience-runtime.js"></script>
```

`contrast-debug.js` must not be loaded in release unless the project already has a guarded dev-tools bundle.

## 4. Create ConversationDirector inside the existing ExperienceRuntime

```js
const conversation = new ConversationDirector({
  profileAccessor: () => gameRuntime.getPlayerProfile?.() || {}
});

const experience = new ExperienceRuntime({
  gameRuntime,
  director,
  sensory,
  conversation,
  fx: worldFx,
  audio: audioMood,
  haptics: window.GameHaptics,
  profileAccessor: () => gameRuntime.getPlayerProfile?.() || {},
  getPrimaryTarget: () => {
    const target = gameRuntime.getElement?.("main_button");
    return target ? {x:target.x,y:target.y} : null;
  },
  onRuleTwist: (rule,plan) => gameRuntime.setTemporaryRule?.(rule,plan),
  onSpeech: (speech) => window.setCaption?.(speech)
});
```

## 5. Route every player event through the new mode

Existing immediate local call remains:

```js
const aiContext = experience.onPlayerEvent({
  type:"click",
  targetId,
  x,
  y,
  totalClicks:gameRuntime.totalClicks,
  correct,
  ignoredWarning
});
```

Then inspect:

```js
const mode = aiContext.interaction.mode;
```

### SILENT

```js
if (mode === "SILENT") {
  return; // no network/model event
}
```

This is intentional. Constant speech becomes noise too.

### BANTER

Send a compact event to the **already-open** Gemini Live session.

Use `GeminiConversationPolicy.buildTurnText("BANTER", compactContext)` or equivalent existing JSON/message builder.

Critical instruction:

```text
SPEAK ONLY.
Do not call any function/tool.
Do not change the UI.
One short natural reaction to the player's behavior.
```

Examples of the desired personality:

```text
「你真的每顆都要按是不是？」
「……你又選這顆。」
「你現在是在懷疑我嗎？」
「好啦，這次真的不騙你。」
「一、二——欸，你太快了。」
```

Do not hard-code these lines; they illustrate tone only.

### GAME_TURN

Send the compact event with mode `GAME_TURN`.

Instruction:

```text
React briefly in voice, then call apply_world_experience exactly once.
The line should be a setup/punchline, not a narration of the visual effect.
```

When the tool call arrives:

1. sanitize/apply through the existing Runtime;
2. send the existing synchronous `toolResponse.functionResponses` acknowledgement;
3. let the same Live session continue its audio response.

Do not open another WebSocket.

## 6. Avoid double speech

With Gemini Live AUDIO active, do not separately synthesize `plan.speech` with another TTS path.

`plan.speech` in 0.34 is optional and should be used only for:

- caption fallback;
- offline/local-director fallback;
- logging/debug.

If output transcription from Gemini Live is available, feed the final spoken line into:

```js
experience.recordSpokenLine(transcript);
```

This improves repeat avoidance.

## 7. Add idle banter polling

Use one cheap local timer (not another agent loop):

```js
setInterval(() => {
  const ctx = experience.pollIdle(gameRuntime.getCompactSnapshot?.() || {});
  if (!ctx) return;
  sendExistingGeminiLiveEvent(ctx); // BANTER only
}, 500);
```

Default idle beats:

```text
~4.3s -> first possible voice-only reaction
~9.0s -> second possible voice-only reaction
```

There are no repeated idle messages after stage 2 until player activity resets the idle state.

## 8. Stronger visual contrast

0.34 density values:

```text
0 QUIET   ambient 0   create/duplicate budget 1   recommended interactive 1
1 NORMAL  ambient 4   create/duplicate budget 2   recommended interactive 4
2 BUSY    ambient 26  create/duplicate budget 7   recommended interactive 18
3 CHAOS   ambient 42  create/duplicate budget 10  recommended interactive 34
```

Behavior requirements:

- QUIET means truly quiet: zero ambient particles, no click burst, no decorative plan VFX.
- BUSY must be obviously more populated than NORMAL.
- CHAOS should visibly transform the frame for a short beat.
- after CHAOS, `SensoryDirector` forces about 3.2s of QUIET.
- do not keep a permanent particle emitter underneath QUIET.

The global GameRuntime max-elements safety limit remains authoritative.

## 9. Important VFX bug fixed

0.33 had code equivalent to:

```js
const multiplier = Number(this.sensory.burstMultiplier) || 0.6;
```

That makes a valid `0` fall back to `0.6`, so QUIET still emits particles.

0.34 explicitly preserves zero and returns before spawning burst particles.

Do not reintroduce `|| default` for numeric fields where zero is meaningful.

## 10. Situation timing

Old 0.33:

```text
10-30s
```

0.34:

```text
minimum ~6.5s
maximum ~18s
```

This does not mean speech waits 6.5 seconds. BANTER happens independently between game turns.

## 11. Gemini system prompt

Append `GeminiConversationPolicy.systemPromptAppendix()` to the existing game-host system instruction.

Key policy:

```text
You are the mischievous host of an infinite click game, not an assistant.
Most spoken reactions are short and conversational.
Observe behavior; tease, predict, question, fake-reassure, or pause.
Do not narrate obvious UI changes.
For BANTER: voice only, no tool.
For GAME_TURN: react briefly, call apply_world_experience exactly once.
```

Do not make the AI hostile, insulting, or exhausting.

## 12. Debug contrast verification

In a dev build only, load:

```html
<script src="contrast-debug.js"></script>
```

Then from console/debug bridge:

```js
runSensoryContrastDemo(experience)
```

You must visually see four distinct beats:

```text
QUIET -> almost empty
NORMAL -> restrained
BUSY -> clearly dense/moving
CHAOS -> unmistakable full-frame burst
then -> empty QUIET
```

If BUSY looks like NORMAL on the actual phone, increase presentation scale/effect size in the existing renderer; do not weaken the director again.

## 13. Tests

Run:

```bash
node tests/experience-director.test.js
node tests/sensory-director.test.js
node tests/conversation-director.test.js
node tests/experience-runtime.test.js
./gradlew assembleDebug
```

Then real-device checks:

1. rapid taps do not cause continuous overlapping voice;
2. some taps intentionally receive no speech/no haptic;
3. many ordinary events produce voice-only banter without UI changes;
4. idle 4-5 seconds can trigger one natural voice reaction;
5. BANTER never calls `apply_world_experience`;
6. GAME_TURN calls it exactly once and the tool response unblocks Live audio;
7. QUIET has zero ambient/click particles;
8. BUSY and CHAOS are obviously different from NORMAL on-device;
9. after CHAOS the screen becomes sparse instead of remaining busy;
10. safe-area and max-elements validation remain intact.
