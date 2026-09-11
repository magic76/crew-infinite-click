package com.magic76.aiclicker;

import org.json.JSONObject;

import java.util.Locale;

final class WorldPlan {
    final String theme;
    final String motif;
    final String mood;
    final String tapReaction;
    final String evolution;
    final String primary;
    final String secondary;
    final String accent;
    final float density;
    final float motion;
    final float scale;

    private WorldPlan(String theme, String motif, String mood, String tapReaction, String evolution,
                      String primary, String secondary, String accent,
                      float density, float motion, float scale) {
        this.theme = theme;
        this.motif = motif;
        this.mood = mood;
        this.tapReaction = tapReaction;
        this.evolution = evolution;
        this.primary = primary;
        this.secondary = secondary;
        this.accent = accent;
        this.density = density;
        this.motion = motion;
        this.scale = scale;
    }

    static WorldPlan defaultPlan() {
        return new WorldPlan(
                "COSMIC", "ORBS", "CURIOUS", "BLOOM", "DRIFT",
                "#070B1A", "#172554", "#7DD3FC",
                0.48f, 0.42f, 0.62f
        );
    }

    static WorldPlan parse(JSONObject root) {
        if (root == null) return null;
        JSONObject p = root.optJSONObject("worldPlan");
        if (p == null) {
            JSONObject director = root.optJSONObject("directorPlan");
            if (director != null) p = director.optJSONObject("worldPlan");
        }
        if (p == null) return null;

        String theme = enumValue(p.optString("theme", "COSMIC"),
                new String[]{"COSMIC","ABYSS","GARDEN","CIRCUIT","DREAM","INK","LAVA","ICE"}, "COSMIC");
        String motif = enumValue(p.optString("motif", "ORBS"),
                new String[]{"ORBS","STARS","EYES","JELLYFISH","VINES","PORTALS","SHARDS","GLYPHS"}, "ORBS");
        String mood = enumValue(p.optString("mood", "CURIOUS"),
                new String[]{"CALM","CURIOUS","PLAYFUL","EERIE","CHAOTIC"}, "CURIOUS");
        String tap = enumValue(p.optString("tapReaction", "BLOOM"),
                new String[]{"BLOOM","RIPPLE","CRACK","ATTRACT","REPEL","MULTIPLY","WARP"}, "BLOOM");
        String evolution = enumValue(p.optString("evolution", "DRIFT"),
                new String[]{"DRIFT","GROW","PULSE","ORBIT","FLOW","BREATHE"}, "DRIFT");

        JSONObject palette = p.optJSONObject("palette");
        String primary = color(palette == null ? "" : palette.optString("primary", ""), "#070B1A");
        String secondary = color(palette == null ? "" : palette.optString("secondary", ""), "#172554");
        String accent = color(palette == null ? "" : palette.optString("accent", ""), "#7DD3FC");

        float density = clamp((float)p.optDouble("density", 0.48), 0.12f, 1f);
        float motion = clamp((float)p.optDouble("motion", 0.42), 0.05f, 1f);
        float scale = clamp((float)p.optDouble("scale", 0.62), 0.25f, 1f);

        return new WorldPlan(theme, motif, mood, tap, evolution,
                primary, secondary, accent, density, motion, scale);
    }

    JSONObject toJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("theme", theme);
            o.put("motif", motif);
            o.put("mood", mood);
            o.put("tapReaction", tapReaction);
            o.put("evolution", evolution);
            o.put("density", density);
            o.put("motion", motion);
            o.put("scale", scale);
            o.put("palette", new JSONObject()
                    .put("primary", primary)
                    .put("secondary", secondary)
                    .put("accent", accent));
        } catch (Exception ignored) {}
        return o;
    }

    private static String enumValue(String value, String[] allowed, String fallback) {
        if (value == null) return fallback;
        String v = value.trim().toUpperCase(Locale.ROOT);
        for (String a : allowed) if (a.equals(v)) return v;
        return fallback;
    }

    private static String color(String value, String fallback) {
        if (value == null) return fallback;
        String v = value.trim();
        return v.matches("#[0-9A-Fa-f]{6}") ? v.toUpperCase(Locale.ROOT) : fallback;
    }

    private static float clamp(float v, float min, float max) {
        return Math.max(min, Math.min(max, v));
    }
}
