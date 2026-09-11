# 0.16 Living Canvas

## Product reset
The app is no longer a timed click game. It is now an endless AI-directed living canvas.

## Core interaction
- No 30-second run.
- No Game Over loop.
- No moving button target.
- No correctness, miss, rule, score, or chase loop in the active runtime.
- While inside the world, the entire screen is tappable.
- Every tap gets an immediate local procedural response.

## WorldPlan
Gemini now returns a persistent `worldPlan` instead of micromanaging UI.

WorldPlan fields:
- theme: COSMIC / ABYSS / GARDEN / CIRCUIT / DREAM / INK / LAVA / ICE
- motif: ORBS / STARS / EYES / JELLYFISH / VINES / PORTALS / SHARDS / GLYPHS
- mood: CALM / CURIOUS / PLAYFUL / EERIE / CHAOTIC
- tapReaction: BLOOM / RIPPLE / CRACK / ATTRACT / REPEL / MULTIPLY / WARP
- evolution: DRIFT / GROW / PULSE / ORBIT / FLOW / BREATHE
- palette: primary / secondary / accent
- density / motion / scale

Gemini is instructed to preserve continuity and evolve only part of the current world on most turns.

## Continuous evolution
- A local `LivingWorldEngine` renders and animates the current WorldPlan every frame.
- AI is not in the frame loop.
- The Runtime sends a `world_tick` approximately every 6–9.5 seconds even if the player is idle.
- world_tick lets Gemini keep growing or mutating the same world without requiring taps.
- Rapid taps are aggregated while Live is busy, so the UI stays immediate.

## Player behavior
Gemini receives:
- clickSpeed / CPS / acceleration / fast streak
- momentum / engagement state
- recent tap events
- tapPattern with centroid, spread, dominant area, last tap
- current WorldPlan and worldRevision

This lets the world react to where and how the player touches it.

## Voice
0.15 Voice-first behavior is retained:
- Gemini Live is the only audible voice.
- Routine taps and world ticks may remain silent.
- Voice is reserved for behavior or world changes worth reacting to.

## Code simplification
- GameRuntime reduced from the old mechanic/rule architecture to a small Living Canvas runtime.
- GameView was rewritten to contain only start/language UI, LivingWorld rendering, caption/HUD, full-screen tap input, shake/flash.
- Legacy click-game classes remain in the repo temporarily for history/possible deletion, but they are no longer referenced by the active runtime path.

Build note: source was statically checked here; final Android build should be verified locally.
