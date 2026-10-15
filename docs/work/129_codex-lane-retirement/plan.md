# Codex's lanes finish on main: close what shipped, keep what is unique, retire the ten checkouts

Status: active
Owner: Claude coordinator (Game orchestrator todos); M1 worker codex-retire-m1 (done 2026-10-15); M2 worker to be named
Created: 2026-10-15
Updated: 2026-10-15

## Problem and outcome

The Codex orchestrator stopped working on aoe2 on 2026-10-10, and since 2026-10-11 the Claude coordinator owns its open items (local rules, "Permanent work records and the retained-owner transition"). The owner's direction of 2026-09-29 is that useful progress finishes on main and the temporary branches and checkouts are then retired. A read-only triage on 2026-10-14 found:

- Ten checkouts under `../aoe2-worktrees` from Codex's lanes. All ten HEADs are in main, none of their branches is on origin, and nine hold uncommitted files.
- Unique work in some of them: the reviewed and gated but unlanded candidates for work 107 (a persisted move-path cache, 11 files) and work 108 (engine coverage adoption, 13 paths), both staged in `parity-integration-0930`, which also holds the only copies of the authored reviews of 107 (rounds 0-2) and 108 (round 0) with their snapshots; the only copy of an unfinished browser spec, `tests/browser/movement-save-replay-controls.spec.ts`, in `replay-real-controls-1001`; three small garrison-observation files in `parity-gameplay-0930` that an OPEN register entry names as living there; `prepared-manifest.json` in `replay-parity-1001`, cited by plan 107.
- Plans 109, 110 and 111 have shipped but still say active; plan 98's remainder can become cards; plan 112, cancelled, still says the route6 checkout must not be removed; OPEN register entries from 109 and 110 (and one from 112) can close.
- `replay-parity-1001`'s `node_modules` junction points into `parity-gameplay-0930`'s own `tmp/`, and `parity-gameplay-0930`'s dependency-mirror junctions target inside their own tree, which work 113 says makes `controlWorktree.mjs remove` exit 1 after it deletes.
- The primary checkout's `tmp/` holds 112 Codex-era entries, about 785 MB.

Outcome: every Codex plan says truthfully whether it is complete, cancelled or active with an owner and a next step; every unique artifact is on main or deliberately dropped with its reason written down; all ten checkouts and their branches are gone, through `scripts/controlWorktree.mjs` only.

## Scope

- M1 (docs and the safe retirements): close plans 109, 110 and 111 with the coordinator as owner; close or drop their OPEN register entries on the evidence; turn plan 98's remainder into cards in work 106's queue and close it; turn 109's two leftovers into cards; correct plan 112's removal line; copy the authored review rounds of 107 and 108 into their permanent `reviews/` folders; make the garrison register entry stand without a `tmp/` path; copy plan 107's cited manifest if it is small; retire `corpus-evidence-1001`, `engine-coverage-adoption-1001`, `replay-parity-250`, `siege-content-1001` and `replay-parity-1001`.
- M2 (after work 107 and 108 are decided): land or cancel 108; re-baseline 97 and close it or make it a card; fix or cancel 113; retire `parity-integration-0930`, `coverage-consumer-1001`, `replay-real-controls-1001`, `parity-gameplay-0930` and `replay-timeout-route6-1001`; clean the primary `tmp/` of Codex-era entries nothing open cites.
- Excluded: landing work 107's product fix (its own plan, with an independent review because it is persistence); the CI Node version (a card in work 106's queue).

## Approach

Every claim that a file is superseded is checked before anything is discarded: byte-identical to main, or its content already applied to main, with the command recorded. `controlWorktree.mjs` runs with `--dry-run` first, and `--discard-changes` only names files proven superseded. A checkout holding anything not yet preserved stays. Docs follow the repo's rules: the register's rollover gate, thread closure, and the docs checks `checkoutLineEndings.test.ts`, `workDocsIntegration.test.ts` and `threadHygiene.test.ts` against the staged files before each commit.

## Acceptance criteria

- Plans 109, 110 and 111 say complete, with the commits that shipped them; plan 98 is closed with its remainder in work 106's queue; plan 112 no longer says a checkout must stay.
- The 107 and 108 review rounds are in `docs/work/107_replay-movement-parity/reviews/` and `docs/work/108_engine-coverage-adoption/reviews/`, within the repo's blob-size rules.
- No register entry or plan points at a path inside a checkout this work retires.
- M1's five checkouts and their branches are gone, removed by the controller, with every discarded file listed in this plan with its evidence.
- M2's checkouts are gone once 107 and 108 are decided, and the primary `tmp/` holds no Codex-era entry that nothing cites.

