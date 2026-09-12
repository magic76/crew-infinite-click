# 0.33 Sensory Rhythm Changes

- Added client-authoritative `SensoryDirector` with CALM/LIGHT/ACTIVE/IMPACT density.
- Added 9s IMPACT cooldown and 2.6s forced recovery window.
- Added recent-density anti-fatigue downgrade.
- Added actual create/duplicate action budgets per density.
- Added recommended visible-interactive budgets to Gemini context.
- Added native Android haptic engine and trusted-WebView JS bridge.
- Added intentionally sparse/probabilistic tap haptics.
- Added world-specific tactile vocabulary.
- Added dynamic audio density/silence behavior.
- Expanded VFX vocabulary to 18 world-aware effects.
- Added dynamic ambient particle reconciliation (2 / 8 / 18 / 34 baseline targets).
- Ensured decorative Pixi layers cannot steal pointer input.
- Extended `apply_world_experience` with optional sensoryDensity / visualEffect / hapticCue suggestions.
- Runtime remains authoritative; Gemini cannot force repeated IMPACT.
- Added sensory rhythm and action-budget tests.
