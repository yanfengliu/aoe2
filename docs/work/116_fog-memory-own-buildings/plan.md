# Fog memory stops storing the viewer's own completed buildings

Status: active
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

### Consumer audit (worker, 2026-10-11)

One reader exists: `fogMemoryOps.getFogMemoryEntities`, through `renderStateOps.getRenderState`, whose entities feed the voxel world, the minimap (`src/ui/hud/minimap.ts` draws `renderState.entities`), click hit-testing (which skips memory views) and the browser test API. `grep lastSeenStaticCodec` finds no other reader: the slot is written by `fogMemorySystem.ts`, `vietnameseReveal.ts` (enemy Town Centres) and the save loaders, and no rule of play reads it. The AI has no fog memory.

- **While the viewer owns the building, nothing reads its entry.** The civ-engine `RenderAdapter` projects every live entity (`createProjector` filters on nothing but position and renderable), and `renderStateOps` passes every entity whose owner is the viewer whatever the fog. So the building's id is always in the live set, and `getFogMemoryEntities` skips an entry whose id is live. This holds for a foundation exactly as for a finished building: the safety of skipping does not depend on sight.
- **Once the building stops being the viewer's, the entry is read.** Three cases:
  - Deleted or destroyed where nothing else of the viewer's sees its ground: the building's own sight leaves with it, and an entry is forgotten only when its ground is seen empty, so the entry is drawn as a ghost. That is a defect, not a use: reproduced in the real game (control tree at `f906a255`, dev server, `raid-warning-fixture`, a click on the lone House, the Delete key: the House stays drawn dimmed, `isMemory: true`, id 2161 at (44, 26), and the minimap keeps its marker). Definitive Edition leaves no ghost of your own building. Defect register, 2026-10-11.
  - Converted away by an enemy Monk (Redemption): with the viewer's sight gone from the building, the entry is what keeps it on the map, as last seen in the viewer's colours. This IS a use. AI Monks never convert (`monkTaskOps.visitAiMonkTaskCandidates` gives them deposit, pick-up and heal only), so no match against the AI reaches it today, but the mechanic exists. Kept: a building an enemy Monk is converting (an entry in `aoe2.conversionState`) is remembered as before. A conversion takes at least 50 ticks (progress 1 a tick, flip at 50), and the Monk system runs before the fog-memory system, so the entry is written before the flip.
  - Converted by the viewer's own Monk: the reverse. The entry it had as an enemy building is no longer needed and is dropped.
- **Allied buildings under shared sight** are not the viewer's, are remembered as before, and must be: the spec's "Shared sight shows everything in it" (§10.9) says an ally's base stays on the map as last seen, and `sharedVisionEntities.test.ts` holds it. The same ghost reaches an ally's building, though: `tmp/probes/allyGhostProbe.mjs` deleted an ally's Town Center in `allied-three-player-fixture` with the ally's Militia blinded, and it stayed drawn with `isMemory: true`. Out of this card's scope; recorded OPEN in the register entry.
- **Replay viewers.** `makeReplayBridge` uses the same `renderStateOps` with the perspective owner as `humanPlayerId`; ghosts are shown only for player 1's recorded memory. A recording made before this change re-simulates its fog memory without these entries, so `SessionReplayer.selfCheck` would report `aoe2.lastSeenStatic` as changed; every other slot re-simulates the same (the A/B below digested the world without that slot and matched at every chunk for 10,000 ticks).

### Decisions

- **Skip every building the viewer owns, foundations included** — wider than the outcome's "completed". The plan scoped foundations out because they do not see, but the skip rests on the live owner pass, not on sight, and a foundation's entry produces the same ghost. Keying on ownership also keeps this work independent of work 118's sight decision. Mutation M4 below shows foundations do get entries in a played opening.
- **Drop a held entry only for the same entity** (`generation` matches). An entry under a recycled id is a destroyed building's ghost and stays; main overwrote it the moment a seen building took the id.
- **Old saves** load unchanged and lose these entries on their first tick. A ghost of a building destroyed before such a save stays until its ground is seen, as it would have on main.

### Measurements (2026-10-11, engine 2.6.1, gate lock held 00:36-00:55)

One saved world: `scripts/profile-selfplay.mjs --config castle --warmup 30000 --save` in a control worktree at `f906a255` (71 units, 45 buildings; player 1, an AI seat, owns 17). Both trees loaded it.

