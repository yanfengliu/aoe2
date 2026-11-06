# The maps grow toward Definitive Edition's sizes

Status: active
Owner: de-map-size worker for the Claude coordinator
Created: 2026-11-06
Updated: 2026-11-06

## Problem and outcome

The default 1v1 map is 60x36 tiles (spec §12's player-count ladder), where DE's smallest two-player map is 120x120. On v0.3.271 three Houses, a Mill and a Lumber Camp, each placed where the preview showed valid, left 84 walkable cells around the Town Center and no way to the home gold; without them 1,357 cells were walkable (plan 106's 2026-11-06 play block). Asked how to fix the cramped start, the owner chose "Grow toward DE's size" on 2026-11-06 (spec §12).

Outcome: the lobby's maps are DE's sizes and shapes, with DE's start area, grown in steps that each land green.

## Scope

- Included: map generation (`src/game/simulation/mapGeneration/`), the lobby's map choices and the scenario registry's map entries; the tests and fixtures that stand on the maps' layout, re-recorded with every move named; spec §12's map sections, §4.6's map size and §13.3's forward scout sentence; this plan.
- Excluded: the AI's rules (work 147 M3), the HUD (work 148), the game speeds (work 149), the gathering rules, civ-engine, voxel, AGENTS.md.
- Binding: the owner's "Keep current AI" (spec §13.1): every self-play baseline is re-recorded with every move named, and a loss of a new kind comes to the coordinator first. Slowness past a line is a defect (fleet R22): a step that makes play or the gates slower past their lines is not landed.

## Approach

M1 is a study, docs only: source DE's sizes and start area from the installed scripts, measure what DE's sizes cost here on a scratch generator (the shipped one is untouched), and propose the steps. Later milestones are the coordinator's to choose from the proposal.

## Acceptance criteria

- [x] M1: DE's map sizes, start area and player distance sourced with citations, and the unsourced points named with the default taken.
- [x] M1: frame rate, pathing time, the computer's decision time, memory, save size and the self-play gates' run times measured at DE's two-player size and one larger, against today's maps, with bounds and the machine's load.
- [x] M1: the steps proposed, each with its expected cost and what it changes, and the tests and fixtures that stand on the boot map named with how each step keeps them honest.
- [ ] Later milestones: as the coordinator decides.

## Implementation steps

Current state: M1, the study, landed on main on 2026-11-06 (docs only). M2 is step 0, the per-tick cost, for a fresh worker the coordinator starts; its starting state is below.

- [x] M1 sourcing (2026-11-06): DE's scripts read, never launched.
- [x] M1 measurements (2026-11-06): scratch generator and probes under the worktree's ignored `tmp/`.
- [x] M1 proposal (2026-11-06): below.
- [x] M1 review and landing (2026-11-06): reviews 0-2 in `reviews/`; the scratch generator, the probes, the folded results, the profiles and the saved worlds copied to the primary checkout's ignored `tmp/work150-retained/` (about 58 MB), which is deleted when step 0 closes.
- [ ] M2, step 0: the live game's per-tick cost, from "M2 starting state" below.

## DE's maps, sourced (M1)

Read from the installed scripts (`C:\Program Files (x86)\Steam\steamapps\common\AoE2DE\resources\_common\drs\gamedata_x2\`, "R" below; `R\includes\` is "I"), never launched. RMS semantics from Zetnus's Definitive Random Map Scripting Guide (https://docs.google.com/document/d/1jnhZXoeL9mkRUJxcGlKnO98fIwFKStP_OBozpr0CHXo) and the aoe2-rms reference built on it (https://docs.racket-lang.org/aoe2-rms/attributes.html).

**Sizes.** Every map is a square of one side (`override_map_size` takes one number). The sides are Tiny 120, Small 144, Medium 168, Normal 200, Large 220, Huge 240, Giant 252, Ludicrous 480, with Mini 80 and the newer Massive 276 to Monstrous 400 between (I/scaling.inc 1-15). The lobby names them with the seats each is meant for: "Tiny (2 player) [120]", "Small (3 player) [144]", "Medium (4 player) [168]", "Normal (6 player) [200]", "Large (8 player) [220]", "Huge [240]", "Giant [252]", "Ludicrous [480]" (`resources\en\strings\key-value\key-value-strings-utf8.txt` 6782-6796, strings 23120-23480). Some scripts move a size up a step: Fortress and Islands play Tiny at 144 (R/EnlargeMap.inc 1-2, included by Fortress.rms 31 and Islands.rms 56), and Nomad multiplies by 1.05, so Tiny is 126 (nomad.rms 12).

**Players.** Arabia places the player lands on a ring, `circle_radius rnd(32,34) 6` on a Tiny 1v1 (R/Arabia.rms 834-837), a radius in percent of the map width from its centre: 38.4-40.8 tiles on 120, so the two Town Centers stand about 77-82 tiles apart, and 19-33 tiles from the nearest edge depending on the ring's angle. Each land is 1,300-2,400 tiles with base size 15-18 (Arabia.rms 792-830). Larger sizes widen the ring: Small 34% (49 tiles from the centre), Medium 35% (58.8), Normal 36% (72), Large 37% (81.4) (Arabia.rms 838-851).

**The start area on DE's Arabia, Tiny 1v1, standard resources.** Distances are tiles from the Town Center's centre, where it stands on its land's origin (I/town_centres.inc 1-19), and nearest valid tile first (`find_closest`).

| What | DE | Source | Here today (60x36) |
| --- | --- | --- | --- |
| Villagers, Scout | 3 villagers and 1 Scout Cavalry at square distance 5 | I/villagers.inc 26-27, 251-331; I/scouts.inc 2-40 | 3 villagers and a Scout beside the Town Center |
| Straggler trees | 5 at square distance 5, at least 4 apart | I/stragglers.inc 5-86 | none |
| Sheep | 4 at 8 (one owned, three gaia in a 5x5 area), then 2 pairs at 22, 20 apart | I/herdable_starting.inc 613-951, 780; I/herdable.inc 3-60 | 4 at rings 3-5 |
| Berries | 1 group of 6 at 12 | I/starting_resources.inc 5-63 | 6 at rings 3-4 |
| Gold | 7 tiles at 12, outside the berries' 12-tile area; 4 at 22; 4 at 28; 3 at 46 (Arabia's GOLD_ADDITIONAL, at least 10 from the edge) | I/starting_resources.inc 436-859, 1430-1551; Arabia.rms 1288-1295 | 4 tiles at rings 5-6 |
| Stone | 5 at 16; 4 at 22; 3 at 46 (STONE_ADDITIONAL) | I/starting_resources.inc 874-1157, 1554-1675; Arabia.rms 1297-1298 | 4 tiles at rings 5-6 |
| Boar | 2 at 18, 16 apart | I/lureable.inc 2-59 | 2 at rings 4-6 |
| Deer | half the maps: a herd of 2-4 at 20-28 and another at 36-40; the other half: 6-8 small game at 18 and at 36-40 | Arabia.rms 1310-1365; I/huntable.inc | none |
| Woodlines | 2-5 forests of 55-100 tiles in a band just inside the land's border, never past about 30 tiles; neutral forests 6-10% of the map in 10-14 clumps scaled by area, kept off the player lands | Arabia.rms 64-70, 952-1074; I/forest.inc 47-665 | 24 trees per player at rings 6-12 |
| Water | no ponds in the player lands | Arabia.rms 236-238 | an inlet can touch the Town Center |
| Wolves | about 6 on the map, at least 32 from every player | I/predators.inc 2-28 | none |
| Relics | 5: one within 24 of the centre, two per player at 32 or more from every player; the counts follow the size (Medium: 3 central and 1 a player) | Arabia.rms 1392; I/relics.inc 98-243, 111-116, 193-207 | 2 |
| Forward outpost | none: every player starts alike | (no such object in any lobby script) | player 2's House and second Scout near the middle |

Gold in a 1v1: DE's Arabia gives each player 18 tiles of 800 (14,400) and the map 28,800; the boot map holds 6,400 in all. Stone: 12 tiles of 350 a player against 4.

**The other lobby maps, Tiny 1v1.** Arena: 120, ring 38% (about 91 apart), a stone wall at 20 with berries, gold and stone at 10-13 inside it, relics 5 (Arena.rms 2477-2486, 5011-5124, 5311-5314). Black Forest: 120, the base terrain forest with player clearings of 44% of the map, gold at 16 and 22, stone at 14 and 20, relics 4 (Black_Forest.rms 292-325, 1080-1110, 1268-1274). Coastal: 120, a water base with a central mainland, ring 28% (about 67 apart), relics 5 (Coastal.rms 335-358, 709-711). Fortress: 144, ring 40% (about 115 apart), a stone wall at 20, four watch towers, a Castle at 9-12, 8 villagers, relics 5 (Fortress.rms 69-74, 380-513, 464-486). Gold Rush: 120, ring 40% (about 96 apart), a central field of 12 piles of 5, relics 5 (Gold_Rush.rms 33-309, 315-324, 861-934). Islands: 144, islands 35% of the map, ring 34% (about 98 apart), relics 5 (Islands.rms 56-117, 2160-2161, 2498-2505). Nomad: 126, no Town Center, 3 villagers at least 45 apart, relics 5 (nomad.rms 12, 57-61, 1941-1944).

**Unsourced, with the default taken.**
- Which size the lobby offers for a seat count: DE's labels pair Tiny with 2 players, Small 3, Medium 4, Normal 6 and Large 8; whether its lobby changes the size when a seat is added is not in the files. Default: the size a label names for the count, rounding up (5 to Normal, 7 to Large), with the size a lobby choice of its own (§4.6 lists "map size").
- The ring's variance (`circle_radius ... 6`) has no unit in the guide, and whether two players stand exactly opposite is not stated. Default: opposite, on an exact ring, the angle from the seed.
- How far the woodline is: the land's size depends on `behavior_version 2`'s tile accounting, which the guide leaves open; 12-22 tiles either way. Default: forests in a band 15-21 tiles out.
- Species by biome (sheep or goats, deer or ibex, berries or fruit) and civilizations' extra villagers come from the theme and the game data, not the placement: this game keeps its own kinds.

## What DE's sizes cost here (M1 measurements)

**Method.** A scratch generator (`tmp/probes/deScratchMap.mts` in the worktree, ignored; the shipped generator is untouched) builds a square map of DE's side with the players on Arabia's ring (33% on Tiny, 35% on Medium), each start laid out as the table above (no wolves, ponds or fish), five relics (nine on DE Medium), and neutral forest on 8% of the map in 12 clumps per 100x100, on the shipped noise's hills. At tick 0 today's 1v1 (60x36) holds 246 trees and 302 resources, DE Tiny's 1v1 (120x120) 1,489 and 1,598, today's 4-player map (84x50) 503 and 599, and DE Medium's 4-player map (168x168) 3,065 and 3,282. A driver (`tmp/probes/deMapCost.mts`) boots each world from a tick-0 save into `createSimulationBridge`, both arms alike, and plays the castle gate's match (both seats AI, conquest only) for 45,000 ticks in windows of 3,000: once on the live game's path (projection every tick) and once on the gates' `renderProjection: 'on-read'`, which played the same game window for window; and the coverage lab's configuration on read. `scripts/profile-selfplay.mjs --load` profiled saved worlds (1,000 ticks, 1 ms sampling), folded into overlapping inclusive groups by `tmp/probes/profileShares.mjs`. The frame rate is work 130's measure rebuilt (`tmp/probes/deMapFps.mjs`): a save loaded through the HUD's own Load on a production build of this branch (vite preview, port 4324), Normal speed as it stood before v0.3.275 (1.5x, 15 ticks a second; DE's Normal since then is 1.7x, 17 ticks a second, which asks 13% more simulation of every second), 8 seconds of animation-frame intervals with the renderer's matrix writes per drawn frame and the HUD's tick, on the GPU (RTX 4090 through ANGLE Direct3D 11) at 1600x900, the camera asked to centre on the human's Town Center (and once on the map's centre; where it stood instead is given below the table), the 1v1 states twice, interleaved; DE Medium's saves through the Load panel's paste source. A first set left the camera where the load puts it, the map's top-left corner, which holds today's base but open ground on the scratch map, and ran under heavy load; it is kept below as that. The gates ran as they are, on today's map, nine files in one Vitest run.

**Where the scratch map is not DE's** (review round 0): its woodlines are seeded 15-21 tiles out but grow inward to 11, and a clump can stop short of its tiles (79 of seat 1's trees stand 10-15 tiles from its Town Center on DE Tiny, where DE's near face is 12-18 by the two readings above); DE Medium got 9 relics where DE's rule gives 7; wolves, ponds and fish are left out. The forest clumps also fall short of their tiles: the generator asks for about 1,670 trees on DE Tiny and 3,272 on DE Medium and places 1,489 and 3,065, 11% and 6% fewer. The projection's cost grows with the trees, so the costs measured here are, if anything, low for this layout. And the scratch map says nothing about whether the computer's radii fit DE's distances, which the sourced table answers instead.

**Load and bounds.** One machine, 32 logical CPUs. Busy CPUs (p10/p50/p90): 9/19/32 while the four live-path arms ran together, 9/25/28 for the on-read set, 21/28/32 for the first frame-rate set with the two lab arms beside it, 2/4/5 for the second frame-rate set (the machine was quiet), 12/18/24 for the gates; the coordinator held the other lanes' self-play and full gates from about 20:50 UTC. Timings swing with that load: today's tick-24,000 frame rate read 55.5 and 35.1 fps in the loaded set's two rounds and 60 in the quiet set, and today's 1v1 on-read arm took longer than its live-path arm, which only load explains. The counts of trees and save bytes do not move with load; the matrix writes per frame do, with the frame cadence (9,483 and 12,251 for the same DE state). One seed per map; the scratch map is DE's layout as this game would draw it, not DE's map.

**Whole match, 45,000 ticks.**

| Map | Live path (projection every tick): total, and ms per tick at 3,000 / 24,000 / 45,000 | Gates' path (on read): the same | Node heap after a collection | Save, tick 0 to 45,000 |
| --- | --- | --- | --- | --- |
| Today's 1v1, 60x36 | 222 s; 1.7 / 5.1 / 7.9 | 245 s; 1.3 / 7.0 / 8.1 | 39-46 MB | 0.55 to 0.64 MB |
| DE Tiny 1v1, 120x120 | 1,006 s (4.5x); 5.8 / 21.0 / 49.1 | 455 s (1.9x); 3.2 / 15.2 / 13.6 | 77-86 MB | 3.54 to 3.83 MB |
| Today's 4 players, 84x50 | 575 s; 3.4 / 11.3 / 14.3 | 442 s; 2.7 / 9.8 / 13.6 | 44-52 MB | 1.08 to 1.22 MB |
| DE Medium 4 players, 168x168 | 2,183 s (3.8x); 17.2 / 56.4 / 80.2, worst 145 | 902 s (2.0x); 10.3 / 31.6 / 17.9 | 117-128 MB | 7.03 to 7.46 MB |
| Coverage lab, today's 1v1 | | 445 s | 42-45 MB | 0.74 MB |
| Coverage lab, DE Tiny 1v1 | | 526 s (1.18x) | 75-76 MB | 3.90 MB |

**Where a tick goes** (profiled ms per tick, live path; the groups overlap).

| World | Profiled | Render projection | JSON-compatibility checks | World tick | Computer's decisions | of which site search | Path search | Movement | Fog and visibility |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Today's 1v1, tick 12,000 | 4.6 | 0.8 | 1.0 | 4.5 | 0.28 | 0.17 | 0.11 | 0.78 | 0.52 |
| DE Tiny, tick 12,000 | 11.0 | 4.1 | 2.1 | 10.0 | 1.33 | 1.19 | 0.12 | 0.71 | 1.40 |
| Today's 1v1, tick 36,000 | 15.5 | 4.8 | 3.6 | 11.6 | 0.44 | 0.26 | 4.24 | 5.68 | 2.10 |
| DE Tiny, tick 36,000 | 44.4 | 33.5 | 17.9 | 13.9 | 1.65 | 1.21 | 0.54 | 1.51 | 12.1 |
| Today's 4 players, tick 24,000 | 16.5 | 5.3 | 4.6 | 13.0 | 1.06 | 0.79 | 0.98 | 2.65 | 2.58 |
| DE Medium, tick 24,000 | 89.4 | 60.7 | 30.4 | 36.0 | 7.04 | 5.88 | 3.94 | 6.23 | 20.2 |

**Frame rate** (GPU, 1600x900, the camera asked for the human's Town Center, a quiet machine except where said below; the simulation held 15 ticks a second at Normal in every row, so the frames paid).

| State | Today: fps (median, p90 frame) | DE: fps (median, p90 frame) | Matrix writes per drawn frame, today / DE |
| --- | --- | --- | --- |
| 1v1 opening | 60, 60 (16.7, 16.7 ms) | Tiny 59.8, 59.8 (16.7, 16.7 ms) | 223 / 197 |
| 1v1 tick 24,000 | 60, 60 (16.7, 16.7 ms) | Tiny 40.7, 40.2 (16.7, 33.4 ms) | 1,016 / 4,282-4,290 |
| 1v1 tick 24,000, a second view | 59.9 at (30,18) | Tiny 39.7 at (36,36) | 1,013 / 4,349 |
| 1v1 tick 36,000 | 60, 60 (16.7, 16.7 ms) | Tiny 22.8, 22.5 (50, 66.7 ms) | 1,793 / 8,565-8,618 |
| Four seats, opening | | Medium 59.6 (16.7, 16.7 ms) | 266 |
| Four seats, tick 24,000 | 59.3 (16.7, 16.7 ms) | Medium 17.6 (50, 100 ms), the view at (28,45) | 2,762 / 7,556 |

The camera does not always stand where it was asked (review 1): after a load it keeps the reach of the map the page booted on, since `AoeVoxelGameView.ts` builds it from the first bridge's size (89-91) and `setBridge` (192) does not resize it. Asked for DE Tiny's centre (60,60) it stopped at (36.3,36.3), about 11 tiles from seat 1's Town Center, and asked for DE Medium seat 1's Town Center (30,62) at (28,44.5), 18 tiles from it; DE Tiny's base views stood where asked, at (26,40). So DE Medium was measured near its first base rather than over it, and the second DE Tiny view is near the base, not held out. The load during the two DE Medium runs was not sampled (the sampler had stopped; the machine was quiet minutes before). The page's heap at ticks 24,000 and 36,000 read 81-254 MB on DE Tiny against 77-116 on today's 1v1, and 269 on DE Medium against 139 on today's four seats. The first, loaded set (21-32 CPUs busy, the camera on the map's top-left corner) read lower everywhere: today's 1v1 at 28-56 fps late and DE Tiny's at 4-11, today's four seats at 18.4; on SwiftShader at 800x600, CI's rasteriser, the corner views read 27.7 and 51.9 fps at the openings and 13.8 and 6.0 at tick 24,000. Matrix writes per frame rise as the frame rate falls (DE Tiny at tick 24,000: 4,282 quiet, 9,483-12,251 loaded), so they are compared only within a set.

**Saves.** A save costs about 250 bytes a map cell, whatever the map holds (0.55 MB for 2,160 cells, 3.54 MB for 14,400, 7.03 MB for 28,224). This origin's localStorage, where the Load panel keeps the browser save, stored 5.1 million characters and refused 5.3 million (`tmp/probes/storageQuota.mjs`, output in `tmp/w150/storage-quota.txt`), and the HUD's Load found no browser save for either DE Medium save; its paste source loads them. So DE Tiny's saves fit with about 25% to spare, and DE Medium's do not. A 144x144 two-seat map saves 5.03 MB at tick 0 (printed) and 5.04 MB at tick 300 (`tmp/w150/de-144-2p-smoke/rows.json`); growing as DE Tiny's did (8% to tick 45,000), it would reach about 5.4 MB late, past what the browser save took: a projection, not a measured failure.

**The gates, projected** (not measured: the ratio is DE Tiny over today for the gate's path and horizon, taken from the castle or lab arms above, which play other matches than the gates: the relic and hit-census gates play standard victories where the arms play conquest only, and `gatherDomain` stops on events; CI times from the 2026-11-06 headroom reports, retained in CI runs 42261253285 and 42258996688; every line is two thirds of the limit). A step that changes the boot map measures the real gates before it lands.

| Gate | Path and window | Local today | CI today | Ratio | Local projected | CI projected | Line (limit) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `aiReachesCastleAge` | on read, 45,000 | 239 s | 244 s | 1.86 | 445 s | 454 s | 400 s (600): past |
| `aiRelicsSelfPlay` | on read, 45,000 | 195 s | not reported | 1.86 | 363 s | | 400 s (600): at 91% |
| `selfPlayContentCoverage` | on read, lab, 45,000 | 353 s | 372 s | 1.18 | 417 s | 439 s | 1,200 s (1,800) |
| `villagersAvoidEnemyDefencesSelfPlay` | every tick, 45,000 | 321 s | 460 s | 4.53 | 1,454 s | 2,084 s | 1,200 s (1,800): past, and on CI past the limit |
| `playerHitCensus` | on read, 26,000 | 117 s | not reported | 1.97 | 230 s | | 200 s (300): past |
| `aiEconomySelfPlay` | every tick, 9,000 | 35 s | 41.7 s | 2.46 | 86 s | 103 s | 100 s (150): past on CI |
| `aiEconomyKeepsMoving` | every tick, 12,000 and 20,000 | 50 s, 58 s | not reported | 2.32, 2.50 | 116 s, 145 s | | 200 s (300), 400 s (600) |
| `gatherDomain` | every tick, cases stopping on events up to 20,000 | 10-25 s | not reported | 2.2-3.5 by where a case stops (for example 3.48 at 3,000, 2.70 at 7,000, 2.16 at 18,000, 2.50 at 20,000) | 22-88 s | | 120-200 s |

**What the measurements say.**
1. Pathing is not what the size costs. The engine's path search took 0.1-0.5 ms a tick on DE Tiny and 3.9 ms on DE Medium's four seats; fights drive it, not distance (4.2 ms on today's 1v1 at tick 36,000, mid-battle).
2. The computer's decisions grow 4-7 times and stay small: 1.3-1.7 ms a tick on DE Tiny against 0.3-0.4 today, 7.0 on DE Medium against 1.1. Most of the growth is its building-site search (`placementSearch.ts`, `aiSitePlacement.ts`: 1.2 ms against 0.2 at tick 12,000).
3. The live game's render projection does not scale. On a step after an out-of-band change (a construction started, an entity destroyed), `refreshRenderProjection` (`createSimulationBridge.ts` 189-192, 201-205) disconnects and reconnects the render adapter, which rebuilds the whole projected snapshot (civ-engine's `render-adapter.js` `buildSnapshot`) and checks every entity's JSON compatibility (`json.js` `assertJsonCompatible`). Counted once per sample (`tmp/probes/profileRefresh.mjs`), the rebuild is 68.5% of a late DE Tiny tick (30.4 ms of 44.4, 14.2 ms of it the JSON checks) and 59.6% of a DE Medium one (53.3 of 89.4), against 21-25% late on today's maps; early in a match it is rare (1.4% today, 8.8% on DE Tiny at tick 12,000), and the rest of the projection column is the adapter's per-tick diff. It grows with what is projected: six times the trees, and everything the player remembers under the fog.
4. The frame rate falls with it, and with the renderer's own writes: on a quiet machine, over the base, the RTX 4090 draws 40 fps at tick 24,000 and 22-23 at tick 36,000 of a DE Tiny match, and 17.6 at tick 24,000 near DE Medium's first base (the camera stood 18 tiles from it), where today's maps hold 59-60; the simulation keeps its 15 ticks a second. The renderer writes 3-5 times the instance matrices per frame (4,300-8,600 against 1,000-1,800 on the 1v1; 7,556 against 2,762 on four seats), work 130's open item (its shadow and memory lanes are rebuilt on every frame a unit moves) at DE's entity counts. Openings hold 60 fps on every map. A second view near DE Tiny's base read as the base did (39.7 fps against 40.2-40.7).
5. On the gates' own path the castle match costs 1.9 times today's (2.0 for four seats); on the live path 4.5 times (3.8). Projected that way, four gates could pass their lines on DE Tiny: the castle gate (by about 13%), the hit census (15%), `aiEconomySelfPlay` on CI (3%), and `villagersAvoidEnemyDefencesSelfPlay`, which runs on the live path and would pass its own limit on CI; `aiRelicsSelfPlay` would sit near its line. These are projections from other matches, so they say where to look, not by how much a gate will miss.
6. Memory doubles: the Node heap 77-86 MB against 39-46 (117-128 against 44-52 for four seats), the page's heap 81-254 MB late against 77-116 on the 1v1.
7. Saves grow with the cells, 6.4 times on DE Tiny; DE Medium's no longer fit the browser save, and 144x144's are projected not to fit late in a match.

**The computer on the scratch maps.** It played its usual game: the first seat reached Feudal at about tick 12,000 on both 1v1 maps, and the Castle Age at 18,000 on DE Tiny against 24,000 today. On DE Tiny the castle match was decided earlier: seat 2 was gone by tick 27,000, where today seat 1 fell after 36,000. In the four-seat free-for-all one seat lost its villagers to a neighbour's early Militia on both maps (DE Medium by tick 2,400, today's by 24,000), which is not a new kind of loss. DE's distances pass several of its radii, reported for the AI lane and not changed: `HUNT_RADIUS` 20 (DE's deer at 20-40), `HOME_GATHER_RANGE` 24 (gold at 28, gold and stone at 46), `DROP_OFF_ANCHOR_RADIUS` 20 (woodlines 15-21), `AI_PLACEMENT_WIDER_SEARCH_RADIUS` 24, `AI_BASE_VISION_RADIUS` 12, and the Scout's wander box of 10 by 8 around its Town Center (`SCOUT_WANDER_HALF_X`/`_Y`), which leaves out DE's second sheep at 22 and the relics at 32.

## Proposed steps (M1)

The measurements change the brief's order in one place: DE's start area cannot come before the size. Its resources reach 16-28 tiles and its two lands stand 77-82 tiles apart, where today's 1v1 puts the Town Centers 43 tiles apart and 10 tiles from two edges, so on the 1v1 the start area and the size are one step. And no map can grow until the live game's per-tick cost stops growing with the map (fleet R22).

| Step | What it changes | Expected cost, measured above | Tests kept honest |
| --- | --- | --- | --- |
| 0. Per-tick cost scales with what changed (prerequisite; not map generation, so the coordinator's to place) | The bridge's projection follows changes instead of rebuilding the snapshot every step, and the JSON-compatibility check leaves the per-tick path (the check is civ-engine's: an engine-feedback item); work 130's shadow and memory lanes stop rewriting what did not move; the gates' on-read tick growth (the computer's site search, fog) comes down by the 13-15% the projections put the castle gate and the hit census over, or those gates are split, never given longer limits; the real gates are measured on the new map before step 2 lands | Target: a late DE Tiny tick from 44-49 ms to its on-read 13.6-15.2, and the late frame rate from 22-41 fps back over work 133's predeclared line (55 median fps on the GPU at 1600x900), re-measured on the same saves with `deMapFps.mjs` | The presentation gates of work 130 (`presentationFrameWork`, `presentation-keeps-still-world`, `aoeVoxelLaneEquivalence`) and pixel diffs; no map changes |
| 1. The forward outpost goes, on today's map | Player 2 opens like player 1: no free House, no second Scout (`defaultMap.ts` 61-87; spec §13.3's forward scout sentence and §12's outpost paragraph) | No measurable cost; the computer's opening moves (one fewer House and Scout) | The outpost's own assertions become "no seat opens with a House or a second Scout"; the self-play baselines re-recorded with every move named |
| 2. The 1v1 at DE Tiny with DE's start area | Standard and its Arabia alias at 120x120 with Arabia's ring and the start-area table above, five relics, and DE's gold and stone (14,400 gold a player, 28,800 on the map, against 6,400 today, which plan 106's lab note needs) | Gates 1.86 times today's on their path (castle and hit census past their lines until step 0's part lands); saves 3.5-3.9 MB (they fit); heap twice today's | The tests table below: the map's own tests rewritten to DE's numbers, the mechanic tests moved unchanged onto today's map frozen as a fixture, the self-play baselines and the census re-recorded with every move named, the visual floors re-measured; every fixture byte-identical |
| 3. The save fits the bigger maps (a persistent format: the owner's call, R8) | About 250 bytes a cell today; the browser save holds about 5.1 million characters. Either a compact encoding of the per-cell data in the save, or the browser save moved to IndexedDB, which the recorder already uses | Needed before DE Medium and up, and probably before 144 (projected) | The save and load tests, and a DE Medium save loaded through the HUD |
| 4. The other lobby maps at their DE sizes and starts | Arena, Black Forest, Coastal and Gold Rush at 120, Fortress and Islands at 144, Nomad at 126, each with its script's start (walls at 20, the Fortress Castle and 8 villagers, the central goldfield, no Town Center on Nomad) | As step 2 per map; Fortress and Islands need step 3 | The invariants over every map (`dropOffAnchorReach`, `walledMapEconomy`, `aiFerry`, `navalReachable`, `buildingVision`) unchanged; `mapRoster`, `nomadMap` and `prototypeScenario.maps` rewritten to DE's numbers |
| 5. The player-count ladder at DE's sizes, and a map-size choice in the lobby (§4.6) | 3 seats Small 144, 4 Medium 168, 5-6 Normal 200, 7-8 Large 220; any size choosable | DE Medium four seats: 2.0 times today's on the gates' path, 3.8 on the live path before step 0, heap 2.5 times, saves 7.0-7.5 MB; Normal and Large unmeasured (1.4 and 1.7 times Medium's cells) | `mapSizeLadder`, `victoryCountdownLength` (its ladder becomes DE's sides, no longer half of them), `eight-player-skirmish` |
| 6. A fresh seed per game (the DE tiebreak, plan 106) | The lobby draws a seed at each Start instead of each map's fixed seed | After map generation is measured over many seeds: about 200 per lobby map, each with every start's resources reachable from its Town Center, the map connected (`scripts/mapConnectivity.mjs`), no generator refusal (`clusters.ts` throws when a group has no room), and the computer's opening completed | The fixed seeds stay for every test and fixture; the lobby alone changes |

**The coordinator's rulings (2026-11-06).** The order is step 0, step 1, step 2, then steps 4, 5 and 6. Step 3, the save, is a persistent-format change the coordinator puts to the owner when step 4 needs it; DE Tiny's saves fit today. Step 0 is this plan's M2. Step 1 follows work 152 M1's landing, so the AI lane measuring now keeps its baseline. Spec §12 states the order and why the start area and the size are one step.

Five relics and DE's gold come with step 2, since that step regenerates the map they lie on and re-records its relic and coverage baselines anyway. What the computer would need, reported to the AI lane rather than changed here: the radii in the paragraph above, and its site search's cost on bigger maps.

## M2 starting state (step 0, the per-tick cost)

**Where the time goes.** `scripts/profile-selfplay.mjs --config castle --load <save> --sample 1000 --interval 1000` on the retained DE Tiny world at tick 36,000: 44.4 ms a tick, of which `refreshRenderProjection` (`createSimulationBridge.ts` 189-192) is 68.5% (30.4 ms), counted once per sample by `profileRefresh.mjs`. Inside it, civ-engine's `render-adapter.js` `buildSnapshot` projects every entity and `json.js` `assertJsonCompatible` checks each (14.2 ms), and aoe2's `projectEntity` (`bridge/visibility.ts`) takes 10.2 ms. DE Medium at tick 24,000: 59.6% (53.3 of 89.4 ms). Today's maps late: 21-25%. Early in a match it is rare (1.4% today, 8.8% on DE Tiny at tick 12,000): the reconnect runs on the step or read after `markOutOfBandRenderChange` (`flushOutOfBandRenderChange`, 201-205), which healing, herding, deer fleeing, tower and projectile hits, conversions and construction starts call (`docs/engine-feedback/current.md`, the `RenderAdapter` ask), so fights make it frequent. The engine's surface is `connect()` and `disconnect()`: a tick's own diff re-projects only entities whose components changed, and state the projector reads outside components has no way in but a reconnect. M2 works through that public surface and never modifies civ-engine; the JSON check is the engine's, recorded in the engine-feedback file.

**The second half of the frame.** The renderer's instance-matrix writes per drawn frame on the retained late DE Tiny saves, quiet machine: 4,282-4,290 at tick 24,000 and 8,565-8,618 at 36,000, against 1,016 and 1,793 on today's map. That is work 130's open item, the shadow and memory lanes, which M2 also covers.

**The retained worlds.** The primary checkout's ignored `tmp/work150-retained/`, deleted when step 0 closes:
- `probes/`: `deScratchMap.mts`, `deMapCost.mts`, `deMapFps.mjs` (`--focus`, `--paste`), `profileShares.mjs`, `profileRefresh.mjs`, `costSummary.mjs`, `storageQuota.mjs`, `cpuLoad.mjs`.
- `w150/`: per-arm `rows.json` and logs, saves at ticks 0, 12,000, 24,000 and 36,000 of today's 1v1 and four seats and of DE Tiny and Medium, the profiles (`prof-*/`), the frame-rate rows (`fps.jsonl`, `fps2.jsonl`), the load logs and `gates.json`.
- The probes import `../../src/...`: copy them back under a checkout's `tmp/probes/` to run them.

**What the change must keep.**
- The simulation byte for byte. The live-path and on-read arms played the same game window for window. A self-play gate's census and a replay's `selfCheck` stay identical, since a projection never writes the world.
- The projected render state equal to a full reconnect's at every tick: an equivalence test of the incremental projection against a full one, as work 130's `aoeVoxelLaneEquivalence` holds the renderer.
- The pixels: before and after captures of the default view and a loaded late save, with pixel diffs of 0 outside the renderer's known edge ties.
- The measure: re-run on the retained saves (`deMapFps.mjs` on the GPU at 1600x900, the camera on (26,40), DE Tiny ticks 24,000 and 36,000; `profile-selfplay.mjs --load` at 36,000) against the late tick's on-read 13.6-15.2 ms and work 133's 55-fps line.
- The gates' lines unmoved: the castle gate and the hit census are projected 13-15% over theirs on DE Tiny, and M2's own share is measured on the real gates.

## Tests and fixtures that stand on the boot map (M1)

A read-only census of `tests/`, `scripts/` and the recorded baselines (2026-11-06, spot-checked by hand). Besides the files that name `aoe2-prototype`, every seed missing from the scenario registry falls back to the boot map's generator (`prototypeScenario/dispatch.ts` 12-17): `default-seed`, `corpus-seed-b`, `aoe2-canary`, `test-seed` and five more; `arabia` is the same generator; `createSimulationBridge()` and the browser helper `waitForBoot(page)` boot it; `boot-map-raid-fixture` is the boot map plus a Militia at (20,11).

| Kind | Files | What they stand on | How a step keeps them honest |
| --- | --- | --- | --- |
| The map's own tests | `mapGeneration/defaultMap.test.ts`, `prototypeScenario.default.test.ts`, `prototypeScenario.maps.test.ts`, `mapSizeLadder.test.ts`, `multiplePlayerStarts.test.ts`, `victoryCountdownLength.test.ts` (the ladder is half DE's sides, 165-171), `mapRoster.test.ts`, `nomadMap.test.ts`, `createSimulationBridge.bootstrap.basics.test.ts` (`worldSize` '60x36', 228), `scoutWander.test.ts` (the outpost's second Scout), browser `game-hud-and-camera-hud.spec.ts`, `eight-player-skirmish.spec.ts`, `helpers/playOpening.ts` | counts, cells, 60x36, the outpost, 2 relics, the ladder | Rewritten in the step that changes the map to DE's sourced value with its citation (4 sheep at 8 and 2 pairs at 22, 7 gold at 12, Town Centers 77-82 apart, 5 relics, the side 120), so each assertion names DE's number rather than loosening; the outpost's assertions become "no seat opens with a House or a second Scout" |
| Generator contracts on the boot map | `defaultMapNarrowPath` (the starting villagers can leave the base, 21-28), `villagerGatherSpread` (trees within 14 of the Town Center), `placementReachability` (placements keep the map connected) | properties the generator must keep | Ported to the new boot map, not frozen, so the new generator stays checked: each re-derived for DE's start (its exits, and its woodline at 15-21 against the stragglers at 5) with the move named |
| Mechanic tests that borrow the boot map's cells | about 17 unit files and 4 specs: the villager at (6,8) and the Town Center at (8,8) (`createSimulationBridge.darkAge`, `.barracks`, `.farm`, `.utility`, `.bootstrap.gameplay`, `populationCap`, `losTechs`), `buildApproachNearestEdge`, `boxedInMoveSearchCount`, `resourceWorkerCounts`, `selectionActivity.*`, `commandRejection`, `civBonusBreadth`, `bootMapRaidFixture`; browser `game-progression-and-production`, `game-simulation-and-exploration-core`, `voxel-renderer`, `de-ground` | literal cells of today's layout | Moved, unchanged, onto a fixture that IS today's map: today's generator kept under `fixtures/` as a named seed, with a test that its scenario is byte-identical to today's `createDefaultMap('aoe2-prototype')` output, so not one assertion changes. A fixture's purpose is a fixed layout (spec §12); the alternative, re-deriving about 60 literal cells from the new map, re-records every test the step touches |
| Self-play baselines | `aiReachesCastleAge`, `selfPlayContentCoverage` (+ `selfPlayContentCensus.expected.json`), `aiRelicsSelfPlay`, `villagersAvoidEnemyDefencesSelfPlay`, `aiEconomyKeepsMoving`, `aiEconomySelfPlay`, `gatherDomain`, `gatherWalkRanking`, `playerHitCensus`, `scoutWanderCorner`, `aiVsAi`, `fogMemoryOwnBuildings`, `rendering/presentationFrameWork`, browser `play-opening.spec.ts`, and CI's `playtest-corpus.json` (Feudal by 20,000 on `default-seed` and the boot map) | the computer's results on today's map | They stay on the real boot map. Each is re-run before and after with `selfplay-ab.mjs` (5 seeds per map), every number that moves is re-recorded with its move named, and the census JSON is re-recorded by hand in the same commit, as its failure text asks; a loss of a new kind (a building, an Age, a stalled seat) goes to the coordinator before it is recorded. Their run times are the gate cost below |
| Visual floors on the boot view | `attack-warning.spec.ts` (≥100 px), `attack-warning-buildings.spec.ts`, `art-style-setting.spec.ts`, `de-ground-full-blend.spec.ts` (2.13% between tiers), `de-ground-frame-cost.spec.ts`, `de-selection-group-panel.spec.ts` | pixels of today's opening view | Before and after captures of the default view and a random view with `captureMapScreenshot.mjs`, and the pixel diff; each floor re-measured on the new boot view and recorded with both numbers. There are no screenshot baselines in the repo |
| Invariants over every map | `dropOffAnchorReach`, `buildingVision`, `walledMapEconomy`, `navalReachable` (its scan stops at 64x64), `aiFerry`, `fu3DefensiveFire`, `mapGeneration/spawnList`, `scripts/selfplayAb` | no numbers of a layout | Unchanged: they are each step's check. `dropOffAnchorReach` asks for the nearest TREE within `DROP_OFF_ANCHOR_RADIUS` (20) of every start (74-86), and DE's five stragglers at 5 tiles satisfy it whether or not a woodline is in reach, so step 2 adds a check on forest trees beside it rather than reading this one as the woodline's |
| Boots the map only as a world | 35 unit files and 40 specs (`saveLoad`, `targetScanIndex`, the HUD and camera specs) | nothing of the layout | Unchanged; the risk is their time limits, for the sweeps that grow with the map's area (`targetScanIndex` 95-111, `placementReachability`, `placementUnexplored` 380+) |

The fixtures: about 150 fixtures paint `createGrassFixtureTerrain()` at `MAP_WIDTH` x `MAP_HEIGHT`, and the lobby generators read the same constants, so the boot map's size has to move off those constants to a size table rather than the constants changing; then every fixture is a map the step cannot reach, and by the map-generation rule it must come back byte-identical.

## Outcome

M1 (2026-11-06): landed on main as one docs-only commit, the squash of the reviewed revisions c4ec8036 (review 0), 4ad9a8ce (review 1) and 2b97690c (review 2), with review 2's wording fixes (27e20bba), main merged in (64a95272) and the landing edits (spec §12's order, the engine-feedback measurement, plan 106's four cards, this section and "M2 starting state"). Checks: `npx vitest run tests/architecture` and `npm run content:validate`. The plan stays open for M2 and the later steps.
