package com.magic76.aiclicker;

/**
 * Rendering boundary between the deterministic Android game runtime and the visual engine.
 *
 * The game owns state. A renderer only receives a compact WorldPlan and tap/effect events.
 * This keeps Gemini and gameplay independent from Godot/Filament implementation details.
 */
interface WorldSurface {
    void applyWorldPlan(WorldPlan plan);
    void onWorldTap(float normalizedX, float normalizedY, double momentum);
    void playEffect(String name, float normalizedX, float normalizedY, float strength);
    WorldPlan currentPlan();
    boolean isReady();
    String renderStatus();
    void reset();
}
