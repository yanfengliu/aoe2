# `unitCommandOps` file-size split design

Status: Accepted for v0.1.6 roadmap continuation.

## Goal

Clear the active architecture gate by shrinking `src/game/simulation/bridge/unitCommandOps.ts` below 500 LOC without changing the public `UnitCommandOps` surface or runtime behavior.

## Shape

- Keep `createUnitCommandOps(...)` as the composition root returned to existing bridge wiring.
- Extract selection-facing helpers into `unitSelectionOps.ts`: selected-sheep/unit queries plus `selectEntityAtCell`, `selectEntityById`, and `clearSelection`.
- Extract sheep command helpers into `sheepCommandOps.ts`: `setSheepMoveCommandDirect` and `issueSheepMoveCommand`.
- Preserve call-site contracts by composing both helper factories into the returned `UnitCommandOps` object.
- Remove the `unitCommandOps.ts` legacy file-size exemption only after the file is under 500 LOC.
