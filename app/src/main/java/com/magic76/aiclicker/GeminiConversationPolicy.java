package com.magic76.aiclicker;

import org.json.JSONObject;

/** English-only performance policy for the existing Gemini Live session. */
public final class GeminiConversationPolicy {
    public static final String MODE_SILENT = "SILENT";
    public static final String MODE_BANTER = "BANTER";
    public static final String MODE_GAME_TURN = "GAME_TURN";

    private GeminiConversationPolicy() {}

    public static String systemPromptAppendix() {
        return "You are the voice of a mischievous infinite game, not an assistant. English only. "
                + "Your performance must have contrast. Sometimes whisper, sometimes snap, challenge, fake calm, deadpan, or burst with excitement. "
                + "Most lines are 2 to 10 words. Use timing, interruption, suspense, and punchlines instead of explanations. "
                + "Do not narrate obvious UI changes. Do not say bland assistant phrases such as 'great job', 'okay', 'let us continue', or 'I am here to help'. "
                + "React to the player's actual behavior: rushing, hesitating, holding, releasing early, waiting, ignoring warnings, or falling for a trick. "
                + "A charged pause, a one-word whisper, a countdown, or a fake reassurance can be better than a full sentence. "
                + "Never insult the player and never become hostile. The goal is playful tension, surprise, and comedy. "
                + "For BANTER turns: speak only and do not call tools. "
                + "For GAME_TURN turns: speak one punchy setup or punchline, then call apply_world_experience exactly once. "
                + "SILENT turns are not sent to you. Avoid repeating recent wording or delivery style.";
    }

    /** Build the text part sent through the already-open Live clientContent turn. */
    public static String buildTurnText(String mode, JSONObject compactContext) {
        String safeMode = MODE_GAME_TURN.equals(mode) ? MODE_GAME_TURN : MODE_BANTER;
        String delivery = compactContext == null ? "TEASE" : compactContext.optString("delivery", "TEASE");
        String instruction;
        if (MODE_GAME_TURN.equals(safeMode)) {
            instruction = "English only. Perform one short dramatic setup line, then call apply_world_experience exactly once. "
                    + "Do not describe the effect. DELIVERY=" + delivery + ".";
        } else {
            instruction = "English only. SPEAK ONLY. Do not call any function/tool and do not change the UI. "
                    + "Give one short performed reaction, dare, tease, prediction, whisper, or punchline. "
                    + "Do not narrate the screen. DELIVERY=" + delivery + ".";
        }
        return "GAME_EVENT\nMODE=" + safeMode + "\n" + instruction
                + "\nCONTEXT=" + (compactContext == null ? "{}" : compactContext.toString());
    }

    /** Signature moments already know their dramatic beat. Reuse the same Live session. */
    public static String buildSignatureBanter(String moment, String phase, String delivery,
                                              String fallback, JSONObject compactContext) {
        return "SIGNATURE_BANTER\nEnglish only. SPEAK ONLY; never call a tool. "
                + "Moment=" + safe(moment) + ", phase=" + safe(phase) + ", DELIVERY=" + safe(delivery) + ". "
                + "Use the fallback only as intent, not as a script. Make it punchier and natural. "
                + "Fallback intent: " + safe(fallback)
                + "\nCONTEXT=" + (compactContext == null ? "{}" : compactContext.toString());
    }

    private static String safe(String value) {
        return value == null ? "" : value.replace('\n', ' ').replace('\r', ' ').trim();
    }
}
