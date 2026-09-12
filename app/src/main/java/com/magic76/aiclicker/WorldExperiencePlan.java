package com.magic76.aiclicker;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** Sanitized high-level experience plan for 0.33. */
public final class WorldExperiencePlan {
    public static final Set<String> WORLDS = new HashSet<>(Arrays.asList(
            "SPRING_BLOOM", "SUMMER_STORM", "AUTUMN_DECAY",
            "WINTER_FROST", "VOID_CHAMBER", "NEON_RIFT"));
    public static final Set<String> MOODS = new HashSet<>(Arrays.asList(
            "PLAYFUL", "EERIE", "CALM", "CHAOTIC"));
    public static final Set<String> SITUATIONS = new HashSet<>(Arrays.asList(
            "CHASE", "DECOY", "WAIT", "PREDICT", "MIRROR", "HIDE", "REVEAL", "FAKE_ENDING"));
    public static final Set<String> AUDIO_MOODS = new HashSet<>(Arrays.asList(
            "ORGANIC", "STORM", "DRY", "GLASS", "COSMIC", "GLITCH"));
    public static final Set<String> TARGET_BEHAVIORS = new HashSet<>(Arrays.asList(
            "STILL", "ESCAPE", "SPLIT", "PULSE", "HIDE"));
    public static final Set<String> RULE_TWISTS = new HashSet<>(Arrays.asList(
            "NONE", "WAIT_TO_WIN", "TAP_THE_SHADOW", "FOLLOW_THE_SOUND",
            "DONT_TOUCH_CENTER", "LEFT_RIGHT_REVERSED"));
    public static final Set<String> VISUAL_EFFECTS = new HashSet<>(Arrays.asList(
            "AUTO", "PETAL_BLOOM", "STORM_FLASH", "RAIN_BURST", "LEAF_FALL",
            "DUST_DISSOLVE", "FREEZE_CRACK", "FROST_PULSE", "VOID_SUCTION",
            "GRAVITY_WELL", "BLACKOUT_REVEAL", "GLITCH_BARS", "NEON_SLICE",
            "PIXEL_SCATTER", "MIRROR_SPLIT", "SHOCKWAVE", "ECHO_RINGS",
            "SPOTLIGHT", "SOFT_FADE"));
    public static final Set<String> HAPTIC_CUES = new HashSet<>(Arrays.asList(
            "AUTO", "NONE", "SOFT_TAP", "CORRECT", "WRONG", "WARNING", "ICE_TICK",
            "DRY_DOUBLE", "DIGITAL_TRIPLE", "THUNDER", "VOID_PULL", "HEARTBEAT", "IMPACT"));

    public final String world;
    public final String mood;
    public final String situation;
    public final String audioMood;
    public final String targetBehavior;
    public final String ruleTwist;
    public final String speech;
    public final double intensity;
    public final double surpriseLevel;
    /** -1 means Runtime chooses; 0..3 means CALM/LIGHT/ACTIVE/IMPACT request. */
    public final int sensoryDensity;
    public final String visualEffect;
    public final String hapticCue;
    public final JSONArray actions;

    private WorldExperiencePlan(
            String world, String mood, String situation, String audioMood,
            String targetBehavior, String ruleTwist, String speech,
            double intensity, double surpriseLevel, int sensoryDensity,
            String visualEffect, String hapticCue, JSONArray actions) {
        this.world = world;
        this.mood = mood;
        this.situation = situation;
        this.audioMood = audioMood;
        this.targetBehavior = targetBehavior;
        this.ruleTwist = ruleTwist;
        this.speech = speech;
        this.intensity = intensity;
        this.surpriseLevel = surpriseLevel;
        this.sensoryDensity = sensoryDensity;
        this.visualEffect = visualEffect;
        this.hapticCue = hapticCue;
        this.actions = actions;
    }

    public static WorldExperiencePlan fromArgs(JSONObject args) {
        if (args == null) args = new JSONObject();
        String world = enumValue(args.optString("world"), WORLDS, "NEON_RIFT");
        String mood = enumValue(args.optString("mood"), MOODS, "PLAYFUL");
        String situation = enumValue(args.optString("situation"), SITUATIONS, "CHASE");
        String audioMood = enumValue(args.optString("audioMood"), AUDIO_MOODS, defaultAudio(world));
        String targetBehavior = enumValue(args.optString("targetBehavior"), TARGET_BEHAVIORS, "PULSE");
        String ruleTwist = enumValue(args.optString("ruleTwist"), RULE_TWISTS, "NONE");
        String visualEffect = enumValue(args.optString("visualEffect"), VISUAL_EFFECTS, "AUTO");
        String hapticCue = enumValue(args.optString("hapticCue"), HAPTIC_CUES, "AUTO");

        String speech = args.optString("speech", "");
        if (speech.length() > 140) speech = speech.substring(0, 140);
        double intensity = clamp(args.optDouble("intensity", 0.45), 0.0, 1.0);
        double surpriseLevel = clamp(args.optDouble("surpriseLevel", 0.35), 0.0, 1.0);
        int sensoryDensity = args.has("sensoryDensity") ? Math.max(0, Math.min(3, args.optInt("sensoryDensity", 1))) : -1;

        JSONArray actions = args.optJSONArray("actions");
        if (actions == null) actions = new JSONArray();
        if (actions.length() > 8) {
            JSONArray trimmed = new JSONArray();
            for (int i = 0; i < 8; i++) trimmed.put(actions.opt(i));
            actions = trimmed;
        }
        return new WorldExperiencePlan(world, mood, situation, audioMood, targetBehavior,
                ruleTwist, speech, intensity, surpriseLevel, sensoryDensity, visualEffect, hapticCue, actions);
    }

    public JSONObject toJson() {
        JSONObject out = new JSONObject();
        try {
            out.put("world", world);
            out.put("mood", mood);
            out.put("situation", situation);
            out.put("audioMood", audioMood);
            out.put("targetBehavior", targetBehavior);
            out.put("ruleTwist", ruleTwist);
            out.put("speech", speech);
            out.put("intensity", intensity);
            out.put("surpriseLevel", surpriseLevel);
            if (sensoryDensity >= 0) out.put("sensoryDensity", sensoryDensity);
            out.put("visualEffect", visualEffect);
            out.put("hapticCue", hapticCue);
            out.put("actions", actions);
        } catch (Exception ignored) {}
        return out;
    }

    private static String enumValue(String raw, Set<String> allowed, String fallback) {
        if (raw == null) return fallback;
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return allowed.contains(normalized) ? normalized : fallback;
    }

    private static String defaultAudio(String world) {
        switch (world) {
            case "SPRING_BLOOM": return "ORGANIC";
            case "SUMMER_STORM": return "STORM";
            case "AUTUMN_DECAY": return "DRY";
            case "WINTER_FROST": return "GLASS";
            case "VOID_CHAMBER": return "COSMIC";
            default: return "GLITCH";
        }
    }

    private static double clamp(double value, double min, double max) {
        if (Double.isNaN(value) || Double.isInfinite(value)) return min;
        return Math.max(min, Math.min(max, value));
    }
}
