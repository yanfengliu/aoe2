# Slice 4 — Replay file import — Iter 2

**Diff base:** `bc154f1` (slice 3 commit).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** ITERATE → both reviewers flagged the same `schemaVersion` gap (Codex called it IMPORTANT, Claude called it NIT). Fix applied; iter-3 verifies.

## Codex iter-2

### IMPORTANT — `schemaVersion` is still missing from the parser's required top-level fields (FIXED)

`SessionBundle.schemaVersion` is required by civ-engine, and `SessionReplayer.fromBundle` rejects missing values via `_verifyVersionCompat()`. But `ReplayController.enterReplay` exits any existing replay BEFORE constructing the replayer, so importing a JSON file missing top-level `schemaVersion` while already in replay mode partially applies (leaves replay mode without entering a new one). The "invalid input never partially applies" contract is violated for that input class.

**Fix applied:**
- Added `'schemaVersion'` as the first field of `REQUIRED_TOP_LEVEL`.
- Added a typed check `if (typeof obj.schemaVersion !== 'number')` returning `reason: 'schemaVersion is not a number'`.
- Updated test fixtures to put `schemaVersion: 1` at the top level (not nested under `metadata`).
- Added two regression tests: `missing field schemaVersion` and `schemaVersion is not a number`.

The "matches civ-engine SessionBundle exactly" comment now accurately reflects all 10 required fields.

Other iter-2 verification targets all checked out per Codex.

## Claude iter-2

### NIT — Same `schemaVersion` finding (FIXED via the fix above)

Claude noted that the absence is technically not a partial-apply for *fresh* (live → replay) entries because `_verifyVersionCompat` runs pre-swap. But Codex caught the replay-while-already-in-replay path where `exitReplay` runs FIRST, then the replayer construction throws — that IS a partial apply. The fix covers both cases by rejecting at the parser boundary.

### NIT — HUD button → `bridge.replayFromFile` wiring has no direct test

Optional. The button is stateless (no polling, no disabled-gate); the parser + helper paths are well-covered. Skipped for this slice.

### Disposition

> "**No substantive findings; ship slice 4.** Both NITs are advisory and neither blocks merge. The iter-1 IMPORTANT (post-swap iterable safety) is correctly closed: every array TimelinePanel/bundleHotspots iterates is now structurally validated before `enterReplay` is called. Iter-1 NITs (dispose, FileReader→file.text() comment, rejection test, TDZ comment) all landed accurately."

## Disposition

Codex's IMPORTANT addressed; Claude's NIT addressed by the same fix. Iter-3 verifies the schemaVersion fix landed correctly.

## Files changed by iter-2 fixes

- `src/game/replay/parseSessionBundleFile.ts`: `schemaVersion` added to `REQUIRED_TOP_LEVEL`; typed-number check added.
- `tests/replay/parseSessionBundleFile.test.ts`: 2 new regression tests; fixture moved `schemaVersion` to top level.
- `tests/ui/replayFileImport.test.ts`: fixture moved `schemaVersion` to top level.
- `docs/changelog.md`: footer count 852 → 854; description mentions top-level `schemaVersion`.
