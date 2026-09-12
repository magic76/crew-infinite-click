(function (global) {
  "use strict";

  const SITUATIONS = ["CHASE","DECOY","WAIT","PREDICT","MIRROR","HIDE","REVEAL","FAKE_ENDING"];

  const WORLDS = {
    SPRING_BLOOM: {
      id:"SPRING_BLOOM", audioMood:"ORGANIC", bg:0xF3F7EA, accent:0x9ACD72, secondary:0xF1B8C4,
      particle:"petal", motion:"float",
      situationWeights:{ WAIT:1.55,REVEAL:1.45,HIDE:1.15,PREDICT:1.05,CHASE:0.72,DECOY:0.85,MIRROR:0.78,FAKE_ENDING:0.55 }
    },
    SUMMER_STORM: {
      id:"SUMMER_STORM", audioMood:"STORM", bg:0x10253A, accent:0xF7DB61, secondary:0x69B9E8,
      particle:"spark", motion:"burst",
      situationWeights:{ CHASE:1.55,DECOY:1.20,PREDICT:1.15,REVEAL:1.0,WAIT:0.65,HIDE:0.82,MIRROR:0.95,FAKE_ENDING:0.75 }
    },
    AUTUMN_DECAY: {
      id:"AUTUMN_DECAY", audioMood:"DRY", bg:0x2B221D, accent:0xD8874F, secondary:0xA7A06A,
      particle:"leaf", motion:"fall",
      situationWeights:{ HIDE:1.35,REVEAL:1.25,DECOY:1.1,WAIT:1.05,CHASE:0.85,PREDICT:0.9,MIRROR:0.95,FAKE_ENDING:0.9 }
    },
    WINTER_FROST: {
      id:"WINTER_FROST", audioMood:"GLASS", bg:0xEAF3F8, accent:0x78BBD7, secondary:0xB6D7E7,
      particle:"snow", motion:"drift",
      situationWeights:{ WAIT:1.55,HIDE:1.35,REVEAL:1.28,PREDICT:1.0,CHASE:0.72,DECOY:0.82,MIRROR:0.95,FAKE_ENDING:0.65 }
    },
    VOID_CHAMBER: {
      id:"VOID_CHAMBER", audioMood:"COSMIC", bg:0x080A12, accent:0x7A6CF6, secondary:0x39C6C8,
      particle:"dust", motion:"orbit",
      situationWeights:{ MIRROR:1.45,PREDICT:1.35,HIDE:1.25,FAKE_ENDING:1.15,CHASE:0.95,DECOY:1.05,WAIT:0.85,REVEAL:1.0 }
    },
    NEON_RIFT: {
      id:"NEON_RIFT", audioMood:"GLITCH", bg:0x0B0710, accent:0xE83CF6, secondary:0x34F0C3,
      particle:"pixel", motion:"jitter",
      situationWeights:{ CHASE:1.35,DECOY:1.45,MIRROR:1.2,PREDICT:1.2,WAIT:0.65,HIDE:1.0,REVEAL:0.95,FAKE_ENDING:1.0 }
    }
  };

  global.GameWorldCatalog = {
    WORLDS,
    WORLD_IDS:Object.keys(WORLDS),
    SITUATIONS,
    RULE_TWISTS:["NONE","WAIT_TO_WIN","TAP_THE_SHADOW","FOLLOW_THE_SOUND","DONT_TOUCH_CENTER","LEFT_RIGHT_REVERSED"],
    TARGET_BEHAVIORS:["STILL","ESCAPE","SPLIT","PULSE","HIDE"],
    MOODS:["PLAYFUL","EERIE","CALM","CHAOTIC"]
  };
})(window);
