# 0.15 Voice-first Live

## Core voice policy
If the game speaks, Gemini Live speaks.
Android TextToSpeech is no longer used as a voice fallback.

## Behavior
- Gemini Live owns all audible speech while connected.
- Offline/DEMO mode is caption-only and stays silent.
- A Live turn may intentionally stay silent.
- Routine taps should usually not produce voice.
- Voice is reserved for meaningful moments:
  - sudden acceleration
  - new peak tap speed
  - long fast streak
  - meaningful pause
  - major scene/tapEffect transformation
  - genuinely surprising player behavior

## Prompt changes
- `speech` is now a semantic intent/caption seed, not a verbatim script.
- Empty `speech` means a silent turn.
- If Gemini chooses to speak, it improvises naturally after the tool call.
- The voice persona is instructed to behave like a live performer, with varied timing and emotional energy.
- Repetitive stock phrases and narration of obvious UI/CPS/action names are discouraged.

## Runtime
- Removed Android TextToSpeech setup and fallback watchdog.
- Tool/UI fallback remains local so gameplay never waits on Live.
- Added a 6-second completion watchdog that only unblocks the event queue; it never synthesizes speech.
- Live transcript remains the authoritative caption when Gemini speaks.

Build note: source was statically checked here; verify Android build and native-audio behavior locally.
