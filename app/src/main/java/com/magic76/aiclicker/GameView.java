package com.magic76.aiclicker;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.view.HapticFeedbackConstants;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;

final class GameView extends View {
    interface SettingsTapListener { void onSettingsTap(); }
    interface LanguageChangeListener { void onLanguageChanged(AppLanguage language); }

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final BackgroundEngine startBackground = new BackgroundEngine();
    private final LivingWorldEngine livingWorldEngine = new LivingWorldEngine();
    private FilamentWorldView worldSurface;

    private final float density;
    private final float scaledDensity;

    private final RectF startButton = new RectF();
    private final RectF chineseButton = new RectF();
    private final RectF englishButton = new RectF();
    private final RectF connectionButton = new RectF();
    private final RectF settingsButton = new RectF();
    private final RectF settingsCloseButton = new RectF();
    private boolean settingsOpen = false;

    private int insetLeft;
    private int insetTop;
    private int insetRight;
    private int insetBottom;

    private GameRuntime runtime;
    private SettingsTapListener settingsTapListener;
    private LanguageChangeListener languageChangeListener;

    private String aiCaption = "";
    private String connectionStatus = "DEMO";

    private int flashColor = Color.WHITE;
    private long flashStartAt;
    private long flashEndAt;

    private float shakeIntensity;
    private long shakeStartAt;
    private long shakeEndAt;

    private String pressedControl = "";

    GameView(Context context) {
        super(context);
        density = getResources().getDisplayMetrics().density;
        scaledDensity = getResources().getDisplayMetrics().scaledDensity;
        setBackgroundColor(Color.TRANSPARENT);
        setFocusable(true);
        livingWorldEngine.reset();
    }

    void setRuntime(GameRuntime runtime) { this.runtime = runtime; }
    void setWorldSurface(FilamentWorldView worldSurface) {
        this.worldSurface = worldSurface;
    }
    void setSettingsTapListener(SettingsTapListener listener) { this.settingsTapListener = listener; }
    void setLanguageChangeListener(LanguageChangeListener listener) { this.languageChangeListener = listener; }

    void setConnectionStatus(String status) {
        connectionStatus = status == null ? "" : status;
        postInvalidateOnAnimation();
    }

    void setAiCaption(String caption) {
        aiCaption = caption == null ? "" : caption.trim();
        postInvalidateOnAnimation();
    }

    void clearTransientState() {
        aiCaption = "";
        pressedControl = "";
        settingsOpen = false;
        flashEndAt = 0L;
        shakeEndAt = 0L;
        startBackground.reset();
        livingWorldEngine.reset();
        if (worldSurface != null) worldSurface.applyWorldPlan(WorldPlan.defaultPlan());
        postInvalidateOnAnimation();
    }

    void onGameTap(float x, float y) {
        double momentum = runtime == null ? 0.0 : runtime.getMomentum();
        livingWorldEngine.onTap(x, y, momentum);
        if (worldSurface != null) worldSurface.onWorldTap(x, y, momentum);
        postInvalidateOnAnimation();
    }

    void applyWorldPlan(WorldPlan plan) {
        livingWorldEngine.applyPlan(plan);
        if (worldSurface != null) worldSurface.applyWorldPlan(plan);
        postInvalidateOnAnimation();
    }

    WorldPlan currentWorldPlan() {
        if (worldSurface != null) return worldSurface.currentPlan();
        return livingWorldEngine.currentPlan();
    }

    void shake(float intensity, long durationMs) {
        shakeIntensity = clamp(intensity, 0f, 1f);
        shakeStartAt = System.currentTimeMillis();
        shakeEndAt = shakeStartAt + Math.max(40L, durationMs);
        postInvalidateOnAnimation();
    }

    void flash(int color, long durationMs) {
        flashColor = color;
        flashStartAt = System.currentTimeMillis();
        flashEndAt = flashStartAt + Math.max(40L, durationMs);
        postInvalidateOnAnimation();
    }

