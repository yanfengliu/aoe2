# Review 7: implementation

## Target

aoe2, work 142 M2b-2b-1: commits `80bf6d3f` (Space, Home, the speed and zoom keys and Shift+Delete take DE's meanings), `de8ab47b` (the records) and `c8ca788a` (the merge of main `73c7c3d4`, the CI curl retries, whose conflict was in the devlog alone), their combined diff against `606ad92c`; HEAD `c8ca788a`, the revision the phase-1 gate passed (vitest 5,295 passed and 3 skipped, Playwright 309 passed and 2 skipped, receipt OK).

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane, started once no other lane's read-only Codex was running. The prompt named the acceptance criteria (each key as DE's, no key taken from a text field, a dropdown or the annotation form, replay mode keeping its Space and Home, no regression in the other keys, the spec matching the code, tests that fail on the old behaviour) and asked for file and line per finding. It read outside the diff: `ReplayHotkeys.ts`, `AnnotationForm.ts`, `entityDeleteHandler.ts`, `economyStateOps.ts` and the browser camera helper, and it checked replay registration order, exact modifiers, the bridge swapped on load, mixed-ownership deletion and the centring arithmetic in memory.

## Reports

### Codex (`gpt-6-astra`)

Two P2 and three P3, no P1.

1. P2: Space revealed a selected enemy's position through the fog. `goToObject.ts` read the unfiltered economy state, and a selection outlives an enemy leaving sight; reproduced with the defense fixture, where the hidden Scout stayed selected and the target followed it from (17.5, 8.5) to (18.5, 8.5).
2. P2: the annotation form's buttons still took game keys. With Save or Cancel focused, Space centred the camera and Ctrl+= zoomed, both preventing the default, against the coordinator's rule that the annotation form keeps its keys; the browser case focused only the textarea.
3. P3: the speed case pressed the main row's − and Shift+= before one assertion, so two wrong bindings could cancel out (1.5 to 1 to 1.5).
4. P3: the spec said every key is matched on `KeyboardEvent.code`, but H, `.` and `,` match `KeyboardEvent.key`.
5. P3: the attack-warning rule in §14.5 still said Space has no target until the next raid; it is Home's.

## Findings and disposition

All five repaired in `b0d05e70`.

1. `objectCentre` gives another player's unit or a resource (a wild animal moves) a target only on a cell the player sees (`isCellVisibleForOwner`); a building, drawn where it was last seen, always has one. `tests/app/goToObject.test.ts`, red on `c8ca788a`.
2. The registry gives a key pressed on any control of a shown form to the form. The first repair took every form, shown or not, and the existing `annotation-ui.spec.ts` Cancel case went red: the hidden form kept focus on Cancel and Alt+L no longer opened the marker list. The repair asks the form's `checkVisibility()`. `tests/browser/de-global-keys.spec.ts` gains the focused-Cancel case (Ctrl+= stays the page's, Space presses Cancel, then Ctrl+= zooms the game again), red on `c8ca788a`; `tests/control/HotkeyRegistry.test.ts` gains the in-form case, red on `c8ca788a`, with a hidden form's key going to the game.
3. One assertion after each main-row key.
4. The spec says the speed and zoom keys match the physical key and the letter and punctuation keys the character typed.
5. "Home has no target".

## Verification

The phase-1 gate on the reviewed revision `c8ca788a` passed: vitest 5,295 passed and 3 skipped, Playwright 309 passed and 2 skipped, receipt OK. Each repair's new test was run on `c8ca788a` and failed there. The gate on the repairs (`47e89d37`) failed in two unit cases: `tests/architecture/humanSightQueries.test.ts` refused the visibility query of repair 1, which asked about the human's own vision alone (round 8 found the same), and `tests/architecture/workDocsIntegration.test.ts` asked for this section. Both are answered in round 8's repair commit.

## Round outcome

Five findings, all repaired; a focused re-review followed (round 8).
