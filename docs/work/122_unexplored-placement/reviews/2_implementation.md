# Review 2: implementation

## Target

Repository aoe2, branch `unexplored-placement` at `57ce53fe`, for round 1's repair: commit `72d33458` (finding F10, what the frame draws on unexplored ground) and commit `b363fcad` (the integration with work 121's hidden foundations). Both sit on main `c71496a9`, work 121's landing, after the rebase that round 1's record describes. The commits between and after them, `d1548177`, `4fe6d820` and `57ce53fe`, are documents only.

## Reviewers and coverage

The same read-only reviewer as rounds 0 and 1, dispatched by the coordinator on 2026-10-13 for a short focused re-review of F10's repair. As before, its model, CLI and prompt were not passed to the implementation worker. Its evidence shows what it did: a new probe against the live bridge, `hiddenFoundationToastProbe.mts`, and a fourth mutation harness, `vitest.mutant4.config.mjs`, both in the coordinator's scratchpad under `review122/`. It reported that F10 is fixed and gated. It also reported that reading the memory half through `getFogMemoryEntities(new Set())` is correct, deterministic and cheap: 0.075 ms per ask on the 60x36 map with 305 memory entries.

## Reports

As in rounds 0 and 1, the reviewer's authored report went to the coordinator, who passed its findings to the implementation worker in short form, with severities, scenarios and the files they concern. This record does not reproduce that report. At the coordinator's direction, the table gives each item in short form. IDs continue from round 1.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F14 | (1, should-fix) The start check's message names an enemy foundation the frame hides. `foundationStart.ts:147` read every claim on a cell the player sees now, an enemy's unstarted foundation included. On the lookout-foundation fixture (`hiddenFoundationToastProbe.mts`) a House ghost at (23,18) is rightly green and the click accepted, and on arrival the toast said "found a house (building) at (24,18)" while the frame drew nothing there. Spec §12.1's "it decides nothing over unexplored ground" over-claimed, since the start check still cancels the House. | Accepted. The message must name only what the frame draws, like the placement. | Commit `6f6fda38`. The message reads the cells the player sees through a view that drops the claims of anything the frame does not draw, the view's new `isClaimHidden`, which the footprint rule and the report both honour. So it names the next blocker the player sees drawn (on this fixture, forest at (23,19)), or says only that the builders found the ground blocked. A new case in `placementHiddenFoundation.test.ts` and one in `placementFootprintViews.test.ts`, each red without its filter. Spec §12.1 now says such a foundation is cancelled like anything else the fog hid, and that its message names only what the frame draws. |
| F15 | (2, should-fix-lite) `isDrawnLive` (`placementKnowledge.ts:216`) hand-copied the frame's live rule (`isCurrentlyVisibleTo` plus `isFoundationHidden`), and the memory dedupe depended on that copy, so a later hide rule could reach the frame and miss the placement. | Accepted. The extraction fits the coordinator's 40-line bound, so it is done rather than carded. | Commit `6f6fda38`. One predicate, humanSight's `isLiveEntityDrawn`, decides whether the frame draws a live entity, and renderStateOps and the placement both call it. One hide rule, `unstartedFoundations.ts`'s `isBuildingHiddenFrom`, is what the bridge's `isFoundationHiddenFrom` and the placement both ask. Removing its hide check turns work 121's own frame test (2 of 10) and this work's (3 of 3) red together. A note in `fogMemoryOps.ts` says `getFogMemoryEntities` now also decides placement, so a filter about presentation alone does not belong there. |

## Verification

These checks ran on `6f6fda38`, with the lock free:
- The 126 unit files that touch placement, construction, deletion, fog memory, unstarted foundations, visibility or the render state: 844 passed, 1 skipped.
- `tests/architecture`: 150 passed. `tsc --noEmit`, and eslint on the changed files: exit 0.
- Mutations, each restored afterwards. The message view without `isClaimHidden`: the cancel case red, its toast naming "house (building)". The report ignoring `isClaimHidden`: the same. The footprint rule ignoring it: the views case red. The shared predicate without its hide check: work 121's frame test and this one red together.

The landing gate, `npm run verify` and its receipt check, runs on the rebased tree under the lock. The plan's outcome records it.

## Round outcome

Nothing blocking. F10 is fixed and gated, and the memory half's reading of the frame's own projection is confirmed. F14 and F15 are repaired in `6f6fda38`. The coordinator accepted the work to land after these two fixes, with no further review round.
