# aoe2

A replica of Age of Empires 2 made using `civ-engine` so that I know the engine works.

Primary documents:

- [Official spec](design/spec-final.md)
- [Implementation plan](design/implementation-plan.md)
- [Engine feedback](docs/engine-feedback.md)

Current implementation status:

- `TypeScript` + `Vite` + `Phaser 3` app shell is running
- `civ-engine` owns the prototype simulation tick and render projection
- a deterministic 36x24 prototype map renders with terrain, Town Centers, Villagers, Scouts, and nearby starting resources
- fog of war and explored-state shading now run through `civ-engine` `VisibilityMap`
- villagers now run an autonomous gather-and-dropoff economy loop for food and wood
- the player can now select Town Centers and Villagers, queue Villagers, place Houses, and raise population cap through completed construction
- right click now resolves context-sensitive villager orders, so visible resources can be explicitly targeted for gathering instead of only using the autonomous assignment loop
- villagers can now build Mill, Lumber Camp, and Mining Camp, and completed drop-off buildings are used for resource returns instead of hardwiring all income through the Town Center
- villagers can now build a Barracks, and completed Barracks can queue Militia through the same command-panel flow used by the Town Center
- Militia can now be selected and right-clicked onto visible enemy units to run the first deterministic melee-combat loop
- Militia can now be selected and right-clicked onto visible enemy buildings to destroy them through the same deterministic combat system
- the first AI rush is now live: the enemy can build a House and Barracks, queue Militia, and pressure the human economy without player input
- conquest-style victory and defeat now resolve inside the simulation and freeze the match when the outcome is final
- the HUD includes a minimap driven from the same render frame as the main scene
- startup is seedable through the page URL, which keeps browser gameplay fixtures deterministic during testing
- normalized content is generated from `design/stats/*.csv` into `generated/content/content.json`
- content validation now passes cleanly and reports explicit coverage instead of warning on known unsupported civs
- automated coverage currently includes content normalization, deterministic scenario generation, visibility behavior, villager economy rules, production/building rules, and browser-level control/gameplay smoke tests through Playwright

## Run locally

Requirements:

- `Node.js 24+`
- the sibling repo `../civ-engine` present on disk, because this project depends on it through a local `file:` dependency

Setup:

1. From the repo root, install dependencies:
   `npm.cmd install`
2. Install the Playwright Chromium runtime used by browser gameplay tests:
   `npm.cmd run test:browser:install`
3. Start the dev server:
   `npm.cmd run dev`
4. Open the local Vite URL shown in the terminal. By default this is `http://127.0.0.1:5173`.

The game currently starts directly into the prototype map. Use:

- left click to select units and buildings
- right click to issue context orders to the current selection
- villagers use right click on visible resources to gather them explicitly
- military units use right click on visible enemy units and buildings to attack them
- `W`, `A`, `S`, `D` or arrow keys to pan
- mouse wheel to zoom
- the selection panel to queue Villagers from the Town Center
- the selection panel to place Houses, Mills, Lumber Camps, and Mining Camps with Villagers
- the selection panel to place Barracks with Villagers and queue Militia from completed Barracks
- enemy AI currently runs a minimal scripted opening that builds out of population cap, sends Militia at the human economy, and can finish conquest-style matches
- for deterministic test fixtures, the dev server also accepts `?seed=conquest-victory-fixture` and `?seed=conquest-defeat-fixture`

## Verification

Run the standard project checks with:

- `npm.cmd run content:validate`
- `npm.cmd test`
- `npm.cmd run test:browser`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run verify`

## Useful commands

- `npm.cmd install`
- `npm.cmd run dev`
- `npm.cmd run content:validate`
- `npm.cmd test`
- `npm.cmd run test:browser:install`
- `npm.cmd run test:browser`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run verify`
