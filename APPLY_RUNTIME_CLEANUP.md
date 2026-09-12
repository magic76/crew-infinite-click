# Runtime Cleanup & Smoothness Pass

Base reviewed commit: `383ef32212c9572d72d8ed5bf5d3cc7793f28319` (`main`).

This bundle contains complete replacement/new files, preserving repository-relative paths.

## Apply

From the repository root, extract/copy this bundle over the checkout. Then run:

```bash
node tests/run-all.js
```

The repository currently has no committed Gradle wrapper (`gradlew`). The CI workflow in this bundle runs the equivalent clean debug build with Gradle 8.9:

```bash
gradle clean :app:assembleDebug --stacktrace
```

If your local checkout has a wrapper, use:

```bash
./gradlew clean assembleDebug
```

Expected APK:

`app/build/outputs/apk/debug/app-debug.apk`

## Scope

No new world, signature moment, primitive name, or particle preset was added. This pass only unifies runtime ownership, moves input feedback off the Gemini critical path, adds pooling/aggregation, and replaces the Canvas2D signature implementations with Pixi runtime rendering.
