(function(global){
  "use strict";

  const PATHS={
    bg:{backdrop:"art/backgrounds/backdrop.svg",playfield:"art/backgrounds/playfield.svg",foreground:"art/backgrounds/foreground.svg"},
    worlds:{
      CANDY_TOY_ROOM:"art/backgrounds/world-candy-toy-room.svg",
      CRYSTAL_SKY_GARDEN:"art/backgrounds/world-crystal-sky-garden.svg",
      UNDERWATER_BUBBLE_PALACE:"art/backgrounds/world-underwater-bubble-palace.svg",
      STARLIGHT_CARNIVAL:"art/backgrounds/world-starlight-carnival.svg"
    },
    objects:{
      BUMPER:{idle:"art/objects/bumper-idle.svg",active:"art/objects/bumper-hit.svg"},
      GIFT:{idle:"art/objects/gift-closed.svg",active:"art/objects/gift-open.svg"},
      BALLOON:{idle:"art/objects/balloon-idle.svg",active:"art/objects/balloon-pop.svg"},
      SPRING:{idle:"art/objects/spring-idle.svg",active:"art/objects/spring-hit.svg"}
    },
    fx:{hit:"art/fx/hit-burst.svg",graze:"art/fx/graze-burst.svg",collision:"art/fx/collision-burst.svg"}
  };

  const CACHE=new Map();
  const flatten=()=>{
    const out=[];
    for(const [k,v] of Object.entries(PATHS.bg))out.push([`bg.${k}`,v]);
    for(const [k,v] of Object.entries(PATHS.worlds))out.push([`world.${k}`,v]);
    for(const [type,pair] of Object.entries(PATHS.objects))for(const [state,path] of Object.entries(pair))out.push([`object.${type}.${state}`,path]);
    for(const [k,v] of Object.entries(PATHS.fx))out.push([`fx.${k}`,v]);
    return out;
  };

  function resolveUrl(path){
    const rel=String(path||"").replace(/^\/+/,"");
    try{
      const encoded=global.AndroidGame&&global.AndroidGame.loadAssetData?global.AndroidGame.loadAssetData("game/"+rel):"";
      if(encoded){
        const mime=rel.endsWith(".svg")?"image/svg+xml":"image/png";
        return `data:${mime};base64,${encoded}`;
      }
    }catch(_){ }
    return rel;
  }

  async function loadAll(){
    if(loadAll._promise)return loadAll._promise;
    loadAll._promise=Promise.all(flatten().map(async([key,path])=>{
      const url=resolveUrl(path);
      let texture=null;
      try{
        texture=global.PIXI&&global.PIXI.Assets&&global.PIXI.Assets.load?await global.PIXI.Assets.load(url):global.PIXI.Texture.from(url);
      }catch(err){
        console.warn("[ProductionAssetArt] failed to load",path,err);
        texture=global.PIXI.Texture.WHITE;
      }
      CACHE.set(key,texture);
      return texture;
    })).then(()=>CACHE);
    return loadAll._promise;
  }

  function texture(key){return CACHE.get(key)||global.PIXI.Texture.WHITE;}

  global.ProductionAssetArt={PATHS,loadAll,texture};
})(window);
