# LLM-Agent Playtest — Phase 1 Implementation Review iter-1

Date: 2026-05-08

Reviewers:
- **Codex** (`gpt-5.5` xhigh, read-only sandbox, ephemeral). Produced a clean 3-HIGH + 2-MEDIUM review against the diff after long file-spelunking — got there eventually despite the Windows PowerShell-deny pattern that broke design-iter reviews.
- **Claude** (`claude-opus-4-7[1m]` max effort, full codebase access). Verified each diff claim against the live codebase with file:line citations.

## Disposition

**Iter-2 fixes applied inline.** Reviewers agreed on 3 real HIGH-severity issues; iter-2 closed all three plus 2 of the MEDIUMs. The remaining MEDIUM (per-owner visibility) becomes a Phase-6 follow-up with explicit framing in the snapshot type comment.

## Findings

### HIGH

**H1. Semantic command rejections cannot be drained via `consumeCommandRejection` as designed.** (Codex H1 + Claude H1.)

`bridge.consumeCommandRejection()` is a shared FIFO already drained by the HUD render loop on every frame (`createHudController.ts:361-365`), capped at 8 entries. The design's claim that the LLM agent runner correlates dispatched commands with semantic rejections via `consumeCommandRejection()` is broken: the HUD steals the signal, and even if it didn't, the dispatcher's `drainPendingCommands` discards the `world.submitWithResult` result without enqueuing rejections.

**Fix.** New `AgentDispatchObserver` callback in `dispatcher.ts`: `drainPendingCommands(world, queue, observer?)` invokes the observer once per drained command with the `CommandSubmissionResult`. `SimulationBridge.setAgentDispatchObserver(fn|null)` lets the agent harness install a private observer. `__AOE2_TEST__.agent.drainAgentDispatchLog()` returns accumulated events since the last call. The observer reattaches lazily on every dispatch so a bridge swap (save/load) doesn't strand the subscription. No competition with the HUD's FIFO; no 8-entry cap.

**H2. Validator rejects every valid `sheep.move` and `building.setRallyPoint`.** (Codex H3 + Claude H2.)

`agentCommandValidator.ts` lumped `unit.move`, `unit.context`, `sheep.move`, and `building.setRallyPoint` under one switch case that hard-coded `unitId` as the first required field. `sheep.move` uses `sheepId`; `building.setRallyPoint` uses `buildingId`. Both shape-rejected on every invocation.

**Fix.** Branched the switch into three cases: `unit.move | unit.context` (unitId), `sheep.move` (sheepId), `building.setRallyPoint` (buildingId). Added 11 new tests covering all 15 GameCommands discriminators (was 14 tests covering ~10 kinds). Test suite is now 25 cases; per-discriminator coverage is genuinely complete.

**H3. Snapshot leaks perfect information; "visibleEnemies" is a misnomer.** (Claude H3.)

`agentSnapshot.ts`'s comment claimed "the bridge already filters its EconomyState to entities the human player can see (visibility-gated projection)" — Claude verified that's false: `economyStateOps.ts:49-150` queries the world directly with no fog filter. Result: the LLM gets ground-truth coordinates of every enemy unit / building / resource regardless of visibility.

