# Fog memory stops storing the viewer's own completed buildings

Status: complete
Owner: Claude session from the task card 'Stop fog memory storing the player's own buildings' (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-12

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

One reader exists: `fogMemoryOps.getFogMemoryEntities`, through `renderStateOps.getRenderState`, whose entities feed the voxel world, the minimap (`src/ui/hud/minimap.ts` draws `renderState.entities`), click hit-testing (which skips memory views) and the browser test API. `grep lastSeenStaticCodec` finds no other reader: the slot is written by `fogMemorySystem.ts`, `vietnameseReveal.ts` (every other player's Town Centres, allies' included) and the save loaders, and no rule of play reads it. The AI has no fog memory. Both reviewers of round 0 confirmed this independently.

- **While the viewer owns the building, nothing reads its entry.** The civ-engine `RenderAdapter` projects every live entity (`createProjector` filters on nothing but position and renderable), and `renderStateOps` passes every entity whose owner is the viewer whatever the fog. So the building's id is always in the live set, and `getFogMemoryEntities` skips an entry whose id is live. This holds for a foundation exactly as for a finished building: the safety of skipping does not depend on sight.
- **Once the building stops being the viewer's, the entry is read.** Three cases:
  - Deleted or destroyed where nothing else of the viewer's sees its ground: the building's own sight leaves with it, and an entry is forgotten only when its ground is seen empty, so the entry is drawn as a ghost. That is a defect, not a use: reproduced in the real game (control tree at `f906a255`, dev server, `raid-warning-fixture`, a click on the lone House, the Delete key: the House stays drawn dimmed, `isMemory: true`, id 2161 at (44, 26), and the minimap keeps its marker). Definitive Edition leaves no ghost of your own building. Defect register, 2026-10-11.
  - Converted away by an enemy Monk (Redemption): with the viewer's sight gone from the building, the entry is what keeps it on the map. This IS a use. AI Monks never convert (`monkTaskOps.visitAiMonkTaskCandidates` gives them deposit, pick-up and heal only), so no match against the AI reaches it today, but the mechanic exists. Kept, as the one exception: see Decisions. Progress lives in `aoe2.conversionState` from the first tick a Monk works on the building, and a fresh flip needs at least 50 ticks (progress 1 a tick, flip at 50). But progress outlives the Monk's order and the building, so a resumed conversion can flip in one tick (review rounds 1 and 2), which is why the exception follows the progress.
  - Converted by the viewer's own Monk: the reverse. The entry it had as an enemy building is no longer needed and is dropped.
- **Allied buildings under shared sight** are not the viewer's, are remembered as before, and must be: the spec's "Shared sight shows everything in it" (§10.9) says an ally's base stays on the map as last seen, and `sharedVisionEntities.test.ts` holds it. The same ghost reaches an ally's building, though: a probe deleted an ally's Town Center in `allied-three-player-fixture` with the ally's Militia blinded, and it stayed drawn with `isMemory: true` (steps in the register entry). Out of this card's scope; recorded OPEN in the register entry.
- **Replay viewers.** `makeReplayBridge` uses the same `renderStateOps` with the perspective owner as `humanPlayerId`; ghosts are shown only for player 1's recorded memory. A recording made before this change re-simulates its fog memory without these entries, so `SessionReplayer.selfCheck` would report `aoe2.lastSeenStatic` as changed; every other slot re-simulates the same (the A/B below digested the world without that slot and matched at every chunk for 10,000 ticks).

### Decisions

