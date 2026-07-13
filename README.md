# aoe2

An AoE2-style RTS prototype built on `civ-engine`.

## Requirements

- Node.js 24 or newer
- The sibling repo `../civ-engine` present on disk, since this project depends on it through a local `file:` dependency
- The sibling repo `../voxel` present on disk at the revision recorded in `.github/voxel-commit`, since the optional Three.js world renderer depends on its local `file:` package

## Setup

From the repo root:

1. Install and build the reusable renderer package: `npm.cmd --prefix ../voxel install`
2. Install this project's dependencies: `npm.cmd install`
3. Install the Playwright Chromium runtime (one-time, used by browser gameplay tests): `npm.cmd run test:browser:install`
4. Start the dev server: `npm.cmd run dev`

Then open the local Vite URL printed in the terminal. By default this is `http://127.0.0.1:5173`.

The development, test, typecheck, lint, and build commands rebuild `../voxel` first. A fresh checkout therefore needs the sibling package and its dependencies installed before those commands run.

## Renderer modes

Phaser remains the safe default. Open the app normally, with `?renderer=phaser`, or with an unsupported renderer value to use the established Phaser world renderer.

Add `?renderer=voxel` to opt into the isometric voxel proving path, for example `http://127.0.0.1:5173/?seed=aoe2-prototype&renderer=voxel`. This mode renders the antialiased, daylight-lit Three.js world on a WebGL canvas beneath a transparent Phaser Canvas overlay, so the existing camera, pointer input, selection, fog, feedback, minimap, and DOM HUD remain in place. Its original procedural art uses detailed role-specific buildings, animated rigid-part units, resources, contact shadows, material palettes, and sparse terrain props; faction color appears as readable accents instead of painting every structure as one team-colored block. Unit roots follow the existing smooth display interpolation, while grounded feet, paired limbs, cavalry legs, and siege wheels advance by displayed travel distance so cadence follows visual speed. Travel direction eases through path corners, feet flex in that direction, and pausing freezes gait consistently even when selection forces redraws; independent identity-phased breathing and secondary motion remain renderer-timed. None of this changes simulation state, saves, replays, commands, or hit geometry. If the Three renderer cannot initialize, the app logs a warning and falls back to Phaser.

The voxel path is not the default yet. Its current adapter renders terrain and entities on a flat ground plane even though the projection contract carries terrain elevation; elevation-aware overlay/input hit geometry and broader parity validation are promotion work. The Phaser mode remains the reference path while those gaps are open.

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
- Mouse hover near a screen edge to pan in that direction when the game is fullscreen or the browser window fully fills the monitor
- Mouse wheel to zoom

## Test fixtures

The dev server accepts a `?seed=<name>` URL parameter to load deterministic test scenarios. See the devlog under `docs/devlog/` for the current list of seeds.

Add `?civ=<name>` to choose your (the human player's) civilization — e.g. `?civ=Goths` for cheaper infantry, `?civ=Britons` for faster shepherds. The name is case-insensitive and matched against the 30 AoE2 civilizations; an unknown name falls back to the default (Britons).

## Watching replays (including LLM playtest campaigns)

Every recorded session — including the bundles exported by `npm run playtest:llm` campaign runs — can be replayed bit-exact in the app:

1. Find the session bundle. Campaign runs write it next to their `--out` prefix as `<out>.json` (e.g. `output/campaign-2/envelope.json.json`); the small `<out>.envelope.json` sibling is run stats, and `<out>.llm-trace.jsonl` holds the agent's per-decision reasoning — worth reading alongside the replay, since each line carries the tick range it played out in.
2. Start the app (`npm run dev`) and click the **Replay…** button in the HUD's save/load cluster.
3. Pick the **From file** tab and select the bundle `.json`. The dialog also offers the current live session and prior sessions persisted in IndexedDB.
4. Drive playback with the bottom timeline panel (scrub bar) or hotkeys: `Space` play/pause, `←`/`→` step one tick, `Home`/`End` jump to start/end, `Alt+T` toggle the timeline panel, `Esc` exit replay.
5. To spectate a specific player, cycle the fog-of-war perspective with the timeline panel's **Fog: P\<n\>** button (or `Alt+F`). LLM-playtest agents play as player 1 (the human slot, so player 2's in-game AI is a real opponent), so `Fog: P1` — the default — already shows the agent's base and army. The toggle changes only the rendered fog — the HUD's resource panels stay on player 1, and replays default back to player 1's view on entry.

Caveat: bundle replay is same-engine-major tooling (civ-engine policy) — bundles recorded under engine 0.x (e.g. the 2026-06-11 campaign-2 bundle) replay only with 0.x tooling; bundles recorded from engine 1.0 onward replay in the current app.

## See also

- [Official spec](design/spec-final.md)
- [Implementation plan](design/implementation-plan.md)