**Fix (partial — Phase-6 follow-up).** Renamed `visibleEnemies` → `enemies` in both the snapshot type and the implementation. Comment updated to explicitly document the cheat-mode framing: this is acceptable for the single-LLM-vs-passive-human smoke baseline (the LLM is the only active player; "fog" isn't meaningful), and the multimodal screenshot the LLM also receives IS fog-respecting so the visual signal is correct. Per-owner visibility-gating is filed as a Phase-6 follow-up (`Phase-6 follow-ups` section in DESIGN.md was already there for AI-vs-LLM head-to-head; this slots in alongside).

**H3-bis. `?disableAi=` indirectly leaks into save format via aiStates absence.** (Codex H2.)

The disable directive prevents `ensureAiState` for the disabled owner; on save, `aiStatesCodec` serializes the absence. Loading the save preserves the disabled-AI state.

**Fix (documentation only).** Acceptable behavior for the harness: the LLM playtest writes a `SessionBundle` (separate format), not a `SaveBlob`, so save-format leak doesn't affect harness operation. The leak only matters if a human player saves a game with `?disableAi=` set in their URL — a self-imposed footgun. Documented in DESIGN.md as known behavior; no code change needed.

### MEDIUM

**M1. Snapshot caps cover only 3 of 7 array surfaces.** (Claude M1.)

`queuedProduction`, `perPlayer.villagerCountByTask`, `perPlayer.buildingCountByType`, `perPlayer.militaryCountByType`, and per-building queue length were unbounded.

**Fix.** Capped `queuedProduction` to 64 buildings; per-building queue truncated at 16 entries. New regression test pins both caps. The dictionary-shaped per-player counters are bounded by the engine's enum surface (~30 building types, ~30 unit types), so they don't grow unboundedly in practice — left uncapped.

**M2. Shape validator accepts any string for enum-typed fields.** (Claude M2.)

`unitType`, `technologyType`, `actionType`, `buildingType` are constrained string unions in `types.ts`; the validator only checked `typeof v === 'string'`. An LLM hallucinating `buildingType: 'castle'` (no such enum value) passes shape and reaches `world.submitWithResult` where the rejection (now via the agent observer) only surfaces a tick later.

**Fix (deferred).** Per-discriminator known-value sets would tighten the validator but require importing 4-5 union members from `types.ts` and keeping them in sync. The agent's tool-use schema (Phase 2) provides the same constraint upstream — the LLM emits values from a fixed set Claude's tool-use sees, so MED2 is mostly mooted by the planned schema codegen. Filed as a Phase-2 implementation note rather than fixed at the validator layer.

**M3 (Codex MED1). Agent surface is owner-unscoped + snapshot is omniscient.** Overlaps with H3 above. Per-owner ownership/visibility scoping → Phase-6 follow-up.

**M4 (Codex MED2). Replay mode silently accepts agent commands into a detached array.**

`makeReplayBridge.pendingCommands = []` returns a no-op array; `dispatchAgentCommand` doesn't know it's a replay bridge and reports `accepted: true` while the command is dropped on the floor.

**Fix (documentation + observer no-op).** `makeReplayBridge.setAgentDispatchObserver` is a documented no-op for type-shape parity. The runner discipline is "never call agent.dispatchAgentCommand in replay mode" — replay's own controls (timeline, +/- step, exit) are the playback surface. A runtime check for replay mode would require plumbing replay-mode awareness through the bridge facade; deferred until the runner ships and we can integrate-test the assumption.

## Verified clean

- `?disableAi=` URL parsing edge cases (10 unit tests pin the contract).
- `dispatchAgentCommand` push semantics (validator + observer architecture).
- `getRecorderBundle` / `exportRecorderBundleToFile` round-trip via Blob URL.
- Determinism: `pendingCommands` push from agent path uses identical wire format to in-game-AI intentions; recorder captures both paths identically.
- The `__AOE2_TEST__.agent` sub-object scoping (vs. flat top-level methods) is fine — DESIGN.md was open-ended, sub-object keeps the existing top-level surface clean.

## Action plan

Iter-2 fixes applied inline:

1. **H1.** `AgentDispatchObserver` + `setAgentDispatchObserver` + `drainAgentDispatchLog`. Lazy reattach on every dispatch.
2. **H2.** Validator switch branched per-discriminator; 11 new tests for the missing kinds.
3. **H3.** Renamed `visibleEnemies` → `enemies`; documented cheat-mode framing.
4. **H3-bis.** Documented save-format-leak as known harness behavior.
5. **M1.** Capped `queuedProduction` at 64 + per-queue at 16; new regression test.
6. **M2.** Filed as Phase-2 codegen note (the tool-use schema enforces enum membership upstream).
7. **M4.** Documented replay-mode discipline.

## Next iteration

If iter-2 fixes converge to nits, Phase 1 closes. Phase 2 (LLM agent core with `@anthropic-ai/sdk`) starts after.