- **Slot size** (one tick after the load, each tree writing a save; read by `tmp/probes/fogMemorySlotSize.mjs`): 22,227 bytes and 111 entries before, 18,372 bytes and 94 entries after. The 17 dropped entries were player 1's standing buildings, 3,838 bytes; the rest is 91 resources (17,587 bytes) and 3 enemy buildings. World state 58,696 to 55,087 bytes. At the end of the A/B run (tick 40,001): 20,736 against 16,835 bytes.
- **The closest committed stand-in for the 148-building probe** (`building-vision-fixture`, 25 buildings of the player's, no units, tick 2): 5,754 bytes before, 8 bytes after.
- **Interleaved A/B** (`tmp/probes/fogMemoryTickAb.mjs`, which runs `scripts/aiTickAb.mjs`'s `runInterleaved` on the saved world in both trees, 10 chunks of 1,000 ticks): every chunk's world digest without the slot matched, so the work was equal. CPU ratio after/before 0.985 total, 0.965 median; wall 0.998 total and median; foreign load median 14 busy cores, max 31. Inside the tool's stated 3% noise floor.
- **Profiles** (`profile-selfplay.mjs --load`, 5,000 ticks each, run one after the other, so their ms/tick are not comparable: 3.96 and 3.50): inclusive share of the state fingerprint (`clearStateDirty` + `getStateDirty`) 26.6% to 25.4%, of `json.js` 34.1% to 32.9%, of `fogMemorySystem.ts` 2.6% to 2.3%.
- **The slot's own fingerprint cost**: `JSON.stringify` of the slot 0.065 ms before, 0.050 ms after, run twice a tick on an unchanged slot. That is a lower bound: the engine's `jsonFingerprint` also walks the value with `assertJsonCompatible`, which the profile shows costing about as much again.
- **Reading.** In a real match the change saves about 17% of the slot and 6% of world state, a few hundredths of a millisecond a tick, inside the noise of a whole-step ratio. The state fingerprint is about a quarter of tick time in this world, and this slot is 38% of the state, mostly trees and mines the player has seen; that is where the engine-feedback ask has its weight.

## Acceptance criteria

- The consumer audit is recorded here with its evidence.
- A test pins the skip and turns red when the skip is removed.
- The before and after numbers are recorded with the instrument that produced them.
- Saves that hold own-building entries still load.
- An independent read-only review is recorded in `reviews/`, because the change alters persisted state.
- `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed. There is a changelog line only if a player can see the change.

## Implementation steps

- [x] Audit the consumers (above). One reader, which reads an entry only after the building stops being the viewer's: a defect for deletion and destruction, a real use for an enemy's conversion, which is kept.
- [x] Skip and drop, in `fogMemorySystem.ts`: a building the viewer owns is not remembered unless `aoe2.conversionState` holds it, and an entry held for that same entity is dropped.
- [x] Gate: `tests/simulation/fogMemoryOwnBuildings.test.ts`, seven cases. Six are red on main's code (M1). The seventh, the recycled id, passes there too, because main never reaches that path for a building nobody sees; it guards the new drop's generation check (M5). Mutations, each run on the gate file and the file restored byte for byte: M1 no skip — six red, e.g. `drawn after the player deleted them: expected [ 'wonder@14,2', 'market@20,2', …(19) ] to deeply equal []`; M2 no conversion exception — `drawn after the flip: expected [] to deeply equal [ { isMemory: true, x: 22, y: 16 } ]`; M3 skip without dropping held entries — three red, e.g. `the older entry is dropped on the first tick: expected true to be false`; M4 finished buildings only — `remembered at tick 100: expected [ 'barracks (foundation)' ] to deeply equal []`; M5 drop an entry of any generation — `the destroyed House is still remembered: expected undefined to be +0`.
- [x] Old saves: the gate loads a schema-2 save and its schema-1 form, each emulating an older build's entry for the Town Center, and both drop only that entry on the first tick.
- [x] Measure (above).
- [x] Real game after the change: the same click and Delete leave no ghost and no minimap marker; the boot map draws as before.
- [ ] Independent read-only review (`reviews/0_implementation.md`).
- [ ] Phase 2: gate lock, rebase, version, `npm run verify`, push, close out.

## Outcome

Pending.
