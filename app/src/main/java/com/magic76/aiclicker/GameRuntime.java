package com.magic76.aiclicker;

import android.content.Context;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Random;

/**
 * 0.16 Living Canvas runtime.
 *
 * The product invariant is intentionally small:
 * - there is one persistent high-level ScenePlan
 * - every screen tap is valid
 * - local rendering reacts immediately
 * - Gemini evolves the high-level world asynchronously
 */
final class GameRuntime {
    interface EventSink { void onEvent(GameEvent event); }
    interface StateSink { void onGameEnded(String reason); }

    enum GameState { START, PLAYING, RESULT }

    private static final int MAX_RECENT_EVENTS = 12;
    private static final int MAX_TAP_SAMPLES = 20;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Random random = new Random();
    private final GameView view;
    private final EventSink eventSink;
    @SuppressWarnings("unused")
    private final StateSink stateSink;

    private final MomentumEngine momentumEngine = new MomentumEngine();
    private final PlayerProfile playerProfile = new PlayerProfile();
    private final ArrayDeque<JSONObject> recentEvents = new ArrayDeque<>();
    private final ArrayDeque<TapSample> tapSamples = new ArrayDeque<>();

    private GameState gameState = GameState.START;
    private AppLanguage language = AppLanguage.ZH_TW;
    private String sessionId = "";
    private long sessionSerial = 0L;
    private long sessionStartedAt = 0L;
    private long lastTapAt = 0L;
    private long semanticStateVersion = 1L;
    private int worldRevision = 0;
    private int runClicks = 0;
    private int bestTapStreak = 0;
    private String endReason = "";

    private Runnable worldEvolutionCallback;

    GameRuntime(Context context, GameView view, EventSink eventSink, StateSink stateSink) {
        this.view = view;
        this.eventSink = eventSink;
        this.stateSink = stateSink;
    }

    void initializeDefaultScene() {
        startGame();
    }

    void sendLiveReadyEvent() {
        if (isPlaying()) dispatchEvent(GameEvent.start());
    }

    void showStartScreen() {
        cancelWorldEvolution();
        gameState = GameState.START;
        sessionId = "";
        sessionStartedAt = 0L;
        lastTapAt = 0L;
        runClicks = 0;
        bestTapStreak = 0;
        worldRevision = 0;
        endReason = "";
        semanticStateVersion++;
        recentEvents.clear();
        tapSamples.clear();
        momentumEngine.reset();
        view.clearTransientState();
        view.invalidate();
    }

    void startGame() {
        if (gameState == GameState.PLAYING) return;

        cancelWorldEvolution();
        gameState = GameState.PLAYING;
        sessionStartedAt = System.currentTimeMillis();
        lastTapAt = 0L;
        runClicks = 0;
        bestTapStreak = 0;
        worldRevision = 0;
        endReason = "";
        semanticStateVersion++;
        recentEvents.clear();
        tapSamples.clear();
        momentumEngine.reset();

        sessionId = "world_" + (++sessionSerial) + "_" + sessionStartedAt;

        view.clearTransientState();
        view.applyScenePlan(ScenePlan.defaultPlan());
        view.setAiCaption(text("摸摸看，這個世界會記住你。", "Touch the world. It will remember you."));
        view.invalidate();

        scheduleWorldEvolution(6_500L);
        dispatchEvent(GameEvent.start());
    }

    void onWorldTap(float normalizedX, float normalizedY) {
        if (!isPlaying()) return;

        long now = System.currentTimeMillis();
        float x = clamp(normalizedX, 0f, 1f);
        float y = clamp(normalizedY, 0f, 1f);
        long interval = lastTapAt <= 0L ? -1L : Math.max(0L, now - lastTapAt);
        lastTapAt = now;

        runClicks++;
        playerProfile.totalClicks++;
        playerProfile.recordReaction(interval);
        momentumEngine.recordTap(now, true);
        bestTapStreak = Math.max(bestTapStreak, momentumEngine.fastStreak());
        if (momentumEngine.fastStreak() >= 4 && momentumEngine.fastStreak() % 4 == 0) playerProfile.rageClickCount++;

        tapSamples.addLast(new TapSample(x, y, now));
        while (tapSamples.size() > MAX_TAP_SAMPLES) tapSamples.removeFirst();

        // Always respond locally before any network/model work.
        view.onGameTap(x, y);

        dispatchEvent(GameEvent.worldTap(x, y, interval));
    }

