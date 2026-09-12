package com.magic76.aiclicker;

import android.content.Context;
import android.graphics.Color;
import android.opengl.Matrix;
import android.view.Choreographer;
import android.view.Surface;
import android.view.TextureView;

import com.google.android.filament.Camera;
import com.google.android.filament.Filament;
import com.google.android.filament.Engine;
import com.google.android.filament.EntityManager;
import com.google.android.filament.LightManager;
import com.google.android.filament.Renderer;
import com.google.android.filament.Scene;
import com.google.android.filament.Skybox;
import com.google.android.filament.SwapChain;
import com.google.android.filament.TransformManager;
import com.google.android.filament.Viewport;
import com.google.android.filament.android.UiHelper;
import com.google.android.filament.gltfio.AssetLoader;
import com.google.android.filament.gltfio.FilamentAsset;
import com.google.android.filament.gltfio.Gltfio;
import com.google.android.filament.gltfio.ResourceLoader;
import com.google.android.filament.gltfio.UbershaderProvider;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.util.Locale;

/**
 * GPU-backed Living Canvas prototype.
 *
 * Gemini still owns only high-level WorldPlan semantics.
 * This view owns Filament, frame rendering, camera drift, node transforms and 3D tap pulses.
 */
final class FilamentWorldView extends TextureView {
    private static final int NODE_COUNT = 48;
    private static final int MAIN_NODE_COUNT = 24;
    private static final int ATMOSPHERE_START = 24;
    private static final int FOREGROUND_START = 40;
    private static final int[] RING_NODE_INDICES = {1, 4, 7, 10, 13, 16, 19, 22};

    private final Choreographer choreographer = Choreographer.getInstance();
    private final UiHelper uiHelper = new UiHelper(UiHelper.ContextErrorPolicy.DONT_CHECK);

    private Engine engine;
    private Renderer renderer;
    private Scene scene;
    private com.google.android.filament.View filamentView;
    private Camera camera;
    private SwapChain swapChain;
    private Skybox skybox;
    private int cameraEntity;
    private int lightEntity;
    private int fillLightEntity;

    private UbershaderProvider materialProvider;
    private AssetLoader assetLoader;
    private ResourceLoader resourceLoader;
    private FilamentAsset asset;

    private final int[] nodeEntities = new int[NODE_COUNT];
    private final RippleState[] ripples = new RippleState[RING_NODE_INDICES.length];
    private int nextRippleSlot = 0;

    private WorldPlan plan = WorldPlan.defaultPlan();
    private long planAppliedAt = System.currentTimeMillis();
    private long startAt = 0L;
    private boolean rendering = false;
    private boolean surfaceReady = false;
    private boolean viewportReady = false;
    private boolean assetLoaded = false;
    private boolean firstFrameRendered = false;
    private boolean initFailed = false;
    private int renderableCount = 0;
    private boolean destroyed = false;
    private int viewportWidth = 1;
    private int viewportHeight = 1;

    private float lastTapX = 0.5f;
    private float lastTapY = 0.5f;
    private float tapEnergy = 0f;
    private long lastTapAt = 0L;
    private int tapSerial = 0;

    private final Choreographer.FrameCallback frameCallback = this::onFrame;

    private void onFrame(long frameTimeNanos) {
        if (!rendering || destroyed) return;
        choreographer.postFrameCallback(frameCallback);
        if (!uiHelper.isReadyToRender() || swapChain == null || renderer == null) return;

        updateWorld(frameTimeNanos);

        if (renderer.beginFrame(swapChain, frameTimeNanos)) {
            renderer.render(filamentView);
            renderer.endFrame();
            if (assetLoaded && renderableCount > 0) firstFrameRendered = true;
        }
    }

    FilamentWorldView(Context context) {
        super(context);
        for (int i = 0; i < ripples.length; i++) ripples[i] = new RippleState();

        try {
            // Initialize both native layers explicitly; failures are caught and fall back to Canvas.
            Filament.init();
            Gltfio.init();
            setupFilament(context);
            setupSurface();
            loadWorldAsset(context);
            applyWorldPlan(plan);
        } catch (Throwable t) {
            // The overlay keeps a Canvas fallback renderer, so a device-specific Filament
            // failure does not make the entire app unusable.
            initFailed = true;
        }
    }

    boolean isFilamentReady() {
        return !destroyed && !initFailed && surfaceReady && viewportReady &&
                assetLoaded && renderableCount > 0 && firstFrameRendered;
    }

