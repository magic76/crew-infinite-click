package com.magic76.aiclicker;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

/** Offline director: proves the experience without Gemini or an API key. */
final class LocalDirector {
    private boolean englishMode;

    JSONObject respond(GameEvent event, JSONObject context) {
        englishMode = context != null && context.optString("language", "zh-TW").toLowerCase(Locale.ROOT).startsWith("en");
        int taps = context == null ? 0 : context.optInt("runClicks", 0);
        JSONObject speed = context == null ? null : context.optJSONObject("clickSpeed");
        JSONObject pattern = context == null ? null : context.optJSONObject("tapPattern");
        double cps = speed == null ? 0 : speed.optDouble("cps", 0);
        double jitter = pattern == null ? 999 : pattern.optDouble("intervalJitterMs", 999);
        String eventType = event == null ? "" : event.type;
        int phase = Math.max(0, ((Math.max(1, taps) - 1) / 4) % 8);

        String[] intents = {"TEASE","ESCAPE","SWARM","GLITCH","REVEAL","ABSORB","FRACTURE","CELEBRATE"};
        String[] moods = {"CURIOUS","PLAYFUL","PLAYFUL","CHAOTIC","EERIE","EERIE","CHAOTIC","TRIUMPHANT"};
        String[][] colors = {
                {"#070A14","#111A33","#65F6FF"}, {"#0B0715","#281343","#F472FF"},
                {"#061217","#0B3340","#67E8F9"}, {"#06070D","#17192A","#22D3EE"},
                {"#100815","#2A173A","#F9A8D4"}, {"#03050A","#0C1322","#8B5CF6"},
                {"#120707","#351111","#FB7185"}, {"#07130B","#12331E","#86EFAC"}
        };
        double energy = Math.min(1.0, 0.42 + phase * 0.055 + Math.min(.18, cps * .03));
        double tempo = Math.min(1.0, 0.40 + Math.min(.38, cps * .06));
        JSONObject scene = new JSONObject();
        try {
            scene.put("intent", intents[phase]); scene.put("mood", moods[phase]);
            scene.put("primary", colors[phase][0]); scene.put("secondary", colors[phase][1]); scene.put("accent", colors[phase][2]);
            scene.put("energy", energy); scene.put("tempo", tempo);
            if (event != null && "world_tap".equals(event.type)) { scene.put("focusX", event.x); scene.put("focusY", event.y); }
            else { scene.put("focusX", 0.5); scene.put("focusY", 0.52); }
        } catch (Exception ignored) {}

        JSONObject interaction = new JSONObject();
        try {
            String mode = "NONE";
            String label = "";
            double targetX = event != null ? event.x : 0.5;
            double targetY = event != null ? event.y : 0.52;
            long duration = 1700L;
            if ("world_tap".equals(eventType) && taps > 0 && taps % 4 == 0) {
                switch (phase) {
                    case 0: mode = "TEASE"; label = englishMode ? "AGAIN?" : "再來？"; break;
                    case 1: mode = "CHASE"; label = englishMode ? "CATCH ME" : "抓得到嗎"; targetX = 1.0 - event.x; targetY = 1.0 - event.y; break;
                    case 2: mode = "DECOY"; label = englishMode ? "WHICH ONE?" : "哪一個？"; break;
                    case 3: mode = jitter < 150 ? "RHYTHM" : "MIRROR"; label = englishMode ? "I HEAR THAT" : "我聽到節奏了"; duration = 2200L; break;
                    case 4: mode = "PREDICT"; label = englishMode ? "NEXT: HERE" : "你下一次會按這"; targetX = clamp(event.x * .65 + .18, .12, .88); targetY = clamp(event.y * .65 + .18, .16, .84); break;
                    case 5: mode = "WAIT"; label = englishMode ? "DON'T TAP" : "先別按"; duration = 2600L; break;
                    case 6: mode = "HIDE"; label = englishMode ? "FIND ME" : "找到我"; duration = 2600L; break;
                    case 7: mode = "REWARD"; label = englishMode ? "OK, YOU WIN" : "好，你贏了"; break;
                    default: break;
                }
            }
            interaction.put("mode", mode).put("label", label).put("targetX", targetX).put("targetY", targetY)
                    .put("strength", Math.min(1.0, .5 + phase * .06)).put("durationMs", duration);
        } catch (Exception ignored) {}

        JSONArray actions = new JSONArray();
        if (event != null && "world_tap".equals(event.type)) {
            if (taps % 4 == 0) {
                actions.put(vfx(actionForPhase(phase), event.x, event.y, Math.min(1.0, .48 + phase * .06)));
                actions.put(sound(soundForPhase(phase), Math.min(1.0, .5 + phase * .05)));
            } else if (cps > 4.5 && taps % 5 == 0) {
                actions.put(vfx("particle_burst", event.x, event.y, .9));
            }
        }

        String zh = "", en = "";
        if ("start".equals(eventType)) { zh = "按一下看看。"; en = "Try one tap."; }
        else if (taps == 8) { zh = "它開始躲你了。"; en = "It's starting to dodge you."; }
        else if (taps == 16) { zh = "好，現在畫面不太可信。"; en = "Okay. The screen is lying now."; }
        else if (taps == 24) { zh = "你還真的沒停。"; en = "You really didn't stop."; }

        JSONObject out = new JSONObject();
        try {
            out.put("speech", englishMode ? en : zh);
            out.put("scenePlan", scene);
            out.put("interaction", interaction);
            out.put("actions", actions);
        } catch (Exception ignored) {}
        return out;
    }

    private String actionForPhase(int p) {
        switch (p) {
            case 1: return "shockwave";
            case 2: return "swarm";
            case 3: return "glitch";
            case 4: return "portal";
            case 5: return "black_hole";
            case 6: return "world_crack";
            case 7: return "particle_burst";
            default: return "particle_burst";
        }
    }

    private String soundForPhase(int p) {
        switch (p) {
            case 1: return "WHOOSH";
            case 2: return "MYSTERY";
            case 3: return "GLITCH";
            case 4: return "PORTAL";
            case 5: return "ABSORB";
            case 6: return "CRACK";
            case 7: return "SUCCESS";
            default: return "REVEAL";
        }
    }

    private JSONObject vfx(String type, float x, float y, double strength) {
        JSONObject o = new JSONObject();
        try { o.put("type", type); o.put("x", x); o.put("y", y); o.put("strength", strength); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject sound(String cue, double strength) {
        JSONObject o = new JSONObject();
        try { o.put("type", "sound"); o.put("cue", cue); o.put("strength", strength); } catch (Exception ignored) {}
        return o;
    }

    private static double clamp(double v, double min, double max) { return Math.max(min, Math.min(max, v)); }
}
