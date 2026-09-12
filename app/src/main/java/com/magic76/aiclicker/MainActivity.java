package com.magic76.aiclicker;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.Log;
import android.view.View;
import android.view.Window;

import android.view.WindowManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentActivity;

import org.godotengine.godot.Godot;
import org.godotengine.godot.GodotFragment;
import org.godotengine.godot.GodotHost;
import org.godotengine.godot.plugin.GodotPlugin;

import java.util.Collections;
import java.util.Set;

public final class MainActivity extends FragmentActivity implements GodotHost {
    private static final String TAG = "InfiniteClickGodot";
    private static final String PREFS = "ai_infinite_click";
    private static final String KEY_API = "gemini_api_key";
    private static final String KEY_LANGUAGE = "game_language";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final LocalDirector localDirector = new LocalDirector();

    private GameView gameView;
    private GodotWorldBridge godotWorldBridge;
    private GodotFragment godotFragment;
    private VisualBridgePlugin visualBridgePlugin;
    private Godot pluginGodot;
    private GameRuntime runtime;
    private GeminiLiveClient liveClient;
    private SharedPreferences prefs;
    private QueuedEvent activeEvent;
    private PendingInteraction pendingInteraction;
    private final StringBuilder transcriptBuffer = new StringBuilder();
    private boolean waitingForTurn = false;
    private boolean activeTurnApplied = false;
    private int reconnectAttempts = 0;
    private Runnable turnWatchdog;
    private Runnable completionWatchdog;
    private boolean destroyed = false;
    private long nextTurnId = 1L;
    private boolean activeTurnHadVoice = false;
    private String activeTurnSpeech = "";
    private AppLanguage currentLanguage = AppLanguage.ZH_TW;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        configureSystemBars();

        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        currentLanguage = AppLanguage.fromCode(prefs.getString(KEY_LANGUAGE, AppLanguage.ZH_TW.code));

        FrameLayout root = new FrameLayout(this);
        FrameLayout godotContainer = new FrameLayout(this);
        godotContainer.setId(R.id.godot_fragment_container);
        godotContainer.setBackgroundColor(Color.BLACK);
        root.addView(godotContainer, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        godotWorldBridge = new GodotWorldBridge();
        gameView = new GameView(this);
        gameView.setWorldSurface(godotWorldBridge);
        godotWorldBridge.setStateListener(() -> gameView.postInvalidateOnAnimation());
        root.addView(gameView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // GodotFragment owns the engine/render-surface lifecycle. Android keeps the HUD,
        // Gemini Live and deterministic gameplay as an overlay above it.
        setContentView(root);
        attachGodotFragment();

        runtime = new GameRuntime(this, gameView, this::onRuntimeEvent, this::onGameEnded);
        runtime.setLanguage(currentLanguage);
        gameView.setRuntime(runtime);
        gameView.setSettingsTapListener(this::showApiKeyDialog);
        gameView.setLanguageChangeListener(this::onLanguageChanged);

        runtime.initializeDefaultScene();
        String key = prefs.getString(KEY_API, "");
        if (key != null && !key.trim().isEmpty()) {
            connectLive(key.trim(), false);
        } else {
            gameView.setConnectionStatus("DEMO");
        }
    }

    private void attachGodotFragment() {
        Fragment existing = getSupportFragmentManager().findFragmentById(R.id.godot_fragment_container);
        if (existing instanceof GodotFragment) {
            godotFragment = (GodotFragment) existing;
            return;
        }

        godotFragment = new GodotFragment();
        getSupportFragmentManager()
                .beginTransaction()
                .replace(R.id.godot_fragment_container, godotFragment)
                .commitNowAllowingStateLoss();
    }

    @Override public Activity getActivity() {
        return this;
    }

    @Override public Godot getGodot() {
        return godotFragment == null ? null : godotFragment.getGodot();
    }

    @Override public Set<GodotPlugin> getHostPlugins(Godot godot) {
        if (visualBridgePlugin == null || pluginGodot != godot) {
            pluginGodot = godot;
            visualBridgePlugin = new VisualBridgePlugin(godot, godotWorldBridge);
            if (godotWorldBridge != null) godotWorldBridge.attachPlugin(visualBridgePlugin);
        }
        return Collections.<GodotPlugin>singleton(visualBridgePlugin);
    }

    @Override public void onGodotSetupCompleted() {
        Log.i(TAG, "Godot setup completed");
        if (godotWorldBridge != null) godotWorldBridge.onGodotSetupCompleted();
    }

    @Override public void onGodotMainLoopStarted() {
        Log.i(TAG, "Godot main loop started (GodotHost callback)");
        // GodotFragment explicitly forwards this lifecycle callback to its parent GodotHost.
        // Use the host callback as the authoritative engine-start signal instead of depending
        // only on the runtime plugin lifecycle callback.
        if (godotWorldBridge != null) godotWorldBridge.onGodotMainLoopStarted();
    }

    private void onLanguageChanged(AppLanguage language) {
        currentLanguage = language == null ? AppLanguage.ZH_TW : language;
        prefs.edit().putString(KEY_LANGUAGE, currentLanguage.code).apply();
        runtime.setLanguage(currentLanguage);
    }

    @Override protected void onResume() {
        super.onResume();
        configureSystemBars();
    }

    @Override protected void onPause() {
        super.onPause();
    }

    @Override protected void onDestroy() {
        destroyed = true;
        if (turnWatchdog != null) mainHandler.removeCallbacks(turnWatchdog);
        if (completionWatchdog != null) mainHandler.removeCallbacks(completionWatchdog);
        if (liveClient != null) liveClient.close();
        if (godotWorldBridge != null) godotWorldBridge.destroy();
        visualBridgePlugin = null;
        pluginGodot = null;
        super.onDestroy();
    }

    private void onGameEnded(String reason) {
        waitingForTurn = false;
        activeTurnApplied = false;
        activeEvent = null;
        pendingInteraction = null;
        activeTurnSpeech = "";
        activeTurnHadVoice = false;
        transcriptBuffer.setLength(0);
        if (turnWatchdog != null) mainHandler.removeCallbacks(turnWatchdog);
        turnWatchdog = null;
        if (completionWatchdog != null) mainHandler.removeCallbacks(completionWatchdog);
        completionWatchdog = null;
        GeminiLiveClient c = liveClient;
        if (c != null) c.suppressCurrentTurnAudio();
        gameView.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS);
    }

