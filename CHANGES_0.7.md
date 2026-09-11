# 0.7 Target System

This release removes the visual assumption that every clickable object must look like the same rounded Android button.

## Target model
Clickable GameElements now expose composable target metadata:

- shape: `pill`, `circle`, `square`, `ring`, `dot`, `bar`, `diamond`, `cross`
- appearance: `solid`, `outline`, `neon`, `ghost`, `glass`
- role: `real`, `decoy`, `danger`, `bonus`
- behavior: `static`, `evasive`, `shy`, `splitter`, `chameleon`, `aggressive`

These fields are included in the compact Gemini context.

## Rendering
`GameView` renders target shapes directly on Canvas. Text is optional, so targets can be pure visual objects rather than app-looking buttons.

## Gameplay semantics
- `decoy` and `danger` targets break combo and deduct score.
- `danger` has a larger local penalty.
- `bonus` targets grant an additional local score bonus.
- non-primary decoy/danger targets disappear after being hit.
- `evasive`, `shy`, `splitter`, and `chameleon` behaviors add local reactions independent of Gemini latency.

## Local variety
Every Director mechanic beat now gives the primary target a fresh locally-generated visual identity. Local decoys also receive independent target shapes/appearances/behaviors.

This means target variety still works in DEMO mode and does not wait for Gemini.

## Gemini tools
Added actions:

- `createTarget`
- `changeTarget`

`createButton` remains supported for compatibility, but the system prompt tells Gemini to prefer Target actions and not force visible text on every clickable object.

## Compatibility
Existing CHASE / SHRINK / SPLIT / BLINK / SWARM mechanics remain intact and operate on Targets.
