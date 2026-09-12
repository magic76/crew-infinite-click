(function(global){
  "use strict";
  const samples=[
    {name:"hold spotlight",plan:{world:"VOID_CHAMBER",mood:"EERIE",situation:"HIDE",audioMood:"COSMIC",targetBehavior:"PULSE",ruleTwist:"NONE",experienceIntent:"TEST_PATIENCE",composition:{interaction:"HOLD",spatial:"ORBIT",reveal:"SPOTLIGHT",camera:"ZOOM_IN",surface:"NONE",timing:"TENSION"},speech:"別放手。",intensity:.55,surpriseLevel:.45,sensoryDensity:1,actions:[]}},
    {name:"gravity follow",plan:{world:"SUMMER_STORM",mood:"CHAOTIC",situation:"CHASE",audioMood:"STORM",targetBehavior:"ESCAPE",ruleTwist:"NONE",experienceIntent:"CHASE",composition:{interaction:"TAP",spatial:"GRAVITY_DOWN",reveal:"NONE",camera:"FOLLOW",surface:"NONE",timing:"SNAP"},speech:"接住它。",intensity:.68,surpriseLevel:.58,sensoryDensity:2,actions:[]}},
    {name:"drag trail",plan:{world:"SPRING_BLOOM",mood:"PLAYFUL",situation:"REVEAL",audioMood:"ORGANIC",targetBehavior:"STILL",ruleTwist:"NONE",experienceIntent:"SEARCH",composition:{interaction:"DRAG",spatial:"NONE",reveal:"FOG_REVEAL",camera:"STATIC",surface:"TRAIL",timing:"DELAYED"},speech:"拖開看看。",intensity:.45,surpriseLevel:.4,sensoryDensity:1,actions:[]}},
    {name:"slice fragment",plan:{world:"NEON_RIFT",mood:"CHAOTIC",situation:"DECOY",audioMood:"GLITCH",targetBehavior:"SPLIT",ruleTwist:"NONE",experienceIntent:"SURPRISE",composition:{interaction:"SLICE",spatial:"NONE",reveal:"BLACKOUT",camera:"STATIC",surface:"FRAGMENT",timing:"SNAP"},speech:"切開它。",intensity:.78,surpriseLevel:.9,sensoryDensity:3,actions:[]}}
  ];
  global.runCompositionShowcase=function(experience,stepMs){
    if(!experience||typeof experience.applyAiPlan!=="function")throw new Error("ExperienceRuntime instance required");
    const gap=Math.max(1800,Number(stepMs)||5000);let i=0;
    function next(){if(i>=samples.length)return;const s=samples[i++];console.log("[0.35 showcase]",s.name,s.plan.composition);experience.applyAiPlan(JSON.parse(JSON.stringify(s.plan)));if(i<samples.length)setTimeout(next,gap);}
    next();
  };
})(window);
