package com.magic76.aiclicker;

enum AppLanguage {
    ZH_TW("zh-TW"),
    EN("en-US");

    final String code;

    AppLanguage(String code) {
        this.code = code;
    }

    static AppLanguage fromCode(String value) {
        if (value == null) return ZH_TW;
        String v = value.trim().toLowerCase(java.util.Locale.ROOT);
        if (v.startsWith("en")) return EN;
        return ZH_TW;
    }

    String pick(String zh, String en) {
        return this == EN ? en : zh;
    }
}
