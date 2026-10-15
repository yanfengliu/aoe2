# Gatherers carry on as in Definitive Edition when their target runs out

Status: active
Owner: Claude coordinator (Game orchestrator todos); implementation worker in worktree `gatherers`
Created: 2026-10-15
Updated: 2026-10-15

## Problem and outcome

The play session of 2026-10-14 (v0.3.257, real mouse and keyboard; recorded in work 106's card queue) saw two economy behaviours that break the feeling of playing DE:

- Hunters go idle after the kill. Five villagers with Loom killed the boar at about tick 2,995; four went idle at once, the fifth attacked the second boar and then went idle too, and the carcass stayed at 340 food until the player ordered them again. Work 120's worker had reported the same from a hunt order.
- Foragers wander. When the berries ran out at about 16:30, seven food villagers walked 10 to 20 cells to fish in distant ponds at (12,19), (21,24) and (11,30); the idle-villager count stayed 0, so nothing told the player, and food income collapsed. The spec's home-gather-range paragraph (§12, "a player whose own resources of that kind are exhausted still ranges as far as needed") allows it, and its shore-fishing rule lets villagers gather pond fish.

In DE a gatherer whose target runs out looks for more of the same kind of resource close by and works it, and otherwise stands idle, which is the player's cue (to build farms, for example); hunters gather the animal they killed. The coordinator's rule, by the DE tiebreak: match DE, and change the spec's paragraph to say so.

## Scope

- Included: what a villager does when its resource runs out or its hunted animal dies, for every gather kind (sheep and other herdables, hunted animals and their carcasses, berries, shore fish, wood, gold, stone, farms as far as reseeding already covers); the search radius and same-kind rule; the idle count; the spec's home-gather-range and shore-fishing paragraphs; the computer's handling of villagers that now go idle where they used to wander.
- Excluded: Fishing Ships; farm reseeding queues beyond what exists; new AI economy strategy beyond reassigning its own idle villagers if it does not already.
- Off limits while they run: work 126 (foundation claims, foundation start, placement, construction start, worldOccupancyCells, herdable movement for foundations), work 128 (the AI's Monk and relic code, carried-relic occupancy), work 130 (rendering and the frame rate).

## Approach

Reproduce both in the real game first, through the player's own commands. Source DE's rules before coding: which kinds a gatherer may move on to (same resource type, for example berries to berries, never berries to shore fish), the search radius, what hunters do after the kill and after the carcass runs out (they do not attack a new live boar on their own), and what shepherds do. Prefer DE's own text (the in-game help, patch notes) and well-documented community sources; name each source, and state as a bound what none settles.

## Acceptance criteria

- Fixture cases through real commands, red before the fix: hunters keep gathering the animal they killed; a forager whose bush runs out moves to another bush within the radius; with none in the radius it goes idle and the idle count rises; a forager never moves to shore fish or another kind; each other gather kind follows the sourced rule.
- The computer's economy: every self-play and AI test file is run, and any outcome that moves is reported with before and after numbers, never retuned to pass.
- Each new gate goes red with the defect put back, and states its bound.
- The spec states DE's rule in place of "ranges as far as needed"; a register entry, the changelog line and version at landing, and the devlog lines are written.
- `npm run verify` exits 0 with its log read through the build, `node scripts/verify-receipt.mjs check` prints OK with both suites' counts matching the log, and the change is on main.

## Implementation steps

- [ ] Reproduce, source DE's rules, fix, gate, record, land.

## Phase 1 record (worker, 2026-10-15)

Branch `gatherers`, from main `5b6838df`. No version taken; the changelog sits under "Unreleased — work 131" and the devlog line says vNEXT. The step log is the worktree's `tmp/gatherers-steps.log`.

### Definitive Edition's rule, and where it comes from

- Patch notes for Update 108769 and its hotfix 109739 (ageofempires.com, 2024): "After depleting a Sheep, Shepherds will automatically go to another Sheep even if 'Drop Off' command was used"; "After depleting a Boar, Hunters will no longer automatically hunt another live Boar if the 'Drop Off' resources command was used"; "After using the 'Drop Off' or 'Back to Work' commands, villagers will go back to the same target they were previously working on, instead of picking a new one". Its known issue that hunters "may turn into lumberjacks and begin cutting trees, after all deer are depleted" was the defect it fixed.
- Patch notes for Update 111772 (ageofempires.com, 2024): it "prevented hunters from attacking nearby violent huntable animals upon depleting the one they are currently working on" when Drop Off had been used.
- The AoE2 DE bug forum, whose reports state the expected result: "Villagers find next gold tile to mine" (thread 283435, 2026); "Villager is suppose to continue to the nearest forage bush" (288852, 2026); villagers go "to the next deer in their LOS", and "villager next hunt search radius is really small" (67431, 2020); villagers stand idle once the boar meat is gone (243424, 2023).
- The DE data: a villager's line of sight is 4 tiles (HSZemi/aoe2dat's dump of the DE `.dat`).

### Decisions, each a reversible default

- **Same kind is the same resource type.** A forager stays a forager, a lumberjack a lumberjack, gold stays gold and stone stone, a shepherd moves between sheep, a shore fisher between shore fish. A hunter carries on to a boar's carcass or a deer and never to a live boar. An expired Farm has its reseed, and with none its farmer stands idle.
- **The radius is 5 cells from the node that ran out.** DE states no number. At 4, one shipped base patch (Arabia, owner 1's berries) is two groups at tick 0; at 5 none of the shipped base patches of berries, gold, stone or sheep is (measured with a scratch probe over all nine maps). DE's own patches are tighter; 5 is what lets a villager finish its patch here.
- **What it carries goes with it**, and every gatherer of the node carries on at the swing that empties it, including one walking home with a load.
- **The human player's villager goes back to its node after a delivery** (109739's "go back to the same target"), and its automatic recoveries (unreachable, crowded, walked at too long) stay inside the carry-on. A rally point on a resource gathers that node.
- **The computer** follows the same unit rule and keeps re-tasking its own idle villagers as before; nothing in its strategy was retuned. Its hunters gather their kill without the player's standing order, so the enemy-defence retarget and auto-aggression treat them as before (`0f1b1570`, after the measurements below, which ran on `2ae0220c`).

### What was measured, before and after

Self-play audit, `npx tsx scripts/selfplay-audit.mjs --seeds aoe2-prototype,default-seed,corpus-seed-b,arabia --ticks 45000`, the two arms run side by side: before is `5b6838df`, after is `2ae0220c`. Ticks for the ages; a dash means not reached.

| Seed | Owner | Feudal | Qualified | Castle | Imperial | Building types | Unit types | Peak army | Villagers lost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| aoe2-prototype | 1 | 10,250 → 11,000 | – | – | – | 9 → 9 | 4 → 4 | 4 → 5 | 23 → 22 |
| aoe2-prototype | 2 | 12,500 → 12,000 | 13,500 → 13,000 | 23,250 → 23,750 | 35,750 → 36,000 | 13 → 13 | 12 → 11 | 14 → 14 | 0 → 0 |
| default-seed | 1 | 12,000 → 12,750 | 37,500 → – | – | – | 10 → 8 | 4 → 4 | 4 → 5 | 35 → 37 |
| default-seed | 2 | 12,500 → 14,500 | 20,000 → 23,000 | 23,500 → 27,000 | 37,500 → 40,750 | 14 → 14 | 11 → 12 | 18 → 14 | 0 → 1 |
| corpus-seed-b | 1 | 12,000 → 11,500 | – | – | – | 8 → 8 | 4 → 4 | 5 → 5 | 32 → 58 |
| corpus-seed-b | 2 | 12,750 → 13,750 | 17,750 → 14,500 | 23,500 → 24,750 | 35,250 → 37,250 | 13 → 13 | 11 → 11 | 13 → 13 | 1 → 1 |
| arabia | 1 | 14,500 → 15,000 | 23,250 → 16,000 | 25,000 → 24,250 | – | 10 → 12 | 7 → 9 | 7 → 10 | 35 → 56 |
| arabia | 2 | 11,750 → 12,750 | 18,750 → 13,750 | 24,000 → 24,250 | 39,750 → – | 15 → 14 | 12 → 6 | 12 → 11 | 22 → 20 |

Totals: Castle 5 → 5 owner-slots, Imperial 4 → 3, building types 92 → 91, unit types 65 → 61, peak army 77 → 77, villagers lost 148 → 195, none under enemy defences in either arm. On default-seed the base ended early by defeat; the branch ran to 45,000.

The economy under those numbers, from a scratch probe (`ai-econ-ab.mts`: both owners AI, resources banked from the score counters, and villager-ticks spent idle with no order), at tick 20,000:

| Seed | Owner | Banked | Idle villager-ticks |
| --- | --- | --- | --- |
| aoe2-prototype | 1 | 6,030 → 5,764 | 2,000 → 2,040 |
| aoe2-prototype | 2 | 5,094 → 5,013 | 3,970 → 3,770 |
| corpus-seed-b | 1 | 4,807 → 5,503 | 5,130 → 1,780 |
| corpus-seed-b | 2 | 5,501 → 4,739 | 2,740 → 3,450 |
| arabia | 1 | 4,912 → 4,595 | 2,100 → 2,030 |
| arabia | 2 | 4,843 → 4,529 | 5,930 → 5,990 |

After tick 20,000 each match diverges with raids: an owner's villager count drops at a different time in each arm, and idle villager-ticks pile up around the raids in both (corpus-seed-b's owner 1 reached 110,600 on the base and 66,020 on the branch by 45,000). The computer is not leaving villagers idle that it never re-tasks: at tick 20,000, before the raids, the branch's idle villager-ticks are at most 710 above the base's (corpus-seed-b, owner 2) and lower for three of the six owners, and `gatherCarryOn.test.ts`'s guard holds the class.

