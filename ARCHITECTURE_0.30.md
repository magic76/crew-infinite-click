# 0.30 Architecture — AI Reactive Canvas

## Product invariant

The user should never have to wait for the LLM to see a reaction.

The local renderer owns the first 0–150 ms. The model owns the next dramatic decision.

## Responsibility split

### Android

- Gemini Live WebSocket
- native audio playback
- API-key storage for MVP
- turn/session IDs
- event aggregation while Gemini is busy
- watchdog/fallback behavior
- click-speed/tap-pattern metrics
- PlayerProfile
- haptics
- validation of model output

### Pixi runtime

- frame loop
- particles
- target animation
- micro-situations
- visual continuity
- local tap response
- curated VFX implementation

### Gemini

Gemini receives behavioral context and returns:

```json
{
  "turnId": 12,
  "baseStateVersion": 8,
  "speech": "",
  "scenePlan": {
    "intent": "ABSORB",
    "mood": "EERIE",
    "primary": "#03050A",
    "secondary": "#0C1322",
    "accent": "#8B5CF6",
    "energy": 0.78,
    "tempo": 0.62,
    "focusX": 0.71,
    "focusY": 0.44
  },
  "actions": [
    {"type":"black_hole","x":0.71,"y":0.44,"strength":0.82}
  ]
}
```

Gemini never receives permission to produce executable renderer code.

## Bridge

The JavaScript -> Android interface exposes only:

- `onTap(x, y)`
- `onRendererReady(renderer)`
- `onRendererError(message)`

The bridge does not expose the Gemini key, arbitrary file access, Android intents, shell commands or generic native method invocation.

Android -> JavaScript uses one JSON ingress:

```js
window.InfiniteClick.receive(command)
```

Supported top-level operations:

- `scenePlan`
- `action`
- `reset`
- `language`

## Local-first tap flow

```text
pointerdown
  -> Pixi localTap()
     -> ripple
     -> burst
     -> current micro-situation beat
  -> AndroidGame.onTap()
     -> GameRuntime records tap
     -> haptic
     -> Gemini event / aggregation
```

This is the key architectural difference from earlier versions.

## Thermal strategy

The WebView renderer starts with deliberately modest settings:

- WebGL preferred
- device pixel ratio capped at 1.5
- 60 fps max
- ~42 ambient points
- short-lived effect objects destroyed aggressively
- no fullscreen multi-pass shader stack
- no second native renderer underneath

The intent is to spend GPU budget only on visible interaction payoff.
