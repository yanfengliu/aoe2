# Post-Sheep Roadmap

> Plan owner: Claude (autonomous mode). Each slice ends with a single coherent commit chain, codex + gemini review, and the standard gate (`npx vitest run`, `npx tsc --noEmit`, `npx vite build`, `npm run test:browser`).

## Sequencing principle

Small known-bug follow-ups first → Castle Age content breadth → Castle Age depth (siege, monks, castle) → Imperial Age + win conditions → AI → save/load → UX/debug → engine-debt refactors. Content additions happen in earlier slices because they unlock AI scope and they are mostly additive (low blast radius). Save/load and engine-debt move toward the end because they touch many files.

## Slice 1 — Small known-bug follow-ups
- Cancel sheep movement orders when a villager begins gathering that sheep (resolves the gather-state thrash flagged by codex).
- Extend `selectOwnedUnitsByTypeInRect` and the `GameScene` double-click flow so double-clicking an owned sheep selects every visible owned sheep on screen.
- Add fog memory for static enemy buildings and resources: once a cell has been seen, the last-known building/resource entity stays in the projected render frame as a faded silhouette until the cell is revealed again.
- Move `prototypeHerdableMovement` ahead of `prototypePlayerCommands` by detangling the dependency cycle (likely by dropping the implicit chain from another system that does not need it).

## Slice 2 — Castle Age production-line upgrades
- Crossbowman (Archery Range, requires Castle Age): replace Archers in build menu when researched, base stats per `design/stats/units.csv`.
- Pikeman (Barracks): Spearman upgrade, anti-cavalry bonus retained.
- Light Cavalry (Stable): Scout Cavalry upgrade.
- One-time research instances per Castle Age workshop, applied to existing units of the predecessor type and to all newly trained ones (mirrors the existing `Fletching` pattern).

## Slice 3 — New Castle Age unit lines
- Camel (Stable, Castle Age): anti-cavalry bonus, no upgrade chain yet.
- Cavalry Archer (Archery Range, Castle Age): mobile ranged unit, no Heavy Cav Archer upgrade yet.
- Stat tables come from `design/stats/units.csv`. Both units behave like existing scout/archer for movement/combat — minimum new code beyond train menu, content table, combat-bonus row.

## Slice 4 — Siege Workshop
- New building `siege-workshop` placeable by villagers in Castle Age.
- New units: Mangonel (long-range area-effect simplified to single-target high damage), Scorpion (long-range single-target bolt), Battering Ram (anti-building, garrisons infantry for speed in a follow-up).
- Combat-bonus tables extended: Ram vs buildings, Mangonel vs grouped infantry as a single-target damage bonus for now.

## Slice 5 — Monastery and Monks
- New building `monastery` placeable by villagers in Castle Age.
- New unit `monk` trainable from Monastery, no combat damage.
- Behaviors: heal nearby friendly units (per-tick HP regen on a target with cooldown); convert nearby enemy units (slow conversion that flips `unit.owner`); pick up neutral relics on the map.
- Relics: spawn 1-3 relics on the default scenario as neutral collectibles. Once carried into a Monastery, generate gold per tick for the owner.

## Slice 6 — Castle (defensive structure)
- New building `castle` placeable by villagers in Castle Age (large footprint, expensive).
- Castle auto-fires on visible enemies (reuse the Watch Tower combat loop, scaled).
- Castle is the production seat for civ unique units (data-backed). For the first slice, ship one demo civ's unique unit (e.g., Britons → Longbowman, since it has full stats).
- Garrison capacity larger than Town Center.

## Slice 7 — Imperial Age progression and final tier units
- New age `imperial` researched at the Town Center, requires two Castle Age buildings completed.
- Final-tier upgrade-line units (where data-backed): Arbalest (Crossbow upgrade), Halberdier (Pikeman upgrade), Hussar (Light Cav upgrade), Heavy Cavalry Archer, Cavalier or Paladin (Knight upgrade — pick whichever is data-backed first), Champion (Long Swordsman upgrade), Onager (Mangonel upgrade).
- Bombard Cannon and Trebuchet from Siege Workshop / Castle.
- One Imperial-tier military upgrade per Blacksmith line.

