# Review 0: implementation

2026-10-17 owner correction: the authored report below is historical. Its Missionary refusal premise is superseded by official DE update 169123 and the installed current DE descriptions. Recovery allows Missionaries to carry relics with their loaded speed; this correction does not retroactively change the original reviewer’s report. See de-comparison-2026-10-17.md and work 133 for current acceptance.

## Target

Repository aoe2, work 128 on branch `ai-relics` at `d5d46364`: three commits on main `5b6838df` (`b96a469a`, `09359fc6`, `d5d46364`). That is the carried relic's claim, the computer's knowledge of relics, the relic ledger and `--config` switch in `scripts/selfplay-audit.mjs`, the three self-play gates re-derived as the coordinator decided, their tests, and the drafted docs.

## Reviewers and coverage

- **r128-review**, one independent read-only reviewer the coordinator dispatched, with the worktree and git. It ran the relic test files and its own probes against the branch and against main's source (`tmp/probes/review128/`, ignored, each with its `// harness:` line): a unit standing on a dying carrier's cell and a recording of it, an unreachable nearest relic with and without a wounded soldier, a computer Monk beside the player's carrying Monk, a recording made on main replayed on the branch with main's own replay as the control, the knowledge search's cost per call, units standing on a fallen relic in a self-play match, and a merge-tree of works 126 and 128.
- **Coverage beyond that:** the coordinator's relay does not say, so this record claims only what the probes and the findings show.

## Reports

### r128-review (read-only), as the coordinator relayed it

No blocking issue. Six should-fix findings and five nits.

- **SF1:** a relic dropped by a dying carrier landed on the carrier's cell whatever stood there. A unit sharing the cell was stranded ("blocked ground blocks every route out"), a Farm under it was walled (the Monastery spill already kept off Farms), and `selfCheck` diverged on a recording of it, because the load's rebuild claims resources before units while live play gave the relic an overflow claim. The decision record's "a loaded or replayed world holds the same occupancy" was false there.
- **SF2:** one known relic no route reaches disabled the computer's Monks for the match: 100 orders in 3,000 ticks and nothing stored, and a wounded Militia never healed, which main heals. The search took the nearest relic by distance with no route check, the failed plan dropped the task, and the `continue` skipped healing.
- **SF3:** the conquest-only headers of `aiReachesCastleAge.test.ts` and `villagersAvoidEnemyDefencesSelfPlay.test.ts` pointed at `aiMonkKnownRelics.test.ts` where the Standard-rules gate is `aiRelicsSelfPlay.test.ts`, and that case should say it gates the claim rule only, since it stays green with the visible-only search (stores at 26,439 and 27,552).
- **SF4:** the castle configurations of `selfplay-audit.mjs`, `profile-selfplay.mjs` and `aiTickAb.mjs` still played the Standard rules, so "the gate's match" was no longer the match `aiReachesCastleAge` plays.
- **SF5:** the commit that re-records the census did not name its direction; "toward gold-priced units" was wrong (the Elite Skirmisher costs no gold); and the lab's moved villager losses belong on the OPEN 2026-09-10 entry.
- **SF6:** a Monk took a relic from another living Monk, across owners too: the computer took the player's relic at tick 142.
- **Nits:** the knowledge search allocated an array on every resource sync, every animal step included; the `humanSight.ts` header; the changelog's "never for one it has not seen" (say the present-position bound) and the Missionary's healing; a case for ground explored through an ally's sight; and two register facts, that a recording made before work 128 diverges at a carrying Monk's first step (segment 0 to 20, `components.position[2162][1].y`) and that work 128 fixes main's own `selfCheck` failure on every carry.
- **At the rebase onto work 126:** re-run the census rather than merging its JSON; remove 126's carried-relic stand-aside only with every 126 relic case green; rewrite or drop `foundationStartAnimals`' "monk with relic" case; close 126's duplicate entry as fixed by 128; split `transformOps.ts` and `wirePostSeedOps.ts` by role rather than squeezing them.

## Findings and disposition

