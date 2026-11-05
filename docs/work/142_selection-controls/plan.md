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

- A live animal counts as a unit for the behind-building outline and for hit priority, in the voxel hit proxy and in the ground hit test, so its drawn body outranks the building in front of it for both left and right clicks.
- The selection state names a group's type only when every member shares it, sheep included.
- The double-click needs the second click within the same-place radius of the first, and takes the units a box over the whole view would take.
- Browser helper `game.clickUnit(page, id, button)` clicks a point of the unit's drawn body, found by reading the click stack; `game.clickCell` refuses a left click on a cell a unit stands on and names `clickUnit`.

## Acceptance criteria

- [ ] A sheep hidden by the Town Center is drawn as an outline; a left click on it selects it; a right-click on it puts a selected villager to work on it; a gather point set on it puts the next trained villager to work on it. Real-click browser tests, red on the old code.
- [ ] A box over villagers and an own sheep selects all of them and the panel says "4 Units Selected"; the box never takes buildings, resources or other players' units. Browser test, red on the old title.
- [ ] Two quick clicks on two villagers in one cell select only the second; a double-click takes the villagers on screen and none beyond its edge. Browser and unit tests, red on the old code.
- [ ] `clickCell` refuses a left click on a unit's cell; the gate goes red when a centre click is put back; proof in `docs/learning/gate-proofs.md`; both halves of the lesson deleted.
- [ ] Before/after captures with pixel diffs confined to the changed region; `npm run verify` green with a passing receipt; independent review recorded under `reviews/`.
- [ ] Spec §9.3 (gather point), §9.4 and §14.5 state these rules; devlog, changelog, defect register updated.

## Implementation steps

- [x] Source the DE rules (above) and reproduce in the real game.
- [ ] Tests first: unit and browser tests for rules 2-5, red on the old code.
- [ ] Implement; adapt existing tests whose meaning changed, with reasons.
- [ ] The click-unit gate and its red proof.
- [ ] Captures and pixel diffs; full gate; review; records; phase-1 handoff.

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
