# Architecture drift log

Append a row whenever `ARCHITECTURE.md` changes. Each entry is a short record of a
structural change, so future agents can trace how the shape of the repo evolved.

| Date | Change | Devlog entry |
| ---- | ------ | ------------ |
| 2026-04-17 | Established `docs/architecture/ARCHITECTURE.md` to document existing runtime layers and directory structure. | `docs/devlog/detailed/` |
| 2026-04-23 | Added `src/game/simulation/mapGeneration/` for the spawn-list dedupe helper and the procedural default-map generator. | `docs/devlog/detailed/2026-04-23_2026-04-23.md` |
| 2026-04-23 | Split the 9,968-line `prototypeScenario.ts` god-file into `src/game/simulation/fixtures/` (13 category modules + shared common + barrel index) plus new `mapGeneration/` modules (`sharedTerrainHelpers`, `startingOffsets`, `applyStandardPlayerOpening`, `blackForestMap`, `arenaMap`, `constants`). `prototypeScenario.ts` retains public types + dispatcher + re-exports (~790 lines). | `docs/devlog/detailed/2026-04-23_2026-04-23.md` |
| 2026-04-23 | Introduced `src/game/simulation/bridge/` for helper modules factored out of `createSimulationBridge.ts` (pure helpers, render projector + sheep vision, Trebuchet pack/unpack ops factory, fog-memory ops factory). `createSimulationBridge.ts` shrinks from 9,519 → 8,792 lines across four move-only commits. | `docs/devlog/detailed/2026-04-23_2026-04-23.md` |
