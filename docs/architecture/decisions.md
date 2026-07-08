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
Status: Active

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
- AI monk task effects are intentionally delayed by one tick. `tests/simulation/aiPlayer.test.ts` covers this with the `ai-monk-relic-fixture`: the first decision step queues the pickup while the relic remains on the map, and the next step processes the command and carries the relic.
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

Decision: `src/game/playtest/selfImprovementLoop.ts` is a pure ledger contract over saved artifacts. It reads run objects, recovers `civ-engine` `ImprovementFinding` payloads from markers or legacy envelope findings, consumes deterministic oracle findings supplied by `oracleImprovementFindings.ts`, computes conformance metrics, classifies `nextAction` into proposal/fix/observe/none routing, preserves disposition, and compares baseline/current metrics with `compareMetricsResults`. `scripts/playtest-self-improve.mjs` is only filesystem and replay glue: it loads `<prefix>.json`, `<prefix>.envelope.json`, and optional `<prefix>.llm-trace.jsonl`, repairs historical `metadata.endTick` values in memory, optionally runs the deterministic oracle suite via `--oracles`, runs `SessionReplayer.selfCheck` through `createReplayWorldOnly`, and writes JSON/Markdown ledgers under ignored output paths. `src/game/playtest/fixProposalInput.ts` is the proposal-intake adapter: it selects classified fix findings from the ledger and converts their shared `ImprovementFinding` payloads into the existing fix-prompt violation shape so `scripts/propose-fix.mjs --ledger` can route proposals without reparsing legacy reports.

Consequences:
- Existing runner/finding/replay/auto-fix systems stay authoritative; the ledger composes them instead of introducing a competing harness.
- Replay self-check failures and partial/no-op self-checks are written as first-class evidence rather than hidden, so old or incomplete bundles can still teach the loop while blocking overclaiming.
- Proposal-only findings remain candidates until a later patch plus rerun proves closure; the ledger does not mark unreviewed conformance findings as fixed.
- The before/after comparison contract is shared with `civ-engine`, reducing aoe2-specific delta vocabulary as the loop matures.
- `scripts/run-oracles.mjs` remains the legacy gate/report path for CI-style pass/fail reporting; recursive-loop evidence should use `playtest:self-improve --oracles` so oracle violations are preserved as shared improvement findings.
- `scripts/propose-fix.mjs` keeps legacy `REPORT.md` parsing as compatibility fallback, but recursive-loop proposal work should pass `--ledger <ledger.json>` so target selection uses the classified shared finding contract.
