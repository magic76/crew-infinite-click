# 0.34 — Conversation & Contrast Pass

## Why 0.33 felt too similar

0.33 had correct pacing constraints, but its visible delta was too small:

- ambient targets were close enough that CALM/LIGHT/ACTIVE often looked alike on a phone;
- QUIET still leaked click particles because the VFX multiplier fallback treated `0` as falsy;
- the situation lock lasted 10–30 seconds, so Gemini speech was effectively tied to infrequent world-plan changes;
- strong VFX existed, but they were mostly triggered only when `apply_world_experience` ran.

## 0.34 changes

### Conversation routing

Adds `ConversationDirector` with three turn modes:

- `SILENT`: local feedback only; do not contact Gemini.
- `BANTER`: send event to the existing Gemini Live session; model speaks only; no tool call/UI mutation.
- `GAME_TURN`: model reacts briefly and calls `apply_world_experience` exactly once.

Default cadence:

- min speech gap: 1500 ms
- min game-turn gap: 6500 ms
- first idle banter: ~4300 ms
- second idle banter: ~9000 ms

### Stronger visual contrast

Density semantics are now:

| Level | Name | Ambient target | Create/duplicate budget | Recommended interactive count |
|---|---|---:|---:|---:|
| 0 | QUIET | 0 | 1 | 1 |
| 1 | NORMAL | 4 | 2 | 4 |
| 2 | BUSY | 26 | 7 | 18 |
| 3 | CHAOS | 42 | 10 | 34 |

CHAOS is short and then hard-drops to QUIET for ~3.2 seconds.

### VFX fixes

- density 0 now produces zero click particles;
- entering QUIET clears transient VFX instead of letting old effects linger;
- entering CHAOS adds a full-screen accent;
- CHAOS adds `crowdBurst()` so the screen is unmistakably more populated for a short beat;
- click burst can reach 40 transient particles at high density;
- QUIET plays no decorative plan VFX.

### Voice behavior

The system-prompt policy now explicitly says:

- act as a mischievous game host, not an assistant;
- banter may be a tease, observation, prediction, question, or fake reassurance;
- do not narrate obvious UI changes;
- do not explain mechanics during banter;
- avoid repeating recent lines;
- BANTER must not call tools;
- GAME_TURN calls `apply_world_experience` once.

`GeminiWorldToolSchema.speech` is now optional. Live audio is primary; the field is a caption/fallback only.
