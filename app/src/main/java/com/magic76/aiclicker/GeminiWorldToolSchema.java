package com.magic76.aiclicker;

import org.json.JSONArray;
import org.json.JSONObject;

/** Function declaration + raw WebSocket tool-response helper for Gemini Live. */
public final class GeminiWorldToolSchema {
    public static final String FUNCTION_NAME = "apply_world_experience";
    private GeminiWorldToolSchema() {}

    public static JSONObject declaration() {
        JSONObject properties = new JSONObject();
        try {
            properties.put("world", enumString("Visual/gameplay world for the current run segment.",
                    "SPRING_BLOOM", "SUMMER_STORM", "AUTUMN_DECAY", "WINTER_FROST", "VOID_CHAMBER", "NEON_RIFT"));
            properties.put("mood", enumString("Emotional tone. Keep it playful rather than hostile.",
                    "PLAYFUL", "EERIE", "CALM", "CHAOTIC"));
            properties.put("situation", enumString("Gameplay situation for roughly the next 10-30 seconds.",
                    "CHASE", "DECOY", "WAIT", "PREDICT", "MIRROR", "HIDE", "REVEAL", "FAKE_ENDING"));
            properties.put("audioMood", enumString("Sound palette matching the world.",
                    "ORGANIC", "STORM", "DRY", "GLASS", "COSMIC", "GLITCH"));
            properties.put("targetBehavior", enumString("Primary target motion/visibility behavior.",
                    "STILL", "ESCAPE", "SPLIT", "PULSE", "HIDE"));
            properties.put("ruleTwist", enumString("Optional temporary rule. Prefer NONE most of the time.",
                    "NONE", "WAIT_TO_WIN", "TAP_THE_SHADOW", "FOLLOW_THE_SOUND", "DONT_TOUCH_CENTER", "LEFT_RIGHT_REVERSED"));
            properties.put("speech", new JSONObject().put("type", "STRING")
                    .put("description", "One short teasing line, max 140 characters. Never insult the player."));
            properties.put("intensity", new JSONObject().put("type", "NUMBER").put("minimum", 0).put("maximum", 1));
            properties.put("surpriseLevel", new JSONObject().put("type", "NUMBER").put("minimum", 0).put("maximum", 1));

            // These are requests only. SensoryDirector is authoritative and may downgrade them.
            properties.put("sensoryDensity", new JSONObject().put("type", "NUMBER").put("minimum", 0).put("maximum", 3)
                    .put("description", "Requested density: 0 CALM, 1 LIGHT, 2 ACTIVE, 3 IMPACT. Use 0/1 often; 3 rarely."));
            properties.put("visualEffect", enumString("Optional world-appropriate effect. Prefer AUTO when unsure.",
                    "AUTO", "PETAL_BLOOM", "STORM_FLASH", "RAIN_BURST", "LEAF_FALL", "DUST_DISSOLVE",
                    "FREEZE_CRACK", "FROST_PULSE", "VOID_SUCTION", "GRAVITY_WELL", "BLACKOUT_REVEAL",
                    "GLITCH_BARS", "NEON_SLICE", "PIXEL_SCATTER", "MIRROR_SPLIT", "SHOCKWAVE",
                    "ECHO_RINGS", "SPOTLIGHT", "SOFT_FADE"));
            properties.put("hapticCue", enumString("Optional tactile suggestion. Prefer AUTO/NONE; Runtime controls frequency.",
                    "AUTO", "NONE", "SOFT_TAP", "CORRECT", "WRONG", "WARNING", "ICE_TICK", "DRY_DOUBLE",
                    "DIGITAL_TRIPLE", "THUNDER", "VOID_PULL", "HEARTBEAT", "IMPACT"));

            JSONObject actionItem = new JSONObject().put("type", "OBJECT")
                    .put("properties", new JSONObject()
                            .put("type", new JSONObject().put("type", "STRING"))
                            .put("targetId", new JSONObject().put("type", "STRING"))
                            .put("id", new JSONObject().put("type", "STRING"))
                            .put("text", new JSONObject().put("type", "STRING"))
                            .put("x", new JSONObject().put("type", "NUMBER"))
                            .put("y", new JSONObject().put("type", "NUMBER"))
                            .put("width", new JSONObject().put("type", "NUMBER"))
                            .put("height", new JSONObject().put("type", "NUMBER"))
                            .put("value", new JSONObject().put("type", "NUMBER"))
                            .put("durationMs", new JSONObject().put("type", "NUMBER"))
                            .put("style", new JSONObject().put("type", "OBJECT")));
            properties.put("actions", new JSONObject().put("type", "ARRAY").put("maxItems", 8).put("items", actionItem)
                    .put("description", "Small incremental UI changes only. Existing Game Runtime validates them."));
        } catch (Exception ignored) {}

        JSONObject params = new JSONObject();
        try {
            params.put("type", "OBJECT");
            params.put("properties", properties);
            params.put("required", new JSONArray().put("world").put("mood").put("situation")
                    .put("audioMood").put("targetBehavior").put("speech").put("intensity").put("surpriseLevel"));
        } catch (Exception ignored) {}

        JSONObject declaration = new JSONObject();
        try {
            declaration.put("name", FUNCTION_NAME);
            declaration.put("description", "Choose the next high-level world experience and a few validated UI actions. "
                    + "Sensory contrast is essential: calm and sparse moments make rare impacts feel stronger.");
            declaration.put("parameters", params);
        } catch (Exception ignored) {}
        return declaration;
    }

    public static String buildToolResponse(String callId, JSONObject result) {
        JSONObject functionResponse = new JSONObject();
        JSONObject root = new JSONObject();
        try {
            functionResponse.put("name", FUNCTION_NAME);
            if (callId != null && !callId.isEmpty()) functionResponse.put("id", callId);
            functionResponse.put("response", new JSONObject().put("result",
                    result == null ? new JSONObject().put("ok", true) : result));
            root.put("toolResponse", new JSONObject().put("functionResponses", new JSONArray().put(functionResponse)));
        } catch (Exception ignored) {}
        return root.toString();
    }

    private static JSONObject enumString(String description, String... values) {
        JSONObject out = new JSONObject();
        try {
            out.put("type", "STRING");
            out.put("description", description);
            JSONArray allowed = new JSONArray();
            for (String value : values) allowed.put(value);
            out.put("enum", allowed);
        } catch (Exception ignored) {}
        return out;
    }
}
