# 0.12 Start / Result Screens + Language

## UI flow
- Added a complete start screen with a clear game title, short premise, 30-second description and primary Start button.
- Added explicit Traditional Chinese / English language selector.
- Selected language is persisted in SharedPreferences.
- Added a complete result screen with final score, taps, best combo, misses and fastest reaction.
- Result screen includes Play Again and Home.
- Home returns to the start screen so language can be changed before another run.
- Removed the automatic API-key dialog on first launch so it no longer blocks the start screen. Connection setup remains available from the footer.

## Language behavior
- `zh-TW` and `en-US` are supported.
- Runtime-generated mechanics/rules use the selected language.
- Offline LocalDirector localizes speech and visible labels.
- Gemini receives `language` in every context envelope and is instructed to use that language for speech and player-visible copy.
- Android TTS fallback switches between Traditional Chinese and English.
- HUD and result labels follow the selected language.

## Architecture
- Added `AppLanguage` as a small semantic language type.
- Language is owned by `GameRuntime` for gameplay state and persisted by `MainActivity`.
- Language switching is only exposed on the start screen; gameplay does not unexpectedly change language mid-run.
