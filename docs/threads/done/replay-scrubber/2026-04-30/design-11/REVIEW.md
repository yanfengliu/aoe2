# Replay Scrubber Design Iter-11 Review

**Date:** 2026-04-30
**Iteration:** design-11 → produces design-12 (with scope reduction)
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE → SCOPE REDUCTION (Codex BLOCKER + 2 MAJORs; Claude BLOCKER + MINOR + 2 NITs — Codex caught a structural mismatch that 11 iterations missed)

## Codex BLOCKER — replay forward is impossible for aoe2 sessions

**Finding:** aoe2's `GameCommands = Record<string, never>` (`pureHelpers.ts:38`). All input is exposed as bridge methods, NOT engine command handlers. SessionRecorder captures `world.submitWithResult` payloads (`session-recorder.ts:459`), so bundles always have `commands.length === 0`. SessionReplayer.openAt() throws `BundleIntegrityError('no_replay_payloads')` when `targetTick > startTick && commands.length === 0` (`session-replayer.ts:226`). Replay forward is infeasible.

**Compounding issue:** even bypassing the throw, ADR 10's step-based playback wouldn't reproduce the live game. Deterministic stepping ignores the bridge inputs that drove live state.

**Scope decision (replaces v12 deltas of incremental fixes):** v0.1.6 ships **Phase A (bridge-state migration) only**. Phases B-F (ReplayController, TimelinePanel UI, scrubber, playback) defer to v0.1.7 pending an architectural decision:
- (A) Commandify aoe2 input — wrap every bridge method as a civ-engine command. Big refactor.
- (B) Diff-playback — ReplayController bypasses `SessionReplayer.openAt`, uses BundleViewer/diff-fold for tick-by-tick state reconstruction. ADR 10's step-based playback gets replaced.
- (C) Wait — ship migration only, decide architecture later.

The 11 iterations of bridge-state migration design remain load-bearing: diffs only capture `world.state` mutations, so the migration is the prerequisite for any future replay model AND independently delivers cleaner schema-2 saves + bridge-state visibility in BundleViewer/Hotspots.

## Claude BLOCKER — `clearUnitCommand` cannot be a replay no-op

`clearUnitCommand` is a STATE MUTATOR (deletes `unitCommands` and `movePathCache` Maps), not a UI side-effect. v11 listed it among `wireReplaySystems` no-op stubs. Gameplay systems call it in their execute closures — `playerCommandsSystem.ts` invokes it at ~20 sites per tick; stubbing leaves stale commands in replay state and breaks the §7 frame-by-frame equivalence invariant.

**Outcome:** v0.1.7 design will need to handle this correctly. For v0.1.6 (Phase A only), there is no `wireReplaySystems` — the replay path is deferred. Issue is recorded for the v0.1.7 architecture decision.

## Codex+Claude convergent MINOR — fingerprint cache lifecycle (recurring)

Iter-10 found this gap; v10/v11 partial fix; iter-11 found edges still uncovered (player-change cleanup pseudocode missing). Resolved at the v12 spec level by spelling out the active-loop player-change branch + removeSource cleanup + cache-key invariant.

## Codex MAJOR — `wireBridgeOps` body wording stale (recurring)

v11 said `wireBridgeOps` is unchanged for live path, but body text (line 865) still said "live `wireBridgeOps` calls `wireReplaySystems` and layers scenario seeding on top." Doc drift from v10. Resolved by scope reduction (no `wireReplaySystems` for v0.1.6).

## Claude MINOR — fingerprint cache duplicates engine's setSource short-circuit

`visibility-map.ts:55-62` already short-circuits no-op writes. The aoe2 fingerprint cache duplicates this logic to gate `cell.markDirty()`. Acknowledged: v0.1.7 cleanup could let `setSource` return a boolean and drop the cache. Out-of-scope for v0.1.6 since the cache isn't part of Phase A (no replay UI = no tier3SyncSystem performance gate needed; tier3SyncSystem still ships in Phase A but without the stringent "play smooth at 60 TPS" requirement).

Actually — tier3SyncSystem DOES ship in Phase A because the recorder needs to capture Tier-3 state in snapshots/diffs. The dirty-bit + fingerprint perf optimization stays in scope for Phase A.

## Claude NIT — setSource pseudocode shape doesn't match engine API

`setSource(player, sourceId, x, y, radius)` — actual API is `setSource(playerId, sourceId, source: VisionSource)` where `VisionSource = { x, y, radius }`. Pseudocode shorthand. Folded.

## v12 changes summary (scope reduction + recurring fixes)

1. **SCOPE: v0.1.6 ships Phase A only** (bridge-state migration). Phases B-F → v0.1.7. Top-of-doc note added explaining the iter-11 finding.
2. Phase A delivers: bridge-state migration, per-slot codecs, BridgeStateAccessor, tier3SyncSystem + bridgeSnapshotSystem, bootstrapFlush, schema-2 saves, schema-1 back-compat, createWorldSkeleton split, bridgeMeta slot, fingerprint-cache lifecycle for the visibility dirty bit.
3. Replay UI / scrubber / playback sections kept in DESIGN.md as forward-looking spec for v0.1.7+, marked accordingly.
4. PLAN.md (next) covers Phase A implementation only.

## Process notes for design-12 reviewer (and PLAN reviewer)

The design-12 review should focus on: (1) is Phase A standalone-coherent? (2) Does deferring replay UI introduce any latent gaps in the migration that would force a redo in v0.1.7? (3) Are the recurring lifecycle fixes (fingerprint cache, PersistedMatchState) sufficient for the migration alone?

The PLAN.md draft (next iteration) implements ONLY Phase A — bridge-state migration scaffolding, `BridgeStateAccessor` rollout to ops modules, codec table, `tier3SyncSystem` + `bridgeSnapshotSystem`, `bootstrapFlush`, save schema bump, schema-1 back-compat, equivalence invariant test. No ReplayController, no TimelinePanel, no scrubber UI. Estimated 5-7 phases of incremental commits, each landing on `main` with version bumps (0.1.5 → 0.1.6.1 → 0.1.6.2 → ... → 0.1.6).
