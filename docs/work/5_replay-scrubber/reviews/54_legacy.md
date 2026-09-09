# Phase 3B ReplayController Review - impl-37

## Scope

Reviewed the Phase 3B replay controller diff: `src/game/replay/ReplayController.ts`, `src/game/simulation/replay/makeReplayBridge.ts`, replay-world context/seed wiring, `tests/replay/ReplayController.test.ts`, and roadmap/architecture docs.

## Reviewer Availability

- Codex: unreachable. `codex.cmd exec` exited with the account usage-limit message (`try again at 8:37 PM`).
- Claude: unreachable. `claude -p` exited with the account limit message (`resets 7pm America/Los_Angeles`).
- Gemini fallback: completed. Gemini is treated as structural fallback only, not equivalent to the required Codex/Claude live-code reviews.

## Findings

- **Gemini G1 - Replay playback speed tied to display frame rate (important).** `ReplayController.play()` advanced exactly one simulation tick per `requestAnimationFrame`, which would run too fast on 60 Hz+ displays. Fixed by adding TPS-paced playback accumulation in `ReplayController.ts`; playback now advances only when accumulated frame time reaches `1000 / TPS`, with a regression in `tests/replay/ReplayController.test.ts`.
- **Gemini G2 - Selection lost across committed scrubs (important).** `openReplayAt()` rebuilt a world/bridge and dropped replay selection state. Fixed by carrying still-current `EntityRef`s from the prior replay bridge to the new replay bridge after `openAt`, with a regression covering committed scrub selection preservation.
- **Gemini G3 - Replay interpolation hardcoded to zero (minor but real).** `makeReplayBridge.getRenderInterpolationAlpha()` always returned `0`, which would make replay playback snap between ticks. Fixed by threading a controller-owned interpolation getter into `makeReplayBridge`, and covering the bridge option in tests.
- **Gemini G4 - Direct method forwarding could lose `this` context (low hardening).** Some replay bridge methods were assigned directly from `api`. Current `api` functions are closures, but the bridge now wraps forwarded calls explicitly to prevent future context coupling.
- **Gemini G5 - Replay seed hardcoded to `aoe2-replay` (determinism risk).** `createReplayWorldOnly` and `makeReplayBridge` used a generic replay seed for projector/save/HUD context. Fixed by reading `snapshot.config.seed` when constructing replay worlds and storing the effective seed in `ReplayWorldContext`; `makeReplayBridge` uses that seed for projector/HUD.

## Disposition

All Gemini impl-37 findings were addressed before re-review. Focused tests, typecheck, lint, and the file-size budget were rerun after the fixes.
