package com.magic76.aiclicker;

import org.json.JSONObject;

import java.util.Collection;
import java.util.Locale;

final class RuleEngine {
    enum Verdict { NEUTRAL, CORRECT, WRONG }

    private String type = "NONE";
    private String value = "";
    private String label = "";
    private long endsAt = 0L;
    private boolean inverted = false;
    private int successes = 0;
    private int failures = 0;

    void reset() {
        type = "NONE";
        value = "";
        label = "";
        endsAt = 0L;
        inverted = false;
        successes = 0;
        failures = 0;
    }

    void configure(String requestedType, String requestedValue, String requestedLabel,
                   long durationMs, boolean invert) {
        String normalized = normalizeType(requestedType);
        if ("NONE".equals(normalized)) {
            reset();
            return;
        }
        type = normalized;
        value = requestedValue == null ? "" : requestedValue.trim();
        label = requestedLabel == null ? "" : requestedLabel.trim();
        endsAt = System.currentTimeMillis() + clamp(durationMs, 1200L, 9000L);
        inverted = invert;
        successes = 0;
        failures = 0;
    }

    boolean isActive() {
        return !"NONE".equals(type) && !isExpired();
    }

    boolean isExpired() {
        return !"NONE".equals(type) && endsAt > 0L && System.currentTimeMillis() > endsAt;
    }

    Verdict evaluate(GameElement target, long reactionMs, Collection<GameElement> elements) {
        if (!isActive() || target == null) return Verdict.NEUTRAL;
        boolean success;
        String normalizedValue = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        switch (type) {
            case "ONLY_ROLE": success = target.role.equalsIgnoreCase(normalizedValue); break;
            case "AVOID_ROLE": success = !target.role.equalsIgnoreCase(normalizedValue); break;
            case "ONLY_SHAPE": success = target.shape.equalsIgnoreCase(normalizedValue); break;
            case "AVOID_SHAPE": success = !target.shape.equalsIgnoreCase(normalizedValue); break;
            case "ONLY_COLOR": success = target.style.backgroundHex != null && target.style.backgroundHex.equalsIgnoreCase(normalizedValue); break;
            case "AVOID_COLOR": success = target.style.backgroundHex == null || !target.style.backgroundHex.equalsIgnoreCase(normalizedValue); break;
            case "LARGEST": success = isExtremeTarget(target, elements, true); break;
            case "SMALLEST": success = isExtremeTarget(target, elements, false); break;
            case "WAIT_AT_LEAST_MS":
                long min = 700L;
                try { min = Long.parseLong(normalizedValue); } catch (Exception ignored) {}
                success = reactionMs >= clamp(min, 250L, 2500L);
                break;
            default: return Verdict.NEUTRAL;
        }
        if (inverted) success = !success;
        return success ? Verdict.CORRECT : Verdict.WRONG;
    }

    void record(Verdict verdict) {
        if (verdict == Verdict.CORRECT) successes++;
        else if (verdict == Verdict.WRONG) failures++;
    }

    void invert(long minExtensionMs) {
        if (!isActive()) return;
        inverted = !inverted;
        label = label.isEmpty() ? "↔" : "↔ " + label;
        endsAt = Math.max(endsAt, System.currentTimeMillis() + Math.max(0L, minExtensionMs));
    }

    String type() { return isActive() ? type : "NONE"; }
    String value() { return value; }
    String label() { return isActive() ? label : ""; }
    boolean inverted() { return isActive() && inverted; }
    long remainingMs() { return isActive() ? Math.max(0L, endsAt - System.currentTimeMillis()) : 0L; }
    int successes() { return successes; }
    int failures() { return failures; }

    JSONObject toJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("type", type());
            o.put("value", value);
            o.put("inverted", inverted());
            o.put("remainingMs", remainingMs());
            o.put("successes", successes);
            o.put("failures", failures);
        } catch (Exception ignored) {}
        return o;
    }

    private boolean isExtremeTarget(GameElement target, Collection<GameElement> elements, boolean largest) {
        float area = target.width * target.height;
        for (GameElement e : elements) {
            if (!e.visible || !GameElement.TYPE_BUTTON.equals(e.type) || e.id.equals(target.id)) continue;
            float other = e.width * e.height;
            if (largest && other > area + 0.0005f) return false;
            if (!largest && other < area - 0.0005f) return false;
        }
        return true;
    }

    static String normalizeType(String requested) {
        if (requested == null) return "NONE";
        String v = requested.trim().toUpperCase(Locale.ROOT);
        switch (v) {
            case "ONLY_ROLE": case "AVOID_ROLE": case "ONLY_SHAPE": case "AVOID_SHAPE":
            case "ONLY_COLOR": case "AVOID_COLOR": case "LARGEST": case "SMALLEST":
            case "WAIT_AT_LEAST_MS": return v;
            default: return "NONE";
        }
    }

    private static long clamp(long v, long min, long max) { return Math.max(min, Math.min(max, v)); }
}
