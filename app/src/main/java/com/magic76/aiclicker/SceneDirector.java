package com.magic76.aiclicker;

import android.graphics.Color;
import java.util.Locale;

/**
 * Visual-world state. Gameplay mechanics remain independent; this describes how the
 * same mechanic is staged and rendered.
 */
final class SceneDirector {
    static final String NEON = "NEON";
    static final String COMIC = "COMIC";
    static final String MINIMAL = "MINIMAL";
    static final String GLITCH = "GLITCH";
    static final String SPACE = "SPACE";

    private String world = NEON;
    private String transition = "PULSE";
    private float intensity = 0.55f;
    private long changedAt = System.currentTimeMillis();

    String world() { return world; }
    String transition() { return transition; }
    float intensity() { return intensity; }
    long changedAt() { return changedAt; }

    void setWorld(String requested, String requestedTransition, float requestedIntensity) {
        String v = requested == null ? "" : requested.toUpperCase(Locale.US);
        if (!NEON.equals(v) && !COMIC.equals(v) && !MINIMAL.equals(v) &&
                !GLITCH.equals(v) && !SPACE.equals(v)) v = NEON;
        world = v;
        String t = requestedTransition == null ? "" : requestedTransition.toUpperCase(Locale.US);
        if (!"PULSE".equals(t) && !"IMPACT".equals(t) && !"WIPE".equals(t) &&
                !"GLITCH".equals(t) && !"ZOOM".equals(t)) t = "PULSE";
        transition = t;
        intensity = Math.max(0.15f, Math.min(1f, requestedIntensity));
        changedAt = System.currentTimeMillis();
    }

    int accentColor() {
        switch (world) {
            case COMIC: return Color.rgb(255, 214, 40);
            case MINIMAL: return Color.rgb(230, 230, 230);
            case GLITCH: return Color.rgb(0, 240, 220);
            case SPACE: return Color.rgb(170, 140, 255);
            default: return Color.rgb(0, 235, 255);
        }
    }

    int secondaryColor() {
        switch (world) {
            case COMIC: return Color.rgb(255, 70, 55);
            case MINIMAL: return Color.rgb(120, 120, 120);
            case GLITCH: return Color.rgb(255, 35, 150);
            case SPACE: return Color.rgb(90, 170, 255);
            default: return Color.rgb(255, 45, 160);
        }
    }
}
