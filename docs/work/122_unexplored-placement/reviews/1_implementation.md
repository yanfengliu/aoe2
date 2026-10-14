# Review 1: implementation

## Target

Repository aoe2, branch `unexplored-placement`, the repair of round 0's findings: commits `30b6c566` (the fixes) and `765295e7` (their devlog, summary line and plan step), the range `51db18ac..765295e7`. `git diff 51db18ac 765295e7` is 27 files, 777 insertions and 161 deletions. `51db18ac` itself is outside the range (round 0's record says why), but the reviewer read it as well: F12 is about its text.

## Reviewers and coverage

The same read-only reviewer as round 0, dispatched again by the coordinator on 2026-10-13 for a focused re-review of the repair. As in round 0, its model, CLI and prompt were not passed to the implementation worker. Its evidence shows what it did: two new probes against the live bridge, `shownForeignProbe.mts` and `shownMemoryProbe.mts`; a cost probe, `previewCostStep.mts`; and two more mutation harnesses, `vitest.mutant2.config.mjs` and `vitest.mutant3.config.mjs`, with scratch copies under `mut2/`. They are in the coordinator's scratchpad under `review122/`, and the two shown probes are copied into the worktree's ignored `tmp/probes/review122/`. It reported that F0 and F2 to F9 are fixed, that each new gate catches its defect, and that the labelling cache cannot serve a stale labelling.

## Reports

As in round 0, the reviewer's authored report went to the coordinator, who passed its findings to the implementation worker as four lettered items, A to D, with severities, scenarios and the files they concern. This record does not reproduce that report. At the coordinator's direction, the table below gives each item in short form, with the coordinator's letter in brackets. IDs continue from round 0.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F10 | (A, should-fix) The rest of F0's class. On an unexplored cell the placement counted only the player's own claims (`placementKnowledge.ts:180`). But the frame draws another player's building whole once one cell of its footprint is seen (`renderStateOps.ts:62-71`, `isFootprintSeen`), and draws a remembered building whole from fog memory. On the hidden fixture, from (21,15) the enemy House at (24,17) is drawn with only (24,17) explored. A House ghost at (23,18) was green, the click was accepted, and the villager's arrival cancelled it with the false "hidden under the fog of war" toast (`shownForeignProbe.mts`). Back at (19,13) the House is drawn from memory, and the ghost was still green (`shownMemoryProbe.mts`). DE fixed the same in update 50292 (2021-07-06). | Accepted. As the coordinator directed, the placement counts everything the frame draws: the player's own entities; anyone else's entity with a footprint cell seen through the shared sight, by its live claims; and a building drawn from fog memory, by its remembered footprint, never by its live claims, which would reveal a destruction. | Commit `8e6a8500`. `placementKnowledge.ts` counts what the frame draws: `isDrawnLive`, the frame's own rule, for live claims, and `rememberedCells`, an index of the unexplored cells fog memory draws on, built at most once a tick. `placementFootprint.ts` gains the view's `rememberedAt`, and `placementBlockReport.ts` names a remembered building. A new lookout variant of the fixture puts the villager where it sees one cell of the enemy House from boot. `placementDrawnClaims.test.ts` has four cases, and the views test has one more. Each half goes red on its own mutation (Verification). Spec §12.1, `decisions.md` and the changelog no longer say an ally is drawn only where the player's sight reaches. Open: work 121 hides an enemy's unstarted foundation from the frame, so once it is on main the live half must hide it too, or the ghost would reveal it; that is done after 121 lands. |
| F11 | (B, docs) The F1 register entry credited the review with citing DE update 185872 for walkable foundations. The review had cited 44725, which fixed units trapped within gate foundations. The entry also did not say that the full refund makes the trap free. And spec §12.1's "never a unit" over-read the notes. | Accepted. | The docs commit after it. The entry quotes update 185872, "Fixed a bug preventing Villagers from walking over unbuilt Foundations", and keeps the claim to villagers. It says 44725 fixed units trapped within gate foundations, and adds that with a full refund the trap costs nothing: place, hold, build later, get everything back. The entry's decision and spec §12.1 present the card's unit handling as this game's design decision: 44725 speaks of ground occupied "by a building or unit", and 87863 stopped own and allied units obstructing construction. |
| F12 | (C, nit) `51db18ac` says "DE has no reachability check at all". That needs DE update 185872, under which DE cancels a foundation an AI villager fails to path to. | Accepted. | The docs commit. §8.1 says DE checks no route when a foundation is placed and, since update 185872, cancels one an AI villager fails to path to. §12.1's pointer to it says the same. |
| F13 | (D, nit) The labelling cache keys on the shared sight, and no test changes the shared sight between two asks in one tick. | Recorded, not fixed, on the coordinator's direction. The shared sight changes only inside a step (an alliance, Spies), which the tick in the key already covers, so the sight in the key is a second guard. | None. |

## Verification

The repair is `8e6a8500`. These checks ran on that tree on 2026-10-13, while work 121 held the gate lock, so unit files ran one at a time and no browser ran:
- The four new cases and the new views case pass.
- The 62 unit files that touch placement, construction, deletion, fog memory or the debug snapshot: 498 passed, 1 skipped.
- `tests/architecture`: 150 passed. `tsc --noEmit`, and eslint on the changed files: exit 0.
- The reviewer's two probes, re-run on the repair: the ghost is red in both. In `shownForeignProbe.mts` the click is refused, naming "a house (building) at (24,18)".
- Mutations, each restored afterwards. The fix reverted (own claims only, no memory): all four cases red. Fog memory off: the two remembered cases red. Fog memory read through the live claims: the destroyed-in-the-fog case red. The live half off: the boot case red. Fog memory records every building the player sees each tick, so on a bridge that has stepped, the live and remembered halves agree; the boot tick is where they part. The footprint rule ignoring `rememberedAt`: the views case red.
- The DE notes cited (44725, 50292, 87863 and 185872) were read on ageofempires.com on 2026-10-13, and the quotes are theirs.
- Not run: `npm run verify`, the full suites, `tests/browser/placement-ghost-fog.spec.ts`, the before and after captures of the ghost over the drawn House, and CI. The lock was held, so these wait until work 121 has landed.

## Round outcome

Nothing blocking. The reviewer found F0 and F2 to F9 fixed, each with a gate that catches its defect, and the labelling cache sound. F10 is repaired, F11 and F12 are corrected in the documents, and F13 is recorded. A short focused re-review of F10's repair follows before landing, as round 2.
