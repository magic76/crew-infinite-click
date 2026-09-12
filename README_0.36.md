# AI Clicker 0.36 — Signature Moment Pass

0.36 has one goal: make one interaction feel obviously different on a real phone before adding more effects.

## Signature moment

`FLASHLIGHT_HUNT`

Expected real-device feel:

1. Most of the screen becomes black.
2. Moving a finger moves a circular flashlight opening.
3. The hidden target is visible only when it enters that opening.
4. It escapes twice when discovered.
5. On the final discovery the player must hold it.
6. Releasing early gets a reaction.
7. Holding long enough completes the scene and removes the darkness.
8. If the player stops moving, the game notices; later it briefly enlarges the light as a hint.

If the APK does not visibly behave like this, the integration is incomplete. Do not compensate by adding particles.

## Manual verification

Expose the runtime in dev builds, then run:

```js
runFlashlightHuntDemo(signatureMoments)
```

This must be deterministic enough to test without waiting for Gemini to choose the scene.
