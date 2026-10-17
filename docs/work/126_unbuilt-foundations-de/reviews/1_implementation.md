# Review 1: implementation

## Target

Repository aoe2, branch `unbuilt-foundations`, commit `491931c6` ("Two seats' builders no longer wait on each other on unbuilt foundations, and animals cross them (work 126 M1, review round 0)"), the repair of [round 0](0_implementation.md), against its parent `b1863103`, the phase-1 change rebased onto main `ea11292a`. The scope is `git diff b1863103 491931c6`: 35 files, 993 insertions and 234 deletions (SHA-256 `9a39676eb7036a1536468bb1b84c05826a519447b0d58bff608118f418c4a788` over that diff as git prints it without colour). It was a focused re-review of the round-0 repair, not a fresh review of the whole work.

## Reviewers and coverage

The same read-only reviewer as round 0, `r126-review`, dispatched by the coordinator on 2026-10-15; its model and CLI were not passed to the implementation worker. Its evidence is in the worktree at `tmp/probes/review126/`:

- the round-0 delay sweeps run again on the repair (`mutualWaitSweep-r1.log`, `mutualWaitAdjacent-r1.log`) and two new sweeps of 42 trials each, overlapping and side by side, with every delay from 0 to 60 ticks in steps of 3 and either seat first (`settleOverlap.test.ts`, `settleAdjacent.test.ts`);
- the allied overlap through the fog again (`allyOverlap-r1.log`);
- a villager crossing a foundation in a pass on its way to build elsewhere, with a plain move order as the control (`transitBuilder.test.ts`);
- re-runs of seven of the round's gates (`r1-*.log`) and the round's spec diff (`spec-r0.diff`).

## Reports

The reviewer's report went to the coordinator, who passed the implementation worker one should-fix and three nits, numbered 2 to 4, each with the rule for its repair. No nit numbered 1 was passed on. This record does not reproduce the report. The reviewer found nothing blocking. It confirmed F0 to F11 of round 0 repaired: all 42 overlapping and all 42 side-by-side trials settle (`settleOverlap.log`, `settleAdjacent.log`), and F11's census evidence supports "a change of direction, not a stall".

## Findings and disposition

| ID | Finding | Disposition and reason | Repair and gate |
|---|---|---|---|
| SF1 | (should-fix) The round-0 exception for builders was too wide. `buildsOwnSite` (`foundationStart.ts`) excused every unit with a build order of its own, wherever it was on its way. On `unbuilt-foundations-pass-fixture`, owner 2's villager crossing to build at (18,16) stood on the human's unstarted House at (31,17) when it started. It was put on the east side, the House sealed the pass, and 800 ticks later the villager was idle with its paid House at progress 0 (`transitBuilder.log`). On a plain move order the same villager held the start for 24 ticks and got through. | Accepted, with the coordinator's rule: only a unit standing on a cell beside its own site's footprint, the cell it builds from, is excused. | `buildsOwnSiteFromHere` in `foundationStart.ts` also needs the unit 4-connected one step from an edge of its own site's footprint, as the approach cells a builder works from are. New gate `foundationStartTransit.test.ts` promotes the probe: on the build order the House starts only once the villager has passed, the villager ends west and builds its House; the move order is its control. With the wide exception back (M40), the build case is red ("put on the far side of the pass: expected 32 to be less than 30"), and so is a new unit case in `foundationStartAnimals.test.ts`, a villager passing through on its way to a far site. On the narrowed rule the reviewer's sweeps still settle: 42 of 42 overlapping and 42 of 42 side by side, none deadlocked, and its transit probe has the House start 24 ticks after the order and owner 2's House finished. The changelog's "on its way to build its own foundation" now reads "beside its own foundation, building it". |
| NIT 2 | The spec's sentence on the pass understated the bound. `reachesFromEvery` refuses every site while a builder stands on its own future wall that touches two components: in a pass, in a nook against trees or water, or where two explored patches meet only through the foundation. | Accepted. | Spec §8.1 says so: every site is refused for that builder unless it touches all of those areas, which in practice is every site, and another builder, or the same one once it has stepped off, is asked as usual. |
| NIT 3 | §12.1 said another player's building is named without blaming the fog. But a building that never had a construction state (one a scenario placed) still gets the fog wording, because `arrivedSincePlacing` returns null for it. | Accepted: the code is right, since such a building was there when the foundation went down. | §12.1 now matches the code's comment. A building raised from a foundation, started or finished, a relic or a carcass is named without the fog; terrain, a standing resource and a building never raised from a foundation are said to have been hidden by it. |
| NIT 4 | No case had one occupant boxed in and one free, which a clearing that moves some and not all would fail. | Accepted. | `foundationStartAnimals.test.ts` rings the House with water but for one cell holding the human's finished gate. The human's villager could leave through it; a Gaia sheep cannot. Together they hold the start and neither moves. A premise case shows each alone: the villager leaves through the gate, and the sheep waits. A clearing that moves those it can and then waits (M41) turns the case red, and so does one that moves those it can and starts (M35). |

## Verification

All checks below ran on the round's repair before the landing; the landing's own gate is in the plan's Outcome.

- Every work 126 test file passes: 19 files, 89 cases.
- Forty-one mutations turned their gates red, each restored byte for byte (`tmp/run-mutations-r1.log`): round 0's 39, with M27's pattern following the renamed check, and M40 (the wide exception) and M41 (a clearing that moves those it can, then waits). The runner fails on any pattern it does not find exactly once.
- The reviewer's own sweeps and probe, run unchanged on the narrowed rule: 42 of 42 overlapping and 42 of 42 side-by-side trials settle, none deadlocked, and the transit probe has the House start 24 ticks after the order and owner 2's House finished (`tmp/settleOverlap-r1.log`, `tmp/settleAdjacent-r1.log`, `tmp/transitBuilder-r1.log`).
- The coverage lab (`selfPlayContentCoverage.test.ts`, `aoe2-prototype`): green against the census re-recorded in phase 1.
- This work's files with the AI's placement and build files and two self-play matches (`aiVsAi`, `movementTrafficReliefSelfPlay`, `aiPlacementKeepsMapConnected` among them): 28 files, 131 cases, green.
- `tests/architecture` (16 files, 152 cases), `tsc --noEmit` and eslint on the changed files: exit 0.

## Round outcome

Nothing blocking. One should-fix and three nits, all repaired as above; none is left open. The coordinator's instruction after this round was to repair and land, so the round-1 repair itself was not reviewed again; its evidence is above.