Gates that moved:

- `aiEconomyKeepsMoving.test.ts`, "keeps gathering": on aoe2-prototype from tick 6,000 to 12,000, owner 2 banked 1,645 → 1,650, but its stockpile moved 870 → 170, because its Feudal age-up moved from about 13,800 to before 12,000. The gate now reads the banked total.
- `selfPlayContentCoverage.test.ts`, the lab's two-way census: buildings gained the Watch Tower; units gained the Battering Ram, Capped Ram, Elite Skirmisher and Mangonel and lost the Cavalier and Two-Handed Swordsman; technologies gained the Elite Skirmisher upgrade, the Heavy Scorpion upgrade and Ring Archer Armor and lost the Cavalier and Two-Handed Swordsman upgrades. By owner: owner 1 lost the Cavalier, the Two-Handed Swordsman, their upgrades and Sappers, and gained Ring Archer Armor; owner 2 gained the Watch Tower, a Siege Workshop that trains, the rams, the Mangonel, the Elite Skirmisher and their upgrades. The expectation file is not re-recorded on the branch, because work 128 re-derives this gate; whichever lands second re-records it.
- `villagerGatherSpread.test.ts` and `gateBuiltInMatch.test.ts`: revised to the rule (the register entry says how), each proven red again.

### Not checked in phase 1

Fishing Ships (excluded); deer on a shipped map (none places them); the radius against patches as they thin mid-match; the browser suite and `npm run verify` (phase 2); whether the 2026-09-02 resource-approach deadlock still reproduces on main (on the branch, reintroducing it leaves the economy moving, while `approachOrdering.ts` says it fails `aiEconomyKeepsMoving`).

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
