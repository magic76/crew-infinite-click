(function (global) {
  "use strict";

  const DIMENSIONS = {
    interaction:["TAP","HOLD","DRAG","SLICE","WAIT"],
    spatial:["NONE","GRAVITY_DOWN","GRAVITY_SIDE","ORBIT","PUSH_AWAY"],
    reveal:["NONE","SPOTLIGHT","FOG_REVEAL","BLACKOUT"],
    camera:["STATIC","ZOOM_IN","ZOOM_OUT","FOLLOW","PAN"],
    surface:["NONE","FRAGMENT","TRAIL","LIQUID"],
    timing:["SNAP","TENSION","DELAYED","REVERSAL"]
  };

  const WORLD_VOCAB = {
    SPRING_BLOOM:{spatial:["NONE","ORBIT","PUSH_AWAY"],reveal:["NONE","SPOTLIGHT","FOG_REVEAL"],camera:["STATIC","ZOOM_OUT","FOLLOW"],surface:["NONE","TRAIL","LIQUID"],timing:["SNAP","TENSION","DELAYED"]},
    SUMMER_STORM:{spatial:["GRAVITY_DOWN","GRAVITY_SIDE","PUSH_AWAY"],reveal:["NONE","BLACKOUT","SPOTLIGHT"],camera:["STATIC","ZOOM_IN","FOLLOW","PAN"],surface:["NONE","FRAGMENT","TRAIL"],timing:["SNAP","TENSION","REVERSAL"]},
    AUTUMN_DECAY:{spatial:["NONE","GRAVITY_DOWN","ORBIT"],reveal:["NONE","FOG_REVEAL","SPOTLIGHT"],camera:["STATIC","ZOOM_OUT","PAN"],surface:["NONE","FRAGMENT","TRAIL"],timing:["DELAYED","TENSION","REVERSAL"]},
    WINTER_FROST:{spatial:["NONE","GRAVITY_DOWN","PUSH_AWAY"],reveal:["SPOTLIGHT","FOG_REVEAL","BLACKOUT"],camera:["STATIC","ZOOM_IN","ZOOM_OUT"],surface:["NONE","FRAGMENT","TRAIL"],timing:["TENSION","SNAP","DELAYED"]},
    VOID_CHAMBER:{spatial:["GRAVITY_DOWN","GRAVITY_SIDE","ORBIT","PUSH_AWAY"],reveal:["BLACKOUT","SPOTLIGHT","FOG_REVEAL"],camera:["ZOOM_IN","ZOOM_OUT","FOLLOW","PAN"],surface:["NONE","FRAGMENT","LIQUID"],timing:["TENSION","DELAYED","REVERSAL"]},
    NEON_RIFT:{spatial:["NONE","GRAVITY_SIDE","ORBIT","PUSH_AWAY"],reveal:["NONE","BLACKOUT","SPOTLIGHT"],camera:["STATIC","ZOOM_IN","FOLLOW","PAN"],surface:["FRAGMENT","TRAIL","LIQUID","NONE"],timing:["SNAP","REVERSAL","DELAYED"]}
  };

  const INTENTS=["TEASE","TEST_PATIENCE","MISDIRECT","CHASE","SEARCH","TRUST_TEST","PREDICT","SURPRISE","RECOVER"];

  function isAllowed(dim,value){ return !!(DIMENSIONS[dim]&&DIMENSIONS[dim].includes(value)); }
  function worldPool(world,dim){ const w=WORLD_VOCAB[world]||WORLD_VOCAB.NEON_RIFT; return (w[dim]||DIMENSIONS[dim]||[]).slice(); }

  global.ExperiencePrimitiveCatalog={DIMENSIONS,WORLD_VOCAB,INTENTS,isAllowed,worldPool};
})(window);
