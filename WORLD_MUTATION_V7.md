# World Mutation v7 — Phase 1 complete local gameplay core

Base: `f0f8fa5aebcc8d7b8686b0207544c93f5dd35537` (`Remove find-it overlay in v6`).

## Goal

Make the screen itself feel like it is being changed by the player's tapping. The game should stay interesting with Gemini disconnected: immediate tap juice, short FOMO cycles, persistent world pressure, visible escalation, rupture, scars, and eventual world mutation all run locally.

## New local progression

`tap -> pressure -> stage 1/2/3/4 -> rupture -> permanent scar -> 2–4 ruptures -> world mutation`

Pressure is deliberately hidden. There is no numeric meter. The player reads progress from the background, target, audio, haptics, and world-specific effects.

Pressure cools when the player stops, but it never erases scars. Each rupture raises a small persistent floor, so a world does not visually return to a pristine state after a climax.

## Six world evolution languages

- `SPRING_BLOOM`: growth fields, vines, bloom clusters, persistent flower scars.
- `SUMMER_STORM`: darkening sky, moving bands, rain, lightning, persistent lightning scars.
- `AUTUMN_DECAY`: darkening warmth, branches, falling debris/leaves, persistent branch scars.
- `WINTER_FROST`: edge frost, crystal geometry, ice tension, persistent ice cracks.
- `VOID_CHAMBER`: orbit rings, moving nodes, central gravity well, persistent void holes.
- `NEON_RIFT`: moving grid, scan lines, glitch bars, persistent digital corruption.

Stage crossings also trigger a bounded pooled accent, local tone rise, and haptic cue. These accents are independent of sensoryDensity so a QUIET AI plan cannot hide mutation progress.

## Rupture and world mutation

A rupture does not reset the experience. It leaves a scar and restarts pressure from an increasingly unstable floor.

After a random 2–4 ruptures, WorldMutationRuntime asks ExperienceRuntime for a local world mutation. ExperienceRuntime remains the single gameplay owner and applies the new validated world plan. Ordinary Gemini/fallback plans are prevented from prematurely switching worlds while a mutation epoch is still in progress.

## AI role

Gemini now receives `context.worldMutation` with:

- world
- pressure
- stage
- ruptures
- epoch
- scars
- rupturesUntilWorldShift
- totalTaps

This context is advisory creative direction only. Gemini cannot reset the local mutation state and should not request an early world switch. Phase 1 remains fully playable without Gemini.

## Performance constraints

- One persistent WorldMutationRuntime.
- Four persistent Pixi Graphics layers; no display-object allocation in the tap critical path.
- Complex persistent background redraw is throttled to about 20fps.
- Existing particle/ripple/decoy pools remain bounded.
- World-stage punctuation uses the existing pooled FX controller.
- No fixed `every N taps -> phase X` machine was reintroduced.
- Signature moments remain retired.

## Verification

`node tests/run-all.js` passes, including new runtime and integration tests:

- world pressure progresses under sustained tapping
- ruptures leave persistent scars
- idle decay preserves scars and pressure floor
- 2–4 ruptures advance an epoch
- world shift still routes through ExperienceRuntime
- AI/fallback world shifts are locked until mutation allows them
- all six world evolution renderers exist
- tap path does not allocate new Pixi display objects
- prior FOMO / click juice / voice sparse / no-signature tests remain green

The local environment still has no Android SDK/Gradle wrapper, so this package was not device-built here. CI/local Android build should perform the final APK validation.
