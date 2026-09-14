# ACTION_BUTTON_V24

## Goal
Turn the lower black box into an intentional large action button so users can keep pressing it for fast, varied payoff.

## What changed

### 1. Added a persistent bottom action button
A large themed button is now rendered at the bottom center of the screen. It visually replaces the previous “just looks like a black box” feeling with a clear interaction target.

Behavior:
- tapping the button does **not** perform a normal pet tap
- it triggers a dedicated action-button event path
- it pulses, squishes, glows, and reacts to world theme + recent press energy

### 2. Added button-triggered action modes
The button now rotates through multiple effect outcomes so repeated pressing stays interesting.

Action set:
- `SHOOT` — fires projectile/comet style shots toward pets
- `QUAKE` — strong screen shake / impact wave / launches pets
- `THUNDER` — lightning strikes + flash + shock
- `CASCADE` — world-themed rain / falling motifs / celebration energy
- `PULSE` — expanding rings / radial push / crowd reaction
- `WORLD` — can force a world shift and sometimes trigger a toy event

### 3. Rapid presses scale the payoff
Button power is influenced by:
- streak
- recent press count
- current gameplay state

That means users can spam the button and still get escalating visual variety instead of identical feedback.

### 4. Added diagnostics
New debug info:
- `buttonPresses`
- `lastButtonAction`

## Files changed
- `app/src/main/assets/game/game.js`
- `app/build.gradle`
- `tests/run-all.js`
- `tests/action-button-v24.test.js`
- patched compatibility tests to allow v24 version lineage

## Version
- renderer id: `ACTION_BUTTON_V24`
- versionCode: `402`
- versionName: `0.53.0-action-button-v24`

## Test result
`ALL V24 ACTION-BUTTON TESTS PASS`
