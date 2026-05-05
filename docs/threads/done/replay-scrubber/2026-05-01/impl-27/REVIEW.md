# impl-27 multi-CLI review — Phase 2E visibility staleness fingerprint cache (Codex impl-19 MAJOR retroactive fix)

**Date:** 2026-05-01
**Iterations:** 2 (initial + leak-cleanup hardening)
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `claude-opus-4-7[1m]` max, Gemini `gemini-3.1-pro-preview` plan-mode

## Summary

Retroactive fix for Codex impl-19 MAJOR: post-bootstrap, `aoe2.visibility` was permanently frozen at tick-0 state because the per-tick `visibilitySystem` called `visibility.setSource(...)` for every active source every tick but never told the `visibilityCell.markDirty()`. When any unit moved, the live `VisibilityMap` updated internally but the persisted Tier-3 snapshot did not — making save/load round-trip wrong for any non-stationary game state.

**Approach:** add a closure-scoped `VisibilitySourceFingerprint` cache (per-source `(playerId, x, y, radius)` snapshot) and only call `setSource` + `markDirty` when the fingerprint changed (or the source was added/removed). The same Map instance is shared between the bootstrap call in `registerBridgeSystems` and the per-tick `visibilitySystem` so post-bootstrap tick-1 sees the prefilled fingerprints and stays steady-state.

## iter-1 — initial fingerprint-cache plumbing

| Reviewer | Finding | Severity |
|---|---|---|
| Codex | Fingerprint missing `playerId`. Monk conversion (monkTaskAppliers.ts:209) and sheep-claim transfer (syncSheepVisionSource) mutate `visionSource.playerId` in place — the sync silently skips both, leaving the previous owner registered as a vision source for the same id (leak) AND never registering the new owner. | MAJOR |
| Claude | Same as Codex; traced the exact loop trace through syncVisibilitySources showing the no-op branch swallows the change. | MAJOR |
| Gemini | Same as Codex; flagged both the missing comparison AND the stale-old-owner cleanup separately. | MAJOR |
| Claude | Test coverage: existing 2 tests don't pin the playerId case. | MAJOR |

**iter-2 fix:**
- Added `playerId: number` to `VisibilitySourceFingerprint`.
- Equality check now requires `prev.playerId === source.playerId`.
- Owner-flip branch: `prev.playerId !== source.playerId` → `visibility.removeSource(prev.playerId, id)` BEFORE `setSource(source.playerId, id, ...)`. Cleans the leak.
- New tests: ownership-flip reference-change + post-flip stationary-tick re-stabilization.

## iter-2 review

| Reviewer | Finding | Disposition |
|---|---|---|
| Codex | MEDIUM: New flip tests pin reference change but not the structural removal of the old owner's `(playerId, sourceId)` entry. A regression that forgot the `removeSource` call would still pass test 3. | Addressed inline (see below). |
| Claude | MINOR: Same as Codex; called it a hardening opportunity, not a blocker. Verified the iter-2 implementation itself is correct end-to-end through trace + edge-case enumeration (P1→P2→P1, multi-source flip, destroy-during-flip, save/load). | Addressed inline. |
| Gemini | ACCEPT — "no bugs, security issues, or performance regressions found." Verified leak resolution + memory cleanup + dirty-bit optimization integrity. | Already converged. |

**iter-2 strengthening (folded into iter-2 commit, not a new iteration):**
- Replaced the flip test's `.toBe()`-only reference assertion with a structural assertion against `aoe2.visibility.players[*].sources`: pre-flip, the (player 1, unitId) entry exists; post-flip, that entry is gone AND a (player 2, unitId) entry exists. Closes both halves of the iter-1 finding.

## Verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npx vitest run tests/replay/ tests/simulation/aiPlayer.test.ts tests/simulation/monastery.test.ts tests/simulation/visibility.test.ts` (81 tests passed; 1 worker-timeout error = FU8 known Windows flake)
- `npm test` (710 passed + 1 skipped + 0 failed)
- `npm run build` ✓

## Disposition

iter-2 + structural test strengthening lands the impl-19 MAJOR fix end-to-end. Claude verdict "MERGE — not a blocker." Gemini ACCEPT. Codex flagged the test gap as MEDIUM and that gap is now closed by the structural assertion. Re-review unnecessary; commit folds these fixes in.
