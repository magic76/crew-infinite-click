# AI Infinite Click — 0.34 Conversation & Contrast Pass

This is a cumulative integration package based on 0.33.

0.34 fixes two product-level issues:

1. the visual density system existed but did not look different enough on a phone;
2. Gemini speech was coupled to infrequent scene changes, so the AI did not feel conversational.

## New architecture

```text
Player event
   |
   +--> local immediate feedback (GameRuntime / VFX / optional haptic)
   |
   +--> ConversationDirector
           |
           +--> SILENT     -> no Gemini call
           +--> BANTER     -> same Gemini Live session, AUDIO only, no tool call
           +--> GAME_TURN  -> same Gemini Live session -> apply_world_experience -> FunctionResponse
```

There is still only one Gemini Live session and one authoritative GameRuntime.

## Main new file

```text
web/conversation-director.js
android/GeminiConversationPolicy.java
```

## Stronger density contrast

```text
QUIET   -> 0 ambient, almost no sensory feedback
NORMAL  -> 4 ambient
BUSY    -> 26 ambient + much larger bursts
CHAOS   -> 42 ambient + full-screen accent + crowd burst
```

CHAOS is intentionally rare and followed by a hard drop to QUIET.

## Debug verification

`web/contrast-debug.js` is debug-only. Load it only in a dev build and run:

```js
runSensoryContrastDemo(experience)
```

It cycles QUIET -> NORMAL -> BUSY -> CHAOS -> QUIET so QA can visually verify the difference without waiting for the AI director.

## Tests

```bash
node tests/experience-director.test.js
node tests/sensory-director.test.js
node tests/conversation-director.test.js
node tests/experience-runtime.test.js
```

See `AGENT_APPLY.md` for integration details.
