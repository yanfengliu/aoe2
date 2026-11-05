# Review 9: implementation

## Target

aoe2, work 142 M2b-2b-2a: DE's go-to and select-all building keys, commits `1e6ed527` (records) and `deb60934` (the change), their diff against main `12c87c8d`; HEAD `deb60934`.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder under fleet's ignored `tmp/review-runs/`. The prompt named the keys, the select-all path, the turn, the chip-grid change, the tests and the records, and asked for a file and line per finding and a read outside the diff. The lane's log held no failed sandbox command (the runbook's check printed `keep`), and the tree's status and diff were the same after the run as before. The Claude lane was not run: one independent lane for a change of this size, as rounds 5 to 8 did.

## Reports

### Codex (`gpt-6-astra`)

One P1 and one P3.

1. P1: Ctrl+Shift+Space breaks the shown building card's keys and slot order. A group of several building types has no shared type (`selectedEntityType` is null), and `commandCardHotkeys.ts:162` takes the card's building from that type, so the keys fell through to the unit card's handler: the panel showed the primary Castle's buttons and Q pressed nothing (reproduced in jsdom with the real bridge, registry and panel; Ctrl+Shift+V then Q worked). `buildingCardKeys.ts:259` skipped the slot order for the same reason, so the card read Longbowman, Petard, Trebuchet where DE's is Longbowman, Trebuchet, Petard. Asked for a regression that presses Ctrl+Shift+Space and then a card key.
2. P3: "no page receives" Chrome's reserved keys is too broad (`goToBuildingHotkeys.ts:14`, spec §14.2): Chromium's `IsReservedCommandOrKey` delivers them to the page in fullscreen and reserves none in an app window. Keep them unbound; qualify the statement.

Checked without finding: every new chord with Shift's uppercase key and exact modifiers, ownership, independent turns per key, deleted buildings and new foundations, a select-all that finds nothing keeping the selection, the save-load bridge swap and replay selection, the paused renderer's selection flags (through `selectionMutation`), the unit-only and lone-building icon paths, both retained military-group captures at full resolution, and the Chrome actions the spec names for each key, against Chrome's shortcut page and Chromium's accelerator table.

## Findings and disposition

Both repaired in the commit after `deb60934`.

1. The card's building is now the primary selected entity's, found by `selectedEntityId` among the economy's buildings: `cardBuildingTypeOf` in `src/ui/hud/buildingCardKeys.ts`, which `inBuildingCardSlotOrder` now takes as its second argument and the key handler and the panel both call. The class was "the card's building read from the group's shared type"; these were its two readers (the villager card's test reads `buildOptions`, which a group of buildings has none of). Tests: a browser case in `de-building-go-to-keys.spec.ts` presses Ctrl+Shift+Space, holds the Castle's train buttons in DE's slot order and presses Q, which queues a Longbowman at the Castle; on `deb60934` it is red at the slot order (Longbowman, Petard, Trebuchet), and with the key handler's old line put back it is red at Q. A frame-between case in `tests/app/commandCardHotkeys.test.ts` and a unit case for `cardBuildingTypeOf` in `tests/ui/buildingCardKeys.test.ts`; the first is red with the old handler line. **Adapted:** `buildingCardKeys.test.ts`' slot-order case passes the card's building as the new argument where its state literal carried it; the frame-between harness gives its selections `selectedKind` and `selectedEntityId` and its economy the selected building, the fields the handler now reads; same assertions.
2. The code comment and spec §14.2 say a page in a tab never receives the keys, which Chrome passes on only in fullscreen and in an installed app's window; this game still binds none of them. Listed for the owner: in fullscreen this game could take Ctrl+W for the Wonder as DE does.

## Verification

The browser spec (six cases), the frame-between harness and the building-card unit tests passed on the repair; `de-building-card-keys.spec.ts`, `de-command-card-keys.spec.ts`, `de-military-card-keys.spec.ts` and `selection-controls.spec.ts` passed with them (35 cases). The full gate is recorded in plan 142.

## Round outcome

Two findings, both repaired. No further round: the P1 repair is confined to where the card's building is read, with a browser case red on the reviewed code and red again with the old key handler put back, and the P3 is wording.
