# World Identity Regression Fix

This follow-up restores the six existing effect worlds without restoring the removed tap-count phase loop.

- Session is no longer pinned to `NEON_RIFT`.
- World changes repaint the target and a cheap static Pixi background identity.
- Ambient pooled particles are recycled/redrawn when the world changes instead of inheriting the previous world's particles.
- NORMAL/BUSY/CHAOS local input feedback is now world-specific using the existing effect library.
- QUIET remains intentionally sparse.
- No per-tap Gemini dependency was reintroduced.
- No Canvas2D shatter path was reintroduced.
- No fixed `tap % 8` gameplay loop was reintroduced.
