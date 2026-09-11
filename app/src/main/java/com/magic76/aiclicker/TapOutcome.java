package com.magic76.aiclicker;

final class TapOutcome {
    enum Kind { CORRECT, WRONG, NEUTRAL }

    final Kind kind;
    final int scoreDelta;
    final boolean breakCombo;
    final boolean consumeTarget;
    final String reason;

    private TapOutcome(Kind kind, int scoreDelta, boolean breakCombo, boolean consumeTarget, String reason) {
        this.kind = kind;
        this.scoreDelta = scoreDelta;
        this.breakCombo = breakCombo;
        this.consumeTarget = consumeTarget;
        this.reason = reason == null ? "" : reason;
    }

    static TapOutcome correct(int scoreDelta, String reason) {
        return new TapOutcome(Kind.CORRECT, scoreDelta, false, false, reason);
    }

    static TapOutcome wrong(int penalty, boolean consumeTarget, String reason) {
        return new TapOutcome(Kind.WRONG, -Math.abs(penalty), true, consumeTarget, reason);
    }

    static TapOutcome playfulWrong(int reward, boolean consumeTarget, String reason) {
        return new TapOutcome(Kind.WRONG, Math.max(0, reward), false, consumeTarget, reason);
    }

    static TapOutcome neutral(String reason) {
        return new TapOutcome(Kind.NEUTRAL, 0, false, false, reason);
    }
}
