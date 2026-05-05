# Replay Scrubber + Bridge-Snapshot — Design Spec

**Status:** Draft v18 (2026-05-05). aoe2 v0.1.6 ships the FULL feature: commandify aoe2 input + AI intention dispatcher + bridge-state migration + replay scrubber UI. The user chose option A (commandify) over deferral — AI-native architectural correctness over implementation cost.

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

**v14 deltas vs v13:** addresses iter-12 review (Codex 3 BLOCKERs + 2 MAJORs + 1 MINOR; Claude 3 BLOCKERs + 4 MAJORs + 4 MINORs + 2 NITs — convergent on civ-engine API mismatch + AI mid-tick submission divergence + Phase 1 round-trip impossibility).

- **B1 (API names mechanical):** civ-engine's actual API is `registerHandler` (not `registerCommandHandler`); validation is via `registerValidator(type, fn)` BEFORE the queue (not `ctx.reject` inside handler); handler signature is `(data, world) => void` (no ctx). v14 §6.2 rewritten with the correct shape — handlers do mutation only; validators do pre-acceptance rejection with code/message tuples.

- **B2 (AI mid-tick submission violates determinism contract):** civ-engine's `tests/determinism-contract.test.ts:277-319` explicitly classifies "system calls world.submit() mid-tick" as a violation: `submissionTick = K-1` is recorded but the handler runs at start of step K+1 (after `processCommands(K)` has already drained the queue). Replay's `openAt` re-submits at iter `t = K-1` BEFORE `step()`, so the handler runs one step EARLIER than in live → state diverges. Disabling AI in replay (v13's §6.5(a)) does NOT fix this — it prevents double-submission but not the offset.

  v14 introduces the **intention/dispatcher pattern**:
  1. AI-decision systems run in `update` phase as before. They write "intentions" into a `pendingCommands` queue (ordinary bridge state — a per-player array).
  2. Immediately before the next `world.step()`, the aoe2 bridge loop calls `dispatcher.drainPendingCommands(world)` which reads the queue and calls `world.submit(...)` for each entry. This happens BETWEEN ticks (outside `world.step`) and lets saves/snapshots taken after the decision tick preserve the one-tick pending-command window.
  3. Recorder captures these as commands with `submissionTick = K` (post-step world.tick); they process at start of step K+1.
  4. Replay's `openAt` re-applies recorded commands at the SAME between-step boundary; AI systems are disabled in replay (no double-submission, no offset).

  Game-loop structural change:
  ```ts
  // Live game loop:
  function gameLoop() {
    dispatcher.drainPendingCommands(world); // submits prior-step intentions; recorder captures
    world.step();                          // AI writes pendingCommands intentions
    // ... rendering ...
    requestAnimationFrame(gameLoop);
  }

  // Replay loop (inside SessionReplayer.openAt):
  for (let t = start; t < target; t++) {
    for (const rc of commandsAtTick(t)) world.submitWithResult(rc.type, rc.data);
    world.step();   // AI systems disabled in replay; pendingCommands stays empty
  }
  ```

  Human input STAYS as direct `world.submit(...)` from bridge methods — UI events naturally happen between ticks (they fire from event handlers / requestAnimationFrame callbacks, not inside `world.step`). Same submissionTick semantics as the AI dispatcher path.

  **AI system refactor required:** every AI-decision system stops mutating bridge state directly during `execute` and instead pushes to `pendingCommands`. Targets:
  - `aiSystem` (high-level decisions) → push intentions for build/train/research/move-units/etc.
  - `autoAggressionSystem` (AI auto-attack decisions; human-owned units exempt) → push `unit.attack` intentions.
  - `monkBehaviorSystem`'s **decision half** (`assignAiMonkTasks`-driven path) → push `monk.contextAtEntity` intentions. Resolution half (animation, conversion completion) stays in `execute`.
  - Wildlife wolf-decision logic in `wildlifeCombatSystem` (if present) → push `unit.attack` intentions.

  Deterministic-resolution systems are unchanged: they continue mutating state directly during `execute` because they run in both live AND replay (no recorded commands needed).

- **B3 (Phase 1 round-trip impossibility):** Phase 1's round-trip test cannot pass before Phase 2 migration because bridge state lives outside `world.state` and won't be in `world.serialize()` snapshots. v14 PLAN re-phases:
  - Phase 1: commandify foundation + dispatcher + per-command handler/validator registration. NO round-trip test (commands recorded but state isn't fully snapshot-able yet).
  - Phase 2: bridge-state migration (per the existing 11-iter design).
  - Phase 3: round-trip test (now feasible: commands + complete snapshots) + scrubber UI.

- **M1 (§6.6 system-split miscategorizations):** v14 corrects:
  - `villagerEconomySystem` → **deterministic resolution (always)**. Runs gather/dropoff for ALL players including human; pure state mutation; no AI-decision content. Excluding it would freeze villagers in replay.
  - `scoutMovementSystem` → **deterministic resolution (always)**. Direct movement mutation, no command submissions; excluding freezes AI scouts.
  - `monkBehaviorSystem` → **decision half** (intention writes via `assignAiMonkTasks`-driven path) is live-only; **resolution half** (animation, completion) is deterministic-resolution.
  - `herdableMovementSystem` → **deterministic resolution** (RNG-based wander uses `world.rng` which replay re-seeds).
  - `autoAggressionSystem` → **AI-decision (live-only)** but only after intentions/dispatcher refactor. Today it directly mutates `unitCommands`; v14 makes it push intentions.

  Updated split table in §6.6.

- **M2 (replay path command-handler registration):** `wireReplaySystems` MUST call `registerCommandHandlers` and `registerCommandValidators` so `session-replayer.ts:247` doesn't throw `ReplayHandlerMissingError`. v14 adds the registration to `wireReplaySystems`'s body explicitly. Stub registrations work because the same handler functions are pure given world state.

- **M3 (system constraint references break in `wireReplaySystems`):** `registerAutoAggressionSystem` declares `after: ['prototypeAi'], before: ['prototypePlayerCommands']`. If `prototypeAi` isn't registered in replay, `world.ts:2114-2117` throws `System '...' references non-existent system '...'`. v14 picks: register STUB `prototypeAi` + other AI-decision systems in replay as no-op `execute: () => {}`. Constraint references resolve; AI doesn't fire.

- **M4 (command surface incomplete):** v14 §6.1 adds:
  - `building.setRallyPoint`: `{ buildingId: number; target: Position }` — replaces v13's missing rally-point handling.
  - `building.action`: `{ buildingId: number; actionType: BuildingActionType }` (renamed from `unit.action`; `BuildingActionType = 'ungarrison'` per current `types.ts:122`).
  - Per-building actions extensible as new `BuildingActionType` values are added.
  - Removed `unit.action` entry; "stop, hold-ground, etc." prose was speculative.

  Total command types: **15** (was 14 in v13 — heading reads "15 types" now).

- **MINOR (validator state-dependent rejections):** validators run on every `submitWithResult` including replayer's resubmissions. If a validator reads bridge state that depends on Phase-2 codec output not yet wired correctly, OR depends on AI decision boundary state not reproduced in replay, it can reject in replay where it accepted in live → silent divergence. v14 adds Phase 3 regression coverage: the initial-snapshot command stream checks `submitWithResult` results and executions exactly, while closest-snapshot replay paths use structural `openAt` equality because civ-engine snapshots intentionally do not carry `nextCommandResultSequence`.

- **MINOR (UX rejection messages):** today `enqueueRejection('Not enough food.')` strings; after commandify, validators return code/message tuples. v14 §6.3 spells out: bridge facade translates validator codes back to existing strings via `formatRejectionReason(code, data)` helper; toast UX preserved.

- **MINOR (same-tick prose corrected):** §6.5 "handlers run synchronously inside the same tick that submitted them" was wrong. Corrected: "handlers run at the START of the NEXT step (`world.ts:1671`); recorder captures submission with `submissionTick = world.tick AT submit time`; replay re-applies them at the same boundary."

- **NIT (productionQueueSystem completion stays direct):** completion logic (timer ticks down → spawn unit) is deterministic resolution, not command-driven. Only the *enqueue* step is a command (`queue.train`, `queue.research`).

- **NIT (`registerHandler` duplicate-registration):** `world.ts:872-874` throws on duplicate. Live and replay use disjoint world instances so no conflict in practice; sanity test added in Phase 1A.

**v13 scope decision (supersedes v12 deferral):** iter-11 found that aoe2 currently bypasses civ-engine commands entirely (`GameCommands = Record<string, never>`). Rather than defer or hack around this, v0.1.6 fixes the architectural root cause: every state-mutating bridge method becomes a civ-engine command + handler pair. This:
1. Makes recorded bundles have full command provenance (replay scrubber works as originally designed in v1-v11).
2. Unlocks **all** civ-engine programmatic features for aoe2: counterfactual replay (Spec 5), AI playtester / AgentDriver (Spec 9), Bundle Hotspots with command provenance, future engine features.
3. Enforces determinism hygiene at the input boundary.
4. Makes aoe2 operable by AI agents through the engine's intended programmatic surface.

The cost is significant — every input handler becomes a command. The user's directive: *"Don't worry about cost. Always do the right thing. AI-native at every step."* The 11 iterations of bridge-state migration design + Phase A's structural plan stay intact; commandify is layered ON TOP of the migration.

- **v0.1.6 scope (this spec, full feature):**
  1. **Commandify** every gameplay-state-mutating bridge method (§6 — NEW). 12-14 command types covering unit orders, production, market, building placement, trebuchet pack/unpack.
  2. **Bridge-state migration** to `world.state.aoe2.*` (§5.1, §5.2, §5.6 — Phase A from v12 scope).
  3. **Replay scrubber UI** (§5.3, §5.4, §5.5, §5.7 — restored from v12 deferral).
- **v0.1.7+ scope (deferred):** counterfactual-replay UI for aoe2 (Spec 5 hooks at the aoe2 layer); AgentDriver-driven AI playtester for aoe2 sessions; advanced hotspot triage UI.

**v11 deltas vs v10:** addresses iter-10 review (Codex MAJOR + 2 MINOR; Claude MAJOR + 2 NIT — convergent on the fingerprint-cache lifecycle gap and the §5.6 cast inconsistency; Codex separately flagged that v10's wireReplaySystems framing didn't account for live-path ordering).

- **MAJOR (Codex+Claude — fingerprint cache lifecycle gap):** v10's `syncVisibilitySources` fingerprint cache only handled the active-source loop. But the existing sync also has a removeSource loop (`bridge/visibility.ts:158-164`) that removes stale sources, and gameplay can change `playerId` on conversion (`monkTaskAppliers.ts:194`) or remove/re-add `visionSource` during garrisoning (`trainingMarketOps.ts:279`). Without explicit cache cleanup, a re-added source at the same position would match its stale fingerprint, `cell.get().setSource(...)` would be skipped, `cell.markDirty()` wouldn't fire, and the engine's `sources[player]` map would remain empty for that source → permanent visibility regression for that source until some unrelated event marks the cell dirty.

  v11 spells out the fingerprint cache lifecycle:
  ```ts
  // Active-source loop (existing v10):
  for (const entity of visionEntities) {
    const key = `${player}:${sourceId}`;
    const fp = fingerprints.get(key);
    if (fp && fp.x === x && fp.y === y && fp.radius === radius) continue;
    cell.get().setSource(player, sourceId, x, y, radius);
    fingerprints.set(key, { x, y, radius });
    cell.markDirty();
  }
  // RemoveSource loop (v11 — mirror trackedSources cleanup):
  for (const [id, playerId] of trackedSources.entries()) {
    if (activeSources.has(id)) continue;
    visibility.removeSource(playerId, id);
    trackedSources.delete(id);
    fingerprints.delete(`${playerId}:${id}`);   // v11 — drop stale fingerprint
    cell.markDirty();
  }
  // Player-change cleanup (v11 — handle monk conversion, sheep claim flip):
  // When tracked source's playerId differs from current owner's, treat as
  // remove + re-add: drop old fingerprint, drop tracked entry under old player.
  ```
  The cache-key invariant: `fingerprints.has(key)` ⟺ `trackedSources.has(sourceId)` AND `trackedSources.get(sourceId) === currentPlayerOf(sourceId)`. Plan-stage will verify this against the conversion + sheep-claim test fixtures.

- **MAJOR (Codex — `wireReplaySystems` framing didn't account for live-path ordering):** v10 said "live `wireBridgeOps` calls `wireReplaySystems` then layers scenario seeding on top." But current live flow runs `seedFreshScenario` (line 196) BEFORE `wirePostSeedOps` (line 240) BEFORE `registerBridgeSystems` (line 324). The factor-out goal is preserved but the live path can't simply "call wireReplaySystems then seed" — that inverts the ordering.

  v11 simplifies: `wireReplaySystems` is a **standalone replay-only helper**, not an extracted shared core. It constructs the minimal ops needed by gameplay systems (movement, AI, visibility, combat, fogMemory, transformOps, etc.) and calls `registerBridgeSystems` + `registerOutputTail` with **no-op stubs for UI side-effect deps** (placementMode, clearUnitCommand, markOutOfBandRenderChange, enqueueRejection — none of which fire meaningfully during replay since there are no human commands). `wireBridgeOps` is UNCHANGED — it continues to do its existing pipeline (ops construction → seedFreshScenario → wirePostSeedOps → registerBridgeSystems → registerOutputTail) for the live path. The duplication is small (the gameplay-ops construction site is the only real overlap, ~30 LOC) and acceptable; future plan-stage refactor can dedupe via a `gameplayOps(world, ...)` helper if it's worth the churn.

  ```ts
  // src/game/simulation/bridge/wireReplaySystems.ts (v11 — clarified)
  export function wireReplaySystems(
    world: GameWorld,
    accessor: BridgeStateAccessor,
    visibilityCell: VisibilityCell,
    matchState: MatchState,
  ): void {
    // Internal: construct gameplay ops (movement, AI, visibility, combat, etc.).
    // Stubs for live-only UI deps:
    const noOpRender = () => {};
    const noOpRejection = () => {};
    const stubPlacementMode: PlacementModeRef = { current: null };
    const stubClearUnitCommand = (_id: number) => {};
    // ... construct ops modules + state needed by registerBridgeSystems ...
    registerBridgeSystems({
      world, /* accessor + visibility cell + matchState + ops + stubs */,
      placementMode: stubPlacementMode,
      clearUnitCommand: stubClearUnitCommand,
      markOutOfBandRenderChange: noOpRender,
      enqueueRejection: noOpRejection,
      /* ... */
    });
    registerOutputTail(world, accessor, visibilityCell, matchState);
  }
  ```

- **MINOR (Codex+Claude — PersistedMatchState cast inconsistent in §5.6 + ADR 4):** v10 introduced `PersistedMatchState` and updated §5.3 createReplayWorldOnly's cast, but §5.6 PATH B/C and ADR 4 still cast as `SerializedMatchState`. v11 normalizes — all four sites use `as PersistedMatchState | undefined`. ADR 4's schema-1 migration also strips legacy stored derived fields before writing.

**v10 deltas vs v9:** addresses iter-9 review (Claude BLOCKER + MINOR + NIT; Codex MAJOR + 2 MINOR — convergent on the dirty-bit ineffectiveness; Claude caught the system-registration gap that v9's skeleton-narrowing introduced).

- **BLOCKER (Claude — `createReplayWorldOnly` registers no gameplay systems):** v9 narrowed `createWorldSkeleton` to "ECS components only" and moved gameplay-system registration into `wireBridgeOps` → `registerBridgeSystems`. But §5.3 `createReplayWorldOnly` only calls skeleton + `applySnapshot`, never `wireBridgeOps` → the returned world has zero `update`/`postUpdate`/`output` systems. `SessionReplayer.openAt` would advance `world.tick` but run no simulation; replay state would be frozen at the start snapshot.

  v10 introduces **`wireReplaySystems(world, accessor, visibilityCell, matchState)`** — a new helper extracted from `wireBridgeOps` that constructs the system-needed ops (movement, AI, visibility, combat, fogMemory, etc.) and calls `registerBridgeSystems` + `registerOutputTail`, but skips:
  - `seedFreshScenario` (snapshot already has scenario state)
  - `hydrateFromSavedGame` (caller did `applySnapshot` instead)
  - UI ops (selection, placementMode, enqueueRejection — replay is read-only)

  `createReplayWorldOnly` becomes:
  ```ts
  const world = createWorldSkeleton(seed, dims, accessor, visibilityCell, matchState);
  world.applySnapshot(snapshot);
  // hydrate cell + matchState as before…
  wireReplaySystems(world, accessor, visibilityCell, matchState);  // NEW v10
  attachReplayWorldContext(world, { accessor, visibilityCell, matchState });
  return world;
  ```
  This makes the replay path structurally equivalent to `wireBridgeOps`'s system-registration tail, minus the scenario/UI parts. A small refactor of `wireBridgeOps` extracts the shared core into `wireReplaySystems`; live bridge calls `wireReplaySystems` then layers the live-only UI ops + scenario seeding on top.

- **MAJOR (Codex + Claude MINOR — `VisibilityCell` dirty bit ineffective in steady state):** v9 said callers `markDirty()` after `setSource/removeSource/clearPlayer`, but the only mutator is `syncVisibilitySources` (`bridge/visibility.ts:150,162`), called every tick by `visibilitySystem` and unconditionally calling `cell.get().setSource(...)` for every active vision source. Result: cell is dirty every tick a visionSource exists — gate fires only on no-source ticks (paused / no entities), which never happens in normal play. Steady-state visibility writes are not skipped.

  v10 takes Claude's suggestion (b): **`syncVisibilitySources` fingerprints sources before invoking `setSource`** — only call `setSource(player, sourceId, x, y, radius)` when `(x, y, radius)` differs from the previously-recorded fingerprint for that source. The fingerprint is a per-(player, sourceId) `{ x, y, radius }` cached map maintained by the ops module. Only when an actual change occurs is `cell.markDirty()` invoked. Trades a small per-entity comparison (3 numbers) for a meaningful gate.

  v10 §5.2 perf framing also re-stated to avoid overclaiming: "the dirty bit is the gate; effectiveness depends on `syncVisibilitySources` fingerprinting source changes (v10 — closes Claude iter-9 MINOR). On no-change ticks the gate skips `getState()` traversal entirely. On change ticks the cost matches v8's measurement (~ ms-class for late-game)." Listed fallback ladder (every-Nth-tick batching, larger snapshotInterval) preserved as the safety net.

- **MINOR (Codex — `registerOutputTail` uses non-existent `world.addSystem`):** civ-engine API is `world.registerSystem(...)` (`civ-engine/src/world.ts:646-661`), not `addSystem`. v10 §5.2's `registerOutputTail` body uses `world.registerSystem(makeTier3SyncSystem(...))` and `world.registerSystem(makeBridgeSnapshotSystem(...))`. No civ-engine API change.

- **MINOR (Codex — `serializeMatchState` typecheck):** v9's strip removes `wonderCountdownTicks` / `relicCountdownTicks`, but the return type was still `SerializedMatchState` which requires those fields. v10 introduces `PersistedMatchState = Omit<SerializedMatchState, 'wonderCountdownTicks' | 'relicCountdownTicks'>`; `tier3SyncSystem.execute` writes `world.setState('aoe2.matchState', serializeMatchState(matchState))` with this type; the load path's `Object.assign(matchState, msState)` accepts the partial shape (mutation-target's missing fields aren't overwritten, which is fine since live API recomputes them). Schema-1 `migrateLegacySaveBlobToWorldState` strips the legacy stored derived fields the same way.

- **NIT (Claude — `_currentReplayContext.world` aliasing note belongs in code, not spec):** v10 trims §5.4's note to a one-line summary referring to a JSDoc-on-the-field comment in `ReplayController.ts` (where it'll evergreen). Spec-level note becomes: "(see ReplayController.ts JSDoc on `_currentReplayContext.world` for the play-vs-openAt aliasing rationale)."

**v9 deltas vs v8:** addresses iter-8 review (Codex BLOCKER + MAJOR + MINOR; Claude MAJOR + 3 MINOR + 2 NIT — convergent on the two substantive issues).

- **BLOCKER (Codex — initial recorder snapshot can be incomplete):** `SessionRecorder.connect()` writes `world.serialize()` immediately on connect, BEFORE any tick runs (`session-recorder.ts:150`). v8's fresh bootstrap only seeds `aoe2.bridgeMeta` before returning — Tier-3 sync (`tier3SyncSystem`) and Tier-1 codec flushes (`bridgeSnapshotSystem`) are output-phase only, so the initial snapshot would be missing `aoe2.visibility`, `aoe2.matchState`, and any Tier-1 slots populated during scenario seed. Result: `enterReplay(startTick)` opens with stale/missing Tier-3 data.

  v9 introduces a **`bootstrapFlush(world, accessor, visibilityCell, matchState)`** helper called once after `wireBridgeOps` (and `seedFreshScenario`) in PATH A, and after `Object.assign(matchState, msState)` in PATH B/C. It runs the same writes as `tier3SyncSystem.execute` + `accessor.flush()` BEFORE `RecordingService` connects. The bootstrap path becomes:
  ```ts
  const bridge = wireBridgeOps(world, visibilityCell, matchState, accessor, /* ... */);
  bootstrapFlush(world, accessor, visibilityCell, matchState);
  // …only now is recording.connect() safe.
  ```
  `RecordingService.start()` already gates on bridge readiness; the helper just needs to land before `connect()`. Test: `initialSnapshot.state['aoe2.visibility']`, `aoe2.matchState`, `aoe2.bridgeMeta`, and a sample Tier-1 slot are all present after bootstrap.

- **MAJOR (Codex + Claude — `tier3SyncSystem` perf claim factually wrong; per-tick `visibility.getState()` cost not bounded):** v8 said "costs are bounded by Uint8Array shape." Ground truth: `VisibilityMapState` is `{ width, height, players: Array<[id, { sources: Array<[id, VisionSource]>, explored: number[] }]> }` — `explored` is a sorted `number[]` materialized fresh each call (`visibility-map.ts:128`). Plus: `world.setState()` always runs `assertJsonCompatible` and marks the key dirty (`world.ts:1371`); `getStateDirty` SKIPS fingerprint for already-dirty keys (`world.ts:1577`), so equal repeated `setState`s are NOT deduped — the construction + traversal cost is paid every tick. Plus the recorder writes the full visibility into `diff.state.set` every tick (`session-recorder.ts:413`).

  v9 adds a **dirty bit to `VisibilityCell`** (Claude option 1):
  ```ts
  export class VisibilityCell {
    private _current: VisibilityMap;
    private _dirty = true;          // initial = needs first write
    constructor(initial: VisibilityMap) { this._current = initial; }
    get(): VisibilityMap { return this._current; }
    /** Marks the cell dirty and returns the live map for mutation;
     *  systems mutating `cell.get()` must also call `cell.markDirty()`. */
    markDirty(): void { this._dirty = true; }
    /** Replaces the inner map and marks dirty (used post-applySnapshot). */
    replace(next: VisibilityMap): void { this._current = next; this._dirty = true; }
    isDirty(): boolean { return this._dirty; }
    clearDirty(): void { this._dirty = false; }
  }
  ```
  Visibility-using ops modules (the ones that call `cell.get().setSource(...)` etc.) call `cell.markDirty()` after the mutation — same pattern as Tier-1 `accessor.markDirty(slot)`. `tier3SyncSystem.execute` skips the visibility write when `!cell.isDirty()` and clears on write. `MatchState` gets the same treatment via a `MatchStateDirty` flag set by ops modules that mutate it (or, more conservatively, kept unconditional since `MatchState` is small — design choice deferred to plan stage with default = unconditional matchState write since the cost is bounded).

  M6 perf benchmark (§9) extended to cover an 8-player late-game scenario with full exploration (~30k explored cells/player). Pass criterion: tier3Sync + bridgeSnapshot combined < 5 ms/tick.

- **MINOR (Claude — `createWorldSkeleton` scope ambiguous vs `wireBridgeOps`'s existing `registerBridgeSystems`):** v8 said skeleton "registers all components, validators, handlers, systems." But `wireBridgeOps` today calls `registerBridgeSystems` → `registerAllSystems` for gameplay systems (`wireBridgeOps.ts:324-377`). Reading literally would imply double-registration.

  v9 picks Claude's option (A): **skeleton registers ONLY `tier3SyncSystem` + `bridgeSnapshotSystem` plus the bridge-state component-types**; `wireBridgeOps` continues to register gameplay systems via `registerBridgeSystems`. Gameplay systems' closure-capture is already correct because `matchState` is passed by reference through `wireBridgeOps` → `registerBridgeSystems` (`registerBridgeSystems.ts:41, 122`). The v8 ordering inversion (`matchState` created before skeleton) is what makes the skeleton's `tier3SyncSystem` registration valid; gameplay system closures already worked correctly under (A).

  Skeleton signature stays as v8 (`seed, dims, accessor, visibilityCell, matchState`), but its body is narrower than v8 implied:
  ```ts
  function createWorldSkeleton(seed, dims, accessor, visibilityCell, matchState): GameWorld {
    const world = new World<...>(extractConfig(seed, dims));
    registerComponentTypes(world);   // ECS components
    // Output-phase tail (registered LAST so the order is fixed before
    // wireBridgeOps adds gameplay systems — which become PRE-tier3Sync).
    world.addSystem(makeTier3SyncSystem(visibilityCell, matchState));
    world.addSystem(makeBridgeSnapshotSystem(accessor));
    return world;
  }
  ```
  Wait — that puts the tail FIRST, not last. Correct order: skeleton registers components only. `wireBridgeOps` registers gameplay systems via `registerBridgeSystems` AS BEFORE, then immediately registers the two output-tail systems via a new `registerOutputTail(world, accessor, visibilityCell, matchState)` helper. The tail is the LAST set of registrations in the output phase. This preserves the existing wireBridgeOps flow with one new call at its tail. v9 §5.2 + §5.6 reflect this corrected scope.

- **MINOR (Codex — §8 ordering-test description out of date):** v8 fixed §5.2 to `['tier3Sync', 'bridgeSnapshot']` but §8 still said "LAST entry … is `'bridgeSnapshot'`" + perf-test only covered Tier-1. v9 §8 normalizes both: ordering test asserts the LAST TWO entries; perf benchmark covers Tier-1 + Tier-3 + recorder sink.

- **MINOR (Claude — §3 missing `bridgeMeta` row + §1 stale wording):** v9 adds `aoe2.bridgeMeta` row to §3 Tier-3 list (3 slots total: visibility, matchState, bridgeMeta). §1 wording updated from "35 Tier-1 + visibility + matchState" to "35 Tier-1 + 3 Tier-3 (visibility + matchState + bridgeMeta)."

- **NIT (Claude — `serializeMatchState` may persist stale derived fields):** `MatchState` carries `wonderCountdownTicks` / `relicCountdownTicks` fields, but live API recomputes them per-call. `Object.assign({}, matchState)` would persist stale values into `world.state.aoe2.matchState`. Replay's `getReplayMatchStateDerived` ignores these fields (computes fresh from `aoe2.wonderCountdowns/relicCountdowns`), so functionally harmless — but anything else reading the slot directly sees stale. v9 `serializeMatchState` explicitly nulls the derived fields:
  ```ts
  function serializeMatchState(m: MatchState): SerializedMatchState {
    const { wonderCountdownTicks: _wc, relicCountdownTicks: _rc, ...rest } = m;
    return rest;
  }
  ```
  Loud-fail (undefined values) preferred over silent stale.

- **NIT (Claude — `_currentReplayContext.world` post-play aliasing):** `play()` advances `_playState.world` in place; `pause()` updates `_currentReplayContext.tick` but `_currentReplayContext.world` remains the played-to world, NOT a fresh `openAt(_currentReplayContext.tick)`. Future contributors might assert equivalence. v9 §5.4 adds one-line note: "*`_currentReplayContext.world` is the most recently materialized replay world (post-play if applicable), NOT a fresh `openAt(currentTick)` result. Subsequent `scrubTo(t)` rebuilds via `openAt(t)`.*"

**v8 deltas vs v7:** addresses iter-7 review (Codex 2 MAJORs; Claude 1 MAJOR + 2 NITs — different surfaces, but all real correctness gaps).

- **MAJOR (Codex — `enterReplay()` doesn't seed `_currentReplayContext`):** v7 had `play()` snapshot from `_currentReplayContext`, but `_currentReplayContext` was only populated in `scrubTo()`. The natural "enter replay then press play" UX path would dereference `undefined` or hit a guard. v8 §5.4 `enterReplay(tick = startTick)` now: opens world, builds replay bridge, seeds `_currentReplayContext = { world, bridge, accessor, visibilityCell, matchState, tick }` from `replayBridge`, emits `onTickChange(tick)`. Same shape as `scrubTo`'s tail.

- **MAJOR (Codex — `matchState` lifecycle inverted):** v7's PATH B/C created `matchState` AFTER `createWorldSkeleton(...)`, but skeleton internally calls `registerAllSystems` which captures `matchState` in system deps closures (`registerBridgeSystems.ts:178`). Closures captured at registration cannot see an object that doesn't yet exist. v8 flips the order:
  ```ts
  // PATH B (schema-2):
  const matchState = createDefaultMatchState();   // FIRST
  const visibilityCell = new VisibilityCell(new VisibilityMap(W, H));
  let world: GameWorld;
  const accessor = new BridgeStateAccessor(() => world);
  world = createWorldSkeleton(seed, dims, accessor, visibilityCell, matchState);  // matchState passed in
  world.applySnapshot(savedGame.worldSnapshot);
  // Hydrate the SAME matchState reference (mutate in place):
  const msState = world.getState('aoe2.matchState') as SerializedMatchState | undefined;
  if (msState) Object.assign(matchState, msState);
  // Closures captured during skeleton registration see the post-hydration matchState.
  ```
  `createWorldSkeleton` signature becomes `(seed, dims, accessor, visibilityCell, matchState)`. PATH A (fresh) creates matchState first too — same shape, no need for default-then-mutate since fresh start.

- **MAJOR (Claude — Tier-3 per-tick sync to `world.state.aoe2.*` was unspecified):** §3 puts `VisibilityMap` + `MatchState` in Tier-3 (lives outside `world.state` in mutable instances). Live systems mutate them via `cell.get().setSource(...)` and direct field writes — neither path touches `world.state.aoe2.visibility` / `world.state.aoe2.matchState`. v7's `bridgeSnapshotSystem.execute` only called `accessor.flush()` which iterates the Tier-1 codec table. Net result: any recorder snapshot at tick > load carries STALE Tier-3 data; replay opens with stale visibility/matchState; saveGame round-trip is broken. The §7 core invariant fails.

  v8 introduces a dedicated **`tier3SyncSystem`** registered immediately BEFORE `bridgeSnapshotSystem` in the output phase. Its `execute(world)` does:
  ```ts
  // src/game/simulation/bridge/tier3SyncSystem.ts (NEW)
  export function makeTier3SyncSystem(
    visibilityCell: VisibilityCell,
    matchState: MatchState,
  ): SystemRegistration<...> {
    return {
      name: 'tier3Sync',
      phase: 'output',
      execute: (world) => {
        world.setState('aoe2.visibility', visibilityCell.get().getState());
        world.setState('aoe2.matchState', serializeMatchState(matchState));
      },
    };
  }
  ```
  `serializeMatchState` is the existing `MatchState → SerializedMatchState` mapper (mirror of `Object.assign({}, matchState)` for the JSON-shaped fields). Registration order in `createWorldSkeleton`'s output phase: `…all-other-systems… → tier3Sync → bridgeSnapshot`. Both ordering invariants are CI-protected by extending §5.2's trace test to assert the LAST two output-phase entries are `['tier3Sync', 'bridgeSnapshot']`. `flushBridgeStateToWorld()` (used by `saveGameOps.saveGame()` per ADR 5) calls both `tier3Sync` writes AND `accessor.flush()` so the saved snapshot captures Tier-1 + Tier-3 together.

- **NIT (Claude — `extractDimsFromSnapshot(snapshot)` unspecified):** v8 §5.6 spells out: read `mapWidth`/`mapHeight` from `snapshot.state['aoe2.bridgeMeta']` (NEW Tier-3 slot — written once at game start, carries `{ mapWidth, mapHeight }`). Fallback to `snapshot.state['aoe2.visibility'].width/height` if present (post-migration snapshots have it). Throws `MissingMapDimsError` if neither exists — guards against pre-migration snapshots that the v0.1.6 migration step is supposed to seed.

- **NIT (Claude — `makeReplayBridge.getMatchState()` derived fields):** v8 §5.3 spells out that the replay bridge's `getMatchState()` constructs derived fields (`wonderCountdownTicks`, `relicCountdownTicks`) by reading `world.state.aoe2.wonderCountdowns` / `aoe2.relicCountdowns` for the human player — same algorithm as live `assembleBridgeApi.ts:55-61`, just sourced from the replay world. Helper extracted into `getReplayMatchStateDerived(world, humanPlayerId)` and reused by both replay bridge + live bridge to guarantee identical shape.

**v7 deltas vs v6:** addresses iter-6 review (Codex 1 MAJOR; Claude ACCEPT with 1 MINOR + 3 NITs — both reviewers converge on the same root cause framed differently).

- **MAJOR / MINOR (replay-world context channel — accessor + cell get lost between `createReplayWorldOnly` and `makeReplayBridge` / `_playState`):** v6's `createReplayWorldOnly(snapshot): GameWorld` constructs an accessor + `VisibilityCell` internally and registers replay systems against them, then returns only the `world`. Downstream, `makeReplayBridge(world)` and `_playState.accessor.reset()` (§5.4) need the same accessor + cell instances — but they were dropped on the floor. SessionReplayer's `worldFactory(snapshot): World` engine signature can't be widened (`session-replayer.ts:242`).

  v7 introduces a module-level `WeakMap<GameWorld, ReplayWorldContext>` (per Codex's suggestion, equivalent in spirit to Claude's "tighten §5.3/§5.4"):
  ```ts
  // src/game/simulation/replayWorldContext.ts (NEW)
  export interface ReplayWorldContext {
    accessor: BridgeStateAccessor;
    visibilityCell: VisibilityCell;
    matchState: MatchState;
  }
  const REPLAY_WORLD_CONTEXTS = new WeakMap<GameWorld, ReplayWorldContext>();
  export function attachReplayWorldContext(world: GameWorld, ctx: ReplayWorldContext): void {
    REPLAY_WORLD_CONTEXTS.set(world, ctx);
  }
  export function getReplayWorldContext(world: GameWorld): ReplayWorldContext {
    const ctx = REPLAY_WORLD_CONTEXTS.get(world);
    if (!ctx) throw new Error('Replay world context not attached — was world built via createReplayWorldOnly?');
    return ctx;
  }
  ```
  `createReplayWorldOnly(snapshot)` calls `attachReplayWorldContext(world, { accessor, visibilityCell, matchState })` before returning. `makeReplayBridge(world)` and `_currentReplayContext` initialization read the context via `getReplayWorldContext(world)` so all three (accessor, cell, matchState) thread through to `_playState`. WeakMap means GC reclaims the entry when the world is no longer reachable.

- **MINOR (Claude — `_currentReplayContext` was missing `accessor` field):** v6 had `_currentReplayContext = { world, bridge, tick }` but `_playState = { world, bridge, accessor, tick }`. v7's `_currentReplayContext` carries `{ world, bridge, accessor, visibilityCell, matchState, tick }` so `play()` can spread it directly into `_playState`. Resolves Claude's MINOR + tightens §5.4.

- **NIT (Claude — `BridgeStateAccessor` lazy getter promises a "clear error" but the class doesn't implement one):** v7 adds `if (this._world === undefined) throw new Error('BridgeStateAccessor used before world bound')` guard in `get`/`flush`. The getter is now `() => world | undefined` and the guard converts the implicit `undefined` deref into an explicit domain error.

- **NIT (Claude — `seedFreshTiles` scope is ambiguous vs current `seedFreshScenario`):** v7 §5.6 disambiguates: `seedFreshTiles(world, seed)` is JUST the tile-grid construction (formerly `createTileGrid`); the building/unit/resource scenario seeding still happens inside `wireBridgeOps` via the existing `seedFreshScenario` helper. The skeleton-then-tiles-then-wireBridgeOps order is preserved.

- **NIT (Claude — `makeReplayBridge` accessor sharing under-specified):** Resolved by the WeakMap channel above: `makeReplayBridge(world)` reads `getReplayWorldContext(world).accessor` so the bridge ops + already-registered systems share the SAME accessor instance.

**v6 deltas vs v5:** addresses iter-5 review (Codex 1 MAJOR + 1 MINOR; Claude ACCEPT with 4 implementer notes). All other issues from iter-1 → iter-4 verified clean. Design now at convergence point — both reviewers find architecture sound.

- **MAJOR (`registerAllSystems` needs `visibility` at registration time, conflicts with skeleton-then-applySnapshot ordering):** `registerAllSystems(world, visibility, ...)` (`registerAllSystems.ts:28, 140, 308`) passes the `visibility` instance into AI / visibility / fog systems at registration time. v5's skeleton-then-applySnapshot-then-rebuild-visibility flow would register those systems against a placeholder `VisibilityMap` that gets replaced after `applySnapshot`, leaving systems with a stale closed-over reference.

  v6 introduces a `VisibilityCell` indirection (aoe2-side, no civ-engine changes):
  ```ts
  // src/game/simulation/bridge/visibilityCell.ts (NEW)
  export class VisibilityCell {
    private _current: VisibilityMap;
    constructor(initial: VisibilityMap) { this._current = initial; }
    get(): VisibilityMap { return this._current; }
    replace(next: VisibilityMap): void { this._current = next; }
  }
  ```
  Systems take a `VisibilityCell` (not a `VisibilityMap` directly) and call `cell.get().method(...)` per-step. After `applySnapshot`, the schema-2 / schema-1 paths call `cell.replace(VisibilityMap.fromState(world.getState('aoe2.visibility') as VisibilityMapState))` — every system now reads the post-applySnapshot instance through the cell. `wireBridgeOps` runs on the same world with the now-current cell. Same indirection pattern (`MatchStateCell` or just continued `Object.assign`) for matchState — already mutable so `Object.assign(matchState, msState)` mutates in place; no cell needed there.

  This is a small refactor of `registerAllSystems` (~20 call sites: visibility-using systems take `VisibilityCell` instead of `VisibilityMap`). No civ-engine changes; no `VisibilityMap.applyState` needed.

- **MINOR (§5.2 ordering-test wording still says `fn:`):** v5 fixed §8 + v5-deltas, but missed §5.2 line 436. v6 normalizes the last instance.

- **NIT (Claude F-2 — `BridgeStateAccessor.get` deserialize input cast):** `codec.deserialize(json)` where `json: unknown` and param type is `TJson | undefined` won't compile. v6 adds `as TJson | undefined` on the input.

- **NIT (Claude F-3 — `BridgeStateAccessor` constructor / `setWorld` signature mismatch):** §5.1 constructor took `world`, §5.6 called `new BridgeStateAccessor(/* deferred */) + accessor.setWorld(world)`. v6 picks the lazy-getter pattern: `new BridgeStateAccessor(() => world)` — accessor stores a getter, calls it on first read. This sidesteps the chicken-and-egg without a separate setter method.

- **NIT (Claude F-4 — duplicated v4-deltas paragraph header):** copy-paste artifact in v5 that v6 removes (only one v4-deltas section retained).

**v5 deltas vs v4:** addresses iter-4 review (Codex 1 BLOCKER + 2 MAJORs + 1 MINOR; Claude ACCEPT with 5 implementer notes). Both reviewers converge: substantive iter-3 fixes verified clean; remaining issues are spec-vs-ground-truth API formalism.

- **B1 (BLOCKER — §5.6 createWorld(savedGame: null) takes fresh-bootstrap path):** v4's §5.6 said "construct world via createWorld scaffolding without savedGame.visibility (savedGame: null)" — but `createWorld(seed, visibility, null)` takes the FRESH-bootstrap path (`createWorld.ts:81`+), seeding fresh tiles before any snapshot application. wireBridgeOps would close over fresh-world tile ids that get superseded by `applySnapshot`. v5 redesigns: split `createWorld` into `createWorldSkeleton(seed, { mapWidth, mapHeight })` (registers components/systems/handlers but does NOT seed tiles or apply snapshot) and a separate `seedFreshTiles(world)` step. For schema-2 / replay: skeleton → applySnapshot → rebuild visibility+matchState from `world.state` → `wireBridgeOps`. For fresh game: skeleton → seedFreshTiles → fresh visibility/matchState → wireBridgeOps. For schema-1: skeleton → applySnapshot → migrateLegacySaveBlobToWorldState → (then identical to schema-2) → wireBridgeOps.

  **The `VisibilityMap.applyState` mutate-in-place method is no longer needed** — schema-2 just constructs a fresh `new VisibilityMap(W, H)` then immediately replaces it via `VisibilityMap.fromState(world.getState('aoe2.visibility'))` BEFORE wireBridgeOps closes over the reference. Eliminates the v4 dependency on a new civ-engine method.

- **MAJOR (`world.getState<T>(...)` doesn't accept value-type generic):** v4's `world.getState<VisibilityMapState>('aoe2.visibility')` — civ-engine's overload takes the key as the type parameter; the value overload returns `unknown`. v5 uses explicit cast: `world.getState('aoe2.visibility') as VisibilityMapState | undefined`. Same pattern in `BridgeStateAccessor.get` (already does this internally) and §5.6.

- **MAJOR (System registration shape: `execute:` not `fn:`, no `ctx` param):** v4's `bridgeSnapshotSystem` example used `fn: (world, ctx) => …` — civ-engine's `SystemRegistration` requires `execute: (world) => void` (`world.ts:74-87` / `:51-56`). No `ctx` parameter. v5 specifies `execute:` and routes the `BridgeStateAccessor` to the system via **closure capture** in `createWorldSkeleton`: the accessor instance is created inside the skeleton factory, captured by the system's `execute` closure, and held by the bridge. Same accessor instance shared across all bridge ops + `bridgeSnapshotSystem`.

- **MAJOR (§5.2 vs §8 ordering-test mechanism inconsistent):** §5.2 line 406 said "trace each system's `fn`"; §8 line 720 said "test introspects the system list." Plus v4-deltas line 16 said "probe-system pattern" — yet a different mechanism. v5 normalizes everywhere to the single canonical mechanism: **instrument each output-phase system's `execute` (during test fixture setup) to push its `name` onto a per-tick trace array; assert the LAST output-phase entry is `'bridgeSnapshot'`.** §5.2, §8, and v4-deltas/v5-deltas all agree.

- **MINOR (ADR 4 body still says `combatStatesCodec.serialize(map)`):** v4-deltas line 13 promised the fix but ADR 4 body wasn't updated. v5 ADR 4 body uses direct `setState`: `world.setState('aoe2.combatStates', savedGame.sideMaps.combatStates)` — `SerializedSideMaps` already mirrors codec JSON shape per `saveSchema.ts:103-227` field-for-field.

- **NIT (Tier-1 count "34" in v2-deltas):** v4-deltas line 41 description of "v2 said 34" — historically accurate (v2 indeed said 34); not a content bug. Left unchanged.

**v4 deltas vs v3:** addresses iter-3 review (Codex 1 BLOCKER + 4 MAJORs; Claude 1 MAJOR + 6 minors/NITs).

- **B1 (Schema-2 load underspecified for visibility + matchState):** v3 removed top-level `visibility` / `matchState` from `SaveBlobV2` saying `world.applySnapshot` is enough — but current `createSimulationBridge.ts:148-149` constructs `VisibilityMap.fromState(savedGame.visibility)` BEFORE `createWorld` returns a world (which is needed to construct visibility's projector). For schema-2 where visibility lives in `world.state.aoe2.visibility`, the constructor must rehydrate the external `VisibilityMap` and `matchState` objects AFTER `world.applySnapshot`. v4 §5.6 spells out the schema-2 load flow: 1) construct world via createWorld scaffolding (without savedGame.visibility), 2) `world.applySnapshot(savedGame.worldSnapshot)`, 3) extract `VisibilityMapState` from `world.getState('aoe2.visibility')` and rebuild the live `VisibilityMap` instance via `VisibilityMap.fromState(...)`, 4) extract `SerializedMatchState` from `world.getState('aoe2.matchState')` and copy fields into the live `MatchState` mutable object.
- **MAJOR (pause() loses played-to tick):** v3 said `pause()` flow nulls `_playState` before `_currentReplayContext.tick = _playState?.tick ?? _currentReplayContext.tick`. Order-of-operations bug: by the time the assignment runs, `_playState` is already null, so the `??` falls through to the stale value. v4 §5.4 reorders: 1) capture `_playState?.tick` into a local; 2) null `_playState`; 3) update `_currentReplayContext.tick` from the local.
- **MAJOR (test plan contradicts ADR 10):** v3 §8 still asserted "`play()` calls `replayer.openAt`, NOT `world.step()`" — leftover from v2. v4 §8 inverts the assertion: "`play()` cached `_playState` doesn't re-call `replayer.openAt(tick+1)` per frame; instead `world.submitWithResult` + `world.step()` are called directly on the cached world." Plus a regression test that asserts `replayer.openAt` is NOT called more than once per `scrubTo`/`enterReplay`.
- **MAJOR (ordering invariant wording inconsistent):** v3 §5.2 was correct but file-layout / architecture / ADR sections still said "last via `before: []`." v4 normalizes the wording everywhere — "registered LAST in createWorld's output-phase registration sequence; ordering enforced by registration order tiebreaker; CI-protected by ordering test."
- **MAJOR (Tier-1 count still 34 in 4 places):** §1 / §7 / §9 / §12 all said "34 Tier-1" while §3 table has 35. v4 search-replaces to 35 throughout.
- **MAJOR (stale §5.1 duplicate API block):** v3 left in a leftover v2 example block (lines ~370-398) using the retired `accessor.getMap(slot)` string-keyed API and string-keyed `mutate` helper, contradicting the current codec-keyed `accessor.get(codec)` API defined a few lines earlier. v4 deletes the duplicate block.
- **minor (ADR 4 migration wording):** v3 said `combatStatesCodec.serialize(savedGame.sideMaps.combatStates)` — but `savedGame.sideMaps.combatStates` is ALREADY `Array<[K,V]>` (the existing `SerializedSideMaps` shape), not a `Map`, so calling `serialize()` on it is wrong. v4 corrects: `world.setState('aoe2.combatStates', savedGame.sideMaps.combatStates)` directly — no re-serialization needed because the v3 codec JSON shapes mirror the existing `SerializedSideMaps` field-for-field.
- **minor (play() endTick uses incomplete-aware bound):** v4 ADR 10 + §5.4 use `upper = bundle.metadata.incomplete ? persistedEndTick : endTick` to match `openAt`'s upper bound, avoiding divergent play-vs-scrub semantics for incomplete bundles.
- **minor (defensive hasCommandHandler check):** ADR 10's `_advanceOneFrame` step 2 now defensively checks `world.hasCommandHandler(rc.type)` before `submitWithResult`, mirroring `openAt` (`session-replayer.ts:247-252`).
- **minor (ordering-test mechanism):** §5.2 now specifies the probe-system pattern: in test-only setup, register a no-op probe system AFTER `bridgeSnapshotSystem`; assert via on-execute capture that the probe runs after `bridgeSnapshot` in tick traces. Alternative considered: civ-engine `world.getSystemOrder()` helper — deferred since no-op probe avoids engine bump.
- **NIT (`accessor.get` cache-miss sentinel):** changed `if (cached === undefined)` to `if (!this._cache.has(codec.slot))` — robustness against a future codec returning `undefined` as a valid native.
- **NIT (ADR 2 fingerprint citation):** v3's "fingerprints non-dirty keys" prose was slightly inaccurate; `clearStateDirty` (`world.ts:1490-1497`) fingerprints ALL keys at tick-start regardless. v4 wording: "`clearStateDirty` fingerprints every key at tick-start; `getStateDirty` skips already-dirty keys to avoid redundant work." Conclusion (per-tick cost is fixed, write-frequency-independent) unchanged.

**v3 deltas vs v2:** addresses iter-2 review (Codex + Claude convergent ITERATE; 2 BLOCKERs + 3 MAJORs + 2 minors).

- **B1 (API method names — `world.state.get/set` doesn't exist):** civ-engine API is `world.getState(key)` / `world.setState(key, value)` as methods (`world.ts:1369-1394`); `stateStore` is private. v2's `world.state.get(...)` / `world.state.set(...)` example wouldn't compile. v3's `BridgeStateAccessor` (§5.1) uses `world.getState<T>(slot)` / `world.setState(slot, value)`.
- **B2 (Generic `Array.from(map)` insufficient for nested Maps/Sets):** v2 said all slots use `Array<[K, V]>` form, but `researchedTechnologies` is `Map<number, Set<...>>` and `lastSeenStatic` is `Map<number, Map<number, MemoryEntry>>` — bare `Array.from(outer)` preserves the inner `Set`/`Map`, both rejected by `assertJsonCompatible`. v3's `bridgeStateSerialize.ts` has per-slot serialize/deserialize functions matching the existing `SerializedSideMaps` shape (where tech `Set`s become `[]`s and nested maps become nested entry arrays). `BridgeStateAccessor.flush()` dispatches via this table.
- **MAJOR (`before: []` doesn't put system last):** civ-engine's topological scheduler treats empty `before`/`after` as the default — no constraints. Constraint-free systems sort by registration order. Any later-registered output system would run after `bridgeSnapshotSystem` and could mutate bridge state after the recorder-visible commit. v3's solution: register `bridgeSnapshotSystem` LAST in `createWorld`'s output-phase registration sequence; add an ordering test that fails if any output system is registered after it. Also documented as an invariant in ADR 2: "any future output-phase system MUST be registered before `bridgeSnapshotSystem`."
- **MAJOR (Schema-1 migration misses visibility + matchState):** schema-1 `SaveBlob` carries `visibility: VisibilityMapState` and `matchState: SerializedMatchState` as TOP-LEVEL fields, not inside `sideMaps`. v2's `migrateLegacySideMapsToWorldState` only migrated `sideMaps`. v3's migration helper renamed to `migrateLegacySaveBlobToWorldState(world, savedGame)` and accepts the full `SaveBlob`, copying visibility + matchState into `world.state.aoe2.visibility` / `world.state.aoe2.matchState` in addition to the side-map slots.
- **MAJOR/PERF (`play()` per-frame `openAt` is O(snapshotInterval)):** v2 said playback calls `replayer.openAt(currentTick + 1)` per frame. Each `openAt` rebuilds from the closest snapshot, so playback near the middle of a 1000-tick snapshot interval would replay hundreds of steps per frame. v3 introduces a stateful play mode: `enterReplay`/`scrubTo` materializes a `_playState = { world, bridge, accessor, tick }`; `play()`'s requestAnimationFrame loop submits next-tick recorded commands and calls `world.step()` directly — same algorithm as `openAt`'s internal step loop, but per-tick instead of from-snapshot. Returns to `openAt`-from-snapshot only on `scrubTo` jumps. Documented in §5.4 + new ADR 10.
- **ADR 2 fingerprint citation corrected:** `getStateDirty` (`world.ts:1577-1593`) SKIPS dirty keys (`if (changed.has(key)) continue`); fingerprint runs in `clearStateDirty` (`world.ts:1490-1497`) for non-dirty keys at tick-start. The dominant per-call write cost is `assertJsonCompatible` (linear in nested object size), not fingerprint. Tick-end sync conclusion unchanged; just the rationale.
- **m-1 (Tier-1 count off):** prose said 34, table has 35 entries. v3 prose corrected to 35.
- **m-2 (line number):** strict-eq check is at `createSimulationBridge.ts:140-144`, not just :140. Corrected.

**v2 deltas vs v1:** addresses iter-1 review (Codex + Claude convergent ITERATE; 2 BLOCKERs + 7 MAJORs + several mediums).

- **H1/H2 (Inventory completeness):** `conversionState` and `buildingCombatStates` added to Tier-1; `villagerOrdinals` moved from Tier-2 to Tier-1 (it's a monotonic creation counter for canonical-AoE2 role assignment, not equivalent to live villager count after deaths).
- **H3 (BLOCKER — storage shape):** civ-engine's `setState` requires JSON-compatible plain objects/arrays/primitives — `Map`/`Set` will be rejected by `assertJsonCompatible`. v2 storage uses `Array<[K, V]>` form for entity-keyed maps (mirrors existing `SerializedSideMaps`). Reads materialize a `Map`; writes serialize back at tick-end.
- **H4 (ADR 2 rationale):** rewritten to cite actual costs (`assertJsonCompatible` traversal, `jsonFingerprint` on dirty keys, structured-clone allocation pressure) — not the wrong "one TickDiff per write" claim. Conclusion (tick-end sync) unchanged.
- **H5 (ADR 4 schema gate):** explicitly relaxes the strict-equality version check at `createSimulationBridge.ts:140` to `(1 | 2)`. Documented loader migration: schema-1 saves still load via the existing `hydrateFromSavedGame` path; an additional step copies legacy `SaveBlob.sideMaps` into `world.state.aoe2.*` after `applySnapshot`.
- **H6 (versioning):** picked **0.1.6 c-bump** (not 0.2.0). Rationale: with back-compat for schema-1 SaveBlobs, this is non-breaking from a user-visible perspective. New saves use schema 2; old saves still load. The schema bump alone doesn't trigger b-bump under AGENTS.md (which scopes b-bump to "breaking changes" — and the load path remains compatible).
- **BLOCKER — `createReplayWorld` API mismatch with `SessionReplayer.worldFactory`:** `worldFactory` returns only `World`, and `openAt()` returns only `World`, so v1's `{ world, bridge }` factory shape was unbuildable. v2 splits the responsibility: `worldFactory` returns just `World` (matches engine API); a separate `makeReplayBridge(world)` constructs a fresh bridge from the hydrated world's `world.state.aoe2.*` slots. `ReplayController.scrubTo(tick)` calls `replayer.openAt(tick)` then `makeReplayBridge(world)` to rebuild the bridge.
- **MAJOR — phase name correction:** civ-engine phases are `input | preUpdate | update | postUpdate | output`. v1 said "LATE"; v2 specifies the `output` phase with `before: []` (last in output), so `bridgeSnapshotSystem` runs after every other system that mutates bridge state in this tick.
- **MAJOR — saveGame() must flush bridge state:** user actions outside `world.step()` (queueing training, market trades) mutate the bridge cache directly; `saveGame()` must explicitly call `flushBridgeStateToWorld()` BEFORE `world.serialize()` to ensure new schema-2 saves capture pending mutations.
- **M1 — count fixed:** total `BridgeState` slots ≈ 39; Tier-1 (fidelity-critical) 35, Tier-2 (pure derivation) 4, Tier-3 (external — visibility, matchState, bridgeMeta) 3 (v8 added bridgeMeta). Presentation-only items enumerated.
- **M2 — cache-coherence model specified** in §5.1: `BridgeStateAccessor` is a per-bridge-instance cache, materialized lazily on first read per tick, dirty-tracked per-slot, flushed at tick-end (and on demand for saveGame).
- **M3 — `play()` semantics pinned:** explicitly calls `replayer.openAt(currentTick + 1)` per animation frame. Implementer note: do NOT call `world.step()` directly — the replay world has no command queue and would diverge.
- **M4 — `bridgeSnapshotSystem` ordering:** registered as the LAST `output` phase system via `before: []` and explicit ordering tests. Recorder's snapshot hook fires AFTER `output` phase (existing engine behavior at `world.ts:1746-1763`).
- **M5 — RecordingService bound to live world:** explicit callout that the recorder stays attached to the live world via direct reference, NOT through `bridgeRef().world`. Replay-mode bridge swaps don't move the recorder. AnnotationController/MarkerListPanel disable in replay mode anyway (see §5.6).
- **M6 — perf benchmark required pre-Phase B:** Phase A includes a benchmark that asserts `bridgeSnapshotSystem` overhead < 5ms at game-end-state representative size. If realized cost is higher, options (in order of preference): batch the snapshot to every-Nth-tick instead of every tick, reduce `snapshotInterval` for the recorder so misses cost less to recover, pursue engine-side `Map`/`Set` support in setState.
- **M7 — scrub-UX mitigation in v0.1.6:** frame-coalesced drag promoted from "deferred to v0.1.7" to v0.1.6 scope. Mid-drag the scrubber renders a placeholder; only the final mouseup tick triggers `openAt`. Reverse-step LRU cache stays deferred.
- **L1 — timeline padded:** Phase A budget revised from 1.5 weeks to ~3 weeks, total ~4 weeks.

---

**Author:** aoe2 team.

**Coordinated repos:** aoe2 only. No civ-engine changes required.

**Scope:** ship full-fidelity in-game replay scrubbing of any recorded `SessionBundle` — load a bundle (current session, IDB Prior Session, or imported file), navigate to any tick, see the game state exactly as it was recorded (combat, units, economy, fog memory, AI state, all bridge-derived state). Per the user's design decision (2026-04-30), v0.1.6 ships **Option B (full fidelity)**, not the MVP variant — bridge state moves into `world.state` via `setState` so `WorldSnapshot` captures it, and replay perfectly restores it.

**Related primitives (consumed, not modified):**
- `SessionReplayer.fromBundle(bundle, { worldFactory })` + `openAt(tick)` — civ-engine Spec 1
- `BundleViewer.atTick(tick)` — civ-engine Spec 4
- `bundleHotspots(bundle)` — civ-engine v0.8.13 (renders as timeline pin icons)
- `RecordingService` + `IndexedDBMirror` — aoe2 v0.1.5 (already provides Prior Sessions list)

## 1. Goals (v0.1.6)

1. **Bridge state lives in `world.state`** (JSON-compatible array form per H3) so every `world.serialize()` snapshot captures the full bridge layer. 35 Tier-1 slots + 3 Tier-3 slots (`VisibilityMap` + `MatchState` + `bridgeMeta`) migrate per the inventory in §3.
2. **Two-step replay world construction**: `worldFactory(snapshot) => World` (engine-compatible signature) + `makeReplayBridge(world)` (aoe2 helper that rebuilds a bridge over hydrated `world.state.aoe2.*` slots).
3. **`ReplayController`** owns live-vs-replay mode. Entering replay pauses the live game; loading swaps the renderer's bridge cell to a replay-mode bridge; exiting restores the live bridge.
4. **`TimelinePanel`** bottom-strip UI with marker pins, hotspot pins (from `bundleHotspots`), draggable scrubber (with frame-coalescing per M7), replay controls (play/pause, step ±1, jump-to-marker, jump-to-tick).
5. **Three sources of replays**: current live session, IDB Prior Sessions, imported `.json` bundle file.
6. **Scrubbing UX**: drag scrubber (coalesced to mouseup-tick), click timeline, keyboard arrows / Home / End / Space (play/pause), marker/hotspot pins clickable.

## 2. Non-Goals (v0.1.6)

- **No replay-driven authorship.** Read-only navigation; no editing or substituting commands during replay (Spec 5's `forkAt` is the engine surface for that, exposed in a future aoe2 release).
- **No multi-player replay sync.** Single-player only.
- **No reverse-step LRU cache.** "Step back 1 tick" is `replayer.openAt(currentTick - 1)`. Optimization deferred to v0.1.7.
- **No `.aoebundle` file format.** Imported files are existing `SessionBundle` JSON.
- **No agent-driven scrubber automation.** Scrubber is the surface; future agent integrations consume it via dispatched browser actions.

## 3. Bridge State Inventory (v2 — corrected)

Total `BridgeState` fields ≈ 39 (per `bridgeState.ts`). Of these:

**Tier 1 (fidelity-critical — 35 slots; must move into `world.state` via per-slot JSON serialization, see §5.1):**

| Group | Slots |
|---|---|
| Combat / health | `combatStates`, `buildingHealthStates`, `buildingCombatStates` (added v2 per H1), `wildlifeStates`, `conversionState` (added v2 per H1) |
| Construction / production | `constructionStates`, `productionQueues` |
| Wonder / Relic countdowns | `wonderCountdowns`, `wonderCountdownOverrides`, `relicCountdowns`, `relicCountdownOverrides` |
| Garrison | `garrisonedByBuilding`, `garrisonedUnitToBuilding`, `garrisonedUnitVisionSources` |
| Monk + relic | `monkTasks`, `monkCarriedRelic`, `relicsInMonastery`, `monkHealCounters` |
| AI | `aiStates` |
| Economic | `playerResources`, `playerAges`, `population`, `marketExchangeRates`, `playerCivilizations` |
| Commands / movement | `unitCommands`, `sheepMoveOrders`, `rallyPoints` |
| Trebuchet | `trebuchetPackStates` |
| Stuck-villager throttle | `gathererDropOffStuckSinceTick` |
| Tech / scoring / TC refs | `researchedTechnologies`, `playerScoreCounters`, `townCenterRefs`, `villagerOrdinals` (moved to Tier-1 v2 per H2) |
| Visibility book-keeping | `trackedVisibilitySources`, `lastSeenStatic` |

**Tier 2 (pure derivation — 4 slots; rebuild on hydrate, don't snapshot):**
- `movePathCache` (re-solve A* on demand)
- `monksByOwner` (rebuild from `world.query('unit')`)
- `monkConvertProcessedThisTick` (per-tick guard, self-clearing)
- `inFlightTechByOwner` (rebuild from `productionQueues` on hydrate)

**Tier 3 (external mutable state — 3 slots, separate from `BridgeState` but synced to `world.state` per tick via `tier3SyncSystem`):**
- `VisibilityMap.getState()` → `world.state.set('aoe2.visibility', ...)` (where `...` is the existing `VisibilityMapState` JSON shape — `{ width, height, players: Array<[id, { sources, explored: number[] }]> }`). v9: gated by `VisibilityCell._dirty` to avoid re-traversal cost when no source changed.
- `MatchState` → `world.state.set('aoe2.matchState', serializeMatchState(matchState))` (matches existing `SerializedMatchState`; derived fields stripped to avoid persisting stale values).
- `bridgeMeta = { mapWidth, mapHeight }` → `world.state.set('aoe2.bridgeMeta', ...)` (v8 NEW; written once at game start, idempotent thereafter; lets `extractDimsFromSnapshot` recover dims for any snapshot regardless of visibility-migration state).

**Presentation-only (5 items — never serialized, never needed for scrub):**
- `selection.refs` — UI selection state
- `placementMode.current` — placement preview cell
- `hasOutOfBandRenderChangeRef` — render dirty flag
- `RenderStore` / `RenderAdapter` projections — derived from visible entities
- `commandRejectionQueue` — debug/error feedback

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Live game                                 │
│  ┌──────────┐  ┌─────────┐  ┌───────────────────────────┐        │
│  │ World    │←─│ Bridge  │  │ RecordingService          │        │
│  │ (engine) │→ │ (aoe2)  │  │  → IndexedDBMirror        │        │
│  └────┬─────┘  └────┬────┘  └───────────────────────────┘        │
│       │             │                                            │
│       │      ┌──────┴──────┐                                     │
│       │      │ BridgeState │ (per-tick cache; lazy materialize   │
│       │      │  Accessor   │  on read; dirty-tracked; flush at   │
│       │      └──────┬──────┘  tick-end via bridgeSnapshotSystem) │
│       │             │                                            │
│       └─bridgeSync──┘  (output-phase system, registered LAST     │
│                         in output, registered LAST in createWorld;│
│                         registration-order tiebreaker enforces it │
│                         every other system that mutates bridge)  │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼ recorder snapshot at world.tick % snapshotInterval === 0
                ┌──────────────────────────┐
                │ WorldSnapshot.state.aoe2 │
                │  carries 35 Tier-1 +     │
                │  visibility + matchState │
                └─────────┬────────────────┘
                          ▼
                  SessionBundle
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Replay mode                                │
│  ┌──────────────────┐                                            │
│  │ ReplayController │← user opens replay (live bundle / IDB /    │
│  └────┬─────────────┘   file)                                    │
│       │                                                          │
│       ▼                                                          │
│  SessionReplayer.fromBundle(bundle, {                            │
│    worldFactory: (snap) => createReplayWorldOnly(snap)           │
│  })                                                              │
│       │                                                          │
│       ▼ openAt(targetTick)  → returns World only                 │
│  ┌─────────────┐                                                 │
│  │ World @ T   │                                                 │
│  └────┬────────┘                                                 │
│       │                                                          │
│       ▼ makeReplayBridge(world)                                  │
│  ┌─────────────────┐    Reads world.state.aoe2.* slots and       │
│  │ Replay Bridge   │    rebuilds Maps. Bridge structure          │
│  └────────┬────────┘    identical to live; ops same.             │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────┐   (renderer's bridge cell reassigned)              │
│  │ Renderer │                                                    │
│  └──────────┘                                                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ TimelinePanel (full-width strip below canvas)              │  │
│  │  ◀ ⏸ ▶  [════●═════════]  marker pins  hotspot pins        │  │
│  │ T:N/Total                                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**File layout** (new files marked NEW; modified files marked MOD):

```
src/game/simulation/
  bridge/
    bridgeState.ts                 MOD — Tier-1 slots removed; Tier-2 stay; getter delegates to BridgeStateAccessor
    bridgeStateAccessor.ts         NEW — per-tick cache: materialize on read, dirty-track on write, flush to world.state
    bridgeStateSerialize.ts        NEW — Map ↔ Array<[K,V]> conversion + per-slot JSON shape
    bridgeSnapshotSystem.ts        NEW — output-phase, registered LAST in createWorld; ordering test enforces this
    visibilityStateSync.ts         NEW — visibility ↔ world.state.aoe2.visibility
    matchStateSync.ts              NEW — matchState ↔ world.state.aoe2.matchState
  createWorld.ts                   MOD — registers bridgeSnapshotSystem in output phase
  makeReplayBridge.ts              NEW — given a hydrated World, build a Bridge by reading world.state.aoe2.*
  hydrateFromSavedGame.ts          MOD — back-compat for schema-1 (copies legacy SaveBlob.sideMaps into world.state)
  saveSchema.ts                    MOD — bumps SAVE_SCHEMA_VERSION to 2; SaveBlob.sideMaps becomes optional
  saveGameOps.ts                   MOD — flushBridgeStateToWorld() before world.serialize() per H4-extended

src/game/replay/                   NEW directory
  ReplayController.ts              NEW — owns live ↔ replay mode toggle, scrub/step/play
  TimelinePanel.ts                 NEW — bottom-strip timeline UI
  ReplayHotkeys.ts                 NEW — Space, ←/→, Home/End, Esc, Alt+T
  scrubFrameCoalesce.ts            NEW — drag-mouseup-only scrub commit per M7

src/ui/
  ReplayLoadDialog.ts              NEW — three-source modal
  PriorSessionsRow.ts              MOD — adds "Replay" button alongside Export/Discard

src/app/bootstrap/
  createApp.ts                     MOD — wires ReplayController + TimelinePanel into bridge cell

tests/
  replay/
    bridgeStateAccessor.test.ts    NEW — cache materialize/dirty/flush
    bridgeSnapshotSystem.test.ts   NEW — order, perf
    bridgeSnapshotPerf.test.ts     NEW — benchmark per M6
    makeReplayBridge.test.ts       NEW — hydrate from world.state
    ReplayController.test.ts       NEW
    TimelinePanel.test.ts          NEW
    replay-equivalence.test.ts     NEW — load(saveAtTickN) ≡ openAt(N)
    scrubFrameCoalesce.test.ts     NEW
  integration/
    replay-scrubber.integration.test.ts  NEW
  saveLoad/
    schema1-back-compat.test.ts    NEW — legacy SaveBlob.sideMaps → world.state migration
```

## 5. API contract

### 5.1 Bridge state migration — per-slot JsonValue serializers + `BridgeStateAccessor`

`Map`/`Set` instances are NOT directly storable in `world.state` (rejected by `assertJsonCompatible`). Each Tier-1 slot has a **per-slot serializer pair** (`serialize: native → JsonValue`, `deserialize: JsonValue → native`) registered in a dispatch table. The serializers mirror the existing `SerializedSideMaps` shape (so schema-1 SaveBlobs and schema-2 `world.state.aoe2.*` use the same JSON format).

```ts
// src/game/simulation/bridge/bridgeStateSerialize.ts
export interface SlotCodec<TNative, TJson> {
  readonly slot: string;             // 'aoe2.combatStates' etc.
  serialize(native: TNative): TJson; // native → JsonValue-compatible
  deserialize(json: TJson | undefined): TNative; // JsonValue → native; undefined → fresh empty
}

// Examples (full table covers all 35 Tier-1 slots):

// Flat entity-keyed Map: combatStates, buildingHealthStates, etc.
export const combatStatesCodec: SlotCodec<Map<number, CombatState>, Array<[number, CombatState]>> = {
  slot: 'aoe2.combatStates',
  serialize: (m) => Array.from(m),                 // Map → Array<[K, V]>
  deserialize: (j) => new Map(j ?? []),
};

// Map<K, Set<V>>: researchedTechnologies — Set must become array
export const researchedTechnologiesCodec: SlotCodec<
  Map<number, Set<ResearchableTechnologyType>>,
  Array<[number, ResearchableTechnologyType[]]>
> = {
  slot: 'aoe2.researchedTechnologies',
  serialize: (m) => Array.from(m).map(([k, set]) => [k, Array.from(set)]),
  deserialize: (j) => new Map((j ?? []).map(([k, arr]) => [k, new Set(arr)])),
};

// Map<K, Map<K2, V>>: lastSeenStatic (per-player fog memory)
export const lastSeenStaticCodec: SlotCodec<
  Map<number, Map<number, MemoryEntry>>,
  Array<[number, Array<[number, MemoryEntry]>]>
> = {
  slot: 'aoe2.lastSeenStatic',
  serialize: (m) => Array.from(m).map(([k, inner]) => [k, Array.from(inner)]),
  deserialize: (j) => new Map((j ?? []).map(([k, arr]) => [k, new Map(arr)])),
};

// Plain object slot: marketExchangeRates is already JsonValue-compatible
export const marketExchangeRatesCodec: SlotCodec<
  { food: number; wood: number; stone: number },
  { food: number; wood: number; stone: number }
> = {
  slot: 'aoe2.marketExchangeRates',
  serialize: (o) => ({ ...o }),
  deserialize: (j) => j ?? { food: 1, wood: 1, stone: 1 },
};

// Registry of all 35 Tier-1 codecs:
export const TIER_1_CODECS: ReadonlyArray<SlotCodec<unknown, unknown>> = [
  combatStatesCodec,
  buildingHealthStatesCodec,
  buildingCombatStatesCodec,
  wildlifeStatesCodec,
  conversionStateCodec,
  // ... 30 more ...
] as const;
```

`BridgeStateAccessor` provides the per-tick cache layer:

```ts
// src/game/simulation/bridge/bridgeStateAccessor.ts
import type { World } from 'civ-engine';

export class BridgeStateAccessor {
  // Lazy world getter — sidesteps the construction-order chicken-and-egg
  // (createWorldSkeleton needs the accessor to register bridgeSnapshotSystem;
  // the accessor needs the world reference). The getter is supplied by the
  // bridge construction code AFTER world creation. Premature calls produce
  // an explicit domain error (NOT an implicit `undefined.getState` TypeError),
  // so accidental misuse during registration fails loudly.
  private readonly _getWorld: () => World<...> | undefined;
  private readonly _cache = new Map<string, unknown>();
  private readonly _dirty = new Set<string>();

  constructor(getWorld: () => World<...> | undefined) {
    this._getWorld = getWorld;
  }

  private requireWorld(): World<...> {
    const w = this._getWorld();
    if (w === undefined) throw new Error('BridgeStateAccessor used before world bound');
    return w;
  }

  /** Lazy-materialize from world.state via the slot's codec. Subsequent reads
   *  in the same tick return the same cached value (reference stability is
   *  the cache-coherence invariant). */
  get<TNative, TJson>(codec: SlotCodec<TNative, TJson>): TNative {
    if (!this._cache.has(codec.slot)) {
      const json = this.requireWorld().getState(codec.slot) as TJson | undefined;
      this._cache.set(codec.slot, codec.deserialize(json));
    }
    return this._cache.get(codec.slot) as TNative;
  }

  /** Mark a slot dirty after mutation. Cheap. */
  markDirty(slot: string): void {
    this._dirty.add(slot);
  }

  /** Tick-end (or pre-saveGame): serialize dirty caches back to world.state via codecs.
   *  Called by `bridgeSnapshotSystem` and by `saveGameOps.saveGame()` (per ADR 5). */
  flush(): void {
    if (this._dirty.size === 0) return;
    const w = this.requireWorld();
    for (const slot of this._dirty) {
      const codec = SLOT_CODECS_BY_KEY.get(slot);
      if (codec === undefined) continue;
      const native = this._cache.get(slot);
      if (native === undefined) continue;
      w.setState(codec.slot, codec.serialize(native));
    }
    this._dirty.clear();
  }

  /** After applySnapshot / enterReplay / exitReplay: drop caches.
   *  Next read re-materializes from world.state via codec.deserialize. */
  reset(): void {
    this._cache.clear();
    this._dirty.clear();
  }
}
```

Ops modules read/mutate via the accessor + codec:

```ts
// Before:
const states = bridge.combatStates;
states.set(unitId, newCombatState);

// After:
import { combatStatesCodec } from './bridgeStateSerialize';
const states = accessor.get(combatStatesCodec);
states.set(unitId, newCombatState);
accessor.markDirty(combatStatesCodec.slot);
```

A `mutate` helper wraps the markDirty pattern:
```ts
function mutate<T>(
  accessor: BridgeStateAccessor,
  codec: SlotCodec<T, unknown>,
  fn: (native: T) => void,
): void {
  fn(accessor.get(codec));
  accessor.markDirty(codec.slot);
}

// Use:
mutate(accessor, combatStatesCodec, (m) => m.set(unitId, newState));
```

**Cache-coherence invariant** (per Claude M2 in iter-1):
- Single accessor instance per bridge.
- All ops modules within a tick read through the same accessor → same Map reference → mutations are visible.
- `accessor.reset()` is called on: `applySnapshot()`, `enterReplay()`, `exitReplay()`. NOT at tick start (the cache is intentionally tick-spanning; only mutated slots flush to world.state, unchanged slots stay cached).
- After `bridgeSnapshotSystem.flush()` runs, the cache is NOT cleared — `_dirty` is cleared, but cached values remain valid for the next tick.

**Invalidation events** (when `accessor.reset()` is called):
- After every `world.applySnapshot(...)` (via a dedicated reset hook in `world.ts`'s `setSetupComplete` path is brittle — instead aoe2 manages this from `hydrateFromSavedGame` and `makeReplayBridge`)
- On `enterReplay` / `exitReplay` (because the bridge is rebuilt)
- Optionally at tick-start, but unnecessary if we trust that ops modules don't capture stale Map refs across ticks (verified by tests)

### 5.2 Output-phase tail: `tier3SyncSystem` then `bridgeSnapshotSystem`

The output-phase tail has TWO systems running in fixed order: `tier3SyncSystem` (writes mutable Tier-3 state — `VisibilityMap`, `MatchState`, `bridgeMeta` — to `world.state.aoe2.*`) followed by `bridgeSnapshotSystem` (flushes the Tier-1 codec table). Both must run last so that `world.serialize()` (fired by recorder via `world.ts:1746-1763`'s diff-listener) sees current values.

**Registration site:** these two systems are NOT registered by `createWorldSkeleton` (which registers only ECS components). They are registered at the TAIL of `wireBridgeOps` after `registerBridgeSystems` (which registers all gameplay systems). Reasoning: gameplay system registration sequence is unchanged (`registerBridgeSystems.ts` paths intact); the tail is appended via a new `registerOutputTail(world, accessor, visibilityCell, matchState)` helper called as the last action in `wireBridgeOps` before scenario seeding completes.

```ts
// src/game/simulation/bridge/tier3SyncSystem.ts (NEW in v8 — closes Claude iter-7 MAJOR)
import type { SystemRegistration } from 'civ-engine';

/** Factory captures the visibility cell + matchState references in the
 *  execute closure. Per-tick this system writes the live mutable state
 *  back into world.state.aoe2.* so the recorder's snapshot sees current
 *  values. Visibility writes are gated by the cell's dirty bit (v9) —
 *  visibility-mutating ops modules must call `cell.markDirty()` after
 *  any setSource/removeSource/clearPlayer (mirrors the Tier-1 dirty-mark
 *  pattern from BridgeStateAccessor). matchState writes are unconditional
 *  since the object is small + flat. */
export function makeTier3SyncSystem(
  visibilityCell: VisibilityCell,
  matchState: MatchState,
): SystemRegistration<...> {
  return {
    name: 'tier3Sync',
    phase: 'output',
    execute: (world) => {
      if (visibilityCell.isDirty()) {
        world.setState('aoe2.visibility', visibilityCell.get().getState());
        visibilityCell.clearDirty();
      }
      world.setState('aoe2.matchState', serializeMatchState(matchState));
      // aoe2.bridgeMeta is set once at game start in bootstrapFlush and not
      // mutated per-tick; no need to re-sync (would be a no-op fingerprint
      // miss anyway since the value is identical, but skipping the
      // assertJsonCompatible call avoids wasted work).
    },
  };
}

// src/game/simulation/bridge/bridgeSnapshotSystem.ts
/** Flushes the Tier-1 codec table — only writes slots marked dirty
 *  via accessor.markDirty(). Tier-3 sync runs in tier3SyncSystem above,
 *  registered immediately before this one. */
export function makeBridgeSnapshotSystem(
  accessor: BridgeStateAccessor,
): SystemRegistration<...> {
  return {
    name: 'bridgeSnapshot',
    phase: 'output',
    execute: (_world) => {
      accessor.flush();
    },
  };
}

// src/game/simulation/bridge/registerOutputTail.ts (NEW in v9; v10 — uses correct API)
/** Tail-registration helper called at end of wireBridgeOps and wireReplaySystems.
 *  The order here is the source of truth: tier3Sync first, bridgeSnapshot last. */
export function registerOutputTail(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  visibilityCell: VisibilityCell,
  matchState: MatchState,
): void {
  world.registerSystem(makeTier3SyncSystem(visibilityCell, matchState));
  world.registerSystem(makeBridgeSnapshotSystem(accessor));
}
```

`serializeMatchState` strips derived fields to avoid persisting stale values (live API recomputes them per-call; persisting them would surface stale data to anything reading `world.state.aoe2.matchState` directly). v10 introduces an explicit persisted shape so the strip typechecks:
```ts
// src/game/simulation/saveSchema.ts (additions)
export type PersistedMatchState = Omit<
  SerializedMatchState,
  'wonderCountdownTicks' | 'relicCountdownTicks'
>;

function serializeMatchState(m: MatchState): PersistedMatchState {
  const { wonderCountdownTicks: _wc, relicCountdownTicks: _rc, ...rest } = m;
  return rest;
}
```
Load paths use `world.getState('aoe2.matchState') as PersistedMatchState | undefined`. `Object.assign(matchState, msState)` accepts the partial shape — mutation-target's `wonderCountdownTicks`/`relicCountdownTicks` fields keep their pre-existing values (or get recomputed by live API on next read). Schema-1 `migrateLegacySaveBlobToWorldState` strips legacy stored derived fields the same way before writing.

`VisibilityCell` carries a dirty bit (v9 — closes Codex+Claude iter-8 MAJOR on per-tick perf):
```ts
export class VisibilityCell {
  private _current: VisibilityMap;
  private _dirty = true;          // initial = needs first write at bootstrap
  constructor(initial: VisibilityMap) { this._current = initial; }
  get(): VisibilityMap { return this._current; }
  /** Visibility-mutating ops modules call this after setSource/removeSource etc. */
  markDirty(): void { this._dirty = true; }
  /** Used post-applySnapshot to swap in the hydrated map; auto-marks dirty. */
  replace(next: VisibilityMap): void { this._current = next; this._dirty = true; }
  isDirty(): boolean { return this._dirty; }
  clearDirty(): void { this._dirty = false; }
}
```

**v10 — `syncVisibilitySources` fingerprinting** (closes Codex iter-9 MAJOR / Claude iter-9 MINOR): the dirty bit is only effective if the mutator actually skips no-op writes. Today `syncVisibilitySources` (`bridge/visibility.ts:150-170`) iterates every entity with a `visionSource` and unconditionally calls `cell.get().setSource(player, sourceId, x, y, radius)`. v10 adds a per-(player, sourceId) `{ x, y, radius }` fingerprint cache:
```ts
// Pseudocode:
const fingerprints = new Map<string /* `${player}:${sourceId}` */, { x: number; y: number; radius: number }>();
for (const entity of visionEntities) {
  const fp = fingerprints.get(key);
  if (fp && fp.x === x && fp.y === y && fp.radius === radius) continue;  // no-op
  cell.get().setSource(player, sourceId, x, y, radius);
  fingerprints.set(key, { x, y, radius });
  cell.markDirty();
}
```
Trades 3 number comparisons per entity for a meaningful gate. Steady-state ticks (no movement among vision sources) skip the visibility write entirely. The §9 perf fallbacks (every-Nth-tick batching, larger snapshotInterval) remain as safety nets if benchmarks show this isn't enough.

The engine's `SystemRegistration` shape is `{ name, phase, execute: (world) => void, before?, after? }` (`world.ts:74-87` / `:51-56`). No `ctx` parameter — refs reach the system via closure capture from each factory.

**Ordering invariants** (CI-protected):
1. `tier3SyncSystem` is the SECOND-TO-LAST output-phase registration; `bridgeSnapshotSystem` is LAST.
2. Any future output-phase system MUST be registered BEFORE `tier3SyncSystem`.
3. civ-engine's topological scheduler treats empty `before`/`after` as the default (no constraints); constraint-free systems sort by **registration order** as the tiebreaker (per `world.ts:2089-2134, 2415-2480`).
4. **Ordering-test mechanism**: civ-engine's `World.resolvedSystemOrder` is private (`world.ts:248`) so we can't directly introspect. The test fixture instruments each output-phase system's `execute` (during test setup) to push its `name` onto a per-tick trace array. After running one `world.step()`, the test asserts the LAST TWO entries in the trace whose `phase === 'output'` are `['tier3Sync', 'bridgeSnapshot']`. Any future output system registered after either flips the trace ordering and fails the test.

`flushBridgeStateToWorld()` (used by `saveGameOps.saveGame()` per ADR 5) runs the same pair of writes (Tier-3 writes + `accessor.flush()`) so saved snapshots are consistent with recorder snapshots.

Recorder snapshots fire AFTER the output phase completes (per `world.ts:1746-1763`'s diff-listener invocation in `runTick`), so by the time `world.serialize()` runs, both Tier-3 mutable state and Tier-1 dirty slots have been written to `world.state`.

### 5.3 `worldFactory` + `makeReplayBridge` (split per BLOCKER fix)

`SessionReplayer.openAt()` calls `worldFactory(snapshot): World` (`session-replayer.ts:242`) and returns ONLY the rebuilt world. But the replay path needs the accessor + visibility cell + matchState that `createReplayWorldOnly` constructed internally — `makeReplayBridge(world)` and `_playState.accessor.reset()` (§5.4) all operate on those instances. v7's solution: a module-level `WeakMap<GameWorld, ReplayWorldContext>` channel.

```ts
// src/game/simulation/replayWorldContext.ts (NEW)
export interface ReplayWorldContext {
  accessor: BridgeStateAccessor;
  visibilityCell: VisibilityCell;
  matchState: MatchState;
}
const REPLAY_WORLD_CONTEXTS = new WeakMap<GameWorld, ReplayWorldContext>();
export function attachReplayWorldContext(world: GameWorld, ctx: ReplayWorldContext): void {
  REPLAY_WORLD_CONTEXTS.set(world, ctx);
}
export function getReplayWorldContext(world: GameWorld): ReplayWorldContext {
  const ctx = REPLAY_WORLD_CONTEXTS.get(world);
  if (!ctx) throw new Error('Replay world context not attached — was world built via createReplayWorldOnly?');
  return ctx;
}
```

```ts
// src/game/simulation/createReplayWorld.ts
/** Factory matching SessionReplayer's worldFactory signature: (snapshot) → World.
 *  Reuses createWorldSkeleton + wireReplaySystems so replay world has the
 *  full gameplay-system roster the engine's openAt step loop needs to
 *  advance state correctly. Structurally identical to PATH B's load
 *  pattern minus scenario seeding + UI ops. */
export function createReplayWorldOnly(snapshot: WorldSnapshot): GameWorld {
  const { mapWidth, mapHeight } = extractDimsFromSnapshot(snapshot);
  // Construct mutable instances FIRST (closures will capture these references):
  const visibilityCell = new VisibilityCell(new VisibilityMap(mapWidth, mapHeight));
  const matchState = createDefaultMatchState();
  let world: GameWorld;
  const accessor = new BridgeStateAccessor(() => world);
  world = createWorldSkeleton(extractSeed(snapshot), { mapWidth, mapHeight }, accessor, visibilityCell, matchState);
  world.applySnapshot(snapshot);
  // Hydrate the SAME instances (closures already captured) from snapshot:
  const visState = world.getState('aoe2.visibility') as VisibilityMapState | undefined;
  if (visState) visibilityCell.replace(VisibilityMap.fromState(visState));
  const msState = world.getState('aoe2.matchState') as PersistedMatchState | undefined;
  if (msState) Object.assign(matchState, msState);
  // v10 (Claude iter-9 BLOCKER fix): register gameplay systems + output tail.
  // Without this, openAt's step loop would advance world.tick but run no systems.
  wireReplaySystems(world, accessor, visibilityCell, matchState);
  attachReplayWorldContext(world, { accessor, visibilityCell, matchState });
  return world;
}

// src/game/simulation/bridge/wireReplaySystems.ts (NEW in v10)
/** Constructs the system-needed ops modules (movement, AI, visibility,
 *  combat, fogMemory, transformation, etc.) and calls registerBridgeSystems
 *  + registerOutputTail. Skips:
 *    - seedFreshScenario / hydrateFromSavedGame (caller already populated state)
 *    - selection / placementMode / enqueueRejection (replay is read-only)
 *    - input handlers (no UI commands during replay)
 *  This helper is extracted from wireBridgeOps's tail. wireBridgeOps now
 *  calls wireReplaySystems then layers live-only UI ops + scenario seeding
 *  on top, so DRY is preserved across the live + replay paths. */
export function wireReplaySystems(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  visibilityCell: VisibilityCell,
  matchState: MatchState,
): void {
  // ... extract ops module construction from current wireBridgeOps body ...
  // registerBridgeSystems(world, /* deps incl. visibilityCell, matchState, accessor */);
  // registerOutputTail(world, accessor, visibilityCell, matchState);
}

// src/game/simulation/makeReplayBridge.ts
export interface ReplayBridge {
  readonly world: GameWorld;
  readonly accessor: BridgeStateAccessor;        // same instance the systems hold
  readonly visibilityCell: VisibilityCell;       // same instance the systems hold
  readonly matchState: MatchState;               // same mutable object
  // Read-only surface (no setPaused, no step, no setRenderState mutations):
  getRenderState(): RenderState;
  getHudState(): HudState;
  /** v8 — derived-field parity with live bridge (per Claude iter-7 NIT).
   *  Layers `wonderCountdownTicks` / `relicCountdownTicks` for the human
   *  player over `matchState`, sourced from `world.state.aoe2.wonderCountdowns`
   *  / `aoe2.relicCountdowns`. Same algorithm as `assembleBridgeApi.ts:55-61`,
   *  extracted into shared helper `getReplayMatchStateDerived(world, humanPlayerId)`
   *  used by both replay + live bridges so shapes match exactly. */
  getMatchState(): MatchState & { wonderCountdownTicks: number; relicCountdownTicks: number };
  getSelectionState(): SelectionState;
  // ... all the read-only getters from the live SimulationBridge
}

/** Build a fresh bridge over a hydrated replay World. Retrieves the
 *  shared accessor/cell/matchState from the WeakMap context channel so
 *  the bridge ops + already-registered systems share the SAME instances
 *  (single-accessor invariant from §5.1). */
export function makeReplayBridge(world: GameWorld): ReplayBridge {
  const { accessor, visibilityCell, matchState } = getReplayWorldContext(world);
  // ... wire read-only ops over (world, accessor, visibilityCell, matchState)
}
```

`ReplayController.scrubTo(tick)` calls:
1. `replayer.openAt(tick)` → returns the rebuilt `world` (engine API; under the hood civ-engine calls our `createReplayWorldOnly` worldFactory which attaches the context)
2. `makeReplayBridge(world)` → reads `getReplayWorldContext(world)` and wires bridge over the shared accessor/cell/matchState
3. `bridgeCell.replace(replayBridge)` → renderer reassigns

### 5.4 `ReplayController`

```ts
// src/game/replay/ReplayController.ts
export type ReplayMode = 'live' | 'replay';

export interface ReplayController {
  readonly mode: ReplayMode;
  readonly currentTick: number;
  readonly bundleMetadata: SessionMetadata | null;
  readonly world: GameWorld | null;

  enterReplay(bundle: SessionBundle, atTick?: number): void;
  exitReplay(): void;

  /** Calls replayer.openAt(tick) and rebuilds the replay bridge.
   *  Internally frame-coalesced for drag UX (only commits on mouseup-tick). */
  scrubTo(tick: number, options?: { coalesce?: boolean }): void;
  commitPendingScrub(): void;
  stepForward(): void;
  stepBackward(): void;
  jumpToMarker(markerId: string): void;

  /** Stateful play mode (ADR 10): caches the current replay world+bridge as
   *  the play state; each requestAnimationFrame submits next-tick recorded
   *  commands and calls world.step() directly (same algorithm as openAt's
   *  internal step loop, but per-tick instead of from-snapshot). Returns to
   *  openAt-from-snapshot only on scrubTo() jumps. */
  play(): void;
  pause(): void;
  isPlaying(): boolean;

  onModeChange(listener: (mode: ReplayMode) => void): () => void;
  onTickChange(listener: (tick: number) => void): () => void;
}
```

**2026-05-05 implementation note:** `src/game/replay/ReplayController.ts` implements this contract with a `replayContext` cell plus `displayedTick` instead of the earlier private `_currentReplayContext` / `_playState` names used below. `commitPendingScrub()` is the explicit mouseup/drag-end hook for ADR 9: coalesced `scrubTo(tick, { coalesce: true })` updates the displayed tick without rebuilding, and `commitPendingScrub()` or non-coalesced `scrubTo(tick)` performs the `openAt` + bridge replacement. `makeReplayBridge(world)` reads the WeakMap-attached replay API and returns a full read-capable `SimulationBridge`; its scene-frame `step(delta)` intentionally does not advance replay time, so only `ReplayController.play()` calls `world.step()`.

**`enterReplay` flow:**
1. `liveBridge.setPaused(true)` — pause live game
2. `liveBridge` reference saved in closure
3. `replayer = SessionReplayer.fromBundle(bundle, { worldFactory: createReplayWorldOnly })`
4. `const tick = atTick ?? bundle.metadata.startTick;`
5. `world = replayer.openAt(tick)`
6. `replayBridge = makeReplayBridge(world)`
7. `bridgeCell.replace(replayBridge)` — renderer reassigns
8. **Seed `_currentReplayContext = { world, bridge: replayBridge, accessor: replayBridge.accessor, visibilityCell: replayBridge.visibilityCell, matchState: replayBridge.matchState, tick }`** — same shape as `scrubTo()`'s tail; required so `play()` can spread directly into `_playState` (per v8-deltas — Codex iter-7 MAJOR fix).
9. emit `onModeChange('replay')`; emit `onTickChange(tick)`

**`exitReplay` flow:**
1. `replayBridge` discarded (GC)
2. `bridgeCell.replace(liveBridge)`
3. `liveBridge.setPaused(false)`
4. emit `onModeChange('live')`

**`scrubTo(tick)` flow:**
1. `pause()` — stop any active playback (so `play()` doesn't keep racing past the new scrub target)
2. `world = replayer.openAt(tick)` — replay from closest snapshot. (`openAt` calls our `createReplayWorldOnly` worldFactory under the hood, which attaches `ReplayWorldContext` to the returned world.)
3. `replayBridge = makeReplayBridge(world)` — bridge reads the WeakMap-attached accessor/cell/matchState
4. `bridgeCell.replace(replayBridge)` — renderer reassigns
5. cache the replay context as `_currentReplayContext = { world, bridge: replayBridge, accessor: replayBridge.accessor, visibilityCell: replayBridge.visibilityCell, matchState: replayBridge.matchState, tick }` for `play()` to consume
6. emit `onTickChange(tick)`

**`play()` flow** (per ADR 10 — stateful playback):
1. If no `_playState`, snapshot from `_currentReplayContext` → `_playState = { ..._currentReplayContext }` (spread carries world/bridge/accessor/visibilityCell/matchState/tick into play state)
2. `requestAnimationFrame(_advanceOneFrame)`

**`_advanceOneFrame` body:**
1. Compute `upper = bundle.metadata.incomplete ? bundle.metadata.persistedEndTick : bundle.metadata.endTick`. If `_playState.tick >= upper`: `pause()`; return. (Matches `openAt`'s upper bound at `session-replayer.ts:206` so play and scrub use identical semantics for incomplete bundles.)
2. Submit recorded commands at `submissionTick === _playState.tick` via `world.submitWithResult(rc.type, rc.data)`. **Defensive parity with `openAt`**: before each submit, check `world.hasCommandHandler(rc.type)` and throw `ReplayHandlerMissingError` if absent (mirrors `session-replayer.ts:247-252`). In normal operation `createReplayWorldOnly` registers all handlers, so this never fires.
3. Try `world.step()`. On `WorldTickFailureError`: `pause()`; emit error; return.
4. `_playState.tick = world.tick` — re-read from the world (single source of truth for tick number after step).
5. `_playState.accessor.reset()` — drop bridge caches so the next render reads the freshly-stepped state.
6. emit `onTickChange(_playState.tick)`.
7. `requestAnimationFrame(_advanceOneFrame)` (loop).

**`pause()` flow** (order matters — capture tick BEFORE nulling `_playState`):
1. cancel pending requestAnimationFrame
2. `const lastTick = _playState?.tick ?? _currentReplayContext.tick;` — capture played-to tick into a local
3. `_currentReplayContext = { ..._currentReplayContext, tick: lastTick };` — update context so subsequent `scrubTo`/`play` resumes from where playback ended
4. `_playState = null;` — null AFTER tick is captured
5. emit `onPlayChange(false)`

**`stepForward()` / `stepBackward()`** call `scrubTo(currentTick ± 1)`. Cheap because adjacent snapshots are usually 1 tick apart in `openAt`'s loop, but worst-case is O(snapshotInterval).

**Note on `_currentReplayContext.world` post-play semantics:** captured as a one-line JSDoc on the `_currentReplayContext.world` field declaration in `ReplayController.ts` rather than tracked here long-term (v10 — Claude iter-9 NIT). Summary: post-`play()`, the field references the played-to world, NOT a fresh `openAt(_currentReplayContext.tick)` result. Subsequent `scrubTo(t)` rebuilds via `openAt(t)`; subsequent `play()` resumes from the same world.

### 5.5 `TimelinePanel` (UI)

Bottom-strip overlay (full-width, below the game canvas — does not overlap game). Visible only in replay mode. Hotkey toggle: **Alt+T**.

Renders:
- A horizontal track [0, bundle.metadata.endTick]
- Draggable scrubber thumb (frame-coalesced per M7)
- Marker pins (from `bundle.markers`) — colored by category
- Hotspot pins (from `bundleHotspots(bundle)`) — colored by severity (red high, yellow medium)
- Play/pause button, ±1 step buttons, current/total tick display, exit button
- Pointer + keyboard input

### 5.6 createWorld split + Schema-2 load flow

For schema-2 SaveBlobs (and equivalently for `createReplayWorldOnly` consuming a snapshot from a SessionBundle), the external `VisibilityMap` and mutable `MatchState` objects must be rebuilt from `world.state.aoe2.*` AFTER `world.applySnapshot`. AI / visibility / fog systems take their `VisibilityMap` reference at registration time (`registerAllSystems.ts:28, 140, 308`), so the cell-indirection introduced in v6-deltas (`VisibilityCell`) is what lets the post-applySnapshot rebuilt instance reach those already-registered systems without re-registration.

The current `createWorld(seed, visibility, savedGame)` does TWO things conditionally: register components/systems/handlers (always), AND either seed fresh tiles (if `!savedGame`) OR apply a snapshot (if `savedGame`). Both are tied to the visibility instance passed in. v5/v6 splits these:

```ts
// src/game/simulation/bridge/createWorldSkeleton.ts (NEW)
/** v9-narrowed scope: registers ECS component types only. Does NOT seed
 *  tiles, does NOT register gameplay systems (those are registered later
 *  by `wireBridgeOps` → `registerBridgeSystems`), does NOT register the
 *  output tail (`tier3SyncSystem` + `bridgeSnapshotSystem` are registered
 *  by `registerOutputTail` at the END of `wireBridgeOps`).
 *
 *  Why pass accessor/cell/matchState in here even though skeleton doesn't
 *  use them: keeps the construction site DRY — the caller already constructed
 *  these mutable references, and threading them through the skeleton call
 *  signals the load-flow ordering (cell+matchState exist BEFORE any
 *  gameplay-system registration that might capture them). The skeleton
 *  itself does no closure-capture — gameplay closures form inside
 *  `registerBridgeSystems`, AFTER the skeleton returns.
 *
 *  TS-wise: the unused params are kept for ordering documentation;
 *  consider an ESLint exception or rename to `_accessor` etc. if linter
 *  complains. Plan-stage decision. */
export function createWorldSkeleton(
  seed: string,
  config: { mapWidth: number; mapHeight: number },
  _bridgeStateAccessor: BridgeStateAccessor,
  _visibilityCell: VisibilityCell,
  _matchState: MatchState,
): GameWorld;

// src/game/simulation/bridge/seedFreshTiles.ts (NEW — extracted from createWorld)
// JUST the tile-grid construction (formerly inline in `createWorld` via
// `createTileGrid`). Building/unit/resource scenario seeding still happens
// inside `wireBridgeOps` via the existing `seedFreshScenario` helper —
// scope is intentionally narrow so the skeleton + tiles + wireBridgeOps
// order maps 1:1 onto the current `createWorld` flow.
export function seedFreshTiles(world: GameWorld, seed: string): void;

// src/game/simulation/bridge/extractDimsFromSnapshot.ts (NEW)
// Resolution order:
//   1. snapshot.state['aoe2.bridgeMeta'] → { mapWidth, mapHeight } — preferred
//   2. snapshot.state['aoe2.visibility'].{width,height} — post-bridge-state-migration
//   3. throw MissingMapDimsError — pre-migration snapshots must be migrated
//      via the v0.1.6 migration step (`migrateLegacySaveBlobToWorldState`
//      seeds `aoe2.bridgeMeta` from the old top-level fields).
export function extractDimsFromSnapshot(
  snapshot: WorldSnapshot,
): { mapWidth: number; mapHeight: number };
```

The new Tier-3 slot `aoe2.bridgeMeta` (§3 row added) carries `{ mapWidth, mapHeight }` — written once at game start by the bridge bootstrap, persisted via `tier3SyncSystem` (so it survives in every snapshot). This decouples dimension recovery from `aoe2.visibility` (which may be absent in pre-migration snapshots).

Note the chicken-and-egg resolution: `BridgeStateAccessor` is constructed before `world` exists (because the skeleton's `bridgeSnapshotSystem` closure needs it at registration time). Per v6 NIT-F3 fix, the accessor takes a lazy `getWorld: () => World<...>` getter. The `world` local is bound first via `let world: GameWorld;` then `world = createWorldSkeleton(..., accessor, cell, matchState)` — the getter `() => world` resolves correctly on first read because `getState`/`setState` only fire after registration completes.

**MatchState lifecycle (v8 fix for Codex iter-7 MAJOR):** create `matchState` BEFORE `createWorldSkeleton` so the skeleton's system registrations close over a real object. After `applySnapshot`, mutate the SAME reference in place via `Object.assign(matchState, msState)`; closures see the hydrated values on the next step.

Three load paths converge through this split:

```ts
// PATH A — Fresh game (no savedGame):
function freshGameFlow(seed: string, mapWidth: number, mapHeight: number): SimulationBridge {
  const visibility = new VisibilityMap(mapWidth, mapHeight);
  const visibilityCell = new VisibilityCell(visibility);
  const matchState = createDefaultMatchState();
  let world: GameWorld;
  const accessor = new BridgeStateAccessor(() => world);
  world = createWorldSkeleton(seed, { mapWidth, mapHeight }, accessor, visibilityCell, matchState);
  // Seed bridgeMeta so first snapshot carries dims:
  world.setState('aoe2.bridgeMeta', { mapWidth, mapHeight });
  seedFreshTiles(world, seed);
  const bridge = wireBridgeOps(world, visibilityCell, matchState, accessor, /* ... */);
  // (v9 — closes Codex iter-8 BLOCKER) Bootstrap flush BEFORE recorder connects:
  // ensures initial snapshot carries Tier-3 + freshly-seeded Tier-1 slots.
  bootstrapFlush(world, accessor, visibilityCell, matchState);
  return bridge;
}

// PATH B — Schema-2 SaveBlob (or createReplayWorldOnly):
function schema2Flow(savedGame: SaveBlobV2): SimulationBridge {
  const { mapWidth, mapHeight } = extractDimsFromSnapshot(savedGame.worldSnapshot);
  // Construct mutable instances FIRST (closures will capture these references):
  const visibilityCell = new VisibilityCell(new VisibilityMap(mapWidth, mapHeight));
  const matchState = createDefaultMatchState();
  let world: GameWorld;
  const accessor = new BridgeStateAccessor(() => world);
  world = createWorldSkeleton(savedGame.seed, { mapWidth, mapHeight }, accessor, visibilityCell, matchState);
  world.applySnapshot(savedGame.worldSnapshot);   // populates world.state.aoe2.*

  // Hydrate the SAME instances (closures already captured) from world.state:
  const visState = world.getState('aoe2.visibility') as VisibilityMapState | undefined;
  if (visState) visibilityCell.replace(VisibilityMap.fromState(visState));
  const msState = world.getState('aoe2.matchState') as PersistedMatchState | undefined;
  if (msState !== undefined) Object.assign(matchState, msState);

  const bridge = wireBridgeOps(world, visibilityCell, matchState, accessor, /* ... */);
  bootstrapFlush(world, accessor, visibilityCell, matchState);
  return bridge;
}

// PATH C — Schema-1 SaveBlob (legacy back-compat):
function schema1Flow(savedGame: SaveBlobV1): SimulationBridge {
  // schema-1 carries explicit visibility { width, height } at top level:
  const { width: mapWidth, height: mapHeight } = savedGame.visibility;
  const visibilityCell = new VisibilityCell(new VisibilityMap(mapWidth, mapHeight));
  const matchState = createDefaultMatchState();
  let world: GameWorld;
  const accessor = new BridgeStateAccessor(() => world);
  world = createWorldSkeleton(savedGame.seed, { mapWidth, mapHeight }, accessor, visibilityCell, matchState);
  world.applySnapshot(savedGame.worldSnapshot);
  // Migrate top-level visibility + matchState + sideMaps into world.state.aoe2.*
  // (also seeds aoe2.bridgeMeta from { mapWidth, mapHeight }).
  migrateLegacySaveBlobToWorldState(world, savedGame, { mapWidth, mapHeight });
  // Now identical to PATH B's tail:
  const visState = world.getState('aoe2.visibility') as VisibilityMapState | undefined;
  if (visState) visibilityCell.replace(VisibilityMap.fromState(visState));
  const msState = world.getState('aoe2.matchState') as PersistedMatchState | undefined;
  if (msState !== undefined) Object.assign(matchState, msState);
  const bridge = wireBridgeOps(world, visibilityCell, matchState, accessor, /* ... */);
  bootstrapFlush(world, accessor, visibilityCell, matchState);
  return bridge;
}

// src/game/simulation/bridge/bootstrapFlush.ts (NEW in v9 — closes Codex iter-8 BLOCKER)
/** Runs the same writes as one tick of `tier3SyncSystem` + `bridgeSnapshotSystem`,
 *  WITHOUT a world.step(). Called once at end of bridge construction so the
 *  initial recorder snapshot — which is captured immediately on
 *  RecordingService.connect() (`session-recorder.ts:150`) BEFORE any tick
 *  runs — sees the same Tier-3 + Tier-1 state that subsequent tick snapshots
 *  will carry. */
export function bootstrapFlush(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  visibilityCell: VisibilityCell,
  matchState: MatchState,
): void {
  // Tier-3 sync (force initial write regardless of dirty bit):
  world.setState('aoe2.visibility', visibilityCell.get().getState());
  visibilityCell.clearDirty();
  world.setState('aoe2.matchState', serializeMatchState(matchState));
  // bridgeMeta was set in PATH A's freshGameFlow before seedFreshTiles;
  // for PATH B/C it's already in the snapshot or migrated.
  // Tier-1 flush (writes any slots dirtied by scenario seed):
  accessor.flush();
}
```

Key insights:
- `wireBridgeOps` runs ONCE per bridge, AFTER all state is in place. It closes over the post-applySnapshot world's tile ids, the visibility CELL (not a stale instance), the rebuilt MatchState — all consistent.
- `registerAllSystems` is updated (~20 call sites) so visibility-using systems take a `VisibilityCell` instead of a `VisibilityMap`. Each tick the system calls `cell.get().method(...)`. After `applySnapshot`, `cell.replace(VisibilityMap.fromState(...))` swaps in the hydrated instance — every system sees it on the next read.
- No civ-engine changes. No `VisibilityMap.applyState` method needed. The `fromState` static + cell-replace pattern is sufficient.
- `BridgeStateAccessor` uses the lazy-getter form `(() => world)`. The getter is only called inside `get`/`flush` after registration completes, so the deferred binding `let world; ...; world = createWorldSkeleton(...)` is safe.

### 5.7 Annotation UI behavior in replay mode

- Alt+M (annotation form) — disabled when `mode === 'replay'`
- Alt+L (MarkerListPanel) — visible but read-only (no Export/Discard for the live bundle; the panel shows the replay bundle's markers, clickable to scrub-to-marker)
- `RecordingService` — bound to the live world via direct reference, NOT through `bridgeRef().world`. Replay-mode bridge swaps don't move the recorder. Live recording continues in the background while user scrubs (paused) or stops (replay-mode setPaused).

## 6. Commandify aoe2 input (NEW v13)

aoe2 currently exposes input as direct bridge methods that mutate state without going through civ-engine's command channel (`GameCommands = Record<string, never>`, `pureHelpers.ts:38`). v0.1.6 converts every gameplay-state-mutating input into a civ-engine command. This unlocks replay (commands are recorded → bundles can be replayed via `openAt`), counterfactual replay (Spec 5 fork operates on commands), AI playtester (Spec 9 AgentDriver submits commands), and matches the engine's intended programmatic surface.

### 6.1 Command surface (15 types — v14 corrected)

```ts
// src/game/simulation/commands.ts (NEW)
export type GameCommands = {
  // --- Unit orders (issued by human input directly OR by AI dispatcher post-step) ---
  'unit.move': { unitId: number; target: Position };
  'unit.attack': { unitId: number; targetEntityId: number };
  'unit.gather': { unitId: number; resourceId: number };
  'unit.context': { unitId: number; target: Position };
  'unit.contextAtEntity': { unitId: number; targetEntityId: number };
  // --- Specialty unit orders ---
  'sheep.move': { sheepId: number; target: Position };
  'monk.contextAtEntity': { unitId: number; targetEntityId: number };
  'trebuchet.pack': { unitId: number };
  'trebuchet.unpack': { unitId: number };
  // --- Production / research / economy ---
  'queue.train': { buildingId: number; unitType: TrainableUnitType };
  'queue.research': { buildingId: number; technologyType: ResearchableTechnologyType };
  'market.action': { playerId: number; actionType: MarketActionType };  // buy/sell food/wood/stone
  // --- Construction + building actions (v14 — replaces v13 unit.action; M4 fix) ---
  'building.placeConfirm': { builderId: number; buildingType: BuildableBuildingType; position: Position };
  'building.setRallyPoint': { buildingId: number; target: Position };  // v14 — was missing in v13
  'building.action': { buildingId: number; actionType: BuildingActionType };  // ungarrison etc.
};
```

`BuildingActionType` is `'ungarrison'` today (`types.ts:122`); extensible as new building-scoped actions are added.

**Out of scope for commands** (these stay as bridge methods — UI state, not gameplay state):
- Selection (`selectEntityAtCell`, `selectByRefs`, `selectUnitsInBox`, `clearSelection`, etc.) — UI-only state, doesn't replay.
- Building placement preview (`beginBuildingPlacement`) — UI mode toggle; only the confirm step is a gameplay command.
- Save/load (`saveGame`) — reads state, doesn't mutate; persistence concern.
- Read-only getters (`getRenderState`, `getHudState`, etc.).

### 6.2 Command validators + handlers (v14 — corrected against actual civ-engine API)

civ-engine separates **validation** (pre-acceptance, can reject) from **handling** (post-acceptance, mutation only). Two registrations per command:

```ts
// src/game/simulation/handlers/unit/unitMoveValidator.ts (NEW)
// Validators run synchronously inside submitWithResult BEFORE the command queues.
// Return `true` to accept, `false` for generic reject, or { code, message, ... } for detailed reject (recorder captures as RejectionResult). NEVER return `null` — civ-engine's normalizer throws.
// Use `world.isAlive(entityId)` for entity-existence checks (NOT `hasEntity`).
export const unitMoveValidator: ValidatorFn<GameCommands, 'unit.move'> = (data, world) => {
  const unitId = data.unitId;
  if (!world.isAlive(unitId)) return { code: 'unit_not_found', message: 'Unit no longer exists.' };
  const unit = world.getComponent(unitId, 'unit');
  if (!unit) return { code: 'not_a_unit', message: 'Entity is not a unit.' };
  // Bounds check (no clamping here — validators don't mutate; clamping is handler-side).
  // Passability check, etc.
  return true;  // accept (NOT null — civ-engine validator API rejects null)
};

// src/game/simulation/handlers/unit/unitMoveHandler.ts (NEW)
// Handlers run during processCommands at the START of the next step
// (NOT same-tick — see §6.5). Pure mutation, no rejection (validation already happened
// at submit time; for resource-dependent commands, handlers also do execution-time
// re-checks per §6.2 B2 fix below).
export const unitMoveHandler: HandlerFn<GameCommands, 'unit.move'> = (data, world) => {
  // Delegate to the shared helper (same code path as deterministic-system call sites
  // per §6.4 B1 fix). Helper handles unit-existence guard, clearGathererOrder,
  // accessor-backed monk task clear, target clamp, and movePathCache.delete + unitCommands.set.
  setUnitMoveCommandDirect(data.unitId, data.target);
};
```

Registration site:
```ts
// src/game/simulation/bridge/registerCommandHandlers.ts (NEW)
export function registerCommandHandlers(world: GameWorld, deps: HandlerDeps): void {
  world.registerValidator('unit.move', unitMoveValidator);
  world.registerHandler('unit.move', (data, w) => unitMoveHandler(data, w, deps));
  // ... 14 more pairs ...
}
```

**Rejection-message UX (v14 — closes Claude m3):** the bridge facade translates validator code/message tuples back into the existing toast strings via:
```ts
function formatRejectionReason(code: string, message: string): string {
  // Direct map from validator codes to existing user-facing strings:
  switch (code) {
    case 'not_enough_food': return 'Not enough food.';
    case 'unit_not_found': return 'Unit no longer exists.';
    // ... existing strings preserved ...
    default: return message;
  }
}
```
Existing `consumeCommandRejection()` API unchanged; bridge methods that call `world.submitWithResult` translate via `formatRejectionReason` before `enqueueRejection`.

### 6.3 Bridge-method facade pattern

Existing bridge methods stay as user-facing API (HUD code, hotkey handlers, AI logic all keep their current call signatures). Internally they translate to command submissions:

```ts
// Before (current bridge method):
function issueMoveCommand(x: number, y: number): boolean {
  const selected = selectionState.refs;
  if (selected.length === 0) return false;
  for (const ref of selected) {
    const unitId = currentEntityId(world, ref);
    if (unitId === null) continue;
    unitCommands.set(unitId, { type: 'move', target: { x, y } });
  }
  return true;
}

// After (commandified facade):
function issueMoveCommand(x: number, y: number): boolean {
  const selected = selectionState.refs;
  if (selected.length === 0) return false;
  let issued = false;
  for (const ref of selected) {
    const unitId = currentEntityId(world, ref);
    if (unitId === null) continue;
    const result = world.submitWithResult('unit.move', { unitId, target: { x, y } });
    if (result.accepted) issued = true;
    // (Rejections are queued via consumeCommandRejection's existing UX path)
  }
  return issued;
}
```

This keeps the UI layer unchanged. Only the bridge-method bodies change. AI systems that today call `issueUnitMoveCommand(...)` directly will similarly switch to `world.submitWithResult('unit.move', ...)`.

### 6.4 Migration order (v15 — regenerated to match §6.1's 15-command surface)

**Tier 0 (foundational, must land first):**
- Define `GameCommands` type with 15 entries from §6.1 (replace `Record<string, never>` in `pureHelpers.ts`).
- Add `registerValidator` + `registerHandler` scaffolding via new `registerCommandHandlers(world, deps)` helper called from `wireBridgeOps` after `registerBridgeSystems`.
- Audit cross-system call sites (v15 B1 fix): for every existing `issueXCommand` ops module, plan-stage produces a list of "external-input call sites" (HUD/hotkey/AI-dispatcher) vs "deterministic-system call sites" (productionQueueSystem rally, etc.). Phase 1B step 4's bridge-method commandification only converts the external-input sites; deterministic-system sites switch to a new private `setXCommandDirect(...)` helper that mutates state without submitting.
- Add `dispatcher.drainPendingCommands(world, queue)` between-step call to the main game loop.

**Tier 1 (incremental, one command per commit — 15 commits):**
1. `unit.move` — `unitCommands` mutation. Validator: unit exists. Handler: direct mutate. Helper `setUnitMoveCommandDirect` for productionQueueSystem rally.
2. `unit.attack` — `targetEntityId` resolution. Validator: unit + target exist; aggression rules. Helper if any deterministic system needs it.
3. `unit.gather` — resource entity validation. Validator: gather-eligible. Helper if any deterministic system needs it.
4. `unit.context` — facade routes to move/attack/gather/contextAtEntity based on target type.
5. `unit.contextAtEntity` — same facade routing.
6. `sheep.move`, `monk.contextAtEntity` — specialty unit orders.
7. `queue.train` — production-queue enqueue. Validator: building exists, can train this unit type, basic affordability check. **Handler re-checks resource affordability** (v15 B2 fix).
8. `queue.research` — same pattern as queue.train.
9. `market.action` — resource conversion + `marketExchangeRates` mutation. **Handler re-checks resource availability**.
10. `building.placeConfirm` — placement → construction state. **Handler re-checks resource cost + buildable position still valid**.
11. `building.setRallyPoint` (v14 NEW) — `rallyPoints.set(buildingId, target)`. Validator: building exists + owned.
12. `building.action` (v14 NEW; replaces v13 `unit.action`) — `BuildingActionType = 'ungarrison'` for now. Validator: building exists + has garrisoned units.
13. `trebuchet.pack`, `trebuchet.unpack`.

After each command lands, the corresponding bridge method's body becomes a thin facade. Existing tests must continue to pass; add command-recorded-and-replayed test for each.

**Per-command commit checklist:**
- Validator file under `handlers/<commandName>Validator.ts`.
- Handler file under `handlers/<commandName>Handler.ts` (with re-check guards for resource-dependent commands).
- Direct-mutation helper file under `bridge/<opsModule>.ts` if any deterministic system calls the same mutation path.
- Bridge-method facade in `bridge/<opsModule>.ts` updated to submit + translate rejection via `formatRejectionReason`.
- Cross-system call-site sweep: every caller of the old direct-mutation function gets re-routed (external → facade; deterministic → helper).
- Tests: validator-pass, validator-reject, handler-mutate, handler-re-check-fail-silent, recorded-execution-shape.

### 6.5 AI input via the intention/dispatcher pattern (v14 — corrected B2 fix)

**Civ-engine determinism contract** (per `tests/determinism-contract.test.ts:277-319`): systems MUST NOT call `world.submitWithResult` during their `execute` phase. The recorded `submissionTick` would be `K-1` (current tick during execute), but the handler would run at the start of step K+1 (after `processCommands(K)` already drained). Replay's `openAt` re-applies commands at iter `t = K-1` BEFORE `step()`, so the handler runs one step EARLIER than in live → state diverges. Disabling AI in replay only suppresses double-submission, not the offset.

**v14 pattern:**
1. AI-decision systems run in `update` phase. Instead of mutating bridge state directly, they push **intentions** to a `pendingCommands` queue (a per-tick array stored on bridge state):
   ```ts
   // Inside aiSystem's execute:
   for (const decision of computedDecisions) {
     pendingCommands.push({ type: 'unit.move', data: { unitId, target } });
   }
   ```
2. Before the next `world.step()`, the aoe2 game loop calls a between-step **dispatcher**:
   ```ts
   // src/game/simulation/dispatcher.ts (NEW v14)
   export function drainPendingCommands(world: GameWorld, queue: PendingCommandsQueue): void {
     for (const cmd of queue) {
       world.submitWithResult(cmd.type, cmd.data);  // BETWEEN ticks — submissionTick = world.tick
     }
     queue.length = 0;
   }
   ```
3. Recorder captures these submissions with `submissionTick = K` (post-step value); they process at start of step K+1 — same boundary as live.
4. Replay re-applies recorded commands at the same boundary for execution. Replay-mode AI-decision systems may still repopulate `pendingCommands` as serialized boundary state, but the replay-only drain clears hydrated/stale queue entries before those systems run and no dispatcher submits those replay-generated pending entries.

```ts
// Live bridge loop (in createSimulationBridge.ts):
function tick() {
  drainPendingCommands(world, pendingCommands);    // submits prior-step intentions; recorder captures
  world.step();                                    // AI writes pendingCommands intentions
  // ... rendering, UI updates ...
  requestAnimationFrame(tick);
}

// Replay (inside SessionReplayer.openAt — civ-engine code, unchanged):
for (let t = start.tick; t < targetTick; t++) {
  for (const rc of commandsByTick.get(t) ?? []) world.submitWithResult(rc.type, rc.data);
  world.step();   // AI systems disabled; pendingCommands stays empty
}
```

**Human input** stays as direct `world.submitWithResult` from bridge methods — UI events naturally happen between ticks (`requestAnimationFrame` callbacks, click handlers). Same submissionTick semantics as the AI dispatcher path.

**AI system refactor scope (Phase 1 of PLAN):**
- `aiSystem` → push build/train/research/move intentions instead of direct state mutations.
- `autoAggressionSystem` → push `unit.attack` intentions.
- `monkBehaviorSystem` decision half (driven by `assignAiMonkTasks`) → push `monk.contextAtEntity` intentions. Registered as `'prototypeMonkBehaviorDecision'`.
- (v15: wildlife auto-aggro stays deterministic — no AI-decision split exists in current code per `wildlifeCombatSystem.ts`.)

Deterministic-resolution systems (movement, combat resolution, visibility, fog memory, production-queue completion, etc.) stay as direct-mutators and run in BOTH live and replay. They do NOT call `submitWithResult`.

### 6.6 System split: AI-decision vs deterministic-resolution (v14 — corrected per Codex+Claude M1)

| System | AI-decision (live only) | Deterministic resolution (always) |
|---|---|---|
| `aiSystem` | ✓ (pure decision; pushes intentions) |  |
| `autoAggressionSystem` | ✓ (AI auto-attack decisions; pushes intentions; v14 — was "always direct" today) |  |
| `monkBehaviorSystem` decision half — registered as `'prototypeMonkBehaviorDecision'`; `assignAiMonkTasks`-driven; pushes intentions | ✓ |  |
| `monkBehaviorSystem` resolution half — registered as `'prototypeMonkBehavior'` (KEEPS this name because `relicGoldSystem` declares `after: ['prototypeMonkBehavior']` and reads relic-carrier state mutated by resolution) |  | ✓ |
| `villagerEconomySystem` |  | ✓ (gather/dropoff/score for ALL players; corrected from v13) |
| `scoutMovementSystem` |  | ✓ (deterministic AI scout movement; corrected from v13) |
| `playerCommandsSystem` |  | ✓ |
| `productionQueueSystem` |  | ✓ (completion deterministic; rally call uses `setUnitMoveCommandDirect`, NOT commandified facade — v15 B1 fix) |
| `visibilitySystem` |  | ✓ |
| `fogMemorySystem` |  | ✓ |
| `towerCombatSystem` |  | ✓ |
| `wildlifeCombatSystem` |  | ✓ (target acquisition + movement + damage all deterministic resolution; v15 — was misclassified as splittable in v14) |
| `relicCountdownSystem` |  | ✓ |
| `wonderCountdownSystem` |  | ✓ |
| `relicGoldSystem` |  | ✓ |
| `winConditionResolverSystem` |  | ✓ |
| `conquestOutcomeSystem` |  | ✓ |
| `herdableMovementSystem` |  | ✓ (RNG-based wander uses world.rng; replay re-seeds) |
| `herdableOwnershipSystem` |  | ✓ |

**Corrected criterion:** "live-only" means *the system's complete effect is the intentions it pushes; those intentions are recorded as commands and re-applied in replay.* "Deterministic resolution" means *the system mutates state directly based purely on current world state; replay re-runs it and reaches the same result.*

`wireReplaySystems` registers:
- All "deterministic resolution" systems (real registrations).
- Replay-safe "AI-decision" registrations under the same names — v14 M3 fix plus v18 bookkeeping correction. `prototypeAi` and `prototypeAutoAggression` run with real intention emitters into the replay world's bridge-owned `pendingCommands` queue. A replay-only pending drain clears hydrated or prior-step pending entries before those decision systems run; recorded command payloads submitted by `SessionReplayer.openAt` remain the only source of command execution. This satisfies cross-system `before`/`after` constraint references without double-submitting AI command payloads, and it preserves serialized pending-command state when `openAt(t)` lands exactly on an AI-decision boundary.

`wireBridgeOps` (live) registers all systems normally.

`registerCommandHandlers` (and validators) MUST be called in BOTH `wireBridgeOps` and `wireReplaySystems` — replay needs the handlers to process recorded commands (M2 fix).

For `monkBehaviorSystem`, plan-stage factoring splits it into `monkBehaviorDecisionSystem` (live-only intention-pushing) and `monkBehaviorResolutionSystem` (always; animation, conversion-completion, etc.). Same name spelled out so the constraint-graph references work.

### 6.7 Recording / replay verification

Tests:
- **Round-trip replay**: live game → record bundle → replay via `openAt(endTick)` → world state structurally equal to live end state.
- **Counterfactual fork** (Spec 5): replay via `forkAt(t)` → substitute one command → forked state diverges as expected.
- **AI playtester** (Spec 9): `AgentDriver` drives the world via commands → recorded bundle is well-formed.

## 7. ADRs

### ADR 1 — Bridge state lives in `world.state` as `Array<[K, V]>` form

**Decision:** All Tier-1 + Tier-3 state migrates into `world.state` via `setState`, stored as JSON-compatible array form (entity-keyed maps as `Array<[K, V]>`; structured records as plain objects). State keys are namespaced under `aoe2.*` (e.g., `aoe2.combatStates`, `aoe2.visibility`, `aoe2.matchState`).

**Rationale:** Spec §15 explicitly preferred this over a parallel BridgeSnapshot artifact. Civ-engine's `setState` requires JsonValue-compatible inputs (rejects `Map`/`Set` instances via `assertJsonCompatible`); the array-form pattern matches the existing `SerializedSideMaps` shape used by SaveBlob today. This makes every `world.serialize()` snapshot complete; `SessionRecorder`'s periodic snapshots therefore capture full bridge state without aoe2-specific recorder hooks.

### ADR 2 — Bridge state syncs at tick-end (output-phase, last) via `BridgeStateAccessor`

**Decision:** Ops modules mutate bridge maps via a `BridgeStateAccessor` that lazily materializes Maps on first read per tick and dirty-tracks slot writes. At tick-end, the `bridgeSnapshotSystem` (registered LAST in `createWorld`'s output-phase registration sequence; ordering enforced by registration-order tiebreaker per `world.ts:2089-2134`; CI-protected by an ordering test that fails if a later output system is registered) flushes dirty values back to `world.state` via per-slot codecs. `assertJsonCompatible` cost is paid once per dirty slot per tick, not per write.

**Rationale (corrected from v1+v2):** The dominant per-call write cost is `assertJsonCompatible` traversal per `setState` call (visits every nested element of the value). For hot paths (combat damage, resource gathering), per-write setState would call `assertJsonCompatible` hundreds of times per tick on entire bridge-state slot snapshots, blowing the tick budget.

Other costs that contribute (less dominant):
- `clearStateDirty` (`world.ts:1490-1497`) at tick start fingerprints non-dirty keys via `JSON.stringify` to detect external mutation. This is a fixed per-tick cost (independent of write frequency); tick-end sync doesn't change it.
- `getStateDirty` (`world.ts:1577-1593`) SKIPS dirty keys (`if (changed.has(key)) continue`); it fingerprints only non-dirty keys to catch out-of-band mutation. So per-call setState cost is `assertJsonCompatible` only, not fingerprint.
- Allocation / GC pressure from the structured-clone path in `applySnapshot`.

Tick-end sync collapses to one `setState` (and one `assertJsonCompatible`) per slot per tick (or zero if unchanged), which is amortizable.

### ADR 3 — `worldFactory` returns `World`; `makeReplayBridge` builds the bridge separately

**Decision:** `SessionReplayer.fromBundle({ worldFactory })` is given a factory that returns only `World` (matching engine API). A separate aoe2 helper, `makeReplayBridge(world)`, constructs a fresh bridge over the hydrated world. `ReplayController` orchestrates: `openAt(tick)` → `makeReplayBridge(world)` → bridge-cell reassignment.

**Rationale:** civ-engine's `worldFactory: (snapshot) => World` signature is fixed. Splitting bridge construction into a separate aoe2-side helper preserves engine-API compatibility while giving the controller a clear bridge handle. Replay bridges are full siblings of the live bridge — same surface, hydrated state — so no new abstraction is needed.

### ADR 4 — Save/load schema bumps to 2 with permissive loader for legacy schema-1

**Decision:** `SAVE_SCHEMA_VERSION` bumps from 1 to 2. New schema-2 saves contain only `seed + worldSnapshot` (which now includes all Tier-1 + Tier-3 state via `world.state.aoe2.*`); `SaveBlob.sideMaps`, `SaveBlob.visibility`, and `SaveBlob.matchState` become optional and are no longer written. Legacy schema-1 SaveBlobs continue to load:

- The strict-equality check at `createSimulationBridge.ts:140-144` is relaxed to `(savedGame.schema === 1 || savedGame.schema === 2)`.
- For schema-1: a new `migrateLegacySaveBlobToWorldState(world, savedGame)` runs after `world.applySnapshot(savedGame.worldSnapshot)` — copies all THREE legacy top-level fields into `world.state.aoe2.*` via the codecs:
  - `savedGame.sideMaps[fieldName]` → directly `setState`'d into the matching `aoe2.<fieldName>` slot via plain `world.setState('aoe2.combatStates', savedGame.sideMaps.combatStates)` (no codec.serialize call needed — `SerializedSideMaps` is already in the codec JSON shape per `saveSchema.ts:103-227`, mirroring v5's codec output field-for-field)
  - `savedGame.visibility` (`VisibilityMapState`) → `world.setState('aoe2.visibility', savedGame.visibility)`
  - `savedGame.matchState` (`SerializedMatchState`) → `world.setState('aoe2.matchState', stripDerivedFields(savedGame.matchState))` where `stripDerivedFields` produces a `PersistedMatchState` (omits `wonderCountdownTicks` / `relicCountdownTicks` per v10's stale-field fix; legacy v0.1.5 saves carry the derived fields, but they get recomputed on next live-API read regardless)
- For schema-2: standard path; `world.applySnapshot(savedGame.worldSnapshot)` populates everything because `world.state.aoe2.*` is already in the snapshot.

**Type discriminator:** `SaveBlob` becomes a discriminated union:
```ts
export type SaveBlob = SaveBlobV1 | SaveBlobV2;
export interface SaveBlobV1 {
  schema: 1;
  seed: string;
  worldSnapshot: WorldSnapshot;
  visibility: VisibilityMapState;        // Top-level, not in sideMaps
  matchState: SerializedMatchState;       // Top-level, not in sideMaps
  sideMaps: SerializedSideMaps;
}
export interface SaveBlobV2 {
  schema: 2;
  seed: string;
  worldSnapshot: WorldSnapshot;           // Contains aoe2.* slots
  // No sideMaps / visibility / matchState — all in worldSnapshot.state
}
```

**Rationale:** Existing user save files in IDB / on disk shouldn't break. The migration happens once per old file at load time. New saves use the cleaner schema-2 format. Per AGENTS.md versioning, this is non-breaking from a user-visible perspective (loaders accept both), so it ships as a c-bump (0.1.6).

### ADR 5 — `saveGame()` flushes bridge state before serializing

**Decision:** `saveGameOps.saveGame()` calls `accessor.flush()` (or equivalent `flushBridgeStateToWorld()`) BEFORE `world.serialize()`. This ensures bridge mutations made between the last `world.step()` and the save trigger (e.g., user queueing training, market trades, AI decision overrides) are captured in the new schema-2 saves.

**Rationale:** ops modules that run outside `world.step()` (UI input handlers, market trades, etc.) mutate bridge maps directly. Without explicit flush, those mutations would only land in `world.state` at the next tick's `output` phase — but if the user saves between mutation and step, the save would contain stale bridge state. Flush-before-serialize closes that gap.

### ADR 6 — TimelinePanel and ReplayController are aoe2-side; civ-engine unchanged

**Decision:** No civ-engine changes for v0.1.6.

**Rationale:** The engine already provides everything we need (Spec 1's `openAt`, Spec 4's BundleViewer if richer navigation is needed, v0.8.13's `bundleHotspots`). Bridge-snapshot is an aoe2-side concern.

### ADR 7 — Three load sources, single Replay action

**Decision:** `ReplayLoadDialog` supports three sources (live current, IDB Prior Session, file import); all resolve to a `SessionBundle` and invoke `replayController.enterReplay(bundle)`. The "Prior Sessions" v0.1.5 panel adds a "Replay" button alongside the existing Export/Discard.

**Rationale:** All three sources are useful. Current-session covers "I just had something interesting happen, scrub back." Prior Sessions covers "yesterday's run had a weird bug." File import covers cross-session sharing (agent-recorded bundles).

### ADR 8 — Replay mode pauses live; exit restores

**Decision:** `enterReplay` calls `liveBridge.setPaused(true)`. `exitReplay` reverses. Live World instance is preserved across the replay session.

**Rationale:** Simple model that preserves the user's session. RecordingService continues observing the live world (via direct binding, not bridge cell), so the live recording isn't corrupted by replay scrubbing.

### ADR 9 — Frame-coalesced drag scrubbing (v0.1.6 scope per M7)

**Decision:** While the user drags the scrubber thumb, `scrubTo(tick, { coalesce: true })` does NOT call `replayer.openAt(tick)` immediately. Instead the panel renders a placeholder ("Scrubbing to tick N…") and only commits the openAt on mouseup. Click-on-track and keyboard navigation always commit immediately.

**Rationale:** worst-case `scrubTo` latency is O(snapshotInterval × stepCost) ≈ 500ms. Without coalescing, dragging through a 10-second timeline would cost ~30 seconds of replay churn. Coalescing makes drag feel instant; only the final commit pays the openAt cost.

### ADR 10 — Stateful play() mode caches replay world+bridge across frames

**Decision:** `play()` does NOT call `replayer.openAt(currentTick + 1)` per animation frame. Instead, the controller maintains a `_playState = { world, bridge, accessor, tick }` cell that is initialized from the current scrub context on `play()` entry. Each frame:
1. Submits recorded commands at `submissionTick === _playState.tick` via `world.submitWithResult(rc.type, rc.data)` — same algorithm as `SessionReplayer.openAt`'s internal step loop.
2. Calls `world.step()` directly on the cached world.
3. Calls `accessor.reset()` so bridge caches re-materialize from the freshly-stepped state.
4. Increments `_playState.tick`.
5. Schedules the next frame.

Returns to `openAt`-from-snapshot only on `scrubTo()` jumps (which clear `_playState` and reset to a fresh world from the closest snapshot).

**Rationale:** `replayer.openAt(currentTick + 1)` per frame is O(snapshotInterval) per call. Near tick 999 of a 1000-tick snapshot interval, every frame replays 999 ticks → ~500ms per frame → 2 fps. Stateful play caches the world between frames, paying only one `step()` per advance — same cost as live game. Caveat: this requires us to manually trickle in `bundle.commands` per tick (which is what `openAt` does internally) — the controller pre-builds a `cmdsByTick: Map<number, RecordedCommand[]>` from `bundle.commands` once per `enterReplay`.

**Determinism check:** `world.submitWithResult(rc.type, rc.data)` followed by `world.step()` reproduces the exact same execution as the original recording (the engine's command queue + system pipeline are deterministic). Verified by the equivalence invariant in §7.

## 8. Determinism / Equivalence Invariants

Core invariant: after the bridge-state refactor, **`world.serialize()` followed by `world.applySnapshot()` round-trips perfectly for all Tier-1 + Tier-3 state**. Verified by `tests/replay/replay-equivalence.test.ts`:

```
recordSession (N ticks)
  → bundle has snapshots[] at intervals
  → for each snapshot tick T:
    → live = createWorld + run to T
    → replay = createReplayWorldOnly(bundle.snapshots[i].snapshot)
    → assert: live.serialize() === replay.serialize() (modulo per-recorder fields)
```

Plus a stronger frame-by-frame invariant:
```
recordSession (N ticks)
  → for each tick T in [0, N]:
    → live = createWorld + run to T
    → replay = SessionReplayer.fromBundle(bundle).openAt(T)
    → assert: live.serialize() ≡ replay.serialize()
```

If this passes, the bridge layer reproduces deterministically from `world.state` evolution.

## 9. Testing Strategy

**Unit tests** (vitest):
- `BridgeStateAccessor` cache materialize / dirty-track / flush / reset.
- Output-phase tail order: test fixture instruments each output-phase system's `execute` (during test setup) to push its `name` onto a per-tick trace array; after running one `world.step()`, asserts the LAST TWO entries in the trace whose `phase === 'output'` are `['tier3Sync', 'bridgeSnapshot']` in that order (v9 — was single `'bridgeSnapshot'` assertion in v7-v8). CI-protected: any future output system registered after either flips the trace order and fails the test.
- `bridgeSnapshotPerf.test.ts` — benchmark per M6: assert combined flush cost (`tier3SyncSystem` + `bridgeSnapshotSystem`) stays bounded under representative load. **Two scenarios** (v9 — was Tier-1-only in v7-v8): (1) full-game-end state with all 35 Tier-1 slots populated, < 5 ms/tick; (2) 8-player late-game with full exploration (~30k explored cells/player) for `tier3SyncSystem`'s `visibility.getState()` cost — combined Tier-1 + Tier-3 + recorder sink writes < 5 ms/tick. Also verify the `VisibilityCell` dirty-bit gate skips visibility writes when the cell is not dirty (no setSource since last tick) — establishes the no-mutation idle cost is bounded.
- `bootstrapFlush.test.ts` — verify `initialSnapshot.state['aoe2.visibility']`, `aoe2.matchState`, `aoe2.bridgeMeta`, plus a sample Tier-1 slot are all populated immediately after `freshGameFlow`/`schema2Flow`/`schema1Flow` returns (i.e., BEFORE any `world.step()`). Equivalence: `replayer.openAt(startTick)` from the resulting bundle reconstructs an equivalent bridge state.
- `makeReplayBridge` rebuilds bridge from `world.state.aoe2.*` slots correctly (matches a freshly-built live bridge structurally).
- `ReplayController` mode toggling preserves live bridge / world. `play()` reuses the cached `_playState.world` across frames — calls `submitWithResult` + `world.step()` directly per frame, NOT `replayer.openAt(tick+1)` per frame (per ADR 10). Regression test: spy on `replayer.openAt` and assert it's called at most once per `scrubTo()` / `enterReplay()`, not per animation frame during `play()`.
- `TimelinePanel` renders pins for markers + hotspots; click jumps to tick.
- `ReplayHotkeys` Space toggles play/pause; arrow keys step ±1; Home/End jump to bounds; Alt+T toggles panel.
- `scrubFrameCoalesce` mid-drag doesn't fire openAt; mouseup-tick does.

**Integration tests** (vitest + jsdom):
- `replay-equivalence.test.ts` — the determinism invariant above. Runs across multiple game-run shapes (small skirmish, mid-game, late-game with monk conversions and tower combat — to exercise `conversionState` + `buildingCombatStates`).
- `replay-scrubber.integration.test.ts` — open a recorded bundle, scrub to several ticks, verify selection / HUD / canvas-state reads match expected values.
- `schema1-back-compat.test.ts` — legacy SaveBlob (schema 1) loads correctly; bridge state migrated to world.state.

**Browser tests** (Playwright):
- Press Alt+T → TimelinePanel appears
- Click a marker pin → scrubs to that tick
- Drag scrubber → placeholder shown mid-drag; commits on mouseup
- Press Space → play resumes; press again → pauses
- Press Esc → exits replay, live game resumes

## 10. Performance considerations (v2 — corrected)

Realistic costs (per Claude H4 + M6):

- **`bridgeSnapshotSystem` per-tick cost**: O(sum of dirty Tier-1 slot sizes for `Array.from(map)`) plus O(sum of dirty slot total JSON size for `assertJsonCompatible` traversal + `jsonFingerprint`). For a representative game-end state with 35 Tier-1 slots × 50-200 entries each × deep object structure, estimated 5-20 ms per snapshot tick at 60 TPS. **Mandatory pre-Phase B benchmark** (`bridgeSnapshotPerf.test.ts`) to confirm; if cost is prohibitive, fallbacks (in order):
  1. Batch the snapshot to every-Nth-tick instead of every tick (introduces a small replay-from-snapshot inaccuracy bound by N).
  2. Reduce `snapshotInterval` for the recorder so misses cost less to recover.
  3. Pursue engine-side `Map`/`Set` support in `setState` (would require a serializer extension; deferred).

- **`createReplayWorldOnly` cost**: full registration sequence (~10ms) plus `applySnapshot` (~5-50ms depending on game size). Acceptable for once-per-load.

- **`scrubTo(tick)` cost**: `replayer.openAt(tick)` from closest snapshot. Worst case (between snapshots, snapshotInterval=1000): up to 1000 `world.step()` calls. At ~0.5ms/step in a sim with no UI, that's ~500ms. **Mitigated for drag** by frame-coalescing (ADR 9). Click and keyboard scrubbing still pay the cost, but the user expects a brief load on those.

## 11. Optimizations deferred to v0.1.7+

- **Reverse-step LRU cache**: `stepBackward` is O(replay-from-snapshot); could cache state at each visited tick.
- **Adaptive snapshot interval**: dynamically increase recorder snapshot frequency for replay-friendly bundles.
- **Engine-side Map/Set in setState**: would let aoe2 skip the Array<[K,V]> dance — defer until engine team has bandwidth.

## 12. Versioning

aoe2: `0.1.5 → 0.1.6` (c-bump per H6 resolution). Rationale: with back-compat for schema-1 SaveBlobs (ADR 4), this is non-breaking from a user-visible perspective. New saves use schema-2; old saves continue to load. Per AGENTS.md, c-bump applies to non-breaking additive changes.

civ-engine: unchanged. No engine bump required for v0.1.6.

## 13. Open Questions

1. **Hotkey for replay toggle**: **Alt+T** (matches Alt+M / Alt+L pattern; verified unused by HotkeyRegistry).
2. **TimelinePanel placement**: full-width strip below canvas (does not overlap game).
3. **`engineHalted` state during replay**: replay world is isolated; allow replay regardless of live engineHalted.
4. **Mid-tick replay entry**: not allowed; replay only starts at tick boundaries (live bridge enforces this via `setPaused`).
5. **Annotation hotkeys disabled in replay**: Alt+M disabled; Alt+L visible but read-only (clicking a marker scrubs to its tick).
6. **Default snapshot interval for recordings that anticipate replay**: keep current default (1000) for v0.1.6; tune in v0.1.7 if user feedback suggests.

---

## Implementation phases (preview; full plan in PLAN.md)

1. **Phase A — Bridge-state migration** (~3 weeks per L1): refactor 35 Tier-1 + Tier-3 slots to read/write through `BridgeStateAccessor`. Add `bridgeSnapshotSystem` (output, last). Update `saveGame()` to flush before serialize. Update `hydrateFromSavedGame` for schema-1 → world.state migration. Round-trip equivalence test + perf benchmark.
2. **Phase B — `createReplayWorldOnly` + `makeReplayBridge`** (~3 days): factory + bridge-construction helper. Tests against live World.
3. **Phase C — `ReplayController`** (~3 days): mode toggling, bridge swapping, scrub/step/play logic with frame-coalescing. Unit tests.
4. **Phase D — `TimelinePanel`** (~3 days): bottom-strip UI, marker/hotspot pins, drag scrubber, keyboard shortcuts. Browser tests.
5. **Phase E — `ReplayLoadDialog`** (~2 days): three-source modal, IDB integration, file import.
6. **Phase F — Integration + docs** (~3 days): full workflow tests, schema-1 back-compat tests, changelog, devlog, guide updates.

Total: ~4 weeks of focused work. Detailed step-by-step in PLAN.md.