    JSONObject buildContextEnvelope(GameEvent event) {
        JSONObject root = new JSONObject();
        try {
            long now = System.currentTimeMillis();
            root.put("event", event.toJson());
            root.put("sessionId", sessionId);
            root.put("gameState", gameState.name());
            root.put("language", language.code);
            root.put("stateVersion", semanticStateVersion);
            root.put("sessionAgeMs", sessionStartedAt <= 0L ? 0L : Math.max(0L, now - sessionStartedAt));
            root.put("runClicks", runClicks);
            root.put("engagementState", engagementState(now));
            root.put("sceneRevision", worldRevision);

            String voiceCue = "SILENT_OK";
            if ("start".equals(event.type)) {
                voiceCue = "REQUIRED";
            } else if ("world_tap".equals(event.type)
                    && (runClicks == 10 || runClicks == 25 || runClicks == 50 || (runClicks > 0 && runClicks % 75 == 0))) {
                voiceCue = "ENCOURAGED";
            } else if ("world_tick".equals(event.type) && worldRevision > 0 && worldRevision % 4 == 0) {
                voiceCue = "ENCOURAGED";
            }
            root.put("voiceCue", voiceCue);

            ScenePlan current = view.currentScenePlan();
            if (current != null) root.put("scenePlan", current.toJson());

            root.put("momentum", momentumEngine.toJson(now));
            root.put("clickSpeed", momentumEngine.speedJson(now));
            root.put("tapPattern", buildTapPattern());
            root.put("playerProfile", playerProfile.toJson());

            JSONArray events = new JSONArray();
            for (JSONObject recent : recentEvents) events.put(recent);
            root.put("recentEvents", events);
        } catch (Exception ignored) {}
        return root;
    }

    void applyTurn(JSONObject args) {
        applyTurnInternal(args);
    }

    void applyLocalTurn(JSONObject args) {
        applyTurnInternal(args);
    }

    private void applyTurnInternal(JSONObject args) {
        if (args == null || !isPlaying()) return;

        String speech = safeText(args.optString("speech", ""), 200);
        if (!speech.isEmpty()) view.setAiCaption(speech);

        ScenePlan plan = ScenePlan.parse(args);
        if (plan != null) {
            view.applyScenePlan(plan);
            worldRevision++;
            semanticStateVersion++;
        }

        InteractionPlan interaction = InteractionPlan.parse(args);
        if (interaction != null) {
            view.applyInteraction(interaction);
        }

        // Optional exceptional screen/audio punctuation. No arbitrary UI or code is accepted.
        JSONArray actions = args.optJSONArray("actions");
        if (actions != null) {
            int count = Math.min(3, actions.length());
            for (int i = 0; i < count; i++) {
                JSONObject action = actions.optJSONObject(i);
                if (action == null) continue;
                String type = action.optString("type", "");
                if ("shakeScreen".equals(type) || "screen_shake".equals(type)) {
                    float intensity = clamp((float)action.optDouble("strength", action.optDouble("intensity", 0.12)), 0.04f, 0.45f);
                    long duration = clampLong(action.optLong("durationMs", 120L), 60L, 600L);
                    view.shake(intensity, duration);
                } else if ("flashScreen".equals(type) || "flash".equals(type)) {
                    String hex = action.optString("color", "#FFFFFF");
                    int color = Color.WHITE;
                    try { color = Color.parseColor(hex); } catch (Exception ignored) {}
                    long duration = clampLong(action.optLong("durationMs", 90L), 40L, 500L);
                    view.flash(color, duration);
                } else if (isVisualAction(type)) {
                    view.playVisualAction(action);
                }
            }
        }

        view.invalidate();
    }

    private boolean isVisualAction(String type) {
        return "particle_burst".equals(type) || "shockwave".equals(type) || "portal".equals(type)
                || "black_hole".equals(type) || "gravity_pull".equals(type) || "world_crack".equals(type)
                || "glitch".equals(type) || "swarm".equals(type) || "dissolve".equals(type)
                || "sound".equals(type);
    }

