# Review 8: implementation

## Target

aoe2, work 142 M2b-2b-1: the round-7 repairs, commit `b0d05e70` (and `47e89d37`, records only), their diff against `c8ca788a`; HEAD `47e89d37`.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane, a focused re-review. The prompt named the two P2 repairs and the three P3, and asked whether the form rule could swallow game keys in play, whether `checkVisibility` holds for a `display: none` ancestor in Chromium, whether the sight rule could hide the player's own objects or break H, `.` and `,`, and whether the new tests fail on `c8ca788a`. It read outside the diff: `AnnotationForm.ts`, `AnnotationController.ts`, `selectionRecallHotkeys.ts`, `humanSight.ts` and `visibilityQueries.ts`, and Blink's `checkVisibility` and implicit-submission sources.

## Reports

### Codex (`gpt-6-astra`)

Two P2 and one P3.

1. P2: Space refused objects the player sees through shared sight. `goToObject.ts` asked the human's own vision alone, so an ally's villager, drawn and selectable, was no target (reproduced with the real bridge at (64, 8)), nor an enemy seen through Spies; `humanSightQueries.test.ts` refuses the same line.
2. P2: a hidden form's input kept the game's keys away. The repair fell through to the text-field rule for an input of a hidden form, so a radio or checkbox that submitted the form with Enter and kept focus would leave the game's keys dead. Reproduced in jsdom with the form's visibility stubbed; not reproduced in Chromium.
3. P3: the spec said a resource "that can move" needs sight, where the code asks it of every resource not the player's, and it did not say that only a shown form keeps its keys.

## Findings and disposition

All three repaired in the commit after `47e89d37`.

1. `objectCentre` asks the player's sight: its own vision and every owner `getSharedVisionOwners` names (allies, and everyone with Spies), as `humanSight.ts` does for the frame. `tests/app/goToObject.test.ts` gains a unit only an ally sees, red on `47e89d37`; `humanSightQueries.test.ts` passes again.
2. A control inside a form now returns the form's answer at once: shown, the form's key; hidden, the game's, whatever the control. `tests/control/HotkeyRegistry.test.ts` gains a radio and a textarea of a hidden form, red on `47e89d37`. The browser case of the defect, Enter on the annotation form's severity radio and then Ctrl+=, passes on `47e89d37` as on the repair: Chromium did not keep the radio's focus in a way that took the key, as the reviewer also could not show. It stays as a check of the flow.
3. The spec states the rule as coded: a unit or resource not the player's needs the player's sight, and only a shown form keeps its keys.

## Verification

Each repair's unit case was run on `47e89d37` and failed there, and passes on the repair. The full gate on the repair commit is recorded in plan 142's Outcome.

## Round outcome

Three findings, all repaired. No further round: the repairs are confined to the two rules the round named, each with a test.
