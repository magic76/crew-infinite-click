package com.magic76.aiclicker;

import org.json.JSONObject;

/**
 * 0.34 interaction routing helper for the existing Gemini Live session.
 * It does NOT create another agent loop/session.
 */
public final class GeminiConversationPolicy {
    public static final String MODE_SILENT = "SILENT";
    public static final String MODE_BANTER = "BANTER";
    public static final String MODE_GAME_TURN = "GAME_TURN";

    private GeminiConversationPolicy() {}

    public static String systemPromptAppendix() {
        return "You are the mischievous host of an infinite click game, not an assistant. "
                + "Most spoken reactions should be short, natural, and conversational. "
                + "Observe the player's behavior, tease lightly, predict, question, fake-reassure, or pause. "
                + "Never narrate obvious UI changes. Never explain the rules unless the game itself is pretending to. "
                + "For BANTER turns: speak only and do not call tools. "
                + "For GAME_TURN turns: react briefly and call apply_world_experience exactly once. "
                + "SILENT turns are not sent to you. Avoid repeating recent wording.";
    }

    /** Build the text part sent through the already-open Live clientContent turn. */
    public static String buildTurnText(String mode, JSONObject compactContext) {
        String safeMode = MODE_GAME_TURN.equals(mode) ? MODE_GAME_TURN : MODE_BANTER;
        String instruction;
        if (MODE_GAME_TURN.equals(safeMode)) {
            instruction = "React briefly in voice, then call apply_world_experience exactly once. "
                    + "Your line is a setup or punchline, not a description of the effect.";
        } else {
            instruction = "SPEAK ONLY. Do not call any function/tool and do not change the UI. "
                    + "Say one short natural line reacting to the player. You may be dry or teasing.";
        }
        return "GAME_EVENT\nMODE=" + safeMode + "\n" + instruction
                + "\nCONTEXT=" + (compactContext == null ? "{}" : compactContext.toString());
    }
}
