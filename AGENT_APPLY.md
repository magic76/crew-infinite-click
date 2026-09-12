# AI Infinite Click 0.33 — Local Agent Apply Guide

This is a **cumulative** integration package. If 0.32 is already applied, preserve it and merge the 0.33 pieces. If the project is still on 0.31, apply the 0.32 safe-area/world files in this package first, then the 0.33 sensory changes below.

Do not rebuild the product architecture. Keep the existing GameRuntime, Pixi bootstrap, score/state, Gemini Live socket/audio path, action validator, and local immediate-response path.

## 1. Copy Java files

Copy these into the app's actual Java package and change the placeholder package declaration:

```text
android/SafeAreaInsetsController.java
android/WorldExperiencePlan.java
android/GeminiWorldToolSchema.java
android/HapticEngine.java
android/HapticJavascriptBridge.java
```

Replace:

```java
package com.crewpocket.aiclicker.v033;
```

with the current app package.

## 2. Android vibration permission

Add this to `AndroidManifest.xml` if it does not already exist:

```xml
<uses-permission android:name="android.permission.VIBRATE" />
```

This is a normal permission; there is no runtime permission dialog.

## 3. Register the native haptic bridge

On the **local game WebView only**, after WebView creation:

```java
HapticEngine hapticEngine = new HapticEngine(this);
gameWebView.addJavascriptInterface(
    new HapticJavascriptBridge(hapticEngine),
    "AndroidHaptics"
);
```

Security requirement: this JavaScript interface is intended for bundled/trusted game content. Do not leave this interface enabled on arbitrary external web pages.

Do not call `Vibrator` directly from random gameplay code. Route tactile effects through `HapticEngine` so cadence and pattern semantics stay centralized.

## 4. Keep the 0.32 real safe-area integration

Keep:

```java
SafeAreaInsetsController.attach(
    this,
    topHudView,
    captionView,
    gameWebView
);
```

Top HUD and caption must use actual WindowInsets. Interactive Pixi targets must use `GameSafeArea`; ambient VFX may remain edge-to-edge.

## 5. JS load order

Load before existing gameplay boot code:

```html
<link rel="stylesheet" href="safe-area.css">
<script src="safe-area.js"></script>
<script src="world-catalog.js"></script>
<script src="experience-director.js"></script>
<script src="sensory-director.js"></script>
<script src="haptic-bridge.js"></script>
<script src="audio-mood-player.js"></script>
<script src="world-fx-controller.js"></script>
<script src="experience-runtime.js"></script>
```

If bundled, preserve equivalent import order.

## 6. Create one SensoryDirector

When creating the existing 0.32 ExperienceRuntime:

```js
const sensory = new SensoryDirector();
const audioMood = new AudioMoodPlayer();
const worldFx = new WorldFxController(pixiApp);

const experience = new ExperienceRuntime({
  gameRuntime: window.gameRuntime,
  director,
  sensory,
  fx: worldFx,
  audio: audioMood,
  haptics: window.GameHaptics,
  profileAccessor: () => window.gameRuntime?.getPlayerProfile?.() || {},
  getPrimaryTarget: () => {
    const target = window.gameRuntime?.getElement?.("main_button");
    return target ? { x: target.x, y: target.y } : null;
  },
  onRuleTwist: (rule, plan) => window.gameRuntime?.setTemporaryRule?.(rule, plan),
  onSpeech: (speech) => window.setCaption?.(speech)
});
```

Do not create a second scheduler/agent loop.

## 7. Immediate tap path

Every click/drag/timeout must still react locally before Gemini latency:

```js
experience.onPlayerEvent({
  type: "click",
  targetId,
  x,
  y,
  totalClicks: gameRuntime.totalClicks
});
```

0.33 behavior:

- local particle response is scaled by current density;
- audio clicks are probabilistic at low density;
- many ordinary taps intentionally produce no vibration;
- HapticEngine has an additional short cooldown.

Do not add unconditional `navigator.vibrate()` or `Vibrator.vibrate()` calls elsewhere.

## 8. Sensory density is Runtime authority

Density meanings:

```text
0 CALM
1 LIGHT
2 ACTIVE
3 IMPACT
```

Hard rules already implemented in `SensoryDirector`:

```text
IMPACT cooldown:       9000 ms
post-impact recovery:  2600 ms
2 dense of last 3:     next dense request -> LIGHT
WAIT/HIDE:             normally <= LIGHT
```

Do not remove these limits because the model asks for a stronger scene.

## 9. Real element-count variation

0.33 limits creation/duplication actions by density:

```text
CALM   -> 1 create/duplicate action per plan
LIGHT  -> 2
ACTIVE -> 5
IMPACT -> 8
```

Recommended visible interactive counts sent to Gemini:

```text
CALM   2
LIGHT  6
ACTIVE 14
IMPACT 26
```

This is in addition to the existing global GameRuntime `max elements = 50` validation.

Do not bypass the existing validator. The sensory limiter is a second, stricter layer for pacing.

## 10. Expanded VFX

