# Selection and commands work as in Definitive Edition

Status: active
Owner: selection-controls worker for the Claude coordinator
Created: 2026-11-04
Updated: 2026-11-04

## Problem and outcome

The coordinator's play on main e9369088 (2026-11-04, lobby defaults, 1280x720) found that selecting and commanding units does not work as in Age of Empires II: Definitive Edition (DE). The outcome is selection and commands that follow DE's rules, with the mouse (milestone M1) and with DE's default hotkeys (milestone M2). Each rule carries its source; a rule that could not be sourced takes the closest sourced behaviour and is listed for the owner.

Reproduced in the real game on this branch's base (ec250733, lobby defaults, 1280x720), by scripted real input (`tmp/probes/repro-*.mjs` in the worktree):

- A box over three villagers and the sheep beside them selects all four, and the panel reads "4 Villagers Selected".
- The sheep standing behind the Town Center at boot (id 2163) has no outline, and a right-click on where it stands, with the Town Center selected, sets the gather point on the Town Center: the next villager trained by the real button walked to the Town Center and stood idle. A sheep only partly hidden was reached.
- With a visible sheep, the same gather point works: the trained villager gathered it.
- The double-click test is "same ground cell", so two quick clicks on two villagers in one cell count as one double-click (read from `voxelSelectionController.ts`; the pair tried in the default map stood in two cells).
- The double-click takes units over the cell bounding box of the view's four corners, which reaches past the screen's edges.

## Scope

M1 (this milestone): box selection, units drawn behind buildings, the panel title for a group, double-click, the gather point on livestock, and the click-the-drawn-unit gate that retires the `lessons.md` entry. M2 (later, possibly another worker): the villager's command card and DE's default hotkeys.

Not in scope: the AI (work 141), HUD restyling beyond these behaviours, civ-engine and voxel, `AGENTS.md`. Findings outside scope go to plan 106's card queue, tagged "(work 142)".

## Approach

### DE rules, with sources (M1)

