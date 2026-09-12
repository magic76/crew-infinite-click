# FOMO v5

Changes:
- Flashlight Hunt uses Pixi hit testing (`e.global` + target `hitArea`) instead of DOM client coordinates.
- Flashlight gives immediate visual/haptic acknowledgement on a real hit and uses local text instead of Gemini chatter.
- Adds a variable-ratio local escalation cycle (roughly 6–10 taps, later slightly longer).
- Promise beats: `...` -> `KEEP GOING` -> `ONE MORE?`.
- Occasional near-miss extends a nearly-complete cycle by 1–2 taps (`SO CLOSE.`).
- Jackpot payoff is world-colored, pooled, bounded, and independent of sensoryDensity.
- No fixed 4-tap/8-phase loop is restored.
