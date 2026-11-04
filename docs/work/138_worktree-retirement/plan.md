# Retire the leftover aoe2 worktrees without losing their work

Status: active
Owner: worktree-retirement worker for the Claude coordinator
Created: 2026-11-04
Updated: 2026-11-04

## Problem and outcome

On 2026-11-04 the coordinator's repo review found 18 worktrees of this repo on disk besides the primary checkout: 17 under `../aoe2-worktrees` and a detached checkout at `C:/Users/38909/Documents/worktrees/vite-consumers/aoe2`. Every HEAD was in main, and 15 of them held uncommitted work. The owner called 18 leftover worktrees outrageous. The canon (R7) counts a merged worktree left on disk as a defect. [The worktree rule](../../policies/rules/worktrees.md) records what may be kept: everything useful reaches main (2026-09-29), and temporary archives without a plan to reuse them go (2026-10-18).

M1's outcome: all 18 are gone, removed through `scripts/controlWorktree.mjs` only, and nothing was lost. Each worktree's uncommitted state is a `retained/<name>` branch, checked byte for byte. The ignored files that an open plan, an OPEN register entry or the visual gallery cites are copied, with manifests, to the primary's `tmp/worktree-retirement-20261104/`. Whether each retained branch lands or is dropped is the owner's call; the decision table below gives a recommendation for each. M2 adds a check that stops leftovers piling up again.

## Scope

- M1: inventory, classification, retained branches, cited ignored evidence, removal of the 18 worktrees and their branches, the three stash entries, the two remote branches, and these records. M1 replaces [work 129](../129_codex-lane-retirement/plan.md)'s M2 retirement of five checkouts.
- Not in M1: landing or dropping a retained branch; dropping a stash entry whose content main lacks; deleting a remote branch (an outward-facing action); the primary's own `tmp/`; the peer worktree `ci-flakes-1104`; fixing `controlWorktree.mjs` (work 113).
- M2, a separate assignment: the leftover-worktree check described in the design note below.

## Approach

All reads were read-only, and every git call into a foreign worktree used `--no-optional-locks`, so `status` could not rewrite its index. The scripts and their outputs are kept for M2 in the primary's `tmp/worktree-retirement-20261104/work138-run/` (55 files, 6.0 MB): the inventory, the classification, each retained branch's record, the census log and the link checks.

1. Activity. Skip a worktree with activity in the last 24 hours: a non-ignored file, its index or its HEAD modified, or a process whose command line names it (`Get-CimInstance Win32_Process`).
2. Classification. Every uncommitted blob was tested against the 14,295 blobs reachable from main at `61758598` (`git rev-list --objects main`), for the staged layer and for the working tree. Untracked directories were expanded to files. Every tracked file was hashed, not only the stat-dirty ones, so a file that differs only in line endings is seen too.
3. Retention. `retained/<name>` has two commits. The first is parented on the worktree's HEAD and holds its real index, written from a copy of the index file. The second holds every non-ignored file as raw bytes, made with `git add -A` into a second index copy, then each entry whose staged blob differed from the file's bytes was replaced by a raw blob (`hash-object -w --no-filters`). The branch was created with `update-ref` and an empty old value. A script then checked that commit 1 equals the real index entry for entry, and that commit 2 holds exactly the present non-ignored files, compared byte for byte with `git cat-file --batch`. It also checked that the real index file's SHA-256 and HEAD were unchanged. The check ran again just before each removal.
4. Ignored files. Each worktree's ignored files were listed by top directory, without following a link. A file was kept when an open plan's `plan.md` or `design.md`, or an OPEN register section, cites its SHA-256, its path or its name, or when the gallery links it. The node_modules junction, `dist/`, `generated/` and `test-results/` are regenerable and were not considered. Kept files were copied, never through a link, with a manifest per worktree (path, bytes, SHA-256, reason), and the copies were reread against their sources and the manifest.
5. Removal. For each worktree: a dry run, then the real run, with `--discard-changes` only after steps 3 and 4 were verified. After each removal, a census of `../civ-engine/src`, `../civ-engine/.git`, `../voxel` (`src`, `dist`, `.git`) and the primary's `node_modules` was compared with the census taken before the first removal.

## Acceptance criteria

- [x] `git worktree list` shows only the primary checkout, this work's worktree (until it is removed) and the peer's `ci-flakes-1104`, and no branch of a removed worktree remains.
- [x] Every worktree with unique content has a `retained/<name>` branch whose commits equal its index and every non-ignored file byte for byte, checked at creation and again just before removal.
- [x] Every ignored file that an open plan, an OPEN register entry or the gallery cites is copied and verified against a manifest. Every local link in `tmp/visual-gallery/index.md` resolves after the removals.
- [x] Every removal ran through `controlWorktree.mjs` after a dry run, and the census of the protected trees was unchanged after each one.
- [x] The stash entry recorded as landed was dropped only after its content was shown to be in main. The other two stash entries and both remote branches are reported and left in place.
- [ ] M2: `npm run ci:status` (or a check it runs) reports leftover worktrees, with exemptions named, and a planted leftover turns it red.

## Implementation steps

