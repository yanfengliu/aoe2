# The unit suite finishes well inside its CI time limit on both runners

Status: active
Owner: ci-unit-suite worker for the Claude coordinator
Created: 2026-11-05
Updated: 2026-11-05

## Problem and outcome

Main's hosted CI went red on 2026-11-05: run 41990047794 on `45a76681`, a docs-only commit, failed one step, "Headroom under the job's time limit", in `windows-latest — typecheck + lint + test + build`. The job ran 40.2 of its 60 minutes (67.1%), past the step's line at two thirds. Every other step passed, the per-test headroom step included.

Times here come from the job logs (`gh api repos/yanfengliu/aoe2/actions/jobs/<id>/logs`, a timestamp on every line), never from the jobs API's job fields, which were wrong on several of these runs.

| Run | Commit | Runner | Job | Unit-suite step | Vitest Duration |
|---|---|---|---|---|---|
| 41990047794 | 45a76681 | windows-latest | 40.2 min | 36.3 min | 2,176 s |
| 41986406500 | cd1a5fa4 | windows-latest | 39.0 min | 35.4 min | 2,123 s |
| 41968199784 | 30264cba | windows-latest | 39.8 min | 36.1 min | 2,162 s |
| 41947495412 | db5fe70f | windows-latest | 38.9 min | 35.2 min | 2,113 s |
| 42000220735 | c574e666 | windows-latest | 38.1 min | 34.2 min | 2,051 s |
| 42004237120 | b5e7eb1f | windows-latest | 40.1 min | 36.6 min | 2,191 s |
| 41990047794 | 45a76681 | ubuntu-latest | 28.3 min | 26.6 min | 1,598 s |
| 41986406500 | cd1a5fa4 | ubuntu-latest | 22.7 min | 20.9 min | 1,255 s |
| 41968199784 | 30264cba | ubuntu-latest | 30.0 min | 27.8 min | 1,666 s |
| 41947495412 | db5fe70f | ubuntu-latest | 23.0 min | 21.1 min | 1,268 s |
| 42000220735 | c574e666 | ubuntu-latest | 18.3 min | 16.5 min | 988 s |
| 42004237120 | b5e7eb1f | ubuntu-latest | 21.6 min | 20.5 min | 1,227 s |

Run 42004237120, on main's tip `b5e7eb1f`, went red the same way at 40.1 minutes. Over all nine unsharded runs of 2026-11-05 (660-667 files), the Windows job took 30.1-40.2 minutes (unit step 27.5-36.6) and the Ubuntu job 18.3-30.0; the three not in the table are 41954527374, 41962536047 and 41963003150 (Windows 37.5, 30.1 and 36.6).

The suite is 667 files and 5,245 tests on `c574e666`. Runner speed moves the Windows job about 1.9x: the same 649 files took a 19.5-minute unit step on run 41806570710 (2026-11-04) and 36.6 on run 39742886323 (2026-10-22), every file 1.88x slower at the median (p10 1.63, p90 2.22), so the runner set the spread. All six Windows runs in the table drew runners of the slow kind. On comparable slow runners (per-file medians within 1.09x), the suite grew from 3,414 s of test time on 533 files (run 36666507008, 2026-09-30) to 3,781 s on 667 files, about 1.21x once the runner is normalised, or about 3.7% a week.

Outcome: each unit-suite job on both runners finishes at or under about half its 60-minute limit on the slowest runners seen, with room for the suite to grow, and with no raised limit, no loosened headroom gate, no skipped or weakened test, and the Windows run kept.

## Scope

In: `.github/workflows/ci.yml`'s unit-suite job, `vitest.config.ts`'s CI comment, the two headroom scripts and their tests, this plan and its records.

Out: the AI (work 141) and controls (work 142) code, other workflows, civ-engine and voxel, `AGENTS.md`.

## Approach

Measured first. On run 41990047794's Windows log, `tests/simulation` is 90% of the suite's test time (3,402 of 3,781 s, 394 of 667 files), and four self-play match files are 35% of it: `selfPlayContentCoverage` 429 s, `villagersAvoidEnemyDefencesSelfPlay` 379 s, `aiRelicsSelfPlay` 271 s and `aiReachesCastleAge` 260 s, one or two tests each. The top ten files are 49%. The Duration line's other phases (collect 343 s, prepare 77 s, environment 50 s, transform 18 s) come to 0.73 s a file.

