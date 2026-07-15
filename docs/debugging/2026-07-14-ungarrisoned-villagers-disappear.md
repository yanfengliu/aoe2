# Debugging session — ungarrisoned villagers disappear

## Symptom

The user reported on 2026-07-14 that villagers disappeared after being ungarrisoned in the live voxel-only game.

## Expected vs actual

- Expected: every surviving villager released from a garrison receives a legal free visual slot near the building and reappears in simulation projection and the voxel renderer.
- Actual: the user observes the villagers disappear after issuing Ungarrison.

## Reproduction

- Start from the existing garrison fixtures and inspect authoritative entity/component, occupancy, render projection, and presented state before garrison, while garrisoned, and after ungarrison.
- Use headless browser coverage only after the engine/bridge state establishes whether the unit exists and is projected.

## Hypotheses

- [x] Refuted for ordinary release: ungarrison restores the same entity identity, position, transform, and vision source, and all released units reach render projection and the presented instance set.
- [x] Confirmed at capacity: ungarrison used ordinary occupancy synchronization, so a 20-villager Castle release exhausted one cell's 16 visual slots and permanently stacked four overflowed villagers under peers.
- [x] Refuted: owner entities bypass fog filtering and the render store correctly republishes the same generation after its position returns.

## Investigation log

- 2026-07-14 20:31 PDT — Opened the engine/bridge, projection, and headless browser traces in parallel. Worktree was clean apart from the pre-existing unreadable `.pytest_cache` warning; localhost port 5173 remained active.
- 2026-07-14 20:34 PDT — `WorldDebugger` and direct component inspection proved a normal three-villager Town Center round trip retained all three units, positions, transforms, vision sources, and render entities. A full Castle round trip retained 20 entities but left all 20 on one coarse cell, produced only 16 unique projected roots, and marked four transforms as `occupancySlotOverflow` indefinitely.
- 2026-07-14 20:36 PDT — Headless Chromium proved the ordinary symptom was real presentation occlusion: all three Town Center villagers returned to `(8,7)` roots behind the building and none was visible after selection cleared, despite economy, render, displayed-entity, and animated-instance counts all restoring correctly.
- 2026-07-14 20:39 PDT — Added two red contracts. The Town Center test failed because the tracked villager did not use the south/east exit; the full-Castle test failed because every released villager retained the same coarse cell. The pre-fix focused run reported two failures, three passes, and 14 skips.
- 2026-07-14 20:43 PDT — Routed ungarrison through the existing `placeUnitForSpawn` occupancy contract, propagated its actual cell and slot metadata through the transform boundary, and ordered building exits by deterministic authored south/east depth. The focused garrison run then passed five tests with 14 skips.
- 2026-07-14 20:46 PDT — Rebuilt the production bundle and passed the focused headless Chromium test. An identical three-villager visual rerun showed all three roots in front of the Town Center at `(12.25,11.75)`, `(12.5,11.75)`, and `(12.75,11.75)`.
- 2026-07-14 20:47 PDT — Extended the Castle regression through a garrisoned save/load boundary; original and restored bridges now produce identical 20-villager positions, render roots, and transforms with no overflow.
- 2026-07-14 21:12 PDT — External Codex iteration 1 found that foreground ordering also affected training and that the fresh-placement fallback stopped at cardinal neighbors. Scoped the ordering flag to ungarrison and reused the existing eight-direction radius-16 spiral; the diagonal regression failed before and passed after the change.
- 2026-07-14 21:18 PDT — External Codex iteration 2 found that total search exhaustion still released an overflowed unit. Changed fresh placement to return `null`, release its provisional claim, and retain failed units in the garrison.
- 2026-07-14 21:27 PDT — Final local reviewers required caller-level exhaustion/retry coverage, exact `id:generation` proof, accurate occupancy comments, and the v0.2.4 active-roadmap state. Added or corrected each item; four focused files then passed 42 tests.

## Root cause

`findBuildingSpawnPosition` enumerated the perimeter in row-major order, so the first safe cell was normally the north/back edge; the fixed voxel camera then depth-occluded every released root behind the building. Separately, `ungarrisonBuilding` restored every unit through `setPositionAndSyncOccupancy`, whose ordinary movement-oriented `syncUnit` contract intentionally accepts last-resort overflow rather than redirecting. A 20-villager Castle release therefore requested one cell 20 times, exhausted its 16 subcell slots, and left four persistent root collisions. The fresh-placement API already existed specifically for spawn/train/ungarrison but had no production caller.

## Fix

Ungarrison now requests the authored south/east exit before other safe perimeter cells, while trained-unit spawn ordering remains unchanged. It uses a bridge-world-only `placeFreshSpawnUnit` transform operation backed by `worldOccupancy.placeUnitForSpawn`; the operation writes the returned `placedAt`, persists the assigned slot, and snaps the released unit's fine transform once. Fresh placement searches the existing deterministic eight-direction spiral to a 16-cell radius. If that search is exhausted, it clears its provisional overflow claim and returns no placement so the unit remains contained. Ordinary movement synchronization and scenario fixture overlap behavior remain unchanged.

## Verification

- Red-to-green focused simulation proof: the final focused set passed 42 tests across four files, covering ordinary and capacity release, diagonal and exhausted allocation, caller containment, retry, exact render identity, and save/load parity.
- Focused headless production-browser proof: one live Town Center garrison/ungarrison test passed after rebuilding the preview bundle.
- Fixed visual evidence: `output/playwright/ungarrison-repro-after-clear-selection.png`, `ungarrison-fixed-after-clear-selection.png`, and `ungarrison-visibility-pixel-diff.png`. Pixelmatch found 16,384 / 480,000 changed pixels (3.4133%) in a 429x140 bounding box; the diff includes the three newly visible villagers and terrain revealed by their restored vision.
- Both dependency audits reported zero vulnerabilities. `npm run verify` passed in 375.4 seconds: content validation, 266 Vitest files with 2,022 passed and two skipped tests, 106 passed and two skipped serial headless Chromium tests, lint, typecheck, and a 529-module production build. Three in-process reviewers approved, two completed external Codex iterations drove fixes, a third Codex attempt timed out before producing a final review, and Claude Code was blocked before execution by tenant private-source export policy.

## Follow-ups

- Keep the visual proof scoped to exit placement. Reintroducing the retired through-building x-ray would be a separate renderer feature and is not required for this fix.
