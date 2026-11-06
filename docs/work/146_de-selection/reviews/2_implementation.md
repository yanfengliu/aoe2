# Review 2: implementation (M2, round 1's repairs)

## Target

aoe2, work 146 M2: the repairs of review round 1. Commit `e60f86c5` on branch `de-selection-m2-1106`, its diff against `0f65b185` (the revision round 1 reviewed) for `src`, `tests` and `design`.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder under fleet's ignored `tmp/review-runs/`. The prompt listed round 1's six findings and their repairs, asked whether each is correct and complete and what each could break (every producer and consumer of `SelectionState`, the forced redraw against the capture-phase click listener, the media query against the 1120px block and the band's ceilings, the tooltip key against the other tooltip cases, and whether each new test can fail), asked for a file and line per finding and a read outside the diff, and told it to run nothing, since a gate was queued. The runbook's sandbox check: `keep`, no failed commands; the tree's status and diff were the same before and after.

## Reports

### Codex (`gpt-6-astra`)

Two P2, no P1. The report, redacted only of its absolute paths:

1. P2: the summary can still grow and move the command tiles. `hudCommandPanel.css:778` caps the narrow heading's width at 130px and leaves its height free; only the icon grid reserves its 94px. At 800x600, sixty villagers split among attacking, building, gathering, dropping off and moving give five activity entries that wrap past that reserve, so the summary grows, the palette moves down and scrolls, and later changes of work or deaths move it again. From the source, not rendered.
2. P2: the new "unchanged frames write nothing" assertion cannot see a write. `selectionGroupPanelDom.test.ts:142` calls `disconnect()` before `takeRecords()`; the updates are synchronous, the observer's callback has not run, and disconnecting drops its pending records, so the assertion sees none even when both updates write. Take the records before disconnecting, with a deliberate write as the control.

It found the six round-1 repairs correct: member types are read afresh, are in the signature and drive the clicks; `force` passes the hold and stays compatible with the capture-phase refresh; the 1280x600 case fits with no conflict with the 1120px block or the replay timeline's reserve; focus follows the member and the tooltip key tells same-type members apart without changing command or page keys; the held-click baseline follows the press. Outside the diff it read `commandCardHotkeys.ts`, `pressHold.ts`, `makeReplayBridge.ts`, `createReplayWorldOnly.ts`, `agentSnapshot.ts`, `saveGameOps.ts`, `saveSchema.ts`, `browserTestApi.ts`, `browserTestTicks.ts` and `selectionActivity.ts`: the replay and test APIs pass the larger state through, and saves do not hold `SelectionState`.

## Findings and disposition

Both repaired in the commit after `e60f86c5`.

1. FINDING-1 (P2): a group's heading keeps one height whatever the group's work. Its name holds to one line above 1120px and two below, and its work line to one, each ellipsised, with the whole text in a tooltip on each (`hudCommandPanel.css`, `render.ts`, `selectionPanel.ts`). The breakdown lists at most five kinds of work (`selectionActivity.ts`). Test: `tests/browser/de-selection-group-panel.spec.ts`, at 800x600 and 1280x720, sixty Militia selected, then the longest work line the breakdown can make written into the paused panel: the heading's height, the last icon and the stance tile stay where they were and the bar does not scroll; both red on a mutant without the clamp. The same class for a single unit's work line (beside its portrait, ahead of the deck below 1120px) is older than M2 and outside the group panel; it is on plan 106's card.
2. FINDING-2 (P2): the records are taken before the observer is disconnected, and a frame that changes hit points is the control, which must show writes. Red on a mutant whose bar refresh writes every frame.

## Verification

The two cases pass on the repair and are red on their mutants; the browser spec passes whole. The full gate on the repair is recorded in plan 146.

## Round outcome

Two findings, both repaired, each with a check red without its repair. No further round: the repairs are a few lines of CSS and markup and one test fix, each with its own failing control.
