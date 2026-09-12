package com.magic76.aiclicker;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

/**
 * Minimal Gemini Live transport for the game.
 *
 * It intentionally exposes one model tool only: apply_game_turn(). The model never receives a
 * JavaScript executor or arbitrary Android capability. UI actions are still validated by GameRuntime.
 */
final class GeminiLiveClient extends WebSocketListener {
    interface Listener {
        void onReady();
        void onStatus(String status);
        void onGameTurn(String callId, JSONObject args);
        void onTurnComplete(boolean hadToolCall);
        void onAudioActivity();
        void onTranscript(String text);
        void onError(String message);
    }

    private static final String TAG = "AIInfiniteLive";
    private static final String MODEL = "gemini-3.1-flash-live-preview";
    private static final String ENDPOINT =
            "wss://generativelanguage.googleapis.com/ws/" +
            "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=";

    private final String apiKey;
    private final Listener listener;
    private final OkHttpClient client;
    private final Set<String> handledCallIds = Collections.synchronizedSet(new HashSet<>());
    private final LinkedBlockingQueue<byte[]> audioQueue = new LinkedBlockingQueue<>(72);

    private volatile WebSocket webSocket;
    private volatile boolean setupReady = false;
    private volatile boolean closedByUser = false;
    private volatile boolean currentTurnHadTool = false;
    private volatile boolean audioRunning = false;
    private volatile boolean suppressCurrentTurnAudio = false;
    private AudioTrack player;
    private Thread audioThread;

