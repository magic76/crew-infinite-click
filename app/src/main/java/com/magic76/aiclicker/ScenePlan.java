package com.magic76.aiclicker;

import org.json.JSONObject;
import java.util.Locale;

/** High-level visual intent. Pixi owns how it is rendered. */
final class ScenePlan {
    final String intent;
    final String mood;
    final String primary;
    final String secondary;
    final String accent;
    final float energy;
    final float tempo;
    final float focusX;
    final float focusY;

    private ScenePlan(String intent, String mood, String primary, String secondary, String accent,
                      float energy, float tempo, float focusX, float focusY) {
        this.intent = intent;
        this.mood = mood;
        this.primary = primary;
        this.secondary = secondary;
        this.accent = accent;
        this.energy = energy;
        this.tempo = tempo;
        this.focusX = focusX;
        this.focusY = focusY;
    }

    static ScenePlan defaultPlan() {
        return new ScenePlan("TEASE", "CURIOUS", "#070A14", "#111A33", "#65F6FF",
                0.52f, 0.48f, 0.5f, 0.52f);
    }

    static ScenePlan parse(JSONObject root) {
        if (root == null) return null;
        JSONObject p = root.optJSONObject("scenePlan");
        if (p == null) return null;
        return new ScenePlan(
                enumValue(p.optString("intent", "TEASE"), new String[]{"TEASE","ESCAPE","SWARM","REVEAL","ABSORB","FRACTURE","GLITCH","CALM","CELEBRATE"}, "TEASE"),
                enumValue(p.optString("mood", "CURIOUS"), new String[]{"CURIOUS","PLAYFUL","EERIE","CHAOTIC","CALM","TRIUMPHANT"}, "CURIOUS"),
                color(p.optString("primary", "#070A14"), "#070A14"),
                color(p.optString("secondary", "#111A33"), "#111A33"),
                color(p.optString("accent", "#65F6FF"), "#65F6FF"),
                clamp((float)p.optDouble("energy", 0.52), 0.1f, 1f),
                clamp((float)p.optDouble("tempo", 0.48), 0.1f, 1f),
                clamp((float)p.optDouble("focusX", 0.5), 0f, 1f),
                clamp((float)p.optDouble("focusY", 0.52), 0f, 1f));
    }

    JSONObject toJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("intent", intent); o.put("mood", mood);
            o.put("primary", primary); o.put("secondary", secondary); o.put("accent", accent);
            o.put("energy", energy); o.put("tempo", tempo); o.put("focusX", focusX); o.put("focusY", focusY);
        } catch (Exception ignored) {}
        return o;
    }

    private static String enumValue(String value, String[] allowed, String fallback) {
        String v = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        for (String a : allowed) if (a.equals(v)) return v;
        return fallback;
    }
    private static String color(String value, String fallback) {
        String v = value == null ? "" : value.trim();
        return v.matches("#[0-9A-Fa-f]{6}") ? v.toUpperCase(Locale.ROOT) : fallback;
    }
    private static float clamp(float v, float min, float max) { return Math.max(min, Math.min(max, v)); }
}
