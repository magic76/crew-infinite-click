package com.magic76.aiclicker;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;

/** Native haptic patterns. Keep them short; contrast is more important than frequency. */
public final class HapticEngine {
    private final Vibrator vibrator;
    private long lastAtMs;

    public HapticEngine(Context context) {
        Context app = context == null ? null : context.getApplicationContext();
        if (app == null) {
            vibrator = null;
        } else {
            vibrator = (Vibrator) app.getSystemService(Context.VIBRATOR_SERVICE);
        }
    }

    public boolean perform(String cue, double intensity) {
        if (vibrator == null || !vibrator.hasVibrator()) return false;
        long now = android.os.SystemClock.elapsedRealtime();
        if (now - lastAtMs < 85L) return false;
        lastAtMs = now;

        Pattern p = pattern(cue, clamp(intensity));
        if (p == null) return false;
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                vibrator.vibrate(VibrationEffect.createWaveform(p.timings, p.amplitudes, -1));
            } else {
                vibrator.vibrate(p.legacyTimings, -1);
            }
            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    private Pattern pattern(String rawCue, double intensity) {
        String cue = rawCue == null ? "" : rawCue.trim().toUpperCase(java.util.Locale.ROOT);
        int soft = amp(38, intensity);
        int medium = amp(95, intensity);
        int strong = amp(170, intensity);
        int max = amp(230, intensity);
        switch (cue) {
            case "SOFT_TAP": return p(new long[]{0, 12}, new int[]{0, soft});
            case "CORRECT": return p(new long[]{0,18,45,32}, new int[]{0,medium,0,strong});
            case "WRONG": return p(new long[]{0,44}, new int[]{0,strong});
            case "WARNING": return p(new long[]{0,16,38,16,38,16}, new int[]{0,medium,0,medium,0,medium});
            case "ICE_TICK": return p(new long[]{0,11,28,8}, new int[]{0,strong,0,soft});
            case "DRY_DOUBLE": return p(new long[]{0,16,30,22}, new int[]{0,medium,0,strong});
            case "DIGITAL_TRIPLE": return p(new long[]{0,10,18,10,18,18}, new int[]{0,medium,0,strong,0,medium});
            case "THUNDER": return p(new long[]{0,20,55,70}, new int[]{0,soft,0,max});
            case "VOID_PULL": return p(new long[]{0,34,24,62}, new int[]{0,medium,0,strong});
            case "HEARTBEAT": return p(new long[]{0,28,82,34}, new int[]{0,strong,0,max});
            case "IMPACT": return p(new long[]{0,88}, new int[]{0,max});
            default: return null;
        }
    }

    private static Pattern p(long[] timings, int[] amplitudes) {
        // Legacy pattern alternates delay/vibrate/pause/vibrate and ignores amplitudes.
        return new Pattern(timings, amplitudes, timings);
    }

    private static int amp(int base, double intensity) {
        return Math.max(1, Math.min(255, (int)Math.round(base * (0.45 + intensity * 0.75))));
    }

    private static double clamp(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) return 0.35;
        return Math.max(0.05, Math.min(1.0, value));
    }

    private static final class Pattern {
        final long[] timings;
        final int[] amplitudes;
        final long[] legacyTimings;
        Pattern(long[] timings, int[] amplitudes, long[] legacyTimings) {
            this.timings = timings;
            this.amplitudes = amplitudes;
            this.legacyTimings = legacyTimings;
        }
    }
}
