# AI Infinite Click — Android MVP 0.20

An endless AI-directed Living Canvas for Android. Gemini Live acts as a creative director while the local Android runtime remains authoritative for interaction/state. **0.20 embeds Godot 4.7.2 as the visual/VFX surface** so taps can drive procedural shaders, GPU particles, portals, gravity pulls and persistent world mutations without giving the model arbitrary code execution.

## Current game loop

- Endless direct-entry Living Canvas; no fixed level/timer is required.
- Fast local mechanics: `CHASE`, `SHRINK`, `SPLIT`, `BLINK`, `SWARM`.
- Target system: shape + appearance + semantic role + behavior.
- Visual worlds: `NEON`, `MINIMAL`, `COMIC`, `GLITCH`, `SPACE`.
- Structured local rules: role, shape, color, largest/smallest and wait timing.
- Twists: rule inversion, role swap, ghost/neon transformations and chaos.
- Gemini Live native audio; routine taps can remain silent while local visuals react immediately.
- Offline `LocalDirector` keeps the world interactive without a Gemini key.

## 0.10 architecture contract

The main rule is:

> AI decides **what kind of beat happens**; Runtime decides **how it happens safely and instantly**.

Gemini should prefer one high-level `directorPlan` per event:

```text
DirectorPlan
├─ mechanic + lease duration
├─ structured rule
├─ twist
├─ visual world + transition + lease duration
└─ speech
```

Legacy element actions remain for compatibility and small cosmetic details, but they are no longer the primary gameplay interface.

### State ownership

```text
Player input
    ↓
GameView
    ↓
GameRuntime
    ├─ RuleEngine → TapOutcome
    ├─ local scoring/combo feedback
    ├─ Mechanic Engine
    ├─ Pacing Director
    ├─ target semantic state
    └─ stateVersion / control leases
            ↓
     compact PLAYER_EVENT
            ↓
       Gemini Live
            ↓
      DirectorPlan
            ↓
 Runtime validates against CURRENT state
```

`role` is the only fallback correctness source when no structured rule is active. Element IDs such as `mechanic_fake_*` are internal ownership names only; they never decide whether a tap is correct.

## DirectorPlan safety

- `stateVersion` is included in every context snapshot.
- Gemini echoes it as `baseStateVersion`.
- If the response is stale, ID-dependent legacy mutations are ignored.
- High-level plans are revalidated against current state instead of trusting the old snapshot.
- AI mechanic/scene requests create short control leases so the local pacing engine cannot immediately overwrite them.
- Rule plans are normalized and checked for solvability before activation.
- Visual worlds never replace semantic target colors, so color rules remain visually fair.

## Tap outcome pipeline

```text
Tap
 ↓
RuleEngine.evaluate()
 ↓
TapOutcome
 ├─ CORRECT
 ├─ WRONG
 └─ NEUTRAL
 ↓
local score / combo / feedback
 ↓
mechanic reaction
 ↓
PLAYER_EVENT for Gemini reaction
```

With an active rule, the rule is authoritative. Without one:

- `real` → correct
- `bonus` → correct + bonus
- `decoy` → wrong
- `danger` → wrong with stronger penalty

## Runtime limits

- Maximum 50 elements.
- Maximum 8 backward-compatible micro-actions in one model turn.
- Text <= 200 characters.
- IDs match `[A-Za-z0-9_-]{1,40}`.
- Coordinates and sizes are clamped to the safe play area.
- Timers are 0.5–30 seconds, maximum 5 active timers.
- Structured rules are short-lived and locally evaluated.
- Normal run ends at exactly 30 seconds; 5 model-side mistake penalties can also end it.
- `sessionId` + `turnId` reject delayed cross-turn responses.
- `stateVersion` protects against same-turn stale snapshots.
- No arbitrary code execution, WebView scripting, filesystem tools or phone-control tools.

## Important classes

