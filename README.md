# aoe2

A replica of Age of Empires 2 made using `civ-engine` so that I know the engine works.

Primary documents:

- [Official spec](design/spec-final.md)
- [Implementation plan](design/implementation-plan.md)
- [Engine feedback](docs/engine-feedback.md)

Current implementation status:

- `TypeScript` + `Vite` + `Phaser 3` app shell is running
- `civ-engine` owns the prototype simulation tick and render projection
- a deterministic 36x24 prototype map renders with terrain, Town Centers, Villagers, and Scouts
- normalized content is generated from `design/stats/*.csv` into `generated/content/content.json`

Useful commands:

- `npm.cmd install`
- `npm.cmd run content:validate`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run dev`
