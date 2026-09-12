package com.magic76.aiclicker;

import org.json.JSONArray;
import org.json.JSONObject;

/** High-level creative-director tool. No frame data, code, raw HTML/JS, or particle coordinates. */
public final class GeminiWorldToolSchema {
    public static final String FUNCTION_NAME="apply_world_experience";
    private GeminiWorldToolSchema(){}

    public static JSONObject declaration(){
        JSONObject p=new JSONObject();
        try{
            p.put("turnId",new JSONObject().put("type","INTEGER").put("description","Echo exact turnId from DIRECTIVE."));
            p.put("baseStateVersion",new JSONObject().put("type","INTEGER").put("description","Echo exact baseStateVersion from DIRECTIVE."));
            p.put("world",enumString("Visual/gameplay world.","SPRING_BLOOM","SUMMER_STORM","AUTUMN_DECAY","WINTER_FROST","VOID_CHAMBER","NEON_RIFT"));
            p.put("mood",enumString("Emotional tone.","PLAYFUL","EERIE","CALM","CHAOTIC"));
            p.put("situation",enumString("Situation for the next several seconds.","CHASE","DECOY","WAIT","PREDICT","MIRROR","HIDE","REVEAL","FAKE_ENDING"));
            p.put("audioMood",enumString("Local SFX palette.","ORGANIC","STORM","DRY","GLASS","COSMIC","GLITCH"));
            p.put("targetBehavior",enumString("Primary target behavior.","STILL","ESCAPE","SPLIT","PULSE","HIDE"));
            p.put("ruleTwist",enumString("Optional temporary rule.","NONE","WAIT_TO_WIN","TAP_THE_SHADOW","FOLLOW_THE_SOUND","DONT_TOUCH_CENTER","LEFT_RIGHT_REVERSED"));
            p.put("experienceIntent",enumString("High-level intent.","TEASE","TEST_PATIENCE","MISDIRECT","CHASE","SEARCH","TRUST_TEST","PREDICT","SURPRISE","RECOVER"));
            p.put("signatureMoment",enumString("Signature moments are retired. Always NONE.","NONE"));

            JSONObject cp=new JSONObject()
                    .put("interaction",enumString("Primary input.","TAP","HOLD","DRAG","SLICE","WAIT"))
                    .put("spatial",enumString("Spatial rule.","NONE","GRAVITY_DOWN","GRAVITY_SIDE","ORBIT","PUSH_AWAY"))
                    .put("reveal",enumString("Reveal rule.","NONE","SPOTLIGHT","FOG_REVEAL","BLACKOUT"))
                    .put("camera",enumString("Camera behavior.","STATIC","ZOOM_IN","ZOOM_OUT","FOLLOW","PAN"))
                    .put("surface",enumString("Surface behavior.","NONE","FRAGMENT","TRAIL","LIQUID"))
                    .put("timing",enumString("Sequencing style.","SNAP","TENSION","DELAYED","REVERSAL"));
            p.put("composition",new JSONObject().put("type","OBJECT").put("properties",cp)
                    .put("description","Compose existing safe primitives only. Do not invent a primitive."));
            p.put("speech",new JSONObject().put("type","STRING").put("description","Optional very short in-character line. Never narrate the obvious visual."));
            p.put("intensity",new JSONObject().put("type","NUMBER").put("minimum",0).put("maximum",1));
            p.put("surpriseLevel",new JSONObject().put("type","NUMBER").put("minimum",0).put("maximum",1));
            p.put("sensoryDensity",new JSONObject().put("type","INTEGER").put("minimum",0).put("maximum",3)
                    .put("description","0 QUIET, 1 NORMAL, 2 BUSY, 3 short CHAOS. Use 0/1 often; 3 rarely."));
            p.put("visualEffect",enumString("Existing effect request. Prefer AUTO.","AUTO","PETAL_BLOOM","STORM_FLASH","RAIN_BURST","LEAF_FALL","DUST_DISSOLVE","FREEZE_CRACK","FROST_PULSE","VOID_SUCTION","GRAVITY_WELL","BLACKOUT_REVEAL","GLITCH_BARS","NEON_SLICE","PIXEL_SCATTER","MIRROR_SPLIT","SHOCKWAVE","ECHO_RINGS","SPOTLIGHT","SOFT_FADE"));
            p.put("hapticCue",enumString("Optional haptic suggestion.","AUTO","NONE","SOFT_TAP","CORRECT","WRONG","WARNING","ICE_TICK","DRY_DOUBLE","DIGITAL_TRIPLE","THUNDER","VOID_PULL","HEARTBEAT","IMPACT"));
        }catch(Exception ignored){}

        JSONObject params=new JSONObject();
        try{
            params.put("type","OBJECT").put("properties",p)
                    .put("required",new JSONArray().put("turnId").put("baseStateVersion").put("world").put("mood")
                            .put("situation").put("audioMood").put("targetBehavior").put("intensity").put("surpriseLevel"));
        }catch(Exception ignored){}

        JSONObject out=new JSONObject();
        try{out.put("name",FUNCTION_NAME).put("description","Suggest one validated high-level experience plan. ExperienceRuntime is authoritative and applies it asynchronously.").put("parameters",params);}
        catch(Exception ignored){}
        return out;
    }

    public static String buildToolResponse(String callId,JSONObject result){
        JSONObject root=new JSONObject();
        try{
            JSONObject response=new JSONObject().put("result",result==null?new JSONObject().put("ok",true):result);
            JSONObject fr=new JSONObject().put("name",FUNCTION_NAME).put("response",response);
            if(callId!=null&&!callId.isEmpty())fr.put("id",callId);
            root.put("toolResponse",new JSONObject().put("functionResponses",new JSONArray().put(fr)));
        }catch(Exception ignored){}
        return root.toString();
    }

    private static JSONObject enumString(String description,String...values){
        JSONObject out=new JSONObject();try{
            JSONArray a=new JSONArray();for(String v:values)a.put(v);
            out.put("type","STRING").put("description",description).put("enum",a);
        }catch(Exception ignored){}return out;
    }
}
