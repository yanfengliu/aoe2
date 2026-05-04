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
- Phase 2D no longer has a `monkTasks` exception; `unitCommands` remains the last bridge-owned Tier-1 codec.
- Command handlers and deterministic Monk behavior remain the only task mutation sites; AI decision systems continue to queue intentions.
- Phase 2F can proceed to the schema-2 save format only after `unitCommands` is migrated or explicitly reclassified out of Tier-1.
