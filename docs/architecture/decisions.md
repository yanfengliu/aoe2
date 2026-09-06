# Key Architectural Decisions

Durable decisions that shape the codebase. Never delete a decision; if a decision
no longer holds, add a newer decision that explicitly supersedes it and mark the
old one as superseded with a pointer to the new entry.

Entries are append-only and ordered oldest first.

---

## KAD-0001 — Use `civ-engine` as the authoritative simulation core
Date: 2026-04-10
Status: Active

The game uses `civ-engine` for deterministic world state, component/query systems,
fixed-step ticking, visibility, and render projection. Gameplay rules live behind
this boundary. This is also how the project validates that `civ-engine` can
support an AoE2-style RTS.

Consequences:
- No gameplay state lives in Phaser scenes.
- New engine gaps must be documented in `docs/engine-feedback/current.md` rather than
  worked around inside `civ-engine` itself.

---

## KAD-0002 — Phaser is view and input only
Date: 2026-04-10
Status: Superseded by KAD-0022

Phaser renders projected render frames and dispatches user input as commands.
It holds no authoritative gameplay state. Render-only concerns like unit
interpolation and camera control are allowed on the scene side.

Consequences:
- Any new gameplay behavior must land in the simulation bridge or `civ-engine`.
- Browser tests assert against a scene-exposed render state seam, not internal
  sim state.

---

## KAD-0003 — Single source of truth for content is `design/stats/*.csv`
Date: 2026-04-10
Status: Active

Unit stats, technologies, civilizations, and similar content are defined in
structured CSVs under `design/stats/`. A prebuild step normalizes them into
`generated/content/content.json`, which the simulation loads. Prose specs do not
duplicate CSV-owned numeric data.

Consequences:
- Balance or roster changes are data edits, not code edits.
- `generated/content/content.json` is not committed.

---

## KAD-0004 — Scope is single-player vs AI standard Random Map
Date: 2026-04-10
Status: Active

The product scope is one human player versus AI opponents on the standard Random
Map mode. Multiplayer, campaign story mode, and non-standard game modes are out
of scope.

Consequences:
- No networking code, lobby flows, or replay systems.
- Simulation does not need lockstep or peer-to-peer guarantees.

---

## KAD-0005 — AI-decision systems push intentions; handler does authoritative re-check (no per-tick reserved-resource gating)
Date: 2026-05-01
Status: Active

aiSystem (and other AI-decision systems registered for the `update` phase) does
not mutate `playerResources` / `productionQueues` / construction state directly.
It pushes intention records to `state.pendingCommands`; the dispatcher submits
each via `world.submitWithResult` between ticks; the matching handler runs at
the start of the next tick's `processCommands`. Per DESIGN v17 §6.4 B1/B2, the
validator is best-effort (sees pre-spend stockpile and approves up to the cap)
and the handler does the authoritative spend with silent-no-op fallback when
state has shifted. Same-tick over-acceptance (multiple pushes that collectively
exceed budget) is intentional — the handler picks the affordable subset.

The Phase 1C iteration that tried per-tick reserved-resource gating (a local
copy of the stockpile decremented after each push) was abandoned because it
fought against B1/B2: blocking pushes ahead-of-time meant a barracks-rush AI
never trained militia (the villager push depleted the reserve copy before the
militia gate ran). The structural fix is to push greedily based on the raw
stockpile, gate only against duplicate intentions still in `pendingCommands`
(via `pendingTrainsByBuilding` / `pendingResearchKeys` / `pendingBuildsByOwner`
lookups), and order pushes so that priority items go FIRST and the FIFO-ordered
handler resolves contention naturally.

Consequences:
- aiSystem reads `state.pendingCommands` to fold in-flight intentions into its
  gates so it doesn't re-push every decision tick.
- `pickUnitMix` runs BEFORE villager training in aiSystem so military pushes
  precede villager pushes when the AI is barracks-rushing.
- The `dispatcher.drainPendingCommands` contract is mutate-in-place (push +
  `length = 0`); reassigning the queue array would break aiSystem's reference.
- The bridge drains this queue immediately before the next `world.step()`, not
  immediately after the decision tick, so `saveGame()` can persist queued
  intentions taken in the one-tick command-boundary window.
- A future multi-strategy AI (boom vs rush) would condition the push order on
  plan kind, but the single-strategy AI today gets hardcoded military-first
  ordering.

## KAD-0006 — Tier-1 bridge state migrates to `world.state.aoe2.*` via per-slot codecs + accessor cache + tick-end flush

Date: 2026-05-01 (Phase 2A → 2E shipped during v0.1.6 commandify rewrite).

Context: pre-Phase 2 the bridge held 35+ entity-keyed Maps + side caches in a TypeScript-only `BridgeState` struct that lived outside `world.state`. `world.serialize()` snapshots therefore did not include them; the recorder used a hand-rolled `SaveBlob` to capture them separately. This blocked counterfactual replay (Spec 5) and the v0.1.6 replay scrubber, both of which reconstruct a world from `world.serialize()` + the recorded command stream.

Decision: every Tier-1 slot (per-tick mutated entity-keyed Maps) gets a `SlotCodec<TNative, TJson>` pair (`bridgeStateSerialize.ts`). Mutating code goes through `BridgeStateAccessor.mutate(codec, ...)` (cache + dirty-tracking) instead of touching the raw Map. `bridgeSnapshotSystem` runs at output phase and calls `accessor.flush()` to materialize cached Maps back to `world.state` via the codec's serialize half. `tier3SyncSystem` does the same for the three Tier-3 slots (`aoe2.visibility`, `aoe2.matchState`, `aoe2.bridgeMeta`). Save-time `flushBridgeStateToWorld` (saveGame's flushBeforeSerialize) calls both flushes synchronously so `world.serialize()` is the source of truth for the SaveBlob.

`VisibilityCell` wraps `VisibilityMap` with a dirty flag so `tier3SyncSystem` skips the visibility re-publish when no source moved. `syncVisibilitySources` (Phase 2E) maintains a `(playerId, x, y, radius)` fingerprint cache and only marks the cell dirty when an actual change happens. Owner-flip branch (`prev.playerId !== source.playerId`) calls `visibility.removeSource(prev.playerId, id)` before re-inserting under the new owner, plugging a latent leak around monk conversion + sheep-claim transfer.

Consequences:
- All readers go through the accessor: `accessor.get(codec)` lazily deserializes from `world.state` on first read, caches as native, returns the same instance on subsequent reads. Writers MUST go through `accessor.mutate(codec, ...)` or call `accessor.markDirty(codec)` after a direct cache mutation. Calling `markDirty` without prior `get/mutate` is a fail-fast error in flush() — silent data loss is impossible.
- Save mid-tick is consistent: `flushBeforeSerialize` flushes BOTH Tier-1 (accessor) AND Tier-3 (visibility/matchState) before `world.serialize()`, so `worldSnapshot.state.aoe2.*` reflects current values regardless of when the save was triggered.
- Schema-2 (Phase 2F) drops the redundant top-level SaveBlob fields and reads directly from `worldSnapshot.state.aoe2.*`.
- Per-slot migration is incremental — Phase 2D ships one slot per commit, and `world.state` consumers can co-exist with direct-Map consumers during the transition. The `pruneOrphanEntityKeys` path in `hydrateFromSavedGame` runs both legacy (state.X.delete) and accessor.mutate() pruning for migrated slots.

## KAD-0007 — AI monk task decisions remain in resolution-phase aiSystem mutation, deferred from Phase 1C's intention split

Date: 2026-05-01 (full-review iter-1 R2-D1 / R2-C1 deferral decision).
Status: Superseded in part by KAD-0008.

2026-05-04 update: superseded in part by KAD-0008 and closed by KAD-0009. The AI-side direct mutation described here has been removed, and `monkTasks` now uses the accessor-backed `world.state.aoe2.monkTasks` slot while command handlers and deterministic monk behavior remain the mutation sites.

Context: Phase 1C's DESIGN v17 §6.5 specifies that AI-decision systems push intentions to `pendingCommands` and the resolution-half handler applies them at the next tick. PLAN v4 §1C step 1B specifies splitting `monkBehaviorSystem` into `monkBehaviorDecisionSystem` (decision; pushes intentions) and `monkBehaviorResolutionSystem` (deterministic; mutation).

At the time of the 2026-05-01 decision, `aiSystem.execute → assignAiMonkTasks → setMonkTask` mutated `state.monkTasks` directly during the `update` phase. The split was deferred during Phase 1C because monk task selection involves per-monk cost-benefit reasoning (heal target priority, relic pickup vs deposit, conversion target valuation) that did not obviously map to the 15 already-designed commands.

At that time, the deviation was safe because `monkTasks` was not yet a migrated Tier-1 slot (KAD-0006). The recorder's diff-listener snapshot watched `world.state.aoe2.*`, not the bridge-side `state.monkTasks` Map, so live mutation by aiSystem was invisible to the recording.

Original decision: `monkTasks` was a **Phase 2D blocker** because migrating the slot while `aiSystem` still wrote tasks directly would let mid-tick mutations enter `world.state.aoe2.monkTasks` and conflict with replay re-derivation.

Original consequences, superseded in part by KAD-0008:
- On 2026-05-01, Phase 2D could not migrate `monkTasks` to accessor-based mutation while AI direct assignment remained.
- KAD-0008 later found the existing `monk.contextAtEntity` command is sufficient for AI assignment, so no new four-command monk assignment surface is needed for the AI path.
- KAD-0009 completed the slot migration; `prototypeMonkBehavior` now reads the accessor-backed task map.

## KAD-0008 - AI monk task assignment reuses `monk.contextAtEntity` intentions

Date: 2026-05-04.
Status: Active.

Context: KAD-0007 correctly identified `aiSystem.execute -> assignAiMonkTasks -> setMonkTask` as the remaining AI-side direct write to `state.monkTasks`. Its proposed fix assumed new command types would be needed for heal, convert, pickup, and deposit. The live command surface already has `monk.contextAtEntity`, and its handler delegates to `routeMonkContextAtEntityCommandDirect`, which re-fetches monk and target state and maps the context target to heal, convert, pickup, deposit, or move fallback.

Decision: AI monk task assignment uses the existing `monk.contextAtEntity` command boundary. `monkTaskOps.pushAiMonkTaskIntentions(owner, pushMonkContextAtEntityIntention)` shares the same target-selection priority as the legacy direct helper: carried relic deposit, then visible neutral relic pickup, then wounded friendly military heal. `aiSystem` calls this intention producer instead of `assignAiMonkTasks(owner)`. `wireBridgeOps` appends the pending command to `state.pendingCommands` with `expectedOwner` and `intendedTaskKind`; `dispatcher.drainPendingCommands` submits it before the next tick; the handler applies the task at the next `processCommands` phase only if the owner and intended task still match.