| ID | Finding | Disposition | Evidence |
| --- | --- | --- | --- |
| SF1 | A dropped relic stranded a unit, walled a Farm and broke replay. | Accepted, fixed. | `relicGround.ts`'s `findRelicLandingCells`, the Monastery spill's ring search, now shared: the carrier's cell if nothing claims it, else the nearest cell with no unit, structure or resource. Cases: a unit that shared the carrier's cell walks away, no relic lands on a Farm, and recordings of a carry and of the drop re-simulate. The decision record is corrected. The load's rebuild moved to `occupancyRebuild.ts`, so `transformOps.ts` is 435 lines. |
| SF2 | One unreachable relic disabled the Monks. | Accepted, fixed. | The search skips a relic its Monk cannot walk to within reach of and falls through to healing. The answer is the range plan's own (`findUnitRangePlan`, the search the Monk's walk makes), kept per unit cell and structural revision in `unitRangeReach.ts`, so a failing whole-map search runs once per state, not once per decision. The placement labelling (`builderReachability.ts`) was weighed and not used: it agrees with A* only under A*'s iteration cap. Two lake cases and a memo test. |
| SF3 | Wrong header pointers; the Standard case's bound. | Accepted. | Both headers point at `aiRelicsSelfPlay.test.ts`, whose header says it gates the claim rule only, with the two store ticks. |
| SF4 | The instruments' castle configuration. | Accepted. | `castle` plays conquest-only in all three; `selfplay-audit.mjs` adds `--config standard` for the Standard rules. AGENTS.md's sentence stays true and is unchanged. |
| SF5 | The census commit's direction; the docs' wording; the 2026-09-10 entry. | Accepted. | The round-0 code moved the census again, so it is re-recorded from a run's own diff, and its direction is in the commit; the census is re-run once more at the rebase onto 126 and that commit names its own. The docs say what moved. The 2026-09-10 entry has the lab numbers. |
| SF6 | A Monk took a held relic. | Accepted, fixed. | `relicHolder` is asked by the pickup, by the behaviour step (an errand for a relic someone picked up ends) and by both right-click paths (a click on a carried relic is a walk). Two cases, one across owners. The OPEN entry is closed. |
| N1 | An allocation on every resource sync. | Accepted. | `relicHolder` walks the carried-relic map, a few entries, without building an array. |
| N2 | The `humanSight.ts` header. | Accepted. | It names the computer's relic knowledge among what follows the sight. |
| N3 | The changelog. | Accepted. | The present-position bound, the Missionary's healing, the drop's landing and the held relic. |
| N4 | No ally-sight case. | Accepted. | The computer seat's ally, the player, explores a relic and its lookout is deleted; the computer fetches the relic. |
| N5 | Two register facts. | Accepted. | In the fixed entry's investigation. |

Found while fixing, beside the review:

- **The pickup sync.** The first fix synced the relic at the pickup, so a Monk picking a relic up from its own cell is released; round 0's first draft dropped that sync because the new landing rule never puts a relic under a unit. A save made before work 128 can still hold one, so the sync stays, gated by a staged save.
- **A known replay divergence, measured smaller.** A recording of a villager walking from (28,14) to (31,10) on open grass, with no relic anywhere, diverges at segment 20 to 40, on main `08e2c49d` as on the branch, while a straight walk re-simulates. It is the class of the OPEN 2026-09-30 entry, which now carries the reproduction; the drop's recording here walks a straight route and starts once the villager stands on the carrier's cell.

- **DE's own files, read under the local rule of 2026-10-15.** DE's AI scripts on this machine leave relic gathering to the engine's relic order and count the map's relics through the fog only when deciding on a Monastery; DE's strings put a dropped relic beside its Monk. The spec cites the lines. The knowledge rule stays the stated bound. DE's Drop Relic order has no counterpart here, which is a card for work 106's queue, not this work.

## Verification

- Recovered on 2026-10-17 from `5dee1545`, without discarding the existing detailed-devlog correction. The current four focused relic files pass: 27 tests, 6.50 s. This is fresh evidence for the round-0 source, not a full gate or an independent re-review.
- The retained mutation transcript `tmp/w128/mutate-r0.out` reports red controls for the old source (16 cases), the carried-resource claim (14), carrier-cell drops (2), ignoring units (2), ignoring Farms (1), no drop reclaim (1), no pickup sync (1), no route check (2), no reach memo (2), own sight only (1), visible-only knowledge (2), true-map knowledge (1), sending a Missionary (1), and all held-relic guards removed (2). Removing only the applier's held-relic guard stays green because the other guards still reject that action; that defensive check has no independent mutation sensitivity claim.
- The retained lab census run (`tmp/w128/r0-census-rerecorded.log`) passed after the reviewed repairs. The mixed three-file self-play run (`tmp/w128/r0-gates.log`) did not fully pass: the Castle Age suite hook timed out while the other two files passed. A later checked-in census is evidence for that branch only. The integrator must rerun the AI and self-play checks on the combined tree and re-record its final census.
- Retained conquest-only castle audit (`tmp/w128/r0-castle.txt`): on `aoe2-prototype`, owner 2 stored relics at ticks 26,428 and 27,655; owner 1 stored none. No current countdown-length claim is inferred from those results.

## Recovery finding, 2026-10-17

Returning a relic had the same nearest-unreachable-target trap as fetching one: deposit selection chose the nearest complete Monastery without asking the building planner. A river fixture failed before the fix (no deposit within 1,500 ticks despite another reachable own Monastery). The search now tries completed Monasteries by distance until the mover's own building-approach planner accepts one. The seven known-relic cases pass after the change; TypeScript and eslint over the eight changed code/test files pass. This addition needs independent review with the integrated change.

The final focused rerun passes all four files and 28 cases in 5.31 s. The assembled integration tree's existing `relicSpillFoundation.test.ts` was first run against the old landing rule and failed (`{19,11}` instead of `{20,10}`): a passable foundation claim was treated like a blocking structure. The recovery patch ignores only claims whose kind is `foundation`, retaining all other structure, unit and resource exclusions. Its green check is pending transfer to the integration tree, which owns the foundation fixture.

## Round outcome

All findings repaired. Handed back for a focused re-review; the landing waits for work 126.
