# Fog memory stops storing the viewer's own completed buildings

Status: planned
Owner: Claude session from the task card 'Stop fog memory storing the player's own buildings' (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-11

## Problem and outcome

`src/game/simulation/bridge/systems/fogMemorySystem.ts` remembers every building the human sees, including the human's own, in the `aoe2.lastSeenStatic` state slot. Since building sight shipped (v0.3.240 on main), every completed building gives its owner sight around its footprint. So the human's own completed buildings are never under fog, and their memory entries should never be drawn. Those entries still cost state: see `docs/engine-feedback/current.md`, "World-state fingerprints scan unchanged slots at separate tick phases, so a tick pays for stored state". In a stress fixture with 148 buildings no unit had seen, the slot grew from 11.7 KB to 33.7 KB once the buildings saw themselves. That was measured on engine 2.4.1, and main now runs core 2.5, so re-measure before relying on it.

Outcome: the slot holds no entry for the viewer's own completed buildings, provided no consumer needs one.

## Scope

Reserved for this work while the six task cards of 2026-10-10 run: `fogMemorySystem.ts`. It may read the renderer, minimap and replay code.

Foundations give no sight on main. Work 118 decides whether Definitive Edition's do, so here a foundation counts as not seeing.

`vietnameseReveal.ts` belongs to work 117. It writes memory entries for enemy Town Centres. The save format belongs to work 114.

## Approach

First establish, by reading the consumers and by running the game, whether anything uses an entry for the viewer's own completed building. Check these cases:
- a foundation;
- a building that changes owner by conversion;
- allied buildings under shared sight;
- replay viewers.
If nothing does, skip those entries. If something does, record which consumer and stop.

Measure the slot size and the per-tick cost before and after on one saved world, loaded in both arms. Use `npm run ai:tick-ab`, which interleaves both trees in one process, or `scripts/profile-selfplay.mjs --save/--load`. Hold the gate lock during any measurement longer than a minute, so that no full suite runs beside it. The batch protocol is in `docs/policies/local-rules.md`.

## Acceptance criteria

- The consumer audit is recorded here with its evidence.
- A test pins the skip and turns red when the skip is removed.
- The before and after numbers are recorded with the instrument that produced them.
- Saves that hold own-building entries still load.
- An independent read-only review is recorded in `reviews/`, because the change alters persisted state.
- `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed. There is a changelog line only if a player can see the change.

## Implementation steps

- [ ] Audit the consumers, then skip, measure, gate, review and land. Nothing here waits for the other cards. If foundations gain sight, work 118 may later extend the skip to the viewer's own foundations.

## Outcome

Pending.
