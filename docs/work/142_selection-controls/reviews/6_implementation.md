# Review 6: implementation

## Target

aoe2, work 142 M2b-2a: commits `e6b8c805` (the `selectionStateOps.ts` split), `e03bcc61` ("Work 142 M2b-2a: every building's command card takes DE's keys") and `f1d59114` (the merge of main `c103f8f3`, v0.3.264, whose conflicts were in docs alone), their combined diff against `c103f8f3`; HEAD `f1d59114` was reviewed.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane, serial dispatch. The prompt named the six acceptance criteria (the split behaviour-unchanged; every building key DE's; tiers in DE's order with the first unlocked pressed; no other player's building and no browser or text-field key; slot order for buildings only; tests on the contract, red on the old code; docs agreeing with the code) and carried DE's own evidence, which the sandbox cannot read from the install: `node scripts/dumpDeHotkeys.mjs` for the thirteen building groups and `GATE_HOTKEYS`, and each entry's `string_index_list` decoded (an id less 11000 is the unit's or technology's own string). It read outside the diff: `src/game/control/HotkeyRegistry.ts:82` (the modifier match) and `:114` (the text-field suppression); both were spot-checked and say what it read in them. The Codex check found no failed command in its log (`keep`, no exit `-1073741502`); two `codex.exe` processes of the Codex desktop app were running on the machine, and none was a review. The tree's `git status --porcelain` was empty before and after. Claude lane: not run; one lane was judged enough for a key table, a sort and a handler condition whose contract the browser spec pins key by key.

## Reports

### Codex (`gpt-6-astra`)

No actionable defects. It confirmed that the extraction from `selectionStateOps.ts` preserves behaviour, that all 238 production entries (`buildingProductionTables.ts`) have a key or a documented exception, and that the key dispatch respects the tier order and disabled buttons, and it found no weakened assertion. It changed no file, did not rerun the browser suite or the gate, and could not reach remote CI. Verdict: approve.

## Findings and disposition

None.

## Verification

The first full gate on `f1d59114` failed before the browser suite ran: Playwright's loader threw "Cannot access 'BUILDING_CARD_KEYS_SEED' before initialization". The scenario registry calls `selectionControlsScenarios()` while it is evaluated, and a spec that imports `selectionControls.ts` first (the M1 selection-controls spec) evaluates the registry inside an import cycle (`selectionControls` to `prototypeScenario` to `scenarioRegistry` to `fixtures`), before `buildingCardKeys.ts` has run. The review did not report it (it ran no suite), and the earlier per-file browser runs and the unit suite never loaded the modules in that order. Repaired in `d7b3460c`: the registration reads a literal and wraps the factory. `tests/simulation/selectionControlsScenarios.test.ts` imports in that order, failed to load on `f1d59114` and passes on the repair. The repair changes no behaviour the round judged and was not re-reviewed. The full gate then passed on `d7b3460c`: vitest 5,282 passed and 3 skipped, Playwright 303 passed and 2 skipped, receipt OK.

## Round outcome

Approved with no findings. No further round.
