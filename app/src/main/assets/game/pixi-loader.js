(() => {
  'use strict';
  const PIXI_VERSION = '8.20.1';
  const candidates = [
    'pixi.min.js',
    'https://cdn.jsdelivr.net/npm/pixi.js@' + PIXI_VERSION + '/dist/pixi.min.js'
  ];
  let index = 0;

  const hideLegacyActionButton = () => {
    const proto = window.PIXI && PIXI.Container && PIXI.Container.prototype;
    if (!proto || !proto.addChild || proto.addChild.__legacyButtonHider) return;
    const original = proto.addChild;
    const patched = function (...children) {
      for (const child of children) {
        if (child && child.label === 'action-button') {
          child.visible = false;
          proto.addChild = original;
          break;
        }
      }
      return original.apply(this, children);
    };
    patched.__legacyButtonHider = true;
    proto.addChild = patched;
  };

  const loadGame = () => {
    hideLegacyActionButton();
    const s = document.createElement('script');
    s.src = 'game.js';
    s.onerror = () => window.AndroidGame && AndroidGame.onRendererError('game.js failed to load');
    document.body.appendChild(s);
  };
  const next = () => {
    if (window.PIXI) return loadGame();
    if (index >= candidates.length) {
      const msg = 'PixiJS ' + PIXI_VERSION + ' unavailable (local asset missing and CDN failed)';
      document.getElementById('fatal').style.display = 'grid';
      document.getElementById('fatal').textContent = msg;
      try { window.AndroidGame && AndroidGame.onRendererError(msg); } catch (_) {}
      return;
    }
    const s = document.createElement('script');
    s.src = candidates[index++];
    s.onload = () => window.PIXI ? loadGame() : next();
    s.onerror = next;
    document.head.appendChild(s);
  };
  next();
})();
