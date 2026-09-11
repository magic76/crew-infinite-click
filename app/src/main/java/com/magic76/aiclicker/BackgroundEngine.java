package com.magic76.aiclicker;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Random;

final class BackgroundEngine {
    private static final int MAX_PARTICLES = 90;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Random random = new Random();
    private final List<Particle> particles = new ArrayList<>();
    private final List<Ripple> ripples = new ArrayList<>();
    private String theme = "midnight";
    private String ambient = "grid";
    private float speed = 1f;
    private float intensity = 0.55f;
    private float energy = 0f;
    private long lastFrame = System.currentTimeMillis();

    void reset() {
        particles.clear();
        ripples.clear();
        theme = "midnight";
        ambient = "grid";
        speed = 1f;
        intensity = 0.55f;
        energy = 0f;
        lastFrame = System.currentTimeMillis();
    }

    void setTheme(String value) {
        if (value != null && !value.trim().isEmpty()) theme = value.trim().toLowerCase();
    }
    void setAmbient(String value) {
        if (value != null && !value.trim().isEmpty()) ambient = value.trim().toLowerCase();
    }
    void setSpeed(float value) { speed = clamp(value, 0.1f, 3f); }
    void setIntensity(float value) { intensity = clamp(value, 0f, 1f); }
    void clearEffects() { particles.clear(); ripples.clear(); energy = 0f; }

    void onTap(float x, float y) {
        energy = clamp(energy + 0.14f, 0f, 1f);
        ripple(x, y, 0.55f);
        particles(x, y, 10 + (int) (energy * 18f));
    }

    void ripple(float x, float y, float strength) {
        ripples.add(new Ripple(x, y, System.currentTimeMillis(), 520L, clamp(strength, 0.1f, 1f)));
        while (ripples.size() > 12) ripples.remove(0);
    }

    void shockwave(float x, float y) {
        ripples.add(new Ripple(x, y, System.currentTimeMillis(), 820L, 1f));
        particles(x, y, 34);
        energy = clamp(energy + 0.35f, 0f, 1f);
    }

    void particles(float x, float y, int count) {
        for (int i = 0; i < count && particles.size() < MAX_PARTICLES; i++) {
            double a = random.nextDouble() * Math.PI * 2.0;
            float v = 0.10f + random.nextFloat() * 0.34f;
            particles.add(new Particle(x, y, (float) Math.cos(a) * v, (float) Math.sin(a) * v,
                    420L + random.nextInt(520), System.currentTimeMillis()));
        }
    }

    void draw(Canvas canvas, float left, float top, float right, float bottom) {
        long now = System.currentTimeMillis();
        float dt = Math.min(0.05f, Math.max(0.001f, (now - lastFrame) / 1000f));
        lastFrame = now;
        energy = Math.max(0f, energy - dt * 0.20f);

        int[] colors = themeColors();
        paint.setShader(new LinearGradient(left, top, right, bottom, colors[0], colors[1], Shader.TileMode.CLAMP));
        canvas.drawRect(left, top, right, bottom, paint);
        paint.setShader(null);

        if (!"none".equals(ambient)) drawAmbient(canvas, left, top, right, bottom, now);
        drawParticles(canvas, left, top, right, bottom, now, dt);
        drawRipples(canvas, left, top, right, bottom, now);
    }

    private void drawAmbient(Canvas canvas, float left, float top, float right, float bottom, long now) {
        float w = right - left, h = bottom - top;
        float boost = 0.35f + intensity * 0.65f + energy * 0.55f;
        if (ambient.contains("grid")) {
            float gap = Math.max(34f, w / 9f);
            float offset = (now / 16f * speed * 0.45f) % gap;
            paint.setStrokeWidth(1f);
            paint.setColor(Color.argb((int) (26 * boost), 190, 200, 255));
            for (float x = left - gap + offset; x < right + gap; x += gap) canvas.drawLine(x, top, x, bottom, paint);
            for (float y = top - gap + offset; y < bottom + gap; y += gap) canvas.drawLine(left, y, right, y, paint);
        }
        if (ambient.contains("stars") || ambient.contains("particles")) {
            paint.setColor(Color.argb((int) (105 * boost), 235, 240, 255));
            for (int i = 0; i < 22; i++) {
                float px = left + ((i * 97f + now * 0.018f * speed) % Math.max(1f, w));
                float py = top + ((i * 53f + now * 0.010f * speed) % Math.max(1f, h));
                canvas.drawCircle(px, py, 1.5f + (i % 3), paint);
            }
        }
    }

    private void drawParticles(Canvas canvas, float left, float top, float right, float bottom, long now, float dt) {
        Iterator<Particle> it = particles.iterator();
        while (it.hasNext()) {
            Particle p = it.next();
            float life = (now - p.bornAt) / (float) p.lifeMs;
            if (life >= 1f) { it.remove(); continue; }
            p.x += p.vx * dt * speed;
            p.y += p.vy * dt * speed;
            float alpha = 1f - life;
            paint.setColor(Color.argb((int) (210 * alpha), 235, 240, 255));
            canvas.drawCircle(left + p.x * (right - left), top + p.y * (bottom - top), 2.5f + energy * 2f, paint);
        }
    }

    private void drawRipples(Canvas canvas, float left, float top, float right, float bottom, long now) {
        Iterator<Ripple> it = ripples.iterator();
        while (it.hasNext()) {
            Ripple r = it.next();
            float t = (now - r.bornAt) / (float) r.lifeMs;
            if (t >= 1f) { it.remove(); continue; }
            float maxRadius = Math.min(right - left, bottom - top) * (0.18f + 0.32f * r.strength);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(2f + 5f * (1f - t) * r.strength);
            paint.setColor(Color.argb((int) (150 * (1f - t)), 220, 230, 255));
            canvas.drawCircle(left + r.x * (right - left), top + r.y * (bottom - top), maxRadius * t, paint);
            paint.setStyle(Paint.Style.FILL);
        }
    }

    private int[] themeColors() {
        if (theme.contains("danger") || theme.contains("red")) return new int[]{Color.rgb(35, 8, 14), Color.rgb(88, 18, 25)};
        if (theme.contains("neon")) return new int[]{Color.rgb(11, 12, 30), Color.rgb(28, 10, 58)};
        if (theme.contains("calm") || theme.contains("blue")) return new int[]{Color.rgb(8, 18, 28), Color.rgb(15, 42, 61)};
        if (theme.contains("void") || theme.contains("black")) return new int[]{Color.rgb(3, 3, 6), Color.rgb(10, 10, 14)};
        return new int[]{Color.rgb(10, 12, 20), Color.rgb(20, 24, 38)};
    }

    private static float clamp(float v, float min, float max) { return Math.max(min, Math.min(max, v)); }

    private static final class Particle {
        float x, y, vx, vy; final long lifeMs, bornAt;
        Particle(float x, float y, float vx, float vy, long lifeMs, long bornAt) {
            this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.lifeMs=lifeMs; this.bornAt=bornAt;
        }
    }
    private static final class Ripple {
        final float x,y,strength; final long bornAt,lifeMs;
        Ripple(float x,float y,long bornAt,long lifeMs,float strength){this.x=x;this.y=y;this.bornAt=bornAt;this.lifeMs=lifeMs;this.strength=strength;}
    }
}
