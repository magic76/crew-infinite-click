package com.magic76.aiclicker;

import org.json.JSONObject;

final class GameEvent {
    final String type;
    final String targetId;
    final String timerId;
    final float x;
    final float y;
    final long timestampMs;
    final long reactionMs;

    private GameEvent(String type, String targetId, String timerId, float x, float y,
                      long timestampMs, long reactionMs) {
        this.type = type;
        this.targetId = targetId == null ? "" : targetId;
        this.timerId = timerId == null ? "" : timerId;
        this.x = x;
        this.y = y;
        this.timestampMs = timestampMs;
        this.reactionMs = reactionMs;
    }

    static GameEvent click(String targetId, float x, float y, long reactionMs) {
        return new GameEvent("click", targetId, "", x, y, System.currentTimeMillis(), reactionMs);
    }

    static GameEvent worldTap(float x, float y, long reactionMs) {
        return new GameEvent("world_tap", "", "", x, y, System.currentTimeMillis(), reactionMs);
    }

    static GameEvent drag(String targetId, float x, float y, long reactionMs) {
        return new GameEvent("drag", targetId, "", x, y, System.currentTimeMillis(), reactionMs);
    }

    static GameEvent timeout(String timerId) {
        return new GameEvent("timeout", "", timerId, 0f, 0f, System.currentTimeMillis(), -1L);
    }

    static GameEvent worldTick() {
        return new GameEvent("world_tick", "", "", 0f, 0f, System.currentTimeMillis(), -1L);
    }

    static GameEvent start() {
        return new GameEvent("start", "", "", 0f, 0f, System.currentTimeMillis(), -1L);
    }

    JSONObject toJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("type", type);
            if (!targetId.isEmpty()) o.put("targetId", targetId);
            if (!timerId.isEmpty()) o.put("timerId", timerId);
            if ("click".equals(type) || "world_tap".equals(type) || "drag".equals(type)) {
                o.put("x", round3(x));
                o.put("y", round3(y));
                if (reactionMs >= 0) o.put("reactionMs", reactionMs);
            }
        } catch (Exception ignored) {}
        return o;
    }

    private static double round3(float value) {
        return Math.round(value * 1000.0) / 1000.0;
    }
}