    @Override
    public WindowInsets onApplyWindowInsets(WindowInsets insets) {
        if (insets != null) {
            insetLeft = insets.getSystemWindowInsetLeft();
            insetTop = insets.getSystemWindowInsetTop();
            insetRight = insets.getSystemWindowInsetRight();
            insetBottom = insets.getSystemWindowInsetBottom();
        }
        postInvalidateOnAnimation();
        return insets;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (runtime == null) return;

        long now = System.currentTimeMillis();
        float shakeX = 0f;
        float shakeY = 0f;

        if (now < shakeEndAt) {
            float progress = (now - shakeStartAt) / (float)Math.max(1L, shakeEndAt - shakeStartAt);
            float fade = 1f - clamp(progress, 0f, 1f);
            float amp = dp(15f) * shakeIntensity * fade;
            shakeX = (float)Math.sin(progress * 68.0) * amp;
            shakeY = (float)Math.cos(progress * 51.0) * amp * 0.55f;
            postInvalidateOnAnimation();
        }

        canvas.save();
        canvas.translate(shakeX, shakeY);

        RectF area = contentArea();
        if (runtime.getGameState() == GameRuntime.GameState.PLAYING) {
            if (worldSurface == null || !worldSurface.isFilamentReady()) {
                livingWorldEngine.draw(canvas, area);
            }
            drawHud(canvas);
            drawCaption(canvas);
            postInvalidateOnAnimation();
        } else {
            startBackground.draw(canvas, area.left, area.top, area.right, area.bottom);
            if (runtime.getGameState() == GameRuntime.GameState.START) {
                drawStartScreen(canvas, area);
            } else {
                drawResultFallback(canvas, area);
            }
        }

        canvas.restore();

        if (now < flashEndAt) {
            float progress = (now - flashStartAt) / (float)Math.max(1L, flashEndAt - flashStartAt);
            int alpha = (int)(135 * (1f - clamp(progress, 0f, 1f)));
            paint.setColor((flashColor & 0x00FFFFFF) | (alpha << 24));
            canvas.drawRect(0, 0, getWidth(), getHeight(), paint);
            postInvalidateOnAnimation();
        }
    }

    private void drawHud(Canvas canvas) {
        float left = Math.max(dp(18), insetLeft + dp(18));
        float top = Math.max(dp(28), insetTop + dp(24));

        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        textPaint.setTextSize(sp(12));
        textPaint.setColor(Color.argb(170, 232, 235, 244));

        String cps = String.format(java.util.Locale.US, "%.1f", runtime.getClickRate());
        canvas.drawText(runtime.text("點擊 ", "TAPS ") + runtime.getRunClicks() + "  ·  CPS " + cps,
                left, top, textPaint);

        WorldPlan plan = runtime.getCurrentWorldPlan();
        if (plan != null) {
            textPaint.setTypeface(Typeface.DEFAULT);
            textPaint.setTextSize(sp(10));
            textPaint.setColor(Color.argb(105, 220, 224, 235));
            canvas.drawText(plan.theme + " · " + plan.layout + " · " + plan.mood,
                    left, top + dp(16), textPaint);
        }

        float right = getWidth() - Math.max(dp(18), insetRight + dp(18));
        settingsButton.set(right - dp(38), top - dp(19), right + dp(4), top + dp(18));

        paint.setColor(Color.argb(52, 255, 255, 255));
        canvas.drawRoundRect(settingsButton, dp(13), dp(13), paint);

        paint.setStrokeWidth(dp(1.4f));
        paint.setColor(Color.argb(180, 230, 233, 242));
        for (int i = 0; i < 3; i++) {
            float yy = settingsButton.top + dp(10 + i * 8);
            canvas.drawLine(settingsButton.left + dp(11), yy,
                    settingsButton.right - dp(11), yy, paint);
        }

        textPaint.setTypeface(Typeface.DEFAULT);
        textPaint.setTextSize(sp(9));
        textPaint.setColor(Color.argb(90, 220, 224, 235));
        String rendererStatus = worldSurface == null ? "2D" : worldSurface.renderStatus();
        String statusText = connectionStatus + " · " + rendererStatus;
        float sw = textPaint.measureText(statusText);
        canvas.drawText(statusText,
                settingsButton.left - sw - dp(8), top, textPaint);

        if (settingsOpen) drawSettingsOverlay(canvas);
    }