    private void onRuntimeEvent(GameEvent event) {
        if (!runtime.isPlaying()) return;
        if (waitingForTurn) {
            if (pendingInteraction == null) pendingInteraction = new PendingInteraction();
            pendingInteraction.record(event);
            return;
        }
        beginEvent(buildQueuedEvent(event, null));
    }

    private QueuedEvent buildQueuedEvent(GameEvent event, PendingInteraction aggregate) {
        JSONObject context = runtime.buildContextEnvelope(event);
        if (aggregate != null) aggregate.attachTo(context);
        long turnId = nextTurnId++;
        try { context.put("turnId", turnId); } catch (Exception ignored) {}
        return new QueuedEvent(event, context, runtime.getSessionId(), turnId);
    }

    private void beginEvent(QueuedEvent queued) {
        if (destroyed || queued == null || !runtime.isPlaying()) return;
        if (!queued.sessionId.equals(runtime.getSessionId())) return;
        waitingForTurn = true;
        activeTurnApplied = false;
        activeEvent = queued;
        transcriptBuffer.setLength(0);
        activeTurnHadVoice = false;
        activeTurnSpeech = "";

        GeminiLiveClient client = liveClient;
        if (client != null && client.isReady() && client.sendEvent(queued.context)) {
            armTurnWatchdog();
            return;
        }
        applyLocalFallback(queued, 90L);
    }

    private void armTurnWatchdog() {
        if (turnWatchdog != null) mainHandler.removeCallbacks(turnWatchdog);
        turnWatchdog = () -> {
            if (!waitingForTurn || activeEvent == null) return;
            if (!activeTurnApplied) {
                // UI/gameplay must never wait for Live. Only the visual turn falls back locally.
                applyLocalFallback(activeEvent, 0L);
            }
            // Once the Live tool has arrived, onTurnComplete owns completion so native audio
            // can finish naturally. We never replace it with Android TTS.
        };
        mainHandler.postDelayed(turnWatchdog, 2_500L);
    }

    private void armCompletionWatchdog() {
        if (completionWatchdog != null) mainHandler.removeCallbacks(completionWatchdog);
        completionWatchdog = () -> {
            if (waitingForTurn && activeTurnApplied) {
                // Never synthesize speech here. This only prevents a rare missing turnComplete
                // from blocking future player events.
                finishActiveEvent();
            }
        };
        mainHandler.postDelayed(completionWatchdog, 6_000L);
    }

    private void applyLocalFallback(QueuedEvent queued, long delayMs) {
        mainHandler.postDelayed(() -> {
            if (!waitingForTurn || activeEvent != queued) return;
            if (!queued.sessionId.equals(runtime.getSessionId())) return;
            JSONObject turn = localDirector.respond(queued.event, queued.context);
            activeTurnSpeech = turn.optString("speech", "");
            runtime.applyLocalTurn(turn);
            activeTurnApplied = true;
            activeTurnHadVoice = false;
            if (!activeTurnSpeech.trim().isEmpty()) gameView.setAiCaption(activeTurnSpeech);
            finishActiveEvent();
        }, delayMs);
    }