Three levers were weighed:
- More workers per runner. Not taken. The runners have 4 logical CPUs (run 42009011415 printed 4 on all six unit jobs: four AMD EPYC 7763, one Xeon Platinum 8370C, one Xeon 6975P-C), so `maxThreads: '50%'` gives 2 workers, which vitest's test-to-wall ratio of 1.74 also shows. `vitest.config.ts` caps workers at half the cores because oversubscription inflated the heaviest tests 3-5x and tripped their limits, and the closest tests already run at 45% (`aiRelicsSelfPlay`, 268.5 s of 600 s) and 43% of their own limits on Windows, which the per-test step fails past 67%.
- Making the dominant class cheaper. The four matches are single long tests: splitting one into cases keeps it on one worker, and a faster simulation is product work beyond this lane. Recorded here, not taken.
- Sharding the files across jobs, as the browser suite already is. Taken. Each shard runs on its own runner with the same 2 workers, so no test's conditions change; only the files per job are fewer.

`vitest --shard=<k>/<n>` (BaseSequencer.shard, vitest 3.2.6) sorts the files by a sha1 of their root-relative path and slices the list into contiguous runs of ceil(files/n). The split is by count, not time, and it reshuffles as files are added. A model of it (2 workers, larger files first as vitest orders a fresh run, each file's logged time plus 0.73 s, a wholly skipped file at 0 s) put the unsharded run at 2,135 s against the 2,176 s measured, and gives the 223, 223 and 221 files the hosted run then ran. On that run's per-file times:

| Shards | Today's split, slowest shard's suite | 2,000 random equal-count splits: median, p90, p99, max |
|---|---|---|
| 2 | 18.3 min | 19.9, 22.8, 25.1, 27.1 min |
| 3 | 13.8 min | 14.8, 17.5, 20.1, 22.6 min |
| 4 | 11.2 min | 12.2, 14.9, 17.4, 18.8 min |

Round 1 of the review found the first model dropping the one wholly skipped file, which prints no duration, and so splitting 666 files; the table is the corrected model. The model held on the hosted runs: scaled by each job's runner speed (below), it predicted the three clean Windows shards 2-7% under their measured Duration lines (627, 772 and 506 s against 666, 790 and 541).

A Windows job adds about 3 minutes before the suite (checkout to build) and seconds after it. Three shards, not two, because two would sit near 22 minutes on today's split and near 29 on a p99 split, at the half-limit line; not four, because three already leaves the room below and each shard costs a runner: a run now takes 10 jobs (6 unit, 4 browser) plus 1 for playtest.yml, of the Free plan's 20 at once.

Every shard runs every step, typecheck, lint and build included (75 s on run 41990047794's Windows job), so there is one kind of job and a red job names its own step.

The `--` before `--shard` is quoted. PowerShell is the default shell on windows-latest, and an npm.ps1 that hands node its `$args`, as npm 10.8.2's does, never sees a bare `--` there: npm then keeps `--shard` for itself and runs every file. Measured on 2026-11-05 with Windows PowerShell 5.1 and that shim's logic: bare, the npm script got no arguments and `npm_config_shard` was `1/3`; quoted, it got `--shard=1/3`, as it does under bash both ways. On windows-latest today PowerShell finds `npm.cmd` instead and keeps a bare `--` (run 42009011415 printed `C:\hostedtoolcache\windows\node\20.20.2\x64\npm.cmd` and `["--shard=1/3"]` for both forms), so this guards against a runner whose Node ships that npm.ps1, not a failure seen on CI.

## Acceptance criteria

- [x] Each unit-suite job on both runners finishes at or under about half its limit on hosted runners, measured from the job logs of a hosted run of the change, with the bound stated: 12.1-18.0 minutes on windows-latest (30% at most) and 5.9-12.2 on ubuntu-latest, runs 42008973265 and 42009011415.
- [x] `timeout-minutes` stays 60, both headroom gates are unchanged in their rules, no test is skipped, deleted or weakened, and both runners stay in the matrix.
- [x] The three shards together run every test file exactly once on each runner: 223, 223 and 221 files on both runners in run 42008973265, 667 in all, and 1,874, 1,624 and 1,750 tests, 5,248 in all.
- [x] The job-headroom step still fails a shard past two thirds, and each shard's per-test step judges its own shard's report, both shown red on hosted runners (run 42009011415).
- [x] `tests/scripts/ciJobHeadroom.test.ts` holds the split and fails on each way a shard or a runner can drop out, each shown red.
- [ ] `npm run verify` exits 0 and the receipt check passes on the handed-off revision; independent review of the exact revision; merged to main and pushed; the landing run's logs read.

## Implementation steps

- [x] Measure the unit jobs from their logs (28 jobs from 14 runs, 2026-09-24 to 2026-11-05), rank the files and model the split.
- [x] Shard the unit suite three ways per runner, the `--` quoted; hold the split and the `--` rule in `ciJobHeadroom.test.ts` (`807692a4`).
- [x] Prove the test red: 19 mutations of ci.yml, each red, and four controls green (`docs/learning/gate-proofs.md`).
- [x] Prove the partition with vitest's own sequencer: 223, 223 and 221 of 667 files, each in exactly one shard.
- [x] Prove on hosted runners: a clean run (42008973265, `807692a4`) and a red-proof run (42009011415, `568f3a5d`, never landed, its branch deleted).
- [x] Review round 0 (Codex) on `807692a4`: no blocker or major finding; its two minor findings repaired in `5a56aed9` ([round 0](reviews/0_implementation.md)).
- [x] Review round 1 (Codex) on `e185cbef`: no blocker or major finding; F0 confirmed, F1 (continued), F2 and F3 repaired in the next commit ([round 1](reviews/1_implementation.md)).
- [x] Review round 2 (Codex) on `b97742da`: no blocker or major finding; F1 again (a command spanning lines escaped the line rule), so the rule now reads each run block whole, and a nit on the register's sample wording (F4), both repaired in the next commit ([round 2](reviews/2_implementation.md)).
- [ ] Hand off, land, follow the landing run.

## Hosted proof

Run 42008973265, `807692a4`, all ten jobs green. From the job logs:

| Job | Job time | Share | Suite step | Files | Tests | Runner speed vs run 41990047794 |
|---|---|---|---|---|---|---|
| windows-latest 1/3 | 13.7 min | 23% | 11.1 min | 223 | 1,874 | 0.76x |
| windows-latest 2/3 | 16.3 min | 27% | 13.2 min | 223 | 1,624 | 1.00x |
| windows-latest 3/3 | 12.1 min | 20% | 9.1 min | 221 | 1,750 | 0.94x |
| ubuntu-latest 1/3 | 7.3 min | 12% | 6.2 min | 223 | 1,874 | 0.58x |
| ubuntu-latest 2/3 | 9.1 min | 15% | 7.8 min | 223 | 1,624 | 0.80x |
| ubuntu-latest 3/3 | 5.9 min | 10% | 4.7 min | 221 | 1,750 | 0.68x |

Runner speed is the median, over files of 2 s or more, of each file's time in the job over its time in run 41990047794 on the same runner OS. Each shard's per-test step measured exactly its own shard's tests (1,874, 1,622 and 1,748 passed).

Run 42009011415, `568f3a5d` (never landed): the red proof. It added a test that sleeps 2.4 s of its own 3 s limit, which vitest's split puts in shard 2, moved shard 3's job clock back 41 minutes before its job-headroom step, printed each runner's processors and which npm PowerShell runs with what reaches the script, and skipped the browser jobs. On both runners:
- shard 1: both headroom steps green (Windows 18.0 minutes, 30%, the slowest shard job seen, on a runner at 1.04x);
- shard 2: the per-test step red, "1 of 1612 tests used more than 67% of their own time limit … 80% of 3s (2.4s) tests/scripts/headroomRedProof.test.ts", and its job-headroom step green;
- shard 3: the per-test step green, "1759 tests measured", and its job-headroom step red, "This job used 53.0 of its 60-minute limit (88% …)" on Windows and 49.4 (82%) on Ubuntu.

Run 42019409523, `b97742da` (after review round 1's repairs), all ten jobs green: Windows shards 16.9, 16.1 and 10.2 minutes (28%, 27%, 17%), Ubuntu 12.6, 6.3 and 8.2 (21%, 11%, 14%), and 223, 223 and 221 files on each runner.

## The bound

On the slowest runners seen, the slowest shard's suite step took 14.9 minutes inside an 18.0-minute job. The job crosses the headroom line at 40 minutes, so that step can grow 2.5x before it does, and to 1.8x before the job passes half the limit. The split reshuffles as files are added: a split as bad as 1 random split in 100 makes the slowest shard 1.46x what today's makes it, which leaves 1.7x to the line. At the 3.7% a week the suite grew from 2026-09-30 to 2026-11-05, that is about 15 weeks with a p99 split and about 25 with today's. A runner slower than any seen comes off the same room. The next step is a fourth shard, one list entry and one count, which `ciJobHeadroom.test.ts` holds together.

## Outcome

Pending: landing.
