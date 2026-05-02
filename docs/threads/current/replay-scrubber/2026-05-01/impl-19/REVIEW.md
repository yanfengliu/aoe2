# impl-19 multi-CLI review — Phase 2C bootstrapFlush + registerOutputTail integration

**Date:** 2026-05-01
**Branch:** main (uncommitted)
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `claude-opus-4-7[1m]` max, Gemini `gemini-3.1-pro-preview` plan-mode
**Diff scope:** ~182 LOC across 3 changed files: `bootstrapFlush.ts` (new), `wireBridgeOps.ts` (modified), `phase2cIntegration.test.ts` (new).

## Summary

Phase 2C narrow integration: the previously-isolated Phase 2A scaffolding (accessor + cell) and Phase 2B output-phase systems (registerOutputTail) are now wired into the live `wireBridgeOps`. `bootstrapFlush` writes the three Tier-3 slots (`aoe2.bridgeMeta`, `aoe2.matchState`, `aoe2.visibility`) once at construction. `registerOutputTail` is called after `registerCommandHandlers` so the production tick loop now flushes the Tier-1 accessor + writes Tier-3 every output phase.

The full Phase 2C per PLAN says "createWorldSkeleton + seedFreshTiles split + load paths + bootstrapFlush". This commit lands ONLY the bootstrap + tail wiring; `createWorldSkeleton` extraction (needed for Phase 3A's replay-world construction) is deferred.

## Reviewer findings (synthesized)

### Real issues addressed inline

| Finding | Source | Severity | Fix |
|---|---|---|---|
| `bootstrapFlush` conditionally skipped the visibility write when cell wasn't dirty — bootstrap contract should be unconditional ("aoe2.visibility always populated before tick 1") | Claude F2 | MINOR | Removed the `consumeIfDirty()` gate at bootstrap; now writes unconditionally and calls `markClean()` to set up the post-bootstrap clean state. Symmetric with the matchState/bridgeMeta unconditional writes. |
| `matchState.scores` reference aliased between live `matchState` and persisted `world.state.aoe2.matchState` slot — future in-place mutation `matchState.scores[ownerId] = N` would retroactively rewrite the persisted snapshot | Claude F3 | MINOR | Shallow-clone `scores` at the persistence boundary in both `bootstrapFlush.ts` and `tier3SyncSystem.ts`. Pattern: `scores: matchState.scores ? { ...matchState.scores } : null`. |
| Test 4 ("matchState reference changes per tick") was a weak proxy — passes for any caller that constructs a fresh literal, not specifically tier3SyncSystem | Claude F4 | MINOR | Strengthened test to also assert content equality with `bridge.getMatchState().outcome`, proving it was specifically the tier3SyncSystem output. Added a 5th test pinning the visibility-stability invariant (reference identity preserved across clean ticks until Phase 2E lands). |

### Acknowledged / deferred

| Finding | Source | Status |
|---|---|---|
| Instantiation order limits Phase 2D — accessor/cell are constructed at the END of `wireBridgeOps`; Phase 2D ops modules will need them earlier | Gemini F1, Claude F6 | DEFERRED — flagged for Phase 2D. Construction reordering happens then because no ops module currently consumes the accessor. |
| Stale visibility after tick 1 | Gemini F2, prompt | ACCEPTED — design tradeoff, addressed by Phase 2E's syncVisibilitySources fingerprint cache. The new visibility-stability test pins the current behavior. |
| Save-load path not test-covered | Claude F1 | ACCEPTED — bootstrapFlush correctly captures post-hydrate state per the wireBridgeOps order; a load-path regression test is worth adding when Phase 2D touches load paths. Not a Phase 2C blocker. |
| `accessor.flush()` no-op at bootstrap | Claude F5 | NIT — kept for symmetry with future Phase 2D calls. |

### Codex unreachable

Same failure mode as impl-16 / impl-17 / impl-18. Per AGENTS.md fallback, proceeded with two reachable reviewers (both substantive).

## Verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npx vitest run tests/replay/` (31 tests passed)
- `npm test` (698 passed + 1 skipped, matching Phase 2B baseline + 5 Phase 2C tests)
- `npm run build` ✓

## Disposition

All real findings addressed inline. Single iteration sufficed — Gemini ACCEPT-with-forward-looking-flag, Claude 4 minor findings (3 addressed, 1 deferred to Phase 2D). Re-review unnecessary; commit folds these fixes in.
