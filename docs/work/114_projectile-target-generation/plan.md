# A shot hits only the entity it was aimed at

Status: complete
Owner: Claude session from the task card 'Check a projectile's building target by generation' (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-11

## Problem and outcome

A shot in flight names its target and its shooter by bare entity id (`targetId` and `attackerId` in `src/game/simulation/bridge/projectileTypes.ts`). `resolveOne` in `projectileOps.ts` records the hit and calls `deps.damageBuilding(shot.targetId, ...)` (wired in `registerAllSystems.ts`), which damages whatever building holds that id at impact. civ-engine hands a freed id to the next entity it creates, as the `shooterRef` comment in `projectileOps.ts` already says. So if the target dies while the shot is in the air and a new building takes its id, the shot damages the new building, possibly another player's. The independent review of the building-sight change found it (`docs/threads/done/building-vision/2026-09-25/2/REVIEW.md`, "seen on the way").

Outcome: a shot affects only the entity it was aimed at, checked by generation, and this holds through save, load and replay.

## Scope

Included: every entity a shot names by bare id (a target building, unit or animal, and the shooter), the projectile slot's save and replay format, and saves and recordings made before the change whose shots in flight carry no generation.

Reserved for this work while the six task cards of 2026-10-10 run: `projectileOps.ts`, `projectileTypes.ts`, the damage wiring in `registerAllSystems.ts`, and the save and replay format (`bridgeStateSerialize.ts`, `hydrateFromSavedGame.ts`, `hydrateFromWorldState.ts`, and the legacy save and replay fixtures). Another card whose fix needs a save-format change waits for this one to land.

Excluded: projectile flight, looks, blast width and falloff (Codex work 106, milestone M2, unassigned), and the held save/load/replay acceptance branch (work 106, milestone M7, unmerged). civ-engine is read, never modified.

## Approach

Store the target's and the shooter's generation with the shot (the codebase already uses `getEntityRef`), and drop a shot whose target is no longer the same entity. A shot loaded from an older save or recording has no generation; state what it does then as a bound. The batch protocol, covering the worktree, reserved files and the gate lock held from the final rebase through the push, is in `docs/policies/local-rules.md`.

## Acceptance criteria

- A test first reproduces a shot damaging an entity that took its dead target's id. It passes after the fix, and putting the bare-id check back turns it red.
- Saves and recordings made before the change still load and replay. A save made after it round-trips a shot in flight with its generations.
- An independent read-only review of the exact revision is recorded in `reviews/`, because persistence is high-risk.
- The change carries a defect-register entry and a spec rule. It gets a changelog line and a version bump if a player could see the wrong entity hit. `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed.

## Implementation steps

- [x] Reproduce, fix and gate, with independent review rounds 0 and 1 in `reviews/`. Nothing here waits for the other five cards.
- [x] Land: the version, `npm run verify` under the gate lock, the merge to main and the push.

## Outcome

Complete. Shipped in v0.3.247 and pushed to main as `c4775faa` (the fix), `9649746f` (review round 0's repairs), `3c060331` (review round 1's repairs) and `47cdcf1b` (the release), on top of `20f1f4ab`.

- **Result.** A shot keeps its shooter's and its target's generation through saves and recordings. It deals nothing to an entity that took its target's id, and spares from its blast, or turns an animal on, only the unit that loosed it. Spec §10.4 holds the rule and its bound; the register entry of 2026-10-11 holds the defect.
- **Checks.** `npm run verify` exited 0, read from its exit file, on the gated tree `b6e6903b` under the gate lock: 09:33:49 to 09:55:50 on 2026-10-11, with 577 unit test files passed and 1 skipped (4,442 tests passed, 3 skipped) and 236 browser tests passed. The push was refused once, by work 117's docs-only close-out `20f1f4ab`; the landed tree differs from the gated one only in that commit's `docs/work/117_vietnamese-reveal-centre/plan.md`, so only `workDocsIntegration.test.ts` and `checkoutLineEndings.test.ts` were run again (9 passed). Mutations M1 to M8 turn the new tests red as `reviews/0_implementation.md` and `reviews/1_implementation.md` record.
- **Review.** Round 0 (Codex `gpt-6-astra` and Claude `claude-opus-5-5[1m]`, read-only) and round 1 (Claude's focused re-review of the repair) found no blocker; every finding, F0 to F13, was taken. They reviewed `2d78480e` and `0614439d`, which landed as `c4775faa` and `9649746f`; round 1's own repair `9bb08b8c` landed as `3c060331`. Each landed commit's diff under `src/` and `tests/` is byte-identical to the one reviewed (SHA-256 `7e5999d4…`, `5c3c1053…` and `e3609008…`), and the rebases changed only documents where works 115, 117 and 119 had written beside this one.
- **Limits.** No full match was played with the change, and the cost of the check, one `isCurrent` per landing shot, was not measured. No bundle recorded by an older build exists to replay; old recordings and saves were stood in for by stripping the fields. A shot already in the air in an older save or recording resolves by bare id for the rest of its flight, and re-simulating an older recording makes `selfCheck` report a divergence at every snapshot that holds a shot loosed since the one before, both as spec §10.4 states.
