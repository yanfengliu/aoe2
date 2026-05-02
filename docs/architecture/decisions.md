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

Context: Phase 1C's DESIGN v17 §6.5 specifies that AI-decision systems push intentions to `pendingCommands` and the resolution-half handler applies them at the next tick. PLAN v4 §1C step 1B specifies splitting `monkBehaviorSystem` into `monkBehaviorDecisionSystem` (decision; pushes intentions) and `monkBehaviorResolutionSystem` (deterministic; mutation).

Today, `aiSystem.execute → assignAiMonkTasks → setMonkTask` mutates `state.monkTasks` directly during the `update` phase. The split was deferred during Phase 1C because monk task selection involves per-monk cost-benefit reasoning (heal target priority, relic pickup vs deposit, conversion target valuation) that doesn't map cleanly to a single intention shape — at minimum it would need 4 commands (`monk.heal`, `monk.convert`, `monk.pickup`, `monk.deposit`) each with their own validator + handler. Phase 1C's scope was the 15 already-designed commands; adding 4 more was out-of-band.

The deviation is safe TODAY because `monkTasks` is not yet a migrated Tier-1 slot (KAD-0006). The recorder's diff-listener snapshot watches `world.state.aoe2.*`, not the bridge-side `state.monkTasks` Map, so live mutation by aiSystem is invisible to the recording.

Decision: `monkTasks` is a **Phase 2D blocker**. The slot's migration (read/write through accessor + codec) MUST be paired with the `monkBehaviorSystem` split per PLAN v4 §1C step 1B; migrating without the split would let aiSystem's mid-tick mutations enter `world.state.aoe2.monkTasks` AND the replay path's re-derivation would conflict (replay re-runs aiSystem from the recorded snapshot; live + replay re-derivations of `assignAiMonkTasks` aren't bit-identical because they depend on visibility and target priority that may diverge under FoW).

Consequences:
- Phase 2D MUST NOT migrate `monkTasks` to accessor-based mutation until the split lands. The Phase 2D slot-migration task list explicitly excludes `monkTasks`.
- The eventual split adds 4 commands to `GameCommands` (or one parameterized `monk.assignTask`), with validators that re-fetch monk + target state, and handlers that delegate to the existing `setMonkTask` body. aiSystem's `assignAiMonkTasks` becomes a pure decision producer that pushes to `pendingCommands`.
- Until the split, `relicGoldSystem` and other consumers of `prototypeMonkBehavior` continue to read from the live Map via `state.monkTasks`.
