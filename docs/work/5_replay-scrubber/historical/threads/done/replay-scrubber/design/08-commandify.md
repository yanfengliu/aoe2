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

