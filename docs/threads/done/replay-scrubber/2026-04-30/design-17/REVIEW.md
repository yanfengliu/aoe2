# Replay Scrubber Design Iter-17 Review

**Date:** 2026-05-01
**Iteration:** design-17 → architecture committed, implementation begins
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ARCHITECTURE CONVERGED (Codex BLOCKER + MAJOR + MINOR remaining as stale prose; addressed inline below)

After 17 iterations, the substantive architecture is settled across all axes — bridge-state migration to `world.state.aoe2.*`, commandify input through 15-command surface, AI intention/dispatcher pattern, validator+handler split with handler re-checks, facade-vs-helper duality, replay-scrubber UI on top. The remaining issues at iter-17 are stale example-code prose against ground truth, not design defects.

## Codex BLOCKER — `Return null to accept` comment in §6.2

The validator code COMMENT still said "Return null to accept" though the body returns `true`. Fixed inline: `// Return true to accept, false for generic reject, or { code, message, ... } for detailed reject. NEVER return null — civ-engine's normalizer throws.`

## Codex MAJOR — `success` references in §6.2 / §6.3 / PLAN

Stale `success` in:
- §6.2 handler example comment: `silent no-op; recorder still captures as success` → `as 'executed: true'`.
- §6.2 prose paragraph: `Recorder captures success...` → `Recorder captures the execution as 'executed: true'`.
- PLAN Phase 1B step 2: `recorder still captures as success` → `as 'executed: true'`.

All fixed.

## Codex MINOR — v16 deltas prose stale `isAlive`

The v16 deltas paragraph at the top of DESIGN said helper guard is `world.isAlive`. v17 corrected the body example but the deltas summary remained stale. Fixed inline: now correctly states `world.getComponent<UnitComponent>(unitId, 'unit')` with the rationale (`isAlive` alone returns true for buildings/resources).

## Convergence statement

After 17 iterations of multi-CLI review:
- All architectural decisions are sound and verified against civ-engine ground truth.
- All civ-engine API references now match `world.ts` exact shapes.
- All example code reflects current bridge ops module behavior (5-step move helper, validator/handler signatures, coordinate clamping at handler).
- PLAN v4 phase structure is internally consistent and aligned with DESIGN v17.
- No civ-engine API changes required.

Implementation begins with Phase 1A (commandify foundation). Per AGENTS.md, every implementation commit will be multi-CLI reviewed; any remaining example-code drift surfaces and gets corrected at the actual call site.

## Design summary (for posterity)

**v0.1.6 architecture:**
1. `GameCommands` type with 15 commands (unit orders, production, market, building actions/rally, trebuchet pack/unpack).
2. `registerValidator` + `registerHandler` for each command via `registerCommandHandlers(world, deps)`.
3. AI-decision systems push intentions to `pendingCommands` queue during `execute`; between-step `dispatcher.drainPendingCommands(world, queue)` submits via `world.submitWithResult` after each `world.step()`. Recorder captures with submissionTick = post-step world.tick.
4. Deterministic-resolution systems mutate state directly during `execute` (no commands).
5. Bridge methods: facade (commandified, used by HUD/hotkey/AI dispatcher) + private direct helper (`setXCommandDirect`, used by deterministic systems for mid-tick mutations).
6. Validators: structural + best-effort resource (for UX-correct rejection toasts). Handlers: state-dependent re-checks (silent no-op on stale-state miss); coord clamping; full mutation.
7. Bridge state migrates to `world.state.aoe2.*` via per-slot codecs + `BridgeStateAccessor`. `tier3SyncSystem` + `bridgeSnapshotSystem` registered LAST in output phase. `bootstrapFlush` runs once before recorder connects.
8. Replay path: `wireReplaySystems` registers deterministic-resolution systems + stub no-op AI systems (constraint preservation) + `registerCommandHandlers` (M2 fix). `createReplayWorldOnly` calls skeleton + applySnapshot + hydrate-cell + wireReplaySystems + attachReplayWorldContext.
9. ReplayController toggles mode; `_currentReplayContext` carries world+bridge+accessor+visibilityCell+matchState+tick. `play()` uses stateful `_playState` with between-step dispatcher (no commands during replay since AI is disabled).
10. TimelinePanel UI bottom-strip overlay; markers + hotspot pins; drag scrubber with frame coalescing.

## Process notes for implementation

- Phase 1A starts with commands.ts type, registerCommandHandlers scaffolding, dispatcher module, empty-queue main-loop call.
- Each command in Phase 1B lands as an independent commit with multi-CLI review.
- Phase 2 (bridge-state migration) interleaves with Phase 1 in places where command handlers need codec-based mutation.
- Phase 3 (scrubber UI) waits for Phase 1 + Phase 2 round-trip equivalence.
- Round-trip-via-commands test = Phase 3A.5 (was deferred from Phase 1C because bridge state isn't in world.serialize() until Phase 2 lands).
