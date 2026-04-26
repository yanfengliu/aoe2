# Iter-4 verification

## Per-finding verdict

| ID | Verdict | Notes (only if NEEDS-CHANGE) |
|----|---------|-----|
| V4-1 | OK | |
| V4-2 | OK | |
| V4-3 | OK | |
| V4-4 | DOC-ONLY | |
| V4-5 | NEEDS-CHANGE | Doc sweep is incomplete. `docs/devlog/summary.md:5` still says `createSimulationBridge.ts` is `7606` lines / a remaining huge file, and `docs/architecture/drift-log.md:17-18` still reference deleted `docs/devlog/detailed/2026-04-24_2026-04-25.md`. |
| V4-6 | DOC-ONLY | |
| V4-7 | OK | |
| V4-8 | OK | |
| V4-9 | OK | |
| V4-10 | OK | |
| V4-12 | OK | |
| V4-13 | OK | |
| V4-14 | OK | |
| V4-15 | OK | |
| V4-16 | OK | |
| V4-17 | OK | |
| V4-18 | OK | |
| V4-19 | NEEDS-CHANGE | One bridge child still reaches back to the facade for a shared type: `src/game/simulation/bridge/wirePostSeedOps.ts:59` uses `import('../createSimulationBridge').UnitCommand` instead of `./sharedTypes`. |
| V4-21 | DOC-ONLY | |
| V4-23 | DOC-ONLY | |

## New defects found in this diff

- `src/game/simulation/bridge/wirePostSeedOps.ts:59` leaves one remaining bridge-internal type dependency on `createSimulationBridge.ts`, so the `sharedTypes.ts` cleanup is not complete.
- `docs/devlog/summary.md:5` and `docs/architecture/drift-log.md:17-18` are still stale after the doc/rename sweep.

## Anti-regression spot-checks

- `V3-1` still holds: building fog-memory write path is footprint-aware in `src/game/simulation/bridge/systems/fogMemorySystem.ts:29-49`, and the destroy cleanup path now matches it in `:100-116`.
- `V3-7` still holds: monk conversion still aborts progress when the target is out of vision in `src/game/simulation/bridge/monkTaskAppliers.ts:121-132`.
- `V3-12` still holds: mutual annihilation still resolves to `draw` before defeat/victory branches in `src/game/simulation/bridge/systems/conquestOutcomeSystem.ts:38-55`.

## Overall verdict

NEEDS-CHANGE