    private void finishActiveEvent() {
        if (!waitingForTurn) return;
        waitingForTurn = false;
        activeTurnApplied = false;
        activeEvent = null;
        if (turnWatchdog != null) mainHandler.removeCallbacks(turnWatchdog);
        turnWatchdog = null;
        if (completionWatchdog != null) mainHandler.removeCallbacks(completionWatchdog);
        completionWatchdog = null;
        PendingInteraction pending = pendingInteraction;
        pendingInteraction = null;
        if (!runtime.isPlaying()) return;
        if (pending != null && pending.latestEvent != null) {
            QueuedEvent next = buildQueuedEvent(pending.latestEvent, pending);
            mainHandler.post(() -> beginEvent(next));
        }
    }

    private void connectLive(String key, boolean userInitiated) {
        if (destroyed || key == null || key.trim().isEmpty()) return;
        if (liveClient != null) liveClient.close();
        gameView.setConnectionStatus("CONNECTING");
        if (userInitiated) reconnectAttempts = 0;

        liveClient = new GeminiLiveClient(key.trim(), new GeminiLiveClient.Listener() {
            @Override public void onReady() {
                mainHandler.post(() -> {
                    reconnectAttempts = 0;
                    gameView.setConnectionStatus("LIVE");
                    // App enters the world before the socket is ready. Send a fresh live-start
                    // so the first audible greeting is produced by Gemini Live, not local fallback.
                    mainHandler.postDelayed(() -> {
                        if (!destroyed && runtime.isPlaying()) runtime.sendLiveReadyEvent();
                    }, 180L);
                });
            }

            @Override public void onStatus(String status) {
                mainHandler.post(() -> gameView.setConnectionStatus(status));
            }

            @Override public void onGameTurn(String callId, JSONObject args) {
                mainHandler.post(() -> {
                    // A stale tool call can arrive after fallback/timeout. Acknowledge it, but do not mutate a newer state.
                    long responseTurnId = args.optLong("turnId", -1L);
                    if (!runtime.isPlaying() || !waitingForTurn || activeEvent == null || !activeEvent.sessionId.equals(runtime.getSessionId())
                            || responseTurnId != activeEvent.turnId) {
                        GeminiLiveClient c = liveClient;
                        if (c != null) c.acknowledgeTool(callId, false, "stale turn");
                        return;
                    }
                    activeTurnSpeech = args.optString("speech", "");
                    runtime.applyTurn(args);
                    activeTurnApplied = true;
                    GeminiLiveClient c = liveClient;
                    if (c != null) c.acknowledgeTool(callId, true, "validated and applied");
                    armCompletionWatchdog();
                });
            }

            @Override public void onTurnComplete(boolean hadToolCall) {
                mainHandler.post(() -> {
                    if (!waitingForTurn || activeEvent == null) return;
                    if (!activeTurnApplied) {
                        // The model spoke but failed to call the mandatory UI tool. Keep the game moving locally.
                        applyLocalFallback(activeEvent, 0L);
                    } else {
                        // Gemini Live owns speech. If it intentionally stayed silent, stay silent.
                        finishActiveEvent();
                    }
                });
            }

            @Override public void onAudioActivity() {
                mainHandler.post(() -> activeTurnHadVoice = true);
            }

            @Override public void onTranscript(String text) {
                mainHandler.post(() -> appendTranscriptChunk(text));
            }

            @Override public void onError(String message) {
                mainHandler.post(() -> handleLiveError(key.trim(), message));
            }
        });
        liveClient.connect();
    }

    private void appendTranscriptChunk(String text) {
        if (text == null) return;
        activeTurnHadVoice = true;
        String chunk = text.replace('\n', ' ').replaceAll("\\s+", " ").trim();
        if (chunk.isEmpty()) return;

        String current = transcriptBuffer.toString();
        if (chunk.startsWith(current) && chunk.length() >= current.length()) {
            transcriptBuffer.setLength(0);
            transcriptBuffer.append(chunk);
        } else if (!current.endsWith(chunk)) {
            if (needsBoundarySpace(current, chunk)) transcriptBuffer.append(' ');
            transcriptBuffer.append(chunk);
        }
        gameView.setAiCaption(transcriptBuffer.toString().trim());
    }

    private boolean needsBoundarySpace(String left, String right) {
        if (left == null || left.isEmpty() || right == null || right.isEmpty()) return false;
        char a = left.charAt(left.length() - 1);
        char b = right.charAt(0);
        return isAsciiWord(a) && isAsciiWord(b);
    }

    private boolean isAsciiWord(char c) {
        return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
    }

