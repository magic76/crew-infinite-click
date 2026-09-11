# 0.2 Mechanics Patch

## Added
- Start screen and result/restart screen.
- Real game lifecycle: START -> PLAYING -> RESULT.
- Per-run session ID and per-model-turn turn ID.
- Negative scoring and MISS counter; 5 mistakes ends the run.
- Runtime run limits: 36 interactions / 3 minutes.
- `endGame` model action with early-game gating.
- Pacing phase (`INTRO`, `BUILDUP`, `CHAOS`, `TWIST`, `FINALE`) in Gemini context.
- Persistent `activeRule` state via optional `rule` field in `apply_game_turn`.
- Safe content/play area based on status bar, navigation bar and display cutout insets.
- 44dp minimum touch hit area for tiny AI-created buttons.
- Score delta feedback and penalty shake.
- Gemini audio activity tracking and 2.5s Android TTS fallback when a tool turn produces no audio; late audio from that same turn is suppressed after fallback to avoid duplicate speech.

## Fixed
- Removed immersive system-bar hiding that caused edge overlap.
- Tool turns are not considered finished merely because UI actions were applied.
- Stale delayed tool calls are rejected using sessionId + turnId.
- Restart clears timers, recent per-run events, transient animations/effects and score/mistake state.
- Negative score changes are capped and only one penalty can apply per model turn.
- `setScore` can no longer erase accumulated score as a punishment.
- DEMO red-target success now stops `find_red`, preventing a delayed false timeout penalty.
- DEMO mode now has a real end condition after sustained play.

## Still requires device build verification
This environment does not contain Android SDK / Gradle, so the Java source was syntax-sanity-checked but not compiled into an APK here. Follow `LOCAL_AGENT_HANDOFF.md` for the local build/smoke test.
