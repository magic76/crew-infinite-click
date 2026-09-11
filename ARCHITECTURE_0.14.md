# Architecture 0.14 — Tap-first

The product invariant is: **every tap advances the experience**.

Input -> GameRuntime:
- target tap -> target branch + tap-driven mechanic
- empty-space tap -> world branch + tap-driven mechanic
- both -> MomentumEngine -> clickSpeed -> AI context

Gemini:
- observes clickSpeed / momentum / phase
- chooses mechanic, scene, speech, and optional next `tapEffect`
- never decides whether a tap is allowed or correct

Runtime:
- guarantees touch forgiveness
- executes high-frequency animation locally
- consumes nextTapEffect on the next tap
- keeps all target/world taps valid

Renderer:
- visual complexity may increase
- input complexity must not increase with it
