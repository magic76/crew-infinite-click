package com.magic76.aiclicker;

import org.json.JSONObject;

import java.util.Locale;

final class WorldPlan {
    final String theme;
    final String motif;
    final String mood;
    final String tapReaction;
    final String evolution;
    final String layout;
    final String cameraMotion;
    final String composition;
    final String environment;
    final String materialStyle;
    final String primary;
    final String secondary;
    final String accent;
    final float density;
    final float motion;
    final float scale;
    final float depth;
    final float particleLevel;
    final float pulseStrength;
    final float contrastLevel;

    private WorldPlan(String theme, String motif, String mood, String tapReaction, String evolution,
                      String layout, String cameraMotion, String composition, String environment,
                      String materialStyle, String primary, String secondary, String accent,
                      float density, float motion, float scale, float depth,
                      float particleLevel, float pulseStrength, float contrastLevel) {
        this.theme = theme;
        this.motif = motif;
        this.mood = mood;
        this.tapReaction = tapReaction;
        this.evolution = evolution;
        this.layout = layout;
        this.cameraMotion = cameraMotion;
        this.composition = composition;
        this.environment = environment;
        this.materialStyle = materialStyle;
        this.primary = primary;
        this.secondary = secondary;
        this.accent = accent;
        this.density = density;
        this.motion = motion;
        this.scale = scale;
        this.depth = depth;
        this.particleLevel = particleLevel;
        this.pulseStrength = pulseStrength;
        this.contrastLevel = contrastLevel;
    }

    static WorldPlan defaultPlan() {
        return new WorldPlan(
                "COSMIC", "ORBS", "CURIOUS", "BLOOM", "DRIFT",
                "FIELD", "DRIFT", "CLUSTERED", "STARDUST", "ENERGY",
                "#070B1A", "#172554", "#7DD3FC",
                0.48f, 0.42f, 0.62f, 0.62f, 0.55f, 0.62f, 0.68f
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
        String layout = enumValue(p.optString("layout", "FIELD"),
                new String[]{"FIELD","TUNNEL","VORTEX","GATE","SHARD_STORM"}, "FIELD");
        String cameraMotion = enumValue(p.optString("cameraMotion", "DRIFT"),
                new String[]{"DRIFT","FORWARD","ORBIT","FLOAT"}, "DRIFT");
        String composition = enumValue(p.optString("composition", "CLUSTERED"),
                new String[]{"CENTER","EDGE","DIAGONAL","SPIRAL","CLUSTERED","HOLLOW_CENTER"}, "CLUSTERED");
        String environment = enumValue(p.optString("environment", defaultEnvironment(theme)),
                new String[]{"FOG","STARDUST","SMOKE","BUBBLES","ASH","POLLEN","GLITCH"}, defaultEnvironment(theme));
        String materialStyle = enumValue(p.optString("materialStyle", defaultMaterialStyle(theme)),
                new String[]{"GLASS","METAL","BIO","ENERGY","CRYSTAL","INK"}, defaultMaterialStyle(theme));

        JSONObject palette = p.optJSONObject("palette");
        String primary = color(palette == null ? "" : palette.optString("primary", ""), "#070B1A");
        String secondary = color(palette == null ? "" : palette.optString("secondary", ""), "#172554");
        String accent = color(palette == null ? "" : palette.optString("accent", ""), "#7DD3FC");

        float density = clamp((float)p.optDouble("density", 0.48), 0.12f, 1f);
        float motion = clamp((float)p.optDouble("motion", 0.42), 0.05f, 1f);
        float scale = clamp((float)p.optDouble("scale", 0.62), 0.25f, 1f);
        float depth = clamp((float)p.optDouble("depth", 0.62), 0.15f, 1f);
        float particleLevel = clamp((float)p.optDouble("particleLevel", 0.55), 0f, 1f);
        float pulseStrength = clamp((float)p.optDouble("pulseStrength", 0.62), 0f, 1f);
        float contrastLevel = clamp((float)p.optDouble("contrastLevel", 0.68), 0.15f, 1f);

        return new WorldPlan(theme, motif, mood, tap, evolution, layout, cameraMotion,
                composition, environment, materialStyle, primary, secondary, accent,
                density, motion, scale, depth, particleLevel, pulseStrength, contrastLevel);
    }

    JSONObject toJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("theme", theme);
            o.put("motif", motif);
            o.put("mood", mood);
            o.put("tapReaction", tapReaction);
            o.put("evolution", evolution);
            o.put("layout", layout);
            o.put("cameraMotion", cameraMotion);
            o.put("composition", composition);
            o.put("environment", environment);
            o.put("materialStyle", materialStyle);
            o.put("density", density);
            o.put("motion", motion);
            o.put("scale", scale);
            o.put("depth", depth);
            o.put("particleLevel", particleLevel);
            o.put("pulseStrength", pulseStrength);
            o.put("contrastLevel", contrastLevel);
            o.put("palette", new JSONObject()
                    .put("primary", primary)
                    .put("secondary", secondary)
                    .put("accent", accent));
        } catch (Exception ignored) {}
        return o;
    }

    private static String defaultEnvironment(String theme) {
        if ("GARDEN".equals(theme)) return "POLLEN";
        if ("ABYSS".equals(theme)) return "BUBBLES";
        if ("LAVA".equals(theme)) return "ASH";
        if ("CIRCUIT".equals(theme)) return "GLITCH";
        if ("INK".equals(theme)) return "SMOKE";
        if ("ICE".equals(theme)) return "FOG";
        return "STARDUST";
    }

    private static String defaultMaterialStyle(String theme) {
        if ("GARDEN".equals(theme) || "ABYSS".equals(theme)) return "BIO";
        if ("CIRCUIT".equals(theme)) return "METAL";
        if ("ICE".equals(theme)) return "CRYSTAL";
        if ("INK".equals(theme)) return "INK";
        if ("DREAM".equals(theme)) return "GLASS";
        return "ENERGY";
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
