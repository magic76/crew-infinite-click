# Visible Shooting v26

## Why this fix
In v25, `SHOOT` was only one random action among six and its comet effect was visually too subtle. The old comet helper also used a reversed direction vector, so some shots could read as particles moving away from the target.

## What changed
- Every action-button press now launches at least one clearly visible projectile from the bottom button toward a pet.
- Long-press auto fire now visibly becomes rapid fire.
- The `SHOOT` action becomes a larger barrage instead of a tiny accent.
- Added a dedicated screen-space projectile layer so bullets are not lost inside world/camera transforms.
- Projectiles have a bright core, glow, long tail, curved flight path, muzzle flash, impact burst, hit ring, pet knockback, and light camera feedback.
- Targets are tracked while the projectile is flying, so moving pets can still be visibly hit.
- Fixed `variantCometFx` direction from target-to-origin to origin-to-target.
- Added debug counters: `buttonShots` and `activeProjectiles`.

## Version
- renderer: `VISIBLE_SHOOTING_V26`
- versionCode: `404`
- versionName: `0.55.0-visible-shooting-v26`

## Validation
`ALL V26 VISIBLE-SHOOTING TESTS PASS`
