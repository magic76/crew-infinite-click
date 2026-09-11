# 0.11 Momentum Pass

Goal: restore the core urge to keep tapping while preserving the richer 0.10 effects.

## Changes
- Added `MomentumEngine` with click rate, EMA click interval, hesitation, flow state and a 0..1 momentum value.
- Gemini context now includes authoritative `momentum` telemetry.
- AI prompt now optimizes for "one more tap" rather than maximum rule density.
- AI DirectorPlan `WAIT_AT_LEAST_MS` rules are rejected.
- New rules are accepted only during the middle of the run, when momentum is healthy, and are capped at 3.2s.
- Rule cooldown prevents back-to-back cognitive interruptions.
- A local momentum watchdog clears a rule and restores an obvious CHASE target when the player stalls for ~1.1s.
- Low-momentum AI SWARM/SPLIT requests are converted to CHASE.
- High-flow wrong taps outside active rules soften combo loss instead of resetting it to zero.
- Momentum adds a small score bonus and extra feedback at high flow.
- HUD shows FLOW/FRENZY only after momentum becomes meaningful.
- Finale SWARM turns extra targets into bonus targets: the last seconds are a tap frenzy instead of a correctness puzzle.
- LocalDirector no longer uses a wait-before-tap rule.
- Director pacing accelerates with momentum and uses readable mechanics when flow drops.

## Product principle
Rough target: ~80% of the round should invite immediate clicking; ~20% may introduce a short readable twist.

Build note: source was statically checked here. Android assemble/run still needs the local Android toolchain.
