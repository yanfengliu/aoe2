# Every gated test keeps headroom under its time limit

Status: planned
Owner: Coordinator worker w123-test-headroom (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-11

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

- [ ] Measure, gate, fix, land.

## Outcome

Pending.
