# Gemini Live Game Director

## Goal

Gemini Live should make the game feel alive without sitting inside the 60 fps game loop.

The player must be able to mash FOCUS / BURST with zero model latency. Gemini observes the run at a much lower frequency, reacts to meaningful changes, and can send a very small set of safe director commands back to the game.

Think of Gemini as a live companion / game director, not the weapon engine.

## Architecture

```text
Local game runtime
  ├─ every tap / projectile / collision stays local
  ├─ stage + TENSION + CHAOS + trigger preference
  └─ semantic event bridge
          ↓
Android / Gemini Live session
          ↓
short voice reaction or whitelisted DirectorCommand
          ↓
DualTriggerV30.applyDirectorCommand()
```

The runtime already exposes the bridge needed for a v31 Live Director MVP.

## Events sent to Live

Important events are emitted immediately:

- `stage_start`
- `chaos_threshold`
- `tension_milestone`
- `tension_clear`
- `soft_landing`
- `quiet_moment`
- `stage_clear`
- `pressure_clear`

Normal tapping is summarized as `play_pulse` roughly every 1.4 seconds instead of sending every tap.

A pulse includes enough context for Live to understand the current play style:

- stage and phase
- TENSION
- CHAOS multiplier
- current tap rate
- FOCUS taps vs BURST taps during the recent interval
- dominant trigger
- Soft Landing state

This keeps token / event volume low and avoids coupling the game feel to network latency.

## What Gemini should do

Gemini should speak sparingly. It is more interesting when it notices something than when it narrates everything.

Useful reactions:

- notice that the player is hammering BURST
- notice that the player suddenly switches to FOCUS
- react when TENSION crosses a major milestone
- give a short line when a Pressure Core breaks
- become quieter during Soft Landing
- say almost nothing during Quiet Moment
- occasionally name or frame the next Pressure Core
- remember a small amount of session personality, such as which trigger the player tends to favor

A reasonable default is at most one spontaneous spoken reaction every 8–15 seconds unless a major event happens.

## Director commands

The model must not generate arbitrary JavaScript or HTML.

The v30 runtime only accepts a small whitelist:

- `callout`: show a short temporary banner
- `mood`: update director mood metadata
- `soft_landing`: temporarily request the local calming mode
- `accent`: trigger one local FOCUS or BURST visual accent

All projectiles, physics, scoring, progression, TENSION calculations, and button responsiveness stay deterministic and local.

## Why this is special

Most clickers either use prerecorded reactions or put AI directly in the content-generation loop. This design lets the AI notice *how* the player is playing in real time while keeping the game tactile and immediate.

Examples:

- Player repeatedly taps BURST very quickly: Live can notice the intensity, while the local runtime independently activates Soft Landing.
- Player alternates perfectly between FOCUS and BURST: Live can comment on the rhythm.
- Player clears a Pressure Core after a frantic sequence: Live can react once, then deliberately leave the Quiet Moment silent.

The interesting part is not "AI generates another level." It is "the game seems to notice me."

## v31 recommended scope

Use the existing Gemini Live connection pattern from `crew-helper` and add only:

1. Android receives `AndroidGame.onGameEvent(...)` from the WebView runtime.
2. Batch / summarize events before forwarding them into the Live session.
3. Give Gemini a short Game Director system instruction and current run snapshot.
4. Play short voice reactions.
5. Parse only whitelisted director commands and call `DualTriggerV30.applyDirectorCommand(...)` in the WebView.
6. Add an obvious mute / Live-off control so the core game remains fully usable without voice.

Do not add camera, screen understanding, or arbitrary generated UI in the first Live version. The game state already provides better structured context than vision would.

## Product principle

**The game must still feel great with Gemini disconnected. Gemini should make it feel like the game notices the player, not make the game wait for AI.**
