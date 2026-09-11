# 0.5 — Local Mechanic Engine

Goal: remove Gemini latency from the core 30-second gameplay loop.

## Core architecture change

Gemini is now a director, not a per-frame UI controller.

- Added a local mechanic engine in `GameRuntime`.
- The engine rotates mechanics every ~3 seconds even if Gemini is slow or unavailable.
- Gemini can override/select a mechanic with the validated `startMechanic` action.
- Supported mechanics: `CHASE`, `SHRINK`, `SPLIT`, `BLINK`, `SWARM`.
- Existing low-level UI actions remain available for surprise beats and custom mutations.

## Immediate gameplay

- Successful taps immediately advance the active mechanic.
- `CHASE`: target relocates immediately and also moves on its own every ~360–540ms.
- `SHRINK`: every successful tap shrinks, rotates and relocates the target; transitions into SPLIT when small enough.
- `SPLIT`: one real target plus four local decoys; hitting the real target detonates the set and changes mechanic.
- `BLINK`: target alternates visible/hidden on a fast cadence and moves on reappearance.
- `SWARM`: real target plus six decoys shuffle continuously.
- Local decoy hits are resolved immediately without waiting for Gemini.

## Combo / scoring

- Successful local hits increment combo.
- Immediate score now scales with combo and reaction speed.
- Local decoy hit: -5 and combo break.
- AI negative score also breaks combo.
- HUD shows `COMBO xN`.
- Result screen shows Best Combo.

## Animation cadence

- Element move/resize animation: 160ms -> 95ms.
- Rotation animation: 170ms -> 100ms.
- Fast mechanic cadence runs independently from the Live turn loop.

## Gemini Live contract

New validated action:

```text
startMechanic(mechanic)
```

Allowed values:

```text
CHASE | SHRINK | SPLIT | BLINK | SWARM
```

System prompt now tells Gemini to select/shape mechanics rather than micromanage every move. `mechanic_fake_*` taps are already locally penalized, so Gemini should not double-penalize them.

## Runtime guarantees

- 30-second hard deadline remains unchanged.
- Local mechanic callbacks are canceled at start/result/restart.
- Mechanics ensure a primary button exists, so AI UI mutations cannot permanently leave the run inert.
- Live event aggregation remains intact; local gameplay no longer waits for those turns.
