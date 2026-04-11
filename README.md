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
- the HUD includes a minimap driven from the same render frame as the main scene
- normalized content is generated from `design/stats/*.csv` into `generated/content/content.json`
- automated coverage currently includes content normalization, deterministic scenario generation, and simulation visibility behavior

Useful commands:

- `npm.cmd install`
- `npm.cmd run content:validate`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run dev`
