# Review iteration 2

## Scope

OpenAI Codex `gpt-5.6-sol` reviewed the stable committed range through `755d054` plus the canonical documentation diff. The prompt required live-code symbol/signature verification and explicit documentation-accuracy review. The CLI's read-only sandbox prevented it from executing focused tests, so the driver reproduced every code claim locally before acting. Anthropic remained blocked before execution by the tenant private-diff export policy; no source was sent to that provider.

## Findings and disposition

- **MEDIUM C1 — replay checkpoints could invent or drop motion during retained attack recovery. Fixed.** Recorder state now preserves movement cancellation; fresh midpoint reconstruction matches the warm attack channel and geometry, and playback's first frame establishes its wall clock without a synthetic tick.
- **MEDIUM C2 — a witnessed cue could disappear under fog and later resurrect as the same old strike. Fixed.** The raw store retains entity identity for later reveal, while final perspective filtering removes the cue and `RenderStore` tombstones that event tick until a genuinely newer strike arrives.
- **MEDIUM C3 — attack-controlled ambient motion snapped at the recovery boundary. Fixed.** Ambient suppression and strike pose use the same smooth cancellation weight; movement-facing is authoritative through the handoff.
- **MEDIUM C4 — mandatory devlog/review closeout was incomplete. Fixed in the documentation unit.** The detailed/summary logs, changelog/spec/architecture surfaces, evidence-anchored lessons, and review thread are completed before v0.2.3 closes.

## Result

The repaired code was committed as `03bf46e` after the four required code gates. Iteration 3 records the independent refuters that tested the new fog, replay, and clock boundaries.
