# 0.31 Interaction Pass

## Safe area
- MainActivity now runs edge-to-edge intentionally.
- GameView applies status/navigation bar insets to native controls and captions.
- Safe-area values are forwarded into Pixi so interactive targets avoid covered zones.

## Sound
- Added procedural Web Audio SFX; no external sound files.
- Local tap beats automatically use sound cues.
- Gemini may request only allowlisted `sound` cues.

## AI interaction
Added validated `InteractionPlan` modes:
- TEASE
- CHASE
- DECOY
- WAIT
- PREDICT
- MIRROR
- RHYTHM
- REWARD
- HIDE

`tapPattern` now includes average tap interval and interval jitter so Gemini can recognize steady rhythm.

## Compatibility
Preserves the latest GitHub fixes:
- guarded Pixi viewport initialization
- avoids unsafe Pixi `Application.screen` getter
- CSP allows Pixi v8 `unsafe-eval` runtime
