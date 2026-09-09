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

- **Historical v0.1.6 full-feature target (now split across v0.1.6/v0.1.7 plus future Phase 3D/3E):**
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