- [x] M1, 2026-11-04: inventory, classification, 15 retained branches, 73 evidence files copied, 18 worktrees and 17 branches removed, the gallery's 15 links repointed, one stash entry dropped, and these records.
- [ ] M2: the leftover-worktree check (design note below), assigned separately.
  - [x] M2a, 2026-11-04: work 135's M30 records landed from `retained/head-jaw-m30-1020`, which was then deleted, and plan 97 got its status audit.
  - [ ] M2b: the check in `npm run ci:status`.

## Outcome

**M1, done 2026-11-04.** Every worktree was inactive. No non-ignored file, HEAD or branch reflog in any of them changed after 2026-10-31, and no process command line named one. Two indexes changed at 07:42:46 UTC on 2026-11-04: `refined-buildings-preview-1017` and `refined-voxel-art-1017`. The coordinator confirmed this was its own audit, a plain `git status` loop that started at 07:42:30. All 15 worktrees with uncommitted state held content that is not in main's history, so all 15 got a retained branch. Both checks passed with zero problems: 37,257 files (486 MB) were compared byte for byte at creation, and the recheck before removal found the same files. `software-culling-proof-1017`, `work136-ui-baseline` and the vite-consumers checkout were clean.

Removals: all 18 ran through the controller after dry runs, and every protected-tree census matched the baseline. `parity-gameplay-0930` held three junctions whose targets were inside its own tree. The controller removed it, then exited 1 with "STOP. A former link target lost entries", because those self-targets were deleted with the tree; this is work 113's known defect. The targets were all under the removed tree's own `tmp/parity-106/dependencies/install-mirror/`, the external census was unchanged, and `delete-branch parity-gameplay-0930` then removed the branch (exit 0). `../aoe2-worktrees` now holds only this work's worktree and the peer's.

Checks: the scripts above (exit 0), `controlWorktree.mjs` exit codes (all 0 except the explained `parity-gameplay-0930` STOP), the census after each removal, and the gallery link check. Documentation checks are in the devlog entry. No product code changed, so no full gate ran.

Not checked: process working directories, because `Win32_Process` has no current-directory property and reading it from process memory was refused. The ignored files that went with the trees were matched only by digest, path or name against open plans, OPEN register sections and the gallery, not read file by file. A citation in other words would have been missed.

**M2a, done 2026-11-04.** `180e894c` landed what `retained/head-jaw-m30-1020` held: plan 135's M30 head and jaw outcome, review rounds 86 to 89, the devlog rows, and the spec sentence that records the owner's grant of the three unspent M30 attempts and its limits. That sentence records what work 135 decided and adds no game rule, so it landed. The devlog and plan 135 were merged with main's later lines, keeping both sides. Reviews 86 to 88 each ended in one CRLF, which the line-ending gate refuses in new text, and are now LF. `npx vitest run tests/architecture` passed before the commit (rc 0, 16 files, 152 tests).

The proof, by a read-only script run against main at `180e894c`, exit 0:
- The branch changes 8 of its 2,681 files against its base `3eaf656e`, which main contains, so the other 2,673 are in main's history.
- Its working-tree commit `57f50d79` differs from its index commit `4d3b36bf` in one file, the detailed devlog, and only by line endings. The staged LF copy superseded it.
- The spec and review 89 are byte-equal in main. Reviews 86 to 88 are equal once their CRLF is LF.
- In the summary, the detailed devlog and plan 135, every line the branch added is in main (1, 2 and 5 lines), and the one line it replaced, the summary's older M30 row, is gone.
- Control: the same script run against the pre-landing main `e3838338` exits 1 and names all 8 files.

The branch was then deleted with `git update-ref -d refs/heads/retained/head-jaw-m30-1020 57f50d79f481df4853e1708f9111e25bbd461691`, exit 0. Fourteen `retained/*` branches remain for the owner. The script and its two logs are in the primary's `tmp/worktree-retirement-20261104/m2a/`.

Plan 97 is still open. Nothing landed or was retried since its 2026-10-10 audit, while releases v0.3.244 to v0.3.258 changed the game under it. Its 2026-11-04 audit and its thread's status line say what is left: the owner-1 boot-map reading and the decision to retry or close.

## Inventory, 2026-11-04 08:12 UTC

"Entries" counts `git status --porcelain` lines, with an untracked directory as one. Times are UTC. The newest ignored file in any of them was modified on 2026-10-31.