    String renderStatus() {
        if (destroyed) return "3D DESTROYED";
        if (initFailed) return "2D FALLBACK";
        if (!assetLoaded) return "3D ASSET";
        if (!surfaceReady) return "3D SURFACE";
        if (!viewportReady) return "3D VIEWPORT";
        if (!firstFrameRendered) return "3D WARMUP";
        return "3D";
    }

    WorldPlan currentPlan() {
        return plan;
    }

    void applyWorldPlan(WorldPlan value) {
        if (value == null) return;
        plan = value;
        planAppliedAt = System.currentTimeMillis();
        if (skybox != null) {
            float[] primary = linearRgb(value.primary);
            float[] secondary = linearRgb(value.secondary);
            float mix = 0.12f + value.contrastLevel * 0.16f;
            skybox.setColor(
                    primary[0] * (1f - mix) + secondary[0] * mix,
                    primary[1] * (1f - mix) + secondary[1] * mix,
                    primary[2] * (1f - mix) + secondary[2] * mix,
                    1f);
        }
        tuneLighting(value);
    }

    void onWorldTap(float x, float y, double momentum) {
        lastTapX = clamp(x, 0f, 1f);
        lastTapY = clamp(y, 0f, 1f);
        tapEnergy = clamp(tapEnergy + 0.34f + (float)momentum * 0.22f, 0f, 1.65f);
        lastTapAt = System.currentTimeMillis();
        tapSerial++;

        // Two concentric GPU rings create a crisp immediate hit plus a softer secondary wave.
        for (int r = 0; r < 2; r++) {
            RippleState ripple = ripples[nextRippleSlot++ % ripples.length];
            ripple.active = true;
            ripple.startedAt = lastTapAt + r * 70L;
            ripple.x = lastTapX;
            ripple.y = lastTapY;
            ripple.strength = (0.72f + (float)momentum * 0.58f) * (r == 0 ? 1f : 0.72f);
        }
    }

    void startRendering() {
        if (rendering || destroyed) return;
        rendering = true;
        choreographer.postFrameCallback(frameCallback);
    }

    void stopRendering() {
        rendering = false;
        choreographer.removeFrameCallback(frameCallback);
    }

    void destroyRenderer() {
        if (destroyed) return;
        destroyed = true;
        stopRendering();

        try { uiHelper.detach(); } catch (Throwable ignored) {}

        if (engine == null) return;
        try {
            if (swapChain != null) {
                engine.destroySwapChain(swapChain);
                swapChain = null;
                engine.flushAndWait();
            }
        } catch (Throwable ignored) {}

        try {
            if (asset != null && scene != null) scene.removeEntities(asset.getEntities());
        } catch (Throwable ignored) {}
        try {
            if (assetLoader != null && asset != null) assetLoader.destroyAsset(asset);
        } catch (Throwable ignored) {}
        asset = null;

        try { if (resourceLoader != null) resourceLoader.destroy(); } catch (Throwable ignored) {}
        try { if (assetLoader != null) assetLoader.destroy(); } catch (Throwable ignored) {}
        try {
            if (materialProvider != null) {
                materialProvider.destroyMaterials();
                materialProvider.destroy();
            }
        } catch (Throwable ignored) {}

        try { if (skybox != null) engine.destroySkybox(skybox); } catch (Throwable ignored) {}
        try {
            if (lightEntity != 0) {
                engine.destroyEntity(lightEntity);
                EntityManager.get().destroy(lightEntity);
            }
            if (fillLightEntity != 0) {
                engine.destroyEntity(fillLightEntity);
                EntityManager.get().destroy(fillLightEntity);
            }
        } catch (Throwable ignored) {}

        try {
            if (camera != null) {
                engine.destroyCameraComponent(cameraEntity);
                EntityManager.get().destroy(cameraEntity);
            }
        } catch (Throwable ignored) {}

        try { if (renderer != null) engine.destroyRenderer(renderer); } catch (Throwable ignored) {}
        try { if (filamentView != null) engine.destroyView(filamentView); } catch (Throwable ignored) {}
        try { if (scene != null) engine.destroyScene(scene); } catch (Throwable ignored) {}
        try { engine.destroy(); } catch (Throwable ignored) {}
    }

