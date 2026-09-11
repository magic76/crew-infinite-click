# 0.4 — 30s hard round + reactive background

- Normal round duration is now exactly 30 seconds.
- Added an independent hard deadline callback; the round ends even when no player event arrives.
- HUD always shows the main round countdown. AI challenge timers are shown separately as CHALLENGE timers.
- At TIME UP, gameplay input/score/timers/pending AI turn/TTS and queued turn state are stopped immediately before the result screen.
- Removed interaction-count and demo-count normal endings. Only the 30s clock or explicit mistake limit can truly end a round.
- AI `endGame` cannot arbitrarily finish a healthy round; fake endings remain ordinary UI.
- Added BackgroundEngine with animated gradient, moving grid/stars, tap ripples, particles and shockwaves.
- Local taps update the background immediately without waiting for Gemini.
- Gemini can control background theme, ambient effect, speed, intensity, ripple, shockwave and particle bursts through validated actions.
