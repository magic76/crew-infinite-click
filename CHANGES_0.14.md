# 0.14 Tap-first Redesign

## Core rule
Never block the tap. Transform the tap.

## Input
- The whole game screen is tappable.
- Empty-space taps are first-class `world_tap` gameplay events.
- A target that visually changes before ACTION_UP still counts as a tap.
- Target hit areas are deliberately forgiving.
- There is no "miss" path in the player experience.

## Mechanics
- CHASE no longer moves on its own. It moves after a tap, then waits.
- BLINK no longer flickers continuously. A tap makes it vanish briefly, then reappear.
- SWARM no longer auto-shuffles. Each tap rearranges the swarm.
- SPLIT is no longer a "find the real one" puzzle. Every visible target is tappable.
- SHRINK keeps a readable minimum size and periodically resets instead of becoming impossible to hit.
- Structured correctness rules are disabled in the core loop for this experiment.

## AI role
DirectorPlan now supports `tapEffect`, consumed by the NEXT player tap anywhere:
- BOUNCE
- SPLIT
- VANISH
- SHOCKWAVE
- COLOR_SHIFT
- WORLD_FLIP

The AI still receives `clickSpeed` and is instructed to react to acceleration, slowdown, peak CPS and fast streaks, but it may not punish, block, or require precise aiming.

## HUD / Result
- HUD prioritizes TAPS, CHAOS and CPS instead of Score/Miss.
- Result screen makes TOTAL TAPS the primary result and keeps score secondary.
- Peak taps/sec remains visible.

## Opening
- The in-game opening prompt is now `按一下試試 / TAP ANYWHERE`.
- Offline Director also invites tapping instead of saying not to press.

Build note: source was statically checked here; verify Android build/run locally.