    private void setupFilament(Context context) {
        engine = Engine.create();
        renderer = engine.createRenderer();
        Renderer.ClearOptions clearOptions = renderer.getClearOptions();
        clearOptions.clear = true;
        clearOptions.clearColor = new double[]{0.008, 0.016, 0.055, 1.0};
        renderer.setClearOptions(clearOptions);

        scene = engine.createScene();
        filamentView = engine.createView();

        cameraEntity = EntityManager.get().create();
        camera = engine.createCamera(cameraEntity);
        camera.setExposure(16f, 1f / 125f, 100f);
        camera.setProjection(52.0, 1.0, 0.05, 60.0, Camera.Fov.VERTICAL);

        filamentView.setScene(scene);
        filamentView.setCamera(camera);
        filamentView.setPostProcessingEnabled(true);

        // Bloom is the visual reason for using emissive GLB materials here.
        try {
            com.google.android.filament.View.BloomOptions bloom = filamentView.getBloomOptions();
            bloom.enabled = true;
            filamentView.setBloomOptions(bloom);
        } catch (Throwable ignored) {
            // Older/newer runtimes can still render the scene without explicit bloom tuning.
        }

        skybox = new Skybox.Builder()
                .color(0.025f, 0.045f, 0.11f, 1f)
                .build(engine);
        scene.setSkybox(skybox);

        lightEntity = EntityManager.get().create();
        new LightManager.Builder(LightManager.Type.DIRECTIONAL)
                .color(0.75f, 0.88f, 1.0f)
                .intensity(55_000f)
                .direction(0.35f, -0.8f, -0.45f)
                .castShadows(false)
                .build(engine, lightEntity);
        scene.addEntity(lightEntity);

        fillLightEntity = EntityManager.get().create();
        new LightManager.Builder(LightManager.Type.DIRECTIONAL)
                .color(0.45f, 0.28f, 0.75f)
                .intensity(18_000f)
                .direction(-0.55f, 0.28f, -0.35f)
                .castShadows(false)
                .build(engine, fillLightEntity);
        scene.addEntity(fillLightEntity);

        materialProvider = new UbershaderProvider(engine);
        assetLoader = new AssetLoader(engine, materialProvider, EntityManager.get());
        resourceLoader = new ResourceLoader(engine);
    }

    private void setupSurface() {
        uiHelper.setRenderCallback(new UiHelper.RendererCallback() {
            @Override public void onNativeWindowChanged(Surface surface) {
                if (engine == null) return;
                if (swapChain != null) engine.destroySwapChain(swapChain);
                swapChain = engine.createSwapChain(surface, uiHelper.getSwapChainFlags());
                surfaceReady = swapChain != null;
                firstFrameRendered = false;
            }

            @Override public void onDetachedFromSurface() {
                if (engine == null || swapChain == null) return;
                engine.destroySwapChain(swapChain);
                engine.flushAndWait();
                swapChain = null;
                surfaceReady = false;
                firstFrameRendered = false;
            }

            @Override public void onResized(int width, int height) {
                viewportWidth = Math.max(1, width);
                viewportHeight = Math.max(1, height);
                if (filamentView == null || camera == null) return;
                filamentView.setViewport(new Viewport(0, 0, viewportWidth, viewportHeight));
                double aspect = viewportWidth / (double) viewportHeight;
                camera.setProjection(52.0, aspect, 0.05, 60.0, Camera.Fov.VERTICAL);
                viewportReady = viewportWidth > 1 && viewportHeight > 1;
            }
        });
        uiHelper.attachTo(this);
    }

    private void loadWorldAsset(Context context) throws Exception {
        byte[] bytes;
        try (InputStream in = context.getAssets().open("living_world.glb");
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[8192];
            int read;
            while ((read = in.read(chunk)) >= 0) {
                if (read > 0) out.write(chunk, 0, read);
            }
            bytes = out.toByteArray();
        }

        asset = assetLoader.createAsset(ByteBuffer.wrap(bytes));
        if (asset == null) throw new IllegalStateException("Unable to parse living_world.glb");

        resourceLoader.loadResources(asset);
        asset.releaseSourceData();
        scene.addEntities(asset.getEntities());

        renderableCount = 0;
        com.google.android.filament.RenderableManager rm = engine.getRenderableManager();
        for (int entity : asset.getEntities()) {
            if (rm.hasComponent(entity)) renderableCount++;
        }
        assetLoaded = renderableCount > 0;

        for (int i = 0; i < NODE_COUNT; i++) {
            nodeEntities[i] = asset.getFirstEntityByName(String.format(Locale.US, "node_%02d", i));
        }
    }

    private void updateWorld(long frameTimeNanos) {
        if (engine == null || camera == null || asset == null) return;

        long now = frameTimeNanos / 1_000_000L;
        if (startAt == 0L) startAt = now;
        float seconds = (now - startAt) / 1000f;

        tapEnergy = Math.max(0f, tapEnergy - 0.0105f);

        updateCamera(seconds);
        updateNodes(now, seconds);
    }

