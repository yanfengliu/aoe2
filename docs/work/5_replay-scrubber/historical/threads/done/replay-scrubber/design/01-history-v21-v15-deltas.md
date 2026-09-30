# Replay Scrubber + Bridge-Snapshot — Design Spec

**Status:** Closed v21 (2026-05-05). aoe2 v0.1.6/v0.1.7 shipped the replay-scrubber roadmap in coherent user-visible units: commandify aoe2 input + AI intention dispatcher + bridge-state migration + schema-2 saves in v0.1.6, then the user-visible Phase 3C TimelinePanel in v0.1.7. Phase 3D/3E replay-load sources and browser scrubber e2e remain future work and should open a fresh `docs/threads/current/<objective>/` thread unless this historical thread is intentionally reopened. The user chose option A (commandify) over deferral — AI-native architectural correctness over implementation cost.

**v21 deltas vs v20:** The thread is closed under `docs/threads/done/replay-scrubber/`. Future replay-load/e2e work should create a new current objective thread rather than writing new review iterations into this done thread.

**v20 deltas vs v19:** Thread-level scope wording now reflects the shipped version split. Older full-`v0.1.6` sections remain historical design trail unless this header or the Phase 3 status notes say they are current. The authoritative current closure is: v0.1.6 owns schema-2/foundation, v0.1.7 owns Phase 3C TimelinePanel, and `ReplayLoadDialog` / three-source replay loading / browser scrubber e2e stay Phase 3D/3E follow-up.

**v19 deltas vs v18:** Phase 3C implementation adds the aoe2-side `TimelinePanel` and `ReplayHotkeys` layer and bumps the app to 0.1.7 because the panel is user-visible after schema-2 already shipped as 0.1.6. The panel is mounted in the HUD root and remains visible only in replay mode; CSS reserves bottom viewport space while it is visible so the fixed strip does not overlap the playfield or bottom HUD. Marker pins come directly from `bundle.markers`, while hotspot pins use `bundleHotspots(bundle, { includeMarkers: false })` so annotation markers are not duplicated as hotspots. Replay keyboard shortcuts are bound only while replay mode is active, letting the shared hotkey registry prevent default for real replay controls without swallowing Space/Arrow/Alt+T in live mode. Bundles without command payloads keep forward/play/end controls and unreachable pins inert because the controller cannot replay beyond the initial tick without recorded command data. The app save-load path exits replay before replacing the host bridge so replay exit cannot restore a stale pre-load bridge.

**v18 deltas vs v17:** Phase 3A implementation found that `prototypeAi` is not yet a pure no-op-safe replay stub because it still owns replay-visible AI bookkeeping (`aiStates.lastDecisionTick`, `attackGroup`, and villager desired-resource rebalance) in addition to command-intention emission. Replay therefore registers `prototypeAi` and `prototypeAutoAggression` with real intention emitters into the replay world's bridge-owned pending queue: recorded command payloads still drive execution, while AI-decision systems reproduce the serialized `aoe2.pendingCommands` boundary state. Phase 3A also adds a replay-only pending drain before AI systems run so hydrated pending queues from snapshots do not leak into later ticks, and tightens schema-2 hydration so replay construction does not materialize absent empty Tier-1 slots while validating/pruning hydrated state. The regression coverage is `tests/replay/roundTripViaCommands.test.ts` and `tests/replay/validatorReplayConsistency.test.ts`.

**v17 deltas vs v16:** addresses iter-16 convergence review (Codex 2 BLOCKERs + 1 MAJOR; Claude 2 MAJORs + 1 MINOR — all are stale-example-code accuracy issues against ground truth, no architectural changes).

