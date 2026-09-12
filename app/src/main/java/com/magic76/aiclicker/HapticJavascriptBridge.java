package com.magic76.aiclicker;

import android.webkit.JavascriptInterface;

/** Register as WebView interface name "AndroidHaptics". */
public final class HapticJavascriptBridge {
    private final HapticEngine engine;

    public HapticJavascriptBridge(HapticEngine engine) {
        this.engine = engine;
    }

    @JavascriptInterface
    public void perform(String cue, double intensity) {
        if (engine != null) engine.perform(cue, intensity);
    }
}