    private void drawSettingsOverlay(Canvas canvas) {
        RectF area = contentArea();

        paint.setColor(Color.argb(150, 0, 0, 0));
        canvas.drawRect(area, paint);

        float panelW = Math.min(area.width() - dp(32), dp(330));
        float panelH = dp(270);
        RectF panel = new RectF(
                area.centerX() - panelW / 2f,
                area.centerY() - panelH / 2f,
                area.centerX() + panelW / 2f,
                area.centerY() + panelH / 2f
        );

        paint.setColor(Color.argb(242, 18, 20, 29));
        canvas.drawRoundRect(panel, dp(24), dp(24), paint);

        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        textPaint.setTextSize(sp(20));
        textPaint.setColor(Color.WHITE);
        drawCentered(canvas, runtime.text("設定", "SETTINGS"),
                panel.centerX(), panel.top + dp(38), panel.width() * 0.82f, textPaint);

        textPaint.setTypeface(Typeface.DEFAULT);
        textPaint.setTextSize(sp(12));
        textPaint.setColor(Color.argb(170, 205, 210, 222));
        drawCentered(canvas, runtime.text("語言", "LANGUAGE"),
                panel.centerX(), panel.top + dp(78), panel.width() * 0.82f, textPaint);

        float gap = dp(10);
        float chipW = (panel.width() - dp(54) - gap) / 2f;
        float chipH = dp(46);
        chineseButton.set(panel.left + dp(22), panel.top + dp(92),
                panel.left + dp(22) + chipW, panel.top + dp(92) + chipH);
        englishButton.set(chineseButton.right + gap, panel.top + dp(92),
                chineseButton.right + gap + chipW, panel.top + dp(92) + chipH);

        drawLanguageChip(canvas, chineseButton, "中文", runtime.getLanguage() == AppLanguage.ZH_TW);
        drawLanguageChip(canvas, englishButton, "English", runtime.getLanguage() == AppLanguage.EN);

        textPaint.setTextSize(sp(11));
        textPaint.setColor(Color.argb(145, 200, 205, 218));
        drawCentered(canvas,
                runtime.text("Gemini Live 語音 / 世界導演", "Gemini Live voice / world director"),
                panel.centerX(), panel.top + dp(164), panel.width() * 0.84f, textPaint);

        connectionButton.set(panel.left + dp(22), panel.top + dp(178),
                panel.right - dp(22), panel.top + dp(224));
        paint.setColor(Color.argb(64, 255, 255, 255));
        canvas.drawRoundRect(connectionButton, dp(16), dp(16), paint);

        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        textPaint.setTextSize(sp(14));
        textPaint.setColor(Color.WHITE);
        drawCentered(canvas,
                connectionStatus + "  ·  " + runtime.text("連線設定", "CONNECTION"),
                connectionButton.centerX(), connectionButton.centerY() + dp(5),
                connectionButton.width() * 0.9f, textPaint);

        settingsCloseButton.set(panel.centerX() - dp(62), panel.bottom - dp(36),
                panel.centerX() + dp(62), panel.bottom - dp(8));
        textPaint.setTypeface(Typeface.DEFAULT);
        textPaint.setTextSize(sp(12));
        textPaint.setColor(Color.argb(180, 215, 219, 230));
        drawCentered(canvas, runtime.text("關閉", "CLOSE"),
                settingsCloseButton.centerX(), settingsCloseButton.centerY() + dp(4),
                settingsCloseButton.width(), textPaint);
    }

    private void drawCaption(Canvas canvas) {
        if (aiCaption == null || aiCaption.isEmpty()) return;

        RectF area = contentArea();
        float maxWidth = area.width() * 0.82f;
        float y = area.bottom - dp(38);

        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        textPaint.setTextSize(sp(16));
        textPaint.setColor(Color.argb(228, 248, 248, 252));

        String text = ellipsize(aiCaption, maxWidth, textPaint);
        float width = textPaint.measureText(text);

        paint.setColor(Color.argb(72, 0, 0, 0));
        RectF bubble = new RectF(
                area.centerX() - width / 2f - dp(15),
                y - dp(24),
                area.centerX() + width / 2f + dp(15),
                y + dp(10)
        );
        canvas.drawRoundRect(bubble, dp(14), dp(14), paint);
        canvas.drawText(text, area.centerX() - width / 2f, y, textPaint);
    }

