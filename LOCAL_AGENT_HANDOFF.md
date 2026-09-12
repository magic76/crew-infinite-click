# Local Agent Handoff — 0.10

Target repo: `magic76/crew-infinite-click`

## First action

Build this exact source before changing gameplay:

```bash
gradle :app:assembleDebug --stacktrace
```

If compiler errors appear, fix compiler/build integration only. Do not redesign the Runtime/DirectorPlan contract before the first successful build.

## Architecture to preserve

```text
Player input
→ GameRuntime
→ RuleEngine / TapOutcome / local mechanics
→ compact PLAYER_EVENT + stateVersion
→ Gemini Live
→ DirectorPlan + optional cosmetic legacy actions
→ current-state validation
→ native Canvas rendering
```

The model is creative director, not referee and not frame-by-frame UI controller.

## 0.10 smoke tests

1. **30-second lifecycle**: Start → Playing → TIME UP Result → Replay, three runs in a row.
2. **Role truth**: a target with `role=decoy` is wrong with no rule, regardless of its ID. Rename-like IDs must not change correctness.
3. **Rule overrides role**: under `ONLY_ROLE=decoy`, tapping a decoy must score positively and must not receive the old -5 decoy penalty.
4. **SWAP_ROLES**: after swap, correctness follows the new role values, not `fake_*` / `mechanic_fake_*` names.
5. **Color fairness**: in COMIC/GLITCH/SPACE, a color-rule target must still visibly retain its semantic base color.
6. **Rule cleanup**: temporary rule targets and temporary primary target shape/color/role changes disappear/restore after rule expiry.
7. **WAIT rule**: timing is measured from previous player tap, not from Gemini response/application time.
8. **Control lease**: submit an AI plan that requests SWARM for ~4s; local pacing must not replace SWARM before the lease expires.
9. **Scene lease**: AI-selected visual world must not be immediately replaced by phase/Combo visuals during its lease.
10. **Stale state**: send a delayed response with old `baseStateVersion`; ID-based mutations must be ignored while a high-level DirectorPlan can still be revalidated/applied.
11. **DirectorPlan**: Live should usually return mechanic/rule/twist/world intent through `directorPlan` with `actions: []` or only cosmetic actions.
12. **Voice**: normal Gemini audio must not be duplicated by TTS. Transcript accumulation must not reset `activeTurnHadVoice` after transcription starts.
13. **Transitions**: PULSE / IMPACT / WIPE / GLITCH / ZOOM should look visibly different.
14. **Shape hit areas**: circle/ring/dot, diamond and cross should not use a full rectangular hit box.
15. **DEMO mode**: LocalDirector fake/decoy examples still behave correctly now that ID prefixes no longer define correctness.

## Guardrails

- <= 50 elements
- <= 8 legacy micro-actions per turn
- no arbitrary JS / HTML / code execution
- Runtime owns scoring and correctness
- stateVersion protects stale snapshots
- mechanic/scene leases protect AI-authored beats
- `role` is the fallback semantic truth, never the element ID
- Android backup is disabled because the prototype key is stored in private SharedPreferences

## Expected APK

```text
app/build/outputs/apk/debug/app-debug.apk
```

After the first successful build, report compile warnings/errors and any smoke-test failures before adding new mechanics.


## 0.11 local verification
1. Build this version directly; it contains all prior changes.
2. Play several full 30s rounds. Confirm the first ~9s contain no AI rule gate.
3. Stop tapping during a rule: within roughly 1-2s the rule should clear and an obvious target should return.
4. Reach the finale: SWARM extras should score as bonus targets rather than punish rapid taps.
5. Confirm logcat has no crash around MomentumEngine/context serialization.
Do not refactor before this smoke test.


## 0.14 local verification
Build this version directly. Verify: (1) tapping empty space increments TAPS/CPS and causes feedback, (2) CHASE waits until taps instead of running away continuously, (3) BLINK only vanishes because of a tap, (4) SWARM rearranges on tap, (5) no rule/miss penalty appears, (6) English/Chinese start/result screens still work.


## 0.15 voice verification
Verify with a real Gemini Live key: normal rapid taps should often be silent; meaningful speed/scene moments should be spoken by Gemini native audio; disconnect/demo mode should show captions but produce no Android TTS voice; no event queue should remain blocked longer than the completion watchdog.

## 0.18 Filament local verification

Build 0.18 directly; do not apply older patches first.

Verify on a physical Android device:
1. App launches directly into the world.
2. A real 3D scene is visible behind the HUD/settings overlay.
3. Camera has slow parallax/drift and objects have obvious z-depth.
4. Repeated taps create expanding 3D ring/energy responses near the tapped area.
5. FIELD, TUNNEL, VORTEX, GATE and SHARD_STORM plans visibly differ.
6. DRIFT, FORWARD, ORBIT and FLOAT camera plans visibly differ.
7. Gemini WorldPlan changes evolve the existing world rather than rebuilding UI.
8. Settings overlay still switches 中文 / English and opens connection settings.
9. Gemini Live still speaks on REQUIRED cues.
10. If Filament initialization fails on a device, the Canvas fallback remains visible.

Useful log filter:
`Filament|gltfio|AiClicker|GeminiLive`