Consequences:
- No new four-command monk assignment surface is needed for the AI path.
- Human and AI monk context routing now share the same handler revalidation and `routeMonkContextAtEntityCommandDirect` behavior.
- AI-only owner/task guards prevent a stale queued assignment from becoming a different action after target or monk ownership changes.
- `SaveBlob.sideMaps.pendingCommands` persists bridge-owned AI intentions until they are drained into the engine command queue immediately before the next tick.
- AI monk task effects are intentionally delayed by one tick. `tests/simulation/aiPlayerMonksAndWonder.test.ts` covers this with the `ai-monk-relic-fixture`: the first decision step queues the pickup while the relic remains on the map, and the next step processes the command and carries the relic.
- The AI-side blocker for `monkTasks` migration is cleared. KAD-0009 completed the raw Map replacement with an accessor-backed codec while preserving command handlers and deterministic monk behavior as the mutation sites.

## KAD-0009 - Monk task state is accessor-backed

Date: 2026-05-04.
Status: Active.

Context: after KAD-0008, AI monk assignment no longer wrote `state.monkTasks` from `aiSystem`; it queued `monk.contextAtEntity` intentions and let the handler apply the task on the next tick. That removed the replay conflict that blocked migrating the task map itself.

Decision: `monkTasks` is a Tier-1 accessor-backed slot stored at `world.state.aoe2.monkTasks` via `monkTasksCodec`. `BridgeState` no longer owns a raw task Map. `monkTaskOps.setMonkTask/clearMonkTask`, `prototypeMonkBehavior`, entity destruction, unit move cleanup, save/load hydration, and selection/activity projection all read or mutate the accessor-backed Map. Schema-1 `SaveBlob.sideMaps.monkTasks` remains as a compatibility projection until Phase 2F removes redundant side-map fields.

Consequences:
- Active Monk tasks are visible to `world.serialize()` snapshots after the output flush.
- Phase 2D no longer has a `monkTasks` exception; KAD-0010 later closed the final `unitCommands` exception.
- Command handlers and deterministic Monk behavior remain the only task mutation sites; AI decision systems continue to queue intentions.
- KAD-0010 later migrated `unitCommands`, closing the final Tier-1 bridge-owned slot before Phase 2F.

## KAD-0010 - Unit command state is accessor-backed

Date: 2026-05-04.
Status: Active.

Context: after KAD-0009, `unitCommands` was the final bridge-owned Tier-1 codec. It was still stored in `BridgeState.unitCommands`, so active move/build/attack orders were absent from `world.serialize()` snapshots even though `unitCommandsCodec` was already registered in `TIER_1_CODECS`. That left Phase 2F unable to treat `worldSnapshot.state.aoe2.*` as the save source of truth.

Decision: `unitCommands` is a Tier-1 accessor-backed slot stored at `world.state.aoe2.unitCommands` via `unitCommandsCodec`. `setUnitCommand` and `clearUnitCommand` are the command mutation boundary and preserve the existing `movePathCache` invalidation. Systems and projections read the command map through `accessor.get(unitCommandsCodec)` at execution/read time, so accessor resets after load cannot leave stale captured map references. Schema-1 `SaveBlob.sideMaps.unitCommands` remains a compatibility projection until Phase 2F removes duplicate side-map fields.

Consequences:
- Active unit commands are visible to `world.serialize()` snapshots after the output flush.
- Schema-1 `sideMaps.unitCommands` is authoritative over stale `worldSnapshot.state.aoe2.unitCommands` during load.
- `BridgeState` no longer owns any Tier-1 codec slot; it is limited to runtime caches, derived maps, and the pending bridge-intention queue.
- Phase 2F can begin converting the save format to schema-2 without a remaining Tier-1 bridge-owned exception.

## KAD-0011 - Schema-2 saves use world snapshots as the source of truth

Date: 2026-05-05.
Status: Active.

Context: Phase 2D moved every Tier-1 bridge-state codec into `world.state.aoe2.*`, while Phase 2B/2C/2E made `aoe2.visibility` and `aoe2.matchState` available in snapshots. Schema-1 saves still duplicated those values through top-level `visibility`, `matchState`, and `sideMaps`, which kept save/load coupled to a parallel bridge projection even though `world.serialize()` had become complete.

Decision: current saves are schema 2 and contain only `seed` plus `worldSnapshot`. `saveGameOps` flushes the accessor, Tier-3 state, and the save-critical AI pending-command queue before serialization; bootstrap and the output tail also write a cloned `aoe2.pendingCommands` snapshot so recorder-visible `world.serialize()` snapshots do not miss just-loaded legacy queues or retain stale drained commands. Schema-2 load reads visibility, match state, and pending commands from `worldSnapshot.state.aoe2.*`; schema-1 load remains supported and treats legacy `sideMaps` as authoritative over stale duplicate world-state slots.

Consequences:
- New save JSON no longer emits top-level `sideMaps`, `visibility`, or `matchState`.
- Existing schema-1 user saves continue to load through `hydrateFromSavedGame`.
- `pendingCommands` is not a Tier-1 codec, but it is persisted through `aoe2.pendingCommands` so a save or recorder snapshot between AI decision and dispatcher drain does not drop queued intentions.
- `SaveBlob` is now a discriminated union (`SaveBlobV1 | SaveBlobV2`), and callers that inspect legacy fields must narrow to schema 1 first.

## KAD-0012 - Replay worlds reuse bridge wiring with replay-safe AI bookkeeping

Date: 2026-05-05.
Status: Active.

Context: Phase 3A needs `SessionReplayer.openAt` to reconstruct aoe2 worlds from `world.serialize()` snapshots plus recorded command payloads. DESIGN v17 expected all AI-decision systems to be no-op stubs in replay, but the implementation check found `prototypeAi` still mutates replay-visible state that is not command payload: `aiStates.lastDecisionTick`, attack-group bookkeeping, and villager desired-resource rebalance. Review also found that `aoe2.pendingCommands` is serialized boundary state: if `openAt(t)` lands immediately after an AI-decision tick, the live snapshot contains intentions that will be submitted at tick `t`, while the recorded command payloads at `t` are not replayed until advancing to `t + 1`.

Decision: replay worlds are built through the same bridge wiring as live schema-2 load, but `registerAllSystems` accepts a replay mode. Deterministic systems remain real. `prototypeAi` and `prototypeAutoAggression` are registered in replay with real intention emitters into the replay world's bridge-owned `pendingCommands` queue, so replay-visible AI bookkeeping and pending-command boundary state reproduce without submitting those intentions. A replay-only `aoe2ReplayPendingCommandDrain` runs before `prototypeAi` during replay steps to clear hydrated or prior-step pending entries; `SessionReplayer.openAt` recorded command payloads remain the only source of command execution. `createReplayWorldOnly(snapshot)` wraps the snapshot as a schema-2 load and stores replay context in a WeakMap keyed by world for later replay-controller bridge construction.

Consequences:
- `SessionReplayer.openAt(endTick)` can replay from the initial snapshot only and reach structural equality with a live run that includes human and AI commands.
- `SessionReplayer.openAt(t)` can also land on an AI pending-command boundary and reconstruct the serialized `aoe2.pendingCommands` queue for that target tick.
- Replay does not double-submit AI `unit.move`, `unit.attack`, queue, research, construction, or monk-context intentions because replay-generated pending entries are never dispatched.
- Schema-2 hydration pruning only marks slots dirty when it actually removes stale entity references; replay construction no longer materializes absent empty Tier-1 state keys.
- The remaining architectural debt is that `prototypeAi` is not yet a pure command-emitting decision system. A future cleanup can commandify or isolate AI bookkeeping, then simplify replay mode back toward pure stubs.

## KAD-0013 - ReplayController owns replay-time advancement

Date: 2026-05-05.
Status: Active.

Context: Phase 3A made `SessionReplayer.openAt(tick)` capable of reconstructing aoe2 worlds, but the app still needed a bridge-level owner for replay mode. Phaser's `GameScene.update` calls `bridge.step(delta)` every frame, while replay playback must advance by recorded command ticks, not by normal live-frame accumulation. Drag scrubbing also cannot call `openAt` on every pointer move because worst-case replay-from-snapshot cost is proportional to snapshot interval.

Decision: replay mode is owned by `src/game/replay/ReplayController.ts`. `enterReplay(bundle)` captures the current live pause state and current live bridge through host-owned state, builds the replay world through `SessionReplayer.fromBundle(... createReplayWorldOnly ...)`, wraps it with `makeReplayBridge(world)`, then pauses the live bridge immediately before replacing the mutable bridge cell; if replacement fails, the captured pause state is restored. `exitReplay()` restores the captured live pause state rather than always resuming play. `makeReplayBridge(world)` exposes the same read/selection surface as `SimulationBridge`, but its scene-frame `step()` only flushes view changes and never advances the world. `ReplayController.play()` is the only replay-time advancer: each scheduled frame submits recorded commands for the current tick, checks `hasCommandHandler` like `SessionReplayer.openAt`, calls `world.step()`, resets the replay accessor cache, and emits the new tick. Coalesced scrub calls update the displayed tick without rebuilding until `commitPendingScrub()` or a non-coalesced scrub commits; failed replacements roll back to the last committed replay state.

Consequences:
- Live simulation time is paused and preserved while the user inspects replay state, and a live session that was already manually paused stays paused after replay exit.
- Replay rendering can reuse the existing Phaser/HUD bridge surface without letting the scene loop accidentally advance replay worlds.
- Playback has O(1)-per-tick progression after entry/scrub instead of repeatedly rebuilding from `openAt(currentTick + 1)`.
- Drag scrubbing can feel instantaneous in Phase 3C because pointer-move events can coalesce into a single final `openAt` commit.
- `ReplayController` is now the boundary Phase 3C/3D UI code should target rather than calling `SessionReplayer` or replay bridge helpers directly.

## KAD-0014 - Replay timeline UI targets the controller boundary

Date: 2026-05-05.
Status: Active.

Context: Phase 3C needed a visible scrubber without letting DOM controls, HUD code, or Phaser reach into `SessionReplayer` internals. The panel also had to coexist with the existing game canvas and bottom HUD, and the app's save-load path can replace the live bridge while replay mode is active.

Decision: `TimelinePanel` is an aoe2-side DOM component mounted by `createApp` into the HUD root. It reads only `ReplayController` state (`mode`, `bundle`, `bundleMetadata`, `currentTick`, `isPlaying`) and calls controller actions (`scrubTo`, `commitPendingScrub`, `play`, `pause`, `stepForward`, `stepBackward`, `jumpToMarker`, `exitReplay`). Marker pins come from `bundle.markers`; hotspot pins come from `bundleHotspots(bundle, { includeMarkers: false })` so marker pins and derived hotspot pins remain visually distinct. `ReplayHotkeys` binds Space, ArrowLeft/ArrowRight, Home/End, Escape, and Alt+T only while replay mode is active, letting the shared `HotkeyRegistry` call `preventDefault()` for actual replay shortcuts without swallowing those keys in live mode. `createApp` calls `exitReplayBeforeLiveBridgeReplacement(replayController)` before save-load replaces the host bridge, so replay exit cannot later restore a stale pre-load bridge.

