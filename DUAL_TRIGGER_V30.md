# v30 Dual Trigger + Shot Art Pass

v30 makes the act of tapping itself richer without adding decision pressure.

## Core interaction

The old single bottom action zone becomes two large side-by-side triggers that still share the same run progression and weapon evolution.

### FOCUS — Crystal Arc

- cooler crystal / glass visual language
- slightly faster projectile travel
- curved ribbon-like short trail rather than a long laser stroke
- diamond/crystal projectile body
- shard burst on impact
- ricochet and chain effects stay precise and thin

### BURST — Pulse Wave

- warmer gold / pink visual language
- slightly heavier/slower projectile travel
- round projectile body with layered after-image circles
- double shockwave on impact
- soft particle/bubble fragments instead of crystal shards
- feels heavier without turning into a realistic weapon

Both triggers inherit the same v28 evolution stack:

- Stage 3: double
- Stage 5: spread
- Stage 8: ricochet
- Stage 12: chain energy
- Stage 15: rain
- CHAOS thresholds still stack on top

The player never needs to choose a build. They can favor one trigger or mash both.

## Multi-touch

The runtime tracks pointer IDs independently, so two fingers can hold/tap FOCUS and BURST at the same time. Auto Barrage respects the held trigger mode and gives the two modes slightly different cadence.

## Art direction change

The v29 long bright projectile stroke has been removed as the primary shot language.

FOCUS uses a visible crystal body with a short layered trail. BURST uses a visible orb with soft circular after-images. Chain effects use small curved energy arcs rather than a single harsh beam.

The goal is toy-like / tactile / satisfying rather than military or hard sci-fi.

## Compatibility

v30 keeps:

- v28 Run Evolution
- v29 Tension Release
- Soft Landing
- Quiet Moment
- Pressure stages
- CHAOS thresholds

Compatibility APIs remain available:

- `window.DualTriggerV30`
- `window.TensionReleaseV29`
- `window.RunEvolutionV28`
- `window.EndlessChaosV27`

Version: `0.59.0-dual-trigger-v30` / versionCode `408`.
