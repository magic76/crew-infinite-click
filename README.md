# AI Infinite Click — 0.33 Sensory Rhythm Pass

This package is cumulative: it contains the 0.32 safe-area/world-system work plus the 0.33 sensory-rhythm changes.

## What 0.33 adds

The goal is **contrast**, not permanent spectacle.

### Dynamic sensory density

Every situation resolves to one of four client-authoritative levels:

| Density | Typical visual load | Haptic/audio behavior | Purpose |
|---|---:|---|---|
| `CALM` (0) | 2 ambient particles, ~1 creation action | mostly silent / no vibration | tension, waiting, deception |
| `LIGHT` (1) | 8 ambient particles, ~2 creation actions | occasional soft cue | normal play |
| `ACTIVE` (2) | 18 ambient particles, ~5 creation actions | selective world-specific feedback | chase / puzzle pressure |
| `IMPACT` (3) | 34 ambient particles, ~8 creation actions | one short strong event | rare climax |

`SensoryDirector` is authoritative. Gemini may request a density but cannot force repeated maximum stimulation.

### Anti-numbness rules

- Real `IMPACT` has a 9 second cooldown.
- After `IMPACT`, a ~2.6 second recovery window forces the experience back to `CALM/LIGHT`.
- If 2 of the last 3 situations were already `ACTIVE/IMPACT`, another dense request is downgraded to `LIGHT`.
- `WAIT` and `HIDE` normally stay sparse.
- Not every tap vibrates or makes a sound.
- When visual density is maxed, audio/haptic strength is capped so all channels do not peak together.
- UI creation/duplication actions are also density-limited, not only particle effects.

## Native haptics

New Java files:

- `HapticEngine.java`
- `HapticJavascriptBridge.java`

Patterns:

- `SOFT_TAP`
- `CORRECT`
- `WRONG`
- `WARNING`
- `ICE_TICK`
- `DRY_DOUBLE`
- `DIGITAL_TRIPLE`
- `THUNDER`
- `VOID_PULL`
- `HEARTBEAT`
- `IMPACT`

Patterns are deliberately short. The engine has its own minimum spacing and the JS `SensoryDirector` intentionally emits `NONE` for many ordinary taps.

## Expanded VFX vocabulary

World-appropriate effects now include:

- Spring: `PETAL_BLOOM`, `ECHO_RINGS`, `SPOTLIGHT`, `SOFT_FADE`
- Summer: `STORM_FLASH`, `SHOCKWAVE`, `RAIN_BURST`
- Autumn: `LEAF_FALL`, `DUST_DISSOLVE`
- Winter: `FREEZE_CRACK`, `FROST_PULSE`
- Void: `VOID_SUCTION`, `GRAVITY_WELL`, `BLACKOUT_REVEAL`, `MIRROR_SPLIT`
- Neon: `GLITCH_BARS`, `NEON_SLICE`, `PIXEL_SCATTER`, `MIRROR_SPLIT`

The same gameplay situation can therefore feel different in different worlds.

## Files

```text
android/
  SafeAreaInsetsController.java
  WorldExperiencePlan.java
  GeminiWorldToolSchema.java
  HapticEngine.java
  HapticJavascriptBridge.java
web/
  safe-area.css
  safe-area.js
  world-catalog.js
  experience-director.js
  sensory-director.js
  haptic-bridge.js
  audio-mood-player.js
  world-fx-controller.js
  experience-runtime.js
tests/
  experience-director.test.js
  sensory-director.test.js
  experience-runtime.test.js
AGENT_APPLY.md
```

## Architectural rule

Gemini still chooses high-level play direction. The client owns:

1. safe area;
2. low-level action validation;
3. maximum element count;
4. sensory density/cooldown;
5. haptic frequency;
6. actual visual/audio budgets.

Gemini never executes raw JavaScript or arbitrary HTML.
