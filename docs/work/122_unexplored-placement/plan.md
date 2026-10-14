# Placing a building on unexplored ground follows Definitive Edition's rules

Status: active
Owner: Coordinator worker w122-unexplored-placement (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-13

## Problem and outcome

The open defect-register entry of 2026-09-23 records the problem: "The building-placement ghost turns red over unexplored water and forest, so sweeping it across black ground maps them". The ghost reveals what lies under black ground. Spec §12.1's last sentence says Definitive Edition's rule was not known.

Work 118's research (`docs/work/118_foundation-sight/design.md`) found official notes that settle it:
- 44725: a blueprint over unexplored terrain no longer reveals what occupies it, and can be placed but not built where blocked.
- 45185: placement is allowed when part of the footprint is explored, and refused when all of it is unexplored.
- 46295: a foundation over an obstacle hidden by fog is cancelled when villagers try to start it.

Outcome: the placement ghost reveals nothing about unexplored ground, and placing and starting a building there follow those three notes.

## Scope

May edit:
- the placement ghost and its validity feedback;
- the placement validator's handling of unexplored cells;
- the foundation-start check that cancels a foundation over a hidden obstacle;
- spec §12.1's last sentence;
- new tests.

Must not edit:
- `targetFindingOps.ts` (work 121);
- the building sight files (work 118);
- `systems/fogMemorySystem.ts` (work 116);
- the save format and hydrate files (work 114).

The AI's own placement must keep its existing guarantees: the 2026-09 sealing and pending-footprint rules in `bridge/placementSearch.ts` and `bridge/aiSitePlacement.ts`. Change it only if the notes require it, and say so.

## Approach

Reproduce the leak through the real controls first, sweeping the ghost across black ground. Then apply each note, with a test per note. Because the ghost is drawn on screen, the visual change needs before and after captures and a pixel diff (`scripts/captureMapScreenshot.mjs`, `scripts/diffMapScreenshots.mjs`). The batch protocol is in `docs/policies/local-rules.md`.

## Acceptance criteria

- Through the real controls, a test shows the ghost over unexplored water, forest or buildings looks the same as over unexplored open ground. Putting the old check back turns it red.
- Tests cover each of the three notes: placement over partly explored ground, refusal over wholly unexplored ground, and cancellation over a hidden obstacle when building starts.
- Before and after captures and a pixel diff confine the change to the ghost.
- The 2026-09-23 register entry is closed, with the spec rule, a changelog line and a version bump. `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed.

## Implementation steps

- [x] Reproduce through the controls (the bridge's own placement queries), apply the three notes, capture and diff (phase 1, 2026-10-12, branch `unexplored-placement`).
- [x] Fix the independent review of `4792d4fd` (the coordinator's read-only reviewer, 2026-10-12): nine findings fixed in `30b6c566` and its docs commit, and one, a hidden unit frozen under a new foundation, recorded open as the register entry of 2026-10-12, as the coordinator decided. Record: `reviews/0_implementation.md`; the devlog entry of 2026-10-13 holds the fixes, checks and measurements.
- [x] Focused re-review of `51db18ac..765295e7` (round 1, record `reviews/1_implementation.md`): nothing blocking. Finding A, what the frame draws on unexplored ground, is repaired in `8e6a8500`; B and C are corrected in the documents; D is recorded.
- [x] After work 121 landed: rebased onto `c71496a9`, kept work 121's hidden foundations out of the count (`b363fcad`), and took the ghost's before and after captures over the drawn House.
- [ ] A short focused re-review of A's repair, `72d33458` with `b363fcad` (round 2).
- [ ] Gate under the lock, land, close (phase 2, after the coordinator accepts).

## Outcome

Pending.
