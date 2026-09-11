package com.magic76.aiclicker;

import android.graphics.Color;
import org.json.JSONObject;

final class GameElement {
    static final String TYPE_BUTTON = "button";
    static final String TYPE_TEXT = "text";

    final String id;
    final String type;
    float x;
    float y;
    float width;
    float height;
    String text;
    boolean visible = true;
    // Target presentation/behavior metadata. Buttons remain a compatibility type; clickable UI is rendered as a Target.
    String shape = "pill";       // pill, circle, square, ring, dot, bar, diamond, cross
    String appearance = "solid"; // solid, outline, neon, ghost, glass
    String role = "real";        // real, decoy, danger, bonus
    String behavior = "static";  // static, evasive, shy, splitter, chameleon
    Style style;

    GameElement(String id, String type) {
        this.id = id;
        this.type = type;
        this.width = TYPE_BUTTON.equals(type) ? 0.34f : 0.82f;
        this.height = TYPE_BUTTON.equals(type) ? 0.105f : 0.10f;
        this.text = "";
        this.style = TYPE_BUTTON.equals(type) ? Style.defaultButton() : Style.defaultText();
    }

    GameElement copy(String newId) {
        GameElement e = new GameElement(newId, type);
        e.x = x;
        e.y = y;
        e.width = width;
        e.height = height;
        e.text = text;
        e.visible = visible;
        e.shape = shape;
        e.appearance = appearance;
        e.role = role;
        e.behavior = behavior;
        e.style = style.copy();
        return e;
    }

    JSONObject compactJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("id", id);
            o.put("type", type);
            o.put("x", round3(x));
            o.put("y", round3(y));
            o.put("w", round3(width));
            o.put("h", round3(height));
            if (text != null && !text.isEmpty()) o.put("text", text);
            if (!visible) o.put("visible", false);
            if (TYPE_BUTTON.equals(type)) {
                o.put("shape", shape);
                o.put("appearance", appearance);
                o.put("role", role);
                o.put("behavior", behavior);
            }
            o.put("background", style.backgroundHex);
            o.put("color", style.colorHex);
        } catch (Exception ignored) {}
        return o;
    }

    static final class Style {
        String colorHex = "#FFFFFF";
        String backgroundHex = "#E53935";
        int color = Color.WHITE;
        int background = Color.rgb(229, 57, 53);
        float fontSizeSp = 20f;
        float borderRadiusDp = 22f;
        float rotation = 0f;
        float alpha = 1f;

        static Style defaultButton() {
            return new Style();
        }

        static Style defaultText() {
            Style s = new Style();
            s.backgroundHex = "#00000000";
            s.background = Color.TRANSPARENT;
            s.fontSizeSp = 24f;
            s.borderRadiusDp = 0f;
            return s;
        }

        Style copy() {
            Style s = new Style();
            s.colorHex = colorHex;
            s.backgroundHex = backgroundHex;
            s.color = color;
            s.background = background;
            s.fontSizeSp = fontSizeSp;
            s.borderRadiusDp = borderRadiusDp;
            s.rotation = rotation;
            s.alpha = alpha;
            return s;
        }

        void merge(JSONObject styleJson) {
            if (styleJson == null) return;
            String colorString = safeColor(styleJson.optString("color", ""));
            if (!colorString.isEmpty()) {
                colorHex = colorString;
                color = Color.parseColor(colorString);
            }
            String bgString = safeColor(styleJson.optString("background", ""));
            if (!bgString.isEmpty()) {
                backgroundHex = bgString;
                background = Color.parseColor(bgString);
            }
            if (styleJson.has("fontSize")) {
                fontSizeSp = clamp((float) styleJson.optDouble("fontSize", fontSizeSp), 11f, 64f);
            }
            if (styleJson.has("borderRadius")) {
                borderRadiusDp = clamp((float) styleJson.optDouble("borderRadius", borderRadiusDp), 0f, 60f);
            }
            if (styleJson.has("rotation")) {
                rotation = clamp((float) styleJson.optDouble("rotation", rotation), -180f, 180f);
            }
            if (styleJson.has("alpha")) {
                alpha = clamp((float) styleJson.optDouble("alpha", alpha), 0.1f, 1f);
            }
        }

        private static String safeColor(String value) {
            if (value == null) return "";
            value = value.trim();
            if (!value.matches("#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?")) return "";
            if (value.length() == 9) {
                // Android #AARRGGBB, model typically sends #RRGGBBAA. Keep MVP strict.
                return "";
            }
            return value.toUpperCase();
        }
    }

    private static float clamp(float v, float min, float max) { return Math.max(min, Math.min(max, v)); }
    private static double round3(float v) { return Math.round(v * 1000.0) / 1000.0; }
}
