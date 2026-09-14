(function(global){
  "use strict";

  const PATHS={
    worlds:{
      CANDY_TOY_ROOM:"art/worlds/candy-toy-room.png",
      CRYSTAL_SKY_GARDEN:"art/worlds/crystal-sky-garden.png",
      UNDERWATER_BUBBLE_PALACE:"art/worlds/underwater-bubble-palace.png",
      STARLIGHT_CARNIVAL:"art/worlds/starlight-carnival.png"
    },
    bg:{
      backdrop:"art/backgrounds/backdrop.svg",
      playfield:"art/backgrounds/playfield.svg",
      foreground:"art/backgrounds/foreground.svg"
    },
    objects:{
      BUMPER:{idle:"art/objects/bumper-idle.svg",active:"art/objects/bumper-hit.svg"},
      GIFT:{idle:"art/objects/gift-closed.svg",active:"art/objects/gift-open.svg"},
      BALLOON:{idle:"art/objects/balloon-idle.svg",active:"art/objects/balloon-pop.svg"},
      SPRING:{idle:"art/objects/spring-idle.svg",active:"art/objects/spring-hit.svg"}
    },
    fx:{
      hit:"art/fx/hit-burst.svg",
      graze:"art/fx/graze-burst.svg",
      collision:"art/fx/collision-burst.svg"
    }
  };

  const CACHE=new Map();
  const STATUS=new Map();
  const IMAGE_CACHE=new Map();

  function flatten(){
    const out=[];
    for(const [k,v] of Object.entries(PATHS.worlds))out.push([`world.${k}`,v]);
    for(const [k,v] of Object.entries(PATHS.bg))out.push([`bg.${k}`,v]);
    for(const [type,pair] of Object.entries(PATHS.objects))for(const [state,path] of Object.entries(pair))out.push([`object.${type}.${state}`,path]);
    for(const [k,v] of Object.entries(PATHS.fx))out.push([`fx.${k}`,v]);
    return out;
  }

  function mimeFor(path){
    if(/\.svg$/i.test(path))return "image/svg+xml";
    if(/\.png$/i.test(path))return "image/png";
    return "application/octet-stream";
  }

  function resolveUrl(path){
    const rel=String(path||"").replace(/^\/+/,"");
    try{
      const encoded=global.AndroidGame&&global.AndroidGame.loadAssetData?global.AndroidGame.loadAssetData("game/"+rel):"";
      if(encoded)return `data:${mimeFor(rel)};base64,${encoded}`;
    }catch(_){ }
    return rel;
  }

  async function imageFor(path){
    const rel=String(path||"");
    if(IMAGE_CACHE.has(rel))return IMAGE_CACHE.get(rel);
    const promise=new Promise((resolve,reject)=>{
      const img=new Image();
      img.decoding="async";
      img.onload=()=>resolve(img);
      img.onerror=(e)=>reject(new Error("image load failed: "+rel));
      img.src=resolveUrl(rel);
    });
    IMAGE_CACHE.set(rel,promise);
    return promise;
  }

  async function loadTexture(key,path){
    STATUS.set(key,{state:"loading",path});
    try{
      // Pixi v8's asset parser keeps SVG texture sources renderable on Android
      // WebView/WebGL.  Keep the v21 manual Image path for raster assets, but
      // avoid binding SVG ImageElements directly (which can become black quads).
      const isSvg=/\.svg$/i.test(path);
      const url=resolveUrl(path);
      const texture=isSvg&&global.PIXI&&global.PIXI.Assets&&global.PIXI.Assets.load
        ?await global.PIXI.Assets.load(url)
        :global.PIXI.Texture.from(await imageFor(path));
      const source=texture&&texture.source;
      const width=texture&&texture.width||source&&source.width||0;
      const height=texture&&texture.height||source&&source.height||0;
      CACHE.set(key,texture);
      STATUS.set(key,{state:"ready",path,width,height});
      return texture;
    }catch(err){
      console.warn("[ProductionAssetArt] failed to load",path,err);
      CACHE.set(key,global.PIXI.Texture.WHITE);
      STATUS.set(key,{state:"fallback",path,error:String(err&&err.message||err)});
      return global.PIXI.Texture.WHITE;
    }
  }

  async function loadAll(){
    if(loadAll._promise)return loadAll._promise;
    loadAll._promise=Promise.all(flatten().map(([key,path])=>loadTexture(key,path))).then(()=>CACHE);
    return loadAll._promise;
  }

  function texture(key){return CACHE.get(key)||global.PIXI.Texture.WHITE;}
  function status(){return Array.from(STATUS.entries()).reduce((acc,[k,v])=>(acc[k]=v,acc),{});}

  global.ProductionAssetArt={PATHS,loadAll,texture,status};
})(window);
