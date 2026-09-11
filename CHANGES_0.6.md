# 0.6 Director / Pacing Engine

## Goal
Make the 30-second run feel authored instead of randomly rotating mechanics. Gemini remains the creative director, while local runtime owns sub-second gameplay and pacing.

## Added
- Time-based 30s phase arc:
  - INTRO: 0-4s
  - RAMP: 4-10s
  - TRICK: 10-17s
  - CHAOS: 17-24s
  - FINALE: 24-30s
- Local Director that chooses mechanics without waiting for Gemini.
- Adaptive beat duration:
  - ~2.7s early
  - ~1.55s in finale
  - faster for high combo
  - slightly slower when player is struggling
- Mechanic anti-repeat memory to avoid boring immediate repeats.
- Phase-specific mechanic pools.
- Phase-specific background energy escalation.
- CHASE, BLINK and SWARM internally speed up toward the finale.
- Context sent to Gemini now includes `directorBeat` and `remainingMs`.
- Gemini prompt updated to treat `startMechanic` as an occasional creative override rather than per-click micromanagement.

## Behavior
The local Director owns normal transitions. Gemini can still change rules, speech, background, score consequences, UI mutations and occasionally override the current mechanic.

## Not build-verified here
This environment still does not contain an Android SDK/Gradle toolchain. Run `assembleDebug` locally before install testing.