Consequences:
- Phase 3C UI code does not call `SessionReplayer` or replay-world helpers directly; the controller remains the single replay-mode state boundary.
- Drag scrubs can update the visible tick optimistically through coalesced `scrubTo(..., { coalesce: true })` calls and commit once on `change`/`pointerup`.
- The fixed timeline panel reserves bottom viewport space through CSS while visible, keeping the playfield and bottom HUD from overlapping the panel across desktop and mobile viewports.
- Replay hotkeys do not claim browser defaults in live mode, but they do prevent default page scroll/button activation when they are active replay controls.
- No-command-payload bundles keep forward/play/end controls and unreachable pins inert at the UI layer, matching `ReplayController`'s intentional refusal to advance such bundles beyond the initial tick.

## KAD-0015 - Playtest runner uses bridge.step() rather than runAgentPlaytest

aoe2's AI is registered as an ECS system inside `world.step()` that pushes intentions to a bridge-owned `pendingCommands` queue drained between ticks via `dispatcher.drainPendingCommands(world, queue)`. `runAgentPlaytest`'s `decide(ctx)` callback contract assumes the agent RETURNS commands; it does not drain a side queue. Wrapping the existing AI as an `AgentDriver` would require either a major refactor (extract planner from bridge) or a brittle bridge-internals leak.

The bridge-driven recording loop in `src/game/playtest/runPlaytest.ts` reuses the existing `drainPendingCommands` flow unchanged: it constructs a normal `SimulationBridge` via `createSimulationBridge`, attaches its own `SessionRecorder` directly to `bridge.world`, and calls `bridge.step(100)` each tick. The recorder hooks the same diff/execution/failure listeners as live mode.

Consequences:

- The playtest runner is a third runtime mode alongside live (RecordingService) and replay (ReplayController) — distinct from both at the recording-attachment layer.
- Single-AI vs passive-human is the smoke baseline because aiSystem hard-codes `humanPlayerId` as the enemy target; true AI-vs-AI requires an opponent-selection refactor that's filed as a Phase-6 follow-up of the playtest-loop thread.
- The probe order inside the loop (`error → engineHalt → stopWhen → maxTicks`) reflects the bridge's `tickHaltGuard` swallowing system throws into `haltState.halted` without rethrowing; the runner polls `bridge.getHudState().engineHalted` each tick to surface those.


## KAD-0016 - Civ-engine visual playtest contracts are adapter vocabulary

Date: 2026-07-06.
Status: Active.

Context: civ-engine v1.3.0 exports a zero-dependency visual-playtest vocabulary (`VisualPlaytestObservation`, controls/state channels, prompt building, finding-to-marker helpers, and loop contracts). aoe2 already has a richer custom LLM playtest stack: provider wiring, screenshots, cost tracking, strategy/tactical prompt split, command-tool schemas, dispatch feedback, and post-hoc conformance findings.

Decision: aoe2 adopts the shared engine vocabulary through `src/game/playtest/visualPlaytestAdapter.ts`, not by replacing the existing runner. Tactical prompts prepend `buildVisualPlaytestPrompt` output built from player-surface screenshot metadata, visible-text summary, and command-tool controls, then keep the existing detailed JSON snapshot and tool schemas as the source of command truth. Conformance finding markers keep the existing aoe2 `author:'agent'`, `category:'ai'`, deterministic id, severity mapping, text, and anchor tick while embedding the engine `visualPlaytestFindingToMarker` payload under `data.visualPlaytest`.

Consequences:
- Engine/aoe2 tooling can recognize a shared `data.visualPlaytest.schemaVersion/type/finding` payload without changing the replay marker UI.
- The LLM still uses aoe2 command tools and dispatch feedback; no hidden `runVisualPlaytestLoop` command path competes with `llmRunner`.
- Prompt additions stay concise and player-surface scoped, so they boost visual context without replacing the full state JSON that prevents fabricated entity ids.
- Future engine visual-playtest helpers can be absorbed in one adapter module instead of spreading contract glue across prompt and marker code.

## KAD-0017 - Recursive self-improvement is a ledger over saved artifacts

Date: 2026-07-08.
Status: Active.

Context: aoe2 already has separate loop pieces: LLM playtest capture, post-hoc findings, shared engine improvement marker payloads, replay inspection, and auto-fix gates. Replacing the runner would duplicate provider, browser, command-dispatch, recorder, and gate behavior. The missing boundary was an auditable artifact that proves a recorded run was inspected, verified, classified, and compared against a rerun.

Decision: `src/game/playtest/selfImprovementLoop.ts` is a pure ledger contract over saved artifacts. It reads run objects, recovers `civ-engine` `ImprovementFinding` payloads from markers or legacy envelope findings, consumes deterministic oracle findings supplied by `oracleImprovementFindings.ts`, computes conformance metrics, classifies `nextAction` into proposal/fix/observe/none routing, preserves disposition, and compares baseline/current metrics with `compareMetricsResults`. `selfImprovementFindingComparison.ts` compares baseline/current finding identities and records resolved, persisted, and introduced findings so reruns can prove what happened to specific loop work; generic findings use ids, while deterministic oracle findings use oracle/tick/message evidence because their generated ids include an order-dependent suffix. `scripts/playtest-self-improve.mjs` is only filesystem and replay glue: it loads `<prefix>.json`, `<prefix>.envelope.json`, and optional `<prefix>.llm-trace.jsonl`, repairs historical `metadata.endTick` values in memory, optionally runs the deterministic oracle suite via `--oracles`, runs `SessionReplayer.selfCheck` through `createReplayWorldOnly`, and writes JSON/Markdown ledgers under ignored output paths. `src/game/playtest/fixProposalInput.ts` is the proposal-intake adapter: it selects classified fix findings from the ledger and converts their shared `ImprovementFinding` payloads into the existing fix-prompt violation shape so `scripts/propose-fix.mjs --ledger` can route proposals without reparsing legacy reports.