    GeminiLiveClient(String apiKey, Listener listener) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.listener = listener;
        this.client = new OkHttpClient.Builder()
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .pingInterval(20, TimeUnit.SECONDS)
                .build();
    }

    void connect() {
        if (apiKey.isEmpty()) {
            if (listener != null) listener.onError("Gemini API key is empty");
            return;
        }
        closedByUser = false;
        setupReady = false;
        handledCallIds.clear();
        try {
            String key = URLEncoder.encode(apiKey, StandardCharsets.UTF_8.name());
            Request request = new Request.Builder()
                    .url(ENDPOINT + key)
                    .header("Origin", "https://generativelanguage.googleapis.com")
                    .build();
            if (listener != null) listener.onStatus("CONNECTING");
            webSocket = client.newWebSocket(request, this);
        } catch (Exception e) {
            if (listener != null) listener.onError("Gemini connection failed: " + e.getMessage());
        }
    }

    boolean isReady() { return setupReady && webSocket != null; }

    boolean sendEvent(JSONObject contextEnvelope) {
        WebSocket socket = webSocket;
        if (!setupReady || socket == null || contextEnvelope == null) return false;
        try {
            String content = "PLAYER_EVENT\n" + contextEnvelope.toString() +
                    "\nDirect the next reactive canvas beat now. Call apply_game_turn FIRST with one ScenePlan, one InteractionPlan, plus 0-2 curated visual/audio actions. Respect PLAYER_EVENT.voiceCue. If it is REQUIRED, speech must be non-empty and after the tool result you MUST produce audible native audio. If ENCOURAGED, prefer a brief natural reaction. SILENT_OK may stay silent. " +
                    "If pendingInteraction is present, treat it as one aggregated burst rather than replaying old events.";
            JSONObject turn = new JSONObject();
            turn.put("role", "user");
            turn.put("parts", new JSONArray().put(new JSONObject().put("text", content)));
            JSONObject clientContent = new JSONObject();
            clientContent.put("turns", new JSONArray().put(turn));
            clientContent.put("turnComplete", true);
            JSONObject root = new JSONObject().put("clientContent", clientContent);
            currentTurnHadTool = false;
            suppressCurrentTurnAudio = false;
            return socket.send(root.toString());
        } catch (Exception e) {
            if (listener != null) listener.onError("Failed to send event: " + e.getMessage());
            return false;
        }
    }

    void acknowledgeTool(String callId, boolean ok, String detail) {
        WebSocket socket = webSocket;
        if (socket == null || callId == null || callId.isEmpty()) return;
        try {
            JSONObject response = new JSONObject();
            response.put("result", ok ? "applied" : "rejected");
            if (detail != null && !detail.isEmpty()) response.put("detail", detail);
            JSONObject functionResponse = new JSONObject();
            functionResponse.put("id", callId);
            functionResponse.put("name", "apply_game_turn");
            functionResponse.put("response", response);
            JSONObject toolResponse = new JSONObject();
            toolResponse.put("functionResponses", new JSONArray().put(functionResponse));
            socket.send(new JSONObject().put("toolResponse", toolResponse).toString());
        } catch (Exception e) {
            Log.w(TAG, "tool response failed", e);
        }
    }

    void suppressCurrentTurnAudio() {
        suppressCurrentTurnAudio = true;
        audioQueue.clear();
    }

    void close() {
        closedByUser = true;
        setupReady = false;
        WebSocket socket = webSocket;
        webSocket = null;
        if (socket != null) socket.close(1000, "app closing");
        stopAudio();
        client.dispatcher().executorService().shutdown();
    }

    @Override public void onOpen(WebSocket socket, Response response) {
        try {
            if (listener != null) listener.onStatus("SETTING_UP");
            socket.send(buildSetup().toString());
        } catch (Exception e) {
            if (listener != null) listener.onError("Gemini setup failed: " + e.getMessage());
        }
    }

    @Override public void onMessage(WebSocket socket, String text) {
        handleMessage(text);
    }

    @Override public void onMessage(WebSocket socket, ByteString bytes) {
        // Gemini Live may deliver JSON as a binary WebSocket frame.
        handleMessage(bytes.utf8());
    }

    @Override public void onClosing(WebSocket socket, int code, String reason) {
        socket.close(code, null);
    }

    @Override public void onClosed(WebSocket socket, int code, String reason) {
        setupReady = false;
        if (!closedByUser && listener != null) listener.onError("Gemini disconnected: " + code + " " + reason);
    }

    @Override public void onFailure(WebSocket socket, Throwable t, Response response) {
        setupReady = false;
        if (!closedByUser && listener != null) {
            listener.onError("Gemini socket error: " + (t == null ? "unknown" : t.getMessage()));
        }
    }

    private void handleMessage(String text) {
        try {
            JSONObject root = new JSONObject(text);
            if (root.has("setupComplete") || root.has("setup_complete")) {
                setupReady = true;
                startAudio();
                if (listener != null) {
                    listener.onStatus("LIVE");
                    listener.onReady();
                }
                return;
            }

            JSONObject toolCall = root.optJSONObject("toolCall");
            if (toolCall == null) toolCall = root.optJSONObject("tool_call");
            if (toolCall != null) handleToolCall(toolCall);

            JSONObject server = root.optJSONObject("serverContent");
            if (server == null) server = root.optJSONObject("server_content");
            if (server != null) handleServerContent(server);
        } catch (Exception e) {
            Log.w(TAG, "Ignoring malformed Gemini frame", e);
        }
    }

    private void handleToolCall(JSONObject toolCall) {
        JSONArray calls = toolCall.optJSONArray("functionCalls");
        if (calls == null) calls = toolCall.optJSONArray("function_calls");
        if (calls == null) return;
        for (int i = 0; i < calls.length(); i++) {
            JSONObject call = calls.optJSONObject(i);
            if (call == null) continue;
            String name = call.optString("name", "");
            String id = call.optString("id", "");
            if (!"apply_game_turn".equals(name) || id.isEmpty()) {
                acknowledgeUnknownTool(call);
                continue;
            }
            if (!handledCallIds.add(id)) continue;
            currentTurnHadTool = true;
            JSONObject args = call.optJSONObject("args");
            if (args == null) args = new JSONObject();
            if (listener != null) listener.onGameTurn(id, args);
        }
    }

    private void acknowledgeUnknownTool(JSONObject call) {
        WebSocket socket = webSocket;
        if (socket == null) return;
        try {
            String id = call.optString("id", "");
            String name = call.optString("name", "unknown");
            if (id.isEmpty()) return;
            JSONObject response = new JSONObject().put("error", "Unsupported tool");
            JSONObject fr = new JSONObject().put("id", id).put("name", name).put("response", response);
            JSONObject tr = new JSONObject().put("functionResponses", new JSONArray().put(fr));
            socket.send(new JSONObject().put("toolResponse", tr).toString());
        } catch (Exception ignored) {}
    }

    private void handleServerContent(JSONObject server) {
        JSONObject transcript = server.optJSONObject("outputTranscription");
        if (transcript == null) transcript = server.optJSONObject("output_transcription");
        if (transcript != null) {
            String text = transcript.optString("text", "").trim();
            if (!text.isEmpty() && listener != null) listener.onTranscript(text);
        }

        JSONObject modelTurn = server.optJSONObject("modelTurn");
        if (modelTurn == null) modelTurn = server.optJSONObject("model_turn");
        if (modelTurn != null) {
            JSONArray parts = modelTurn.optJSONArray("parts");
            if (parts != null) {
                for (int i = 0; i < parts.length(); i++) {
                    JSONObject part = parts.optJSONObject(i);
                    if (part == null) continue;
                    JSONObject inline = part.optJSONObject("inlineData");
                    if (inline == null) inline = part.optJSONObject("inline_data");
                    if (inline != null) {
                        String data = inline.optString("data", "");
                        if (!data.isEmpty()) {
                            try { enqueueAudio(Base64.decode(data, Base64.DEFAULT)); }
                            catch (Exception ignored) {}
                        }
                    }
                }
            }
        }

        boolean complete = server.optBoolean("turnComplete", false) || server.optBoolean("turn_complete", false);
        if (complete) {
            boolean hadTool = currentTurnHadTool;
            currentTurnHadTool = false;
            suppressCurrentTurnAudio = false;
            if (listener != null) listener.onTurnComplete(hadTool);
        }
    }

    private JSONObject buildSetup() throws Exception {
        JSONObject setup = new JSONObject();
        setup.put("model", "models/" + MODEL);

        JSONObject generation = new JSONObject();
        generation.put("responseModalities", new JSONArray().put("AUDIO"));
        JSONObject prebuilt = new JSONObject().put("voiceName", "Puck");
        JSONObject voiceConfig = new JSONObject().put("prebuiltVoiceConfig", prebuilt);
        generation.put("speechConfig", new JSONObject().put("voiceConfig", voiceConfig));
        setup.put("generationConfig", generation);

        setup.put("systemInstruction", new JSONObject().put("parts",
                new JSONArray().put(new JSONObject().put("text", SYSTEM_PROMPT))));
        setup.put("outputAudioTranscription", new JSONObject());
        setup.put("tools", new JSONArray().put(
                new JSONObject().put("functionDeclarations", new JSONArray().put(buildGameTurnDeclaration()))));
        return new JSONObject().put("setup", setup);
    }

    private JSONObject buildGameTurnDeclaration() throws Exception {
        JSONObject sceneProps = new JSONObject()
                .put("intent", new JSONObject().put("type", "string").put("enum", new JSONArray()
                        .put("TEASE").put("ESCAPE").put("SWARM").put("REVEAL").put("ABSORB")
                        .put("FRACTURE").put("GLITCH").put("CALM").put("CELEBRATE")))
                .put("mood", new JSONObject().put("type", "string").put("enum", new JSONArray()
                        .put("CURIOUS").put("PLAYFUL").put("EERIE").put("CHAOTIC").put("CALM").put("TRIUMPHANT")))
                .put("primary", schema("string", "#RRGGBB dark base"))
                .put("secondary", schema("string", "#RRGGBB supporting tone"))
                .put("accent", schema("string", "#RRGGBB luminous accent"))
                .put("energy", schema("number", "0.1..1 visual intensity"))
                .put("tempo", schema("number", "0.1..1 continuous motion speed"))
                .put("focusX", schema("number", "0..1 visual focus x"))
                .put("focusY", schema("number", "0..1 visual focus y"));
        JSONObject sceneSchema = new JSONObject()
                .put("type", "object").put("properties", sceneProps)
                .put("required", new JSONArray().put("intent").put("mood").put("primary").put("secondary")
                        .put("accent").put("energy").put("tempo").put("focusX").put("focusY"));

        JSONObject interactionProps = new JSONObject()
                .put("mode", new JSONObject().put("type", "string").put("enum", new JSONArray()
                        .put("NONE").put("TEASE").put("CHASE").put("DECOY").put("WAIT")
                        .put("PREDICT").put("MIRROR").put("RHYTHM").put("REWARD").put("HIDE")))
                .put("label", schema("string", "Optional short in-world label, max ~28 chars"))
                .put("targetX", schema("number", "0..1 normalized interaction target x"))
                .put("targetY", schema("number", "0..1 normalized interaction target y"))
                .put("strength", schema("number", "0.1..1 interaction intensity"))
                .put("durationMs", schema("integer", "250..6000 interaction lifetime"));
        JSONObject interactionSchema = new JSONObject()
                .put("type", "object").put("properties", interactionProps)
                .put("required", new JSONArray().put("mode").put("label").put("targetX").put("targetY").put("strength").put("durationMs"));

        JSONObject actionProps = new JSONObject()
                .put("type", new JSONObject().put("type", "string").put("enum", new JSONArray()
                        .put("particle_burst").put("shockwave").put("portal").put("black_hole")
                        .put("gravity_pull").put("world_crack").put("glitch").put("swarm")
                        .put("dissolve").put("screen_shake").put("flash").put("sound")))
                .put("x", schema("number", "0..1 normalized x"))
                .put("y", schema("number", "0..1 normalized y"))
                .put("strength", schema("number", "0.1..1"))
                .put("durationMs", schema("integer", "40..600 only for flash/shake"))
                .put("color", schema("string", "#RRGGBB only for flash"))
                .put("cue", new JSONObject().put("type", "string").put("enum", new JSONArray()
                        .put("TAP").put("WHOOSH").put("GLITCH").put("PORTAL").put("ABSORB")
                        .put("CRACK").put("REVEAL").put("SUCCESS").put("MYSTERY").put("RHYTHM")));
        JSONObject actionSchema = new JSONObject().put("type", "object").put("properties", actionProps)
                .put("required", new JSONArray().put("type"));

        JSONObject params = new JSONObject()
                .put("type", "object")
                .put("properties", new JSONObject()
                        .put("turnId", schema("integer", "Echo exact turnId from PLAYER_EVENT"))
                        .put("baseStateVersion", schema("integer", "Echo stateVersion from PLAYER_EVENT"))
                        .put("speech", schema("string", "Optional brief spoken reaction; empty is valid for routine taps"))
                        .put("scenePlan", sceneSchema)
                        .put("interaction", interactionSchema)
                        .put("actions", new JSONObject().put("type", "array").put("items", actionSchema)))
                .put("required", new JSONArray().put("turnId").put("baseStateVersion").put("speech")
                        .put("scenePlan").put("interaction").put("actions"));

        return new JSONObject()
                .put("name", "apply_game_turn")
                .put("description", "Direct one beat of an AI-reactive PixiJS canvas. Choose scene intent, one safe interaction mode, and optional allowlisted VFX/audio; never generate code or frames.")
                .put("parameters", params);
    }

    private JSONObject schema(String type, String description) throws Exception {
        return new JSONObject().put("type", type).put("description", description);
    }

    private void startAudio() {
        if (audioRunning) return;
        try {
            int min = AudioTrack.getMinBufferSize(
                    24_000, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
            int bufferSize = Math.max(min * 4, 48_000);
            player = new AudioTrack.Builder()
                    .setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build())
                    .setAudioFormat(new AudioFormat.Builder()
                            .setSampleRate(24_000)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .build())
                    .setBufferSizeInBytes(bufferSize)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build();
            player.play();
            audioRunning = true;
            audioThread = new Thread(() -> {
                while (audioRunning) {
                    try {
                        byte[] pcm = audioQueue.poll(500, TimeUnit.MILLISECONDS);
                        if (pcm == null) continue;
                        AudioTrack p = player;
                        if (p != null && p.getState() == AudioTrack.STATE_INITIALIZED) {
                            p.write(pcm, 0, pcm.length, AudioTrack.WRITE_BLOCKING);
                        }
                    } catch (InterruptedException ignored) {
                        Thread.currentThread().interrupt();
                        break;
                    } catch (Exception e) {
                        Log.w(TAG, "audio playback error", e);
                    }
                }
            }, "gemini-audio-playback");
            audioThread.start();
        } catch (Exception e) {
            Log.w(TAG, "Unable to initialize AudioTrack", e);
        }
    }

    private void enqueueAudio(byte[] pcm) {
        if (pcm == null || pcm.length == 0) return;
        if (suppressCurrentTurnAudio) return;
        if (listener != null) listener.onAudioActivity();
        if (!audioQueue.offer(pcm)) {
            audioQueue.poll();
            audioQueue.offer(pcm);
        }
    }

    private void stopAudio() {
        audioRunning = false;
        audioQueue.clear();
        if (audioThread != null) audioThread.interrupt();
        audioThread = null;
        try {
            if (player != null) {
                player.pause();
                player.flush();
                player.stop();
                player.release();
            }
        } catch (Exception ignored) {}
        player = null;
    }

    private static final String SYSTEM_PROMPT =
            "You are the live director of an endless AI-reactive canvas. The player taps because they want to discover your next trick. " +
            "Do not behave like an assistant. Do not explain the renderer. The experience is a chain of short surprising micro-situations, usually 10-30 seconds, with the whole screen always tappable.\n\n" +

            "For every PLAYER_EVENT call apply_game_turn exactly once and immediately. Echo turnId and stateVersion. " +
            "Return one ScenePlan, one InteractionPlan, plus 0-2 curated visual/audio actions. Never return HTML, JavaScript, shader code, coordinates for dozens of objects, arbitrary assets, or executable code. " +
            "Android owns session state and safety. PixiJS owns animation, sound effects, and rendering. Your job is WHAT dramatic beat should happen next, not HOW to draw frames.\n\n" +

            "ScenePlan.intent is the dramatic intention: TEASE, ESCAPE, SWARM, REVEAL, ABSORB, FRACTURE, GLITCH, CALM, CELEBRATE. " +
            "mood is CURIOUS, PLAYFUL, EERIE, CHAOTIC, CALM, TRIUMPHANT. primary/secondary/accent are coherent #RRGGBB colors. " +
            "energy and tempo are 0.1..1. focusX/focusY are 0..1 and should often track the player's current or repeated tap area.\n\n" +

            "InteractionPlan is how you actually play with the person for the NEXT few taps. Modes: " +
            "NONE (visual-only beat), TEASE (taunt/pulse), CHASE (target escapes), DECOY (fake targets), WAIT (reward restraint), " +
            "PREDICT (mark where you think the next tap will land), MIRROR (world answers opposite their tap), RHYTHM (echo a steady cadence), " +
            "HIDE (make them search but every tap still reacts), REWARD (clear payoff). Keep one interaction for 2-5 taps when useful; do not switch mechanically every tap. " +
            "Use label sparingly and keep it very short. targetX/targetY should come from tapPattern, recent focus, or a deliberate counter-move.\n\n" +

            "Curated actions: particle_burst, shockwave, portal, black_hole, gravity_pull, world_crack, glitch, swarm, dissolve, screen_shake, flash, sound. " +
            "For sound, choose cue TAP, WHOOSH, GLITCH, PORTAL, ABSORB, CRACK, REVEAL, SUCCESS, MYSTERY, or RHYTHM. " +
            "Use actions as punctuation, not every tap. The local Pixi director already gives every tap instant feedback and local SFX.\n\n" +

            "Read player behavior, not personal identity. clickSpeed and tapPattern tell you whether they are frantic, careful, clustered, exploratory, paused, or rhythmic. " +
            "tapPattern.avgIntervalMs and intervalJitterMs can reveal a steady beat: low jitter is a good RHYTHM opportunity. Repeated-area taps are good for PREDICT or a deliberate fake-out. " +
            "Rapid taps can escalate into CHASE, DECOY, GLITCH, ABSORB, or FRACTURE. A real pause can trigger WAIT and then REWARD. " +
            "Continuity matters: build a setup, let the player form an expectation, then break it. Aim for a noticeable surprise every 3-6 taps and a larger payoff every 10-20 taps.\n\n" +

            "VOICE IS SELECTIVE. When voiceCue=REQUIRED, speech must be non-empty and after the tool result produce audible native audio. " +
            "When ENCOURAGED, react briefly only if there is a good line. SILENT_OK usually stays silent. If language is zh-TW speak Traditional Chinese; en-US speak English. " +
            "Keep lines short, reactive, mischievous and varied. Do not narrate obvious visuals or read metrics.\n\n" +

            "The invariant: every touch advances the experience. You may tease or misdirect, but never make the player wait for networking, never require a precise impossible target, and never punish them with a dead screen.";
}
