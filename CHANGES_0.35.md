# 0.35 — Composable Experience System

## Goal
Make each AI-created event feel structurally different, not merely like another particle preset.

## New layers
- `primitive-catalog.js`: safe primitive vocabulary + per-world vocabulary.
- `experience-composer.js`: compatibility repair, complexity budget, recent-history novelty score.
- `interaction-primitives.js`: applies validated composition through host adapters and reveal FX.
- `primitive-host-runtime.js`: executable HOLD/DRAG/SLICE gestures, gravity/orbit/push-away spatial rules, and camera zoom/follow/pan.
- Gemini schema now accepts `experienceIntent` and `composition`.
- ExperienceRuntime is authoritative: Gemini proposes; Composer repairs/downgrades/diversifies; host primitives execute.

## Dimensions
`interaction + spatial + reveal + camera + surface + timing`

Examples:
- HOLD + ORBIT + SPOTLIGHT + ZOOM_IN + TENSION
- DRAG + GRAVITY_DOWN + NONE + FOLLOW + TRAIL + REVERSAL
- SLICE + NONE + BLACKOUT + STATIC + FRAGMENT + SNAP

## Anti-repetition
Recent 6 compositions are retained. The novelty scorer weights meaningful changes:
- interaction +3
- spatial +2
- reveal +2
- camera +1
- surface +2
- timing +1

A near duplicate below score 5 is automatically diversified.

## Safety / coherence
- Max active primitive complexity: 4.
- HOLD + FRAGMENT is repaired.
- DRAG + PUSH_AWAY is repaired.
- SLICE + FOLLOW camera is repaired.
- World-specific primitive vocabulary prevents random visual soup.
- Existing GameRuntime action validator remains authoritative.