## Slice 8 — Wonder, Relic, and Score win conditions
- New building `wonder` placeable in Imperial Age (large footprint, very expensive, single per player).
- Wonder countdown: when complete, start a 200-tick countdown; if Wonder still standing at countdown end, that player wins.
- Relic victory: if a player holds all relics in their Monasteries for the same countdown, they win.
- Score: simple aggregated score from kills + buildings + economy; stop at game end and present in the post-game summary.
- Defeat detection beyond conquest already exists; add the Wonder/Relic countdown displays to the HUD and the post-game summary card.

## Slice 9 — Save and load (round-trip)
- Serialize the world (entities, components, custom side maps like `unitCommands`, `sheepMoveOrders`, `wildlifeStates`, `combatStates`, `population`, `playerResources`, `marketExchangeRates`, `researchedTechnologies`, `playerAges`, `townCenterRefs` etc.) to a single JSON blob through a versioned schema.
- `bridge.saveGame()` returns the blob; `createSimulationBridge(seed, savedBlob)` boots from it.
- Vitest round-trip: drive a deterministic fixture, save mid-match, reload, advance, assert the same end state.
- HUD save/load buttons.

## Slice 10 — AI baseline (real)
- Replace the Barracks-rush stub with a planner-style AI:
  - opening plan: scout, gather, House timing.
  - villager assignment: dynamic rebalance among food / wood / gold / stone based on goals.
  - age-up decisions tied to economy and military pressure.
  - military mix per age (Spearman / Archer / Skirm in Feudal; Knight / Crossbow / Pikeman in Castle; Champion / Cavalier / Arbalest in Imperial).
  - attack-group formation: gather N units before pushing, retreat at low strength.
  - basic scouting response (build a Tower toward incoming).
  - difficulty modifiers: AI gather rate multiplier and reaction-tick budget.

## Slice 11 — UX, polish, debug overlays
- Tooltips on HUD chips and command buttons.
- Debug overlays (toggle via keyboard): selection bounds, pathing, fog state, AI state, per-tick perf metrics.
- Per-unit responsiveness pass: queue feedback when a command is rejected, click-to-select sound or visual bump.
- Two new map scripts beyond Arabia (Black Forest-ish dense-trees and Arena-ish walled-start), generated deterministically from seeds.

## Slice 12 — Engine-debt refactors
- Replace hand-rolled placement/footprint scans with `civ-engine`'s `OccupancyGrid` + path helpers.
- "Find nearest legal spawn with egress" helper extracted from the trapped-spawn fix.
- A small `WorldDebugger` probe for coarse-vs-fine unit position.
- Fixture-validation pass for occupancy and start-cell legality (run at scenario boot).
- File a `civ-engine` feature request for sub-cell occupancy / crowding.

## Process per slice

For each slice in order:

1. Write a slice spec at `docs/superpowers/specs/2026-04-17-slice-NN-<topic>.md`.
2. Write a slice plan at `docs/superpowers/plans/2026-04-17-slice-NN-<topic>.md` (TDD bite-sized tasks).
3. Dispatch a fresh general-purpose subagent with the spec + plan + repo conventions; subagent commits per task.
4. After the subagent reports back, run `codex review --commit <range>` and `gemini -p "review …"` in parallel.
5. Triage: ship real findings as a fix commit, document non-issues in the slice devlog entry.
6. Run the full gate (vitest + tsc + vite build + browser) and append a devlog entry.
7. Move to the next slice.

## Out of scope for this roadmap

- Multiplayer / netcode.
- Native desktop packaging.
- Audio polish beyond placeholder hooks.
- Late-expansion DE civ content not backed by `design/stats/*.csv`.
