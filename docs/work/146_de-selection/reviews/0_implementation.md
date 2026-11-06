# Review 0: implementation

## Target

aoe2, work 146 M1: Shift and Ctrl with a click or a box, and the 60-unit cap. Commit `3318260f` on branch `de-selection-1106`, its diff against `f2f3b338` (main, v0.3.271) for `src`, `tests` and `design`; HEAD `a1da5d3c`, the merge of main `17e4068b` (docs only).

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder under fleet's ignored `tmp/review-runs/`. The prompt gave the task's criteria and sources, the binding decision on plain gestures, and six things to look for (the input and bridge code, every writer that could bypass the cap, changes to plain gestures, placement, armed orders and the paused renderer, tests that cannot fail, and the spec against the code), and asked for a file and line per finding and a read outside the diff. The lane's log shows no sandbox failure (`-1073741502` absent); it cited `controlGroupOps.ts:74`, outside the diff's hunks, which reads as it says. The tree's `git status --porcelain` and `git diff HEAD` were empty before and after the run. The Claude lane was not run: Codex is the brief's preferred reviewer, and one lane covered the diff.

## Reports

### Codex (`gpt-6-astra`)

Two P2. The report, redacted only of its absolute paths:

1. P2: a Shift click on empty ground can select a whole unit type. `voxelSelectionController.ts:255` tries the Shift double-click before checking for a target. Reproduced: a Shift click on a villager, then 100 ms later a Shift click on verified empty ground 3 iso pixels away, grew the selection from 1 villager to 7. This breaks the stated rule that a Shift click on the ground changes nothing. Reject an empty or ineligible target before the double-click.
2. P2: a Shift click on a unit already selected can drop the rest of the selection. `selectionModifierOps.ts:35` empties `base` for a mixed building-and-unit selection and then treats the selected unit as joining. Reproduced: a Town Center and a villager in two control groups, the building's group recalled and the villager's appended (the unchanged `controlGroupOps.ts:74` allows the mix), then a Shift click on the villager: `[Town Center, villager]` became `[villager]`, changing the primary entity. Check membership before replacing an incompatible selection.

It also reported: every file read; 39 focused tests passed and neither case is covered; both findings reproduced through the real bridge and controller; no cap bypass found, an oversized saved group included; paused additions and removals redraw. Browser tests and mutants inspected, not rerun.

## Findings and disposition

Both repaired in the commit after `a1da5d3c`.

1. FINDING-1 (P2): `modifierClick` now ends at a click with no target before the Shift double-click, as a plain click on the ground never forms a double-click. Test: `tests/input/selectionModifierClicks.test.ts`, a Shift click on a villager and a quick Shift click on empty ground 3 iso pixels away keep one villager; red on `a1da5d3c`, where the ground click answered true, having added the type.
2. FINDING-2 (P2): `addUnitsToSelection` drops what is already selected before deciding whether the selection is one a box could have made, so a Shift click on any selected member changes nothing. Test: `tests/simulation/selectionModifiers.test.ts`, the Town Center and a villager selected together, Shift on the villager: unchanged and false; red on `a1da5d3c`, where it answered true and left the villager alone.

## Verification

The two new cases were red on `a1da5d3c` and green on the repair, with the rest of `tests/input` and `selectionModifiers.test.ts` (64 cases). The full gate on the repair is recorded in plan 146.

## Round outcome

Two findings, both repaired. No further round: each repair is a few lines, and each has a case red without it.