    private void updateCamera(float seconds) {
        float moodBoost = "CHAOTIC".equals(plan.mood) ? 1.45f :
                ("PLAYFUL".equals(plan.mood) ? 1.15f : 0.78f);
        float drift = (0.16f + plan.motion * 0.32f) * moodBoost;
        float tapX = (lastTapX - 0.5f) * 0.55f;
        float tapY = (0.5f - lastTapY) * 0.42f;

        double eyeX;
        double eyeY;
        double eyeZ;

        switch (plan.cameraMotion) {
            case "ORBIT":
                eyeX = Math.sin(seconds * (0.16 + plan.motion * 0.12)) * (0.55 + drift);
                eyeY = Math.cos(seconds * 0.13) * 0.34;
                eyeZ = 2.15 + Math.cos(seconds * 0.12) * 0.42;
                break;
            case "FORWARD":
                eyeX = Math.sin(seconds * 0.11) * drift * 0.45;
                eyeY = Math.cos(seconds * 0.09) * drift * 0.22;
                eyeZ = 2.25 - (0.22 + plan.depth * 0.42) * (0.5 + 0.5 * Math.sin(seconds * 0.10));
                break;
            case "FLOAT":
                eyeX = Math.sin(seconds * 0.09) * drift * 0.85 +
                        Math.sin(seconds * 0.027) * 0.18;
                eyeY = Math.cos(seconds * 0.075) * drift * 0.54;
                eyeZ = 2.05 + Math.sin(seconds * 0.055) * 0.28;
                break;
            case "DRIFT":
            default:
                eyeX = Math.sin(seconds * (0.12 + plan.motion * 0.08)) * drift;
                eyeY = Math.cos(seconds * 0.11) * drift * 0.42;
                eyeZ = 2.0 + Math.sin(seconds * 0.08) * 0.18;
                break;
        }

        eyeX += tapX * tapEnergy * 0.22;
        eyeY += tapY * tapEnergy * 0.18;

        camera.lookAt(
                eyeX, eyeY, eyeZ,
                tapX * 0.24, tapY * 0.18, -3.2,
                0.0, 1.0, 0.0
        );
    }

