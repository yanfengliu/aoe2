# Review iteration 1 - monkTasks accessor migration

## Reviewers

- Codex (`gpt-5.5`, xhigh, read-only): returned two MEDIUM findings.
- Claude (`claude-opus-4-7[1m]`, max): unreachable due quota limit: "You've hit your limit - resets May 5, 7pm (America/Los_Angeles)."

## Findings

### MEDIUM C1 - canonical docs overclaimed Phase 2D completion

Codex verified that `unitCommandsCodec` is still in `TIER_1_CODECS`, while live code still owns and mutates `BridgeState.unitCommands` through bridge helpers and save/load schema-1 projections. The docs said all 35 Tier-1 slots were migrated and Phase 2F could proceed, which would incorrectly greenlight dropping side maps before `unitCommands` is migrated or reclassified.

Disposition: fixed. Updated the monkTasks thread design, roadmap plan, architecture doc, decisions, and devlog summary to state that `monkTasks` is migrated but `unitCommands` remains the last bridge-owned Tier-1 codec before schema-2.

### MEDIUM C2 - schema-1 monkTasks hydrate merged stale snapshot state

Codex verified that `hydrateFromSavedGame` populated `sideMaps.monkTasks` into the accessor-backed map without first clearing the map deserialized from `worldSnapshot.state`. A divergent schema-1 blob with `sideMaps.monkTasks` removed but stale snapshot task state present would resurrect the stale task on load.

Disposition: fixed. Added a red/green save-load regression that clears `sideMaps.monkTasks` while leaving stale `worldSnapshot.state.aoe2.monkTasks`, then verifies the loaded bridge re-saves with no task. `hydrateFromSavedGame` now clears the accessor-backed map before applying schema-1 `sideMaps.monkTasks`.

## Verification

- `npm.cmd test -- tests/simulation/saveLoad.test.ts -t "schema-1 sideMaps.monkTasks"` failed before the hydrate fix with stale task resurrection, then passed after the fix.
- `npm.cmd test -- tests/replay/snapshotEquivalence.test.ts tests/commands/monkContextAtEntity.test.ts tests/simulation/selectionActivity.unit.test.ts tests/simulation/monastery.healConvert.test.ts tests/simulation/monkConversion.test.ts tests/simulation/aiPlayer.test.ts tests/simulation/saveLoad.test.ts tests/simulation/saveLoadIntegrity.test.ts tests/simulation/saveLoadValuePrune.test.ts tests/architecture/fileSizeBudget.test.ts` passed: 10 files, 77 tests.
