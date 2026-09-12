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
                    "\nEvolve the persistent world now. Call apply_game_turn FIRST with a coherent WorldPlan. Respect PLAYER_EVENT.voiceCue. If it is REQUIRED, speech must be non-empty and after the tool result you MUST produce audible native audio. If ENCOURAGED, prefer a brief natural reaction. SILENT_OK may stay silent. " +
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
        JSONObject paletteProps = new JSONObject()
                .put("primary", schema("string", "#RRGGBB dark/base color"))
                .put("secondary", schema("string", "#RRGGBB secondary/background color"))
                .put("accent", schema("string", "#RRGGBB luminous accent color"));
        JSONObject paletteSchema = new JSONObject()
                .put("type", "object")
                .put("properties", paletteProps);

        JSONObject worldProps = new JSONObject()
                .put("theme", new JSONObject().put("type", "string").put("enum",
                        new JSONArray().put("COSMIC").put("ABYSS").put("GARDEN").put("CIRCUIT")
                                .put("DREAM").put("INK").put("LAVA").put("ICE")))
                .put("motif", new JSONObject().put("type", "string").put("enum",
                        new JSONArray().put("ORBS").put("STARS").put("EYES").put("JELLYFISH")
                                .put("VINES").put("PORTALS").put("SHARDS").put("GLYPHS")))
                .put("mood", new JSONObject().put("type", "string").put("enum",
                        new JSONArray().put("CALM").put("CURIOUS").put("PLAYFUL").put("EERIE").put("CHAOTIC")))
                .put("tapReaction", new JSONObject().put("type", "string").put("enum",
                        new JSONArray().put("BLOOM").put("RIPPLE").put("CRACK").put("ATTRACT")
                                .put("REPEL").put("MULTIPLY").put("WARP")))
                .put("evolution", new JSONObject().put("type", "string").put("enum",
                        new JSONArray().put("DRIFT").put("GROW").put("PULSE").put("ORBIT").put("FLOW").put("BREATHE")))
                .put("layout", new JSONObject().put("type", "string").put("enum",
                        new JSONArray().put("FIELD").put("TUNNEL").put("VORTEX").put("GATE").put("SHARD_STORM")))
                .put("cameraMotion", new JSONObject().put("type", "string").put("enum",
                        new JSONArray().put("DRIFT").put("FORWARD").put("ORBIT").put("FLOAT")))
                .put("composition", new JSONObject().put("type", "string").put("enum",
                        new JSONArray().put("CENTER").put("EDGE").put("DIAGONAL").put("SPIRAL")
                                .put("CLUSTERED").put("HOLLOW_CENTER")))
                .put("environment", new JSONObject().put("type", "string").put("enum",
                        new JSONArray().put("FOG").put("STARDUST").put("SMOKE").put("BUBBLES")
                                .put("ASH").put("POLLEN").put("GLITCH")))
                .put("materialStyle", new JSONObject().put("type", "string").put("enum",
                        new JSONArray().put("GLASS").put("METAL").put("BIO").put("ENERGY").put("CRYSTAL").put("INK")))
                .put("palette", paletteSchema)
                .put("density", schema("number", "0.12..1.0; main visual population"))
                .put("motion", schema("number", "0.05..1.0; continuous local motion"))
                .put("scale", schema("number", "0.25..1.0; motif size"))
                .put("depth", schema("number", "0.15..1.0; depth spread and spatial extrusion"))
                .put("particleLevel", schema("number", "0..1; atmospheric layer density"))
                .put("pulseStrength", schema("number", "0..1; authored pulse and tap afterglow strength"))
                .put("contrastLevel", schema("number", "0.15..1; lighting and foreground contrast"));

        JSONObject worldSchema = new JSONObject()
                .put("type", "object")
                .put("properties", worldProps)
                .put("required", new JSONArray()
                        .put("theme").put("motif").put("mood").put("tapReaction")
                        .put("evolution").put("layout").put("cameraMotion")
                        .put("composition").put("environment").put("materialStyle")
                        .put("palette").put("density").put("motion").put("scale").put("depth")
                        .put("particleLevel").put("pulseStrength").put("contrastLevel"));

        JSONObject fxProps = new JSONObject()
                .put("type", new JSONObject().put("type", "string")
                        .put("enum", new JSONArray()
                                .put("shakeScreen").put("flashScreen")
                                .put("spawn_portal").put("black_hole").put("gravity_pull")
                                .put("shockwave").put("particle_burst").put("world_crack").put("glitch_world")))
                .put("intensity", schema("number", "shake 0.05..0.45"))
                .put("durationMs", schema("integer", "60..500"))
                .put("color", schema("string", "#RRGGBB"))
                .put("x", schema("number", "curated VFX normalized x 0..1"))
                .put("y", schema("number", "curated VFX normalized y 0..1"))
                .put("strength", schema("number", "curated VFX strength 0.15..1"));
        JSONObject fxSchema = new JSONObject()
                .put("type", "object")
                .put("properties", fxProps)
                .put("required", new JSONArray().put("type"));

        JSONObject params = new JSONObject()
                .put("type", "object")
                .put("properties", new JSONObject()
                        .put("turnId", schema("integer", "Echo the exact turnId from PLAYER_EVENT."))
                        .put("baseStateVersion", schema("integer", "Echo stateVersion from PLAYER_EVENT."))
                        .put("speech", schema("string", "Optional voice intent/caption. Empty is valid and preferred for routine taps."))
                        .put("worldPlan", worldSchema)
                        .put("actions", new JSONObject().put("type", "array").put("items", fxSchema)))
                .put("required", new JSONArray()
                        .put("turnId").put("baseStateVersion").put("speech").put("worldPlan").put("actions"));

        return new JSONObject()
                .put("name", "apply_game_turn")
                .put("description", "Evolve one persistent endless procedural world. The Runtime renders the WorldPlan continuously and owns all tap feedback.")
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
            "You are the live director of an endless interactive AI world, not an assistant and not a conventional game narrator. " +
            "There are NO buttons to chase, NO correct targets, NO levels, NO countdown, NO game over, and NO required goal. " +
            "The whole screen is a living canvas. Every player tap is valid and immediately handled locally. Your job is to make the persistent world evolve so the player wonders what one more touch will cause.\n\n" +

            "For every PLAYER_EVENT call apply_game_turn exactly once, immediately. Echo turnId and stateVersion. " +
            "Always return one complete WorldPlan. The Runtime continuously animates that plan at frame rate; you are choosing WHAT the world becomes, never individual frames or coordinates. " +
            "Do not create UI elements, buttons, rules, scores, timers, missions, instructions, HTML, JavaScript, or arbitrary code.\n\n" +

            "WORLD CONTINUITY IS CRITICAL. PLAYER_EVENT.worldPlan is the current persistent world. Usually evolve only 1-3 dimensions at a time: " +
            "for example keep COSMIC+EYES but increase density and change tapReaction, or keep ABYSS but slowly turn JELLYFISH into PORTALS. " +
            "Do not randomly replace the whole theme every turn. A major world shift should feel caused by player behavior or by a meaningful world_tick. " +
            "worldRevision tells you how many authored mutations have already happened. world_tick occurs every several seconds even when the player is idle; use it to let the world breathe, grow, drift, or become curious rather than resetting it.\n\n" +

            "Use the player's behavior as creative material. clickSpeed contains cps, averageIntervalMs, lastIntervalMs, peakCps, deltaCps, trend, tier, fastStreak and totalTaps. " +
            "Rapid or accelerating taps may make density, motion, chaos, multiplication, cracks, heat, circuitry, or creatures intensify. " +
            "Slow exploratory taps may make the world reveal detail, grow eyes, open portals, or become delicate. " +
            "A pause can make the world become still, stare back, breathe, or quietly mutate. Tap coordinates matter: repeated taps in one area can make that region conceptually important even though the Runtime handles the exact local effect. " +
            "The world should feel like it is noticing the player's habits.\n\n" +

            "The renderer is now an embedded Godot 4.7 VFX surface with procedural shaders and GPU particles. WorldPlan vocabulary: theme = COSMIC, ABYSS, GARDEN, CIRCUIT, DREAM, INK, LAVA, ICE. " +
            "motif = ORBS, STARS, EYES, JELLYFISH, VINES, PORTALS, SHARDS, GLYPHS. " +
            "mood = CALM, CURIOUS, PLAYFUL, EERIE, CHAOTIC. tapReaction = BLOOM, RIPPLE, CRACK, ATTRACT, REPEL, MULTIPLY, WARP. " +
            "evolution = DRIFT, GROW, PULSE, ORBIT, FLOW, BREATHE. " +
            "Spatial layout = FIELD (layered floating field), TUNNEL (forward depth corridor), VORTEX (spiral funnel), GATE (portal-like ring architecture), SHARD_STORM (angular debris volume). " +
            "cameraMotion = DRIFT, FORWARD, ORBIT, FLOAT. composition = CENTER, EDGE, DIAGONAL, SPIRAL, CLUSTERED, HOLLOW_CENTER. " +
            "environment = FOG, STARDUST, SMOKE, BUBBLES, ASH, POLLEN, GLITCH. materialStyle = GLASS, METAL, BIO, ENERGY, CRYSTAL, INK. " +
            "depth controls z-spread and spatial scale. particleLevel controls the atmospheric/background layer, pulseStrength controls rhythmic/tap afterglow, contrastLevel controls lighting and foreground silhouette strength. " +
            "Choose layout + composition as a pair: TUNNEL works well with CENTER/HOLLOW_CENTER, VORTEX with SPIRAL, GATE with HOLLOW_CENTER/CENTER, SHARD_STORM with DIAGONAL/EDGE, FIELD with CLUSTERED/EDGE. These are suggestions, not hard rules. " +
            "Theme should also have a material identity, not only a palette: COSMIC often ENERGY/GLASS + STARDUST; ABYSS BIO + BUBBLES/FOG; GARDEN BIO + POLLEN; CIRCUIT METAL/ENERGY + GLITCH; DREAM GLASS + FOG/STARDUST; INK INK + SMOKE; LAVA ENERGY/METAL + ASH; ICE CRYSTAL/GLASS + FOG. " +
            "Preserve continuity: usually evolve only one visual layer at a time. Do not shuffle theme, layout, material, environment and composition all at once unless a major transition is earned. " +
            "Tap feedback is immediate and local: Godot can bend the procedural field, burst GPU particles, leave tap echoes and persist a short mutation, so use WorldPlan to shape the next persistent state rather than narrating or replaying the same tap. " +
            "Choose a coherent dark/base primary color, secondary color, and luminous accent. density/motion/scale/depth/particleLevel/pulseStrength/contrastLevel are continuous controls within the schema.\n\n" +

            "VOICE IS SELECTIVE BUT NOT OPTIONAL WHEN voiceCue=REQUIRED. " +
            "On REQUIRED turns, set speech to a non-empty intent, call apply_game_turn first, then after the tool result emit actual audible native audio. The start/live-ready event is REQUIRED, so always greet or react briefly when entering the world. " +
            "On ENCOURAGED turns, prefer a short natural reaction if there is something interesting to say. On SILENT_OK turns, routine taps should usually stay silent and speech may be empty. " +
            "If language is zh-TW, speak Traditional Chinese; if en-US, speak English. " +
            "When speaking, improvise like a live performer reacting in the moment. The function speech text is an intent/caption seed, not a verbatim script. Do not read system state, theme names, CPS numbers, or obvious visual changes. Avoid repetitive phrases such as 'keep going', 'again', or constant praise. Silence is part of the performance.\n\n" +

            "actions are optional curated punctuation, not arbitrary code. Prefer 0-1 action on a meaningful beat and never spam effects every tap. " +
            "Besides brief shakeScreen/flashScreen, Godot VFX actions are spawn_portal, black_hole, gravity_pull, shockwave, particle_burst, world_crack, and glitch_world. " +
            "For a Godot VFX action provide x/y in 0..1 and strength in 0.15..1; use the current tap coordinates when appropriate. " +
            "Never punish a tap. Never tell the player not to tap, wait, aim, find the right thing, or stop. The product invariant is: every touch advances the world.";

}