`WorldFxController` now accepts a `SensoryState` and dynamically reconciles ambient particle count.

New effect vocabulary:

```text
PETAL_BLOOM
STORM_FLASH
RAIN_BURST
LEAF_FALL
DUST_DISSOLVE
FREEZE_CRACK
FROST_PULSE
VOID_SUCTION
GRAVITY_WELL
BLACKOUT_REVEAL
GLITCH_BARS
NEON_SLICE
PIXEL_SCATTER
MIRROR_SPLIT
SHOCKWAVE
ECHO_RINGS
SPOTLIGHT
SOFT_FADE
```

Reuse existing polished 0.31/0.32 effect implementations where they are better. The new controller is a reference implementation, not a reason to throw away working effects.

Important: visual density changes must be visible. Do not leave a permanent high particle emitter running underneath CALM mode.

## 11. Haptic language by world

Default tactile texture:

```text
SPRING_BLOOM -> SOFT_TAP
SUMMER_STORM -> THUNDER
AUTUMN_DECAY -> DRY_DOUBLE
WINTER_FROST -> ICE_TICK
VOID_CHAMBER -> VOID_PULL
NEON_RIFT -> DIGITAL_TRIPLE
```

Special semantic cues:

```text
correct       -> CORRECT
wrong         -> WRONG
warning       -> WARNING
prediction    -> HEARTBEAT
rare climax   -> IMPACT
```

Do not vibrate every tap. Absence of vibration is part of the design.

## 12. Gemini schema upgrade

Keep the same existing Live function name:

```text
apply_world_experience
```

Do not create another Gemini function just for VFX or haptics.

The schema now optionally accepts:

```json
{
  "sensoryDensity": 0,
  "visualEffect": "AUTO",
  "hapticCue": "AUTO"
}
```

These are **requests**, not commands. `SensoryDirector` can downgrade/replace them.

Keep the existing synchronous function-response flow after local apply.

## 13. Gemini game-master prompt addition

Append this to the existing 0.32 game prompt:

```text
Sensory contrast is part of the game. Do not make every situation visually busy.
Prefer CALM or LIGHT for ordinary moments. Use ACTIVE for meaningful pressure and IMPACT only for rare climaxes.
After a visually dense moment, deliberately create breathing room.
Silence, stillness, empty space, and no vibration are valid game effects.
Do not request maximum visual + audio + haptic intensity together.
Use world-appropriate visual effects. Prefer AUTO if unsure.
Do not repeat the same visual effect back-to-back.
```

Do not rely on prompt compliance for safety/pacing; Runtime enforcement remains authoritative.

## 14. Context sent to Gemini

`experience.aiContext(...)` now includes:

```json
{
  "sensory": {
    "currentDensity": 1,
    "currentDensityName": "LIGHT",
    "impactAvailable": false,
    "recoveryActive": true,
    "recentDensity": ["ACTIVE", "IMPACT", "LIGHT"],
    "recentVisualEffects": ["STORM_FLASH", "SPOTLIGHT"],
    "recommendedMaxVisibleInteractive": 6,
    "creationActionBudget": 2
  }
}
```

Keep this compact. Do not send full visual history.

## 15. Desired rhythm

The runtime should naturally produce patterns resembling:

```text
CALM -> LIGHT -> LIGHT -> ACTIVE -> CALM -> ACTIVE -> IMPACT -> CALM
```

Not:

```text
ACTIVE -> ACTIVE -> IMPACT -> ACTIVE -> IMPACT -> IMPACT
```

This rhythm matters more than maximizing the number of effects.

## 16. Device verification

### Haptics

- ordinary taps sometimes have no haptic;
- `IMPACT` is short and distinct, not a long buzz;
- two impacts cannot fire within ~9 seconds;
- after impact the next few seconds feel quieter;
- Winter / Neon / Void tactile patterns feel distinguishable;
- disabling system vibration does not crash the app;
- device without vibrator does not crash the app.

### Visual density

- CALM looks genuinely sparse;
- LIGHT is the normal baseline;
- ACTIVE feels busier without becoming unreadable;
- IMPACT is obvious but brief;
- ambient particle count actually decreases after dense moments;
- AI cannot create a swarm of buttons during CALM because creation actions are trimmed;
- clickable targets remain inside safe bounds.

### Audio

- CALM can be silent;
- click sound is not guaranteed on every tap;
- maximum visuals do not simultaneously force maximum audio volume/density.

### Regression

- no WebView reload;
- score/state persist;
- existing action validator remains the final authority;
- no raw JS/HTML execution path added;
- Gemini voice/session remains one existing Live session;
- synchronous tool response still returns after local plan apply.

## 17. Automated tests

Run:

```bash
node tests/experience-director.test.js
node tests/sensory-director.test.js
node tests/experience-runtime.test.js
./gradlew assembleDebug
```

Expected JS output:

```text
experience-director tests passed
sensory-director tests passed
experience-runtime sensory budget tests passed
```

Fix compile errors and run on a real Android device before declaring 0.33 complete.
