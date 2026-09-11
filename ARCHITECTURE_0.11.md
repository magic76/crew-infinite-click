# Architecture 0.11 — Momentum-first direction

The semantic architecture from 0.10 remains intact. 0.11 adds an engagement control loop above it.

```text
Touch
  -> RuleEngine / TapOutcome
  -> MomentumEngine
  -> scoring + immediate feedback
  -> MechanicEngine
  -> GameView

Game state + momentum telemetry
  -> Gemini DirectorPlan
  -> Runtime validation
       - stateVersion
       - control leases
       - rule solvability
       - momentum veto
  -> local execution

Momentum watchdog
  -> detects hesitation
  -> releases restrictive rule
  -> restores obvious clickable target
```

## Authority order
1. Playability and click impulse
2. Rule correctness
3. AI-authored mechanic/scene lease
4. Local pacing
5. Cosmetic micro-actions

An AI lease is intentionally breakable if the player stalls. This is not a consistency bug: engagement is the higher-level invariant.

## Round shape
- 0–9s: no new structured rules; establish tapping flow.
- 9–23.5s: short rules allowed only while momentum is healthy.
- Rules last at most 3.2s and have a 6s cooldown.
- Stalling for about 1.1s triggers a local rescue.
- Finale prioritizes permissive rapid tapping.
