# Slice 4 — Replay file import — Iter 3

**Diff base:** `bc154f1` (slice 3 commit).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** CONVERGED → Codex iter-3 IMPORTANT closed via a controller-level restructure that addresses the entire partial-apply bug class. Claude says ship.

## Codex iter-3

### IMPORTANT — Parser still accepts incomplete metadata that crashes after `exitReplay()` (FIXED via controller restructure)

> "`SessionMetadata` requires `engineVersion`, `nodeVersion`, `recordedAt`, `persistedEndTick`, `durationTicks`, `sourceKind` too. `_verifyVersionCompat()` calls `md.engineVersion.split(...)` and crashes after `enterReplay` already called `exitReplay()`. Same partial-apply class as the iter-2 schemaVersion gap."

The right fix is structural, not per-field: `enterReplay` was exiting any existing replay BEFORE attempting to construct the new `SessionReplayer`. Any engine-level rejection (missing engineVersion, schemaVersion mismatch, range violation, etc.) silently dropped the user from their current replay session.

**Fix applied:** `ReplayController.enterReplay` now constructs the new replay context (replayer, world, bridge, command index) BEFORE any state mutation. The flow is:

```
enterReplay(bundle, atTick):
  // Build the new replay context — any throw leaves the controller unchanged.
  const replayer = SessionReplayer.fromBundle(bundle, ...)
  const world = replayer.openAt(targetTick)
  const bridge = buildReplayBridge(world)
  const nextContext = {...}

  // Construction succeeded — safe to mutate from here.
  if (mode === 'replay') exitReplay()
  ...
  bridgeCell.replace(bridge)
  ...
```

This closes the entire partial-apply bug class for `enterReplay`, regardless of which engine validation triggers the rejection. Per-field parser validation becomes a UX optimization rather than a correctness requirement.

Added a regression test `preserves an existing replay session when enterReplay throws on a bad bundle` to `ReplayController.rollback.test.ts` that uses a stub `worldFactory` to fail construction on demand and asserts the original replay session is preserved (`mode === 'replay'`, `currentTick` unchanged, bridge reference unchanged).

## Claude iter-3

### "Ship slice 4."

Verified the iter-3 schemaVersion fix landed correctly (REQUIRED_TOP_LEVEL has 10 fields matching civ-engine `SessionBundle` exactly; typed-number check; two new regression tests; iter-1 + iter-2 fixes intact).

Three NITs:

1. **Ordering of typed-number check** — `typeof obj.schemaVersion !== 'number'` runs AFTER metadata checks; could move adjacent to the `REQUIRED_TOP_LEVEL` loop. Trivial; left as-is.
2. **Wrong-VALUE schemaVersion still partial-applies** — a bundle with `schemaVersion: 999` passes the parser but is rejected by `_verifyVersionCompat`. Closed by the controller restructure (Claude reviewed before that fix landed).
3. **Changelog footer count off by 1** — Claude counted 855 vs the document's 854; updated to 855 to match the post-controller-restructure count.

## Disposition

Convergence reached. Slice 4 commits as is.

The controller restructure also benefits future slices: any engine-rejected bundle (file import, prior session, current session) preserves the user's current replay state. This was a single ~10-line edit that retired three review iterations' worth of partial-apply concerns at the parser boundary.

## Files changed by iter-3

- `src/game/replay/ReplayController.ts`: `enterReplay` restructured so bundle validation/construction happens before any state mutation (exitReplay, setPaused, bridge swap).
- `tests/replay/ReplayController.rollback.test.ts`: new regression test `preserves an existing replay session when enterReplay throws on a bad bundle`.
- `docs/changelog.md`: footer count 854 → 855; description widened to mention the two-layer transactional guarantee (parser + controller).