| Worktree | Branch | HEAD | Entries | Newest non-ignored file | Index | HEAD file |
|---|---|---|---|---|---|---|
| branch-completion-1017 | branch-completion-1017 | 1dc71788 | 65 | 2026-10-18 14:18 | 2026-10-18 02:18 | 2026-10-17 19:52 |
| coverage-consumer-1001 | codex/coverage-consumer-1001 | 10c26f52 | 13 | 2026-10-01 10:05 | 2026-10-01 09:34 | 2026-10-01 09:34 |
| detailed-world-1017 | detailed-world-1017 | 1dc71788 | 47 | 2026-10-18 06:46 | 2026-10-18 06:09 | 2026-10-18 04:49 |
| head-jaw-m30-1020 | codex/head-jaw-m30-1020 | 3eaf656e | 8 | 2026-10-21 06:10 | 2026-10-21 06:11 | 2026-10-21 05:44 |
| lean-ui-1017 | lean-ui-1017 | 1dc71788 | 200 | 2026-10-18 16:46 | 2026-10-18 16:47 | 2026-10-18 04:49 |
| living-art-1018 | living-art-1018 | 1dc71788 | 46 | 2026-10-18 06:24 | 2026-10-18 06:10 | 2026-10-18 06:09 |
| parity-gameplay-0930 | parity-gameplay-0930 | 99749eb1 | 15 | 2026-10-01 02:37 | 2026-10-11 06:03 | 2026-09-30 23:59 |
| parity-integration-0930 | parity-integration-0930 | 10c26f52 | 51 | 2026-10-01 12:36 | 2026-10-01 10:49 | 2026-09-30 23:59 |
| refined-buildings-preview-1017 | refined-buildings-preview-1017 | 1dc71788 | 18 | 2026-10-18 05:15 | 2026-11-04 07:42 (coordinator's audit) | 2026-10-18 01:51 |
| refined-voxel-art-1017 | refined-voxel-art-1017 | 1dc71788 | 16 | 2026-10-18 02:18 | 2026-11-04 07:42 (coordinator's audit) | 2026-10-18 01:27 |
| replay-real-controls-1001 | codex/replay-real-controls-1001 | 10c26f52 | 12 | 2026-10-01 10:20 | 2026-10-11 06:04 | 2026-10-01 10:03 |
| replay-timeout-route6-1001 | codex/replay-timeout-route6-1001 | 4c6c9e16 | 14 | 2026-10-02 04:31 | 2026-10-11 06:04 | 2026-10-02 02:20 |
| shadow-normal-1017 | shadow-normal-1017 | 1dc71788 | 2 | 2026-10-18 02:29 | 2026-10-18 01:10 | 2026-10-18 01:04 |
| software-culling-proof-1017 | software-culling-proof-1017 | 63443d0d | 0 | 2026-10-17 23:18 | 2026-10-17 23:25 | 2026-10-17 23:18 |
| software-ground-proof-1017 | software-ground-proof-1017 | 63443d0d | 5 | 2026-10-18 01:28 | 2026-10-18 00:03 | 2026-10-17 23:41 |
| villager-form-search-1017 | villager-form-search-1017 | 1dc71788 | 6 | 2026-10-18 02:20 | 2026-10-18 02:06 | 2026-10-18 01:46 |
| work136-ui-baseline | work136-ui-baseline | 1dc71788 | 0 | 2026-10-18 07:27 | 2026-10-20 06:36 | 2026-10-18 07:27 |
| vite-consumers/aoe2 | (detached) | 87623a72 | 0 | 2026-10-31 06:32 | 2026-10-31 06:32 | 2026-10-31 06:32 |

Main's code (`src`, `tests`, `scripts`, `.github`, `package.json`) has not changed since `1dc71788`, the base of the 1017 and 1018 worktrees. Their code changes therefore sit on top of current main. The 0930 and 1001 bases are 199 to 210 commits behind main.

## Classification and retained branches

The counts are blobs: "unique" means not reachable from main's history. No worktree had a deletion. "Raw" counts files whose bytes are not what `git add` would store, meaning CRLF or mixed line endings. Commit 2 keeps those bytes as they were, so a branch that is landed needs those files converted to LF first.

| Branch | Base | Commit 1 (index) | Commit 2 (tree) | Staged | Working tree vs index | Unique | In main's history | Raw |
|---|---|---|---|---|---|---|---|---|
| retained/branch-completion-1017 | 1dc71788 | fde7d51d | 11f48b52 | 0 | 244 added, 36 modified | 250 | 30 | 11 |
| retained/coverage-consumer-1001 | 10c26f52 | 816c2476 | 8c6d2f3d | 0 | 4 added, 9 modified | 13 | 0 | 0 |
| retained/detailed-world-1017 | 1dc71788 | c0a7194c | 1b50e1c6 | 0 | 27 added, 20 modified | 47 | 0 | 21 |
| retained/head-jaw-m30-1020 | 3eaf656e | 4d3b36bf | 57f50d79 | 8 (4 added, 4 modified) | 1 modified, line endings only | 8 | 0 | 1 |
| retained/lean-ui-1017 | 1dc71788 | 8d15c79b | 2e88df48 | 200 (170 added, 30 modified) | none | 160 | 40 | 0 |
| retained/living-art-1018 | 1dc71788 | 460a4bc5 | 13c905e4 | 0 | 26 added, 20 modified | 46 | 0 | 12 |
| retained/parity-gameplay-0930 | 99749eb1 | 6c697e50 | e27462cd | 0 | 4 added, 11 modified | 1 | 14 | 0 |
| retained/parity-integration-0930 | 10c26f52 | 87a98d0f | 7c79eb6c | 45 (19 added, 26 modified) | 10 added, 5 modified | 40 | 20 | 0 |
| retained/refined-buildings-preview-1017 | 1dc71788 | 1b21c2dd | ab0b3759 | 0 | 7 added, 11 modified | 18 | 0 | 5 |
| retained/refined-voxel-art-1017 | 1dc71788 | a2065473 | d657c99a | 0 | 5 added, 11 modified | 16 | 0 | 2 |
| retained/replay-real-controls-1001 | 10c26f52 | a9fa7da8 | e93b8d07 | 0 | 5 added, 7 modified | 12 | 0 | 0 |
| retained/replay-timeout-route6-1001 | 4c6c9e16 | 4e98bf96 | b5abddf3 | 0 | 8 added, 6 modified | 5 | 9 | 0 |
| retained/shadow-normal-1017 | 1dc71788 | 457d00c6 | 5d8234d0 | 0 | 2 added | 2 | 0 | 2 |
| retained/software-ground-proof-1017 | 63443d0d | 8d921554 | 2cf9c2e3 | 0 | 2 added, 3 modified | 5 | 0 | 2 |
| retained/villager-form-search-1017 | 1dc71788 | 3e938370 | 8c351fad | 0 | 2 added, 4 modified | 6 | 0 | 2 |

Each commit message says what the commit is, which plan it belongs to, and how to restore it. To restore both layers, make a worktree at the base with `node scripts/controlWorktree.mjs create <new-name> <base>`. In it, run `git restore --source=retained/<name> --worktree -- .`, then `git read-tree retained/<name>~1`. `git diff --name-status retained/<name>~2 retained/<name>` lists every changed path.

The unique paths, grouped by folder where there are more than 18:

- **branch-completion-1017** (250 unique; 30 already in main's history; 0 deletions): `design/` 1, `docs/architecture/` 3, `docs/` 1, `docs/devlog/detailed/` 1, `docs/devlog/` 1, `docs/engine-feedback/` 1, `docs/learning/` 4, `docs/policies/` 1, `docs/threads/current/de-look/` 1, `docs/work/106_de-parity-orchestration/` 1, `docs/work/130_frame-rate-through-a-match/` 5, `docs/work/133_branch-completion/` 11, `package-lock.json` 1, `package.json` 1, `src/rendering/voxel/` 14, `tests/browser/` 2, `tests/rendering/` 9, `tests/rendering/helpers/` 1, `tests/simulation/` 1, `docs/debugging/` 1, `docs/work/134_refined-voxel-art/` 45, `docs/work/135_detailed-voxel-world/` 42, `docs/work/136_lean-icon-ui/` 102.
- **coverage-consumer-1001** (13 unique; 0 already in main's history; 0 deletions): `design/spec-final.md`, `docs/work/108_engine-coverage-adoption/plan.md`, `scripts/playtest-self-improve.mjs`, `src/game/playtest/selfImprovementLedgerFormat.ts`, `src/game/playtest/selfImprovementLoop.ts`, `tests/playtest/engineContractAlignment.test.ts`, `tests/playtest/playtestSelfImproveScript.test.ts`, `tests/playtest/selfImprovementLoop.test.ts`, `tests/playtest/selfImprovementLoopTestKit.ts`, `src/game/playtest/replaySelfCheckEvidence.ts` (untracked), `tests/playtest/replayCoverageScript.test.ts` (untracked), `tests/playtest/replaySelfCheckCoverage.test.ts` (untracked), `tests/playtest/replaySelfCheckCoverageRuntime.test.ts` (untracked).
- **detailed-world-1017** (47 unique; 0 already in main's history; 0 deletions): `src/rendering/voxel/` 27, `tests/rendering/` 19, `tests/rendering/helpers/` 1.
- **head-jaw-m30-1020** (8 unique; 0 already in main's history, 1 differing from its staged blob only in line endings; 0 deletions): `design/spec-final.md` (staged), `docs/devlog/detailed/2026-10-13_2026-10-13.md` (staged), `docs/devlog/summary.md` (staged), `docs/work/135_detailed-voxel-world/plan.md` (staged), `docs/work/135_detailed-voxel-world/reviews/86_implementation.md` (staged), `docs/work/135_detailed-voxel-world/reviews/87_implementation.md` (staged), `docs/work/135_detailed-voxel-world/reviews/88_implementation.md` (staged), `docs/work/135_detailed-voxel-world/reviews/89_integration.md` (staged).
- **lean-ui-1017** (160 unique; 40 already in main's history; 0 deletions): `design/` (staged) 1, `docs/` (staged) 1, `docs/debugging/` (staged) 1, `docs/devlog/detailed/` (staged) 1, `docs/devlog/` (staged) 1, `docs/learning/` (staged) 4, `docs/policies/` (staged) 1, `docs/threads/current/de-look/` (staged) 1, `docs/work/134_refined-voxel-art/` (staged) 1, `docs/work/136_lean-icon-ui/` (staged) 122, `package-lock.json` (staged) 1, `package.json` (staged) 1, `src/audio/` (staged) 1, `src/` (staged) 2, `src/ui/hud/` (staged) 6, `src/ui/hud/icons/` (staged) 2, `src/ui/hud/selectionPanel/` (staged) 1, `src/ui/replay/` (staged) 1, `tests/browser/` (staged) 3, `tests/ui/` (staged) 8.
- **living-art-1018** (46 unique; 0 already in main's history; 0 deletions): `src/rendering/voxel/` 27, `tests/rendering/` 18, `tests/rendering/helpers/` 1.
- **parity-gameplay-0930** (1 unique; 14 already in main's history; 0 deletions): `tests/content/deAttackDamageReference.ts` (untracked).
- **parity-integration-0930** (40 unique; 20 already in main's history; 0 deletions): `design/` (staged) 1, `docs/architecture/` (staged) 3, `docs/` (staged) 1, `docs/debugging/` (staged) 1, `docs/devlog/detailed/` (staged) 1, `docs/devlog/` (staged) 1, `docs/learning/` (staged) 1, `docs/work/106_de-parity-orchestration/` (staged) 1, `docs/work/107_replay-movement-parity/` (staged) 1, `docs/work/108_engine-coverage-adoption/` (staged) 1, `scripts/` (staged) 1, `src/game/playtest/` (staged) 3, `src/game/simulation/bridge/` (staged) 5, `src/game/simulation/bridge/systems/` (staged) 1, `tests/playtest/` (staged) 7, `tests/replay/` (staged) 4, `tests/simulation/` (staged) 1, `design/` 1, `docs/work/106_de-parity-orchestration/` 1, `docs/work/107_replay-movement-parity/` 2, `docs/work/108_engine-coverage-adoption/` 1, `docs/work/109_siege-base-stats/` 1.
- **refined-buildings-preview-1017** (18 unique; 0 already in main's history; 0 deletions): `src/rendering/voxel/aoeVoxelBuildingContext.ts`, `src/rendering/voxel/aoeVoxelBuildingDetails.ts`, `src/rendering/voxel/aoeVoxelBuildingRecipes.ts`, `src/rendering/voxel/aoeVoxelLaneBatches.ts`, `src/rendering/voxel/aoeVoxelRecipeTypes.ts`, `src/rendering/voxel/aoeVoxelResources.ts`, `tests/browser/voxel-unit-attack-animation.spec.ts`, `tests/rendering/aoeVoxelAdapter.test.ts`, `tests/rendering/aoeVoxelBuildingDetail.test.ts`, `tests/rendering/helpers/laneEquivalence.ts`, `tests/simulation/architectureStyles.test.ts`, `src/rendering/voxel/aoeVoxelBuildingForms.ts` (untracked), `src/rendering/voxel/aoeVoxelRoofPanel.ts` (untracked), `src/rendering/voxel/aoeVoxelTownCenterTimber.ts` (untracked), `tests/rendering/aoeVoxelRefinedForms.test.ts` (untracked), `tests/rendering/aoeVoxelRoofPanel.test.ts` (untracked), `tests/rendering/aoeVoxelRoofPresentation.test.ts` (untracked), `tests/rendering/aoeVoxelTownCenterTimber.test.ts` (untracked).
- **refined-voxel-art-1017** (16 unique; 0 already in main's history; 0 deletions): `docs/work/registry.json`, `src/rendering/voxel/aoeVoxelBuildingContext.ts`, `src/rendering/voxel/aoeVoxelBuildingDetails.ts`, `src/rendering/voxel/aoeVoxelBuildingRecipes.ts`, `src/rendering/voxel/aoeVoxelLaneBatches.ts`, `src/rendering/voxel/aoeVoxelRecipeTypes.ts`, `src/rendering/voxel/aoeVoxelResources.ts`, `src/rendering/voxel/aoeVoxelUnitAttackPoseStyles.ts`, `src/rendering/voxel/aoeVoxelUnitHumanoidRecipes.ts`, `tests/rendering/aoeVoxelBuildingDetail.test.ts`, `tests/simulation/architectureStyles.test.ts`, `docs/work/134_refined-voxel-art/plan.md` (untracked), `src/rendering/voxel/aoeVoxelBuildingForms.ts` (untracked), `src/rendering/voxel/aoeVoxelRoofPanel.ts` (untracked), `tests/rendering/aoeVoxelRefinedForms.test.ts` (untracked), `tests/rendering/aoeVoxelRoofPanel.test.ts` (untracked).
- **replay-real-controls-1001** (12 unique; 0 already in main's history; 0 deletions): `src/game/simulation/bridge/bridgeState.ts`, `src/game/simulation/bridge/bridgeStateSerialize.ts`, `src/game/simulation/bridge/systems/playerCommandsSystem.ts`, `src/game/simulation/bridge/wireBridgeOps.ts`, `tests/replay/bridgeStateAccessor.test.ts`, `tests/replay/snapshotEquivalence.test.ts`, `tests/simulation/movementPathCaching.test.ts`, `src/game/simulation/bridge/movePathPersistenceTypes.ts` (untracked), `src/game/simulation/bridge/persistedMovePathCache.ts` (untracked), `tests/browser/movement-save-replay-controls.spec.ts` (untracked), `tests/replay/movementCheckpointContinuation.test.ts` (untracked), `tests/replay/movementRoutePersistence.test.ts` (untracked).
- **replay-timeout-route6-1001** (5 unique; 9 already in main's history; 0 deletions): `.github/workflows/ci.yml`, `docs/work/106_de-parity-orchestration/plan.md`, `docs/work/112_replay-comparison-cost/plan.md`, `tests/replay/exactSnapshotRuntimeContract.test.ts` (untracked), `tests/scripts/ciNodeRuntime.test.ts` (untracked).
- **shadow-normal-1017** (2 unique; 0 already in main's history; 0 deletions): `tests/browser/shadow-single-side.spec.ts` (untracked), `tests/rendering/aoeVoxelShadowWinding.test.ts` (untracked).
- **software-ground-proof-1017** (5 unique; 0 already in main's history; 0 deletions): `package-lock.json`, `package.json`, `src/rendering/voxel/aoeVoxelResources.ts`, `tests/browser/shadow-single-side.spec.ts` (untracked), `tests/rendering/aoeVoxelShadowWinding.test.ts` (untracked).
- **villager-form-search-1017** (6 unique; 0 already in main's history; 0 deletions): `src/rendering/voxel/aoeVoxelUnitAnimation.ts`, `src/rendering/voxel/aoeVoxelUnitAttackAnimation.ts`, `src/rendering/voxel/aoeVoxelUnitAttackPoseStyles.ts`, `src/rendering/voxel/aoeVoxelUnitHumanoidRecipes.ts`, `src/rendering/voxel/aoeVoxelVillagerPose.ts` (untracked), `tests/rendering/aoeVoxelVillagerJoins.test.ts` (untracked).

Overlap between branches, counted as the same path with the same blob: `shadow-normal-1017`'s two files are both in `software-ground-proof-1017`, and all six of `villager-form-search-1017`'s are in `branch-completion-1017`. `branch-completion-1017` also holds 17 of `refined-buildings-preview-1017`'s 18, and `parity-integration-0930` holds 11 of `replay-real-controls-1001`'s 12 and 11 of `coverage-consumer-1001`'s 13. `living-art-1018` holds 34 of `detailed-world-1017`'s 47, and `branch-completion-1017` holds 91 of `lean-ui-1017`'s 160 (the work 136 documents).

## Ignored files

28,228 ignored files (879.6 MB) went with the trees, 150.8 MB of them the vite-consumers checkout's own `node_modules`. 73 files (11.1 MB) were copied to `C:/Users/38909/Documents/github/aoe2/tmp/worktree-retirement-20261104/<name>/`, each folder with a `manifest.json`:

| Folder | Files | Bytes | Why kept | Manifest SHA-256 |
|---|---|---|---|---|
| parity-gameplay-0930 | 1 | 146,755 | plan 106 cites its SHA-256 (`tmp/parity-106/dependencies/install-mirror/aoe2/package-lock.json`) | `092233942882a596b471f7a52b4058b102ac04329f450c0b7c7cfc09646110f5` |
| parity-integration-0930 | 27 | 1,570,326 | plan 106 cites 18 of them by SHA-256. The OPEN 2026-09-30 long-walk register entry keeps "the worker's `occupation-cost.mjs` and inputs", so its folder `tmp/parity-106/hud-evidence/tmp/parity-presentation-0930/` was copied whole (9 files). | `da7f4f9c9706a658cb248e04573d99739b2e6c54c65fcc081d90c55a0954645f` |
| detailed-world-1017 | 41 | 9,371,330 | 11 gallery links, two of them folders (`tmp/work135/form-route/native-01/pairs`, `native-02/pairs`) | `9810938e0ae297e46025bf0b94ad6e51f78741cd6e43df56f090ec380fd1cb5d` |
| living-art-1018 | 4 | 50,404 | 4 gallery links | `93ed2691848c4af55e7871a760d53db28913c47e2e996e087ab041ada0f12f47` |

Two more cited files were not copied, because main already holds the same bytes. Plan 107's `prepared-manifest.json` (SHA-256 `c76508af…`) is main's `docs/work/107_replay-movement-parity/snapshots/prepared-manifest.json.txt`, and plan 108's `provenance-note.md` (`e646a297…`) is main's `snapshots/provenance-note.md` of work 108. The long-walk script `legacy-long-walk-replay.mjs` (`52564fa5…`) is also still in the primary's `tmp/parity-106/unresolved-evidence/m7/`. Everything else was dropped under the 2026-10-18 direction, including the frozen work 106 dependency mirror in `parity-gameplay-0930` (11,091 files, 155.3 MB, a civ-engine 2.4.2 and voxel 1.2.0 install). Only its lockfile is cited. Plan 107's next step validates on the current engine, and work 128 reproduced the long-walk divergence on main.

Some retained drafts cite evidence that was dropped: drafts of plans 106 to 108 in the 0930 and 1001 branches, of 130 and 133 to 136 in `branch-completion-1017`, and of 136 in `lean-ui-1017`. The run evidence they cite (logs, captures, receipts) was in the worktrees' `tmp/` and is gone. A branch that lands has to establish its evidence again on the landing revision.

**The gallery.** With the coordinator's approval, the 15 links in `tmp/visual-gallery/index.md` that pointed into `detailed-world-1017` and `living-art-1018` now point at the copies. Only two prefixes changed: `../../../aoe2-worktrees/<name>/` became `../worktree-retirement-20261104/<name>/`, 11 times for `detailed-world-1017` and 4 times for `living-art-1018`, on five lines. A byte copy of the file before the edit is `tmp/worktree-retirement-20261104/visual-gallery-index.before.md`: 312,146 bytes, SHA-256 `8f584c757c6dd2aa9bedab743541060f16d854d1e8349cffdad0c8ca6b89057d`. After the edit the file is 312,266 bytes, SHA-256 `1b259e69a1c80aa5c6ca6f24fd51bac889704c3b6d27946445f4c92cfdfec4fa`. The full link check ran before the edit, after it, and after the removals. Each time it found 1,330 links and checked 1,309 local ones (1,111 unique): 0 missing.

**Provenance records that name removed trees.** The gallery's provenance and verification JSON files under `tmp/visual-gallery/2026-10-*/` record where each capture was made, so they were not rewritten. Those trees no longer exist: `living-art-1018` (2 files, 776 mentions), `detailed-world-1017` (7 files, 98), `branch-completion-1017` (4 files, 21), `software-ground-proof-1017` (3 files, 12), `refined-buildings-preview-1017` (3 files, 9) and `lean-ui-1017` (1 file, 2). Two more were already gone before this work: `conifer-hierarchy-1018` (1 file, 12) and `work135-font-observation-1018` (3 files, 5). Each removed tree's non-ignored files are in its `retained/<name>` branch. Its ignored files are gone, except the copies listed above in `tmp/worktree-retirement-20261104/`. The tracked reviews and snapshots of works 106 to 111 that name these trees are historical and stay as written.

## The vite-consumers checkout

The folder `C:/Users/38909/Documents/worktrees/vite-consumers/` was made at 2026-10-31 06:31 UTC for voxel's work 5, `vite-advisories`. Its branch `vite-bump` at `3c30315` is local only and on neither voxel's main nor its origin. That plan checked aoe2 and city "from origin/main, linked to this voxel" read-only, and records the check as passed. No file in `../civ-engine`, `../voxel` or `../fleet` names `vite-consumers`, so no tool keeps it as a cache. The aoe2 checkout was clean, with its HEAD `87623a72` in main, and it was removed by path with the controller after a dry run. The two junctions in its own `node_modules` were unlinked first. Their targets lost no file: `github/civ-engine` had 9,408 files before and after, and `worktrees/voxel-vite` had 8,278. The rest of the folder belongs to that voxel task and was left alone: the `city` checkout and the `civ-engine` and `voxel` junctions.

## Stash entries and remote branches

- `092a5fa3`, the stash entry "local-rules.md 2026-10-18 owner directions, landed in f3a0381a", made on 2026-10-29: its index equalled its base, and each of the 4 lines it added is in main. The retired-backups direction is in `rules/worktrees.md`, the HUD rule's new title is in `local-rules.md` and `rules/hud-shape.md`, the minimap paragraph is in `rules/hud-shape.md`, and the gallery paragraph is in `rules/visual-gallery.md`. It was dropped after its position was matched to that commit id.
- `54bb3a0e`, "WIP on main: 332fba4 …", made on 2026-04-29 (now `stash@{0}`), changes only `package-lock.json`: the version goes from 0.1.0 to 0.1.4 and the `../civ-engine` entry from 0.3.0 to 0.8.11. Main's lockfile is at 0.3.258, so the content is not in main and is superseded. Left in place.
- `4a25cf10`, "unrelated local changes", made on 2026-04-17 (now `stash@{1}`), adds to `vite.config.ts` a second build input, `cavalry-icon-draft.html`. That file was never committed and is not on disk, and main's `vite.config.ts` has no `input` list. Not in main. Left in place.
- `origin/test-time-headroom-m2c` (`97ff948e`, 2026-10-12) is work 123's M2 round 1. None of its 3 commits is patch-equivalent in main, but main holds 786 of their 901 added lines (87%). The rest is earlier wording and code that round 2 replaced, for example `advanceTicks` calls that became `stepTicks`. Round 2 shipped as `e4115b2c..670e07d7`, and plan 123 is complete. Left in place.
- `origin/test-time-headroom-m2d-final` (`516e0198`, 2026-10-14): 3 of its 4 commits are patch-equivalent in main. Of all 1,428 lines the branch adds, main holds 1,399 (98%). The rest is earlier wording, mostly in its devlog and plan paragraphs. Left in place.

## Decision table

The owner's directions decide these: useful work reaches main, and a branch kept only "in case" is not completion. "Reviewed" means the plan records an independent review of that content.

| Branch | Holds | Reviewed or gated | What main superseded | Recommendation |
|---|---|---|---|---|
| retained/lean-ui-1017 | work 136: the compact icon HUD the owner asked for, release 0.3.259 (`src/ui/hud`, `src/hudCompact.css`, 11 test files, changelog, spec, 122 work 136 documents) | bounded native acceptances on source `f8d256c9` (R6 nine pairs, four group pairs, four saved pairs). The last full gate on record, fullgate02, was RED: 279 browser passes, 1 failure. No integrated review or release followed. | no code. Docs drifted: spec, devlog, register, lessons, and `local-rules.md`, which is now an index | land: rebase (code applies on unchanged main code; docs need merging), find the fullgate02 failure, a green `npm run verify` with a certified receipt, independent review, a real match and before/after captures |
| retained/head-jaw-m30-1020 | work 135 docs: M30 head and jaw outcome, review rounds 86 to 89, plan, spec and devlog | round 89 (integration) accepts the records | none; main's plan 135 stops at the M30 eye sample | land: docs only. Rebase onto main's devlog, use the staged LF copy of the detailed devlog, run the architecture suite |
| retained/parity-integration-0930 | work 107's persisted move-path cache (6 source and 5 test files, with a save field) and work 108's coverage adapter (4 source and 7 test files), staged with their docs | 107: rounds 0 to 2 and 87/87 focused tests. 108: round 0. No full gate on the combined tree. | main changed `bridgeStateSerialize.ts`, `playerCommandsSystem.ts` and `wireBridgeOps.ts` since the base (0 to 8% of the added lines are in main). The engine moved on. | land after a rebase, fresh tests on the current engine, a full gate, and independent review: the save field makes 107 a persistence change. Or cancel 108 if its adapter is no longer wanted. |
| retained/coverage-consumer-1001 | the 108 source frozen for its round 0 review | round 0 reviewed these bytes | 11 of 13 files are also in `parity-integration-0930`; only drafts of the spec and plan 108 are unique | drop when 108 is decided |
| retained/replay-real-controls-1001 | the 107 candidate, plus the unfinished `tests/browser/movement-save-replay-controls.spec.ts` | not reviewed or run as a spec | 11 of 12 files are in `parity-integration-0930` | decide with 107: finish the spec while landing it, or drop |
| retained/branch-completion-1017 | work 133's integration checkout: work 134's integrated refined-art draft (14 rendering files, 13 test files), 130's shadow candidate, drafts for 130 and 133 to 136 | plan 134 draft: final source review 24 accepted 29 inputs. Runtime cost, full gate and release are pending, Town Center refinement is still active, and the shadow candidate was NOT SHIPPED. | no code. Main's 135 landing replaced several 135 documents (90 to 100% of their lines). | keep only if work 134 continues: Town Center refinement, then cost, a full gate, visual review and landing. Otherwise drop. |
| retained/refined-voxel-art-1017 | an earlier work 134 lane: building forms, roof panel, humanoid recipe, draft plan 134 | none recorded | `branch-completion-1017` has the same 10 files, in versions dated later | drop |
| retained/refined-buildings-preview-1017 | work 134 building preview | none recorded | 17 of 18 files are in `branch-completion-1017` | drop |
| retained/villager-form-search-1017 | work 134 villager pose and join test | none recorded | all 6 files are in `branch-completion-1017` | drop |
| retained/detailed-world-1017 | work 135's natural-world source, 47 files (route D) | later routes built on D were rejected by root and independent review. Plan 135 names "acceptable original 3D sculpture" as the blocker. | none in code; work 135 now authors art outside the repo | drop. The gallery evidence is kept in `tmp/worktree-retirement-20261104/`. |
| retained/living-art-1018 | work 135's living anatomy and asset study | round 07 rejected the target art tier | 34 of 46 files are also in `detailed-world-1017` | drop |
| retained/shadow-normal-1017 | work 130's two shadow tests | not run natively | both files are in `software-ground-proof-1017` | drop |
| retained/software-ground-proof-1017 | work 130: a 0.3.259 version edit, one `aoeVoxelResources.ts` edit, the shadow tests | plan 130 draft: the shadow candidate stopped, NOT SHIPPED | the version edit duplicates `lean-ui-1017`'s | drop |
| retained/replay-timeout-route6-1001 | cancelled work 112's route 6: a `ci.yml` Node matrix and two Node-runtime tests | route 6 reviews in plan 112 (cancelled) | plan 106's CI Node card asks for a different fix (`node-version-file:`), and main holds the plan edits | drop |
| retained/parity-gameplay-0930 | one pre-correction draft of `tests/content/deAttackDamageReference.ts` | — | main's `1b22e90b` corrected that file's checksum line, review finding CL-1 | drop |
| stash `54bb3a0e` | an April lockfile refresh | — | everything | drop |
| stash `4a25cf10` | an April `vite.config.ts` input for a draft page that does not exist | — | the page never existed in git | drop |
| `origin/test-time-headroom-m2c` | work 123 M2 round 1 | superseded by round 2 | 87% of its lines; the rest replaced | delete (outward-facing) |
| `origin/test-time-headroom-m2d-final` | work 123 M2 round 2 | shipped as `e4115b2c..670e07d7` | 98% of its lines; the rest is earlier wording | delete (outward-facing) |

## M2 design note

- Where: a module beside `scripts/ci-status.mjs`, which is at 486 of its 500 lines, in the way `ci-status-attempts.mjs` and `ci-status-triggers.mjs` were split out. `report()` calls it after the remote answers. It reads `git worktree list --porcelain` and the reflog and mtimes, all local.
- What counts as a leftover: a registered worktree, other than the primary, whose HEAD main contains and which shows no activity for 24 hours. Activity uses this work's test: no non-ignored file, index, HEAD or branch-reflog change. Also a `retained/*` branch older than a set age with no open plan naming it, and a directory under `../aoe2-worktrees` that git does not list.
- An index's mtime alone does not show activity. A plain `git status` rewrites a worktree's index: the coordinator's audit did it to two indexes on 2026-11-04. So the check must read with `--no-optional-locks`, and it must weigh file and reflog times as well.
- Exemptions it needs: the checkout running the command, so a worker's own worktree does not fail its own session start. A worktree marked with `git worktree lock` and a reason, such as a tool's reusable checkout; the controller already refuses a locked worktree. A worktree whose HEAD is not in main, which is unfinished work: report it, but do not fail on it. Peers' worktrees with recent activity.
- Exit code: the checked consumers are `tests/scripts/ciStatus.test.ts`, `ciStatusReruns.test.ts` (through `helpers/ciStatusHarness.ts`, which refuses any subprocess without an installed scenario, so the new git calls need a scenario there) and `runDirectly.test.ts` (it runs `ci-status.mjs` through a junction). `ciTriggers.test.ts` imports only `WATCHED`. AGENTS.md's session start reads the exit as "a red remote gate is the next task". No workflow under `.github/` and no hook in `.claude/settings.json` runs it, and `../fleet` does not name it. Recommendation: print leftovers as their own line, and make them exit non-zero only with a flag, or with a separate exit code. If leftovers made it exit 1, a session could not tell a red remote gate from local debris.
