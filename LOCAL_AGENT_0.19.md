# Local agent handoff — 0.19 Visual Richness

Apply this source tree over the current `crew-infinite-click` checkout, then build normally.

Important files:
- `app/src/main/java/com/magic76/aiclicker/WorldPlan.java`
- `app/src/main/java/com/magic76/aiclicker/GeminiLiveClient.java`
- `app/src/main/java/com/magic76/aiclicker/FilamentWorldView.java`
- `app/src/main/assets/living_world.glb`
- `app/build.gradle`

Do not regenerate `living_world.glb` from an older script; 0.19 intentionally contains 48 named nodes (`node_00`..`node_47`).

Build check:
```bash
./gradlew assembleDebug
```

Manual smoke test:
1. launch and confirm status reaches `3D`;
2. tap several positions — two ring waves should appear and nearby geometry should keep reacting briefly;
3. exercise or force each layout (`FIELD/TUNNEL/VORTEX/GATE/SHARD_STORM`) and confirm the overall silhouette changes, not only the palette;
4. verify the 0.18.1 visibility guard still prevents an empty/black world;
5. disconnect Gemini / use local fallback and confirm old WorldPlan payloads still render.
