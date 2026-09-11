package com.magic76.aiclicker;

import org.json.JSONObject;

final class PlayerProfile {
    int totalClicks = 0;
    double averageReactionTimeMs = 0;
    int warningIgnoreCount = 0;
    int rageClickCount = 0;
    String favoriteColor = "";
    double trustsAI = 0.55;
    double curiosity = 0.50;
    double patience = 0.50;

    private int reactionSamples = 0;

    void recordReaction(long reactionMs) {
        if (reactionMs < 0 || reactionMs > 120_000) return;
        reactionSamples++;
        averageReactionTimeMs += (reactionMs - averageReactionTimeMs) / reactionSamples;
        if (reactionMs < 350) {
            patience = clamp01(patience - 0.02);
        } else if (reactionMs > 4500) {
            patience = clamp01(patience + 0.02);
        }
    }

    void recordWarningIgnored() {
        warningIgnoreCount++;
        trustsAI = clamp01(trustsAI - 0.035);
        curiosity = clamp01(curiosity + 0.025);
    }

    void recordNovelTarget() {
        curiosity = clamp01(curiosity + 0.015);
    }

    JSONObject toJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("totalClicks", totalClicks);
            o.put("averageReactionTime", Math.round(averageReactionTimeMs));
            o.put("warningIgnoreCount", warningIgnoreCount);
            o.put("rageClickCount", rageClickCount);
            if (!favoriteColor.isEmpty()) o.put("favoriteColor", favoriteColor);
            o.put("trustsAI", round2(trustsAI));
            o.put("curiosity", round2(curiosity));
            o.put("patience", round2(patience));
        } catch (Exception ignored) {}
        return o;
    }

    private static double clamp01(double v) { return Math.max(0.0, Math.min(1.0, v)); }
    private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }
}
