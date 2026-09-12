package com.magic76.aiclicker;

import org.json.JSONObject;

import java.util.Locale;

/** Safe, high-level interaction intent. Pixi decides how the beat is animated. */
final class InteractionPlan {
    final String mode;
    final String label;
    final float targetX;
    final float targetY;
    final float strength;
    final long durationMs;

    private InteractionPlan(String mode, String label, float targetX, float targetY, float strength, long durationMs) {
        this.mode = mode;
        this.label = label;
        this.targetX = targetX;
        this.targetY = targetY;
        this.strength = strength;
        this.durationMs = durationMs;
    }

    static InteractionPlan parse(JSONObject root) {
        if (root == null) return null;
        JSONObject o = root.optJSONObject("interaction");
        if (o == null) return null;
        String mode = enumValue(o.optString("mode", "NONE"),
                new String[]{"NONE", "TEASE", "CHASE", "DECOY", "WAIT", "PREDICT", "MIRROR", "RHYTHM", "REWARD", "HIDE"},
                "NONE");
        String label = safeText(o.optString("label", ""), 28);
        float x = clamp((float) o.optDouble("targetX", 0.5), 0.06f, 0.94f);
        float y = clamp((float) o.optDouble("targetY", 0.52), 0.10f, 0.90f);
        float strength = clamp((float) o.optDouble("strength", 0.6), 0.1f, 1f);
        long duration = clampLong(o.optLong("durationMs", 1600L), 250L, 6000L);
        return new InteractionPlan(mode, label, x, y, strength, duration);
    }

    JSONObject toJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("mode", mode);
            o.put("label", label);
            o.put("targetX", targetX);
            o.put("targetY", targetY);
            o.put("strength", strength);
            o.put("durationMs", durationMs);
        } catch (Exception ignored) {}
        return o;
    }

    private static String enumValue(String value, String[] allowed, String fallback) {
        String v = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        for (String a : allowed) if (a.equals(v)) return v;
        return fallback;
    }

    private static String safeText(String value, int max) {
        if (value == null) return "";
        String clean = value.replace('\n', ' ').replace('\r', ' ').trim();
        return clean.length() <= max ? clean : clean.substring(0, max);
    }

    private static float clamp(float v, float min, float max) { return Math.max(min, Math.min(max, v)); }
    private static long clampLong(long v, long min, long max) { return Math.max(min, Math.min(max, v)); }
}
