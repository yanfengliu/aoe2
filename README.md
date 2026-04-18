# aoe2

An AoE2-style RTS prototype built on `civ-engine`.

## Requirements

- Node.js 24 or newer
- The sibling repo `../civ-engine` present on disk, since this project depends on it through a local `file:` dependency

## Setup

From the repo root:

1. Install dependencies: `npm.cmd install`
2. Install the Playwright Chromium runtime (one-time, used by browser gameplay tests): `npm.cmd run test:browser:install`
3. Start the dev server: `npm.cmd run dev`

Then open the local Vite URL printed in the terminal. By default this is `http://127.0.0.1:5173`.

## Controls

Selection:

- Left click to select a unit, building, or resource
- Repeated left click on the same tile cycles through every selectable entity stacked there
- Double click a friendly unit to select all visible friendly units of the same type on screen
- Left click and drag to box-select friendly units

Orders:

- Right click to issue a context-sensitive order to the current selection
- Villagers right-click resources to gather, or right-click owned Town Centers and Watch Towers to garrison
- Military units right-click enemy units and buildings to attack

Camera:

- `W`, `A`, `S`, `D` or arrow keys to pan
- Middle-mouse drag to pan directly
- Mouse hover near a screen edge to pan in that direction
- Mouse wheel to zoom

## Test fixtures

The dev server accepts a `?seed=<name>` URL parameter to load deterministic test scenarios. See the devlog under `docs/devlog/` for the current list of seeds.

## See also

- [Official spec](design/spec-final.md)
- [Implementation plan](design/implementation-plan.md)
