# 0.9 AI Rule + Twist Director

## What changed
- AI now directs structured short-lived rules instead of only issuing low-level UI actions.
- New validated actions:
  - `setRule`
  - `clearRule`
  - `triggerTwist`
- Rules are evaluated locally at tap-time, so correctness and feedback do not wait for Gemini.
- Supported rule types:
  - ONLY_ROLE / AVOID_ROLE
  - ONLY_SHAPE / AVOID_SHAPE
  - ONLY_COLOR / AVOID_COLOR
  - LARGEST / SMALLEST
  - WAIT_AT_LEAST_MS
- Rule HUD shows the current instruction and remaining time.
- Rule violations immediately break combo, deduct score, shake and emit particles.
- Context sent to Gemini now includes authoritative `ruleState` with type/value/inverted/remainingMs/successes/failures.
- Supported twists:
  - INVERT_RULE
  - SWAP_ROLES
  - GHOST_ALL
  - NEON_ALL
  - CHAOS
- SWAP_ROLES has an unwinnable-state guard.
- Offline LocalDirector now exercises structured color and timing rules too.
- Visual Worlds / Target System / Mechanic Engine remain intact.

## AI role after this version
Gemini is responsible for creative rule selection, timing of twists, visual-world changes, narration and player adaptation.
The local runtime remains responsible for high-frequency motion, scoring, hit validation and immediate feedback.

Build note: static source checks passed here; actual Android compilation still requires the user's local Android toolchain.