- **Skip every building the viewer owns, foundations included** — wider than the outcome's "completed". The plan scoped foundations out because they do not see, but the skip rests on the live owner pass, not on sight, and a foundation's entry produces the same ghost. Keying on ownership also keeps this work independent of work 118's sight decision; work 118 has since found that DE's own unstarted foundation stays fogged but drawn and selectable, which is what the owner pass does, and the extension its outcome mentions for this skip is already in it. Mutation M4 below shows foundations do get entries in a played opening.
- **Drop a held entry only for the same entity** (`generation` matches). An entry under a recycled id is a destroyed building's ghost and stays; main overwrote it the moment a seen building took the id. While the viewer's building holds that id the ghost is hidden, because `getFogMemoryEntities` matches live entities by id alone (unchanged; `fogMemoryOps.ts` is not this card's file).
- **Forget an entry recorded as the viewer's on the first pass after its building goes**, seen or not (added after review round 0, F1). The viewer knows what it has lost. This covers a building deleted or razed while an enemy converts it, the first tick after loading an older save, and the ghosts such saves already hold, so old saves lose those too on their first tick. The pass runs before projectiles land, so a building a projectile destroys is forgotten a tick later; if that kill ends the match, nothing steps again and the last frame keeps the entry (F12). A loaded match that has already ended never steps, so its older entries stay drawn.
- **The conversion exception** (its third form, after review rounds 0-2): a building of the viewer's whose id carries an enemy's conversion progress in `aoe2.conversionState` (`isEnemyOwner` of the record's `byOwner`) is remembered, whatever the fog, since an unstarted foundation sees nothing. Rounds 1 and 2 showed why the progress and not the Monk's order: progress is made from the converting Monk's first tick, outlives its order (F11), and outlives the building, so a Monk of that owner sent back can flip the building, or a building of the viewer's that took its id (F27), in one tick, before any pass sees a new order. Progress never decays, so the entry is kept, conservatively, for as long as the record stands: until the building changes hands or is lost, or an attempt that becomes invalid deletes the record (review round 3, F37). That is one entry per such building, never drawn while it stands. A building of any type that takes a destroyed target's id inherits its record and its entry, even one no Monk can convert, and no AI makes any. The first two forms read convert orders (`ff9cfa40`) and then orders plus a keep-rule (`0cee8e54`), and each left a one-tick flip without an entry (F11, F27), and the keep-rule an enemy's look on an acquired building (F24). One route is still open (round 3, F34): a replacement created on a destroyed building's id and converted from the old progress within the same tick, before any memory pass sees it, vanishes, as an unseen replacement does on main. It needs that queued command order and an enemy that converts buildings; F10 closes it.
- **The exception's one live-against-load difference** (F10, outside this card): the engine never deletes a destroyed building's progress record, while a load prunes records of dead ids. A replay or save opened while such an id is free therefore lacks the record that the live match has. If the viewer's next building takes the id, the live match remembers it and the loaded one does not, and the difference in `aoe2.lastSeenStatic`, entry order included, can outlast the record's own. It needs an enemy that converts buildings, so it is dormant against the AI; the F10 card (clear the record in `destroyBuildingEntity`) removes it.
- **After the flip**, an unseen building whose entry still names the viewer as owner is refreshed once, so it is drawn in its new owner's look. That is a rule chosen here, not verified against DE, and it shows the viewer which enemy took the building. It also keeps the forgetting rule from erasing the ghost of a building converted away and later lost out of sight. An older save holding an entry that names the viewer for a building converted away out of sight has it refreshed on the first tick after the load, or forgotten if the building is gone. Only an enemy that converts buildings can make one, and no AI does.

### Measurements (2026-10-11, gate lock held 00:36-00:55)

The engine build the game loads is the sibling's `dist/`, whose `ENGINE_VERSION` is 2.5.0 (its `package.json` says 2.6.1; the dist was built 2026-09-30).

One saved world: `scripts/profile-selfplay.mjs --config castle --warmup 30000 --save` in a control worktree at `f906a255` (71 units, 45 buildings; player 1, an AI seat, owns 17). Both trees loaded it.

- **Slot size** (one tick after the load, each tree writing a save; read by `tmp/probes/fogMemorySlotSize.mjs`): 22,227 bytes and 111 entries before, 18,372 bytes and 94 entries after. The 17 dropped entries were player 1's standing buildings, 3,838 bytes; the rest is 91 resources (17,587 bytes) and 3 enemy buildings. World state 58,942 to 55,087 bytes at that tick (30,001). At the end of the A/B run (tick 40,001): 20,736 against 16,835 bytes.
- **The closest committed stand-in for the 148-building probe** (`building-vision-fixture`, 25 buildings of the player's, no units, tick 2): 5,754 bytes before, 8 bytes after.
- **Interleaved A/B** (`tmp/probes/fogMemoryTickAb.mjs`, which runs `scripts/aiTickAb.mjs`'s `runInterleaved` on the saved world in both trees, 10 chunks of 1,000 ticks): every chunk's world digest without the slot matched, so the work was equal. CPU ratio after/before 0.985 total, 0.965 median; wall 0.998 total and median; foreign load median 14 busy cores, max 31. Inside the tool's stated 3% noise floor.
- **Profiles** (`profile-selfplay.mjs --load`, 5,000 ticks each, run one after the other, so their ms/tick are not comparable: 3.96 and 3.50): inclusive share of the state fingerprint (`clearStateDirty` + `getStateDirty`) 26.6% to 25.4%, of `json.js` 34.1% to 32.9%, of `fogMemorySystem.ts` 2.6% to 2.3%.
- **The slot's own fingerprint cost**: `JSON.stringify` of the slot 0.065 ms before, 0.050 ms after, run twice a tick on an unchanged slot. That is a lower bound: the engine's `jsonFingerprint` also walks the value with `assertJsonCompatible`, which the profile shows costing about as much again.
- **Reading.** In a real match the change saves about 17% of the slot and 6.5% of world state, a few hundredths of a millisecond a tick, inside the noise of a whole-step ratio. The state fingerprint is about a quarter of tick time in this world, and this slot is 38% of the state, mostly trees and mines the player has seen; that is where the engine-feedback ask has its weight.
- **After the repairs** (the numbers above are of `8be8f306`): the round-0 repair (`ff9cfa40`) and the final rule, each loaded from the same save, wrote a slot byte-identical to `8be8f306`'s at tick 30,001 (18,372 bytes, 94 entries); that world holds no enemy conversion record. Its added per-tick work is one map lookup in `aoe2.conversionState` per building of the viewer's and one per building for the held entry. The interleaved A/B was not re-run on the final code.

## Acceptance criteria

- The consumer audit is recorded here with its evidence.
- A test pins the skip and turns red when the skip is removed.
- The before and after numbers are recorded with the instrument that produced them.
- Saves that hold own-building entries still load.
- An independent read-only review is recorded in `reviews/`, because the change alters persisted state.
- `npm run verify` exits 0 under the gate lock, and the change is merged to main and pushed. There is a changelog line only if a player can see the change.

## Implementation steps

- [x] Audit the consumers (above). One reader, which reads an entry only after the building stops being the viewer's: a defect for deletion and destruction, a real use for an enemy's conversion, which is kept.
- [x] Skip and drop, in `fogMemorySystem.ts` (`8be8f306`).
- [x] Measure (above), and the real game: on the control tree a click on the lone House and the Delete key left the ghost; on this tree they leave no ghost and no minimap marker, and the boot map draws as before.
- [x] Review round 0 on `8be8f306` (`reviews/0_implementation.md`): Codex and Claude, nine findings; the three MED ones and the rest repaired or answered in the working tree.
- [x] Review rounds 1 (`ff9cfa40`, `reviews/1_implementation.md`) and 2 (`0cee8e54`, `reviews/2_implementation.md`), each focused on the previous repair, with the same two lanes. Between them they found the one-tick flips F11 and F27 and the enemy-look entry F24, which together moved the exception from orders to progress, plus tests, bounds and wording. Two findings lie outside this card: F10, and F23 (converting a foundation miscounts population).
- [x] Gate on the final code: `tests/simulation/fogMemoryOwnBuildings.test.ts` (five cases) and `tests/simulation/fogMemoryOwnBuildingConversion.test.ts` (nine), with `fogMemoryOwnBuildings.helpers.ts`; fourteen cases. Main's code turns twelve red. It passes the recycled id, a path it never reaches, and the unseen foundation converted, because the staged save happens to hold an owner-2 entry for the House from before the staging. Mutations, each run on both files with the source restored byte for byte (sha256 checked):
  - M1 main's file — twelve red, e.g. `drawn after the player deleted them: expected [ 'wonder@14,2', 'market@20,2', …(19) ] to deeply equal []`;
  - M2 no conversion exception — seven red, e.g. `drawn after the flip, in its new owner's look: expected [] to deeply equal [ { isMemory: true, owner: 2, …(3) } ]`;
  - M3 skip without dropping held entries — five red, e.g. `the older entry is dropped on the first tick: expected true to be false`;
  - M4 finished buildings only — `remembered at tick 100: expected [ 'barracks (foundation)' ] to deeply equal []`;
  - M5 drop an entry of any generation — `the destroyed House is still remembered: expected undefined to be +0`;
  - M6 the exception needs sight — two red, `drawn after the flip: expected [] to deeply equal [ { isMemory: true, owner: 2 } ]` (the unseen foundation, and the unseen building on a reused id);
  - M7 no forgetting of entries recorded as the viewer's — `drawn after the player deleted it: expected [ { id: 2162, … } ] to deeply equal []` and `the ghost of a lost building of the player's is dropped: expected true to be false`;
  - M8 no refresh at the flip — five red, e.g. `expected [ { isMemory: true, owner: 1, …(3) } ] to deeply equal [ { isMemory: true, owner: 2, …(3) } ]`;
  - M9 the exception read from convert orders, as at `ff9cfa40` — four red, `remembered while the Monk only walked there: expected true to be false` and `drawn after the flip: expected [] …` (the one-tick resumptions);
  - M11 forgetting every owner's lost building — `drawn after it was lost out of the player's sight: expected [] to deeply equal [ { isMemory: true, owner: 2 } ]`;
  - M12 any owner's record exempts — `the player's new House is remembered: expected true to be false`.
  - (M10, the round-1 keep-rule's mutation, went with the keep-rule.)
- [x] Old saves: schema 2, its schema-1 form, and entries with no generation load, and drop the player's entries and the ghost of a lost building on the first tick, keeping the rest.
- [x] Focused round 3 on `ce2f933f` (`reviews/3_implementation.md`): Codex only. The Claude lane hit the account's session limit after nine turns and wrote no report, an abstention. Codex closed F11 and F24, left F27 open by one route (F34, recorded as a bound above), and found the save/load case weaker than claimed (F35, F36), now stepped in lockstep with its paused-save premises asserted, plus wording (F37). The mutation runs above are of `ce2f933f`'s cases; round 3 tightened only the save/load case, which no mutation targets.
- [x] Phase 2: gate lock, rebase, version, `npm run verify`, push, close out.
  - 2026-10-11 to 12: shipped in v0.3.250 as `d68f0289` on the fifth verify run, after work 123 M1 gave headroom to the tests that had run past their time limits (see Outcome).

## Outcome

**Shipped in v0.3.250 as `d68f0289` on 2026-10-12.** It landed on top of main at `e273fb09` (work 123 M1, v0.3.249) under the gate lock. The five work commits were rebased four times, onto `8a29c0f9`, `2f259008`, `cc14806f` and `e273fb09`, and no rebase changed code: the diff they make to `src` and `tests` is the same bytes against every base, from `f906a255` on (sha256 `85eb3c27…`). The release commit changes only version comments there. Work 123 M1 took v0.3.249 first, so this branch's first release commit was dropped and the rollover redone at v0.3.250. This plan names the reviewed revisions by their branch hashes; on main they are `8be8f306` → `94191eee`, `ff9cfa40` → `416a7121`, `0cee8e54` → `39739c14`, `ce2f933f` → `d1b56113` and `b398101c` → `81a59069`.

**Checks.** `npm run verify` exited 0 in 18 min 32 s (01:47:03 to 02:05:35 local) on `d68f0289`. Its log shows the whole chain: 585 unit-test files and 4,500 tests passed (1 file and 3 tests skipped) in 278.0 s, the typecheck, 236 browser specs passed and 2 skipped in 12.5 minutes, lint, and the build. That was the fifth run. The four before it failed, none on this change:
- Run 1 exited 139 after 5 min 16 s: npm's node process crashed with a segmentation fault in the unit stage, after every file it had reported had passed.
- Run 2 exited 1 after 10 min 29 s on one test of 4,474: `tests/replay/exactSnapshotSerializer.test.ts`, "matches native full snapshots at each of 120 commanded-worker simulation ticks", timed out at 35.0 s against its 30 s limit. Run alone, interleaved with a control worktree at main, it took 11.8 s on main and 17.3 s here, then 8.5 s on both.
- Run 3 exited 1 after 29 min 26 s. The unit stage and the typecheck passed, and one browser spec of 238 failed: `tests/browser/de-ground.spec.ts:139`, "dims explored-but-unseen ground to about half the brightness of visible ground", hit its 90 s limit in `waitForRenderedFrames` after `advanceTicks(300)`, while other repositories' Playwright runs were using Chrome on the machine. Run alone on an idle machine, ABBA against a control at main with both trees freshly built, the spec file took 81, 74, 74 and 75 s (main, here, here, main), and test 139 took 1.1 min in all four.
- Run 4 exited 1 after 8 min 7 s on one test of 4,474: `tests/replay/resourceWorkerOccupation.test.ts`, "keeps full non-cosmetic default-map state identical through a 600-tick commanded-worker prefix and real gather", timed out at 51.1 s against its 30 s limit. Run alone, ABBA against a control at main, it took 11.7, 12.3, 12.3 and 12.5 s (main, here, here, main).

After run 4 the coordinator stopped the retries (R11) until work 123 M1 gave those tests headroom. Run 5 ran on top of it.

**Review.** Rounds 0 to 3 are in `reviews/`. Codex `gpt-6-astra` and Claude `claude-opus-5-5[1m]` reviewed rounds 0 to 2. Codex alone reviewed round 3, because the Claude lane stopped at the account's session limit and abstained. The code in `src` is round 3's revision, `ce2f933f`, with one comment changed since (vNEXT to v0.3.250). Round 3's answers, `b398101c`, changed one test and the docs; the coordinator accepted them with no further lane.

**Limits.**
- No pixel diff. The maintained capture pair (`scripts/captureMapScreenshot.mjs` and `scripts/diffMapScreenshots.mjs`) cannot delete a building before it captures. Two render-state tests in `tests/simulation/fogMemoryOwnBuildings.test.ts` stand in: "leaves no ghost of any building the player deletes, whatever its type" and "leaves no ghost of a House lost to enemy Militia where nothing else of the player's sees it". Both read `getRenderState().entities`, the list the world renderer and the minimap draw. The browser-pane check in the real game stands in too: on the control tree at `f906a255` the deleted House stayed as ghost id 2161, and on this tree it left no ghost and no minimap marker.
- The interleaved A/B ran on `8be8f306`, not on the final code. The final code writes a byte-identical slot from the same save (18,372 bytes, 94 entries at tick 30,001), so the A/B was not rerun.
- Bounds, stated in the spec's §12.1 rule: a building a projectile destroys is forgotten a tick later, or never if that kill ends the match (F12). An older save's entry for a building converted away out of sight is refreshed or forgotten on the first tick (F13). A replacement converted in the same tick it takes a reused id still vanishes (F34). The engine's stale conversion records can make a live match and its loaded copy differ (F10).
- Queued as separate cards and not acted on here: F10 (`destroyBuildingEntity` keeps a destroyed building's conversion record), F23 (converting a foundation miscounts population), F33 (a unit that takes a destroyed building's id inherits its record), and an ally's lone building leaving the same ghost (defect register, 2026-10-11, OPEN).
