package com.magic76.aiclicker;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

/**
 * Android transport shell only.
 * Gameplay ownership lives in JS ExperienceRuntime; this class never invents or applies a local gameplay plan.
 */
public final class MainActivity extends Activity {
    private static final String PREFS="ai_infinite_click";
    private static final String KEY_API="gemini_api_key";
    private static final String KEY_LANGUAGE="game_language";

    private final Handler mainHandler=new Handler(Looper.getMainLooper());
    private final StringBuilder transcriptBuffer=new StringBuilder();

    private GameView gameView;
    private GeminiLiveClient liveClient;
    private SharedPreferences prefs;
    private DirectiveTurn activeTurn;
    private DirectiveTurn queuedTurn;
    private Runnable turnWatchdog;
    private boolean activeToolApplied=false;
    private boolean destroyed=false;
    private int reconnectAttempts=0;
    private AppLanguage currentLanguage=AppLanguage.ZH_TW;

    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        configureSystemBars();

        prefs=getSharedPreferences(PREFS,MODE_PRIVATE);
        currentLanguage=AppLanguage.fromCode(prefs.getString(KEY_LANGUAGE,AppLanguage.ZH_TW.code));
        gameView=new GameView(this);
        gameView.setLanguage(currentLanguage);
        gameView.setSettingsTapListener(this::showApiKeyDialog);
        gameView.setLanguageChangeListener(this::onLanguageChanged);
        gameView.setExperienceDirectiveListener(this::onExperienceDirective);
        gameView.setRuntimeSignalListener(this::onRuntimeSignal);
        setContentView(gameView);