- `GameRuntime.java` — session orchestration, authoritative target state, mechanics/pacing integration, validated legacy actions and DirectorPlan execution.
- `RuleEngine.java` — structured rule state and local correctness evaluation.
- `DirectorPlan.java` — parsed high-level AI intent.
- `TapOutcome.java` — unified tap result passed to scoring/feedback.
- `GameView.java` — Android HUD/input overlay plus Canvas fallback while Godot starts.
- `GodotWorldBridge.java` / `VisualBridgePlugin.java` — validated Android → Godot visual command transport.
- `app/src/main/assets/godot/` — procedural shader, GPU particle scene logic and persistent tap VFX.
- `GeminiLiveClient.java` — Gemini Live WebSocket, DirectorPlan tool schema, audio playback.
- `LocalDirector.java` — deterministic offline fallback.
- `MainActivity.java` — GodotFragment host plus Live/fallback coordination and event watchdogs.

## Gemini API key

The prototype stores the key in private `SharedPreferences`. Android backup is disabled in 0.10 so that preference is not backed up. A production release should still replace direct client API-key authentication with short-lived credentials from a backend.

## Build

Requirements: JDK 17+, Android SDK 35, Gradle 8.9.

```bash
gradle :app:assembleDebug
```

APK:

```text
app/build/outputs/apk/debug/app-debug.apk
```

This environment does not contain the Android SDK, so the source package is statically checked here but must be compiled by the local Android toolchain.


## 0.11 Momentum Pass
The runtime now tracks click momentum and protects the core click impulse. AI rules are short, gated by player flow, and automatically released when hesitation rises. Finale prioritizes rapid tapping.


## 0.12 Start / Result Screens + Language
The app now opens on a full start screen with Traditional Chinese / English selection. The selected language persists across launches and controls local runtime copy, offline Director copy, Gemini language instructions, TTS fallback, HUD, and result UI. The result screen now provides Play Again and Home.


## 0.13 Back to the Tap
The main KPI is now tap cadence. Wrong taps still move the game forward, live CPS is visible, and `clickSpeed` is sent to Gemini so the AI can react to acceleration, frenzy, slowdown and peak tapping speed.


## 0.14 Tap-first Redesign
The entire game screen is now tappable. Empty-space taps are real gameplay events, movement is driven primarily by taps rather than autonomous dodging, correctness rules are disabled, and Gemini can author a `tapEffect` for the next tap anywhere.


## 0.15 Voice-first Live
Audible speech now comes only from Gemini Live. Android TTS fallback is removed. Routine taps may be silent; Gemini speaks selectively at meaningful tempo or scene moments and treats `speech` as intent rather than a verbatim script.


## 0.16 Living Canvas
The product is now an endless AI-directed procedural world. There are no levels, no timer, no target button and no required objective. Gemini continuously evolves a persistent WorldPlan while the local renderer keeps the world alive at frame rate and every screen tap reacts immediately.


## 0.17 Direct World + Settings + Voice
The app now enters the Living Canvas immediately. Language and Gemini connection settings live in an in-world overlay. Gemini Live receives explicit REQUIRED/ENCOURAGED/SILENT_OK voice cues, and a fresh live-ready start event guarantees an early native-audio opportunity after the socket connects.

## 0.18 Filament 3D
Living Canvas now renders through native Google Filament on Android. WorldPlan gained spatial layout, camera-motion and depth controls. The overlay remains native Canvas, and the previous procedural 2D renderer remains as a fallback if Filament cannot initialize.


## 0.19 Visual Richness Pass
Filament world planning gained composition, environment and material identity plus deeper layout-specific spatial treatment. It confirmed that continuing to hand-build a VFX engine on top of Filament would still feel too much like a technical demo.

## 0.20 Godot VFX Spike
The active visual surface is now embedded Godot 4.7.2. Android still owns Gemini Live and gameplay state; Godot receives validated JSON visual commands and renders a procedural nebula, layout/composition variants, GPU particle bursts, portal rings, gravity pulls, shockwave distortion and persistent tap echoes. The old Canvas LivingWorld renderer stays as a startup/failure fallback. See `CHANGES_0.20.md` and `LOCAL_AGENT_0.20.md`.
