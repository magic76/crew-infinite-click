# Promise Chain v8

Base: `7e8e90f27f055ce0969c6149bf63f1b2b5233756` (`Apply world mutation overlay v7`).

## Goal

Replace text-driven FOMO with a continuous visual curiosity loop that still works with audio muted and Gemini disconnected.

The runtime always keeps one unanswered visual mystery alive. Before the current mystery finishes, the next one begins to leak into another part of the frame.

Flow:

`seed -> forming -> tension -> betrayal / false calm -> edge -> reveal -> next seed already visible`

There is no fixed N-tap phase table and no `KEEP GOING`, `ONE MORE?`, or `SO CLOSE` instruction text.

## New runtime

`promise-runtime.js`

Six local recipes:

- `RIFT`: something visible behind a crack / opening
- `ASSEMBLY`: fragments progressively form a sigil / device
- `SHADOW`: a ghost object becomes increasingly independent
- `TRANSFORM`: the primary target visibly mutates
- `ECHO`: repeated ghost targets / duplicated structure
- `FALSE_CALM`: anomaly fades as if finished, then returns close to reveal

Important properties:

- progress does not reset when the player pauses
- at about 62% development, the next mystery gets pre-seeded visually
- some promises insert a short false-calm beat
- tapping during false calm shortens it, making continued input meaningful
- reveal automatically hands off to the queued unresolved mystery
- PromiseRuntime allocates four Pixi Graphics once; the tap path allocates no Pixi display objects
- promise rendering is throttled to about 30fps

## Gameplay consequence

A reveal is not only a visual explosion. It routes a local consequence through the existing `ExperienceRuntime`:

- RIFT -> chase / escape
- ASSEMBLY -> predict / pulse
- SHADOW -> mirror / hide
- TRANSFORM -> chase / transformed pulse
- ECHO -> decoy / split
- FALSE_CALM -> fake ending / escape

`ExperienceRuntime` remains the only gameplay owner.

## World Mutation integration

Promise phases reinforce `WorldMutationRuntime` pressure.
Promise reveals feed the same persistent jackpot / rupture path.
World scars and epochs remain intact.

## AI role

Gemini does not control promise timing, drawing, progress, or reveal latency.

`DIRECTIVE.context.visualPromise` exposes current local truth:

- type
- phase
- progress
- betrayal state
- whether the next mystery is already visible
- chain / reveal counts

Gemini may use this only to choose a complementary or contrasting situation, target behavior, and composition. Existing AI plans also call `PromiseRuntime.steer(plan)`, which may bias the *next* promise type but never interrupt the current one.

## Removed v5-style FOMO

The old hidden short goal loop and its visible labels are retired:

- no `nextFomoGoal()`
- no `cycleTaps / goal / promiseStage`
- no `KEEP GOING`
- no `ONE MORE?`
- no `SO CLOSE.`

The FOMO cue must come from an unfinished visual, not copy telling the player to continue.

## Validation

`node tests/run-all.js` passes all JS tests including:

- PromiseRuntime progression and persistence
- pre-seeding next mystery before payoff
- false-calm / betrayal behavior
- continuous reveal -> next unresolved handoff
- no Pixi display allocation on tap path
- PromiseRuntime + WorldMutationRuntime integration
- reveal gameplay consequences stay under ExperienceRuntime ownership
- Gemini receives visualPromise context
- no regression in click juice, sparse voice, disabled signature moments, world mutation, pools, or world identity

All JS files pass `node --check`.

Android APK was not built in the ChatGPT container because Android SDK / project classpath are unavailable here.
