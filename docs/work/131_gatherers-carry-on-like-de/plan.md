# Gatherers carry on as in Definitive Edition when their target runs out

Status: planned
Owner: Claude coordinator (Game orchestrator todos); worker to be named
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

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