1. **Box selection.** A plain drag selects every one of your own units inside the box, livestock included. Official DE "Learn to play", Lesson 1 (https://www.ageofempires.com/learn-to-play/control-resources-aoe2/): "All units within the box will be selected." A DE player reports that a box over villagers under the Town Center also takes the sheep among them (Steam discussion 2963894618472125328, 2020-12-01). Update 107882 (2024-03) changed only the Alt-drag of the "Selection Modifier Hotkeys" option: "Herdables can still be selected when there are no civilian units in selection, though." Easy Drag Military (string 8813, help 98813: "Drag select will select only military units") is an option; the official lesson describes the default game, so it is off by default. The box never takes buildings, resources or other players' units: unsourced in writing for DE (belief; the reverse-engineered AoK/HD rules at simonsan.github.io/openage-webdocs give buildings and resources no click zone). This game already does all of this. **The brief's premise that the box should drop the sheep is wrong; only the panel's name for the group was (rule 3).**
2. **Units drawn behind a building.** DE draws a unit that a building hides as an outline: a DE bug report about a unit behind a Castle with no outline (forums.ageofempires.com/t/73253, 2020-03-04), and update 107882 extending outlines to Fish Traps. Livestock are units in DE (Learn to play, Lesson 10: herdables "can be selected and controlled"). A click on a unit's drawn body outranks the building drawn in front of it: unsourced for DE; the AoK/HD reverse engineering above gives buildings no click tolerance and lets a direct hit on a unit's sprite win. Here a live animal (sheep, boar, deer, wolf) is a resource, so it got no outline, and a building outranked its body in the hit test.
3. **The panel for a group.** DE shows the number of units selected, each unit's icon and its hit-point bar (Learn to play, Lesson 5), one portrait per unit (string 43122: "Click to select only this %s ..."). No source names a group after a type. Here the title named a group of villagers and a sheep after the villagers, because the shared-type test skipped the sheep.
4. **Double-click.** Two quick clicks on a unit select all units of that type visible on screen (Learn to play, Lesson 1); on a herdable, all herdables (update 39284: "Double-clicking a herdable animal will now select all herdables instead of a single type."); on a villager, all villagers by default (option 8900 and its help text). Whether two quick clicks on two different units count as one: unsourced for DE. The closest sourced rule is the platform's: Windows counts a second click as a double-click only inside a few pixels of the first (the double-click rectangle, `SM_CXDOUBLECLK`). Here "the same place" becomes the 4 iso-pixel radius the stack walk already calls the same place, and "on screen" becomes the view itself.
5. **Gather point on livestock.** DE's own help (string 4944): "set a gather point on a forage bush to put newly created villagers to work automatically". This game already sends a villager trained under a gather point on a sheep to gather it (seen live); the defect was rule 2, a click on a hidden sheep landing on the Town Center. Whether DE's gather point follows a sheep that moves: unsourced; making it follow would change the saved rally point (a persistent format), so it is listed, not done.

### Changes

- A live animal is outlined behind a building as a unit is, and in both hit tests it ranks between the units and the buildings (`liveAnimal.ts`, `hitLayer`): its drawn body outranks the building in front of it for left and right clicks, and a unit drawn at the same point still outranks it, as before, since which of two units drawn at one point DE takes is unsourced.
- The selection state names a group's type only when every member shares it, sheep included. Rules that served "a villager group" read the members instead (`isVillagerGroup`), and the selection voice is the primary unit's own (`primarySelectionRole`), so neither changed for a group of villagers and a sheep.
- The double-click needs the second click within the same-place radius of the first, and takes the units of the type with any polygon of the body the renderer presented inside the view (`presentedHitPolygons`, `convexPolygonIntersectsRect`).
- Browser helper `game.clickUnit(page, id, button)` clicks a point of the unit's drawn body, found by reading the click stack; `game.clickCell` refuses a left click on a cell a unit the page draws stands on, unless a placement or a ground order (A, P, G) is armed, and names `clickUnit`. Test seam `getArmedGroundOrder`.

### Tests adapted, and why

- `game-combat-and-meta-meta.spec.ts`, `game-rendering-and-world.spec.ts` (the conquest fixture's Militia) and `new-tech-reach.spec.ts` (the Monk, the Transport Ship): each left-clicked a unit's cell centre and passed by the unit's id; each now clicks the drawn body with `clickUnit`. Same assertions.
- `game-selection-click.spec.ts`, raised-roof click: the map's sheep stands behind the middle of the roof line, and its drawn body now takes a click there; the click moves along the same roof line to the nearest point where only the Town Center is drawn. The point's ground inverse is still outside the footprint (round 1 checked), so the test still proves the raised roof is clickable.
- `game-selection-click.spec.ts`, stack walk: a live animal now ranks over a building, so the walk visits militia, sheep, house; the expected order and the click sequence follow. Same four clicks, same margin checks.
- `voxelSelectionController.test.ts`: the controller's view dep changed from a cell box to iso bounds and gained the presented polygons; the existing cases get the whole fixture as their view and the recipe's still polygons, which is the meaning they had.

## Acceptance criteria

- [x] A sheep hidden by the Town Center is drawn as an outline; a left click on it selects it; a right-click on it puts a selected villager to work on it; a gather point set on it puts the next trained villager to work on it. Real-click browser tests, red on the old code.
- [x] A box over villagers and an own sheep selects all of them and the panel says "4 Units Selected"; the box never takes buildings, resources or other players' units. Browser test, red on the old title; the never-takes case is green on both, as an unchanged rule should be, with all four others proven inside the box.
- [x] Two quick clicks on two villagers in one cell select only the second; a double-click takes the villagers on screen and none beyond its edge. Browser and unit tests, red on the old code.
- [x] `clickCell` refuses a left click on a unit's cell; the gate goes red when a centre click is put back; proof in `docs/learning/gate-proofs.md`; both halves of the lesson deleted.
- [x] Before/after captures with pixel diffs confined to the changed region; `npm run verify` green with a passing receipt; independent review recorded under `reviews/`.
- [x] Spec §9.3 (gather point), §9.4 and §14.5 state these rules; devlog, changelog, defect register updated.

## Implementation steps

- [x] Source the DE rules (above) and reproduce in the real game.
- [x] Tests first: unit and browser tests for rules 2-5, red on the old code.
- [x] Implement; adapt existing tests whose meaning changed, with reasons.
- [x] The click-unit gate and its red proof.
- [x] Captures and pixel diffs; full gate; review rounds 0-2; records; phase-1 handoff.
- [x] Phase 2 for M1: Moebius and random-view checks, lock, version 0.3.261, verify, push, findings queued in plan 106, worktrees retired.
- [ ] M2: the villager's command card and DE's default hotkeys, for a fresh worker (starting state below). M2a (the villager's card, the Villager and Town Center keys) is below; M2b (the other cards' keys and the global keys) is open.

### Owner decisions waiting (unsourced rules; each took the closest sourced behaviour; also one line in plan 106's "Owner decisions waiting")

1. Two quick clicks on two different units: does DE read them as a double-click? Here they are two clicks unless the second is within 4 iso pixels (4.8 screen pixels at the boot zoom) of the first, the platform's rule. A short test in DE: two quick clicks on two villagers standing side by side.
2. A gather point set on a sheep that is then moved: does DE's flag follow the sheep, and what do the next villagers do when that sheep is eaten up? Here the gather point is the cell where it was set; following the sheep would change the saved rally point.
3. A double-click on a Militia beside a Man-at-Arms: does DE take the type or the whole line? Here the type; the reverse-engineered AoK/HD rule takes the line.
4. A sheep drawn in front of a villager: which does DE's click take? Here the villager, as before work 142.
5. Easy Drag Military and Selection Modifier Hotkeys: off on a fresh install? Inferred from the official lesson, which describes the default game.
6. The outline colour of a wild animal behind a building: here the not-yours colour, as for any unit nobody owns.

### Found here, not in M1's scope (queued in plan 106, tagged "(work 142)")

- DE caps a selection at 60 units (forum thread 226116, 2023); this game has no cap, and which units DE keeps when a box holds more is unsourced.
- DE's Shift+click and Shift+drag add to the selection ("Learn to play", Lesson 1); here neither does, and Ctrl+click does nothing.
- DE's group panel shows one icon per unit with its hit-point bar; clicking one selects only that unit, Ctrl+click drops it, Shift+click keeps its type and Ctrl+Shift+click drops its type (Lesson 5; strings 43121-43122). Here the panel shows one chip per type with a count and no hit points.
- A building's gather point is not drawn at all; DE draws a flag (strings 3720 and 4144).

### M2 starting state (for a fresh worker)

The brief's items 6 and 7, unchanged: the villager's command card as DE's (DE villagers have no stance or formation buttons; check every unit and building card against DE and report what differs rather than fixing what is out of scope), and DE's default hotkeys (the command grid, such as Q for a Villager at the Town Center, and the common global keys, each sourced). If hotkeys need saved settings or a settings screen, that is a persistent format: report to the coordinator before adding one.

Seen on main before M1 (2026-11-04, lobby defaults, 1280x720): a selected villager shows STANCE (four buttons) and FORMATION (four) beside BUILD; no key trains a Villager at the Town Center. Where the code is: the options come from `src/game/simulation/bridge/selectionStateOps.ts` (`stanceOptions` and `formationOptions` for any owned unit), the card is drawn by `src/ui/hud/selectionPanel.ts` and `selectionPanel/` (`render.ts` has the stance and formation buttons), and the keys are registered in `src/app/bootstrap/createApp.ts` (A, P, G), `dePlayHotkeys.ts` (H, comma, F3, plus and minus, Space) and `selectionRecallHotkeys.ts` (control groups, period). `createApp.ts` and `AoeVoxelGameView.ts` are within a few lines of the 500-line cap.


DE's default hotkeys are in the install's `resources/_common/dat/hotkeys.json`: each shared entry's `defaults_list` holds the `definitive` profile's key, and `name_string_id` names it in `resources/en/strings/key-value/key-value-strings-utf8.txt`. Shared groups include `GAME_COMMAND_HOTKEYS`, `CYCLE_COMMAND_HOTKEYS` (`NEXT_IDLE_VILLAGER` is `VK_OEM_PERIOD`) and `GROUP_COMMAND_HOTKEYS`; `hotkey_group_list` holds 27 per-card groups, among them `VILLAGER_HOTKEYS` (37 entries) and `TOWN_CENTER_HOTKEYS` (18), whose entries are shaped differently from the shared ones. The options screen (`widgetui/screenoptions.json`) lists "Selection Modifier Hotkeys" and "Shift Group Appending" as checkboxes with no default given.

### M2a: the villager's card and the Villager and Town Center keys (2026-11-04)

Split from M2 at the coordinator's brief: M2a is the villager's card plus the Town Center's and the villager's keys; M2b is the other cards' keys and the global keys (H, comma, period, Space, F3, plus and minus, control groups, and the military card's A, P and G).

**Sources.** DE's default keys are the `definitive` entry of each `defaults_list` in the install's `resources/_common/dat/hotkeys.json`, named by `name_string_id` in `resources/en/strings/key-value/key-value-strings-utf8.txt`; read by `tmp/de/dumpHotkeys.mjs` in the M2 worktree, DE never launched. The profile is a grid of slots, Q W E R T over A S D F G over Z X C V B: the install's `buttons.json` puts "Set Gather Point" at slot 4 (T), "Ungarrison All Units" at 9 (G), "Go Back To Work" at 8 (F), "All Back To Work" at 13 (V) and "Town Bell" at 14 (B), each the key `hotkeys.json` gives it. An entry's `alternate: true` is the Alt key (Create Group 11 is Ctrl+Alt+1 beside Create Group 1's Ctrl+1).

1. **No stance or formation on a villager's card.** `MILITARY_UNITS_HOTKEYS` ("Military Units", string 20014) holds Patrol Q, Guard W, Follow E, Aggressive A, Defensive S, Stand Ground D, No Attack F, Attack Move R, Auto Scout G, Build B and the formations Box X, Line Z, Staggered C, Flank V; `VILLAGER_HOTKEYS` ("Villager Build", 20003) holds buildings only. Which card DE shows for a mixed group: unsourced; here any non-villager keeps stances and formations.
2. **The villager's keys.** `UNIT_COMMAND_HOTKEYS`: Build Economic Q (19214), Build Military W (19215), Repair E, Stop G, Garrison T, Seek Shelter F (400017), Drop Off Resources A (400021); Delete is the Delete key (`DELETE_UNIT`). `VILLAGER_HOTKEYS` names each building's page in `context` and its slot by key: Economic House Q, Mill W, Mining Camp E, Lumber Camp R, Dock T, Farm A, Blacksmith S, Market D, Monastery F, University G, Town Center Z, Wonder X; Military Barracks Q, Archery Range W, Stable E, Siege Workshop R, Outpost A, Palisade Wall S, Stone Wall D, Tower F, Bombard Tower G, Gate Z, Palisade Gate X, Castle C. The Fish Trap (Q) has no context: a Fishing Ship builds it.
3. **The Town Center's keys.** `TOWN_CENTER_HOTKEYS` (20004): Villager Q, Loom A, Wheelbarrow and Hand Cart S, Town Watch and Town Patrol D, Age Up Z, Ring Town Bell B (and its undo), Go Back to Work F, All Back to Work V; with `UNIT_COMMAND_HOTKEYS`' Set Gather Point T and Ungarrison G.
4. **Scrolling.** `SCROLL_HOTKEYS` are the four arrow keys; W, A, S and D are grid keys.

**Changes.** `selectionStateOps.ts` offers stances and formations only to a selection with a non-villager owned unit. `src/ui/hud/commandCardKeys.ts` holds DE's keys with their citations, including each building's page and slot, which `buildPages.ts` now reads (the Blacksmith, Monastery and University move to the Economic page, and a page lists its buildings in grid order). `src/app/bootstrap/commandCardHotkeys.ts` registers the fifteen grid keys: a key presses the button of the selected card that holds it, a villager's card takes DE's two steps (Q or W opens a page, the next key builds, a click on a tab opens it too), and cards without DE keys keep A (attack-move), G (attack-ground) and P (patrol), registered there now rather than in `createApp.ts`. The camera scrolls on the arrow keys alone.

**Keys that moved.** W, A, S and D stopped scrolling. With a villager selected, A and G no longer arm attack-move and attack-ground (DE's villager card has Drop Off Resources and Stop there, which this game lacks, so they do nothing). With the Town Center selected, A is Loom and G Ungarrison. Q, W, E, R, T, S, D, F, Z, X, C, V and B were unbound before.

**Tests adapted, and why.** `game-hud-and-camera-camera.spec.ts` and `voxelCameraController.test.ts` hold the Right Arrow where they held D, DE's Scroll Right. `attack-move-hotkey.spec.ts` selects the Scout where it selected a villager: DE has no attack-move for a villager. `play-opening.spec.ts` reads the boot palette in DE's grid order (House, Mill, Mining Camp, Lumber Camp, Dock, Farm; Barracks, Outpost, Palisade Wall, Palisade Gate). `buildPages.test.ts` holds DE's pages and grid order. M1's `selection-controls.spec.ts` arms A and G with a sheep selected (a card without DE keys yet) where it used a villager, and P still with the villager; it now waits for the click's selection before the key, which also caught the key handler reading the card from the panel, a frame behind the selection, so the handler now reads it from the selection. Same assertions otherwise.

**Unsourced, the closest sourced behaviour taken.** Escape on an open build page (it does what it always did; the page stays open for the keys until a building is chosen or the selection changes); whether a held key repeats (the browser's repeat presses again); the mixed group's card (above). This game's one Back to Work sends everyone sheltered anywhere back; it takes F, the Town Center's Go Back to Work slot.

**Review.** [Round 3](reviews/3_implementation.md), Codex on `5fec5564`: five P2 and one P3 (a mouse-chosen building and a reselected villager left the keys' page stale, a key before the HUD's next frame went to the old card, a Fishing Ship took the villager's two steps, a grid key swallowed a letter typed into a dropdown, and the camera case held opposite keys at once); all repaired, each with a test red on the reviewed code. [Round 4](reviews/4_implementation.md), Codex on the repairs `0fbf73ae`: two P2, an Economic page opened on a villager survived its reselection, and a tab clicked on a panel still drawn for the previous selection lost the next key. Repaired at the root: the open page is the panel's own chosen page (`data-build-page-chosen`), which it forgets on a new selection, and a click in the panel first redraws it for the selection now. The first has a test red on `0fbf73ae`; the second needs a click and a key inside one frame and has no test of its own.

**Found, not in M2a's scope (queued in plan 106, tagged "(work 142)").** DE's villager card has Repair (E), Stop (G), Garrison (T), Seek Shelter (F), Drop Off Resources (A) and Delete; this game has none of them as buttons. DE's Town Center has Set Gather Point (T), All Back to Work (V) beside Go Back to Work for its own garrison (F), and the bell's button turns into Undo Town Bell; this game has one Back to Work for everyone. DE draws a fixed 5x3 grid with empty slots; this game packs a page's buildings in grid order. Every other unit and building card is M2b's to check against DE.

## Outcome

Phase 1 (2026-11-04): the branch `selection-controls-1104` holds commits `fed8203e` (as reviewed in round 0), `a51123f2` (round-0 repairs), `fd2632ea` (merge of main `496ee0e9`, v0.3.260), `30d551a8` (round-1 repairs), `c508452c` (round-2 repair), `f5bcf254` (merge of main `6880d69e`) and this record. Full gate on `f5bcf254`: vitest 5,230 passed and 3 skipped, Playwright 281 passed and 2 skipped, receipt OK. Reviews: [round 0](reviews/0_implementation.md) one major and five minor, [round 1](reviews/1_implementation.md) four, [round 2](reviews/2_implementation.md) one P3, the renderer accessor had no test of its own, repaired; every finding repaired with a test a mutant turns red. Captures (1280x720, the default view, SwiftShader, before on `ec250733`, after on f5bcf254): the outline diff is 504 pixels in x 629-652, y 219-248, the hidden sheep's outline on the Town Center's roof; the group diff adds 892 pixels in the selection title, x 180-340, y 480-560, and nothing elsewhere. Not checked: a wild animal's outline in a real match (unit tests only), boar, deer and wolf clicks in a browser, the double-click near the screen edges at other zooms, and a full match played with these changes beyond the reproductions. Version bump, landing and the plan 106 cards wait for phase 2.

M1 landed (2026-11-04) as v0.3.261 on main, after two visual checks the coordinator asked for: the outline in the Moebius style (before on main 6880d69e, after on the branch: 571 pixels changed, all in x 628-653, y 218-249) and one random view (seed w142-random-4067, zoom 1.77, 1440x900, every unit gathered behind the Town Center: a villager and a walking sheep drawn as translucent blue figures over its roof), each looked at at full resolution. Both worktrees and their branches are retired. The plan stays open for M2.