    private void drawStartScreen(Canvas canvas, RectF area) {
        float cx = area.centerX();
        float cy = area.centerY();

        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        textPaint.setTextSize(sp(34));
        textPaint.setColor(Color.WHITE);
        drawCentered(canvas, "LIVING CANVAS", cx, cy - dp(154), area.width() * 0.9f, textPaint);

        textPaint.setTypeface(Typeface.DEFAULT);
        textPaint.setTextSize(sp(16));
        textPaint.setColor(Color.argb(215, 216, 220, 232));
        drawCentered(canvas,
                runtime.text("隨便摸、隨便按。AI 世界會一直長下去。",
                        "Touch anywhere. The AI world keeps evolving."),
                cx, cy - dp(110), area.width() * 0.9f, textPaint);

        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        textPaint.setTextSize(sp(12));
        textPaint.setColor(Color.argb(180, 205, 210, 222));
        drawCentered(canvas, runtime.text("語言", "LANGUAGE"),
                cx, cy - dp(62), area.width() * 0.8f, textPaint);

        float gap = dp(10);
        float chipW = Math.min(dp(116), (area.width() - dp(52) - gap) / 2f);
        float chipH = dp(46);

        chineseButton.set(cx - gap / 2f - chipW, cy - dp(44),
                cx - gap / 2f, cy - dp(44) + chipH);
        englishButton.set(cx + gap / 2f, cy - dp(44),
                cx + gap / 2f + chipW, cy - dp(44) + chipH);

        drawLanguageChip(canvas, chineseButton, "中文", runtime.getLanguage() == AppLanguage.ZH_TW);
        drawLanguageChip(canvas, englishButton, "English", runtime.getLanguage() == AppLanguage.EN);

        startButton.set(cx - dp(112), cy + dp(34), cx + dp(112), cy + dp(94));
        paint.setColor(Color.rgb(108, 99, 255));
        canvas.drawRoundRect(startButton, dp(22), dp(22), paint);

        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        textPaint.setTextSize(sp(18));
        textPaint.setColor(Color.WHITE);
        drawCentered(canvas, runtime.text("進入世界", "ENTER WORLD"),
                startButton.centerX(), startButton.centerY() + dp(6),
                startButton.width() * 0.85f, textPaint);

        textPaint.setTypeface(Typeface.DEFAULT);
        textPaint.setTextSize(sp(12));
        textPaint.setColor(Color.argb(145, 188, 193, 204));
        drawCentered(canvas,
                runtime.text("沒有關卡 · 沒有結束 · 每次碰觸都會留下痕跡",
                        "No levels · no ending · every touch changes the world"),
                cx, cy + dp(128), area.width() * 0.92f, textPaint);

        drawConnectionFooter(canvas, area);
    }

