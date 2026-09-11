package com.magic76.aiclicker;

import org.json.JSONObject;

final class MomentumEngine {
    private long lastTapAt = 0L;
    private long lastIntervalMs = 0L;
    private double emaIntervalMs = 680.0;
    private double slowEmaIntervalMs = 680.0;
    private double momentum = 0.18;
    private double peakClickRate = 0.0;
    private double previousClickRate = 0.0;
    private double speedDeltaCps = 0.0;
    private int tapCount = 0;
    private int fastStreak = 0;

    void reset() {
        lastTapAt = 0L;
        lastIntervalMs = 0L;
        emaIntervalMs = 680.0;
        slowEmaIntervalMs = 680.0;
        momentum = 0.18;
        peakClickRate = 0.0;
        previousClickRate = 0.0;
        speedDeltaCps = 0.0;
        tapCount = 0;
        fastStreak = 0;
    }

    void recordTap(long now, boolean positiveOutcome) {
        if (lastTapAt > 0L) {
            long interval = Math.max(40L, Math.min(2500L, now - lastTapAt));
            lastIntervalMs = interval;

            previousClickRate = clickRatePerSecond();
            emaIntervalMs = emaIntervalMs * 0.68 + interval * 0.32;
            slowEmaIntervalMs = slowEmaIntervalMs * 0.88 + interval * 0.12;

            double currentRate = clickRatePerSecond();
            speedDeltaCps = speedDeltaCps * 0.60 + (currentRate - previousClickRate) * 0.40;
            peakClickRate = Math.max(peakClickRate, currentRate);

            if (interval <= 330L) fastStreak++;
            else if (interval <= 520L) fastStreak = Math.max(0, fastStreak - 1);
            else fastStreak = 0;

            double pace = clamp01((920.0 - emaIntervalMs) / 720.0);
            double continuity = interval <= 520L ? 0.10 : (interval <= 850L ? 0.045 : -0.085);
            double target = 0.12 + pace * 0.88;

            // In 0.13 even a "wrong" tap is still forward motion. It should barely affect
            // momentum; the important signal is whether the player keeps tapping.
            momentum += (target - momentum) * 0.30 + continuity + (positiveOutcome ? 0.025 : -0.008);
        } else {
            momentum = Math.max(momentum, 0.24);
        }

        lastTapAt = now;
        tapCount++;
        peakClickRate = Math.max(peakClickRate, clickRatePerSecond());
        momentum = clamp01(momentum);
    }

    double value(long now) {
        if (lastTapAt <= 0L) return momentum;
        long idle = Math.max(0L, now - lastTapAt);
        if (idle <= 650L) return momentum;
        double decay = Math.exp(-(idle - 650.0) / 1500.0);
        return clamp01(momentum * decay);
    }

    long hesitationMs(long now) {
        return lastTapAt <= 0L ? 0L : Math.max(0L, now - lastTapAt);
    }

    double clickRatePerSecond() {
        if (tapCount < 2 || emaIntervalMs <= 0.0) return 0.0;
        return Math.min(12.0, 1000.0 / emaIntervalMs);
    }

    double slowClickRatePerSecond() {
        if (tapCount < 2 || slowEmaIntervalMs <= 0.0) return 0.0;
        return Math.min(12.0, 1000.0 / slowEmaIntervalMs);
    }

    double peakClickRatePerSecond() { return peakClickRate; }

    double speedDeltaCps() {
        // Fast-vs-slow EMA is more stable for AI reasoning than one-frame delta.
        double trend = clickRatePerSecond() - slowClickRatePerSecond();
        return Math.round(trend * 100.0) / 100.0;
    }

    long clickIntervalMs() { return Math.round(emaIntervalMs); }
    long lastClickIntervalMs() { return lastIntervalMs; }
    int fastStreak() { return fastStreak; }
    int tapCount() { return tapCount; }

    String speedTrend() {
        double delta = speedDeltaCps();
        if (delta >= 0.55) return "ACCELERATING";
        if (delta <= -0.45) return "DECELERATING";
        return "STEADY";
    }

    String speedTier(long now) {
        if (lastTapAt <= 0L || hesitationMs(now) > 1200L) return "IDLE";
        double cps = clickRatePerSecond();
        if (cps >= 4.2 || fastStreak >= 5) return "FRENZY";
        if (cps >= 2.8) return "FAST";
        if (cps >= 1.7) return "QUICK";
        return "RELAXED";
    }

    int scoreBonus(long now) {
        double v = value(now);
        if (v >= 0.86) return 5;
        if (v >= 0.72) return 3;
        if (v >= 0.52) return 1;
        return 0;
    }

    String flowState(long now) {
        long h = hesitationMs(now);
        if (lastTapAt > 0L && h > 1150L) return "STALLED";
        double v = value(now);
        if (v >= 0.84) return "FRENZY";
        if (v >= 0.60) return "FLOW";
        if (v >= 0.34) return "BUILDING";
        return "CALM";
    }

    JSONObject speedJson(long now) {
        JSONObject o = new JSONObject();
        try {
            o.put("cps", round2(clickRatePerSecond()));
            o.put("averageIntervalMs", clickIntervalMs());
            o.put("lastIntervalMs", lastClickIntervalMs());
            o.put("peakCps", round2(peakClickRatePerSecond()));
            o.put("deltaCps", speedDeltaCps());
            o.put("trend", speedTrend());
            o.put("tier", speedTier(now));
            o.put("fastStreak", fastStreak);
            o.put("totalTaps", tapCount);
        } catch (Exception ignored) {}
        return o;
    }

    JSONObject toJson(long now) {
        JSONObject o = new JSONObject();
        try {
            o.put("value", round2(value(now)));
            o.put("clickRate", round2(clickRatePerSecond()));
            o.put("clickIntervalMs", clickIntervalMs());
            o.put("hesitationMs", hesitationMs(now));
            o.put("state", flowState(now));
            o.put("speedTrend", speedTrend());
            o.put("speedTier", speedTier(now));
            o.put("peakClickRate", round2(peakClickRatePerSecond()));
        } catch (Exception ignored) {}
        return o;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static double clamp01(double v) { return Math.max(0.0, Math.min(1.0, v)); }
}
