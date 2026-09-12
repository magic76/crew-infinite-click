package com.magic76.aiclicker;

import android.app.Activity;
import android.os.Build;
import android.view.DisplayCutout;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.WebView;

/**
 * 0.32 safe-area bridge.
 *
 * Keeps the WebView/full-screen background edge-to-edge, but moves native HUD/caption
 * out of system bars and sends CSS-pixel safe insets into window.GameSafeArea.
 *
 * Local agent: change this package to the app's package if needed.
 */
public final class SafeAreaInsetsController {
    private SafeAreaInsetsController() {}

    public static final class InsetsSnapshot {
        public final int leftPx;
        public final int topPx;
        public final int rightPx;
        public final int bottomPx;
        public final int leftCssPx;
        public final int topCssPx;
        public final int rightCssPx;
        public final int bottomCssPx;

        InsetsSnapshot(
                int leftPx, int topPx, int rightPx, int bottomPx,
                int leftCssPx, int topCssPx, int rightCssPx, int bottomCssPx) {
            this.leftPx = leftPx;
            this.topPx = topPx;
            this.rightPx = rightPx;
            this.bottomPx = bottomPx;
            this.leftCssPx = leftCssPx;
            this.topCssPx = topCssPx;
            this.rightCssPx = rightCssPx;
            this.bottomCssPx = bottomCssPx;
        }
    }

    public interface Listener {
        void onInsetsChanged(InsetsSnapshot insets);
    }

    public static void attach(
            final Activity activity,
            final View topHud,
            final View bottomCaption,
            final WebView webView) {
        attach(activity, topHud, bottomCaption, webView, null);
    }

    public static void attach(
            final Activity activity,
            final View topHud,
            final View bottomCaption,
            final WebView webView,
            final Listener listener) {

        if (activity == null) return;
        final View decor = activity.getWindow().getDecorView();
        final float density = activity.getResources().getDisplayMetrics().density;
        final int hudExtra = dp(activity, 8);
        final int captionExtra = dp(activity, 14);

        final MarginBase hudBase = MarginBase.capture(topHud);
        final MarginBase captionBase = MarginBase.capture(bottomCaption);

        decor.setOnApplyWindowInsetsListener((view, windowInsets) -> {
            int left;
            int top;
            int right;
            int bottom;

            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = windowInsets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                left = bars.left;
                top = bars.top;
                right = bars.right;
                bottom = bars.bottom;
            } else {
                left = windowInsets.getSystemWindowInsetLeft();
                top = windowInsets.getSystemWindowInsetTop();
                right = windowInsets.getSystemWindowInsetRight();
                bottom = windowInsets.getSystemWindowInsetBottom();

                if (Build.VERSION.SDK_INT >= 28) {
                    DisplayCutout cutout = windowInsets.getDisplayCutout();
                    if (cutout != null) {
                        left = Math.max(left, cutout.getSafeInsetLeft());
                        top = Math.max(top, cutout.getSafeInsetTop());
                        right = Math.max(right, cutout.getSafeInsetRight());
                        bottom = Math.max(bottom, cutout.getSafeInsetBottom());
                    }
                }
            }

            applyTopMargin(topHud, hudBase, top + hudExtra);
            applyBottomMargin(bottomCaption, captionBase, bottom + captionExtra);

            int leftCss = Math.round(left / density);
            int topCss = Math.round(top / density);
            int rightCss = Math.round(right / density);
            int bottomCss = Math.round(bottom / density);

            if (webView != null) {
                final String js = "window.GameSafeArea&&window.GameSafeArea.setInsets({"
                        + "left:" + leftCss + ","
                        + "top:" + topCss + ","
                        + "right:" + rightCss + ","
                        + "bottom:" + bottomCss
                        + "});";
                webView.post(() -> webView.evaluateJavascript(js, null));
            }

            if (listener != null) {
                listener.onInsetsChanged(new InsetsSnapshot(
                        left, top, right, bottom,
                        leftCss, topCss, rightCss, bottomCss));
            }
            return windowInsets;
        });

        decor.post(decor::requestApplyInsets);
    }

    private static void applyTopMargin(View view, MarginBase base, int safeMargin) {
        if (view == null || base == null) return;
        ViewGroup.LayoutParams raw = view.getLayoutParams();
        if (!(raw instanceof ViewGroup.MarginLayoutParams)) return;
        ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) raw;
        int next = Math.max(base.top, safeMargin);
        if (lp.topMargin != next) {
            lp.topMargin = next;
            view.setLayoutParams(lp);
        }
    }

    private static void applyBottomMargin(View view, MarginBase base, int safeMargin) {
        if (view == null || base == null) return;
        ViewGroup.LayoutParams raw = view.getLayoutParams();
        if (!(raw instanceof ViewGroup.MarginLayoutParams)) return;
        ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) raw;
        int next = Math.max(base.bottom, safeMargin);
        if (lp.bottomMargin != next) {
            lp.bottomMargin = next;
            view.setLayoutParams(lp);
        }
    }

    private static int dp(Activity activity, int value) {
        return Math.round(value * activity.getResources().getDisplayMetrics().density);
    }

    private static final class MarginBase {
        final int top;
        final int bottom;

        private MarginBase(int top, int bottom) {
            this.top = top;
            this.bottom = bottom;
        }

        static MarginBase capture(View view) {
            if (view == null) return null;
            ViewGroup.LayoutParams raw = view.getLayoutParams();
            if (!(raw instanceof ViewGroup.MarginLayoutParams)) return new MarginBase(0, 0);
            ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) raw;
            return new MarginBase(lp.topMargin, lp.bottomMargin);
        }
    }
}
