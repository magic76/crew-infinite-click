# 0.3 - Responsiveness pass

- Every valid button tap now grants an immediate local +2 score, or +3 for fast reactions under 650ms.
- Immediate score popup and button pulse happen before any Gemini response.
- Added native haptic tap feedback.
- Shortened motion/press animations for snappier feel.
- Reduced no-action Gemini watchdog from 12s to 2.5s; if Live produces no usable tool action, local director takes over quickly.
- Updated Gemini director prompt to use score changes frequently: successful interactions +5..+25, clear mistakes/traps -5..-20.
- Gemini remains responsible for the larger game mutation; the new local layer only provides instant micro-feedback.
