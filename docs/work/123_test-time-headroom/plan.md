# Every gated test keeps headroom under its time limit

Status: active
Owner: Coordinator worker w123-test-headroom (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-14

## Problem and outcome

Main's CI fails on some runs and not others. On 2026-10-11 it was red at `fd9d2c8d`, `fdb4f1c0`, `207f5f7a`, `0e59f4ab`, `7294d0c6` and `b92b03fa`, and green at `8d7265ba`. Every failure is a test running close to its time limit on CI's runners:
- `tests/replay/resourceWorkerOccupation.test.ts`, the 600-tick full non-cosmetic comparison: 36–40 s against 30 s on Windows.
- `tests/replay/resourceWorkerOccupationLifecycle.test.ts`: about 32.5 s against 30 s on Windows.
- `tests/browser/resource-workers.spec.ts:113`, the large resource readouts at 1920px: it times out on the Linux browser shard, which draws on SwiftShader. This is work 111's open CI item.

The local gate has the same class of problem. `tests/browser/de-ground.spec.ts:139` takes about 72 s of its 90 s limit alone on this machine's GPU. Under load it timed out once, in work 119's first verify run.

Work 112 (Codex) spent six routes making the replay comparison cheaper without changing what it compares, and rejected them. Its plan and reviews keep that ledger:
- descriptor equality;
- narrowed shallow equality;
- global interning;
- native function binding, which shipped a bounded gain, but the timeout came back;
- a private paired comparator, which made the whole case dearer.

Work 112 also ruled out changes to production code, the engine, dependencies, timeouts, retries, the scenario, the population, the comparison count, gathering and persistence. Under the owner direction of 2026-10-11, all aoe2 work is the coordinator's, so this work may reconsider those limits, provided no check is weakened.

Outcome: each named test runs at no more than two thirds of its time limit on every runner the gate uses, with every check it makes intact. A gate fails any test that crosses that line, as `scripts/ci-job-headroom.mjs` already does for whole jobs.

## Scope

May edit:
- the four tests, their fixtures and helpers;
- a new headroom report and gate, plus the CI workflow if the gate needs per-test durations from CI;
- product code, only where a test's cost is a slow product path, with the same review a product change gets.

Must not:
- weaken a check (fewer comparisons, a smaller world, a shorter run) unless an equivalent check covers the same guarantee. Say so where you make that substitution.
- raise a time limit as the fix. A limit may rise only for work proven irreducible, with the reason recorded where the limit is set.
- edit the files of works 116 and 120, which are running now.

## Approach

1. Measure first: per-test durations from CI's own logs (Windows and Linux unit jobs, and the four browser shards) and from a local run. Name the instrument.
2. Build the headroom report and gate, and prove it red on today's offenders.
3. Fix each offender, following `../fleet/docs/skills/hard-problem.md` for the replay comparison, since six routes are already spent.
4. The batch protocol is in `docs/policies/local-rules.md`.

## Acceptance criteria

- The headroom gate names every test above two thirds of its limit, and fails on today's offenders before the fix.
- After the fix, each named test is under two thirds of its limit on each runner, measured from CI's logs for the landing commit, with its checks unchanged or covered by a named equivalent.
- Main's CI is green on the landing commit.
- `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed.

## Implementation steps

The coordinator split the work into two milestones on 2026-10-12, once the planner defect below turned out to be the critical path: work 116's local verify had failed on the 600-tick comparison (51 s of 30 s), on the native-120 check and on de-ground.spec.ts:139, and other landings waited on it.

- [x] Measure (2026-10-11). 84 CI job logs from 14 runs (gh api actions/jobs/<id>/logs, parsed by tmp/probes/ci-log-durations.mjs): above two thirds of a limit on some run were the 600- and 700-tick replay comparisons on Windows (timed out, 30.6-35.7 s of 30 s), exactSnapshotSerializer's 120-tick case (20.6 s on Windows) and ten browser specs, de-ground.spec.ts:139 worst at 89.8 s of 90 s. Each job's runner ran its tests at 0.57-1.32x their medians.
- [x] M1, the replay comparisons: each runs as consecutive cases over the same two worlds (tests/replay/tickChunks.ts): 600 ticks as six 100-tick cases, 700 as seven, 120 as six 20-tick cases. Every tick's check and the whole-run checks are unchanged; five mutations (divergences at late ticks, a broken gather predicate, a wrong deposit credit, a stale-clone instrument) each fail the case that holds them. Hard-problem record: the spent families are comparator and clone tuning (work 112's routes 1-5) and the runtime (route 6). A Node CPU profile put the 600-tick loop at 9% stepping, 69% World.serialize and 22% comparison, over a 566 KB snapshot that is 90% the 2,160 static terrain tiles; making that cheaper means changing the save format, so the case was split instead, which the brief allows.
- [x] M1, the slow product path behind de-ground.spec.ts:139: four sheep boxed in on the boot map ran 1,756-2,731 failing path searches a tick, because the move planner ran one A* per candidate cell of the whole map. The planner now floods the reachable region once after a failed search and skips unreachable candidates; register entry 2026-10-12 has the evidence and the gates.
- [x] M2, the gate: every CI job judges its own suite's tests after the suite (`scripts/test-time-headroom.mjs`, fed by `tests/helpers/vitestTestTimeReporter.ts` and the browser duration reporter), failing a test past two thirds of its own limit and printing the thirty closest. Proven red on the pre-fix tree by branch run 38181131359, on every browser shard and both unit jobs.
- [x] M2, round 1 (2026-10-12): cheap state reads, the placement search in one round trip, 54 discarded `advanceTicks` snapshots no longer shipped back, evidence captures only on request, the Monk's walk stepped by ticks, one boot per command-deck card, and splits that keep every check. Branch run 38241014818, on the rebased tree `97ff948e`, was green on all six jobs.
- [x] M2, round 2 (2026-10-13), after the independent review's finding 1: the slowest runners run the same list up to 1.76x slower than the fastest (probes 38508537662, 38515187274 and 38518636843), so tests at 51-58% on the runners then seen were one slow runner from the line. `stepTicks`, a test-API step that draws nothing, for loops that check every tick; waits in one `page.evaluate`; the patrol stepped; three more PNGs on request; and splits: the command bar in four groups per viewport, the build-card tooltips before and during placement, the art-style live switch in two, the Berserk's healing in two. The review's other findings are answered in the devlog entry of 2026-10-14.
- [ ] M2 landing: verify under the lock, push, and the landing commit's CI figures here. Then close the 2026-10-01 register entry "Hosted resource-chip fixture timed out during screenshot capture" on those figures, as M1 did for the replay entry.

## Outcome

M1 shipped in v0.3.249 as `e273fb09` (with `23829a60` and `5be2a349`), after `npm run verify` exited 0 with its log through lint and the last build. M2 is gated on branch `test-time-headroom-m2d` and awaits acceptance.

M2 on CI, the share of its own limit each named test reached at most on the probe runners after round 2: the barracks rush and the patrol under 31%, the Town Center 40%, the Watch Tower 31%, the save and load 46%, the art-style live switch 59% and its unexplored-ground sample 55%, the 1920x1080 command-deck tooltip test 59%. The last three are the nearest the line, and the next to cut if a slower runner puts them past it. Tracing costs about 10% on the slowest runners and was kept, for its failure traces.

M1 on CI, run 38224624680 for `e273fb09`: de-ground.spec.ts:139 took 8.2 s on browser shard 2 (start to start), down from an 83.8 s median, and both unit jobs passed. The replay files took 37.5, 34.4 and 14.7 s on windows-latest (600-tick, lifecycle, native-120), and 26.1, 19.1 and 12.2 s on ubuntu-latest. Those logs print per-file totals only. M2's branch run 38228344282, with the same replay tests and the per-test reporter, put no replay case among the 30 tests closest to their limits on windows-latest, so each ran under 17% of 30 s. The run failed only on browser shard 4, where the 1920px resource readouts timed out, an offender M2 fixes. Work 112's 2026-10-01 register entry is closed on these figures.

Follow-up candidate from M1, its own card: saves carry the 2,160 static terrain tiles of the boot map, 90% of a 566 KB snapshot, and serializing them is 69% of the replay comparisons' cost. Deriving the tiles from the map seed instead would cut that cost from every save, replay and comparison, but it changes the save format.
