# Review 10: implementation

## Target

aoe2, work 142 M2b-2b-2b: DE's twenty control groups, commit `fe027fd4` on branch `selection-controls-m2b2b2b-1105`, its diff against `7cfad94c` (M2b-2b-2a after round 9); HEAD `fe027fd4`.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder under fleet's ignored `tmp/review-runs/`. The prompt named the keys, the group store and its save, the recall's render mark, the tests and the records, and asked for a file and line per finding and a read outside the diff. The runbook's check of the lane's log printed `keep`, and the tree's status was the same after the run as before; the lane noted that HEAD moved during its run (a docs commit and the merge of main, `4999b649` and `471f676b`), with the cited code unchanged. The Claude lane was not run, as in rounds 5 to 9.

## Reports

### Codex (`gpt-6-astra`)

One P1 and three P2.

1. P1: the Shift behaviour claimed as DE's default contradicts the sources. `controlGroupOps.ts:73` took the selection out of its groups and merged it into the group: with groups 1 and 2, 1 then Shift+2 deleted group 1 and left the selection as it was (reproduced). DE's update 36202 says "Shift-selection preserves separate groups by default", and the 2023 forum report described a selection bug that hotfix 82587 fixed. Reconcile the behaviour and spec §14.2.
2. P2: both idle cycles bypass the paused renderer (inherited). `registerBridgeSystems.ts:357` passes the raw `selectUnitsByIds` into the input ops, so on a paused `aoe2-prototype` '.' and ',' changed the selection and a step left the new unit's `selected` false.
3. P2: the append test's "counted once" assertion cannot see duplicate stored members, since a recall deduplicates (`selectionInputOps.ts:269`); removing append's own deduplication left every test green while the save held duplicates.
4. P2: the range test cannot see a recall's range check go, since the store is empty; removing it left every test green, and a hand-written save holding group 20 then recalled.

Checked without finding: all 81 bindings against the installed DE profile and through the real registry, no collision with any other registration, the replay stubs, generation handling, every reader of the slot, the browser helpers and the records.

## Findings and disposition

All four repaired in the commit after `471f676b`.

1. Shift with a group's key now adds the group's survivors to the selection and changes no group (`appendControlGroupToSelection`), DE's default since update 36202 ("Selecting more than one control group using Shift no longer merges them into one group by default"), with hotfix 82587 mending that default in 2023. What the branch had done is DE's Shift Group Appending option, which this game does not have. One group per unit stays for Ctrl with a digit, sourced from the one number DE shows beside a unit; the 2020 report of a merge emptying a group predates 36202 and is no longer cited for it. The browser cases (Shift+1 and Alt+Shift+1 add the group to the selection and leave it unchanged) are red on M2b-2b-2a's code; the unit case holds the selection and the save's groups. Spec §9.4 and §14.2, plan 142, the changelog and the register say so; plan 142's starting-state note keeps its first reading with the correction beside it.
2. The class is "a bridge path that selects without telling the paused renderer": the recall (repaired before the review), Shift's addition (wrapped in `selectionMutation`) and the idle cycles, repaired at the source by marking the change in the `selectUnitsByIds` that `registerBridgeSystems.ts` hands the input ops. A table of four paused cases in `tests/simulation/controlGroupsTwenty.test.ts`; each path unmarked turned its cases red (the idle wrapper's removal turned both idle cases red).
3. Shift no longer stores anything, so the duplicate case is gone; the one-group case and the Shift case now read the members from the save itself.
4. The range case loads a save holding groups 20 and -1, written by hand, and holds that no recall or Shift reaches them; red with the recall's range check removed.

## Verification

`tests/simulation/controlGroupsTwenty.test.ts` (ten cases) and `controlGroups.test.ts` passed on the repair; mutants removing the idle mark, the Shift addition's mark, the recall's range check and one group per unit each turned it red. `tests/browser/de-control-group-keys.spec.ts` (four cases) was red on M2b-2b-2a's build at each case's first new claim and green on the repair, with `control-group-double-tap.spec.ts` and `de-global-keys.spec.ts` (12 cases); a mutant making U do nothing turned the U case red. The full gate is recorded in plan 142.

## Round outcome

Four findings, all repaired. No further round: the P1 repair narrows Shift to the sourced default and removes code, and each P2 repair has a case red without it.
