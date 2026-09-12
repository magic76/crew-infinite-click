(function (global) {
  "use strict";

  const state = { left: 0, top: 0, right: 0, bottom: 0 };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function sanitize(value) {
    const n = Number(value);
    return Number.isFinite(n) ? clamp(Math.round(n), 0, 240) : 0;
  }

  function applyCssVars() {
    const root = global.document && global.document.documentElement;
    if (!root) return;
    root.style.setProperty("--safe-left", state.left + "px");
    root.style.setProperty("--safe-top", state.top + "px");
    root.style.setProperty("--safe-right", state.right + "px");
    root.style.setProperty("--safe-bottom", state.bottom + "px");
  }

  function snapshot() {
    return { left: state.left, top: state.top, right: state.right, bottom: state.bottom };
  }

  function setInsets(next) {
    next = next || {};
    state.left = sanitize(next.left);
    state.top = sanitize(next.top);
    state.right = sanitize(next.right);
    state.bottom = sanitize(next.bottom);
    applyCssVars();
    try {
      global.dispatchEvent(new CustomEvent("game-safe-area-change", { detail: snapshot() }));
    } catch (_) {}
    return snapshot();
  }

  function interactiveBounds(width, height, options) {
    const w = Number.isFinite(width) ? width : global.innerWidth;
    const h = Number.isFinite(height) ? height : global.innerHeight;
    const o = options || {};
    const padding = Number.isFinite(o.padding) ? o.padding : 14;
    const hudHeight = Number.isFinite(o.hudHeight) ? o.hudHeight : 52;
    const captionHeight = Number.isFinite(o.captionHeight) ? o.captionHeight : 84;

    const left = state.left + padding;
    const top = state.top + hudHeight + padding;
    const right = Math.max(left + 1, w - state.right - padding);
    const bottom = Math.max(top + 1, h - state.bottom - captionHeight - padding);
    return { left, top, right, bottom, width: Math.max(1, right-left), height: Math.max(1, bottom-top) };
  }

  function clampPoint(x, y, width, height, options) {
    const b = interactiveBounds(width, height, options);
    return { x: clamp(Number(x) || 0, b.left, b.right), y: clamp(Number(y) || 0, b.top, b.bottom) };
  }

  function randomPoint(width, height, margin, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    const extra = Number.isFinite(margin) ? margin : 20;
    const b = interactiveBounds(width, height, { padding: 14 + extra });
    return { x: b.left + random()*b.width, y: b.top + random()*b.height };
  }

  global.GameSafeArea = { setInsets, snapshot, interactiveBounds, clampPoint, randomPoint };
  applyCssVars();
})(window);
