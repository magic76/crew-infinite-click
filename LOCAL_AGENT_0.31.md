# Local agent handoff — 0.31

This package is based on GitHub `main` after commit `237e9ca` and preserves the three Pixi runtime fixes made after the initial 0.30 drop.

Build:
```bash
./scripts/vendor-pixi.sh   # recommended for offline/release testing
./gradlew :app:assembleDebug --stacktrace
```

Smoke test:
1. Top status/language/settings row is fully below the status bar/camera cutout.
2. Bottom AI caption is above gesture/navigation area.
3. Tap once: immediate haptic + small synthesized tap sound.
4. Play 30+ taps: hear distinct whoosh/glitch/portal/absorb/crack/reveal cues.
5. DEMO mode should exercise CHASE/DECOY/RHYTHM/PREDICT/WAIT/HIDE/REWARD interaction modes.
6. LIVE mode tool schema now requires `interaction`; verify Gemini tool calls validate and apply.
7. Confirm existing Pixi startup fixes remain: no early `app.screen` getter and CSP contains `'unsafe-eval'`.

No Godot or Filament should be introduced.
