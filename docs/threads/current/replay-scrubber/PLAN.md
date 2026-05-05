# aoe2 v0.1.6 Implementation Plan — Commandify + Bridge-State Migration + Replay Scrubber

**Status:** Draft v4 (2026-04-30). Scope: full feature per DESIGN v15. User chose option A (commandify) over deferral.

**Spec reference:** `docs/threads/current/replay-scrubber/DESIGN.md` v15.

**v4 deltas vs v3:** PLAN brought into line with DESIGN v15 — Phase 1B handlers must do execution-time re-checks of mutable state (resources, in-flight tech, market rates, placement occupancy); wildlife-split language removed (single deterministic system per ground truth); monk split naming explicit (`prototypeMonkBehavior` for resolution half; `prototypeMonkBehaviorDecision` for decision half); `setXCommandDirect` helper contract spec'd to mirror full facade behavior (clearGathererOrder, accessor-backed monk task clear) to avoid footgun.

## Goal

Ship aoe2 v0.1.6 with three layered features:
1. **Commandify** every gameplay-state-mutating bridge method into civ-engine commands. Unlocks recorded bundles having command provenance, replay forward, counterfactual replay (Spec 5), AI playtester (Spec 9), and matches the engine's intended programmatic surface.
2. **Bridge-state migration** of 35 Tier-1 + 3 Tier-3 slots to `world.state.aoe2.*` via per-slot codecs. Makes `world.serialize()` snapshots complete; enables clean schema-2 saves.
3. **Replay scrubber UI** — ReplayController, TimelinePanel, drag scrubber, play/pause, hotspot pins. Operates on bundles with full command provenance.

## Phasing rationale

- **Commandify first** because everything else depends on it. Migration's `tier3SyncSystem` + `bridgeSnapshotSystem` only matter if there's a meaningful replay flow. Replay UI relies on commands being recorded.
- **Migration second** because it's mostly orthogonal to commandify (commands write to state, migration controls how state lives). But codec design needs commandify to be in place so handlers know what to write to.
- **Scrubber UI third** — built on top of the foundation.

Each commit lands on `main` per AGENTS.md. Multi-CLI review on every commit.

## Phase 1 — Commandify foundation (versions 0.1.5.1 → 0.1.5.x)

### Phase 1A — Define command surface + register scaffolding + dispatcher (no behavior change)

**Files:**
- `src/game/simulation/commands.ts` (NEW) — `GameCommands` type alias with the 15 command types from DESIGN §6.1 (including `building.setRallyPoint` and `building.action`).
- `src/game/simulation/bridge/pureHelpers.ts` (MOD) — replace `GameCommands = Record<string, never>` with import from `commands.ts`.
- `src/game/simulation/handlers/` (NEW DIR) — placeholder per-command validator + handler file pairs (will fill incrementally in Phase 1B).
- `src/game/simulation/bridge/registerCommandHandlers.ts` (NEW) — `registerCommandHandlers(world, deps)` calls `world.registerValidator(type, validator)` and `world.registerHandler(type, handler)` for each command. Initially empty; each pair registered as it lands.
- `src/game/simulation/dispatcher.ts` (NEW v14) — `drainPendingCommands(world, queue)` reads pendingCommands intentions and submits via `world.submitWithResult`. Called by the bridge loop immediately BEFORE the next `world.step()`, after the prior step has queued intentions.
- `src/game/simulation/bridge/wireBridgeOps.ts` (MOD) — call `registerCommandHandlers(world, ...)` after `registerBridgeSystems`. Add `pendingCommands` queue to bridge state.
- `src/game/simulation/createSimulationBridge.ts` (MOD) — main game-loop tick calls `dispatcher.drainPendingCommands(world, pendingCommands)` before each `world.step()`.

**Tests:**
- `tests/commands/commandSurface.test.ts` — sanity: `world.hasCommandHandler('unit.move')` returns true after wireBridgeOps. Submit a command of unknown type — verify ground-truth behavior (queues, then fails at command processing with `missing_handler` per `world.ts:1774`; NOT a synchronous throw at submit time).
- `tests/commands/dispatcher.test.ts` — push intentions to queue, call drainPendingCommands, verify submitWithResult was called for each entry, queue is empty afterward.

**No gameplay behavior change yet** — game-loop structure adds an empty-queue dispatcher call before each `world.step()` (no-op until Phase 1B/1C). Plan-stage deliverable: cross-system call-site audit table (every `issueXCommand` call site classified as "external-input → facade" vs "deterministic-system → direct helper" per DESIGN v15 §6.4 B1 fix).

### Phase 1B — Migrate per-command (one commit per command)

