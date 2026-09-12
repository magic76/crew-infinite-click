package com.magic76.aiclicker;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Small, one-way command bridge from Android gameplay into the embedded Godot renderer.
 *
 * Important: Android remains authoritative. Godot never decides score/rules/timers; it only
 * renders the current WorldPlan and visual reactions. This lets us make visuals extravagant
 * without coupling them to Gemini tool-call reliability.
 */
final class GodotWorldBridge implements WorldSurface {
    private static final String TAG = "InfiniteClickGodot";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final AtomicLong sequence = new AtomicLong(1L);

    private volatile VisualBridgePlugin plugin;
    private volatile boolean setupCompleted;
    private volatile boolean mainLoopStarted;
    private volatile boolean sceneReady;
    private volatile boolean ready; // VFX scene handshake complete; safe to send commands.
    private volatile boolean destroyed;
    private volatile String sceneStage = "INIT";
    private volatile Runnable stateListener;
    private WorldPlan currentPlan = WorldPlan.defaultPlan();

    void setStateListener(Runnable listener) {
        stateListener = listener;
    }

    private void notifyStateChanged() {
        Runnable listener = stateListener;
        if (listener != null) mainHandler.post(listener);
    }

    void attachPlugin(VisualBridgePlugin nextPlugin) {
        if (destroyed) return;
        plugin = nextPlugin;
        Log.i(TAG, "Runtime plugin attached");
        notifyStateChanged();
    }

    void onGodotSetupCompleted() {
        if (destroyed) return;
        setupCompleted = true;
        Log.i(TAG, "Bridge observed Godot setup completion");
        notifyStateChanged();
    }

    void onGodotMainLoopStarted() {
        if (destroyed) return;
        mainLoopStarted = true;
        sceneStage = "LOOP";
        Log.i(TAG, "Bridge observed Godot main loop start");
        notifyStateChanged();
        maybeBecomeReady();
    }

    void onGodotStage(String stage) {
        if (destroyed) return;
        sceneStage = stage == null || stage.trim().isEmpty() ? "SCENE" : stage.trim();
        Log.i(TAG, "Godot stage: " + sceneStage);
        notifyStateChanged();
    }

    void onGodotSceneReady() {
        if (destroyed) return;
        sceneReady = true;
        sceneStage = "READY";
        Log.i(TAG, "GDScript scene reported ready");
        notifyStateChanged();
        maybeBecomeReady();
    }

    private synchronized void maybeBecomeReady() {
        if (ready || destroyed || plugin == null || !mainLoopStarted || !sceneReady) return;
        ready = true;
        Log.i(TAG, "Godot renderer READY");
        notifyStateChanged();
        sendResetInternal();
        sendWorldPlanInternal(currentPlan);
    }

    @Override public synchronized void applyWorldPlan(WorldPlan plan) {
        if (plan == null) return;
        currentPlan = plan;
        if (ready) sendWorldPlanInternal(plan);
    }

    @Override public synchronized void onWorldTap(float normalizedX, float normalizedY, double momentum) {
        if (!ready) return;
        JSONObject command = baseCommand("tap");
        try {
            command.put("x", clamp(normalizedX));
            command.put("y", clamp(normalizedY));
            command.put("momentum", Math.max(0.0, Math.min(1.0, momentum)));
            command.put("reaction", currentPlan.tapReaction);
            command.put("theme", currentPlan.theme);
            command.put("accent", currentPlan.accent);
            command.put("pulseStrength", currentPlan.pulseStrength);
        } catch (Exception ignored) {}
        emit(command);
    }

    /** Curated VFX actions only; arbitrary shader/code execution is never exposed to the model. */
    @Override public void playEffect(String name, float normalizedX, float normalizedY, float strength) {
        if (!ready || name == null || name.trim().isEmpty()) return;
        JSONObject command = baseCommand("effect");
        try {
            command.put("name", name.trim());
            command.put("x", clamp(normalizedX));
            command.put("y", clamp(normalizedY));
            command.put("strength", Math.max(0f, Math.min(1f, strength)));
        } catch (Exception ignored) {}
        emit(command);
    }

    @Override public synchronized WorldPlan currentPlan() {
        return currentPlan;
    }

    @Override public boolean isReady() {
        // This answers whether the Godot *surface* should be visible, not whether VFX commands
        // are ready. As soon as the main loop exists, stop painting an Android black rectangle
        // over the Godot surface. If GDScript/shader boot fails, Godot's own clear color remains
        // black while renderStatus/logcat show the exact boot stage.
        return mainLoopStarted;
    }

    @Override public String renderStatus() {
        if (ready) return "GODOT";
        if (mainLoopStarted) return "GODOT " + sceneStage;
        if (setupCompleted) return "GODOT LOOP";
        if (plugin != null) return "GODOT LOAD";
        return "GODOT INIT";
    }

    @Override public synchronized void reset() {
        currentPlan = WorldPlan.defaultPlan();
        if (!ready) return;
        sendResetInternal();
        sendWorldPlanInternal(currentPlan);
    }

    void destroy() {
        destroyed = true;
        ready = false;
        sceneReady = false;
        mainLoopStarted = false;
        setupCompleted = false;
        sceneStage = "INIT";
        plugin = null;
        stateListener = null;
    }

    private void sendResetInternal() {
        emit(baseCommand("reset"));
    }

    private void sendWorldPlanInternal(WorldPlan plan) {
        if (plan == null) return;
        JSONObject command = baseCommand("world_plan");
        try { command.put("plan", plan.toJson()); } catch (Exception ignored) {}
        emit(command);
    }

    private JSONObject baseCommand(String type) {
        JSONObject command = new JSONObject();
        try {
            command.put("type", type);
            command.put("seq", sequence.getAndIncrement());
            command.put("sentAtMs", System.currentTimeMillis());
        } catch (Exception ignored) {}
        return command;
    }

    private void emit(JSONObject command) {
        VisualBridgePlugin target = plugin;
        if (destroyed || target == null || command == null) return;
        target.emitVisualCommand(command.toString());
    }

    private static float clamp(float v) {
        return Math.max(0f, Math.min(1f, v));
    }
}
