# Unit Commands Accessor Migration Plan

Date: 2026-05-04

## Scope

Finish the final Tier-1 bridge-state migration slice by moving `unitCommands` behind `unitCommandsCodec` while preserving command behavior and schema-1 save compatibility.

## Steps

1. Add failing coverage:
   - active unit commands flush into `world.state.aoe2.unitCommands` and join the migrated-codec equivalence set.
   - schema-1 `sideMaps.unitCommands` is authoritative over stale `worldSnapshot.state.aoe2.unitCommands` on load.
2. Migrate mutation/read sites:
   - update `bridgeHelpers` `setUnitCommand`/`clearUnitCommand`/`getUnitTaskState`.
   - remove `unitCommands` from `BridgeState`.
   - update systems and projections to read `accessor.get(unitCommandsCodec)` at execution/read time.
   - update save/load hydration and orphan prune to mutate the accessor-backed map.
3. Run targeted tests until green, then full gates.
4. Run mandatory Codex + Claude review. If Claude remains quota-blocked, record the blocker and proceed with Codex per repo rule.
5. Update docs/devlog/changelog/architecture records and close this thread under `docs/threads/done/unit-commands-accessor-migration/`.
6. Commit and push to `main`.

## Validation

- Targeted: `npm.cmd test -- tests/replay/snapshotEquivalence.test.ts tests/simulation/saveLoad.test.ts`
- Full gates: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`
- Review: Codex `gpt-5.5` xhigh and Claude `claude-opus-4-7[1m]` max, with live-codebase verification directive.