    private void updateNodes(long nowMs, float seconds) {
        TransformManager tm = engine.getTransformManager();
        int mainActive = Math.max(8, Math.min(MAIN_NODE_COUNT,
                Math.round(8 + plan.density * (MAIN_NODE_COUNT - 8))));
        int atmosphereActive = Math.max(2, Math.min(FOREGROUND_START - ATMOSPHERE_START,
                Math.round(2 + plan.particleLevel * (FOREGROUND_START - ATMOSPHERE_START - 2))));

        float tapAge = lastTapAt <= 0 ? 99f : (nowMs - lastTapAt) / 1000f;
        float persistentTap = tapAge < 2.4f
                ? (1f - tapAge / 2.4f) * (0.35f + plan.pulseStrength * 0.65f)
                : 0f;

        for (int i = 0; i < NODE_COUNT; i++) {
            int entity = nodeEntities[i];
            if (entity == 0) continue;
            int instance = tm.getInstance(entity);
            if (instance == 0) continue;

            RippleState ripple = rippleForNode(i);
            if (ripple != null && ripple.active) {
                applyRippleTransform(tm, instance, ripple, nowMs, i);
                continue;
            }

            if (i >= FOREGROUND_START) {
                updateForegroundNode(tm, instance, i, seconds, persistentTap);
                continue;
            }
            if (i >= ATMOSPHERE_START) {
                updateAtmosphereNode(tm, instance, i, seconds,
                        i - ATMOSPHERE_START < atmosphereActive, persistentTap);
                continue;
            }

            float visibility = i < mainActive ? 1f : 0.001f;
            float shapeBias = "SHARD_STORM".equals(plan.layout)
                    ? (i % 3 == 2 ? 1.42f : 0.26f)
                    : motifBias(i);
            float scale = visibility * shapeBias * (0.38f + plan.scale * 0.96f);

            float angle = (float)(i / (double)MAIN_NODE_COUNT * Math.PI * 2.0);
            float speed = 0.18f + plan.motion * 0.82f;
            float phase = angle + seconds * speed * (0.34f + (i % 5) * 0.05f);
            float depthSpread = 0.32f + plan.depth * 0.72f;

            float x;
            float y;
            float z;
            float sx = scale;
            float sy = scale;
            float sz = scale;

            switch (plan.layout) {
                case "TUNNEL": {
                    float ring = (i % 8) / 8f;
                    float lane = i / 8;
                    float tunnelAngle = ring * (float)Math.PI * 2f + seconds * speed * 0.22f;
                    float tunnelRadius = 0.82f + lane * 0.27f;
                    x = (float)Math.cos(tunnelAngle) * tunnelRadius;
                    y = (float)Math.sin(tunnelAngle) * tunnelRadius * 0.72f;
                    float travel = (seconds * (0.32f + plan.motion * 0.55f) + i * 0.71f) % 6.4f;
                    z = -1.75f - travel * (0.72f + plan.depth * 0.34f);
                    if (i % 3 == 1) { sx *= 1.32f; sy *= 1.32f; sz *= 0.38f; }
                    else scale *= 0.72f;
                    break;
                }
                case "VORTEX": {
                    float t = (i + 1f) / MAIN_NODE_COUNT;
                    float vortexAngle = phase * 1.62f + t * 11.0f;
                    float vortexRadius = 0.18f + t * (1.72f + plan.depth * 0.65f);
                    x = (float)Math.cos(vortexAngle) * vortexRadius;
                    y = (float)Math.sin(vortexAngle) * vortexRadius * 0.62f;
                    z = -2.0f - t * depthSpread * 5.8f;
                    float stretch = 0.75f + t * 1.1f;
                    sx *= stretch; sy *= 0.72f; sz *= 0.72f;
                    break;
                }
                case "GATE": {
                    int ringIndex = i % 12;
                    int layer = i / 12;
                    float gateAngle = ringIndex / 12f * (float)Math.PI * 2f + seconds * speed * (layer == 0 ? 0.06f : -0.04f);
                    float gateRadius = 1.02f + layer * 0.54f;
                    x = (float)Math.cos(gateAngle) * gateRadius;
                    y = (float)Math.sin(gateAngle) * gateRadius * 0.92f;
                    z = -3.0f - layer * 0.34f;
                    if (i % 3 == 1) { sx *= 1.48f; sy *= 1.48f; sz *= 0.30f; }
                    else { sx *= 0.62f; sy *= 0.62f; sz *= 0.62f; }
                    break;
                }
                case "SHARD_STORM": {
                    float stream = ((i * 0.137f + seconds * speed * 0.12f) % 1f);
                    x = -2.6f + stream * 5.2f;
                    y = (float)Math.sin(i * 1.73f + seconds * speed * 0.72f) * (0.72f + (i % 4) * 0.22f);
                    z = -1.9f - (i % 9) * depthSpread * 0.58f;
                    sx *= 0.38f; sy *= 0.30f; sz *= 2.4f + plan.motion * 1.8f;
                    break;
                }
                case "FIELD":
                default: {
                    float ringRadius = 0.72f + (i % 6) * 0.29f;
                    if ("ORBIT".equals(plan.evolution)) {
                        x = (float)Math.cos(phase) * ringRadius;
                        y = (float)Math.sin(phase) * (0.62f + (i % 4) * 0.15f);
                        z = -2.25f - (i % 7) * depthSpread * 0.58f;
                    } else if ("FLOW".equals(plan.evolution)) {
                        x = wrapSigned((i * 0.21f + seconds * speed * 0.11f)) * 3.7f;
                        y = (float)Math.sin(phase * 1.2f) * 1.12f;
                        z = -2.25f - (i % 8) * depthSpread * 0.52f;
                    } else {
                        x = (float)Math.cos(angle) * ringRadius +
                                (float)Math.sin(phase * 0.7f) * (0.18f + plan.motion * 0.25f);
                        y = (float)Math.sin(angle * 1.5f) * 1.05f +
                                (float)Math.cos(phase) * (0.14f + plan.motion * 0.20f);
                        z = -2.1f - (i % 7) * depthSpread * 0.61f;
                    }
                    break;
                }
            }

            float[] composed = applyComposition(x, y, z, i, phase);
            x = composed[0]; y = composed[1]; z = composed[2];

            if ("GROW".equals(plan.evolution)) {
                float age = Math.min(1f, (nowMs - planAppliedAt) / 8500f);
                sx *= 0.62f + age * 0.58f;
                sy *= 0.62f + age * 0.58f;
                sz *= 0.62f + age * 0.58f;
            } else if ("PULSE".equals(plan.evolution)) {
                float pulse = 0.84f + (0.18f + plan.pulseStrength * 0.16f) * (float)Math.sin(phase * 2.1f);
                sx *= pulse; sy *= pulse; sz *= pulse;
            } else if ("BREATHE".equals(plan.evolution)) {
                float breath = 0.90f + (0.10f + plan.pulseStrength * 0.12f) * (float)Math.sin(seconds * 1.15f);
                sx *= breath; sy *= breath; sz *= breath;
            }

            // 0.18.1 visibility guard preserved: one unmistakable object always stays in view.
            if (i == 0) {
                x = 0f;
                y = (float)Math.sin(seconds * 0.7f) * 0.16f;
                z = -2.65f;
                float guard = Math.max(scale, 0.68f + 0.12f * (float)Math.sin(seconds * 1.4f));
                sx = Math.max(sx, guard); sy = Math.max(sy, guard); sz = Math.max(sz, guard);
            }

            float touchWorldX = (lastTapX - 0.5f) * 3.2f;
            float touchWorldY = (0.5f - lastTapY) * 2.2f;
            float dx = touchWorldX - x;
            float dy = touchWorldY - y;
            float d2 = dx * dx + dy * dy + 0.35f;
            float force = (tapEnergy * 0.24f + persistentTap * 0.18f) / d2;
            if ("ATTRACT".equals(plan.tapReaction)) {
                x += dx * force; y += dy * force;
            } else if ("REPEL".equals(plan.tapReaction) || "CRACK".equals(plan.tapReaction)) {
                x -= dx * force; y -= dy * force;
            } else if ("WARP".equals(plan.tapReaction)) {
                z += (float)Math.sin(seconds * 3.0f + i + tapSerial * 0.4f) * (tapEnergy + persistentTap) * 0.34f;
            } else if ("MULTIPLY".equals(plan.tapReaction) && persistentTap > 0f && i > mainActive - 5) {
                sx *= 1f + persistentTap * 0.75f;
                sy *= 1f + persistentTap * 0.75f;
                sz *= 1f + persistentTap * 0.75f;
            }

            if (("BLOOM".equals(plan.tapReaction) || "RIPPLE".equals(plan.tapReaction)) && persistentTap > 0f) {
                float wave = (float)Math.sin((float)Math.sqrt(d2) * 5.2f - tapAge * 8.0f);
                float bump = 1f + Math.max(0f, wave) * persistentTap * 0.28f;
                sx *= bump; sy *= bump; sz *= bump;
            }

            float[] materialScale = materialScale(sx, sy, sz, i, seconds);
            sx = materialScale[0]; sy = materialScale[1]; sz = materialScale[2];

            float[] matrix = new float[16];
            Matrix.setIdentityM(matrix, 0);
            Matrix.translateM(matrix, 0, x, y, z);
            Matrix.rotateM(matrix, 0,
                    seconds * (10f + i * 0.63f) * (0.22f + plan.motion), 0.3f, 1f, 0.2f);
            Matrix.scaleM(matrix, 0, sx, sy, sz);
            tm.setTransform(instance, matrix);
        }
    }

