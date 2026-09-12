package com.magic76.aiclicker;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

/**
 * Deterministic offline director used only when no Gemini key is configured or the Live socket is down.
 * It exercises the exact same validated action runtime as Gemini, which makes the APK testable without secrets.
 */
final class LocalDirector {
    private boolean englishMode = false;

    JSONObject respond(GameEvent event, JSONObject context) {
        englishMode = context != null &&
                context.optString("language", "zh-TW").toLowerCase(Locale.ROOT).startsWith("en");

        int taps = context == null ? 0 : context.optInt("runClicks", 0);
        JSONObject speed = context == null ? null : context.optJSONObject("clickSpeed");
        double cps = speed == null ? 0.0 : speed.optDouble("cps", 0.0);
        String trend = speed == null ? "STEADY" : speed.optString("trend", "STEADY");
        String eventType = event == null ? "" : event.type;

        int stage = (taps / 6) % 8;
        if ("world_tick".equals(eventType)) stage = (stage + 1) % 8;

        JSONObject plan;
        switch (stage) {
            case 0:
                plan = world("COSMIC","ORBS","CURIOUS","BLOOM","DRIFT",
                        "#070B1A","#172554","#7DD3FC",0.46,0.38,0.62);
                break;
            case 1:
                plan = world("COSMIC","EYES","PLAYFUL","ATTRACT","BREATHE",
                        "#080B18","#24153E","#A78BFA",0.50,0.42,0.58);
                break;
            case 2:
                plan = world("ABYSS","JELLYFISH","EERIE","RIPPLE","FLOW",
                        "#020817","#052F3C","#67E8F9",0.54,0.34,0.68);
                break;
            case 3:
                plan = world("GARDEN","VINES","CURIOUS","BLOOM","GROW",
                        "#07150D","#123524","#86EFAC",0.58,0.30,0.64);
                break;
            case 4:
                plan = world("CIRCUIT","GLYPHS","PLAYFUL","MULTIPLY","PULSE",
                        "#050914","#101B35","#22D3EE",0.64,0.55,0.54);
                break;
            case 5:
                plan = world("DREAM","PORTALS","CURIOUS","WARP","ORBIT",
                        "#110A1D","#2B1550","#F0ABFC",0.48,0.46,0.72);
                break;
            case 6:
                plan = world("ICE","SHARDS","CALM","REPEL","DRIFT",
                        "#06121C","#17334A","#BAE6FD",0.50,0.28,0.66);
                break;
            default:
                plan = world("INK","EYES","EERIE","CRACK","BREATHE",
                        "#050505","#171717","#F5F5F5",0.42,0.24,0.62);
                break;
        }

        try {
            String[] layouts = {"FIELD","GATE","TUNNEL","FIELD","SHARD_STORM","VORTEX","TUNNEL","GATE"};
            String[] cameras = {"DRIFT","FLOAT","FORWARD","DRIFT","ORBIT","ORBIT","FORWARD","FLOAT"};
            double[] depths = {0.55,0.68,0.86,0.48,0.78,0.92,0.84,0.72};
            plan.put("layout", layouts[Math.max(0, Math.min(layouts.length - 1, stage))]);
            plan.put("cameraMotion", cameras[Math.max(0, Math.min(cameras.length - 1, stage))]);
            plan.put("depth", depths[Math.max(0, Math.min(depths.length - 1, stage))]);
        } catch (Exception ignored) {}

        if (cps >= 3.5 || "ACCELERATING".equals(trend)) {
            try {
                plan.put("mood", "CHAOTIC");
                plan.put("motion", Math.min(1.0, plan.optDouble("motion", 0.4) + 0.28));
                plan.put("density", Math.min(1.0, plan.optDouble("density", 0.5) + 0.18));
                plan.put("tapReaction", "MULTIPLY");
                plan.put("layout", "VORTEX");
                plan.put("cameraMotion", "ORBIT");
                plan.put("depth", 0.94);
            } catch (Exception ignored) {}
        }

        String zh = "";
        String en = "";
        if ("start".equals(eventType)) {
            zh = "摸摸看。";
            en = "Touch it.";
        } else if ("ACCELERATING".equals(trend) && taps % 7 == 0) {
            zh = "它開始跟著你變快了。";
            en = "It's starting to keep up with you.";
        } else if ("world_tick".equals(eventType) && taps > 0 && taps % 12 < 4) {
            zh = "你停下來，它也沒停。";
            en = "You stopped. It didn't.";
        }

        return worldTurn(zh, en, plan);
    }

