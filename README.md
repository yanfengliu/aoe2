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
- the HUD includes a minimap driven from the same render frame as the main scene
- normalized content is generated from `design/stats/*.csv` into `generated/content/content.json`
- content validation now passes cleanly and reports explicit coverage instead of warning on known unsupported civs
- automated coverage currently includes content normalization, deterministic scenario generation, visibility behavior, villager economy rules, and browser-level control/gameplay smoke tests through Playwright

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

- `W`, `A`, `S`, `D` or arrow keys to pan
- mouse wheel to zoom

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
