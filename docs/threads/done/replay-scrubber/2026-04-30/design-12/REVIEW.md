# Replay Scrubber Design Iter-12 Review

**Date:** 2026-04-30
**Iteration:** design-12 → produces design-13 (v14 in spec)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (Codex 3 BLOCKERs + 2 MAJORs + 1 MINOR; Claude 3 BLOCKERs + 4 MAJORs + 4 MINORs + 2 NITs — convergent on real correctness gaps in v13's commandify framing)

This iteration covered the v13 scope expansion (commandify aoe2 input + bridge-state migration + replay scrubber UI).

## Convergent BLOCKER 1 — civ-engine command API doesn't match v13's references

v13 §6.2 referenced `world.registerCommandHandler` and `ctx.reject`. Actual civ-engine API:
- `world.registerHandler(type, handler)` (`world.ts:868`).
- `world.registerValidator(type, validator)` (`world.ts:824`) — runs BEFORE the queue, not inside the handler.
- Handler signature: `(data, world) => void`. No ctx, no reject. A throwing handler is a tick failure, not a rejection.

**Fix in v14:** §6.2 rewritten with the validator/handler split. Each command gets a `<name>Validator` (returns null or `{code, message}`) and a `<name>Handler` (pure mutation). Registration: `registerValidator` + `registerHandler` paired in `registerCommandHandlers`. Bridge facade translates validator codes to existing toast strings via new `formatRejectionReason` helper (Claude m3 fix).

## Convergent BLOCKER 2 — AI calling `submitWithResult` mid-tick violates determinism contract

This is the architectural core. civ-engine's `tests/determinism-contract.test.ts:277-319` explicitly tests that systems calling `submitWithResult` during their `execute` phase causes replay to diverge:
- Live: AI runs in step K's update, submits with `submissionTick = K-1`. The command queues AFTER `processCommands(K)` has already run, so handler executes at start of step K+1.
- Replay (`session-replayer.ts:244-256`): re-applies commands at iter `t = K-1` BEFORE `step()`, so handler executes at start of step K — ONE STEP EARLIER than live.

Disabling AI in replay (v13 §6.5(a)) prevents double-submission but does NOT fix the offset. Round-trip equivalence fails at any tick where AI submitted commands.

**Fix in v14:** new intention/dispatcher pattern (§6.5 rewritten):
1. AI-decision systems push **intentions** to a `pendingCommands` queue during their `execute` phase. They do NOT call `submitWithResult` and do NOT mutate state directly.
2. After `world.step()` returns, the aoe2 game loop calls `dispatcher.drainPendingCommands(world, queue)` BETWEEN ticks. This calls `submitWithResult` for each intention; recorder captures with `submissionTick = K` (post-step).
3. Replay disables AI-decision systems entirely; recorded commands re-apply at the same between-step boundary.

Same model human input already follows (UI events fire from `requestAnimationFrame` callbacks, not inside `world.step`).

## Convergent BLOCKER 3 — Phase 1 round-trip test cannot pass before Phase 2

PLAN v2 had Phase 1C run a round-trip-via-commands test. But bridge state lives outside `world.state` until Phase 2 migrates it; `world.serialize()` snapshots are incomplete; replay can't reconstruct combat HP, gather progress, fog memory, etc. structurally equal to live.

**Fix in v14 PLAN:** Phase 1C deleted; round-trip test moved to Phase 3A.5 (after bridge-state migration lands in Phase 2). Phase 1 ends with command-recording verified (commands appear in bundle as expected) but NOT live≡replay equivalence.

## Codex MAJOR / Claude M1 — §6.6 system split miscategorized

v13's split table marked `villagerEconomySystem`, `scoutMovementSystem`, `monkBehaviorSystem` (whole), `herdableMovementSystem` (partial) as live-only. Per ground truth:
- `villagerEconomySystem` is ALL-player gather/dropoff resolution. Pure state mutation, no AI decision content. **Deterministic resolution.**
- `scoutMovementSystem` is deterministic AI scout movement; direct state mutation. **Deterministic resolution.**
- `monkBehaviorSystem` is mostly resolution; AI decision is in `assignAiMonkTasks`. **Split into decision (live-only) + resolution (always).**
- `herdableMovementSystem` is RNG-based wander using `world.rng`; replay re-seeds. **Deterministic resolution.**
- `autoAggressionSystem` operates on all units (filter is `aiStates.has(owner)`); after intention/dispatcher refactor, fully captured by `unit.attack` commands. **AI-decision (live-only).**

**Fix in v14:** corrected split table in §6.6 with new criterion: "live-only iff the system's complete effect is pushed intentions; resolution iff the system mutates state directly based on current world state."

## Claude M2 — Replay path needs handler+validator registration

`session-replayer.ts:247` throws `ReplayHandlerMissingError` if `world.hasCommandHandler(rc.type)` is false at recorded-command resubmission time. v13's `wireReplaySystems` only registered systems, never command handlers.

**Fix in v14:** `wireReplaySystems` calls `registerCommandHandlers` AND `registerCommandValidators` (same registrations as live). Same pure handlers/validators, different world instances — no duplicate-registration concern.

## Claude M3 — Removing AI systems breaks before/after constraint references

`registerAutoAggressionSystem` declares `after: ['prototypeAi'], before: ['prototypePlayerCommands']`. If `prototypeAi` isn't registered in replay, civ-engine throws at system-graph resolution.

**Fix in v14:** `wireReplaySystems` registers AI-decision systems as **stub no-op registrations** under the same names. Constraint references resolve; AI logic doesn't fire.

## Codex+Claude M4 — Command surface incomplete

- v13 missed building rally-point: `humanInputOps.ts:101-179` mutates `rallyPoints.set(buildingId, ...)`.
- `unit.action` was wrong shape: actual `ActionType = 'ungarrison'` is BUILDING-scoped (`humanInputOps.ts:240`), not unit-scoped.

**Fix in v14:** §6.1 adds `building.setRallyPoint: { buildingId, target }` and renames `unit.action` to `building.action: { buildingId, actionType: BuildingActionType }` (with `BuildingActionType = 'ungarrison'` for now). v14 §6.1 heading reads "15 types" (was "12 types" — m1 fix).

## Other findings folded into v14

- m2 (validators rerun in replay): regression test added in Phase 3A.5.
- m3 (UX rejection messages): `formatRejectionReason` helper translates validator codes to existing toast strings.
- m4 (same-tick prose): §6.5 prose corrected to "handlers run at start of next step."
- n1 (productionQueueSystem completion stays direct): noted in §6.6 column.
- n2 (`registerHandler` duplicate-registration): live and replay use disjoint world instances; sanity test added in Phase 1A.

## v14 changes summary

1. **Civ-engine API names corrected** throughout — `registerHandler`/`registerValidator`/handler signature `(data, world)`.
2. **NEW: AI intention/dispatcher pattern** — AI systems push to `pendingCommands` queue; between-step dispatcher submits.
3. **NEW: `drainPendingCommands(world, queue)` helper** in `src/game/simulation/dispatcher.ts`.
4. **§6.6 system split table** rebuilt with corrected criterion + recategorizations.
5. **§6.1 commands** = 15 types (was 12-counted-as-14); added `building.setRallyPoint`, renamed/refocused `building.action`.
6. **§6.2 validator + handler split** spelled out; `formatRejectionReason` helper for UX.
7. **§6.5 prose corrected** on civ-engine command timing.
8. **`wireReplaySystems` updated**: registers stub AI-decision systems (constraint preservation) + command handlers/validators.
9. **PLAN re-phased**: Phase 1 ends without round-trip test; round-trip moves to Phase 3A.5.
10. **Phase 1C added**: AI-system intention refactor (`aiSystem`, `autoAggressionSystem`, `monkBehaviorSystem` decision split, etc.).

## Process notes for design-13 reviewer

- v14 deltas are at the top of DESIGN.md.
- Verify the intention/dispatcher pattern actually closes the determinism contract violation: commands have `submissionTick = K`, processed at start of step K+1, identical between live and replay.
- Verify the §6.6 split table holistically: are there any other systems that mutate state directly during execute that need re-classification? Specifically check `playerCommandsSystem` (consumes unitCommands → executes movement/attack), `productionQueueSystem` (completion logic), and `wildlifeCombatSystem`.
- Verify the `wireReplaySystems` stub-registration approach satisfies all `before`/`after` constraint references in `registerAllSystems.ts`.
- Verify `formatRejectionReason` covers all existing rejection strings (audit `humanInputOps.ts` and friends).
- Both reviewers should converge to ACCEPT this round IF the v14 fixes land cleanly. If new issues surface, especially around the AI-system refactor's interaction with deterministic systems (e.g., does aiSystem write to OTHER state besides intentions?), surface them.
