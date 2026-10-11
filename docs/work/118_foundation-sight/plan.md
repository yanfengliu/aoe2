# Foundations give the line of sight Definitive Edition gives

Status: complete
Owner: Claude session from the task card 'Settle whether DE foundations give line of sight' (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-11

## Problem and outcome

Spec §12.2, in the paragraph "Every completed building sees", says a foundation gives no sight until it is complete. It also records that this has not been checked against Definitive Edition. The references found so far concern the ground under a foundation, not a circle around it:
- a DE forum bug report about unstarted enemy foundations revealing the tiles they stand on;
- the SiegeEngineers Aoe2Sheet line "Building foundations reveal the ground beneath them and can be placed on partially black terrain".

It matters in play. In the owner's reproduction, two enemy Militia took a Barracks foundation from 1,200 to 711 hit points with nothing drawn for its owner. See `docs/learning/defect-register.md`, the entry "Only seven building types gave their owner any sight".

Outcome: an authoritative, cited answer for Definitive Edition, and the game and spec agreeing with it.

## Scope

Research comes first. Candidate sources are the pinned SiegeEngineers/aoe2techtree data at `3bb43b14`, the Aoe2Sheet, recorded Definitive Edition play, and other primary sources. If the answer needs an owner decision, stop and ask.

Reserved for this work while the six task cards of 2026-10-10 run:
- the §12.2 line starting "Every completed building sees";
- `buildingSeedVision.ts`, `finalizeBuildingConstruction.ts`, `completedBuildingVision.ts` and `buildingVisionSources.ts`. Work 117 may add exports to `buildingVisionSources.ts`.

`fogMemorySystem.ts` belongs to work 116. If foundations gain sight, the viewer's own foundations would never be under fog. If 116 has landed by then, extend its skip in this change after rebasing. If it has not, tell the coordinator.

Placement on unexplored ground is the open 2026-09-23 register entry about the placement ghost, and it stays out of scope unless the answer settles it.

## Approach

Cite the answer, then take one of two paths:
- keep the rule and mark it checked in §12.2, which is a docs-only change;
- change the game so a foundation gives the sight Definitive Edition gives.

The batch protocol is in `docs/policies/local-rules.md`.

Research result (2026-10-11, [design.md](design.md)): in current DE a foundation nobody has started building gives its owner no sight, not even of its own footprint. That matches this game, so §12.2 now cites it. No reference says whether DE gives sight to a building whose construction has started, so §12.2 keeps that case recorded as unverified. The design lists three ways to settle it. The Aoe2Sheet line predates DE.

## Acceptance criteria

- The answer and its sources are recorded here, or in a `design.md` beside this plan.
- If the game changes, tests are written first and turn red under mutation. The change carries a defect-register entry, the spec rule, a changelog line and a version bump. `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed.
- If only the spec changes, the commit is docs-only: it runs the content checks and gets no version bump.

## Implementation steps

- [x] Research and cite: [design.md](design.md).
- [x] Docs-only change on branch `foundation-sight`: §12.2 cites DE for the unstarted case and keeps the started case unverified. No code changes, so `fogMemorySystem.ts` (work 116) is untouched.
- [x] Coordinator acceptance, then a docs-only push to main.

## Outcome

Complete on 2026-10-11, docs-only, no version change. Main `d3f397ec` cites DE in spec §12.2 and adds the design and devlog; `7294d0c6` dates the cited patch notes. Both were pushed on top of `0e59f4ab`.

Answer and sources: in current DE a foundation nobody has started building gives its owner no sight, not even of its own footprint. This game already behaves this way, and spec §12.2 now cites it. The sources are in [design.md](design.md): update 87863 and two 2023 DE bug reports the developers answered (builds 78174 and 81058), a 2023 retest on the DE forum, and the pre-DE date of the Aoe2Sheet line.

Decision: the coordinator chose option 1 of the design. §12.2 records what was found, and the started case stays recorded as unverified: no reference says whether DE gives sight to a building whose construction has started. A three-minute test in DE would settle it: place a House far away, start it with one villager, pull the villager away, and see whether the ground around and under it stays fogged. The coordinator is taking that test to the owner. If DE gives such a building sight, the change needs a vision source at construction start, save and replay compatibility for the building visibility slot, and work 116's fog-memory skip extended to the owner's foundations.

Checks: `npx vitest run tests/architecture` passed 15 files and 150 tests (exit 0) on the rebased tree, including `workDocsIntegration.test.ts` and `checkoutLineEndings.test.ts`. No runtime gate ran, because no executable file changed. No gate was added: the rule had no test before this work and still has none.

Review: the coordinator reviewed the phase-1 diff and accepted it. No independent model review ran, because the change is docs-only.

Limits: AoEZone sits behind a bot check and was not read. The wiki line-of-sight pages refused the fetch. No recorded DE play was examined. The side findings were queued, not acted on: works 121 (unstarted foundations hidden from opponents) and 122 (placement on unexplored ground), plus the Town Watch exceptions and the stale header of `tests/simulation/buildingVision.test.ts`.
