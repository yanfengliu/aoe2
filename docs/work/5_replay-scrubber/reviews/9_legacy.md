# Replay Scrubber Design Iter-10 Review

**Date:** 2026-04-30
**Iteration:** design-10 → produces design-11
**Reviewers:** Codex `gpt-5.5` xhigh + Claude `claude-opus-4-7[1m]` max
**Disposition:** ITERATE (Codex MAJOR + 2 MINOR; Claude MAJOR + 2 NIT — convergent on fingerprint-cache lifecycle gap and PersistedMatchState cast inconsistency; Codex separately flagged wireReplaySystems framing)

## Convergent MAJOR — fingerprint cache lifecycle gap

Both reviewers caught: v10's `syncVisibilitySources` fingerprint cache only handled the active-source loop. Existing sync also has a removeSource loop (`bridge/visibility.ts:158-164`) plus gameplay player-change scenarios (monk conversion at `monkTaskAppliers.ts:194`, sheep claim flip at `trainingMarketOps.ts:279`).

**Claude's detailed scenario:** sheep claimed by player A, claimer dies, sheep becomes ownerless, removeSource runs but fingerprint stays. Sheep re-claimed by A at same position → fingerprint matches → setSource skipped → engine `sources[A]` still empty for that source → permanent visibility regression.

**Fix in v11:** §5.2 spells out the full lifecycle:
- Active loop adds/updates fingerprint as before.
- RemoveSource loop calls `fingerprints.delete(\`${playerId}:${id}\`)` mirroring trackedSources cleanup; sets `cell.markDirty()`.
- Player-change cleanup: when tracked source's playerId differs from current owner's, treat as remove + re-add.
- Cache-key invariant: `fingerprints.has(key) ⟺ trackedSources.has(sourceId) AND trackedSources.get(sourceId) === currentPlayerOf(sourceId)`. Plan-stage will verify against conversion + sheep-claim test fixtures.

## Codex MAJOR — `wireReplaySystems` framing didn't account for live-path ordering

v10 said "live `wireBridgeOps` calls `wireReplaySystems` then layers scenario seeding on top." But current live flow runs `seedFreshScenario` (line 196) BEFORE `wirePostSeedOps` (line 240) BEFORE `registerBridgeSystems` (line 324). Live path can't simply "call wireReplaySystems then seed."

**Fix in v11:** simplified — `wireReplaySystems` is a STANDALONE replay-only helper, NOT an extracted shared core. It constructs minimal ops + calls `registerBridgeSystems` + `registerOutputTail` with no-op stubs for UI side-effect deps. `wireBridgeOps` is UNCHANGED — continues its existing pipeline for the live path. Small duplication (~30 LOC of gameplay-ops construction overlap) accepted; future plan-stage refactor can dedupe via a `gameplayOps(world, ...)` helper if worth the churn.

## Codex+Claude MINOR — `PersistedMatchState` cast inconsistent

v10 introduced `PersistedMatchState` and updated §5.3's cast, but §5.6 PATH B/C and ADR 4 still cast as `SerializedMatchState`.

**Fix in v11:** all four sites use `as PersistedMatchState | undefined`. ADR 4's schema-1 migration strips legacy stored derived fields via a new `stripDerivedFields(savedGame.matchState)` helper before writing.

## Other findings cross-checked clean

Both reviewers verified iter-9 fixes that landed correctly:
- `world.registerSystem(...)` is the correct API (`civ-engine/src/world.ts:646-661`); `registerOutputTail` uses it. ✓
- `PersistedMatchState = Omit<SerializedMatchState, 'wonderCountdownTicks' | 'relicCountdownTicks'>` typechecks against `saveSchema.ts:231-238`. ✓
- The destructuring `const { wonderCountdownTicks: _wc, ... } = m; return rest;` typechecks as `PersistedMatchState`. ✓
- No civ-engine API changes required. ✓
- v10's stated BLOCKER fix (createReplayWorldOnly without systems) addressed correctly. ✓
- All iter-1..8 fixes preserved (bootstrapFlush, matchState pre-skeleton, VisibilityCell indirection, createWorldSkeleton split + bridgeMeta, tier3SyncSystem, ordering test asserting last-two = `['tier3Sync', 'bridgeSnapshot']`). ✓

## v11 changes summary

1. **Fingerprint cache lifecycle** — removeSource loop drops fingerprints; player-change scenarios spelled out; cache-key invariant stated.
2. **`wireReplaySystems` standalone helper** (not shared-core extraction) — `wireBridgeOps` unchanged for live path.
3. **`PersistedMatchState` cast normalized** in §5.6 PATH B/C + ADR 4.

## Process notes for design-11 reviewer

- v11 diff vs v10: §5.2 fingerprint pseudocode expanded; v11-deltas paragraph clarifies wireReplaySystems standalone framing; §5.6 + ADR 4 cast updates.
- Verify the fingerprint cache-key invariant holds against the conversion + sheep-claim flip + garrison/ungarrison cycle scenarios.
- Verify wireReplaySystems duplicated-ops ~30 LOC is acceptable, OR plan-stage extracts `gameplayOps` helper.
- Both reviewers should converge to ACCEPT this round; v11 closes the iter-10 issues. Remaining findings should be plan-stage fold-ins.
