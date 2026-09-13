# Object Playground v15

This pass keeps the Toy Box Physics / Chaos Chain direction and adds real scene objects that participate in the same local physics loop.

## Objects

- **Bumper**: starts active. Pet collisions ricochet at higher speed; direct taps emit a radial push.
- **Spring pad**: starts active. Falling pets are launched upward; direct taps can boost the nearest pet.
- **Gift box**: unlocks after 2 direct pet hits. Opening it can spawn another cutie, release a balloon, or push nearby pets.
- **Balloon**: unlocks after 4 direct pet hits (or can be released by a gift). Pops on tap/collision, pushes nearby pets, and respawns after a short random delay.
- A second bumper unlocks after 7 direct pet hits.

## Design rules

- Objects are gameplay participants, not scenery.
- Pet -> object, tap -> object, and object -> pet reactions all work locally without AI.
- Each object owns a distinct visual effect vocabulary instead of sharing the generic particle burst.
- Existing hit combo, graze, collision chain, split/merge/swarm and Pinball Frenzy remain active.
- Object count is bounded and all transient FX still use the existing particle/ripple pools.
- AI voice and Gemini gameplay remain outside the active path.