Consequences:
- Existing runner/finding/replay/auto-fix systems stay authoritative; the ledger composes them instead of introducing a competing harness.
- Replay self-check failures and partial/no-op self-checks are written as first-class evidence rather than hidden, so old or incomplete bundles can still teach the loop while blocking overclaiming.
- Proposal-only findings remain candidates until a later patch plus rerun proves closure; the ledger does not mark unreviewed conformance findings as fixed.
- The before/after comparison contract is shared with `civ-engine`, reducing aoe2-specific delta vocabulary as the loop matures.
- `scripts/run-oracles.mjs` remains the legacy gate/report path for CI-style pass/fail reporting; recursive-loop evidence should use `playtest:self-improve --oracles` so oracle violations are preserved as shared improvement findings.
- `scripts/propose-fix.mjs` keeps legacy `REPORT.md` parsing as compatibility fallback, but recursive-loop proposal work should pass `--ledger <ledger.json>` so target selection uses the classified shared finding contract.
- Unit death feedback (v0.1.129) uses an explicit, transient DEATH FEED (`ProjectedFrameView.recentUnitDeaths`, recorded at the `destroyUnitEntity` chokepoint) rather than inferring deaths from present→absent diffing of the render projection. Rationale: a unit leaving the projection is ambiguous — death, fog exit, and garrisoning all remove it — so diffing would fire the death cue on non-deaths and miss fogged deaths. The feed is gated on AT-DEATH visibility, not current visibility: each record carries the set of players who could see the cell when the unit died (captured before destruction + the tick's vision recompute), and a viewer sees a death only if it is in that set. This is fog-correct in both directions — a kill in your fog never leaks when you later uncover the cell, and your own lone unit's death still shows even though losing its vision re-fogs the cell the same tick (an adversarial review caught the current-visibility version both leaking off-screen kills AND dropping own lone-unit deaths). The feed is render-only: never persisted (no codec) and absent from every deterministic hash, so save/load and replay determinism are untouched (a load drops in-flight animations; a replay re-emits deaths because `destroyUnitEntity` re-runs).

## KAD-0018 - The first voxel renderer is an opt-in composed view

Date: 2026-07-12.
Status: Superseded by KAD-0022.

Context: AoE2 needs a real 3-D voxel presentation, but `GameScene` and Phaser still own proven camera, pointer, selection, placement, fog, health, feedback, minimap, replay, and browser-test behavior. City and Townscaper also need the shared graphics code, so moving AoE semantics into a new renderer would create the wrong reusable boundary. A one-shot Phaser removal would combine renderer migration, interaction migration, and art migration into one untestable change.

Decision: keep Phaser as the safe default. `?renderer=voxel` creates a Three world canvas beneath a transparent Phaser Canvas overlay. The AoE-owned `src/rendering/voxel/` adapter translates projected views into the sibling package's independent `VoxelChunkV1`, `GeometryResourceV1`, and `InstanceBatchV1` lanes. The shared source revision is pinned in `.github/voxel-commit`; AoE and the package use exactly Three `0.185.1` plus `@types/three` `0.185.0`, and Vite deduplicates the runtime. The composed slice deliberately flattens elevation until overlay and hit geometry become elevation-aware. Renderer acknowledgements and cache versions include world, epoch, and revision identity; bridge/replay replacement starts a fresh epoch. Capture explicitly reads the Three canvas and then composites the Phaser overlay without enabling `preserveDrawingBuffer` globally.

Consequences:
- The simulation, save schema, commands, replays, and AoE visual-role policy remain authoritative and unchanged.
- The voxel path is playable and independently testable, but it cannot become the default while raised-geometry picking, elevation-aware overlays, complete voxel interaction/fog coverage, and hidden legacy draw work remain open.
- City can adopt rigid batches and Townscaper can adopt consumer-authored geometry without importing AoE types or being forced through cube terrain.
- CI must fetch and build the exact pinned voxel revision before installing AoE2's local `file:` dependency.
- Phaser remains an intentional compatibility host during migration rather than a second source of world state.

## KAD-0019 - Voxel art recipes stay AoE-owned; only daylight is shared

Date: 2026-07-12.
Status: Active for art ownership; the animation-future clause is superseded by KAD-0020/KAD-0025 and the Phaser-parity clause is superseded by KAD-0022.

Context: the first voxel slice proved the renderer boundary but its two-box unit, building, and resource fallbacks were not a usable Age-of-Empires-style art direction. City and Townscaper also need better lighting, but they do not share AoE building roles, unit equipment, faction accents, terrain clutter, or fog-memory presentation. Moving those details into `voxel` would make a nominally reusable package depend on one game's vocabulary.

Decision: keep every procedural facade and silhouette recipe under `src/rendering/voxel/`, split by building, unit, resource, terrain, recipe-helper, and material-resource responsibilities. Both AoE presenters share the pure exhaustive `unitRole` mapping, but no AoE role enters shared package declarations. A centred group-less cube geometry feeds separate static and animated matte/metal lanes plus contact-shadow and memory lanes, so detailed parts remain six bounded batches rather than scene objects; separating lanes prevents static scenery from inheriting the engine's smaller active-batch ceiling. The reusable package exposes only a validated hemisphere-plus-directional daylight rig whose target follows the current view centre; AoE supplies its own warm colors and antialias context flag.

Consequences:
- Faction color is an AoE recipe input used on accents, while neutral stone, plaster, timber, cloth, foliage, skin, and metal remain AoE palette decisions.
- Recipe outputs are deterministic rigid transforms with canonical keys and no wall-clock or random input; animation meaning still requires an explicit future projected contract.
- Contact shadows are bounded translucent instance geometry, not a claim of shadow-map support. True shadows remain gated on renderer budgets, caster/receiver policy, context restoration, metrics, and teardown.
- Terrain props remain visually sparse and physically flat, so Phaser overlay/input parity is unchanged.
- City and Townscaper may reuse the daylight option and instance/geometry lanes without inheriting AoE art or role classifications.

## KAD-0020 - Unit animation semantics stay AoE-owned

Date: 2026-07-12.
Status: Active for AoE ownership and workload bounds; the ambient-pause and attack-deferral clauses are superseded by KAD-0025.

Context: detailed procedural voxel units need continuous motion, but idle, locomotion, part names, unit roles, attacks, gathering, and reload timing are game vocabulary. City and Townscaper may need unrelated rigid motion, while general skeletal clips would introduce a much larger asset and lifecycle contract.

Decision: the sibling renderer owns only an optional bounded harmonic transform lane sampled from injected frame time. AoE owns `aoeVoxelUnitAnimation.ts`, stable `id:generation` phase selection, movement-history classification, named-part profiles, memory/static policy, and every amplitude/period relationship. Bridge replacement clears movement history; a new entity generation begins idle. The engine caps active and per-batch workloads, preserves full snapshot uploads, coalesces partial updates, and computes conservative affine-safe motion bounds.

Consequences:
- Ambient idle/secondary motion can continue while the simulation is paused and no new snapshot is accepted; distance-driven locomotion is superseded by KAD-0021 and freezes with the displayed root. Neither path has save, replay, command, collision, fog, health, or selection authority.
- Contact shadows, fog-memory ghosts, terrain, buildings, and resources remain static in this slice.
- AoE does not leak role or clip enums into `voxel`; City can use the lane for pedestrians or props, and Townscaper for wildlife or ornaments, with their own adapters.
- Event-synchronized attacks/gathering, projectiles, root motion, clip blending, skeletal assets, and animation textures remain later measured contracts.

## KAD-0021 - Speed-matched gait uses displayed simulation time and AoE base poses

Date: 2026-07-12.
Status: Active for locomotion sampling; the independent-ambient-clock, fresh-playback-first-tick, and attack-deferral clauses are superseded by KAD-0025.

Context: the first rigid-animation slice classified movement from snapshot-to-snapshot position changes and played a fixed clock-driven walk profile. That made cadence independent of displayed speed and let feet keep cycling after the root stopped. A first distance sampler fixed cadence but used Phaser wall time; adversarial review proved a pause gap then produced different resume speed depending on whether selection forced snapshots. Path corners also changed the travel vector instantly while flexion remained on a fixed local axis, producing sideways limb bend and visible turn pops.

Decision: `sceneRenderer` supplies `(tick + interpolationAlpha) * 1000 / TPS` as the gait sample clock. It freezes under manual/replay pause and rewinds on replay discontinuity, while the independent renderer frame clock still drives ambient harmonics. Replay pause preserves the current accumulator and interpolation alpha, then consumes zero elapsed time on the first resumed frame; fresh playback retains its established immediate first tick. `aoeVoxelUnitAnimation.ts` advances a wrapped role-stride phase only by displayed root distance, derives speed from simulation-display time for a bounded start/stop weight, eases heading across moving corners, and bakes foot/limb/wheel pose into ordinary matrices. Direction-aligned pitch rotates around the horizontal axis perpendicular to travel; feet and horse legs receive exact transformed-corner ground clearance. History is bounded to current live `id:generation` identities and resets on disappearance, memory projection, generation/bridge replacement, or clock rewind. Static and animated surface lanes are split, whole identities beyond the engine's active-animation budget degrade deterministically to static ambient poses, and unsupported animated shadow/memory parts degrade visibly to their static lanes.

Consequences:
- Cadence follows the path the player actually sees, including existing root interpolation, without changing simulation position, pathfinding, collision, commands, saves, replays, hit geometry, or the shared snapshot schema.
- Paused selection redraws cannot decay or refresh locomotion history differently from an unselected world; gait phase, speed weight, and heading freeze until simulation-display time advances.
- X, Z, diagonal, corner, and reversal travel share one movement plane instead of translating in one direction while flexing in another.
- The engine remains history-free. City vehicles and Townscaper routes retain consumer-specific clocks and continuity rules; only a second proven neutral contract could justify extraction.
- General skeletal clips, event-synchronized attacks/gathering, projectiles, root motion, and imported character animation remain deferred.

## KAD-0022 - Voxel is AoE2's sole world renderer

Date: 2026-07-13.
Status: Active; supersedes KAD-0002 and KAD-0018.

Context: the composed proof established that the sibling `voxel` package can
present AoE's projected world, but retaining the old renderer kept two graphics
authorities, duplicate painter work, two canvases, misleading diagnostics, and a
1.48 MB Phaser production chunk. User direction made voxel graphics the only
AoE2 graphics path going forward. City and Townscaper still require the shared
engine boundary to remain game-neutral.

Decision: delete the Phaser runtime, dependency, scene tree, painters, renderer
selector, fallback, and composite capture. `AoeVoxelGameView` is the sole browser
world host and owns one interactive canvas, the injected animation-frame loop,
bridge replacement, resize/fullscreen lifecycle, and composition of pure camera,
pointer, selection, and presentation controllers. AoE emits fog shading,
selection, placement, health, hit, and death feedback as terrain or rigid-instance
snapshot data. The DOM HUD, minimap, dialogs, and replay timeline remain UI, not
a second world renderer. Voxel initialization failure is terminal and visible.

Consequences:
- Simulation state, commands, save/load, replay, visibility, selection priority,
  hit policy, art recipes, and animation meaning remain AoE-owned.
- The sibling package retains only bounded game-neutral chunk, geometry,
  instance, frame, capture, metrics, context, and disposal contracts reusable by
  City and Townscaper.
- Renderer query strings no longer choose behavior. The production build must
  contain no Phaser dependency or chunk, and browser architecture tests enforce
  one world canvas.
- Terrain remains elevation-zero. Raised and moving entity interaction uses an
  AoE-owned, data-only silhouette proxy generated from the same presented
  rigid-part recipes. Prepared hits are promoted only when epoch/revision match
  the canvas; context loss and stale presentation fence interaction. Repeated
  exact clicks reorder only distinct groups in the current hit set, never cached
  vanished targets. Raised terrain and a reusable presented-state ray query
  remain deferred. No hidden 2-D path masks that limitation.
- The old white behind-building x-ray and animated selection/death painter cues
  are not compatibility exceptions. Reintroducing them requires voxel snapshot
  or depth-aware Three treatments with their own visible-output evidence.
- New world visuals must enter through voxel snapshot data or recipes. New input
  behavior belongs in renderer-neutral controllers, not a replacement scene
  framework.

## KAD-0023 - Exact-tick display interpolation and lightweight live metrics

Date: 2026-07-13.
Status: Active.

Context: retaining the prior browser-rendered frame was not enough to interpolate
correctly when one browser callback advanced multiple fixed simulation ticks.
Moving fine-grid resources could still jump between samples, and the full actor
rig did not consistently face its smoothed travel direction. Profiling also
showed the routine render/HUD metrics capture serializing and structured-cloning
the complete ECS world every tick even when debug UI was closed, consuming most
of the simulation-frame budget.

Decision: `RenderStore` captures exact unit and moving-resource positions before
each forward tick and publishes them beside the current projection. Presentation
uses that history only for `previous.tick === current.tick - 1`; same-tick writes
cannot replace it, while rewinds, gaps, bridge epochs, and entity generations
fail closed. AoE rotates the complete procedural actor through the shortest yaw
arc toward its eased travel direction using role-specific authored forward axes.
The live/replay render path uses a narrow metrics capture (alive count plus
existing world metrics). AoE's explicit `getDebugSnapshot()` remains an
on-demand game diagnostic; full `WorldDebugger.capture()` serialization is no
longer constructed by the bridge or routine render path.

Consequences:
- Simulation positions, pathfinding, collision, commands, saves, and replay state
  remain unchanged; all smoothing state is disposable presentation data.
- Units, moving wildlife, hit proxies, contact shadows, body facing, and gait read
  one coherent presented transform. Teleports and discontinuities never invent a
  path between unrelated states.
- Rich world serialization is not permitted in an always-on render or HUD hot
  path. New diagnostics must prove their cost or remain on demand.
- The shared `voxel` package receives no AoE motion schema. City and Townscaper
  keep their own identity, route, and animation semantics.

## KAD-0024 - Publish fine transforms and bound visible replay catch-up

Date: 2026-07-13.
Status: Active.

Context: exact adjacent-tick interpolation still received stale endpoints because commanded and autonomous movers changed retrieved `unitTransform` objects in place. Civ-engine dirties components only through its mutation API, so render projection held until another dirty component forced a refresh. Commanded movement also aimed at an identity-derived fallback slot and snapped to the occupancy grid's allocated slot only after arrival. Occupancy itself is runtime state: rebuilding it in entity-id order after save/load could assign a different destination than the saved moving root was approaching, or promote an explicitly overflowed low-id unit ahead of a saved slot holder. Separately, replay consumed an entire animation-frame timestamp gap and could finish many seconds of simulation in one visible callback after browser suspension.

Decision: every fine-grid step publishes a replacement `unitTransform` through `World.setComponent`; blocked autonomous moves validate a candidate before publication and may recenter toward the allocated in-cell slot only by one normal fine step before choosing an escape heading. Stationary spawns, commanded targets, and arrival predicates use the current allocated occupancy slot. `UnitTransformComponent` additively persists the assigned numeric offset or an explicit overflow marker. Live-load and replay reconstruction restore numeric assignments first, legacy no-field units second using their serialized fine root as a preference, and exact explicit-overflow claims last without changing `fineX/fineY` or opportunistically allocating a slot. A later same-cell rebind keeps the move command active until the root reaches the new slot at the ordinary step bound. Live and replay frame hosts share `boundedVisibleSimulationDelta`, capped at 250 ms, while explicit replay scrubs and identity/bridge discontinuities continue to snap deliberately.

Consequences:
- RenderAdapter receives every fine endpoint, so the existing adjacent-tick interpolator has continuous authoritative samples instead of reconstructing hidden mutation.
- Arrival converges on the slot the unit keeps, eliminating the final stationary sub-cell teleport without changing coarse pathfinding or crowding authority.
- Fresh cardinal movement cannot spend its first step recentering from an identity fallback, and crowded mid-movement or overflow saves continue identically after live load or replay materialization without a schema bump.
- Replay suspension cannot consume the complete hidden interval in one callback; the cap may intentionally slow catch-up after a long stall rather than display an unbounded fast-forward.
- ECS components used by diffs, rendering, recording, or replay must never rely on in-place mutation as a publication mechanism.

## KAD-0025 - Successful-hit animation is AoE-owned transient projection state

Date: 2026-07-14.
Status: Active; supersedes the ambient-pause and attack-deferral clauses of KAD-0020 plus the independent-ambient-clock, fresh-playback-first-tick, and attack-deferral clauses of KAD-0021.

Context: damage resolves instantly inside the simulation and the current command model exposes no earlier wind-up event. Inferring a strike from HP deltas or command state would miss lethal hits, confuse non-unit damage, and fail when a stationary attacker produces no ordinary render diff. Replay scrubs may also start directly from a recorder snapshot rather than replaying the hit-producing tick. The reusable Voxel package deliberately has no AoE combat roles, fog policy, or save/replay authority.

Decision: record one bounded latest successful-hit event per attacker entity reference at the combat-resolution chokepoint. Prove visibility current before each successful impact: synchronize on the first impact each tick and after every intervening player-command LOS mutation, while reusing the same snapshot for an unchanged same-tick burst; source fingerprints may avoid a `VisibilityMap` recomputation. Recursive building destruction compares the actual source fingerprints of the building plus its bounded garrison IDs, while construction invalidates only when completion actually adds a source. Every witness, including the attacker's owner, must see at least one cell of the attacker footprint and at least one cell of the target footprint; when no perspective qualifies, no event or coordinates are recorded, and ownership alone cannot publish a hidden target coordinate from a retained ranged order. Each event stores its observable tick, source/target roots, and captured witnesses; the first actual root change adds a cancellation tick. The event tick maps directly to the authored impact keyframe. If the presented roots coincide, the pose remains valid and uses the prior finite displayed facing or the role's authored forward for a fresh renderer. Movement-facing becomes authoritative immediately at cancellation while strike and ambient-suppression weights smoothstep to zero across that one observable tick. Presented roots plus attack phase, weight, and ambient suppression remain deterministic and continuous across the boundary; fresh disposable gait history may restart and is not a warm/fresh equivalence contract. Connected tools and weapons use shared rigid pivots, while feet, wheels, roots, shadows, and the presented silhouette proxy remain authoritative and planted. Raw projection retains live entities independently of fog; `renderStateOps` applies the final perspective filter and `RenderStore` captures interpolation history through the prior frame's visible cells. When a witnessed attacker becomes hidden from one perspective, the feed persists that player in `suppressedFor` before recorder checkpoint publication; tower targeting retains one immutable pass-start visibility snapshot and refreshes final LOS exactly once after a successful pass containing any kill, and `RenderStore` keeps its local tombstone as defense in depth. New recorder snapshots therefore restore per-perspective suppression plus exact source/target coordinates, attack-channel phase, weight, and cancellation state; historical checkpoints whose feed predates `suppressedFor` cannot reconstruct an earlier hide/reveal. The first replay frame establishes the wall-clock baseline instead of consuming a synthetic tick. A fresh renderer may reinitialize disposable gait history, so full assembled rig matrices are not a replay contract. Ordinary user saves remove the detached checkpoint slot before returning the save blob. `AoeVoxelWorldRenderer` supplies Voxel and AoE hit geometry with one monotonic clock that advances only by positive simulation-display deltas, freezes on pause, and rebases without decrement on replay or bridge replacement.

Consequences:
- Damage, reloads, target reservations, pathing, root motion, selection, and presented hit authority remain unchanged. Several villagers can animate independent same-tick hits on one boar while approaching villagers keep locomotion.
- Fog eligibility is captured independently at every impact and requires at least one visible cell of each actor footprint even for the attacker's owner, so ownership or later vision never leaks an unseen target or hit. Current fog can hide a witnessed cue; new recorder checkpoints persist that per-perspective suppression after re-reveal, while a genuinely newer event tick can display normally.
- Rewinds, bridge epochs, and entity-generation changes reset disposable unit history. Equal displayed simulation time freezes gait, ambient breathing, secondary motion, attack pose, and matching hit geometry; the dependency-facing clock never moves backward.
- The feed is replay-checkpoint evidence, not gameplay or user-save state. Hydration examines only the final 1,024 candidates, validates and canonicalizes fresh in-bounds records, and retains the latest record per attacker. After forced bootstrap publication, checkpoint state is dirtied only on add, change, suppression, or expiry.
- Monks are rejected at semantic validation and by the direct helper, while the execution system clears any hydrated or persisted Monk attack before it can deal damage or emit an attack event.
- Replay construction preserves an absent attack-feed slot in legacy recordings, including on later output ticks, so the world factory does not change the recorded snapshot contract. New live recordings and new-format replay snapshots enable the slot.
- Role pose sampling, connected pivots, and target-facing behavior remain under `src/rendering/voxel/`; no AoE combat contract enters the sibling Voxel package.
- Wildlife retaliation, gathering clips, projectile travel, and skeletal animation remain separate future work.

## KAD-0026 - Narrow-choke traffic is local, directed, and cache-independent

Date: 2026-07-19.
Status: Active.

Context: Units must remain soft traffic outside the global A* blocker graph, but one-cell passages cannot use ordinary subcell sharing without presenting followers wrapping around a leader. Inferring peer flow from the transient route cache breaks save/load parity, while inferring only from final targets can deadlock at detours, moving targets, head-on pairs, and longer fully occupied loops.

Decision: Keep terrain, resources, buildings, water, forest, and bounds as the only global route blockers. A local commanded/task traffic layer recognizes straight and turning one-cell passages, centers the lane, and reserves at most one co-located origin per tick. Each participating unit additively persists its last actual cardinal traffic leg on `UnitTransformComponent`, refreshed even when it waits; legacy absent fields temporarily fall back to serialized intent. Acyclic followers wait without clearing their route, while a directed occupied-cell cycle admits only its lowest entity id to create an empty slot. The transient A* cache is never traffic authority.

Consequences:
- Same-direction followers queue instead of taking a long global detour or passing through lateral subcell slots.
- Head-on pairs and longer occupied loops may pause for one learning tick, then make deterministic progress without a persistent fairness token.
- Save/load and replay retain the last attempted leg and its provenance through four optional component fields (direction X/Y, intent key, attempt tick) without a schema-version bump; old saves learn them on first use.
- Autonomous scout wandering and herdable drift remain outside this layer, and long-term bidirectional fairness, formation regrouping, and idle-blocker timeouts remain separate work.

## KAD-0027 - Water reflection is an AoE-owned material cue, not a mirrored scene

Date: 2026-07-19.
Status: Active.

Context: convincing water needs visible motion and light response, but pinned Voxel 0.1.4 exposes only unlit, Lambert, or standard materials with roughness and metalness; it has no texture-map, normal-map, environment-map, transparent mixed-chunk, or planar-reflection contract. A Three `Reflector` would create a second scene pass plus lifecycle, context-loss, performance, and presented-state coordination outside the reusable snapshot boundary.

Decision: retain one opaque palette-material terrain chunk per mixed chunk and layer sparse AoE-authored water instances above it. A dedicated opaque low-roughness standard `water` surface owns static ripple/reflection strips and spatially phased animated crests. Its static and animated batches are always declared, share the existing bounded instance-animation contract, and degrade excess crests into static matrices. Visible land adjacency may add matte shoreline foam; no terrain detail enters entity hit state.

Consequences:
- The renderer declares seven materials and nine instance batches; scenes with visible animated units plus water may activate three animated batches.
- Equal displayed simulation time freezes water, pause and replay use the existing monotonic presentation clock, and coordinate-derived phase keeps reconstruction deterministic.
- The effect reflects the daylight rig as a material cue but does not mirror buildings, units, terrain, or the sky into a second framebuffer; true reflection remains a separate engine contract and performance decision.
- Terrain chunks, occupancy, fog authority, ground-plane picking, saves, replays, and the dense uniform-terrain raycast boundary remain unchanged.

## KAD-0028 - Concrete unit identity is profile-driven and AoE-owned

Date: 2026-07-19.
Status: Active.

Context: Seven broad unit roles provide coherent body construction and animation vocabulary, but they collapse meaningful concrete identities such as swordsman versus halberdier, archer versus crossbowman, horse versus camel, and ram versus cannon. Duplicating complete recipes per type would make locomotion, ambient suppression, attack pivots, melee reach, memory projection, and presented silhouette picking drift independently.

Decision: Keep seven shared body families and give every one of the 34 `UnitType` values one exhaustive AoE-owned visual profile for armor, headgear, shield, mount, weapon, tier, and signature detail. Family builders turn that data into deterministic recipes of at most 32 parts. The exhaustive attack-rig table selects controlled suffixes, pivot, melee reach, and one of 17 concrete pose styles; each style rigidly transforms the same connected weapon compound the resting recipe displays. The prepared recipe remains the single source for Voxel matrices, memory variants, ambient/locomotion posing, and AoE's presented silhouette proxy. No art semantics or unit-type schema enters the sibling Voxel package, and no simulation, combat, persistence, or replay authority changes.

Consequences:
- All concrete types read through their equipment and machine silhouette while upgrades within a line retain a common visual language.
- Attack motion cannot silently fall back to a role-wide weapon that the unit does not carry; exhaustive compile-time maps and adapter-parity tests guard the profile/rig/presentation seam.
- Feet, mounts, wheels, contact shadows, and authoritative roots remain planted during attacks; connected compound distances remain rigid, recipes are stable and bounded, and memory projections contain no active animation.
- Per-civilization variants, projectiles, gathering/death clips, and skeletal or imported character animation remain separate future work.

## 2026-08-01 — The playtest harness observes; it does not write code

Supersedes the Phase-6.E auto-apply decision and the 2026-07-08 ledger-driven proposal-intake decision, both of which assumed an automated fix arm downstream of the ledger.

Decision: the recursive loop ends at the ledger. `playtest:self-improve` classifies findings and records replay self-check evidence, and a person or an agent session takes it from there through the ordinary TDD/gates/review cycle. No harness path proposes a patch, applies one, runs gates on a generated branch, or touches git.

Reasoning: the arm was the expensive half and the weak half. It needed `applyAndGate` (branch/apply/gate/commit/hard-revert), a fix-prompt builder, a candidate selector with its own eligibility rules, an N=3 counterfactual sampler to cover LLM non-determinism, and roughly 1,900 lines of script and source to hold it together — and across the loop's operating life it proved one fix. The observation half around it (runner, oracles, corpus, findings, canary, ledger, replay inspection) is what actually found things, and it stays whole.

Consequences:
- `ledgerOracleViolation.ts` keeps the ledger→`OracleViolation` adapter the canary drill depends on; fix-candidate selection is gone, so no code path ranks findings by "what should we auto-patch."
- The playtest model policy in `design/spec-final.md` §15.7 now covers three call sites (tactical, strategy, conformance probe) instead of five.
- Determinism caveat stands on its own: a single clean rerun of a non-deterministic LLM was never evidence a change worked, and there is no longer a sampler implying otherwise.
- Reinstating automation means rebuilding `applyAndGate` deliberately, with the prove-fixed rule from the fleet canon designed in from the start rather than bolted on.

---

## The frame's art style is a display preference resolved in the engine, not game state

**Date:** 2026-08-17

**Decision.** The Moebius look is a whole-frame resolve pass owned by the sibling `voxel` package (`StylizedResolvePass`), opted into through `ThreeRenderRuntimeOptions.stylizedResolve`. AoE owns only the tuning and the player-facing choice. The selected style lives in `localStorage`, never in the save format.

**Why the pass lives in `voxel` rather than here.** It reads depth, view-space normals, and luminance, and nothing else — no part of it knows what a villager or a Town Center is. `ThreeRenderRuntime` has a single `renderer.render(scene, camera)` seam shared by every frame path *and* the capture path, which is both the only place a frame-level operation can go and the reason stylized screenshots agree with the canvas. The look already existed in the sibling `townscaper` repo; keeping a second copy here would have meant maintaining the same shader twice, and `city` and `3d-maker` would have made it three or four. This does not weaken the standing rule that AoE owns every palette, recipe, role, fog cue, and animation meaning: the pass is given no scene knowledge, and every constant that decides how this game looks is in `src/rendering/artStyles.ts` with its measurement recorded.

**Why it is not world state.** Two players can watch the same match in different styles, and neither is more correct. Putting it in the save would let one player's display preference travel to another's screen and would make an art-direction change a save-format migration. Persistence is best-effort by design — storage that throws must not stop the game booting or refuse an in-session switch.

**Why Painted is the absence of the pass.** A "neutral" configuration would still cost a second scene render, a fullscreen resolve, and two offscreen targets every frame. `artStyleById('painted').resolve` is `null` and the option is omitted entirely, so the previous look costs exactly what it did before.

**Consequence.** An engine update can change how this game looks. The tuning in `artStyles.ts` records what each value was measured against and what the frame's mean luminance was, so a regression is checkable rather than arguable, and `scripts/captureMapScreenshot.mjs` plus `scripts/diffMapScreenshots.mjs` retake it.


## 2026-08-18 — Projectile to-hit rolls are counter-based hashes, not a seeded RNG stream

**Context.** Spec §10.4 requires accuracy rolls, which would be the simulation's first source of randomness. The simulation had none: every prior mechanic was deterministic by construction.

**Decision.** Derive each roll as a pure hash of `(launchTick, attackerId, targetId, projectileId)` rather than drawing from a seeded generator.

**Why.** A stateful stream must serialize its state into every save, and — worse — it couples correctness to the exact number and order of draws across the whole simulation. Adding a unit type, reordering a system, or skipping a roll in a new branch would silently change every subsequent outcome and break replay compatibility. A counter-based hash has no state to persist, reproduces identically on load, and is unaffected by unrelated changes elsewhere in the tick.

**Consequence.** Two matches with the same fixture and inputs produce the same rolls, which is desirable here (deterministic replays) but means the roll is not a source of match-to-match variety on its own; variety comes from differing positions, ticks, and entity ids. Any future chance mechanic must use the same pattern rather than introducing a stream.

**Also decided:** a projectile's outcome (roll result and aim point) is fixed at launch, not recomputed at impact, so a save taken mid-flight reloads to the same result without persisting anything about the pending outcome.

## Traffic arbitration: the jam election outranks the per-cell rules (2026-08-20)

**Decision.** In `movementTrafficOps`, when the dependency closure elects a caller (it is the lowest id of a closed mutually-blocking set), that caller returns `proceed` immediately. The co-located cross-flow and same-flow priority rules below it are not consulted.

**Why.** Those rules judge a single cell; the election is the only rule in the layer with the whole jam in view, and it names exactly one winner that every member of the set computes identically. Letting a narrower rule re-judge the winner produced a circular refusal — the elected unit was refused for standing behind a better-placed neighbour, and that neighbour was waiting on the election the winner had just won. Measured: two wood carriers and two villagers refused 200 ticks out of 200, one step from their own lumber camp, for the last fifteen thousand ticks of a match.

**Consequence.** A unit admitted by the election may step into a cell that still holds a peer for that tick; sub-cell occupancy absorbs it and the peer moves out on a following tick. That transient overlap is deliberate and is the cost of the jam resolving at all. The per-cell rules still govern every caller the election does not admit, which is the common case (an ordinary queue behind a leader with free ground ahead never enters the cycle branch at all).

**Also decided:** yielding to a co-located peer requires that peer to be able to take the turn — its own next cell passable and unoccupied. Deferring to a permanently blocked peer stalls both, which is how a villager with an empty cell ahead of it stood still for a whole match.


## Screen captures default to the ignored tree, not to tracked docs (2026-08-23)

**Decision.** `scripts/captureMapScreenshot.mjs` and `scripts/diffMapScreenshots.mjs` write to `tmp/captures/<LABEL>.png` by default; `OUT_DIR` overrides it, and the diff script now REQUIRES `LABEL` instead of falling back to a bare `before`/`after`/`diff` set.

**Why.** The old default wrote into `docs/devlog/artifacts/`, which is tracked — so the ordinary act of checking a change put evidence into Git, against the fleet rule that task-run evidence lives under ignored paths and enters the repository only when review promotes it. The old no-LABEL fallback made it worse: it silently overwrote committed baseline artifacts.

**Consequence.** The 57 artifacts already tracked under `docs/devlog/artifacts/` stay where they are and keep their names; nothing regenerates them by accident, because a capture no longer lands there without `OUT_DIR`. Any command line copied from a devlog entry older than this date now writes to a different place than the entry describes, which is the intended trade — the entry's conclusion is the durable part, not its file path.

**Also decided:** the same capture script grew `ZOOM` and `SIZE` (and the `setCameraZoom` browser-test hook behind it), so the multi-view sweep the local rules require comes from the maintained pair rather than from a one-off script per view.

## 2026-08-23 — Visual characterization hashes part NAMES; the tier gate hashes only pixels

`aoeVoxelUnitRecipeCharacterization` hashes the whole `VoxelPart` record, part keys included. That is right for its job — it pins the entire recipe surface and catches any unintended drift — but it makes the hash sensitive to a difference that no player can see and blind to identity between two units whose parts differ only by the unitType baked into their keys. Every unit's key carries its own unitType, so two pixel-identical units always hash differently there.

`unitTierVisualDistinction` therefore hashes a deliberately narrower record: surface, tint, centre, size and rotation, with the key dropped. The two tests are kept separate rather than merged because they answer different questions — "did anything about this recipe move?" versus "can a player tell these two units apart?" — and a single hash cannot answer both. The narrow one is the one that opened red on 13 of 36 upgrade lines.

Consequence to remember: a rename inside a recipe changes the characterization hash and not the tier hash, and a colour or size change moves both. When only the characterization hash moves, the change was invisible on screen.

## 2026-08-24 — The five-civ bonus cap is superseded by table-driven breadth

The 2026-07-05 decision capped civilization bonuses at five curated civs (Britons, Franks, Goths, Aztecs, Mongols) so effort would concentrate on completing the game rather than spreading across 30 identities. Two things ended it. First, the cap was already breached in spirit: unique units shipped for 16 civilizations in v0.3.20 and unique technologies for all 19 CSV rows by v0.3.70 — "no bespoke identity outside the five" had quietly become false everywhere except this one bonus layer. Second, the concentration the cap protected has happened: rosters closed, §4 and §6 complete, the game feature-complete enough that breadth IS the remaining work.

The supersession keeps the July decision's real insight — per-civ if-chains do not scale — by replacing the chains with a declared table (`civBonusTable.ts`, the `uniqueTechnologies` pattern): one entry per civilization, effects as data, one loop per seam. Only lines the existing six seams can express are encoded; the rest are listed in the spec as the open remainder rather than silently dropped, so a reader can still tell implemented from absent. The v0.1.101 Slavs revert (farm bonus removed to honor the cap) is re-applied forward: the same bonus now ships as a table row.

## 2026-08-30 — Spawn passability is cached on the structural revision, which makes the revision contract load-bearing twice

`isCellPassableForSpawn` is the simulation's hottest query — pathfinding asks it for every neighbour of every expanded node, and it was 32% of all CPU in an AI self-play match. It is now memoised in `spawnPassabilityMemo.ts`, a `Uint8Array` of the world cleared whenever `worldOccupancy.structuralRevision` moves.

The alternative was to make each call cheaper, and that was tried first: the predicate was rewritten to read engine claims directly instead of building a merged cell status, removing a string key, two filtered arrays, two spread arrays and an object per call. It produced no measurable win (15.13 → 15.77 ms/tick). The call count was the cost, not the work, so the cache is the change that mattered (15.13 → 7.99, and → 5.45 once review found that release-then-reclaim was bumping the revision twice and flushing the cache an extra time on every moving resource).

What this decision buys and what it costs: the cache is correct only under a two-sided contract, and the second side is the one that bites. The READ side is that the predicate reads exactly bounds, terrain, building claims and resource claims — and NOT units, which crowd rather than block and deliberately do not bump the revision. The WRITE side is that every path which changes one of those claims bumps the revision. The write side was broken when this shipped for review (`syncUnit` released claims without bumping), which is why `releaseClaims` is now the single choke point through which claims come off: an argument about a read-set cannot be enforced, but a single function can be. The failure mode if either side lapses is a stale verdict that changes what the simulation does, not merely how fast it does it.

This is the second load-bearing use of `structuralRevision` (the first is the v0.3.160 unreachable-plan cache), which is the reason the counter's doc comment enumerates its bumpers explicitly, and the reason the 2026-08-29 gate-completion entry treats a missing bump as a correctness defect. A third consumer should be read as a signal that the counter deserves a named invalidation type rather than another comment.

## 2026-08-30 — Wildlife retaliation is issued by the biter, not by auto-aggression

Auto-aggression finds its targets through `world.query('position', 'unit')`. Wildlife are `resource` entities with a wildlife state and no `unit` component, so they are structurally invisible to it — a wolf could kill anything it met and take no damage doing so.

The obvious fix is to make wildlife visible to auto-aggression, and it was rejected. Wildlife are resources because that is what they are to the rest of the game: a villager gathers a boar, a deer holds 140 food, the drop-off anchor searches them, the renderer draws them from the resource recipe table. Giving them a `unit` component to satisfy one query would put every one of those paths on notice, and the auto-aggression query would then have to learn to ignore the sheep.

So the retaliation is issued at the bite instead: `wildlifeCombatSystem` calls `setUnitAttackCommandDirect` on the victim, and only when the victim is not already attacking something. The guard is load-bearing rather than an optimisation — re-issuing on every bite resets the approach each tick, and two wolves sharing a victim would leave it oscillating between them without ever landing a blow.

The cost is that this is the first deterministic-resolution system to issue an attack, which the dependency layer had a comment asserting would not happen. That comment is now corrected rather than deleted, because the reason it was written still holds for the AI-decision systems it was about.

## 2026-08-30 — Wolves are a map feature; deer are a per-player one

Both are spec §5.6 required, and the first implementation gave each player two wolves on a ring just past their own resources. That ring is where the scout patrols, and wolves are `autoAggro` with a range of 5, so every match opened with the scout being ambushed. AoE2 keeps wolves away from starting positions for exactly this reason: a predator inside your opening is a coin flip nobody chose to make.

Deer stay per-player, because a deer hunt is something a player does with their own villagers and each player needs their own. Wolves become a map-level pass placed in the ground between the bases, at least 16 tiles from any Town Center — beyond the widest scout wander box.

Neither is seeded into generated maps yet: adding deer breaks an unrelated scout test on the canary map for a reason not yet root-caused (see the devlog for what was eliminated). The placement code was reverted with the spawns rather than left dead in the tree; the design is recorded here because it was reached by measurement and should not be re-derived when the blocker clears.

## 2026-08-30 — The AI reserves wood for what makes it ELIGIBLE, not only for the age-up itself

`ageUpReserveCost` protects the age-up research, and returns nothing until the owner already qualifies for the next age. That is the right shape for the research and the wrong shape for the problem: an AI that cannot become eligible is defending a purchase it cannot make while spending the money for the one it can.

Measured over 20,000 ticks before the change: 715 wood reached buildings and 525 went to 21 spearmen out of 1,240 total, the stockpile never cleared 24, no AI ever accumulated the 150 for a first Blacksmith, and no match on any seed reached the Castle Age. The AI banked 980-1,922 food it had no way to spend, because the reserve that would have protected it never engaged.

`agePrerequisiteWoodReserve` is the sibling one step earlier in the chain, and it lives beside the age-up reserve rather than in the build-order picker on purpose: the picker already wanted the right building — it was the production phase spending the wood out from under it. Scoped to the Feudal transition it was measured on, and lapsing the moment the owner holds two qualifying buildings, rather than generalised to Castle and Imperial on an assumption, since no match had ever reached those for their behaviour to be observed.

It carries a three-unit military floor, and that is not a detail: without one the reserve is a training BAN, measured across eleven seeds at 21% of all peak military, on seeds where the building it saved for was never affordable either. The floor cannot be `attackGroupSize` (5) — `militaryGrowthPausedForAgeUp` already stops growth there, so everything this reserve competes with happens below it.

The paired villager-split change (Feudal wood 4 to 6) is not separable from it and is documented as one rule in both files. Each half alone fails the end-to-end test: income alone is eaten by the spearman as it lands, and the reserve alone buys buildings by halving the army. The cost is a regression on `corpus-seed-b` and one unit type on the boot map's losing player, accepted on the stated ground that the metric changed from Feudal timing to what a match exercises. A future revisit should re-run the sweep — five reserve sizes against five weights across at least three seeds — rather than adjust one knob from memory.

## 2026-09-01 — The approach-plan cache is the THIRD consumer of `structuralRevision`, and it stays a bare counter

`worldOccupancy.structuralRevision` now keys three caches: the unreachable-plan cache, the spawn-passability memo, and the new approach-plan cache in `approachPlanCache.ts`. The standing note here says a third consumer is the point to introduce a named invalidation type rather than keep overloading one counter.

Deliberately not done yet, and the reason is worth recording so the next reader does not assume it was missed. All three consumers want the SAME question — "has durable topology changed?" — and none of them wants a narrower one. A named type would today be a single member enum wrapping an integer, which adds a layer without removing a coupling. The moment a fourth consumer wants a DIFFERENT question (say "have buildings changed but not resources?", which a farm-aware cache would), the counter stops being sufficient for everyone and the named type earns its place. That is the trigger to split, and it has not fired.

What makes the overload safe meanwhile is that every consumer treats the revision as opaque and compares for equality only; none infers ordering or magnitude. A consumer that started reasoning about the revision's VALUE would break that, and would be the other trigger to split.

## 2026-09-02 — The starvation clock counts contested waiting, not standing still, and the election reads it from the snapshot

The v0.3.175 relief rule yields to a jam member that has not changed cell for 750 ticks. Its clock was stamped on cell change alone, so it kept running through every phase a unit spends not moving — a Town Centre build (~1,500 ticks), a garrison, a parked army — and such a unit, retasked through a one-wide gap, was elected over units that had been asking to move for hundreds of ticks, on its first ask. The 750 was tuned against WALKING villagers (healthy maps never held one still past 500), so the constant had been validated against a different quantity than the code counted (review E1; measured on the boot map at 30,000 ticks as 5 phantom admissions across 5 units, with 245 relief admissions across 18 units in all, none before tick 15,284).

Decision: the clock restarts when the unit resumes asking after a gap of more than one tick, in addition to restarting on a cell change. "Attempting on every tick" is what a jammed unit does — `trafficAttemptTick` is stamped on every consult — and it is the only signal that distinguishes waiting from standing. The threshold's rationale is now mechanical rather than empirical: nothing but continuous contested waiting can reach it. The alternative — a per-unit "reason for standing" (building, garrisoned, arrived) fed into the arbiter — would couple the arbiter to every system that parks a unit; the attempt tick already summarises them all.

Second decision, same change: each unit's clock rides the tick-start snapshot like every other election input, instead of being read live. A member's own consult re-stamps its record mid-tick, and reading that live made the members that consulted before it elect a different winner than the members after it — a lost admission tick on every relief crossing, and an election that depended on consult order (review E2). The file header used to claim order independence; what actually holds is order STABILITY across live play, save/load and replay plus a snapshot that makes the decision independent of it, and the header now says that. One rule (`trafficProgressClock`) computes the clock for both the stamp and the snapshot, so the two readers cannot disagree.

Gates: `movementTrafficStarvationClock.test.ts` (the parked-unit and consult-order cases), `movementTrafficReplenishedJam.test.ts` (the real arbiter with modelled walking, fails under "stamp every consult" and "threshold 1"), the fairness boundary cases, and `movementTrafficReliefBootMap.test.ts` (the boot map at 30,000 ticks: no phantom relief, and the rule still engages).

## 2026-09-02 — Cast shadows are recipe geometry on the existing shadow lane, kept to one layer by draw height rather than by a runtime transparency scheme

The voxel runtime never enables shadow maps (`renderer.shadowMap`, `light.castShadow` and chunk `receiveShadow` are all off in `voxel/src/three/`) and exposes no option to turn them on, and this repo does not edit the sibling. So a cast shadow here is geometry the recipes emit: one caster box per entity, projected along the daylight rig's own sun into three non-overlapping slabs on the translucent `shadow` surface the contact slab already used. No new material and no new batch — `materialResources: 7` and `instanceBatches: 9` stay as the metrics contracts have them, and the draw-call count on the default view stays at 13.

The tradeoff is overlap between entities, and it is worse than double darkness: two coincident translucent slabs Z-FIGHT, and the overlap tears into stripes as the rasteriser picks a winner per pixel — measured by forcing the level step to zero and re-capturing the boot view, where a boar's shadow came back shredded and 19,891 shadowed pixels reverted to lit grass (counted as after/before luminance ratio 1.80 between the control and the shipped build). Neighbouring trees' shadows overlap constantly. The runtime does carry a single-layer transparency scheme (a depth-only prepass plus an equal-depth colour pass, `singleLayerTransparencyInternal.ts`), which is exactly the right tool, but it is reachable only through a package-internal material decorator that nothing outside the sibling's own tests sets, so this repo cannot mark a material with it. What ships instead needs nothing from the runtime beyond three.js defaults, which were verified rather than assumed: the shadow material is transparent with `depthWrite` on and a less-equal depth test, and the instances of one `InstancedMesh` rasterise in slot order. A caster's height starts at one of nine levels chosen from its anchor cell (x mod 3, z mod 3), 0.002 world units apart, and `makePartBatches` sorts the lane top-down, so where two slabs overlap the lower one fails the depth test and the pixel blends once. The 0.002 step assumes the context hands back a 24-bit depth buffer; nothing in `rendererParameters` pins the depth size, so on a 16-bit context one quantum is 0.061 units, the separation is below the noise floor and overlapping shadows tear. Unverified off this machine, and the honest shape of the browser-suite lesson in AGENTS.md.

The anchor cell is the colouring and a whole-lane pass (`resolveShadowLevels`) is the repair. Two casters sharing a level are a multiple of three cells apart on each axis. That is beyond a tree's or a unit's reach but NOT a large building's — a Town Center's ground span is 4.53 tiles, so one at (10,10) and a House at (13,13) share level 4 and overlap — and it says nothing at all about zero cells apart, which is not a corner case: units share cells, and a 12,000-tick AI-vs-AI run of the boot map reached four villagers on one tile and thirteen same-height overlapping slab pairs at once. The pass gives such a caster the next level up, stepping until nothing it overlaps holds that height. The search is deliberately UNBOUNDED: a capped one has to fall back on a height that is taken by construction, and an independent review measured that at 34 coincident overlapping slab pairs across 7 casters on a 6x6 woodline with 12 villagers gathering in it — an ordinary scene, and bit-for-bit the control condition. The price is that a clique of K mutually overlapping casters needs K heights and rises above the band — 0.058 (twenty levels) on that scene, 0.072 on a 200-population blob packed at a third of a tile, three to five pixels of float at the closest camera zoom. Those are measurements, not a bound: nothing in the code limits the lift, only how tightly the simulation can pack casters. Two costs come with it and are accepted. A caster's height changes as the crowd around it moves and as it crosses a cell boundary — 18.9% of caster-frames in a walking group of 24, largest jump three pixels — so the flicker the rest-pose rule removed from the POSE channel exists in the LEVEL channel, unbounded and ungated. And a floating or twitching shadow is still a far smaller defect than a torn one, which is the whole trade. Greedy colouring WITHOUT the cell seed was tried first and is worse, not simpler: a tree's shadow reaches 2.4 tiles, so a 3x3 block of trees is a nine-clique, and greedy from level zero exhausted all nine on a 6x6 forest and dropped casters back onto a neighbour's level. Cost is one pass over the lane's casters per presented frame, quadratic in casters and only over their ground bounding boxes. Measured by the review: 0.56 ms/frame at 100 casters, 1.09 at 300, 2.70 at 600, 6.02 at 1200, 17.12 at 2400. The boot map presents about 85, so this is free there and is NOT free on a large map with two full armies — the first thing to revisit if the renderer is ever profiled.

What would reverse this: the sibling exposing shadow maps or its single-layer mark on the public surface (then the level trick goes and the projection constant stays for the sun), or moving the sun (candidate #2 in `docs/threads/done/render-realism-2026-09-02/DESIGN.md`) — the projection derives from the shared `AOE_DAYLIGHT.sunOffset`, so the shadows would follow, but every colour-asserting test would move with the lighting.

## 2026-09-03 — A shadow is the caster's silhouette, tiled with triangles, and a flat pad receives its own (v0.3.194)

Supersedes the caster-box half of the 2026-09-02 decision below; its depth half (per-cell levels and the unbounded repair) stands unchanged.

The owner's steering was that shadows "roughly match the shape of the thing that created the shadow instead of always being a rectangular", with the standing requirement that a shape change re-adjusts the shadow in future. That second half is the architectural one: it rules out authoring a shadow proxy beside each recipe, because a proxy is a second copy of the shape and drifts the first time someone edits one and not the other. So the shadow is DERIVED — a caster's solid parts are read as a vertical profile and the shadow is the union of the bands' swept footprints. Nothing in the shadow path names a recipe, a part or an entity type.

The tiling primitive is the reason for the first non-cube geometry in this renderer. A silhouette is a polygon; an instanced box can only ever be a parallelogram on the ground, which is exactly why every shadow used to be a rectangle-derived hexagon. Triangles tile any polygon, so the shadow lane gets `aoeVoxelShadowWedge.ts` and its own `geometryKey`. It is FLAT rather than a prism: the prism version stood two 0.036-tall side walls back to back along every internal edge, both blended, and the tiling drew itself as a mesh of dark seam lines over every shadow in the scene. A flat triangle has no wall to blend and adjacent pieces meet on the rasteriser's own fill rule.

The cost is instances, and it is bounded structurally rather than trusted: the envelope's breakpoint count is not a function of the band count, so the merge tolerance is RELAXED until the tiling fits ten strips (four more for the pad layer). Measured mean 3.0 -> 15.7 instances per caster over thirteen archetypes, and 862 -> 1188 instances for the whole boot map read off the live renderer's metrics with both builds served side by side; batches unchanged at nine, one added geometry.

The pad receiver is the finding that the correct silhouette looked WORSE than the wrong one. Almost every building here stands on a plinth wider than its walls, and the sun is 52 degrees up, so the whole of a building's shadow lands inside its own plinth — the old model's extruded footprint escaped it only because it pretended the building was as wide as its plinth all the way up. Drawing on the ground alone left the largest objects in the game with no shadow (Town Center: 0.82 tiles past a 3.44 tile plinth). A caster's base is therefore a RECEIVER when it is a pad, and the flatness test is the load-bearing part of that: wide-and-short alone also describes a gold mine's rubble, whose rock keeps going up through the band, so a patch drawn at that height would hang inside the rock. The test is on the widest part contributing to the band — its top must be the pad's top.

What would reverse this: the sibling engine exposing real shadow maps (the whole scheme goes, profile and levels together), or a lower sun (a building's shadow would clear its own plinth and the pad receiver would stop earning its keep).

## 2026-09-03 — The AI trains the unit TIER it holds, resolved by line, in both directions

`pickUnitMix` names the top of each unit line and `getTrainOptions` offers the tier the owner has researched. Matching those by exact name meant an AI without the upgrades trained nothing at all (see the defect register, v0.3.199). `trainableInSameLine` resolves between them.

It resolves in BOTH directions, deliberately. Downward is the fix's purpose: asked for a Halberdier, offered a Pikeman, train the Pikeman. Upward is the same defect wearing the other face — an owner who has upgraded PAST the tier the mix names would otherwise stop training for having IMPROVED its army. The reachable upward cases are the Feudal mix naming `scout` against a researched Light Cavalry, the Castle mix naming `battering-ram` against a researched Capped Ram, and the Imperial mix naming `cavalier` or `onager` against a researched Paladin or Siege Onager. (An earlier draft of this decision cited the Dark-Age `militia` case; that one cannot happen — `optionsRules.ts` gates the whole Barracks research block on the age not being Dark, and the mix stops naming `militia` the moment the owner is Feudal. The upward half is still worth having, but it needed a reachable example, and none of these four was measured.)

The alternative considered was teaching `pickUnitMix` to return a per-age preference list instead of one unit per producer. Rejected: it puts the upgrade tiers in a second place, and this repo has already had that drift — `UNIT_LINE_UPGRADES` gained a middle tier for the ram line (Battering -> Capped -> Siege) that a hand-maintained list in the AI would not have grown. Deriving the lines by union-find over that table keeps one source.

Known limit: a producer offers at most one unit per line, so the match is unambiguous today. If a building were ever to offer two tiers of the same line at once, this returns the first and the choice becomes arbitrary.

## 2026-09-04 — A query that finds a unit finds one that is ON THE MAP

`playerQueries.findOwnedUnit` returned any live unit of a type, garrisoned ones included. A garrisoned unit keeps its `unit` component but `garrisonUnit` strips its position, so nothing can walk to it, attack it, or engage it at all — and `setUnitAttackCommandDirect` returns false without a target position, silently, in a path the command validator never sees. Its one production caller is the AI attack phase's "hunt the enemy's villagers" preference, and one hidden villager pinned an army of 151 for 30,000 ticks (defect register, 2026-09-04).

It is renamed `findOwnedUnitOnMap` rather than quietly filtered. A caller that genuinely wants a garrisoned unit now has to ask for it by another name, and the old name cannot come back meaning something weaker.

The alternative considered was filtering at the call site in `aiSystemAttackPhase`. Rejected: the trap is in the query, not in the caller, and the next caller would meet it fresh. The narrower alternative — keeping the name and documenting the behaviour — was rejected for the same reason a comment is not a gate.

**The rename did NOT close the class, and an earlier version of this entry claimed it did.** A critic found two more hand-rolled `world.query('unit')` scans with the same shape, one of them four lines from the fix. `ownedMilitaryUnitIds` prunes the attack group, and `state.attackGroup.length` is what the push threshold compares — so garrisoned military read as mustered; reachable on `islands`, where the AI garrisons its army into a Transport Ship. `findAvailableVillagerForBuild` could hand a foundation to a villager sheltering under the town bell; the `building.placeConfirm` validator asks only that the builder is alive and is a unit, so the site is placed and the concurrent-build slot is spent on a builder that can never walk to it.

Both are fixed. The military one is SPLIT rather than filtered, because its two callers ask different questions: the production phase's growth pause wants "how much military do I OWN" — a garrisoned soldier still costs population — and the attack group wants "how much can MARCH". `ownedMilitaryUnitIdsOnMap` is the second. A single filtered query would have made the AI over-produce while its army was aboard a transport.

Known limit: this makes the preference skip a villager that is merely hidden rather than gone, so an AI now attacks buildings while the enemy's population sits safely inside them. That is what AoE2 does — you break the building — but it means the attacker will not be waiting at the door when the town bell rings and they come back out.

## 2026-09-05 — Gather ranking reads a walk-distance FIELD, not a path per candidate, and it is the fourth consumer of `structuralRevision`

The gather comparator ranked candidates by Manhattan distance to a drop-off while movement is strictly 4-connected (register entry 2026-09-01). The correct key is the true walk, and pathfinding every candidate on every assignment is what made the naive version unshippable: an assignment runs after every delivered load, and a base offers a hundred candidate trees.

Decision: one multi-source breadth-first search per (owner, resource kind, movement domain) from the approach ring of every drop-off of that kind — `dropOffWalkField.ts` — answers every candidate with four array reads and answers "unreachable" as Infinity for free. It costs one visit per map cell when built and nothing when replayed.

Its cache key is the structural revision AND the set of drop-offs, and the second half is the part a reader would assume was redundant. A camp claims its footprint as a foundation, so completing it changes nothing the occupancy grid can see and bumps no revision — yet it turns a wall into a drop-off. The 2026-09-01 entry above said the counter stays bare until a consumer wants a DIFFERENT question; this consumer wants the same question ("has durable topology changed?") plus one more input it carries itself, so the counter still stays bare. It still treats the revision as opaque and compares for equality only.

Alternatives rejected. (1) Bounding the search to the home range: the everyMatch fallback ranks the whole map when home is empty, and a bounded field would tie every far node at Infinity. (2) Re-weighting the Manhattan key: seventeen attempts, all failed, because the measurement was wrong rather than the weight. (3) Exposing the field as its own ops object: the two wiring files it would cross are at the 500-line cap (`wireBridgeOps.ts` at 500, `movementPlanOps.ts` at 499), so it rides on the movement-plan ops object, which is what every system dep bag spreads; that placement is a file-size accommodation and the header says so. This change also takes `registerAllSystems.ts` from 498 to exactly 500 lines — the next line there trips the budget, and the honest move then is a split, not a raised cap.

Known cost: the field is per owner and domain, so a fishing ship and a villager of the same owner build separate fields, and a wildlife move re-syncs a resource claim and bumps the revision like a felled tree does — so on a map with many wandering animals the field is rebuilt more often than topology "really" changes. Measured cost is in the register entry; it is the number to re-read if ticks/second ever fall on a wildlife-heavy map.

**Not decided here, and why: the deposit leg.** A critic found that `dropOffStep` has the same defect one level down — the Manhattan-nearest drop-off from the carrier's live position, then the first ring cell of it an A* reaches in Manhattan order, which on Nomad handed a carrier a 27-step loop while its neighbour got the 10-step route through the first carrier's cell. The natural fix is to descend this field's gradient from the carrier's cell (built on branch `deposit-walk-field`, with `descendFrom`); it is held back because it changes the boot map's outcome and trips two self-play gates whose contracts predate a resolving match (register entry "Fourteen loaded carriers freeze head-on on Nomad"). The decision is the owner's.

## 2026-09-06 — The stopped-match notice is a full-screen modal, and that is a deliberate exception to the minimap rule

The local rule "The HUD holds its shape, and nothing floats over the minimap" (2026-09-02, owner) forbids any floating element covering the minimap. The notice this change ships covers the whole screen, minimap included, and is therefore an exception that had to be decided rather than discovered.

The call, made by the integrator and recorded here so it is not read later as an oversight: the rule governs a LIVE game. Its whole cost is the information the player loses while they are still playing — the owner found it when a build tooltip landed on the minimap mid-placement. A stopped match has no live information to cover. The minimap under this notice is a still image of a world that will never change again, and the player's only remaining action is to leave.

So the notice takes the screen on the same precedent as the game menu (`.hud-game-menu`) and the technology tree: both already cover the whole match, both already cover the minimap, and both are modal for the same reason — they are what the player is doing now, not something they should notice out of the corner of an eye. A badge or a toast was rejected for the opposite reason: this state is permanent and unrecoverable, and a surface the player can look past is the defect this change exists to fix.

Two smaller decisions inside it. The engine-side half (`HudState.engineHalted`) is POLLED at 500 ms rather than pushed: the only cheap push seam is inside the bridge, which this change does not own, and `getHudState()` projects the whole render state, so calling it an extra time per frame is not free. A halt is permanent, so a poll slower than the eye loses nothing. And the first cause wins — `show()` is idempotent — because a later failure cascading out of a broken frame would otherwise overwrite the one message that explains the stop.

Known limit: the notice reports that the match stopped, not what to do about the match itself. There is no "save what is left" path, because a world left part-way through a tick is what makes stepping it unsafe in the first place, and a save written from it would carry the same inconsistency forward.