    private void updateAtmosphereNode(TransformManager tm, int instance, int i, float seconds,
                                      boolean visible, float persistentTap) {
        int local = i - ATMOSPHERE_START;
        float visibility = visible ? 1f : 0.001f;
        float seed = local * 1.618f;
        float speed = 0.08f + plan.motion * 0.34f;
        float x = wrapSigned(local * 0.173f + seconds * speed * environmentFlowDirection()) * 5.8f;
        float y = (float)Math.sin(seed * 1.9f + seconds * speed * 1.7f) * 1.75f;
        float z = -4.3f - (local % 7) * (0.55f + plan.depth * 0.72f);
        float scale = visibility * (0.035f + plan.particleLevel * 0.10f) * atmosphereScale(local);
        float sx = scale, sy = scale, sz = scale;

        if ("FOG".equals(plan.environment) || "SMOKE".equals(plan.environment)) {
            sx *= 4.2f; sy *= 1.7f; sz *= 0.55f;
            x += (float)Math.sin(seconds * 0.08f + local) * 0.7f;
        } else if ("ASH".equals(plan.environment) || "POLLEN".equals(plan.environment)) {
            y = wrapSigned(local * 0.21f - seconds * speed * 0.10f) * 3.5f;
            sx *= 0.55f; sy *= 1.6f; sz *= 0.55f;
        } else if ("GLITCH".equals(plan.environment)) {
            x = wrapSigned(local * 0.19f + seconds * speed * 0.16f) * 5.4f;
            y = ((local % 5) - 2) * 0.42f + (float)Math.sin(seconds * 2.2f + local) * 0.05f;
            sx *= 2.2f; sy *= 0.22f; sz *= 0.25f;
        } else if ("BUBBLES".equals(plan.environment)) {
            y = wrapSigned(local * 0.18f - seconds * speed * 0.07f) * 3.8f;
            scale *= 1.35f;
            sx = sy = sz = scale;
        } else { // STARDUST
            sx *= 0.42f; sy *= 0.42f; sz *= 0.42f;
        }

        if (persistentTap > 0f) {
            float dx = x - (lastTapX - 0.5f) * 3.2f;
            float dy = y - (0.5f - lastTapY) * 2.2f;
            x += dx * persistentTap * 0.06f;
            y += dy * persistentTap * 0.06f;
        }

        float[] matrix = new float[16];
        Matrix.setIdentityM(matrix, 0);
        Matrix.translateM(matrix, 0, x, y, z);
        Matrix.rotateM(matrix, 0, seconds * (8f + local), 0.2f, 1f, 0.4f);
        Matrix.scaleM(matrix, 0, sx, sy, sz);
        tm.setTransform(instance, matrix);
    }