    private JSONObject buildTapPattern() {
        JSONObject o = new JSONObject();
        try {
            if (tapSamples.isEmpty()) {
                o.put("count", 0);
                o.put("spread", 0.0);
                o.put("dominantArea", "NONE");
                return o;
            }

            double sx = 0.0, sy = 0.0;
            int[] quadrants = new int[4];
            for (TapSample s : tapSamples) {
                sx += s.x;
                sy += s.y;
                int q = (s.y >= 0.5f ? 2 : 0) + (s.x >= 0.5f ? 1 : 0);
                quadrants[q]++;
            }

            double cx = sx / tapSamples.size();
            double cy = sy / tapSamples.size();
            double variance = 0.0;
            for (TapSample s : tapSamples) {
                double dx = s.x - cx;
                double dy = s.y - cy;
                variance += dx * dx + dy * dy;
            }
            variance /= tapSamples.size();

            int dominant = 0;
            for (int i = 1; i < quadrants.length; i++) {
                if (quadrants[i] > quadrants[dominant]) dominant = i;
            }
            String[] names = {"TOP_LEFT", "TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_RIGHT"};

            TapSample last = tapSamples.peekLast();
            o.put("count", tapSamples.size());
            o.put("centroidX", round3(cx));
            o.put("centroidY", round3(cy));
            o.put("spread", round3(Math.sqrt(variance)));
            o.put("dominantArea", names[dominant]);
            o.put("dominantShare", round2(quadrants[dominant] / (double)tapSamples.size()));
            if (last != null) {
                o.put("lastX", round3(last.x));
                o.put("lastY", round3(last.y));
            }

            if (tapSamples.size() >= 3) {
                List<TapSample> samples = new ArrayList<>(tapSamples);
                double totalInterval = 0.0;
                int intervalCount = 0;
                for (int i = 1; i < samples.size(); i++) {
                    long dt = samples.get(i).at - samples.get(i - 1).at;
                    if (dt > 0L && dt < 5_000L) {
                        totalInterval += dt;
                        intervalCount++;
                    }
                }
                if (intervalCount > 0) {
                    double avg = totalInterval / intervalCount;
                    double jitterSq = 0.0;
                    int jitterCount = 0;
                    for (int i = 1; i < samples.size(); i++) {
                        long dt = samples.get(i).at - samples.get(i - 1).at;
                        if (dt > 0L && dt < 5_000L) {
                            double diff = dt - avg;
                            jitterSq += diff * diff;
                            jitterCount++;
                        }
                    }
                    o.put("avgIntervalMs", Math.round(avg));
                    o.put("intervalJitterMs", Math.round(Math.sqrt(jitterSq / Math.max(1, jitterCount))));
                }
            }
        } catch (Exception ignored) {}
        return o;
    }

    private void scheduleWorldEvolution(long delayMs) {
        cancelWorldEvolution();
        worldEvolutionCallback = () -> {
            worldEvolutionCallback = null;
            if (!isPlaying()) return;
            dispatchEvent(GameEvent.worldTick());
            scheduleWorldEvolution(6_000L + random.nextInt(3_500));
        };
        mainHandler.postDelayed(worldEvolutionCallback, Math.max(2_500L, delayMs));
    }

    private void cancelWorldEvolution() {
        if (worldEvolutionCallback != null) {
            mainHandler.removeCallbacks(worldEvolutionCallback);
            worldEvolutionCallback = null;
        }
    }

    private void dispatchEvent(GameEvent event) {
        if (!isPlaying() || event == null) return;
        recentEvents.addLast(event.toJson());
        while (recentEvents.size() > MAX_RECENT_EVENTS) recentEvents.removeFirst();
        if (eventSink != null) eventSink.onEvent(event);
    }

    private String engagementState(long now) {
        if (!isPlaying()) return "CALM";
        if (runClicks == 0) return "OBSERVING";

        long hesitation = momentumEngine.hesitationMs(now);
        if (hesitation > 4_000L) return "OBSERVING";

        double flow = momentumEngine.value(now);
        if (flow >= 0.82) return "FRENZY";
        if (flow >= 0.56) return "ENGAGED";
        if (flow >= 0.28) return "CURIOUS";
        return "CALM";
    }

    GameState getGameState() { return gameState; }
    boolean isPlaying() { return gameState == GameState.PLAYING; }

    AppLanguage getLanguage() { return language; }
    void setLanguage(AppLanguage value) {
        language = value == null ? AppLanguage.ZH_TW : value;
        view.setLanguage(language);
    }
    String text(String zh, String en) { return language.pick(zh, en); }

    String getSessionId() { return sessionId; }
    String getEndReason() { return endReason; }
    int getRunClicks() { return runClicks; }
    int getScore() { return runClicks; }
    int getBestCombo() { return Math.max(bestTapStreak, runClicks == 0 ? 0 : 1); }
    String getFlowState() { return momentumEngine.flowState(System.currentTimeMillis()); }
    double getMomentum() { return momentumEngine.value(System.currentTimeMillis()); }
    double getClickRate() { return momentumEngine.clickRatePerSecond(); }
    double getPeakClickRate() { return momentumEngine.peakClickRatePerSecond(); }
    ScenePlan getCurrentScenePlan() { return view.currentScenePlan(); }

    private static String safeText(String value, int max) {
        if (value == null) return "";
        String clean = value.replace('\n', ' ').replace('\r', ' ').trim();
        return clean.length() <= max ? clean : clean.substring(0, max);
    }

    private static float clamp(float v, float min, float max) {
        return Math.max(min, Math.min(max, v));
    }
    private static long clampLong(long v, long min, long max) {
        return Math.max(min, Math.min(max, v));
    }
    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
    private static double round3(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }

    private static final class TapSample {
        final float x;
        final float y;
        final long at;

        TapSample(float x, float y, long at) {
            this.x = x;
            this.y = y;
            this.at = at;
        }
    }
}
