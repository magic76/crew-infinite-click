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
    private static final int NODE_COUNT = 18;
    private static final int[] RING_NODE_INDICES = {1, 4, 7, 10, 13, 16};

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

    private final Choreographer.FrameCallback frameCallback = frameTimeNanos -> {
        if (!rendering || destroyed) return;
        choreographer.postFrameCallback(frameCallback);
        if (!uiHelper.isReadyToRender() || swapChain == null || renderer == null) return;

        updateWorld(frameTimeNanos);

        if (renderer.beginFrame(swapChain, frameTimeNanos)) {
            renderer.render(filamentView);
            renderer.endFrame();
            if (assetLoaded && renderableCount > 0) firstFrameRendered = true;
        }
    };

    FilamentWorldView(Context context) {
        super(context);
        setBackgroundColor(Color.BLACK);
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
            float[] rgb = linearRgb(value.primary);
            skybox.setColor(rgb[0], rgb[1], rgb[2], 1f);
        }
    }

    void onWorldTap(float x, float y, double momentum) {
        lastTapX = clamp(x, 0f, 1f);
        lastTapY = clamp(y, 0f, 1f);
        tapEnergy = clamp(tapEnergy + 0.28f + (float)momentum * 0.18f, 0f, 1.4f);

        RippleState ripple = ripples[nextRippleSlot++ % ripples.length];
        ripple.active = true;
        ripple.startedAt = System.currentTimeMillis();
        ripple.x = lastTapX;
        ripple.y = lastTapY;
        ripple.strength = 0.75f + (float)momentum * 0.55f;
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

        tapEnergy = Math.max(0f, tapEnergy - 0.014f);

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
        int activeCount = Math.max(5, Math.min(NODE_COUNT,
                Math.round(6 + plan.density * (NODE_COUNT - 6))));

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

            float visibility = i < activeCount ? 1f : 0.001f;
            float shapeBias = "SHARD_STORM".equals(plan.layout)
                    ? (i % 3 == 2 ? 1.35f : 0.28f)
                    : motifBias(i);
            float scale = visibility * shapeBias * (0.42f + plan.scale * 0.92f);

            float angle = (float)(i / (double)NODE_COUNT * Math.PI * 2.0);
            float ringRadius = 1.15f + (i % 4) * 0.42f;
            float speed = 0.18f + plan.motion * 0.82f;
            float phase = angle + seconds * speed * (0.34f + (i % 5) * 0.05f);

            float x;
            float y;
            float z;
            float depthSpread = 0.32f + plan.depth * 0.72f;

            switch (plan.layout) {
                case "TUNNEL": {
                    float tunnelAngle = angle + seconds * speed * 0.34f;
                    float tunnelRadius = 0.65f + (i % 3) * 0.34f;
                    x = (float)Math.cos(tunnelAngle) * tunnelRadius;
                    y = (float)Math.sin(tunnelAngle) * tunnelRadius * 0.68f;
                    z = -1.9f - (i % 9) * depthSpread * 0.72f;
                    break;
                }
                case "VORTEX": {
                    float t = (i + 1f) / NODE_COUNT;
                    float vortexAngle = phase * 1.55f + t * 8.0f;
                    float vortexRadius = 0.32f + t * 1.85f;
                    x = (float)Math.cos(vortexAngle) * vortexRadius;
                    y = (float)Math.sin(vortexAngle) * vortexRadius * 0.64f;
                    z = -2.0f - t * depthSpread * 5.4f;
                    break;
                }
                case "GATE": {
                    float gateAngle = angle + seconds * speed * 0.16f;
                    float gateRadius = 1.15f + (i % 2) * 0.42f;
                    x = (float)Math.cos(gateAngle) * gateRadius;
                    y = (float)Math.sin(gateAngle) * gateRadius;
                    z = -3.1f - (i % 3) * depthSpread * 0.32f;
                    break;
                }
                case "SHARD_STORM": {
                    x = (float)Math.sin(i * 2.31f + seconds * speed * 0.8f) * (1.35f + (i % 4) * 0.28f);
                    y = (float)Math.cos(i * 1.73f + seconds * speed * 0.66f) * (0.75f + (i % 3) * 0.22f);
                    z = -2.0f - (i % 8) * depthSpread * 0.58f;
                    break;
                }
                case "FIELD":
                default:
                    if ("ORBIT".equals(plan.evolution)) {
                        x = (float)Math.cos(phase) * ringRadius;
                        y = (float)Math.sin(phase) * (0.72f + (i % 3) * 0.16f);
                        z = -2.4f - (i % 6) * depthSpread * 0.62f;
                    } else if ("FLOW".equals(plan.evolution)) {
                        x = wrapSigned((i * 0.31f + seconds * speed * 0.11f)) * 2.4f;
                        y = (float)Math.sin(phase * 1.2f) * 1.05f;
                        z = -2.5f - (i % 7) * depthSpread * 0.55f;
                    } else {
                        x = (float)Math.cos(angle) * ringRadius +
                                (float)Math.sin(phase * 0.7f) * (0.16f + plan.motion * 0.22f);
                        y = (float)Math.sin(angle * 1.5f) * 0.95f +
                                (float)Math.cos(phase) * (0.12f + plan.motion * 0.18f);
                        z = -2.2f - (i % 6) * depthSpread * 0.68f;
                    }
                    break;
            }

            if ("GROW".equals(plan.evolution)) {
                float age = Math.min(1f, (nowMs - planAppliedAt) / 8500f);
                scale *= 0.62f + age * 0.58f;
            } else if ("PULSE".equals(plan.evolution)) {
                scale *= 0.84f + 0.24f * (float)Math.sin(phase * 2.1f);
            } else if ("BREATHE".equals(plan.evolution)) {
                scale *= 0.90f + 0.16f * (float)Math.sin(seconds * 1.15f);
            }

            // Keep one unmistakable renderable in front of the camera. This is both part of
            // the aesthetic and a visibility guard for the prototype.
            if (i == 0) {
                x = 0f;
                y = (float)Math.sin(seconds * 0.7f) * 0.18f;
                z = -2.65f;
                scale = Math.max(scale, 0.78f + 0.12f * (float)Math.sin(seconds * 1.4f));
            }

            // Tap energy bends nearby geometry toward the last touch focus.
            float touchWorldX = (lastTapX - 0.5f) * 3.2f;
            float touchWorldY = (0.5f - lastTapY) * 2.2f;
            float dx = touchWorldX - x;
            float dy = touchWorldY - y;
            float d2 = dx * dx + dy * dy + 0.35f;
            float force = tapEnergy * 0.26f / d2;
            if ("ATTRACT".equals(plan.tapReaction)) {
                x += dx * force;
                y += dy * force;
            } else if ("REPEL".equals(plan.tapReaction) || "CRACK".equals(plan.tapReaction)) {
                x -= dx * force;
                y -= dy * force;
            } else if ("WARP".equals(plan.tapReaction)) {
                z += (float)Math.sin(seconds * 3.0f + i) * tapEnergy * 0.32f;
            }

            float[] matrix = new float[16];
            Matrix.setIdentityM(matrix, 0);
            Matrix.translateM(matrix, 0, x, y, z);
            Matrix.rotateM(matrix, 0,
                    seconds * (12f + i * 0.7f) * (0.25f + plan.motion), 0.3f, 1f, 0.2f);
            Matrix.scaleM(matrix, 0, scale, scale, scale);
            tm.setTransform(instance, matrix);
        }
    }

    private void applyRippleTransform(TransformManager tm, int instance, RippleState ripple,
                                      long nowMs, int nodeIndex) {
        float age = (nowMs - ripple.startedAt) / 720f;
        if (age >= 1f) {
            ripple.active = false;
            return;
        }

        float x = (ripple.x - 0.5f) * 3.35f;
        float y = (0.5f - ripple.y) * 2.35f;
        float z = -2.25f - (nodeIndex % 3) * 0.22f;
        float scale = (0.18f + age * 2.25f) * ripple.strength;

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
