# Review 1: implementation (M1, the round 0 repairs)

## Target

aoe2, work 148 M1: the repairs of review round 0 ([record](0_implementation.md)) and the tooltip repair found during it. Commit `55f2b911` on branch `de-hud-1106`, its diff against the round-0 revision `f5b62c7e` for `src`, `tests`, `scripts` and `design`.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder under fleet's ignored `tmp/review-runs/`. The prompt named each repair and asked whether each was correct and complete, and whether the tooltip change broke the controller's other guarantees: the clicked control's focus-tooltip suppression, placement mode and the minimap, the group panel's member icons, touch, a redraw that moved the control, the cost of the new listener and of the scan per redraw, and the new dep's wiring for the replay bridge. The sandbox check passed (no failed command in its log), and the tree was unchanged across the run. Outside the diff it cites `groupPanel.ts:151` and `makeReplayBridge.ts:236`.

## Reports

### Codex (`gpt-6-astra`)

One P2. The report, redacted only of its absolute paths:

1. P2: tooltip restoration ignores the pointer's position. `tooltips.ts:84` finds the replacement by key alone, even where the redraw moved it: removing an earlier group member shifts the later icons, which the renderer packs in order (`groupPanel.ts:151`), so a resting pointer can show a tooltip anchored to a control it no longer covers. Reproduced in memory: the round-0 revision hides the tooltip; this one keeps it until a later pointer event corrects it. Fix: keep the pointer's coordinates and hit-test the replacement before restoring hover ownership; add a test where the redraw moves the controls.

It found no defect in the four round-0 repairs, found the replay bridge's population wiring present (`makeReplayBridge.ts:236`) and the copy's move to `tooltipCopy.ts` unchanged; its in-memory checks of the clicked-focus suppression, keyboard and touch ownership and group-member identity passed, and a pointer move runs no scan. It ran 51 focused tests and the typecheck, no browser test.

## Findings and disposition

1. FINDING-1 (P2): repaired. The controller keeps the pointer's last position (from pointerover and the document's pointermove) and keeps a redrawn control's tooltip only where `document.elementFromPoint` at that position falls inside the replacement. Test: a DOM case in `tests/ui/tooltipFollowsRedraw.test.ts` closes a group panel's icons up under a resting pointer, which loses the tooltip, and draws them again in place, which keeps it; red on `55f2b911`'s controller. The browser cases (`de-production-queue`, `de-selection-group-panel`, `placement-mode-hud-layout`, `command-deck-fits`) pass on the repair.

## Verification

Recorded in plan 148 with the gate on the repair.

## Round outcome

One P2, repaired with a test red without it. No further round: the repair is small, checked by its own test and the browser specs, and the brief asks for the findings that matter to be fixed and checked rather than another round.
