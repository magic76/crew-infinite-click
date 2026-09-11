# 0.10 Architecture Consolidation

## P0 correctness fixes

- Added `RuleEngine`; structured rules now own correctness while active.
- Added `TapOutcome` pipeline so rule success cannot be penalized again by decoy logic.
- Removed fake/decoy ID prefixes from correctness decisions. Semantic `role` is authoritative when no rule exists.
- Fixed `SWAP_ROLES` semantics accordingly.
- Fixed Gemini transcript handling that incorrectly reset `activeTurnHadVoice` / `activeTurnSpeech` while receiving transcript chunks.
- Visual worlds no longer replace target fill colors, keeping color-based rules visually truthful.

## AI / Runtime boundary

- Added high-level `DirectorPlan` to the Gemini tool schema.
- DirectorPlan carries mechanic, rule, twist, visual world, transition and lease durations.
- Legacy micro-actions remain compatible but are no longer required for gameplay beats.
- Removed surprise-level action truncation that could apply only half of a semantic change.
- When a DirectorPlan is present, fragile element-ID mutations are skipped.
- AI scoring actions are ignored for DirectorPlan turns; click correctness/scoring stays local.

## Staleness and ownership

- Added semantic `stateVersion` to PLAYER_EVENT context.
- Gemini echoes it as `baseStateVersion`.
- Stale responses cannot apply ID-dependent mutations.
- Added mechanic and scene control leases; local pacing waits until an AI-authored beat expires.
- Local Director pauses mechanic replacement while a structured rule is active.

## Rule safety

- Plan rules are normalized and validated before commit.
- Runtime guarantees a solvable target for shape/color/role rules.
- Temporary rule-created targets are cleaned up when the rule expires.
- Temporary semantic changes to the primary target are restored after the rule ends.
- Inversion creates an extra target when needed so inverse largest/smallest/color/role rules do not become trivially impossible.
- WAIT timing now uses time since the previous player tap instead of Gemini response latency.

## Rendering / fashion fixes

- `PULSE`, `IMPACT`, `WIPE`, `GLITCH`, `ZOOM` now render differently.
- MINIMAL rendering no longer mutates `GameElement` state during drawing.
- MINIMAL rule HUD contrast improved.
- Target hit testing now respects circle/ring/dot, diamond and cross geometry instead of treating every target as a rectangle.
- Removed advertised `aggressive` behavior because it had no runtime implementation.

## Metadata / security

- Version updated to `0.10.0-architecture` (`versionCode 10`).
- Android app backup disabled because the prototype keeps the Gemini API key in private SharedPreferences.
- README rewritten to match the current 30-second architecture.

## Build status

Static Java structure checks pass in this environment. Android SDK/Gradle compilation is not available here; build the package with the local Android toolchain before merging/releasing.
