# Review 1: implementation

## Target

Repository aoe2, work 123 M2 after round 0's repair: the second round of cuts and the rebuild on main `9e4a320b` as `515bd3e1` (gate), `ac15728a` (`stepTicks`), `de323caf` (specs) and `516e0198` (docs), recoverable on the remote branch `test-time-headroom-m2d-final`. The round-2 code was read as `git diff 97ff948e 922d7dc7` outside the docs; `922d7dc7` was a local commit holding that work on the old base, and the reviewer confirmed that `516e0198` carries the same bytes for every file M2 touches.

## Reviewers and coverage

- **One independent read-only reviewer**, a Claude subagent dispatched by the implementer, focused on round 2, the rebuild and the docs commit, with the worktree, git, `gh` and the CI job logs.
- **Not covered:** it ran no browser spec and no suite, and did not re-run the mutations or the local equivalence probe. It did not see round 0's report, and did not re-derive the 2026-10-11 figures.

## Reports

### Claude subagent (read-only)

Its report, as delivered, with formatting condensed:

> **Verdict:** nothing blocking. Round 2's code keeps every check at the same tick granularity or finer. The rebuild matches the WIP commit exactly. The exact tip `516e0198` ran green on CI. The docs carry one wrong evidence claim, repeated in three durable docs, plus several small wrong numbers.
>
> **Should-fix 1. The "same CPU model" claim is wrong, in three durable docs.** defect-register.md:13, local-rules.md:246 and the devlog say the 1.76x spread was among runners of one CPU model. The four runners of probe 5 (run 38518636843) are three models, read from lscpu: AMD EPYC 9V45 (362.3 s summed), 9V74 (473.8 s), 7763 (628.1 s) and 7763 (637.3 s). So the 1.76x spread is between CPU models; the two 7763 runners agree within 1.5%, and probes 3 and 4 show the same, 7763 runners within about 3% of each other and Intel 8573C runners faster. `scripts/test-time-headroom.mjs:25` says "four probe runners of two CPU models". Restate it as across CPU models, the 7763 the slowest seen: the tests at 59% then need a runner about 1.13x slower than a 7763.
>
> **Should-fix 2. The register's bound leaves out the unit side.** On windows-latest `unitMotionPersistence` reached 55% (16.4 s, run 38228344282, job 114741319108) and `aiReachesCastleAge` 50-51% of 600 s. Both sit above the new "about half" rule, and the gate now fails main on them. The devlog mentions them; the register should too.
>
> **Nits.** `scripts/test-time-headroom.mjs:7` and `tests/scripts/testTimeHeadroom.test.ts:1-2` cite a "2026-10-11 register entry"; the entry is headed 2026-10-12, and the register's 2026-10-11 entry is work 124's. `plan.md:72` says run 38228344282 "failed only on browser shard 4"; shards 1 and 4 both failed, on the headroom verdict, with selection-panel 1920 at 88%, readouts at 72%, art-style at 81% and de-command-surface:316 at 68%. Wrong numbers: shard 1's closest test in run 38598660948 was 34%, not 31%; the Watch Tower reached 34% on probe 4 (job 115692285954), not 31%; "49-54%" should read 49-55%; the probes used 12 distinct runners, not 11. The devlog says the Monk polls check every tick (they step 10 ticks a poll) and cites `resource-workers.spec.ts:76` for a helper at :79. Stale comments: `scripts/ci-job-headroom.mjs:30-32` ("a job that fails before its last step is not measured"), `durationBudgetReporter.ts:95` (failed tests "not measured at all", true of the printout only), `browserTestStepTicks.test.ts:30` (cites the plan for a result only the devlog records). No `reviews/` file exists for the work. The plan names branch `test-time-headroom-m2d`, which holds the pre-rebuild `05470c05`; the tip is on `test-time-headroom-m2d-final`. Kept from before M2, optional: the Watch Tower kill loop would pass if the fixture had no enemy Scout; the selection-panel split no longer enters the Town Centre from the scout, the sheep from the foundation, or the gold mine from the bush, and one unmeasured selection at the start of each group would restore it.
>
> **Verified correct.** The 37 non-docs files M2 touches have identical blobs at `516e0198` and `922d7dc7`, and main changed none of them between `ea704401` and `9e4a320b`; `05470c05` carries the same blobs. The rolled-over register entry moved verbatim. `stepTicks` shares one step loop with `advanceTicks`: the same clamping, the same lifting and restoring of the API's own pause, the same refusal tally and one shared warning per reason, and it returns only the tally. Each rewritten loop or wait keeps its checks, bounds and tick step or a finer one, inside one `page.evaluate`. Every click that needs the drawn view comes after a sync. No round-2 change can pass vacuously. The ci.yml conditions are right; Playwright's onEnd order and `test.timeout` updates, vitest's durations and the `onTestRunEnd` signature match the claims. Runs 38181131359, 38241014818, 38598660948 and the probe maxima are as stated, and run 38604015435 on `516e0198` is green on all six jobs. The spec sentence, the gate-proofs amendment, the case counts, the 499-to-442 lines, the 54 calls, the 35 out-of-band call sites and the summary's 50 lines check out. Main has since moved to `45a13cd7` (work 122), overlapping M2 only in docs.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F10 | The 1.76x spread was attributed to runners of one CPU model; they were of four. | Accepted: the claim was wrong, read off a probe script that folded every AMD runner into one class. | Register, local rule, devlog and the script's header now say four models, the AMD EPYC 7763 the slowest seen. |
| F11 | The register's bound named only the browser tests. | Accepted. | The bound names `unitMotionPersistence` (55% on one windows run) and `aiReachesCastleAge` (50-51% of 600 s). |
| F12 | Two headers cite a 2026-10-11 register entry. | Accepted. | Both now cite the entry of 2026-10-12. |
| F13 | The plan misdescribed run 38228344282. | Accepted. | The plan names shards 1 and 4 and the four offenders, checked against the job logs. |
| F14 | Four wrong numbers. | Accepted. | 34%, 34%, 49-55% and 12 runners. |
| F15 | The devlog's Monk wording and a line reference. | Accepted. | Reworded; the line reference dropped. |
| F16 | Three stale comments. | Accepted. | `ci-job-headroom.mjs`, the duration reporter and the `stepTicks` test corrected; the reporters' output-path comments too (round 0's F9). |
| F17 | No review files. | Accepted. | `reviews/0_implementation.md` and this file. |
| F18 | The plan's branch name. | Accepted. | The plan and devlog name the landing branch: `test-time-headroom-m2e`, the repair rebased onto main after work 122. |
| F19 | The Watch Tower kill loop would pass with no Scout. | Accepted, though older than M2. | The test asserts the Scout is alive before the loop. |
| F6 | Lost selection transitions (also round 0). | Accepted. | The Town Centre group selects the scout first and the mines group the berry bush, unmeasured; the sheep is still not entered from the foundation, as the header says. |

## Verification

The repair was checked locally: types, lint, `tests/architecture`, the gate's and `stepTicks`' tests, and the three changed specs on SwiftShader (35 passed). CI on the repaired tree is the landing branch's run, named in the plan and the devlog. The reviewer's findings on docs were checked against the job logs before they were taken.

## Round outcome

Nothing blocking; two should-fix findings and the nits, all taken. The tests nearest the line remain the register's stated bound, not a finding left open.