    private void updateForegroundNode(TransformManager tm, int instance, int i, float seconds,
                                      float persistentTap) {
        int local = i - FOREGROUND_START;
        float side = local % 2 == 0 ? -1f : 1f;
        float lane = local / 2f;
        float x = side * (2.25f + lane * 0.24f) + (float)Math.sin(seconds * 0.09f + local) * 0.16f;
        float y = -0.95f + lane * 0.52f + (float)Math.cos(seconds * 0.12f + local) * 0.12f;
        float z = -1.25f - (local % 3) * 0.38f;
        float scale = (0.42f + plan.contrastLevel * 0.58f) * (0.72f + (local % 3) * 0.24f);
        float sx = scale * ("SHARD_STORM".equals(plan.layout) ? 0.32f : 0.72f);
        float sy = scale * ("GATE".equals(plan.layout) ? 1.65f : 1.15f);
        float sz = scale * ("TUNNEL".equals(plan.layout) ? 2.2f : 0.72f);
        if (persistentTap > 0f) {
            x += side * persistentTap * 0.22f;
            sy *= 1f + persistentTap * 0.18f;
        }

        float[] matrix = new float[16];
        Matrix.setIdentityM(matrix, 0);
        Matrix.translateM(matrix, 0, x, y, z);
        Matrix.rotateM(matrix, 0, side * (18f + local * 9f) + seconds * 2.2f, 0.15f, 1f, 0.3f);
        Matrix.scaleM(matrix, 0, sx, sy, sz);
        tm.setTransform(instance, matrix);
    }

    private float[] applyComposition(float x, float y, float z, int i, float phase) {
        switch (plan.composition) {
            case "CENTER":
                x *= 0.72f; y *= 0.72f; break;
            case "EDGE": {
                float push = 0.52f + (i % 4) * 0.08f;
                x += Math.signum(x == 0f ? ((i & 1) == 0 ? -1f : 1f) : x) * push;
                y *= 0.92f;
                break;
            }
            case "DIAGONAL":
                y = y * 0.72f + x * 0.34f; x *= 1.06f; break;
            case "SPIRAL": {
                float r = (float)Math.sqrt(x * x + y * y);
                float a = (float)Math.atan2(y, x) + r * 0.42f + phase * 0.08f;
                x = (float)Math.cos(a) * r;
                y = (float)Math.sin(a) * r;
                break;
            }
            case "HOLLOW_CENTER": {
                float r = (float)Math.sqrt(x * x + y * y);
                if (r < 0.9f) {
                    float f = 0.9f / Math.max(0.12f, r);
                    x *= f; y *= f;
                }
                break;
            }
            case "CLUSTERED":
            default:
                x += ((i % 3) - 1) * 0.13f;
                y += ((i % 5) - 2) * 0.06f;
                break;
        }
        return new float[]{x, y, z};
    }

    private float[] materialScale(float sx, float sy, float sz, int i, float seconds) {
        switch (plan.materialStyle) {
            case "GLASS":
                return new float[]{sx * 0.90f, sy * 1.06f, sz * 0.90f};
            case "METAL":
                return new float[]{sx * 1.14f, sy * 0.78f, sz * 1.36f};
            case "BIO": {
                float breathe = 0.92f + 0.12f * (float)Math.sin(seconds * 1.2f + i * 0.7f);
                return new float[]{sx * breathe, sy * (1.18f + (i % 3) * 0.12f), sz * breathe};
            }
            case "CRYSTAL":
                return new float[]{sx * 0.55f, sy * 1.42f, sz * 0.62f};
            case "INK":
                return new float[]{sx * 1.34f, sy * 0.72f, sz * 0.46f};
            case "ENERGY":
            default: {
                float pulse = 0.94f + plan.pulseStrength * 0.10f * (float)Math.sin(seconds * 2.4f + i);
                return new float[]{sx * pulse, sy * pulse, sz * pulse};
            }
        }
    }

    private float atmosphereScale(int local) {
        return 0.72f + (local % 5) * 0.18f;
    }

