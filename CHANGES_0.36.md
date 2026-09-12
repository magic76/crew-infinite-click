# 0.36 Signature Moment Pass

This release deliberately stops adding abstract primitives and ships one finished, testable interaction: **FLASHLIGHT_HUNT**.

## What changed

### 1. Real signature moment
`web/signature-moment-runtime.js` implements a full 3–8 second micro-game:

- screen becomes almost fully dark
- a real radial flashlight hole follows the finger
- the target is relocated inside the safe interactive area
- finding it causes two escapes
- the final catch requires press-and-hold
- early release is detected and becomes a game event
- completion has its own haptic + voice beat
- signature moment temporarily owns input/staging so normal VFX/actions cannot collide with it

### 2. Input is no longer click-only
The runtime now treats these as meaningful player behavior:

- `tap`
- `drag`
- `slice`
- `hold_start`
- `release`
- `release_early`
- `hold_complete`
- `wait_broken`
- `idle_wait`
- `idle_hint`

Stopping is gameplay: during FLASHLIGHT_HUNT, inactivity triggers a reaction and later a temporary larger flashlight as a hint.

### 3. Conversation behavior
ConversationDirector now recognizes hold/release/idle/wait-break events as notable behavior. These should be routed as BANTER turns in the same Gemini Live session, not as a new autonomous loop.

### 4. Finished-scene isolation
When a signature moment starts:

- ordinary primitives are paused
- normal VFX plan is suppressed
- rule twists are suppressed
- ordinary AI UI actions are rejected for that turn
- global idle banter is paused because the signature moment owns idle timing

This prevents the old problem where multiple systems stack on top of each other and dilute the experience.

### 5. Gemini plan schema
`signatureMoment` is added to `apply_world_experience`:

- `NONE`
- `FLASHLIGHT_HUNT`

It should be rare. It is not a replacement for ordinary composed events.