## Implementation steps

- [x] M1: docs closures, preserved reviews and evidence, five checkouts retired (2026-10-15; the record is in the Outcome and the next section).
- [ ] M2: 108, 97 and 113 decided; the other five checkouts retired; the primary `tmp/` cleaned.

## Outcome

**M1, done 2026-10-15.** Commits on main: `8b476022` (the review rounds, their snapshots and plan 107's manifest, pushed before anything was deleted) and the commit that carries this paragraph (plan and register closures, the thread move, the cards and this record). Checks: the architecture suite on each of the two trees (16 files, 152 tests, exit 0 read from a file); `npm run ci:status` after the first push (main's CI GREEN on eight consecutive runs, latest `83b6ffa3`, and the run for `8b476022` still going; the corpus GREEN on 20+); the siege base-stats gate at `83b6ffa3` (2 files, 37 tests, exit 0). No product code changed, so no full gate ran.

- Preserved on main: [107's rounds 0 to 2](../107_replay-movement-parity/reviews/0_implementation.md) and [108's round 0](../108_engine-coverage-adoption/reviews/0_implementation.md), with the 11 snapshots for 107 (one of them plan 107's prepared manifest, `snapshots/prepared-manifest.json.txt`) and the 3 for 108. A script checked every size and SHA-256 the rounds cite for those files against the stored bytes, and all matched. One file differs from its source: 107's round 2 ended in CRLF, which the line-ending gate rejects as mixed, so it is stored with LF and plan 107 records both digests.
- Closed: plans 109, 110 and 111 (complete; each closure paragraph names the commits); plan 98 (complete; its owner thread moved to `docs/threads/done/` with a closure line; C2 and C8, C6 and E9 became cards in work 106's queue; the Codex-lane retry and the save/load and instrument promotion are dropped with their reasons); and plan 112's line that said the route6 checkout must stay. Register: the Onager, Ram and Heavy Scorpion entry (109) and the corpus-upload entry (110) closed as fixed and gated, the 2026-10-02 npm-lifecycle entry (from cancelled work 112) closed without a fix, and all three moved to the archive. The mounted-unique garrison entry stays OPEN, with its table folded into the entry so it needs no `tmp/` path. Work 109's two leftovers are cards under M2.
- Retired through `scripts/controlWorktree.mjs`, a dry run first each time, every exit 0, former link targets lost nothing, each branch deleted with its checkout: `replay-parity-1001` first (its `node_modules` junction led into `parity-gameplay-0930`, which stays), then `corpus-evidence-1001`, `engine-coverage-adoption-1001`, `replay-parity-250` and `siege-content-1001`. `--discard-changes` was given for the first four and covers exactly the paths listed in the next section. `siege-content-1001` had a clean tree.
- Carry-forward for M2, found in M1 and not acted on. `parity-integration-0930` now holds the only copy of the work 107 candidate's eleven source and test files, and the only staged copies of the final `design/spec-final.md`, plan 107 and plan 108 that 107's round 1 names as its published-after files (their staged bytes match round 1's digests; its reversible prose delta cannot be applied without them). Plan 106's `tmp/parity-106/final-visuals/proof.json` (cited with digests) and the `occupation-cost.mjs` that the long-walk register entry names are also only in that checkout's `tmp/`; the long-walk instrument itself, `legacy-long-walk-replay.mjs`, is in the primary's `tmp/parity-106/unresolved-evidence/m7/` with the SHA-256 the register cites. `replay-timeout-route6-1001` holds a `ci.yml` Node matrix change and two Node-runtime tests that main lacks (the card in work 106's queue), so it stays until that card is decided. `coverage-consumer-1001` holds the frozen source work 108's round 0 reviewed.
- Not checked: the ignored `tmp/`, `dist/`, `generated/` and `test-results/` that went with the four trees were looked at by name and size, not file by file; the cited ones are accounted for below. The statements that main's CI is green rest on `npm run ci:status` at the time of writing, not on a hosted run of these doc commits.

M2 is pending: land or cancel 108, re-baseline 97, fix or cancel 113, retire the other five checkouts, and clean the primary `tmp/`.

## Discarded in M1 (2026-10-15)

Each path was compared with main (at `83b6ffa3`, then `8b476022`) or with the staged copy in `parity-integration-0930`, which stays until M2. The checks were blob hashes, line-by-line containment and word diffs against the nearest line. "Verbatim" means the line is in the other file exactly; "earlier wording" means a word diff shows the other file's line as the later, fuller version of the same sentence. The triage's classifier, re-run before the removals, gave the triage's table, except for the rows that `8b476022` changed by adding files to main. No path held content without a later counterpart on main or in `parity-integration-0930`.

**`corpus-evidence-1001`** (4 paths)

| Path | Why it is safe to discard |
|---|---|
| `.github/workflows/playtest.yml` | blob `34be45d7` equals main's file |
| `docs/work/registry.json` | adds the row for allocation 110, which main has |
| `docs/work/110_corpus-evidence-retention/plan.md` | an older draft of main's plan 110; its one Outcome paragraph is main's "Original worker outcome" |
| `tests/scripts/corpusArtifacts.test.ts` | blob `a2dff143` equals main's file |

**`engine-coverage-adoption-1001`** (22 paths)

| Path | Why it is safe to discard |
|---|---|
| `docs/debugging/2026-09-30-de-parity-orchestration.md` | 3 of the 4 added lines are in main's file verbatim; the 4th is an earlier wording of a paragraph main holds in a later one |
| `docs/devlog/detailed/2026-09-29_2026-09-30.md` | 2 of 3 added paragraphs are verbatim in main's renamed `2026-09-29_2026-10-12.md`; the 3rd is its earlier wording |
| `docs/devlog/summary.md` | its one new line is an earlier wording of main's `2026-09-30–10-01 v0.3.242` line |
| `docs/work/106_de-parity-orchestration/snapshots/hud-handoff.md` | 2 of 3 added lines are verbatim in main's file; the 3rd links review 7 by a name main renamed (`7_plan.md`) and ends in an earlier sentence |
| `docs/work/registry.json` | adds the rows for allocations 107 and 108, which main has |
| `tests/replay/resourceWorkerOccupation.test.ts` | main's file is this one with the 600-tick case run as six 100-tick cases (work 123, `describeTickChunks`); the same assertions, line by line |
| `docs/work/106_de-parity-orchestration/reviews/6_ci-cost-investigation.md` | content equals main's `snapshots/06_ci-cost-search/review6-wrapper-before-structure.md`; main's `reviews/6_implementation.md` is the restructured round |
| `docs/work/106_de-parity-orchestration/reviews/7_occupation-contract.md` | content equals main's `snapshots/07_occupation-contract/review7-wrapper-before-structure.md`; main's `reviews/7_plan.md` is the restructured round |
| `docs/work/106_de-parity-orchestration/snapshots/06_ci-cost-search/independent-investigation-original.md` | blob equals main's file at the same path |
| `docs/work/106_de-parity-orchestration/snapshots/06_ci-cost-search/rejected-intern-helper.ts.txt` | blob equals main's file at the same path |
| `docs/work/106_de-parity-orchestration/snapshots/07_occupation-contract/independent-contract-original.md` | blob equals main's file at the same path |
| `docs/work/106_de-parity-orchestration/snapshots/07_occupation-contract/inspected-inputs.json` | equals main's `inspected-inputs.json.txt` once CRLF becomes LF |
| `docs/work/106_de-parity-orchestration/snapshots/07_occupation-contract/reviewed-exactSnapshotSerializer.test.ts.txt` | blob equals main's file at the same path |
| `docs/work/106_de-parity-orchestration/snapshots/07_occupation-contract/reviewed-exactSnapshotSerializer.ts.txt` | blob equals main's file at the same path |
| `docs/work/106_de-parity-orchestration/snapshots/07_occupation-contract/reviewed-original-helper-lifecycle-baseline.test.ts.txt` | blob equals main's file at the same path |
| `docs/work/106_de-parity-orchestration/snapshots/07_occupation-contract/reviewed-resourceWorkerOccupation.test.ts.txt` | blob equals main's file at the same path |
| `docs/work/106_de-parity-orchestration/snapshots/07_occupation-contract/reviewed-work108-plan.md.txt` | blob equals main's file at the same path |
| `docs/work/107_replay-movement-parity/plan.md` | the planned template, older than main's plan 107 |
| `docs/work/108_engine-coverage-adoption/plan.md` | an earlier draft; two paragraphs differ from main's later wording |
| `tests/replay/exactSnapshotSerializer.test.ts` | byte-identical to main's `snapshots/07_occupation-contract/reviewed-exactSnapshotSerializer.test.ts.txt`; main's test is this one with the 120-tick case run as six 20-tick cases (work 123) |
| `tests/replay/exactSnapshotSerializer.ts` | blob equals main's file |
| `tests/replay/resourceWorkerOccupationLifecycle.test.ts` | main's file is this one with the 700-tick case run as seven 100-tick cases (work 123); the same assertions, line by line |

**`replay-parity-250`** (12 paths)

| Path | Why it is safe to discard |
|---|---|
| `src/game/simulation/bridge/bridgeState.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-1001` |
| `src/game/simulation/bridge/bridgeStateSerialize.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-1001` |
| `src/game/simulation/bridge/systems/playerCommandsSystem.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-1001` |
| `src/game/simulation/bridge/wireBridgeOps.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-1001` |
| `tests/replay/bridgeStateAccessor.test.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-1001` |
| `tests/replay/snapshotEquivalence.test.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-1001` |
| `tests/simulation/movementPathCaching.test.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-1001` |
| `docs/work/107_replay-movement-parity/engine-2.5-retest.md` | byte-identical to `snapshots/engine-2.5-retest.md` in `parity-integration-0930`, now also on main under that name |
| `src/game/simulation/bridge/movePathPersistenceTypes.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-1001` |
| `src/game/simulation/bridge/persistedMovePathCache.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-1001` |
| `tests/replay/movementCheckpointContinuation.test.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-1001` |
| `tests/replay/movementRoutePersistence.test.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-1001` |

**`replay-parity-1001`** (22 paths)

| Path | Why it is safe to discard |
|---|---|
| `design/spec-final.md` | earlier wording of what `parity-integration-0930` stages (1 of 4 added lines verbatim there, the other 3 differ by a few words) |
| `docs/architecture/ARCHITECTURE.md` | every added line is verbatim in the staged file in `parity-integration-0930` |
| `docs/architecture/decisions.md` | every added line is verbatim in the staged file in `parity-integration-0930` |
| `docs/architecture/drift-log.md` | earlier wording of the row staged in `parity-integration-0930` |
| `docs/devlog/summary.md` | earlier wording of the line staged in `parity-integration-0930` |
| `docs/learning/defect-register.md` | 3 of 6 added lines are verbatim in the staged file; the other 3 are earlier wordings of the same paragraphs |
| `docs/work/registry.json` | adds the row for allocation 107, which main has |
| `src/game/simulation/bridge/bridgeState.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-250` |
| `src/game/simulation/bridge/bridgeStateSerialize.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-250` |
| `src/game/simulation/bridge/systems/playerCommandsSystem.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-250` |
| `src/game/simulation/bridge/wireBridgeOps.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-250` |
| `tests/replay/bridgeStateAccessor.test.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-250` |
| `tests/replay/snapshotEquivalence.test.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-250` |
| `tests/simulation/movementPathCaching.test.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-250` |
| `docs/debugging/2026-10-01-movement-replay.md` | 28 of 30 lines are verbatim in the staged copy; two paragraphs are earlier wordings |
| `docs/devlog/detailed/2026-10-01_2026-10-01.md` | every added line is verbatim in the staged copy |
| `docs/work/107_replay-movement-parity/gate-proof.md` | byte-identical to `snapshots/gate-proof.md` in `parity-integration-0930`, now also on main under that name |
| `docs/work/107_replay-movement-parity/plan.md` | main's plan 107 with `Status: prepared; integration acceptance pending`, which is not a valid Status; main keeps `active` |
| `src/game/simulation/bridge/movePathPersistenceTypes.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-250` |
| `src/game/simulation/bridge/persistedMovePathCache.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-250` |
| `tests/replay/movementCheckpointContinuation.test.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-250` |
| `tests/replay/movementRoutePersistence.test.ts` | byte-identical (SHA-256) to the staged file in `parity-integration-0930`, and to the copy in `replay-parity-250` |

**Ignored files that went with the trees.** Accounted for: the six `tmp/work106-snapshot-profile/review7-inputs` files that the work 106 reviews 6 and 7 cite are all on main as snapshots, by content; `prepared-manifest.json` is on main (see above); `tmp/probes/legacy-long-walk-replay.mjs`, in both 107 checkouts, is byte-identical to the primary's copy (SHA-256 `52564fa5…`, the one the register cites). Not kept, as task-run evidence under ignored paths: `engine-coverage-adoption-1001/tmp` (124 MB: CPU profiles, logs and manifests of the occupation-test cost work), `replay-parity-1001/tmp/parity-107` (6.7 MB: a 5 MB `bundle.json`, tests-first, transition, mutation and cost results, a tracked diff), `replay-parity-250/tmp` (65 KB: the engine 2.5 retest's receipts and a 1.5 KB `selfCheck` observer, described in `engine-2.5-retest.md`) and `siege-content-1001`'s `tmp/` (25 MB: play screenshots, review-run inputs and gate evidence for work 109), `dist/`, `generated/` and `test-results/`. The reviews and snapshots that cite these paths are historical records and are unchanged; the digests they carry stay readable, and the files do not.