    private float environmentFlowDirection() {
        return ("ASH".equals(plan.environment) || "GLITCH".equals(plan.environment)) ? 1f : 0.42f;
    }

    private void tuneLighting(WorldPlan value) {
        if (engine == null) return;
        try {
            LightManager lm = engine.getLightManager();
            float[] accent = linearRgb(value.accent);
            int main = lm.getInstance(lightEntity);
            if (main != 0) {
                lm.setColor(main, clamp(accent[0] * 1.4f, 0.05f, 1f),
                        clamp(accent[1] * 1.4f, 0.05f, 1f), clamp(accent[2] * 1.4f, 0.05f, 1f));
                float styleBoost = "METAL".equals(value.materialStyle) ? 1.22f :
                        ("CRYSTAL".equals(value.materialStyle) ? 1.34f : 1f);
                lm.setIntensity(main, (34_000f + value.contrastLevel * 52_000f) * styleBoost);
            }
            int fill = lm.getInstance(fillLightEntity);
            if (fill != 0) {
                float[] secondary = linearRgb(value.secondary);
                lm.setColor(fill, clamp(secondary[0] * 2.2f, 0.04f, 1f),
                        clamp(secondary[1] * 2.2f, 0.04f, 1f), clamp(secondary[2] * 2.2f, 0.04f, 1f));
                lm.setIntensity(fill, 9_000f + value.contrastLevel * 22_000f);
            }
        } catch (Throwable ignored) {}

        try {
            com.google.android.filament.View.BloomOptions bloom = filamentView.getBloomOptions();
            bloom.enabled = true;
            filamentView.setBloomOptions(bloom);
        } catch (Throwable ignored) {}
    }

    private void applyRippleTransform(TransformManager tm, int instance, RippleState ripple,
                                      long nowMs, int nodeIndex) {
        float age = (nowMs - ripple.startedAt) / (620f + plan.pulseStrength * 420f);
        if (age < 0f) age = 0f;
        if (age >= 1f) {
            ripple.active = false;
            return;
        }

        float x = (ripple.x - 0.5f) * 3.35f;
        float y = (0.5f - ripple.y) * 2.35f;
        float z = -2.25f - (nodeIndex % 3) * 0.22f;
        float scale = (0.12f + age * (2.15f + plan.pulseStrength * 1.35f)) * ripple.strength;

        float[] matrix = new float[16];
        Matrix.setIdentityM(matrix, 0);
        Matrix.translateM(matrix, 0, x, y, z);
        Matrix.rotateM(matrix, 0, 90f, 1f, 0f, 0f);
        Matrix.scaleM(matrix, 0, scale, scale, Math.max(0.08f, scale * 0.18f));
        tm.setTransform(instance, matrix);
    }

    private RippleState rippleForNode(int nodeIndex) {
        for (int i = 0; i < RING_NODE_INDICES.length; i++) {
            if (RING_NODE_INDICES[i] == nodeIndex) return ripples[i];
        }
        return null;
    }

    private float motifBias(int nodeIndex) {
        int kind = nodeIndex % 3; // sphere, torus, box from generated GLB
        switch (plan.motif) {
            case "PORTALS": return kind == 1 ? 1.35f : 0.42f;
            case "SHARDS":
            case "GLYPHS": return kind == 2 ? 1.20f : 0.48f;
            case "EYES": return kind == 0 ? 1.20f : (kind == 1 ? 0.76f : 0.32f);
            case "JELLYFISH": return kind == 0 ? 1.00f : (kind == 1 ? 0.72f : 0.28f);
            case "VINES": return kind == 2 ? 0.82f : 0.58f;
            case "STARS": return kind == 2 ? 0.94f : 0.62f;
            case "ORBS":
            default: return kind == 0 ? 1.18f : 0.48f;
        }
    }

    private static float[] linearRgb(String hex) {
        int c = Color.rgb(5, 8, 18);
        try { c = Color.parseColor(hex); } catch (Exception ignored) {}
        return new float[]{
                srgbToLinear(Color.red(c) / 255f),
                srgbToLinear(Color.green(c) / 255f),
                srgbToLinear(Color.blue(c) / 255f)
        };
    }

    private static float srgbToLinear(float v) {
        return v <= 0.04045f ? v / 12.92f :
                (float)Math.pow((v + 0.055f) / 1.055f, 2.4);
    }

    private static float wrapSigned(float value) {
        float f = value - (float)Math.floor(value);
        return f - 0.5f;
    }

    private static float clamp(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }

    private static final class RippleState {
        boolean active = false;
        long startedAt = 0L;
        float x = 0.5f;
        float y = 0.5f;
        float strength = 1f;
    }
}
