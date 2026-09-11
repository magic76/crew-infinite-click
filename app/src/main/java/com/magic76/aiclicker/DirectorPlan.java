package com.magic76.aiclicker;

import org.json.JSONObject;

import java.util.Locale;

final class DirectorPlan {
    final long baseStateVersion;
    final String speech;
    final String mechanic;
    final long mechanicDurationMs;
    final JSONObject rule;
    final String twist;
    final String tapEffect;
    final String world;
    final String transition;
    final float sceneIntensity;
    final long sceneDurationMs;

    private DirectorPlan(long baseStateVersion, String speech, String mechanic, long mechanicDurationMs,
                         JSONObject rule, String twist, String tapEffect, String world, String transition,
                         float sceneIntensity, long sceneDurationMs) {
        this.baseStateVersion = baseStateVersion;
        this.speech = speech;
        this.mechanic = mechanic;
        this.mechanicDurationMs = mechanicDurationMs;
        this.rule = rule;
        this.twist = twist;
        this.tapEffect = tapEffect;
        this.world = world;
        this.transition = transition;
        this.sceneIntensity = sceneIntensity;
        this.sceneDurationMs = sceneDurationMs;
    }

    static DirectorPlan parse(JSONObject root) {
        if (root == null) return null;
        JSONObject p = root.optJSONObject("directorPlan");
        if (p == null) return null;
        String speech = safe(p.optString("speech", root.optString("speech", "")), 200);
        String mechanic = normalize(p.optString("mechanic", ""), new String[]{"CHASE","SHRINK","SPLIT","BLINK","SWARM"});
        long mechanicDuration = clamp(p.optLong("mechanicDurationMs", 3200L), 1200L, 8000L);
        JSONObject rule = p.optJSONObject("rule");
        String twist = normalize(p.optString("twist", ""), new String[]{"INVERT_RULE","SWAP_ROLES","GHOST_ALL","NEON_ALL","CHAOS"});
        String tapEffect = normalize(p.optString("tapEffect", ""), new String[]{"BOUNCE","SPLIT","VANISH","SHOCKWAVE","COLOR_SHIFT","WORLD_FLIP"});
        String world = normalize(p.optString("world", ""), new String[]{"NEON","COMIC","MINIMAL","GLITCH","SPACE"});
        String transition = normalize(p.optString("transition", "PULSE"), new String[]{"PULSE","IMPACT","WIPE","GLITCH","ZOOM"});
        float intensity = clampFloat((float)p.optDouble("sceneIntensity", 0.65), 0.15f, 1f);
        long sceneDuration = clamp(p.optLong("sceneDurationMs", 2600L), 800L, 7000L);
        long baseVersion = p.optLong("baseStateVersion", root.optLong("baseStateVersion", -1L));
        return new DirectorPlan(baseVersion, speech, mechanic, mechanicDuration, rule, twist, tapEffect, world, transition, intensity, sceneDuration);
    }

    boolean hasSemanticWork() {
        return !mechanic.isEmpty() || rule != null || !twist.isEmpty() || !tapEffect.isEmpty() || !world.isEmpty();
    }

    private static String normalize(String value, String[] allowed) {
        if (value == null) return "";
        String v = value.trim().toUpperCase(Locale.ROOT);
        for (String a : allowed) if (a.equals(v)) return v;
        return "";
    }

    private static String safe(String value, int max) {
        if (value == null) return "";
        String v = value.trim();
        return v.length() <= max ? v : v.substring(0, max);
    }

    private static long clamp(long v, long min, long max) { return Math.max(min, Math.min(max, v)); }
    private static float clampFloat(float v, float min, float max) { return Math.max(min, Math.min(max, v)); }
}