    private JSONObject worldTurn(String zh, String en, JSONObject plan) {
        JSONObject o = new JSONObject();
        try {
            o.put("speech", englishMode ? en : zh);
            o.put("worldPlan", plan);
            o.put("actions", new JSONArray());
        } catch (Exception ignored) {}
        return o;
    }

    private JSONObject world(String theme, String motif, String mood, String tapReaction, String evolution,
                             String primary, String secondary, String accent,
                             double density, double motion, double scale) {
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

    private JSONObject onTimeout(String timerId, int clicks) {
        return turn("繼續按。", arr(
                move("main_button", 0.50, 0.58),
                flash("#FFFFFF", 60)
        ));
    }

    private JSONObject turn(String speech, JSONArray actions) {
        JSONObject o = new JSONObject();
        try { o.put("speech", localize(speech)); o.put("actions", actions); } catch (Exception ignored) {}
        return o;
    }

    private JSONArray arr(JSONObject... items) {
        JSONArray a = new JSONArray();
        if (items != null) for (JSONObject item : items) if (item != null) a.put(item);
        return a;
    }

    private JSONObject action(String type) {
        JSONObject o = new JSONObject();
        try { o.put("type", type); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject text(String target, String value) {
        JSONObject o = action("changeText");
        try { o.put("targetId", target); o.put("text", localize(value)); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject move(String target, double x, double y) {
        JSONObject o = action("moveElement");
        try { o.put("targetId", target); o.put("x", x); o.put("y", y); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject resize(String target, double w, double h) {
        JSONObject o = action("resizeElement");
        try { o.put("targetId", target); o.put("width", w); o.put("height", h); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject rotate(String target, double rotation) {
        JSONObject o = action("rotateElement");
        try { o.put("targetId", target); o.put("rotation", rotation); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject duplicate(String target, String id, double x, double y, String label) {
        JSONObject o = action("duplicateElement");
        try {
            o.put("targetId", target); o.put("id", id); o.put("x", x); o.put("y", y); o.put("text", localize(label));
            o.put("role", "bonus");
        } catch (Exception ignored) {}
        return o;
    }

    private JSONObject createButton(String id, String label, double x, double y, String background) {
        JSONObject o = action("createButton");
        try {
            o.put("id", id); o.put("text", localize(label)); o.put("x", x); o.put("y", y);
            JSONObject style = new JSONObject(); style.put("background", background); style.put("color", contrast(background));
            o.put("style", style);
        } catch (Exception ignored) {}
        return o;
    }

    private JSONObject createDecoyButton(String id, String label, double x, double y, String background) {
        JSONObject o = createButton(id, label, x, y, background);
        try { o.put("role", "decoy"); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject createText(String id, String label, double x, double y) {
        JSONObject o = action("createText");
        try { o.put("id", id); o.put("text", localize(label)); o.put("x", x); o.put("y", y); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject addScore(int value) {
        JSONObject o = action("addScore");
        try { o.put("value", value); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject timer(String id, long ms) {
        JSONObject o = action("startTimer");
        try { o.put("timerId", id); o.put("durationMs", ms); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject stopTimer(String id) {
        JSONObject o = action("stopTimer");
        try { o.put("timerId", id); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject shake(double intensity, long ms) {
        JSONObject o = action("shakeScreen");
        try { o.put("intensity", intensity); o.put("durationMs", ms); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject flash(String color, long ms) {
        JSONObject o = action("flashScreen");
        try { o.put("color", color); o.put("durationMs", ms); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject clear() { return action("clearScreen"); }

    private JSONObject endGame(String reason) {
        JSONObject o = action("endGame");
        try { o.put("reason", reason); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject setRule(String type, String value, String label, long durationMs) {
        JSONObject o = action("setRule");
        try {
            o.put("ruleType", type);
            o.put("ruleValue", value);
            o.put("label", localize(label));
            o.put("durationMs", durationMs);
        } catch (Exception ignored) {}
        return o;
    }

    private JSONObject twist(String value) {
        JSONObject o = action("triggerTwist");
        try { o.put("twist", value); } catch (Exception ignored) {}
        return o;
    }

    private String localize(String value) {
        if (!englishMode || value == null) return value;
        switch (value) {
            case "不要按。真的。": return "Don't press it. Seriously.";
            case "我不是叫你不要按嗎？": return "I told you not to press it.";
            case "再按一次看看": return "Press it again";
            case "好，抓得到我嗎？": return "Fine. Catch me.";
            case "抓我啊": return "Catch me";
            case "差一點。": return "Almost.";
            case "哪一顆才是真的？": return "Which one is real?";
            case "按我": return "Tap me";
            case "真的？": return "Real?";
            case "你選了這顆。記住喔。": return "You picked that one. Remember it.";
            case "三秒。只有紅色能按。": return "Three seconds. Red only.";
            case "RULE：只有紅色能按": return "RULE: RED ONLY";
            case "紅色": return "RED";
            case "紅色？": return "RED?";
            case "只有紅色能按": return "RED ONLY";
            case "嗯，你比我想的快。": return "You're faster than I expected.";
            case "規則反過來。現在別按紅色。": return "Rule reversed. Avoid red.";
            case "剛才的規則，反過來。": return "Reverse the last rule.";
            case "綠色": return "GREEN";
            case "不要按紅色": return "AVOID RED";
            case "看吧，我就知道。或者我根本不知道。": return "See? I knew it. Maybe.";
            case "好啦，恭喜你。遊戲結束。": return "Fine. Congratulations. Game over.";
            case "你真的相信那是 Exit？": return "You believed that was Exit?";
            case "還沒結束。": return "Not finished.";
            case "繼續": return "KEEP GOING";
            case "別停，繼續。": return "Don't stop. Keep going.";
            case "現在它變長了。這沒有任何幫助。": return "Now it's longer. Completely useless.";
            case "毫無意義的按鈕": return "Useless button";
            case "再來一個小陷阱。": return "One tiny trap.";
            case "不要按我": return "Don't tap me";
            case "按這個": return "Tap this";
            case "你還在玩。這點我服。": return "You're still here. Respect.";
            case "重置一下規則。": return "Resetting the rules.";
            case "新的規則：看起來可疑的才是真的": return "New rule: suspicious is real";
            case "看起來很正常": return "Looks normal";
            case "又來？": return "Again?";
            case "再一次": return "Again";
            case "時間到。你讓一個按鈕贏了。": return "Time's up. A button beat you.";
            case "按鈕 1 : 你 0": return "BUTTON 1 : YOU 0";
            case "時間到。": return "Time's up.";
            case "按一下看看。": return "Tap once.";
            case "按哪裡都行": return "TAP ANYWHERE";
            case "你是想把畫面按壞嗎？": return "Are you trying to break the screen?";
            case "欸，你越按越快了。": return "Hey, you're getting faster.";
            case "別停，下一下會不一樣。": return "Keep going. The next tap changes.";
            case "喔。": return "Oh.";
            case "再一下": return "ONE MORE";
            case "你真的會繼續。": return "You really kept going.";
            case "好，那我躲一下。": return "Fine. I'll move.";
            case "一顆不夠是不是？": return "One wasn't enough?";
            case "這速度有點離譜。": return "That speed is ridiculous.";
            case "繼續。": return "Keep going.";
            case "你每按一下，我就改一次。": return "Every tap changes me.";
            case "現在連空白都算。": return "Even empty space counts now.";
            case "按哪裡都會有反應": return "TAP ANYWHERE";
            case "又來。": return "Again.";
            case "我快跟不上你了。": return "I can't keep up.";
            case "還在按？很好。": return "Still tapping? Good.";
            case "那就全部一起動。": return "Fine. Everything moves.";
            case "下一下我也不知道會怎樣。": return "I don't know what the next tap does either.";
            case "再一下。": return "One more.";
            case "繼續按。": return "Keep tapping.";
            case "你是想把它按壞嗎？": return "Are you trying to break it?";
            case "等等，你越按越快了。": return "Okay, you're getting faster.";
            case "別想了，繼續按。": return "Don't think. Keep tapping.";
            case "時間到。再按一次。": return "Time's up. Tap again.";
            case "繼續按": return "KEEP TAPPING";
            default: return value;
        }
    }

    private String contrast(String hex) {
        if (hex == null) return "#FFFFFF";
        String h = hex.replace("#", "").toUpperCase(Locale.ROOT);
        if ("ECEFF1".equals(h) || "FFFFFF".equals(h)) return "#111111";
        return "#FFFFFF";
    }
}