- **Validator return shape**: civ-engine's `CommandValidationResult = boolean | CommandValidationRejection` per `world.ts:130` + `world-internal.ts:81`. `true` accepts; `false` rejects generically; `CommandValidationRejection` ({code, message, ...}) rejects with details. `null` is invalid and would throw via `normalizeCommandValidationResult`. v17 §6.2 validator example uses `return true` to accept (was `return null` in v16).
- **`submitWithResult` result shape**: ground truth is `CommandSubmissionResult = { accepted: boolean, code, message, details?, tick, sequence }` (`world.ts:132-144`). No `kind` field. v17 fixes §6.3 facade pseudocode (`if (result.accepted) issued = true;`) and v15/v16-deltas prose ("recorder captures the execution as `executed: true`").
- **Helper unit-existence guard**: ground truth uses `world.getComponent<UnitComponent>(unitId, 'unit')` (returns null if not alive OR not a unit) — `isAlive(unitId)` alone is weaker (returns true for buildings/resources). v17 helper uses `getComponent('unit')` to exactly mirror the facade. Live, replay, and deterministic-system paths all use the same guard.

**v16 deltas vs v15:** addresses iter-15 review (Codex BLOCKER + MAJOR; Claude MAJOR-1 + MAJOR-2 + MINOR-2 + 3 NITs — all accuracy/precision in example code, no architectural changes).

