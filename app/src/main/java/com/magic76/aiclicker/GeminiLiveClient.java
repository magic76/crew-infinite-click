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

/** Gemini Live is an asynchronous creative director. It never sits in the input/render critical path. */
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

    private static final String TAG="AIInfiniteLive";
    private static final String MODEL="gemini-3.1-flash-live-preview";
    private static final boolean VOICE_OUTPUT_ENABLED=false;
    private static final String ENDPOINT="wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=";

    private final String apiKey;
    private final Listener listener;
    private final OkHttpClient client;
    private final Set<String> handledCallIds=Collections.synchronizedSet(new HashSet<>());
    private final LinkedBlockingQueue<byte[]> audioQueue=new LinkedBlockingQueue<>(48);
    private final Object audioLock=new Object();

    private volatile WebSocket webSocket;
    private volatile boolean setupReady=false;
    private volatile boolean closedByUser=false;
    private volatile boolean currentTurnHadTool=false;
    private volatile boolean audioRunning=false;
    private volatile boolean suppressCurrentTurnAudio=false;
    private AudioTrack player;
    private Thread audioThread;

    GeminiLiveClient(String apiKey,Listener listener){
        this.apiKey=apiKey==null?"":apiKey.trim();this.listener=listener;
        this.client=new OkHttpClient.Builder().readTimeout(0,TimeUnit.MILLISECONDS).pingInterval(20,TimeUnit.SECONDS).build();
    }

    void connect(){
        if(apiKey.isEmpty()){if(listener!=null)listener.onError("Gemini API key is empty");return;}
        closedByUser=false;setupReady=false;handledCallIds.clear();
        try{
            String key=URLEncoder.encode(apiKey,StandardCharsets.UTF_8.name());
            Request request=new Request.Builder().url(ENDPOINT+key).header("Origin","https://generativelanguage.googleapis.com").build();
            if(listener!=null)listener.onStatus("CONNECTING");
            webSocket=client.newWebSocket(request,this);
        }catch(Exception e){if(listener!=null)listener.onError("Gemini connection failed: "+e.getMessage());}
    }

    boolean isReady(){return setupReady&&webSocket!=null;}

    boolean sendEvent(JSONObject directive){
        WebSocket socket=webSocket;if(!setupReady||socket==null||directive==null)return false;
        try{
            String mode="GAME_TURN";
            boolean voiceWanted=false;
            directive.put("mode",mode);directive.put("voiceWanted",false);
            String extra="AI VOICE IS DISABLED. NEVER SPEAK OR BANTER. Silently call apply_world_experience exactly once. Echo turnId and baseStateVersion. Use DIRECTIVE.context.scene as physical truth and keep world SUMMER_STORM.";
            String content="DIRECTIVE\n"+directive.toString()+"\n"+extra;
            JSONObject turn=new JSONObject().put("role","user").put("parts",new JSONArray().put(new JSONObject().put("text",content)));
            JSONObject cc=new JSONObject().put("turns",new JSONArray().put(turn)).put("turnComplete",true);
            currentTurnHadTool=false;suppressCurrentTurnAudio=true;
            return socket.send(new JSONObject().put("clientContent",cc).toString());
        }catch(Exception e){if(listener!=null)listener.onError("Failed to send directive: "+e.getMessage());return false;}
    }

    void acknowledgeTool(String callId,boolean ok,String detail){
        WebSocket socket=webSocket;if(socket==null||callId==null||callId.isEmpty())return;
        try{
            JSONObject result=new JSONObject().put("ok",ok);
            if(detail!=null&&!detail.isEmpty())result.put("detail",detail);
            socket.send(GeminiWorldToolSchema.buildToolResponse(callId,result));
        }catch(Exception e){Log.w(TAG,"tool response failed",e);}
    }

    /** Immediately drop queued/buffered stale voice before a newer scene owns the moment. */
    void suppressCurrentTurnAudio(){
        suppressCurrentTurnAudio=true;audioQueue.clear();
        synchronized(audioLock){
            try{
                if(player!=null&&player.getState()==AudioTrack.STATE_INITIALIZED){
                    player.pause();player.flush();player.play();
                }
            }catch(Exception ignored){}
        }
    }

    void close(){
        closedByUser=true;setupReady=false;
        WebSocket socket=webSocket;webSocket=null;if(socket!=null)socket.close(1000,"app closing");
        stopAudio();client.dispatcher().executorService().shutdown();
    }

    @Override public void onOpen(WebSocket socket,Response response){
        try{if(listener!=null)listener.onStatus("SETTING_UP");socket.send(buildSetup().toString());}
        catch(Exception e){if(listener!=null)listener.onError("Gemini setup failed: "+e.getMessage());}
    }
    @Override public void onMessage(WebSocket socket,String text){handleMessage(text);}
    @Override public void onMessage(WebSocket socket,ByteString bytes){handleMessage(bytes.utf8());}
    @Override public void onClosing(WebSocket socket,int code,String reason){socket.close(code,null);}
    @Override public void onClosed(WebSocket socket,int code,String reason){setupReady=false;if(!closedByUser&&listener!=null)listener.onError("Gemini disconnected: "+code+" "+reason);}
    @Override public void onFailure(WebSocket socket,Throwable t,Response response){setupReady=false;if(!closedByUser&&listener!=null)listener.onError("Gemini socket error: "+(t==null?"unknown":t.getMessage()));}

    private void handleMessage(String text){
        try{
            JSONObject root=new JSONObject(text);
            if(root.has("setupComplete")||root.has("setup_complete")){
                setupReady=true;startAudio();if(listener!=null){listener.onStatus("LIVE");listener.onReady();}return;
            }
            JSONObject tool=root.optJSONObject("toolCall");if(tool==null)tool=root.optJSONObject("tool_call");if(tool!=null)handleToolCall(tool);
            JSONObject server=root.optJSONObject("serverContent");if(server==null)server=root.optJSONObject("server_content");if(server!=null)handleServerContent(server);
        }catch(Exception e){Log.w(TAG,"Ignoring malformed Gemini frame",e);}
    }

    private void handleToolCall(JSONObject toolCall){
        JSONArray calls=toolCall.optJSONArray("functionCalls");if(calls==null)calls=toolCall.optJSONArray("function_calls");if(calls==null)return;
        for(int i=0;i<calls.length();i++){
            JSONObject call=calls.optJSONObject(i);if(call==null)continue;
            String name=call.optString("name",""),id=call.optString("id","");
            if(!GeminiWorldToolSchema.FUNCTION_NAME.equals(name)||id.isEmpty()){acknowledgeUnknownTool(call);continue;}
            if(!handledCallIds.add(id))continue;
            currentTurnHadTool=true;
            JSONObject args=call.optJSONObject("args");if(args==null)args=new JSONObject();
            if(listener!=null)listener.onGameTurn(id,args);
        }
    }

    private void acknowledgeUnknownTool(JSONObject call){
        WebSocket socket=webSocket;if(socket==null)return;
        try{
            String id=call.optString("id",""),name=call.optString("name","unknown");if(id.isEmpty())return;
            JSONObject fr=new JSONObject().put("id",id).put("name",name).put("response",new JSONObject().put("error","Unsupported tool"));
            socket.send(new JSONObject().put("toolResponse",new JSONObject().put("functionResponses",new JSONArray().put(fr))).toString());
        }catch(Exception ignored){}
    }

    private void handleServerContent(JSONObject server){
        JSONObject tr=server.optJSONObject("outputTranscription");if(tr==null)tr=server.optJSONObject("output_transcription");
        if(tr!=null){String text=tr.optString("text","").trim();if(!text.isEmpty()&&listener!=null)listener.onTranscript(text);}
        JSONObject model=server.optJSONObject("modelTurn");if(model==null)model=server.optJSONObject("model_turn");
        if(model!=null){
            JSONArray parts=model.optJSONArray("parts");
            if(parts!=null)for(int i=0;i<parts.length();i++){
                JSONObject part=parts.optJSONObject(i);if(part==null)continue;
                JSONObject inline=part.optJSONObject("inlineData");if(inline==null)inline=part.optJSONObject("inline_data");
                if(inline!=null){
                    String data=inline.optString("data","");
                    if(!data.isEmpty())try{enqueueAudio(Base64.decode(data,Base64.DEFAULT));}catch(Exception ignored){}
                }
            }
        }
        boolean complete=server.optBoolean("turnComplete",false)||server.optBoolean("turn_complete",false);
        if(complete){
            boolean hadTool=currentTurnHadTool;currentTurnHadTool=false;suppressCurrentTurnAudio=true;
            if(listener!=null)listener.onTurnComplete(hadTool);
        }
    }

    private JSONObject buildSetup() throws Exception{
        JSONObject generation=new JSONObject().put("responseModalities",new JSONArray().put("AUDIO"));
        generation.put("speechConfig",new JSONObject().put("voiceConfig",new JSONObject().put("prebuiltVoiceConfig",new JSONObject().put("voiceName","Puck"))));
        JSONObject setup=new JSONObject().put("model","models/"+MODEL).put("generationConfig",generation)
                .put("systemInstruction",new JSONObject().put("parts",new JSONArray().put(new JSONObject().put("text",SYSTEM_PROMPT))))
                .put("outputAudioTranscription",new JSONObject())
                .put("tools",new JSONArray().put(new JSONObject().put("functionDeclarations",new JSONArray().put(GeminiWorldToolSchema.declaration()))));
        return new JSONObject().put("setup",setup);
    }

    private void startAudio(){
        if(audioRunning)return;
        try{
            int min=AudioTrack.getMinBufferSize(24_000,AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT);
            int bufferSize=Math.max(min*3,36_000);
            player=new AudioTrack.Builder()
                    .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                    .setAudioFormat(new AudioFormat.Builder().setSampleRate(24_000).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
                    .setBufferSizeInBytes(bufferSize).setTransferMode(AudioTrack.MODE_STREAM).build();
            player.play();audioRunning=true;
            audioThread=new Thread(()->{
                while(audioRunning){
                    try{
                        byte[] pcm=audioQueue.poll(350,TimeUnit.MILLISECONDS);if(pcm==null)continue;
                        synchronized(audioLock){
                            AudioTrack p=player;if(!suppressCurrentTurnAudio&&p!=null&&p.getState()==AudioTrack.STATE_INITIALIZED)p.write(pcm,0,pcm.length,AudioTrack.WRITE_BLOCKING);
                        }
                    }catch(InterruptedException e){Thread.currentThread().interrupt();break;}
                    catch(Exception e){Log.w(TAG,"audio playback error",e);}
                }
            },"gemini-audio-playback");
            audioThread.start();
        }catch(Exception e){Log.w(TAG,"Unable to initialize AudioTrack",e);}
    }

    private void enqueueAudio(byte[] pcm){
        if(!VOICE_OUTPUT_ENABLED||pcm==null||pcm.length==0||suppressCurrentTurnAudio)return;
        if(listener!=null)listener.onAudioActivity();
        if(!audioQueue.offer(pcm)){audioQueue.poll();audioQueue.offer(pcm);}
    }

    private void stopAudio(){
        audioRunning=false;audioQueue.clear();if(audioThread!=null)audioThread.interrupt();audioThread=null;
        synchronized(audioLock){
            try{if(player!=null){player.pause();player.flush();player.stop();player.release();}}catch(Exception ignored){}
            player=null;
        }
    }

    private static final String SYSTEM_PROMPT=
            "You are a SILENT asynchronous creative director for the Storm Control Room pilot. "+
            "AI voice is disabled: NEVER speak, narrate, joke, banter, or produce a spoken line. Tool calls only. "+
            "ExperienceRuntime and StormControlSceneRuntime own rendering, interaction, timing and safety; never put model latency in the touch path. "+
            "For every GAME_TURN call apply_world_experience exactly once and keep world SUMMER_STORM. "+
            "DIRECTIVE.context.scene is physical truth: phase, charge, overload, breach, node charge, last zone and reveal cycle. Never reset it. "+
            "Use the plan only to bias background direction: door, observation window, cables, reroute nodes, false calm, reveal, misdirection or recovery. "+
            "Do not invent modal mini-games, search overlays, text instructions, frame data, raw code, particle coordinates, or a different world. "+
            "The player should understand the scene visually; no speech field is available.";
}
