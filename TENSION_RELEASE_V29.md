# TENSION_RELEASE_V29

v29 changes the emotional arc of the endless click run without removing v28's weapon progression.

## Core idea

**CHAOS goes up while TENSION comes down.**

The player can keep pressing as aggressively as they want, but the game increasingly absorbs that energy instead of amplifying it forever.

## Tension Release

- Every stage starts with a visible TENSION value.
- Button presses, direct hits, object hits, and weapon shots all release tension.
- TENSION crosses 75 / 50 / 25 / 0 with gentle feedback:
  - MAKING SPACE
  - SETTLING
  - ALMOST CLEAR
  - CLEAR
- Later normal stages begin with less tension, so the run gradually feels more settled.
- Pressure stages still begin near full tension to preserve a strong release moment.

## Soft Landing

Rapid tapping is treated as a signal to reduce sensory intensity, not punish the player.

When 7+ taps land within roughly one second:

- projectile travel slows down,
- world-effect density falls,
- screen shake is heavily reduced,
- CHAOS gain is damped,
- Reality Break becomes visually softer,
- Auto Barrage cadence relaxes.

The player can keep pressing. The game adapts around them.

## Quiet Moment

Every MEGA / PRESSURE stage (every 5 stages) now resolves into a 4.6 second quiet interval.

During the quiet interval:

- active lightning and projectiles are cleared,
- screen shake stops,
- CHAOS falls,
- TENSION stays at zero,
- the HUD becomes minimal,
- a slow breathing ring remains on screen,
- tapping creates only a soft ring instead of firing weapons.

Message:

> YOU CLEARED SOME SPACE.

There is no fail state and no breathing instruction to obey.

## Pressure Core

The v28 Boss mechanic remains internally compatible, but the visible framing is changed from defeating an enemy to clearing pressure.

Examples:

- OVERTHINKING CORE
- TANGLED CORE
- NOISE CORE
- STORM CORE

## Compatibility

- Keeps v28 Weapon Evolution and CHAOS threshold stacking.
- Keeps `window.RunEvolutionV28` and `window.EndlessChaosV27` compatibility APIs.
- Adds `window.TensionReleaseV29`.
- Adds tension / released / softLanding diagnostics.

Version: `0.58.0-tension-release-v29` / versionCode `407`.
