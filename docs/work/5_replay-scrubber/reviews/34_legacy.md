# impl-18 multi-CLI review — Phase 2B output-phase tail (tier3SyncSystem + bridgeSnapshotSystem + registerOutputTail)

**Date:** 2026-05-01
**Branch:** main (uncommitted)
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `claude-opus-4-7[1m]` max, Gemini `gemini-3.1-pro-preview` plan-mode
**Diff scope:** ~342 LOC across 5 new + 1 modified file: `tier3SyncSystem.ts`, `bridgeSnapshotSystem.ts`, `registerOutputTail.ts`, `outputTail.test.ts`, `saveSchema.ts` (added `PersistedMatchState` + `serializeMatchStateForWorldState`).

## Summary

Phase 2B wires the output-phase tail that flushes the accessor and writes the Tier-3 slots to `world.state` so the recorder's diff-listener snapshot (fired AFTER the output phase) sees current values. **No existing systems migrated yet** — `registerOutputTail` is exported but not yet called from `wireBridgeOps` (Phase 2D wiring + Phase 2C's `bootstrapFlush` are the integration points). Purely additive.

## Reviewer findings (synthesized)

### Real issues addressed inline

| Finding | Source | Severity | Fix |
|---|---|---|---|
| Order test does NOT prove tier3Sync runs between control and snapshot — trace only records control + snapshot, so tier3Sync could legally have run anywhere in the output phase and the test would still pass | Claude F1 | MEDIUM | Wrapped `visibilityCell.consumeIfDirty` so tier3Sync's execute pushes its name to the trace; assertion now `expect(trace).toEqual(['controlOutput', 'aoe2Tier3Sync', 'aoe2BridgeSnapshot'])`. Strict ordering pinned. |
| Per-tick double allocation in tier3SyncSystem (built `serialized: SerializedMatchState` literal only to immediately strip 2 fields and copy the other 4 into a fresh PersistedMatchState) | Claude F2 | LOW (perf) | Inlined the 4-field PersistedMatchState literal directly; removed the intermediate SerializedMatchState construction. One allocation per tick instead of two. |
| Closure-captured `visibilityCell` / `matchState` contract not explicit. `_map` was `readonly`, so a future Phase 2C/3A swap would orphan the closure | Claude F3 | LOW (architecture) | Made `_map` non-readonly; added `VisibilityCell.replace(next: VisibilityMap)` so the cell identity stays stable across map swaps (auto-marks dirty). Added explicit closure-contract JSDoc comment to `tier3SyncSystem` documenting the matchState in-place mutation invariant + the `cell.replace` requirement. |
| Visibility no-write branch not actually verified by the test | Claude F4 | LOW (coverage) | Tightened the dirty-flag test: capture `world.getState(TIER_3_SLOTS.visibility)` ref after tick 1, step a clean tick 2, assert the reference is the same; mark dirty before tick 3, assert the reference changes. |

### ACCEPT — no action

Gemini ACCEPT (no findings, anti-regression checklist all green).

### Codex unreachable

Same failure mode as impl-16 / impl-17. Codex's exec sandbox produced output but emitted no structured findings. Per AGENTS.md fallback, proceeded with two reachable reviewers.

## Verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npx vitest run tests/replay/` (26 tests passed)
- `npm test` (693 passed + 1 skipped, matching Phase 2A baseline + 4 outputTail tests + 1 mapOfMap test added in Phase 2A iteration)
- `npm run build` ✓

## Disposition

All real findings addressed inline. Single iteration sufficed — both reachable reviewers converged on substantive issues that were fixable without restructuring (Gemini ACCEPT, Claude 4 medium-to-low findings all addressed). Re-review unnecessary; commit folds these fixes in.
