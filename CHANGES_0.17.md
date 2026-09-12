# 0.17 Direct World + Settings + Voice Guarantee

## Entry flow
- Removed the product-level start flow: the app enters the Living Canvas immediately.
- Language is no longer configured on a start screen.

## In-world settings
- Added a small top-right settings control.
- Settings opens as an overlay without leaving the world.
- Language can switch between Traditional Chinese and English.
- Gemini Live connection/API-key settings remain available from the same overlay.
- Settings blocks world taps while open, then closes back into the same persistent world.

## Gemini Live voice reliability
- The runtime now sends a fresh `start` event when Gemini Live becomes READY, because the world can start before the socket finishes connecting.
- Added `voiceCue` to AI context:
  - REQUIRED: live-ready/start events
  - ENCOURAGED: selected tap milestones and periodic world evolutions
  - SILENT_OK: routine interactions
- REQUIRED turns must use non-empty speech intent and must emit native Gemini Live audio after the tool call.
- Android TTS is still not used.
- Existing Live setup already uses AUDIO response modality and the Puck prebuilt voice.

## Product behavior
- World rendering/taps remain endless and immediate.
- There is still no timer, level, target button, miss, or game-over loop.

Build note: source was statically checked here; verify native audio behavior on-device with a real Gemini Live connection.
