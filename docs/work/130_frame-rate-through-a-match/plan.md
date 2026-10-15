# The frame rate holds through a match

Status: planned
Owner: Claude coordinator (Game orchestrator todos); worker to be named
Created: 2026-10-15
Updated: 2026-10-15

## Problem and outcome

The play session of 2026-10-14 (v0.3.257, the lobby's defaults, real mouse and keyboard, dev build, an RTX 4090 through ANGLE D3D11 at 1600x900) measured the frame rate falling through a match: 59.7 fps at 00:15 of game time, 48 at 02:50, 39 during a fight, then about 21 at 19:30, where typical frames took 50 ms and the worst 67 to 100 ms. It was the same over the player's base and over an empty corner at (55,3), so what is on screen does not explain it. The simulation kept its 15 ticks a second and the heap read 109 MB. The page was about 45 minutes old and had loaded a save and opened a replay, so match state and page age were not separated. The record is in work 106's card queue.

A player in DE does not watch the game slow down as a match goes on. Outcome: the frame rate late in a match stays close to the opening's, on this machine and on the CI rasteriser, and a gate holds that with a measure that does not depend on how busy the machine is.

## Scope

- Included: finding what grows with match time or page age and costs frame time, fixing it, and the gate.
- Excluded: simulation tick cost unless the measurements put the cause there; art changes.
- Off limits while they run: work 126 (foundation claims, foundation start, placement and construction-start files), work 128 (the AI's Monk and relic code, occupancy for carried relics), and the self-play gates work 128 re-derives.

## Approach

Separate the two candidate causes before anything else: a fresh page that loads a save of a late match, against one page kept open for the whole match, and a page kept open with nothing happening. Name the instrument first (AGENTS.md, Debugging): the existing frame-cost gate `tests/browser/de-ground-frame-cost.spec.ts`, Chrome's own tracing and heap snapshots through Playwright, and counts read from the renderer (draw calls, instances, meshes, textures, listeners, timers) sampled over the match. Prefer a count that grows with the defect over a timing, because timings on this shared machine swing with foreign load (local rules, "A feature's cost is its own share of tick time"); give any timing with its spread and the machine's load.

## Acceptance criteria

- The cause is named with evidence: which quantity grows, from which code, at what rate, and whether match state or page age drives it.
- After the fix, a late-match frame (about 20 minutes of game time, or its saved state) costs close to an opening frame on this machine, with numbers before and after and their spread.
- A gate that goes red with the defect put back, preferably on a count rather than a timing, and its bound stated in its header.
- Visual output is unchanged where the fix is not meant to change it: before and after captures with a pixel diff, per the repo's visual rule.
- A register entry, a changelog line and version at landing, the devlog lines, and the spec if it states a performance target.
- `npm run verify` exits 0 with its log read through the build, `node scripts/verify-receipt.mjs check` prints OK, and the change is on main.

## Implementation steps

- [ ] Separate state from age, find the growing quantity, fix it, gate it, record it, land it.

## Outcome

Pending. Record the verified revision, checks and limitations at closure.
