# Premium Toy Art v16

This pass keeps v15 gameplay intact and upgrades the active Pixi art direction.

## Goals
- Keep Toy Box Physics / Chaos Chain / Object Playground behavior unchanged.
- Remove the student-prototype look without adding heavy image assets.
- Use a muted collector-toy palette, soft material depth, glossy highlights and grounded contact lighting.

## Runtime changes
- New `premium-toy-art.js` generates the scene texture with layered gradients, spot lighting, subtle material grain, floor falloff and vignette.
- `game.js` now uses the generated scene texture plus a collector-display frame instead of flat purple panels.
- PEACH / SPARK / MINT FX palettes are less candy-primary and use resin/metal-like highlights.
- Heart-shaped generic particles are removed from active hit FX; impact language uses glossy capsules, shards, facets and soft blooms.
- Direct hits and near misses gain additive soft light blooms while retaining v15 collision physics.
- Pet sprites get per-type contact glow plus dual-layer soft shadows to keep them grounded.

## Object art
- Bumper: rubber base + metal rim + gel dome.
- Gift: collector capsule crate with muted coral band and metallic clasp.
- Balloon: translucent resin bubble rather than party-balloon styling.
- Spring: smoked metal launch pad, mint coil and warm metal cap.

## Performance
- Background texture is generated only on scene build / resize, not every frame.
- Existing pooled hit FX remain pooled.
- No new large image assets are introduced.
- Object materials continue using the existing bounded five-object runtime.
