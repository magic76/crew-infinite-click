# 0.37 — English / Voice Performance / Visible Scene Takeover

## Why

0.36 still felt too similar in the normal game because the signature scene was optional. The voice also behaved like short text being read aloud rather than a performed game character.

## Changes

### English-only player experience
- All runtime fallback speech is English.
- Signature captions and fallback lines are English.
- Debug plans are English.
- Added an automated English-only source test.

### Voice performance
- ConversationDirector now emits a rotating delivery cue: DRY, TEASE, WHISPER, SNAP, CHALLENGE, FAKE_CALM, EXCITED, DEADPAN.
- GeminiConversationPolicy explicitly asks for performed English, not assistant-like narration.
- Signature moments provide their own dramatic delivery intent.
- Avoids repeating the same delivery in adjacent turns.

### Signature moments are now guaranteed
- Added SignatureMomentDirector.
- The first dramatic takeover is guaranteed after roughly four meaningful interactions.
- Later signature moments are spaced by both event count and wall-clock cooldown.
- The first guaranteed moment is SCREEN_SHATTER so the player immediately sees a scene-level visual change.

### New real scene-level signature: SCREEN_SHATTER
- Captures the actual game canvas.
- Splits the captured scene into 16 animated tiles.
- Throws the pieces into a black void.
- Then asks the player to stop touching the screen.
- Touching resets the wait and triggers a voice/haptic reaction.
- Staying still reassembles the scene.

This is deliberately not a particle preset. It changes the rendered scene itself.

### FLASHLIGHT_HUNT upgrade
- English-only.
- Darker overlay and smaller spotlight.
- Stronger visual vignette/ring.
- More dramatic voice delivery cues.
