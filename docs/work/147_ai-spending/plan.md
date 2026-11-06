# The computer spends as Definitive Edition's AI does

Status: active
Owner: ai-spending worker (worktree `ai-spending-1106`) for the Claude coordinator
Created: 2026-11-06
Updated: 2026-11-06

## Problem and outcome

The computer starves its own economy of wood, and four plan 106 cards trace to that one cause: "The computer's army and its spending: a study" (work 141), "Late food collapse in the coverage lab" (work 141), "DE's farm model, whole" (work 144) and "The computer's side of DE's sharing" (work 145). At every decision its army asks the first idle producer of each `pickUnitMix` entry for that unit whenever the purse allows, so a 175- or 200-wood building forms late or never in the Castle and Imperial Ages, and its farms break the two-farm floor late in the coverage lab. Work 144 M2 (v0.3.271) accepted two census losses to this cause: owner 1's Monastery and Siege Workshop.

The outcome: the computer spends as DE's AI does, so its buildings, farms and army each get their wood when DE's would, and it no longer collapses for food late in a match; then DE's farm model whole, with the computer's Farm per farmer.

## Scope

- M1, the study (docs only): DE's training and spending rules, sourced from the installed Promisory scripts (read, never launched); this AI's spending measured against them on the coverage lab and the castle configuration with `scripts/selfplay-ab.mjs`, five maps by five seeds, with the noise floor; a rule set proposed to the coordinator, each rule with its citation and expected effect, before any implementation.
- M2: DE's spending rules as the coordinator decides, measured.
- M3: DE's farm model whole (its count with its build conditions) and the computer's Farm per farmer, measured on both configurations, adopted only where neither loses an Age.
- Binding: the owner's "Keep current AI" (spec §13.1: no DE behaviour that exists to make the computer weaker or more passive is adopted; a handicap found is appended to §13.1's list); every AI purchase through `AiPurchases.buy`, with R16-1 left open; drop, don't tune; the coverage census compared both ways, a loss of a new kind to the coordinator first; self-play gates re-recorded with every move named and no assertion weakened; CI's two-thirds limits, and the hit census's all-AI case not lengthened.
- Not this work: input, the HUD and selection (work 146); combat tables and gathering rules; the civ-engine and voxel repos; `AGENTS.md`; R16-1's fix; owner 2's Castle site search (its own plan 106 card).

## Approach

M1. DE's rules. All paths are under `resources/_common/ai/Promisory/` of the installed game; U is `units.per`, I `init.per`, E `escrow.per`, B `buildings.per`, C `const.per`, CC `customConstants.per`, R `researches.per`, T `tsa.per`. The root file that loads them is not in the folder, so the order of the files in a pass is not known; the order of rules within a file is.

