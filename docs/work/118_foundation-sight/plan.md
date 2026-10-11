# Foundations give the line of sight Definitive Edition gives

Status: planned
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

## Acceptance criteria

- The answer and its sources are recorded here, or in a `design.md` beside this plan.
- If the game changes, tests are written first and turn red under mutation. The change carries a defect-register entry, the spec rule, a changelog line and a version bump. `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed.
- If only the spec changes, the commit is docs-only: it runs the content checks and gets no version bump.

## Implementation steps

- [ ] Research and cite, then make the docs-only or code change, then land. The research waits for nothing. A code change that would touch `fogMemorySystem.ts` waits for work 116.

## Outcome

Pending.