    private void drawLanguageChip(Canvas canvas, RectF rect, String label, boolean selected) {
        paint.setColor(selected ? Color.rgb(108, 99, 255) : Color.argb(70, 255, 255, 255));
        canvas.drawRoundRect(rect, dp(18), dp(18), paint);

        if (!selected) {
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(1.2f));
            paint.setColor(Color.argb(100, 226, 228, 236));
            canvas.drawRoundRect(rect, dp(18), dp(18), paint);
            paint.setStyle(Paint.Style.FILL);
        }

        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        textPaint.setTextSize(sp(15));
        textPaint.setColor(Color.WHITE);
        drawCentered(canvas, label, rect.centerX(), rect.centerY() + dp(5),
                rect.width() * 0.86f, textPaint);
    }

    private void drawConnectionFooter(Canvas canvas, RectF area) {
        String status = connectionStatus + "  ·  " + runtime.text("連線設定", "CONNECTION");
        textPaint.setTypeface(Typeface.DEFAULT);
        textPaint.setTextSize(sp(11));
        textPaint.setColor(Color.argb(140, 192, 196, 208));

        float width = textPaint.measureText(status);
        float baseline = area.bottom - dp(8);
        canvas.drawText(status, area.right - width, baseline, textPaint);
        connectionButton.set(area.right - width - dp(14),
                baseline - dp(28),
                area.right + dp(8),
                baseline + dp(10));
    }

    private void drawResultFallback(Canvas canvas, RectF area) {
        // RESULT is no longer part of the endless product flow, but keep a safe fallback
        // for any legacy lifecycle edge while migrating.
        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        textPaint.setTextSize(sp(26));
        textPaint.setColor(Color.WHITE);
        drawCentered(canvas,
                runtime.text("世界暫停了", "WORLD PAUSED"),
                area.centerX(), area.centerY() - dp(20),
                area.width() * 0.85f, textPaint);

        startButton.set(area.centerX() - dp(105), area.centerY() + dp(24),
                area.centerX() + dp(105), area.centerY() + dp(82));
        paint.setColor(Color.rgb(108, 99, 255));
        canvas.drawRoundRect(startButton, dp(22), dp(22), paint);

        textPaint.setTextSize(sp(17));
        drawCentered(canvas, runtime.text("重新進入", "RE-ENTER"),
                startButton.centerX(), startButton.centerY() + dp(6),
                startButton.width() * 0.84f, textPaint);
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (runtime == null) return true;

        float x = event.getX();
        float y = event.getY();

        if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
            if (runtime.getGameState() == GameRuntime.GameState.START) {
                pressedControl = startButton.contains(x, y) ? "start" : "";
                return true;
            }

            if (runtime.getGameState() == GameRuntime.GameState.RESULT) {
                pressedControl = startButton.contains(x, y) ? "start" : "";
                return true;
            }

            if (settingsOpen) {
                if (chineseButton.contains(x, y)) pressedControl = "zh";
                else if (englishButton.contains(x, y)) pressedControl = "en";
                else if (connectionButton.contains(x, y)) pressedControl = "connection";
                else if (settingsCloseButton.contains(x, y)) pressedControl = "close_settings";
                else pressedControl = "settings_overlay";
                return true;
            }

            if (settingsButton.contains(x, y)) {
                pressedControl = "open_settings";
                return true;
            }

            pressedControl = "world";
            return true;
        }

        if (event.getActionMasked() == MotionEvent.ACTION_UP) {
            if ("zh".equals(pressedControl) && chineseButton.contains(x, y)) {
                runtime.setLanguage(AppLanguage.ZH_TW);
                if (languageChangeListener != null) languageChangeListener.onLanguageChanged(AppLanguage.ZH_TW);
            } else if ("en".equals(pressedControl) && englishButton.contains(x, y)) {
                runtime.setLanguage(AppLanguage.EN);
                if (languageChangeListener != null) languageChangeListener.onLanguageChanged(AppLanguage.EN);
            } else if ("connection".equals(pressedControl) && connectionButton.contains(x, y)) {
                if (settingsTapListener != null) settingsTapListener.onSettingsTap();
            } else if ("close_settings".equals(pressedControl)) {
                settingsOpen = false;
                postInvalidateOnAnimation();
            } else if ("open_settings".equals(pressedControl) && settingsButton.contains(x, y)) {
                settingsOpen = true;
                postInvalidateOnAnimation();
            } else if ("start".equals(pressedControl) && startButton.contains(x, y)) {
                runtime.startGame();
            } else if ("world".equals(pressedControl) && runtime.isPlaying()) {
                RectF area = contentArea();
                float nx = clamp((x - area.left) / Math.max(1f, area.width()), 0f, 1f);
                float ny = clamp((y - area.top) / Math.max(1f, area.height()), 0f, 1f);
                performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                runtime.onWorldTap(nx, ny);
            }

            pressedControl = "";
            return true;
        }

        if (event.getActionMasked() == MotionEvent.ACTION_CANCEL) {
            pressedControl = "";
            return true;
        }

        return true;
    }

    private RectF contentArea() {
        float margin = dp(12);
        float left = insetLeft + margin;
        float top = insetTop + margin;
        float right = getWidth() - insetRight - margin;
        float bottom = getHeight() - insetBottom - margin;

        if (right <= left) {
            left = margin;
            right = getWidth() - margin;
        }
        if (bottom <= top) {
            top = margin;
            bottom = getHeight() - margin;
        }
        return new RectF(left, top, right, bottom);
    }

    private void drawCentered(Canvas canvas, String text, float cx, float baseline,
                              float maxWidth, Paint p) {
        if (text == null) text = "";
        float originalSize = p.getTextSize();
        while (p.measureText(text) > maxWidth && p.getTextSize() > sp(10)) {
            p.setTextSize(p.getTextSize() - sp(0.8f));
        }
        canvas.drawText(text, cx - p.measureText(text) / 2f, baseline, p);
        p.setTextSize(originalSize);
    }

    private String ellipsize(String text, float maxWidth, Paint p) {
        if (p.measureText(text) <= maxWidth) return text;
        String ellipsis = "…";
        int end = text.length();
        while (end > 1 && p.measureText(text.substring(0, end) + ellipsis) > maxWidth) end--;
        return text.substring(0, Math.max(1, end)) + ellipsis;
    }

    private float dp(float value) { return value * density; }
    private float sp(float value) { return value * scaledDensity; }

    private static float clamp(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }
}
