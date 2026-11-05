# Review 0: implementation

## Target

aoe2, work 142 M1, the staged diff of worktree `selection-controls-1104` against base commit `ec250733`: 29 files, 817 insertions and 130 deletions, SHA-256 `ed44e9781e042d19e409206bcbdf9611ac09799f0ab90406952501f17eddda9e`. The reviewed bytes are commit `fed8203e` ("Work 142 M1 as reviewed in round 0"), whose diff against `ec250733` has that SHA-256; the patch itself is kept, ignored, at fleet's `tmp/review-runs/aoe2-work142-r0/reviewed.patch`. Edits that landed in the tree while the review ran (a new test in `tests/input/voxelSelectionController.test.ts` and four new files) are outside its verdict, as the reviewer says.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, `--sandbox read-only`, codex-cli 0.163.0, serial with no delegation. It read the diff and the tree, cited files outside the diff (`src/audio/mountGameAudio.ts`, `src/audio/gameAudioController.ts`, `src/rendering/roles/unitRole.ts`, `src/input/voxelCameraController.ts`), ran the typecheck and the 21 focused tests of the diff, and probed the bridge and in-memory mutations. The Codex log check printed `keep 0 lines of failed commands`. Browser tests and the full gate were not run by it; CI status was unreachable from its sandbox.
- Claude lane: not run. The brief prefers Codex's read-only sandbox, and one lane was judged enough for this diff; this is a missing second lens, not an approval.

## Reports

### Codex (`gpt-6-astra`)

Found **one major and five minor issues** in the supplied staged diff. Concurrent unstaged edits appeared during review; they are outside this verdict. I modified no files.

1. **Major — mixed villager/sheep groups lose actionable context targeting.** `selectionStateOps.ts:341` now makes their `selectedEntityType` null, but `chooseVillagerContextTarget` still requires `'villager'`. A friendly villager can consequently intercept a right-click intended for the sheep or boar beneath it. A real-bridge probe reproduced attacking with a villager-only selection and idle behavior after adding a sheep. **Fix:** derive command eligibility from the selected members, independently of the group's display type.

2. **Minor — "drawn on screen" still differs from the selected set.** `voxelSelectionController.ts:314` uses the marquee's ground-centred circles rather than presented bodies. At zoom 2.4, I reproduced two villagers with body parts inside the bottom edge, but double-click selected only one. Conversely, a circle can intersect the top edge while its entire body is outside. **Fix:** use presented-body intersection for screen visibility, reconcile the marquee equivalence in the spec, and test partially visible bodies at the edges.

3. **Minor — mixed groups lose their selection voice.** The changed group type also reaches `mountGameAudio.ts:100`, **outside the diff**. It calls `unitRole(selection.selectedEntityType)`: the new null produces no role and suppresses the villager selection cue. **Fix:** obtain the primary selected unit's actual type instead of using the group label's type.

4. **Minor — `clickCell` rejects legitimate armed ground orders.** `command.ts:22` exempts placement but not attack-move, patrol or attack-ground. Those left clicks issue orders rather than select units, so an occupied destination should remain legal. The "nothing … depends on timing" claim in `gate-proofs.md:21` is also too strong: occupancy is sampled before subsequent awaited operations and mouse dispatch. **Fix:** distinguish selection clicks from ground orders and state the live-motion limitation. Economy positions are coarse cells; fractional rendered positions do not make this check atomic.

5. **Minor — the claimed wildlife coverage is absent.** `liveAnimalsAreUnits.test.ts:74` tests live sheep and a synthetic dead boar, not live boar, deer or wolf. Removing those three species from `ANIMALS` through an **in-memory-only mutation left all four tests green**, contradicting `defect-register.md:19`. **Fix:** parameterize the live cases across all four species. Also require nonempty covered points before the carcass loop at line 102, which otherwise permits zero assertions.

6. **Minor — the building-exclusion browser assertion is vacuous.** `selection-controls.spec.ts:128` claims its box excludes buildings, but no building intersects that box's selection geometry. Removing the kind filter yielded only the two villagers, boar and tree. **Fix:** include a building within the tested bounds and assert its geometric eligibility before asserting that selection excludes it.

No additional findings for carcass/memory filtering, Monk routing, stack grouping, control groups, idle cycling, input-clock timing, determinism or save format. No nits. The 500-line gate passed.

Validation: typechecking and the 21 focused checks from the staged diff passed. A concurrently added unstaged mixed-group regression test failed, corroborating finding 1. Browser tests/full verification were not run; remote CI status was unavailable because sandbox networking blocked GitHub.

(Report as written to `codex-report.md`, with the absolute-path links shortened to file:line; no other change.)

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | Codex 1: a villager group with a sheep lost the villager context rule | Accepted: reproduced red by a new test before the repair | `src/input/selectionMembers.ts` `isVillagerGroup` reads the members; test "lets villagers grouped with a sheep act through a friendly villager in front of the target"; a mutant restoring the type check goes red |
| F1 | Codex 2: "on screen" used the box's circle at the feet | Accepted | `isDrawnInView` tests the recipe's still body parts against the view; `selectionMembers.test.ts` and the controller test "takes a villager whose feet are below the bottom edge…"; the marquee mutant goes red; spec §9.4 reworded |
| F2 | Codex 3: a villager-and-sheep group lost its selection voice | Accepted; fixed as a class: the voice is the primary unit's own, which also voices mixed groups that were silent before | `src/audio/primarySelectionRole.ts`, `tests/ui/primarySelectionVoice.test.ts`; a mutant reading the group type goes red; changelog line |
| F3 | Codex 4: `clickCell` refused armed ground orders; the timing claim was too strong | Accepted | the refusal skips an armed ground order (new test seam `getArmedGroundOrder`) and units the page does not draw; gate-proofs entry's "Not racing" and "Bound" corrected |
| F4 | Codex 5: boar, deer and wolf untested; the carcass loop could assert nothing | Accepted | the live cases run for all four kinds, and the carcass case requires covered points; a mutant leaving only sheep goes red |
| F5 | Codex 6: no building inside the box of the "never takes" case | Accepted | the fixture puts a House of the human's in that box, and the spec asserts the other player's villager, the boar, the tree and the House stand inside the box before the drag |

One change made with the repairs, not asked for by the review: a live animal now ranks between the units and the buildings in the hit order, not with the units. The review was on the unit-layer version. Ranking it with the units changed which of a unit and an animal drawn at one point a click takes, which DE does not settle in any source found; the middle layer keeps that order as it was and still puts the animal over the building in front of it. `game-selection-click.spec.ts`'s stack walk now visits the sheep before the house, and its raised-roof click moves along the roof line off the outline of the map's hidden sheep; both adaptations are explained in the spec's comments.

## Verification

After the repairs: typecheck clean; `npx vitest run tests/input tests/rendering tests/ui tests/app tests/architecture` plus the three selection simulation files, 136 files and 1,315 tests passed; the four repair mutants (F0, F1, F2, F4) each went red and were restored byte-identical (SHA-256 checked); 76 browser tests over twelve selection and click specs passed on the repaired build. The final `selection-controls.spec.ts`, with its fixture, run against base `ec250733`'s code in a control worktree: 6 of 7 red for the reasons in the plan, and the box-takes-only-yours case green on both, as an unchanged rule should be.

## Round outcome

One major and five minor findings, all accepted and repaired. The repairs, and the middle-layer change, have not been reviewed by this round; a focused re-review is round 1.