1. **No unit trains without a reason.** Every pass begins by setting every train goal to no (U 8-71: `trainvillager`, `trainmonk`, `trainunique`, `traintrebuchet`, `trainram`, `trainmangonel`, `trainarcher`, `trainskirm`, `trainpike`, `trainchamp`, `trainknight`, `trainhussar`, `traincamel`, `traincavarcher` and the rest), and each train action asks for its goal: `(goal trainknight yes) (goal siegereq yes) (can-train knight-line) => (train knight-line)` (U 13283-13305; the archer at 13410-13430, the militia line at 13345-13368). A line trains only while some rule of U sets its goal again.
2. **The reasons** (about 230 rules ask `(goal milunits yes)`), for the lines a Britons or Franks land AI uses:
   - counters, scaled by the focus enemy's count of the class the line beats (the enemy counts are strategic numbers that threats.per fills, 367-386): archers while the enemy's infantry is at least 3, 5, 10, 15, 25 or 40, up to an archer line under 9, 12, ... 60 (U 5856-5921; the Franks' table 6018-6095); skirmishers against archers 3 to 40, up to 6 to 60, while the food covers `sk-buffer-f` (U 5309-5398); spears against cavalry 3 to 40, up to 4 to 60, while the food covers `pk-buffer-f` (U 4893-4962); mangonels against massed archers with little enemy cavalry (U 1438-1475); knights against siege and towers (U 4524-4578);
   - deficits: archers while `sn-military-superiority <= -1` with 125 wood and 145 gold to spare (U 5776-5792), knights likewise (U 4580-4593, 4639-4651);
   - the strategy's own lines: the ranged flush trains archers, skirmishers and spears of its own (U 9145-9540);
   - a plan goal per civilization: the Britons' unique unit is wanted from the start (R 172-175) and trained once its Elite upgrade is pending or done (U 2003-2010, 2453-2475); the Franks' Paladin goal trains knights (U 3942-3969, 4021-4051);
   - siege: the ram (U 989-1147) and the trebuchet (U 977-1033), as work 141 M2a-2b models the ram.
   Under the "usual" strategy there is no default unit before the Imperial Age: the per-civilization `default-unit` fires only in the Imperial Age, with the research plan done, nothing escrowed and every train goal no (U 11854-11917).
3. **Siege before the main army, late.** From the Castle Age, once the population reaches `siege-pop` (190 at a population of 200, C 5480), `siegereq` holds the main army (every main-line train action asks `(goal siegereq yes)`) until 8 siege units, 6 Bombard Cannons, 3 Trebuchets or 5 rams stand, or the military population reaches `allowed-num-military` (I 4154-4179). Already modelled for the ram (spec §13.3).
4. **No army cap at the strongest levels.** `military-percent` is 6, 14, 32, 60, 100 and 100 from Easiest to Extreme (C 5105-5293); `allowed-num-military` is computed only below 100 (I 1231-1249), and a rule sets every train goal to no at that count (U 11987-12066). At Hardest and Extreme nothing caps the army; the caps below are handicaps (spec §13.1 lists Standard's).
5. **Escrow holds the priority items, and the army spends only what is not held.** Each pass E releases everything (1-18), buys what it flagged on the pass before with `can-*-with-escrow` (24-725), clears the flags (731-737), adds the full cost of each item it still wants (743-3363) and holds the sum (3369-3375). The army trains with plain `can-train` and `(up-can-train 0 ...)`, which spend only what is not held (const.per 475; `excessWood` is the wood less the wood held, I 795-797). Held: the Castle Age once its food (castle-f2, 600) and gold (140) are in hand, or on superiority variants (E 745-815); the Imperial Age on twelve variants (E 818-973); the first Market, for a sling or trade, a surplus to sell, or the Castle Age's gold (E 2328-2399); the first Siege Workshop, in the Castle Age only, as the second Imperial prerequisite once a Monastery stands (E 2531-2573, "go up 1-3"), and tactically (2428-2510, 2574-2585); the Castle only for the castle-drop strategy (E 2587-2599); a second Town Center (E 2614-2949); economy technologies, unit-line upgrades and Blacksmith technologies on counts (E 1018-2243, 3269-3363); the first Monk, a mangonel, a trebuchet and Conscription (E 2978-3267). **Never held** (no `up-add-object-cost` for them in any file): House, Farm, Barracks, Archery Range, Stable, Blacksmith, Monastery, University, Mill, Mining Camp; the Lumber Camp only on migration maps (general.per 2479-2480). The Feudal Age is not held either: it uses plain `can-research` (R 56-97).
6. **Buildings go up from what is not held, one at a time.** A one-slot queue (`increase-ts`) takes one building when the wood not held covers it and drops it when the wood falls below: `mb-cost` 175 for a Barracks, Archery Range, Stable or Monastery, `sw-cost` 200 for a University or Siege Workshop, `smith-cost` 150 for a Blacksmith (B 11918-11939; CC 4314-4321). The House rules come first and skip while the wood not held is under `house-cost`, 30 (B 1484-1493); they want a House at a housing headroom under 4 in the Dark and Feudal Ages, rising to 10-20 from the Castle research and 20-30 in the Imperial Age (B 1584-1801). The first Monastery is wanted in the Castle Age as soon as 175 wood is free and the queue is empty, under the usual and boom settings (`milunits` yes or no) and under a flush only with 2 Stables, 3 Archery Ranges, 3 relics on the map, the Imperial Age or 3 Town Centres (B 5454-5460, 5602-5614; earlier skips at 5461-5510).
7. **The build order's claims on a soldier's wood: the flush's buffers.** Inside the ranged flush, the strategy closest to this AI (plan 144), a soldier's rules are skipped while the wood would not cover the soldier and the next claim: spears while no Lumber Camp is pending, wood lies more than 4 tiles from a drop site and the wood is under `pk-buffer-wc` (125, a camp and a spear), or in the Castle Age while no Siege Workshop stands and the wood is under 225 (U 9180-9190); spears while the gold has no camp and the wood is under 125 (9191-9207); spears while farms are under `maxfarms` and the wood is under `pk-buffer-w` (85, a farm and a spear), when the army is level or ahead with 5 or more soldiers and the seat is not ahead of the enemy's age, or the food villagers and farms are both under 7, or no farm is idle at superiority 2 (9208-9219); the archers' rules the same, plus the Castle Age's gold in hand (9336-9386); siege while wood is far and under 120, or in the Castle Age under 200 with no Siege Workshop (9145-9157). The same pattern guards the other rush strategies (U 9544-9908). The buffer constants are in CC 6126-6131 and 4381-4391.
8. **Food saved for the next age, per line.** Scouts wait while the Castle Age is researchable and the food is under 880 (U 10331-10347), skirmishers under 835 (11132-11146), and skirmishers again with the Imperial Age researchable under 1,225 (11205-11216).
9. **Farms after the Dark Age (M3's).** The Feudal-and-later farm rules want `excessWood >= farmmb-cost` (215 Teutons, 209 Malians, 235 the rest; CC 6438-6463) and, before the Castle Age, `flushprep-cost` (460) for a flush (B 4378-4401); they stop at 8 farms until Horse Collar (4357-4363) and skip at 2 or 3 idle farms (4295, 4326); the boom adds `boomprep-cost` (B 4298-4310); while the Castle Age is researched they want 610-785 wood spare, which a seat with fewer than 8 farms can pass without (4772-4782). Farms are never held, and reseeding is the engine's, paid from what is not held.
10. **Rules that make the computer more passive, at every level, for the owner.** In the Dark and Feudal Ages, on a flank position, not attacking, with no enemy building and at most 3 enemy units in town, while every enemy holds fewer than 2 soldiers (U 11945-11946), the land army's goals are set to no, siege and Monks keeping theirs (U 11934-11985). When the Imperial Age is researchable, the AI is not attacking, under attack or escrowing and its civilian count is 90 or more with further population or resource conditions (T 1237-1243; an 80-civilian alternative with its own conditions at 1249-1259), it switches to "usual" with `milunits no` and booms (T 1226-1259); the ranged flush's skirmisher variant does the same at the Castle click (I 8432-8446). Each pauses the land army's training for a while; under spec §13.1 they go to the owner and are not adopted under the tiebreak.
11. **The wood drop site follows the wood.** DE builds another Lumber Camp whenever the nearest wood lies more than 5 tiles from its nearest wood drop site and a camp already stands (B 2173-2189), and its first once the wood is 10 or more from the Town Center (B 2232-2244). Its Dark Age farm rule asks the same 5 tiles (B 4239), and its other farm rules a camp's wood beside the farm's when the wood is farther (`farmcamp-cost`, 160 for most civilizations; B 4253-4254, CC 4969-4979). The camp rule asks DE's `buildlumber` goal and keeps the camp within `sn-camp-max-distance` (B 2174, 2181; I 141). Work 141 M2a measured it on this game, bounded at 30 tiles, and dropped it: owner 2 lost 83 villagers, 80 of them under the enemy's arrows, because a lumberjack whose home woodline ran out walked past the enemy Town Centre; spec §13.2 ("AI Lumber Camp siting") makes a safe gather route the precondition of any retry.

M1. This AI, as it stands (main f2f3b338, v0.3.271). Each decision runs the building phase before production (`bridge/systems/aiSystem.ts` 230-249). The building phase places the first affordable entry of the build order (`ai.ts` `buildWants`: a House due by DE's headroom rule, then Barracks, Mill, the Dark Age camps and farms, farms while short and under 500 food, Blacksmith, Archery Range, Stable, Market, the Feudal farms, then Siege Workshop, Monastery, Castle and the farms deferred), and names the first it cannot pay for as the plan's stuck entry. Production then walks `pickUnitMix(age)` and asks the first idle producer of each entry's building for that unit (one unit per entry a decision; the Castle's unique unit is asked separately, and in the Imperial Age research is bought first) (Militia; Spearman, Archer, Skirmisher, Scout; Pikeman, Crossbowman, Knight, ram, Mangonel; their Imperial lines) when its price fits above the reserves: the next age-up's cost once the seat qualifies for it, in the Feudal Age the next qualifying building's wood until the seat qualifies for the Castle Age, while its army is at its floor or above (`agePrerequisiteWoodReserve`), the next villager's cost, and the escrow's holds (`aiEscrow.ts`: the first Monk and Conscription, neither of them wood; the ram is bought first but holds nothing). The whole army also waits while the seat holds 60% of the next age's food and gold but cannot pay all of it (`savingForAgeUp`), and in the Feudal Age it stops growing at the attack group until the seat qualifies for the Castle Age (`militaryGrowthPausedForAgeUp`). There is no University in the build order, and one Lumber Camp a game: the order wants one only while none stands (`missing('lumber-camp')`, in the Dark Age). A farm that runs out is reseeded in place for 60 wood if the stock holds it, and removed if not (`bridge/farmReseed.ts`).

M1. The measurement. `scripts/selfplay-ab.mjs` on this tree against itself, arm B on seeds 5-9 (`--b-seed-offset 5`): arm A is the baseline on seeds 0-4 and B against A the noise floor of a five-seed median; the castle configuration (45,000 ticks on the default map, 60,000 on the others) and the lab (45,000). What a seat spends is not in its record, so a probe (`tmp/probes/spendTrace3.mts`, ignored) plays the same 25 matches of each configuration and prices, every 25 ticks and naming each entity by its id and generation (the engine recycles ids), each new unit, each new foundation, each new research in a queue and each farm reseeded in place (its food back up), by the base cost tables; a farm that leaves the list is counted as expired unpaid when its food was 10 or less at the sample before, killed otherwise. Bound: base prices (no civilization discount, which for the Britons and the Franks moves no wood), units counted when they appear (charged at the queue a training time earlier), market trades, repairs and tribute not counted; deterministic, so exact for these seeds and silent about others.

## Acceptance criteria

M1:
- [x] DE's training and spending rules sourced with citations (Approach).
- [x] This AI's spending measured against them on both configurations, five maps by five seeds, with the noise floor (Outcome).
- [x] The rule set proposed to the coordinator, each rule with its citation and expected effect (Outcome).
- [x] Spec §13.1's handicap list extended with the handicaps found; plan 106's four cards dated "(work 147)"; content checks and `npx vitest run tests/architecture`.
- [x] The coordinator's decision (2026-11-06): P1 is M2's rule, under this AI's own farm target until M3; the camp rule waits on plan 106's two M5 gathering cards; the three more-passive DE behaviours went to the owner; M1 landed docs only, with no version.

M2 (a fresh worker, from "M2 starting state" in the Outcome):
- [ ] P1 implemented, measured against the A arm re-recorded on the current main, both configurations and the idle boot match, and kept only if it loses no building, Age or seat's economy.
- [ ] The census moves named both ways; the self-play gates re-recorded; the live lobby check; `npm run verify` and its receipt; review; spec §13.2's paragraph marked implemented.

M3: DE's farm model whole and the computer's Farm per farmer, set when M2 lands.

## Implementation steps

- [x] Worktree `ai-spending-1106` on main f2f3b338.
- [x] M1: DE's rules sourced.
- [x] M1: the baseline, the noise floor, the spending and walk probes, both configurations; the human-idle boot match.
- [x] M1: the proposal, review and the phase-1 handoff.
- [x] M1: the coordinator's decision and the landing (2026-11-06).
- [ ] M2 (a fresh worker): P1.
- [ ] M3.

## Outcome

**M1: the measurement (2026-11-06; main f2f3b338's game, v0.3.271; docs only, nothing implemented).** Bound: the castle configuration's and the lab's five maps by five seeds (seeds 0-4; seeds 5-9 for the noise floor) and the human-idle boot match's five, deterministic, so exact for these seeds and silent about others; ages and farms sampled every 250 ticks, clicks every 25, armies every 5,000; the spend probe every 25 ticks (stock every 250), the walk probe every 250. Records in the worktree's ignored `tmp/m1/` (`ab-castle-noise/`, `ab-lab-noise/`, `ab-idle-noise/` with their `report.md`; `spend3-castle/`, `spend3-lab/`, `walk-castle/`, `walk-lab/`), the probes in `tmp/probes/`. Review round 0 found the first spend probe blind to recycled entity ids (R0-1, `reviews/0_plan.md`); every spending figure here is the repaired probe's, which round 1 confirmed (`reviews/1_plan.md`).

The baseline and the noise floor. Each cell: seeds 0-4's median [range]; then the median of seeds 5-9 less it, the move a five-seed median makes by chance on this tree (`selfplay-ab.mjs --b-seed-offset 5`). M2's arms are judged against these.

Castle configuration:

| map | own | Feudal click | Castle click | Imperial click | vills 5:00 | vills 10:00 | vills 15:00 | vills 20:00 | peak army | vill lost | Monastery |
|---|---|---|---|---|---|---|---|---|---|---|---|
| aoe2-prototype | 1 | 17:55 [13:25-never]; -1:33 | 53:20 [26:13-never]; -18:25 | never [32:08-never]; -never | 12 [11-13]; +1 | 20 [19-24]; +1 | 29 [28-29]; 0 | 29 [21-39]; +3 | 9 [1-25]; +7 | 50 [12-67]; -37 | never [47:30-never]; 0:00 |
| aoe2-prototype | 2 | 16:38 [13:55-19:58]; -0:35 | 34:38 [28:08-38:08]; +3:55 | 47:03 [41:13-54:08]; +18:08 | 12 [11-13]; 0 | 19 [17-23]; +1 | 28 [27-29]; +1 | 31 [29-38]; +2 | 22 [13-31]; -11 | 7 [0-72]; +21 | 42:05 [33:45-54:35]; +never |
| coastal | 1 | 16:55 [13:13-20:50]; -4:18 | 29:48 [24:55-42:48]; -4:15 | never [56:10-never]; -never | 14 [12-14]; 0 | 25 [23-26]; 0 | 29 [22-29]; 0 | 31 [29-40]; +9 | 9 [6-21]; +3 | 49 [17-105]; -1 | 56:40 [48:45-never]; -17:55 |
| coastal | 2 | 14:55 [13:03-18:43]; +0:33 | 25:38 [21:08-28:25]; +1:43 | 52:08 [28:28-never]; +never | 10; 0 | 16 [12-19]; +1 | 25 [20-29]; +3 | 35 [28-38]; -1 | 12 [8-19]; 0 | 59 [0-87]; +11 | 45:25 [30:25-57:05]; +never |
| gold-rush | 1 | 15:40 [14:38-17:05]; -0:05 | 25:03 [24:10-26:38]; +0:03 | 44:28 [39:18-never]; -0:33 | 11 [11-12]; 0 | 22 [21-23]; +1 | 29 [26-29]; 0 | 34 [30-36]; 0 | 37 [11-48]; +11 | 0 [0-28]; +1 | 30:50 [28:45-45:00]; -0:25 |
| gold-rush | 2 | 19:05 [17:35-21:20]; -0:45 | never [22:58-never]; -never | never [57:43-never]; 0:00 | 11 [9-11]; 0 | 12 [9-16]; +2 | 23 [20-28]; +2 | 29 [28-29]; 0 | 6 [4-55]; +1 | 67 [13-93]; -11 | never [49:35-never]; -never |
| arena | 1 | 12:38 [12:33-19:03]; +4:33 | 50:43 [46:18-never]; -2:48 | never; -never | 14 [13-14]; 0 | 25 [25-26]; 0 | 29; 0 | 39 [29-40]; -9 | 5 [2-8]; +4 | 47 [35-66]; -10 | never; -never |
| arena | 2 | 13:58 [13:13-27:23]; +1:53 | 24:28 [22:13-37:33]; +12:45 | 42:28 [37:18-50:05]; +43:05 | 11; 0 | 19 [14-20]; +1 | 28 [14-29]; 0 | 37 [14-39]; -4 | 30 [15-79]; -18 | 2 [1-5]; +9 | 34:10 [29:10-51:15]; +17:30 |
| fortress | 1 | 11:28 [10:55-12:48]; -0:23 | 23:58 [19:35-25:38]; -3:15 | 38:40 [27:50-44:10]; -3:43 | 14 [13-14]; -1 | 26 [25-26]; -1 | 32 [29-33]; 0 | 40; 0 | 7 [7-11]; +5 | 58 [41-88]; +15 | 43:45 [40:00-never]; +9:10 |
| fortress | 2 | 13:25 [13:18-13:50]; -0:43 | 20:48 [18:53-21:53]; 0:00 | 35:20 [33:38-42:35]; -2:08 | 10; 0 | 17 [17-18]; +2 | 27 [27-28]; 0 | 36 [35-37]; +2 | 25 [14-39]; +7 | 13 [3-31]; +1 | 38:20 [31:15-51:15]; -5:00 |

The castle configuration's matches, seeds 0-4 (the conquest table):

| map | seed 0-4 ends (A) |
|---|---|
| aoe2-prototype | aoe2-prototype: running; default-seed: running; corpus-seed-b: running; aoe2-prototype#3: running; aoe2-prototype#4: o2 wins at 50:04 |
| coastal | coastal: o2 wins at 96:04; coastal#1: running; coastal#2: o1 wins at 85:15; coastal#3: running; coastal#4: running |
| gold-rush | gold-rush: o1 wins at 74:03; gold-rush#1: o1 wins at 67:13; gold-rush#2: o1 wins at 86:06; gold-rush#3: o2 wins at 80:42; gold-rush#4: o1 wins at 90:19 |
| arena | arena: running; arena#1: running; arena#2: running; arena#3: o2 wins at 93:21; arena#4: o2 wins at 93:50 |
| fortress | fortress: running; fortress#1: running; fortress#2: running; fortress#3: running; fortress#4: running |

The lab:

| map | own | Feudal click | Castle click | Imperial click | vills 5:00 | vills 10:00 | vills 15:00 | vills 20:00 | peak army | vill lost | Monastery |
|---|---|---|---|---|---|---|---|---|---|---|---|
| aoe2-prototype | 1 | 1:28 [1:10-2:13]; -0:08 | 19:13 [16:13-20:38]; -2:33 | 33:40 [29:33-40:13]; -4:25 | 9; 0 | 20 [17-20]; 0 | 32 [27-32]; 0 | 40 [37-40]; -2 | 105 [77-148]; +28 | 25 [7-111]; 0 | 41:15 [22:55-never]; +1:15 |
| aoe2-prototype | 2 | 1:05 [0:53-1:18]; -0:08 | 18:38 [16:13-19:33]; -1:03 | 28:43 [28:10-33:58]; +1:35 | 9; 0 | 18 [14-21]; 0 | 30 [26-33]; 0 | 39 [36-40]; -2 | 140 [116-173]; 0 | 6 [0-115]; +9 | 25:00 [23:20-41:15]; +6:15 |
| coastal | 1 | 1:10 [1:08-1:13]; 0:00 | 18:10 [15:38-23:45]; -2:25 | 31:30 [30:10-41:48]; -2:05 | 9; 0 | 21 [20-21]; 0 | 33 [32-33]; 0 | 40 [35-40]; -1 | 121 [61-141]; -4 | 6 [5-76]; -1 | 35:50 [22:05-48:20]; -2:30 |
| coastal | 2 | 1:15 [1:13-1:28]; -0:03 | 20:28 [19:25-25:38]; -0:40 | 31:48 [30:25-36:48]; -0:35 | 9; 0 | 15 [14-16]; -1 | 24 [22-28]; +1 | 36 [32-40]; +1 | 140 [110-163]; 0 | 3 [0-35]; -3 | 24:35 [23:45-30:00]; -0:25 |
| gold-rush | 1 | 1:05 [1:05-1:08]; 0:00 | 16:35 [14:10-17:55]; -0:18 | 30:58 [27:20-31:40]; -1:10 | 9; 0 | 21; 0 | 33; 0 | 39 [39-40]; 0 | 140 [84-149]; +2 | 2 [0-10]; 0 | 21:40 [18:45-22:05]; -0:50 |
| gold-rush | 2 | 1:10 [1:10-1:13]; 0:00 | 40:53 [31:38-never]; -5:43 | 55:55 [50:58-never]; 0:00 | 9; 0 | 15 [14-16]; 0 | 25 [23-27]; 0 | 26 [22-33]; +4 | 88 [6-140]; +26 | 10 [0-59]; +4 | 45:00 [35:25-never]; -5:50 |
| arena | 1 | 1:10; 0:00 | 15:00 [14:35-17:48]; +0:20 | 28:18 [26:45-33:55]; +0:45 | 9; 0 | 20 [20-21]; +1 | 32 [32-33]; +1 | 38 [37-40]; 0 | 86 [73-100]; +10 | 1 [0-6]; -1 | 20:00 [19:10-28:20]; +2:30 |
| arena | 2 | 1:58; 0:00 | 22:55 [22:08-29:25]; +1:53 | 42:40 [36:33-54:25]; -3:30 | 7; 0 | 9; 0 | 20 [18-21]; -4 | 30; -2 | 54 [34-88]; +13 | 0; 0 | 33:45 [26:40-never]; -5:00 |
| fortress | 1 | 0:53; 0:00 | 14:35 [13:25-15:03]; 0:00 | 24:55 [20:20-26:35]; -0:15 | 9; 0 | 21; 0 | 33 [31-33]; 0 | 39 [38-39]; 0 | 128 [101-140]; -12 | 1 [0-7]; -1 | 45:25 [29:35-62:30]; +5:50 |
| fortress | 2 | 0:55; 0:00 | 21:03 [20:18-29:48]; +2:43 | 33:55 [29:25-40:30]; +0:53 | 9; 0 | 17 [17-19]; 0 | 27 [27-30]; 0 | 39 [36-40]; -2 | 140 [140-145]; 0 | 0 [0-17]; +13 | 25:25 [24:10-33:45]; +2:05 |

The human-idle boot match (`--config idle`: the lobby's defaults with the human seat idle, the default map's seeds; owner 2 is the computer):

| map | own | Feudal click | Castle click | Imperial click | vills 5:00 | vills 10:00 | vills 15:00 | vills 20:00 | peak army | vill lost | Monastery |
|---|---|---|---|---|---|---|---|---|---|---|---|
| aoe2-prototype | 2 | 15:55 [12:08-19:10]; -0:58 | 34:40 [32:38-49:28]; -3:23 | never [44:05-never]; -never | 12 [12-13]; 0 | 21 [19-23]; +1 | 29 [28-29]; 0 | 32 [29-40]; +3 | 13 [8-18]; +4 | 0; 0 | never [39:10-never]; 0:00 |

The idle boot match's ends, seeds 0-4:

| map | seed 0-4 ends (A) |
|---|---|
| aoe2-prototype | aoe2-prototype: o2 wins at 40:00; default-seed: o2 wins at 40:11; corpus-seed-b: o2 wins at 54:21; aoe2-prototype#3: o2 wins at 56:02; aoe2-prototype#4: o2 wins at 39:07 |

Where the wood goes (the spend probe, pooled over both seats and every map: the share of the age's wood spent, and the age's wood income, both median [range] over the seat-seeds whose age lasted 1,000 ticks or more; research takes the rest; the income misses market trades, so a seat that sold wood can read negative):

| config, age | army | buildings | farms | Houses | wood income a minute | n |
|---|---|---|---|---|---|---|
| castle, feudal | 11% [3-49] | 34% [4-58] | 47% [17-83] | 6% [3-12] | 112 [7-202] | 49 |
| castle, castle | 28% [0-100] | 13% [0-50] | 47% [0-100] | 4% [0-9] | 68 [1-141] | 43 |
| castle, imperial | 71% [15-86] | 2% [0-31] | 18% [8-66] | 3% [0-12] | 109 [12-201] | 32 |
| lab, feudal | 21% [4-74] | 29% [5-42] | 35% [13-58] | 11% [5-14] | 127 [53-221] | 50 |
| lab, castle | 36% [15-72] | 0% [0-27] | 53% [24-78] | 5% [0-23] | 70 [-423-155] | 49 |
| lab, imperial | 56% [35-74] | 0% [0-9] | 25% [7-46] | 12% [5-49] | 123 [12-246] | 48 |

- castle: farms built 22 [6-50], reseeded in place 14 [1-40], expired 15 [1-44], killed 0 [0-8] (per seat and match, n=50)
- lab: farms built 25 [8-58], reseeded in place 12 [4-59], expired 18 [0-51], killed 0 [0-11] (per seat and match, n=50)

- castle, siege-workshop: 43 seat-seeds reached the Castle Age; 26 waited a minute or more (10 never placed one); on 23 of those the army's wood in the wait reached the building's 200; the most wood sampled in a wait 165 [33-205]
- castle, monastery: 43 seat-seeds reached the Castle Age; 35 waited a minute or more (8 never placed one); on 28 of those the army's wood in the wait reached the building's 175; the most wood sampled in a wait 156 [33-249]
- lab, siege-workshop: 49 seat-seeds reached the Castle Age; 15 waited a minute or more (5 never placed one); on 15 of those the army's wood in the wait reached the building's 200; the most wood sampled in a wait 165 [107-209]
- lab, monastery: 49 seat-seeds reached the Castle Age; 17 waited a minute or more (3 never placed one); on 17 of those the army's wood in the wait reached the building's 175; the most wood sampled in a wait 145 [83-336]

Farms, wood, army and villagers over time (the spend probe's samples, pooled over both seats and every map; median [range], n the seat-seeds still playing):

| config, minute | complete farms | wood | army | villagers | n |
|---|---|---|---|---|---|
| castle, 10:00 | 0 [0-5] | 45 [0-170] | 1 [0-2] | 20 [9-26] | 50 |
| castle, 20:00 | 6 [0-8] | 78 [5-455] | 2 [0-6] | 35 [14-40] | 50 |
| castle, 30:00 | 8 [2-8] | 41 [0-785] | 4 [0-12] | 40 [8-40] | 50 |
| castle, 40:00 | 8 [1-8] | 36 [0-905] | 4 [0-19] | 40 [14-60] | 50 |
| castle, 50:00 | 8 [0-8] | 54 [0-683] | 4 [0-26] | 40 [0-60] | 50 |
| castle, 60:00 | 7 [1-8] | 43 [0-745] | 6 [0-38] | 41 [0-60] | 48 |
| castle, 70:00 | 7 [0-8] | 30 [0-695] | 3 [0-29] | 56 [0-60] | 46 |
| lab, 10:00 | 5 [0-7] | 117 [15-1037] | 4 [3-7] | 19 [9-21] | 50 |
| lab, 20:00 | 8 [4-8] | 493 [4-2013] | 7 [2-22] | 39 [22-40] | 50 |
| lab, 30:00 | 8 [3-8] | 47 [1-4454] | 19 [5-51] | 40 [26-55] | 50 |
| lab, 40:00 | 7 [0-8] | 34 [1-6756] | 38 [5-84] | 50 [31-60] | 50 |
| lab, 50:00 | 7 [0-8] | 49 [0-4333] | 70 [5-136] | 60 [27-60] | 50 |
| lab, 60:00 | 8 [0-8] | 35 [1-648] | 92 [6-163] | 60 [17-60] | 50 |
| lab, 70:00 | 7 [0-8] | 45 [0-1876] | 119 [5-173] | 60 [3-60] | 50 |

Why the income is small (the walk probe; per configuration and age, pooled over seat-seeds, median [range]: the share of the wood villagers' samples spent gathering, the rest walking to a tree or a drop site or idle; the straight-line tiles from a gathering lumberjack to its nearest Lumber Camp or Town Center, within about 2 tiles for where a building's position sits in its footprint; the Lumber Camps standing at the age's end; the food villagers gathering):

| config, age | wood villagers gathering | tiles to the wood drop site | Lumber Camps | food villagers gathering | n |
|---|---|---|---|---|---|
| castle, feudal | 37% [15-67] | 8.6 [3.2-20.9] | 1 [0-1] | 59% [19-94] | 49 |
| castle, castle | 30% [14-52] | 12.4 [2.2-20.6] | 1 [0-1] | 55% [16-89] | 43 |
| castle, imperial | 23% [6-39] | 17.4 [9.0-25.5] | 1 [0-1] | 43% [22-96] | 32 |
| lab, feudal | 47% [19-67] | 4.8 [2.2-17.1] | 1 [0-1] | 66% [14-90] | 50 |
| lab, castle | 29% [8-63] | 11.4 [4.5-21.0] | 1 [0-1] | 67% [24-92] | 49 |
| lab, imperial | 13% [1-42] | 15.7 [7.2-21.5] | 1 [0-1] | 37% [8-93] | 48 |

The two census matches traced every 5 minutes (`tmp/probes/splitTrace.mts`) show the same: in the lab, owner 1's 25-29 lumberjacks in the Imperial Age had 1-11 gathering and the rest walking, and its 31 food villagers had none gathering at 55:00 and 60:00, its farms gone; in the castle configuration owner 1 sat in the Feudal Age from 20:00 to 60:00 with 1,868-3,477 food and 1,000-1,455 gold banked and 0-55 wood, its 14 lumberjacks mostly walking.

What was measured, and what it suggests (observations first; each hypothesis is marked and is what M2 tests).
1. Observed: before the Imperial Age farms take the largest share of the wood (35-53% of an age's, medians), and from the Castle Age the army the next (28-36%); buildings take about a third of the Feudal Age's wood and little after; in the Imperial Age the army takes most (56-71%). Farms leave the list with their food run out (at most 10 at the sample before, a heuristic: the failed reseed is not itself observed) about as often as they are reseeded in place, and are built again.
2. Observed: of the seats that waited a minute or more in the Castle Age for their Siege Workshop or Monastery, the army spent at least the building's price during the wait on 83 of the 93 waits, while the most wood sampled every 250 ticks in a wait, its first sample included, was a median 145-165; a few seats held the price at some sample of the wait (the lab's coastal#2 owner 1 held 336 at the start of its Monastery wait), so the price alone does not explain every wait. Hypothesis: the army's purchases are what delay those buildings; the builder, the site search and the other purchases are not ruled out by this measurement.
3. Observed: lumberjacks gather well under half their time, less in each later age, ever farther from their one Lumber Camp. Hypothesis: the walk keeps the wood income small. This AI builds one Lumber Camp a game; DE builds another whenever its wood is more than 5 tiles off (Approach, item 11).

**M1: the proposal (for the coordinator's decision; nothing implemented).** Each rule is DE's, at every level, and none makes the computer weaker or more passive. For M2, measured against this baseline on both configurations, five maps by five seeds and the idle boot match, and dropped if it loses a building, an Age or a seat's economy:

- **P1. The flush's buffers, as DE writes them (U 9180-9219 and 9336-9386; CC 6126-6131).** This AI is closest to DE's ranged flush (plan 144), whose soldier rules leave the build order's cheap claims their wood. A Spearman or Archer (25 wood) is skipped while the wood is under 85, a farm and the soldier, and the seat's farms are under its farm target, when its army is level or ahead with 5 or more soldiers and the seat is not ahead of the enemy's age, or its food villagers and farms are both under 7, or no farm is idle and its superiority is 2 or more (U 9208-9219, 9375-9386); a Skirmisher by its own buffer, 95 (CC 6130). In the Castle Age without a Siege Workshop, Spearmen and Archers are skipped while the wood is under 225 (U 9180-9190, 9344-9354), and the ram and Mangonel goals while it is under 200 (U 9145-9157). Superiority is the one this AI already computes for its ram (spec §13.3). The flush's camp buffers (U 9180-9207: a Lumber Camp when the wood is more than 4 tiles off, a Mining Camp when the gold is more than 5) belong with the camp rule below and wait with it. Expected effect, to be measured: fewer farms expiring unpaid and fewer farm-floor breaches, because a soldier no longer takes the last of a farm's wood while farms are short; an earlier Siege Workshop in the Castle Age (the lab census's lost one among them). Risk: the army waits more while farms are short, which is the drop condition if it loses an Age or a seat's economy.
- **The camp rule waits on a safe gather route.** DE's Lumber Camp rule (B 2173-2189, 2232-2244, kept within `sn-camp-max-distance`) is what the walk measurement points to, but work 141 M2a measured it on this game and dropped it for the villagers it lost under the enemy's arrows, and spec §13.2 makes a safe gather route the precondition of any retry. That route belongs to the gathering rules (§6.4), outside this lane. What this lane needs: a gather target whose route, not only its end, keeps clear of enemy defences. Proposed as a plan 106 card; then the camp rule, with the flush's camp buffers, as its own milestone.
- **Not proposed: DE's Imperial prerequisite in escrow (E 2531-2573).** Its branches hold the Siege Workshop at 50 or 60 adjusted civilians (`custom-civ-pop`, I 810-817, 1220-1230), at the civilian maximum, or at the population cap while booming (`milunits no`; E 2531-2544). This AI keeps at most 40 villagers in the Castle Age (`aiEconomyPlan.ts` 144-145) and has no boom state, so the measured seats would seldom meet them; not shown unreachable, and withdrawn for that (reviews R0-4 and R1-3).
- **Each line for a reason (U 8-71 and Approach item 2), as its own work.** The faithful core of DE's training. DE never holds a Monastery's 175 (item 5), and of the rules sourced here this is the one that would leave the Monastery its wood, since DE's army does not train without a reason. It is the largest change: a line trains only while the target's army holds enough of the class it beats, the seat is behind, its strategy wants the line, or its civilization's plan goal does. Against the idle human (an army of 0) only the plan goals and the strategy's own lines would train before the Imperial Age, which may be the "more passive" spec §13.1 keeps for the owner, so that question goes to the owner first.
- Not proposed, for the owner (spec §13.1): DE's Feudal peace (U 11934-11985) and its boom switches (T 1226-1259; I 8432-8446), which pause the land army's training for a while at every level.
- M3 (farms): DE's farm conditions ask a wood drop site within 5 tiles of the wood or a camp's wood beside the farm's (B 4239, 4253-4254), so M3's farm model leans on the camp rule's timing; M3 can still measure DE's count with its other conditions first.

Corrections to the brief, as measurements beside its hypotheses: the army spent a waiting Castle Age building's price during 83 of 93 waits, which fits the brief's cause without proving it; before the Imperial Age farms take more of the wood than the army; and the wood income is small while the lumberjacks walk from one Lumber Camp a game, which suggests a second cause the brief does not name. DE's Lumber Camp rule, the fix that suggests, was measured and dropped by work 141 and waits on the gathering rules.

Not checked in M1: the standard configuration; seeds beyond 0-9; the civilizations other than the Britons and the Franks; a lumberjack's path length (the walk probe reads the straight line); which of the builder, the site search or the other purchases also delays a waiting building.

**M1 landed (2026-11-06), docs only, no version.** The coordinator accepted the study and decided: P1 is M2's rule; DE's Lumber Camp rule waits on plan 106's two M5 cards ("Gatherers walk past enemy defences", "DE's Lumber Camp rule waits on the card above"), which now carry this study's walking numbers; each line for a reason, DE's Feudal peace and its boom switches went to the owner (plan 106, "Owner decisions waiting"). One commit on main, squashing the branch's M1 commits; `npx vitest run tests/architecture` and the content checks passed on it, with the gate lock held for the push.

**M2 starting state (2026-11-06, for a fresh worker; the M1 worker handed over at about 340k tokens).**
- The rule, P1, as the coordinator decided it. DE's ranged flush's buffers (Promisory units.per 9180-9219 and 9336-9386; customConstants.per 6126-6131), at every level:
  - a Spearman or an Archer (25 wood) is not trained while the wood is under 85 (`pk-buffer-w`, a farm's 60 and the soldier) and the seat's complete and placed farms are under its farm target, when any of: its army is level or ahead (superiority 0 or more) with 5 or more soldiers and the seat is not ahead of the enemy's age (DE's `sn-current-age g:<= enemyState`); its food villagers and its farms are both under 7; no farm stands idle and its superiority is 2 or more (U 9208-9219 for spears, 9375-9386 for archers);
  - a Skirmisher by its own buffer, 95 (`sk-buffer-w`, CC 6130; U 9434-9476);
  - in the Castle Age while no Siege Workshop stands, no Spearman or Archer while the wood is under 225 (U 9180-9190, 9344-9354). DE's matching siege rule (U 9145-9157, the ram and Mangonel goals under 200) is moot here: without a workshop there is no siege to train;
  - "its farm target" is this AI's own `targetFarmCount` (`aiEconomyPlan.ts`, a third of the villagers between 2 and 8; in the Dark Age DE's Dark Age farm count, `aiDarkAgeFarms.ts`) until M3 brings DE's farm model; spec §13.2 says so (its paragraph "DE's flush buffers, decided for work 147 M2");
  - the flush's camp buffers (U 9180-9207) stay out, with the camp rule.
- Where the code is. `bridge/systems/aiSystemProductionPhase.ts` `runProductionPhase`: the mix loop (about lines 283-334) asks, for each `pickUnitMix(age)` entry, the first idle producer of its building, and trains when `canAffordWithReserve(stockpile, cost, soldierReserve + soldiersAsked)` and `purchases.buy({ kind: 'train', ... }, { reserve: soldierReserve })` both pass; `soldierReserve` is the age-up reserve (`ageUpReserveCost`), the Feudal prerequisite wood (`agePrerequisiteWoodReserve`, `aiResourceReserve.ts`) and the next villager (`aiVillagerDemand.ts`); the whole army waits while `savingForAgeUp` or `militaryGrowthPausedForAgeUp` (`ai.ts`). The ram is bought before the loop (`ramToTrain`, `aiSiege.ts`; `aiEscrowPhase.ts`), and the Castle's unique unit after it (about 337-360). Every purchase goes through `AiPurchases.buy` (`bridge/systems/aiPurchases.ts`, gated by `tests/architecture/aiPurchaseChokePoint.test.ts`), whose `reserve` option is how a per-line buffer is priced. Superiority is the one the ram's goal computes (`aiSiege.ts`, spec §13.3). The farm target is read in the building phase (`bridge/systems/aiSystemBuildingPhase.ts`, `targetFarmCount` through `ai.ts`'s `buildWants`); a farm's food and whether a villager works it are read the way `playerHitCensus.test.ts`'s eaten-farm rule reads them (work 144 M2); a seat's age and the enemy's are in `playerAgesCodec`.
- The baseline to re-record. M1's tables are main f2f3b338's game; main has since gained work 146 (v0.3.272, 10 files under `src/game/simulation`). Play the A arm again on the current main in a control worktree, castle and lab (five maps by five seeds) and the idle boot match, and the noise floor if the A arm moved; M1's records are gone with its worktree.
- The instruments, and how to rebuild the probes. `scripts/selfplay-ab.mjs` reports the ages, villagers, armies, deaths and buildings; it does not report spending, farms over time or walking, which M1 measured with scratch probes that went with its worktree. Each was a `tmp/probes/*.mts` with a `// harness:` line, built on `scripts/selfplayAuditMatch.mjs` (`loadGame`, `registerSeed`, `stepOneTick`, `CONFIGS`, `seedsForMap`, `mapOfSeed`, `villagerCounts`), playing one match per process in a pool of six:
  - the spend probe: every 25 ticks it charges each new unit (`world.query('unit')`), each new building foundation (`getEconomyState().buildings`) and each research when it first shows in a queue, at the base cost tables (`prototypeEconomyRules.ts` `trainingCost`, `constructionCost`, `researchCost`), and a farm reseeded in place when its food jumps back up (a farm is a resource on the building's entity with `owner` null and `baseOwner` the player). It must name an entity by its id and generation (`world.getEntityRef(id)`): the engine recycles ids, and a probe on raw ids undercounted the army's wood 1.1-3.3 times (review R0-1). Every 250 ticks it samples the stock, complete farms, army and villagers;
  - the walk probe: every 250 ticks, per owner, the villagers whose `gatherer` component's `desiredResource` is wood or food, by their economy-state task (gathering, to-resource, to-dropoff, idle), the complete Lumber Camps, and the straight-line distance from each gathering lumberjack to its nearest complete Lumber Camp or Town Center;
  - summaries pooled the records per configuration and age (the wood shares, the farm counts, the waits from the Castle Age's arrival to the first Siege Workshop and Monastery foundation, counting the wait's first sample, review R1-1), and cut rows out of `selfplay-ab`'s `report.md`.
- The `selfplay-ab` trap. Its game fingerprint hashes the HEAD tree, `git diff HEAD` over the whole tree, untracked files under `src/` and `design/`, and the engine build. Editing any tracked file in a checkout that is being measured, a plan or the spec included, fails every match in flight at its end ("changed while ... was played"), and `--reuse` then refuses the records played on the other fingerprint; M1 lost 18 matches so. Measure both arms from control worktrees (`node scripts/controlWorktree.mjs create <name> <base>`) and edit only the lane's own worktree, or hold the measured tree still until the run ends (plan 106, "Repo and tooling").
- Acceptance, as the coordinator set it: P1 measured against the re-recorded A arm on both configurations and the idle boot match with the brief's columns (the clicks, villagers at 5-20 minutes, farms and wood over time, the army over time, the conquest table, villager deaths, the coverage census); drop, don't tune; every census move named both ways, a loss of a new kind to the coordinator first; the self-play gates re-recorded with every move named and no assertion weakened; the live lobby check; `npm run verify` and its receipt; independent review; spec §13.2's paragraph turned from "decided" to "implemented" with the measurement.
