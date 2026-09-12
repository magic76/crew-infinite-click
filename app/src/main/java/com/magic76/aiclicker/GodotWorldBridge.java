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
    private volatile boolean ready;
    private volatile boolean destroyed;
    private WorldPlan currentPlan = WorldPlan.defaultPlan();

    void attachPlugin(VisualBridgePlugin nextPlugin) {
        if (destroyed) return;
        plugin = nextPlugin;
        Log.i(TAG, "Runtime plugin attached");
    }

    void onGodotSetupCompleted() {
        if (destroyed) return;
        setupCompleted = true;
        Log.i(TAG, "Bridge observed Godot setup completion");
    }

    void onGodotMainLoopStarted() {
        if (destroyed) return;
        mainLoopStarted = true;
        Log.i(TAG, "Bridge observed Godot main loop start");
        maybeBecomeReady();
    }

    void onGodotSceneReady() {
        if (destroyed) return;
        sceneReady = true;
        Log.i(TAG, "GDScript scene reported ready");
        maybeBecomeReady();
    }

    private synchronized void maybeBecomeReady() {
        if (ready || destroyed || plugin == null || !mainLoopStarted || !sceneReady) return;
        ready = true;
        Log.i(TAG, "Godot renderer READY");
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
        return ready;
    }

    @Override public String renderStatus() {
        if (ready) return "GODOT";
        if (sceneReady && !mainLoopStarted) return "GODOT WAIT LOOP";
        if (mainLoopStarted && !sceneReady) return "GODOT SCENE";
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
        plugin = null;
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
