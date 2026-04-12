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
- completed Barracks in Feudal Age can now also queue Spearmen, and Spearmen now apply a fast anti-scout bonus in combat
- Town Centers can now research Feudal Age once the player has two qualifying Dark Age buildings
- Feudal villagers can now place Archery Ranges, and completed Archery Ranges can queue Archers
- completed Archery Ranges in Feudal Age can now also queue Skirmishers, and Skirmishers now apply a fast anti-archer bonus in combat
- Feudal villagers can now place Stables, and completed Stables can queue Scout Cavalry
- Feudal villagers can now place Blacksmiths, and Blacksmith research can modify Archer combat stats for both existing and newly trained units
- Feudal villagers can now place Markets, and completed Markets can buy or sell food, wood, and stone against gold with dynamic exchange-rate movement
- Feudal villagers with a completed Blacksmith can now place Watch Towers, and completed Watch Towers automatically fire on nearby enemy units
- Feudal Town Centers can now research Castle Age once the player has two qualifying Feudal buildings
- completed Stables in Castle Age can now queue Knights
- villagers in Castle Age can now place additional Town Centers, and those Town Centers can train Villagers through the same command-panel flow as the starting one
- Villagers can now garrison inside Town Centers and completed Watch Towers, and defensive buildings can ungarrison them back onto nearby tiles through the command panel
- Garrisoned Town Centers can now auto-fire defensive arrows at nearby enemy units, so housed Villagers contribute directly to early defense
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
- repeated left click on the same tile to cycle through every selectable entity stacked there, including resources
- double click a friendly unit to select all visible friendly units of the same type on screen
- left click and drag to box-select movable friendly units under your control
- the selection panel now shows simple unit icons for single-unit selections and grouped unit selections
- right click to issue context orders to the current selection
- villagers use right click on visible resources to gather them explicitly
- villagers can use right click on owned Town Centers or completed Watch Towers to garrison for safety
- military units use right click on visible enemy units and buildings to attack them
- `W`, `A`, `S`, `D` or arrow keys to pan
- mouse wheel to zoom
- the selection panel to queue Villagers from the Town Center
- the selection panel to research Feudal Age from the Town Center after two qualifying Dark Age buildings are complete, then research Castle Age after two qualifying Feudal buildings are complete
- the selection panel to place Houses, Mills, Lumber Camps, and Mining Camps with Villagers
- while placing a building, a green outlined footprint grid shows a valid placement area and a red footprint with blocked X markers shows an invalid area
- the selection panel to place Barracks in Dark Age, then Stables, Archery Ranges, Blacksmiths, Markets, and Watch Towers in Feudal Age, then additional Town Centers in Castle Age, and queue Militia, Spearmen, Scout Cavalry, Archers, Skirmishers, or Knights from completed military buildings
- completed Markets can use the selection panel to buy Food, Wood, or Stone with Gold, or sell those resources back for Gold
- selected Town Centers and completed Watch Towers can use the selection panel to ungarrison housed Villagers
- in the focused Town Center defense fixture, garrisoning a Villager now causes the Town Center to auto-kill the nearby enemy Scout
- right click with a selected production building now sets its rally point, so newly trained units walk toward that target automatically
- completed Blacksmiths can now research Fletching, which currently buffs Archer attack damage and range
- enemy AI currently runs a minimal scripted opening that builds out of population cap, sends Militia at the human economy, and can finish conquest-style matches
- for deterministic test fixtures, the dev server also accepts `?seed=conquest-victory-fixture`, `?seed=conquest-defeat-fixture`, `?seed=feudal-missing-prereq-fixture`, `?seed=feudal-age-fixture`, `?seed=feudal-blacksmith-fixture`, `?seed=feudal-market-fixture`, `?seed=feudal-stable-fixture`, `?seed=castle-age-fixture`, `?seed=castle-town-center-fixture`, `?seed=feudal-spearman-fixture`, `?seed=feudal-skirmisher-fixture`, `?seed=feudal-watch-tower-fixture`, `?seed=town-center-defense-fixture`, `?seed=villager-selection-fixture`, `?seed=double-click-selection-fixture`, `?seed=mixed-selection-fixture`, and `?seed=tile-selection-cycle-fixture`

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