For each of the 15 commands in DESIGN §6.1, in this order:
1. `unit.move`
2. `unit.attack`
3. `unit.gather`
4. `unit.context` (uses move/attack/gather based on target type)
5. `unit.contextAtEntity`
6. `sheep.move`
7. `monk.contextAtEntity`
8. `queue.train`
9. `queue.research`
10. `market.action`
11. `building.placeConfirm`
12. `building.setRallyPoint` (v14)
13. `building.action` (v14 — replaces v13's `unit.action`; covers `ungarrison`)
14. `trebuchet.pack`
15. `trebuchet.unpack`

**For each command commit:**
1. Write validator in `src/game/simulation/handlers/<commandName>Validator.ts`. Validators do **structural validation + best-effort resource validation for UX-correct rejection toasts**. Per civ-engine `CommandValidationResult` (`world.ts:130`): returns `true` to accept, `false` to reject generically, or `{ code, message, ... }` (`CommandValidationRejection`) to reject with details. NEVER returns `null` (would throw).
2. Write handler in `src/game/simulation/handlers/<commandName>Handler.ts`. Handlers do **execution-time re-checks of mutable state** (v15 B2 fix) before mutation: affordability, in-flight tech (`inFlightTechByOwner`), market rates, placement occupancy. Silent no-op on stale-state miss; recorder still captures the execution as `executed: true` (handler ran without throwing) — deterministic since replay re-runs same handler against same state. Mutation initially via existing bridge state Maps/Sets (Phase 2 will switch to `accessor.mutate(codec, fn)`).
3. Register both in `registerCommandHandlers.ts` via `world.registerValidator` + `world.registerHandler`.
4. **Cross-system call-site sweep** (v15 B1 fix): for the underlying ops module's primary mutation function, identify every existing call site:
   - **External-input call sites** (HUD, hotkey, AI dispatcher): switch to `world.submitWithResult('cmd.type', data)`. Translate validator code/message to existing toast string via `formatRejectionReason`.
   - **Deterministic-system call sites** (e.g., productionQueueSystem rally): switch to a new `setXCommandDirect(...)` private helper. Helper mirrors the full facade behavior (e.g., `setUnitMoveCommandDirect` calls `clearGathererOrder(unitId)`, clears the accessor-backed `monkTasksCodec` entry when present, and then applies `unitCommands.set(...)`) to avoid silently-broken state when called from non-spawn contexts.
5. Update AI-decision systems (per §6.6) that previously mutated this state directly: instead of mutating, push an intention to `pendingCommands` queue. Dispatcher submits immediately before the next step.
6. Tests:
   - Human input path: bridge method called → validator passes → submit → recorded. Handler runs at next step start → state mutated.
   - AI intention path: AI system pushes intention during a step → next bridge tick drains before `world.step()` → submit → recorded. Handler runs at that next step's command-processing start.
   - Rejection path: invalid input (e.g., dead unit) → validator returns `{code, message}` → recorder captures `RejectionResult`. Bridge facade's `formatRejectionReason` produces the original toast string.
   - **Batched-same-frame regression** (v15 B2 fix): for `queue.train`, `queue.research`, `market.action`, `building.placeConfirm`: submit N commands in same frame whose total cost exceeds player resources. Verify exactly K (the affordable count) succeeded; remaining handlers silent-no-opped.
   - **Helper-vs-facade parity**: deterministic-system path through `setXCommandDirect` produces structurally identical state to facade path through `submitWithResult` for the same input.

**Version bump:** 0.1.5 → 0.1.5.x as commands land.

### Phase 1C — AI system refactor (intention/dispatcher pattern)

**Files (per AI-decision system):**
- `aiSystem.ts` (MOD) — replace direct state mutations with intention pushes to `pendingCommands` queue. State that was mutated directly (`unitCommands`, etc.) stays mutated by the corresponding command handler when the intention is dispatched.
- `autoAggressionSystem.ts` (MOD) — push `unit.attack` intentions instead of mutating `unitCommands`.
- `monkBehaviorSystem.ts` (REFACTOR) — split into:
  - `monkBehaviorDecisionSystem`, registered as **`'prototypeMonkBehaviorDecision'`** (NEW name; pure decision; pushes intentions; live-only).
  - `monkBehaviorResolutionSystem`, registered as **`'prototypeMonkBehavior'`** (KEEPS name so `relicGoldSystem.ts:19`'s `after: ['prototypeMonkBehavior']` constraint resolves correctly — relicGoldSystem reads `relicsInMonastery` mutated by `applyMonkDeposit` in the resolution half). Always runs (live + replay).
- (v15: wildlife auto-aggro is **NOT** split — `wildlifeCombatSystem` is one deterministic system per ground truth; stays in deterministic-resolution column of §6.6.)

**Tests:**
- `tests/ai/aiSystem.intentions.test.ts` — run aiSystem against a fresh world; assert pendingCommands queue contains expected intentions; no direct state mutation occurred during execute.
- Existing AI integration tests must continue to pass after the refactor (game outcomes determined by handlers + resolution systems, structurally equivalent to pre-refactor behavior).

**Version bump:** 0.1.5.x → 0.1.5.y as AI systems are refactored.

**No round-trip replay test in Phase 1.** Bridge state isn't yet in `world.serialize()` snapshots (Phase 2 work). Round-trip moves to Phase 3.

## Phase 2 — Bridge-state migration (per the existing 11-iter design)

Per DESIGN.md §5.1 / §5.2 / §5.6 (Phases A1-A7 from the previous PLAN draft, now Phase 2 of the full v0.1.6 plan).

### Phase 2A — Codec dispatch + `BridgeStateAccessor` + `VisibilityCell`

(Was Phase A1 in the prior PLAN.)

### Phase 2B — `tier3SyncSystem` + `bridgeSnapshotSystem` + `registerOutputTail`

(Was Phase A2.)

### Phase 2C — `createWorldSkeleton` + `seedFreshTiles` split + load paths + `bootstrapFlush`

(Was Phase A3.)

### Phase 2D — Migrate ops modules to use `BridgeStateAccessor`

(Was Phase A4. Per-slot incremental migration; now command handlers also use the accessor.)

2026-05-04 status: the AI-side `monkTasks` blocker from KAD-0007 has been cleared, and both remaining command/task slots are migrated. `aiSystem` queues AI monk assignment through persisted `monk.contextAtEntity` intentions with expected-owner/task-kind guards; command handlers and deterministic monk behavior mutate `world.state.aoe2.monkTasks`. `unitCommands` now lives at `world.state.aoe2.unitCommands` as well, with command handlers and deterministic systems reading through `unitCommandsCodec` + `BridgeStateAccessor`. Phase 2D has no remaining bridge-owned Tier-1 codec exception, so Phase 2F can begin dropping redundant schema-1 side-map projections.

### Phase 2E — `syncVisibilitySources` fingerprint cache

(Was Phase A5.)

### Phase 2F — Schema-2 save format + version bump

(Was Phase A6.)

### Phase 2G — Migration equivalence invariant test + perf gate

(Was Phase A7.) Snapshot/load round-trip across all Tier-1 + Tier-3 slots — does NOT include command-replay equivalence (that's Phase 3A.5). Verifies: after running N ticks of a fresh game with no commands, `world.serialize()` followed by load + `applySnapshot` reconstructs an equivalent bridge state for all migrated slots. Frame-by-frame deep equality.

2026-05-05 status: closed. `tests/replay/snapshotEquivalence.test.ts` pins the exact 35-slot Tier-1 inventory, iterates `TIER_1_CODECS` for registry-driven serialize/deserialize equivalence, covers Tier-3 `visibility`, `matchState`, `bridgeMeta`, and `pendingCommands`, and preserves active Monk-task/unit-command snapshot regressions. `tests/replay/bridgeSnapshotPerf.test.ts` adds the Phase 2G bounded all-slot flush and schema-2 save serialization perf gate. Phase 3A / 3A.5 is next.

**Version bump:** 0.1.5.x → 0.1.6-rc1 when migration lands.

## Phase 3 — Replay scrubber UI (per the existing DESIGN §5.3-§5.5, §5.7)

### Phase 3A — `wireReplaySystems` + `createReplayWorldOnly` + `replayWorldContext`

Per DESIGN §5.3. `wireReplaySystems` registers:
- All deterministic-resolution systems (real registrations).
- Replay-safe AI-decision registrations under the same names (M3 fix — preserves constraint references like `autoAggressionSystem.after = ['prototypeAi']`). `prototypeAi` and `prototypeAutoAggression` run with real intention emitters into the replay world’s bridge-owned `pendingCommands` queue. The replay-only pending drain clears hydrated or prior-step pending intentions before those systems run, while `SessionReplayer`'s recorded command payloads remain the only source of actual command execution.
- ALL command handlers + validators via `registerCommandHandlers` (M2 fix — `session-replayer.ts:247` throws `ReplayHandlerMissingError` if missing).

WeakMap context channel for accessor/cell/matchState sharing.

2026-05-05 status: closed. `createReplayWorldOnly(snapshot)` wraps schema-2 world snapshots, builds a replay-mode bridge world, registers all command handlers, keeps deterministic systems real, stores replay context in a WeakMap, preserves pending-command boundary state in replay, and avoids schema-2 hydration materializing absent empty Tier-1 slots during replay construction.

### Phase 3A.5 — Round-trip equivalence test (deferred from Phase 1C — B3 fix)

`tests/replay/roundTripViaCommands.test.ts` — run fresh games with a mix of human + AI inputs (commands recorded, bridge state in world.state.aoe2.* via Phase 2 migration). Capture the bundle. Open `replayer.openAt(targetTick)` → reconstructs world. Assert structural equality between live world and replay world, including an AI pending-command boundary tick and a closest-snapshot path that starts from a snapshot containing `aoe2.pendingCommands`.

Plus `tests/replay/validatorReplayConsistency.test.ts` (M2 fix) — from the initial snapshot path, every recorded command is re-submitted and replay's `submitWithResult` result plus execution stream must match the recording. This catches state-dependent validator divergence on the full command stream; mid-bundle snapshot paths intentionally rely on structural replay checks because civ-engine snapshots do not carry `nextCommandResultSequence`.

2026-05-05 status: closed for the Phase 3A/A.5 foundation. `tests/replay/roundTripViaCommands.test.ts` records from the initial snapshot only (`terminalSnapshot: false`, no periodic snapshots), includes both a human `unit.move` and AI-recorded commands, verifies `SessionReplayer.openAt(endTick)` structurally equals the live world, verifies an AI-decision boundary tick still reconstructs pending commands, and verifies replay clears stale hydrated pending commands when advancing from a pending snapshot. `tests/replay/validatorReplayConsistency.test.ts` re-submits every recorded command from the initial snapshot path and checks the synchronous validation result and execution stream exactly.

### Phase 3B — `ReplayController` (mode toggle, scrubTo, play, pause, step)

Per DESIGN §5.4. ADRs 8-10. Stateful play mode using `_playState`. Frame-coalesced drag scrubbing.

### Phase 3C — `TimelinePanel` UI

Per DESIGN §5.5. Bottom-strip overlay, marker pins, hotspot pins, scrubber controls.

### Phase 3D — Annotation UI in replay mode

Per DESIGN §5.7. Alt+M disabled in replay; Alt+L read-only.

### Phase 3E — End-to-end replay test

`tests/replay/scrubber-e2e.test.ts` — open a recorded bundle in the UI, scrub to several ticks, verify selection/HUD/canvas state. `tests/replay/play-equivalence.test.ts` — pressing play from tick T advances state identically to the live recording at the same ticks.

**Version bump:** 0.1.6-rc1 → 0.1.6 final.

## Multi-CLI review checkpoints

Each phase commit triggers multi-CLI review per AGENTS.md. Synthesize into `docs/threads/current/replay-scrubber/<date>/impl-N/REVIEW.md`. Address findings before proceeding to the next phase.

## Risks + mitigations

- **Commandify is large.** Mitigated by incremental ordering: one command per commit, each stand-alone testable.
- **AI-system / replay-system split (§6.6) may not cleanly separate.** Plan-stage will analyze each system before commandifying its inputs; some systems need internal refactor (decision vs resolution) before they can be split.
- **Determinism regressions from command-submission timing.** Mitigated by intention/dispatcher pattern (DESIGN §6.5); full round-trip check happens in Phase 3A.5.
- **Migration interacts with commandify.** Phase 2D's per-slot migration uses the codec table; command handlers (Phase 1B) initially mutate via Maps directly, then switch to `accessor.mutate(codec, fn)` during Phase 2D. Two-step migration per slot is manageable.
- **Scrubber UI depends on commandify + migration being correct.** Phase 3 only starts after Phase 2 migration equivalence test passes; Phase 3A.5 round-trip-via-commands verifies the combination BEFORE Phase 3B-E (UI work).

## Out-of-scope notes

Deferred to v0.1.7+:
- Counterfactual-replay UI for aoe2 (using Spec 5's `forkAt` + ForkBuilder). Engine-side machinery exists; aoe2-side UI hooks deferred.
- AgentDriver-driven AI playtester. Engine-side AgentDriver (Spec 9) exists; aoe2-side adapter deferred.
- Advanced hotspot triage UI in TimelinePanel.
- Reverse-step LRU cache.
- Adaptive snapshot interval.

## Success criteria

v0.1.6 ships when:
- Migration equivalence test (Phase 2G) passes: every Tier-1 + Tier-3 slot round-trips through serialize/applySnapshot.
- Round-trip-via-commands test (Phase 3A.5) passes: live game with human + AI inputs replayable via `openAt` to structurally equal end state, including pending-command boundary and pending-snapshot replay paths.
- Validator-replay-consistency test (Phase 3A.5) passes: initial-snapshot replay's `submitWithResult` results and command executions match the recorded stream.
- Scrubber e2e test (Phase 3E) passes: drag scrubber works in browser.
- All four gates green: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Multi-CLI review on the final commit returns ACCEPT.
- Docs updated per AGENTS.md mandatory checklist (changelog, devlog, ARCHITECTURE.md, drift-log, decisions.md).