        String key=prefs.getString(KEY_API,"");
        if(key!=null&&!key.trim().isEmpty())connectLive(key.trim(),false);
        else gameView.setConnectionStatus("DEMO");
    }

    private void onLanguageChanged(AppLanguage language){
        currentLanguage=language==null?AppLanguage.ZH_TW:language;
        prefs.edit().putString(KEY_LANGUAGE,currentLanguage.code).apply();
    }

    private void onExperienceDirective(String json){
        if(destroyed||json==null||json.trim().isEmpty())return;
        try{
            JSONObject envelope=new JSONObject(json);
            envelope.put("language",currentLanguage.code);
            DirectiveTurn turn=new DirectiveTurn(envelope);
            if(turn.mode.equals("SILENT"))return;
            if(activeTurn!=null){
                if(queuedTurn==null||turn.mode.equals("GAME_TURN")||!queuedTurn.mode.equals("GAME_TURN"))queuedTurn=turn;
                return;
            }
            beginTurn(turn);
        }catch(Exception ignored){}
    }

    private void onRuntimeSignal(String json){
        if(json==null)return;
        try{
            JSONObject signal=new JSONObject(json);
            String type=signal.optString("type","");
            if("INVALIDATE_GEMINI".equals(type)){
                queuedTurn=null;
                cancelActiveTurn(false);
            }
        }catch(Exception ignored){}
    }

    private void beginTurn(DirectiveTurn turn){
        if(destroyed||turn==null)return;
        GeminiLiveClient client=liveClient;
        if(client==null||!client.isReady()){
            if(turn.isGameTurn())gameView.notifyGeminiFallback(turn.turnId);
            gameView.setGeminiPending(false);
            return;
        }

        activeTurn=turn;activeToolApplied=false;transcriptBuffer.setLength(0);
        gameView.setGeminiPending(true);gameView.setVoiceActive(false);
        if(!client.sendEvent(turn.envelope)){
            if(turn.isGameTurn())gameView.notifyGeminiFallback(turn.turnId);
            finishActiveTurn();
            return;
        }
        armTurnWatchdog(turn);
    }

    private void armTurnWatchdog(DirectiveTurn turn){
        if(turnWatchdog!=null)mainHandler.removeCallbacks(turnWatchdog);
        turnWatchdog=()->{
            if(activeTurn!=turn)return;
            GeminiLiveClient c=liveClient;if(c!=null)c.suppressCurrentTurnAudio();
            if(turn.isGameTurn()&&!activeToolApplied)gameView.notifyGeminiFallback(turn.turnId);
            finishActiveTurn();
        };
        mainHandler.postDelayed(turnWatchdog,turn.isGameTurn()?2_800L:2_400L);
    }

    private void finishActiveTurn(){
        DirectiveTurn finished=activeTurn;
        activeTurn=null;activeToolApplied=false;
        if(turnWatchdog!=null)mainHandler.removeCallbacks(turnWatchdog);turnWatchdog=null;
        gameView.setGeminiPending(false);gameView.setVoiceActive(false);
        String spoken=transcriptBuffer.toString().trim();
        if(!spoken.isEmpty())gameView.recordSpokenLine(spoken);
        transcriptBuffer.setLength(0);
        if(destroyed)return;
        DirectiveTurn next=queuedTurn;queuedTurn=null;
        if(next!=null)mainHandler.post(()->beginTurn(next));
    }

    private void cancelActiveTurn(boolean fallback){
        DirectiveTurn turn=activeTurn;
        if(turn==null)return;
        GeminiLiveClient c=liveClient;if(c!=null)c.suppressCurrentTurnAudio();
        if(fallback&&turn.isGameTurn())gameView.notifyGeminiFallback(turn.turnId);
        finishActiveTurn();
    }

    private void connectLive(String key,boolean userInitiated){
        if(destroyed||key==null||key.trim().isEmpty())return;
        if(liveClient!=null)liveClient.close();
        if(userInitiated)reconnectAttempts=0;
        gameView.setConnectionStatus("CONNECTING");

        liveClient=new GeminiLiveClient(key.trim(),new GeminiLiveClient.Listener(){
            @Override public void onReady(){
                mainHandler.post(()->{
                    reconnectAttempts=0;gameView.setConnectionStatus("LIVE");
                    // JS owns the session. Ask it to create one fresh GAME_TURN now that Live is ready.
                    mainHandler.postDelayed(()->{if(!destroyed)gameView.requestLiveTurn();},160L);
                });
            }
            @Override public void onStatus(String status){mainHandler.post(()->gameView.setConnectionStatus(status));}

            @Override public void onGameTurn(String callId,JSONObject args){
                mainHandler.post(()->{
                    DirectiveTurn turn=activeTurn;
                    long responseTurnId=args==null?-1:args.optLong("turnId",-1L);
                    if(turn==null||!turn.isGameTurn()||responseTurnId!=turn.turnId){
                        GeminiLiveClient c=liveClient;if(c!=null)c.acknowledgeTool(callId,false,"stale or non-game turn");
                        return;
                    }
                    if(args.optLong("baseStateVersion",-1L)!=turn.baseStateVersion){
                        GeminiLiveClient c=liveClient;if(c!=null)c.acknowledgeTool(callId,false,"state version changed");
                        gameView.notifyGeminiFallback(turn.turnId);
                        finishActiveTurn();
                        return;
                    }
                    activeToolApplied=true;
                    gameView.applyExperiencePlan(args,turn.turnId);
                    GeminiLiveClient c=liveClient;if(c!=null)c.acknowledgeTool(callId,true,"validated; ExperienceRuntime owns application");
                });
            }

            @Override public void onTurnComplete(boolean hadToolCall){
                mainHandler.post(()->{
                    DirectiveTurn turn=activeTurn;if(turn==null)return;
                    if(turn.isGameTurn()&&!activeToolApplied)gameView.notifyGeminiFallback(turn.turnId);
                    finishActiveTurn();
                });
            }
            @Override public void onAudioActivity(){mainHandler.post(()->gameView.setVoiceActive(true));}
            @Override public void onTranscript(String text){mainHandler.post(()->appendTranscriptChunk(text));}
            @Override public void onError(String message){mainHandler.post(()->handleLiveError(key.trim(),message));}
        });
        liveClient.connect();
    }

    private void appendTranscriptChunk(String text){
        if(text==null)return;String chunk=text.replace('\n',' ').replaceAll("\\s+"," ").trim();if(chunk.isEmpty())return;
        String current=transcriptBuffer.toString();
        if(chunk.startsWith(current)&&chunk.length()>=current.length()){transcriptBuffer.setLength(0);transcriptBuffer.append(chunk);}
        else if(!current.endsWith(chunk)){if(needsBoundarySpace(current,chunk))transcriptBuffer.append(' ');transcriptBuffer.append(chunk);}
        gameView.setAiCaption(transcriptBuffer.toString().trim());
    }
    private boolean needsBoundarySpace(String left,String right){
        if(left==null||left.isEmpty()||right==null||right.isEmpty())return false;
        return isAsciiWord(left.charAt(left.length()-1))&&isAsciiWord(right.charAt(0));
    }
    private boolean isAsciiWord(char c){return(c>='A'&&c<='Z')||(c>='a'&&c<='z')||(c>='0'&&c<='9');}

    private void handleLiveError(String key,String message){
        if(destroyed)return;gameView.setConnectionStatus("DEMO");
        if(activeTurn!=null)cancelActiveTurn(true);
        if(key==null||key.isEmpty()||reconnectAttempts>=3)return;
        reconnectAttempts++;
        long delay=reconnectAttempts==1?2_000L:(reconnectAttempts==2?5_000L:10_000L);
        mainHandler.postDelayed(()->{if(!destroyed&&key.equals(prefs.getString(KEY_API,"")))connectLive(key,false);},delay);
    }

    @Override protected void onResume(){super.onResume();configureSystemBars();if(gameView!=null)gameView.onHostResume();}
    @Override protected void onPause(){if(gameView!=null)gameView.onHostPause();super.onPause();}
    @Override protected void onDestroy(){
        destroyed=true;queuedTurn=null;
        if(turnWatchdog!=null)mainHandler.removeCallbacks(turnWatchdog);
        if(liveClient!=null)liveClient.close();
        super.onDestroy();
    }

    private void showApiKeyDialog(){
        if(destroyed||isFinishing())return;
        final EditText input=new EditText(this);input.setSingleLine(true);input.setHint(text("Gemini API 金鑰","Gemini API key"));
        input.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        String current=prefs.getString(KEY_API,"");if(current!=null)input.setText(current);
        input.setSelectAllOnFocus(true);input.setTextColor(Color.WHITE);input.setHintTextColor(Color.GRAY);

        TextView note=new TextView(this);
        note.setText(text("MVP 只會把金鑰儲存在這個 App 的私有 SharedPreferences。正式版建議改成 ephemeral token 驗證。",
                "MVP stores the key only in this app's private SharedPreferences. For production, replace this with ephemeral-token auth."));
        note.setTextColor(Color.LTGRAY);note.setTextSize(13f);note.setPadding(0,18,0,8);

        LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);
        int pad=(int)(24*getResources().getDisplayMetrics().density);box.setPadding(pad,8,pad,0);
        box.addView(input,new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,LinearLayout.LayoutParams.WRAP_CONTENT));
        box.addView(note,new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,LinearLayout.LayoutParams.WRAP_CONTENT));

        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Gemini Live").setView(box)
                .setPositiveButton(text("儲存並連線","Save & connect"),null)
                .setNeutralButton(text("清除金鑰","Clear key"),null)
                .setNegativeButton(text("使用 DEMO","Use demo"),null).create();
        dialog.setOnShowListener(ignored->{
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
                String key=input.getText().toString().trim();
                if(key.isEmpty()){input.setError(text("請輸入金鑰，或選擇使用 DEMO","Enter a key or choose Use demo"));return;}
                prefs.edit().putString(KEY_API,key).apply();dialog.dismiss();connectLive(key,true);
            });
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v->{
                prefs.edit().remove(KEY_API).apply();if(liveClient!=null){liveClient.close();liveClient=null;}
                reconnectAttempts=0;cancelActiveTurn(true);gameView.setConnectionStatus("DEMO");dialog.dismiss();
            });
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener(v->{gameView.setConnectionStatus("DEMO");dialog.dismiss();});
        });
        dialog.show();
    }

    private String text(String zh,String en){return currentLanguage==AppLanguage.EN?en:zh;}

    private void configureSystemBars(){
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        getWindow().setStatusBarColor(Color.TRANSPARENT);getWindow().setNavigationBarColor(Color.TRANSPARENT);
    }

    private static final class DirectiveTurn {
        final JSONObject envelope;final String mode;final long turnId;final long baseStateVersion;
        DirectiveTurn(JSONObject envelope){
            this.envelope=envelope==null?new JSONObject():envelope;
            this.mode=this.envelope.optString("mode","SILENT").toUpperCase(java.util.Locale.ROOT);
            this.turnId=this.envelope.optLong("turnId",-1L);this.baseStateVersion=this.envelope.optLong("baseStateVersion",-1L);
        }
        boolean isGameTurn(){return"GAME_TURN".equals(mode);}
    }
}
