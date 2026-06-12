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
- Mouse hover near a screen edge to pan in that direction when the game is fullscreen or the browser window fully fills the monitor
- Mouse wheel to zoom

## Test fixtures

The dev server accepts a `?seed=<name>` URL parameter to load deterministic test scenarios. See the devlog under `docs/devlog/` for the current list of seeds.

## Watching replays (including LLM playtest campaigns)

Every recorded session — including the bundles exported by `npm run playtest:llm` campaign runs — can be replayed bit-exact in the app:

1. Find the session bundle. Campaign runs write it next to their `--out` prefix as `<out>.json` (e.g. `output/campaign-2/envelope.json.json`); the small `<out>.envelope.json` sibling is run stats, and `<out>.llm-trace.jsonl` holds the agent's per-decision reasoning — worth reading alongside the replay, since each line carries the tick range it played out in.
2. Start the app (`npm run dev`) and click the **Replay…** button in the HUD's save/load cluster.
3. Pick the **From file** tab and select the bundle `.json`. The dialog also offers the current live session and prior sessions persisted in IndexedDB.
4. Drive playback with the bottom timeline panel (scrub bar) or hotkeys: `Space` play/pause, `←`/`→` step one tick, `Home`/`End` jump to start/end, `Alt+T` toggle the timeline panel, `Esc` exit replay.

Caveat: the replay renderer projects player 1's fog of war (the human observer). LLM-playtest agents play as player 2, so parts of their base and army activity sit under fog except where player 1's line of sight reaches; there is no spectator/fog-off toggle yet.

## See also

- [Official spec](design/spec-final.md)
- [Implementation plan](design/implementation-plan.md)