    private void handleLiveError(String key, String message) {
        if (destroyed) return;
        gameView.setConnectionStatus("DEMO");
        if (waitingForTurn && activeEvent != null && !activeTurnApplied) {
            applyLocalFallback(activeEvent, 0L);
        } else if (waitingForTurn && activeTurnApplied) {
            finishActiveEvent();
        }

        if (key == null || key.isEmpty() || reconnectAttempts >= 3) return;
        reconnectAttempts++;
        long delay = reconnectAttempts == 1 ? 2_000L : (reconnectAttempts == 2 ? 5_000L : 10_000L);
        mainHandler.postDelayed(() -> {
            if (!destroyed && key.equals(prefs.getString(KEY_API, ""))) connectLive(key, false);
        }, delay);
    }

    private void showApiKeyDialog() {
        if (destroyed || isFinishing()) return;
        final EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setHint(runtime.text("Gemini API 金鑰", "Gemini API key"));
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        String current = prefs.getString(KEY_API, "");
        if (current != null) input.setText(current);
        input.setSelectAllOnFocus(true);
        input.setTextColor(Color.WHITE);
        input.setHintTextColor(Color.GRAY);

        TextView note = new TextView(this);
        note.setText(runtime.text(
                "MVP 只會把金鑰儲存在這個 App 的私有 SharedPreferences。正式版建議改成 ephemeral token 驗證。",
                "MVP stores the key only in this app's private SharedPreferences. For production, replace this with ephemeral-token auth."));
        note.setTextColor(Color.LTGRAY);
        note.setTextSize(13f);
        note.setPadding(0, 18, 0, 8);

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (24 * getResources().getDisplayMetrics().density);
        box.setPadding(pad, 8, pad, 0);
        box.addView(input, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        box.addView(note, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Gemini Live")
                .setView(box)
                .setPositiveButton(runtime.text("儲存並連線", "Save & connect"), null)
                .setNeutralButton(runtime.text("清除金鑰", "Clear key"), null)
                .setNegativeButton(runtime.text("使用 DEMO", "Use demo"), null)
                .create();
        dialog.setOnShowListener(ignored -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                String key = input.getText().toString().trim();
                if (key.isEmpty()) {
                    input.setError(runtime.text("請輸入金鑰，或選擇使用 DEMO", "Enter a key or choose Use demo"));
                    return;
                }
                prefs.edit().putString(KEY_API, key).apply();
                dialog.dismiss();
                connectLive(key, true);
            });
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v -> {
                prefs.edit().remove(KEY_API).apply();
                if (liveClient != null) { liveClient.close(); liveClient = null; }
                reconnectAttempts = 0;
                gameView.setConnectionStatus("DEMO");
                dialog.dismiss();
            });
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener(v -> {
                gameView.setConnectionStatus("DEMO");
                dialog.dismiss();
            });
        });
        dialog.show();
    }

    private void configureSystemBars() {
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
        getWindow().getDecorView().setSystemUiVisibility(0);
        getWindow().setStatusBarColor(Color.rgb(11, 12, 15));
        getWindow().setNavigationBarColor(Color.rgb(11, 12, 15));
    }

    private static final class PendingInteraction {
        GameEvent latestEvent;
        int totalEvents;
        int clicks;
        int drags;
        int timeouts;
        long firstAtMs;
        long lastAtMs;
        String lastTargetId = "";

        void record(GameEvent event) {
            if (event == null) return;
            latestEvent = event;
            totalEvents++;
            if (firstAtMs == 0L) firstAtMs = event.timestampMs;
            lastAtMs = event.timestampMs;
            if ("click".equals(event.type) || "world_tap".equals(event.type)) clicks++;
            else if ("drag".equals(event.type)) drags++;
            else if ("timeout".equals(event.type)) timeouts++;
            if (event.targetId != null && !event.targetId.isEmpty()) lastTargetId = event.targetId;
        }

        void attachTo(JSONObject context) {
            if (context == null) return;
            try {
                JSONObject batch = new JSONObject();
                batch.put("totalEvents", totalEvents);
                batch.put("clickCount", clicks);
                batch.put("dragCount", drags);
                batch.put("timeoutCount", timeouts);
                batch.put("spanMs", Math.max(0L, lastAtMs - firstAtMs));
                if (!lastTargetId.isEmpty()) batch.put("lastTargetId", lastTargetId);
                batch.put("rageClick", clicks >= 3);
                context.put("pendingInteraction", batch);
            } catch (Exception ignored) {}
        }
    }

    private static final class QueuedEvent {
        final GameEvent event;
        final JSONObject context;
        final String sessionId;
        final long turnId;
        QueuedEvent(GameEvent event, JSONObject context, String sessionId, long turnId) {
            this.event = event;
            this.context = context;
            this.sessionId = sessionId == null ? "" : sessionId;
            this.turnId = turnId;
        }
    }
}
