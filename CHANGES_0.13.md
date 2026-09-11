# 0.13 Back to the Tap

## Goal
Restore the original compulsion loop: tap -> instant change -> tap again.

## Gameplay changes
- Wrong taps no longer subtract score or reset combo.
- Decoy/danger/rule misses become playful branches with movement, ghost/neon transforms, particles and light feedback.
- AI/local score penalties are ignored; tapping is never punished with score loss.
- Structured rules are now a single rare mid-run event at most, only when flow is already healthy.
- Rule timing window narrowed to roughly 11s-20.5s.
- HUD removes MISS and adds live CPS.
- Result screen shows Peak taps/s.

## Click speed signal
`clickSpeed` is sent to AI on every event context:
- cps
- averageIntervalMs
- lastIntervalMs
- peakCps
- deltaCps
- trend: ACCELERATING / STEADY / DECELERATING
- tier: IDLE / RELAXED / QUICK / FAST / FRENZY
- fastStreak
- totalTaps

Gemini is instructed to treat click speed as a gameplay instrument: react to acceleration, frenzy, slowdown and new peaks with speech, mechanic selection and scene energy.

## Local pacing
- FRENZY biases local pacing toward SWARM / BLINK / CHASE.
- ACCELERATING biases toward faster mechanics.
- DECELERATING immediately returns to CHASE.
- Offline LocalDirector also reacts to CPS and fast streaks.

Build note: source was statically checked here; final Android build should be verified locally.
