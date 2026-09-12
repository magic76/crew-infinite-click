package com.magic76.aiclicker;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

/**
 * Thin Android shell over the PixiJS canvas. No Android draw loop.
 * Native code owns Gemini/session/security; Pixi owns every frame and every visual effect.
 */
final class GameView extends FrameLayout {
    interface SettingsTapListener { void onSettingsTap(); }
    interface LanguageChangeListener { void onLanguageChanged(AppLanguage language); }

    private final WebView webView;
    private final TextView statusView;
    private final TextView captionView;
    private final TextView zhButton;
    private final TextView enButton;
    private final TextView settingsButton;
    private final LayoutParams topLayoutParams;
    private final LayoutParams captionLayoutParams;
    private GameRuntime runtime;
    private SettingsTapListener settingsTapListener;
    private LanguageChangeListener languageChangeListener;
    private AppLanguage language = AppLanguage.ZH_TW;
    private ScenePlan currentPlan = ScenePlan.defaultPlan();
    private boolean rendererReady = false;
    private String connectionStatus = "DEMO";
    private int insetLeftPx;
    private int insetTopPx;
    private int insetRightPx;
    private int insetBottomPx;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    GameView(Context context) {
        super(context);
        setBackgroundColor(Color.BLACK);

        webView = new WebView(context);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setBackgroundColor(Color.BLACK);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.addJavascriptInterface(new JsBridge(), "AndroidGame");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request == null || request.getUrl() == null ? "" : request.getUrl().toString();
                return !(url.startsWith("file:///android_asset/") || url.startsWith("https://cdn.jsdelivr.net/npm/pixi.js@"));
            }
        });
        addView(webView, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));

        LinearLayout top = new LinearLayout(context);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(12), dp(8), dp(12), dp(8));
        GradientDrawable topBg = new GradientDrawable();
        topBg.setColor(Color.argb(105, 5, 7, 12));
        topBg.setCornerRadius(dp(18));
        top.setBackground(topBg);

        statusView = chip("BOOT");
        top.addView(statusView, wrap());
        top.addView(spacer(), new LinearLayout.LayoutParams(0, 1, 1f));
        zhButton = chip("中");
        enButton = chip("EN");
        settingsButton = chip("⚙");
        top.addView(zhButton, wrapWithRight(6));
        top.addView(enButton, wrapWithRight(6));
        top.addView(settingsButton, wrap());
        topLayoutParams = new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.TOP);
        topLayoutParams.setMargins(dp(10), dp(8), dp(10), 0);
        addView(top, topLayoutParams);

        captionView = new TextView(context);
        captionView.setTextColor(Color.WHITE);
        captionView.setTextSize(18f);
        captionView.setGravity(Gravity.CENTER);
        captionView.setShadowLayer(12f, 0, 2, Color.BLACK);
        captionView.setMaxLines(3);
        captionView.setPadding(dp(22), dp(12), dp(22), dp(12));
        captionLayoutParams = new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        captionLayoutParams.setMargins(dp(12), 0, dp(12), dp(24));
        addView(captionView, captionLayoutParams);

        setOnApplyWindowInsetsListener((v, insets) -> {
            applySystemInsets(insets);
            return insets;
        });
        post(this::requestApplyInsets);

        zhButton.setOnClickListener(v -> chooseLanguage(AppLanguage.ZH_TW));
        enButton.setOnClickListener(v -> chooseLanguage(AppLanguage.EN));
        settingsButton.setOnClickListener(v -> { if (settingsTapListener != null) settingsTapListener.onSettingsTap(); });
        updateLanguageChips();

        webView.loadUrl("file:///android_asset/game/index.html");
    }

    void setRuntime(GameRuntime runtime) { this.runtime = runtime; }
    void setSettingsTapListener(SettingsTapListener listener) { this.settingsTapListener = listener; }
    void setLanguageChangeListener(LanguageChangeListener listener) { this.languageChangeListener = listener; }

    void setLanguage(AppLanguage value) {
        language = value == null ? AppLanguage.ZH_TW : value;
        updateLanguageChips();
        JSONObject o = command("language");
        try { o.put("value", language.code); } catch (Exception ignored) {}
        send(o);
    }

    void setConnectionStatus(String status) {
        connectionStatus = status == null || status.trim().isEmpty() ? "DEMO" : status.trim();
        post(() -> statusView.setText(rendererReady ? connectionStatus : "PIXI " + connectionStatus));
    }

    void setAiCaption(String caption) {
        post(() -> captionView.setText(caption == null ? "" : caption));
    }

    void clearTransientState() { send(command("reset")); }
    ScenePlan currentScenePlan() { return currentPlan; }

    void applyScenePlan(ScenePlan plan) {
        if (plan == null) return;
        currentPlan = plan;
        JSONObject o = command("scenePlan");
        try { o.put("plan", plan.toJson()); } catch (Exception ignored) {}
        send(o);
    }

    void applyInteraction(InteractionPlan plan) {
        if (plan == null) return;
        JSONObject o = command("interaction");
        try { o.put("interaction", plan.toJson()); } catch (Exception ignored) {}
        send(o);
    }

    void onGameTap(float x, float y) {
        performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
    }

    void shake(float intensity, long durationMs) {
        JSONObject o = command("action");
        try { o.put("action", new JSONObject().put("type", "screen_shake").put("strength", intensity).put("durationMs", durationMs)); } catch (Exception ignored) {}
        send(o);
    }

    void flash(int color, long durationMs) {
        JSONObject o = command("action");
        try { o.put("action", new JSONObject().put("type", "flash").put("color", String.format("#%06X", 0xFFFFFF & color)).put("durationMs", durationMs)); } catch (Exception ignored) {}
        send(o);
    }

    void playVisualAction(JSONObject action) {
        if (action == null) return;
        JSONObject o = command("action");
        try { o.put("action", action); } catch (Exception ignored) {}
        send(o);
    }

    private void applySystemInsets(WindowInsets insets) {
        if (insets == null) return;
        insetLeftPx = Math.max(0, insets.getSystemWindowInsetLeft());
        insetTopPx = Math.max(0, insets.getSystemWindowInsetTop());
        insetRightPx = Math.max(0, insets.getSystemWindowInsetRight());
        insetBottomPx = Math.max(0, insets.getSystemWindowInsetBottom());

        topLayoutParams.setMargins(insetLeftPx + dp(10), insetTopPx + dp(8), insetRightPx + dp(10), 0);
        captionLayoutParams.setMargins(insetLeftPx + dp(12), 0, insetRightPx + dp(12), insetBottomPx + dp(24));
        requestLayout();
        sendSafeArea();
    }

    private void sendSafeArea() {
        float density = Math.max(1f, getResources().getDisplayMetrics().density);
        JSONObject o = command("safeArea");
        try {
            o.put("left", insetLeftPx / density);
            o.put("top", insetTopPx / density);
            o.put("right", insetRightPx / density);
            o.put("bottom", insetBottomPx / density);
        } catch (Exception ignored) {}
        send(o);
    }

    private void chooseLanguage(AppLanguage next) {
        if (next == language) return;
        setLanguage(next);
        if (languageChangeListener != null) languageChangeListener.onLanguageChanged(next);
    }

    private void updateLanguageChips() {
        zhButton.setAlpha(language == AppLanguage.ZH_TW ? 1f : 0.45f);
        enButton.setAlpha(language == AppLanguage.EN ? 1f : 0.45f);
    }

    private JSONObject command(String op) {
        JSONObject o = new JSONObject();
        try { o.put("op", op); } catch (Exception ignored) {}
        return o;
    }

    private void send(JSONObject payload) {
        if (payload == null) return;
        String quoted = JSONObject.quote(payload.toString());
        post(() -> webView.evaluateJavascript("window.InfiniteClick&&window.InfiniteClick.receive(JSON.parse(" + quoted + "));", null));
    }

    void onHostPause() { webView.onPause(); }
    void onHostResume() { webView.onResume(); requestApplyInsets(); }

    @Override protected void onDetachedFromWindow() {
        webView.removeJavascriptInterface("AndroidGame");
        webView.destroy();
        super.onDetachedFromWindow();
    }

    private final class JsBridge {
        @JavascriptInterface public void onRendererReady(String renderer) {
            post(() -> {
                rendererReady = true;
                statusView.setText(connectionStatus);
                JSONObject o = command("scenePlan");
                try { o.put("plan", currentPlan.toJson()); } catch (Exception ignored) {}
                send(o);
                JSONObject lang = command("language");
                try { lang.put("value", language.code); } catch (Exception ignored) {}
                send(lang);
                sendSafeArea();
            });
        }
        @JavascriptInterface public void onRendererError(String message) {
            post(() -> {
                rendererReady = false;
                statusView.setText("RENDER ERROR");
                captionView.setText("Pixi renderer error: " + (message == null ? "unknown" : message));
            });
        }
        @JavascriptInterface public void onTap(double x, double y) {
            post(() -> {
                GameRuntime r = runtime;
                if (r != null) r.onWorldTap((float)x, (float)y);
            });
        }
    }

    private TextView chip(String text) {
        TextView v = new TextView(getContext());
        v.setText(text); v.setTextColor(Color.WHITE); v.setTextSize(12f); v.setGravity(Gravity.CENTER);
        v.setPadding(dp(10), dp(7), dp(10), dp(7));
        GradientDrawable bg = new GradientDrawable(); bg.setColor(Color.argb(95, 255, 255, 255)); bg.setCornerRadius(dp(14));
        v.setBackground(bg); return v;
    }
    private View spacer() { return new View(getContext()); }
    private LinearLayout.LayoutParams wrap() { return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); }
    private LinearLayout.LayoutParams wrapWithRight(int right) { LinearLayout.LayoutParams p = wrap(); p.rightMargin = dp(right); return p; }
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
}
