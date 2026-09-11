# Architecture 0.10

## Authority hierarchy

1. **GameRuntime** owns the session and authoritative world state.
2. **RuleEngine** owns structured rule evaluation while a rule is active.
3. **Target.role** owns default correctness only when there is no active rule.
4. **Mechanic Engine** owns sub-second motion and target choreography.
5. **Pacing Director** owns the default 30-second arc, except during AI control leases.
6. **Gemini Live** owns creative direction, narration, short rules/twists and visual-world choices through `DirectorPlan`.
7. **GameView** renders state; it must not mutate semantic state while drawing.

## Why DirectorPlan

A model response can be 1–2 seconds older than the live game. Low-level instructions such as `moveElement(targetId=...)` therefore age badly. A high-level plan such as `SWARM + ONLY_SHAPE(circle) + GLITCH for 3s` can be revalidated against the current world and executed safely.

## Semantic versus presentation state

Semantic state affects correctness and must remain stable/readable:

- role
- rule-relevant color
- shape
- visibility
- target topology

Presentation state may vary without changing correctness:

- glow
- world overlays
- particles
- scanlines
- transition effects
- camera-like screen effects

A visual world must never turn a semantically red target into a visibly unrelated color while a color rule relies on it.

## Stale-response policy

- Every snapshot has `stateVersion`.
- Every Live tool response echoes `baseStateVersion`.
- High-level DirectorPlan is revalidated against current state.
- ID-dependent legacy actions are dropped if their base version is stale.
- ID-dependent actions are also dropped when a semantic DirectorPlan is present, because the plan itself may change topology before those actions execute.

## Control leases

An AI-authored mechanic or scene sets a short lease:

```text
mechanicLeaseUntil
sceneLeaseUntil
```

The local Pacing Director does not replace leased state. This prevents:

```text
AI: SWARM for 4 seconds
Runtime 300 ms later: SHRINK
```

After the lease expires, local pacing resumes automatically.

## Next safe extension points

New gameplay should plug into one of these explicit surfaces rather than add another parallel truth system:

- new RuleEngine rule
- new Mechanic Engine mechanic
- new Scene/transition presentation
- new DirectorPlan field with local validation
- new TapOutcome feedback

Avoid adding correctness logic to element IDs, renderer code, Gemini prose, or LocalDirector-only branches.