- **`setUnitMoveCommandDirect` mirrors the FULL facade body** — 5 invariants per ground truth (`unitCommandOps.ts` + `bridgeHelpers.ts`): (1) unit-existence guard via `world.getComponent<UnitComponent>(unitId, 'unit')` (NOT `isAlive` alone — `isAlive` returns true for any alive entity including buildings/resources); (2) `clearGathererOrder`; (3) clear the accessor-backed `monkTasksCodec` entry if one exists; (4) target clamp to `[0, mapWidth-1] × [0, mapHeight-1]`; (5) call existing `setUnitCommand(...)` helper which internally does `movePathCache.delete` + `unitCommands.set`. Handler `unitMoveHandler` delegates to the helper so live + replay + deterministic-system paths all execute identical code.
- **API references corrected** to ground truth: `world.isAlive(entityId)` (NOT `hasEntity`); `submitWithResult` returns `{ accepted: boolean, code?, message? }` shape (NOT `{ kind: 'rejected' }`); unknown command type queues and fails at `processCommands` with `missing_handler` (NOT a sync throw).
- **Coordinate clamping** specified as HANDLER responsibility for all position-bearing commands. Validators reject only structurally-invalid coordinates (NaN, non-integer).
- **Cost re-derivation** for state-dependent handlers (especially `market.action`'s gold cost from current `marketExchangeRates` — prior handlers in same frame may have mutated rates). Made explicit in §6.2 B2 fix prose.
- **`queue.research` `inFlightTechByOwner` re-check** added to handler re-check list (per `trainingMarketOps.ts:195` — same-tech batches must respect the same-frame in-flight guard).
- **Validator code/message fix**: `'unit_not_owned'` (ambiguous) → `'not_a_unit'` (matches the actual failure mode).
- **`issuedAt` field** removed from sample handler — current `UnitCommand` shape (`sharedTypes.ts:10`) doesn't include it; if needed for replay analysis, a separate Plan-stage decision adds the field to the type.
- **PLAN.md sanity test** wording corrected: unknown command queues then fails at command-processing time (NOT synchronous throw at submit).
- **§6.4 list-count reconciliation**: kept 13-numbered-bullet list (some commands grouped — `sheep.move + monk.contextAtEntity` together, `trebuchet.pack + trebuchet.unpack` together) to match v14 §6.1 inventory; PLAN v4 has 15 separate per-commit entries. Functionally equivalent — implementer treats each item as one-or-two commits.

**v15 deltas vs v14:** addresses iter-13 review (Codex 2 BLOCKERs + 3 MAJORs; Claude 2 MAJORs + 3 MINORs + 2 NITs — convergent on facade-vs-helper split for deterministic-system mid-tick state mutation, and queue-aware affordability for batched validators).

- **B1 (deterministic systems must NOT route through commandified facade):** `productionQueueSystem` (always-runs deterministic resolution) calls `issueUnitMoveCommand(unitId, rallyPoint)` during `execute` (`productionQueueSystem.ts:103-105`). PLAN v3 §1B step 4 turned `issueUnitMoveCommand` into `world.submitWithResult('unit.move', ...)` — that converts every existing call site into a mid-tick submission, including the legitimate productionQueueSystem rally call. Reintroduces B2 inside deterministic systems.

  v15 fix: every `issueXCommand` ops module gets **two** exports — and the direct helper MIRRORS the full facade behavior. After iter-15 review, the full set of invariants includes 5 steps (per `unitCommandOps.ts:116-130` + `bridgeHelpers.ts:111-114`):
  ```ts
  // src/game/simulation/bridge/unitCommandOps.ts (after v15)
  // PUBLIC (commandified facade — used by HUD, hotkey handlers, AI dispatcher):
  export function issueUnitMoveCommand(unitId: number, target: Position): boolean {
    const result = world.submitWithResult('unit.move', { unitId, target });
    // submitWithResult returns { accepted: true } or { accepted: false, code, message }
    // (verify exact shape against world.ts:792 in plan-stage; pseudocode here).
    if (!result.accepted) {
      enqueueRejection(formatRejectionReason(result.code, result.message));
      return false;
    }
    return true;
  }

  // PRIVATE (direct-mutation helper — used by deterministic-resolution systems).
  // Mirrors the FULL facade body. Internally calls the existing `setUnitCommand`
  // helper which already covers movePathCache.delete (`bridgeHelpers.ts:112`).
  // Safe to call from ANY context (not just newly-spawned-unit).
  export function setUnitMoveCommandDirect(unitId: number, target: Position): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit) return false;                          // 1. unit-existence guard (mirrors facade)
    clearGathererOrder(unitId);                       // 2. clear prior gatherer order
    clearMonkTaskIfPresent(unitId);                   // 3. clear prior accessor-backed monk task
    const clamped = clampToMap(target, mapWidth, mapHeight);  // 4. coord clamp
    setUnitCommand(unitId, { type: 'move', target: clamped }); // 5. setUnitCommand internally does movePathCache.delete + unitCommands.set
    return true;
  }
  ```
  The `unit.move` HANDLER does the same 5 steps (against the validated unitId/target):
  ```ts
  export const unitMoveHandler: HandlerFn<GameCommands, 'unit.move'> = (data, world) => {
    setUnitMoveCommandDirect(data.unitId, data.target);
  };
  ```
  Handler delegates to the helper so live (facade → submit → handler) and replay (recorded submit → handler) AND deterministic-system (helper directly) all execute the same code path.
  `productionQueueSystem` rally-point call site switches from `issueUnitMoveCommand(unitId, rally)` to `setUnitMoveCommandDirect(unitId, rally)` — mutates state directly during execute (deterministic, runs in both live and replay, no command submission).

  Audit shows only `unit.move` is currently called by a deterministic-resolution system (productionQueueSystem rally). `gather`/`attack`/`context` direct helpers would be defensive-only — Plan Phase 1A's audit deliverable confirms which helpers are actually needed; do not pre-implement helpers the audit shows aren't called.

- **B2 (batched validator affordability — live-game economic behavior change):** v14's validator/handler split: validator runs synchronously in `submitWithResult` BEFORE queuing; handler runs at start of next step. So in a single frame the AI dispatcher submits N intentions; all N validators run sequentially over `world.state` BEFORE any handler deducts; all N could pass an `canAfford` check that current synchronous code (which deducts on each call) would reject the latter ones. Result: AI economy gets observably looser — could queue more units than affordable.

  v15 fix: **validator + handler both validate state-dependent conditions, but in different roles**:
  - **Validator** does structural validation (entity exists, target in bounds, owned by submitter) PLUS a **best-effort resource/state check** so single-press UX paths produce a rejection toast (validator runs synchronously in `submitWithResult`, returns `{code, message}` → bridge facade's `formatRejectionReason` → existing `enqueueRejection` UX). The validator's view is "optimistic" — it sees pre-deduction state, so when N intentions submit in one frame, all N may pass.
  - **Handler** does the same state-dependent check as a SAFETY NET for the batched-same-frame case. If the handler's re-check fails (resource state changed between submission and execution), it silently no-ops. Recorder still captures the execution as `executed: true` (handler ran without throwing) regardless of the silent-noop branch; replay re-runs handler against same state → same outcome.

  This preserves today's UX (single-press overspend → toast) AND today's economic invariant (batched AI commands stop at the affordability boundary):
  ```ts
  // src/game/simulation/handlers/queue/queueTrainHandler.ts
  export const queueTrainHandler: HandlerFn<GameCommands, 'queue.train'> = (data, world) => {
    const { buildingId, unitType } = data;
    // Re-check resource affordability (multiple queue.train commands in this frame
    // may have already deducted resources between validator and handler):
    const cost = TRAIN_COSTS[unitType];
    const playerId = playerIdOf(buildingId);
    const resources = accessor.get(playerResourcesCodec).get(playerId);
    if (!canPay(resources, cost)) return;  // silent no-op; recorder still captures as `executed: true`
    // Deduct + enqueue:
    deductResources(playerId, cost);
    accessor.mutate(productionQueuesCodec, (m) => {
      const q = m.get(buildingId) ?? [];
      q.push({ unitType, queuedAt: world.tick });
      m.set(buildingId, q);
    });
  };
  ```

  Recorder captures the execution as `executed: true` (handler ran without throwing) regardless of handler's silent-noop branch. Replay re-runs handler against same state → same outcome. Determinism preserved. Live UX: AI economy stops at affordability boundary just like today (the per-handler re-check enforces the same invariant the synchronous deduct-as-you-go code does).

  Same pattern for `queue.research` (resource cost AND `inFlightTechByOwner` re-check — same-tech batches must respect the same-frame in-flight guard), `market.action` (resource availability AND **cost MUST be re-derived from current `marketExchangeRates`** — prior handlers in the same frame may have already mutated rates), `building.placeConfirm` (resource cost + buildable-position-still-valid + occupancy re-check). Handlers documented as "validator-plus" in §6.2.

  **Coordinate clamping (Claude iter-15 MAJOR-2):** position-bearing commands (`unit.move`, `sheep.move`, `unit.context`, `building.setRallyPoint`, `building.placeConfirm`) clamp target/anchor coordinates to `[0, mapWidth-1] × [0, mapHeight-1]` in the HANDLER, not the validator. Validators reject only structurally-invalid coordinates (NaN, non-integer); off-map clamping is silent so HUD edge-clicks work as today.

- **MAJOR (Codex — wildlife auto-aggro misclassified in §6.6):** v14 split table marked "Wildlife wolf-decision (if registered)" as live-only. But `prototypeWildlifeCombat` is currently ONE system doing target-acquisition + movement + damage as deterministic resolution (`wildlifeCombatSystem.ts:80-...`). No separable decision half exists in code today. v15 reclassifies to **deterministic resolution (always)**. Plan-stage: if someday wolf decisions need replay-recorded inputs, refactor then.

- **MAJOR (Codex+Claude — stale v13 prose):** §6.4 still listed `unit.action` in the migration order. Removed. Migration order regenerated to match the §6.1 v14 surface (15 commands, no `unit.action`).

- **MAJOR (PLAN re-phasing — stale references):** Phase 2G said "round-trip via commands"; risk section mentioned Phase 1 round-trip; success criteria named "Phase 1C round-trip." All updated in v15 PLAN to point to Phase 3A.5.

- **MINOR (Claude — `monkBehaviorSystem` split naming):** v15 §6.6 spells out: resolution-half keeps `'prototypeMonkBehavior'` (because `relicGoldSystem.ts:19` declares `after: ['prototypeMonkBehavior']` and reads relic-carrier state mutated by the resolution half). Decision-half gets new name `'prototypeMonkBehaviorDecision'`.

- **MINOR (Claude — PLAN Phase 1A "no behavior change" inaccurate):** v15 PLAN softens to "No gameplay behavior change yet; game-loop structure adds an empty-queue dispatcher call before each `world.step()`."

- **NIT (Claude — `BuildingActionType` naming):** today `types.ts:122` exports `ActionType = 'ungarrison'`. v15 PLAN Phase 1B step 13 renames `ActionType` → `BuildingActionType` (back-compat alias optional). DESIGN §6.1 references `BuildingActionType` directly.
